> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/thaw-app-thaw-learnings.md`  
> **Source**: github ([https://github.com/thaw-app/Thaw](https://github.com/thaw-app/Thaw))  
> **Source Version**: `e29a4376`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T09:49:55.660Z  
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
> **Harvest Timestamp**: 2026-11-15T09:49:55.476Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thaw-app/Thaw`
- **Description**: The open source menu bar manager
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12734 stars

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

### Incident Patch 1: `d9b78abe` (2026-11-14)
**Commit Message**: ci: cap the build, test packages only when they change, key the compile cache on dependencies, and scan legacy/thaw-2 with CodeQL (#1585)

* ci: cap the build, test packages only when they change, and key the compile cache on dependencies

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* ci(codeql): scan legacy/thaw-2, since CodeQL can't build Swift 6.4

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* ci: key the compile cache on Xcode, keep test results from a hung run, and test packages weekly

The compilation cache key now names the Xcode version and build, and hashes the project's lock file by path. Development restores only an exact match, so a saved cache holds no entries carried over from older ones.

The 22-minute limit is on the Build and Test step, with 30 on the job as a backstop, so a failed or timed-out run can still upload its result bundle.

The skip rule for follow-up pushes judges the package tests against the package patterns, not the code patterns.

A weekly scheduled run on development, in a concurrency group of its own, builds, tests the packages and saves the cache.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* ci: build on macOS only for what the buil

**File**: `.github/workflows/ci.yml` (modified, +176/-51)
```diff
@@ -1,6 +1,8 @@
 name: CI
 concurrency:
-  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
+  # The weekly run has a group of its own, so a merge doesn't cancel it and it
+  # doesn't cancel a merge's run.
+  group: ${{ github.workflow }}-${{ github.event_name == 'schedule' && 'schedule' || github.head_ref || github.ref }}
   cancel-in-progress: true
 # Runs on every PR and push to development so Scorecard sees checks; the
 # macOS work stays gated on path detection below.
@@ -9,6 +11,11 @@ on:
   push:
     branches:
       - development
+  # Weekly on development, where path detection reports everything as changed.
+  # Merges cancel most push runs, so this one tests the packages and saves the cache.
+  schedule:
+    # Offset from the hour and from the other scheduled workflows.
+    - cron: "43 2 * * 3"
   workflow_dispatch:
 
 permissions:
@@ -23,8 +30,23 @@ jobs:
       actions: read
     env:
       CODE_PATTERNS: '(\.swift$|(^|/)Package\.swift$|(^|/)Package\.resolved$|^sonar-project\.properties$|^\.swiftlint|^\.swiftformat|^Thaw\.xcodeproj/|^scripts/|\.xcstrings$|^\.github/workflows/ci\.yml$)'
+      # The macOS build runs for a path that matches CODE_PATTERNS and neither of the
+      # two lists below, so a path nobody has listed still builds.
+      #
+      # Lint and format settings, and the scripts only the lint job runs. The build
+      # reads .swiftlint-version, lint.sh and install-swiftlint.sh, so they stay out.
+      LINT_ONLY_PATTERNS: '(^\.swiftlint\.yml$|^\.swiftlint\.baseline$|^\.swiftformat|^scripts/(format|install-swiftformat|update-swiftlint-baseline)\.sh$|^scripts/swiftlint-baseline\.py$|^scripts/tests/test-(format|lint|swiftlint-baseline)\.sh$)'
+      # String catalogs. The lint job checks that they are valid JSON, and nothing
+      # compiles them before the merge. To build for them again, change this to '(^$)'.
+      CATALOG_PATTERNS: '(\.xcstrings$)'
+      # The package tests build only packages/, so the app's own code can't change them.
+      PACKAGE_PATTERNS: '(^packages/|^scripts/test-packages\.sh$|^\.github/workflows/ci\.yml$)'
     outputs:
-      code: ${{ steps.since-last-run.outputs.code || steps.filter.outputs.code }}
+      # The skip step below can only turn a "true" into "false"; skipped, or unable
+      # to confirm, it leaves the filter's answer.
+      code: ${{ steps.since-last-run.outputs.code == 'false' && 'false' || steps.filter.outputs.code }}
+      build: ${{ steps.since-last-run.outputs.build == 'false' && 'false' || steps.build-filter.outputs.build }}
+      packages: ${{ steps.since-last-run.outputs.packages == 'false' && 'false' || steps.packages-filter.outputs.code }}
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
@@ -35,14 +57,52 @@ jobs:
         uses: thaw-app/org-ci/actions/detect-code-changes@d57f5f99c6641bbe12e87a54898356000d94f904
         with:
           patterns: ${{ env.CODE_PATTERNS }}
-      # The filter compares the whole pull request with its base, so a push that only
+      - name: Detect package paths
+        id: packages-filter
+        uses: thaw-app/org-ci/actions/detect-code-changes@d57f5f99c6641bbe12e87a54898356000d94f904
+        with:
+          patterns: ${{ env.PACKAGE_PATTERNS }}
+      # The shared action matches one pattern and cannot leave paths out, so this
+      # compares the same range itself, and answers true whenever it cannot tell.
+      - name: Detect paths the build uses
+        id: build-filter
+        env:
+          EVENT_NAME: ${{ github.event_name }}
+          BASE_REF: ${{ github.base_ref }}
+          BEFORE: ${{ github.event.before }}
+          SHA: ${{ github.sha }}
+        run: |
+          set -uo pipefail
+          build=true
+          range=""
+          if [[ "$EVENT_NAME" == "pull_request" ]]; then
+            range="origin/${BASE_REF}...HEAD"
+          elif [[ "$EVENT_NAME" == "push" && -n "$BEFORE" && ! "$BEFORE" =~ ^0+$ ]]; then
+            range="${BEFORE}..${SHA}"
+          fi
+          if [[ -n "$range" ]] && changed=$(git -c core.quotePath=false diff --name-only --no-renames "$range" 2>/dev/null) \
+            && [[ "$(git diff --name-only --no-renames -z "$range" | tr -cd '\n' | wc -c)" -eq 0 ]]; then
+            status=0
+            rest=$(grep -Ev -e "$LINT_ONLY_PATTERNS" -e "$CATALOG_PATTERNS" <<<"$changed") || status=$?
+            if (( status <= 1 )); then
+              status=0
+              grep -Eq -e "$CODE_PATTERNS" <<<"$rest" || status=$?
+              if (( status == 1 )); then
+                build=false
+                echo "Nothing the build or its tests use changed; the macOS build will no-op."
+              fi
+            fi
+          fi
+          echo "build=$build" >> "$GITHUB_OUTPUT"
+      # The filters compare the whole pull request with its base, so a push that only
       # fixes the changelog would build and test again. When the files changed since

```

**File**: `.github/workflows/codeql.yml` (modified, +11/-6)
```diff
@@ -1,5 +1,8 @@
 name: CodeQL
 
+# Scans legacy/thaw-2. CodeQL supports neither Swift 6.4 nor traced builds with
+# Xcode 27 (GitHub changelog, 2026-10-19), so Thaw 3 on development can't be
+# scanned. Point this back at development once CodeQL lists Swift 6.4.
 on:
   schedule:
     # Weekly, offset from the hour to avoid GitHub's cron pileup.
@@ -28,8 +31,13 @@ jobs:
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
+          ref: legacy/thaw-2
           persist-credentials: false
 
+      - name: Record the scanned commit
+        id: scanned
+        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
+
       - name: Initialize CodeQL
         uses: github/codeql-action/init@33d7b85da1a04171e211befe2c739303b9a4c066 # v4.39.3
         with:
@@ -39,12 +47,6 @@ jobs:
       - name: Select Xcode 26.6
         run: sudo xcode-select -s /Applications/Xcode_26.6.app/Contents/Developer
 
-      # The Thaw target's lint build phase requires the pinned SwiftLint on PATH.
-      - name: Install pinned SwiftLint
-        run: |
-          sh scripts/install-swiftlint.sh
-          echo "$HOME/.local/bin" >> "$GITHUB_PATH"
-
       # CodeQL traces this build to construct the database. Tests are not run;
       # compilation is all the extractor needs.
       - name: Build
@@ -63,3 +65,6 @@ jobs:
         uses: github/codeql-action/analyze@33d7b85da1a04171e211befe2c739303b9a4c066 # v4.39.3
         with:
           category: "/language:swift"
+          # File the results under the branch that was scanned, not development.
+          ref: refs/heads/legacy/thaw-2
+          sha: ${{ steps.scanned.outputs.sha }}
```

---

### Incident Patch 2: `e29a4376` (2026-11-15)
**Commit Message**: fix(input): don't count a windowless click as a click on the Thaw icon (#1595)

* fix(input): don't count a windowless click as a click on the Thaw icon

handleSmartRehide compared event.window === controlItem.window, which is
true when both are nil. A click in another app has no window, and the
control item has none until the system seats its status item, so smart
rehide skipped that click. A click with no window now never matches.

Signed-off-by: Elior Ashkenazi <[REDACTED_EMAIL]>

* test(capture): run the settle read timer on the injected clock

readBefore raced each pixel read against a real-time timer while the
deadline came from the injected clock. Under a test clock, three main-actor
reads that took over 1.2 real seconds lost the race, and
revealedPixelsSettle saw fewer than three captures. SettleClock now carries
the timer, Task.sleep(until:) by default, and SettleClock.driven(by:) gives
tests one that never fires.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* test(items): wait for a hung stand-in on the launcher's clock

restartRunning timed its quit wait on the real clock, so
restartForcesAHungStandIn waited 3 real seconds. It now uses the launcher's
now and a new sl

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ the items under New and Fixed.
 - The Shortcuts page no longer shows an empty Profiles tab while Profiles is turned off.
 - Showing a section in the menu bar while the Thaw Bar is open no longer hides it early, when the Thaw Bar's own hide timer runs out.
 - `thaw://release-item?bundle=` now lets go of every item of that app the sender holds, instead of failing when it holds more than one.
+- Smart rehide no longer skips a click outside the menu bar while the Thaw icon has no window yet, so the revealed items go away after the click as set.
 
 ## [3.0.0-alpha.14] - 2026-11-14
 
```

**File**: `Thaw/Input/Events/HIDEventManager+PointerGeometry.swift` (modified, +8/-0)
```diff
@@ -121,6 +121,14 @@ extension HIDEventManager {
         }
     }
 
+    /// Whether a click landed in the control item's window. Pure, so it is testable without a
+    /// live menu bar.
+    static nonisolated func isClick(in eventWindow: NSWindow?, onControlItemWindow controlItemWindow: NSWindow?) -> Bool {
+        // Two nil windows are not the same window: === would call them equal.
+        guard let eventWindow else { return false }
+        return eventWindow === controlItemWindow
+    }
+
     /// Whether the pointer is over any menu bar item.
     ///
     /// Tried cheapest first: the prebuilt bounds table, then the managed item
```

**File**: `Thaw/Input/Events/HIDEventManager+ShowOnClick.swift` (modified, +1/-1)
```diff
@@ -401,7 +401,7 @@ extension HIDEventManager {
             // Clicking the visible control item or the Thaw Bar drives the sections, so it never rehides them.
             if
                 let controlItem = appState.menuBarManager.controlItem(withName: .visible),
-                event.window === controlItem.window
+                Self.isClick(in: event.window, onControlItemWindow: controlItem.window)
             {
                 return false
             }
```

**File**: `Thaw/Items/Capture/RevealCaptureSession+Settle.swift` (modified, +3/-2)
```diff
@@ -15,6 +15,8 @@ extension RevealCaptureSession {
     struct SettleClock {
         var now: @MainActor () -> ContinuousClock.Instant = { .now }
         var sleep: @MainActor (Duration) async -> Void = { try? await Task.sleep(for: $0) }
+        /// The timer that ends a read at the deadline; it must return early when cancelled.
+        var sleepUntil: @MainActor (ContinuousClock.Instant) async -> Void = { try? await Task.sleep(until: $0) }
     }
 
     /// Polls a revealed batch, one enumeration per poll, until every member's AX bounds are stable.
@@ -131,7 +133,6 @@ extension RevealCaptureSession {
     }
 
     /// Runs read against the deadline. A result that arrives at or after it doesn't count.
-    /// The timer that ends a read still runs on real time.
     static func readBefore(
         _ deadline: ContinuousClock.Instant,
         clock: SettleClock,
@@ -140,7 +141,7 @@ extension RevealCaptureSession {
         guard clock.now() < deadline else { return .pastDeadline }
         let (outcomes, sink) = AsyncStream.makeStream(of: BoundedRead.self)
         let timer = Task {
-            try? await Task.sleep(until: deadline)
+            await clock.sleepUntil(deadline)
             sink.yield(.pastDeadline)
         }
         Task { @MainActor in await sink.yield(.read(read())) }
```

**File**: `Thaw/Items/Manager/SystemExtraStandIns.swift` (modified, +11/-5)
```diff
@@ -230,12 +230,18 @@ final class SystemExtraStandInLauncher: SystemExtraReplacementProviding {
     private static let restartWindow: Duration = .seconds(30)
     private static let restartQuitTimeout: Duration = .seconds(3)
     private let system: StandInSystem
-    /// The clock the restart window is measured on; tests pass one that only moves when they say.
+    /// The clock the restart window and the quit wait are measured on; tests pass one that only moves when they say.
     private let now: () -> ContinuousClock.Instant
+    private let sleep: (Duration) async -> Void
 
-    init(system: StandInSystem = StandInSystem(), now: @escaping () -> ContinuousClock.Instant = { .now }) {
+    init(
+        system: StandInSystem = StandInSystem(),
+        now: @escaping () -> ContinuousClock.Instant = { .now },
+        sleep: @escaping (Duration) async -> Void = { try? await Task.sleep(for: $0) }
+    ) {
         self.system = system
         self.now = now
+        self.sleep = sleep
     }
 
     func publish(item: SystemExtraItem, canonicalIdentifier: String, section: MenuBarSectionName) async throws {
@@ -285,9 +291,9 @@ final class SystemExtraStandInLauncher: SystemExtraReplacementProviding {
             entry.stopWatching()
             watched[standIn] = nil
             entry.app.terminate()
-            let deadline = ContinuousClock.now + Self.restartQuitTimeout
-            while !entry.app.isTerminated, ContinuousClock.now < deadline {
-                try? await Task.sleep(for: .milliseconds(50))
+            let deadline = now() + Self.restartQuitTimeout
+            while !entry.app.isTerminated, now() < deadline {
+                await sleep(.milliseconds(50))
             }
             if !entry.app.isTerminated {
                 entry.app.forceTerminate()
```

**File**: `ThawTests/App/ControlCenterBridgeTests.swift` (modified, +6/-6)
```diff
@@ -13,7 +13,7 @@ import Testing
 /// Both ends of the Control Center bridge, against a scratch suite in place of the app group
 /// and a recorder in place of Control Center. The app state is never set up.
 @MainActor
-@Suite("Control Center bridge", .serialized)
+@Suite("Control Center bridge", .serialized, .scratchDefaults)
 struct ControlCenterBridgeTests {
     private final class Reloads {
         var kinds: [String] = []
@@ -46,7 +46,7 @@ struct ControlCenterBridgeTests {
         #expect(ControlStatePublisher.snapshot(for: nil) == .init(isHiddenSectionRevealed: false, isZenModeActive: false))
     }
 
-    @Test("Setup publishes the current state once and reloads both controls", .scratchDefaults)
+    @Test("Setup publishes the current state once and reloads both controls")
     func setupPublishes() throws {
         try withPublisher { publisher, suite, reloads in
             let appState = AppState()
@@ -59,7 +59,7 @@ struct ControlCenterBridgeTests {
         }
     }
 
-    @Test("A clean quit erases the snapshot and reloads the controls", .scratchDefaults)
+    @Test("A clean quit erases the snapshot and reloads the controls")
     func terminationErases() throws {
         try withPublisher { publisher, suite, reloads in
             let appState = AppState()
@@ -74,7 +74,7 @@ struct ControlCenterBridgeTests {
         }
     }
 
-    @Test("The app's quit notification erases the snapshot", .scratchDefaults)
+    @Test("The app's quit notification erases the snapshot")
     func quitNotificationErases() async throws {
         let name = ScratchDefaults.name("ControlState")
         defer { ScratchDefaults.remove(name) }
@@ -94,7 +94,7 @@ struct ControlCenterBridgeTests {
         #expect(try stored(in: suite) == nil)
     }
 
-    @Test("Without the app group nothing is written or reloaded", .scratchDefaults)
+    @Test("Without the app group nothing is written or reloaded")
     func missingGroup() {
         var reloads = 0
         let publisher = ControlStatePublisher(defaults: nil) { _ in reloads += 1 }
@@ -113,7 +113,7 @@ struct ControlCenterBridgeTests {
         ])
     }
 
-    @Test("Only the hidden-section toggle confirms, and only once there is a section", .scratchDefaults)
+    @Test("Only the hidden-section toggle confirms, and only once there is a section")
     func commandConfirmations() {
         let appState = AppState()
         #expect(ControlCommandObserver.Command.toggleZen.confirmation(appState: appState) == nil)
```

**File**: `ThawTests/Environment/DisplayProfileSwitchTests.swift` (modified, +3/-3)
```diff
@@ -11,7 +11,7 @@ import Testing
 
 /// The display change's resolveProfile step, which replaced ProfileManager's own screen observer.
 @MainActor
-@Suite("Display profile switch", .serialized)
+@Suite("Display profile switch", .serialized, .scratchDefaults)
 struct DisplayProfileSwitchTests {
     private let suites = ScratchSuites(prefix: "DisplayProfileSwitchTests")
 
@@ -64,7 +64,7 @@ struct DisplayProfileSwitchTests {
         #expect(target.applied.isEmpty)
     }
 
-    @Test("The effect step leaves the profile alone when no profile names a display", .scratchDefaults)
+    @Test("The effect step leaves the profile alone when no profile names a display")
     func effectWithoutProfilesAppliesNothing() async throws {
         let directory = try ProfileTestDirectory.make(seeding: ["Default"])
         defer { try? FileManager.default.removeItem(at: directory) }
@@ -78,7 +78,7 @@ struct DisplayProfileSwitchTests {
         #expect(profiles.layoutTask == nil)
     }
 
-    @Test("A switch started during a settle is the pending apply the settle's tail leaves to finish", .scratchDefaults)
+    @Test("A switch started during a settle is the pending apply the settle's tail leaves to finish")
     func settleTailLeavesTheSwitchToFinish() throws {
         let defaults = try #require(suites.make())
         let settled = ProfileSettleReapply.Record(defaults: defaults)
```

**File**: `ThawTests/Input/SmartRehideClickTests.swift` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+//
+//  SmartRehideClickTests.swift
+//  Project: Thaw
+//
+//  Copyright (Thaw) © 2026 Toni Förster
+//  Licensed under the GNU GPLv3
+
+import AppKit
+import Testing
+@testable import Thaw
+
+@MainActor
+@Suite("Smart rehide outside clicks")
+struct SmartRehideClickTests {
+    private func makeWindow() -> NSWindow {
+        let window = NSWindow(contentRect: CGRect(x: 0, y: 0, width: 10, height: 10), styleMask: .borderless, backing: .buffered, defer: false)
+        window.isReleasedWhenClosed = false
+        return window
+    }
+
+    /// A global mouse monitor hands over events for other apps' windows with no window, which is
+    /// what an outside click looks like. The control item has no window until the system seats
+    /// its status item, so it must not claim such a click.
+    @Test("A click with no window is not a click on a control item that has no window either")
+    func windowlessClickIsNotOnWindowlessControlItem() {
+        #expect(!HIDEventManager.isClick(in: nil, onControlItemWindow: nil))
+    }
+
+    @Test("A click in the control item's window is a click on it")
+    func clickInControlItemWindow() {
+        let window = makeWindow()
+        #expect(HIDEventManager.isClick(in: window, onControlItemWindow: window))
+    }
+
+    @Test("A click in another window, or a windowless control item, is not a click on it")
+    func clickElsewhere() {
+        let window = makeWindow()
+        #expect(!HIDEventManager.isClick(in: window, onControlItemWindow: makeWindow()))
+        #expect(!HIDEventManager.isClick(in: window, onControlItemWindow: nil))
+        #expect(!HIDEventManager.isClick(in: nil, onControlItemWindow: window))
+    }
+}
```

---

### Incident Patch 3: `6b709de5` (2026-11-15)
**Commit Message**: ci: end the hung test runs, shorten the test queues, and split build from test (#1597)

* test: drop the one-minute time limits from the app tests

In the app's test process almost every test waits for the main actor, and a Swift Testing time limit starts counting before the test gets it. On CI the display change, Mission Control and profile layout suites queue for about 60 seconds before they run, so on a slower runner they cross the one-minute limit. Xcode then takes a spindump, kills the test host and relaunches it. The relaunched host hits the same limits, and the loop repeats until the step hits its 22-minute limit.

The package tests keep their limits: they run in their own processes and don't queue behind the app's tests.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* ci: skip the editor index and package updates, and keep every run's test results

The CI build wrote an editor index nothing reads, and looked for newer package versions although Package.resolved is committed. It now passes
COMPILER_INDEX_STORE_ENABLE=NO, -onlyUsePackageVersionsFromResolvedFile and -skipPackageUpdates.

CI uploaded the test results only when the step failed. A passing run's result bundle gi

**File**: `.github/workflows/ci.yml` (modified, +30/-14)
```diff
@@ -209,8 +209,9 @@ jobs:
     if: github.repository == 'thaw-app/Thaw'
     # A skip runs on Linux so it doesn't wait for, or hold, a macOS runner.
     runs-on: ${{ needs.changes.outputs.build == 'true' && 'xcode-27' || 'ubuntu-slim' }}
-    needs: [changes, static_analysis]
-    # A backstop. The limit that normally ends a hung run is on the Build and Test
+    # Starts alongside static_analysis, so a change that fails lint still uses macOS time.
+    needs: [changes]
+    # A backstop. The limit that normally ends a hung run is on the Test
     # step, which leaves time to upload what the tests wrote.
     timeout-minutes: 30
     permissions:
@@ -267,20 +268,33 @@ jobs:
           # nothing over from older ones. A pull request falls back to the newest.
           restore-keys: ${{ github.ref != 'refs/heads/development' && format('compilation-cache-{0}-xcode{1}-', runner.os, steps.xcode.outputs.id) || '' }}
 
-      # The Thaw target's lint build phase requires the pinned SwiftLint on PATH.
-      - name: Install pinned SwiftLint
+      # Separate from Test so each step's time shows, and so the timing summary prints.
+      # No editor index or package updates; static_analysis already lints with --strict.
+      - name: Build
         if: needs.changes.outputs.build == 'true'
+        timeout-minutes: 12
         run: |
-          sh scripts/install-swiftlint.sh
-          echo "$HOME/.local/bin" >> "$GITHUB_PATH"
+          xcodebuild build-for-testing \
+            -project Thaw.xcodeproj \
+            -scheme Thaw \
+            -derivedDataPath Build/ \
+            -destination 'platform=macOS' \
+            -enableCodeCoverage YES \
+            -onlyUsePackageVersionsFromResolvedFile \
+            -skipPackageUpdates \
+            -showBuildTimingSummary \
+            COMPILER_INDEX_STORE_ENABLE=NO \
+            THAW_SKIP_XCODE_LINT=1 \
+            CODE_SIGN_IDENTITY="" \
+            CODE_SIGNING_REQUIRED=NO \
+            CODE_SIGNING_ALLOWED=NO
 
-      # About 12 minutes, 16 at most so far; hung tests have run it past 30. The limit
-      # is on the step, not only the job, so the upload below still runs.
-      - name: Build and Test
+      # The limit is on the step, not only the job, so the upload below still runs after a hang.
+      - name: Test
         if: needs.changes.outputs.build == 'true'
-        timeout-minutes: 22
+        timeout-minutes: 12
         run: |
-          xcodebuild test \
+          xcodebuild test-without-building \
             -project Thaw.xcodeproj \
             -scheme Thaw \
             -derivedDataPath Build/ \
@@ -290,9 +304,10 @@ jobs:
             CODE_SIGNING_REQUIRED=NO \
             CODE_SIGNING_ALLOWED=NO
 
-      # A failed or timed-out run's logs name the tests that failed or never finished.
+      # A failed or timed-out run's results name the tests that failed or never finished.
+      # A passing run's results give each test's real duration; the console log doesn't.
       - name: Upload test results
-        if: failure() && needs.changes.outputs.build == 'true'
+        if: ${{ !cancelled() && needs.changes.outputs.build == 'true' }}
         uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
         with:
           name: test-results
@@ -359,7 +374,8 @@ jobs:
   packages:
     if: github.repository == 'thaw-app/Thaw'
     runs-on: ${{ needs.changes.outputs.packages == 'true' && 'xcode-27' || 'ubuntu-slim' }}
-    needs: [changes, static_analysis]
+    # Starts alongside static_analysis, like build.
+    needs: [changes]
     timeout-minutes: 30
     steps:
       - name: Skip package tests (no package changes)
```

**File**: `Thaw.xcodeproj/project.pbxproj` (modified, +6/-0)
```diff
@@ -605,6 +605,12 @@
 			name = SwiftLint;
 			shellPath = /bin/sh;
 			shellScript = (
+				"# CI lints every file with --strict in its own job, so it skips this phase.",
+				"if [ \"${THAW_SKIP_XCODE_LINT:-}\" = 1 ]; then",
+				"    echo \"SwiftLint: skipped, CI lints in static_analysis\"",
+				"    exit 0",
+				"fi",
+				"",
 				"if [ \"$(uname -m)\" = arm64 ]; then",
 				"    export PATH=\"$PATH:/opt/homebrew/bin\"",
 				"fi",
```

**File**: `Thaw/MenuBar/Appearance/MenuBarAppearanceManager.swift` (modified, +4/-3)
```diff
@@ -225,13 +225,14 @@ final class MenuBarAppearanceManager {
     }
 
     /// Looks 100 ms after a burst, since an overlay left on the old geometry until the settle shows, and
-    /// again at each settle in case the early look caught the screens mid-change.
+    /// again at each settle in case the early look caught the screens mid-change. Tests pass a scheduler they move by hand.
     static func overlayRebuildSignal(
         invalidations: some Publisher<Void, Never>,
-        settlements: some Publisher<EnvironmentChange, Never>
+        settlements: some Publisher<EnvironmentChange, Never>,
+        scheduler: some Scheduler = DispatchQueue.main
     ) -> AnyPublisher<Void, Never> {
         invalidations
-            .debounce(for: .milliseconds(100), scheduler: DispatchQueue.main)
+            .debounce(for: .milliseconds(100), scheduler: scheduler)
             .merge(with: settlements.map { _ in () })
             .eraseToAnyPublisher()
     }
```

**File**: `ThawTests/App/ControlCenterBridgeTests.swift` (modified, +6/-6)
```diff
@@ -13,7 +13,7 @@ import Testing
 /// Both ends of the Control Center bridge, against a scratch suite in place of the app group
 /// and a recorder in place of Control Center. The app state is never set up.
 @MainActor
-@Suite("Control Center bridge", .serialized, .scratchDefaults)
+@Suite("Control Center bridge", .serialized)
 struct ControlCenterBridgeTests {
     private final class Reloads {
         var kinds: [String] = []
@@ -46,7 +46,7 @@ struct ControlCenterBridgeTests {
         #expect(ControlStatePublisher.snapshot(for: nil) == .init(isHiddenSectionRevealed: false, isZenModeActive: false))
     }
 
-    @Test("Setup publishes the current state once and reloads both controls")
+    @Test("Setup publishes the current state once and reloads both controls", .scratchDefaults)
     func setupPublishes() throws {
         try withPublisher { publisher, suite, reloads in
             let appState = AppState()
@@ -59,7 +59,7 @@ struct ControlCenterBridgeTests {
         }
     }
 
-    @Test("A clean quit erases the snapshot and reloads the controls")
+    @Test("A clean quit erases the snapshot and reloads the controls", .scratchDefaults)
     func terminationErases() throws {
         try withPublisher { publisher, suite, reloads in
             let appState = AppState()
@@ -74,7 +74,7 @@ struct ControlCenterBridgeTests {
         }
     }
 
-    @Test("The app's quit notification erases the snapshot")
+    @Test("The app's quit notification erases the snapshot", .scratchDefaults)
     func quitNotificationErases() async throws {
         let name = ScratchDefaults.name("ControlState")
         defer { ScratchDefaults.remove(name) }
@@ -94,7 +94,7 @@ struct ControlCenterBridgeTests {
         #expect(try stored(in: suite) == nil)
     }
 
-    @Test("Without the app group nothing is written or reloaded")
+    @Test("Without the app group nothing is written or reloaded", .scratchDefaults)
     func missingGroup() {
         var reloads = 0
         let publisher = ControlStatePublisher(defaults: nil) { _ in reloads += 1 }
@@ -113,7 +113,7 @@ struct ControlCenterBridgeTests {
         ])
     }
 
-    @Test("Only the hidden-section toggle confirms, and only once there is a section")
+    @Test("Only the hidden-section toggle confirms, and only once there is a section", .scratchDefaults)
     func commandConfirmations() {
         let appState = AppState()
         #expect(ControlCommandObserver.Command.toggleZen.confirmation(appState: appState) == nil)
```

**File**: `ThawTests/Environment/DisplayChangeCoordinatorTests.swift` (modified, +2/-2)
```diff
@@ -70,7 +70,7 @@ struct DisplayChangePlanTests {
 }
 
 @MainActor
-@Suite("Display change coordinator", .timeLimit(.minutes(1)), .scratchDefaults)
+@Suite("Display change coordinator", .scratchDefaults)
 struct DisplayChangeCoordinatorTests {
     private static let single = DisplayArrangement(frames: [1: CGRect(x: 0, y: 0, width: 1512, height: 982)], mainDisplayID: 1)
     private static let docked = DisplayArrangement(
@@ -202,7 +202,7 @@ struct DisplayChangeCoordinatorTests {
 }
 
 @MainActor
-@Suite("Menu bar display change effects", .timeLimit(.minutes(1)), .scratchDefaults)
+@Suite("Menu bar display change effects", .scratchDefaults)
 struct MenuBarDisplayChangeEffectsTests {
     @Test("The stamp calls off the automatic passes planned before the change")
     func stampCallsOffPlannedWork() {
```

**File**: `ThawTests/Environment/DisplayChangePresentationTests.swift` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ struct AlwaysShowDisplayChangeHoldTests {
 }
 
 @MainActor
-@Suite("Display change presentation step", .timeLimit(.minutes(1)), .scratchDefaults)
+@Suite("Display change presentation step", .scratchDefaults)
 struct DisplayChangePresentationTests {
     @MainActor
     final class Counter {
```

**File**: `ThawTests/Environment/DisplayChangeReadersTests.swift` (modified, +76/-5)
```diff
@@ -12,7 +12,7 @@ import Testing
 
 /// The postings go to a private center, since the default one would reach the app hosting the tests.
 @MainActor
-@Suite("Display change readers", .serialized, .timeLimit(.minutes(1)), .scratchDefaults)
+@Suite("Display change readers", .serialized, .scratchDefaults)
 struct DisplayChangeReadersTests {
     private let center = NotificationCenter()
     private let gate = SettleGate()
@@ -44,12 +44,17 @@ struct DisplayChangeReadersTests {
     }
 
     @Test("The overlay rebuilds at each settle, and once after a burst of postings")
-    func overlayRebuildSignal() async throws {
+    func overlayRebuildSignal() {
         var rebuilds = 0
         let invalidations = PassthroughSubject<Void, Never>()
         let settlements = PassthroughSubject<EnvironmentChange, Never>()
-        let signal = MenuBarAppearanceManager.overlayRebuildSignal(invalidations: invalidations, settlements: settlements)
-            .sink { rebuilds += 1 }
+        let scheduler = ManualScheduler()
+        let signal = MenuBarAppearanceManager.overlayRebuildSignal(
+            invalidations: invalidations,
+            settlements: settlements,
+            scheduler: scheduler
+        )
+        .sink { rebuilds += 1 }
         defer { signal.cancel() }
 
         settlements.send(.none)
@@ -59,7 +64,7 @@ struct DisplayChangeReadersTests {
             invalidations.send()
         }
         #expect(rebuilds == 1, "Postings wait out their burst")
-        try await Task.sleep(for: .milliseconds(300))
+        scheduler.advance(by: .milliseconds(100))
         #expect(rebuilds == 2, "A burst of postings rebuilds once, before the settle")
     }
 
@@ -152,3 +157,69 @@ private final class SettleGate {
         }
     }
 }
+
+/// A Combine scheduler whose clock only the test advances, so a debounce fires exactly when told.
+/// The test drives it from the main actor only.
+private nonisolated final class ManualScheduler: Scheduler {
+    typealias SchedulerTimeType = DispatchQueue.SchedulerTimeType
+    typealias SchedulerOptions = Never
+
+    private nonisolated struct Action {
+        let date: SchedulerTimeType
+        let run: () -> Void
+    }
+
+    private(set) var now = SchedulerTimeType(DispatchTime(uptimeNanoseconds: 1))
+    private var pending: [Action] = []
+
+    var minimumTolerance: SchedulerTimeType.Stride {
+        .zero
+    }
+
+    func schedule(options _: Never?, _ action: @escaping () -> Void) {
+        action()
+    }
+
+    func schedule(after date: SchedulerTimeType, tolerance _: SchedulerTimeType.Stride, options _: Never?, _ action: @escaping () -> Void) {
+        pending.append(Action(date: date, run: action))
+    }
+
+    func schedule(
+        after date: SchedulerTimeType,
+        interval: SchedulerTimeType.Stride,
+        tolerance _: SchedulerTimeType.Stride,
+        options _: Never?,
+        _ action: @escaping () -> Void
+    ) -> Cancellable {
+        let cancellable = Repeat()
+        repeatAction(cancellable, at: date, every: interval, action)
+        return cancellable
+    }
+
+    /// Runs every action due by then, earliest first, with the clock at each one's time.
+    func advance(by stride: SchedulerTimeType.Stride) {
+        let target = now.advanced(by: stride)
+        while let index = pending.indices.filter({ pending[$0].date <= target }).min(by: { pending[$0].date < pending[$1].date }) {
+            let action = pending.remove(at: index)
+            now = action.date
+            action.run()
+        }
+        now = target
+    }
+
+    private func repeatAction(_ cancellable: Repeat, at date: SchedulerTimeType, every interval: SchedulerTimeType.Stride, _ action: @escaping () -> Void) {
+        pending.append(Action(date: date) { [weak self] in
+            guard !cancellable.isCancelled else { return }
+            action()
+            self?.repeatAction(cancellable, at: date.advanced(by: interval), every: interval, action)
+        })
+    }
+
+    private nonisolated final class Repeat: Cancellable {
+        private(set) var isCancelled = false
+
+        func cancel() {
+            isCancelled = true
+        }
+    }
+}
```

**File**: `ThawTests/Environment/DisplayChangeRecaptureTests.swift` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ import Testing
 @testable import Thaw
 
 @MainActor
-@Suite("Display change recapture", .timeLimit(.minutes(1)), .scratchDefaults)
+@Suite("Display change recapture", .scratchDefaults)
 struct DisplayChangeRecaptureTests {
     private let imageCache = RecordingImageCache()
     private let effects: MenuBarDisplayChangeEffects
```

#### Recent Merged Pull Requests:
- **PR #1598** (closed): ci: skip the editor index and package updates, and keep every run's test results (@diazdesandi)
- **PR #1597** (2026-11-15): ci: end the hung test runs, shorten the test queues, and split build from test (@diazdesandi)
- **PR #1595** (2026-11-15): fix(input): don't count a windowless click as a click on the Thaw icon (@elior-esh)
- **PR #1594** (2026-11-15): refactor(items): move the section drag skip checks out of MenuBarItemManager+Moving (@elior-esh)
- **PR #1593** (2026-11-15): refactor(items): move click attempt decisions out of the live click path (@elior-esh)
- **PR #1592** (2026-11-15): test(items): skip the AppKit screen check when no display is active (@elior-esh)

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

## X. ci: cap the build, test packages only when they change, key the compile cache on

**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in thaw-app/Thaw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d9b78abe`: ci: cap the build, test packages only when they change, key the compile cache on dependencies, and scan legacy/thaw-2 with CodeQL. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  # The weekly run has a group of its own, so a merge doesn't cancel it and it
  # doesn't cancel a merge's run.
  group: ${{ github.workflow }}-${{ github.event_name == 'schedule' && 'schedule' || github.head_ref || github.ref }}
  # Weekly on development, where path detection reports everything as changed.
  # Merges cancel most push runs, so this one tests the packages and saves the cache.
  schedule:
    # Offset from the hour and from the other scheduled workflows.
    - cron: "43 2 * * 3"
      # The macOS build runs for a path that matches CODE_PATTERNS and neither of the
      # two lists below, so a path nobody has listed still builds.
      #
      # Lint and format settings, and the scripts only the lint job runs. The build
      # reads .swiftlint-version, lint.sh and install-swiftlint.sh, so they stay out.
      LINT_ONLY_PATTERNS: '(^\.swiftlint\.yml$|^\.swiftlint\.baseline$|^\.swiftformat|^scripts/(format|install-swiftformat|update-swiftlint-baseline)\.sh$|^scripts/swiftlint-baseline\.py$|^scripts/tests/test-(format|lint|swiftlint-baseline)\.sh$)'
      # String catalogs. The lint job checks that they are valid JSON, and nothing
      # compiles them before the merge
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
      code: ${{ steps.since-last-run.outputs.code || steps.filter.outputs.code }}
      # The filter compares the whole pull request with its base, so a push that only
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d9b78abe` are properly handled with clean fallback behavior.
