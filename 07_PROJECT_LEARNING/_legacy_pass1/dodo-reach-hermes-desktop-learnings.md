# Forensic Learning Record (Deep Inspection): dodo-reach/hermes-desktop

> **Canonical Artifact**: `07_PROJECT_LEARNING/dodo-reach-hermes-desktop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dodo-reach/hermes-desktop](https://github.com/dodo-reach/hermes-desktop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:50:14.191Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dodo-reach/hermes-desktop`
- **Description**: The safest, simplest way to manage Hermes from your Mac. Pure SSH. No gateways, no exposed ports, no browser layer.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2023 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/HermesDesktop/App/AppState.swift`
```
import Combine
import Foundation
import SwiftUI

private enum PendingSectionEntryAction {
    case openNewConnectionEditor
    case prepareNewSessionComposer
    case openNewTerminalTab(ConnectionProfile)
}

@MainActor
final class AppState: ObservableObject {
    @Published var selectedSection: AppSection = .connections
    @Published var activeAlert: AppAlert?
    @Published var isBusy = false
    @Published var statusMessage: String?
    @Published var overview: RemoteDiscovery?
    @Published var overviewError: String?
    @Published var lastOverviewRefreshedAt: Date?
    @Published var isRefreshingOverview = false
    @Published var activeConnectionID: UUID?
    @Published var selectedSessionID: String?
    @Published var selectedSessionDetailMode: SessionDetailMode = .transcript
    @Published private(set) var sessionTUITerminal: SessionTUITerminal?
    @Published var sessions: [SessionSummary] = []
    @Published var sessionMessages: [SessionMessage] = []
    @Published var sessionMessageDisplays: [SessionMessageDisplay] = []
    @Published var sessionsError: String?
    @Published var isLoadingSessions = false
    @Published var isRefreshingSessions = false
    @Published var isDeletingSession = false
    @Published var sessionCompactionNotice: SessionCompactionNotice?
    @Published var hasMoreSessions = false
    @Published var totalSessionsCount = 0
    @Published private(set) var sessionSearchQuery = ""
    @Published private(set) var sessionPinStateVersion = 0
    @Published var selectedWorkflowID: UUID?
    @Published var workflows: [WorkflowPreset] = []
    @Published var usageSummary: UsageSummary?
    @Published var usageProfileBreakdown: UsageProfileBreakdown?
    @Published var usageError: String?
    @Published var isLoadingUsage = false
    @Published var isRefreshingUsage = false
    @Published var selectedSkillID: String?
    @Published var skills: [SkillSummary] = []
    @Published var selectedSkillDetail: SkillDetail?
    @Published var skillsError: String?
    @Published var isLoadingSkills = false
    @Published var isRefreshingSkills = false
    @Published var isLoadingSkillDetail = false
    @Published var isSavingSkillDraft = false
    @Published var cronJobs: [CronJob] = []
    @Published var selectedCronJobID: String?
    @Published var cronJobsError: String?
    @Published var isLoadingCronJobs = false
    @Published var isRefreshingCronJobs = false
    @Published var isOperatingOnCronJob = false
    @Published var operatingCronJobID: String?
    @Published var isSavingCronJobDraft = false
    @Published var kanbanBoards: [KanbanProject] = []
    @Published var selectedKanbanBoardSlug = KanbanProject.defaultSlug
    @Published var remoteCurrentKanbanBoardSlug: String?
    @Published var supportsKanbanBoardManagement = false
    @Published var kanbanBoard: KanbanBoard?
    @Published var selectedKanbanTaskID: String?
    @Published var selectedKanbanTaskDetail: KanbanTaskDetail?
    @Published var kanbanError: String?
    @Published var isLoadingKanbanBoards = false
    @Published var isLoadingKanbanBoard = false
    @Published var isRefreshingKanbanBoard = false
    @Published var isLoadingKanbanTaskDetail = false
    @Published var isOperatingOnKanbanTask = false
    @Published var operatingKanbanTaskID: String?
    @Published var isSavingKanbanTaskDraft = false
    @Published var isSavingKanbanBoardDraft = false
    @Published var isOperatingOnKanbanBoard = false
    @Published var isDispatchingKanban = false
    @Published var includeArchivedKanbanTasks = false
    @Published var selectedWorkspaceFileID: String = RemoteTrackedFile.memory.workspaceFileID
    @Published var workspaceFileDocuments: [String: FileEditorDocument] = [:]
    @Published var workspaceFileBrowserListing: RemoteDirectoryListing?
    @Published var workspaceFileBrowserError: String?
    @Published var isLoadingWorkspaceFileBrowser = false
    @Published var pendingSectionSelection: AppSection?
    @Published var showDiscardChangesAlert = false
    @Published var pendingNewConnectionEditorRequestID: UUID?
    @Published var searchFocusRequestID: UUID?
    @Published var availableUpdate: AvailableUpdate?
    @Published var isCheckingForUpdates = false

    let connectionStore: ConnectionStore
    let sshTransport: SSHTransport
    let remoteHermesService: RemoteHermesService
    let fileEditorService: FileEditorService
    let sessionBrowserService: SessionBrowserService
    let usageBrowserService: UsageBrowserService
    let skillBrowserService: SkillBrowserService
    let cronBrowserService: CronBrowserService
    let kanbanBrowserService: KanbanBrowserService
    let updateCheckService: UpdateCheckService
    let terminalWorkspace: TerminalWorkspaceStore
    let workflowLaunchDiagnostics: WorkflowLaunchDiagnostics

    private let sessionPageSize = 50
    private var sessionOffset = 0
    private var pendingSessionReloadQuery: String?
    private var pendingSectionEntryAction: PendingSectionEntryAction?
    private var isNewSessionComposerActive = false
    private var sessionScrollOffsets: [String: CGFloat] = [:]
    private var sessionMessageSignature = SessionMessageSignature(messages: [])
    private var connectionTestRequestID: UUID?
    private var overviewRefreshWorkspaceFingerprint: String?
    private var hasPerformedAutomaticUpdateCheck = false
    private let automaticUpdateCheckInterval: TimeInterval = 24 * 60 * 60
    private var statusTask: Task<Void, Never>?
    private var cancellables = Set<AnyCancellable>()

    convenience init(updateCheckService: UpdateCheckService = UpdateCheckService()) {
        self.init(paths: AppPaths(), updateCheckService: updateCheckService)
    }

    init(paths: AppPaths, updateCheckService: UpdateCheckService = UpdateCheckService()) {
        let connectionStore = ConnectionStore(paths: paths)
        let sshTransport = SSHTransport(paths: paths)
        let workflowLaunchLogURL = paths.applicationSupportURL
            .appendingPathComponent("Diagnostics", isDirectory: true)
            .appendingPathComponent("workflow-launch-latest.log")
        let workflowLaunchDiagnostics = WorkflowLaunchDiagnostics(logFileURL: workflowLaunchLogURL)

        self.connectionStore = connectionStore
        self.sshTransport = sshTransport
        self.remoteHermesService = RemoteHermesService(sshTransport: sshTransport)
        self.fileEditorService = FileEditorService(sshTransport: sshTransport)
        self.sessionBrowserService = SessionBrowserService(sshTransport: sshTransport)
        self.usageBrowserService = UsageBrowserService(sshTransport: sshTransport)
        self.skillBrowserService = SkillBrowserService(sshTransport: sshTransport)
        self.cronBrowserService = CronBrowserService(sshTransport: sshTransport)
        self.kanbanBrowserService = KanbanBrowserService(sshTransport: sshTransport)
        self.updateCheckService = updateCheckService
        self.workflowLaunchDiagnostics = workflowLaunchDiagnostics
        self.terminalWorkspace = TerminalWorkspaceStore(
            sshTransport: sshTransport,
            workflowLaunchDiagnostics: workflowLaunchDiagnostics
        )

        connectionStore.objectWillChange
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)

        connectionStore.$persistenceError
            .compactMap { $0 }
            .sink { [weak self] message in
                self?.activeAlert = AppAlert(
                    title: L10n.string("Local storage error"),
                    message: message
                )
                self?.setStatusMessage(L10n.string("Local storage error"))
            }
            .store(in: &cancellables)

        self.activeConnectionID = resolvedActiveConnectionID(preferred: connectionStore.lastConnectionID)
        persistActiveConnectionSelectionIfNeeded()

        selectedSection = .connections
    }

    var activeConnection: ConnectionProfile? {
        guard let activeConnectionID else { return nil }
        return connectionStore.connections.first(where: { $0.id == activeConnectionID })
    }

    var selectedKanbanBoard: KanbanProject? {
        kanbanBoards.first(where: { $0.slug == selectedKanbanBoardSlug })
    }

    var canonicalWorkspaceFileReferences: [WorkspaceFileReference] {
        guard let activeConnection else { return [] }

        return RemoteTrackedFile.allCases.map { trackedFile in
            WorkspaceFileReference.canonical(
                trackedFile,
                remotePath: resolvedRemotePath(for: trackedFile, connection: activeConnection)
            )
        }
    }

    var bookmarkedWorkspaceFileReferences: [WorkspaceFileReference] {
        guard let activeConnection else { return [] }

        return connectionStore
            .bookmarks(for: activeConnection.workspaceScopeFingerprint)
            .map(WorkspaceFileReference.bookmark)
    }

    var bookmarkedWorkspaceFileGroups: [WorkspaceFileBookmarkGroup] {
        WorkspaceFileBookmarkGroup.groups(for: bookmarkedWorkspaceFileReferences)
    }

    var workspaceFileReferences: [WorkspaceFileReference] {
        canonicalWorkspaceFileReferences + bookmarkedWorkspaceFileReferences
    }

    var pinnedSessionSummaries: [SessionSummary] {
        guard let activeConnection else { return [] }

        return connectionStore
            .pinnedSessions(for: activeConnection.workspaceScopeFingerprint)
            .map { pinnedSession in
                sessions.first(where: { $0.id == pinnedSession.id }) ?? pinnedSession.summary
            }
    }

    var unpinnedSessions: [SessionSummary] {
        guard let activeConnection else { return sessions }
        let pinnedIDs = Set(
            connectionStore
                .pinnedSessions(for: activeConnection.workspaceScopeFingerprint)
                .map(\.id)
        )
        return sessions.filter { !pinnedIDs.contains($0.id) }
    }

    var selectedWork
```

### Core Architecture Module: `Sources/HermesDesktop/Utilities/DateFormatters.swift`
```
import Foundation

extension ISO8601DateFormatter {
    static func fractionalSecondsFormatter() -> ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }
}

enum DateFormatters {
    static func relativeFormatter() -> RelativeDateTimeFormatter {
        let cacheKey = "HermesDesktop.relativeFormatter"
        if let formatter = Thread.current.threadDictionary[cacheKey] as? RelativeDateTimeFormatter {
            return formatter
        }

        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        Thread.current.threadDictionary[cacheKey] = formatter
        return formatter
    }

    static func shortDateTimeFormatter() -> DateFormatter {
        let cacheKey = "HermesDesktop.shortDateTimeFormatter"
        if let formatter = Thread.current.threadDictionary[cacheKey] as? DateFormatter {
            return formatter
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        Thread.current.threadDictionary[cacheKey] = formatter
        return formatter
    }

    static func shortDateTimeString(from date: Date) -> String {
        shortDateTimeFormatter().string(from: date)
    }
}

```

### Core Architecture Module: `Sources/HermesDesktop/Utilities/Localization.swift`
```
import Foundation

enum L10n {
    static func string(_ key: String) -> String {
        for bundle in localizationBundles {
            let value = NSLocalizedString(key, bundle: bundle, value: "", comment: "")
            if !value.isEmpty, value != key {
                return value
            }
        }

        return key
    }

    static func string(_ key: String, _ arguments: CVarArg...) -> String {
        String(format: string(key), arguments: arguments)
    }

    private static let localizationBundles: [Bundle] = {
        let resourceBundleName = "HermesDesktop_HermesDesktop.bundle"
        let candidateURLs = [
            Bundle.main.resourceURL?.appendingPathComponent(resourceBundleName),
            Bundle.main.bundleURL.appendingPathComponent(resourceBundleName)
        ].compactMap { $0 }

        let resourceBundles = candidateURLs.compactMap(Bundle.init(url:))
        return [.main] + resourceBundles
    }()
}

```

### Core Architecture Module: `Sources/HermesDesktop/Utilities/RemotePythonScript.swift`
```
import Foundation

enum RemotePythonScript {
    static func wrap<Payload: Encodable>(_ payload: Payload, body: String) throws -> String {
        let encoder = JSONEncoder()
        let data = try encoder.encode(payload)
        let encodedPayload = data.base64EncodedString()

        return """
        import base64
        import json
        import pathlib
        import sys

        payload = json.loads(base64.b64decode("\(encodedPayload)").decode("utf-8"))

        \(sharedHelpers)

        \(body)
        """
    }

    private static let sharedHelpers = """
    import os
    import shutil
    import sqlite3

    def fail(message):
        print(json.dumps({
            "ok": False,
            "error": message,
        }, ensure_ascii=False))
        sys.exit(1)

    def stringify(value):
        if value is None:
            return None
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")
        return str(value)

    def normalize_text(value):
        text = stringify(value)
        if text is None:
            return None
        text = text.strip()
        return text or None

    def choose_table(tables, needle):
        lowered = needle.lower()
        for name in tables:
            if name.lower() == lowered:
                return name
        for name in tables:
            if lowered in name.lower():
                return name
        return None

    def choose_column(columns, choices):
        lowered = {column.lower(): column for column in columns}
        for choice in choices:
            if choice.lower() in lowered:
                return lowered[choice.lower()]
        for choice in choices:
            for column in columns:
                if choice.lower() in column.lower():
                    return column
        return None

    def quote_ident(value):
        return '"' + str(value).replace('"', '""') + '"'

    def quote_text(value):
        return "'" + str(value).replace("'", "''") + "'"

    def connect_sqlite_readonly(path):
        connection = None
        try:
            connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            connection.execute("PRAGMA schema_version").fetchone()
            return connection
        except sqlite3.OperationalError as exc:
            if connection is not None:
                try:
                    connection.close()
                except Exception:
                    pass
            message = str(exc).lower()
            if "unable to open database file" not in message and "readonly database" not in message:
                raise
            return sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)

    def expand_remote_path(value, home=None, base_dir=None):
        if home is None:
            home = pathlib.Path.home()

        normalized = normalize_text(value)
        if normalized is None:
            return None
        expanded = os.path.expandvars(normalized)
        try:
            path = pathlib.Path(expanded).expanduser()
        except Exception:
            path = pathlib.Path(expanded)

        if not path.is_absolute():
            if expanded == "~":
                return home
            if expanded.startswith("~/"):
                return home / expanded[2:]
            if base_dir is not None:
                return base_dir / path
        return path

    def resolved_hermes_home(request=None):
        request_data = payload if request is None else request
        home = pathlib.Path.home()
        expanded = expand_remote_path(request_data.get("hermes_home"), home)
        if expanded is not None:
            return expanded
        env_home = expand_remote_path(os.environ.get("HERMES_HOME"), home)
        if env_home is not None:
            return env_home
        return home / ".hermes"

    def hermes_search_path(request=None):
        home = pathlib.Path.home()
        hermes_home = resolved_hermes_home(request)
        candidates = [
            hermes_home / "hermes-agent" / "venv" / "bin",
            home / ".local" / "bin",
            home / ".hermes" / "hermes-agent" / "venv" / "bin",
            home / ".cargo" / "bin",
            pathlib.Path("/opt/homebrew/bin"),
            pathlib.Path("/usr/local/bin"),
        ]

        entries = []
        seen = set()
        for candidate in candidates:
            try:
                entry = str(candidate)
            except Exception:
                continue
            if not entry or entry in seen:
                continue
            seen.add(entry)
            entries.append(entry)

        env_path = os.environ.get("PATH", "")
        if env_path:
            entries.append(env_path)
        return os.pathsep.join(entries)

    def find_hermes_binary(request=None):
        candidate = shutil.which("hermes", path=hermes_search_path(request))
        if candidate:
            return candidate
        return None

    def tilde(path, home=None):
        if home is None:
            home = pathlib.Path.home()
        try:
            relative = path.relative_to(home)
            return "~/" + relative.as_posix() if relative.as_posix() != "." else "~"
        except ValueError:
            return path.as_posix()

    def iter_session_store_candidates(hermes_home, home=None, hinted_path=None):
        if home is None:
            home = pathlib.Path.home()

        seen = set()

        def emit(candidate):
            if candidate is None:
                return None
            resolved = str(candidate)
            if resolved in seen or not candidate.is_file():
                return None
            seen.add(resolved)
            return candidate

        hinted_candidate = emit(expand_remote_path(hinted_path, home))
        if hinted_candidate is not None:
            yield hinted_candidate

        preferred = [
            hermes_home / "state.db",
            hermes_home / "state.sqlite",
            hermes_home / "state.sqlite3",
            hermes_home / "store.db",
            hermes_home / "store.sqlite",
            hermes_home / "store.sqlite3",
        ]

        for candidate in preferred:
            candidate = emit(candidate)
            if candidate is not None:
                yield candidate

        for candidate in sorted(
            [
                item
                for pattern in ("*.db", "*.sqlite", "*.sqlite3")
                for item in hermes_home.glob(pattern)
                if item.is_file()
            ],
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        ):
            candidate = emit(candidate)
            if candidate is not None:
                yield candidate

        sessions_dir = hermes_home / "sessions"
        if sessions_dir.exists():
            for candidate in sorted(
                [
                    item
                    for pattern in ("*.db", "*.sqlite", "*.sqlite3")
                    for item in sessions_dir.rglob(pattern)
                    if item.is_file()
                ],
                key=lambda item: item.stat().st_mtime,
                reverse=True,
            ):
                candidate = emit(candidate)
                if candidate is not None:
                    yield candidate
    """
}

```

### Core Architecture Module: `Sources/HermesDesktop/Utilities/ShellCommandQuoting.swift`
```
import Foundation

extension String {
    var shellQuotedForTerminalCommand: String {
        guard !isEmpty else { return "''" }

        let safeCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_+-./:=@")
        if unicodeScalars.allSatisfy({ safeCharacters.contains($0) }) {
            return self
        }

        return "'" + replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}

```

### Core Architecture Module: `Sources/HermesDesktop/Utilities/WorkflowLaunchDiagnostics.swift`
```
import CryptoKit
import Foundation
import OSLog

struct WorkflowLaunchDiagnosticsContext: Sendable {
    let runID: UUID
    let workflowID: UUID
    let workflowName: String
    let connectionLabel: String
    let hermesProfileName: String?
    let skillRelativePaths: [String]
    let commandLine: String
    let originalPromptCharacterCount: Int
    let originalPromptUTF8ByteCount: Int
    let originalPromptLineCount: Int
    let originalPromptHashPrefix: String
    let normalizedPromptCharacterCount: Int
    let normalizedPromptUTF8ByteCount: Int
    let normalizedPromptLineCount: Int
    let normalizedPromptHashPrefix: String
    let requestedAt: Date

    init(
        workflow: WorkflowPreset,
        invocation: WorkflowLaunchInvocation,
        connection: ConnectionProfile,
        requestedAt: Date = Date()
    ) {
        let originalPrompt = workflow.prompt
        let normalizedPrompt = invocation.initialInput

        self.runID = UUID()
        self.workflowID = workflow.id
        self.workflowName = workflow.name
        self.connectionLabel = connection.label
        self.hermesProfileName = connection.trimmedHermesProfile
        self.skillRelativePaths = invocation.skillRelativePaths
        self.commandLine = invocation.commandLine
        self.originalPromptCharacterCount = originalPrompt.count
        self.originalPromptUTF8ByteCount = originalPrompt.lengthOfBytes(using: .utf8)
        self.originalPromptLineCount = Self.lineCount(for: originalPrompt)
        self.originalPromptHashPrefix = Self.hashPrefix(for: originalPrompt)
        self.normalizedPromptCharacterCount = normalizedPrompt.count
        self.normalizedPromptUTF8ByteCount = normalizedPrompt.lengthOfBytes(using: .utf8)
        self.normalizedPromptLineCount = Self.lineCount(for: normalizedPrompt)
        self.normalizedPromptHashPrefix = Self.hashPrefix(for: normalizedPrompt)
        self.requestedAt = requestedAt
    }

    func elapsedMilliseconds(at date: Date = Date()) -> Int {
        max(0, Int(date.timeIntervalSince(requestedAt) * 1000))
    }

    private static func lineCount(for value: String) -> Int {
        guard !value.isEmpty else { return 0 }
        return value.components(separatedBy: .newlines).count
    }

    private static func hashPrefix(for value: String) -> String {
        let digest = SHA256.hash(data: Data(value.utf8))
        return digest.prefix(6).map { String(format: "%02x", $0) }.joined()
    }
}

enum WorkflowInitialInputDeliveryMode: String, Sendable {
    case bracketedPaste = "bracketed_paste"
    case standardSubmit = "standard_submit"
}

actor WorkflowLaunchDiagnostics {
    nonisolated let logFileURL: URL

    private let fileManager: FileManager
    private let logger: Logger
    private let dateFormatter: ISO8601DateFormatter

    init(logFileURL: URL, fileManager: FileManager = .default) {
        let diagnosticsDirectoryURL = logFileURL.deletingLastPathComponent()
        let subsystem = Bundle.main.bundleIdentifier ?? "HermesDesktop"

        self.logFileURL = logFileURL
        self.fileManager = fileManager
        self.logger = Logger(subsystem: subsystem, category: "WorkflowLaunch")
        self.dateFormatter = ISO8601DateFormatter()
        self.dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        try? fileManager.createDirectory(at: diagnosticsDirectoryURL, withIntermediateDirectories: true)
        try? Data().write(to: logFileURL, options: .atomic)

        let sessionStartedLine = Self.makeLine(
            dateFormatter: dateFormatter,
            event: "diagnostics_session_started",
            fields: [
                "banner": "=== Hermes Desktop workflow launch diagnostics session started ===",
                "log_path": logFileURL.path
            ]
        )
        Self.appendLineSynchronously(
            sessionStartedLine,
            logger: logger,
            fileManager: fileManager,
            logFileURL: logFileURL
        )
    }

    func recordWorkflowRunRequested(_ context: WorkflowLaunchDiagnosticsContext) {
        record(
            event: "workflow_run_requested",
            context: context,
            fields: [
                "command_line": context.commandLine,
                "connection": context.connectionLabel,
                "hermes_profile": context.hermesProfileName ?? "default",
                "normalized_prompt_chars": "\(context.normalizedPromptCharacterCount)",
                "normalized_prompt_hash": context.normalizedPromptHashPrefix,
                "normalized_prompt_lines": "\(context.normalizedPromptLineCount)",
                "normalized_prompt_utf8_bytes": "\(context.normalizedPromptUTF8ByteCount)",
                "original_prompt_chars": "\(context.originalPromptCharacterCount)",
                "original_prompt_hash": context.originalPromptHashPrefix,
                "original_prompt_lines": "\(context.originalPromptLineCount)",
                "original_prompt_utf8_bytes": "\(context.originalPromptUTF8ByteCount)",
                "skill_count": "\(context.skillRelativePaths.count)",
                "skills": context.skillRelativePaths.joined(separator: ","),
                "workflow_id": context.workflowID.uuidString.lowercased(),
                "workflow_name": context.workflowName
            ]
        )
    }

    func recordTerminalProcessStarted(_ context: WorkflowLaunchDiagnosticsContext) {
        record(
            event: "terminal_process_started",
            context: context,
            fields: [:]
        )
    }

    func recordInitialInputWaitStarted(_ context: WorkflowLaunchDiagnosticsContext, deadlineMilliseconds: Int) {
        record(
            event: "initial_input_wait_started",
            context: context,
            fields: [
                "deadline_ms": "\(deadlineMilliseconds)"
            ]
        )
    }

    func recordBracketedPasteModeObserved(
        _ context: WorkflowLaunchDiagnosticsContext,
        stage: String
    ) {
        record(
            event: "bracketed_paste_mode_observed",
            context: context,
            fields: [
                "stage": stage
            ]
        )
    }

    func recordInitialInputSent(
        _ context: WorkflowLaunchDiagnosticsContext,
        deliveryMode: WorkflowInitialInputDeliveryMode,
        reason: String,
        bracketedPasteModeAtSend: Bool
    ) {
        record(
            event: "initial_input_sent",
            context: context,
            fields: [
                "bracketed_paste_mode_at_send": bracketedPasteModeAtSend ? "true" : "false",
                "delivery_mode": deliveryMode.rawValue,
                "reason": reason
            ]
        )
    }

    func recordInitialInputAborted(
        _ context: WorkflowLaunchDiagnosticsContext,
        reason: String
    ) {
        record(
            event: "initial_input_aborted",
            context: context,
            fields: [
                "reason": reason
            ]
        )
    }

    func recordTerminalProcessExited(
        _ context: WorkflowLaunchDiagnosticsContext,
        exitCode: Int32?
    ) {
        record(
            event: "terminal_process_exited",
            context: context,
            fields: [
                "exit_code": exitCode.map(String.init) ?? "nil"
            ]
        )
    }

    private func record(
        event: String,
        context: WorkflowLaunchDiagnosticsContext,
        fields: [String: String]
    ) {
        var values = fields
        values["elapsed_ms"] = "\(context.elapsedMilliseconds())"
        Self.appendLineSynchronously(Self.makeLine(
            dateFormatter: dateFormatter,
            event: event,
            runID: context.runID,
            fields: values
        ), logger: logger, fileManager: fileManager, logFileURL: logFileURL)
    }

    private static func makeLine(
        dateFormatter: ISO8601DateFormatter,
        event: String,
        runID: UUID? = nil,
        fields: [String: String]
    ) -> String {
        var segments = [
            "ts=\(dateFormatter.string(from: Date()))",
            "event=\(event)"
        ]

        if let runID {
            segments.append("run=\(runID.uuidString.lowercased())")
        }

        for key in fields.keys.sorted() {
            guard let value = fields[key] else { continue }
            segments.append("\(key)=\(Self.sanitize(value))")
        }

        return segments.joined(separator: " | ")
    }

    private static func sanitize(_ value: String) -> String {
        let cleaned = value
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "|", with: "/")
            .replacingOccurrences(of: "\"", with: "'")
        return "\"\(cleaned)\""
    }

    private static func appendLineSynchronously(
        _ line: String,
        logger: Logger,
        fileManager: FileManager,
        logFileURL: URL
    ) {
        logger.notice("\(line, privacy: .public)")

        let payload = Data((line + "\n").utf8)
        if !fileManager.fileExists(atPath: logFileURL.path) {
            fileManager.createFile(atPath: logFileURL.path, contents: Data(), attributes: nil)
        }

        guard let handle = try? FileHandle(forWritingTo: logFileURL) else { return }
        defer {
            try? handle.close()
        }

        do {
            try handle.seekToEnd()
            try handle.write(contentsOf: payload)
        } catch {
            return
        }
    }
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version: 6.1

import PackageDescription

let package = Package(
    name: "HermesDesktop",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "HermesDesktop",
            targets: ["HermesDesktop"]
        )
    ],
    dependencies: [
        .package(path: "Vendor/SwiftTerm")
    ],
    targets: [
        .executableTarget(
            name: "HermesDesktop",
            dependencies: [
                .product(name: "SwiftTerm", package: "SwiftTerm")
            ],
            path: "Sources/HermesDesktop",
            resources: [
                .process("Resources")
            ]
        ),
        .testTarget(
            name: "HermesDesktopTests",
            dependencies: ["HermesDesktop"],
            path: "Tests/HermesDesktopTests"
        )
    ]
)

```

### Core Architecture Module: `Sources/HermesDesktop/App/HermesApplicationDelegate.swift`
```
import AppKit

@MainActor
final class HermesApplicationDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ _: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        NSWindow.allowsAutomaticWindowTabbing = false
    }
}

```

### Core Architecture Module: `Sources/HermesDesktop/App/HermesDesktopApp.swift`
```
import AppKit
import SwiftUI

@main
struct HermesDesktopApp: App {
    @NSApplicationDelegateAdaptor(HermesApplicationDelegate.self) private var appDelegate
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup("Hermes Desktop") {
            RootView()
                .environmentObject(appState)
                .frame(minWidth: HermesSplitMetrics.minimumWindowWidth, minHeight: 520)
                .background(
                    HermesWindowTitleBarConfigurator(
                        backgroundImageActive: appState.connectionStore.isBackgroundImageActive,
                        windowOpacity: appState.connectionStore.windowOpacity,
                        windowMaterial: appState.connectionStore.windowMaterial
                    )
                )
        }
        .defaultSize(width: 1360, height: 860)
        .commands {
            HermesDesktopCommands(appState: appState)
        }
    }
}

```

### Core Architecture Module: `Sources/HermesDesktop/App/HermesDesktopCommands.swift`
```
import SwiftUI

struct HermesDesktopCommands: Commands {
    @ObservedObject var appState: AppState

    var body: some Commands {
        CommandMenu(L10n.string("Hermes")) {
            Button(L10n.string("New Host")) {
                appState.requestNewConnectionEditorFromCommand()
            }
            .keyboardShortcut("n", modifiers: [.command, .shift])

            Button(L10n.string("New Chat")) {
                appState.requestNewSessionFromCommand()
            }
            .keyboardShortcut("n", modifiers: [.command, .option])
            .disabled(appState.activeConnection == nil)

            Button(L10n.string("New Terminal Tab")) {
                appState.openNewTerminalTabFromCommand()
            }
            .keyboardShortcut("t", modifiers: [.command, .option])
            .disabled(appState.activeConnection == nil)

            Divider()

            Button(L10n.string("Refresh Current Section")) {
                Task {
                    await appState.refreshCurrentSectionFromCommand()
                }
            }
            .keyboardShortcut("r", modifiers: [.command])
            .disabled(!appState.canRefreshCurrentSection)

            Button(L10n.string("Find in Current Section")) {
                appState.requestSearchFocusFromCommand()
            }
            .keyboardShortcut("f", modifiers: [.command])
            .disabled(!appState.canFocusSearchCurrentSection)

            Button(L10n.string("Save Current File")) {
                Task {
                    await appState.saveSelectedWorkspaceFile()
                }
            }
            .keyboardShortcut("s", modifiers: [.command])
            .disabled(!appState.canSaveCurrentWorkspaceFile)

            Divider()

            Toggle(
                L10n.string("Check Automatically for Hermes Desktop Updates"),
                isOn: Binding(
                    get: { appState.connectionStore.automaticallyChecksForUpdates },
                    set: { appState.updateAutomaticUpdateChecks($0) }
                )
            )

            Button(L10n.string("Check for Hermes Desktop Updates…")) {
                Task {
                    await appState.checkForUpdatesFromCommand()
                }
            }
            .disabled(appState.isCheckingForUpdates)
        }

        CommandMenu(L10n.string("Navigate")) {
            ForEach(AppSection.navigationCases) { section in
                Button(L10n.string("Show %@", section.title)) {
                    appState.requestSectionSelection(section)
                }
                .keyboardShortcut(section.navigationShortcutKey, modifiers: [.command])
                .disabled(!appState.isSectionAvailable(section))
            }
        }
    }
}

```

### Core Architecture Module: `Sources/HermesDesktop/Models/AppAlert.swift`
```
import Foundation

struct AppAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

```

### Core Architecture Module: `Sources/HermesDesktop/Models/AppAppearancePreference.swift`
```
import AppKit
import SwiftUI

enum AppAppearancePreference: String, CaseIterable, Codable, Identifiable {
    case system
    case dark
    case light

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .system:
            return "System"
        case .dark:
            return "Dark"
        case .light:
            return "Light"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system:
            return nil
        case .dark:
            return .dark
        case .light:
            return .light
        }
    }

    var nsAppearance: NSAppearance? {
        switch self {
        case .system:
            return nil
        case .dark:
            return NSAppearance(named: .darkAqua)
        case .light:
            return NSAppearance(named: .aqua)
        }
    }

    @MainActor
    func applyToApplication() {
        let appearance = nsAppearance
        NSApplication.shared.appearance = appearance
        for window in NSApplication.shared.windows {
            window.appearance = appearance
            window.viewsNeedDisplay = true
        }
    }
}

enum TerminalFontPreference {
    static let defaultSize: Double = 13
    static let minimumSize: Double = 10
    static let maximumSize: Double = 20

    static func clamped(_ value: Double) -> Double {
        min(max(value, minimumSize), maximumSize)
    }
}

enum TerminalFontFamilyPreference: String, CaseIterable, Codable, Identifiable {
    case systemMonospaced
    case sfMono
    case menlo
    case monaco
    case courier
    case courierNew
    case andaleMono
    case sourceCodePro
    case jetBrainsMono
    case firaCode
    case cascadiaCode
    case hack
    case iosevka

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .systemMonospaced:
            return "System Mono"
        case .sfMono:
            return "SF Mono"
        case .menlo:
            return "Menlo"
        case .monaco:
            return "Monaco"
        case .courier:
            return "Courier"
        case .courierNew:
            return "Courier New"
        case .andaleMono:
            return "Andale Mono"
        case .sourceCodePro:
            return "Source Code Pro"
        case .jetBrainsMono:
            return "JetBrains Mono"
        case .firaCode:
            return "Fira Code"
        case .cascadiaCode:
            return "Cascadia Code"
        case .hack:
            return "Hack"
        case .iosevka:
            return "Iosevka"
        }
    }

    func font(size: Double) -> NSFont {
        let clampedSize = CGFloat(TerminalFontPreference.clamped(size))
        switch self {
        case .systemMonospaced:
            return NSFont.monospacedSystemFont(ofSize: clampedSize, weight: .regular)
        case .sfMono:
            return Self.font(named: ["SFMono-Regular", "SF Mono"], size: clampedSize)
        case .menlo:
            return Self.font(named: ["Menlo-Regular", "Menlo"], size: clampedSize)
        case .monaco:
            return Self.font(named: ["Monaco"], size: clampedSize)
        case .courier:
            return Self.font(named: ["Courier", "CourierNewPSMT"], size: clampedSize)
        case .courierNew:
            return Self.font(named: ["CourierNewPSMT", "Courier New"], size: clampedSize)
        case .andaleMono:
            return Self.font(named: ["AndaleMono", "Andale Mono"], size: clampedSize)
        case .sourceCodePro:
            return Self.font(named: ["SourceCodePro-Regular", "Source Code Pro"], size: clampedSize)
        case .jetBrainsMono:
            return Self.font(named: ["JetBrainsMono-Regular", "JetBrains Mono"], size: clampedSize)
        case .firaCode:
            return Self.font(named: ["FiraCode-Regular", "Fira Code"], size: clampedSize)
        case .cascadiaCode:
            return Self.font(named: ["CascadiaCode-Regular", "Cascadia Code"], size: clampedSize)
        case .hack:
            return Self.font(named: ["Hack-Regular", "Hack"], size: clampedSize)
        case .iosevka:
            return Self.font(named: ["Iosevka-Regular", "Iosevka"], size: clampedSize)
        }
    }

    private static func font(named names: [String], size: CGFloat) -> NSFont {
        for name in names {
            if let font = NSFont(name: name, size: size) {
                return font
            }
        }
        return NSFont.monospacedSystemFont(ofSize: size, weight: .regular)
    }
}

enum AppWindowOpacityPreference {
    static let defaultValue: Double = 1.0
    static let minimumValue: Double = 0.58
    static let maximumValue: Double = 1.0

    static func clamped(_ value: Double) -> Double {
        min(max(value, minimumValue), maximumValue)
    }
}

enum AppWindowMaterialPreference: String, CaseIterable, Codable, Identifiable {
    case solid
    case nativeWindow
    case translucent

    static var allCases: [AppWindowMaterialPreference] {
        [.solid, .translucent]
    }

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .solid:
            return "Solid"
        case .nativeWindow:
            return "Native Window"
        case .translucent:
            return "Translucent"
        }
    }
}

enum AppBackgroundImageFitPreference: String, CaseIterable, Codable, Identifiable {
    case fill
    case fit

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .fill:
            return "Fill"
        case .fit:
            return "Fit"
        }
    }
}

enum AppBackgroundImageBlurPreference {
    static let defaultValue: Double = 0
    static let minimumValue: Double = 0
    static let maximumValue: Double = 24

    static func clamped(_ value: Double) -> Double {
        min(max(value, minimumValue), maximumValue)
    }
}

struct HiddenHermesProfilePreference: Codable, Hashable, Identifiable {
    let hostConnectionFingerprint: String
    let profileName: String

    var id: String {
        "\(hostConnectionFingerprint)|\(profileName)"
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #56** (2026-06-07): **fix: forward scroll wheel events to PTY in alternate screen mode**
  *Symptoms*: ## Problem  Chat mode terminal (running `hermes --tui`) could not be scrolled with mouse wheel or trackpad.  ## Root Cause  SwiftTerm`MacTerminalView.scrollWheel()` always called `scrollUp()`/`scrollDown()` for internal terminal scrollback, even when the terminal was in alternate screen mode (e.g., TUI running). These internal scroll methods are ineffective in alternate screen mode because the alt buffer has no scrollback lines.  Meanwhile, `pageUp()`/`pageDown()` already had the correct alternate screen handling — they send escape sequences (CSI 5~ / CSI 6~) to the PTY process.  ## Fix  Modified `scrollWheel()` to check `terminal.isDisplayBufferAlternate`: - When in alternate screen mode: call `pageUp()`/`pageDown()` which forward events to PTY - When in normal mode: use existing `scrollUp()`/`scrollDown()` behavior  ## Files Changed  - `Vendor/SwiftTerm/Sources/SwiftTerm/Mac/MacTerminalView.swift` — 1 file, +12/-4 lines
  **Post-Mortem & Fix Analysis**:
  > Thanks again for opening this terminal scrolling fix. Hermes Desktop v1.1.0 has now shipped with the terminal scrolling behavior included, and PR #56 is credited in the release notes for helping shape that fix. I am closing this PR now because the release landed through the main v1.1.0 branch rather than by merging this PR directly: https://github.com/dodo-reach/hermes-desktop/releases/tag/v1.1.0

- **Issue #55** (2026-06-07): **feat: add global background image support**
  *Symptoms*: ## Summary  Adds the ability to set a custom background image for the entire Hermes Desktop app, visible through all panels.  ## Changes  - **Model**: Added `backgroundImagePath` to `TerminalThemePreference` and `TerminalThemeAppearance` - **Persistence**: New `backgroundImagePath` property in `ConnectionStore` / `AppPreferences`, auto-saved to `preferences.json` - **Settings UI**: New "Background Image" section in Settings (ConnectionsView) with file picker, thumbnail preview, and clear button - **Rendering**: `RootView` uses `ZStack` to render background image globally behind all content - **Transparency**: When background image is active, all panels use semi-transparent backgrounds (45% opacity of theme colors) instead of their usual opaque fills:   - `HermesSurfacePanel`, `HermesInsetSurface`   - `SessionCardRow`, `TranscriptMessageSurface`, `ToolOutputView`   - Workspace sidebar - **Window**: Titlebar becomes transparent, window `isOpaque=false`, `backgroundColor=.clear` when bg image is active - **Environment**: New `backgroundImageActive` EnvironmentKey for propagating background state through view tree - **Localization**: Added Chinese (zh-Hans), English, and Russian translations
  **Post-Mortem & Fix Analysis**:
  > Thanks again for opening this and exploring background-image customization. Hermes Desktop v1.1.0 has now shipped the appearance release with a separate implementation for app background images and related customization controls, so I am closing this PR without merging it directly. I credited the early PRs in the v1.1.0 release notes: https://github.com/dodo-reach/hermes-desktop/releases/tag/v1.1.0

- **Issue #54** (2026-06-06): **Telegram Chats Dont Persist on Desktop**
  *Symptoms*: ive seen someone else comment on this on X and apparently its working for some and not other..  being able to go from mobile to desktop is quite invaluable 
  **Post-Mortem & Fix Analysis**:
  > wrong repo. this is the tui/cli app, not the nousresearch chat app for hermes. 

- **Issue #52** (2026-06-04): **After installation, my fnm node config is overwrited.**
  *Symptoms*: I use fish shell and fnm to manage my node.js runtime, but Hermes Desktop installation will write a new node.js (22.x.x) over my fnm config in fish shell.  It is not hard to fix, I rollback fish config, then fnm runtime is back. For web developers (JS ecosystem) like me, it is a big issue! Please fix it! And thank you for give us a such powerful app for Hermes Agent!
  **Post-Mortem & Fix Analysis**:
  > sorry for mistake, I should submit to another repo 🙏

- **Issue #50** (2026-06-03): **slash command doesn't work**
  *Symptoms*: for instance, if you type '/han....' originally it calls out '/handoff' and all skills that have names starts with han   if you are not sure what it means, pls try Nesquena WebUI for Hermes Agent.  
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, but I do not think this describes a Hermes Desktop bug as written.  Hermes Desktop does not wrap slash commands in a custom Desktop chat layer. It provides terminal surfaces:  - `Terminal` is a normal SSH terminal to the selected host/profile. - `Sessions > Chat` is also terminal-backed: it runs the upstream Hermes TUI directly over SSH (`hermes --tui`, or `hermes --tui --resume <session>`).  So slash commands are not implemented, mirrored, or manually kept in sync by Hermes Desktop. In the TUI surface they are handled by Hermes itself, through the real `hermes --tui` process running on the host. That is intentionally different from web UI-style integrations, where slash commands often have to be proxied, wrapped, or reimplemented by the UI whenever the command set changes.  One important distinction: if you type `/han...` in the plain `Terminal` section before starting `hermes --tui`, that is just a shell prompt, not the Hermes TUI. Slash command completion only

- **Issue #49** (2026-06-03): **Can not add host**
  *Symptoms*: Got the software to run, but can't add my host. I've tried with SSH alias, hostname and IP address, but it doesn't matter: After I press save the host list is still empty. I get no error message.  My hermes agent is running and working via SSH without a problem.  I notice that they are all added to connections.json but don't show up in the GUI.  I'm on a MacBook Air M1, with MacOs 24.5.
  **Post-Mortem & Fix Analysis**:
  > Same here.
  > Having the same issue and not much in the Diagnostics/workflow-launch-latest.log. I am getting connections.json popluated but not showing in the connection, also restarted still MIA.  Mac Mini M4pro macOS 26.5.1  ```  cat workflow-launch-latest.log  ts=2026-06-02T15:53:19.186Z | event=diagnostics_session_started | banner="=== Hermes Desktop workflow launch diagnostics session started ===" | log_path="<redact>/Library/Application Support/HermesDesktop/Diagnostics/workflow-launch-latest.log" ```
  > Same here

- **Issue #46** (2026-06-01): **UI text size**
  *Symptoms*: Great App! Can you add control over the font size? on a hires Display the UI text is hard to read for some, specially when getting older ...  thanks!  π
  **Post-Mortem & Fix Analysis**:
  > I agree. Being able to change the font size in the terminal would be great!
  > Thanks for the request, and thanks @sixo70 for the extra nudge. This landed in [Hermes Desktop v1.0.0](https://github.com/dodo-reach/hermes-desktop/releases/tag/v1.0.0): Settings now includes terminal surface customization, including font size and colors.  The app icon changed in this release too, so Hermes may look a little different in your Dock. Fresh coat of paint, same SSH-first soul. Closing this as shipped.

- **Issue #44** (2026-05-26): **Fish shell compatibility for CLI commands**
  *Symptoms*: The Hermes UI appears to execute generated CLI commands through the user’s default shell. On systems using Fish (/usr/bin/fish), shell snippets generated with POSIX/Bash syntax fail.  Example output:  ``` export HERMES_HOME="$HOME/.hermes"; export PATH="$HOME/.hermes/hermes-agent/venv/bin:$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH";  if command -v hermes >/dev/null 2>&1; then HERMES_BIN=$(command -v hermes); else   printf 'Hermes CLI not found.\n' >&2;   exit 127; fi;  COLUMNS=240 "$HERMES_BIN" skills list --enabled-only ```  Fish errors:  `fish: Missing end to balance this if statement`  Fish requires different syntax:  ``` set -x HERMES_HOME "$HOME/.hermes" set -x PATH "$HOME/.hermes/hermes-agent/venv/bin:$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"  if command -v hermes >/dev/null     set HERMES_BIN (command -v hermes) else     printf 'Hermes CLI not found.\n' >&2     exit 127 end  env COLUMNS=240 "$HERMES_BIN" skills list --enabled-only ```  Possible fixes:  * Detect shell ($SHELL) * Generate shell-specific syntax * Execute commands via sh -c instead of the user’s login shell * Provide Bash/Zsh/Fish adapters  Fish is increasingly common on macOS/Linux and this would improve compatibility.
  **Post-Mortem & Fix Analysis**:
  > closing in favour for original issue.

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

### Incident Patch 1: `3b772afa` (2026-06-18)
**Commit Message**: Document macOS 26.5.1 Gatekeeper workaround

**File**: `README.md` (modified, +45/-3)
```diff
@@ -142,20 +142,60 @@ ssh your-host
 4. Drag `HermesDesktop.app` into `Applications` and replace the old copy if
    macOS asks.
 5. First launch: right click `HermesDesktop.app`, choose `Open`, then confirm
-   `Open`.
+   `Open`. This remains the normal first-launch path on supported macOS
+   versions.
 
 Hermes Desktop is currently ad-hoc signed and not notarized by Apple. macOS may
 show a first-launch warning saying Apple cannot verify it for malware. That is
 expected for this distribution model and does not mean macOS found malware in
 Hermes Desktop.
 
-If macOS blocks the first launch:
+If macOS shows the usual unidentified-developer warning:
 
 1. Click `Done`, not `Move to Bin`.
 2. Right click `HermesDesktop.app` and choose `Open`.
 3. If needed, go to `System Settings` > `Privacy & Security` and click
    `Open Anyway`.
 
+### macOS 26.5.1 shows that the app is damaged
+
+On some Macs running macOS 26.5.1 (build 25F80), Gatekeeper may instead say
+that Hermes Desktop "is damaged and can't be opened" and may not offer
+`Open Anyway`. The additional steps below are only for that macOS version and
+build when that exact alert appears.
+
+First, verify that the zip came from the official GitHub Release. Run:
+
+```bash
+shasum -a 256 ~/Downloads/HermesDesktop.app.zip
+```
+
+Compare the result with `HermesDesktop.app.zip.sha256` attached to the same
+release. Do not continue if the values differ. After extracting the verified
+zip and moving `HermesDesktop.app` to Applications, remove the browser
+quarantine from this app only, then open it:
+
+```bash
+xattr -dr com.apple.quarantine "/Applications/HermesDesktop.app"
+open "/Applications/HermesDesktop.app"
+```
+
+These commands do not disable Gatekeeper globally and do not require `sudo`.
+They remove the download quarantine only from the verified Hermes Desktop app.
+
+### Build locally instead
+
+The free alternative with the clearest trust path is to inspect the source and
+build Hermes Desktop locally. A local build does not inherit browser download
+quarantine:
+
+```bash
+git clone https://github.com/dodo-reach/hermes-desktop.git
+cd hermes-desktop
+./scripts/build-macos-app.sh
+open "dist/HermesDesktop.app"
+```
+
 Do not disable Gatekeeper or run `sudo` commands to install Hermes Desktop.
 
 For the exact distribution and verification details, read
@@ -390,7 +430,9 @@ does not update Hermes Agent and does not send your connection, profile, file,
 session, or Kanban content.
 
 The current public build is ad-hoc signed and not notarized by Apple, so
-macOS may show a first-launch warning. Cautious users should read
+macOS may show a first-launch warning. On some Macs running macOS 26.5.1
+(build 25F80), Gatekeeper may show a stronger "damaged" alert; follow the
+version-specific, checksum-first instructions above. Cautious users should read
 [SECURITY.md](SECURITY.md), read [docs/distribution.md](docs/distribution.md),
 and consider building from source.
 
```

**File**: `docs/distribution.md` (modified, +37/-1)
```diff
@@ -59,6 +59,37 @@ a way macOS can validate for internal integrity. It does not mean:
 That is why first launch may require right-click `Open`, and why macOS may warn
 that Apple cannot verify the app for malware.
 
+## First Launch And macOS 26.5.1
+
+On most supported macOS versions, right-clicking `HermesDesktop.app`, choosing
+`Open`, and confirming the warning is the normal first-launch path. If needed,
+macOS also provides `Open Anyway` under `System Settings` > `Privacy &
+Security` shortly after a blocked launch.
+
+On some Macs running macOS 26.5.1 (build 25F80), we have observed Gatekeeper
+showing a stronger "is damaged and can't be opened" alert for quarantined,
+ad-hoc signed apps without offering the normal override. The following
+workaround is only for that macOS version and build when that exact alert
+appears.
+
+Before changing the quarantine attribute, verify the downloaded zip against
+`HermesDesktop.app.zip.sha256` attached to the same GitHub Release:
+
+```bash
+shasum -a 256 ~/Downloads/HermesDesktop.app.zip
+```
+
+Do not continue if the result differs from the published checksum. After
+extracting the verified zip and moving the app into Applications, run:
+
+```bash
+xattr -dr com.apple.quarantine "/Applications/HermesDesktop.app"
+open "/Applications/HermesDesktop.app"
+```
+
+This removes the browser quarantine from that app bundle only. It does not
+disable Gatekeeper globally and does not require `sudo`.
+
 ## What The Published Checksum Proves
 
 Each release zip includes a SHA-256 checksum and a small JSON manifest.
@@ -123,7 +154,12 @@ That produces a local app bundle in `dist/HermesDesktop.app`.
 This is still an ad-hoc signed, non-notarized bundle, because that is the
 current build and release model in the repo. Building locally does not turn it
 into a notarized distribution, but it does let you trust your own build inputs
-instead of a downloaded zip.
+instead of a downloaded zip. Because the resulting app is produced locally, it
+also does not inherit browser download quarantine. You can launch it directly:
+
+```bash
+open "dist/HermesDesktop.app"
+```
 
 ## What The App Depends On At Runtime
 
```

**File**: `docs/releases/RELEASE-v1.2.0.md` (modified, +42/-1)
```diff
@@ -61,7 +61,48 @@ not collide between the two.
 
 - universal macOS build for Apple Silicon and Intel
 - ad-hoc signed and not notarized by Apple
-- first launch may require right-click → Open / Open Anyway
+- on most supported macOS versions, first launch may require right-click →
+  Open / Open Anyway
 - release archive: `HermesDesktop.app.zip`
 - checksum: `HermesDesktop.app.zip.sha256`
 - manifest: `HermesDesktop.app.zip.manifest.json`
+
+### macOS 26.5.1 Gatekeeper note
+
+On some Macs running macOS 26.5.1 (build 25F80), Gatekeeper may say that the
+downloaded app "is damaged and can't be opened" and may not offer `Open
+Anyway`. This note applies only to that version and build when that exact alert
+appears.
+
+Before continuing, verify the v1.2.0 archive:
+
+```bash
+shasum -a 256 ~/Downloads/HermesDesktop.app.zip
+```
+
+The v1.2.0 result must be:
+
+```text
+34ef72ea39e76659f81ceecbc1c42fd970ba1478bed9257d7f3e68306917057d
+```
+
+Do not continue if it differs. After extracting the verified zip and moving
+the app into Applications, remove the browser quarantine from Hermes Desktop
+only and open it:
+
+```bash
+xattr -dr com.apple.quarantine "/Applications/HermesDesktop.app"
+open "/Applications/HermesDesktop.app"
+```
+
+This does not disable Gatekeeper globally and does not require `sudo`.
+
+Alternatively, inspect the source and build locally. The resulting app does
+not inherit browser download quarantine:
+
+```bash
+git clone https://github.com/dodo-reach/hermes-desktop.git
+cd hermes-desktop
+./scripts/build-macos-app.sh
+open "dist/HermesDesktop.app"
+```
```

**File**: `site/index.html` (modified, +16/-4)
```diff
@@ -370,6 +370,14 @@
       padding: 0.12rem 0.35rem;
     }
 
+    .command-block {
+      display: block;
+      margin: 0.7rem 0;
+      overflow-x: auto;
+      padding: 0.7rem 0.8rem;
+      white-space: nowrap;
+    }
+
     .prereqs code {
       background: rgba(255, 248, 241, 0.12);
     }
@@ -693,7 +701,7 @@ <h3>Move it to Applications</h3>
         <div class="card">
           <div class="micro">03 · First launch</div>
           <h3>Right-click → Open</h3>
-          <p>macOS will warn that the app is not notarized. Right-click the app, choose Open, then Open again. Don't move it to the bin.</p>
+          <p>On most supported macOS versions, right-click the app, choose Open, then confirm. macOS 26.5.1 has an additional checksum-first workaround below.</p>
         </div>
       </div>
       <div class="prereqs">
@@ -723,9 +731,13 @@ <h2>Help</h2>
         <details>
           <summary>Why does macOS say the app can't be verified or is damaged?</summary>
           <div class="faq-body">
-            <p>Hermes Desktop is currently ad-hoc signed and not notarized by Apple. The Gatekeeper warning is expected for this distribution model and does not mean the app contains malware.</p>
-            <p>To open it: click <strong>Done</strong> (not "Move to Bin"), then right-click <code>HermesDesktop.app</code> in Applications and choose <strong>Open</strong>. macOS will ask once to confirm.</p>
-            <p>Do not disable Gatekeeper or run <code>sudo</code> commands to install the app. If you'd rather not trust the release zip, build from source.</p>
+            <p>Hermes Desktop is currently ad-hoc signed and not notarized by Apple. The Gatekeeper warning is expected for this distribution model and does not by itself mean that macOS found malware.</p>
+            <p>On most supported macOS versions, click <strong>Done</strong> (not "Move to Bin"), then right-click <code>HermesDesktop.app</code> in Applications and choose <strong>Open</strong>. If available, you can also use <strong>Open Anyway</strong> in Privacy &amp; Security.</p>
+            <p>On some Macs running <strong>macOS 26.5.1 (build 25F80)</strong>, Gatekeeper may instead say that the app is damaged and offer no override. Only for that version and exact alert, first compare the downloaded zip with <code>HermesDesktop.app.zip.sha256</code> from the same GitHub Release. Do not continue if the values differ.</p>
+            <p>After moving the verified app to Applications, run:</p>
+            <code class="command-block">xattr -dr com.apple.quarantine "/Applications/HermesDesktop.app"</code>
+            <code class="command-block">open "/Applications/HermesDesktop.app"</code>
+            <p>This removes browser quarantine from Hermes Desktop only; it does not disable Gatekeeper globally and does not require <code>sudo</code>. The free alternative is to inspect the source and run <code>./scripts/build-macos-app.sh</code>; a local build does not inherit browser download quarantine.</p>
           </div>
         </details>
         <details>
```

---

### Incident Patch 2: `7ce22b43` (2026-06-03)
**Commit Message**: Fix first host selection

**File**: `Sources/HermesDesktop/App/AppState.swift` (modified, +26/-3)
```diff
@@ -159,7 +159,8 @@ final class AppState: ObservableObject {
             }
             .store(in: &cancellables)
 
-        self.activeConnectionID = connectionStore.lastConnectionID
+        self.activeConnectionID = resolvedActiveConnectionID(preferred: connectionStore.lastConnectionID)
+        persistActiveConnectionSelectionIfNeeded()
 
         selectedSection = .connections
     }
@@ -474,6 +475,7 @@ final class AppState: ObservableObject {
         let normalized = profile.updated()
         let previous = connectionStore.connections.first(where: { $0.id == normalized.id })
         let isActiveConnection = activeConnectionID == normalized.id
+        let shouldActivateSavedConnection = activeConnection == nil
         let isChangingWorkspaceScope = previous?.workspaceScopeFingerprint != normalized.workspaceScopeFingerprint
 
         if isActiveConnection && isChangingWorkspaceScope && hasUnsavedFileChanges {
@@ -486,6 +488,11 @@ final class AppState: ObservableObject {
 
         connectionStore.upsert(normalized)
 
+        if shouldActivateSavedConnection {
+            activeConnectionID = normalized.id
+            connectionStore.lastConnectionID = normalized.id
+        }
+
         guard isActiveConnection else { return }
         guard isChangingWorkspaceScope else { return }
 
@@ -2321,10 +2328,12 @@ final class AppState: ObservableObject {
     }
 
     func deleteConnection(_ profile: ConnectionProfile) {
+        let isDeletingActiveConnection = activeConnectionID == profile.id
         connectionStore.delete(profile)
         terminalWorkspace.closeTabs(forConnectionID: profile.id)
-        if activeConnectionID == profile.id {
-            activeConnectionID = nil
+        if isDeletingActiveConnection {
+            activeConnectionID = resolvedActiveConnectionID(preferred: connectionStore.lastConnectionID)
+            persistActiveConnectionSelectionIfNeeded()
             resetWorkspaceStateForConnectionChange(closeTerminalTabs: false)
             selectedSection = .connections
         }
@@ -2342,6 +2351,20 @@ final class AppState: ObservableObject {
         setStatusMessage(L10n.string("New Terminal tab opened"))
     }
 
+    private func resolvedActiveConnectionID(preferred preferredID: UUID?) -> UUID? {
+        if let preferredID,
+           connectionStore.connections.contains(where: { $0.id == preferredID }) {
+            return preferredID
+        }
+
+        return connectionStore.connections.first?.id
+    }
+
+    private func persistActiveConnectionSelectionIfNeeded() {
+        guard connectionStore.lastConnectionID != activeConnectionID else { return }
+        connectionStore.lastConnectionID = activeConnectionID
+    }
+
     func resumeSessionInTerminal(_ session: SessionSummary) {
         guard let profile = activeConnection else {
             sessionsError = L10n.string("Select a connection before resuming a session in Terminal.")
```

**File**: `Tests/HermesDesktopTests/AppStateConnectionSelectionTests.swift` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import Foundation
+import Testing
+
+@testable import HermesDesktop
+
+@MainActor
+struct AppStateConnectionSelectionTests {
+    @Test
+    func launchSelectsSavedHostWhenPreferenceIsMissing() throws {
+        let root = try makeTemporaryDirectory()
+        defer { try? FileManager.default.removeItem(at: root) }
+
+        let paths = makeTestAppPaths(root: root)
+        let savedConnection = ConnectionProfile(
+            label: "Prod",
+            sshHost: "example.com"
+        )
+        let store = ConnectionStore(paths: paths)
+        store.upsert(savedConnection)
+
+        let appState = AppState(paths: paths)
+
+        #expect(appState.activeConnectionID == savedConnection.id)
+        #expect(appState.activeConnection?.id == savedConnection.id)
+        #expect(appState.connectionStore.lastConnectionID == savedConnection.id)
+    }
+
+    @Test
+    func launchReplacesStalePreferenceWithSavedHost() throws {
+        let root = try makeTemporaryDirectory()
+        defer { try? FileManager.default.removeItem(at: root) }
+
+        let paths = makeTestAppPaths(root: root)
+        let savedConnection = ConnectionProfile(
+            label: "Prod",
+            sshHost: "example.com"
+        )
+        let store = ConnectionStore(paths: paths)
+        store.upsert(savedConnection)
+        store.lastConnectionID = UUID()
+
+        let appState = AppState(paths: paths)
+
+        #expect(appState.activeConnectionID == savedConnection.id)
+        #expect(appState.activeConnection?.id == savedConnection.id)
+        #expect(appState.connectionStore.lastConnectionID == savedConnection.id)
+    }
+
+    @Test
+    func savingFirstHostMakesItActive() throws {
+        let root = try makeTemporaryDirectory()
+        defer { try? FileManager.default.removeItem(at: root) }
+
+        let appState = AppState(paths: makeTestAppPaths(root: root))
+        let savedConnection = ConnectionProfile(
+            label: "Prod",
+            sshHost: "example.com"
+        )
+
+        appState.saveConnection(savedConnection)
+
+        #expect(appState.activeConnectionID == savedConnection.id)
+        #expect(appState.activeConnection?.id == savedConnection.id)
+        #expect(appState.connectionStore.lastConnectionID == savedConnection.id)
+    }
+
+    @Test
+    func deletingActiveHostSelectsRemainingHost() throws {
+        let root = try makeTemporaryDirectory()
+        defer { try? FileManager.default.removeItem(at: root) }
+
+        let appState = AppState(paths: makeTestAppPaths(root: root))
+        let firstConnection = ConnectionProfile(
+            label: "Alpha",
+            sshHost: "alpha.example.com"
+        )
+        let secondConnection = ConnectionProfile(
+            label: "Beta",
+            sshHost: "beta.example.com"
+        )
+        appState.saveConnection(firstConnection)
+        appState.saveConnection(secondConnection)
+
+        appState.deleteConnection(firstConnection)
+
+        #expect(appState.activeConnectionID == secondConnection.id)
+        #expect(appState.activeConnection?.id == secondConnection.id)
+        #expect(appState.connectionStore.lastConnectionID == secondConnection.id)
+    }
+}
```

**File**: `docs/releases/RELEASE-v1.0.1.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+# Hermes Desktop v1.0.1
+
+Hermes Desktop 1.0.1 fixes a host selection regression introduced in the
+v1.0.0 Settings refresh.
+
+On a fresh install, saving the first host could write `connections.json`
+successfully but leave `preferences.json` without an active `lastConnectionID`.
+The host was saved locally, but the Settings UI still behaved as if no host was
+available.
+
+Fixes:
+
+- select the first saved host automatically when no active host preference
+  exists
+- repair stale active-host preferences on launch
+- make a newly saved first host active immediately
+- select the next available host after deleting the active host
+
+This release keeps the same distribution model as v1.0.0: a universal macOS app
+bundle, ad-hoc signed, not notarized by Apple, with zip checksum and release
+manifest assets.
```

---

### Incident Patch 3: `119fb4e5` (2026-06-01)
**Commit Message**: Fix unreliable window title bar configurator

The previous HermesWindowTitleBarConfigurator scheduled its titleVisibility
update via DispatchQueue.main.async and relied on view.window being
non-nil at that point. In practice the NSView was still orphan when the
async block fired, so the guard returned early and the native
'Hermes Desktop' title from WindowGroup remained visible next to the
toolbar's collapse buttons.

Replace the async-dispatch pattern with an NSView subclass that applies
titleVisibility = .hidden in viewDidMoveToWindow, where AppKit
guarantees self.window is non-nil. The configurator now attaches
reliably on first appearance and on every subsequent re-attach
(state restoration, window recreation).

**File**: `Sources/HermesDesktop/Views/Shared/HermesUI.swift` (modified, +11/-14)
```diff
@@ -879,25 +879,22 @@ struct HermesToolbarPrincipalTitle: View {
     }
 }
 
+final class HermesTitleBarConfiguratorView: NSView {
+    override func viewDidMoveToWindow() {
+        super.viewDidMoveToWindow()
+        guard let window else { return }
+        window.titleVisibility = .hidden
+        window.titlebarAppearsTransparent = false
+    }
+}
+
 struct HermesWindowTitleBarConfigurator: NSViewRepresentable {
     func makeNSView(context: Context) -> NSView {
-        let view = NSView()
-        DispatchQueue.main.async {
-            applyConfiguration(from: view)
-        }
-        return view
+        HermesTitleBarConfiguratorView(frame: .zero)
     }
 
     func updateNSView(_ nsView: NSView, context: Context) {
-        DispatchQueue.main.async {
-            applyConfiguration(from: nsView)
-        }
-    }
-
-    private func applyConfiguration(from view: NSView) {
-        guard let window = view.window else { return }
-        window.titleVisibility = .hidden
-        window.titlebarAppearsTransparent = false
+        // Configuration is applied in HermesTitleBarConfiguratorView.viewDidMoveToWindow.
     }
 }
 
```

---

### Incident Patch 4: `07a4517a` (2026-06-01)
**Commit Message**: Polish UI across views

Refresh shared layout primitives in HermesUI.swift and apply the
updated styling to cron jobs, files, Kanban, sessions, skills, usage,
and workflows for a more consistent surface.

**File**: `Sources/HermesDesktop/Views/CronJobs/CronJobsView.swift` (modified, +3/-3)
```diff
@@ -372,11 +372,11 @@ private struct CronJobCardRow: View {
             .frame(maxWidth: .infinity, alignment: .leading)
             .background(
                 RoundedRectangle(cornerRadius: 16, style: .continuous)
-                    .fill(isSelected ? Color.accentColor.opacity(0.12) : Color.secondary.opacity(0.08))
+                    .fill(isSelected ? HermesTheme.selectedFill : HermesTheme.rowFill)
             )
             .overlay {
                 RoundedRectangle(cornerRadius: 16, style: .continuous)
-                    .strokeBorder(Color.primary.opacity(isSelected ? 0.12 : 0.06), lineWidth: 1)
+                    .strokeBorder(isSelected ? HermesTheme.selectedStroke : HermesTheme.subtleStroke, lineWidth: 1)
             }
         }
         .buttonStyle(.plain)
@@ -788,7 +788,7 @@ private struct CronJobEditorView: View {
                             )
                             .overlay {
                                 RoundedRectangle(cornerRadius: 14, style: .continuous)
-                                    .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
+                                    .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
                             }
                     }
                 }
```

**File**: `Sources/HermesDesktop/Views/Files/FilesView.swift` (modified, +7/-7)
```diff
@@ -202,7 +202,7 @@ struct FilesView: View {
                     .foregroundStyle(.secondary)
                     .padding(.horizontal, 7)
                     .padding(.vertical, 3)
-                    .background(Color.secondary.opacity(0.10), in: Capsule())
+                    .background(HermesTheme.rowFill, in: Capsule())
             }
             .contentShape(Rectangle())
         }
@@ -212,11 +212,11 @@ struct FilesView: View {
         .frame(maxWidth: .infinity, alignment: .leading)
         .background(
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .fill(Color.secondary.opacity(0.06))
+                .fill(HermesTheme.rowFill)
         )
         .overlay {
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
     }
 
@@ -397,11 +397,11 @@ private struct WorkspaceFileCardRow: View {
             .frame(maxWidth: .infinity, alignment: .leading)
             .background(
                 RoundedRectangle(cornerRadius: 16, style: .continuous)
-                    .fill(isSelected ? Color.accentColor.opacity(0.12) : Color.secondary.opacity(0.08))
+                    .fill(isSelected ? HermesTheme.selectedFill : HermesTheme.rowFill)
             )
             .overlay {
                 RoundedRectangle(cornerRadius: 16, style: .continuous)
-                    .strokeBorder(Color.primary.opacity(isSelected ? 0.12 : 0.06), lineWidth: 1)
+                    .strokeBorder(isSelected ? HermesTheme.selectedStroke : HermesTheme.subtleStroke, lineWidth: 1)
             }
         }
         .buttonStyle(.plain)
@@ -537,7 +537,7 @@ private struct WorkspaceFileEditorPane: View {
                     .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                     .overlay {
                         RoundedRectangle(cornerRadius: 12, style: .continuous)
-                            .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
+                            .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
                     }
                     .frame(maxWidth: .infinity, maxHeight: .infinity)
 
@@ -687,7 +687,7 @@ private struct WorkspaceFileBrowserSheet: View {
                 .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                 .overlay {
                     RoundedRectangle(cornerRadius: 12, style: .continuous)
-                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
+                        .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
                 }
             } else {
                 ContentUnavailableView(
```

**File**: `Sources/HermesDesktop/Views/Kanban/KanbanView.swift` (modified, +7/-7)
```diff
@@ -863,7 +863,7 @@ private struct KanbanColumnView: View {
         }
         .padding(12)
         .frame(maxWidth: .infinity, alignment: .topLeading)
-        .background(Color.secondary.opacity(0.026), in: RoundedRectangle(cornerRadius: HermesTheme.panelCornerRadius, style: .continuous))
+        .background(HermesTheme.panelFill, in: RoundedRectangle(cornerRadius: HermesTheme.panelCornerRadius, style: .continuous))
         .overlay {
             RoundedRectangle(cornerRadius: HermesTheme.panelCornerRadius, style: .continuous)
                 .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
@@ -899,7 +899,7 @@ private struct KanbanColumnView: View {
             .padding(.horizontal, 10)
             .padding(.vertical, 12)
             .frame(maxWidth: .infinity, alignment: .leading)
-            .background(Color.secondary.opacity(0.035), in: RoundedRectangle(cornerRadius: HermesTheme.rowCornerRadius, style: .continuous))
+            .background(HermesTheme.rowFill, in: RoundedRectangle(cornerRadius: HermesTheme.rowCornerRadius, style: .continuous))
     }
 }
 
@@ -940,7 +940,7 @@ private struct KanbanTaskCard: View {
             .frame(maxWidth: .infinity, alignment: .leading)
             .background(
                 RoundedRectangle(cornerRadius: HermesTheme.rowCornerRadius, style: .continuous)
-                    .fill(isSelected ? HermesTheme.selectedFill : isHovering ? Color.secondary.opacity(0.07) : HermesTheme.rowFill)
+                    .fill(isSelected ? HermesTheme.selectedFill : isHovering ? HermesTheme.hoverFill : HermesTheme.rowFill)
             )
             .overlay {
                 RoundedRectangle(cornerRadius: HermesTheme.rowCornerRadius, style: .continuous)
@@ -1108,7 +1108,7 @@ private struct KanbanBoardEditorView: View {
                                 )
                                 .overlay {
                                     RoundedRectangle(cornerRadius: 14, style: .continuous)
-                                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
+                                        .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
                                 }
                         }
 
@@ -1194,7 +1194,7 @@ private struct KanbanTaskEditorView: View {
                                 )
                                 .overlay {
                                     RoundedRectangle(cornerRadius: 14, style: .continuous)
-                                        .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
+                                        .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
                                 }
                         }
 
@@ -2436,10 +2436,10 @@ private struct KanbanTextEditor: View {
                     .allowsHitTesting(false)
             }
         }
-        .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
+        .background(HermesTheme.insetFill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
         .overlay {
             RoundedRectangle(cornerRadius: 10, style: .continuous)
-                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
     }
 }
```

**File**: `Sources/HermesDesktop/Views/Sessions/SessionDetailView.swift` (modified, +2/-2)
```diff
@@ -358,7 +358,7 @@ struct SessionDetailView: View {
                 }
                 .padding(.horizontal, 16)
                 .padding(.vertical, 10)
-                .background(Color.secondary.opacity(0.06))
+                .background(HermesTheme.rowFill)
 
                 SwiftTermTerminalView(
                     session: terminal.terminalSession,
@@ -1973,7 +1973,7 @@ private struct ToolMessageCard: View {
         }
         .overlay {
             RoundedRectangle(cornerRadius: HermesTheme.rowCornerRadius, style: .continuous)
-                .strokeBorder(Color.secondary.opacity(0.13), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
     }
 
```

**File**: `Sources/HermesDesktop/Views/Sessions/SessionsView.swift` (modified, +2/-2)
```diff
@@ -381,11 +381,11 @@ private struct SessionCardRow: View {
         Button(action: onTogglePin) {
             Image(systemName: isPinned ? "pin.fill" : "pin")
                 .font(.caption.weight(.semibold))
-                .foregroundStyle(isPinned ? Color.orange : Color.secondary)
+                .foregroundStyle(isPinned ? HermesTheme.warningForeground : Color.secondary)
                 .frame(width: 24, height: 24)
                 .background(
                     Circle()
-                        .fill(isPinned ? Color.orange.opacity(0.18) : Color.secondary.opacity(0.08))
+                        .fill(isPinned ? HermesTheme.warningFill : HermesTheme.rowFill)
                 )
                 .contentShape(Circle())
         }
```

**File**: `Sources/HermesDesktop/Views/Shared/HermesUI.swift` (modified, +53/-7)
```diff
@@ -7,28 +7,74 @@ enum HermesTheme {
     static let insetCornerRadius: CGFloat = 10
     static let rowCornerRadius: CGFloat = 12
 
+    /// Window-level background. The sidebar List with `.sidebar` style also
+    /// uses this token so the surface under the native chrome matches the app.
+    static var appBackground: Color {
+        Color(nsColor: .windowBackgroundColor)
+    }
+
+    /// Same as `appBackground` on macOS — kept as a dedicated token so views
+    /// can opt into the sidebar surface without reading `windowBackgroundColor`
+    /// directly.
+    static var sidebarBackground: Color {
+        Color(nsColor: .windowBackgroundColor)
+    }
+
+    /// Card / panel surface. Tied directly to `controlBackgroundColor` so the
+    /// panel feels like a native macOS control, not a translucent overlay.
     static var panelFill: Color {
-        Color(NSColor.controlBackgroundColor).opacity(0.72)
+        Color(nsColor: .controlBackgroundColor)
     }
 
+    /// Inset / prompt / editor surface. Slightly lighter than the panel using
+    /// `textBackgroundColor`, which reads as a macOS text field on both
+    /// Light and Dark.
     static var insetFill: Color {
-        Color.secondary.opacity(0.055)
+        Color(nsColor: .textBackgroundColor).opacity(0.55)
     }
 
+    /// Row inside a panel. Same family as `panelFill` but a touch lighter so
+    /// rows separate from the panel background without needing heavy borders.
     static var rowFill: Color {
-        Color.secondary.opacity(0.045)
+        Color(nsColor: .controlBackgroundColor).opacity(0.72)
     }
 
+    /// Row hover highlight. Slightly more opaque than `rowFill` so a hovered
+    /// row reads as "lifted" without a separate accent.
+    static var hoverFill: Color {
+        Color(nsColor: .controlBackgroundColor).opacity(0.88)
+    }
+
+    /// Subtle hairline used by every neutral card/row border. Anchored to
+    /// `separatorColor` so it adapts to Light/Dark without hand-tuned opacities.
     static var subtleStroke: Color {
-        Color.primary.opacity(0.055)
+        Color(nsColor: .separatorColor).opacity(0.55)
     }
 
+    /// Selection fill, mid of the recommended 0.12–0.14 range.
     static var selectedFill: Color {
-        Color.accentColor.opacity(0.12)
+        Color.accentColor.opacity(0.14)
     }
 
+    /// Selection border, mid of the recommended 0.25–0.28 range.
     static var selectedStroke: Color {
-        Color.accentColor.opacity(0.22)
+        Color.accentColor.opacity(0.28)
+    }
+
+    /// Warning surface fill (missing skills, validation errors, etc).
+    static var warningFill: Color {
+        Color.orange.opacity(0.11)
+    }
+
+    /// Warning surface border. Pair with `warningFill` to keep dark mode from
+    /// collapsing into a muddy brown.
+    static var warningStroke: Color {
+        Color.orange.opacity(0.28)
+    }
+
+    /// Warning foreground (titles, icons inside a warning surface).
+    static var warningForeground: Color {
+        Color.orange
     }
 }
 
@@ -655,7 +701,7 @@ struct HermesExpandableSearchField: View {
         )
         .overlay {
             RoundedRectangle(cornerRadius: 8, style: .continuous)
-                .strokeBorder(Color.primary.opacity(shouldShowExpandedField ? 0.10 : 0.06), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
         .animation(.spring(response: 0.24, dampingFraction: 0.88), value: shouldShowExpandedField)
         .onAppear {
```

**File**: `Sources/HermesDesktop/Views/Skills/SkillsView.swift` (modified, +6/-2)
```diff
@@ -222,7 +222,11 @@ private struct SkillCardRow: View {
     let onSelect: () -> Void
 
     private var cardFillColor: Color {
-        isSelected ? Color.accentColor.opacity(0.12) : Color.secondary.opacity(0.08)
+        isSelected ? HermesTheme.selectedFill : HermesTheme.rowFill
+    }
+
+    private var cardStrokeColor: Color {
+        isSelected ? HermesTheme.selectedStroke : HermesTheme.subtleStroke
     }
 
     var body: some View {
@@ -283,7 +287,7 @@ private struct SkillCardRow: View {
             )
             .overlay {
                 RoundedRectangle(cornerRadius: 16, style: .continuous)
-                    .strokeBorder(Color.primary.opacity(isSelected ? 0.12 : 0.06), lineWidth: 1)
+                    .strokeBorder(cardStrokeColor, lineWidth: 1)
             }
         }
         .buttonStyle(.plain)
```

**File**: `Sources/HermesDesktop/Views/Usage/UsageView.swift` (modified, +9/-9)
```diff
@@ -865,7 +865,7 @@ private struct UsageStackedComparisonBar: View {
 
             ZStack(alignment: .leading) {
                 RoundedRectangle(cornerRadius: 999, style: .continuous)
-                    .fill(Color.secondary.opacity(0.10))
+                    .fill(HermesTheme.rowFill)
 
                 HStack(spacing: 0) {
                     RoundedRectangle(cornerRadius: 999, style: .continuous)
@@ -927,11 +927,11 @@ private struct UsageTopSessionRow: View {
         .frame(maxWidth: .infinity, minHeight: 70, alignment: .leading)
         .background(
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .fill(Color.secondary.opacity(0.08))
+                .fill(HermesTheme.rowFill)
         )
         .overlay {
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
     }
 }
@@ -971,11 +971,11 @@ private struct UsageTopSessionPlaceholderRow: View {
         .frame(maxWidth: .infinity, minHeight: 70, alignment: .leading)
         .background(
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .fill(Color.secondary.opacity(0.05))
+                .fill(HermesTheme.rowFill)
         )
         .overlay {
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .strokeBorder(Color.primary.opacity(0.04), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
     }
 }
@@ -1050,11 +1050,11 @@ private struct UsageTopModelRow: View {
         .frame(maxWidth: .infinity, minHeight: 70, alignment: .leading)
         .background(
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .fill(Color.secondary.opacity(0.08))
+                .fill(HermesTheme.rowFill)
         )
         .overlay {
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .strokeBorder(Color.primary.opacity(0.06), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
     }
 }
@@ -1100,11 +1100,11 @@ private struct UsageTopModelPlaceholderRow: View {
         .frame(maxWidth: .infinity, minHeight: 70, alignment: .leading)
         .background(
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .fill(Color.secondary.opacity(0.05))
+                .fill(HermesTheme.rowFill)
         )
         .overlay {
             RoundedRectangle(cornerRadius: 16, style: .continuous)
-                .strokeBorder(Color.primary.opacity(0.04), lineWidth: 1)
+                .strokeBorder(HermesTheme.subtleStroke, lineWidth: 1)
         }
     }
 }
```

---

### Incident Patch 5: `0f174f7f` (2026-06-01)
**Commit Message**: Fix session chat split collapse transition

**File**: `Sources/HermesDesktop/Views/Sessions/SessionsView.swift` (modified, +16/-1)
```diff
@@ -9,7 +9,11 @@ struct SessionsView: View {
     @State private var sessionToDelete: SessionSummary?
 
     var body: some View {
-        HermesCollapsibleHSplitView(layout: $splitLayout, detailMinWidth: 420) {
+        HermesCollapsibleHSplitView(
+            layout: $splitLayout,
+            detailMinWidth: 420,
+            usesTransition: !isSessionChatTerminalVisible
+        ) {
             VStack(alignment: .leading, spacing: 18) {
                 HermesPageHeader(
                     title: "Sessions",
@@ -121,6 +125,17 @@ struct SessionsView: View {
         "\(isActive):\(searchText)"
     }
 
+    private var isSessionChatTerminalVisible: Bool {
+        guard isActive,
+              appState.selectedSessionDetailMode == .chat,
+              let terminal = appState.sessionTUITerminal,
+              let connection = appState.activeConnection else {
+            return false
+        }
+
+        return terminal.matches(sessionID: selectedSession?.id, connection: connection)
+    }
+
     private var deleteConfirmationBinding: Binding<Bool> {
         Binding {
             sessionToDelete != nil
```

**File**: `Sources/HermesDesktop/Views/Shared/HermesUI.swift` (modified, +6/-3)
```diff
@@ -858,18 +858,21 @@ struct HermesWindowTitleBarConfigurator: NSViewRepresentable {
 struct HermesCollapsibleHSplitView<Primary: View, Detail: View>: View {
     @Binding var layout: HermesSplitLayout
     let detailMinWidth: CGFloat
+    let usesTransition: Bool
     let primary: Primary
     let detail: Detail
     private let collapseAnimation = Animation.snappy(duration: 0.16, extraBounce: 0)
 
     init(
         layout: Binding<HermesSplitLayout>,
         detailMinWidth: CGFloat,
+        usesTransition: Bool = true,
         @ViewBuilder primary: () -> Primary,
         @ViewBuilder detail: () -> Detail
     ) {
         self._layout = layout
         self.detailMinWidth = detailMinWidth
+        self.usesTransition = usesTransition
         self.primary = primary()
         self.detail = detail()
     }
@@ -879,18 +882,18 @@ struct HermesCollapsibleHSplitView<Primary: View, Detail: View>: View {
             if layout.isPrimaryCollapsed {
                 detail
                     .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
-                    .transition(.opacity)
+                    .transition(usesTransition ? .opacity : .identity)
             } else {
                 HermesPersistentHSplitView(layout: $layout, detailMinWidth: detailMinWidth) {
                     primary
                 } detail: {
                     detail
                 }
-                .transition(.opacity)
+                .transition(usesTransition ? .opacity : .identity)
             }
         }
         .clipped()
-        .animation(collapseAnimation, value: layout.isPrimaryCollapsed)
+        .animation(usesTransition ? collapseAnimation : nil, value: layout.isPrimaryCollapsed)
     }
 }
 
```

---

### Incident Patch 6: `fa290c32` (2026-05-12)
**Commit Message**: Fix remote terminal bootstrap for fish shells

**File**: `Sources/HermesDesktop/Models/ConnectionProfile.swift` (modified, +16/-5)
```diff
@@ -115,13 +115,17 @@ struct ConnectionProfile: Codable, Identifiable, Equatable, Hashable {
         }
 
         let exportCommand = "export HERMES_HOME=\"\(shellHomeExpression)\""
-        guard let startupCommandLine,
-              !startupCommandLine.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
-            return "\(exportCommand); exec \"${SHELL:-/bin/zsh}\" -l"
+
+        let innerCommand: String
+        if let startupCommandLine,
+           !startupCommandLine.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
+            let escapedStartupCommand = startupCommandLine.escapedForDoubleQuotedShellArgument
+            innerCommand = "\(exportCommand); exec \"${SHELL:-/bin/zsh}\" -lc \"\(escapedStartupCommand)\""
+        } else {
+            innerCommand = "\(exportCommand); exec \"${SHELL:-/bin/zsh}\" -l"
         }
 
-        let escapedStartupCommand = startupCommandLine.escapedForDoubleQuotedShellArgument
-        return "\(exportCommand); exec \"${SHELL:-/bin/zsh}\" -lc \"\(escapedStartupCommand)\""
+        return "exec /bin/sh -c \"\(innerCommand.escapedForOuterDoubleQuotedShellCommand)\""
     }
 
     var workspaceScopeFingerprint: String {
@@ -228,6 +232,13 @@ private extension String {
             .replacingOccurrences(of: "`", with: "\\`")
     }
 
+    var escapedForOuterDoubleQuotedShellCommand: String {
+        replacingOccurrences(of: "\\", with: "\\\\")
+            .replacingOccurrences(of: "\"", with: "\\\"")
+            .replacingOccurrences(of: "$", with: "\\$")
+            .replacingOccurrences(of: "`", with: "\\`")
+    }
+
     var containsControlCharacter: Bool {
         unicodeScalars.contains { CharacterSet.controlCharacters.contains($0) }
     }
```

**File**: `Tests/HermesDesktopTests/ConnectionProfileTests.swift` (modified, +72/-6)
```diff
@@ -24,7 +24,7 @@ struct ConnectionProfileTests {
         #expect(profile.remotePath(for: .memory) == "~/.hermes/memories/MEMORY.md")
         #expect(
             profile.remoteShellBootstrapCommand ==
-                "export HERMES_HOME=\"$HOME/.hermes\"; exec \"${SHELL:-/bin/zsh}\" -l"
+                #"exec /bin/sh -c "export HERMES_HOME=\"\$HOME/.hermes\"; exec \"\${SHELL:-/bin/zsh}\" -l""#
         )
         #expect(profile.displayDestination == "alice@hermes-home")
         #expect(profile.resolvedPort == nil)
@@ -50,7 +50,7 @@ struct ConnectionProfileTests {
         #expect(profileScoped.remoteKanbanDatabasePath == "~/.hermes/kanban.db")
         #expect(
             profileScoped.remoteShellBootstrapCommand ==
-                "export HERMES_HOME=\"$HOME/.hermes/profiles/researcher\"; exec \"${SHELL:-/bin/zsh}\" -l"
+                #"exec /bin/sh -c "export HERMES_HOME=\"\$HOME/.hermes/profiles/researcher\"; exec \"\${SHELL:-/bin/zsh}\" -l""#
         )
         #expect(base.workspaceScopeFingerprint != profileScoped.workspaceScopeFingerprint)
         #expect(base.hostConnectionFingerprint == profileScoped.hostConnectionFingerprint)
@@ -68,7 +68,7 @@ struct ConnectionProfileTests {
 
         #expect(
             profile.remoteShellBootstrapCommand ==
-                "export HERMES_HOME=\"$HOME/.hermes/profiles/research\\\"lab\"; exec \"${SHELL:-/bin/zsh}\" -l"
+                #"exec /bin/sh -c "export HERMES_HOME=\"\$HOME/.hermes/profiles/research\\\"lab\"; exec \"\${SHELL:-/bin/zsh}\" -l""#
         )
     }
 
@@ -83,7 +83,7 @@ struct ConnectionProfileTests {
 
         #expect(
             profile.remoteShellBootstrapCommand ==
-                "export HERMES_HOME=\"$HOME/.hermes/profiles/research\\$HOME\\`whoami\\`\"; exec \"${SHELL:-/bin/zsh}\" -l"
+                #"exec /bin/sh -c "export HERMES_HOME=\"\$HOME/.hermes/profiles/research\\\$HOME\\\`whoami\\\`\"; exec \"\${SHELL:-/bin/zsh}\" -l""#
         )
     }
 
@@ -136,7 +136,7 @@ struct ConnectionProfileTests {
 
         #expect(
             profile.remoteShellBootstrapCommand(startupCommandLine: "hermes --profile researcher --resume 'debug session'\\''s final turn'") ==
-                "export HERMES_HOME=\"$HOME/.hermes/profiles/researcher\"; exec \"${SHELL:-/bin/zsh}\" -lc \"hermes --profile researcher --resume 'debug session'\\\\''s final turn'\""
+                #"exec /bin/sh -c "export HERMES_HOME=\"\$HOME/.hermes/profiles/researcher\"; exec \"\${SHELL:-/bin/zsh}\" -lc \"hermes --profile researcher --resume 'debug session'\\\\''s final turn'\"""#
         )
     }
 
@@ -149,10 +149,43 @@ struct ConnectionProfileTests {
 
         #expect(
             profile.remoteShellBootstrapCommand(startupCommandLine: "printf \"$HOME `whoami`\"") ==
-                "export HERMES_HOME=\"$HOME/.hermes\"; exec \"${SHELL:-/bin/zsh}\" -lc \"printf \\\"\\$HOME \\`whoami\\`\\\"\""
+                #"exec /bin/sh -c "export HERMES_HOME=\"\$HOME/.hermes\"; exec \"\${SHELL:-/bin/zsh}\" -lc \"printf \\\"\\\$HOME \\\`whoami\\\`\\\"\"""#
         )
     }
 
+    @Test
+    func wrappedBootstrapCanRunUnderPOSIXOuterShell() throws {
+        let profile = ConnectionProfile(
+            label: "Default",
+            sshHost: "example.com"
+        ).updated()
+
+        let result = try runBootstrapLocally(
+            profile.remoteShellBootstrapCommand(startupCommandLine: #"printf "%s\n" "$HERMES_HOME""#)
+        )
+
+        #expect(result.exitCode == 0)
+        #expect(result.stdout == "/tmp/hermes-home/.hermes\n")
+        #expect(result.stderr == "")
+    }
+
+    @Test
+    func wrappedBootstrapKeepsProfileShellSyntaxLiteral() throws {
+        let profile = ConnectionProfile(
+            label: "Shell Expansion",
+            sshHost: "example.com",
+            hermesProfile: "research$HOME`whoami`"
+        ).updated()
+
+        let result = try runBootstrapLocally(
+            profile.remoteShellBootstrapCommand(startupCommandLine: #"printf "%s\n" "$HERMES_HOME""#)
+        )
+
+        #expect(result.exitCode == 0)
+        #expect(result.stdout == "/tmp/hermes-home/.hermes/profiles/research$HOME`whoami`\n")
+        #expect(result.stderr == "")
+    }
+
     @Test
     func controlPathRecreatesTemporarySocketDirectoryWhenPruned() throws {
         let fileManager = FileManager.default
@@ -173,3 +206,36 @@ struct ConnectionProfileTests {
         #expect(controlPath.hasPrefix(paths.controlSocketDirectoryURL.path))
     }
 }
+
+private struct LocalBootstrapResult {
+    let stdout: String
+    let stderr: String
+    let exitCode: Int32
+}
+
+private func runBootstrapLocally(_ command: String) throws -> LocalBootstrapResult {
+    let process = Process()
+    let stdoutPipe = Pipe()
+    let stderrPipe = Pipe()
+
+    process.executableURL = URL(fileURLWithPath: "/bin/sh")
+    process.arguments = ["-c", command]
+    process.environment = [
+        "HOME": "/tmp/hermes-home",
+        "SHELL": "/bin/sh"
+    ]
+    proc
```

---

### Incident Patch 7: `d20b9209` (2026-05-04)
**Commit Message**: Fix read-only SQLite WAL fallback

**File**: `Sources/HermesDesktop/Services/KanbanBrowserService.swift` (modified, +2/-2)
```diff
@@ -952,7 +952,7 @@ final class KanbanBrowserService: @unchecked Sendable {
                     except Exception:
                         stats = direct_stats(conn)
                 else:
-                    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
+                    conn = connect_sqlite_readonly(db_path)
                     conn.row_factory = sqlite3.Row
                     tasks = direct_tasks(conn, include_archived)
                     assignees = direct_assignees(conn)
@@ -1036,7 +1036,7 @@ final class KanbanBrowserService: @unchecked Sendable {
                         "worker_log": worker_log,
                     }
 
-                conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
+                conn = connect_sqlite_readonly(db_path)
                 conn.row_factory = sqlite3.Row
                 if not table_exists(conn, "tasks"):
                     return None
```

**File**: `Sources/HermesDesktop/Services/RemoteHermesService.swift` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ final class RemoteHermesService: @unchecked Sendable {
 
             for candidate in iter_session_store_candidates(hermes_home):
                 try:
-                    conn = sqlite3.connect(f"file:{candidate}?mode=ro", uri=True)
+                    conn = connect_sqlite_readonly(candidate)
                     cursor = conn.execute(
                         "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
                     )
```

**File**: `Sources/HermesDesktop/Services/SessionBrowserService.swift` (modified, +2/-2)
```diff
@@ -709,7 +709,7 @@ final class SessionBrowserService: @unchecked Sendable {
 
             for candidate in iter_session_store_candidates(hermes_home, home, hinted_path):
                 try:
-                    connection = sqlite3.connect(f"file:{candidate}?mode=ro", uri=True)
+                    connection = connect_sqlite_readonly(candidate)
                     connection.execute("PRAGMA busy_timeout = 2000")
                     tables = [row[0] for row in connection.execute(
                         "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
@@ -750,7 +750,7 @@ final class SessionBrowserService: @unchecked Sendable {
             if not store_path:
                 return None
 
-            connection = sqlite3.connect(f"file:{store_path}?mode=ro", uri=True)
+            connection = connect_sqlite_readonly(store_path)
             connection.execute("PRAGMA busy_timeout = 2000")
 
             session_columns = [row[1] for row in connection.execute(
```

**File**: `Sources/HermesDesktop/Services/UsageBrowserService.swift` (modified, +2/-2)
```diff
@@ -65,7 +65,7 @@ final class UsageBrowserService: @unchecked Sendable {
             for candidate in iter_session_store_candidates(hermes_home, home, hinted_path):
                 connection = None
                 try:
-                    connection = sqlite3.connect(f"file:{candidate}?mode=ro", uri=True)
+                    connection = connect_sqlite_readonly(candidate)
                     tables = [
                         row[0]
                         for row in connection.execute(
@@ -136,7 +136,7 @@ final class UsageBrowserService: @unchecked Sendable {
                 unavailable("No readable Hermes SQLite session store with a sessions table was discovered on the active host.")
                 sys.exit(0)
 
-            connection = sqlite3.connect(f"file:{store['resolved_path']}?mode=ro", uri=True)
+            connection = connect_sqlite_readonly(store["resolved_path"])
 
             try:
                 columns = [
```

**File**: `Sources/HermesDesktop/Utilities/RemotePythonScript.swift` (modified, +18/-0)
```diff
@@ -22,6 +22,7 @@ enum RemotePythonScript {
 
     private static let sharedHelpers = """
     import os
+    import sqlite3
 
     def fail(message):
         print(json.dumps({
@@ -71,6 +72,23 @@ enum RemotePythonScript {
     def quote_text(value):
         return "'" + str(value).replace("'", "''") + "'"
 
+    def connect_sqlite_readonly(path):
+        connection = None
+        try:
+            connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
+            connection.execute("PRAGMA schema_version").fetchone()
+            return connection
+        except sqlite3.OperationalError as exc:
+            if connection is not None:
+                try:
+                    connection.close()
+                except Exception:
+                    pass
+            message = str(exc).lower()
+            if "unable to open database file" not in message and "readonly database" not in message:
+                raise
+            return sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
+
     def expand_remote_path(value, home=None, base_dir=None):
         if home is None:
             home = pathlib.Path.home()
```

**File**: `Tests/HermesDesktopTests/RemotePythonScriptTests.swift` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import Foundation
+import Testing
+@testable import HermesDesktop
+
+struct RemotePythonScriptTests {
+    @Test
+    func readonlySQLiteHelperFallsBackForWalDatabaseWithoutWritableSidecars() throws {
+        let script = try RemotePythonScript.wrap([String: String](), body:
+            """
+            import shutil
+            import tempfile
+
+            root = pathlib.Path(tempfile.mkdtemp())
+            db_path = root / "kanban.db"
+            writer = sqlite3.connect(db_path)
+            writer.execute("PRAGMA journal_mode=WAL")
+            writer.execute("CREATE TABLE tasks(id TEXT PRIMARY KEY)")
+            writer.execute("INSERT INTO tasks VALUES (?)", ("T1",))
+            writer.commit()
+            writer.close()
+
+            os.chmod(root, 0o555)
+            try:
+                connection = connect_sqlite_readonly(db_path)
+                count = connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
+                connection.close()
+            finally:
+                os.chmod(root, 0o755)
+                shutil.rmtree(root, ignore_errors=True)
+
+            print(json.dumps({"ok": True, "count": count}, ensure_ascii=False))
+            """
+        )
+
+        let temporaryDirectory = FileManager.default.temporaryDirectory
+            .appendingPathComponent(UUID().uuidString, isDirectory: true)
+        try FileManager.default.createDirectory(
+            at: temporaryDirectory,
+            withIntermediateDirectories: true
+        )
+        defer {
+            try? FileManager.default.removeItem(at: temporaryDirectory)
+        }
+
+        let scriptURL = temporaryDirectory.appendingPathComponent("readonly-sqlite-helper.py")
+        try script.write(to: scriptURL, atomically: true, encoding: .utf8)
+
+        let process = Process()
+        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
+        process.arguments = ["python3", scriptURL.path]
+
+        let outputPipe = Pipe()
+        let errorPipe = Pipe()
+        process.standardOutput = outputPipe
+        process.standardError = errorPipe
+
+        try process.run()
+        process.waitUntilExit()
+
+        let output = String(
+            data: outputPipe.fileHandleForReading.readDataToEndOfFile(),
+            encoding: .utf8
+        ) ?? ""
+        let error = String(
+            data: errorPipe.fileHandleForReading.readDataToEndOfFile(),
+            encoding: .utf8
+        ) ?? ""
+
+        #expect(process.terminationStatus == 0)
+        #expect(error.isEmpty)
+        #expect(output.contains("\"count\": 1"))
+    }
+}
```

---

### Incident Patch 8: `a22ddb12` (2026-05-04)
**Commit Message**: Strip release binary debug symbols

**File**: `scripts/build-macos-app.sh` (modified, +1/-0)
```diff
@@ -229,6 +229,7 @@ else
 fi
 
 cp "$UNIVERSAL_EXECUTABLE_PATH" "$MACOS_PATH/$APP_NAME"
+xcrun strip -S -x "$MACOS_PATH/$APP_NAME"
 cp "$PLIST_PATH" "$CONTENTS_PATH/Info.plist"
 stamp_plist_versions "$CONTENTS_PATH/Info.plist"
 cp "$ICNS_PATH" "$RESOURCES_PATH/AppIcon.icns"
```

---

### Incident Patch 9: `58f60323` (2026-05-04)
**Commit Message**: Fix GitHub Pages asset staging

**File**: `.github/workflows/deploy-pages.yml` (modified, +1/-5)
```diff
@@ -27,12 +27,8 @@ jobs:
 
       - name: Stage static site
         run: |
-          mkdir -p _site/assets
+          mkdir -p _site
           cp site/index.html _site/index.html
-          cp assets/CRON-JOBS.png _site/assets/CRON-JOBS.png
-          cp assets/USAGE.png _site/assets/USAGE.png
-          cp assets/SKILLS.png _site/assets/SKILLS.png
-          cp assets/TERMINALE.png _site/assets/TERMINALE.png
           touch _site/.nojekyll
 
       - name: Upload Pages artifact
```

---

### Incident Patch 10: `13c05fc5` (2026-05-03)
**Commit Message**: Improve macOS UI polish and session rendering

**File**: `Sources/HermesDesktop/App/AppState.swift` (modified, +170/-15)
```diff
@@ -66,6 +66,7 @@ final class AppState: ObservableObject {
     @Published var isLoadingWorkspaceFileBrowser = false
     @Published var pendingSectionSelection: AppSection?
     @Published var showDiscardChangesAlert = false
+    @Published var pendingNewConnectionEditorRequestID: UUID?
 
     let connectionStore: ConnectionStore
     let sshTransport: SSHTransport
@@ -81,6 +82,7 @@ final class AppState: ObservableObject {
 
     private let sessionPageSize = 50
     private var sessionOffset = 0
+    private var sessionMessageSignature = SessionMessageSignature(messages: [])
     private var statusTask: Task<Void, Never>?
     private var sessionTranscriptPollingTask: Task<Void, Never>?
     private var cancellables = Set<AnyCancellable>()
@@ -171,6 +173,37 @@ final class AppState: ObservableObject {
         workspaceFileDocuments.values.contains { $0.isDirty }
     }
 
+    var canRefreshCurrentSection: Bool {
+        guard activeConnection != nil else { return false }
+
+        switch selectedSection {
+        case .overview:
+            return !isRefreshingOverview && !isBusy
+        case .sessions:
+            return !isLoadingSessions && !isRefreshingSessions
+        case .cronjobs:
+            return !isLoadingCronJobs && !isRefreshingCronJobs
+        case .kanban:
+            return !isLoadingKanbanBoard && !isRefreshingKanbanBoard
+        case .usage:
+            return !isLoadingUsage && !isRefreshingUsage
+        case .skills:
+            return !isLoadingSkills && !isRefreshingSkills
+        case .connections, .files, .terminal:
+            return false
+        }
+    }
+
+    var canSaveCurrentWorkspaceFile: Bool {
+        guard selectedSection == .files else { return false }
+        guard let document = workspaceFileDocuments[selectedWorkspaceFileID] else { return false }
+        return document.hasLoaded && document.isDirty && !document.isLoading
+    }
+
+    func isSectionAvailable(_ section: AppSection) -> Bool {
+        section == .connections || activeConnection != nil
+    }
+
     func requestSectionSelection(_ section: AppSection) {
         guard selectedSection != section else { return }
         guard section != .files || activeConnection != nil else {
@@ -188,6 +221,53 @@ final class AppState: ObservableObject {
         handleSectionEntry(section)
     }
 
+    func requestNewConnectionEditorFromCommand() {
+        requestSectionSelection(.connections)
+        guard selectedSection == .connections else { return }
+        pendingNewConnectionEditorRequestID = UUID()
+    }
+
+    func consumeNewConnectionEditorRequest(_ requestID: UUID) {
+        guard pendingNewConnectionEditorRequestID == requestID else { return }
+        pendingNewConnectionEditorRequestID = nil
+    }
+
+    func requestNewSessionFromCommand() {
+        guard activeConnection != nil, !isSendingSessionMessage else { return }
+        requestSectionSelection(.sessions)
+        guard selectedSection == .sessions else { return }
+        prepareNewSessionComposer()
+    }
+
+    func openNewTerminalTabFromCommand() {
+        guard let profile = activeConnection else { return }
+        terminalWorkspace.addTab(for: profile.updated())
+        selectedSection = .terminal
+        handleSectionEntry(.terminal)
+        setStatusMessage(L10n.string("New Terminal tab opened"))
+    }
+
+    func refreshCurrentSectionFromCommand() async {
+        guard canRefreshCurrentSection else { return }
+
+        switch selectedSection {
+        case .overview:
+            await refreshOverview(manual: true)
+        case .sessions:
+            await refreshSessions(query: sessionSearchQuery)
+        case .cronjobs:
+            await refreshCronJobs()
+        case .kanban:
+            await refreshKanbanBoard()
+        case .usage:
+            await refreshUsage()
+        case .skills:
+            await refreshSkills()
+        case .connections, .files, .terminal:
+            break
+        }
+    }
+
     func discardChangesAndContinue() {
         for fileID in Array(workspaceFileDocuments.keys) {
             var document = workspaceFileDocuments[fileID]
@@ -595,7 +675,7 @@ final class AppState: ObservableObject {
                     await loadSessionDetail(sessionID: preferredSessionID)
                 } else {
                     selectedSessionID = nil
-                    setSessionMessages([])
+                    clearSessionMessages()
                 }
             }
         } catch {
@@ -608,7 +688,7 @@ final class AppState: ObservableObject {
     func loadSessionDetail(sessionID: String) async {
         guard let profile = activeConnection else { return }
         if selectedSessionID != sessionID {
-            setSessionMessages([])
+            clearSessionMessages()
         }
         selectedSessionID = sessionID
         sessionsError = nil
@@ -619,17 +699,17 @@ final class AppState: ObservableObject {
                 connection: profile,
                 se
```

**File**: `Sources/HermesDesktop/App/HermesDesktopApp.swift` (modified, +3/-0)
```diff
@@ -13,5 +13,8 @@ struct HermesDesktopApp: App {
                 .frame(minWidth: 940, minHeight: 520)
         }
         .defaultSize(width: 1360, height: 860)
+        .commands {
+            HermesDesktopCommands(appState: appState)
+        }
     }
 }
```

**File**: `Sources/HermesDesktop/App/HermesDesktopCommands.swift` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+import SwiftUI
+
+struct HermesDesktopCommands: Commands {
+    @ObservedObject var appState: AppState
+
+    var body: some Commands {
+        CommandMenu(L10n.string("Hermes")) {
+            Button(L10n.string("New Host")) {
+                appState.requestNewConnectionEditorFromCommand()
+            }
+            .keyboardShortcut("n", modifiers: [.command, .shift])
+
+            Button(L10n.string("New Chat")) {
+                appState.requestNewSessionFromCommand()
+            }
+            .keyboardShortcut("n", modifiers: [.command, .option])
+            .disabled(appState.activeConnection == nil || appState.isSendingSessionMessage)
+
+            Button(L10n.string("New Terminal Tab")) {
+                appState.openNewTerminalTabFromCommand()
+            }
+            .keyboardShortcut("t", modifiers: [.command, .option])
+            .disabled(appState.activeConnection == nil)
+
+            Divider()
+
+            Button(L10n.string("Refresh Current Section")) {
+                Task {
+                    await appState.refreshCurrentSectionFromCommand()
+                }
+            }
+            .keyboardShortcut("r", modifiers: [.command])
+            .disabled(!appState.canRefreshCurrentSection)
+
+            Button(L10n.string("Save Current File")) {
+                Task {
+                    await appState.saveSelectedWorkspaceFile()
+                }
+            }
+            .keyboardShortcut("s", modifiers: [.command])
+            .disabled(!appState.canSaveCurrentWorkspaceFile)
+        }
+
+        CommandMenu(L10n.string("Navigate")) {
+            ForEach(Array(AppSection.allCases.enumerated()), id: \.element.id) { index, section in
+                Button(L10n.string("Show %@", section.title)) {
+                    appState.requestSectionSelection(section)
+                }
+                .keyboardShortcut(KeyEquivalent(Character("\(index + 1)")), modifiers: [.command])
+                .disabled(!appState.isSectionAvailable(section))
+            }
+        }
+    }
+}
```

**File**: `Sources/HermesDesktop/Resources/en.lproj/Localizable.strings` (modified, +25/-0)
```diff
@@ -470,3 +470,28 @@
 "Run requested for %@" = "Run requested for %@";
 "Unable to run cron job" = "Unable to run cron job";
 "SKILL.md content cannot be empty." = "SKILL.md content cannot be empty.";
+
+"Cron Jobs (%@)" = "Cron Jobs (%@)";
+"Cron Jobs (%@ of %@)" = "Cron Jobs (%@ of %@)";
+"Discovered Skills (%@)" = "Discovered Skills (%@)";
+"Discovered Skills (%@ of %@)" = "Discovered Skills (%@ of %@)";
+"Kanban Tasks (%@)" = "Kanban Tasks (%@)";
+"Kanban Tasks (%@ of %@)" = "Kanban Tasks (%@ of %@)";
+"A cron job title is required." = "A cron job title is required.";
+"A delivery target is required." = "A delivery target is required.";
+"A prompt is required." = "A prompt is required.";
+"A valid schedule is required." = "A valid schedule is required.";
+"Skill names must be comma-separated without embedded commas." = "Skill names must be comma-separated without embedded commas.";
+"Task title is required." = "Task title is required.";
+"Hermes" = "Hermes";
+"Navigate" = "Navigate";
+"New Chat" = "New Chat";
+"New Terminal Tab" = "New Terminal Tab";
+"Refresh Current Section" = "Refresh Current Section";
+"Save Current File" = "Save Current File";
+"Show %@" = "Show %@";
+"New Terminal tab opened" = "New Terminal tab opened";
+"Name is required." = "Name is required.";
+"Add an SSH alias or host." = "Add an SSH alias or host.";
+"Enter a valid SSH port from 1 to 65535." = "Enter a valid SSH port from 1 to 65535.";
+"Check the connection details before saving." = "Check the connection details before saving.";
```

**File**: `Sources/HermesDesktop/Resources/ru.lproj/Localizable.strings` (modified, +25/-0)
```diff
@@ -466,3 +466,28 @@
 "Run requested for %@" = "Запрошен запуск %@";
 "Unable to run cron job" = "Не удалось запустить cron-задание";
 "SKILL.md content cannot be empty." = "Содержимое SKILL.md не может быть пустым.";
+
+"Cron Jobs (%@)" = "Cron-задания (%@)";
+"Cron Jobs (%@ of %@)" = "Cron-задания (%@ из %@)";
+"Discovered Skills (%@)" = "Обнаруженные навыки (%@)";
+"Discovered Skills (%@ of %@)" = "Обнаруженные навыки (%@ из %@)";
+"Kanban Tasks (%@)" = "Задачи Kanban (%@)";
+"Kanban Tasks (%@ of %@)" = "Задачи Kanban (%@ из %@)";
+"A cron job title is required." = "Требуется название cron-задания.";
+"A delivery target is required." = "Требуется цель доставки.";
+"A prompt is required." = "Требуется prompt.";
+"A valid schedule is required." = "Требуется корректное расписание.";
+"Skill names must be comma-separated without embedded commas." = "Имена навыков должны разделяться запятыми без запятых внутри имени.";
+"Task title is required." = "Требуется название задачи.";
+"Hermes" = "Hermes";
+"Navigate" = "Навигация";
+"New Chat" = "Новый чат";
+"New Terminal Tab" = "Новая вкладка Терминала";
+"Refresh Current Section" = "Обновить текущий раздел";
+"Save Current File" = "Сохранить текущий файл";
+"Show %@" = "Показать %@";
+"New Terminal tab opened" = "Открыта новая вкладка Терминала";
+"Name is required." = "Требуется имя.";
+"Add an SSH alias or host." = "Добавьте SSH-алиас или хост.";
+"Enter a valid SSH port from 1 to 65535." = "Введите корректный SSH-порт от 1 до 65535.";
+"Check the connection details before saving." = "Проверьте данные подключения перед сохранением.";
```

**File**: `Sources/HermesDesktop/Resources/zh-Hans.lproj/Localizable.strings` (modified, +25/-0)
```diff
@@ -466,3 +466,28 @@
 "Run requested for %@" = "已请求运行 %@";
 "Unable to run cron job" = "无法运行定时任务";
 "SKILL.md content cannot be empty." = "SKILL.md 内容不能为空。";
+
+"Cron Jobs (%@)" = "定时任务 (%@)";
+"Cron Jobs (%@ of %@)" = "定时任务 (%@ / %@)";
+"Discovered Skills (%@)" = "已发现技能 (%@)";
+"Discovered Skills (%@ of %@)" = "已发现技能 (%@ / %@)";
+"Kanban Tasks (%@)" = "看板任务 (%@)";
+"Kanban Tasks (%@ of %@)" = "看板任务 (%@ / %@)";
+"A cron job title is required." = "需要定时任务标题。";
+"A delivery target is required." = "需要投递目标。";
+"A prompt is required." = "需要 prompt。";
+"A valid schedule is required." = "需要有效的计划。";
+"Skill names must be comma-separated without embedded commas." = "技能名称必须用逗号分隔，名称内不能包含逗号。";
+"Task title is required." = "需要任务标题。";
+"Hermes" = "Hermes";
+"Navigate" = "导航";
+"New Chat" = "新建聊天";
+"New Terminal Tab" = "新建终端标签页";
+"Refresh Current Section" = "刷新当前区域";
+"Save Current File" = "保存当前文件";
+"Show %@" = "显示 %@";
+"New Terminal tab opened" = "已打开新的终端标签页";
+"Name is required." = "需要名称。";
+"Add an SSH alias or host." = "添加 SSH 别名或主机。";
+"Enter a valid SSH port from 1 to 65535." = "请输入 1 到 65535 之间的有效 SSH 端口。";
+"Check the connection details before saving." = "保存前请检查连接详情。";
```

**File**: `Sources/HermesDesktop/Views/Connections/ConnectionEditorSheet.swift` (modified, +23/-2)
```diff
@@ -92,6 +92,10 @@ struct ConnectionEditorSheet: View {
                                     .focused($focusedField, equals: .hermesProfile)
                                     .textFieldStyle(.roundedBorder)
                             }
+
+                            if let validationMessage {
+                                HermesValidationMessage(text: validationMessage)
+                            }
                         }
                     }
 
@@ -194,15 +198,32 @@ struct ConnectionEditorSheet: View {
     private var parsedPort: Int? {
         let trimmed = portText.trimmingCharacters(in: .whitespacesAndNewlines)
         guard !trimmed.isEmpty else { return nil }
-        guard let value = Int(trimmed), value > 0 else { return nil }
+        guard let value = Int(trimmed), (1...65_535).contains(value) else { return nil }
         return value
     }
 
     private var isDraftValid: Bool {
+        validationMessage == nil
+    }
+
+    private var validationMessage: String? {
         let hasValidPort = portText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || parsedPort != nil
         var candidate = draft
         candidate.sshPort = parsedPort
-        return hasValidPort && candidate.isValid
+
+        if candidate.label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
+            return "Name is required."
+        }
+
+        if candidate.trimmedAlias == nil && candidate.trimmedHost == nil {
+            return "Add an SSH alias or host."
+        }
+
+        if !hasValidPort {
+            return "Enter a valid SSH port from 1 to 65535."
+        }
+
+        return candidate.isValid ? nil : "Check the connection details before saving."
     }
 
     private var hermesProfileBinding: Binding<String> {
```

**File**: `Sources/HermesDesktop/Views/Connections/ConnectionsView.swift` (modified, +12/-0)
```diff
@@ -73,6 +73,12 @@ struct ConnectionsView: View {
             }
             .id(editorPresentationID)
         }
+        .onAppear {
+            presentPendingNewConnectionEditorIfNeeded()
+        }
+        .onChange(of: appState.pendingNewConnectionEditorRequestID) { _, _ in
+            presentPendingNewConnectionEditorIfNeeded()
+        }
     }
 
     private var hostsPanel: some View {
@@ -147,6 +153,12 @@ struct ConnectionsView: View {
         editorPresentationID = UUID()
         isPresentingEditor = true
     }
+
+    private func presentPendingNewConnectionEditorIfNeeded() {
+        guard let requestID = appState.pendingNewConnectionEditorRequestID else { return }
+        presentEditor(for: ConnectionProfile(), isEditing: false)
+        appState.consumeNewConnectionEditorRequest(requestID)
+    }
 }
 
 private struct GuideRow: View {
```

---

### Incident Patch 11: `fd3ffb02` (2026-05-03)
**Commit Message**: Add terminal resize trace diagnostics

**File**: `Sources/HermesDesktop/Services/Terminal/TerminalTraceSession.swift` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import AppKit
+import Foundation
+@preconcurrency import SwiftTerm
+
+@MainActor
+final class TerminalTraceSession {
+    let rootURL: URL
+    let rawHostOutputURL: URL
+
+    private let eventsURL: URL
+    private let eventsHandle: FileHandle?
+    private let encoder = JSONEncoder()
+
+    static func make(launchToken: UUID) -> TerminalTraceSession? {
+        guard let configuredPath = ProcessInfo.processInfo.environment["HERMES_TERMINAL_TRACE_DIR"]?
+            .trimmingCharacters(in: .whitespacesAndNewlines),
+              !configuredPath.isEmpty
+        else {
+            return nil
+        }
+
+        let expandedPath = (configuredPath as NSString).expandingTildeInPath
+        let baseURL = URL(fileURLWithPath: expandedPath, isDirectory: true)
+        let timestamp = Self.makeDirectoryTimestamp()
+        let shortToken = String(launchToken.uuidString.prefix(8))
+        let rootURL = baseURL.appendingPathComponent(
+            "terminal-\(timestamp)-\(shortToken)",
+            isDirectory: true
+        )
+
+        return TerminalTraceSession(rootURL: rootURL)
+    }
+
+    init?(rootURL: URL) {
+        self.rootURL = rootURL
+        self.rawHostOutputURL = rootURL.appendingPathComponent("raw-host-output", isDirectory: true)
+        self.eventsURL = rootURL.appendingPathComponent("events.jsonl")
+
+        do {
+            try FileManager.default.createDirectory(
+                at: rawHostOutputURL,
+                withIntermediateDirectories: true
+            )
+            FileManager.default.createFile(atPath: eventsURL.path, contents: nil)
+            self.eventsHandle = try FileHandle(forWritingTo: eventsURL)
+        } catch {
+            return nil
+        }
+    }
+
+    deinit {
+        try? eventsHandle?.close()
+    }
+
+    func record(
+        _ name: String,
+        terminalView: LocalProcessTerminalView,
+        hostView: NSView?,
+        reportedCols: Int? = nil,
+        reportedRows: Int? = nil,
+        note: String? = nil
+    ) {
+        let terminal = terminalView.getTerminal()
+        let cursor = terminal.getCursorLocation()
+        let event = TerminalTraceEvent(
+            timestamp: Self.makeEventTimestamp(),
+            name: name,
+            reportedCols: reportedCols,
+            reportedRows: reportedRows,
+            terminalCols: terminal.cols,
+            terminalRows: terminal.rows,
+            cursorX: cursor.x,
+            cursorY: cursor.y,
+            topVisibleRow: terminal.getTopVisibleRow(),
+            isScrolledToEnd: terminalView.isScrolledToTerminalEnd,
+            terminalFrameWidth: Double(terminalView.frame.width),
+            terminalFrameHeight: Double(terminalView.frame.height),
+            hostBoundsWidth: hostView.map { Double($0.bounds.width) },
+            hostBoundsHeight: hostView.map { Double($0.bounds.height) },
+            note: note
+        )
+
+        guard let data = try? encoder.encode(event) else { return }
+        eventsHandle?.seekToEndOfFile()
+        eventsHandle?.write(data)
+        eventsHandle?.write(Data([0x0a]))
+    }
+
+    private static func makeDirectoryTimestamp() -> String {
+        makeEventTimestamp()
+            .replacingOccurrences(of: ":", with: "-")
+            .replacingOccurrences(of: ".", with: "-")
+    }
+
+    private static func makeEventTimestamp() -> String {
+        let formatter = ISO8601DateFormatter()
+        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
+        return formatter.string(from: Date())
+    }
+}
+
+private struct TerminalTraceEvent: Encodable {
+    let timestamp: String
+    let name: String
+    let reportedCols: Int?
+    let reportedRows: Int?
+    let terminalCols: Int
+    let terminalRows: Int
+    let cursorX: Int
+    let cursorY: Int
+    let topVisibleRow: Int
+    let isScrolledToEnd: Bool
+    let terminalFrameWidth: Double
+    let terminalFrameHeight: Double
+    let hostBoundsWidth: Double?
+    let hostBoundsHeight: Double?
+    let note: String?
+}
```

**File**: `Sources/HermesDesktop/Services/Terminal/TerminalViewHost.swift` (modified, +65/-4)
```diff
@@ -12,6 +12,7 @@ final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
     private var onTitleChange: ((String) -> Void)?
     private var onDirectoryChange: ((String?) -> Void)?
     private var onProcessExit: ((Int32?) -> Void)?
+    private var traceSession: TerminalTraceSession?
 
     override init() {
         super.init()
@@ -43,10 +44,17 @@ final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
         container.mount(hostView)
         applyAppearance(appearance)
         setActive(isActive)
+        traceSession?.record(
+            "mount",
+            terminalView: hostView.terminalView,
+            hostView: hostView,
+            note: isActive ? "active" : "inactive"
+        )
         scheduleStartIfNeeded(for: request)
     }
 
     func unmount(from container: TerminalMountContainerView) {
+        traceSession?.record("unmount", terminalView: hostView.terminalView, hostView: hostView)
         container.onLayout = nil
         container.unmountHostedView()
     }
@@ -55,36 +63,73 @@ final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
         performSelector(onMainThread: #selector(terminateOnMainThread), with: nil, waitUntilDone: false)
     }
 
-    nonisolated func sizeChanged(source: LocalProcessTerminalView, newCols: Int, newRows: Int) {}
+    nonisolated func sizeChanged(source: LocalProcessTerminalView, newCols: Int, newRows: Int) {
+        Task { @MainActor [weak self] in
+            guard let self else { return }
+            traceSession?.record(
+                "pty-size-changed",
+                terminalView: hostView.terminalView,
+                hostView: hostView,
+                reportedCols: newCols,
+                reportedRows: newRows
+            )
+        }
+    }
 
     nonisolated func setTerminalTitle(source: LocalProcessTerminalView, title: String) {
         Task { @MainActor [weak self] in
-            self?.onTitleChange?(title)
+            guard let self else { return }
+            traceSession?.record(
+                "terminal-title",
+                terminalView: hostView.terminalView,
+                hostView: hostView,
+                note: title
+            )
+            onTitleChange?(title)
         }
     }
 
     nonisolated func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {
         Task { @MainActor [weak self] in
-            self?.onDirectoryChange?(directory)
+            guard let self else { return }
+            traceSession?.record(
+                "current-directory",
+                terminalView: hostView.terminalView,
+                hostView: hostView,
+                note: directory
+            )
+            onDirectoryChange?(directory)
         }
     }
 
     nonisolated func processTerminated(source: TerminalView, exitCode: Int32?) {
         Task { @MainActor [weak self] in
-            self?.onProcessExit?(exitCode)
+            guard let self else { return }
+            traceSession?.record(
+                "process-terminated",
+                terminalView: hostView.terminalView,
+                hostView: hostView,
+                note: exitCode.map(String.init) ?? "nil"
+            )
+            onProcessExit?(exitCode)
         }
     }
 
     private func scheduleStartIfNeeded(for request: TerminalLaunchRequest) {
         let launchToken = request.launchToken
         guard startedLaunchToken != launchToken else { return }
+        if traceSession == nil {
+            traceSession = TerminalTraceSession.make(launchToken: launchToken)
+            traceSession?.record("trace-created", terminalView: hostView.terminalView, hostView: hostView)
+        }
         pendingLaunchRequest = request
         startPendingLaunchIfReady()
     }
 
     private func mountedContainerDidLayout(_ container: TerminalMountContainerView) {
         guard hostView.superview === container else { return }
         hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
+        traceSession?.record("container-layout", terminalView: hostView.terminalView, hostView: hostView)
         startPendingLaunchIfReady()
     }
 
@@ -97,19 +142,30 @@ final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
         guard !hostView.isHidden, hostView.hasUsableTerminalFrame else { return }
 
         hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
+        traceSession?.record("pending-launch-ready", terminalView: hostView.terminalView, hostView: hostView)
         pendingLaunchRequest = nil
         startIfNeeded(for: request)
     }
 
     private func startIfNeeded(for request: TerminalLaunchRequest) {
         guard startedLaunchToken != request.launchToken else { return }
         startedLaunchToken = request.launchToken
+        if let traceSession {
+            hostView.terminalView.setHostLogging(directory: traceSession.rawHostOutputURL.path)
+            traceSession.record(
+      
```

**File**: `scripts/run-terminal-trace.sh` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+#!/usr/bin/env bash
+set -euo pipefail
+
+ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
+APP_PATH="${1:-"$ROOT_DIR/dist/HermesDesktop.app"}"
+TRACE_DIR="${HERMES_TERMINAL_TRACE_DIR:-/tmp/hermes-terminal-traces}"
+EXECUTABLE="$APP_PATH/Contents/MacOS/HermesDesktop"
+
+if [[ ! -x "$EXECUTABLE" ]]; then
+    echo "Hermes Desktop executable not found at: $EXECUTABLE" >&2
+    echo "Run scripts/package-github-release.sh first, or pass a .app path." >&2
+    exit 1
+fi
+
+mkdir -p "$TRACE_DIR"
+
+echo "Launching Hermes Desktop with terminal tracing enabled."
+echo "Trace root: $TRACE_DIR"
+echo "Quit Hermes Desktop to end this traced run."
+
+HERMES_TERMINAL_TRACE_DIR="$TRACE_DIR" "$EXECUTABLE"
```

---

### Incident Patch 12: `b00aa5c7` (2026-05-03)
**Commit Message**: Fix terminal erase-line wrap state

**File**: `Tests/HermesDesktopTests/SwiftTermReflowTests.swift` (modified, +40/-0)
```diff
@@ -70,6 +70,46 @@ struct SwiftTermReflowTests {
         #expect(harness.terminal.buffer.x == currentLine.count)
     }
 
+    @Test
+    func eraseLineBreaksStaleSoftWrapBeforeResize() {
+        let harness = TerminalHarness(cols: 12, rows: 6)
+        let wrappedOutput = "abcdefghijklmnopqrstuv"
+        let redrawnStatus = "tool: done"
+
+        harness.terminal.feed(text: wrappedOutput)
+        #expect(harness.terminal.buffer.lines[harness.terminal.buffer.yBase + harness.terminal.buffer.y].isWrapped)
+
+        harness.terminal.feed(text: "\r\u{1B}[2K" + redrawnStatus)
+        #expect(!harness.terminal.buffer.lines[harness.terminal.buffer.yBase + harness.terminal.buffer.y].isWrapped)
+
+        harness.terminal.resize(cols: 8, rows: 6)
+
+        let lines = logicalLines(in: harness.terminal)
+        #expect(lines.contains("abcdefghijkl"))
+        #expect(lines.contains(redrawnStatus))
+        #expect(!lines.contains { $0.contains("abcdefghijkl") && $0.contains(redrawnStatus) })
+    }
+
+    @Test
+    func eraseToRightFromLineStartBreaksStaleSoftWrapBeforeResize() {
+        let harness = TerminalHarness(cols: 12, rows: 6)
+        let wrappedOutput = "abcdefghijklmnopqrstuv"
+        let redrawnStatus = "ctx -- 9s"
+
+        harness.terminal.feed(text: wrappedOutput)
+        #expect(harness.terminal.buffer.lines[harness.terminal.buffer.yBase + harness.terminal.buffer.y].isWrapped)
+
+        harness.terminal.feed(text: "\r\u{1B}[K" + redrawnStatus)
+        #expect(!harness.terminal.buffer.lines[harness.terminal.buffer.yBase + harness.terminal.buffer.y].isWrapped)
+
+        harness.terminal.resize(cols: 8, rows: 6)
+
+        let lines = logicalLines(in: harness.terminal)
+        #expect(lines.contains("abcdefghijkl"))
+        #expect(lines.contains(redrawnStatus))
+        #expect(!lines.contains { $0.contains("abcdefghijkl") && $0.contains(redrawnStatus) })
+    }
+
     @MainActor
     @Test
     func terminalViewResizeKeepsViewportPinnedWhenAlreadyAtEnd() {
```

**File**: `Vendor/SwiftTerm/Sources/SwiftTerm/Terminal.swift` (modified, +19/-3)
```diff
@@ -2299,11 +2299,19 @@ open class Terminal {
         
         switch p {
         case 0:
-            eraseInBufferLine (y: buffer.y, start: buffer.x, end: cols)
+            let clearsFromLineStart = buffer.x == 0
+            eraseInBufferLine (y: buffer.y, start: buffer.x, end: cols, clearWrap: clearsFromLineStart)
+            if clearsFromLineStart {
+                clearWrappedContinuationAfterLine(buffer.y)
+            }
         case 1:
-            eraseInBufferLine (y: buffer.y, start: 0, end: buffer.x + 1)
+            eraseInBufferLine (y: buffer.y, start: 0, end: buffer.x + 1, clearWrap: true)
+            if buffer.x + 1 >= cols {
+                clearWrappedContinuationAfterLine(buffer.y)
+            }
         case 2:
-            eraseInBufferLine (y: buffer.y, start: 0, end: cols)
+            eraseInBufferLine (y: buffer.y, start: 0, end: cols, clearWrap: true)
+            clearWrappedContinuationAfterLine(buffer.y)
         default:
             break
         }
@@ -2398,6 +2406,14 @@ open class Terminal {
             line.renderMode = .single
         }
     }
+
+    func clearWrappedContinuationAfterLine (_ y: Int)
+    {
+        let nextY = y + 1
+        let absoluteNextY = buffer.yBase + nextY
+        guard nextY < rows, absoluteNextY < buffer.lines.count else { return }
+        buffer.lines [absoluteNextY].isWrapped = false
+    }
     
     //
     // CSI Ps L
```

---

### Incident Patch 13: `8691888f` (2026-05-02)
**Commit Message**: Fix terminal resize and reflow stability

**File**: `Package.swift` (modified, +5/-2)
```diff
@@ -1,4 +1,4 @@
-// swift-tools-version: 6.2
+// swift-tools-version: 6.1
 
 import PackageDescription
 
@@ -30,7 +30,10 @@ let package = Package(
         ),
         .testTarget(
             name: "HermesDesktopTests",
-            dependencies: ["HermesDesktop"],
+            dependencies: [
+                "HermesDesktop",
+                .product(name: "SwiftTerm", package: "SwiftTerm")
+            ],
             path: "Tests/HermesDesktopTests"
         )
     ]
```

**File**: `Sources/HermesDesktop/Models/SessionModels.swift` (modified, +7/-7)
```diff
@@ -1,6 +1,6 @@
 import Foundation
 
-struct SessionListPage: Codable {
+struct SessionListPage: Codable, Sendable {
     let ok: Bool
     let items: [SessionSummary]
     let totalCount: Int
@@ -12,7 +12,7 @@ struct SessionListPage: Codable {
     }
 }
 
-struct SessionSummary: Codable, Identifiable, Hashable, TitleIdentifiable, OptionalModelDisplayable {
+struct SessionSummary: Codable, Identifiable, Hashable, Sendable, TitleIdentifiable, OptionalModelDisplayable {
     let id: String
     let title: String?
     let model: String?
@@ -32,12 +32,12 @@ struct SessionSummary: Codable, Identifiable, Hashable, TitleIdentifiable, Optio
     }
 }
 
-struct SessionDetailResponse: Codable {
+struct SessionDetailResponse: Codable, Sendable {
     let ok: Bool
     let items: [SessionMessage]
 }
 
-struct SessionMessage: Codable, Identifiable, Hashable {
+struct SessionMessage: Codable, Identifiable, Hashable, Sendable {
     let id: String
     let role: SessionMessageRole
     let content: String?
@@ -71,7 +71,7 @@ struct SessionMessage: Codable, Identifiable, Hashable {
     }
 }
 
-enum SessionTimestamp: Codable, Hashable {
+enum SessionTimestamp: Codable, Hashable, Sendable {
     case unixSeconds(Double)
     case text(String)
 
@@ -116,7 +116,7 @@ enum SessionTimestamp: Codable, Hashable {
     }
 }
 
-enum SessionMessageRole: Codable, Hashable {
+enum SessionMessageRole: Codable, Hashable, Sendable {
     case assistant
     case user
     case system
@@ -182,7 +182,7 @@ enum SessionMessageRole: Codable, Hashable {
     }
 }
 
-enum JSONValue: Codable, Hashable {
+enum JSONValue: Codable, Hashable, Sendable {
     case string(String)
     case number(Double)
     case int(Int)
```

**File**: `Sources/HermesDesktop/Services/Terminal/TerminalViewHost.swift` (modified, +47/-7)
```diff
@@ -6,7 +6,7 @@ import Foundation
 final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
     private let hostView = TerminalHostView()
     private var startedLaunchToken: UUID?
-    private var scheduledLaunchToken: UUID?
+    private var pendingLaunchRequest: TerminalLaunchRequest?
     private var appliedAppearance: TerminalThemeAppearance?
     private var onProcessStart: (() -> Void)?
     private var onTitleChange: ((String) -> Void)?
@@ -36,13 +36,18 @@ final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
         appearance: TerminalThemeAppearance,
         isActive: Bool
     ) {
+        container.onLayout = { [weak self, weak container] in
+            guard let container else { return }
+            self?.mountedContainerDidLayout(container)
+        }
         container.mount(hostView)
         applyAppearance(appearance)
         setActive(isActive)
         scheduleStartIfNeeded(for: request)
     }
 
     func unmount(from container: TerminalMountContainerView) {
+        container.onLayout = nil
         container.unmountHostedView()
     }
 
@@ -73,16 +78,30 @@ final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
     private func scheduleStartIfNeeded(for request: TerminalLaunchRequest) {
         let launchToken = request.launchToken
         guard startedLaunchToken != launchToken else { return }
-        guard scheduledLaunchToken != launchToken else { return }
-        scheduledLaunchToken = launchToken
+        pendingLaunchRequest = request
+        startPendingLaunchIfReady()
+    }
 
-        Task { @MainActor [weak self] in
-            self?.startIfNeeded(for: request)
+    private func mountedContainerDidLayout(_ container: TerminalMountContainerView) {
+        guard hostView.superview === container else { return }
+        hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
+        startPendingLaunchIfReady()
+    }
+
+    private func startPendingLaunchIfReady() {
+        guard let request = pendingLaunchRequest else { return }
+        guard startedLaunchToken != request.launchToken else {
+            pendingLaunchRequest = nil
+            return
         }
+        guard !hostView.isHidden, hostView.hasUsableTerminalFrame else { return }
+
+        hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
+        pendingLaunchRequest = nil
+        startIfNeeded(for: request)
     }
 
     private func startIfNeeded(for request: TerminalLaunchRequest) {
-        scheduledLaunchToken = nil
         guard startedLaunchToken != request.launchToken else { return }
         startedLaunchToken = request.launchToken
 
@@ -110,13 +129,16 @@ final class TerminalViewHost: NSObject, LocalProcessTerminalViewDelegate {
         hostView.isHidden = !isActive
         if !isActive {
             hostView.window?.makeFirstResponder(nil)
+        } else {
+            hostView.synchronizeTerminalLayout(maintainingScrollToEnd: true)
+            startPendingLaunchIfReady()
         }
     }
 
     @MainActor
     @objc
     private func terminateOnMainThread() {
-        scheduledLaunchToken = nil
+        pendingLaunchRequest = nil
         startedLaunchToken = nil
         hostView.terminalView.terminate()
     }
@@ -130,6 +152,7 @@ struct TerminalLaunchRequest {
 final class TerminalMountContainerView: NSView {
     private weak var hostedView: NSView?
     private var hostedConstraints: [NSLayoutConstraint] = []
+    var onLayout: (() -> Void)?
 
     override init(frame frameRect: NSRect) {
         super.init(frame: frameRect)
@@ -143,6 +166,11 @@ final class TerminalMountContainerView: NSView {
         fatalError("init(coder:) has not been implemented")
     }
 
+    override func layout() {
+        super.layout()
+        onLayout?()
+    }
+
     func mount(_ view: NSView) {
         if hostedView === view, view.superview === self {
             return
@@ -164,6 +192,7 @@ final class TerminalMountContainerView: NSView {
             view.bottomAnchor.constraint(equalTo: bottomAnchor)
         ]
         NSLayoutConstraint.activate(hostedConstraints)
+        needsLayout = true
     }
 
     func unmountHostedView() {
@@ -186,6 +215,10 @@ final class TerminalMountContainerView: NSView {
 final class TerminalHostView: NSView {
     let terminalView = LocalProcessTerminalView(frame: .zero)
 
+    var hasUsableTerminalFrame: Bool {
+        bounds.width >= 80 && bounds.height >= 40
+    }
+
     override init(frame frameRect: NSRect) {
         super.init(frame: frameRect)
         wantsLayer = true
@@ -206,6 +239,13 @@ final class TerminalHostView: NSView {
         fatalError("init(coder:) has not been implemented")
     }
 
+    func synchronizeTerminalLayout(maintainingScrollToEnd: Bool) {
+        guard hasUsableTerminalFrame else { return }
+        layoutSubtreeIfNeeded()
+        terminalView.layoutSubtreeIfNeeded()
+        terminalView.synchronizeSizeWithFrame(maintainingScrollToEnd:
```

**File**: `Tests/HermesDesktopTests/SwiftTermReflowTests.swift` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+import AppKit
+import Testing
+@testable import SwiftTerm
+
+struct SwiftTermReflowTests {
+    @Test
+    func narrowerReflowPreservesWrappedOutputAndClearsStaleCells() {
+        let harness = TerminalHarness(cols: 12, rows: 6)
+        let line = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ"
+
+        harness.terminal.feed(text: line + "\r\n")
+        harness.terminal.resize(cols: 8, rows: 8)
+
+        let lines = logicalLines(in: harness.terminal)
+        #expect(lines.filter { $0 == line }.count == 1)
+        #expect(!lines.contains { $0.contains("IJIJ") || $0.contains("GHIJGHIJ") })
+    }
+
+    @Test
+    func narrowerReflowPreservesCurrentCursorLine() {
+        let harness = TerminalHarness(cols: 10, rows: 5)
+        let line = "abcdefghijklmno"
+
+        harness.terminal.feed(text: line)
+        harness.terminal.resize(cols: 8, rows: 5)
+
+        #expect(logicalLines(in: harness.terminal).first == line)
+        #expect(harness.terminal.buffer.yBase + harness.terminal.buffer.y == 1)
+        #expect(harness.terminal.buffer.x == 7)
+    }
+
+    @Test
+    func widerReflowPreservesCurrentCursorLine() {
+        let harness = TerminalHarness(cols: 8, rows: 5)
+        let line = "abcdefghijklmno"
+
+        harness.terminal.feed(text: line)
+        harness.terminal.resize(cols: 20, rows: 5)
+
+        #expect(logicalLines(in: harness.terminal).first == line)
+        #expect(harness.terminal.buffer.yBase + harness.terminal.buffer.y == 0)
+        #expect(harness.terminal.buffer.x == 15)
+    }
+
+    @Test
+    func repeatedReflowPreservesScrollbackAndLiveCursorLine() {
+        let harness = TerminalHarness(cols: 14, rows: 6)
+        let completedLines = [
+            "short",
+            "first-long-output-line-with-stable-content",
+            "second-output-line-that-wraps-more-than-once",
+            "tail"
+        ]
+        let currentLine = "live-cursor-line"
+
+        for line in completedLines {
+            harness.terminal.feed(text: line + "\r\n")
+        }
+        harness.terminal.feed(text: currentLine)
+
+        for cols in [9, 17, 6, 24, 11, 20] {
+            harness.terminal.resize(cols: cols, rows: 7)
+            let lines = logicalLines(in: harness.terminal)
+            for line in completedLines {
+                #expect(lines.contains(line))
+            }
+            #expect(lines.contains(currentLine))
+        }
+
+        #expect(harness.terminal.buffer.x == currentLine.count)
+    }
+
+    @MainActor
+    @Test
+    func terminalViewResizeKeepsViewportPinnedWhenAlreadyAtEnd() {
+        let view = TerminalView(frame: CGRect(x: 0, y: 0, width: 240, height: 120))
+
+        for index in 0..<30 {
+            view.feed(text: "line-\(index)\r\n")
+        }
+        view.scrollToTerminalEnd(notifyAccessibility: false)
+
+        view.setFrameSize(NSSize(width: 160, height: 120))
+
+        let buffer = view.getTerminal().buffer
+        #expect(buffer.yDisp == min(buffer.yBase, max(0, buffer.lines.count - buffer.rows)))
+        #expect(view.isScrolledToTerminalEnd)
+    }
+
+    @MainActor
+    @Test
+    func terminalViewResizeDoesNotForceBottomWhenUserScrolledUp() {
+        let view = TerminalView(frame: CGRect(x: 0, y: 0, width: 240, height: 120))
+
+        for index in 0..<40 {
+            view.feed(text: "line-\(index)\r\n")
+        }
+        view.scrollToTerminalEnd(notifyAccessibility: false)
+        view.scrollUp(lines: 5)
+
+        view.setFrameSize(NSSize(width: 160, height: 120))
+
+        #expect(!view.isScrolledToTerminalEnd)
+    }
+
+    private func logicalLines(in terminal: Terminal) -> [String] {
+        let buffer = terminal.buffer
+        var result: [String] = []
+        var current = ""
+
+        for row in 0..<buffer.lines.count {
+            let line = terminal.translateBufferLineToString(
+                buffer: buffer,
+                line: row,
+                start: 0,
+                end: buffer.cols
+            )
+
+            if buffer.lines[row].isWrapped {
+                current += line
+            } else {
+                if !current.isEmpty {
+                    result.append(current)
+                }
+                current = line
+            }
+        }
+
+        if !current.isEmpty {
+            result.append(current)
+        }
+
+        return result
+    }
+}
+
+private final class TerminalHarness {
+    let delegate: RecordingTerminalDelegate
+    let terminal: Terminal
+
+    init(cols: Int, rows: Int) {
+        let delegate = RecordingTerminalDelegate()
+        self.delegate = delegate
+        self.terminal = Terminal(
+            delegate: delegate,
+            options: TerminalOptions(cols: cols, rows: rows, scrollback: 200)
+        )
+    }
+}
+
+private final class RecordingTerminalDelegate: TerminalDelegate {
+    func send(source _: Terminal, data _: ArraySlice<UInt8>) {}
+}
```

**File**: `Vendor/SwiftTerm/Sources/SwiftTerm/Apple/AppleTerminalView.swift` (modified, +37/-0)
```diff
@@ -1824,6 +1824,43 @@ extension TerminalView {
                 displayBuffer.lines.count > displayBuffer.rows
         }
     }
+
+    public var isScrolledToTerminalEnd: Bool {
+        let displayBuffer = terminal.displayBuffer
+        return terminal.isDisplayBufferAlternate || displayBuffer.yDisp >= displayBuffer.yBase
+    }
+
+    public func scrollToTerminalEnd(notifyAccessibility: Bool = true) {
+        let displayBuffer = terminal.displayBuffer
+        let maxScrollback = max(0, displayBuffer.lines.count - displayBuffer.rows)
+        scrollTo(row: min(displayBuffer.yBase, maxScrollback), notifyAccessibility: notifyAccessibility)
+    }
+
+    @discardableResult
+    public func synchronizeSizeWithFrame(maintainingScrollToEnd: Bool = true) -> Bool {
+        guard cellDimension != nil, frame.width > 0, frame.height > 0 else {
+            return false
+        }
+
+        let shouldRestoreEnd = maintainingScrollToEnd && isScrolledToTerminalEnd
+        let didResize = processSizeChange(newSize: frame.size)
+
+        if shouldRestoreEnd {
+            scrollToTerminalEnd(notifyAccessibility: false)
+        }
+
+        terminal.refresh(startRow: 0, endRow: terminal.rows)
+        updateDisplay(notifyAccessibility: false)
+        updateScroller()
+
+        #if os(macOS)
+        needsDisplay = true
+        #else
+        setNeedsDisplay(frame)
+        #endif
+
+        return didResize
+    }
     
     public func scroll (toPosition: Double)
     {
```

**File**: `Vendor/SwiftTerm/Sources/SwiftTerm/Buffer.swift` (modified, +180/-20)
```diff
@@ -478,8 +478,9 @@ public final class Buffer {
                 lines.maxLength = newMaxLength
             }
 
-            // Make sure that the cursor stays on screen
-            x = min (x, newCols - 1)
+            // Keep the original cursor column through reflow. Clamping before
+            // reflow loses the logical cursor offset when a live line becomes
+            // narrower than the current cursor position.
             y = min (y, newRows - 1)
             if addToY != 0 {
                 y += addToY
@@ -508,6 +509,10 @@ public final class Buffer {
                 }
             }
         }
+
+        // Make sure that the cursor stays on screen after reflow had a chance
+        // to remap the old logical offset onto the new wrapped line shape.
+        x = min (x, newCols - 1)
         
         // DEBUG: Post-condition
         if lines.count > 0 {
@@ -659,11 +664,106 @@ public final class Buffer {
         return cols
     }
 
-    func getLinesToRemove (oldCols: Int, newCols: Int, bufferAbsoluteY: Int, nullChar: CharData) -> [Int]
+    private struct CursorReflowTarget {
+        let groupStart: Int
+        let line: Int
+        let col: Int
+    }
+
+    private func cursorLogicalOffset(
+        in wrappedLines: [BufferLine],
+        groupStart: Int,
+        oldCols: Int,
+        bufferAbsoluteY: Int
+    ) -> Int? {
+        guard bufferAbsoluteY >= groupStart && bufferAbsoluteY < groupStart + wrappedLines.count else {
+            return nil
+        }
+
+        let cursorLineIndex = bufferAbsoluteY - groupStart
+        var offset = 0
+        if cursorLineIndex > 0 {
+            for lineIndex in 0..<cursorLineIndex {
+                offset += getWrappedLineTrimmedLength(wrappedLines, lineIndex, oldCols)
+            }
+        }
+
+        let cursorLineLength = getWrappedLineTrimmedLength(wrappedLines, cursorLineIndex, oldCols)
+        return offset + min(x, cursorLineLength)
+    }
+
+    private func cursorPosition(forLogicalOffset offset: Int, lineLengths: [Int], newCols: Int) -> (line: Int, col: Int) {
+        guard !lineLengths.isEmpty else {
+            return (0, 0)
+        }
+
+        var remaining = max(0, offset)
+        for lineIndex in 0..<lineLengths.count {
+            let lineLength = max(0, lineLengths[lineIndex])
+            if remaining <= lineLength {
+                return (lineIndex, min(remaining, max(0, newCols - 1)))
+            }
+            remaining -= lineLength
+        }
+
+        let lastLineIndex = lineLengths.count - 1
+        return (lastLineIndex, min(lineLengths[lastLineIndex], max(0, newCols - 1)))
+    }
+
+    private func restoreCursor(
+        groupStart: Int,
+        line: Int,
+        col: Int,
+        newRows: Int,
+        newCols: Int
+    ) {
+        let absoluteRow = groupStart + line
+        y = max(0, min(newRows - 1, absoluteRow - yBase))
+        x = max(0, min(newCols - 1, col))
+    }
+
+    private func wrappedLineStart(containing row: Int) -> Int {
+        var start = max(0, min(row, lines.count - 1))
+        while start > 0 && lines[start].isWrapped {
+            start -= 1
+        }
+        return start
+    }
+
+    private func wrappedLines(startingAt start: Int) -> [BufferLine] {
+        guard start >= 0 && start < lines.count else {
+            return []
+        }
+
+        var wrappedLines = [lines[start]]
+        var nextIndex = start + 1
+        while nextIndex < lines.count && lines[nextIndex].isWrapped {
+            wrappedLines.append(lines[nextIndex])
+            nextIndex += 1
+        }
+        return wrappedLines
+    }
+
+    private func removedLineCount(before index: Int, removals: [Int]) -> Int {
+        var removed = 0
+        var removalIndex = 0
+        while removalIndex < removals.count - 1 {
+            let start = removals[removalIndex]
+            let count = removals[removalIndex + 1]
+            if start < index {
+                removed += min(count, max(0, index - start))
+            }
+            removalIndex += 2
+        }
+        return removed
+    }
+
+    private func getLinesToRemove (oldCols: Int, newCols: Int, bufferAbsoluteY: Int, nullChar: CharData) -> (removals: [Int], cursorTarget: CursorReflowTarget?)
     {
         // Gather all BufferLines that need to be removed from the Buffer here so that they can be
         // batched up and only committed once
         var toRemove : [Int] = []
+        var cursorTarget: CursorReflowTarget?
 
         var y = 0
         while y < lines.count-1 {
@@ -685,12 +785,12 @@ public final class Buffer {
                 nextLine = lines [i]
             }
 
-            // If these lines contain the cursor don't touch them, the program will handle fixing up wrapped
-            // lines with the cursor
-            if bufferAbsoluteY >= y && bufferAbsoluteY < i {
-                y += wrappedLines.count - 1
-                continue
-            }
+            let cursorOffset = cursorLogi
```

**File**: `Vendor/SwiftTerm/Sources/SwiftTerm/Mac/MacTerminalView.swift` (modified, +4/-0)
```diff
@@ -677,7 +677,11 @@ open class TerminalView: NSView, NSTextInputClient, NSUserInterfaceValidations,
         updateScrollerFrame()
         updateProgressBarFrame()
         guard cellDimension != nil else { return }
+        let shouldRestoreTerminalEnd = isScrolledToTerminalEnd
         _ = processSizeChange(newSize: frame.size)
+        if shouldRestoreTerminalEnd {
+            scrollToTerminalEnd(notifyAccessibility: false)
+        }
 #if canImport(MetalKit)
         if useMetalRenderer {
             if inLiveResize && TerminalView.metalLiveResizeThrottleEnabled {
```

**File**: `scripts/package-github-release.sh` (modified, +7/-0)
```diff
@@ -5,13 +5,20 @@ set -euo pipefail
 ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
 APP_PATH="$ROOT_DIR/dist/HermesDesktop.app"
 ZIP_PATH="$ROOT_DIR/dist/HermesDesktop.app.zip"
+SHA256_PATH="$ZIP_PATH.sha256"
 
 "$ROOT_DIR/scripts/build-macos-app.sh"
 
 rm -f "$ZIP_PATH"
 xattr -cr "$APP_PATH" 2>/dev/null || true
 ditto -c -k --norsrc --keepParent "$APP_PATH" "$ZIP_PATH"
+(
+    cd "$ROOT_DIR"
+    shasum -a 256 "dist/HermesDesktop.app.zip" > "$SHA256_PATH"
+)
 
 echo
 echo "Release archive created:"
 echo "  $ZIP_PATH"
+echo "Checksum:"
+echo "  $SHA256_PATH"
```

---

### Incident Patch 14: `592ee9de` (2026-04-26)
**Commit Message**: Fix packaged localization resources

**File**: `Sources/HermesDesktop/Utilities/Localization.swift` (modified, +17/-4)
```diff
@@ -2,15 +2,28 @@ import Foundation
 
 enum L10n {
     static func string(_ key: String) -> String {
-        let mainValue = NSLocalizedString(key, bundle: .main, value: "", comment: "")
-        if !mainValue.isEmpty, mainValue != key {
-            return mainValue
+        for bundle in localizationBundles {
+            let value = NSLocalizedString(key, bundle: bundle, value: "", comment: "")
+            if !value.isEmpty, value != key {
+                return value
+            }
         }
 
-        return NSLocalizedString(key, bundle: .module, value: key, comment: "")
+        return key
     }
 
     static func string(_ key: String, _ arguments: CVarArg...) -> String {
         String(format: string(key), arguments: arguments)
     }
+
+    private static let localizationBundles: [Bundle] = {
+        let resourceBundleName = "HermesDesktop_HermesDesktop.bundle"
+        let candidateURLs = [
+            Bundle.main.resourceURL?.appendingPathComponent(resourceBundleName),
+            Bundle.main.bundleURL.appendingPathComponent(resourceBundleName)
+        ].compactMap { $0 }
+
+        let resourceBundles = candidateURLs.compactMap(Bundle.init(url:))
+        return [.main] + resourceBundles
+    }()
 }
```

**File**: `scripts/build-macos-app.sh` (modified, +44/-0)
```diff
@@ -18,6 +18,7 @@ PLIST_PATH="$ROOT_DIR/packaging/Info.plist"
 SHADER_SOURCE_PATH="$ROOT_DIR/Vendor/SwiftTerm/Sources/SwiftTerm/Apple/Metal/Shaders.metal"
 LOCALIZATION_SOURCE_PATH="$ROOT_DIR/Sources/HermesDesktop/Resources"
 UNIVERSAL_EXECUTABLE_PATH="$SCRATCH_PATH/${APP_NAME}-universal"
+APP_RESOURCE_BUNDLE_NAME="${APP_NAME}_${APP_NAME}.bundle"
 
 if [[ -n "${HERMES_MAC_ARCHS:-}" ]]; then
     read -r -a BUILD_ARCHES <<<"$HERMES_MAC_ARCHS"
@@ -156,6 +157,42 @@ bin_dir_for_arch() {
     env "${BUILD_ENV[@]}" swift "${SWIFT_FLAGS[@]}" --arch "$arch" --show-bin-path
 }
 
+resource_bundle_for_arch() {
+    local arch="$1"
+    local bin_dir
+
+    bin_dir="$(bin_dir_for_arch "$arch")"
+    printf '%s\n' "$bin_dir/$APP_RESOURCE_BUNDLE_NAME"
+}
+
+verify_localization_resources() {
+    local missing=0
+    local bundle_path="$RESOURCES_PATH/$APP_RESOURCE_BUNDLE_NAME"
+
+    if [[ ! -d "$bundle_path" ]]; then
+        echo "error: missing packaged SwiftPM resource bundle at $bundle_path" >&2
+        missing=1
+    fi
+
+    for locale in en ru zh-Hans; do
+        if [[ ! -f "$RESOURCES_PATH/$locale.lproj/Localizable.strings" ]]; then
+            echo "error: missing main localization file for $locale" >&2
+            missing=1
+        fi
+    done
+
+    for locale in en ru zh-hans; do
+        if [[ ! -f "$bundle_path/$locale.lproj/Localizable.strings" ]]; then
+            echo "error: missing SwiftPM bundle localization file for $locale" >&2
+            missing=1
+        fi
+    done
+
+    if (( missing != 0 )); then
+        exit 1
+    fi
+}
+
 echo "Building $APP_DISPLAY_NAME universal bundle for architectures: ${BUILD_ARCHES[*]}"
 for arch in "${BUILD_ARCHES[@]}"; do
     build_arch "$arch"
@@ -196,9 +233,16 @@ cp "$PLIST_PATH" "$CONTENTS_PATH/Info.plist"
 stamp_plist_versions "$CONTENTS_PATH/Info.plist"
 cp "$ICNS_PATH" "$RESOURCES_PATH/AppIcon.icns"
 cp "$SHADER_SOURCE_PATH" "$RESOURCES_PATH/Shaders.metal"
+APP_RESOURCE_BUNDLE_PATH="$(resource_bundle_for_arch "${BUILD_ARCHES[0]}")"
+if [[ ! -d "$APP_RESOURCE_BUNDLE_PATH" ]]; then
+    echo "error: expected SwiftPM resource bundle not found at $APP_RESOURCE_BUNDLE_PATH" >&2
+    exit 1
+fi
+cp -R "$APP_RESOURCE_BUNDLE_PATH" "$RESOURCES_PATH/"
 if [[ -d "$LOCALIZATION_SOURCE_PATH" ]]; then
     find "$LOCALIZATION_SOURCE_PATH" -maxdepth 1 -name "*.lproj" -type d -exec cp -R {} "$RESOURCES_PATH/" \;
 fi
+verify_localization_resources
 codesign --force --deep --sign - "$BUNDLE_PATH" >/dev/null
 codesign --verify --deep --strict "$BUNDLE_PATH" >/dev/null
 
```

---

### Incident Patch 15: `3e8ac2a0` (2026-04-19)
**Commit Message**: Add GitHub Pages landing and ignore test build artifacts

**File**: `.github/workflows/deploy-pages.yml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+name: Deploy Pages
+
+on:
+  push:
+    branches:
+      - main
+  workflow_dispatch:
+
+permissions:
+  contents: read
+  pages: write
+  id-token: write
+
+concurrency:
+  group: pages
+  cancel-in-progress: true
+
+jobs:
+  build:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout
+        uses: actions/checkout@v5
+
+      - name: Configure GitHub Pages
+        uses: actions/configure-pages@v5
+
+      - name: Stage static site
+        run: |
+          mkdir -p _site/assets
+          cp site/index.html _site/index.html
+          cp assets/CRON-JOBS.png _site/assets/CRON-JOBS.png
+          cp assets/USAGE.png _site/assets/USAGE.png
+          cp assets/SKILLS.png _site/assets/SKILLS.png
+          cp assets/TERMINALE.png _site/assets/TERMINALE.png
+          touch _site/.nojekyll
+
+      - name: Upload Pages artifact
+        uses: actions/upload-pages-artifact@v4
+        with:
+          path: _site
+
+  deploy:
+    needs: build
+    runs-on: ubuntu-latest
+    environment:
+      name: github-pages
+      url: ${{ steps.deployment.outputs.page_url }}
+    steps:
+      - name: Deploy to GitHub Pages
+        id: deployment
+        uses: actions/deploy-pages@v4
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 .DS_Store
 /AGENTS.md
 /.build
+/.build-tests
 /dist
 /docs/
 /private/
```

**File**: `site/index.html` (added, +695/-0)
```diff
@@ -0,0 +1,695 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Hermes Desktop</title>
+  <meta name="description" content="Hermes Desktop is a native macOS workspace for Hermes Agent over SSH. Real terminal, real files, real host state, no gateway layer.">
+  <style>
+    :root {
+      --bg: #f3efe7;
+      --paper: #ece5d9;
+      --ink: #111111;
+      --muted: #5f5a54;
+      --line: #111111;
+      --accent: #ef4023;
+      --accent-ink: #fff8f1;
+    }
+
+    * { box-sizing: border-box; }
+
+    html { scroll-behavior: smooth; }
+
+    body {
+      margin: 0;
+      background:
+        linear-gradient(180deg, rgba(239, 64, 35, 0.06), transparent 16rem),
+        var(--bg);
+      color: var(--ink);
+      font-family: "IBM Plex Sans", "Aptos", "Segoe UI", sans-serif;
+      line-height: 1.55;
+    }
+
+    img { display: block; max-width: 100%; }
+
+    a {
+      color: inherit;
+      text-decoration-thickness: 2px;
+      text-underline-offset: 0.18em;
+    }
+
+    .shell {
+      width: min(1200px, calc(100vw - 2rem));
+      margin: 0 auto;
+    }
+
+    .topbar {
+      position: sticky;
+      top: 0;
+      z-index: 10;
+      backdrop-filter: blur(8px);
+      background: rgba(243, 239, 231, 0.86);
+      border-bottom: 3px solid var(--line);
+    }
+
+    .topbar-inner {
+      display: flex;
+      align-items: center;
+      gap: 1rem;
+      justify-content: space-between;
+      padding: 0.9rem 0;
+    }
+
+    .brand {
+      font-family: "IBM Plex Mono", "SF Mono", monospace;
+      font-size: 0.95rem;
+      font-weight: 700;
+      letter-spacing: 0.08em;
+      text-transform: uppercase;
+      text-decoration: none;
+    }
+
+    .brand span { color: var(--accent); }
+
+    .topnav {
+      display: flex;
+      gap: 1rem;
+      align-items: center;
+      flex-wrap: wrap;
+      justify-content: flex-end;
+    }
+
+    .topnav a {
+      font-family: "IBM Plex Mono", "SF Mono", monospace;
+      font-size: 0.78rem;
+      text-transform: uppercase;
+      letter-spacing: 0.08em;
+      text-decoration: none;
+    }
+
+    .cta {
+      display: inline-flex;
+      align-items: center;
+      justify-content: center;
+      gap: 0.6rem;
+      padding: 0.95rem 1.3rem;
+      border: 3px solid var(--line);
+      background: var(--accent);
+      color: var(--accent-ink);
+      font-family: "IBM Plex Mono", "SF Mono", monospace;
+      font-size: 0.82rem;
+      font-weight: 700;
+      text-transform: uppercase;
+      letter-spacing: 0.08em;
+      text-decoration: none;
+      box-shadow: 8px 8px 0 var(--line);
+      transition: transform 120ms ease, box-shadow 120ms ease;
+    }
+
+    .cta:hover,
+    .cta:focus-visible {
+      transform: translate(3px, 3px);
+      box-shadow: 5px 5px 0 var(--line);
+    }
+
+    .cta.secondary {
+      background: var(--paper);
+      color: var(--ink);
+    }
+
+    .hero {
+      padding: 3rem 0 1.5rem;
+      display: grid;
+      grid-template-columns: 1.15fr 0.85fr;
+      gap: 1.2rem;
+    }
+
+    .hero-panel,
+    .card,
+    .quote,
+    .shot,
+    .footer-box {
+      border: 3px solid var(--line);
+      background: var(--paper);
+      box-shadow: 10px 10px 0 var(--line);
+    }
+
+    .hero-copy {
+      padding: 1.6rem;
+      background: linear-gradient(180deg, #141414 0%, #1c1c1c 100%);
+      color: #fff8f1;
+    }
+
+    .kicker,
+    .micro {
+      font-family: "IBM Plex Mono", "SF Mono", monospace;
+      font-size: 0.76rem;
+      text-transform: uppercase;
+      letter-spacing: 0.08em;
+    }
+
+    .kicker { color: #ff9d8d; }
+
+    h1,
+    h2,
+    h3 {
+      margin: 0;
+      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
+      font-weight: 900;
+      text-transform: uppercase;
+      line-height: 0.9;
+      letter-spacing: 0.02em;
+    }
+
+    h1 {
+      font-size: clamp(3.8rem, 10vw, 7.6rem);
+      margin-top: 1rem;
+    }
+
+    .hero-copy p {
+      margin: 1.3rem 0 0;
+      max-width: 42rem;
+      font-size: 1.05rem;
+      color: #efe4d7;
+    }
+
+    .hero-accent { color: var(--accent); }
+
+    .hero-actions {
+      margin-top: 1.6rem;
+      display: flex;
+      gap: 1rem;
+      flex-wrap: wrap;
+    }
+
+    .hero-side {
+      display: grid;
+      gap: 1.2rem;
+    }
+
+    .hero-stat {
+      padding: 1.3rem;
+      min-height: 11rem;
+      display: flex;
+      flex-direction: column;
+      justify-content: space-between;
+      background: repeating-linear-gradient(
+        -45deg,
+        #ece5d9,
+        #ece5d9 18px,
+        #e3dacd 18px,
+        #e3dacd 36px
+      );
+    }
+
+    .hero-stat strong {
+      display: block;
+      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
+      font-size: clamp(2.1rem, 5vw, 3.4rem);
+      line-height: 0.92;
+      text-transform: uppercase;
+    }
+
+    .hero-stat p {
+   
```

#### Recent Merged Pull Requests:
- **PR #56** (closed): fix: forward scroll wheel events to PTY in alternate screen mode (@Yunle-Lee)
- **PR #55** (closed): feat: add global background image support (@Yunle-Lee)
- **PR #28** (closed): Wrap remote bootstrap in exec /bin/sh -c for fish shell compatibility (@briepala)
- **PR #21** (closed): Fix kanban load failing against WAL DB without active sidecars (@OmarB97)
- **PR #19** (closed): fix: recreate SSH control socket directory before use (@batumilove)
- **PR #16** (2026-04-24): Add Simplified Chinese and Russian localization (@dodo-reach)
- **PR #9** (closed): feat: add Russian (ru) localization (@DrMaks22)
- **PR #6** (closed): Add support for AGENTS.md (@ideas24h)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
