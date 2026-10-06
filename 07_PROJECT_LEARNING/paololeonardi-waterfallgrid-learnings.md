# Forensic Learning Record (Deep Inspection): paololeonardi/WaterfallGrid

> **Canonical Artifact**: `07_PROJECT_LEARNING/paololeonardi-waterfallgrid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/paololeonardi/WaterfallGrid](https://github.com/paololeonardi/WaterfallGrid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:22:59.679Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `paololeonardi/WaterfallGrid`
- **Description**: A waterfall grid layout view for SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2665 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `WaterfallGridSample/WaterfallGridSample/Utilities/Generator.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import Foundation
import SwiftUI

struct Generator {
    
    struct Rectangles {
        static func random(editMode: EditMode) -> [RectangleModel] {
            Array(0..<60).map {
                let color = editMode == .swapResize ? disabledColor() : randomColor()
                return RectangleModel(index: $0, size: randomSize(), color: color)
            }
        }
        
        static func randomSize() -> CGFloat { CGFloat.random(in: 30...120) }

        static func fixedSize() -> CGFloat { 60 }
        
        static func randomColor() -> Color { [.red, .green, .blue, .orange, .yellow, .pink, .purple].randomElement()! }
        
        static func disabledColor() -> Color { .gray }
    }
    
    struct Images {
        static func random() -> [String] {
            Array(0..<22).map { "image\($0)" }.shuffled()
        }
    }
    
    struct Cards {
        static func random() -> [Card] {
            Images.random().map { Card(image: $0, title: LoremIpsum.randomTitle(), subtitle: LoremIpsum.randomSentences()) }
        }
    }
    
}

```

### Core Architecture Module: `WaterfallGridSample/WaterfallGridSample/Utilities/LoremIpsum.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import Foundation

struct LoremIpsum {
    
    private static let title = [
        "Lorem ipsum dolor sit amet",
        "consectetur adipiscing elit",
        "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"
    ]
    
    private static let sentences = [
        "Cras semper auctor neque vitae.",
        "Pharetra diam sit amet nisl suscipit.",
        "Sodales neque sodales ut etiam.",
        "Mattis enim ut tellus elementum sagittis.",
        "Sed elementum tempus egestas sed sed risus pretium.",
        "Ut eu sem integer vitae justo eget.",
        "Aenean vel elit scelerisque mauris pellentesque pulvinar pellentesque habitant morbi.",
        "Sit amet facilisis magna etiam tempor orci eu lobortis elementum.",
        "Nisl pretium fusce id velit ut tortor pretium viverra suspendisse.",
        "Viverra nam libero justo laoreet sit amet cursus sit."
    ]
    
    public static func randomTitle() -> String {
        title[0...Int.random(in: 0..<title.count)].joined(separator: ", ")
    }
    
    public static func randomSentences() -> String {
        sentences.shuffled()[0...Int.random(in: 0..<sentences.count)].joined(separator: " ")
    }
    
}

```

### Core Architecture Module: `WaterfallGridSample/WaterfallGridSample/Utilities/View+Extension.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import Foundation
import SwiftUI

extension View {
    
    public func customNavigationBarTitle(_ title: Text, displayMode: NavigationBarItem.TitleDisplayMode) -> some View {
        #if os(tvOS)
        return self
        #else
        return self
            .navigationBarTitle(title, displayMode: displayMode)
        #endif
    }
    
    public func customNavigationBarItems<L, T>(leading: L, trailing: T) -> some View where L : View, T : View {
        #if os(tvOS)
        return VStack(alignment: .leading) {
            HStack() {
                leading
                Spacer()
                trailing
            }
            self
        }
        #else
        return self
            .navigationBarItems(leading: leading, trailing: trailing)
        #endif
    }
    
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.9

//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import PackageDescription

let package = Package(
    name: "WaterfallGrid",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15),
        .tvOS(.v13),
        .visionOS(.v1),
        .watchOS(.v6)
    ],
    products: [
        .library(
            name: "WaterfallGrid",
            targets: ["WaterfallGrid"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "WaterfallGrid",
            dependencies: []),
        .testTarget(
            name: "WaterfallGridTests",
            dependencies: ["WaterfallGrid"]),
    ]
)

```

### Core Architecture Module: `Sources/WaterfallGrid/Environment/GridSyle.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import SwiftUI

struct GridSyle {
    @PositiveNumber var columnsInPortrait: Int
    @PositiveNumber var columnsInLandscape: Int

    let spacing: CGFloat
    let animation: Animation?

    var columns: Int {
        #if os(OSX) || os(tvOS) || targetEnvironment(macCatalyst) || os(visionOS)
        return columnsInLandscape
        #elseif os(watchOS)
        return columnsInPortrait
        #else
        let screenSize = UIScreen.main.bounds.size
        return screenSize.width > screenSize.height ? columnsInLandscape : columnsInPortrait
        #endif
    }
}

struct GridStyleKey: EnvironmentKey {
    static let defaultValue = GridSyle(columnsInPortrait: 2, columnsInLandscape: 2,
                                       spacing: 8, animation: .default)
}

extension EnvironmentValues {
    var gridStyle: GridSyle {
        get { self[GridStyleKey.self] }
        set { self[GridStyleKey.self] = newValue }
    }
}

```

### Core Architecture Module: `Sources/WaterfallGrid/Environment/PositiveNumber.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import Foundation

@propertyWrapper
struct PositiveNumber {
    private var value: Int = 1
    
    var wrappedValue: Int {
        get { value }
        set { value = max(1, newValue) }
    }
    
    init(wrappedValue initialValue: Int) {
        self.wrappedValue = initialValue
    }
}

```

### Core Architecture Module: `Sources/WaterfallGrid/Environment/ScrollOptions.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import SwiftUI

struct ScrollOptions {
    let direction: Axis.Set
}

struct ScrollOptionsKey: EnvironmentKey {
    static let defaultValue = ScrollOptions(direction: .vertical)
}

extension EnvironmentValues {
    var scrollOptions: ScrollOptions {
        get { self[ScrollOptionsKey.self] }
        set { self[ScrollOptionsKey.self] = newValue }
    }
}

```

### Core Architecture Module: `Sources/WaterfallGrid/Preference/ElementPreference.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import SwiftUI

struct ElementPreferenceData: Equatable {
    let id: AnyHashable
    let size: CGSize
}

struct ElementPreferenceKey: PreferenceKey {
    typealias Value = [ElementPreferenceData]

    static var defaultValue: [ElementPreferenceData] = []

    static func reduce(value: inout [ElementPreferenceData], nextValue: () -> [ElementPreferenceData]) {
        value.append(contentsOf: nextValue())
    }
}

```

### Core Architecture Module: `Sources/WaterfallGrid/Preference/PreferenceSetter.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import SwiftUI

struct PreferenceSetter<ID: Hashable>: View {
    var id: ID
    var body: some View {
        GeometryReader { geometry in
            Color.clear
                .preference(key: ElementPreferenceKey.self, value: [ElementPreferenceData(id: AnyHashable(self.id), size: geometry.size)])
        }
    }
}

```

### Core Architecture Module: `Sources/WaterfallGrid/View+GridStyle.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import SwiftUI

// MARK: - GridStyle

extension View {

    /// Sets the style for `WaterfallGrid` within the environment of `self`.
    ///
    /// - Parameter columns: The number of columns of the grid. The default is `2`.
    /// - Parameter spacing: The distance between adjacent items. The default is `8`.
    /// - Parameter animation: The animation to apply when data change. If `animation` is `nil`, the grid doesn't animate.
    public func gridStyle(
        columns: Int = 2,
        spacing: CGFloat = 8,
        animation: Animation? = .default
    ) -> some View {
        let style = GridSyle(
            columnsInPortrait: columns,
            columnsInLandscape: columns,
            spacing: spacing,
            animation: animation
        )
        return self.environment(\.gridStyle, style)
    }

    /// Sets the style for `WaterfallGrid` within the environment of `self`.
    ///
    /// - Parameter columnsInPortrait: The number of columns of the grid when the device is in a portrait orientation. The default is `2`.
    /// - Parameter columnsInLandscape: The number of columns of the grid when the device is in a landscape orientation The default is `2`.
    /// - Parameter spacing: The distance between adjacent items. The default is `8`.
    /// - Parameter animation: The animation to apply when data change. If `animation` is `nil`, the grid doesn't animate.
    @available(OSX, unavailable)
    @available(tvOS, unavailable)
    @available(visionOS, unavailable)
    @available(watchOS, unavailable)
    public func gridStyle(
        columnsInPortrait: Int = 2,
        columnsInLandscape: Int = 2,
        spacing: CGFloat = 8,
        animation: Animation? = .default
    ) -> some View {
        let style = GridSyle(
            columnsInPortrait: columnsInPortrait,
            columnsInLandscape: columnsInLandscape,
            spacing: spacing,
            animation: animation
        )
        return self.environment(\.gridStyle, style)
    }

}

```

### Core Architecture Module: `Sources/WaterfallGrid/View+ScrollOptions.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import SwiftUI

// MARK: - ScrollOptions

extension View {

    /// Sets the scroll options for `WaterfallGrid` within the environment of `self`.
    ///
    /// - Parameters:
    ///   - direction: The scrollable axes. The default is `.vertical`.
    public func scrollOptions(direction: Axis.Set) -> some View {
        let options = ScrollOptions(direction: direction)
        return self.environment(\.scrollOptions, options)
    }

}

```

### Core Architecture Module: `Sources/WaterfallGrid/WaterfallGrid.swift`
```
//
//  Copyright © 2019 Paolo Leonardi.
//
//  Licensed under the MIT license. See the LICENSE file for more info.
//

import SwiftUI

/// A container that presents items of variable heights arranged in a grid.
@available(iOS 13, OSX 10.15, tvOS 13, visionOS 1, watchOS 6, *)
public struct WaterfallGrid<Data, ID, Content>: View where Data : RandomAccessCollection, Content : View, ID : Hashable {

    @Environment(\.gridStyle) private var style
    @Environment(\.scrollOptions) private var scrollOptions

    private let data: Data
    private let dataId: KeyPath<Data.Element, ID>
    private let content: (Data.Element) -> Content

    @State private var loaded = false
    @State private var gridHeight: CGFloat = 0

    @State private var alignmentGuides = [AnyHashable: CGPoint]() {
        didSet { loaded = !oldValue.isEmpty }
    }
    
    public var body: some View {
        VStack {
            GeometryReader { geometry in
                self.grid(in: geometry)
                    .onPreferenceChange(ElementPreferenceKey.self, perform: { preferences in
                        DispatchQueue.global(qos: .userInteractive).async {
                            let (alignmentGuides, gridHeight) = self.alignmentsAndGridHeight(columns: self.style.columns,
                                                                                             spacing: self.style.spacing,
                                                                                             scrollDirection: self.scrollOptions.direction,
                                                                                             preferences: preferences)
                            DispatchQueue.main.async {
                                self.alignmentGuides = alignmentGuides
                                self.gridHeight = gridHeight
                            }
                        }
                    })
            }
        }
        .frame(width: self.scrollOptions.direction == .horizontal ? gridHeight : nil,
               height: self.scrollOptions.direction == .vertical ? gridHeight : nil)
    }

    private func grid(in geometry: GeometryProxy) -> some View {
        let columnWidth = self.columnWidth(columns: style.columns, spacing: style.spacing,
                                           scrollDirection: scrollOptions.direction, geometrySize: geometry.size)
        return
            ZStack(alignment: .topLeading) {
                ForEach(data, id: self.dataId) { element in
                    self.content(element)
                        .frame(width: self.scrollOptions.direction == .vertical ? columnWidth : nil,
                               height: self.scrollOptions.direction == .horizontal ? columnWidth : nil)
                        .background(PreferenceSetter(id: element[keyPath: self.dataId]))
                        .alignmentGuide(.top, computeValue: { _ in self.alignmentGuides[element[keyPath: self.dataId]]?.y ?? 0 })
                        .alignmentGuide(.leading, computeValue: { _ in self.alignmentGuides[element[keyPath: self.dataId]]?.x ?? 0 })
                        .opacity(self.alignmentGuides[element[keyPath: self.dataId]] != nil ? 1 : 0)
                }
            }
            .animation(self.loaded ? self.style.animation : nil, value: UUID())
    }

    // MARK: - Helpers

    func alignmentsAndGridHeight(columns: Int, spacing: CGFloat, scrollDirection: Axis.Set, preferences: [ElementPreferenceData]) -> ([AnyHashable: CGPoint], CGFloat) {
        var heights = Array(repeating: CGFloat(0), count: columns)
        var alignmentGuides = [AnyHashable: CGPoint]()

        preferences.forEach { preference in
            if let minValue = heights.min(), let indexMin = heights.firstIndex(of: minValue) {
                let preferenceSizeWidth = scrollDirection == .vertical ? preference.size.width : preference.size.height
                let preferenceSizeHeight = scrollDirection == .vertical ? preference.size.height : preference.size.width
                let width = preferenceSizeWidth * CGFloat(indexMin) + CGFloat(indexMin) * spacing
                let height = heights[indexMin]
                let offset = CGPoint(x: 0 - (scrollDirection == .vertical ? width : height),
                                     y: 0 - (scrollDirection == .vertical ? height : width))
                heights[indexMin] += preferenceSizeHeight + spacing
                alignmentGuides[preference.id] = offset
            }
        }
        
        let gridHeight = max(0, (heights.max() ?? spacing) - spacing)
        
        return (alignmentGuides, gridHeight)
    }

    func columnWidth(columns: Int, spacing: CGFloat, scrollDirection: Axis.Set, geometrySize: CGSize) -> CGFloat {
        let geometrySizeWidth = scrollDirection == .vertical ? geometrySize.width : geometrySize.height
        let width = max(0, geometrySizeWidth - (spacing * (CGFloat(columns) - 1)))
        return width / CGFloat(columns)
    }
}

// MARK: - Initializers

extension WaterfallGrid {

    /// Creates an instance that uniquely identifies views across updates based
    /// on the `id` key path to a property on an underlying data element.
    ///
    /// - Parameter data: A collection of data.
    /// - Parameter id: Key path to a property on an underlying data element.
    /// - Parameter content: A function that can be used to generate content on demand given underlying data.
    public init(_ data: Data, id: KeyPath<Data.Element, ID>, content: @escaping (Data.Element) -> Content) {
        self.data = data
        self.dataId = id
        self.content = content
    }

}

extension WaterfallGrid where ID == Data.Element.ID, Data.Element : Identifiable {

    /// Creates an instance that uniquely identifies views across updates based
    /// on the identity of the underlying data element.
    ///
    /// - Parameter data: A collection of identified data.
    /// - Parameter content: A function that can be used to generate content on demand given underlying data.
    public init(_ data: Data, content: @escaping (Data.Element) -> Content) {
        self.data = data
        self.dataId = \Data.Element.id
        self.content = content
    }

}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13** (2019-11-20): **Initial number of columns incorrect when in landscape**
  *Symptoms*: **Summary** When the initial device orientation is landscape, the number of columns displayed is incorrect. The correct number of columns is displayed only after rotating to portrait and landscape again.  **Expected** ![Screen Shot 2019-11-20 at 12 31 22 PM](https://user-images.githubusercontent.com/15708500/69195852-bac72c00-0b91-11ea-9969-5e0f24669672.png)  **Actual** ![Screen Shot 2019-11-20 at 12 31 08 PM](https://user-images.githubusercontent.com/15708500/69195876-c155a380-0b91-11ea-9ba6-fd98ee176807.png)  **Env** Xcode 11.2, iOS 13.2, Swift 5
  **Post-Mortem & Fix Analysis**:
  > @youjinp thanks for raising and fixing the issue.

- **Issue #12** (2022-06-16): **Vertical grid is scrollable horizontally in landscape orientation**
  *Symptoms*: ![Simulator Screen Shot - iPhone 11 Pro - 2019-11-15 at 12 44 58](https://user-images.githubusercontent.com/2933241/68974629-0e0e3880-07a6-11ea-854e-60357dc1b27a.png) 
  **Post-Mortem & Fix Analysis**:
  > Has this been fixed yet???

- **Issue #8** (2019-11-08): **Layout issue in simulators**
  *Symptoms*: Hi just wanted to mention that there is a layout issue on simulators (iPhone 11 Pro). Awesome grid btw. ![Simulator Screen Shot - iPhone 11 Pro - 2019-11-06 at 12 19 06](https://user-images.githubusercontent.com/2933241/68334932-5e8fe280-0090-11ea-8ecb-e935705f1ea3.png) 
  **Post-Mortem & Fix Analysis**:
  > Hi Alex, thanks, so is yours!  About the bug, you are right. Looks like there are layout issues on iOS 13.2 and not just iPhone 11 Pro. On iOS 13.1, where it was mainly tested, works fine. I'll investigate it further.  Thank you!

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

### Incident Patch 1: `00f090a9` (2024-07-23)
**Commit Message**: Fix animation warning

**File**: `Sources/WaterfallGrid/WaterfallGrid.swift` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ public struct WaterfallGrid<Data, ID, Content>: View where Data : RandomAccessCo
                         .opacity(self.alignmentGuides[element[keyPath: self.dataId]] != nil ? 1 : 0)
                 }
             }
-            .animation(self.loaded ? self.style.animation : nil)
+            .animation(self.loaded ? self.style.animation : nil, value: UUID())
     }
 
     // MARK: - Helpers
```

**File**: `WaterfallGridSample/WaterfallGridSample visionOS/WaterfallGridSample_visionOSApp.swift` (modified, +3/-1)
```diff
@@ -1,5 +1,7 @@
 //
-//  Copyright © 2024 Paolo Leonardi. All rights reserved.
+//  Copyright © 2024 Paolo Leonardi.
+//
+//  Licensed under the MIT license. See the LICENSE file for more info.
 //
 
 import SwiftUI
```

---

### Incident Patch 2: `5f44e304` (2024-07-23)
**Commit Message**: Add build visionOS step to workflows

**File**: `.github/workflows/run-tests-WaterfallGridSample.yml` (modified, +3/-0)
```diff
@@ -48,5 +48,8 @@ jobs:
     - name: Build (tvOS)
       run: xcodebuild build -scheme WaterfallGrid -destination "platform=tvOS Simulator,OS=17.5,name=Apple TV" | xcpretty
 
+    - name: Build (visionOS)
+      run: xcodebuild build -scheme WaterfallGrid -destination "platform=visionOS Simulator,OS=1.2,name=Apple Vision Pro" | xcpretty
+
     - name: Build (watchOS)
       run: xcodebuild build -scheme WaterfallGrid -destination "platform=watchOS Simulator,OS=10.5,name=Apple Watch Ultra 2 (49mm)" | xcpretty
```

---

### Incident Patch 3: `85eeaa9e` (2021-07-28)
**Commit Message**: fix: typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -206,7 +206,7 @@ Contributions are more than welcome. Please create a GitHub issue before submitt
 * [Paolo Leonardi](https://github.com/paololeonardi) ([@paololeonardi](https://twitter.com/paololeonardi))
 
 ## Credits
-WaterfallGrid was ispired by the following projects:
+WaterfallGrid was inspired by the following projects:
 
 * QGrid - https://github.com/Q-Mobile/QGrid
 * Grid - https://github.com/SwiftUIExtensions/Grid
```

---

### Incident Patch 4: `22b90780` (2021-02-13)
**Commit Message**: Fix Invalid frame dimension

**File**: `Sources/WaterfallGrid/WaterfallGrid.swift` (modified, +8/-7)
```diff
@@ -30,12 +30,13 @@ public struct WaterfallGrid<Data, ID, Content>: View where Data : RandomAccessCo
                 self.grid(in: geometry)
                     .onPreferenceChange(ElementPreferenceKey.self, perform: { preferences in
                         DispatchQueue.global(qos: .userInteractive).async {
-                            let alignmentGuides = self.calculateAlignmentGuides(columns: self.style.columns,
-                                                                                spacing: self.style.spacing,
-                                                                                scrollDirection: self.scrollOptions.direction,
-                                                                                preferences: preferences)
+                            let (alignmentGuides, gridHeight) = self.alignmentsAndGridHeight(columns: self.style.columns,
+                                                                                             spacing: self.style.spacing,
+                                                                                             scrollDirection: self.scrollOptions.direction,
+                                                                                             preferences: preferences)
                             DispatchQueue.main.async {
                                 self.alignmentGuides = alignmentGuides
+                                self.gridHeight = gridHeight
                             }
                         }
                     })
@@ -65,7 +66,7 @@ public struct WaterfallGrid<Data, ID, Content>: View where Data : RandomAccessCo
 
     // MARK: - Helpers
 
-    func calculateAlignmentGuides(columns: Int, spacing: CGFloat, scrollDirection: Axis.Set, preferences: [ElementPreferenceData]) -> [AnyHashable: CGPoint] {
+    func alignmentsAndGridHeight(columns: Int, spacing: CGFloat, scrollDirection: Axis.Set, preferences: [ElementPreferenceData]) -> ([AnyHashable: CGPoint], CGFloat) {
         var heights = Array(repeating: CGFloat(0), count: columns)
         var alignmentGuides = [AnyHashable: CGPoint]()
 
@@ -82,9 +83,9 @@ public struct WaterfallGrid<Data, ID, Content>: View where Data : RandomAccessCo
             }
         }
         
-        gridHeight = (heights.max() ?? spacing) - spacing
+        let gridHeight = max(0, (heights.max() ?? spacing) - spacing)
         
-        return alignmentGuides
+        return (alignmentGuides, gridHeight)
     }
 
     func columnWidth(columns: Int, spacing: CGFloat, scrollDirection: Axis.Set, geometrySize: CGSize) -> CGFloat {
```

**File**: `Tests/WaterfallGridTests/WaterfallGridTests.swift` (modified, +84/-36)
```diff
@@ -22,7 +22,7 @@ class WaterfallGridTests: XCTestCase {
         super.tearDown()
     }
 
-    func test_calculateAlignmentGuides_withSpacingAndVerticalScroll() {
+    func test_alignmentsAndGridHeight_withSpacingAndVerticalScroll() {
         // Given
         let width = 40
         let spacing: CGFloat = 8
@@ -59,22 +59,23 @@ class WaterfallGridTests: XCTestCase {
             4: CGPoint(x: -48, y: -88)
         ]
 
-        let testCases: [ ([AnyHashable : CGPoint], Int, UInt) ] = [
-            // expected             | columns |  line
-            (alignmentsOneColumn,       1,      #line),
-            (alignmentsTwoColumns,      2,      #line),
-            (alignmentsThreeColumns,    3,      #line)
+        let testCases: [ ([AnyHashable : CGPoint], CGFloat, Int, UInt) ] = [
+            // expectedAlignments    | expectedGridHeight  | columns |  line
+            (alignmentsOneColumn,           422.0,              1,      #line),
+            (alignmentsTwoColumns,          228.0,              2,      #line),
+            (alignmentsThreeColumns,        188.0,              3,      #line)
         ]
 
-        for (expected, columns, line) in testCases {
+        for (expectedAlignments, expectedGridHeight, columns, line) in testCases {
             // When
-            let result = sut.calculateAlignmentGuides(columns: columns, spacing: spacing, scrollDirection: scrollDirection, preferences: preferences)
+            let (alignments, gridHeight) = sut.alignmentsAndGridHeight(columns: columns, spacing: spacing, scrollDirection: scrollDirection, preferences: preferences)
             // Then
-            XCTAssertEqual(expected, result, line: line)
+            XCTAssertEqual(expectedAlignments, alignments, line: line)
+            XCTAssertEqual(expectedGridHeight, gridHeight, line: line)
         }
     }
 
-    func test_calculateAlignmentGuides_withSpacingAndHorizontalScroll() {
+    func test_alignmentsAndGridHeight_withSpacingAndHorizontalScroll() {
         // Given
         let height = 40
         let spacing: CGFloat = 8
@@ -111,22 +112,23 @@ class WaterfallGridTests: XCTestCase {
             4: CGPoint(x: -88, y: -48)
         ]
 
-        let testCases: [ ([AnyHashable : CGPoint], Int, UInt) ] = [
-            // expected             | columns |  line
-            (alignmentsOneColumn,       1,      #line),
-            (alignmentsTwoColumns,      2,      #line),
-            (alignmentsThreeColumns,    3,      #line)
+        let testCases: [ ([AnyHashable : CGPoint], CGFloat, Int, UInt) ] = [
+            // expectedAlignments    | expectedGridHeight  | columns |  line
+            (alignmentsOneColumn,           422.0,              1,      #line),
+            (alignmentsTwoColumns,          228.0,              2,      #line),
+            (alignmentsThreeColumns,        188.0,              3,      #line)
         ]
 
-        for (expected, columns, line) in testCases {
+        for (expectedAlignments, expectedGridHeight, columns, line) in testCases {
             // When
-            let result = sut.calculateAlignmentGuides(columns: columns, spacing: spacing, scrollDirection: scrollDirection, preferences: preferences)
+            let (alignments, gridHeight) = sut.alignmentsAndGridHeight(columns: columns, spacing: spacing, scrollDirection: scrollDirection, preferences: preferences)
             // Then
-            XCTAssertEqual(expected, result, line: line)
+            XCTAssertEqual(expectedAlignments, alignments, line: line)
+            XCTAssertEqual(expectedGridHeight, gridHeight, line: line)
         }
     }
 
-    func test_calculateAlignmentGuides_withoutSpacingAndVerticalScroll() {
+    func test_alignmentsAndGridHeight_withoutSpacingAndVerticalScroll() {
         // Given
         let width = 40
         let spacing: CGFloat = 0
@@ -163,22 +165,23 @@ class WaterfallGridTests: XCTestCase {
             4: CGPoint(x: -40, y: -80)
         ]
 
-        let testCases: [ ([AnyHashable : CGPoint], Int, UInt) ] = [
-            // expected             | columns |  line
-            (alignmentsOneColumn,       1,      #line),
-            (alignmentsTwoColumns,      2,      #line),
-            (alignmentsThreeColumns,    3,      #line)
+        let testCases: [ ([AnyHashable : CGPoint], CGFloat, Int, UInt) ] = [
+            // expectedAlignments    | expectedGridHeight  | columns |  line
+            (alignmentsOneColumn,           390.0,              1,      #line),
+            (alignmentsTwoColumns,          220.0,              2,      #line),
+            (alignmentsThreeColumns,        180.0,              3,      #line)
         ]
 
-        for (expected, columns, line) in testCases {
+        for (expectedAlignments, expectedGridHeight, columns, line) in testCases {
             // When
-            let result = sut.calculateAlignmentGuides(columns: columns, spacing: spacing, scrollDirection: scrollDirection, preferences: preferences)
+            let (alignment
```

---

### Incident Patch 5: `6021f612` (2019-11-20)
**Commit Message**: Fix: issue #13 (#14)

* Fix: issue #13

`UIDevice.current.orientation` gives "unknown" orientation

Change to use width and height to determine whether landscape or
portrait

* Refactor

**File**: `Sources/WaterfallGrid/GridSyle.swift` (modified, +2/-1)
```diff
@@ -21,7 +21,8 @@ struct GridSyle {
         #elseif os(watchOS)
         return columnsInPortrait
         #else
-        return UIDevice.current.orientation.isLandscape ? columnsInLandscape : columnsInPortrait
+        let screenSize = UIScreen.main.bounds.size
+        return screenSize.width > screenSize.height ? columnsInLandscape : columnsInPortrait
         #endif
     }
 }
```

---

### Incident Patch 6: `075d4daf` (2019-11-08)
**Commit Message**: fix onPreferenceChange bug

**File**: `Sources/WaterfallGrid/WaterfallGrid.swift` (modified, +13/-10)
```diff
@@ -25,6 +25,17 @@ public struct WaterfallGrid<Data, ID, Content>: View where Data : RandomAccessCo
     public var body: some View {
         GeometryReader { geometry in
             self.grid(in: geometry)
+                .onPreferenceChange(ElementPreferenceKey.self, perform: { preferences in
+                    DispatchQueue.global(qos: .utility).async {
+                        let alignmentGuides = self.calculateAlignmentGuides(columns: self.style.columns,
+                                                                            spacing: self.style.spacing,
+                                                                            scrollDirection: self.style.scrollDirection,
+                                                                            preferences: preferences)
+                        DispatchQueue.main.async {
+                            self.alignmentGuides = alignmentGuides
+                        }
+                    }
+                })
         }
     }
 
@@ -41,19 +52,11 @@ public struct WaterfallGrid<Data, ID, Content>: View where Data : RandomAccessCo
                         .alignmentGuide(.top, computeValue: { _ in self.alignmentGuides[element[keyPath: self.dataId]]?.y ?? 0 })
                         .alignmentGuide(.leading, computeValue: { _ in self.alignmentGuides[element[keyPath: self.dataId]]?.x ?? 0 })
                         .opacity(self.alignmentGuides[element[keyPath: self.dataId]] != nil ? 1 : 0)
-                        .animation(self.loaded ? self.style.animation : nil)
                 }
             }
             .padding(style.padding)
-            .onPreferenceChange(ElementPreferenceKey.self, perform: { preferences in
-                DispatchQueue.global(qos: .utility).async {
-                    let alignmentGuides = self.calculateAlignmentGuides(columns: self.style.columns, spacing: self.style.spacing,
-                                                                        scrollDirection: self.style.scrollDirection, preferences: preferences)
-                    DispatchQueue.main.async {
-                        self.alignmentGuides = alignmentGuides
-                    }
-                }
-            })
+            .frame(maxWidth: .infinity, maxHeight: .infinity)
+            .animation(self.loaded ? self.style.animation : nil)
         }
     }
 
```

**File**: `WaterfallGridSample/WaterfallGridSample.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -820,7 +820,7 @@
 				CODE_SIGN_STYLE = Automatic;
 				DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"WaterfallGridSample iOS/Preview Content\"";
-				DEVELOPMENT_TEAM = 586FE2J8R2;
+				DEVELOPMENT_TEAM = 695GNFL2MK;
 				ENABLE_PREVIEWS = YES;
 				INFOPLIST_FILE = "WaterfallGridSample iOS/Info.plist";
 				LD_RUNPATH_SEARCH_PATHS = (
@@ -843,7 +843,7 @@
 				CODE_SIGN_STYLE = Automatic;
 				DERIVE_MACCATALYST_PRODUCT_BUNDLE_IDENTIFIER = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"WaterfallGridSample iOS/Preview Content\"";
-				DEVELOPMENT_TEAM = 586FE2J8R2;
+				DEVELOPMENT_TEAM = 695GNFL2MK;
 				ENABLE_PREVIEWS = YES;
 				INFOPLIST_FILE = "WaterfallGridSample iOS/Info.plist";
 				LD_RUNPATH_SEARCH_PATHS = (
```

#### Recent Merged Pull Requests:
- **PR #76** (closed): Add @ViewBuilder to init (@hstdt)
- **PR #72** (2024-07-25): Add Support for visionOS (@paololeonardi)
- **PR #71** (2024-07-22): Add GitHub Actions workflow (@paololeonardi)
- **PR #70** (closed): support visionOS (@BB-fat)
- **PR #64** (closed): Update WaterfallGrid.swift (@Lindemann)
- **PR #58** (2021-07-28): fix: typo (@tatsuz0u)
- **PR #55** (2021-02-13): Fix Invalid frame dimension (@paololeonardi)
- **PR #50** (2020-12-03): Remove ScrollView (@paololeonardi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
