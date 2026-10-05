# Forensic Learning Record (Deep Inspection): brianegan/flutter_architecture_samples

> **Canonical Artifact**: `07_PROJECT_LEARNING/brianegan-flutter_architecture_samples-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/brianegan/flutter_architecture_samples](https://github.com/brianegan/flutter_architecture_samples))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:29:10.521Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `brianegan/flutter_architecture_samples`
- **Description**: TodoMVC for Flutter
- **Primary Language / Ecosystem**: Dart
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8929 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bloc_flutter/ios/Runner/Runner-Bridging-Header.h`
```
#import "GeneratedPluginRegistrant.h"

```

### Core Architecture Module: `bloc_flutter/linux/flutter/generated_plugin_registrant.h`
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

### Core Architecture Module: `bloc_flutter/linux/runner/my_application.h`
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

### Core Architecture Module: `bloc_flutter/windows/flutter/generated_plugin_registrant.h`
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

### Core Architecture Module: `bloc_flutter/windows/runner/flutter_window.cpp`
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

  // Flutter can complete the first frame before the "show window" callback is
  // registered. The following call ensures a frame is pending to ensure the
  // window is shown. It is a no-op if the first frame hasn't completed yet.
  flutter_controller_->ForceRedraw();

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

### Core Architecture Module: `bloc_flutter/windows/runner/flutter_window.h`
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

### Core Architecture Module: `bloc_flutter/windows/runner/main.cpp`
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
  if (!window.Create(L"bloc_flutter_sample", origin, size)) {
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

### Core Architecture Module: `bloc_flutter/windows/runner/resource.h`
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

### Incident Patch 1: `0ca62ee8` (2025-09-07)
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

### Incident Patch 2: `0b7abb42` (2025-09-07)
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

---

### Incident Patch 3: `8b454331` (2025-09-04)
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
+   
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

---

### Incident Patch 4: `f8532710` (2025-09-04)
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

### Incident Patch 5: `4be72efe` (2025-09-04)
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

### Incident Patch 6: `7a24814d` (2025-09-04)
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

### Incident Patch 7: `7b87f1dc` (2025-09-04)
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

### Incident Patch 8: `12e4f027` (2025-09-04)
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

### Incident Patch 9: `c0c47e5b` (2025-09-03)
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

### Incident Patch 10: `73e7848b` (2025-09-03)
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
