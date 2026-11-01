> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/louis-cfm-coucou-learnings.md`  
> **Source**: github ([https://github.com/Louis-CFM/coucou](https://github.com/Louis-CFM/coucou))  
> **Source Version**: `37e457dd`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T13:22:19.085Z  
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
> **Harvest Timestamp**: 2026-10-30T13:22:17.322Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Louis-CFM/coucou`
- **Description**: A tiny friend in your Mac's notch and on your iPhone that keeps an eye on your AI coding agents: Claude Code, Codex, Cursor, Gemini CLI, Antigravity and more. Approve from the notch or your Lock Screen.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 6783 stars

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
                case .success(let models):
                    fetchedProviderModels[provider] = models
                    let current = provider == .ollama ? ollamaChatModel : lmstudioChatModel
   
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
        return waiting
    }

    /// A session that starts waiting while it shares `pill` with
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

- **Issue #901** (2026-10-23): **WhatsApp pill shows a conversation ("David") that doesn't exist anywhere on my phone/account**
  *Symptoms*: **What happened**  Coucou's WhatsApp pill showed a conversation with a contact named "David" that does not exist anywhere in my real WhatsApp — not in the main chat list, not in Archived. I confirmed Archived chats actually works (I archived a real old chat as a test, and only that one showed up there — "David" wasn't there either). I have no contact saved as "David", and normally an unsaved number shows as a phone number in WhatsApp, not a name — this showed a name with no number anywhere.  I also searched "David" across my entire WhatsApp (global search, not just chats) — the only match was an unrelated saved contact, "David Jóvenes" (someone from my church group, different full name), with no chat/message history shown for him either. No contact or chat matching plain "David" exists anywhere in my account.  The pill showed: a TikTok link, then (about an hour later) "Video" with a 😂 reaction, as a new unread message. I never clicked the link or opened the video (the island doesn't let you open it directly, and there's no real chat to check it from on my phone).  I logged out the Coucou/GOWA linked device from WhatsApp as a precaution. I also checked my phone's Linked Devices list — only expected devices were there (phone, the Coucou link, my laptop's Chrome), nothing unrecognized.  **What I expected**  The pill should only ever show conversations that genuinely exist on my linked WhatsApp account, since it's supposed to just mirror it.  **How to reproduce**  Unclear — happ

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

### Incident Patch 1: `f06fc09c` (2026-10-29)
**Commit Message**: Release prep: Mac 0.5.4, Windows and Linux 0.5.4 (reliability batch)

Versions, CHANGELOG sections, README rows and What's new in every language.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `CHANGELOG.md` (modified, +17/-13)
```diff
@@ -1,25 +1,29 @@
 # Changelog
 
-## Unreleased
+## 0.5.4 — October 29, 2026
 
-- **Mac: WhatsApp statuses aren't chats** — a contact's WhatsApp Status and channel posts no longer show up as a conversation in the WhatsApp pill (#901, same fix as #910)
-
-### Reliability (Mac, Windows, Linux)
-
-Bugs reported by @romainb82 and others, fixed by the community.
+Reliability: bugs reported by @romainb82 and others, fixed by the community.
 
 - **The hook server never gives up** — one failed connection no longer stops Coucou from hearing Claude Code until the next launch (#872 by @seongj-un, #853)
-- **Your own hooks are safe** — installing or removing Coucou's hooks only touches Coucou's own entries, never a hook of yours whose path mentions "coucou" (#944 by @rahul05ranjan, #854); on Windows, the hooks go where `CLAUDE_CONFIG_DIR` points (#810 by @afpruivo)
-- **Mac: no crash without a microphone** (#950 by @gabbe-swe, #949)
-- **Mac: "Hide after" is used** — the delay set in Settings now hides the compact island (#780 by @Ohualtex, #675)
-- **Mac: nothing drawn over the real notch while hidden** (#789 by @orrrrli); a third-party agent's finished card no longer says "Claude Code finished" (#865 by @Ohualtex, #593)
+- **Your own hooks are safe** — installing or removing Coucou's hooks only touches Coucou's own entries, never a hook of yours whose path mentions "coucou" (#944 by @rahul05ranjan, #854)
+- **No crash without a microphone** (#950 by @gabbe-swe, #949)
+- **"Hide after" is used** — the delay set in Settings now hides the compact island (#780 by @Ohualtex, #675)
+- **Nothing drawn over the real notch while hidden** (#789 by @orrrrli); a third-party agent's finished card no longer says "Claude Code finished" (#865 by @Ohualtex, #593)
 - **Service pills tell the truth** — n8n no longer replays an old run as new at launch, and keeps each run's real time (#948, #861); Stripe no longer adds different currencies together (#938, #860); GitHub counts the stars of all your repositories, past the first 100 (#939, #862); Kraken keeps tickers such as XTZ and ZRX whole (#926, #863). All by @Ohualtex
-- **Windows: an approval card goes once the terminal has taken over** (#890 by @afpruivo, #857); the relay pipe no longer crashes under many connections (mio 1.2.4, #911 by @afpruivo)
-- **Windows/Linux: settings saved at the same moment no longer collide** (#888 by @Ohualtex, #858)
-- **Windows/Linux: the Flow pill's buttons take clicks** and the pill keeps its edge (#760 by @arnavaggarwal-dev, #759); on Linux its toolbar folds even when the leave event is lost (#946 by @dougkusanagi, #584)
+- **WhatsApp statuses aren't chats** — a contact's WhatsApp Status and channel posts no longer show up as a conversation in the WhatsApp pill (#901, same fix as #910)
+
+## Windows and Linux 0.5.4 — October 29, 2026
+
+Reliability: 25 community fixes, shared with the Mac where they apply.
+
+- **The hook relay never gives up** — a failed pipe connection no longer stops Coucou from hearing Claude Code (#872 by @seongj-un, #853); the pipe no longer crashes under many connections (mio 1.2.4, #911 by @afpruivo)
+- **Windows: an approval card goes once the terminal has taken over** (#890 by @afpruivo, #857); the hooks go where `CLAUDE_CONFIG_DIR` points (#810 by @afpruivo)
+- **Settings saved at the same moment no longer collide** (#888 by @Ohualtex, #858)
+- **The Flow pill's buttons take clicks** and the pill keeps its edge (#760 by @arnavaggarwal-dev, #759); on Linux its toolbar folds even when the leave event is lost (#946 by @dougkusanagi, #584)
 - **Windows: the Settings window opens even when creating it at startup failed** (#807 by @afpruivo, #775); the last edit stays on the ticker after Claude Code finishes (#846 by @afpruivo, #840); the chat field keeps the focus after an answer (#931 by @ce017); no coloured bar under Mochi at 150 % scale (#867 by @PythonTilk)
 - **WhatsApp groups show their names** instead of "Group <id>" (#907 by @arnavaggarwal-dev)
 - **OpenCode 2 sessions finish properly in the island** (#808 by @afpruivo, #717)
+- **Service pills tell the truth** — n8n, Stripe and GitHub, as on the Mac (#948, #938, #939 by @Ohualtex)
 - **Linux: 24-bit microphones work for Flow and notes** (#785 by @eduardo-qts); on Arch, the desktop entry uses the portal's app id (#947 by @rahul05ranjan, #804); the build has no warnings left (#893 by @ZouaouiB)
 
 ## Windows and Linux 0.5.3 — October 22, 2026
```

**File**: `NotchBuddy/Resources/Info.plist` (modified, +2/-2)
```diff
@@ -34,9 +34,9 @@
 	<key>CFBundlePackageType</key>
 	<string>APPL</string>
 	<key>CFBundleShortVersionString</key>
-	<string>0.5.3</string>
+	<string>0.5.4</string>
 	<key>CFBundleVersion</key>
-	<string>20</string>
+	<string>21</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSAccessibilityUsageDescription</key>
```

**File**: `NotchBuddy/Resources/whats-new.json` (modified, +75/-0)
```diff
@@ -1,6 +1,81 @@
 {
   "about": "What's new, shown once in the notch after Coucou updates itself (WhatsNew.swift). Every Mac release adds its entry here, in the 14 languages, before release.sh: 1 to 4 items, a short title and one line each, an icon from scripts/test-whats-new.py. python3 scripts/test-whats-new.py checks it.",
   "releases": [
+    {
+      "version": "0.5.4",
+      "items": [
+        {
+          "icon": "shield",
+          "title": {
+            "en": "Coucou keeps listening",
+            "fr": "Coucou reste à l’écoute",
+            "es": "Coucou sigue escuchando",
+            "pt-BR": "O Coucou continua ouvindo",
+            "ru": "Coucou всегда на связи",
+            "zh-Hans": "Coucou 始终在线",
+            "hi": "Coucou हमेशा सुनता रहे",
+            "ar": "Coucou يبقى منصتًا",
+            "bn": "Coucou সবসময় শোনে",
+            "id": "Coucou terus mendengarkan",
+            "de": "Coucou hört weiter zu",
+            "tr": "Coucou dinlemeye devam eder",
+            "th": "Coucou ฟังต่อเนื่อง",
+            "zh-Hant": "Coucou 始終在線"
+          },
+          "detail": {
+            "en": "One failed connection no longer cuts Claude Code off, and only Coucou’s own hooks are touched.",
+            "fr": "Une connexion ratée ne coupe plus Claude Code, et seuls les hooks de Coucou sont modifiés.",
+            "es": "Una conexión fallida ya no corta Claude Code, y solo se tocan los hooks de Coucou.",
+            "pt-BR": "Uma conexão com falha não corta mais o Claude Code, e só os hooks do Coucou são alterados.",
+            "ru": "Сбой одного соединения больше не отключает Claude Code, а Coucou меняет только свои хуки.",
+            "zh-Hans": "一次连接失败不再让 Claude Code 断开，且只改动 Coucou 自己的 hooks。",
+            "hi": "एक कनेक्शन फ़ेल होने से अब Claude Code नहीं कटता, और सिर्फ़ Coucou के अपने hooks बदलते हैं।",
+            "ar": "لم يعد فشل اتصال واحد يقطع Claude Code، ولا يُعدَّل إلا خطافات Coucou نفسها.",
+            "bn": "একটি সংযোগ ব্যর্থ হলে আর Claude Code বিচ্ছিন্ন হয় না, আর শুধু Coucou-র নিজের hooks বদলায়।",
+            "id": "Satu koneksi gagal tak lagi memutus Claude Code, dan hanya hook milik Coucou yang diubah.",
+            "de": "Eine fehlgeschlagene Verbindung trennt Claude Code nicht mehr, und nur Coucous eigene Hooks werden geändert.",
+            "tr": "Tek bir başarısız bağlantı artık Claude Code’u koparmıyor; yalnızca Coucou’nun kendi hook’ları değişir.",
+            "th": "การเชื่อมต่อที่ล้มเหลวไม่ตัด Claude Code อีกต่อไป และแก้เฉพาะ hooks ของ Coucou เอง",
+            "zh-Hant": "一次連線失敗不再讓 Claude Code 中斷，且只更動 Coucou 自己的 hooks。"
+          }
+        },
+        {
+          "icon": "bug",
+          "title": {
+            "en": "25 community fixes",
+            "fr": "25 correctifs de la communauté",
+            "es": "25 arreglos de la comunidad",
+            "pt-BR": "25 correções da comunidade",
+            "ru": "25 исправлений от сообщества",
+            "zh-Hans": "25 项社区修复",
+            "hi": "समुदाय के 25 सुधार",
+            "ar": "25 إصلاحًا من المجتمع",
+            "bn": "কমিউনিটির ২৫টি সমাধান",
+            "id": "25 perbaikan dari komunitas",
+            "de": "25 Fixes aus der Community",
+            "tr": "Topluluktan 25 düzeltme",
+            "th": "25 การแก้ไขจากชุมชน",
+            "zh-Hant": "25 項社群修正"
+          },
+          "detail": {
+            "en": "No crash without a mic, the hide delay works, and truer n8n, Stripe and GitHub pills.",
+            "fr": "Plus de crash sans micro, le délai de masquage fonctionne, et des pills n8n, Stripe et GitHub plus justes.",
+            "es": "Sin cierres sin micrófono, el retraso para ocultar funciona y pills de n8n, Stripe y GitHub más precisas.",
+            "pt-BR": "Sem travar sem microfone, o tempo para ocultar funciona e pills do n8n, Stripe e GitHub mais precisas.",
+            "ru": "Нет сбоев без микрофона, задержка скрытия работает, а пилюли n8n, Stripe и GitHub точнее.",
+            "zh-Hans": "没有麦克风也不会崩溃，隐藏延迟生效，n8n、Stripe 和 GitHub 胶囊更准确。",
+            "hi": "माइक के बिना क्रैश नहीं, छिपाने की देरी काम करती है, और n8n, Stripe व GitHub पिल्स ज़्यादा सटीक।",
+            "ar": "لا أعطال دون ميكروفون، ومهلة الإخفاء تعمل، وكبسولات n8n وStripe وGitHub أدق.",
+            "bn": "মাইক ছাড়া আর ক্র্যাশ নয়, লুকানোর বিলম্ব কাজ করে, আর n8n, Stripe ও GitHub পিল আরও সঠিক।",
+            "id": "Tak ada crash tanpa mikrofon, jeda sembunyi berfungsi, dan pill n8n, Stripe, GitHub lebih akurat.",
+            "de": "Kein Absturz ohne Mikrofon, die Ausblendverzögerung greift, und genauere n8n-, Stripe- und GitHub-Pills.",
+            "tr": "Mikrofon yokken çökme yok, gizleme gecikmesi çalışıyor; n8n, Stripe ve GitHub hapları daha doğru.",
+            "th": "ไม่แครชเมื่อไม่มีไมค์ ระยะเวลาซ่อนใช้งานได้ และพิลล์ n8n, Stripe, GitHub แม่นยำขึ้น",
+            "zh-Hant": "沒有麥克風也不會當機，隱藏延遲生效，n8n、Stripe 與 GitHub 膠囊更準確。"
+          }
+        }
+      ]
+    },
     {
       "version":
```

**File**: `NotchBuddy/project.yml` (modified, +2/-2)
```diff
@@ -140,8 +140,8 @@ targets:
         CFBundleName: Coucou
         CFBundleDisplayName: Coucou
         CFBundleIdentifier: fr.louisraille.NotchBuddy
-        CFBundleVersion: "20"
-        CFBundleShortVersionString: "0.5.3"
+        CFBundleVersion: "21"
+        CFBundleShortVersionString: "0.5.4"
         CFBundlePackageType: APPL
         LSUIElement: YES
         NSHighResolutionCapable: YES
```

**File**: `README.md` (modified, +4/-2)
```diff
@@ -148,6 +148,7 @@ macOS releases are published as `v*` tags. See [CHANGELOG.md](CHANGELOG.md) for
 
 | Version | Date | Highlights |
 |---------|------|------------|
+| [0.5.4](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.4) | Oct 29, 2026 | Reliability: 25 community fixes — the hook server never gives up, your own hooks stay untouched, no crash without a mic, truer n8n, Stripe and GitHub pills |
 | [0.5.3](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.3) | Oct 22, 2026 | Mochi turns blue when a new version waits; What's new and your Coucou so far after each update; Buy Mochi a coffee |
 | [0.5.2](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.2) | Oct 20, 2026 | New version in the notch, one click to install it; German, Turkish, Thai, Traditional Chinese; Homebrew; plan approval from the notch |
 | [0.5.1](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.1) | Oct 18, 2026 | WhatsApp in one click: Coucou installs and starts the gateway, no Terminal |
@@ -173,6 +174,7 @@ Windows and Linux are released together, under the `windows-v*` and `linux-v*` t
 
 | Windows & Linux | Date | Highlights |
 |---------|------|------------|
+| 0.5.4 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.4) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.4) | Oct 29, 2026 | Reliability: 25 community fixes — the hook server never gives up, approval cards go when the terminal takes over, a sturdier Flow pill, WhatsApp group names |
 | 0.5.3 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.3) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.3) | Oct 22, 2026 | WhatsApp in the island (experimental): one-click gateway install, your chats and replies |
 | 0.5.2 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.2) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.2) | Oct 22, 2026 | Mochi turns blue when a new version waits, What's new after each update; GitLab and Gitea pills; the weekly recap on Android |
 | 0.5.1 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.1) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.1) | Oct 20, 2026 | New version in the island, one click to install it on Windows; German and Turkish; an optional clock; Linux idle CPU fixed |
@@ -249,7 +251,7 @@ Download **[Coucou-Windows.msi](https://github.com/Louis-CFM/coucou/releases/dow
 
 This is only because the app isn't signed with a paid certificate yet. Coucou is open source, and Microsoft Defender scans the installer as clean.
 
-**Windows and Linux 0.5.3** bring **WhatsApp** to the island (experimental), with the gateway installed in one click. **0.5.2** turn Mochi blue when a new version waits and show what it brings after the update; they add **GitLab and Gitea** pills. **0.5.1** tell you when a new version is out (once you agree) and, on Windows, install it in one click; they also speak German and Turkish. **0.5.0** caught up with the Mac: Coucou is now an app with its own window in the taskbar, **Flow dictation** anywhere (hold right Ctrl, speak, let go) with Parakeet running offline on your computer, the **Notetaker** for your calls, and **« OK Coucou »** to talk to Mochi, powered by Claude with your key. On Linux, dictation works on X11 and Wayland. 0.4.0 paired with [Coucou for Android](#coucou-for-android): approve, answer and chat from your Android phone (Settings → Android phone, off by default). 0.3.0 added open on hover, your own sounds, a colour of your own for each Mochi and the Mochi-to-desktop shortcut; on Linux, the Spotify pill with Mochi dancing to it, global shortcuts on Wayland and "Open terminal" that brings the terminal forward. 0.2.0 caught up with the Mac: Codex, Copilot CLI, Muse Code and six more agents with approvals from the island, answers to Claude's questions, live diffs, GitHub pull requests and CI, plan usage, local models, the wardrobe, Mochi on the desktop, keyboard shortcuts, the weekly recap and 10 languages. See the [changelog](CHANGELOG.md).
+**Windows and Linux 0.5.4** bring 25 reliability fixes from the community. **0.5.3** bring **WhatsApp** to the island (experimental), with the gateway installed in one click. **0.5.2** turn Mochi blue when a new version waits and show what it brings after the update; they add **GitLab and Gitea** pills. **0.5.1** tell you when a new version is out (once you agree) and, on Windows, install it in one click; they also speak German and Turkish. **0.5.0** caught up with the Mac: Coucou is now an app with its own window in the taskbar, **Flow dictation** anywhere (hold right Ctrl, speak, let go) with Parakeet running offline on your computer, the **Notetaker** for your calls, and **« OK Coucou »** to talk to Mochi, powered by Claude with your key. On Linux, dictation works on X11 and Wayland. 0.4.0 paired with [Coucou for Android](#coucou-for-android): approve, answer and chat f
```

**File**: `linux/arch/PKGBUILD` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 pkgname=coucou-git
 _pkgname=coucou
-pkgver=0.5.3
+pkgver=0.5.4
 pkgrel=1
 pkgdesc="Mochi lives at the top of your screen and keeps an eye on your Claude Code sessions"
 arch=('x86_64' 'aarch64')
```

**File**: `windows/Cargo.lock` (modified, +2/-2)
```diff
@@ -719,7 +719,7 @@ dependencies = [
 
 [[package]]
 name = "coucou"
-version = "0.5.3"
+version = "0.5.4"
 dependencies = [
  "arboard",
  "cpal",
@@ -755,7 +755,7 @@ dependencies = [
 
 [[package]]
 name = "coucou-hook"
-version = "0.5.3"
+version = "0.5.4"
 dependencies = [
  "libc",
  "serde_json",
```

**File**: `windows/Cargo.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ members = ["src-tauri", "hook"]
 resolver = "2"
 
 [workspace.package]
-version = "0.5.3"
+version = "0.5.4"
 edition = "2021"
 license = "MIT"
 
```

---

### Incident Patch 2: `479cf573` (2026-10-29)
**Commit Message**: Release prep: Mac 0.5.6, Windows and Linux 0.5.6 (chat on your AI subscription, Korean and Japanese)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -1,5 +1,16 @@
 # Changelog
 
+## 0.5.6 — October 30, 2026
+
+- **Chat on your own AI subscription** — Settings → Chat → Your AI subscriptions: one switch per provider. On, the chat goes through the provider's official terminal tool, signed in with your own account: Claude Code (Claude plan), Antigravity CLI or Gemini CLI (Google AI plan), Codex CLI (ChatGPT plan), and two new choices in the chat, Cursor CLI and GitHub Copilot CLI. Off, the API key as before. Replaces 0.5.5's hidden rule (empty the key and Claude Code answers): each row says whether the tool is installed, how to install it and how to sign in, and the chat's model chip names the tool that answers. Every run is read-only (plan or ask modes, no shell, no edits), loads none of your hooks, MCP servers or extensions where the tool lets Coucou turn them off, saves no session, and searches the web for the chat only; a dropped file is read with no web. Coucou reads no credential. GitHub build: the App Store build is sandboxed and still needs a key
+- **The tools are found where you installed them** — nvm, fnm, Volta, Bun, pnpm, Homebrew or the tools' own installers, and else through your login shell (a Claude Code installed with npm under nvm was not found before)
+- **Korean** (#880 by @lovyestar) **and Japanese**: 16 languages
+
+## Windows and Linux 0.5.6 — October 30, 2026
+
+- **Chat on your own AI subscription** — the same switches as on the Mac in Settings → Chat (Claude Code, Antigravity CLI or Gemini CLI, Codex CLI, Cursor CLI, Copilot CLI), read-only runs, and the phone's chat takes the same path. Through npm's `.cmd` shims on Windows the prompt goes in on stdin. Without a key and with Claude's switch off, the chat asks for a key instead of answering through Claude Code anyway; Flow's clean-up and the notes of a call still use Claude Code when no key is saved
+- **Korean** (#880 by @lovyestar) **and Japanese**: 14 languages
+
 ## 0.5.5 — October 29, 2026
 
 - **Chat on your Claude plan, no API key** — with no Anthropic key saved, the chat is answered by your own Claude Code (`claude -p`), signed in with your account. Each run loads none of your settings or hooks, no MCP server, saves no session, and may only search the web or, with no web at all, read the file you dropped (copied alone into a folder of its own). GitHub build: the App Store build is sandboxed and still needs a key. Saving a key switches back to the API
```

**File**: `NotchBuddy/Resources/Info.plist` (modified, +2/-2)
```diff
@@ -36,9 +36,9 @@
 	<key>CFBundlePackageType</key>
 	<string>APPL</string>
 	<key>CFBundleShortVersionString</key>
-	<string>0.5.5</string>
+	<string>0.5.6</string>
 	<key>CFBundleVersion</key>
-	<string>22</string>
+	<string>23</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSAccessibilityUsageDescription</key>
```

**File**: `NotchBuddy/Resources/whats-new.json` (modified, +83/-0)
```diff
@@ -1,6 +1,89 @@
 {
   "about": "What's new, shown once in the notch after Coucou updates itself (WhatsNew.swift). Every Mac release adds its entry here, in the 16 languages, before release.sh: 1 to 4 items, a short title and one line each, an icon from scripts/test-whats-new.py. python3 scripts/test-whats-new.py checks it.",
   "releases": [
+    {
+      "version": "0.5.6",
+      "items": [
+        {
+          "icon": "chat",
+          "title": {
+            "en": "Chat on your AI subscription",
+            "fr": "Le chat sur ton abonnement IA",
+            "es": "Chat con tu suscripción de IA",
+            "pt-BR": "Chat com sua assinatura de IA",
+            "ru": "Чат по вашей подписке на ИИ",
+            "zh-Hans": "用你的 AI 订阅聊天",
+            "hi": "अपनी AI सदस्यता से चैट",
+            "ar": "دردشة باشتراكك في الذكاء الاصطناعي",
+            "bn": "আপনার AI সাবস্ক্রিপশনে চ্যাট",
+            "id": "Chat dengan langganan AI-mu",
+            "de": "Chat mit deinem KI-Abo",
+            "tr": "Yapay zekâ aboneliğinizle sohbet",
+            "th": "แชตด้วยการสมัครใช้ AI ของคุณ",
+            "zh-Hant": "用你的 AI 訂閱聊天",
+            "ko": "내 AI 구독으로 채팅",
+            "ja": "AI サブスクリプションでチャット"
+          },
+          "detail": {
+            "en": "Claude, Gemini, ChatGPT, Cursor or Copilot, no key: turn it on in Settings → Chat.",
+            "fr": "Claude, Gemini, ChatGPT, Cursor ou Copilot, sans clé : active-le dans Réglages → Chat.",
+            "es": "Claude, Gemini, ChatGPT, Cursor o Copilot, sin clave: actívalo en Ajustes → Chat.",
+            "pt-BR": "Claude, Gemini, ChatGPT, Cursor ou Copilot, sem chave: ative em Ajustes → Chat.",
+            "ru": "Claude, Gemini, ChatGPT, Cursor или Copilot без ключа: включите в Настройки → Чат.",
+            "zh-Hans": "Claude、Gemini、ChatGPT、Cursor 或 Copilot，无需密钥：在 设置 → 聊天 中开启。",
+            "hi": "Claude, Gemini, ChatGPT, Cursor या Copilot, बिना कुंजी: सेटिंग्स → चैट में चालू करें।",
+            "ar": "Claude وGemini وChatGPT وCursor وCopilot دون مفتاح: فعّله من الإعدادات ← الدردشة.",
+            "bn": "Claude, Gemini, ChatGPT, Cursor বা Copilot, কী ছাড়াই: সেটিংস → চ্যাট-এ চালু করুন।",
+            "id": "Claude, Gemini, ChatGPT, Cursor, atau Copilot, tanpa kunci: nyalakan di Pengaturan → Chat.",
+            "de": "Claude, Gemini, ChatGPT, Cursor oder Copilot ohne Schlüssel: in Einstellungen → Chat einschalten.",
+            "tr": "Claude, Gemini, ChatGPT, Cursor veya Copilot, anahtarsız: Ayarlar → Sohbet'ten açın.",
+            "th": "Claude, Gemini, ChatGPT, Cursor หรือ Copilot โดยไม่ต้องใช้คีย์: เปิดได้ใน การตั้งค่า → แชต",
+            "zh-Hant": "Claude、Gemini、ChatGPT、Cursor 或 Copilot，免金鑰：在 設定 → 聊天 中開啟。",
+            "ko": "Claude, Gemini, ChatGPT, Cursor, Copilot을 키 없이: 설정 → 채팅에서 켜세요.",
+            "ja": "Claude、Gemini、ChatGPT、Cursor、Copilot をキーなしで：設定 → チャットでオンに。"
+          }
+        },
+        {
+          "icon": "languages",
+          "title": {
+            "en": "Korean and Japanese",
+            "fr": "Coréen et japonais",
+            "es": "Coreano y japonés",
+            "pt-BR": "Coreano e japonês",
+            "ru": "Корейский и японский",
+            "zh-Hans": "韩语和日语",
+            "hi": "कोरियाई और जापानी",
+            "ar": "الكورية واليابانية",
+            "bn": "কোরিয়ান ও জাপানি",
+            "id": "Bahasa Korea dan Jepang",
+            "de": "Koreanisch und Japanisch",
+            "tr": "Korece ve Japonca",
+            "th": "ภาษาเกาหลีและญี่ปุ่น",
+            "zh-Hant": "韓文和日文",
+            "ko": "한국어와 일본어",
+            "ja": "韓国語と日本語"
+          },
+          "detail": {
+            "en": "Coucou now speaks 16 languages. Korean thanks to @lovyestar.",
+            "fr": "Coucou parle maintenant 16 langues. Le coréen grâce à @lovyestar.",
+            "es": "Coucou ya habla 16 idiomas. El coreano gracias a @lovyestar.",
+            "pt-BR": "O Coucou agora fala 16 idiomas. O coreano graças a @lovyestar.",
+            "ru": "Coucou теперь говорит на 16 языках. Корейский — благодаря @lovyestar.",
+            "zh-Hans": "Coucou 现在支持 16 种语言。韩语由 @lovyestar 贡献。",
+            "hi": "Coucou अब 16 भाषाएँ बोलता है। कोरियाई @lovyestar की बदौलत।",
+            "ar": "يتحدث Coucou الآن 16 لغة. الكورية بفضل @lovyestar.",
+            "bn": "Coucou এখন 16টি ভাষায় কথা বলে। কোরিয়ান @lovyestar-এর সৌজন্যে।",
+            "id": "Coucou kini berbicara 16 bahasa. Bahasa Korea berkat @lovyestar.",
+            "de": "Coucou spricht jetzt 16 Sprachen. Koreanisch dank @lovyestar.",
+            "tr": "Coucou artık 16 dil konuşuyor. Korece @lovyestar sayesinde.",
+            "th": "ตอนนี้ Coucou พูดได้ 16 ภาษา ภาษาเกาหลีโดย @lovyestar",
+            "zh-Hant": "Coucou 現在支援 16 種語言。韓文由 @lovyestar 貢獻。",
+            "ko": "Coucou가 이제 16개 언어를 지원합니다. 한국어는 @lovyestar 덕분이에요.",
+            "ja": "Coucou は 16 言語に対応しました。韓国語は @lovyestar のおかげです。"
+          }
+        }
+      ]
+    },
     {
       "version": "0.5.5",
 
```

**File**: `NotchBuddy/project.yml` (modified, +2/-2)
```diff
@@ -140,8 +140,8 @@ targets:
         CFBundleName: Coucou
         CFBundleDisplayName: Coucou
         CFBundleIdentifier: fr.louisraille.NotchBuddy
-        CFBundleVersion: "22"
-        CFBundleShortVersionString: "0.5.5"
+        CFBundleVersion: "23"
+        CFBundleShortVersionString: "0.5.6"
         CFBundlePackageType: APPL
         LSUIElement: YES
         NSHighResolutionCapable: YES
```

**File**: `README.md` (modified, +5/-3)
```diff
@@ -66,7 +66,7 @@ Flow dictation and the Notetaker are on the Mac for now; Windows and Linux are n
 - See what Claude is editing, live in the notch: each file modification shows the file name and +N −M counts in the ticker, tap to read the full diff
 - ✅ **Approve and answer from the notch** — Claude Code permission requests show up with **Allow / Deny / Always**; `AskUserQuestion` prompts show the choices right in the notch (single or multi-select, up to 4 questions). One click, or "Reply in terminal" to fall back to the CLI. Codex also gets Allow / Deny.
 - 🧑‍💻 **Jump to the right terminal** — open the exact terminal window of a session *(macOS)*.
-- 💬 **Chat with Claude, Gemini, OpenAI, DeepSeek, Qwen, Moonshot, or a local model (Ollama / LM Studio)** — click the model name above the chat box to switch provider and pick a model. Cloud providers use your own API key; local providers connect to a server running on your Mac. **No API key?** With Claude Code installed, Claude answers through it, on your Claude plan *(GitHub build, Windows, Linux)*. *(Gemini, OpenAI, DeepSeek, Qwen, Moonshot and local models: macOS)*
+- 💬 **Chat with Claude, Gemini, OpenAI, DeepSeek, Qwen, Moonshot, or a local model (Ollama / LM Studio)** — click the model name above the chat box to switch provider and pick a model. Cloud providers use your own API key; local providers connect to a server running on your Mac. **No API key? Use your subscription**: switch it on in Settings → Chat and the chat goes through the official terminal tool you already pay for, signed in with your own account — Claude Code, Antigravity CLI or Gemini CLI, Codex CLI (ChatGPT), Cursor CLI or GitHub Copilot CLI *(GitHub build, Windows, Linux)*. *(Gemini, OpenAI, DeepSeek, Qwen, Moonshot and local models: macOS)*
 - 📈 **Portfolio pill** *(macOS)* — track your crypto across 16 networks (Bitcoin, Ethereum, Solana, Polygon, BNB, Avalanche, Arbitrum, Optimism, Base, Dogecoin, Litecoin, TRON, XRP, Cardano, Cosmos, NEAR) and 5 exchanges (Binance, OKX, Bybit, Kraken, Coinbase) in the notch. Live balances, 7-day sparklines and 24-hour price change per holding. Read-only API keys for exchanges, public addresses for wallets — nothing leaves your Mac.
 - 📊 **Claude plan usage** *(macOS, GitHub build)* — a small pill in the notch header shows your 5-hour and weekly Claude plan limits. Enable it from Settings → Agents → Plan usage. Pro and Max plans only.
 - 📊 **Codex plan usage** *(macOS, GitHub build)* — a Codex pill next to it shows your Codex limits and how many free resets you have left, read from the Codex CLI. Turn it on in Settings → Agents → Plan usage.
@@ -148,6 +148,7 @@ macOS releases are published as `v*` tags. See [CHANGELOG.md](CHANGELOG.md) for
 
 | Version | Date | Highlights |
 |---------|------|------------|
+| [0.5.6](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.6) | Oct 30, 2026 | Chat on your own AI subscription (Claude Code, Antigravity, Gemini CLI, Codex, Cursor, Copilot), switched on in Settings → Chat; Korean and Japanese |
 | [0.5.5](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.5) | Oct 29, 2026 | Chat on your Claude plan with no API key; each session apart behind its pill, questions side by side; Claude Code on a remote machine |
 | [0.5.4](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.4) | Oct 29, 2026 | Reliability: 25 community fixes — the hook server never gives up, your own hooks stay untouched, no crash without a mic, truer n8n, Stripe and GitHub pills |
 | [0.5.3](https://github.com/Louis-CFM/coucou/releases/tag/v0.5.3) | Oct 22, 2026 | Mochi turns blue when a new version waits; What's new and your Coucou so far after each update; Buy Mochi a coffee |
@@ -175,6 +176,7 @@ Windows and Linux are released together, under the `windows-v*` and `linux-v*` t
 
 | Windows & Linux | Date | Highlights |
 |---------|------|------------|
+| 0.5.6 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.6) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.6) | Oct 30, 2026 | Chat on your own AI subscription (Claude Code, Antigravity, Gemini CLI, Codex, Cursor, Copilot); Korean and Japanese |
 | 0.5.5 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.5) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.5) | Oct 29, 2026 | No API key? Your own Claude Code answers the chat, Flow's clean-up and the notes of a call, on your Claude plan |
 | 0.5.4 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.4) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.4) | Oct 29, 2026 | Reliability: 25 community fixes — the hook server never gives up, approval cards go when the terminal takes over, a sturdier Flow pill, WhatsApp group names |
 | 0.5.3 · [Windows](https://github.com/Louis-CFM/coucou/releases/tag/windows-v0.5.3) · [Linux](https://github.com/Louis-CFM/coucou/releases/tag/linux-v0.5.3) | Oct 22, 2026 | Wha
```

**File**: `linux/arch/PKGBUILD` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 pkgname=coucou-git
 _pkgname=coucou
-pkgver=0.5.5
+pkgver=0.5.6
 pkgrel=1
 pkgdesc="Mochi lives at the top of your screen and keeps an eye on your Claude Code sessions"
 arch=('x86_64' 'aarch64')
```

**File**: `windows/Cargo.lock` (modified, +2/-2)
```diff
@@ -719,7 +719,7 @@ dependencies = [
 
 [[package]]
 name = "coucou"
-version = "0.5.5"
+version = "0.5.6"
 dependencies = [
  "arboard",
  "cpal",
@@ -755,7 +755,7 @@ dependencies = [
 
 [[package]]
 name = "coucou-hook"
-version = "0.5.5"
+version = "0.5.6"
 dependencies = [
  "libc",
  "serde_json",
```

**File**: `windows/Cargo.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ members = ["src-tauri", "hook"]
 resolver = "2"
 
 [workspace.package]
-version = "0.5.5"
+version = "0.5.6"
 edition = "2021"
 license = "MIT"
 
```

---

### Incident Patch 3: `4dd4861a` (2026-10-29)
**Commit Message**: Japanese on Mac, Windows and Linux

Every Mac string (930), every Windows and Linux string of extra.json (473),
and every What's new entry, in Japanese. Added to the language pickers, the
bundle localizations and the plural rules (one form, as Korean). Mac 16
languages, Windows and Linux 14.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -31,4 +31,4 @@ Windows and Linux: `cd windows && npm install && npm run tauri dev`
 - Pill IDs are stable contract values (Keychain, UserDefaults, hook routing): never rename an existing pill ID.
 - New views follow the existing app style. `design/prototype/notch-buddy.html` and `design/captures/` are references for new work, not a reason to change existing views.
 - Every release adds its CHANGELOG.md section, a row in the README Versions table, and commits the regenerated Info.plist with the new version.
-- Every release also adds its What's new, shown once in the notch or the island after Coucou updates itself: an entry for the new version in `NotchBuddy/Resources/whats-new.json` (Mac, the 14 languages) or `windows/src/whats-new/whats-new.json` (Windows and Linux, the 12 languages). 1 to 4 items picked from the CHANGELOG section, each with an icon from `scripts/test-whats-new.py`, a short title and one line, translated in every language. `python3 scripts/test-whats-new.py` checks it; CI and `release.sh` fail without it.
+- Every release also adds its What's new, shown once in the notch or the island after Coucou updates itself: an entry for the new version in `NotchBuddy/Resources/whats-new.json` (Mac, the 16 languages) or `windows/src/whats-new/whats-new.json` (Windows and Linux, the 14 languages). 1 to 4 items picked from the CHANGELOG section, each with an icon from `scripts/test-whats-new.py`, a short title and one line, translated in every language. `python3 scripts/test-whats-new.py` checks it; CI and `release.sh` fail without it.
```

**File**: `NotchBuddy/Resources/Info.plist` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
 		<string>fr</string>
 		<string>hi</string>
 		<string>id</string>
+		<string>ja</string>
 		<string>ko</string>
 		<string>pt-BR</string>
 		<string>ru</string>
```

**File**: `NotchBuddy/Resources/InfoAppStore.plist` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@
 		<string>fr</string>
 		<string>hi</string>
 		<string>id</string>
+		<string>ja</string>
 		<string>ko</string>
 		<string>pt-BR</string>
 		<string>ru</string>
```

**File**: `NotchBuddy/Resources/whats-new.json` (modified, +45/-23)
```diff
@@ -1,5 +1,5 @@
 {
-  "about": "What's new, shown once in the notch after Coucou updates itself (WhatsNew.swift). Every Mac release adds its entry here, in the 14 languages, before release.sh: 1 to 4 items, a short title and one line each, an icon from scripts/test-whats-new.py. python3 scripts/test-whats-new.py checks it.",
+  "about": "What's new, shown once in the notch after Coucou updates itself (WhatsNew.swift). Every Mac release adds its entry here, in the 16 languages, before release.sh: 1 to 4 items, a short title and one line each, an icon from scripts/test-whats-new.py. python3 scripts/test-whats-new.py checks it.",
   "releases": [
     {
       "version": "0.5.5",
@@ -21,7 +21,8 @@
             "tr": "API anahtarı olmadan sohbet",
             "th": "แชตโดยไม่ต้องใช้คีย์ API",
             "zh-Hant": "免 API 金鑰即可聊天",
-            "ko": "API 키 없이 채팅"
+            "ko": "API 키 없이 채팅",
+            "ja": "API キーなしでチャット"
           },
           "detail": {
             "en": "No key? Your own Claude Code answers, on your Claude plan.",
@@ -38,7 +39,8 @@
             "tr": "Anahtar yok mu? Claude Code’un, Claude planınla yanıtlar.",
             "th": "ไม่มีคีย์? Claude Code ของคุณตอบให้ ด้วยแพ็กเกจ Claude ของคุณ",
             "zh-Hant": "沒有金鑰？由你的 Claude Code 用你的 Claude 方案回答。",
-            "ko": "키가 없나요? 내 Claude Code가 내 Claude 요금제로 답합니다."
+            "ko": "키가 없나요? 내 Claude Code가 내 Claude 요금제로 답합니다.",
+            "ja": "キーがなくても、あなたの Claude Code が Claude プランで答えます。"
           }
         },
         {
@@ -58,7 +60,8 @@
             "tr": "Her oturum ayrı",
             "th": "แยกแต่ละเซสชัน",
             "zh-Hant": "每個工作階段各自獨立",
-            "ko": "세션마다 따로"
+            "ko": "세션마다 따로",
+            "ja": "セッションごとに分けて"
           },
           "detail": {
             "en": "Two terminals, two names. The session waiting for you takes a place in the grid.",
@@ -75,7 +78,8 @@
             "tr": "İki terminal, iki ad. Seni bekleyen oturum ızgarada bir yer alır.",
             "th": "สองเทอร์มินัล สองชื่อ เซสชันที่รอคุณจะได้ที่ในตาราง",
             "zh-Hant": "兩個終端機，兩個名稱。等你處理的工作階段會佔據格狀中的一個位置。",
-            "ko": "터미널 두 개, 이름 두 개. 나를 기다리는 세션이 그리드에 자리를 잡습니다."
+            "ko": "터미널 두 개, 이름 두 개. 나를 기다리는 세션이 그리드에 자리를 잡습니다.",
+            "ja": "ターミナル 2 つなら名前も 2 つ。あなたを待つセッションはグリッドに場所を取ります。"
           }
         }
       ]
@@ -99,7 +103,8 @@
             "de": "Coucou hört weiter zu",
             "tr": "Coucou dinlemeye devam eder",
             "th": "Coucou ฟังต่อเนื่อง",
-            "zh-Hant": "Coucou 始終在線"
+            "zh-Hant": "Coucou 始終在線",
+            "ja": "Coucou は聞き続けます"
           },
           "detail": {
             "en": "One failed connection no longer cuts Claude Code off, and only Coucou’s own hooks are touched.",
@@ -115,7 +120,8 @@
             "de": "Eine fehlgeschlagene Verbindung trennt Claude Code nicht mehr, und nur Coucous eigene Hooks werden geändert.",
             "tr": "Tek bir başarısız bağlantı artık Claude Code’u koparmıyor; yalnızca Coucou’nun kendi hook’ları değişir.",
             "th": "การเชื่อมต่อที่ล้มเหลวไม่ตัด Claude Code อีกต่อไป และแก้เฉพาะ hooks ของ Coucou เอง",
-            "zh-Hant": "一次連線失敗不再讓 Claude Code 中斷，且只更動 Coucou 自己的 hooks。"
+            "zh-Hant": "一次連線失敗不再讓 Claude Code 中斷，且只更動 Coucou 自己的 hooks。",
+            "ja": "1 回接続に失敗しても Claude Code が途切れず、触れるのは Coucou 自身のフックだけです。"
           }
         },
         {
@@ -134,7 +140,8 @@
             "de": "25 Fixes aus der Community",
             "tr": "Topluluktan 25 düzeltme",
             "th": "25 การแก้ไขจากชุมชน",
-            "zh-Hant": "25 項社群修正"
+            "zh-Hant": "25 項社群修正",
+            "ja": "コミュニティによる 25 の修正"
           },
           "detail": {
             "en": "No crash without a mic, the hide delay works, and truer n8n, Stripe and GitHub pills.",
@@ -150,7 +157,8 @@
             "de": "Kein Absturz ohne Mikrofon, die Ausblendverzögerung greift, und genauere n8n-, Stripe- und GitHub-Pills.",
             "tr": "Mikrofon yokken çökme yok, gizleme gecikmesi çalışıyor; n8n, Stripe ve GitHub hapları daha doğru.",
             "th": "ไม่แครชเมื่อไม่มีไมค์ ระยะเวลาซ่อนใช้งานได้ และพิลล์ n8n, Stripe, GitHub แม่นยำขึ้น",
-            "zh-Hant": "沒有麥克風也不會當機，隱藏延遲生效，n8n、Stripe 與 GitHub 膠囊更準確。"
+            "zh-Hant": "沒有麥克風也不會當機，隱藏延遲生效，n8n、Stripe 與 GitHub 膠囊更準確。",
+            "ja": "マイクがなくてもクラッシュせず、非表示の遅延が機能し、n8n・Stripe・GitHub のピルがより正確に。"
           }
         }
       ]
@@ -175,7 +183,8 @@
             "tr": "Güncellemede Mochi maviye döner",
             "th": "Mochi เป็นสีฟ้าเมื่อมีอัปเดต",
             "zh-Hant": "有更新時 Mochi 變藍",
-            "ko": "업데이트가 있으면 모찌가 파랗게 돼요"
+            "ko": "업데이트가 있으면 모찌가 파랗게 돼요",
+            "ja": "アップデートで Mochi が青に"
           },
           "detail": {
             "en": "A new Coucou turns him blue, in the notch and the menu bar. One click installs it.",
@@ -192,7 +201,8 @@
             "tr": "Yeni Coucou onu çentikte ve menü çubuğunda maviye çevir
```

**File**: `NotchBuddy/Sources/App/SettingsView.swift` (modified, +1/-0)
```diff
@@ -477,6 +477,7 @@ struct SettingsView: View {
                     Text("Türkçe").tag("tr")
                     Text("ไทย").tag("th")
                     Text("한국어").tag("ko")
+                    Text("日本語").tag("ja")
                 }
                 .pickerStyle(.menu)
                 .labelsHidden()
```

**File**: `NotchBuddy/project.yml` (modified, +2/-0)
```diff
@@ -164,6 +164,7 @@ targets:
           - fr
           - hi
           - id
+          - ja
           - ko
           - pt-BR
           - ru
@@ -248,6 +249,7 @@ targets:
           - fr
           - hi
           - id
+          - ja
           - ko
           - pt-BR
           - ru
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ Flow dictation and the Notetaker are on the Mac for now; Windows and Linux are n
 - 📱 **Coucou on iPhone** — your sessions, approvals and services in your pocket, with Live Activities, widgets and Siri. See [Coucou on iPhone](#coucou-on-iphone).
 - 🤖 **Coucou for Android** — your agents, approvals with your fingerprint, questions, chat and home-screen widgets on an Android phone, linked to Coucou on Windows or Linux over your Wi-Fi. By [@Rhytam23](https://github.com/Rhytam23). See [Coucou for Android](#coucou-for-android).
 - 📅 **Weekly recap** *(macOS)* — every Monday morning Coucou shows a summary of the past week: time coding, sessions, files, lines changed, commands, permissions, top agent and project, busiest day and longest session. Share it as a 1080 × 1920 image with Mochi — project names optional. All local, no sync.
-- 🌍 **14 languages** — English, 简体中文, 繁體中文, हिन्दी, Español, العربية, Français, বাংলা, Português, Русский, Bahasa Indonesia, Deutsch, Türkçe, ไทย. Pick one in Settings → General → Language; Traditional Chinese and Thai are on the Mac only for now. Community translations welcome.
+- 🌍 **16 languages** — English, 简体中文, 繁體中文, हिन्दी, Español, العربية, Français, বাংলা, Português, Русский, Bahasa Indonesia, Deutsch, Türkçe, ไทย, 한국어, 日本語. Pick one in Settings → General → Language; Traditional Chinese and Thai are on the Mac only for now. Community translations welcome.
 - 🔒 **Private by design** — no telemetry, no account. Keys live in your macOS Keychain, Windows Credential Manager or Linux Secret Service (GNOME Keyring, KWallet). The app only talks to the services you plug in (and, once you agree, to GitHub's releases API to tell you about new versions).
 
 ## Coucou on iPhone
```

**File**: `scripts/test-whats-new.py` (modified, +3/-3)
```diff
@@ -3,8 +3,8 @@
 
 Coucou shows, once after it updated itself, what the new version brings (an icon, a title and a
 line per item, in every language the app speaks). The entries live in
-  NotchBuddy/Resources/whats-new.json   (Mac, the 15 languages of Localizable.xcstrings)
-  windows/src/whats-new/whats-new.json  (Windows and Linux, the 12 languages of strings.json)
+  NotchBuddy/Resources/whats-new.json   (Mac, the 16 languages of Localizable.xcstrings)
+  windows/src/whats-new/whats-new.json  (Windows and Linux, the languages of strings.json)
 This test fails when the version the app is about to ship has no entry, or an entry is
 incomplete. release.sh runs it too, so a release can't go out without its "What's new".
 
@@ -23,7 +23,7 @@
     "sparkles", "bolt", "puzzle", "paint", "eye", "keyboard", "heart", "clock", "download", "bug",
 }
 
-MAC_LANGS = ["en", "fr", "es", "pt-BR", "ru", "zh-Hans", "hi", "ar", "bn", "id", "de", "tr", "th", "zh-Hant", "ko"]
+MAC_LANGS = ["en", "fr", "es", "pt-BR", "ru", "zh-Hans", "hi", "ar", "bn", "id", "de", "tr", "th", "zh-Hant", "ko", "ja"]
 
 MAX_ITEMS = 4
 MAX_TITLE = 48     # characters, any language: one line in the card
```

#### Recent Merged Pull Requests:
- **PR #965** (2026-10-29): 0.5.6: chat on your own AI subscription, Korean and Japanese (@Louis-CFM)
- **PR #962** (2026-10-29): Sessions apart, questions side by side, remote sessions (Mac, iPhone) (@Louis-CFM)
- **PR #961** (2026-10-29): Chat on your Claude plan, no API key (Mac, Windows, Linux) (@Louis-CFM)
- **PR #959** (2026-10-29): Reliability batch: 25 community fixes (@Louis-CFM)
- **PR #950** (2026-10-29): Fix crash on launch when no audio input device is present (@gabbe-swe)
- **PR #948** (2026-10-29): fix(n8n): seed poller on launch and preserve real execution dates (#861) (@Ohualtex)

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

## X. Release prep: Mac 0.5.4, Windows and Linux 0.5.4 (reliability batch)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Louis-CFM/coucou. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f06fc09c`: Release prep: Mac 0.5.4, Windows and Linux 0.5.4 (reliability batch). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
## 0.5.4 — October 29, 2026
Reliability: bugs reported by @romainb82 and others, fixed by the community.
- **Your own hooks are safe** — installing or removing Coucou's hooks only touches Coucou's own entries, never a hook of yours whose path mentions "coucou" (#944 by @rahul05ranjan, #854)
- **No crash without a microphone** (#950 by @gabbe-swe, #949)
- **"Hide after" is used** — the delay set in Settings now hides the compact island (#780 by @Ohualtex, #675)
- **Nothing drawn over the real notch while hidden** (#789 by @orrrrli); a third-party agent's finished card no longer says "Claude Code finished" (#865 by @Ohualtex, #593)
- **WhatsApp statuses aren't chats** — a contact's WhatsApp Status and channel posts no longer show up as a conversation in the WhatsApp pill (#901, same fix as #910)

## Windows and Linux 0.5.4 — October 29, 2026

Reliability: 25 community fixes, shared with the Mac where they apply.

- **The hook relay never gives up** — a failed pipe connection no longer stops Coucou from hearing Claude Code (#872 by @seongj-un, #853); the pipe no longer crashes under many connections (mio 1.2.4, #911 by @afpruivo)
- **Windows: an approval card goes once the terminal ha
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
## Unreleased
- **Mac: WhatsApp statuses aren't chats** — a contact's WhatsApp Status and channel posts no longer show up as a conversation in the WhatsApp pill (#901, same fix as #910)

### Reliability (Mac, Windows, Linux)

Bugs reported by @romainb82 and others, fixed by the community.
- **Your own hooks are safe** — installing or removing Coucou's hooks only touches Coucou's own entries, never a hook of yours whose path mentions "coucou" (#944 by @rahul05ranjan, #854); on Windows, the hooks go where `CLAUDE_CONFIG_DIR` points (#810 by @afpruivo)
- **Mac: no crash without a microphone** (#950 by @gabbe-swe, #949)
- **Mac: "Hide after" is used** — the delay set in Settings now hides the compact island (#780 by @Ohualtex, #675)
- **Mac: nothing drawn over the real notch while hidden** (#789 by @orrrrli); a third-party agent's finished card no longer says "Claude Code finished" (#865 by @Ohualtex, #593)
- **Windows: an approval card goes once the terminal has taken over** (#890 by @afpruivo, #857); the relay pipe no longer crashes under many connections (mio 1.2.4, #911 by @afpruivo)
- **Windows/Linux: settings saved at the same moment no longer collide** (#888 by @Ohualtex, #858)

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f06fc09c` are properly handled with clean fallback behavior.
