# Forensic Learning Record (Deep Inspection): Louis-CFM/coucou

> **Canonical Artifact**: `07_PROJECT_LEARNING/louis-cfm-coucou-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Louis-CFM/coucou](https://github.com/Louis-CFM/coucou))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:18:36.962Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Louis-CFM/coucou`
- **Description**: A tiny friend in your Mac's notch and on your iPhone that keeps an eye on your AI coding agents: Claude Code, Codex, Cursor, Gemini CLI, Antigravity and more. Approve from the notch or your Lock Screen.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3723 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `NotchBuddy/Sources/App/AppState.swift`
```
import Foundation
import SwiftUI
import Combine


@MainActor
final class AppState: ObservableObject {
    static let shared = AppState()

    // Island state
    @Published var mode: IslandMode = .hidden
    @Published var view: IslandView = .overview

    // Tasks
    @Published var tasks: [AgentTask] = []
    @Published var focusId: String? = nil

    // Bot state override
    @Published var stateOverride: BotState? = nil

    // Real notch dimensions (set by IslandWindowController on launch)
    var notchWidth:  CGFloat = IslandConst.notchWidth
    var notchHeight: CGFloat = IslandConst.notchHeight
    var hasNotch = true

    // Last app active before NotchBuddy (for window context capture)
    var lastExternalApp: NSRunningApplication? = nil

    // Bot drag-attach state (hides original bot while ghost follows cursor)
    @Published var isDraggingBot: Bool = false

    // Desktop Mochi: true while Mochi lives on the desktop instead of the notch
    @Published var mochiOnDesktop: Bool = false

    // Mouse tracking
    var mousePosition: CGPoint = .zero
    var lastMouseMove: Date = .now
    var lastActivity: Date = .now
    var isPresent: Bool = true

    // Pinned (alerts that stay open, never auto-close)
    var isPinned: Bool = false

    // Keyboard navigation — index of the selected item within the current card's list (nil = none)
    @Published var cardSelection: Int? = nil
    // Number of navigable items in the card currently on screen (0 = no list)
    @Published var cardItemCount: Int = 0

    // Upload progress (0-1) — set to 1.0 only at completion; animation is time-based
    @Published var uploadProgress: Double = 0

    // Upload animation timing (non-published — TimelineViews read these directly)
    var uploadStartTime: Date?
    var uploadDuration: Double = 2.4

    // File drag-over state (mailbox morph glow + mouth spring)
    @Published var fileDragOver: Bool = false

    // Sound enabled — persisted
    @Published var soundEnabled: Bool = true {
        didSet { UserDefaults.standard.set(soundEnabled, forKey: "soundEnabled") }
    }

    // Mochi outfit selection — persisted
    @Published var mochiOutfitSelection: Outfit = .auto {
        didSet { Outfit.stored = mochiOutfitSelection }
    }
    // Transient: outfit preview while hovering in wardrobe (overrides resolvedOutfit in BotCanvasView)
    var wardrobePreviewOutfit: Outfit? = nil
    // Per-day seasonal cache — avoids recomputing Easter and date math on every frame
    private var _seasonalCache: (dayOfYear: Int, year: Int, outfit: Outfit)?
    var resolvedOutfit: Outfit {
        if let preview = wardrobePreviewOutfit { return preview }
        guard mochiOutfitSelection == .auto else { return mochiOutfitSelection }
        let cal = Calendar.current
        let now = Date()
        let day  = cal.ordinality(of: .day, in: .year, for: now) ?? 0
        let year = cal.component(.year, from: now)
        if let c = _seasonalCache, c.dayOfYear == day && c.year == year { return c.outfit }
        let outfit = Outfit.seasonal(for: now, calendar: cal)
        _seasonalCache = (dayOfYear: day, year: year, outfit: outfit)
        return outfit
    }

    // Claude model used by the chat and the search — persisted
    static let defaultClaudeModel = "claude-sonnet-4-6"
    @Published var claudeModel: String = AppState.defaultClaudeModel {
        didSet { UserDefaults.standard.set(claudeModel, forKey: "claudeModel") }
    }

    // In-chat provider + model — picked via the model selector in the prompt view
    @Published var chatProvider: ChatProvider = .anthropic {
        didSet { UserDefaults.standard.set(chatProvider.rawValue, forKey: "chatProvider") }
    }
    @Published var googleChatModel: String = ChatProvider.google.defaultModel {
        didSet { UserDefaults.standard.set(googleChatModel, forKey: "googleChatModel") }
    }
    @Published var openAIChatModel: String = ChatProvider.openai.defaultModel {
        didSet { UserDefaults.standard.set(openAIChatModel, forKey: "openAIChatModel") }
    }
    @Published var ollamaChatModel: String = ChatProvider.ollama.defaultModel {
        didSet { UserDefaults.standard.set(ollamaChatModel, forKey: "ollamaChatModel") }
    }
    @Published var lmstudioChatModel: String = ChatProvider.lmstudio.defaultModel {
        didSet { UserDefaults.standard.set(lmstudioChatModel, forKey: "lmstudioChatModel") }
    }
    @Published var ollamaServerURL: String = "" {
        didSet { UserDefaults.standard.set(ollamaServerURL, forKey: "ollamaServerURL") }
    }
    @Published var lmstudioServerURL: String = "" {
        didSet { UserDefaults.standard.set(lmstudioServerURL, forKey: "lmstudioServerURL") }
    }

    // The always-on workspace pill (default: VS Code). Persisted.
    @Published var mainPillId: String = PillCatalog.defaultMainPillId {
        didSet { UserDefaults.standard.set(mainPillId, forKey: "mainPill") }
    }

    // Dynamically fetched model lists for the in-chat picker (keyed by provider)
    @Published var fetchedProviderModels: [ChatProvider: [(id: String, label: String)]] = [:]
    @Published var providerModelFetchError: [ChatProvider: String] = [:]
    @Published var loadingProviderModels: Set<ChatProvider> = []

    /// Fetches models for `provider` if not already loaded or loading.
    /// Sets `providerModelFetchError` if the key is absent or the request fails.
    func fetchModelsIfNeeded(for provider: ChatProvider) {
        guard !loadingProviderModels.contains(provider),
              fetchedProviderModels[provider] == nil else { return }
        // Local providers: fetch from server URL (no API key needed)
        if provider.isLocal {
            let baseURL = provider == .ollama ? ollamaServerURL : lmstudioServerURL
            let normalised = LocalChat.normaliseURL(baseURL)
            guard !normalised.isEmpty else {
                providerModelFetchError[provider] = provider == .ollama
                    ? "Connect Ollama in Settings → Chat first."
                    : "Connect LM Studio in Settings → Chat first."
                return
            }
            loadingProviderModels.insert(provider)
            providerModelFetchError.removeValue(forKey: provider)
            Task {
                let result = await LocalChat.fetchModelsResult(baseURL: normalised)
                loadingProviderModels.remove(provider)
                switch result {
                case .success(let models) where models.isEmpty:
                    providerModelFetchError[provider] = provider == .ollama
                        ? "No models yet. Download one in Ollama first."
                        : "No models yet. Download one in LM Studio first."
                case .success(let models):
                    fetchedProviderModels[provider] = models
                    let current = provider == .ollama ? ollamaChatModel : lmstudioChatModel
                    if !models.contains(where: { $0.id == current }) {
                        let first = models.first!.id
                        if provider == .ollama { ollamaChatModel = first }
                        else                   { lmstudioChatModel = first }
                    }
                case .failure:
                    providerModelFetchError[provider] = "Cannot reach \(normalised). Is the server running?"
                }
            }
            return
        }
        // Remote providers: require API key
        guard let apiKey = KeychainStore.shared.get(provider.keychainKey), !apiKey.isEmpty else {
            providerModelFetchError[provider] = "No API key — add it in Settings."
            return
        }
        loadingProviderModels.insert(provider)
        providerModelFetchError.removeValue(forKey: provider)
        Task {
            let models: [(id: String, label: String)]
            switch provider {
            case .anthropic: models = await ClaudeService.fetchModels(apiKey: apiKey)
            case .google:    models = await ClaudeService.fetchGoogleModels(apiKey: apiKey)
            case .openai:    models = await ClaudeService.fetchOpenAIModels(apiKey: apiKey)
            case .ollama, .lmstudio: models = []  // handled above
            }
            loadingProviderModels.remove(provider)
            if models.isEmpty {
                providerModelFetchError[provider] = "Failed to load models. Check your API key."
            } else {
                fetchedProviderModels[provider] = models
                switch provider {
                case .anthropic:
                    if !models.contains(where: { $0.id == claudeModel }) {
                        claudeModel = models.first(where: { $0.id.contains("sonnet") })?.id ?? models.first!.id
                    }
                case .google:
                    if !models.contains(where: { $0.id == googleChatModel }) {
                        googleChatModel = models.first(where: { $0.id.contains("flash") })?.id ?? models.first!.id
                    }
                case .openai:
                    if !models.contains(where: { $0.id == openAIChatModel }) {
                        openAIChatModel = models.first(where: { $0.id.contains("mini") })?.id ?? models.first!.id
                    }
                case .ollama, .lmstudio: break
                }
            }
        }
    }

    /// The model currently active for chat (provider-aware).
    var activeChatModel: String {
        switch chatProvider {
        case .anthropic: return claudeModel
        case .google:    return googleChatModel
        case .openai:    return openAIChatModel
        case .ollama:    return ollamaChatModel
        case .lmstudio:  return lmstudioChatModel
        }
    }

    // Sound volume (0–0.2) — persisted, synced to SoundEngine
    @Published var soundVolume: Double = 0.12 {
        didSet {
            UserDefaults.standard.set(soundVolume, forKey: "soundVolume")
            SoundEngine.shared.volume = Float(soundVolume)
        }
  
```

### Core Architecture Module: `NotchBuddy/Sources/App/HookServer.swift`
```
import Foundation
import Darwin
import AppKit
import SwiftUI
import CryptoKit

// MARK: - HookServer
// Listens on a Unix domain socket for events from nb-hook (Claude Code hooks).
// Thread-safe: socket I/O on background threads, state updates dispatched to main queue.

final class HookServer: @unchecked Sendable {
    static let shared = HookServer()

    // Support directory paths
    static var supportDir: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("NotchBuddy")
    }
    static var socketPath: String {
        #if APPSTORE
        // Container home root keeps path ≤ 103 bytes (sun_path limit on macOS is 104 incl. NUL)
        // /Users/louis/Library/Containers/fr.louisraille.Coucou/Data/nb.sock = 66 bytes ✓
        return NSHomeDirectory() + "/nb.sock"
        #else
        return supportDir.appendingPathComponent("nb.sock").path
        #endif
    }
    // hookScriptPath is only used by the non-App Store build.
    // App Store build derives the command from the panel-selected claudeURL in buildHooksData(claudeURL:).
    static var hookScriptPath: String { supportDir.appendingPathComponent("nb-hook").path }

    // No approval blocking state — notch is notification-only, user answers in VS Code

    private static let maxPayload = 1_048_576          // 1 MB — reject oversized messages
    private static let receiveTimeoutSeconds: Int = 5   // SO_RCVTIMEO on client sockets
    private static let maxConnections = 32              // concurrent connection ceiling

    private var serverFD: Int32 = -1
    private let connectionLock = NSLock()
    private var connectionCount = 0
    private var pendingApprovalFD: Int32 = -1         // held open while user decides
    private var approvalFDSource: (any DispatchSourceRead)? = nil  // monitors pendingApprovalFD
    private var pendingQuestionFD: Int32 = -1         // held open while user answers AskUserQuestion
    private var questionFDSource: (any DispatchSourceRead)? = nil  // monitors pendingQuestionFD
    private var questionPillId: String = ""           // pill that owns the pending question
    private var focusBeforeQuestion: String? = nil    // saved focus to restore after question
    private var activeSessionId: String? = nil        // current Claude Code session
    private var focusBeforeApproval: String? = nil    // saved focus to restore after approval

    private init() {}

    // MARK: - Approval fd helpers

    @MainActor
    private func cancelApprovalFDSource() {
        approvalFDSource?.cancel()
        approvalFDSource = nil
    }

    /// Cancels the approval fd source (which closes the fd via its cancel handler), shows a
    /// 3-second note, clears approval state, then collapses the island.
    @MainActor
    private func dismissApprovalCard(note: String) {
        // cancelApprovalFDSource() triggers the cancel handler which closes the fd.
        // Never close the fd here directly — Apple requires it to happen in the cancel handler.
        cancelApprovalFDSource()
        pendingApprovalFD = -1
        let state = AppState.shared
        let pillId = state.pendingApproval?.pillId ?? "integration_claude"
        state.pendingApproval = nil
        state.isPinned = false
        state.updateTask(id: pillId, state: .working)
        clearPillBadge(id: pillId)
        // Restore focus to the pill that was focused before the approval card appeared.
        if let prev = focusBeforeApproval {
            focusBeforeApproval = nil
            if state.focusId == pillId, state.tasks.contains(where: { $0.id == prev }) {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) { state.focusId = prev }
            }
        }
        state.noteMessage = note
        state.view = .note
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            NotificationCenter.default.post(name: .islandCollapse, object: nil)
        }
    }

    // MARK: - Question fd helpers

    @MainActor
    private func cancelQuestionFDSource() {
        questionFDSource?.cancel()
        questionFDSource = nil
    }

    @MainActor
    private func dismissQuestionCard(note: String) {
        cancelQuestionFDSource()
        pendingQuestionFD = -1
        let state = AppState.shared
        let pillId = questionPillId
        state.pendingQuestion = nil
        state.isPinned = false
        state.updateTask(id: pillId, state: .working)
        clearPillBadge(id: pillId)
        if let prev = focusBeforeQuestion {
            focusBeforeQuestion = nil
            if state.focusId == pillId, state.tasks.contains(where: { $0.id == prev }) {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) { state.focusId = prev }
            }
        }
        if !note.isEmpty {
            state.noteMessage = note
            state.view = .note
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                NotificationCenter.default.post(name: .islandCollapse, object: nil)
            }
        } else {
            state.view = state.tasks.isEmpty ? .empty : .overview
        }
    }

    /// Called by QuestionView. Sends answers JSON and cleans up.
    @MainActor
    func sendQuestionAnswers(_ answers: [String: Any]) {
        let fd = pendingQuestionFD
        pendingQuestionFD = -1
        let source = questionFDSource
        questionFDSource = nil
        if fd >= 0, let data = try? JSONSerialization.data(withJSONObject: ["permissionDecision": "answer", "answers": answers], options: .withoutEscapingSlashes),
           let json = String(data: data, encoding: .utf8) {
            Task.detached { [weak self] in
                self?.sendLine(fd: fd, text: json)
                DispatchQueue.main.async { source?.cancel() }
            }
        } else {
            source?.cancel()
        }
        dismissQuestionCard(note: "")
    }

    /// Called by QuestionView.onDisappear — card left screen without an explicit answer.
    /// Sends "ask" immediately to unblock nb-hook; does NOT navigate (view already changed).
    @MainActor
    func releaseQuestionFD() {
        guard pendingQuestionFD >= 0 else { return }
        let fd = pendingQuestionFD
        pendingQuestionFD = -1
        let source = questionFDSource
        questionFDSource = nil
        AppState.shared.pendingQuestion = nil
        Task.detached { [weak self] in
            self?.sendLine(fd: fd, text: #"{"permissionDecision":"ask"}"#)
            DispatchQueue.main.async { source?.cancel() }
        }
    }

    /// Called by QuestionView "Reply in terminal" button.
    @MainActor
    func sendQuestionAsk() {
        let fd = pendingQuestionFD
        pendingQuestionFD = -1
        let source = questionFDSource
        questionFDSource = nil
        if fd >= 0 {
            Task.detached { [weak self] in
                self?.sendLine(fd: fd, text: #"{"permissionDecision":"ask"}"#)
                DispatchQueue.main.async { source?.cancel() }
            }
        } else {
            source?.cancel()
        }
        dismissQuestionCard(note: "")
    }

    /// Returns the tool_input serialized as sorted-keys JSON, "" if absent or empty.
    /// Same computation used in processPermissionRequest and processEvent to match PostToolUse.
    private static func approvalInputKey(_ input: [String: Any]) -> String {
        guard !input.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: input, options: .sortedKeys),
              let str = String(data: data, encoding: .utf8) else { return "" }
        return str
    }

    // MARK: - Start

    func start() {
        // Ensure support directory exists (mode 0700 — not world-readable)
        let dir = Self.supportDir
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? FileManager.default.setAttributes([.posixPermissions: 0o700 as NSNumber], ofItemAtPath: dir.path)
        #if !APPSTORE
        installHookScript()
        #endif
        Thread.detachNewThread { self.serverThread() }
    }

    // MARK: - Socket server (background thread)

    private func serverThread() {
        let path = Self.socketPath
        // sun_path on macOS is 104 bytes including the NUL terminator → max 103 usable bytes
        let maxSunPathBytes = MemoryLayout<sockaddr_un>.size - MemoryLayout<sa_family_t>.size - 1
        guard path.utf8.count <= maxSunPathBytes else {
            NSLog("HookServer: socket path too long (\(path.utf8.count) bytes, max \(maxSunPathBytes)): \(path)")
            return
        }
        try? FileManager.default.removeItem(atPath: path)

        let fd = socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else { return }
        serverFD = fd

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let cpath = Array(path.utf8CString)
        withUnsafeMutableBytes(of: &addr.sun_path) { raw in
            for (i, c) in cpath.enumerated() where i < raw.count { raw[i] = UInt8(bitPattern: c) }
        }

        let bindRC = withUnsafePointer(to: &addr) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) }
        }
        guard bindRC == 0 else { close(fd); return }
        // Restrict socket to owner only
        chmod(path, 0o600)
        guard Darwin.listen(fd, 32) == 0 else { close(fd); return }

        while true {
            let clientFD = Darwin.accept(fd, nil, nil)
            guard clientFD >= 0 else { break }
            // Reject connections from other users (same-UID check)
            var euid: uid_t = 0
            var egid: gid_t = 0
            guard getpeereid(clientFD, &euid, &egid) == 0, euid == getuid() else {
                close(clientFD)
                continue
            }
            // Enforce concurrent connection ceiling
            connectionLock.lock()
         
```

### Core Architecture Module: `NotchBuddy/Sources/App/IslandStateMachine.swift`
```
import Foundation

/// Pure 4-state FSM for island open/close logic.
/// No AppKit / AppState dependencies — communicates via `onTransition`.
@MainActor
final class IslandStateMachine {

    enum State: Equatable {
        case hidden   // island invisible (notch size)
        case petit    // compact island (notch + ears)
        case home     // expanded, overview
        case coucou   // expanded, greeting animation
    }

    private(set) var state: State = .hidden

    /// Fired on every transition: (from, to)
    var onTransition: ((State, State) -> Void)?

    /// When non-nil and returns true, timers and mouse-leave never auto-collapse or hide the island.
    var isHeldOpen: (() -> Bool)?

    /// home → petit delay (seconds). Override for debug.
    var homeToPetitDelay: TimeInterval = 15
    /// petit → hidden delay (seconds). Override for debug.
    var petitToHiddenDelay: TimeInterval = 60
    /// coucou → petit delay after greeting animation ends (no hover). ~0.6s syncs with canvas collapse.
    var greetAutoCollapseDelay: TimeInterval = 0.6
    /// coucou → petit delay when mouse is hovering over the greeting.
    var greetHoverCollapseDelay: TimeInterval = 10

    private var petitHideWork: DispatchWorkItem?
    private var homeCollapseWork: DispatchWorkItem?
    private var greetCollapseWork: DispatchWorkItem?

    // MARK: – Inputs

    /// App launched or debug "launch greeting"
    func launch() {
        cancelTimers()
        transition(to: .coucou)
    }

    /// Mouse entered the island notch area
    func mouseEntered() {
        switch state {
        case .hidden:
            if isHeldOpen?() == true {
                // Island already expanded by an external call — sync FSM state without transition
                state = .home
            } else {
                cancelTimers()
                transition(to: .petit)
            }
        case .petit:
            petitHideWork?.cancel()
            petitHideWork = nil
        case .home:
            homeCollapseWork?.cancel()
            homeCollapseWork = nil
        case .coucou:
            // Mouse hovering during greeting — cancel short auto-collapse, extend to hover delay
            scheduleGreetCollapse(delay: greetHoverCollapseDelay)
        }
    }

    /// Mouse left the island notch area
    func mouseLeft() {
        switch state {
        case .hidden:
            break
        case .petit:
            schedulePetitHide()
        case .home:
            if isHeldOpen?() != true { scheduleHomeCollapse() }
        case .coucou:
            if isHeldOpen?() != true {
                // Interrupt greeting immediately → compact (overrides 10s auto-collapse)
                greetCollapseWork?.cancel(); greetCollapseWork = nil
                transition(to: .petit)
            }
        }
    }

    /// Compact island clicked.
    /// Also accepts `.hidden`: after an alert the island can be on screen while the
    /// FSM never saw the mouse enter (it was already there), and the click must still open it.
    func click() {
        guard state == .petit || state == .hidden else { return }
        cancelTimers()
        transition(to: .home)
    }

    /// The app hid the island on its own (e.g. `AppState.syncMode()` when the last
    /// task ends). Mirror it without side effects, so the next hover peeks again
    /// instead of being swallowed by a FSM that still thinks the island is `.petit`.
    func hiddenExternally() {
        guard state == .petit else { return }
        cancelTimers()
        state = .hidden
    }

    /// The app expanded the island externally (hookExpand for an alert).
    /// Cancel timers and sync state to `.home` without firing `onTransition`, so the
    /// next hover/mouseLeft behave correctly instead of collapsing the island.
    func openedExternally() {
        cancelTimers()
        guard state != .home && state != .coucou else { return }
        state = .home
    }

    /// The app folded the island itself (Escape, Settings, OK button, auto-close).
    /// Move to `.petit` right away so hover and click keep working; waiting for the
    /// 15 s home timer left the island compact on screen while the FSM still said `.home`.
    func collapse() {
        guard state == .home || state == .coucou else { return }
        cancelTimers()
        transition(to: .petit)
    }

    /// Greeting animation finished (called at T.end ≈ 4.60 s).
    /// Schedules auto-collapse. Does not override a longer hover timer already running.
    func greetComplete() {
        guard state == .coucou else { return }
        // If mouse entered before this fires (hover timer already running), don't override it
        if greetCollapseWork == nil {
            scheduleGreetCollapse(delay: greetAutoCollapseDelay)
        }
    }

    private func scheduleGreetCollapse(delay: TimeInterval) {
        greetCollapseWork?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.state == .coucou else { return }
            self.transition(to: .petit)
        }
        greetCollapseWork = item
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
    }

    /// Non-alert work event: show compact from hidden (HookServer reveal)
    func reveal() {
        guard state == .hidden else { return }
        cancelTimers()
        transition(to: .petit)
        schedulePetitHide()
    }

    // MARK: – Timers

    private func schedulePetitHide() {
        petitHideWork?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.state == .petit, !(self.isHeldOpen?() ?? false) else { return }
            self.transition(to: .hidden)
        }
        petitHideWork = item
        DispatchQueue.main.asyncAfter(deadline: .now() + petitToHiddenDelay, execute: item)
    }

    private func scheduleHomeCollapse() {
        homeCollapseWork?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self, self.state == .home, !(self.isHeldOpen?() ?? false) else { return }
            self.transition(to: .petit)
        }
        homeCollapseWork = item
        DispatchQueue.main.asyncAfter(deadline: .now() + homeToPetitDelay, execute: item)
    }

    func cancelTimers() {
        petitHideWork?.cancel();    petitHideWork = nil
        homeCollapseWork?.cancel(); homeCollapseWork = nil
        greetCollapseWork?.cancel(); greetCollapseWork = nil
    }

    private func transition(to new: State) {
        guard new != state else { return }
        let old = state
        state = new
        onTransition?(old, new)
    }

}

```

### Core Architecture Module: `NotchBuddy/Sources/App/SoundEngine.swift`
```
import AVFoundation
import AppKit

/// Preloaded WAV players with near-zero latency.
/// Volume default 0.12 (matches prototype: gain ×6 then vol=0.12).
@MainActor
final class SoundEngine {
    static let shared = SoundEngine()

    var enabled: Bool = true
    var volume: Float = 0.12 {
        didSet { players.values.forEach { $0.forEach { $0.volume = volume } } }
    }

    // Pool of 3 players per sound to allow overlapping playback
    private var players: [String: [AVAudioPlayer]] = [:]

    private init() {
        preload()
    }

    private func preload() {
        let names = ["peek","open","close","hover","blip","slap","annoyed","dizzy","greet",
                     "work","finish","error","approval","question","approve","gulp","tick",
                     "send","love","pop","proud","wink","yawn","attach","think","search",
                     "rate","sleep","greeting"]
        for name in names {
            guard let url = Bundle.main.url(forResource: name, withExtension: "wav", subdirectory: "sounds") else { continue }
            var pool: [AVAudioPlayer] = []
            for _ in 0..<3 {
                if let p = try? AVAudioPlayer(contentsOf: url) {
                    p.volume = volume
                    p.prepareToPlay()
                    pool.append(p)
                }
            }
            if !pool.isEmpty { players[name] = pool }
        }
    }

    /// Fade out all currently-playing instances of `name` over `duration` seconds,
    /// then stop and reset them so they can be reused.
    func fadeOut(_ name: String, duration: TimeInterval) {
        guard let pool = players[name] else { return }
        for player in pool where player.isPlaying {
            player.setVolume(0, fadeDuration: duration)
            DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak player] in
                guard let p = player else { return }
                p.stop()
                p.currentTime = 0
                p.volume = self.volume
            }
        }
    }

    func play(_ name: String) {
        guard enabled && AppState.shared.soundEnabled else { return }
        guard let pool = players[name] else { return }
        // Find a player that is not currently playing
        let player = pool.first { !$0.isPlaying } ?? pool[0]
        player.currentTime = 0
        player.volume = volume
        player.play()
    }
}

```

### Core Architecture Module: `NotchBuddy/Sources/App/UploadSequenceEngine.swift`
```
import Foundation
import CoreGraphics

// ============================================================
// CONSTANTS — exact mirror of upload-sequence.html
// All values in island-coordinate points (island = 640 × 176)
// ============================================================

enum USC {
    static let W:     Double = 640
    static let ISL_H: Double = 176
    static let CARD_X: Double = 10;  static let CARD_Y: Double = 42
    static let CARD_W: Double = 620; static let CARD_H: Double = 124; static let CARD_R: Double = 20
    static let REST_X: Double = 140; static let REST_Y: Double = 104
    static let D_BOX:  Double = 62
    static let FOLLOW_MIN: Double = 60    // CARD_X + 50
    static let FOLLOW_MAX: Double = 580   // CARD_X + CARD_W - 50
    static let TEXT_X: Double = 196;  static let TEXT_Y: Double = 94
    static let BAR_X0: Double = 46;   static let BAR_X1: Double = 520;  static let BAR_Y: Double = 118
    static let CHOOSE_X: Double = 60; static let CHOOSE_Y: Double = 101; static let CHOOSE_D: Double = 62
    static let LOCK_IN:  Double = 60
    static let LOCK_OUT: Double = 90
    static let MOUTH_AJAR: Double = 0.20
    static let MOUTH_OPEN: Double = 0.42
    static let MOUTH_MAX:  Double = 0.50
    // Phase timestamps (t_ref, drop = 1.95)
    static let T_DROP:       Double = 1.95
    static let T_SUCK_START: Double = 2.03
    static let T_SUCK_END:   Double = 2.33
    static let T_CLOSE_END:  Double = 2.42
    static let T_CHEW1:      Double = 2.60
    static let T_CHEW_END:   Double = 2.88
    static let T_SHRINK_END: Double = 3.23
    static let T_BAR_IN:     Double = 3.00
    static let T_PROG_START: Double = 3.25
    static let DT: Double = 1.0 / 240.0
    // Entry offset: gives 0.40 s of following before drop
    static let ENTRY_T_REF: Double = T_DROP - 0.40  // = 1.55
}

// ============================================================
// EASING — port of reference E.out / E.in / E.inOut / E.back
// ============================================================

func usEOut(_ t: Double) -> Double   { 1 - pow(1-t, 3) }
func usEIn(_ t: Double)  -> Double   { t*t*t }
func usEInOut(_ t: Double) -> Double { t < 0.5 ? 4*t*t*t : 1 - pow(-2*t+2,3)/2 }
func usEBack(_ t: Double) -> Double  { let c1=1.70158,c3=c1+1; return 1+c3*pow(t-1,3)+c1*pow(t-1,2) }

func usSeg(_ t: Double, _ a: Double, _ b: Double) -> Double { max(0, min(1,(t-a)/(b-a))) }
func usLerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a+(b-a)*t }

// Squeeze keyframes for suckEnd→chew1 phase (inline to avoid Swift @escaping issues)
func usSqueezeY(_ t: Double) -> Double {
    let t0=USC.T_SUCK_END, t1=t0+0.07, t2=t0+0.20, t3=USC.T_CHEW1
    if t<=t0 { return 1.06 }
    if t<=t1 { return usLerp(1.06, 0.82, usEOut(usSeg(t,t0,t1))) }
    if t<=t2 { return usLerp(0.82, 1.10, usEOut(usSeg(t,t1,t2))) }
    if t<=t3 { return usLerp(1.10, 1.00, usEInOut(usSeg(t,t2,t3))) }
    return 1.0
}
func usSqueezeX(_ t: Double) -> Double {
    let t0=USC.T_SUCK_END, t1=t0+0.07, t2=t0+0.20, t3=USC.T_CHEW1
    if t<=t0 { return 0.97 }
    if t<=t1 { return usLerp(0.97, 1.14, usEOut(usSeg(t,t0,t1))) }
    if t<=t2 { return usLerp(1.14, 0.95, usEOut(usSeg(t,t1,t2))) }
    if t<=t3 { return usLerp(0.95, 1.00, usEInOut(usSeg(t,t2,t3))) }
    return 1.0
}

func usProgressCurve(_ u: Double) -> Double {
    if u < 0.40  { return 0.60 * usEOut(u/0.40) }
    if u < 0.85  { return 0.60 + 0.32 * usEInOut((u-0.40)/0.45) }
    return 0.92 + 0.08 * usEIn((u-0.85)/0.15)
}
func usProgressAt(_ t: Double, progStart: Double, progEnd: Double) -> Double {
    t < progStart ? 0 : usProgressCurve(usSeg(t, progStart, progEnd))
}

// ============================================================
// SPRING — port of reference spring(s, target, response, damping, dt)
// ============================================================

struct USSpring {
    var v:   Double
    var vel: Double = 0
    mutating func step(target: Double, response: Double, damping: Double, dt: Double) {
        let k = pow(2 * .pi / response, 2)
        let c = 2 * damping * sqrt(k)
        let a = k*(target-v) - c*vel
        vel += a*dt; v += vel*dt
    }
}

// ============================================================
// SIMULATION STATE — mirrors reference newSim()
// ============================================================

struct USSimState {
    var t:       Double = 0
    var bx:      USSpring = USSpring(v: USC.REST_X)
    var by:      USSpring = USSpring(v: USC.REST_Y)
    var tilt:    Double = 0
    var mouth:   USSpring = USSpring(v: 0)
    var locked:  Bool = false
    var lockAt:  Double = -9
    var entered: Double = -9  // t_ref of zone entry; -9 = not entered
    var gulp:    Bool = false
    var ok:      Bool = false
    var lastPct: Int = 0
}

// ============================================================
// FRAME DATA — output of frame(), read by UploadCanvasView
// ============================================================

enum USEyeShape { case pill, cup, content }

struct USMouthRect { var x,y,w,h: Double }

struct USFrame {
    var t: Double = 0
    var cursorX: Double = 600; var cursorY: Double = 280
    var morph: Double = 0
    var x: Double = USC.REST_X; var y: Double = USC.REST_Y; var d: Double = USC.D_BOX
    var sx: Double = 1; var sy: Double = 1; var tilt: Double = 0; var hop: Double = 0
    var mouth: Double = 0
    var mouthRect = USMouthRect(x:0,y:0,w:0,h:0)
    var eye: USEyeShape = .pill
    var lookX: Double = 0; var lookY: Double = 0
    var fileVisible: Bool = true; var suck: Double = 0
    var zoneOver:    Bool   = false
    var zoneAlpha:   Double = 1
    var textAlpha:   Double = 1
    var barReveal:   Double = 0
    var barAlpha:    Double = 0
    var progress:    Double = 0
    var flash:       Double = 0
    var check:       Double = 0
    var greenWash:   Double = 0
    var chooseAlpha: Double = 0
    var uploadDuration: Double = 2.4
    var progEnd:    Double = USC.T_PROG_START + 2.4
    var growStart:  Double = USC.T_PROG_START + 2.4 + 0.25
    var growEnd:    Double = USC.T_PROG_START + 2.4 + 0.70
}

// ============================================================
// ENGINE
// ============================================================

@MainActor
final class UploadSequenceEngine {
    static let shared = UploadSequenceEngine()

    var uploadDuration: Double = 2.4
    var progEnd:   Double { USC.T_PROG_START + uploadDuration }
    var growStart: Double { progEnd + 0.25 }
    var growEnd:   Double { progEnd + 0.70 }

    private(set) var isActive: Bool = false
    private var entryWallTime: Double = 0   // Date().timeIntervalSinceReferenceDate at entry
    private var dropWallTime:  Double? = nil

    private var sim = USSimState()

    // Real cursor in island coords
    var cursorX: Double = 600
    var cursorY: Double = 280
    private var prevCursorX:  Double = 600
    private var prevCursorY:  Double = 280
    private var prevCursorTime: Double = 0
    private var cursorSpeed: Double = 0

    // MARK: - Session lifecycle

    func enterZone(x: CGFloat, y: CGFloat) {
        let now = Date().timeIntervalSinceReferenceDate
        cursorX = Double(x); cursorY = Double(y)
        prevCursorX = cursorX; prevCursorY = cursorY; prevCursorTime = now
        cursorSpeed = 0
        sim = USSimState()
        sim.t       = USC.ENTRY_T_REF
        sim.entered = USC.ENTRY_T_REF
        sim.bx      = USSpring(v: USC.REST_X)
        sim.by      = USSpring(v: USC.REST_Y)
        entryWallTime = now
        dropWallTime  = nil
        isActive      = true
    }

    func updateCursor(x: CGFloat, y: CGFloat) {
        let now = Date().timeIntervalSinceReferenceDate
        let dt = now - prevCursorTime
        if dt > 0.001 {
            let dx = Double(x) - prevCursorX, dy = Double(y) - prevCursorY
            cursorSpeed = hypot(dx, dy) / dt
        }
        prevCursorX = Double(x); prevCursorY = Double(y); prevCursorTime = now
        cursorX = Double(x); cursorY = Double(y)
    }

    func exitZone() {
        // Keep engine active — island stays open per spec
    }

    func performDrop(uploadDuration ud: Double) {
        uploadDuration = ud
        let now = Date().timeIntervalSinceReferenceDate
        dropWallTime = now
        // Reset sim.t to T_DROP so the canonical post-drop timeline starts correctly,
        // regardless of how long the user hovered. Spring state (position/velocity) is preserved.
        sim.t = USC.T_DROP
    }

    func deactivate() {
        isActive = false
        dropWallTime = nil
    }

    // MARK: - t_ref from wall clock

    func tRef(at date: Date) -> Double {
        guard isActive else { return 0 }
        let now = date.timeIntervalSinceReferenceDate
        if let dw = dropWallTime {
            return USC.T_DROP + max(0, now - dw)
        }
        // No cap — spring keeps stepping as long as user hovers.
        // computeFrame clamps phase-sensitive outputs to pre-drop state.
        let elapsed = max(0, now - entryWallTime)
        return USC.ENTRY_T_REF + elapsed
    }

    // MARK: - Public entry point

    func frame(at date: Date) -> USFrame {
        guard isActive else { return USFrame() }
        let t = tRef(at: date)
        simulateTo(t)
        return computeFrame(t: t)
    }

    // MARK: - Simulation

    private func simulateTo(_ tTarget: Double) {
        while sim.t < tTarget - 1e-10 {
            let dt = min(USC.DT, tTarget - sim.t)
            stepOnce(dt: dt)
            sim.t += dt
        }
    }

    private func stepOnce(dt: Double) {
        let isDragging = (dropWallTime == nil)

        // Horizontal follow + lock (only while dragging and in zone)
        if isDragging && sim.entered >= 0 {
            let dist = hypot(cursorX - sim.bx.v, (cursorY + 14) - sim.by.v)
            if !sim.locked && dist < USC.LOCK_IN && cursorSpeed < 180 {
                sim.locked = true; sim.lockAt = sim.t
            }
            if sim.locked && dist > USC.LOCK_OUT { sim.locked = false }
```

### Core Architecture Module: `NotchBuddy/Sources/CoucouKit/BotEngine.swift`
```
import Foundation
import CoreGraphics
import QuartzCore
import SwiftUI

// MARK: - Easing functions (same as prototype: E.out, E.inOut, E.back, E.lin)

enum Ease {
    static func out(_ t: CGFloat) -> CGFloat   { 1 - pow(1 - t, 3) }
    static func inOut(_ t: CGFloat) -> CGFloat { t < 0.5 ? 4*t*t*t : 1 - pow(-2*t+2, 3)/2 }
    static func back(_ t: CGFloat) -> CGFloat  { let c1: CGFloat = 1.7; let c3 = c1+1; return 1+c3*pow(t-1,3)+c1*pow(t-1,2) }
    static func lin(_ t: CGFloat) -> CGFloat   { t }
}

// MARK: - Tween key: [target, duration_ms, easing]

struct TweenKey {
    let target: CGFloat
    let duration: CGFloat    // milliseconds
    let ease: (CGFloat) -> CGFloat
}

struct Tween {
    let property: String
    var keys: [TweenKey]
    var keyIndex: Int = 0
    var from: CGFloat
    var startTime: Double    // CACurrentMediaTime() * 1000
    var onComplete: (() -> Void)? = nil
}

// MARK: - Particle

struct Particle {
    enum ParticleType { case heart, star, spark, sweat, z }
    var type: ParticleType
    var x, y, vx, vy: CGFloat
    var age: Double        // seconds
    var life: Double
    var rot: CGFloat
    var size: CGFloat
}

// MARK: - Bot state config (mirrors STATES in prototype)

struct BotStateCfg {
    let color: CGColor
    let tint: CGFloat
    let eye: EyeShape
    let badge: BadgeType?
    let badgeColor: CGColor
    let glow: CGColor
    let glowOpacity: CGFloat
    let bounces: Bool
    let scans: Bool
    let breathes: Bool
    let zz: Bool
    let sweat: Bool
    let look: CGPoint?     // fixed look direction
    let tilt: CGFloat
    let sound: String?
}

enum EyeShape: String {
    case pill, wide, dot, line, flat, happy, closed, spiral, heart, star, tired, wink, cup
}

enum BadgeType {
    case dots(CGColor)
    case bang(CGColor)
    case question(CGColor)
    case dot(CGColor)
}

// MARK: - Mochi track constants (from PISTES.mochi)

enum MochiConst {
    static let eyeW: CGFloat  = 0.25
    static let eyeH: CGFloat  = 0.27
    static let eyeSp: CGFloat = 0.37
    static let eyeP: CGFloat  = -0.12
    static let baseTop    = CGColor(red: 0.929, green: 0.929, blue: 0.937, alpha: 1)  // #EDEDEF
    static let baseBottom = CGColor(red: 0.769, green: 0.773, blue: 0.792, alpha: 1)  // #C4C5CA
    static let ink        = CGColor(red: 0.102, green: 0.082, blue: 0.071, alpha: 1)  // #1A1412
    static let miniInk    = CGColor(red: 0.063, green: 0.075, blue: 0.102, alpha: 1)  // #10131A
}

// MARK: - Bot state configs

let BotStates: [BotState: BotStateCfg] = [
    .idle: BotStateCfg(
        color: CGColor(red:0.902,green:0.914,blue:0.933,alpha:1), tint:0,
        eye:.pill, badge:nil,
        badgeColor: .white, glow: CGColor(red:1,green:1,blue:1,alpha:0.35), glowOpacity:0.25,
        bounces:false, scans:false, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0, sound:nil),
    .working: BotStateCfg(
        color: CGColor(red:0.231,green:0.620,blue:1,alpha:1), tint:0.72,
        eye:.pill, badge:.dots(CGColor(red:0.231,green:0.620,blue:1,alpha:1)),
        badgeColor: CGColor(red:0.231,green:0.620,blue:1,alpha:1),
        glow: CGColor(red:0.231,green:0.620,blue:1,alpha:1), glowOpacity:0.55,
        bounces:false, scans:false, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0, sound:"work"),
    .thinking: BotStateCfg(
        color: CGColor(red:0.545,green:0.361,blue:0.965,alpha:1), tint:0.72,
        eye:.pill, badge:.dots(CGColor(red:0.545,green:0.361,blue:0.965,alpha:1)),
        badgeColor: CGColor(red:0.545,green:0.361,blue:0.965,alpha:1),
        glow: CGColor(red:0.545,green:0.361,blue:0.965,alpha:1), glowOpacity:0.5,
        bounces:false, scans:false, breathes:false, zz:false, sweat:false,
        look: CGPoint(x:0.55, y:0.55), tilt:0, sound:"think"),
    .searching: BotStateCfg(
        color: CGColor(red:0.388,green:0.396,blue:0.949,alpha:1), tint:0.72,
        eye:.pill, badge:.dots(CGColor(red:0.388,green:0.396,blue:0.949,alpha:1)),
        badgeColor: CGColor(red:0.388,green:0.396,blue:0.949,alpha:1),
        glow: CGColor(red:0.388,green:0.396,blue:0.949,alpha:1), glowOpacity:0.55,
        bounces:false, scans:true, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0, sound:"search"),
    .approval: BotStateCfg(
        color: CGColor(red:0.961,green:0.647,blue:0.141,alpha:1), tint:0.78,
        eye:.wide, badge:.bang(CGColor(red:0.961,green:0.647,blue:0.141,alpha:1)),
        badgeColor: CGColor(red:0.961,green:0.647,blue:0.141,alpha:1),
        glow: CGColor(red:0.961,green:0.647,blue:0.141,alpha:1), glowOpacity:0.6,
        bounces:true, scans:false, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0, sound:"approval"),
    .question: BotStateCfg(
        color: CGColor(red:0.133,green:0.827,blue:0.933,alpha:1), tint:0.75,
        eye:.pill, badge:.question(CGColor(red:0.133,green:0.827,blue:0.933,alpha:1)),
        badgeColor: CGColor(red:0.133,green:0.827,blue:0.933,alpha:1),
        glow: CGColor(red:0.133,green:0.827,blue:0.933,alpha:1), glowOpacity:0.55,
        bounces:false, scans:false, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0.17, sound:"question"),
    .error: BotStateCfg(
        color: CGColor(red:0.957,green:0.314,blue:0.369,alpha:1), tint:0.78,
        eye:.flat, badge:.dot(CGColor(red:0.957,green:0.314,blue:0.369,alpha:1)),
        badgeColor: CGColor(red:0.957,green:0.314,blue:0.369,alpha:1),
        glow: CGColor(red:0.957,green:0.314,blue:0.369,alpha:1), glowOpacity:0.55,
        bounces:false, scans:false, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0, sound:"error"),
    .finished: BotStateCfg(
        color: CGColor(red:0.204,green:0.831,blue:0.600,alpha:1), tint:0.35,
        eye:.happy, badge:.dot(CGColor(red:0.204,green:0.831,blue:0.600,alpha:1)),
        badgeColor: CGColor(red:0.204,green:0.831,blue:0.600,alpha:1),
        glow: CGColor(red:0.204,green:0.831,blue:0.600,alpha:1), glowOpacity:0.5,
        bounces:false, scans:false, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0, sound:"finish"),
    .ratelimit: BotStateCfg(
        color: CGColor(red:0.984,green:0.573,blue:0.235,alpha:1), tint:0.72,
        eye:.tired, badge:.dot(CGColor(red:0.984,green:0.573,blue:0.235,alpha:1)),
        badgeColor: CGColor(red:0.984,green:0.573,blue:0.235,alpha:1),
        glow: CGColor(red:0.984,green:0.573,blue:0.235,alpha:1), glowOpacity:0.45,
        bounces:false, scans:false, breathes:false, zz:false, sweat:true,
        look:nil, tilt:0, sound:"rate"),
    .sleeping: BotStateCfg(
        color: CGColor(red:0.580,green:0.635,blue:0.722,alpha:1), tint:0.32,
        eye:.closed, badge:nil,
        badgeColor: .white,
        glow: CGColor(red:0.580,green:0.635,blue:0.722,alpha:1), glowOpacity:0.2,
        bounces:false, scans:false, breathes:true, zz:true, sweat:false,
        look:nil, tilt:0, sound:"sleep"),
    .dizzy: BotStateCfg(
        color: CGColor(red:0.957,green:0.447,blue:0.714,alpha:1), tint:0.7,
        eye:.spiral, badge:nil,
        badgeColor: .white,
        glow: CGColor(red:0.957,green:0.447,blue:0.714,alpha:1), glowOpacity:0.55,
        bounces:false, scans:false, breathes:false, zz:false, sweat:false,
        look:nil, tilt:0, sound:"dizzy"),
]

// MARK: - Bot engine

@MainActor
final class BotEngine: ObservableObject {
    var isMini: Bool = false
    var bodyColor: CGColor? = nil    // override for mini bots

    // Animation state (mirrors prototype 's' object)
    var yaw:    CGFloat = 0
    var pitch:  CGFloat = 0
    var roll:      CGFloat = 0
    var rollTurns: CGFloat = 1
    var tilt:   CGFloat = 0
    var open:   CGFloat = 1          // eye open amount
    var sx:     CGFloat = 1          // scale X
    var sy:     CGFloat = 1          // scale Y
    var oy:     CGFloat = 0          // offset Y (bounce)
    var ox:     CGFloat = 0          // offset X (shake)
    var tint:   CGFloat = 0
    var morph:  CGFloat = 0          // morph to rect (for upload bucket)
    var hands:  CGFloat = 0
    var blush:  CGFloat = 0
    var outfit: Outfit = .none
    var es:     CGFloat = 1          // eye scale
    var badgeS: CGFloat = 0          // badge scale
    var outfitPresence: CGFloat = 0  // 0=hidden, 1=fully visible (animated)
    private var outfitTarget: Outfit = .none

    // Physical spring (hat/pompom lag) — updated in update()
    var physDx: CGFloat = 0   // horizontal lag (-1..1)
    var physDy: CGFloat = 0   // vertical lag (-1..1)
    private var physVx: CGFloat = 0
    private var physVy: CGFloat = 0
    private var prevYaw: CGFloat = 0
    private var prevOy: CGFloat = 0
    private var prevRoll: CGFloat = 0

    // Targets
    var tgYaw:    CGFloat = 0
    var tgPitch:  CGFloat = 0
    var tgTilt:   CGFloat = 0
    var tgSy:     CGFloat = 1
    var tgSx:     CGFloat = 1
    var tgEs:     CGFloat = 1   // eye-scale target (hover love: 1.08, normal: 1)

    // Particle canvas overhang (extra canvas height at top for hearts to fly into)
    var particleOverhang: CGFloat = 0

    // Mouth spring (fraction of R: 0=closed, 0.20=hover, 0.42=open, 0.50=overopen)
    var slotH: CGFloat = 0           // current height (fraction of R)
    var slotHTarget: CGFloat = 0     // spring target
    var slotHVel: CGFloat = 0        // spring velocity (fraction of R / s)
    var isChewing: Bool = false       // true for ~800ms after gulp swallow

    // Color (animated)
    var col:  (CGFloat, CGFloat, CGFloat) = (0.902, 0.914, 0.933)  // idle
    var colT: (CGFloat, CGFloat, CGFloat) = (0.902, 0.914, 0.933)

    // State
    var state: BotState = .idle
    var cfg: BotStateCfg = BotStates[.idle]!

    // Eye override (emote)
    var eyeOverride: EyeShape? = nil
    var eyeOverrideUntil: Double = 0   // CACurrentMediaTime()
    var permanentEye: EyeShape? = nil   // restored after temporary emote/blink expires
    var permanentEmote: BotEmote? = nil // stored so doMiniBehaviorLoop can switch on it
    var miniNextBehavior
```

### Core Architecture Module: `NotchBuddy/Sources/CoucouKit/DiffEngine.swift`
```
import Foundation

// MARK: - Types

struct DiffLine: Equatable {
    enum Kind: Equatable { case context, added, removed }
    var kind: Kind
    var text: String
    var origLine: Int   // 1-based; -1 for pure adds
    var newLine: Int    // 1-based; -1 for pure removes
}

struct DiffHunk: Equatable {
    var origStart: Int
    var newStart: Int
    var lines: [DiffLine]
}

struct FileDiff: Equatable {
    var id: Int = 0         // stable identifier assigned by AppState.appendSessionDiff
    var path: String
    var added: Int
    var removed: Int
    var hunks: [DiffHunk]
    var tooLarge: Bool
    var isNewFile: Bool     // true when produced by DiffEngine.fromNew (Write tool)

    var name: String { URL(fileURLWithPath: path).lastPathComponent }

    static let maxBytes = 200 * 1024
    static let maxLines = 4000
}

// MARK: - DiffEngine

enum DiffEngine {

    // MARK: Public API

    static func fromEdit(old: String, new: String, path: String) -> FileDiff {
        // Size guard
        if old.utf8.count + new.utf8.count > FileDiff.maxBytes {
            return countFallback(old: old, new: new, path: path, tooLarge: true)
        }
        let oldLines = splitLines(old)
        let newLines = splitLines(new)
        if oldLines.count + newLines.count > FileDiff.maxLines {
            return countFallback(old: old, new: new, path: path, tooLarge: true)
        }
        // LCS is O(m*n) — bail out before quadratic blowup
        if oldLines.count * newLines.count > 1_000_000 {
            return countFallback(old: old, new: new, path: path, tooLarge: true)
        }
        let flat = buildDiffLines(oldLines: oldLines, newLines: newLines)
        let hunks = buildHunks(from: flat, context: 3)
        let added   = flat.filter { $0.kind == .added   }.count
        let removed = flat.filter { $0.kind == .removed }.count
        return FileDiff(path: path, added: added, removed: removed, hunks: hunks, tooLarge: false, isNewFile: false)
    }

    static func fromNew(content: String, path: String) -> FileDiff {
        // Size guard (same limits as fromEdit)
        if content.utf8.count > FileDiff.maxBytes {
            let lineCount = content.components(separatedBy: "\n").count
            return FileDiff(path: path, added: lineCount, removed: 0, hunks: [], tooLarge: true, isNewFile: true)
        }
        let lines = splitLines(content)
        if lines.count > FileDiff.maxLines {
            return FileDiff(path: path, added: lines.count, removed: 0, hunks: [], tooLarge: true, isNewFile: true)
        }
        let diffLines = lines.enumerated().map { (i, text) in
            DiffLine(kind: .added, text: text, origLine: -1, newLine: i + 1)
        }
        let hunk = diffLines.isEmpty ? nil : DiffHunk(origStart: 0, newStart: 1, lines: diffLines)
        return FileDiff(
            path: path,
            added: diffLines.count,
            removed: 0,
            hunks: hunk.map { [$0] } ?? [],
            tooLarge: false,
            isNewFile: true
        )
    }

    // MARK: - Line splitting

    private static func splitLines(_ text: String) -> [String] {
        // Normalize CRLF → LF
        let normalized = text.replacingOccurrences(of: "\r\n", with: "\n")
        var parts = normalized.components(separatedBy: "\n")
        // Drop trailing empty element that results from a trailing newline
        if parts.last == "" { parts.removeLast() }
        return parts
    }

    // MARK: - LCS-based diff

    private static func buildDiffLines(oldLines: [String], newLines: [String]) -> [DiffLine] {
        let m = oldLines.count
        let n = newLines.count

        // Build LCS DP table
        // dp[i][j] = LCS length of oldLines[0..<i] and newLines[0..<j]
        var dp = [[Int]](repeating: [Int](repeating: 0, count: n + 1), count: m + 1)
        for i in 1...max(1, m) {
            for j in 1...max(1, n) {
                guard i <= m && j <= n else { continue }
                if oldLines[i - 1] == newLines[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1
                } else {
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
                }
            }
        }

        // Backtrack to get matching pairs
        var matches: [(Int, Int)] = []  // (oldIdx 0-based, newIdx 0-based)
        var i = m, j = n
        while i > 0 && j > 0 {
            if oldLines[i - 1] == newLines[j - 1] {
                matches.append((i - 1, j - 1))
                i -= 1; j -= 1
            } else if dp[i - 1][j] >= dp[i][j - 1] {
                i -= 1
            } else {
                j -= 1
            }
        }
        matches.reverse()

        // Build flat diff from LCS pairs
        var result: [DiffLine] = []
        var prevOld = -1
        var prevNew = -1

        for (oi, ni) in matches {
            // Removed lines between last match and this old match
            for k in (prevOld + 1)..<oi {
                result.append(DiffLine(kind: .removed, text: oldLines[k],
                                       origLine: k + 1, newLine: -1))
            }
            // Added lines between last match and this new match
            for k in (prevNew + 1)..<ni {
                result.append(DiffLine(kind: .added, text: newLines[k],
                                       origLine: -1, newLine: k + 1))
            }
            // Context line (the match)
            result.append(DiffLine(kind: .context, text: oldLines[oi],
                                   origLine: oi + 1, newLine: ni + 1))
            prevOld = oi
            prevNew = ni
        }

        // Remaining removes
        for k in (prevOld + 1)..<m {
            result.append(DiffLine(kind: .removed, text: oldLines[k],
                                   origLine: k + 1, newLine: -1))
        }
        // Remaining adds
        for k in (prevNew + 1)..<n {
            result.append(DiffLine(kind: .added, text: newLines[k],
                                   origLine: -1, newLine: k + 1))
        }

        return result
    }

    // MARK: - Hunk building

    private static func buildHunks(from lines: [DiffLine], context: Int) -> [DiffHunk] {
        guard !lines.isEmpty else { return [] }

        // Find indices of changed lines
        var changedIndices: [Int] = []
        for (i, line) in lines.enumerated() {
            if line.kind != .context { changedIndices.append(i) }
        }
        guard !changedIndices.isEmpty else { return [] }

        // Expand ±context around each changed line
        let ranges: [(Int, Int)] = changedIndices.map {
            (max(0, $0 - context), min(lines.count - 1, $0 + context))
        }

        // Merge overlapping ranges
        var merged: [(Int, Int)] = []
        for r in ranges {
            if let last = merged.last, r.0 <= last.1 + 1 {
                merged[merged.count - 1] = (last.0, max(last.1, r.1))
            } else {
                merged.append(r)
            }
        }

        // Build hunks
        var hunks: [DiffHunk] = []
        for (start, end) in merged {
            let hunkLines = Array(lines[start...end])
            let origStart = hunkLines.first(where: { $0.origLine > 0 })?.origLine ?? 1
            let newStart  = hunkLines.first(where: { $0.newLine > 0 })?.newLine  ?? 1
            hunks.append(DiffHunk(origStart: origStart, newStart: newStart, lines: hunkLines))
        }
        return hunks
    }

    // MARK: - Count fallback (tooLarge)

    private static func countFallback(old: String, new: String, path: String, tooLarge: Bool) -> FileDiff {
        let oldLines = old.components(separatedBy: "\n")
        let newLines = new.components(separatedBy: "\n")
        let oldSet = Set(oldLines)
        let newSet = Set(newLines)
        let added   = newLines.filter { !$0.isEmpty && !oldSet.contains($0) }.count
        let removed = oldLines.filter { !$0.isEmpty && !newSet.contains($0) }.count
        return FileDiff(path: path, added: added, removed: removed, hunks: [], tooLarge: tooLarge, isNewFile: false)
    }

    // MARK: - toOneLine

    /// Converts a possibly multi-line, markdown-formatted string to a single line of plain text.
    /// Uses only the first non-empty paragraph (stops at blank line, horizontal rule, or table row).
    /// Strips `**`, `__`, backticks, leading `#`, and leading bullet markers.
    static func toOneLine(_ text: String, maxChars: Int = 200) -> String {
        let lines = text.components(separatedBy: "\n")

        // Split into paragraphs. Separators: blank line, HR (3+ repeated -/*/_ chars), table row (starts with |).
        var paragraphs: [[String]] = []
        var current: [String] = []
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            let isHR = trimmed.count >= 3 && (trimmed.allSatisfy { $0 == "-" } ||
                                               trimmed.allSatisfy { $0 == "*" } ||
                                               trimmed.allSatisfy { $0 == "_" })
            let isSep = trimmed.isEmpty || isHR || trimmed.hasPrefix("|")
            if isSep {
                if !current.isEmpty { paragraphs.append(current); current = [] }
            } else {
                current.append(line)
            }
        }
        if !current.isEmpty { paragraphs.append(current) }

        // Find first paragraph that yields non-empty text after cleaning.
        for paraLines in paragraphs {
            var s = paraLines.joined(separator: "\n")
            s = s.replacingOccurrences(of: "**", with: "")
            s = s.replacingOccurrences(of: "__", with: "")
            s = s.replacingOccurrences(of: "`", with: "")
            let processed: [String] = s.components(separatedBy: "\n").compactMap { line in
                var l = line
                while l.hasPrefix("#") { l = String(l.dropFirst()) }
                l = l.trimmingCharacters(in: .whitespaces)
                // Strip leading bullet markers: -, *, •, or 
```

### Core Architecture Module: `NotchBuddy/Sources/CoucouKit/MochiActivityState.swift`
```
import Foundation

// What the iPhone's Live Activity (Lock Screen and Dynamic Island) shows:
// the most urgent agent session, while the Mac is locked. The Mac builds it,
// the relay forwards it as the Live Activity's "content-state", ActivityKit
// decodes it on the iPhone. It passes through the relay and Apple's push
// service, so it holds no project name, step text, command or path: only the
// agent, its state and counts.

struct MochiActivityState: Codable, Hashable, Sendable {
    var pillId: String
    var agent: String       // "VS Code", "Codex"…
    var color: String       // agent color, hex
    var state: String       // BotState raw value
    var statusText: String  // "working · 3/7", "waiting for your OK"…
    var tone: String        // waiting, question, error, working, done, idle
    var stepIndex: Int
    var stepCount: Int
    var others: Int         // other sessions still going
    /// When Mochi left for the iPhone (Unix seconds): the iPhone counts the
    /// time from it, live. Optional so older pushes still decode.
    var since: Int? = nil
    /// The fingerprint of the command waiting for your OK (an opaque hash,
    /// never the command): the Lock Screen's Allow and Deny answer this one.
    var approval: String? = nil

    var botState: BotState { BotState(rawValue: state) ?? .idle }
    var isActive: Bool { ["waiting", "question", "working", "error"].contains(tone) }

    /// Lower = more urgent, same order as the iPhone list.
    static func urgency(state: BotState, waitingForOK: Bool, hasQuestion: Bool) -> Int {
        if waitingForOK || state == .approval { return 0 }
        if hasQuestion || state == .question { return 1 }
        switch state {
        case .error, .ratelimit, .dizzy: return 2
        case .working, .thinking, .searching: return 3
        case .finished: return 4
        default: return 5
        }
    }

    static func tone(urgency: Int) -> String {
        ["waiting", "question", "error", "working", "done"].indices.contains(urgency)
            ? ["waiting", "question", "error", "working", "done"][urgency] : "idle"
    }

    static func statusText(state: BotState, urgency: Int, stepIndex: Int, stepCount: Int) -> String {
        switch urgency {
        case 0: return "waiting for your OK"
        case 1: return "has a question"
        default: break
        }
        switch state {
        case .working, .thinking, .searching:
            return stepCount == 0 ? "working" : "working · \(min(stepIndex + 1, stepCount))/\(stepCount)"
        case .finished: return "✓ done"
        case .error: return "error"
        case .ratelimit: return "rate limited"
        case .sleeping: return "asleep"
        case .dizzy: return "dizzy"
        default: return "idle"
        }
    }

    static let placeholder = MochiActivityState(
        pillId: "integration_claude", agent: "VS Code", color: "#4A86E8",
        state: "working", statusText: "working · 3/7", tone: "working",
        stepIndex: 2, stepCount: 7, others: 1)
}

```

### Core Architecture Module: `scripts/RenderOutfits.swift`
```
// RenderOutfits.swift — standalone planche renderer for Mochi outfits
// Compile + run via: bash scripts/render-outfits.sh
// Output: /tmp/coucou-outfits.png

import Foundation
import SwiftUI
import AppKit

// MARK: - Stubs (substitutes for app-only types)

@MainActor
final class SoundEngine {
    static let shared = SoundEngine()
    var enabled: Bool = false
    func play(_ name: String) {}
}

extension Notification.Name {
    static let botDizzy          = Notification.Name("notchBuddy.botDizzy")
    static let botGreet          = Notification.Name("notchBuddy.botGreet")
    static let botBlink          = Notification.Name("notchBuddy.botBlink")
    static let botSetTgEs        = Notification.Name("notchBuddy.botSetTgEs")
    static let botGulp           = Notification.Name("notchBuddy.botGulp")
    static let botMorphTo        = Notification.Name("notchBuddy.botMorphTo")
    static let triggerEmote      = Notification.Name("notchBuddy.triggerEmote")
    static let triggerSlap       = Notification.Name("notchBuddy.triggerSlap")
    static let greetComplete     = Notification.Name("notchBuddy.greetComplete")
    static let greetingHover     = Notification.Name("notchBuddy.greetingHover")
    static let greetingInterrupt = Notification.Name("notchBuddy.greetingInterrupt")
    static let islandAction      = Notification.Name("notchBuddy.islandAction")
    static let islandCollapse    = Notification.Name("notchBuddy.islandCollapse")
    static let hookReveal        = Notification.Name("notchBuddy.hookReveal")
    static let musicReveal       = Notification.Name("notchBuddy.musicReveal")
    static let openFullSettings  = Notification.Name("notchBuddy.openFullSettings")
}

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let val = UInt64(h, radix: 16) ?? 0
        let r = Double((val >> 16) & 0xFF) / 255
        let g = Double((val >> 8)  & 0xFF) / 255
        let b = Double( val        & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Cell view — one outfit at one pose

struct MochiCell: View {
    let outfit: Outfit
    let yaw: CGFloat
    let pitch: CGFloat
    let tilt: CGFloat
    let phys: (dx: CGFloat, dy: CGFloat)
    let cellSize: CGFloat
    var roll: CGFloat = 0
    var presence: CGFloat = 1

    var body: some View {
        Canvas { context, sz in
            let W = sz.width, H = sz.height
            // scale=0.62, R = W * 0.62 * 0.3
            let R  = W * 0.62 * 0.3
            let rx = R * 1.14
            let ry = R * 0.88
            let cx = W / 2
            let cy = H / 2 + R * 0.06
            let sx: CGFloat = 1, sy: CGFloat = 1
            let morph: CGFloat = 0

            let mH = MochiH(R: R, yaw: yaw, pitch: pitch, physDx: phys.dx, physDy: phys.dy, roll: roll)

            // 1. Behind-body outfit
            drawOutfitBehindStatic(
                context: context, outfit: outfit, H: mH,
                cx: cx, cy: cy, tilt: tilt, sx: sx, sy: sy,
                roll: roll, morph: morph, isMini: false, presence: presence
            )

            // 2. Body (replicate BotEngine.drawBody for idle / pumpkin state)
            var bCtx = context
            bCtx.translateBy(x: cx, y: cy)
            if tilt != 0 { bCtx.rotate(by: .radians(tilt)) }
            bCtx.scaleBy(x: sx, y: sy)
            let body = mochiOutfitPath(rx, ry)

            // Base gradient (pumpkin-aware)
            let pumpkin = outfit == .pumpkin
            let cTop: Color = pumpkin ? Color(hex: "#FFA94D") : Color(red: 0.929, green: 0.929, blue: 0.937)
            let cBot: Color = pumpkin ? Color(hex: "#E8590C") : Color(red: 0.769, green: 0.773, blue: 0.792)
            bCtx.fill(body, with: .linearGradient(
                Gradient(colors: [cTop, cBot]),
                startPoint: CGPoint(x: rx * 0.7, y: -ry * 0.85),
                endPoint:   CGPoint(x: -rx * 0.8, y: ry * 0.9)
            ))
            // Shadow rim
            bCtx.fill(body, with: .radialGradient(
                Gradient(stops: [
                    .init(color: .clear, location: 0.6),
                    .init(color: Color.black.opacity(0.2), location: 1)
                ]),
                center: .zero, startRadius: R * 0.15, endRadius: R * 1.25
            ))
            // Top-left highlight
            bCtx.fill(body, with: .radialGradient(
                Gradient(stops: [
                    .init(color: Color.white.opacity(0.55), location: 0),
                    .init(color: .clear, location: 1)
                ]),
                center: CGPoint(x: rx * 0.34, y: -ry * 0.46),
                startRadius: 0, endRadius: R * 0.42
            ))

            // 3. Eyes (clipped to body)
            var eyeBase = bCtx
            eyeBase.clip(to: body)
            let ink = Color(red: 0.102, green: 0.082, blue: 0.071)
            for f in mEyeFrames(mH) {
                guard f.visible else { continue }
                var eCtx = eyeBase
                eCtx.translateBy(x: f.x, y: f.y)
                eCtx.scaleBy(x: f.fx, y: f.fy)
                let hh = max(f.h, f.w * 0.3)
                var pill = Path()
                pill.addRoundedRect(
                    in: CGRect(x: -f.w / 2, y: -hh / 2, width: f.w, height: hh),
                    cornerSize: CGSize(width: min(f.w / 2, hh / 2), height: min(f.w / 2, hh / 2))
                )
                eCtx.fill(pill, with: .color(ink))
            }

            // 4. Front outfit
            drawOutfitFrontStatic(
                context: context, outfit: outfit, H: mH,
                cx: cx, cy: cy, tilt: tilt, sx: sx, sy: sy,
                roll: roll, morph: morph, isMini: false, presence: presence
            )
        }
        .frame(width: cellSize, height: cellSize)
    }
}

// MARK: - Grid view

// Outfit order matching sheet.html
private let targetOutfits: [Outfit] = [
    .none, .beanie, .santaHat, .partyHat, .crown, .witchHat,
    .sunglasses, .roundGlasses, .scarf, .pumpkin, .bow,
]

private struct PoseSpec {
    let label: String
    let yaw: CGFloat
    let pitch: CGFloat
    let tilt: CGFloat
    let phys: (dx: CGFloat, dy: CGFloat)
    let size: CGFloat
}

// Columns matching sheet.html cols array + small pill-preview column (W=190, scale=0.62; small=64)
private let poses: [PoseSpec] = [
    PoseSpec(label: "L",     yaw: -0.5,  pitch:  0,     tilt: 0,    phys: (0.6,  0),    size: 190),
    PoseSpec(label: "front", yaw:  0,    pitch:  0,     tilt: 0,    phys: (0,    0),    size: 190),
    PoseSpec(label: "R",     yaw:  0.5,  pitch:  0,     tilt: 0,    phys: (-0.6, 0),    size: 190),
    PoseSpec(label: "up",    yaw:  0.15, pitch:  0.4,   tilt: 0,    phys: (0,    0.4),  size: 190),
    PoseSpec(label: "down",  yaw: -0.2,  pitch: -0.5,   tilt: 0,    phys: (0,   -0.4),  size: 190),
    PoseSpec(label: "tilt",  yaw:  0.3,  pitch: -0.25,  tilt: 0.12, phys: (-0.3, 0),   size: 190),
    PoseSpec(label: "mini",  yaw:  0,    pitch:  0,     tilt: 0,    phys: (0,    0),    size: 64),
]

private let labelW: CGFloat = 90
private let gap:    CGFloat = 6

struct OutfitGrid: View {
    var body: some View {
        VStack(alignment: .leading, spacing: gap) {
            // Column headers
            HStack(spacing: gap) {
                Spacer().frame(width: labelW)
                ForEach(poses.indices, id: \.self) { i in
                    Text(poses[i].label)
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.gray)
                        .frame(width: poses[i].size, alignment: .center)
                }
            }
            // One row per outfit
            ForEach(targetOutfits.indices, id: \.self) { oi in
                let outfit = targetOutfits[oi]
                HStack(spacing: gap) {
                    Text(outfit.rawValue)
                        .font(.system(size: 10))
                        .foregroundColor(.white)
                        .frame(width: labelW, alignment: .trailing)
                    ForEach(poses.indices, id: \.self) { pi in
                        let p = poses[pi]
                        MochiCell(outfit: outfit, yaw: p.yaw, pitch: p.pitch,
                                  tilt: p.tilt, phys: p.phys, cellSize: p.size)
                            .background(pi == poses.count - 1
                                        ? Color.black
                                        : Color(red: 0.083, green: 0.090, blue: 0.106))
                            .clipShape(RoundedRectangle(cornerRadius: pi == poses.count - 1 ? 0 : 8))
                    }
                }
            }
        }
        .padding(12)
        .background(Color(red: 0.043, green: 0.047, blue: 0.055))
    }
}

// MARK: - Roll planche

private let rollOutfits: [Outfit] = [
    .none, .beanie, .santaHat, .witchHat, .crown,
    .sunglasses, .roundGlasses, .scarf, .bow, .pumpkin, .bunnyEars
]

private let rollValues: [CGFloat] = [0, CGFloat.pi/3, CGFloat.pi*2/3, CGFloat.pi, CGFloat.pi*4/3, CGFloat.pi*5/3]

struct RollGrid: View {
    var body: some View {
        VStack(alignment: .leading, spacing: gap) {
            // Column headers
            HStack(spacing: gap) {
                Spacer().frame(width: labelW)
                ForEach(rollValues.indices, id: \.self) { i in
                    Text(String(format: "%.2fπ", rollValues[i] / .pi))
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.gray)
                        .frame(width: 120, alignment: .center)
                }
            }
            ForEach(rollOutfits.indices, id: \.self) { oi in
                let outfit = rollOutfits[oi]
                HStack(spacing: gap) {
                    Text(outfit.rawValue)
                        .font(.system(size: 10))
                        .foregroundColor(.white)
                        .frame(width: labelW, alignment: .trail
```

### Core Architecture Module: `windows/hook/src/main.rs`
```
//! coucou-hook — the relay Claude Code runs on every hook event.
//!
//! Reads the hook JSON on stdin, adds a little terminal context, and hands it to
//! Coucou over the named pipe `\\.\pipe\coucou-<sid>` (Windows) or the Unix
//! socket `$XDG_RUNTIME_DIR/coucou.sock` (Linux).
//!
//! Hard rule (docs/CLAUDE.md): **never block Claude Code.**
//! * If the pipe does not exist — Coucou is closed — we exit 0 immediately with
//!   nothing on stdout, and the session carries on untouched.
//! * Every step runs under a deadline enforced by the main thread, so a pipe that
//!   accepts the connection and then stops reading cannot wedge the session
//!   either: we abandon the worker and exit.
//! * Only `PermissionRequest` waits for an answer, because approving from the
//!   island is the whole point. No answer means empty stdout, and Claude Code
//!   asks in the terminal exactly as if Coucou were not installed.
//!
//! Usage: `coucou-hook <EventName>` (the name is also read from the JSON).

use std::io::{Read, Write};
use std::sync::mpsc;
use std::time::Duration;

/// Budget for getting a pipe connection. Beyond this Claude Code wins, always.
const CONNECT_TIMEOUT: Duration = Duration::from_millis(300);
/// Whole-run budget for an event nobody waits on: connect and write, no more.
const FIRE_AND_FORGET_BUDGET: Duration = Duration::from_secs(2);
/// How long a permission prompt may stay on screen before the terminal takes over.
const DECISION_BUDGET: Duration = Duration::from_secs(110);

/// Fields that are pointless to forward and can be enormous (a whole file read,
/// a full command output). The island never shows them.
const DROPPED_FIELDS: &[&str] = &["tool_response", "transcript_path"];
/// Longest string forwarded for any single field; the island truncates to far
/// less than this anyway.
const MAX_FIELD_LEN: usize = 2_000;

#[cfg(windows)]
mod win;
#[cfg(windows)]
use win::connect;

#[cfg(target_os = "linux")]
mod unix;
#[cfg(target_os = "linux")]
use unix::connect;

fn main() {
    let Some((payload, event)) = read_event() else { std::process::exit(0) };

    let waits_for_answer = event == "PermissionRequest";
    let budget = if waits_for_answer { DECISION_BUDGET } else { FIRE_AND_FORGET_BUDGET };

    // The worker owns every blocking call. If it overruns the budget we simply
    // stop listening and exit: the process dying takes the pipe handle with it.
    // (No catch_unwind here — the release profile is panic = "abort", so it would
    // be dead code. `talk` is written to have nothing to panic on instead.)
    let (tx, rx) = mpsc::channel::<Option<String>>();
    std::thread::spawn(move || {
        let _ = tx.send(talk(&payload, waits_for_answer));
    });

    if let Ok(Some(decision)) = rx.recv_timeout(budget) {
        if let Some(json) = decision_json(&decision) {
            let mut out = std::io::stdout();
            let _ = writeln!(out, "{json}");
            let _ = out.flush();
        }
    }
    // Nothing printed: Claude Code asks in the terminal, as if we were not here.
    std::process::exit(0);
}

/// The documented PermissionRequest output. Anything we do not recognise prints
/// nothing at all rather than guessing — silence is the safe answer.
/// See https://code.claude.com/docs/en/hooks
fn decision_json(decision: &str) -> Option<String> {
    let behavior = match decision.trim() {
        // "always" still answers a plain allow; remembering it is the island's
        // business, not Claude Code's.
        "allow" | "always" => r#"{"behavior":"allow"}"#.to_string(),
        "deny" => r#"{"behavior":"deny","message":"Denied from Coucou"}"#.to_string(),
        _ => return None,
    };
    Some(format!(
        r#"{{"hookSpecificOutput":{{"hookEventName":"PermissionRequest","decision":{behavior}}}}}"#
    ))
}

/// Reads stdin and returns the payload to forward plus the event name.
fn read_event() -> Option<(String, String)> {
    let mut raw = Vec::new();
    if std::io::stdin().read_to_end(&mut raw).is_err() || raw.is_empty() {
        return None;
    }
    // Some shells hand us a UTF-8 BOM; serde_json would choke on it.
    if raw.starts_with(&[0xEF, 0xBB, 0xBF]) {
        raw.drain(..3);
    }

    let mut payload = serde_json::from_slice::<serde_json::Value>(&raw).ok()?;
    let map = payload.as_object_mut()?;

    // Parse argv: "coucou-hook.exe [--agent <name>] [<EventName>]"
    // --agent tags the payload with coucou_agent so the app routes to the right pill.
    // Absent or invalid names are validated and discarded by the app, not here.
    let mut agent = String::new();
    let mut arg_event = String::new();
    {
        let mut it = std::env::args().skip(1);
        while let Some(arg) = it.next() {
            if arg == "--agent" {
                agent = it.next().unwrap_or_default();
            } else if arg_event.is_empty() {
                arg_event = arg;
            }
        }
    }
    // Which agent this hook was installed for. Absent means Claude Code,
    // so existing hook commands keep working unchanged.
    if !agent.is_empty() {
        map.insert("coucou_agent".into(), serde_json::Value::String(agent));
    }
    let event = map
        .get("hook_event_name")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .filter(|s| !s.is_empty())
        .unwrap_or(arg_event);
    map.insert("hook_event_name".into(), serde_json::Value::String(event.clone()));

    for field in DROPPED_FIELDS {
        map.remove(*field);
    }

    let cwd_missing = map
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(str::is_empty)
        .unwrap_or(true);
    if cwd_missing {
        if let Ok(cwd) = std::env::current_dir() {
            map.insert(
                "cwd".into(),
                serde_json::Value::String(cwd.to_string_lossy().to_string()),
            );
        }
    }

    // Which terminal the session runs in. Unlike macOS, Coucou here accepts
    // events from every terminal, so this is context only — never a filter.
    for (key, var) in [
        ("term_program", "TERM_PROGRAM"),
        ("wt_session", "WT_SESSION"),
        ("term_session_id", "TERM_SESSION_ID"),
        ("vscode_pid", "VSCODE_PID"),
        ("session_pid", "CLAUDE_CODE_SSE_PORT"),
    ] {
        if !map.contains_key(key) {
            let value = std::env::var(var).unwrap_or_default();
            map.insert(key.into(), serde_json::Value::String(value));
        }
    }

    truncate_strings(&mut payload);

    let mut line = payload.to_string();
    line.push('\n');
    Some((line, event))
}

/// Caps every string in the payload. A single Write can carry a whole file.
fn truncate_strings(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::String(s) => {
            if s.len() > MAX_FIELD_LEN {
                // Cut on a char boundary; a lone byte index can split UTF-8.
                let mut end = MAX_FIELD_LEN;
                while end > 0 && !s.is_char_boundary(end) {
                    end -= 1;
                }
                s.truncate(end);
                s.push('…');
            }
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(truncate_strings),
        serde_json::Value::Object(map) => map.values_mut().for_each(truncate_strings),
        _ => {}
    }
}

/// Connect, send, and — for a permission request — wait for the island's word.
fn talk(payload: &str, waits_for_answer: bool) -> Option<String> {
    let mut pipe = connect()?;

    if pipe.write_all(payload.as_bytes()).is_err() {
        return None;
    }
    let _ = pipe.flush();

    if !waits_for_answer {
        return None;
    }

    let mut buf = Vec::new();
    let mut chunk = [0u8; 1024];
    loop {
        match pipe.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                buf.extend_from_slice(&chunk[..n]);
                if buf.contains(&b'\n') {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    let answer = String::from_utf8_lossy(&buf).trim().to_string();
    (!answer.is_empty()).then_some(answer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decision_json_matches_the_documented_shape() {
        assert_eq!(
            decision_json("allow").unwrap(),
            r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}"#
        );
        assert_eq!(
            decision_json("deny").unwrap(),
            r#"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"Denied from Coucou"}}}"#
        );
        // "always" is an island concept; Claude Code just gets an allow.
        assert!(decision_json("always").unwrap().contains(r#""behavior":"allow""#));
    }

    #[test]
    fn anything_unrecognised_prints_nothing() {
        assert!(decision_json("").is_none());
        assert!(decision_json("maybe").is_none());
        // The shape the app used to send must not be mistaken for a decision.
        assert!(decision_json(r#"{"permissionDecision":"allow"}"#).is_none());
    }

    #[test]
    fn long_strings_are_cut_on_a_char_boundary() {
        let mut v = serde_json::json!({ "tool_input": { "content": "é".repeat(4000) } });
        truncate_strings(&mut v);
        let s = v["tool_input"]["content"].as_str().unwrap();
        assert!(s.len() <= MAX_FIELD_LEN + 4);
        assert!(s.ends_with('…'));
    }
}

```

### Core Architecture Module: `windows/hook/src/unix.rs`
```
//! The Linux transport: a Unix socket in the user's runtime directory.
//!
//! `$XDG_RUNTIME_DIR` is private to the user (mode 0700), so nobody else can
//! even reach the socket. We still check, once connected, that the process on
//! the other end runs as us — the same promise the Windows relay makes with the
//! pipe server's SID, for the same price.

use std::io;
use std::os::unix::ffi::OsStrExt;
use std::os::unix::io::{AsRawFd, FromRawFd};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use crate::CONNECT_TIMEOUT;

/// `$XDG_RUNTIME_DIR/coucou.sock`, or `/run/user/<uid>/coucou.sock` when the
/// variable is missing (a hook started from a stripped-down environment). The
/// directory must be ours and closed to everyone else, or there is no relay.
/// Must match `platform::relay_socket_path()` in the app exactly.
fn socket_path() -> Option<PathBuf> {
    let dir = std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
        .unwrap_or_else(|| PathBuf::from(format!("/run/user/{}", unsafe { libc::getuid() })));
    is_private_dir(&dir).then(|| dir.join("coucou.sock"))
}

/// A real directory (not a symlink), owned by us, no access for group or others.
fn is_private_dir(dir: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;
    std::fs::symlink_metadata(dir)
        .map(|m| {
            m.file_type().is_dir() && m.uid() == unsafe { libc::getuid() } && m.mode() & 0o077 == 0
        })
        .unwrap_or(false)
}

/// Opens the socket. Retries only while the app's backlog is full: any other
/// error — no socket, nobody listening — means there is nothing to talk to, and
/// waiting would only delay Claude Code.
pub fn connect() -> Option<UnixStream> {
    let path = socket_path()?;
    let deadline = Instant::now() + CONNECT_TIMEOUT;
    loop {
        match try_connect(&path) {
            // Somebody else's server on our socket gets nothing from us.
            Ok(stream) => return server_is_same_user(&stream).then_some(stream),
            Err(err) => {
                if err.raw_os_error() != Some(libc::EAGAIN) || Instant::now() >= deadline {
                    return None;
                }
                std::thread::sleep(Duration::from_millis(15));
            }
        }
    }
}

/// A non-blocking connect, so a full backlog answers EAGAIN at once instead of
/// parking us until the app gets round to accepting. Blocking again afterwards:
/// the main thread's budget bounds every read and write.
fn try_connect(path: &Path) -> io::Result<UnixStream> {
    let fd = unsafe {
        libc::socket(libc::AF_UNIX, libc::SOCK_STREAM | libc::SOCK_CLOEXEC | libc::SOCK_NONBLOCK, 0)
    };
    if fd < 0 {
        return Err(io::Error::last_os_error());
    }
    // Owns the descriptor from here on, so every early return closes it.
    let stream = unsafe { UnixStream::from_raw_fd(fd) };

    let mut addr: libc::sockaddr_un = unsafe { std::mem::zeroed() };
    addr.sun_family = libc::AF_UNIX as libc::sa_family_t;
    let bytes = path.as_os_str().as_bytes();
    // Room for the terminating NUL, which zeroed() already put there.
    if bytes.len() >= addr.sun_path.len() {
        return Err(io::Error::from(io::ErrorKind::InvalidInput));
    }
    for (dst, src) in addr.sun_path.iter_mut().zip(bytes) {
        *dst = *src as libc::c_char;
    }

    let rc = unsafe {
        libc::connect(
            fd,
            &addr as *const libc::sockaddr_un as *const libc::sockaddr,
            std::mem::size_of::<libc::sockaddr_un>() as libc::socklen_t,
        )
    };
    if rc != 0 {
        return Err(io::Error::last_os_error());
    }
    stream.set_nonblocking(false)?;
    Ok(stream)
}

/// True when the process serving the socket runs as the same user we do.
/// A failure to answer is treated as "not ours", as on Windows.
fn server_is_same_user(stream: &UnixStream) -> bool {
    let mut cred: libc::ucred = unsafe { std::mem::zeroed() };
    let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
    let rc = unsafe {
        libc::getsockopt(
            stream.as_raw_fd(),
            libc::SOL_SOCKET,
            libc::SO_PEERCRED,
            &mut cred as *mut libc::ucred as *mut libc::c_void,
            &mut len,
        )
    };
    rc == 0
        && len as usize == std::mem::size_of::<libc::ucred>()
        && cred.uid == unsafe { libc::getuid() }
}

```

### Core Architecture Module: `windows/hook/src/win.rs`
```
//! The little bit of Win32 the relay needs: who we are, and who is on the other
//! end of the pipe.
//!
//! Named pipes live in a machine-wide namespace, so `\\.\pipe\coucou-<name>` can
//! be created by *any* account that gets there first. Two defences, both cheap:
//! the pipe name carries our SID, and once connected we check the server process
//! really belongs to us before sending anything.

use std::time::{Duration, Instant};

use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, HANDLE, LocalFree, HLOCAL};
use windows::Win32::Security::Authorization::ConvertSidToStringSidW;
use windows::Win32::Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER};
use windows::Win32::System::Pipes::GetNamedPipeServerProcessId;
use windows::Win32::System::Threading::{
    GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
};

use crate::CONNECT_TIMEOUT;

/// `ERROR_PIPE_BUSY` — every instance is serving someone else right now. This is
/// the one error worth retrying: the server exists and a slot will free up.
const ERROR_PIPE_BUSY: i32 = 231;

/// `\\.\pipe\coucou-<sid>`. The SID keeps two accounts on the same machine from
/// ever meeting on the same pipe; the name falls back to the user name only if
/// the SID cannot be read at all, which should not happen.
fn pipe_path() -> String {
    let key = current_user_sid()
        .unwrap_or_else(|| std::env::var("USERNAME").unwrap_or_else(|_| "user".into()));
    format!(r"\\.\pipe\coucou-{key}")
}

/// Opens the pipe. Retries only while the server is busy: any other error means
/// there is nothing to talk to, and waiting would only delay Claude Code.
pub fn connect() -> Option<std::fs::File> {
    use std::os::windows::io::AsRawHandle;
    let path = pipe_path();
    let deadline = Instant::now() + CONNECT_TIMEOUT;
    loop {
        match std::fs::OpenOptions::new().read(true).write(true).open(&path) {
            Ok(file) => {
                let handle = HANDLE(file.as_raw_handle());
                // Somebody else's server on our pipe name gets nothing from us.
                return pipe_server_is_same_user(handle).then_some(file);
            }
            Err(err) => {
                if err.raw_os_error() != Some(ERROR_PIPE_BUSY) || Instant::now() >= deadline {
                    return None;
                }
                std::thread::sleep(Duration::from_millis(15));
            }
        }
    }
}

/// The SID of the account this process runs as, as `S-1-5-21-…`.
pub fn current_user_sid() -> Option<String> {
    unsafe { token_sid(GetCurrentProcess()) }
}

/// True when the process serving `handle` runs as the same user we do.
///
/// A failure to answer is treated as "not ours": refusing to talk to a pipe we
/// cannot vouch for costs one hook event, while trusting it could hand another
/// account on this machine the contents of every tool call.
pub fn pipe_server_is_same_user(handle: HANDLE) -> bool {
    let Some(mine) = current_user_sid() else { return false };
    unsafe {
        let mut pid = 0u32;
        if GetNamedPipeServerProcessId(handle, &mut pid).is_err() || pid == 0 {
            return false;
        }
        let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return false;
        };
        let theirs = token_sid(process);
        let _ = CloseHandle(process);
        theirs.as_deref() == Some(mine.as_str())
    }
}

/// The user SID behind a process handle. `process` is borrowed, never closed.
unsafe fn token_sid(process: HANDLE) -> Option<String> {
    let mut token = HANDLE::default();
    OpenProcessToken(process, TOKEN_QUERY, &mut token).ok()?;

    // First call sizes the buffer, second fills it.
    let mut needed = 0u32;
    let _ = GetTokenInformation(token, TokenUser, None, 0, &mut needed);
    if needed == 0 {
        let _ = CloseHandle(token);
        return None;
    }
    let mut buf = vec![0u8; needed as usize];
    let ok = GetTokenInformation(
        token,
        TokenUser,
        Some(buf.as_mut_ptr().cast()),
        needed,
        &mut needed,
    )
    .is_ok();
    let _ = CloseHandle(token);
    if !ok {
        return None;
    }

    let user = &*(buf.as_ptr() as *const TOKEN_USER);
    let mut text = PWSTR::null();
    ConvertSidToStringSidW(user.User.Sid, &mut text).ok()?;
    let sid = text.to_string().ok();
    let _ = LocalFree(Some(HLOCAL(text.0 as *mut _)));
    sid
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #103** (2026-10-02): **Defender flags Windows 0.1.1 setup.exe as Trojan:Win32/Wacatac.C!ml**
  *Symptoms*: *What happened* Windows Defender flagged Coucou-Windows-0.1.1-setup.exe as Trojan:Win32/Wacatac.C!ml (Severity: Severe) and removed it right after I downloaded it from the GitHub release. I never ran the file.  *What I expected* The installer to download without being flagged.  *How to reproduce* Download Coucou-Windows-0.1.1-setup.exe from the Windows 0.1.1 release on Windows 11 with Defender enabled.  *Environment* - OS: Windows 11 (ASUS TUF Gaming laptop) - Coucou version: Windows 0.1.1 - Browser used to download: Brave  *Question* Is this a known false positive? Are there plans to code-sign the installer?
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, and good call not running it. It's a known false positive on the unsigned installer: a report is under review at Microsoft, and I've pulled the Windows installer from Releases until it's cleared and signed. In the meantime you can build it from source in a few minutes: https://github.com/Louis-CFM/coucou/tree/main/windows#build-it-yourself

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

### Incident Patch 1: `eee14d06` (2026-10-06)
**Commit Message**: Get Coucou on your iPhone: guide, README, website page and FAQ (#257)

- docs/IPHONE.md: requirements, install, what you can do, privacy,
  troubleshooting and how to build the iPhone app yourself.
- README: iPhone install steps, a Setup row and links to the guide.
- Website: an iPhone page (English and French), in every page's nav, a
  button on the home page and two FAQ entries on the support page.


Claude-Session: https://claude.ai/code/session_016qkcwzfTWvbmbc2y9dur6p

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +12/-0)
```diff
@@ -79,6 +79,8 @@ The Mac app does the work; the iPhone app keeps you in the loop when you step aw
 - 🫧 **Liquid Glass, native to the bone** — SwiftUI, tabs, zoom transitions, context menus, swipe actions, alternate icons, Mochi at 120 Hz.
 - 🔒 **Through your own iCloud** — sessions sync through your private CloudKit database; project names, commands and questions are encrypted with your iCloud keys. No Coucou server sees your projects, commands or keys. Turn it on in the Mac app: Settings → General → iPhone.
 
+**Get it on your iPhone in 3 steps:** install Coucou on your iPhone ([App Store or TestFlight](#iphone)), turn on **Settings → General → iPhone** in the Mac app (0.1.8 or later), and use the same Apple Account in iCloud on both. Full guide, troubleshooting and build-it-yourself: [docs/IPHONE.md](docs/IPHONE.md).
+
 <table>
 <tr>
 <td><img src="docs/media/claude-code.png" alt="Claude Code session"></td>
@@ -116,6 +118,15 @@ Coucou is coming to the **Mac App Store** and the **iPhone App Store**: one clic
 
 The App Store build of the Mac app runs in Apple's sandbox, so a few features stay in the GitHub build: Claude plan usage, the Apple Music pill and attaching the front window to the chat.
 
+### iPhone
+
+1. **Install Coucou on your iPhone** (iOS 18 or later): from the App Store once it's out, or the TestFlight beta. Both links will be here.
+2. **On your Mac**, with Coucou 0.1.8 or later: **Settings… → General → iPhone**, turn on **Show my agent sessions on my iPhone**, and **Move Mochi to my iPhone's Dynamic Island when my Mac is locked** for the Lock Screen.
+3. **Same Apple Account** in iCloud on the Mac and the iPhone. That's the whole link: no account, no pairing code.
+4. Open Coucou on the iPhone, allow notifications, and start a Claude Code session on the Mac.
+
+Everything else, troubleshooting included, is in [docs/IPHONE.md](docs/IPHONE.md).
+
 ### Download for macOS
 
 1. Grab the latest `Coucou.zip` from [Releases](https://github.com/Louis-CFM/coucou/releases).
@@ -197,6 +208,7 @@ Click the Coucou icon in the menu bar (macOS) or in the system tray (Windows, Li
 | **OpenAI API key** *(macOS)* | chat with OpenAI | Settings → Chat — other providers · Keychain |
 | **Ollama server** *(macOS)* | chat with local models via Ollama | Settings → Chat → Local models → **Connect** |
 | **LM Studio server** *(macOS)* | chat with local models via LM Studio | Settings → Chat → Local models → **Connect** |
+| **iPhone** *(macOS)* | sessions, approvals, questions and Mochi on your iPhone | Settings → General → iPhone · your private iCloud, see [docs/IPHONE.md](docs/IPHONE.md) |
 | **Active pills** *(macOS)* | choose which tools and agents appear in the island | Settings → Active pills |
 | Stripe, n8n, GitHub, Vercel, Resend, Notion, Cal.com | the service pills | Keychain / Windows Credential Manager / Secret Service, all optional |
 
```

**File**: `docs/IPHONE.md` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+# Coucou on iPhone
+
+Your Mac does the work, your iPhone keeps you in the loop when you step away: your agent sessions live, permission requests you can answer from the Lock Screen, Claude's questions, the next instruction, and your services up close.
+
+<p align="center"><img src="media/iphone-live-activity.jpg" width="520" alt="Mochi on the Lock Screen, waiting for your OK with Deny and Allow"></p>
+
+## What you need
+
+| | |
+|---|---|
+| **Mac** | Coucou **0.1.8 or later** on macOS 15+: the [GitHub build](https://github.com/Louis-CFM/coucou/releases/latest), or the Mac App Store version once it is out |
+| **iPhone** | iOS 18 or later. The Lock Screen and Dynamic Island need an iPhone with a Dynamic Island for the island part; every iPhone gets the Lock Screen |
+| **iCloud** | The **same Apple Account** signed in to iCloud on the Mac and the iPhone. That's the whole link: no account to create, no server, no pairing code |
+| **Coucou on iPhone** | From the App Store (coming soon) or the TestFlight beta (link below when it opens) |
+
+## Get it on your iPhone
+
+1. **Install Coucou on your iPhone.**
+   - **App Store:** coming soon, the link will be here.
+   - **TestFlight beta:** install [TestFlight](https://apps.apple.com/app/testflight/id899247664) from the App Store, then open the Coucou beta link when it is shared here.
+2. **Update Coucou on your Mac** to 0.1.8 or later.
+3. **On the Mac:** click the Coucou icon in the menu bar → **Settings… → General → iPhone**, and turn on:
+   - **Show my agent sessions on my iPhone** (required)
+   - **Move Mochi to my iPhone's Dynamic Island when my Mac is locked** (the Live Activity)
+   - **Let my iPhone send instructions to Claude Code** (GitHub build only, optional)
+4. **On the iPhone:** open Coucou and allow notifications. That's how permission requests, questions and finished turns reach you.
+5. **Start a Claude Code session on the Mac.** It shows up on the iPhone within a few seconds.
+
+Nothing shows up? See [Troubleshooting](#troubleshooting).
+
+## What you can do
+
+| On the iPhone | How |
+|---|---|
+| **Follow every session live** | Agents tab: each agent's Mochi, its state and steps. Tap one for the last turn: the prompt, what it did (commands and their output), the files it changed with their diffs, and Claude's answer |
+| **Allow or Deny a permission** | From the notification, the Lock Screen (Live Activity) or the app. Allow asks for Face ID. Your Mac only applies a decision meant for the exact command it is waiting on, and a request expires after 2 minutes |
+| **Answer Claude's questions** | `AskUserQuestion` prompts arrive as a notification with one button per choice, or open the app to answer several at once |
+| **Send the next instruction** | Type or dictate in the session screen (GitHub build of the Mac app, with the instructions switch on). Your Mac picks it up within 15 seconds and continues the session in its own folder |
+| **Mochi on the Lock Screen** | Lock your Mac while an agent works: Mochi moves to the Lock Screen and the Dynamic Island, then comes back to the notch when you unlock |
+| **Your services up close** | Services tab: GitHub, Vercel, Stripe, Cal.com, n8n, Notion, Resend. Your Mac reads their APIs with the keys in its Keychain. Safe actions (re-run failed CI, approve or merge a pull request, redeploy or promote on Vercel, pause or retry an n8n workflow) ask for Face ID first. Nothing that moves money or sends an email |
+| **Widgets** | Home Screen and Lock Screen widgets: one Mochi, the team of four, or the list of agents and services |
+| **Siri and Shortcuts** | "What are my agents doing in Coucou", "Ask Claude in Coucou" |
+| **Control Center** | A control that opens the agent that needs you |
+| **Spotlight** | Search the turns you've seen (can be turned off in the app's settings) |
+| **Focus** | A Focus filter that only lets approvals and questions through |
+| **History** | Your past decisions and turns, grouped by day |
+
+## Privacy
+
+- Your sessions go from your Mac to **your own private iCloud database**, and from there to your iPhone. Project names, commands, paths, questions and turns are encrypted with your iCloud keys.
+- **No API key ever leaves your Mac.** The services screen shows what your Mac read; actions are run by your Mac.
+- The Live Activity goes through a small relay ([`relay/`](../relay/)) that holds Apple's push key. It only sees the agent's name and state, never a project name, a command or a path, and it stores and logs nothing.
+- No account, no analytics. Turning the iPhone switch off on the Mac deletes your sessions from iCloud.
+
+Details in the [privacy policy](https://louis-cfm.github.io/coucou/privacy.html).
+
+## Troubleshooting
+
+**Nothing shows up on the iPhone**
+- The Mac and the iPhone must use the **same Apple Account** in iCloud (Settings → your name on the iPhone, System Settings → your name on the Mac).
+- On the Mac, **Settings → General → 
```

**File**: `docs/index.html` (modified, +2/-1)
```diff
@@ -1,7 +1,7 @@
 <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>A tiny friend in your notch — Coucou</title><link rel="icon" href="media/icon.png"><link rel="stylesheet" href="site.css"></head><body><div class="wrap">
 <header><a href="index.html"><img src="media/icon.png" alt=""></a><span class="name">Coucou</span>
-<nav><a href="index.html" class="on">Home</a><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="legal.html">Legal</a></nav></header>
+<nav><a href="index.html" class="on">Home</a><a href="iphone.html">iPhone</a><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="legal.html">Legal</a></nav></header>
 <div class="hero">
 <h1>A tiny friend that lives in your notch</h1>
 <p class="meta" style="font-size:17px">Coucou watches your AI coding agents — Claude Code, Codex, Cursor, Gemini CLI, Antigravity and more — lets you approve Claude Code and Codex requests from the notch, chat with Anthropic, Google AI or OpenAI, keeps an eye on Stripe, GitHub, Vercel, n8n and more, and follows you to your iPhone. Free and open source.</p>
@@ -21,6 +21,7 @@ <h2>Now on iPhone</h2>
 <li><b>Through your own iCloud:</b> no Coucou server sees your projects, commands or keys.</li>
 </ul>
 <p class="meta">Coming to the Mac App Store and the App Store: one click to install, automatic updates, and the iPhone pairs with your Mac through iCloud. Until then, download the Mac app from GitHub.</p>
+<p style="text-align:center"><a class="btn" href="iphone.html">Get Coucou on your iPhone</a></p>
 <div class="card"><b>Private by design.</b> No account, no analytics, no tracking. Your keys stay in your Keychain, Windows Credential Manager or the Linux Secret Service. <a href="privacy.html">Read the privacy policy</a>.</div>
 <p class="meta">Requires macOS 15 or later. No notch? Mochi sits in a small bar at the top of the screen. The Windows download is paused for now: Microsoft Defender wrongly flags the unsigned installer, and it will come back once that’s fixed. Windows users can <a href="https://github.com/Louis-CFM/coucou/tree/main/windows#build-it-yourself">build it from source</a>. Linux: a beta is out (AppImage, .deb, .rpm), <a href="https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.1.1">download it here</a>.</p>
 <footer>© 2026 Louis Raillé · Coucou is free and open source (MIT) · <a href="https://github.com/Louis-CFM/coucou">GitHub</a> · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="legal.html">Legal notice</a></footer></div></body></html>
```

**File**: `docs/iphone.html` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
+<title>Coucou on iPhone</title><link rel="icon" href="media/icon.png"><link rel="stylesheet" href="site.css"></head><body><div class="wrap">
+<header><a href="index.html"><img src="media/icon.png" alt=""></a><span class="name">Coucou</span>
+<nav><a href="index.html">Home</a><a href="iphone.html" class="on">iPhone</a><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="legal.html">Legal</a></nav></header>
+<div class="lang"><a href="#en">English</a><a href="#fr">Français</a></div>
+<section id="en">
+<h1>Coucou on iPhone</h1>
+<div class="meta">Your Mac does the work, your iPhone keeps you in the loop when you step away.</div>
+<img src="media/iphone-live-activity.jpg" style="width:100%;max-width:520px;border-radius:14px;display:block;margin:16px auto" alt="Mochi on the Lock Screen, waiting for your OK with Deny and Allow">
+
+<h2>What you need</h2>
+<ul>
+<li><b>Mac:</b> Coucou 0.1.8 or later on macOS 15+ (<a href="https://github.com/Louis-CFM/coucou/releases/latest">download</a>, or the Mac App Store version once it’s out).</li>
+<li><b>iPhone:</b> iOS 18 or later.</li>
+<li><b>iCloud:</b> the same Apple Account on the Mac and the iPhone. That’s the whole link: no account to create, no pairing code.</li>
+</ul>
+
+<h2>Get it on your iPhone</h2>
+<ol>
+<li><b>Install Coucou on your iPhone:</b> from the App Store once it’s out, or the TestFlight beta. Both links will be on this page.</li>
+<li><b>On your Mac:</b> Coucou icon in the menu bar → <b>Settings… → General → iPhone</b>, turn on <b>Show my agent sessions on my iPhone</b>, and <b>Move Mochi to my iPhone’s Dynamic Island when my Mac is locked</b> for the Lock Screen.</li>
+<li><b>On the iPhone:</b> open Coucou and allow notifications.</li>
+<li><b>Start a Claude Code session on the Mac:</b> it shows up on the iPhone within seconds.</li>
+</ol>
+
+<h2>What you can do</h2>
+<ul>
+<li><b>Allow or Deny</b> a permission from the notification, the Lock Screen or the app. Allow asks for Face ID, and your Mac only applies a decision meant for the exact command it is waiting on.</li>
+<li><b>Answer Claude’s questions</b> with one tap.</li>
+<li><b>Follow every session live:</b> the prompt, the commands, the diffs and Claude’s answer.</li>
+<li><b>Send the next instruction</b> by text or voice (GitHub build of the Mac app).</li>
+<li><b>Mochi on the Lock Screen and in the Dynamic Island</b> while your Mac is locked.</li>
+<li><b>Your services up close</b> (GitHub, Vercel, Stripe, Cal.com, n8n, Notion, Resend), with safe actions behind Face ID: re-run CI, merge a pull request, redeploy, pause a workflow. Nothing that moves money or sends an email.</li>
+<li><b>Widgets, Control Center, Siri and Shortcuts, Spotlight and a Focus filter.</b></li>
+</ul>
+
+<div class="card"><b>Private by design.</b> Your sessions go from your Mac to your own private iCloud, encrypted with your iCloud keys. No API key leaves your Mac, and no Coucou server sees your projects, commands or paths. <a href="privacy.html">Read the privacy policy</a>.</div>
+
+<h2>Troubleshooting</h2>
+<h3>Nothing shows up</h3>
+<p>Check that the Mac and the iPhone use the same Apple Account in iCloud, that <b>Show my agent sessions on my iPhone</b> is on in the Mac app (0.1.8 or later), then pull down on the Agents tab to refresh.</p>
+<h3>No notifications</h3>
+<p>iPhone <b>Settings → Notifications → Coucou</b>: allow them. A Focus mode or Coucou’s quiet hours can hide them.</p>
+<h3>Mochi doesn’t come to the Lock Screen</h3>
+<p>Turn on the Dynamic Island switch on the Mac, and iPhone <b>Settings → Coucou → Live Activities</b>. Open Coucou on the iPhone once after installing it. iOS limits how often an app can start a Live Activity: after many lock cycles in a row it may skip a few, then it comes back on its own.</p>
+<p>The full guide, with how to build the iPhone app yourself, is on <a href="https://github.com/Louis-CFM/coucou/blob/main/docs/IPHONE.md">GitHub</a>. Still stuck? <a href="support.html">Support</a>.</p>
+</section>
+<hr>
+<section id="fr" lang="fr">
+<h1>Coucou sur iPhone</h1>
+<div class="meta">Ton Mac fait le travail, ton iPhone te tient au courant quand tu t’éloignes.</div>
+
+<h2>Ce qu’il te faut</h2>
+<ul>
+<li><b>Mac :</b> Coucou 0.1.8 ou plus récent sur macOS 15+ (<a href="https://github.com/Louis-CFM/coucou/releases/latest">télécharger</a>, ou la version Mac App Store dès qu’elle sort).</li>
+<li><b>iPhone :</b> iOS 18 ou plus récent.</li>
+<li><b>iCloud :</b> le même compte Apple sur le Mac et l’iPhone. C’est tout le lien : pas de compte à créer, pas de code d’appairage.</li>
+</ul>
+
+<h2>L’installer sur ton iPhone</h2>
+<ol>
+<li><b>Installe Coucou sur ton iPhone :</b> depuis l’App Store dès sa sortie, ou la bêta TestFlight. Les deux liens seront sur cette page.</li>
+<li><b>Sur ton
```

**File**: `docs/legal.html` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 <!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>Legal notice — Coucou</title><link rel="icon" href="media/icon.png"><link rel="stylesheet" href="site.css"></head><body><div class="wrap">
 <header><a href="index.html"><img src="media/icon.png" alt=""></a><span class="name">Coucou</span>
-<nav><a href="index.html">Home</a><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="legal.html" class="on">Legal</a></nav></header>
+<nav><a href="index.html">Home</a><a href="iphone.html">iPhone</a><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="legal.html" class="on">Legal</a></nav></header>
 <div class="lang"><a href="#fr">Français</a><a href="#en">English</a></div>
 <section id="fr" lang="fr">
 <h1>Mentions légales</h1>
```

**File**: `docs/privacy.html` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>Privacy Policy — Coucou</title><link rel="icon" href="media/icon.png"><link rel="stylesheet" href="site.css"></head><body><div class="wrap">
 <header><a href="index.html"><img src="media/icon.png" alt=""></a><span class="name">Coucou</span>
-<nav><a href="index.html">Home</a><a href="support.html">Support</a><a href="privacy.html" class="on">Privacy</a><a href="terms.html">Terms</a><a href="legal.html">Legal</a></nav></header>
+<nav><a href="index.html">Home</a><a href="iphone.html">iPhone</a><a href="support.html">Support</a><a href="privacy.html" class="on">Privacy</a><a href="terms.html">Terms</a><a href="legal.html">Legal</a></nav></header>
 <div class="lang"><a href="#en">English</a><a href="#fr">Français</a></div>
 <section id="en">
 <h1>Privacy Policy</h1>
```

**File**: `docs/support.html` (modified, +9/-1)
```diff
@@ -1,7 +1,7 @@
 <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>Support — Coucou</title><link rel="icon" href="media/icon.png"><link rel="stylesheet" href="site.css"></head><body><div class="wrap">
 <header><a href="index.html"><img src="media/icon.png" alt=""></a><span class="name">Coucou</span>
-<nav><a href="index.html">Home</a><a href="support.html" class="on">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="legal.html">Legal</a></nav></header>
+<nav><a href="index.html">Home</a><a href="iphone.html">iPhone</a><a href="support.html" class="on">Support</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="legal.html">Legal</a></nav></header>
 <div class="lang"><a href="#en">English</a><a href="#fr">Français</a></div>
 <section id="en">
 <h1>Support</h1>
@@ -11,6 +11,10 @@ <h1>Support</h1>
 <b>Email:</b> <a href="mailto:raillelouis@gmail.com">raillelouis@gmail.com</a>
 </div>
 <h2>FAQ</h2>
+<h3>How do I get Coucou on my iPhone?</h3>
+<p>Install the iPhone app (App Store once it’s out, or the TestFlight beta), turn on <b>Settings → General → iPhone</b> in the Mac app (0.1.8 or later), and use the same Apple Account in iCloud on both. Step by step and troubleshooting: <a href="iphone.html">Coucou on iPhone</a>.</p>
+<h3>My sessions don’t show up on the iPhone</h3>
+<p>Check that the Mac and the iPhone use the same Apple Account in iCloud and that <b>Show my agent sessions on my iPhone</b> is on in the Mac app, then pull down on the Agents tab to refresh. More in <a href="iphone.html">Coucou on iPhone</a>.</p>
 <h3>macOS says it can’t verify the app</h3>
 <p>Coucou 0.1.1 and later are notarized by Apple: macOS only asks you to confirm the first launch. If you still have 0.1.0, open <b>System Settings → Privacy &amp; Security</b>, scroll down and click <b>Open Anyway</b>, or update to the latest version.</p>
 <h3>After updating, macOS asks to let Coucou use my keys</h3>
@@ -58,6 +62,10 @@ <h1>Assistance</h1>
 <b>E-mail :</b> <a href="mailto:raillelouis@gmail.com">raillelouis@gmail.com</a>
 </div>
 <h2>Questions fréquentes</h2>
+<h3>Comment avoir Coucou sur mon iPhone ?</h3>
+<p>Installe l’app iPhone (l’App Store dès sa sortie, ou la bêta TestFlight), active <b>Settings → General → iPhone</b> dans l’app Mac (0.1.8 ou plus récent), et utilise le même compte Apple dans iCloud sur les deux. Étape par étape et dépannage : <a href="iphone.html#fr">Coucou sur iPhone</a>.</p>
+<h3>Mes sessions n’apparaissent pas sur l’iPhone</h3>
+<p>Vérifie que le Mac et l’iPhone utilisent le même compte Apple dans iCloud et que <b>Show my agent sessions on my iPhone</b> est activé dans l’app Mac, puis tire vers le bas sur l’onglet Agents pour actualiser. Plus de détails dans <a href="iphone.html#fr">Coucou sur iPhone</a>.</p>
 <h3>macOS dit qu’il ne peut pas vérifier l’app</h3>
 <p>Coucou 0.1.1 et les versions suivantes sont notarisées par Apple : macOS te demande seulement de confirmer le premier lancement. Si tu as encore la 0.1.0, ouvre <b>Réglages Système → Confidentialité et sécurité</b>, descends et clique sur <b>Ouvrir quand même</b>, ou installe la dernière version.</p>
 <h3>Après la mise à jour, macOS demande d’autoriser Coucou à utiliser mes clés</h3>
```

**File**: `docs/terms.html` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <title>Terms of Use — Coucou</title><link rel="icon" href="media/icon.png"><link rel="stylesheet" href="site.css"></head><body><div class="wrap">
 <header><a href="index.html"><img src="media/icon.png" alt=""></a><span class="name">Coucou</span>
-<nav><a href="index.html">Home</a><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html" class="on">Terms</a><a href="legal.html">Legal</a></nav></header>
+<nav><a href="index.html">Home</a><a href="iphone.html">iPhone</a><a href="support.html">Support</a><a href="privacy.html">Privacy</a><a href="terms.html" class="on">Terms</a><a href="legal.html">Legal</a></nav></header>
 <div class="lang"><a href="#en">English</a><a href="#fr">Français</a></div>
 <section id="en">
 <h1>Terms of Use</h1>
```

---

### Incident Patch 2: `66df17b0` (2026-10-06)
**Commit Message**: iPhone: Liquid Glass, tabs, zoom, gestures, icons, Spotlight, Focus, services with actions, intro (#251)

* iPhone: Liquid Glass, tabs, zoom transitions, gestures, icons, Spotlight, Focus

- Tabs (Agents, Services, History, Search) with the agent that needs you
  above them, like Music's mini player (iOS 26).
- Liquid Glass cards and buttons on iOS 26, the dark material before; the
  island at the top grows Allow / Deny when a command waits (glass morphing).
- The Mochi tile zooms into the session; the agent's color moves softly
  behind it (MeshGradient); the header shrinks as the list scrolls.
- Symbols that move with the state; Apple Pay's drawn checkmark on Allow.
- Swipe right to allow (Face ID), left to deny; long press for a peek at
  the last turn.
- Search through every turn; finished turns in Spotlight (local index,
  can be turned off).
- Dark and tinted app icons, and Mochi in five other colors to pick.
- A Coucou Focus filter: only approvals and questions during a Focus.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016qkcwzfTWvbmbc2y9dur6p

* Approval panel the iOS way, a softer session glow, Live Activity alerts

-

**File**: `NotchBuddy/PhoneAssets.xcassets/AppIcon-Blue.appiconset/Contents.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "images" : [
+    {
+      "filename" : "icon-1024.png",
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    }
+  ],
+  "info" : { "author" : "xcode", "version" : 1 }
+}
```

**File**: `NotchBuddy/PhoneAssets.xcassets/AppIcon-Graphite.appiconset/Contents.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "images" : [
+    {
+      "filename" : "icon-1024.png",
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    }
+  ],
+  "info" : { "author" : "xcode", "version" : 1 }
+}
```

**File**: `NotchBuddy/PhoneAssets.xcassets/AppIcon-Green.appiconset/Contents.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "images" : [
+    {
+      "filename" : "icon-1024.png",
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    }
+  ],
+  "info" : { "author" : "xcode", "version" : 1 }
+}
```

**File**: `NotchBuddy/PhoneAssets.xcassets/AppIcon-Pink.appiconset/Contents.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "images" : [
+    {
+      "filename" : "icon-1024.png",
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    }
+  ],
+  "info" : { "author" : "xcode", "version" : 1 }
+}
```

**File**: `NotchBuddy/PhoneAssets.xcassets/AppIcon-Purple.appiconset/Contents.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "images" : [
+    {
+      "filename" : "icon-1024.png",
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    }
+  ],
+  "info" : { "author" : "xcode", "version" : 1 }
+}
```

**File**: `NotchBuddy/PhoneAssets.xcassets/AppIcon.appiconset/Contents.json` (modified, +14/-0)
```diff
@@ -5,6 +5,20 @@
       "idiom" : "universal",
       "platform" : "ios",
       "size" : "1024x1024"
+    },
+    {
+      "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ],
+      "filename" : "icon-1024-dark.png",
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
+    },
+    {
+      "appearances" : [ { "appearance" : "luminosity", "value" : "tinted" } ],
+      "filename" : "icon-1024-tinted.png",
+      "idiom" : "universal",
+      "platform" : "ios",
+      "size" : "1024x1024"
     }
   ],
   "info" : { "author" : "xcode", "version" : 1 }
```

**File**: `NotchBuddy/PhoneAssets.xcassets/IconPreview-Blue.imageset/Contents.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{
+  "images": [
+    {
+      "filename": "preview.png",
+      "idiom": "universal"
+    }
+  ],
+  "info": {
+    "author": "xcode",
+    "version": 1
+  }
+}
\ No newline at end of file
```

**File**: `NotchBuddy/PhoneAssets.xcassets/IconPreview-Graphite.imageset/Contents.json` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+{
+  "images": [
+    {
+      "filename": "preview.png",
+      "idiom": "universal"
+    }
+  ],
+  "info": {
+    "author": "xcode",
+    "version": 1
+  }
+}
\ No newline at end of file
```

---

### Incident Patch 3: `2d3a1692` (2026-10-04)
**Commit Message**: iPhone steps 1–2: CloudKit link spike + Developer ID build with iCloud (#209)

* iPhone link spike: CloudKit Ping/Pong between the Mac and a new iPhone app

Adds a DebugCloud configuration (signed, PHONE_LINK) with NotchBuddyCloud and
CoucouAppStoreCloud schemes, a CoucouPhone iOS target, and a CloudKit probe on
the Mac that writes a Ping every 60 s and logs the iPhone's Pong round trip.
Debug and Release are unchanged.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016qkcwzfTWvbmbc2y9dur6p

* PhoneLink: log to the Xcode console too, list subscriptions, log every remote notification

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016qkcwzfTWvbmbc2y9dur6p

* Fix the App Store build: hide Mac-only shortcuts with a filtered list

A bare return inside the ForEach ViewBuilder closure broke the CoucouAppStore
compile. Also build CoucouAppStore in CI so this is caught.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_016qkcwzfTWvbmbc2y9dur6p

* iPhone step 2: Developer ID build with iCloud (ReleaseCloud + cloud-test-build.sh)

Adds a Rele

**File**: `.github/workflows/build.yml` (modified, +39/-0)
```diff
@@ -54,3 +54,42 @@ jobs:
             build \
             CODE_SIGNING_ALLOWED=NO \
             CODE_SIGNING_REQUIRED=NO
+
+      - name: Build App Store target (unsigned)
+        run: |
+          xcodebuild \
+            -project NotchBuddy/NotchBuddy.xcodeproj \
+            -scheme CoucouAppStore \
+            -configuration Debug \
+            build \
+            CODE_SIGNING_ALLOWED=NO \
+            CODE_SIGNING_REQUIRED=NO
+
+      - name: Build iPhone link spike (Mac, DebugCloud, unsigned)
+        run: |
+          xcodebuild \
+            -project NotchBuddy/NotchBuddy.xcodeproj \
+            -scheme NotchBuddyCloud \
+            -configuration DebugCloud \
+            build \
+            CODE_SIGNING_ALLOWED=NO \
+            CODE_SIGNING_REQUIRED=NO
+
+      - name: Build iPhone link spike (Mac, ReleaseCloud, unsigned)
+        run: |
+          xcodebuild \
+            -project NotchBuddy/NotchBuddy.xcodeproj \
+            -scheme NotchBuddy \
+            -configuration ReleaseCloud \
+            build \
+            CODE_SIGNING_ALLOWED=NO \
+            CODE_SIGNING_REQUIRED=NO
+
+      - name: Build iPhone app (unsigned)
+        run: |
+          xcodebuild \
+            -project NotchBuddy/NotchBuddy.xcodeproj \
+            -scheme CoucouPhone \
+            -destination 'generic/platform=iOS' \
+            build \
+            CODE_SIGNING_ALLOWED=NO
```

**File**: `NotchBuddy/Resources/CoucouAppStoreCloud.entitlements` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+    <key>com.apple.security.app-sandbox</key>
+    <true/>
+    <key>com.apple.security.network.client</key>
+    <true/>
+    <key>com.apple.security.files.user-selected.read-write</key>
+    <true/>
+    <key>com.apple.security.files.bookmarks.app-scope</key>
+    <true/>
+    <key>com.apple.developer.icloud-container-identifiers</key>
+    <array>
+        <string>iCloud.fr.louisraille.Coucou</string>
+    </array>
+    <key>com.apple.developer.icloud-services</key>
+    <array>
+        <string>CloudKit</string>
+    </array>
+    <key>com.apple.developer.aps-environment</key>
+    <string>development</string>
+</dict>
+</plist>
```

**File**: `NotchBuddy/Resources/CoucouCloud.entitlements` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+    <key>com.apple.security.automation.apple-events</key>
+    <true/>
+    <key>com.apple.developer.icloud-container-identifiers</key>
+    <array>
+        <string>iCloud.fr.louisraille.Coucou</string>
+    </array>
+    <key>com.apple.developer.icloud-services</key>
+    <array>
+        <string>CloudKit</string>
+    </array>
+    <key>com.apple.developer.aps-environment</key>
+    <string>development</string>
+</dict>
+</plist>
```

**File**: `NotchBuddy/Resources/CoucouPhone.entitlements` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+    <key>aps-environment</key>
+    <string>development</string>
+    <key>com.apple.developer.icloud-container-identifiers</key>
+    <array>
+        <string>iCloud.fr.louisraille.Coucou</string>
+    </array>
+    <key>com.apple.developer.icloud-services</key>
+    <array>
+        <string>CloudKit</string>
+    </array>
+</dict>
+</plist>
```

**File**: `NotchBuddy/Resources/CoucouPhoneProduction.entitlements` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+    <key>aps-environment</key>
+    <string>development</string>
+    <key>com.apple.developer.icloud-container-identifiers</key>
+    <array>
+        <string>iCloud.fr.louisraille.Coucou</string>
+    </array>
+    <key>com.apple.developer.icloud-services</key>
+    <array>
+        <string>CloudKit</string>
+    </array>
+    <key>com.apple.developer.icloud-container-environment</key>
+    <string>Production</string>
+</dict>
+</plist>
```

**File**: `NotchBuddy/Resources/CoucouReleaseCloud.entitlements` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+    <key>com.apple.security.automation.apple-events</key>
+    <true/>
+    <key>com.apple.application-identifier</key>
+    <string>256AUJ9555.fr.louisraille.NotchBuddy</string>
+    <key>com.apple.developer.team-identifier</key>
+    <string>256AUJ9555</string>
+    <key>com.apple.developer.icloud-container-identifiers</key>
+    <array>
+        <string>iCloud.fr.louisraille.Coucou</string>
+    </array>
+    <key>com.apple.developer.icloud-services</key>
+    <array>
+        <string>CloudKit</string>
+    </array>
+    <key>com.apple.developer.icloud-container-environment</key>
+    <string>Production</string>
+    <key>com.apple.developer.aps-environment</key>
+    <string>production</string>
+</dict>
+</plist>
```

**File**: `NotchBuddy/Resources/InfoPhone.plist` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
+<plist version="1.0">
+<dict>
+	<key>CFBundleDevelopmentRegion</key>
+	<string>$(DEVELOPMENT_LANGUAGE)</string>
+	<key>CFBundleDisplayName</key>
+	<string>Coucou</string>
+	<key>CFBundleExecutable</key>
+	<string>$(EXECUTABLE_NAME)</string>
+	<key>CFBundleIdentifier</key>
+	<string>fr.louisraille.Coucou</string>
+	<key>CFBundleInfoDictionaryVersion</key>
+	<string>6.0</string>
+	<key>CFBundleName</key>
+	<string>Coucou</string>
+	<key>CFBundlePackageType</key>
+	<string>APPL</string>
+	<key>CFBundleShortVersionString</key>
+	<string>0.1</string>
+	<key>CFBundleVersion</key>
+	<string>1</string>
+	<key>ITSAppUsesNonExemptEncryption</key>
+	<false/>
+	<key>LSRequiresIPhoneOS</key>
+	<true/>
+	<key>UIApplicationSupportsIndirectInputEvents</key>
+	<true/>
+	<key>UIBackgroundModes</key>
+	<array>
+		<string>remote-notification</string>
+	</array>
+	<key>UILaunchScreen</key>
+	<dict/>
+	<key>UISupportedInterfaceOrientations</key>
+	<array>
+		<string>UIInterfaceOrientationPortrait</string>
+	</array>
+</dict>
+</plist>
```

**File**: `NotchBuddy/Sources/App/AppDelegate.swift` (modified, +3/-0)
```diff
@@ -18,6 +18,9 @@ final class AppDelegate: NSObject, NSApplicationDelegate {
         NSApp.setActivationPolicy(.accessory)
         setupMenuBarItem()
         setupIsland()
+        #if PHONE_LINK
+        CloudProbe.shared.start()
+        #endif
     }
 
     // MARK: - Menu bar
```

---

### Incident Patch 4: `98c7347f` (2026-10-04)
**Commit Message**: Info.plist: version 0.1.5, build 6

**File**: `NotchBuddy/Resources/Info.plist` (modified, +2/-2)
```diff
@@ -17,9 +17,9 @@
 	<key>CFBundlePackageType</key>
 	<string>APPL</string>
 	<key>CFBundleShortVersionString</key>
-	<string>0.1.4</string>
+	<string>0.1.5</string>
 	<key>CFBundleVersion</key>
-	<string>5</string>
+	<string>6</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSAccessibilityUsageDescription</key>
```

---

### Incident Patch 5: `35886ece` (2026-10-03)
**Commit Message**: chore: bump to 0.1.4 (build 5) and add CHANGELOG entry (#188)

CFBundleShortVersionString 0.1.3 → 0.1.4, CFBundleVersion 4 → 5
(NotchBuddy target only). Regenerated Info.plist via xcodegen.

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -1,5 +1,15 @@
 # Changelog
 
+## 0.1.4 — October 3, 2026
+
+- See what Claude is editing, live: each file edit shows up in the session ticker with its +N −M lines, and a click opens the diff right in the notch (#177)
+- When Claude finishes, the session card shows its final message instead of the last step, without the shimmer (#177, #179)
+- GitHub pill: your open pull requests with their CI status, the pull requests waiting for your review, and the CI of the default branch of your recent repos. Click a row for the list, then an item to open it on github.com (#181)
+- GitHub alerts: a badge and a sound when the CI of one of your pull requests turns red or green, when a default branch breaks, or when someone requests your review. Fast CI runs are caught too, and the card refreshes when you open it (#181, #185)
+- Your GitHub contribution grid: the last 7 days in the GitHub card header, click it for the past 23 weeks, and click a day for its count (#187)
+- The GitHub token needs read access to pull requests and CI: a classic token with the repo scope, or a fine-grained token with read access to Pull requests, Commit statuses and Actions (#181)
+- The finished view no longer overflows the card (#179)
+
 ## 0.1.3 — October 3, 2026
 
 - Answer Claude's questions from the notch: when Claude Code asks a multiple-choice question, pick an option or type your own answer right in the island, and Reply in terminal hands it back. Update your hooks in Settings to turn it on (#165) — thanks @Vega8991 for the idea (#94)
```

**File**: `NotchBuddy/Resources/Info.plist` (modified, +2/-2)
```diff
@@ -17,9 +17,9 @@
 	<key>CFBundlePackageType</key>
 	<string>APPL</string>
 	<key>CFBundleShortVersionString</key>
-	<string>0.1.3</string>
+	<string>0.1.4</string>
 	<key>CFBundleVersion</key>
-	<string>4</string>
+	<string>5</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSAccessibilityUsageDescription</key>
```

**File**: `NotchBuddy/project.yml` (modified, +2/-2)
```diff
@@ -61,8 +61,8 @@ targets:
         CFBundleName: Coucou
         CFBundleDisplayName: Coucou
         CFBundleIdentifier: fr.louisraille.NotchBuddy
-        CFBundleVersion: "4"
-        CFBundleShortVersionString: "0.1.3"
+        CFBundleVersion: "5"
+        CFBundleShortVersionString: "0.1.4"
         CFBundlePackageType: APPL
         LSUIElement: YES
         NSHighResolutionCapable: YES
```

---

### Incident Patch 6: `d5d0e49c` (2026-10-03)
**Commit Message**: fix: revert FinishedView overflow, first-paragraph toOneLine (#179)

FinishedView: restore exact pre-live-diff layout (AgentWho + one-line
summary text + Open terminal / OK buttons, paddings leading 116 /
trailing 16 / vertical 4). Removed the touched-files list, the
showingDiff overlay and the DiffCardView branch. Kept the
finalLine → last non-diff step → "Session finished" text source from
live-diff; added .lineLimit(1).truncationMode(.tail). Deleted
AppState.touchedFiles(for:) which is now unused.

DiffEngine.toOneLine: stop at the first paragraph separator (blank
line, 3+ repeated -/*/_ chars, or line starting with |) so that long
tool output doesn't bleed into the finished-session summary. Also
strips leading bullet markers (-, *, •, N.). Falls through to the next
paragraph if the first one is empty. Nine new test cases added.

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `NotchBuddy/Sources/App/AppState.swift` (modified, +0/-13)
```diff
@@ -320,19 +320,6 @@ final class AppState: ObservableObject {
         // nextDiffId intentionally NOT reset — ids remain unique across sessions
     }
 
-    /// Unique touched files for a pill, in first-touch order, with summed totals.
-    func touchedFiles(for pillId: String) -> [(path: String, added: Int, removed: Int)] {
-        guard let diffs = sessionDiffs[pillId] else { return [] }
-        var seen: [String: (added: Int, removed: Int)] = [:]
-        var order: [String] = []
-        for d in diffs {
-            if seen[d.path] == nil { order.append(d.path) }
-            let p = seen[d.path] ?? (0, 0)
-            seen[d.path] = (p.added + d.added, p.removed + d.removed)
-        }
-        return order.map { path in let t = seen[path]!; return (path, t.added, t.removed) }
-    }
-
     private func resetSessionDiffTimer(for pillId: String) {
         sessionDiffTimers[pillId]?.cancel()
         let work = DispatchWorkItem { [weak self] in
```

**File**: `NotchBuddy/Sources/App/DiffEngine.swift` (modified, +46/-15)
```diff
@@ -218,23 +218,54 @@ enum DiffEngine {
     // MARK: - toOneLine
 
     /// Converts a possibly multi-line, markdown-formatted string to a single line of plain text.
-    /// Strips `**`, `__`, backticks and leading `#` chars from each line, collapses whitespace.
+    /// Uses only the first non-empty paragraph (stops at blank line, horizontal rule, or table row).
+    /// Strips `**`, `__`, backticks, leading `#`, and leading bullet markers.
     static func toOneLine(_ text: String, maxChars: Int = 200) -> String {
-        var s = text
-        s = s.replacingOccurrences(of: "**", with: "")
-        s = s.replacingOccurrences(of: "__", with: "")
-        s = s.replacingOccurrences(of: "`", with: "")
-        let processed: [String] = s.components(separatedBy: "\n").compactMap { line in
-            var l = line
-            while l.hasPrefix("#") { l = String(l.dropFirst()) }
-            let trimmed = l.trimmingCharacters(in: .whitespaces)
-            return trimmed.isEmpty ? nil : trimmed
+        let lines = text.components(separatedBy: "\n")
+
+        // Split into paragraphs. Separators: blank line, HR (3+ repeated -/*/_ chars), table row (starts with |).
+        var paragraphs: [[String]] = []
+        var current: [String] = []
+        for line in lines {
+            let trimmed = line.trimmingCharacters(in: .whitespaces)
+            let isHR = trimmed.count >= 3 && (trimmed.allSatisfy { $0 == "-" } ||
+                                               trimmed.allSatisfy { $0 == "*" } ||
+                                               trimmed.allSatisfy { $0 == "_" })
+            let isSep = trimmed.isEmpty || isHR || trimmed.hasPrefix("|")
+            if isSep {
+                if !current.isEmpty { paragraphs.append(current); current = [] }
+            } else {
+                current.append(line)
+            }
+        }
+        if !current.isEmpty { paragraphs.append(current) }
+
+        // Find first paragraph that yields non-empty text after cleaning.
+        for paraLines in paragraphs {
+            var s = paraLines.joined(separator: "\n")
+            s = s.replacingOccurrences(of: "**", with: "")
+            s = s.replacingOccurrences(of: "__", with: "")
+            s = s.replacingOccurrences(of: "`", with: "")
+            let processed: [String] = s.components(separatedBy: "\n").compactMap { line in
+                var l = line
+                while l.hasPrefix("#") { l = String(l.dropFirst()) }
+                l = l.trimmingCharacters(in: .whitespaces)
+                // Strip leading bullet markers: -, *, •, or N. (ordered list)
+                if l.hasPrefix("- ") || l.hasPrefix("* ") || l.hasPrefix("• ") {
+                    l = String(l.dropFirst(2))
+                } else if let m = l.range(of: #"^\d+\.\s+"#, options: .regularExpression) {
+                    l = String(l[m.upperBound...])
+                }
+                let trimmed = l.trimmingCharacters(in: .whitespaces)
+                return trimmed.isEmpty ? nil : trimmed
+            }
+            let joined = processed.joined(separator: " ")
+            let collapsed = joined.components(separatedBy: .whitespaces)
+                .filter { !$0.isEmpty }
+                .joined(separator: " ")
+            if !collapsed.isEmpty { return String(collapsed.prefix(maxChars)) }
         }
-        let joined = processed.joined(separator: " ")
-        let collapsed = joined.components(separatedBy: .whitespaces)
-            .filter { !$0.isEmpty }
-            .joined(separator: " ")
-        return String(collapsed.prefix(maxChars))
+        return ""
     }
 }
 
```

**File**: `NotchBuddy/Sources/App/IslandViewContent.swift` (modified, +27/-74)
```diff
@@ -527,89 +527,42 @@ struct ErrorView: View {
 
 struct FinishedView: View {
     @ObservedObject var state: AppState
-    @State private var showingDiff: FileDiff? = nil
 
     var body: some View {
         ZStack {
             CardBackground(wash: .green)
-            if let diff = showingDiff {
-                DiffCardView(diff: diff, onDismiss: { showingDiff = nil })
-                    .transition(.opacity)
-            } else {
-                VStack(alignment: .leading, spacing: 5) {
-                    AgentWho(task: state.focusTask, label: "Claude Code finished")
-                    Text({
-                        if let fl = state.focusTask?.finalLine { return fl }
-                        if let s = state.focusTask?.steps.last(where: { !$0.isDiffStep }) { return s }
-                        return "Session finished"
-                    }())
-                        .font(.system(size: 15, weight: .semibold))
-                    HStack(spacing: 8) {
-                        #if !APPSTORE
-                        PrimaryButton("Open terminal") {
-                            let terminalBundleIds = ["com.apple.Terminal", "com.googlecode.iterm2", "net.kovidgoyal.kitty", "com.mitchellh.ghostty"]
-                            let activated = terminalBundleIds.compactMap { id in
-                                NSWorkspace.shared.runningApplications.first { $0.bundleIdentifier == id }
-                            }.first.map { $0.activate(options: .activateIgnoringOtherApps) }
-                            if activated == nil {
-                                NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Applications/Utilities/Terminal.app"))
-                            }
-                            NotificationCenter.default.post(name: .islandCollapse, object: nil)
-                        }
-                        #endif
-                        SecondaryButton("OK") {
-                            NotificationCenter.default.post(name: .islandCollapse, object: nil)
+            VStack(alignment: .leading, spacing: 5) {
+                AgentWho(task: state.focusTask, label: "Claude Code finished")
+                Text({
+                    if let fl = state.focusTask?.finalLine { return fl }
+                    if let s = state.focusTask?.steps.last(where: { !$0.isDiffStep }) { return s }
+                    return "Session finished"
+                }())
+                    .font(.system(size: 15, weight: .semibold))
+                    .lineLimit(1)
+                    .truncationMode(.tail)
+                HStack(spacing: 8) {
+                    #if !APPSTORE
+                    PrimaryButton("Open terminal") {
+                        let terminalBundleIds = ["com.apple.Terminal", "com.googlecode.iterm2", "net.kovidgoyal.kitty", "com.mitchellh.ghostty"]
+                        let activated = terminalBundleIds.compactMap { id in
+                            NSWorkspace.shared.runningApplications.first { $0.bundleIdentifier == id }
+                        }.first.map { $0.activate(options: .activateIgnoringOtherApps) }
+                        if activated == nil {
+                            NSWorkspace.shared.open(URL(fileURLWithPath: "/System/Applications/Utilities/Terminal.app"))
                         }
+                        NotificationCenter.default.post(name: .islandCollapse, object: nil)
                     }
-                    // Touched files (up to 4)
-                    let files = state.touchedFiles(for: state.focusTask?.id ?? "")
-                    if !files.isEmpty {
-                        let shown = Array(files.prefix(4))
-                        VStack(alignment: .leading, spacing: 2) {
-                            ForEach(shown.indices, id: \.self) { i in
-                                let f = shown[i]
-                                Button(action: {
-                                    withAnimation(.easeIn(duration: 0.16)) {
-                                        if let taskId = state.focusTask?.id,
-                                           let diffs = state.sessionDiffs[taskId],
-                                           let last = diffs.last(where: { $0.path == f.path }) {
-                                            showingDiff = last
-                                        }
-                                    }
-                                }) {
-                                    HStack(spacing: 4) {
-                                        Text(URL(fileURLWithPath: f.path).lastPathComponent)
-                                            .font(.system(size: 10.5))
-                                            .foregroundColor(Color(hex: "#9398A1"))
-                                            .lineLimit(1).truncationMode(.middle)
-                                        if f.added > 0 {
-                                            Text("+\(f.added)")
-                                                .font(.system(s
```

**File**: `docs/INTEGRATIONS.md` (modified, +1/-1)
```diff
@@ -133,7 +133,7 @@ Sur `PostToolUse` pour `Edit`, `MultiEdit` et `Write` (Claude Code, Cursor), l'a
 - Lignes en monospace 10,5 pt, fond vert ou rouge à 12 %, symbole +/− en marge, 3 lignes de contexte
 - Défilement vertical ; Échap ou clic sur l'en-tête pour revenir au fil
 
-**Vue Terminé (FinishedView)** — liste les fichiers touchés (nom + bilan, 4 au plus, puis "+ N more"). Un clic affiche la carte diff du dernier diff connu pour ce fichier.
+**Vue Terminé (FinishedView)** — affiche la dernière ligne utile de la session (`finalLine` → dernière étape non-diff → "Session finished"), sur une ligne (`.lineLimit(1).truncationMode(.tail)`). Pas de liste de fichiers.
 
 ---
 
```

**File**: `docs/SPEC.md` (modified, +1/-1)
```diff
@@ -90,7 +90,7 @@ Centre vertical du bonhomme : 36 + (hauteur − 46) / 2, sauf `result` (y = 86).
 
 ### Diff en direct
 
-Quand une étape du fil est une modification de fichier (préfixe interne `\u{E001}`), elle s'affiche avec le nom du fichier et le bilan `+N −M` en couleur. Un clic sur la ligne courante ou la ligne précédente ouvre la carte diff (voir DiffCardView) dans la carte gauche de la vue principale, en remplacement du fil — que la pastille soit intégrée (integration_claude, agent_cursor…) ou non. Échap ou le bouton ← de l'en-tête ferme la carte. La vue Terminé liste les fichiers touchés. En fin de tâche (Stop), la ligne courante du fil passe en texte statique (couleur `#C9CDD4`, sans brillance) tant que la tâche n'est pas relancée ; elle est construite à partir du dernier message de l'assistant (champ `last_assistant_message` de l'événement Stop, nettoyé du Markdown par `DiffEngine.toOneLine`).
+Quand une étape du fil est une modification de fichier (préfixe interne `\u{E001}`), elle s'affiche avec le nom du fichier et le bilan `+N −M` en couleur. Un clic sur la ligne courante ou la ligne précédente ouvre la carte diff (voir DiffCardView) dans la carte gauche de la vue principale, en remplacement du fil — que la pastille soit intégrée (integration_claude, agent_cursor…) ou non. Échap ou le bouton ← de l'en-tête ferme la carte. En fin de tâche (Stop), la ligne courante du fil passe en texte statique (couleur `#C9CDD4`, sans brillance) tant que la tâche n'est pas relancée ; elle est construite à partir du dernier message de l'assistant (champ `last_assistant_message` de l'événement Stop, nettoyé du Markdown par `DiffEngine.toOneLine` — premier paragraphe utile uniquement).
 
 ### Pastilles (overview)
 - 132 × 34, rayon 17, fond couleur de l'agent à 13 %, bord à 32 %, mini-bonhomme Ø 24 centré à 17 pt du bord gauche, libellé 12 pt couleur de l'agent éclaircie de 25 %. Deux colonnes, écart 8, centrées verticalement dans la carte droite (qui commence à x = 342).
```

**File**: `tests/DiffEngineTests.swift` (modified, +33/-0)
```diff
@@ -175,6 +175,39 @@ enum DiffEngineTests {
             // truncation
             let long = DiffEngine.toOneLine(String(repeating: "x ", count: 200), maxChars: 10)
             checkTrue("truncated to maxChars", long.count <= 10)
+
+            // stop at blank line
+            checkTrue("blank line → first para only",
+                DiffEngine.toOneLine("First para.\n\nSecond para.") == "First para.")
+
+            // stop at --- separator
+            checkTrue("--- separator → first para only",
+                DiffEngine.toOneLine("Done. Single commit 450a657 on github-pulse.\n\n---\n\nFiles touched (7)…")
+                    == "Done. Single commit 450a657 on github-pulse.")
+
+            // stop at *** separator
+            checkTrue("*** separator → first para only",
+                DiffEngine.toOneLine("Summary line.\n***\nMore details.") == "Summary line.")
+
+            // stop at table row (|)
+            checkTrue("table row → first para only",
+                DiffEngine.toOneLine("Result:\n| Col1 | Col2 |\n|---|---|\n| A | B |") == "Result:")
+
+            // strip leading bullet -
+            checkTrue("strip bullet -",
+                DiffEngine.toOneLine("- item one\n- item two") == "item one item two")
+
+            // strip leading bullet *
+            checkTrue("strip bullet *",
+                DiffEngine.toOneLine("* first\n* second") == "first second")
+
+            // strip ordered list
+            checkTrue("strip ordered list",
+                DiffEngine.toOneLine("1. step one\n2. step two") == "step one step two")
+
+            // first paragraph empty → fall through to next
+            checkTrue("empty first para → next",
+                DiffEngine.toOneLine("\n\nActual content.") == "Actual content.")
         }
 
         // ── finish ─────────────────────────────────────────────────────────────
```

---

### Incident Patch 7: `ae385208` (2026-10-03)
**Commit Message**: Info.plist: version 0.1.3, build 4

**File**: `NotchBuddy/Resources/Info.plist` (modified, +2/-2)
```diff
@@ -17,9 +17,9 @@
 	<key>CFBundlePackageType</key>
 	<string>APPL</string>
 	<key>CFBundleShortVersionString</key>
-	<string>0.1.2</string>
+	<string>0.1.3</string>
 	<key>CFBundleVersion</key>
-	<string>3</string>
+	<string>4</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSAccessibilityUsageDescription</key>
```

---

### Incident Patch 8: `5332f9ee` (2026-10-02)
**Commit Message**: Choose your main coding tool, show Cursor sessions on the Cursor pill, and fix the permission card when the island is open (#120)

**File**: `NotchBuddy/Sources/App/AppState.swift` (modified, +16/-23)
```diff
@@ -193,7 +193,7 @@ final class AppState: ObservableObject {
         }
     }
 
-    // Active integration pills (VS Code excluded — always on). Max 4.
+    // Active integration pills (main workspace pill excluded). Max 4.
     @Published var activeIntegrations: Set<String> = ["integration_resend", "integration_n8n", "integration_vercel", "integration_github"] {
         didSet {
             if let data = try? JSONEncoder().encode(Array(activeIntegrations)) {
@@ -267,9 +267,7 @@ final class AppState: ObservableObject {
         if let d = ud.data(forKey: "activeIntegrations"),
            let a = try? JSONDecoder().decode([String].self, from: d) { activeIntegrations = Set(a) }
         if let v = ud.string(forKey: "mainPill"), !v.isEmpty,
-           v == "integration_claude" ||
-           (PillCatalog.available.contains(where: { $0.id == v && $0.category == .workspace })
-            && activeIntegrations.contains(v)) {
+           PillCatalog.available.contains(where: { $0.id == v && $0.category == .workspace && !$0.comingSoon }) {
             mainPillId = v
         }
 
@@ -301,9 +299,9 @@ final class AppState: ObservableObject {
     }
 
     func removeTask(id: String) {
-        // integration_claude: ALWAYS reset, never remove (Claude Code sessions pass through it)
-        // mainPillId: also always reset (the active workspace pill)
-        let isProtected = id == "integration_claude" || id == mainPillId
+        // mainPillId: always reset, never remove (the active workspace tool)
+        // activeIntegrations: also reset (user declared it active, keep it as idle)
+        let isProtected = id == mainPillId
         let isActiveDecl = PillCatalog.definition(for: id) != nil && activeIntegrations.contains(id)
         if isProtected || isActiveDecl {
             if let idx = tasks.firstIndex(where: { $0.id == id }) {
@@ -355,25 +353,22 @@ final class AppState: ObservableObject {
         // Sanitize: remove saved IDs not in catalog
         let catalogIds = Set(catalog.map { $0.id })
         activeIntegrations = activeIntegrations.filter { catalogIds.contains($0) }
-        // Validate mainPillId: must be integration_claude or a checked workspace pill
-        if mainPillId != "integration_claude",
-           !(PillCatalog.available.contains(where: { $0.id == mainPillId && $0.category == .workspace })
-             && activeIntegrations.contains(mainPillId)) {
-            mainPillId = "integration_claude"
+        // Validate mainPillId: must be a non-comingSoon workspace pill in the catalog
+        if !PillCatalog.available.contains(where: { $0.id == mainPillId && $0.category == .workspace && !$0.comingSoon }) {
+            mainPillId = PillCatalog.defaultMainPillId
         }
+        // mainPillId must never be in activeIntegrations (migration + invariant)
+        activeIntegrations.remove(mainPillId)
         for def in catalog {
-            // integration_claude always loads; mainPillId always loads; activeIntegrations load
-            let shouldLoad = def.id == "integration_claude"
-                          || def.id == mainPillId
-                          || activeIntegrations.contains(def.id)
+            // mainPillId always loads; activeIntegrations load
+            let shouldLoad = def.id == mainPillId || activeIntegrations.contains(def.id)
             let loaded = tasks.contains(where: { $0.id == def.id })
             if shouldLoad && !loaded {
                 let task = AgentTask(id: def.id, name: def.name, color: def.color,
                                      state: .idle, steps: [], source: def.source, isIntegration: true)
                 tasks.append(task)
             }
-            if !shouldLoad && loaded
-               && def.id != "integration_claude" && def.id != mainPillId {
+            if !shouldLoad && loaded {
                 tasks.removeAll { $0.id == def.id }
             }
         }
@@ -383,16 +378,14 @@ final class AppState: ObservableObject {
     }
 
     /// Toggle a catalog pill on/off.
-    /// integration_claude: never toggleable.
-    /// mainPillId (workspace): can be unchecked — resets mainPillId to integration_claude.
-    /// Max 4 non-claude pills active at once.
+    /// mainPillId: never toggleable (change via the Main picker first).
+    /// Max 4 non-main pills active at once.
     func toggleIntegration(_ id: String) {
-        guard id != "integration_claude" else { return }
+        guard id != mainPillId else { return }
         guard PillCatalog.available.contains(where: { $0.id == id }) else { return }
         if activeIntegrations.contains(id) {
             activeIntegrations.remove(id)
             tasks.removeAll { $0.id == id }
-            if mainPillId == id { mainPillId = "integration_claude" }
             if focusId == id { focusId = mainPillId }
         } else {
             guard activeIntegrations.count < 4 else { return }
```

**File**: `NotchBuddy/Sources/App/HookServer.swift` (modified, +128/-75)
```diff
@@ -1,6 +1,7 @@
 import Foundation
 import Darwin
 import AppKit
+import SwiftUI
 import CryptoKit
 
 // MARK: - HookServer
@@ -40,6 +41,7 @@ final class HookServer: @unchecked Sendable {
     private var pendingApprovalFD: Int32 = -1         // held open while user decides
     private var approvalFDSource: (any DispatchSourceRead)? = nil  // monitors pendingApprovalFD
     private var activeSessionId: String? = nil        // current Claude Code session
+    private var focusBeforeApproval: String? = nil    // saved focus to restore after approval
 
     private init() {}
 
@@ -60,10 +62,18 @@ final class HookServer: @unchecked Sendable {
         cancelApprovalFDSource()
         pendingApprovalFD = -1
         let state = AppState.shared
+        let pillId = state.pendingApproval?.pillId ?? "integration_claude"
         state.pendingApproval = nil
         state.isPinned = false
-        state.updateTask(id: "integration_claude", state: .working)
-        clearPillBadge(id: "integration_claude")
+        state.updateTask(id: pillId, state: .working)
+        clearPillBadge(id: pillId)
+        // Restore focus to the pill that was focused before the approval card appeared.
+        if let prev = focusBeforeApproval {
+            focusBeforeApproval = nil
+            if state.focusId == pillId, state.tasks.contains(where: { $0.id == prev }) {
+                withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) { state.focusId = prev }
+            }
+        }
         state.noteMessage = note
         state.view = .note
         DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
@@ -199,67 +209,86 @@ final class HookServer: @unchecked Sendable {
     @MainActor
     private func processEvent(name: String, payload: [String: Any]) {
         let state = AppState.shared
-        let sessionId = payload["session_id"] as? String ?? "unknown"
+        let sessionId = payload["session_id"] as? String
+                     ?? payload["conversation_id"] as? String
+                     ?? "unknown"
         let cwd = payload["cwd"] as? String ?? ""
         let rawName = URL(fileURLWithPath: cwd).lastPathComponent
         let projectName = aliasProjectName(rawName.isEmpty ? "Session" : rawName)
 
         // Determine which pill this event belongs to.
         // coucou_agent must be lowercase, digits and hyphens, ≤ 24 chars.
-        // Absent or invalid → Claude Code pill (integration_claude); no change in behaviour.
         let rawAgent = payload["coucou_agent"] as? String ?? ""
         let validAgent = Self.validateAgent(rawAgent)
-        let agentId = validAgent.map { "agent_\($0)" } ?? "integration_claude"
-        let isExternalAgent = validAgent != nil
 
         let termProgram = payload["term_program"] as? String ?? ""
         let bundleId    = payload["bundle_id"]    as? String ?? ""
-        let isVSCode = termProgram.lowercased().contains("vscode") ||
-                       bundleId.lowercased().contains("vscode")
-        // External agents bypass the VS Code filter (their relay runs in any terminal).
-        guard isExternalAgent || isVSCode else {
+
+        // Cursor identified solely by its stable Electron bundle ID.
+        // ToDesktop builds other apps too — do not match on "todesktop" alone.
+        let isCursorEditor = bundleId.lowercased() == "com.todesktop.230313mzl4w4u92"
+        let isVSCodeEditor = !isCursorEditor && (
+            termProgram.lowercased().contains("vscode") ||
+            bundleId.lowercased().contains("vscode"))
+
+        // Routing: coucou_agent → external pill; Cursor → agent_cursor; VS Code → integration_claude.
+        let agentId: String
+        let isExternalAgent: Bool
+        if let agent = validAgent {
+            agentId = "agent_\(agent)"
+            isExternalAgent = true
+        } else if isCursorEditor {
+            agentId = "agent_cursor"
+            isExternalAgent = false
+        } else if isVSCodeEditor {
+            agentId = "integration_claude"
+            isExternalAgent = false
+        } else {
             nbLog("Ignored \(name) from \(termProgram.isEmpty ? bundleId : termProgram) (\(projectName))")
             return
         }
 
         let focused = state.focusId == agentId
 
-        // While a permission request is pending on the Claude Code pill, skip events to
-        // preserve the .approval state and keep the card visible.
-        if state.pendingApproval != nil && agentId == "integration_claude" {
-            if let pending = state.pendingApproval {
-                switch name {
-                case "PostToolUse", "PostToolUseFailure":
-                    // Only dismiss when this exact tool call finished — same session, tool and input.
-                    // Other parallel tools finishing must not close the card.
-                    if sessionId == pending.sessionId,
-                       (payload["tool_name"] as? String ?? "") == pending.tool,
-                       Self.approva
```

**File**: `NotchBuddy/Sources/App/IslandTypes.swift` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ struct ApprovalInfo: Sendable {
     var command: String
     /// tool_input serialized to JSON with sortedKeys, "" if absent — used to match PostToolUse.
     var inputKey: String
+    /// Pill that owns this approval: "integration_claude" or "agent_cursor".
+    var pillId: String
 }
 
 // MARK: - Pill badge (shown on pill edge when non-focused task has an alert)
```

**File**: `NotchBuddy/Sources/App/PillCatalog.swift` (modified, +8/-4)
```diff
@@ -33,7 +33,11 @@ struct PillDefinition {
 
     /// Label shown in the active-session card header (workspace/agent pills only).
     var sessionSubtitle: String {
-        id == "integration_claude" ? "Claude Code" : "Agent"
+        switch id {
+        case "integration_claude": return "Claude Code"
+        case "agent_cursor":       return "Cursor"
+        default:                   return "Agent"
+        }
     }
 }
 
@@ -46,14 +50,14 @@ enum PillCatalog {
         .init(id: "integration_claude",  name: "VS Code",     color: "#F5F6F8",
               category: .workspace, subtitle: "Integration",  source: .claudeCode),
         .init(id: "agent_cursor",        name: "Cursor",      color: "#C0C4CC",
-              category: .workspace, subtitle: "Integration",  source: .agent,  comingSoon: true),
+              category: .workspace, subtitle: "Integration",  source: .agent),
+        .init(id: "agent_antigravity",   name: "Antigravity", color: "#E879F9",
+              category: .workspace, subtitle: "Integration",  source: .agent,  githubOnly: true),
         .init(id: "agent_codex",         name: "Codex",       color: "#2DD4BF",
               category: .workspace, subtitle: "Integration",  source: .agent,  comingSoon: true, githubOnly: true),
         // ── Agents ───────────────────────────────────────────────────────────
         .init(id: "agent_gemini",        name: "Gemini CLI",  color: "#8AB4F8",
               category: .agent,     subtitle: "Agent",        source: .agent,  githubOnly: true),
-        .init(id: "agent_antigravity",   name: "Antigravity", color: "#E879F9",
-              category: .agent,     subtitle: "Agent",        source: .agent,  githubOnly: true),
         // ── AI for the chat ──────────────────────────────────────────────────
         .init(id: "ai_anthropic",        name: "Anthropic",   color: ChatProvider.anthropic.accentHex,
               category: .ai,        subtitle: "Chat",         source: .n8n),
```

**File**: `NotchBuddy/Sources/App/SettingsView.swift` (modified, +29/-42)
```diff
@@ -428,19 +428,6 @@ struct SettingsView: View {
                 // MARK: Active pills
                 GroupBox("Active pills") {
                     VStack(alignment: .leading, spacing: 10) {
-                        // VS Code: always active (mirrors main branch row exactly)
-                        HStack {
-                            Text("VS Code")
-                                .font(.system(size: 12, weight: .semibold))
-                            Circle().fill(Color(hex: "#F5F6F8")).frame(width: 8, height: 8)
-                            Spacer()
-                            Text("Always active")
-                                .font(.system(size: 11))
-                                .foregroundColor(.secondary)
-                        }
-
-                        Divider()
-
                         Text("Choose the tools you use. Coucou only shows what you declare here.")
                             .font(.system(size: 11))
                             .foregroundColor(.secondary)
@@ -449,28 +436,20 @@ struct SettingsView: View {
                             .font(.system(size: 11))
                             .foregroundColor(state.activeIntegrations.count >= 4 ? .orange : .secondary)
 
-                        // Main pill picker: shown only when a workspace pill (Cursor/Codex) is active
-                        let workspacePills = PillCatalog.available.filter {
-                            $0.category == .workspace && $0.id != "integration_claude"
-                                && state.activeIntegrations.contains($0.id)
-                        }
-                        if !workspacePills.isEmpty {
-                            Picker("Main pill", selection: $state.mainPillId) {
-                                Text("VS Code").tag("integration_claude")
-                                ForEach(workspacePills, id: \.id) { def in
-                                    Text(def.name).tag(def.id)
-                                }
-                            }
-                            .onChange(of: state.mainPillId) { _, newId in
-                                state.setFocus(newId)
+                        Picker("Main", selection: $state.mainPillId) {
+                            ForEach(PillCatalog.available.filter { $0.category == .workspace && !$0.comingSoon }, id: \.id) { def in
+                                Text(def.name).tag(def.id)
                             }
                         }
+                        .onChange(of: state.mainPillId) { _, newId in
+                            state.activeIntegrations.remove(newId)  // main pill never in activeIntegrations
+                            state.loadIntegrationTasks()
+                            state.setFocus(newId)
+                        }
 
-                        // Categories — integration_claude excluded (shown above)
+                        // All categories — main pill shown with "Main" label instead of toggle
                         ForEach(PillCategory.allCases, id: \.self) { cat in
-                            let catPills = PillCatalog.available.filter {
-                                $0.category == cat && $0.id != "integration_claude"
-                            }
+                            let catPills = PillCatalog.available.filter { $0.category == cat }
                             if !catPills.isEmpty {
                                 Divider()
                                 Text(cat.title)
@@ -796,10 +775,12 @@ struct SettingsView: View {
 
     @ViewBuilder
     private func pillRow(_ def: PillDefinition) -> some View {
-        let isOn  = state.activeIntegrations.contains(def.id)
-        let atMax = state.activeIntegrations.count >= 4 && !isOn
-        // Status hint: shown in 11pt gray before the toggle
+        let isMain = def.id == state.mainPillId
+        let isOn   = state.activeIntegrations.contains(def.id)
+        let atMax  = state.activeIntegrations.count >= 4 && !isOn && !isMain
+        // Status hint: shown in 11pt gray before the toggle (not shown for main pill)
         let hint: String? = {
+            if isMain { return nil }
             if def.comingSoon { return "Coming soon" }
             #if !APPSTORE
             if def.id == "agent_gemini"        && !HookServer.geminiHooksInstalled() { return "Hooks not installed" }
@@ -820,17 +801,23 @@ struct SettingsView: View {
                 .font(.system(size: 12))
                 .foregroundColor(atMax ? .secondary : .primary)
             Spacer()
-            if let h = hint {
-                Text(h)
+            if isMain {
+                Text("Main")
                     .font(.system(size: 11))
                     .foregroundColor(.secondary)
+            } else {
+                if let h = hint {
+                    Text(h)
+                        .font(.system(size: 11))
+                        .foregroundColor(.secondary)
+                }
+                Toggle("", isOn: Binding(
+       
```

**File**: `README.md` (modified, +3/-3)
```diff
@@ -32,11 +32,11 @@ Meet **Mochi**: a soft little squircle with big eyes that pops out of your notch
 
 ## Features
 
-- 🤖 **Claude Code, Gemini CLI, Antigravity and other agents, live** — see every session in your notch: what it reads, edits and runs, step by step. Tag a hook payload with `coucou_agent` to give any agent its own pill (see [`docs/AGENTS.md`](docs/AGENTS.md)). Finished? Mochi does a happy little jump. Cursor and Codex pills are coming soon.
-- ✅ **Approve from the notch** — Claude Code permission requests show up with **Allow / Deny**. One click, back to work.
+- 🤖 **Claude Code, Cursor, Gemini CLI, Antigravity and other agents, live** — see every session in your notch: what it reads, edits and runs, step by step. Tag a hook payload with `coucou_agent` to give any agent its own pill (see [`docs/AGENTS.md`](docs/AGENTS.md)). Finished? Mochi does a happy little jump.
+- ✅ **Approve from the notch** — Claude Code permission requests show up with **Allow / Deny**, in VS Code or in Cursor's terminal. One click, back to work.
 - 🧑‍💻 **Jump to the right terminal** — open the exact terminal window of a session *(macOS)*.
 - 💬 **Chat with Claude, or with Gemini and OpenAI models using your own keys** *(Gemini and OpenAI: macOS)* — click the model name above the chat box to switch provider and pick a model; the list comes from each API account.
-- 📋 **Declare the tools you use** — open Settings → Active pills and choose which coding tools, agents and AI providers show up in the island. VS Code is always there; toggle Gemini CLI, Antigravity, Anthropic, Google AI, OpenAI and more. Check Cursor or Codex and you can make it your main pill, the one in the big card *(macOS)*.
+- 📋 **Declare the tools you use** — open Settings → Active pills and pick your main workspace tool (VS Code, Cursor or Antigravity), then toggle up to 4 more: Gemini CLI, Anthropic, Google AI, OpenAI and service integrations *(macOS)*.
 - 📎 **Drop a file on the notch** — Mochi turns into a box and swallows it, then ask a question about it or send it by email *(email: macOS, Mail.app)*.
 - 🪟 **Drag Mochi onto any window** — attach that window as context for Claude *(macOS)*.
 - 🔌 **Integrations** — Stripe payments, n8n workflows, GitHub, Vercel deployments, Resend emails, Notion, Cal.com. Each one gets its own little colored Mochi.
```

**File**: `docs/SPEC.md` (modified, +6/-6)
```diff
@@ -96,18 +96,18 @@ Toutes les pastilles déclarées sont définies dans `PillCatalog.all` (source d
 
 | Catégorie | Titre | Pastilles | Subtitle (repos) | Subtitle (session) |
 |---|---|---|---|---|
-| `workspace` | Where you code | VS Code, Cursor *(coming soon)*, Codex *(coming soon, GitHub only)* | Integration | Claude Code / Agent |
-| `agent` | Agents | Gemini CLI *(GitHub only)*, Antigravity *(GitHub only)* | Agent | Agent |
+| `workspace` | Where you code | VS Code, Cursor, Antigravity *(GitHub only)*, Codex *(coming soon, GitHub only)* | Integration | Claude Code / Cursor / Agent |
+| `agent` | Agents | Gemini CLI *(GitHub only)* | Agent | Agent |
 | `ai` | AI for the chat | Anthropic, Google AI, OpenAI | Chat | — |
 | `service` | Services | Resend, n8n, Vercel, GitHub, Notion, Cal.com, Stripe | Integration | — |
 
 Couleurs : Cursor `#C0C4CC`, Codex `#2DD4BF`, Gemini CLI `#8AB4F8`, Antigravity `#E879F9`, pastilles IA = `ChatProvider.accentHex`.
 
 Règles :
-- **`integration_claude` est toujours chargée, jamais retirée, jamais décochée.** Elle ne compte pas dans les 4 places.
-- `mainPillId` (défaut `integration_claude`) peut valoir une pastille workspace cochée (ex. Cursor). Si on décoche la principale, `mainPillId` revient à `integration_claude`.
-- Max 4 pastilles autres qu'`integration_claude` actives à la fois (`activeIntegrations`, persisté). Cursor/Codex comptent dans les 4.
-- `removeTask` sur `integration_claude` ou `mainPillId` ou une pastille déclarée + active → reset à `.idle` + `pillBadge = nil` + nom du catalogue (pas de suppression). Sinon → suppression normale.
+- **`mainPillId`** (défaut `integration_claude`) est la pastille workspace toujours chargée. Elle ne compte pas dans les 4 places. Modifiable via le sélecteur Main dans Settings.
+- Quand `mainPillId != "integration_claude"`, la pastille VS Code est chargée seulement si une session VS Code est active (transient) ou si elle est cochée dans `activeIntegrations`.
+- Max 4 pastilles autres que `mainPillId` actives à la fois (`activeIntegrations`, persisté).
+- `removeTask` sur `mainPillId` ou une pastille déclarée + active → reset à `.idle` + `pillBadge = nil` + nom du catalogue (pas de suppression). Sinon → suppression normale.
 - `sortTasksByCatalog` : pastilles du catalogue dans l'ordre du catalogue ; pastilles hors catalogue juste après `integration_claude`.
 - Pastilles `githubOnly` : exclues des builds App Store (`#if APPSTORE`).
 - Hooks (Gemini CLI, Antigravity) : `isConfigured` = `HookServer.geminiHooksInstalled()` / `agyHooksInstalled()` sous `#if !APPSTORE`.
```

**File**: `docs/support.html` (modified, +8/-8)
```diff
@@ -26,11 +26,11 @@ <h3>Can I use Coucou with Gemini CLI or Antigravity (agy)? (macOS)</h3>
 <h3>The chat doesn’t answer</h3>
 <p>Add your API key in Settings: <b>Settings → Anthropic API</b> for Claude, or <b>Settings → Chat — other providers</b> <i>(macOS)</i> for Google AI (Gemini) or OpenAI. API usage is billed by the provider, separately from any subscription.</p>
 <h3>An integration pill stays grey</h3>
-<p>Check its key in Settings. Up to 4 pills (other than VS Code) can be active at once — see <b>Settings → Active pills</b>.</p>
+<p>Check its key in Settings. Up to 4 pills can be active at once in addition to the main workspace tool — see <b>Settings → Active pills</b>.</p>
 <h3>What are Active pills? (macOS)</h3>
-<p>Active pills are the coding tools, agents and AI providers you declare in <b>Settings → Active pills</b>. VS Code is always there; you can add up to 4 more, including Gemini CLI, Antigravity, Anthropic, Google AI, OpenAI and service integrations. When Cursor or Codex is checked, a Main pill menu lets you choose which one opens in the big card. An agent that sends <code>coucou_agent</code> in its hook payload still gets its own automatic pill regardless.</p>
-<h3>When are Cursor and Codex sessions available?</h3>
-<p>Cursor and Codex pills are already in <b>Settings → Active pills</b> <i>(Codex: GitHub build only)</i>. You can declare them and set either as the Main pill. Support for their actual sessions is coming in a future version.</p>
+<p>Active pills are the coding tools, agents and AI providers you declare in <b>Settings → Active pills</b>. The <b>Main</b> picker at the top lets you choose your primary workspace tool (VS Code, Cursor or Antigravity — GitHub build only). You can then add up to 4 more pills: Gemini CLI, Anthropic, Google AI, OpenAI and service integrations. An agent that sends <code>coucou_agent</code> in its hook payload still gets its own automatic pill regardless.</p>
+<h3>Can I use Coucou with Cursor? (macOS)</h3>
+<p>Yes. Install the Claude Code hooks (<b>Settings → Claude Code → Install hooks</b>). Claude Code started in Cursor's terminal then shows up on the Cursor pill, and its permission requests can be answered from the notch, like in VS Code. Cursor's own agent shows up too when Cursor loads Claude Code's hooks; its requests are still answered in Cursor. Pick Cursor as your Main tool if that's where you code. Codex support is coming.</p>
 <h3>No sound</h3>
 <p>Check the speaker icon in the notch header and the volume in Settings.</p>
 <h3>Which model does the chat use?</h3>
@@ -65,11 +65,11 @@ <h3>Puis-je utiliser Coucou avec Gemini CLI ou Antigravity (agy) ? (macOS)</h3>
 <h3>Le chat ne répond pas</h3>
 <p>Ajoute ta clé d’API dans les Réglages : <b>Réglages → Anthropic API</b> pour Claude, ou <b>Réglages → Chat — other providers</b> <i>(macOS)</i> pour Google AI (Gemini) ou OpenAI. L’API est facturée par le fournisseur, à part de tout abonnement.</p>
 <h3>Une pastille reste grise</h3>
-<p>Vérifie sa clé dans les Réglages. Jusqu’à 4 pastilles (hors VS Code) peuvent être actives en même temps — voir <b>Réglages → Active pills</b>.</p>
+<p>Vérifie sa clé dans les Réglages. Jusqu’à 4 pastilles peuvent être actives en même temps, en plus de l’outil de code principal — voir <b>Réglages → Active pills</b>.</p>
 <h3>Qu’est-ce que les Active pills ? (macOS)</h3>
-<p>Les Active pills sont les outils de code, agents et fournisseurs IA que tu déclares dans <b>Réglages → Active pills</b>. VS Code est toujours présent ; tu peux en ajouter jusqu’à 4 autres, dont Gemini CLI, Antigravity, Anthropic, Google AI, OpenAI et des intégrations de services. Quand Cursor ou Codex est coché, un menu Main pill te permet de choisir lequel s’affiche dans la grande carte de l’island. Un agent qui envoie <code>coucou_agent</code> dans son payload obtient quand même sa pastille automatique.</p>
-<h3>Quand les sessions Cursor et Codex seront-elles disponibles ?</h3>
-<p>Les pastilles Cursor et Codex sont déjà dans <b>Réglages → Active pills</b> <i>(Codex : version GitHub uniquement)</i>. Tu peux les déclarer et en faire la Main pill. La prise en charge de leurs sessions arrivera dans une prochaine version.</p>
+<p>Les Active pills sont les outils de code, agents et fournisseurs IA que tu déclares dans <b>Réglages → Active pills</b>. Le sélecteur <b>Main</b> en haut te permet de choisir ton outil principal (VS Code, Cursor ou Antigravity — version GitHub uniquement). Tu peux ensuite ajouter jusqu’à 4 pastilles supplémentaires : Gemini CLI, Anthropic, Google AI, OpenAI et des intégrations de services. Un agent qui envoie <code>coucou_agent</code> dans son payload obtient quand même sa pastille automatique.</p>
+<h3>Puis-je utiliser Coucou avec Cursor ? (macOS)</h3>
+<p>Oui. Installe les hooks Claude Code (<b>Réglages → Claude Code → Install hooks</b>). Claude Code lancé dans le terminal de Cursor apparaît alors sur la pastille Cursor, et tu peux répondre à ses demandes d’autorisation depu
```

---

### Incident Patch 9: `e98c1827` (2026-10-02)
**Commit Message**: Linux: wake the display watcher twice a second, not 60 times

On Linux there is no cursor to poll, so the poll thread only watches the
display layout, which it already did every 30th tick. It still woke every
16 ms to find no cursor. It now sleeps 500 ms between checks; Windows keeps
its 16 ms cursor poll unchanged.

With the previous commit, Coucou at rest on Linux (Mint / Cinnamon, X11)
goes from about 191 to 22 CPU ticks a minute, all processes included —
from ~3.1 % to ~0.4 % of a core.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01UWevVmYyyY4h2iETRvp6wW

**File**: `windows/src-tauri/src/island.rs` (modified, +6/-2)
```diff
@@ -198,19 +198,23 @@ pub fn spawn_cursor_poll(app: AppHandle, gate: Arc<PollGate>) {
         // Remembered across wakes so a display change while hidden is noticed the
         // moment the island comes back.
         let mut last_screen: Option<(i32, i32, u32, u32, u64)> = None;
+        // Without a cursor to read (Linux) the loop only watches the display
+        // layout, and twice a second is plenty for that: waking at 60 Hz just to
+        // find no cursor costs CPU for nothing.
+        let (period, screen_every) = if platform::CURSOR_POLL { (16, 30) } else { (500, 1) };
         loop {
             gate.wait_until_active();
             let mut last = (f64::MIN, f64::MIN);
             let mut ticks: u32 = 0;
             while gate.is_active() {
-                std::thread::sleep(Duration::from_millis(16));
+                std::thread::sleep(Duration::from_millis(period));
 
                 // Monitors get plugged in, unplugged, rearranged and rescaled, and
                 // an island pinned to coordinates that no longer exist is an island
                 // nobody can reach. Checked about twice a second — the cursor poll
                 // is already running, so this costs one monitor query.
                 ticks = ticks.wrapping_add(1);
-                if ticks % 30 == 0 {
+                if ticks % screen_every == 0 {
                     let now = current_screen_key(&app);
                     if now.is_some() && now != last_screen {
                         let first = last_screen.is_none();
```

---

### Incident Patch 10: `7ce5480b` (2026-10-02)
**Commit Message**: Linux: shrink the hidden island to its wake strip, and only take clicks there

While the island was hidden, the window on Linux stayed 240 x 200 instead
of shrinking to the 240 x 6 wake strip, and its input region was the whole
window: an invisible block at the top centre of the screen that swallowed
every click meant for what sat underneath (a browser's tabs or address bar).

* GTK never sizes a non-resizable window below its natural size, and tao
  re-applies `resizable: false`; the window is made resizable just before
  each resize, as @YossiYad found in #44.
* While collapsed, the input region is the wake strip itself rather than
  the whole window, so even a window that fails to shrink cannot swallow
  clicks again.

Checked on Linux Mint / Cinnamon (X11) by reading the X input shape: before,
240x200 with input (0,0,240,200); after, 240x6 with input (0,0,240,6). A
real pointer at the top edge still wakes the island, and it hides again on
its own once the pointer leaves.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01UWevVmYyyY4h2iETRvp6wW

**File**: `windows/src-tauri/src/island.rs` (modified, +11/-1)
```diff
@@ -163,6 +163,13 @@ pub fn apply_geometry(app: &AppHandle, pref: &str, collapsed: bool) {
     let x = mp.x + (ms.width as i32 - pw as i32) / 2;
     let y = mp.y;
 
+    // GTK never sizes a non-resizable window below its natural size (200 px
+    // here), so on Linux the 6 px wake strip would stay a 200 px block. tao
+    // re-applies the config's `resizable: false` after the first configure, so
+    // this is asked every time, just before the resize. Undecorated, the window
+    // still offers the user nothing to resize it by. (Found by @YossiYad, #44.)
+    #[cfg(target_os = "linux")]
+    let _ = win.set_resizable(true);
     let _ = win.set_size(PhysicalSize::new(pw, ph));
     let _ = win.set_position(PhysicalPosition::new(x, y));
     // Moving across displays can rescale the window: re-assert the physical size.
@@ -287,7 +294,10 @@ pub fn refresh_click_through(app: &AppHandle, gate: &PollGate) {
     }
     let Some(win) = window(app) else { return };
     let region = if gate.collapsed.load(Ordering::Relaxed) {
-        None
+        // The wake strip itself, never "the whole window": if the window ever
+        // fails to shrink to the strip, the rest of it must not swallow clicks
+        // meant for whatever sits under the top of the screen.
+        Some((0.0, 0.0, STRIP_W, STRIP_H))
     } else {
         let r = *gate.rect.lock().unwrap();
         if r.w <= 0.0 {
```

---

### Incident Patch 11: `8a5c2632` (2026-10-02)
**Commit Message**: Docs: the Linux beta is out (#93)

**File**: `CLAUDE.md` (modified, +3/-1)
```diff
@@ -1,18 +1,20 @@
 # Coucou — guide for AI coding agents
 
-Coucou is a native macOS app: Mochi, a small animated character living in the MacBook notch, shows AI coding agent sessions (Claude Code, Gemini CLI, Antigravity and more) and a few integrations, and lets the user approve, answer, chat and drop files from the notch.
+Coucou is a native macOS app (`NotchBuddy/`); `windows/` is the Tauri version for Windows and Linux. Mochi, a small animated character living in the MacBook notch, shows AI coding agent sessions (Claude Code, Gemini CLI, Antigravity and more) and a few integrations, and lets the user approve, answer, chat and drop files from the notch.
 
 ## Where things are
 - `NotchBuddy/Sources/App/` — all Swift code. `NotchBuddy/Resources/sounds/` — the 28 WAV sounds. `NotchBuddy/project.yml` — XcodeGen project (never edit the `.xcodeproj` by hand).
 - `NotchBuddy/Sources/App/PillCatalog.swift` — single source of truth for all declared pills (workspace tools, agents, AI providers, services). Every pill ID, color, category and subtitle lives here.
 - `docs/SPEC.md`, `docs/INTEGRATIONS.md` — behaviour, views, states, integrations (in French).
 - `design/prototype/notch-buddy.html` — original prototype, the visual source of truth. `design/captures/` — target screenshots.
+- `windows/` — the Tauri app for Windows and Linux: Rust in `src-tauri/`, TypeScript in `src/`, the `coucou-hook` relay in `hook/`. `windows/README.md` lists what differs from the Mac.
 - `docs/*.html` — the GitHub Pages site (privacy, terms, support, legal notice).
 
 ## Build
 ```
 cd NotchBuddy && xcodegen && xcodebuild -scheme NotchBuddy -configuration Debug build
 ```
+Windows and Linux: `cd windows && npm install && npm run tauri dev`
 
 ## Rules
 - Swift 6, SwiftUI + AppKit. No third-party dependencies unless truly unavoidable. The character is drawn in code (`Canvas` + `TimelineView`), no Rive/Lottie/images.
```

**File**: `README.md` (modified, +8/-6)
```diff
@@ -77,14 +77,14 @@ rest of the differences.
 
 ### Linux
 
-Linux packages are published in [Releases](https://github.com/Louis-CFM/coucou/releases)
-under `linux-v*` tags; the first one is on its way. Until it lands, [build from source](#build-from-source).
-Once it's there:
+The first Linux build is out as a beta: download it from [Coucou for Linux 0.1.1 (beta)](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.1.1), x86_64 only for now. Later versions will be in [Releases](https://github.com/Louis-CFM/coucou/releases) under `linux-v*` tags.
 
 - **AppImage** (any distribution): `chmod +x Coucou-Linux-*.AppImage`, then run it.
 - **Debian / Ubuntu**: `sudo apt install ./Coucou-Linux-*.deb`
 - **Fedora / openSUSE**: `sudo dnf install ./Coucou-Linux-*.rpm`
 
+Check a download with `sha256sum -c SHA256SUMS --ignore-missing`. Gemini CLI, Antigravity and the Google AI and OpenAI chat are macOS only for now.
+
 The island sits on the top edge on compositors with layer-shell — COSMIC, KDE
 Plasma, Hyprland, Sway and other wlroots compositors. GNOME has no layer-shell,
 so there it opens as a regular window. See [`windows/README.md`](windows/README.md#linux).
@@ -114,8 +114,10 @@ npm run pack                # installer lands in windows/release/
 gtk-layer-shell and appindicator development packages (Debian/Ubuntu names below).
 
 ```bash
-sudo apt install libwebkit2gtk-4.1-dev libgtk-layer-shell-dev \
-  libayatana-appindicator3-dev librsvg2-dev libssl-dev patchelf
+sudo apt install build-essential pkg-config \
+  libwebkit2gtk-4.1-dev libgtk-layer-shell-dev libayatana-appindicator3-dev \
+  librsvg2-dev libssl-dev libdbus-1-dev patchelf \
+  gstreamer1.0-plugins-base gstreamer1.0-plugins-good
 git clone https://github.com/Louis-CFM/coucou.git
 cd coucou/windows
 npm install
@@ -143,7 +145,7 @@ If Coucou isn't running, the hook exits immediately: **Claude Code is never bloc
 
 | Do this | Mochi does that |
 |---|---|
-| Hover the notch (top edge on Windows) | peeks out and says hi 👋 |
+| Hover the notch (top edge on Windows and Linux) | peeks out and says hi 👋 |
 | Click it | opens |
 | Hover Mochi | blinks, eyes grow |
 | Click Mochi | squish + annoyed |
```

**File**: `docs/AGENTS.md` (modified, +31/-4)
```diff
@@ -1,6 +1,6 @@
 # Coucou — third-party agent integration
 
-Any tool that can write to a Unix domain socket (macOS) or a named pipe (Windows) can send events to Coucou and have its own pill next to Claude Code.
+Any tool that can write to a Unix domain socket (macOS, Linux) or a named pipe (Windows) can send events to Coucou and have its own pill next to Claude Code.
 
 ## The `coucou_agent` field
 
@@ -38,6 +38,20 @@ Same pattern with the Windows relay:
 }
 ```
 
+## Hook command (Linux)
+
+Same pattern with the Linux relay. Coucou copies the relay to `~/.local/share/coucou/bin/coucou-hook` at startup.
+
+```json
+{
+  "hooks": {
+    "UserPromptSubmit": [
+      { "type": "command", "command": "/path/to/coucou-hook --agent my-tool" }
+    ]
+  }
+}
+```
+
 ## Payload format
 
 The relay adds `coucou_agent` to the JSON it forwards. You can also add it yourself if you talk to the socket directly:
@@ -55,6 +69,7 @@ Send newline-terminated JSON to the socket:
 - **macOS (GitHub build):** `~/Library/Application Support/NotchBuddy/nb.sock`
 - **macOS (App Store build):** `~/Library/Containers/fr.louisraille.Coucou/Data/nb.sock`
 - **Windows:** `\\.\pipe\coucou-<user-SID>`
+- **Linux:** `$XDG_RUNTIME_DIR/coucou.sock` (usually `/run/user/<uid>/coucou.sock`). Only your own user account can connect.
 
 ## Supported events
 
@@ -121,9 +136,21 @@ island's `tool_name` / `session_id`.
 
 ### Any other tool
 
-Follow the generic pattern: call `nb-hook --agent <your-name> <EventName>` (macOS)
-or `coucou-hook.exe --agent <your-name> <EventName>` (Windows) and let the relay
-forward the event.
+Follow the generic pattern: call `nb-hook --agent <your-name> <EventName>` (macOS),
+`coucou-hook.exe --agent <your-name> <EventName>` (Windows)
+or `~/.local/share/coucou/bin/coucou-hook --agent <your-name> <EventName>` (Linux)
+and let the relay forward the event.
+
+## Quick test (Linux)
+
+With Coucou running:
+
+```sh
+echo '{"hook_event_name":"UserPromptSubmit","session_id":"t1","prompt":"hello","coucou_agent":"demo"}' \
+  | ~/.local/share/coucou/bin/coucou-hook --agent demo
+```
+
+A "demo" pill should appear in the island.
 
 ## Quick test (macOS)
 
```

**File**: `docs/index.html` (modified, +2/-2)
```diff
@@ -8,6 +8,6 @@ <h1>A tiny friend that lives in your notch</h1>
 <a class="btn" href="https://github.com/Louis-CFM/coucou/releases/latest">Download for Mac</a><a class="btn ghost" href="https://github.com/Louis-CFM/coucou">View on GitHub</a>
 <img class="demo" src="media/demo.gif" alt="Coucou in action">
 </div>
-<div class="card"><b>Private by design.</b> No account, no analytics, no tracking. Your keys stay in your Keychain, or in Windows Credential Manager. <a href="privacy.html">Read the privacy policy</a>.</div>
-<p class="meta">Requires macOS 15 or later. No notch? Mochi sits in a small bar at the top of the screen. The Windows download is paused for now: Microsoft Defender wrongly flags the unsigned installer, and it will come back once that’s fixed. Windows users can <a href="https://github.com/Louis-CFM/coucou/tree/main/windows#build-it-yourself">build it from source</a>.</p>
+<div class="card"><b>Private by design.</b> No account, no analytics, no tracking. Your keys stay in your Keychain, Windows Credential Manager or the Linux Secret Service. <a href="privacy.html">Read the privacy policy</a>.</div>
+<p class="meta">Requires macOS 15 or later. No notch? Mochi sits in a small bar at the top of the screen. The Windows download is paused for now: Microsoft Defender wrongly flags the unsigned installer, and it will come back once that’s fixed. Windows users can <a href="https://github.com/Louis-CFM/coucou/tree/main/windows#build-it-yourself">build it from source</a>. Linux: a beta is out (AppImage, .deb, .rpm), <a href="https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.1.1">download it here</a>.</p>
 <footer>© 2026 Louis Raillé · Coucou is free and open source (MIT) · <a href="https://github.com/Louis-CFM/coucou">GitHub</a> · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="legal.html">Legal notice</a></footer></div></body></html>
```

**File**: `docs/privacy.html` (modified, +12/-12)
```diff
@@ -17,13 +17,13 @@ <h2>2. Data we collect</h2>
 <h2>3. Data stored on your computer</h2>
 <table>
 <tr><th>What</th><th>Where</th><th>Why</th></tr>
-<tr><td>API keys and tokens you enter (Anthropic, Google AI, OpenAI, Stripe, GitHub, Vercel, Resend, Notion, Cal.com, n8n)</td><td>macOS Keychain, or Windows Credential Manager</td><td>To call these services on your behalf</td></tr>
-<tr><td>Preferences (sound, delays, active pill selection, chat provider and model, shortcut)</td><td>App preferences on your Mac, or <code>%APPDATA%\Coucou</code> on Windows</td><td>To remember your settings</td></tr>
-<tr><td>Files you drop on the notch</td><td>A copy in the app’s own folder (on Windows: <code>%LOCALAPPDATA%\Coucou</code>)</td><td>So you can ask a question about them or attach them to an email</td></tr>
+<tr><td>API keys and tokens you enter (Anthropic, Google AI, OpenAI, Stripe, GitHub, Vercel, Resend, Notion, Cal.com, n8n)</td><td>macOS Keychain, Windows Credential Manager, or the Secret Service on Linux (GNOME Keyring, KWallet)</td><td>To call these services on your behalf</td></tr>
+<tr><td>Preferences (sound, delays, active pill selection, chat provider and model, shortcut)</td><td>App preferences on your Mac, or <code>%APPDATA%\Coucou</code> on Windows; <code>~/.config/coucou</code> on Linux</td><td>To remember your settings</td></tr>
+<tr><td>Files you drop on the notch</td><td>A copy in the app’s own folder (on Windows: <code>%LOCALAPPDATA%\Coucou</code>; on Linux: <code>~/.local/share/coucou</code>)</td><td>So you can ask a question about them or attach them to an email</td></tr>
 <tr><td>Claude Code session events (project name, current step, permission requests)</td><td>In memory only</td><td>To show them in the notch</td></tr>
-<tr><td>Diagnostic log (event and tool names, project names, HTTP status codes — no commands, content or API keys)</td><td><code>~/Library/Logs/NotchBuddy</code> on Mac (App Store: same path inside the container); <code>%LOCALAPPDATA%\Coucou\coucou.log</code> on Windows. Capped at 1 MB. Never leaves your computer.</td><td>To help diagnose connection issues between Claude Code and Coucou</td></tr>
+<tr><td>Diagnostic log (event and tool names, project names, HTTP status codes — no commands, content or API keys)</td><td><code>~/Library/Logs/NotchBuddy</code> on Mac (App Store: same path inside the container); <code>%LOCALAPPDATA%\Coucou\coucou.log</code> on Windows; <code>~/.local/share/coucou/coucou.log</code> on Linux. Capped at 1 MB. Never leaves your computer.</td><td>To help diagnose connection issues between Claude Code and Coucou</td></tr>
 </table>
-<p>You can delete all of this at any time by removing your keys in Settings, then deleting the app and its folder in <code>~/Library/Application Support/NotchBuddy</code> (or the app’s container for the App Store version). On Windows: uninstall Coucou from Settings → Apps, then delete <code>%APPDATA%\Coucou</code> and <code>%LOCALAPPDATA%\Coucou</code>.</p>
+<p>You can delete all of this at any time by removing your keys in Settings, then deleting the app and its folder in <code>~/Library/Application Support/NotchBuddy</code> (or the app’s container for the App Store version). On Windows: uninstall Coucou from Settings → Apps, then delete <code>%APPDATA%\Coucou</code> and <code>%LOCALAPPDATA%\Coucou</code>. On Linux: remove the package (<code>sudo apt remove coucou</code> or <code>sudo dnf remove coucou</code>) or delete the AppImage, then delete <code>~/.config/coucou</code>, <code>~/.local/share/coucou</code>, <code>~/.local/share/fr.louisraille.coucou</code> and <code>~/.cache/coucou</code>.</p>
 
 <h2>4. Services you connect yourself</h2>
 <p>Coucou only talks to the services you configure, directly from your Mac, using your own keys. Those services process your data under their own privacy policies:</p>
@@ -42,7 +42,7 @@ <h2>6. Email</h2>
 <p>When you send a file by email, the message is created and sent by your own Mail app. Coucou never sends email by itself.</p>
 
 <h2>7. System permissions</h2>
-<p>Depending on the version and the features you use, macOS may ask you to allow Automation (Mail, Terminal), Accessibility (to read the title of the window you attach) or Screen Recording (to capture a window you attach). These are only used for the feature you triggered and can be revoked at any time in System Settings → Privacy &amp; Security. The Windows version asks for no special permission and no administrator rights.</p>
+<p>Depending on the version and the features you use, macOS may ask you to allow Automation (Mail, Terminal), Accessibility (to read the title of the window you attach) or Screen Recording (to capture a window you attach). These are only used for the feature you triggered and can be revoked at any time in System Settings → Privacy &amp; Security. The Windows and Linux versions ask for no special permission. On Linux, installing the .deb or .rpm package needs administrator rights; the AppImage doesn't
```

**File**: `docs/support.html` (modified, +6/-0)
```diff
@@ -15,6 +15,8 @@ <h3>macOS says it can’t verify the app</h3>
 <p>The current Mac build isn’t notarized by Apple yet. The first time, open <b>System Settings → Privacy &amp; Security</b>, scroll down and click <b>Open Anyway</b>. You only need to do it once.</p>
 <h3>Where is the Windows download?</h3>
 <p>It is paused for now. Microsoft Defender wrongly flags the unsigned Windows installer as malware; a false-positive report is under review at Microsoft, and the installer will come back once it’s cleared and signed. Until then you can <a href="https://github.com/Louis-CFM/coucou/tree/main/windows#build-it-yourself">build it from source</a>.</p>
+<h3>Is there a Linux version?</h3>
+<p>Yes, in beta: an AppImage, a .deb and a .rpm for x86_64, in <a href="https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.1.1">Coucou for Linux 0.1.1 (beta)</a>. The island sits on the top edge with compositors that support layer-shell (COSMIC, KDE Plasma, Hyprland, Sway…); on GNOME it opens as a regular window. Gemini CLI, Antigravity and the Google AI and OpenAI chat are macOS only for now. Please report anything odd in the <a href="https://github.com/Louis-CFM/coucou/issues">issues</a>.</p>
 <h3>Mochi doesn’t show my Claude Code sessions</h3>
 <p>Open Settings → Claude Code → <b>Install hooks</b>, review the changes, confirm, then start a new Claude Code session.</p>
 <h3>Can I use Coucou with Gemini CLI or Antigravity (agy)? (macOS)</h3>
@@ -36,6 +38,7 @@ <h3>Does it work without a notch?</h3>
 <h3>How do I uninstall?</h3>
 <p>Remove hooks first: <b>Settings → Claude Code → Uninstall</b>, and if you installed them, also <b>Settings → Gemini CLI → Uninstall</b> and <b>Settings → Antigravity → Uninstall</b>. Then quit the app and move it to the Trash. Optionally delete <code>~/Library/Application Support/NotchBuddy</code>.</p>
 <p>On Windows: same <b>Uninstall</b> button for the hooks, then Windows Settings → Apps → <b>Coucou</b> → Uninstall. Optionally delete <code>%LOCALAPPDATA%\Coucou</code>.</p>
+<p>On Linux: same <b>Uninstall</b> button for the hooks, then <code>sudo apt remove coucou</code> or <code>sudo dnf remove coucou</code>, or delete the AppImage. Optionally delete <code>~/.config/coucou</code>, <code>~/.local/share/coucou</code>, <code>~/.local/share/fr.louisraille.coucou</code> and <code>~/.cache/coucou</code>.</p>
 </section>
 <hr>
 <section id="fr" lang="fr">
@@ -49,6 +52,8 @@ <h3>macOS dit qu’il ne peut pas vérifier l’app</h3>
 <p>La version Mac actuelle n’est pas encore notarisée par Apple. La première fois, ouvre <b>Réglages Système → Confidentialité et sécurité</b>, descends et clique sur <b>Ouvrir quand même</b>. Une seule fois suffit.</p>
 <h3>Où est le téléchargement Windows ?</h3>
 <p>Il est en pause pour le moment. Microsoft Defender détecte à tort l’installeur Windows (non signé) comme un malware ; un signalement de faux positif est en cours d’analyse chez Microsoft, et l’installeur reviendra dès que ce sera réglé et signé. En attendant, tu peux <a href="https://github.com/Louis-CFM/coucou/tree/main/windows#build-it-yourself">le compiler depuis le code source</a>.</p>
+<h3>Y a-t-il une version Linux ?</h3>
+<p>Oui, en bêta : une AppImage, un .deb et un .rpm pour x86_64, dans <a href="https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.1.1">Coucou for Linux 0.1.1 (beta)</a>. L’island se place sur le bord du haut avec les compositeurs qui gèrent layer-shell (COSMIC, KDE Plasma, Hyprland, Sway…) ; sous GNOME, elle s’ouvre dans une fenêtre normale. Gemini CLI, Antigravity et le chat avec Google AI et OpenAI sont pour l’instant réservés au Mac. Signale tout souci dans les <a href="https://github.com/Louis-CFM/coucou/issues">issues</a>.</p>
 <h3>Mochi n’affiche pas mes sessions Claude Code</h3>
 <p>Réglages → Claude Code → <b>Install hooks</b>, vérifie les changements, confirme, puis lance une nouvelle session Claude Code.</p>
 <h3>Puis-je utiliser Coucou avec Gemini CLI ou Antigravity (agy) ? (macOS)</h3>
@@ -70,5 +75,6 @@ <h3>Ça marche sans notch ?</h3>
 <h3>Comment désinstaller ?</h3>
 <p>Retire d’abord les hooks : <b>Réglages → Claude Code → Uninstall</b>, et si tu les as installés, aussi <b>Réglages → Gemini CLI → Uninstall</b> et <b>Réglages → Antigravity → Uninstall</b>. Puis quitte l’app et mets-la à la corbeille. Tu peux aussi supprimer <code>~/Library/Application Support/NotchBuddy</code>.</p>
 <p>Sous Windows : le même bouton <b>Uninstall</b> pour les hooks, puis Paramètres Windows → Applications → <b>Coucou</b> → Désinstaller. Tu peux aussi supprimer <code>%LOCALAPPDATA%\Coucou</code>.</p>
+<p>Sous Linux : le même bouton <b>Uninstall</b> pour les hooks, puis <code>sudo apt remove coucou</code> ou <code>sudo dnf remove coucou</code>, ou supprime l’AppImage. Tu peux aussi supprimer <code>~/.config/coucou</code>, <code>~/.local/share/coucou</code>, <code>~/.local/share/fr.louisraille.coucou</code> et <code>~/.cache/coucou</code>.</p>
 </section>
 <footer>© 2026 Louis Raillé · Coucou is
```

**File**: `docs/terms.html` (modified, +4/-4)
```diff
@@ -8,7 +8,7 @@ <h1>Terms of Use</h1>
 <div class="meta">Last updated: October 2, 2026</div>
 
 <h2>1. The app</h2>
-<p>Coucou is a free app for macOS and Windows published by Louis Raillé. Its source code is available on <a href="https://github.com/Louis-CFM/coucou">GitHub</a> under the MIT License. By downloading or using Coucou, you accept these terms.</p>
+<p>Coucou is a free app for macOS, Windows and Linux published by Louis Raillé. Its source code is available on <a href="https://github.com/Louis-CFM/coucou">GitHub</a> under the MIT License. By downloading or using Coucou, you accept these terms.</p>
 
 <h2>2. Licence</h2>
 <ul>
@@ -26,7 +26,7 @@ <h2>5. No warranty</h2>
 <p>Coucou is provided “as is”, without warranty of any kind. To the extent permitted by law, the developer is not liable for any damage arising from its use, including data loss, unexpected actions approved through the app, or charges from third-party services. Nothing in these terms limits rights you have under mandatory consumer protection law.</p>
 
 <h2>6. Trademarks</h2>
-<p>Claude and Claude Code are trademarks of Anthropic, PBC. Mac, macOS and Mac App Store are trademarks of Apple Inc. Google, Gemini, OpenAI, Codex, Cursor, Visual Studio Code, Antigravity, Stripe, GitHub, Vercel, Resend, Notion, Cal.com and n8n are trademarks of their respective owners. Coucou is an independent project and is not affiliated with, endorsed or sponsored by any of them.</p>
+<p>Claude and Claude Code are trademarks of Anthropic, PBC. Mac, macOS and Mac App Store are trademarks of Apple Inc. Google, Gemini, OpenAI, Codex, Cursor, Visual Studio Code, Antigravity, Windows, Linux, Stripe, GitHub, Vercel, Resend, Notion, Cal.com and n8n are trademarks of their respective owners. Coucou is an independent project and is not affiliated with, endorsed or sponsored by any of them.</p>
 
 <h2>7. Changes and termination</h2>
 <p>These terms may be updated; the new version will be published here with a new date. You can stop using Coucou at any time by deleting it.</p>
@@ -44,7 +44,7 @@ <h1>Conditions d’utilisation</h1>
 <div class="meta">Dernière mise à jour : 2 octobre 2026</div>
 
 <h2>1. L’app</h2>
-<p>Coucou est une app gratuite pour macOS et Windows publiée par Louis Raillé. Son code source est disponible sur <a href="https://github.com/Louis-CFM/coucou">GitHub</a> sous licence MIT. En téléchargeant ou en utilisant Coucou, tu acceptes ces conditions.</p>
+<p>Coucou est une app gratuite pour macOS, Windows et Linux publiée par Louis Raillé. Son code source est disponible sur <a href="https://github.com/Louis-CFM/coucou">GitHub</a> sous licence MIT. En téléchargeant ou en utilisant Coucou, tu acceptes ces conditions.</p>
 
 <h2>2. Licence</h2>
 <ul>
@@ -62,7 +62,7 @@ <h2>5. Absence de garantie</h2>
 <p>Coucou est fourni « en l’état », sans garantie d’aucune sorte. Dans les limites permises par la loi, le développeur n’est pas responsable des dommages liés à son utilisation, notamment une perte de données, une action autorisée par erreur via l’app ou des frais facturés par un service tiers. Rien dans ces conditions ne limite les droits que te garantit le droit de la consommation.</p>
 
 <h2>6. Marques</h2>
-<p>Claude et Claude Code sont des marques d’Anthropic, PBC. Mac, macOS et Mac App Store sont des marques d’Apple Inc. Google, Gemini, OpenAI, Codex, Cursor, Visual Studio Code, Antigravity, Stripe, GitHub, Vercel, Resend, Notion, Cal.com et n8n sont des marques de leurs propriétaires respectifs. Coucou est un projet indépendant, sans lien avec eux et ni approuvé ni sponsorisé par eux.</p>
+<p>Claude et Claude Code sont des marques d’Anthropic, PBC. Mac, macOS et Mac App Store sont des marques d’Apple Inc. Google, Gemini, OpenAI, Codex, Cursor, Visual Studio Code, Antigravity, Windows, Linux, Stripe, GitHub, Vercel, Resend, Notion, Cal.com et n8n sont des marques de leurs propriétaires respectifs. Coucou est un projet indépendant, sans lien avec eux et ni approuvé ni sponsorisé par eux.</p>
 
 <h2>7. Modifications et fin</h2>
 <p>Ces conditions peuvent évoluer ; la nouvelle version sera publiée ici avec une nouvelle date. Tu peux arrêter d’utiliser Coucou à tout moment en le supprimant.</p>
```

**File**: `windows/README.md` (modified, +4/-2)
```diff
@@ -153,8 +153,10 @@ The same app builds for Linux: everything that differs lives in
 `src-tauri/src/platform/`, and the relay's transport in `hook/src/unix.rs`.
 
 ```bash
-sudo apt install libwebkit2gtk-4.1-dev libgtk-layer-shell-dev \
-  libayatana-appindicator3-dev librsvg2-dev libssl-dev patchelf
+sudo apt install build-essential pkg-config \
+  libwebkit2gtk-4.1-dev libgtk-layer-shell-dev libayatana-appindicator3-dev \
+  librsvg2-dev libssl-dev libdbus-1-dev patchelf \
+  gstreamer1.0-plugins-base gstreamer1.0-plugins-good
 npm install
 npm run tauri dev      # live-reloading development build
 npm run pack           # AppImage, .deb and .rpm in windows/release/
```

---

### Incident Patch 12: `b804f079` (2026-10-01)
**Commit Message**: Don't inject the debug entitlement into Release builds (#89)

**File**: `NotchBuddy/NotchBuddy.xcodeproj/project.pbxproj` (modified, +1/-0)
```diff
@@ -546,6 +546,7 @@
 				CODE_SIGNING_REQUIRED = YES;
 				CODE_SIGN_ENTITLEMENTS = Resources/Coucou.entitlements;
 				CODE_SIGN_IDENTITY = "Developer ID Application";
+				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COPY_PHASE_STRIP = NO;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
```

**File**: `NotchBuddy/project.yml` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ settings:
       CODE_SIGN_IDENTITY: "Developer ID Application"
       DEVELOPMENT_TEAM: 256AUJ9555
       OTHER_CODE_SIGN_FLAGS: "--timestamp"
+      CODE_SIGN_INJECT_BASE_ENTITLEMENTS: NO
       CODE_SIGN_ENTITLEMENTS: Resources/Coucou.entitlements
 
 schemes:
```

---

### Incident Patch 13: `c0bb71fd` (2026-10-01)
**Commit Message**: linux.yml: build and test pull requests that touch windows/

PUBLISH stays 'false'. The publish job requires a push of a linux-v* tag,
checked both in the build job's gate and in the job's own if:, so a pull
request can never reach it; pull requests upload no artifacts.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01U6iHtaxRfhryJ62nLk7nDJ

**File**: `.github/workflows/linux.yml` (modified, +14/-4)
```diff
@@ -1,8 +1,9 @@
 name: Linux
 
 # Builds the Linux app (AppImage, .deb, .rpm) from the same Tauri project as
-# Windows. Triggered by tags like `linux-v0.1.0`, or by hand; the macOS and
-# Windows workflows are untouched.
+# Windows. Triggered by tags like `linux-v0.1.0`, by hand, and by pull requests
+# that touch windows/ or this file (build and test only); the macOS and Windows
+# workflows are untouched.
 #
 # Two jobs on purpose. `build` runs npm, cargo and the AppImage tooling (which
 # downloads its own helpers) with a read-only token that is not even kept on
@@ -13,6 +14,13 @@ on:
     tags:
       - 'linux-v*'
   workflow_dispatch:
+  # Build and test only. A pull request never uploads artifacts and never
+  # reaches the publish job (see the two gates below), and a fork's token is
+  # read-only anyway.
+  pull_request:
+    paths:
+      - 'windows/**'
+      - '.github/workflows/linux.yml'
 
 permissions:
   contents: read
@@ -109,7 +117,7 @@ jobs:
 
       - name: Decide whether to publish
         id: gate
-        run: echo "publish=${{ env.PUBLISH == 'true' && startsWith(github.ref, 'refs/tags/linux-v') }}" >> "$GITHUB_OUTPUT"
+        run: echo "publish=${{ github.event_name == 'push' && env.PUBLISH == 'true' && startsWith(github.ref, 'refs/tags/linux-v') }}" >> "$GITHUB_OUTPUT"
 
       # Upload only on a manual run or when publishing a release, as on Windows.
       # The repo is public, so artifacts are downloadable by any signed-in GitHub
@@ -125,7 +133,9 @@ jobs:
 
   publish:
     needs: build
-    if: needs.build.outputs.publish == 'true'
+    # Checked again here, so a pull request can never get this far whatever
+    # the build job reports.
+    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/linux-v') && needs.build.outputs.publish == 'true'
     runs-on: ubuntu-22.04
     permissions:
       contents: write
```

---

### Incident Patch 14: `bef6558b` (2026-10-01)
**Commit Message**: Linux: harden the relay socket, file permissions and release workflow

- The relay socket only lives in a runtime directory that is ours, private
  (no group/other bits) and not a symlink, checked on both ends; otherwise
  hooks stay off. The hook also checks the size getsockopt returns.
- settings.json keeps its permissions (and a dotfiles symlink) when Coucou
  rewrites it; the temp file is created 0600.
- The hook command is single-quoted on Unix, so sh reads the path literally.
- ~/.local/share/coucou and ~/.config/coucou are 0700, the log 0600.
- The relay is installed by copy-and-rename, compared by content.
- open_in_vscode only opens an existing absolute folder.
- linux.yml: read-only build job without persisted credentials, a separate
  publish job with write access, PUBLISH off until a first build is checked,
  artifacts only on manual runs or publishing (3 days), SHA256SUMS, and the
  relay built before cargo test.
- deb depends on gtk-layer-shell >= 0.6, which the bindings need.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01U6iHtaxRfhryJ62nLk7nDJ

**File**: `.github/workflows/linux.yml` (modified, +60/-12)
```diff
@@ -1,8 +1,12 @@
 name: Linux
 
 # Builds the Linux app (AppImage, .deb, .rpm) from the same Tauri project as
-# Windows and publishes the packages. Triggered by tags like `linux-v0.1.0`;
-# the macOS and Windows workflows are untouched.
+# Windows. Triggered by tags like `linux-v0.1.0`, or by hand; the macOS and
+# Windows workflows are untouched.
+#
+# Two jobs on purpose. `build` runs npm, cargo and the AppImage tooling (which
+# downloads its own helpers) with a read-only token that is not even kept on
+# disk. Only `publish`, which runs none of that code, may write to the repo.
 
 on:
   push:
@@ -11,22 +15,30 @@ on:
   workflow_dispatch:
 
 permissions:
-  contents: write
+  contents: read
 
+# Off until a first build has been checked by hand: run this workflow manually,
+# download the Coucou-Linux artifact, try it, then set this to 'true' and push a
+# linux-v* tag.
 env:
-  PUBLISH: 'true'
+  PUBLISH: 'false'
 
 jobs:
   build:
     # The oldest supported Ubuntu: an AppImage only runs on systems whose glibc
     # is at least as new as the one it was built against.
     runs-on: ubuntu-22.04
+    outputs:
+      version: ${{ steps.pack.outputs.version }}
+      publish: ${{ steps.gate.outputs.publish }}
     defaults:
       run:
         working-directory: windows
 
     steps:
       - uses: actions/checkout@v4
+        with:
+          persist-credentials: false
 
       # webkit2gtk, gtk-layer-shell and appindicator to build against; patchelf
       # and the GStreamer plugins for the AppImage, which carries its own
@@ -74,8 +86,12 @@ jobs:
           [ "$tag" = "$cargo" ] || bad="$bad Cargo.toml says $cargo;"
           if [ -n "$bad" ]; then echo "tag says $tag but$bad"; exit 1; fi
 
+      # The app bundles target/release/coucou-hook as a resource, and its build
+      # script refuses to run until that file exists.
       - name: Test
-        run: cargo test --workspace
+        run: |
+          cargo build --release -p coucou-hook
+          cargo test --workspace
 
       # linuxdeploy is itself an AppImage; runners have no FUSE, so it unpacks
       # itself instead of mounting.
@@ -86,26 +102,57 @@ jobs:
         run: |
           npm run pack
           echo "version=$(node -p "require('./src-tauri/tauri.conf.json').version")" >> "$GITHUB_OUTPUT"
-          ls -la release
-
+          cd release
+          sha256sum Coucou-Linux-* > SHA256SUMS
+          ls -la
+          cat SHA256SUMS
+
+      - name: Decide whether to publish
+        id: gate
+        run: echo "publish=${{ env.PUBLISH == 'true' && startsWith(github.ref, 'refs/tags/linux-v') }}" >> "$GITHUB_OUTPUT"
+
+      # Upload only on a manual run or when publishing a release, as on Windows.
+      # The repo is public, so artifacts are downloadable by any signed-in GitHub
+      # user; retention-days: 3 limits exposure.
       - uses: actions/upload-artifact@v4
+        if: github.event_name == 'workflow_dispatch' || steps.gate.outputs.publish == 'true'
         with:
           name: Coucou-Linux
           path: |
-            windows/release/Coucou-Linux-${{ steps.pack.outputs.version }}-*
+            windows/release/Coucou-Linux-*
+            windows/release/SHA256SUMS
+          retention-days: 3
+
+  publish:
+    needs: build
+    if: needs.build.outputs.publish == 'true'
+    runs-on: ubuntu-22.04
+    permissions:
+      contents: write
+
+    steps:
+      # Only for the linux-latest tag below; nothing from the repo is run.
+      - uses: actions/checkout@v4
+
+      - uses: actions/download-artifact@v4
+        with:
+          name: Coucou-Linux
+          path: release
 
       - name: Publish the release
-        if: env.PUBLISH == 'true' && startsWith(github.ref, 'refs/tags/linux-v')
         env:
           GH_TOKEN: ${{ github.token }}
+          VERSION: ${{ needs.build.outputs.version }}
         run: |
-          v="${{ steps.pack.outputs.version }}"
+          v="$VERSION"
           notes="Coucou for Linux $v — Mochi at the top of your screen.
 
           - **AppImage** (any distribution): \`chmod +x Coucou-Linux-$v-x86_64.AppImage\` and run it.
           - **Debian / Ubuntu**: \`sudo apt install ./Coucou-Linux-$v-amd64.deb\`
           - **Fedora / openSUSE**: \`sudo dnf install ./Coucou-Linux-$v-x86_64.rpm\`
 
+          Check a download with \`sha256sum -c SHA256SUMS --ignore-missing\`.
+
           The island sits on the top edge on compositors with layer-shell (COSMIC,
           KDE Plasma, Hyprland, Sway…). On GNOME it opens as a regular window."
           # --latest=false: the macOS \`v*\` releases own the Latest slot, which
@@ -114,16 +161,17 @@ jobs:
             "release/Coucou-Linux-$v-x86_64.AppImage" \
             "release/Coucou-Linux-$v-amd64.deb" \
             "release/Coucou-Linux-$v-x86_64.rpm" \
+            "release/SHA256SUMS" \
             --title "Coucou for Linux $v" \
             --notes "$notes" \
             --latest=false
 
       - name: Update the rolling linu
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 - Declare the tools you use in Settings: Gemini CLI, Antigravity, Anthropic, Google AI and OpenAI pills join the existing ones (Cursor and Codex pills are coming soon), and you pick the main pill.
 - Chat now supports Google AI (Gemini) and OpenAI in addition to Anthropic; switch provider and model by clicking the model name in the chat view, on macOS.
+- Linux version: the Tauri app now builds for Linux too (AppImage, .deb, .rpm), with the island as a layer-shell overlay on Wayland and Claude Code hooks over a private Unix socket (#21) — thanks @Davy133
 - Compact island on screens without a notch (#22) — thanks @Kamasoutra
 - Only web links (http/https) open from the notch; other kinds of links from Claude or integrations are ignored (#16) — thanks @Cris1670
 - Hook socket limited to your own user account, with size and time limits; logs no longer keep commands, n8n data or full URLs, and stay under 1 MB (#16) — thanks @Cris1670 and @Vignesh-Thangamariappan
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -77,7 +77,9 @@ rest of the differences.
 
 ### Linux
 
-Grab a package from [Releases](https://github.com/Louis-CFM/coucou/releases):
+Linux packages are published in [Releases](https://github.com/Louis-CFM/coucou/releases)
+under `linux-v*` tags; the first one is on its way. Until it lands, [build from source](#build-from-source).
+Once it's there:
 
 - **AppImage** (any distribution): `chmod +x Coucou-Linux-*.AppImage`, then run it.
 - **Debian / Ubuntu**: `sudo apt install ./Coucou-Linux-*.deb`
```

**File**: `windows/hook/src/unix.rs` (modified, +17/-7)
```diff
@@ -15,17 +15,25 @@ use std::time::{Duration, Instant};
 use crate::CONNECT_TIMEOUT;
 
 /// `$XDG_RUNTIME_DIR/coucou.sock`, or `/run/user/<uid>/coucou.sock` when the
-/// variable is missing (a hook started from a stripped-down environment).
+/// variable is missing (a hook started from a stripped-down environment). The
+/// directory must be ours and closed to everyone else, or there is no relay.
 /// Must match `platform::relay_socket_path()` in the app exactly.
 fn socket_path() -> Option<PathBuf> {
     let dir = std::env::var_os("XDG_RUNTIME_DIR")
         .map(PathBuf::from)
         .filter(|p| p.is_absolute())
-        .or_else(|| {
-            let p = PathBuf::from(format!("/run/user/{}", unsafe { libc::getuid() }));
-            p.is_dir().then_some(p)
-        })?;
-    Some(dir.join("coucou.sock"))
+        .unwrap_or_else(|| PathBuf::from(format!("/run/user/{}", unsafe { libc::getuid() })));
+    is_private_dir(&dir).then(|| dir.join("coucou.sock"))
+}
+
+/// A real directory (not a symlink), owned by us, no access for group or others.
+fn is_private_dir(dir: &Path) -> bool {
+    use std::os::unix::fs::MetadataExt;
+    std::fs::symlink_metadata(dir)
+        .map(|m| {
+            m.file_type().is_dir() && m.uid() == unsafe { libc::getuid() } && m.mode() & 0o077 == 0
+        })
+        .unwrap_or(false)
 }
 
 /// Opens the socket. Retries only while the app's backlog is full: any other
@@ -100,5 +108,7 @@ fn server_is_same_user(stream: &UnixStream) -> bool {
             &mut len,
         )
     };
-    rc == 0 && cred.uid == unsafe { libc::getuid() }
+    rc == 0
+        && len as usize == std::mem::size_of::<libc::ucred>()
+        && cred.uid == unsafe { libc::getuid() }
 }
```

**File**: `windows/src-tauri/src/files.rs` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ pub fn ingest(source: &str) -> Result<DroppedFile, String> {
     }
 
     let dir = inbox_dir();
+    crate::platform::ensure_private_dir(&settings::local_dir()).map_err(|e| e.to_string())?;
     std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
 
     let name = src
```

**File**: `windows/src-tauri/src/hooks.rs` (modified, +121/-4)
```diff
@@ -103,11 +103,27 @@ fn read_settings_lossy() -> Value {
     read_settings().unwrap_or_else(|_| json!({}))
 }
 
+#[cfg(windows)]
 fn hook_command(event: &str) -> String {
     let exe = settings::hook_exe_path().to_string_lossy().replace('\\', "/");
     format!("\"{exe}\" {event}")
 }
 
+/// Claude Code runs the command through `sh`, which still reads `$`, `` ` ``
+/// and `\` inside double quotes. Single quotes keep the path a path, whatever
+/// the home directory is called.
+#[cfg(unix)]
+fn hook_command(event: &str) -> String {
+    format!("{} {event}", sh_quote(&settings::hook_exe_path().to_string_lossy()))
+}
+
+/// `s` as one single-quoted shell word: `'` becomes `'\''`, nothing else is
+/// special inside single quotes.
+#[cfg(unix)]
+fn sh_quote(s: &str) -> String {
+    format!("'{}'", s.replace('\'', r"'\''"))
+}
+
 fn entry_is_ours(entry: &Value) -> bool {
     entry
         .get("hooks")
@@ -284,17 +300,51 @@ pub fn write(install: bool, fingerprint: &str) -> Result<String, String> {
     let mut text = pretty(&next);
     text.push('\n');
 
+    // A dotfiles setup often makes settings.json a symlink: write to the file it
+    // points at, so the link survives the rename below.
+    #[cfg(unix)]
+    let path = std::fs::canonicalize(&path).unwrap_or(path);
+
     // Write beside the target and rename over it: a crash or a full disk leaves
     // the original settings.json intact rather than half a file.
     let temp = path.with_extension(format!("json.coucou-{}", std::process::id()));
-    std::fs::write(&temp, text.as_bytes()).map_err(|e| format!("write failed: {e}"))?;
+    if let Err(err) = write_like(&temp, &path, text.as_bytes()) {
+        let _ = std::fs::remove_file(&temp);
+        return Err(format!("write failed: {err}"));
+    }
     if let Err(err) = std::fs::rename(&temp, &path) {
         let _ = std::fs::remove_file(&temp);
         return Err(format!("write failed: {err}"));
     }
     Ok(backup.to_string_lossy().to_string())
 }
 
+/// Writes `bytes` to `temp`, which is about to replace `original`.
+///
+/// On Linux a fresh file would get the umask's 0644, and settings.json can hold
+/// API keys in its `env` block: the new file is created readable by us only,
+/// then given the original's permissions, so the rename never widens them.
+fn write_like(temp: &Path, original: &Path, bytes: &[u8]) -> std::io::Result<()> {
+    use std::io::Write;
+    let mut options = std::fs::OpenOptions::new();
+    options.write(true).create(true).truncate(true);
+    #[cfg(unix)]
+    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
+    let mut file = options.open(temp)?;
+    file.write_all(bytes)?;
+    #[cfg(unix)]
+    {
+        use std::os::unix::fs::PermissionsExt;
+        let mode = std::fs::metadata(original)
+            .map(|m| m.permissions().mode() & 0o777)
+            .unwrap_or(0o600);
+        file.set_permissions(std::fs::Permissions::from_mode(mode))?;
+    }
+    #[cfg(not(unix))]
+    let _ = original;
+    Ok(())
+}
+
 /// Copies the relay (coucou-hook.exe / coucou-hook) into the local data dir's
 /// bin/ on launch. In a bundled install it comes from the app resources; in
 /// `tauri dev` it sits next to the app binary in the workspace target directory.
@@ -307,7 +357,10 @@ pub fn write(install: bool, fingerprint: &str) -> Result<String, String> {
 pub fn ensure_hook_exe(app: &AppHandle) {
     let dest = settings::hook_exe_path();
     let Some(dir) = dest.parent() else { return };
-    if std::fs::create_dir_all(dir).is_err() {
+    // Nobody else may swap the relay Claude Code runs: its folder is ours only.
+    if platform::ensure_private_dir(&settings::local_dir()).is_err()
+        || std::fs::create_dir_all(dir).is_err()
+    {
         return;
     }
 
@@ -335,8 +388,12 @@ pub fn ensure_hook_exe(app: &AppHandle) {
         ));
         return;
     };
+    install_relay(&src, &dest);
+}
 
-    let same = match (std::fs::metadata(&src), std::fs::metadata(&dest)) {
+#[cfg(windows)]
+fn install_relay(src: &Path, dest: &Path) {
+    let same = match (std::fs::metadata(src), std::fs::metadata(dest)) {
         (Ok(a), Ok(b)) => a.len() == b.len() && a.modified().ok() == b.modified().ok(),
         _ => false,
     };
@@ -345,13 +402,33 @@ pub fn ensure_hook_exe(app: &AppHandle) {
     }
     // A hook may be running right now and hold the file open; keeping the old
     // copy is fine, it is the same relay.
-    if let Err(err) = std::fs::copy(&src, &dest) {
+    if let Err(err) = std::fs::copy(src, dest) {
         if !dest.exists() {
             crate::log::line(format!("could not install {}: {err}", platform::HOOK_EXE));
         }
     }
 }
 
+/// Linux does not keep the modification time on copy, so the contents decide.
+/// The new relay is written beside the old one and renamed over it: a hook
+/// starting at that moment runs either the old relay or the new one, never half
+/// of one, and a relay that is running right now does not 
```

**File**: `windows/src-tauri/src/lib.rs` (modified, +12/-2)
```diff
@@ -140,16 +140,26 @@ fn open_in_vscode(path: Option<String>) -> bool {
     // whoever is using Claude Code, and a shell would happily read `&`, `^`, `%`
     // or `$` in a folder name as syntax. Finding the launcher ourselves and
     // handing the path over as a separate argument keeps it a path.
+    let path = path.filter(|p| !p.is_empty());
+    // It arrives in a hook payload: only an existing folder, given by its full
+    // path, goes any further. `code` would read `--something` as an option, and
+    // xdg-open would launch a file with whatever handles its type.
+    if let Some(p) = path.as_deref() {
+        let p = std::path::Path::new(p);
+        if !(p.is_absolute() && p.is_dir()) {
+            return false;
+        }
+    }
     if let Some(code) = platform::find_on_path("code") {
         let mut cmd = Command::new(code);
-        if let Some(p) = path.as_deref().filter(|p| !p.is_empty()) {
+        if let Some(p) = path.as_deref() {
             cmd.arg(p);
         }
         if platform::no_console(&mut cmd).spawn().is_ok() {
             return true;
         }
     }
-    if let Some(p) = path.as_deref().filter(|p| !p.is_empty()) {
+    if let Some(p) = path.as_deref() {
         platform::reveal_folder(p);
     }
     false
```

**File**: `windows/src-tauri/src/log.rs` (modified, +7/-2)
```diff
@@ -13,15 +13,20 @@ pub fn line(message: impl AsRef<str>) {
         t.year, t.month, t.day, t.hour, t.minute, t.second
     );
     let dir = settings::local_dir();
-    if std::fs::create_dir_all(&dir).is_err() {
+    if platform::ensure_private_dir(&dir).is_err() {
         return;
     }
     let path = dir.join("coucou.log");
     // Keep it from growing forever: start fresh past ~1 MB.
     if std::fs::metadata(&path).map(|m| m.len() > 1_000_000).unwrap_or(false) {
         let _ = std::fs::remove_file(&path);
     }
-    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
+    let mut options = std::fs::OpenOptions::new();
+    options.create(true).append(true);
+    // Readable by us only, like the macOS log.
+    #[cfg(unix)]
+    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
+    if let Ok(mut file) = options.open(path) {
         let _ = writeln!(file, "{stamp} {}", message.as_ref());
     }
 }
```

---

### Incident Patch 15: `06c57ead` (2026-09-30)
**Commit Message**: Package and release the Linux build

- tauri.linux.conf.json builds an AppImage (with its own GStreamer, so
  the sounds play), a .deb and an .rpm; both packages depend on
  gtk-layer-shell, the AppImage carries it
- pack.mjs knows each platform's packages and ships Linux ones as
  Coucou-Linux-<version>-<arch>.{AppImage,deb,rpm}, plus a rolling
  Coucou-Linux-x86_64.AppImage; the Windows output is unchanged
- linux.yml builds on ubuntu-22.04 (oldest glibc supported) on
  linux-v* tags, runs the tests, and publishes a release with
  --latest=false plus a rolling linux-latest one
- README and windows/README document installing, building and what
  differs on Linux

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/linux.yml` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+name: Linux
+
+# Builds the Linux app (AppImage, .deb, .rpm) from the same Tauri project as
+# Windows and publishes the packages. Triggered by tags like `linux-v0.1.0`;
+# the macOS and Windows workflows are untouched.
+
+on:
+  push:
+    tags:
+      - 'linux-v*'
+  workflow_dispatch:
+
+permissions:
+  contents: write
+
+env:
+  PUBLISH: 'true'
+
+jobs:
+  build:
+    # The oldest supported Ubuntu: an AppImage only runs on systems whose glibc
+    # is at least as new as the one it was built against.
+    runs-on: ubuntu-22.04
+    defaults:
+      run:
+        working-directory: windows
+
+    steps:
+      - uses: actions/checkout@v4
+
+      # webkit2gtk, gtk-layer-shell and appindicator to build against; patchelf
+      # and the GStreamer plugins for the AppImage, which carries its own
+      # GStreamer so the sounds play (WAV needs wavparse, in -good).
+      - name: Install system libraries
+        working-directory: .
+        run: |
+          sudo apt-get update
+          sudo apt-get install -y \
+            libwebkit2gtk-4.1-dev libgtk-layer-shell-dev libayatana-appindicator3-dev \
+            librsvg2-dev libssl-dev libdbus-1-dev patchelf \
+            gstreamer1.0-plugins-base gstreamer1.0-plugins-good
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22
+          cache: npm
+          cache-dependency-path: windows/package-lock.json
+
+      - name: Cache cargo
+        uses: actions/cache@v4
+        with:
+          path: |
+            ~/.cargo/registry
+            ~/.cargo/git
+            windows/target
+          key: linux-cargo-${{ hashFiles('windows/Cargo.lock') }}
+          restore-keys: linux-cargo-
+
+      - name: Install dependencies
+        run: npm ci
+
+      # Same check as the Windows workflow: three files carry the version.
+      - name: Check the tag and every version agree
+        if: startsWith(github.ref, 'refs/tags/linux-v')
+        run: |
+          tag="${GITHUB_REF_NAME#linux-v}"
+          conf=$(node -p "require('./src-tauri/tauri.conf.json').version")
+          pkg=$(node -p "require('./package.json').version")
+          cargo=$(sed -nE 's/^version\s*=\s*"(.+)"/\1/p' Cargo.toml | head -1)
+          echo "tag=$tag tauri.conf=$conf package.json=$pkg Cargo.toml=$cargo"
+          bad=""
+          [ "$tag" = "$conf" ]  || bad="$bad tauri.conf.json says $conf;"
+          [ "$tag" = "$pkg" ]   || bad="$bad package.json says $pkg;"
+          [ "$tag" = "$cargo" ] || bad="$bad Cargo.toml says $cargo;"
+          if [ -n "$bad" ]; then echo "tag says $tag but$bad"; exit 1; fi
+
+      - name: Test
+        run: cargo test --workspace
+
+      # linuxdeploy is itself an AppImage; runners have no FUSE, so it unpacks
+      # itself instead of mounting.
+      - name: Build and pack
+        id: pack
+        env:
+          APPIMAGE_EXTRACT_AND_RUN: '1'
+        run: |
+          npm run pack
+          echo "version=$(node -p "require('./src-tauri/tauri.conf.json').version")" >> "$GITHUB_OUTPUT"
+          ls -la release
+
+      - uses: actions/upload-artifact@v4
+        with:
+          name: Coucou-Linux
+          path: |
+            windows/release/Coucou-Linux-${{ steps.pack.outputs.version }}-*
+
+      - name: Publish the release
+        if: env.PUBLISH == 'true' && startsWith(github.ref, 'refs/tags/linux-v')
+        env:
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          v="${{ steps.pack.outputs.version }}"
+          notes="Coucou for Linux $v — Mochi at the top of your screen.
+
+          - **AppImage** (any distribution): \`chmod +x Coucou-Linux-$v-x86_64.AppImage\` and run it.
+          - **Debian / Ubuntu**: \`sudo apt install ./Coucou-Linux-$v-amd64.deb\`
+          - **Fedora / openSUSE**: \`sudo dnf install ./Coucou-Linux-$v-x86_64.rpm\`
+
+          The island sits on the top edge on compositors with layer-shell (COSMIC,
+          KDE Plasma, Hyprland, Sway…). On GNOME it opens as a regular window."
+          # --latest=false: the macOS \`v*\` releases own the Latest slot, which
+          # the site's Download for Mac button points at.
+          gh release create "$GITHUB_REF_NAME" \
+            "release/Coucou-Linux-$v-x86_64.AppImage" \
+            "release/Coucou-Linux-$v-amd64.deb" \
+            "release/Coucou-Linux-$v-x86_64.rpm" \
+            --title "Coucou for Linux $v" \
+            --notes "$notes" \
+            --latest=false
+
+      - name: Update the rolling linux-latest release
+        if: env.PUBLISH == 'true' && startsWith(github.ref, 'refs/tags/linux-v')
+        env:
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          v="${{ steps.pack.outputs.version }}"
+          if gh release view linux-latest >/dev/null 2>&1; then
+            # The tag has to follow the release, as for windows-latest.
+            git tag -f linux-latest "$GITHUB_SHA"
+            git push -f origin linux-latest
+            gh release edit 
```

**File**: `README.md` (modified, +38/-6)
```diff
@@ -4,12 +4,13 @@
 
 # Coucou
 
-**A tiny friend that lives in your Mac's notch — or at the top of your screen on Windows — and keeps an eye on your AI coding agent sessions.**
+**A tiny friend that lives in your Mac's notch — or at the top of your screen on Windows and Linux — and keeps an eye on your AI coding agent sessions.**
 
 Approve permissions, watch your agents work, drop a file, chat with Claude — all without leaving what you're doing.
 
 ![macOS 15+](https://img.shields.io/badge/macOS-15%2B-black?logo=apple)
 ![Windows 10/11](https://img.shields.io/badge/Windows-10%2F11-0078D4?logo=windows&logoColor=white)
+![Linux](https://img.shields.io/badge/Linux-AppImage%20%7C%20deb%20%7C%20rpm-FCC624?logo=linux&logoColor=black)
 ![Swift 6](https://img.shields.io/badge/Swift-6-F05138?logo=swift&logoColor=white)
 ![SwiftUI](https://img.shields.io/badge/SwiftUI-native-0A84FF)
 ![Tauri 2](https://img.shields.io/badge/Tauri-2-FFC131?logo=tauri&logoColor=black)
@@ -40,9 +41,9 @@ Meet **Mochi**: a soft little squircle with big eyes that pops out of your notch
 - 🪟 **Drag Mochi onto any window** — attach that window as context for Claude *(macOS)*.
 - 🔌 **Integrations** — Stripe payments, n8n workflows, GitHub, Vercel deployments, Resend emails, Notion, Cal.com. Each one gets its own little colored Mochi.
 - 🎭 **A real character** — idle breathing, blinks, eyes on a sphere that follow your mouse, emotes, 28 handcrafted sounds, a greeting on launch.
-- 🫥 **Invisible when idle** — hides away when nothing is running, peeks out when you hover the notch (the top edge of the screen on Windows).
+- 🫥 **Invisible when idle** — hides away when nothing is running, peeks out when you hover the notch (the top edge of the screen on Windows and Linux).
 - 🖥️ **Any Mac, notch or not** — on an iMac, a Mac mini, or a MacBook with its lid closed on an external display, Mochi sits in a small bar at the top of the screen.
-- 🔒 **Private by design** — no telemetry, no account. Keys live in your macOS Keychain or Windows Credential Manager. The app only talks to the services you plug in.
+- 🔒 **Private by design** — no telemetry, no account. Keys live in your macOS Keychain, Windows Credential Manager or Linux Secret Service (GNOME Keyring, KWallet). The app only talks to the services you plug in.
 
 <table>
 <tr>
@@ -74,6 +75,18 @@ There is no notch on a PC, so the island slides out of the top edge of the scree
 instead of hiding inside one. See [`windows/README.md`](windows/README.md) for the
 rest of the differences.
 
+### Linux
+
+Grab a package from [Releases](https://github.com/Louis-CFM/coucou/releases):
+
+- **AppImage** (any distribution): `chmod +x Coucou-Linux-*.AppImage`, then run it.
+- **Debian / Ubuntu**: `sudo apt install ./Coucou-Linux-*.deb`
+- **Fedora / openSUSE**: `sudo dnf install ./Coucou-Linux-*.rpm`
+
+The island sits on the top edge on compositors with layer-shell — COSMIC, KDE
+Plasma, Hyprland, Sway and other wlroots compositors. GNOME has no layer-shell,
+so there it opens as a regular window. See [`windows/README.md`](windows/README.md#linux).
+
 ### Build from source
 
 **macOS** — requirements: macOS 15+, Xcode 16+, [XcodeGen](https://github.com/yonaskolb/XcodeGen).
@@ -95,20 +108,32 @@ npm install
 npm run pack                # installer lands in windows/release/
 ```
 
+**Linux** — requirements: [Rust](https://rustup.rs), Node 20+, and the WebKitGTK,
+gtk-layer-shell and appindicator development packages (Debian/Ubuntu names below).
+
+```bash
+sudo apt install libwebkit2gtk-4.1-dev libgtk-layer-shell-dev \
+  libayatana-appindicator3-dev librsvg2-dev libssl-dev patchelf
+git clone https://github.com/Louis-CFM/coucou.git
+cd coucou/windows
+npm install
+npm run pack                # AppImage, .deb and .rpm land in windows/release/
+```
+
 ## Setup
 
-Click the Coucou icon in the menu bar (macOS) or in the system tray (Windows) → **Settings…**
+Click the Coucou icon in the menu bar (macOS) or in the system tray (Windows, Linux) → **Settings…**
 
 | What | Why | Where the key goes |
 |---|---|---|
 | **Claude Code hooks** | live sessions and approvals | **Install hooks** — Coucou backs up `~/.claude/settings.json`, merges its hooks and shows you the diff before writing anything |
 | **Gemini CLI hooks** *(macOS)* | Gemini CLI sessions in the island | **Install hooks** in Settings → Gemini CLI — backs up `~/.gemini/settings.json` |
 | **Antigravity (agy) hooks** *(macOS)* | agy sessions in the island | **Install hooks** in Settings → Antigravity — backs up `~/.gemini/config/hooks.json` |
-| **Anthropic API key** | chat and questions about files | Settings → Anthropic API · Keychain / Windows Credential Manager |
+| **Anthropic API key** | chat and questions about files | Settings → Anthropic API · Keychain / Windows Credential Manager / Secret Service |
 | **Google AI API key** *(macOS)* | chat with Google AI (Gemini) | Settings → Chat — other providers · Keychain |
 | **OpenAI API key** *(macOS)
```

**File**: `windows/README.md` (modified, +33/-0)
```diff
@@ -146,3 +146,36 @@ problems. It stays on your machine.
   attach it as context, and jumping to a specific terminal window — "Open
   terminal" opens the working folder in VS Code when `code` is on your `PATH`.
 - Cal.com shows the next bookings as a list rather than the Mac's calendar.
+
+## Linux
+
+The same app builds for Linux: everything that differs lives in
+`src-tauri/src/platform/`, and the relay's transport in `hook/src/unix.rs`.
+
+```bash
+sudo apt install libwebkit2gtk-4.1-dev libgtk-layer-shell-dev \
+  libayatana-appindicator3-dev librsvg2-dev libssl-dev patchelf
+npm install
+npm run tauri dev      # live-reloading development build
+npm run pack           # AppImage, .deb and .rpm in windows/release/
+```
+
+What changes on Linux:
+
+- **The island** is a gtk-layer-shell overlay anchored to the top edge, over any
+  top panel, on compositors that support it: COSMIC, KDE Plasma, Hyprland, Sway
+  and other wlroots compositors. GNOME has no layer-shell, so there the island
+  is a regular window. `COUCOU_LAYER_SHELL=0` forces that mode anywhere.
+- **Click-through** is the window's input region, kept equal to the island
+  shape, so the compositor sends every other click to what is underneath.
+- **Mochi's eyes** follow the pointer only while it is over the island: Wayland
+  gives no app the cursor position anywhere else.
+- **Claude Code hooks** go through `~/.local/share/coucou/bin/coucou-hook` and a
+  Unix socket at `$XDG_RUNTIME_DIR/coucou.sock`. Both ends check that the other
+  runs as the same user.
+- **Keys** live in the Secret Service (GNOME Keyring, KWallet).
+- **Files**: preferences in `~/.config/coucou/`, the log at
+  `~/.local/share/coucou/coucou.log`.
+- What the Windows build leaves out, this one does too: sending a file by
+  email, dragging Mochi onto a window, and jumping to a specific terminal
+  window — "Open terminal" opens the folder in VS Code.
```

**File**: `windows/scripts/pack.mjs` (modified, +64/-26)
```diff
@@ -1,41 +1,79 @@
-// Copies the installer Tauri buries in target/release/bundle/nsis/ into
-// windows/release/, with the name it ships under. Used by `npm run pack` and by
-// the release workflow, so both produce exactly the same file names.
+// Copies the packages Tauri buries in target/release/bundle/ into
+// windows/release/, with the names they ship under. Used by `npm run pack` and
+// by the release workflows, so both produce exactly the same file names.
 
 import { readFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
 import { dirname, join, resolve } from "node:path";
 import { fileURLToPath } from "node:url";
 
 const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
-const bundleDir = join(root, "target", "release", "bundle", "nsis");
+const bundleRoot = join(root, "target", "release", "bundle");
 const outDir = join(root, "release");
 
 const { version } = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
 
-let installers = [];
-try {
-  installers = readdirSync(bundleDir).filter((f) => f.endsWith("-setup.exe"));
-} catch {
-  console.error(`No installer in ${bundleDir} — run \`npm run tauri build\` first.`);
-  process.exit(1);
-}
-if (installers.length === 0) {
-  console.error(`No installer in ${bundleDir} — run \`npm run tauri build\` first.`);
+// What each platform ships: where Tauri puts it, how to recognise it, and the
+// names it is published under (the rolling name, when there is one, always
+// points at the latest release).
+const arch = process.arch === "arm64" ? "aarch64" : "x86_64";
+const debArch = process.arch === "arm64" ? "arm64" : "amd64";
+const PACKAGES = {
+  win32: [
+    {
+      dir: "nsis",
+      suffix: "-setup.exe",
+      names: [`Coucou-Windows-${version}-setup.exe`, "Coucou-Windows-setup.exe"],
+    },
+  ],
+  linux: [
+    {
+      dir: "appimage",
+      suffix: ".AppImage",
+      names: [`Coucou-Linux-${version}-${arch}.AppImage`, `Coucou-Linux-${arch}.AppImage`],
+    },
+    { dir: "deb", suffix: ".deb", names: [`Coucou-Linux-${version}-${debArch}.deb`] },
+    { dir: "rpm", suffix: ".rpm", names: [`Coucou-Linux-${version}-${arch}.rpm`] },
+  ],
+};
+
+const packages = PACKAGES[process.platform];
+if (!packages) {
+  console.error(`Nothing to pack on ${process.platform}.`);
   process.exit(1);
 }
 
-// Newest wins, in case an older build is still lying around.
-const built = installers
-  .map((f) => join(bundleDir, f))
-  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
+/** The newest file in `dir` ending with `suffix`, in case an older build is still lying around. */
+function newest(dir, suffix) {
+  let files = [];
+  try {
+    files = readdirSync(dir).filter((f) => f.endsWith(suffix));
+  } catch {
+    return null;
+  }
+  if (files.length === 0) return null;
+  return files
+    .map((f) => join(dir, f))
+    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
+}
 
 mkdirSync(outDir, { recursive: true });
-const versioned = join(outDir, `Coucou-Windows-${version}-setup.exe`);
-const rolling = join(outDir, "Coucou-Windows-setup.exe");
-copyFileSync(built, versioned);
-copyFileSync(built, rolling);
-
-const mb = (statSync(versioned).size / 1024 / 1024).toFixed(2);
-console.log(`\n  Installer ready — ${mb} MB\n`);
-console.log(`  ${versioned}`);
-console.log(`  ${rolling}\n`);
+const written = [];
+for (const { dir, suffix, names } of packages) {
+  const built = newest(join(bundleRoot, dir), suffix);
+  if (!built) {
+    console.error(`No *${suffix} in ${join(bundleRoot, dir)} — run \`npm run tauri build\` first.`);
+    process.exit(1);
+  }
+  for (const name of names) {
+    const dest = join(outDir, name);
+    copyFileSync(built, dest);
+    written.push(dest);
+  }
+}
+
+console.log("\n  Packages ready\n");
+for (const f of written) {
+  const mb = (statSync(f).size / 1024 / 1024).toFixed(2);
+  console.log(`  ${f}  (${mb} MB)`);
+}
+console.log();
```

**File**: `windows/src-tauri/tauri.linux.conf.json` (modified, +20/-0)
```diff
@@ -1,9 +1,29 @@
 {
   "$schema": "https://schema.tauri.app/config/2",
   "bundle": {
+    "targets": [
+      "appimage",
+      "deb",
+      "rpm"
+    ],
     "resources": {
       "../target/release/coucou-hook.exe": null,
       "../target/release/coucou-hook": "coucou-hook"
+    },
+    "linux": {
+      "appimage": {
+        "bundleMediaFramework": true
+      },
+      "deb": {
+        "depends": [
+          "libgtk-layer-shell0"
+        ]
+      },
+      "rpm": {
+        "depends": [
+          "gtk-layer-shell"
+        ]
+      }
     }
   },
   "app": {
```

#### Recent Merged Pull Requests:
- **PR #259** (2026-10-06): docs: TestFlight beta button and Apple-review notice (@Louis-CFM)
- **PR #258** (2026-10-06): docs: TestFlight link for Coucou on iPhone (@Louis-CFM)
- **PR #257** (2026-10-06): Get Coucou on your iPhone: guide, README, website page and FAQ (@Louis-CFM)
- **PR #255** (2026-10-05): README and site: iPhone screenshots (@Louis-CFM)
- **PR #254** (2026-10-05): README and site: Coucou on iPhone, App Store, complete 0.1.8 notes (@Louis-CFM)
- **PR #251** (2026-10-06): iPhone: Liquid Glass, tabs, zoom, gestures, icons, Spotlight, Focus (@Louis-CFM)
- **PR #241** (2026-10-05): iPhone: act from notifications, answer questions, Siri, Control Center + new coucou sound (@Louis-CFM)
- **PR #237** (closed): Open terminal: bring back the app the session runs in (@mamaral-onbench)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
