# Forensic Learning Record (Deep Inspection): superhighfives/pika

> **Canonical Artifact**: `07_PROJECT_LEARNING/superhighfives-pika-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/superhighfives/pika](https://github.com/superhighfives/pika))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:43:53.176Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `superhighfives/pika`
- **Description**: An open-source colour picker app for macOS
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2580 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Pika/AppDelegate.swift`
```
import Cocoa
import Defaults
import KeyboardShortcuts
import LaunchAtLogin
import SwiftUI
#if TARGET_SPARKLE
    import Sparkle
#endif

class AppDelegate: NSObject, NSApplicationDelegate {
    /// The live app delegate. `NSApp.delegate` cannot be relied on here: under
    /// `@NSApplicationDelegateAdaptor`, AppKit's `NSApp.delegate` is SwiftUI's own
    /// forwarding wrapper (`SwiftUI.AppDelegate`), so `NSApp.delegate as? AppDelegate`
    /// is always `nil` and any call chained off it silently no-ops. Capture the real
    /// instance on launch and reach it through here instead.
    weak static var shared: AppDelegate?

    var eyedroppers: Eyedroppers!

    let notificationCenter = NotificationCenter.default
    let windowCoordinator = WindowCoordinator()
    let statusBarController = StatusBarController()

    func setupAppMode() {
        var currentMode = Defaults[.appMode].activationPolicy
        NSApp.setActivationPolicy(currentMode)
        Defaults.observe(.appMode) { [weak self] change in
            guard let self = self else { return }
            let newMode = change.newValue.activationPolicy
            if newMode != currentMode {
                currentMode = newMode
                NSApp.setActivationPolicy(newMode)
                NSApp.activate(ignoringOtherApps: true)
                if change.newValue == .regular {
                    DispatchQueue.main.asyncAfter(deadline: .now()) {
                        NSApp.unhide(self)
                        if let window = NSApp.windows.first {
                            if window.canBecomeKey {
                                window.makeKeyAndOrderFront(self)
                            }
                            window.setIsVisible(true)
                        }
                    }
                }
            }
            if change.oldValue != change.newValue {
                if change.newValue.usesPopover {
                    self.windowCoordinator.hideMainWindow()
                    self.windowCoordinator.removeMainWindowContent()
                    self.statusBarController.attachPopover(
                        rootView: PopoverContentView(eyedroppers: self.eyedroppers)
                    )
                } else if change.oldValue.usesPopover {
                    self.statusBarController.detachPopover()
                    self.windowCoordinator.installMainWindowContent()
                }
            }
        }.tieToLifetime(of: self)
    }

    func applicationWillFinishLaunching(_: Notification) {
        AppDelegate.shared = self
        NSApp.setActivationPolicy(.prohibited)
        NSAppleEventManager.shared().setEventHandler(
            URLSchemeHandler.shared,
            andSelector: #selector(URLSchemeHandler.handle(event:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
    }

    func applicationDidFinishLaunching(_: Notification) {
        LaunchAtLogin.migrateIfNeeded()
        migrateHistoryToPalettes()
        removeUpdatesMenuItemIfNeeded()

        eyedroppers = Eyedroppers()
        setupInterface()
        setupAppMode()
        registerTogglePikaShortcut()
        presentSplashIfNeeded()
        validateColorSpace()
        showPikaIfConfigured()
        registerGlobalKeyMonitor()
    }

    private func removeUpdatesMenuItemIfNeeded() {
        #if TARGET_MAS
            if let mainMenu = NSApp.mainMenu?.item(withTitle: PikaText.textAppName)?.submenu {
                if let checkForUpdatesMenuItem = mainMenu.item(withTitle: "\(PikaText.textMenuUpdates)…") {
                    mainMenu.removeItem(checkForUpdatesMenuItem)
                }
            }
        #endif
    }

    private func setupInterface() {
        windowCoordinator.setupMainWindow(eyedroppers: eyedroppers)

        statusBarController.setup()
        statusBarController.onToggle = { [weak self] in self?.windowCoordinator.togglePopover() }

        if Defaults[.appMode].usesPopover {
            statusBarController.attachPopover(rootView: PopoverContentView(eyedroppers: eyedroppers))
        } else {
            windowCoordinator.installMainWindowContent()
        }
    }

    private func registerTogglePikaShortcut() {
        KeyboardShortcuts.onKeyUp(for: .togglePika) { [] in
            if Defaults[.viewedSplash] {
                NSApp.sendAction(#selector(AppDelegate.triggerPickForeground), to: nil, from: nil)
            }
        }
    }

    private func presentSplashIfNeeded() {
        if !Defaults[.viewedSplash] {
            openSplashWindow(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func validateColorSpace() {
        if !NSColorSpace.availableColorSpaces(with: .rgb).contains(Defaults[.colorSpace]) {
            Defaults[.colorSpace] = Defaults.Keys.colorSpace.defaultValue
        }
    }

    private func showPikaIfConfigured() {
        if Defaults[.alwaysShowOnLaunch], !Defaults[.appMode].usesPopover {
            showPika(self)
        }
    }

    private func registerGlobalKeyMonitor() {
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            // History drawer navigation (existing behaviour)
            if Defaults[.historyDrawerVisible] {
                let isInTextField = (NSApp.keyWindow?.firstResponder as? NSResponder)
                    .map { $0 is NSTextView || $0 is NSTextField } ?? false
                if !isInTextField {
                    switch event.keyCode {
                    case 123:
                        self.notificationCenter.post(name: .historyNext, object: self)
                        return nil
                    case 124:
                        self.notificationCenter.post(name: .historyPrevious, object: self)
                        return nil
                    case 51:
                        self.notificationCenter.post(name: .historyDelete, object: self)
                        return nil
                    default:
                        break
                    }
                }
            }

            // In popover mode neither `NSApp.mainMenu.performKeyEquivalent` nor SwiftUI's
            // command-bound `.keyboardShortcut` fire while the popover panel is the key
            // window of an `.accessory` app — only `.keyboardShortcut` bindings attached to
            // views *inside* the popover are reachable. Dispatch the canonical shortcuts
            // (`PikaShortcuts.all`) manually here so popover behaviour matches menubar/dock.
            let isInTextField = (NSApp.keyWindow?.firstResponder as? NSResponder)
                .map { $0 is NSTextView || $0 is NSTextField } ?? false
            if Defaults[.appMode].usesPopover, self.statusBarController.isPopoverShown,
               !isInTextField, let shortcut = PikaShortcuts.match(event)
            {
                NSApp.sendAction(shortcut.action, to: nil, from: nil)
                return nil
            }

            return event
        }
    }

    func applicationShouldHandleReopen(_: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if !hasVisibleWindows {
            if Defaults[.appMode].usesPopover {
                statusBarController.showPopover()
            } else {
                windowCoordinator.pikaWindow.makeKeyAndOrderFront(self)
            }
        }
        return true
    }

    func applicationSupportsSecureRestorableState(_: NSApplication) -> Bool {
        true
    }

    // MARK: - Migration

    private func migrateHistoryToPalettes() {
        let existing = Defaults[.colorHistory]
        guard !existing.isEmpty else { return }
        let history = Palette(id: UUID(), name: nil, pairs: existing, createdAt: Date())
        var palettes = Defaults[.palettes]
        if palettes.isEmpty {
            palettes = [history]
        } else {
            palettes[0] = Palette(
                id: palettes[0].id,
                name: palettes[0].name,
                pairs: existing + palettes[0].pairs,
                createdAt: palettes[0].createdAt
            )
        }
        Defaults[.palettes] = palettes
        Defaults[.colorHistory] = []
    }
}

// MARK: - Window forwarding

extension AppDelegate {
    @objc func closeSplashWindow() { windowCoordinator.closeSplashWindow() }
    @objc func togglePopover(_: AnyObject?) { windowCoordinator.togglePopover() }

    @IBAction func openAboutWindow(_: Any?) { windowCoordinator.openAboutWindow() }
    @IBAction func openHelpWindow(_: Any?) { windowCoordinator.openHelpWindow() }
    @IBAction func openPreferencesWindow(_: Any?) { windowCoordinator.openPreferencesWindow() }
    @IBAction func openSplashWindow(_: Any?) { windowCoordinator.openSplashWindow() }
    @IBAction func showPika(_: Any) { windowCoordinator.showPika() }
    @IBAction func hidePika(_: Any) { windowCoordinator.hidePika() }
    @IBAction func showPopover(_: Any) { statusBarController.showPopover() }
}

// MARK: - Notification dispatch

extension AppDelegate {
    @IBAction func triggerPickForeground(_: Any) {
        notificationCenter.post(name: .triggerPickForeground, object: self)
    }

    @IBAction func triggerPickBackground(_: Any) {
        notificationCenter.post(name: .triggerPickBackground, object: self)
    }

    @IBAction func triggerPickContrast(_: Any) {
        notificationCenter.post(name: .triggerPickForeground, object: self, userInfo: ["chain": true])
    }

    @IBAction func triggerCopyForeground(_: Any) {
        notificationCenter.post(name: .triggerCopyForeground, object: self)
    }

    @IBAction func triggerCopyBackground(_: Any) {
        notificationCenter.post(name: .triggerCopyBackground, object: self)
    }

    @IBAction func triggerSystemPickerForeground(_: Any) {
        notificationCenter.post(name: .triggerSystemPickerForeground, object: self)
    }

    @IBAction func triggerSystemPickerBackground(_: Any) {
        notificationCenter.post(name: .trigge
```

### Core Architecture Module: `Pika/ButtonStyles/AppearanceButtonStyle.swift`
```
import SwiftUI

private let darkBaseColor = Color(red: 0.1, green: 0.1, blue: 0.1)
private let lightBaseColor = Color(red: 0.975, green: 0.975, blue: 0.975)

@ViewBuilder
private func appearanceSideOverlay(colorScheme: ColorScheme) -> some View {
    HStack {
        Rectangle()
            .fill(
                LinearGradient(
                    gradient: .init(
                        colors: colorScheme == .dark
                            ? [darkBaseColor.opacity(0.5), darkBaseColor.opacity(0)]
                            : [lightBaseColor.opacity(0.9), lightBaseColor.opacity(0)]
                    ),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(maxWidth: 25, maxHeight: .infinity)
        Spacer()
        Rectangle()
            .fill(
                LinearGradient(
                    gradient: .init(
                        colors: colorScheme == .dark
                            ? [darkBaseColor.opacity(0), darkBaseColor.opacity(0.5)]
                            : [lightBaseColor.opacity(0), lightBaseColor.opacity(0.9)]
                    ),
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(maxWidth: 25, maxHeight: .infinity)
    }
}

struct AppearanceButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) var colorScheme: ColorScheme

    var title: String
    var description: String
    var selected = false

    func makeBody(configuration: Self.Configuration) -> some View {
        VStack {
            configuration.label
                .background(
                    LinearGradient(
                        gradient: .init(
                            colors: colorScheme == .dark
                                ? [darkBaseColor, .black]
                                : [lightBaseColor, .white]),
                        startPoint: .init(x: 0, y: 0),
                        endPoint: .init(x: 0, y: 1)
                    )
                )
                .opacity(configuration.isPressed ? 0.8 : 1.0)
                .animation(
                    .easeInOut(duration: 0.1), value: configuration.isPressed
                )
                .frame(maxWidth: .infinity)
                .frame(height: 55)
                .overlay(
                    appearanceSideOverlay(colorScheme: colorScheme)
                )
                .clipShape(
                    RoundedRectangle(cornerRadius: 10.0, style: .continuous)
                )
                .shadow(
                    color: .black.opacity(colorScheme == .dark ? 0.25 : 0.1),
                    radius: 2, x: 0, y: 2
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10.0, style: .continuous)
                        .stroke(
                            Color.accentColor.opacity(selected ? 1 : 0),
                            lineWidth: 2
                        )
                        .animation(.easeInOut(duration: 0.3), value: selected)
                )
            VStack(spacing: 4.0) {
                Text(title).foregroundStyle(.primary)
                Text(description)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 20.0)
            }
        }
        .contentShape(Rectangle())
    }
}

struct StyledContentView<Content: View>: View {
    @Environment(\.colorScheme) var colorScheme: ColorScheme

    let title: String
    let description: String
    let content: Content

    init(
        title: String, description: String, @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.description = description
        self.content = content()
    }

    var body: some View {
        VStack {
            content
                .frame(maxWidth: .infinity)
                .frame(height: 55)
                .background(
                    LinearGradient(
                        gradient: .init(
                            colors: colorScheme == .dark
                                ? [darkBaseColor, .black]
                                : [lightBaseColor, .white]),
                        startPoint: .init(x: 0, y: 0),
                        endPoint: .init(x: 0, y: 1)
                    )
                )
                .overlay(
                    appearanceSideOverlay(colorScheme: colorScheme)
                )
                .clipShape(
                    RoundedRectangle(cornerRadius: 10.0, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(.blue, lineWidth: 2)
                )
                .shadow(
                    color: .black.opacity(colorScheme == .dark ? 0.25 : 0.1),
                    radius: 2, x: 0, y: 2
                )

            VStack(spacing: 4.0) {
                Text(title).foregroundStyle(.primary)
                Text(description)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: 260.0)
            }
        }
        .contentShape(Rectangle())
    }
}

```

### Core Architecture Module: `Pika/ButtonStyles/CircleButtonStyle.swift`
```
import SwiftUI

struct CircleButtonStyle: ButtonStyle {
    let isVisible: Bool

    private struct CircleButtonStyleView: View {
        @Environment(\.colorScheme) var colorScheme: ColorScheme

        let configuration: Configuration
        let isVisible: Bool

        var body: some View {
            let fgColor = colorScheme == .dark ? Color.white : .black
            let bgColor = Color.pikaControlBackground(for: colorScheme)

            configuration.label
                .padding(.all, 8)
                .background(
                    ZStack {
                        Circle()
                            .fill(bgColor)
                            .shadow(
                                color: Color.black.opacity(0.2),
                                radius: configuration.isPressed ? 1 : 2,
                                x: 0,
                                y: configuration.isPressed ? 1 : 2
                            )
                            .overlay(
                                Circle()
                                    .stroke(fgColor.opacity(0.1))
                            )
                    }
                )
                .opacity(isVisible ? (configuration.isPressed ? 0.8 : 1.0) : 0.0)
                .foregroundStyle(fgColor.opacity(0.8))
                .animation(.easeInOut, value: isVisible)
                .animation(.easeInOut, value: configuration.isPressed)
        }
    }

    func makeBody(configuration: Self.Configuration) -> some View {
        CircleButtonStyleView(configuration: configuration, isVisible: isVisible)
    }
}

```

### Core Architecture Module: `Pika/ButtonStyles/EyedropperButtonStyle.swift`
```
import SwiftUI

struct EyedropperButtonStyle: ButtonStyle {
    var color: Color
    func makeBody(configuration: Self.Configuration) -> some View {
        configuration.label
            .background(color)
            .opacity(configuration.isPressed ? 0.8 : 1.0)
            .animation(.easeIn(duration: 0.15), value: color)
    }
}

```

### Core Architecture Module: `Pika/ButtonStyles/SwapButtonStyle.swift`
```
import SwiftUI

struct SwapButtonStyle: ButtonStyle {
    let isVisible: Bool
    let alt: String
    var ltr = false
    var expanded = false
    var onHoverChange: ((Bool) -> Void)?

    private struct SwapButtonStyleView: View {
        @Environment(\.colorScheme) var colorScheme: ColorScheme

        @State private var isHovered: Bool = false
        @State private var hoverTask: Task<Void, Never>?
        @State private var hoverCooldown: Task<Void, Never>?

        let configuration: Configuration
        let isVisible: Bool
        let alt: String
        let ltr: Bool
        let expanded: Bool
        let onHoverChange: ((Bool) -> Void)?

        private var showText: Bool { isHovered || expanded }

        var body: some View {
            let fgColor = colorScheme == .dark ? Color.white : .black
            let bgColor = Color.pikaControlBackground(for: colorScheme)

            HStack {
                if ltr {
                    configuration.label
                    if showText {
                        Text(alt)
                            .font(.system(size: 12.0))
                            .padding(.trailing, 2)
                    }
                } else {
                    if showText {
                        Text(alt)
                            .font(.system(size: 12.0))
                            .padding(.leading, 6)
                    }
                    configuration.label
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 8)
            .mask(RoundedRectangle(cornerRadius: 100.0, style: .continuous))
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: 100.0, style: .continuous)
                        .fill(bgColor)
                        .shadow(
                            color: Color.black.opacity(0.2),
                            radius: configuration.isPressed ? 1 : 2,
                            x: 0,
                            y: configuration.isPressed ? 1 : 2
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 100.0, style: .continuous)
                                .stroke(fgColor.opacity(0.1))
                        )
                }
            )
            .onHover { hover in
                onHoverChange?(hover)
                if hover {
                    guard hoverCooldown == nil, hoverTask == nil else { return }
                    hoverTask = Task {
                        try? await Task.sleep(for: .milliseconds(100))
                        guard !Task.isCancelled else { return }
                        isHovered = true
                        hoverTask = nil
                    }
                } else {
                    hoverTask?.cancel()
                    hoverTask = nil
                    isHovered = false
                    hoverCooldown?.cancel()
                    hoverCooldown = Task {
                        try? await Task.sleep(for: .milliseconds(150))
                        guard !Task.isCancelled else { return }
                        hoverCooldown = nil
                    }
                }
            }
            .opacity(isVisible ? (configuration.isPressed ? 0.8 : 1.0) : 0.0)
            .foregroundStyle(fgColor.opacity(0.8))
            .frame(height: 32.0)
            .animation(.timingCurve(0.65, 0, 0.35, 1, duration: 0.3), value: showText)
            .animation(.timingCurve(0.65, 0, 0.35, 1, duration: 0.3), value: isVisible)
            .animation(.timingCurve(0.65, 0, 0.35, 1, duration: 0.3), value: configuration.isPressed)
            .onChange(of: isVisible) { _, visible in
                if !visible {
                    hoverTask?.cancel()
                    hoverTask = nil
                    isHovered = false
                }
            }
        }
    }

    func makeBody(configuration: Self.Configuration) -> some View {
        SwapButtonStyleView(
            configuration: configuration,
            isVisible: isVisible,
            alt: alt,
            ltr: ltr,
            expanded: expanded,
            onHoverChange: onHoverChange
        )
    }
}

```

### Core Architecture Module: `Pika/Constants/Constants.swift`
```
import Defaults
import KeyboardShortcuts
import SwiftUI

extension KeyboardShortcuts.Name {
    static let togglePika = Self("togglePika")
}

enum PikaConstants {
    // Release URL
    static func url() -> String {
        Defaults[.betaUpdates]
            ? "https://superhighfives.com/releases/pika/betas"
            : "https://superhighfives.com/releases/pika"
    }

    static let pikaWebsiteURL = "https://superhighfives.com/pika"
    static let gitHubRepoURL = "https://github.com/superhighfives/pika"
    static let gitHubIssueURL = "https://github.com/superhighfives/pika/issues/new/choose"
    static let charlieGleasonWebsiteURL = "https://charliegleason.com"
    static let pikaHelpURL = "https://superhighfives.com/pika/help"
    static let macAppStoreURL = "https://apps.apple.com/us/app/pika/id6739170421"

    // Initial colors
    static let initialColors = [
        NSColor(r: 143.0, g: 15.0, b: 208.0),
        NSColor(r: 224.0, g: 53.0, b: 139.0),
        NSColor(r: 20.0, g: 63.0, b: 245.0),
        NSColor(r: 235.0, g: 54.0, b: 75.0),
        NSColor(r: 182.0, g: 26.0, b: 129.0),
        NSColor(r: 88.0, g: 32.0, b: 228.0),
        NSColor(r: 191.0, g: 19.0, b: 186.0),
        NSColor(r: 119.0, g: 77.0, b: 178.0),
        NSColor(r: 14.0, g: 35.0, b: 204.0),
        NSColor(r: 188.0, g: 42.0, b: 97.0),
    ]

    // Notification Center constants
    static let ncTriggerCopyForeground = "triggerCopyForeground"
    static let ncTriggerCopyBackground = "triggerCopyBackground"
    static let ncTriggerCopyText = "triggerCopyText"
    static let ncTriggerCopyData = "triggerCopyData"
    static let ncTriggerPickForeground = "triggerPickForeground"
    static let ncTriggerPickBackground = "triggerPickBackground"
    static let ncTriggerSystemPickerForeground = "triggerSystemPickerForeground"
    static let ncTriggerSystemPickerBackground = "triggerSystemPickerBackground"
    static let ncTriggerSwap = "triggerSwap"
    static let ncTriggerUndo = "triggerUndo"
    static let ncTriggerRedo = "triggerRedo"
    static let ncTriggerPreferences = "triggerPreferences"
    static let ncTriggerFormatHex = "triggerFormatHex"
    static let ncTriggerFormatRGB = "triggerFormatRGB"
    static let ncTriggerFormatHSB = "triggerFormatHSB"
    static let ncTriggerFormatHSL = "triggerFormatHSL"
    static let ncTriggerFormatOpenGL = "triggerFormatOpenGL"
    static let ncTriggerFormatLAB = "triggerFormatLAB"
    static let ncTriggerFormatOKLCH = "triggerFormatOKLCH"
    static let ncTriggerQuit = "triggerQuit"
    static let ncColorPicked = "colorPicked"
    static let ncToggleHistory = "toggleHistory"
    static let ncToggleColorPreview = "toggleColorPreview"
    static let ncToggleCompliance = "toggleCompliance"
    static let ncHistoryPrevious = "historyPrevious"
    static let ncHistoryNext = "historyNext"
    static let ncHistoryDelete = "historyDelete"
    static let ncSavePalette = "savePalette"
    static let ncExportPalette = "exportPalette"
    static let ncSystemColorChanged = "systemColorChanged"
    static let ncExpandToFit = "expandToFit"

    // Disabled formats for SwiftUI copy format
    static let disabledFormats: [ColorFormat] = [.hex, .hsl, .opengl, .lab, .oklch]
}

extension Notification.Name {
    static let triggerPickForeground = Notification.Name(PikaConstants.ncTriggerPickForeground)
    static let triggerPickBackground = Notification.Name(PikaConstants.ncTriggerPickBackground)
    static let triggerCopyForeground = Notification.Name(PikaConstants.ncTriggerCopyForeground)
    static let triggerCopyBackground = Notification.Name(PikaConstants.ncTriggerCopyBackground)
    static let triggerCopyText = Notification.Name(PikaConstants.ncTriggerCopyText)
    static let triggerCopyData = Notification.Name(PikaConstants.ncTriggerCopyData)
    static let triggerSystemPickerForeground = Notification.Name(PikaConstants.ncTriggerSystemPickerForeground)
    static let triggerSystemPickerBackground = Notification.Name(PikaConstants.ncTriggerSystemPickerBackground)
    static let triggerSwap = Notification.Name(PikaConstants.ncTriggerSwap)
    static let triggerUndo = Notification.Name(PikaConstants.ncTriggerUndo)
    static let triggerRedo = Notification.Name(PikaConstants.ncTriggerRedo)
    static let triggerPreferences = Notification.Name(PikaConstants.ncTriggerPreferences)
    static let triggerFormatHex = Notification.Name(PikaConstants.ncTriggerFormatHex)
    static let triggerFormatRGB = Notification.Name(PikaConstants.ncTriggerFormatRGB)
    static let triggerFormatHSB = Notification.Name(PikaConstants.ncTriggerFormatHSB)
    static let triggerFormatHSL = Notification.Name(PikaConstants.ncTriggerFormatHSL)
    static let triggerFormatOpenGL = Notification.Name(PikaConstants.ncTriggerFormatOpenGL)
    static let triggerFormatLAB = Notification.Name(PikaConstants.ncTriggerFormatLAB)
    static let triggerFormatOKLCH = Notification.Name(PikaConstants.ncTriggerFormatOKLCH)
    static let triggerQuit = Notification.Name(PikaConstants.ncTriggerQuit)
    static let colorPicked = Notification.Name(PikaConstants.ncColorPicked)
    static let toggleHistory = Notification.Name(PikaConstants.ncToggleHistory)
    static let toggleColorPreview = Notification.Name(PikaConstants.ncToggleColorPreview)
    static let toggleCompliance = Notification.Name(PikaConstants.ncToggleCompliance)
    static let historyPrevious = Notification.Name(PikaConstants.ncHistoryPrevious)
    static let historyNext = Notification.Name(PikaConstants.ncHistoryNext)
    static let historyDelete = Notification.Name(PikaConstants.ncHistoryDelete)
    static let savePalette = Notification.Name(PikaConstants.ncSavePalette)
    static let exportPalette = Notification.Name(PikaConstants.ncExportPalette)
    static let systemColorChanged = Notification.Name(PikaConstants.ncSystemColorChanged)
    static let expandToFit = Notification.Name(PikaConstants.ncExpandToFit)
}

```

### Core Architecture Module: `Pika/Constants/Defaults.swift`
```
import Cocoa
import Defaults
import SwiftUI

enum ColorFormat: String, Codable, CaseIterable, Equatable {
    case hex = "Hex"
    case rgb = "RGB"
    case hsb = "HSB"
    case hsl = "HSL"
    case lab = "LAB"
    case opengl = "OpenGL"
    case oklch = "OKLCH"

    func getExample(color: NSColor, style: CopyFormat) -> String {
        color.toFormat(format: self, style: style)
    }

    static func withLabel(_ label: String) -> ColorFormat? {
        allCases.first { label == "\($0)" }
    }
}

enum CopyFormat: String, Codable, CaseIterable {
    case css = "preferences.copy.options.css"
    case design = "preferences.copy.options.design"
    case swiftUI = "preferences.copy.options.swiftui"
    case unformatted = "preferences.copy.options.unformatted"

    func localizedString() -> String {
        NSLocalizedString(rawValue, comment: "Copy Format")
    }
}

enum ContrastStandard: String, Codable, CaseIterable {
    case wcag = "WCAG"
    case apca = "APCA"
    case both = "BOTH"

    func localizedString() -> String {
        switch self {
        case .wcag, .apca:
            return rawValue
        case .both:
            return NSLocalizedString("color.standard.both", comment: "Both")
        }
    }
}

enum WindowShadow: String, Codable, CaseIterable {
    case always = "preferences.shadow.options.always"
    case hiddenWhilePicking = "preferences.shadow.options.hiddenWhilePicking"
    case never = "preferences.shadow.options.never"

    func localizedString() -> String {
        NSLocalizedString(rawValue, comment: "Window Shadow")
    }

    /// The window's resting shadow state. `.hiddenWhilePicking` keeps the shadow at
    /// rest and only drops it during an active pick (handled by the picker).
    var showsShadowAtRest: Bool { self != .never }
}

enum AppMode: String, Codable, CaseIterable {
    case menubar = "preferences.app.mode.menubar"
    case regular = "preferences.app.mode.regular"
    case hidden = "preferences.app.mode.hidden"
    case menubarPopover = "preferences.app.mode.menubarPopover"

    func localizedString() -> String {
        NSLocalizedString(rawValue, comment: "App Mode")
    }

    var activationPolicy: NSApplication.ActivationPolicy {
        switch self {
        case .regular: return .regular
        case .menubar, .menubarPopover, .hidden: return .accessory
        }
    }

    var usesStatusBarItem: Bool { self == .menubar || self == .menubarPopover }
    var usesPopover: Bool { self == .menubarPopover }
}

extension Defaults.Keys {
    static let colorFormat = Key<ColorFormat>("colorFormat", default: .hex)
    static let viewedSplash = Key<Bool>("viewedSplash", default: false)
    static let hidePikaWhilePicking = Key<Bool>("hidePikaWhilePicking", default: false)
    static let windowShadow = Key<WindowShadow>("windowShadow", default: .always)
    static let pickContrastingColor = Key<Bool>("pickContrastingColor", default: false)
    static let copyColorOnPick = Key<Bool>("copyColorOnPick", default: false)
    static let hideMenuBarIcon = Key<Bool>("hideMenuBarIcon", default: false)
    static let betaUpdates = Key<Bool>("betaUpdates", default: false)
    static let combineCompliance = Key<Bool>("combineCompliance", default: false)
    static let colorSpace = NSSecureCodingKey<NSColorSpace>(
        "colorSpace", default: NSScreen.main!.colorSpace!
    )
    static let hideColorNames = Key<Bool>("hideColorNames", default: false)
    static let formatColorsForCSS = Key<Bool>("formatColorsForCSS", default: false)
    static let copyFormat = Key<CopyFormat>("copyFormat", default: .css)
    static let appMode = Key<AppMode>("appMode", default: .menubar)
    static let appFloating = Key<Bool>("appFloating", default: true)
    static let alwaysShowOnLaunch = Key<Bool>("alwaysShowOnLaunch", default: false)
    static let contrastStandard = Key<ContrastStandard>("contrastStandard", default: .wcag)
    static let showColorOverlay = Key<Bool>("showColorOverlay", default: true)
    static let colorOverlayDuration = Key<Double>("colorOverlayDuration", default: 2.0)
    static let colorHistory = Key<[ColorPair]>("colorHistory", default: [])
    static let palettes = Key<[Palette]>("palettes", default: [
        Palette(id: UUID(), name: nil, pairs: [], createdAt: Date()),
    ])
    static let activePaletteIndex = Key<Int>("activePaletteIndex", default: 0)
    static let undoStack = Key<[[ColorPair]]>("undoStack", default: [])
    static let redoStack = Key<[[ColorPair]]>("redoStack", default: [])
    static let historyDrawerVisible = Key<Bool>("historyDrawerVisible", default: false)
    static let showColorPreview = Key<Bool>("showColorPreview", default: false)
    static let showCompliance = Key<Bool>("showCompliance", default: true)
}

```

### Core Architecture Module: `Pika/Constants/PikaShortcuts.swift`
```
import AppKit
import Foundation

/// Single source of truth for Pika's keyboard shortcuts. Used by:
/// - `KeyboardShortcutGrid` (Help view) for visual display
/// - `AppDelegate.popoverShortcutAction(for:)` to dispatch shortcuts in popover mode,
///   where neither `NSApp.mainMenu.performKeyEquivalent` nor SwiftUI's `.commands`
///   `.keyboardShortcut` bindings reach the popover panel.
struct PikaShortcut {
    let title: String
    let displayKeys: [String]
    let character: String
    let modifiers: NSEvent.ModifierFlags
    let action: Selector
    let notificationName: Notification.Name
}

enum PikaShortcuts {
    static let all: [PikaShortcut] = [
        PikaShortcut(
            title: PikaText.textPickForeground,
            displayKeys: ["⌘", "D"], character: "d", modifiers: .command,
            action: #selector(AppDelegate.triggerPickForeground),
            notificationName: .triggerPickForeground
        ),
        PikaShortcut(
            title: PikaText.textPickBackground,
            displayKeys: ["⇧", "⌘", "D"], character: "d", modifiers: [.command, .shift],
            action: #selector(AppDelegate.triggerPickBackground),
            notificationName: .triggerPickBackground
        ),
        PikaShortcut(
            title: PikaText.textCopyForeground,
            displayKeys: ["⌘", "C"], character: "c", modifiers: .command,
            action: #selector(AppDelegate.triggerCopyForeground),
            notificationName: .triggerCopyForeground
        ),
        PikaShortcut(
            title: PikaText.textCopyBackground,
            displayKeys: ["⇧", "⌘", "C"], character: "c", modifiers: [.command, .shift],
            action: #selector(AppDelegate.triggerCopyBackground),
            notificationName: .triggerCopyBackground
        ),
        PikaShortcut(
            title: PikaText.textColorSystemPickerForegroundSimple,
            displayKeys: ["⌘", "S"], character: "s", modifiers: .command,
            action: #selector(AppDelegate.triggerSystemPickerForeground),
            notificationName: .triggerSystemPickerForeground
        ),
        PikaShortcut(
            title: PikaText.textColorSystemPickerBackgroundSimple,
            displayKeys: ["⇧", "⌘", "S"], character: "s", modifiers: [.command, .shift],
            action: #selector(AppDelegate.triggerSystemPickerBackground),
            notificationName: .triggerSystemPickerBackground
        ),
        PikaShortcut(
            title: PikaText.textColorUndo,
            displayKeys: ["⌘", "Z"], character: "z", modifiers: .command,
            action: #selector(AppDelegate.triggerUndo),
            notificationName: .triggerUndo
        ),
        PikaShortcut(
            title: PikaText.textColorRedo,
            displayKeys: ["⇧", "⌘", "Z"], character: "z", modifiers: [.command, .shift],
            action: #selector(AppDelegate.triggerRedo),
            notificationName: .triggerRedo
        ),
        PikaShortcut(
            title: PikaText.textColorSwapDetail,
            displayKeys: ["X"], character: "x", modifiers: [],
            action: #selector(AppDelegate.triggerSwap),
            notificationName: .triggerSwap
        ),
        PikaShortcut(
            title: PikaText.textHistoryToggle,
            displayKeys: ["H"], character: "h", modifiers: [],
            action: #selector(AppDelegate.triggerToggleHistory),
            notificationName: .toggleHistory
        ),
        PikaShortcut(
            title: "\(PikaText.textMenuPreferences)...",
            displayKeys: ["⌘", ","], character: ",", modifiers: .command,
            action: #selector(AppDelegate.openPreferencesWindow),
            notificationName: .triggerPreferences
        ),
        PikaShortcut(
            title: PikaText.textMenuQuit,
            displayKeys: ["⌘", "Q"], character: "q", modifiers: .command,
            action: #selector(AppDelegate.terminatePika),
            notificationName: .triggerQuit
        ),
        PikaShortcut(
            title: PikaText.textFormatHex,
            displayKeys: ["⌘", "1"], character: "1", modifiers: .command,
            action: #selector(AppDelegate.triggerFormatHex),
            notificationName: .triggerFormatHex
        ),
        PikaShortcut(
            title: PikaText.textFormatRGB,
            displayKeys: ["⌘", "2"], character: "2", modifiers: .command,
            action: #selector(AppDelegate.triggerFormatRGB),
            notificationName: .triggerFormatRGB
        ),
        PikaShortcut(
            title: PikaText.textFormatHSB,
            displayKeys: ["⌘", "3"], character: "3", modifiers: .command,
            action: #selector(AppDelegate.triggerFormatHSB),
            notificationName: .triggerFormatHSB
        ),
        PikaShortcut(
            title: PikaText.textFormatHSL,
            displayKeys: ["⌘", "4"], character: "4", modifiers: .command,
            action: #selector(AppDelegate.triggerFormatHSL),
            notificationName: .triggerFormatHSL
        ),
        PikaShortcut(
            title: PikaText.textFormatLAB,
            displayKeys: ["⌘", "5"], character: "5", modifiers: .command,
            action: #selector(AppDelegate.triggerFormatLAB),
            notificationName: .triggerFormatLAB
        ),
        PikaShortcut(
            title: PikaText.textFormatOpenGL,
            displayKeys: ["⌘", "6"], character: "6", modifiers: .command,
            action: #selector(AppDelegate.triggerFormatOpenGL),
            notificationName: .triggerFormatOpenGL
        ),
        PikaShortcut(
            title: PikaText.textFormatOKLCH,
            displayKeys: ["⌘", "7"], character: "7", modifiers: .command,
            action: #selector(AppDelegate.triggerFormatOKLCH),
            notificationName: .triggerFormatOKLCH
        ),
    ]

    /// Returns the shortcut matching the given key event, if any.
    static func match(_ event: NSEvent) -> PikaShortcut? {
        let chars = event.charactersIgnoringModifiers?.lowercased() ?? ""
        let mods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        return all.first { $0.character == chars && $0.modifiers == mods }
    }
}

```

### Core Architecture Module: `Pika/Constants/PikaText.swift`
```
import Foundation

enum PikaText {
    static let textAppName = NSLocalizedString("app.name", comment: "Pika")

    /*
     * General
     */

    static let textCancel = NSLocalizedString("general.cancel", comment: "Cancel")
    static let textClear = NSLocalizedString("general.clear", comment: "Clear")

    /*
     * Colors
     */

    static let textColorForeground = NSLocalizedString("color.foreground", comment: "Foreground")
    static let textColorBackground = NSLocalizedString("color.background", comment: "Background")
    static let textColorPass = NSLocalizedString("color.wcag.pass", comment: "Pass")
    static let textColorFail = NSLocalizedString("color.wcag.fail", comment: "Fail")
    static let textColorRatio = NSLocalizedString("color.ratio", comment: "Contrast Ratio")
    // swiftlint:disable:next line_length
    static let textColorRatioDescription = NSLocalizedString("color.ratio.description", comment: "Contrast ratio is a measure of the difference in perceived brightness between two colors, used to calculate the contrast ratio.")
    static let textLightnessContrastValue = NSLocalizedString("color.lc", comment: "Lightness Contrast Level")
    // swiftlint:disable:next line_length
    static let textLightnessContrastValueDescription = NSLocalizedString("color.lc.description", comment: "Lightness contrast (Lc) is a measure of the lightness difference between two colors, used to calculate the contrast value.")
    static let textColorWCAG = NSLocalizedString("color.wcag", comment: "WCAG Compliance")
    static let textColorAPCA = NSLocalizedString("color.apca", comment: "APCA Compliance")
    static let textColorWCAG30 = NSLocalizedString("color.wcag.30", comment: "WCAG 3:1")
    static let textColorWCAG45 = NSLocalizedString("color.wcag.45", comment: "WCAG 4.5:1")
    static let textColorWCAG70 = NSLocalizedString("color.wcag.70", comment: "WCAG 7:1")
    static let textColorSwap = NSLocalizedString("color.swap", comment: "Swap")
    static let textColorSwapDetail = NSLocalizedString("color.swap.detail", comment: "Swap colors")
    static let textColorUndo = NSLocalizedString("color.undo", comment: "Undo")
    static let textColorRedo = NSLocalizedString("color.redo", comment: "Redo")
    static let textColorCopy = NSLocalizedString("color.copy", comment: "Copy")
    static let textColorSystemPicker = NSLocalizedString("color.system", comment: "System picker")
    static let textColorCopied = NSLocalizedString("color.copy.toast", comment: "Copied")

    /*
     * Menu
     */

    static let textMenuHelp = NSLocalizedString("menu.help", comment: "Help")
    static let textHelpDescription = NSLocalizedString("help.description", comment: "Help description")
    static let textHelpKeyboardShortcuts = NSLocalizedString("help.shortcuts", comment: "Keyboard Shortcuts")
    static let textHelpURLTriggers = NSLocalizedString("help.url_triggers", comment: "URL Triggers")
    static let textHelpURLTriggersDescription = NSLocalizedString("help.url_triggers.description", comment: "URL Triggers description")
    static let textHelpFormats = NSLocalizedString("help.formats", comment: "Formats")
    static let textHelpOpenSource = NSLocalizedString("help.open_source", comment: "Open Source")
    static let textHelpOpenSourceDescription = NSLocalizedString("help.open_source.description", comment: "Open Source description")
    static let textHelpViewOnGitHub = NSLocalizedString("help.github", comment: "View on GitHub")
    static let textHelpSupportOnMAS = NSLocalizedString("help.mas", comment: "Support on the Mac App Store")

    static let textMenuAbout = NSLocalizedString("menu.about", comment: "About")
    static let textMenuUpdates = NSLocalizedString("menu.updates", comment: "Check for updates")
    static let textMenuPreferences = NSLocalizedString("menu.preferences", comment: "Preferences")
    static let textMenuWebsite = NSLocalizedString("menu.website", comment: "Pika website")
    static let textMenuGitHubIssue = NSLocalizedString("menu.issue", comment: "Report feedback")
    static let textMenuQuit = NSLocalizedString("menu.quit", comment: "Quit Pika")

    // Navigation
    static let textMenuCopyAllAsText = NSLocalizedString("color.copy.text", comment: "Copy all as text")
    static let textMenuCopyAllAsJSON = NSLocalizedString("color.copy.data", comment: "Copy all as JSON")

    /*
     * Touchbar
     */

    static let textColorNormal = NSLocalizedString("color.wcag.normal", comment: "Normal")
    static let textColorLargeAbbr = NSLocalizedString("color.wcag.large.abbr", comment: "LG")
    static let textColorLarge = NSLocalizedString("color.wcag.large", comment: "Large")

    /*
     * Splash
     */

    static let textSplashLaunch = NSLocalizedString("splash.hotkey", comment: "Global shortcut")
    static let textSplashHotkey = NSLocalizedString("splash.launch", comment: "Launch at login")
    static let textSplashStart = NSLocalizedString("splash.start", comment: "Get started")

    /*
     * About
     */

    static let textAboutWebsite = NSLocalizedString("app.website", comment: "Website")
    static let textAboutGitHub = NSLocalizedString("app.github", comment: "GitHub")
    static let textAboutBy = NSLocalizedString("app.designed", comment: "Designed by")
    static let textAboutVersion = NSLocalizedString("app.version", comment: "Version")
    static let textAboutBuild = NSLocalizedString("app.build", comment: "Build")
    static let textAboutUnknown = NSLocalizedString("app.unknown", comment: "Unknown")
    static let textAboutMacAppStore = NSLocalizedString("app.store.mas", comment: "Mac App Store")
    static let textAboutDownloaded = NSLocalizedString("app.store.download", comment: "Downloaded from the internet")

    // APCA Compliance Labels
    static let textAPCABaseline = NSLocalizedString("color.apca.baseline", comment: "Baseline")
    static let textAPCAHeadline = NSLocalizedString("color.apca.headline", comment: "Headline")
    static let textAPCATitle = NSLocalizedString("color.apca.title", comment: "Title")
    static let textAPCABody = NSLocalizedString("color.apca.body", comment: "Body Text")

    // APCA Tooltips
    static let textColorAPCA30 = NSLocalizedString("color.apca.30", comment: "APCA ≥30")
    static let textColorAPCA45 = NSLocalizedString("color.apca.45", comment: "APCA ≥45")
    static let textColorAPCA60 = NSLocalizedString("color.apca.60", comment: "APCA ≥60")
    static let textColorAPCA75 = NSLocalizedString("color.apca.75", comment: "APCA ≥75")

    // History
    static let textHistoryTitle = NSLocalizedString("history.title", comment: "History")
    static let textHistoryToggle = NSLocalizedString("history.toggle", comment: "Toggle palettes")
    static let textColorPreviewToggle = NSLocalizedString("color.preview.toggle", comment: "Toggle color preview")
    static let textComplianceToggle = NSLocalizedString("compliance.toggle", comment: "Toggle compliance")
    static let textHistoryApplyForeground = NSLocalizedString("history.apply.foreground", comment: "Apply foreground only")
    static let textHistoryApplyBackground = NSLocalizedString("history.apply.background", comment: "Apply background only")
    static let textHistoryRemove = NSLocalizedString("history.remove", comment: "Remove from history")
    static let textHistoryClear = NSLocalizedString("history.clear", comment: "Clear history")

    // Palettes
    static let textPaletteNew = NSLocalizedString("palette.new", comment: "New palette…")
    static let textPaletteRename = NSLocalizedString("palette.rename", comment: "Rename palette")
    static let textPaletteDelete = NSLocalizedString("palette.delete", comment: "Delete palette")
    static let textPaletteRemoveChip = NSLocalizedString("palette.remove", comment: "Remove from palette")
    static let textPaletteNamePrompt = NSLocalizedString("palette.name.prompt", comment: "Palette name")
    static let textPaletteNamePlaceholder = NSLocalizedString("palette.name.placeholder", comment: "My palette")
    static let textPaletteAddColor = NSLocalizedString("palette.add", comment: "Add to palette")
    static let textPaletteExport = NSLocalizedString("palette.export", comment: "Export palette")
    static let textHistoryExport = NSLocalizedString("history.export", comment: "Export color history")
    static let textHistoryClearConfirm = NSLocalizedString("history.clear.confirm", comment: "Are you sure you want to clear all history?")

    // Keyboard shortcuts
    static let textPickForeground = NSLocalizedString("color.pick.foreground", comment: "Pick foreground")
    static let textPickBackground = NSLocalizedString("color.pick.background", comment: "Pick background")
    static let textPickContrast = NSLocalizedString(
        "color.pick.contrast",
        comment: "Pick foreground then background"
    )
    static let textCopyForeground = NSLocalizedString("color.copy.foreground", comment: "Copy foreground")
    static let textCopyBackground = NSLocalizedString("color.copy.background", comment: "Copy background")
    static let textColorSystemPickerForeground = NSLocalizedString(
        "color.system.foreground",
        comment: "Use foreground system color picker"
    )
    static let textColorSystemPickerBackground = NSLocalizedString(
        "color.system.background",
        comment: "Use background system color picker"
    )
    static let textColorSystemPickerForegroundSimple = NSLocalizedString(
        "color.system.foreground.simple",
        comment: "System foreground"
    )
    static let textColorSystemPickerBackgroundSimple = NSLocalizedString(
        "color.system.background.simple",
        comment: "System background"
    )

    /*
     * Preferences
     */

    // General Settings
    static let textGeneralTitle = NSLocalizedString("preferences.general.title", comment: "General Settings")
    static let textLaunchDescription = NSLocalizedString(
        "preferences.launch.description",
        comment: "La
```

### Core Architecture Module: `Pika/Extensions/APCACompliance.swift`
```
import Cocoa

// swiftlint:disable identifier_name
// identifier_name is disabled because the APCA algorithm uses conventional single-letter
// variable names (c, r, g, b, y, s) from the specification that would be misleading if renamed.

extension NSColor {
    struct APCA {
        var value: CGFloat
        var level: String
    }

    func APCACompliance(with color: NSColor) -> APCA {
        let apcaValue = calculateAPCA(with: color)
        let level = getAPCALevel(value: apcaValue)

        return APCA(
            value: apcaValue,
            level: level
        )
    }

    func toAPCAcontrastValue(with color: NSColor) -> String {
        let value = abs(calculateAPCA(with: color))
        let number = NSNumber(value: value)

        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .decimal
        numberFormatter.minimumFractionDigits = 2
        numberFormatter.maximumFractionDigits = 2

        let s = numberFormatter.string(from: number)
        return s!
    }

    private func calculateAPCA(with color: NSColor) -> CGFloat {
        let fgRGB = toRGBAComponents()
        let bgRGB = color.toRGBAComponents()

        // Convert to sRGB components in 0-255 range
        let fg = [fgRGB.r * 255, fgRGB.g * 255, fgRGB.b * 255]
        let bg = [bgRGB.r * 255, bgRGB.g * 255, bgRGB.b * 255]

        // Calculate luminance for both colors
        let yfg = sRGBtoY(fg)
        let ybg = sRGBtoY(bg)

        var c = 1.14

        if ybg > yfg {
            c *= pow(ybg, 0.56) - pow(yfg, 0.57)
        } else {
            c *= pow(ybg, 0.65) - pow(yfg, 0.62)
        }

        if abs(c) < 0.1 {
            return 0
        } else if c > 0 {
            c -= 0.027
        } else {
            c += 0.027
        }

        return c * 100
    }

    private func sRGBtoY(_ srgb: [CGFloat]) -> CGFloat {
        let r = pow(srgb[0] / 255, 2.4)
        let g = pow(srgb[1] / 255, 2.4)
        let b = pow(srgb[2] / 255, 2.4)
        var y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b

        if y < 0.022 {
            y += pow(0.022 - y, 1.414)
        }
        return y
    }

    private func getAPCALevel(value: CGFloat) -> String {
        let absValue = abs(value)

        switch absValue {
        case 0 ..< 15: return "Fail"
        case 15 ..< 30: return "AA"
        case 30 ..< 45: return "AAA"
        case 45 ..< 60: return "AAA+"
        case 60...: return "Super"
        default: return "Unknown"
        }
    }

    func toAPCACompliance(with color: NSColor) -> (NSColor.APCA) {
        APCACompliance(with: color)
    }
}

// swiftlint:enable identifier_name

```

### Core Architecture Module: `Pika/Extensions/BindingOnChange.swift`
```
import SwiftUI

extension Binding {
    func onChange(perform: @escaping (Value) -> Void) -> Binding<Value> {
        Binding(get: {
            // return wrapped value
            self.wrappedValue
        }, set: { newValue in
            // set new value
            self.wrappedValue = newValue
            // call completion
            perform(newValue)
        })
    }

    func onChange(perform: @escaping () -> Void) -> Binding<Value> {
        Binding(get: {
            // return wrapped value
            self.wrappedValue
        }, set: { newValue in
            // set new value
            self.wrappedValue = newValue
            // call completion
            perform()
        })
    }
}

```

### Core Architecture Module: `Pika/Extensions/CGFloat+Format.swift`
```
import CoreGraphics
import Foundation

extension CGFloat {
    /// Formats the value with up to `maxDecimalPlaces` decimal places, stripping trailing zeros.
    /// e.g. 0.5000 → "0.5", 0.0000 → "0", 56.78 → "56.78"
    func strippedDecimalString(maxDecimalPlaces: Int) -> String {
        // Normalize -0.0 to +0.0 to avoid producing "-0" in output.
        let value: CGFloat = self == 0 ? 0 : self
        let formatted = String(format: "%.\(maxDecimalPlaces)f", value)
        guard formatted.contains(".") else { return formatted }
        var result = formatted
        while result.hasSuffix("0") { result.removeLast() }
        if result.hasSuffix(".") { result.removeLast() }
        return result
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #235** (2026-07-12): **Opening the app never really open the app**
  *Symptoms*: Is this a bug or intentional behavior?  If you click on the app icon to launch Pika, it never shows up even though it opens. You have to click AGAIN for the UI to appear. Why is that?
  **Post-Mortem & Fix Analysis**:
  > Hey @danqing! As Pika is a utility, it doesn't show by default (for example, if you open it with your launch items or you use it with the global shortcut). You can change this in the settings, though:  <img width="692" height="712" alt="Image" src="https://github.com/user-attachments/assets/cb177ea9-1a84-4e11-b38a-9756bfb04f7f" />  Thanks for flagging. 👍 
  > This is my setting (in the dock). It doesn't open.
  > Huh, weird! I made a video of the expected behavior (and found a bug with remebering location I'm fixing in `1.8.0`). Is this how you're opening it?  https://github.com/user-attachments/assets/77691230-a374-4b33-8763-6877b795185b

- **Issue #207** (2026-07-23): **Innaccurate hexcodes**
  *Symptoms*: **Describe the bug** The hexcodes for the colors picked don't seem to be accurate - on Figma, I can set a shape to a certain color, try to pick the color with Pika, and the hexcode Pika gives me is not the one I set myself on Figma. Copying the hexcode from Pika and applying on the Figma shape, it looks slightly darker than the original color. I've tried messing with color format / RGB color space settings to see if I could fix it, but have not been able to.  The problem isn't only on Figma. I've tried pasting the hex codes on [WebAIM](https://webaim.org/resources/contrastchecker/) as well, and their previews of the colors match Figma's, not Pika's.  **To Reproduce** Steps to reproduce the behavior: 1. Open a Figma file (or the WebAIM page) 2. Set a color and take note of its hexcode 3. Pick the color on the screen with Pika 4. Check if the hexcode given by Pika matches the original  **Expected behavior** The hexcode should match.  **Screenshots**  <img width="980" height="642" alt="Image" src="https://github.com/user-attachments/assets/c4d1bfc9-2bd2-4d56-aabc-f56f8b878a69" />  A rectangle on Figma set to the color # DB0B84.  <img width="999" height="602" alt="Image" src="https://github.com/user-attachments/assets/c2cfd873-a5c2-43f9-9df4-a4f508d0d6b6" />  Picking the color with Pika, it gives the hexcode # C92D82 instead.  <img width="985" height="587" alt="Image" src="https://github.com/user-attachments/assets/9f065a0f-18ba-42e8-b386-d8a31cdae289" />  Applying # C92D82 to an
  **Post-Mortem & Fix Analysis**:
  > For sure, we can dig into this! If you jump into the Settings, what color profile do you have? Figma uses sRGB:  <img width="596" height="278" alt="Image" src="https://github.com/user-attachments/assets/d2734870-6f8c-4242-bd1e-c18c13ee6e59" />  See if changing the color profile helps, and let me know how you go.
  > Going to close this one for now, but feel free to reopen.

- **Issue #206** (2026-04-27): **Open Pika on macOS via Dock**
  *Symptoms*: **Describe the bug** Klicking the icon for Pika in the Dock, the app does not open. Clicking the icon again the app opens.  **To Reproduce** Steps to reproduce the behavior: 1. Klick the icon for Pika in the Dock 2. The app does not appear 3. Klick the icon for Pika again in the Dock, and the app appears  **Expected behavior** Klicking the icon for Pika in the Dock should start the application.  **Environment:** - OS: MacOS Tahoe 26.4.1 (25E253) - App Version: 1.6.0, build 78 - Architecture: Univeral  **Additional context** Clicking the app in the "Aplications" folder, the app opens as expeted. 
  **Post-Mortem & Fix Analysis**:
  > Yep, this is a setting:  <img width="276" height="342" alt="Image" src="https://github.com/user-attachments/assets/173b4609-0a90-4d1c-8f8e-fe806e35e52f" />  Let me know if you have any issues with it. 👍

- **Issue #205** (2026-05-09): **Strings don't translate**
  *Symptoms*: **Describe the bug** When deleting the history, the strings `Cancel` and `Clear` don't translate.  **To Reproduce** Steps to reproduce the behavior: 1. Change your system language setting for instance to Croatian 2. Open Pika 3. Go to History 4. Select a color contrast 5. Select via the contectual menu `Ukloni iz povijesti` (Remove from history) or `Izbriši povijest` (Clear history). 6. In the next window see that the strings `Cancel` and `Clear` do not tranlsate.  **Expected behavior** The strings `Cancel` and `Clear` should translate.  **Screenshots** <img width="478" height="342" alt="Image" src="https://github.com/user-attachments/assets/c67d6d30-f65d-4705-bdd1-5a1a83b7a499" />  **Environment:** - OS: MacOS Tahoe 26.4.1 (25E253) - App Version: 1.6.0, build 78 - Architecture: universal 

- **Issue #204** (2026-05-09): **Enable translations in the apple menu bar**
  *Symptoms*: **Describe the bug** None of the items in "Apple's" menu bar translate, nor their subitems.  **To Reproduce** Steps to reproduce the behavior: 1. Change your system language setting for intance to Croatian 2. Open Pika 3. See that none of the items in "Apple's" menu bar translate, nor their subitems.  **Expected behavior** All items and their subitems in "Apple's" menu bar should translate.  **Screenshots** <img width="477" height="345" alt="Image" src="https://github.com/user-attachments/assets/b900c758-ddb0-4c98-8d3d-1ce704a9fe28" /> <img width="472" height="346" alt="Image" src="https://github.com/user-attachments/assets/33ec8bdf-0469-4db4-a6b8-f929232368cb" /> <img width="475" height="344" alt="Image" src="https://github.com/user-attachments/assets/70d9984e-8f18-43f6-9848-815087a20bf1" /> <img width="560" height="349" alt="Image" src="https://github.com/user-attachments/assets/4e023fa4-5aed-4dc2-bd14-b087c230bd89" />  **Environment:**  - OS: MacOS Tahoe 26.4.1 (25E253)  - App Version: 1.6.0, build 78  **Additional context** If you implement the menu items and subitems in the "Apple" menu bar, you wouldn't need the extra menu in the top right corner of the app's window - this is just an idea.  <img width="726" height="686" alt="Image" src="https://github.com/user-attachments/assets/a415b2fa-bf06-4fec-8580-21dfe00e7669" /> 

- **Issue #187** (2026-03-14): **Picked colors are not accurate to the source.**
  *Symptoms*: When picking the color from a source it is not accurate. Tried picking the source using Figma color picker and Pika, and Pika is off by a small margin - not immediately noticeable, but nonetheless unable to trust it.  For example, using the color #OE1829 as the source - exported from affinity, shows up as is, using Figma color picker. But the same source picked with Pika shows up as #111726. Picking a block with #111726 shows up as #121725 - which works out considering the tool is not accurate.  <img width="931" height="601" alt="Image" src="https://github.com/user-attachments/assets/15d1e9f3-cd3e-42f5-a80a-b5e01e7143e4" />  Picking again with Pika, foreground is the source (#0E1829 -> #101828) and the background is Pika picked color (#111726 -> #121725). <img width="1126" height="726" alt="Image" src="https://github.com/user-attachments/assets/722623bd-714a-46a5-97c0-995468d6161a" />   - OS: macOS 26.3 (25D125)  - App Version: 1.4.1-beta1 (been experiencing the same issue with 0.0.5 - which I've been using for over the last two years without updating)  - Architecture: Apple Silicon  This is not a new issue - been experiencing this since the inception of my usage, which is roughly over two years ago with 0.0.5 
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging. On it. Will have a beta out shortly which should fix this.
  > Just pushed a beta for this. Just subscribe to them and update:  <img width="419" height="194" alt="Image" src="https://github.com/user-attachments/assets/9d87d9d9-0868-4091-84eb-786efeb50ae6" />  <img width="471" height="552" alt="Image" src="https://github.com/user-attachments/assets/0fe06343-4352-4843-8858-be77c53d83ea" />  Let me know if it resolves the issue.
  > <img width="1179" height="799" alt="Image" src="https://github.com/user-attachments/assets/d8b87650-954f-4e32-a4d5-d019da6ddc36" />  It still is appearing differently after updating the app. one small thing, the color that is shown in the app is slightly different from the source and the color it thinks it is. the middle patch is the screenshot of the color taken from the app and placed over the source and pika defined color. hope this is useful somehow

- **Issue #179** (2026-03-02): **brew sha issue**
  *Symptoms*: Error: SHA-256 mismatch Expected: 3d0b9404f09367a8bd4f3005b2d0943846cefc46e694a9202256e327361e0c0e   Actual: 55a8dc20e491bdfe3fa24692fb8d1af165731861374958e964f857b3fa31616c
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging! Just moved to a new deployment process so there might be some teething issues. Will take a look. 
  > Great, got a PR to fix on homebrew. Appreciate it.

- **Issue #170** (2026-02-28): **Apple finds 1.4 as suspicious. Must be allowed from System Settings**
  *Symptoms*: The title says it all.
  **Post-Mortem & Fix Analysis**:
  > Yiiiiiiiiiiiiikes. That's not good. Weirdly that didn't happen to me in testing, but I automated a bunch of the deployment so I'm guessing something got missed there.   Will dig into it. Thanks for flagging. 
  > Fixed. https://github.com/superhighfives/pika/releases/tag/1.4.0  Apologies, and thanks for flagging. Built a new deployment process on a new laptop and didn't have the right keys. It only impacted new downloads (it was the DMG itself, not the app), so added a check to make sure it doesn't happen again. Thank you!

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

### Incident Patch 1: `94647a7c` (2026-08-01)
**Commit Message**: Fix grammar in comments

Fix grammar in comments

**File**: `Pika/Extensions/NSColor+Lab.swift` (modified, +2/-2)
```diff
@@ -19,9 +19,9 @@ extension NSColor {
      */
 
     /**
-     Get the rgb values of this color in opengl format.
+     Get the RGB values of this color in OpenGL format.
 
-     - returns: An NSColor as an opengl string.
+     - returns: An NSColor as an OpenGL string.
      */
     func toOpenGLString(style: CopyFormat = .css) -> String {
         let RGB = toRGBAComponents()
```

---

### Incident Patch 2: `01b87776` (2026-07-31)
**Commit Message**: Merge pull request #255 from superhighfives/fix/review-drop-build

Drop the build from the review so it actually posts

**File**: `.github/workflows/claude-code-review.yml` (modified, +7/-20)
```diff
@@ -17,26 +17,13 @@ jobs:
   review:
     # Standard lives in superhighfives/control-room so every repo reviews the
     # same way. Repo-specific rules go in CLAUDE.md.
+    #
+    # No verify_commands: the review reads the diff and doesn't build. An Xcode
+    # build outlives the review agent's per-command timeout, gets backgrounded,
+    # and the agent stalls waiting for it — finishing a green check without ever
+    # posting a review. tests.yml already builds and runs the suite (~90s), so
+    # the review doesn't need to. Reading-only, it runs fast on the default
+    # ubuntu runner and posts every time.
     uses: superhighfives/control-room/.github/workflows/review.yml@main
-    with:
-      # Pinned to match tests.yml — macos-latest doesn't ship Xcode 16.3, so
-      # xcode-select fails there. Bump both together.
-      runs_on: macos-15
-      runtime: none
-      setup_command: sudo xcode-select -s /Applications/Xcode_16.3.app
-      # Build for testing rather than a full test run: it catches the compile
-      # errors that matter for review without the runtime cost of the suite,
-      # which tests.yml already covers.
-      #
-      # Resolve Swift packages first, as a separate step — same as tests.yml.
-      # Without it, build-for-testing resolves SPM cold, and the `| tail -40`
-      # buffers all output so nothing streams; the review agent sits on a build
-      # that can run past the timeout and gets cancelled without ever reviewing.
-      verify_commands: |
-        xcodebuild -resolvePackageDependencies -project Pika.xcodeproj -scheme Pika
-        set -o pipefail && xcodebuild build-for-testing -project Pika.xcodeproj -scheme Pika -destination 'platform=macOS' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO 2>&1 | tail -40
-      # Safety net over the pre-resolve fix above, so a slow cold build can't get
-      # cancelled mid-review before Claude posts anything.
-      timeout_minutes: 45
     secrets:
       CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

---

### Incident Patch 3: `7dd82fcf` (2026-07-31)
**Commit Message**: Drop the build from the review so it actually posts

The review workflow handed Claude an Xcode build-for-testing to run and
report. That build outlives the review agent's 300s per-command timeout,
gets backgrounded, and the agent stalls waiting for it — composing a
review with a <FILL_IN_RESULT> placeholder for the build, then passively
waiting for a completion notification and ending the session without
posting. The check goes green with no review (seen on #251: an 8-17 min
run, success, zero review posted, twice).

Allowing the Monitor tool (control-room#4) let the agent wait, but the
build is simply slower than the agent's willingness to actively wait, so
it still didn't post. The real fix is to not build during review at all:
tests.yml already builds and runs the suite (~90s), so the review only
needs to read the diff. Dropping verify_commands also drops the macOS
runner and Xcode setup — the read-only review runs fast on ubuntu and
posts every time.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/claude-code-review.yml` (modified, +7/-20)
```diff
@@ -17,26 +17,13 @@ jobs:
   review:
     # Standard lives in superhighfives/control-room so every repo reviews the
     # same way. Repo-specific rules go in CLAUDE.md.
+    #
+    # No verify_commands: the review reads the diff and doesn't build. An Xcode
+    # build outlives the review agent's per-command timeout, gets backgrounded,
+    # and the agent stalls waiting for it — finishing a green check without ever
+    # posting a review. tests.yml already builds and runs the suite (~90s), so
+    # the review doesn't need to. Reading-only, it runs fast on the default
+    # ubuntu runner and posts every time.
     uses: superhighfives/control-room/.github/workflows/review.yml@main
-    with:
-      # Pinned to match tests.yml — macos-latest doesn't ship Xcode 16.3, so
-      # xcode-select fails there. Bump both together.
-      runs_on: macos-15
-      runtime: none
-      setup_command: sudo xcode-select -s /Applications/Xcode_16.3.app
-      # Build for testing rather than a full test run: it catches the compile
-      # errors that matter for review without the runtime cost of the suite,
-      # which tests.yml already covers.
-      #
-      # Resolve Swift packages first, as a separate step — same as tests.yml.
-      # Without it, build-for-testing resolves SPM cold, and the `| tail -40`
-      # buffers all output so nothing streams; the review agent sits on a build
-      # that can run past the timeout and gets cancelled without ever reviewing.
-      verify_commands: |
-        xcodebuild -resolvePackageDependencies -project Pika.xcodeproj -scheme Pika
-        set -o pipefail && xcodebuild build-for-testing -project Pika.xcodeproj -scheme Pika -destination 'platform=macOS' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO 2>&1 | tail -40
-      # Safety net over the pre-resolve fix above, so a slow cold build can't get
-      # cancelled mid-review before Claude posts anything.
-      timeout_minutes: 45
     secrets:
       CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

---

### Incident Patch 4: `0923237e` (2026-07-31)
**Commit Message**: Merge pull request #254 from superhighfives/fix/review-workflow-prewarm-spm

Pre-resolve SPM in review workflow to stop 30-min timeouts

**File**: `.github/workflows/claude-code-review.yml` (modified, +9/-1)
```diff
@@ -27,8 +27,16 @@ jobs:
       # Build for testing rather than a full test run: it catches the compile
       # errors that matter for review without the runtime cost of the suite,
       # which tests.yml already covers.
+      #
+      # Resolve Swift packages first, as a separate step — same as tests.yml.
+      # Without it, build-for-testing resolves SPM cold, and the `| tail -40`
+      # buffers all output so nothing streams; the review agent sits on a build
+      # that can run past the timeout and gets cancelled without ever reviewing.
       verify_commands: |
+        xcodebuild -resolvePackageDependencies -project Pika.xcodeproj -scheme Pika
         set -o pipefail && xcodebuild build-for-testing -project Pika.xcodeproj -scheme Pika -destination 'platform=macOS' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO 2>&1 | tail -40
-      timeout_minutes: 30
+      # Safety net over the pre-resolve fix above, so a slow cold build can't get
+      # cancelled mid-review before Claude posts anything.
+      timeout_minutes: 45
     secrets:
       CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

---

### Incident Patch 5: `d4589b1f` (2026-07-31)
**Commit Message**: Pre-resolve SPM in review workflow to stop 30-min timeouts

The Claude Code Review job hands the review agent a `xcodebuild
build-for-testing` to run and report. It resolved Swift packages cold
inside that build, and `2>&1 | tail -40` buffers all output so nothing
streams — the agent sat on a build that overran `timeout_minutes: 30`
and the job got cancelled before any review was posted (e.g. PR #251,
cancelled at 30m17s with xcodebuild still running as an orphan process).

Resolve packages in a separate step first, mirroring tests.yml (which
builds in ~90s), and raise the timeout to 45 minutes as a safety net so
a slow cold build can't get cancelled mid-review.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `.github/workflows/claude-code-review.yml` (modified, +9/-1)
```diff
@@ -27,8 +27,16 @@ jobs:
       # Build for testing rather than a full test run: it catches the compile
       # errors that matter for review without the runtime cost of the suite,
       # which tests.yml already covers.
+      #
+      # Resolve Swift packages first, as a separate step — same as tests.yml.
+      # Without it, build-for-testing resolves SPM cold, and the `| tail -40`
+      # buffers all output so nothing streams; the review agent sits on a build
+      # that can run past the timeout and gets cancelled without ever reviewing.
       verify_commands: |
+        xcodebuild -resolvePackageDependencies -project Pika.xcodeproj -scheme Pika
         set -o pipefail && xcodebuild build-for-testing -project Pika.xcodeproj -scheme Pika -destination 'platform=macOS' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO 2>&1 | tail -40
-      timeout_minutes: 30
+      # Safety net over the pre-resolve fix above, so a slow cold build can't get
+      # cancelled mid-review before Claude posts anything.
+      timeout_minutes: 45
     secrets:
       CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

---

### Incident Patch 6: `fe45a88c` (2026-07-29)
**Commit Message**: Bump version to 1.9.0 (build 97/98)

**File**: `Pika.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -1266,7 +1266,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 95;
+				CURRENT_PROJECT_VERSION = 97;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1298,7 +1298,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 95;
+				CURRENT_PROJECT_VERSION = 97;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1331,7 +1331,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 96;
+				CURRENT_PROJECT_VERSION = 98;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1364,7 +1364,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 96;
+				CURRENT_PROJECT_VERSION = 98;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
```

---

### Incident Patch 7: `1a07145f` (2026-07-29)
**Commit Message**: Merge pull request #253 from superhighfives/fix/companion-window-top-clamp

Fix window outline/shadow stretching when dragged to screen top

**File**: `Pika/Services/WindowCoordinator.swift` (modified, +16/-2)
```diff
@@ -219,7 +219,7 @@ class WindowCoordinator: NSObject {
     }
 
     private func makeShadowWindow() -> NSWindow {
-        let window = NSWindow(
+        let window = CompanionWindow(
             contentRect: shadowFrame(),
             styleMask: .borderless,
             backing: .buffered,
@@ -240,7 +240,7 @@ class WindowCoordinator: NSObject {
     }
 
     private func makeBorderWindow() -> NSWindow {
-        let window = NSWindow(
+        let window = CompanionWindow(
             contentRect: borderFrame(),
             styleMask: .borderless,
             backing: .buffered,
@@ -443,6 +443,20 @@ class WindowCoordinator: NSObject {
     }
 }
 
+/// A borderless, decorative companion window (the hairline border and the custom shadow)
+/// that must be free to extend past the top of the screen. AppKit's default
+/// `constrainFrameRect(_:to:)` clamps a window so its top edge stays below the menu bar;
+/// because these companions sit `borderPad`/`shadowPad` *beyond* the main window's frame,
+/// that clamp pins their top near the screen edge as the main window is dragged upward,
+/// while their height stays fixed — dragging their bottom edge down and detaching the
+/// outline/shadow from the window. They ignore mouse events and only trace the main frame,
+/// so opt out of constraining entirely and let them track it exactly, even off-screen.
+private final class CompanionWindow: NSWindow {
+    override func constrainFrameRect(_ frameRect: NSRect, to _: NSScreen?) -> NSRect {
+        frameRect
+    }
+}
+
 /// Draws the main window's hairline outline for the companion border window. Strokes a
 /// rounded rect matching the window's corner radius, in a colour that adapts to the
 /// current appearance (matching `AdaptiveDivider`).
```

---

### Incident Patch 8: `1bfa8685` (2026-07-28)
**Commit Message**: Bump version to 1.9.0 (build 95/96)

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `Pika.xcodeproj/project.pbxproj` (modified, +8/-8)
```diff
@@ -1266,7 +1266,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 94;
+				CURRENT_PROJECT_VERSION = 95;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1280,7 +1280,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta3;
+				MARKETING_VERSION = 1.9.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG TARGET_SPARKLE";
@@ -1298,7 +1298,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 94;
+				CURRENT_PROJECT_VERSION = 95;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1312,7 +1312,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta3;
+				MARKETING_VERSION = 1.9.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = TARGET_SPARKLE;
@@ -1331,7 +1331,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 91;
+				CURRENT_PROJECT_VERSION = 96;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1345,7 +1345,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta3;
+				MARKETING_VERSION = 1.9.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG TARGET_MAS";
@@ -1364,7 +1364,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 91;
+				CURRENT_PROJECT_VERSION = 96;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1378,7 +1378,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta3;
+				MARKETING_VERSION = 1.9.0;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = TARGET_MAS;
```

---

### Incident Patch 9: `b0a25d69` (2026-07-25)
**Commit Message**: Document pick/copy format-suffix URL triggers in Help

The pika://pick|copy/<fg|bg>/<format> variants are already supported
by URLSchemeHandler and documented in the README, but were missing
from the in-app Help and website. Add them to HelpData with new
localised descriptions across all nine locales for full parity.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `Pika/Assets/de.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -448,6 +448,17 @@
 /* Appearance */
 "help.url.group.appearance" = "Erscheinungsbild";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "Vordergrund in bestimmtem Format auswählen";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "Hintergrund in bestimmtem Format auswählen";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "Vordergrund in bestimmtem Format kopieren";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "Hintergrund in bestimmtem Format kopieren";
 /* Set foreground color */
 "help.url.set.foreground" = "Vordergrundfarbe setzen";
 
```

**File**: `Pika/Assets/en.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -505,6 +505,17 @@
 /* Appearance */
 "help.url.group.appearance" = "Appearance";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "Pick foreground in a specific format";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "Pick background in a specific format";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "Copy foreground in a specific format";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "Copy background in a specific format";
 /* Set foreground color */
 "help.url.set.foreground" = "Set foreground color";
 
```

**File**: `Pika/Assets/es.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -448,6 +448,17 @@
 /* Appearance */
 "help.url.group.appearance" = "Apariencia";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "Seleccionar primer plano en un formato específico";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "Seleccionar segundo plano en un formato específico";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "Copiar primer plano en un formato específico";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "Copiar segundo plano en un formato específico";
 /* Set foreground color */
 "help.url.set.foreground" = "Establecer color de primer plano";
 
```

**File**: `Pika/Assets/fr.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -448,6 +448,17 @@
 /* Appearance */
 "help.url.group.appearance" = "Apparence";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "Sélectionner un premier plan dans un format spécifique";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "Sélectionner un arrière-plan dans un format spécifique";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "Copier le premier plan dans un format spécifique";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "Copier l'arrière-plan dans un format spécifique";
 /* Set foreground color */
 "help.url.set.foreground" = "Définir la couleur de premier plan";
 
```

**File**: `Pika/Assets/hr.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -481,6 +481,17 @@
 /* Appearance */
 "help.url.group.appearance" = "Izgled";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "Odaberi prednju boju u određenom formatu";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "Odaberi boju pozadine u određenom formatu";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "Kopiraj prednju boju u određenom formatu";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "Kopiraj boju pozadine u određenom formatu";
 /* Set foreground color */
 "help.url.set.foreground" = "Postavi prednju boju";
 
```

**File**: `Pika/Assets/ja.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -481,6 +481,17 @@
 /* Appearance */
 "help.url.group.appearance" = "外観";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "指定した形式で前景色をピック";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "指定した形式で背景色をピック";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "指定した形式で前景色をコピー";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "指定した形式で背景色をコピー";
 /* Set foreground color */
 "help.url.set.foreground" = "前景色を設定";
 
```

**File**: `Pika/Assets/pl.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -448,6 +448,17 @@
 /* Appearance */
 "help.url.group.appearance" = "Wygląd";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "Wybierz pierwszy plan w określonym formacie";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "Wybierz tło w określonym formacie";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "Kopiuj pierwszy plan w określonym formacie";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "Kopiuj tło w określonym formacie";
 /* Set foreground color */
 "help.url.set.foreground" = "Ustaw kolor pierwszego planu";
 
```

**File**: `Pika/Assets/zh-Hans.lproj/Localizable.strings` (modified, +11/-0)
```diff
@@ -448,6 +448,17 @@
 /* Appearance */
 "help.url.group.appearance" = "外观";
 
+/* Pick foreground in a specific format */
+"help.url.pick.foreground_format" = "以指定格式选择前景色";
+
+/* Pick background in a specific format */
+"help.url.pick.background_format" = "以指定格式选择背景色";
+
+/* Copy foreground in a specific format */
+"help.url.copy.foreground_format" = "以指定格式复制前景色";
+
+/* Copy background in a specific format */
+"help.url.copy.background_format" = "以指定格式复制背景色";
 /* Set foreground color */
 "help.url.set.foreground" = "设置前景色";
 
```

---

### Incident Patch 10: `911471ec` (2026-07-25)
**Commit Message**: Remove stray debug print of App Store lookup response

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `Pika/Extensions/LookUpAPI.swift` (modified, +0/-2)
```diff
@@ -31,8 +31,6 @@ final class LookUpAPI {
         let (data, _) = try await session.data(for: request)
         let response = try jsonDecoder.decode(LookUpResponse.self, from: data)
 
-        print(response)
-
         return response.results.first.map {
             .init(version: $0.version,
                   minimumOsVersion: $0.minimumOsVersion,
```

---

### Incident Patch 11: `f1b9d7e6` (2026-07-23)
**Commit Message**: Bump version to 1.9.0-beta3 (build 94)

**File**: `Pika.xcodeproj/project.pbxproj` (modified, +6/-6)
```diff
@@ -1266,7 +1266,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 93;
+				CURRENT_PROJECT_VERSION = 94;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1280,7 +1280,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta2;
+				MARKETING_VERSION = 1.9.0-beta3;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG TARGET_SPARKLE";
@@ -1298,7 +1298,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 93;
+				CURRENT_PROJECT_VERSION = 94;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1312,7 +1312,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta2;
+				MARKETING_VERSION = 1.9.0-beta3;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = TARGET_SPARKLE;
@@ -1345,7 +1345,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta2;
+				MARKETING_VERSION = 1.9.0-beta3;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG TARGET_MAS";
@@ -1378,7 +1378,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta2;
+				MARKETING_VERSION = 1.9.0-beta3;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = TARGET_MAS;
```

---

### Incident Patch 12: `a784a713` (2026-07-23)
**Commit Message**: Fix truncated compliance badges in preferences preview tiles

The contrast-standard preview tiles laid their compliance badges out
compressed at the tile width, so labels truncated ("AA…La…"); the denser
tiles even scaled *after* laying out compressed, so scaling didn't help.
Lay the badges out at their full natural width first, then uniformly scale
down to fit the tile — via a small ScaleToFitWidth helper for the WCAG/APCA
tiles and a fixed reference width for the Spacer-aligned "both" tile.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `Pika/Views/ComplianceButtons.swift` (modified, +55/-11)
```diff
@@ -1,6 +1,39 @@
 import Defaults
 import SwiftUI
 
+private struct NaturalWidthKey: PreferenceKey {
+    static var defaultValue: CGFloat = 0
+    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
+}
+
+/// Renders `content` at its natural (untruncated) width, then uniformly scales it down to
+/// fit the available width. The preview tiles are narrower than the full compliance badges
+/// need, and laying the badges out at the tile width just truncates them ("AA…La…"); this
+/// keeps them whole and legible by shrinking instead.
+private struct ScaleToFitWidth<Content: View>: View {
+    var alignment: Alignment = .leading
+    @ViewBuilder var content: Content
+    @State private var naturalWidth: CGFloat = 0
+
+    private var anchor: UnitPoint { alignment == .center ? .center : .leading }
+
+    var body: some View {
+        GeometryReader { geo in
+            let scale = naturalWidth > 0 ? min(1, geo.size.width / naturalWidth) : 1
+            content
+                .fixedSize()
+                .background(
+                    GeometryReader { proxy in
+                        Color.clear.preference(key: NaturalWidthKey.self, value: proxy.size.width)
+                    }
+                )
+                .scaleEffect(scale, anchor: anchor)
+                .frame(width: geo.size.width, height: geo.size.height, alignment: alignment)
+        }
+        .onPreferenceChange(NaturalWidthKey.self) { naturalWidth = $0 }
+    }
+}
+
 struct CompliancePreviewWCAG: View {
     @Default(.combineCompliance) var combineCompliance
     var width: CGFloat
@@ -14,9 +47,11 @@ struct CompliancePreviewWCAG: View {
             Button(
                 action: { combineCompliance = false },
                 label: {
-                    ComplianceToggleGroup(complianceData: .wcag(wcag), theme: .weight)
-                        .padding(20.0)
-                        .frame(maxWidth: width, maxHeight: .infinity, alignment: .leading)
+                    ScaleToFitWidth {
+                        ComplianceToggleGroup(complianceData: .wcag(wcag), theme: .weight)
+                            .padding(20.0)
+                    }
+                    .frame(maxWidth: width, maxHeight: .infinity, alignment: .leading)
                 }
             )
             .buttonStyle(AppearanceButtonStyle(
@@ -28,9 +63,11 @@ struct CompliancePreviewWCAG: View {
             Button(
                 action: { combineCompliance = true },
                 label: {
-                    ComplianceToggleGroup(complianceData: .wcag(wcag), theme: .contrast)
-                        .padding(20.0)
-                        .frame(maxWidth: width, maxHeight: .infinity, alignment: .leading)
+                    ScaleToFitWidth {
+                        ComplianceToggleGroup(complianceData: .wcag(wcag), theme: .contrast)
+                            .padding(20.0)
+                    }
+                    .frame(maxWidth: width, maxHeight: .infinity, alignment: .leading)
                 }
             )
             .buttonStyle(AppearanceButtonStyle(
@@ -54,9 +91,11 @@ struct CompliancePreviewAPCA: View {
             title: PikaText.textAppearanceAPCATitle,
             description: PikaText.textAppearanceAPCADescription
         ) {
-            ComplianceToggleGroup(complianceData: .apca(apca), theme: .weight)
-                .padding(20.0)
-                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
+            ScaleToFitWidth(alignment: .center) {
+                ComplianceToggleGroup(complianceData: .apca(apca), theme: .weight)
+                    .padding(20.0)
+            }
+            .frame(maxWidth: .infinity, maxHeight: .infinity)
         }
     }
 }
@@ -94,7 +133,11 @@ struct CompliancePreviewBoth: View {
     @ViewBuilder
     private func footerPreview(wcag: NSColor.WCAG, apca: NSColor.APCA, theme: ComplianceToggleGroup.Themes) -> some View {
         GeometryReader { geometry in
-            let scale = min(1.0, geometry.size.width / 380)
+            // Lay the row out at its full natural width so the Spacer-aligned badges keep
+            // their real size, then scale the whole thing down to the tile — otherwise the
+            // badges compress and truncate at the tile width before the scale is applied.
+            let reference: CGFloat = 430
+            let scale = min(1.0, geometry.size.width / reference)
 
             VStack(alignment: .leading, spacing: 4.0) {
                 HStack(spacing: 0) {
@@ -130,8 +173,9 @@ struct CompliancePreviewBoth: View {
                 }
             }
             .padding(.horizontal, 10.0)
-            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
+            .frame(width: reference, alignment: .leading)
             .scaleEffect(scale, anchor: .leading)
+            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
         }
     }
```

---

### Incident Patch 13: `2affb8f3` (2026-07-23)
**Commit Message**: Fix picking shadow, add fadeable custom shadow, and rework footer shedding

The "hidden while picking" shadow never worked: every call routed through
`NSApp.delegate as? AppDelegate`, but under `@NSApplicationDelegateAdaptor`
`NSApp.delegate` is SwiftUI's forwarding wrapper, so the cast was always nil
and the call silently no-opped. Add an `AppDelegate.shared` accessor captured
on launch and use it everywhere the fragile cast was used — this also repairs
the same latent bug in the URL scheme handler and the Touch Bar (a force
unwrap that would have crashed on any Touch Bar Mac).

Replace the native window shadow in `.hiddenWhilePicking` with a custom,
layer-backed companion window whose `shadowOpacity` can animate — AppKit's
`hasShadow` is on/off only. The shadow now fades out while the sampler is up
(the hairline edge border crossfades in) and fades back when picking ends, and
softens to a lighter resting shadow when the window loses focus.

Rework the contrast footer's adaptive shedding: it no longer hides on width —
WCAG/APCA drop just their right-hand compliance badges (keeping the left ratio
value) and the denser "both" view clips its right edge. On height it now stays
until t

**File**: `Pika/AppDelegate.swift` (modified, +8/-0)
```diff
@@ -8,6 +8,13 @@ import SwiftUI
 #endif
 
 class AppDelegate: NSObject, NSApplicationDelegate {
+    /// The live app delegate. `NSApp.delegate` cannot be relied on here: under
+    /// `@NSApplicationDelegateAdaptor`, AppKit's `NSApp.delegate` is SwiftUI's own
+    /// forwarding wrapper (`SwiftUI.AppDelegate`), so `NSApp.delegate as? AppDelegate`
+    /// is always `nil` and any call chained off it silently no-ops. Capture the real
+    /// instance on launch and reach it through here instead.
+    weak static var shared: AppDelegate?
+
     var eyedroppers: Eyedroppers!
 
     let notificationCenter = NotificationCenter.default
@@ -52,6 +59,7 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     }
 
     func applicationWillFinishLaunching(_: Notification) {
+        AppDelegate.shared = self
         NSApp.setActivationPolicy(.prohibited)
         NSAppleEventManager.shared().setEventHandler(
             URLSchemeHandler.shared,
```

**File**: `Pika/Services/Eyedropper.swift` (modified, +4/-5)
```diff
@@ -121,7 +121,7 @@ extension Eyedropper {
         // picked near the window edge. Restored on every terminal pick path below;
         // a chained background pick simply re-suppresses when it starts. The call is
         // a no-op unless the shadow preference is `.hiddenWhilePicking`.
-        (NSApp.delegate as? AppDelegate)?.windowCoordinator.setPickingShadowSuppressed(true)
+        AppDelegate.shared?.windowCoordinator.setPickingShadowSuppressed(true)
 
         DispatchQueue.main.asyncAfter(deadline: .now()) {
             if Defaults[.appMode].usesPopover {
@@ -135,8 +135,7 @@ extension Eyedropper {
                     self.commitCancelledChain()
                 } else {
                     // Fresh pick cancelled: restore the shadow the sampler suppressed.
-                    (NSApp.delegate as? AppDelegate)?.windowCoordinator
-                        .setPickingShadowSuppressed(false)
+                    AppDelegate.shared?.windowCoordinator.setPickingShadowSuppressed(false)
                 }
 
                 if self.forceShow {
@@ -174,7 +173,7 @@ extension Eyedropper {
 
         if chainContrasting,
            type == .foreground,
-           let appDelegate = NSApp.delegate as? AppDelegate
+           let appDelegate = AppDelegate.shared
         {
             startChainedBackgroundPick(using: appDelegate)
         } else {
@@ -221,6 +220,6 @@ extension Eyedropper {
 
         // Terminal path for a committed pick (or a cancelled chain): bring the
         // window's shadow back. No-op unless the shadow preference suppressed it.
-        (NSApp.delegate as? AppDelegate)?.windowCoordinator.setPickingShadowSuppressed(false)
+        AppDelegate.shared?.windowCoordinator.setPickingShadowSuppressed(false)
     }
 }
```

**File**: `Pika/Services/PikaWindow.swift` (modified, +4/-5)
```diff
@@ -23,11 +23,10 @@ class PikaWindow {
         window.standardWindowButton(NSWindow.ButtonType.zoomButton)!.isEnabled = false
         window.titlebarAppearsTransparent = true
 
-        // The window's drop shadow can bleed onto pixels beneath its edge and skew
-        // colour readings taken nearby. Honour the user's shadow preference; the
-        // `.hiddenWhilePicking` case keeps the resting shadow and is dropped mid-pick
-        // by `Eyedropper.start`. Setting *changes* (and the companion border shown while
-        // shadowless) are handled in `WindowCoordinator`.
+        // The window's drop shadow can bleed onto pixels beneath its edge and skew colour
+        // readings taken nearby. Seed a sensible initial native shadow from the preference;
+        // `WindowCoordinator.applyShadowState` takes full ownership immediately after setup
+        // (including swapping in the custom, fadeable shadow for `.hiddenWhilePicking`).
         window.hasShadow = Defaults[.windowShadow].showsShadowAtRest
 
         Defaults.observe(.appFloating) { change in
```

**File**: `Pika/Services/URLSchemeHandler.swift` (modified, +2/-2)
```diff
@@ -83,7 +83,7 @@ final class URLSchemeHandler: NSObject {
         guard
             let hex,
             hex.count == 6,
-            let appDelegate = NSApp.delegate as? AppDelegate
+            let appDelegate = AppDelegate.shared
         else { return }
         let color = NSColor(hex: hex)
         if task == "foreground" {
@@ -181,7 +181,7 @@ final class URLSchemeHandler: NSObject {
 
         // Apply the first history entry as the active colours
         if let first = autoHistory.pairs.first,
-           let appDelegate = NSApp.delegate as? AppDelegate
+           let appDelegate = AppDelegate.shared
         {
             appDelegate.eyedroppers.foreground.set(first.foregroundColor)
             appDelegate.eyedroppers.background.set(first.backgroundColor)
```

**File**: `Pika/Services/WindowCoordinator.swift` (modified, +254/-45)
```diff
@@ -12,6 +12,31 @@ class WindowCoordinator: NSObject {
     /// The border window extends this far beyond the main window frame so its outline can
     /// be drawn out on the window's visible glass edge (which sits just past the frame).
     private let borderPad: CGFloat = 6.0
+
+    /// A companion window that renders the main window's drop shadow ourselves, used only
+    /// in `.hiddenWhilePicking`. AppKit's native `hasShadow` is a plain on/off flag with no
+    /// public opacity control, so a *fade* on pick is impossible with it. This layer-backed
+    /// window sits behind the main window (its opaque fill is occluded; only the soft shadow
+    /// spills past the edges) and its `shadowOpacity` animates 1↔0 as picking starts/ends.
+    private var shadowWindow: NSWindow?
+    /// Room around the main frame for the soft shadow to spill without the window clipping it.
+    private let shadowPad: CGFloat = 60.0
+    /// Radius of the main window's visible rounded corners; the border stroke and the custom
+    /// shadow both trace this so they line up with the glass edge.
+    private let windowCornerRadius: CGFloat = 20.0
+    /// Resting opacity of the custom shadow when the window is focused, tuned to sit close
+    /// to the native macOS shadow.
+    private let focusedShadowOpacity: Float = 0.30
+    /// Resting opacity when the window isn't key — a lighter shadow, mirroring how AppKit
+    /// softens a native window's shadow once it loses focus.
+    private let unfocusedShadowOpacity: Float = 0.13
+    /// The resting opacity for the current focus state (ignores picking suppression).
+    private var restingShadowOpacity: Float {
+        pikaWindow?.isKeyWindow == true ? focusedShadowOpacity : unfocusedShadowOpacity
+    }
+
+    /// Whether an active pick currently wants the shadow suppressed. Drives the fade target.
+    private var isPickingSuppressed = false
     private var splashWindow: NSWindow!
     private var aboutWindow: NSWindow?
     private var helpWindow: NSWindow?
@@ -43,74 +68,177 @@ class WindowCoordinator: NSObject {
             self.resizeMainWindow(toFitContent: size)
         }
 
-        // Apply the shadow setting and show/hide the companion border to match.
-        Defaults.observe(.windowShadow) { [weak self] change in
-            guard let self else { return }
-            self.pikaWindow.hasShadow = change.newValue.showsShadowAtRest
-            self.updateShadowBorder()
+        // Re-apply the whole shadow configuration when the setting changes.
+        Defaults.observe(.windowShadow) { [weak self] _ in
+            self?.applyShadowState(animated: false)
         }.tieToLifetime(of: self)
 
-        // Keep the border on the same window level as the main window (which PikaWindow
-        // moves between .floating/.normal), so toggling "float on top" doesn't leave the
-        // border stranded on a stale level.
+        // Keep the companion windows on the same level as the main window (which PikaWindow
+        // moves between .floating/.normal), so toggling "float on top" doesn't leave them
+        // stranded on a stale level.
         Defaults.observe(.appFloating) { [weak self] change in
-            self?.borderWindow?.level = change.newValue == true ? .floating : .normal
+            let level: NSWindow.Level = change.newValue == true ? .floating : .normal
+            self?.borderWindow?.level = level
+            self?.shadowWindow?.level = level
         }.tieToLifetime(of: self)
 
-        // Keep the border aligned to the main window and re-attached whenever it shows.
+        // Keep the companion windows aligned to the main window as it resizes and moves.
         for name in [NSWindow.didResizeNotification, NSWindow.didMoveNotification] {
             notificationCenter.addObserver(forName: name, object: pikaWindow, queue: .main) {
                 [weak self] _ in
-                guard let self, let border = self.borderWindow, border.parent != nil else { return }
-                border.setFrame(self.borderFrame(), display: true)
+                self?.positionCompanionWindows()
             }
         }
-        notificationCenter.addObserver(
-            forName: NSWindow.didBecomeKeyNotification, object: pikaWindow, queue: .main
-        ) { [weak self] _ in
-            self?.updateShadowBorder()
+        // Focus changes fade the custom shadow between its focused and unfocused resting
+        // strengths (`didBecomeKey` also re-asserts the whole configuration on show).
+        for name in [NSWindow.didBecomeKeyNotification, NSWindow.didResignKeyNotification] {
+            notificationCenter.addObserver(forName: name, object: pikaWindow, queue: .main) {
+                [weak self] _ in
+                self?.applyShadowState(animated: true)
+            }
         }
 
-        updateShadowBorder()
+        applyShadowState(animated: false)
     }
 
-    /// The main window can lose its drop shadow (either via the setting or wh
```

**File**: `Pika/TouchBar/PikaTouchBar.swift` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ class PikaTouchBarController: NSWindowController, NSTouchBarDelegate {
         _: NSTouchBar,
         makeItemForIdentifier identifier: NSTouchBarItem.Identifier
     ) -> NSTouchBarItem? {
-        let delegate = NSApplication.shared.delegate as? AppDelegate
+        let delegate = AppDelegate.shared
         let foreground = delegate!.eyedroppers.foreground
         let background = delegate!.eyedroppers.background
 
```

**File**: `Pika/Views/ContentView.swift` (modified, +21/-8)
```diff
@@ -98,7 +98,13 @@ struct ContentView: View {
             // clips. ANDed with user preferences below so the saved toggles survive
             // resizing (suppress-but-remember).
             let allowPreview = height >= PikaAdaptiveHeight.preview && width >= PikaAdaptiveWidth.preview
-            let allowContrast = height >= PikaAdaptiveHeight.contrast && width >= PikaAdaptiveWidth.contrast
+            // The contrast footer clings on far longer than the other elements. On height it
+            // stays until the window is short enough that the expand affordance tucks into
+            // the corner; on width it never hides outright — instead the WCAG/APCA rows drop
+            // just their right-hand compliance badges, keeping the left-most ratio value.
+            let allowContrastHeight = height >= PikaAdaptiveHeight.expandCornerBelow
+            let allowContrastWidth = width >= PikaAdaptiveWidth.contrast
+            let allowContrast = allowContrastHeight && allowContrastWidth
             let allowPalettes = height >= PikaAdaptiveHeight.palettes && width >= PikaAdaptiveWidth.palettes
             // The preview pill overlaps the type labels, so labels only show when the
             // pill is effectively hidden.
@@ -109,9 +115,9 @@ struct ContentView: View {
             let suppressed = (showColorPreview && !allowPreview)
                 || (showCompliance && !allowContrast)
                 || (historyDrawerVisible && !allowPalettes)
-            // Centre the affordance normally, but at very short heights tuck it into the
-            // top-right corner so it doesn't sit on top of the colour values.
-            let expandAlignment: Alignment = height < PikaAdaptiveHeight.expandCornerBelow ? .topTrailing : .center
+            // Always tuck the expand affordance into the top-right corner so it never sits
+            // on top of the colour values.
+            let expandAlignment: Alignment = .topTrailing
 
             VStack(alignment: .trailing, spacing: 0) {
                 Divider()
@@ -169,11 +175,17 @@ struct ContentView: View {
                         swapTimerSubscription = swapTimer.connect()
                     }
 
-                if showCompliance, allowContrast {
+                if showCompliance, allowContrastHeight {
                     AdaptiveDivider()
                     // Slide only — no opacity fade, so the footer is always full opacity.
-                    Footer(foreground: eyedroppers.foreground, background: eyedroppers.background)
-                        .transition(.move(edge: .bottom))
+                    // `showsCompliance` drops the right-hand badges when there isn't the
+                    // width for them, so the footer stays put and only sheds on height.
+                    Footer(
+                        foreground: eyedroppers.foreground,
+                        background: eyedroppers.background,
+                        showsCompliance: allowContrastWidth
+                    )
+                    .transition(.move(edge: .bottom))
                 }
                 if historyDrawerVisible, allowPalettes {
                     ColorHistoryDrawer(foreground: eyedroppers.foreground, background: eyedroppers.background)
@@ -196,7 +208,8 @@ struct ContentView: View {
                 case .ended: isHovering = false
                 }
             }
-            .animation(.easeInOut(duration: 0.2), value: allowContrast)
+            .animation(.easeInOut(duration: 0.2), value: allowContrastHeight)
+            .animation(.easeInOut(duration: 0.2), value: allowContrastWidth)
             .animation(.easeInOut(duration: 0.2), value: allowPalettes)
             .animation(.easeInOut(duration: 0.15), value: suppressed)
             .animation(.easeInOut(duration: 0.15), value: isHovering)
```

**File**: `Pika/Views/Footer.swift` (modified, +25/-11)
```diff
@@ -11,6 +11,9 @@ private struct FooterRow: View {
     @ObservedObject var foreground: Eyedropper
     @ObservedObject var background: Eyedropper
     var combineCompliance: Bool
+    /// When false there isn't the width for the compliance badges, so the whole right-hand
+    /// side (divider + toggle group) drops and only the left-most ratio value remains.
+    var showsCompliance: Bool = true
 
     private var contrastHeader: String {
         kind == .wcag ? PikaText.textColorRatio : PikaText.textLightnessContrastValue
@@ -65,18 +68,20 @@ private struct FooterRow: View {
                 }
             }
 
-            AdaptiveDivider(axis: .vertical)
+            if showsCompliance {
+                AdaptiveDivider(axis: .vertical)
 
-            VStack(alignment: .leading, spacing: 3.0) {
-                Text(complianceLabel)
-                    .font(.caption)
-                    .fontWeight(.semibold)
-                    .foregroundStyle(.secondary)
+                VStack(alignment: .leading, spacing: 3.0) {
+                    Text(complianceLabel)
+                        .font(.caption)
+                        .fontWeight(.semibold)
+                        .foregroundStyle(.secondary)
 
-                ComplianceToggleGroup(
-                    complianceData: complianceData,
-                    theme: combineCompliance ? .contrast : .weight
-                )
+                    ComplianceToggleGroup(
+                        complianceData: complianceData,
+                        theme: combineCompliance ? .contrast : .weight
+                    )
+                }
             }
         }
         .frame(maxWidth: .infinity, alignment: .leading)
@@ -186,6 +191,9 @@ struct Footer: View {
     @Default(.contrastStandard) var contrastStandard
     @ObservedObject var foreground: Eyedropper
     @ObservedObject var background: Eyedropper
+    /// Whether there's width for the compliance badges. WCAG/APCA drop the badges entirely
+    /// when there isn't; the denser "both" view instead clips its right edge (below).
+    var showsCompliance: Bool = true
 
     var body: some View {
         Group {
@@ -200,13 +208,19 @@ struct Footer: View {
                     kind: contrastStandard == .wcag ? .wcag : .apca,
                     foreground: foreground,
                     background: background,
-                    combineCompliance: combineCompliance
+                    combineCompliance: combineCompliance,
+                    showsCompliance: showsCompliance
                 )
                 .frame(maxHeight: 50.0)
             }
         }
         .frame(maxWidth: .infinity, alignment: .leading)
         .padding(.horizontal, 12.0)
+        // Only the dense "both" view can overflow (its badges pack right against a Spacer);
+        // when narrow they spill past the edge and clip rather than compressing the value.
+        // WCAG/APCA instead drop their badges outright (see `showsCompliance`), so nothing
+        // there overflows and the clip is a harmless no-op for them.
+        .clipped()
         .background(AdaptivePanelBackground())
     }
 }
```

---

### Incident Patch 14: `c3b625c0` (2026-07-20)
**Commit Message**: Bump version to 1.9.0-beta2 (build 93)

**File**: `Pika.xcodeproj/project.pbxproj` (modified, +6/-6)
```diff
@@ -1266,7 +1266,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 92;
+				CURRENT_PROJECT_VERSION = 93;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1280,7 +1280,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta1;
+				MARKETING_VERSION = 1.9.0-beta2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG TARGET_SPARKLE";
@@ -1298,7 +1298,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 92;
+				CURRENT_PROJECT_VERSION = 93;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Pika/Preview Content\"";
 				DEVELOPMENT_TEAM = TGHU37N6EX;
@@ -1312,7 +1312,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta1;
+				MARKETING_VERSION = 1.9.0-beta2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = TARGET_SPARKLE;
@@ -1345,7 +1345,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta1;
+				MARKETING_VERSION = 1.9.0-beta2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG TARGET_MAS";
@@ -1378,7 +1378,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.9.0-beta1;
+				MARKETING_VERSION = 1.9.0-beta2;
 				PRODUCT_BUNDLE_IDENTIFIER = com.superhighfives.Pika;
 				PRODUCT_NAME = Pika;
 				SWIFT_ACTIVE_COMPILATION_CONDITIONS = TARGET_MAS;
```

---

### Incident Patch 15: `c5805e4c` (2026-07-20)
**Commit Message**: Serialise @claude runs to avoid concurrent context-fetch races

Rapid-fire @claude comments spawned concurrent claude.yml runs that raced
on context assembly, yielding an empty formatted_context and an immediate
is_error failure. Add a per-issue/PR concurrency group (no cancel — each
request is distinct and worth completing).

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `.github/workflows/claude.yml` (modified, +9/-0)
```diff
@@ -10,6 +10,15 @@ on:
   pull_request_review:
     types: [submitted]
 
+# Serialise runs per issue/PR so rapid-fire @claude comments don't spawn
+# concurrent runs that race on context assembly (which yields an empty
+# formatted_context and an immediate is_error failure). Unlike the review
+# workflow we don't cancel in-progress runs — each @claude request is distinct
+# and worth completing.
+concurrency:
+  group: claude-${{ github.event.issue.number || github.event.pull_request.number }}
+  cancel-in-progress: false
+
 jobs:
   claude:
     if: |
```

#### Recent Merged Pull Requests:
- **PR #267** (2026-09-21): chore: update ColorNames.json (@github-actions[bot])
- **PR #266** (2026-09-14): Use explicit secrets, not secrets: inherit, for control-room review (@superhighfives)
- **PR #265** (2026-09-14): Switch to secrets: inherit for control-room review workflow (@superhighfives)
- **PR #264** (2026-09-25): Added refraction effect for macOS 27 app icon (@alexkaessner)
- **PR #263** (2026-09-14): chore: update ColorNames.json (@github-actions[bot])
- **PR #262** (2026-09-11): Build Mac App Store releases as arm64 only (@superhighfives)
- **PR #261** (2026-08-10): Merge #258 and #259 from YuriNachos into 2.0.0 (@superhighfives)
- **PR #260** (2026-08-16): Inline editable colours (@superhighfives)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
