# Forensic Learning Record (Deep Inspection): exyte/PopupView

> **Canonical Artifact**: `07_PROJECT_LEARNING/exyte-popupview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/exyte/PopupView](https://github.com/exyte/PopupView))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:00:56.268Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `exyte/PopupView`
- **Description**: Toasts and popups library written with SwiftUI
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4060 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `PopupExample/PopupExample/Utils/ButtonsMatrix.swift`
```
//
//  ButtonsMatrix.swift
//  PopupExample
//
//  Created by Alisa Mylnikova on 29.05.2026.
//

import SwiftUI

struct ButtonsMatrix<LeftValue: Hashable, TopValue: Hashable, Cell: View>: View {

    let leftAxisTitle: String
    let leftAxisValues: [LeftValue]

    let topAxisTitle: String
    let topAxisValues: [TopValue]

    @ViewBuilder let cellBuilder: (LeftValue, TopValue) -> Cell

    @State private var cellSize: CGSize = .zero
    @State private var availableFrame: CGRect = .zero
    @State private var axisFrame: CGRect = .zero

    var body: some View {
        VStack(spacing: 10) {
            // top row
            HStack(spacing: 10) {
                Color.clear.frame(width: axisFrame.height)

                axisView(topAxisTitle, topAxisValues)
                    .frameGetter($axisFrame)
            }
            .fixedSize()

            // main row
            HStack(spacing: 10) {
                axisView(leftAxisTitle, leftAxisValues.reversed()) // -90 rotation turns them over
                    .fixedSize()
                    .frame(width: axisFrame.height, height: cellSize.width * 2)
                    .rotationEffect(.degrees(-90))

                tableView
                    .frame(maxWidth: .infinity)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frameGetter($availableFrame)
        .onChange(of: availableFrame) {
            let count = CGFloat(topAxisValues.count)
            let cellWidth = (availableFrame.width - axisFrame.height - 10) / count
            cellSize = CGSizeMake(cellWidth, cellWidth)
        }
    }

    func axisView<Value: Hashable>(_ title: String, _ values: [Value]) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.headline)

            HStack(spacing: 0) {
                ForEach(values, id: \.self) { value in
                    Text(String(describing: value))
                        .frame(width: cellSize.width)
                }
            }
        }
    }

    private var tableView: some View {
        ZStack {
            Rectangle()
                .stroke(.gray, lineWidth: 1)

            VStack(spacing: 0) {
                ForEach(0..<leftAxisValues.count - 1, id: \.self) { _ in
                    Spacer()
                    Rectangle().fill(.gray).frame(height: 1)
                    Spacer()
                }
            }

            HStack(spacing: 0) {
                ForEach(0..<topAxisValues.count - 1, id: \.self) { _ in
                    Spacer()
                    Rectangle().fill(.gray).frame(width: 1)
                    Spacer()
                }
            }

            VStack(spacing: 0) {
                ForEach(leftAxisValues, id: \.self) { leftValue in
                    HStack(spacing: 0) {
                        ForEach(topAxisValues, id: \.self) { topValue in
                            cellBuilder(leftValue, topValue)
                                .frame(width: cellSize.width, height: cellSize.height)
                        }
                    }
                }
            }
        }
    }
}

```

### Core Architecture Module: `PopupExample/PopupExample/Utils/ButtonsSwitcher.swift`
```
//
//  ButtonsSwitcher.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 20.05.2026.
//

import SwiftUI

protocol ButtonsEnum: CaseIterable, Sendable, RawRepresentable where RawValue == Int {
    var string: String { get }
}

extension ButtonsEnum {
    var string: String {
        "\(self)".capitalized
    }
}

struct ButtonsSwitcher<Enum: ButtonsEnum>: View {

    @Binding var selection: Enum
    var additionalActionClosure: ()->()

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<Enum.allCases.count, id: \.self) { i in
                Button(Enum.allCases[i as! Enum.AllCases.Index].string) {
                    if let tab = Enum(rawValue: i) {
                        additionalActionClosure()
                        withAnimation {
                            selection = tab
                        }
                    }
                }
                .padding(8, 4)
                .foregroundStyle(.white)
                .background {
                    RoundedRectangle(cornerRadius: 4)
                        .foregroundStyle(selection.rawValue == i ? Color(.skyBlue) : Color(.skyBlue).opacity(0.5))
                }
            }
        }
    }
}

```

### Core Architecture Module: `PopupExample/PopupExample/Utils/Utils.swift`
```
//
//  Utils.swift
//  Example
//
//  Created by Alisa Mylnikova on 10/06/2021.
//

import SwiftUI

@MainActor
struct ScreenUtils {
    static var bounds: CGRect {
#if os(watchOS)
        return WKInterfaceDevice.current().screenBounds
#elseif os(macOS)
        return NSApplication.shared.keyWindow?.frame
        ?? NSScreen.main?.frame
        ?? .zero
#else
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        return scene?.screen.bounds ?? .zero
#endif
    }

    static var width: CGFloat {
        bounds.width
    }

    static var height: CGFloat {
        bounds.height
    }
}

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgbValue: UInt64 = 0
        scanner.scanHexInt64(&rgbValue)
        
        let r = (rgbValue & 0xff0000) >> 16
        let g = (rgbValue & 0xff00) >> 8
        let b = rgbValue & 0xff
        
        self.init(red: Double(r) / 0xff, green: Double(g) / 0xff, blue: Double(b) / 0xff)
    }
}

extension View {

    func padding(_ horizontal: CGFloat, _ vertical: CGFloat) -> some View {
        self.padding(.horizontal, horizontal)
            .padding(.vertical, vertical)
    }

    @ViewBuilder
    func applyIf<V: View>(_ condition: Bool, apply: (Self) -> V) -> some View {
        if condition {
            apply(self)
        } else {
            self
        }
    }

    @ViewBuilder
    func applyIfNotNil<V: View, Value>(_ value: Value?, @ViewBuilder _ apply: (_ view: Self, Value) -> V) -> some View {
        if let value {
            apply(self, value)
        } else {
            self
        }
    }

    func shadowedStyle() -> some View {
        self
            .shadow(color: .black.opacity(0.08), radius: 2, x: 0, y: 0)
            .shadow(color: .black.opacity(0.16), radius: 24, x: 0, y: 0)
    }
    
    func customButtonStyle(
        foreground: Color = .black,
        background: Color = .white
    ) -> some View {
        self.buttonStyle(
            ExampleButtonStyle(
                foreground: foreground,
                background: background
            )
        )
    }

#if os(iOS)
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
#endif
}

@MainActor
extension Button {
    func blueStyle() -> some View {
        self.padding(8, 4)
            .foregroundStyle(.white)
            .background {
                RoundedRectangle(cornerRadius: 4)
                    .foregroundStyle(Color(.skyBlue))
            }
    }
}

// MARK: - FrameGetter

struct FrameGetter: ViewModifier {

    @Binding var frame: CGRect
    var id: String?

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy -> AnyView in
                    DispatchQueue.main.async {
                        let rect = proxy.frame(in: .global)
                        // This avoids an infinite layout loop
                        if rect.integral != self.frame.integral {
                            if let id {
                                print(id, self.frame, rect)
                            }
                            self.frame = rect
                        }
                    }
                    return AnyView(EmptyView())
                }
            )
    }
}

internal extension View {
    func frameGetter(_ frame: Binding<CGRect>, id: String? = nil) -> some View {
        modifier(FrameGetter(frame: frame, id: id))
    }
}

private struct ExampleButtonStyle: ButtonStyle {
    let foreground: Color
    let background: Color
    
    func makeBody(configuration: Self.Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.45 : 1)
            .foregroundColor(configuration.isPressed ? foreground.opacity(0.55) : foreground)
            .background(configuration.isPressed ? background.opacity(0.55) : background)
    }
}

#if os(iOS)
struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: UIRectCorner = .allCorners
    
    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(roundedRect: rect, byRoundingCorners: corners, cornerRadii: CGSize(width: radius, height: radius))
        return Path(path.cgPath)
    }
}
#endif

class Constants {
    static let privacyPolicy = """
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam consectetur orci eget rutrum dignissim. Vivamus aliquam a massa a scelerisque. Integer eleifend lectus non blandit ultricies. Maecenas volutpat neque ut elit facilisis sodales. Mauris et iaculis tellus. Etiam nec mi consequat, ornare quam in, ornare magna. Donec quis egestas nunc. Morbi vel orci leo. Suspendisse eget lectus a erat dignissim interdum et quis neque. Fusce dapibus rhoncus nulla. Cras sed ipsum congue, tempus mi nec, vestibulum lorem.

Mauris rutrum urna ex, eget bibendum lectus vehicula nec. Mauris quis porttitor sapien, id vestibulum nibh. Proin mi lectus, pretium sed nulla bibendum, fringilla dignissim lacus. Vestibulum eget ante quis urna facilisis tristique. Curabitur mollis cursus mauris, vitae sollicitudin lacus fermentum nec. Etiam accumsan venenatis feugiat. Curabitur vitae posuere quam, imperdiet mattis elit. Nulla sollicitudin non neque sed aliquet. Donec lobortis iaculis interdum.

Nam eu feugiat arcu. Suspendisse porta eu sapien et eleifend. Fusce viverra laoreet tellus, eget convallis odio. Vivamus eget mollis dui. Sed euismod sed justo in fermentum. Nam at augue convallis, vulputate ligula eu, convallis risus. Proin egestas pretium nibh, in blandit ipsum varius quis. Aenean dolor mauris, luctus vel consequat id, tristique sit amet sem. Donec at pulvinar sem. Mauris diam lacus, placerat eget dolor ac, hendrerit elementum velit.

Integer sagittis ultricies commodo. Nullam eu diam at justo ornare viverra. Praesent ante metus, rhoncus ac condimentum id, malesuada viverra arcu. Nunc porta, odio at elementum viverra, tortor sem placerat lacus, eget scelerisque turpis odio at nisl. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nulla varius luctus ex, eu sagittis leo tempor nec. Etiam viverra molestie iaculis. Fusce in cursus ipsum, et elementum metus. Nullam sed sodales ligula. Aliquam erat volutpat. Proin mattis nisi et lectus rutrum, quis aliquet metus aliquet. Nulla est nisi, condimentum sed pretium ac, scelerisque semper eros. Nullam varius diam at augue vehicula elementum eget a leo. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Etiam nisi enim, euismod ac tellus at, hendrerit dignissim turpis. Proin sit amet sapien posuere, facilisis velit quis, placerat purus.

Maecenas eget felis in lacus pharetra tristique. Nunc vehicula porttitor dolor, non viverra magna blandit sit amet. Phasellus et pellentesque ante, at sollicitudin leo. Etiam at quam nec ex rhoncus sagittis. Nullam tempor lectus id felis efficitur tempus eget eget lectus. Mauris vitae odio nisi. Fusce pellentesque mattis enim, vitae tincidunt nisl tempus sed. Sed et lacus vitae lectus pretium congue nec molestie odio. Phasellus nec libero ac enim consequat dapibus. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Morbi suscipit, urna vel elementum consequat, eros urna tempor nulla, vel mattis arcu ex quis nisl. Phasellus consequat porta lectus, eu tristique ipsum laoreet sit amet. Nam scelerisque ipsum sem, vitae sodales risus gravida in.

Maecenas felis velit, sodales ut diam vitae, sagittis aliquet neque. Duis tristique nisl at tristique hendrerit. Suspendisse sed egestas orci. Phasellus tempor cursus tellus, eget rhoncus justo mattis id. In a dapibus enim. Nulla eu neque tincidunt tellus finibus mattis. Mauris congue tellus vitae tortor laoreet accumsan.

Aenean iaculis porta consectetur. Vivamus tristique erat consectetur mi congue sollicitudin. Donec pellentesque, arcu pellentesque rhoncus vestibulum, massa diam vehicula nulla, non lacinia nunc lacus ut felis. Nam euismod finibus quam nec placerat. In imperdiet egestas sapien, sed elementum purus. Nullam interdum nisl fermentum ultrices elementum. Quisque eu mi sapien. Morbi vestibulum urna vel lacinia ultrices. Ut urna tortor, luctus in lorem eget, euismod volutpat magna. Etiam a accumsan massa. Fusce finibus blandit diam ac tincidunt. Nullam vitae dolor augue.

Maecenas maximus feugiat tellus sed vulputate. Proin ut ante vitae justo pulvinar laoreet. Donec fringilla justo consectetur mi consequat porttitor. Sed at mollis metus. Quisque at magna quis est malesuada aliquam sit amet at augue. Mauris hendrerit nunc ligula, in faucibus erat commodo quis. Nulla lacus dolor, cursus quis ligula eu, lacinia sollicitudin felis. Praesent odio tellus, pellentesque vitae leo ac, faucibus facilisis augue. Pellentesque bibendum nisl eget vehicula convallis. Maecenas velit urna, hendrerit quis nulla vitae, aliquam posuere erat. Integer accumsan sed arcu nec tempus. Etiam pharetra suscipit sapien id venenatis. Donec ultricies quis nisi vitae consectetur.
"""
}

```

### Core Architecture Module: `Sources/PopupView/Utils/DragToDismissHelper.swift`
```
//
//  DragToDismissHelper.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 28.05.2026.
//

#if !os(tvOS)

import SwiftUI

@MainActor
class DragToDismissHelper: ObservableObject {

    @Published var dragTranslation: CGSize = .zero

    @Binding var sheetContentRect: CGRect
    @Binding var isDragging: Bool
    @Binding var timeToHide: Bool

    var params: Popup.BasePopupParameters
    var appearFrom: Popup.AppearAnimation
    var shouldDismiss: ()->()

    var dragGesture: some Gesture {
        SimpleDragGesture { isDragging in
            self.isDragging = isDragging
            if !isDragging {
                self.onDragEnded()
            }
        } onTranslationChanged: {
            self.dragTranslation = self.limitToDismissDirection($0)
        }
    }

    init() {
        self._sheetContentRect = .constant(.zero)
        self._isDragging = .constant(false)
        self._timeToHide = .constant(false)

        self.params = Popup.BasePopupParameters()
        self.appearFrom = .none
        self.shouldDismiss = { }
    }

    func configure(
        sheetContentRect: Binding<CGRect>,
        isDragging: Binding<Bool>,
        timeToHide: Binding<Bool>,
        params: Popup.BasePopupParameters,
        appearFrom: Popup.AppearAnimation,
        shouldDismiss: @escaping () -> Void
    ) {
        self._sheetContentRect = sheetContentRect
        self._isDragging = isDragging
        self._timeToHide = timeToHide

        self.params = params
        self.appearFrom = appearFrom
        self.shouldDismiss = shouldDismiss
    }

    /// Clears the drag offset left by a completed drag dismissal.
    func resetDragTranslation() {
        dragTranslation = .zero
    }

    func limitToDismissDirection(_ translation: CGSize) -> CGSize {
        switch appearFrom {
        case .topSlide:
            if translation.height < 0 {
                return CGSize(width: 0, height: translation.height)
            }
        case .bottomSlide:
            if translation.height > 0 {
                return CGSize(width: 0, height: translation.height)
            }
        case .leftSlide:
            if translation.width < 0 {
                return CGSize(width: translation.width, height: 0)
            }
        case .rightSlide:
            if translation.width > 0 {
                return CGSize(width: translation.width, height: 0)
            }
        case .centerScale, .none:
            return .zero
        }
        return .zero
    }

    private func onDragEnded() {
        isDragging = false

        var referenceX = sheetContentRect.width / 3
        var referenceY = sheetContentRect.height / 3

        if let dragToDismissDistance = params.dragToDismissDistance {
            referenceX = dragToDismissDistance
            referenceY = dragToDismissDistance
        }

        var shouldDismiss = false
        switch appearFrom {
        case .topSlide:
            if dragTranslation.height < -referenceY {
                shouldDismiss = true
            }
        case .bottomSlide:
            if dragTranslation.height > referenceY {
                shouldDismiss = true
            }
        case .leftSlide:
            if dragTranslation.width < -referenceX {
                shouldDismiss = true
            }
        case .rightSlide:
            if dragTranslation.width > referenceX {
                shouldDismiss = true
            }
        case .centerScale, .none:
            break
        }

        if timeToHide { // autohide timer was finished while the user was dragging
            timeToHide = false
            shouldDismiss = true
        }

        if params.dismissEnabled.wrappedValue, shouldDismiss {
            self.shouldDismiss()
        } else {
            withAnimation {
                dragTranslation = .zero
            }
        }
    }
}

struct SimpleDragGesture: Gesture {

    var onDraggingChanged: (Bool) -> () // drag started/finished
    var onTranslationChanged: (CGSize) -> ()

    @GestureState private var gestureTranslation: CGSize = .zero
    @State private var isDragging = false

    var body: some Gesture {
        DragGesture(coordinateSpace: .global)
            .updating($gestureTranslation) { value, state, _ in
                state = value.translation

                DispatchQueue.main.async {
                    onTranslationChanged(value.translation)
                }
            }
            .onChanged { _ in
                if !isDragging {
                    isDragging = true
                    onDraggingChanged(true)
                }
            }
            .onEnded { value in
                onTranslationChanged(value.translation)
                onDraggingChanged(false)
            }
    }
}

#endif

```

### Core Architecture Module: `Sources/PopupView/Utils/KeyboardHeightHelper.swift`
```
//
//  KeyboardHeightHelper.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 29.05.2026.
//

import SwiftUI

#if os(iOS)

@MainActor
class KeyboardHeightHelper: ObservableObject {

    @Published var keyboardHeight: CGFloat = 0
    @Published var keyboardDisplayed: Bool = false

    init() {
        NotificationCenter.default.addObserver(self, selector: #selector(onKeyboardWillShowNotification), name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(onKeyboardWillHideNotification), name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func onKeyboardWillShowNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let keyboardRect = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }

        DispatchQueue.main.async {
            self.keyboardHeight = keyboardRect.height
            self.keyboardDisplayed = true
        }
    }

    @objc private func onKeyboardWillHideNotification(_ notification: Notification) {
        DispatchQueue.main.async {
            self.keyboardHeight = 0
            self.keyboardDisplayed = false
        }
    }
}

#else

class KeyboardHeightHelper: ObservableObject {

    @Published var keyboardHeight: CGFloat = 0
    @Published var keyboardDisplayed: Bool = false
}

#endif

```

### Core Architecture Module: `Sources/PopupView/Utils/ScrollPopupModifier.swift`
```
//
//  ScrollPopupModifier.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 28.05.2026.
//

#if os(iOS)

import SwiftUI
import UIKit

struct ScrollPopupModifier: ViewModifier {

    @ObservedObject var dragToDismissManager: DragToDismissHelper
    @Binding var sheetContentRect: CGRect
    var scrollParams: Popup.ScrollPopupParameters
    var shouldDismiss: (CGFloat)->()

    @StateObject private var scrollViewDelegate = PopupScrollViewDelegate()

    @State private var scrollViewContentHeight = 0.0
    @State private var needsScrollToFit = false

    /// Once scroll's content reaches 0 offset, the same drag gesture becomes popup's dismissal gesture: this is the dismissal progress offset
    /// NOTE: This is a separate drag to dismiss gesture and offset from dragToDismissManager
    @State private var dragToDismissOffset: CGFloat = 0

    private var contentPadding: EdgeInsets {
        guard scrollViewContentHeight != 0 else { return .init() }

        switch scrollParams.position {
        case .bottom(let topPadding):
            return .init(top: topPadding, leading: 0, bottom: 0, trailing: 0)

        case .center(let verticalPadding):
            return .init(
                top: verticalPadding,
                leading: 0,
                bottom: verticalPadding,
                trailing: 0
            )
        }
    }

    public func body(content: Content) -> some View {
        VStack(spacing: -0.5) {
            if scrollViewContentHeight != 0 {
                AnyView(scrollParams.headerView())
                    .fixedSize(horizontal: false, vertical: true)
                    .applyIf(scrollParams.dragToDismiss) {
                        $0.simultaneousGesture(dragToDismissManager.dragGesture)
                    }
            }

            ScrollView {
                content
                    .background(
                        ScrollViewResolver { scrollView in
                            scrollView.bounces = false
                            configureScrollHeight(scrollView: scrollView)
                        }
                    )
                    .applyIf(scrollParams.dragToDismiss && !needsScrollToFit) {
                        // if there is no scroll, there will be no scroll's UIPan gesture, so attach this one
                        $0.simultaneousGesture(dragToDismissManager.dragGesture)
                    }
            }
            .frame(maxHeight: scrollViewContentHeight)
        }
        .padding(contentPadding)
        .offset(y: dragToDismissOffset)
        .offset(dragToDismissManager.dragTranslation)
    }

    private func configureScrollHeight(scrollView: UIScrollView) {
        scrollViewContentHeight = scrollView.contentSize.height

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            needsScrollToFit = scrollView.bounds.height < scrollViewContentHeight
            if scrollParams.dragToDismiss, needsScrollToFit {
                configureScrollDelegate(scrollView: scrollView)
            }
        }
    }

    private func configureScrollDelegate(scrollView: UIScrollView) {
        scrollViewDelegate.setScrollView(scrollView)

        scrollViewDelegate.onDragChanged = { value in
            dragToDismissOffset = value
        }

        let referenceY = sheetContentRect.height / 3
        scrollViewDelegate.onDragEnded = { value in
            if scrollParams.dragToDismiss && value >= referenceY {
                // consolidate the live drag offset into the shared hide animation so it only
                // covers the remaining distance, instead of stacking on top of a full-length one
                dragToDismissOffset = 0
                shouldDismiss(value)
            } else {
                withAnimation {
                    dragToDismissOffset = .zero
                }
            }
        }
        scrollView.bounces = false
    }
}

@MainActor
final class PopupScrollViewDelegate: ObservableObject {
    var onDragChanged: (Double) -> Void = {_ in }
    var onDragEnded: (Double) -> Void = {_ in }

    private var scrollView: UIScrollView?
    private var initialTranslation: CGPoint?

    func setScrollView(_ scrollView: UIScrollView) {
        self.scrollView = scrollView
        scrollView.bounces = false

        guard let gestures = scrollView.gestureRecognizers else { return }
        let panGesture = gestures.compactMap({ $0 as? UIPanGestureRecognizer }).first
        panGesture?.addTarget(self, action: #selector(handlePan))
    }

    @objc
    func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: scrollView)
        let contentOffset = scrollView?.contentOffset.y ?? 0

        // Once scroll's content reaches 0 offset, the same drag gesture becomes popup's dismissal gesture

        // preserve translation at the moment when scroll's content reaches 0 offset
        // from now on translation doesn't influnce scroll's contentOffset, but is passed to dismiss mechanism
        if contentOffset == 0, initialTranslation == nil {
            initialTranslation = translation
        }

        // if user scroll back to where dismissal started, start passing translation back to contentOffset and reset dismissal progress
        if let initialTranslation, translation.y < initialTranslation.y {
            self.initialTranslation = nil
            onDragChanged(0)
        }

        // non-nil initialTranslation means that dismissal is in progress, pass it to dismiss mechanism
        if let initialTranslation {
            onDragChanged(translation.y - initialTranslation.y)
        }

        if gesture.state == .ended, let initialTranslation {
            onDragEnded(translation.y - initialTranslation.y)
            self.initialTranslation = nil
        }
    }
}

#endif

```

### Core Architecture Module: `Sources/PopupView/Utils/ScrollViewResolver.swift`
```
//
//  ScrollViewResolver.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 24.07.2026.
//

import SwiftUI

#if os(iOS)
struct ScrollViewResolver: UIViewRepresentable {
    var onResolve: (UIScrollView) -> Void

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        DispatchQueue.main.async {
            if let scrollView = view.enclosingScrollView() {
                onResolve(scrollView)
            }
        }
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

extension UIView {
    func enclosingScrollView() -> UIScrollView? {
        var view = self.superview
        while view != nil {
            if let scroll = view as? UIScrollView {
                return scroll
            }
            view = view?.superview
        }
        return nil
    }
}
#endif

```

### Core Architecture Module: `Sources/PopupView/Utils/TransparentNonAnimatableFullScreenModifier.swift`
```
//
//  TransparentNonAnimatableFullScreenModifier.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 29.05.2026.
//

import SwiftUI

#if os(iOS)

extension View {

    func transparentNonAnimatingFullScreenCover<Content: View>(
        isPresented: Binding<Bool>,
        dismissSource: Popup.DismissSource?,
        userDismissCallback: @escaping (Popup.DismissSource) -> (),
        content: @escaping () -> Content) -> some View {
            modifier(TransparentNonAnimatableFullScreenModifier(isPresented: isPresented, dismissSource: dismissSource, userDismissCallback: userDismissCallback, fullScreenContent: content))
        }
}

private struct TransparentNonAnimatableFullScreenModifier<FullScreenContent: View>: ViewModifier {

    @Binding var isPresented: Bool
    var dismissSource: Popup.DismissSource?
    var userDismissCallback: (Popup.DismissSource) -> ()
    let fullScreenContent: () -> (FullScreenContent)

    func body(content: Content) -> some View {
        content
            .onChange(of: isPresented) {
                UIView.setAnimationsEnabled(false)
            }
            .fullScreenCover(isPresented: $isPresented) {
                ZStack {
                    fullScreenContent()
                }
                .background(FullScreenCoverBackgroundRemovalView())
                .onAppear {
                    if !UIView.areAnimationsEnabled {
                        UIView.setAnimationsEnabled(true)
                    }
                }
                .onDisappear {
                    userDismissCallback(dismissSource ?? .binding)
                    if !UIView.areAnimationsEnabled {
                        UIView.setAnimationsEnabled(true)
                    }
                }
            }
    }
}

private struct FullScreenCoverBackgroundRemovalView: UIViewRepresentable {

    private class BackgroundRemovalView: UIView {
        override func didMoveToWindow() {
            super.didMoveToWindow()
            superview?.superview?.backgroundColor = .clear
        }
    }

    func makeUIView(context: Context) -> UIView {
        return BackgroundRemovalView()
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

#endif

```

### Core Architecture Module: `Sources/PopupView/Utils/Utils.swift`
```
//
//  Utils.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 01.06.2022.
//  Copyright © 2022 Exyte. All rights reserved.
//

import SwiftUI
import Combine
import Foundation

@MainActor
struct ScreenUtils {
    static var bounds: CGRect {
#if os(watchOS)
        return WKInterfaceDevice.current().screenBounds
#elseif os(macOS)
        return NSApplication.shared.keyWindow?.frame
        ?? NSScreen.main?.frame
        ?? .zero
#else
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        return scene?.screen.bounds ?? .zero
#endif
    }
    
    static var width: CGFloat {
        bounds.width
    }
    
    static var height: CGFloat {
        bounds.height
    }
    
#if os(iOS) || os(tvOS)
    static var safeAreaInsets: UIEdgeInsets {
        UIApplication.shared
            .connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?
            .keyWindow?
            .safeAreaInsets ?? .zero
    }
#else
    static var safeAreaInsets: NSEdgeInsets {
        return NSEdgeInsets()
    }
#endif
}

extension CGPoint {

    @MainActor
    static var pointFarAwayFromScreen: CGPoint {
        CGPoint(x: 2 * ScreenUtils.width, y: 2 * ScreenUtils.height)
    }
}

final class DispatchWorkHolder {
    var work: DispatchWorkItem?
}

final class ClassReference<T> {
    var value: T

    init(_ value: T) {
        self.value = value
    }
}

extension View {
    @ViewBuilder
    func applyIf<T: View>(_ condition: Bool, apply: (Self) -> T) -> some View {
        if condition {
            apply(self)
        } else {
            self
        }
    }

    @ViewBuilder
    func applyIfNotNil<V: View, Value>(_ value: Value?, @ViewBuilder _ apply: (_ view: Self, Value) -> V) -> some View {
        if let value {
            apply(self, value)
        } else {
            self
        }
    }

    @ViewBuilder
    func applyIfNotNil<V: View, Value>(_ value: Value?, if condition: (_ value: Value) -> Bool, @ViewBuilder apply: (_ view: Self) -> V) -> some View {
        if let value, condition(value) {
            apply(self)
        } else {
            self
        }
    }

    @ViewBuilder
    func applyIfNotTV<V: View>(if condition: Bool, @ViewBuilder _ apply: (_ view: Self) -> V) -> some View {
#if os(tvOS)
        self
#else
        if condition {
            apply(self)
        } else {
            self
        }
#endif
    }

    @ViewBuilder
    func addTapIfNotTV(if condition: Bool, onTap: @escaping ()->()) -> some View {
#if os(tvOS)
        self
#else
        if condition {
            self.gesture(
                TapGesture().onEnded {
                    onTap()
                }
            )
        } else {
            self
        }
#endif
    }
}

// MARK: - FrameGetter

struct FrameGetter: ViewModifier {

    @Binding var frame: CGRect
    var id: String?

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy -> AnyView in
                    DispatchQueue.main.async {
                        let rect = proxy.frame(in: .global)
                        // This avoids an infinite layout loop
                        if rect.integral != self.frame.integral {
                            if let id {
                                print(id, self.frame, rect)
                            }
                            self.frame = rect
                        }
                    }
                    return AnyView(EmptyView())
                }
            )
    }
}

internal extension View {
    func frameGetter(_ frame: Binding<CGRect>, id: String? = nil) -> some View {
        modifier(FrameGetter(frame: frame, id: id))
    }
}

// MARK: - Orientation change

#if os(iOS)

@MainActor
extension View {
    func onOrientationChange(isLandscape: Binding<Bool>, onOrientationChange: @escaping () -> Void) -> some View {
        self.modifier(OrientationChangeModifier(isLandscape: isLandscape, onOrientationChange: onOrientationChange))
    }
}

@MainActor
struct OrientationChangeModifier: ViewModifier {
    @Binding var isLandscape: Bool
    let onOrientationChange: () -> Void

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default
                .publisher(for: UIDevice.orientationDidChangeNotification)
                .receive(on: DispatchQueue.main)
            ) { _ in
                updateOrientation()
            }
            .onChange(of: isLandscape) {
                onOrientationChange()
            }
    }

    private func updateOrientation() {
        let newIsLandscape = UIDevice.current.orientation.isLandscape
        if newIsLandscape != isLandscape {
            isLandscape = newIsLandscape
            onOrientationChange()
        }
    }
}

#endif

```

### Core Architecture Module: `Sources/PopupView/Utils/WindowManager.swift`
```
//
//  HostingParentController.swift
//  PopupView
//
//  Created by Alisa Mylnikova on 02.06.2025.
//

import SwiftUI

#if os(iOS)

@MainActor
final class WindowManager {
    static let shared = WindowManager()
    private var entries: [UUID: Entry] = [:]
    
    private struct Entry {
        let window: UIWindow
        let controller: UIViewController
        private let rootViewUpdater: @MainActor (Any) -> Void

        init<Content: View>(window: UIWindow, controller: UIHostingController<Content>) {
            self.window = window
            self.controller = controller
            self.rootViewUpdater = { @MainActor newContent in
                guard let content = newContent as? Content else {
                    assertionFailure("Content type mismatch")
                    return
                }
                controller.rootView = content
            }
        }

        @MainActor func updateRootView<Content: View>(_ content: Content) {
            rootViewUpdater(content)
        }
    }

    // Show a new window with hosted SwiftUI content
    static func showInNewWindow<Content: View>(
        id: UUID,
        closeOnTapOutside: Bool,
        allowTapThroughBG: Bool,
        becomesKeyWindow: Bool = true,
        dismissClosure: @escaping SendableClosure,
        content: @escaping () -> Content
    ) {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
            print("No valid scene available")
            return
        }

        let window = UIPassthroughWindow(
            windowScene: scene,
            closeOnTapOutside: closeOnTapOutside,
            isPassthrough: allowTapThroughBG,
            canBecomeKey: becomesKeyWindow,
            dismissClosure: dismissClosure
        )

        window.backgroundColor = .clear

        let rootView = content()
            .environment(\.popupDismiss, dismissClosure)

        let controller = UITextFieldCheckingVC(rootView: rootView)

        controller.view.backgroundColor = .clear
        window.rootViewController = controller
        window.windowLevel = .alert + 1

        // `makeKeyAndVisible()` transfers key window (and first responder / keyboard) status
        // away from whatever window currently holds it. For transient, non-interactive popups
        // (toasts) this steals the keyboard from a focused text field in the presenting window.
        // Only become key when the popup actually needs it (e.g. it hosts its own text input).
        if becomesKeyWindow {
            window.makeKeyAndVisible()
        } else {
            window.isHidden = false
        }

        // Store window and controller reference
        shared.entries[id] = Entry(window: window, controller: controller)
    }

    static func updateRootView<Content: View>(
        id: UUID,
        dismissClosure: @escaping () -> (),
        content: @escaping () -> Content
    ) {
        guard let entry = shared.entries[id] else { return }

        let rootView = content()
            .environment(\.popupDismiss) {
                dismissClosure()
            }
        entry.updateRootView(rootView)
    }

    static func closeWindow(id: UUID) {
        shared.entries[id]?.window.isHidden = true
        shared.entries.removeValue(forKey: id)
    }
}

class UIPassthroughWindow: UIWindow {
    var closeOnTapOutside: Bool
    var isPassthrough: Bool
    var dismissClosure: SendableClosure?
    /// When `false`, this window will never become the key window (see `makeKeyAndVisible`
    /// usage in `WindowManager`), so it can't steal first responder / keyboard status from
    /// whatever window currently has it.
    private let allowsBecomingKey: Bool

    init(windowScene: UIWindowScene, closeOnTapOutside: Bool, isPassthrough: Bool, canBecomeKey: Bool = true, dismissClosure: SendableClosure?) {
        self.closeOnTapOutside = closeOnTapOutside
        self.isPassthrough = isPassthrough
        self.allowsBecomingKey = canBecomeKey
        self.dismissClosure = dismissClosure
        super.init(windowScene: windowScene)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var canBecomeKey: Bool {
        allowsBecomingKey
    }

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let vc = rootViewController else {
            return nil
        }
        vc.view.layoutIfNeeded() // otherwise the frame is as if the popup is still outside the screen

        for subview in vc.view.subviews {
            if classNameContains(subview, "PopupHitRegion"),
               subview.frame.contains(point) {
                return vc.view // let UIKit pass this touch to wrapped SwiftUI view in regular manner
            }
        }

        // here we know the tap was outside the actual popup's body, meaning the background was tapped

        if closeOnTapOutside {
            dismissClosure?()
        }

        if isPassthrough {
            return nil // pass to next window
        }
        return vc.view
    }

    private func classNameContains(_ view: UIView, _ string: String) -> Bool {
        String(describing: view.self).contains(string)
    }
}

final class BGHitRegionView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        true
    }
}

struct BGHitRegion: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        BGHitRegionView()
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}


final class PopupHitRegionView: UIView {
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        true
    }
}

struct PopupHitRegion: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        PopupHitRegionView()
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

class UITextFieldCheckingVC<Content: View>: UIHostingController<Content> {

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        // manually force open the keyboard for text fields — a secondary window's UIHostingController
        // doesn't always pick up the tap on its own; this is a harmless no-op when it already did
        checkForTextFields(touches)
    }

    private func checkForTextFields(_ touches: Set<UITouch>) {
        guard let touch = touches.first else { return }
        let touchLocation = touch.location(in: self.view)
        findAndFocusTextField(in: self.view, touchLocation: touchLocation)
    }

    @discardableResult
    private func findAndFocusTextField(in view: UIView, touchLocation: CGPoint) -> Bool {
        for subview in view.subviews {
            let localPoint = subview.convert(touchLocation, from: self.view)
            if subview.isUserInteractionEnabled, subview.frame.contains(localPoint), let textField = subview as? UITextField {
                textField.becomeFirstResponder()
                return true
            }
            if !subview.subviews.isEmpty, findAndFocusTextField(in: subview, touchLocation: touchLocation) {
                return true
            }
        }
        return false
    }
}
#endif

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "PopupView",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .tvOS(.v17),
        .watchOS(.v10)
    ],
    products: [
        .library(name: "PopupView", targets: ["PopupView"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "PopupView",
            dependencies: [],
            swiftSettings: [
              .enableExperimentalFeature("StrictConcurrency")
            ]
        )
    ]
)

```

### Core Architecture Module: `PopupExample/PopupExample/BGTapsExamplesView.swift`
```
//
//  BGTapsExamples.swift
//  PopupExample
//
//  Created by Alisa Mylnikova on 18.05.2026.
//

import SwiftUI
import PopupView

struct BGTapsExamplesView: View {

    private let values = [false, true]

    var body: some View {
        VStack {
            Button("Tap me") {
                print("I've been tapped")
            }
            .blueStyle()
            .padding(.bottom, 80)

            ButtonsMatrix(leftAxisTitle: "closeOnTapOutside", leftAxisValues: values, topAxisTitle: "allowTapThroughBG", topAxisValues: values) { closeOnTapOutside, allowTapThroughBG in
                VStack {
                    ForEach([Popup.DisplayMode.window, .sheet, .overlay]) { mode in
                        if mode == .overlay, allowTapThroughBG, closeOnTapOutside {
                            // .overlay can't allow taps through while also detecting them for popup dismiss
                            EmptyView()
                        }
                        else if mode == .sheet, allowTapThroughBG {
                            // .sheet can't allow taps through
                            EmptyView()
                        }
                        else {
                            BGTapsPopupShowingButton(mode: mode, closeOnTapOutside: closeOnTapOutside, allowTapThroughBG: allowTapThroughBG)
                        }
                    }
                }
            }

            Spacer()
        }
        .padding(30)
    }
}

struct BGTapsPopupShowingButton: View {
    var mode: Popup.DisplayMode
    var closeOnTapOutside: Bool
    var allowTapThroughBG: Bool

    @State private var show: Bool = false

    var body: some View {
        Button {
            show = true
        } label: {
            Text(String(describing: mode).capitalized)
                .foregroundStyle(.black)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background {
                    RoundedRectangle(cornerRadius: 6)
                        .foregroundStyle(.white)
                        .shadow(radius: 2, x: 1, y: 2)
                }
        }
        .popup(isPresented: $show) {
            if mode != .overlay {
                BGTapsExamplePopup(mode: mode, closeOnTapOutside: closeOnTapOutside, allowTapThroughBG: allowTapThroughBG)
            } else {
                Rectangle()
                    .foregroundStyle(Color(.skyBlue))
                    .cornerRadius(3)
                    .frame(width: 20, height: 20)
            }
        } customize: {
            $0
                .displayMode(mode)
                .appearFrom(.centerScale)
                .closeOnTap(mode == .overlay)
                .closeOnTapOutside(closeOnTapOutside)
                .allowTapThroughBG(allowTapThroughBG)
        }
    }
}

struct BGTapsExamplePopup: View {
    @Environment(\.popupDismiss) var dismiss
    var mode: Popup.DisplayMode
    var closeOnTapOutside: Bool
    var allowTapThroughBG: Bool

    var body: some View {
        VStack(spacing: 12) {
            VStack {
                Text(String(describing: mode).capitalized)
                    .font(.system(size: 20))
                Text("closeOnTapOutside: \(String(describing: closeOnTapOutside))")
                Text("allowTapThroughBG: \(String(describing: allowTapThroughBG))")
            }
            .font(.system(size: 16))
            .foregroundColor(.black)
            .padding()

            Button {
                dismiss?()
            } label: {
                Text("Thanks")
                    .font(.system(size: 18, weight: .bold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .padding(.horizontal, 24)
                    .foregroundColor(.white)
                    .background(Color(hex: "9265F8"))
                    .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
        .padding(EdgeInsets(top: 37, leading: 24, bottom: 40, trailing: 24))
        .background(Color.white.cornerRadius(20))
        .frame(width: ScreenUtils.width - 120)
        .shadowedStyle()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #299** (2026-09-22): **Fix macOS popup drag dismissal state**
  *Symptoms*: - Prevent the popup from bouncing before closing when dismissed by dragging. - Clear stale drag offsets after the dismissal animation completes. - Reset presentation state when reopening a popup. - Fix an issue where reopening a popup could show only the background blur while the content remained off-screen.
  **Post-Mortem & Fix Analysis**:
  > Hey @Corotata, thank you for the PR, have a wonderful day!

- **Issue #298** (2026-07-30): **The new version fails to compile on macOS**
  *Symptoms*:   <img width="923" height="817" alt="Image" src="https://github.com/user-attachments/assets/362d1a88-75a4-4a21-a6c1-d70d495511de" />
  **Post-Mortem & Fix Analysis**:
  > Hey @lexrus, please check out version 5.0.5, have a great day!

- **Issue #297** (2026-07-29): **Add becomesKeyWindow option to avoid stealing keyboard from presenting .window mode**
  *Symptoms*: ## Bug: `.displayMode(.window)` steals keyboard focus from the presenting screen  ### Problem  https://github.com/user-attachments/assets/974d0c9d-6619-4678-9169-813573925c51   When a popup is shown with `.displayMode(.window)` while a text field is focused on the screen behind it, the keyboard is dismissed as soon as the popup appears, and then reappears once the popup is dismissed.  This is especially noticeable for transient, non-interactive popups like toasts/snackbars — showing a toast while the user is typing in a text field causes the keyboard to flicker (hide → show), which is a jarring UX regression and breaks scenarios like "show a validation toast while the user keeps typing".  Related reports of the same underlying `UIWindow`/key-window behavior with `UIAlertController`: - https://stackoverflow.com/questions/28564710/keep-keyboard-on-when-uialertcontroller-is-presented-in-swift - https://www.reddit.com/r/iOSProgramming/comments/8yeeol/is-there-a-way-to-prevent-the-keyboard-from-being/  ### Root cause  `WindowManager.showInNewWindow(...)` unconditionally calls:  ```swift window.makeKeyAndVisible() ```  `makeKeyAndVisible()` always transfers key-window (and, with it, first-responder / keyboard) status to the new window — even when the popup itself has no interactive content and never needs to become key. Since the previous key window loses that status, whatever text field was focused there loses first responder, and the keyboard is dismissed. 
  **Post-Mortem & Fix Analysis**:
  > when apply fix you see it's work correctly    https://github.com/user-attachments/assets/ee77373e-7c0a-49ac-9dd5-71825158671e   
  > Hey @dmtrbbrv, thank you so much for this fix and the explanation! Have an amazing day!

- **Issue #296** (2026-07-15): **macos == > UIKit-- UIEdgeInsets**
  *Symptoms*:     macos == > UIKit-- UIEdgeInsets ` static var safeAreaInsets: UIEdgeInsets { #if os(iOS) || os(tvOS)         UIApplication.shared             .connectedScenes             .compactMap { $0 as? UIWindowScene }             .first?             .keyWindow?             .safeAreaInsets ?? .zero #else         return .zero #endif`
  **Post-Mortem & Fix Analysis**:
  > Sorry, I didn't get this. Please explain more, have a nice day
  > macOS using AppKit ; code written with UIKit will fail to compile on macOS.
  > Check out 5.0.3

- **Issue #295** (2026-06-16): **Cannot find 'popupViewBackground' in scope**
  *Symptoms*: **Environment** - PopupView: 5.0.0 and 5.0.1 (both affected) - Xcode: 26.5 (Build 17F42) - Swift: 6.3.2 - Platform: iOS  **Error** Build fails with:    PopupModifier.swift:242:13: Cannot find 'popupViewBackground' in scope  **Root cause** `popupViewBackground()` is called twice in `Sources/PopupView/PopupModifier.swift`  (lines 230 and 242) but no function with that name is defined anywhere in the package:    grep -rn "func popupViewBackground" Sources/   → no results  The function appears to have been removed or renamed during the 5.x rewrite  without updating the call sites in `PopupModifier.swift`.  **Workaround** Pinning to 4.2.2 (the last working 4.x release) unblocks the build. The 4.x API is source-compatible for basic `.popup` usage.
  **Post-Mortem & Fix Analysis**:
  > Hey @GheberEl, I only found this problem inside #elseif os(macOS) || os(tvOS), it compiles normally on ios for me. Please let me know if it's still an issue for you on ios, have a nice day

- **Issue #294** (2026-06-16): **Update AuthWebViewController to avoid UIScreen.main on iOS 26**
  *Symptoms*: ### Description  Apple's WWDC26 session “Modernize your UIKit app” recommends avoiding global main-screen references. In scene-based apps, especially with iPhone Mirroring, external displays, and multi-window setups, `UIScreen.main` may not represent the display where current UI is running.  `PopupView/Sources/Utils.swift` currently uses `UIScreen.main` on line 23. Please update this usage to follow scene-based UIKit geometry guidance.  ### Reference  Apple WWDC26: “Modernize your UIKit app”   https://developer.apple.com/videos/play/wwdc2026/278/
  **Post-Mortem & Fix Analysis**:
  > Hey @OliverChoi-iOS, updated to use UIApplication.shared.connectedScenes, hope this is what you meant, have a nice day

- **Issue #293** (2026-06-04): **dragToDismiss and scrollView conflict in Popup Middle**
  *Symptoms*: Hello creators of the best Popup library!  When I have a ScrollView in the Middle Screen Popup on the iPad with a .dragToDismiss(true) - there is a conflict. A video shows it better:  https://github.com/user-attachments/assets/9134bdff-dc07-4e8a-9117-5d77ce90c8c6  Here is the basic code: ```Swift .popup(isPresented: $popups.showingMiddle) { 	MyPopupMiddle() } customize: { 	$0 		.closeOnTap(false) 		.backgroundColor(.black.opacity(0.4)) } ``` I've used Form here for prettiness, but a basic ScrollView behaves the same. ```Swift struct MyPopupMiddle: View {     var body: some View {         Form {             Section {                 Text("""                     In the kingdom of Swift, where the view trees grow,                     And constraints throw tantrums developers know,                     There lived a fine library, clever and spry,                     Called PopupView, floating gracefully by.                                          Forged by Exyte’s engineers with precision and flair,                     It summoned popups from seemingly nowhere.                     From the bottom, the center, the top with delight,                     Appearing so smoothly, it felt almost right.                                          No wrestling with UIKit deep in the night,                     No mysterious offsets refusing to bite.                     Just a modifier here and a closure or two,                     And a popup emerged like morning dew!                          
  **Post-Mortem & Fix Analysis**:
  > Hey @BredBurr, thank you for your kind words! I added position to scroll popup modifier params, so please use like this  ``` .scrollPopup(isPresented: $show) {     MyPopupMiddle() } header: {     // if needed, or remove this closure } customize: {     $0         .position(.center(200))         .dragToDismiss(dragToDismiss) } ```  Generally speaking, there is no way for the lib to avoid this pan gestures conflict. If you add your own scroll and set .dragToDismiss to true, there will be 2 pan gestures. scrollPopup adds the scroll for you, so the lib can control it somewhat, and check if it needs to actually add dragToDismiss, or just reuse scroll's pan.  scrollPopup is usually auto-sizing its scrollView to fit as much content as possible, so for your case i added padding parameter - to restrict scroll's size. please check it out, and let me know if this works for you, have a great day!
  > Understandable, have a great day ✌️

- **Issue #292** (2026-06-08): **Updating from 4.1.19 disables touch events in the background of a popup**
  *Symptoms*: See the attached sample project. Works as-is using 4.1.19.  Updating the PopupView dependency to >= 4.1.20 and uncommenting line 23 in `ContentView.swift` breaks the scrolling of the List view.  [PopupViewTest.zip](https://github.com/user-attachments/files/27634496/PopupViewTest.zip)
  **Post-Mortem & Fix Analysis**:
  > Hey @gereons, could you please try version 4.2.2, it should fix background taps, have a great day!
  > Unfortunately this does not work, I still get no scrolling when updating to 4.2.2.
  > got it, I will give it a look, as soon as I have time

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

### Incident Patch 1: `e053f506` (2026-09-23)
**Commit Message**: Fix drag to hide animation after lifting a finger

**File**: `Sources/PopupView/PopupBody.swift` (modified, +17/-2)
```diff
@@ -259,7 +259,11 @@ struct PopupBody<PopupContent: View>: View {
                     timeToHide: $timeToHide,
                     params: params,
                     appearFrom: calculatedAppearFrom,
-                    shouldDismiss: { dismissCallback(.drag) }
+                    shouldDismiss: {
+                        consolidateDragOffset(dragToDismissManager.dragTranslation)
+                        dragToDismissManager.resetDragTranslation()
+                        dismissCallback(.drag)
+                    }
                 )
             }
 
@@ -277,6 +281,14 @@ struct PopupBody<PopupContent: View>: View {
         }
     }
 
+    /// Bakes a live drag offset into `actualCurrentOffset` so a subsequent hide animation
+    /// covers only the remaining distance instead of restarting from the displayed position
+    /// on top of the still-applied drag offset.
+    private func consolidateDragOffset(_ translation: CGSize) {
+        actualCurrentOffset.x += translation.width
+        actualCurrentOffset.y += translation.height
+    }
+
     /// This is the builder for the sheet content
     @ViewBuilder
     func bodyWithGestures() -> some View {
@@ -288,7 +300,10 @@ struct PopupBody<PopupContent: View>: View {
                         dragToDismissManager: dragToDismissManager,
                         sheetContentRect: $sheetContentRect,
                         scrollParams: params,
-                        shouldDismiss: { dismissCallback(.drag) }
+                        shouldDismiss: { dragOffset in
+                            consolidateDragOffset(CGSize(width: 0, height: dragOffset))
+                            dismissCallback(.drag)
+                        }
                     ))
                 }
 #endif
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +4/-2)
```diff
@@ -330,8 +330,10 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
             params.willDismissCallback(dismissSource ?? .binding)
             autohidingWorkHolder.work?.cancel()
             dismissibleInWorkHolder.work?.cancel()
-            shouldShowContent = false // this will cause currentOffset change thus triggering the sliding hiding animation
-            animatableOpacity = 0
+            withAnimation {
+                shouldShowContent = false // this will cause currentOffset change thus triggering the sliding hiding animation
+                animatableOpacity = 0
+            }
             // do the rest once the animation is finished (see onAnimationCompleted())
         }
 
```

**File**: `Sources/PopupView/Utils/ScrollPopupModifier.swift` (modified, +5/-2)
```diff
@@ -15,7 +15,7 @@ struct ScrollPopupModifier: ViewModifier {
     @ObservedObject var dragToDismissManager: DragToDismissHelper
     @Binding var sheetContentRect: CGRect
     var scrollParams: Popup.ScrollPopupParameters
-    var shouldDismiss: ()->()
+    var shouldDismiss: (CGFloat)->()
 
     @StateObject private var scrollViewDelegate = PopupScrollViewDelegate()
 
@@ -94,7 +94,10 @@ struct ScrollPopupModifier: ViewModifier {
         let referenceY = sheetContentRect.height / 3
         scrollViewDelegate.onDragEnded = { value in
             if scrollParams.dragToDismiss && value >= referenceY {
-                shouldDismiss()
+                // consolidate the live drag offset into the shared hide animation so it only
+                // covers the remaining distance, instead of stacking on top of a full-length one
+                dragToDismissOffset = 0
+                shouldDismiss(value)
             } else {
                 withAnimation {
                     dragToDismissOffset = .zero
```

---

### Incident Patch 2: `693492f6` (2026-08-02)
**Commit Message**: Fix macOS popup drag dismissal state

- Prevent the popup from bouncing before closing when dismissed by dragging.
- Clear stale drag offsets after the dismissal animation completes.
- Reset presentation state when reopening a popup.
- Fix an issue where reopening a popup could show only the background blur while the content remained off-screen.

**File**: `Sources/PopupView/PopupBody.swift` (modified, +8/-0)
```diff
@@ -232,6 +232,14 @@ struct PopupBody<PopupContent: View>: View {
                 changeParamsWithAnimation(shouldShowContent)
             }
 
+            .onChange(of: showContent) {
+                // Keep the drag offset during the closing animation to avoid a
+                // visible bounce, then clear it after the popup is unloaded.
+                if !showContent {
+                    dragToDismissManager.resetDragTranslation()
+                }
+            }
+
             .onChange(of: keyboardHeightHelper.keyboardHeight) {
                 if shouldShowContent {
                     changeParamsWithAnimation(true)
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +8/-0)
```diff
@@ -115,6 +115,10 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
         if isBoolMode {
             main(content)
                 .onChange(of: isPresented) {
+                    // Mark the presentation transition synchronously before queuing
+                    // the animation work, preventing a drag dismissal from being
+                    // mistaken for a second presentation during layout updates.
+                    closingIsInProcess = !isPresented
                     eventsQueue.async { [eventsSemaphore] in
                         eventsSemaphore.wait()
                         DispatchQueue.main.async {
@@ -314,6 +318,10 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
     func appearAction(popupPresented: Bool) {
         if popupPresented {
             dismissSource = nil
+            // Popup content is reused on macOS. Clear the previous dismissal state
+            // so the next presentation measures and positions its content again.
+            closingIsInProcess = false
+            sheetContentRect = .zero
             showSheet = true // show transparent fullscreen sheet
             showContent = true // immediately load popup body
             // shouldShowContent is set after popup's frame is calculated, see .onChange(of: sheetContentRect)
```

**File**: `Sources/PopupView/Utils/DragToDismissHelper.swift` (modified, +5/-0)
```diff
@@ -60,6 +60,11 @@ class DragToDismissHelper: ObservableObject {
         self.shouldDismiss = shouldDismiss
     }
 
+    /// Clears the drag offset left by a completed drag dismissal.
+    func resetDragTranslation() {
+        dragTranslation = .zero
+    }
+
     func limitToDismissDirection(_ translation: CGSize) -> CGSize {
         switch appearFrom {
         case .topSlide:
```

---

### Incident Patch 3: `62e16981` (2026-07-30)
**Commit Message**: Fix macos

**File**: `Sources/PopupView/Utils/ScrollViewResolver.swift` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@
 
 import SwiftUI
 
+#if os(iOS)
 struct ScrollViewResolver: UIViewRepresentable {
     var onResolve: (UIScrollView) -> Void
 
@@ -35,3 +36,4 @@ extension UIView {
         return nil
     }
 }
+#endif
```

---

### Incident Patch 4: `fdb56609` (2026-07-29)
**Commit Message**: Merge pull request #297 from dmtrbbrv/fix/window-becomes-key-steals-keyboard

Add becomesKeyWindow option to avoid stealing keyboard from presenting .window mode

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +1/-0)
```diff
@@ -207,6 +207,7 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
                             id: id,
                             closeOnTapOutside: params.closeOnTapOutside,
                             allowTapThroughBG: params.allowTapThroughBG,
+                            becomesKeyWindow: params.becomesKeyWindow,
                             dismissClosure: {
                                 dismissSource = .binding
                                 isPresented = false
```

**File**: `Sources/PopupView/PublicAPI.swift` (modified, +14/-0)
```diff
@@ -169,6 +169,14 @@ public class Popup {
         /// move up for keyboardHeight when it is displayed
         var useKeyboardSafeArea: Bool = false
 
+        /// Only relevant for `displayMode == .window`.
+        /// Whether the popup's own `UIWindow` should become the key window when shown.
+        /// Default is `true` (previous behavior, needed e.g. for popups hosting a focusable
+        /// text input). Set to `false` for transient, non-interactive popups (toasts/snackbars)
+        /// so presenting them doesn't steal key window / first responder status - and with it
+        /// the keyboard - from whatever window/text field was focused before the popup appeared.
+        var becomesKeyWindow: Bool = true
+
         /// called when when dismiss animation starts
         var willDismissCallback: (DismissSource) -> () = {_ in}
 
@@ -249,6 +257,12 @@ public class Popup {
             return self
         }
 
+        /// Only relevant for `displayMode == .window`. See `becomesKeyWindow` doc above.
+        public func becomesKeyWindow(_ becomesKeyWindow: Bool) -> Self {
+            self.becomesKeyWindow = becomesKeyWindow
+            return self
+        }
+
         // MARK: - dismiss callbacks
 
         public func willDismissCallback(_ dismissCallback: @escaping (DismissSource) -> ()) -> Self {
```

**File**: `Sources/PopupView/Utils/WindowManager.swift` (modified, +23/-3)
```diff
@@ -41,6 +41,7 @@ final class WindowManager {
         id: UUID,
         closeOnTapOutside: Bool,
         allowTapThroughBG: Bool,
+        becomesKeyWindow: Bool = true,
         dismissClosure: @escaping SendableClosure,
         content: @escaping () -> Content
     ) {
@@ -53,6 +54,7 @@ final class WindowManager {
             windowScene: scene,
             closeOnTapOutside: closeOnTapOutside,
             isPassthrough: allowTapThroughBG,
+            canBecomeKey: becomesKeyWindow,
             dismissClosure: dismissClosure
         )
 
@@ -70,7 +72,16 @@ final class WindowManager {
         controller.view.backgroundColor = .clear
         window.rootViewController = controller
         window.windowLevel = .alert + 1
-        window.makeKeyAndVisible()
+
+        // `makeKeyAndVisible()` transfers key window (and first responder / keyboard) status
+        // away from whatever window currently holds it. For transient, non-interactive popups
+        // (toasts) this steals the keyboard from a focused text field in the presenting window.
+        // Only become key when the popup actually needs it (e.g. it hosts its own text input).
+        if becomesKeyWindow {
+            window.makeKeyAndVisible()
+        } else {
+            window.isHidden = false
+        }
 
         // Store window and controller reference
         shared.entries[id] = Entry(window: window, controller: controller)
@@ -100,10 +111,15 @@ class UIPassthroughWindow: UIWindow {
     var closeOnTapOutside: Bool
     var isPassthrough: Bool
     var dismissClosure: SendableClosure?
-    
-    init(windowScene: UIWindowScene, closeOnTapOutside: Bool, isPassthrough: Bool, dismissClosure: SendableClosure?) {
+    /// When `false`, this window will never become the key window (see `makeKeyAndVisible`
+    /// usage in `WindowManager`), so it can't steal first responder / keyboard status from
+    /// whatever window currently has it.
+    private let allowsBecomingKey: Bool
+
+    init(windowScene: UIWindowScene, closeOnTapOutside: Bool, isPassthrough: Bool, canBecomeKey: Bool = true, dismissClosure: SendableClosure?) {
         self.closeOnTapOutside = closeOnTapOutside
         self.isPassthrough = isPassthrough
+        self.allowsBecomingKey = canBecomeKey
         self.dismissClosure = dismissClosure
         super.init(windowScene: windowScene)
     }
@@ -112,6 +128,10 @@ class UIPassthroughWindow: UIWindow {
         fatalError("init(coder:) has not been implemented")
     }
 
+    override var canBecomeKey: Bool {
+        allowsBecomingKey
+    }
+
     override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
         guard let vc = rootViewController else {
             return nil
```

---

### Incident Patch 5: `6b4ab760` (2026-07-15)
**Commit Message**: Fix macos

**File**: `PopupExample/PopupExample/BGTapsExamplesView.swift` (modified, +1/-5)
```diff
@@ -91,10 +91,6 @@ struct BGTapsExamplePopup: View {
     var closeOnTapOutside: Bool
     var allowTapThroughBG: Bool
 
-    private var screenWidth: CGFloat {
-        (UIApplication.shared.connectedScenes.first as? UIWindowScene)?.screen.bounds.width ?? 390
-    }
-
     var body: some View {
         VStack(spacing: 12) {
             VStack {
@@ -123,7 +119,7 @@ struct BGTapsExamplePopup: View {
         }
         .padding(EdgeInsets(top: 37, leading: 24, bottom: 40, trailing: 24))
         .background(Color.white.cornerRadius(20))
-        .frame(width: screenWidth - 120)
+        .frame(width: ScreenUtils.width - 120)
         .shadowedStyle()
     }
 }
```

**File**: `PopupExample/PopupExample/PopupExampleApp.swift` (modified, +7/-6)
```diff
@@ -13,6 +13,7 @@ struct PopupExampleApp: App {
 
     var body: some Scene {
         WindowGroup {
+#if os(iOS)
             NavigationView {
                 List {
                     Section {
@@ -24,24 +25,24 @@ struct PopupExampleApp: App {
                             PositionExamplesView()
                         }
 
-                        NavigationLink("Scroll examples") {
-                            ScrollExamplesView()
-                        }
-
                         NavigationLink("BG taps examples") {
                             BGTapsExamplesView()
                         }
+                        NavigationLink("Scroll examples") {
+                            ScrollExamplesView()
+                        }
 
-#if os(iOS)
                         NavigationLink("Misc examples") {
                             MiscExamplesView()
                         }
-#endif
                     }
                 }
                 .navigationTitle("Popup examples")
                 .navigationBarTitleDisplayMode(.inline)
             }
+#else
+            GithubExampleView()
+#endif
         }
     }
 }
```

**File**: `PopupExample/PopupExample/ScrollExamplesView.swift` (modified, +2/-0)
```diff
@@ -7,6 +7,7 @@
 
 import SwiftUI
 
+#if os(iOS)
 struct ScrollExamplesView: View {
 
     private let values = [false, true]
@@ -98,3 +99,4 @@ struct ScrollExamplePopup: View {
         .background(.white)
     }
 }
+#endif
```

**File**: `PopupExample/PopupExample/Utils/Utils.swift` (modified, +25/-0)
```diff
@@ -7,6 +7,31 @@
 
 import SwiftUI
 
+@MainActor
+struct ScreenUtils {
+    static var bounds: CGRect {
+#if os(watchOS)
+        return WKInterfaceDevice.current().screenBounds
+#elseif os(macOS)
+        return NSApplication.shared.keyWindow?.frame
+        ?? NSScreen.main?.frame
+        ?? .zero
+#else
+        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
+        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
+        return scene?.screen.bounds ?? .zero
+#endif
+    }
+
+    static var width: CGFloat {
+        bounds.width
+    }
+
+    static var height: CGFloat {
+        bounds.height
+    }
+}
+
 extension Color {
     init(hex: String) {
         let scanner = Scanner(string: hex)
```

**File**: `PopupExample/PopupWatchExample Watch App/ContentView.swift` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@
 import SwiftUI
 import PopupView
 
-struct ExampleButton : View {
+struct ExampleButton: View {
 
     @Binding var showing: Bool
     var title: String
@@ -27,7 +27,7 @@ struct ExampleButton : View {
     }
 }
 
-struct ContentView : View {
+struct ContentView: View {
 
     let bgColor = Color(hex: "e0fbfc")
     let popupColor = Color(hex: "3d5a80")
```

**File**: `Sources/PopupView/PopupBackgroundView.swift` (modified, +9/-1)
```diff
@@ -41,7 +41,15 @@ struct PopupBackgroundView: View {
             }
         }
         .contentShape(Rectangle())
-        .allowsHitTesting(!allowTapThroughBG)
+        .allowsHitTesting({
+            #if os(macOS)
+            // presenterContent is disabled on macOS so allowTapThroughBG can't work anyway;
+            // always enable hit testing when tap-outside dismiss is requested
+            closeOnTapOutside || !allowTapThroughBG
+            #else
+            !allowTapThroughBG
+            #endif
+        }())
         .opacity(animatableOpacity)
         .ignoresSafeArea()
         .animation(.linear(duration: 0.2), value: animatableOpacity)
```

**File**: `Sources/PopupView/PopupBody.swift` (modified, +13/-2)
```diff
@@ -39,6 +39,7 @@ struct PopupBody<PopupContent: View>: View {
     /// Variables used to control what is animated and what is not
     @State private var actualCurrentOffset = CGPoint.pointFarAwayFromScreen
     @State private var actualScale = 1.0
+    @State private var hasBeenInitiallyPositioned = false
 #if os(iOS)
     @State private var isLandscape: Bool = UIDevice.current.orientation.isLandscape
 #endif
@@ -66,7 +67,12 @@ struct PopupBody<PopupContent: View>: View {
     // MARK: - Position calculations
 
     private var presenterRect: CGRect {
+#if os(iOS)
         params.displayMode == .overlay ? presenterContentRect : ScreenUtils.bounds
+#else
+        // on non-iOS platforms the popup is always rendered in a ZStack within the presenter
+        presenterContentRect
+#endif
     }
 
     /// The offset when the popup is displayed
@@ -206,18 +212,21 @@ struct PopupBody<PopupContent: View>: View {
     var body: some View {
         bodyWithGestures()
             .background {
+#if os(iOS)
                 if params.displayMode == .window {
                     PopupHitRegion() // apply here, because offset doesn't actually change popup's position, effectively breaking expected behaviour
                 }
+#endif
             }
             .scaleEffect(actualScale)
             .offset(x: actualCurrentOffset.x, y: actualCurrentOffset.y)
 
             .onChange(of: shouldShowContent) {
                 // perform initial off screen positioning without animation
-                if actualCurrentOffset == CGPoint.pointFarAwayFromScreen {
+                if !hasBeenInitiallyPositioned {
                     actualCurrentOffset = hiddenOffset
                     actualScale = hiddenScale
+                    hasBeenInitiallyPositioned = true
                 }
 
                 changeParamsWithAnimation(shouldShowContent)
@@ -230,7 +239,7 @@ struct PopupBody<PopupContent: View>: View {
             }
 
             .onChange(of: sheetContentRect.size) {
-                if shouldShowContent { // already displayed but the size has changed
+                if shouldShowContent, !sheetContentRect.isEmpty {
                     actualCurrentOffset = targetCurrentOffset
                 }
             }
@@ -265,6 +274,7 @@ struct PopupBody<PopupContent: View>: View {
     func bodyWithGestures() -> some View {
         if showContent, presenterContentRect != .zero {
             popupBodyBuilder()
+#if os(iOS)
                 .applyIfNotNil(scrollParams) { view, params in
                     view.modifier(ScrollPopupModifier(
                         dragToDismissManager: dragToDismissManager,
@@ -273,6 +283,7 @@ struct PopupBody<PopupContent: View>: View {
                         shouldDismiss: { dismissCallback(.drag) }
                     ))
                 }
+#endif
                 // scroll popup will attach this gesture on its own
                 .applyIfNotTV(if: params.dragToDismiss && !isScrollPopup) { view in
                     view.simultaneousGesture(dragToDismissManager.dragGesture)
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +9/-1)
```diff
@@ -248,9 +248,11 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
     func popupWithBackground() -> some View {
         ZStack {
             popupBackground()
+#if os(iOS)
             if params.displayMode == .window {
                 BGHitRegion()
             }
+#endif
             popupBody()
                 .frameGetter($sheetContentRect)
         }
@@ -293,7 +295,13 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
                 isPresented = false
                 item = nil
             },
-            isWindowMode: params.displayMode == .window,
+            isWindowMode: {
+                #if os(iOS)
+                params.displayMode == .window
+                #else
+                false
+                #endif
+            }(),
             backgroundColor: params.backgroundColor,
             backgroundView: params.backgroundView,
             closeOnTapOutside: params.closeOnTapOutside,
```

---

### Incident Patch 6: `e56e8961` (2026-06-16)
**Commit Message**: Fix for non-ios platforms

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +2/-2)
```diff
@@ -227,7 +227,7 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
             presenterContent
                 .disabled(showContent)
 
-            popupViewBackground()
+            popupWithBackground()
         }
         .onExitCommand {
             dismissSource = .exitCommand
@@ -239,7 +239,7 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
             presenterContent
                 .disabled(showContent)
 
-            popupViewBackground()
+            popupWithBackground()
         }
 #endif
     }
```

**File**: `Sources/PopupView/Utils/Utils.swift` (modified, +5/-1)
```diff
@@ -20,7 +20,11 @@ struct ScreenUtils {
         ?? NSScreen.main?.frame
         ?? .zero
 #else
-        return UIScreen.main.bounds
+        let scene = UIApplication.shared.connectedScenes
+            .first { $0.activationState == .foregroundActive } as? UIWindowScene
+        return scene?.screen.bounds
+        ?? UIScreen.main.bounds
+        ?? .zero
 #endif
     }
 
```

---

### Incident Patch 7: `752a966f` (2026-05-29)
**Commit Message**: Fix customizer for scroll popup

**File**: `PopupExample/PopupExample/PopupExampleApp.swift` (modified, +0/-36)
```diff
@@ -10,8 +10,6 @@ import PopupView
 
 @main
 struct PopupExampleApp: App {
-    @State private var a: EdgeInsets = EdgeInsets()
-    @State private var b: EdgeInsets = EdgeInsets()
 
     var body: some Scene {
         WindowGroup {
@@ -20,18 +18,10 @@ struct PopupExampleApp: App {
                     Section {
                         NavigationLink("Github example") {
                             GithubExampleView()
-                                .safeAreaGetter($a)
-                                .onChange(of: a) {
-                                    print("a", a)
-                                }
                         }
 
                         NavigationLink("Position examples") {
                             PositionExamplesView()
-                                .safeAreaGetter($b)
-                                .onChange(of: b) {
-                                    print("b", b)
-                                }
                         }
 
                         NavigationLink("BG taps examples") {
@@ -51,29 +41,3 @@ struct PopupExampleApp: App {
         }
     }
 }
-struct SafeAreaGetter: ViewModifier {
-
-    @Binding var safeArea: EdgeInsets
-
-    func body(content: Content) -> some View {
-        content
-            .background(
-                GeometryReader { proxy -> AnyView in
-                    DispatchQueue.main.async {
-                        let area = proxy.safeAreaInsets
-                        // This avoids an infinite layout loop
-                        if area != self.safeArea {
-                            self.safeArea = area
-                        }
-                    }
-                    return AnyView(EmptyView())
-                }
-            )
-    }
-}
-
-extension View {
-    public func safeAreaGetter(_ safeArea: Binding<EdgeInsets>) -> some View {
-        modifier(SafeAreaGetter(safeArea: safeArea))
-    }
-}
```

**File**: `Sources/PopupView/PopupBody.swift` (modified, +3/-3)
```diff
@@ -35,9 +35,6 @@ struct PopupBody<PopupContent: View>: View {
 
     // MARK: - Public Properties
 
-    @Binding var isDragging: Bool
-    @Binding var timeToHide: Bool
-
     /// Trigger popup showing/hiding animations and...
     @Binding var shouldShowContent: Bool
     /// ... once hiding animation is finished remove popup from the memory using this flag
@@ -47,6 +44,9 @@ struct PopupBody<PopupContent: View>: View {
     @Binding var presenterContentRect: CGRect
     @Binding var sheetContentRect: CGRect
 
+    @Binding var isDragging: Bool
+    @Binding var timeToHide: Bool
+
     var params: Popup.BasePopupParameters
 
     var popupBodyBuilder: () -> PopupContent
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +2/-2)
```diff
@@ -267,12 +267,12 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
         }
 
         PopupBody(
-            isDragging: $isDragging,
-            timeToHide: $timeToHide,
             shouldShowContent: $shouldShowContent,
             showContent: $showContent,
             presenterContentRect: $presenterContentRect,
             sheetContentRect: $sheetContentRect,
+            isDragging: $isDragging,
+            timeToHide: $timeToHide,
             params: params,
             popupBodyBuilder: viewForItem != nil ? viewForItem! : view,
             dismissCallback: { source in
```

**File**: `Sources/PopupView/PublicModifiers.swift` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ extension View {
         header: @escaping () -> any View = { EmptyView() },
         customize: @escaping (Popup.ScrollPopupParameters) -> Popup.ScrollPopupParameters = { $0 }
     ) -> some View {
-        let params = Popup.ScrollPopupParameters().headerView(header)
+        let params = customize(Popup.ScrollPopupParameters()).headerView(header)
 
         return self.modifier(
             PopupModifier<Int, PopupContent>(
@@ -85,7 +85,7 @@ extension View {
         header: @escaping () -> any View = { EmptyView() },
         customize: @escaping (Popup.ScrollPopupParameters) -> Popup.ScrollPopupParameters = { $0 }
     ) -> some View {
-        let params = Popup.ScrollPopupParameters().headerView(header)
+        let params = customize(Popup.ScrollPopupParameters()).headerView(header)
 
         return self.modifier(
             PopupModifier<Item, PopupContent>(
```

---

### Incident Patch 8: `afe7490c` (2026-05-22)
**Commit Message**: Fix closeOnTap/allowTapThrough for .window popups

**File**: `Sources/PopupView/PopupBody.swift` (modified, +5/-0)
```diff
@@ -252,6 +252,11 @@ struct PopupBody<PopupContent: View>: View {
 
     var body: some View {
         bodyWithGestures()
+            .background {
+                if params.displayMode == .window {
+                    PopupHitRegion() // apply here, because offset doesn't actually change popup's position, effectively breaking expected behaviour
+                }
+            }
             .scaleEffect(actualScale)
             .offset(x: actualCurrentOffset.x, y: actualCurrentOffset.y)
 
```

**File**: `Sources/PopupView/PopupModifier.swift` (modified, +3/-0)
```diff
@@ -291,6 +291,9 @@ public struct PopupModifier<Item: Equatable, PopupContent: View>: ViewModifier {
     func popupViewBackground() -> some View {
         ZStack {
             popupBackground()
+            if params.displayMode == .window {
+                BGHitRegion()
+            }
             popupBody()
                 .frameGetter($sheetContentRect)
         }
```

**File**: `Sources/PopupView/WindowManager.swift` (modified, +53/-32)
```diff
@@ -10,7 +10,7 @@ import SwiftUI
 #if os(iOS)
 
 @MainActor
-public final class WindowManager {
+final class WindowManager {
     static let shared = WindowManager()
     private var entries: [UUID: Entry] = [:]
     
@@ -37,7 +37,7 @@ public final class WindowManager {
     }
 
     // Show a new window with hosted SwiftUI content
-    public static func showInNewWindow<Content: View>(
+    static func showInNewWindow<Content: View>(
         id: UUID,
         closeOnTapOutside: Bool,
         allowTapThroughBG: Bool,
@@ -59,9 +59,7 @@ public final class WindowManager {
         window.backgroundColor = .clear
 
         let rootView = content()
-            .environment(\.popupDismiss) {
-                dismissClosure()
-            }
+            .environment(\.popupDismiss, dismissClosure)
 
         let controller = if #available(iOS 18, *) {
             UIHostingController(rootView: rootView)
@@ -78,7 +76,7 @@ public final class WindowManager {
         shared.entries[id] = Entry(window: window, controller: controller)
     }
 
-    public static func updateRootView<Content: View>(
+    static func updateRootView<Content: View>(
         id: UUID,
         dismissClosure: @escaping () -> (),
         content: @escaping () -> Content
@@ -115,42 +113,65 @@ class UIPassthroughWindow: UIWindow {
     }
 
     override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
-        guard let vc = self.rootViewController else {
-            return nil // pass to next window
+        guard let vc = rootViewController else {
+            return nil
         }
-
         vc.view.layoutIfNeeded() // otherwise the frame is as if the popup is still outside the screen
 
-        let layerHitTestResult = vc.view.layer.hitTest(vc.view.convert(point, from: self))
-        let superlayerDelegateName = layerHitTestResult?.superlayer?.delegate.map { String(describing: type(of: $0)) }
-        let didTapBackground = superlayerDelegateName?.contains(String(describing: PopupHitTestingBackground.self)) ?? false
-
-        if didTapBackground {
-            if closeOnTapOutside {
-                dismissClosure?()
+        for subview in vc.view.subviews {
+            //print("rrr \(classNameContains(subview, "PopupHitRegion") ? "PopupHitRegion" : "BGHitRegion") \(subview.frame.contains(point))")
+            if classNameContains(subview, "PopupHitRegion"),
+               subview.frame.contains(point) {
+                return vc.view // let UIKit pass this touch to wrapped SwiftUI view in regular manner
             }
-            
-            if isPassthrough {
-                return nil // pass to next window
-            }
-            return vc.view
         }
-        
-        // pass tap to this
-        let farthestDescendent = super.hitTest(point, with: event)
-        return farthestDescendent
-    }
 
-    private func isTouchInsideSubview(point: CGPoint, vc: UIView) -> UIView? {
-        for subview in vc.subviews {
-            if subview.frame.contains(point) {
-                return subview
-            }
+        // here we know the tap was outside the actual popup's body, meaning the background was tapped
+
+        if closeOnTapOutside {
+            dismissClosure?()
         }
-        return nil
+
+        if isPassthrough {
+            return nil // pass to next window
+        }
+        return vc.view
+    }
+
+    private func classNameContains(_ view: UIView, _ string: String) -> Bool {
+        String(describing: view.self).contains(string)
     }
 }
 
+final class BGHitRegionView: UIView {
+    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
+        true
+    }
+}
+
+struct BGHitRegion: UIViewRepresentable {
+    func makeUIView(context: Context) -> UIView {
+        BGHitRegionView()
+    }
+
+    func updateUIView(_ uiView: UIView, context: Context) {}
+}
+
+
+final class PopupHitRegionView: UIView {
+    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
+        true
+    }
+}
+
+struct PopupHitRegion: UIViewRepresentable {
+    func makeUIView(context: Context) -> UIView {
+        PopupHitRegionView()
+    }
+
+    func updateUIView(_ uiView: UIView, context: Context) {}
+}
+
 class UITextFieldCheckingVC<Content: View>: UIHostingController<Content> {
 
     override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
```

---

### Incident Patch 9: `74c070e9` (2026-05-12)
**Commit Message**: Merge pull request #290 from Shonchik/fix-scroll-header

Fix scroll headerView

**File**: `Package.resolved` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-{
-  "pins" : [
-    {
-      "identity" : "swiftui-introspect",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/siteline/swiftui-introspect",
-      "state" : {
-        "revision" : "a08b87f96b41055577721a6e397562b21ad52454",
-        "version" : "26.0.0"
-      }
-    }
-  ],
-  "version" : 2
-}
```

**File**: `Package.swift` (modified, +2/-6)
```diff
@@ -13,15 +13,11 @@ let package = Package(
     products: [
         .library(name: "PopupView", targets: ["PopupView"]),
     ],
-    dependencies: [
-        .package(url: "https://github.com/siteline/swiftui-introspect", "1.3.0"..<"27.0.0"),
-    ],
+    dependencies: [],
     targets: [
         .target(
             name: "PopupView",
-            dependencies: [
-                .product(name: "SwiftUIIntrospect", package: "swiftui-introspect"),
-            ],
+            dependencies: [],
             swiftSettings: [
               .enableExperimentalFeature("StrictConcurrency")
             ]
```

**File**: `PopupExample/PopupExample.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-{
-  "pins" : [
-    {
-      "identity" : "swiftui-introspect",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/siteline/swiftui-introspect",
-      "state" : {
-        "revision" : "807f73ce09a9b9723f12385e592b4e0aaebd3336",
-        "version" : "1.3.0"
-      }
-    }
-  ],
-  "version" : 2
-}
```

**File**: `PopupExample/PopupExample/ContentView.swift` (modified, +1/-1)
```diff
@@ -242,7 +242,7 @@ struct ContentView : View {
                 ActionSheetSecond()
             } customize: {
                 $0
-                    .type(.scroll(headerView: AnyView(scrollViewHeader())))
+                    .type(.scroll(headerView: scrollViewHeader()))
                     .position(.bottom)
                     .closeOnTap(false)
                     .closeOnTapOutside(true)
```

**File**: `README.md` (modified, +2/-1)
```diff
@@ -281,7 +281,8 @@ scroll parameters:
 `autohideIn` - time after which popup should disappear    
 `dismissibleIn(Double?, Binding<Bool>?)` - only allow dismiss after this time passes (forbids closeOnTap, closeOnTapOutside, and drag). Pass a boolean binding if you'd like to track current status     
 `dragToDismiss` - true by default: enable/disable drag to dismiss (upwards for .top popup types, downwards for .bottom and default type)    
-`closeOnTap` - true by default: enable/disable closing on tap on popup     
+`closeOnTap` - true by default: enable/disable closing on tap on popup. 
+NOTE: any gesture or control element you add to popup's body will override tap to close. in this case please close the popup manually if you need it to     
 `closeOnTapOutside` - false by default: enable/disable closing on tap on outside of popup     
 `allowTapThroughBG` - Should allow taps to pass "through" the popup's background down to views "below" it. `.sheet` popup is always allowTapThroughBG = false. False by default    
 `backgroundColor` - Color.clear by default: change background color of outside area     
```

**File**: `Sources/PopupView/FullscreenPopup.swift` (modified, +1/-0)
```diff
@@ -270,6 +270,7 @@ public struct FullscreenPopup<Item: Equatable, PopupContent: View>: ViewModifier
                 item: $item,
                 animatableOpacity: $animatableOpacity,
                 dismissSource: $dismissSource,
+                isWindowMode: params.displayMode == .window,
                 backgroundColor: backgroundColor,
                 backgroundView: backgroundView,
                 closeOnTapOutside: closeOnTapOutside,
```

**File**: `Sources/PopupView/PopupBackgroundView.swift` (modified, +37/-20)
```diff
@@ -18,6 +18,7 @@ struct PopupBackgroundView<Item: Equatable>: View {
     @Binding var animatableOpacity: CGFloat
     @Binding var dismissSource: DismissSource?
 
+    var isWindowMode: Bool
     var backgroundColor: Color
     var backgroundView: AnyView?
     var closeOnTapOutside: Bool
@@ -26,35 +27,51 @@ struct PopupBackgroundView<Item: Equatable>: View {
 
     var body: some View {
         ZStack {
-            Group {
-                if let backgroundView = backgroundView {
-                    backgroundView
-                } else {
-                    backgroundColor
-                }
-            }
-            .allowsHitTesting(!allowTapThroughBG)
-            .opacity(animatableOpacity)
-            .edgesIgnoringSafeArea(.all)
-            .animation(.linear(duration: 0.2), value: animatableOpacity)
 #if os(watchOS) || os(macOS)
-            .applyIf(closeOnTapOutside) { view in
-                view.contentShape(Rectangle())
-            }
-            .addTapIfNotTV(if: closeOnTapOutside) {
-                if dismissEnabled.wrappedValue {
-                    dismissSource = .tapOutside
-                    isPresented = false
-                    item = nil
+            contentView()
+                .applyIf(closeOnTapOutside) { view in
+                    view.contentShape(Rectangle())
+                }
+                .addTapIfNotTV(if: closeOnTapOutside) {
+                    if dismissEnabled.wrappedValue {
+                        dismissSource = .tapOutside
+                        isPresented = false
+                        item = nil
+                    }
+                }
+#else
+            contentView()
+                .applyIf(closeOnTapOutside && !isWindowMode) { view in
+                    view.contentShape(Rectangle())
+                }
+                .addTapIfNotTV(if: closeOnTapOutside && !isWindowMode) {
+                    if dismissEnabled.wrappedValue {
+                        dismissSource = .tapOutside
+                        isPresented = false
+                        item = nil
+                    }
                 }
-            }
 #endif
 #if !(os(watchOS) || os(macOS))
             PopupHitTestingBackground() // Hit testing workaround
                 .ignoresSafeArea()
 #endif
         }
     }
+
+    func contentView() -> some View {
+        Group {
+            if let backgroundView = backgroundView {
+                backgroundView
+            } else {
+                backgroundColor
+            }
+        }
+        .allowsHitTesting(!allowTapThroughBG)
+        .opacity(animatableOpacity)
+        .edgesIgnoringSafeArea(.all)
+        .animation(.linear(duration: 0.2), value: animatableOpacity)
+    }
 }
 
 #if !(os(watchOS) || os(macOS))
```

**File**: `Sources/PopupView/PopupScrollViewDelegate.swift` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ final class PopupScrollViewDelegate: ObservableObject {
         let maxContentOffset = (scrollView?.maxContentOffsetHeight() ?? 0) + keyboardHeightHelper.keyboardHeight
 
         if contentOffset - translation.y > 0 {
+            didReachTop(0)
             scrollView?.contentOffset.y = min(contentOffset - translation.y, maxContentOffset)
             gesture.setTranslation(.zero, in: scrollView)
         } else {
```

---

### Incident Patch 10: `4b36a52b` (2026-05-05)
**Commit Message**: Fix closeOnTapOutside

**File**: `Sources/PopupView/FullscreenPopup.swift` (modified, +1/-0)
```diff
@@ -270,6 +270,7 @@ public struct FullscreenPopup<Item: Equatable, PopupContent: View>: ViewModifier
                 item: $item,
                 animatableOpacity: $animatableOpacity,
                 dismissSource: $dismissSource,
+                isWindowMode: params.displayMode == .window,
                 backgroundColor: backgroundColor,
                 backgroundView: backgroundView,
                 closeOnTapOutside: closeOnTapOutside,
```

**File**: `Sources/PopupView/PopupBackgroundView.swift` (modified, +37/-20)
```diff
@@ -18,6 +18,7 @@ struct PopupBackgroundView<Item: Equatable>: View {
     @Binding var animatableOpacity: CGFloat
     @Binding var dismissSource: DismissSource?
 
+    var isWindowMode: Bool
     var backgroundColor: Color
     var backgroundView: AnyView?
     var closeOnTapOutside: Bool
@@ -26,35 +27,51 @@ struct PopupBackgroundView<Item: Equatable>: View {
 
     var body: some View {
         ZStack {
-            Group {
-                if let backgroundView = backgroundView {
-                    backgroundView
-                } else {
-                    backgroundColor
-                }
-            }
-            .allowsHitTesting(!allowTapThroughBG)
-            .opacity(animatableOpacity)
-            .edgesIgnoringSafeArea(.all)
-            .animation(.linear(duration: 0.2), value: animatableOpacity)
 #if os(watchOS) || os(macOS)
-            .applyIf(closeOnTapOutside) { view in
-                view.contentShape(Rectangle())
-            }
-            .addTapIfNotTV(if: closeOnTapOutside) {
-                if dismissEnabled.wrappedValue {
-                    dismissSource = .tapOutside
-                    isPresented = false
-                    item = nil
+            contentView()
+                .applyIf(closeOnTapOutside) { view in
+                    view.contentShape(Rectangle())
+                }
+                .addTapIfNotTV(if: closeOnTapOutside) {
+                    if dismissEnabled.wrappedValue {
+                        dismissSource = .tapOutside
+                        isPresented = false
+                        item = nil
+                    }
+                }
+#else
+            contentView()
+                .applyIf(closeOnTapOutside && !isWindowMode) { view in
+                    view.contentShape(Rectangle())
+                }
+                .addTapIfNotTV(if: closeOnTapOutside && !isWindowMode) {
+                    if dismissEnabled.wrappedValue {
+                        dismissSource = .tapOutside
+                        isPresented = false
+                        item = nil
+                    }
                 }
-            }
 #endif
 #if !(os(watchOS) || os(macOS))
             PopupHitTestingBackground() // Hit testing workaround
                 .ignoresSafeArea()
 #endif
         }
     }
+
+    func contentView() -> some View {
+        Group {
+            if let backgroundView = backgroundView {
+                backgroundView
+            } else {
+                backgroundColor
+            }
+        }
+        .allowsHitTesting(!allowTapThroughBG)
+        .opacity(animatableOpacity)
+        .edgesIgnoringSafeArea(.all)
+        .animation(.linear(duration: 0.2), value: animatableOpacity)
+    }
 }
 
 #if !(os(watchOS) || os(macOS))
```

**File**: `Sources/PopupView/PopupView.swift` (modified, +1/-13)
```diff
@@ -392,7 +392,7 @@ public struct Popup<PopupContent: View>: ViewModifier {
         switch type {
         case .scroll(let headerView):
             VStack(spacing: 0) {
-                scrollHeaderView(view: headerView)
+                AnyView(headerView)
                     .fixedSize(horizontal: false, vertical: true)
                     .offset(dragOffset())
                     .simultaneousGesture(dragGesture)
@@ -420,18 +420,6 @@ public struct Popup<PopupContent: View>: ViewModifier {
 #endif
     }
 
-#if os(iOS)
-    @ViewBuilder
-    func scrollHeaderView(view: any View) -> some View {
-        ZStack {
-            Color.white
-                .mask(AnyView(view))
-
-            AnyView(view)
-        }
-    }
-#endif
-
 #if swift(>=5.9)
     /// This is the builder for the sheet content
     @ViewBuilder
```

---

### Incident Patch 11: `55b98415` (2026-05-02)
**Commit Message**: Merge pull request #291 from pgovindaraj1/fix/scroll-keyboard-offset

Fix .scroll popup shifting off-screen when keyboard appears

**File**: `PopupExample/PopupExample/ContentView.swift` (modified, +16/-0)
```diff
@@ -260,6 +260,22 @@ struct ContentView : View {
                     .backgroundColor(.black.opacity(0.4))
                     .useKeyboardSafeArea(true)
             }
+
+#if os(iOS)
+        // Issue #281 reproduction: .scroll type + useKeyboardSafeArea(true) + TextField
+        // Bug: entire popup shifts up by full keyboard height instead of shrinking scroll area
+            .popup(isPresented: $inputSheets.showingScroll) {
+                ScrollInputSheet(isShowing: $inputSheets.showingScroll)
+            } customize: {
+                $0
+                    .type(.scroll(headerView: AnyView(scrollViewHeader())))
+                    .position(.bottom)
+                    .closeOnTap(false)
+                    .closeOnTapOutside(true)
+                    .backgroundColor(.black.opacity(0.4))
+                    .useKeyboardSafeArea(true)
+            }
+#endif
     }
 
     func createPopupsList() -> PopupsList {
```

**File**: `PopupExample/PopupExample/Examples/InputSheets.swift` (modified, +34/-0)
```diff
@@ -7,6 +7,40 @@
 
 import SwiftUI
 
+// Reproduces issue #281: .scroll type popup with useKeyboardSafeArea(true) shifts
+// the entire popup off-screen when the keyboard appears, instead of constraining
+// only the ScrollView height.
+struct ScrollInputSheet: View {
+    @Binding var isShowing: Bool
+
+    @State var comment: String = ""
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 0) {
+            // Scrollable content area
+            ForEach(0..<8, id: \.self) { i in
+                Text("Item \(i + 1)")
+                    .padding(.horizontal, 20)
+                    .padding(.vertical, 12)
+                Divider().padding(.horizontal, 20)
+            }
+
+            // TextField at the bottom of the scroll content
+            TextField("Leave a comment...", text: $comment)
+                .padding()
+                .frame(height: 44)
+                .background(
+                    RoundedRectangle(cornerRadius: 12)
+                        .stroke(Color.gray.opacity(0.4), lineWidth: 1)
+                )
+                .padding(.horizontal, 20)
+                .padding(.top, 12)
+                .padding(.bottom, 20)
+        }
+        .background(Color.white)
+    }
+}
+
 struct InputSheetBottom: View {
     @Binding var isShowing: Bool
 
```

**File**: `PopupExample/PopupExample/PopupsList.swift` (modified, +11/-0)
```diff
@@ -48,6 +48,7 @@ struct ActionSheetsState {
 
 struct InputSheetsState {
     var showingFirst = false
+    var showingScroll = false
 }
 
 private struct SectionHeader: View {
@@ -374,6 +375,16 @@ struct PopupsList: View {
                 InputSheetImage()
             }
         }
+#if os(iOS)
+        PopupButton(isShowing: $inputSheets.showingScroll, hideAll: hideAll) {
+            PopupTypeView(
+                title: "Scroll + Keyboard (issue #281)",
+                detail: "Scroll popup with TextField - popup should stay at bottom"
+            ) {
+                InputSheetImage()
+            }
+        }
+#endif
     }
 }
 
```

**File**: `Sources/PopupView/PopupView.swift` (modified, +30/-4)
```diff
@@ -167,8 +167,20 @@ public struct Popup<PopupContent: View>: ViewModifier {
                 return (screenHeight - sheetContentRect.height)/2 - safeAreaInsets.top
             }
             if position.isBottom {
+                // For .scroll type, keyboard avoidance is handled by constraining the
+                // ScrollView's maxHeight in contentView(), so we don't shift the popup frame.
+#if os(iOS)
+                let keyboardOffset: CGFloat
+                if case .scroll = type {
+                    keyboardOffset = 0
+                } else {
+                    keyboardOffset = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+                }
+#else
+                let keyboardOffset: CGFloat = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+#endif
                 return screenHeight - sheetContentRect.height
-                - (useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0)
+                - keyboardOffset
                 - verticalPadding
                 - (useSafeAreaInset ? safeAreaInsets.bottom : 0)
                 - safeAreaInsets.top
@@ -182,9 +194,21 @@ public struct Popup<PopupContent: View>: ViewModifier {
             return (presenterContentRect.height - sheetContentRect.height)/2
         }
         if position.isBottom {
+            // For .scroll type, keyboard avoidance is handled by constraining the
+            // ScrollView's maxHeight in contentView(), so we don't shift the popup frame.
+#if os(iOS)
+            let keyboardOffset: CGFloat
+            if case .scroll = type {
+                keyboardOffset = 0
+            } else {
+                keyboardOffset = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+            }
+#else
+            let keyboardOffset: CGFloat = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+#endif
             return presenterContentRect.height
             - sheetContentRect.height
-            - (useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0)
+            - keyboardOffset
             - verticalPadding
             + safeAreaInsets.bottom
             - (useSafeAreaInset ? safeAreaInsets.bottom : 0)
@@ -389,8 +413,10 @@ public struct Popup<PopupContent: View>: ViewModifier {
                 ScrollView {
                     view()
                 }
-                // no heigher than its contents
-                .frame(maxHeight: scrollViewContentHeight)
+                // Constrain to content height, and also subtract keyboard height when
+                // useKeyboardSafeArea is true so the scroll area shrinks instead of
+                // the whole popup frame being shifted upward (issue #281).
+                .frame(maxHeight: max(0, scrollViewContentHeight - (useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0)))
                 .frameGetter($scrollViewRect)
             }
             .introspect(.scrollView, on: .iOS(.v15...)) { scrollView in
```

---

### Incident Patch 12: `cd4977e6` (2026-05-02)
**Commit Message**: Fix .scroll popup shifting off-screen when keyboard appears (issue #281)

When useKeyboardSafeArea(true) is used with a .scroll type popup, the
keyboard height was applied to the popup's Y offset, causing the entire
popup to move up by the full keyboard height and go off-screen.

Fix: for .scroll type, skip the frame-level keyboard offset and instead
subtract keyboardHeight from the ScrollView's maxHeight constraint, so
the scroll area shrinks while the popup stays anchored at the bottom.

Also adds a reproduction case to the example app under Inputs >
"Scroll + Keyboard (issue #281)".

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `PopupExample/PopupExample/ContentView.swift` (modified, +16/-0)
```diff
@@ -260,6 +260,22 @@ struct ContentView : View {
                     .backgroundColor(.black.opacity(0.4))
                     .useKeyboardSafeArea(true)
             }
+
+#if os(iOS)
+        // Issue #281 reproduction: .scroll type + useKeyboardSafeArea(true) + TextField
+        // Bug: entire popup shifts up by full keyboard height instead of shrinking scroll area
+            .popup(isPresented: $inputSheets.showingScroll) {
+                ScrollInputSheet(isShowing: $inputSheets.showingScroll)
+            } customize: {
+                $0
+                    .type(.scroll(headerView: AnyView(scrollViewHeader())))
+                    .position(.bottom)
+                    .closeOnTap(false)
+                    .closeOnTapOutside(true)
+                    .backgroundColor(.black.opacity(0.4))
+                    .useKeyboardSafeArea(true)
+            }
+#endif
     }
 
     func createPopupsList() -> PopupsList {
```

**File**: `PopupExample/PopupExample/Examples/InputSheets.swift` (modified, +34/-0)
```diff
@@ -7,6 +7,40 @@
 
 import SwiftUI
 
+// Reproduces issue #281: .scroll type popup with useKeyboardSafeArea(true) shifts
+// the entire popup off-screen when the keyboard appears, instead of constraining
+// only the ScrollView height.
+struct ScrollInputSheet: View {
+    @Binding var isShowing: Bool
+
+    @State var comment: String = ""
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 0) {
+            // Scrollable content area
+            ForEach(0..<8, id: \.self) { i in
+                Text("Item \(i + 1)")
+                    .padding(.horizontal, 20)
+                    .padding(.vertical, 12)
+                Divider().padding(.horizontal, 20)
+            }
+
+            // TextField at the bottom of the scroll content
+            TextField("Leave a comment...", text: $comment)
+                .padding()
+                .frame(height: 44)
+                .background(
+                    RoundedRectangle(cornerRadius: 12)
+                        .stroke(Color.gray.opacity(0.4), lineWidth: 1)
+                )
+                .padding(.horizontal, 20)
+                .padding(.top, 12)
+                .padding(.bottom, 20)
+        }
+        .background(Color.white)
+    }
+}
+
 struct InputSheetBottom: View {
     @Binding var isShowing: Bool
 
```

**File**: `PopupExample/PopupExample/PopupsList.swift` (modified, +11/-0)
```diff
@@ -48,6 +48,7 @@ struct ActionSheetsState {
 
 struct InputSheetsState {
     var showingFirst = false
+    var showingScroll = false
 }
 
 private struct SectionHeader: View {
@@ -374,6 +375,16 @@ struct PopupsList: View {
                 InputSheetImage()
             }
         }
+#if os(iOS)
+        PopupButton(isShowing: $inputSheets.showingScroll, hideAll: hideAll) {
+            PopupTypeView(
+                title: "Scroll + Keyboard (issue #281)",
+                detail: "Scroll popup with TextField - popup should stay at bottom"
+            ) {
+                InputSheetImage()
+            }
+        }
+#endif
     }
 }
 
```

**File**: `Sources/PopupView/PopupView.swift` (modified, +30/-4)
```diff
@@ -167,8 +167,20 @@ public struct Popup<PopupContent: View>: ViewModifier {
                 return (screenHeight - sheetContentRect.height)/2 - safeAreaInsets.top
             }
             if position.isBottom {
+                // For .scroll type, keyboard avoidance is handled by constraining the
+                // ScrollView's maxHeight in contentView(), so we don't shift the popup frame.
+#if os(iOS)
+                let keyboardOffset: CGFloat
+                if case .scroll = type {
+                    keyboardOffset = 0
+                } else {
+                    keyboardOffset = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+                }
+#else
+                let keyboardOffset: CGFloat = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+#endif
                 return screenHeight - sheetContentRect.height
-                - (useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0)
+                - keyboardOffset
                 - verticalPadding
                 - (useSafeAreaInset ? safeAreaInsets.bottom : 0)
                 - safeAreaInsets.top
@@ -182,9 +194,21 @@ public struct Popup<PopupContent: View>: ViewModifier {
             return (presenterContentRect.height - sheetContentRect.height)/2
         }
         if position.isBottom {
+            // For .scroll type, keyboard avoidance is handled by constraining the
+            // ScrollView's maxHeight in contentView(), so we don't shift the popup frame.
+#if os(iOS)
+            let keyboardOffset: CGFloat
+            if case .scroll = type {
+                keyboardOffset = 0
+            } else {
+                keyboardOffset = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+            }
+#else
+            let keyboardOffset: CGFloat = useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0
+#endif
             return presenterContentRect.height
             - sheetContentRect.height
-            - (useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0)
+            - keyboardOffset
             - verticalPadding
             + safeAreaInsets.bottom
             - (useSafeAreaInset ? safeAreaInsets.bottom : 0)
@@ -389,8 +413,10 @@ public struct Popup<PopupContent: View>: ViewModifier {
                 ScrollView {
                     view()
                 }
-                // no heigher than its contents
-                .frame(maxHeight: scrollViewContentHeight)
+                // Constrain to content height, and also subtract keyboard height when
+                // useKeyboardSafeArea is true so the scroll area shrinks instead of
+                // the whole popup frame being shifted upward (issue #281).
+                .frame(maxHeight: max(0, scrollViewContentHeight - (useKeyboardSafeArea ? keyboardHeightHelper.keyboardHeight : 0)))
                 .frameGetter($scrollViewRect)
             }
             .introspect(.scrollView, on: .iOS(.v15...)) { scrollView in
```

---

### Incident Patch 13: `336c45ae` (2026-04-28)
**Commit Message**: Fix scroll headerView

**File**: `PopupExample/PopupExample/ContentView.swift` (modified, +1/-1)
```diff
@@ -242,7 +242,7 @@ struct ContentView : View {
                 ActionSheetSecond()
             } customize: {
                 $0
-                    .type(.scroll(headerView: AnyView(scrollViewHeader())))
+                    .type(.scroll(headerView: scrollViewHeader()))
                     .position(.bottom)
                     .closeOnTap(false)
                     .closeOnTapOutside(true)
```

**File**: `Sources/PopupView/PopupScrollViewDelegate.swift` (modified, +1/-0)
```diff
@@ -36,6 +36,7 @@ final class PopupScrollViewDelegate: ObservableObject {
         let maxContentOffset = (scrollView?.maxContentOffsetHeight() ?? 0) + keyboardHeightHelper.keyboardHeight
 
         if contentOffset - translation.y > 0 {
+            didReachTop(0)
             scrollView?.contentOffset.y = min(contentOffset - translation.y, maxContentOffset)
             gesture.setTranslation(.zero, in: scrollView)
         } else {
```

**File**: `Sources/PopupView/PopupView.swift` (modified, +31/-3)
```diff
@@ -381,19 +381,34 @@ public struct Popup<PopupContent: View>: ViewModifier {
     @ViewBuilder
     private func contentView() -> some View {
 #if os(iOS)
+        let dragGesture = DragGesture()
+            .updating($dragState) { drag, state, _ in
+                if !isDragging {
+                    DispatchQueue.main.async {
+                        isDragging = true
+                    }
+                }
+                state = .dragging(translation: drag.translation)
+            }
+            .onEnded(onDragEnded)
+
         switch type {
         case .scroll(let headerView):
             VStack(spacing: 0) {
-                headerView
+                scrollHeaderView(view: headerView)
                     .fixedSize(horizontal: false, vertical: true)
+                    .offset(dragOffset())
+                    .simultaneousGesture(dragGesture)
+
                 ScrollView {
                     view()
                 }
                 // no heigher than its contents
                 .frame(maxHeight: scrollViewContentHeight)
                 .frameGetter($scrollViewRect)
+                .offset(dragOffset())
             }
-            .introspect(.scrollView, on: .iOS(.v15...)) { scrollView in
+            .introspect(.scrollView, on: .iOS(.v16...)) { scrollView in
                 configure(scrollView: scrollView)
             }
             .offset(CGSize(width: 0, height: scrollViewOffset.height))
@@ -406,6 +421,18 @@ public struct Popup<PopupContent: View>: ViewModifier {
 #endif
     }
 
+#if os(iOS)
+    @ViewBuilder
+    func scrollHeaderView(view: any View) -> some View {
+        ZStack {
+            Color.white
+                .mask(AnyView(view))
+
+            AnyView(view)
+        }
+    }
+#endif
+
 #if swift(>=5.9)
     /// This is the builder for the sheet content
     @ViewBuilder
@@ -452,7 +479,7 @@ public struct Popup<PopupContent: View>: ViewModifier {
                 .onChange(of: sheetContentRect.size) { sheetContentRect in
                     #if os(iOS)
                     // check if scrollView has already calculated its height, otherwise sheetContentRect is already non-zero but yet incorrect
-                    if case .scroll(_) = type, scrollViewRect.height == 0 {
+                    if case .scroll = type, scrollViewRect.height == 0 {
                         return
                     }
                     #endif
@@ -646,3 +673,4 @@ public struct Popup<PopupContent: View>: ViewModifier {
     }
 #endif
 }
+
```

**File**: `Sources/PopupView/PublicAPI.swift` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ extension Popup {
         case toast
         case floater(verticalPadding: CGFloat = 10, horizontalPadding: CGFloat = 10, useSafeAreaInset: Bool = true)
 #if os(iOS)
-        case scroll(headerView: AnyView = AnyView(Color.clear.frame(height: 1)))
+        case scroll(headerView: any View = EmptyView())
 #endif
 
         var defaultPosition: Position {
```

**File**: `Sources/PopupView/Utils.swift` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ extension View {
         self
 #else
         if condition {
-            self.simultaneousGesture(
+            self.gesture(
                 TapGesture().onEnded {
                     onTap()
                 }
```

---

### Incident Patch 14: `fceb6774` (2026-04-22)
**Commit Message**: Merge pull request #288 from Shonchik/fix-scroll

Fix scroll

**File**: `Sources/PopupView/PopupScrollViewDelegate.swift` (modified, +3/-1)
```diff
@@ -20,6 +20,8 @@ extension UIScrollView {
 @MainActor
 final class PopupScrollViewDelegate: ObservableObject {
 
+    var keyboardHeightHelper = KeyboardHeightHelper()
+
     var scrollView: UIScrollView?
 
     var gestureIsCreated = false
@@ -31,7 +33,7 @@ final class PopupScrollViewDelegate: ObservableObject {
     func handlePan(_ gesture: UIPanGestureRecognizer) {
         let translation = gesture.translation(in: scrollView)
         let contentOffset = scrollView?.contentOffset.y ?? 0
-        let maxContentOffset = scrollView?.maxContentOffsetHeight() ?? 0
+        let maxContentOffset = (scrollView?.maxContentOffsetHeight() ?? 0) + keyboardHeightHelper.keyboardHeight
 
         if contentOffset - translation.y > 0 {
             scrollView?.contentOffset.y = min(contentOffset - translation.y, maxContentOffset)
```

**File**: `Sources/PopupView/PublicAPI.swift` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ extension Popup {
         case toast
         case floater(verticalPadding: CGFloat = 10, horizontalPadding: CGFloat = 10, useSafeAreaInset: Bool = true)
 #if os(iOS)
-        case scroll(headerView: AnyView)
+        case scroll(headerView: AnyView = AnyView(Color.clear.frame(height: 1)))
 #endif
 
         var defaultPosition: Position {
```

---

### Incident Patch 15: `4ef43336` (2026-04-22)
**Commit Message**: Fix scroll

**File**: `Sources/PopupView/PopupScrollViewDelegate.swift` (modified, +3/-1)
```diff
@@ -20,6 +20,8 @@ extension UIScrollView {
 @MainActor
 final class PopupScrollViewDelegate: ObservableObject {
 
+    var keyboardHeightHelper = KeyboardHeightHelper()
+
     var scrollView: UIScrollView?
 
     var gestureIsCreated = false
@@ -31,7 +33,7 @@ final class PopupScrollViewDelegate: ObservableObject {
     func handlePan(_ gesture: UIPanGestureRecognizer) {
         let translation = gesture.translation(in: scrollView)
         let contentOffset = scrollView?.contentOffset.y ?? 0
-        let maxContentOffset = scrollView?.maxContentOffsetHeight() ?? 0
+        let maxContentOffset = (scrollView?.maxContentOffsetHeight() ?? 0) + keyboardHeightHelper.keyboardHeight
 
         if contentOffset - translation.y > 0 {
             scrollView?.contentOffset.y = min(contentOffset - translation.y, maxContentOffset)
```

**File**: `Sources/PopupView/PublicAPI.swift` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ extension Popup {
         case toast
         case floater(verticalPadding: CGFloat = 10, horizontalPadding: CGFloat = 10, useSafeAreaInset: Bool = true)
 #if os(iOS)
-        case scroll(headerView: AnyView)
+        case scroll(headerView: AnyView = AnyView(Color.clear.frame(height: 1)))
 #endif
 
         var defaultPosition: Position {
```

#### Recent Merged Pull Requests:
- **PR #299** (2026-09-22): Fix macOS popup drag dismissal state (@Corotata)
- **PR #297** (2026-07-29): Add becomesKeyWindow option to avoid stealing keyboard from presenting .window mode (@dmtrbbrv)
- **PR #291** (2026-05-02): Fix .scroll popup shifting off-screen when keyboard appears (@pgovindaraj1)
- **PR #290** (2026-05-12): Fix scroll headerView (@Shonchik)
- **PR #288** (2026-04-22): Fix scroll (@Shonchik)
- **PR #287** (2026-04-15): Update examples, update allowTapThroughBG to false by default (@Shonchik)
- **PR #286** (2026-04-14): Fix macOS (@Shonchik)
- **PR #285** (2026-04-13): Fix watchOS (@Shonchik)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
