# Forensic Learning Record (Deep Inspection): rafsoh/dimeApp

> **Canonical Artifact**: `07_PROJECT_LEARNING/rafsoh-dimeapp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rafsoh/dimeApp](https://github.com/rafsoh/dimeApp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:52:14.775Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rafsoh/dimeApp`
- **Description**: Dime is a beautiful expense tracker built with iOS design guidelines in mind.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1890 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/dime/Utilities/AlertToast.swift`
```
//
//  AlertToast.swift
//  Bonsai
//
//  Created by Rafael Soh on 1/7/22.
//

import Combine
import Foundation
import SwiftUI

@available(iOS 13, macOS 11, *)
private struct AnimatedCheckmark: View {
    /// Checkmark color
    var color: Color = .black

    /// Checkmark color
    var size: Int = 50

    var height: CGFloat {
        return CGFloat(size)
    }

    var width: CGFloat {
        return CGFloat(size)
    }

    @State private var percentage: CGFloat = .zero

    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 0, y: height / 2))
            path.addLine(to: CGPoint(x: width / 2.5, y: height))
            path.addLine(to: CGPoint(x: width, y: 0))
        }
        .trim(from: 0, to: percentage)
        .stroke(color, style: StrokeStyle(lineWidth: CGFloat(size / 8), lineCap: .round, lineJoin: .round))
        .animation(Animation.spring().speed(0.75).delay(0.25), value: percentage)
        .onAppear {
            percentage = 1.0
        }
        .frame(width: width, height: height, alignment: .center)
    }
}

@available(iOS 13, macOS 11, *)
private struct AnimatedXmark: View {
    /// xmark color
    var color: Color = .black

    /// xmark size
    var size: Int = 50

    var height: CGFloat {
        return CGFloat(size)
    }

    var width: CGFloat {
        return CGFloat(size)
    }

    var rect: CGRect {
        return CGRect(x: 0, y: 0, width: size, height: size)
    }

    @State private var percentage: CGFloat = .zero

    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: rect.minX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.maxY, y: rect.maxY))
            path.move(to: CGPoint(x: rect.maxX, y: rect.minY))
            path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        }
        .trim(from: 0, to: percentage)
        .stroke(color, style: StrokeStyle(lineWidth: CGFloat(size / 8), lineCap: .round, lineJoin: .round))
        .animation(Animation.spring().speed(0.75).delay(0.25), value: percentage)
        .onAppear {
            percentage = 1.0
        }
        .frame(width: width, height: height, alignment: .center)
    }
}

#if os(macOS)
    @available(macOS 11, *)
    struct ActivityIndicator: NSViewRepresentable {
        func makeNSView(context: NSViewRepresentableContext<ActivityIndicator>) -> NSProgressIndicator {
            let nsView = NSProgressIndicator()

            nsView.isIndeterminate = true
            nsView.style = .spinning
            nsView.startAnimation(context)

            return nsView
        }

        func updateNSView(_: NSProgressIndicator, context _: NSViewRepresentableContext<ActivityIndicator>) {}
    }
#else
    @available(iOS 13, *)
    struct ActivityIndicator: UIViewRepresentable {
        func makeUIView(context _: UIViewRepresentableContext<ActivityIndicator>) -> UIActivityIndicatorView {
            let progressView = UIActivityIndicatorView(style: .large)
            progressView.startAnimating()

            return progressView
        }

        func updateUIView(_: UIActivityIndicatorView, context _: UIViewRepresentableContext<ActivityIndicator>) {}
    }
#endif

#if os(macOS)
    @available(macOS 11, *)
    public struct BlurView: NSViewRepresentable {
        public typealias NSViewType = NSVisualEffectView

        public func makeNSView(context _: Context) -> NSVisualEffectView {
            let effectView = NSVisualEffectView()
            effectView.material = .hudWindow
            effectView.blendingMode = .withinWindow
            effectView.state = NSVisualEffectView.State.active
            return effectView
        }

        public func updateNSView(_ nsView: NSVisualEffectView, context _: Context) {
            nsView.material = .hudWindow
            nsView.blendingMode = .withinWindow
        }
    }

#else

    @available(iOS 13, *)
    public struct BlurView: UIViewRepresentable {
        public typealias UIViewType = UIVisualEffectView

        public func makeUIView(context _: Context) -> UIVisualEffectView {
            return UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
        }

        public func updateUIView(_ uiView: UIVisualEffectView, context _: Context) {
            uiView.effect = UIBlurEffect(style: .systemMaterial)
        }
    }

#endif

// MARK: - Main View

@available(iOS 13, macOS 11, *)
public struct AlertToast: View {
    public enum BannerAnimation {
        case slide, pop
    }

    /// Determine how the alert will be display
    public enum DisplayMode: Equatable {
        /// Present at the center of the screen
        case alert

        /// Drop from the top of the screen
        case hud

        /// Banner from the bottom of the view
        case banner(_ transition: BannerAnimation)
    }

    /// Determine what the alert will display
    public enum AlertType: Equatable {
        /// Animated checkmark
        case complete(_ color: Color)

        /// Animated xmark
        case error(_ color: Color)

        /// System image from `SFSymbols`
        case systemImage(_ name: String, _ color: Color)

        /// Image from Assets
        case image(_ name: String, _ color: Color)

        /// Loading indicator (Circular)
        case loading

        /// Only text alert
        case regular
    }

    /// Customize Alert Appearance
    public enum AlertStyle: Equatable {
        case style(backgroundColor: Color? = nil,
                   titleColor: Color? = nil,
                   subTitleColor: Color? = nil,
                   titleFont: Font? = nil,
                   subTitleFont: Font? = nil)

        /// Get background color
        var backgroundColor: Color? {
            switch self {
            case let .style(backgroundColor: color, _, _, _, _):
                return color
            }
        }

        /// Get title color
        var titleColor: Color? {
            switch self {
            case let .style(_, color, _, _, _):
                return color
            }
        }

        /// Get subTitle color
        var subtitleColor: Color? {
            switch self {
            case let .style(_, _, color, _, _):
                return color
            }
        }

        /// Get title font
        var titleFont: Font? {
            switch self {
            case let .style(_, _, _, titleFont: font, _):
                return font
            }
        }

        /// Get subTitle font
        var subTitleFont: Font? {
            switch self {
            case let .style(_, _, _, _, subTitleFont: font):
                return font
            }
        }
    }

    /// The display mode
    /// - `alert`
    /// - `hud`
    /// - `banner`
    public var displayMode: DisplayMode = .alert

    /// What the alert would show
    /// `complete`, `error`, `systemImage`, `image`, `loading`, `regular`
    public var type: AlertType

    /// The title of the alert (`Optional(String)`)
    public var title: String?

    /// The subtitle of the alert (`Optional(String)`)
    public var subTitle: String?

    /// Customize your alert appearance
    public var style: AlertStyle?

    public var onTap: (() -> Void)?

    /// Full init
    public init(displayMode: DisplayMode = .alert,
                type: AlertType,
                title: String? = nil,
                subTitle: String? = nil,
                style: AlertStyle? = nil,
                onTap: (() -> Void)? = nil) {
        self.displayMode = displayMode
        self.type = type
        self.title = title
        self.subTitle = subTitle
        self.style = style
        self.onTap = onTap
    }

    /// Short init with most used parameters
    public init(displayMode: DisplayMode,
                type: AlertType,
                title: String? = nil) {
        self.displayMode = displayMode
        self.type = type
        self.title = title
    }

    /// Banner from the bottom of the view
    public var banner: some View {
        VStack {
            Spacer()

            // Banner view starts here
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    switch type {
                    case let .complete(color):
                        Image(systemName: "checkmark")
                            .foregroundColor(color)
                    case let .error(color):
                        Image(systemName: "xmark")
                            .foregroundColor(color)
                    case let .systemImage(name, color):
                        Image(systemName: name)
                            .foregroundColor(color)
                    case let .image(name, color):
                        Image(name)
                            .foregroundColor(color)
                    case .loading:
                        ActivityIndicator()
                    case .regular:
                        EmptyView()
                    }

                    Text(LocalizedStringKey(title ?? ""))
                        .font(style?.titleFont ?? Font.headline.bold())
                }

                if subTitle != nil {
                    Text(LocalizedStringKey(subTitle!))
                        .font(style?.subTitleFont ?? Font.subheadline)
                }
            }
            .fixedSize(horizontal: true, vertical: false)
            .multilineTextAlignment(.leading)
            .textColor(style?.titleColor ?? nil)
            .padding()
            .frame(maxWidth: 400, alignment: .leading)
            .alertBackground(style?.backgroundColor ?? nil)
            .cornerRadius(10)
            .padding([.horizontal, .bottom])
        }
    }

    /// HUD View
    public var hud: some View {
        Group {
            HStack(spacing: 16) {
                switch type {
                case let .complete(color):
                    Image(systemName: "checkmark")
                        .hudModifier()
                        .foregroundColor(color)
            
```

### Core Architecture Module: `app/dime/Utilities/AppVersion.swift`
```
//
//  AppVersion.swift
//  dime
//
//  Created by Rafael Soh on 25/8/22.
//

import Foundation
import UIKit

extension UIApplication {
    static var appVersion: String? {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    }

    static var buildNumber: String? {
        return Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
    }
}

```

### Core Architecture Module: `app/dime/Utilities/Authentication.swift`
```
//
//  Authentication.swift
//  Bonsai
//
//  Created by Rafael Soh on 7/7/22.
//

import Foundation
import LocalAuthentication
import SwiftUI
// All App Lock related methods will be handled here

class AppLockViewModel: ObservableObject {
    // Publishing the applock state from user defaults
    @Published var isAppLockEnabled: Bool = false
    // Publishing if the app is curretly unlocked or not
    @Published var isAppUnLocked: Bool = false

    @Published var enrollmentError: Bool = false

    init() {
        getAppLockState()
    }

    // To enable the AppLock in UserDefaults
    func enableAppLock() {
        UserDefaults.standard.set(true, forKey: "appLockEnabled")
        isAppLockEnabled = true
    }

    // To disable the AppLock in UserDefaults
    func disableAppLock() {
        UserDefaults.standard.set(false, forKey: "appLockEnabled")
        isAppLockEnabled = false
    }

    // To Publish the AppLock state
    func getAppLockState() {
        isAppLockEnabled = UserDefaults.standard.bool(forKey: "appLockEnabled")
    }

    // Checking if the device is having BioMetric hardware and enrolled
    func checkIfBioMetricAvailable() -> Bool {
        var error: NSError?
        let laContext = LAContext()

        let isBiometricAvailable = laContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)

        if let error = error {
            print(error.localizedDescription)
        }

        if isBiometricAvailable {
            enrollmentError = false
        } else {
            enrollmentError = true
        }

        return isBiometricAvailable
    }

    // This method used to change the AppLock state.
    // If user is going to enable the AppLock then 'appLockState' should be 'true' and vice versa
    func appLockStateChange(appLockState: Bool) {
        let laContext = LAContext()
        if checkIfBioMetricAvailable() {
            var reason = ""
            if appLockState {
                reason = "Provice Touch ID/Face ID to enable App Lock"
            } else {
                reason = "Provice Touch ID/Face ID to disable App Lock"
            }

            laContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
                if success {
                    if appLockState {
                        DispatchQueue.main.async {
                            self.enableAppLock()
                            self.isAppUnLocked = true
                        }
                    } else {
                        DispatchQueue.main.async {
                            self.disableAppLock()
                            self.isAppUnLocked = true
                        }
                    }
                } else {
                    if let error = error {
                        DispatchQueue.main.async {
                            print(error.localizedDescription)
                        }
                    }
                }
            }
        } else {
            if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(settingsURL)
            }
        }
    }

    // This method will call on every launch of the app if user has enabled AppLock
    func appLockValidation() {
        let laContext = LAContext()
        if checkIfBioMetricAvailable() {
            let reason = "Enable App Lock"
            laContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
                if success {
                    DispatchQueue.main.async {
                        self.isAppUnLocked = true
                    }
                } else {
                    if let error = error {
                        DispatchQueue.main.async {
                            print(error.localizedDescription)
                        }
                    }
                }
            }
        } else {
            if let settingsURL = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(settingsURL)
            }
        }
    }
}

```

### Core Architecture Module: `app/dime/Utilities/BottomSheet.swift`
```
//
//  BottomSheet.swift
//  dime
//
//  Created by Rafael Soh on 1/7/23.
//

import SwiftUI
import UIKit

// 1 - Create a UISheetPresentationController that can be used in a SwiftUI interface
struct SheetPresentationForSwiftUI<Content>: UIViewRepresentable where Content: View {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let detents: [UISheetPresentationController.Detent]
    let content: Content

    init(
        _ isPresented: Binding<Bool>,
        onDismiss: (() -> Void)? = nil,
        detents: [UISheetPresentationController.Detent] = [.medium()],
        @ViewBuilder content: () -> Content
    ) {
        _isPresented = isPresented
        self.onDismiss = onDismiss
        self.detents = detents
        self.content = content()
    }

    func makeUIView(context _: Context) -> UIView {
        let view = UIView()
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        // Create the UIViewController that will be presented by the UIButton
        let viewController = UIViewController()

        // Create the UIHostingController that will embed the SwiftUI View
        let hostingController = UIHostingController(rootView: content)

        // Add the UIHostingController to the UIViewController
        viewController.addChild(hostingController)
        viewController.view.addSubview(hostingController.view)

        // Set constraints
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        hostingController.view.leftAnchor.constraint(equalTo: viewController.view.leftAnchor).isActive = true
        hostingController.view.topAnchor.constraint(equalTo: viewController.view.topAnchor).isActive = true
        hostingController.view.rightAnchor.constraint(equalTo: viewController.view.rightAnchor).isActive = true
        hostingController.view.bottomAnchor.constraint(equalTo: viewController.view.bottomAnchor).isActive = true
        hostingController.didMove(toParent: viewController)

        // Set the presentationController as a UISheetPresentationController
        if let sheetController = viewController.presentationController as? UISheetPresentationController {
            sheetController.detents = detents
            sheetController.prefersGrabberVisible = true
            sheetController.prefersScrollingExpandsWhenScrolledToEdge = false
            sheetController.largestUndimmedDetentIdentifier = .medium
        }

        // Set the coordinator (delegate)
        // We need the delegate to use the presentationControllerDidDismiss function
        viewController.presentationController?.delegate = context.coordinator

        if isPresented {
            // Present the viewController
            uiView.window?.rootViewController?.present(viewController, animated: true)
        } else {
            // Dismiss the viewController
            uiView.window?.rootViewController?.dismiss(animated: true)
        }
    }

    /* Creates the custom instance that you use to communicate changes
     from your view controller to other parts of your SwiftUI interface.
      */
    func makeCoordinator() -> Coordinator {
        Coordinator(isPresented: $isPresented, onDismiss: onDismiss)
    }

    class Coordinator: NSObject, UISheetPresentationControllerDelegate {
        @Binding var isPresented: Bool
        let onDismiss: (() -> Void)?

        init(isPresented: Binding<Bool>, onDismiss: (() -> Void)? = nil) {
            _isPresented = isPresented
            self.onDismiss = onDismiss
        }

        func presentationControllerDidDismiss(_: UIPresentationController) {
            isPresented = false
            if let onDismiss = onDismiss {
                onDismiss()
            }
        }
    }
}

// 2 - Create the SwiftUI modifier conforming to the ViewModifier protocol
struct SheetWithDetentsViewModifier<SwiftUIContent>: ViewModifier where SwiftUIContent: View {
    @Binding var isPresented: Bool
    let onDismiss: (() -> Void)?
    let detents: [UISheetPresentationController.Detent]
    let swiftUIContent: SwiftUIContent

    init(isPresented: Binding<Bool>, detents: [UISheetPresentationController.Detent] = [.medium()], onDismiss: (() -> Void)? = nil, content: () -> SwiftUIContent) {
        _isPresented = isPresented
        self.onDismiss = onDismiss
        swiftUIContent = content()
        self.detents = detents
    }

    func body(content: Content) -> some View {
        ZStack {
            SheetPresentationForSwiftUI($isPresented, onDismiss: onDismiss, detents: detents) {
                swiftUIContent
            }.fixedSize()
            content
        }
    }
}

// 3 - Create extension on View that makes it easier to use the custom modifier
extension View {
    func sheetWithDetents<Content>(
        isPresented: Binding<Bool>,
        detents: [UISheetPresentationController.Detent],
        onDismiss: (() -> Void)?,
        content: @escaping () -> Content
    ) -> some View where Content: View {
        modifier(
            SheetWithDetentsViewModifier(
                isPresented: isPresented,
                detents: detents,
                onDismiss: onDismiss,
                content: content
            )
        )
    }
}

```

### Core Architecture Module: `app/dime/Utilities/Color.swift`
```
//
//  Color.swift
//  xpenz
//
//  Created by Rafael Soh on 10/5/22.
//

import Combine
import Foundation
import SwiftUI

extension Color {
    static let colourMigrationDictionary: [String: String] = [
        "1": "#279AF4",
        "2": "#EC7A58",
        "3": "#A6678A",
        "4": "#C56AF7",
        "5": "#6E7BF1",
        "6": "#F3BF56",
        "7": "#ED80A2",
        "8": "#F6D24A",
        "9": "#E34D63",
        "10": "#61C7FA",
        "11": "#7014F5",
        "12": "#EB7068",
        "13": "#84B4EB",
        "14": "#4088AD",
        "15": "#B8D6FA",
        "16": "#C38D5D",
        "17": "#A0ACF9",
        "18": "#7CB0AA",
        "19": "#F6D489",
        "20": "#88997A",
        "21": "#F1AF8A",
        "22": "#2D4B7B",
        "23": "#5FAF9F",
        "24": "#D46D7F"
    ]

    static let colorArray: [String] = [
        "#279AF4",
        "#EC7A58",
        "#A6678A",
        "#C56AF7",
        "#6E7BF1",
        "#F3BF56",
        "#ED80A2",
        "#F6D24A",
        "#E34D63",
        "#61C7FA",
        "#7014F5",
        "#EB7068",
        "#84B4EB",
        "#4088AD",
        "#B8D6FA",
        "#C38D5D",
        "#A0ACF9",
        "#7CB0AA",
        "#F6D489",
        "#88997A",
        "#F1AF8A",
        "#2D4B7B",
        "#5FAF9F",
        "#D46D7F"
    ]

    static let neuBackground = Color(hex: "f0f0f3")
    static let dropShadow = Color(hex: "aeaec0").opacity(0.4)
    static let dropLight = Color(hex: "ffffff")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int = UInt64()
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6: // RGB (12-bit)
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (16-bit)
            (_, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255)
    }

    func toHex() -> String? {
        let uic = UIColor(self)
        guard let components = uic.cgColor.components, components.count >= 3 else {
            return nil
        }
        let r = Float(components[0])
        let g = Float(components[1])
        let b = Float(components[2])
        var a = Float(1.0)

        if components.count >= 4 {
            a = Float(components[3])
        }

        if a != Float(1.0) {
            return String(format: "#%02lX%02lX%02lX%02lX", lroundf(r * 255), lroundf(g * 255), lroundf(b * 255), lroundf(a * 255))
        } else {
            return String(format: "#%02lX%02lX%02lX", lroundf(r * 255), lroundf(g * 255), lroundf(b * 255))
        }
    }

    func luminance() -> Double {
        let components = UIColor(self).cgColor.components
        let r = components?[0] ?? 0
        let g = components?[1] ?? 0
        let b = components?[2] ?? 0
        return 0.299 * Double(r) + 0.587 * Double(g) + 0.114 * Double(b)
    }

    static var PrimaryBackground: Color {
        return Color("PrimaryBackground")
    }

    static var SecondaryBackground: Color {
        return Color("SecondaryBackground")
    }

    static var DarkBackground: Color {
        return Color("DarkBackground")
    }

    static var PrimaryText: Color {
        return Color("PrimaryText")
    }

    static var AlertRed: Color {
        return Color("AlertRed")
    }

    static var IncomeGreen: Color {
        return Color("IncomeGreen")
    }

    static var BudgetBackground: Color {
        return Color("BudgetBackground")
    }

    static var SubtitleText: Color {
        return Color("SubtitleText")
    }

    static var Outline: Color {
        return Color("Outline")
    }

    static var LightIcon: Color {
        return Color("LightIcon")
    }

    static var DarkIcon: Color {
        return Color("DarkIcon")
    }

    static var GreyIcon: Color {
        return Color("GreyIcon")
    }

    static var BudgetRed: Color {
        return Color("BudgetRed")
    }

    static var Alert: Color {
        return Color("Alert")
    }

    static var TertiaryBackground: Color {
        return Color("TertiaryBackground")
    }

    static var SettingsBackground: Color {
        return Color("Settings")
    }

    static var EvenLighterText: Color {
        return Color("EvenLighterText")
    }
}

public extension View {
    @available(iOS 14.0, *)
    func colorPickerSheet(isPresented: Binding<Bool>, selection: Binding<Color>, supportsAlpha: Bool = true, title: String? = nil) -> some View {
        background(ColorPickerSheet(isPresented: isPresented, selection: selection, supportsAlpha: supportsAlpha, title: title))
    }
}

func blend(over color: Color, withAlpha alpha: CGFloat) -> Color {
    let uiColor = UIColor(color)
    let alphaClamped = min(max(alpha, 0), 1)

    guard let inputRGBComponents = uiColor.cgColor.components else {
        return color
    }

    let inputRed = inputRGBComponents[0]
    let inputGreen = inputRGBComponents[1]
    let inputBlue = inputRGBComponents[2]

    let whiteComponents: [CGFloat] = [1, 1, 1]
    let whiteRed = whiteComponents[0]
    let whiteGreen = whiteComponents[1]
    let whiteBlue = whiteComponents[2]

    // alpha blending
    let red = inputRed * alphaClamped + whiteRed * (1 - alphaClamped)
    let green = inputGreen * alphaClamped + whiteGreen * (1 - alphaClamped)
    let blue = inputBlue * alphaClamped + whiteBlue * (1 - alphaClamped)

    return Color(UIColor(red: red, green: green, blue: blue, alpha: 1))
}

@available(iOS 14.0, *)
private struct ColorPickerSheet: UIViewRepresentable {
    @Binding var isPresented: Bool
    @Binding var selection: Color
    var supportsAlpha: Bool
    var title: String?

    func makeCoordinator() -> Coordinator {
        Coordinator(selection: $selection, isPresented: $isPresented)
    }

    class Coordinator: NSObject, UIColorPickerViewControllerDelegate, UIAdaptivePresentationControllerDelegate {
        @Binding var selection: Color
        @Binding var isPresented: Bool
        var didPresent = false

        init(selection: Binding<Color>, isPresented: Binding<Bool>) {
            _selection = selection
            _isPresented = isPresented
        }

        func colorPickerViewControllerDidSelectColor(_ viewController: UIColorPickerViewController) {
            selection = Color(viewController.selectedColor)
        }

        func colorPickerViewControllerDidFinish(_: UIColorPickerViewController) {
            isPresented = false
            didPresent = false
        }

        func presentationControllerDidDismiss(_: UIPresentationController) {
            isPresented = false
            didPresent = false
            print("change3")
        }
    }

    func getTopViewController(from view: UIView) -> UIViewController? {
        guard var top = view.window?.rootViewController else {
            return nil
        }
        while let next = top.presentedViewController {
            top = next
        }
        return top
    }

    func makeUIView(context _: Context) -> UIView {
        let view = UIView()
        view.isHidden = true
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        if isPresented && !context.coordinator.didPresent {
            let modal = UIColorPickerViewController()
            modal.selectedColor = UIColor(selection)
            modal.supportsAlpha = supportsAlpha
            modal.title = title
            modal.delegate = context.coordinator
            modal.presentationController?.delegate = context.coordinator

            let top = getTopViewController(from: uiView)
            top?.present(modal, animated: true)
            context.coordinator.didPresent = true
        }
    }
}

```

### Core Architecture Module: `app/dime/Utilities/DynamicType.swift`
```
//
//  DynamicType.swift
//  dime
//
//  Created by Rafael Soh on 24/10/23.
//

import SwiftUI

extension EnvironmentValues {
    var dynamicTypeMultiplier: CGFloat {
        switch self.dynamicTypeSize {
        case .xSmall:
            0.9
        case .small:
            0.93
        case .medium:
            0.96
        case .large:
            1.0
        case .xLarge:
            1.05
        case .xxLarge:
            1.1
        case .xxxLarge:
            1.15
        default:
            1.0
        }
    }
}

```

### Core Architecture Module: `app/dime/Utilities/EmailExtensions.swift`
```
//
//  EmailExtensions.swift
//  Bonsai
//
//  Created by Rafael Soh on 8/7/22.
//

import Foundation
import UIKit

extension UIDevice {
    struct DeviceModel: Decodable {
        let identifier: String
        let model: String
        static var all: [DeviceModel] {
            Bundle.main.decode([DeviceModel].self, from: "DeviceModels.json")
        }
    }

    var modelName: String {
        #if targetEnvironment(simulator)
            let identifier = ProcessInfo().environment["SIMULATOR_MODEL_IDENTIFIER"]!
        #else
            var systemInfo = utsname()
            uname(&systemInfo)
            let machineMirror = Mirror(reflecting: systemInfo.machine)
            let identifier = machineMirror.children.reduce("") { identifier, element in
                guard let value = element.value as? Int8, value != 0 else { return identifier }
                return identifier + String(UnicodeScalar(UInt8(value)))
            }
        #endif
        return DeviceModel.all.first { $0.identifier == identifier }?.model ?? identifier
    }
}

extension Bundle {
    var displayName: String {
        object(forInfoDictionaryKey: "CFBundleName") as? String ?? "Could not determine the application name"
    }

    var appBuild: String {
        object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "Could not determine the application build number"
    }

    var appVersion: String {
        object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "Could not determine the application version"
    }

    func decode<T: Decodable>(_: T.Type,
                              from file: String,
                              dateDecodingStategy: JSONDecoder.DateDecodingStrategy = .deferredToDate,
                              keyDecodingStrategy: JSONDecoder.KeyDecodingStrategy = .useDefaultKeys) -> T {
        guard let url = url(forResource: file, withExtension: nil) else {
            fatalError("Error: Failed to locate \(file) in bundle.")
        }
        guard let data = try? Data(contentsOf: url) else {
            fatalError("Error: Failed to load \(file) from bundle.")
        }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = dateDecodingStategy
        decoder.keyDecodingStrategy = keyDecodingStrategy
        guard let loaded = try? decoder.decode(T.self, from: data) else {
            fatalError("Error: Failed to decode \(file) from bundle.")
        }
        return loaded
    }
}

```

### Core Architecture Module: `app/dime/Utilities/FontExtension.swift`
```
//
//  FontExtension.swift
//  dime
//
//  Created by Rafael Soh on 29/7/22.
//

import UIKit
import SwiftUI

extension UIFont {

    static func getBodyFontSize(dynamicTypeSize: DynamicTypeSize) -> CGFloat {
        switch dynamicTypeSize {
        case .xSmall:
            return 14
        case .small:
            return 15
        case .medium:
            return 16
        case .large:
            return 17
        case .xLarge:
            return 19
        case .xxLarge:
            return 21
        case .xxxLarge:
            return 23
        default:
            return 23
        }
    }

    class func rounded(ofSize size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let systemFont = UIFont.systemFont(ofSize: size, weight: weight)
        let font: UIFont

        if let descriptor = systemFont.fontDescriptor.withDesign(.rounded) {
            font = UIFont(descriptor: descriptor, size: size)
        } else {
            font = systemFont
        }
        return font
    }

    class func roundedSpecial(ofStyle style: UIFont.TextStyle, weight: UIFont.Weight, size: Double) -> UIFont {
        let systemFont = UIFont.systemFont(ofSize: size, weight: weight)
        let font: UIFont

        if let descriptor = systemFont.fontDescriptor.withDesign(.rounded) {
            font = UIFont(descriptor: descriptor, size: size)
        } else {
            font = systemFont
        }
        return UIFontMetrics(forTextStyle: style).scaledFont(for: font)
    }

    static func textStyleSize(_ style: UIFont.TextStyle) -> CGFloat {
        UIFont.preferredFont(forTextStyle: style).pointSize
    }

}

```

### Core Architecture Module: `app/dime/Utilities/KeyboardHeightHelper.swift`
```
//
//  KeyboardHeightHelper.swift
//  xpenz
//
//  Created by Rafael Soh on 16/5/22.
//

import Combine
import Foundation
import SwiftUI
import UIKit

class KeyboardHeightHelper: ObservableObject {
    @Published var keyboardHeight: CGFloat = 0

    private func listenForKeyboardNotifications() {
        NotificationCenter.default.addObserver(forName: UIResponder.keyboardDidShowNotification,
                                               object: nil,
                                               queue: .main) { notification in
            guard let userInfo = notification.userInfo,
                  let keyboardRect = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }

            self.keyboardHeight = keyboardRect.height
        }

//        NotificationCenter.default.addObserver(forName: UIResponder.keyboardDidHideNotification,
//                                               object: nil,
//                                               queue: .main) { (notification) in
//                                                self.keyboardHeight = 0
//        }
    }

    init() {
        listenForKeyboardNotifications()
    }
}

extension Publishers {
    // 1.
    static var keyboardHeight: AnyPublisher<CGFloat, Never> {
        // 2.
        let willShow = NotificationCenter.default.publisher(for: UIApplication.keyboardWillShowNotification)
            .map { $0.keyboardHeight }

        let willHide = NotificationCenter.default.publisher(for: UIApplication.keyboardWillHideNotification)
            .map { _ in CGFloat(0) }

        // 3.
        return MergeMany(willShow, willHide)
            .eraseToAnyPublisher()
    }
}

extension Notification {
    var keyboardHeight: CGFloat {
        return (userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect)?.height ?? 0
    }
}

extension View {
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content
    ) -> some View {
        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

extension UIApplication {
    func endEditing() {
        sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

struct KeyboardAwareModifier: ViewModifier {
    @AppStorage("keyboard", store: UserDefaults(suiteName: "group.com.rafaelsoh.dime")) var savedKeyboardHeight: Double = .init(UIScreen.main.bounds.height / 2.5)
    var showToolbar: Bool
//    @State private var keyboardHeight: CGFloat = 250

    private var keyboardHeightPublisher: AnyPublisher<CGFloat, Never> {
        Publishers.Merge(
            NotificationCenter.default
                .publisher(for: UIResponder.keyboardWillShowNotification)
                .compactMap { $0.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue }
                .map { $0.cgRectValue.height },
            NotificationCenter.default
                .publisher(for: UIResponder.keyboardWillHideNotification)
                .map { _ in CGFloat(0) }
        ).eraseToAnyPublisher()
    }

    func body(content: Content) -> some View {
        content
            .frame(height: savedKeyboardHeight)
            .onReceive(keyboardHeightPublisher) { value in
                if value > 200 {
                    self.savedKeyboardHeight = value - 20
                }
            }
    }
}

extension View {
    func keyboardAwareHeight(showToolbar: Bool) -> some View {
        ModifiedContent(content: self, modifier: KeyboardAwareModifier(showToolbar: showToolbar))
    }
}

```

### Core Architecture Module: `app/dime/Utilities/OffsetHelper.swift`
```
//
//  OffsetHelper.swift
//  dime
//
//  Created by Rafael Soh on 9/7/23.
//

import Combine
import Foundation
import SwiftUI

struct OffsetKey: PreferenceKey {
    static var defaultValue: CGRect = .zero
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        value = nextValue()
    }
}

extension View {
    @ViewBuilder
    func offsetExtractor(coordinateSpace _: String, completion: @escaping (CGRect) -> Void) -> some View {
        overlay(alignment: .top) {
            GeometryReader {
                let rect = $0.frame(in: .global)
                Color.clear
                    .preference(key: OffsetKey.self, value: rect)
                    .onPreferenceChange(OffsetKey.self, perform: completion)
            }
        }
    }
}

//
// class ScrollViewModel: NSObject, ObservableObject, UIGestureRecognizerDelegate {
//    let gestureID: String = UUID().uuidString
//    let gestureEnded = PassthroughSubject<Void, Never>()
//
//    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
//        return true
//    }
//
//    func addGesture() {
//        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(onGestureChange(gesture: )))
//        panGesture.delegate = self
//        panGesture.name = gestureID
//        rootController().view.addGestureRecognizer(panGesture)
//        print("ADDEEDDDD")
//    }
//
//    func removeGesture() {
//        rootController().view.gestureRecognizers?.removeAll(where: { gesture in
//            gesture.name == gestureID
//        })
//    }
//
//    func rootController() -> UIViewController {
//        guard let screen = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
//            return .init()
//        }
//
//        guard let root = screen.windows.first?.rootViewController else {
//            return .init()
//        }
//
//        return root
//    }
//
//    @objc
//    func onGestureChange(gesture: UIPanGestureRecognizer) {
//        if gesture.state == .cancelled || gesture.state == .ended {
//
//            gestureEnded.send()
//
//        }
//    }
//
// }

```

### Core Architecture Module: `app/dime/Utilities/SKProduct-LocalizedPrice.swift`
```
//
//  SKProduct-LocalizedPrice.swift
//  dime
//
//  Created by Rafael Soh on 15/9/22.
//

import StoreKit

extension SKProduct {
    var localizedPrice: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.locale = priceLocale
        return formatter.string(from: price)!
    }
}

```

### Core Architecture Module: `app/dime/Utilities/StringExtension.swift`
```
//
//  StringExtension.swift
//  xpenz
//
//  Created by Rafael Soh on 16/5/22.
//

import Foundation
import UIKit

extension StringProtocol {
    var firstUppercased: String { prefix(1).uppercased() + dropFirst() }
    var firstCapitalized: String { prefix(1).capitalized + dropFirst() }
}

extension String {
    var containsDigits: Bool {
        return rangeOfCharacter(from: CharacterSet.decimalDigits) != nil
    }

    func onlyEmoji() -> String {
        return filter { $0.isEmoji }
    }

    func widthOfRoundedString(size: CGFloat, weight: UIFont.Weight) -> CGFloat {
        let systemFont = UIFont.systemFont(ofSize: size, weight: weight)
        let roundedFont: UIFont
        if let descriptor = systemFont.fontDescriptor.withDesign(.rounded) {
            roundedFont = UIFont(descriptor: descriptor, size: size)
        } else {
            roundedFont = systemFont
        }

        let fontAttributes = [NSAttributedString.Key.font: roundedFont]
        let size = self.size(withAttributes: fontAttributes)
        return size.width
    }

    func heightOfRoundedString(size: CGFloat, weight: UIFont.Weight) -> CGFloat {
        let systemFont = UIFont.systemFont(ofSize: size, weight: weight)
        let roundedFont: UIFont
        if let descriptor = systemFont.fontDescriptor.withDesign(.rounded) {
            roundedFont = UIFont(descriptor: descriptor, size: size)
        } else {
            roundedFont = systemFont
        }

        let fontAttributes = [NSAttributedString.Key.font: roundedFont]
        let size = self.size(withAttributes: fontAttributes)
        return size.height
    }

    func textToImage(size: CGFloat) -> UIImage? {
        let nsString = (self as NSString)
        let font = UIFont.systemFont(ofSize: size) // you can change your font size here
        let stringAttributes = [NSAttributedString.Key.font: font]
        let imageSize = nsString.size(withAttributes: stringAttributes)

        UIGraphicsBeginImageContextWithOptions(imageSize, false, 0) //  begin image context
        UIColor.clear.set() // clear background
        UIRectFill(CGRect(origin: CGPoint(), size: imageSize)) // set rect size
        nsString.draw(at: CGPoint.zero, withAttributes: stringAttributes) // draw text within rect
        let image = UIGraphicsGetImageFromCurrentImageContext() // create image from context
        UIGraphicsEndImageContext() //  end image context

        return image ?? UIImage()
    }
}

extension Character {
    var isEmoji: Bool {
        guard let scalar = unicodeScalars.first else { return false }
        return scalar.properties.isEmoji && (scalar.value > 0x238C || unicodeScalars.count > 1)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #72** (2025-03-29): **bug: Cannot delete 0 or decimal at last digit**
  *Symptoms*: ### Prerequisites  - [x] I have searched for [existing issues](https://github.com/rarfell/dimeApp/issues) that already report this problem, without success.  ### Dime Version  https://github.com/user-attachments/assets/86f1d199-2437-4dca-b156-5ed33febca0c  ### Current Behavior  Unable to delete 0 or decimal if it's the last digit  ### Expected Behavior  Should be able to be deleted if I want to change it to something else  ### Steps to Reproduce  1. Create new expense 2. Add decimal or 0 3. Try to delete  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @jeffrey-zang resolved this issue and added a PR.  Thanks
  > Very cool, thanks!

- **Issue #63** (2025-03-16): **Fix build and update introspect**
  *Symptoms*: Updated introspect and removed TimmysApp's dead libraries. Should allow the app to build for the time being, do note that I haven't been able to test this on my iPhone as I lack a developer account with the required entitlements, it works perfectly on the simulator however.  If there's interest perhaps the entitlement features (iCloud sync and notifications) could be gated to allow for free dev and  and CI builds, with a scheduled job to have a better view on the current build status in regards to dependencies over time. 
  **Post-Mortem & Fix Analysis**:
  > Is this PR still open for some reason ? The build issue still exist without Stools 
  > @shasvat23 It doesn't build for you with this PR? I made a currency conversion PoC a few months back using this PR as a base but I haven't tried building dime since.
  > Hi @selfsigned with this PR it does work, so I was wondering why this was not merged 

- **Issue #54** (2025-03-18): **Cannot install STool complains about repo not existing or invalid credentials**
  *Symptoms*: ### Prerequisites  - [X] I have searched for [existing issues](https://github.com/rarfell/dimeApp/issues) that already report this problem, without success.  ### Dime Version  Hey absolute newcomer to iOS dev here.  I'm trying to install the dependencies as instructed in the README but STools fails with: ``` x-xcode-log://4A436BA0-C322-4EC4-B309-2FDA4902CA56 github.com: https://github.com/TimmysApp/STools: The remote repository could not be accessed. Make sure a valid repository exists at the specified location and that the correct credentials have been supplied. ```  - Trying to access that repository via my browser returns 404. - Trying to clone the repo via terminal also fails returning: ``` remote: Repository not found. fatal: repository 'https://github.com/TimmysApp/STools/' not found ```  I've tried the general recipes found online, such as: - `➜  ~ rm -rf ~/Library/Developer/Xcode/DerivedData` - FIle -> Packages -> Reset cache - Tried multiple Personal Access Tokens (with full perm set as well)   ### Current Behavior  Build is failing  ### Expected Behavior  Build not failing  ### Steps to Reproduce  1. Clone 2. Open project in xcode 3. Try to resolve deps  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > I also found this to be the case. I messaged Dev on X, no response back yet. This is a cool project hope this fixed.
  > same thing happened to me. visiting the repository https://github.com/TimmysApp/STools returns a 404. it appears that it either no longer exists, or was made private by the owner. this likely means the dependency needs to be removed from the project or replaced for it to work.
  > 1 : change `swiftui-introspect`  dependency to main branch  from  Xcode Package Dependencies  2.  run update to latest packages version from Xcode `File ----> Packages---> update to latest packages version` 3. change all `import Introspect` to `import SwiftUIIntrospect`

- **Issue #48** (2025-03-16): **fix bug - issue #40 - can't delete after typing a dot**
  *Symptoms*: I fixed the bug where you are not able to delete the dot if it is the last character.   https://github.com/rarfell/dimeApp/assets/128280660/324c6ff4-662a-4548-8aef-83aead571059  
  **Post-Mortem & Fix Analysis**:
  > how to use  
  > > how to use  sorry, I am not sure I understand the question
  > Nice, thanks!

- **Issue #47** (2025-03-16): **Fix overlap between search bar and scroll view**
  *Symptoms*: ## Description - Before <img width="200" alt="截圖 2024-01-27 13 07 08" src="https://github.com/rarfell/dimeApp/assets/48300578/943d4b17-e486-458c-8c3b-9756ed5b6ccf">  - After <img width="200" alt="截圖 2024-01-27 13 05 26" src="https://github.com/rarfell/dimeApp/assets/48300578/561644da-c7d7-4875-aa01-ea50c99d26fe">  
  **Post-Mortem & Fix Analysis**:
  > Amazing, thank you!

- **Issue #40** (2025-03-16): **bug:  Can't delete after typing a dot**
  *Symptoms*: ### Prerequisites  - [X] I have searched for [existing issues](https://github.com/rarfell/dimeApp/issues) that already report this problem, without success.  ### Dime Version  V2.1.3(12)  ### Current Behavior  Can't delete the dot after typing a dot. But if you type any number after the dot, the number and the dot can be deleted one by one🤔  ### Expected Behavior  I hope I can delete the dot which should be clear when I click the delete in order.  ### Steps to Reproduce  iPhone 14pro with iOS 16.6.1  1. I entered some number (for example, I enter "10") and a dot  2. I stoped entering anything, so we can see "10." 3. I clicked delete, and nothing happened.    ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Has been fixed by #48 !

- **Issue #10** (2026-08-29): **(Screen) Size matters: text not rendering correctly **
  *Symptoms*: I’m using the iPhone SE and the interface does not render correctly at all.  ![IMG_4246](https://github.com/rarfell/dimeApp/assets/38881000/1737e328-e3e5-4c77-ac90-914fb5952715) ![IMG_4217](https://github.com/rarfell/dimeApp/assets/38881000/deef9276-e301-4136-9d63-ea683d1a2b8d) 
  **Post-Mortem & Fix Analysis**:
  > @ndrew222 Just to understand this better, this is for all the screens?
  > I’m not sure, but I presume it’s just for phones still using the iPhone 8 design (ie. iPhone 8, iPhone SE 2, iPhone SE 3
  > Misclick lmao

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

### Incident Patch 1: `ac67e6f8` (2025-03-25)
**Commit Message**: Fix: #72

**File**: `app/dime/Components/Transactions/NumberPad.swift` (modified, +1/-1)
```diff
@@ -336,7 +336,7 @@ struct NumberPadTextView: View {
            .background(Color.SecondaryBackground, in: Circle())
            .contentShape(Circle())
        }
-       .disabled(price == 0)
+       .disabled(price == 0 && !isEditingDecimal)
    }
 
     public func deleteLastDigit() {
```

---

### Incident Patch 2: `a10d0b4f` (2025-03-16)
**Commit Message**: fix: remove en-GB

**File**: `dime.xcodeproj/project.pbxproj` (modified, +0/-9)
```diff
@@ -337,10 +337,6 @@
 		AEADEF722AE94DC3006EB614 /* ToolbarButton.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ToolbarButton.swift; sourceTree = "<group>"; };
 		AEADEF732AE94DC3006EB614 /* Toolbar.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Toolbar.swift; sourceTree = "<group>"; };
 		AECE7F9D2AED1A6800B57267 /* SuggestedTransactions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SuggestedTransactions.swift; sourceTree = "<group>"; };
-		D6A4DE262D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/WidgetConfiguration.strings"; sourceTree = "<group>"; };
-		D6A4DE272D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/MainInterface.strings"; sourceTree = "<group>"; };
-		D6A4DE282D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/Localizable.strings"; sourceTree = "<group>"; };
-		D6A4DE292D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.stringsdict; name = "en-GB"; path = "en-GB.lproj/Localizable.stringsdict"; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -794,7 +790,6 @@
 			knownRegions = (
 				en,
 				Base,
-				"en-GB",
 			);
 			mainGroup = 5327D27A287C697400F76ADF;
 			packageReferences = (
@@ -1062,7 +1057,6 @@
 			isa = PBXVariantGroup;
 			children = (
 				5311A22E29F04EF300A5BE20 /* Base */,
-				D6A4DE262D6180B600F7F751 /* en-GB */,
 			);
 			name = WidgetConfiguration.intentdefinition;
 			sourceTree = "<group>";
@@ -1071,7 +1065,6 @@
 			isa = PBXVariantGroup;
 			children = (
 				5313EC6D28ACE941000EAB0C /* Base */,
-				D6A4DE272D6180B600F7F751 /* en-GB */,
 			);
 			name = MainInterface.storyboard;
 			sourceTree = "<group>";
@@ -1080,7 +1073,6 @@
 			isa = PBXVariantGroup;
 			children = (
 				5328588829B4F8D500CB64D0 /* en */,
-				D6A4DE282D6180B600F7F751 /* en-GB */,
 			);
 			name = Localizable.strings;
 			sourceTree = "<group>";
@@ -1089,7 +1081,6 @@
 			isa = PBXVariantGroup;
 			children = (
 				53423C6329B9B3AC000CB54F /* en */,
-				D6A4DE292D6180B600F7F751 /* en-GB */,
 			);
 			name = Localizable.stringsdict;
 			sourceTree = "<group>";
```

---

### Incident Patch 3: `4f0f46d8` (2025-03-16)
**Commit Message**: fix bug:  Can't delete after typing a dot #40

**File**: `dime/Components/Transactions/NumberPad.swift` (modified, +1/-1)
```diff
@@ -162,10 +162,10 @@ struct NumberPad: View {
         } else {
             switch decimalValuesAssigned {
                 case .none:
+                    isEditingDecimal = false
                     return
                 case .first:
                     price = Double(Int(price))
-                    isEditingDecimal = false
                     decimalValuesAssigned = .none
                 case .second:
                     price = Double(Int(price * 10)) / 10
```

---

### Incident Patch 4: `c8bb4126` (2025-03-16)
**Commit Message**: Merge pull request #48 from DariusC9/fixDeleteDotBug

fix bug - issue #40 - can't delete after typing a dot

**File**: `dime/Components/Transactions/NumberPad.swift` (modified, +1/-1)
```diff
@@ -347,10 +347,10 @@ struct NumberPadTextView: View {
         } else {
             switch decimalValuesAssigned {
                 case .none:
+                    isEditingDecimal = false
                     return
                 case .first:
                     price = Double(Int(price))
-                    isEditingDecimal = false
                     decimalValuesAssigned = .none
                 case .second:
                     price = Double(Int(price * 10)) / 10
```

---

### Incident Patch 5: `b53d59ff` (2025-03-16)
**Commit Message**: Merge pull request #47 from fuji37450/Fix/overlap

Fix overlap between search bar and scroll view

**File**: `dime/Views/LogView.swift` (modified, +10/-11)
```diff
@@ -638,16 +638,7 @@ struct SearchView: View {
     @State var searchQuery = ""
 
     var body: some View {
-        ZStack(alignment: .top) {
-            ScrollView {
-                if searchQuery == "" {
-                    EmptyView()
-                } else {
-                    FilteredSearchView(searchQuery: searchQuery)
-                }
-            }
-            .frame(maxWidth: .infinity, maxHeight: .infinity)
-
+        VStack(spacing: 18) {
             HStack(spacing: 9) {
                 HStack {
                     Image(systemName: "magnifyingglass")
@@ -692,6 +683,15 @@ struct SearchView: View {
 //                        .font(.system(size: 18, weight: .medium, design: .rounded))
                 }
             }
+            
+            ScrollView {
+                if searchQuery == "" {
+                    EmptyView()
+                } else {
+                    FilteredSearchView(searchQuery: searchQuery)
+                }
+            }
+            .frame(maxWidth: .infinity, maxHeight: .infinity)
         }
         .padding(15)
         .background(Color.PrimaryBackground)
@@ -729,7 +729,6 @@ struct FilteredSearchView: View {
             ListView(transactions: _transactions)
         }
         .frame(maxHeight: .infinity)
-        .padding(.top, 80)
     }
 
     init(searchQuery: String) {
```

---

### Incident Patch 6: `aab6936b` (2025-02-16)
**Commit Message**: deps: update to match swiftui-introspect

**File**: `dime.xcodeproj/project.pbxproj` (modified, +47/-36)
```diff
@@ -53,7 +53,6 @@
 		5327D2DD287C6B5F00F76ADF /* InsightsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5327D2D4287C6B5E00F76ADF /* InsightsView.swift */; };
 		5327D2DE287C6B5F00F76ADF /* CustomTabBar.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5327D2D5287C6B5E00F76ADF /* CustomTabBar.swift */; };
 		5327D2E0287C6B7D00F76ADF /* DeviceModels.json in Resources */ = {isa = PBXBuildFile; fileRef = 5327D2DF287C6B7C00F76ADF /* DeviceModels.json */; };
-		5327D2E3287C6B9300F76ADF /* Introspect in Frameworks */ = {isa = PBXBuildFile; productRef = 5327D2E2287C6B9300F76ADF /* Introspect */; };
 		5327D2E6287C6CC300F76ADF /* Popovers in Frameworks */ = {isa = PBXBuildFile; productRef = 5327D2E5287C6CC300F76ADF /* Popovers */; };
 		5328588B29B502C400CB64D0 /* Localizable.strings in Resources */ = {isa = PBXBuildFile; fileRef = 5328588929B4F8D500CB64D0 /* Localizable.strings */; };
 		532C58BC2A629C3900DA2C81 /* NewBudgetView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 532C58BB2A629C3900DA2C81 /* NewBudgetView.swift */; };
@@ -92,7 +91,6 @@
 		5383D85E287D9A0100D1B9BA /* CloudKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5383D85D287D9A0100D1B9BA /* CloudKit.framework */; };
 		538A32AA2A505AC6008AEF8C /* BottomSheet.swift in Sources */ = {isa = PBXBuildFile; fileRef = 538A32A92A505AC6008AEF8C /* BottomSheet.swift */; };
 		538D10752A5AB7E7008F1AFB /* IsScrolling in Frameworks */ = {isa = PBXBuildFile; productRef = 538D10742A5AB7E7008F1AFB /* IsScrolling */; };
-		538D10782A5ABC72008F1AFB /* ScrollViewStyle in Frameworks */ = {isa = PBXBuildFile; productRef = 538D10772A5ABC72008F1AFB /* ScrollViewStyle */; };
 		53980E5C28A77B62009CC4E2 /* Helper.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53980E5B28A77B62009CC4E2 /* Helper.swift */; };
 		53980E5D28A77B62009CC4E2 /* Helper.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53980E5B28A77B62009CC4E2 /* Helper.swift */; };
 		53A32B3828AB6C6400628905 /* Line.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53A32B3728AB6C6400628905 /* Line.swift */; };
@@ -162,6 +160,8 @@
 		AEADEF742AE94DC3006EB614 /* ToolbarButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = AEADEF722AE94DC3006EB614 /* ToolbarButton.swift */; };
 		AEADEF752AE94DC3006EB614 /* Toolbar.swift in Sources */ = {isa = PBXBuildFile; fileRef = AEADEF732AE94DC3006EB614 /* Toolbar.swift */; };
 		AECE7F9E2AED1A6800B57267 /* SuggestedTransactions.swift in Sources */ = {isa = PBXBuildFile; fileRef = AECE7F9D2AED1A6800B57267 /* SuggestedTransactions.swift */; };
+		D6A4DE202D61744400F7F751 /* SwiftUIIntrospect in Frameworks */ = {isa = PBXBuildFile; productRef = D6A4DE1F2D61744400F7F751 /* SwiftUIIntrospect */; };
+		D6A4DE242D61744400F7F751 /* SwiftUIIntrospect-Static in Frameworks */ = {isa = PBXBuildFile; productRef = D6A4DE232D61744400F7F751 /* SwiftUIIntrospect-Static */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -202,6 +202,16 @@
 			name = "Embed Foundation Extensions";
 			runOnlyForDeploymentPostprocessing = 0;
 		};
+		D6A4DE1B2D6153C200F7F751 /* Embed Frameworks */ = {
+			isa = PBXCopyFilesBuildPhase;
+			buildActionMask = 2147483647;
+			dstPath = "";
+			dstSubfolderSpec = 10;
+			files = (
+			);
+			name = "Embed Frameworks";
+			runOnlyForDeploymentPostprocessing = 0;
+		};
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
@@ -327,6 +337,10 @@
 		AEADEF722AE94DC3006EB614 /* ToolbarButton.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ToolbarButton.swift; sourceTree = "<group>"; };
 		AEADEF732AE94DC3006EB614 /* Toolbar.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Toolbar.swift; sourceTree = "<group>"; };
 		AECE7F9D2AED1A6800B57267 /* SuggestedTransactions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SuggestedTransactions.swift; sourceTree = "<group>"; };
+		D6A4DE262D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/WidgetConfiguration.strings"; sourceTree = "<group>"; };
+		D6A4DE272D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/MainInterface.strings"; sourceTree = "<group>"; };
+		D6A4DE282D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/Localizable.strings"; sourceTree = "<group>"; };
+		D6A4DE292D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.stringsdict; name = "en-GB"; path = "en-GB.lproj/Localizable.stringsdict"; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -350,16 +364,16 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				D6A4
```

**File**: `dime.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +6/-23)
```diff
@@ -1,4 +1,5 @@
 {
+  "originHash" : "ae8559a74005595848c7f375a437bfb1a9b6e513a1e16ca5be5d648d5d854e5e",
   "pins" : [
     {
       "identity" : "alamofire",
@@ -50,37 +51,19 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/aheze/Popovers",
       "state" : {
-        "branch" : "main",
-        "revision" : "05033a2a1ab619369756933803f45431eae4f6ab"
-      }
-    },
-    {
-      "identity" : "scrollviewstyle",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/TimmysApp/ScrollViewStyle",
-      "state" : {
-        "revision" : "adc7413f6b32781dc5970c54d1a734cafa230ba7",
-        "version" : "1.0.0"
-      }
-    },
-    {
-      "identity" : "stools",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/TimmysApp/STools",
-      "state" : {
-        "revision" : "ea876036fc53be40f564b24d3c267b447416dc1d",
-        "version" : "1.0.81"
+        "revision" : "de44c4dd7271ec6413fe350f7efadb14e5e18dce",
+        "version" : "1.3.2"
       }
     },
     {
       "identity" : "swiftui-introspect",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/siteline/SwiftUI-Introspect.git",
       "state" : {
-        "branch" : "master",
-        "revision" : "7ef0df639079491ee1aaf6b83b6fd4d08df80393"
+        "revision" : "807f73ce09a9b9723f12385e592b4e0aaebd3336",
+        "version" : "1.3.0"
       }
     }
   ],
-  "version" : 2
+  "version" : 3
 }
```

**File**: `dime/Views/InsightsView.swift` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 //
 
 import Foundation
-import Introspect
+import SwiftUIIntrospect
 import Popovers
 import SwiftUI
 
```

**File**: `dime/Views/LogView.swift` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
 import CloudKitSyncMonitor
 import CoreData
 import Foundation
-import Introspect
+import SwiftUIIntrospect
 import Popovers
 import SwiftUI
 
@@ -657,7 +657,7 @@ struct SearchView: View {
                         .foregroundColor(Color.DarkIcon.opacity(0.8))
                         .accessibility(hidden: true)
                     TextField("Search entry by note", text: $searchQuery)
-                        .introspectTextField { textField in
+                        .introspect(.textField, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18)) { textField in
                             textField.becomeFirstResponder()
                         }
                         .font(.system(.body, design: .rounded).weight(.regular))
```

---

### Incident Patch 7: `7aad217d` (2025-02-16)
**Commit Message**: deps: update to match swiftui-introspect

**File**: `dime.xcodeproj/project.pbxproj` (modified, +47/-36)
```diff
@@ -53,7 +53,6 @@
 		5327D2DD287C6B5F00F76ADF /* InsightsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5327D2D4287C6B5E00F76ADF /* InsightsView.swift */; };
 		5327D2DE287C6B5F00F76ADF /* CustomTabBar.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5327D2D5287C6B5E00F76ADF /* CustomTabBar.swift */; };
 		5327D2E0287C6B7D00F76ADF /* DeviceModels.json in Resources */ = {isa = PBXBuildFile; fileRef = 5327D2DF287C6B7C00F76ADF /* DeviceModels.json */; };
-		5327D2E3287C6B9300F76ADF /* Introspect in Frameworks */ = {isa = PBXBuildFile; productRef = 5327D2E2287C6B9300F76ADF /* Introspect */; };
 		5327D2E6287C6CC300F76ADF /* Popovers in Frameworks */ = {isa = PBXBuildFile; productRef = 5327D2E5287C6CC300F76ADF /* Popovers */; };
 		5328588B29B502C400CB64D0 /* Localizable.strings in Resources */ = {isa = PBXBuildFile; fileRef = 5328588929B4F8D500CB64D0 /* Localizable.strings */; };
 		532C58BC2A629C3900DA2C81 /* NewBudgetView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 532C58BB2A629C3900DA2C81 /* NewBudgetView.swift */; };
@@ -92,7 +91,6 @@
 		5383D85E287D9A0100D1B9BA /* CloudKit.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 5383D85D287D9A0100D1B9BA /* CloudKit.framework */; };
 		538A32AA2A505AC6008AEF8C /* BottomSheet.swift in Sources */ = {isa = PBXBuildFile; fileRef = 538A32A92A505AC6008AEF8C /* BottomSheet.swift */; };
 		538D10752A5AB7E7008F1AFB /* IsScrolling in Frameworks */ = {isa = PBXBuildFile; productRef = 538D10742A5AB7E7008F1AFB /* IsScrolling */; };
-		538D10782A5ABC72008F1AFB /* ScrollViewStyle in Frameworks */ = {isa = PBXBuildFile; productRef = 538D10772A5ABC72008F1AFB /* ScrollViewStyle */; };
 		53980E5C28A77B62009CC4E2 /* Helper.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53980E5B28A77B62009CC4E2 /* Helper.swift */; };
 		53980E5D28A77B62009CC4E2 /* Helper.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53980E5B28A77B62009CC4E2 /* Helper.swift */; };
 		53A32B3828AB6C6400628905 /* Line.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53A32B3728AB6C6400628905 /* Line.swift */; };
@@ -162,6 +160,8 @@
 		AEADEF742AE94DC3006EB614 /* ToolbarButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = AEADEF722AE94DC3006EB614 /* ToolbarButton.swift */; };
 		AEADEF752AE94DC3006EB614 /* Toolbar.swift in Sources */ = {isa = PBXBuildFile; fileRef = AEADEF732AE94DC3006EB614 /* Toolbar.swift */; };
 		AECE7F9E2AED1A6800B57267 /* SuggestedTransactions.swift in Sources */ = {isa = PBXBuildFile; fileRef = AECE7F9D2AED1A6800B57267 /* SuggestedTransactions.swift */; };
+		D6A4DE202D61744400F7F751 /* SwiftUIIntrospect in Frameworks */ = {isa = PBXBuildFile; productRef = D6A4DE1F2D61744400F7F751 /* SwiftUIIntrospect */; };
+		D6A4DE242D61744400F7F751 /* SwiftUIIntrospect-Static in Frameworks */ = {isa = PBXBuildFile; productRef = D6A4DE232D61744400F7F751 /* SwiftUIIntrospect-Static */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -202,6 +202,16 @@
 			name = "Embed Foundation Extensions";
 			runOnlyForDeploymentPostprocessing = 0;
 		};
+		D6A4DE1B2D6153C200F7F751 /* Embed Frameworks */ = {
+			isa = PBXCopyFilesBuildPhase;
+			buildActionMask = 2147483647;
+			dstPath = "";
+			dstSubfolderSpec = 10;
+			files = (
+			);
+			name = "Embed Frameworks";
+			runOnlyForDeploymentPostprocessing = 0;
+		};
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
@@ -327,6 +337,10 @@
 		AEADEF722AE94DC3006EB614 /* ToolbarButton.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ToolbarButton.swift; sourceTree = "<group>"; };
 		AEADEF732AE94DC3006EB614 /* Toolbar.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Toolbar.swift; sourceTree = "<group>"; };
 		AECE7F9D2AED1A6800B57267 /* SuggestedTransactions.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SuggestedTransactions.swift; sourceTree = "<group>"; };
+		D6A4DE262D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/WidgetConfiguration.strings"; sourceTree = "<group>"; };
+		D6A4DE272D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/MainInterface.strings"; sourceTree = "<group>"; };
+		D6A4DE282D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "en-GB"; path = "en-GB.lproj/Localizable.strings"; sourceTree = "<group>"; };
+		D6A4DE292D6180B600F7F751 /* en-GB */ = {isa = PBXFileReference; lastKnownFileType = text.plist.stringsdict; name = "en-GB"; path = "en-GB.lproj/Localizable.stringsdict"; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
 /* Begin PBXFrameworksBuildPhase section */
@@ -350,16 +364,16 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				D6A4
```

**File**: `dime.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +6/-23)
```diff
@@ -1,4 +1,5 @@
 {
+  "originHash" : "ae8559a74005595848c7f375a437bfb1a9b6e513a1e16ca5be5d648d5d854e5e",
   "pins" : [
     {
       "identity" : "alamofire",
@@ -50,37 +51,19 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/aheze/Popovers",
       "state" : {
-        "branch" : "main",
-        "revision" : "05033a2a1ab619369756933803f45431eae4f6ab"
-      }
-    },
-    {
-      "identity" : "scrollviewstyle",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/TimmysApp/ScrollViewStyle",
-      "state" : {
-        "revision" : "adc7413f6b32781dc5970c54d1a734cafa230ba7",
-        "version" : "1.0.0"
-      }
-    },
-    {
-      "identity" : "stools",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/TimmysApp/STools",
-      "state" : {
-        "revision" : "ea876036fc53be40f564b24d3c267b447416dc1d",
-        "version" : "1.0.81"
+        "revision" : "de44c4dd7271ec6413fe350f7efadb14e5e18dce",
+        "version" : "1.3.2"
       }
     },
     {
       "identity" : "swiftui-introspect",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/siteline/SwiftUI-Introspect.git",
       "state" : {
-        "branch" : "master",
-        "revision" : "7ef0df639079491ee1aaf6b83b6fd4d08df80393"
+        "revision" : "807f73ce09a9b9723f12385e592b4e0aaebd3336",
+        "version" : "1.3.0"
       }
     }
   ],
-  "version" : 2
+  "version" : 3
 }
```

**File**: `dime/Views/InsightsView.swift` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 //
 
 import Foundation
-import Introspect
+import SwiftUIIntrospect
 import Popovers
 import SwiftUI
 
```

**File**: `dime/Views/LogView.swift` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
 import CloudKitSyncMonitor
 import CoreData
 import Foundation
-import Introspect
+import SwiftUIIntrospect
 import Popovers
 import SwiftUI
 
@@ -657,7 +657,7 @@ struct SearchView: View {
                         .foregroundColor(Color.DarkIcon.opacity(0.8))
                         .accessibility(hidden: true)
                     TextField("Search entry by note", text: $searchQuery)
-                        .introspectTextField { textField in
+                        .introspect(.textField, on: .iOS(.v13, .v14, .v15, .v16, .v17, .v18)) { textField in
                             textField.becomeFirstResponder()
                         }
                         .font(.system(.body, design: .rounded).weight(.regular))
```

---

### Incident Patch 8: `47937d24` (2024-02-16)
**Commit Message**: fix bug - issue #40 - can't delete after typing a dot

**File**: `dime/Components/Transactions/NumberPad.swift` (modified, +1/-1)
```diff
@@ -347,10 +347,10 @@ struct NumberPadTextView: View {
         } else {
             switch decimalValuesAssigned {
                 case .none:
+                    isEditingDecimal = false
                     return
                 case .first:
                     price = Double(Int(price))
-                    isEditingDecimal = false
                     decimalValuesAssigned = .none
                 case .second:
                     price = Double(Int(price * 10)) / 10
```

---

### Incident Patch 9: `e1b18264` (2024-01-27)
**Commit Message**: Fix overlap between search bar and scroll view

**File**: `dime/Views/LogView.swift` (modified, +10/-11)
```diff
@@ -638,16 +638,7 @@ struct SearchView: View {
     @State var searchQuery = ""
 
     var body: some View {
-        ZStack(alignment: .top) {
-            ScrollView {
-                if searchQuery == "" {
-                    EmptyView()
-                } else {
-                    FilteredSearchView(searchQuery: searchQuery)
-                }
-            }
-            .frame(maxWidth: .infinity, maxHeight: .infinity)
-
+        VStack(spacing: 18) {
             HStack(spacing: 9) {
                 HStack {
                     Image(systemName: "magnifyingglass")
@@ -692,6 +683,15 @@ struct SearchView: View {
 //                        .font(.system(size: 18, weight: .medium, design: .rounded))
                 }
             }
+            
+            ScrollView {
+                if searchQuery == "" {
+                    EmptyView()
+                } else {
+                    FilteredSearchView(searchQuery: searchQuery)
+                }
+            }
+            .frame(maxWidth: .infinity, maxHeight: .infinity)
         }
         .padding(15)
         .background(Color.PrimaryBackground)
@@ -729,7 +729,6 @@ struct FilteredSearchView: View {
             ListView(transactions: _transactions)
         }
         .frame(maxHeight: .infinity)
-        .padding(.top, 80)
     }
 
     init(searchQuery: String) {
```

---

### Incident Patch 10: `b4dd82e8` (2023-12-01)
**Commit Message**: Small bug fix

**File**: `dime/Views/InsightsView.swift` (modified, +93/-127)
```diff
@@ -208,121 +208,123 @@ struct HorizontalPieChartView: View {
     }
 
     var body: some View {
-        VStack(alignment: .leading, spacing: 10) {
-            if !categoryFilterMode {
-                Text("Categories")
-                    .font(.system(.callout, design: .rounded).weight(.semibold))
-                    .foregroundColor(Color.SubtitleText)
-
-                GeometryReader { proxy in
-                    HStack(spacing: proxy.size.width * 0.015) {
-                        ForEach(categories) { category in
-                            if category.percent < 0.005 {
-                                EmptyView()
-                            } else {
-                                AnimatedHorizontalBarGraph(category: category, index: categories.firstIndex(of: category) ?? 0)
-                                    .frame(width: (proxy.size.width * (1.0 - (0.015 * Double(categories.count - 1)))) * category.percent)
-                                    .onTapGesture {
-                                        withAnimation(.easeInOut) {
-                                            if categoryFilter == category.category {
-                                                selectedDate = nil
-                                                categoryFilterMode = false
-                                                categoryFilter = nil
-                                            } else {
-                                                selectedDate = nil
-                                                categoryFilterMode = true
-                                                categoryFilter = category.category
-                                                chosenAmount = category.percent * total
-                                                chosenName = category.category.wrappedName
+        if !categories.isEmpty {
+            VStack(alignment: .leading, spacing: 10) {
+                if !categoryFilterMode {
+                    Text("Categories")
+                        .font(.system(.callout, design: .rounded).weight(.semibold))
+                        .foregroundColor(Color.SubtitleText)
+
+                    GeometryReader { proxy in
+                        HStack(spacing: proxy.size.width * 0.015) {
+                            ForEach(categories) { category in
+                                if category.percent < 0.005 {
+                                    EmptyView()
+                                } else {
+                                    AnimatedHorizontalBarGraph(category: category, index: categories.firstIndex(of: category) ?? 0)
+                                        .frame(width: (proxy.size.width * (1.0 - (0.015 * Double(categories.count - 1)))) * category.percent)
+                                        .onTapGesture {
+                                            withAnimation(.easeInOut) {
+                                                if categoryFilter == category.category {
+                                                    selectedDate = nil
+                                                    categoryFilterMode = false
+                                                    categoryFilter = nil
+                                                } else {
+                                                    selectedDate = nil
+                                                    categoryFilterMode = true
+                                                    categoryFilter = category.category
+                                                    chosenAmount = category.percent * total
+                                                    chosenName = category.category.wrappedName
+                                                }
                                             }
                                         }
-                                    }
-                                    .opacity(categoryFilterMode ? (categoryFilter == category.category ? 1 : 0.5) : 1)
-                                    .overlay {
-                                        if categoryFilterMode && categoryFilter == category.category {
-                                            RoundedRectangle(cornerRadius: 6, style: .continuous)
-                                                .stroke(Color.DarkBackground, lineWidth: 1.5)
+                                        .opacity(categoryFilterMode ? (categoryFilter == category.category ? 1 : 0.5) : 1)
+                                        .overlay {
+                                            if categoryFilterMode && categoryFilter == category.category {
+                                                RoundedRectangle(cornerRadius: 6, style: .continuous)
+                                                    .stroke(Color.DarkBackground, lineWidth: 1.5)
+                                            }
                                         }
-                                    }
+                                }
              
```

---

### Incident Patch 11: `38b8cf03` (2023-12-01)
**Commit Message**: New category picker, and some minor visual bug fixes

**File**: `dime.xcodeproj/project.pbxproj` (modified, +20/-16)
```diff
@@ -153,6 +153,7 @@
 		53D6BDE12AF73FAB00F5728E /* SettingsSubviewModifier.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53D6BDE02AF73FAB00F5728E /* SettingsSubviewModifier.swift */; };
 		53DCFAA12A498FBF0063FCDE /* CloudKitSyncMonitor in Frameworks */ = {isa = PBXBuildFile; productRef = 53DCFAA02A498FBF0063FCDE /* CloudKitSyncMonitor */; };
 		53E832E52B0A2CAF000CBBA0 /* InsightsSummaryBlock.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53E832E42B0A2CAF000CBBA0 /* InsightsSummaryBlock.swift */; };
+		53E832E72B0B067B000CBBA0 /* TransactionCategoryPicker.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53E832E62B0B067B000CBBA0 /* TransactionCategoryPicker.swift */; };
 		53EB930E28A65A570026BE28 /* Color.swift in Sources */ = {isa = PBXBuildFile; fileRef = 5327D2B5287C6AFB00F76ADF /* Color.swift */; };
 		53EB930F28A65B250026BE28 /* FontExtension.swift in Sources */ = {isa = PBXBuildFile; fileRef = 53B1D1A4289383B100E28062 /* FontExtension.swift */; };
 		AE5B3D792AEE99E000AB364E /* NumberPad.swift in Sources */ = {isa = PBXBuildFile; fileRef = AE5B3D782AEE99E000AB364E /* NumberPad.swift */; };
@@ -318,6 +319,7 @@
 		53D6BDDE2AF73EF100F5728E /* SettingsHapticsView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsHapticsView.swift; sourceTree = "<group>"; };
 		53D6BDE02AF73FAB00F5728E /* SettingsSubviewModifier.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsSubviewModifier.swift; sourceTree = "<group>"; };
 		53E832E42B0A2CAF000CBBA0 /* InsightsSummaryBlock.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = InsightsSummaryBlock.swift; sourceTree = "<group>"; };
+		53E832E62B0B067B000CBBA0 /* TransactionCategoryPicker.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = TransactionCategoryPicker.swift; sourceTree = "<group>"; };
 		53EB931028A65F670026BE28 /* ExpenditureWidgetExtension.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = ExpenditureWidgetExtension.entitlements; sourceTree = "<group>"; };
 		AE5B3D782AEE99E000AB364E /* NumberPad.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NumberPad.swift; sourceTree = "<group>"; };
 		AEADEF6E2AE94DA3006EB614 /* Toast.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = Toast.swift; sourceTree = "<group>"; };
@@ -655,6 +657,7 @@
 			children = (
 				AECE7F9D2AED1A6800B57267 /* SuggestedTransactions.swift */,
 				AE5B3D782AEE99E000AB364E /* NumberPad.swift */,
+				53E832E62B0B067B000CBBA0 /* TransactionCategoryPicker.swift */,
 			);
 			path = Transactions;
 			sourceTree = "<group>";
@@ -934,6 +937,7 @@
 				5327D2B7287C6AFB00F76ADF /* KeyboardHeightHelper.swift in Sources */,
 				536A2A172A5A7C5D00D81E02 /* OffsetHelper.swift in Sources */,
 				53A4147B28B66265008C30E7 /* SceneDelegate.swift in Sources */,
+				53E832E72B0B067B000CBBA0 /* TransactionCategoryPicker.swift in Sources */,
 				5327D2D6287C6B5E00F76ADF /* CategoryView.swift in Sources */,
 				53B9079B2AE818710001F496 /* RoundedTriangle.swift in Sources */,
 				533D1C3C2AE7BB6900894764 /* DynamicType.swift in Sources */,
@@ -1080,7 +1084,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_ENTITLEMENTS = BudgetIntent/BudgetIntent.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 12;
+				CURRENT_PROJECT_VERSION = 1;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntent/Info.plist;
@@ -1092,7 +1096,7 @@
 					"@executable_path/Frameworks",
 					"@executable_path/../../Frameworks",
 				);
-				MARKETING_VERSION = 2.1.3;
+				MARKETING_VERSION = 2.1.4;
 				PRODUCT_BUNDLE_IDENTIFIER = com.rafaelsoh.dime.BudgetIntent;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SKIP_INSTALL = YES;
@@ -1112,7 +1116,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_ENTITLEMENTS = BudgetIntent/BudgetIntent.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 12;
+				CURRENT_PROJECT_VERSION = 1;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntent/Info.plist;
@@ -1124,7 +1128,7 @@
 					"@executable_path/Frameworks",
 					"@executable_path/../../Frameworks",
 				);
-				MARKETING_VERSION = 2.1.3;
+				MARKETING_VERSION = 2.1.4;
 				PRODUCT_BUNDLE_IDENTIFIER = com.rafaelsoh.dime.BudgetIntent;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SKIP_INSTALL = YES;
@@ -1143,7 +1147,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = BudgetIntentUI/BudgetIntentUI.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 12;
+				CURRENT_PROJECT_VERSION = 1;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntentUI/Info.plist;
@@ -1155,7 +1159,7 @@
 					"@executable_path
```

**File**: `dime/Components/Transactions/TransactionCategoryPicker.swift` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+//
+//  TransactionCategoryPicker.swift
+//  dime
+//
+//  Created by Rafael Soh on 20/11/23.
+//
+
+import Foundation
+import SwiftUI
+
+struct NewCategoryPickerView: View {
+    @Binding var category: Category?
+    @Binding var showPicker: Bool
+    @Binding var showingCategoryView: Bool
+    @FetchRequest private var categories: FetchedResults<Category>
+    @Environment(\.colorScheme) var colorScheme
+
+    let layout = [
+        GridItem(.flexible(), spacing: 10),
+        GridItem(.flexible())
+    ]
+
+    var body: some View {
+        ScrollView(showsIndicators: false) {
+            LazyVGrid(columns: layout, spacing: 10) {
+                ForEach(categories) { item in
+                    HStack(spacing: 7) {
+                        Text(item.wrappedEmoji)
+                            .font(.system(.subheadline, design: .rounded))
+
+                        Text(item.wrappedName)
+                            .font(.system(.body, design: .rounded).weight(.semibold))
+                            .lineLimit(1)
+                    }
+                    .id(item.id)
+                    .frame(maxWidth: .infinity, alignment: .leading)
+                    .padding(.horizontal, 11)
+                    .padding(.vertical, 9)
+                    .foregroundColor(Color(hex: item.wrappedColour))
+                    .background(
+                        Color(hex: item.wrappedColour).opacity(0.35),
+                        in: RoundedRectangle(cornerRadius: 11.5, style: .continuous)
+                    )
+                    .contentShape(Rectangle())
+                    .overlay {
+                        if item == category {
+                            RoundedRectangle(cornerRadius: 11.5, style: .continuous)
+                                .strokeBorder(Color(hex: item.wrappedColour),
+                                              style: StrokeStyle(lineWidth: 2))
+                        }
+                    }
+                    .onTapGesture {
+                        withAnimation {
+                            category = item
+                        }
+
+                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
+                            withAnimation {
+                                showPicker = false
+                            }
+                        }
+                    }
+                    .opacity(category != nil ? (category == item ? 1 : 0.5) : 1)
+
+                }
+            }
+        }
+        .keyboardAwareHeight(showToolbar: false)
+        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
+        .overlay(alignment: .bottom) {
+            HStack(spacing: 4) {
+                Image(systemName: "pencil")
+                    .font(.system(.body, design: .rounded).weight(.semibold))
+                Text("Edit")
+                    .font(.system(.body, design: .rounded).weight(.semibold))
+            }
+            .padding(.vertical, 9)
+            .padding(.horizontal, 18)
+            .foregroundColor(Color.SubtitleText)
+            .background(
+                RoundedRectangle(cornerRadius: 11.5, style: .continuous).fill(Color.SecondaryBackground).shadow(
+                    color: colorScheme == .light ? Color.Outline  : Color.clear, radius: 6)
+            )
+//            .background(
+//                Color.SecondaryBackground,
+//                in: RoundedRectangle(cornerRadius: 11.5, style: .continuous)
+//            )
+//            .overlay {
+//                RoundedRectangle(cornerRadius: 11.5, style: .continuous)
+//                    .strokeBorder(Color.Outline, style: StrokeStyle(lineWidth: 2, dash: [10]))
+//            }
+            .contentShape(Rectangle())
+            .onTapGesture {
+                let impactMed = UIImpactFeedbackGenerator(style: .light)
+                impactMed.impactOccurred()
+                showPicker = false
+                showingCategoryView = true
+            }
+            .padding(.bottom, 15)
+        }
+
+    }
+
+    init(
+        category: Binding<Category?>?, showPicker: Binding<Bool>, showSheet: Binding<Bool>,
+        income: Bool
+    ) {
+        _categories = FetchRequest<Category>(
+            sortDescriptors: [
+                SortDescriptor(\.order, order: .reverse)
+            ], predicate: NSPredicate(format: "income = %d", income))
+
+        _category = category ?? Binding.constant(nil)
+        _showPicker = showPicker
+        _showingCategoryView = showSheet
+    }
+}
```

**File**: `dime/Data/DataController.swift` (modified, +26/-23)
```diff
@@ -34,22 +34,25 @@ class DataController: ObservableObject {
 
     init() {
         let description = NSPersistentStoreDescription()
+
         description.shouldMigrateStoreAutomatically = true
         description.shouldInferMappingModelAutomatically = true
         description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
         description.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)
 
-        let keyValueStore = NSUbiquitousKeyValueStore.default
-
-        if keyValueStore.object(forKey: "icloud_sync") == nil {
-            keyValueStore.set(true, forKey: "icloud_sync")
-        }
+//        let keyValueStore = NSUbiquitousKeyValueStore.default
+//
+//        if keyValueStore.object(forKey: "icloud_sync") == nil {
+//            keyValueStore.set(true, forKey: "icloud_sync")
+//        }
+//
+//        if !keyValueStore.bool(forKey: "icloud_sync") {
+//            description.cloudKitContainerOptions = nil
+//        } else {
+//            description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(containerIdentifier: "iCloud.com.rafaelsoh.dime")
+//        }
 
-        if !keyValueStore.bool(forKey: "icloud_sync") {
-            description.cloudKitContainerOptions = nil
-        } else {
-            description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(containerIdentifier: "iCloud.com.rafaelsoh.dime")
-        }
+        description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(containerIdentifier: "iCloud.com.rafaelsoh.dime")
 
         let groupID = "group.com.rafaelsoh.dime"
 
@@ -68,19 +71,19 @@ class DataController: ObservableObject {
             self.container.viewContext.automaticallyMergesChangesFromParent = true
         }
 
-        #if DEBUG
-            do {
-                // Use the container to initialize the development schema.
-                try container.initializeCloudKitSchema(options: [])
-            } catch {
-                // Handle any errors.
-            }
-        #endif
-//        do {
-//            try container.initializeCloudKitSchema()
-//        } catch {
-//            print(error)
-//        }
+//        #if DEBUG
+//            do {
+//                // Use the container to initialize the development schema.
+//                try container.initializeCloudKitSchema(options: [])
+//            } catch {
+//                // Handle any errors.
+//            }
+//        #endif
+////        do {
+////            try container.initializeCloudKitSchema()
+////        } catch {
+////            print(error)
+////        }
     }
 
     // internal variables
```

**File**: `dime/Utilities/FontExtension.swift` (modified, +23/-0)
```diff
@@ -6,8 +6,31 @@
 //
 
 import UIKit
+import SwiftUI
 
 extension UIFont {
+
+    static func getBodyFontSize(dynamicTypeSize: DynamicTypeSize) -> CGFloat {
+        switch dynamicTypeSize {
+        case .xSmall:
+            return 14
+        case .small:
+            return 15
+        case .medium:
+            return 16
+        case .large:
+            return 17
+        case .xLarge:
+            return 19
+        case .xxLarge:
+            return 21
+        case .xxxLarge:
+            return 23
+        default:
+            return 23
+        }
+    }
+
     class func rounded(ofSize size: CGFloat, weight: UIFont.Weight) -> UIFont {
         let systemFont = UIFont.systemFont(ofSize: size, weight: weight)
         let font: UIFont
```

**File**: `dime/Views/HomeView.swift` (modified, +0/-19)
```diff
@@ -137,25 +137,6 @@ struct HomeView: View {
                 showPopup = newValue
             }
         }
-//        .onChange(of: transactionManager.toDelete) { newValue in
-//            if let unwrapped = newValue {
-//                if transactionManager.deletionType == .instant {
-//                    withAnimation(.easeInOut(duration: 0.5)) {
-//                        moc.delete(unwrapped)
-//                    }
-//                    transactionManager.showToast = true
-//                } else {
-//                    transactionManager.showPopup = true
-//                }
-//            }
-//        }
-//        .fullScreenCover(isPresented: $transactionManager.showPopup, onDismiss: {
-//            transactionManager.toDelete = nil
-//        }) {
-//            if let unwrapped = transactionManager.toDelete {
-//                DeleteTransactionAlert(toDelete: unwrapped, stopRecurring: (transactionManager.future && unwrapped.wrappedDate < Date.now && unwrapped.recurringType > 0), showToast: $transactionManager.showToast, confirmDelete: $transactionManager.confirmedDelete)
-//            }
-//        }
         .fullScreenCover(item: $transactionManager.toEdit, onDismiss: {
             transactionManager.toEdit = nil
         }) { transaction in
```

**File**: `dime/Views/InsightsView.swift` (modified, +3/-7)
```diff
@@ -1117,14 +1117,7 @@ struct WeekGraphView: View {
                     selectedDate = nil
                     categoryFilterMode = false
                 }
-//                .frame(height: getGraphHeight(incomeTracking: incomeTracking, incomeFiltering: incomeFiltering, multiplier: multiplier), alignment: .top)
                 .padding(.bottom, incomeFiltering ? 5 : 10)
-//
-//                if selectedDate == nil && incomeFiltering {
-//                    HorizontalPieChartView(date: showingWeek, categoryFilter: $categoryFilter, categoryFilterMode: $categoryFilterMode, selectedDate: $selectedDate, chosenAmount: $chosenCategoryAmount, chosenName: $chosenCategoryName, type: .week, income: income)
-//                        .padding(.horizontal, 30)
-//                        .id(refreshID1)
-//                }
 
                 Group {
                     if !incomeFiltering {
@@ -1135,6 +1128,7 @@ struct WeekGraphView: View {
                         if selectedDate == nil {
                             HorizontalPieChartView(date: showingWeek, categoryFilter: $categoryFilter, categoryFilterMode: $categoryFilterMode, selectedDate: $selectedDate, chosenAmount: $chosenCategoryAmount, chosenName: $chosenCategoryName, type: .week, income: income)
                                 .padding(.horizontal, 30)
+                                .padding(.bottom, 70)
                                 .id(refreshID1)
 
                             if categoryFilterMode {
@@ -1561,6 +1555,7 @@ struct MonthGraphView: View {
                         if selectedDate == nil {
                             HorizontalPieChartView(date: showingMonth, categoryFilter: $categoryFilter, categoryFilterMode: $categoryFilterMode, selectedDate: $selectedDate, chosenAmount: $chosenCategoryAmount, chosenName: $chosenCategoryName, type: .month, income: income)
                                 .padding(.horizontal, 30)
+                                .padding(.bottom, 70)
                                 .id(refreshID1)
 
                             if categoryFilterMode {
@@ -1969,6 +1964,7 @@ struct YearGraphView: View {
                         if selectedDate == nil {
                             HorizontalPieChartView(date: showingYear, categoryFilter: $categoryFilter, categoryFilterMode: $categoryFilterMode, selectedDate: $selectedDate, chosenAmount: $chosenCategoryAmount, chosenName: $chosenCategoryName, type: .year, income: income)
                                 .padding(.horizontal, 30)
+                                .padding(.bottom, 70)
                                 .id(refreshID1)
 
                             if categoryFilterMode {
```

**File**: `dime/Views/Settings/Settings Subviews/SettingsHapticsView.swift` (modified, +1/-0)
```diff
@@ -87,6 +87,7 @@ struct SettingsHapticsView: View {
         .modifier(SettingsSubviewModifier())
         .onChange(of: hapticType) { newValue in
             if newValue == 2 {
+                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
 
                 withAnimation(.easeInOut(duration: 0.1)) {
                     alternateShake = true
```

**File**: `dime/Views/TransactionView.swift` (modified, +129/-148)
```diff
@@ -203,6 +203,12 @@ struct TransactionView: View {
         }
     }
 
+    var widthOfCategoryButton: CGFloat {
+        let fontSize = UIFont.getBodyFontSize(dynamicTypeSize: dynamicTypeSize)
+
+        return "Category".widthOfRoundedString(size: fontSize, weight: .semibold) + 50
+    }
+
     var capsuleWidth: CGFloat {
         if dynamicTypeSize > .xLarge {
             return 120
@@ -227,13 +233,11 @@ struct TransactionView: View {
                         HStack(spacing: 6.5) {
                             Image(systemName: toastImage)
                                 .font(.system(.subheadline, design: .rounded).weight(.semibold))
-                            //                                .font(.system(size: 15, weight: .semibold))
                                 .foregroundColor(Color.AlertRed)
 
                             Text(toastTitle)
                                 .font(.system(.body, design: .rounded).weight(.semibold))
                                 .lineLimit(1)
-                            //                                .font(.system(size: 16, weight: .semibold, design: .rounded))
                                 .foregroundColor(Color.AlertRed)
                         }
                         .padding(8)
@@ -255,7 +259,6 @@ struct TransactionView: View {
                                     .font(.system(.body, design: .rounded).weight(.semibold))
 
                                     .lineLimit(1)
-                                //                                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                                     .foregroundColor(income == false ? Color.PrimaryText : Color.SubtitleText)
                                     .padding(6)
                                     .frame(width: capsuleWidth)
@@ -463,14 +466,12 @@ struct TransactionView: View {
                                 } label: {
                                     HStack(spacing: 3) {
                                         Text(transaction.wrappedNote)
-//                                            .font(.system(size: 17.5, weight: .semibold, design: .rounded))
                                             .foregroundStyle(Color.PrimaryText)
                                             .lineLimit(1)
                                             .padding(.vertical, 3.5)
                                             .padding(.horizontal, 7)
 
                                         Text("\(currencySymbol)\(Int(round(transaction.wrappedAmount)))")
-//                                            .font(.system(size: 17, weight: .semibold, design: .rounded))
                                             .lineLimit(1)
                                             .foregroundStyle(Color(hex: transaction.wrappedColour))
                                             .padding(.vertical, 3.5)
@@ -510,8 +511,6 @@ struct TransactionView: View {
                             .foregroundColor(Color.SubtitleText)
                             .font(.system(.subheadline, design: .rounded).weight(.semibold))
 
-                            //                                    .font(.system(size: 16, weight: .semibold, design: .rounded))
-
                             Group {
                                 if isDateToday(date: date) {
                                     Text("Today, \(getDateString(date: date))")
@@ -523,15 +522,11 @@ struct TransactionView: View {
                             }
                             .font(.system(.body, design: .rounded).weight(.semibold))
 
-                            //                            .font(.system(size: 17.5, weight: .semibold, design: .rounded))
-
                             if showTime {
                                 Spacer()
 
                                 Text(getTimeString(date: date))
                                     .font(.system(.body, design: .rounded).weight(.semibold))
-
-                                //                                    .font(.system(size: 17.5, weight: .semibold, design: .rounded))
                             }
                         }
                         .foregroundColor(Color.PrimaryText)
@@ -553,11 +548,9 @@ struct TransactionView: View {
                             HStack(spacing: 4) {
                                 Image(systemName: "plus")
                                     .font(.system(.subheadline, design: .rounded).weight(.semibold))
-                                //                                    .font(.system(size: 16, weight: .semibold, design: .rounded))
+
                                 Text("Category")
                                     .font(.system(.body, design: .rounded).weight(.semibold))
-
-                                //                                    .font(.system(size: 17.5, weight: .semibold, design: .rounded))
                                     .lineLimit(1)
                             }
                           
```

---

### Incident Patch 12: `653cfd78` (2023-11-17)
**Commit Message**: Minor bug fixes for dollar views

**File**: `dime.xcodeproj/project.pbxproj` (modified, +8/-8)
```diff
@@ -1076,7 +1076,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_ENTITLEMENTS = BudgetIntent/BudgetIntent.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntent/Info.plist;
@@ -1108,7 +1108,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_ENTITLEMENTS = BudgetIntent/BudgetIntent.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntent/Info.plist;
@@ -1139,7 +1139,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = BudgetIntentUI/BudgetIntentUI.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntentUI/Info.plist;
@@ -1166,7 +1166,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = BudgetIntentUI/BudgetIntentUI.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntentUI/Info.plist;
@@ -1314,7 +1314,7 @@
 				ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;
 				CODE_SIGN_ENTITLEMENTS = dime/dime.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_ASSET_PATHS = "\"dime/Preview Content\"";
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				ENABLE_PREVIEWS = YES;
@@ -1355,7 +1355,7 @@
 				ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;
 				CODE_SIGN_ENTITLEMENTS = dime/dime.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_ASSET_PATHS = "\"dime/Preview Content\"";
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				ENABLE_PREVIEWS = YES;
@@ -1395,7 +1395,7 @@
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
 				CODE_SIGN_ENTITLEMENTS = ExpenditureWidgetExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ExpenditureWidget/Info.plist;
@@ -1426,7 +1426,7 @@
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
 				CODE_SIGN_ENTITLEMENTS = ExpenditureWidgetExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 11;
+				CURRENT_PROJECT_VERSION = 12;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ExpenditureWidget/Info.plist;
```

**File**: `dime/Views/InsightsView.swift` (modified, +1/-1)
```diff
@@ -2251,7 +2251,7 @@ struct InsightsDollarView: View {
             if netPositive {
                 return "+\(currencySymbol)"
             } else {
-                return "+\(currencySymbol)"
+                return "-\(currencySymbol)"
             }
         } else {
             return currencySymbol
```

**File**: `dime/Views/LogView.swift` (modified, +1/-1)
```diff
@@ -391,7 +391,7 @@ struct NumberView: AnimatableModifier {
                     .font(.system(.largeTitle, design: .rounded))
                     .foregroundColor(Color.SubtitleText) +
 
-                Text("\(number, specifier: showCents && number < 1000  ? "%.2f" : "%.0f")")
+                Text("\(number, specifier: showCents  ? "%.2f" : "%.0f")")
                     .font(.system(size: fontSize, weight: .regular, design: .rounded))
                     .foregroundColor(Color.PrimaryText)
             }
```

---

### Incident Patch 13: `46945935` (2023-11-07)
**Commit Message**: Minor bug fix for testflight

**File**: `dime.xcodeproj/project.pbxproj` (modified, +8/-8)
```diff
@@ -1076,7 +1076,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_ENTITLEMENTS = BudgetIntent/BudgetIntent.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntent/Info.plist;
@@ -1108,7 +1108,7 @@
 				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
 				CODE_SIGN_ENTITLEMENTS = BudgetIntent/BudgetIntent.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntent/Info.plist;
@@ -1139,7 +1139,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = BudgetIntentUI/BudgetIntentUI.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntentUI/Info.plist;
@@ -1166,7 +1166,7 @@
 			buildSettings = {
 				CODE_SIGN_ENTITLEMENTS = BudgetIntentUI/BudgetIntentUI.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = BudgetIntentUI/Info.plist;
@@ -1314,7 +1314,7 @@
 				ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;
 				CODE_SIGN_ENTITLEMENTS = dime/dime.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_ASSET_PATHS = "\"dime/Preview Content\"";
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				ENABLE_PREVIEWS = YES;
@@ -1355,7 +1355,7 @@
 				ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;
 				CODE_SIGN_ENTITLEMENTS = dime/dime.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_ASSET_PATHS = "\"dime/Preview Content\"";
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				ENABLE_PREVIEWS = YES;
@@ -1395,7 +1395,7 @@
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
 				CODE_SIGN_ENTITLEMENTS = ExpenditureWidgetExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ExpenditureWidget/Info.plist;
@@ -1426,7 +1426,7 @@
 				CLANG_CXX_LANGUAGE_STANDARD = "gnu++20";
 				CODE_SIGN_ENTITLEMENTS = ExpenditureWidgetExtension.entitlements;
 				CODE_SIGN_STYLE = Automatic;
-				CURRENT_PROJECT_VERSION = 9;
+				CURRENT_PROJECT_VERSION = 11;
 				DEVELOPMENT_TEAM = 5UNNTHMF44;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_FILE = ExpenditureWidget/Info.plist;
```

**File**: `dime/Views/LogView.swift` (modified, +1/-26)
```diff
@@ -386,20 +386,13 @@ struct NumberView: AnimatableModifier {
 
     func body(content _: Content) -> some View {
         HStack(alignment: .lastTextBaseline, spacing: 2) {
-            let numberStrings = splitDoubleToStrings(number, showCents: showCents)
-
             Group {
-
                 Text(netTotal ? (positive ? "+\(currencySymbol)" : "-\(currencySymbol)") : currencySymbol)
                     .font(.system(.largeTitle, design: .rounded))
                     .foregroundColor(Color.SubtitleText) +
 
-                Text(numberStrings.wholePart)
+                Text("\(number, specifier: showCents && number < 1000  ? "%.2f" : "%.0f")")
                     .font(.system(size: fontSize, weight: .regular, design: .rounded))
-                    .foregroundColor(Color.PrimaryText) +
-
-                Text(numberStrings.decimalPart)
-                    .font(.system(.largeTitle, design: .rounded))
                     .foregroundColor(Color.PrimaryText)
             }
         }
@@ -409,24 +402,6 @@ struct NumberView: AnimatableModifier {
     }
 }
 
-func splitDoubleToStrings(_ num: Double, showCents: Bool) -> (wholePart: String, decimalPart: String) {
-    let formatter = NumberFormatter()
-    formatter.numberStyle = .decimal
-    formatter.minimumFractionDigits = 2
-    formatter.maximumFractionDigits = 2
-    let formattedNum = formatter.string(from: NSNumber(value: num))!
-    let components = formattedNum.split(separator: ".")
-    let wholePart = String(components[0])
-
-    if showCents {
-        let decimalPart = "." + (components.count > 1 ? String(components[1]) : "00")
-        return (wholePart, decimalPart)
-    } else {
-        return (wholePart, "")
-    }
-
-}
-
 struct LogInsightsView: View {
     @EnvironmentObject var dataController: DataController
     @Environment(\.dynamicTypeSize) var dynamicTypeSize
```

---

### Incident Patch 14: `ea32294a` (2023-11-01)
**Commit Message**: Fixed decimal bug when editing transactions

**File**: `dime/Views/NewBudgetView.swift` (modified, +10/-74)
```diff
@@ -574,80 +574,6 @@ struct BrandNewBudgetView: View {
                     ) {
                       submit()
                     }
-//                    GeometryReader { proxy in
-//                        VStack(spacing: proxy.size.height * 0.04) {
-//                            ForEach(numberArray, id: \.self) { array in
-//                                HStack(spacing: proxy.size.width * 0.05) {
-//                                    ForEach(array, id: \.self) { singleNumber in
-//                                        NumberButton(number: singleNumber, size: proxy.size)
-//                                    }
-//                                }
-//                            }
-//
-//                            HStack(spacing: proxy.size.width * 0.05) {
-//                                if numberEntryType == 1 {
-//                                    Button {
-//                                        if numbers.count == 3 {
-//                                            numbers.remove(at: numbers.count - 1)
-//                                            numbers.insert(0, at: 0)
-//                                        } else {
-//                                            numbers.remove(at: numbers.count - 1)
-//                                        }
-//                                    } label: {
-//                                        Image("tag-cross")
-//                                            .resizable()
-//                                            .frame(width: 32, height: 32)
-//                                            .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
-//                                            .background(Color.DarkBackground)
-//                                            .foregroundColor(Color.LightIcon)
-//                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
-//                                    }
-//                                } else {
-//                                    Button {
-//                                        if numbers1.isEmpty {
-//                                            numbers1.append("0")
-//                                            numbers1.append(".")
-//                                        } else if numbers1.contains(".") {
-//                                            return
-//                                        } else {
-//                                            numbers1.append(".")
-//                                        }
-//                                    } label: {
-//                                        Text(".")
-//                                            .font(.system(size: 34, weight: .regular, design: .rounded))
-//                                            .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
-//                                            .background(Color.SecondaryBackground)
-//                                            .foregroundColor(Color.PrimaryText)
-//                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
-//                                            .opacity(numbers1.contains(".") ? 0.6 : 1)
-//                                    }
-//                                    .disabled(numbers1.contains("."))
-//                                }
-//
-//                                NumberButton(number: 0, size: proxy.size)
-//
-//                                Button {
-//                                    submit()
-//                                } label: {
-//                                    Group {
-//                                        if #available(iOS 17.0, *) {
-//                                            Image(systemName: "checkmark.square.fill")
-//                                                .font(.system(size: 30, weight: .medium, design: .rounded))
-//                                                .symbolEffect(.bounce.up.byLayer, value: budgetAmount != 0)
-//                                        } else {
-//                                            Image(systemName: "checkmark.square.fill")
-//                                                .font(.system(size: 30, weight: .medium, design: .rounded))
-//                                        }
-//                                    }
-//                                    .frame(width: proxy.size.width * 0.3, height: proxy.size.height * 0.22)
-//                                    .foregroundColor(Color.LightIcon)
-//                                    .background(Color.DarkBackground, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
-//                                }
-//                            }
-//                        }
-//                        .frame(width: proxy.size.width, height: proxy.size.height)
-//                    }
-//                    .frame(height: UIScreen.main.bounds.
```

**File**: `dime/Views/TransactionView.swift` (modified, +5/-0)
```diff
@@ -876,6 +876,11 @@ struct TransactionView: View {
                     repeatCoefficient = Int(transaction.recurringCoefficient)
                     price = transaction.wrappedAmount
 
+                    if transaction.wrappedAmount.truncatingRemainder(dividingBy: 1) > 0 && numberEntryType == 2 {
+                        isEditingDecimal = true
+                        decimalValuesAssigned = .second
+                    }
+
                     if transaction.wrappedDate > Date.now {
                         animateIcon = true
                     }
```

---

### Incident Patch 15: `cba64ce5` (2023-10-28)
**Commit Message**: Fix issues where app crashes when number is spammed then deleted

**File**: `dime/Views/TransactionView.swift` (modified, +3/-0)
```diff
@@ -994,6 +994,9 @@ struct TransactionView: View {
     @ViewBuilder
     func NumberButton(number: Int, size: CGSize) -> some View {
         Button {
+            if price >= Double(Int.max) / 100 {
+                return
+            }
             if numberEntryType == 1 {
                 price *= 10
                 price += Double(number) / 100
```

#### Recent Merged Pull Requests:
- **PR #103** (closed): feat:Migrate from core data to swift data (@xurble)
- **PR #77** (2025-03-29): Fix: #72 Cannot delete 0 or decimal at last digit (@nouraiztee)
- **PR #63** (closed): Fix build and update introspect (@selfsigned)
- **PR #61** (closed): Update TransactionView.swift and TransactionCategoryPicker.swift (@yinuoyang01)
- **PR #48** (2025-03-16): fix bug - issue #40 - can't delete after typing a dot (@DariusC9)
- **PR #47** (2025-03-16): Fix overlap between search bar and scroll view (@fuji37450)
- **PR #42** (2025-03-15): Add show expense or income sign option (@khaledosama999)
- **PR #41** (closed): Refactor localization (@lutzzdias)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
