> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/louis-cfm-coucou-learnings.md`  
> **Source**: github ([https://github.com/Louis-CFM/coucou](https://github.com/Louis-CFM/coucou))  
> **Source Version**: `98a767c4`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T22:26:45.957Z  
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
> **Harvest Timestamp**: 2026-10-19T22:26:45.948Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Louis-CFM/coucou`
- **Description**: A tiny friend in your Mac's notch and on your iPhone that keeps an eye on your AI coding agents: Claude Code, Codex, Cursor, Gemini CLI, Antigravity and more. Approve from the notch or your Lock Screen.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5584 stars

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
        // Clear demo question (real questions always have pendingQuestionFD >= 0)
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
            for id in ids {
          
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
    private var pendingQuestionFD: Int32 = -1         // held open while user answers AskUserQuestion
    private var questionFDSource: (any DispatchSourceRead)? = nil  // monitors pendingQuestionFD

    /// True when a real nb-hook connection is holding the approval fd open.
    @MainActor var hasRealPendingApproval: Bool { !approvals.isEmpty }
    /// True when a real nb-hook connection is holding the question fd open.
    @MainActor var hasRealPendingQuestion: Bool { pendingQuestionFD >= 0 }
    private var questionPillId: String = ""           // pill that owns the pending question
    private var questionSessionId: String = ""        // sessionId for the pending question (recap tracking)
    private var focusBeforeQuestion: String? = nil    // saved focus to restore after question
    private var activeSessionId: String? = nil        // current Claude Code session
    private var focusBeforeApproval: String? = nil    // saved focus to restore after approval
    private var sessions = PillSessionRegistry()      // live sessions behind each pill

    private init() {}

    // MARK: - Approval queue helpers

    /// Note shown when a request was answered outside Coucou.
    @MainActor
    private func handledNote(pill: String) -> String {
        switch pill {
        case "agent_cursor":  return "Handled in Cursor."
        case "agent_codex":   return "Handled in Codex."
        case "agent_copilot": return "Handled in Copilot CLI."
        case "agent_muse":    return "Handled in Muse Code."
        case "agent_hermes":  return "Handled in Hermes."
        default:              return "Handled in \(claudeHostName)."
        }
    }

    /// Note shown when a request waited too long and went back to the agent.
    @MainActor
    private func waitingNote(pill: String) -> String {
        switch pill {
        case "agent_cursor":  return "Still waiting in Cursor."
        case "agent_codex":   return "Still waiting in Codex."
        case "agent_copilot": return "Still waiting in Copilot CLI."
        case "agent_muse":    return "Still waiting in Muse Code."
        case "agent_hermes":  return "Still waiting in Hermes."
        default:              return "Still waiting in \(claudeHostName)."
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
        state.updateTask(id: head.pillId, state: .approval)
        state.pendingApproval = ApprovalInfo(sessionId: head.sessionId, tool: head.tool,
                                              command: head.command, inputKey: head.inputKey,
                                              pillId: head.pillId, id: head.id,
                                              queueCount: approvals.count,
                                              projectName: head.projectName)
        state.isPinned = true
        // Approval always forces the island open — the user must be able to respond.
        // Save the focus once, so it comes back when the last request is gone.
        if focusBeforeApproval == nil { focusBeforeApproval = state.focusId }
        withAnimation(.spring(response: 0.5, dampingFraction: 0.72)) { state.focusId = head.pillId }
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
        if !approvals.hasEntries(forPill: entry.pillId) {
            state.updateTask(id: entry.pillId, state: .working)
            clearPillBadge(id: entry.pillId)
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
            if state.focusId == entry.pillId, state.tasks.contains(where: { $0.id == prev }) {
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
        // Only intercept a demo question — real questions always have a live fd.
        if DemoEngine.shared.isActive, pendingQuestionFD < 0 {
            AppState.shared.pendingQuestion = nil
            AppState.shared.isPinned = false
            AppState.shared.view = AppState.shared.tasks.isEmpty ? .empty : .overview
            DemoEngine.shared.handleQuestionAnswered(answers: answers)
            return
        }
        let fd = pendingQuestionFD
        pendingQuestionFD = -1
        let source = questionFDSource
        questionFDSource = nil
   
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
    /// petit → hidden delay (seconds). Override for debug.
    var petitToHiddenDelay: TimeInterval = 60
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

### Core Architecture Module: `NotchBuddy/Sources/App/Voice/VoiceEngine.swift`
```
#if !APPSTORE
import AppKit
import AVFoundation
import Speech

// MARK: - VoiceEngine
//
// Coordinator for the «OK Coucou» voice feature.
//
// Reliability features:
// - Backoff: onWakeWindowEnded reopens with WakeWindowBackoff (0.5 → 5 s exp.);
//   after maxFastFails consecutive fast-fails, waits for the next VAD segment.
// - Continuous stall watchdog: if no audio buffer arrives for 2 s while the
//   pipeline is active, triggers a pipeline rebuild (regardless of VAD state).
// - Rate-limited rebuilds: ≥5 s between rebuilds, ≤5 per minute. If the limit
//   is exceeded, audioError is set (shown in Settings → Voice).
// - AVAudioEngineConfigurationChange (headphone events) triggers rebuild, but
//   config changes within 1 s of our own engine.start() are ignored (the OS
//   fires one spuriously on start).
// - endCommand() is idempotent: if not in command mode, only cancels timers.
@MainActor
final class VoiceEngine: ObservableObject {
    static let shared = VoiceEngine()

    // MARK: - Published state

    @Published var isEnabled: Bool = VoiceSettings.isEnabled {
        didSet { VoiceSettings.isEnabled = isEnabled; handleEnabledChanged() }
    }
    @Published private(set) var isListeningForCommand: Bool = false
    @Published private(set) var commandTranscript: String = ""
    @Published private(set) var recognizerUnavailable: Bool = false
    @Published private(set) var audioError: String? = nil
    /// Read by Mochi's canvas every frame; not published, so ~20 updates/s while I talk
    /// don't re-render Settings or the island views.
    private(set) var micLevel: Double = 0

    // MARK: - Pause reasons

    private var screenLocked    = false
    private var screenSleeping  = false
    private var lowPowerMode    = false
    private var dictationActive = 0

    var isPaused: Bool { screenLocked || screenSleeping || lowPowerMode || dictationActive > 0 }

    // MARK: - Audio pipeline (main-thread owned)

    private var audio:   VoiceAudio?
    private var spotter: WakeSpotter?
    private var locale:  Locale?

    private var voiceSegmentActive = false

    // Command session timers
    private var silenceWork:    DispatchWorkItem?
    private var commandMaxWork: DispatchWorkItem?
    private var loggedDropWhileSpeaking = false
    private var wakeWindowWork: DispatchWorkItem?   // 20 s periodic restart

    private var lastWordCount = 0

    // Backoff / loop prevention
    private var backoff           = WakeWindowBackoff()
    private var windowOpenedAt:   Date = .distantPast
    private var consecErrorStreak = 0
    private static let maxConsecErrors = 3

    // Music ducking during command (main thread)
    private var savedMusicVolume:   Int?  = nil
    private var savedSpotifyVolume: Int?  = nil
    private var isDuckingMusic             = false

    // Unavailability retry
    private var unavailableWork:    DispatchWorkItem?
    private var firstUnavailableAt: Date? = nil

    // Continuous stall watchdog (always active while pipeline is up)
    private var stallTask:       Task<Void, Never>? = nil
    private var pipelineStartTime: Date = .distantPast

    // Rebuild rate-limiting
    private var lastRebuildTime:    Date = .distantPast
    private var rebuildsThisMinute: Int  = 0
    private var minuteWindowStart:  Date = .distantPast

    private static let initialTimeout:           TimeInterval = 3.0
    private static let directListenInitialTimeout: TimeInterval = 5.0   // follow-up: user reads question first
    private static let directListenMaxTime:        TimeInterval = 20.0

    /// Initial silence timeout for the current direct-listen session.
    private var directInitialTimeout: TimeInterval = 3.0
    private static let wakeFirstWordTimeout: TimeInterval = 5.0
    private static let silenceTimeout:           TimeInterval = 1.5
    private static let commandMaxTime:           TimeInterval = 20.0

    // Conversation window
    private(set) var isInConversation: Bool = false
    private var conversationTurnWork: DispatchWorkItem? = nil
    private static let wakeWindowMax:            TimeInterval = 20.0
    private static let stallTimeout:             TimeInterval = 2.0
    private static let unavailableRebuildDelay:  TimeInterval = 10.0
    private static let minRebuildInterval:       TimeInterval = 5.0
    private static let maxRebuildsPerMinute                   = 5

    private static let cancelPhrases = ["annule", "annuler", "cancel", "laisse tomber", "never mind"]

    // MARK: - Init

    private init() {
        lowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        let buildHash = Bundle.main.object(forInfoDictionaryKey: "CoucouGitHash") as? String ?? "unknown"
        appendAppLog("nb.log", "[Voice] build \(buildHash)")
        observeSystemEvents()
        if isEnabled && !isPaused { startAudioPipeline() }
    }

    // MARK: - Enable / pause

    private func handleEnabledChanged() {
        if isEnabled && !isPaused { startAudioPipeline() }
        else                      { stopAudioPipeline() }
    }

    private func updatePause() {
        if isPaused { stopAudioPipeline() }
        else if isEnabled { startAudioPipeline() }
    }

    func cancelListening() { endCommand(postFinished: false) }

    /// Settings → Voice language changed: restart recognition in the new language.
    func reloadLanguage() {
        guard audio != nil else { return }
        stopAudioPipeline()
        if isEnabled && !isPaused { startAudioPipeline() }
        VoiceBrain.shared.endConversation()   // next session gets instructions in the new language
    }

    /// Start the next conversation turn (re-listen for 8 s without wake phrase).
    /// Called by IslandWindowController after showing a command result.
    func startConversationTurn(firstWordTimeout: TimeInterval = 8.0) {
        isInConversation = true
        audio?.resetVAD()
        startListeningDirectly(firstWordTimeout: firstWordTimeout)
    }

    /// End the conversation window and return to normal wake-phrase mode.
    func endConversation() {
        isInConversation = false
        conversationTurnWork?.cancel()
        conversationTurnWork = nil
        endCommand(postFinished: false)
    }

    /// `firstWordTimeout`: seconds of silence allowed before the first word (default 3 s;
    /// pass `Self.directListenInitialTimeout` = 5 s for follow-up questions so the user
    /// has time to read the question before speaking).
    func startListeningDirectly(firstWordTimeout: TimeInterval = 3.0) {
        guard isEnabled, !isPaused, !isListeningForCommand else { return }
        guard let audio = audio, let spotter = spotter, let loc = locale else { return }
        wakeWindowWork?.cancel(); wakeWindowWork = nil
        // Close any active wake window first — TTS audio can trigger VAD and leave
        // an active window open; beginWindow returns false (alreadyActive) otherwise.
        if spotter.isActive { spotter.endWindow() }
        isListeningForCommand = true
        commandTranscript     = ""
        lastWordCount         = 0
        directInitialTimeout  = firstWordTimeout
        loggedDropWhileSpeaking = false
        audio.bypassVAD       = true
        duckMusic()
        appendAppLog("nb.log", "[Voice] direct listen start (firstWordTimeout: \(firstWordTimeout)s)")
        NotificationCenter.default.post(name: .voiceWoke, object: "direct" as NSString)
        let preroll = audio.drainPreroll()
        // startInCommandPhase: skip wake-phrase gate, deliver speech directly as command.
        let started = spotter.beginWindow(locale: loc, preroll: preroll, startInCommandPhase: true)
        if !started {
            appendAppLog("nb.log", "[Voice] direct listen refused (alreadyActive/unavailable), retrying in 150ms")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                guard let self, self.isListeningForCommand else { return }
                guard let spotter = self.spotter, let audio = self.audio, let loc = self.locale else { return }
                let preroll2 = audio.drainPreroll()
                let started2 = spotter.beginWindow(locale: loc, preroll: preroll2, startInCommandPhase: true)
                if !started2 {
                    appendAppLog("nb.log", "[Voice] direct listen still refused, giving up")
                    self.endCommand(postFinished: true)
                }
            }
        }
        resetSilenceTimer()
        let maxItem = DispatchWorkItem { [weak self] in
            Task { @MainActor in self?.endCommand(postFinished: true) }
        }
        commandMaxWork = maxItem
        DispatchQueue.main.asyncAfter(deadline: .now() + max(Self.directListenMaxTime, firstWordTimeout + 10),
                                      execute: maxItem)
    }

    /// Locale used for the current recognition session — nil if pipeline is not running.
    var speechLocale: Locale? { locale }

    // MARK: - Pipeline lifecycle

    private func startAudioPipeline() {
        guard audio == nil else { return }
        guard let loc = suitableLocale() else {
            recognizerUnavailable = true
            appendAppLog("nb.log", "[Voice] no suitable on-device recognizer — voice disabled")
            return
        }
        recognizerUnavailable = false
        audioError = nil
        locale = loc

        let a = VoiceAudio()
        let s = WakeSpotter()
        s.additionalContextualStrings = PillCatalog.available.map { $0.name }

        // ── Spotter callbacks ─────────────────────────────────────────────────

        s.onWake = { [weak self] transcript in
            self?.wakeDetected(transcript: transcript)
        }

        s.onCommandUpdate = { [weak self] command in
            self?.commandUpdate(command)
        }

        s.onCommandEnd = { [weak self] in
            self?.endCommand(postFinished: true)
        }

        s.onWakeWindowEnded = { [weak self] wasError in
            guard let self, !isListeni
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #495** (2026-10-13): **UI is cut off in Ubuntu**
  *Symptoms*: **What happened** <img width="1918" height="177" alt="Image" src="https://github.com/user-attachments/assets/7d7c191f-ecee-41be-999f-7d1d7fb1bf24" />  **What you expected** Could it be positioned a bit lower? The UI is getting cut off, so the chat and file-drop buttons aren't visible. Also, the Dynamic Island isn't appearing, forcing me to open it via the tray icon instead.  **Ubuntu version** Ubuntu 26.04.1 LTS  **Coucou version** 0.3.0 Linux version .deb 
  **Post-Mortem & Fix Analysis**:
  > Hey @rayasya! The screenshot explains the situation really well.  What you're running into comes down to how GNOME handles window layering: unlike KDE Plasma or COSMIC, GNOME doesn't support `gtk-layer-shell`, so Coucou runs as an X11 dock window placed flush against the monitor's top edge (`y = 0`).  Because GNOME's top panel sits at `y = 0..32px`, two things happen: 1. The 6px invisible wake strip at the very top is completely obscured by the panel, so moving the cursor to the top edge hits GNOME Shell instead of Coucou (which is why hovering doesn't wake the island and you have to use the tray). 2. When opened from the tray, the top ~32px of the island (the header and rounded corners) is hidden behind the bar, which pushes the rest of the fixed 320px UI down and cuts off the chat prompt and drop buttons at the bottom.  The good news is that @Ahmed-chouaya opened #421 a couple of days ago specifically tackling this. It dynamically reads `_NET_WORKAREA` on X11 and offsets the island's
  > @rayasya you can try the code of #421 it works fine for me now .  https://github.com/user-attachments/assets/e3d11c5e-e5e4-4f9b-80a5-763af29d2844

- **Issue #459** (2026-10-14): **Opencode not working in Windows**
  *Symptoms*: Coucou isnt working with Opencode.  I have tried littearly anything different versions different installers still havent worked. (Server plugin error ~/.config/opencode/plugins/coucou.js Plugin must export a default definition with an id and an effect or setup function. Reference: err_c59e4c00)  I'm on Windows 11 and like i searched online and thru the bug reports but couldnt find anything. Coucou ver 0.3.0

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

### Incident Patch 1: `f931645e` (2026-10-15)
**Commit Message**: Fix a crash: the thermal state change arrives off the main thread

macOS posts thermalStateDidChangeNotification from a background queue; the sink was
isolated to the main actor and Swift's runtime check stopped the app. Every publisher
MachineVitals follows is now received on the main queue.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01LJm3SRL9k3gBPaVtfPhwcT

**File**: `NotchBuddy/Sources/App/MachineVitals.swift` (modified, +5/-2)
```diff
@@ -47,13 +47,16 @@ final class MachineVitals: ObservableObject {
     /// Starts following whether Mochi is on screen. Called once at launch.
     func start() {
         let state = AppState.shared
-        state.$mode.removeDuplicates().sink { [weak self] _ in
+        // Everything is received on the main thread: macOS posts some of these (the thermal
+        // state) from a background queue, and Mochi's code only runs on the main one.
+        state.$mode.removeDuplicates().receive(on: DispatchQueue.main).sink { [weak self] _ in
             Task { @MainActor in self?.refreshRunning() }
         }.store(in: &subscriptions)
-        state.$mochiOnDesktop.removeDuplicates().sink { [weak self] _ in
+        state.$mochiOnDesktop.removeDuplicates().receive(on: DispatchQueue.main).sink { [weak self] _ in
             Task { @MainActor in self?.refreshRunning() }
         }.store(in: &subscriptions)
         NotificationCenter.default.publisher(for: ProcessInfo.thermalStateDidChangeNotification)
+            .receive(on: DispatchQueue.main)
             .sink { [weak self] _ in Task { @MainActor in self?.sample() } }
             .store(in: &subscriptions)
         refreshRunning()
```

---

### Incident Patch 2: `57d13207` (2026-10-18)
**Commit Message**: WhatsApp: fixes from an independent review

- No redirect is ever followed (and an answer from another host is
  refused): credentials and a reply's text only reach the gateway.
- GOWA started by Coucou is restarted only when its binary, address or
  password changes, after the old one has gone; Save and Test no longer kill
  it. Test connection waits a few seconds for a GOWA just started, and uses
  the running connection.
- Focus authorization callback is @Sendable (Intents may answer off the
  main thread).
- History loaded at connection is added as quiet history instead of
  zeroing every unread count afterwards.
- Messages arriving in the conversation open on screen aren't unread and
  don't make Mochi react; the receipt still waits for a reply or an opening.
- The badge clears on the unread you can actually see (muted groups and
  ignored chats aside). Ignoring a chat removes it from the inbox.
- The conversation and its draft survive a missed status check (a banner
  says it); a send finishing after WhatsApp is turned off adds nothing back.
- QR: never asked again within 15 s, even when none came (each GOWA login
  call restarts the pairing).
- Dedupe forgets the oldest ids,

**File**: `NotchBuddy/Sources/App/WhatsAppController.swift` (modified, +53/-13)
```diff
@@ -141,6 +141,8 @@ final class WhatsAppController: ObservableObject {
     private var lastPoll = Date()
     private var lastAnnounce: Date = .distantPast
     private var namingGroups: Set<String> = []
+    /// The conversation open in the card: what arrives there is seen, so it isn't unread.
+    private(set) var openChat: String?
     private var rateLimit = WARateLimit(limit: 6, window: 60)
     /// Failed checks in a row (the gateway down, refusing, unreachable).
     private var failures = 0
@@ -207,7 +209,7 @@ final class WhatsAppController: ObservableObject {
         startListener(kind: provider.kind)
         if WhatsAppSettings.respectFocus { askFocus() }
         // GOWA started by Coucou when asked to (Settings), before the first check.
-        WhatsAppGOWAProcess.shared.startIfNeeded()
+        WhatsAppGOWAProcess.shared.sync()
         let t = Timer(timeInterval: 5, repeats: true) { _ in
             MainActor.assumeIsolated { WhatsAppController.shared.onTick() }
         }
@@ -234,9 +236,11 @@ final class WhatsAppController: ObservableObject {
         lastWebhook = nil
         namingGroups = []
         failures = 0
-        // Started again on the next begin() with the new settings, or gone for good.
-        WhatsAppGOWAProcess.shared.stop()
+        // Turned off: GOWA goes too. Otherwise begin() keeps it, or restarts it if its
+        // settings changed.
+        if !shouldRun { WhatsAppGOWAProcess.shared.stopNow() }
         if forget {
+            openChat = nil
             inbox.clear()
             resetTask()
         }
@@ -285,6 +289,9 @@ final class WhatsAppController: ObservableObject {
                 case .needsQR:
                     link = .needsQR
                     if qrPNG == nil || Date() > qrExpiry {
+                        // Not asked again for 15 s even when nothing came: each GOWA login call
+                        // restarts the pairing.
+                        qrExpiry = Date().addingTimeInterval(15)
                         if let qr = try await provider.qrCode(), gen == generation {
                             qrPNG = qr.png
                             qrExpiry = Date().addingTimeInterval(TimeInterval(qr.seconds))
@@ -313,7 +320,7 @@ final class WhatsAppController: ObservableObject {
         // Twice in a row (not a gateway still starting): a small red dot on the pill, nothing more.
         if failures == 2 { showDown(true) }
         // GOWA started by Coucou and gone (crash, killed): started again, once a minute at most.
-        if error == .unreachable { WhatsAppGOWAProcess.shared.startIfNeeded() }
+        if error == .unreachable { WhatsAppGOWAProcess.shared.sync() }
     }
 
     /// The discreet error pill: the pill's red badge while the gateway is down.
@@ -326,9 +333,21 @@ final class WhatsAppController: ObservableObject {
 
     /// One check from Settings' "Test connection": what the gateway says, in a sentence.
     func testConnection() async -> String {
-        guard let provider = WhatsAppSettings.makeProvider() else { return String(localized: "whatsapp.status.bad-url") }
+        // The running connection when there is one (a second one could race it for OpenWA's session).
+        guard let provider = provider ?? WhatsAppSettings.makeProvider() else { return String(localized: "whatsapp.status.bad-url") }
         do {
-            let status = try await provider.status()
+            var status: WAStatus
+            var attempt = 0
+            while true {
+                do {
+                    status = try await provider.status()
+                    break
+                } catch WAError.unreachable where WhatsAppGOWAProcess.shared.isRunning && attempt < 8 {
+                    // GOWA just started by Coucou: give it a few seconds to come up.
+                    attempt += 1
+                    try? await Task.sleep(for: .seconds(1))
+                }
+            }
             switch status.link {
             case .connected:
                 let who = status.me.map(WAJID.displayNumber) ?? ""
@@ -407,8 +426,9 @@ final class WhatsAppController: ObservableObject {
         backfilled = true
         let since = Date().addingTimeInterval(-12 * 3600)
         guard let messages = try? await provider.recentMessages(since: since, me: me), gen == generation else { return }
-        ingest(messages, announce: false)
-        inbox.markAllRead()
+        // History: kept, never counted as unread (whether it was read is unknown), never announced.
+        for message in messages { inbox.add(message, filters: filters, history: true) }
+        for message in messages { nameGroupIfNeeded(WAJID.normalized(message.chat)) }
         lastPoll = Date()
     }
 
@@ -429,9 +449,16 @@ final class WhatsAppController: ObservableObject {
     private func ingest(_ messages: [WAMessage], announce: Bool) {
         var fresh: WAMessage?
         for message in messages {
+            let key = WAJID.normalized(message.chat)
         
```

**File**: `NotchBuddy/Sources/App/WhatsAppGOWAProcess.swift` (modified, +26/-26)
```diff
@@ -33,21 +33,33 @@ final class WhatsAppGOWAProcess {
         return base.appendingPathComponent("Coucou/GOWA", isDirectory: true)
     }
 
-    /// Starts GOWA unless it already runs (or was started less than a minute ago).
-    /// Returns false when the binary can't be run.
+    /// What the running GOWA was started with: changed, it is restarted; same, left alone.
+    private var launchedWith: String?
+
+    /// Brings GOWA in line with Settings: started when "Start GOWA automatically" is on (and
+    /// the gateway is GOWA on this Mac), restarted only when its binary, address or password
+    /// changed, stopped when the option is off. A GOWA that keeps dying is started again once
+    /// a minute at most. Returns false when it can't run.
     @discardableResult
-    func startIfNeeded() -> Bool {
-        guard Self.autoStart, WhatsAppSettings.gateway == .gowa else { return false }
-        if isRunning { return true }
-        guard Date().timeIntervalSince(lastStart) > 60 else { return true }
+    func sync() -> Bool {
+        guard Self.autoStart, WhatsAppSettings.gateway == .gowa else { stopNow(); return false }
         let path = (Self.binaryPath as NSString).expandingTildeInPath
         guard !path.isEmpty, FileManager.default.isExecutableFile(atPath: path),
               let url = URL(string: WhatsAppSettings.url) else {
             appendAppLog("nb.log", "[WhatsApp] GOWA binary missing or not executable")
+            stopNow()
             return false
         }
         // Only ever on this Mac: an address elsewhere is someone else's gateway.
-        guard ["127.0.0.1", "localhost", "::1"].contains(url.host ?? "") else { return false }
+        guard ["127.0.0.1", "localhost", "::1"].contains(url.host ?? "") else { stopNow(); return false }
+        let credential = KeychainStore.shared.get(WhatsAppSettings.credentialKey) ?? ""
+        let signature = [path, url.absoluteString, credential].joined(separator: "\u{1F}")
+        if isRunning {
+            if launchedWith == signature { return true }
+            stopNow()   // waits for it to let go of the port and its database
+        } else if launchedWith == signature, Date().timeIntervalSince(lastStart) < 60 {
+            return true
+        }
         try? FileManager.default.createDirectory(at: Self.workingDirectory, withIntermediateDirectories: true)
 
         let p = Process()
@@ -56,9 +68,7 @@ final class WhatsAppGOWAProcess {
         p.currentDirectoryURL = Self.workingDirectory
         var env = ProcessInfo.processInfo.environment
         // The credential goes through the environment, not the command line (`ps` shows that).
-        if let auth = KeychainStore.shared.get(WhatsAppSettings.credentialKey), auth.contains(":") {
-            env["APP_BASIC_AUTH"] = auth
-        }
+        if credential.contains(":") { env["APP_BASIC_AUTH"] = credential }
         p.environment = env
         // GOWA's own output may name contacts or quote messages: it goes nowhere.
         p.standardOutput = FileHandle.nullDevice
@@ -73,6 +83,7 @@ final class WhatsAppGOWAProcess {
             try p.run()
             process = p
             lastStart = Date()
+            launchedWith = signature
             appendAppLog("nb.log", "[WhatsApp] GOWA started (pid \(p.processIdentifier))")
             return true
         } catch {
@@ -81,23 +92,12 @@ final class WhatsAppGOWAProcess {
         }
     }
 
-    /// Stops GOWA if Coucou started it (Coucou quits, the option or WhatsApp is turned off).
-    func stop() {
-        lastStart = .distantPast
-        guard let p = process else { return }
-        process = nil
-        guard p.isRunning else { return }
-        p.terminate()
-        // Still there after 2 s: killed.
-        let pid = p.processIdentifier
-        DispatchQueue.global().asyncAfter(deadline: .now() + 2) {
-            if kill(pid, 0) == 0 { kill(pid, SIGKILL) }
-        }
-    }
-
-    /// At quit: the gateway can't outlive Coucou, and there is no time to wait.
+    /// Stops GOWA if Coucou started it, waiting a second at most for it to go (at quit, or
+    /// before starting it again so two never share its database).
     func stopNow() {
-        guard let p = process, p.isRunning else { return }
+        launchedWith = nil
+        guard let p = process else { return }
+        guard p.isRunning else { process = nil; return }
         p.terminate()
         let deadline = Date().addingTimeInterval(1)
         while p.isRunning && Date() < deadline { usleep(50_000) }
```

**File**: `NotchBuddy/Sources/App/WhatsAppModels.swift` (modified, +20/-1)
```diff
@@ -110,6 +110,8 @@ struct WAInbox: Equatable, Sendable {
 
     private(set) var conversations: [String: WAConversation] = [:]
     private var seenIds: Set<String> = []
+    /// The same ids in arrival order, so the oldest are the ones forgotten.
+    private var seenOrder: [String] = []
 
     /// Newest activity first.
     var sorted: [WAConversation] {
@@ -130,7 +132,12 @@ struct WAInbox: Equatable, Sendable {
         let chat = WAJID.normalized(message.chat)
         guard !filters.ignored.contains(chat) else { return .ignored }
         seenIds.insert(message.id)
-        if seenIds.count > 2_000 { seenIds = Set(seenIds.suffix(1_000)) }
+        seenOrder.append(message.id)
+        if seenOrder.count > 2_000 {
+            let dropped = seenOrder.prefix(1_000)
+            seenOrder.removeFirst(1_000)
+            for id in dropped { seenIds.remove(id) }
+        }
 
         let isGroup = WAJID.isGroup(chat)
         let number = WAJID.displayNumber(chat)
@@ -168,6 +175,17 @@ struct WAInbox: Equatable, Sendable {
         sorted.filter { !filters.ignored.contains($0.id) && (!$0.isGroup || !filters.muteGroups || $0.messages.contains { $0.mentionsMe && !$0.fromMe }) }
     }
 
+    /// Unread messages in the conversations the pill shows (a muted group's quiet messages
+    /// and an ignored chat can't be opened, so they don't count).
+    func visibleUnread(filters: WAFilters) -> Int {
+        visible(filters: filters).reduce(0) { $0 + $1.unread }
+    }
+
+    /// A chat dropped from the inbox (the user ignores it).
+    mutating func remove(_ chat: String) {
+        conversations[WAJID.normalized(chat)] = nil
+    }
+
     mutating func markRead(_ chat: String) {
         conversations[WAJID.normalized(chat)]?.unread = 0
     }
@@ -186,6 +204,7 @@ struct WAInbox: Equatable, Sendable {
     mutating func clear() {
         conversations = [:]
         seenIds = []
+        seenOrder = []
     }
 
     private func nonEmpty(_ s: String) -> String? { s.isEmpty ? nil : s }
```

**File**: `NotchBuddy/Sources/App/WhatsAppProvider.swift` (modified, +14/-2)
```diff
@@ -38,7 +38,17 @@ protocol WhatsAppProvider: Sendable {
     func groupName(_ chat: String) async -> String?
 }
 
-/// HTTP to the local gateway: no cookies, no cache, nothing stored on disk.
+/// Never follows a redirect: a request (with its credentials and, for a send, the reply's
+/// text) goes to the configured gateway and nowhere else.
+final class WANoRedirect: NSObject, URLSessionTaskDelegate, Sendable {
+    func urlSession(_ session: URLSession, task: URLSessionTask,
+                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
+                    completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
+        completionHandler(nil)
+    }
+}
+
+/// HTTP to the local gateway: no cookies, no cache, no redirect, nothing stored on disk.
 final class WAHTTP: Sendable {
     let base: URL
     let headers: [String: String]
@@ -53,7 +63,7 @@ final class WAHTTP: Sendable {
         config.httpCookieStorage = nil
         config.timeoutIntervalForRequest = 60   // each request sets its own (10 s, longer for a QR)
         config.connectionProxyDictionary = [:]   // straight to the local gateway
-        session = URLSession(configuration: config)
+        session = URLSession(configuration: config, delegate: WANoRedirect(), delegateQueue: nil)
     }
 
     /// `path` is appended to the base URL as given (already percent-encoded where needed).
@@ -74,6 +84,8 @@ final class WAHTTP: Sendable {
         }
         do {
             let (data, response) = try await session.data(for: req)
+            // Second lock: an answer from anywhere but the gateway is not one.
+            if let final = response.url, final.host != url.host || final.port != url.port { throw WAError.unreachable }
             let code = (response as? HTTPURLResponse)?.statusCode ?? 0
             return (data, code)
         } catch {
```

**File**: `NotchBuddy/Sources/App/WhatsAppViews.swift` (modified, +12/-3)
```diff
@@ -17,7 +17,8 @@ struct WhatsAppCardView: View {
 
     var body: some View {
         Group {
-            if wa.link == .connected, let chat = openChat, let conversation = wa.inbox.conversations[chat] {
+            // Kept open through a missed check (the draft too): only gone when WhatsApp is off.
+            if wa.link != .off, let chat = openChat, let conversation = wa.inbox.conversations[chat] {
                 WhatsAppConversationView(conversation: conversation) {
                     withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) { openChat = nil }
                 }
@@ -275,7 +276,12 @@ struct WhatsAppConversationView: View {
             .padding(.horizontal, 8).padding(.vertical, 4)
             .background(RoundedRectangle(cornerRadius: 7).fill(Color.white.opacity(0.06)))
 
-            if let error = wa.sendError {
+            if wa.link != .connected {
+                Text(verbatim: WhatsAppStatus.label(wa.link))
+                    .font(.system(size: 9.5))
+                    .foregroundColor(Color(hex: "#F5B83D"))
+                    .lineLimit(1).truncationMode(.tail)
+            } else if let error = wa.sendError {
                 Text(verbatim: error)
                     .font(.system(size: 9.5))
                     .foregroundColor(Color(hex: "#F4505E"))
@@ -292,7 +298,10 @@ struct WhatsAppConversationView: View {
         .onChange(of: draft) { _, text in
             wa.composing = !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
         }
-        .onDisappear { wa.composing = false }
+        .onDisappear {
+            wa.composing = false
+            wa.close(conversation.id)
+        }
     }
 
     /// Return: sends. Shift-Return: a new line instead.
```

**File**: `NotchBuddy/Sources/App/WhatsAppWebhook.swift` (modified, +13/-2)
```diff
@@ -10,10 +10,21 @@ final class WhatsAppWebhook: @unchecked Sendable {
     private let queue = DispatchQueue(label: "fr.louisraille.NotchBuddy.whatsapp.webhook")
     private(set) var port: UInt16 = 0
 
+    private let lock = NSLock()
+    private var _onRequest: (@Sendable (WAHTTPRequest) -> Int)?
+    private var _onListening: (@Sendable (Bool) -> Void)?
+
     /// Called on `queue` with each complete request; returns the HTTP status to answer.
-    var onRequest: (@Sendable (WAHTTPRequest) -> Int)?
+    /// Set on the main thread, read on `queue`: behind a lock.
+    var onRequest: (@Sendable (WAHTTPRequest) -> Int)? {
+        get { lock.withLock { _onRequest } }
+        set { lock.withLock { _onRequest = newValue } }
+    }
     /// Called on `queue`: true once listening, false when the port can't be used.
-    var onListening: (@Sendable (Bool) -> Void)?
+    var onListening: (@Sendable (Bool) -> Void)? {
+        get { lock.withLock { _onListening } }
+        set { lock.withLock { _onListening = newValue } }
+    }
 
     /// Starts listening; false when the port is taken or invalid.
     @discardableResult
```

**File**: `docs/INTEGRATIONS.md` (modified, +1/-1)
```diff
@@ -333,7 +333,7 @@ Pas d'API WhatsApp pour un compte perso : Coucou parle à une **passerelle local
 - **Répondre** : clic → 10 derniers messages + champ (Entrée envoie, Maj+Entrée saut de ligne, Échap ferme ; le brouillon garde l'île ouverte). Réponse seulement dans une conversation déjà là, 4 096 caractères max, 6 par minute. Lu à l'ouverture (option) ou à la réponse, jamais à la réception.
 - **Filtres** : groupes muets sauf mention, chats ignorés (clic droit ou Réglages), Concentration via `INFocusStatusCenter` (demande la capability Communication Notifications ; sans elle, le réglage s'affiche indisponible).
 - **Vie privée** : rien d'autre que la passerelle locale (pas de photo de profil, elles sont sur les serveurs de WhatsApp), historique en mémoire seulement (20 messages par conversation), vidé à la fermeture ou à la désactivation, aucun contenu dans les logs ni sur disque. URL, identifiants et secret dans le Keychain.
-- **Lancer GOWA automatiquement** : processus enfant `rest --host=127.0.0.1 --port=<port de l'URL> --auto-download-media=false`, identifiant passé par `APP_BASIC_AUTH` (pas sur la ligne de commande), sortie vers `/dev/null`, dossier `~/Library/Application Support/Coucou/GOWA`, arrêté à la fermeture de Coucou, relancé s'il tombe (une fois par minute au plus).
+- **Lancer GOWA automatiquement** : processus enfant `rest --host=127.0.0.1 --port=<port de l'URL> --auto-download-media=false`, identifiant passé par `APP_BASIC_AUTH` (pas sur la ligne de commande), sortie vers `/dev/null`, dossier `~/Library/Application Support/Coucou/GOWA`, arrêté à la fermeture de Coucou ou quand l'option est coupée, redémarré seulement si son binaire, son adresse ou son mot de passe change (en attendant que l'ancien soit parti), relancé s'il tombe (une fois par minute au plus). Aucune requête ne suit de redirection : rien ne part ailleurs que vers la passerelle.
 
 ---
 
```

**File**: `tests/WhatsAppTests.swift` (modified, +8/-0)
```diff
@@ -58,6 +58,14 @@ enum WhatsAppTests {
             for i in 0..<30 { inbox.add(msg("m\(i)", chat: "1@s.whatsapp.net", at: Double(i)), filters: WAFilters()) }
             check("20 kept, newest last", inbox.conversations["1@s.whatsapp.net"]?.messages.count == 20
                   && inbox.conversations["1@s.whatsapp.net"]?.messages.last?.id == "m29")
+            var big = WAInbox()
+            for i in 0..<2_500 { big.add(msg("b\(i)", chat: "2@s.whatsapp.net", at: Double(i)), filters: WAFilters()) }
+            check("the newest ids are still known after 2,000", big.add(msg("b2499", chat: "2@s.whatsapp.net"), filters: WAFilters()) == .duplicate)
+            var groups = WAInbox()
+            groups.add(msg("q1", chat: "120363000000000009@g.us", from: "33@s.whatsapp.net"), filters: WAFilters())
+            check("a muted group's quiet messages don't count as unread to read", groups.visibleUnread(filters: WAFilters()) == 0)
+            groups.remove("120363000000000009@g.us")
+            check("removed", groups.conversations.isEmpty)
             inbox.clear()
             check("cleared", inbox.conversations.isEmpty)
         }
```

---

### Incident Patch 3: `98a767c4` (2026-10-18)
**Commit Message**: Merge pull request #800 from Louis-CFM/feat/whatsapp-installer

WhatsApp in one click, Mac 0.5.1

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 # Changelog
 
+## 0.5.1 — October 18, 2026
+
+- **WhatsApp in one click** *(macOS, GitHub build)* — no more GitHub, zip or Terminal: Settings → Integrations → WhatsApp → **Install WhatsApp**. Coucou downloads GOWA, the open-source gateway, for your Mac (about 15 MB, once), checks it against the SHA-256 GOWA publishes, starts it, and shows the QR code to scan. It starts and stops with Coucou, and **Update** fetches GOWA's latest version. Your own gateway (GOWA by hand, OpenWA, another address) moves under **Advanced**
+- GOWA started by Coucou no longer fetches its own web dashboard from GitHub at each start (Coucou is the interface)
+
 ## 0.5.0 — October 18, 2026
 
 WhatsApp in the notch, Mochi who feels your Mac, a screen capture for Claude, and dictation that writes prompts or translates. All of it free and open source.
```

**File**: `NotchBuddy/Resources/Info.plist` (modified, +2/-2)
```diff
@@ -30,9 +30,9 @@
 	<key>CFBundlePackageType</key>
 	<string>APPL</string>
 	<key>CFBundleShortVersionString</key>
-	<string>0.5.0</string>
+	<string>0.5.1</string>
 	<key>CFBundleVersion</key>
-	<string>17</string>
+	<string>18</string>
 	<key>LSUIElement</key>
 	<true/>
 	<key>NSAccessibilityUsageDescription</key>
```

**File**: `NotchBuddy/Resources/Localizable.xcstrings` (modified, +975/-0)
```diff
@@ -1,6 +1,981 @@
 {
   "sourceLanguage" : "en",
   "strings" : {
+    "whatsapp.advanced" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "ar" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "متقدم: بوابتك الخاصة"
+          }
+        },
+        "bn" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "অ্যাডভান্সড: নিজের গেটওয়ে"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Advanced: your own gateway"
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Avanzado: tu propia pasarela"
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Avancé : ta propre passerelle"
+          }
+        },
+        "hi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "एडवांस्ड: अपना गेटवे"
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Lanjutan: gateway sendiri"
+          }
+        },
+        "pt-BR" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Avançado: seu próprio gateway"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Дополнительно: свой шлюз"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "高级：你自己的网关"
+          }
+        }
+      }
+    },
+    "whatsapp.install" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "ar" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "تثبيت واتساب"
+          }
+        },
+        "bn" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "WhatsApp ইনস্টল করো"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Install WhatsApp"
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Instalar WhatsApp"
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Installer WhatsApp"
+          }
+        },
+        "hi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "WhatsApp इंस्टॉल करें"
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Pasang WhatsApp"
+          }
+        },
+        "pt-BR" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Instalar o WhatsApp"
+          }
+        },
+        "ru" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Установить WhatsApp"
+          }
+        },
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "安装 WhatsApp"
+          }
+        }
+      }
+    },
+    "whatsapp.install.bad-checksum" : {
+      "extractionState" : "manual",
+      "localizations" : {
+        "ar" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "التنزيل لا يطابق الملف الذي نشره GOWA: حُذف ولم يُثبَّت شيء."
+          }
+        },
+        "bn" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "ডাউনলোড GOWA-র প্রকাশিত ফাইলের সঙ্গে মেলে না: মুছে ফেলা হয়েছে, কিছু ইনস্টল হয়নি।"
+          }
+        },
+        "en" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "The download doesn't match the file GOWA published: it was deleted, nothing was installed."
+          }
+        },
+        "es" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "La descarga no coincide con el archivo publicado por GOWA: se eliminó y no se instaló nada."
+          }
+        },
+        "fr" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Le téléchargement ne correspond pas au fichier publié par GOWA : il a été supprimé, rien n'a été installé."
+          }
+        },
+        "hi" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "डाउनलोड GOWA की फ़ाइल से मेल नहीं खाता: हटा दिया गया, कुछ इंस्टॉल नहीं हुआ।"
+          }
+        },
+        "id" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "Unduhan tidak cocok dengan file dari GOWA: sudah dihapus, tidak ada yang dipasang."
+          }
+
```

**File**: `NotchBuddy/Sources/App/WhatsAppGOWAInstaller.swift` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
+#if !APPSTORE
+import Foundation
+import CryptoKit
+
+// "Install WhatsApp": one click instead of GitHub, a zip, xattr, chmod and a Terminal command.
+// Downloads GOWA's own latest macOS build for this Mac from its GitHub releases, checks its
+// SHA-256 against the checksums GOWA publishes, puts the binary in Coucou's GOWA folder (next
+// to the WhatsApp session it keeps) and turns on "Start GOWA automatically". GitHub build only.
+// The only network call is to GitHub, once, after the click; no message ever goes there.
+
+@MainActor
+final class WhatsAppGOWAInstaller: ObservableObject {
+    static let shared = WhatsAppGOWAInstaller()
+
+    enum Step: Equatable {
+        case idle
+        case checking
+        case downloading(megabytes: Int)
+        case verifying
+        case installing
+        case done(version: String)
+        case failed(String)
+    }
+
+    @Published private(set) var step: Step = .idle
+
+    var busy: Bool {
+        switch step {
+        case .checking, .downloading, .verifying, .installing: return true
+        default: return false
+        }
+    }
+
+    /// GOWA's version once installed by Coucou (not a secret: UserDefaults).
+    static var installedVersion: String? {
+        get { UserDefaults.standard.string(forKey: "whatsappGOWAVersion") }
+        set { UserDefaults.standard.set(newValue, forKey: "whatsappGOWAVersion") }
+    }
+
+    /// Where Coucou keeps the binary it installed.
+    static var binaryURL: URL { WhatsAppGOWAProcess.workingDirectory.appendingPathComponent("gowa") }
+
+    /// A gateway Coucou can start: the one it installed, or one the user picked.
+    static var isInstalled: Bool {
+        let path = (WhatsAppGOWAProcess.binaryPath as NSString).expandingTildeInPath
+        return !path.isEmpty && FileManager.default.isExecutableFile(atPath: path)
+    }
+
+    static var arch: String {
+        #if arch(arm64)
+        return "arm64"
+        #else
+        return "amd64"
+        #endif
+    }
+
+    private let session: URLSession = {
+        let config = URLSessionConfiguration.ephemeral
+        config.urlCache = nil
+        config.httpCookieStorage = nil
+        config.timeoutIntervalForRequest = 30
+        config.timeoutIntervalForResource = 600
+        return URLSession(configuration: config, delegate: GitHubOnly(), delegateQueue: nil)
+    }()
+
+    func install() {
+        guard !busy else { return }
+        step = .checking
+        Task { await run() }
+    }
+
+    private func run() async {
+        do {
+            // 1. Which build: GOWA's latest release, the zip for this Mac.
+            var req = URLRequest(url: WAGOWARelease.latestURL)
+            req.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
+            let (meta, metaResponse) = try await session.data(for: req)
+            guard (metaResponse as? HTTPURLResponse)?.statusCode == 200,
+                  let release = WAGOWARelease.parse(meta),
+                  let picked = WAGOWARelease.pick(release.assets, arch: Self.arch) else {
+                throw Failure(String(localized: "whatsapp.install.no-build"))
+            }
+            var checksums: String? = nil
+            if let sums = picked.checksums {
+                let (data, _) = try await session.data(from: sums.url)
+                checksums = String(data: data, encoding: .utf8)
+            }
+            guard let expected = WAGOWARelease.expectedSHA256(for: picked.zip, checksums: checksums) else {
+                throw Failure(String(localized: "whatsapp.install.no-checksum"))
+            }
+
+            // 2. Download.
+            step = .downloading(megabytes: max(1, picked.zip.size / 1_000_000))
+            let (tmp, zipResponse) = try await session.download(from: picked.zip.url)
+            guard (zipResponse as? HTTPURLResponse)?.statusCode == 200 else { throw Failure(String(localized: "whatsapp.install.download-failed")) }
+
+            // 3. Verify: exactly the file GOWA published.
+            step = .verifying
+            let digest = try await Task.detached { () throws -> String in
+                let data = try Data(contentsOf: tmp)
+                return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
+            }.value
+            guard digest == expected else {
+                try? FileManager.default.removeItem(at: tmp)
+                throw Failure(String(localized: "whatsapp.install.bad-checksum"))
+            }
+
+            // 4. Unzip with macOS's own ditto, put the binary in place, make it runnable.
+            step = .installing
+            let version = release.version
+            let binary = WAGOWARelease.binaryName(arch: Self.arch)
+            try await Task.detached {
+                try Self.unpack(zip: tmp, binaryName: binary)
+            }.value
+            Self.installedVersion = version
+            WhatsAppSettings.gateway = .gowa
+            KeychainStore.shared
```

**File**: `NotchBuddy/Sources/App/WhatsAppGOWAProcess.swift` (modified, +4/-1)
```diff
@@ -28,7 +28,7 @@ final class WhatsAppGOWAProcess {
 
     /// Where GOWA keeps its own WhatsApp session (its database, not Coucou's): one folder in
     /// Application Support, so the link survives restarts.
-    static var workingDirectory: URL {
+    nonisolated static var workingDirectory: URL {
         let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
         return base.appendingPathComponent("Coucou/GOWA", isDirectory: true)
     }
@@ -69,6 +69,9 @@ final class WhatsAppGOWAProcess {
         var env = ProcessInfo.processInfo.environment
         // The credential goes through the environment, not the command line (`ps` shows that).
         if credential.contains(":") { env["APP_BASIC_AUTH"] = credential }
+        // GOWA's own web dashboard is not needed (Coucou is the interface): it would fetch
+        // itself from GitHub at each start.
+        env["APP_UI_ENABLED"] = "false"
         p.environment = env
         // GOWA's own output may name contacts or quote messages: it goes nowhere.
         p.standardOutput = FileHandle.nullDevice
```

**File**: `NotchBuddy/Sources/App/WhatsAppGateway.swift` (modified, +55/-0)
```diff
@@ -235,6 +235,61 @@ enum WAGOWA {
     }
 }
 
+/// GOWA's own releases on GitHub, for "Install WhatsApp" (one click, no Terminal): which zip
+/// fits this Mac and the SHA-256 GOWA publishes for it. The release workflow (GoReleaser,
+/// .github/workflows/release.yml in GOWA's repo) names them `whatsapp_<version>_darwin_<arch>.zip`
+/// (the binary inside is `darwin-<arch>`) next to `checksums-macos.txt`.
+enum WAGOWARelease {
+    static let latestURL = URL(string: "https://api.github.com/repos/aldinokemal/go-whatsapp-web-multidevice/releases/latest")!
+
+    struct Asset: Equatable, Sendable {
+        let name: String
+        let url: URL
+        let size: Int
+        /// "sha256:<hex>" when GitHub gives it.
+        let digest: String?
+    }
+
+    /// `GET /releases/latest` → `{tag_name, assets: [{name, browser_download_url, size, digest?}]}`.
+    static func parse(_ data: Data) -> (version: String, assets: [Asset])? {
+        guard let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
+              let tag = obj["tag_name"] as? String, let list = obj["assets"] as? [[String: Any]] else { return nil }
+        let assets: [Asset] = list.compactMap { a in
+            guard let name = a["name"] as? String, let s = a["browser_download_url"] as? String,
+                  let url = URL(string: s) else { return nil }
+            return Asset(name: name, url: url, size: (a["size"] as? Int) ?? 0, digest: a["digest"] as? String)
+        }
+        let version = tag.hasPrefix("v") ? String(tag.dropFirst()) : tag
+        return (version, assets)
+    }
+
+    /// The zip for this Mac ("arm64" or "amd64") and the macOS checksums file.
+    static func pick(_ assets: [Asset], arch: String) -> (zip: Asset, checksums: Asset?)? {
+        guard let zip = assets.first(where: { $0.name.hasPrefix("whatsapp_") && $0.name.hasSuffix("_darwin_\(arch).zip") }) else { return nil }
+        return (zip, assets.first { $0.name == "checksums-macos.txt" })
+    }
+
+    /// The binary's name inside the zip.
+    static func binaryName(arch: String) -> String { "darwin-\(arch)" }
+
+    /// The SHA-256 (lowercase hex) of `name` in a GoReleaser checksums file ("<hex>  <name>" per line),
+    /// else from GitHub's own "sha256:<hex>" digest.
+    static func expectedSHA256(for asset: Asset, checksums: String?) -> String? {
+        for line in (checksums ?? "").split(whereSeparator: \.isNewline) {
+            let parts = line.split(separator: " ", omittingEmptySubsequences: true)
+            if parts.count == 2, parts[1] == Substring(asset.name), parts[0].count == 64 { return parts[0].lowercased() }
+        }
+        if let d = asset.digest, d.hasPrefix("sha256:"), d.count == 71 { return String(d.dropFirst(7)).lowercased() }
+        return nil
+    }
+
+    /// Only GitHub serves the download (its assets redirect to githubusercontent.com).
+    static func allowedHost(_ host: String?) -> Bool {
+        guard let h = host?.lowercased() else { return false }
+        return h == "github.com" || h == "api.github.com" || h.hasSuffix(".githubusercontent.com")
+    }
+}
+
 enum WAOpenWA {
     /// A session: `{id (uuid), name, status, phone, pushName, …}`.
     /// status: created|initializing|qr_ready|authenticating|ready|disconnected|action_required|failed.
```

**File**: `NotchBuddy/Sources/App/WhatsAppViews.swift` (modified, +124/-43)
```diff
@@ -432,6 +432,8 @@ func waTimeAgo(_ date: Date) -> String {
 struct WhatsAppSettingsSection: View {
     @ObservedObject private var wa = WhatsAppController.shared
     @ObservedObject private var appState = AppState.shared
+    @ObservedObject private var installer = WhatsAppGOWAInstaller.shared
+    @State private var showAdvanced = false
     @State private var enabled = WhatsAppSettings.enabled
     @State private var gateway = WhatsAppSettings.gateway
     @State private var url = KeychainStore.shared.get(WhatsAppSettings.urlKey) ?? ""
@@ -467,50 +469,10 @@ struct WhatsAppSettingsSection: View {
                         .foregroundColor(Color(hex: "#F4505E"))
                 }
 
-                Picker("whatsapp.gateway", selection: $gateway) {
-                    ForEach(WAGatewayKind.allCases, id: \.self) { kind in
-                        Text(verbatim: kind == .gowa ? "GOWA" : "OpenWA").tag(kind)
-                    }
-                }
-                .pickerStyle(.segmented)
+                // One click: Coucou downloads GOWA, checks it and starts it. No Terminal.
+                if gateway == .gowa { installBlock }
 
-                TextField(gateway.defaultURL, text: $url)
-                    .textFieldStyle(.roundedBorder)
-                SecureField(gateway == .gowa ? String(localized: "whatsapp.credential.gowa")
-                                             : String(localized: "whatsapp.credential.openwa"),
-                            text: $credential)
-                    .textFieldStyle(.roundedBorder)
-                if gateway == .gowa { autoStartRow }
-                HStack(spacing: 6) {
-                    Text("whatsapp.port").font(.system(size: 11))
-                    TextField(String(WhatsAppSettings.defaultPort), text: $port)
-                        .textFieldStyle(.roundedBorder)
-                        .frame(width: 80)
-                    Spacer()
-                }
-
-                HStack(spacing: 8) {
-                    Button("whatsapp.save") { save() }
-                        .buttonStyle(.borderedProminent)
-                    Button("whatsapp.test") {
-                        save()
-                        testing = true
-                        Task {
-                            testResult = await wa.testConnection()
-                            testing = false
-                        }
-                    }
-                    .buttonStyle(.bordered)
-                    .disabled(testing)
-                    if testing { ProgressView().controlSize(.small) }
-                }
-                if let testResult {
-                    Text(verbatim: testResult)
-                        .font(.system(size: 10))
-                        .foregroundColor(Color(hex: "#8E939C"))
-                }
-
-                linkState
+                if showsLinkState { linkState }
 
                 // Filters
                 Toggle("whatsapp.mute-groups", isOn: Binding(
@@ -541,6 +503,66 @@ struct WhatsAppSettingsSection: View {
                     .font(.system(size: 10))
                     .foregroundColor(Color(hex: "#8E939C"))
                     .fixedSize(horizontal: false, vertical: true)
+
+                // Your own gateway (OpenWA, another address, a password, the port): folded away.
+                DisclosureGroup(isExpanded: $showAdvanced) {
+                    VStack(alignment: .leading, spacing: 6) {
+                        Picker("whatsapp.gateway", selection: $gateway) {
+                            ForEach(WAGatewayKind.allCases, id: \.self) { kind in
+                                Text(verbatim: kind == .gowa ? "GOWA" : "OpenWA").tag(kind)
+                            }
+                        }
+                        .pickerStyle(.segmented)
+
+                        TextField(gateway.defaultURL, text: $url)
+                            .textFieldStyle(.roundedBorder)
+                        SecureField(gateway == .gowa ? String(localized: "whatsapp.credential.gowa")
+                                                     : String(localized: "whatsapp.credential.openwa"),
+                                    text: $credential)
+                            .textFieldStyle(.roundedBorder)
+                        if gateway == .gowa { autoStartRow }
+                        HStack(spacing: 6) {
+                            Text("whatsapp.port").font(.system(size: 11))
+                            TextField(String(WhatsAppSettings.defaultPort), text: $port)
+                                .textFieldStyle(.roundedBorder)
+                                .frame(width: 80)
+                            Spacer()
+                        }
+
+                        HStack(spacing: 8) {
+                            Button("whatsapp.save") { save() }
+                                .buttonStyle(.borderedProminent)
+                            Button("whatsapp.test") {
+                                save()
+                  
```

**File**: `NotchBuddy/project.yml` (modified, +2/-2)
```diff
@@ -137,8 +137,8 @@ targets:
         CFBundleName: Coucou
         CFBundleDisplayName: Coucou
         CFBundleIdentifier: fr.louisraille.NotchBuddy
-        CFBundleVersion: "17"
-        CFBundleShortVersionString: "0.5.0"
+        CFBundleVersion: "18"
+        CFBundleShortVersionString: "0.5.1"
         CFBundlePackageType: APPL
         LSUIElement: YES
         NSHighResolutionCapable: YES
```

#### Recent Merged Pull Requests:
- **PR #806** (closed): update (@betodoescher)
- **PR #800** (2026-10-18): WhatsApp in one click, Mac 0.5.1 (@Louis-CFM)
- **PR #799** (2026-10-18): Mac 0.5.0 (@Louis-CFM)
- **PR #798** (2026-10-18): WhatsApp pill (experimental) (@Louis-CFM)
- **PR #796** (closed): Fix/linux desktop voice (@PedroMglo)
- **PR #783** (2026-10-16): dev-install.sh: works with macOS's bash 3.2 (@Louis-CFM)

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

## X. a crash: the thermal state change arrives off the main thread

**RULE**:
When implementing operations in `NotchBuddy/Sources/App/MachineVitals.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Louis-CFM/coucou. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f931645e`: a crash: the thermal state change arrives off the main thread. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `NotchBuddy/Sources/App/MachineVitals.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // Everything is received on the main thread: macOS posts some of these (the thermal
        // state) from a background queue, and Mochi's code only runs on the main one.
        state.$mode.removeDuplicates().receive(on: DispatchQueue.main).sink { [weak self] _ in
        state.$mochiOnDesktop.removeDuplicates().receive(on: DispatchQueue.main).sink { [weak self] _ in
            .receive(on: DispatchQueue.main)
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
        state.$mode.removeDuplicates().sink { [weak self] _ in
        state.$mochiOnDesktop.removeDuplicates().sink { [weak self] _ in
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f931645e` are properly handled with clean fallback behavior.
