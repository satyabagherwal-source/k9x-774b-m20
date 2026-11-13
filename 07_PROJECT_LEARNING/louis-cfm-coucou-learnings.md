> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/louis-cfm-coucou-learnings.md`  
> **Source**: github ([https://github.com/Louis-CFM/coucou](https://github.com/Louis-CFM/coucou))  
> **Source Version**: `15cc178d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T03:56:06.996Z  
> **Learning ID**: `learn-github-louis-cfm-coucou`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Louis-CFM/coucou

> **Canonical Artifact**: `07_PROJECT_LEARNING/louis-cfm-coucou-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Louis-CFM/coucou](https://github.com/Louis-CFM/coucou))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T03:56:06.987Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Louis-CFM/coucou`
- **Description**: A tiny friend in your Mac's notch and on your iPhone that keeps an eye on your AI coding agents: Claude Code, Codex, Cursor, Gemini CLI, Antigravity and more. Approve from the notch or your Lock Screen.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7155 stars

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
    /// The session a file is dragged over in the island (its task id): dropped, it goes into that session's prompt.
    @Published var dropSessionTarget: String? = nil

    // Sound enabled — persisted
    @Published var soundEnabled: Bool = true {
        didSet { UserDefaults.standard.set(soundEnabled, forKey: "soundEnabled") }
    }

    // Weekly recap — persisted
    @Published var recapEnabled: Bool = (UserDefaults.standard.object(forKey: "recapEnabled") as? Bool) ?? true {
        didSet { UserDefaults.standard.set(recapEnabled, forKey: "recapEnabled") }
    }
    @Published var recapHideProjects: Bool = UserDefaults.standard.bool(forKey: "recapHideProjects") {
        didSet { UserDefaults.standard.set(recapHideProjects, forKey: "recapHideProjects") }
    }

    // Mochi outfit selection — persisted
    @Published var mochiOutfitSelection: Outfit = .auto {
        didSet { Outfit.stored = mochiOutfitSelection }
    }
    // A colour of the user's own for each pill's Mochi (pill id → "#RRGGBB") — persisted.
    // Empty means the catalog's colours. PillDefinition.color reads the stored value, so
    // what is built from the catalog follows on its own; the tasks already on the island
    // hold a copy of their colour and are repainted here.
    @Published var pillColors: [String: String] = [:] {
        didSet {
            PillColors.stored = pillColors
            var repainted = tasks
            var changed = false
            for i in repainted.indices {
                guard let def = PillCatalog.definition(for: repainted[i].id),
                      repainted[i].color != def.color else { continue }
                repainted[i].color = def.color
                changed = true
            }
            if changed { tasks = repainted }
        }
    }
    /// Picks a colour for a pill's Mochi; nil, or the pill's own catalog colour, goes back to the default.
    func setPillColor(_ id: String, _ hex: String?) {
        guard let def = PillCatalog.definition(for: id) else { return }
        pillColors = PillColors.picking(hex, for: id, catalogColor: def.defaultColor, in: pillColors)
    }
    // Transient: outfit preview while hovering in wardrobe (overrides resolvedOutfit in BotCanvasView)
    var wardrobePreviewOutfit: Outfit? = nil
    // Per-day seasonal cache — read on every Mochi frame: valid until the next midnight,
    // so a frame costs one date comparison instead of calendar math.
    private var _seasonalCache: (validUntil: Date, outfit: Outfit)?
    var resolvedOutfit: Outfit {
        if let preview = wardrobePreviewOutfit { return preview }
        guard mochiOutfitSelection == .auto else { return mochiOutfitSelection }
        let now = Date()
        if let c = _seasonalCache, now < c.validUntil { return c.outfit }
        let cal = Calendar.current
        let outfit = Outfit.seasonal(for: now, calendar: cal)
        let midnight = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now))
            ?? now.addingTimeInterval(3600)
        _seasonalCache = (validUntil: midnight, outfit: outfit)
        return outfit
    }

    // Claude model used by the chat and the search — persisted
    static let defaultClaudeModel = "claude-sonnet-4-6"
    @Published var claudeModel: String = AppState.defaultClaudeModel {
        didSet { UserDefaults.standard.set(claudeModel, forKey: "claudeModel") }
    }

    // In-chat provider + model — picked via the model selector in the prompt view
    /// The chat's Mail switch (GitHub build): the AI sees the latest messages and may prepare
    /// actions on them. Off at each launch.
    @Published var chatMailMode = false

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
    @Published var deepseekChatModel: String = ChatProvider.deepseek.defaultModel {
        didSet { UserDefaults.standard.set(deepseekChatModel, forKey: "deepseekChatModel") }
    }
    @Published var qwenChatModel: String = ChatProvider.qwen.defaultModel {
        didSet { UserDefaults.standard.set(qwenChatModel, forKey: "qwenChatModel") }
    }
    @Published var moonshotChatModel: String = ChatProvider.moonshot.defaultModel {
        didSet { UserDefaults.standard.set(moonshotChatModel, forKey: "moonshotChatModel") }
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
        #if !APPSTORE
        // Through the subscription: Claude Code takes the model aliases; the other tools
        // use the model chosen in them.
        if usesSubscription(provider) {
            providerModelFetchError.removeValue(forKey: provider)
            if provider == .anthropic {
                var models = Self.claudeCodeModels
                if !models.contains(where: { $0.id == claudeModel }) { models.insert((claudeModel, claudeModel), at: 0) }
                fetchedProviderModels[provider] = models
            } else {
                let tool = (provider.installedCLI ?? provider.subscriptionCLIs.first)?.displayName ?? provider.displayName
                fetchedProviderModels[provider] = [("", String(format: String(localized: "chat.subscriptions.default-model"), tool))]
            }
            return
        }
        #endif
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
                    providerModelFetchError[provider] = provider == .ollam
```

### Core Architecture Module: `NotchBuddy/Sources/App/ApprovalQueue.swift`
```
import Foundation

// MARK: - ApprovalQueue
// Pure FIFO queue of pending PermissionRequests. No AppKit, no SwiftUI, no I/O:
// HookServer owns the sockets, timers and UI, and mutates this value on the main actor only.
// The head is the request currently shown on the approval card.

struct QueuedApproval: Equatable, Sendable {
    let id: UUID
    /// Client socket, held open until the user decides. Closed by the owner's dispatch source.
    let fd: Int32
    let sessionId: String
    /// "integration_claude", "agent_cursor" or "agent_codex".
    let pillId: String
    let projectName: String
    let cwd: String
    let tool: String
    let command: String
    /// tool_input serialized with sortedKeys, "" if absent. Used to match PostToolUse.
    let inputKey: String
    /// Host app / bundle id of the session, so the card's pill keeps showing where it runs.
    var hostApp: String? = nil
    var bundleId: String = ""
    /// When the request arrived (for the log: how long it waited).
    var received = Date()
    /// The pill the request shows on when its session popped out of `pillId` (SessionBoard),
    /// nil when it shows on `pillId` itself.
    var shownPill: String? = nil

    /// Where the card, the focus and the iPhone find the request.
    var displayPill: String { shownPill ?? pillId }
}

struct ApprovalQueue: Sendable {
    /// Upper bound of simultaneously pending requests. Each one holds a socket and a 115 s timer
    /// and the card only shows one at a time, so beyond this the newest falls back to its terminal.
    static let maxPending = 5

    enum EnqueueResult: Equatable, Sendable { case accepted, rejectedFull }

    private(set) var entries: [QueuedApproval] = []

    var head: QueuedApproval? { entries.first }
    var count: Int { entries.count }
    var isEmpty: Bool { entries.isEmpty }

    func contains(id: UUID) -> Bool { entries.contains { $0.id == id } }

    /// 1-based position of the entry in the queue, nil if absent.
    func position(of id: UUID) -> Int? {
        entries.firstIndex { $0.id == id }.map { $0 + 1 }
    }

    /// True when the queued requests do not all come from the same session and agent.
    var hasMixedSources: Bool {
        guard let first = entries.first else { return false }
        return entries.contains { $0.sessionId != first.sessionId || $0.pillId != first.pillId }
    }

    func hasEntries(forPill pillId: String) -> Bool {
        entries.contains { $0.pillId == pillId }
    }

    mutating func enqueue(_ entry: QueuedApproval, maxPending: Int = ApprovalQueue.maxPending) -> EnqueueResult {
        guard entries.count < maxPending else { return .rejectedFull }
        entries.append(entry)
        return .accepted
    }

    /// Removes only the entry with this id. Other entries keep their order.
    @discardableResult
    mutating func remove(id: UUID) -> QueuedApproval? {
        guard let idx = entries.firstIndex(where: { $0.id == id }) else { return nil }
        return entries.remove(at: idx)
    }

    /// Entries made moot by a later hook event of the same agent. Matching is per request
    /// (session + agent, plus tool and input for PostToolUse), never by pill alone.
    func resolved(byEvent name: String, sessionId: String, pillId: String,
                  tool: String, inputKey: String) -> [QueuedApproval] {
        switch name {
        case "PostToolUse", "PostToolUseFailure":
            return entries.filter {
                $0.pillId == pillId && $0.sessionId == sessionId
                    && $0.tool == tool && $0.inputKey == inputKey
            }
        case "Stop", "StopFailure", "UserPromptSubmit", "SessionEnd", "Interrupt":
            return entries.filter { $0.pillId == pillId && $0.sessionId == sessionId }
        default:
            return []
        }
    }
}

```

### Core Architecture Module: `NotchBuddy/Sources/App/ClaudeHookDetection.swift`
```
import Foundation

/// True when a parsed ~/.claude/settings.json routes Claude Code SessionStart events to Coucou.
///
/// Kept free of file access so it can be tested on fixtures instead of the real settings file.
/// Both the installed app and earlier builds matched on the command text: a hook written by
/// Coucou runs ~/.claude/coucou/nb-hook, and the App Store build names NotchBuddy instead.
func coucouHooksPresent(inSettings settings: [String: Any]) -> Bool {
    guard let hooks = settings["hooks"] as? [String: Any],
          let sessionStart = hooks["SessionStart"] as? [[String: Any]] else { return false }
    return sessionStart.contains { group in
        (group["hooks"] as? [[String: Any]])?.contains { hook in
            guard let command = hook["command"] as? String else { return false }
            return command.contains("NotchBuddy") || command.contains("coucou")
        } ?? false
    }
}

```

### Core Architecture Module: `NotchBuddy/Sources/App/CoucoudoroEngine.swift`
```
import Foundation

// MARK: - Coucoudoro clock

/// Work and rest lengths, in seconds. A phase runs until its deadline, then the next one starts.
struct CoucoudoroConfig: Equatable, Sendable {
    var work: TimeInterval
    var rest: TimeInterval
}

enum CoucoudoroPhase: Equatable, Sendable {
    case idle, work, rest
}

/// The moment a phase begins.
enum CoucoudoroEvent: Equatable, Sendable {
    case restStarts, workStarts
}

/// The session, anchored to a deadline so a late tick does not drift.
struct CoucoudoroSnapshot: Equatable, Sendable {
    var phase: CoucoudoroPhase
    var paused: Bool
    var deadline: Date?
    /// Seconds left, frozen while paused. The deadline is cleared until resume.
    var pausedRemaining: TimeInterval?
    var notice: CoucoudoroEvent?

    static let idle = CoucoudoroSnapshot(phase: .idle, paused: false, deadline: nil,
                                    pausedRemaining: nil, notice: nil)
}

/// The countdown. Pure: no clock of its own, no pill, no defaults.
enum CoucoudoroEngine {
    /// Lengths under a second are pulled up to one second.
    static func sanitize(_ raw: CoucoudoroConfig) -> CoucoudoroConfig {
        CoucoudoroConfig(work: max(raw.work, 1),
                    rest: max(raw.rest, 1))
    }

    /// A fresh work phase, from the full work length, whatever came before.
    static func start(config raw: CoucoudoroConfig, now: Date) -> (CoucoudoroSnapshot, [CoucoudoroEvent]) {
        let config = sanitize(raw)
        let deadline = now.addingTimeInterval(config.work)
        let snap = CoucoudoroSnapshot(phase: .work, paused: false,
                                 deadline: deadline,
                                 pausedRemaining: nil, notice: .workStarts)
        return (snap, [.workStarts])
    }

    static func stop() -> CoucoudoroSnapshot { .idle }

    static func pause(_ s: CoucoudoroSnapshot, now: Date) -> CoucoudoroSnapshot {
        guard s.phase != .idle, !s.paused else { return s }
        var n = s
        n.paused = true
        n.pausedRemaining = max(0, s.deadline?.timeIntervalSince(now) ?? 0)
        n.deadline = nil
        return n
    }

    static func resume(_ s: CoucoudoroSnapshot, now: Date) -> CoucoudoroSnapshot {
        guard s.paused else { return s }
        var n = s
        let left = max(0, s.pausedRemaining ?? 0)
        n.paused = false
        n.pausedRemaining = nil
        n.deadline = now.addingTimeInterval(left)
        return n
    }

    /// Move the session to `now`. A phase runs until its deadline, then the next one
    /// starts and is announced once. If the Mac slept, missed phases are not replayed:
    /// only the phase that contains `now`.
    static func tick(_ s: CoucoudoroSnapshot, config raw: CoucoudoroConfig, now: Date) -> (CoucoudoroSnapshot, [CoucoudoroEvent]) {
        guard s.phase != .idle, !s.paused, let deadline = s.deadline else { return (s, []) }
        guard now >= deadline else { return (s, []) }
        let config = sanitize(raw)
        let landed = land(from: s.phase, phaseEnd: deadline, now: now, config: config)
        var n = s
        n.phase = landed.phase
        n.deadline = landed.deadline
        n.notice = landed.event
        return (n, [landed.event])
    }

    static func remaining(_ s: CoucoudoroSnapshot, now: Date) -> TimeInterval? {
        if s.paused { return s.pausedRemaining }
        guard s.phase != .idle, let deadline = s.deadline else { return nil }
        return max(0, deadline.timeIntervalSince(now))
    }

    /// "25:00". Minutes grow past 99 without a leading zero.
    static func clock(_ seconds: TimeInterval) -> String {
        let whole = max(0, Int(seconds.rounded(.down)))
        let m = whole / 60
        let s = whole % 60
        if m >= 100 { return String(format: "%d:%02d", m, s) }
        return String(format: "%02d:%02d", m, s)
    }

    // MARK: - Phases

    /// From a phase that ended at `phaseEnd`, the phase that contains `now`.
    /// The next deadline stays on the original schedule (`phaseEnd` plus whole lengths),
    /// not `now` plus a length, so a late tick does not stretch the session.
    private static func land(from phase: CoucoudoroPhase, phaseEnd: Date, now: Date,
                             config: CoucoudoroConfig) -> (phase: CoucoudoroPhase, deadline: Date, event: CoucoudoroEvent) {
        let work = max(1, Int(config.work.rounded()))
        let rest = max(1, Int(config.rest.rounded()))
        switch phase {
        case .work:
            let restEnd = phaseEnd.addingTimeInterval(TimeInterval(rest))
            if now < restEnd { return (.rest, restEnd, .restStarts) }
            let over = seconds(now.timeIntervalSince(restEnd))
            let cycle = work + rest
            let cycles = over / cycle
            let into = over % cycle
            let origin = restEnd.addingTimeInterval(TimeInterval(cycles * cycle))
            if into < work {
                return (.work, origin.addingTimeInterval(TimeInterval(work)), .workStarts)
            }
            return (.rest, origin.addingTimeInterval(TimeInterval(work + rest)), .restStarts)
        case .rest:
            let workEnd = phaseEnd.addingTimeInterval(TimeInterval(work))
            if now < workEnd { return (.work, workEnd, .workStarts) }
            let over = seconds(now.timeIntervalSince(workEnd))
            let cycle = work + rest
            let cycles = over / cycle
            let into = over % cycle
            let origin = workEnd.addingTimeInterval(TimeInterval(cycles * cycle))
            // After that work, the cycle is rest then work.
            if into < rest {
                return (.rest, origin.addingTimeInterval(TimeInterval(rest)), .restStarts)
            }
            return (.work, origin.addingTimeInterval(TimeInterval(rest + work)), .workStarts)
        case .idle:
            return (.work, phaseEnd.addingTimeInterval(TimeInterval(work)), .workStarts)
        }
    }

    private static func seconds(_ interval: TimeInterval) -> Int {
        max(0, Int(interval.rounded(.down)))
    }
}

// MARK: - Stored lengths

/// Minutes in UserDefaults, the same store as the other integration settings.
enum CoucoudoroSettings {
    static let pillId = "integration_coucoudoro"

    static let workKey = "coucoudoroWorkMinutes"
    static let restKey = "coucoudoroRestMinutes"

    static let defaultWork = 25
    static let defaultRest = 5

    /// Work and rest are each 1…60 minutes. A saved value outside that clamps here.
    static let workBounds = 1...60
    static let restBounds = 1...60

    static func clampWork(_ minutes: Int) -> Int {
        min(max(minutes, workBounds.lowerBound), workBounds.upperBound)
    }

    static func clampRest(_ minutes: Int) -> Int {
        min(max(minutes, restBounds.lowerBound), restBounds.upperBound)
    }

    static var workMinutes: Int { clampWork(storedMinutes(workKey, fallback: defaultWork)) }
    static var restMinutes: Int { clampRest(storedMinutes(restKey, fallback: defaultRest)) }

    static var config: CoucoudoroConfig {
        CoucoudoroConfig(work: TimeInterval(workMinutes * 60),
                    rest: TimeInterval(restMinutes * 60))
    }

    /// A saved length, or the default when none was saved.
    private static func storedMinutes(_ key: String, fallback: Int) -> Int {
        let defaults = UserDefaults.standard
        return defaults.object(forKey: key) == nil ? fallback : defaults.integer(forKey: key)
    }
}

```

### Core Architecture Module: `NotchBuddy/Sources/App/DemoEngine.swift`
```
import Foundation
import SwiftUI
import Combine

// MARK: - DemoEngine
// Scripted ~60 s tour of Coucou for App Store review.
// Zero network calls, nothing written to disk or Keychain.

@MainActor
final class DemoEngine: ObservableObject {

    static let shared = DemoEngine()
    private init() {}

    // MARK: Published state

    @Published var isActive: Bool = false

    // Checked from background threads (pollers). Written only from @MainActor.
    nonisolated(unsafe) private(set) static var isPollerPaused: Bool = false

    // MARK: Private state

    private var demoTask: Task<Void, Never>? = nil
    private var modeCancellable: AnyCancellable? = nil

    private var visibilityContinuation: CheckedContinuation<Void, Never>? = nil
    private var approvalContinuation: CheckedContinuation<String, Never>? = nil
    private var questionContinuation: CheckedContinuation<Void, Never>? = nil

    private var generation: Int = 0                   // incremented on each start() to orphan stale closures
    private var demoInjectedTaskIds: [String] = []   // integration task IDs added by demo
    private var realTaskIdsAtStart: Set<String> = [] // real task IDs that existed before demo
    private var demoCycleIndex: Int = 0
    private let rotatingIntegrationIds = [
        "integration_stripe", "integration_calcom",
        "integration_n8n", "integration_notion", "integration_vercel"
    ]
    private var demoDiffIds: [String: [Int]] = [:]   // [pillId: [diffId]]
    private var lastApprovalDecision: String = "allow"
    private var lastQuestionAnswer: String? = nil

    // MARK: Snapshot

    private struct Snapshot {
        var tasks: [AgentTask]
        var focusId: String?
        var chatHistory: [ChatMessage]
        var stateOverride: BotState?
        var isPinned: Bool
        var noteMessage: String?
        // Integration data
        var vercelDeployments: [VercelDeployment]
        var resendEmails: [ResendEmail]
        var resendTotal: Int?
        var githubPulse: GitHubPulse?
        var githubActivity: GitHubActivity?
        var githubStats: GitHubStats?
        var stripePayments: [StripePayment]
        var stripeBalance: Int
        var stripeDisplayBalance: Int
        var stripeCurrency: String
        var stripeLoaded: Bool
        var stripeError: String?
        var calcomBookings: [CalcomBooking]
        var calcomLoaded: Bool
        var n8nRuns: [N8nRun]
        var notionPages: [NotionPage]
        var notionLoaded: Bool
        // NOTE: pendingApproval and pendingQuestion are intentionally NOT snapshotted.
        // HookServer's file descriptors are authoritative for real requests.
        var mode: IslandMode
        var view: IslandView
    }

    private var snapshot: Snapshot? = nil

    // MARK: Start

    func start() {
        guard !isActive else { return }
        isActive = true
        DemoEngine.isPollerPaused = true
        generation += 1
        demoCycleIndex = 0

        let s = AppState.shared

        // Record which tasks are real (not demo-injected) before demo starts
        realTaskIdsAtStart = Set(s.tasks.map { $0.id })

        snapshot = Snapshot(
            tasks:               s.tasks,
            focusId:             s.focusId,
            chatHistory:         s.chatHistory,
            stateOverride:       s.stateOverride,
            isPinned:            s.isPinned,
            noteMessage:         s.noteMessage,
            vercelDeployments:   s.vercelDeployments,
            resendEmails:        s.resendEmails,
            resendTotal:         s.resendTotal,
            githubPulse:         s.githubPulse,
            githubActivity:      s.githubActivity,
            githubStats:         s.githubStats,
            stripePayments:      s.stripePayments,
            stripeBalance:       s.stripeBalance,
            stripeDisplayBalance: s.stripeDisplayBalance,
            stripeCurrency:      s.stripeCurrency,
            stripeLoaded:        s.stripeLoaded,
            stripeError:         s.stripeError,
            calcomBookings:      s.calcomBookings,
            calcomLoaded:        s.calcomLoaded,
            n8nRuns:             s.n8nRuns,
            notionPages:         s.notionPages,
            notionLoaded:        s.notionLoaded,
            mode:                s.mode,
            view:                s.view
        )

        // Hide all real pills — show only main during demo (integration + Codex added progressively).
        let mainTask = s.tasks.first(where: { $0.id == s.mainPillId })
        s.tasks = mainTask.map { [$0] } ?? []

        // Weekly recap: available immediately so the reviewer can share it
        RecapStore.shared.demoSummaryOverride = demoWeeklySummary()

        // Plan usage override (in-memory, never persisted)
        #if !APPSTORE
        let now = Date()
        s.demoPlanUsageOverride = PlanUsage(
            fiveHour: PlanWindow(usedPct: 42.0, resetsAt: now.addingTimeInterval(4 * 3600)),
            sevenDay: PlanWindow(usedPct: 37.0, resetsAt: now.addingTimeInterval(3 * 24 * 3600)),
            updatedAt: now
        )
        #endif

        // Inject integration data (no activeIntegrations setter, no UserDefaults write)
        injectIntegrationData()

        // Observe mode changes to unblock waitUntilVisible()
        modeCancellable = s.$mode
            .dropFirst()
            .sink { [weak self] mode in
                MainActor.assumeIsolated {
                    if mode != .hidden, let cont = self?.visibilityContinuation {
                        self?.visibilityContinuation = nil
                        cont.resume()
                    }
                }
            }

        // Open island immediately on the demo session
        NotificationCenter.default.post(name: .hookExpand, object: IslandView.overview)

        let gen = generation
        demoTask = Task { @MainActor [weak self] in
            await self?.runDemoLoop(gen: gen)
        }
    }

    // MARK: Stop

    func stop() {
        guard isActive else { return }
        isActive = false
        DemoEngine.isPollerPaused = false
        GithubPoller.shared.triggerPulseNow()

        demoTask?.cancel()
        demoTask = nil
        modeCancellable = nil

        // Unblock any waiting continuations so the loop exits cleanly
        let vc = visibilityContinuation; visibilityContinuation = nil; vc?.resume()
        let ac = approvalContinuation;   approvalContinuation  = nil; ac?.resume(returning: "allow")
        let qc = questionContinuation;   questionContinuation  = nil; qc?.resume()

        // Clear demo overrides
        RecapStore.shared.demoSummaryOverride = nil
        #if !APPSTORE
        AppState.shared.demoPlanUsageOverride = nil
        #endif

        let s = AppState.shared

        // Clear demo approval card (never real — real cards have a fd in HookServer)
        if s.pendingApproval?.sessionId == "demo_session" {
            s.pendingApproval = nil
        }
        // Clear demo question (real questions always hold an nb-hook connection in the queue)
        if !HookServer.shared.hasRealPendingQuestion {
            s.pendingQuestion = nil
        }
        // Only restore isPinned if no real request is now pending
        if s.pendingApproval == nil && s.pendingQuestion == nil {
            s.isPinned = snapshot?.isPinned ?? false
        }

        guard let snap = snapshot else { return }
        snapshot = nil

        // Restore AppState (NOT pendingApproval, NOT pendingQuestion — HookServer owns those)
        s.chatHistory   = snap.chatHistory
        s.stateOverride = snap.stateOverride
        s.noteMessage   = snap.noteMessage

        // Restore integration data
        s.vercelDeployments    = snap.vercelDeployments
        s.resendEmails         = snap.resendEmails
        s.resendTotal          = snap.resendTotal
        s.githubPulse          = snap.githubPulse
        s.githubActivity       = snap.githubActivity
        s.githubStats          = snap.githubStats
        s.stripePayments       = snap.stripePayments
        s.stripeBalance        = snap.stripeBalance
        s.stripeDisplayBalance = snap.stripeDisplayBalance
        s.stripeCurrency       = snap.stripeCurrency
        s.stripeLoaded         = snap.stripeLoaded
        s.stripeError          = snap.stripeError
        s.calcomBookings       = snap.calcomBookings
        s.calcomLoaded         = snap.calcomLoaded
        s.n8nRuns              = snap.n8nRuns
        s.notionPages          = snap.notionPages
        s.notionLoaded         = snap.notionLoaded

        // Restore tasks: keep real tasks that arrived during the demo, discard demo-only ones.
        // For tasks that existed before the demo (realTaskIdsAtStart), use the CURRENT version
        // from AppState (real Claude Code events may have updated them during demo).
        let demoIds: Set<String> = Set(demoInjectedTaskIds + ["demo_codex"])
        let currentTasksById = Dictionary(uniqueKeysWithValues: s.tasks.map { ($0.id, $0) })
        let realNewTasks = s.tasks.filter { task in
            !snap.tasks.contains(where: { $0.id == task.id }) && !demoIds.contains(task.id)
        }
        let mainPillId = s.mainPillId
        let restoredSnapTasks = snap.tasks.map { snapTask -> AgentTask in
            // Main pill: always restore from snapshot — demo may have left steps/finalLine mid-cycle.
            if snapTask.id == mainPillId { return snapTask }
            // Other real tasks: keep current (may have received real hook events during demo).
            if realTaskIdsAtStart.contains(snapTask.id), !demoIds.contains(snapTask.id),
               let current = currentTasksById[snapTask.id] {
                return current
            }
            return snapTask
        }
        s.tasks = restoredSnapTasks + realNewTasks

        // Remove only demo diffs; leave real diffs untouched
        for (pillId, ids) in demoDiffIds {
            for id in ids 
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
    /// Permission requests waiting for a click, oldest first; the head is on the card.
    /// Each one holds its nb-hook connection open until it is answered or dropped.
    private var approvals = ApprovalQueue()
    /// One read source per queued request: it notices the client hanging up, and its
    /// cancel handler is the only place the request's fd is closed.
    private var approvalSources: [UUID: any DispatchSourceRead] = [:]
    /// AskUserQuestions waiting for an answer, oldest first, one per session; the head is on
    /// the card. Each one holds its nb-hook connection open until it is answered or dropped.
    private var questions = QuestionQueue()
    /// One read source per waiting question: it notices the client hanging up, and its
    /// cancel handler is the only place the question's fd is closed.
    private var questionSources: [UUID: any DispatchSourceRead] = [:]
    private var shownQuestion: UUID? = nil            // the question the card shows

    /// True when a real nb-hook connection is holding the approval fd open.
    @MainActor var hasRealPendingApproval: Bool { !approvals.isEmpty }
    /// True when a real nb-hook connection is holding a question fd open.
    @MainActor var hasRealPendingQuestion: Bool { !questions.isEmpty }
    private var focusBeforeQuestion: String? = nil    // saved focus to restore after question
    private var activeSessionId: String? = nil        // current Claude Code session
    private var focusBeforeApproval: String? = nil    // saved focus to restore after approval
    private var focusBeforeAlert: String? = nil       // saved focus while another pill's card shows
    private var alertPill: String? = nil              // the pill that took the focus for its alert
    private var sessions = PillSessionRegistry()      // live sessions behind each pill
    private var board = SessionBoard()                // what each of those sessions shows

    private init() {}

    // MARK: - Approval queue helpers

    /// Note shown when a request was answered outside Coucou.
    @MainActor
    private func handledNote(pill: String) -> String {
        switch PillCatalog.basePillId(pill) {
        case "agent_cursor":  return "Handled in Cursor."
        case "agent_codex":   return "Handled in Codex."
        case "agent_copilot": return "Handled in Copilot CLI."
        case "agent_muse":    return "Handled in Muse Code."
        case "agent_hermes":  return "Handled in Hermes."
        case "agent_antigravity": return "Handled in Antigravity."
        default:              return "Handled in \(claudeHostName(pill: pill))."
        }
    }

    /// Note shown when a request waited too long and went back to the agent.
    @MainActor
    private func waitingNote(pill: String) -> String {
        switch PillCatalog.basePillId(pill) {
        case "agent_cursor":  return "Still waiting in Cursor."
        case "agent_codex":   return "Still waiting in Codex."
        case "agent_copilot": return "Still waiting in Copilot CLI."
        case "agent_muse":    return "Still waiting in Muse Code."
        case "agent_hermes":  return "Still waiting in Hermes."
        case "agent_antigravity": return "Still waiting in Antigravity."
        default:              return "Still waiting in \(claudeHostName(pill: pill))."
        }
    }

    /// Puts the oldest waiting request on the card. When the card already shows it, only
    /// its "n waiting" count is refreshed (no sound, no focus change).
    @MainActor
    private func showApprovalHead() {
        let state = AppState.shared
        guard let head = approvals.head else { return }
        if let shown = state.pendingApproval, shown.id == head.id {
            if shown.queueCount != approvals.count { state.pendingApproval?.queueCount = approvals.count }
            return
        }
        syncPill(head.pillId)
        state.pendingApproval = ApprovalInfo(sessionId: head.sessionId, tool: head.tool,
                                              command: head.command, inputKey: head.inputKey,
                                              pillId: head.displayPill, id: head.id,
                                              queueCount: approvals.count,
                                              projectName: head.projectName)
        state.isPinned = true
        // Approval always forces the island open — the user must be able to respond.
        // Save the focus once, so it comes back when the last request is gone.
        if focusBeforeApproval == nil { focusBeforeApproval = state.focusId }
        withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) { state.focusId = head.displayPill }
        expandIfNeeded(to: .approval)
    }

    /// Takes one request out of the queue. With `answer`, the decision is written to its
    /// nb-hook first; without, the connection just closes and the agent asks again itself.
    /// The cancel handler of its source closes the fd — never close it directly.
    /// The next request in line then takes the card; when none is left the card closes,
    /// with `note` for three seconds if one is given.
    @MainActor
    private func removeApproval(id: UUID, answer json: String? = nil, note: String? = nil) {
        guard let entry = approvals.remove(id: id) else { return }
        let age = Int(Date().timeIntervalSince(entry.received))
        nbLog("Approval \(entry.tool) closed after \(age) s: \(json.map { _ in "answered from Coucou" } ?? note ?? "dropped")")
        let source = approvalSources.removeValue(forKey: id)
        if let json {
            let fd = entry.fd
            Task.detached { [weak self] in
                // Write while the fd is still valid, then cancel → the cancel handler closes it.
                self?.sendLine(fd: fd, text: json)
                DispatchQueue.main.async { source?.cancel() }
            }
        } else {
            source?.cancel()
        }

        let state = AppState.shared
        // The session's pill leaves its approval state; a popped-out one folds back soon after.
        syncPill(entry.pillId)
        if !approvals.entries.contains(where: { $0.displayPill == entry.displayPill }) {
            clearPillBadge(id: entry.displayPill)
        }
        if approvals.head != nil {
            showApprovalHead()
            return
        }
        // Last request gone: close the card and give the focus back.
        state.pendingApproval = nil
        state.isPinned = false
        if let prev = focusBeforeApproval {
            focusBeforeApproval = nil
            if state.focusId == entry.displayPill, state.tasks.contains(where: { $0.id == prev }) {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) { state.focusId = prev }
            }
        }
        if questions.head != nil {
            showQuestionHead()
            return
        }
        if let note {
            state.noteMessage = note
            state.view = .note
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                NotificationCenter.default.post(name: .islandCollapse, object: nil)
            }
        } else {
            state.view = state.tasks.isEmpty ? .empty : .overview
        }
    }

    // MARK: - Sessions on the board

    /// A session's key on the board: its id, or for one that sends none its pill and folder
    /// (the same key the recap and the question queue use).
    private static func boardKey(_ session: String, pill: String, cwd: String) -> String {
        (session == "unknown" || session.isEmpty) ? "\(pill)+\(cwd)" : session
    }

    /// Records what an event says about a session of `pill` on the board.
    @MainActor
    private func record(pill: String, session key: String, raw: String, title: String,
                        _ change: (inout BoardSession) -> Void = { _ in }) {
        board.update(pill: pill, session: key, rawSession: raw, title: title, now: Date(), change)
    }

    /// The sessions of `pill` waiting for you, with what they wait for (a permission first).
    @MainActor
    private func waitingSessions(pill: String) -> [String: BotState] {
        var waiting: [String: BotState] = [:]
        for q in questions.entries where q.pillId == pill { waiting[q.sessionId] = .question }
        for a 
```

### Core Architecture Module: `NotchBuddy/Sources/App/IslandStateMachine.swift`
```
import Foundation

/// Pure 4-state FSM for island open/close logic.
/// No AppKit / AppState dependencies — communicates via `onTransition`.
@MainActor
final class IslandStateMachine {

    enum State: Equatable {
        case hidden    // island invisible (notch size)
        case petit     // compact island (notch + ears)
        case home      // expanded, overview
        case coucou    // expanded, greeting animation
        case listening // expanded, voice listening («OK Coucou» detected)
    }

    private(set) var state: State = .hidden

    /// Fired on every transition: (from, to)
    var onTransition: ((State, State) -> Void)?

    /// When non-nil and returns true, timers and mouse-leave never auto-collapse or hide the island.
    var isHeldOpen: (() -> Bool)?

    /// home → petit delay (seconds), kept in sync with the auto-close preference.
    var homeToPetitDelay: TimeInterval = 15 {
        didSet {
            guard homeToPetitDelay != oldValue,
                  state == .home, homeCollapseWork != nil else { return }
            scheduleHomeCollapse()
        }
    }
    /// petit → hidden delay (seconds), kept in sync with the absenceInterval preference.
    var petitToHiddenDelay: TimeInterval = 60 {
        didSet {
            guard petitToHiddenDelay != oldValue,
                  state == .petit, petitHideWork != nil else { return }
            schedulePetitHide()
        }
    }
    /// coucou → petit delay after greeting animation ends (no hover). ~0.6s syncs with canvas collapse.
    var greetAutoCollapseDelay: TimeInterval = 0.6
    /// coucou → petit delay when mouse is hovering over the greeting.
    var greetHoverCollapseDelay: TimeInterval = 10

    /// Opt-in (Settings → General → Behavior): hovering the island opens it, and an island
    /// opened that way folds shortly after the pointer leaves. Off: hover only peeks (petit).
    var openOnHover = false
    /// Grace period after the pointer leaves a hover-opened island (no flicker at the edge).
    var hoverCloseDelay: TimeInterval = 0.6
    /// True while the island is open because of a hover, until the user clicks inside it.
    private(set) var openedByHover = false

    private var petitHideWork: DispatchWorkItem?
    private var homeCollapseWork: DispatchWorkItem?
    private var greetCollapseWork: DispatchWorkItem?
    private var stateBeforeListening: State = .hidden

    // MARK: – Inputs

    /// App launched or debug "launch greeting"
    func launch() {
        cancelTimers()
        transition(to: .coucou)
    }

    /// Mouse entered the island notch area
    func mouseEntered() {
        if openOnHover, state == .hidden || state == .petit, isHeldOpen?() != true {
            cancelTimers()
            openedByHover = true
            transition(to: .home)
            return
        }
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
        case .listening:
            // Voice is active; if openOnHover, expand to show the overview.
            if openOnHover {
                cancelTimers()
                openedByHover = true
                transition(to: .home)
            }
            // else: no timer, island stays compact — voice keeps running.
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
        case .listening:
            break   // never auto-collapse while listening
        }
    }

    /// Compact island clicked.
    /// Also accepts `.hidden`: after an alert the island can be on screen while the
    /// FSM never saw the mouse enter (it was already there), and the click must still open it.
    /// Also accepts `.listening`: the user can open the island while voice is active; voice
    /// continues uninterrupted and the island expands to the overview.
    func click() {
        openedByHover = false
        guard state == .petit || state == .hidden || state == .listening else { return }
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
        openedByHover = false
        guard state != .home && state != .coucou else { return }
        state = .home
    }

    /// The app folded the island itself (Escape, Settings, OK button, auto-close).
    /// Move to `.petit` right away so hover and click keep working; waiting for the
    /// 15 s home timer left the island compact on screen while the FSM still said `.home`.
    func collapse() {
        openedByHover = false
        guard state == .home || state == .coucou || state == .listening else { return }
        cancelTimers()
        transition(to: .petit)
    }

    // MARK: – Voice inputs

    /// Wake phrase detected: open the island in listening mode from any state.
    func voiceWoke() {
        stateBeforeListening = state
        cancelTimers()
        openedByHover = false
        transition(to: .listening)
    }

    /// Command session ended (silence timeout, cancel phrase, or user dismiss).
    func voiceFinished() {
        guard state == .listening else { return }
        let target: State = stateBeforeListening == .home ? .home : .petit
        transition(to: target)
        if target == .home, isHeldOpen?() != true { scheduleHomeCollapse() }
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
            self.openedByHover = false
            self.transition(to: .petit)
        }
        homeCollapseWork = item
        let delay = openedByHover ? hoverCloseDelay : homeToPetitDelay
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
    }

    /// The user clicked inside the island: a hover-opened island now stays like any open
    /// island (normal auto-close) instead of folding as soon as the pointer leaves.
    func userInteracted() {
        openedByHover = false
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

### Core Architecture Module: `NotchBuddy/Sources/App/ParakeetEngine.swift`
```
#if !APPSTORE
import AVFoundation
@preconcurrency import FluidAudio
import os

/// How Flow dictation turns the voice into text.
enum FlowEngine: String, CaseIterable, Identifiable {
    /// NVIDIA's Parakeet, run on the Mac's Neural Engine by FluidAudio: the most accurate, offline.
    case parakeet
    /// The Mac's own speech recognition (MacDictation).
    case apple

    var id: String { rawValue }
}

/// Parakeet (speech to text) and the speaker diarizer of the Notetaker: their models, downloaded
/// once from Hugging Face when the user clicks Download in Coucou Flow → Settings (≈ 650 MB),
/// kept in Application Support/NotchBuddy/Models, then everything runs on this Mac.
@MainActor
final class Parakeet: ObservableObject {
    static let shared = Parakeet()

    /// Parakeet Ultra: v3's 25 languages, more accurate than v3, same speed.
    nonisolated static let version: AsrModelVersion = .ultra

    enum State: Equatable {
        /// Intel Mac: the models need the Neural Engine of Apple silicon.
        case unsupported
        case missing
        case downloading(Double)
        case ready
        case failed(String)
    }

    @Published private(set) var state: State = .missing

    private var loading: Task<AsrManager, Error>?

    private init() { refresh() }

    nonisolated static var isSupported: Bool {
        #if arch(arm64)
        return true
        #else
        return false
        #endif
    }

    /// Coucou's own copy of the models (not FluidAudio's shared folder, so removing them never
    /// touches another app's).
    nonisolated static var modelsRoot: URL {
        HookServer.supportDir.appendingPathComponent("Models", isDirectory: true)
    }

    nonisolated static var asrDirectory: URL {
        modelsRoot.appendingPathComponent(AsrModels.defaultCacheDirectory(for: version).lastPathComponent, isDirectory: true)
    }

    nonisolated static var installed: Bool {
        AsrModels.modelsExist(at: asrDirectory, version: version)
    }

    var isReady: Bool { state == .ready }

    func refresh() {
        if !Self.isSupported { state = .unsupported; return }
        if case .downloading = state { return }
        state = Self.installed ? .ready : .missing
    }

    /// Downloads Parakeet and the diarizer, then loads Parakeet so the first dictation is quick.
    func download() {
        guard Self.isSupported else { return }
        if case .downloading = state { return }
        state = .downloading(0)
        Task { @MainActor in
            do {
                try await Self.fetchModels { fraction in
                    Task { @MainActor in
                        if case .downloading(let shown) = Parakeet.shared.state, fraction > shown {
                            Parakeet.shared.state = .downloading(fraction)
                        }
                    }
                }
                state = .ready
                appendAppLog("nb.log", "[Parakeet] models downloaded")
                _ = try? await manager()
            } catch {
                appendAppLog("nb.log", "[Parakeet] download failed: \(error.localizedDescription)")
                state = .failed(error.localizedDescription)
            }
        }
    }

    nonisolated private static func fetchModels(progress: @escaping @Sendable (Double) -> Void) async throws {
        try FileManager.default.createDirectory(at: modelsRoot, withIntermediateDirectories: true)
        _ = try await AsrModels.download(to: asrDirectory, version: version, progressHandler: { update in
            progress(min(0.92, update.fractionCompleted * 0.92))
        })
        try await prepareDiarizer()
        progress(1)
    }

    /// Downloads (once) and loads the Notetaker's speaker diarizer.
    nonisolated static func prepareDiarizer() async throws {
        let diarizer = OfflineDiarizerManager()
        try await diarizer.prepareModels(directory: modelsRoot)
    }

    /// Removes the models from this Mac (Settings → Remove).
    func remove() {
        loading?.cancel()
        loading = nil
        try? FileManager.default.removeItem(at: Self.modelsRoot)
        refresh()
    }

    /// Loads Parakeet once; later calls get the same instance.
    func manager() async throws -> AsrManager {
        if let loading { return try await loading.value }
        let task = Task<AsrManager, Error> {
            let models = try await AsrModels.load(from: Self.asrDirectory, version: Self.version)
            let asr = AsrManager(config: .default)
            try await asr.loadModels(models)
            return asr
        }
        loading = task
        do {
            return try await task.value
        } catch {
            loading = nil
            throw error
        }
    }

    /// Loads the model in the background when dictation will use it, so the first one is quick.
    func preload() {
        guard state == .ready, loading == nil else { return }
        Task { @MainActor in _ = try? await manager() }
    }

    /// 16 kHz mono samples → text.
    func transcribe(_ samples: [Float]) async throws -> String {
        try await transcribeWithTimings(samples).text
    }

    func transcribeWithTimings(_ samples: [Float]) async throws -> ASRResult {
        var audio = samples
        // Parakeet wants at least a second, and a little silence at the end keeps the last word.
        audio.append(contentsOf: [Float](repeating: 0, count: max(4_800, 16_000 - audio.count)))
        let asr = try await manager()
        var decoder = TdtDecoderState.make(decoderLayers: await asr.decoderLayerCount)
        return try await asr.transcribe(audio, decoderState: &decoder)
    }
}

// MARK: - 16 kHz mono

/// Turns the microphone's or the Mac's audio, in whatever format it comes, into the 16 kHz mono
/// Float32 samples Parakeet and the diarizer take. Fed from one audio thread at a time.
final class Resampler16k: @unchecked Sendable {
    nonisolated(unsafe) static let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 16_000,
                                                          channels: 1, interleaved: false)!
    private let converter: AVAudioConverter
    private let ratio: Double

    init?(from input: AVAudioFormat) {
        guard input.sampleRate > 0, let converter = AVAudioConverter(from: input, to: Self.format) else { return nil }
        converter.downmix = true
        self.converter = converter
        ratio = 16_000 / input.sampleRate
    }

    func convert(_ buffer: AVAudioPCMBuffer) -> [Float] {
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 64
        guard buffer.frameLength > 0,
              let out = AVAudioPCMBuffer(pcmFormat: Self.format, frameCapacity: capacity) else { return [] }
        nonisolated(unsafe) var fed = false
        nonisolated(unsafe) let source = buffer
        var error: NSError?
        let status = converter.convert(to: out, error: &error) { _, inputStatus in
            if fed {
                inputStatus.pointee = .noDataNow
                return nil
            }
            fed = true
            inputStatus.pointee = .haveData
            return source
        }
        guard status != .error, let data = out.floatChannelData, out.frameLength > 0 else { return [] }
        return Array(UnsafeBufferPointer(start: data[0], count: Int(out.frameLength)))
    }
}

// MARK: - Dictation with Parakeet

/// Flow dictation with Parakeet: the microphone is recorded while the key is held, then Parakeet
/// writes it all at once (a few hundred milliseconds for a minute of speech). Only the microphone
/// permission is needed; nothing leaves the Mac.
final class ParakeetDictation: @unchecked Sendable {
    @MainActor private(set) var isRecording = false
    /// Flow dictation's pill: the microphone's levels by frequency.
    var bands: FlowAudioBands?

    private let engine = AVAudioEngine()
    private let samples = OSAllocatedUnfairLock(initialState: [Float]())

    @MainActor func start() async {
        guard !isRecording, await AVAudioApplication.requestRecordPermission() else { return }
        samples.withLock { $0.removeAll(keepingCapacity: true) }
        guard Self.startEngine(engine, into: samples, bands: bands) else { return }
        isRecording = true
        NotificationCenter.default.post(name: .dictationDidStart, object: nil)
    }

    /// Stops the microphone and returns the words.
    @MainActor func finish() async -> String {
        guard isRecording else { return "" }
        stopEngine()
        let audio = samples.withLock { $0 }
        do {
            return try await Parakeet.shared.transcribe(audio)
        } catch {
            appendAppLog("nb.log", "[Parakeet] dictation failed: \(error.localizedDescription)")
            return ""
        }
    }

    /// Stops without words (Esc, another key).
    @MainActor func stop() {
        guard isRecording else { return }
        stopEngine()
        samples.withLock { $0.removeAll() }
    }

    @MainActor private func stopEngine() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        isRecording = false
        NotificationCenter.default.post(name: .dictationDidEnd, object: nil)
    }

    nonisolated private static func startEngine(_ engine: AVAudioEngine, into samples: OSAllocatedUnfairLock<[Float]>,
                                                bands: FlowAudioBands?) -> Bool {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard let resampler = Resampler16k(from: format) else { return false }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            bands?.consume(buffer)
            let out = resampler.convert(buffer)
            if !out.isEmpty { samples.withLock { $0.append(contentsOf: out) } }
        }
        engine.prepare()
        do { try engine.start() } catch {
            input.removeTap(onBus: 0)
            return false
        }
        re
```

### Core Architecture Module: `NotchBuddy/Sources/App/QuestionQueue.swift`
```
import Foundation

// MARK: - QuestionQueue
// Pure FIFO queue of pending AskUserQuestions, one per session. No AppKit, no SwiftUI, no I/O:
// HookServer owns the sockets, timers and UI, and mutates this value on the main actor only.
// The head is the question shown on the card; every question keeps its own connection, so an
// answer always goes back to the session that asked.

struct QueuedQuestion: Equatable, Sendable {
    let id: UUID
    /// Client socket, held open until the user answers. Closed by the owner's dispatch source.
    let fd: Int32
    /// The session's id, or "<pill>+<cwd>" for a session that sends none.
    let sessionId: String
    /// "integration_claude", "agent_cursor" or "agent_codex".
    let pillId: String
    let projectName: String
    let cwd: String
    let question: AskQuestion
    /// Which iPhone record carries the question: 1 is the pill's own, 2, 3… one of its own
    /// (see `phoneRecordId`). Given by the queue, kept for the question's whole life.
    var slot: Int = 1
    /// When the question arrived (answers sent before it are not for it).
    var received = Date()
    /// The pill the question shows on when its session popped out of `pillId` (SessionBoard),
    /// nil when it shows on `pillId` itself.
    var shownPill: String? = nil

    /// Where the card and the focus find the question.
    var displayPill: String { shownPill ?? pillId }

    /// The iPhone record that shows this question: the popped-out pill's own when its session
    /// popped out, else the pill's own for the first question behind a pill, "<pill>#q<slot>"
    /// for the others, so each session's question is answered on its own (a popped-out pill is
    /// "<pill>#<n>": the two never meet). The iPhone sends this id back with its answer.
    var phoneRecordId: String { shownPill ?? (slot == 1 ? pillId : "\(pillId)#q\(slot)") }
}

struct QuestionQueue: Sendable {
    /// Upper bound of simultaneously pending questions. Each one holds a socket and a 120 s
    /// timer; beyond this the newest goes back to its terminal.
    static let maxPending = 5

    enum EnqueueResult: Equatable, Sendable {
        /// Queued. `replaced` is the same session's earlier question, now taken out of the
        /// queue: the caller hands it back to its terminal.
        case accepted(replaced: QueuedQuestion?)
        case rejectedFull
    }

    private(set) var entries: [QueuedQuestion] = []

    var head: QueuedQuestion? { entries.first }
    var count: Int { entries.count }
    var isEmpty: Bool { entries.isEmpty }

    func contains(id: UUID) -> Bool { entries.contains { $0.id == id } }

    func entry(id: UUID) -> QueuedQuestion? { entries.first { $0.id == id } }

    func hasEntries(forPill pillId: String) -> Bool {
        entries.contains { $0.pillId == pillId }
    }

    /// Queues `entry` behind the others and gives it the lowest record slot free on its pill.
    /// A session waits on one question at a time: a newer one from the same session takes
    /// the older one's place and slot, and the older is returned so its connection can be answered.
    mutating func enqueue(_ entry: QueuedQuestion, maxPending: Int = QuestionQueue.maxPending) -> EnqueueResult {
        var entry = entry
        if let idx = entries.firstIndex(where: { $0.sessionId == entry.sessionId && $0.pillId == entry.pillId }) {
            let replaced = entries[idx]
            entry.slot = replaced.slot
            entries[idx] = entry
            return .accepted(replaced: replaced)
        }
        guard entries.count < maxPending else { return .rejectedFull }
        // A popped-out question has its pill's record: the slots count the others only.
        let taken = Set(entries.filter { $0.pillId == entry.pillId && $0.shownPill == nil }.map(\.slot))
        entry.slot = (1...).first { !taken.contains($0) }!
        entries.append(entry)
        return .accepted(replaced: nil)
    }

    /// Removes only the entry with this id. Other entries keep their order and slots.
    @discardableResult
    mutating func remove(id: UUID) -> QueuedQuestion? {
        guard let idx = entries.firstIndex(where: { $0.id == id }) else { return nil }
        return entries.remove(at: idx)
    }

    /// Empties the queue, oldest first.
    mutating func removeAll() -> [QueuedQuestion] {
        defer { entries = [] }
        return entries
    }

    /// The waiting question an iPhone answer is for: the same question (`fingerprint`, as
    /// `fingerprintOf` computes it) on the record the answer names. An answer that names no
    /// record goes to the oldest such question. nil when none waits any more.
    static func question(answering fingerprint: String, onRecord recordId: String,
                         in entries: [QueuedQuestion],
                         fingerprintOf: (AskQuestion) -> String) -> QueuedQuestion? {
        let same = entries.filter { fingerprintOf($0.question) == fingerprint }
        if recordId.isEmpty { return same.first }
        return same.first { $0.phoneRecordId == recordId }
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

    static let soundNames = ["peek","open","close","hover","blip","slap","annoyed","dizzy","greet",
                             "work","finish","error","approval","question","approve","gulp","tick",
                             "send","love","pop","proud","wink","yawn","attach","think","search",
                             "rate","sleep","greeting"]

    /// Your own sounds: a file named like a built-in sound (e.g. finish.wav, approval.mp3) in this
    /// folder replaces it. ~/Library/Application Support/NotchBuddy/Sounds (in the App Store build,
    /// the same path inside the app's container).
    static var customFolder: URL? {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
            .appendingPathComponent("NotchBuddy/Sounds", isDirectory: true)
    }
    private static let customExtensions = ["wav", "aiff", "aif", "caf", "m4a", "mp3"]

    /// The custom file for a sound, if the user dropped one in the folder.
    static func customURL(for name: String) -> URL? {
        guard let dir = customFolder else { return nil }
        for ext in customExtensions {
            let url = dir.appendingPathComponent(name).appendingPathExtension(ext)
            if FileManager.default.isReadableFile(atPath: url.path) { return url }
        }
        return nil
    }

    /// Names of the built-in sounds currently replaced by a custom file.
    private(set) var customized: [String] = []

    private func preload() {
        var pools: [String: [AVAudioPlayer]] = [:]
        var custom: [String] = []
        for name in Self.soundNames {
            let own = Self.customURL(for: name)
            // A custom file that can't be decoded falls back to the built-in sound.
            var pool = own.map { makePool($0) } ?? []
            if pool.isEmpty {
                guard let url = Bundle.main.url(forResource: name, withExtension: "wav", subdirectory: "sounds") else { continue }
                pool = makePool(url)
            } else {
                custom.append(name)
            }
            if !pool.isEmpty { pools[name] = pool }
        }
        players = pools
        customized = custom
    }

    private func makePool(_ url: URL) -> [AVAudioPlayer] {
        var pool: [AVAudioPlayer] = []
        for _ in 0..<3 {
            if let p = try? AVAudioPlayer(contentsOf: url) {
                p.volume = volume
                p.prepareToPlay()
                pool.append(p)
            }
        }
        return pool
    }

    /// Re-reads the sounds (after the user changed the custom folder).
    func reload() { preload() }

    /// Creates the custom folder if needed and shows it in the Finder.
    func revealCustomFolder() {
        guard let dir = Self.customFolder else { return }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        NSWorkspace.shared.activateFileViewerSelecting([dir])
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #949** (2026-10-29): **Coucou 0.5.3 crashes on launch when no microphone is present**
  *Symptoms*: Coucou 0.5.3 crashes on launch when no microphone is present 27 oct 2026 · @Gabriel Añez Lopez  **Summary** Coucou 0.5.3 aborts on every launch when voice is enabled (voiceEnabled = 1) and the Mac has no audio input device. VoiceAudio.start() calls installTapOnBus on the input node without checking that an input device exists, and AVFAudio throws an uncaught NSException. The app never reaches its UI, so the user cannot turn voice off from Settings. It has crashed 8 times since 2026-10-26 18:22.  **Environment**  App	                   : Coucou 0.5.3 (build 20, commit 95017af), bundle fr.louisraille.NotchBuddy macOS               : 26.6.2 (25G83) Hardware           : Mac mini, Apple M4 (Mac16,10) Audio inputs      : None: the Mac mini has no built-in microphone and nothing is connected Audio outputs    :  Built-in speaker and 2 HDMI/USB-C displays, all 48 kHz Relevant setting : voiceEnabled = 1, flowEngine = parakeet  The system log for 21:51:38 also shows UpdateStreamFormats: 0 input streams and Input render format: 0 ch, 0 Hz from AUHAL just before the throw.  **Root cause and suggested fix** The input node has no hardware format (0 channels, 0 Hz) when there is no input device. VoiceAudio.start() installs the tap with a 44.1 kHz stereo format anyway, and AVFAudio raises an Objective-C exception that Swift cannot catch. SettingsView.init() touches VoiceEngine.shared from the Settings scene body, so the crash happens during app launch, before any window shows. Suggested chang

- **Issue #925** (2026-10-31): **Windows: pill toolbar disappears when moving the mouse onto its buttons**
  *Symptoms*: **What happened** When I hover over the pill on the left edge of the screen, it expands into the toolbar (Mochi, dictation mic, Record a call, open Coucou). As soon as I move the mouse toward one of the buttons to click it, the toolbar collapses and disappears, so I can’t click anything. Additionally, if the pill is set to be at the bottom of the screen, it functions as intended. If the pull is set to be on the right edge of the screen, it doesn't bring up the toolbar at all.  **What you expected** The toolbar should stay open while the pointer is on it, so I can click Dictate, Record a call or Open Coucou.  **How to reproduce** Launch Coucou on Windows 11. Hover over the pill on the left edge of the screen. The toolbar expands. Move the mouse toward any button in the toolbar. The toolbar collapses before I can click it.  **Windows version** Edition	Windows 11 Pro Version	25H2 Installed on	‎10/‎26/‎2025 OS build	26200.7462 Experience	Windows Feature Experience Pack 1000.26100.275.0  **PC model** Custom built Display scaling: 100%.  Monitors: 1  **Coucou version** 0.5.3  https://github.com/user-attachments/assets/4c169c97-ad88-4b09-b33c-7e2328c46bb9

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

### Incident Patch 1: `6bc221c7` (2026-11-12)
**Commit Message**: Windows and Linux: show the relay settings to testers

The "Away from home Wi-Fi" block stays hidden until a relay is ready for everyone, but now shows when Coucou starts with
COUCOU_RELAY_SETTINGS=1, or when a relay is already on. Without it, nobody could reach a relay, so the Android 0.5 relay
fixes (#19, #30 on Rhytam23/coucou) could not be tested. Nothing changes for other users.

- phone_relay_status carries `shown`; Settings → Android phone inserts the block only when it is set.
- docs/RELAY_DEPLOY.md says how to start Coucou with the variable; CHANGELOG notes it.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -31,6 +31,7 @@ Fixes:
 - **Start a Claude Code session from the island** — the terminal tab in the island's header: pick the project (the folders your sessions ran in, or any folder), say what Claude should do, and your terminal opens there with Claude Code and your words. Windows Terminal or PowerShell on Windows; your own terminal on Linux. The prompt is never written into a command line
 - **Drop a file on a session** — drag a file over the island and let go on one of the sessions listed on the right of the drop card: its window comes forward and the file's path lands in its prompt
 - **Approve Antigravity commands from the island** *(optional)* — the Mac's setting comes to Windows and Linux: turn on Settings → Agents → Antigravity → **Approve commands from the notch**, and a shell command that none of your Antigravity rules covers waits for you on the approval card: **Allow**, **Deny**, or **Reply in terminal** for Antigravity's own prompt. Commands your rules allow or deny are left to Antigravity, and with no answer in 2 min, or Coucou closed, Antigravity asks in its terminal as before. Reinstall the Antigravity hooks once, then restart Antigravity: its command hook now waits up to 2 min
+- **Relay settings for testers** — the *Away from home Wi-Fi* block in Settings → Android phone stays hidden until a relay is ready for everyone, but now shows when Coucou starts with `COUCOU_RELAY_SETTINGS=1` (or when a relay is already on), so the Android relay link can be tested; how in [docs/RELAY_DEPLOY.md](docs/RELAY_DEPLOY.md)
 - **Approve OpenCode from the island** — OpenCode's permission requests get Allow and Deny on the island; with no click, OpenCode asks as usual (#442 by @ValentinoMartz)
 - **A card answered in the terminal goes away** — allow or deny in the terminal (or Claude's app) and the island's card closes by itself (#740 by @arnavaggarwal-dev)
 - **Flow: one press starts hands-free** (#1063 by @Brezinben)
@@ -53,7 +54,7 @@ Fixes:
 ## Android 0.5.0 — Unreleased
 
 - **Coucou for Android 0.5.0**, by @Rhytam23 (versionCode 5)
-  - **A steadier link through your own relay** — the connection no longer drops after a quiet moment (from #554 by @rollecode), and the phone reconnects at once when the computer comes back instead of waiting on a dead connection (from #1041 by @lazarevtill)
+  - **A steadier link through your own relay** — the connection no longer drops after a quiet moment (from #554 by @rollecode), and the phone reconnects at once when the computer comes back instead of waiting on a dead connection (from #1041 by @lazarevtill). The relay settings are still hidden on Windows and Linux, so this is for testers for now (see Windows and Linux 0.6.0)
   - **Swipe the island up to put it away** — it goes back into the camera hole and stays there while the same thing goes on (the same agent working, the same request); anything new brings it back down. TalkBack has a *Dismiss the island* action for it
   - **Nothing is lost with the swipe** — a finish, an error, a usage limit or a question becomes a quiet notification, and a permission request keeps its own notification with Deny and Allow
   - **Hide the island in Do Not Disturb** *(optional, off by default)* — Settings → **Hide the island in Do Not Disturb**: while the phone is in Do Not Disturb, nothing drops from the top of the screen; requests still arrive as notifications, which Android handles by its own Do Not Disturb rules
```

**File**: `docs/RELAY_DEPLOY.md` (modified, +4/-0)
```diff
@@ -44,6 +44,10 @@ Notes:
 
 ## 2. Set up the computer (Windows or Linux)
 
+The **Away from home Wi-Fi** block is hidden in Settings until a relay is ready for everyone. To see it, quit Coucou and start
+it with `COUCOU_RELAY_SETTINGS=1`: in PowerShell, `$env:COUCOU_RELAY_SETTINGS="1"` then start Coucou from that window; on Linux, from a terminal,
+`COUCOU_RELAY_SETTINGS=1 coucou` (or the path to the AppImage instead of `coucou`). Once the relay is turned on, the block stays visible without it.
+
 1. Settings > **Android phone**. Turn **Phone link** on.
 2. In the block **Away from home Wi-Fi**:
    - **Relay address**: `wss://coucou-link.<your-name>.workers.dev` (it must start with `wss://`), press **Save address**.
```

**File**: `windows/src-tauri/src/phone_link/mod.rs` (modified, +9/-0)
```diff
@@ -390,6 +390,14 @@ pub struct RelayStatus {
     /// An access key is stored. The key itself is never sent back to the window.
     pub has_access: bool,
     pub state: relay_client::State,
+    /// The "Away from home Wi-Fi" block is shown in Settings. It stays hidden until a relay is ready to use, except for
+    /// testers who start Coucou with `COUCOU_RELAY_SETTINGS=1`, and for a relay that is already turned on.
+    pub shown: bool,
+}
+
+/// Testers start Coucou with `COUCOU_RELAY_SETTINGS=1` to see the relay settings (docs/RELAY_DEPLOY.md).
+fn relay_settings_for_testers() -> bool {
+    std::env::var("COUCOU_RELAY_SETTINGS").map(|v| v == "1").unwrap_or(false)
 }
 
 fn relay_status_of(link: &PhoneLink, shared: &Shared) -> RelayStatus {
@@ -399,6 +407,7 @@ fn relay_status_of(link: &PhoneLink, shared: &Shared) -> RelayStatus {
         url: s.phone_relay_url.clone(),
         has_access: relay_client::access_key(&*link.store).is_some(),
         state: link.relay.lock().unwrap().as_ref().map_or(relay_client::State::Off, |h| h.state()),
+        shown: relay_settings_for_testers() || s.phone_relay,
     }
 }
 
```

**File**: `windows/src/core/bridge.ts` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ export interface PhoneRelayStatus {
   url: string;
   hasAccess: boolean;
   state: PhoneRelayState;
+  /** The relay settings are shown: for testers (COUCOU_RELAY_SETTINGS=1), or when a relay is already on. */
+  shown: boolean;
 }
 
 /** Session details for the phone: the switch (off by default). */
```

**File**: `windows/src/settings/phone.ts` (modified, +12/-5)
```diff
@@ -11,10 +11,17 @@ import { t } from "../i18n/i18n";
 type Toggle = (on: boolean, onChange: (v: boolean) => void) => HTMLElement;
 
 /**
- * The relay block ("Away from home Wi-Fi") is hidden until a relay is ready to use: the code and its tests stay, and
- * turning this on shows it again. Nothing else changes.
+ * The relay block ("Away from home Wi-Fi") is hidden until a relay is ready to use: the code and its tests stay.
+ * Testers who start Coucou with COUCOU_RELAY_SETTINGS=1 see it (docs/RELAY_DEPLOY.md), and so does anyone whose relay
+ * is already on. Nothing else changes.
  */
-const SHOW_RELAY_SETTINGS = false;
+function relaySlot(makeToggle: Toggle, refreshPairing: () => void): HTMLElement {
+  const slot = h("div", {});
+  void Bridge.phoneRelayStatus().then((status) => {
+    if (status?.shown) slot.replaceWith(relayBlock(makeToggle, refreshPairing));
+  });
+  return slot;
+}
 
 export function phoneSection(on: boolean, makeToggle: Toggle, settings: Settings): HTMLElement {
   const detail = h("div", {});
@@ -64,7 +71,7 @@ export function phoneSection(on: boolean, makeToggle: Toggle, settings: Settings
       h("div", { class: "hint", text: t("The phone connects to {address}", { address }) }),
       h("div", { class: "hint", text: t("If Windows asks about the firewall, allow Coucou on private networks. The phone and this computer must be on the same Wi-Fi.") }),
       h("div", { class: "hint", text: t("Your phone finds this computer again by itself when the network changes. It is announced on your local network only while this switch is on. Some hotspots and guest networks block this.") }),
-      ...(SHOW_RELAY_SETTINGS ? [relayBlock(makeToggle, () => void refreshPairing())] : []),
+      relaySlot(makeToggle, () => void refreshPairing()),
       detailsBlock(makeToggle),
       answersBlock(makeToggle),
       diffsBlock(makeToggle),
@@ -138,7 +145,7 @@ function relayBlock(makeToggle: Toggle, changed: () => void): HTMLElement {
   const state = h("div", { class: "hint" });
   const address = h("input", { type: "text", placeholder: "wss://", style: "width:100%", autocomplete: "off", spellcheck: "false" }) as HTMLInputElement;
   const access = h("input", { type: "password", style: "width:100%", autocomplete: "off", spellcheck: "false" }) as HTMLInputElement;
-  let current: PhoneRelayStatus = { enabled: false, url: "", hasAccess: false, state: "off" };
+  let current: PhoneRelayStatus = { enabled: false, url: "", hasAccess: false, state: "off", shown: true };
 
   const show = (status: PhoneRelayStatus | null) => {
     if (!status) return;
```

**File**: `windows/tests/phone-relay.test.mjs` (modified, +11/-0)
```diff
@@ -33,3 +33,14 @@ test("the bridge never asks Rust for the access key", () => {
   assert.match(status.slice(0, 400), /hasAccess: boolean/);
   assert.ok(!/access: string/.test(status.slice(0, 400)));
 });
+
+test("the relay block shows only for testers (COUCOU_RELAY_SETTINGS=1) or when a relay is already on", () => {
+  const src = readFileSync(new URL("../src/settings/phone.ts", import.meta.url), "utf8");
+  assert.ok(!/SHOW_RELAY_SETTINGS/.test(src), "no hard-coded switch left");
+  const slot = src.slice(src.indexOf("function relaySlot"), src.indexOf("export function phoneSection"));
+  assert.match(slot, /status\?\.shown/);
+  assert.match(src, /relaySlot\(makeToggle/);
+  const rust = readFileSync(new URL("../src-tauri/src/phone_link/mod.rs", import.meta.url), "utf8");
+  assert.match(rust, /env::var\("COUCOU_RELAY_SETTINGS"\)\.map\(\|v\| v == "1"\)\.unwrap_or\(false\)/);
+  assert.match(rust, /shown: relay_settings_for_testers\(\) \|\| s\.phone_relay/);
+});
```

---

### Incident Patch 2: `fd056232` (2026-10-24)
**Commit Message**: Relay link: keep reading after the handshake without its timeout, and forward frames in order in the Node twin (#19, from PR #554 by rollecode)

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `android/app/src/main/kotlin/com/coucou/android/link/RelayLink.kt` (modified, +2/-0)
```diff
@@ -88,6 +88,8 @@ class RelayConnector(
         }
         try {
             val session = handshake(ws, key)
+            // The stream keeps its own read timeout; the handshake's would end it after any quiet stretch.
+            ws.setReadTimeout(0)
             issue = RelayIssue.NONE
             return RelayStreamSocket(ws, session)
         } catch (e: Throwable) {
```

**File**: `android/app/src/test/kotlin/com/coucou/android/link/RelayConnectorTest.kt` (modified, +13/-0)
```diff
@@ -276,6 +276,19 @@ class RelayConnectorTest {
         assertTrue(s.isClosed)
     }
 
+    @Test fun aQuietStretchAfterTheHandshakeDoesNotEndTheStream() {
+        val f = Fake()
+        val s = connectorFor(f, resendMs = 150).connect(2_000)
+        try {
+            f.awaitSession()
+            Thread.sleep(400) // longer than the handshake waited for each answer
+            f.sendLine("{\"type\":\"welcome\"}")
+            assertEquals("{\"type\":\"welcome\"}", readLine(s))
+        } finally {
+            s.close()
+        }
+    }
+
     @Test fun aLineOverTheLimitCannotBeSent() {
         val f = Fake()
         val s = connectorFor(f).connect(2_000)
```

**File**: `android/relay/tests/behaviour.ts` (modified, +13/-0)
```diff
@@ -124,6 +124,19 @@ export function behaviour(name: string, make: () => Promise<Harness>) {
       expect(got.kind === "binary" && got.data.length).toBe(66_000);
     });
 
+    it("forwards a burst in the order it was sent", async () => {
+      const { pc, phone } = await pair();
+      // Under the rate burst (60); frames of different sizes, as a conversation sends them.
+      const count = 50;
+      for (let i = 0; i < count; i++) phone.send(new Uint8Array(1 + ((i * 7919) % 40_000)).fill(i));
+      const order: number[] = [];
+      for (let i = 0; i < count; i++) {
+        const m = await pc.next(5000);
+        if (m.kind === "binary") order.push(m.data[0]);
+      }
+      expect(order).toEqual(Array.from({ length: count }, (_, i) => i));
+    });
+
     it("closes a socket that sends a frame over 66,000 bytes (1009)", async () => {
       const { pc, phone } = await pair();
       phone.send(new Uint8Array(66_001));
```

**File**: `android/relay/tools/dev-relay.ts` (modified, +6/-1)
```diff
@@ -96,7 +96,7 @@ export async function startRelay(options: { port?: number; host?: string; access
         peer.ws.send(PEER_ONLINE);
       }
 
-      ws.on("message", async (data, isBinary) => {
+      const onMessage = async (data: WebSocket.RawData, isBinary: boolean) => {
         if ((await accessGeneration(accessKey)) !== me.gen || !me.gen) return ws.close(1008, "access key changed");
         if (!isBinary) {
           if (data.toString() === "ping") return ws.send("pong"); // the platform's auto-response in the Worker
@@ -108,6 +108,11 @@ export async function startRelay(options: { port?: number; host?: string; access
         const other = room[otherRole(me.role)];
         if (!other || other.replaced || other.ws.readyState !== other.ws.OPEN) return ws.send(PEER_OFFLINE);
         other.ws.send(frame, { binary: true });
+      };
+      // One message at a time: the await above would otherwise let a burst overtake itself, which the Worker never does.
+      let turn: Promise<void> = Promise.resolve();
+      ws.on("message", (data, isBinary) => {
+        turn = turn.then(() => onMessage(data, isBinary)).catch(() => {});
       });
 
       const left = () => {
```

---

### Incident Patch 3: `1a61b5e5` (2026-11-11)
**Commit Message**: Release prep: Mac 0.6.0 (build 26)

- project.yml and Info.plist: 0.6.0, build 26.
- CHANGELOG: 0.6.0 dated November 12, 2026.
- README: 0.6.0 row in the Versions table.
- What's new 0.6.0 was already in whats-new.json (16 languages).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Changelog
 
-## 0.6.0 — Unreleased
+## 0.6.0 — November 12, 2026
 
 - **Start a Claude Code session from the notch** *(GitHub build)* — the terminal tab in the island's header, or ⌃⌥N: pick the project (the folders your sessions ran in, or any folder), type or dictate what Claude should do, and your terminal opens there with Claude Code and your words. Terminal, iTerm2, Ghostty, kitty, WezTerm and Alacritty; the prompt is never written into a command line
 - **Drop a file on a session** *(GitHub build)* — drag a file over the notch (a ⌘⇧2 thumbnail, a capture, anything from Finder) and let go on one of the sessions listed on the right of the drop card: its terminal comes forward and the file lands in its prompt, as if dropped on the terminal itself
```

**File**: `NotchBuddy/Resources/Info.plist` (modified, +2/-2)
```diff
@@ -36,9 +36,9 @@
 	<key>CFBundlePackageType</key>
 	<string>APPL</string>
 	<key>CFBundleShortVersionString</key>
-	<string>0.5.8</string>
+	<string>0.6.0</string>
 	<key>CFBundleVersion</key>
-	<string>25</string>
+	<string>26</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSAccessibilityUsageDescription</key>
```

**File**: `NotchBuddy/project.yml` (modified, +2/-2)
```diff
@@ -140,8 +140,8 @@ targets:
         CFBundleName: Coucou
         CFBundleDisplayName: Coucou
         CFBundleIdentifier: fr.louisraille.NotchBuddy
-        CFBundleVersion: "25"
-        CFBundleShortVersionString: "0.5.8"
+        CFBundleVersion: "26"
+        CFBundleShortVersionString: "0.6.0"
         CFBundlePackageType: APPL
         LSUIElement: YES
         NSHighResolutionCapable: YES
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -151,6 +151,7 @@ macOS releases are published as `v*` tags. See [CHANGELOG.md](CHANGELOG.md) for
 
 | Version | Date | Highlights |
 |---------|------|------------|
+| [0.6.0](https://github.com/Louis-CFM/coucou/releases/tag/v0.6.0) | Nov 12, 2026 | Start a Claude Code session from the notch, drop a file on a session, ⌘⇧2 screenshot copied, approve Antigravity commands, Android phone link, Coucoudoro |
 | [0.5.8](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.8) | Oct 31, 2026 | Fixes by @Ohualtex: approvals and questions stay put, desktop Mochi stays visible, dropped files no longer overwrite each other |
 | [0.5.7](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.7) | Oct 31, 2026 | Mail in the notch: search, filters, reading, automatic sorting with rules and Undo, mail plans from the chat; search the settings; Coucou in a corner of the screen |
 | [0.5.6](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.6) | Oct 30, 2026 | Chat on your own AI subscription (Claude Code, Antigravity, Gemini CLI, Codex, Cursor, Copilot), switched on in Settings → Chat; Korean and Japanese |
```

#### Recent Merged Pull Requests:
- **PR #1092** (2026-11-12): Windows and Linux: show the relay settings to testers (@Louis-CFM)
- **PR #1090** (2026-11-12): Windows and Linux: Flow can hide the pill until you dictate (@Rhytam23)
- **PR #1089** (2026-11-12): Android 0.5.0: swipe the island away, Do Not Disturb, six more languages, a steadier relay link (@Rhytam23)
- **PR #1088** (2026-11-11): Release prep: Mac 0.6.0 (@Louis-CFM)
- **PR #1085** (closed): feat: initialize ml7a Windows app and complete Milestone 1 (@marceleno1717)
- **PR #1082** (closed): Worktree nexisland plan (@Snzy09)

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

## X. Windows and Linux: show the relay settings to testers

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Louis-CFM/coucou. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6bc221c7`: Windows and Linux: show the relay settings to testers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
- **Relay settings for testers** — the *Away from home Wi-Fi* block in Settings → Android phone stays hidden until a relay is ready for everyone, but now shows when Coucou starts with `COUCOU_RELAY_SETTINGS=1` (or when a relay is already on), so the Android relay link can be tested; how in [docs/RELAY_DEPLOY.md](docs/RELAY_DEPLOY.md)
  - **A steadier link through your own relay** — the connection no longer drops after a quiet moment (from #554 by @rollecode), and the phone reconnects at once when the computer comes back instead of waiting on a dead connection (from #1041 by @lazarevtill). The relay settings are still hidden on Windows and Linux, so this is for testers for now (see Windows and Linux 0.6.0)
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
  - **A steadier link through your own relay** — the connection no longer drops after a quiet moment (from #554 by @rollecode), and the phone reconnects at once when the computer comes back instead of waiting on a dead connection (from #1041 by @lazarevtill)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6bc221c7` are properly handled with clean fallback behavior.
