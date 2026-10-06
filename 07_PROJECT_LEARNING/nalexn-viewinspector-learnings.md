# Forensic Learning Record (Deep Inspection): nalexn/ViewInspector

> **Canonical Artifact**: `07_PROJECT_LEARNING/nalexn-viewinspector-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nalexn/ViewInspector](https://github.com/nalexn/ViewInspector))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:25:08.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nalexn/ViewInspector`
- **Description**: Runtime introspection and unit testing of SwiftUI views
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2635 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.watchOS/App/watchOSApp.swift`
```
import SwiftUI

final class ExtensionDelegate: NSObject, WKExtensionDelegate {
    let testViewSubject = TestViewSubject([])
}

@main
struct watchOS_Watch_AppApp: App {
    
    @WKExtensionDelegateAdaptor(ExtensionDelegate.self) var extDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .testable(extDelegate.testViewSubject)
        }
    }
}

struct ContentView: View {
    var body: some View {
        Text("ViewInspector").padding()
    }
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "ViewInspector",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v9), .visionOS(.v1)
    ],
    products: [
        .library(
            name: "ViewInspector", targets: ["ViewInspector"]),
    ],
    targets: [
        .target(
            name: "ViewInspector", dependencies: []),
        .testTarget(
            name: "ViewInspectorTests",
            dependencies: ["ViewInspector"],
            resources: [.process("TestResources")]),
    ]
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #418** (2026-03-27): **fix task modifiers in 26.4**
  *Symptoms*: Looks like in 26.4, the task modifier now is internally versioned 2 and takes a `sending @isolated(any)` instead of `@Sending` func.
  **Post-Mortem & Fix Analysis**:
  > Thank you Andy!

- **Issue #398** (2025-08-28): **Fix callOnTapGesture for iOS 26**
  *Symptoms*: Following up on the updates to support Xcode 26:  using `callOnTapGesture()` did not work on iOS 26. This failure could be reproduced by the [test](https://github.com/nalexn/ViewInspector/blob/e755279608f57bd451db34fc95d314847d2e4864/Tests/ViewInspectorTests/Gestures/GestureModifiers/GestureActionTests.swift) `testOnTapGestureInspection`  Pre iOS 26: ``` ▿ ModifiedContent<EmptyView, AddGestureModifier<_EndedGesture<TapGesture>>>   - content : SwiftUI.EmptyView()   ▿ modifier : AddGestureModifier<_EndedGesture<TapGesture>>     ▿ gesture : _EndedGesture<TapGesture>       ▿ _body : ModifierGesture<CallbacksGesture<EndedCallbacks<()>>, TapGesture>         ▿ content : TapGesture           - count : 1         ▿ modifier : CallbacksGesture<EndedCallbacks<()>>           ▿ callbacks : EndedCallbacks<()>             - ended : (Function)     - name : nil     ▿ gestureMask : GestureMask       - rawValue : 3 ``` iOS 26: ``` ▿ ModifiedContent<EmptyView, TapGestureModifier>   - content : SwiftUI.EmptyView()   ▿ modifier : TapGestureModifier     - count : 1     - action : (Function) ```
  **Post-Mortem & Fix Analysis**:
  > Thank you for the PR!

- **Issue #372** (2025-04-13): **Fix accessibility value inspection for iOS 18.4**
  *Symptoms*: This PR fixes the issue raised in #371   - updated element search path for the accessibility element of `accessibilityValue`  This fix will allow the following unit tests to pass on Xcode 16.3  * `ViewAccessibilityTests.testAccessibilityValueInspection` * `ViewAccessibilityTests.testAccessibilityMultipleAttributes`
  **Post-Mortem & Fix Analysis**:
  > Thank you @weisunOW !

- **Issue #371** (2025-06-02): **Xcode 16.3 `.accessibilityValue()` Throws An Error**
  *Symptoms*: ## Description  Calling `InspectableView.accessibilityValue()` throws an error below using Xcode 16.3. The same test procedure works on Xcode 16.2.  ```Shell Caught error: Description does not have 'some' attribute ```  LLDB output  ```Shell (lldb) po try sut.accessibilityValue() ▿ Description does not have 'some' attribute   ▿ attributeNotFound : 2 elements     - label : "some"     - type : "Description" ```  Xcode version: 16.3 iOS SDK Version: 18.4  Swift Version: 5.9 Test framework: Swift Testing or XCTest  ## Test Failure  Failed test cases in `ViewInspector` package when running with Xcode 16.3;  * `ViewAccessibilityTests.testAccessibilityValueInspection` * `ViewAccessibilityTests.testAccessibilityMultipleAttributes`  ## Example  ```Swift   @Test   func accessibilityValue() throws {     let value = "abc"      let sut = try EmptyView()       .accessibilityValue(value)       .inspect()       .emptyView()      let inspectedValue = try sut.accessibilityValue() // Error is thrown here      #expect(try inspectedValue.string() == value)   } ```  ## Root Cause  I think the SwiftUI on iOS 18.4 have changed the descendant path of accessibility value.  See lldb output or `property.value` in `v3AccessibilityElement(...)` method. ```Shell (lldb) po property.value ▿ Optional<AccessibilityValueStorage>   ▿ some : AccessibilityValueStorage     - value : nil     ▿ description : Description       ▿ text : 1 element         ▿ 0 : Text           ▿ storage : Storage             - verbatim :
  **Post-Mortem & Fix Analysis**:
  > Thank you for digging to the root of the issue! In case you need to troubleshoot something similar in the future, instead of `po property.value` you can use `po Inspector.print(property) as AnyObject` or from the code `print("\(Inspector.print(view) as AnyObject)")` - it's a little more advanced than just `po` as it doesn't stop recursive print when it hits an object reference, or `view.body`. Essentially feed it with any value or object and it'll traverse **all** internals.
  > This issue is fixed in release [v0.10.2](https://github.com/nalexn/ViewInspector/releases/tag/0.10.2)

- **Issue #370** (2025-06-02): **Unable to locate sheets anymore with Xcode 16.3 when SWIFT_ENABLE_OPAQUE_TYPE_ERASURE is off.**
  *Symptoms*: Hello,  We recently migrated our codebase to support Xcode 16.2 and iOS 18, and we used workarounds such as anyView() and find(ViewType…) to fix the tests.  However, on Xcode 16.3, we are unfortunately unable to locate any views or sheets anymore that we've navigated to unless we add the user-defined setting SWIFT_ENABLE_OPAQUE_TYPE_ERASURE = YES.  The error we encounter is: `<Search did not find a match. Possible blockers: AccessibilityImageLabel>`  Of course, we’ve added the InspectableSheet modifier.   :-)  Any ideas how to really fix this?  Thanks 🍻  I attached the example project ([Xcode 163.zip](https://github.com/user-attachments/files/19589477/Xcode.163.zip)) but here is some code:  ##### The Views ```Swift struct ContentView: View {          @ObservedObject var viewModel: ContentViewModel          internal let inspection = Inspection<Self>()          init(viewModel: ContentViewModel = .init()) {         self.viewModel = viewModel     }          var body: some View {         VStack {             Text("Hello, world!")             Button("Show Sheet") {                 viewModel.showSheet = true             }         }         .onReceive(inspection.notice) { self.inspection.visit(self, $0) }         .padding()         .sheet2(isPresented: $viewModel.showSheet) {             SheetView()         }     } }  struct SheetView: View {     var body: some View {         Color.red     } } ```  ##### Approach 1 – using Quick/Nimble  ```Swift     describe("Content View") {       
  **Post-Mortem & Fix Analysis**:
  > Hello, yes, Xcode 16.3 reverted those opaque types settings and disabled them by default. More info [here](https://github.com/nalexn/ViewInspector/issues/367#issuecomment-2770290918) and [here](https://github.com/nalexn/ViewInspector/issues/327). You can either remove the implicitAnyViews or temporarily pin the library version to the 0.10.2 branch, as the PR with the fix #369 has been merged, but not released yet

- **Issue #363** (2026-09-13): **Find API is crashing when iterating over `Chart` view**
  *Symptoms*: Hi Team,  After taking release of 0.10.0 our find view api is crashing every time. I already assign required environment object etc but still it's causing the issue.  Example: let view = try? subject.inspect().find(MyView.self)
  **Post-Mortem & Fix Analysis**:
  > Well, that 1 line of code isn't enough for troubleshooting, please share the `MyView` structure, as well as the `subject` and the full test you run
  > @nalexn  I am also experiencing crashes in a few of the tests. Posting it here as it may be related to the original issue, it only happens when running tests on iOS 18.X. Tested on both 0.10.0 and 0.10.1 version of ViewInspector  I cannot post actual tests/views, but here is one way on how to reproduce it: ``` import Charts import SwiftUI  struct ChartView: View {     let showChart: Bool          var body: some View {         VStack {             if showChart {                 Chart() { }.id("chart")             } else {                 Text("text").id("text")             }         }     } }  class Test: XCTestCase {     func testView_ChartTrue() throws {         let sut = try ChartView(showChart: true).inspect()                  XCTAssertNotNil(try? sut.find(viewWithId: "chart"))         XCTAssertNil(try? sut.find(viewWithId: "text")) /// Crashes     }          /// Whole test works fine     func testView_ChartFalse() throws {         let sut = try ChartV
  > +1. I am having the same issue: `Charts/RenderBasedChartView.swift:183: Fatal error: Unexpectedly found nil while implicitly unwrapping an Optional value`.

- **Issue #352** (2024-12-08): **async inspect() deadlock bug**
  *Symptoms*: Started using the async version of `inspect()` more and more, we realized that tests became very flaky, and it started frequently failing in our CI/CD environment. Investigating the cause, it turned out that the current version of async `inspect()` can deadlock. So, we’re currently adding an artificial delay to all of our uses, like `inspect(after: .seconds(0.1))`. Otherwise, some tests randomly but frequently fail in a CI/CD environment.  #351 is my attempt to fix the bug.
  **Post-Mortem & Fix Analysis**:
  > Published with 0.10.1

- **Issue #334** (2026-09-14): **callOnTapGesture not working when in async**
  *Symptoms*: `callOnTapGesture()` does not work when the view is presented with `host() async`. Tested with Xcode 16.0 with Swift 6.0 mode.  ```swift struct TapGestureView: View {     @State var flag = false     let inspection = Inspection<Self>()      var body: some View {         Text("flag = \(flag)")             .onTapGesture { self.flag.toggle() }             .onReceive(inspection.notice) { self.inspection.visit(self, $0) }     } }  final class TapGestureViewTests: XCTestCase {      @MainActor func test_regular_host() throws {         let sut = TapGestureView()         let exp = sut.inspection.inspect { view in             XCTAssertEqual(try view.anyView().text().string(), "flag = false")             try view.anyView().text().callOnTapGesture()             XCTAssertEqual(try view.anyView().text().string(), "flag = true")  // 🆗         }         ViewHosting.host(view: sut)         wait(for: [exp], timeout: 1)     }      @MainActor func test_async_host() async throws {         let sut = TapGestureView()         try await ViewHosting.host(sut) {             let view = try $0.inspect()             XCTAssertEqual(try view.anyView().text().string(), "flag = false")             try view.anyView().text().callOnTapGesture()             XCTAssertEqual(try view.anyView().text().string(), "flag = true")  // 💥         }     } } ```
  **Post-Mortem & Fix Analysis**:
  > Okay, it turns out this is the same issue as discussed in https://github.com/nalexn/ViewInspector/discussions/354 In other words, I should've written the code as below in the first place: ```swift @MainActor func test_async_host() async throws {     let sut = TapGestureView()     try await ViewHosting.host(sut) {         try await sut.inspection.inspect { view in             XCTAssertEqual(try view.anyView().text().string(), "flag = false")             try view.anyView().text().callOnTapGesture()             XCTAssertEqual(try view.anyView().text().string(), "flag = true")         }     } } ```

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

### Incident Patch 1: `e74f7d1b` (2026-09-30)
**Commit Message**: Merge pull request #444 from nh7a/fix-visionos-platform-version

Fix Package.swift manifest: .visionOS(.v2) requires PackageDescription 6.0

**File**: `Package.swift` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ let package = Package(
     name: "ViewInspector",
     defaultLocalization: "en",
     platforms: [
-        .macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v9), .visionOS(.v2)
+        .macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v9), .visionOS(.v1)
     ],
     products: [
         .library(
```

---

### Incident Patch 2: `8d5387ef` (2026-09-21)
**Commit Message**: Fix Package.swift manifest for swift-tools-version 5.9

.visionOS(.v2) is gated behind @available(_PackageDescription 6.0), so a
manifest declaring tools version 5.9 fails to compile and the package
cannot be resolved by any consumer:

    error: 'v2' is unavailable
    note: 'v2' was introduced in PackageDescription 6.0

Drop the SwiftPM platform floor back to .visionOS(.v1). Every visionOS 2+
API in the sources is already guarded by @available / #available, so the
lower floor changes nothing at build time, and visionOS 1.0 remains a
valid minimum deployment target in the current SDK. The Xcode project's
XROS_DEPLOYMENT_TARGET stays at 2.6.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `Package.swift` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ let package = Package(
     name: "ViewInspector",
     defaultLocalization: "en",
     platforms: [
-        .macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v9), .visionOS(.v2)
+        .macOS(.v12), .iOS(.v15), .tvOS(.v15), .watchOS(.v9), .visionOS(.v1)
     ],
     products: [
         .library(
```

---

### Incident Patch 3: `4568acb3` (2026-09-20)
**Commit Message**: fix tests for watch os

**File**: `.watchOS/watchOS.xcodeproj/xcshareddata/xcschemes/App.xcscheme` (modified, +0/-1)
```diff
@@ -58,7 +58,6 @@
             BuildableIdentifier = "primary"
             BlueprintIdentifier = "52C351882AA20EA900FC0A1E"
             BuildableName = "App.app"
-            BlueprintName = "App"
             ReferencedContainer = "container:watchOS.xcodeproj">
          </BuildableReference>
       </BuildableProductRunnable>
```

**File**: `Tests/ViewInspectorTests/SwiftUI/SafeAreaBarTests.swift` (modified, +9/-9)
```diff
@@ -7,54 +7,54 @@ import SwiftUI
 final class SafeAreaBarTests: XCTestCase {
 
     func testInspectionNotBlocked() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView().safeAreaBar(edge: VerticalEdge.top) { Text("") }
         XCTAssertNoThrow(try sut.inspect().emptyView())
     }
 
     func testInspectionErrorNoModifier() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView().offset()
         XCTAssertThrows(try sut.inspect().emptyView().safeAreaBar(),
                         "EmptyView does not have 'safeAreaBar' modifier")
     }
 
     func testSimpleUnwrap() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView().safeAreaBar(edge: VerticalEdge.top) { Text("") }
         XCTAssertEqual(try sut.inspect().emptyView().safeAreaBar().pathToRoot,
                        "emptyView().safeAreaBar()")
     }
 
     func testContentUnwrap() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView().safeAreaBar(edge: VerticalEdge.top) { Text("abc") }
         let text = try sut.inspect().safeAreaBar().text()
         XCTAssertEqual(try text.string(), "abc")
     }
 
     func testVerticalEdge() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView().safeAreaBar(edge: VerticalEdge.bottom) { Text("") }
         XCTAssertEqual(try sut.inspect().safeAreaBar().edge(),
                        SafeAreaBarEdge.vertical(.bottom))
     }
 
     func testHorizontalEdge() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView().safeAreaBar(edge: HorizontalEdge.leading) { Text("") }
         XCTAssertEqual(try sut.inspect().safeAreaBar().edge(),
                        SafeAreaBarEdge.horizontal(.leading))
     }
 
     func testAlignment() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut1 = EmptyView().safeAreaBar(edge: VerticalEdge.bottom, alignment: .leading) {
             Text("")
@@ -69,7 +69,7 @@ final class SafeAreaBarTests: XCTestCase {
     }
 
     func testSpacing() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut1 = EmptyView().safeAreaBar(edge: VerticalEdge.top, spacing: 19) { Text("") }
         let sut2 = EmptyView().safeAreaBar(edge: VerticalEdge.top) { Text("") }
@@ -78,7 +78,7 @@ final class SafeAreaBarTests: XCTestCase {
     }
 
     func testSearch() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, visionOS 26.0, watchOS 26.0, *)
         else { throw XCTSkip() }
         let sut = Group {
             EmptyView()
```

---

### Incident Patch 4: `7879b792` (2026-09-20)
**Commit Message**: fix tests for tvos

**File**: `Tests/ViewInspectorTests/Gestures/TapGestureTests.swift` (modified, +1/-0)
```diff
@@ -122,4 +122,5 @@ final class TapGestureTests: XCTestCase {
     }
 }
 
+@available(iOS 13.0, macOS 10.15, tvOS 16.0, *)
 extension TapGestureTests: @unchecked Sendable { }
```

---

### Incident Patch 5: `6ecbda0d` (2026-09-20)
**Commit Message**: fix tests for vision

**File**: `Sources/ViewInspector/SwiftUI/TabView.swift` (modified, +11/-8)
```diff
@@ -94,15 +94,18 @@ public extension InspectableView where View: MultipleViewContent {
 public extension InspectableView {
     
     func tag() throws -> AnyHashable {
-        if #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *) {
-            return try modifierAttribute(
-                modifierName: "_TagTraitWritingModifier",
-                path: "modifier|tag", type: AnyHashable.self, call: "tag")
-        } else {
-            return try modifierAttribute(
-                modifierName: "TagValueTraitKey",
-                path: "modifier|value|tagged", type: AnyHashable.self, call: "tag")
+        if let value = try? modifierAttribute(
+            modifierName: "_TagTraitWritingModifier",
+            path: "modifier|tag", type: AnyHashable.self, call: "tag") {
+            return value
+        }
+        let matches = modifiersMatching { $0.modifierType.contains("TagValueTraitKey") }
+        guard let modifier = matches.first(where: { !$0.modifierType.contains("Optional") }) ?? matches.first
+        else {
+            throw InspectionError.modifierNotFound(
+                parent: Inspector.typeName(value: content.view), modifier: "tag", index: 0)
         }
+        return try Inspector.attribute(path: "modifier|value|tagged", value: modifier, type: AnyHashable.self)
     }
     
     func tabItem() throws -> InspectableView<ViewType.ClassifiedView> {
```

**File**: `Tests/ViewInspectorTests/SwiftUI/TabViewTests.swift` (modified, +3/-2)
```diff
@@ -112,8 +112,9 @@ final class GlobalModifiersForTabView: XCTestCase {
     
     func testTagInspection() throws {
         let tag = "abc"
-        let sut = try EmptyView().tag(tag).inspect().emptyView().tag()
-        XCTAssertEqual(sut, tag)
+        let sut = EmptyView().tag(tag)
+        let value = try sut.inspect().emptyView().tag()
+        XCTAssertEqual(value, tag)
     }
     
     @available(watchOS 7.0, *)
```

---

### Incident Patch 6: `ecfd78ec` (2026-09-20)
**Commit Message**: fix compilation for vision

**File**: `Sources/ViewInspector/SwiftUI/Chart.swift` (modified, +0/-1)
```diff
@@ -1,6 +1,5 @@
 #if canImport(Charts)
 import SwiftUI
-import Charts
 
 @available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
 public extension ViewType {
```

**File**: `Sources/ViewInspector/SwiftUI/Sheet.swift` (modified, +3/-1)
```diff
@@ -145,7 +145,9 @@ internal extension ViewType.Sheet {
         }
 
         func buildPopup() throws -> Any {
-            guard let view = try? Inspector.attribute(path: "modifier|content|some", value: body())
+            let body = try body()
+            let paths = ["modifier|content|some", "content|modifier|content|some"]
+            guard let view = paths.lazy.compactMap({ try? Inspector.attribute(path: $0, value: body) }).first
             else { throw InspectionError.viewNotFound(parent: name) }
             return try Self.unwrapPopupContent(view)
         }
```

**File**: `Tests/ViewInspectorTests/SwiftUI/ChartTests.swift` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#if canImport(Charts)
+#if canImport(Charts) && !os(visionOS)
 import XCTest
 import SwiftUI
 import Charts
```

**File**: `Tests/ViewInspectorTests/SwiftUI/ToolbarTests.swift` (modified, +9/-5)
```diff
@@ -2,17 +2,19 @@ import XCTest
 import SwiftUI
 @testable import ViewInspector
 
-@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+#if !os(tvOS) && !os(watchOS) && !os(visionOS)
+@available(iOS 16.0, macOS 13.0, *)
 private extension ToolbarContent {
     @ToolbarContentBuilder
     func vi_conditionallyHideSharedBackground() -> some ToolbarContent {
-        if #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *) {
+        if #available(iOS 26.0, macOS 26.0, *) {
             sharedBackgroundVisibility(.hidden)
         } else {
             self
         }
     }
 }
+#endif
 
 @MainActor
 @available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
@@ -116,8 +118,9 @@ final class ToolbarTests: XCTestCase {
     // `itemGroup(_:)` handed this wrapper straight to `guardType`, which rejected it because
     // it isn't literally `ToolbarItem`/`ToolbarItemGroup`, regardless of what the caller was
     // searching for downstream.
+#if !os(tvOS) && !os(watchOS) && !os(visionOS)
     func testToolbarItemWrappedByAvailabilityGatedModifier() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView()
             .toolbar {
@@ -129,7 +132,7 @@ final class ToolbarTests: XCTestCase {
     }
 
     func testToolbarItemGroupWrappedByAvailabilityGatedModifier() throws {
-        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+        guard #available(iOS 26.0, macOS 26.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView()
             .toolbar {
@@ -141,7 +144,7 @@ final class ToolbarTests: XCTestCase {
     }
 
     func testToolbarItemWrappedByConditionallyCompiledModifier() throws {
-        guard #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+        guard #available(iOS 16.0, macOS 13.0, *)
         else { throw XCTSkip() }
         let sut = EmptyView()
             .toolbar {
@@ -151,6 +154,7 @@ final class ToolbarTests: XCTestCase {
         let text = try sut.inspect().toolbar().item().text().string()
         XCTAssertEqual(text, "abc")
     }
+#endif
 
     func testImplicitToolbarItemGroup() throws {
         guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
```

---

### Incident Patch 7: `7fffbaec` (2026-09-20)
**Commit Message**: fix Tests availability for older iOS

**File**: `Tests/ViewInspectorTests/SwiftUI/GlassEffectContainerTests.swift` (modified, +48/-1)
```diff
@@ -5,17 +5,20 @@ import SwiftUI
 @testable import ViewInspector
 
 @MainActor
-@available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
 final class GlassEffectContainerTests: XCTestCase {
 
     // MARK: - GlassEffectContainer Tests
 
     func testExtractionFromSingleViewContainer() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let view = AnyView(GlassEffectContainer { Text("Test") })
         XCTAssertNoThrow(try view.inspect().anyView().glassEffectContainer())
     }
 
     func testExtractionFromMultipleViewContainer() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let view = HStack {
             GlassEffectContainer { Text("First") }
             GlassEffectContainer { Text("Second") }
@@ -25,6 +28,8 @@ final class GlassEffectContainerTests: XCTestCase {
     }
 
     func testContentExtraction() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = GlassEffectContainer {
             Text("Hello")
             Text("World")
@@ -36,6 +41,8 @@ final class GlassEffectContainerTests: XCTestCase {
     }
 
     func testSpacingCustom() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = GlassEffectContainer(spacing: 20) {
             Text("Test")
         }
@@ -44,6 +51,8 @@ final class GlassEffectContainerTests: XCTestCase {
     }
 
     func testSearchForChildInsideGlassEffectContainer() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let view = VStack {
             Text("Before")
             GlassEffectContainer {
@@ -60,23 +69,31 @@ final class GlassEffectContainerTests: XCTestCase {
     // MARK: - glassEffect Modifier Tests
 
     func testGlassEffectModifier() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffect()
         XCTAssertNoThrow(try sut.inspect().text().glassEffect())
     }
 
     func testGlassEffectTintColorNil() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffect()
         let glass = try sut.inspect().text().glassEffect()
         XCTAssertNil(try glass.tintColor())
     }
 
     func testGlassEffectTintColorRed() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffect(.regular.tint(.red))
         let glass = try sut.inspect().text().glassEffect()
         XCTAssertEqual(try glass.tintColor(), .red)
     }
 
     func testGlassEffectShape() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffect(in: RoundedRectangle(cornerRadius: 10))
         let glass = try sut.inspect().text().glassEffect()
         let shape = try glass.shape(RoundedRectangle.self)
@@ -87,18 +104,24 @@ final class GlassEffectContainerTests: XCTestCase {
     // MARK: - glassEffectTransition Modifier Tests
 
     func testGlassEffectTransitionMaterialize() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffectTransition(.materialize)
         let transition = try sut.inspect().text().glassEffectTransition()
         XCTAssertEqual(transition, .materialize)
     }
 
     func testGlassEffectTransitionMatchedGeometry() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffectTransition(.matchedGeometry)
         let transition = try sut.inspect().text().glassEffectTransition()
         XCTAssertEqual(transition, .matchedGeometry)
     }
 
     func testGlassEffectTransitionIdentity() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffectTransition(.identity)
         let transition = try sut.inspect().text().glassEffectTransition()
         XCTAssertEqual(transition, .identity)
@@ -109,6 +132,8 @@ final class GlassEffectContainerTests: XCTestCase {
     @Namespace var ns
 
     func testGlassEffectID() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = Text("Test").glassEffectID("testID", in: ns)
         let result = try sut.inspect().text().glassEffectID()
         XCTAssertEqual(result.id, AnyHashable("testID"))
@@ -118,6 +143,8 @@ final class GlassEffectContainerTests
```

**File**: `Tests/ViewInspectorTests/SwiftUI/SubviewsTests.swift` (modified, +20/-1)
```diff
@@ -3,12 +3,13 @@ import SwiftUI
 @testable import ViewInspector
 
 @MainActor
-@available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
 final class SubviewsTests: XCTestCase {
 
     // MARK: - Group(subviews:)
 
     func testGroupSubviewsSingleSubview() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = Group(subviews: HStack { Text("First"); Text("Second") }) { subviews in
             ForEach(Array(subviews.enumerated()), id: \.offset) { _, subview in subview }
         }
@@ -20,6 +21,8 @@ final class SubviewsTests: XCTestCase {
     }
 
     func testGroupSubviewsMultipleSubviews() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = SubviewsContainer { Text("First"); Text("Second"); Text("Third") }
         let sut = try view.inspect().view(SubviewsContainer<TupleView<(Text, Text, Text)>>.self).group()
         XCTAssertEqual(sut.count, 3)
@@ -28,12 +31,16 @@ final class SubviewsTests: XCTestCase {
     }
 
     func testGroupSubviewsSearch() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = AnyView(Group(subviews: VStack { Text("First") }) { $0 })
         XCTAssertEqual(try view.inspect().find(text: "First").pathToRoot,
                        "anyView().group().vStack(0).text(0)")
     }
 
     func testGroupSubviewsTransformIsNotApplied() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = Group(subviews: VStack { Text("First") }) { subviews in
             ForEach(Array(subviews.enumerated()), id: \.offset) { index, subview in
                 subview.accessibilityIdentifier("subview-\(index)")
@@ -49,6 +56,8 @@ final class SubviewsTests: XCTestCase {
     // MARK: - Group(sections:)
 
     func testGroupSectionsContent() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = Group(sections: VStack {
             Section { Text("Content 1") } header: { Text("Header 1") }
             Section { Text("Content 2") } header: { Text("Header 2") }
@@ -64,6 +73,8 @@ final class SubviewsTests: XCTestCase {
     }
 
     func testGroupSectionsSearch() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = AnyView(Group(sections: VStack { Section { Text("First") } }) { _ in EmptyView() })
         XCTAssertEqual(try view.inspect().find(text: "First").pathToRoot,
                        "anyView().group().vStack(0).section(0).text(0)")
@@ -72,6 +83,8 @@ final class SubviewsTests: XCTestCase {
     // MARK: - ForEach(subviews:)
 
     func testForEachSubviews() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = ForEach(subviews: HStack { Text("First"); Text("Second") }) { subview in
             subview.border(Color.red)
         }
@@ -81,6 +94,8 @@ final class SubviewsTests: XCTestCase {
     }
 
     func testForEachSubviewsSearch() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = ForEach(subviews: VStack { Text("First") }) { $0 }
         XCTAssertEqual(try view.inspect().find(text: "First").pathToRoot,
                        "forEach().vStack(0).text(0)")
@@ -89,6 +104,8 @@ final class SubviewsTests: XCTestCase {
     // MARK: - ForEach(sections:)
 
     func testForEachSections() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = ForEach(sections: VStack {
             Section { Text("Content 1") } header: { Text("Header 1") }
         }) { section in
@@ -100,6 +117,8 @@ final class SubviewsTests: XCTestCase {
     }
 
     func testForEachSectionsSearch() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let view = ForEach(sections: VStack { Section { Text("First") } }) { _ in EmptyView() }
         XCTAssertEqual(try view.inspect().find(text: "First").pathToRoot,
                        "forEach().group(0).vStack(0).section(0).text(0)")
```

**File**: `Tests/ViewInspectorTests/SwiftUI/TabTests.swift` (modified, +22/-1)
```diff
@@ -3,12 +3,13 @@ import SwiftUI
 @testable import ViewInspector
 
 @MainActor
-@available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
 final class TabTests: XCTestCase {
 
     // MARK: - TabView with Tabs Count
 
     func testTabViewWithTabsReturnsCorrectCount() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("Received", systemImage: "tray.and.arrow.down.fill") {
                 Text("ReceivedView")
@@ -28,6 +29,8 @@ final class TabTests: XCTestCase {
     // MARK: - Tab Extraction
 
     func testTabExtractionFromTabView() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("First", systemImage: "1.circle") {
                 Text("First Content")
@@ -42,6 +45,8 @@ final class TabTests: XCTestCase {
     }
 
     func testTabExtractionFromAnyView() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         // Tab is not a View - it's a TabContent, so it can only be inside TabView
         // This test verifies tab extraction from a TabView wrapped in AnyView
         let sut = AnyView(
@@ -57,6 +62,8 @@ final class TabTests: XCTestCase {
     // MARK: - Tab Content Inspection
 
     func testTabContentInspection() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("First", systemImage: "1.circle") {
                 Text("First Content")
@@ -75,6 +82,8 @@ final class TabTests: XCTestCase {
     }
 
     func testTabWithComplexContent() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("Complex", systemImage: "star") {
                 VStack {
@@ -93,6 +102,8 @@ final class TabTests: XCTestCase {
     // MARK: - Tab Label Inspection
 
     func testTabLabelViewInspection() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("My Tab", systemImage: "star.fill") {
                 Text("Content")
@@ -108,6 +119,8 @@ final class TabTests: XCTestCase {
     // MARK: - Tab Role
 
     func testTabRoleNil() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("Test", systemImage: "star") {
                 Text("Content")
@@ -119,6 +132,8 @@ final class TabTests: XCTestCase {
     }
 
     func testTabRoleSearch() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("Search", systemImage: "magnifyingglass", role: .search) {
                 Text("Search Content")
@@ -132,6 +147,8 @@ final class TabTests: XCTestCase {
     // MARK: - Search Tests
 
     func testSearchForTabContent() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Tab("First", systemImage: "1.circle") {
                 Text("FindMe")
@@ -147,6 +164,8 @@ final class TabTests: XCTestCase {
     }
 
     func testSearchForTabInHierarchy() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = VStack {
             TabView {
                 Tab("First", systemImage: "1.circle") {
@@ -163,6 +182,8 @@ final class TabTests: XCTestCase {
     // MARK: - Traditional TabView still works
 
     func testTraditionalTabViewStillWorks() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = TabView {
             Text("First")
                 .tabItem { Label("First", systemImage: "1.circle") }
```

**File**: `Tests/ViewInspectorTests/SwiftUI/ToolbarTests.swift` (modified, +6/-3)
```diff
@@ -116,8 +116,9 @@ final class ToolbarTests: XCTestCase {
     // `itemGroup(_:)` handed this wrapper straight to `guardType`, which rejected it because
     // it isn't literally `ToolbarItem`/`ToolbarItemGroup`, regardless of what the caller was
     // searching for downstream.
-    @available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
     func testToolbarItemWrappedByAvailabilityGatedModifier() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = EmptyView()
             .toolbar {
                 ToolbarItem { Text("abc") }
@@ -127,8 +128,9 @@ final class ToolbarTests: XCTestCase {
         XCTAssertEqual(text, "abc")
     }
 
-    @available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
     func testToolbarItemGroupWrappedByAvailabilityGatedModifier() throws {
+        guard #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+        else { throw XCTSkip() }
         let sut = EmptyView()
             .toolbar {
                 ToolbarItemGroup { Text("abc") }
@@ -138,8 +140,9 @@ final class ToolbarTests: XCTestCase {
         XCTAssertEqual(text, "abc")
     }
 
-    @available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
     func testToolbarItemWrappedByConditionallyCompiledModifier() throws {
+        guard #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+        else { throw XCTSkip() }
         let sut = EmptyView()
             .toolbar {
                 ToolbarItem { Text("abc") }
```

**File**: `Tests/ViewInspectorTests/ViewModifiers/EventsModifiersTests.swift` (modified, +12/-1)
```diff
@@ -289,15 +289,18 @@ final class ViewEventsTests: XCTestCase {
 // MARK: - ViewScrollEventsTests
 
 @MainActor
-@available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
 final class ViewScrollEventsTests: XCTestCase {
 
     func testOnScrollVisibilityChange() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = EmptyView().onScrollVisibilityChange { _ in }
         XCTAssertNoThrow(try sut.inspect().emptyView())
     }
 
     func testOnScrollVisibilityChangeInspection() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let exp1 = XCTestExpectation(description: "\(#function)_visible")
         let exp2 = XCTestExpectation(description: "\(#function)_hidden")
         let sut = ScrollView {
@@ -319,6 +322,8 @@ final class ViewScrollEventsTests: XCTestCase {
     }
 
     func testOnScrollVisibilityChangeArgumentDelivery() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         var received: [Bool] = []
         let sut = EmptyView().onScrollVisibilityChange { received.append($0) }
         let view = try sut.inspect().emptyView()
@@ -329,6 +334,8 @@ final class ViewScrollEventsTests: XCTestCase {
     }
 
     func testOnScrollVisibilityChangeMultipleModifiers() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         var received: [String] = []
         let sut = EmptyView()
             .onScrollVisibilityChange(threshold: 0.1) { received.append("first: \($0)") }
@@ -342,13 +349,17 @@ final class ViewScrollEventsTests: XCTestCase {
     }
 
     func testOnScrollVisibilityChangeThreshold() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = EmptyView().padding()
             .onScrollVisibilityChange(threshold: 0.3) { _ in }
             .padding()
         XCTAssertEqual(try sut.inspect().emptyView().onScrollVisibilityChangeThreshold(), 0.3)
     }
 
     func testOnScrollVisibilityChangeMissingModifierError() throws {
+        guard #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *)
+        else { throw XCTSkip() }
         let sut = EmptyView().padding()
         XCTAssertThrows(
             try sut.inspect().emptyView().callOnScrollVisibilityChange(true),
```

---

### Incident Patch 8: `1602f336` (2026-09-14)
**Commit Message**: fix: Return empty AccessibilityTraits for merged trait modifiers

SwiftUI merges adjacent accessibility modifiers into a single
AccessibilityAttachmentModifier, and a trait set resolving to empty
contributes no entry to it. When the neighboring modifier stores a
property, the empty trait modifier becomes indistinguishable from no
trait modifier at all, so accessibilityTraits() threw instead of
returning an empty set.

Treat any accessibility attachment carrying no trait value as an empty
set, and throw only for a view with no attachment whatsoever. The
previous propertyless-attachment check is the zero-entry instance of
that same rule, so it is removed.

testMissingAccessibilityTraits changes accordingly: a label-only view
now reports an empty set, and the throw is asserted on a bare view.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `Sources/ViewInspector/Modifiers/AccessibilityTraitsModifiers.swift` (modified, +4/-32)
```diff
@@ -14,9 +14,10 @@ public extension InspectableView {
         let call = "accessibilityAddTraits"
         let traitSets = accessibilityTraitSets()
         guard !traitSets.isEmpty else {
-            /* A trait modifier that resolves to an empty set may leave no trait value
-               behind at all, in which case the empty set is still the correct answer. */
-            guard hasPropertylessAccessibilityAttachment() else {
+            /* A trait modifier resolving to an empty set contributes no value to the
+               accessibility attachment it is merged into, so an attachment carrying no
+               trait value is indistinguishable from an empty set, and reports one. */
+            guard !accessibilityAttachmentModifiers().isEmpty else {
                 throw InspectionError
                     .modifierNotFound(parent: Inspector.typeName(value: content.view),
                                       modifier: call, index: 0)
@@ -110,35 +111,6 @@ private extension InspectableView {
     func accessibilityAttachmentModifiers() -> [ModifierNameProvider] {
         return modifiersMatching { $0.modifierType.contains("AccessibilityAttachmentModifier") }
     }
-
-    /**
-     Newer versions of SwiftUI keep the accessibility properties in a type-keyed collection,
-     and a trait modifier that resolves to an empty set contributes no entry to it. Such a
-     modifier is only recognizable by the fact that it carries no accessibility properties
-     at all: every other accessibility modifier stores a value under its own key.
-     */
-    func hasPropertylessAccessibilityAttachment() -> Bool {
-        return accessibilityAttachmentModifiers().contains { modifier in
-            InspectableView.accessibilityPropertyStorages(in: modifier, depth: 0)
-                .contains { storage in
-                    let mirror = Mirror(reflecting: storage)
-                    return mirror.displayStyle == .collection && mirror.children.isEmpty
-                }
-        }
-    }
-
-    /// The values backing every `AccessibilityProperties` found in the modifier
-    private static func accessibilityPropertyStorages(in value: Any, depth: Int) -> [Any] {
-        if Inspector.typeName(value: value).contains("AccessibilityProperties") {
-            return Mirror(reflecting: value).children
-                .filter { $0.label == "storage" }
-                .map { $0.value }
-        }
-        guard depth < 8 else { return [] }
-        return Mirror(reflecting: value).children.flatMap {
-            accessibilityPropertyStorages(in: $0.value, depth: depth + 1)
-        }
-    }
     
     private static func accessibilityTraitSets(in value: Any, depth: Int) -> [AccessibilityTraitSetValue] {
         if let traitSet = AccessibilityTraitSetValue(anyValue: value) {
```

**File**: `Tests/ViewInspectorTests/ViewModifiers/AccessibilityModifiersTests.swift` (modified, +42/-2)
```diff
@@ -343,6 +343,39 @@ final class ViewAccessibilityActionTests: XCTestCase {
         XCTAssertEqual(sut5, AccessibilityTraits())
     }
 
+    func testAccessibilityEmptyTraitsMergedWithSiblingModifier() throws {
+        guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
+        else { return }
+        /* SwiftUI merges adjacent accessibility modifiers into a single
+           `AccessibilityAttachmentModifier`, and an empty trait set leaves no value in it. */
+        let sut1 = try EmptyView().accessibilityLabel(Text("abc")).accessibilityAddTraits([])
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut1, AccessibilityTraits())
+        let sut2 = try EmptyView().accessibilityAddTraits([]).accessibilityLabel(Text("abc"))
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut2, AccessibilityTraits())
+        let sut3 = try EmptyView().accessibilityHidden(true).accessibilityAddTraits([])
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut3, AccessibilityTraits())
+        let sut4 = try EmptyView().accessibilityLabel(Text("abc")).accessibilityRemoveTraits([])
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut4, AccessibilityTraits())
+    }
+
+    func testAccessibilityConditionalTraitsMergedWithSiblingModifier() throws {
+        guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
+        else { return }
+        func view(isSelected: Bool) -> some View {
+            EmptyView()
+                .accessibilityLabel(Text("abc"))
+                .accessibilityAddTraits(isSelected ? [.isSelected] : [])
+        }
+        let sut1 = try view(isSelected: false).inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut1, AccessibilityTraits())
+        let sut2 = try view(isSelected: true).inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut2, .isSelected)
+    }
+
     func testAccessibilityEmptyAndNonEmptyTraitsInspection() throws {
         let sut1 = try EmptyView()
             .accessibility(addTraits: AccessibilityTraits())
@@ -383,12 +416,19 @@ final class ViewAccessibilityActionTests: XCTestCase {
     }
     
     func testMissingAccessibilityTraits() throws {
-        let sut = try EmptyView().accessibility(label: Text("abc"))
-            .inspect().emptyView()
+        let sut = try EmptyView().inspect().emptyView()
         XCTAssertThrows(
             try sut.accessibilityTraits(),
             "EmptyView does not have 'accessibilityAddTraits' modifier")
     }
+
+    func testAccessibilityTraitsWithoutTraitModifier() throws {
+        /* An accessibility modifier that stores no trait value is indistinguishable
+           from a trait modifier resolving to an empty set, so it reports an empty set. */
+        let sut = try EmptyView().accessibility(label: Text("abc"))
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut, AccessibilityTraits())
+    }
     
     func testAccessibilitySortPriority() throws {
         let sut = EmptyView().accessibility(sortPriority: 5)
```

---

### Incident Patch 9: `d9ff2065` (2026-09-13)
**Commit Message**: Merge branch 'tc-sgupta-fix/toolbar-conditional-content-409' into 0.10.4

**File**: `Sources/ViewInspector/SwiftUI/Toolbar.swift` (modified, +48/-3)
```diff
@@ -103,12 +103,12 @@ public extension InspectableView where View == ViewType.Toolbar {
     }
 
     func item(_ index: Int = 0) throws -> InspectableView<ViewType.Toolbar.Item> {
-        let element = try self.element(index)
+        let element = try Inspector.unwrapTransparentToolbarWrapper(self.element(index))
         return try .init(Content(element, medium: content.medium), parent: self, index: index)
     }
-    
+
     func itemGroup(_ index: Int = 0) throws -> InspectableView<ViewType.Toolbar.ItemGroup> {
-        let element = try self.element(index)
+        let element = try Inspector.unwrapTransparentToolbarWrapper(self.element(index))
         return try .init(Content(element, medium: content.medium), parent: self, index: index)
     }
     
@@ -131,6 +131,51 @@ public extension InspectableView where View == ViewType.Toolbar {
     }
 }
 
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+internal extension Inspector {
+
+    static func unwrapTransparentToolbarWrapper(_ value: Any) throws -> Any {
+        var current = value
+        var unwrapped = false
+        while !unwrapped {
+            switch Inspector.typeName(value: current, generics: .remove) {
+            case "TupleToolbarContent":
+                guard let next = try? unwrapSingleElementTupleToolbarContent(current) else { return current }
+                current = next
+            case "_ConditionalContent":
+                guard let next = try? unwrapConditionalToolbarContent(current) else { return current }
+                current = next
+            case "LimitedAvailabilityToolbarContent":
+                guard let storage = try? Inspector.attribute(label: "storage", value: current),
+                      let boxedContent = try? Inspector.attribute(label: "content", value: storage),
+                      let next = try? unwrapSingleElementTupleToolbarContent(boxedContent) else {
+                    return current
+                }
+                current = next
+            case "ToolbarModifiedContent":
+                guard let next = try? Inspector.attribute(label: "content", value: current) else { return current }
+                current = next
+            default:
+                unwrapped = true
+                return current
+            }
+        }
+        return current
+    }
+
+    private static func unwrapConditionalToolbarContent(_ value: Any) throws -> Any {
+        let storage = try Inspector.attribute(label: "storage", value: value)
+        if let trueContent = try? Inspector.attribute(label: "trueContent", value: storage) {
+            return trueContent
+        }
+        return try Inspector.attribute(label: "falseContent", value: storage)
+    }
+
+    private static func unwrapSingleElementTupleToolbarContent(_ value: Any) throws -> Any {
+        return try Inspector.attribute(label: "value", value: value)
+    }
+}
+
 @available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
 private extension Content {
     func toolbarElementsCount() -> Int {
```

**File**: `Tests/ViewInspectorTests/SwiftUI/ToolbarTests.swift` (modified, +54/-1)
```diff
@@ -2,10 +2,22 @@ import XCTest
 import SwiftUI
 @testable import ViewInspector
 
+@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+private extension ToolbarContent {
+    @ToolbarContentBuilder
+    func vi_conditionallyHideSharedBackground() -> some ToolbarContent {
+        if #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *) {
+            sharedBackgroundVisibility(.hidden)
+        } else {
+            self
+        }
+    }
+}
+
 @MainActor
 @available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
 final class ToolbarTests: XCTestCase {
-    
+
     func testToolbarItemPlacementEquatable() throws {
         guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
         else { throw XCTSkip() }
@@ -96,6 +108,47 @@ final class ToolbarTests: XCTestCase {
                         "View for toolbar item at index 2 is absent")
     }
     
+    // https://github.com/nalexn/ViewInspector/issues/409
+    // `if #available { ... } else { ... }` inside a `@ToolbarContentBuilder` compiles to
+    // `_ConditionalContent<TrueBranch, FalseBranch>`. When the true branch calls an
+    // availability-limited API (like `sharedBackgroundVisibility`, iOS 26+), the compiler
+    // further wraps it in `LimitedAvailabilityToolbarContent`. Previously `item(_:)`/
+    // `itemGroup(_:)` handed this wrapper straight to `guardType`, which rejected it because
+    // it isn't literally `ToolbarItem`/`ToolbarItemGroup`, regardless of what the caller was
+    // searching for downstream.
+    @available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+    func testToolbarItemWrappedByAvailabilityGatedModifier() throws {
+        let sut = EmptyView()
+            .toolbar {
+                ToolbarItem { Text("abc") }
+                    .sharedBackgroundVisibility(.hidden)
+            }
+        let text = try sut.inspect().toolbar().item().text().string()
+        XCTAssertEqual(text, "abc")
+    }
+
+    @available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+    func testToolbarItemGroupWrappedByAvailabilityGatedModifier() throws {
+        let sut = EmptyView()
+            .toolbar {
+                ToolbarItemGroup { Text("abc") }
+                    .sharedBackgroundVisibility(.hidden)
+            }
+        let text = try sut.inspect().toolbar().itemGroup().text().string()
+        XCTAssertEqual(text, "abc")
+    }
+
+    @available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+    func testToolbarItemWrappedByConditionallyCompiledModifier() throws {
+        let sut = EmptyView()
+            .toolbar {
+                ToolbarItem { Text("abc") }
+                    .vi_conditionallyHideSharedBackground()
+            }
+        let text = try sut.inspect().toolbar().item().text().string()
+        XCTAssertEqual(text, "abc")
+    }
+
     func testImplicitToolbarItemGroup() throws {
         guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
         else { throw XCTSkip() }
```

---

### Incident Patch 10: `08c579b6` (2026-09-13)
**Commit Message**: Merge branch 'fix/toolbar-conditional-content-409' of github.com:tc-sgupta/ViewInspector into tc-sgupta-fix/toolbar-conditional-content-409

**File**: `Sources/ViewInspector/SwiftUI/Toolbar.swift` (modified, +69/-3)
```diff
@@ -103,12 +103,12 @@ public extension InspectableView where View == ViewType.Toolbar {
     }
 
     func item(_ index: Int = 0) throws -> InspectableView<ViewType.Toolbar.Item> {
-        let element = try self.element(index)
+        let element = try Inspector.resolveTransparentToolbarWrapper(self.element(index))
         return try .init(Content(element, medium: content.medium), parent: self, index: index)
     }
-    
+
     func itemGroup(_ index: Int = 0) throws -> InspectableView<ViewType.Toolbar.ItemGroup> {
-        let element = try self.element(index)
+        let element = try Inspector.resolveTransparentToolbarWrapper(self.element(index))
         return try .init(Content(element, medium: content.medium), parent: self, index: index)
     }
     
@@ -131,6 +131,72 @@ public extension InspectableView where View == ViewType.Toolbar {
     }
 }
 
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+internal extension Inspector {
+
+    /// Peels away compiler-synthesized wrappers that a `#available`-gated `ToolbarContent`
+    /// modifier (e.g. `.sharedBackgroundVisibility(_:)`, introduced in iOS 26) inserts around
+    /// a `ToolbarItem`/`ToolbarItemGroup`, so `item(_:)`/`itemGroup(_:)` can hand a real
+    /// `ToolbarItem`/`ToolbarItemGroup` value to `guardType`.
+    ///
+    /// `if #available { ... } else { ... }` inside a `@ToolbarContentBuilder` compiles to
+    /// `_ConditionalContent<TrueBranch, FalseBranch>`. When the true branch calls an
+    /// availability-limited API (as `sharedBackgroundVisibility` does), the compiler further
+    /// wraps it in `LimitedAvailabilityToolbarContent`, whose payload is boxed inside a
+    /// single-element `TupleToolbarContent` and then a `ToolbarModifiedContent` pairing the
+    /// original `ToolbarItem` with the applied modifier. None of these three types are
+    /// `ToolbarItem`/`ToolbarItemGroup` themselves, so `guardType` rejects them outright
+    /// (see https://github.com/nalexn/ViewInspector/issues/409) unless resolved first.
+    ///
+    /// Resolution is best-effort: if a hop's expected shape isn't found (e.g. a future SDK
+    /// changes the internal layout), the value from before that hop is returned as-is so
+    /// existing behavior for plain `ToolbarItem`/`ToolbarItemGroup` values is unaffected.
+    static func resolveTransparentToolbarWrapper(_ value: Any) throws -> Any {
+        var current = value
+        for _ in 0..<10 {
+            switch Inspector.typeName(value: current, generics: .remove) {
+            case "TupleToolbarContent":
+                // Only the single-element shape (wrapping one of the other transparent
+                // wrappers below) is transparent here; the general multi-element tuple case
+                // is already handled positionally by `element(_:)` above.
+                guard let next = try? resolveSingleElementTupleToolbarContent(current) else { return current }
+                current = next
+            case "_ConditionalContent":
+                guard let next = try? resolveConditionalToolbarContent(current) else { return current }
+                current = next
+            case "LimitedAvailabilityToolbarContent":
+                guard let storage = try? Inspector.attribute(label: "storage", value: current),
+                      let boxedContent = try? Inspector.attribute(label: "content", value: storage),
+                      let next = try? resolveSingleElementTupleToolbarContent(boxedContent) else {
+                    return current
+                }
+                current = next
+            case "ToolbarModifiedContent":
+                guard let next = try? Inspector.attribute(label: "content", value: current) else { return current }
+                current = next
+            default:
+                return current
+            }
+        }
+        return current
+    }
+
+    private static func resolveConditionalToolbarContent(_ value: Any) throws -> Any {
+        let storage = try Inspector.attribute(label: "storage", value: value)
+        if let trueContent = try? Inspector.attribute(label: "trueContent", value: storage) {
+            return trueContent
+        }
+        return try Inspector.attribute(label: "falseContent", value: storage)
+    }
+
+    /// `TupleToolbarContent` wrapping a single element stores it directly under `value`
+    /// rather than as a Swift tuple needing positional (`.0`) access — mirrors the
+    /// single-item fallback already used by `element(_:)` above.
+    private static func resolveSingleElementTupleToolbarContent(_ value: Any) throws -> Any {
+        return try Inspector.attribute(label: "value", value: value)
+    }
+}
+
 @available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
 private extension Content {
     func toolbarElementsCount() -> Int {
```

**File**: `Tests/ViewInspectorTests/SwiftUI/ToolbarTests.swift` (modified, +55/-1)
```diff
@@ -2,10 +2,22 @@ import XCTest
 import SwiftUI
 @testable import ViewInspector
 
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+private extension ToolbarContent {
+    @ToolbarContentBuilder
+    func vi_conditionallyHideSharedBackground() -> some ToolbarContent {
+        if #available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *) {
+            sharedBackgroundVisibility(.hidden)
+        } else {
+            self
+        }
+    }
+}
+
 @MainActor
 @available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
 final class ToolbarTests: XCTestCase {
-    
+
     func testToolbarItemPlacementEquatable() throws {
         guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
         else { throw XCTSkip() }
@@ -96,6 +108,48 @@ final class ToolbarTests: XCTestCase {
                         "View for toolbar item at index 2 is absent")
     }
     
+    // https://github.com/nalexn/ViewInspector/issues/409
+    // `if #available { ... } else { ... }` inside a `@ToolbarContentBuilder` compiles to
+    // `_ConditionalContent<TrueBranch, FalseBranch>`. When the true branch calls an
+    // availability-limited API (like `sharedBackgroundVisibility`, iOS 26+), the compiler
+    // further wraps it in `LimitedAvailabilityToolbarContent`. Previously `item(_:)`/
+    // `itemGroup(_:)` handed this wrapper straight to `guardType`, which rejected it because
+    // it isn't literally `ToolbarItem`/`ToolbarItemGroup`, regardless of what the caller was
+    // searching for downstream.
+    @available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+    func testToolbarItemWrappedByAvailabilityGatedModifier() throws {
+        let sut = EmptyView()
+            .toolbar {
+                ToolbarItem { Text("abc") }
+                    .sharedBackgroundVisibility(.hidden)
+            }
+        let text = try sut.inspect().toolbar().item().text().string()
+        XCTAssertEqual(text, "abc")
+    }
+
+    @available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, visionOS 26.0, *)
+    func testToolbarItemGroupWrappedByAvailabilityGatedModifier() throws {
+        let sut = EmptyView()
+            .toolbar {
+                ToolbarItemGroup { Text("abc") }
+                    .sharedBackgroundVisibility(.hidden)
+            }
+        let text = try sut.inspect().toolbar().itemGroup().text().string()
+        XCTAssertEqual(text, "abc")
+    }
+
+    // Reproduces the exact shape from #409: the availability check lives in a helper
+    // extension the caller applies inline, rather than at the `.toolbar { }` call site.
+    func testToolbarItemWrappedByConditionallyCompiledModifier() throws {
+        let sut = EmptyView()
+            .toolbar {
+                ToolbarItem { Text("abc") }
+                    .vi_conditionallyHideSharedBackground()
+            }
+        let text = try sut.inspect().toolbar().item().text().string()
+        XCTAssertEqual(text, "abc")
+    }
+
     func testImplicitToolbarItemGroup() throws {
         guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
         else { throw XCTSkip() }
```

---

### Incident Patch 11: `53543148` (2026-09-10)
**Commit Message**: fix: Return empty AccessibilityTraits for no-op trait modifiers

`accessibilityTraits()` threw `modifierNotFound` when a view's only trait
modifier resolved to an empty set, e.g. `accessibilityAddTraits([])` or the
false arm of `accessibilityAddTraits(cond ? [.isSelected] : [])`.

This is a SwiftUI runtime behavior change, not a long-standing bug: on the
iOS 26 runtime `AccessibilityProperties` is a struct with a named `traits`
field that is populated even for an empty set (value 0, mask 0), so the lookup
found it. On the iOS 27 runtime the properties are stored in a type-keyed
collection and an empty trait set contributes no `TraitsKey` entry at all,
leaving nothing for the reflection walk to find. It reproduces under both
Xcode 26.6 and Xcode 27 whenever the iOS 27 runtime is used.

The `AccessibilityAttachmentModifier` itself is still emitted, so the empty set
is recoverable: every other accessibility modifier stores a value under its own
key, which makes an attachment carrying no properties whatsoever the signature
of a trait modifier that contributed no bits. A view with no trait modifier at
all still throws, as does one whose only accessibility modifier stores some
other prop

**File**: `Sources/ViewInspector/Modifiers/AccessibilityTraitsModifiers.swift` (modified, +42/-4)
```diff
@@ -14,9 +14,14 @@ public extension InspectableView {
         let call = "accessibilityAddTraits"
         let traitSets = accessibilityTraitSets()
         guard !traitSets.isEmpty else {
-            throw InspectionError
-                .modifierNotFound(parent: Inspector.typeName(value: content.view),
-                                  modifier: call, index: 0)
+            /* A trait modifier that resolves to an empty set may leave no trait value
+               behind at all, in which case the empty set is still the correct answer. */
+            guard hasPropertylessAccessibilityAttachment() else {
+                throw InspectionError
+                    .modifierNotFound(parent: Inspector.typeName(value: content.view),
+                                      modifier: call, index: 0)
+            }
+            return AccessibilityTraits()
         }
         let rawValue = traitSets.reduce(UInt64(0)) { result, traitSet in
             (result & ~traitSet.mask) | (traitSet.value & traitSet.mask)
@@ -97,10 +102,43 @@ private extension InspectableView {
     
     /// The traits from every `AccessibilityAttachmentModifier`, in the order they were applied
     func accessibilityTraitSets() -> [AccessibilityTraitSetValue] {
-        return modifiersMatching { $0.modifierType.contains("AccessibilityAttachmentModifier") }
+        return accessibilityAttachmentModifiers()
             .reversed()
             .flatMap { InspectableView.accessibilityTraitSets(in: $0, depth: 0) }
     }
+
+    func accessibilityAttachmentModifiers() -> [ModifierNameProvider] {
+        return modifiersMatching { $0.modifierType.contains("AccessibilityAttachmentModifier") }
+    }
+
+    /**
+     Newer versions of SwiftUI keep the accessibility properties in a type-keyed collection,
+     and a trait modifier that resolves to an empty set contributes no entry to it. Such a
+     modifier is only recognizable by the fact that it carries no accessibility properties
+     at all: every other accessibility modifier stores a value under its own key.
+     */
+    func hasPropertylessAccessibilityAttachment() -> Bool {
+        return accessibilityAttachmentModifiers().contains { modifier in
+            InspectableView.accessibilityPropertyStorages(in: modifier, depth: 0)
+                .contains { storage in
+                    let mirror = Mirror(reflecting: storage)
+                    return mirror.displayStyle == .collection && mirror.children.isEmpty
+                }
+        }
+    }
+
+    /// The values backing every `AccessibilityProperties` found in the modifier
+    private static func accessibilityPropertyStorages(in value: Any, depth: Int) -> [Any] {
+        if Inspector.typeName(value: value).contains("AccessibilityProperties") {
+            return Mirror(reflecting: value).children
+                .filter { $0.label == "storage" }
+                .map { $0.value }
+        }
+        guard depth < 8 else { return [] }
+        return Mirror(reflecting: value).children.flatMap {
+            accessibilityPropertyStorages(in: $0.value, depth: depth + 1)
+        }
+    }
     
     private static func accessibilityTraitSets(in value: Any, depth: Int) -> [AccessibilityTraitSetValue] {
         if let traitSet = AccessibilityTraitSetValue(anyValue: value) {
```

**File**: `Tests/ViewInspectorTests/ViewModifiers/AccessibilityModifiersTests.swift` (modified, +50/-1)
```diff
@@ -322,7 +322,56 @@ final class ViewAccessibilityActionTests: XCTestCase {
             .inspect().emptyView().accessibilityTraits()
         XCTAssertEqual(sut3, AccessibilityTraits())
     }
-    
+
+    func testAccessibilityEmptyTraitsInspection() throws {
+        let sut1 = try EmptyView().accessibility(addTraits: AccessibilityTraits())
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut1, AccessibilityTraits())
+        let sut2 = try EmptyView().accessibility(removeTraits: AccessibilityTraits())
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut2, AccessibilityTraits())
+        guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
+        else { return }
+        let sut3 = try EmptyView().accessibilityAddTraits([])
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut3, AccessibilityTraits())
+        let sut4 = try Text("abc").accessibilityAddTraits([])
+            .inspect().text().accessibilityTraits()
+        XCTAssertEqual(sut4, AccessibilityTraits())
+        let sut5 = try EmptyView().accessibilityRemoveTraits([])
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut5, AccessibilityTraits())
+    }
+
+    func testAccessibilityEmptyAndNonEmptyTraitsInspection() throws {
+        let sut1 = try EmptyView()
+            .accessibility(addTraits: AccessibilityTraits())
+            .accessibility(removeTraits: .isButton)
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut1, AccessibilityTraits())
+        let sut2 = try EmptyView()
+            .accessibility(addTraits: .isButton)
+            .accessibility(removeTraits: AccessibilityTraits())
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut2, .isButton)
+        let sut3 = try EmptyView()
+            .accessibility(addTraits: AccessibilityTraits())
+            .accessibility(removeTraits: AccessibilityTraits())
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut3, AccessibilityTraits())
+        guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
+        else { return }
+        let sut4 = try EmptyView().accessibilityAddTraits([]).accessibilityRemoveTraits(.isButton)
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut4, AccessibilityTraits())
+        let sut5 = try EmptyView().accessibilityAddTraits(.isButton).accessibilityRemoveTraits([])
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut5, .isButton)
+        let sut6 = try EmptyView().accessibilityAddTraits([]).accessibilityRemoveTraits([])
+            .inspect().emptyView().accessibilityTraits()
+        XCTAssertEqual(sut6, AccessibilityTraits())
+    }
+
     func testAccessibilityTraitsInspectionAmongOtherModifiers() throws {
         let sut = try EmptyView()
             .accessibility(label: Text("abc"))
```

---

### Incident Patch 12: `c9a17311` (2026-08-24)
**Commit Message**: fix: Crash when search traverses a Charts `Chart` view

`Chart`'s body is built from a `GeometryReader` whose content closure
requires a real layout context. ViewInspector feeds it a zero-filled
`GeometryProxy`, and Charts then traps on an implicitly unwrapped nil,
crashing any `find` that has to walk past a chart.

Register `Chart` as a known leaf view type so the search identifies it
and stops there instead of unwrapping its body. Nothing is lost: the
chart's contents are `ChartContent`, not `View`, so they were never
inspectable. Adds `chart()` / `chart(_ index:)` extraction.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `Sources/ViewInspector/SwiftUI/Chart.swift` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import SwiftUI
+
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+public extension ViewType {
+
+    /// `Chart` is an opaque view: its `body` is built from `GeometryReader` and other
+    /// internals that require a real layout context, so ViewInspector does not descend
+    /// into it. The chart's content is `ChartContent`, not `View`, and is not inspectable.
+    struct Chart: KnownViewType {
+        public static let typePrefix: String = "Chart"
+        public static var namespacedPrefixes: [String] {
+            return ["Charts." + typePrefix]
+        }
+        public static func inspectionCall(typeName: String) -> String {
+            return "chart(\(ViewType.indexPlaceholder))"
+        }
+    }
+}
+
+// MARK: - Extraction from SingleViewContent parent
+
+@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+public extension InspectableView where View: SingleViewContent {
+
+    func chart() throws -> InspectableView<ViewType.Chart> {
+        return try .init(try child(), parent: self)
+    }
+}
+
+// MARK: - Extraction from MultipleViewContent parent
+
+@available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+public extension InspectableView where View: MultipleViewContent {
+
+    func chart(_ index: Int) throws -> InspectableView<ViewType.Chart> {
+        return try .init(try child(at: index), parent: self, index: index)
+    }
+}
```

**File**: `Sources/ViewInspector/ViewSearchIndex.swift` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ internal extension ViewSearch {
             ViewType.AsyncImage.self,
             ViewType.Button.self,
             ViewType.Canvas.self,
+            ViewType.Chart.self,
             ViewType.Color.self,
             ViewType.ColorPicker.self,
             ViewType.ConfirmationDialog.self,
```

**File**: `Tests/ViewInspectorTests/SwiftUI/ChartTests.swift` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+#if canImport(Charts)
+import XCTest
+import SwiftUI
+import Charts
+@testable import ViewInspector
+
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+final class ChartTests: XCTestCase {
+
+    @MainActor
+    func testExtractionFromSingleViewContainer() throws {
+        guard #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+        else { throw XCTSkip() }
+        let view = AnyView(Chart { BarMark(x: .value("a", 1), y: .value("b", 2)) })
+        XCTAssertNoThrow(try view.inspect().anyView().chart())
+    }
+
+    @MainActor
+    func testExtractionFromMultipleViewContainer() throws {
+        guard #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+        else { throw XCTSkip() }
+        let view = HStack {
+            Chart { }
+            Chart { }
+        }
+        XCTAssertNoThrow(try view.inspect().hStack().chart(0))
+        XCTAssertNoThrow(try view.inspect().hStack().chart(1))
+    }
+
+    @MainActor
+    func testSearch() throws {
+        guard #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+        else { throw XCTSkip() }
+        let view = HStack { Chart { } }
+        XCTAssertEqual(try view.inspect().find(ViewType.Chart.self).pathToRoot,
+                       "hStack().chart(0)")
+    }
+
+    /// The `Chart` internals require a real layout context, so the search must not
+    /// descend into the chart's body.
+    @MainActor
+    func testSearchDoesNotDescendIntoChart() throws {
+        guard #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, *)
+        else { throw XCTSkip() }
+        let view = VStack {
+            Chart {
+                BarMark(x: .value("a", 1), y: .value("b", 2))
+            }
+            .chartXAxis(.hidden)
+            .id("chart")
+        }
+        XCTAssertNoThrow(try view.inspect().find(viewWithId: "chart"))
+        XCTAssertThrows(try view.inspect().find(viewWithId: "unknown"),
+                        "Search did not find a match")
+        XCTAssertThrows(try view.inspect().find(text: "a"),
+                        "Search did not find a match")
+    }
+}
+#endif
```

**File**: `readiness.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ This document reflects the current status of the [ViewInspector](https://github.
 |:white_check_mark:| ButtonStyleConfiguration.Label | |
 |:technologist:| CameraView | |
 |:white_check_mark:| Canvas | `symbols view`, `colorMode: ColorRenderingMode`, `opaque: Bool`, `rendersAsynchronously: Bool` |
-|:technologist:| Chart | |
+|:white_check_mark:| Chart | opaque view: the contents are `ChartContent`, not `View`, so there is nothing to inspect inside |
 |:white_check_mark:| Color | `value: Color`, `rgba: (Float, Float, Float, Float)`, `name: String` |
 |:white_check_mark:| ColorPicker | `label view`, `select(color: Color)` |
 |:white_check_mark:| ControlGroup | |
```

---

### Incident Patch 13: `71d3856b` (2026-08-24)
**Commit Message**: #425: Support TupleContent produced by ViewBuilder on iOS 27

The iOS 27 SDK adds a ViewBuilder.buildBlock overload returning TupleContent.
Since the overload returning TupleView is @_disfavoredOverload, multi-child
blocks are built as TupleContent in an iOS 27 availability context, keeping
the children under `content` instead of `value`. ToolbarContentBuilder
changed the same way.

Add ViewType.TupleContentView, inspected with tupleContentView(_:), and make
the tuple-ness checks accept either type.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `Sources/ViewInspector/InspectableView.swift` (modified, +6/-4)
```diff
@@ -28,8 +28,9 @@ public struct InspectableView<View> where View: BaseViewType {
     
     private static func build(content: Content, parent: UnwrappedView?, call: String, index: Int?) throws -> Self {
         if !View.typePrefix.isEmpty,
-           Inspector.isTupleView(content.view),
-           View.self != ViewType.TupleView.self {
+           Inspector.isViewTuple(content.view),
+           View.self != ViewType.TupleView.self,
+           View.self != ViewType.TupleContentView.self {
             throw InspectionError.notSupported(
                 "Unable to extract \(View.typePrefix): please specify its index inside parent view")
         }
@@ -204,10 +205,11 @@ internal extension InspectableView where View: MultipleViewContent {
             throw InspectionError.viewIndexOutOfBounds(index: index, count: viewes.count)
         }
         let child = try viewes.element(at: index)
-        if !isTupleExtraction && Inspector.isTupleView(child.view) {
+        if !isTupleExtraction && Inspector.isViewTuple(child.view) {
+            let call = Inspector.isTupleContentView(child.view) ? "tupleContentView" : "tupleView"
             throw InspectionError.notSupported(
                 // swiftlint:disable:next line_length
-                "Please insert .tupleView(\(index)) after \(Inspector.typeName(type: View.self)) for inspecting its children at index \(index)")
+                "Please insert .\(call)(\(index)) after \(Inspector.typeName(type: View.self)) for inspecting its children at index \(index)")
         }
         return child
     }
```

**File**: `Sources/ViewInspector/Inspector.swift` (modified, +15/-3)
```diff
@@ -389,16 +389,28 @@ internal extension Inspector {
     #endif
     static func viewsInContainer(view: Any, medium: Content.Medium) throws -> LazyGroup<Content> {
         let unwrappedContainer = try Inspector.unwrap(content: Content(view, medium: medium.resettingViewModifiers()))
-        guard Inspector.isTupleView(unwrappedContainer.view) else {
-            return LazyGroup(count: 1) { _ in unwrappedContainer }
+        if Inspector.isTupleView(unwrappedContainer.view) {
+            return try ViewType.TupleView.children(unwrappedContainer)
         }
-        return try ViewType.TupleView.children(unwrappedContainer)
+        if Inspector.isTupleContentView(unwrappedContainer.view) {
+            return try ViewType.TupleContentView.children(unwrappedContainer)
+        }
+        return LazyGroup(count: 1) { _ in unwrappedContainer }
     }
 
     static func isTupleView(_ view: Any) -> Bool {
         return Inspector.typeName(value: view, generics: .remove) == ViewType.TupleView.typePrefix
     }
 
+    static func isTupleContentView(_ view: Any) -> Bool {
+        return Inspector.typeName(value: view, generics: .remove) == ViewType.TupleContentView.typePrefix
+    }
+
+    /// `ViewBuilder` wraps multiple children in `TupleView`, or in `TupleContent` since iOS 27
+    static func isViewTuple(_ view: Any) -> Bool {
+        return isTupleView(view) || isTupleContentView(view)
+    }
+
     #if swift(>=6.0)
     @MainActor
     #endif
```

**File**: `Sources/ViewInspector/SwiftUI/Toolbar.swift` (modified, +12/-2)
```diff
@@ -114,7 +114,7 @@ public extension InspectableView where View == ViewType.Toolbar {
     
     private func element(_ index: Int) throws -> Any {
         if let value = try? Inspector
-            .attribute(path: "content|value|.\(index)", value: content.view) {
+            .attribute(path: "\(content.toolbarElementsPath)|.\(index)", value: content.view) {
             return value
         }
         if index == 0 {
@@ -133,12 +133,22 @@ public extension InspectableView where View == ViewType.Toolbar {
 
 @available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
 private extension Content {
+    /// Multiple toolbar elements are stored in a tuple, which since iOS 27
+    /// is `TupleContent` (keeping the tuple under `content`) instead of
+    /// `TupleView` (keeping it under `value`)
+    var toolbarElementsPath: String {
+        guard let root = try? Inspector.attribute(label: "content", value: view),
+              Inspector.isTupleContentView(root)
+        else { return "content|value" }
+        return "content|content"
+    }
+
     func toolbarElementsCount() -> Int {
         var index: Int = -1
         var couldLocateItem = false
         repeat {
             index += 1
-            couldLocateItem = (try? Inspector.attribute(path: "content|value|.\(index)", value: view)) != nil
+            couldLocateItem = (try? Inspector.attribute(path: "\(toolbarElementsPath)|.\(index)", value: view)) != nil
         } while couldLocateItem
         if index == 0,
            (try? Inspector.attribute(path: "content|value", value: view)) != nil
```

**File**: `Sources/ViewInspector/SwiftUI/TupleView.swift` (modified, +30/-1)
```diff
@@ -6,6 +6,15 @@ public extension ViewType {
     struct TupleView: KnownViewType {
         public static let typePrefix: String = "TupleView"
     }
+
+    /// Starting with iOS 27, `ViewBuilder` assembles multiple children
+    /// into `TupleContent` instead of `TupleView`
+    struct TupleContentView: KnownViewType {
+        public static let typePrefix: String = "TupleContent"
+        public static func inspectionCall(typeName: String) -> String {
+            return "tupleContentView(\(ViewType.indexPlaceholder))"
+        }
+    }
 }
 
 // MARK: - Content Extraction
@@ -14,7 +23,23 @@ public extension ViewType {
 extension ViewType.TupleView: MultipleViewContent {
     
     public static func children(_ content: Content) throws -> LazyGroup<Content> {
-        let tupleViews = try Inspector.attribute(label: "value", value: content.view)
+        return try ViewType.tupleChildren(content, label: "value")
+    }
+}
+
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+extension ViewType.TupleContentView: MultipleViewContent {
+
+    public static func children(_ content: Content) throws -> LazyGroup<Content> {
+        return try ViewType.tupleChildren(content, label: "content")
+    }
+}
+
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+internal extension ViewType {
+
+    static func tupleChildren(_ content: Content, label: String) throws -> LazyGroup<Content> {
+        let tupleViews = try Inspector.attribute(label: label, value: content.view)
         let childrenCount = Mirror(reflecting: tupleViews).children.count
         return LazyGroup(count: childrenCount) { index in
             let child = try Inspector.attribute(label: ".\(index)", value: tupleViews)
@@ -32,4 +57,8 @@ public extension InspectableView where View: MultipleViewContent {
     func tupleView(_ index: Int) throws -> InspectableView<ViewType.TupleView> {
         return try .init(try child(at: index, isTupleExtraction: true), parent: self, index: index)
     }
+
+    func tupleContentView(_ index: Int) throws -> InspectableView<ViewType.TupleContentView> {
+        return try .init(try child(at: index, isTupleExtraction: true), parent: self, index: index)
+    }
 }
```

**File**: `Sources/ViewInspector/ViewSearchIndex.swift` (modified, +2/-1)
```diff
@@ -89,6 +89,7 @@ internal extension ViewSearch {
             ViewType.Toggle.self,
             ViewType.TouchBar.self,
             ViewType.TupleView.self,
+            ViewType.TupleContentView.self,
             ViewType.Toolbar.self,
             ViewType.Toolbar.Item.self,
             ViewType.Toolbar.ItemGroup.self,
@@ -215,7 +216,7 @@ internal extension ViewSearch {
                 let descendants = try supplementary(parent)
                 return .init(count: descendants.count) { index -> UnwrappedView in
                     var view = try descendants.element(at: index)
-                    if Inspector.isTupleView(view.content.view) ||
+                    if Inspector.isViewTuple(view.content.view) ||
                         !(view is InspectableView<ViewType.ClassifiedView>) {
                         view.isUnwrappedSupplementaryChild = true
                         return view
```

**File**: `Tests/ViewInspectorTests/InspectorTests.swift` (modified, +3/-2)
```diff
@@ -168,8 +168,9 @@ final class InspectorTests: XCTestCase {
     func testTupleView() throws {
         let view = HStack { Text(""); Text("") }
         let content = try Inspector.attribute(path: "_tree|content", value: view)
-        XCTAssertTrue(Inspector.isTupleView(content))
-        XCTAssertFalse(Inspector.isTupleView((0, 2)))
+        // ViewBuilder produces `TupleContent` instead of `TupleView` since iOS 27
+        XCTAssertTrue(Inspector.isViewTuple(content))
+        XCTAssertFalse(Inspector.isViewTuple((0, 2)))
     }
     
     func testGuardType() throws {
```

**File**: `Tests/ViewInspectorTests/SwiftUI/TupleViewTests.swift` (modified, +157/-10)
```diff
@@ -17,13 +17,14 @@ final class TupleViewTests: XCTestCase {
     
     func testTupleInsideTupleView() throws {
         let view = TupleInsideTupleView(flag: true)
-        let string1 = try view.inspect().implicitAnyView().hStack().text(0).string()
+        let sut = try view.inspect().implicitAnyView().hStack()
+        let string1 = try sut.text(0).string()
         XCTAssertEqual(string1, "xyz")
-        XCTAssertThrows(try view.inspect().implicitAnyView().hStack().text(1),
-                        "Please insert .tupleView(1) after HStack for inspecting its children at index 1")
-        let string2 = try view.inspect().implicitAnyView().hStack().tupleView(1).text(0).string()
+        XCTAssertThrows(try sut.text(1),
+                        "Please insert .\(tupleCall)(1) after HStack for inspecting its children at index 1")
+        let string2 = try nestedTupleText(sut, tuple: 1, text: 0).string()
         XCTAssertEqual(string2, "abc")
-        let string3 = try view.inspect().implicitAnyView().hStack().tupleView(1).text(1).string()
+        let string3 = try nestedTupleText(sut, tuple: 1, text: 1).string()
         XCTAssertEqual(string3, "def")
     }
     
@@ -34,32 +35,159 @@ final class TupleViewTests: XCTestCase {
         XCTAssertEqual(try view1.inspect().find(text: "xyz").pathToRoot,
                        "view(TupleInsideTupleView.self).hStack().text(0)")
         XCTAssertEqual(try view1.inspect().find(text: "abc").pathToRoot,
-                       "view(TupleInsideTupleView.self).hStack().tupleView(1).text(0)")
+                       "view(TupleInsideTupleView.self).hStack().\(tupleCall)(1).text(0)")
         XCTAssertEqual(try view1.inspect().find(text: "def").pathToRoot,
-                       "view(TupleInsideTupleView.self).hStack().tupleView(1).text(1)")
+                       "view(TupleInsideTupleView.self).hStack().\(tupleCall)(1).text(1)")
         XCTAssertEqual(try view2.inspect().find(text: "xyz").pathToRoot,
                        "view(TupleInsideTupleView.self).hStack().text(0)")
         #else
         XCTAssertEqual(try view1.inspect().find(text: "xyz").pathToRoot,
                        "view(TupleInsideTupleView.self).anyView().hStack().text(0)")
         XCTAssertEqual(try view1.inspect().find(text: "abc").pathToRoot,
-                       "view(TupleInsideTupleView.self).anyView().hStack().tupleView(1).text(0)")
+                       "view(TupleInsideTupleView.self).anyView().hStack().\(tupleCall)(1).text(0)")
         XCTAssertEqual(try view1.inspect().find(text: "def").pathToRoot,
-                       "view(TupleInsideTupleView.self).anyView().hStack().tupleView(1).text(1)")
+                       "view(TupleInsideTupleView.self).anyView().hStack().\(tupleCall)(1).text(1)")
         XCTAssertEqual(try view2.inspect().find(text: "xyz").pathToRoot,
                        "view(TupleInsideTupleView.self).anyView().hStack().text(0)")
         #endif
         XCTAssertThrows(try view2.inspect().find(text: "abc"), "Search did not find a match")
         XCTAssertThrows(try view2.inspect().find(text: "def"), "Search did not find a match")
     }
     
+    func testMultipleChildrenInContainer() throws {
+        let view = VStack { Text("A"); Text("B") }
+        XCTAssertEqual(try view.inspect().vStack().text(0).string(), "A")
+        XCTAssertEqual(try view.inspect().vStack().text(1).string(), "B")
+        XCTAssertEqual(try view.inspect().find(text: "B").pathToRoot, "vStack().text(1)")
+    }
+
+    func testMultipleModifiedChildrenInContainer() throws {
+        guard #available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
+        else { throw XCTSkip() }
+        let view = DecoratedFieldsView()
+        XCTAssertEqual(try view.inspect().find(text: "Label").string(), "Label")
+        XCTAssertEqual(try view.inspect().find(ViewType.TextField.self).labelView().text().string(),
+                       "Placeholder")
+        XCTAssertEqual(try view.inspect().find(text: "Footer").string(), "Footer")
+    }
+
     func testResetsModifiers() throws {
         let view = TupleInsideTupleView(flag: true)
-        let sut = try view.inspect().implicitAnyView().hStack().tupleView(1).text(0)
+        let hStack = try view.inspect().implicitAnyView().hStack()
+        let sut = try nestedTupleText(hStack, tuple: 1, text: 0)
+        XCTAssertEqual(sut.content.medium.viewModifiers.count, 2)
+    }
+}
+
+// MARK: - Deployment target differences
+
+/// `ViewBuilder` assembles multiple children into `TupleContent` instead of
+/// `TupleView` when the deployment target is iOS 27 or above. The two are
+/// inspected with `tupleContentView(_:)` and `tupleView(_:)` respectively.
+@MainActor
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+private var tupleCall: String {
+    return Inspector.isTupleContentView(TupleProbeView().body) ? "tupleContentView" : "tupleView"
+}
+
+@MainActor
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+private func nestedTuple
```

---

### Incident Patch 14: `f110d97d` (2026-08-22)
**Commit Message**: fix: Failing tests compilation

**File**: `Sources/ViewInspector/SwiftUI/Sheet.swift` (modified, +4/-1)
```diff
@@ -174,7 +174,10 @@ internal extension ViewType.Sheet {
         var isSheetPresenter: Bool { true }
 
         private func body() throws -> Any {
-            return try ContentExtractor(source: modifier).extractContent(environmentObjects: [])
+            return try ContentExtractor(source: modifier)
+                .extractContent(medium: .init(
+                    viewModifiers: [], transitiveViewModifiers: [],
+                    environmentModifiers: [], environmentObjects: []))
         }
 
         /// Unwraps the `AnyView` and `SheetContent` wrappers SwiftUI puts around the user's view.
```

---

### Incident Patch 15: `49d0b64a` (2026-08-22)
**Commit Message**: Merge branch 'nh7a-nh7a/swiftui-native-sheet-d8d268' into 0.10.4

**File**: `Sources/ViewInspector/PopupPresenter.swift` (modified, +17/-5)
```diff
@@ -183,12 +183,16 @@ internal extension Content {
                 type: BasePopupPresenter.self, call: "", index: index ?? 0)
         else {
             _ = try standardPredicate(name)
-            throw InspectionError.notSupported(
-                """
-                Please refer to the Guide for inspecting the \(name): \
-                https://github.com/nalexn/ViewInspector/blob/master/guide_popups.md#\(name.lowercased())
-                """)
+            throw popupNotSupportedError(name)
         }
+        return try popup(parent: parent, index: index, name: name, popupPresenter: popupPresenter)
+    }
+
+    func popup<Popup: KnownViewType>(
+        parent: UnwrappedView, index: Int?,
+        name: String = Inspector.typeName(type: Popup.self),
+        popupPresenter: BasePopupPresenter
+    ) throws -> InspectableView<Popup> {
         #if swift(>=6.0)
         let popup = try build(popupPresenter: popupPresenter, name: name)
         #else
@@ -204,6 +208,14 @@ internal extension Content {
         return try .init(content, parent: parent, call: call, index: index)
     }
 
+    func popupNotSupportedError(_ name: String) -> InspectionError {
+        return .notSupported(
+            """
+            Please refer to the Guide for inspecting the \(name): \
+            https://github.com/nalexn/ViewInspector/blob/master/guide_popups.md#\(name.lowercased())
+            """)
+    }
+
     @MainActor
     private func build(popupPresenter: any BasePopupPresenter, name: String) throws -> Any {
         do {
```

**File**: `Sources/ViewInspector/SwiftUI/Sheet.swift` (modified, +113/-6)
```diff
@@ -61,9 +61,15 @@ public extension InspectableView {
 internal extension Content {
     
     func sheet(parent: UnwrappedView, index: Int?, name: String = "Sheet") throws -> InspectableView<ViewType.Sheet> {
-        return try popup(parent: parent, index: index, name: name,
-                         modifierPredicate: isSheetBuilder(modifier:),
-                         standardPredicate: standardSheetModifier)
+        guard let modifier = try? self.modifier(
+            isSheetBuilder(modifier:), call: name.firstLetterLowercased, index: index ?? 0)
+        else {
+            // The native modifier is either absent or opaque for the reflection
+            _ = try standardSheetModifier(name)
+            throw popupNotSupportedError(name)
+        }
+        let popupPresenter = try sheetPresenter(modifier: modifier, name: name)
+        return try popup(parent: parent, index: index, name: name, popupPresenter: popupPresenter)
     }
     
     func standardSheetModifier(_ name: String = "Sheet") throws -> Any {
@@ -85,11 +91,112 @@ internal extension Content {
         }
     }
 
+    private func sheetPresenter(modifier: Any, name: String) throws -> BasePopupPresenter {
+        if let presenter = try? Inspector.attribute(
+            label: "modifier", value: modifier, type: BasePopupPresenter.self) {
+            return presenter
+        }
+        let nativeModifier = try Inspector.attribute(label: "modifier", value: modifier)
+        return ViewType.Sheet.NativePresenter(modifier: nativeModifier, name: name)
+    }
+
     @MainActor
     private func isSheetBuilder(modifier: Any) -> Bool {
-        let presenter = try? Inspector.attribute(
-            label: "modifier", value: modifier, type: BasePopupPresenter.self)
-        return presenter?.isSheetPresenter == true
+        if let presenter = try? Inspector.attribute(
+            label: "modifier", value: modifier, type: BasePopupPresenter.self) {
+            return presenter.isSheetPresenter
+        }
+        guard let provider = modifier as? ModifierNameProvider,
+              provider.modifierType.contains("SheetPresentationModifier"),
+              let nativeModifier = try? Inspector.attribute(label: "modifier", value: modifier),
+              ViewType.Sheet.NativePresenter.isInspectable(modifier: nativeModifier),
+              let content = try? Inspector.attribute(label: "content", value: modifier)
+        else { return false }
+        // The modifiers extracted from a custom modifier's body are not reported here:
+        // a `PopupPresenter` is reported through its own presenter, and any other
+        // custom modifier hides the sheet behind its own `body`.
+        return Inspector.typeName(value: content, generics: .remove) != "_ViewModifier_Content"
+    }
+}
+
+// MARK: - Native modifier presenter
+
+@available(iOS 13.0, macOS 10.15, tvOS 13.0, *)
+internal extension ViewType.Sheet {
+
+    /// Adapts the native `.sheet` and `.fullScreenCover` modifiers to the `BasePopupPresenter` interface.
+    ///
+    /// The modifier's `body` assembles the sheet's content into an optional `AnyView`,
+    /// which stays `nil` while the sheet is not presented.
+    struct NativePresenter: BasePopupPresenter {
+
+        let modifier: Any
+        let name: String
+
+        // The memberwise init is isolated to the MainActor via `BasePopupPresenter`
+        nonisolated init(modifier: Any, name: String) {
+            self.modifier = modifier
+            self.name = name
+        }
+
+        /// The modifiers of the older SwiftUI versions don't expose the sheet's content.
+        static func isInspectable(modifier: Any) -> Bool {
+            return (try? ContentExtractor(source: modifier)) != nil
+        }
+
+        func buildPopup() throws -> Any {
+            guard let view = try? Inspector.attribute(path: "modifier|content|some", value: body())
+            else { throw InspectionError.viewNotFound(parent: name) }
+            return try Self.unwrapPopupContent(view)
+        }
+
+        func dismissPopup() {
+            if let isPresented = try? Inspector.attribute(
+                label: "_isPresented", value: modifier, type: Binding<Bool>.self) {
+                isPresented.wrappedValue = false
+            } else if let item = try? Inspector.attribute(label: "_item", value: modifier) as? NilAssignable {
+                item.assignNil()
+            } else {
+                assertionFailure(
+                    "\(Inspector.typeName(value: modifier)) does not have a presentation binding")
+                return
+            }
+            if let onDismiss = try? Inspector.attribute(
+                path: "onDismiss|some", value: modifier) as? () -> Void {
+                onDismiss()
+            }
+        }
+
+        func content() throws -> Content {
+            return try Inspector.unwrap(view: body(), medium: .empty)
+        }
+
+        var isSheetPresenter: Bool { true }
+
+        private func
```

**File**: `Tests/ViewInspectorTests/SwiftUI/FullScreenCoverTests.swift` (modified, +91/-17)
```diff
@@ -22,16 +22,65 @@ final class FullScreenCoverTests: XCTestCase {
                         "EmptyView does not have 'fullScreenCover' modifier")
     }
 
-    func testInspectionErrorCustomModifierRequired() throws {
+    func testNativeFullScreenCoverNotPresented() throws {
+        guard #available(iOS 14.0, tvOS 14.0, watchOS 7.0, *)
+        else { throw XCTSkip() }
+        let binding = Binding(wrappedValue: false)
+        let sut = EmptyView().fullScreenCover(isPresented: binding) { Text("abc") }
+        XCTAssertThrows(try sut.inspect().emptyView().fullScreenCover(),
+                        "View for FullScreenCover is absent")
+    }
+
+    func testNativeFullScreenCoverContentInspection() throws {
         guard #available(iOS 14.0, tvOS 14.0, watchOS 7.0, *)
         else { throw XCTSkip() }
         let binding = Binding(wrappedValue: true)
-        let sut = EmptyView().fullScreenCover(isPresented: binding) { Text("") }
+        let sut = EmptyView().fullScreenCover(isPresented: binding) { Text("abc") }
+        let title = try sut.inspect().emptyView().fullScreenCover().text()
+        XCTAssertEqual(try title.string(), "abc")
+        XCTAssertEqual(title.pathToRoot, "emptyView().fullScreenCover().text()")
+    }
+
+    func testNativeFullScreenCoverContentInteraction() throws {
+        guard #available(iOS 14.0, tvOS 14.0, watchOS 7.0, *)
+        else { throw XCTSkip() }
+        let binding = Binding(wrappedValue: true)
+        let sut = EmptyView().fullScreenCover(isPresented: binding) {
+            Text("abc")
+            Button("xyz", action: { binding.wrappedValue = false })
+        }
+        let button = try sut.inspect().emptyView().fullScreenCover().button(1)
+        try button.tap()
+        XCTAssertFalse(binding.wrappedValue)
+        XCTAssertEqual(button.pathToRoot, "emptyView().fullScreenCover().button(1)")
+    }
+
+    func testNativeFullScreenCoverDismiss() throws {
+        guard #available(iOS 14.0, tvOS 14.0, watchOS 7.0, *)
+        else { throw XCTSkip() }
+        let exp = XCTestExpectation(description: #function)
+        let binding = Binding(wrappedValue: true)
+        let sut = EmptyView().fullScreenCover(isPresented: binding, onDismiss: {
+            exp.fulfill()
+        }, content: { Text("") })
+        try sut.inspect().emptyView().fullScreenCover().dismiss()
+        XCTAssertFalse(binding.wrappedValue)
         XCTAssertThrows(try sut.inspect().emptyView().fullScreenCover(),
-            """
-            Please refer to the Guide for inspecting the FullScreenCover: \
-            https://github.com/nalexn/ViewInspector/blob/master/guide_popups.md#fullscreencover
-            """)
+                        "View for FullScreenCover is absent")
+        wait(for: [exp], timeout: 0.1)
+    }
+
+    func testNativeFullScreenCoverWithItemDismiss() throws {
+        guard #available(iOS 14.0, tvOS 14.0, watchOS 7.0, *)
+        else { throw XCTSkip() }
+        let binding = Binding<Int?>(wrappedValue: 6)
+        let sut = EmptyView().fullScreenCover(item: binding) { Text("\($0)") }
+        let cover = try sut.inspect().emptyView().fullScreenCover()
+        XCTAssertEqual(try cover.text().string(), "6")
+        try cover.dismiss()
+        XCTAssertNil(binding.wrappedValue)
+        XCTAssertThrows(try sut.inspect().emptyView().fullScreenCover(),
+                        "View for FullScreenCover is absent")
     }
 
     func testInspectionErrorFullScreenCoverNotPresented() throws {
@@ -144,18 +193,28 @@ final class FullScreenCoverTests: XCTestCase {
         #endif
         #if compiler(<6) || compiler(>=6.1)
         let title2 = try sut.inspect().implicitAnyView().hStack().emptyView(0).fullScreenCover(1).text(0)
-        XCTAssertEqual(try title2.string(), "title_3")
+        XCTAssertEqual(try title2.string(), "title_2")
         XCTAssertEqual(title2.pathToRoot,
             "view(FullScreenCoverFindTestView.self).hStack().emptyView(0).fullScreenCover(1).text(0)")
+        let title3 = try sut.inspect().implicitAnyView().hStack().emptyView(0).fullScreenCover(2).text(0)
+        XCTAssertEqual(try title3.string(), "title_3")
+        XCTAssertEqual(title3.pathToRoot,
+            "view(FullScreenCoverFindTestView.self).hStack().emptyView(0).fullScreenCover(2).text(0)")
         XCTAssertEqual(try sut.inspect().find(ViewType.FullScreenCover.self).text(0).string(), "title_1")
         #else
-        let title2 = try sut.inspect().implicitAnyView().hStack().anyView(0).anyView().fullScreenCover().text(0)
-        XCTAssertEqual(try title2.string(), "title_3")
+        let title2 = try sut.inspect().implicitAnyView().hStack().anyView(0).anyView().fullScreenCover(1).text(0)
+        XCTAssertEqual(try title2.string(), "title_2")
         XCTAssertEqual(title2.pathToRoot,
-            "view(FullScreenCoverFindTestView.self).anyView().hStack().anyView(0).anyView().fullScreenCover().text(0)")
+            "view(FullScreenCoverFindTestView.self).anyV
```

**File**: `Tests/ViewInspectorTests/SwiftUI/SheetTests.swift` (modified, +112/-12)
```diff
@@ -18,16 +18,88 @@ final class SheetTests: XCTestCase {
                         "EmptyView does not have 'sheet' modifier")
     }
     
-    func testInspectionErrorCustomModifierRequired() throws {
+    func testInspectionErrorSheetInsideCustomModifier() throws {
         let binding = Binding(wrappedValue: true)
-        let sut = EmptyView().sheet(isPresented: binding) { Text("") }
+        let sut = EmptyView().modifier(NonInspectableSheetModifier(isPresented: binding))
         XCTAssertThrows(try sut.inspect().emptyView().sheet(),
             """
             Please refer to the Guide for inspecting the Sheet: \
             https://github.com/nalexn/ViewInspector/blob/master/guide_popups.md#sheet
             """)
     }
 
+    func testNativeSheetNotPresented() throws {
+        let binding = Binding(wrappedValue: false)
+        let sut = EmptyView().sheet(isPresented: binding) { Text("abc") }
+        XCTAssertThrows(try sut.inspect().emptyView().sheet(),
+                        "View for Sheet is absent")
+    }
+
+    func testNativeSheetWithItemNotPresented() throws {
+        let binding = Binding<Int?>(wrappedValue: nil)
+        let sut = EmptyView().sheet(item: binding) { Text("\($0)") }
+        XCTAssertThrows(try sut.inspect().emptyView().sheet(),
+                        "View for Sheet is absent")
+    }
+
+    func testNativeSheetContentInspection() throws {
+        let binding = Binding(wrappedValue: true)
+        let sut = EmptyView().sheet(isPresented: binding) { Text("abc") }
+        let title = try sut.inspect().emptyView().sheet().text()
+        XCTAssertEqual(try title.string(), "abc")
+        XCTAssertEqual(title.pathToRoot, "emptyView().sheet().text()")
+    }
+
+    func testNativeSheetMultipleContentInspection() throws {
+        let binding = Binding(wrappedValue: true)
+        let sut = EmptyView().sheet(isPresented: binding) {
+            Text("abc")
+            Button("xyz", action: { binding.wrappedValue = false })
+        }
+        let button = try sut.inspect().emptyView().sheet().button(1)
+        try button.tap()
+        XCTAssertFalse(binding.wrappedValue)
+        XCTAssertEqual(button.pathToRoot, "emptyView().sheet().button(1)")
+    }
+
+    func testNativeSheetWithItemContentInspection() throws {
+        let binding = Binding<Int?>(wrappedValue: 6)
+        let sut = EmptyView().sheet(item: binding) { Text("\($0)") }
+        XCTAssertEqual(try sut.inspect().emptyView().sheet().text().string(), "6")
+    }
+
+    func testNativeSheetDismiss() throws {
+        let exp = XCTestExpectation(description: #function)
+        let binding = Binding(wrappedValue: true)
+        let sut = EmptyView().sheet(isPresented: binding, onDismiss: {
+            exp.fulfill()
+        }, content: { Text("") })
+        try sut.inspect().emptyView().sheet().dismiss()
+        XCTAssertFalse(binding.wrappedValue)
+        XCTAssertThrows(try sut.inspect().emptyView().sheet(), "View for Sheet is absent")
+        wait(for: [exp], timeout: 0.1)
+    }
+
+    func testNativeSheetWithItemDismiss() throws {
+        let exp = XCTestExpectation(description: #function)
+        let binding = Binding<Int?>(wrappedValue: 6)
+        let sut = EmptyView().sheet(item: binding, onDismiss: {
+            exp.fulfill()
+        }, content: { Text("\($0)") })
+        try sut.inspect().emptyView().sheet().dismiss()
+        XCTAssertNil(binding.wrappedValue)
+        XCTAssertThrows(try sut.inspect().emptyView().sheet(), "View for Sheet is absent")
+        wait(for: [exp], timeout: 0.1)
+    }
+
+    func testNativeSheetSearch() throws {
+        let binding = Binding(wrappedValue: true)
+        let sut = EmptyView().sheet(isPresented: binding) { Text("abc") }
+        XCTAssertEqual(try sut.inspect().find(ViewType.Sheet.self).text().string(), "abc")
+        XCTAssertEqual(try sut.inspect().find(text: "abc").pathToRoot,
+                       "emptyView().sheet().text()")
+    }
+
     func testInspectionErrorSheetNotPresented() throws {
         let binding = Binding(wrappedValue: false)
         let sut = EmptyView().sheet2(isPresented: binding) { Text("") }
@@ -113,22 +185,32 @@ final class SheetTests: XCTestCase {
         XCTAssertEqual(title1.pathToRoot,
             "view(SheetFindTestView.self).hStack().emptyView(0).sheet().text(0)")
         let title2 = try sut.inspect().hStack().emptyView(0).sheet(1).text(0)
-        XCTAssertEqual(try title2.string(), "title_3")
+        XCTAssertEqual(try title2.string(), "title_2")
         XCTAssertEqual(title2.pathToRoot,
             "view(SheetFindTestView.self).hStack().emptyView(0).sheet(1).text(0)")
+        let title3 = try sut.inspect().hStack().emptyView(0).sheet(2).text(0)
+        XCTAssertEqual(try title3.string(), "title_3")
+        XCTAssertEqual(title3.pathToRoot,
+            "view(SheetFindTestView.self).hStack().emptyView(0).sheet(2).text(0)")
         XCTAssertEqual(try sut.inspect().find(ViewType.Sheet.s
```

**File**: `guide_popups.md` (modified, +36/-12)
```diff
@@ -6,11 +6,11 @@
 - [FullScreenCover](#fullscreencover)
 - [Popover](#popover)
 
-These five types of views have many in common, so is their inspection mechanism. Due to limited capabilities of what can be achieved in reflection, the native SwiftUI modifiers for presenting these views (`.alert`, `.actionSheet`, `.sheet`, `.fullScreenCover`, `.popover`) cannot be inspected as-is by the ViewInspector.
+These five types of views have many in common, so is their inspection mechanism. Due to limited capabilities of what can be achieved in reflection, some of the native SwiftUI modifiers for presenting these views (`.alert`, `.actionSheet`, `.popover`) cannot be inspected as-is by the ViewInspector.
 
 This section discusses how you still can gain the full access to the internals of these views by adding a couple of code snippets to your source code while not making ViewInspector a dependency for the main target.
 
-*Note*: ViewInspector fully supports `confirmationDialog` inspection without any code tweaking.
+*Note*: ViewInspector fully supports `confirmationDialog`, `sheet` and `fullScreenCover` inspection without any code tweaking.
 
 ## `Alert`
 
@@ -156,9 +156,29 @@ Make sure to use `actionSheet2` in your view's body (or a different name of your
 
 ## `Sheet`
 
-Similarly to the `Alert` and `ActionSheet`, there are two APIs for presenting the `Sheet` thus two sets of snippets to add to the project, depending on your needs.
+Both the `isPresented: Binding<Bool>` and the `item: Binding<Item?>` variants of the native `.sheet` modifier are supported as-is - no changes in the main target are needed:
 
-#### Variant with `isPresented: Binding<Bool>` - main target snippet:
+```swift
+func testSheetExample() throws {
+    let binding = Binding(wrappedValue: true)
+    let sut = EmptyView().sheet(isPresented: binding) {
+        Text("Sheet content")
+        Button("Close", action: { binding.wrappedValue = false })
+    }
+    let sheet = try sut.inspect().emptyView().sheet()
+    XCTAssertEqual(try sheet.text(0).string(), "Sheet content")
+    try sheet.button(1).tap()
+    XCTAssertFalse(binding.wrappedValue)
+}
+```
+
+Calling `sheet()` throws an error when the sheet is not presented, and `dismiss()` unpresents it, calling the `onDismiss` closure:
+
+```swift
+try sut.inspect().emptyView().sheet().dismiss()
+```
+
+If you're targeting a SwiftUI version that does not expose the sheet's content to the reflection, use the following snippet in the main target and `sheet2` in place of `sheet` in your views:
 
 ```swift
 extension View {
@@ -186,7 +206,7 @@ Test target:
 extension InspectableSheet: PopupPresenter { }
 ```
 
-#### Variant with `item: Binding<Item?>` - main target snippet:
+And the corresponding snippet for the `item: Binding<Item?>` variant - main target:
 
 ```swift
 extension View {
@@ -214,13 +234,19 @@ Test target:
 extension InspectableSheetWithItem: ItemPopupPresenter { }
 ```
 
-Don't forget that you'll need to use `sheet2` in place of `sheet` in your views.
-
 ## `FullScreenCover`
 
-Similarly to the `Alert` and `Sheet`, there are two APIs for presenting the `FullScreenCover` thus two sets of snippets to add to the project, depending on your needs.
+The native `.fullScreenCover` modifier is supported as-is, just like the `.sheet` - use the `fullScreenCover()` inspection call:
 
-#### Variant with `isPresented: Binding<Bool>` - main target snippet:
+```swift
+func testFullScreenCoverExample() throws {
+    let binding = Binding(wrappedValue: true)
+    let sut = EmptyView().fullScreenCover(isPresented: binding) { Text("Cover content") }
+    XCTAssertEqual(try sut.inspect().emptyView().fullScreenCover().text().string(), "Cover content")
+}
+```
+
+For the SwiftUI versions that don't expose the content to the reflection, use the `fullScreenCover2` snippets - main target:
 
 ```swift
 extension View {
@@ -248,7 +274,7 @@ Test target:
 extension InspectableFullScreenCover: PopupPresenter { }
 ```
 
-#### Variant with `item: Binding<Item?>` - main target snippet:
+And for the `item: Binding<Item?>` variant - main target:
 
 ```swift
 extension View {
@@ -276,8 +302,6 @@ Test target:
 extension InspectableFullScreenCoverWithItem: ItemPopupPresenter { }
 ```
 
-Don't forget that you'll need to use `fullScreenCover2` in place of `fullScreenCover` in your views.
-
 ## `Popover`
 
 #### Variant with `isPresented: Binding<Bool>` - main target snippet:
```

#### Recent Merged Pull Requests:
- **PR #444** (2026-09-30): Fix Package.swift manifest: .visionOS(.v2) requires PackageDescription 6.0 (@nh7a)
- **PR #441** (2026-09-20): Add inspection support for compositingGroup and drawingGroup (@nh7a)
- **PR #440** (2026-09-20): Add inspection support for submitLabel (@nh7a)
- **PR #439** (2026-09-20): Add inspection support for textCase (@nh7a)
- **PR #438** (2026-09-20): Add inspection support for textSelection (@nh7a)
- **PR #437** (2026-09-20): Fix accessibilityTraits() for an empty trait set merged into a sibling modifier (@nh7a)
- **PR #436** (2026-09-20): Sync readiness.md with implemented APIs (@nh7a)
- **PR #435** (2026-09-13): Fix accessibilityTraits() throwing for an empty trait set (@nh7a)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
