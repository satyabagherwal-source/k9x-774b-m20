> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/louis-cfm-coucou-learnings.md`  
> **Source**: github ([https://github.com/Louis-CFM/coucou](https://github.com/Louis-CFM/coucou))  
> **Source Version**: `e9fc337f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T11:44:06.021Z  
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
> **Harvest Timestamp**: 2026-11-03T11:39:03.335Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Louis-CFM/coucou`
- **Description**: A tiny friend in your Mac's notch and on your iPhone that keeps an eye on your AI coding agents: Claude Code, Codex, Cursor, Gemini CLI, Antigravity and more. Approve from the notch or your Lock Screen.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6919 stars

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
                    providerModelFetchError[provider] = provider == .ollama
                        ? "No models yet. Download one in Ollama first."
                        : "No models yet. Download one in LM Studio first."
                ca
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
        for a in approvals.entries where a.pillId == pill {
            waiting[Self.boardKey(a.sessionId, pill: pill, cwd: a.cwd)] = .approval
        }

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

### Incident Patch 1: `861d443d` (2026-11-02)
**Commit Message**: Windows and Linux: the closed island always wakes, Mochi lives in it, and a forgotten call stops by itself

A cursor-poll tick still running as the island folded could make the
folded window click-through again after set_collapsed made it take the
mouse: nothing could ever wake the island (the closed island froze, and
before it the wake strip vanished). The poll now stops before the window
folds, sets click-through only under the gate's lock while it is open,
and, folded, glances at the cursor four times a second and wakes the
island itself when it is on it.

Mochi in the closed island blinks and looks around every few seconds, as
on a Mac without a notch, with the loop asleep in between.

A call left recording ran the microphone and Parakeet for hours (8 h in
one log), then took as long again to write. It now stops by itself after
15 minutes with nobody speaking, or after 4 hours, and says so.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `windows/src-tauri/src/island.rs` (modified, +46/-1)
```diff
@@ -114,6 +114,16 @@ impl PollGate {
         }
     }
 
+    /// Waits until the gate opens or `timeout` passes; true when it is open.
+    pub(crate) fn wait_active_for(&self, timeout: Duration) -> bool {
+        let guard = self.active.lock().unwrap();
+        if *guard {
+            return true;
+        }
+        let (guard, _) = self.cv.wait_timeout(guard, timeout).unwrap();
+        *guard
+    }
+
     pub(crate) fn is_active(&self) -> bool {
         *self.active.lock().unwrap()
     }
@@ -491,13 +501,26 @@ pub fn spawn_cursor_poll(app: AppHandle, gate: Arc<PollGate>) {
         // find no cursor costs CPU for nothing.
         let (period, screen_every) = if platform::CURSOR_POLL { (16, 30) } else { (500, 1) };
         loop {
-            gate.wait_until_active();
+            // Parked. Folded on Windows, a glance at the cursor four times a
+            // second: on the closed island, it is told to wake up, whether or
+            // not the webview delivers the pointer to such a small window.
+            loop {
+                if gate.wait_active_for(Duration::from_millis(250)) {
+                    break;
+                }
+                if platform::CURSOR_POLL && gate.collapsed.load(Ordering::Relaxed) {
+                    wake_if_hovered(&app, &gate);
+                }
+            }
             let mut last = (f64::MIN, f64::MIN);
             let mut ticks: u32 = 0;
             // The cursor was far at the last tick, and the page has been told.
             let mut far = false;
             while gate.is_active() {
                 std::thread::sleep(Duration::from_millis(if far { FAR_PERIOD_MS } else { period }));
+                if !gate.is_active() {
+                    break;
+                }
 
                 // Monitors get plugged in, unplugged, rearranged and rescaled, and
                 // an island pinned to coordinates that no longer exist is an island
@@ -565,6 +588,14 @@ pub fn spawn_cursor_poll(app: AppHandle, gate: Arc<PollGate>) {
 
                 let accept = on_island || dragging;
                 if gate.ignoring.load(Ordering::Relaxed) == accept {
+                    // Under the gate's lock, and only while it is open: a tick
+                    // still running as the island folds must not make the
+                    // closed island click-through after set_collapsed made it
+                    // take the mouse — nothing would ever wake it again.
+                    let active = gate.active.lock().unwrap();
+                    if !*active {
+                        break;
+                    }
                     gate.ignoring.store(!accept, Ordering::Relaxed);
                     let _ = win.set_ignore_cursor_events(!accept);
                 }
@@ -581,6 +612,20 @@ pub fn spawn_cursor_poll(app: AppHandle, gate: Arc<PollGate>) {
     });
 }
 
+/// The cursor is on the folded window: it takes the mouse, and the page hears
+/// `closed-hover` (it opens the compact island).
+fn wake_if_hovered(app: &AppHandle, gate: &PollGate) {
+    let Some(win) = window(app) else { return };
+    let (Ok(origin), Ok(size), Some((cx, cy))) = (win.outer_position(), win.inner_size(), cursor_physical()) else { return };
+    let x = cx - origin.x as f64;
+    let y = cy - origin.y as f64;
+    if x >= 0.0 && y >= 0.0 && x <= size.width as f64 && y <= size.height as f64 + 2.0 {
+        gate.ignoring.store(false, Ordering::Relaxed);
+        let _ = win.set_ignore_cursor_events(false);
+        let _ = win.emit("closed-hover", ());
+    }
+}
+
 /// Re-applies click-through after the window or the island changed shape.
 ///
 /// With the cursor poll (Windows) the window takes the mouse again and the next
```

**File**: `windows/src-tauri/src/lib.rs` (modified, +5/-0)
```diff
@@ -172,6 +172,11 @@ fn set_collapsed(app: AppHandle, shared: State<Shared>, collapsed: bool, width:
     // An older page sends no size: the wake strip, as before.
     let size = island::clamp_collapsed((width.unwrap_or(island::STRIP_W), height.unwrap_or(island::STRIP_H)));
     *shared.gate.collapsed_size.lock().unwrap() = size;
+    // The poll stops first: a tick of it after this could make the closed
+    // island click-through again (see spawn_cursor_poll).
+    if collapsed {
+        shared.gate.set_active(false);
+    }
     island::apply_geometry(&app, &pref, collapsed.then_some(size));
     // The closed island must always take the mouse, and a resize invalidates the flag.
     island::refresh_click_through(&app, &shared.gate);
```

**File**: `windows/src-tauri/src/notes/mod.rs` (modified, +52/-0)
```diff
@@ -337,8 +337,24 @@ fn spawn_live(
     stop: Arc<AtomicBool>,
 ) {
     std::thread::spawn(move || {
+        let started = std::time::Instant::now();
+        let mut last_words = std::time::Instant::now();
         while !stop.load(Ordering::Relaxed) {
             std::thread::sleep(Duration::from_secs(1));
+            // A call left recording by mistake keeps the microphone and the
+            // voice model busy for hours, then takes as long again to write:
+            // it stops by itself after a long silence, or a very long call.
+            if let Some(why) = auto_stop(started.elapsed(), last_words.elapsed()) {
+                crate::log::line(format!("notes: stopped by itself ({why:?})"));
+                // `stop` here is the live loop's flag: the module's function.
+                crate::notes::stop(&app);
+                let text = match why {
+                    AutoStop::Silence => t("Nobody has spoken for 15 minutes: Coucou stopped recording the call."),
+                    AutoStop::Length => t("The call has been recorded for 4 hours: Coucou stopped recording it."),
+                };
+                pill::announce(&app, "mic", "#F7B32B", text, None, 30);
+                break;
+            }
             let mut channels = vec![(mic.clone(), builder::ME)];
             if let Some(s) = &system {
                 channels.push((s.clone(), "others"));
@@ -351,6 +367,7 @@ fn spawn_live(
                 if text.is_empty() || stop.load(Ordering::Relaxed) {
                     continue;
                 }
+                last_words = std::time::Instant::now();
                 let end = start + samples.len() as f64 / speech::SAMPLE_RATE as f64;
                 taker.change(&app, &id, |n| {
                     n.lines.push(Line { id: crate::flow::text::new_id(), speaker: speaker.into(), start, end, text });
@@ -361,6 +378,27 @@ fn spawn_live(
     });
 }
 
+/// Why a call stopped recording by itself.
+#[derive(Debug, Clone, Copy, PartialEq)]
+enum AutoStop {
+    Silence,
+    Length,
+}
+
+/// Longest stretch with nobody speaking, and longest call.
+const SILENCE_LIMIT: Duration = Duration::from_secs(15 * 60);
+const LENGTH_LIMIT: Duration = Duration::from_secs(4 * 3600);
+
+fn auto_stop(recording: Duration, since_words: Duration) -> Option<AutoStop> {
+    if recording >= LENGTH_LIMIT {
+        Some(AutoStop::Length)
+    } else if since_words >= SILENCE_LIMIT {
+        Some(AutoStop::Silence)
+    } else {
+        None
+    }
+}
+
 pub fn stop(app: &AppHandle) {
     let Some(taker) = get(app) else { return };
     let Some(mut rec) = taker.recording.lock().unwrap().take() else { return };
@@ -716,3 +754,17 @@ pub fn notes_export(taker: State<Arc<NoteTaker>>, id: String) -> Result<String,
     crate::platform::reveal_folder(&dir.to_string_lossy());
     Ok(path.to_string_lossy().to_string())
 }
+
+#[cfg(test)]
+mod auto_stop_tests {
+    use super::*;
+
+    #[test]
+    fn a_forgotten_call_stops_by_itself() {
+        let min = |m: u64| Duration::from_secs(m * 60);
+        assert_eq!(auto_stop(min(60), min(2)), None);
+        assert_eq!(auto_stop(min(60), min(15)), Some(AutoStop::Silence));
+        assert_eq!(auto_stop(min(240), min(1)), Some(AutoStop::Length));
+        assert_eq!(auto_stop(min(14), min(14)), None);
+    }
+}
```

**File**: `windows/src/i18n/extra.json` (modified, +30/-0)
```diff
@@ -7488,6 +7488,36 @@
       "tr": "Çalan şarkı",
       "ko": "재생 중인 음악",
       "ja": "再生中の曲"
+    },
+    "Nobody has spoken for 15 minutes: Coucou stopped recording the call.": {
+      "zh-Hans": "已有 15 分钟没人说话：Coucou 已停止录制通话。",
+      "hi": "15 मिनट से कोई नहीं बोला: Coucou ने कॉल की रिकॉर्डिंग रोक दी।",
+      "es": "Nadie ha hablado en 15 minutos: Coucou dejó de grabar la llamada.",
+      "ar": "لم يتحدث أحد منذ 15 دقيقة: أوقف Coucou تسجيل المكالمة.",
+      "fr": "Personne n'a parlé depuis 15 minutes : Coucou a arrêté d'enregistrer l'appel.",
+      "bn": "১৫ মিনিট ধরে কেউ কথা বলেনি: Coucou কলের রেকর্ডিং বন্ধ করেছে।",
+      "pt-BR": "Ninguém fala há 15 minutos: o Coucou parou de gravar a chamada.",
+      "ru": "Уже 15 минут никто не говорит: Coucou остановил запись звонка.",
+      "id": "Tidak ada yang bicara selama 15 menit: Coucou berhenti merekam panggilan.",
+      "de": "Seit 15 Minuten hat niemand gesprochen: Coucou hat die Aufnahme des Anrufs beendet.",
+      "tr": "15 dakikadır kimse konuşmadı: Coucou aramayı kaydetmeyi durdurdu.",
+      "ko": "15분 동안 아무도 말하지 않아 Coucou가 통화 녹음을 멈췄습니다.",
+      "ja": "15 分間だれも話していないため、Coucou は通話の録音を止めました。"
+    },
+    "The call has been recorded for 4 hours: Coucou stopped recording it.": {
+      "zh-Hans": "通话已录制 4 小时：Coucou 已停止录制。",
+      "hi": "कॉल 4 घंटे से रिकॉर्ड हो रही थी: Coucou ने रिकॉर्डिंग रोक दी।",
+      "es": "La llamada lleva 4 horas grabándose: Coucou dejó de grabarla.",
+      "ar": "استمر تسجيل المكالمة 4 ساعات: أوقف Coucou التسجيل.",
+      "fr": "L'appel est enregistré depuis 4 heures : Coucou a arrêté l'enregistrement.",
+      "bn": "কলটি ৪ ঘণ্টা ধরে রেকর্ড হচ্ছিল: Coucou রেকর্ডিং বন্ধ করেছে।",
+      "pt-BR": "A chamada está sendo gravada há 4 horas: o Coucou parou de gravá-la.",
+      "ru": "Звонок записывается уже 4 часа: Coucou остановил запись.",
+      "id": "Panggilan sudah direkam selama 4 jam: Coucou berhenti merekamnya.",
+      "de": "Der Anruf wurde 4 Stunden lang aufgenommen: Coucou hat die Aufnahme beendet.",
+      "tr": "Arama 4 saattir kaydediliyor: Coucou kaydı durdurdu.",
+      "ko": "통화를 4시간 동안 녹음해 Coucou가 녹음을 멈췄습니다.",
+      "ja": "通話を 4 時間録音したため、Coucou は録音を止めました。"
     }
   }
 }
```

**File**: `windows/src/island/island.ts` (modified, +45/-1)
```diff
@@ -75,6 +75,11 @@ export class Island {
   private closedKey = "";
   /** Width of the closed island for what it shows now. */
   private closedW = 120;
+  /** Mochi's little life in the closed island: where he looks, and until when
+   *  the loop runs for what he is doing (a blink, a glance). */
+  private closedLook = { x: 0, y: 0 };
+  private closedAwakeUntil = 0;
+  private closedLife: number | null = null;
   /** The size the window was last folded to, so a new one is only sent on a change. */
   private collapsedTo = { w: 0, h: 0 };
   private countdown!: HTMLElement;
@@ -449,6 +454,7 @@ export class Island {
     // Folding all the way: the closed island's width for what it will show.
     if (mode === "hidden") this.updateClosed();
     else this.closedEl.classList.remove("on");
+    this.scheduleClosedLife();
     this.updateWindowCollapsed();
     this.animateGeometry(modeOrder(mode) < modeOrder(prev));
     State.notify();
@@ -841,6 +847,39 @@ export class Island {
     }
   }
 
+  /**
+   * Mochi in the closed island now and then blinks or glances around, as he
+   * does on a Mac without a notch: a few frames every few seconds, the loop
+   * asleep in between. Nothing runs for the other closed islands.
+   */
+  private scheduleClosedLife() {
+    if (this.closedLife != null) window.clearTimeout(this.closedLife);
+    this.closedLife = null;
+    if (State.mode !== "hidden" || closedIsland(State.settings.closedIsland) !== "mochi") {
+      this.closedLook = { x: 0, y: 0 };
+      return;
+    }
+    this.closedLife = window.setTimeout(() => {
+      this.closedLife = null;
+      if (State.mode !== "hidden" || State.paused) return this.scheduleClosedLife();
+      if (Math.random() < 0.55) {
+        this.engine.blink();
+      } else {
+        this.closedLook = { x: (Math.random() * 2 - 1) * 0.8, y: (Math.random() * 2 - 1) * 0.3 };
+      }
+      this.closedAwakeUntil = performance.now() + 700;
+      this.ensureRunning();
+      this.scheduleClosedLife();
+    }, 2500 + Math.random() * 3500);
+  }
+
+  /** The pointer is on the folded window (Rust's `closed-hover`): the island wakes. */
+  wakeFromClosed() {
+    if (State.mode !== "hidden") return;
+    Sound.resume();
+    this.fsm.mouseEntered();
+  }
+
   /** Tells Rust the folded window's size: the closed island's, or none (the strip). */
   private sendCollapsedSize(force = false) {
     const size = this.closedShows ? { w: this.closedW, h: CLOSED_H } : { w: 0, h: 0 };
@@ -1178,7 +1217,8 @@ export class Island {
     const botMoving = !this.botCx.settled || !this.botCy.settled || !this.botSize.settled;
     // Closed, only the folding — and Mochi reaching his place in the closed island.
     const busy = State.mode === "hidden"
-      ? settling || (botMoving && closedIsland(State.settings.closedIsland) === "mochi")
+      ? settling || (closedIsland(State.settings.closedIsland) === "mochi" &&
+        (botMoving || nowMs < this.closedAwakeUntil))
       : settling ||
         !this.botCx.settled || !this.botCy.settled || !this.botSize.settled ||
         greetingActive || this.engine.busy || UploadSeq.isActive || viewAnimating;
@@ -1304,12 +1344,15 @@ export class Island {
 
   /** BotCanvasView.lookX / lookY — tanh of the distance to the bot. */
   private lookX(): number {
+    // In the closed island the cursor isn't followed: he looks around by himself.
+    if (State.mode === "hidden") return this.closedLook.x;
     const rect = this.islandRect();
     const botScreenX = rect.x + this.botCx.value;
     return Math.tanh((State.mouse.x - botScreenX) / 260);
   }
 
   private lookY(): number {
+    if (State.mode === "hidden") return this.closedLook.y;
     return -Math.tanh((State.mouse.y - this.botCy.value) / 200);
   }
 
@@ -1425,6 +1468,7 @@ export class Island {
       this.animateGeometry(true);
       if (this.collapsed) this.sendCollapsedSize();
     }
+    this.scheduleClosedLife();
     Sound.setEnabled(State.settings.soundEnabled);
     Sound.setVolume(State.settings.soundVolume);
     this.fsm.homeToPetitDelay = State.settings.autoCloseInterval;
```

**File**: `windows/src/main.ts` (modified, +1/-0)
```diff
@@ -63,6 +63,7 @@ async function main() {
 
   await onEvent<{ x: number; y: number }>("cursor", ({ x, y }) => island.onCursor(x, y));
   await onEvent<boolean>("pointer-inside", (inside) => island.setPointerInside(inside));
+  await onEvent<null>("closed-hover", () => island.wakeFromClosed());
 
   /** Pause has to reach Rust too, or the pollers keep calling out. */
   const setPaused = (on: boolean) => {
```

---

### Incident Patch 2: `f61c428c` (2026-11-03)
**Commit Message**: Release prep: Windows and Linux 0.5.9

The island never disappears (Mochi or the time when closed, ✕ to fold),
dictation keeps your language, any dictation key, silence while you speak
on Windows, the Coucou window comes alive, a forgotten call stops by
itself; Claude API models (#1000) and Flow saves (#1003) by @lazarevtill.
CHANGELOG, README and What's new in the 14 languages.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -1,5 +1,18 @@
 # Changelog
 
+## Windows and Linux 0.5.9 — November 3, 2026
+
+- **The island never disappears** — once closed, a small island stays at the top of the screen, as on a Mac without a notch: Mochi in it (he blinks and looks around), or the time, the date, your Claude usage or what's playing (Settings → General → Closed island shows). Hovering it brings the compact island, and it always wakes up again
+- **✕ folds the open island** — at the top right, as on the Mac, with the Mac's icons in the header; the Claude plan card fills its card again
+- **Dictation keeps your language** — it no longer starts in English and switches mid-sentence when you speak right away
+- **Your own dictation key** — Left Ctrl, Left Alt and Left Shift join the list, or record a shortcut of your own (Alt + Shift + F, F9…). On Windows its letter no longer reaches the app in front, and a held Alt or Win opens no menu
+- **Silence while you speak** *(Windows)* — videos, music and calls go quiet while Coucou listens to you, then come back (Flow → Settings → Microphone)
+- **The Coucou window comes alive on Windows** — the particles and the little Mochis of each page now show, on the deep black, and follow your voice while you dictate; thin scrollbars without arrows, one box for the settings search
+- **A forgotten call stops by itself** — the Notetaker stops recording after 15 minutes with nobody speaking, or after 4 hours
+- **Lighter on the processor** — the island no longer follows a cursor that is far from it, and the closed island polls nothing
+- **Claude API models** — the model picker lists your account's models and keeps your choice (#1000 by @lazarevtill)
+- **Flow keeps your edits** — a dictionary, snippet, style or history change that can't be saved says so and lets you retry (#1003 by @lazarevtill)
+
 ## 0.5.8 — October 31, 2026
 
 Fixes by @Ohualtex.
```

**File**: `README.md` (modified, +3/-2)
```diff
@@ -181,6 +181,7 @@ Windows and Linux are released together, under the `windows-v*` and `linux-v*` t
 
 | Windows & Linux | Date | Highlights |
 |---------|------|------------|
+| 0.5.9 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.9) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.9) | Nov 3, 2026 | The island never disappears (Mochi or the time when closed), ✕ to fold it, dictation keeps your language, your own dictation key, silence while you speak |
 | 0.5.8 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.8) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.8) | Oct 31, 2026 | 14 fixes and features by @Ohualtex: permission requests queue, Claude Desktop cards and pill, plan usage in the compact island, Flow pill in a corner |
 | 0.5.7 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.7) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.7) | Oct 31, 2026 | Mail with classic Outlook on Windows: search, filters, automatic sorting, mail plans from the chat; search the settings |
 | 0.5.6 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.6) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.6) | Oct 30, 2026 | Chat on your own AI subscription (Claude Code, Antigravity, Gemini CLI, Codex, Cursor, Copilot); Korean and Japanese |
@@ -262,7 +263,7 @@ Download **[Coucou-Windows.msi](https://github.com/Louis-CFM/coucou/releases/dow
 
 This is only because the app isn't signed with a paid certificate yet. Coucou is open source, and Microsoft Defender scans the installer as clean.
 
-**Windows and Linux 0.5.8** bring 14 fixes and features by @Ohualtex: permission requests wait their turn, Claude Desktop cards on Windows and its pill on Linux, plan usage in the compact island. **0.5.7** bring **Mail** to Windows with classic Outlook (search, automatic sorting, mail plans from the chat) and a search field for the settings. **0.5.6** chat on your own AI subscription (Claude Code, Antigravity, Gemini CLI, Codex, Cursor, Copilot) and speak Korean and Japanese. **0.5.5** answer on your Claude plan through Claude Code when no API key is saved. **0.5.4** bring 25 reliability fixes from the community. **0.5.3** bring **WhatsApp** to the island (experimental), with the gateway installed in one click. **0.5.2** turn Mochi blue when a new version waits and show what it brings after the update; they add **GitLab and Gitea** pills. **0.5.1** tell you when a new version is out (once you agree) and, on Windows, install it in one click; they also speak German and Turkish. **0.5.0** caught up with the Mac: Coucou is now an app with its own window in the taskbar, **Flow dictation** anywhere (hold right Ctrl, speak, let go) with Parakeet running offline on your computer, the **Notetaker** for your calls, and **« OK Coucou »** to talk to Mochi, powered by Claude with your key. On Linux, dictation works on X11 and Wayland. 0.4.0 paired with [Coucou for Android](#coucou-for-android): approve, answer and chat from your Android phone (Settings → Android phone, off by default). 0.3.0 added open on hover, your own sounds, a colour of your own for each Mochi and the Mochi-to-desktop shortcut; on Linux, the Spotify pill with Mochi dancing to it, global shortcuts on Wayland and "Open terminal" that brings the terminal forward. 0.2.0 caught up with the Mac: Codex, Copilot CLI, Muse Code and six more agents with approvals from the island, answers to Claude's questions, live diffs, GitHub pull requests and CI, plan usage, local models, the wardrobe, Mochi on the desktop, keyboard shortcuts, the weekly recap and 10 languages. See the [changelog](CHANGELOG.md).
+**Windows and Linux 0.5.9** keep a small island at the top of the screen once it is closed (Mochi, the time or your Claude usage in it), fold it with ✕, keep your language when you dictate, take any dictation key you like and, on Windows, quiet the other apps while you speak. **0.5.8** bring 14 fixes and features by @Ohualtex: permission requests wait their turn, Claude Desktop cards on Windows and its pill on Linux, plan usage in the compact island. **0.5.7** bring **Mail** to Windows with classic Outlook (search, automatic sorting, mail plans from the chat) and a search field for the settings. **0.5.6** chat on your own AI subscription (Claude Code, Antigravity, Gemini CLI, Codex, Cursor, Copilot) and speak Korean and Japanese. **0.5.5** answer on your Claude plan through Claude Code when no API key is saved. **0.5.4** bring 25 reliability fixes from the community. **0.5.3** bring **WhatsApp** to the island (experimental), with the gateway installed in one click. **0.5.2** turn Mochi blue when a new version waits and show what it brings after the update; they add **GitLab and Gitea** pills. **0.5.1** tell you when a new version is out (once you agree) and, on Windows, install it in one click; they also speak Ge
```

**File**: `linux/arch/PKGBUILD` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 pkgname=coucou-git
 _pkgname=coucou
-pkgver=0.5.8
+pkgver=0.5.9
 pkgrel=1
 pkgdesc="Mochi lives at the top of your screen and keeps an eye on your Claude Code sessions"
 arch=('x86_64' 'aarch64')
```

**File**: `windows/Cargo.lock` (modified, +2/-2)
```diff
@@ -804,7 +804,7 @@ dependencies = [
 
 [[package]]
 name = "coucou"
-version = "0.5.8"
+version = "0.5.9"
 dependencies = [
  "arboard",
  "cpal",
@@ -841,7 +841,7 @@ dependencies = [
 
 [[package]]
 name = "coucou-hook"
-version = "0.5.8"
+version = "0.5.9"
 dependencies = [
  "libc",
  "serde_json",
```

**File**: `windows/Cargo.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ members = ["src-tauri", "hook"]
 resolver = "2"
 
 [workspace.package]
-version = "0.5.8"
+version = "0.5.9"
 edition = "2021"
 license = "MIT"
 
```

**File**: `windows/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "coucou-windows",
-  "version": "0.5.8",
+  "version": "0.5.9",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "coucou-windows",
-      "version": "0.5.8",
+      "version": "0.5.9",
       "dependencies": {
         "@tauri-apps/api": "^2"
       },
```

**File**: `windows/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "coucou-windows",
   "private": true,
-  "version": "0.5.8",
+  "version": "0.5.9",
   "type": "module",
   "scripts": {
     "dev": "vite",
```

**File**: `windows/src-tauri/tauri.conf.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "$schema": "https://schema.tauri.app/config/2",
   "productName": "Coucou",
-  "version": "0.5.8",
+  "version": "0.5.9",
   "identifier": "fr.louisraille.coucou",
   "build": {
     "beforeDevCommand": "npm run dev",
```

---

### Incident Patch 3: `968710a7` (2026-11-02)
**Commit Message**: Windows and Linux: dictation keeps its language from the first word; one box for the settings search

A dictation starts the moment the key goes down: the microphone opens
with a click and the first word is already under way. Parakeet, which
guesses the language by itself, then often started in English and went
on mixing ('Okay, that marche plutôt bien. Moi, le truc is that…'). Each
stretch now reaches the model with half a second of silence before it and
a little after, as a call always has, and stays in the language spoken.
Word times are shifted back, so the Notetaker's timeline is unchanged.

The window's text-field style drew a second box inside the sidebar's
search field.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `windows/src-tauri/src/speech/mod.rs` (modified, +58/-3)
```diff
@@ -338,6 +338,26 @@ pub struct Transcript {
 /// quietest, near this length.
 const MAX_CHUNK_SECONDS: f64 = 28.0;
 
+/// Silence given to the model before and after each stretch, in samples.
+///
+/// A dictation starts the moment the key goes down: the microphone opens with
+/// a little click and the first word is already under way. Parakeet, which
+/// guesses the language by itself, then often starts in English and keeps
+/// going ("Okay, that marche plutôt bien. Moi, le truc is that…"). Half a
+/// second of silence first, as a call always has, and it hears the language
+/// that is spoken (tests: `a_sudden_start_keeps_its_language`).
+const LEAD_SILENCE: usize = SAMPLE_RATE as usize / 2;
+const TAIL_SILENCE: usize = SAMPLE_RATE as usize * 3 / 10;
+
+/// `chunk` between the silences the model is given it with.
+pub fn padded(chunk: &[f32]) -> Vec<f32> {
+    let mut out = Vec::with_capacity(LEAD_SILENCE + chunk.len() + TAIL_SILENCE);
+    out.resize(LEAD_SILENCE, 0.0);
+    out.extend_from_slice(chunk);
+    out.resize(out.len() + TAIL_SILENCE, 0.0);
+    out
+}
+
 /// Transcribes 16 kHz mono audio.
 pub fn transcribe(samples: &[f32]) -> Option<Transcript> {
     let rec = recognizer()?;
@@ -347,11 +367,19 @@ pub fn transcribe(samples: &[f32]) -> Option<Transcript> {
             continue;
         }
         let stream = rec.create_stream();
-        stream.accept_waveform(SAMPLE_RATE as i32, chunk);
+        let audio = padded(chunk);
+        stream.accept_waveform(SAMPLE_RATE as i32, &audio);
         rec.decode(&stream);
         let Some(result) = stream.get_result() else { continue };
-        let start = offset as f64 / SAMPLE_RATE as f64;
-        let words = words_from_tokens(&result.tokens, result.timestamps.as_deref().unwrap_or(&[]), start, chunk.len() as f64 / SAMPLE_RATE as f64);
+        // The words' times count from the start of the silence: take it off.
+        let start = (offset as f64 - LEAD_SILENCE as f64) / SAMPLE_RATE as f64;
+        let mut words = words_from_tokens(&result.tokens, result.timestamps.as_deref().unwrap_or(&[]), start, audio.len() as f64 / SAMPLE_RATE as f64);
+        // A word the model places a hair into the silence starts with the audio.
+        let from = offset as f64 / SAMPLE_RATE as f64;
+        for w in &mut words {
+            w.start = w.start.max(from);
+            w.end = w.end.max(w.start);
+        }
         let text = result.text.trim();
         if !text.is_empty() {
             if !out.text.is_empty() {
@@ -459,6 +487,33 @@ mod tests {
 /// With the models downloaded: `COUCOU_TEST_WAV=… cargo test -- --ignored speech`.
 #[cfg(test)]
 mod with_models {
+    #[test]
+    fn the_model_hears_silence_around_the_words() {
+        let chunk = vec![0.5f32; 1000];
+        let audio = super::padded(&chunk);
+        assert_eq!(audio.len(), super::LEAD_SILENCE + 1000 + super::TAIL_SILENCE);
+        assert!(audio[..super::LEAD_SILENCE].iter().all(|&s| s == 0.0));
+        assert_eq!(&audio[super::LEAD_SILENCE..super::LEAD_SILENCE + 1000], &chunk[..]);
+        assert!(audio[super::LEAD_SILENCE + 1000..].iter().all(|&s| s == 0.0));
+    }
+
+    /// A dictation that starts with the microphone's click and the first word
+    /// already under way (a French one, from `COUCOU_SUDDEN_WAV`, 16 kHz):
+    /// Parakeet used to write half of it in English.
+    /// `cargo test -p coucou --lib a_sudden_start -- --ignored --nocapture`
+    #[test]
+    #[ignore]
+    fn a_sudden_start_keeps_its_language() {
+        let path = std::env::var("COUCOU_SUDDEN_WAV").expect("COUCOU_SUDDEN_WAV");
+        let samples = super::audio::read_wav(std::path::Path::new(&path)).unwrap();
+        let t = super::transcribe(&samples).expect("models");
+        println!("{}", t.text);
+        let english = ["that", "is", "for", "it", "when", "the"];
+        let words: Vec<String> = t.text.split(|c: char| !c.is_alphabetic()).map(str::to_lowercase).collect();
+        assert!(!words.iter().any(|w| english.contains(&w.as_str())), "{}", t.text);
+        assert!(t.words.first().is_some_and(|w| w.start >= 0.0));
+    }
+
     #[test]
     #[ignore]
     fn transcribes_a_recording() {
```

**File**: `windows/src/hub/hub.css` (modified, +14/-0)
```diff
@@ -96,6 +96,20 @@ body.hub-window {
   padding: 0;
 }
 
+/* The window's text fields (settings.css, input[type="text"]) weigh more than
+   one class and drew a second box inside this one: the field is the box. */
+.hub-search .hub-search-input,
+.hub-search .hub-search-input:focus {
+  border: 0;
+  background: transparent;
+  box-shadow: none;
+  outline: none;
+  height: auto;
+  padding: 0;
+  margin: 0;
+  border-radius: 0;
+}
+
 .hub-search-input::placeholder {
   color: var(--hub-muted);
 }
```

#### Recent Merged Pull Requests:
- **PR #1052** (2026-11-03): Flow (Mac): mute while dictating, Copy card, custom shortcut (@Louis-CFM)
- **PR #1050** (closed): Volume and brightness keys in the notch, with Mochi (GitHub build) Feature/system hud (@CristianMusto)
- **PR #1048** (2026-11-03): Windows and Linux 0.5.9: the island never disappears, dictation keeps your language, your own key, silence while you speak (@Louis-CFM)
- **PR #1033** (2026-10-31): Windows and Linux: Claude API models and Flow save errors (#1000, #1003 by @lazarevtill) (@Louis-CFM)
- **PR #1020** (closed): File shelf: dropped files wait in the notch (@CyberAakash)
- **PR #1019** (2026-10-31): App Store 2.0 — Mac and iPhone (@Louis-CFM)

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

## X. Windows and Linux: the closed island always wakes, Mochi lives in it, and a forg

**RULE**:
When implementing operations in `windows/src-tauri/src/island.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Louis-CFM/coucou. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `861d443d`: Windows and Linux: the closed island always wakes, Mochi lives in it, and a forgotten call stops by itself. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `windows/src-tauri/src/island.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Waits until the gate opens or `timeout` passes; true when it is open.
    pub(crate) fn wait_active_for(&self, timeout: Duration) -> bool {
        let guard = self.active.lock().unwrap();
        if *guard {
            return true;
        }
        let (guard, _) = self.cv.wait_timeout(guard, timeout).unwrap();
        *guard
    }

            // Parked. Folded on Windows, a glance at the cursor four times a
            // second: on the closed island, it is told to wake up, whether or
            // not the webview delivers the pointer to such a small window.
            loop {
                if gate.wait_active_for(Duration::from_millis(250)) {
                    break;
                }
                if platform::CURSOR_POLL && gate.collapsed.load(Ordering::Relaxed) {
                    wake_if_hovered(&app, &gate);
                }
            }
                if !gate.is_active() {
                    break;
                }
                    // Under the gate's lock, and only while it is open: a tick
                    // still running as the island folds must not make the
                    // closed island click-through after set_collapsed made it
  
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
            gate.wait_until_active();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `861d443d` are properly handled with clean fallback behavior.
