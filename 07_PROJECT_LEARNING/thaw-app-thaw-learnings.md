> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/thaw-app-thaw-learnings.md`  
> **Source**: github ([https://github.com/thaw-app/Thaw](https://github.com/thaw-app/Thaw))  
> **Source Version**: `92c959b6`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T01:46:17.296Z  
> **Learning ID**: `learn-github-thaw-app-thaw`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): thaw-app/Thaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/thaw-app-thaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/thaw-app/Thaw](https://github.com/thaw-app/Thaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-08T01:46:16.779Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thaw-app/Thaw`
- **Description**: The open source menu bar manager
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12606 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Thaw/App/AppState+DisplayChanges.swift`
```
//
//  AppState+DisplayChanges.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

extension AppState {
    /// Always-show starts holding here, with the coordinator, so every hold it takes ends with a coordinator run.
    func startDisplayChangeCoordinator() {
        menuBarManager.alwaysShowHiddenItemsController?.holdDuringDisplayChanges(
            invalidations: displayEnvironment.invalidations,
            settlements: displayEnvironment.settlements
        )
        displayChangeCoordinator.start()
    }
}

```

### Core Architecture Module: `Thaw/App/AppState.swift`
```
//
//  AppState.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import AppKit
import AsyncAlgorithms
import Combine
import MenuBarModel
import Observation
import PlatformRuntimeKit
import SwiftUI
import ThawCapture
import ThawUI

/// AppDelegate creates the single environment object owning long-lived subsystems; allocation is safe before permissions are granted.
/// Subsystems start at most once through bootstrapTask, whose setup order follows dependencies.
@MainActor
@Observable
final class AppState {
    // MARK: - Owned subsystems

    // Core models. Independent of the menu bar stack and of one another.

    /// The user's preferences, backed by UserDefaults. Almost everything
    /// downstream reads it, which is why it is brought up first.
    let settings = AppSettings()

    /// Polls permissions from creation until bootstrap; post-launch revocation takes effect on the next run.
    let permissions = AppPermissions()

    /// Observers publish cross-window navigation and visibility here for the settings UI.
    let navigationState = AppNavigationState()

    /// Named snapshots of the user's settings on disk. Touches only files, so
    /// it neither needs nor supplies anything the menu bar stack depends on.
    let profileManager = ProfileManager()

    /// Whether profiles are on. Held here so the menus and the Profiles pane observe one switch.
    let profilesFeature = ProfilesFeature()

    // Menu bar stack. Set up in dependency order; see bootstrapTask.

    /// The sections, their control items, and the show/hide state machine.
    let menuBarManager = MenuBarManager()

    /// Shared by the menu bar manager, which acts on a display move, and the
    /// event taps, which ask for a check.
    private let activeDisplayWatcher = ActiveMenuBarDisplayWatcher()

    /// Settles screen-parameter changes into one numbered snapshot.
    let displayEnvironment = DisplayEnvironment()

    /// Runs the settle a display change owes, and the image cleanup after a removal, once per settled generation.
    @ObservationIgnored lazy var displayChangeCoordinator = DisplayChangeCoordinator(
        environment: displayEnvironment,
        effects: MenuBarDisplayChangeEffects(itemManager: itemManager, repairs: itemManager.repairs, imageCache: imageCache, displaySettings: settings.displaySettings, profiles: profileManager, presentationMonitor: presentationMonitor, menuBarManager: menuBarManager)
    )

    /// Paints tint, border, shadow and shape over the system menu bar.
    let appearanceManager = MenuBarAppearanceManager()

    /// Changes system spacing and relaunches affected apps only on user slider input, never during bootstrap.
    let spacingManager = MenuBarItemSpacingManager()

    /// The item inventory, what sits in the menu bar, where, and the moves
    /// that put it there. Everything below queries it.
    let itemManager = MenuBarItemManager()

    /// Rendered pictures of the items, shared by the layout editor and the
    /// Thaw bar. Fed from itemManager, so it is set up after it.
    let imageCache = MenuBarItemImageCache()

    /// Reveals concealed items temporarily when their icon changes.
    let alertRevealWatcher = MenuBarItemAlertRevealWatcher()
    let presentationMonitor = PresentationMonitor()

    /// Owner of the user's menu bar spacer items.
    let spacerManager = MenuBarSpacerManager()
    let screenCorners = ScreenCorners()
    let itemHints = ItemHints()
    let groupFolders = GroupFolders()

    /// Owner of user-authored menu bar item groups.
    let itemGroupManager = MenuBarItemGroupManager()

    /// Saves layout changes into the active profile when it keeps them.
    @ObservationIgnored private(set) lazy var profileLayoutKeeper = ProfileLayoutKeeper(
        profileManager: profileManager,
        itemManager: itemManager,
        groupManager: itemGroupManager
    )

    /// Transient, user-facing explanations for refused layout actions.
    let layoutFeedback = LayoutBarFeedbackCenter()

    // System services.

    /// Keyboard and pointer taps: hotkeys, plus the drag tracking mirrored
    /// into isDraggingMenuBarItem.
    let hidEventManager = HIDEventManager()

    /// Sparkle wrapper. Stays idle until the user consents, so setting it up
    /// does not by itself reach the network.
    let updatesManager = UpdatesManager()

    /// Delivers the app's user notifications and owns their categories and
    /// actions.
    let userNotificationManager = UserNotificationManager()

    /// Receives Control Center commands through Darwin notifications; see ControlCommandObserver for why commands avoid App Groups.
    let controlCommandObserver = ControlCommandObserver()

    /// Publishes Control Center state through the shared App Group; commands return through Darwin notifications.
    let controlStatePublisher = ControlStatePublisher()

    /// The floating Swap bar: swap the shown and hidden groups, switch
    /// profiles, and reach the section and zen toggles without the menu.
    let swapBarManager = SwapBarManager()

    /// The panel Thaw's own icon raises in place of its status menu. Nothing
    /// is constructed until the first press with it on.
    let controlItemPanel = ControlItemPanelController()

    /// Reads the camera and microphone for Zen Mode, using only public CoreAudio and CoreMediaIO state.
    let recordingWatchManager = RecordingWatchManager()

    /// Launches the modules shipped with Thaw or installed beside it.
    let moduleHost = ModuleHost(environment: .live())

    let applicationMenuCover = ApplicationMenuCover()

    /// Settings in a process of its own, when SettingsInOwnProcess is set.
    @ObservationIgnored
    private(set) lazy var settingsProcessHost = SettingsProcessHost(app: settingsProcessAppSide())

    /// Diagnostic logger for the app state.
    let diagLog = DiagLog(category: "AppState")

    // MARK: - Published state

    /// observeActiveSpace() compensates for under-reported system space changes.
    private(set) var activeSpace = SpaceInfo.activeSpace()

    /// Mirror of the event layer's drag flag, so views can watch a drag
    /// without subscribing to HIDEventManager themselves.
    private(set) var isDraggingMenuBarItem = false

    /// Consent sheet is only for users who completed onboarding without answering the update question.
    var isUpdateConsentPresented = false

    /// Consumed by the permissions window to replay the tour once, regardless of stored flags.
    var replayRequested = false

    /// The version an available update installs, while its notes are open in
    /// What's New. Sparkle's own release notes are off, so this is where the
    /// update's notes are read before installing.
    var pendingUpdateVersion: String?

    // MARK: - Window bookkeeping

    /// Track open windows to prevent duplicates
    private var openWindows = Set<ThawWindowIdentifier>()

    /// Whether any Thaw window is open.
    var hasOpenWindow: Bool {
        !openWindows.isEmpty
    }

    /// Live windows keyed by scene identifier.
    /// - Note: onWindowChange supplies these because unreliable NSApp.windows KVO would leave openWindows stuck after closing.
    private var trackedWindows = [ThawWindowIdentifier: NSWindow]()

    /// Per-window visibility observers, keyed by identifier.
    private var windowVisibilityCancellables = [ThawWindowIdentifier: AnyCancellable]()

    /// Fresh EnvironmentValues have inert window actions; scenes register live actions without eagerly creating windows.
    private var openWindowAction: OpenWindowAction?
    private var dismissWindowAction: DismissWindowAction?
    private var pendingOpenWindows = Set<ThawWindowIdentifier>()

    // MARK: - Private state

    /// Holds the subscriptions made by installObservers(). Emptied before
    /// they are remade, so the observers can never end up doubled.
    private var cancellables = Set<AnyCancellable>()

    /// Watches navigationState's observable focus and Settings visibility.
    private var navigationStateObservationTask: Task<Void, Never>?

    /// Prevent repeated restart attempts.
    private var isRestarting = false

    // MARK: - Bootstrap

    /// Callers await the same lazy task so bootstrap runs once.
    /// Keep dependency order: each setup assumes preceding subsystems are live.
    @ObservationIgnored
    private lazy var bootstrapTask = Task { @MainActor [self] in
        #if DEBUG
            // Debug builds always have diagnostic logging on so logs are
            // captured during development without depending on the toggle.
            DiagnosticLogger.shared.isEnabled = true
        #else
            if Defaults.bool(forKey: .enableDiagnosticLogging) {
                DiagnosticLogger.shared.isEnabled = true
            }
        #endif

        diagLog.debug("bootstrap: starting AppState setup sequence")

        // Choose helper capture routing once, before any subsystem captures a frame.
        ScreenCapture.routesThroughCaptureService = Defaults.bool(forKey: .captureViaXPCService)
        permissions.stopAllChecks()
        diagLog.debug("bootstrap: permissions state = \(String(describing: self.permissions.permissionsState)), accessibility = \(self.permissions.accessibility.hasPermission), screenRecording = \(self.permissions.screenRecording.hasPermission)")

        displayEnvironment.start()
        settings.performSetup(with: self)
        menuBarManager.performSetup(with: self, activeDisplayWatcher: activeDisplayWatcher, displays: displayEnvironment)
        // A refused preferences watcher stays stopped; recreate it after either a table-file grant or Full Disk Access.
        permissions.onPermissionTransition = { [weak self] permission, granted in
            guard let self, granted, permission === permissions.fullDiskAccess else { return }
            (menuBarManager.sectionController as? RuntimeSectionController)?.restartPreferencesWatcher
```

### Core Architecture Module: `Thaw/App/ControlStatePublisher.swift`
```
//
//  ControlStatePublisher.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import AppKit
import Combine
import Foundation
import MenuBarModel
import WidgetKit

/// Writing end of the ThawControls state channel.
///
/// An appex is sandboxed and Thaw is not, so the controls learn whether the
/// hidden section is revealed or Zen Mode is on through the shared
/// A7CKWF99ML.com.stonerl.Thaw application group: a small JSON snapshot of the
/// two Bools in the group's UserDefaults suite.
///
/// The channel is one-way. State flows app to appex through the suite, while
/// commands flow appex to app as Darwin notifications, because a defaults write
/// does not wake a running process and a Darwin notification does.
///
/// A stale snapshot can survive a crash, but the first tap sends the toggle
/// verb and the relaunched app republishes the real value. Set up once from
/// AppState; the publisher's lifetime is the app's.
@MainActor
final class ControlStatePublisher {
    // Suite, key and field names are duplicated in ControlCommandNames.swift and control kinds in
    // ThawControlWidgets.swift (targets/ThawControls). A mismatch fails silently: the reader sees false.

    /// The application group both targets are entitled to.
    ///
    /// Team-prefixed rather than group.-prefixed: on macOS that form gets a
    /// group container without the Sequoia-era consent prompt.
    static nonisolated let suiteName = "A7CKWF99ML.com.stonerl.Thaw"

    /// The single defaults key the whole channel lives under.
    ///
    /// One JSON blob rather than a key per Bool: UserDefaults gives no
    /// transaction across keys, so a reader could otherwise catch a
    /// combination that cannot exist.
    static nonisolated let stateKey = "com.stonerl.Thaw.control-state"

    /// The ControlWidget kinds to reload when the snapshot changes.
    ///
    /// Mirrors RevealHiddenItemsControl.kind and ToggleZenModeControl.kind.
    static nonisolated let controlKinds = [
        "com.stonerl.Thaw.controls.reveal-hidden",
        "com.stonerl.Thaw.controls.toggle-zen",
    ]

    /// What the controls are told, and nothing more.
    ///
    /// Both fields are phrased as the positive the toggle draws, not as the
    /// app's internal spelling. MenuBarSection.isHidden is the app's truth;
    /// a toggle labelled "Reveal Hidden Items" is on when the section is
    /// not hidden, and putting the inversion here rather than in the appex
    /// keeps the extension from having to know a single thing about how Thaw
    /// models sections.
    ///
    /// Codable with explicit short keys so the on-disk shape is stable
    /// against a property rename on either side.
    nonisolated struct Snapshot: Codable, Equatable, Sendable {
        /// Whether the hidden section is currently revealed.
        var isHiddenSectionRevealed: Bool
        /// Whether Zen Mode is engaged.
        var isZenModeActive: Bool

        enum CodingKeys: String, CodingKey {
            case isHiddenSectionRevealed = "hiddenRevealed"
            case isZenModeActive = "zenActive"
        }
    }

    private let diagLog = DiagLog(category: "ControlStatePublisher")

    /// The group suite, or nil when the entitlement is missing.
    ///
    /// UserDefaults(suiteName:) returns nil for a group this process is
    /// not entitled to, which is precisely the case worth surviving: an
    /// unsigned or wrongly-signed build should degrade to "controls show
    /// nothing" rather than trap.
    private let defaults: UserDefaults?

    /// Asks Control Center to redraw one control kind. Tests record the requests instead.
    private let reloadControl: (String) -> Void

    /// Where the app's quit is posted. Tests post to a private center.
    private let terminationCenter: NotificationCenter

    /// The last snapshot actually written, so an unchanged recomputation costs
    /// nothing. ControlCenter.reloadControls is a cross-process nudge to
    /// controlcenter; the observation sources below fire far more often than
    /// the two Bools change.
    private var lastPublished: Snapshot?

    private var observationTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()
    private var isObserving = false

    init(
        defaults: UserDefaults? = UserDefaults(suiteName: ControlStatePublisher.suiteName),
        reloadControl: @escaping (String) -> Void = { ControlCenter.shared.reloadControls(ofKind: $0) },
        terminationCenter: NotificationCenter = .default
    ) {
        self.defaults = defaults
        self.reloadControl = reloadControl
        self.terminationCenter = terminationCenter
    }

    func performSetup(with appState: AppState) {
        guard !isObserving else { return }
        isObserving = true

        guard defaults != nil else {
            // Not fatal, and not silent: this is the one failure mode that
            // looks exactly like "the controls are broken" from the outside.
            diagLog.error("no defaults for app group \(Self.suiteName); controls will render as off")
            return
        }

        // Zen Mode and the Thaw Bar presentation live on @Observable types, so
        // they are watched with an Observations sequence.
        //
        // The closure recomputes the whole snapshot rather than one field, so
        // both Bools are sampled at the same instant. Only properties read
        // through an observable arm the sequence: section.isHidden also
        // consults the section controller and is handled by the sink below.
        observationTask?.cancel()
        observationTask = Task { @MainActor [weak self, weak appState] in
            let changes = Observations { Self.snapshot(for: appState) }
            for await snapshot in changes {
                guard let self else { return }
                publish(snapshot)
            }
        }

        // The reveal state itself. MenuBarSection.isHidden reads through
        // sectionController, whose revealedSection is a Combine
        // @Published on a platform type rather than an @Observable
        // property, so it cannot arm the sequence above and needs its own
        // subscription. The value it carries is ignored on purpose: the
        // snapshot is always recomputed from the section, which knows about
        // cases the raw revealed-section value does not.
        appState.menuBarManager.revealedSectionChanges
            .receive(on: DispatchQueue.main)
            .sink { [weak self, weak appState] _ in
                guard let self else { return }
                publish(Self.snapshot(for: appState))
            }
            .store(in: &cancellables)

        // A clean quit erases the snapshot: see the note on freshness above.
        terminationCenter
            .publisher(for: NSApplication.willTerminateNotification)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                handleTermination()
            }
            .store(in: &cancellables)

        publish(Self.snapshot(for: appState))
        diagLog.debug("publishing control state to app group \(Self.suiteName)")
    }

    /// Reads both Bools straight off the live model.
    ///
    /// Nothing is cached and nothing is derived from a previous snapshot,
    /// the point of the whole object is that what the controls draw is what
    /// the menu bar is doing, so every publish re-asks the model.
    ///
    /// A missing AppState (setup has not run, or teardown has) is reported
    /// as everything-off, which is the same fallback the appex uses when it
    /// finds no snapshot at all.
    static func snapshot(for appState: AppState?) -> Snapshot {
        guard let appState else {
            return Snapshot(isHiddenSectionRevealed: false, isZenModeActive: false)
        }
        let manager = appState.menuBarManager
        let hiddenSection = manager.section(withName: .hidden)
        return Snapshot(
            // isHidden is the app's own answer, Thaw Bar presentation and
            // all, see MenuBarSection.isHidden. Inverted here so the
            // appex never has to reason about it.
            isHiddenSectionRevealed: hiddenSection.map { !$0.isHidden } ?? false,
            isZenModeActive: manager.isZenModeActive
        )
    }

    /// Writes the snapshot and nudges Control Center, if anything changed.
    private func publish(_ snapshot: Snapshot) {
        guard snapshot != lastPublished else { return }
        guard let defaults else { return }

        do {
            let data = try JSONEncoder().encode(snapshot)
            defaults.set(data, forKey: Self.stateKey)
            lastPublished = snapshot
        } catch {
            // Encoding two Bools cannot realistically fail, but a half-written
            // key would be worse than a stale one: leave whatever is there.
            diagLog.error("failed to encode control state: \(error)")
            return
        }

        reloadControls()
    }

    /// Erases the snapshot on a clean quit.
    ///
    /// A control that says "Zen Mode is on" while Thaw is not running is a
    /// lie, and the tap that would correct it launches nothing, the Darwin
    /// notification it posts has no listener. Removing the key makes the
    /// controls fall back to off, which is both true and what the next launch
    /// will find.
    func handleTermination() {
        defaults?.removeObject(forKey: Self.stateKey)
        lastPublished = nil
        reloadControls()
    }

    /// Asks Control Center to re-render both controls.
    ///
    /// Without this the extension keeps whatever it last drew: the group
    /// suite is a file the appex reads when asked to render, not something it
    /// is notified about. The call is advisory, the system decides when the
    /// controls actually redraw, so nothing here depends on it having
    
```

### Core Architecture Module: `Thaw/App/Navigation/AppNavigationState.swift`
```
//
//  AppNavigationState.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Foundation
import Observation
import ThawCapture

/// The model for app-wide navigation.
@MainActor
@Observable
final class AppNavigationState {
    nonisolated enum SettingsDisclosure: Hashable {
        case layoutSpacers
        /// Layout's Options tab, which holds the settings you rarely change.
        case layoutOptions
        case layoutAppleItems
        /// Appearance's fill tabs, inside and behind the shape.
        case appearanceInsideShape
        case appearanceBehindShape
    }

    var isAppFrontmost = false
    var isSettingsPresented = false {
        didSet {
            if isSettingsPresented || oldValue {
                settingsPresentationID = nil
            }
            updateCaptureUIState()
        }
    }

    var isThawBarPresented = false {
        didSet { updateCaptureUIState() }
    }

    var isSearchPresented = false {
        didSet { updateCaptureUIState() }
    }

    var isLayoutEditorPresented = false {
        didSet { updateCaptureUIState() }
    }

    /// Simple Mode has no sidebar, so its capture state cannot use the full window's last pane.
    /// Seed from preferences for presentations that begin before view synchronization.
    var isSimpleModeSettings = Defaults.bool(forKey: .simpleMode) {
        didSet { updateCaptureUIState() }
    }

    /// Keep capture off for panes such as General and About so they do not light the recording indicator.
    /// This includes Appearance's background sampler; item-glyph demand uses
    /// MenuBarItemImageCache.NavigationStateSnapshot.liveCaptureScope instead.
    private var settingsConsumesCapture: Bool {
        // Simple Mode opens on the folded bar, which draws real glyphs.
        if isSimpleModeSettings {
            return true
        }
        return switch settingsNavigationIdentifier {
        case .menuBarLayout, .thawBar, .menuBarAppearance, .hotkeys:
            true
        default:
            false
        }
    }

    var hasVisibleCaptureUI: Bool {
        isThawBarPresented || isSearchPresented || isLayoutEditorPresented
            || (isSettingsPresented && settingsConsumesCapture)
    }

    private var settingsPresentationID: UUID?

    var hasCaptureUI: Bool {
        hasVisibleCaptureUI
            || (settingsPresentationID != nil && settingsConsumesCapture)
    }

    func beginSettingsPresentation() -> UUID? {
        guard !isSettingsPresented, settingsPresentationID == nil else { return nil }
        let id = UUID()
        settingsPresentationID = id
        updateCaptureUIState()
        return id
    }

    func finishSettingsPresentation(_ id: UUID) {
        guard settingsPresentationID == id else { return }
        cancelSettingsPresentation()
    }

    func cancelSettingsPresentation() {
        settingsPresentationID = nil
        updateCaptureUIState()
    }

    private func updateCaptureUIState() {
        ScreenCapture.setCaptureUIActive(hasCaptureUI)
    }

    var requestedSettingsDisclosure: SettingsDisclosure?

    /// The section of the search result being opened, so a page with tabs opens the tab holding it.
    var requestedSettingsSection: String?

    /// AppState selects About after window construction; the pane consumes this upgrade request by presenting the changelog.
    var isWhatsNewRequested = false

    var settingsNavigationIdentifier: SettingsNavigationIdentifier = .general {
        didSet {
            // Observation routes this assignment back through didSet, which then saves it.
            let destination = settingsNavigationIdentifier.destination
            guard destination == settingsNavigationIdentifier else {
                settingsNavigationIdentifier = destination
                return
            }
            // A search sets its section after the page, so only a section left from another page is dropped.
            if settingsNavigationIdentifier != oldValue {
                requestedSettingsSection = nil
            }
            Defaults.set(settingsNavigationIdentifier.rawValue, forKey: .lastSettingsPane)
            // Which pane is showing decides whether capture is on, so moving
            // from General to Layout has to re-evaluate without a window toggle.
            updateCaptureUIState()
        }
    }

    init() {
        updateCaptureUIState()
        // Restore the full window's last pane for returning from Simple Mode; init assignment does not persist via didSet.
        // Ignore panes no longer in the sidebar so selection and detail stay connected.
        if let rawValue = Defaults.string(forKey: .lastSettingsPane),
           let pane = SettingsNavigationIdentifier(rawValue: rawValue)?.destination,
           SettingsSidebarPanes.all.contains(pane)
        {
            settingsNavigationIdentifier = pane
        }
        // Panes hidden by the old customizable sidebar show again.
        Defaults.removeObject(forKey: .hiddenSidebarPanes)
    }
}

```

### Core Architecture Module: `Thaw/Input/Events/HIDEventManager+Lifecycle.swift`
```
//
//  HIDEventManager+Lifecycle.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3
//

import AppKit
import AsyncAlgorithms
import Combine
import Foundation

extension HIDEventManager {
    /// Subscribes to the settings and system notifications the manager has to
    /// react to, replacing any subscriptions from a previous call.
    func configureCancellables() {
        var c = Set<AnyCancellable>()

        if let appState {
            // Pre-seed so the initial emission does no rearm work when
            // showOnHover is already true.
            lastShowOnHover = configuration.showOnHover

            // Start or stop the mouse-moved tap when hover, tooltip or display
            // settings change. The continues below skip one event; a return
            // would end the observation.
            let generalSettings = appState.settings.general
            let advancedSettings = appState.settings.advanced
            let displaySettings = appState.settings.displaySettings
            hoverSettingsObservationTask?.cancel()
            hoverSettingsObservationTask = Task { @MainActor [weak self] in
                let changes = Observations {
                    (generalSettings.showOnHover, advancedSettings.showMenuBarTooltips, displaySettings.configurations)
                }
                for await (showOnHover, _, _) in changes {
                    guard let self else { return }
                    guard isEnabled else { continue }
                    if needsMouseMovedTap(appState: appState) {
                        mouseMovedTap.start()
                    } else {
                        mouseMovedTap.stop()
                    }

                    defer { lastShowOnHover = showOnHover }

                    if !showOnHover {
                        hoverRearmTask?.cancel()
                        hoverRearmTask = nil
                        hoverRearmTaskToken = nil
                        hoverTask?.cancel()
                        hoverTask = nil
                        hoverTaskToken = nil
                        pendingHoverAction = nil
                        continue
                    }

                    // Rearm only when showOnHover turns on, not when another
                    // input changes while it is already on.
                    guard lastShowOnHover != true else {
                        continue
                    }

                    appState.menuBarManager.showOnHoverAllowed = true
                    hoverRearmTask?.cancel()
                    hoverRearmTask = nil
                    hoverRearmTaskToken = nil
                    hoverTask?.cancel()
                    hoverTask = nil
                    hoverTaskToken = nil
                    pendingHoverAction = nil
                    scheduleHoverRearmChecks(appState: appState)
                }
            }

            // An in-memory bounds lookup saves a Window Server call per event.
            let boundsTask = Task { @MainActor [weak self, itemManager = appState.itemManager] in
                let changes = Observations { itemManager.itemCache }.removeDuplicates()
                for await cache in changes {
                    guard let self else { return }
                    rebuildWindowBoundsLookup(
                        from: cache,
                        including: itemManager.onScreenItemSnapshot.items
                    )
                    rememberVisibleControlItemBounds(in: cache)
                    pointerAXCache.drawnBarDidChange()
                }
            }
            AnyCancellable { boundsTask.cancel() }
                .store(in: &c)

            // Control item state changes shift the layout. Merged and debounced
            // so a batch of section changes triggers one rebuild; each publisher
            // drops its own initial emission.
            Publishers.MergeMany(
                appState.menuBarManager.sections.map {
                    $0.controlItem.$state
                        .dropFirst()
                        .replace(with: ())
                }
            )
            .debounce(for: .milliseconds(200), scheduler: DispatchQueue.main)
            .sink { [weak self] in
                self?.rebuildWindowBoundsLookupFromCurrentLayout()
                self?.pointerAXCache.drawnBarDidChange()
            }
            .store(in: &c)

            // The item cache refreshes shortly after a display change.
            NotificationCenter.default.publisher(
                for: NSApplication.didChangeScreenParametersNotification
            )
            .sink { [weak self] _ in
                NSScreen.invalidateMenuBarGeometryCache()
                NSScreen.cleanupDisconnectedDisplayCaches()
                self?.windowBoundsLock.withLock { $0.removeAll() }
                // Active-display changes can leave itemCache unchanged; do not
                // wait for an item refresh to restore Clock's hit regions.
                self?.refreshClockMenuBarBands()
            }
            .store(in: &c)

            // Entering or leaving a fullscreen Space adds or drops a band.
            NSWorkspace.shared.notificationCenter.publisher(
                for: NSWorkspace.activeSpaceDidChangeNotification
            )
            .sink { [weak self] _ in
                self?.refreshClockMenuBarBands()
            }
            .store(in: &c)
        }

        cancellables = c

        if let appState {
            rebuildWindowBoundsLookup(
                from: appState.itemManager.itemCache,
                including: onScreenItems?.items ?? []
            )
        }

        // macOS can invalidate the tap's Mach port under resource pressure or
        // a permission change. 10 s matches the stuck-disable recovery threshold.
        healthCheckTimer?.invalidate()
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                self.performHealthCheck()
            }
        }
        healthCheckTimer?.tolerance = 2
    }
}

```

### Core Architecture Module: `Thaw/Input/Events/NotificationCenterInputState.swift`
```
//
//  NotificationCenterInputState.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import CoreGraphics

/// Balances only the physical events claimed by the Notification Center bridge.
nonisolated struct NotificationCenterInputState {
    enum KeyDisposition: Equatable {
        case passThrough
        case consume
        case activate
    }

    private var heldKeys = Set<CGKeyCode>()
    private var clockPress: (point: CGPoint, bounds: CGRect, cancelled: Bool)?

    var hasClockPress: Bool {
        clockPress != nil
    }

    var hasHeldKeys: Bool {
        !heldKeys.isEmpty
    }

    mutating func key(
        type: CGEventType,
        code: CGKeyCode,
        isRepeat: Bool,
        matches: Bool,
        shouldBridge: Bool
    ) -> KeyDisposition {
        switch type {
        case .keyUp:
            return heldKeys.remove(code) != nil ? .consume : .passThrough
        case .keyDown:
            if isRepeat {
                return heldKeys.contains(code) ? .consume : .passThrough
            }
            // A fresh press supersedes a release lost when macOS disabled a tap.
            heldKeys.remove(code)
            guard matches, shouldBridge else { return .passThrough }
            heldKeys.insert(code)
            return .activate
        default:
            return .passThrough
        }
    }

    mutating func beginClockPress(at point: CGPoint, bounds: CGRect) {
        clockPress = (point, bounds, false)
    }

    mutating func dragClockPress(to point: CGPoint) {
        guard let press = clockPress else { return }
        if !press.bounds.insetBy(dx: -4, dy: -4).contains(point) {
            clockPress?.cancelled = true
        }
    }

    mutating func endClockPress(at point: CGPoint) -> CGPoint? {
        dragClockPress(to: point)
        defer { clockPress = nil }
        guard let press = clockPress, !press.cancelled else { return nil }
        return press.point
    }

    mutating func discardClockPress() {
        clockPress = nil
    }
}

```

### Core Architecture Module: `Thaw/MenuBar/MenuBarEngineConfiguration.swift`
```
//
//  MenuBarEngineConfiguration.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Foundation
import Observation

/// Every setting the menu bar engine reads, as plain read-only data, so the
/// engine can run without AppState behind it. Writes go through an explicit
/// manager dependency instead.
@MainActor
protocol MenuBarEngineConfiguration: AnyObject, Observable {
    // Sections
    var isAlwaysHiddenSectionEnabled: Bool { get }
    var sectionDividerStyle: SectionDividerStyle { get }
    var customSectionDividerMark: SectionDividerCustomMark? { get }
    var showAllSectionsOnUserDrag: Bool { get }

    // Reveal gestures
    var showOnClick: Bool { get }
    var showOnHover: Bool { get }
    var showOnHoverDelay: TimeInterval { get }
    var showOnScroll: Bool { get }
    var swapOnThawIconClick: Bool { get }

    // Rehiding
    var autoRehide: Bool { get }
    var rehideStrategy: RehideStrategy { get }
    var rehideInterval: TimeInterval { get }
    var tempShowInterval: TimeInterval { get }

    // Presentation
    var showThawIcon: Bool { get }
    var thawIcon: ControlItemImageSet { get }
    var customThawIconIsTemplate: Bool { get }
    var hideApplicationMenus: Bool { get }
    var showMenuBarTooltips: Bool { get }
    var enableSecondaryContextMenu: Bool { get }
    var tooltipDelay: TimeInterval { get }
    var simpleMode: Bool { get }

    // Item handling
    var enableMenuBarItemOverflow: Bool { get }
    var enableExperimentalSystemItemHiding: Bool { get }
    var enableExperimentalOverflowPrevention: Bool { get }
    var iconRefreshInterval: TimeInterval { get }
    var alwaysUseAppIconForMenuBarItems: Bool { get }
    var menuBarOrderFulfillmentTimeout: TimeInterval { get }
}

/// Forwards to the per-pane settings models, so the engine sees one flat surface.
extension AppSettings {
    /// Used before performSetup(with:). Shared, since building one per read
    /// would touch UserDefaults on a hot path.
    @MainActor
    static let engineDefaults = AppSettings()
}

extension AppSettings: MenuBarEngineConfiguration {
    var isAlwaysHiddenSectionEnabled: Bool {
        advanced.isAlwaysHiddenSectionEnabled
    }

    var sectionDividerStyle: SectionDividerStyle {
        advanced.sectionDividerStyle
    }

    var customSectionDividerMark: SectionDividerCustomMark? {
        advanced.customSectionDividerImage.map {
            SectionDividerCustomMark(data: $0, isTemplate: advanced.customSectionDividerIsTemplate)
        }
    }

    var showAllSectionsOnUserDrag: Bool {
        advanced.showAllSectionsOnUserDrag
    }

    var showOnClick: Bool {
        general.showOnClick
    }

    var showOnHover: Bool {
        general.showOnHover
    }

    var showOnHoverDelay: TimeInterval {
        advanced.showOnHoverDelay
    }

    var showOnScroll: Bool {
        general.showOnScroll
    }

    var swapOnThawIconClick: Bool {
        advanced.swapOnThawIconClick
    }

    var autoRehide: Bool {
        general.autoRehide
    }

    var rehideStrategy: RehideStrategy {
        general.rehideStrategy
    }

    var rehideInterval: TimeInterval {
        general.rehideInterval
    }

    var tempShowInterval: TimeInterval {
        general.tempShowInterval
    }

    var showThawIcon: Bool {
        general.showThawIcon
    }

    var thawIcon: ControlItemImageSet {
        general.thawIcon
    }

    var customThawIconIsTemplate: Bool {
        general.customThawIconIsTemplate
    }

    var hideApplicationMenus: Bool {
        advanced.hideApplicationMenus
    }

    var showMenuBarTooltips: Bool {
        advanced.showMenuBarTooltips
    }

    var enableSecondaryContextMenu: Bool {
        advanced.enableSecondaryContextMenu
    }

    var tooltipDelay: TimeInterval {
        advanced.tooltipDelay
    }

    var simpleMode: Bool {
        general.simpleMode
    }

    var enableMenuBarItemOverflow: Bool {
        advanced.enableMenuBarItemOverflow
    }

    var enableExperimentalSystemItemHiding: Bool {
        advanced.enableExperimentalSystemItemHiding
    }

    var enableExperimentalOverflowPrevention: Bool {
        advanced.enableExperimentalOverflowPrevention
    }

    var iconRefreshInterval: TimeInterval {
        advanced.iconRefreshInterval
    }

    var alwaysUseAppIconForMenuBarItems: Bool {
        advanced.alwaysUseAppIconForMenuBarItems
    }

    var menuBarOrderFulfillmentTimeout: TimeInterval {
        advanced.menuBarOrderFulfillmentTimeout
    }
}

```

### Core Architecture Module: `Thaw/Settings/Process/AppState+SettingsProcess.swift`
```
//
//  AppState+SettingsProcess.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import AppKit

extension AppState {
    /// Shows Settings in its own process when that is on and the pane runs there.
    /// False for every other window, and while the app's own Settings window is open.
    func showsInSettingsProcess(_ id: ThawWindowIdentifier, isOpenHere: Bool) -> Bool {
        guard id == .settings, !isOpenHere else { return false }
        return settingsProcessHost.show(
            pane: navigationState.settingsNavigationIdentifier.rawValue,
            simpleMode: settings.general.simpleMode
        )
    }

    /// What the app does when the settings process asks.
    func settingsProcessAppSide() -> SettingsProcessHost.AppSide {
        SettingsProcessHost.AppSide(
            reloadSettings: { [weak self] in
                self?.settings.loadStoredValues()
                self?.updatesManager.storedPreferencesChanged()
            },
            openInApp: { [weak self] pane in self?.openSettingsInApp(pane: pane) },
            pageChanged: { [weak self] pane in
                if let identifier = SettingsNavigationIdentifier(rawValue: pane) {
                    self?.navigationState.settingsNavigationIdentifier = identifier
                }
            },
            checkForUpdates: { [weak self] in self?.updatesManager.checkForUpdates() },
            quit: { ApplicationTermination.request() },
            updatesState: { [weak self] in
                .updatesState(
                    canCheck: self?.updatesManager.canCheckForUpdates ?? false,
                    lastCheck: self?.updatesManager.lastUpdateCheckDate
                )
            }
        )
    }

    /// A pane the settings process handed back because it needs the running app.
    private func openSettingsInApp(pane: String) {
        if let identifier = SettingsNavigationIdentifier(rawValue: pane) {
            navigationState.settingsNavigationIdentifier = identifier
        }
        openWindow(.settings, allowSettingsProcess: false)
    }
}

```

### Core Architecture Module: `Thaw/System/Permissions/MenuBarAllowState.swift`
```
//
//  MenuBarAllowState.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import MenuBarModel
import PlatformRuntimeKit

/// Control Center's own switch for an app's menu bar items, which macOS
/// applies before anything Thaw does.
@MainActor
enum MenuBarAllowState {
    /// Whether either grant that opens Control Center's app list is held.
    private static var canReadList: Bool {
        PickedFileAccess.controlCenterAppList.hasAccess || PickedFileAccess.controlCenterVisibilityRecovery.hasAccess
    }

    /// The switch for Thaw itself, or nil when it cannot be told: the list was
    /// never granted, or has no record of Thaw. Never asks for access.
    static func ofThaw() -> Bool? {
        guard canReadList else { return nil }
        return try? NativeAppVisibilityStore().isAllowed(bundleID: ThawMenuBarIdentity.bundleIdentifier)
    }

    /// The given apps whose switch is off. Empty when the list cannot be read. Never asks for access.
    static func switchedOff(among bundleIDs: Set<String>) -> Set<String> {
        guard !bundleIDs.isEmpty, canReadList else { return [] }
        let store = NativeAppVisibilityStore()
        return bundleIDs.filter { (try? store.isAllowed(bundleID: $0)) == false }
    }
}

```

### Core Architecture Module: `Thaw/Utilities/AXHelpers.swift`
```
//
//  AXHelpers.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import ApplicationServices
import Cocoa
import MenuBarModel
import ThawAXCore

nonisolated enum AXHelpers {
    @discardableResult
    static func isProcessTrusted(prompt: Bool = false) -> Bool {
        // kAXTrustedCheckOptionPrompt's value; the global is not concurrency-safe.
        let options = ["AXTrustedCheckOptionPrompt": prompt] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    /// nil off the main thread when point is over a Thaw window. The hit-test
    /// is bounded: a hung app under the cursor would otherwise block it, and
    /// Thaw's main thread with it, indefinitely.
    static func element(at point: CGPoint) -> AXElement? {
        nativeElement(at: point).map(AXElement.init)
    }

    static func application(for runningApp: NSRunningApplication) -> AXElement? {
        let app = AXElement.application(runningApp.processIdentifier)
        // Without a timeout, an unresponsive app stalls enumeration
        // indefinitely in mach_msg.
        app.setMessagingTimeout(AXPrimitives.defaultMessagingTimeout)
        return app
    }

    static func extrasMenuBar(for app: AXElement) -> AXElement? {
        app.value(kAXExtrasMenuBarAttribute) as? AXElement
    }

    /// Everything the walk reads from one extras-bar child, in one message.
    /// The timeout bounds each read, so batching caps a slow app at one timeout
    /// per item. Unanswered attributes are nil, as in the single accessors.
    struct MenuBarChildAttributes {
        var role: String?
        var frame: CGRect?
        var identifier: String?
        var title: String?
        var accessibilityDescription: String?
        var children: [AXElement] = []
    }

    /// Pass includingRole only for MenuBarAgent's bar. The walks also read Thaw's own bar off the
    /// main thread, where AppKit answers in-process and is not thread-safe, so that read stays minimal.
    static func menuBarChildAttributes(for element: AXElement, includingRole: Bool = false) -> MenuBarChildAttributes {
        let values = element.values((includingRole ? [kAXRoleAttribute] : []) + [
            frameAttribute, kAXIdentifierAttribute, kAXTitleAttribute, kAXDescriptionAttribute, kAXChildrenAttribute,
        ])
        return MenuBarChildAttributes(
            role: values[kAXRoleAttribute] as? String,
            frame: values[frameAttribute] as? CGRect,
            identifier: values[kAXIdentifierAttribute] as? String,
            title: values[kAXTitleAttribute] as? String,
            accessibilityDescription: values[kAXDescriptionAttribute] as? String,
            children: values[kAXChildrenAttribute] as? [AXElement] ?? []
        )
    }

    /// The same reading below a status item. Never asks a menu for its
    /// children: that builds the menu, and some apps activate when it happens.
    ///
    /// - Parameter includingChildren: Whether to fetch the children at all,
    ///   for a walk that descends further. Never fetched for a menu.
    static func descendantAttributes(
        for element: AXElement,
        includingChildren: Bool = false
    ) -> MenuBarChildAttributes {
        let values = element.values([
            kAXRoleAttribute, frameAttribute, kAXIdentifierAttribute, kAXTitleAttribute, kAXDescriptionAttribute,
        ])
        let role = values[kAXRoleAttribute] as? String
        return MenuBarChildAttributes(
            role: role,
            frame: values[frameAttribute] as? CGRect,
            identifier: values[kAXIdentifierAttribute] as? String,
            title: values[kAXTitleAttribute] as? String,
            accessibilityDescription: values[kAXDescriptionAttribute] as? String,
            children: includingChildren && role != kAXMenuRole ? children(for: element) : []
        )
    }

    /// The application's normal menu bar (Apple menu + app menus).
    /// Unlike point hit-testing, this remains reliable when Thaw's overlay panel
    /// occupies the screen's menu-bar origin on macOS 27.
    static func menuBar(for app: AXElement) -> AXElement? {
        app.value(kAXMenuBarAttribute) as? AXElement
    }

    /// A menu bar's or a status item's children. Below a status item, read
    /// through descendantAttributes(for:includingChildren:) instead.
    static func children(for element: AXElement) -> [AXElement] {
        childrenIfAvailable(for: element) ?? []
    }

    /// The element's AXHelp attribute (tooltip/description string).
    static func help(for element: AXElement) -> String? {
        element.value(kAXHelpAttribute) as? String
    }

    static func childrenIfAvailable(for element: AXElement) -> [AXElement]? {
        element.value(kAXChildrenAttribute) as? [AXElement]
    }

    /// The element referenced by AXOverflowButton, when exposed. Containers
    /// such as the macOS 27 extras menu bar publish their overflow control as
    /// an attribute rather than as an ordinary child.
    static func overflowButton(for element: AXElement) -> AXElement? {
        element.value(kAXOverflowButtonAttribute) as? AXElement
    }

    /// The children of MenuBarAgent's extras bar that are its overflow
    /// chevron by role. See AXPrimitives.isMenuBarAgentOverflowRole(_:).
    static func overflowButtons(among children: [AXElement]) -> [AXElement] {
        children.filter { AXPrimitives.isMenuBarAgentOverflowRole(roleString(for: $0)) }
    }

    /// Whether the element advertises AXOverflowButton, or nil when its
    /// attribute list could not be read.
    static func supportsOverflowButton(_ element: AXElement) -> Bool? {
        element.attributeNames()?.contains(kAXOverflowButtonAttribute)
    }

    static func isEnabled(_ element: AXElement) -> Bool {
        enabledAttribute(element) ?? false
    }

    /// The raw AXEnabled attribute, or nil when not exposed. Unlike isEnabled,
    /// this tells "disabled" from "absent"; source-PID matching treats absent as enabled.
    static func enabledAttribute(_ element: AXElement) -> Bool? {
        element.value(kAXEnabledAttribute) as? Bool
    }

    static func frame(for element: AXElement) -> CGRect? {
        element.value(frameAttribute) as? CGRect
    }

    /// Raw AXRole string.
    static func roleString(for element: AXElement) -> String? {
        element.value(kAXRoleAttribute) as? String
    }

    /// Unions the frames of application menu titles in a menu bar element, or nil when the
    /// foreground app answers too slowly or exposes too many children to read on the caller's actor.
    /// Only menu item roles count: on macOS 27 the children include
    /// status-item hosts, which would make the leading pill swallow them.
    static func applicationMenuChildFrameUnion(for menuBar: AXElement) -> CGRect {
        boundedMenuFrameUnion(children(for: menuBar), budget: .milliseconds(300)) { child in
            guard isEnabled(child), let childFrame = frame(for: child) else { return nil }
            switch roleString(for: child) {
            case kAXMenuBarItemRole, kAXMenuItemRole: return childFrame
            default: return nil
            }
        } ?? .null
    }

    /// More children than any app's menu bar has; past it the read is not attempted.
    static let applicationMenuChildLimit = 64

    /// The union of the frames menuTitleFrame finds, or nil when children exceed the limit or the
    /// reads outlast budget. Each read is a synchronous call into another app.
    static func boundedMenuFrameUnion<Child>(
        _ children: [Child],
        budget: Duration,
        now: () -> ContinuousClock.Instant = { .now },
        menuTitleFrame: (Child) -> CGRect?
    ) -> CGRect? {
        guard children.count <= applicationMenuChildLimit else { return nil }
        let deadline = now() + budget
        var union = CGRect.null
        for child in children {
            guard now() < deadline else { return nil }
            if let frame = menuTitleFrame(child) {
                union = union.union(frame)
            }
        }
        return now() < deadline ? union : nil
    }

    /// The element's AXTitle, when present. On macOS 27 most menu bar
    /// item elements leave this empty, so callers fall back to identifier.
    static func title(for element: AXElement) -> String? {
        element.value(kAXTitleAttribute) as? String
    }

    /// The element's AXIdentifier. Thaw sets one on its control-item buttons
    /// so the macOS 27 AX enumeration can recognize them.
    static func identifier(for element: AXElement) -> String? {
        element.value(kAXIdentifierAttribute) as? String
    }

    /// The element's accessibility description. Some status-item apps expose
    /// a stable semantic label here while AXTitle contains live metric text.
    static func description(for element: AXElement) -> String? {
        element.value(kAXDescriptionAttribute) as? String
    }

    /// The element's AXValueDescription, where level-style items (battery,
    /// volume) tend to put the number their glyph only implies.
    static func valueDescription(for element: AXElement) -> String? {
        element.value(kAXValueDescriptionAttribute) as? String
    }

    /// The element's AXValue, when it is a string. AXValue is untyped, so
    /// a numeric value simply yields nil here rather than a coerced string.
    static func stringValue(for element: AXElement) -> String? {
        element.value(kAXValueAttribute) as? String
    }

    static func pid(for element: AXElement) -> pid_t? {
        element.pid
    }

    /// Presses the element and returns whether its menu opened. Needed for
    /// Electron/Chromium tray items, which ignore synthetic clicks. The
    /// timeout must be set on the element: the app element's does not
    /// propagate (default ~1.5 s).
    @discardableResult
    static func press(_ element: AXElement) -> Bool {
        AXPrimitives.press(element.raw)
    }
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1116** (2026-09-14): **[Bug] Sort A->Z does nothing for hidden and always-hidden sections**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read the tracking issue first  ### Problem / Use Case  The "Sort A to Z" button in Settings, Menu Bar Layout writes the sorted order to the active profile, but for the **hidden** and **always-hidden** sections the menu bar never reorders. The sort persists to disk and nothing moves on the bar. The **visible** section sorts correctly.  ### Steps to reproduce  1. Put several items in the hidden section in a non-alphabetical order. 2. Open Settings, Menu Bar Layout. 3. Click "Sort A to Z" on the hidden section heading.  ### Expected behavior  The hidden section's items reorder alphabetically on the bar.  ### Actual behavior  Nothing moves. The on-disk profile carries the sorted order, but the bar keeps its previous order.  ### Thaw version  2.1.0-beta.2  ### macOS version  26  ### Display setup  Single display  ### Anything else?  The sort calls `applyProfileLayout`, which by default relaxes concealed-section order (`enforceConcealedSectionOrder` defaults to false, no user toggle). `relaxConcealedSectionOrder` rewrites the desired order back to the current order, so the LCS plans zero moves. Visible is not relaxed, so it sorts fine. The relaxation is intentional for background work (it avoids hijacking the cursor to reorder items parked off-screen), but an explicit user sort needs to opt out of it for that one pass. 

- **Issue #899** (2026-08-15): **[Bug] RC2.1 destroys my cursor moves**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  After switching from rc 2.0 und rc 2.1 the space between the icons is set to Standard and I have no chance to reduce this back. But on my macOS 26.6 I can´t use the new release because the cursor is moving unmotivated, went big and smal sometimes I see 3 ones - activating the log was a challenge:-)  I´m back on rc 2.0 :-(  ### Steps to Reproduce  brew upgrade Start thaw and see the problem  ### Expected Behavior  should be good  ### App Version  rc 2.1  ### macOS Version  26.6  ### Display Setup  Single monitor  ### Logs / Console Output  [thaw_2026-08-06_14-03-56.log](https://github.com/user-attachments/files/30792643/thaw_2026-08-06_14-03-56.log)  ### Additional Context  _No response_

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

### Incident Patch 1: `09fc3293` (2026-11-05)
**Commit Message**: feat(modules): 3.0.0-alpha.13, modules on ThawUI 1.2.1 (#1443)

* feat(modules): run Scripts, Triggers and Widgets as module apps, and reorganize Settings around them

Thaw starts and restarts the bundled module apps through a module host
with its own launch rules. Profile scripts, app triggers and the widget
icon each move into their module, and a module can hold an item shown
until it lets go. A Modules page switches them on and off, and a
module's page leaves the sidebar while it's off.

Settings is reorganized around the split: Automation becomes Triggers
and Scripts, Displays & Spaces becomes Displays, the custom status icon
gets a Widgets page, Experiments is retired and its settings move next
to what they're about, and several pairs of switches become one row.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* fix(modules): keep held items shown

An item a module holds with thaw://reveal-item?hold=true could still be
hidden by a click from the Thaw Bar, a concealed-item click, a reveal for
an icon change, a plain reveal-item, a Shortcuts reveal or an image
capture. Each of those paths now leaves a held item shown. The check is
one extension on the section controller, so the 

**File**: `.github/workflows/ci.yml` (modified, +0/-2)
```diff
@@ -142,7 +142,6 @@ jobs:
             compilation-cache-${{ runner.os }}-${{ github.ref_name }}-
             compilation-cache-${{ runner.os }}-
 
-      # ThawAXCore is a static product linked by both the app and its hosted tests; the runner's Xcode rejects that unless told otherwise.
       # The Thaw target's lint build phase requires the pinned SwiftLint on PATH.
       - name: Install pinned SwiftLint
         if: needs.changes.outputs.code == 'true'
@@ -159,7 +158,6 @@ jobs:
             -derivedDataPath Build/ \
             -destination 'platform=macOS' \
             -enableCodeCoverage YES \
-            DISABLE_DIAMOND_PROBLEM_DIAGNOSTIC=YES \
             CODE_SIGN_IDENTITY="" \
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGNING_ALLOWED=NO
```

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -27,7 +27,6 @@ default.profraw
 .attic/
 *.xcuserstate
 .swiftpm/
-ThawUI/.build/
 *.profraw
 .dd/
 .local-logs/
```

**File**: `.swiftlint.yml` (modified, +17/-4)
```diff
@@ -3,18 +3,31 @@ included:
   - Thaw
   - packages/ThawCapture
   - packages/ThawCtl
-  - ThawUI
+  - packages/ThawAutomation
+  - packages/ThawModuleKit
+  - packages/ThawTriggers
+  - packages/ThawWidgets
 
 excluded:
   - packages/MenuBarModel/.build
   - packages/ThawCapture/.build
   - packages/ThawCtl/.build
-  - ThawUI/.build
+  - packages/ThawAutomation/.build
+  - packages/ThawModuleKit/.build
+  - packages/ThawTriggers/.build
+  - packages/ThawWidgets/.build
   - ThawTests
+  - packages/ThawAutomation/Tests
+  - packages/ThawModuleKit/Tests
+  - packages/ThawTriggers/Tests
+  - packages/ThawWidgets/Tests
   - packages/MenuBarModel/Package.swift
   - packages/ThawCapture/Package.swift
   - packages/ThawCtl/Package.swift
-  - ThawUI/Package.swift
+  - packages/ThawAutomation/Package.swift
+  - packages/ThawModuleKit/Package.swift
+  - packages/ThawTriggers/Package.swift
+  - packages/ThawWidgets/Package.swift
 
 disabled_rules:
   - function_parameter_count
@@ -86,7 +99,7 @@ file_header:
     //  SWIFTLINT_CURRENT_FILENAME
     //  Project: Thaw
     //
-    //  Copyright \(Thaw\) © 2026 Toni Förster
+    //  Copyright \(Thaw\) © 2026 (Toni Förster|René Jiménez|Thaw)
     //  Licensed under the GNU GPLv3
 
 modifier_order:
```

**File**: `CHANGELOG.md` (modified, +49/-0)
```diff
@@ -24,6 +24,53 @@ the items under New and Fixed.
 
 ## [Unreleased]
 
+## [3.0.0-alpha.13] - 2026-11-04
+
+**macOS 27 only · Build 124**
+
+Scripts, Triggers and Widgets become modules you can switch on and off, and Settings is rebuilt on [ThawUI](https://github.com/thaw-app/ThawUI). Your settings, triggers, scripts and widget design carry over. By @diazdesandi.
+
+### New
+
+- **Modules.** Settings › Extras switches optional parts of Thaw on and off. A module that's off doesn't run and leaves the sidebar. Scripts, Triggers and Widgets come first, and each starts on if you already used it.
+
+### Changed
+
+#### Modules
+
+- **Triggers, Scripts and Widgets run as small apps next to Thaw.** Open each from its page in Settings. The widget icon moved there from Experiments.
+- **Profile switches don't wait for a "before switching" script** to finish before the layout changes.
+
+#### Settings
+
+- **A new sidebar.** Everyday pages come first, then your modules, then Extras, Privacy and Tools, with About last. The arrow keys move between pages.
+- **Extras is a grid of cards,** each with the part's icon, what it does and its switch. Profiles can be turned off there too, and your saved profiles are kept.
+- **Some pages moved.** Displays & Spaces is now Displays. Automation became Triggers and Scripts, with thaw:// app permissions on Privacy and switching profiles by display or Space on Profiles. Experiments is gone, and its features sit on the pages they belong to with an Alpha or Beta badge. Old links to these pages still open.
+- **Theme: System, Light, Dark or Black,** for Settings and onboarding, in General › Language and theme. Black suits OLED displays and replaces "Black background in dark mode".
+- **Fewer glass finishes.** The Effect menu has Glass, with a Tint switch, and a Liquid Glass section with Edge, Sheer, Dim, Invert and Dynamic Glass. Saved looks keep how they looked.
+- **The Thaw Bar's own look has a Corners slider,** from square to round, instead of the Rounded corners switch.
+- **Every Search style can rename and move items.** The styles are now Detailed, Compact and Large, and all three share the bottom bar: ⌘E renames, ⌘K shows actions and ⌘1 to ⌘3 move an item.
+- **Hide items again is one menu** in Simple Mode and Visibility: Never, When I click elsewhere, When I switch apps or a delay.
+- **One name for each thing.** Settings and menus now agree, and Alpha and Beta features carry a badge. Reset Positions is now Rebuild Saved Layout, Hide again after is Keep opened items in the menu bar for, and Open hidden items in the menu bar is Show clicked items in the menu bar.
+- **The Thaw Bar's Location choices say where it opens,** and shortcuts have their own choice, When opened by a shortcut.
+- **Displays has a Template tab** with the Thaw Bar and spacing settings for new displays.
+- **Spacing has one warning at the top,** and Layout explains Apple's items in Known macOS 27 limitations.
+- **The arrow keys step through What's New and Acknowledgements,** and permission icons line up.
+
+### Fixed
+
+- **App language shows System Default** when you haven't picked a language.
+- **Layout and Search show the symbol of Bluetooth and other system items** that Thaw switched off, and one grey placeholder for items Thaw can't identify.
+- **Screenshots no longer show the Finder menus you hid** on the desktop.
+- **Notes in the layout editor's right-click menu are dimmed,** so they don't look like commands.
+- **Links in the release notes open only over https,** and a Wi-Fi sign-in page can't replace your saved release notes.
+- **Recording a shortcut stops when you leave its page,** and Shift-Escape cancels it.
+- **The Settings window no longer shrinks** right after it opens.
+- **App icons in the Thaw Bar match the size** of the item pictures beside them.
+- **A cancelled click no longer waits** for the pointer to stop.
+- **Items with a blank name get their picture taken.**
+- **Thaw's Time Machine icon keeps updating** when Time Machine stops answering.
+
 ## [3.0.0-beta.6] - 2026-11-03
 
 **macOS 27 only · Build 123**
@@ -577,6 +624,7 @@ After you update:
 - **Thaw Bar Only is gone.** Items you kept there are now ordinary Hidden items. By @diazdesandi.
 - **Troubleshooting no longer has Reset Control Center or Quit and Clear Cache.** On macOS 27, Reset Control Center also erased your choices in System Settings > Menu Bar. Restore Missing Items brings items back without deleting anything. Thaw now clears its saved item pictures after every update, which is what Quit and Clear Cache did. By @diazdesandi.
 
+
 ### Changed
 
 - **The last welcome screen shows its cards two to a row,** so each demo and caption has room. By @diazdesandi.
@@ -652,6 +700,7 @@ After you update:
 - **Siri doesn't run Thaw's actions when you ask by voice.** The same actions work from Shortcuts and Spotlight.
 - **On some Macs, clicks in Settings land below the control.** Reported in [#1265](https://github.com/thaw-app
```

**File**: `Thaw.xcodeproj/project.pbxproj` (modified, +145/-38)
```diff
@@ -7,8 +7,8 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		71373D1685FEE5815708C9A6 /* DequeModule in Frameworks */ = {isa = PBXBuildFile; productRef = 147F2F5E062E0539138D611C /* DequeModule */; };
 		170423D92B56DE78004A2549 /* Sparkle in Frameworks */ = {isa = PBXBuildFile; productRef = 170423D82B56DE78004A2549 /* Sparkle */; };
-		17F71BB52B880B4500905CBA /* CompactSlider in Frameworks */ = {isa = PBXBuildFile; productRef = 17F71BB42B880B4500905CBA /* CompactSlider */; };
 		7127A9FF2C4886D100D99DEF /* IfritStatic in Frameworks */ = {isa = PBXBuildFile; productRef = 7127A9FE2C4886D100D99DEF /* IfritStatic */; };
 		7188A6882E27F9ED008F131D /* ThawCapture in Frameworks */ = {isa = PBXBuildFile; productRef = 7188A6872E27F9ED008F131D /* ThawCapture */; };
 		7188A6892E27F9ED008F131D /* MenuBarCaptureService.xpc in Embed XPC Services */ = {isa = PBXBuildFile; fileRef = 7188A6842E27F9ED008F131D /* MenuBarCaptureService.xpc */; settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; };
@@ -30,9 +30,16 @@
 		A1A1A1A1A1A1A1A1A1A1A106 /* ThawAXClient in Frameworks */ = {isa = PBXBuildFile; productRef = A1A1A1A1A1A1A1A1A1A1A103 /* ThawAXClient */; };
 		A1A1A1A1A1A1A1A1A1A1A107 /* ThawAXHelper in Embed AX Helper */ = {isa = PBXBuildFile; productRef = A1A1A1A1A1A1A1A1A1A1A104 /* ThawAXHelper */; settings = {ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }; };
 		E1E1E1E1E1E1E1E1E1E1E103 /* ThawExtraHelper in Embed Extra Helper */ = {isa = PBXBuildFile; productRef = E1E1E1E1E1E1E1E1E1E1E102 /* ThawExtraHelper */; };
+		D4D4D4D4D4D4D4D4D4D4D403 /* ThawAutomation in Embed Modules */ = {isa = PBXBuildFile; productRef = D4D4D4D4D4D4D4D4D4D4D402 /* ThawAutomation */; };
+		D5D5D5D5D5D5D5D5D5D5D503 /* ThawTriggers in Embed Modules */ = {isa = PBXBuildFile; productRef = D5D5D5D5D5D5D5D5D5D5D502 /* ThawTriggers */; };
+		D6D6D6D6D6D6D6D6D6D6D603 /* ThawWidgets in Embed Modules */ = {isa = PBXBuildFile; productRef = D6D6D6D6D6D6D6D6D6D6D602 /* ThawWidgets */; };
 		A1A1A1A1A1A1A1A1A1A1A10A /* ThawAXCore in Frameworks */ = {isa = PBXBuildFile; productRef = A1A1A1A1A1A1A1A1A1A1A109 /* ThawAXCore */; };
+		C0C0C0C0C0C0C0C0C0C0C003 /* ThawConcurrency in Frameworks */ = {isa = PBXBuildFile; productRef = C0C0C0C0C0C0C0C0C0C0C002 /* ThawConcurrency */; };
 		B1B1B1B1B1B1B1B1B1B1B104 /* ThawLayout in Frameworks */ = {isa = PBXBuildFile; productRef = B1B1B1B1B1B1B1B1B1B1B102 /* ThawLayout */; };
 		B1B1B1B1B1B1B1B1B1B1B105 /* ThawLayout in Frameworks */ = {isa = PBXBuildFile; productRef = B1B1B1B1B1B1B1B1B1B1B103 /* ThawLayout */; };
+		C3C3C3C3C3C3C3C3C3C3C304 /* ThawModuleKit in Frameworks */ = {isa = PBXBuildFile; productRef = C3C3C3C3C3C3C3C3C3C3C302 /* ThawModuleKit */; };
+		A9E1F0042F70000000000004 /* ThawUI in Frameworks */ = {isa = PBXBuildFile; productRef = A9E1F0052F70000000000005 /* ThawUI */; };
+		C3C3C3C3C3C3C3C3C3C3C305 /* ThawModuleKit in Frameworks */ = {isa = PBXBuildFile; productRef = C3C3C3C3C3C3C3C3C3C3C303 /* ThawModuleKit */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -114,6 +121,17 @@
 			);
 			name = "Embed Extra Helper";
 		};
+		D4D4D4D4D4D4D4D4D4D4D404 /* Embed Modules */ = {
+			isa = PBXCopyFilesBuildPhase;
+			dstPath = "$(CONTENTS_FOLDER_PATH)/Library/Modules";
+			dstSubfolder = Product;
+			files = (
+				D4D4D4D4D4D4D4D4D4D4D403 /* ThawAutomation in Embed Modules */,
+				D5D5D5D5D5D5D5D5D5D5D503 /* ThawTriggers in Embed Modules */,
+				D6D6D6D6D6D6D6D6D6D6D603 /* ThawWidgets in Embed Modules */,
+			);
+			name = "Embed Modules";
+		};
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
@@ -189,15 +207,17 @@
 				7127A9FF2C4886D100D99DEF /* IfritStatic in Frameworks */,
 				9570E4A96CDEC0BEBAA5573F /* AsyncAlgorithms in Frameworks */,
 				8A9B3C0882A8086D09565228 /* Algorithms in Frameworks */,
+				71373D1685FEE5815708C9A6 /* DequeModule in Frameworks */,
 				C9858DF951474BBA89EEC700 /* Subprocess in Frameworks */,
-				17F71BB52B880B4500905CBA /* CompactSlider in Frameworks */,
 				D85602169B8B4308ACEB30A0 /* MenuBarModel in Frameworks */,
 				A7C4F0012F60000000000001 /* ThawCapture in Frameworks */,
 				A9E1F0032F70000000000003 /* ThawUI in Frameworks */,
 				D27A00012F40000000000001 /* PlatformRuntimeKit in Frameworks */,
 				A1A1A1A1A1A1A1A1A1A1A105 /* ThawAXCore in Frameworks */,
 				A1A1A1A1A1A1A1A1A1A1A106 /* ThawAXClient in Frameworks */,
 				B1B1B1B1B1B1B1B1B1B1B104 /* ThawLayout in Frameworks */,
+				C3C3C3C3C3C3C3C3C3C3C304 /* ThawModuleKit in Frameworks */,
+				C0C0C0C0C0C0C0C0C0C0C003 /* ThawConcurrency in Frameworks */,
 			);
 		};
 		7188A6802E27F9ED008F131D /* Frameworks */ = {
@@ -214,7 +234,9 @@
 				A7C4F0022F60000000000002 /* ThawCapture in Frameworks */,
 				A1A1A1A1A1A1A1A1A1A1A10A /* ThawAXCore in Frameworks */,
 				B1B1B1B1B1B1B1B1B1B1B105 /* ThawLayout in Frameworks */,
+				C3C3C3C3C3C3C3C3C3C3C305 /* ThawModuleKit in Frameworks */,
 				D27A00022F4000000
```

**File**: `Thaw.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +18/-9)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "a882f0a3e7345de4e7a3f07fb2d3d791a6731f2f6e203e97a7aaed6c574e8672",
+  "originHash" : "9e8064317f7234cd89d89f62b7482e3b282df612080ed82591145f7f62999e68",
   "pins" : [
     {
       "identity" : "compactslider",
@@ -33,8 +33,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/sparkle-project/Sparkle",
       "state" : {
-        "revision" : "eef1a539a373c1f1a320624b1130fc5de7b2e100",
-        "version" : "2.10.0"
+        "revision" : "ab7d71291238df6e0492143b120c9b696a35f603",
+        "version" : "2.10.1"
       }
     },
     {
@@ -60,8 +60,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-collections",
       "state" : {
-        "revision" : "3b69cedbaa49957e97c092ae400bb57602ef941f",
-        "version" : "1.7.2"
+        "revision" : "f96b909e1a9e469620bc5037c1e24e00153f376f",
+        "version" : "1.7.5"
       }
     },
     {
@@ -78,17 +78,26 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/swiftlang/swift-subprocess",
       "state" : {
-        "revision" : "55d30558b8b12c0343793421328fe81a4919c776",
-        "version" : "1.0.1"
+        "revision" : "dbe21bd7dfd4ffef8c32588918542a8abfa1b54c",
+        "version" : "1.0.2"
       }
     },
     {
       "identity" : "swift-system",
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/apple/swift-system",
       "state" : {
-        "revision" : "b5544ba79a70a0cb3563e75bf26dc198d6b40ed3",
-        "version" : "1.7.4"
+        "revision" : "869129b7bf4ecc57b97d0193ad29690ca2134750",
+        "version" : "1.8.1"
+      }
+    },
+    {
+      "identity" : "thawui",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/thaw-app/ThawUI",
+      "state" : {
+        "revision" : "205a9ea0631aa71f8dace0505970dcb6b2cff7d1",
+        "version" : "1.2.1"
       }
     }
   ],
```

**File**: `Thaw/App/AppDelegate.swift` (modified, +42/-6)
```diff
@@ -9,6 +9,7 @@ import MenuBarModel
 import PlatformRuntimeKit
 import SwiftUI
 import ThawAXCore
+import ThawUI
 
 @MainActor
 final class AppDelegate: NSObject, NSApplicationDelegate {
@@ -19,6 +20,17 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
     private var terminationTimeoutTask: Task<Void, Never>?
     /// Per-item descenders; inert unless the setting is turned on.
     private let notchPanelController = NotchPanelController()
+    /// Items modules keep shown with thaw://reveal-item?hold=true; a module's
+    /// holds go when it stops running.
+    private lazy var heldItemReveals: HeldItemReveals = {
+        let holds = HeldItemReveals(
+            reveal: { [unowned self] in appState.menuBarManager.sectionController.revealItemTemporarily($0) },
+            conceal: { [unowned self] in appState.menuBarManager.sectionController.concealTemporarilyRevealedItem($0) }
+        )
+        appState.moduleHost.onModuleQuit = { [weak holds] in holds?.releaseAll(for: $0) }
+        holds.makeCurrent()
+        return holds
+    }()
 
     #if DEBUG
         /// Check both Xcode flags because previews may use either the preview or playground environment.
@@ -32,6 +44,7 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
 
     func applicationWillFinishLaunching(_: Notification) {
         LiveApp.register(self)
+        ThawHUD.menuBarHeight = { $0.getMenuBarHeightEstimate() }
         #if DEBUG
             // Don't perform setup if running as a preview.
             if isRunningForPreviews {
@@ -171,7 +184,6 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
         isPreparingForTermination = true
         hasRepliedToTerminationRequest = false
         appState.diagLog.info("Application asked to terminate \(QuitRequestSource.current()) - restoring blocked items asynchronously")
-        appState.appRunningTriggers.stop()
 
         Task { @MainActor in
             _ = await appState.itemManager.restoreBlockedItemsToVisible()
@@ -217,6 +229,7 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
             appState.menuBarManager.nativeAppHidingExperiment.prepareForTermination()
         }
         appState.menuBarManager.systemExtraTakeover.prepareForTermination()
+        appState.moduleHost.stopAll()
         // Balance the layout-table security scope before exit.
         MenuBarLayoutTableAccess.shared.release()
     }
@@ -351,8 +364,10 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
             handleToggleRequest(key: key, displayUUID: displayUUID, sender: identity.bundleIdentifier)
         case let .get(query):
             handleGetRequest(query, sender: identity)
-        case let .revealItem(bundle, itemID):
-            handleRevealItemRequest(bundle: bundle, itemID: itemID, sender: identity.bundleIdentifier)
+        case let .revealItem(bundle, itemID, hold):
+            handleRevealItemRequest(bundle: bundle, itemID: itemID, hold: hold, sender: identity.bundleIdentifier)
+        case let .releaseItem(bundle, itemID):
+            handleReleaseItemRequest(bundle: bundle, itemID: itemID, sender: identity.bundleIdentifier)
         case let .launcher(operation, query):
             handleLauncherRequest(LauncherURIRequest(operation: operation, query: query), sender: identity)
         case let .proxyPress(bundle):
@@ -435,8 +450,9 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
     }
 
     /// thaw://reveal-item?bundle=X or ?item-id=Y reveals one item without its section.
-    /// Reconceals with the Thaw Bar click path's menu-open-aware delay.
-    private func handleRevealItemRequest(bundle: String?, itemID: String?, sender: String) {
+    /// Reconceals with the Thaw Bar click path's menu-open-aware delay, unless
+    /// hold=true asks to keep it shown until thaw://release-item.
+    private func handleRevealItemRequest(bundle: String?, itemID: String?, hold: Bool, sender: String) {
         let sectionController = appState.menuBarManager.sectionController
         guard sectionController.isOperational else {
             appState.diagLog.warning("Settings URI reveal-item: per-item reveal is unavailable on this OS")
@@ -452,11 +468,31 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
             return
         }
 
+        if hold {
+            heldItemReveals.hold(identifier, for: sender)
+            appState.diagLog.info("Settings URI reveal-item: holding \(identifier) for sender \(sender)")
+            return
+        }
         sectionController.revealItemTemporarily(identifier)
-        sectionController.scheduleTemporaryItemConceal(identifier)
+        sectionController.scheduleTemporaryItemConcealUnlessHeld(identifier)
         appState.diagLog.info("Settings URI reveal-item: revealed \(identifier) for sender \(sender)")
     }
 
+    /// thaw://release-item?bundle=X or ?item-id=Y lets go of a hold; the item hides once nobody holds it.
+    /// A bundle matches every held item 
```

**File**: `Thaw/App/AppState.swift` (modified, +17/-13)
```diff
@@ -13,6 +13,7 @@ import Observation
 import PlatformRuntimeKit
 import SwiftUI
 import ThawCapture
+import ThawUI
 
 /// AppDelegate creates the single environment object owning long-lived subsystems; allocation is safe before permissions are granted.
 /// Subsystems start at most once through bootstrapTask, whose setup order follows dependencies.
@@ -37,6 +38,9 @@ final class AppState {
     /// it neither needs nor supplies anything the menu bar stack depends on.
     let profileManager = ProfileManager()
 
+    /// Whether profiles are on. Held here so the menus and the Profiles pane observe one switch.
+    let profilesFeature = ProfilesFeature()
+
     // Menu bar stack. Set up in dependency order; see bootstrapTask.
 
     /// The sections, their control items, and the show/hide state machine.
@@ -72,7 +76,6 @@ final class AppState {
     /// Reveals concealed items temporarily when their icon changes.
     let alertRevealWatcher = MenuBarItemAlertRevealWatcher()
     let presentationMonitor = PresentationMonitor()
-    let appRunningTriggers = AppRunningTriggersManager()
 
     /// Owner of the user's menu bar spacer items.
     let spacerManager = MenuBarSpacerManager()
@@ -117,13 +120,16 @@ final class AppState {
     /// profiles, and reach the section and zen toggles without the menu.
     let swapBarManager = SwapBarManager()
 
-    /// The panel Thaw's own icon raises in place of its status menu, a Lab
-    /// experiment. Nothing is constructed until the first press with it on.
+    /// The panel Thaw's own icon raises in place of its status menu. Nothing
+    /// is constructed until the first press with it on.
     let controlItemPanel = ControlItemPanelController()
 
-    /// Lab recording watcher reads only public CoreAudio and CoreMediaIO state, independent of other subsystems.
+    /// Reads the camera and microphone for Zen Mode, using only public CoreAudio and CoreMediaIO state.
     let recordingWatchManager = RecordingWatchManager()
 
+    /// Launches the modules shipped with Thaw or installed beside it.
+    let moduleHost = ModuleHost(environment: .live())
+
     let applicationMenuCover = ApplicationMenuCover()
 
     /// Settings in a process of its own, when SettingsInOwnProcess is set.
@@ -229,10 +235,6 @@ final class AppState {
         diagLog.debug("bootstrap: starting imageCache setup")
         imageCache.activate(with: self)
         alertRevealWatcher.performSetup(with: self)
-        appRunningTriggers.start(
-            reveal: { [weak self] in self?.menuBarManager.sectionController.revealItemTemporarily($0) },
-            release: { [weak self] in self?.menuBarManager.sectionController.concealTemporarilyRevealedItem($0) }
-        )
         presentationMonitor.performSetup(with: self)
         spacerManager.performSetup(with: self)
         screenCorners.performSetup(with: self, displaySettlements: displayEnvironment.settlements)
@@ -251,15 +253,15 @@ final class AppState {
         profileManager.performSetup(with: self)
         itemManager.repairs.onUserLayoutChange = { [weak self] in self?.profileLayoutKeeper.noteUserLayoutChange() }
         itemManager.savedOrderMirrorGate.observe(displayInvalidations: displayEnvironment.invalidations)
+        profilesFeature.onChange = { [weak profileManager] in profileManager?.rebuildProfileHotkeys() }
         controlCommandObserver.performSetup(with: self)
         controlStatePublisher.performSetup(with: self)
         swapBarManager.performSetup(with: self, displaySettlements: displayEnvironment.settlements)
         controlItemPanel.performSetup(with: self)
         recordingWatchManager.performSetup(with: self)
         applicationMenuCover.performSetup(with: self)
-        // The widget preview item exists only inside a running process, so
-        // every launch re-publishes it when the user last left it enabled.
-        StatusIconWidgetController.shared.restore()
+        moduleHost.startObservingTerminations()
+        Task { await moduleHost.startAll() }
 
         installObservers()
         MemoryReclaimer.start()
@@ -360,7 +362,7 @@ final class AppState {
 
         Task {
             let allowFetch = settings.advanced.fetchReleaseNotes
-            guard await ChangelogDocument.load(allowFetch: allowFetch).document?.newestRelease != nil else { return }
+            guard await ChangelogDocument.load(allowFetch: allowFetch, info: .thaw).document?.newestRelease != nil else { return }
             activate(withPolicy: .regular)
             openWindow(.whatsNew)
         }
@@ -541,7 +543,9 @@ final class AppState {
     }
 
     func openWindow(_ id: ThawWindowIdentifier, allowSettingsProcess: Bool = true) {
-        if allowSettingsProcess, showsInSettingsProcess(id, isOpenHere: openWindows.contains(id)) { return }
+        if allowSettingsProcess, showsInSettingsProcess(id, isOpenHere: openWindows.contains(id)) {
+            return
+        }
         if id == .settings {
             prepareSettingsPre
```

---

### Incident Patch 2: `5a0d92b6` (2026-11-05)
**Commit Message**: fix: 3.0.0-alpha.13 follow-ups for profile scripts, module replacement and the app icon (#1453)

* fix(profiles): export and copy a profile with the scripts the Scripts module has now

Scripts are edited in the Scripts module, which saves them in its own defaults, so export and duplicate copied the scripts the profile file carried before scripts moved into the module. A new script was missing, and an edited or removed one came back as it was. Both now read the module's copy once it has taken the profile over, and the file's before that.

HookConfiguration and the module's defaults keys move to ThawModuleKit, so Thaw and the module read the same thing.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* fix(modules): stop a module that is removed or replaced while it runs

refresh() swapped in the new module list without stopping entries that left it. With a downloaded copy installed over a running bundled one, the old process kept running with nothing tracking it: switching the module off stopped the new entry, and the old process's exit never released its held items.

Departing entries are stopped first, which also ends a launch still in flight. A switched-on module's replacement s

**File**: `CHANGELOG.md` (modified, +9/-5)
```diff
@@ -24,7 +24,7 @@ the items under New and Fixed.
 
 ## [Unreleased]
 
-## [3.0.0-alpha.13] - 2026-11-04
+## [3.0.0-alpha.13] - 2026-11-05
 
 **macOS 27 only · Build 124**
 
@@ -39,7 +39,11 @@ Scripts, Triggers and Widgets become modules you can switch on and off, and Sett
 #### Modules
 
 - **Triggers, Scripts and Widgets run as small apps next to Thaw.** Open each from its page in Settings. The widget icon moved there from Experiments.
-- **Profile switches don't wait for a "before switching" script** to finish before the layout changes.
+- **Profile switches don't wait for a "before switching" script** to finish before the layout changes. Scripts also run for the profile Thaw applies as it starts, and go with a profile you export or copy.
+
+#### Thaw's icon
+
+- **The cube in Thaw's icon is even.** Its top face no longer looks paler than its sides, and the shapes inside it share one flat cream.
 
 #### Settings
 
@@ -70,9 +74,9 @@ Scripts, Triggers and Widgets become modules you can switch on and off, and Sett
 - **A cancelled click no longer waits** for the pointer to stop.
 - **Items with a blank name get their picture taken.**
 - **Thaw's Time Machine icon keeps updating** when Time Machine stops answering.
-- **Layout shows new items when macOS leaves out Thaw's own icon.** On macOS 27.2 Thaw then kept its whole earlier list, so an item that appeared later stayed missing from Layout. Thaw now adds the items it found and keeps the earlier ones whose apps still run. QQ and WeChat no longer get a new Layout item for each unread count. Reported by @Mujun05 in [#1449](https://github.com/thaw-app/Thaw/issues/1449).
-- **Profiles no longer reset your menu bar spacing.** Applying a profile, at startup or when you changed Space or Focus, could put the menu bar back to its default spacing instead of the spacing you chose.
-- **Thaw no longer moves items while you log in or switch to another display.** An app opening at login ended Thaw's wait for the menu bar a few seconds in, and when the menu bar moved to another display Thaw read item positions from both bars. Either way it could move an item out of the place you gave it.
+- **Layout picks up new items when macOS leaves out Thaw's own icon,** and QQ and WeChat keep one item each as their unread count changes. Reported by @Mujun05 in [#1449](https://github.com/thaw-app/Thaw/issues/1449) and fixed in [#1450](https://github.com/thaw-app/Thaw/pull/1450).
+- **Applying a profile keeps your menu bar spacing,** at startup and when you change Space or Focus. Fixed by @Omoeba in [#1451](https://github.com/thaw-app/Thaw/pull/1451).
+- **Thaw waits for the menu bar to settle before moving items,** while you log in and when the menu bar moves to another display. Fixed by @camguillory in [#1452](https://github.com/thaw-app/Thaw/pull/1452).
 
 ## [3.0.0-beta.6] - 2026-11-03
 
```

**File**: `Thaw/Modules/ModuleHost+Live.swift` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ extension ModuleHost.Environment {
                 ).processIdentifier
             },
             terminate: { pid in NSRunningApplication(processIdentifier: pid)?.terminate() },
+            isRunning: { pid in NSRunningApplication(processIdentifier: pid)?.isTerminated == false },
             now: { .now },
             wait: { seconds in try? await Task.sleep(for: .seconds(seconds)) },
             loadEnabled: { Defaults.stringArray(forKey: .enabledModules).map(Set.init) },
```

**File**: `Thaw/Modules/ModuleHost.swift` (modified, +35/-1)
```diff
@@ -27,6 +27,8 @@ final class ModuleHost {
         /// its process. With showWindow the module opens its window.
         var launch: (_ url: URL, _ showWindow: Bool) async throws -> pid_t
         var terminate: (pid_t) -> Void
+        /// Whether the process is still running.
+        var isRunning: (pid_t) -> Bool
         var now: () -> Date
         var wait: (TimeInterval) async -> Void
         /// The identifiers of the modules switched on, or nil before the first choice is saved.
@@ -72,6 +74,8 @@ final class ModuleHost {
     @ObservationIgnored private var stopCounts: [URL: Int] = [:]
     @ObservationIgnored private var terminationObserver: (any NSObjectProtocol)?
     @ObservationIgnored private var hasLoadedEnabled = false
+    /// Replaced modules' processes, each with the identifier of the module to start once it exits.
+    @ObservationIgnored private var handovers: [pid_t: String] = [:]
 
     init(environment: Environment, restartPolicy: ModuleRestartPolicy = ModuleRestartPolicy()) {
         self.environment = environment
@@ -114,8 +118,23 @@ final class ModuleHost {
             let state: State = verdict == .launch || known != .idle ? known : .refused(verdict)
             found[url] = Module(manifest: manifest, verdict: verdict, state: state)
         }
+        let departed = modules.filter { found[$0.key] == nil }
+        // A module removed or replaced by a downloaded copy stops before it leaves the list,
+        // so no process or launch in flight is left that nothing tracks.
+        departed.keys.forEach(stop)
         modules = found
         loadEnabledIfNeeded()
+        for module in departed.values {
+            guard let identifier = module.manifest?.identifier, isEnabled(identifier), let replacement = url(ofModule: identifier)
+            else { continue }
+            switch module.state {
+            // The copy with the same bundle ID starts once the old process is gone, or
+            // macOS could bring the old one forward instead.
+            case let .running(pid): handovers[pid] = identifier
+            case .restarting: Task { await start(replacement) }
+            default: break
+            }
+        }
     }
 
     func isEnabled(_ identifier: String) -> Bool {
@@ -216,6 +235,10 @@ final class ModuleHost {
             }
             Self.diagLog.info("Module at \(url.lastPathComponent) running as pid \(pid)")
             modules[url]?.state = .running(pid)
+            // An exit reported while the launch was still under way found no running module.
+            if !environment.isRunning(pid) {
+                await moduleDidTerminate(pid: pid)
+            }
         } catch {
             Self.diagLog.error("Module at \(url.path) failed to launch: \(error)")
             if stopCounts[url, default: 0] == stopCount {
@@ -237,6 +260,7 @@ final class ModuleHost {
 
     private func reportQuit(_ url: URL) {
         if let bundleIdentifier = modules[url]?.manifest?.bundleIdentifier {
+            ProfileSwitchAnnouncer.moduleQuit(bundleIdentifier: bundleIdentifier)
             onModuleQuit?(bundleIdentifier)
         }
     }
@@ -257,6 +281,13 @@ final class ModuleHost {
     /// Called when any app quits. A module that quits while still marked
     /// running did so on its own, and the restart policy decides what's next.
     func moduleDidTerminate(pid: pid_t) async {
+        if let identifier = handovers.removeValue(forKey: pid) {
+            // Looked up now: the list may have changed, or the module been switched off, while the old copy quit.
+            if isEnabled(identifier), let replacement = url(ofModule: identifier) {
+                await start(replacement)
+            }
+            return
+        }
         guard let url = modules.first(where: { $0.value.state == .running(pid) })?.key else { return }
         reportQuit(url)
         let now = environment.now()
@@ -273,9 +304,12 @@ final class ModuleHost {
         }
     }
 
-    /// Watches for module processes quitting. Call once after creating the live host.
+    /// Watches for module processes quitting, and for the Scripts module to say it listens.
+    /// Call once after creating the live host, before modules start.
     func startObservingTerminations() {
         guard terminationObserver == nil else { return }
+        // Before any module starts, so the Scripts module's first "listening" is heard.
+        ProfileSwitchAnnouncer.startListeningForScripts()
         terminationObserver = NSWorkspace.shared.notificationCenter.addObserver(
             forName: NSWorkspace.didTerminateApplicationNotification,
             object: nil,
```

**File**: `Thaw/Modules/ProfileSwitchAnnouncer.swift` (modified, +50/-6)
```diff
@@ -11,6 +11,16 @@ import ThawModuleKit
 /// Tells modules that Thaw is switching profiles, so the Scripts module can run
 /// the user's scripts. Thaw doesn't wait for any module to answer.
 enum ProfileSwitchAnnouncer {
+    private static var backlog = ProfileSwitchBacklog()
+    private static var listeningObserver: NSObjectProtocol?
+
+    /// Posts one phase to the modules. Under unit tests it posts nothing, so a running Scripts
+    /// module can't run the user's scripts; tests replace it to see what would be sent.
+    static var deliver: (Notification.Name, [String: String]) -> Void = { name, userInfo in
+        guard !TestHosting.isActive(environment: ProcessInfo.processInfo.environment) else { return }
+        DistributedNotificationCenter.default().postNotificationName(name, object: nil, userInfo: userInfo, deliverImmediately: true)
+    }
+
     /// The notification for one phase of a switch, or nil without a bundle ID to scope it to.
     static func notification(
         _ phase: ProfileSwitch.Phase,
@@ -21,13 +31,47 @@ enum ProfileSwitchAnnouncer {
         return (ProfileSwitch.notificationName(phase, hostBundleIdentifier: hostBundleIdentifier), event.userInfo)
     }
 
+    /// Waits for the Scripts module to say it listens, and sends it the switch held until then.
+    /// Call before modules start, so the first answer isn't missed. A Scripts module still running
+    /// from before Thaw started announced itself already, so it is asked to say so again.
+    static func startListeningForScripts() {
+        guard listeningObserver == nil, let host = Bundle.main.bundleIdentifier else { return }
+        listeningObserver = DistributedNotificationCenter.default().addObserver(
+            forName: ProfileSwitch.listeningNotificationName(hostBundleIdentifier: host),
+            object: nil,
+            queue: .main
+        ) { _ in
+            MainActor.assumeIsolated { scriptsListening() }
+        }
+        deliver(ProfileSwitch.listeningQueryNotificationName(hostBundleIdentifier: host), [:])
+    }
+
+    /// The Scripts module listens now: sends the switch held until then.
+    static func scriptsListening(at now: ContinuousClock.Instant = .now) {
+        for (phase, event) in backlog.moduleListening(at: now) {
+            send(phase, event)
+        }
+    }
+
+    /// A module quit. Switches made while the Scripts module is gone wait for it to listen again.
+    static func moduleQuit(bundleIdentifier: String) {
+        guard let host = Bundle.main.bundleIdentifier, bundleIdentifier == SavedScripts.domain(hostBundleIdentifier: host)
+        else {
+            return
+        }
+        backlog.moduleStopped()
+    }
+
+    /// Announces one phase of a switch, or holds it while the Scripts module isn't listening.
     static func post(_ phase: ProfileSwitch.Phase, _ event: ProfileSwitch) {
+        if backlog.shouldSend(phase, event, at: .now) {
+            send(phase, event)
+        }
+    }
+
+    /// Posts the phase's notification under Thaw's bundle ID.
+    private static func send(_ phase: ProfileSwitch.Phase, _ event: ProfileSwitch) {
         guard let notification = notification(phase, event, hostBundleIdentifier: Bundle.main.bundleIdentifier) else { return }
-        DistributedNotificationCenter.default().postNotificationName(
-            notification.name,
-            object: nil,
-            userInfo: notification.userInfo,
-            deliverImmediately: true
-        )
+        deliver(notification.name, notification.userInfo)
     }
 }
```

**File**: `Thaw/Modules/ProfileSwitchBacklog.swift` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+//
+//  ProfileSwitchBacklog.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 Toni Förster
+//  Licensed under the GNU GPLv3
+
+import ThawModuleKit
+
+/// The profile switch the Scripts module hasn't heard: held while it starts or restarts, and sent
+/// once it says it listens. Holding instead of also sending means no switch runs its scripts twice.
+nonisolated struct ProfileSwitchBacklog {
+    /// A held switch older than this is dropped, so turning Scripts on later runs nothing stale.
+    static let maximumAge = Duration.seconds(60)
+
+    private(set) var isListening = false
+    private var held: [(phase: ProfileSwitch.Phase, event: ProfileSwitch, at: ContinuousClock.Instant)] = []
+
+    /// Whether to send this phase now. Otherwise it is held, and a new switch replaces the one held.
+    mutating func shouldSend(_ phase: ProfileSwitch.Phase, _ event: ProfileSwitch, at now: ContinuousClock.Instant) -> Bool {
+        if isListening {
+            return true
+        }
+        if phase == .willApply {
+            held.removeAll()
+        }
+        held.append((phase, event, now))
+        return false
+    }
+
+    /// The module listens now: the held phases still recent enough to run, oldest first.
+    mutating func moduleListening(at now: ContinuousClock.Instant) -> [(phase: ProfileSwitch.Phase, event: ProfileSwitch)] {
+        isListening = true
+        let due = held.filter { now - $0.at <= Self.maximumAge }.map { ($0.phase, $0.event) }
+        held.removeAll()
+        return due
+    }
+
+    /// The module quit, so switches are held until it listens again.
+    mutating func moduleStopped() {
+        isListening = false
+    }
+}
```

**File**: `Thaw/Resources/AppIcon.icon/icon.json` (modified, +9/-77)
```diff
@@ -45,11 +45,11 @@
   ],
   "groups": [
     {
-      "name": "Innards Sides",
+      "name": "Innards",
       "layers": [
         {
-          "name": "innards-sides",
-          "image-name": "innards.svg",
+          "name": "innards-top",
+          "image-name": "innards-top.svg",
           "hidden": false,
           "opacity": 0.94,
           "glass-specializations": [
@@ -60,20 +60,7 @@
           "fill-specializations": [
             {
               "value": {
-                "linear-gradient": [
-                  "display-p3:1.00000,0.98000,0.86000,1.00000",
-                  "display-p3:1.00000,0.87000,0.50000,1.00000"
-                ],
-                "orientation": {
-                  "start": {
-                    "x": 0.5,
-                    "y": 0
-                  },
-                  "stop": {
-                    "x": 0.5,
-                    "y": 1
-                  }
-                }
+                "solid": "display-p3:1.00000,0.92500,0.68000,1.00000"
               }
             },
             {
@@ -88,52 +75,10 @@
               0
             ]
           }
-        }
-      ],
-      "hidden": false,
-      "opacity": 1,
-      "lighting": "individual",
-      "blur-material": 0.25,
-      "refractivity": {
-        "enabled": true,
-        "strength": 0.45,
-        "depth": 0.55
-      },
-      "shadow-specializations": [
-        {
-          "value": {
-            "kind": "layer-color",
-            "opacity": 0.25
-          }
         },
         {
-          "appearance": "dark",
-          "value": {
-            "kind": "layer-color",
-            "opacity": 0.25
-          }
-        }
-      ],
-      "specular-specializations": [
-        {
-          "value": "inside"
-        }
-      ],
-      "translucency-specializations": [
-        {
-          "value": {
-            "enabled": false,
-            "value": 0.5
-          }
-        }
-      ]
-    },
-    {
-      "name": "Innards Top",
-      "layers": [
-        {
-          "name": "innards-top",
-          "image-name": "innards-top.svg",
+          "name": "innards-sides",
+          "image-name": "innards.svg",
           "hidden": false,
           "opacity": 0.94,
           "glass-specializations": [
@@ -144,20 +89,7 @@
           "fill-specializations": [
             {
               "value": {
-                "linear-gradient": [
-                  "display-p3:1.00000,0.98000,0.86000,1.00000",
-                  "display-p3:1.00000,0.87000,0.50000,1.00000"
-                ],
-                "orientation": {
-                  "start": {
-                    "x": 0.5,
-                    "y": 0
-                  },
-                  "stop": {
-                    "x": 0.5,
-                    "y": 1
-                  }
-                }
+                "solid": "display-p3:1.00000,0.92500,0.68000,1.00000"
               }
             },
             {
@@ -176,7 +108,7 @@
       ],
       "hidden": false,
       "opacity": 1,
-      "lighting": "individual",
+      "lighting": "combined",
       "blur-material": 0.25,
       "refractivity": {
         "enabled": true,
@@ -303,7 +235,7 @@
           "name": "face-top",
           "image-name": "face-top.svg",
           "hidden": false,
-          "opacity": 0.62,
+          "opacity": 0.4,
           "glass-specializations": [
             {
               "value": true
```

**File**: `Thaw/Settings/Models/Profiles/ProfileCurrentScripts.swift` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+//
+//  ProfileCurrentScripts.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 Toni Förster
+//  Licensed under the GNU GPLv3
+
+import Foundation
+import ThawModuleKit
+
+extension Profile {
+    /// The profile with the scripts the user has now, for an export or a copy. Scripts are edited
+    /// in the Scripts module, so the profile file can hold an older set or none.
+    func withCurrentScripts(moduleDefaults: UserDefaults?) -> Profile {
+        var profile = self
+        profile.automation = SavedScripts.automation(forProfileID: id, inFile: automation, moduleDefaults: moduleDefaults)
+        return profile
+    }
+}
+
+extension UserDefaults {
+    /// The Scripts module's defaults for this Thaw, or nil without a bundle ID.
+    static var scriptsModule: UserDefaults? {
+        Bundle.main.bundleIdentifier.flatMap { UserDefaults(suiteName: SavedScripts.domain(hostBundleIdentifier: $0)) }
+    }
+}
```

**File**: `Thaw/Settings/Models/Profiles/ProfileManager.swift` (modified, +2/-2)
```diff
@@ -498,7 +498,7 @@ final class ProfileManager {
 
     /// Duplicates an existing profile with a new name.
     func duplicateProfile(id: UUID, newName: String) throws {
-        let original = try loadProfile(id: id)
+        let original = try loadProfile(id: id).withCurrentScripts(moduleDefaults: .scriptsModule)
         let duplicate = Profile(
             name: newName,
             content: original.content
@@ -522,7 +522,7 @@ final class ProfileManager {
 
     /// Exports a profile to a file, including display associations.
     func exportProfile(id: UUID, to url: URL) throws {
-        let profile = try loadProfile(id: id)
+        let profile = try loadProfile(id: id).withCurrentScripts(moduleDefaults: .scriptsModule)
         let meta = profiles.first { $0.id == id }
         let entry = ProfileExportEntry(
             profile: profile,
```

---

### Incident Patch 3: `0f5b58fc` (2026-11-05)
**Commit Message**: fix(menubar): keep the structural pass off the bar while login items load or the bar changes display (#1452)

* fix(menubar): keep the structural pass off the bar while login items load or the bar changes display

The structural pass moved items that were already in place, twice after
one login. An app opening at login started an app-launch settling, and
since it names the launched bundle it was classed as a relaunch wait,
which replaces the boot's. It ended once that one app was back, 4 s after
login, and the pass then ran while other login items were still starting.
Settling is now classed by reason: only a spacing relaunch waits for a
set of bundles, and an app launch yields to the boot like a display
change.

Later the bar moved to another display, and the pass read frames from
both bars before the cache followed, then moved an item that was in
place. A new barOnUncachedDisplay hold makes the pass wait until the
cache is on the bar's display, like the post-restriction repair already
does.

Signed-off-by: Camille Guillory <[REDACTED_EMAIL]>

* fix(menubar): address the review of the settling and display holds

- A spacing preflight is classified from its own request. A launch th

**File**: `CHANGELOG.md` (modified, +3/-5)
```diff
@@ -24,11 +24,6 @@ the items under New and Fixed.
 
 ## [Unreleased]
 
-### Fixed
-
-- **Layout shows new items when macOS leaves out Thaw's own icon.** On macOS 27.2 Thaw then kept its whole earlier list, so an item that appeared later stayed missing from Layout. Thaw now adds the items it found and keeps the earlier ones whose apps still run. QQ and WeChat no longer get a new Layout item for each unread count. Reported by @Mujun05 in [#1449](https://github.com/thaw-app/Thaw/issues/1449).
-- **Profiles no longer reset your menu bar spacing.** Applying a profile, at startup or when you changed Space or Focus, could put the menu bar back to its default spacing instead of the spacing you chose.
-
 ## [3.0.0-alpha.13] - 2026-11-04
 
 **macOS 27 only · Build 124**
@@ -75,6 +70,9 @@ Scripts, Triggers and Widgets become modules you can switch on and off, and Sett
 - **A cancelled click no longer waits** for the pointer to stop.
 - **Items with a blank name get their picture taken.**
 - **Thaw's Time Machine icon keeps updating** when Time Machine stops answering.
+- **Layout shows new items when macOS leaves out Thaw's own icon.** On macOS 27.2 Thaw then kept its whole earlier list, so an item that appeared later stayed missing from Layout. Thaw now adds the items it found and keeps the earlier ones whose apps still run. QQ and WeChat no longer get a new Layout item for each unread count. Reported by @Mujun05 in [#1449](https://github.com/thaw-app/Thaw/issues/1449).
+- **Profiles no longer reset your menu bar spacing.** Applying a profile, at startup or when you changed Space or Focus, could put the menu bar back to its default spacing instead of the spacing you chose.
+- **Thaw no longer moves items while you log in or switch to another display.** An app opening at login ended Thaw's wait for the menu bar a few seconds in, and when the menu bar moved to another display Thaw read item positions from both bars. Either way it could move an item out of the place you gave it.
 
 ## [3.0.0-beta.6] - 2026-11-03
 
```

**File**: `Thaw/Items/Manager/MenuBarItemManager+Moving.swift` (modified, +1/-0)
```diff
@@ -548,6 +548,7 @@ extension MenuBarItemManager {
             // reading schedules this pass again once it is done.
             guard manualMembershipTask == nil else { return }
             guard WriteHold.first(StructuralNormalizationHolds.checks, in: situation) == nil else {
+                readBarIfItMoved(situation)
                 rearm()
                 return
             }
```

**File**: `Thaw/Items/Manager/MenuBarItemManager+StartupSettling.swift` (modified, +11/-7)
```diff
@@ -25,12 +25,15 @@ extension MenuBarItemManager {
         maxDuration: Duration = .seconds(60)
     ) {
         let mergedExpected = settlingExpectedBundleIDs.union(expectedBundleIDs)
-        let incomingKind: SettlingKind = if !mergedExpected.isEmpty {
-            .expectedSet
-        } else if reason == "performSetup" {
+        // An app launch names its bundle too, but only a relaunch wait may
+        // replace the boot's: a launch at login would end it once that one
+        // app is back, long before the rest of the login items.
+        let incomingKind: SettlingKind = if reason == "performSetup" {
             .cold
         } else if reason.hasPrefix("spacingRelaunch") {
-            .preflight
+            // Its own IDs, not the shared set: a launch that yielded leaves its ID there,
+            // and a preflight counting it would replace the boot settling.
+            expectedBundleIDs.isEmpty ? .preflight : .expectedSet
         } else {
             .event
         }
@@ -68,12 +71,11 @@ extension MenuBarItemManager {
             let stableTarget = 3
             var lastSeenCount = -1
             var stablePolls = 0
-            let waitingFor = mergedExpected
-            let useExpectedSet = !waitingFor.isEmpty
+            let useExpectedSet = !mergedExpected.isEmpty
             let settlingStartedAt = ContinuousClock.now
             if useExpectedSet {
                 MenuBarItemManager.diagLog.debug(
-                    "\(reason): waiting for \(waitingFor.count) expected bundle ID(s) to reattach"
+                    "\(reason): waiting for \(mergedExpected.count) expected bundle ID(s) to reattach"
                 )
             }
 
@@ -96,6 +98,8 @@ extension MenuBarItemManager {
                 let barQuiet = !reason.hasPrefix("display") || savedOrderMirrorGate.isQuiet()
 
                 if useExpectedSet {
+                    // Read on every poll: an app launch that yielded to this wait adds its ID later.
+                    let waitingFor = settlingExpectedBundleIDs
                     let presentBundleIDs: Set<String> = Set(
                         itemCache.managedItems.compactMap { item in
                             if case let .string(bid) = item.tag.namespace {
```

**File**: `Thaw/Items/Manager/MenuBarItemManager+WriteHoldSituation.swift` (modified, +11/-0)
```diff
@@ -5,7 +5,9 @@
 //  Copyright (Thaw) © 2026 Toni Förster
 //  Licensed under the GNU GPLv3
 
+import CoreGraphics
 import Foundation
+import MenuBarModel
 
 extension MenuBarItemManager {
     /// Manual arrangement turns the pass off, except to re-lay a stranded
@@ -29,6 +31,15 @@ extension MenuBarItemManager {
         situation.layoutPublicationStale = !layoutPublication.canPublish(generation: layoutPublication.generation)
         situation.sectionRevealed = appState?.menuBarManager.sectionController.revealedSection != nil
         situation.revealTransitionActive = appState?.menuBarManager.isRevealHideTransitionActive ?? false
+        let barDisplayID = Bridging.getActiveMenuBarDisplayID() ?? CGMainDisplayID()
+        situation.barOnUncachedDisplay = itemDisplayID.map { $0 != barDisplayID } ?? false
         return situation
     }
+
+    /// Reads the bar in full when it moved to a display the cache hasn't followed: only a full
+    /// read moves the cache, and an unchanged window list never asks for one.
+    func readBarIfItMoved(_ situation: WriteHold.Situation) {
+        guard situation.barOnUncachedDisplay else { return }
+        Task { await cacheItemsRegardless() }
+    }
 }
```

**File**: `Thaw/Items/Support/WriteHold.swift` (modified, +6/-0)
```diff
@@ -19,6 +19,9 @@ nonisolated enum WriteHold {
         case layoutPublicationStale
         case sectionRevealed
         case revealTransitionActive
+        /// macOS moved the bar to a display the cache has not followed yet,
+        /// so frames read now mix two bars.
+        case barOnUncachedDisplay
     }
 
     /// Which checks hold at one point in time, built by the calling pass.
@@ -32,6 +35,7 @@ nonisolated enum WriteHold {
         var layoutPublicationStale = false
         var sectionRevealed = false
         var revealTransitionActive = false
+        var barOnUncachedDisplay = false
 
         /// Each condition paired with the check named after it.
         private var conditions: [(holds: Bool, check: Check)] {
@@ -45,6 +49,7 @@ nonisolated enum WriteHold {
                 (layoutPublicationStale, .layoutPublicationStale),
                 (sectionRevealed, .sectionRevealed),
                 (revealTransitionActive, .revealTransitionActive),
+                (barOnUncachedDisplay, .barOnUncachedDisplay),
             ]
         }
 
@@ -71,5 +76,6 @@ nonisolated enum StructuralNormalizationHolds {
         .layoutPublicationStale,
         .sectionRevealed,
         .revealTransitionActive,
+        .barOnUncachedDisplay,
     ]
 }
```

**File**: `ThawTests/Items/SettlingKindTests.swift` (modified, +37/-0)
```diff
@@ -35,6 +35,43 @@ struct SettlingKindTests {
         #expect(!manager.isInStartupSettling)
     }
 
+    /// 2026-11-05: an app opening at login ended the boot settling 4 s in,
+    /// and the structural pass then moved items whose apps were still starting.
+    @Test("An app launch at login leaves the boot settling running")
+    func appLaunchKeepsColdSettling() {
+        let manager = MenuBarItemManager()
+        defer { manager.startupSettlingTask?.cancel() }
+
+        manager.startSettlingPeriod(reason: "performSetup")
+        manager.startSettlingPeriod(reason: "appLaunch", expectedBundleIDs: ["com.example.app"], maxDuration: .seconds(8))
+
+        #expect(manager.settlingKind == .cold)
+    }
+
+    @Test("A spacing preflight at login doesn't take an app launch's ID as its own")
+    func preflightKeepsColdSettlingAfterLaunch() {
+        let manager = MenuBarItemManager()
+        defer { manager.startupSettlingTask?.cancel() }
+
+        manager.startSettlingPeriod(reason: "performSetup")
+        manager.startSettlingPeriod(reason: "appLaunch", expectedBundleIDs: ["com.example.app"], maxDuration: .seconds(8))
+        manager.startSettlingPeriod(reason: "spacingRelaunch:preflight")
+
+        #expect(manager.settlingKind == .cold)
+        #expect(manager.settlingExpectedBundleIDs == ["com.example.app"], "the launch's ID stays for the boot settling")
+    }
+
+    @Test("A spacing relaunch still waits for the apps it relaunched")
+    func relaunchReplacesColdSettling() {
+        let manager = MenuBarItemManager()
+        defer { manager.startupSettlingTask?.cancel() }
+
+        manager.startSettlingPeriod(reason: "performSetup")
+        manager.startSettlingPeriod(reason: "spacingRelaunch", expectedBundleIDs: ["com.example.app"])
+
+        #expect(manager.settlingKind == .expectedSet)
+    }
+
     @Test("Weaker settlings yield to stronger ones")
     func yieldOrder() {
         #expect(MenuBarItemManager.settlingYields(incoming: .preflight, to: .event))
```

**File**: `ThawTests/Items/WriteHoldTests.swift` (modified, +10/-0)
```diff
@@ -49,6 +49,7 @@ struct WriteHoldTests {
         all.layoutPublicationStale = true
         all.sectionRevealed = true
         all.revealTransitionActive = true
+        all.barOnUncachedDisplay = true
         #expect(all.heldChecks == Set(WriteHold.Check.allCases))
     }
 }
@@ -62,4 +63,13 @@ struct StructuralNormalizationHoldsTests {
         #expect(StructuralNormalizationHolds.checks.contains(.sectionRevealed))
         #expect(StructuralNormalizationHolds.checks.contains(.revealTransitionActive))
     }
+
+    /// 2026-11-05: the bar moved to another display and the pass, reading
+    /// frames from both bars, moved an item that was in place.
+    @Test("The pass waits while the cache is on another display than the bar")
+    func checksCoverDisplayMove() {
+        var situation = WriteHold.Situation()
+        situation.barOnUncachedDisplay = true
+        #expect(WriteHold.first(StructuralNormalizationHolds.checks, in: situation) == .barOnUncachedDisplay)
+    }
 }
```

#### Recent Merged Pull Requests:
- **PR #1496** (2026-11-07): fix(motion): snap keyboard focus, fade the layout warning, quicken the drag fade (@diazdesandi)
- **PR #1495** (2026-11-07): feat(settings): call the Extras page and sidebar group Modules (@diazdesandi)
- **PR #1494** (2026-11-07): perf(items): ask apps for their menu bar items in parallel (@diazdesandi)
- **PR #1493** (2026-11-07): fix(menubar): pair clicks on Thaw's icon only within half a second (@diazdesandi)
- **PR #1488** (2026-11-07): fix(capture): count pictures of narrow parked items (@Belligerently)
- **PR #1487** (2026-11-07): fix(profiles): preserve current activation when undoing creation (@Belligerently)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
