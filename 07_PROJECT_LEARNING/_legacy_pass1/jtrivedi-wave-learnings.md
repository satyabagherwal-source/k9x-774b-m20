# Forensic Learning Record (Deep Inspection): jtrivedi/Wave

> **Canonical Artifact**: `07_PROJECT_LEARNING/jtrivedi-wave-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jtrivedi/Wave](https://github.com/jtrivedi/Wave))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:46:06.004Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jtrivedi/Wave`
- **Description**: Wave is a spring-based animation engine for iOS and macOS that makes it easy to create fluid, interruptible animations that feel great.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2398 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/Wave/AnimatorState.swift`
```
//
//  AnimationState.swift
//  Wave
//
//  Copyright (c) 2022 Janum Trivedi.
//

/**
 The current state of an `Animation`.
 */
public enum AnimatorState {
    /**
     The animation is not currently running, but is ready.
     */
    case inactive

    /**
     The animation is currently active and executing.
     */
    case running

    /**
     The animation has just stopped, and will be reset to the `inactive` state.
     */
    case ended
}

```

### Core Architecture Module: `Sources/Wave/UIMathUtilities.swift`
```
//
//  UIMathUtilities.swift
//  Wave
//
//  Copyright (c) 2022 Janum Trivedi.
//

import CoreGraphics
import QuartzCore

public func rubberband(value: CGFloat, range: ClosedRange<CGFloat>, interval: CGFloat, c: CGFloat = 0.55) -> CGFloat {
    // * x = distance from the edge
    // * c = constant value, UIScrollView uses 0.55
    // * d = dimension, either width or height
    // b = (1.0 – (1.0 / ((x * c / d) + 1.0))) * d
    if range.contains(value) {
        return value
    }

    let d: CGFloat = interval

    if value > range.upperBound {
        let x = value - range.upperBound
        let b = (1.0 - (1.0 / ((x * c / d) + 1.0))) * d
        return range.upperBound + b
    } else {
        let x = range.lowerBound - value
        let b = (1.0 - (1.0 / ((x * c / d) + 1.0))) * d
        return range.lowerBound - b
    }
}

/**
 Projects a scalar value based on a scalar velocity.
 */
public func project(value: CGFloat, velocity: CGFloat, decelerationRate: CGFloat = 0.998) -> CGFloat {
    value + project(initialVelocity: velocity, decelerationRate: decelerationRate)
}

/**
 Projects a 2D point based on a 2D velocity.
 */
public func project(point: CGPoint, velocity: CGPoint, decelerationRate: CGFloat = 0.998) -> CGPoint {
    CGPoint(
        x: point.x + project(initialVelocity: velocity.x, decelerationRate: decelerationRate),
        y: point.y + project(initialVelocity: velocity.y, decelerationRate: decelerationRate)
    )
}

func project(initialVelocity: CGFloat, decelerationRate: CGFloat) -> CGFloat {
    (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate)
}

/**
 Takes a value in range `(a, b)` and returns that value mapped to another range `(c, d)` using linear interpolation.
 
 For example, `0.5` mapped from range `(0, 1)` to range `(0, 100`) would produce `50`.
 
 Note that the return value is not clipped to the `out` range. For example, `mapRange(2, 0, 1, 0, 100)` would return `200`.
 */
public func mapRange<T: FloatingPoint>(value: T, inMin: T, inMax: T, outMin: T, outMax: T, clip: Bool = false) -> T {
    let result = ((value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin)
    if clip {
        if result > outMax {
            return outMax
        } else if result < outMin {
            return outMin
        } else {
            return result
        }
    } else {
        return result
    }
}

/**
 The same function as `mapRange(value:inMin:inMax:outMin:outMax:)` but omitting the parameter names for terseness.
 */
public func mapRange<T: FloatingPoint>(_ value: T, _ inMin: T, _ inMax: T, _ outMin: T, _ outMax: T, clip: Bool = false) -> T {
    mapRange(value: value, inMin: inMin, inMax: inMax, outMin: outMin, outMax: outMax, clip: clip)
}

/**
 Returns a value bounded by the provided range.
 - parameter lower: The minimum allowable value (inclusive).
 - parameter upper: The maximum allowable value (inclusive).
 */
public func clip<T: FloatingPoint>(value: T, lower: T, upper: T) -> T {
    min(upper, max(value, lower))
}

/**
 Returns a value bounded by the range `[0, 1]`.
 */
public func clipUnit<T: FloatingPoint>(value: T) -> T {
    clip(value: value, lower: 0, upper: 1)
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version: 5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Wave",
    platforms: [
       .iOS(.v13),
       .macOS(.v10_12)
    ],
    products: [
        // Products define the executables and libraries a package produces, and make them visible to other packages.
        .library(
            name: "Wave",
            targets: ["Wave"])
    ],
    dependencies: [
        // Dependencies declare other packages that this package depends on.
        // .package(url: /* package url */, from: "1.0.0"),
    ],
    targets: [
        // Targets are the basic building blocks of a package. A target can define a module or a test suite.
        // Targets can depend on other targets in this package, and on products in packages this package depends on.
        .target(
            name: "Wave",
            dependencies: []),
        .testTarget(
            name: "WaveTests",
            dependencies: ["Wave"])
    ]
)

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample-macOS/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  Wave-Sample-macOS
//
//  Copyright (c) 2022 Janum Trivedi.
//

import Cocoa

@main
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // Insert code here to initialize your application
    }

    func applicationWillTerminate(_ aNotification: Notification) {
        // Insert code here to tear down your application
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        return true
    }

}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample-macOS/ViewController.swift`
```
//
//  ViewController.swift
//  Wave-Sample-macOS
//
//  Copyright (c) 2022 Janum Trivedi.
//

import Cocoa
import Wave

class ViewController: NSViewController {

    var rounded: Bool = false

    lazy var button: NSButton = {
        let button = NSButton()
        button.title = "Click Me"
        button.wantsLayer = true
        button.isBordered = false
        button.layer?.cornerCurve = .continuous
        button.layer?.backgroundColor = NSColor.systemBlue.cgColor
        button.frame = CGRect(origin: .zero, size: CGSize(width: 100, height: 100))
        return button
    }()

    @objc
    func handleClick(sender: NSClickGestureRecognizer) {
        rounded.toggle()

        // Animate to the new state
        layoutBox(mode: .animated, shouldRound: rounded)
    }

    func layoutBox(mode: AnimationMode, shouldRound rounded: Bool) {
        Wave.animate(withSpring: Spring(dampingRatio: 0.8, response: 1.2), mode: mode) {
            button.layer?.animator.cornerRadius    = rounded ? 24 : 4
            button.layer?.animator.backgroundColor = rounded ? NSColor.systemGreen.cgColor : NSColor.systemBlue.cgColor
        }
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()

        view.addSubview(button)

        // Configure the button's initial layout/style without animation
        layoutBox(mode: .nonAnimated, shouldRound: rounded)

        let clickGesture = NSClickGestureRecognizer(target: self, action: #selector(handleClick(sender:)))
        button.addGestureRecognizer(clickGesture)
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.title = "Wave with AppKit"
    }

    override func viewDidLayout() {
        button.setFrameOrigin(CGPoint(
            x: view.bounds.midX - (button.bounds.size.width / 2.0),
            y: view.bounds.midY - (button.bounds.size.height / 2.0)
        ))
    }

}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  Wave
//
//  Copyright (c) 2022 Janum Trivedi.
//

import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // Called when a new scene session is being created.
        // Use this method to select a configuration to create the new scene with.
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample/CGRect+Extensions.swift`
```
//
//  CGRect+Extensions.swift
//  Wave-Sample
//
//  Copyright (c) 2022 Janum Trivedi.
//

import UIKit

extension CGRect {

    /**
     The top-left point of the rect.
     */
    var topLeft: CGPoint {
        CGPoint(x: minX, y: minY)
    }

    /**
     The top-right point of the rect.
     */
    var topRight: CGPoint {
        CGPoint(x: maxX, y: minY)
    }

    /**
     The bottom-left point of the rect.
     */
    var bottomLeft: CGPoint {
        CGPoint(x: minX, y: maxY)
    }

    /**
     The bottom-right point of the rect.
     */
    var bottomRight: CGPoint {
        CGPoint(x: maxX, y: maxY)
    }
}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample/DragGesture+Extensions.swift`
```
//
//  DragGesture+Extensions.swift
//  Wave-Sample
//
//  Source: https://stackoverflow.com/a/73426600
//

import SwiftUI

extension DragGesture.Value {

    internal var velocity: CGSize {
        let valueMirror = Mirror(reflecting: self)
        for valueChild in valueMirror.children {
            if valueChild.label == "velocity" {
                let velocityMirror = Mirror(reflecting: valueChild.value)
                for velocityChild in velocityMirror.children {
                    if velocityChild.label == "valuePerSecond" {
                        if let velocity = velocityChild.value as? CGSize {
                            return velocity
                        }
                    }
                }
            }
        }
        fatalError("Unable to retrieve velocity from \(Self.self)")
    }

}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample/InstantPanGestureRecognizer.swift`
```
//
//  InstantPanGestureRecognizer.swift
//  Wave
//
//  Copyright (c) 2022 Janum Trivedi.
//

import Foundation
import UIKit

public class InstantPanGestureRecognizer: UIPanGestureRecognizer {

    public override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        self.state = .began
    }

}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample/PathView.swift`
```
//
//  PathView.swift
//  Wave
//
//  Copyright (c) 2022 Janum Trivedi.
//

import Foundation
import UIKit

class PathView: UIView {

    private var points: [CGPoint] = [] {
        didSet {
            setNeedsDisplay()
        }
    }

    func add(_ point: CGPoint) {
        if points.count > 300 {
            points.removeFirst()
        }
        points.append(point)
    }

    func reset() {
        points.removeAll()
        setNeedsDisplay()
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        isUserInteractionEnabled = false
        backgroundColor = .clear
    }

    override func draw(_ rect: CGRect) {
        guard let firstPoint = points.first else {
            return
        }

        let context = UIGraphicsGetCurrentContext()!
        context.saveGState()
        context.beginPath()

        context.move(to: firstPoint)

        points.forEach {
            context.addLine(to: $0)
        }

        context.setLineCap(.square)
        context.setStrokeColor(UIColor.systemOrange.cgColor)
        context.setLineWidth(2)
        context.strokePath()
        context.restoreGState()
    }
}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample/SceneDelegate.swift`
```
//
//  SceneDelegate.swift
//  Wave
//
//  Copyright (c) 2022 Janum Trivedi.
//

import UIKit
import Wave

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Use this method to optionally configure and attach the UIWindow `window` to the provided UIWindowScene `scene`.
        // If using a storyboard, the `window` property will automatically be initialized and attached to the scene.
        // This delegate does not imply the connecting scene or session are new (see `application:configurationForConnectingSceneSession` instead).
        guard let windowScene = (scene as? UIWindowScene) else {
            return
        }

        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = .white

        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.backgroundColor = .white

        let tabViewController = UITabBarController()
        tabViewController.tabBar.standardAppearance = tabBarAppearance

        if #available(iOS 15.0, *) {
            tabViewController.tabBar.scrollEdgeAppearance = tabBarAppearance
        } else {
            // Fallback on earlier versions
        }

        tabViewController.viewControllers = [
            PictureInPictureViewController(),
            GridViewController(),
            SheetViewController(),
            SwiftUIViewController()
        ]

        tabViewController.selectedIndex = 0

        self.window?.rootViewController = tabViewController
        self.window?.makeKeyAndVisible()

    }

}

```

### Core Architecture Module: `Sample App/Wave-Sample/Wave-Sample/View Controllers/GridViewController.swift`
```
//
//  GridViewController.swift
//  Wave
//
//  Copyright (c) 2022 Janum Trivedi.
//

import UIKit

import Wave

class GridViewController: UIViewController {

    let dampingLabel = UILabel()
    let responseLabel = UILabel()
    let settlingTimeLabel = UILabel()

    let dampingSlider = UISlider()
    let responseSlider = UISlider()

    var sliderSpring: Spring {
        Spring(
            dampingRatio: Double(dampingSlider.value),
            response: Double(responseSlider.value)
        )
    }

    // MARK: - Lifecycle

    override func viewDidLoad() {
        view.backgroundColor = .white

        setupSliders()
        setupGrid()
        updateGridColors()

        dampingSlider.value = 0.70
        responseSlider.value = 0.80

        updateLabels()
    }

    // MARK: - Gesture handling

    @objc
    func handlePanWithBlock(sender: UIPanGestureRecognizer) {
        guard let draggedView = sender.view as? Box else {
            return
        }

        draggedView.superview?.bringSubviewToFront(draggedView)

        let touchLocation = sender.location(in: view)
        let touchVelocity = sender.velocity(in: view)

        switch sender.state {
        case .began, .changed:
            let scale = mapRange(touchLocation.y, 0, view.bounds.size.height, 0.2, 2.5)

            let interactiveSpring = Spring(dampingRatio: 1.0, response: 0.3)

            Wave.animate(withSpring: interactiveSpring) {
                draggedView.animator.center = touchLocation
                draggedView.animator.scale = CGPoint(x: scale, y: scale)
            }

        case .ended, .cancelled:
            Wave.animate(withSpring: sliderSpring, gestureVelocity: touchVelocity) {
                draggedView.animator.center = draggedView.originCenter
                draggedView.animator.scale = CGPoint(x: 1, y: 1)
            } completion: { finished, retargeted in
                print("[Ended] completion: finished: \(finished), retargeted: \(retargeted)")
            }

        default:
            break
        }
    }

    // MARK: - View setup

    func setupGrid() {
        let totalWidth = view.bounds.size.width

        let size = 80.0
        let columns = Int(totalWidth / size)
        let rows = columns + 1

        let boxWidth = (CGFloat(columns) * size)
        let xPadding = (totalWidth - boxWidth) / (CGFloat(columns + 1))

        for row in 0..<rows {
            for col in 0..<columns {
                let box = Box()
                view.addSubview(box)

                box.frame.origin = CGPoint(
                    x: xPadding + CGFloat(col) * size + CGFloat(col) * xPadding,
                    y: 60 + xPadding + CGFloat(row) * size + CGFloat(row) * xPadding
                ).scaledIntegral

                box.originCenter = box.center

                let panGestureRecognizer = InstantPanGestureRecognizer(target: self, action: #selector(handlePanWithBlock(sender:)))
                box.addGestureRecognizer(panGestureRecognizer)
            }
        }
    }

    func setupSliders() {
        dampingSlider.minimumValue = 0
        dampingSlider.maximumValue = 1.2

        responseSlider.minimumValue = 0.05
        responseSlider.maximumValue = 3

        dampingSlider.addTarget(self, action: #selector(dampingChanged(sender:)), for: .valueChanged)
        responseSlider.addTarget(self, action: #selector(responseChanged(sender:)), for: .valueChanged)

        let sliderStack = UIStackView(arrangedSubviews: [settlingTimeLabel, dampingLabel, dampingSlider, responseLabel, responseSlider])
        sliderStack.setCustomSpacing(10, after: settlingTimeLabel)
        sliderStack.axis = .vertical
        sliderStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(sliderStack)

        sliderStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20).isActive = true
        sliderStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20).isActive = true
        sliderStack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20).isActive = true
    }

    func updateGridColors() {
        let boxes = view.subviews.compactMap {
            $0 as? Box
        }

        boxes.forEach {
            let firstBox = boxes.first!
            let lastBox = boxes.last!

            let maxDistance = lastBox.center.distance(to: firstBox.center)
            let distanceFromCenter = $0.center.distance(to: firstBox.center)
            let progress = mapRange(distanceFromCenter, 0, maxDistance, 0, 1)
            $0.backgroundColor = UIColor.interpolate(from: .systemBlue, to: .systemPurple, with: progress)
        }
    }

    // MARK: - Slider handling

    @objc
    func dampingChanged(sender: UISlider) {
        updateLabels()
    }

    @objc
    func responseChanged(sender: UISlider) {
        updateLabels()
    }

    func updateLabels() {
        dampingLabel.text = String(format: "Damping Ratio: %.2f", dampingSlider.value)
        responseLabel.text = String(format: "Frequency Response: %.2f", responseSlider.value)
        settlingTimeLabel.text = String(format: "Settling time: %.2f", sliderSpring.settlingDuration)
    }

    // MARK: - Init

    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)

        title = "Grid"
        tabBarItem.image = UIImage(systemName: "square.grid.2x2")
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

}

class Box: UIView {
    var originCenter: CGPoint = .zero

    init() {
        super.init(frame: CGRect(x: 0, y: 0, width: 80, height: 80))
        backgroundColor = .systemBlue
        layer.cornerCurve = .continuous
        layer.cornerRadius = (bounds.size.height * 0.2237)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #38** (2024-11-28): **Is this abandoned because it was fixed in SwiftUI itself?**
  *Symptoms*: It looks like abruptly stopped in 2022. Is it because retargeting was improved in SwiftUI?
  **Post-Mortem & Fix Analysis**:
  > Wave is largely stable and feature-complete right now, which is why there aren’t many changes. It’s definitely not abandoned.  If you run into an but or have a feature request, feel free to open another issue.

- **Issue #37** (2024-01-04): **The documentation website is down.**
  *Symptoms*: https://wave-jtrivedi.structure.sh/ is not reachable.  System: macOS 14.1.2 (23B92) Browser: Safari Version 17.1.2, Arc Version 1.19.1 (43687)
  **Post-Mortem & Fix Analysis**:
  > Oh no! Will fix this.
  > Docs site now available here: [jtrivedi.github.io/Wave/](https://jtrivedi.github.io/Wave/)  Thanks!

- **Issue #36** (2023-12-21): **Extended animation support**
  *Symptoms*: ## Extended animation support - NSView/UIView:     - frame, size, origin, center, alpha, backgroundColor, borderColor, borderWidth, shadowColor, shadowOpacity, shadowOffset, shadowRadius, transform, scale, rotation, translation, cornerRadius - CALayer     - frame, bounds, size, origin, center, opacity, backgroundColor, borderColor, borderWidth, shadowColor, shadowOpacity, shadowOffset, shadowRadius, transform, scale, rotation, translation, cornerRadius - NSTextField/UITextField, UILabel, UITextView:     - fontSize, textColor - NSScrollView/UIScrollView:     - contentOffset, zoomFactor - NSWindow:     - frame, size, alpha, backgroundColor - NSLayoutConstraint:     - constant  ## Spring - Feature parity SwiftUI's Spring (same properties & methods) - smooth, bouncy & snappy spring presets: `Spring.snappy`, `Spring.snappy(duration: CGFloat = 0.5, extraBounce: CGFloat = 0.0)`, etc. - `Spring(duration: CGFloat, bounce: CGFloat)` - Init via a SwiftUI spring: `Spring(_ spring: SwiftUI.Spring)` - Init via a specified settling time, damping ratio and epsilon (the threshold for how small all subsequent values need to be before the spring is considered to have settled): `Spring(settlingDuration: TimeInterval, dampingRatio: Double, epsilon: Double = 0.001)`  ## SpringAnimator - Now uses `AnimatableData` instead of `SpringInterpolatable`. - `Double`, `Float`, `CGFloat`, `CGPoint`, `CGSize`, `CGRect`, `CATransform3D`, `WaveColor`, `CGColor`, `CGAffineTransform` suppor
  **Post-Mortem & Fix Analysis**:
  > Hi -- I appreciate the work you've put in here, but Wave is unfortunately not open to contributions, per the Contributing.md file [found here](https://github.com/jtrivedi/Wave/blob/main/CONTRIBUTING.md).

- **Issue #35** (2023-10-26): **Major wave update**
  *Symptoms*: [I created a major wave update.](https://github.com/flocked/Wave/tree/main). I never submitted a request, so please help me with it.  ## Extended animation support - NSView/UIView:     - frame, size, origin, center, alpha, backgroundColor, borderColor, borderWidth, shadowColor, shadowOpacity, shadowOffset, shadowRadius, transform, scale, rotation, translation, cornerRadius - CALayer     - frame, bounds, size, origin, center, opacity, backgroundColor, borderColor, borderWidth, shadowColor, shadowOpacity, shadowOffset, shadowRadius, transform, scale, rotation, translation, cornerRadius - NSTextField/UITextField, UILabel, UITextView:     - fontSize, textColor - NSScrollView/UIScrollView:     - contentOffset, zoomFactor - NSWindow:     - frame, size, alpha, backgroundColor - NSLayoutConstraint:     - constant  ## Spring - Feature, properties and functions parity to SwiftUI's Spring. - smooth, bouncy, snappy presets - Spring(duration: CGFloat, bounce: CGFloat)  ## SpringAnimator - Now uses `AnimatableData` instead of `SpringInterpolatable`. - `Double`, `Float`, `CGFloat`, `CGPoint`, `CGSize`, `CGRect`, `CATransform3D`, `WaveColor`, `CGColor`, `CGAffineTransform` support AnimatableData by default.  ```swift public protocol AnimatableData: Equatable, Comparable {     /// The type defining the data to animate.     associatedtype AnimatableData: VectorArithmetic = Self     /// The data to animate.     var animatableData: AnimatableData { get }     /// In

- **Issue #33** (2024-11-28): **Animation must have a non-nil `value` before starting.**
  *Symptoms*: I get this error when I try to use this in swiftui:   "**Animation must have a non-nil `value` before starting.**" my code is here:   `.onAppear {             offsetAnimator.value = .zero              // The offset animator's callback will update the `offset` state variable.             offsetAnimator.valueChanged = { newValue in                 boxOffset = newValue             }         }         .offset(x: boxOffset.x, y: boxOffset.y)         .gesture(             DragGesture()                 .onChanged { value in                     // Update the animator's target to the new drag translation.                     offsetAnimator.target = CGPoint(x: value.translation.width, y: value.translation.height)                      // Don't animate the box's position when we're dragging it.                     offsetAnimator.mode = .nonAnimated                     offsetAnimator.start()                 }                 .onEnded { value in                     // Animate the box to its original location (i.e. with zero translation).                     offsetAnimator.target = .zero                      // We want the box to animate to its original location, so use an `animated` mode.                     // This is different than the                     offsetAnimator.mode = .animated                      // Take the velocity of the gesture, and give it to the animator.                     // This makes the throw animation feel natural and continuous.   
  **Post-Mortem & Fix Analysis**:
  > Apologies for the late reply here. Closing for now, please re-open if this is still an issue. 

- **Issue #32** (2023-03-17): **Animation broken on UIViewControllerAnimatedTransitioning**
  *Symptoms*: Hi jtrivedi, Thanks for sharing. I find some trouble when using `Wave` with `UIViewControllerAnimatedTransitioning ` This code works fine with UIView.animation.  ```swift import UIKit import Wave  class PopupViewController: UIViewController {     lazy var contentView: UIView = {         let view = UIView()         view.backgroundColor = .white         view.layer.cornerRadius = 10         view.layer.masksToBounds = true         view.alpha = 0         view.transform = .init(scaleX: 0, y: 0)         return view     }()      lazy var blurEffectView: UIVisualEffectView = {         let blurEffect = UIBlurEffect(style: .dark)         let blurEffectView = UIVisualEffectView(effect: blurEffect)         blurEffectView.frame = view.bounds         blurEffectView.alpha = 0.0         return blurEffectView     }()      override func viewDidLoad() {         super.viewDidLoad()         setupViews()     }      @objc func viewTapped() {         dismiss(animated: true)     }      private func setupViews() {         view.backgroundColor = .clear          blurEffectView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(viewTapped)))          view.addSubview(blurEffectView)          view.addSubview(contentView)         contentView.snp.makeConstraints { make in             make.center.equalToSuperview()             make.leading.equalToSuperview().offset(20)             make.trailing.equalToSuperview().offset(-20)             m
  **Post-Mortem & Fix Analysis**:
  > Hey there. I haven’t run your code, but when animating view properties with Wave, you need to do ‘view.animator.alpha = 1’, not ‘view.alpha = 1’.  Without setting the property on the view’s animator, Wave won’t pick up the animation.  Let me know if that fixes it!

- **Issue #31** (2023-02-26): **Fix display link frame rate range**
  *Symptoms*: According to the documentation, `maximumFramesPerSecond`, for devices with ProMotion displays, the value of this property can reach 120.   I found that in some cases, the return value of this property will be 61 instead of 60, so the `highFPSEnabled` judgment will be invalid.   So I added a minimum value determination to make sure that the minimum value is less than the maximum value.
  **Post-Mortem & Fix Analysis**:
  > Because this problem has caused some crashes, I hope you can help review this pr asap @jtrivedi 
  > Just fixed this on main/release `0.3.2`. Thank you!

- **Issue #30** (2023-02-26): **DisplayLinkProvider preferredFrameRateRange range error**
  *Symptoms*: Hi,  First of all - great library! I am trying this out with SwiftUI (although I think this issue is unrelated) but I am encountering an issue. On my physical device (iPhone 11 Pro), the returned value of `UIScreen.main.maximumFramesPerSecond` is 61.   This makes the following error out:  ```swift         if #available(iOS 15.0, *) {             let maximumFramesPerSecond = Float(UIScreen.main.maximumFramesPerSecond)             let highFPSEnabled = maximumFramesPerSecond > 60             let minimumFPS: Float = highFPSEnabled ? 80 : 60             displayLinkProvider?.preferredFrameRateRange = .init(minimum: minimumFPS, maximum: maximumFramesPerSecond, preferred: maximumFramesPerSecond)         } ```  Error: > *** Terminating app due to uncaught exception 'NSInvalidArgumentException', reason: 'invalid range (minimum: 80.00 maximum: 61.00 preferred: 61.00)'  For now, I am forking the repo to increase the `highFPSEnabled` threshold and see if that works. Is there any other way to make the check work more reliably? 
  **Post-Mortem & Fix Analysis**:
  > Interesting, good find! Let me take a look 👍 
  > Fixed with release `0.3.2`. Thanks for opening the issue!

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

### Incident Patch 1: `d95ce41f` (2023-02-26)
**Commit Message**: Fix frame-rate crash on iPhone 11 Pro

**File**: `Sources/Wave/Internal/DisplayLinkProviding.swift` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ class CADisplayLinkProvider: DisplayLinkProviding {
         if #available(iOS 15.0, *) {
             let maximumFramesPerSecond = Float(UIScreen.main.maximumFramesPerSecond)
             let highFPSEnabled = maximumFramesPerSecond > 60
-            let minimumFPS: Float = highFPSEnabled ? 80 : 60
+            let minimumFPS: Float = min(highFPSEnabled ? 80 : 60, maximumFramesPerSecond)
             displayLinkProvider?.preferredFrameRateRange = .init(minimum: minimumFPS, maximum: maximumFramesPerSecond, preferred: maximumFramesPerSecond)
         }
     }
```

---

### Incident Patch 2: `258c52f3` (2022-12-26)
**Commit Message**: Move SwiftUI demo file location

**File**: `Sample App/Wave-Sample/Wave-Sample.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -10,7 +10,6 @@
 		F702B19928470D3100F8D848 /* CGRect+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = F702B19828470D3100F8D848 /* CGRect+Extensions.swift */; };
 		F706E35C2845F58C00ADD288 /* Wave in Frameworks */ = {isa = PBXBuildFile; productRef = F706E35B2845F58C00ADD288 /* Wave */; };
 		F72189FD27EE5485001A5CCF /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = F72189FC27EE5485001A5CCF /* Assets.xcassets */; };
-		F7238435291310B300BA6402 /* SwitUIViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = F7238434291310B300BA6402 /* SwitUIViewController.swift */; };
 		F731390827E68AB100DCC56C /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731390727E68AB100DCC56C /* AppDelegate.swift */; };
 		F731390A27E68AB100DCC56C /* SceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731390927E68AB100DCC56C /* SceneDelegate.swift */; };
 		F731392C27E68C1F00DCC56C /* PictureInPictureViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731392627E68C1F00DCC56C /* PictureInPictureViewController.swift */; };
@@ -19,6 +18,7 @@
 		F731393027E68C6900DCC56C /* InstantPanGestureRecognizer.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731392F27E68C6900DCC56C /* InstantPanGestureRecognizer.swift */; };
 		F731393427E68CAE00DCC56C /* PathView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731393327E68CAE00DCC56C /* PathView.swift */; };
 		F76AE81127E6905B00A332E8 /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = F76AE80F27E6905B00A332E8 /* LaunchScreen.storyboard */; };
+		F77E5E8C295A28F700DCF44B /* SwiftUIViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = F77E5E8B295A28F700DCF44B /* SwiftUIViewController.swift */; };
 		F7A63C292922A68100A21E70 /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F7A63C282922A68100A21E70 /* AppDelegate.swift */; };
 		F7A63C2B2922A68100A21E70 /* ViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = F7A63C2A2922A68100A21E70 /* ViewController.swift */; };
 		F7A63C2D2922A68200A21E70 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = F7A63C2C2922A68200A21E70 /* Assets.xcassets */; };
@@ -30,7 +30,6 @@
 /* Begin PBXFileReference section */
 		F702B19828470D3100F8D848 /* CGRect+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "CGRect+Extensions.swift"; sourceTree = "<group>"; };
 		F72189FC27EE5485001A5CCF /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
-		F7238434291310B300BA6402 /* SwitUIViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SwitUIViewController.swift; sourceTree = "<group>"; };
 		F731390427E68AB100DCC56C /* Wave-Sample-iOS.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = "Wave-Sample-iOS.app"; sourceTree = BUILT_PRODUCTS_DIR; };
 		F731390727E68AB100DCC56C /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
 		F731390927E68AB100DCC56C /* SceneDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SceneDelegate.swift; sourceTree = "<group>"; };
@@ -42,6 +41,7 @@
 		F731392F27E68C6900DCC56C /* InstantPanGestureRecognizer.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = InstantPanGestureRecognizer.swift; sourceTree = "<group>"; };
 		F731393327E68CAE00DCC56C /* PathView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = PathView.swift; sourceTree = "<group>"; };
 		F76AE81027E6905B00A332E8 /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; };
+		F77E5E8B295A28F700DCF44B /* SwiftUIViewController.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; name = SwiftUIViewController.swift; path = "View Controllers/SwiftUIViewController.swift"; sourceTree = "<group>"; };
 		F7A63C262922A68100A21E70 /* Wave-Sample-macOS.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = "Wave-Sample-macOS.app"; sourceTree = BUILT_PRODUCTS_DIR; };
 		F7A63C282922A68100A21E70 /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
 		F7A63C2A2922A68100A21E70 /* ViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ViewController.swift; sourceTree = "<group>"; };
@@ -126,7 +126,7 @@
 				F731392627E68C1F00DCC56C /* PictureInPictureViewController.swift */,
 				F731392827E68C1F00DCC56C /* GridViewController.swift */,
 				F731392727E68C1F00DCC56C /* S
```

**File**: `Sample App/Wave-Sample/Wave-Sample/View Controllers/SwiftUIViewController.swift` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 //
-//  SwitUIViewController.swift
+//  SwiftUIViewController.swift
 //  Wave-Sample
 //
 //  Copyright (c) 2022 Janum Trivedi
```

---

### Incident Patch 3: `0c7b9266` (2022-12-26)
**Commit Message**: Fix missing animation settings for translation and scale

**File**: `Sources/Wave/Internal/LayerAnimator+Implementation.swift` (modified, +0/-2)
```diff
@@ -50,7 +50,6 @@ extension LayerAnimator {
             AnimationController.shared.executeHandler(uuid: runningCornerRadiusAnimator?.groupUUID, finished: false, retargeted: true)
 
             let animation = (runningCornerRadiusAnimator ?? SpringAnimator<CGFloat>(spring: settings.spring, value: initialValue, target: targetValue))
-
             animation.configure(withSettings: settings)
 
             animation.target = targetValue
@@ -295,7 +294,6 @@ extension LayerAnimator {
             AnimationController.shared.executeHandler(uuid: runningBorderWidthAnimator?.groupUUID, finished: false, retargeted: true)
 
             let animation = (runningBorderWidthAnimator ?? SpringAnimator<CGFloat>(spring: settings.spring, value: initialValue, target: targetValue))
-
             animation.configure(withSettings: settings)
 
             animation.target = targetValue
```

**File**: `Sources/Wave/Internal/ViewAnimator+Implementation.swift` (modified, +2/-3)
```diff
@@ -101,7 +101,6 @@ extension ViewAnimator {
             AnimationController.shared.executeHandler(uuid: runningCenterAnimator?.groupUUID, finished: false, retargeted: true)
 
             let animation = (runningCenterAnimator ?? SpringAnimator<CGPoint>(spring: settings.spring, value: initialValue, target: targetValue))
-
             animation.configure(withSettings: settings)
 
             if let gestureVelocity = settings.gestureVelocity {
@@ -153,7 +152,6 @@ extension ViewAnimator {
             AnimationController.shared.executeHandler(uuid: runningBoundsOriginAnimator?.groupUUID, finished: false, retargeted: true)
 
             let animation = (runningBoundsOriginAnimator ?? SpringAnimator<CGPoint>(spring: settings.spring, value: initialValue, target: targetValue))
-
             animation.configure(withSettings: settings)
 
             animation.target = targetValue
@@ -201,7 +199,6 @@ extension ViewAnimator {
             AnimationController.shared.executeHandler(uuid: runningBoundsSizeAnimator?.groupUUID, finished: false, retargeted: true)
 
             let animation = (runningBoundsSizeAnimator ?? SpringAnimator<CGSize>(spring: settings.spring, value: initialValue, target: targetValue))
-
             animation.configure(withSettings: settings)
 
             animation.target = targetValue
@@ -383,6 +380,7 @@ extension ViewAnimator {
             AnimationController.shared.executeHandler(uuid: runningScaleAnimator?.groupUUID, finished: false, retargeted: true)
 
             let animation = (runningScaleAnimator ?? SpringAnimator<CGPoint>(spring: settings.spring, value: initialValue, target: targetValue))
+            animation.configure(withSettings: settings)
 
             animation.target = targetValue
             animation.valueChanged = { [weak self] value in
@@ -435,6 +433,7 @@ extension ViewAnimator {
             AnimationController.shared.executeHandler(uuid: runningTranslationAnimator?.groupUUID, finished: false, retargeted: true)
 
             let animation = (runningTranslationAnimator ?? SpringAnimator<CGPoint>(spring: settings.spring, value: initialValue, target: targetValue))
+            animation.configure(withSettings: settings)
 
             animation.target = targetValue
             animation.valueChanged = { [weak self] value in
```

---

### Incident Patch 4: `5e0c957a` (2022-11-14)
**Commit Message**: Fix and rebuild docs site

**File**: `Sources/Wave/Extensions/CGFloat+Extensions.swift` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import QuartzCore
 
 #if os(iOS)
 import UIKit
```

**File**: `Sources/Wave/Extensions/CGPoint+Extensions.swift` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import QuartzCore
 
 extension CGPoint {
 
```

**File**: `Sources/Wave/Extensions/CGRect+Extensions.swift` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import QuartzCore
 
 extension CGRect {
 
```

**File**: `Sources/Wave/Extensions/CGSize+Extensions.swift` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import QuartzCore
 
 extension CGSize {
 
```

**File**: `Sources/Wave/Extensions/Color+Extensions.swift` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import QuartzCore
 
 #if os(iOS)
 import UIKit
```

**File**: `Sources/Wave/Internal/CALayer+LayerAnimator.swift` (modified, +1/-2)
```diff
@@ -6,9 +6,8 @@
 //
 
 import Foundation
-
-import QuartzCore
 import CoreGraphics
+import QuartzCore
 
 private var LayerAnimatorAssociatedObjectHandle: UInt8 = 1 << 4
 private var LayerAnimationsAssociatedObjectHandle: UInt8 = 1 << 5
```

**File**: `Sources/Wave/Internal/SpringInterpolatable.swift` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 //
 
 import Foundation
+import QuartzCore
 
 public protocol SpringInterpolatable: Equatable {
     associatedtype ValueType: SpringInterpolatable
```

**File**: `Sources/Wave/Internal/ViewAnimator+Implementation.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@
 //
 
 import Foundation
+import CoreGraphics
+import QuartzCore
 
 #if os(iOS)
 import UIKit
```

---

### Incident Patch 5: `5e128fc3` (2022-11-14)
**Commit Message**: Fix typo in README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -110,7 +110,7 @@ For example, to draw the orange path of the PiP demo, we need to know the value
 // When the gesture ends, create a `CGPoint` animator from the PiP view's initial center, to its target.
 // The `valueChanged` callback provides the intermediate locations of the callback, allowing us to draw the path.
 
-let positionAnimator = Animator<CGPoint>(spring: animatedSpring)
+let positionAnimator = SpringAnimator<CGPoint>(spring: animatedSpring)
 positionAnimator.value = pipView.center       // The presentation value
 positionAnimator.target = pipViewDestination  // The target value
 positionAnimator.velocity = gestureVelocity
```

---

### Incident Patch 6: `ecf541bf` (2022-11-12)
**Commit Message**: Merge pull request #23 from jtrivedi/janum/fix-block-retain-cycle

Block-based animations can create a retain cycle #22

**File**: `Sources/Wave/Internal/LayerAnimator.swift` (modified, +16/-8)
```diff
@@ -56,11 +56,12 @@ extension LayerAnimator {
                 self?.layer.cornerRadius = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -102,11 +103,12 @@ extension LayerAnimator {
                 self?.layer.opacity = Float(clipUnit(value: value))
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -176,11 +178,12 @@ extension LayerAnimator {
                 self?.layer.borderColor = components.uiColor.cgColor
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished(at: _):
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -223,11 +226,12 @@ extension LayerAnimator {
                 self?.layer.borderWidth = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -270,11 +274,12 @@ extension LayerAnimator {
                 self?.layer.shadowOpacity = clippedValue
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -344,11 +349,12 @@ extension LayerAnimator {
                 self?.layer.shadowColor = components.uiColor.cgColor
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished(at: _):
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -391,11 +397,12 @@ extension LayerAnimator {
                 self?.layer.shadowOffset = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -437,11 +444,12 @@ extension LayerAnimator {
                 self?.layer.shadowRadius = max(0, value)
             }
 
+            let groupUUID = animation.groupUUID
    
```

**File**: `Sources/Wave/Internal/ViewAnimator.swift` (modified, +12/-6)
```diff
@@ -109,11 +109,12 @@ extension ViewAnimator {
                 self?.view.center = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 case .retargeted:
                     break
                 }
@@ -156,11 +157,12 @@ extension ViewAnimator {
                 self?.view.bounds.origin = boundsOrigin
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -204,11 +206,12 @@ extension ViewAnimator {
                 strongSelf.view.bounds = CGRect(origin: strongSelf.view.bounds.origin, size: size)
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 case .retargeted:
                     break
                 }
@@ -267,11 +270,12 @@ extension ViewAnimator {
                 self?.view.backgroundColor = components.uiColor
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished(at: _):
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -386,11 +390,12 @@ extension ViewAnimator {
                 strongSelf.view.transform = transform
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -437,11 +442,12 @@ extension ViewAnimator {
                 strongSelf.view.transform = transform
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
```

---

### Incident Patch 7: `46ce2713` (2022-11-12)
**Commit Message**: Fix retain cycle

**File**: `Sources/Wave/Internal/LayerAnimator.swift` (modified, +16/-8)
```diff
@@ -56,11 +56,12 @@ extension LayerAnimator {
                 self?.layer.cornerRadius = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -102,11 +103,12 @@ extension LayerAnimator {
                 self?.layer.opacity = Float(clipUnit(value: value))
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -176,11 +178,12 @@ extension LayerAnimator {
                 self?.layer.borderColor = components.uiColor.cgColor
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished(at: _):
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -223,11 +226,12 @@ extension LayerAnimator {
                 self?.layer.borderWidth = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -270,11 +274,12 @@ extension LayerAnimator {
                 self?.layer.shadowOpacity = clippedValue
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -344,11 +349,12 @@ extension LayerAnimator {
                 self?.layer.shadowColor = components.uiColor.cgColor
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished(at: _):
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -391,11 +397,12 @@ extension LayerAnimator {
                 self?.layer.shadowOffset = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.layer.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -437,11 +444,12 @@ extension LayerAnimator {
                 self?.layer.shadowRadius = max(0, value)
             }
 
+            let groupUUID = animation.groupUUID
    
```

**File**: `Sources/Wave/Internal/ViewAnimator.swift` (modified, +12/-6)
```diff
@@ -109,11 +109,12 @@ extension ViewAnimator {
                 self?.view.center = value
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 case .retargeted:
                     break
                 }
@@ -156,11 +157,12 @@ extension ViewAnimator {
                 self?.view.bounds.origin = boundsOrigin
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -204,11 +206,12 @@ extension ViewAnimator {
                 strongSelf.view.bounds = CGRect(origin: strongSelf.view.bounds.origin, size: size)
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 case .retargeted:
                     break
                 }
@@ -267,11 +270,12 @@ extension ViewAnimator {
                 self?.view.backgroundColor = components.uiColor
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished(at: _):
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -386,11 +390,12 @@ extension ViewAnimator {
                 strongSelf.view.transform = transform
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
@@ -437,11 +442,12 @@ extension ViewAnimator {
                 strongSelf.view.transform = transform
             }
 
+            let groupUUID = animation.groupUUID
             animation.completion = { [weak self] event in
                 switch event {
                 case .finished:
                     self?.view.animators.removeValue(forKey: animationType)
-                    AnimationController.shared.executeHandler(uuid: animation.groupUUID, finished: true, retargeted: false)
+                    AnimationController.shared.executeHandler(uuid: groupUUID, finished: true, retargeted: false)
                 default:
                     break
                 }
```

---

### Incident Patch 8: `5d4839c9` (2022-11-12)
**Commit Message**: Fix file name



---

### Incident Patch 9: `c4357f3c` (2022-11-10)
**Commit Message**: Fix whitespace

**File**: `Sources/Wave/Extensions/CGFloat+Extensions.swift` (modified, +1/-1)
```diff
@@ -26,5 +26,5 @@ extension CGFloat {
     var radiansToDegrees: CGFloat {
         self * 180 / .pi
     }
-    
+
 }
```

**File**: `Sources/Wave/Internal/LayerAnimator.swift` (modified, +2/-2)
```diff
@@ -164,7 +164,7 @@ extension LayerAnimator {
             let animation = (runningBorderColorAnimator ??
                              SpringAnimator<RGBAComponents>(
                                 spring: settings.spring,
-                                value:  initialValueComponents,
+                                value: initialValueComponents,
                                 target: targetValueComponents
                              )
             )
@@ -332,7 +332,7 @@ extension LayerAnimator {
             let animation = (runningShadowColorAnimator ??
                              SpringAnimator<RGBAComponents>(
                                 spring: settings.spring,
-                                value:  initialValueComponents,
+                                value: initialValueComponents,
                                 target: targetValueComponents
                              )
             )
```

**File**: `Sources/Wave/Internal/SpringInterpolatable.swift` (modified, +0/-1)
```diff
@@ -113,5 +113,4 @@ extension RGBAComponents: SpringInterpolatable, VelocityProviding {
         RGBAComponents(r: 0, g: 0, b: 0, a: 0)
     }
 
-
 }
```

**File**: `Sources/Wave/Internal/ViewAnimator.swift` (modified, +3/-4)
```diff
@@ -255,7 +255,7 @@ extension ViewAnimator {
             let animation = (runningBackgroundColorAnimator ??
                              SpringAnimator<RGBAComponents>(
                                 spring: settings.spring,
-                                value:  initialValueComponents,
+                                value: initialValueComponents,
                                 target: targetValueComponents
                              )
             )
@@ -299,7 +299,6 @@ extension ViewAnimator {
         }
     }
 
-
     var _borderColor: UIColor {
         get {
             UIColor(cgColor: view.layer.animator.borderColor)
@@ -451,7 +450,7 @@ extension ViewAnimator {
             start(animation: animation, type: animationType, delay: settings.delay)
         }
     }
-    
+
 }
 
 extension ViewAnimator {
@@ -490,5 +489,5 @@ extension ViewAnimator {
     private var runningAlphaAnimator: SpringAnimator<CGFloat>? {
         view.animators[AnimatableProperty.alpha] as? SpringAnimator<CGFloat>
     }
-    
+
 }
```

**File**: `Sources/Wave/Public/CALayerAnimatableProperties.swift` (modified, +1/-1)
```diff
@@ -79,5 +79,5 @@ public class LayerAnimator {
     init(layer: CALayer) {
         self.layer = layer
     }
-    
+
 }
```

**File**: `Sources/Wave/Public/UIViewAnimatableProperties.swift` (modified, +1/-2)
```diff
@@ -122,12 +122,11 @@ public class ViewAnimator {
     }
 
     // MARK: - Internal
-    
+
     let view: UIView
 
     init(view: UIView) {
         self.view = view
     }
 
 }
-
```

---

### Incident Patch 10: `92a4e5e2` (2022-11-07)
**Commit Message**: Merge pull request #16 from jtrivedi/swiftui

This PR fixes #15 and allows Wave property animators to be used in SwiftUI.

Previously, Animation conflicted with SwiftUI.Animation, and couldn't be resolved via Wave.Animation.

It also adds a small SwiftUI + Wave demo (dragging, throwing, and animating a box).

**File**: `README.md` (modified, +3/-3)
```diff
@@ -6,7 +6,7 @@
 
 Wave is a spring-based animation engine for iOS and iPadOS. It makes it easy to create fluid, interactive, and interruptible animations that feel great.
 
-Wave has no external dependencies, and can be easily dropped into existing UIKit-based projects and apps.
+Wave has no external dependencies, and can be easily dropped into existing UIKit or SwiftUI based projects and apps.
 
 The core feature of Wave is that all animations are _re-targetable_, meaning that you can change an animation’s destination value in-flight, and the animation will gracefully _redirect_ to that new value.
 
@@ -105,10 +105,10 @@ While the block-based API is often most convenient, you may want to animate some
 For example, to draw the orange path of the PiP demo, we need to know the value of every `CGPoint` from the view’s initial center, to its destination center:
 
 ```swift
-// When the gesture ends, create a `CGPoint` animation from the PiP view's initial center, to its target.
+// When the gesture ends, create a `CGPoint` animator from the PiP view's initial center, to its target.
 // The `valueChanged` callback provides the intermediate locations of the callback, allowing us to draw the path.
 
-let positionAnimator = Animation<CGPoint>(spring: animatedSpring)
+let positionAnimator = Animator<CGPoint>(spring: animatedSpring)
 positionAnimator.value = pipView.center       // The presentation value
 positionAnimator.target = pipViewDestination  // The target value
 positionAnimator.velocity = gestureVelocity
```

**File**: `Sample App/Wave-Sample/Wave-Sample.xcodeproj/project.pbxproj` (modified, +14/-6)
```diff
@@ -10,6 +10,7 @@
 		F702B19928470D3100F8D848 /* CGRect+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = F702B19828470D3100F8D848 /* CGRect+Extensions.swift */; };
 		F706E35C2845F58C00ADD288 /* Wave in Frameworks */ = {isa = PBXBuildFile; productRef = F706E35B2845F58C00ADD288 /* Wave */; };
 		F72189FD27EE5485001A5CCF /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = F72189FC27EE5485001A5CCF /* Assets.xcassets */; };
+		F7238435291310B300BA6402 /* SwitUIViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = F7238434291310B300BA6402 /* SwitUIViewController.swift */; };
 		F731390827E68AB100DCC56C /* AppDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731390727E68AB100DCC56C /* AppDelegate.swift */; };
 		F731390A27E68AB100DCC56C /* SceneDelegate.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731390927E68AB100DCC56C /* SceneDelegate.swift */; };
 		F731392C27E68C1F00DCC56C /* PictureInPictureViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731392627E68C1F00DCC56C /* PictureInPictureViewController.swift */; };
@@ -18,11 +19,13 @@
 		F731393027E68C6900DCC56C /* InstantPanGestureRecognizer.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731392F27E68C6900DCC56C /* InstantPanGestureRecognizer.swift */; };
 		F731393427E68CAE00DCC56C /* PathView.swift in Sources */ = {isa = PBXBuildFile; fileRef = F731393327E68CAE00DCC56C /* PathView.swift */; };
 		F76AE81127E6905B00A332E8 /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = F76AE80F27E6905B00A332E8 /* LaunchScreen.storyboard */; };
+		F7F2B2BF2917543100E17E44 /* DragGesture+Extensions.swift in Sources */ = {isa = PBXBuildFile; fileRef = F7F2B2BE2917543100E17E44 /* DragGesture+Extensions.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXFileReference section */
 		F702B19828470D3100F8D848 /* CGRect+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "CGRect+Extensions.swift"; sourceTree = "<group>"; };
 		F72189FC27EE5485001A5CCF /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
+		F7238434291310B300BA6402 /* SwitUIViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SwitUIViewController.swift; sourceTree = "<group>"; };
 		F731390427E68AB100DCC56C /* Wave-Sample.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = "Wave-Sample.app"; sourceTree = BUILT_PRODUCTS_DIR; };
 		F731390727E68AB100DCC56C /* AppDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
 		F731390927E68AB100DCC56C /* SceneDelegate.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SceneDelegate.swift; sourceTree = "<group>"; };
@@ -34,6 +37,7 @@
 		F731392F27E68C6900DCC56C /* InstantPanGestureRecognizer.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = InstantPanGestureRecognizer.swift; sourceTree = "<group>"; };
 		F731393327E68CAE00DCC56C /* PathView.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = PathView.swift; sourceTree = "<group>"; };
 		F76AE81027E6905B00A332E8 /* Base */ = {isa = PBXFileReference; lastKnownFileType = file.storyboard; name = Base; path = Base.lproj/LaunchScreen.storyboard; sourceTree = "<group>"; };
+		F7F2B2BE2917543100E17E44 /* DragGesture+Extensions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "DragGesture+Extensions.swift"; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -101,6 +105,7 @@
 				F731392627E68C1F00DCC56C /* PictureInPictureViewController.swift */,
 				F731392827E68C1F00DCC56C /* GridViewController.swift */,
 				F731392727E68C1F00DCC56C /* SheetViewController.swift */,
+				F7238434291310B300BA6402 /* SwitUIViewController.swift */,
 			);
 			name = "View Controllers";
 			sourceTree = "<group>";
@@ -111,6 +116,7 @@
 				F731392F27E68C6900DCC56C /* InstantPanGestureRecognizer.swift */,
 				F731393327E68CAE00DCC56C /* PathView.swift */,
 				F702B19828470D3100F8D848 /* CGRect+Extensions.swift */,
+				F7F2B2BE2917543100E17E44 /* DragGesture+Extensions.swift */,
 			);
 			name = Utilities;
 			sourceTree = "<group>";
@@ -215,9 +221,11 @@
 				F731390A27E68AB100DCC56C /* SceneDelegate.swift in Sources */,
 				F731393027E68C6900DCC56C /* InstantPanGestureRecognizer.swift in Sources */,
 				F731393427E68CAE00DCC56C /* PathView.swift in Sources */,
+				F7238435291310B300BA6402 /* SwitUIViewController.swift in Sources */,
 				F731392D27E68C1F00DCC56C /* SheetViewController.swift in Sources */,
 				F702B19928470D3100F8D848 /* CGRect+Extensions.swift in Sources */,
 				F731392E27E68C1F00DCC56C /* GridView
```

**File**: `Sample App/Wave-Sample/Wave-Sample/DragGesture+Extensions.swift` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+//
+//  DragGesture+Extensions.swift
+//  Wave-Sample
+//
+//  Created by Janum Trivedi on 11/5/22.
+//
+
+import SwiftUI
+
+extension DragGesture.Value {
+
+    internal var velocity: CGSize {
+        let valueMirror = Mirror(reflecting: self)
+        for valueChild in valueMirror.children {
+            if valueChild.label == "velocity" {
+                let velocityMirror = Mirror(reflecting: valueChild.value)
+                for velocityChild in velocityMirror.children {
+                    if velocityChild.label == "valuePerSecond" {
+                        if let velocity = velocityChild.value as? CGSize {
+                            return velocity
+                        }
+                    }
+                }
+            }
+        }
+        fatalError("Unable to retrieve velocity from \(Self.self)")
+    }
+
+}
```

**File**: `Sample App/Wave-Sample/Wave-Sample/Info.plist` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
 <plist version="1.0">
 <dict>
+	<key>CADisableMinimumFrameDurationOnPhone</key>
+	<true/>
 	<key>UIApplicationSceneManifest</key>
 	<dict>
 		<key>UIApplicationSupportsMultipleScenes</key>
```

**File**: `Sample App/Wave-Sample/Wave-Sample/SceneDelegate.swift` (modified, +2/-1)
```diff
@@ -33,7 +33,8 @@ class SceneDelegate: UIResponder, UIWindowSceneDelegate {
         tabViewController.viewControllers = [
             PictureInPictureViewController(),
             GridViewController(),
-            SheetViewController()
+            SheetViewController(),
+            SwiftUIViewController()
         ]
 
         tabViewController.selectedIndex = 0
```

**File**: `Sample App/Wave-Sample/Wave-Sample/SwitUIViewController.swift` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+//
+//  SwitUIViewController.swift
+//  Wave-Sample
+//
+//  Created by Janum Trivedi on 11/2/22.
+//
+
+import SwiftUI
+
+import Wave
+
+struct SwiftUIView: View {
+
+    let offsetAnimator = SpringAnimator<CGPoint>(spring: Spring(dampingRatio: 0.72, response: 0.7))
+
+    @State var boxOffset: CGPoint = .zero
+
+    var body: some View {
+        let size = 80.0
+        ZStack {
+            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
+                .fill(.blue)
+                .frame(width: size, height: size)
+            VStack {
+                Text("SwiftUI")
+                    .foregroundColor(.white)
+            }
+
+        }.onAppear {
+            offsetAnimator.value = .zero
+
+            // The offset animator's callback will update the `offset` state variable.
+            offsetAnimator.valueChanged = { newValue in
+                boxOffset = newValue
+            }
+        }
+        .offset(x: boxOffset.x, y: boxOffset.y)
+        .gesture(
+            DragGesture()
+                .onChanged { value in
+                    // Update the animator's target to the new drag translation.
+                    offsetAnimator.target = CGPoint(x: value.translation.width, y: value.translation.height)
+
+                    // Don't animate the box's position when we're dragging it.
+                    offsetAnimator.mode = .nonAnimated
+                    offsetAnimator.start()
+                }
+                .onEnded { value in
+                    // Animate the box to its original location (i.e. with zero translation).
+                    offsetAnimator.target = .zero
+
+                    // We want the box to animate to its original location, so use an `animated` mode.
+                    // This is different than the
+                    offsetAnimator.mode = .animated
+
+                    // Take the velocity of the gesture, and give it to the animator.
+                    // This makes the throw animation feel natural and continuous.
+                    offsetAnimator.velocity = CGPoint(x: value.velocity.width, y: value.velocity.height)
+                    offsetAnimator.start()
+                }
+        )
+    }
+}
+
+struct SwiftUIView_Previews: PreviewProvider {
+    static var previews: some View {
+        SwiftUIView()
+    }
+}
+
+class SwiftUIViewController: UIViewController {
+
+    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
+        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
+
+        title = "SwiftUI"
+        tabBarItem.image = UIImage(systemName: "swift")
+    }
+
+    required init?(coder: NSCoder) {
+        fatalError("init(coder:) has not been implemented")
+    }
+
+    override func viewDidLoad() {
+        let hostingController = UIHostingController(rootView: SwiftUIView())
+        addChild(hostingController)
+        view.addSubview(hostingController.view)
+        hostingController.didMove(toParent: self)
+        hostingController.view.frame = view.bounds
+    }
+}
```

**File**: `Sample App/Wave-Sample/Wave-Sample/View Controllers/PictureInPictureViewController.swift` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ class PictureInPictureViewController: UIViewController {
 
     /// In order to draw the path that the PiP view takes when animating to its final destination,
     /// we need the intermediate spring values. Use a separate `CGPoint` animator to get these values.
-    lazy var positionAnimator = Animation<CGPoint>(spring: animatedSpring)
+    lazy var positionAnimator = SpringAnimator<CGPoint>(spring: animatedSpring)
 
     /// The view that draws the path of the PiP view.
     lazy var pathView = PathView(frame: view.bounds)
```

**File**: `Sample App/Wave-Sample/Wave-Sample/View Controllers/SheetViewController.swift` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ class SheetViewController: UIViewController {
     let interactiveSpring = Spring(dampingRatio: 0.8, response: 0.2)
     let animatedSpring = Spring(dampingRatio: 0.68, response: 0.8)
 
-    lazy var sheetPresentationAnimator = Animation<CGFloat>(spring: animatedSpring)
+    lazy var sheetPresentationAnimator = SpringAnimator<CGFloat>(spring: animatedSpring)
 
     var sheetPresentationProgress: CGFloat = 0 {
         didSet {
```

---

### Incident Patch 11: `031267f7` (2022-05-31)
**Commit Message**: Add link to Designing Fluid Interfaces

**File**: `README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Consider these demos of the iOS Picture-in-Picture feature. The screen on the le
 
 Though both are “interruptible”, the Wave-based implementation handles the interruption much better, and fluidly _arcs_ to its new destination. The UIKit animation feels stiff and jerky in comparison.
 
-At its core, retargeting is the process of preserving an animation’s velocity even as its target changes, which Wave does automatically.
+At its core, [retargeting](https://developer.apple.com/videos/play/wwdc2018/803/) is the process of preserving an animation’s velocity even as its target changes, which Wave does automatically.
 
 ![Demo](./Assets/Retargeting.gif)
 
```

#### Recent Merged Pull Requests:
- **PR #36** (closed): Extended animation support (@flocked)
- **PR #31** (closed): Fix display link frame rate range (@junjielu)
- **PR #27** (2024-06-03): Non-animated updates shouldn't wait until the next turn of the run loop #26 (@jtrivedi)
- **PR #25** (2022-11-14): Support for macOS and AppKit (@jtrivedi)
- **PR #23** (2022-11-12): Block-based animations can create a retain cycle #22 (@jtrivedi)
- **PR #21** (2022-11-12): Implicit animation support for `CALayer` (@jtrivedi)
- **PR #20** (2022-11-09): Improve backgroundColor animation retargeting #19 (@jtrivedi)
- **PR #18** (2022-11-08): Support high frame rate animations on ProMotion devices (@jtrivedi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
