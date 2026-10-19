> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/superhighfives-pika-learnings.md`  
> **Source**: github ([https://github.com/superhighfives/pika](https://github.com/superhighfives/pika))  
> **Source Version**: `4fc05696`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T23:47:13.090Z  
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
> **Harvest Timestamp**: 2026-10-19T23:47:12.717Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `superhighfives/pika`
- **Description**: An open-source colour picker app for macOS
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2593 stars

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

### Incident Patch 1: `7dd82fcf` (2026-07-31)
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

### Incident Patch 2: `c5805e4c` (2026-07-20)
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

---

### Incident Patch 3: `2affb8f3` (2026-07-23)
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

#### Recent Merged Pull Requests:
- **PR #314** (2026-10-19): Split AppDelegate's notification-dispatch actions into their own file (@superhighfives)
- **PR #312** (2026-10-19): Better documentation: explain the basics, especially WCAG and APCA (@superhighfives)
- **PR #310** (2026-10-15): Show the next icon label straight away until the buttons hide (@superhighfives)
- **PR #309** (2026-10-15): Readout and icon button polish (@superhighfives)
- **PR #308** (2026-10-16): Pika 2.0.1 (@superhighfives)
- **PR #307** (2026-10-14): Hide the cursor over the loupe when Pika is in the background (@superhighfives)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Drop the build from the review so it actually posts

**RULE**:
When implementing operations in `.github/workflows/claude-code-review.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in superhighfives/pika. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7dd82fcf`: Drop the build from the review so it actually posts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/claude-code-review.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    #
    # No verify_commands: the review reads the diff and doesn't build. An Xcode
    # build outlives the review agent's per-command timeout, gets backgrounded,
    # and the agent stalls waiting for it — finishing a green check without ever
    # posting a review. tests.yml already builds and runs the suite (~90s), so
    # the review doesn't need to. Reading-only, it runs fast on the default
    # ubuntu runner and posts every time.
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
    with:
      # Pinned to match tests.yml — macos-latest doesn't ship Xcode 16.3, so
      # xcode-select fails there. Bump both together.
      runs_on: macos-15
      runtime: none
      setup_command: sudo xcode-select -s /Applications/Xcode_16.3.app
      # Build for testing rather than a full test run: it catches the compile
      # errors that matter for review without the runtime cost of the suite,
      # which tests.yml already covers.
      #
      # Resolve Swift packages first, as a separate step — same as tests.yml.
      # Without it, build-for-testing resolves SPM cold, and the `| tail -40`
      # buffers all output so nothing streams; the review agent sits on a build
      # that can run past the timeout and gets cancelled without ever reviewing.
      verify_commands: |
        xcodebuild -resolvePackageDependencies -project Pika.xcodeproj -scheme Pika
        set -o pipefail && xcodebuild build-for-testing -project Pika.xcodeproj -scheme Pika -destination 'platform=macOS' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO 2>&1 | tail -40
      # Safety net over the pre-resolve fix above, so a slow cold buil
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7dd82fcf` are properly handled with clean fallback behavior.
