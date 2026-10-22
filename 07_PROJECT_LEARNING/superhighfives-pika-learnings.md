> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/superhighfives-pika-learnings.md`  
> **Source**: github ([https://github.com/superhighfives/pika](https://github.com/superhighfives/pika))  
> **Source Version**: `d28d2ecc`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T17:51:45.474Z  
> **Learning ID**: `learn-github-superhighfives-pika`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): superhighfives/pika

> **Canonical Artifact**: `07_PROJECT_LEARNING/superhighfives-pika-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/superhighfives/pika](https://github.com/superhighfives/pika))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-22T17:51:44.961Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `superhighfives/pika`
- **Description**: An open-source colour picker app for macOS
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2597 stars

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

    #if TARGET_SPARKLE
        /// Sparkle 2 updater. Created on launch so scheduled update checks start with the app.
        private(set) lazy var updaterController = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: self,
            userDriverDelegate: nil
        )
    #endif

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
        #if TARGET_SPARKLE
            // Sparkle 1 persisted the runtime feed URL to user defaults, where Sparkle 2 would
            // still read it. The feed now comes from `feedURLString(for:)`, so drop the stale copy.
            updaterController.updater.clearFeedURLFromUserDefaults()
        #endif

        eyedroppers = Eyedroppers()
        setupInterface()
        setupAppMode()
        registerTogglePikaShortcut()
        presentSplashIfNeeded()
        validateColorSpace()
        showPikaIfConfigured()
        registerGlobalKeyMonitor()

        // Refresh the colour-name list from color.pizza (catalogue + selected list) and cache
        // it; the eyedroppers rebuild via `.colorNamesUpdated`. Best-effort — falls back to
        // the bundled default offline.
        ColorNamesManager.shared.updateOnLaunch()
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

    // KeyboardShortcuts 3.x isolates `onKeyUp(for:action:)` to the main actor, so this
    // registration must run there too. Its only caller, `applicationDidFinishLaunching`,
    // is already main-actor isolated.
    @MainActor
    private func registerTogglePikaShortcut() {
        KeyboardShortcuts.onKeyUp(for: .togglePika) { [] in
            if Defaults[.viewedSplash] {
                NSApp.sendAction(#selector(AppDelegate.triggerPickForeground), to: nil, from: nil)
            }
        }
        KeyboardShortcuts.onKeyUp(for: .pickPair) { [] in
            if Defaults[.viewedSplash] {
                NSApp.sendAction(#selector(AppDelegate.triggerPickContrast), to: nil, from: nil)
            }
        }
    }

    /// The splash shows on every launch unless the user ticked its (pre-selected) "Don't show
    /// this again" checkbox — EXCEPT when a new onboarding version hasn't been seen yet, in which
    /// case it shows once for everyone (see `PikaConstants.currentSplashVersion`).
    private var shouldShowSplash: Bool {
        !Defaults[.hideSplashOnLaunch]
            || Defaults[.lastSeenSplashVersion] < PikaConstants.currentSplashVersion
    }

    private func presentSplashIfNeeded() {
        // `viewedSplash` still records the first run so the pick shortcuts stay gated until
        // onboarding is dismissed the first time. `lastSeenSplashVersion` is recorded on
        // dismissal (`closeSplashWindow`), not here — recording it now would make
        // `showPikaIfConfigured` reveal the main window behind the splash.
        if shouldShowSplash {
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
        // Pika should only ever appear once the splash has been dismissed. When the splash
        // is up, defer the main window until `closeSplashWindow` fires; otherwise show it now.
        guard !shouldShowSplash else { return }
        presentConfiguredPika()
    }

    private func presentConfiguredPika() {
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

            if self.handleCommandKey(event) { return nil }

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

    /// ⌘-key handling the menu bar can't provide. Returns true when `event` was consumed.
    private func handleCommandKey(_ event: NSEvent) -> Bool {
        guard event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command,
              let key = event.charactersIgnoringModifiers?.lowercased() else { return false }

        // ⌘N: a hidden alias for Window → "Show Pika" (⌘0). SwiftUI can't hide a menu

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
    /// Called when the label actually appears or goes. That trails the hover by `labelDelay`,
    /// or comes straight away while another label is out (see `LabelWarmth`).
    var onExpandChange: ((Bool) -> Void)?

    /// How long the pointer rests on a button before its label slides out, the first time.
    /// Long enough that crossing the buttons, or clicking one, doesn't make them expand; the
    /// label is there for someone who stops to wonder what the icon does, like a tooltip. Once
    /// one label has shown, the others show without waiting (see `LabelWarmth`).
    static let labelDelay: Duration = .seconds(1)

    /// How long a label takes to slide back in, matching the `showText` animation below.
    static let labelCollapse: Duration = .milliseconds(300)

    /// The labels that are out, or still sliding back in. While any is, hovering another
    /// button (or the same one again) shows its label with no delay; once every label is back
    /// to its plain icon, the next hover waits the full `labelDelay`. Shared by every button
    /// using this style, so it carries across Copy, the system picker and Swap.
    @MainActor private enum LabelWarmth {
        private static var open: Set<UUID> = []

        static var delay: Duration { open.isEmpty ? labelDelay : .zero }

        static func opened(_ id: UUID) { open.insert(id) }
        static func closed(_ id: UUID) { open.remove(id) }
    }

    private struct SwapButtonStyleView: View {
        @Environment(\.colorScheme) var colorScheme: ColorScheme

        @State private var isHovered: Bool = false
        /// This button's identity in `LabelWarmth`'s set of open labels.
        @State private var warmthID = UUID()
        @State private var hoverTask: Task<Void, Never>?
        /// Waits out the label's slide back in before telling `LabelWarmth` it has closed.
        @State private var collapseTask: Task<Void, Never>?

        let configuration: Configuration
        let isVisible: Bool
        let alt: String
        let ltr: Bool
        let expanded: Bool
        let onHoverChange: ((Bool) -> Void)?
        let onExpandChange: ((Bool) -> Void)?

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
                    // Back on while the label is still sliding in: it counts as open, so this
                    // reopens it straight away rather than leaving it shut until you leave and
                    // come back.
                    collapseTask?.cancel()
                    collapseTask = nil
                    guard hoverTask == nil, !isHovered else { return }
                    hoverTask = Task {
                        try? await Task.sleep(for: LabelWarmth.delay)
                        guard !Task.isCancelled else { return }
                        isHovered = true
                        hoverTask = nil
                    }
                } else {
                    hoverTask?.cancel()
                    hoverTask = nil
                    // Left again after reopening mid-collapse, before the label came back out:
                    // its collapse was cancelled, so nothing else would take it out of `open`.
                    guard isHovered else {
                        LabelWarmth.closed(warmthID)
                        return
                    }
                    isHovered = false
                    collapseTask = Task {
                        try? await Task.sleep(for: SwapButtonStyle.labelCollapse)
                        guard !Task.isCancelled else { return }
                        LabelWarmth.closed(warmthID)
                        collapseTask = nil
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
                    collapseTask?.cancel()
                    collapseTask = nil
                    isHovered = false
                    LabelWarmth.closed(warmthID)
                }
            }
            .onChange(of: isHovered) { _, shown in
                if shown { LabelWarmth.opened(warmthID) }
                onExpandChange?(shown)
            }
            .onDisappear {
                collapseTask?.cancel()
                LabelWarmth.closed(warmthID)
            }
            // A click answers the question the label was going to: don't expand after it.
            .onChange(of: configuration.isPressed) { _, pressed in
                if pressed {
                    hoverTask?.cancel()
                    hoverTask = nil
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
            onHoverChange: onHoverChange,
            onExpandChange: onExpandChange
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
    // Global, user-rebindable "pick a pair" shortcut (foreground → background chain).
    // Defaults to ⌥⌘D, matching the in-window menu equivalent it replaces.
    static let pickPair = Self("pickPair", initial: .init(.d, modifiers: [.command, .option]))
}

enum PikaConstants {
    // Release URL
    static func url() -> String {
        Defaults[.betaUpdates]
            ? "https://superhighfives.com/releases/pika/betas"
            : "https://superhighfives.com/releases/pika"
    }

    // Bump when a release has onboarding worth re-showing: the splash then appears once for
    // everyone (even those who ticked "Don't show again") whose `lastSeenSplashVersion` is lower.
    // v1: the custom (Pro) colour picker.
    static let currentSplashVersion = 1

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
    static let ncTriggerPickPair = "triggerPickPair"
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
    static let ncColorNamesUpdated = "colorNamesUpdated"

    // Disabled formats for SwiftUI copy format
    static let disabledFormats: [ColorFormat] = [.hex, .hsl, .opengl, .lab, .oklch]
}

extension Notification.Name {
    static let triggerPickForeground = Notification.Name(PikaConstants.ncTriggerPickForeground)
    static let triggerPickBackground = Notification.Name(PikaConstants.ncTriggerPickBackground)
    /// Help-grid-only: fired alongside the chained `.triggerPickForeground` post so
    /// "Pick pair"'s own row highlights instead of piggybacking on "Pick foreground"'s.
    static let triggerPickPair = Notification.Name(PikaConstants.ncTriggerPickPair)
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
    static let colorNamesUpdated = Notification.Name(PikaConstants.ncColorNamesUpdated)
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

enum PickerStyle: String, Codable, CaseIterable, Equatable {
    case system // NSColorSampler (default, today's behaviour)
    case custom // Pika-native loupe
}

enum LoupeTheme: String, Codable, CaseIterable, Equatable {
    case lens // colour-filled rim engraved with the format + colour name (SF Pro)
    case badge // white rounded badges hugging the inside edge (monospaced)
    case card // plain magnifier with a readout card beside it

    var localizedName: String {
        switch self {
        case .lens: return PikaText.textLoupeThemeLens
        case .badge: return PikaText.textLoupeThemeBadge
        case .card: return PikaText.textLoupeThemeCard
        }
    }
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
    // The colour-name list to use, keyed to color.pizza's `/v1/lists/`. `default` is the
    // list bundled at build time as the offline fallback.
    static let colorNameList = Key<String>("colorNameList", default: "default")
    // When false, the splash is shown on launch. The splash's pre-selected "Don't show
    // this again" checkbox sets this to true on dismissal.
    static let hideSplashOnLaunch = Key<Bool>("hideSplashOnLaunch", default: false)
    // The `PikaConstants.currentSplashVersion` last shown to the user. Bumping that constant
    // re-shows the splash once for everyone (even those who ticked "Don't show again"), so a
    // release with new onboarding gets in front of existing users.
    static let lastSeenSplashVersion = Key<Int>("lastSeenSplashVersion", default: 0)
    static let hidePikaWhilePicking = Key<Bool>("hidePikaWhilePicking", default: false)
    static let windowShadow = Key<WindowShadow>("windowShadow", default: .always)
    static let pickContrastingColor = Key<Bool>("pickContrastingColor", default: false)
    static let pickerStyle = Key<PickerStyle>("pickerStyle", default: .system)
    static let loupeTheme = Key<LoupeTheme>("loupeTheme", default: .lens)
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
    /// True when this shortcut is also registered as a global `KeyboardShortcuts`
    /// hotkey (see `AppDelegate.registerTogglePikaShortcut`). Such shortcuts fire
    /// regardless of focus, so the popover local monitor must NOT dispatch them
    /// again — otherwise the action double-fires. Still shown in the Help grid.
    let hasGlobalBinding: Bool

    init(
        title: String,
        displayKeys: [String],
        character: String,
        modifiers: NSEvent.ModifierFlags,
        action: Selector,
        notificationName: Notification.Name,
        hasGlobalBinding: Bool = false
    ) {
        self.title = title
        self.displayKeys = displayKeys
        self.character = character
        self.modifiers = modifiers
        self.action = action
        self.notificationName = notificationName
        self.hasGlobalBinding = hasGlobalBinding
    }
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
            title: PikaText.textPickPair,
            displayKeys: ["⌥", "⌘", "D"], character: "d", modifiers: [.command, .option],
            action: #selector(AppDelegate.triggerPickContrast),
            notificationName: .triggerPickPair,
            // Already bound globally as `KeyboardShortcuts.Name.pickPair`, which
            // fires regardless of focus — skip local-monitor dispatch to avoid a
            // double pick (mirrors the menu-accelerator omission in PikaApp.swift).
            hasGlobalBinding: true
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

    /// Returns the shortcut matching the given key event, if any. Shortcuts that
    /// are also globally bound are excluded — the global hotkey already dispatches
    /// them regardless of focus, so matching here would double-fire the action.
    static func match(_ event: NSEvent) -> PikaShortcut? {
        let chars = event.charactersIgnoringModifiers?.lowercased() ?? ""
        let mods = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        return all.first { $0.character == chars && $0.modifiers == mods && !$0.hasGlobalBinding }
    }
}

```

### Core Architecture Module: `Pika/Constants/PikaText.swift`
```
import Foundation

// swiftlint:disable:next type_body_length
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
    static let textColorEditInvalid = NSLocalizedString("color.edit.invalid", comment: "Invalid input")
    static let textColorOutsideGamut = NSLocalizedString(
        "color.gamut.outside", comment: "Outside the display's color range"
    )
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
    static let textMenuShowSplash = NSLocalizedString(
        "menu.showSplash", value: "Show splash", comment: "Show the welcome splash"
    )
    static let textMenuShowPika = NSLocalizedString("menu.showPika", comment: "Show Pika")
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

    // Splash setup list (two-column redesign)
    static let textSplashSetupTitle = NSLocalizedString(
        "splash.setup.title", value: "Welcome to Pika", comment: "Splash setup heading"
    )
    static let textSplashSetupSubtitle = NSLocalizedString(
        "splash.setup.subtitle", value: "A few quick choices to get you started.",
        comment: "Splash setup subheading"
    )
    static let textSplashShortcutSubtitle = NSLocalizedString(
        "splash.shortcut.subtitle", value: "Show and hide Pika from anywhere",
        comment: "Global shortcut row subtitle"
    )
    static let textSplashPairSubtitle = NSLocalizedString(
        "splash.pair.subtitle", value: "Grab a foreground, then a background",
        comment: "Pick-pair shortcut row subtitle"
    )
    static let textSplashLaunchSubtitle = NSLocalizedString(
        "splash.launch.subtitle", value: "Open Pika when you log in",
        comment: "Launch at login row subtitle"
    )
    static let textSplashPickerRecommended = NSLocalizedString(
        "splash.picker.recommended", value: "Recommended", comment: "Custom picker recommended badge"
    )
    static let textPickerRequiresScreenRecording = NSLocalizedString(
        "picker.requiresScreenRecording", value: "Requires Screen Recording",
        comment: "Pro picker capability note: needs the Screen Recording permission"
    )
    static let textPickerGrantAccessibilityButton = NSLocalizedString(
        "picker.grantAccessibility", value: "Grant Accessibility",
        comment: "Button to grant the optional Accessibility permission for the Pro picker"
    )
    static let textLoupeTheme = NSLocalizedString(
        "loupe.theme", value: "Loupe style", comment: "Label for the Pro picker loupe theme setting"
    )
    static let textLoupeThemeLens = NSLocalizedString(
        "loupe.theme.lens", value: "Lens", comment: "Loupe theme: coloured rim with engraved text"
    )
    static let textLoupeThemeBadge = NSLocalizedString(
        "loupe.theme.badge", value: "Badge", comment: "Loupe theme: white badges on the inside edge"
    )
    static let textLoupeThemeCard = NSLocalizedString(
        "loupe.theme.card", value: "Card", comment: "Loupe theme: plain magnifier with a readout card beside it"
    )
    static let textPickerPermissionsIntro = NSLocalizedString(
        "picker.permissions.intro", value: "To enable the Pro picker, you’ll need to grant the following permissions:",
        comment: "Intro line above the Pro picker permission buttons"
    )
    static let textPickerPermScreenRecording = NSLocalizedString(
        "picker.perm.screenRecording", value: "Screen Recording",
        comment: "Permission pill label: Screen Recording"
    )
    static let textPickerPermAccessibility = NSLocalizedString(
        "picker.perm.accessibility", value: "Accessibility",
        comment: "Permission pill label: Accessibility"
    )
    static let textPickerAccessibilityNote = NSLocalizedString(
        "picker.accessibilityNote",
        value: "Optional — lets Escape and arrow-key nudging work while picking over other apps.",
        comment: "Explains what the optional Accessibility permission adds to the Pro picker"
    )
    static let textSplashPickerPermission = NSLocalizedString(
        "splash.picker.permission", value: "Needs Screen Recording permission",
        comment: "Custom picker permission note"
    )
    static let textSplashPickerFallback = NSLocalizedString(
        "splash.picker.fallback", value: "Not now? You’ll use the Basic picker.",
        comment: "Pro picker declined fallback note"
    )
    static let textSplashFooter = NSLocalizedString(
        "splash.footer", value: "You can change all of this in Settings.",
        comment: "Splash footer note"
    )
    static let textSplashDontShowAgain = NSLocalizedString(
        "splash.dontShowAgain", value: "Don’t show this again",
        comment: "Splash: pre-selected checkbox to stop showing the splash on launch"
    )
    static let textSplashConfirmTitle = NSLocalizedString(
        "splash.confirm.title", value: "Use Pika’s Pro picker?",
        comment: "Get started confirmation title when the Basic picker is selected"
    )
    static let textSplashConfirmBody = NSLocalizedString(
        "splash.confirm.body",
        value: "The Pro picker shows the colour, its format, and live contrast right in the "
            + "loupe as you pick — a much nicer experience than the macOS sampler. "
  
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
        // APCA is defined over sRGB, like WCAG `luminance`. Reading the selected colour space
        // scored Display P3 components as if they were sRGB, so the two standards could
        // disagree on the same pair.
        let fgRGB = toRGBAComponents(in: .sRGB)
        let bgRGB = color.toRGBAComponents(in: .sRGB)

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #311** (2026-10-19): **Occasionally, Screen Becomes Un-Clickable when Picking a Color / Copying to Clipboard**
  *Symptoms*: **Describe the bug** Sometimes, picking a color and then clicking to copy to clipboard results in pointer disappearing and screen is totally non-clickable. Have to restart the computer.  **To Reproduce** Steps to reproduce the behavior: 1. Go to Pika window 2. Click on foreground / background picker 3. Pick a color from anywhere on screen 4. Sometimes pointer disappears, cannot click anywhere, cannot use pointer.  **Expected behavior** Should be able to continue clicking / interacting with computer.  **Screenshots** N/A  **Environment (please complete the following information):**  - macOS Golden Gate 27.0.1  - 1.9.0 (Build 97) - Downloaded from the internet  - Apple Silicon  **Additional context** Add any other context about the problem here. 

- **Issue #302** (2026-10-14): **Pika 2.0 and Secondary Displays**
  *Symptoms*: Pika 2.0 not playing well with secondary displays. At least not in my instance. I have my Macbook closed, with two displays connected. I can use Pika to colour-pick on my **primary** display without issues; works great. But as soon as I try to pick a colour from my secondary display, it fails to pick the colour and locks up. The colour-picker remains visible and follows the mouse, but no longer functions on that display (my mouse can click and operate the apps on that display as if the colour-picker wasn't present. If I then move my mouse to my primary display and click, it correctly picks the colour.   - OS: MacOS 27.0.1  - App Version: 2.0  - Architecture: Macbook M3 Pro, Apple Silicon 
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging, @neatlee! That is... bad. I'm trying to recreate it on my two-screen set up and haven't been able to, so it'd be great to get a screenshot of your settings just to make sure I'm covering the same bases.  It'd be good to add tests for this, too, as a note to self. Keen to get this fixed!
  > I thiiiiiiink I've found it. Could you check two things in System Settings? Under **Privacy & Security → Accessibility**, is Pika switched on? And under **Desktop & Dock → Mission Control**, is "Displays have separate Spaces" on? My guess is Accessibility is off and separate Spaces is on. There's a possible fix in #303.

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

### Incident Patch 1: `d28d2ecc` (2026-10-20)
**Commit Message**: Refresh ColorNames.json at release time, not weekly (#316)

* Refresh ColorNames.json at release time, not weekly

Since 2.0.0 Pika downloads colour lists from color.pizza while it
runs, so the weekly workflow that opened PRs to refresh the bundled
offline list isn't needed. The bundled list is now refreshed by
/pre-release in pika-workspace before each release.

Also corrects the LoadColors.swift comments, which said the list was
downloaded during the build.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Add scripts/update-color-names

Refreshes the bundled offline list from color-name-list's best-of
list, so it can be run by hand before a release instead of relying
on the weekly workflow.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* update-color-names: check every entry has a name and a valid hex

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* update-color-names: fail if the download fails

Plain sh has no pipefail, so a failed curl piped into jq left an empty
temp file, the count checks errored (which if treats as false), and the
bundled list was overwritten with nothing. Download to a file first,
then transform it, and fail on any non-numeric count.

Co

**File**: `.github/workflows/update-color-names.yml` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-name: Update Color Names
-
-on:
-  schedule:
-    - cron: "0 12 * * 1"
-  workflow_dispatch:
-
-permissions:
-  contents: write
-  pull-requests: write
-
-jobs:
-  update:
-    name: Fetch latest color names
-    runs-on: ubuntu-latest
-
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v7
-
-      - name: Fetch and transform upstream list
-        run: |
-          set -euo pipefail
-          curl --fail --retry 3 --retry-delay 5 --retry-all-errors --max-time 60 -sSL \
-            https://unpkg.com/color-name-list/dist/colornames.bestof.json \
-            -o upstream.json
-          jq -c '{colors: [.[] | {name, hex}]}' upstream.json > Pika/Assets/ColorNames.json
-          rm upstream.json
-
-      - name: Open pull request if changed
-        uses: peter-evans/create-pull-request@v8
-        with:
-          branch: chore/update-color-names
-          commit-message: "chore: update ColorNames.json from color-name-list"
-          title: "chore: update ColorNames.json"
-          body: |
-            Automated refresh of `Pika/Assets/ColorNames.json` from
-            [color-name-list](https://unpkg.com/color-name-list/dist/colornames.bestof.json).
-          labels: dependencies
-          add-paths: Pika/Assets/ColorNames.json
```

**File**: `Pika/Services/LoadColors.swift` (modified, +8/-6)
```diff
@@ -20,12 +20,14 @@ struct ColorListInfo: Identifiable, Hashable {
     var id: String { key }
 }
 
-/// The key of the list bundled with the app as the offline fallback. It's downloaded as
-/// part of the build so colour names always work without a network connection.
+/// The key of the list selected out of the box, and the one we fall back to when the chosen
+/// list is no longer offered by the API.
 let defaultColorListKey = "default"
 
-/// Loads the colour list bundled at build time — the `default` list, used as the offline
-/// fallback until (and if) a network refresh caches a newer copy.
+/// Loads the colour list bundled with the app (`ColorNames.json`), used as the offline
+/// fallback until (and if) a network refresh caches a newer copy. It's a snapshot of
+/// color-name-list's best-of list; refresh it with `scripts/update-color-names` before
+/// each release.
 func loadColors() -> [ColorName]? {
     if let url = Bundle.main.url(forResource: "ColorNames", withExtension: "json") {
         do {
@@ -42,8 +44,8 @@ func loadColors() -> [ColorName]? {
 
 /// Owns colour-name data sourced from the color.pizza API, with an offline fallback.
 ///
-/// - The `default` list is downloaded during the build and bundled, so names always work
-///   offline.
+/// - A snapshot list is bundled with the app (refreshed before each release), so names
+///   always work offline.
 /// - On launch the currently-selected list is refreshed from the network and cached on disk.
 /// - Settings and the splash let the user pick any list from `/v1/lists/`; if the chosen
 ///   list is no longer offered by the API, we fall back to `default`.
```

**File**: `scripts/update-color-names` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+#!/bin/sh
+# Refreshes Pika/Assets/ColorNames.json, the offline colour-name list bundled with
+# the app, from color-name-list's best-of list. Run before a release, then commit
+# the result. The app downloads the full lists from color.pizza when it's online.
+#
+# Usage: scripts/update-color-names
+
+set -eu
+
+SOURCE="https://unpkg.com/color-name-list/dist/colornames.bestof.json"
+MIN_COLORS=1000
+
+cd "$(dirname "$0")/.."
+DEST="Pika/Assets/ColorNames.json"
+RAW="$(mktemp)"
+TMP="$(mktemp)"
+trap 'rm -f "$RAW" "$TMP"' EXIT
+
+fail() {
+  echo "error: $1; kept the existing list" >&2
+  exit 1
+}
+
+command -v jq >/dev/null || { echo "error: jq is required" >&2; exit 1; }
+
+old=$(jq '.colors | length' "$DEST" 2>/dev/null || echo 0)
+
+# Download and transform as separate steps, so a failed download stops here rather
+# than being hidden by a pipe (plain sh has no pipefail).
+curl --fail --retry 3 --retry-delay 5 --retry-all-errors --max-time 60 -sSL "$SOURCE" -o "$RAW" \
+  || fail "couldn't download $SOURCE"
+jq -c '{colors: [.[] | {name, hex}]}' "$RAW" > "$TMP" || fail "the download isn't the expected JSON"
+
+new=$(jq '.colors | length' "$TMP") || fail "couldn't count the downloaded colours"
+case "$new" in '' | *[!0-9]*) fail "couldn't count the downloaded colours" ;; esac
+[ "$new" -ge "$MIN_COLORS" ] || fail "only $new colours downloaded (expected at least $MIN_COLORS)"
+
+# Every entry needs a non-empty name and a #rrggbb hex, or the app can't use it.
+bad=$(jq '[.colors[] | select((.name | type) != "string" or .name == ""
+  or ((.hex | type) != "string") or (.hex | test("^#[0-9a-fA-F]{6}$") | not))] | length' "$TMP") \
+  || fail "couldn't validate the downloaded colours"
+[ "$bad" = 0 ] || fail "$bad entries are missing a name or have an invalid hex"
+
+if cmp -s "$TMP" "$DEST"; then
+  echo "ColorNames.json is already up to date ($new colours)."
+  exit 0
+fi
+
+cat "$TMP" > "$DEST"
+echo "Updated ColorNames.json: $old → $new colours. Review and commit it."
```

#### Recent Merged Pull Requests:
- **PR #323** (2026-10-22): Settings: show what CSS copy gives in P3, and say so for Match display (@superhighfives)
- **PR #322** (2026-10-21): Treat a display profile that's Display P3 in all but name as P3 (@superhighfives)
- **PR #321** (2026-10-21): Clear history keeps the current colours (@superhighfives)
- **PR #320** (2026-10-21): Check a Color: its own colour and a cleaner layout; no colour space dropdown on the readout (@superhighfives)
- **PR #318** (2026-10-20): Point What's new at the changelog's version anchor (@superhighfives)
- **PR #317** (2026-10-21): Colour spaces: sRGB by default, a clearer setting, and Colors don't match? (@superhighfives)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
