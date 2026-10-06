# Forensic Learning Record (Deep Inspection): hungps/flutter_pokedex

> **Canonical Artifact**: `07_PROJECT_LEARNING/hungps-flutter_pokedex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hungps/flutter_pokedex](https://github.com/hungps/flutter_pokedex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:31:29.171Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hungps/flutter_pokedex`
- **Description**: Pokedex app built with Flutter (with lots of animations) using Clean Architecture
- **Primary Language / Ecosystem**: Dart
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2528 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `windows/runner/utils.cpp`
```
#include "utils.h"

#include <flutter_windows.h>
#include <io.h>
#include <stdio.h>
#include <windows.h>

#include <iostream>

void CreateAndAttachConsole() {
  if (::AllocConsole()) {
    FILE *unused;
    if (freopen_s(&unused, "CONOUT$", "w", stdout)) {
      _dup2(_fileno(stdout), 1);
    }
    if (freopen_s(&unused, "CONOUT$", "w", stderr)) {
      _dup2(_fileno(stdout), 2);
    }
    std::ios::sync_with_stdio();
    FlutterDesktopResyncOutputStreams();
  }
}

std::vector<std::string> GetCommandLineArguments() {
  // Convert the UTF-16 command line arguments to UTF-8 for the Engine to use.
  int argc;
  wchar_t** argv = ::CommandLineToArgvW(::GetCommandLineW(), &argc);
  if (argv == nullptr) {
    return std::vector<std::string>();
  }

  std::vector<std::string> command_line_arguments;

  // Skip the first argument as it's the binary name.
  for (int i = 1; i < argc; i++) {
    command_line_arguments.push_back(Utf8FromUtf16(argv[i]));
  }

  ::LocalFree(argv);

  return command_line_arguments;
}

std::string Utf8FromUtf16(const wchar_t* utf16_string) {
  if (utf16_string == nullptr) {
    return std::string();
  }
  int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, utf8_string.data(),
      target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `windows/runner/utils.h`
```
#ifndef RUNNER_UTILS_H_
#define RUNNER_UTILS_H_

#include <string>
#include <vector>

// Creates a console for the process, and redirects stdout and stderr to
// it for both the runner and the Flutter library.
void CreateAndAttachConsole();

// Takes a null-terminated wchar_t* encoded in UTF-16 and returns a std::string
// encoded in UTF-8. Returns an empty std::string on failure.
std::string Utf8FromUtf16(const wchar_t* utf16_string);

// Gets the command line arguments passed in as a std::vector<std::string>,
// encoded in UTF-8. Returns an empty std::vector<std::string> on failure.
std::vector<std::string> GetCommandLineArguments();

#endif  // RUNNER_UTILS_H_

```

### Core Architecture Module: `android/app/src/main/kotlin/com/hungps/flutter_pokedex/MainActivity.kt`
```
package com.hungps.flutter_pokedex

import io.flutter.embedding.android.FlutterActivity

class MainActivity: FlutterActivity() {
}

```

### Core Architecture Module: `android/app/src/main/kotlin/com/hungps/flutterpokedex/MainActivity.kt`
```
package com.hungps.flutterpokedex

import io.flutter.embedding.android.FlutterActivity

class MainActivity: FlutterActivity() {
}

```

### Core Architecture Module: `ios/Runner/AppDelegate.swift`
```
import UIKit
import Flutter

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}

```

### Core Architecture Module: `ios/Runner/Runner-Bridging-Header.h`
```
#import "GeneratedPluginRegistrant.h"

```

### Core Architecture Module: `linux/flutter/generated_plugin_registrant.h`
```
//
//  Generated file. Do not edit.
//

// clang-format off

#ifndef GENERATED_PLUGIN_REGISTRANT_
#define GENERATED_PLUGIN_REGISTRANT_

#include <flutter_linux/flutter_linux.h>

// Registers Flutter plugins.
void fl_register_plugins(FlPluginRegistry* registry);

#endif  // GENERATED_PLUGIN_REGISTRANT_

```

### Core Architecture Module: `linux/my_application.h`
```
#ifndef FLUTTER_MY_APPLICATION_H_
#define FLUTTER_MY_APPLICATION_H_

#include <gtk/gtk.h>

G_DECLARE_FINAL_TYPE(MyApplication, my_application, MY, APPLICATION,
                     GtkApplication)

/**
 * my_application_new:
 *
 * Creates a new Flutter-based application.
 *
 * Returns: a new #MyApplication.
 */
MyApplication* my_application_new();

#endif  // FLUTTER_MY_APPLICATION_H_

```

### Core Architecture Module: `macos/Flutter/GeneratedPluginRegistrant.swift`
```
//
//  Generated file. Do not edit.
//

import FlutterMacOS
import Foundation

import path_provider_foundation
import sqflite_darwin

func RegisterGeneratedPlugins(registry: FlutterPluginRegistry) {
  PathProviderPlugin.register(with: registry.registrar(forPlugin: "PathProviderPlugin"))
  SqflitePlugin.register(with: registry.registrar(forPlugin: "SqflitePlugin"))
}

```

### Core Architecture Module: `macos/Runner/AppDelegate.swift`
```
import Cocoa
import FlutterMacOS

@NSApplicationMain
class AppDelegate: FlutterAppDelegate {
  override func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    return true
  }
}

```

### Core Architecture Module: `macos/Runner/MainFlutterWindow.swift`
```
import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow {
  override func awakeFromNib() {
    let flutterViewController = FlutterViewController.init()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
  }
}

```

### Core Architecture Module: `windows/flutter/generated_plugin_registrant.h`
```
//
//  Generated file. Do not edit.
//

// clang-format off

#ifndef GENERATED_PLUGIN_REGISTRANT_
#define GENERATED_PLUGIN_REGISTRANT_

#include <flutter/plugin_registry.h>

// Registers Flutter plugins.
void RegisterPlugins(flutter::PluginRegistry* registry);

#endif  // GENERATED_PLUGIN_REGISTRANT_

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #44** (2021-10-24): **There's a bug**
  *Symptoms*: https://user-images.githubusercontent.com/69076992/131280568-ac4b0764-43f9-4625-aa1c-fb17f5076c4c.mp4  https://user-images.githubusercontent.com/69076992/131280574-78b16aa6-8c14-4afd-906f-ba4a7600619e.mp4
  **Post-Mortem & Fix Analysis**:
  > @Hugovidafe Thanks for reporting the bug!

- **Issue #35** (2021-07-11): **Pokemon image is not showed when the internet connection has been lost**
  *Symptoms*: When i lost internet connection the pokemon images don't load
  **Post-Mortem & Fix Analysis**:
  > Hi @jsmartinezn, Currently, this app doesn't save the image because there are too many of them (about ~1000 images). I'm considering 2 possible solutions:  1. Show the pokemon placeholder with an exclamation mark (!) indicate that the image cannot be load due to the internet connection. 2. Add a new feature that will allow the user to download all the images and the pokemons into the device's storage so that the app can still be used in offline mode.  I think the latter will be better, what do you think? 
  > Hi,  I prefered the first option because as the number of registered pokemon increases, it will not be feasible to store them all locally for memory space. ________________________________ De: Pham Sy Hung ***@***.***> Enviado: martes, 1 de junio de 2021 10:57 p. m. Para: scitbiz/flutter_pokedex ***@***.***> Cc: Juan Sebastian Martinez Niño ***@***.***>; Mention ***@***.***> Asunto: Re: [scitbiz/flutter_pokedex] Pokemon image bug (#35)   Hi @jsmartinezn<https://nam10.safelinks.protection.outlook.com/?url=https%3A%2F%2Fgithub.com%2Fjsmartinezn&data=04%7C01%7Cjs.martinezn%40uniandes.edu.co%7C979dd33833ae434a289908d9257a8cc7%7Cfabd047cff48492a8bbb8f98b9fb9cca%7C0%7C0%7C637582030543319176%7CUnknown%7CTWFpbGZsb3d8eyJWIjoiMC4wLjAwMDAiLCJQIjoiV2luMzIiLCJBTiI6Ik1haWwiLCJXVCI6Mn0%3D%7C1000&sdata=xsm5ltBqEWrdDJYqRMJFGH%2Fr55iakm%2F7j4MbDTf3vzw%3D&reserved=0>, Currently, this app doesn't save the image because there are too many of them (about ~1000 images). I'm considering 2 possible solutions: 
  > @jsmartinezn Can you confirm https://github.com/scitbiz/flutter_pokedex/pull/39 solve your problem?

- **Issue #34** (2021-07-11): **Eternal progress indicator**
  *Symptoms*: when I try to access the pokedex view without an internet connection it never loads the information, and never displays a message about it either.
  **Post-Mortem & Fix Analysis**:
  > Hi @jsmartinezn, Thank you for reporting this issue, I will take a look into it and make a fix ASAP!
  > @jsmartinezn Can you confirm https://github.com/scitbiz/flutter_pokedex/pull/40 solve this issue?

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

### Incident Patch 1: `8174aeb4` (2025-05-03)
**Commit Message**: Merge pull request #90 from hungps/fix/deprecated-imperative-gradle-plugins

fix: Deprecated imperative apply of Flutter's Gradle plugins

**File**: `android/.gitignore` (modified, +2/-0)
```diff
@@ -11,3 +11,5 @@ GeneratedPluginRegistrant.java
 key.properties
 **/*.keystore
 **/*.jks
+
+.cxx/
```

**File**: `android/app/build.gradle` (modified, +8/-11)
```diff
@@ -1,3 +1,9 @@
+plugins {
+    id "com.android.application"
+    id "kotlin-android"
+    id "dev.flutter.flutter-gradle-plugin"
+}
+
 def localProperties = new Properties()
 def localPropertiesFile = rootProject.file('local.properties')
 if (localPropertiesFile.exists()) {
@@ -6,11 +12,6 @@ if (localPropertiesFile.exists()) {
     }
 }
 
-def flutterRoot = localProperties.getProperty('flutter.sdk')
-if (flutterRoot == null) {
-    throw new GradleException("Flutter SDK not found. Define location with flutter.sdk in the local.properties file.")
-}
-
 def flutterVersionCode = localProperties.getProperty('flutter.versionCode')
 if (flutterVersionCode == null) {
     flutterVersionCode = '1'
@@ -21,11 +22,9 @@ if (flutterVersionName == null) {
     flutterVersionName = '1.0'
 }
 
-apply plugin: 'com.android.application'
-apply plugin: 'kotlin-android'
-apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"
-
 android {
+    namespace 'com.hungps.flutterpokedex'
+
     compileSdkVersion flutter.compileSdkVersion
 
     compileOptions {
@@ -59,7 +58,6 @@ android {
             minifyEnabled true
             // useProguard true
 
-            
             proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
         }
     }
@@ -70,5 +68,4 @@ flutter {
 }
 
 dependencies {
-    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlin_version"
 }
```

**File**: `android/build.gradle` (modified, +2/-15)
```diff
@@ -1,16 +1,3 @@
-buildscript {
-    ext.kotlin_version = "1.6.10"
-    repositories {
-        google()
-        mavenCentral()
-    }
-
-    dependencies {
-        classpath 'com.android.tools.build:gradle:7.1.2'
-        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
-    }
-}
-
 allprojects {
     repositories {
         google()
@@ -26,6 +13,6 @@ subprojects {
     project.evaluationDependsOn(':app')
 }
 
-task clean(type: Delete) {
-    delete rootProject.buildDir
+tasks.register("clean", Delete) {
+    delete rootProject.layout.buildDirectory
 }
```

**File**: `android/gradle/wrapper/gradle-wrapper.properties` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
-#Fri Jun 23 08:50:38 CEST 2017
+#Sat May 03 22:04:52 ICT 2025
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
+distributionUrl=https\://services.gradle.org/distributions/gradle-8.11.1-bin.zip
 zipStoreBase=GRADLE_USER_HOME
 zipStorePath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-7.2-all.zip
```

**File**: `android/settings.gradle` (modified, +22/-8)
```diff
@@ -1,11 +1,25 @@
-include ':app'
+pluginManagement {
+    def flutterSdkPath = {
+        def properties = new Properties()
+        file("local.properties").withInputStream { properties.load(it) }
+        def flutterSdkPath = properties.getProperty("flutter.sdk")
+        assert flutterSdkPath != null, "flutter.sdk not set in local.properties"
+        return flutterSdkPath
+    }()
 
-def localPropertiesFile = new File(rootProject.projectDir, "local.properties")
-def properties = new Properties()
+    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")
 
-assert localPropertiesFile.exists()
-localPropertiesFile.withReader("UTF-8") { reader -> properties.load(reader) }
+    repositories {
+        google()
+        mavenCentral()
+        gradlePluginPortal()
+    }
+}
 
-def flutterSdkPath = properties.getProperty("flutter.sdk")
-assert flutterSdkPath != null, "flutter.sdk not set in local.properties"
-apply from: "$flutterSdkPath/packages/flutter_tools/gradle/app_plugin_loader.gradle"
+plugins {
+    id "dev.flutter.flutter-plugin-loader" version "1.0.0" // apply true
+    id "com.android.application" version "8.8.2" apply false
+    id "org.jetbrains.kotlin.android" version "2.1.20" apply false
+}
+
+include ":app"
```

---

### Incident Patch 2: `8f8c4c4c` (2025-05-03)
**Commit Message**: fix: Deprecated imperative apply of Flutter's Gradle plugins

**File**: `android/.gitignore` (modified, +2/-0)
```diff
@@ -11,3 +11,5 @@ GeneratedPluginRegistrant.java
 key.properties
 **/*.keystore
 **/*.jks
+
+.cxx/
```

**File**: `android/app/build.gradle` (modified, +8/-11)
```diff
@@ -1,3 +1,9 @@
+plugins {
+    id "com.android.application"
+    id "kotlin-android"
+    id "dev.flutter.flutter-gradle-plugin"
+}
+
 def localProperties = new Properties()
 def localPropertiesFile = rootProject.file('local.properties')
 if (localPropertiesFile.exists()) {
@@ -6,11 +12,6 @@ if (localPropertiesFile.exists()) {
     }
 }
 
-def flutterRoot = localProperties.getProperty('flutter.sdk')
-if (flutterRoot == null) {
-    throw new GradleException("Flutter SDK not found. Define location with flutter.sdk in the local.properties file.")
-}
-
 def flutterVersionCode = localProperties.getProperty('flutter.versionCode')
 if (flutterVersionCode == null) {
     flutterVersionCode = '1'
@@ -21,11 +22,9 @@ if (flutterVersionName == null) {
     flutterVersionName = '1.0'
 }
 
-apply plugin: 'com.android.application'
-apply plugin: 'kotlin-android'
-apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"
-
 android {
+    namespace 'com.hungps.flutterpokedex'
+
     compileSdkVersion flutter.compileSdkVersion
 
     compileOptions {
@@ -59,7 +58,6 @@ android {
             minifyEnabled true
             // useProguard true
 
-            
             proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
         }
     }
@@ -70,5 +68,4 @@ flutter {
 }
 
 dependencies {
-    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlin_version"
 }
```

**File**: `android/build.gradle` (modified, +2/-15)
```diff
@@ -1,16 +1,3 @@
-buildscript {
-    ext.kotlin_version = "1.6.10"
-    repositories {
-        google()
-        mavenCentral()
-    }
-
-    dependencies {
-        classpath 'com.android.tools.build:gradle:7.1.2'
-        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
-    }
-}
-
 allprojects {
     repositories {
         google()
@@ -26,6 +13,6 @@ subprojects {
     project.evaluationDependsOn(':app')
 }
 
-task clean(type: Delete) {
-    delete rootProject.buildDir
+tasks.register("clean", Delete) {
+    delete rootProject.layout.buildDirectory
 }
```

**File**: `android/gradle/wrapper/gradle-wrapper.properties` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
-#Fri Jun 23 08:50:38 CEST 2017
+#Sat May 03 22:04:52 ICT 2025
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
+distributionUrl=https\://services.gradle.org/distributions/gradle-8.11.1-bin.zip
 zipStoreBase=GRADLE_USER_HOME
 zipStorePath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-7.2-all.zip
```

**File**: `android/settings.gradle` (modified, +22/-8)
```diff
@@ -1,11 +1,25 @@
-include ':app'
+pluginManagement {
+    def flutterSdkPath = {
+        def properties = new Properties()
+        file("local.properties").withInputStream { properties.load(it) }
+        def flutterSdkPath = properties.getProperty("flutter.sdk")
+        assert flutterSdkPath != null, "flutter.sdk not set in local.properties"
+        return flutterSdkPath
+    }()
 
-def localPropertiesFile = new File(rootProject.projectDir, "local.properties")
-def properties = new Properties()
+    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")
 
-assert localPropertiesFile.exists()
-localPropertiesFile.withReader("UTF-8") { reader -> properties.load(reader) }
+    repositories {
+        google()
+        mavenCentral()
+        gradlePluginPortal()
+    }
+}
 
-def flutterSdkPath = properties.getProperty("flutter.sdk")
-assert flutterSdkPath != null, "flutter.sdk not set in local.properties"
-apply from: "$flutterSdkPath/packages/flutter_tools/gradle/app_plugin_loader.gradle"
+plugins {
+    id "dev.flutter.flutter-plugin-loader" version "1.0.0" // apply true
+    id "com.android.application" version "8.8.2" apply false
+    id "org.jetbrains.kotlin.android" version "2.1.20" apply false
+}
+
+include ":app"
```

---

### Incident Patch 3: `f40694a8` (2024-12-14)
**Commit Message**: Merge pull request #84 from namangarg1902/fix/PokemonNumber

**File**: `lib/presenter/widgets/pokemon_card.dart` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ class PokemonCard extends StatelessWidget {
         style: const TextStyle(
           fontSize: 14,
           fontWeight: FontWeight.bold,
-          color: Colors.black12,
+          color: Colors.white70,
         ),
       ),
     );
```

---

### Incident Patch 4: `d7509be0` (2024-12-13)
**Commit Message**: FIX: issue #83

**File**: `lib/presenter/widgets/pokemon_card.dart` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ class PokemonCard extends StatelessWidget {
         style: const TextStyle(
           fontSize: 14,
           fontWeight: FontWeight.bold,
-          color: Colors.black12,
+          color: Colors.white70,
         ),
       ),
     );
```

---

### Incident Patch 5: `eee5593e` (2024-01-06)
**Commit Message**: fix: updating the dark theme color schemes

**File**: `lib/routes.dart` (modified, +2/-0)
```diff
@@ -63,5 +63,7 @@ class AppNavigator {
 
   static void pop() => state?.pop();
 
+  static bool canPop() => state?.canPop() ?? false;
+
   static NavigatorState? get state => navigatorKey.currentState;
 }
```

**File**: `lib/ui/modals/search_modal.dart` (modified, +3/-1)
```diff
@@ -14,7 +14,9 @@ class SearchBottomModal extends StatelessWidget {
       child: Flexible(
         child: Padding(
           padding: EdgeInsets.fromLTRB(26, 14, 26, 14 + viewInsets + safeAreaBottom),
-          child: const AppSearchBar(),
+          child: AppSearchBar(
+            hintText: 'Search Pokemon, Move, Ability etc',
+          ),
         ),
       ),
     );
```

**File**: `lib/ui/screens/home/home.dart` (modified, +15/-73)
```diff
@@ -1,26 +1,22 @@
-// ignore_for_file: unnecessary_null_comparison
-
 import 'package:flutter/material.dart';
 import 'package:flutter_bloc/flutter_bloc.dart';
 import 'package:pokedex/configs/colors.dart';
-import 'package:pokedex/configs/images.dart';
-import 'package:pokedex/data/categories.dart';
-import 'package:pokedex/domain/entities/category.dart';
 import 'package:pokedex/routes.dart';
 import 'package:pokedex/states/settings/settings_bloc.dart';
 import 'package:pokedex/states/settings/settings_event.dart';
 import 'package:pokedex/states/settings/settings_selector.dart';
 import 'package:pokedex/ui/themes/extensions.dart';
 import 'package:pokedex/ui/themes/themes/themes.dark.dart';
 import 'package:pokedex/ui/themes/themes/themes.light.dart';
-import 'package:pokedex/ui/widgets/pokeball_background.dart';
+import 'package:pokedex/ui/widgets/app_bar.dart';
+import 'package:pokedex/ui/widgets/button.dart';
 import 'package:pokedex/ui/widgets/input.dart';
+import 'package:pokedex/ui/widgets/scaffold.dart';
 
-import 'widgets/category_card.dart';
-import 'widgets/news_card.dart';
-
-part 'sections/header_card_content.dart';
-part 'sections/pokemon_news.dart';
+part 'widgets/category_card.dart';
+part 'widgets/news_card.dart';
+part 'sections/header.dart';
+part 'sections/news.dart';
 
 class HomeScreen extends StatefulWidget {
   const HomeScreen({super.key});
@@ -30,76 +26,22 @@ class HomeScreen extends StatefulWidget {
 }
 
 class _HomeScreenState extends State<HomeScreen> {
-  final ScrollController _scrollController = ScrollController();
-
-  bool showTitle = false;
-
-  @override
-  void initState() {
-    _scrollController.addListener(_onScroll);
-
-    super.initState();
-  }
-
-  @override
-  void dispose() {
-    if (_scrollController != null) {
-      _scrollController.dispose();
-    }
-
-    super.dispose();
-  }
-
-  void _onScroll() {
-    if (!_scrollController.hasClients) return;
-
-    final offset = _scrollController.offset;
-    final showTitle = offset > _HeaderCardContent.height - kToolbarHeight;
-
-    // Prevent unneccesary rebuild
-    if (this.showTitle == showTitle) return;
-
-    setState(() {
-      this.showTitle = showTitle;
-    });
-  }
-
   @override
   Widget build(BuildContext context) {
     return Scaffold(
       backgroundColor: context.colors.backgroundDark,
       body: NestedScrollView(
-        controller: _scrollController,
-        headerSliverBuilder: (_, __) => [
-          SliverAppBar(
-            expandedHeight: _HeaderCardContent.height,
-            floating: true,
-            pinned: true,
-            elevation: 0,
-            shape: const RoundedRectangleBorder(
-              borderRadius: BorderRadius.vertical(
-                bottom: Radius.circular(30),
-              ),
-            ),
-            backgroundColor: AppColors.red,
-            flexibleSpace: FlexibleSpaceBar(
-              collapseMode: CollapseMode.pin,
-              centerTitle: true,
-              title: Visibility(
-                visible: showTitle,
-                child: Text(
-                  'Pokedex',
-                  style: Theme.of(context)
-                      .appBarTheme
-                      .toolbarTextStyle
-                      ?.copyWith(fontWeight: FontWeight.bold),
-                ),
-              ),
-              background: _HeaderCardContent(),
+        headerSliverBuilder: (_, innerBoxIsScrolled) => [
+          AppExpandableSliverAppBar(
+            backgroundColor: context.colors.primary,
+            title: Visibility(
+              visible: innerBoxIsScrolled,
+              child: const Text('Pokedex'),
             ),
+            background: const _HeaderSection(),
           ),
         ],
-        body: const _PokemonNews(),
+        body: const _NewsSection(),
       ),
     );
   }
```

**File**: `lib/ui/screens/home/sections/header.dart` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+part of '../home.dart';
+
+class _HeaderSection extends StatelessWidget implements PreferredSizeWidget {
+  const _HeaderSection();
+
+  @override
+  Size get preferredSize => const Size.fromHeight(582);
+
+  void _onThemeSwitcherPressed(BuildContext context) {
+    final settingsBloc = context.read<SettingsBloc>();
+    final currentTheme = settingsBloc.state.theme;
+
+    settingsBloc.add(SettingsThemeChanged(
+      currentTheme is LightAppTheme ? const DarkAppTheme() : const LightAppTheme(),
+    ));
+  }
+
+  @override
+  Widget build(BuildContext context) {
+    return PokeballScaffold(
+      body: SafeArea(
+        child: Padding(
+          padding: const EdgeInsets.symmetric(horizontal: 26),
+          child: Column(
+            crossAxisAlignment: CrossAxisAlignment.start,
+            children: [
+              Transform.translate(
+                offset: const Offset(-12, 0),
+                child: SettingsThemeSelector(
+                  builder: (theme) => ThemeSwitcherButton(
+                    isDarkTheme: theme is DarkAppTheme,
+                    onPressed: () => _onThemeSwitcherPressed(context),
+                  ),
+                ),
+              ),
+              const Spacer(),
+              const Padding(padding: EdgeInsets.only(top: 24)),
+              Text(
+                'What Pokemon\nare you looking for?',
+                style: context.appTheme.typographies.headingLarge,
+              ),
+              const Padding(padding: EdgeInsets.only(top: 36)),
+              AppSearchBar(
+                hintText: 'Search Pokemon, Move, Ability etc',
+              ),
+              const Padding(padding: EdgeInsets.only(top: 36)),
+              GridView(
+                shrinkWrap: true,
+                physics: const NeverScrollableScrollPhysics(),
+                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
+                  crossAxisCount: 2,
+                  crossAxisSpacing: 10,
+                  childAspectRatio: 2.58,
+                  mainAxisSpacing: 15,
+                ),
+                children: [
+                  _CategoryCard(
+                    title: 'Pokedex',
+                    color: AppColors.teal,
+                    onPressed: () => AppNavigator.push(Routes.pokedex),
+                  ),
+                  const _CategoryCard(
+                    title: 'Moves',
+                    color: AppColors.red,
+                  ),
+                  const _CategoryCard(
+                    title: 'Abilities',
+                    color: AppColors.blue,
+                  ),
+                  _CategoryCard(
+                    title: 'Items',
+                    color: AppColors.yellow,
+                    onPressed: () => AppNavigator.push(Routes.items),
+                  ),
+                  const _CategoryCard(
+                    title: 'Locations',
+                    color: AppColors.purple,
+                  ),
+                  _CategoryCard(
+                    title: 'Type Effects',
+                    color: AppColors.brown,
+                    onPressed: () => AppNavigator.push(Routes.typeEffects),
+                  ),
+                ],
+              ),
+              const SizedBox(height: 36),
+            ],
+          ),
+        ),
+      ),
+    );
+  }
+}
```

**File**: `lib/ui/screens/home/sections/header_card_content.dart` (removed, +0/-92)
```diff
@@ -1,92 +0,0 @@
-part of '../home.dart';
-
-class _HeaderCardContent extends StatelessWidget {
-  static const double height = 582;
-
-  void _onSelectCategory(Category category) {
-    AppNavigator.push(category.route);
-  }
-
-  @override
-  Widget build(BuildContext context) {
-    return Container(
-      clipBehavior: Clip.hardEdge,
-      decoration: const BoxDecoration(
-        borderRadius: BorderRadius.vertical(bottom: Radius.circular(10)),
-      ),
-      child: PokeballBackground(
-        child: Padding(
-          padding: const EdgeInsets.symmetric(horizontal: 28),
-          child: Column(
-            mainAxisSize: MainAxisSize.max,
-            mainAxisAlignment: MainAxisAlignment.start,
-            crossAxisAlignment: CrossAxisAlignment.stretch,
-            children: <Widget>[
-              SafeArea(
-                child: Align(
-                  alignment: Alignment.topLeft,
-                  child: SettingsThemeSelector(builder: (theme) {
-                    return IconButton(
-                        iconSize: 25,
-                        onPressed: () => context.read<SettingsBloc>().add(
-                              theme is LightAppTheme
-                                  ? const SettingsThemeChanged(DarkAppTheme())
-                                  : const SettingsThemeChanged(LightAppTheme()),
-                            ),
-                        icon: Icon(
-                          theme is LightAppTheme
-                              ? Icons.dark_mode_outlined
-                              : Icons.wb_sunny_outlined,
-                        ));
-                  }),
-                ),
-              ),
-              _buildTitle(),
-              const SizedBox(height: 16),
-              const AppSearchBar(),
-              _buildCategories(context),
-            ],
-          ),
-        ),
-      ),
-    );
-  }
-
-  Widget _buildTitle() {
-    return Expanded(
-      child: Container(
-        constraints: const BoxConstraints.expand(),
-        alignment: Alignment.bottomLeft,
-        child: const Text(
-          'What Pokemon\nare you looking for?',
-          style: TextStyle(
-            fontSize: 30,
-            height: 1.6,
-            fontWeight: FontWeight.w900,
-          ),
-        ),
-      ),
-    );
-  }
-
-  Widget _buildCategories(BuildContext context) {
-    return GridView.builder(
-      shrinkWrap: true,
-      physics: const NeverScrollableScrollPhysics(),
-      padding: const EdgeInsets.only(top: 42, bottom: 62),
-      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
-        crossAxisCount: 2,
-        crossAxisSpacing: 10,
-        childAspectRatio: 2.6,
-        mainAxisSpacing: 15,
-      ),
-      itemCount: categories.length,
-      itemBuilder: (context, index) {
-        return CategoryCard(
-          categories[index],
-          onPress: () => _onSelectCategory(categories[index]),
-        );
-      },
-    );
-  }
-}
```

**File**: `lib/ui/screens/home/sections/news.dart` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+part of '../home.dart';
+
+class _NewsSection extends StatelessWidget {
+  const _NewsSection();
+
+  @override
+  Widget build(BuildContext context) {
+    return ListView(
+      physics: const ClampingScrollPhysics(),
+      padding: const EdgeInsets.all(24),
+      children: <Widget>[
+        Row(
+          mainAxisAlignment: MainAxisAlignment.spaceBetween,
+          children: [
+            Text(
+              'Pokémon News',
+              style: context.typographies.headingSmall,
+            ),
+            TextButton(
+              onPressed: () {},
+              style: TextButton.styleFrom(foregroundColor: context.colors.secondary),
+              child: const Text('View All'),
+            ),
+          ],
+        ),
+        ListView.separated(
+          shrinkWrap: true,
+          physics: const NeverScrollableScrollPhysics(),
+          itemCount: 9,
+          separatorBuilder: (context, index) => const Divider(height: 24),
+          itemBuilder: (context, index) {
+            return const _NewsListTile(
+              title: 'Pokémon Rumble Rush Arrives Soon',
+              time: '15 May 2019',
+              thumbnail: AssetImage('assets/images/thumbnail.png'),
+            );
+          },
+        ),
+      ],
+    );
+  }
+}
```

**File**: `lib/ui/screens/home/sections/pokemon_news.dart` (removed, +0/-59)
```diff
@@ -1,59 +0,0 @@
-part of '../home.dart';
-
-class _PokemonNews extends StatelessWidget {
-  const _PokemonNews();
-
-  @override
-  Widget build(BuildContext context) {
-    return ListView(
-      physics: const ClampingScrollPhysics(),
-      children: <Widget>[
-        _buildHeader(context),
-        _buildNews(),
-      ],
-    );
-  }
-
-  Widget _buildHeader(BuildContext context) {
-    return const Padding(
-      padding: EdgeInsets.fromLTRB(28, 0, 28, 22),
-      child: Row(
-        mainAxisSize: MainAxisSize.max,
-        mainAxisAlignment: MainAxisAlignment.spaceBetween,
-        children: <Widget>[
-          Text(
-            'Pokémon News',
-            style: TextStyle(
-              fontSize: 20,
-              fontWeight: FontWeight.w900,
-            ),
-          ),
-          Text(
-            'View All',
-            style: TextStyle(
-              fontSize: 14,
-              fontWeight: FontWeight.w500,
-              color: AppColors.indigo,
-            ),
-          ),
-        ],
-      ),
-    );
-  }
-
-  Widget _buildNews() {
-    return ListView.separated(
-      shrinkWrap: true,
-      physics: const NeverScrollableScrollPhysics(),
-      itemCount: 9,
-      separatorBuilder: (context, index) => const Divider(),
-      itemBuilder: (context, index) {
-        return const NewsCard(
-          title: 'Pokémon Rumble Rush Arrives Soon',
-          time: '15 May 2019',
-          thumbnail: AppImages.thumbnail,
-        );
-      },
-    );
-  }
-}
```

**File**: `lib/ui/screens/home/widgets/category_card.dart` (modified, +92/-85)
```diff
@@ -1,118 +1,125 @@
-import 'package:flutter/material.dart';
-import 'package:pokedex/configs/images.dart';
-import 'package:pokedex/domain/entities/category.dart';
+part of '../home.dart';
 
-class CategoryCard extends StatelessWidget {
-  final Category category;
-  final void Function()? onPress;
+class _CategoryCard extends StatelessWidget {
+  final String title;
+  final Color color;
+  final VoidCallback? onPressed;
 
-  const CategoryCard(
-    this.category, {super.key, 
-    this.onPress,
+  const _CategoryCard({
+    required this.title,
+    required this.color,
+    this.onPressed,
   });
 
   @override
   Widget build(BuildContext context) {
-    return LayoutBuilder(
-      builder: (context, constrains) {
-        final itemHeight = constrains.maxHeight;
-        final itemWidth = constrains.maxWidth;
+    return LayoutBuilder(builder: (_, constraints) {
+      final height = constraints.maxHeight;
 
-        return Stack(
-          children: <Widget>[
-            Align(
-              alignment: Alignment.bottomCenter,
-              child: _Shadows(color: category.color, width: itemWidth * 0.82),
+      return Stack(
+        children: [
+          Align(
+            alignment: Alignment.bottomCenter,
+            child: _CardShadow(color: color),
+          ),
+          FilledButton(
+            onPressed: onPressed,
+            style: FilledButton.styleFrom(
+              padding: EdgeInsets.zero,
+              backgroundColor: color,
+              disabledBackgroundColor: color,
+              disabledForegroundColor: Theme.of(context).colorScheme.onPrimary,
             ),
-            Material(
-              color: category.color,
-              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
-              clipBehavior: Clip.antiAlias,
-              child: InkWell(
-                splashColor: Colors.white10,
-                highlightColor: Colors.white10,
-                onTap: onPress,
-                child: Stack(
-                  children: [
-                    _buildPokeballDecoration(height: itemHeight),
-                    _buildCircleDecoration(height: itemHeight),
-                    _CardContent(category.name),
-                  ],
-                ),
+            child: ClipRRect(
+              child: Stack(
+                alignment: Alignment.centerLeft,
+                children: [
+                  Align(
+                    alignment: Alignment.topLeft,
+                    child: _CircleDecorator(size: height),
+                  ),
+                  Align(
+                    alignment: Alignment.centerRight,
+                    child: _PokeballDecorator(size: height),
+                  ),
+                  Padding(
+                    padding: const EdgeInsets.symmetric(horizontal: 16),
+                    child: Text(
+                      title,
+                      style: context.typographies.body.copyWith(
+                        color: Theme.of(context).colorScheme.onPrimary,
+                        fontWeight: FontWeight.w700,
+                      ),
+                    ),
+                  ),
+                ],
               ),
-            )
-          ],
-        );
-      },
-    );
+            ),
+          ),
+        ],
+      );
+    });
   }
+}
 
-  Widget _buildCircleDecoration({required double height}) {
-    return Positioned(
-      top: -height * 0.616,
-      left: -height * 0.53,
-      child: CircleAvatar(
-        radius: (height * 1.03) / 2,
-        backgroundColor: Colors.white.withOpacity(0.14),
-      ),
-    );
-  }
+class _CardShadow extends StatelessWidget {
+  const _CardShadow({
+    required this.color,
+  });
 
-  Widget _buildPokeballDecoration({required double height}) {
-    return Positioned(
-      top: -height * 0.16,
-      right: -height * 0.25,
-      child: Image(
-        image: AppImages.pokeball,
-        width: height * 1.388,
-        height: height * 1.388,
-        color: Colors.white.withOpacity(0.14),
+  final Color color;
+
+  @override
+  Widget build(BuildContext context) {
+    return Container(
+      clipBehavior: Clip.hardEdge,
+      height: 11,
+      decoration: BoxDecoration(
+        borderRadius: BorderRadius.circular(14),
+        boxShadow: [
+          BoxShadow(
+            color: color,
+            offset: const Offset(0, 6),
+            blurRadius: 23,
+          ),
+        ],
       ),
     );
   }
 }
 
-class _CardContent extends StatelessWidget {
-  const _CardContent(this.name);
+class _CircleDecorator extends StatelessWidget {
+  final double size;
 
-  final String name;
+  const _CircleDecorator({required this.size});
 
   @override
   Widget build(BuildContext context) {
-    return Container(
-      alignment: Alignment.centerLeft,
-      padding: const EdgeInsets.symmetric(horizontal: 16.0),
-      child: Text(
-        name,
-        style: const TextStyle(
-          fontSize: 14,
-          fontWeight: FontWe
```

---

### Incident Patch 6: `ad2c8690` (2022-04-11)
**Commit Message**: Fixed project requires latest kotlin issue (#61)

**File**: `android/app/build.gradle` (modified, +1/-0)
```diff
@@ -59,6 +59,7 @@ android {
             minifyEnabled true
             useProguard true
 
+            
             proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
         }
     }
```

**File**: `android/build.gradle` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 buildscript {
-    ext.kotlin_version = '1.3.50'
+    ext.kotlin_version = "1.6.10"
     repositories {
         google()
         mavenCentral()
     }
 
     dependencies {
-        classpath 'com.android.tools.build:gradle:4.1.0'
+        classpath 'com.android.tools.build:gradle:7.1.2'
         classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
     }
 }
```

**File**: `android/gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -3,4 +3,4 @@ distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
 zipStoreBase=GRADLE_USER_HOME
 zipStorePath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-6.7-all.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-7.2-all.zip
```

---

### Incident Patch 7: `66480088` (2022-01-22)
**Commit Message**: Merge pull request #54 from hungps/refactor/null-safety

Migrate to null safety

**File**: `ios/Podfile.lock` (modified, +8/-8)
```diff
@@ -3,15 +3,15 @@ PODS:
   - FMDB (2.7.5):
     - FMDB/standard (= 2.7.5)
   - FMDB/standard (2.7.5)
-  - path_provider (0.0.1):
+  - path_provider_ios (0.0.1):
     - Flutter
-  - sqflite (0.0.1):
+  - sqflite (0.0.2):
     - Flutter
-    - FMDB (~> 2.7.2)
+    - FMDB (>= 2.7.5)
 
 DEPENDENCIES:
   - Flutter (from `Flutter`)
-  - path_provider (from `.symlinks/plugins/path_provider/ios`)
+  - path_provider_ios (from `.symlinks/plugins/path_provider_ios/ios`)
   - sqflite (from `.symlinks/plugins/sqflite/ios`)
 
 SPEC REPOS:
@@ -21,16 +21,16 @@ SPEC REPOS:
 EXTERNAL SOURCES:
   Flutter:
     :path: Flutter
-  path_provider:
-    :path: ".symlinks/plugins/path_provider/ios"
+  path_provider_ios:
+    :path: ".symlinks/plugins/path_provider_ios/ios"
   sqflite:
     :path: ".symlinks/plugins/sqflite/ios"
 
 SPEC CHECKSUMS:
   Flutter: 50d75fe2f02b26cc09d224853bb45737f8b3214a
   FMDB: 2ce00b547f966261cd18927a3ddb07cb6f3db82a
-  path_provider: abfe2b5c733d04e238b0d8691db0cfd63a27a93c
-  sqflite: 4001a31ff81d210346b500c55b17f4d6c7589dd0
+  path_provider_ios: 7d7ce634493af4477d156294792024ec3485acd5
+  sqflite: 6d358c025f5b867b29ed92fc697fd34924e11904
 
 PODFILE CHECKSUM: aafe91acc616949ddb318b77800a7f51bffa2a4c
 
```

**File**: `lib/configs/types.dart` (modified, +5/-5)
```diff
@@ -3,11 +3,11 @@ import 'package:pokedex/domain/entities/pokemon_types.dart';
 
 class PokeTypes {
   const PokeTypes({
-    @required this.type,
-    @required this.superEffective,
-    @required this.notEffective,
-    @required this.nilEffective,
-    @required this.color,
+    required this.type,
+    required this.superEffective,
+    required this.notEffective,
+    required this.nilEffective,
+    required this.color,
   });
   final PokemonTypes type;
   final List<String> superEffective;
```

**File**: `lib/core/extensions/animation.dart` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import 'package:flutter/animation.dart';
 
 extension AnimationControllerX on AnimationController {
-  Animation<T> curvedTweenAnimation<T>({T begin, T end}) {
+  Animation<T> curvedTweenAnimation<T>({required T begin, required T end}) {
     return Tween<T>(begin: begin, end: end).animate(CurvedAnimation(
       curve: Curves.easeInOut,
       parent: this,
```

**File**: `lib/core/extensions/context.dart` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import 'package:pokedex/configs/constants.dart';
 extension BuildContextX on BuildContext {
   Size get screenSize => MediaQuery.of(this).size;
 
-  double get iconSize => IconTheme.of(this).size;
+  double get iconSize => IconTheme.of(this).size ?? 0;
 
   EdgeInsets get padding => MediaQuery.of(this).padding;
 
```

**File**: `lib/core/fade_page_route.dart` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import 'package:flutter/material.dart';
 
 class FadeRoute extends PageRouteBuilder {
-  FadeRoute({this.page})
+  FadeRoute({required this.page})
       : super(
           pageBuilder: (_, __, ___) => page,
           transitionsBuilder: (_, animation, __, child) => FadeTransition(
```

**File**: `lib/core/network.dart` (modified, +2/-2)
```diff
@@ -22,8 +22,8 @@ class NetworkManager {
     RequestMethod method,
     String url, {
     data,
-    Map<String, dynamic> headers,
-    Map<String, dynamic> queryParameters,
+    Map<String, dynamic>? headers,
+    Map<String, dynamic>? queryParameters,
   }) {
     return dio.request(
       url,
```

**File**: `lib/data/repositories/pokemon_repository.dart` (modified, +9/-13)
```diff
@@ -7,13 +7,13 @@ import 'package:pokedex/domain/entities/pokemon.dart';
 abstract class PokemonRepository {
   Future<List<Pokemon>> getAllPokemons();
 
-  Future<List<Pokemon>> getPokemons({int limit, int page});
+  Future<List<Pokemon>> getPokemons({required int limit, required int page});
 
-  Future<Pokemon> getPokemon(String number);
+  Future<Pokemon?> getPokemon(String number);
 }
 
 class PokemonDefaultRepository extends PokemonRepository {
-  PokemonDefaultRepository({this.githubDataSource, this.localDataSource});
+  PokemonDefaultRepository({required this.githubDataSource, required this.localDataSource});
 
   final GithubDataSource githubDataSource;
   final LocalDataSource localDataSource;
@@ -31,16 +31,13 @@ class PokemonDefaultRepository extends PokemonRepository {
 
     final pokemonHiveModels = await localDataSource.getAllPokemons();
 
-    final pokemonEntities = pokemonHiveModels
-        .where((element) => element != null)
-        .map((e) => e.toEntity())
-        .toList();
+    final pokemonEntities = pokemonHiveModels.map((e) => e.toEntity()).toList();
 
     return pokemonEntities;
   }
 
   @override
-  Future<List<Pokemon>> getPokemons({int limit, int page}) async {
+  Future<List<Pokemon>> getPokemons({required int limit, required int page}) async {
     final hasCachedData = await localDataSource.hasData();
 
     if (!hasCachedData) {
@@ -54,18 +51,17 @@ class PokemonDefaultRepository extends PokemonRepository {
       page: page,
       limit: limit,
     );
-    final pokemonEntities = pokemonHiveModels
-        .where((element) => element != null)
-        .map((e) => e.toEntity())
-        .toList();
+    final pokemonEntities = pokemonHiveModels.map((e) => e.toEntity()).toList();
 
     return pokemonEntities;
   }
 
   @override
-  Future<Pokemon> getPokemon(String number) async {
+  Future<Pokemon?> getPokemon(String number) async {
     final pokemonModel = await localDataSource.getPokemon(number);
 
+    if (pokemonModel == null) return null;
+
     // get all evolutions
     final evolutions = await localDataSource.getEvolutions(pokemonModel);
 
```

**File**: `lib/data/source/github/models/pokemon.g.dart` (modified, +45/-50)
```diff
@@ -28,15 +28,18 @@ GithubPokemonModel _$GithubPokemonModelFromJson(Map<String, dynamic> json) {
     json['name'] as String,
     json['id'] as String,
     json['imageurl'] as String,
-    json['xdescription'] as String ?? '',
-    json['ydescription'] as String ?? '',
-    json['height'] as String ?? '',
-    json['category'] as String ?? '',
-    json['weight'] as String ?? '',
-    (json['typeofpokemon'] as List)?.map((e) => e as String)?.toList(),
-    (json['weaknesses'] as List)?.map((e) => e as String)?.toList() ?? [],
-    (json['evolutions'] as List)?.map((e) => e as String)?.toList() ?? [],
-    (json['abilities'] as List)?.map((e) => e as String)?.toList() ?? [],
+    json['xdescription'] as String? ?? '',
+    json['ydescription'] as String? ?? '',
+    json['height'] as String? ?? '',
+    json['category'] as String? ?? '',
+    json['weight'] as String? ?? '',
+    (json['typeofpokemon'] as List<dynamic>).map((e) => e as String).toList(),
+    (json['weaknesses'] as List<dynamic>?)?.map((e) => e as String).toList() ??
+        [],
+    (json['evolutions'] as List<dynamic>?)?.map((e) => e as String).toList() ??
+        [],
+    (json['abilities'] as List<dynamic>?)?.map((e) => e as String).toList() ??
+        [],
     json['hp'] as num,
     json['attack'] as num,
     json['defense'] as num,
@@ -47,49 +50,41 @@ GithubPokemonModel _$GithubPokemonModelFromJson(Map<String, dynamic> json) {
     json['male_percentage'] as String,
     json['female_percentage'] as String,
     json['genderless'] as num,
-    json['cycles'] as String ?? '',
+    json['cycles'] as String? ?? '',
     json['egg_groups'] as String,
     json['evolvedfrom'] as String,
-    json['reason'] as String ?? '',
-    json['base_exp'] as String ?? '0',
+    json['reason'] as String? ?? '',
+    json['base_exp'] as String? ?? '0',
   );
 }
 
-Map<String, dynamic> _$GithubPokemonModelToJson(GithubPokemonModel instance) {
-  final val = <String, dynamic>{};
-
-  void writeNotNull(String key, dynamic value) {
-    if (value != null) {
-      val[key] = value;
-    }
-  }
-
-  writeNotNull('name', instance.name);
-  writeNotNull('id', instance.id);
-  writeNotNull('imageurl', instance.imageUrl);
-  val['xdescription'] = instance.xDescription;
-  val['ydescription'] = instance.yDescription;
-  val['height'] = instance.height;
-  val['category'] = instance.category;
-  val['weight'] = instance.weight;
-  writeNotNull('typeofpokemon', instance.types);
-  val['weaknesses'] = instance.weaknesses;
-  val['evolutions'] = instance.evolutions;
-  val['abilities'] = instance.abilities;
-  writeNotNull('hp', instance.hp);
-  writeNotNull('attack', instance.attack);
-  writeNotNull('defense', instance.defense);
-  writeNotNull('special_attack', instance.specialAttack);
-  writeNotNull('special_defense', instance.specialDefense);
-  writeNotNull('speed', instance.speed);
-  writeNotNull('total', instance.total);
-  writeNotNull('male_percentage', instance.genderMalePercentage);
-  writeNotNull('female_percentage', instance.genderFemalePercentage);
-  writeNotNull('genderless', instance.genderless);
-  val['cycles'] = instance.cycles;
-  writeNotNull('egg_groups', instance.eggGroups);
-  val['evolvedfrom'] = instance.evolvedFrom;
-  val['reason'] = instance.reason;
-  val['base_exp'] = instance.baseExp;
-  return val;
-}
+Map<String, dynamic> _$GithubPokemonModelToJson(GithubPokemonModel instance) =>
+    <String, dynamic>{
+      'name': instance.name,
+      'id': instance.id,
+      'imageurl': instance.imageUrl,
+      'xdescription': instance.xDescription,
+      'ydescription': instance.yDescription,
+      'height': instance.height,
+      'category': instance.category,
+      'weight': instance.weight,
+      'typeofpokemon': instance.types,
+      'weaknesses': instance.weaknesses,
+      'evolutions': instance.evolutions,
+      'abilities': instance.abilities,
+      'hp': instance.hp,
+      'attack': instance.attack,
+      'defense': instance.defense,
+      'special_attack': instance.specialAttack,
+      'special_defense': instance.specialDefense,
+      'speed': instance.speed,
+      'total': instance.total,
+      'male_percentage': instance.genderMalePercentage,
+      'female_percentage': instance.genderFemalePercentage,
+      'genderless': instance.genderless,
+      'cycles': instance.cycles,
+      'egg_groups': instance.eggGroups,
+      'evolvedfrom': instance.evolvedFrom,
+      'reason': instance.reason,
+      'base_exp': instance.baseExp,
+    };
```

---

### Incident Patch 8: `544fc7ab` (2022-01-22)
**Commit Message**: refactor: migrate to null safety

**File**: `ios/Podfile.lock` (modified, +8/-8)
```diff
@@ -3,15 +3,15 @@ PODS:
   - FMDB (2.7.5):
     - FMDB/standard (= 2.7.5)
   - FMDB/standard (2.7.5)
-  - path_provider (0.0.1):
+  - path_provider_ios (0.0.1):
     - Flutter
-  - sqflite (0.0.1):
+  - sqflite (0.0.2):
     - Flutter
-    - FMDB (~> 2.7.2)
+    - FMDB (>= 2.7.5)
 
 DEPENDENCIES:
   - Flutter (from `Flutter`)
-  - path_provider (from `.symlinks/plugins/path_provider/ios`)
+  - path_provider_ios (from `.symlinks/plugins/path_provider_ios/ios`)
   - sqflite (from `.symlinks/plugins/sqflite/ios`)
 
 SPEC REPOS:
@@ -21,16 +21,16 @@ SPEC REPOS:
 EXTERNAL SOURCES:
   Flutter:
     :path: Flutter
-  path_provider:
-    :path: ".symlinks/plugins/path_provider/ios"
+  path_provider_ios:
+    :path: ".symlinks/plugins/path_provider_ios/ios"
   sqflite:
     :path: ".symlinks/plugins/sqflite/ios"
 
 SPEC CHECKSUMS:
   Flutter: 50d75fe2f02b26cc09d224853bb45737f8b3214a
   FMDB: 2ce00b547f966261cd18927a3ddb07cb6f3db82a
-  path_provider: abfe2b5c733d04e238b0d8691db0cfd63a27a93c
-  sqflite: 4001a31ff81d210346b500c55b17f4d6c7589dd0
+  path_provider_ios: 7d7ce634493af4477d156294792024ec3485acd5
+  sqflite: 6d358c025f5b867b29ed92fc697fd34924e11904
 
 PODFILE CHECKSUM: aafe91acc616949ddb318b77800a7f51bffa2a4c
 
```

**File**: `lib/configs/types.dart` (modified, +5/-5)
```diff
@@ -3,11 +3,11 @@ import 'package:pokedex/domain/entities/pokemon_types.dart';
 
 class PokeTypes {
   const PokeTypes({
-    @required this.type,
-    @required this.superEffective,
-    @required this.notEffective,
-    @required this.nilEffective,
-    @required this.color,
+    required this.type,
+    required this.superEffective,
+    required this.notEffective,
+    required this.nilEffective,
+    required this.color,
   });
   final PokemonTypes type;
   final List<String> superEffective;
```

**File**: `lib/core/extensions/animation.dart` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import 'package:flutter/animation.dart';
 
 extension AnimationControllerX on AnimationController {
-  Animation<T> curvedTweenAnimation<T>({T begin, T end}) {
+  Animation<T> curvedTweenAnimation<T>({required T begin, required T end}) {
     return Tween<T>(begin: begin, end: end).animate(CurvedAnimation(
       curve: Curves.easeInOut,
       parent: this,
```

**File**: `lib/core/extensions/context.dart` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import 'package:pokedex/configs/constants.dart';
 extension BuildContextX on BuildContext {
   Size get screenSize => MediaQuery.of(this).size;
 
-  double get iconSize => IconTheme.of(this).size;
+  double get iconSize => IconTheme.of(this).size ?? 0;
 
   EdgeInsets get padding => MediaQuery.of(this).padding;
 
```

**File**: `lib/core/fade_page_route.dart` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import 'package:flutter/material.dart';
 
 class FadeRoute extends PageRouteBuilder {
-  FadeRoute({this.page})
+  FadeRoute({required this.page})
       : super(
           pageBuilder: (_, __, ___) => page,
           transitionsBuilder: (_, animation, __, child) => FadeTransition(
```

**File**: `lib/core/network.dart` (modified, +2/-2)
```diff
@@ -22,8 +22,8 @@ class NetworkManager {
     RequestMethod method,
     String url, {
     data,
-    Map<String, dynamic> headers,
-    Map<String, dynamic> queryParameters,
+    Map<String, dynamic>? headers,
+    Map<String, dynamic>? queryParameters,
   }) {
     return dio.request(
       url,
```

**File**: `lib/data/repositories/pokemon_repository.dart` (modified, +9/-13)
```diff
@@ -7,13 +7,13 @@ import 'package:pokedex/domain/entities/pokemon.dart';
 abstract class PokemonRepository {
   Future<List<Pokemon>> getAllPokemons();
 
-  Future<List<Pokemon>> getPokemons({int limit, int page});
+  Future<List<Pokemon>> getPokemons({required int limit, required int page});
 
-  Future<Pokemon> getPokemon(String number);
+  Future<Pokemon?> getPokemon(String number);
 }
 
 class PokemonDefaultRepository extends PokemonRepository {
-  PokemonDefaultRepository({this.githubDataSource, this.localDataSource});
+  PokemonDefaultRepository({required this.githubDataSource, required this.localDataSource});
 
   final GithubDataSource githubDataSource;
   final LocalDataSource localDataSource;
@@ -31,16 +31,13 @@ class PokemonDefaultRepository extends PokemonRepository {
 
     final pokemonHiveModels = await localDataSource.getAllPokemons();
 
-    final pokemonEntities = pokemonHiveModels
-        .where((element) => element != null)
-        .map((e) => e.toEntity())
-        .toList();
+    final pokemonEntities = pokemonHiveModels.map((e) => e.toEntity()).toList();
 
     return pokemonEntities;
   }
 
   @override
-  Future<List<Pokemon>> getPokemons({int limit, int page}) async {
+  Future<List<Pokemon>> getPokemons({required int limit, required int page}) async {
     final hasCachedData = await localDataSource.hasData();
 
     if (!hasCachedData) {
@@ -54,18 +51,17 @@ class PokemonDefaultRepository extends PokemonRepository {
       page: page,
       limit: limit,
     );
-    final pokemonEntities = pokemonHiveModels
-        .where((element) => element != null)
-        .map((e) => e.toEntity())
-        .toList();
+    final pokemonEntities = pokemonHiveModels.map((e) => e.toEntity()).toList();
 
     return pokemonEntities;
   }
 
   @override
-  Future<Pokemon> getPokemon(String number) async {
+  Future<Pokemon?> getPokemon(String number) async {
     final pokemonModel = await localDataSource.getPokemon(number);
 
+    if (pokemonModel == null) return null;
+
     // get all evolutions
     final evolutions = await localDataSource.getEvolutions(pokemonModel);
 
```

**File**: `lib/data/source/github/models/pokemon.g.dart` (modified, +45/-50)
```diff
@@ -28,15 +28,18 @@ GithubPokemonModel _$GithubPokemonModelFromJson(Map<String, dynamic> json) {
     json['name'] as String,
     json['id'] as String,
     json['imageurl'] as String,
-    json['xdescription'] as String ?? '',
-    json['ydescription'] as String ?? '',
-    json['height'] as String ?? '',
-    json['category'] as String ?? '',
-    json['weight'] as String ?? '',
-    (json['typeofpokemon'] as List)?.map((e) => e as String)?.toList(),
-    (json['weaknesses'] as List)?.map((e) => e as String)?.toList() ?? [],
-    (json['evolutions'] as List)?.map((e) => e as String)?.toList() ?? [],
-    (json['abilities'] as List)?.map((e) => e as String)?.toList() ?? [],
+    json['xdescription'] as String? ?? '',
+    json['ydescription'] as String? ?? '',
+    json['height'] as String? ?? '',
+    json['category'] as String? ?? '',
+    json['weight'] as String? ?? '',
+    (json['typeofpokemon'] as List<dynamic>).map((e) => e as String).toList(),
+    (json['weaknesses'] as List<dynamic>?)?.map((e) => e as String).toList() ??
+        [],
+    (json['evolutions'] as List<dynamic>?)?.map((e) => e as String).toList() ??
+        [],
+    (json['abilities'] as List<dynamic>?)?.map((e) => e as String).toList() ??
+        [],
     json['hp'] as num,
     json['attack'] as num,
     json['defense'] as num,
@@ -47,49 +50,41 @@ GithubPokemonModel _$GithubPokemonModelFromJson(Map<String, dynamic> json) {
     json['male_percentage'] as String,
     json['female_percentage'] as String,
     json['genderless'] as num,
-    json['cycles'] as String ?? '',
+    json['cycles'] as String? ?? '',
     json['egg_groups'] as String,
     json['evolvedfrom'] as String,
-    json['reason'] as String ?? '',
-    json['base_exp'] as String ?? '0',
+    json['reason'] as String? ?? '',
+    json['base_exp'] as String? ?? '0',
   );
 }
 
-Map<String, dynamic> _$GithubPokemonModelToJson(GithubPokemonModel instance) {
-  final val = <String, dynamic>{};
-
-  void writeNotNull(String key, dynamic value) {
-    if (value != null) {
-      val[key] = value;
-    }
-  }
-
-  writeNotNull('name', instance.name);
-  writeNotNull('id', instance.id);
-  writeNotNull('imageurl', instance.imageUrl);
-  val['xdescription'] = instance.xDescription;
-  val['ydescription'] = instance.yDescription;
-  val['height'] = instance.height;
-  val['category'] = instance.category;
-  val['weight'] = instance.weight;
-  writeNotNull('typeofpokemon', instance.types);
-  val['weaknesses'] = instance.weaknesses;
-  val['evolutions'] = instance.evolutions;
-  val['abilities'] = instance.abilities;
-  writeNotNull('hp', instance.hp);
-  writeNotNull('attack', instance.attack);
-  writeNotNull('defense', instance.defense);
-  writeNotNull('special_attack', instance.specialAttack);
-  writeNotNull('special_defense', instance.specialDefense);
-  writeNotNull('speed', instance.speed);
-  writeNotNull('total', instance.total);
-  writeNotNull('male_percentage', instance.genderMalePercentage);
-  writeNotNull('female_percentage', instance.genderFemalePercentage);
-  writeNotNull('genderless', instance.genderless);
-  val['cycles'] = instance.cycles;
-  writeNotNull('egg_groups', instance.eggGroups);
-  val['evolvedfrom'] = instance.evolvedFrom;
-  val['reason'] = instance.reason;
-  val['base_exp'] = instance.baseExp;
-  return val;
-}
+Map<String, dynamic> _$GithubPokemonModelToJson(GithubPokemonModel instance) =>
+    <String, dynamic>{
+      'name': instance.name,
+      'id': instance.id,
+      'imageurl': instance.imageUrl,
+      'xdescription': instance.xDescription,
+      'ydescription': instance.yDescription,
+      'height': instance.height,
+      'category': instance.category,
+      'weight': instance.weight,
+      'typeofpokemon': instance.types,
+      'weaknesses': instance.weaknesses,
+      'evolutions': instance.evolutions,
+      'abilities': instance.abilities,
+      'hp': instance.hp,
+      'attack': instance.attack,
+      'defense': instance.defense,
+      'special_attack': instance.specialAttack,
+      'special_defense': instance.specialDefense,
+      'speed': instance.speed,
+      'total': instance.total,
+      'male_percentage': instance.genderMalePercentage,
+      'female_percentage': instance.genderFemalePercentage,
+      'genderless': instance.genderless,
+      'cycles': instance.cycles,
+      'egg_groups': instance.eggGroups,
+      'evolvedfrom': instance.evolvedFrom,
+      'reason': instance.reason,
+      'base_exp': instance.baseExp,
+    };
```

---

### Incident Patch 9: `13895bc9` (2022-01-22)
**Commit Message**: refactor: remove unuse import & fix warnings

**File**: `lib/data/source/local/local_datasource.dart` (modified, +4/-9)
```diff
@@ -1,6 +1,5 @@
 import 'dart:math';
 
-import 'package:hive/hive.dart';
 import 'package:hive_flutter/hive_flutter.dart';
 import 'package:pokedex/data/source/local/models/pokemon.dart';
 import 'package:pokedex/data/source/local/models/pokemon_gender.dart';
@@ -11,8 +10,7 @@ class LocalDataSource {
     await Hive.initFlutter();
 
     Hive.registerAdapter<PokemonHiveModel>(PokemonHiveModelAdapter());
-    Hive.registerAdapter<PokemonGenderHiveModel>(
-        PokemonGenderHiveModelAdapter());
+    Hive.registerAdapter<PokemonGenderHiveModel>(PokemonGenderHiveModelAdapter());
     Hive.registerAdapter<PokemonStatsHiveModel>(PokemonStatsHiveModelAdapter());
 
     await Hive.openBox<PokemonHiveModel>(PokemonHiveModel.boxKey);
@@ -38,8 +36,7 @@ class LocalDataSource {
   Future<List<PokemonHiveModel>> getAllPokemons() async {
     final pokemonBox = Hive.box<PokemonHiveModel>(PokemonHiveModel.boxKey);
 
-    final pokemons = List.generate(
-        pokemonBox.length, (index) => pokemonBox.getAt(index));
+    final pokemons = List.generate(pokemonBox.length, (index) => pokemonBox.getAt(index));
 
     return pokemons;
   }
@@ -51,8 +48,7 @@ class LocalDataSource {
     final start = (page - 1) * limit;
     final newPokemonCount = min(totalPokemons - start, limit);
 
-    final pokemons = List.generate(
-        newPokemonCount, (index) => pokemonBox.getAt(start + index));
+    final pokemons = List.generate(newPokemonCount, (index) => pokemonBox.getAt(start + index));
 
     return pokemons;
   }
@@ -64,8 +60,7 @@ class LocalDataSource {
   }
 
   Future<List<PokemonHiveModel>> getEvolutions(PokemonHiveModel pokemon) async {
-    final pokemonFutures =
-        pokemon.evolutions.map((pokemonNumber) => getPokemon(pokemonNumber));
+    final pokemonFutures = pokemon.evolutions.map((pokemonNumber) => getPokemon(pokemonNumber));
 
     final pokemons = await Future.wait(pokemonFutures);
 
```

**File**: `lib/domain/entities/pokemon.dart` (modified, +0/-2)
```diff
@@ -1,5 +1,3 @@
-import 'dart:ui';
-
 import 'package:flutter/material.dart';
 
 import '../../configs/colors.dart';
```

**File**: `lib/ui/screens/pokedex/pokedex.dart` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-import 'package:flutter/cupertino.dart';
 import 'package:flutter/material.dart';
 import 'package:pokedex/configs/durations.dart';
 import 'package:pokedex/core/extensions/animation.dart';
```

**File**: `lib/ui/screens/pokedex/widgets/generation_card.dart` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 import 'package:flutter/material.dart';
-import 'package:flutter/widgets.dart';
 import 'package:pokedex/configs/colors.dart';
 import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/domain/entities/generation.dart';
```

**File**: `lib/ui/screens/pokemon_info/widgets/tab_about.dart` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 import 'package:flutter/material.dart';
-import 'package:flutter/widgets.dart';
 import 'package:pokedex/configs/colors.dart';
 import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/domain/entities/pokemon.dart';
```

**File**: `lib/ui/screens/types/modal_contents.dart` (modified, +13/-20)
```diff
@@ -2,7 +2,6 @@ import 'dart:async';
 
 import 'package:flutter/material.dart';
 import 'package:flutter_riverpod/flutter_riverpod.dart';
-import 'package:flutter_riverpod/src/provider.dart';
 import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/configs/types.dart';
 import 'package:pokedex/core/utils.dart';
@@ -51,9 +50,8 @@ class _ModalContentsState extends State<ModalContents> {
   PokeTypes get pokeType => types[widget.index];
 
   ExpansionPanel _buildTypePokemonPanel(List<Pokemon> pokemons) {
-    final filteredPokemons = pokemons
-        .where((pokemon) => pokemon.types.contains(pokeType.type))
-        .toList();
+    final filteredPokemons =
+        pokemons.where((pokemon) => pokemon.types.contains(pokeType.type)).toList();
 
     return ExpansionPanel(
       headerBuilder: (context, isOpen) {
@@ -71,8 +69,8 @@ class _ModalContentsState extends State<ModalContents> {
             Padding(
               padding: const EdgeInsets.only(left: 8.0),
               child: Text(
-                  "${getEnumValue(pokeType.type)[0].toUpperCase() + getEnumValue(pokeType.type).substring(1)} Type " +
-                      "Pokemons"),
+                  "${getEnumValue(pokeType.type)[0].toUpperCase() + getEnumValue(pokeType.type).substring(1)} Type "
+                  "Pokemons"),
             )
           ],
         );
@@ -92,15 +90,14 @@ class _ModalContentsState extends State<ModalContents> {
                   return PokemonCard(
                     pokemon,
                     index: pokemons.indexOf(pokemon),
-                    onPress: () =>
-                        _onPokemonPress(pokemons.indexOf(pokemon), pokemon),
+                    onPress: () => _onPokemonPress(pokemons.indexOf(pokemon), pokemon),
                   );
                 }).toList(),
               )
             : Padding(
                 padding: const EdgeInsets.only(bottom: 10.0),
-                child: Text("No Pokemon found",
-                    style: TextStyle(fontSize: 16, color: Colors.black54)),
+                child:
+                    Text("No Pokemon found", style: TextStyle(fontSize: 16, color: Colors.black54)),
               ),
       ),
       isExpanded: _isOpen[0],
@@ -124,8 +121,8 @@ class _ModalContentsState extends State<ModalContents> {
             Padding(
               padding: const EdgeInsets.only(left: 8.0),
               child: Text(
-                  "${getEnumValue(pokeType.type)[0].toUpperCase() + getEnumValue(pokeType.type).substring(1)} Type " +
-                      "Items"),
+                  "${getEnumValue(pokeType.type)[0].toUpperCase() + getEnumValue(pokeType.type).substring(1)} Type "
+                  "Items"),
             )
           ],
         );
@@ -186,25 +183,21 @@ class _ModalContentsState extends State<ModalContents> {
         if (pokeType.superEffective.isNotEmpty)
           Column(
             crossAxisAlignment: CrossAxisAlignment.center,
-            children: lister(widget.index, 2, widget.width,
-                "Effective Against".toUpperCase()),
+            children: lister(widget.index, 2, widget.width, "Effective Against".toUpperCase()),
           ),
         Column(
           crossAxisAlignment: CrossAxisAlignment.center,
-          children: lister(
-              widget.index, 0.5, widget.width, "Weak Against".toUpperCase()),
+          children: lister(widget.index, 0.5, widget.width, "Weak Against".toUpperCase()),
         ),
         Column(
           crossAxisAlignment: CrossAxisAlignment.center,
-          children: lister(
-              widget.index, 1, widget.width, "Normal Against".toUpperCase()),
+          children: lister(widget.index, 1, widget.width, "Normal Against".toUpperCase()),
         ),
         if (pokeType.nilEffective.isNotEmpty)
           Column(
             mainAxisAlignment: MainAxisAlignment.start,
             crossAxisAlignment: CrossAxisAlignment.center,
-            children: lister(widget.index, 0, widget.width,
-                "No Effect Against".toUpperCase()),
+            children: lister(widget.index, 0, widget.width, "No Effect Against".toUpperCase()),
           ),
         Consumer(builder: (_, watch, __) {
           final pokemonState = watch(pokemonsStateProvider);
```

**File**: `lib/ui/widgets/poke_category_card.dart` (modified, +0/-1)
```diff
@@ -1,4 +1,3 @@
-import 'package:flutter/cupertino.dart';
 import 'package:flutter/material.dart';
 import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/domain/entities/category.dart';
```

**File**: `lib/ui/widgets/pokemon_refresh_control.dart` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 import 'package:flutter/cupertino.dart';
-import 'package:flutter/material.dart';
 import 'package:pokedex/configs/images.dart';
 
 class PokemonRefreshControl extends StatelessWidget {
```

---

### Incident Patch 10: `ece7723a` (2022-01-22)
**Commit Message**: refactor: update dependencies to support null-safety

**File**: `lib/ui/screens/pokedex/widgets/pokemon_card.dart` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 import 'package:cached_network_image/cached_network_image.dart';
+import 'package:cached_network_image_platform_interface/cached_network_image_platform_interface.dart';
 import 'package:flutter/material.dart';
 import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/domain/entities/pokemon.dart';
```

**File**: `lib/ui/screens/pokemon_info/widgets/pokemon_basic_info.dart` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 import 'package:cached_network_image/cached_network_image.dart';
+import 'package:cached_network_image_platform_interface/cached_network_image_platform_interface.dart';
 import 'package:flutter/material.dart' hide AnimatedSlide;
 import 'package:flutter_riverpod/flutter_riverpod.dart';
 import 'package:pokedex/configs/durations.dart';
```

**File**: `lib/ui/screens/pokemon_info/widgets/tab_evolution.dart` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 import 'package:cached_network_image/cached_network_image.dart';
+import 'package:cached_network_image_platform_interface/cached_network_image_platform_interface.dart';
 import 'package:flutter/material.dart';
 import 'package:pokedex/configs/colors.dart';
 import 'package:pokedex/configs/images.dart';
```

**File**: `lib/ui/screens/types/modal_contents.dart` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import 'dart:async';
 
 import 'package:flutter/material.dart';
-import 'package:flutter_riverpod/all.dart';
+import 'package:flutter_riverpod/flutter_riverpod.dart';
 import 'package:flutter_riverpod/src/provider.dart';
 import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/configs/types.dart';
```

**File**: `pubspec.lock` (modified, +137/-102)
```diff
@@ -7,21 +7,21 @@ packages:
       name: _fe_analyzer_shared
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "12.0.0"
+    version: "22.0.0"
   analyzer:
     dependency: transitive
     description:
       name: analyzer
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "0.40.6"
+    version: "1.7.2"
   args:
     dependency: transitive
     description:
       name: args
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "1.6.0"
+    version: "2.3.0"
   async:
     dependency: transitive
     description:
@@ -42,63 +42,77 @@ packages:
       name: build
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "1.5.1"
+    version: "2.2.1"
   build_config:
     dependency: transitive
     description:
       name: build_config
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "0.4.2"
+    version: "1.0.0"
   build_daemon:
     dependency: transitive
     description:
       name: build_daemon
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "2.1.4"
+    version: "3.0.1"
   build_resolvers:
     dependency: transitive
     description:
       name: build_resolvers
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "1.4.3"
+    version: "2.0.4"
   build_runner:
     dependency: "direct dev"
     description:
       name: build_runner
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "1.10.6"
+    version: "2.1.7"
   build_runner_core:
     dependency: transitive
     description:
       name: build_runner_core
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "6.0.3"
+    version: "7.2.2"
   built_collection:
     dependency: transitive
     description:
       name: built_collection
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "4.3.2"
+    version: "5.1.1"
   built_value:
     dependency: transitive
     description:
       name: built_value
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "7.1.0"
+    version: "8.1.4"
   cached_network_image:
     dependency: "direct main"
     description:
       name: cached_network_image
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "2.3.3"
+    version: "3.2.0"
+  cached_network_image_platform_interface:
+    dependency: transitive
+    description:
+      name: cached_network_image_platform_interface
+      url: "https://pub.dartlang.org"
+    source: hosted
+    version: "1.0.0"
+  cached_network_image_web:
+    dependency: transitive
+    description:
+      name: cached_network_image_web
+      url: "https://pub.dartlang.org"
+    source: hosted
+    version: "1.0.1"
   characters:
     dependency: transitive
     description:
@@ -119,14 +133,14 @@ packages:
       name: checked_yaml
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "1.0.2"
+    version: "2.0.1"
   cli_util:
     dependency: transitive
     description:
       name: cli_util
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "0.2.0"
+    version: "0.3.5"
   clock:
     dependency: transitive
     description:
@@ -140,7 +154,7 @@ packages:
       name: code_builder
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "3.4.0"
+    version: "4.1.0"
   collection:
     dependency: transitive
     description:
@@ -154,63 +168,63 @@ packages:
       name: convert
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "2.1.1"
+    version: "3.0.1"
   crypto:
     dependency: transitive
     description:
       name: crypto
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "2.1.4"
+    version: "3.0.1"
   dart_style:
     dependency: transitive
     description:
       name: dart_style
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "1.3.10"
-  dartx:
-    dependency: transitive
-    description:
-      name: dartx
-      url: "https://pub.dartlang.org"
-    source: hosted
-    version: "0.5.0"
+    version: "2.1.1"
   dio:
     dependency: "direct main"
     description:
       name: dio
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "3.0.10"
+    version: "4.0.4"
   dio_http_cache:
     dependency: "direct main"
     description:
       name: dio_http_cache
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "0.2.11"
+    version: "0.3.0"
   fake_async:
     dependency: transitive
     description:
       name: fake_async
       url: "https://pub.dartlang.org"
     source: hosted
     version: "1.2.0"
+  ffi:
+    dependency: transitive
+    description:
+      name: ffi
+      url: "https://pub.dartlang.org"
+    source: hosted
+    version: "1.1.2"
   file:
     dependency: transitive
     description:
       name: file
       url: "https://pub.dartlang.org"
     source: hosted
-    version: "5.2.1"
+    version: "6.1.2"
   fixnum:
     dependency: tran
```

**File**: `pubspec.yaml` (modified, +13/-13)
```diff
@@ -19,23 +19,23 @@ environment:
 dependencies:
   flutter:
     sdk: flutter
-  cached_network_image: ^2.3.3
-  sliding_up_panel: ^1.0.2
-  hive: ^1.4.4
-  hive_flutter: ^0.3.1
-  dio: ^3.0.10
-  dio_http_cache: ^0.2.11
-  json_annotation: ^3.1.1
-  flutter_riverpod: ^0.12.1
-  intl: ^0.16.1
+  cached_network_image: ^3.2.0
+  sliding_up_panel: ^2.0.0+1
+  hive: ^2.0.5
+  hive_flutter: ^1.1.0
+  dio: ^4.0.4
+  dio_http_cache: ^0.3.0
+  json_annotation: ^4.1.0
+  flutter_riverpod: ^0.13.0
+  intl: ^0.17.0
 
 dev_dependencies:
   flutter_test:
     sdk: flutter
-  build_runner: ^1.10.6
-  json_serializable: ^3.5.0
-  hive_generator: ^0.8.2
-  pedantic: ^1.9.2
+  build_runner: ^2.1.7
+  json_serializable: ^4.1.4
+  hive_generator: ^1.1.2
+  pedantic: ^1.11.1
 
 # For information on the generic Dart part of this file, see the
 # following page: https://dart.dev/tools/pub/pubspec
```

---

### Incident Patch 11: `dcaa5f8e` (2022-01-20)
**Commit Message**: Merge pull request #52 from hungps/fix/invalid-source-url

update the pokemon source url to a new one

**File**: `lib/data/source/github/github_datasource.dart` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ import 'package:pokedex/data/source/github/models/pokemon.dart';
 
 class GithubDataSource {
   static const String url =
-      'https://gist.githubusercontent.com/scitbiz/0bfdd96d3ab9ee20c2e572e47c6834c7/raw/pokemons.json';
+      'https://gist.githubusercontent.com/hungps/0bfdd96d3ab9ee20c2e572e47c6834c7/raw/pokemons.json';
 
   GithubDataSource(this.networkManager);
 
```

---

### Incident Patch 12: `bff90cc1` (2021-10-24)
**Commit Message**: fix #44

**File**: `lib/ui/screens/home/widgets/pokemon_news.dart` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ class _PokemonNews extends StatelessWidget {
   @override
   Widget build(BuildContext context) {
     return ListView(
-      physics: BouncingScrollPhysics(),
+      physics: ClampingScrollPhysics(),
       children: <Widget>[
         _buildHeader(context),
         ListView.separated(
```

**File**: `lib/ui/screens/pokemon_info/widgets/pokemon_basic_info.dart` (modified, +1/-2)
```diff
@@ -1,6 +1,5 @@
 import 'package:cached_network_image/cached_network_image.dart';
-import 'package:flutter/cupertino.dart';
-import 'package:flutter/material.dart';
+import 'package:flutter/material.dart' hide AnimatedSlide;
 import 'package:flutter_riverpod/flutter_riverpod.dart';
 import 'package:pokedex/configs/durations.dart';
 import 'package:pokedex/configs/images.dart';
```

---

### Incident Patch 13: `32a6ba14` (2021-06-05)
**Commit Message**: replace the fixed appbar with the sliver appbar

**File**: `lib/domain/entities/pokemon.dart` (modified, +0/-1)
```diff
@@ -1,7 +1,6 @@
 import 'dart:ui';
 
 import 'package:flutter/material.dart';
-import 'package:pokedex/domain/entities/type_color.dart';
 
 import '../../configs/colors.dart';
 import 'pokemon_props.dart';
```

**File**: `lib/ui/screens/home/home.dart` (modified, +1/-3)
```diff
@@ -1,14 +1,12 @@
-import 'dart:math';
-
 import 'package:flutter/material.dart';
 import 'package:pokedex/configs/colors.dart';
 import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/core/extensions/context.dart';
 import 'package:pokedex/data/categories.dart';
 import 'package:pokedex/routes.dart';
 import 'package:pokedex/ui/widgets/poke_category_card.dart';
-import 'package:pokedex/ui/widgets/poke_container.dart';
 import 'package:pokedex/ui/widgets/poke_news.dart';
+import 'package:pokedex/ui/widgets/pokeball_background.dart';
 import 'package:pokedex/ui/widgets/search_bar.dart';
 import 'package:pokedex/ui/widgets/spacer.dart';
 
```

**File**: `lib/ui/screens/home/widgets/header_app_bar.dart` (modified, +20/-22)
```diff
@@ -71,30 +71,28 @@ class _HeaderAppBar extends StatelessWidget {
         ),
       ),
       child: PokeballBackground(
-        buildChildren: (_) => [
-          Column(
-            mainAxisSize: MainAxisSize.max,
-            mainAxisAlignment: MainAxisAlignment.start,
-            crossAxisAlignment: CrossAxisAlignment.stretch,
-            children: <Widget>[
-              VSpacer(context.responsive(60) + context.padding.top),
-              Padding(
-                padding: EdgeInsets.symmetric(horizontal: 28),
-                child: Text(
-                  'What Pokemon\nare you looking for?',
-                  style: TextStyle(
-                    fontSize: 30,
-                    height: 1.4 * context.responsive(30) / 30,
-                    fontWeight: FontWeight.w900,
-                  ),
+        child: Column(
+          mainAxisSize: MainAxisSize.max,
+          mainAxisAlignment: MainAxisAlignment.start,
+          crossAxisAlignment: CrossAxisAlignment.stretch,
+          children: <Widget>[
+            VSpacer(context.responsive(60) + context.padding.top),
+            Padding(
+              padding: EdgeInsets.symmetric(horizontal: 28),
+              child: Text(
+                'What Pokemon\nare you looking for?',
+                style: TextStyle(
+                  fontSize: 30,
+                  height: 1.4 * context.responsive(30) / 30,
+                  fontWeight: FontWeight.w900,
                 ),
               ),
-              VSpacer(context.responsive(28)),
-              SearchBar(),
-              _buildCategories(context),
-            ],
-          ),
-        ],
+            ),
+            VSpacer(context.responsive(28)),
+            SearchBar(),
+            _buildCategories(context),
+          ],
+        ),
       ),
     );
   }
```

**File**: `lib/ui/screens/pokedex/pokedex.dart` (modified, +11/-99)
```diff
@@ -1,26 +1,15 @@
-import 'dart:async';
-import 'dart:math' show max;
-
 import 'package:flutter/cupertino.dart';
 import 'package:flutter/material.dart';
-import 'package:flutter_riverpod/flutter_riverpod.dart';
 import 'package:pokedex/configs/durations.dart';
-import 'package:pokedex/configs/images.dart';
 import 'package:pokedex/core/extensions/animation.dart';
-import 'package:pokedex/core/extensions/context.dart';
-import 'package:pokedex/domain/entities/pokemon.dart';
-import 'package:pokedex/providers/providers.dart';
-import 'package:pokedex/routes.dart';
 import 'package:pokedex/ui/modals/generation_modal.dart';
 import 'package:pokedex/ui/modals/search_modal.dart';
-import 'package:pokedex/ui/screens/pokedex/widgets/pokemon_card.dart';
+import 'package:pokedex/ui/screens/pokedex/widgets/pokemon_grid.dart';
 import 'package:pokedex/ui/widgets/fab.dart';
-import 'package:pokedex/ui/widgets/poke_container.dart';
+import 'package:pokedex/ui/widgets/pokeball_background.dart';
 
 part 'package:pokedex/ui/screens/pokedex/widgets/fab_menu.dart';
 part 'package:pokedex/ui/screens/pokedex/widgets/fab_overlay_background.dart';
-part 'package:pokedex/ui/screens/pokedex/widgets/header_app_bar.dart';
-part 'package:pokedex/ui/screens/pokedex/widgets/pokemon_grid.dart';
 
 class PokedexScreen extends StatefulWidget {
   const PokedexScreen();
@@ -30,10 +19,6 @@ class PokedexScreen extends StatefulWidget {
 }
 
 class _PokedexScreenState extends State<PokedexScreen> with SingleTickerProviderStateMixin {
-  static const double _endReachedThreshold = 200;
-
-  final ScrollController _scrollController = ScrollController();
-
   Animation<double> _fabAnimation;
   AnimationController _fabController;
   bool _isFabMenuVisible = false;
@@ -50,19 +35,12 @@ class _PokedexScreenState extends State<PokedexScreen> with SingleTickerProvider
       end: 1.0,
     );
 
-    _scrollController.addListener(_onScroll);
-
-    scheduleMicrotask(() {
-      context.read(pokemonsStateProvider).getPokemons(reset: true);
-    });
-
     super.initState();
   }
 
   @override
   void dispose() {
     _fabController?.dispose();
-    _scrollController?.dispose();
 
     super.dispose();
   }
@@ -77,23 +55,6 @@ class _PokedexScreenState extends State<PokedexScreen> with SingleTickerProvider
     }
   }
 
-  void _onScroll() {
-    if (!_scrollController.hasClients) return;
-
-    final thresholdReached = _scrollController.position.extentAfter < _endReachedThreshold;
-    final isLoading = context.read(pokemonsStateProvider).loading;
-    final canLoadMore = context.read(pokemonsStateProvider).canLoadMore;
-
-    if (thresholdReached && !isLoading && canLoadMore) {
-      // Load more!
-      context.read(pokemonsStateProvider).getPokemons();
-    }
-  }
-
-  Future _onRefresh() async {
-    context.read(pokemonsStateProvider).getPokemons(reset: true);
-  }
-
   void _showSearchModal() {
     showModalBottomSheet(
       context: context,
@@ -110,66 +71,17 @@ class _PokedexScreenState extends State<PokedexScreen> with SingleTickerProvider
     );
   }
 
-  Widget _buildTitle() {
-    return Padding(
-      padding: EdgeInsets.only(
-        left: 26,
-        right: 26,
-        top: context.responsive(18),
-        bottom: context.responsive(4),
-      ),
-      child: Text(
-        'Pokedex',
-        style: TextStyle(
-          fontSize: 30,
-          fontWeight: FontWeight.bold,
-        ),
-      ),
-    );
-  }
-
-  Widget _buildPokemonGrid() {
-    return Expanded(
-      child: Consumer(builder: (_, watch, __) {
-        final pokemonState = watch(pokemonsStateProvider);
-
-        return _PokemonGrid(
-          pokemons: pokemonState.pokemons,
-          canLoadMore: pokemonState.canLoadMore,
-          controller: _scrollController,
-          onRefresh: _onRefresh,
-          onSelectPokemon: (index, pokemon) {
-            context.read(currentPokemonStateProvider).setPokemon(index, pokemon);
-            AppNavigator.push(Routes.pokemonInfo, pokemon);
-          },
-        );
-      }),
-    );
-  }
-
   @override
   Widget build(BuildContext context) {
-    return Scaffold(
-      body: PokeballBackground(
-        buildChildren: (props) {
-          final appBarTop = props.size / 2 + props.top - IconTheme.of(context).size / 2;
-
-          return [
-            Column(
-              mainAxisSize: MainAxisSize.max,
-              crossAxisAlignment: CrossAxisAlignment.stretch,
-              children: <Widget>[
-                _HeaderAppBar(top: appBarTop),
-                _buildTitle(),
-                _buildPokemonGrid(),
-              ],
-            ),
-            _FabOverlayBackground(
-              animation: _fabAnimation,
-              onPressOut: _toggleFabMenu,
-            ),
-          ];
-        },
+    return PokeballBackground(
+      child: Stack(
+        children: [
+          PokemonGrid(),
+          _FabOverlayBackground(
+            animation: _fabAnimation,
+            onPressOut: _toggle
```

**File**: `lib/ui/screens/pokedex/widgets/header_app_bar.dart` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
-part of '../pokedex.dart';
-
-class _HeaderAppBar extends StatelessWidget {
-  const _HeaderAppBar({
-    this.top = 0.0,
-    this.appBarKey,
-  });
-
-  final double top;
-  final GlobalKey appBarKey;
-
-  @override
-  Widget build(BuildContext context) {
-    return Padding(
-      padding: EdgeInsets.only(top: top, bottom: context.responsive(16)),
-      child: Stack(
-        alignment: Alignment.center,
-        children: <Widget>[
-          Positioned(
-            left: 0,
-            child: IconButton(
-              padding: EdgeInsets.symmetric(
-                horizontal: 24,
-                vertical: context.responsive(24),
-              ),
-              icon: Icon(Icons.arrow_back),
-              onPressed: AppNavigator.pop,
-            ),
-          ),
-          Text(
-            'Pokedex',
-            key: appBarKey,
-            style: TextStyle(
-              color: Colors.transparent,
-              fontWeight: FontWeight.bold,
-              fontSize: 20,
-            ),
-          ),
-          Positioned(
-            right: 0,
-            child: IconButton(
-              padding: EdgeInsets.symmetric(
-                horizontal: 24,
-                vertical: context.responsive(24),
-              ),
-              icon: Icon(Icons.menu),
-              onPressed: AppNavigator.pop,
-            ),
-          ),
-        ],
-      ),
-    );
-  }
-}
```

**File**: `lib/ui/screens/pokedex/widgets/pokemon_grid.dart` (modified, +113/-60)
```diff
@@ -1,68 +1,121 @@
-part of '../pokedex.dart';
-
-class _PokemonGrid extends StatelessWidget {
-  _PokemonGrid({
-    @required this.pokemons,
-    @required this.canLoadMore,
-    @required this.controller,
-    @required this.onRefresh,
-    @required this.onSelectPokemon,
-  });
-
-  final ScrollController controller;
-  final List<Pokemon> pokemons;
-  final bool canLoadMore;
-  final Future Function() onRefresh;
-  final Function(int, Pokemon) onSelectPokemon;
+import 'dart:async';
 
+import 'package:flutter/material.dart';
+import 'package:flutter_riverpod/flutter_riverpod.dart';
+import 'package:pokedex/configs/images.dart';
+import 'package:pokedex/domain/entities/pokemon.dart';
+import 'package:pokedex/providers/providers.dart';
+import 'package:pokedex/ui/screens/pokedex/widgets/pokemon_card.dart';
+import 'package:pokedex/ui/widgets/main_app_bar.dart';
+import 'package:pokedex/ui/widgets/pokemon_refresh_control.dart';
+import 'package:pokedex/routes.dart';
+
+class PokemonGrid extends StatefulWidget {
   @override
-  Widget build(BuildContext context) {
-    final paddingBottom = context.responsive(max(context.padding.bottom, 28));
-
-    return CustomScrollView(
-      controller: controller,
-      physics: BouncingScrollPhysics(),
-      slivers: [
-        CupertinoSliverRefreshControl(
-          onRefresh: onRefresh,
-          builder: (_, __, ___, ____, _____) => Image(
-            image: AppImages.pikloader,
-          ),
+  _PokemonGridState createState() => _PokemonGridState();
+}
+
+class _PokemonGridState extends State<PokemonGrid> {
+  static const double _endReachedThreshold = 200;
+
+  final GlobalKey<NestedScrollViewState> _scrollKey = GlobalKey();
+
+  ScrollController get innerController => _scrollKey.currentState?.innerController;
+
+  @override
+  void initState() {
+    super.initState();
+
+    scheduleMicrotask(() {
+      context.read(pokemonsStateProvider).getPokemons(reset: true);
+      innerController?.addListener(_onScroll);
+    });
+  }
+
+  @override
+  void dispose() {
+    innerController?.dispose();
+
+    super.dispose();
+  }
+
+  void _onScroll() {
+    if (innerController != null && !innerController.hasClients) return;
+
+    final thresholdReached = innerController.position.extentAfter < _endReachedThreshold;
+    final isLoading = context.read(pokemonsStateProvider).loading;
+    final canLoadMore = context.read(pokemonsStateProvider).canLoadMore;
+
+    if (thresholdReached && !isLoading && canLoadMore) {
+      // Load more!
+      context.read(pokemonsStateProvider).getPokemons();
+    }
+  }
+
+  Future _onRefresh() async {
+    context.read(pokemonsStateProvider).getPokemons(reset: true);
+  }
+
+  void _onPokemonPress(int index, Pokemon pokemon) {
+    context.read(currentPokemonStateProvider).setPokemon(index, pokemon);
+
+    AppNavigator.push(Routes.pokemonInfo, pokemon);
+  }
+
+  List<Widget> _buildHeader(BuildContext context, bool innerBoxIsScrolled) {
+    return [
+      MainSliverAppBar(),
+    ];
+  }
+
+  Widget _buildGrid({List<Pokemon> pokemons = const []}) {
+    return SliverPadding(
+      padding: EdgeInsets.all(28),
+      sliver: SliverGrid(
+        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
+          crossAxisCount: 2,
+          childAspectRatio: 1.4,
+          crossAxisSpacing: 10,
+          mainAxisSpacing: 10,
         ),
-        SliverPadding(
-          padding: EdgeInsets.symmetric(
-            horizontal: 28,
-            vertical: context.responsive(28),
+        delegate: SliverChildBuilderDelegate(
+          (context, index) => PokemonCard(
+            pokemons[index],
+            index: index,
+            onPress: () => _onPokemonPress(index, pokemons[index]),
           ),
-          sliver: SliverGrid(
-            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
-              crossAxisCount: 2,
-              childAspectRatio: 1.4,
-              crossAxisSpacing: context.responsive(10),
-              mainAxisSpacing: context.responsive(10),
-            ),
-            delegate: SliverChildBuilderDelegate(
-              (context, index) => PokemonCard(
-                pokemons[index],
-                index: index,
-                onPress: () => onSelectPokemon(index, pokemons[index]),
-              ),
-              childCount: pokemons?.length ?? 0,
-            ),
-          ),
-        ),
-        SliverToBoxAdapter(
-          child: canLoadMore
-              ? Container(
-                  padding: EdgeInsets.only(bottom: paddingBottom),
-                  alignment: Alignment.center,
-                  child: Image(
-                    image: AppImages.pikloader,
-                  ),
-                )
-              : SizedBox(),
+          childCount: pokemons.length,
         ),
-      ],
+      ),
+    );
+  }
+
+  Widget _buildLoadMoreIndicator() {
+    return SliverToBoxAdapter(
+      child: Container(
+        padding: EdgeInsets.only(bottom: 28),
+        a
```

**File**: `lib/ui/screens/pokemon_info/pokemon_info.dart` (modified, +2/-5)
```diff
@@ -9,7 +9,6 @@ import 'package:pokedex/ui/screens/pokemon_info/widgets/decoration_box.dart';
 import 'package:pokedex/ui/screens/pokemon_info/widgets/pokemon_basic_info.dart';
 import 'package:pokedex/ui/screens/pokemon_info/widgets/tab.dart';
 import 'package:pokedex/ui/widgets/animated_fade.dart';
-import 'package:pokedex/ui/widgets/poke_app_bar.dart';
 import 'package:sliding_up_panel/sliding_up_panel.dart';
 
 class PokemonInfo extends StatefulWidget {
@@ -61,12 +60,11 @@ class _PokemonInfoState extends State<PokemonInfo> with TickerProviderStateMixin
 
     WidgetsBinding.instance.addPostFrameCallback((_) {
       final screenHeight = context.screenSize.height;
-      final appBarHeight = PokeAppBar().preferredSize.height;
 
       final pokemonInfoBox = _pokemonInfoKey.currentContext.findRenderObject() as RenderBox;
 
       _cardMinHeight = screenHeight - pokemonInfoBox.size.height;
-      _cardMaxHeight = screenHeight - appBarHeight - context.padding.top;
+      _cardMaxHeight = screenHeight - kToolbarHeight - context.padding.top;
 
       _cardHeightController.forward();
     });
@@ -115,12 +113,11 @@ class _PokemonInfoState extends State<PokemonInfo> with TickerProviderStateMixin
   }
 
   Widget _buildAppBarPokeballDecoration() {
-    final appBarHeight = PokeAppBar().preferredSize.height;
     final screenSize = context.screenSize;
     final iconSize = context.iconSize;
 
     final pokeSize = screenSize.width * 0.448;
-    final pokeTop = -(pokeSize / 2 - (iconSize / 2 + appBarHeight));
+    final pokeTop = -(pokeSize / 2 - (iconSize / 2 + kToolbarHeight));
     final pokeRight = -(pokeSize / 2 - (iconSize / 2 + 28));
 
     return Positioned(
```

**File**: `lib/ui/screens/pokemon_info/widgets/pokemon_basic_info.dart` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@ import 'package:pokedex/domain/entities/pokemon.dart';
 import 'package:pokedex/providers/providers.dart';
 import 'package:pokedex/ui/widgets/animated_fade.dart';
 import 'package:pokedex/ui/widgets/animated_slide.dart';
-import 'package:pokedex/ui/widgets/poke_app_bar.dart';
+import 'package:pokedex/ui/widgets/main_app_bar.dart';
 import 'package:pokedex/ui/widgets/pokemon_type.dart';
 import 'package:pokedex/ui/widgets/spacer.dart';
 
@@ -92,7 +92,7 @@ class _PokemonOverallInfoState extends State<PokemonOverallInfo> with TickerProv
   }
 
   AppBar _buildAppBar() {
-    return PokeAppBar(
+    return MainAppBar(
       // A placeholder for easily calculate the translate of the pokemon name
       title: Consumer(builder: (_, watch, __) {
         _calculatePokemonNamePosition();
```

---

### Incident Patch 14: `30aff53d` (2020-11-30)
**Commit Message**: Merge pull request #33 from scitbiz/fix-responsive

fix overflow on home screen & update android codebase

**File**: `android/.gitignore` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+gradle-wrapper.jar
+/.gradle
+/captures/
+/gradlew
+/gradlew.bat
+/local.properties
+GeneratedPluginRegistrant.java
+
+# Remember to never publicly share your keystore.
+# See https://flutter.dev/docs/deployment/android#reference-the-keystore-from-the-app
+key.properties
```

**File**: `android/app/build.gradle` (modified, +5/-5)
```diff
@@ -26,7 +26,7 @@ apply plugin: 'kotlin-android'
 apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"
 
 android {
-    compileSdkVersion 28
+    compileSdkVersion 30
 
     sourceSets {
         main.java.srcDirs += 'src/main/kotlin'
@@ -38,9 +38,9 @@ android {
 
     defaultConfig {
         // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
-        applicationId "com.example.pokedex"
+        applicationId "com.hungps.flutterpokedex"
         minSdkVersion 16
-        targetSdkVersion 28
+        targetSdkVersion 30
         versionCode flutterVersionCode.toInteger()
         versionName flutterVersionName
         testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
@@ -67,6 +67,6 @@ flutter {
 dependencies {
     implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlin_version"
     testImplementation 'junit:junit:4.12'
-    androidTestImplementation 'androidx.test:runner:1.1.1'
-    androidTestImplementation 'androidx.test.espresso:espresso-core:3.1.1'
+    androidTestImplementation 'androidx.test:runner:1.3.0'
+    androidTestImplementation 'androidx.test.espresso:espresso-core:3.3.0'
 }
```

**File**: `android/app/src/debug/AndroidManifest.xml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 <manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.pokedex">
+    package="com.hungps.flutterpokedex">
     <!-- Flutter needs it to communicate with the running application
          to allow setting breakpoints, to provide hot reload, etc.
     -->
```

**File**: `android/app/src/main/AndroidManifest.xml` (modified, +31/-12)
```diff
@@ -1,34 +1,53 @@
 <manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.pokedex">
-
+    xmlns:tools="http://schemas.android.com/tools"
+    package="com.hungps.flutterpokedex">
     <!-- io.flutter.app.FlutterApplication is an android.app.Application that
          calls FlutterMain.startInitialization(this); in its onCreate method.
          In most cases you can leave this as-is, but you if you want to provide
          additional functionality it is fine to subclass or reimplement
          FlutterApplication and put your custom class here. -->
+
     <uses-permission android:name="android.permission.INTERNET"/>
+
     <application
-        android:name="io.flutter.app.FlutterApplication"
-        android:label="pokedex"
-        android:icon="@mipmap/ic_launcher">
+        android:label="Pokedex"
+        android:icon="@mipmap/ic_launcher"
+        android:hardwareAccelerated="true">
         <activity
             android:name=".MainActivity"
             android:launchMode="singleTop"
             android:theme="@style/LaunchTheme"
-            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
+            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
             android:hardwareAccelerated="true"
             android:windowSoftInputMode="adjustResize">
-            <!-- This keeps the window background of the activity showing
-                 until Flutter renders its first frame. It can be removed if
-                 there is no splash screen (such as the default splash screen
-                 defined in @style/LaunchTheme). -->
+
+            <!-- Specifies an Android theme to apply to this Activity as soon as
+                 the Android process has started. This theme is visible to the user
+                 while the Flutter UI initializes. After that, this theme continues
+                 to determine the Window background behind the Flutter UI. -->
             <meta-data
-                android:name="io.flutter.app.android.SplashScreenUntilFirstFrame"
-                android:value="true" />
+              android:name="io.flutter.embedding.android.NormalTheme"
+              android:resource="@style/NormalTheme" />
+
+            <!-- Displays an Android View that continues showing the launch screen
+                 Drawable until Flutter paints its first frame, then this splash
+                 screen fades out. A splash screen is useful to avoid any visual
+                 gap between the end of Android's launch screen and the painting of
+                 Flutter's first frame. -->
+            <meta-data
+              android:name="io.flutter.embedding.android.SplashScreenDrawable"
+              android:resource="@drawable/launch_background" />
+
             <intent-filter>
                 <action android:name="android.intent.action.MAIN"/>
                 <category android:name="android.intent.category.LAUNCHER"/>
             </intent-filter>
         </activity>
+
+        <!-- This is used by the Flutter tool to generate GeneratedPluginRegistrant.java -->
+        <meta-data
+            android:name="flutterEmbedding"
+            android:value="2" />
+
     </application>
 </manifest>
```

**File**: `android/app/src/main/kotlin/com/example/pokedex/MainActivity.kt` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-package com.example.pokedex
-
-import android.os.Bundle
-
-import io.flutter.app.FlutterActivity
-import io.flutter.plugins.GeneratedPluginRegistrant
-
-class MainActivity: FlutterActivity() {
-  override fun onCreate(savedInstanceState: Bundle?) {
-    super.onCreate(savedInstanceState)
-    GeneratedPluginRegistrant.registerWith(this)
-  }
-}
```

**File**: `android/app/src/main/kotlin/com/hungps/flutterpokedex/MainActivity.kt` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+package com.hungps.flutterpokedex
+
+import io.flutter.embedding.android.FlutterActivity
+
+class MainActivity: FlutterActivity() {
+}
```

**File**: `android/app/src/main/res/drawable-v21/launch_background.xml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<?xml version="1.0" encoding="utf-8"?>
+<!-- Modify this file to customize your launch splash screen -->
+<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
+    <item android:drawable="?android:colorBackground" />
+
+    <!-- You can insert your own image assets here -->
+    <!-- <item>
+        <bitmap
+            android:gravity="center"
+            android:src="@mipmap/launch_image" />
+    </item> -->
+</layer-list>
```

**File**: `android/app/src/main/res/values-night/styles.xml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+<?xml version="1.0" encoding="utf-8"?>
+<resources>
+    <!-- Theme applied to the Android Window while the process is starting when the OS's Dark Mode setting is on -->
+    <style name="LaunchTheme" parent="@android:style/Theme.Black.NoTitleBar">
+        <!-- Show a splash screen on the activity. Automatically removed when
+             Flutter draws its first frame -->
+        <item name="android:windowBackground">@drawable/launch_background</item>
+    </style>
+    <!-- Theme applied to the Android Window as soon as the process has started.
+         This theme determines the color of the Android Window while your
+         Flutter UI initializes, as well as behind your Flutter UI while its
+         running.
+         
+         This Theme is only used starting with V2 of Flutter's Android embedding. -->
+    <style name="NormalTheme" parent="@android:style/Theme.Black.NoTitleBar">
+        <item name="android:windowBackground">?android:colorBackground</item>
+    </style>
+</resources>
```

---

### Incident Patch 15: `df0d0df8` (2020-11-30)
**Commit Message**: fix overflow on home screen & update android codebase

**File**: `android/.gitignore` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+gradle-wrapper.jar
+/.gradle
+/captures/
+/gradlew
+/gradlew.bat
+/local.properties
+GeneratedPluginRegistrant.java
+
+# Remember to never publicly share your keystore.
+# See https://flutter.dev/docs/deployment/android#reference-the-keystore-from-the-app
+key.properties
```

**File**: `android/app/build.gradle` (modified, +5/-5)
```diff
@@ -26,7 +26,7 @@ apply plugin: 'kotlin-android'
 apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"
 
 android {
-    compileSdkVersion 28
+    compileSdkVersion 30
 
     sourceSets {
         main.java.srcDirs += 'src/main/kotlin'
@@ -38,9 +38,9 @@ android {
 
     defaultConfig {
         // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
-        applicationId "com.example.pokedex"
+        applicationId "com.hungps.flutterpokedex"
         minSdkVersion 16
-        targetSdkVersion 28
+        targetSdkVersion 30
         versionCode flutterVersionCode.toInteger()
         versionName flutterVersionName
         testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
@@ -67,6 +67,6 @@ flutter {
 dependencies {
     implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlin_version"
     testImplementation 'junit:junit:4.12'
-    androidTestImplementation 'androidx.test:runner:1.1.1'
-    androidTestImplementation 'androidx.test.espresso:espresso-core:3.1.1'
+    androidTestImplementation 'androidx.test:runner:1.3.0'
+    androidTestImplementation 'androidx.test.espresso:espresso-core:3.3.0'
 }
```

**File**: `android/app/src/debug/AndroidManifest.xml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 <manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.pokedex">
+    package="com.hungps.flutterpokedex">
     <!-- Flutter needs it to communicate with the running application
          to allow setting breakpoints, to provide hot reload, etc.
     -->
```

**File**: `android/app/src/main/AndroidManifest.xml` (modified, +31/-12)
```diff
@@ -1,34 +1,53 @@
 <manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.pokedex">
-
+    xmlns:tools="http://schemas.android.com/tools"
+    package="com.hungps.flutterpokedex">
     <!-- io.flutter.app.FlutterApplication is an android.app.Application that
          calls FlutterMain.startInitialization(this); in its onCreate method.
          In most cases you can leave this as-is, but you if you want to provide
          additional functionality it is fine to subclass or reimplement
          FlutterApplication and put your custom class here. -->
+
     <uses-permission android:name="android.permission.INTERNET"/>
+
     <application
-        android:name="io.flutter.app.FlutterApplication"
-        android:label="pokedex"
-        android:icon="@mipmap/ic_launcher">
+        android:label="Pokedex"
+        android:icon="@mipmap/ic_launcher"
+        android:hardwareAccelerated="true">
         <activity
             android:name=".MainActivity"
             android:launchMode="singleTop"
             android:theme="@style/LaunchTheme"
-            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
+            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
             android:hardwareAccelerated="true"
             android:windowSoftInputMode="adjustResize">
-            <!-- This keeps the window background of the activity showing
-                 until Flutter renders its first frame. It can be removed if
-                 there is no splash screen (such as the default splash screen
-                 defined in @style/LaunchTheme). -->
+
+            <!-- Specifies an Android theme to apply to this Activity as soon as
+                 the Android process has started. This theme is visible to the user
+                 while the Flutter UI initializes. After that, this theme continues
+                 to determine the Window background behind the Flutter UI. -->
             <meta-data
-                android:name="io.flutter.app.android.SplashScreenUntilFirstFrame"
-                android:value="true" />
+              android:name="io.flutter.embedding.android.NormalTheme"
+              android:resource="@style/NormalTheme" />
+
+            <!-- Displays an Android View that continues showing the launch screen
+                 Drawable until Flutter paints its first frame, then this splash
+                 screen fades out. A splash screen is useful to avoid any visual
+                 gap between the end of Android's launch screen and the painting of
+                 Flutter's first frame. -->
+            <meta-data
+              android:name="io.flutter.embedding.android.SplashScreenDrawable"
+              android:resource="@drawable/launch_background" />
+
             <intent-filter>
                 <action android:name="android.intent.action.MAIN"/>
                 <category android:name="android.intent.category.LAUNCHER"/>
             </intent-filter>
         </activity>
+
+        <!-- This is used by the Flutter tool to generate GeneratedPluginRegistrant.java -->
+        <meta-data
+            android:name="flutterEmbedding"
+            android:value="2" />
+
     </application>
 </manifest>
```

**File**: `android/app/src/main/kotlin/com/example/pokedex/MainActivity.kt` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-package com.example.pokedex
-
-import android.os.Bundle
-
-import io.flutter.app.FlutterActivity
-import io.flutter.plugins.GeneratedPluginRegistrant
-
-class MainActivity: FlutterActivity() {
-  override fun onCreate(savedInstanceState: Bundle?) {
-    super.onCreate(savedInstanceState)
-    GeneratedPluginRegistrant.registerWith(this)
-  }
-}
```

**File**: `android/app/src/main/kotlin/com/hungps/flutterpokedex/MainActivity.kt` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+package com.hungps.flutterpokedex
+
+import io.flutter.embedding.android.FlutterActivity
+
+class MainActivity: FlutterActivity() {
+}
```

**File**: `android/app/src/main/res/drawable-v21/launch_background.xml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<?xml version="1.0" encoding="utf-8"?>
+<!-- Modify this file to customize your launch splash screen -->
+<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
+    <item android:drawable="?android:colorBackground" />
+
+    <!-- You can insert your own image assets here -->
+    <!-- <item>
+        <bitmap
+            android:gravity="center"
+            android:src="@mipmap/launch_image" />
+    </item> -->
+</layer-list>
```

**File**: `android/app/src/main/res/values-night/styles.xml` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+<?xml version="1.0" encoding="utf-8"?>
+<resources>
+    <!-- Theme applied to the Android Window while the process is starting when the OS's Dark Mode setting is on -->
+    <style name="LaunchTheme" parent="@android:style/Theme.Black.NoTitleBar">
+        <!-- Show a splash screen on the activity. Automatically removed when
+             Flutter draws its first frame -->
+        <item name="android:windowBackground">@drawable/launch_background</item>
+    </style>
+    <!-- Theme applied to the Android Window as soon as the process has started.
+         This theme determines the color of the Android Window while your
+         Flutter UI initializes, as well as behind your Flutter UI while its
+         running.
+         
+         This Theme is only used starting with V2 of Flutter's Android embedding. -->
+    <style name="NormalTheme" parent="@android:style/Theme.Black.NoTitleBar">
+        <item name="android:windowBackground">?android:colorBackground</item>
+    </style>
+</resources>
```

#### Recent Merged Pull Requests:
- **PR #91** (closed): Replace GitHub Gist API with PokeAPI v2 and implement pure on-demand pagination (@Copilot)
- **PR #90** (2025-05-03): fix: Deprecated imperative apply of Flutter's Gradle plugins (@hungps)
- **PR #89** (2025-05-03): refactor: upgrading dependencies & Flutter to 3.29.3 (@hungps)
- **PR #86** (closed): FIX: Issue of showing static data #85 (@namangarg1902)
- **PR #84** (2024-12-14): FIX: issue #83 (@namangarg1902)
- **PR #81** (closed): Update README.md (@burnerlee)
- **PR #80** (2024-01-12): refactor: architecture (@hungps)
- **PR #79** (2024-01-06): refactor: new theme system (@hungps)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
