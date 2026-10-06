# Forensic Learning Record (Deep Inspection): brianegan/flutter_architecture_samples

> **Canonical Artifact**: `07_PROJECT_LEARNING/brianegan-flutter_architecture_samples-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/brianegan/flutter_architecture_samples](https://github.com/brianegan/flutter_architecture_samples))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:29:17.437Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `brianegan/flutter_architecture_samples`
- **Description**: TodoMVC for Flutter
- **Primary Language / Ecosystem**: Dart
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8930 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bloc_flutter/windows/runner/utils.cpp`
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
  unsigned int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr)
    -1; // remove the trailing null character
  int input_length = (int)wcslen(utf16_string);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      input_length, utf8_string.data(), target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `bloc_flutter/windows/runner/utils.h`
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

### Core Architecture Module: `bloc_library/windows/runner/utils.cpp`
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
  unsigned int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr)
    -1; // remove the trailing null character
  int input_length = (int)wcslen(utf16_string);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      input_length, utf8_string.data(), target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `bloc_library/windows/runner/utils.h`
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

### Core Architecture Module: `change_notifier_provider/windows/runner/utils.cpp`
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
  unsigned int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr)
    -1; // remove the trailing null character
  int input_length = (int)wcslen(utf16_string);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      input_length, utf8_string.data(), target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `change_notifier_provider/windows/runner/utils.h`
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

### Core Architecture Module: `freezed_provider_value_notifier/windows/runner/utils.cpp`
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
  unsigned int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr)
    -1; // remove the trailing null character
  int input_length = (int)wcslen(utf16_string);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      input_length, utf8_string.data(), target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `freezed_provider_value_notifier/windows/runner/utils.h`
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

### Core Architecture Module: `inherited_widget/windows/runner/utils.cpp`
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
  unsigned int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr)
    -1; // remove the trailing null character
  int input_length = (int)wcslen(utf16_string);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      input_length, utf8_string.data(), target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `inherited_widget/windows/runner/utils.h`
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

### Core Architecture Module: `mobx/windows/runner/utils.cpp`
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
  unsigned int target_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      -1, nullptr, 0, nullptr, nullptr)
    -1; // remove the trailing null character
  int input_length = (int)wcslen(utf16_string);
  std::string utf8_string;
  if (target_length == 0 || target_length > utf8_string.max_size()) {
    return utf8_string;
  }
  utf8_string.resize(target_length);
  int converted_length = ::WideCharToMultiByte(
      CP_UTF8, WC_ERR_INVALID_CHARS, utf16_string,
      input_length, utf8_string.data(), target_length, nullptr, nullptr);
  if (converted_length == 0) {
    return std::string();
  }
  return utf8_string;
}

```

### Core Architecture Module: `mobx/windows/runner/utils.h`
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #115** (2020-01-08): **MVC project has an error**
  *Symptoms*: `App.dart` has the following line:  ```   /// An external reference to the Controller if you wish. -gp   static final Con controller = Con(); ```  Which is marked as an error:  >Class 'MVCApp' can't define static member 'controller' and have instance member 'AppMVC.controller' with the same name.
  **Post-Mortem & Fix Analysis**:
  > This is a strange one:  If you call ``` flutter build apk --debug ``` ... it will give this compiler error... If you call it a second time, it will compile with no error!  That is why we did not find it in the online integration tests (it does an auto-retry).  For now, to get it to compile change code to: ``` dart class MVCApp extends AppMVC {   MVCApp({Key key}) : super(con: appCon, key: key);    /// An external reference to the Controller if you wish. -gp   static final Con appCon = Con(); ```  
  > Sorry, think I fixed this but forgot to comment -- this one should be all fixed up!

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

### Incident Patch 1: `86994e3e` (2025-09-07)
**Commit Message**: Build web app and deploy to netlify

**File**: `.github/actions/dart_analysis_and_tests/action.yml` (modified, +0/-4)
```diff
@@ -4,10 +4,6 @@ inputs:
   working-directory:
     description: "Directory to run validation in"
     required: true
-  run-integration-tests:
-    description: "Run integration tests"
-    required: false
-    default: "true"
 
 runs:
   using: "composite"
```

**File**: `.github/actions/flutter_analysis_and_tests/action.yml` (modified, +28/-1)
```diff
@@ -8,7 +8,16 @@ inputs:
     description: "Run integration tests"
     required: false
     default: "true"
-
+  deploy-to-netlify:
+    description: "Deploy to Netlify"
+    required: true
+    default: "false"
+  netlify-auth-token:
+    description: "Netlify auth token"
+    required: true
+  netlify-site-id:
+    description: "Netlify site id"
+    required: true
 runs:
   using: "composite"
   steps:
@@ -64,3 +73,21 @@ runs:
         export DISPLAY=:99 # Set display for Xvfb
         xvfb-run -a flutter test integration_test/app_test.dart -d linux
       working-directory: ${{ inputs.working-directory }}
+
+    - name: Build web app
+      if: ${{ inputs.deploy-to-netlify != 'false' }}
+      shell: bash
+      run: |
+        flutter build web --wasm
+      working-directory: ${{ inputs.working-directory }}
+
+    - name: Deploy to Netlify
+      if: ${{ inputs.deploy-to-netlify != 'false' }}
+      uses: nwtgck/actions-netlify@v3.0
+      with:
+        publish-dir: ${{ inputs.working-directory }}/build/web
+        production-deploy: true
+        deploy-message: "Deploy from GitHub Actions"
+      env:
+        NETLIFY_AUTH_TOKEN: ${{ inputs.netlify-auth-token }}
+        NETLIFY_SITE_ID: ${{ inputs.netlify-site-id }}
```

**File**: `.github/workflows/static_analysis_and_tests.yml` (modified, +36/-0)
```diff
@@ -19,6 +19,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./bloc_flutter
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.BLOC_FLUTTER_NETLIFY_SITE_ID }}
   bloc_library:
     name: bloc_library
     runs-on: ubuntu-latest
@@ -30,6 +33,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./bloc_library
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.BLOC_LIBRARY_NETLIFY_SITE_ID }}
   blocs:
     name: blocs
     runs-on: ubuntu-latest
@@ -52,6 +58,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./change_notifier_provider
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.CHANGE_NOTIFIER_PROVIDER_NETLIFY_SITE_ID }}
   freezed_provider_value_notifier:
     name: freezed_provider_value_notifier
     runs-on: ubuntu-latest
@@ -63,6 +72,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./freezed_provider_value_notifier
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.FREEZED_PROVIDER_VALUE_NOTIFIER_NETLIFY_SITE_ID }}
   inherited_widget:
     name: inherited_widget
     runs-on: ubuntu-latest
@@ -74,6 +86,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./inherited_widget
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.INHERITED_WIDGET_NETLIFY_SITE_ID }}
   mobx:
     name: mobx
     runs-on: ubuntu-latest
@@ -85,6 +100,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./mobx
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.MOBX_NETLIFY_SITE_ID }}
   mvi_base:
     name: mvi_base
     runs-on: ubuntu-latest
@@ -107,6 +125,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./mvi_flutter
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.MVI_NETLIFY_SITE_ID }}
   redux:
     name: redux
     runs-on: ubuntu-latest
@@ -118,6 +139,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./redux
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.REDUX_NETLIFY_SITE_ID }}
   scoped_model:
     name: scoped_model
     runs-on: ubuntu-latest
@@ -129,6 +153,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./scoped_model
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.SCOPED_MODEL_NETLIFY_SITE_IT }}
   signals:
     name: signals
     runs-on: ubuntu-latest
@@ -140,6 +167,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./signals
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.SIGNALS_NETLIFY_SITE_ID }}
   simple_bloc_flutter:
     name: simple_bloc_flutter
     runs-on: ubuntu-latest
@@ -151,6 +181,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./simple_bloc_flutter
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.SIMPLE_BLOC_NETLIFY_SITE_ID }}
   simple_blocs:
     name: simple_blocs
     runs-on: ubuntu-latest
@@ -185,6 +218,9 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./vanilla
+          deploy-to-netlify: ${{ github.ref_name == 'refresh' }}
+          netlify-auth-token: ${{ secrets.NETLIFY_AUTH_TOKEN }}
+          netlify-site-id: ${{ secrets.VANILLA_NETLIFY_SITE_ID }}
   combine_and_upload_coverage:
     name: Combine
```

**File**: `vanilla/.metadata` (modified, +15/-15)
```diff
@@ -4,7 +4,7 @@
 # This file should be version controlled and should not be manually edited.
 
 version:
-  revision: "fcf2c11572af6f390246c056bc905eca609533a0"
+  revision: "05db9689081f091050f01aed79f04dce0c750154"
   channel: "stable"
 
 project_type: app
@@ -13,26 +13,26 @@ project_type: app
 migration:
   platforms:
     - platform: root
-      create_revision: fcf2c11572af6f390246c056bc905eca609533a0
-      base_revision: fcf2c11572af6f390246c056bc905eca609533a0
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
     - platform: android
-      create_revision: fcf2c11572af6f390246c056bc905eca609533a0
-      base_revision: fcf2c11572af6f390246c056bc905eca609533a0
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
     - platform: ios
-      create_revision: fcf2c11572af6f390246c056bc905eca609533a0
-      base_revision: fcf2c11572af6f390246c056bc905eca609533a0
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
     - platform: linux
-      create_revision: fcf2c11572af6f390246c056bc905eca609533a0
-      base_revision: fcf2c11572af6f390246c056bc905eca609533a0
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
     - platform: macos
-      create_revision: fcf2c11572af6f390246c056bc905eca609533a0
-      base_revision: fcf2c11572af6f390246c056bc905eca609533a0
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
     - platform: web
-      create_revision: fcf2c11572af6f390246c056bc905eca609533a0
-      base_revision: fcf2c11572af6f390246c056bc905eca609533a0
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
     - platform: windows
-      create_revision: fcf2c11572af6f390246c056bc905eca609533a0
-      base_revision: fcf2c11572af6f390246c056bc905eca609533a0
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
 
   # User provided section
 
```

**File**: `vanilla/android/build.gradle.kts` (modified, +4/-1)
```diff
@@ -5,7 +5,10 @@ allprojects {
     }
 }
 
-val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
+val newBuildDir: Directory =
+    rootProject.layout.buildDirectory
+        .dir("../../build")
+        .get()
 rootProject.layout.buildDirectory.value(newBuildDir)
 
 subprojects {
```

**File**: `vanilla/android/settings.gradle.kts` (modified, +9/-8)
```diff
@@ -1,11 +1,12 @@
 pluginManagement {
-    val flutterSdkPath = run {
-        val properties = java.util.Properties()
-        file("local.properties").inputStream().use { properties.load(it) }
-        val flutterSdkPath = properties.getProperty("flutter.sdk")
-        require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
-        flutterSdkPath
-    }
+    val flutterSdkPath =
+        run {
+            val properties = java.util.Properties()
+            file("local.properties").inputStream().use { properties.load(it) }
+            val flutterSdkPath = properties.getProperty("flutter.sdk")
+            require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
+            flutterSdkPath
+        }
 
     includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")
 
@@ -18,7 +19,7 @@ pluginManagement {
 
 plugins {
     id("dev.flutter.flutter-plugin-loader") version "1.0.0"
-    id("com.android.application") version "8.7.3" apply false
+    id("com.android.application") version "8.9.1" apply false
     id("org.jetbrains.kotlin.android") version "2.1.0" apply false
 }
 
```

**File**: `vanilla/ios/Flutter/AppFrameworkInfo.plist` (modified, +1/-1)
```diff
@@ -21,6 +21,6 @@
   <key>CFBundleVersion</key>
   <string>1.0</string>
   <key>MinimumOSVersion</key>
-  <string>12.0</string>
+  <string>13.0</string>
 </dict>
 </plist>
```

**File**: `vanilla/ios/Podfile` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 # Uncomment this line to define a global platform for your project
-# platform :ios, '12.0'
+# platform :ios, '13.0'
 
 # CocoaPods analytics sends network stats synchronously affecting flutter build latency.
 ENV['COCOAPODS_DISABLE_STATS'] = 'true'
```

---

### Incident Patch 2: `0ca62ee8` (2025-09-07)
**Commit Message**: Fix stats tests

**File**: `bloc_library/lib/blocs/stats/stats_bloc.dart` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ class StatsBloc extends Bloc<StatsEvent, StatsState> {
     : super(
         todosBloc.state is TodosLoaded
             ? _mapTodosToStats((todosBloc.state as TodosLoaded).todos)
-            : StatsLoaded(0, 0),
+            : StatsLoading(),
       ) {
     todosSubscription = todosBloc.stream.listen((state) {
       if (state is TodosLoaded) {
```

**File**: `bloc_library/test/blocs/stats_bloc_test.dart` (modified, +18/-12)
```diff
@@ -5,6 +5,7 @@ import 'package:bloc_library/blocs/todos/todos.dart';
 import 'package:bloc_library/models/models.dart';
 import 'package:bloc_test/bloc_test.dart';
 import 'package:flutter_test/flutter_test.dart';
+import 'package:mocktail/mocktail.dart';
 
 class MockTodosBloc extends MockBloc<TodosEvent, TodosState>
     implements TodosBloc {}
@@ -13,45 +14,50 @@ void main() {
   group('StatsBloc', () {
     final todo1 = Todo('Hallo');
     final todo2 = Todo('Hallo2', complete: true);
-    late TodosBloc todosBloc;
-    late StatsBloc statsBloc;
-
-    setUp(() {
-      todosBloc = MockTodosBloc();
-      statsBloc = StatsBloc(todosBloc: todosBloc);
-    });
 
     blocTest<StatsBloc, StatsState>(
       'should update the stats properly when TodosBloc emits TodosLoaded',
       build: () {
-        todosBloc = MockTodosBloc();
+        final todosBloc = MockTodosBloc();
+        when(() => todosBloc.state).thenReturn(TodosLoading());
         whenListen(
           todosBloc,
           Stream<TodosState>.fromIterable([TodosLoaded([])]),
         );
         return StatsBloc(todosBloc: todosBloc);
       },
-      act: (StatsBloc bloc) async => bloc.add(UpdateStats([])),
       expect: () => [StatsLoaded(0, 0)],
     );
 
     blocTest<StatsBloc, StatsState>(
       'should update the stats properly when Todos are empty',
-      build: () => statsBloc,
+      build: () {
+        final todosBloc = MockTodosBloc();
+        when(() => todosBloc.state).thenReturn(TodosLoading());
+        return StatsBloc(todosBloc: todosBloc);
+      },
       act: (StatsBloc bloc) async => bloc.add(UpdateStats([])),
       expect: () => [StatsLoaded(0, 0)],
     );
 
     blocTest<StatsBloc, StatsState>(
       'should update the stats properly when Todos contains one active todo',
-      build: () => statsBloc,
+      build: () {
+        final todosBloc = MockTodosBloc();
+        when(() => todosBloc.state).thenReturn(TodosLoading());
+        return StatsBloc(todosBloc: todosBloc);
+      },
       act: (StatsBloc bloc) async => bloc.add(UpdateStats([todo1])),
       expect: () => [StatsLoaded(1, 0)],
     );
 
     blocTest<StatsBloc, StatsState>(
       'should update the stats properly when Todos contains one active todo and one completed todo',
-      build: () => statsBloc,
+      build: () {
+        final todosBloc = MockTodosBloc();
+        when(() => todosBloc.state).thenReturn(TodosLoading());
+        return StatsBloc(todosBloc: todosBloc);
+      },
       act: (StatsBloc bloc) async => bloc.add(UpdateStats([todo1, todo2])),
       expect: () => [StatsLoaded(1, 1)],
     );
```

---

### Incident Patch 3: `0b7abb42` (2025-09-07)
**Commit Message**: Fix Analysis Errors

**File**: `bloc_library/lib/screens/home_screen.dart` (modified, +2/-0)
```diff
@@ -8,6 +8,8 @@ import 'package:flutter_bloc/flutter_bloc.dart';
 import 'package:todos_app_core/todos_app_core.dart';
 
 class HomeScreen extends StatelessWidget {
+  const HomeScreen({super.key});
+
   @override
   Widget build(BuildContext context) {
     final tabBloc = BlocProvider.of<TabBloc>(context);
```

**File**: `bloc_library/lib/widgets/extra_actions.dart` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import 'package:flutter_bloc/flutter_bloc.dart';
 import 'package:todos_app_core/todos_app_core.dart';
 
 class ExtraActions extends StatelessWidget {
-  ExtraActions({super.key = ArchSampleKeys.extraActionsButton});
+  const ExtraActions({super.key = ArchSampleKeys.extraActionsButton});
 
   @override
   Widget build(BuildContext context) {
```

**File**: `bloc_library/lib/widgets/filter_button.dart` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import 'package:todos_app_core/todos_app_core.dart';
 class FilterButton extends StatelessWidget {
   final bool visible;
 
-  FilterButton({super.key, required this.visible});
+  const FilterButton({super.key, required this.visible});
 
   @override
   Widget build(BuildContext context) {
```

**File**: `bloc_library/test/blocs/todos_bloc_test.dart` (modified, +0/-3)
```diff
@@ -95,7 +95,6 @@ void main() {
           ..add(AddTodo(todo1))
           ..add(AddTodo(todo2))
           ..add(ClearCompleted());
-        ;
       },
       expect: () => [
         TodosLoaded([]),
@@ -119,7 +118,6 @@ void main() {
           ..add(AddTodo(todo1))
           ..add(AddTodo(todo2))
           ..add(ToggleAll());
-        ;
       },
       expect: () => [
         TodosLoaded([]),
@@ -146,7 +144,6 @@ void main() {
           ..add(AddTodo(todo1))
           ..add(AddTodo(todo2))
           ..add(ToggleAll());
-        ;
       },
       expect: () => [
         TodosLoaded([]),
```

**File**: `bloc_library/test/screens/add_edit_screen_test.dart` (modified, +3/-3)
```diff
@@ -37,7 +37,7 @@ void main() {
       await tester.pumpWidget(
         MaterialApp(
           home: Scaffold(
-            body: AddEditScreen(isEditing: false, onSave: (_, __) {}),
+            body: AddEditScreen(isEditing: false, onSave: (_, _) {}),
           ),
           localizationsDelegates: [
             ArchSampleLocalizationsDelegate(),
@@ -59,7 +59,7 @@ void main() {
           home: Scaffold(
             body: AddEditScreen(
               isEditing: true,
-              onSave: (_, __) {
+              onSave: (_, _) {
                 onSavePressed = true;
               },
               todo: Todo('wash dishes'),
@@ -84,7 +84,7 @@ void main() {
           home: Scaffold(
             body: AddEditScreen(
               isEditing: true,
-              onSave: (_, __) {},
+              onSave: (_, _) {},
               todo: Todo('wash dishes'),
             ),
           ),
```

**File**: `bloc_library/test/widgets/todo_item_test.dart` (modified, +9/-9)
```diff
@@ -1,9 +1,9 @@
+import 'package:bloc_library/localization.dart';
+import 'package:bloc_library/models/models.dart';
+import 'package:bloc_library/widgets/todo_item.dart';
 import 'package:flutter/material.dart';
 import 'package:flutter_test/flutter_test.dart';
-import 'package:bloc_library/localization.dart';
 import 'package:todos_app_core/todos_app_core.dart';
-import 'package:bloc_library/widgets/todo_item.dart';
-import 'package:bloc_library/models/models.dart';
 
 void main() {
   group('TodoItem', () {
@@ -14,9 +14,9 @@ void main() {
         MaterialApp(
           home: Scaffold(
             body: TodoItem(
-              onCheckboxChanged: (_) => null,
-              onDismissed: (_) => null,
-              onTap: () => null,
+              onCheckboxChanged: (_) {},
+              onDismissed: (_) {},
+              onTap: () {},
               todo: Todo('wash car', id: '0'),
             ),
           ),
@@ -39,9 +39,9 @@ void main() {
         MaterialApp(
           home: Scaffold(
             body: TodoItem(
-              onCheckboxChanged: (_) => null,
-              onDismissed: (_) => null,
-              onTap: () => null,
+              onCheckboxChanged: (_) {},
+              onDismissed: (_) {},
+              onTap: () {},
               todo: Todo('wash car', note: 'some note', id: '0'),
             ),
           ),
```

**File**: `blocs/lib/blocs.dart` (modified, +0/-2)
```diff
@@ -1,5 +1,3 @@
-library blocs;
-
 export 'src/models/models.dart';
 export 'src/stats_bloc.dart';
 export 'src/todo_bloc.dart';
```

**File**: `blocs/lib/src/todo_bloc.dart` (modified, +3/-1)
```diff
@@ -44,6 +44,8 @@ class TodoBloc {
   void close() {
     deleteTodo.close();
     updateTodo.close();
-    _subscriptions.forEach((subscription) => subscription.cancel());
+    for (var subscription in _subscriptions) {
+      subscription.cancel();
+    }
   }
 }
```

---

### Incident Patch 4: `8b454331` (2025-09-04)
**Commit Message**: fix simple_blocs tests

**File**: `simple_blocs/pubspec.yaml` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ dependencies:
     path: ../todos_repository_core
 
 dev_dependencies:
+  build_runner: ^2.4.13
   lints: ^6.0.0
   test: ^1.25.6
   mockito: ^5.5.0
```

**File**: `simple_blocs/test/all_tests.dart` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-import 'stats_bloc_test.dart' as stats_bloc_test;
-import 'todo_bloc_test.dart' as todo_bloc_test;
-import 'todos_bloc_test.dart' as todos_bloc_test;
-import 'todos_interactor_test.dart' as todos_interactor_test;
-
-void main() {
-  stats_bloc_test.main();
-  todo_bloc_test.main();
-  todos_bloc_test.main();
-  todos_interactor_test.main();
-}
```

**File**: `simple_blocs/test/stats_bloc_test.dart` (modified, +3/-1)
```diff
@@ -1,10 +1,12 @@
+import 'package:mockito/annotations.dart';
 import 'package:mockito/mockito.dart';
 import 'package:rxdart/rxdart.dart';
 import 'package:simple_blocs/simple_blocs.dart';
 import 'package:test/test.dart';
 
-class MockTodosInteractor extends Mock implements TodosInteractor {}
+import 'stats_bloc_test.mocks.dart';
 
+@GenerateNiceMocks([MockSpec<TodosInteractor>()])
 void main() {
   group('StatsBloc', () {
     test('should stream the number of active todos', () {
```

**File**: `simple_blocs/test/stats_bloc_test.mocks.dart` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+// Mocks generated by Mockito 5.4.6 from annotations
+// in simple_blocs/test/stats_bloc_test.dart.
+// Do not manually edit this file.
+
+// ignore_for_file: no_leading_underscores_for_library_prefixes
+import 'dart:async' as _i4;
+
+import 'package:mockito/mockito.dart' as _i1;
+import 'package:simple_blocs/simple_blocs.dart' as _i3;
+import 'package:todos_repository_core/todos_repository_core.dart' as _i2;
+
+// ignore_for_file: type=lint
+// ignore_for_file: avoid_redundant_argument_values
+// ignore_for_file: avoid_setters_without_getters
+// ignore_for_file: comment_references
+// ignore_for_file: deprecated_member_use
+// ignore_for_file: deprecated_member_use_from_same_package
+// ignore_for_file: implementation_imports
+// ignore_for_file: invalid_use_of_visible_for_testing_member
+// ignore_for_file: must_be_immutable
+// ignore_for_file: prefer_const_constructors
+// ignore_for_file: unnecessary_parenthesis
+// ignore_for_file: camel_case_types
+// ignore_for_file: subtype_of_sealed_class
+
+class _FakeReactiveTodosRepository_0 extends _i1.SmartFake
+    implements _i2.ReactiveTodosRepository {
+  _FakeReactiveTodosRepository_0(Object parent, Invocation parentInvocation)
+    : super(parent, parentInvocation);
+}
+
+/// A class which mocks [TodosInteractor].
+///
+/// See the documentation for Mockito's code generation for more information.
+class MockTodosInteractor extends _i1.Mock implements _i3.TodosInteractor {
+  @override
+  _i2.ReactiveTodosRepository get repository =>
+      (super.noSuchMethod(
+            Invocation.getter(#repository),
+            returnValue: _FakeReactiveTodosRepository_0(
+              this,
+              Invocation.getter(#repository),
+            ),
+            returnValueForMissingStub: _FakeReactiveTodosRepository_0(
+              this,
+              Invocation.getter(#repository),
+            ),
+          )
+          as _i2.ReactiveTodosRepository);
+
+  @override
+  _i4.Stream<List<_i3.Todo>> get todos =>
+      (super.noSuchMethod(
+            Invocation.getter(#todos),
+            returnValue: _i4.Stream<List<_i3.Todo>>.empty(),
+            returnValueForMissingStub: _i4.Stream<List<_i3.Todo>>.empty(),
+          )
+          as _i4.Stream<List<_i3.Todo>>);
+
+  @override
+  _i4.Stream<bool> get allComplete =>
+      (super.noSuchMethod(
+            Invocation.getter(#allComplete),
+            returnValue: _i4.Stream<bool>.empty(),
+            returnValueForMissingStub: _i4.Stream<bool>.empty(),
+          )
+          as _i4.Stream<bool>);
+
+  @override
+  _i4.Stream<bool> get hasCompletedTodos =>
+      (super.noSuchMethod(
+            Invocation.getter(#hasCompletedTodos),
+            returnValue: _i4.Stream<bool>.empty(),
+            returnValueForMissingStub: _i4.Stream<bool>.empty(),
+          )
+          as _i4.Stream<bool>);
+
+  @override
+  _i4.Stream<_i3.Todo> todo(String? id) =>
+      (super.noSuchMethod(
+            Invocation.method(#todo, [id]),
+            returnValue: _i4.Stream<_i3.Todo>.empty(),
+            returnValueForMissingStub: _i4.Stream<_i3.Todo>.empty(),
+          )
+          as _i4.Stream<_i3.Todo>);
+
+  @override
+  _i4.Future<void> updateTodo(_i3.Todo? todo) =>
+      (super.noSuchMethod(
+            Invocation.method(#updateTodo, [todo]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<void> addNewTodo(_i3.Todo? todo) =>
+      (super.noSuchMethod(
+            Invocation.method(#addNewTodo, [todo]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<void> deleteTodo(String? id) =>
+      (super.noSuchMethod(
+            Invocation.method(#deleteTodo, [id]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<void> clearCompleted([dynamic _0]) =>
+      (super.noSuchMethod(
+            Invocation.method(#clearCompleted, [_0]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<List<dynamic>> toggleAll([dynamic _0]) =>
+      (super.noSuchMethod(
+            Invocation.method(#toggleAll, [_0]),
+            returnValue: _i4.Future<List<dynamic>>.value(<dynamic>[]),
+            returnValueForMissingStub: _i4.Future<List<dynamic>>.value(
+              <dynamic>[],
+            ),
+          )
+          as _i4.Future<List<dynamic>>);
+}
```

**File**: `simple_blocs/test/todo_bloc_test.dart` (modified, +3/-1)
```diff
@@ -1,11 +1,13 @@
 import 'dart:async';
 
+import 'package:mockito/annotations.dart';
 import 'package:mockito/mockito.dart';
 import 'package:simple_blocs/simple_blocs.dart';
 import 'package:test/test.dart';
 
-class MockTodosInteractor extends Mock implements TodosInteractor {}
+import 'todo_bloc_test.mocks.dart';
 
+@GenerateNiceMocks([MockSpec<TodosInteractor>()])
 void main() {
   group('TodoBloc', () {
     test('should get the todo from the interactor', () {
```

**File**: `simple_blocs/test/todo_bloc_test.mocks.dart` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+// Mocks generated by Mockito 5.4.6 from annotations
+// in simple_blocs/test/todo_bloc_test.dart.
+// Do not manually edit this file.
+
+// ignore_for_file: no_leading_underscores_for_library_prefixes
+import 'dart:async' as _i4;
+
+import 'package:mockito/mockito.dart' as _i1;
+import 'package:simple_blocs/simple_blocs.dart' as _i3;
+import 'package:todos_repository_core/todos_repository_core.dart' as _i2;
+
+// ignore_for_file: type=lint
+// ignore_for_file: avoid_redundant_argument_values
+// ignore_for_file: avoid_setters_without_getters
+// ignore_for_file: comment_references
+// ignore_for_file: deprecated_member_use
+// ignore_for_file: deprecated_member_use_from_same_package
+// ignore_for_file: implementation_imports
+// ignore_for_file: invalid_use_of_visible_for_testing_member
+// ignore_for_file: must_be_immutable
+// ignore_for_file: prefer_const_constructors
+// ignore_for_file: unnecessary_parenthesis
+// ignore_for_file: camel_case_types
+// ignore_for_file: subtype_of_sealed_class
+
+class _FakeReactiveTodosRepository_0 extends _i1.SmartFake
+    implements _i2.ReactiveTodosRepository {
+  _FakeReactiveTodosRepository_0(Object parent, Invocation parentInvocation)
+    : super(parent, parentInvocation);
+}
+
+/// A class which mocks [TodosInteractor].
+///
+/// See the documentation for Mockito's code generation for more information.
+class MockTodosInteractor extends _i1.Mock implements _i3.TodosInteractor {
+  @override
+  _i2.ReactiveTodosRepository get repository =>
+      (super.noSuchMethod(
+            Invocation.getter(#repository),
+            returnValue: _FakeReactiveTodosRepository_0(
+              this,
+              Invocation.getter(#repository),
+            ),
+            returnValueForMissingStub: _FakeReactiveTodosRepository_0(
+              this,
+              Invocation.getter(#repository),
+            ),
+          )
+          as _i2.ReactiveTodosRepository);
+
+  @override
+  _i4.Stream<List<_i3.Todo>> get todos =>
+      (super.noSuchMethod(
+            Invocation.getter(#todos),
+            returnValue: _i4.Stream<List<_i3.Todo>>.empty(),
+            returnValueForMissingStub: _i4.Stream<List<_i3.Todo>>.empty(),
+          )
+          as _i4.Stream<List<_i3.Todo>>);
+
+  @override
+  _i4.Stream<bool> get allComplete =>
+      (super.noSuchMethod(
+            Invocation.getter(#allComplete),
+            returnValue: _i4.Stream<bool>.empty(),
+            returnValueForMissingStub: _i4.Stream<bool>.empty(),
+          )
+          as _i4.Stream<bool>);
+
+  @override
+  _i4.Stream<bool> get hasCompletedTodos =>
+      (super.noSuchMethod(
+            Invocation.getter(#hasCompletedTodos),
+            returnValue: _i4.Stream<bool>.empty(),
+            returnValueForMissingStub: _i4.Stream<bool>.empty(),
+          )
+          as _i4.Stream<bool>);
+
+  @override
+  _i4.Stream<_i3.Todo> todo(String? id) =>
+      (super.noSuchMethod(
+            Invocation.method(#todo, [id]),
+            returnValue: _i4.Stream<_i3.Todo>.empty(),
+            returnValueForMissingStub: _i4.Stream<_i3.Todo>.empty(),
+          )
+          as _i4.Stream<_i3.Todo>);
+
+  @override
+  _i4.Future<void> updateTodo(_i3.Todo? todo) =>
+      (super.noSuchMethod(
+            Invocation.method(#updateTodo, [todo]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<void> addNewTodo(_i3.Todo? todo) =>
+      (super.noSuchMethod(
+            Invocation.method(#addNewTodo, [todo]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<void> deleteTodo(String? id) =>
+      (super.noSuchMethod(
+            Invocation.method(#deleteTodo, [id]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<void> clearCompleted([dynamic _0]) =>
+      (super.noSuchMethod(
+            Invocation.method(#clearCompleted, [_0]),
+            returnValue: _i4.Future<void>.value(),
+            returnValueForMissingStub: _i4.Future<void>.value(),
+          )
+          as _i4.Future<void>);
+
+  @override
+  _i4.Future<List<dynamic>> toggleAll([dynamic _0]) =>
+      (super.noSuchMethod(
+            Invocation.method(#toggleAll, [_0]),
+            returnValue: _i4.Future<List<dynamic>>.value(<dynamic>[]),
+            returnValueForMissingStub: _i4.Future<List<dynamic>>.value(
+              <dynamic>[],
+            ),
+          )
+          as _i4.Future<List<dynamic>>);
+}
```

**File**: `simple_blocs/test/todos_interactor_test.dart` (modified, +3/-2)
```diff
@@ -1,14 +1,15 @@
 import 'dart:async';
 
+import 'package:mockito/annotations.dart';
 import 'package:mockito/mockito.dart';
 import 'package:rxdart/rxdart.dart';
 import 'package:simple_blocs/simple_blocs.dart';
 import 'package:test/test.dart';
 import 'package:todos_repository_core/todos_repository_core.dart';
 
-class MockReactiveTodosRepository extends Mock
-    implements ReactiveTodosRepository {}
+import 'todos_interactor_test.mocks.dart';
 
+@GenerateNiceMocks([MockSpec<ReactiveTodosRepository>()])
 void main() {
   group('TodosListInteractor', () {
     test('should convert repo entities into Todos', () {
```

**File**: `simple_blocs/test/todos_interactor_test.mocks.dart` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+// Mocks generated by Mockito 5.4.6 from annotations
+// in simple_blocs/test/todos_interactor_test.dart.
+// Do not manually edit this file.
+
+// ignore_for_file: no_leading_underscores_for_library_prefixes
+import 'dart:async' as _i3;
+
+import 'package:mockito/mockito.dart' as _i1;
+import 'package:todos_repository_core/src/reactive_repository.dart' as _i2;
+import 'package:todos_repository_core/src/todo_entity.dart' as _i4;
+
+// ignore_for_file: type=lint
+// ignore_for_file: avoid_redundant_argument_values
+// ignore_for_file: avoid_setters_without_getters
+// ignore_for_file: comment_references
+// ignore_for_file: deprecated_member_use
+// ignore_for_file: deprecated_member_use_from_same_package
+// ignore_for_file: implementation_imports
+// ignore_for_file: invalid_use_of_visible_for_testing_member
+// ignore_for_file: must_be_immutable
+// ignore_for_file: prefer_const_constructors
+// ignore_for_file: unnecessary_parenthesis
+// ignore_for_file: camel_case_types
+// ignore_for_file: subtype_of_sealed_class
+
+/// A class which mocks [ReactiveTodosRepository].
+///
+/// See the documentation for Mockito's code generation for more information.
+class MockReactiveTodosRepository extends _i1.Mock
+    implements _i2.ReactiveTodosRepository {
+  @override
+  _i3.Future<void> addNewTodo(_i4.TodoEntity? todo) =>
+      (super.noSuchMethod(
+            Invocation.method(#addNewTodo, [todo]),
+            returnValue: _i3.Future<void>.value(),
+            returnValueForMissingStub: _i3.Future<void>.value(),
+          )
+          as _i3.Future<void>);
+
+  @override
+  _i3.Future<void> deleteTodo(List<String>? idList) =>
+      (super.noSuchMethod(
+            Invocation.method(#deleteTodo, [idList]),
+            returnValue: _i3.Future<void>.value(),
+            returnValueForMissingStub: _i3.Future<void>.value(),
+          )
+          as _i3.Future<void>);
+
+  @override
+  _i3.Stream<List<_i4.TodoEntity>> todos() =>
+      (super.noSuchMethod(
+            Invocation.method(#todos, []),
+            returnValue: _i3.Stream<List<_i4.TodoEntity>>.empty(),
+            returnValueForMissingStub: _i3.Stream<List<_i4.TodoEntity>>.empty(),
+          )
+          as _i3.Stream<List<_i4.TodoEntity>>);
+
+  @override
+  _i3.Future<void> updateTodo(_i4.TodoEntity? todo) =>
+      (super.noSuchMethod(
+            Invocation.method(#updateTodo, [todo]),
+            returnValue: _i3.Future<void>.value(),
+            returnValueForMissingStub: _i3.Future<void>.value(),
+          )
+          as _i3.Future<void>);
+}
```

---

### Incident Patch 5: `f8532710` (2025-09-04)
**Commit Message**: Fix change_notifier_provider test

**File**: `change_notifier_provider/test/home_screen_test.dart` (modified, +3/-2)
```diff
@@ -112,10 +112,11 @@ class _TestWidget extends StatelessWidget {
 Matcher isChecked(bool isChecked) {
   return matchesSemantics(
     isChecked: isChecked,
+    hasTapAction: true,
+    hasFocusAction: true,
     hasCheckedState: true,
+    isFocusable: true,
     hasEnabledState: true,
     isEnabled: true,
-    isFocusable: true,
-    hasTapAction: true,
   );
 }
```

---

### Incident Patch 6: `4be72efe` (2025-09-04)
**Commit Message**: Fix simple_blocs analysis issues

**File**: `simple_blocs/lib/simple_blocs.dart` (modified, +0/-2)
```diff
@@ -1,5 +1,3 @@
-library blocs;
-
 export 'src/models/models.dart';
 export 'src/stats_bloc.dart';
 export 'src/todo_bloc.dart';
```

**File**: `simple_blocs/lib/src/user_bloc.dart` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@ class UserBloc {
   Stream<UserEntity> login() =>
       _repository.login().asStream().asBroadcastStream();
 
-  UserBloc(UserRepository repository) : this._repository = repository;
+  UserBloc(UserRepository repository) : _repository = repository;
 }
```

**File**: `simple_blocs/pubspec.yaml` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ environment:
 
 dependencies:
   collection: ^1.15.0
+  meta: ^1.15.0
   rxdart: ^0.28.0
   todos_repository_core:
     path: ../todos_repository_core
```

**File**: `simple_blocs/test/todo_bloc_test.dart` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ import 'dart:async';
 
 import 'package:mockito/mockito.dart';
 import 'package:simple_blocs/simple_blocs.dart';
-import 'package:simple_blocs/src/models/models.dart';
 import 'package:test/test.dart';
 
 class MockTodosInteractor extends Mock implements TodosInteractor {}
```

---

### Incident Patch 7: `7a24814d` (2025-09-04)
**Commit Message**: More CI fixes

**File**: `.github/actions/dart_analysis_and_tests/action.yml` (modified, +3/-1)
```diff
@@ -33,7 +33,9 @@ runs:
     - name: Run unit tests and prepare coverage
       shell: bash
       run: |
-        dart test --coverage
+        dart pub global activate coverage
+        dart run test --coverage=coverage
+        dart pub global run coverage:format_coverage --lcov --in=coverage --out=coverage/lcov.info --packages=.dart_tool/package_config.json --report-on=lib
         # Extract directory name for artifact naming
         echo "DIR_NAME=$(basename "${{ inputs.working-directory }}")" >> $GITHUB_ENV
       working-directory: ${{ inputs.working-directory }}
```

**File**: `.github/actions/flutter_analysis_and_tests/action.yml` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ runs:
 
     - name: Run unit tests and prepare coverage
       shell: bash
+      if: '[ -d "${{ inputs.working-directory }}/test" ]'
       run: |
         flutter test --coverage
         # Extract directory name for artifact naming
```

---

### Incident Patch 8: `7b87f1dc` (2025-09-04)
**Commit Message**: Fix CI issues

**File**: `change_notifier_provider/test/mock_repository.dart` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ class MockRepository extends TodosRepository {
   int saveCount = 0;
 
   MockRepository([List<Todo> todos = const []])
-      : entities = todos.map((it) => it.toEntity()).toList();
+    : entities = todos.map((it) => it.toEntity()).toList();
 
   @override
   Future<List<TodoEntity>> loadTodos() async => entities;
```

**File**: `mvi_flutter/lib/widgets/extra_actions_button.dart` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ class ExtraActionsButton extends StatelessWidget {
   final bool allComplete;
   final bool hasCompletedTodos;
 
-  ExtraActionsButton({
+  const ExtraActionsButton({
     super.key,
     required this.onSelected,
     this.allComplete = false,
```

**File**: `mvi_flutter/lib/widgets/filter_button.dart` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ class FilterButton extends StatelessWidget {
   final VisibilityFilter activeFilter;
   final bool isActive;
 
-  FilterButton({
+  const FilterButton({
     super.key,
     required this.onSelected,
     required this.activeFilter,
```

---

### Incident Patch 9: `a3b4e41a` (2025-09-04)
**Commit Message**: Update redux

**File**: `redux/.metadata` (modified, +37/-2)
```diff
@@ -4,7 +4,42 @@
 # This file should be version controlled and should not be manually edited.
 
 version:
-  revision: 18cd7a3601bcffb36fdf2f679f763b5e827c2e8e
-  channel: beta
+  revision: "05db9689081f091050f01aed79f04dce0c750154"
+  channel: "stable"
 
 project_type: app
+
+# Tracks metadata for the flutter migrate command
+migration:
+  platforms:
+    - platform: root
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
+    - platform: android
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
+    - platform: ios
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
+    - platform: linux
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
+    - platform: macos
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
+    - platform: web
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
+    - platform: windows
+      create_revision: 05db9689081f091050f01aed79f04dce0c750154
+      base_revision: 05db9689081f091050f01aed79f04dce0c750154
+
+  # User provided section
+
+  # List of Local paths (relative to this file) that should be
+  # ignored by the migrate tool.
+  #
+  # Files that are not part of the templates will be ignored by default.
+  unmanaged_files:
+    - 'lib/main.dart'
+    - 'ios/Runner.xcodeproj/project.pbxproj'
```

**File**: `redux/analysis_options.yaml` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+# This file configures the analyzer, which statically analyzes Dart code to
+# check for errors, warnings, and lints.
+#
+# The issues identified by the analyzer are surfaced in the UI of Dart-enabled
+# IDEs (https://dart.dev/tools#ides-and-editors). The analyzer can also be
+# invoked from the command line by running `flutter analyze`.
+
+# The following line activates a set of recommended lints for Flutter apps,
+# packages, and plugins designed to encourage good coding practices.
+include: package:flutter_lints/flutter.yaml
+
+analyzer:
+  language:
+    strict-casts: true
+    strict-inference: true
+    strict-raw-types: true
+
+linter:
+  # The lint rules applied to this project can be customized in the
+  # section below to disable rules from the `package:flutter_lints/flutter.yaml`
+  # included above or to enable additional rules. A list of all available lints
+  # and their documentation is published at https://dart.dev/lints.
+  #
+  # Instead of disabling a lint rule for the entire project in the
+  # section below, it can also be suppressed for a single line of code
+  # or a specific dart file by using the `// ignore: name_of_lint` and
+  # `// ignore_for_file: name_of_lint` syntax on the line or in the file
+  # producing the lint.
+  rules:
+    # avoid_print: false  # Uncomment to disable the `avoid_print` rule
+    # prefer_single_quotes: true  # Uncomment to enable the `prefer_single_quotes` rule
+
+# Additional information about this file can be found at
+# https://dart.dev/guides/language/analysis-options
```

**File**: `redux/android/.gitignore` (modified, +7/-0)
```diff
@@ -5,3 +5,10 @@ gradle-wrapper.jar
 /gradlew.bat
 /local.properties
 GeneratedPluginRegistrant.java
+.cxx/
+
+# Remember to never publicly share your keystore.
+# See https://flutter.dev/to/reference-keystore
+key.properties
+**/*.keystore
+**/*.jks
```

**File**: `redux/android/app/build.gradle` (removed, +0/-67)
```diff
@@ -1,67 +0,0 @@
-def localProperties = new Properties()
-def localPropertiesFile = rootProject.file('local.properties')
-if (localPropertiesFile.exists()) {
-    localPropertiesFile.withReader('UTF-8') { reader ->
-        localProperties.load(reader)
-    }
-}
-
-def flutterRoot = localProperties.getProperty('flutter.sdk')
-if (flutterRoot == null) {
-    throw new GradleException("Flutter SDK not found. Define location with flutter.sdk in the local.properties file.")
-}
-
-def flutterVersionCode = localProperties.getProperty('flutter.versionCode')
-if (flutterVersionCode == null) {
-    flutterVersionCode = '1'
-}
-
-def flutterVersionName = localProperties.getProperty('flutter.versionName')
-if (flutterVersionName == null) {
-    flutterVersionName = '1.0'
-}
-
-apply plugin: 'com.android.application'
-apply plugin: 'kotlin-android'
-apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"
-
-android {
-    compileSdkVersion 28
-
-    sourceSets {
-        main.java.srcDirs += 'src/main/kotlin'
-    }
-
-    lintOptions {
-        disable 'InvalidPackage'
-    }
-
-    defaultConfig {
-        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
-        applicationId "com.example.redux"
-        minSdkVersion 16
-        targetSdkVersion 28
-        versionCode flutterVersionCode.toInteger()
-        versionName flutterVersionName
-        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
-    }
-
-    buildTypes {
-        release {
-            // TODO: Add your own signing config for the release build.
-            // Signing with the debug keys for now, so `flutter run --release` works.
-            signingConfig signingConfigs.debug
-        }
-    }
-}
-
-flutter {
-    source '../..'
-}
-
-dependencies {
-    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlin_version"
-    testImplementation 'junit:junit:4.12'
-    androidTestImplementation 'androidx.test:runner:1.1.1'
-    androidTestImplementation 'androidx.test.espresso:espresso-core:3.1.1'
-}
```

**File**: `redux/android/app/build.gradle.kts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+plugins {
+    id("com.android.application")
+    id("kotlin-android")
+    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
+    id("dev.flutter.flutter-gradle-plugin")
+}
+
+android {
+    namespace = "com.example.redux_sample"
+    compileSdk = flutter.compileSdkVersion
+    ndkVersion = flutter.ndkVersion
+
+    compileOptions {
+        sourceCompatibility = JavaVersion.VERSION_11
+        targetCompatibility = JavaVersion.VERSION_11
+    }
+
+    kotlinOptions {
+        jvmTarget = JavaVersion.VERSION_11.toString()
+    }
+
+    defaultConfig {
+        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
+        applicationId = "com.example.redux_sample"
+        // You can update the following values to match your application needs.
+        // For more information, see: https://flutter.dev/to/review-gradle-config.
+        minSdk = flutter.minSdkVersion
+        targetSdk = flutter.targetSdkVersion
+        versionCode = flutter.versionCode
+        versionName = flutter.versionName
+    }
+
+    buildTypes {
+        release {
+            // TODO: Add your own signing config for the release build.
+            // Signing with the debug keys for now, so `flutter run --release` works.
+            signingConfig = signingConfigs.getByName("debug")
+        }
+    }
+}
+
+flutter {
+    source = "../.."
+}
```

**File**: `redux/android/app/src/debug/AndroidManifest.xml` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
-<manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.redux">
-    <!-- Flutter needs it to communicate with the running application
+<manifest xmlns:android="http://schemas.android.com/apk/res/android">
+    <!-- The INTERNET permission is required for development. Specifically,
+         the Flutter tool needs it to communicate with the running application
          to allow setting breakpoints, to provide hot reload, etc.
     -->
     <uses-permission android:name="android.permission.INTERNET"/>
```

**File**: `redux/android/app/src/main/AndroidManifest.xml` (modified, +24/-9)
```diff
@@ -1,21 +1,25 @@
-<manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.redux">
-    <!-- io.flutter.app.FlutterApplication is an android.app.Application that
-         calls FlutterMain.startInitialization(this); in its onCreate method.
-         In most cases you can leave this as-is, but you if you want to provide
-         additional functionality it is fine to subclass or reimplement
-         FlutterApplication and put your custom class here. -->
+<manifest xmlns:android="http://schemas.android.com/apk/res/android">
     <application
-        android:name="io.flutter.app.FlutterApplication"
-        android:label="redux"
+        android:label="redux_sample"
+        android:name="${applicationName}"
         android:icon="@mipmap/ic_launcher">
         <activity
             android:name=".MainActivity"
+            android:exported="true"
             android:launchMode="singleTop"
+            android:taskAffinity=""
             android:theme="@style/LaunchTheme"
             android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
             android:hardwareAccelerated="true"
             android:windowSoftInputMode="adjustResize">
+            <!-- Specifies an Android theme to apply to this Activity as soon as
+                 the Android process has started. This theme is visible to the user
+                 while the Flutter UI initializes. After that, this theme continues
+                 to determine the Window background behind the Flutter UI. -->
+            <meta-data
+              android:name="io.flutter.embedding.android.NormalTheme"
+              android:resource="@style/NormalTheme"
+              />
             <intent-filter>
                 <action android:name="android.intent.action.MAIN"/>
                 <category android:name="android.intent.category.LAUNCHER"/>
@@ -27,4 +31,15 @@
             android:name="flutterEmbedding"
             android:value="2" />
     </application>
+    <!-- Required to query activities that can process text, see:
+         https://developer.android.com/training/package-visibility and
+         https://developer.android.com/reference/android/content/Intent#ACTION_PROCESS_TEXT.
+
+         In particular, this is used by the Flutter engine in io.flutter.plugin.text.ProcessTextPlugin. -->
+    <queries>
+        <intent>
+            <action android:name="android.intent.action.PROCESS_TEXT"/>
+            <data android:mimeType="text/plain"/>
+        </intent>
+    </queries>
 </manifest>
```

**File**: `redux/android/app/src/main/kotlin/com/example/redux/MainActivity.kt` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-package com.example.redux
-
-import androidx.annotation.NonNull;
-import io.flutter.embedding.android.FlutterActivity
-import io.flutter.embedding.engine.FlutterEngine
-import io.flutter.plugins.GeneratedPluginRegistrant
-
-class MainActivity: FlutterActivity() {
-    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
-        GeneratedPluginRegistrant.registerWith(flutterEngine);
-    }
-}
```

---

### Incident Patch 10: `12e4f027` (2025-09-04)
**Commit Message**: Fix scoped model analysis errors

**File**: `scoped_model/lib/app.dart` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import 'package:todos_repository_core/todos_repository_core.dart';
 class ScopedModelApp extends StatelessWidget {
   final TodosRepository repository;
 
-  ScopedModelApp({required this.repository});
+  const ScopedModelApp({super.key, required this.repository});
 
   @override
   Widget build(BuildContext context) {
```

**File**: `scoped_model/lib/widgets/stats_counter.dart` (modified, +1/-2)
```diff
@@ -1,12 +1,11 @@
-import 'package:flutter/cupertino.dart';
 import 'package:flutter/material.dart';
 import 'package:scoped_model/scoped_model.dart';
 import 'package:scoped_model_sample/models.dart';
 import 'package:scoped_model_sample/todo_list_model.dart';
 import 'package:todos_app_core/todos_app_core.dart';
 
 class StatsCounter extends StatelessWidget {
-  StatsCounter() : super(key: ArchSampleKeys.statsCounter);
+  const StatsCounter({super.key = ArchSampleKeys.statsCounter});
 
   bool isActive(Todo todo) => !todo.complete;
 
```

**File**: `scoped_model/pubspec.yaml` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@ dependencies:
   collection:
   flutter:
     sdk: flutter
+  path_provider:
   scoped_model:
   shared_preferences:
   todos_app_core:
```

---

### Incident Patch 11: `77f8ba6c` (2025-09-04)
**Commit Message**: remove states_rebuilder for now.

**File**: `built_redux/.flutter-plugins-dependencies` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-{"info":"This is a generated file; do not edit or check into version control.","plugins":{"ios":[{"name":"path_provider","path":"/Users/remirousselet/.pub-cache/hosted/pub.dartlang.org/path_provider-1.6.0/","dependencies":[]}],"android":[{"name":"path_provider","path":"/Users/remirousselet/.pub-cache/hosted/pub.dartlang.org/path_provider-1.6.0/","dependencies":[]}],"macos":[],"linux":[],"windows":[],"web":[]},"dependencyGraph":[{"name":"path_provider","dependencies":[]}],"date_created":"2020-02-10 11:23:40.410802","version":"1.14.7-pre.38"}
\ No newline at end of file
```

**File**: `built_redux/.gitignore` (removed, +0/-73)
```diff
@@ -1,73 +0,0 @@
-# Miscellaneous
-*.class
-*.log
-*.pyc
-*.swp
-.DS_Store
-.atom/
-.buildlog/
-.history
-.svn/
-
-# IntelliJ related
-*.iml
-*.ipr
-*.iws
-.idea/
-
-# The .vscode folder contains launch configuration and tasks you configure in
-# VS Code which you may wish to be included in version control, so this line
-# is commented out by default.
-#.vscode/
-
-# Flutter/Dart/Pub related
-**/doc/api/
-.dart_tool/
-.flutter-plugins
-.packages
-.pub-cache/
-.pub/
-/build/
-
-# Android related
-**/android/**/gradle-wrapper.jar
-**/android/.gradle
-**/android/captures/
-**/android/gradlew
-**/android/gradlew.bat
-**/android/local.properties
-**/android/**/GeneratedPluginRegistrant.java
-
-# iOS/XCode related
-**/ios/**/*.mode1v3
-**/ios/**/*.mode2v3
-**/ios/**/*.moved-aside
-**/ios/**/*.pbxuser
-**/ios/**/*.perspectivev3
-**/ios/**/*sync/
-**/ios/**/.sconsign.dblite
-**/ios/**/.tags*
-**/ios/**/.vagrant/
-**/ios/**/DerivedData/
-**/ios/**/Icon?
-**/ios/**/Pods/
-**/ios/**/.symlinks/
-**/ios/**/profile
-**/ios/**/xcuserdata
-**/ios/.generated/
-**/ios/Flutter/App.framework
-**/ios/Flutter/Flutter.framework
-**/ios/Flutter/Generated.xcconfig
-**/ios/Flutter/app.flx
-**/ios/Flutter/app.zip
-**/ios/Flutter/flutter_assets/
-**/ios/Flutter/flutter_export_environment.sh
-**/ios/ServiceDefinitions.json
-**/ios/Runner/GeneratedPluginRegistrant.*
-
-# Exceptions to above rules.
-!**/ios/**/default.mode1v3
-!**/ios/**/default.mode2v3
-!**/ios/**/default.pbxuser
-!**/ios/**/default.perspectivev3
-!/packages/flutter_tools/test/data/dart_dependencies_test/**/.packages
```

**File**: `built_redux/.metadata` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-# This file tracks properties of this Flutter project.
-# Used by Flutter tool to assess capabilities and perform upgrades etc.
-#
-# This file should be version controlled and should not be manually edited.
-
-version:
-  revision: 27321ebbad34b0a3fafe99fac037102196d655ff
-  channel: stable
-
-project_type: app
```

**File**: `built_redux/README.md` (removed, +0/-51)
```diff
@@ -1,51 +0,0 @@
-# built_redux
-
-An example Todo app created with [built_value](https://pub.dartlang.org/packages/built_value), [built_redux](https://pub.dartlang.org/packages/built_redux), and [flutter_built_redux](https://pub.dartlang.org/packages/flutter_built_redux).
-
-## Key Concepts
-
-  * Most of the Key Concepts from the [Redux Example](../redux) apply to this example as well, but the implementations are slightly different.
-  * To enforce immutability, `built_redux` apps require you to use a `built_value` Value Object.
-  * To increase discoverability, all actions are created using `built_redux` and attached to the `Store`.
-  * To use `built_value` and `built_redux`, you must add a `build.yaml` file to your project.
-  * To help with Type Safety, Reducers and Middleware can be created with `ReducerBuilder` and `MiddlewareBuilder` classes.
-  
-## Enforcing Immutability
-
-The `State` objects in your app need to be created with `built_value`. `built_value` is a library that generate "Value Classes" from a Class template that you write.
-
-The Value classes can not be directly modified, but instead must be updated by creating a new version of the object.
-
-## Actions Discoverability
-
-One benefit of `built_redux` is that it attaches all possible actions to your store. This makes it very easy to see which actions are available for dispatch within your IDE using autocompletion.
-
-## Build.yaml
-
-In order to use `built_redux` and `built_value`, you need to create a `build.yaml` file in your project. Whenever you update your Value Classes or Redux Actions you'll need to run the build command: `flutter pub pub run build_runner build`. Instead of running the `build` command, you can run the `watch` command: `flutter pub pub run build_runner watch`. This will watch for changes and trigger a rebuild every time you make updates. This tends to be much faster overall.
-
-## Type Safety in Reducers and Middleware
-
-As your app grows, you'll want to break reducers and middleware down into smaller functions.
-
-## Differences to Redux
-
-These two libraries are incredibly similar. These are the minor differences:
-
-  * Actions
-    - `built_redux` - Actions are generated for you by `built_redux` based on a definition. They are then attached to the Store upon creation. Each action has a unique name and a generic payload type. Each action can have at most one reducer.
-    - `Redux`, Actions are plain ol' Dart values, Classes or Enums.
-  * Reducers
-    - `built_redux` - Reducers are void functions that mutate a `StateBuilder`. The `StateBuilder` is then built after all reducers have run. Enforces immutability.
-    - `redux` - Reducers are functions in app state and latest action and return a new app state. Since immutability is not enforced, a user could simply mutate the state object instead of returning an updated copy.
-    - Both - Testing is easy, and both libraries have utilities for binding Reducers to Actions of a specific type. 
-  * Middleware
-    - Very little difference here. Both libraries have utilities for binding actions of a specific type to a given Middleware.
-  * Nesting Large State Trees
-    - `built_redux` - Provides helpers for composing large Action trees that you can attach to your Store upon creation. Reducers can be combined via functional composition and by using utilities from the library.
-    - `redux` - No need for nesting actions, nesting reducers can be done via functional composition and by using utilities from the library.
-    - Both - allow you to break down your app into smaller units.
-  * Flutter integration
-    - `built_redux` - Maps from a `State` to `Prop`, which is passed to your `build` method along with your `Actions`. You combine the `Prop` wih the actions in the `build` method.
-    - `redux` - Maps from a `Store` to a `ViewModel`. The `ViewModel` should include both "Props" and callback functions that dispatch actions.
-    - Both - Store a Widget at the top of your tree containing your State. 
```

**File**: `built_redux/android/.gitignore` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-gradle-wrapper.jar
-/.gradle
-/captures/
-/gradlew
-/gradlew.bat
-/local.properties
-GeneratedPluginRegistrant.java
```

**File**: `built_redux/android/app/build.gradle` (removed, +0/-67)
```diff
@@ -1,67 +0,0 @@
-def localProperties = new Properties()
-def localPropertiesFile = rootProject.file('local.properties')
-if (localPropertiesFile.exists()) {
-    localPropertiesFile.withReader('UTF-8') { reader ->
-        localProperties.load(reader)
-    }
-}
-
-def flutterRoot = localProperties.getProperty('flutter.sdk')
-if (flutterRoot == null) {
-    throw new GradleException("Flutter SDK not found. Define location with flutter.sdk in the local.properties file.")
-}
-
-def flutterVersionCode = localProperties.getProperty('flutter.versionCode')
-if (flutterVersionCode == null) {
-    flutterVersionCode = '1'
-}
-
-def flutterVersionName = localProperties.getProperty('flutter.versionName')
-if (flutterVersionName == null) {
-    flutterVersionName = '1.0'
-}
-
-apply plugin: 'com.android.application'
-apply plugin: 'kotlin-android'
-apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"
-
-android {
-    compileSdkVersion 28
-
-    sourceSets {
-        main.java.srcDirs += 'src/main/kotlin'
-    }
-
-    lintOptions {
-        disable 'InvalidPackage'
-    }
-
-    defaultConfig {
-        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
-        applicationId "com.example.built_redux"
-        minSdkVersion 16
-        targetSdkVersion 28
-        versionCode flutterVersionCode.toInteger()
-        versionName flutterVersionName
-        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
-    }
-
-    buildTypes {
-        release {
-            // TODO: Add your own signing config for the release build.
-            // Signing with the debug keys for now, so `flutter run --release` works.
-            signingConfig signingConfigs.debug
-        }
-    }
-}
-
-flutter {
-    source '../..'
-}
-
-dependencies {
-    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlin_version"
-    testImplementation 'junit:junit:4.12'
-    androidTestImplementation 'androidx.test:runner:1.1.1'
-    androidTestImplementation 'androidx.test.espresso:espresso-core:3.1.1'
-}
```

**File**: `built_redux/android/app/src/debug/AndroidManifest.xml` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-<manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.built_redux">
-    <!-- Flutter needs it to communicate with the running application
-         to allow setting breakpoints, to provide hot reload, etc.
-    -->
-    <uses-permission android:name="android.permission.INTERNET"/>
-</manifest>
```

**File**: `built_redux/android/app/src/main/AndroidManifest.xml` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-<manifest xmlns:android="http://schemas.android.com/apk/res/android"
-    package="com.example.built_redux">
-    <!-- io.flutter.app.FlutterApplication is an android.app.Application that
-         calls FlutterMain.startInitialization(this); in its onCreate method.
-         In most cases you can leave this as-is, but you if you want to provide
-         additional functionality it is fine to subclass or reimplement
-         FlutterApplication and put your custom class here. -->
-    <application
-        android:name="io.flutter.app.FlutterApplication"
-        android:label="built_redux"
-        android:icon="@mipmap/ic_launcher">
-        <activity
-            android:name=".MainActivity"
-            android:launchMode="singleTop"
-            android:theme="@style/LaunchTheme"
-            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
-            android:hardwareAccelerated="true"
-            android:windowSoftInputMode="adjustResize">
-            <intent-filter>
-                <action android:name="android.intent.action.MAIN"/>
-                <category android:name="android.intent.category.LAUNCHER"/>
-            </intent-filter>
-        </activity>
-        <!-- Don't delete the meta-data below.
-             This is used by the Flutter tool to generate GeneratedPluginRegistrant.java -->
-        <meta-data
-            android:name="flutterEmbedding"
-            android:value="2" />
-    </application>
-</manifest>
```

---

### Incident Patch 12: `c0c47e5b` (2025-09-03)
**Commit Message**: Fix analysis error for mobx sample

**File**: `mobx/lib/home/todo_list_view.dart` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ class TodoListView extends StatelessWidget {
                 onTap: () {
                   Navigator.push(
                     context,
-                    MaterialPageRoute(
+                    MaterialPageRoute<void>(
                       builder: (_) {
                         return DetailsScreen(
                           todo: todo,
```

---

### Incident Patch 13: `73e7848b` (2025-09-03)
**Commit Message**: Mobx sample small style fix

**File**: `mobx/lib/add_todo_screen.dart` (modified, +4/-2)
```diff
@@ -5,8 +5,10 @@ import 'package:todos_app_core/todos_app_core.dart';
 class AddTodoScreen extends StatefulWidget {
   final void Function(Todo) onAdd;
 
-  const AddTodoScreen({required this.onAdd})
-    : super(key: ArchSampleKeys.addTodoScreen);
+  const AddTodoScreen({
+    super.key = ArchSampleKeys.addTodoScreen,
+    required this.onAdd,
+  });
 
   @override
   AddTodoScreenState createState() => AddTodoScreenState();
```

---

### Incident Patch 14: `be3ffe45` (2025-07-09)
**Commit Message**: Revert "Try usin just codecov"

This reverts commit 527ceef3847e72cc42327da6566e7f87e8d40cbd.

**File**: `.github/workflows/static_analysis_and_tests.yml` (modified, +50/-2)
```diff
@@ -42,12 +42,60 @@ jobs:
         uses: ./.github/actions/flutter_analysis_and_tests
         with:
           working-directory: ./inherited_widget
-  combine_and_upload_coverage:
-    name: Combine and Upload Code Coverage
+  read_coverage:
+    name: Read Combined Coverage Files
     runs-on: ubuntu-latest
     needs: [todos_repository_local_storage, vanilla, inherited_widget]
     steps:
+      - name: Checkout repository
+        uses: actions/checkout@v4
+      - name: Download coverage artifacts
+        uses: actions/download-artifact@v4
+        with:
+          path: .
+      - name: Combine coverage files
+        run: |
+          combineCoverage() {
+            local artifact_dir=$1
+            local repo_dir=$2
+            # Extract the package directory path from the artifact name
+            # coverage-lcov-vanilla -> ./vanilla
+            local package_name=$(basename "$artifact_dir")
+            local package_dir="./${package_name#coverage-lcov-}"
+            escapedPath="$(echo $package_dir | sed 's/\//\\\//g')"
+            
+            if [[ -d "$artifact_dir" ]]; then
+              # Find the lcov.info file in the artifact directory
+              for lcov_file in "$artifact_dir"/*.info; do
+                if [[ -f "$lcov_file" ]]; then
+                  echo "Combining coverage from $package_dir"
+                  # combine line coverage info from package tests to a common file
+                  sed "s/^SF:lib/SF:$escapedPath\/lib/g" "$lcov_file" >> "$repo_dir/lcov.info"
+                  break
+                fi
+              done
+            fi
+          }
+
+          # Initialize the combined coverage file
+          touch lcov.info
+
+          # Combine coverage from all downloaded artifacts
+          for artifact_dir in coverage-lcov-*/; do
+            if [[ -d "$artifact_dir" ]]; then
+              combineCoverage "$artifact_dir" "."
+            fi
+          done
+
+          echo "Combined coverage file created:"
+          ls -la lcov.info
+          echo "First few lines of combined coverage:"
+          head -10 lcov.info
+
       - name: Upload coverage to Codecov
         uses: codecov/codecov-action@v5
+        with:
+          files: ./lcov.info
+          disable_search: true
         env:
           CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}
```

---

### Incident Patch 15: `fcd5d7f7` (2025-07-09)
**Commit Message**: Revert "Fix codecov only solution"

This reverts commit 55a5a797c064b98749b2f1a410d1bd6e9e723767.

**File**: `.github/workflows/static_analysis_and_tests.yml` (modified, +0/-6)
```diff
@@ -47,12 +47,6 @@ jobs:
     runs-on: ubuntu-latest
     needs: [todos_repository_local_storage, vanilla, inherited_widget]
     steps:
-      - name: Checkout repository
-        uses: actions/checkout@v4
-      - name: Download coverage artifacts
-        uses: actions/download-artifact@v4
-        with:
-          path: .
       - name: Upload coverage to Codecov
         uses: codecov/codecov-action@v5
         env:
```

#### Recent Merged Pull Requests:
- **PR #215** (2025-09-07): Upgrade most samples to Flutter 3.35.2 (@brianegan)
- **PR #178** (closed): Test change notifier provider (@sksenapati007)
- **PR #177** (2020-03-04): Fix ValueNotifierProvider memory leak (@mono0926)
- **PR #176** (2020-02-20): ChangeNotifierProviderSample updates (@brianegan)
- **PR #174** (2020-02-20): Freezed sample (@rrousselGit)
- **PR #172** (2020-01-14): states_rebuilder sample (@GIfatahTH)
- **PR #170** (2020-01-11): Add Web support to samples (@brianegan)
- **PR #168** (2020-01-11): Provider sample (@brianegan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
