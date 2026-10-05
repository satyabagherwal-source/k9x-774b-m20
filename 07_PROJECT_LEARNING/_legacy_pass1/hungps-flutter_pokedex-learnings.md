# Forensic Learning Record (Deep Inspection): hungps/flutter_pokedex

> **Canonical Artifact**: `07_PROJECT_LEARNING/hungps-flutter_pokedex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hungps/flutter_pokedex](https://github.com/hungps/flutter_pokedex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:29:10.917Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hungps/flutter_pokedex`
- **Description**: Pokedex app built with Flutter (with lots of animations) using Clean Architecture
- **Primary Language / Ecosystem**: Dart
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2531 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `windows/runner/flutter_window.cpp`
```
#include "flutter_window.h"

#include <optional>

#include "flutter/generated_plugin_registrant.h"

FlutterWindow::FlutterWindow(const flutter::DartProject& project)
    : project_(project) {}

FlutterWindow::~FlutterWindow() {}

bool FlutterWindow::OnCreate() {
  if (!Win32Window::OnCreate()) {
    return false;
  }

  RECT frame = GetClientArea();

  // The size here must match the window dimensions to avoid unnecessary surface
  // creation / destruction in the startup path.
  flutter_controller_ = std::make_unique<flutter::FlutterViewController>(
      frame.right - frame.left, frame.bottom - frame.top, project_);
  // Ensure that basic setup of the controller was successful.
  if (!flutter_controller_->engine() || !flutter_controller_->view()) {
    return false;
  }
  RegisterPlugins(flutter_controller_->engine());
  SetChildContent(flutter_controller_->view()->GetNativeWindow());

  flutter_controller_->engine()->SetNextFrameCallback([&]() {
    this->Show();
  });

  return true;
}

void FlutterWindow::OnDestroy() {
  if (flutter_controller_) {
    flutter_controller_ = nullptr;
  }

  Win32Window::OnDestroy();
}

LRESULT
FlutterWindow::MessageHandler(HWND hwnd, UINT const message,
                              WPARAM const wparam,
                              LPARAM const lparam) noexcept {
  // Give Flutter, including plugins, an opportunity to handle window messages.
  if (flutter_controller_) {
    std::optional<LRESULT> result =
        flutter_controller_->HandleTopLevelWindowProc(hwnd, message, wparam,
                                                      lparam);
    if (result) {
      return *result;
    }
  }

  switch (message) {
    case WM_FONTCHANGE:
      flutter_controller_->engine()->ReloadSystemFonts();
      break;
  }

  return Win32Window::MessageHandler(hwnd, message, wparam, lparam);
}

```

### Core Architecture Module: `windows/runner/flutter_window.h`
```
#ifndef RUNNER_FLUTTER_WINDOW_H_
#define RUNNER_FLUTTER_WINDOW_H_

#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>

#include <memory>

#include "win32_window.h"

// A window that does nothing but host a Flutter view.
class FlutterWindow : public Win32Window {
 public:
  // Creates a new FlutterWindow hosting a Flutter view running |project|.
  explicit FlutterWindow(const flutter::DartProject& project);
  virtual ~FlutterWindow();

 protected:
  // Win32Window:
  bool OnCreate() override;
  void OnDestroy() override;
  LRESULT MessageHandler(HWND window, UINT const message, WPARAM const wparam,
                         LPARAM const lparam) noexcept override;

 private:
  // The project to run.
  flutter::DartProject project_;

  // The Flutter instance hosted by this window.
  std::unique_ptr<flutter::FlutterViewController> flutter_controller_;
};

#endif  // RUNNER_FLUTTER_WINDOW_H_

```

### Core Architecture Module: `windows/runner/main.cpp`
```
#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <windows.h>

#include "flutter_window.h"
#include "utils.h"

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE prev,
                      _In_ wchar_t *command_line, _In_ int show_command) {
  // Attach to console when present (e.g., 'flutter run') or create a
  // new console when running with a debugger.
  if (!::AttachConsole(ATTACH_PARENT_PROCESS) && ::IsDebuggerPresent()) {
    CreateAndAttachConsole();
  }

  // Initialize COM, so that it is available for use in the library and/or
  // plugins.
  ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  flutter::DartProject project(L"data");

  std::vector<std::string> command_line_arguments =
      GetCommandLineArguments();

  project.set_dart_entrypoint_arguments(std::move(command_line_arguments));

  FlutterWindow window(project);
  Win32Window::Point origin(10, 10);
  Win32Window::Size size(1280, 720);
  if (!window.Create(L"flutter_pokedex", origin, size)) {
    return EXIT_FAILURE;
  }
  window.SetQuitOnClose(true);

  ::MSG msg;
  while (::GetMessage(&msg, nullptr, 0, 0)) {
    ::TranslateMessage(&msg);
    ::DispatchMessage(&msg);
  }

  ::CoUninitialize();
  return EXIT_SUCCESS;
}

```

### Core Architecture Module: `windows/runner/resource.h`
```
//{{NO_DEPENDENCIES}}
// Microsoft Visual C++ generated include file.
// Used by Runner.rc
//
#define IDI_APP_ICON                    101

// Next default values for new objects
//
#ifdef APSTUDIO_INVOKED
#ifndef APSTUDIO_READONLY_SYMBOLS
#define _APS_NEXT_RESOURCE_VALUE        102
#define _APS_NEXT_COMMAND_VALUE         40001
#define _APS_NEXT_CONTROL_VALUE         1001
#define _APS_NEXT_SYMED_VALUE           101
#endif
#endif

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

### Incident Patch 7: `13895bc9` (2022-01-22)
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

---

### Incident Patch 8: `dcaa5f8e` (2022-01-20)
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

### Incident Patch 9: `bff90cc1` (2021-10-24)
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

### Incident Patch 10: `32a6ba14` (2021-06-05)
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
-            AppNavigator.push(Routes.pokemonInfo, p
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
