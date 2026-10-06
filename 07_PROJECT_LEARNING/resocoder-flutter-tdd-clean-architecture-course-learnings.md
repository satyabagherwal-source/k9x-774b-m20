# Forensic Learning Record (Deep Inspection): ResoCoder/flutter-tdd-clean-architecture-course

> **Canonical Artifact**: `07_PROJECT_LEARNING/resocoder-flutter-tdd-clean-architecture-course-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ResoCoder/flutter-tdd-clean-architecture-course](https://github.com/ResoCoder/flutter-tdd-clean-architecture-course))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:33:33.466Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ResoCoder/flutter-tdd-clean-architecture-course`
- **Description**: 
- **Primary Language / Ecosystem**: Dart
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2150 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/app/src/main/kotlin/com/resocoder/clean_architecture_tdd_course/MainActivity.kt`
```
package com.resocoder.clean_architecture_tdd_course

import android.os.Bundle

import io.flutter.app.FlutterActivity
import io.flutter.plugins.GeneratedPluginRegistrant

class MainActivity: FlutterActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    GeneratedPluginRegistrant.registerWith(this)
  }
}

```

### Core Architecture Module: `ios/Runner/AppDelegate.swift`
```
import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplicationLaunchOptionsKey: Any]?
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #50** (2022-10-16): **manurueda/master**
  *Symptoms*: Fix for Flutter 3+
  **Post-Mortem & Fix Analysis**:
  > @manurueda I've made some fixes for Flutter 3. You can check #52 or this fork: https://github.com/dersonmutemba/flutter-tdd-clean-architecture-course

- **Issue #46** (2021-11-05): **6-repository-implementation**
  *Symptoms*: ![Снимок экрана 2021-11-01 в 15 08 55](https://user-images.githubusercontent.com/32243762/139655888-84e176fc-99b4-49ec-b6dd-2ea158867f3d.png) 

- **Issue #43** (2022-12-02): **Updated to work fine with Flutter 2**
  *Symptoms*: 

- **Issue #40** (2023-06-08): **type 'Null' is not a subtype of type 'Future<Either<Failure, LocalUser>>'**
  *Symptoms*: I just changed a few things here and there and I encountered this weird problem and solution.  Full details here :- https://stackoverflow.com/questions/67443531/flutter-using-async-in-testing-produces-an-error-but-using-async-made-it-work
  **Post-Mortem & Fix Analysis**:
  > If you're using Flutter 2:  - Upgrade dartz to ns prerelease: 0.10.0-nullsafety.2 - And replace mockito with [mocktail](https://pub.dev/packages/mocktail).
  > I found the solution, which is suprising easy and I'm stupid. I havent tried using mocktail yet but using mockito is still perfectly fine as well. I just didnt generate Mock classes as stated in the mockito docs to support null safety. I also explained in the stackoverflow posts
  > This problem is about the Mockito version (not null safety). Upgrade your version to ^5.0.0. More about Mockito and null safety you can read [here (Mockito - NULL_SAFETY_README)](https://github.com/dart-lang/mockito/blob/master/NULL_SAFETY_README.md)   You can try mocktail as well, the example below.        when(() => mockNumberTriviaRepository.getConcreteNumberTrivia(tNumber))         .thenAnswer((_) async => Right(tNumberTrivia));          final result = await usecase.execute(number: tNumber);         expect(result, equal(Right(tNumberTrivia)));         verify(() => mockNumberTriviaRepository.getConcreteNumberTrivia(tNumber));         verifyNoMoreInteractions(mockNumberTriviaRepository);                         

- **Issue #39** (2021-05-06): **Allow insecure connections**
  *Symptoms*: The API endpoints are insecure therefore additional flag is required.

- **Issue #35** (2022-04-14): **Initialization Database f.e. SQLite**
  *Symptoms*: In which layer initialization database should be done ?

- **Issue #33** (2022-04-01): **Update number_trivia_local_data_source_test.dart**
  *Symptoms*: TypeMatcher is deprecated after Flutter v1.12.1.  instanceOf fixes that problem.  The Link: https://api.flutter.dev/flutter/widgets/TypeMatcher-class.html

- **Issue #32** (2020-10-27): **Got Error Expected: Actual**
  *Symptoms*: ![image](https://user-images.githubusercontent.com/35004114/97286928-8fa38d00-1876-11eb-93ba-10f55620e683.png)  i got error  `fromJson should return a valid model when the JSON number is an integer:  ERROR: Expected: NumberTriviaModel:<NumberTriviaModel>   Actual: NumberTriviaModel:<NumberTriviaModel>  package:test_api                                                            expect package:flutter_test/src/widget_tester.dart 431:3                           expect test\features\number_trivia\data\models\number_trivia_model_test.dart 30:9  main.<fn>.<fn>`  how to Resolve this ? 
  **Post-Mortem & Fix Analysis**:
  > Got it because `trivia.json` must be same at NumberTriviaModel
  > I got same error, but I don't undestand how to fix it ![Снимок экрана (69)](https://user-images.githubusercontent.com/72309553/221945649-6c830b24-dafa-40cd-a5b0-a390bafb1348.png) 

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

### Incident Patch 1: `6c515614` (2019-12-29)
**Commit Message**: Added architecture proposal to README

**File**: `README.md` (modified, +4/-2)
```diff
@@ -6,9 +6,11 @@
 
 <br />
 
-### Architecture Proposal
+<h3 align="center">Architecture Proposal</h3>
 
-[proposal picture](./architecture-proposal.png)
+<br />
+
+<img src="./architecture-proposal.png" style="display: block; margin-left: auto; margin-right: auto; width: 75%;"/>
 
 <br />
 <br />
```

---

### Incident Patch 2: `23a58647` (2019-12-29)
**Commit Message**: Updated to work with the latest package versions

**File**: `.flutter-plugins-dependencies` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"_info":"// This is a generated file; do not edit or check into version control.","dependencyGraph":[{"name":"shared_preferences","dependencies":["shared_preferences_macos","shared_preferences_web"]},{"name":"shared_preferences_macos","dependencies":[]},{"name":"shared_preferences_web","dependencies":[]}]}
\ No newline at end of file
```

**File**: `.vscode/settings.json` (removed, +0/-6)
```diff
@@ -1,6 +0,0 @@
-{
-  "editor.fontSize": 18,
-  "window.zoomLevel": 2,
-  "debug.console.fontSize": 18,
-  "terminal.integrated.fontSize": 18
-}
\ No newline at end of file
```

**File**: `README.md` (modified, +16/-1)
```diff
@@ -1,3 +1,18 @@
 # TDD Clean Architecture for Flutter
 
-Learn from the [tutorial series](https://resocoder.com/category/tutorials/flutter/tdd-clean-architecture/) on Reso Coder.
+### The whole accompanying tutorial series is available at :point_right: [this link](https://resocoder.com/flutter-clean-architecture-tdd/) :point_left:.
+
+#### _Find more tutorials on [resocoder.com](https://resocoder.com)_
+
+<br />
+
+### Architecture Proposal
+
+[proposal picture](./architecture-proposal.png)
+
+<br />
+<br />
+
+[![Reso Coder](https://resocoder.com/wp-content/uploads/2019/09/logo_with_text_signature.png)](https://resocoder.com)
+<br />
+_Be prepared for **real** app development_
```

**File**: `android/gradle.properties` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
 org.gradle.jvmargs=-Xmx1536M
 
+android.enableR8=true
```

**File**: `ios/Flutter/flutter_export_environment.sh` (modified, +5/-5)
```diff
@@ -1,10 +1,10 @@
 #!/bin/sh
 # This is a generated file; do not edit or check into version control.
-export "FLUTTER_ROOT=/home/reso/Development/flutter"
-export "FLUTTER_APPLICATION_PATH=/home/reso/Development/Projects/flutter_tutorials/clean_architecture_tdd_course"
-export "FLUTTER_TARGET=lib/main.dart"
+export "FLUTTER_ROOT=C:\Flutter\flutter"
+export "FLUTTER_APPLICATION_PATH=D:\Projects\Playground_and_Learning\flutter-tdd-clean-architecture-course"
+export "FLUTTER_TARGET=lib\main.dart"
 export "FLUTTER_BUILD_DIR=build"
-export "SYMROOT=${SOURCE_ROOT}/../build/ios"
-export "FLUTTER_FRAMEWORK_DIR=/home/reso/Development/flutter/bin/cache/artifacts/engine/ios"
+export "SYMROOT=${SOURCE_ROOT}/../build\ios"
+export "FLUTTER_FRAMEWORK_DIR=C:\Flutter\flutter\bin\cache\artifacts\engine\ios"
 export "FLUTTER_BUILD_NAME=1.0.0"
 export "FLUTTER_BUILD_NUMBER=1"
```

**File**: `lib/core/error/failures.dart` (modified, +2/-1)
```diff
@@ -1,7 +1,8 @@
 import 'package:equatable/equatable.dart';
 
 abstract class Failure extends Equatable {
-  Failure([List properties = const <dynamic>[]]) : super(properties);
+  @override
+  List<Object> get props => [];
 }
 
 // General failures
```

**File**: `lib/core/usecases/usecase.dart` (modified, +4/-1)
```diff
@@ -7,4 +7,7 @@ abstract class UseCase<Type, Params> {
   Future<Either<Failure, Type>> call(Params params);
 }
 
-class NoParams extends Equatable {}
+class NoParams extends Equatable {
+  @override
+  List<Object> get props => [];
+}
```

**File**: `lib/features/number_trivia/domain/entities/number_trivia.dart` (modified, +4/-1)
```diff
@@ -8,5 +8,8 @@ class NumberTrivia extends Equatable {
   NumberTrivia({
     @required this.text,
     @required this.number,
-  }) : super([text, number]);
+  });
+
+  @override
+  List<Object> get props => [text, number];
 }
```

---

### Incident Patch 3: `8b5cb645` (2019-09-23)
**Commit Message**: 14 - User Interface

**File**: `lib/features/number_trivia/presentation/pages/number_trivia_page.dart` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import 'package:clean_architecture_tdd_course/features/number_trivia/presentation/bloc/bloc.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/presentation/bloc/number_trivia_bloc.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/presentation/widgets/widgets.dart';
+import 'package:flutter/material.dart';
+import 'package:flutter_bloc/flutter_bloc.dart';
+
+import '../../../../injection_container.dart';
+
+class NumberTriviaPage extends StatelessWidget {
+  @override
+  Widget build(BuildContext context) {
+    return Scaffold(
+      appBar: AppBar(
+        title: Text('Number Trivia'),
+      ),
+      body: SingleChildScrollView(
+        child: buildBody(context),
+      ),
+    );
+  }
+
+  BlocProvider<NumberTriviaBloc> buildBody(BuildContext context) {
+    return BlocProvider(
+      builder: (_) => sl<NumberTriviaBloc>(),
+      child: Center(
+        child: Padding(
+          padding: const EdgeInsets.all(10),
+          child: Column(
+            children: <Widget>[
+              SizedBox(height: 10),
+              // Top half
+              BlocBuilder<NumberTriviaBloc, NumberTriviaState>(
+                builder: (context, state) {
+                  if (state is Empty) {
+                    return MessageDisplay(
+                      message: 'Start searching!',
+                    );
+                  } else if (state is Loading) {
+                    return LoadingWidget();
+                  } else if (state is Loaded) {
+                    return TriviaDisplay(numberTrivia: state.trivia);
+                  } else if (state is Error) {
+                    return MessageDisplay(
+                      message: state.message,
+                    );
+                  }
+                },
+              ),
+              SizedBox(height: 20),
+              // Bottom half
+              TriviaControls()
+            ],
+          ),
+        ),
+      ),
+    );
+  }
+}
```

**File**: `lib/features/number_trivia/presentation/widgets/loading_widget.dart` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import 'package:flutter/material.dart';
+
+class LoadingWidget extends StatelessWidget {
+  const LoadingWidget({
+    Key key,
+  }) : super(key: key);
+
+  @override
+  Widget build(BuildContext context) {
+    return Container(
+      height: MediaQuery.of(context).size.height / 3,
+      child: Center(
+        child: CircularProgressIndicator(),
+      ),
+    );
+  }
+}
```

**File**: `lib/features/number_trivia/presentation/widgets/message_display.dart` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import 'package:flutter/material.dart';
+
+class MessageDisplay extends StatelessWidget {
+  final String message;
+
+  const MessageDisplay({
+    Key key,
+    @required this.message,
+  }) : super(key: key);
+
+  @override
+  Widget build(BuildContext context) {
+    return Container(
+      height: MediaQuery.of(context).size.height / 3,
+      child: Center(
+        child: SingleChildScrollView(
+          child: Text(
+            message,
+            style: TextStyle(fontSize: 25),
+            textAlign: TextAlign.center,
+          ),
+        ),
+      ),
+    );
+  }
+}
```

**File**: `lib/features/number_trivia/presentation/widgets/trivia_controls.dart` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+import 'package:clean_architecture_tdd_course/features/number_trivia/presentation/bloc/bloc.dart';
+import 'package:flutter/material.dart';
+import 'package:flutter_bloc/flutter_bloc.dart';
+
+class TriviaControls extends StatefulWidget {
+  const TriviaControls({
+    Key key,
+  }) : super(key: key);
+
+  @override
+  _TriviaControlsState createState() => _TriviaControlsState();
+}
+
+class _TriviaControlsState extends State<TriviaControls> {
+  final controller = TextEditingController();
+  String inputStr;
+
+  @override
+  Widget build(BuildContext context) {
+    return Column(
+      children: <Widget>[
+        TextField(
+          controller: controller,
+          keyboardType: TextInputType.number,
+          decoration: InputDecoration(
+            border: OutlineInputBorder(),
+            hintText: 'Input a number',
+          ),
+          onChanged: (value) {
+            inputStr = value;
+          },
+          onSubmitted: (_) {
+            dispatchConcrete();
+          },
+        ),
+        SizedBox(height: 10),
+        Row(
+          children: <Widget>[
+            Expanded(
+              child: RaisedButton(
+                child: Text('Search'),
+                color: Theme.of(context).accentColor,
+                textTheme: ButtonTextTheme.primary,
+                onPressed: dispatchConcrete,
+              ),
+            ),
+            SizedBox(width: 10),
+            Expanded(
+              child: RaisedButton(
+                child: Text('Get random trivia'),
+                onPressed: dispatchRandom,
+              ),
+            ),
+          ],
+        )
+      ],
+    );
+  }
+
+  void dispatchConcrete() {
+    controller.clear();
+    BlocProvider.of<NumberTriviaBloc>(context)
+        .dispatch(GetTriviaForConcreteNumber(inputStr));
+  }
+
+  void dispatchRandom() {
+    controller.clear();
+    BlocProvider.of<NumberTriviaBloc>(context)
+        .dispatch(GetTriviaForRandomNumber());
+  }
+}
```

**File**: `lib/features/number_trivia/presentation/widgets/trivia_display.dart` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import 'package:clean_architecture_tdd_course/features/number_trivia/domain/entities/number_trivia.dart';
+import 'package:flutter/material.dart';
+
+class TriviaDisplay extends StatelessWidget {
+  final NumberTrivia numberTrivia;
+
+  const TriviaDisplay({
+    Key key,
+    @required this.numberTrivia,
+  }) : super(key: key);
+
+  @override
+  Widget build(BuildContext context) {
+    return Container(
+      height: MediaQuery.of(context).size.height / 3,
+      child: Column(
+        children: <Widget>[
+          Text(
+            numberTrivia.number.toString(),
+            style: TextStyle(fontSize: 50, fontWeight: FontWeight.bold),
+          ),
+          Expanded(
+            child: Center(
+              child: SingleChildScrollView(
+                child: Text(
+                  numberTrivia.text,
+                  style: TextStyle(fontSize: 25),
+                  textAlign: TextAlign.center,
+                ),
+              ),
+            ),
+          ),
+        ],
+      ),
+    );
+  }
+}
```

**File**: `lib/features/number_trivia/presentation/widgets/widgets.dart` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+export 'loading_widget.dart';
+export 'message_display.dart';
+export 'trivia_display.dart';
+export 'trivia_controls.dart';
```

**File**: `lib/main.dart` (modified, +5/-98)
```diff
@@ -1,4 +1,5 @@
 import 'package:flutter/material.dart';
+import 'features/number_trivia/presentation/pages/number_trivia_page.dart';
 import 'injection_container.dart' as di;
 
 void main() async {
@@ -7,109 +8,15 @@ void main() async {
 }
 
 class MyApp extends StatelessWidget {
-  // This widget is the root of your application.
   @override
   Widget build(BuildContext context) {
     return MaterialApp(
-      title: 'Flutter Demo',
+      title: 'Number Trivia',
       theme: ThemeData(
-        // This is the theme of your application.
-        //
-        // Try running your application with "flutter run". You'll see the
-        // application has a blue toolbar. Then, without quitting the app, try
-        // changing the primarySwatch below to Colors.green and then invoke
-        // "hot reload" (press "r" in the console where you ran "flutter run",
-        // or simply save your changes to "hot reload" in a Flutter IDE).
-        // Notice that the counter didn't reset back to zero; the application
-        // is not restarted.
-        primarySwatch: Colors.blue,
+        primaryColor: Colors.green.shade800,
+        accentColor: Colors.green.shade600,
       ),
-      home: MyHomePage(title: 'Flutter Demo Home Page'),
-    );
-  }
-}
-
-class MyHomePage extends StatefulWidget {
-  MyHomePage({Key key, this.title}) : super(key: key);
-
-  // This widget is the home page of your application. It is stateful, meaning
-  // that it has a State object (defined below) that contains fields that affect
-  // how it looks.
-
-  // This class is the configuration for the state. It holds the values (in this
-  // case the title) provided by the parent (in this case the App widget) and
-  // used by the build method of the State. Fields in a Widget subclass are
-  // always marked "final".
-
-  final String title;
-
-  @override
-  _MyHomePageState createState() => _MyHomePageState();
-}
-
-class _MyHomePageState extends State<MyHomePage> {
-  int _counter = 0;
-
-  void _incrementCounter() {
-    setState(() {
-      // This call to setState tells the Flutter framework that something has
-      // changed in this State, which causes it to rerun the build method below
-      // so that the display can reflect the updated values. If we changed
-      // _counter without calling setState(), then the build method would not be
-      // called again, and so nothing would appear to happen.
-      _counter++;
-    });
-  }
-
-  @override
-  Widget build(BuildContext context) {
-    // This method is rerun every time setState is called, for instance as done
-    // by the _incrementCounter method above.
-    //
-    // The Flutter framework has been optimized to make rerunning build methods
-    // fast, so that you can just rebuild anything that needs updating rather
-    // than having to individually change instances of widgets.
-    return Scaffold(
-      appBar: AppBar(
-        // Here we take the value from the MyHomePage object that was created by
-        // the App.build method, and use it to set our appbar title.
-        title: Text(widget.title),
-      ),
-      body: Center(
-        // Center is a layout widget. It takes a single child and positions it
-        // in the middle of the parent.
-        child: Column(
-          // Column is also layout widget. It takes a list of children and
-          // arranges them vertically. By default, it sizes itself to fit its
-          // children horizontally, and tries to be as tall as its parent.
-          //
-          // Invoke "debug painting" (press "p" in the console, choose the
-          // "Toggle Debug Paint" action from the Flutter Inspector in Android
-          // Studio, or the "Toggle Debug Paint" command in Visual Studio Code)
-          // to see the wireframe for each widget.
-          //
-          // Column has various properties to control how it sizes itself and
-          // how it positions its children. Here we use mainAxisAlignment to
-          // center the children vertically; the main axis here is the vertical
-          // axis because Columns are vertical (the cross axis would be
-          // horizontal).
-          mainAxisAlignment: MainAxisAlignment.center,
-          children: <Widget>[
-            Text(
-              'You have pushed the button this many times:',
-            ),
-            Text(
-              '$_counter',
-              style: Theme.of(context).textTheme.display1,
-            ),
-          ],
-        ),
-      ),
-      floatingActionButton: FloatingActionButton(
-        onPressed: _incrementCounter,
-        tooltip: 'Increment',
-        child: Icon(Icons.add),
-      ), // This trailing comma makes auto-formatting nicer for build methods.
+      home: NumberTriviaPage(),
     );
   }
 }
```

---

### Incident Patch 4: `ff61e41e` (2019-09-23)
**Commit Message**: 13 - Dependency Injection

**File**: `lib/injection_container.dart` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import 'package:data_connection_checker/data_connection_checker.dart';
+import 'package:get_it/get_it.dart';
+import 'package:http/http.dart' as http;
+import 'package:shared_preferences/shared_preferences.dart';
+
+import 'core/network/network_info.dart';
+import 'core/util/input_converter.dart';
+import 'features/number_trivia/data/datasources/number_trivia_local_data_source.dart';
+import 'features/number_trivia/data/datasources/number_trivia_remote_data_source.dart';
+import 'features/number_trivia/data/repositories/number_trivia_repository_impl.dart';
+import 'features/number_trivia/domain/repositories/number_trivia_repository.dart';
+import 'features/number_trivia/domain/usecases/get_concrete_number_trivia.dart';
+import 'features/number_trivia/domain/usecases/get_random_number_trivia.dart';
+import 'features/number_trivia/presentation/bloc/number_trivia_bloc.dart';
+
+final sl = GetIt.instance;
+
+Future<void> init() async {
+  //! Features - Number Trivia
+  // Bloc
+  sl.registerFactory(
+    () => NumberTriviaBloc(
+      concrete: sl(),
+      inputConverter: sl(),
+      random: sl(),
+    ),
+  );
+
+  // Use cases
+  sl.registerLazySingleton(() => GetConcreteNumberTrivia(sl()));
+  sl.registerLazySingleton(() => GetRandomNumberTrivia(sl()));
+
+  // Repository
+  sl.registerLazySingleton<NumberTriviaRepository>(
+    () => NumberTriviaRepositoryImpl(
+      localDataSource: sl(),
+      networkInfo: sl(),
+      remoteDataSource: sl(),
+    ),
+  );
+
+  // Data sources
+  sl.registerLazySingleton<NumberTriviaRemoteDataSource>(
+    () => NumberTriviaRemoteDataSourceImpl(client: sl()),
+  );
+
+  sl.registerLazySingleton<NumberTriviaLocalDataSource>(
+    () => NumberTriviaLocalDataSourceImpl(sharedPreferences: sl()),
+  );
+
+  //! Core
+  sl.registerLazySingleton(() => InputConverter());
+  sl.registerLazySingleton<NetworkInfo>(() => NetworkInfoImpl(sl()));
+
+  //! External
+  final sharedPreferences = await SharedPreferences.getInstance();
+  sl.registerLazySingleton(() => sharedPreferences);
+  sl.registerLazySingleton(() => http.Client());
+  sl.registerLazySingleton(() => DataConnectionChecker());
+}
```

**File**: `lib/main.dart` (modified, +5/-1)
```diff
@@ -1,6 +1,10 @@
 import 'package:flutter/material.dart';
+import 'injection_container.dart' as di;
 
-void main() => runApp(MyApp());
+void main() async {
+  await di.init();
+  runApp(MyApp());
+}
 
 class MyApp extends StatelessWidget {
   // This widget is the root of your application.
```

---

### Incident Patch 5: `a162444f` (2019-09-21)
**Commit Message**: 12 - Bloc Implementation 2/2

**File**: `lib/features/number_trivia/presentation/bloc/number_trivia_bloc.dart` (modified, +34/-1)
```diff
@@ -1,6 +1,10 @@
 import 'dart:async';
 
 import 'package:bloc/bloc.dart';
+import 'package:clean_architecture_tdd_course/core/error/failures.dart';
+import 'package:clean_architecture_tdd_course/core/usecases/usecase.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/domain/entities/number_trivia.dart';
+import 'package:dartz/dartz.dart';
 import 'package:meta/meta.dart';
 
 import './bloc.dart';
@@ -43,8 +47,37 @@ class NumberTriviaBloc extends Bloc<NumberTriviaEvent, NumberTriviaState> {
         (failure) async* {
           yield Error(message: INVALID_INPUT_FAILURE_MESSAGE);
         },
-        (integer) => throw UnimplementedError(),
+        (integer) async* {
+          yield Loading();
+          final failureOrTrivia =
+              await getConcreteNumberTrivia(Params(number: integer));
+          yield* _eitherLoadedOrErrorState(failureOrTrivia);
+        },
       );
+    } else if (event is GetTriviaForRandomNumber) {
+      yield Loading();
+      final failureOrTrivia = await getRandomNumberTrivia(NoParams());
+      yield* _eitherLoadedOrErrorState(failureOrTrivia);
+    }
+  }
+
+  Stream<NumberTriviaState> _eitherLoadedOrErrorState(
+    Either<Failure, NumberTrivia> failureOrTrivia,
+  ) async* {
+    yield failureOrTrivia.fold(
+      (failure) => Error(message: _mapFailureToMessage(failure)),
+      (trivia) => Loaded(trivia: trivia),
+    );
+  }
+
+  String _mapFailureToMessage(Failure failure) {
+    switch (failure.runtimeType) {
+      case ServerFailure:
+        return SERVER_FAILURE_MESSAGE;
+      case CacheFailure:
+        return CACHE_FAILURE_MESSAGE;
+      default:
+        return 'Unexpected error';
     }
   }
 }
```

**File**: `test/features/number_trivia/presentation/bloc/number_trivia_bloc_test.dart` (modified, +151/-2)
```diff
@@ -1,3 +1,5 @@
+import 'package:clean_architecture_tdd_course/core/error/failures.dart';
+import 'package:clean_architecture_tdd_course/core/usecases/usecase.dart';
 import 'package:clean_architecture_tdd_course/core/util/input_converter.dart';
 import 'package:clean_architecture_tdd_course/features/number_trivia/domain/entities/number_trivia.dart';
 import 'package:clean_architecture_tdd_course/features/number_trivia/domain/usecases/get_concrete_number_trivia.dart';
@@ -42,12 +44,15 @@ void main() {
     final tNumberParsed = 1;
     final tNumberTrivia = NumberTrivia(number: 1, text: 'test trivia');
 
+    void setUpMockInputConverterSuccess() =>
+        when(mockInputConverter.stringToUnsignedInteger(any))
+            .thenReturn(Right(tNumberParsed));
+
     test(
       'should call the InputConverter to validate and convert the string to an unsigned integer',
       () async {
         // arrange
-        when(mockInputConverter.stringToUnsignedInteger(any))
-            .thenReturn(Right(tNumberParsed));
+        setUpMockInputConverterSuccess();
         // act
         bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
         await untilCalled(mockInputConverter.stringToUnsignedInteger(any));
@@ -72,5 +77,149 @@ void main() {
         bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
       },
     );
+
+    test(
+      'should get data from the concrete use case',
+      () async {
+        // arrange
+        setUpMockInputConverterSuccess();
+        when(mockGetConcreteNumberTrivia(any))
+            .thenAnswer((_) async => Right(tNumberTrivia));
+        // act
+        bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
+        await untilCalled(mockGetConcreteNumberTrivia(any));
+        // assert
+        verify(mockGetConcreteNumberTrivia(Params(number: tNumberParsed)));
+      },
+    );
+
+    test(
+      'should emit [Loading, Loaded] when data is gotten successfully',
+      () async {
+        // arrange
+        setUpMockInputConverterSuccess();
+        when(mockGetConcreteNumberTrivia(any))
+            .thenAnswer((_) async => Right(tNumberTrivia));
+        // assert later
+        final expected = [
+          Empty(),
+          Loading(),
+          Loaded(trivia: tNumberTrivia),
+        ];
+        expectLater(bloc.state, emitsInOrder(expected));
+        // act
+        bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
+      },
+    );
+
+    test(
+      'should emit [Loading, Error] when getting data fails',
+      () async {
+        // arrange
+        setUpMockInputConverterSuccess();
+        when(mockGetConcreteNumberTrivia(any))
+            .thenAnswer((_) async => Left(ServerFailure()));
+        // assert later
+        final expected = [
+          Empty(),
+          Loading(),
+          Error(message: SERVER_FAILURE_MESSAGE),
+        ];
+        expectLater(bloc.state, emitsInOrder(expected));
+        // act
+        bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
+      },
+    );
+
+    test(
+      'should emit [Loading, Error] with a proper message for the error when getting data fails',
+      () async {
+        // arrange
+        setUpMockInputConverterSuccess();
+        when(mockGetConcreteNumberTrivia(any))
+            .thenAnswer((_) async => Left(CacheFailure()));
+        // assert later
+        final expected = [
+          Empty(),
+          Loading(),
+          Error(message: CACHE_FAILURE_MESSAGE),
+        ];
+        expectLater(bloc.state, emitsInOrder(expected));
+        // act
+        bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
+      },
+    );
+  });
+
+  group('GetTriviaForRandomNumber', () {
+    final tNumberTrivia = NumberTrivia(number: 1, text: 'test trivia');
+
+    test(
+      'should get data from the random use case',
+      () async {
+        // arrange
+        when(mockGetRandomNumberTrivia(any))
+            .thenAnswer((_) async => Right(tNumberTrivia));
+        // act
+        bloc.dispatch(GetTriviaForRandomNumber());
+        await untilCalled(mockGetRandomNumberTrivia(any));
+        // assert
+        verify(mockGetRandomNumberTrivia(NoParams()));
+      },
+    );
+
+    test(
+      'should emit [Loading, Loaded] when data is gotten successfully',
+      () async {
+        // arrange
+        when(mockGetRandomNumberTrivia(any))
+            .thenAnswer((_) async => Right(tNumberTrivia));
+        // assert later
+        final expected = [
+          Empty(),
+          Loading(),
+          Loaded(trivia: tNumberTrivia),
+        ];
+        expectLater(bloc.state, emitsInOrder(expected));
+        // act
+        bloc.dispatch(GetTriviaForRandomNumber());
+      },
+    );
+
+    test(
+      'should emit [Loading, Error] when getting data fails',
+      () async {
+        // arrange
+        when(mockGetRandomNumberTrivia(any))
+            .thenAnswer((_) async => Left(ServerFailure()));
+        // assert later
+        final expecte
```

---

### Incident Patch 6: `06b0595c` (2019-09-21)
**Commit Message**: 11 - Bloc Implementation 1/2

**File**: `lib/features/number_trivia/presentation/bloc/number_trivia_bloc.dart` (modified, +36/-1)
```diff
@@ -1,15 +1,50 @@
 import 'dart:async';
+
 import 'package:bloc/bloc.dart';
+import 'package:meta/meta.dart';
+
 import './bloc.dart';
+import '../../../../core/util/input_converter.dart';
+import '../../domain/usecases/get_concrete_number_trivia.dart';
+import '../../domain/usecases/get_random_number_trivia.dart';
+
+const String SERVER_FAILURE_MESSAGE = 'Server Failure';
+const String CACHE_FAILURE_MESSAGE = 'Cache Failure';
+const String INVALID_INPUT_FAILURE_MESSAGE =
+    'Invalid Input - The number must be a positive integer or zero.';
 
 class NumberTriviaBloc extends Bloc<NumberTriviaEvent, NumberTriviaState> {
+  final GetConcreteNumberTrivia getConcreteNumberTrivia;
+  final GetRandomNumberTrivia getRandomNumberTrivia;
+  final InputConverter inputConverter;
+
+  NumberTriviaBloc({
+    @required GetConcreteNumberTrivia concrete,
+    @required GetRandomNumberTrivia random,
+    @required this.inputConverter,
+  })  : assert(concrete != null),
+        assert(random != null),
+        assert(inputConverter != null),
+        getConcreteNumberTrivia = concrete,
+        getRandomNumberTrivia = random;
+
   @override
   NumberTriviaState get initialState => Empty();
 
   @override
   Stream<NumberTriviaState> mapEventToState(
     NumberTriviaEvent event,
   ) async* {
-    // TODO: Add Logic
+    if (event is GetTriviaForConcreteNumber) {
+      final inputEither =
+          inputConverter.stringToUnsignedInteger(event.numberString);
+
+      yield* inputEither.fold(
+        (failure) async* {
+          yield Error(message: INVALID_INPUT_FAILURE_MESSAGE);
+        },
+        (integer) => throw UnimplementedError(),
+      );
+    }
   }
 }
```

**File**: `test/features/number_trivia/presentation/bloc/number_trivia_bloc_test.dart` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import 'package:clean_architecture_tdd_course/core/util/input_converter.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/domain/entities/number_trivia.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/domain/usecases/get_concrete_number_trivia.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/domain/usecases/get_random_number_trivia.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/presentation/bloc/bloc.dart';
+import 'package:dartz/dartz.dart';
+import 'package:mockito/mockito.dart';
+import 'package:flutter_test/flutter_test.dart';
+
+class MockGetConcreteNumberTrivia extends Mock
+    implements GetConcreteNumberTrivia {}
+
+class MockGetRandomNumberTrivia extends Mock implements GetRandomNumberTrivia {}
+
+class MockInputConverter extends Mock implements InputConverter {}
+
+void main() {
+  NumberTriviaBloc bloc;
+  MockGetConcreteNumberTrivia mockGetConcreteNumberTrivia;
+  MockGetRandomNumberTrivia mockGetRandomNumberTrivia;
+  MockInputConverter mockInputConverter;
+
+  setUp(() {
+    mockGetConcreteNumberTrivia = MockGetConcreteNumberTrivia();
+    mockGetRandomNumberTrivia = MockGetRandomNumberTrivia();
+    mockInputConverter = MockInputConverter();
+
+    bloc = NumberTriviaBloc(
+      concrete: mockGetConcreteNumberTrivia,
+      random: mockGetRandomNumberTrivia,
+      inputConverter: mockInputConverter,
+    );
+  });
+
+  test('initialState should be Empty', () {
+    // assert
+    expect(bloc.initialState, equals(Empty()));
+  });
+
+  group('GetTriviaForConcreteNumber', () {
+    final tNumberString = '1';
+    final tNumberParsed = 1;
+    final tNumberTrivia = NumberTrivia(number: 1, text: 'test trivia');
+
+    test(
+      'should call the InputConverter to validate and convert the string to an unsigned integer',
+      () async {
+        // arrange
+        when(mockInputConverter.stringToUnsignedInteger(any))
+            .thenReturn(Right(tNumberParsed));
+        // act
+        bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
+        await untilCalled(mockInputConverter.stringToUnsignedInteger(any));
+        // assert
+        verify(mockInputConverter.stringToUnsignedInteger(tNumberString));
+      },
+    );
+
+    test(
+      'should emit [Error] when the input is invalid',
+      () async {
+        // arrange
+        when(mockInputConverter.stringToUnsignedInteger(any))
+            .thenReturn(Left(InvalidInputFailure()));
+        // assert later
+        final expected = [
+          Empty(),
+          Error(message: INVALID_INPUT_FAILURE_MESSAGE),
+        ];
+        expectLater(bloc.state, emitsInOrder(expected));
+        // act
+        bloc.dispatch(GetTriviaForConcreteNumber(tNumberString));
+      },
+    );
+  });
+}
```

---

### Incident Patch 7: `042daacf` (2019-09-12)
**Commit Message**: 10 - Bloc Scaffolding & Input Conversion

**File**: `lib/core/util/input_converter.dart` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import 'package:clean_architecture_tdd_course/core/error/failures.dart';
+import 'package:dartz/dartz.dart';
+
+class InputConverter {
+  Either<Failure, int> stringToUnsignedInteger(String str) {
+    try {
+      final integer = int.parse(str);
+      if (integer < 0) throw FormatException();
+      return Right(integer);
+    } on FormatException {
+      return Left(InvalidInputFailure());
+    }
+  }
+}
+
+class InvalidInputFailure extends Failure {}
```

**File**: `lib/features/number_trivia/presentation/bloc/bloc.dart` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+export 'number_trivia_bloc.dart';
+export 'number_trivia_event.dart';
+export 'number_trivia_state.dart';
```

**File**: `lib/features/number_trivia/presentation/bloc/number_trivia_bloc.dart` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import 'dart:async';
+import 'package:bloc/bloc.dart';
+import './bloc.dart';
+
+class NumberTriviaBloc extends Bloc<NumberTriviaEvent, NumberTriviaState> {
+  @override
+  NumberTriviaState get initialState => Empty();
+
+  @override
+  Stream<NumberTriviaState> mapEventToState(
+    NumberTriviaEvent event,
+  ) async* {
+    // TODO: Add Logic
+  }
+}
```

**File**: `lib/features/number_trivia/presentation/bloc/number_trivia_event.dart` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import 'package:equatable/equatable.dart';
+import 'package:meta/meta.dart';
+
+@immutable
+abstract class NumberTriviaEvent extends Equatable {
+  NumberTriviaEvent([List props = const <dynamic>[]]) : super(props);
+}
+
+class GetTriviaForConcreteNumber extends NumberTriviaEvent {
+  final String numberString;
+
+  GetTriviaForConcreteNumber(this.numberString) : super([numberString]);
+}
+
+class GetTriviaForRandomNumber extends NumberTriviaEvent {}
```

**File**: `lib/features/number_trivia/presentation/bloc/number_trivia_state.dart` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import 'package:clean_architecture_tdd_course/features/number_trivia/domain/entities/number_trivia.dart';
+import 'package:equatable/equatable.dart';
+import 'package:meta/meta.dart';
+
+@immutable
+abstract class NumberTriviaState extends Equatable {
+  NumberTriviaState([List props = const <dynamic>[]]) : super(props);
+}
+
+class Empty extends NumberTriviaState {}
+
+class Loading extends NumberTriviaState {}
+
+class Loaded extends NumberTriviaState {
+  final NumberTrivia trivia;
+
+  Loaded({@required this.trivia}) : super([trivia]);
+}
+
+class Error extends NumberTriviaState {
+  final String message;
+
+  Error({@required this.message}) : super([message]);
+}
```

**File**: `test/core/util/input_converter_test.dart` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import 'package:clean_architecture_tdd_course/core/util/input_converter.dart';
+import 'package:dartz/dartz.dart';
+import 'package:flutter_test/flutter_test.dart';
+
+void main() {
+  InputConverter inputConverter;
+
+  setUp(() {
+    inputConverter = InputConverter();
+  });
+
+  group('stringToUnsignedInt', () {
+    test(
+      'should return an integer when the string represents an unsigned integer',
+      () async {
+        // arrange
+        final str = '123';
+        // act
+        final result = inputConverter.stringToUnsignedInteger(str);
+        // assert
+        expect(result, Right(123));
+      },
+    );
+
+    test(
+      'should return a Failure when the string is not an integer',
+      () async {
+        // arrange
+        final str = 'abc';
+        // act
+        final result = inputConverter.stringToUnsignedInteger(str);
+        // assert
+        expect(result, Left(InvalidInputFailure()));
+      },
+    );
+
+    test(
+      'should return a Failure when the string is a negative integer',
+      () async {
+        // arrange
+        final str = '-123';
+        // act
+        final result = inputConverter.stringToUnsignedInteger(str);
+        // assert
+        expect(result, Left(InvalidInputFailure()));
+      },
+    );
+  });
+}
```

---

### Incident Patch 8: `7677b3d8` (2019-09-12)
**Commit Message**: 9 - Remote Data Source

**File**: `lib/features/number_trivia/data/datasources/number_trivia_remote_data_source.dart` (modified, +35/-0)
```diff
@@ -1,3 +1,9 @@
+import 'dart:convert';
+
+import 'package:http/http.dart' as http;
+import 'package:meta/meta.dart';
+
+import '../../../../core/error/exceptions.dart';
 import '../models/number_trivia_model.dart';
 
 abstract class NumberTriviaRemoteDataSource {
@@ -11,3 +17,32 @@ abstract class NumberTriviaRemoteDataSource {
   /// Throws a [ServerException] for all error codes.
   Future<NumberTriviaModel> getRandomNumberTrivia();
 }
+
+class NumberTriviaRemoteDataSourceImpl implements NumberTriviaRemoteDataSource {
+  final http.Client client;
+
+  NumberTriviaRemoteDataSourceImpl({@required this.client});
+
+  @override
+  Future<NumberTriviaModel> getConcreteNumberTrivia(int number) =>
+      _getTriviaFromUrl('http://numbersapi.com/$number');
+
+  @override
+  Future<NumberTriviaModel> getRandomNumberTrivia() =>
+      _getTriviaFromUrl('http://numbersapi.com/random');
+
+  Future<NumberTriviaModel> _getTriviaFromUrl(String url) async {
+    final response = await client.get(
+      url,
+      headers: {
+        'Content-Type': 'application/json',
+      },
+    );
+
+    if (response.statusCode == 200) {
+      return NumberTriviaModel.fromJson(json.decode(response.body));
+    } else {
+      throw ServerException();
+    }
+  }
+}
```

**File**: `test/features/number_trivia/data/datasources/number_trivia_remote_data_source_test.dart` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+import 'dart:convert';
+
+import 'package:clean_architecture_tdd_course/core/error/exceptions.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/data/datasources/number_trivia_remote_data_source.dart';
+import 'package:clean_architecture_tdd_course/features/number_trivia/data/models/number_trivia_model.dart';
+import 'package:mockito/mockito.dart';
+import 'package:flutter_test/flutter_test.dart';
+import 'package:matcher/matcher.dart';
+import 'package:http/http.dart' as http;
+
+import '../../../../fixtures/fixture_reader.dart';
+
+class MockHttpClient extends Mock implements http.Client {}
+
+void main() {
+  NumberTriviaRemoteDataSourceImpl dataSource;
+  MockHttpClient mockHttpClient;
+
+  setUp(() {
+    mockHttpClient = MockHttpClient();
+    dataSource = NumberTriviaRemoteDataSourceImpl(client: mockHttpClient);
+  });
+
+  void setUpMockHttpClientSuccess200() {
+    when(mockHttpClient.get(any, headers: anyNamed('headers')))
+        .thenAnswer((_) async => http.Response(fixture('trivia.json'), 200));
+  }
+
+  void setUpMockHttpClientFailure404() {
+    when(mockHttpClient.get(any, headers: anyNamed('headers')))
+        .thenAnswer((_) async => http.Response('Something went wrong', 404));
+  }
+
+  group('getConcreteNumberTrivia', () {
+    final tNumber = 1;
+    final tNumberTriviaModel =
+        NumberTriviaModel.fromJson(json.decode(fixture('trivia.json')));
+
+    test(
+      '''should perform a GET request on a URL with number
+       being the endpoint and with application/json header''',
+      () async {
+        // arrange
+        setUpMockHttpClientSuccess200();
+        // act
+        dataSource.getConcreteNumberTrivia(tNumber);
+        // assert
+        verify(mockHttpClient.get(
+          'http://numbersapi.com/$tNumber',
+          headers: {
+            'Content-Type': 'application/json',
+          },
+        ));
+      },
+    );
+
+    test(
+      'should return NumberTrivia when the response code is 200 (success)',
+      () async {
+        // arrange
+        setUpMockHttpClientSuccess200();
+        // act
+        final result = await dataSource.getConcreteNumberTrivia(tNumber);
+        // assert
+        expect(result, equals(tNumberTriviaModel));
+      },
+    );
+
+    test(
+      'should throw a ServerException when the response code is 404 or other',
+      () async {
+        // arrange
+        setUpMockHttpClientFailure404();
+        // act
+        final call = dataSource.getConcreteNumberTrivia;
+        // assert
+        expect(() => call(tNumber), throwsA(TypeMatcher<ServerException>()));
+      },
+    );
+  });
+
+  group('getRandomNumberTrivia', () {
+    final tNumberTriviaModel =
+        NumberTriviaModel.fromJson(json.decode(fixture('trivia.json')));
+
+    test(
+      '''should perform a GET request on a URL with number
+       being the endpoint and with application/json header''',
+      () async {
+        // arrange
+        setUpMockHttpClientSuccess200();
+        // act
+        dataSource.getRandomNumberTrivia();
+        // assert
+        verify(mockHttpClient.get(
+          'http://numbersapi.com/random',
+          headers: {
+            'Content-Type': 'application/json',
+          },
+        ));
+      },
+    );
+
+    test(
+      'should return NumberTrivia when the response code is 200 (success)',
+      () async {
+        // arrange
+        setUpMockHttpClientSuccess200();
+        // act
+        final result = await dataSource.getRandomNumberTrivia();
+        // assert
+        expect(result, equals(tNumberTriviaModel));
+      },
+    );
+
+    test(
+      'should throw a ServerException when the response code is 404 or other',
+      () async {
+        // arrange
+        setUpMockHttpClientFailure404();
+        // act
+        final call = dataSource.getRandomNumberTrivia;
+        // assert
+        expect(() => call(), throwsA(TypeMatcher<ServerException>()));
+      },
+    );
+  });
+}
```

#### Recent Merged Pull Requests:
- **PR #50** (closed): manurueda/master (@manurueda)
- **PR #43** (closed): Updated to work fine with Flutter 2 (@svarunid)
- **PR #39** (closed): Allow insecure connections (@robertpiosik)
- **PR #33** (closed): Update number_trivia_local_data_source_test.dart (@bgoktugozdemir)
- **PR #31** (closed): Mocking (@crdiaz3)
- **PR #11** (closed): Fixing bloc and equatable new version (@FagundesCristianoF)
- **PR #8** (closed): fix(AndroidManifest): add permission for internet (@Kiruel)
- **PR #3** (2019-09-05): Adds .gitkeep files to all folders created in the first lesson (@ricardoebbers)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
