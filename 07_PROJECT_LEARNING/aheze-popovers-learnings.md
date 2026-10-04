# Forensic Learning Record (Deep Inspection): aheze/Popovers

> **Canonical Artifact**: `07_PROJECT_LEARNING/aheze-popovers-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aheze/Popovers](https://github.com/aheze/Popovers))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:48:09.645Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aheze/Popovers`
- **Description**: A library to present popovers. Simple, modern, and highly customizable. Not boring!
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2212 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Examples/PopoversExample/Misc/Utilities.swift`
```
//
//  Utilities.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

struct ColorPickerView: View {
    @State var color = UIColor.systemBlue.cgColor
    var body: some View {
        ColorPicker("Pick a color", selection: $color)
    }
}

struct ExampleRow: View {
    let image: String
    let title: String
    let color: UInt
    var action: (() -> Void)? = nil

    var body: some View {
        Button(action: action ?? {}) {
            HStack {
                Image(systemName: image)
                    .font(.system(size: 19, weight: .medium))
                    .frame(width: 40, height: 40)
                    .background(
                        Templates.VisualEffectView(.dark)
                    )
                    .cornerRadius(10)
                    .overlay {
                        RoundedRectangle(cornerRadius: 10)
                            .strokeBorder(Color.white, lineWidth: 1.5)
                            .opacity(0.8)
                    }

                Text(title)
                    .fontWeight(.medium)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(
                Color(uiColor: .systemBackground)
                    .overlay(alignment: .bottomTrailing) {
                        LinearGradient(
                            colors: [
                                Color(uiColor: UIColor(hex: color).offset(by: 0.2)),
                                Color(uiColor: UIColor(hex: color)),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .aspectRatio(contentMode: .fill)
                    }
            )

            .cornerRadius(16)
            .foregroundColor(.primary)
        }
        .disabled(action == nil)
    }
}

struct ExampleImage: View {
    let imageName: String
    let color: UIColor

    init(_ imageName: String, color: UInt = 0x00AEEF) {
        self.imageName = imageName
        self.color = UIColor(hex: color)
    }

    init(_ imageName: String, color: UIColor) {
        self.imageName = imageName
        self.color = color
    }

    var body: some View {
        Image(systemName: imageName)
            .foregroundColor(.white)
            .font(.system(size: 19, weight: .medium))
            .frame(width: 36, height: 36)
            .background(
                LinearGradient(
                    colors: [
                        Color(uiColor: color),
                        Color(uiColor: color.offset(by: 0.06)),
                    ],
                    startPoint: .bottom,
                    endPoint: .top
                )
            )
            .cornerRadius(10)
    }

    static var tip: ExampleImage {
        ExampleImage("lightbulb", color: 0x00C300)
    }

    static var warning: ExampleImage {
        ExampleImage("exclamationmark.triangle.fill", color: 0xEBD43D)
    }
}

extension UIColor {
    var color: Color {
        return Color(uiColor: self)
    }

    static func == (l: UIColor, r: UIColor) -> Bool {
        var r1: CGFloat = 0
        var g1: CGFloat = 0
        var b1: CGFloat = 0
        var a1: CGFloat = 0
        l.getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        var r2: CGFloat = 0
        var g2: CGFloat = 0
        var b2: CGFloat = 0
        var a2: CGFloat = 0
        r.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return r1 == r2 && g1 == g2 && b1 == b2 && a1 == a2
    }
}

func == (l: UIColor?, r: UIColor?) -> Bool {
    let l = l ?? .clear
    let r = r ?? .clear
    return l == r
}

/// get a gradient color
extension UIColor {
    func offset(by offset: CGFloat) -> UIColor {
        let (h, s, b, a) = hsba
        var newHue = h - offset

        /// make it go back to positive
        while newHue <= 0 {
            newHue += 1
        }
        let normalizedHue = newHue.truncatingRemainder(dividingBy: 1)
        return UIColor(hue: normalizedHue, saturation: s, brightness: b, alpha: a)
    }

    var hsba: (h: CGFloat, s: CGFloat, b: CGFloat, a: CGFloat) {
        var h: CGFloat = 0, s: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        self.getHue(&h, saturation: &s, brightness: &b, alpha: &a)
        return (h: h, s: s, b: b, a: a)
    }
}

```

### Core Architecture Module: `Examples/PopoversExample/Playground/LifecycleView.swift`
```
//
//  LifecycleView.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

struct LifecycleView: View {
    @State var present = false

    var body: some View {
        ExampleRow(
            image: "arrow.triangle.2.circlepath",
            title: "Lifecycle Animations",
            color: 0xFF7200
        ) {
            present.toggle()
        }
        .popover(
            present: $present,
            attributes: {
                $0.presentation.animation = .spring(
                    response: 0.6,
                    dampingFraction: 0.6,
                    blendDuration: 1
                )
                $0.presentation.transition = .slide
                $0.dismissal.animation = .easeIn(duration: 1)
                $0.dismissal.transition = .move(edge: .bottom).combined(with: .opacity)
            }
        ) {
            VStack(alignment: .leading) {
                Text("You can change the presentation and dismissal animations.")

                HStack {
                    ExampleImage("hare.fill", color: 0xFF7200)
                    Text("It boings in.")
                }

                HStack {
                    ExampleImage("train.side.front.car", color: 0xFF7200)
                    Text("It slides out.")
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 1)
        }
    }
}

```

### Core Architecture Module: `Sources/Popover+Lifecycle.swift`
```
//
//  Popover+Lifecycle.swift
//  Popovers
//
//  Created by A. Zheng (github.com/aheze) on 1/4/22.
//  Copyright © 2022 A. Zheng. All rights reserved.
//
#if os(iOS)
import SwiftUI

/**
 Present a popover.
 */
public extension Popover {
    /**
     Present a popover in a window. It may be easier to use the `UIViewController.present(_:)` convenience method instead.
     */
    internal func present(in window: UIWindow) {
        /// Create a transaction for the presentation animation.
        let transaction = Transaction(animation: attributes.presentation.animation)

        /// Inject the transaction into the popover, so following frame calculations are animated smoothly.
        context.transaction = transaction

        /// Get the popover model that's tied to the window.
        let model = window.popoverModel

        /**
         Add the popover to the container view.
         */
        func displayPopover(in container: PopoverGestureContainer) {
            withTransaction(transaction) {
                model.add(self)

                /// Stop VoiceOver from reading out background views if `blocksBackgroundTouches` is true.
                if attributes.blocksBackgroundTouches {
                    container.accessibilityViewIsModal = true
                }

                /// Shift VoiceOver focus to the popover.
                if attributes.accessibility.shiftFocus {
                    UIAccessibility.post(notification: .screenChanged, argument: nil)
                }
            }
        }

        /// Find the existing container view for popovers in this window. If it does not exist, we need to insert one.
        let container: PopoverGestureContainer
        if let existingContainer = window.popoverContainerView {
            container = existingContainer

            /// The container is already laid out in the window, so we can go ahead and show the popover.
            displayPopover(in: container)
        } else {
            container = PopoverGestureContainer(frame: window.bounds)

            /**
             Wait until the container is present in the view hierarchy before showing the popover,
             otherwise all the layout math will be working with wonky frames.
             */
            container.onMovedToWindow = { [weak container] in
                if let container = container {
                    displayPopover(in: container)
                }
            }

            window.addSubview(container)
        }

        if attributes.source == .stayAboveWindows {
            context.windowSublayersKeyValueObservationToken = window.layer.observe(\.sublayers) { _, _ in
                window.bringSubviewToFront(container)
            }
        }

        /// Hang on to the container for future dismiss/replace actions.
        context.presentedPopoverContainer = container
    }

    /**
     Dismiss a popover.

     - parameter transaction: An optional transaction that can be applied for the dismissal animation.
     */
    func dismiss(transaction: Transaction? = nil) {
        guard let container = context.presentedPopoverContainer else { return }

        let model = container.popoverModel
        let dismissalTransaction = transaction ?? Transaction(animation: attributes.dismissal.animation)

        /// Clean up the container view controller if no more popovers are visible.
        context.onDisappear = { [weak context] in
            if model.popovers.isEmpty {
                context?.presentedPopoverContainer?.removeFromSuperview()
                context?.presentedPopoverContainer = nil
            }

            /// If at least one popover has `blocksBackgroundTouches` set to true, stop VoiceOver from reading out background views
            context?.presentedPopoverContainer?.accessibilityViewIsModal = model.popovers.contains { $0.attributes.blocksBackgroundTouches }
        }

        /// Remove this popover from the view model, dismissing it.
        withTransaction(dismissalTransaction) {
            model.remove(self)
        }

        /// Let the internal SwiftUI modifiers know that the popover was automatically dismissed.
        context.onAutoDismiss?()

        /// Let the client know that the popover was automatically dismissed.
        attributes.onDismiss?()
    }

    /**
     Replace this popover with another popover smoothly.
     */
    func replace(with newPopover: Popover) {
        guard let popoverContainerViewController = context.presentedPopoverContainer else { return }

        let model = popoverContainerViewController.popoverModel

        /// Get the index of the previous popover.
        if let oldPopoverIndex = model.index(of: self) {
            /// Get the old popover's context.
            let oldContext = model.popovers[oldPopoverIndex].context

            /// Create a new transaction for the replacing animation.
            let transaction = Transaction(animation: newPopover.attributes.presentation.animation)

            /// Inject the transaction into the new popover, so following frame calculations are animated smoothly.
            newPopover.context.transaction = transaction

            /// Use the same `UIViewController` presenting the previous popover, so we animate the popover in the same container.
            newPopover.context.presentedPopoverContainer = oldContext.presentedPopoverContainer

            /// Set the popover as a replacement.
            newPopover.context.isReplacement = true

            /// Use same ID so that SwiftUI animates the change.
            newPopover.context.id = oldContext.id

            withTransaction(transaction) {
                /// Temporarily use the same size for a smooth animation.
                newPopover.updateFrame(with: oldContext.size)

                /// Replace the old popover with the new popover.
                model.popovers[oldPopoverIndex] = newPopover
            }
        }
    }
}

public extension UIResponder {
    /// Replace a popover with another popover. Convenience method for `Popover.replace(with:)`.
    func replace(_ oldPopover: Popover, with newPopover: Popover) {
        oldPopover.replace(with: newPopover)
    }

    /// Dismiss a popover. Convenience method for `Popover.dismiss(transaction:)`.
    func dismiss(_ popover: Popover) {
        popover.dismiss()
    }

    /**
     Get a currently-presented popover with a tag. Returns `nil` if no popover with the tag was found.
     - parameter tag: The tag of the popover to look for.
     */
    func popover(tagged tag: AnyHashable) -> Popover? {
        return popoverModel.popover(tagged: tag)
    }

    /**
     Remove all popovers, or optionally the ones tagged with a `tag` that you supply.
     - parameter tag: If this isn't nil, only remove popovers tagged with this.
     */
    func dismissAllPopovers(with tag: AnyHashable? = nil) {
        popoverModel.removeAllPopovers(with: tag)
    }
}

public extension UIViewController {
    /// Present a `Popover` using this `UIViewController` as its presentation context.
    func present(_ popover: Popover) {
        guard let window = view.window else { return }
        popover.present(in: window)
    }
}

extension UIView {
    var popoverContainerView: PopoverGestureContainer? {
        if let container = self as? PopoverGestureContainer {
            return container
        } else {
            for subview in subviews {
                if let container = subview.popoverContainerView {
                    return container
                }
            }

            return nil
        }
    }
}
#endif

```

### Core Architecture Module: `Sources/PopoverUtilities.swift`
```
//
//  PopoverUtilities.swift
//  Popovers
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

#if os(iOS)
import Combine
import SwiftUI

public extension UIView {
    /// Convert a view's frame to global coordinates, which are needed for `sourceFrame` and `excludedFrames.`
    func windowFrame() -> CGRect {
        return convert(bounds, to: nil)
    }
}

public extension Optional where Wrapped: UIView {
    /// Convert a view's frame to global coordinates, which are needed for `sourceFrame` and `excludedFrames.` This is a convenience overload for optional `UIView`s.
    func windowFrame() -> CGRect {
        if let view = self {
            return view.windowFrame()
        }
        return .zero
    }
}

public extension View {
    /// Read a view's frame. From https://stackoverflow.com/a/66822461/14351818
    func frameReader(in coordinateSpace: CoordinateSpace = .global, rect: @escaping (CGRect) -> Void) -> some View {
        return background(
            GeometryReader { geometry in
                let frame = geometry.frame(in: coordinateSpace)

                Color.clear
                    .onValueChange(of: frame) { _, newValue in
                        rect(newValue)
                    }
                    .onAppear {
                        rect(frame)
                    }
            }
            .hidden()
        )
    }

    /**
     Read a view's size. The closure is called whenever the size itself changes, or the transaction changes (in the event of a screen rotation.)

     From https://stackoverflow.com/a/66822461/14351818
     */
    func sizeReader(transaction: Transaction? = nil, size: @escaping (CGSize) -> Void) -> some View {
        return background(
            GeometryReader { geometry in
                Color.clear
                    .preference(key: ContentSizeReaderPreferenceKey.self, value: geometry.size)
                    .onPreferenceChange(ContentSizeReaderPreferenceKey.self) { newValue in
                        DispatchQueue.main.async {
                            size(newValue)
                        }
                    }
                    .onValueChange(of: transaction?.animation) { _, _ in
                        DispatchQueue.main.async {
                            size(geometry.size)
                        }
                    }
            }
            .hidden()
        )
    }
}

struct ContentFrameReaderPreferenceKey: PreferenceKey {
    static var defaultValue: CGRect { return CGRect() }
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) { value = nextValue() }
}

struct ContentSizeReaderPreferenceKey: PreferenceKey {
    static var defaultValue: CGSize { return CGSize() }
    static func reduce(value: inout CGSize, nextValue: () -> CGSize) { value = nextValue() }
}

public extension UIColor {
    /**
     Create a UIColor from a hex code.

     Example:

         let color = UIColor(hex: 0x00aeef)
     */
    convenience init(hex: UInt, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((hex & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((hex & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(hex & 0x0000FF) / 255.0,
            alpha: alpha
        )
    }
}

/// Position a view using a rectangular frame. Access using `.frame(rect:)`.
struct FrameRectModifier: ViewModifier {
    let rect: CGRect
    func body(content: Content) -> some View {
        content
            .frame(width: rect.width, height: rect.height, alignment: .topLeading)
            .position(x: rect.origin.x + rect.width / 2, y: rect.origin.y + rect.height / 2)
    }
}

public extension View {
    /// Position a view using a rectangular frame.
    func frame(rect: CGRect) -> some View {
        return modifier(FrameRectModifier(rect: rect))
    }
}

/// For easier CGPoint math
public extension CGPoint {
    /// Add 2 CGPoints.
    static func + (left: CGPoint, right: CGPoint) -> CGPoint {
        return CGPoint(x: left.x + right.x, y: left.y + right.y)
    }

    /// Subtract 2 CGPoints.
    static func - (left: CGPoint, right: CGPoint) -> CGPoint {
        return CGPoint(x: left.x - right.x, y: left.y - right.y)
    }
}

/// Get the distance between 2 CGPoints. From https://www.hackingwithswift.com/example-code/core-graphics/how-to-calculate-the-distance-between-two-cgpoints
public func CGPointDistanceSquared(from: CGPoint, to: CGPoint) -> CGFloat {
    return (from.x - to.x) * (from.x - to.x) + (from.y - to.y) * (from.y - to.y)
}

public extension Shape {
    /// Fill and stroke a shape at the same time. https://www.hackingwithswift.com/quick-start/swiftui/how-to-fill-and-stroke-shapes-at-the-same-time
    func fill<Fill: ShapeStyle, Stroke: ShapeStyle>(_ fillStyle: Fill, strokeBorder strokeStyle: Stroke, lineWidth: CGFloat = 1) -> some View {
        stroke(strokeStyle, lineWidth: lineWidth)
            .background(fill(fillStyle))
    }
}

public extension InsettableShape {
    /// Fill and stroke a shape at the same time. https://www.hackingwithswift.com/quick-start/swiftui/how-to-fill-and-stroke-shapes-at-the-same-time
    func fill<Fill: ShapeStyle, Stroke: ShapeStyle>(_ fillStyle: Fill, strokeBorder strokeStyle: Stroke, lineWidth: CGFloat = 1) -> some View {
        strokeBorder(strokeStyle, lineWidth: lineWidth)
            .background(fill(fillStyle))
    }
}

public extension UIEdgeInsets {
    /// The left + right insets.
    var horizontal: CGFloat {
        get {
            left + right
        } set {
            left = newValue
            right = newValue
        }
    }

    /// The top + bottom insets.
    var vertical: CGFloat {
        get {
            top + bottom
        } set {
            top = newValue
            bottom = newValue
        }
    }

    /// Create equal insets on all 4 sides.
    init(_ inset: CGFloat) {
        self = UIEdgeInsets(top: inset, left: inset, bottom: inset, right: inset)
    }
}

/// Detect changes in bindings (fallback of `.onChange` for iOS 13+). From https://stackoverflow.com/a/64402663/14351818
struct ChangeObserver<Content: View, Value: Equatable>: View {
    let content: Content
    let value: Value
    let action: (Value, Value) -> Void

    init(value: Value, action: @escaping (Value, Value) -> Void, content: @escaping () -> Content) {
        self.value = value
        self.action = action
        self.content = content()
        _oldValue = State(initialValue: value)
    }

    @State private var oldValue: Value

    var body: some View {
        DispatchQueue.main.async {
            if oldValue != value {
                action(oldValue, value)
                oldValue = value
            }
        }
        return content
    }
}

public extension View {
    /// Detect changes in bindings (fallback of `.onChange` for iOS 13+).
    func onValueChange<Value: Equatable>(
        of value: Value,
        perform action: @escaping (_ oldValue: Value, _ newValue: Value) -> Void
    ) -> some View {
        ChangeObserver(value: value, action: action) {
            self
        }
    }
}

#endif

```

### Core Architecture Module: `Examples/PopoversExample/App.swift`
```
//
//  App.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

@main
struct PopoversPlaygroundApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}


```

### Core Architecture Module: `Examples/PopoversExample/ContentView.swift`
```
//
//  ContentView.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

/**
 Welcome to the Popovers example app!
 Here's some tips.
    - Actually run the app (tap the play button in the top-left). The App Preview sometimes doesn't work with Popovers.
    - The app already has Popovers installed. If you want to use Popovers in your own app, add the Swift Package: https://github.com/aheze/Popovers
    - If you need help, join the Discord server: https://getfind.app/discord
    - Thanks for checking out Popovers! - aheze
 */
struct ContentView: View {
    var body: some View {
        NavigationView {
            ScrollView {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 300))],
                    spacing: 16
                ) {
                    Playground()
                    Showroom()
                    UIKit()
                    Testing()

                    Color.clear.frame(height: 40)
                }
                .padding()
            }
            .background(Color(uiColor: .secondarySystemBackground))
            .navigationTitle("Popovers")
            .modifier(NavigationToolbar())
        }
        .navigationViewStyle(.stack)
    }
}

```

### Core Architecture Module: `Examples/PopoversExample/Misc/NavigationToolbar.swift`
```
//
//  NavigationToolbar.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI
import WebKit

struct NavigationToolbar: ViewModifier {
    @State var presentInfo = false
    @State var presentDocumentation = false

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    Button {
                        presentInfo = true
                    } label: {
                        Image(systemName: "info.circle")
                    }
                    .popover(
                        present: $presentInfo,
                        attributes: {
                            $0.position = .absolute(
                                originAnchor: .bottomRight,
                                popoverAnchor: .topRight
                            )
                            $0.sourceFrameInset.bottom = -12
                            $0.dismissal.mode = [.dragDown, .tapOutside]
                        }
                    ) {
                        Templates.Container(cornerRadius: 20) {
                            InfoView()
                        }
                        .frame(maxWidth: 400)
                    }

                    Button {
                        presentDocumentation = true
                    } label: {
                        Image(systemName: "book.closed")
                    }
                    .popover(
                        present: $presentDocumentation,
                        attributes: {
                            $0.position = .relative(
                                popoverAnchors: [
                                    .center,
                                ]
                            )
                            $0.dismissal.mode = [.tapOutside]
                            $0.presentation.transition = .move(edge: .bottom)
                            $0.dismissal.transition = .move(edge: .bottom).combined(with: .opacity)
                            $0.rubberBandingMode = .none
                        }
                    ) {
                        DocumentationView(present: $presentDocumentation)
                            .frame(maxWidth: 600, maxHeight: 700)
                    }
                }
            }
    }
}

struct InfoView: View {
    let uiColor = UIColor(hex: 0x007EEF)
    let color = Color(uiColor: UIColor(hex: 0x007EEF))

    var body: some View {
        VStack(spacing: 12) {
            Text("Welcome to Popovers!")
                .font(.title2.bold())
                .padding(.top, 8)

            Text("Popovers is a library that presents popovers. Check it out in this demo playground!")
                .multilineTextAlignment(.center)

            InfoRowContainer(color: UIColor(hex: 0x007EEF)) {
                InfoRow(
                    title: "Incredibly Easy",
                    description: "Just add `.popover` and you're done.",
                    image: "checkmark"
                )
                InfoRow(
                    title: "Fast and Powerful",
                    description: "You can present any SwiftUI view and the package is under 200kb.",
                    image: "bolt.fill"
                )
                InfoRow(
                    title: "Customize Everything",
                    description: "Popovers was designed with advanced usage in mind.",
                    image: "slider.horizontal.3"
                )

                InfoRow(
                    title: "Need Help?",
                    description: "Open an issue on [GitHub](https://github.com/aheze/Popovers/issues) or join the [Discord server](https://discord.com/invite/Pmq8fYcus2).",
                    image: "questionmark"
                )
            }
        }
    }
}

struct InfoRowContainer<Content: View>: View {
    var color: UIColor = .systemBlue
    @ViewBuilder var view: Content

    var body: some View {
        VStack(spacing: 16) {
            view
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(.regularMaterial)
                .cornerRadius(10)
                .shadow(
                    color: Color(uiColor: .label.withAlphaComponent(0.25)),
                    radius: 10,
                    x: 0,
                    y: 3
                )
        }
        .padding()
        .background(
            Color(uiColor: .systemBackground)
                .overlay(alignment: .bottomTrailing) {
                    LinearGradient(
                        colors: [
                            Color(uiColor: color.offset(by: 0.2)),
                            Color(uiColor: color),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .aspectRatio(contentMode: .fill)
                }
        )
        .cornerRadius(16)
        .foregroundColor(.primary)
    }
}

struct InfoRow: View {
    var title: String
    var description: String
    var image: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .bold()

            Text(.init(description))
        }
        .padding(.trailing, 36)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .topTrailing) {
            InfoImage(image: image, color: UIColor(hex: 0x007EEF))
        }
    }
}

struct InfoImage: View {
    var image: String
    var color: UIColor

    var body: some View {
        Image(systemName: image)
            .foregroundColor(.white)
            .font(.system(size: 17, weight: .medium))
            .padding(8)
            .background {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(uiColor: color.offset(by: 0.2)),
                                Color(uiColor: color),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
    }
}

struct InfoView_Previews: PreviewProvider {
    static var previews: some View {
        InfoView()
    }
}

struct DocumentationView: View {
    @Binding var present: Bool
    @State var ready = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Documentation")
                    .fontWeight(.medium)

                Link(destination: URL(string: "https://github.com/aheze/popovers")!) {
                    Image(systemName: "arrow.up.right.square")
                }

                Spacer()

                Button {
                    present = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 17))
                        .foregroundColor(.secondary)
                        .frame(width: 32, height: 32)
                        .background(Color(uiColor: .systemBackground))
                        .cornerRadius(16)
                }
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(.regularMaterial)

            Divider()

            WebView(ready: $ready, url: URL(string: "https://github.com/aheze/Popovers")!)
        }
        .opacity(ready ? 1 : 0)
        .background(Color(uiColor: .systemBackground))
        .cornerRadius(16)
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(uiColor: .secondaryLabel))
                .overlay {
                    ProgressView()
                        .opacity(ready ? 0 : 1)
                }
        }
    }
}

/// from https://developer.apple.com/forums/thread/126986?answerId=398582022#398582022
struct WebView: UIViewRepresentable {
    @Binding var ready: Bool
    var url: URL

    func makeCoordinator() -> WebView.Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.navigationDelegate = context.coordinator
        view.load(URLRequest(url: url))
        return view
    }

    func updateUIView(_: WKWebView, context _: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate {
        let parent: WebView

        init(_ parent: WebView) {
            self.parent = parent
        }

        func webView(_: WKWebView, didFinish _: WKNavigation!) {
            withAnimation {
                parent.ready = true
            }
        }
    }
}

struct DocumentationView_Previews: PreviewProvider {
    static var previews: some View {
        DocumentationView(present: .constant(true))
    }
}

```

### Core Architecture Module: `Examples/PopoversExample/Playground/AbsolutePositioningView.swift`
```
//
//  AbsolutePositioningView.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

struct AbsolutePositioningView: View {
    @State var present = false

    var body: some View {
        ExampleRow(
            image: "squareshape.controlhandles.on.squareshape.controlhandles",
            title: "Absolute Positioning",
            color: 0x7E52F5
        ) {
            present.toggle()
        }
        .popover(
            present: $present,
            attributes: {
                $0.sourceFrameInset.top = -8
                $0.position = .absolute(
                    originAnchor: .bottomRight,
                    popoverAnchor: .topRight
                )
            }
        ) {
            VStack(alignment: .leading) {
                Text("Absolute positioning means that the popover is attached to a source view. This is the default.")

                HStack {
                    ExampleImage("arrow.down.right", color: 0x7E52F5)
                    Text("The bottom-right of the source view is used as the origin.")
                }

                HStack {
                    ExampleImage("arrow.up.right", color: 0x7E52F5)
                    Text("The top-right of the popover attaches to the origin.")
                }

                HStack {
                    ExampleImage.warning
                    Text("Positioning may be modified to prevent overflowing off the screen.")
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 1)
        }
    }
}

```

### Core Architecture Module: `Examples/PopoversExample/Playground/AccessibilityView.swift`
```
//
//  AccessibilityView.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 1/16/22.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

struct AccessibilityView: View {
    @State var present = false

    var body: some View {
        ExampleRow(
            image: "hand.point.up.braille",
            title: "Accessibility",
            color: 0x0021FF
        ) {
            present.toggle()
        }
        .popover(
            present: $present,
            attributes: {
                $0.accessibility.shiftFocus = false
                $0.accessibility.dismissButtonLabel = AnyView(
                    Text("Tap me to dismiss!")
                        .foregroundColor(.white)
                        .padding()
                        .background(Color.black.opacity(0.5))
                        .cornerRadius(16)
                )
            }
        ) {
            VStack {
                VStack(alignment: .leading) {
                    Text("Popovers has full VoiceOver support!")

                    HStack {
                        ExampleImage("speaker.wave.2", color: 0x0021FF)

                        Text("By default, VoiceOver will read out the popover when it's presented. You can change this with `attributes.accessibility.shiftFocus`.")
                    }

                    HStack {
                        ExampleImage("hand.thumbsup", color: 0x0021FF)

                        Text("By default, a \(Image(systemName: "xmark.circle.fill")) button will appear next to popovers when VoiceOver is on. You can customize this with `attributes.accessibility.dismissButtonLabel`.")
                    }

                    HStack {
                        ExampleImage.tip

                        Text("If you already have a button that sets `present` to `false`, remove the default dismiss button with `dismissButtonLabel = nil`.")
                    }
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 1)
            .frame(maxWidth: 500)
        }
    }
}

```

### Core Architecture Module: `Examples/PopoversExample/Playground/BackgroundView.swift`
```
//
//  BackgroundView.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

struct BackgroundView: View {
    @State var present = false

    var body: some View {
        ExampleRow(
            image: "checkerboard.rectangle",
            title: "Background",
            color: 0x5DCB72
        ) {
            present = true
        }
        .popover(present: $present) {
            VStack(alignment: .leading) {
                Text("You can put anything you want in the background.")

                HStack {
                    ExampleImage("circle", color: 0x5DCB72)
                    Text("This popover has a `Color.green` background.")
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 1)
        } background: {
            Color.green.opacity(0.4)
        }
    }
}

```

### Core Architecture Module: `Examples/PopoversExample/Playground/BasicView.swift`
```
//
//  BasicView.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

struct BasicView: View {
    @State var present = false

    var body: some View {
        ExampleRow(
            image: "square",
            title: "Basic",
            color: 0x00AEEF
        ) {
            present.toggle()
        }
        .popover(present: $present) {
            Text("Hello! I'm a popover. You can dismiss me by tapping outside. Also, try dragging me to get a nice bounce.")
                .padding()
                .background(Color(.systemBackground))
                .cornerRadius(12)
                .shadow(radius: 1)
                .frame(maxWidth: 300)
        }
    }
}

```

### Core Architecture Module: `Examples/PopoversExample/Playground/CustomizedView.swift`
```
//
//  CustomizedView.swift
//  PopoversExample
//
//  Created by A. Zheng (github.com/aheze) on 12/23/21.
//  Copyright © 2022 A. Zheng. All rights reserved.
//

import Popovers
import SwiftUI

struct CustomizedView: View {
    @State var present = false

    var body: some View {
        ExampleRow(
            image: "slider.horizontal.3",
            title: "Customized",
            color: 0x285FF5
        ) {
            present.toggle()
        }
        .popover(
            present: $present,
            attributes: {
                $0.rubberBandingMode = .yAxis
            }
        ) {
            VStack(alignment: .leading) {
                Text("You can customize popovers by providing attributes.")

                HStack {
                    ExampleImage("hand.draw", color: 0x285FF5)
                    Text("For this popover, rubber banding is only enabled on the y-axis.")
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(radius: 1)
            .frame(maxWidth: 300)
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #41** (2022-06-21): **Custom fonts in menu items**
  *Symptoms*: I'm using https://github.com/kharrison/ScaledFont to handle custom fonts in my app, and it works really well. I have custom view modifier that applies the required text style, for example:  ```swift Text("Test Text").textStyle(BodyStyle()) ```  This applies the text style that I've defined, which in this case is a custom font. It works in all items I tried, with the exception of this library, and I can't figure it out :( I'm assuming it's something to do with the Environment, I've tried adding the `.environment(\.scaledFont, standardScaledFont)` to the View, but no luck.  My menu is configured like this:  ```swift Templates.Menu {     ForEach(menuItems) { menuItem in          if menuItems.firstIndex(where: { $0.id == menuItem.id }) != 0 {             MyDivider()                 .padding(.leading, defaultInnerPadding)         }          Templates.MenuItem {             menuItem.clickCode()         } label: { fade in             HStack {                 Text(menuItem.text.localized())                     .textStyle(CalloutStyle())                 Spacer()                 Image(systemName: menuItem.systemName)                     .font(.callout)             }             .padding(defaultInnerPadding)             .opacity(fade ? 0.5 : 1)         }     } } label: { fade in     buttonContent         .opacity(fade ? 0.5 : 1) } .frame(width: 55, height: 55) ```  My Menu Item Struct is:  ```swift struct AppMenuItem: Identifiable {     var te
  **Post-Mortem & Fix Analysis**:
  > Hey! Thanks for raising the issue. First off, Popovers doesn't support `ForEach` in menus yet - they will show up fine, but only the first one will be clickable. This is still something that I'm trying to fix - see #23.  About ScaledFont not working, have you tried attaching `.environment(\.scaledFont, standardScaledFont)` to the ForEach? I've never used that library before so I'm not exactly sure how Popovers affects it... in the meantime, maybe try this extension?  ```swift extension Font {          /// A dynamic font.     static func preferredCustomFont(for name: String, style: UIFont.TextStyle, weight: UIFont.Weight) -> Font {         let defaultDescriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: style)         let size = defaultDescriptor.pointSize         let fontDescriptor = UIFontDescriptor(fontAttributes: [             UIFontDescriptor.AttributeName.size: size,             UIFontDescriptor.AttributeName.family: name         ])          /// Add 
  > I tried the `.environment(\.scaledFont, standardScaledFont)` option... but in the wrong place!  I added it at the bottom of my View content, works. Thanks for you help

- **Issue #37** (2023-04-26): **Opening downloaded Xcode example project causes Xcode to hang**
  *Symptoms*: I've downloaded the example project in the readme (https://github.com/aheze/Popovers/raw/main/Examples/PopoversXcodeApp.zip) and opened it from where it was downloaded (~/Downloads), and it caused Xcode to hang for a long time.   It opened eventually, and I noticed that it loaded all my folders and files in ~/, which explains why it took so long. If I clone this repo and open the example project, it opens fine without any issue.  I think there might be some hard-coded relative paths in the example Xcode project?   <img width="268" alt="image" src="https://user-images.githubusercontent.com/4217719/170899778-97af6de6-a992-401d-a838-ca4d54b439b6.png"> 
  **Post-Mortem & Fix Analysis**:
  > Weird, I'll take a look. Thanks for letting me know!
  > I get the same issue.  When I first launched the project, it caused XCode to ask for permission to access my calendar and reminders. I denied that permission. Is this related?
  > Wow, that's seriously weird. Investigating...  ![Screen Shot 2022-08-09 at 9 42 28 PM](https://user-images.githubusercontent.com/49819455/183817519-0ef6adc8-7714-4687-94f8-c9ce72ae6486.png) | ![Screen Shot 2022-08-09 at 9 42 31 PM](https://user-images.githubusercontent.com/49819455/183817524-1341e128-326c-4ae3-8fee-902e769cf9d5.png) | ![Screen Shot 2022-08-09 at 9 42 33 PM](https://user-images.githubusercontent.com/49819455/183817531-f2cc144b-ae88-483d-b528-76e3263820dd.png) | ![Screen Shot 2022-08-09 at 9 42 35 PM](https://user-images.githubusercontent.com/49819455/183817538-3f030a36-088e-4b88-a3fd-b2e76d2c41d5.png) --- | --- | --- | --- 

- **Issue #33** (2022-04-29): **Disappearance transitions fail in apps with Popovers installed**
  *Symptoms*: Extremely weird issue. This is my app without Popovers installed:  https://user-images.githubusercontent.com/49819455/165876192-3b5dfac4-698d-4a5f-a635-9a11e0019d88.mov  This is my app *with* Popovers installed:  https://user-images.githubusercontent.com/49819455/165876194-0956d8f4-0452-4a69-b8ff-cc1074a108d8.mov  The dismissal animation does not work!  I didn't even `import Popovers` — all I did was add the package to my app. What could be the problem?
  **Post-Mortem & Fix Analysis**:
  > Wow. It was this:  https://github.com/aheze/Popovers/blob/main/Sources/PopoverUtilities.swift#L71-L75  ```swift extension Transaction: Equatable {     public static func == (lhs: Transaction, rhs: Transaction) -> Bool {         lhs.animation == rhs.animation     } } ```  It looks so innocent, but it's the problem. Wow...  I'll push a fix.  
  > Fixed in https://github.com/aheze/Popovers/releases/tag/1.3.2.

- **Issue #27** (2022-04-29): **Dismissal animation sometimes doesn’t work - the popover disappears instantly **
  *Symptoms*: I’ve noticed this happening maybe 1 in 30 times. I can’t get it to reproduce yet, but will attach code as soon as I figure out what’s the cause.  I think it has something to do with SwiftUI transitions in ZStack, but am not sure.
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/aheze/Popovers/releases/tag/1.3.2.

- **Issue #25** (2022-04-29): **regular sheet animation disappeared when I add the Popover package via Swift Package Manager**
  *Symptoms*: regular sheets (i.e. .sheet(isPresented: <Binding<Bool>>, onDismiss: <(() -> Void)?(() -> Void)?() -> Void>, content: <() -> View>) ) I use across the app appearance stopped animating. Animation is restored when popover package is removed.
  **Post-Mortem & Fix Analysis**:
  > @tm00-git what version of Popovers are you using? Popovers v1.2 had some known issues with system animations interference - Popovers v1.3 should fix them.
  > @aheze thank you for prompt reply. I indeed installed latest package 1.3.0 and tested multiple times. It appears regular sheet loses animation if it is attached to NavigationView. Attaching two gifs to demonstrate behaviour. Without Popovers - sheet animation is working ![Without Popovers](https://user-images.githubusercontent.com/81569028/155501408-cb19622e-81c3-4c51-aa95-013b2cbe9cd8.gif)  With Popovers - sheet animation is lost: ![With Popovers 1 3 0](https://user-images.githubusercontent.com/81569028/155501425-73bccab9-794c-42db-a71b-2f369c99188b.gif)  
  > Weird. For now try attaching the `.popover` modifier somewhere other than the sheet — if you use a `.relative` position, where it's attached doesn't matter.

- **Issue #21** (2022-02-06): **Popovers attached to system views like `NavigationView` interfere with animations**
  *Symptoms*: Code:  ```swift NavigationView {      } .popover(...) ```  Result:  https://user-images.githubusercontent.com/49819455/152633230-f23178c6-6faa-4e16-bb6e-cccfffcd8977.mov    
  **Post-Mortem & Fix Analysis**:
  > The problem was in `WindowReader`. Before, there was a `VStack` that shoved a `WindowHandlerRepresentable` next to the view. Now it's just a single view which fixes all the animation problems.  ```swift public var body: some View {     view(window)         .environment(\.window, window)         .background(             WindowHandlerRepresentable(binding: $window)         ) } ```  Result:  https://user-images.githubusercontent.com/49819455/152633232-e2b123c2-dfc4-4a2a-a527-99b035a9030e.mov
  > Fixed in d6aab56bdac2572b1e440e4c0781b4333945fc79. I'll release it along with some other improvements in v1.3.0, hopefully tomorrow.
  > Released in [1.3.0](https://github.com/aheze/Popovers/releases/tag/1.3.0).

- **Issue #20** (2022-02-04): **Possible memory leak**
  *Symptoms*: I presented a bunch of popovers by rapidly clicking each button. Here's the memory report:  ![Screen Shot 2022-01-29 at 6 08 54 PM](https://user-images.githubusercontent.com/49819455/151683996-b9693b4d-30ad-466b-8917-236d53233ecd.png)  The memory usage just keeps going up! It seems like a new `PopoverContainerView` is created every time you present a popover.  To test, I added this code inside `PopoverContainerView`: ```swift if #available(iOS 15.0, *) {     let _ = Self._printChanges() } ```  ![Screen Shot 2022-01-29 at 6 09 11 PM](https://user-images.githubusercontent.com/49819455/151683992-683fe0ea-913f-43d9-a907-f96e89583884.png)  The result was `PopoverContainerView: _popoverModel changed.` being printed hundred of times.
  **Post-Mortem & Fix Analysis**:
  > Yeah this doesn't seem right  ![Screen Shot 2022-01-29 at 6 27 04 PM](https://user-images.githubusercontent.com/49819455/151684381-686ce826-1b2b-4272-98e2-4d5e41109937.png) 
  > So I have malware installed on my simulator then? Interesting  ![Screen Shot 2022-01-29 at 6 33 28 PM](https://user-images.githubusercontent.com/49819455/151684509-6d94f779-15b0-4b86-98e7-36150fcfe19a.png)  Jkjk I've almost never used the memory graph before 
  > This makes the Container view deinit. But `Context` still never gets deinited... ![Screen Shot 2022-01-29 at 6 44 30 PM](https://user-images.githubusercontent.com/49819455/151684701-a956b192-7007-4beb-b17d-1ef4add10465.png) 

- **Issue #13** (2022-01-18): **Popover captures focus on presentation**
  *Symptoms*: Presenting a popover causes it to capture focus, which for a lot of situations is desirable (e.g. when it contains other controls). However there are some use cases where a popover can provide supplementary information and should not take focus away. As an example for an app looking to use this library, validation of user input with constraints should explain why the input is rejected - a good use for a popover - but once the popover appears the user must manually tap on the control again to change their input.  https://user-images.githubusercontent.com/12624320/148385426-ed13c16f-7596-45f1-88c4-373c89138ed8.mov  Ideally the attributes for the popover should allow designating whether the popover should obtain focus when presented, or leave focus with the currently focused view (with the default being the former for compatibilities sake). This may require moving away from hosting the popover container view in a view controller, as its presentation will always mess up the currently focused view with it being a "modal" presentation.  I've [pushed a commit to my fork](https://github.com/ShezHsky/Popovers/commit/9bb637f3a281e22d0acce9f325aff21d93783d9f) for reproduction convenience
  **Post-Mortem & Fix Analysis**:
  > Yeah this is a problem. I think the old window based approach had the same thing though. Maybe there is a property on view controller that stops it from stealing focus. Or as you said, maybe just adding the view controller’s view as a Subviews might work
  > > Maybe there is a property on view controller that stops it from stealing focus.  Aye I was hoping a cheeky change to `canBecomeFirstResponder` on the container view controller or its subviews would do the trick, but it seems as through the text field is forced to relinquish focus during presentation anyway. Makes some sense as the presentation is still modal, even though aesthetically this isn't the case with the visual passthrough.  Saying that, there will be some situations this behaviour remains desirable. Especially when using Voiceover or switch controls, where the popover is now the primary interaction point I'd expect it to continue to focus the contents of the popover as it does now. Supplementary information like in my validation example don't need focus, so being able to specify this client-side would be perfect.
  > I've added some changes inside https://github.com/aheze/Popovers/tree/feature/directly-add-as-subview. The problem is, the popover isn't always on top. If a sheet is presented, it gets covered.  https://user-images.githubusercontent.com/49819455/148702533-1a5d7668-cc0f-492a-9415-e5d3b8423b30.mov   

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

### Incident Patch 1: `bb2e98d0` (2023-04-26)
**Commit Message**: Merge pull request #83 from stbdang/XcodeExampleFix

Fixed example project #37

**File**: `Examples/PopoversExample.xcodeproj/project.pbxproj` (modified, +0/-2)
```diff
@@ -50,7 +50,6 @@
 
 /* Begin PBXFileReference section */
 		3C5DB8B7294530EF00017ADE /* Popovers */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = Popovers; path = ..; sourceTree = "<group>"; };
-		3C6C745127822EE600E039F0 /* Popovers */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = Popovers; path = ../..; sourceTree = "<group>"; };
 		3C73924D27AF8496006A56E7 /* UIKitMenuView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = UIKitMenuView.swift; sourceTree = "<group>"; };
 		3C8521B527ACADB30020ECB8 /* InsideNavigationView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = InsideNavigationView.swift; sourceTree = "<group>"; };
 		3CA34FAB279533E300AC36DF /* AccessibilityView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AccessibilityView.swift; sourceTree = "<group>"; };
@@ -128,7 +127,6 @@
 		3CBD874327755E19005BBA48 = {
 			isa = PBXGroup;
 			children = (
-				3C6C745127822EE600E039F0 /* Popovers */,
 				3C5DB8B7294530EF00017ADE /* Popovers */,
 				3CBD874E27755E19005BBA48 /* PopoversExample */,
 				3CBD874D27755E19005BBA48 /* Products */,
```

**File**: `Examples/PopoversExample/Showroom/FormView.swift` (modified, +3/-5)
```diff
@@ -64,11 +64,9 @@ private struct WarningAccessoryModifier: ViewModifier {
                         $0.sourceFrameInset.bottom = -26
                     }
                 ) {
-                    if let warning = warning {
-                        Templates.Container {
-                            Text(warning)
-                                .font(.caption)
-                        }
+                    Templates.Container {
+                        Text(warning)
+                            .font(.caption)
                     }
                 }
 
```

---

### Incident Patch 2: `2c110e54` (2023-04-26)
**Commit Message**: Fixed example

**File**: `Examples/PopoversExample.xcodeproj/project.pbxproj` (modified, +0/-2)
```diff
@@ -50,7 +50,6 @@
 
 /* Begin PBXFileReference section */
 		3C5DB8B7294530EF00017ADE /* Popovers */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = Popovers; path = ..; sourceTree = "<group>"; };
-		3C6C745127822EE600E039F0 /* Popovers */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = Popovers; path = ../..; sourceTree = "<group>"; };
 		3C73924D27AF8496006A56E7 /* UIKitMenuView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = UIKitMenuView.swift; sourceTree = "<group>"; };
 		3C8521B527ACADB30020ECB8 /* InsideNavigationView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = InsideNavigationView.swift; sourceTree = "<group>"; };
 		3CA34FAB279533E300AC36DF /* AccessibilityView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AccessibilityView.swift; sourceTree = "<group>"; };
@@ -128,7 +127,6 @@
 		3CBD874327755E19005BBA48 = {
 			isa = PBXGroup;
 			children = (
-				3C6C745127822EE600E039F0 /* Popovers */,
 				3C5DB8B7294530EF00017ADE /* Popovers */,
 				3CBD874E27755E19005BBA48 /* PopoversExample */,
 				3CBD874D27755E19005BBA48 /* Products */,
```

**File**: `Examples/PopoversExample/Showroom/FormView.swift` (modified, +3/-5)
```diff
@@ -64,11 +64,9 @@ private struct WarningAccessoryModifier: ViewModifier {
                         $0.sourceFrameInset.bottom = -26
                     }
                 ) {
-                    if let warning = warning {
-                        Templates.Container {
-                            Text(warning)
-                                .font(.caption)
-                        }
+                    Templates.Container {
+                        Text(warning)
+                            .font(.caption)
                     }
                 }
 
```

---

### Incident Patch 3: `f001e5b2` (2022-12-04)
**Commit Message**: Use ViewBuilder

**File**: `Sources/Templates/Extensions.swift` (modified, +2/-9)
```diff
@@ -23,16 +23,9 @@ public extension View {
     }
 
     /// A convenient way to apply a nullable shadow.
-    func popoverShadowIfNeeded(shadow: Templates.Shadow?) -> AnyView {
+    @ViewBuilder func popoverShadowIfNeeded(shadow: Templates.Shadow?) -> some View {
         if let shadow = shadow {
-            return AnyView(self.shadow(
-                color: shadow.color,
-                radius: shadow.radius,
-                x: shadow.x,
-                y: shadow.y
-            ))
-        } else {
-            return AnyView(self)
+            popoverShadow(shadow: shadow)
         }
     }
 }
```

---

### Incident Patch 4: `6a4c3d74` (2022-12-04)
**Commit Message**: Fix conflict in Readers.swift

**File**: `Sources/Popover+Lifecycle.swift` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
 //  Created by A. Zheng (github.com/aheze) on 1/4/22.
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
-
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -201,3 +201,4 @@ extension UIView {
         }
     }
 }
+#endif
```

**File**: `Sources/Popover+Positioning.swift` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
 //  Created by A. Zheng (github.com/aheze) on 12/23/21.
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
-
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -293,3 +293,4 @@ public extension Popover.Attributes.Position.Anchor {
         }
     }
 }
+#endif
```

**File**: `Sources/Popover.swift` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
 //  Created by A. Zheng (github.com/aheze) on 12/23/21.
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
-
+#if os(iOS)
 import Combine
 import SwiftUI
 
@@ -587,3 +587,4 @@ extension Popover: Equatable {
         return lhs.id == rhs.id
     }
 }
+#endif
```

**File**: `Sources/PopoverContainerView.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -262,3 +263,4 @@ struct PopoverContainerView: View {
         return selectedPopoverOffset
     }
 }
+#endif
```

**File**: `Sources/PopoverGestureContainer.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import SwiftUI
 
 /// A hosting view for `PopoverContainerView` with tap filtering.
@@ -163,3 +164,4 @@ class PopoverGestureContainer: UIView {
         fatalError("[Popovers] - Create this view programmatically.")
     }
 }
+#endif
```

**File**: `Sources/PopoverModel.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import Combine
 import SwiftUI
 
@@ -122,3 +123,4 @@ class PopoverModel: ObservableObject {
         return frame ?? .zero
     }
 }
+#endif
```

**File**: `Sources/PopoverUtilities.swift` (modified, +2/-103)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import Combine
 import SwiftUI
 
@@ -215,106 +216,4 @@ public extension View {
     }
 }
 
-/**
- From https://github.com/boraseoksoon/Throttler
- Used to prevent too many frame updates (when scrolling or presenting a `NavigationLink` with animations).
-
- MIT License
-
- Copyright (c) 2021 Jang Seoksoon
-
- Permission is hereby granted, free of charge, to any person obtaining a copy
- of this software and associated documentation files (the "Software"), to deal
- in the Software without restriction, including without limitation the rights
- to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
- copies of the Software, and to permit persons to whom the Software is
- furnished to do so, subject to the following conditions:
-
- The above copyright notice and this permission notice shall be included in all
- copies or substantial portions of the Software.
-
- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
- SOFTWARE.
- */
-public enum Throttler {
-    typealias WorkIdentifier = String
-
-    typealias Work = () -> Void
-    typealias Subject = PassthroughSubject<Work, Never>?
-    typealias Bag = Set<AnyCancellable>
-
-    private static var subjects: [WorkIdentifier: Subject] = [:]
-    private static var bags: [WorkIdentifier: Bag] = [:]
-
-    /// Throttle a work
-    ///
-    ///     var sec = 0
-    ///     for i in 0...1000000000 {
-    ///         Throttler.throttle {
-    ///             sec += 1
-    ///             Debug.log("your work done : \(i)")
-    ///         }
-    ///     }
-    ///
-    ///     Debug.log("done!")
-    ///
-    ///
-    ///     "your work done : 1"
-    ///     (after a delay)
-    ///     "your work done : x"
-    ///     (after a delay)
-    ///     "your work done : y"
-    ///     (after a delay)
-    ///     "your work done : z"
-    ///     ....
-    ///     ...
-    ///     ..
-    ///     .
-    ///     "your work done : 1000000000"
-    ///
-    ///     "done!"
-    ///
-    /// - Note: Pay special attention to the identifier parameter. the default identifier is \("Thread.callStackSymbols") to make api trailing closure for one liner for the sake of brevity. However, it is highly recommend that a developer should provide explicit identifier for their work to debounce. Also, please note that the default queue is global queue, it may cause thread explosion issue if not explicitly specified , so use at your own risk.
-    ///
-    /// - Parameters:
-    ///   - identifier: the identifier to group works to throttle. Throttler must have equivalent identifier to each work in a group to throttle.
-    ///   - queue: a queue to run a work on. dispatch global queue will be chosen by default if not specified.
-    ///   - delay: delay for throttle. time unit is second. given default is 1.0 sec.
-    ///   - shouldRunImmediately: a boolean type where true will run the first work immediately regardless.
-    ///   - shouldRunLatest: A Boolean value that indicates whether to publish the most recent element. If `false`, the publisher emits the first element received during the interval.
-    ///   - work: a work to run
-    /// - Returns: Void
-    public static func throttle(
-        identifier: String = "\(Thread.callStackSymbols)",
-        queue: DispatchQueue? = nil,
-        delay: DispatchQueue.SchedulerTimeType.Stride = .seconds(1),
-        shouldRunImmediately: Bool = true,
-        shouldRunLatest: Bool = true,
-        work: @escaping () -> Void
-    ) {
-        let isFirstRun = subjects[identifier] == nil ? true : false
-
-        if shouldRunImmediately, isFirstRun {
-            work()
-        }
-
-        if let _ = subjects[identifier] {
-            subjects[identifier]?!.send(work)
-        } else {
-            subjects[identifier] = PassthroughSubject<Work, Never>()
-            bags[identifier] = Bag()
-
-            let q = queue ?? .global()
-
-            subjects[identifier]?!
-                .throttle(for: delay, scheduler: q, latest: shouldRunLatest)
-                .sink(receiveValue: { $0() })
-                .store(in: &bags[identifier]!)
-        }
-    }
-}
+#endif
```

**File**: `Sources/PopoverWindows.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -135,3 +136,4 @@ extension EnvironmentValues {
         static var defaultValue: UIWindow? = nil
     }
 }
+#endif
```

---

### Incident Patch 5: `c38c8faa` (2022-12-04)
**Commit Message**: Fix merge conflict

**File**: `Sources/Popover+Lifecycle.swift` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
 //  Created by A. Zheng (github.com/aheze) on 1/4/22.
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
-
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -201,3 +201,4 @@ extension UIView {
         }
     }
 }
+#endif
```

**File**: `Sources/Popover+Positioning.swift` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
 //  Created by A. Zheng (github.com/aheze) on 12/23/21.
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
-
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -293,3 +293,4 @@ public extension Popover.Attributes.Position.Anchor {
         }
     }
 }
+#endif
```

**File**: `Sources/Popover.swift` (modified, +2/-1)
```diff
@@ -5,7 +5,7 @@
 //  Created by A. Zheng (github.com/aheze) on 12/23/21.
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
-
+#if os(iOS)
 import Combine
 import SwiftUI
 
@@ -587,3 +587,4 @@ extension Popover: Equatable {
         return lhs.id == rhs.id
     }
 }
+#endif
```

**File**: `Sources/PopoverContainerView.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -262,3 +263,4 @@ struct PopoverContainerView: View {
         return selectedPopoverOffset
     }
 }
+#endif
```

**File**: `Sources/PopoverGestureContainer.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import SwiftUI
 
 /// A hosting view for `PopoverContainerView` with tap filtering.
@@ -163,3 +164,4 @@ class PopoverGestureContainer: UIView {
         fatalError("[Popovers] - Create this view programmatically.")
     }
 }
+#endif
```

**File**: `Sources/PopoverModel.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import Combine
 import SwiftUI
 
@@ -122,3 +123,4 @@ class PopoverModel: ObservableObject {
         return frame ?? .zero
     }
 }
+#endif
```

**File**: `Sources/PopoverUtilities.swift` (modified, +2/-103)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import Combine
 import SwiftUI
 
@@ -215,106 +216,4 @@ public extension View {
     }
 }
 
-/**
- From https://github.com/boraseoksoon/Throttler
- Used to prevent too many frame updates (when scrolling or presenting a `NavigationLink` with animations).
-
- MIT License
-
- Copyright (c) 2021 Jang Seoksoon
-
- Permission is hereby granted, free of charge, to any person obtaining a copy
- of this software and associated documentation files (the "Software"), to deal
- in the Software without restriction, including without limitation the rights
- to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
- copies of the Software, and to permit persons to whom the Software is
- furnished to do so, subject to the following conditions:
-
- The above copyright notice and this permission notice shall be included in all
- copies or substantial portions of the Software.
-
- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
- SOFTWARE.
- */
-public enum Throttler {
-    typealias WorkIdentifier = String
-
-    typealias Work = () -> Void
-    typealias Subject = PassthroughSubject<Work, Never>?
-    typealias Bag = Set<AnyCancellable>
-
-    private static var subjects: [WorkIdentifier: Subject] = [:]
-    private static var bags: [WorkIdentifier: Bag] = [:]
-
-    /// Throttle a work
-    ///
-    ///     var sec = 0
-    ///     for i in 0...1000000000 {
-    ///         Throttler.throttle {
-    ///             sec += 1
-    ///             Debug.log("your work done : \(i)")
-    ///         }
-    ///     }
-    ///
-    ///     Debug.log("done!")
-    ///
-    ///
-    ///     "your work done : 1"
-    ///     (after a delay)
-    ///     "your work done : x"
-    ///     (after a delay)
-    ///     "your work done : y"
-    ///     (after a delay)
-    ///     "your work done : z"
-    ///     ....
-    ///     ...
-    ///     ..
-    ///     .
-    ///     "your work done : 1000000000"
-    ///
-    ///     "done!"
-    ///
-    /// - Note: Pay special attention to the identifier parameter. the default identifier is \("Thread.callStackSymbols") to make api trailing closure for one liner for the sake of brevity. However, it is highly recommend that a developer should provide explicit identifier for their work to debounce. Also, please note that the default queue is global queue, it may cause thread explosion issue if not explicitly specified , so use at your own risk.
-    ///
-    /// - Parameters:
-    ///   - identifier: the identifier to group works to throttle. Throttler must have equivalent identifier to each work in a group to throttle.
-    ///   - queue: a queue to run a work on. dispatch global queue will be chosen by default if not specified.
-    ///   - delay: delay for throttle. time unit is second. given default is 1.0 sec.
-    ///   - shouldRunImmediately: a boolean type where true will run the first work immediately regardless.
-    ///   - shouldRunLatest: A Boolean value that indicates whether to publish the most recent element. If `false`, the publisher emits the first element received during the interval.
-    ///   - work: a work to run
-    /// - Returns: Void
-    public static func throttle(
-        identifier: String = "\(Thread.callStackSymbols)",
-        queue: DispatchQueue? = nil,
-        delay: DispatchQueue.SchedulerTimeType.Stride = .seconds(1),
-        shouldRunImmediately: Bool = true,
-        shouldRunLatest: Bool = true,
-        work: @escaping () -> Void
-    ) {
-        let isFirstRun = subjects[identifier] == nil ? true : false
-
-        if shouldRunImmediately, isFirstRun {
-            work()
-        }
-
-        if let _ = subjects[identifier] {
-            subjects[identifier]?!.send(work)
-        } else {
-            subjects[identifier] = PassthroughSubject<Work, Never>()
-            bags[identifier] = Bag()
-
-            let q = queue ?? .global()
-
-            subjects[identifier]?!
-                .throttle(for: delay, scheduler: q, latest: shouldRunLatest)
-                .sink(receiveValue: { $0() })
-                .store(in: &bags[identifier]!)
-        }
-    }
-}
+#endif
```

**File**: `Sources/PopoverWindows.swift` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+#if os(iOS)
 import SwiftUI
 
 /**
@@ -135,3 +136,4 @@ extension EnvironmentValues {
         static var defaultValue: UIWindow? = nil
     }
 }
+#endif
```

---

### Incident Patch 6: `f9b9ae46` (2022-12-02)
**Commit Message**: Add a variable shadow such that Templates.Container can be modified with nullable shadow.

**File**: `Sources/Templates/Container.swift` (modified, +6/-6)
```diff
@@ -22,6 +22,9 @@ public extension Templates {
         /// The container's background/fill color.
         public var backgroundColor = Color(.systemBackground)
 
+        /// The shadow around the content view.
+        public var shadow: Shadow? = .system
+
         /// The padding around the content view.
         public var padding = CGFloat(16)
 
@@ -40,12 +43,14 @@ public extension Templates {
             arrowSide: Templates.ArrowSide? = nil,
             cornerRadius: CGFloat = CGFloat(12),
             backgroundColor: Color = Color(.systemBackground),
+            shadow: Shadow? = .system,
             padding: CGFloat = CGFloat(16),
             @ViewBuilder view: () -> Content
         ) {
             self.arrowSide = arrowSide
             self.cornerRadius = cornerRadius
             self.backgroundColor = backgroundColor
+            self.shadow = shadow
             self.padding = padding
             self.view = view()
         }
@@ -60,12 +65,7 @@ public extension Templates {
                             cornerRadius: cornerRadius
                         )
                         .fill(backgroundColor)
-                        .shadow(
-                            color: Color(.label.withAlphaComponent(0.25)),
-                            radius: 40,
-                            x: 0,
-                            y: 4
-                        )
+                        .popoverShadowIfNeeded(shadow: shadow)
                     )
             }
         }
```

**File**: `Sources/Templates/Extensions.swift` (modified, +14/-0)
```diff
@@ -20,6 +20,20 @@ public extension View {
             y: shadow.y
         )
     }
+
+    /// A convenient way to apply a nullable shadow.
+    func popoverShadowIfNeeded(shadow: Templates.Shadow?) -> AnyView {
+        if let shadow = shadow {
+            return AnyView(self.shadow(
+                color: shadow.color,
+                radius: shadow.radius,
+                x: shadow.x,
+                y: shadow.y
+            ))
+        } else {
+            return AnyView(self)
+        }
+    }
 }
 
 // MARK: - Arrow Positioning
```

**File**: `Sources/Templates/Shadow.swift` (modified, +12/-0)
```diff
@@ -29,5 +29,17 @@ public extension Templates {
             x: 0,
             y: 4
         )
+
+        public init(
+            color: Color = Color(.label.withAlphaComponent(0.3)),
+            radius: CGFloat = CGFloat(0),
+            x: CGFloat = CGFloat(0),
+            y: CGFloat = CGFloat(0)
+        ) {
+            self.color = color
+            self.radius = radius
+            self.x = x
+            self.y = y
+        }
     }
 }
```

---

### Incident Patch 7: `9711067e` (2022-08-21)
**Commit Message**: Add throttler and dividers

**File**: `Sources/PopoverUtilities.swift` (modified, +105/-1)
```diff
@@ -6,6 +6,7 @@
 //  Copyright © 2022 A. Zheng. All rights reserved.
 //
 
+import Combine
 import SwiftUI
 
 public extension UIView {
@@ -37,7 +38,6 @@ public extension View {
                             rect(newValue)
                         }
                     }
-                
             }
             .hidden()
         )
@@ -212,3 +212,107 @@ public extension View {
         }
     }
 }
+
+/**
+ From https://github.com/boraseoksoon/Throttler
+ Used to prevent too many frame updates (when scrolling or presenting a `NavigationLink` with animations).
+
+ MIT License
+
+ Copyright (c) 2021 Jang Seoksoon
+
+ Permission is hereby granted, free of charge, to any person obtaining a copy
+ of this software and associated documentation files (the "Software"), to deal
+ in the Software without restriction, including without limitation the rights
+ to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+ copies of the Software, and to permit persons to whom the Software is
+ furnished to do so, subject to the following conditions:
+
+ The above copyright notice and this permission notice shall be included in all
+ copies or substantial portions of the Software.
+
+ THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+ IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+ FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+ AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+ LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+ OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
+ SOFTWARE.
+ */
+public enum Throttler {
+    typealias WorkIdentifier = String
+
+    typealias Work = () -> Void
+    typealias Subject = PassthroughSubject<Work, Never>?
+    typealias Bag = Set<AnyCancellable>
+
+    private static var subjects: [WorkIdentifier: Subject] = [:]
+    private static var bags: [WorkIdentifier: Bag] = [:]
+
+    /// Throttle a work
+    ///
+    ///     var sec = 0
+    ///     for i in 0...1000000000 {
+    ///         Throttler.throttle {
+    ///             sec += 1
+    ///             Debug.log("your work done : \(i)")
+    ///         }
+    ///     }
+    ///
+    ///     Debug.log("done!")
+    ///
+    ///
+    ///     "your work done : 1"
+    ///     (after a delay)
+    ///     "your work done : x"
+    ///     (after a delay)
+    ///     "your work done : y"
+    ///     (after a delay)
+    ///     "your work done : z"
+    ///     ....
+    ///     ...
+    ///     ..
+    ///     .
+    ///     "your work done : 1000000000"
+    ///
+    ///     "done!"
+    ///
+    /// - Note: Pay special attention to the identifier parameter. the default identifier is \("Thread.callStackSymbols") to make api trailing closure for one liner for the sake of brevity. However, it is highly recommend that a developer should provide explicit identifier for their work to debounce. Also, please note that the default queue is global queue, it may cause thread explosion issue if not explicitly specified , so use at your own risk.
+    ///
+    /// - Parameters:
+    ///   - identifier: the identifier to group works to throttle. Throttler must have equivalent identifier to each work in a group to throttle.
+    ///   - queue: a queue to run a work on. dispatch global queue will be chosen by default if not specified.
+    ///   - delay: delay for throttle. time unit is second. given default is 1.0 sec.
+    ///   - shouldRunImmediately: a boolean type where true will run the first work immediately regardless.
+    ///   - shouldRunLatest: A Boolean value that indicates whether to publish the most recent element. If `false`, the publisher emits the first element received during the interval.
+    ///   - work: a work to run
+    /// - Returns: Void
+    public static func throttle(
+        identifier: String = "\(Thread.callStackSymbols)",
+        queue: DispatchQueue? = nil,
+        delay: DispatchQueue.SchedulerTimeType.Stride = .seconds(1),
+        shouldRunImmediately: Bool = true,
+        shouldRunLatest: Bool = true,
+        work: @escaping () -> Void
+    ) {
+        let isFirstRun = subjects[identifier] == nil ? true : false
+
+        if shouldRunImmediately, isFirstRun {
+            work()
+        }
+
+        if let _ = subjects[identifier] {
+            subjects[identifier]?!.send(work)
+        } else {
+            subjects[identifier] = PassthroughSubject<Work, Never>()
+            bags[identifier] = Bag()
+
+            let q = queue ?? .global()
+
+            subjects[identifier]?!
+                .throttle(for: delay, scheduler: q, latest: shouldRunLatest)
+                .sink(receiveValue: { $0() })
+                .store(in: &bags[identifier]!)
+        }
+    }
+}
```

---

### Incident Patch 8: `14b7620a` (2022-07-17)
**Commit Message**: Fix popovers - modifier must be outside button label

**File**: `Examples/PopoversXcodeApp/PopoversXcodeApp/PlaygroundFiles/FrameTaggedView.swift` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ struct FrameTaggedPopover: View {
     @State var savedFrame = CGRect.zero
 
     var body: some View {
+        let _ = print("fram etagged")
         WindowReader { window in
             VStack(alignment: .leading) {
                 Text(verbatim: "This is just a view with a saved frame: \(savedFrame).")
```

**File**: `Package.swift` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ import PackageDescription
 let package = Package(
     name: "Popovers",
     platforms: [
-        .iOS(.v14),
+        .iOS(.v15),
     ],
     products: [
         // Products define the executables and libraries a package produces, and make them visible to other packages.
```

**File**: `Sources/SwiftUI/FrameTag.swift` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ struct FrameTagModifier: ViewModifier {
     @State var frame = CGRect.zero
 
     func body(content: Content) -> some View {
+        let _ = print("fram etagged modii")
         WindowReader { window in
             content
                 .frameReader { frame in
```

**File**: `Sources/SwiftUI/Readers.swift` (modified, +21/-13)
```diff
@@ -44,40 +44,37 @@ public struct WindowReader<Content: View>: View {
     public let view: (UIWindow?) -> Content
 
     /// The read window.
-    @State var window: UIWindow?
-
-    /// An environment value to pass down into your SwiftUI view.
-    @Environment(\.window) var environmentWindow
+//    @State var window: UIWindow?
+    @StateObject var windowViewModel = WindowViewModel()
 
     /// Reads the `UIWindow` that hosts some SwiftUI content.
     public init(@ViewBuilder view: @escaping (UIWindow?) -> Content) {
         self.view = view
     }
 
     public var body: some View {
-        view(window)
-            .environment(\.window, window)
+        view(windowViewModel.window)
             .background(
-                WindowHandlerRepresentable(binding: $window)
+                WindowHandlerRepresentable(windowViewModel: windowViewModel)
             )
     }
 
     /// A wrapper view to read the parent window.
     private struct WindowHandlerRepresentable: UIViewRepresentable {
-        var binding: Binding<UIWindow?>
+        @ObservedObject var windowViewModel: WindowViewModel
 
         func makeUIView(context _: Context) -> WindowHandler {
-            WindowHandler(binding: binding)
+            return WindowHandler(windowViewModel: windowViewModel)
         }
 
         func updateUIView(_: WindowHandler, context _: Context) {}
     }
 
     private class WindowHandler: UIView {
-        @Binding var binding: UIWindow?
+        var windowViewModel: WindowViewModel
 
-        init(binding: Binding<UIWindow?>) {
-            _binding = binding
+        init(windowViewModel: WindowViewModel) {
+            self.windowViewModel = windowViewModel
             super.init(frame: .zero)
             backgroundColor = .clear
         }
@@ -90,8 +87,19 @@ public struct WindowReader<Content: View>: View {
         override func didMoveToWindow() {
             super.didMoveToWindow()
 
+            print("mpved to window \(window)! currentl: \(windowViewModel.window)")
+
             /// Set the window.
-            binding = window
+//            windowViewModel.window = window
+
+            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
+                self.windowViewModel.window = self.window
+                self.windowViewModel.objectWillChange.send()
+            }
         }
     }
 }
+
+class WindowViewModel: ObservableObject {
+    @Published var window: UIWindow?
+}
```

**File**: `Sources/Templates/Hero.swift` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+//
+//  Hero.swift
+//  Popovers
+//
+//  Created by A. Zheng (github.com/aheze) on 7/17/22.
+//  Copyright © 2022 A. Zheng. All rights reserved.
+//
+
+import SwiftUI
+
+public extension Templates {
+    class Hero: ObservableObject {
+        @Published public var present: Bool?
+
+        public init() {}
+        
+        public func go() {
+            guard present == nil else { return }
+            present = false
+            DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) {
+                withAnimation {
+                    self.present = true
+                }
+            }
+        }
+
+        public func revert() {
+            guard present != nil else { return }
+            withAnimation {
+                present = false
+            }
+
+            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
+                self.present = nil
+            }
+        }
+
+        public func toggle() {
+            if present == nil {
+                go()
+            } else {
+                revert()
+            }
+        }
+    }
+}
```

---

### Incident Patch 9: `b7e50f90` (2022-06-20)
**Commit Message**: Fix UIKit menu going into an infinite loop

**File**: `Examples/PopoversXcodeApp/PopoversXcodeApp/Playground.swift` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ struct Playground: View {
                 .frame(maxWidth: .infinity, alignment: .leading)
         ) {
             Group {
+                UIKitMenuView()
                 BasicView()
                 CustomizedView()
                 AbsolutePositioningView()
```

**File**: `Examples/PopoversXcodeApp/PopoversXcodeApp/PlaygroundFiles/SelectionView.swift` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ import SwiftUI
 
 struct SelectionView: View {
     @State var present = false
-    @State var selection: String?
+    @State var selection: AnyHashable?
 
     var body: some View {
         ExampleRow(
@@ -57,7 +57,7 @@ struct SelectionView: View {
 }
 
 struct SelectionViewButton: View {
-    @Binding var selection: String?
+    @Binding var selection: AnyHashable?
     let tag: String
 
     var body: some View {
```

**File**: `Examples/PopoversXcodeApp/PopoversXcodeApp/ShowroomFiles/MenuView.swift` (modified, +10/-8)
```diff
@@ -15,14 +15,16 @@ struct MenuView: View {
 
     var body: some View {
         Templates.Menu {
-            Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") {
-                iconName = "list.bullet"
-            }
-            Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") {
-                iconName = "keyboard"
-            }
-            Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") {
-                iconName = "bag"
+            Templates.DividedVStack {
+                Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") {
+                    iconName = "list.bullet"
+                }
+                Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") {
+                    iconName = "keyboard"
+                }
+                Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") {
+                    iconName = "bag"
+                }
             }
         } label: { fade in
             ExampleShowroomRow(color: UIColor(hex: 0xFF00AB)) {
```

**File**: `Examples/PopoversXcodeApp/PopoversXcodeApp/ShowroomFiles/TutorialView.swift` (modified, +25/-25)
```diff
@@ -156,35 +156,35 @@ struct TutorialViewPopover: View {
                             )
                             .cornerRadius(16)
                     }
-                    .background {
-                        Color.white.opacity(0.5)
-                            .cornerRadius(16)
-                            .padding(selection == "Step 2" ? -8 : 0)
-                    }
-                    .popover(
-                        selection: $selection,
-                        tag: "Step 2",
-                        attributes: {
-                            $0.position = .absolute(
-                                originAnchor: .right,
-                                popoverAnchor: .left
-                            )
-                        }
-                    ) {
-                        TutorialViewPopoverDetails(selection: $selection, step: 2)
-                            .zIndex(1)
-                    }
+//                    .background {
+//                        Color.white.opacity(0.5)
+//                            .cornerRadius(16)
+//                            .padding(selection == "Step 2" ? -8 : 0)
+//                    }
+//                    .popover(
+//                        selection: $selection,
+//                        tag: "Step 2",
+//                        attributes: {
+//                            $0.position = .absolute(
+//                                originAnchor: .right,
+//                                popoverAnchor: .left
+//                            )
+//                        }
+//                    ) {
+//                        TutorialViewPopoverDetails(selection: $selection, step: 2)
+//                            .zIndex(1)
+//                    }
 
                     Spacer()
                 }
             }
-            .clipped()
-            .opacity(selection == nil ? 0.6 : 1)
-
-            /// try to avoid scale effect
-            /// this time, I've added some offset to cancel it out
-            .scaleEffect(selection == nil ? 0.9 : 1, anchor: .bottom)
-            .allowsHitTesting(selection != nil)
+//            .clipped()
+//            .opacity(selection == nil ? 0.6 : 1)
+//
+//            /// try to avoid scale effect
+//            /// this time, I've added some offset to cancel it out
+//            .scaleEffect(selection == nil ? 0.9 : 1, anchor: .bottom)
+//            .allowsHitTesting(selection != nil)
         }
         .background(.regularMaterial)
         .cornerRadius(16)
```

**File**: `Examples/PopoversXcodeApp/PopoversXcodeApp/TestingFiles/MenuComparisonView.swift` (modified, +70/-64)
```diff
@@ -31,14 +31,16 @@ struct MenuComparisonDestinationView: View {
                 Text("Compare Popovers' custom menu with the system menu.")
 
                 Templates.Menu {
-                    Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") {
-                        iconName = "list.bullet"
-                    }
-                    Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") {
-                        iconName = "keyboard"
-                    }
-                    Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") {
-                        iconName = "bag"
+                    Templates.DividedVStack {
+                        Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") {
+                            iconName = "list.bullet"
+                        }
+                        Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") {
+                            iconName = "keyboard"
+                        }
+                        Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") {
+                            iconName = "bag"
+                        }
                     }
                 } label: { fade in
                     ExampleRow(image: iconName, title: "Popovers Menu", color: 0x007eef)
@@ -75,58 +77,60 @@ struct MenuComparisonDestinationView: View {
                         $0.popoverAnchor = .bottom
                     }
                 ) {
-                    Color.blue
-                        .frame(height: 50)
-                        .overlay(
-                            AsyncImage(url: URL(string: "https://raw.githubusercontent.com/aheze/Popovers/main/Assets/SocialPreview.png")) { image in
-                                image
-                                    .resizable()
-                                    .aspectRatio(contentMode: .fill)
-                            } placeholder: {
-                                Color.clear
+                    Templates.DividedVStack {
+                        Color.blue
+                            .frame(height: 50)
+                            .overlay(
+                                AsyncImage(url: URL(string: "https://raw.githubusercontent.com/aheze/Popovers/main/Assets/SocialPreview.png")) { image in
+                                    image
+                                        .resizable()
+                                        .aspectRatio(contentMode: .fill)
+                                } placeholder: {
+                                    Color.clear
+                                }
+                            )
+                            .clipped()
+                        
+                        Templates.MenuDivider()
+                        
+                        Templates.MenuItem {
+                            iconName = "list.bullet"
+                        } label: { pressed in
+                            HStack {
+                                MenuImageView(image: "list.bullet", color: .red)
+                                Text("Change Icon To List")
+                                    .frame(maxWidth: .infinity, alignment: .trailing)
                             }
-                        )
-                        .clipped()
-
-                    Templates.MenuDivider()
-
-                    Templates.MenuItem {
-                        iconName = "list.bullet"
-                    } label: { pressed in
-                        HStack {
-                            MenuImageView(image: "list.bullet", color: .red)
-                            Text("Change Icon To List")
-                                .frame(maxWidth: .infinity, alignment: .trailing)
+                            .frame(maxWidth: .infinity)
+                            .padding(EdgeInsets(top: 14, leading: 18, bottom: 14, trailing: 18))
+                            .background(pressed ? Templates.buttonHighlightColor : Color.clear) /// Add highlight effect when pressed.
                         }
-                        .frame(maxWidth: .infinity)
-                        .padding(EdgeInsets(top: 14, leading: 18, bottom: 14, trailing: 18))
-                        .background(pressed ? Templates.buttonHighlightColor : Color.clear) /// Add highlight effect when pressed.
-                    }
-
-                    Templates.MenuItem {
-                        iconName = "keyboard"
-                    } label: { pressed in
-                        HStack {
-                            MenuImageView(image: "keyboard", color: .green)
-                            Text("Change Icon To Keyboard")
-                                .frame(maxWidth: .infinity, alignment: .trailing)
+                        
+                        Templates.MenuItem {
+                            iconName = "keyboard"
+                        } label: { pressed in
+ 
```

**File**: `Examples/PopoversXcodeApp/PopoversXcodeApp/TestingFiles/UIKitMenuView.swift` (modified, +20/-16)
```diff
@@ -28,14 +28,16 @@ class UIKitMenuViewController: UIViewController {
             }
         }
     ) {
-        Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") { [weak self] in
-            self?.label.text = "Present Menu (List)"
-        }
-        Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") { [weak self] in
-            self?.label.text = "Present Menu (Keyboard)"
-        }
-        Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") { [weak self] in
-            self?.label.text = "Present Menu (Bag)"
+        Templates.DividedVStack {
+            Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") { [weak self] in
+                self?.label.text = "Present Menu (List)"
+            }
+            Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") { [weak self] in
+                self?.label.text = "Present Menu (Keyboard)"
+            }
+            Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") { [weak self] in
+                self?.label.text = "Present Menu (Bag)"
+            }
         }
     } fadeLabel: { [weak self] fade in
         UIView.animate(withDuration: 0.15) {
@@ -49,14 +51,16 @@ class UIKitMenuViewController: UIViewController {
             $0.scaleAnchor = .topRight
         }
     ) {
-        Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") { [weak self] in
-            self?.label.text = "Present Menu (List)"
-        }
-        Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") { [weak self] in
-            self?.label.text = "Present Menu (Keyboard)"
-        }
-        Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") { [weak self] in
-            self?.label.text = "Present Menu (Bag)"
+        Templates.DividedVStack {
+            Templates.MenuButton(title: "Change Icon To List", systemImage: "list.bullet") { [weak self] in
+                self?.label.text = "Present Menu (List)"
+            }
+            Templates.MenuButton(title: "Change Icon To Keyboard", systemImage: "keyboard") { [weak self] in
+                self?.label.text = "Present Menu (Keyboard)"
+            }
+            Templates.MenuButton(title: "Change Icon To Bag", systemImage: "bag") { [weak self] in
+                self?.label.text = "Present Menu (Bag)"
+            }
         }
     } fadeLabel: { [weak self] fade in
         UIView.animate(withDuration: 0.15) {
```

**File**: `Sources/PopoverContainerView.swift` (modified, +3/-0)
```diff
@@ -35,6 +35,7 @@ struct PopoverContainerView: View {
                     /// Show the popover's main content view.
                     HStack(alignment: .top) {
                         popover.view
+                            .border(.green)
 
                             /// Have VoiceOver read the popover view first, before the dismiss button.
                             .accessibility(sortPriority: 1)
@@ -56,6 +57,8 @@ struct PopoverContainerView: View {
 
                     /// Read the popover's size in the view.
                     .sizeReader(transaction: popover.context.transaction) { size in
+                        print("size: \(size)")
+//                        guard size.height > 50 else { return}
 
                         if
                             let transaction = popover.context.transaction,
```

**File**: `Sources/SwiftUI/Modifiers.swift` (modified, +22/-14)
```diff
@@ -156,28 +156,36 @@ struct MultiPopoverModifier: ViewModifier {
     @State var sourceFrame: CGRect?
 
     /// Create a popover. Use `.popover(selection:tag:attributes:view)` to access.
-    init<Content: View>(
-        selection: Binding<AnyHashable?>,
-        tag: AnyHashable,
+    init<Selection: Hashable, Content: View>(
+        selection: Binding<Selection?>,
+        tag: Selection,
         buildAttributes: @escaping ((inout Popover.Attributes) -> Void),
         @ViewBuilder view: @escaping () -> Content
     ) {
-        _selection = selection
+        _selection = Binding {
+            selection.wrappedValue
+        } set: { newValue in
+            selection.wrappedValue = newValue as? Selection
+        }
         self.tag = tag
         self.buildAttributes = buildAttributes
         self.view = AnyView(view())
         background = AnyView(Color.clear)
     }
 
     /// Create a popover with a background. Use `.popover(selection:tag:attributes:view:background:)` to access.
-    init<MainContent: View, BackgroundContent: View>(
-        selection: Binding<AnyHashable?>,
-        tag: AnyHashable,
+    init<Selection: Hashable, MainContent: View, BackgroundContent: View>(
+        selection: Binding<Selection?>,
+        tag: Selection,
         buildAttributes: @escaping ((inout Popover.Attributes) -> Void),
         @ViewBuilder view: @escaping () -> MainContent,
         @ViewBuilder background: @escaping () -> BackgroundContent
     ) {
-        _selection = selection
+        _selection = Binding {
+            selection.wrappedValue
+        } set: { newValue in
+            selection.wrappedValue = newValue as? Selection
+        }
         self.tag = tag
         self.buildAttributes = buildAttributes
         self.view = AnyView(view())
@@ -326,9 +334,9 @@ public extension View {
      - parameter attributes: The popover's attributes.
      - parameter view: The popover's view.
      */
-    func popover<Content: View>(
-        selection: Binding<AnyHashable?>,
-        tag: AnyHashable,
+    func popover<Selection: Hashable, Content: View>(
+        selection: Binding<Selection?>,
+        tag: Selection,
         attributes buildAttributes: @escaping ((inout Popover.Attributes) -> Void) = { _ in },
         @ViewBuilder view: @escaping () -> Content
     ) -> some View {
@@ -350,9 +358,9 @@ public extension View {
      - parameter view: The popover's view.
      - parameter background: The popover's background.
      */
-    func popover<MainContent: View, BackgroundContent: View>(
-        selection: Binding<AnyHashable?>,
-        tag: AnyHashable,
+    func popover<Selection: Hashable, MainContent: View, BackgroundContent: View>(
+        selection: Binding<Selection?>,
+        tag: Selection,
         attributes buildAttributes: @escaping ((inout Popover.Attributes) -> Void) = { _ in },
         @ViewBuilder view: @escaping () -> MainContent,
         @ViewBuilder background: @escaping () -> BackgroundContent
```

---

### Incident Patch 10: `647e39d9` (2022-06-15)
**Commit Message**: Fix layout bugs

**File**: `Sources/PopoverContainerView.swift` (modified, +15/-11)
```diff
@@ -56,19 +56,23 @@ struct PopoverContainerView: View {
 
                     /// Read the popover's size in the view.
                     .sizeReader(transaction: popover.context.transaction) { size in
-                        if let transaction = popover.context.transaction {
-                            /// When `popover.context.size` is nil, the popover was just presented.
-                            if popover.context.size == nil {
+
+                        if
+                            let transaction = popover.context.transaction,
+                            popover.context.size != nil
+                        {
+                            /// Otherwise, the popover is *replacing* a previous popover, so animate it.
+                            /// This could also be true when the screen bounds changed.
+                            withTransaction(transaction) {
                                 popover.updateFrame(with: size)
-                                popoverModel.refresh(with: transaction)
-                            } else {
-                                /// Otherwise, the popover is *replacing* a previous popover, so animate it.
-                                withTransaction(transaction) {
-                                    popover.updateFrame(with: size)
-                                    popoverModel.refresh(with: transaction)
-                                }
+                                popoverModel.reload()
                             }
+
                             popover.context.transaction = nil
+                        } else {
+                            /// When `popover.context.size` is nil or there is no transaction, the popover was just presented.
+                            popover.updateFrame(with: size)
+                            popoverModel.reload()
                         }
                     }
 
@@ -143,7 +147,7 @@ struct PopoverContainerView: View {
                         removal: popover.attributes.dismissal.transition ?? .opacity
                     )
                 )
-                
+
                 /// Clean up the container view.
                 .onDisappear {
                     popover.context.onDisappear?()
```

**File**: `Sources/PopoverGestureContainer.swift` (modified, +13/-2)
```diff
@@ -21,11 +21,20 @@ class PopoverGestureContainer: UIView {
         autoresizingMask = [.flexibleWidth, .flexibleHeight]
     }
 
+    /// If this is nil, the view hasn't been laid out yet.
+    var previousBounds: CGRect?
+
     override func layoutSubviews() {
         super.layoutSubviews()
 
-        /// Orientation or screen bounds changed, so update popover frames.
-        popoverModel.updateFramesAfterBoundsChange()
+        /// Only update frames on a bounds change.
+        if let previousBounds = previousBounds, previousBounds != bounds {
+            /// Orientation or screen bounds changed, so update popover frames.
+            popoverModel.updateFramesAfterBoundsChange()
+        }
+
+        /// Store the bounds for later.
+        previousBounds = bounds
     }
 
     override func didMoveToWindow() {
@@ -67,9 +76,11 @@ class PopoverGestureContainer: UIView {
 
         /// The current popovers' frames
         let popoverFrames = popovers.map { $0.context.frame }
+        print("frames: \(popoverFrames)")
 
         /// Dismiss a popover, knowing that its frame does not contain the touch.
         func dismissPopoverIfNecessary(popoverToDismiss: Popover) {
+            print("doismiss now")
             if
                 popoverToDismiss.attributes.dismissal.mode.contains(.tapOutside), /// The popover can be automatically dismissed when tapped outside.
                 popoverToDismiss.attributes.dismissal.tapOutsideIncludesOtherPopovers || /// The popover can be dismissed even if the touch hit another popover, **or...**
```

**File**: `Sources/PopoverModel.swift` (modified, +2/-1)
```diff
@@ -40,7 +40,8 @@ class PopoverModel: ObservableObject {
     /**
      Refresh the popovers with a new transaction.
 
-     This is called when a popover's frame is being calculated.
+     This is called when the screen bounds changes - by setting a transaction for each popover,
+     the `PopoverContainerView` knows that it needs to animate a change (processed in `sizeReader`).
      */
     func refresh(with transaction: Transaction?) {
         /// Set each popovers's transaction to the new transaction to keep the smooth animation.
```

---

### Incident Patch 11: `6493c1ba` (2022-06-14)
**Commit Message**: Update SwiftUI extension to take in AnyHashable instead of String

**File**: `Sources/Popover+Lifecycle.swift` (modified, +16/-0)
```diff
@@ -151,6 +151,22 @@ public extension UIResponder {
     func dismiss(_ popover: Popover) {
         popover.dismiss()
     }
+
+    /**
+     Get a currently-presented popover with a tag. Returns `nil` if no popover with the tag was found.
+     - parameter tag: The tag of the popover to look for.
+     */
+    func popover(tagged tag: AnyHashable) -> Popover? {
+        return popoverModel.popover(tagged: tag)
+    }
+
+    /**
+     Remove all popovers, or optionally the ones tagged with a `tag` that you supply.
+     - parameter tag: If this isn't nil, only remove popovers tagged with this.
+     */
+    func dismissAllPopovers(with tag: AnyHashable? = nil) {
+        popoverModel.removeAllPopovers(with: tag)
+    }
 }
 
 public extension UIViewController {
```

**File**: `Sources/PopoverModel.swift` (modified, +17/-3)
```diff
@@ -59,8 +59,18 @@ class PopoverModel: ObservableObject {
 
     /// Removes a `Popover` from this model.
     func remove(_ popover: Popover) {
-        popovers.removeAll { candidate in
-            candidate == popover
+        popovers.removeAll { $0 == popover }
+    }
+
+    /**
+     Remove all popovers, or optionally the ones tagged with a `tag` that you supply.
+     - parameter tag: If this isn't nil, only remove popovers tagged with this.
+     */
+    func removeAllPopovers(with tag: AnyHashable? = nil) {
+        if let tag = tag {
+            popovers.removeAll(where: { $0.attributes.tag == tag })
+        } else {
+            popovers.removeAll()
         }
     }
 
@@ -74,7 +84,11 @@ class PopoverModel: ObservableObject {
      - parameter tag: The tag of the popover to look for.
      */
     func popover(tagged tag: AnyHashable) -> Popover? {
-        return popovers.first(where: { $0.attributes.tag == tag })
+        let matchingPopovers = popovers.filter { $0.attributes.tag == tag }
+        if matchingPopovers.count > 1 {
+            print("[Popovers] - Warning - There are \(matchingPopovers.count) popovers tagged '\(tag)'. Tags should be unique. Try dismissing all existing popovers first.")
+        }
+        return matchingPopovers.first
     }
 
     /**
```

**File**: `Sources/PopoverWindows.swift` (modified, +1/-11)
```diff
@@ -112,18 +112,8 @@ extension UIResponder {
         }
 
         print("[Popovers] - No `PopoverModel` present in responder chain (\(self)) - has the source view been installed into a window? Please file a bug report (https://github.com/aheze/Popovers/issues).")
-        
-        return PopoverModel()
-    }
-}
 
-public extension UIResponder {
-    /**
-     Get a currently-presented popover with a tag. Returns `nil` if no popover with the tag was found.
-     - parameter tag: The tag of the popover to look for.
-     */
-    func popover(tagged tag: AnyHashable) -> Popover? {
-        return popoverModel.popover(tagged: tag)
+        return PopoverModel()
     }
 }
 
```

**File**: `Sources/SwiftUI/Modifiers.swift` (modified, +10/-10)
```diff
@@ -135,10 +135,10 @@ struct PopoverModifier: ViewModifier {
  */
 struct MultiPopoverModifier: ViewModifier {
     /// The current selection. Present the popover when this equals `tag.`
-    @Binding var selection: String?
+    @Binding var selection: AnyHashable?
 
     /// The popover's tag.
-    let tag: String
+    let tag: AnyHashable
 
     /// Build the attributes.
     let buildAttributes: (inout Popover.Attributes) -> Void
@@ -157,8 +157,8 @@ struct MultiPopoverModifier: ViewModifier {
 
     /// Create a popover. Use `.popover(selection:tag:attributes:view)` to access.
     init<Content: View>(
-        selection: Binding<String?>,
-        tag: String,
+        selection: Binding<AnyHashable?>,
+        tag: AnyHashable,
         buildAttributes: @escaping ((inout Popover.Attributes) -> Void),
         @ViewBuilder view: @escaping () -> Content
     ) {
@@ -171,8 +171,8 @@ struct MultiPopoverModifier: ViewModifier {
 
     /// Create a popover with a background. Use `.popover(selection:tag:attributes:view:background:)` to access.
     init<MainContent: View, BackgroundContent: View>(
-        selection: Binding<String?>,
-        tag: String,
+        selection: Binding<AnyHashable?>,
+        tag: AnyHashable,
         buildAttributes: @escaping ((inout Popover.Attributes) -> Void),
         @ViewBuilder view: @escaping () -> MainContent,
         @ViewBuilder background: @escaping () -> BackgroundContent
@@ -327,8 +327,8 @@ public extension View {
      - parameter view: The popover's view.
      */
     func popover<Content: View>(
-        selection: Binding<String?>,
-        tag: String,
+        selection: Binding<AnyHashable?>,
+        tag: AnyHashable,
         attributes buildAttributes: @escaping ((inout Popover.Attributes) -> Void) = { _ in },
         @ViewBuilder view: @escaping () -> Content
     ) -> some View {
@@ -351,8 +351,8 @@ public extension View {
      - parameter background: The popover's background.
      */
     func popover<MainContent: View, BackgroundContent: View>(
-        selection: Binding<String?>,
-        tag: String,
+        selection: Binding<AnyHashable?>,
+        tag: AnyHashable,
         attributes buildAttributes: @escaping ((inout Popover.Attributes) -> Void) = { _ in },
         @ViewBuilder view: @escaping () -> MainContent,
         @ViewBuilder background: @escaping () -> BackgroundContent
```

**File**: `Sources/Templates/Menu/Menu+SwiftUI.swift` (modified, +19/-16)
```diff
@@ -18,17 +18,14 @@ public extension Templates {
         @State var id = UUID()
 
         /// View model for the menu buttons. Should be `StateObject` to avoid getting recreated by SwiftUI, but this works on iOS 13.
-        @ObservedObject var model = MenuModel()
+        @ObservedObject var model: MenuModel
 
         /// View model for controlling menu gestures.
-        @ObservedObject var gestureModel = MenuGestureModel()
+        @ObservedObject var gestureModel: MenuGestureModel
 
         /// Allow presenting from an external view via `$present`.
         @Binding var overridePresent: Bool
 
-        /// Attributes that determine what the menu looks like.
-        public let configuration: MenuConfiguration
-
         /// The menu buttons.
         public let content: () -> Content
 
@@ -51,7 +48,9 @@ public extension Templates {
 
             var configuration = MenuConfiguration()
             buildConfiguration(&configuration)
-            self.configuration = configuration
+
+            model = MenuModel(configuration: configuration)
+            gestureModel = MenuGestureModel()
             self.content = content
             self.label = label
         }
@@ -69,9 +68,9 @@ public extension Templates {
                                     newDragLocation: value.location,
                                     model: model,
                                     labelFrame: window.frameTagged(id),
-                                    configuration: configuration,
                                     window: window
                                 ) { present in
+                                    print("chane.\(present)")
                                     model.present = present
                                 } fadeLabel: { fade in
                                     fadeLabel = fade
@@ -82,9 +81,9 @@ public extension Templates {
                                     newDragLocation: value.location,
                                     model: model,
                                     labelFrame: window.frameTagged(id),
-                                    configuration: configuration,
                                     window: window
                                 ) { present in
+                                    print("End.\(present)")
                                     model.present = present
                                 } fadeLabel: { fade in
                                     fadeLabel = fade
@@ -93,7 +92,7 @@ public extension Templates {
                     )
                     .onValueChange(of: model.present) { _, present in
                         if !present {
-                            withAnimation(configuration.labelFadeAnimation) {
+                            withAnimation(model.configuration.labelFadeAnimation) {
                                 fadeLabel = false
                                 model.selectedItemID = nil
                                 model.hoveringItemID = nil
@@ -104,33 +103,37 @@ public extension Templates {
                     .onValueChange(of: overridePresent) { _, present in
                         if present != model.present {
                             model.present = present
-                            withAnimation(configuration.labelFadeAnimation) {
+                            withAnimation(model.configuration.labelFadeAnimation) {
                                 fadeLabel = present
                             }
                         }
                     }
                     .popover(
                         present: $model.present,
                         attributes: {
-                            $0.position = .absolute(originAnchor: configuration.originAnchor, popoverAnchor: configuration.popoverAnchor)
+                            $0.position = .absolute(
+                                originAnchor: model.configuration.originAnchor,
+                                popoverAnchor: model.configuration.popoverAnchor
+                            )
                             $0.rubberBandingMode = .none
                             $0.dismissal.excludedFrames = {
                                 [
                                     window.frameTagged(id),
                                 ]
-                                    + configuration.excludedFrames()
+                                    + model.configuration.excludedFrames()
                             }
-                            $0.sourceFrameInset = configuration.sourceFrameInset
+                            $0.sourceFrameInset = model.configuration.sourceFrameInset
                         }
                     ) {
                         MenuView(
                             model: model,
-                            present: { model.present = $0 },
-                            configuration: configuration,
+                            present: {
+                                print("Done \($0)")
+                                
```

**File**: `Sources/Templates/Menu/Menu+UIKit.swift` (modified, +16/-20)
```diff
@@ -15,13 +15,10 @@ public extension Templates {
         // MARK: - Menu properties
 
         /// View model for the menu buttons.
-        var model = MenuModel()
+        var model: MenuModel
 
         /// View model for controlling menu gestures.
-        var gestureModel = MenuGestureModel()
-
-        /// Attributes that determine what the menu looks like.
-        public let configuration: MenuConfiguration
+        var gestureModel: MenuGestureModel
 
         /// The menu buttons.
         public let content: Content
@@ -51,8 +48,9 @@ public extension Templates {
 
             var configuration = MenuConfiguration()
             buildConfiguration(&configuration)
-            self.configuration = configuration
 
+            model = MenuModel(configuration: configuration)
+            gestureModel = MenuGestureModel()
             self.content = content()
             self.fadeLabel = fadeLabel
             super.init()
@@ -76,7 +74,6 @@ public extension Templates {
                     newDragLocation: location,
                     model: model,
                     labelFrame: sourceView.windowFrame(),
-                    configuration: configuration,
                     window: sourceView.window
                 ) { [weak self] present in
                     self?.updatePresent(present)
@@ -88,7 +85,6 @@ public extension Templates {
                     newDragLocation: location,
                     model: model,
                     labelFrame: sourceView.windowFrame(),
-                    configuration: configuration,
                     window: sourceView.window
                 ) { [weak self] present in
                     self?.updatePresent(present)
@@ -124,33 +120,33 @@ public extension Templates {
 
         /// Present the menu popover.
         func presentPopover() {
+            let configuration = model.configuration
             var popover = Popover { [weak self] in
                 if let self = self {
                     MenuView(
-                        model: self.model,
-                        present: { [weak self] present in
-                            self?.updatePresent(present)
-                        },
-                        configuration: self.configuration
-                    ) {
+                        model: self.model
+                    ) { [weak self] present in
+                        self?.updatePresent(present)
+                    } content: {
                         self.content
                     }
                 }
-            } background: { [weak self] in
-                if let self = self {
-                    self.configuration.backgroundColor
-                }
+            } background: {
+                configuration.backgroundColor
             }
 
             popover.attributes.sourceFrame = { [weak sourceView] in sourceView.windowFrame() }
-            popover.attributes.position = .absolute(originAnchor: configuration.originAnchor, popoverAnchor: configuration.popoverAnchor)
+            popover.attributes.position = .absolute(
+                originAnchor: configuration.originAnchor,
+                popoverAnchor: configuration.popoverAnchor
+            )
             popover.attributes.rubberBandingMode = .none
             popover.attributes.dismissal.excludedFrames = { [weak self] in
                 guard let self = self else { return [] }
                 return [
                     self.sourceView.windowFrame(),
                 ]
-                    + self.configuration.excludedFrames()
+                    + configuration.excludedFrames()
             }
             popover.attributes.sourceFrameInset = configuration.sourceFrameInset
 
```

**File**: `Sources/Templates/Menu/Menu.swift` (modified, +15/-16)
```diff
@@ -28,6 +28,7 @@ public extension Templates {
         public var backgroundColor = Color.clear /// A color that is overlaid over the entire screen, just underneath the menu.
         public var scaleRange = CGFloat(40) ... CGFloat(90) /// For rubber banding - the range at which rubber banding should be applied.
         public var minimumScale = CGFloat(0.7) /// For rubber banding - the scale the the popover should shrink to when rubber banding.
+        public var dismissAfterSelecting = true /// Dismiss the menu after selecting an item.
 
         /// Create the default attributes for the popover menu.
         public init(
@@ -46,7 +47,8 @@ public extension Templates {
             shadow: Shadow = .system,
             backgroundColor: Color = .clear,
             scaleRange: ClosedRange<CGFloat> = 30 ... 80,
-            minimumScale: CGFloat = 0.85
+            minimumScale: CGFloat = 0.85,
+            dismissAfterSelecting: Bool = true
         ) {
             self.holdDelay = holdDelay
             self.presentationAnimation = presentationAnimation
@@ -64,14 +66,14 @@ public extension Templates {
             self.backgroundColor = backgroundColor
             self.scaleRange = scaleRange
             self.minimumScale = minimumScale
+            self.dismissAfterSelecting = dismissAfterSelecting
         }
     }
 
     /// The popover that gets presented.
     internal struct MenuView<Content: View>: View {
         @ObservedObject var model: MenuModel
         let present: (Bool) -> Void
-        let configuration: MenuConfiguration
 
         /// The menu buttons.
         var content: Content
@@ -82,16 +84,17 @@ public extension Templates {
         init(
             model: MenuModel,
             present: @escaping (Bool) -> Void,
-            configuration: MenuConfiguration,
             @ViewBuilder content: () -> Content
         ) {
             self.model = model
             self.present = present
-            self.configuration = configuration
             self.content = content()
         }
 
         var body: some View {
+            /// Reference this here instead of repeating `model.configuration` over and over again.
+            let configuration = model.configuration
+
             PopoverReader { context in
                 content
 
@@ -107,6 +110,7 @@ public extension Templates {
                     .scaleEffect(expanded ? 1 : 0.2, anchor: configuration.scaleAnchor?.unitPoint ?? model.getScaleAnchor(from: context))
                     .scaleEffect(model.scale, anchor: configuration.scaleAnchor?.unitPoint ?? model.getScaleAnchor(from: context))
                     .simultaneousGesture(
+                        /// Handle gestures that started on the popover.
                         DragGesture(minimumDistance: 0, coordinateSpace: .global)
                             .onChanged { value in
                                 model.hoveringItemID = model.getItemID(from: value.location)
@@ -126,6 +130,8 @@ public extension Templates {
                                     }
                                 }
                             }
+
+                            /// Clicked (tap down, then lift) on a a selection
                             .onEnded { value in
                                 withAnimation {
                                     model.scale = 1
@@ -134,7 +140,8 @@ public extension Templates {
                                 let activeIndex = model.getItemID(from: value.location)
                                 model.selectedItemID = activeIndex
                                 model.hoveringItemID = nil
-                                if activeIndex != nil {
+
+                                if activeIndex != nil, model.configuration.dismissAfterSelecting {
                                     present(false)
                                 }
                             }
@@ -150,7 +157,7 @@ public extension Templates {
                             }
 
                             /// Clear frames once the menu is done presenting.
-                            model.frames = []
+                            model.frames = [:]
                         }
                         context.attributes.onContextChange = { context in
                             model.menuFrame = context.frame
@@ -184,16 +191,8 @@ public extension Templates {
 
                     /// Don't set frames when dismissing.
                     guard model.present else { return }
-                    let itemFrame = MenuItemFrame(itemID: itemID, frame: frame)
-
-                    /// If there's already a frame with the same ID, change it.
-                    let existingFrameIndex = model.frames.firstIndex { $0.itemID == itemID }
-                    if let existingFrameIndex = existingFrameIndex {
-                        model.frames[existingFrameIndex].frame = frame
-                    } else {
-                        /// Newest, most up-to-date frames are at the end.
-
```

**File**: `Sources/Templates/Menu/Model/MenuGestureModel.swift` (modified, +7/-4)
```diff
@@ -9,6 +9,8 @@
 import SwiftUI
 
 extension Templates {
+    /// Model for managing gestures that started on the source label.
+    /// Gestures that started on the popover itself are handled by `MenuView`.
     class MenuGestureModel: ObservableObject {
         /// If the user is pressing down on the label, this will be a unique `UUID`.
         @Published var labelPressUUID: UUID?
@@ -27,13 +29,15 @@ extension Templates {
             newDragLocation: CGPoint,
             model: MenuModel,
             labelFrame: CGRect,
-            configuration: MenuConfiguration,
             window: UIWindow?,
             present: @escaping ((Bool) -> Void),
             fadeLabel: @escaping ((Bool) -> Void)
         ) {
             dragLocation = newDragLocation
 
+            /// Reference this here instead of repeating `model.configuration` over and over again.
+            let configuration = model.configuration
+
             if model.present == false {
                 /// The menu is not yet presented.
                 if labelPressUUID == nil {
@@ -85,7 +89,6 @@ extension Templates {
             newDragLocation: CGPoint,
             model: MenuModel,
             labelFrame: CGRect,
-            configuration: MenuConfiguration,
             window: UIWindow?,
             present: @escaping ((Bool) -> Void),
             fadeLabel: @escaping ((Bool) -> Void)
@@ -118,7 +121,7 @@ extension Templates {
                     if labelFrame.contains(newDragLocation) {
                         present(true)
                     } else {
-                        withAnimation(configuration.labelFadeAnimation) {
+                        withAnimation(model.configuration.labelFadeAnimation) {
                             fadeLabel(false)
                         }
                     }
@@ -128,7 +131,7 @@ extension Templates {
                     model.hoveringItemID = nil
 
                     /// The user lifted their finger on a button.
-                    if selectedItemID != nil {
+                    if selectedItemID != nil, model.configuration.dismissAfterSelecting {
                         present(false)
                     }
                 }
```

---

### Incident Patch 12: `6723e193` (2022-04-29)
**Commit Message**: Fix #33, make menu animations faster

**File**: `Sources/PopoverUtilities.swift` (modified, +1/-7)
```diff
@@ -57,7 +57,7 @@ public extension View {
                             size(newValue)
                         }
                     }
-                    .onValueChange(of: transaction) { _, _ in
+                    .onValueChange(of: transaction?.animation) { _, _ in
                         DispatchQueue.main.async {
                             size(geometry.size)
                         }
@@ -68,12 +68,6 @@ public extension View {
     }
 }
 
-extension Transaction: Equatable {
-    public static func == (lhs: Transaction, rhs: Transaction) -> Bool {
-        lhs.animation == rhs.animation
-    }
-}
-
 struct ContentFrameReaderPreferenceKey: PreferenceKey {
     static var defaultValue: CGRect { return CGRect() }
     static func reduce(value: inout CGRect, nextValue: () -> CGRect) { value = nextValue() }
```

**File**: `Sources/Templates/Menu.swift` (modified, +5/-5)
```diff
@@ -12,8 +12,8 @@ public extension Templates {
     /// A set of attributes for the popover menu.
     struct MenuConfiguration {
         public var holdDelay = CGFloat(0.2) /// The duration of a long press to activate the menu.
-        public var presentationAnimation = Animation.spring(response: 0.4, dampingFraction: 0.7, blendDuration: 1)
-        public var dismissalAnimation = Animation.spring(response: 0.5, dampingFraction: 0.9, blendDuration: 1)
+        public var presentationAnimation = Animation.spring(response: 0.3, dampingFraction: 0.7, blendDuration: 1)
+        public var dismissalAnimation = Animation.spring(response: 0.4, dampingFraction: 0.9, blendDuration: 1)
         public var labelFadeAnimation = Animation.default /// The animation used when calling the `fadeLabel`.
         public var clipContent = true /// Replicate the system's default clipping animation.
         public var sourceFrameInset = UIEdgeInsets(top: -8, left: -8, bottom: -8, right: -8)
@@ -33,8 +33,8 @@ public extension Templates {
         /// Create the default attributes for the popover menu.
         public init(
             holdDelay: CGFloat = CGFloat(0.2),
-            presentationAnimation: Animation = .spring(response: 0.4, dampingFraction: 0.7, blendDuration: 1),
-            dismissalAnimation: Animation = .spring(response: 0.5, dampingFraction: 0.9, blendDuration: 1),
+            presentationAnimation: Animation = .spring(response: 0.3, dampingFraction: 0.7, blendDuration: 1),
+            dismissalAnimation: Animation = .spring(response: 0.4, dampingFraction: 0.9, blendDuration: 1),
             labelFadeAnimation: Animation = .easeOut,
             sourceFrameInset: UIEdgeInsets = .init(top: -8, left: -8, bottom: -8, right: -8),
             originAnchor: Popover.Attributes.Position.Anchor = .bottom,
@@ -302,7 +302,7 @@ public extension Templates {
                 .frame(width: configuration.width)
                 .fixedSize() /// Hug the width of the inner content.
                 .modifier(ClippedBackgroundModifier(context: context, configuration: configuration, expanded: expanded)) /// Clip the content if desired.
-                .scaleEffect(expanded ? 1 : 0.1, anchor: configuration.scaleAnchor?.unitPoint ?? model.getScaleAnchor(from: context))
+                .scaleEffect(expanded ? 1 : 0.2, anchor: configuration.scaleAnchor?.unitPoint ?? model.getScaleAnchor(from: context))
                 .scaleEffect(model.scale, anchor: configuration.scaleAnchor?.unitPoint ?? model.getScaleAnchor(from: context))
                 .simultaneousGesture(
                     DragGesture(minimumDistance: 0, coordinateSpace: .global)
```

#### Recent Merged Pull Requests:
- **PR #118** (2025-02-19): Create attribute changeLocationOnDismiss, which allows popover's location to be changed to its last location (@codeswift27)
- **PR #109** (closed): Couple updates (@aehlke)
- **PR #103** (2023-11-09): Added Track Attack to the apps using Popovers. (@adonikian)
- **PR #102** (closed): chore: fix arrowSidePadding (@obadasemary)
- **PR #99** (2023-09-26): Add AnyTracker to Apps Using Popovers (@shervinkoushan)
- **PR #91** (closed): Create codeql.yml (@ghost)
- **PR #90** (closed): Codespace ifahad3rs special doodle 4xpvp54wr64cjjx4 (@ghost)
- **PR #84** (2023-05-05): Re-add if os(iOS) to fix mac builds (@aehlke)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
