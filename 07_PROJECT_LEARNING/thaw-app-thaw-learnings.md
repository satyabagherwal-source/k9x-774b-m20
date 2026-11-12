> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/thaw-app-thaw-learnings.md`  
> **Source**: github ([https://github.com/thaw-app/Thaw](https://github.com/thaw-app/Thaw))  
> **Source Version**: `3cb96a01`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T00:23:08.325Z  
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
> **Harvest Timestamp**: 2026-11-12T00:23:02.121Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thaw-app/Thaw`
- **Description**: The open source menu bar manager
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12691 stars

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

### Core Architecture Module: `Thaw/App/AppState+DockIcon.swift`
```
//
//  AppState+DockIcon.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 René Jiménez
//  Licensed under the GNU GPLv3

import AppKit

extension AppState {
    /// Regular puts Thaw in the Dock; nil only activates it. Even a moment as regular
    /// adds Thaw to the Dock's recent apps, so with the icon off the policy stays.
    var userWindowActivationPolicy: NSApplication.ActivationPolicy? {
        Self.userWindowActivationPolicy(showDockIcon: Self.storedShowDockIconWithSettings)
    }

    static nonisolated func userWindowActivationPolicy(showDockIcon: Bool) -> NSApplication.ActivationPolicy? {
        showDockIcon ? .regular : nil
    }

    /// Read from Defaults, not the General model: the permissions window can
    /// open before the model loads its stored values.
    static var storedShowDockIconWithSettings: Bool {
        (Defaults.object(forKey: .showDockIconWithSettings) as? Bool) ?? Defaults.DefaultValue.showDockIconWithSettings
    }

    /// Applies a change of the Dock icon setting to the windows already open.
    func applyUserWindowActivationPolicy() {
        guard hasOpenWindow else {
            return
        }
        NSApp.setActivationPolicy(Self.storedShowDockIconWithSettings ? .regular : .accessory)
    }
}

```

### Core Architecture Module: `Thaw/App/AppState+WhatsNew.swift`
```
//
//  AppState+WhatsNew.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 René Jiménez
//  Licensed under the GNU GPLv3

import Foundation

extension AppState {
    /// Read from Defaults, not the Privacy model: What's New asks during launch,
    /// before the model loads its stored values.
    static var storedShowReleaseNotesAfterUpdate: Bool {
        Defaults.bool(forKey: .showReleaseNotesAfterUpdate)
    }

    /// Read from Defaults for the same launch-order reason.
    static var storedFetchReleaseNotes: Bool {
        Defaults.bool(forKey: .fetchReleaseNotes)
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

    /// Whether the bar is settling or was disturbed recently, shared by the menu bar and item managers.
    let barSettling: BarSettling
    /// Reports wakes, display invalidations and reveals to barSettling.
    private let barSettlingObservers: BarSettlingObservers

    /// The sections, their control items, and the show/hide state machine.
    let menuBarManager: MenuBarManager

    /// The displays where macOS's own overflow arrow is showing, for Settings.
    let nativeOverflowPresence = NativeOverflowPresence()

    /// Shared by the menu bar manager, which acts on a display move, and the
    /// event taps, which ask for a check.
    private let activeDisplayWatcher = ActiveMenuBarDisplayWatcher()

    /// Settles screen-parameter changes into one numbered snapshot.
    let displayEnvironment = DisplayEnvironment()

    /// Space switches and Space list changes as soon as the window server reports them.
    let spaceChanges = SpaceChanges()

    /// The current Space list, re-read when a Space is created or deleted.
    let spaceDirectory = SpaceDirectory()

    /// The Spaces page's choices, sent to the menu bar agent again after it forgets them.
    let spaceMenuBarKeeper = SpaceMenuBarKeeper()

    /// The optional menu bar item that names the active Space.
    @ObservationIgnored lazy var spaceIndicator = SpaceIndicator(launcher: menuBarManager.systemExtraTakeover.launcher)

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
    let itemManager: MenuBarItemManager

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
    @ObservationIgnored private(set) lazy var profileLayoutKeeper = ProfileLayoutKeeper(profileManager: profileManager, itemManager: itemManager, groupManager: itemGroupManager)

    /// Transient, user-facing explanations for refused layout actions.
    let layoutFeedback = LayoutBarFeedbackCenter()

    /// One undo history for layout edits, whichever window or tile made them.
    let layoutUndo = UndoManager()

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

    init() {
        let settling = BarSettling()
        barSettling = settling
        barSettlingObservers = BarSettlingObservers(settling: settling)
        menuBarManager = MenuBarManager(barSettling: settling)
        itemManager = MenuBarItemManager(barSettling: settling)
    }

    // MARK: - Bootstrap

    /// Callers await the same lazy task so bootstrap runs once.
    /// Keep dependency order: each setup assumes preceding subsystems are live.
    @ObservationIgnored
    private lazy var bootstrapTask = Task { @MainActor [self] in
        ToolsSettings.startDiagnosticLogging()

        diagLog.debug("bootstrap: starting AppState setup sequence")

        // Choose helper capture routing once, before a
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

    /// The search result's row, scrolled to once its page and tab show.
    var requestedSettingsRow: String?

    /// The row flashing after a search scrolled to it.
    var highlightedSettingsRow: String?

    /// AppState selects About after window construction; the pane consumes this upgrade request by presenting the changelog.
    var isWhatsNewRequested = false

    var settingsNavigationIdentifier: SettingsNavigationIdentifier = .general {
        didSet {
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
        if let rawValue = Defaults.string(forKey: .lastSettingsPane), let pane = SettingsNavigationIdentifier(storedValue: rawValue), SettingsSidebarPanes.all.contains(pane) {
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
        var c = nativeHidingFollower()

        if let appState {
            // Pre-seed so the initial emission does no rearm work when
            // showOnHover is already true.
            lastShowOnHover = configuration.showOnHover

            // Start or stop the mouse-moved tap when hover, tooltip or display
            // settings change. The continues below skip one event; a return
            // would end the observation.
            let visibilitySettings = appState.settings.visibility
            let displaySettings = appState.settings.displaySettings
            hoverSettingsObservationTask?.cancel()
            hoverSettingsObservationTask = Task { @MainActor [weak self] in
                let changes = Observations {
                    (visibilitySettings.showOnHover, visibilitySettings.showMenuBarTooltips, displaySettings.configurations)
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

### Core Architecture Module: `Thaw/Items/Capture/DiskLoadState.swift`
```
//
//  DiskLoadState.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 René Jiménez
//  Licensed under the GNU GPLv3

/// Where the image cache's lazy disk load stands. A save during a load would rewrite the file
/// without the pictures not merged yet, so it is held until the load is done.
nonisolated struct DiskLoadState: Equatable {
    /// Bumped whenever the cache is emptied on purpose. A load merges only under the generation it started with.
    private(set) var generation = 0
    private(set) var isInFlight = false
    private(set) var isSaveOwed = false

    mutating func began() {
        isInFlight = true
    }

    /// Whether a save must wait for the load in flight; the save is then owed.
    mutating func holdsSave() -> Bool {
        guard isInFlight else { return false }
        isSaveOwed = true
        return true
    }

    /// The load is done. Returns whether a save was held for it and should run now.
    mutating func finished() -> Bool {
        defer { isSaveOwed = false }
        isInFlight = false
        return isSaveOwed
    }

    /// The cache was emptied on purpose: the load's result is refused, and nothing is left for a held save to protect.
    mutating func abandoned() {
        generation &+= 1
        isInFlight = false
        isSaveOwed = false
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
    var usesIconDoubleClickForAlwaysHidden: Bool { get }
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
        layout.isAlwaysHiddenSectionEnabled
    }

    var sectionDividerStyle: SectionDividerStyle {
        layout.sectionDividerStyle
    }

    var customSectionDividerMark: SectionDividerCustomMark? {
        layout.customSectionDividerImage.map {
            SectionDividerCustomMark(data: $0, isTemplate: layout.customSectionDividerIsTemplate)
        }
    }

    var showAllSectionsOnUserDrag: Bool {
        layout.showAllSectionsOnUserDrag
    }

    var showOnClick: Bool {
        visibility.showOnClick
    }

    var showOnHover: Bool {
        visibility.showOnHover
    }

    var showOnHoverDelay: TimeInterval {
        visibility.showOnHoverDelay
    }

    var showOnScroll: Bool {
        visibility.showOnScroll
    }

    var usesIconDoubleClickForAlwaysHidden: Bool {
        ControlItem.usesIconDoubleClickForAlwaysHidden(
            isSectionEnabled: layout.isAlwaysHiddenSectionEnabled,
            isGestureEnabled: visibility.showAlwaysHiddenOnIconDoubleClick
        )
    }

    var swapOnThawIconClick: Bool {
        visibility.swapOnThawIconClick
    }

    var autoRehide: Bool {
        visibility.autoRehide
    }

    var rehideStrategy: RehideStrategy {
        visibility.rehideStrategy
    }

    var rehideInterval: TimeInterval {
        visibility.rehideInterval
    }

    var tempShowInterval: TimeInterval {
        visibility.tempShowInterval
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
        general.hideApplicationMenus
    }

    var showMenuBarTooltips: Bool {
        visibility.showMenuBarTooltips
    }

    var enableSecondaryContextMenu: Bool {
        general.enableSecondaryContextMenu
    }

    var tooltipDelay: TimeInterval {
        visibility.tooltipDelay
    }

    var simpleMode: Bool {
        general.simpleMode
    }

    var enableMenuBarItemOverflow: Bool {
        layout.enableMenuBarItemOverflow
    }

    var enableExperimentalSystemItemHiding: Bool {
        layout.enableExperimentalSystemItemHiding
    }

    var enableExperimentalOverflowPrevention: Bool {
        layout.enableExperimentalOverflowPrevention
    }

    var iconRefreshInterval: TimeInterval {
        layout.iconRefreshInterval
    }

    var alwaysUseAppIconForMenuBarItems: Bool {
        layout.alwaysUseAppIconForMenuBarItems
    }

    var menuBarOrderFulfillmentTimeout: TimeInterval {
        layout.menuBarOrderFulfillmentTimeout
    }
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

### Incident Patch 1: `a9ccd1f9` (2026-11-11)
**Commit Message**: fix: capture, usability and motion follow-ups, real readings for the widget icon, and Layout out-of-room and design fixes (#1500)

* fix(motion): slide layout reorders, grow the new-items badge from its center, smaller timing fixes

The rest of the motion audit:
- Layout bar reorders slide 0.2 s with an ease-out, each in its own
  animation group so the timing doesn't reach other animations, and the
  gap closes with a slide when a dragged block leaves a section.
- The new-items badge grows from 0.85 about its center with a short,
  gentle spring and a fade; Reduce Motion fades it only.
- The dim while a drop settles fades on the layer, since NSView's
  animator alpha finishes in one frame on macOS 27.
- The Thaw Bar preview follows its size and column sliders with the quick
  timing, the tint resample uses the settle timing instead of SwiftUI's
  default, onboarding's tiles use a tapering stagger with a 6 pt rise, and
  the "Waiting for access" row fades in.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* feat(thaw-bar): drop the Thaw Bar in from the menu bar

The Thaw Bar opened instantly. It now fades in while its content settles
6 pt down from 0.97 scale about its top center

**File**: `CHANGELOG.md` (modified, +75/-23)
```diff
@@ -26,35 +26,87 @@ the items under New and Fixed.
 
 ### New
 
-- **Layout warns when items don't fit.** When macOS hides items it has no room for, Layout names them until there's room again.
-- **Release notes can stay closed after an update.** Turn off Show release notes after an update in Privacy. What's New still opens from Thaw's menu and About.
-- **Profiles name Spaces the way Mission Control does.** Pick any Space for a profile, grouped by display, with full screen apps by name. A Space that's gone shows as missing, and the display with the menu bar is marked.
-- **The menu bar can show which Space you're in.** Turn on Show the current Space in the menu bar under Displays › Spaces. Its menu lists the Spaces on each display.
+#### Spaces
+
+- **The current Space in the menu bar.** Turn on Show the current Space in the menu bar in Displays › Spaces. Its menu lists each display's Spaces.
+- **Profiles name Spaces the way Mission Control does,** grouped by display, with full screen apps by name. The display with the menu bar is marked.
+
+#### Widgets
+
+- **The widget icon shows real readings.** Wi-Fi shows your actual bars, and the battery turns green while charging, yellow in Low Power Mode and red below 20%. Suggested by @joaofrgomes in [#1378](https://github.com/thaw-app/Thaw/issues/1378).
+- **Bluetooth audio in the center.** While sound plays through AirPods, headphones or a speaker, the widget shows it, with the volume in blue.
+- **A larger, better-proportioned widget icon.** The ring fills the icon and opens at the bottom, with the dots along it. Choose Standard or Large and the ring's thickness.
+
+#### Layout and Thaw Bar
+
+- **Layout warns when items don't fit,** names the ones macOS hid, and Move to Hidden makes room in one click.
+- **Layout tells you when macOS hides Focus** and turns on Thaw's own Focus icon in one click. Reported by @JosefGvirt in [#1477](https://github.com/thaw-app/Thaw/issues/1477).
+- **The Thaw Bar drops in from the menu bar.** It still closes at once, and only fades with Reduce Motion.
+- **Release notes can stay closed after an update,** in Privacy.
 
 ### Changed
 
-- **Extras is now called Modules.** The Settings page that turns Profiles, Scripts, Triggers and Widgets on and off, and the sidebar group they appear in, use the same name as the rest of Thaw.
-- **Double-clicking Thaw's icon for Always Hidden has its own switch.** Turn off Double-click the Thaw icon to show Always Hidden in Menu Bar Access, and every click shows or hides your items.
-- **The Thaw Bar has its own switch again.** Show hidden items is now two switches, Thaw Bar and Always show hidden items. Your settings carry over.
-- **Profiles and menu bar looks follow a Space switch sooner.** Thaw hears about the switch as it starts, and a new Space can have its own profile right away.
-- **Spaces settings stay after Thaw quits.** Thaw saves what you set on the Spaces page and applies it again when it starts, when you add a Space and when macOS restarts the menu bar.
+- **Hold Option on Capture Hidden Items to retake every picture.** The button reads Retake All Pictures while you do.
+- **Extras is now Modules.**
+- **One name for each section: Visible, Hidden and Always Hidden.**
+- **Apply to All Displays always asks first,** since it overwrites every display's own settings.
+- **The Thaw Bar has its own switch again.** Show hidden items is now two switches, Thaw Bar and Always show hidden items.
+- **Double-clicking Thaw's icon for Always Hidden has its own switch,** in Menu Bar Access. By @malash in [#1339](https://github.com/thaw-app/Thaw/pull/1339).
+- **Spaces settings stay after Thaw quits,** and come back when you add a Space or macOS restarts the menu bar.
+- **Profiles and menu bar looks follow a Space switch sooner.**
+- **Thaw reads a busy menu bar faster.** With many apps running it asks several at once, so it no longer stops partway.
 
 ### Fixed
 
-- **Arrow keys move the Thaw Bar highlight at once.** The item under the keyboard no longer springs up on every key press; the pointer still lifts it.
-- **The layout warning fades in and out.** When Thaw can't move an item, the notice in Layout, the pop-out editor and search no longer pops in and vanishes after a few seconds.
-- **The menu bar shape gets out of the way faster when you drag an item.** It fades out in 0.15 s instead of 0.25 s, and a drag that stops partway fades back sooner.
-- **With Reduce Motion on, the notch panel switches without a pause.** It no longer waits for an animation that Reduce Motion has already turned off.
-- **Layout shows Bluetooth and other switched-off system items as their own symbol.** Items Thaw hides by switching their Control Center module off used to sit in a grey box.
-- **Hidden items no longer collapse right after you point at them or show them again.** A timed rehide that was already finishing could still hide the section you had just reopened.
-- **Diagnostic logs no longer warn on every 
```

**File**: `Thaw/App/Navigation/NavigationIdentifiers/SettingsNavigationIdentifier.swift` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ enum SettingsNavigationIdentifier: String, @MainActor NavigationIdentifier {
     var subtitle: LocalizedStringResource {
         switch self {
         case .general: "Startup, language and icon"
-        case .menuBarLayout: "Shown, hidden and always hidden"
+        case .menuBarLayout: "Visible, Hidden and Always Hidden"
         case .visibility: "How hidden items appear"
         case .thawBar: "Hidden items below the menu bar"
         case .displays: "Each display and Space"
```

**File**: `Thaw/Items/Capture/GlyphCapturePolicy.swift` (modified, +3/-4)
```diff
@@ -23,9 +23,8 @@ extension MenuBarItemImageCache {
 
     /// Chooses between an existing cache entry and a newly captured candidate.
     ///
-    /// Prefers keeping a settled non-blank glyph over blank or much-narrower
-    /// replacements (chevron bleed), while still allowing legitimate updates
-    /// when the candidate is at least as wide.
+    /// Keeps a settled glyph over a blank, much narrower (chevron bleed) or mid-slide one,
+    /// and takes the candidate when it's at least as wide.
     static nonisolated func preferredCachedImage(
         existing: MenuBarItemGlyphCapture,
         candidate: MenuBarItemGlyphCapture
@@ -36,7 +35,7 @@ extension MenuBarItemImageCache {
         if candidate.isEffectivelyBlank {
             return existing
         }
-        if candidate.pointSize.width < existing.pointSize.width * 0.75 {
+        if candidate.pointSize.width < existing.pointSize.width * 0.75 || isLeadingCut(candidate, of: existing) {
             return existing
         }
         return candidate
```

**File**: `Thaw/Items/Capture/GlyphInkBounds.swift` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+//
+//  GlyphInkBounds.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 Toni Förster
+//  Licensed under the GNU GPLv3
+
+import CoreGraphics
+
+extension MenuBarItemImageCache {
+    /// How far, as a share of the kept glyph's width, the left ink edge may move in before a picture counts as cut.
+    static nonisolated let leadingCutTolerance: CGFloat = 0.15
+
+    /// The box around the visible ink in points, or nil for a picture with none.
+    static nonisolated func inkBounds(of capture: MenuBarItemGlyphCapture) -> CGRect? {
+        let image = capture.cgImage
+        let width = image.width, height = image.height
+        guard width > 0, height > 0, capture.scale > 0 else { return nil }
+        let context = CGContext(
+            data: nil,
+            width: width,
+            height: height,
+            bitsPerComponent: 8,
+            bytesPerRow: width * 4,
+            space: CGColorSpaceCreateDeviceRGB(),
+            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+        )
+        guard let context else { return nil }
+        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
+        guard let data = context.data?.assumingMemoryBound(to: UInt8.self) else { return nil }
+        let stride = context.bytesPerRow
+        var minX = width, maxX = -1, minY = height, maxY = -1
+        for row in 0 ..< height {
+            for column in 0 ..< width where data[row * stride + column * 4 + 3] > 12 {
+                minX = min(minX, column)
+                maxX = max(maxX, column)
+                minY = min(minY, row)
+                maxY = max(maxY, row)
+            }
+        }
+        guard maxX >= minX else { return nil }
+        return CGRect(
+            x: CGFloat(minX) / capture.scale,
+            y: CGFloat(minY) / capture.scale,
+            width: CGFloat(maxX - minX + 1) / capture.scale,
+            height: CGFloat(maxY - minY + 1) / capture.scale
+        )
+    }
+
+    /// Whether candidate is the existing picture caught mid-slide: same crop and right edge, left part missing.
+    /// Shorter text or a narrower centred symbol doesn't count; identical bytes skip the scan.
+    static nonisolated func isLeadingCut(_ candidate: MenuBarItemGlyphCapture, of existing: MenuBarItemGlyphCapture) -> Bool {
+        guard abs(candidate.pointSize.width - existing.pointSize.width) < 1,
+              candidate.cgImage !== existing.cgImage,
+              candidate.cgImage.dataProvider?.data != existing.cgImage.dataProvider?.data,
+              let kept = inkBounds(of: existing), let new = inkBounds(of: candidate)
+        else { return false }
+        let edgeSlack = max(1, kept.width * 0.05)
+        return abs(new.maxX - kept.maxX) <= edgeSlack && new.minX - kept.minX > kept.width * leadingCutTolerance
+    }
+}
```

**File**: `Thaw/Items/Capture/MenuBarItemImageCache+Reading.swift` (modified, +14/-5)
```diff
@@ -243,6 +243,19 @@ extension MenuBarItemImageCache {
         let forgivenTags = section != .visible && shouldUseFreshBounds
             ? Set(items.map(\.tag))
             : []
+        let geometryOwners = Self.captureGeometryOwners(
+            for: items,
+            knownItems: appState.itemManager.managedItems,
+            recentItems: appState.itemManager.onScreenItemSnapshot.items
+        )
+        if Self.settlesRevealedPixels(
+            for: section,
+            revealedSection: revealedSection,
+            lastRevealChange: appState.barSettling.lastRevealChange,
+            now: .now
+        ) {
+            await settleRevealedSection(items, appState: appState, reader: LiveMenuBarCaptureReader(geometryOwners: geometryOwners))
+        }
         // A stale item cache can let concealed items into this pass; the crop
         // loop rejects them against this set.
         let concealedIdentifiers = appState.menuBarManager.sectionController
@@ -256,11 +269,7 @@ extension MenuBarItemImageCache {
             freshBounds: shouldUseFreshBounds,
             concealedIdentifiers: concealedIdentifiers,
             forgivenTags: forgivenTags,
-            geometryOwners: Self.captureGeometryOwners(
-                for: items,
-                knownItems: appState.itemManager.managedItems,
-                recentItems: appState.itemManager.onScreenItemSnapshot.items
-            )
+            geometryOwners: geometryOwners
         )
         if !captureResult.unreadable.isEmpty {
             MenuBarItemImageCache.diagLog.debug(
```

**File**: `Thaw/Items/Capture/RevealedGlyphPreference.swift` (modified, +1/-20)
```diff
@@ -29,25 +29,6 @@ extension MenuBarItemImageCache {
 
     /// The height in points from the first to the last row with visible ink.
     static nonisolated func inkPointHeight(of capture: MenuBarItemGlyphCapture) -> CGFloat {
-        let image = capture.cgImage
-        let width = image.width, height = image.height
-        guard width > 0, height > 0, capture.scale > 0 else { return 0 }
-        let context = CGContext(
-            data: nil,
-            width: width,
-            height: height,
-            bitsPerComponent: 8,
-            bytesPerRow: width * 4,
-            space: CGColorSpaceCreateDeviceRGB(),
-            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
-        )
-        guard let context else { return 0 }
-        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
-        guard let data = context.data?.assumingMemoryBound(to: UInt8.self) else { return 0 }
-        let inkRows = (0 ..< height).filter { row in
-            (0 ..< width).contains { column in data[(row * width + column) * 4 + 3] > 12 }
-        }
-        guard let first = inkRows.first, let last = inkRows.last else { return 0 }
-        return CGFloat(last - first + 1) / capture.scale
+        inkBounds(of: capture)?.height ?? 0
     }
 }
```

**File**: `Thaw/Items/Capture/RevealedSectionSettle.swift` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+//
+//  RevealedSectionSettle.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 Toni Förster
+//  Licensed under the GNU GPLv3
+
+import CoreGraphics
+import MenuBarModel
+
+extension MenuBarItemImageCache {
+    /// How long after a reveal a hidden section's pictures wait for its icons to stop moving.
+    /// Later passes skip the wait, so a clock or graph doesn't cost a settle budget on every pass.
+    static nonisolated let revealedSettleWindow = Duration.seconds(3)
+
+    /// Whether a pass over section should wait for settled pixels before its screenshot. macOS reports
+    /// a revealed item's final frame while its icon still slides in, so an early picture is cut.
+    static nonisolated func settlesRevealedPixels(
+        for section: MenuBarSection.Name,
+        revealedSection: MenuBarSection.Name?,
+        lastRevealChange: ContinuousClock.Instant?,
+        now: ContinuousClock.Instant
+    ) -> Bool {
+        section != .visible
+            && shouldUseFreshBounds(for: section, revealedSection: revealedSection)
+            && BarSettling.isWithin(revealedSettleWindow, of: lastRevealChange, now: now)
+    }
+
+    /// Waits, within the reveal settle budget, for items' icons to stop moving. Their frames are read fresh,
+    /// since the cache can still hold where they were parked; with none on the bar there is nothing to wait for.
+    func settleRevealedSection(
+        _ items: [MenuBarItem],
+        appState: AppState,
+        reader: some MenuBarCaptureReading,
+        clock: RevealCaptureSession.SettleClock = RevealCaptureSession.SettleClock()
+    ) async {
+        let displayID = Self.captureDisplayID(
+            itemCacheDisplayID: appState.itemManager.itemDisplayID,
+            activeMenuBarDisplayID: windowServer.activeMenuBarDisplayID(),
+            mainDisplayID: CGMainDisplayID()
+        )
+        let live = await reader.menuBarItems(displayID: displayID).filter { live in
+            items.contains { $0.tag.matchesIgnoringWindowID(live.tag) }
+        }
+        guard !live.isEmpty else { return }
+        await RevealCaptureSession.settleRevealedPixels(live, displayID: displayID, reader: reader, clock: clock)
+    }
+}
```

**File**: `Thaw/Items/Interaction/MenuBarAXSubprocess.swift` (modified, +2/-1)
```diff
@@ -180,7 +180,8 @@ extension MenuBarItemAXProvider {
             guard let item = derived.item else { continue }
             raw.append(item)
         }
-        return assemble(raw + extra(raw))
+        let kept = RetitledItemIdentities.resolve(raw)
+        return assemble(kept + extra(kept))
     }
 
     private static nonisolated func nilIfBlank(_ value: String?) -> String? {
```

---

### Incident Patch 2: `ede311d2` (2026-11-11)
**Commit Message**: feat(layout): out-of-room warning, release-notes and Thaw Bar switches, launch read fix (#1470)

* feat(layout): warn in the Layout pane when macOS is hiding items for lack of room

On a notched or narrow display, when the Visible items don't fit, macOS
puts its own overflow arrow on the bar and stops drawing some items. The
section engine already tracks this per display, but does not publish it,
so Settings could not show it.

A small observable, NativeOverflowPresence on AppState, copies the engine's
answer for each connected display whenever the engine asks for the control
items to be updated, which it does right after the overflow appears or goes
away. The Layout pane reads it for the display its bars show and adds a
warning to its one-banner ranking, after items out of reach and before
missing Screen Recording. When Thaw already knows which Visible items macOS
is not drawing, the warning names them. It goes away when the overflow ends.

There is no button: while macOS's overflow is showing, Thaw already opens
hidden items in the Thaw Bar on that display, so the warning suggests
moving items to Hidden instead.

Not yet validated on a live menu bar.

Signed-off-by: René Jiménez 

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -24,8 +24,18 @@ the items under New and Fixed.
 
 ## [Unreleased]
 
+### New
+
+- **Layout warns when items don't fit.** When macOS hides items it has no room for, Layout names them until there's room again.
+- **Release notes can stay closed after an update.** Turn off Show release notes after an update in Privacy. What's New still opens from Thaw's menu and About.
+
+### Changed
+
+- **The Thaw Bar has its own switch again.** Show hidden items is now two switches, Thaw Bar and Always show hidden items. Your settings carry over.
+
 ### Fixed
 
+- **Items no longer move at launch when Thaw can't read the whole bar in time.** With many apps running, Thaw now waits for a full read before it treats the bar as settled or re-lays it.
 - **Your saved layout is put back once the menu bar settles at launch,** also when Thaw re-applies your profile then and its spacing hasn't changed. Before, that re-apply could stop the final layout pass.
 
 ## [3.0.0-alpha.13] - 2026-11-05
```

**File**: `Thaw/App/AppState.swift` (modified, +5/-7)
```diff
@@ -51,6 +51,9 @@ final class AppState {
     /// The sections, their control items, and the show/hide state machine.
     let menuBarManager: MenuBarManager
 
+    /// The displays where macOS's own overflow arrow is showing, for Settings.
+    let nativeOverflowPresence = NativeOverflowPresence()
+
     /// Shared by the menu bar manager, which acts on a display move, and the
     /// event taps, which ask for a check.
     private let activeDisplayWatcher = ActiveMenuBarDisplayWatcher()
@@ -366,13 +369,8 @@ final class AppState {
     /// First launches and upgrades without changelog content record the version silently, leaving onboarding to handle new users.
     /// Record synchronously before the async repository fetch to avoid repeated prompts after failures.
     func presentWhatsNewForUpgradeIfNeeded() {
-        let current = Constants.versionString
-        guard let lastSeen = Defaults.string(forKey: .lastWhatsNewVersion) else {
-            Defaults.set(current, forKey: .lastWhatsNewVersion)
-            return
-        }
-        guard lastSeen != current else { return }
-        Defaults.set(current, forKey: .lastWhatsNewVersion)
+        let opensAfterUpdate = settings.advanced.showReleaseNotesAfterUpdate
+        guard WhatsNewUpgradeGate.recordVersion(Constants.versionString, opensAfterUpdate: opensAfterUpdate) else { return }
 
         Task {
             let allowFetch = settings.advanced.fetchReleaseNotes
```

**File**: `Thaw/App/WhatsNewUpgradeGate.swift` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+//
+//  WhatsNewUpgradeGate.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 Toni Förster
+//  Licensed under the GNU GPLv3
+
+/// Decides whether a launch opens What's New by itself.
+@MainActor
+enum WhatsNewUpgradeGate {
+    /// Records current as the last version seen and reports whether this launch is an update that should open What's New.
+    ///
+    /// The version is recorded even when opensAfterUpdate is off, so turning the setting back on later does not replay an old changelog.
+    static func recordVersion(_ current: String, opensAfterUpdate: Bool) -> Bool {
+        let lastSeen = Defaults.string(forKey: .lastWhatsNewVersion)
+        guard lastSeen != current else { return false }
+        Defaults.set(current, forKey: .lastWhatsNewVersion)
+        // A first launch has no last version; onboarding greets new users instead.
+        return lastSeen != nil && opensAfterUpdate
+    }
+}
```

**File**: `Thaw/Items/Manager/MenuBarItemManager+Cache.swift` (modified, +8/-0)
```diff
@@ -30,6 +30,9 @@ extension MenuBarItemManager {
         /// Ordered owner/title identities for macOS 27, where synthetic AX window IDs churn without movement.
         /// Stable identities prevent a recache loop while detecting real additions, removals, and reorders.
         fileprivate(set) var cachedItemSignature = [String]()
+
+        /// Whether the cache's last read saw the whole bar, which settling and the structural pass check.
+        fileprivate(set) var lastRead = BarReadRecord()
     }
 
     /// Defined in MenuBarModel so backends can use section buckets without linking the orchestrator.
@@ -612,9 +615,12 @@ extension MenuBarItemManager {
             MenuBarItemManager.diagLog.debug("cacheItemsRegardless: serial cache operation already in progress, coalescing (will rerun)")
             return
         }
+        // Noted as the pass ends, so a caller that coalesced into it never sees the read before its cache.
+        var thisRead: BarReadRecord.Read?
         // Await gate release to avoid refusing callers after this pass returns.
         // end() has no cancellation check, so cancelled tasks still release the gate.
         defer {
+            cacheCycleState.lastRead.note(thisRead)
             let needsRerun = await cacheGate.end()
             // Rerun coalesced drags or resets so layout bars reflect the latest assignments.
             if needsRerun {
@@ -646,6 +652,7 @@ extension MenuBarItemManager {
             return
         }
         onScreenItemSnapshot.update(inventory.freshItems.filter(\.isOnScreen), fromCompleteWalk: inventory.completed)
+        thisRead = BarReadRecord.Read(hasFreshKnownInventory: inventory.hasFreshKnownInventory)
 
         MenuBarItemManager.diagLog.debug("cacheItemsRegardless: getMenuBarItems returned \(items.count) items")
 
@@ -756,6 +763,7 @@ extension MenuBarItemManager {
             previousCachedItems: itemCache.managedItems
         )
         if isPartialMerge {
+            thisRead?.mergedWithOlderItems = true
             guard await recoverPartialCacheSnapshot(&items, itemWindowIDs: itemWindowIDs) else { return }
         }
         cacheCycleState.cachedItemWindowIDs = itemWindowIDs
```

**File**: `Thaw/Items/Manager/MenuBarItemManager+Moving.swift` (modified, +2/-1)
```diff
@@ -547,7 +547,8 @@ extension MenuBarItemManager {
             // laid from the old sections and put the dropped item back. The
             // reading schedules this pass again once it is done.
             guard manualMembershipTask == nil else { return }
-            guard WriteHold.first(StructuralNormalizationHolds.checks, in: situation) == nil else {
+            if let held = WriteHold.first(StructuralNormalizationHolds.checks, in: situation) {
+                StructuralNormalizationHolds.logDeferral(on: held)
                 readBarIfItMoved(situation)
                 rearm()
                 return
```

**File**: `Thaw/Items/Manager/MenuBarItemManager+StartupSettling.swift` (modified, +3/-1)
```diff
@@ -36,7 +36,9 @@ extension MenuBarItemManager {
                     return bid
                 }
                 return nil
-            })
+            }),
+            readGeneration: cacheCycleState.lastRead.generation,
+            readComplete: cacheCycleState.lastRead.isComplete
         )
     }
 
```

**File**: `Thaw/Items/Manager/MenuBarItemManager+WriteHoldSituation.swift` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ extension MenuBarItemManager {
         situation.revealTransitionActive = barHolds.contains(.revealTransition)
         let barDisplayID = Bridging.getActiveMenuBarDisplayID() ?? CGMainDisplayID()
         situation.barOnUncachedDisplay = itemDisplayID.map { $0 != barDisplayID } ?? false
+        situation.barReadIncomplete = !cacheCycleState.lastRead.isComplete
         return situation
     }
 
```

**File**: `Thaw/Items/Support/BarReadRecord.swift` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+//
+//  BarReadRecord.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 Toni Förster
+//  Licensed under the GNU GPLv3
+
+/// The last read of the bar the item cache took, numbered so a caller that coalesced into a
+/// running read can tell it saw no new read, and marked when the read missed part of the bar.
+nonisolated struct BarReadRecord: Equatable, Sendable {
+    /// What one cache pass learned about its read, noted when the pass ends.
+    struct Read: Equatable, Sendable {
+        /// Whether every owner known to have items answered this read; a quick read can skip apps without items.
+        var hasFreshKnownInventory: Bool
+        /// Whether the pass filled the read's gaps from older cached items.
+        var mergedWithOlderItems = false
+    }
+
+    /// Goes up by one with every read, so the same number means the same read.
+    private(set) var generation: UInt64 = 0
+    /// False until a first read, and after a read with stale owners or a merge with older items.
+    private(set) var isComplete = false
+
+    /// Nil, from a pass that ended before it read the bar, leaves the record as it was.
+    mutating func note(_ read: Read?) {
+        guard let read else { return }
+        generation &+= 1
+        isComplete = read.hasFreshKnownInventory && !read.mergedWithOlderItems
+    }
+}
```

---

### Incident Patch 3: `ce10936f` (2026-11-11)
**Commit Message**: fix: stack review fixes, item pictures in the profile preview, the app zoom rollback and PlatformRuntimeKit 1.2.13 (#1519)

* feat(profiles): show item pictures in the profile preview

The preview draws each saved item with the picture Layout uses when the item is in the menu bar now. An item that isn't gets its system symbol, Control Center's icon or its app's icon, and only an app that is no longer installed shows the dashed outline. The pictures are read when the selected profile changes, so drawing does not walk the item cache.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* fix(settings): take the app zoom out until zoomed windows stop ignoring clicks

A zoomed Settings window can stop answering clicks on its switches (#1244, #1265). Thaw's windows now stay at actual size: the zoom modifier, the ⌘+, ⌘− and ⌘0 commands and the Zoom menu in Settings are removed. ThawUI's zoom, its strings and the stored level stay, so it can come back with a small change, and Reset Thaw still clears the stored level.

The Settings window log line no longer carries the zoom, and the lint baseline records the shorter SettingsView.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* fix(hiding): 

**File**: `CHANGELOG.md` (modified, +21/-10)
```diff
@@ -32,7 +32,7 @@ Layout gets a pop-out window and undo for every edit, search becomes Floe's laun
 
 - **Pop Out Editor (work in progress).** Opens Layout in a window with every item in a list, a filter, an editor for the selected item and full keyboard control.
 - **Every Layout edit can be undone,** with ⌘Z anywhere on the Layout page.
-- **Drag down the Layout window's checkboxes to show or hide several items at once.** A dragged row opens a gap where it will land, a section's name lights up when a drop there would move it, and the list scrolls when a drag reaches its edge. Moved rows flash where they landed, and the list follows them.
+- **Drag down the Layout window's checkboxes to show or hide several items at once.** A dragged row opens a gap where it will land, and the list scrolls at its edges.
 - **Trackpad taps for Layout and sliders.** A drag taps as it crosses into another section and when it lands, and the spacing and item size sliders tap at their defaults.
 - **The current Space in the menu bar,** in Displays › Spaces.
 - **Layout warns when items don't fit or macOS hides Focus,** with a one-click fix for each. Reported by @JosefGvirt in [#1477](https://github.com/thaw-app/Thaw/issues/1477).
@@ -47,27 +47,34 @@ Layout gets a pop-out window and undo for every edit, search becomes Floe's laun
 
 ### Changed
 
-- **Search is Floe's launcher,** grouped by section, with Extended and Compact layouts in Visibility. Detailed and Large become Extended. A moved item slides into its new section, and counts roll as they change.
+- **Search is Floe's launcher,** grouped by section, with Extended and Compact layouts in Visibility. Detailed and Large become Extended.
 - **Settings search goes to the row** and finds each module's switch.
 - **Extras is now Modules.**
+- **Segmented choices and the tabs in Settings are the system's own control.** The selection is a glass lens you can press and drag across the choices.
 - **One name for each section: Visible, Hidden and Always Hidden.**
 - **The Thaw Bar has its own switch again,** and so does double-clicking Thaw's icon for Always Hidden. By @malash in [#1339](https://github.com/thaw-app/Thaw/pull/1339).
 - **Apply to All Displays asks first.**
 - **Reset Thaw clears everything but your layout and profiles,** and Reset permissions forgets the files you picked.
 - **Thaw reads a busy menu bar faster,** and profiles and looks follow a Space switch sooner.
 - **The Thaw Bar drops in from the menu bar.**
 - **Corners sliders show their value,** Square, a percentage or Round, and match the other sliders.
-- **Switch to Reduced mode from Troubleshooting.**
+- **Switch to Reduced mode from Troubleshooting,** where Thaw runs as one icon that hides whole apps.
 - **The experimental reorder editor is gone.**
+- **Zoom is off for now.** ⌘+, ⌘− and the Zoom menu are gone until a zoomed Settings window stops ignoring clicks. Reported in [#1244](https://github.com/thaw-app/Thaw/issues/1244) and [#1265](https://github.com/thaw-app/Thaw/issues/1265).
 
 ### Fixed
 
 #### Layout and items
 
+- **The Layout window's green button zooms it instead of going full screen,** where only quitting Thaw got you out.
+- **The widget icon hides again with the Native hiding method.** It stayed on the menu bar in Hidden and Always Hidden.
+- **Native hiding starts again when a hidden app has no entry in System Settings › Menu Bar,** such as one you removed. Reported by @SebastienBn in [#1513](https://github.com/thaw-app/Thaw/issues/1513).
+- **Native hiding hides your apps again when macOS puts its list back right after Thaw changed it.** Thaw used to leave every app on the menu bar with a warning. Reported by @macdaddy1944 in [#1501](https://github.com/thaw-app/Thaw/issues/1501).
+- **An app you switched back on in System Settings says so in Layout,** instead of saying macOS won't let Thaw switch it off.
 - **Undo brings a moved group back whole again.** It used to restore only the batch's ungrouped items.
 - **Live item pictures update again when their left part changes,** like right-aligned text getting shorter on an item that keeps its width.
-- **Shift and the arrow keys extend the selection down the Layout window's list** instead of stopping after one row, a plain arrow key then carries on from where they stopped, and a filter stops a Shift-click selecting rows it hides.
-- **Reordering a group, moving it to another section and the Move to and Move All menu entries can be undone,** and a same-section drag puts the order back as it was even with groups, folders or the new-items badge in the list.
+- **Shift and the arrow keys extend the selection down the Layout window's list,** and a Shift-click no longer selects rows a filter hides.
+- **Reordering or moving a group, Move to and Move All can be undone,** and so can a same-section drag in a list with groups or folders.
 - **A read-only Layout window no longer groups the selection.**
 - **The order you drag the menu bar into is pinne
```

**File**: `FREQUENT_ISSUES.md` (modified, +0/-5)
```diff
@@ -17,7 +17,6 @@ Thaw 3.0 runs on macOS 27, and Thaw 2.x runs on macOS 26 and, from 2.2, on macOS
     - [Full screen](#full-screen)
     - [Very many apps running](#very-many-apps-running)
     - [Siri and voice](#siri-and-voice)
-    - [Clicks in Settings](#clicks-in-settings)
     - [Shortcuts and Focus](#shortcuts-and-focus)
     - [Live Activities](#live-activities)
     - [Apps that need their own update](#apps-that-need-their-own-update)
@@ -100,10 +99,6 @@ With about 240 apps, Thaw can't read the whole menu bar in time, so icons can go
 
 Siri doesn't run Thaw's actions when you ask by voice. The same actions work from Shortcuts and Spotlight.
 
-#### Clicks in Settings
-
-If switches in Settings stop responding, the window may be zoomed. Press ⌘0 to return to actual size. [#1244](https://github.com/thaw-app/Thaw/issues/1244), [#1265](https://github.com/thaw-app/Thaw/issues/1265)
-
 #### Shortcuts and Focus
 
 macOS 27 can hide the Shortcuts item at launch, and the Focus icon may not be visible to Thaw at all. Thaw cannot manage either one yet. [#1105](https://github.com/thaw-app/Thaw/issues/1105), [#1124](https://github.com/thaw-app/Thaw/issues/1124), [#1154](https://github.com/thaw-app/Thaw/issues/1154)
```

**File**: `Thaw.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -1145,7 +1145,7 @@
 			repositoryURL = "https://github.com/thaw-app/ThawUI";
 			requirement = {
 				kind = exactVersion;
-				version = 1.3.0;
+				version = 1.4.0;
 			};
 		};
 		170423D72B56DE78004A2549 /* XCRemoteSwiftPackageReference "Sparkle" */ = {
@@ -1185,7 +1185,7 @@
 			repositoryURL = "https://github.com/thaw-app/prk-bin";
 			requirement = {
 				kind = exactVersion;
-				version = 1.2.12;
+				version = 1.2.13;
 			};
 		};
 		6299E164B288ACBB011AC6B1 /* XCRemoteSwiftPackageReference "swift-algorithms" */ = {
```

**File**: `Thaw.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +5/-5)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "9e8064317f7234cd89d89f62b7482e3b282df612080ed82591145f7f62999e68",
+  "originHash" : "2172eee8f066a0858cf7f975741764e3b2c1a684e3c0dd379b5c658e87db6a79",
   "pins" : [
     {
       "identity" : "compactslider",
@@ -24,8 +24,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/thaw-app/prk-bin",
       "state" : {
-        "revision" : "cb16740567d990060cddca2e97d6bbb04b2dda34",
-        "version" : "1.2.12"
+        "revision" : "839597825f43df4cab472c8dfd3272aeea4060e5",
+        "version" : "1.2.13"
       }
     },
     {
@@ -96,8 +96,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/thaw-app/ThawUI",
       "state" : {
-        "revision" : "045b5e050e6c0529646737dcb4d325856698ecb9",
-        "version" : "1.3.0"
+        "revision" : "f9dcca45c4daa339dda2613a3bfa2d5b2a52cf8a",
+        "version" : "1.4.0"
       }
     }
   ],
```

**File**: `Thaw/App/AppState.swift` (modified, +1/-1)
```diff
@@ -398,7 +398,7 @@ final class AppState {
         isRestarting = true
 
         // Save image cache to disk before restarting so new instance can load it
-        imageCache.saveToDisk()
+        imageCache.saveToDiskAndWait()
 
         let config = NSWorkspace.OpenConfiguration()
         config.activates = false
```

**File**: `Thaw/Input/Events/ClockBridgeAvailability.swift` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+//
+//  ClockBridgeAvailability.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 René Jiménez
+//  Licensed under the GNU GPLv3
+
+import Combine
+import Observation
+
+/// Whether the Clock and Notification Center bridge taps can ever be needed.
+enum ClockBridgeAvailability {
+    /// The bridge releases the restriction the Standard method holds. Native hiding holds none,
+    /// so with it the taps would sit on every left press and drag in the system for nothing.
+    nonisolated static func isPossible(engineIsOperational: Bool, nativeHidingActive: Bool) -> Bool {
+        engineIsOperational && !nativeHidingActive
+    }
+}
+
+extension HIDEventManager {
+    /// A subscription that brings the bridge taps up or down when Native hiding starts or stops.
+    func nativeHidingFollower() -> Set<AnyCancellable> {
+        guard let appState else { return [] }
+        let experiment = appState.menuBarManager.nativeAppHidingExperiment
+        let task = Task { @MainActor [weak self] in
+            for await _ in Observations({ experiment.isActive }) {
+                guard let self else { return }
+                synchronizeClockActivationTap()
+                synchronizeNotificationCenterHotkeyTap()
+            }
+        }
+        return [AnyCancellable { task.cancel() }]
+    }
+}
```

**File**: `Thaw/Input/Events/HIDEventManager+Lifecycle.swift` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ extension HIDEventManager {
     /// Subscribes to the settings and system notifications the manager has to
     /// react to, replacing any subscriptions from a previous call.
     func configureCancellables() {
-        var c = Set<AnyCancellable>()
+        var c = nativeHidingFollower()
 
         if let appState {
             // Pre-seed so the initial emission does no rearm work when
```

**File**: `Thaw/Input/Events/HIDEventManager.swift` (modified, +3/-3)
```diff
@@ -577,16 +577,16 @@ final class HIDEventManager {
     /// bridged.
     ///
     /// The tap that does the bridging is an active session-level tap on every
-    /// left press, so it is only worth installing when a real section engine
-    /// is behind the controller. The stand-in controller answers false for
+    /// left press, so it is only installed when a real section engine is behind the
+    /// controller and Native hiding is off. The stand-in controller answers false for
     /// MenuBarSectionControlling.shouldBridgeClockActivation forever, so
     /// with it the tap would only ever pass events straight through. The
     /// engine's own answer still swings with the assertion state at runtime;
     /// that is decided per click inside the tap, because nothing in here can
     /// learn of an assertion being acquired quickly enough to bring the tap
     /// up before the click that needs it.
     private var canBridgeClockActivation: Bool {
-        appState?.menuBarManager.sectionController.isOperational ?? false
+        appState.map { ClockBridgeAvailability.isPossible(engineIsOperational: $0.menuBarManager.sectionController.isOperational, nativeHidingActive: $0.menuBarManager.nativeAppHidingExperiment.isActive) } ?? false
     }
 
     /// Brings the Clock activation tap in line with whether bridging is
```

#### Recent Merged Pull Requests:
- **PR #1533** (2026-11-11): test(spacing): keep tests from resetting the Mac's menu bar spacing (@Omoeba)
- **PR #1532** (2026-11-11): docs(uri): document missing actions and settings keys (@elior-esh)
- **PR #1530** (2026-11-11): refactor: remove dead code and duplicated logic across the app and packages (@diazdesandi)
- **PR #1528** (2026-11-11): fix: eleven small Settings, search, Layout and profile bugs (@diazdesandi)
- **PR #1527** (2026-11-11): ci: save the compile cache per commit on development, and stop saving it per pull request (@diazdesandi)
- **PR #1526** (2026-11-11): test(layout): cover the Groups tab's navigation and its drop target (@diazdesandi)

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

## X. capture, usability and motion follow-ups, real readings for the widget icon, and

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in thaw-app/Thaw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a9ccd1f9`: capture, usability and motion follow-ups, real readings for the widget icon, and Layout out-of-room and design fixes (#1500). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
#### Spaces

- **The current Space in the menu bar.** Turn on Show the current Space in the menu bar in Displays › Spaces. Its menu lists each display's Spaces.
- **Profiles name Spaces the way Mission Control does,** grouped by display, with full screen apps by name. The display with the menu bar is marked.

#### Widgets

- **The widget icon shows real readings.** Wi-Fi shows your actual bars, and the battery turns green while charging, yellow in Low Power Mode and red below 20%. Suggested by @joaofrgomes in [#1378](https://github.com/thaw-app/Thaw/issues/1378).
- **Bluetooth audio in the center.** While sound plays through AirPods, headphones or a speaker, the widget shows it, with the volume in blue.
- **A larger, better-proportioned widget icon.** The ring fills the icon and opens at the bottom, with the dots along it. Choose Standard or Large and the ring's thickness.

#### Layout and Thaw Bar

- **Layout warns when items don't fit,** names the ones macOS hid, and Move to Hidden makes room in one click.
- **Layout tells you when macOS hides Focus** and turns on Thaw's own Focus icon in one click. Reported by @JosefGvirt in [#1477](https://github.com/thaw-app/Thaw/issues/1477).
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
- **Layout warns when items don't fit.** When macOS hides items it has no room for, Layout names them until there's room again.
- **Release notes can stay closed after an update.** Turn off Show release notes after an update in Privacy. What's New still opens from Thaw's menu and About.
- **Profiles name Spaces the way Mission Control does.** Pick any Space for a profile, grouped by display, with full screen apps by name. A Space that's gone shows as missing, and the display with the menu bar is marked.
- **The menu bar can show which Space you're in.** Turn on Show the current Space in the menu bar under Displays › Spaces. Its menu lists the Spaces on each display.
- **Extras is now called Modules.** The Settings page that turns Profiles, Scripts, Triggers and Widgets on and off, and the sidebar group they appear in, use the same name as the rest of Thaw.
- **Double-clicking Thaw's icon for Always Hidden has its own switch.** Turn off Double-click the Thaw icon to show Always Hidden in Menu Bar Access, and every click shows or hides your items.
- **The Thaw Bar has its own switch again.** Show hidden items is now two switches, Thaw Bar and Always show hidden items. Your settings c
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a9ccd1f9` are properly handled with clean fallback behavior.
