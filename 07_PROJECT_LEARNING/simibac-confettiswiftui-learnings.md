> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/simibac-confettiswiftui-learnings.md`  
> **Source**: github ([https://github.com/simibac/ConfettiSwiftUI](https://github.com/simibac/ConfettiSwiftUI))  
> **Source Version**: `9ae5bc2c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T00:19:06.904Z  
> **Learning ID**: `learn-github-simibac-confettiswiftui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): simibac/ConfettiSwiftUI

> **Canonical Artifact**: `07_PROJECT_LEARNING/simibac-confettiswiftui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/simibac/ConfettiSwiftUI](https://github.com/simibac/ConfettiSwiftUI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T00:19:06.898Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `simibac/ConfettiSwiftUI`
- **Description**: SwiftUI Package for Configurable Confetti Animation 🎉
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2468 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:5.3
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "ConfettiSwiftUI",
    platforms: [
        .iOS(.v14),
        .macOS(.v11),
        .tvOS(.v14),
        .watchOS(.v7)
    ],
    products: [
        // Products define the executables and libraries a package produces, and make them visible to other packages.
        .library(
            name: "ConfettiSwiftUI",
            targets: ["ConfettiSwiftUI"]),
    ],
    dependencies: [
        // Dependencies declare other packages that this package depends on.
        // .package(url: /* package url */, from: "1.0.0"),
    ],
    targets: [
        // Targets are the basic building blocks of a package. A target can define a module or a test suite.
        // Targets can depend on other targets in this package, and on products in packages this package depends on.
        .target(
            name: "ConfettiSwiftUI",
            dependencies: [],
            path: "Sources"),
        .testTarget(
            name: "ConfettiSwiftUITests",
            dependencies: ["ConfettiSwiftUI"],
            path: "Tests/ConfettiSwiftUITests"),
    ]
)

```

### Core Architecture Module: `Sources/ConfettiSwiftUI.swift`
```
//
//  ConfettiView.swift
//  Confetti
//
//  Created by Simon Bachmann on 24.11.20.
//

import SwiftUI

public enum ConfettiType:CaseIterable, Hashable {
    
    public enum Shape {
        case circle
        case triangle
        case square
        case slimRectangle
        case roundedCross
    }

    case shape(Shape)
    case text(String)
    case sfSymbol(symbolName: String)
    case image(String)
    
    public var view:AnyView{
        switch self {
        case .shape(.square):
            return AnyView(Rectangle())
        case .shape(.triangle):
            return AnyView(Triangle())
        case .shape(.slimRectangle):
            return AnyView(SlimRectangle())
        case .shape(.roundedCross):
            return AnyView(RoundedCross())
        case let .text(text):
            return AnyView(Text(text))
        case .sfSymbol(let symbolName):
            return AnyView(Image(systemName: symbolName))
        case .image(let image):
            return AnyView(Image(image).resizable())
        default:
            return AnyView(Circle())
        }
    }
    
    public static var allCases: [ConfettiType] {
        return [.shape(.circle), .shape(.triangle), .shape(.square), .shape(.slimRectangle), .shape(.roundedCross)]
    }
}

@available(iOS 14.0, macOS 11.0, watchOS 7, tvOS 14.0, *)
public struct ConfettiCannon<T: Equatable>: View {
    @Binding var trigger: T
    @ObservedObject private var confettiConfig:ConfettiConfig

    @State var animate:[Bool] = []
    @State var finishedAnimationCounter = 0
    @State var firstAppear = false
    @State var error = ""
    
    /// renders configurable confetti animation
    /// - Parameters:
    ///   - trigger: on any change of this variable the animation is run
    ///   - num: amount of confettis
    ///   - colors: list of colors that is applied to the default shapes
    ///   - confettiSize: size that confettis and emojis are scaled to
    ///   - rainHeight: vertical distance that confettis pass
    ///   - fadesOut: reduce opacity towards the end of the animation
    ///   - opacity: maximum opacity that is reached during the animation
    ///   - openingAngle: boundary that defines the opening angle in degrees
    ///   - closingAngle: boundary that defines the closing angle in degrees
    ///   - radius: explosion radius
    ///   - repetitions: number of repetitions of the explosion
    ///   - repetitionInterval: duration between the repetitions
    ///   - hapticFeedback: play haptic feedback on explosion

    public init(trigger:Binding<T>,
         num:Int = 20,
         confettis:[ConfettiType] = ConfettiType.allCases,
         colors:[Color] = [.blue, .red, .green, .yellow, .pink, .purple, .orange],
         confettiSize:CGFloat = 10.0,
         rainHeight: CGFloat = 600.0,
         fadesOut:Bool = true,
         opacity:Double = 1.0,
         openingAngle:Angle = .degrees(60),
         closingAngle:Angle = .degrees(120),
         radius:CGFloat = 300,
         repetitions:Int = 1,
         repetitionInterval:Double = 1.0,
         hapticFeedback:Bool = true
    ) {
        self._trigger = trigger
        var shapes = [AnyView]()
        
        for confetti in confettis{
            for color in colors{
                switch confetti {
                case .shape(_):
                    shapes.append(AnyView(confetti.view.foregroundColor(color).frame(width: confettiSize, height: confettiSize, alignment: .center)))
                case .image(_):
                    shapes.append(AnyView(confetti.view.frame(maxWidth:confettiSize, maxHeight: confettiSize)))
                default:
                    shapes.append(AnyView(confetti.view.foregroundColor(color).font(.system(size: confettiSize))))
                }
            }
        }
    
        _confettiConfig = ObservedObject(wrappedValue: ConfettiConfig(
            num: num,
            shapes: shapes,
            colors: colors,
            confettiSize: confettiSize,
            rainHeight: rainHeight,
            fadesOut: fadesOut,
            opacity: opacity,
            openingAngle: openingAngle,
            closingAngle: closingAngle,
            radius: radius,
            repetitions: repetitions,
            repetitionInterval: repetitionInterval,
            hapticFeedback: hapticFeedback
        ))
    }

    public var body: some View {
        ZStack{
            ForEach(finishedAnimationCounter..<animate.count, id:\.self){ i in
                ConfettiContainer(
                    finishedAnimationCounter: $finishedAnimationCounter,
                    confettiConfig: confettiConfig
                )
            }
        }
        .onAppear(){
            firstAppear = true
        }
        .onChange(of: trigger){value in
            if firstAppear{
                for i in 0..<confettiConfig.repetitions{
                    DispatchQueue.main.asyncAfter(deadline: .now() + confettiConfig.repetitionInterval * Double(i)) {
                        animate.append(false)
#if canImport(UIKit) && !os(tvOS) && !os(visionOS) && !os(watchOS)
                        if confettiConfig.hapticFeedback {
                            let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
                            impactFeedback.impactOccurred()
                        }
#elseif os(watchOS)
                        if confettiConfig.hapticFeedback {
                            let device = WKInterfaceDevice.current()
                            device.play(.click)
                        }
#endif
                    }
                }
            }
        }
    }
}

@available(iOS 14.0, macOS 11.0, watchOS 7, tvOS 14.0, *)
struct ConfettiContainer: View {
    @Binding var finishedAnimationCounter:Int
    @ObservedObject var confettiConfig:ConfettiConfig
    @State var firstAppear = true

    var body: some View{
        ZStack{
            ForEach(0...confettiConfig.num-1, id:\.self){_ in
                ConfettiView(confettiConfig: confettiConfig)
            }
        }
        .onAppear(){
            if firstAppear{
                DispatchQueue.main.asyncAfter(deadline: .now() + confettiConfig.animationDuration) {
                    self.finishedAnimationCounter += 1
                }
                firstAppear = false
            }
        }
    }
}

@available(iOS 14.0, macOS 11.0, watchOS 7, tvOS 14.0, *)
struct ConfettiView: View{
    @State var location:CGPoint = CGPoint(x: 0, y: 0)
    @State var opacity:Double = 0.0
    @ObservedObject var confettiConfig:ConfettiConfig
    
    func getShape() -> AnyView {
        return confettiConfig.shapes.randomElement()!
    }
    
    func getColor() -> Color {
        return confettiConfig.colors.randomElement()!
    }
    
    func getSpinDirection() -> CGFloat {
        let spinDirections:[CGFloat] = [-1.0, 1.0]
        return spinDirections.randomElement()!
    }
    
    func getRandomExplosionTimeVariation() -> CGFloat {
         CGFloat((0...999).randomElement()!) / 2100
    }
    
    func getAnimationDuration() -> CGFloat {
        return 0.2 + confettiConfig.explosionAnimationDuration + getRandomExplosionTimeVariation()
    }
    
    func getAnimation() -> Animation {
        return Animation.timingCurve(0.1, 0.8, 0, 1, duration: getAnimationDuration())
    }
    
    func getDistance() -> CGFloat {
        return pow(CGFloat.random(in: 0.01...1), 2.0/7.0) * confettiConfig.radius
    }
    
    func getDelayBeforeRainAnimation() -> TimeInterval {
        confettiConfig.explosionAnimationDuration *  0.1
    }

    var body: some View{
        ConfettiAnimationView(shape:getShape(), color:getColor(), spinDirX: getSpinDirection(), spinDirZ: getSpinDirection())
            .offset(x: location.x, y: location.y)
            .opacity(opacity)
            .onAppear(){
                withAnimation(getAnimation()) {
                    opacity = confettiConfig.opacity
                    
                    let randomAngle:CGFloat
                    if confettiConfig.openingAngle.degrees <= confettiConfig.closingAngle.degrees{
                        randomAngle = CGFloat.random(in: CGFloat(confettiConfig.openingAngle.degrees)...CGFloat(confettiConfig.closingAngle.degrees))
                    }else{
                        randomAngle = CGFloat.random(in: CGFloat(confettiConfig.openingAngle.degrees)...CGFloat(confettiConfig.closingAngle.degrees + 360)).truncatingRemainder(dividingBy: 360)
                    }
                    
                    let distance = getDistance()
                    
                    location.x = distance * cos(deg2rad(randomAngle))
                    location.y = -distance * sin(deg2rad(randomAngle))
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + getDelayBeforeRainAnimation()) {
                    withAnimation(Animation.timingCurve(0.12, 0, 0.39, 0, duration: confettiConfig.rainAnimationDuration)) {
                        location.y += confettiConfig.rainHeight
                        opacity = confettiConfig.fadesOut ? 0 : confettiConfig.opacity
                    }
                }
            }
    }
    
    func deg2rad(_ number: CGFloat) -> CGFloat {
        return number * CGFloat.pi / 180
    }
    
}

struct ConfettiAnimationView: View {
    @State var shape: AnyView
    @State var color: Color
    @State var spinDirX: CGFloat
    @State var spinDirZ: CGFloat
    @State var firstAppear = true

    
    @State var move = false
    @State var xSpeed:Double = Double.random(in: 0.501...2.201)

    @State var zSpeed = Double.random(in: 0.501...2.201)
    @State var anchor = CGFloat.random(in: 0...1).rounded()
    
    var body: some View {
        shape
            .foregroundColor(color)
            .rotation3DEffect(.degrees(move ? 360:0), axis: (x: spinDirX, y: 0, z: 0))
            .animation(Animation.linear(duration: xSpeed).repeatCount(10, autoreverses: false), value: move)
            .rotation3DEffect(.degrees(
```

### Core Architecture Module: `Sources/Shapes/RoundedCross.swift`
```
//
//  RoundedCross.swift
//  Confetti
//
//  Created by Simon Bachmann on 04.12.20.
//

import SwiftUI

public struct RoundedCross: Shape {
    public func path(in rect: CGRect) -> Path {
        var path = Path()

        path.move(to: CGPoint(x: rect.minX, y: rect.maxY/3))
        path.addQuadCurve(to: CGPoint(x: rect.maxX/3, y: rect.minY), control: CGPoint(x: rect.maxX/3, y: rect.maxY/3))
        path.addLine(to: CGPoint(x: 2*rect.maxX/3, y: rect.minY))
        
        path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY/3), control: CGPoint(x: 2*rect.maxX/3, y: rect.maxY/3))
        path.addLine(to: CGPoint(x: rect.maxX, y: 2*rect.maxY/3))

        path.addQuadCurve(to: CGPoint(x: 2*rect.maxX/3, y: rect.maxY), control: CGPoint(x: 2*rect.maxX/3, y: 2*rect.maxY/3))
        path.addLine(to: CGPoint(x: rect.maxX/3, y: rect.maxY))

        path.addQuadCurve(to: CGPoint(x: 2*rect.minX/3, y: 2*rect.maxY/3), control: CGPoint(x: rect.maxX/3, y: 2*rect.maxY/3))

        return path
    }
}

struct RoundedCross_Previews: PreviewProvider {
    static var previews: some View {
        RoundedCross()
    }
}

```

### Core Architecture Module: `Sources/Shapes/SlimRectangle.swift`
```
//
//  SlimRectangle.swift
//  Confetti
//
//  Created by Simon Bachmann on 04.12.20.
//

import SwiftUI

public struct SlimRectangle: Shape {
    public func path(in rect: CGRect) -> Path {
        var path = Path()

        path.move(to: CGPoint(x: rect.minX, y: 4*rect.maxY/5))
        path.addLine(to: CGPoint(x: rect.maxX, y: 4*rect.maxY/5))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))

        return path
    }
}

struct SlimRectangle_Previews: PreviewProvider {
    static var previews: some View {
        SlimRectangle()
    }
}

```

### Core Architecture Module: `Sources/Shapes/Triangle.swift`
```
//
//  Triangle.swift
//  Confetti
//
//  Created by Simon Bachmann on 04.12.20.
//

import SwiftUI

public struct Triangle: Shape {
    public func path(in rect: CGRect) -> Path {
        var path = Path()

        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.minY))

        return path
    }
}

struct Triangle_Previews: PreviewProvider {
    static var previews: some View {
        Triangle()
    }
}

```

### Core Architecture Module: `Sources/View+ConfettiCannon.swift`
```
//
//  View+ConfettiCannon.swift
//  
//
//  Created by Abdullah Alhaider on 24/03/2022.
//

import SwiftUI

public extension View {
    
    /// renders configurable confetti animation
    ///
    /// - Usage:
    ///
    /// ```
    ///    import SwiftUI
    ///
    ///    struct ContentView: View {
    ///
    ///        @State private var counter: Int = 0
    ///
    ///        var body: some View {
    ///            Button("Wow") {
    ///                counter += 1
    ///            }
    ///            .confettiCannon(counter: $counter)
    ///        }
    ///    }
    /// ```
    ///
    /// - Parameters:
    ///   - counter: on any change of this variable the animation is run
    ///   - num: amount of confettis
    ///   - colors: list of colors that is applied to the default shapes
    ///   - confettiSize: size that confettis and emojis are scaled to
    ///   - rainHeight: vertical distance that confettis pass
    ///   - fadesOut: reduce opacity towards the end of the animation
    ///   - opacity: maximum opacity that is reached during the animation
    ///   - openingAngle: boundary that defines the opening angle in degrees
    ///   - closingAngle: boundary that defines the closing angle in degrees
    ///   - radius: explosion radius
    ///   - repetitions: number of repetitions of the explosion
    ///   - repetitionInterval: duration between the repetitions
    ///   - hapticFeedback: enable or disable haptic feedback
    ///
    @ViewBuilder func confettiCannon<T>(
        trigger: Binding<T>,
        num: Int = 20,
        confettis: [ConfettiType] = ConfettiType.allCases,
        colors: [Color] = [.blue, .red, .green, .yellow, .pink, .purple, .orange],
        confettiSize: CGFloat = 10.0,
        rainHeight: CGFloat = 600.0,
        fadesOut: Bool = true,
        opacity: Double = 1.0,
        openingAngle: Angle = .degrees(60),
        closingAngle: Angle = .degrees(120),
        radius: CGFloat = 300,
        repetitions: Int = 1,
        repetitionInterval: Double = 1.0,
				hapticFeedback: Bool = true
    ) -> some View where T: Equatable {
        ZStack {
            self.layoutPriority(1)
            ConfettiCannon(
                trigger: trigger,
                num: num,
                confettis: confettis,
                colors: colors,
                confettiSize: confettiSize,
                rainHeight: rainHeight,
                fadesOut: fadesOut,
                opacity: opacity,
                openingAngle: openingAngle,
                closingAngle: closingAngle,
                radius: radius,
                repetitions: repetitions,
                repetitionInterval: repetitionInterval,
                hapticFeedback: hapticFeedback
            )
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #69** (2026-01-05): **tests fail because of wrong path**
  *Symptoms*: ### Expected Behaviour Tests should pass on all platforms, and Swift Package Index should accurately show which platforms this project supports. - https://swiftpackageindex.com/simibac/ConfettiSwiftUI  ### Actual Behaviour Instead, build & tests fail, and Swift Package Index shows this project as only supporting macOS - https://swiftpackageindex.com/simibac/ConfettiSwiftUI  ### Steps to Reproduce the Issue look at https://swiftpackageindex.com/simibac/ConfettiSwiftUI/builds  ### Solution It's a one line fix, unless you want to do more refactoring with the tests in general and move the `LinuxMain.swift` file which is placed inside the Tests folder or something else like that.  Anyway, all that needs to be done is change the path in package.swift  ``` ⏺ Update(Package.swift)   ⎿  Added 1 line, removed 1 line       31          .testTarget(       32              name: "ConfettiSwiftUITests",       33              dependencies: ["ConfettiSwiftUI"],       34 -            path: "Tests"),       34 +            path: "Tests/ConfettiSwiftUITests"),       35       36      ]       37  ) ``` 

- **Issue #67** (2026-01-05): **Fix duplicate haptic feedback impact generation**
  *Symptoms*: ### Description  While browsing the library source, I noticed a duplicate block of code related to haptic feedback impact generation. It’s not causing any issue, just duplicate code.  ### Related Issues  No issue, just duplicated code.  ### Checklist  - [x] Have you added tests where necessary? Do all the test pass?  - [x] Have you added descriptive comments to your code? - [x] Have you updated the documentation related to this propo 

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

### Incident Patch 1: `9ae5bc2c` (2026-01-05)
**Commit Message**: fixes issue #69

**File**: `Package.swift` (modified, +0/-1)
```diff
@@ -32,6 +32,5 @@ let package = Package(
             name: "ConfettiSwiftUITests",
             dependencies: ["ConfettiSwiftUI"],
             path: "Tests/ConfettiSwiftUITests"),
-        
     ]
 )
```

---

### Incident Patch 2: `e0262ce5` (2026-01-05)
**Commit Message**: fixes issue #69 and issue #33

**File**: `Package.swift` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ let package = Package(
         .testTarget(
             name: "ConfettiSwiftUITests",
             dependencies: ["ConfettiSwiftUI"],
-            path: "Tests"),
+            path: "Tests/ConfettiSwiftUITests"),
         
     ]
 )
```

**File**: `Sources/ConfettiSwiftUI.swift` (modified, +4/-4)
```diff
@@ -51,7 +51,7 @@ public enum ConfettiType:CaseIterable, Hashable {
 @available(iOS 14.0, macOS 11.0, watchOS 7, tvOS 14.0, *)
 public struct ConfettiCannon<T: Equatable>: View {
     @Binding var trigger: T
-    @StateObject private var confettiConfig:ConfettiConfig
+    @ObservedObject private var confettiConfig:ConfettiConfig
 
     @State var animate:[Bool] = []
     @State var finishedAnimationCounter = 0
@@ -105,7 +105,7 @@ public struct ConfettiCannon<T: Equatable>: View {
             }
         }
     
-        _confettiConfig = StateObject(wrappedValue: ConfettiConfig(
+        _confettiConfig = ObservedObject(wrappedValue: ConfettiConfig(
             num: num,
             shapes: shapes,
             colors: colors,
@@ -160,7 +160,7 @@ public struct ConfettiCannon<T: Equatable>: View {
 @available(iOS 14.0, macOS 11.0, watchOS 7, tvOS 14.0, *)
 struct ConfettiContainer: View {
     @Binding var finishedAnimationCounter:Int
-    @StateObject var confettiConfig:ConfettiConfig
+    @ObservedObject var confettiConfig:ConfettiConfig
     @State var firstAppear = true
 
     var body: some View{
@@ -184,7 +184,7 @@ struct ConfettiContainer: View {
 struct ConfettiView: View{
     @State var location:CGPoint = CGPoint(x: 0, y: 0)
     @State var opacity:Double = 0.0
-    @StateObject var confettiConfig:ConfettiConfig
+    @ObservedObject var confettiConfig:ConfettiConfig
     
     func getShape() -> AnyView {
         return confettiConfig.shapes.randomElement()!
```

---

### Incident Patch 3: `56c5c6e9` (2025-08-27)
**Commit Message**: Fix duplicate haptic feedback impact generation

**File**: `Sources/ConfettiSwiftUI.swift` (modified, +0/-5)
```diff
@@ -144,11 +144,6 @@ public struct ConfettiCannon<T: Equatable>: View {
                             let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
                             impactFeedback.impactOccurred()
                         }
-
-                        if confettiConfig.hapticFeedback {
-                            let impactFeedback = UIImpactFeedbackGenerator(style: .heavy)
-                            impactFeedback.impactOccurred()
-                        }
 #endif
                     }
                 }
```

#### Recent Merged Pull Requests:
- **PR #67** (2026-01-05): Fix duplicate haptic feedback impact generation (@danielepantaleone)
- **PR #64** (2026-01-05): Fix failed to build for watchOS. Add haptics for watchOS (@zeyrie)
- **PR #62** (2025-04-07): Add Deep Dish Unofficial to the list of project in the README (@MortenGregersen)
- **PR #61** (2025-04-07): Skip haptic feedback setup on tvOS (@MortenGregersen)
- **PR #59** (2025-04-07): Add layoutPriority to self view (@dollymsq)
- **PR #56** (2025-01-21): fix for macOS target (@sakrist)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
