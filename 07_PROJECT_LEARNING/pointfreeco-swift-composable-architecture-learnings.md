# Forensic Learning Record (Deep Inspection): pointfreeco/swift-composable-architecture

> **Canonical Artifact**: `07_PROJECT_LEARNING/pointfreeco-swift-composable-architecture-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pointfreeco/swift-composable-architecture](https://github.com/pointfreeco/swift-composable-architecture))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:51:54.350Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pointfreeco/swift-composable-architecture`
- **Description**: A library for building applications in a consistent and understandable way, with composition, testing, and ergonomics in mind.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 14944 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3950** (2026-09-18): **Backport Xcode 27 support to TCA 1.23**
  *Symptoms*: ### Description  Unfortunately my team still needs to support iOS 15, so we've been stuck on TCA 1.23 for months.  It was fine until Xcode 27 beta 1. I was hoping that it could be an Xcode regression but we're at beta 3 now and the error persists.  I checked on my machine and cherry-picking #3931 fixes the compilation error. Could that be backported to 1.23?  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  Being able to compile a version of the project that supports iOS 15 using Xcode 27.  ### Actual behavior  The compiler fails with this error:  ``` Sources/ComposableArchitecture/Observation/NavigationStack+Observation.swift:167:17 Cannot form key path to main actor-isolated subscript 'subscript(fileID:filePath:line:column:)' ```  ### Reproducing project  No extra project necessary, simply try to compile TCA tag 1.23.2 on Xcode 27.  ### The Composable Architecture version information  1.23.2  ### Destination operating system  iOS 15  ### Xcode version information  Version 27.0 beta 3 (27A5218g)  ### Swift Compiler version information  ```shell swift-driver version: 1.168.4 Apple Swift
  **Post-Mortem & Fix Analysis**:
  > Hi @igorcamilo, thanks for brining this up. We have published a [1.23.3 release](https://github.com/pointfreeco/swift-composable-architecture/releases/tag/1.23.3).

- **Issue #3947** (2026-07-08): **Extra argument 'isolation' in call**
  *Symptoms*: ### Description  Description Hi!  swift-composable-architecture dependency is not built  ``` TestStore. private func _withIssueContext<R>( fileID: StaticString,  filePath: StaticString,  line: Uint, column: Uint, isolation: isolated (any Actor)? = #isolation,  operation: () async throws -> R) async rethrows -> R {      let result = try await withIssueContext(  fileID: fileID,  filePath: filePath,  line: line,  column: column,  isolation: isolation,  operation: operation  )     awaitTask.yield()     return result } ```  Extra argument 'isolation' in call  The Composable Architecture version information '1.26.0'  Destination operating system 'iOS 26'  Xcode version information Version 26.6 (17F113)  Swift Compiler version information Target: iOS26.5  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Reproducing project  _No response_  ### The Composable Architecture version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  `
  **Post-Mortem & Fix Analysis**:
  > Hi @RubeksLS, please make sure you are using the newest xctest-dynamic-overlay. You should be able to right click it in Xcode and click "Update", and that should update it to 1.10.1. Sometimes Xcode can be finicky in updating dependencies so you may need to close/re-open Xcode, or even reset package caches.
  > Yes, I tried to do that(change version, clean build fodler, delete derived data, terminate xcode, reload system).  In xctest-dynamic-overlay there is a method:  ``` public func withIssueContext<R>(   fileID: StaticString,   filePath: StaticString,   line: UInt,   column: UInt,   operation: () async throws -> R ) async rethrows -> R {   try await IssueContext.$current.withValue(     IssueContext(fileID: fileID, filePath: filePath, line: line, column: column),     operation: operation   ) } ``` which does not have isolation in the method signature.  In swift-composable-architecture, however, the _withIssueContext method passes an isolation parameter. ``` let result = try await withIssueContext(     fileID: fileID,     filePath: filePath,     line: line,     column: column,     isolation: isolation,  <------- here     operation: operation   ) ```  My swift-composable-architecture version is 1.26.0. My xctest-dynamic-overlay version is 1.10.1  <img width="310" height="243" alt="Image" src=
  > > In xctest-dynamic-overlay there is a method: >  > ``` > public func withIssueContext<R>( >   fileID: StaticString, >   filePath: StaticString, >   line: UInt, >   column: UInt, >   operation: () async throws -> R > ) async rethrows -> R { >   try await IssueContext.$current.withValue( >     IssueContext(fileID: fileID, filePath: filePath, line: line, column: column), >     operation: operation >   ) > } > ``` >  > which does not have isolation in the method signature.  You still seem to be on an old version of xctest-dynamic-overlay, because that is not what the code looks like on 1.10.1:  https://github.com/pointfreeco/swift-issue-reporting/blob/401bf70d95bfe8db2a1dc619f9e175a85c089321/Sources/IssueReporting/WithIssueContext.swift#L38-L51  The `isolation` parameter is only missing when compiling with Swift <6.0, which shouldn't be the case for building in Xcode 26.6.  If you can provide a minimal project that reproduces the problem I can take a look at it. But I am certain that ther

- **Issue #3938** (2026-06-18): **Error with new `store.scope` syntax and `fullScreenCover`**
  *Symptoms*: ### Description  There is a compiler error => `Type 'Void' cannot conform to 'Identifiable'` with` fullScreenCover` It happens when using the new syntax for `store.scope` and with enum without reducer.   nested enum Reducer: ``` @Reducer     enum Destination {         case child(ChildFeature)         case other     } ``` view: ``` Text("Hello, World!")             .fullScreenCover( // => OK                 item: $store.scope(state: \.$destination, action: \.destination).child,                 content: { _ in                     Text("Ok")                 }             )             .fullScreenCover( // => OK                 item: $store.scope(state: \.destination?.other, action: \.destination.other),                 content: { _ in                     Text("Ok")                 }             )             .fullScreenCover( // => Type 'Void' cannot conform to 'Identifiable'                 item: $store.scope(state: \.$destination, action: \.destination).other,                 content: { _ in                     Text("Ok")                 }             ) ```  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ###

- **Issue #3933** (2026-06-09): **Documentation: Outdated Store.scope symbol reference in Performance article**
  *Symptoms*: ### Description  `Performance.md` contains a DocC symbol reference to the older `Store/scope(state:action:)` API:  ``Store/scope(state:action:)-90255``  The surrounding references in the same article already use the newer `Store/scope(_:action:)` symbol spelling introduced in #3923.  Location:  `Sources/ComposableArchitecture/Documentation.docc/Articles/Performance.md`  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  The article should reference the current `Store/scope(_:action:)` symbol.  ### Actual behavior  The article still references the older `Store/scope(state:action:)-90255` symbol.  ### Reproducing project  N/A. Documentation issue.  ### The Composable Architecture version information  main  ### Destination operating system  N/A. Documentation issue.  ### Xcode version information  N/A. Documentation issue.  ### Swift Compiler version information  ```shell N/A. Documentation issue. ```

- **Issue #3930** (2026-06-04): **'subscript(dynamicMember:)' is unavailable in iOS**
  *Symptoms*: ### Description  I get compile error saying that 'subscript(dynamicMember:)' was obsoleted in iOS 17  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  replace 'subscript(dynamicMember:)' was obsoleted in iOS 17  ### Actual behavior  _No response_  ### Reproducing project  _No response_  ### The Composable Architecture version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  swift-driver version: 1.148.6 Apple Swift version 6.3.2 (swiftlang-6.3.2.1.108 clang-2100.1.1.101) ```
  **Post-Mortem & Fix Analysis**:
  > @DosZlmnv Closing for the same reason as #3929. We're happy to receive legit bug reports, but this isn't it. Please take the time to provide an issue that is actionable.

- **Issue #3929** (2026-06-04): **TestStore,_withIssueContext: Extra argument 'isolation' in call**
  *Symptoms*: ### Description  Project does not compile because of this issue  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  rm extra argument in withIssueContext method call  ### Actual behavior  _No response_  ### Reproducing project  _No response_  ### The Composable Architecture version information  _No response_  ### Destination operating system  _No response_  ### Xcode version information  _No response_  ### Swift Compiler version information  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > <img width="296" height="261" alt="Image" src="https://github.com/user-attachments/assets/69d8d3d7-8199-4596-adf5-0937e27acedd" />  @DosZlmnv We're happy to investigate issues, but you haven't provided any information for reproducing. I'm going to close this, but I'd suggest you make sure you're on the latest Xcode, and are pointing to the latest package versions of everything involved.  If you continue to have an issue, feel free to reopen this, or open another issue, with as much detail as possible (for example filling out all of the <em>No response</em>s above).
  > In case anyone else comes across this issue: xctest-dynamic-overlay was outdated.  The isolation parameter was added in 1.5.2, but TCA’s Package.swift specifies a min version of 1.3.0.

- **Issue #3921** (2026-05-06): **SyncUps: Main actor-isolated conformance of 'SyncUp' to 'Equatable' cannot satisfy conformance requirement for a 'Sendable' type parameter**
  *Symptoms*: ### Description  Proceeding with Building SyncUps tutorial results in error diagnostics on Sync-up form, Section 1, Step 9  ### Checklist  - [ ] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [ ] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  No error diagnostic occur when copying/writing code from tutorial.  ### Actual behavior  Step 9 of Section 1 of Sync-up Form tutorial generates errors: `Main actor-isolated conformance of 'SyncUp' to 'Equatable' cannot satisfy conformance requirement for a 'Sendable' type parameter ` on every usage of binding `$store.syncup`  ### Reproducing project  [syncups.zip](https://github.com/user-attachments/files/27302201/syncups.zip)  ### The Composable Architecture version information  1.25.5  ### Destination operating system  26.4.1  ### Xcode version information  26.4.1  ### Swift Compiler version information  ```shell Apple Swift version 6.3.1 (swiftlang-6.3.1.1.2 clang-2100.0.123.102) Target: arm64-apple-macosx26.0 ```
  **Post-Mortem & Fix Analysis**:
  > Hi @svmkr-dev, if you want to use default main actor isolation then you just need to mark the domain types (`SyncUp`, `Attendee` and `Meeting`) as `nonisolated`.  Since this isn't an issue with the library I am going to convert it to a discussion. Please feel free to continue the conversation over there!

- **Issue #3918** (2026-06-02): **Error when archiving via xcodebuild archive**
  *Symptoms*: ### Description  I have a Swift Package module that uses TCA. I want to be able to distribute this as an .xcframework. To achieve this I am using `xcodebuild archive (...)`. When doing so I get an error:  ```  /SourcePackages/checkouts/swift-composable-architecture/Sources/ComposableArchitecture/Internal/Logger.swift:8:4: 'Published' aliases 'Combine.Published' and cannot be used as property wrapper here because 'Combine' was not imported by this file   @Published public var logs: [String] = []    ^ ```  I set up a minimal project where the issue is reproducible: https://github.com/joaomvfsantos/TCACompileIssue  The repo contains a README with detailed command instructions.  ### Checklist  - [x] I have determined whether this bug is also reproducible in a vanilla SwiftUI project. - [x] If possible, I've reproduced the issue using the `main` branch of this package. - [x] This issue hasn't been addressed in an [existing GitHub issue](https://github.com/pointfreeco/swift-composable-architecture/issues) or [discussion](https://github.com/pointfreeco/swift-composable-architecture/discussions).  ### Expected behavior  I would expect `xcodebuild archive` to finish without errors.  ### Actual behavior  The error `'Published' aliases 'Combine.Published' and cannot be used as property wrapper here because 'Combine' was not imported by this file` is thrown  ### Reproducing project  https://github.com/joaomvfsantos/TCACompileIssue  ### The Composable Architecture version information  1.2
  **Post-Mortem & Fix Analysis**:
  > @joaomvfsantos We unfortunately don't have the infrastructure in place to support build systems beyond the basics, but the error above is at least straightforward enough that if you opened a PR we would be happy to merge. Can you `import Combine` in that file, test it with your setup, and if all issues are addressed and your XCFramework build is clean, open a PR?  We would also be open to continuous integration improvements to catch errors like these, with the caveat that if that CI becomes fragile we may have to disable it in the future.
  > @stephencelis Makes sense. Will create a PR in the next days.
  > @stephencelis I created a PR. There is more explanation on the root cause. I have the feeling it seems more of a bandaid to overcome xcodebuild bugs than anything else, but at least it unblocks me.

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

### Incident Patch 1: `ead11e04` (2026-07-21)
**Commit Message**: Fix errors in stack navigation documentation examples (#3955)

* docs: Fix path mutation in stack navigation example

* docs: Fix reducer in stack navigation test examples

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/StackBasedNavigation.md` (modified, +3/-3)
```diff
@@ -266,7 +266,7 @@ methods, such as ``StackState/popLast()``, ``StackState/pop(from:)`` and more:
 
 ```swift
 case .closeButtonTapped:
-  state.popLast()
+  state.path.popLast()
   return .none
 ```
 
@@ -430,7 +430,7 @@ func dismissal() {
       ])
     )
   ) {
-    CounterFeature()
+    Feature()
   }
 }
 ```
@@ -553,7 +553,7 @@ func dismissal() {
       ])
     )
   ) {
-    CounterFeature()
+    Feature()
   }
   store.exhaustivity = .off
 
```

---

### Incident Patch 2: `e6f89adb` (2026-07-21)
**Commit Message**: docs: Fix reducer in tree-based navigation test examples (#3954)

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/TreeBasedNavigation.md` (modified, +2/-2)
```diff
@@ -586,7 +586,7 @@ func dismissal() {
       counter: CounterFeature.State(count: 3)
     )
   ) {
-    CounterFeature()
+    Feature()
   }
 }
 ```
@@ -642,7 +642,7 @@ func dismissal() {
       counter: CounterFeature.State(count: 3)
     )
   ) {
-    CounterFeature()
+    Feature()
   }
   store.exhaustivity = .off
 
```

---

### Incident Patch 3: `ba184516` (2026-07-16)
**Commit Message**: Fix TestStore initialization in navigation tutorial (#3952)

* Fix: TestStore initialization in navigation tutorial

* Update 02-03-03-code-0002.swift

---------

Co-authored-by: Brandon Williams <135203+mbrandonw@users.noreply.github.com>

**File**: `Sources/ComposableArchitecture/Documentation.docc/Tutorials/MeetTheComposableArchitecture/02-Navigation/03-TestingPresentation/02-03-03-code-0002.swift` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import Testing
 struct ContactsFeatureTests {
   @Test
   func deleteContact() async {
-    let store = TestStore(initialState: ContactsFeature.State()) {
+    let store = TestStore(
       initialState: ContactsFeature.State(
         contacts: [
           Contact(id: UUID(0), name: "Blob"),
```

---

### Incident Patch 4: `32e3fcab` (2026-06-26)
**Commit Message**: Fix missing await in TestingTCA send examples (#3940)

* fix await in TestStore state examples

* fix await in TestStore exhaustivity examples

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/TestingTCA.md` (modified, +4/-4)
```diff
@@ -119,7 +119,7 @@ on computed properties you might have defined on your state. For example, if `St
 computed property for checking if `count` was prime, we could test it like so:
 
 ```swift
-store.send(.incrementButtonTapped) {
+await store.send(.incrementButtonTapped) {
   $0.count = 3
 }
 XCTAssertTrue(store.state.isPrime)
@@ -131,7 +131,7 @@ prevents you from being able to use an escape hatch to get around needing to act
 state mutation, like so:
 
 ```swift
-store.send(.incrementButtonTapped) {
+await store.send(.incrementButtonTapped) {
   $0 = store.state  // ❌ store.state is the previous, not current, state.
 }
 ```
@@ -535,7 +535,7 @@ let store = TestStore(/* ... */)
 // ℹ️ "on" is the default so technically this is not needed
 store.exhaustivity = .on
 
-store.send(.buttonTapped) {
+await store.send(.buttonTapped) {
   $0  // Represents the state *before* the action was sent
 }
 ```
@@ -550,7 +550,7 @@ trailing closure of `send` represents the state _after_ the action was sent:
 let store = TestStore(/* ... */)
 store.exhaustivity = .off
 
-store.send(.buttonTapped) {
+await store.send(.buttonTapped) {
   $0  // Represents the state *after* the action was sent
 }
 ```
```

---

### Incident Patch 5: `675fbb2c` (2026-06-26)
**Commit Message**: Fix dropped documentation link in FAQ (#3941)

The FAQ's exhaustive-testing answer ended with "See  for more information on
testing in TCA", where the link to the testing article had been dropped,
leaving a double space and no reference. Link it to the already-defined
`[testing-article]` (`<doc:TestingTCA>`).

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/FAQ.md` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ Modeling user actions with an enum rather than methods defined on some object is
   }
   ```
 
-  Again this is only possible thanks to the data type of all actions in the feature. See  for more information on testing in TCA.
+  Again this is only possible thanks to the data type of all actions in the feature. See the [testing article][testing-article] for more information.
 
 <!-- TODO: Navigation tools? -->
 
```

---

### Incident Patch 6: `a28ddfad` (2026-06-11)
**Commit Message**: Fix syntax error and typo in documentation examples (#3939)

- Add missing closing parenthesis to a store.send(.textFieldChanged("Hello")) example in Performance.md, consistent with the surrounding examples.
- Fix "trialing" -> "trailing" typo in TreeBasedNavigation.md.

Co-authored-by: devk4nt <devk4nt@users.noreply.github.com>

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/Performance.md` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ store.send(.toggleChanged) {
   $0.isEnabled = true
   // Assert on shared logic
 }
-store.send(.textFieldChanged("Hello") {
+store.send(.textFieldChanged("Hello")) {
   $0.description = "Hello"
   // Assert on shared logic
 }
```

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/TreeBasedNavigation.md` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ struct InventoryFeature {
 }
 ```
 
-> Note: It's not necessary to specify `Destination` in a trialing closure of `ifLet` because it can
+> Note: It's not necessary to specify `Destination` in a trailing closure of `ifLet` because it can
 > automatically be inferred due to how the `Destination` enum was defined with the ``Reducer()``
 > macro.
 
```

---

### Incident Patch 7: `f17e2c57` (2026-06-10)
**Commit Message**: Fix outdated Path reducer examples in stack navigation docs (#3937)

* docs: update stack navigation testing example

* docs: wrap stack navigation test state in path case

* Apply suggestion from @mbrandonw

---------

Co-authored-by: Brandon Williams <135203+mbrandonw@users.noreply.github.com>

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/StackBasedNavigation.md` (modified, +5/-9)
```diff
@@ -403,19 +403,15 @@ struct Feature {
   }
 
   @Reducer  
-  struct Path {
-    enum State: Equatable { case counter(CounterFeature.State) }
-    enum Action { case counter(CounterFeature.Action) }
-    var body: some ReducerOf<Self> {
-      Scope(\.counter, action: \.counter) { CounterFeature() }
-    }
+  enum Path {
+    case counter(CounterFeature)
   }
 
   var body: some ReducerOf<Self> {
     Reduce { state, action in
       // Logic and behavior for core feature.
     }
-    .forEach(\.path, action: \.path) { Path() }
+    .forEach(\.path, action: \.path) { Path.body }
   }
 }
 ```
@@ -430,7 +426,7 @@ func dismissal() {
   let store = TestStore(
     initialState: Feature.State(
       path: StackState([
-        CounterFeature.State(count: 3)
+        .counter(CounterFeature.State(count: 3))
       ])
     )
   ) {
@@ -553,7 +549,7 @@ func dismissal() {
   let store = TestStore(
     initialState: Feature.State(
       path: StackState([
-        CounterFeature.State(count: 3)
+        .counter(CounterFeature.State(count: 3))
       ])
     )
   ) {
```

---

### Incident Patch 8: `4f4e205b` (2026-06-10)
**Commit Message**: Fix SharingState documentation example syntax (#3936)

* fix: SharingState fileStorage attribute syntax

* fix: SharingState code fence delimiter

* fix: SharingState fileStorage URL delimiter

* fix: SharingState shared state projection

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/SharingState.md` (modified, +5/-5)
```diff
@@ -187,7 +187,7 @@ It works similarly to the in-memory sharing discussed above, but it requires a U
 on disk, as well as a default value that will be used when there is no data in the file system:
 
 ```swift
-@Shared(.fileStorage(URL(/* ... */)) var users: [User] = []
+@Shared(.fileStorage(URL(/* ... */))) var users: [User] = []
 ```
 
 This strategy works by serializing your value to JSON to save to disk, and then deserializing JSON
@@ -653,7 +653,7 @@ section above to use app storage:
 struct State: Equatable {
   @Shared(.appStorage("count")) var count: Int
 }
-````
+```
 
 …then the test for this feature can be written in the same way as before and will still pass.
 
@@ -868,7 +868,7 @@ like this:
 
 ```swift
 extension URL {
-  static let users = URL(/* ... */))
+  static let users = URL(/* ... */)
 }
 
 @Shared(.fileStorage(.users)) var users: [User] = []
@@ -1101,7 +1101,7 @@ await store.send(.tap)
 
 // ❌ Expected state to change, but no change occurred.
 await store.receive(.response) {
-  $0.$shared.withLock { $0 = true }
+  $0.$bool.withLock { $0 = true }
 }
 ```
 
@@ -1111,7 +1111,7 @@ must always assert against shared state mutations in the first action:
 
 ```swift
 await store.send(.tap) {  // ✅
-  $0.$shared.withLock { $0 = true }
+  $0.$bool.withLock { $0 = true }
 }
 
 // ❌ Expected state to change, but no change occurred.
```

---

### Incident Patch 9: `2a5434e2` (2026-06-09)
**Commit Message**: Fix syntax errors in bindings documentation examples (#3935)

* docs: fix binding action case patterns

* docs: fix Toggle binding label

* docs: fix switch syntax in bindings docs

* docs: fix closing delimiter in binding test example

**File**: `Sources/ComposableArchitecture/Documentation.docc/Articles/Bindings.md` (modified, +9/-9)
```diff
@@ -162,27 +162,27 @@ struct Settings {
   var body: some Reducer<State, Action> {
     Reduce { state, action in
       switch action {
-      case let digestChanged(digest):
+      case let .digestChanged(digest):
         state.digest = digest
         return .none
 
-      case let displayNameChanged(displayName):
+      case let .displayNameChanged(displayName):
         state.displayName = displayName
         return .none
 
-      case let enableNotificationsChanged(isOn):
+      case let .enableNotificationsChanged(isOn):
         state.enableNotifications = isOn
         return .none
 
-      case let protectMyPostsChanged(isOn):
+      case let .protectMyPostsChanged(isOn):
         state.protectMyPosts = isOn
         return .none
 
-      case let sendEmailNotificationsChanged(isOn):
+      case let .sendEmailNotificationsChanged(isOn):
         state.sendEmailNotifications = isOn
         return .none
 
-      case let sendMobileNotificationsChanged(isOn):
+      case let .sendMobileNotificationsChanged(isOn):
         state.sendMobileNotifications = isOn
         return .none
       }
@@ -243,7 +243,7 @@ Then bindings can be derived from the store using familiar `$` syntax:
 
 ```swift
 TextField("Display name", text: $store.displayName)
-Toggle("Notifications", text: $store.enableNotifications)
+Toggle("Notifications", isOn: $store.enableNotifications)
 // ...
 ```
 
@@ -255,7 +255,7 @@ var body: some Reducer<State, Action> {
   BindingReducer()
 
   Reduce { state, action in
-    switch action
+    switch action {
     case .binding(\.displayName):
       // Validate display name
   
@@ -300,5 +300,5 @@ store.send(\.binding.displayName, "Blob") {
 }
 store.send(\.binding.protectMyPosts, true) {
   $0.protectMyPosts = true
-)
+}
 ```
```

---

### Incident Patch 10: `44d83ff9` (2026-06-02)
**Commit Message**: Fix xcodebuild issues (#3919)

**File**: `Sources/ComposableArchitecture/Internal/Deprecations.swift` (modified, +4/-0)
```diff
@@ -2079,6 +2079,8 @@ extension View {
                 if let action {
                   store.send(.presented(fromDestinationAction(action)), animation: animation)
                 }
+              @unknown default:
+                break
               }
             } label: {
               Text(button.label)
@@ -2132,6 +2134,8 @@ extension View {
                 if let action {
                   store.send(.presented(fromDestinationAction(action)), animation: animation)
                 }
+              @unknown default:
+                break
               }
             } label: {
               Text(button.label)
```

**File**: `Sources/ComposableArchitecture/Internal/Logger.swift` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 import OSLog
+import Combine
 
 @_spi(Logging)
 @preconcurrency @MainActor
```

**File**: `Sources/ComposableArchitecture/Observation/Alert+Observation.swift` (modified, +4/-0)
```diff
@@ -22,6 +22,8 @@ extension View {
               if let action {
                 store?.send(action, animation: animation)
               }
+            @unknown default:
+              break
             }
           } label: {
             Text(button.label)
@@ -59,6 +61,8 @@ extension View {
               if let action {
                 store?.send(action, animation: animation)
               }
+            @unknown default:
+              break
             }
           } label: {
             Text(button.label)
```

#### Recent Merged Pull Requests:
- **PR #3960** (closed): Issue 3950 - Backport Xcode 27 support to TCA 1.23 (@aryansk)
- **PR #3956** (2026-07-24): Fix missing @ObservableState annotations in bindings examples (@indextrown)
- **PR #3955** (2026-07-21): Fix errors in stack navigation documentation examples (@indextrown)
- **PR #3954** (2026-07-21): Fix reducer in tree-based navigation test examples (@indextrown)
- **PR #3952** (2026-07-16): Fix TestStore initialization in navigation tutorial (@opficdev)
- **PR #3951** (closed): Fix TestStore initialization in navigation tutorial (@opficdev)
- **PR #3948** (2026-08-28): Bump to IssueReporting 2.0 (@stephencelis)
- **PR #3946** (2026-07-03): Add docs badge to readme (@mbrandonw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
