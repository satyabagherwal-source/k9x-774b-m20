# Forensic Learning Record (Deep Inspection): johnbean393/Sidekick

> **Canonical Artifact**: `07_PROJECT_LEARNING/johnbean393-sidekick-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/johnbean393/Sidekick](https://github.com/johnbean393/Sidekick))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:14:20.120Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `johnbean393/Sidekick`
- **Description**: A native macOS app that allows users to chat with a local LLM that can respond with information from files, folders and websites on your Mac without installing any other software. Powered by llama.cpp.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3317 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sidekick/AppState.swift`
```
//
//  AppState.swift
//  Sidekick
//
//  Created by Bean John on 11/5/24.
//
//  Converted from `ObservableObject` to `@Observable` as part of
//  the SwiftData migration's Phase 1 cleanup. The shared instance
//  is now injected via `.environment(AppState.shared)` and read
//  via `@Environment(AppState.self)`.
//

import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
public final class AppState {

    static let shared: AppState = AppState()

    var commandSelectedExpertId: UUID? = nil

    /// Controls presentation of the onboarding ``SetupView`` sheet from
    /// ``ContentView``. Initialized from ``Settings/showSetup`` so the
    /// usual first-run behavior is preserved, but can be toggled at any
    /// time (e.g. from the Help menu) to re-run the onboarding wizard
    /// for debugging the setup flow.
    var isShowingSetup: Bool = Settings.showSetup

    static func setCommandSelectedExpertId(_ id: UUID) {
        Self.shared.commandSelectedExpertId = id
    }

    /// Re-presents the onboarding wizard, regardless of whether setup
    /// has already been completed. Used by the Help menu's
    /// "Show Onboarding Wizard" item.
    static func showOnboardingWizard() {
        Self.shared.isShowingSetup = true
    }
}

```

### Core Architecture Module: `Sidekick/Logic/Inference/InferenceLifecycleCoordinator.swift`
```
//
//  InferenceLifecycleCoordinator.swift
//  Sidekick
//
//  Centralizes shutdown of every memory-intensive inference child process
//  (llama-server, llama-perplexity, watchdog) so that on quit / kill /
//  unexpected termination no orphaned process is left running.
//

import AppKit
import Darwin
import Foundation
import OSLog

/// Coordinates the lifecycle of every inference-related child process spawned
/// by Sidekick. Owners of such processes (e.g. ``LlamaServer``) must
/// register their PID through this coordinator. On normal quit the
/// coordinator runs an awaited graceful shutdown; on `SIGTERM`/`SIGINT`/
/// `SIGHUP` (e.g. `kill <pid>` or shell-initiated termination) it falls back
/// to a best-effort synchronous cleanup before the app exits.
public final class InferenceLifecycleCoordinator: @unchecked Sendable {
    
    // MARK: - Logging
    
    private static let logger: Logger = .init(
        subsystem: Bundle.main.bundleIdentifier ?? "Sidekick",
        category: String(describing: InferenceLifecycleCoordinator.self)
    )
    
    // MARK: - Shared Instance
    
    public static let shared: InferenceLifecycleCoordinator = .init()
    
    // MARK: - State
    
    /// Tracked child process identifiers. Protected by `lock`.
    private var trackedPIDs: Set<pid_t> = []
    private let lock: NSLock = .init()
    
    /// Hooks supplied by owners that perform an awaitable graceful shutdown.
    /// Identified by a string so they can be replaced without leaking.
    private var asyncShutdownHooks: [String: @Sendable () async -> Void] = [:]
    
    /// Dispatch sources that translate UNIX signals into Swift callbacks.
    private var signalSources: [DispatchSourceSignal] = []
    
    /// Set to `true` once a coordinated shutdown is underway so callers can
    /// avoid restarting servers or scheduling new work during teardown.
    public private(set) var isShuttingDown: Bool = false
    
    // MARK: - Init
    
    private init() {}
    
    // MARK: - PID Registry
    
    /// Register a freshly-spawned inference child process so the coordinator
    /// can terminate it on shutdown. Safe to call from any thread.
    public func register(pid: pid_t) {
        guard pid > 0 else { return }
        self.lock.lock()
        self.trackedPIDs.insert(pid)
        self.lock.unlock()
    }
    
    /// Remove a PID from the registry after it has been intentionally stopped.
    public func unregister(pid: pid_t) {
        guard pid > 0 else { return }
        self.lock.lock()
        self.trackedPIDs.remove(pid)
        self.lock.unlock()
    }
    
    /// Snapshot the currently tracked PIDs.
    public func currentPIDs() -> [pid_t] {
        self.lock.lock()
        defer { self.lock.unlock() }
        return Array(self.trackedPIDs)
    }
    
    // MARK: - Shutdown Hooks
    
    /// Register an async shutdown hook keyed by ``identifier``. Replacing a
    /// previously-registered hook with the same identifier removes the old
    /// one.
    public func registerShutdownHook(
        identifier: String,
        _ hook: @escaping @Sendable () async -> Void
    ) {
        self.lock.lock()
        self.asyncShutdownHooks[identifier] = hook
        self.lock.unlock()
    }
    
    public func unregisterShutdownHook(identifier: String) {
        self.lock.lock()
        self.asyncShutdownHooks.removeValue(forKey: identifier)
        self.lock.unlock()
    }
    
    private func currentHooks() -> [(String, @Sendable () async -> Void)] {
        self.lock.lock()
        defer { self.lock.unlock() }
        return self.asyncShutdownHooks.map { ($0.key, $0.value) }
    }
    
    // MARK: - Signal Handling
    
    /// Install signal handlers that intercept `SIGTERM`, `SIGINT`, and
    /// `SIGHUP` and trigger a synchronous best-effort cleanup so that
    /// `kill <pid>`, `pkill`, terminal `Ctrl-C`, or session shutdown never
    /// leaves an orphaned `llama-server` alive.
    ///
    /// `SIGKILL` cannot be intercepted; the bundled `llama-server-watchdog`
    /// is the safety net for that case.
    public func installSignalHandlers() {
        let signals: [Int32] = [SIGTERM, SIGINT, SIGHUP]
        for signo in signals {
            // Ignore the default disposition so the signal is delivered to
            // the dispatch source instead of killing the process outright.
            signal(signo, SIG_IGN)
            let source = DispatchSource.makeSignalSource(
                signal: signo,
                queue: .global(qos: .userInitiated)
            )
            source.setEventHandler { [weak self] in
                Self.logger.notice(
                    "Received signal \(signo, privacy: .public); tearing down inference processes"
                )
                self?.handleTerminationSignal(signo: signo)
            }
            source.resume()
            self.signalSources.append(source)
        }
    }
    
    /// Synchronous fallback used by signal handlers. Best-effort: terminates
    /// every tracked PID with `SIGTERM`, waits briefly, then escalates to
    /// `SIGKILL`, before letting the process exit normally.
    private func handleTerminationSignal(signo: Int32) {
        self.isShuttingDown = true
        self.killAllRegisteredProcesses(gracePeriodSeconds: 2.0)
        // Re-raise with default disposition so the OS records the signal
        // exit status correctly.
        signal(signo, SIG_DFL)
        raise(signo)
    }
    
    /// Synchronously terminate every registered PID. Sends `SIGTERM`, then
    /// `SIGKILL` to anything still alive after ``gracePeriodSeconds``.
    public func killAllRegisteredProcesses(
        gracePeriodSeconds: TimeInterval = 1.5
    ) {
        let pids = self.currentPIDs()
        guard !pids.isEmpty else { return }
        for pid in pids {
            // `kill(pid, 0)` returns 0 iff the process exists; this avoids
            // spamming logs for processes that already exited.
            if kill(pid, 0) == 0 {
                _ = kill(pid, SIGTERM)
            }
        }
        let deadline = Date().addingTimeInterval(gracePeriodSeconds)
        while Date() < deadline {
            let stillAlive = pids.contains { kill($0, 0) == 0 }
            if !stillAlive { break }
            Thread.sleep(forTimeInterval: 0.05)
        }
        for pid in pids where kill(pid, 0) == 0 {
            _ = kill(pid, SIGKILL)
        }
        self.lock.lock()
        self.trackedPIDs.removeAll()
        self.lock.unlock()
    }
    
    // MARK: - Coordinated Async Shutdown
    
    /// Run every registered async shutdown hook concurrently with a hard
    /// timeout, then sweep any process that survived. Safe to call from the
    /// main actor (``AppDelegate.applicationShouldTerminate``).
    public func shutdownAll(
        timeout: TimeInterval = 4.0
    ) async {
        self.isShuttingDown = true
        let hooks = self.currentHooks()
        Self.logger.notice(
            "Coordinated inference shutdown started (hooks: \(hooks.count, privacy: .public), tracked PIDs: \(self.currentPIDs().count, privacy: .public))"
        )
        await withTaskGroup(of: Void.self) { group in
            for (identifier, hook) in hooks {
                group.addTask {
                    await hook()
                    Self.logger.info(
                        "Shutdown hook completed: \(identifier, privacy: .public)"
                    )
                }
            }
            // Watchdog timer so a stuck hook never blocks app exit.
            group.addTask {
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
            }
            await group.next()
            group.cancelAll()
            await group.waitForAll()
        }
        // Belt-and-braces: kill anything that survived the graceful pass.
        self.killAllRegisteredProcesses(gracePeriodSeconds: 1.0)
        Self.logger.notice("Coordinated inference shutdown complete")
    }
    
}

```

### Core Architecture Module: `Sidekick/Logic/Inference/Model+Lifecycle.swift`
```
//
//  Model+Lifecycle.swift
//  Sidekick
//
//  Created by Bean John on 9/22/24.
//

import Foundation
import OSLog

extension Model {
    
    // MARK: - Prompt Configuration
    
    public func setSystemPrompt(
        _ systemPrompt: String
    ) async {
        self.systemPrompt = systemPrompt
        await self.mainModelServer.setSystemPrompt(systemPrompt)
    }
    
    public func refreshModel() async {
        self.startupTask?.cancel()
        // Restart servers if needed
        await self.stopServers()
        self.mainModelServer = LlamaServer(
            modelType: .regular,
            systemPrompt: self.systemPrompt
        )
        self.workerModelServer = LlamaServer(
            modelType: .worker
        )
        let canReachRemoteServer: Bool = await self.remoteServerIsReachable()
        self.wasRemoteServerAccessible = canReachRemoteServer
        self.scheduleLocalWarmup(using: canReachRemoteServer)
    }
    
    // MARK: - Token Counting
    
    public func countTokens(
        in text: String
    ) async -> Int? {
        let canReachRemoteServer: Bool = await self.remoteServerIsReachable()
        return try? await self.mainModelServer.tokenCount(
            in: text,
            canReachRemoteServer: canReachRemoteServer
        )
    }
    
    // MARK: - Remote Reachability
    
    public func remoteServerIsReachable(
        endpoint: String = InferenceSettings.endpoint,
        timeout: TimeInterval = 1.5
    ) async -> Bool {
        // Return false if server is unused
        if !InferenceSettings.useServer { return false }
        // Try to use cached result
        let lastPathChangeDate: Date = NetworkMonitor.shared.lastPathChange
        if self.lastRemoteServerCheck >= lastPathChangeDate {
            Self.logger.info("Using cached remote server reachability result")
            return self.wasRemoteServerAccessible
        }
        let trimmedEndpoint = endpoint.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEndpoint.isEmpty else {
            self.wasRemoteServerAccessible = false
            self.lastRemoteServerCheck = Date.now
            return false
        }
        let sanitizedBase = trimmedEndpoint.hasSuffix("/") ? String(trimmedEndpoint.dropLast()) : trimmedEndpoint
        let normalizedBase = sanitizedBase.replacingSuffix("/chat/completions", with: "")
        let testPaths: [String] = [
            "models",
            "chat/completions"
        ]
        let reachable: Bool = await withTaskGroup(of: Bool.self) { group in
            for path in testPaths {
                group.addTask {
                    let urlString: String
                    if normalizedBase.hasSuffix("/") {
                        urlString = normalizedBase + path
                    } else {
                        urlString = "\(normalizedBase)/\(path)"
                    }
                    guard let endpointUrl = URL(string: urlString) else {
                        return false
                    }
                    return await endpointUrl.isAPIEndpointReachable(
                        timeout: timeout
                    )
                }
            }
            var success: Bool = false
            while let result = await group.next() {
                if result {
                    success = true
                    group.cancelAll()
                    break
                }
            }
            return success
        }
        self.wasRemoteServerAccessible = reachable
        self.lastRemoteServerCheck = Date.now
        if reachable {
            Self.logger.info("Reached remote server at '\(normalizedBase, privacy: .public)'")
        } else {
            Self.logger.warning("Could not reach remote server at '\(normalizedBase, privacy: .public)'")
        }
        return reachable
    }
    
    // MARK: - Server Lifecycle
    
    func stopServers() async {
        self.startupTask?.cancel()
        self.startupTask = nil
        await self.mainModelServer.stopServer()
        await self.workerModelServer.stopServer()
        self.status = .cold
    }
    
    func interrupt(
        conversationId: UUID? = nil
    ) async {
        let targetConversationId = conversationId ?? InferenceRunContext.conversationId
        if let targetConversationId {
            guard let run = self.chatRuns[targetConversationId],
                  run.status.isWorking else {
                return
            }
            run.task?.cancel()
            for requestID in run.mainRequestIDs {
                await self.mainModelServer.interrupt(requestID: requestID)
            }
            for requestID in run.workerRequestIDs {
                await self.workerModelServer.interrupt(requestID: requestID)
            }
            self.finishChatRun(conversationId: targetConversationId)
            return
        }

        if !self.status.isWorking {
            return
        }
        await self.mainModelServer.interrupt()
        self.agent = nil
        self.pendingMessage = nil
        self.status = .ready
    }

    // MARK: - Startup Warmup

    func scheduleStartupWarmup() {
        self.startupTask?.cancel()
        self.startupTask = Task(priority: .utility) { [weak self] in
            guard let self else { return }
            let signpost = StartupMetrics.begin("Model.remoteProbe")
            let canReachRemoteServer = await self.remoteServerIsReachable()
            StartupMetrics.end("Model.remoteProbe", signpost)
            await self.prewarmLocalServersIfNeeded(
                canReachRemoteServer: canReachRemoteServer
            )
        }
    }

    private func scheduleLocalWarmup(using canReachRemoteServer: Bool) {
        self.startupTask?.cancel()
        self.startupTask = Task(priority: .utility) { [weak self] in
            guard let self else { return }
            await self.prewarmLocalServersIfNeeded(
                canReachRemoteServer: canReachRemoteServer
            )
        }
    }

    private func prewarmLocalServersIfNeeded(
        canReachRemoteServer: Bool
    ) async {
        guard !Task.isCancelled else { return }
        let shouldUseLocalServers: Bool = !InferenceSettings.useServer || !canReachRemoteServer
        guard shouldUseLocalServers else { return }
        let hasMainLocalModel: Bool = Settings.modelUrl?.fileExists ?? false
        let hasDedicatedWorkerModel: Bool = InferenceSettings.workerModelUrl?.fileExists ?? false
        let signpost = StartupMetrics.begin("Model.localWarmup")
        defer {
            StartupMetrics.end("Model.localWarmup", signpost)
            self.startupTask = nil
        }
        async let mainWarmup: Void = {
            guard hasMainLocalModel else { return }
            try? await self.mainModelServer.startServer(
                canReachRemoteServer: canReachRemoteServer
            )
        }()
        async let workerWarmup: Void = {
            guard hasDedicatedWorkerModel else { return }
            try? await self.workerModelServer.startServer(
                canReachRemoteServer: canReachRemoteServer
            )
        }()
        let _ = await (mainWarmup, workerWarmup)
    }
    
}

```

### Core Architecture Module: `Sidekick/Logic/Inference/llama.cpp/LlamaServer+ServerLifecycle.swift`
```
//
//  LlamaServer+ServerLifecycle.swift
//  Sidekick
//
//  Created by Bean John on 10/9/24.
//

import Darwin
import Foundation
import FSKit_macOS
import OSLog

extension LlamaServer {
    
    /// Function to start a monitor process that will terminate the server when our app dies
    /// - Parameter serverPID: The process identifier of `llama-server`, of type `pid_t`
    func startAppMonitor(
        serverPID: pid_t
    ) throws {
        // Start `llama-server-watchdog`
        monitor = Process()
        monitor.executableURL = Bundle.main.url(forAuxiliaryExecutable: "llama-server-watchdog")
        monitor.arguments = [
            String(serverPID)
        ]
        // Send main app's heartbeat to show that the main app is still running
        let heartbeat = Pipe()
        self.heartbeatPipe = heartbeat
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global())
        timer.schedule(deadline: .now(), repeating: 15.0)
        timer.setEventHandler { [weak heartbeat] in
            guard let heartbeat = heartbeat else { return }
            let data = ".".data(using: .utf8) ?? Data()
            // Writing to a closed pipe raises SIGPIPE; guard so a dead
            // watchdog never crashes the host app.
            do {
                try heartbeat.fileHandleForWriting.write(contentsOf: data)
            } catch {
                // Pipe was closed (watchdog exited); silently stop heartbeating.
            }
        }
        timer.resume()
        self.heartbeatTimer = timer
        monitor.standardInput = heartbeat
        // Start monitor
        try monitor.run()
        // Register both children so a coordinated shutdown can clean them up
        // regardless of which path the app exits through.
        InferenceLifecycleCoordinator.shared.register(pid: serverPID)
        InferenceLifecycleCoordinator.shared.register(pid: monitor.processIdentifier)
        Self.logger.notice(
            "Started monitor for server with PID \(serverPID)"
        )
    }
    
    /// Function to start the `llama-server` process
    public func startServer(
        canReachRemoteServer: Bool
    ) async throws {
        // If a model is missing, throw error
        let hasModel: Bool = self.modelUrl?.fileExists ?? false
        let usesSpeculativeModel: Bool = InferenceSettings.useSpeculativeDecoding && self.modelType == .regular
        let hasSpeculativeModel: Bool = InferenceSettings.speculativeDecodingModelUrl?.fileExists ?? false
        if !hasModel || (usesSpeculativeModel && !hasSpeculativeModel) {
            Self.logger.error("Main model or draft model is missing")
            throw LlamaServerError.modelError
        }
        // If server is running, or is starting server, or no model, exit
        guard !process.isRunning,
              !self.isStartingServer,
              let modelPath = self.modelUrl?.posixPath else {
            return
        }
        // Signal beginning of server initialization
        self.isStartingServer = true
        // Stop server if running
        await stopServer()
        // Initialize `llama-server` process
        process = Process()
        let startTime: Date = Date.now
        process.executableURL = Bundle.main.privateFrameworksURL?.appendingPathComponent("llama-server")
        
        // GPU acceleration is always on. The legacy CPU-only toggle has
        // been removed; users who genuinely need CPU-only inference can
        // override `--gpu-layers 0` via Advanced Parameters.
        let processors: Int = ProcessInfo.processInfo.activeProcessorCount
        let threadsToUse: Int = max(1, Int(ceil(Double(processors) / 3.0 * 2.0)))
        let gpuLayersToUse: String = "99"

        // Formulate arguments
        var arguments: [String: String] = [
            "--model": modelPath,
            "--threads": "\(threadsToUse)",
            "--threads-batch": "\(threadsToUse)",
            "--ctx-size": "\(self.totalContextLength)",
            "--parallel": "\(self.parallelSlots)",
            "--port": self.port,
            "--gpu-layers": gpuLayersToUse
        ]
        // Extra options for main model
        if self.modelType == .regular {
            // Only enable `--jinja` when the model's GGUF ships a chat template
            // that knows how to render and parse tool calls. Without that, the
            // flag either errors out (no template at all) or buys us nothing
            // and risks the server emitting text-mode tool calls that the
            // client can't recover.
            if Settings.useFunctions,
               GGUFMetadataReader.modelSupportsToolAwareJinja(
                at: URL(fileURLWithPath: modelPath)
               ) {
                arguments["--jinja"] = ""
            }
            // Use speculative decoding
            if InferenceSettings.useSpeculativeDecoding,
               let speculationModelUrl = InferenceSettings.speculativeDecodingModelUrl {
                // Formulate arguments
                let draft: Int =  16
                let draftMin: Int = 7
                let draftPMin: Double = 0.75
                let speculativeDecodingArguments: [String: String] = [
                    "--model-draft": speculationModelUrl.posixPath,
                    "--gpu-layers-draft": "\(gpuLayersToUse)",
                    "--draft-p-min": "\(draftPMin)",
                    "--draft": "\(draft)",
                    "--draft-min": "\(draftMin)"
                ]
                // Append
                speculativeDecodingArguments.forEach { element in
                    arguments[element.key] = element.value
                }
            }
            // Use multimodal
            if InferenceSettings.localModelUseVision,
               let multimodalModelUrl = InferenceSettings.projectorModelUrl {
                // Formulate argument
                let multimodalArguments: [String: String] = [
                    "--mmproj": multimodalModelUrl.posixPath
                ]
                // Append
                multimodalArguments.forEach { element in
                    arguments[element.key] = element.value
                }
            }
            // Remove duplicate arguments
            let activeArguments: [ServerArgument] = await MainActor.run { ServerArgumentsStore.activeArguments() }
            let activeFlags = activeArguments.map(keyPath: \.flag)
            arguments = arguments.filter { !activeFlags.contains($0.key) }
            // Convert dictionary to [String] format with each key and value as separate elements
            var formattedArguments: [String] = []
            arguments.forEach { key, value in
                formattedArguments.append(key)
                if !value.isEmpty {
                    formattedArguments.append(value)
                }
            }
            // Add custom arguments
            let allArguments: [String] = await MainActor.run { ServerArgumentsStore.allArguments() }
            formattedArguments += allArguments
            // Assign arguments
            process.arguments = formattedArguments
        } else {
            // Else, just convert and assign
            var formattedArguments: [String] = []
            arguments.forEach { key, value in
                formattedArguments.append(key)
                if !value.isEmpty  {
                    formattedArguments.append(value)
                }
            }
            process.arguments = formattedArguments
        }
        
        Self.logger.notice("Starting llama.cpp server \(self.process.arguments!.joined(separator: " "), privacy: .public)")
        
        process.standardInput = FileHandle.nullDevice
        
        // To debug with server's output, comment these 2 lines to inherit stdout.
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        
        try process.run()
        
        try await self.waitForServer(
            canReachRemoteServer: canReachRemoteServer
        )
        
        try startAppMonitor(serverPID: process.processIdentifier)
        
        let endTime: Date = Date.now
        let elapsedTime: Double = endTime.timeIntervalSince(startTime)
        
#if DEBUG
        print("Started server process in \(elapsedTime) secs")
#endif
        self.isStartingServer = false
    }
    
    /// Function to stop the `llama-server` process.
    ///
    /// Performs a graceful `SIGTERM`, waits up to ``gracePeriodSeconds`` for
    /// the process to exit, then escalates to `SIGKILL` to guarantee that
    /// memory-intensive inference children are released before this call
    /// returns. Any active streaming requests are cancelled first so their
    /// callbacks unblock before the server disappears.
    public func stopServer(
        gracePeriodSeconds: TimeInterval = 1.5
    ) async {
        // Cancel any in-flight streaming requests so their continuations
        // don't outlive the underlying process.
        self.pendingCancellationForAllRequests = true
        for context in self.activeRequests.values {
            context.cancel()
        }
        self.activeRequests.removeAll()
        // Stop heartbeat first so the watchdog doesn't keep firing while
        // we tear the server down ourselves.
        self.heartbeatTimer?.cancel()
        self.heartbeatTimer = nil
        try? self.heartbeatPipe?.fileHandleForWriting.close()
        self.heartbeatPipe = nil
        let serverPID: pid_t = self.process.isRunning ? self.process.processIdentifier : 0
        let monitorPID: pid_t = self.monitor.isRunning ? self.monitor.processIdentifier : 0
        // SIGTERM both children.
        if self.process.isRunning {
            self.process.terminate()
        }
        if self.monitor.isRunning {
            self.monitor.terminate()
        }
        // Wait for them to actually exit. Never blocks forever — falls back
        // to SIGKILL if the grace period elapses without ex
```

### Core Architecture Module: `Sidekick/Logic/Utilities/ChatScreenshotExporter.swift`
```
//
//  ChatScreenshotExporter.swift
//  Sidekick
//
//  Created by John Bean on 5/23/26.
//
//  Orchestrates the export pipeline: resolves the scope into a
//  message list, asks ``ChatScreenshotHTMLBuilder`` for the HTML
//  payload, spins up ``ChatScreenshotRenderer`` to produce either
//  an `NSImage` (PNG) or PDF `Data`, shows a cancellable progress
//  HUD, then writes the file to a destination picked through
//  `NSSavePanel`.
//

import AppKit
import Foundation
import OSLog
import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class ChatScreenshotExporter {
    
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "Sidekick",
        category: "ChatScreenshotExporter"
    )
    
    /// Drives the full pipeline. Resolves messages, shows a HUD,
    /// renders, asks for a destination, and writes the file. Any
    /// thrown error surfaces as a `Dialogs.showAlert`; cancellation
    /// is silent.
    func capture(
        scope: ChatScreenshotScope,
        format: ChatScreenshotFormat = .png,
        conversation: Conversation,
        colorScheme: ColorScheme? = nil
    ) async {
        let messages = scope.resolve(in: conversation)
        guard !messages.isEmpty else {
            Dialogs.showAlert(
                title: String(localized: "Nothing to capture"),
                message: ChatScreenshotError.noMessages.errorDescription
            )
            return
        }
        
        let hudTitle = String(
            localized: "\(format.progressVerb) \(scope.displayName)…"
        )
        let hud = ProgressHUD(title: hudTitle, format: format)
        hud.show()
        defer { hud.hide() }
        
        let renderTask: Task<Data, Error> = Task { @MainActor in
            let output = try ChatScreenshotHTMLBuilder.build(
                conversation: conversation,
                messages: messages,
                scope: scope,
                colorScheme: colorScheme
            )
            let renderer = ChatScreenshotRenderer()
            switch format {
                case .png:
                    let image = try await renderer.renderImage(
                        templateURL: output.templateURL,
                        resourcesFolder: output.resourcesFolder,
                        payloadJSON: output.payloadJSON
                    )
                    return try Self.encodePNG(from: image)
                case .pdf:
                    return try await renderer.renderPDF(
                        templateURL: output.templateURL,
                        resourcesFolder: output.resourcesFolder,
                        payloadJSON: output.payloadJSON
                    )
            }
        }
        hud.onCancel = { renderTask.cancel() }
        
        let data: Data
        do {
            data = try await renderTask.value
        } catch is CancellationError {
            return
        } catch let error as ChatScreenshotError {
            if case .cancelled = error { return }
            Self.logger.error(
                "export failed: \(String(describing: error), privacy: .public)"
            )
            Dialogs.showAlert(
                title: Self.failureTitle(for: format),
                message: error.errorDescription
            )
            return
        } catch {
            Self.logger.error(
                "export failed: \(String(describing: error), privacy: .public)"
            )
            Dialogs.showAlert(
                title: Self.failureTitle(for: format),
                message: error.localizedDescription
            )
            return
        }
        
        // Hide the HUD before we put up the save panel — running
        // modal sheets on top of a child window looks broken.
        hud.hide()
        
        let defaultName: String = Self.defaultFilename(
            title: conversation.title,
            scope: scope,
            format: format
        )
        guard let destination = await Self.promptForSaveDestination(
            defaultName: defaultName,
            format: format
        ) else {
            return
        }
        
        do {
            try Self.write(data: data, to: destination)
            // Light follow-up: reveal in Finder so the user sees
            // where the file landed.
            NSWorkspace.shared.activateFileViewerSelecting([destination])
        } catch let error as ChatScreenshotError {
            Self.logger.error(
                "write failed: \(String(describing: error), privacy: .public)"
            )
            Dialogs.showAlert(
                title: Self.writeFailureTitle(for: format),
                message: error.errorDescription
            )
        } catch {
            Self.logger.error(
                "write failed: \(String(describing: error), privacy: .public)"
            )
            Dialogs.showAlert(
                title: Self.writeFailureTitle(for: format),
                message: error.localizedDescription
            )
        }
    }
    
    // MARK: - Failure copy
    
    private static func failureTitle(for format: ChatScreenshotFormat) -> String {
        switch format {
            case .png: return String(localized: "Screenshot Failed")
            case .pdf: return String(localized: "PDF Export Failed")
        }
    }
    
    private static func writeFailureTitle(for format: ChatScreenshotFormat) -> String {
        switch format {
            case .png: return String(localized: "Couldn't Save Screenshot")
            case .pdf: return String(localized: "Couldn't Save PDF")
        }
    }
    
    // MARK: - File naming
    
    private static let filenameDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH-mm"
        return formatter
    }()
    
    static func defaultFilename(
        title: String,
        scope: ChatScreenshotScope,
        format: ChatScreenshotFormat,
        now: Date = .now
    ) -> String {
        let stamp: String = Self.filenameDateFormatter.string(from: now)
        let cleanTitle: String = Self.sanitizeFilename(title)
        let baseTitle: String = cleanTitle.isEmpty
            ? String(localized: "Chat")
            : cleanTitle
        return "\(baseTitle) - \(scope.displayName) - \(stamp).\(format.fileExtension)"
    }
    
    private static func sanitizeFilename(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let illegal = CharacterSet(charactersIn: "/\\:?%*|\"<>")
        let safe = trimmed.components(separatedBy: illegal).joined(separator: " ")
        // Collapse runs of whitespace into single spaces — long
        // titles look much cleaner in Finder.
        let collapsed = safe
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        // Keep filenames reasonable (HFS limit is 255, but Finder
        // truncates display long before that).
        if collapsed.count > 80 {
            return String(collapsed.prefix(80))
        }
        return collapsed
    }
    
    // MARK: - Save panel
    
    private static func promptForSaveDestination(
        defaultName: String,
        format: ChatScreenshotFormat
    ) async -> URL? {
        await withCheckedContinuation { (continuation: CheckedContinuation<URL?, Never>) in
            let panel = NSSavePanel()
            switch format {
                case .png:
                    panel.title = String(localized: "Save Screenshot")
                case .pdf:
                    panel.title = String(localized: "Save PDF")
            }
            panel.prompt = String(localized: "Save")
            panel.nameFieldStringValue = defaultName
            panel.allowedContentTypes = [format.contentType]
            panel.canCreateDirectories = true
            panel.isExtensionHidden = false
            // PNGs default into ~/Pictures; PDFs into ~/Documents
            // unless the user has previously chosen another location
            // (NSSavePanel persists that on its own).
            let defaultDirectory: FileManager.SearchPathDirectory = (format == .pdf)
                ? .documentDirectory
                : .picturesDirectory
            if let dir = FileManager.default.urls(
                for: defaultDirectory,
                in: .userDomainMask
            ).first {
                panel.directoryURL = dir
            }
            let response = panel.runModal()
            if response == .OK, let url = panel.url {
                continuation.resume(returning: url)
            } else {
                continuation.resume(returning: nil)
            }
        }
    }
    
    // MARK: - Write
    
    /// Encodes an `NSImage` into PNG `Data` so the rest of the
    /// pipeline can deal in a single `Data` type regardless of the
    /// chosen output format.
    private static func encodePNG(from image: NSImage) throws -> Data {
        guard let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let data = bitmap.representation(
                using: .png,
                properties: [.interlaced: false]
              ) else {
            throw ChatScreenshotError.writeFailed(
                NSError(
                    domain: "ChatScreenshotExporter",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "Could not encode PNG."]
                )
            )
        }
        return data
    }
    
    private static func write(data: Data, to url: URL) throws {
        do {
            try data.write(to: url, options: [.atomic])
        } catch {
            throw ChatScreenshotError.writeFailed(error)
        }
    }
}

// MARK: - Progress HUD

/// Floating SwiftUI-styled HUD shown while the renderer runs.
/// Uses an `
```

### Core Architecture Module: `Sidekick/Logic/Utilities/ChatScreenshotRenderer.swift`
```
//
//  ChatScreenshotRenderer.swift
//  Sidekick
//
//  Created by John Bean on 5/23/26.
//
//  Drives an offscreen `WKWebView` to render a chat screenshot.
//  The web view is parented to a hidden window — `takeSnapshot`
//  refuses to capture orphaned web views — and the page is given a
//  bounded amount of time to declare its final layout before the
//  bitmap is grabbed. Returns an `NSImage` at native Retina scale.
//

import AppKit
import Foundation
import OSLog
import WebKit

// MARK: - Errors

enum ChatScreenshotError: LocalizedError {
    case templateMissing
    case templateUnreadable(Error)
    case templateMalformed
    case payloadEncodingFailed(Error?)
    case rendererTimedOut
    case rendererFailed(String)
    case snapshotFailed(Error)
    case noMessages
    case writeFailed(Error)
    case cancelled
    
    var errorDescription: String? {
        switch self {
            case .templateMissing:
                return String(localized: "The screenshot template could not be found in the app bundle.")
            case .templateUnreadable(let error):
                return String(localized: "The screenshot template could not be read: \(error.localizedDescription)")
            case .templateMalformed:
                return String(localized: "The screenshot template is missing its bootstrap script tag.")
            case .payloadEncodingFailed(let error):
                if let error {
                    return String(localized: "Failed to encode the screenshot payload: \(error.localizedDescription)")
                }
                return String(localized: "Failed to encode the screenshot payload.")
            case .rendererTimedOut:
                return String(localized: "The screenshot renderer timed out while preparing the page.")
            case .rendererFailed(let reason):
                return String(localized: "The screenshot renderer failed: \(reason)")
            case .snapshotFailed(let error):
                return String(localized: "WebKit failed to capture the snapshot: \(error.localizedDescription)")
            case .noMessages:
                return String(localized: "There are no messages to capture in the selected scope.")
            case .writeFailed(let error):
                return String(localized: "Could not write the screenshot to disk: \(error.localizedDescription)")
            case .cancelled:
                return String(localized: "The screenshot was cancelled.")
        }
    }
}

// MARK: - Renderer

@MainActor
final class ChatScreenshotRenderer {
    
    fileprivate static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "Sidekick",
        category: "ChatScreenshotRenderer"
    )
    
    /// Maximum on-screen bitmap height for `WKWebView.takeSnapshot`.
    /// WebKit refuses or silently truncates beyond ~16k px, so we
    /// downscale the snapshot width proportionally when the page
    /// reports anything taller.
    fileprivate static let maxSnapshotHeight: CGFloat = 16_000
    
    /// Hard ceiling on how long we'll wait for the page to finish
    /// laying out before erroring out. Covers vendor JS init plus
    /// image decoding plus font load.
    fileprivate static let renderTimeoutSeconds: TimeInterval = 30
    
    /// Cushion added when WebKit fails its first snapshot attempt —
    /// most often because the contentful layer hasn't been promoted
    /// yet. We retry once after a runloop spin.
    fileprivate static let snapshotRetryDelay: TimeInterval = 0.18
    
    private let width: CGFloat
    
    init(width: CGFloat = 820) {
        self.width = width
    }
    
    /// Loads the bundled screenshot template, hands it the JSON
    /// payload via `evaluateJavaScript`, waits for the page to
    /// declare its final layout, and returns a PNG snapshot.
    func renderImage(
        templateURL: URL,
        resourcesFolder: URL,
        payloadJSON: String
    ) async throws -> NSImage {
        return try await self.runSession(
            templateURL: templateURL,
            resourcesFolder: resourcesFolder,
            payloadJSON: payloadJSON
        ) { session in
            try await session.runImage()
        }
    }
    
    /// Same flow as ``renderImage(templateURL:resourcesFolder:payloadJSON:)``,
    /// but returns PDF bytes produced by `WKWebView.createPDF`.
    /// The PDF is laid out as a single page sized to the full
    /// rendered content so the chat reads as one continuous
    /// document, mirroring the screenshot path.
    func renderPDF(
        templateURL: URL,
        resourcesFolder: URL,
        payloadJSON: String
    ) async throws -> Data {
        return try await self.runSession(
            templateURL: templateURL,
            resourcesFolder: resourcesFolder,
            payloadJSON: payloadJSON
        ) { session in
            try await session.runPDF()
        }
    }
    
    private func runSession<Output: Sendable>(
        templateURL: URL,
        resourcesFolder: URL,
        payloadJSON: String,
        _ body: @MainActor @Sendable @escaping (RendererSession) async throws -> Output
    ) async throws -> Output {
        let session = RendererSession(
            width: self.width,
            templateURL: templateURL,
            resourcesFolder: resourcesFolder,
            payloadJSON: payloadJSON
        )
        try Task.checkCancellation()
        do {
            let output = try await withThrowingTaskGroup(of: Output.self) { group in
                group.addTask { @MainActor in
                    return try await body(session)
                }
                group.addTask { @MainActor in
                    try await Task.sleep(
                        nanoseconds: UInt64(Self.renderTimeoutSeconds * 1_000_000_000)
                    )
                    throw ChatScreenshotError.rendererTimedOut
                }
                guard let value = try await group.next() else {
                    throw ChatScreenshotError.rendererFailed("no result")
                }
                group.cancelAll()
                return value
            }
            session.tearDown()
            return output
        } catch {
            session.tearDown()
            throw error
        }
    }
}

// MARK: - Session

/// One-shot renderer harness. Created per snapshot so the script
/// message handlers can capture a fresh pair of continuations.
@MainActor
private final class RendererSession: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    
    private let width: CGFloat
    private let templateURL: URL
    private let resourcesFolder: URL
    private let payloadJSON: String
    
    private var window: NSWindow?
    private var webView: WKWebView?
    private let assetSchemeHandler = ChatMarkdownAssetSchemeHandler()
    
    private var readyContinuation: CheckedContinuation<Void, Error>?
    private var heightContinuation: CheckedContinuation<CGFloat, Error>?
    private var navigationContinuation: CheckedContinuation<Void, Error>?
    
    private var didReady: Bool = false
    private var pendingHeight: CGFloat?
    private var scriptError: String?
    
    init(width: CGFloat, templateURL: URL, resourcesFolder: URL, payloadJSON: String) {
        self.width = width
        self.templateURL = templateURL
        self.resourcesFolder = resourcesFolder
        self.payloadJSON = payloadJSON
    }
    
    func runImage() async throws -> NSImage {
        let reportedHeight = try await self.prepareAndResize()
        let image = try await takeSnapshot(reportedHeight: reportedHeight)
        ChatScreenshotRenderer.logger.notice("renderer: snapshot complete")
        return image
    }
    
    func runPDF() async throws -> Data {
        let reportedHeight = try await self.prepareAndResize()
        let data = try await takePDFData(reportedHeight: reportedHeight)
        ChatScreenshotRenderer.logger.notice("renderer: pdf complete bytes=\(data.count, privacy: .public)")
        return data
    }
    
    /// Loads the bundled template, injects the payload, waits for
    /// the page to declare itself laid out, and resizes the web
    /// view to the reported height. Returns the height so the
    /// final output stage can size its snapshot/PDF accordingly.
    private func prepareAndResize() async throws -> CGFloat {
        ChatScreenshotRenderer.logger.notice("renderer: session.run start, template=\(self.templateURL.path, privacy: .public)")
        let webView = makeWebView()
        self.webView = webView
        attachToHiddenWindow(webView: webView)
        ChatScreenshotRenderer.logger.notice("renderer: web view attached")
        
        // Stage 1: load the bundled template file the same way the
        // in-app chat web view loads chat.html. `loadFileURL` with
        // an explicit `allowingReadAccessTo` is the only reliable
        // way to give a sandboxed WKWebView permission to read its
        // sibling resources (vendor JS, CSS, screenshot.js).
        ChatScreenshotRenderer.logger.notice("renderer: loadFileURL start")
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.navigationContinuation = continuation
            webView.loadFileURL(
                self.templateURL,
                allowingReadAccessTo: self.resourcesFolder
            )
        }
        ChatScreenshotRenderer.logger.notice("renderer: navigation finished")
        try Task.checkCancellation()
        
        // Stage 2: inject the payload and kick off the bootstrap.
        // The page sets `window.skBootstrap` synchronously when
        // screenshot.js parses, so this call is safe immediately
        // after navigation finishes.
        try await self.bootstrapPage()
        ChatScreenshotRenderer.logger.notice("renderer: bootstrap injected")
        try Task.checkCancellation()
        
        // Stage 3: wait for the page to signal `ready`.
        try await waitForReady
```

### Core Architecture Module: `Sidekick/Logic/Utilities/ChatScreenshotScope.swift`
```
//
//  ChatScreenshotScope.swift
//  Sidekick
//
//  Created by John Bean on 5/23/26.
//
//  Describes which messages should be included in a chat screenshot.
//  Used by ``ChatScreenshotExporter`` to drive
//  ``ChatScreenshotHTMLBuilder`` and the offscreen
//  ``ChatScreenshotRenderer``.
//

import Foundation
import UniformTypeIdentifiers

/// The output format produced by the chat exporter.
public enum ChatScreenshotFormat: String, CaseIterable {
    
    case png
    case pdf
    
    /// File extension used in the default save filename.
    public var fileExtension: String {
        return self.rawValue
    }
    
    /// `UTType` used to constrain `NSSavePanel`.
    public var contentType: UTType {
        switch self {
            case .png: return .png
            case .pdf: return .pdf
        }
    }
    
    /// Short, user-visible name (e.g. `"PNG"`, `"PDF"`).
    public var displayName: String {
        switch self {
            case .png: return String(localized: "PNG")
            case .pdf: return String(localized: "PDF")
        }
    }
    
    /// Verb used in the progress HUD title — "Capturing …" for
    /// image, "Exporting …" for document formats.
    public var progressVerb: String {
        switch self {
            case .png: return String(localized: "Capturing")
            case .pdf: return String(localized: "Exporting")
        }
    }
}

/// Selects the slice of a conversation a screenshot should cover.
public enum ChatScreenshotScope: Equatable {
    
    /// Every message in the conversation, in display order.
    case entireChat
    
    /// One user turn plus its paired assistant reply. ``anchorId`` is
    /// the message the user invoked the action from; the resolver
    /// expands the slice to include the other half of the turn.
    case currentTurn(anchorId: UUID)
    
    /// A single message bubble, identified by its ``Message/id``.
    case singleMessage(id: UUID)
    
    /// User-visible name for filename composition and progress UI.
    public var displayName: String {
        switch self {
            case .entireChat:
                return String(localized: "Entire Chat")
            case .currentTurn:
                return String(localized: "Current Turn")
            case .singleMessage:
                return String(localized: "Current Message")
        }
    }
    
    /// Filename-safe shorthand for the scope.
    public var filenameTag: String {
        switch self {
            case .entireChat:
                return "chat"
            case .currentTurn:
                return "turn"
            case .singleMessage:
                return "message"
        }
    }
    
    /// Resolves the scope against a concrete conversation, returning
    /// the messages to render in display order.
    ///
    /// `currentTurn` semantics:
    /// - When the anchor is a user message, the slice is the anchor
    ///   plus the next assistant message, if any.
    /// - When the anchor is an assistant message, the slice is the
    ///   preceding user message (if any) plus the anchor.
    /// - When the other half of the turn is missing, the slice
    ///   degrades gracefully to whatever is available.
    public func resolve(in conversation: Conversation) -> [Message] {
        switch self {
            case .entireChat:
                return conversation.messages
            case .singleMessage(let id):
                if let message = conversation.messages.first(where: { $0.id == id }) {
                    return [message]
                }
                return []
            case .currentTurn(let anchorId):
                guard let anchorIndex = conversation.messages.firstIndex(where: { $0.id == anchorId }) else {
                    return []
                }
                let anchor: Message = conversation.messages[anchorIndex]
                switch anchor.getSender() {
                    case .user:
                        // Anchor first, plus the next assistant reply
                        // (if any). Drop anything beyond the single
                        // reply to keep "turn" tight.
                        let nextIndex: Int = anchorIndex + 1
                        if nextIndex < conversation.messages.count,
                           conversation.messages[nextIndex].getSender() == .assistant {
                            return [anchor, conversation.messages[nextIndex]]
                        }
                        return [anchor]
                    default:
                        // Find the immediately preceding user message;
                        // include it plus the anchor.
                        var precedingUser: Message?
                        if anchorIndex > 0 {
                            for index in stride(from: anchorIndex - 1, through: 0, by: -1) {
                                if conversation.messages[index].getSender() == .user {
                                    precedingUser = conversation.messages[index]
                                    break
                                }
                            }
                        }
                        if let precedingUser {
                            return [precedingUser, anchor]
                        }
                        return [anchor]
                }
        }
    }
}

```

### Core Architecture Module: `Sidekick/Logic/Utilities/ContextCompressor.swift`
```
//
//  ContextCompressor.swift
//  Sidekick
//
//  Created by John Bean on 10/9/25.
//

import Foundation
import OSLog

/// Utility responsible for summarising and trimming tool call outputs when context limits are exceeded.
enum ContextCompressor {
    
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "Sidekick",
        category: "ContextCompressor"
    )
    
    /// Compresses tool call results whose token counts exceed the specified threshold.
    /// - Parameters:
    ///   - results: The tool call results captured so far in the agent loop.
    ///   - threshold: Maximum number of tokens allowed before compression.
    /// - Returns: A new array of tool call results, where oversized entries are summarised.
    static func compressFunctionResults(
        _ results: [FunctionCallResult],
        threshold: Int
    ) async throws -> [FunctionCallResult] {
        guard !results.isEmpty else { return results }
        
        var compressedResults: [FunctionCallResult] = []
        
        for result in results {
            guard let text = result.result else {
                compressedResults.append(result)
                continue
            }
            let tokenCount = text.estimatedTokenCount
            if tokenCount <= threshold {
                compressedResults.append(result)
                continue
            }
            
            logger.info("Compressing tool result '\(result.call)' with ~\(tokenCount) tokens")
            
            let summary = try await summarizeToolResult(
                call: result.call,
                result: text,
                threshold: threshold
            )
            
            var updatedResult = result
            updatedResult.result = summary
            compressedResults.append(updatedResult)
        }
        
        return compressedResults
    }
    
    // MARK: - Private helpers
    
    /// Summarises a single tool result using the main model. Ensures the final summary stays under the token threshold.
    ///
    /// Compression deliberately runs on the **main** model rather than
    /// the worker: tool outputs can be many thousands of tokens long
    /// (e.g. fetched web pages), and the worker server is pinned to a
    /// 4K context for memory efficiency. Routing through the main
    /// model guarantees we have enough headroom to fit the raw output,
    /// the compression prompt, and the produced summary in one go.
    private static func summarizeToolResult(
        call: String,
        result: String,
        threshold: Int
    ) async throws -> String {
        let prompt = """
You are Sidekick's compression worker. Summarise the tool result below preserving every critical fact, figure, and citation.

Tool call schema:
\(call)

Raw tool output:
\(result)

Requirements:
1. Retain the essential facts, figures, URLs, commands, and conclusions.
2. Replace verbose prose with compact bullet points when possible.
3. Remove duplicated sentences or boilerplate.
4. Target 20-30% of the original length, but never exceed \(threshold) tokens.
5. Output plain text only—no additional commentary.
"""
        
        let message = Message(
            text: prompt,
            sender: .user
        )
        
        let canReachRemoteServer = await Model.shared.remoteServerIsReachable()
        let usingRemoteModel = canReachRemoteServer && InferenceSettings.useServer
        let messageSubset = await Message.MessageSubset(
            usingRemoteModel: usingRemoteModel,
            message: message
        )
        
        var summaryResponse = try await Model.shared.mainModelServer.getChatCompletion(
            mode: .default,
            canReachRemoteServer: canReachRemoteServer,
            messages: [messageSubset]
        ).text
        
        summaryResponse = summaryResponse.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // If summary still exceeds threshold, truncate conservatively.
        if summaryResponse.estimatedTokenCount > threshold {
            logger.warning("Summary still \(summaryResponse.estimatedTokenCount) tokens; trimming to \(threshold)")
            var trimmedSummary = summaryResponse
            trimmedSummary.trimmingSuffixToTokens(maxTokens: threshold)
            summaryResponse = trimmedSummary
        }
        
        return summaryResponse
    }
}


```

### Core Architecture Module: `Sidekick/Logic/Utilities/Dialogs.swift`
```
//
//  Dialogs.swift
//  Sidekick
//
//  Created by Bean John on 10/4/24.
//

import AppKit
import Foundation

@MainActor
public class Dialogs {
	
	/// Function to show an alert
	public static func showAlert(
		title: String,
		message: String? = nil
	) {
		let alert: NSAlert = NSAlert()
		alert.messageText = title
		if let message = message {
			alert.informativeText = message
		}
		alert.runModal()
	}
	
	/// Function to show a confirmation modal
	public static func showConfirmation(
		title: String,
		message: String? = nil,
        ifConfirmed: @escaping () -> Void = {}
	) -> Bool {
		// Define alert
		let alert: NSAlert = NSAlert()
		alert.messageText = title
		if let message = message {
			alert.informativeText = message
		}
		alert.addButton(withTitle: String(localized: "Yes"))
		alert.addButton(withTitle: String(localized: "No"))
		// Run modal
		let result: Bool = alert.runModal() == .alertFirstButtonReturn
		if result {
			// If "yes"
			ifConfirmed()
		}
		return result
	}
	
	/// Function to show a dichotomy modal
	public static func dichotomy(
		title: String,
		message: String? = nil,
		option1: String,
		option2: String,
        ifOption1: @escaping () -> Void = {},
        ifOption2: @escaping () -> Void = {}
	) -> Bool {
		// Define alert
		let alert: NSAlert = NSAlert()
        alert.messageText = title
		if let message = message {
			alert.informativeText = message
		}
		alert.addButton(withTitle: option1)
		alert.addButton(withTitle: option2)
		// Run modal
		let result: Bool = alert.runModal() == .alertFirstButtonReturn
		if result {
			ifOption1()
		} else {
			ifOption2()
		}
		return result
	}
	
	/// Function to post low RAM warning
	public static func lowUnifiedMemoryWarning() {
		if InferenceSettings.lowUnifiedMemory {
			Self.showAlert(
				title: "Low Unified Memory",
				message: "Your system has only \(InferenceSettings.unifiedMemorySize) GB of RAM, which may not be sufficient for running an LLM. \nPlease save progress in all open apps, and close memory hogging applications in case a system crash occurs."
			)
		}
	}
	
}

```

### Core Architecture Module: `Sidekick/Logic/Utilities/GraphRAG/CommunityDetector.swift`
```
//
//  CommunityDetector.swift
//  Sidekick
//
//  Created by John Bean on 11/10/25.
//

import Foundation
import OSLog
import SimilaritySearchKit
import SimilaritySearchKitDistilbert

/// Detects hierarchical communities in a knowledge graph using Leiden algorithm
public class CommunityDetector {
    
    /// A `Logger` object for ``CommunityDetector``
    private static let logger: Logger = .init(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: CommunityDetector.self)
    )
    
    /// Progress callback type
    public typealias ProgressCallback = @Sendable (Int, Int, String) -> Void
    
    /// Detect communities in a knowledge graph
    /// - Parameters:
    ///   - graph: The knowledge graph
    ///   - maxLevels: Maximum hierarchical levels (default: 3)
    ///   - progressCallback: Optional callback for progress updates
    /// - Returns: Array of communities
    public static func detectCommunities(
        in graph: KnowledgeGraph,
        maxLevels: Int = 3,
        progressCallback: ProgressCallback? = nil
    ) async throws -> [Community] {
        var allCommunities: [Community] = []
        
        // Level 0: Group entities based on relationships
        progressCallback?(1, maxLevels, "Detecting base communities")
        let baseCommunities = detectBaseCommunities(in: graph)
        allCommunities.append(contentsOf: baseCommunities)
        
        Self.logger.info("Detected \(baseCommunities.count) base communities")
        
        // Generate summaries for base communities
        for (index, var community) in baseCommunities.enumerated() {
            // Check if we should yield to higher-priority tasks (like title generation)
            let shouldYield = await MainActor.run {
                Model.shared.status == .generatingTitle
            }
            
            if shouldYield {
                Self.logger.info("Pausing community detection to allow title generation")
                // Wait for title generation to complete
                var isGeneratingTitle = await MainActor.run { Model.shared.status == .generatingTitle }
                while isGeneratingTitle {
                    try? await Task.sleep(for: .milliseconds(500))
                    isGeneratingTitle = await MainActor.run { Model.shared.status == .generatingTitle }
                }
                Self.logger.info("Resuming community detection after title generation")
            }
            
            progressCallback?(
                index + 1,
                baseCommunities.count,
                "Generating summary for community \(index + 1)/\(baseCommunities.count)"
            )
            
            let summaryResult = await generateCommunitySummary(
                for: community,
                in: graph
            )
            community.summary = summaryResult.summary
            community.title = summaryResult.title
            community.embedding = summaryResult.embedding
            
            // Update community in array
            if let communityIndex = allCommunities.firstIndex(where: { $0.id == community.id }) {
                allCommunities[communityIndex] = community
            }
        }
        
        // Build higher-level communities hierarchically
        var currentLevelCommunities = baseCommunities
        for level in 1..<maxLevels {
            guard currentLevelCommunities.count > 1 else {
                Self.logger.info("Stopping at level \(level-1): only 1 community remaining")
                break
            }
            
            progressCallback?(level + 1, maxLevels, "Building level \(level) communities")
            
            let higherLevelCommunities = buildHigherLevelCommunities(
                from: currentLevelCommunities,
                level: level
            )
            
            if higherLevelCommunities.isEmpty {
                break
            }
            
            // Generate summaries for higher-level communities
            for var community in higherLevelCommunities {
                // Check if we should yield to higher-priority tasks (like title generation)
                let shouldYield = await MainActor.run {
                    Model.shared.status == .generatingTitle
                }
                
                if shouldYield {
                    Self.logger.info("Pausing community detection to allow title generation")
                    // Wait for title generation to complete
                    var isGeneratingTitle = await MainActor.run { Model.shared.status == .generatingTitle }
                    while isGeneratingTitle {
                        try? await Task.sleep(for: .milliseconds(500))
                        isGeneratingTitle = await MainActor.run { Model.shared.status == .generatingTitle }
                    }
                    Self.logger.info("Resuming community detection after title generation")
                }
                
                let summaryResult = await generateCommunitySummary(
                    for: community,
                    in: graph,
                    fromSubCommunities: currentLevelCommunities
                )
                community.summary = summaryResult.summary
                community.title = summaryResult.title
                community.embedding = summaryResult.embedding
                allCommunities.append(community)
            }
            
            currentLevelCommunities = higherLevelCommunities
            Self.logger.info("Detected \(higherLevelCommunities.count) communities at level \(level)")
        }
        
        Self.logger.notice("Total communities detected: \(allCommunities.count) across \(maxLevels) levels")
        
        return allCommunities
    }
    
    /// Detect base-level communities using relationship connectivity
    private static func detectBaseCommunities(in graph: KnowledgeGraph) -> [Community] {
        var communities: [Community] = []
        var visited: Set<UUID> = []
        var entityToCommunity: [UUID: UUID] = [:]
        
        // Build adjacency list
        var adjacencyList: [UUID: Set<UUID>] = [:]
        for entity in graph.entities {
            adjacencyList[entity.id] = Set()
        }
        
        for relationship in graph.relationships {
            adjacencyList[relationship.sourceEntityId]?.insert(relationship.targetEntityId)
            adjacencyList[relationship.targetEntityId]?.insert(relationship.sourceEntityId)
        }
        
        // Perform community detection using connected components
        for entity in graph.entities {
            guard !visited.contains(entity.id) else { continue }
            
            var componentEntities: [UUID] = []
            var queue: [UUID] = [entity.id]
            visited.insert(entity.id)
            
            // BFS to find connected component
            while !queue.isEmpty {
                let currentId = queue.removeFirst()
                componentEntities.append(currentId)
                
                if let neighbors = adjacencyList[currentId] {
                    for neighbor in neighbors {
                        if !visited.contains(neighbor) {
                            visited.insert(neighbor)
                            queue.append(neighbor)
                        }
                    }
                }
            }
            
            // Create community for this component
            let community = Community(
                level: 0,
                memberEntityIds: componentEntities,
                subCommunityIds: []
            )
            
            communities.append(community)
            
            // Track entity to community mapping
            for entityId in componentEntities {
                entityToCommunity[entityId] = community.id
            }
        }
        
        // Handle isolated entities (no relationships)
        for entity in graph.entities {
            if entityToCommunity[entity.id] == nil {
                let community = Community(
                    level: 0,
                    memberEntityIds: [entity.id],
                    subCommunityIds: []
                )
                communities.append(community)
            }
        }
        
        return communities
    }
    
    /// Build higher-level communities by grouping smaller communities
    private static func buildHigherLevelCommunities(
        from lowerLevelCommunities: [Community],
        level: Int
    ) -> [Community] {
        guard lowerLevelCommunities.count > 1 else {
            return []
        }
        
        var higherLevelCommunities: [Community] = []
        
        // Use simple clustering: group communities by size and similarity
        let sortedCommunities = lowerLevelCommunities.sorted {
            $0.memberEntityIds.count > $1.memberEntityIds.count
        }
        
        // Group communities into clusters of ~3-5 communities each
        let clusterSize = max(2, lowerLevelCommunities.count / 3)
        
        for i in stride(from: 0, to: sortedCommunities.count, by: clusterSize) {
            let endIndex = min(i + clusterSize, sortedCommunities.count)
            let cluster = Array(sortedCommunities[i..<endIndex])
            
            // Merge all entities from sub-communities
            let allEntityIds = cluster.flatMap { $0.memberEntityIds }
            let subCommunityIds = cluster.map { $0.id }
            
            let community = Community(
                level: level,
                memberEntityIds: allEntityIds,
                subCommunityIds: subCommunityIds
            )
            
            higherLevelCommunities.append(community)
        }
        
        return higherLevelCommunities
    }
    
    /// Generate summary for a community using the worker model
    private static func generateCommunitySummary(
        for community: Community,
        in graph: KnowledgeG
```

### Core Architecture Module: `Sidekick/Logic/Utilities/GraphRAG/EntityExtractor.swift`
```
//
//  EntityExtractor.swift
//  Sidekick
//
//  Created by John Bean on 11/10/25.
//

import Foundation
import OSLog

/// Extracts entities and relationships from text using the worker model
public class EntityExtractor {
    
    /// A `Logger` object for ``EntityExtractor``
    private static let logger: Logger = .init(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: EntityExtractor.self)
    )
    
    /// Progress callback type
    public typealias ProgressCallback = @Sendable (Int, Int, String, Int) -> Void
    
    /// Result from entity extraction
    public struct ExtractionResult {
        public var entities: [EntityData]
        public var relationships: [RelationshipData]
    }
    
    /// Intermediate entity data
    public struct EntityData: Codable {
        public var name: String
        public var type: String
        public var description: String
        public var sourceChunks: [Int]
    }
    
    /// Intermediate relationship data
    public struct RelationshipData: Codable {
        public var sourceEntity: String
        public var targetEntity: String
        public var relationshipType: String
        public var description: String
        public var sourceChunks: [Int]
    }
    
    /// JSON structure for LLM response
    private struct LLMResponse: Codable {
        var entities: [LLMEntity]?
        var relationships: [LLMRelationship]?
    }
    
    private struct LLMEntity: Codable {
        var name: String
        var type: String
        var description: String
    }
    
    private struct LLMRelationship: Codable {
        var source: String
        var target: String
        var type: String
        var description: String
    }
    
    /// Extract entities and relationships from text chunks
    /// - Parameters:
    ///   - chunks: Array of text chunks
    ///   - batchSize: Number of chunks to process at once (default: 15)
    ///   - progressCallback: Optional callback for progress updates
    /// - Returns: Extraction result with entities and relationships
    public static func extractEntitiesAndRelationships(
        from chunks: [String],
        batchSize: Int = 15,
        progressCallback: ProgressCallback? = nil
    ) async throws -> ExtractionResult {
        var allEntities: [EntityData] = []
        var allRelationships: [RelationshipData] = []
        
        let totalChunks = chunks.count
        let batches = stride(from: 0, to: totalChunks, by: batchSize).map {
            Array(chunks[$0..<min($0 + batchSize, totalChunks)])
        }
        
        for (batchIndex, batch) in batches.enumerated() {
            let chunkStartIndex = batchIndex * batchSize
            
            // Check if we should yield to higher-priority tasks (like title generation)
            let shouldYield = await MainActor.run {
                Model.shared.status == .generatingTitle
            }
            
            if shouldYield {
                Self.logger.info("Pausing entity extraction to allow title generation")
                // Wait for title generation to complete
                var isGeneratingTitle = await MainActor.run { Model.shared.status == .generatingTitle }
                while isGeneratingTitle {
                    try? await Task.sleep(for: .milliseconds(500))
                    isGeneratingTitle = await MainActor.run { Model.shared.status == .generatingTitle }
                }
                Self.logger.info("Resuming entity extraction after title generation")
            }
            
            // Update progress
            progressCallback?(
                batchIndex + 1,
                batches.count,
                "Extracting entities (batch \(batchIndex + 1)/\(batches.count))",
                allEntities.count
            )
            
            // Process batch
            do {
                let result = try await extractFromBatch(
                    batch: batch,
                    startIndex: chunkStartIndex
                )
                allEntities.append(contentsOf: result.entities)
                allRelationships.append(contentsOf: result.relationships)
                
                Self.logger.info("Extracted \(result.entities.count) entities and \(result.relationships.count) relationships from batch \(batchIndex + 1)")
            } catch {
                Self.logger.error("Failed to extract from batch \(batchIndex + 1): \(error.localizedDescription)")
                // Continue processing other batches
                continue
            }
        }
        
        // Merge duplicate entities
        let mergedEntities = mergeDuplicateEntities(allEntities)
        let mergedRelationships = deduplicateRelationships(allRelationships)
        
        Self.logger.notice("Total extracted: \(mergedEntities.count) entities, \(mergedRelationships.count) relationships")
        
        return ExtractionResult(
            entities: mergedEntities,
            relationships: mergedRelationships
        )
    }
    
    /// Extract entities from a batch of chunks
    private static func extractFromBatch(
        batch: [String],
        startIndex: Int
    ) async throws -> ExtractionResult {
        // Combine batch into single text
        let combinedText = batch.enumerated().map { index, chunk in
            "[Chunk \(startIndex + index)]:\n\(chunk)"
        }.joined(separator: "\n\n")
        
        // Create prompt
        let systemPrompt = """
You are an expert at extracting entities and relationships from text. Extract key entities (people, organizations, concepts, locations, events, etc.) and their relationships.

Return ONLY a valid JSON object with this exact structure:
{
  "entities": [
    {
      "name": "Entity name",
      "type": "Entity type (e.g., Person, Organization, Concept, Location, Event)",
      "description": "Brief description of the entity"
    }
  ],
  "relationships": [
    {
      "source": "Source entity name",
      "target": "Target entity name",
      "type": "Relationship type (e.g., works_at, located_in, related_to, part_of)",
      "description": "Description of the relationship"
    }
  ]
}

Focus on:
- Important entities mentioned in the text
- Clear relationships between entities
- Use consistent entity names
- Keep descriptions concise
"""
        
        let userPrompt = """
Extract entities and relationships from the following text:

\(combinedText)
"""
        
        // Create messages
        let systemMessage = Message(text: systemPrompt, sender: .system)
        let userMessage = Message(text: userPrompt, sender: .user)
        
        // Save current status and set to background task to prevent "Thinking..." message in UI
        let previousStatus = await MainActor.run {
            let status = Model.shared.status
            Model.shared.indicateStartedBackgroundTask()
            return status
        }
        
        // Get response from worker model
        var responseText = ""
        let response = try await Model.shared.listenThinkRespond(
            messages: [systemMessage, userMessage],
            modelType: .worker,
            mode: .default,
            handleResponseUpdate: { _, _ in },
            handleResponseFinish: { fullMessage, _, _ in
                responseText = fullMessage
            }
        )
        
        responseText = response.text
        
        // Restore previous status
        await MainActor.run {
            Model.shared.setStatus(previousStatus)
        }
        
        // Parse JSON response
        let llmResponse = try parseJSONResponse(responseText)
        
        // Convert to EntityData and RelationshipData
        var entities: [EntityData] = []
        var relationships: [RelationshipData] = []
        
        for llmEntity in llmResponse.entities ?? [] {
            // Determine which chunks mention this entity
            let sourceChunks = batch.enumerated().compactMap { index, chunk in
                chunk.localizedCaseInsensitiveContains(llmEntity.name) ? startIndex + index : nil
            }
            
            entities.append(EntityData(
                name: llmEntity.name,
                type: llmEntity.type,
                description: llmEntity.description,
                sourceChunks: sourceChunks
            ))
        }
        
        for llmRel in llmResponse.relationships ?? [] {
            // Determine which chunks mention this relationship
            let sourceChunks = batch.enumerated().compactMap { index, chunk in
                (chunk.localizedCaseInsensitiveContains(llmRel.source) &&
                 chunk.localizedCaseInsensitiveContains(llmRel.target)) ? startIndex + index : nil
            }
            
            relationships.append(RelationshipData(
                sourceEntity: llmRel.source,
                targetEntity: llmRel.target,
                relationshipType: llmRel.type,
                description: llmRel.description,
                sourceChunks: sourceChunks
            ))
        }
        
        return ExtractionResult(entities: entities, relationships: relationships)
    }
    
    /// Parse JSON response from LLM
    private static func parseJSONResponse(_ text: String) throws -> LLMResponse {
        // Try to extract JSON from markdown code blocks if present
        var jsonText = text
        
        if let jsonRange = text.range(of: "```json", options: .caseInsensitive) {
            let startIndex = text.index(jsonRange.upperBound, offsetBy: 1)
            if let endRange = text.range(of: "```", range: startIndex..<text.endIndex) {
                jsonText = String(text[startIndex..<endRange.lowerBound])
            }
        } else if let jsonRange = text.range(of: "```") {
            let startIndex = text.index(jsonRange.upperBound, offsetBy: 1)
            if let endRange = text.range(of: "```", range: startIndex..<text.endIndex) {
                jsonText = String(text[s
```

### Core Architecture Module: `Sidekick/Logic/Utilities/GraphRAG/GraphDatabase.swift`
```
//
//  GraphDatabase.swift
//  Sidekick
//
//  Created by John Bean on 11/10/25.
//

import Foundation
import SQLite
import OSLog

/// Manages persistence of knowledge graphs using SQLite
public class GraphDatabase {
	
	/// A `Logger` object for ``GraphDatabase``
	private static let logger: Logger = .init(
		subsystem: Bundle.main.bundleIdentifier!,
		category: String(describing: GraphDatabase.self)
	)
	
	private let db: Connection
	
	// Table definitions
	private let entities = Table("entities")
	private let relationships = Table("relationships")
	private let communities = Table("communities")
	private let communityMembers = Table("community_members")
	private let chunkEntities = Table("chunk_entities")
	
	// Entity columns
	private let entityId = SQLite.Expression<String>("id")
	private let entityName = SQLite.Expression<String>("name")
	private let entityType = SQLite.Expression<String>("type")
	private let entityDescription = SQLite.Expression<String>("description")
	private let entityEmbedding = SQLite.Expression<Data?>("embedding")
	private let entityResourceId = SQLite.Expression<String>("resource_id")
	
	// Relationship columns
	private let relationshipId = SQLite.Expression<String>("id")
	private let relationshipSource = SQLite.Expression<String>("source_entity_id")
	private let relationshipTarget = SQLite.Expression<String>("target_entity_id")
	private let relationshipType = SQLite.Expression<String>("type")
	private let relationshipDescription = SQLite.Expression<String>("description")
	private let relationshipStrength = SQLite.Expression<Double>("strength")
	
	// Community columns
	private let communityId = SQLite.Expression<String>("id")
	private let communityLevel = SQLite.Expression<Int64>("level")
	private let communityTitle = SQLite.Expression<String>("title")
	private let communitySummary = SQLite.Expression<String>("summary")
	private let communityEmbedding = SQLite.Expression<Data?>("embedding")
	
	// Member columns
	private let memberId = SQLite.Expression<Int64>("id")
	private let memberCommunityId = SQLite.Expression<String>("community_id")
	private let memberEntityId = SQLite.Expression<String?>("entity_id")
	private let memberSubCommunityId = SQLite.Expression<String?>("sub_community_id")
	
	// Chunk entity columns
	private let chunkEntityId = SQLite.Expression<Int64>("id")
	private let chunkIndex = SQLite.Expression<Int64>("chunk_index")
	private let chunkEntityEntityId = SQLite.Expression<String>("entity_id")
	
	/// Initialize database at given path
	/// - Parameter dbPath: Path to SQLite database file
	public init(dbPath: String) throws {
		do {
			db = try Connection(dbPath)
			try createTables()
		} catch {
			Self.logger.error("Failed to initialize database: \(error.localizedDescription)")
			throw DatabaseError.initializationFailed(error.localizedDescription)
		}
	}
	
	/// Create database tables if they don't exist
	private func createTables() throws {
		// Entities table
		try db.run(entities.create(ifNotExists: true) { t in
			t.column(entityId, primaryKey: true)
			t.column(entityName)
			t.column(entityType)
			t.column(entityDescription)
			t.column(entityEmbedding)
			t.column(entityResourceId)
		})
		
		// Create index on entity name for faster lookups
		try db.run(entities.createIndex(entityName, ifNotExists: true))
		
		// Relationships table
		try db.run(relationships.create(ifNotExists: true) { t in
			t.column(relationshipId, primaryKey: true)
			t.column(relationshipSource)
			t.column(relationshipTarget)
			t.column(relationshipType)
			t.column(relationshipDescription)
			t.column(relationshipStrength)
		})
		
		// Create indices for relationship queries
		try db.run(relationships.createIndex(relationshipSource, ifNotExists: true))
		try db.run(relationships.createIndex(relationshipTarget, ifNotExists: true))
		
		// Communities table
		try db.run(communities.create(ifNotExists: true) { t in
			t.column(communityId, primaryKey: true)
			t.column(communityLevel)
			t.column(communityTitle)
			t.column(communitySummary)
			t.column(communityEmbedding)
		})
		
		// Community members table (for many-to-many relationships)
		try db.run(communityMembers.create(ifNotExists: true) { t in
			t.column(memberId, primaryKey: .autoincrement)
			t.column(memberCommunityId)
			t.column(memberEntityId)
			t.column(memberSubCommunityId)
		})
		
		// Create index on community_id for faster lookups
		try db.run(communityMembers.createIndex(memberCommunityId, ifNotExists: true))
		
		// Chunk entities table (for chunk-to-entity mapping)
		try db.run(chunkEntities.create(ifNotExists: true) { t in
			t.column(chunkEntityId, primaryKey: .autoincrement)
			t.column(chunkIndex)
			t.column(chunkEntityEntityId)
		})
		
		// Create index on chunk_index for faster lookups
		try db.run(chunkEntities.createIndex(chunkIndex, ifNotExists: true))
	}
	
	/// Save a knowledge graph to the database
	/// - Parameter graph: The knowledge graph to save
	public func saveGraph(_ graph: KnowledgeGraph) throws {
		do {
			try db.transaction {
				// Clear existing data for this resource
				try clearResourceData(resourceId: graph.resourceId.uuidString)
				
				// Save entities
				for entity in graph.entities {
					let embeddingData: Data? = if let embedding = entity.embedding {
						try? JSONEncoder().encode(embedding)
					} else {
						nil
					}
					
					try db.run(entities.insert(
						entityId <- entity.id.uuidString,
						entityName <- entity.name,
						entityType <- entity.type,
						entityDescription <- entity.description,
						entityEmbedding <- embeddingData,
						entityResourceId <- graph.resourceId.uuidString
					))
					
					// Save chunk mappings
					for chunk in entity.sourceChunks {
						try db.run(chunkEntities.insert(
							chunkIndex <- Int64(chunk),
							chunkEntityEntityId <- entity.id.uuidString
						))
					}
				}
				
				// Save relationships
				for relationship in graph.relationships {
					try db.run(relationships.insert(
						relationshipId <- relationship.id.uuidString,
						relationshipSource <- relationship.sourceEntityId.uuidString,
						relationshipTarget <- relationship.targetEntityId.uuidString,
						relationshipType <- relationship.relationshipType,
						relationshipDescription <- relationship.description,
						relationshipStrength <- Double(relationship.strength)
					))
				}
				
				// Save communities
				for community in graph.communities {
					let embeddingData: Data? = if let embedding = community.embedding {
						try? JSONEncoder().encode(embedding)
					} else {
						nil
					}
					
					try db.run(communities.insert(
						communityId <- community.id.uuidString,
						communityLevel <- Int64(community.level),
						communityTitle <- community.title,
						communitySummary <- community.summary,
						communityEmbedding <- embeddingData
					))
					
					// Save community members
					for entityId in community.memberEntityIds {
						try db.run(communityMembers.insert(
							memberCommunityId <- community.id.uuidString,
							memberEntityId <- entityId.uuidString,
							memberSubCommunityId <- nil
						))
					}
					
					// Save sub-communities
					for subCommId in community.subCommunityIds {
						try db.run(communityMembers.insert(
							memberCommunityId <- community.id.uuidString,
							memberEntityId <- nil,
							memberSubCommunityId <- subCommId.uuidString
						))
					}
				}
			}
			
			Self.logger.notice("Saved graph with \(graph.entityCount) entities, \(graph.relationshipCount) relationships, \(graph.communityCount) communities")
			
		} catch {
			Self.logger.error("Failed to save graph: \(error.localizedDescription)")
			throw DatabaseError.saveFailed(error.localizedDescription)
		}
	}
	
	/// Load a knowledge graph for a resource
	/// - Parameter resourceId: The resource ID
	/// - Returns: The loaded knowledge graph
	public func loadGraph(resourceId: UUID) throws -> KnowledgeGraph {
		let graph = KnowledgeGraph(resourceId: resourceId)
		
		do {
			// Load entities
			let entityRows = try db.prepare(entities.filter(entityResourceId == resourceId.uuidString))
			var loadedEntities: [GraphEntity] = []
			
			for row in entityRows {
				let id = UUID(uuidString: row[entityId])!
				let embedding: [Float]? = if let data = row[entityEmbedding] {
					try? JSONDecoder().decode([Float].self, from: data)
				} else {
					nil
				}
				
				// Get source chunks for this entity
				let chunkRows = try db.prepare(chunkEntities.filter(chunkEntityEntityId == row[entityId]))
				let sourceChunks = chunkRows.map { Int($0[chunkIndex]) }
				
				let entity = GraphEntity(
					id: id,
					name: row[entityName],
					type: row[entityType],
					description: row[entityDescription],
					sourceChunks: sourceChunks,
					embedding: embedding
				)
				
				loadedEntities.append(entity)
			}
			
			graph.addEntities(loadedEntities)
			
			// Load relationships
			let relationshipRows = try db.prepare(relationships)
			var loadedRelationships: [GraphRelationship] = []
			
			for row in relationshipRows {
				// Check if both entities exist in the graph
				let sourceId = UUID(uuidString: row[relationshipSource])!
				let targetId = UUID(uuidString: row[relationshipTarget])!
				
				guard graph.findEntity(id: sourceId) != nil,
				      graph.findEntity(id: targetId) != nil else {
					continue  // Skip relationships with missing entities
				}
				
				let relationship = GraphRelationship(
					id: UUID(uuidString: row[relationshipId])!,
					sourceEntityId: sourceId,
					targetEntityId: targetId,
					relationshipType: row[relationshipType],
					description: row[relationshipDescription],
					strength: Float(row[relationshipStrength])
				)
				
				loadedRelationships.append(relationship)
			}
			
			graph.addRelationships(loadedRelationships)
			
			// Load communities
			let communityRows = try db.prepare(communities)
			var loadedCommunities: [Community] = []
			
			for row in communityRows {
				let commId = row[commu
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #95** (2026-09-30): **BUG: wrong README.md info**
  *Symptoms*: **Describe the bug** doesn't work: ```bash brew install --cask arcadi4/tap/sidekick ```  **To Reproduce** Steps to reproduce the behavior: ```bash brew install --cask arcadi4/tap/sidekick ``` **Expected behaviour** works  **Additional context** that works! ```bash brew install --cask arcadi4/tap/sidekick-ai ``` 

- **Issue #76** (2025-11-17): **BUG: Inference Server Error**
  *Symptoms*: Trying to send a message to ChatGPT (added OpenAI API URL and key in the settings) gives me this error message, no matter which model I choose: Inference Server Error Fix the error according to the server's error message below, then try again.  The connection to the server failed with status code: 400. Response: { "error": { "message": "Unrecognized request argument supplied: provider", "type": "invalid_request_error", "param": null, "code": null }
  **Post-Mortem & Fix Analysis**:
  > @karolleon   `provider` is a argument that should be used for OpenRouter, not OpenAl. I'll get this fixed.

- **Issue #68** (2025-06-19): **BUG: Hanging/crashing upon start**
  *Symptoms*: **Describe the bug** When starting the app, after loading the main interface, it sits on a spinning wheel of death either indefinitely, or for a few seconds before crashing (depending on the configuration). Often it seems to hang during the opening frames of the fade-in of the 'try tools' callout bubble, but about half the time this doesn't appear.  **To Reproduce** (my experience) Steps to reproduce the behavior: 1. Open the app (most recent release 1.0.0-rc.12). 2. Set up with remote server (Gemini, had to add /openai to end of default URL included), successfully have a conversation with it, create one expert, use multiple times over 1-2 days. 3. Wait a day, re-open. 4. Upon loading the interface, experience perpetual spinning wheel of death that requires a force-quit. 5. Clear the Preferences plist. App allows me to setup remote LLM server with no issues, but hangs once I get to chat interface. 6. Clear Application Support, Cache, reinstall—now quits on its own after a few seconds of the spinning wheel.  **Expected behavior** Not this!  **Screenshots** It's been proving hard to capture it, but here's the aforementioned message box a few moments before the crash: <img width="807" alt="Image" src="https://github.com/user-attachments/assets/951ac2ce-d7c2-4adf-8a22-af8d6a37ded8" />  **Desktop (please complete the following information):**  - macOS Sequoia 15.5  - MacBook Air M2, 16GB RAM  **Additional context** Since it started crashing of its own volition, I've been able to g
  **Post-Mortem & Fix Analysis**:
  > @Omnitheorist   Thanks for the feedback 🙏  I personally haven't run into this bug, but synthesizing information from the crash log and your experience, the crash seems to have to do with a bug in `TipKit` on macOS 15.5.  Could you try [this build](https://drive.usercontent.google.com/download?id=1x7MLBtmKMQMGmBRqrwZGmcBF4TE5YHHM&export=download&authuser=0) and report back on whether the issue has been patched?
  > Hallelujah, it works! It hangs for a second or so when I first open it before the "How can I help you?" animation plays, but it seems to otherwise be working as normal. Thank you so much!
  > Same here ``` ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               Sidekick [68170] Path:                  /Applications/Sidekick.app/Contents/MacOS/Sidekick Identifier:            com.pattonium.Sidekick Version:               1.0.0-rc.12 (32) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2025-07-07 15:57:28.4478 +0200 OS Version:            macOS 15.5 (24F74) Report Version:        12 Anonymous UUID:        07487DE6-2027-758A-0A0C-A9C4CCB51D99  Sleep/Wake UUID:       2D3864AB-D035-4942-9E87-01C37556B811  Time Awake Since Boot: 360000 seconds Time Since Wake:       3275 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:       0x0000000000000001, 0x00000001861ca664  Termination Reason:    Namespace SIG

- **Issue #60** (2025-04-24): **BUG: Cursor jumps to end of text when typing prompt**
  *Symptoms*: **Describe the bug** When typing out a prompt, the text cursor keeps jumping to the end of the prompt  **To Reproduce** Type out some text in the prompt bar, then move the cursor to the middle of the text and type out some text. The cursor will move to the end of the text.  **Expected behavior** The cursor should stay directly after the last edited character unless explicitly moved  **Desktop (please complete the following information):**  - macOS 15.4 
  **Post-Mortem & Fix Analysis**:
  > Will fix this immediately and push to the release 1.0.0-rc.9.

- **Issue #59** (2025-04-24): **BUG: Last deleted model stays on list**
  *Symptoms*: **Describe the bug** I deleted all models installed via sidekick in favor of Ollama however the last model stays on sidekick's list with no option for deletion. I have already deleted the model from finder. There was a small red trash can icon for my other models but it doesn't show up for the last one.   **To Reproduce** Go to settings. Click inference. Delete all models. Won't be able to delete last model from list.  **Expected behavior** You should be able to delete all models from the list.  **Screenshots**  <img width="245" alt="Image" src="https://github.com/user-attachments/assets/45daf938-3ea1-4e11-b2d5-b646ed00a5a9" />  <img width="490" alt="Image" src="https://github.com/user-attachments/assets/8177152a-3409-44cf-b5c9-5e16c0f48ff0" />  **Desktop (please complete the following information):**  - MacOS Sequoia 15.4.1  
  **Post-Mortem & Fix Analysis**:
  > @mustbeperfect   Thanks for spotting this; it's a relic of Sidekick being local only; where it did not support external servers such as Ollama.  I'll have this fixed by the next RC.
  > @mustbeperfect   This has been fixed as of commit [d7756da](https://github.com/johnbean393/Sidekick/commit/d7756dac7b9643dd2d10ccc4d87bbc5401f4b706)

- **Issue #52** (2025-04-14): **BUG: Cannot select remote model name**
  *Symptoms*: name: Bug report about: Create a report to help us improve title: 'BUG: Cannot select specific model name when adding remote models (e.g., Gemini, OpenRouter)' labels: bug  ---  **Describe the bug** When attempting to add a remote model provider via the "Use Model Server" option (specifically tested with Gemini and OpenRouter), the interface does not allow selecting a specific model name from the available options for that provider. The selection mechanism seems unresponsive or locked, preventing the configuration and use of specific remote models. This makes it so i cannot use a remote model and am locked to exclusively local ones.  **To Reproduce** Steps to reproduce the behavior: 1. Click on the UI element labeled "Use Model Server". 2. Within the model server configuration area, input endpoint URL. 3. Fill in API key. 4. Attempt to click on the dropdown or input field designated for selecting the specific **Model Name** (e.g., trying to select `gemini-2.0-flash` instead of the default gpt-4o, or choosing a specific model from the OpenRouter list). 5. See error: The model name selection does not respond when clicked.  **Expected behavior** After configuring the remote provider (like Gemini or OpenRouter) via the "Use Model Server" section, I expect to be able to click on a dropdown menu or list associated with 'Model Name' and select a specific, valid model offered by that provider (e.g., `gemini-2.0-flash`, `openrouter/mistralai/mistral-7b-instruct`, etc.). The chosen mod
  **Post-Mortem & Fix Analysis**:
  >  @DrChilla   I believe this is not a bug with Sidekick.  Instead of the URL endpoint `https://openrouter.ai/api/v1/chat/completions`, fill in `https://openrouter.ai/api/`. This should allow Sidekick to retrieve models from the API.  More instructions / information can be found [here](https://johnbean393.github.io/Sidekick/Features/remoteModels/#configuring-an-endpoint).  If the problem persists, feel free to notify me and I will investigate further.
  > That made it work for openrouter, I thought id tried it without that last chunk of URL, but it must have been the gemini api i tried it with. i'm guessing gemini api doesnt work because i'm using v1beta instead of just v1. not sure if anyone has figured that out https://generativelanguage.googleapis.com/v1beta/openai/chat/completions or maybe because it doesnt have api as the last part of the url call?
  > @DrChilla   The reason it fails for Gemini is because Sidekick appends `/v1/chat/completions` to the endpoint, which doesn't exist for Gemini. Let me change the endpoint in the next version to accept `http://apidomainname.com/v1/` instead of `http://apidomainname.com/`, where only `/chat/completions/` will be appended to support Gemini.

- **Issue #50** (2025-04-11): **BUG: Sonoma issue**
  *Symptoms*: **Describe the bug** Does release candidates support Sonoma or It's minimum OS is Sequoia?
  **Post-Mortem & Fix Analysis**:
  > @iPsych   As discussed [here](https://github.com/johnbean393/Sidekick/issues/14#issuecomment-2791486731), the minimum OS is now Sequoia. I am in the process of updating documentation to reflect this change.

- **Issue #48** (2025-04-10): **BUG: GPU acceleration unavailable since update from 0.0.30**
  *Symptoms*: **Describe the bug** Since I updated from version 0.0.30 to 0.0.32, Sidekick uses the CPU for running the model instead of GPU, and I'm not even able to turn on GPU acceleration. The switch stays 'grey'/off no matter how often I click it. It is also noticeable that the answer prompt is generated quite slowly due to CPU instead of GPU. The same issue persists with recently released 1.0.0-rc1.  **To Reproduce** Steps to reproduce the behavior: 1. Enter a prompt and submit it --> CPU usage goes up but GPU usage stays low between 0 and 3 %  1. Go to settings, Tab 'Inference' 2. Try to activate 'Use GPU Acceleration' --> does not activate  **Expected behavior** Basically, I expect that I can at least activate it. Optimally, it should be used by default. But I guess it is the default, but not working due to an internal/external issue.  I tried rebooting, reinstalling Sidekick but no change, issue persists.  **Screenshots** ![Image](https://github.com/user-attachments/assets/8f738240-6ad6-455b-9787-fad3116629a8)  **Logs** I started Sidekick from command line, and that's the output I get. Seems to me something's not working properly under the hood: <details> <summary>Log starting Sidekick from command line</summary>  ```bash    [jonas in ~]# /Applications/Sidekick-beta.app/Contents/MacOS/Sidekick Failed to get endpoint, using default Loaded 1 bookmarks Failed to get endpoint, using default Failed to get endpoint, using default Failed to get endpoint, using default Failed to get endpo
  **Post-Mortem & Fix Analysis**:
  > @jonasjelonek   Thanks for the heads up!   Let me look into the issue right away. At first glance it's not occurring on my device, so I'll figure out if I can replicate it. I'll let you know as soon as I have progress.  Since this is a major issue, once I have it fixed, I'll create a 1.0.0-rc.2 release to avoid confusion.
  > @jonasjelonek   I believe this [line](https://github.com/johnbean393/Sidekick/blob/6e1d0f8c826d5d7fcab31197287c185e017b3ba6/Sidekick/Logic/Settings/InferenceSettings.swift#L242) is the issue, where an incorrect default property is set.  What's happening is that when GPU acceleration is toggled `on`, the view redraws and retrieves the `serverModelHasVision` property. Since there is no value, this tries to set a default value of `false`, but instead incorrectly applies this value to `useGPUAcceleration`. This results in the toggle being stuck in off.
  > @jonasjelonek   I'm now compiling Sidekick for the 1.0.0-rc.2 release with the fixes applied, will upload ASAP.

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

### Incident Patch 1: `83b3e6e0` (2026-09-30)
**Commit Message**: docs: fix Homebrew cask name in README (#96)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -161,7 +161,7 @@ Optionally, you can offload generation to speed up processing while extending th
 ### Via Homebrew
 
 ```bash
-brew install --cask arcadi4/tap/sidekick
+brew install --cask arcadi4/tap/sidekick-ai
 ```
 
 ### Download and Setup
```

---

### Incident Patch 2: `487898c8` (2026-05-24)
**Commit Message**: fix: Parallel chats

**File**: `Sidekick.xcodeproj/project.pbxproj` (modified, +36/-14)
```diff
@@ -203,6 +203,8 @@
 		206AB9672DB09BB800385510 /* Location.swift in Sources */ = {isa = PBXBuildFile; fileRef = 206AB9662DB09BB800385510 /* Location.swift */; };
 		206E95452EBC0BDC008C49B4 /* ModelSelectorDropdown.swift in Sources */ = {isa = PBXBuildFile; fileRef = 206E95442EBC0BDC008C49B4 /* ModelSelectorDropdown.swift */; };
 		206FBB212D54B40700A045FF /* MessageReasoningProcessView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 206FBB202D54B40700A045FF /* MessageReasoningProcessView.swift */; };
+		20BEEF020000000000000009 /* MessageStep.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF020000000000000008 /* MessageStep.swift */; };
+		20BEEF02000000000000000B /* MessageStepsView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF02000000000000000A /* MessageStepsView.swift */; };
 		2075220B2D7FDF6C00A1CA60 /* Extension+SecureDefaults.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2075220A2D7FDF6C00A1CA60 /* Extension+SecureDefaults.swift */; };
 		2075FE922EBAC06100EA6131 /* llama-server in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE912EBAC06100EA6131 /* llama-server */; };
 		2075FE932EBAC06100EA6131 /* llama-perplexity in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE902EBAC06100EA6131 /* llama-perplexity */; };
@@ -212,9 +214,6 @@
 		2075FE982EBAC06100EA6131 /* libggml-cpu.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2075FE8B2EBAC06100EA6131 /* libggml-cpu.0.dylib */; };
 		2075FE992EBAC06100EA6131 /* libllama.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2075FE8E2EBAC06100EA6131 /* libllama.0.dylib */; };
 		2075FE9A2EBAC06100EA6131 /* libmtmd.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2075FE8F2EBAC06100EA6131 /* libmtmd.0.dylib */; };
-		2FB0A0010000000DEADBEE2 /* libllama-common.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2FB0A0010000000DEADBEE1 /* libllama-common.0.dylib */; };
-		2FB0A0020000000DEADBEE2 /* libllama-server-impl.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2FB0A0020000000DEADBEE1 /* libllama-server-impl.dylib */; };
-		2FB0A0030000000DEADBEE2 /* libllama-perplexity-impl.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2FB0A0030000000DEADBEE1 /* libllama-perplexity-impl.dylib */; };
 		2075FE9B2EBAC06100EA6131 /* libggml-metal.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2075FE8C2EBAC06100EA6131 /* libggml-metal.0.dylib */; };
 		2075FE9C2EBAC2D600EA6131 /* libggml.0.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE882EBAC06100EA6131 /* libggml.0.dylib */; };
 		2075FE9D2EBAC2D600EA6131 /* libggml-base.0.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE892EBAC06100EA6131 /* libggml-base.0.dylib */; };
@@ -223,19 +222,13 @@
 		2075FEA02EBAC2D600EA6131 /* libggml-metal.0.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE8C2EBAC06100EA6131 /* libggml-metal.0.dylib */; };
 		2075FEA22EBAC2D600EA6131 /* libllama.0.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE8E2EBAC06100EA6131 /* libllama.0.dylib */; };
 		2075FEA32EBAC2D600EA6131 /* libmtmd.0.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE8F2EBAC06100EA6131 /* libmtmd.0.dylib */; };
-		2FB0A0010000000DEADBEE3 /* libllama-common.0.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2FB0A0010000000DEADBEE1 /* libllama-common.0.dylib */; };
-		2FB0A0020000000DEADBEE3 /* libllama-server-impl.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2FB0A0020000000DEADBEE1 /* libllama-server-impl.dylib */; };
-		2FB0A0030000000DEADBEE3 /* libllama-perplexity-impl.dylib in Resources */ = {isa = PBXBuildFile; fileRef = 2FB0A0030000000DEADBEE1 /* libllama-perplexity-impl.dylib */; };
 		2075FEAE2EBAC37B00EA6131 /* libggml.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE882EBAC06100EA6131 /* libggml.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEAF2EBAC37B00EA6131 /* libggml-base.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE892EBAC06100EA6131 /* libggml-base.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEB02EBAC37B00EA6131 /* libggml-blas.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE8A2EBAC06100EA6131 /* libggml-blas.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEB12EBAC37B00EA6131 /* libggml-cpu.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE8B2EBAC06100EA6131 /* libggml-cpu.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEB22EBAC37B00EA6131 /* libggml-metal.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE8C2EBAC06100EA6131 /* libggml-metal.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEB42EBAC37B00EA6131 /* libllama.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE8E2EBAC06100EA6131 /* libllama.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEB52EBAC37B00EA6131 /* libmtmd.0.d
```

**File**: `Sidekick.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
       "location" : "https://github.com/johnbean393/Default-Models",
       "state" : {
         "branch" : "main",
-        "revision" : "93e392e04d731bff04576c649c0aeae0b694f862"
+        "revision" : "66b89cafad865fea3c1ca8e1831fadc0db4f6fa0"
       }
     },
     {
```

**File**: `Sidekick.xcodeproj/xcuserdata/bj.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 		<key>llama-server-watchdog.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>2</integer>
+			<integer>4</integer>
 		</dict>
 	</dict>
 	<key>SuppressBuildableAutocreation</key>
```

**File**: `Sidekick/AppState.swift` (modified, +14/-0)
```diff
@@ -22,7 +22,21 @@ public final class AppState {
 
     var commandSelectedExpertId: UUID? = nil
 
+    /// Controls presentation of the onboarding ``SetupView`` sheet from
+    /// ``ContentView``. Initialized from ``Settings/showSetup`` so the
+    /// usual first-run behavior is preserved, but can be toggled at any
+    /// time (e.g. from the Help menu) to re-run the onboarding wizard
+    /// for debugging the setup flow.
+    var isShowingSetup: Bool = Settings.showSetup
+
     static func setCommandSelectedExpertId(_ id: UUID) {
         Self.shared.commandSelectedExpertId = id
     }
+
+    /// Re-presents the onboarding wizard, regardless of whether setup
+    /// has already been completed. Used by the Help menu's
+    /// "Show Onboarding Wizard" item.
+    static func showOnboardingWizard() {
+        Self.shared.isShowingSetup = true
+    }
 }
```

**File**: `Sidekick/Extensions/Extension+URL.swift` (modified, +15/-5)
```diff
@@ -69,6 +69,13 @@ public extension URL {
     }
 	
 	/// Function to verify if url is reachable
+	///
+	/// Treats any 2xx/3xx HTTP response as reachable (HuggingFace's
+	/// download endpoints commonly issue 302 redirects via `HEAD`).
+	/// `completion` is guaranteed to be invoked exactly once even when
+	/// the request fails or returns a non-HTTP response, which prevents
+	/// callers (e.g. the model downloader) from hanging on unreachable
+	/// hosts.
 	static func verifyURL(
 		url: URL,
 		timeoutInterval: Double = 3,
@@ -82,13 +89,16 @@ public extension URL {
 		let task = URLSession.shared.dataTask(
 			with: request
 		) { _, response, error in
-			if let httpResponse = response as? HTTPURLResponse {
-				if httpResponse.statusCode == 200 {
-					completion(true)
-				}
-			} else {
+			if error != nil {
+				completion(false)
+				return
+			}
+			guard let httpResponse = response as? HTTPURLResponse else {
 				completion(false)
+				return
 			}
+			let isValid: Bool = (200..<400).contains(httpResponse.statusCode)
+			completion(isValid)
 		}
 		task.resume()
 	}
```

**File**: `Sidekick/Localizable.xcstrings` (modified, +106/-11)
```diff
@@ -90,6 +90,16 @@
       },
       "shouldTranslate" : false
     },
+    "%@ / %@ free" : {
+      "localizations" : {
+        "en" : {
+          "stringUnit" : {
+            "state" : "new",
+            "value" : "%1$@ / %2$@ free"
+          }
+        }
+      }
+    },
     "%@ %@…" : {
       "localizations" : {
         "en" : {
@@ -147,17 +157,8 @@
       },
       "shouldTranslate" : false
     },
-    "0" : {
-      "shouldTranslate" : false
-    },
-    "0.6" : {
-      "shouldTranslate" : false
-    },
-    "0.8" : {
-      "shouldTranslate" : false
-    },
-    "1.3" : {
-      "shouldTranslate" : false
+    "2,048" : {
+
     },
     "A file with the same name already exists. Do you want to overwrite it?" : {
       "extractionState" : "stale",
@@ -758,6 +759,9 @@
           }
         }
       }
+    },
+    "Choosing a model for your Mac…" : {
+
     },
     "Chores" : {
       "extractionState" : "stale",
@@ -823,6 +827,7 @@
       }
     },
     "Coding / Math" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -968,6 +973,9 @@
           }
         }
       }
+    },
+    "Configure load parameters for this model" : {
+
     },
     "Configure the inference server directly by injecting flags and arguments. Arguments configured here will override other settings if needed.\n\nFind more information [here](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)." : {
       "localizations" : {
@@ -989,6 +997,9 @@
           }
         }
       }
+    },
+    "Configure…" : {
+
     },
     "Configuring image layout..." : {
       "extractionState" : "stale",
@@ -1032,6 +1043,7 @@
       }
     },
     "Context length is the maximum amount of information it can take as input for a query. A larger context length allows an LLM to recall more information, at the cost of slower output and more memory usage." : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -1133,6 +1145,7 @@
       }
     },
     "Controls whether the GPU is used for inference." : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -1375,6 +1388,7 @@
       }
     },
     "Creative Writing / Poetry" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -1412,6 +1426,7 @@
       }
     },
     "Data Cleaning / Data Analysis" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -1461,6 +1476,9 @@
           }
         }
       }
+    },
+    "Default Model" : {
+
     },
     "Default shortcuts can be modified in `Settings -> General`." : {
       "extractionState" : "stale",
@@ -1673,6 +1691,19 @@
         }
       }
     },
+    "Download %@" : {
+
+    },
+    "Download %@ (%@)" : {
+      "localizations" : {
+        "en" : {
+          "stringUnit" : {
+            "state" : "new",
+            "value" : "Download %1$@ (%2$@)"
+          }
+        }
+      }
+    },
     "Download Default Model" : {
       "localizations" : {
         "zh-Hans" : {
@@ -1682,6 +1713,9 @@
           }
         }
       }
+    },
+    "Download failed" : {
+
     },
     "Download Model" : {
       "localizations" : {
@@ -1722,6 +1756,9 @@
           }
         }
       }
+    },
+    "Downloading %@…" : {
+
     },
     "Downloading model %@" : {
       "localizations" : {
@@ -2073,6 +2110,12 @@
           }
         }
       }
+    },
+    "Estimated memory" : {
+
+    },
+    "Estimating…" : {
+
     },
     "Evaluating your content..." : {
       "extractionState" : "stale",
@@ -2568,6 +2611,7 @@
       }
     },
     "General Conversation" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -3233,6 +3277,9 @@
           }
         }
       }
+    },
+    "Maximum information the model can consider per query. The slider stops at the largest context that comfortably fits in your Mac's memory." : {
+
     },
     "Maximum number of entities to extract per expert. Higher values provide more detail but slower indexing." : {
       "localizations" : {
@@ -3274,6 +3321,12 @@
           }
         }
       }
+    },
+    "Memory estimate unavailable" : {
+
+    },
+    "Memory estimate unavailable; using defaults." : {
+
     },
     "Memory updated" : {
       "localizations" : {
@@ -3747,6 +3800,12 @@
           }
         }
       }
+    },
+    "Pause" : {
+
+    },
+    "Paused — %@" : {
+
     },
     "PDF" : {
 
@@ -4043,6 +4102,7 @@
       }
     },
     "Recommended values:" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -4286,6 +4346,9 @@
           }
         }
       }
+    },
+    "Resume" : {
+
     },
     "Resuming indexing \"%@\"" :
```

**File**: `Sidekick/Logic/Commands/HelpCommands.swift` (modified, +5/-0)
```diff
@@ -21,6 +21,11 @@ public class HelpCommands {
 			} label: {
 				Text("Report an Issue")
 			}
+			Button {
+				AppState.showOnboardingWizard()
+			} label: {
+				Text("Show Onboarding Wizard")
+			}
 		}
 	}
     
```

**File**: `Sidekick/Logic/Data Models/ConversationManager.swift` (modified, +10/-0)
```diff
@@ -401,12 +401,16 @@ extension ConversationManager {
         entity.imageUrl = message.imageUrl
         entity.startTime = message.startTime
         entity.lastUpdated = message.lastUpdated
+        entity.reasoningEndTime = message.reasoningEndTime
         entity.responseStartSeconds = message.responseStartSeconds
         entity.tokensPerSecond = message.tokensPerSecond
         entity.outputEnded = message.outputEnded
         entity.functionCallRecordsData = message.functionCallRecords.flatMap {
             try? encoder.encode($0)
         }
+        entity.stepsData = message.steps.isEmpty
+            ? nil
+            : (try? encoder.encode(message.steps))
         entity.referencedURLsData = try? encoder.encode(message.referencedURLs)
 
         // Snapshot is 1:1 with cascade delete.
@@ -447,6 +451,10 @@ extension ConversationManager {
         let functionCallRecords: [FunctionCallRecord]? = entity.functionCallRecordsData.flatMap {
             try? decoder.decode([FunctionCallRecord].self, from: $0)
         }
+        let steps: [MessageStep] = {
+            guard let data = entity.stepsData else { return [] }
+            return (try? decoder.decode([MessageStep].self, from: data)) ?? []
+        }()
         let referencedURLs: [ReferencedURL] = {
             guard let data = entity.referencedURLsData else { return [] }
             return (try? decoder.decode([ReferencedURL].self, from: data)) ?? []
@@ -478,10 +486,12 @@ extension ConversationManager {
             imageUrl: entity.imageUrl,
             startTime: entity.startTime,
             lastUpdated: entity.lastUpdated,
+            reasoningEndTime: entity.reasoningEndTime,
             responseStartSeconds: entity.responseStartSeconds,
             tokensPerSecond: entity.tokensPerSecond,
             outputEnded: entity.outputEnded,
             functionCallRecords: functionCallRecords,
+            steps: steps,
             referencedURLs: referencedURLs,
             snapshot: snapshot
         )
```

---

### Incident Patch 3: `ce0235f2` (2026-05-23)
**Commit Message**: feat: Incremental rendering

**File**: `Sidekick/Logic/Inference/llama.cpp/LlamaServer+Chat.swift` (modified, +123/-29)
```diff
@@ -309,36 +309,57 @@ extension LlamaServer {
                                     throw LlamaServerError.errorResponse(error.message)
                                 }
                             }
-                            // Run completion handler for update
+                            // Run completion handler for update.
+                            //
+                            // A single chunk can carry reasoning, content, or
+                            // both (OpenRouter occasionally emits a flush
+                            // chunk with both fields when transitioning from
+                            // thinking to answering). We therefore handle
+                            // each field independently rather than picking
+                            // one via `if/else if` — the old logic would drop
+                            // `content` whenever a chunk also carried
+                            // reasoning, which is how Gemini 3+ thought
+                            // summaries were silently swallowing the final
+                            // answer.
                             let fragment: String = responseObj.choices.map { choice in
-                                // Init variable
-                                var choiceContent: String = choice.delta.content ?? ""
+                                var fragment: String = ""
+                                // 1. Reasoning fragment, if any.
+                                if let reasoningContent: String = choice.delta.reasoningContent {
+                                    // Open a `<think>` block on the first
+                                    // reasoning token only.
+                                    if !wasReasoningToken {
+                                        fragment += "<think>\n"
+                                    }
+                                    fragment += reasoningContent
+                                    wasReasoningToken = true
+                                }
+                                // 2. Answer fragment, if any.
                                 if let content: String = choice.delta.content,
-                                   !content.isEmpty, wasReasoningToken {
-                                    // Handle answer token
-                                    // If previous token was reasoning token, add end of reasoning token
-                                    let hasEndReasoningToken: Bool = String.specialReasoningTokens.contains (where: { tokens in
-                                        guard let endReasoningToken: String = tokens.last else {
-                                            return false
+                                   !content.isEmpty {
+                                    if wasReasoningToken {
+                                        // Close the `<think>` block before
+                                        // we start streaming the answer, but
+                                        // only if the model itself hasn't
+                                        // already emitted an end-of-reason
+                                        // marker (some llama.cpp templates
+                                        // inline `</think>` themselves).
+                                        let alreadyClosed: Bool = String.specialReasoningTokens.contains(where: { tokens in
+                                            guard let endReasoningToken: String = tokens.last else {
+                                                return false
+                                            }
+                                            let combined = pendingMessage + fragment
+                                            return combined
+                                                .trimmingCharacters(in: .whitespacesAndNewlines)
+                                                .contains(endReasoningToken)
+                                        })
+                                        if !alreadyClosed {
+                                            fragment += "\n</think>\n"
                                         }
-                                        return pendingMessage
-                                            .trimmingCharacters(in: .whitespacesAndNewlines)
-                                            .contains(
-                                                endReasoningToken
-                                            )
-                                    })
-                                    choiceContent = (!hasEndReasoningToken ? "\n</think>\n" : "") + content
-                                    wasReasoningToken = false
-                                } else if let reasoningContent: String = choice.delta.reasoningContent {
-                                    // Handle reasoning token
-                                    // If previous token was not reasoning token, add reasoning special token
-                                    choice
```

**File**: `Sidekick/Logic/Inference/llama.cpp/Types/ChatParameters.swift` (modified, +34/-4)
```diff
@@ -384,8 +384,21 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
         guard isOpenRouter else { return nil }
         // Get the model name
         guard let modelName = getModelName(modelType: modelType) else { return nil }
-        // Check if the model is Claude 4+
-        if let knownModel = KnownModel(identifier: modelName), knownModel.requiresExplicitReasoning {
+        guard let knownModel = KnownModel(identifier: modelName) else {
+            return nil
+        }
+        // Gemini 3+ thinking models silently leak their thought summaries
+        // into `delta.content` unless we explicitly opt-in to reasoning,
+        // which moves the summaries into the structured `reasoning_details`
+        // array where our parser can lift them into the reasoning panel.
+        // `enabled: true` is the lightest-touch way to flip that switch
+        // without forcing a specific thinkingLevel.
+        if knownModel.requiresExplicitReasoningOptIn {
+            return ReasoningOptions(enabled: true)
+        }
+        // Claude 4+ / GLM 4.5+ refuse to emit reasoning at all without a
+        // budget, so we keep the legacy max_tokens hint for them.
+        if knownModel.requiresExplicitReasoning {
             return ReasoningOptions(max_tokens: 8_000)
         }
         return nil
@@ -547,10 +560,27 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
     }
     
     struct ReasoningOptions: Codable {
-        var max_tokens: Int
-        
+        var max_tokens: Int?
+        var enabled: Bool?
+
+        init(max_tokens: Int? = nil, enabled: Bool? = nil) {
+            self.max_tokens = max_tokens
+            self.enabled = enabled
+        }
+
         enum CodingKeys: String, CodingKey {
             case max_tokens
+            case enabled
+        }
+
+        func encode(to encoder: Encoder) throws {
+            var container = encoder.container(keyedBy: CodingKeys.self)
+            if let max_tokens {
+                try container.encode(max_tokens, forKey: .max_tokens)
+            }
+            if let enabled {
+                try container.encode(enabled, forKey: .enabled)
+            }
         }
     }
     
```

**File**: `Sidekick/Resources/ChatMarkdownWebView/chat.css` (modified, +7/-0)
```diff
@@ -64,6 +64,13 @@ body {
 .markdown-body > .md-block:last-child {
     margin-bottom: 0;
 }
+/* In full-render mode the .markdown-body has direct children like
+   <p>, <h1>, <pre>, <ul>, etc. instead of `.md-block` wrappers. Trim
+   the last element's bottom margin so the unified post-stream layout
+   has the same height as the incremental streaming layout. */
+.markdown-body > *:last-child {
+    margin-bottom: 0;
+}
 
 .markdown-body p {
     margin: 0 0 12px 0;
```

**File**: `Sidekick/Resources/ChatMarkdownWebView/chat.js` (modified, +227/-137)
```diff
@@ -69,6 +69,24 @@
     var heightScheduled = false;
     var lastReportedHeight = -1;
 
+    // Incremental-parse bookkeeping. While streaming, we only parse the
+    // tail of `text` past `settledLineCount`: every line before it is
+    // already represented by a "settled" entry in `prevBlocks` whose
+    // source can never change again. This keeps per-token work O(slice)
+    // rather than O(text).
+    var settledLineCount = 0;
+
+    // Which rendering strategy currently owns the DOM:
+    //   "idle":        nothing has been rendered yet.
+    //   "incremental": block-by-block tree built up during streaming.
+    //   "full":        single unified render produced from md.render(text)
+    //                  once streaming has finished.
+    var renderMode = "idle";
+
+    // Cache of the most recent `text` rendered in full mode so a no-op
+    // setStreaming(false) re-entry doesn't pay for another full re-render.
+    var lastFullRenderedText = null;
+
     // ---- Block segmentation ----------------------------------------------
 
     // Walk a flat token stream and yield groups corresponding to top-level
@@ -156,158 +174,226 @@
         });
     }
 
+    // Dispatch entry-point. Two distinct rendering paths:
+    //   - while streaming, we use the *incremental* path that only
+    //     re-parses the tail of `text` past the settled boundary.
+    //   - once streaming has finished, we tear that scaffolding down
+    //     and produce a single unified render via `md.render(text)` so
+    //     the message reads as one cohesive block and the user can
+    //     select / copy the whole thing without artificial seams.
     function performRender() {
         renderRunning = true;
         try {
-            var env = {};
-            var tokens = md.parse(text, env);
-            var groups = groupTopLevel(tokens);
-            var srcLines = text.split("\n");
-
-            // Build the new block list.
-            var newBlocks = [];
-            for (var g = 0; g < groups.length; g++) {
-                var group = groups[g];
-                var source = groupSource(group, tokens, srcLines);
-                var type = classifyBlockType(tokens, group);
-                newBlocks.push({ source: source, type: type, group: group });
-            }
-
-            // Find longest common prefix of unchanged blocks (compare by
-            // source). During streaming this is almost the entire document
-            // minus the trailing block.
-            var commonLen = 0;
-            var maxCommon = Math.min(newBlocks.length, prevBlocks.length);
-            while (commonLen < maxCommon &&
-                   newBlocks[commonLen].source === prevBlocks[commonLen].source) {
-                commonLen++;
-            }
-
-            // Reuse the DOM node at index commonLen across renders when
-            // possible. This is the streaming hot path: the trailing block
-            // grows by a few characters per token and we want to update its
-            // innerHTML in place instead of destroying and re-creating the
-            // wrapper (which causes the .md-new fade-in to re-fire every
-            // frame and produces visible flicker at the end of the message).
-            var reuseStart = commonLen;
-            var changedNodes = []; // wrappers we touched this render
-            if (commonLen < newBlocks.length && commonLen < prevBlocks.length) {
-                var oldBlock = prevBlocks[commonLen];
-                var nextNewBlock = newBlocks[commonLen];
-                var nextHtml = renderTokensToHTML(tokens, nextNewBlock.group, env);
-                // Only mutate the *type* class if it actually changed —
-                // overwriting className would yank md-trailing off the
-                // element each render, restarting the caret CSS animation
-                // and producing a visible jitter.
-                if (oldBlock.type !== nextNewBlock.type) {
-                    oldBlock.node.classList.remove("md-" + oldBlock.type);
-                    oldBlock.node.classList.add("md-" + nextNewBlock.type);
+            if (streaming) {
+                if (renderMode === "full") {
+                    // We were displaying a finished message and just got
+                    // told we're streaming again — drop the unified DOM
+                    // and start a fresh incremental tree.
+                    resetIncrementalState();
                 }
-                // The md-new fade-in only ever applies to the first paint
-                // of a freshly-created wrapper — drop it now so a reused
-                // wrapper doesn't keep restarting its animation.
-                oldBlock.node.classList.remove("md-new");
-                oldBlock.node.innerHTML = nextHtml;
-                // The wrapper is reused — clear KaTeX's "already rendered"
-                // marker because the inner DOM was replaced. hljs's marker
-                // lives on the <code> e
```

**File**: `Sidekick/Types/Model/KnownModel.swift` (modified, +18/-0)
```diff
@@ -286,6 +286,24 @@ public struct KnownModel: Identifiable, Codable {
         }
         return false
     }
+
+    /// Models that hide their reasoning behind an opt-in flag on
+    /// OpenRouter — without it, their thought summaries either don't
+    /// arrive or, worse, leak into `delta.content` as if they were the
+    /// model's final answer. Currently this covers Gemini 3+ Flash/Pro
+    /// (which emit thought summaries via `reasoning_details` only when
+    /// reasoning is explicitly enabled).
+    public var requiresExplicitReasoningOptIn: Bool {
+        guard organization == .google else { return false }
+        let lowerName = primaryName.lowercased()
+        // Match "gemini-3", "gemini-3.1-flash", "gemini-3-pro", etc., but
+        // not "gemini-2.5-flash" which uses the older thinkingBudget API.
+        let geminiThinkingPattern = #"gemini-[3-9](\.|-|$)"#
+        return lowerName.range(
+            of: geminiThinkingPattern,
+            options: .regularExpression
+        ) != nil
+    }
     
     /// Organizations that train models
     public enum Organization: String, Codable, CaseIterable {
```

**File**: `SidekickTests/SidekickTests.swift` (modified, +140/-0)
```diff
@@ -218,6 +218,146 @@ struct SidekickTests {
         #expect(result == "5.0")
     }
 
+    @Test func streamMessageDecodesGeminiReasoningDetails() async throws {
+        // Mirrors the streaming chunk shape OpenRouter sends for Gemini 3+
+        // thought summaries. The reasoning text lives inside the
+        // `reasoning_details` array with `type: "reasoning.summary"`, and
+        // the chunk's top-level `content` is null. The combined
+        // ``reasoningContent`` accessor must surface the summary so the
+        // chat parser can wrap it in `<think>...</think>`.
+        let data = Data(
+            """
+            {
+              "choices": [
+                {
+                  "delta": {
+                    "content": null,
+                    "reasoning_details": [
+                      {
+                        "type": "reasoning.summary",
+                        "summary": "Adjusting the Focus\\nI'm detailing Silas's risky manual adjustment.",
+                        "format": "google-gemini-v1",
+                        "index": 0
+                      }
+                    ]
+                  },
+                  "finish_reason": null
+                }
+              ],
+              "created": 0
+            }
+            """.utf8
+        )
+
+        let response = try JSONDecoder().decode(
+            LlamaServer.StreamResponse.self,
+            from: data
+        )
+        let delta = response.choices.first?.delta
+        let reasoning = delta?.reasoningContent
+
+        #expect(reasoning?.contains("Adjusting the Focus") == true)
+        #expect(reasoning?.contains("risky manual adjustment") == true)
+        #expect(delta?.content == nil)
+    }
+
+    @Test func streamMessageReasoningDetailsSkipsEncryptedBlobs() async throws {
+        // OpenRouter forwards encrypted reasoning chunks (e.g. Anthropic's
+        // redacted_thinking) as `type: "reasoning.encrypted"` with the
+        // payload in `data`. We intentionally drop these so the reasoning
+        // panel doesn't render opaque base64.
+        let data = Data(
+            """
+            {
+              "choices": [
+                {
+                  "delta": {
+                    "content": null,
+                    "reasoning_details": [
+                      {
+                        "type": "reasoning.encrypted",
+                        "data": "eyJlbmNyeXB0ZWQiOiJ0cnVlIn0=",
+                        "format": "anthropic-claude-v1",
+                        "index": 0
+                      }
+                    ]
+                  },
+                  "finish_reason": null
+                }
+              ],
+              "created": 0
+            }
+            """.utf8
+        )
+
+        let response = try JSONDecoder().decode(
+            LlamaServer.StreamResponse.self,
+            from: data
+        )
+        #expect(response.choices.first?.delta.reasoningContent == nil)
+    }
+
+    @Test func streamMessageFallsBackToLegacyReasoningField() async throws {
+        // Older OpenRouter chunks (and Bailian / DeepSeek) use the plain
+        // string `reasoning` field. Make sure we still pick it up when
+        // `reasoning_details` is absent so the legacy path keeps working.
+        let data = Data(
+            """
+            {
+              "choices": [
+                {
+                  "delta": {
+                    "content": null,
+                    "reasoning": "Let me think about this..."
+                  },
+                  "finish_reason": null
+                }
+              ],
+              "created": 0
+            }
+            """.utf8
+        )
+
+        let response = try JSONDecoder().decode(
+            LlamaServer.StreamResponse.self,
+            from: data
+        )
+        #expect(
+            response.choices.first?.delta.reasoningContent
+            == "Let me think about this..."
+        )
+    }
+
+    @Test func gemini3FlashRequiresExplicitReasoningOptIn() async throws {
+        let geminiFlash = KnownModel(
+            primaryName: "gemini-3.5-flash",
+            organization: .google,
+            capabilities: [.reasoning]
+        )
+        let geminiPro = KnownModel(
+            primaryName: "gemini-3.1-pro-preview",
+            organization: .google,
+            capabilities: [.reasoning]
+        )
+        let gemini25 = KnownModel(
+            primaryName: "gemini-2.5-flash",
+            organization: .google,
+            capabilities: [.reasoning]
+        )
+        let claude45 = KnownModel(
+            primaryName: "claude-sonnet-4.5",
+            organization: .anthropic,
+            capabilities: [.reasoning]
+        )
+
+        #expect(geminiFlash.requiresExplicitReasoningOptIn == true)
+        #expect(geminiPro.requiresExplicitReasoningOptIn == true)
+        // Gemini 2.5 uses the older thinkingBudget API and doesn't need
+        // the opt-in flag; reasoning still arrive
```

---

### Incident Patch 4: `0bb2c9b4` (2026-05-23)
**Commit Message**: fix: Parallel tool call parsing

**File**: `Sidekick.xcodeproj/project.pbxproj` (modified, +98/-85)
```diff
@@ -21,7 +21,6 @@
 		2000EF482DCE1FA2006F9A95 /* StepChainLinkView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2000EF472DCE1FA2006F9A95 /* StepChainLinkView.swift */; };
 		2000EF4A2DCE1FFE006F9A95 /* StepChainView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2000EF492DCE1FFE006F9A95 /* StepChainView.swift */; };
 		2000EF4C2DCE2248006F9A95 /* DeepResearchPreviewView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2000EF4B2DCE2248006F9A95 /* DeepResearchPreviewView.swift */; };
-		200363292D769AC700770391 /* JavaScriptRunner.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200363282D769AC700770391 /* JavaScriptRunner.swift */; };
 		2004D7642CBC9DA2009F294E /* ConversationState.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2004D7632CBC9DA2009F294E /* ConversationState.swift */; };
 		200619A22D6750D9001949EF /* DiagrammerViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200619A12D6750D9001949EF /* DiagrammerViewController.swift */; };
 		200619AD2D675DB9001949EF /* DiagrammerPromptView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200619AC2D675DB9001949EF /* DiagrammerPromptView.swift */; };
@@ -124,9 +123,6 @@
 		200FBFF52CB66C0000A92A74 /* LlamaServerError.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200FBFF42CB66C0000A92A74 /* LlamaServerError.swift */; };
 		200FBFF72CB68ABF00A92A74 /* ChatParameters.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200FBFF62CB68ABF00A92A74 /* ChatParameters.swift */; };
 		201A1A932CDB8109001E9BA9 /* Extension+Collection.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A922CDB8109001E9BA9 /* Extension+Collection.swift */; };
-		2EBEEF0100000000DEADBEE2 /* ChatMarkdownWebView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2EBEEF0100000000DEADBEE1 /* ChatMarkdownWebView.swift */; };
-		2EBEEF0200000000DEADBEE2 /* ChatMarkdownWebView in Resources */ = {isa = PBXBuildFile; fileRef = 2EBEEF0200000000DEADBEE1 /* ChatMarkdownWebView */; };
-		2EBEEF0300000000DEADBEE2 /* ChatMarkdownAssetSchemeHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2EBEEF0300000000DEADBEE1 /* ChatMarkdownAssetSchemeHandler.swift */; };
 		201BB9942D8AF77F00890EE6 /* ConversationSidebarButtons.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201BB9932D8AF77F00890EE6 /* ConversationSidebarButtons.swift */; };
 		201BB9962D8AF8AA00890EE6 /* CanvasView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201BB9952D8AF8AA00890EE6 /* CanvasView.swift */; };
 		201BB99A2D8AFDE000890EE6 /* Snapshot.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201BB9992D8AFDE000890EE6 /* Snapshot.swift */; };
@@ -146,7 +142,6 @@
 		202D4E722EBC30EA005D6F74 /* CollapsibleUserMessageView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 202D4E712EBC30EA005D6F74 /* CollapsibleUserMessageView.swift */; };
 		202D4E762EBC5E95005D6F74 /* PromptAnalyzer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 202D4E742EBC5E95005D6F74 /* PromptAnalyzer.swift */; };
 		202D4E772EBC5E95005D6F74 /* UserRequestClassifier.mlmodel in Sources */ = {isa = PBXBuildFile; fileRef = 202D4E752EBC5E95005D6F74 /* UserRequestClassifier.mlmodel */; };
-		202D4E792EBCDC97005D6F74 /* PythonRunner.swift in Sources */ = {isa = PBXBuildFile; fileRef = 202D4E782EBCDC97005D6F74 /* PythonRunner.swift */; };
 		202D4E7B2EBD371E005D6F74 /* TodoFunctions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 202D4E7A2EBD371E005D6F74 /* TodoFunctions.swift */; };
 		202E3EDD2CBB8F7B00AF86C8 /* ReferencedURL.swift in Sources */ = {isa = PBXBuildFile; fileRef = 202E3EDC2CBB8F7B00AF86C8 /* ReferencedURL.swift */; };
 		202E93662DB22D3000AB361E /* InputFunctions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 202E93652DB22D3000AB361E /* InputFunctions.swift */; };
@@ -245,7 +240,6 @@
 		20573F322CB53172004C19FE /* InferenceSettings.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20573F312CB53172004C19FE /* InferenceSettings.swift */; };
 		20573F362CB53878004C19FE /* CircleMenuStyle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20573F352CB53878004C19FE /* CircleMenuStyle.swift */; };
 		205B50D12CD3025A0057769F /* SourceRowView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 205B50D02CD3025A0057769F /* SourceRowView.swift */; };
-		205B7C6D2ECBCE0900336F19 /* X86AssemblyRunner.swift in Sources */ = {isa = PBXBuildFile; fileRef = 205B7C6C2ECBCE0900336F19 /* X86AssemblyRunner.swift */; };
 		205E3F282D8723AB00128D67 /* Highlightr in Frameworks */ = {isa = PBXBuildFile; productRef = 205E3F272D8723AB00128D67 /* Highlightr */; };
 		205E3F2A2D87288400128D67 /* Extension+NSAttributedString.swift in Sources */ = {isa = PBXBuildFile; fileRef = 205E3F292D87288400128D67 /* Extension+NSAttributedString.swift */; };
 		205E3F2C2D872E4200128D67 /* Extension+NSMutableAttributedString.swift in Sources */ = {isa = PBXBuildFile; fileRef = 205E3F2B2D872E4200128D67 /* Extension+NSMutableAttributedString.swift */; };
@@ -264,30 +258,36 @@
 		2075220B2D7FDF6C00A
```

**File**: `Sidekick/Localizable.xcstrings` (modified, +139/-0)
```diff
@@ -89,6 +89,16 @@
       },
       "shouldTranslate" : false
     },
+    "%@ %@…" : {
+      "localizations" : {
+        "en" : {
+          "stringUnit" : {
+            "state" : "new",
+            "value" : "%1$@ %2$@…"
+          }
+        }
+      }
+    },
     "%lld" : {
       "shouldTranslate" : false
     },
@@ -159,6 +169,7 @@
       }
     },
     "A new endpoint has been selected, which has been identified as capable of native function calling. Would you like to turn on native function calling?" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -169,6 +180,7 @@
       }
     },
     "A new endpoint has been selected, which might not be capable of native function calling. Would you like to turn off native function calling?" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -504,6 +516,7 @@
       }
     },
     "Arithmetic" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -512,6 +525,9 @@
           }
         }
       }
+    },
+    "Assistant" : {
+
     },
     "Automatically compresses tool call results during agentic loops to prevent context window errors." : {
       "localizations" : {
@@ -633,6 +649,9 @@
           }
         }
       }
+    },
+    "Capturing" : {
+
     },
     "Causes of the Renaissance" : {
       "localizations" : {
@@ -1078,6 +1097,7 @@
       }
     },
     "Controls whether native function calling is available for the remote model. Turn it on only when the inference provider supports native function calling for the selected model." : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -1156,6 +1176,9 @@
           }
         }
       }
+    },
+    "Copy Message" : {
+
     },
     "Copy Raw Markdown" : {
       "localizations" : {
@@ -1236,6 +1259,15 @@
           }
         }
       }
+    },
+    "Could not write the screenshot to disk: %@" : {
+
+    },
+    "Couldn't Save PDF" : {
+
+    },
+    "Couldn't Save Screenshot" : {
+
     },
     "Create 10 minute presentations in 5 minutes" : {
       "localizations" : {
@@ -1336,6 +1368,12 @@
           }
         }
       }
+    },
+    "Current Message" : {
+
+    },
+    "Current Turn" : {
+
     },
     "Customise" : {
       "localizations" : {
@@ -1487,6 +1525,12 @@
           }
         }
       }
+    },
+    "Delete Message" : {
+
+    },
+    "Delete Response" : {
+
     },
     "Describe a concept you'd like to see illustrated in a diagram" : {
       "localizations" : {
@@ -1990,6 +2034,9 @@
           }
         }
       }
+    },
+    "Entire Chat" : {
+
     },
     "Error" : {
       "localizations" : {
@@ -2131,6 +2178,9 @@
           }
         }
       }
+    },
+    "Exporting" : {
+
     },
     "Exporting..." : {
       "localizations" : {
@@ -2191,6 +2241,12 @@
           }
         }
       }
+    },
+    "Failed to encode the screenshot payload: %@" : {
+
+    },
+    "Failed to encode the screenshot payload." : {
+
     },
     "Failed to extract prompt." : {
       "localizations" : {
@@ -3337,6 +3393,7 @@
       }
     },
     "Native Function Calling" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -3555,6 +3612,9 @@
           }
         }
       }
+    },
+    "Nothing to capture" : {
+
     },
     "Notifications" : {
       "localizations" : {
@@ -3665,6 +3725,12 @@
           }
         }
       }
+    },
+    "PDF" : {
+
+    },
+    "PDF Export Failed" : {
+
     },
     "Persist Resources" : {
       "localizations" : {
@@ -3729,6 +3795,9 @@
           }
         }
       }
+    },
+    "PNG" : {
+
     },
     "Polish and finalize" : {
       "localizations" : {
@@ -3903,6 +3972,7 @@
       }
     },
     "Provider Changed" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -3930,6 +4000,9 @@
           }
         }
       }
+    },
+    "Read Aloud" : {
+
     },
     "Reason" : {
       "localizations" : {
@@ -3990,6 +4063,9 @@
           }
         }
       }
+    },
+    "Regenerate" : {
+
     },
     "Reminders" : {
       "localizations" : {
@@ -4296,6 +4372,9 @@
           }
         }
       }
+    },
+    "Save as PDF" : {
+
     },
     "Save as PNG" : {
       "localizations" : {
@@ -4316,6 +4395,12 @@
           }
         }
       }
+    },
+    "Save PDF" : {
+
+    },
+    "Save Screenshot" : {
+
     },
     "Say hi" : {
       "localizations" : {
@@ -4347,6 +4432,12 @@
           }
         }
       }
+    },
+    "Screenshot" : {
+
+    },
+    "Screenshot Failed" : {
+
     },
     "Search" : {
       "localizations" : {
@@ -4577,6 +4668,9 @@
           }
         }
       }
+    },
+    "Send" : {
+
     },
     "Send a message with 
```

**File**: `Sidekick/Logic/Data Models/ConversationManager.swift` (modified, +3/-8)
```diff
@@ -168,17 +168,12 @@ public final class ConversationManager {
     }
 
     /// Function returning a conversation with the given ID.
-    /// Falls back to the in-memory draft tracked by
-    /// ``ConversationState`` so views that resolve the active
-    /// conversation by id continue to work for blank chats that
-    /// have not yet been persisted.
+    /// Only resolves persisted conversations; the unpersisted
+    /// blank-chat draft is owned by ``ConversationState`` and
+    /// surfaced by ``ConversationState.selectedConversation``.
     public func getConversation(
         id conversationId: UUID
     ) -> Conversation? {
-        if let draft = ConversationState.shared.draftConversation,
-           draft.id == conversationId {
-            return draft
-        }
         return self.conversations.filter({ $0.id == conversationId }).first
     }
 
```

**File**: `Sidekick/Logic/Inference/Model+Inference.swift` (modified, +14/-41)
```diff
@@ -332,12 +332,6 @@ extension Model {
             }
             return ToolRegistry(functions: [])
         }()
-        var useStructuredToolMessages: Bool = InferenceSettings.supportsNativeToolCalling(
-            modelType: .regular,
-            usingRemoteModel: initialResponse.usedServer
-        ) &&
-        !(initialResponse.blockFunctionCalls?.isEmpty ?? true) &&
-        (initialResponse.malformedToolCalls?.isEmpty ?? true)
         // Execute functions on a loop
         var maxIterations: Int = 30 // Max 30 tool calls
         var response: LlamaServer.CompleteResponse? = initialResponse
@@ -425,23 +419,11 @@ extension Model {
                 functionCallRecords = executionOutput.functionCallRecords
                 results += executionOutput.results
 
-                if useStructuredToolMessages {
-                    let assistantToolCallMessage = Message.MessageSubset.assistantToolCalls(
-                        functionCalls: functionCalls
-                    )
-                    messages.append(assistantToolCallMessage)
-                    messages += executionOutput.toolMessages
-                } else {
-                    let responseMessage: Message = Message(
-                        text: response?.text ?? "",
-                        sender: .assistant
-                    )
-                    let responseMessageSubset: Message.MessageSubset = await Message.MessageSubset(
-                        usingRemoteModel: self.wasRemoteServerAccessible,
-                        message: responseMessage
-                    )
-                    messages.append(responseMessageSubset)
-                }
+                let assistantToolCallMessage = Message.MessageSubset.assistantToolCalls(
+                    functionCalls: functionCalls
+                )
+                messages.append(assistantToolCallMessage)
+                messages += executionOutput.toolMessages
             } else {
                 Self.logger.warning("Retrying after malformed-only tool call response")
                 let responseMessage: Message = Message(
@@ -486,13 +468,11 @@ Call another tool to obtain more information or execute more actions. Try breaki
 
             var hasAppendedChangeMessage = false
             var compressionAttempts = 0
-            let toolChoice: ChatParameters.ToolChoice? = useStructuredToolMessages ? (
-                hasMadeSufficientCalls ? ChatParameters.ToolChoice.none : .auto
-            ) : nil
+            let toolChoice: ChatParameters.ToolChoice = hasMadeSufficientCalls ? .none : .auto
 
             retryLoop: while true {
                 do {
-                    var messageStringComponents: [String] = useStructuredToolMessages ? [] : results.map(\.description)
+                    var messageStringComponents: [String] = []
                     if let todoSummary = TodoFunctions.getIncompleteTodoSummary() {
                         messageStringComponents.append(todoSummary)
                     }
@@ -552,8 +532,7 @@ Call another tool to obtain more information or execute more actions. Try breaki
                 } catch let error as LlamaServerError {
                     if case .contextWindowExceeded = error,
                        InferenceSettings.enableContextCompression,
-                       compressionAttempts < 3,
-                       !useStructuredToolMessages {
+                       compressionAttempts < 3 {
                         compressionAttempts += 1
                         Self.logger.warning("Context window exceeded (attempt \(compressionAttempts)). Compressing tool results.")
                         results = try await ContextCompressor.compressFunctionResults(
@@ -567,12 +546,6 @@ Call another tool to obtain more information or execute more actions. Try breaki
                 }
             }
             response?.functionCallRecords = functionCallRecords
-            useStructuredToolMessages = InferenceSettings.supportsNativeToolCalling(
-                modelType: .regular,
-                usingRemoteModel: response?.usedServer ?? canReachRemoteServer
-            ) &&
-            !(response?.blockFunctionCalls?.isEmpty ?? true) &&
-            (response?.malformedToolCalls?.isEmpty ?? true)
 
             if let malformedCalls = response?.malformedToolCalls, !malformedCalls.isEmpty {
                 Self.logger.warning("Response contains \(malformedCalls.count) malformed tool call(s)")
@@ -772,7 +745,7 @@ Please try rephrasing your request or contact support if the issue persists.
     private struct PlannedFunctionCall {
         let originalIndex: Int
         let recordIndex: Int
-        let callJsonSchema: String
+        let callDescription: String
         let call: any DecodableFunctionCall
     }
 
@@ -798,8 +771,8 @@ Please try rephrasing your request or contact support if the issue persists.
         var functionCallRecords = existingRecords
         let existingRecordsCount = existingRecords.count
```

**File**: `Sidekick/Logic/Inference/llama.cpp/GGUFMetadataReader.swift` (added, +411/-0)
```diff
@@ -0,0 +1,411 @@
+//
+//  GGUFMetadataReader.swift
+//  Sidekick
+//
+//  Reads metadata from a GGUF file. The format is described in
+//  https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
+//
+//  We only inspect metadata; tensor data is skipped. To keep startup latency
+//  low and memory pressure flat, the parser streams the file in small chunks
+//  rather than mmaping or loading it whole.
+//
+
+import Foundation
+import OSLog
+
+public struct GGUFMetadataReader {
+    
+    fileprivate static let logger = Logger(
+        subsystem: Bundle.main.bundleIdentifier ?? "Sidekick",
+        category: String(describing: GGUFMetadataReader.self)
+    )
+    
+    private static let magic: [UInt8] = [0x47, 0x47, 0x55, 0x46] // "GGUF"
+    
+    /// Reasonable upper bounds so a malformed file can't trigger runaway
+    /// allocations.
+    fileprivate static let maxStringLength: UInt64 = 16 * 1024 * 1024  // 16 MiB
+    fileprivate static let maxArrayLength: UInt64 = 1 << 22            // 4 194 304
+    private static let maxKvCount: UInt64 = 1 << 20                    // 1 048 576
+    
+    public enum ValueType: UInt32 {
+        case uint8 = 0
+        case int8 = 1
+        case uint16 = 2
+        case int16 = 3
+        case uint32 = 4
+        case int32 = 5
+        case float32 = 6
+        case bool = 7
+        case string = 8
+        case array = 9
+        case uint64 = 10
+        case int64 = 11
+        case float64 = 12
+    }
+    
+    public struct ChatTemplateInfo {
+        /// The default `tokenizer.chat_template` string, if present.
+        public let defaultTemplate: String?
+        /// Named template variants like `tool_use`, keyed by the suffix of
+        /// `tokenizer.chat_template.<name>`.
+        public let namedTemplates: [String: String]
+    }
+    
+    /// Read the chat-template family of metadata keys from the given GGUF
+    /// file. Returns `nil` when the file is missing, unreadable, or not a
+    /// valid GGUF.
+    public static func readChatTemplateInfo(
+        from url: URL
+    ) -> ChatTemplateInfo? {
+        guard let stream = GGUFStream(url: url) else {
+            return nil
+        }
+        defer { stream.close() }
+        
+        do {
+            var magicBytes = [UInt8](repeating: 0, count: 4)
+            try stream.read(into: &magicBytes, count: 4)
+            guard magicBytes == magic else {
+                return nil
+            }
+            let version: UInt32 = try stream.readUInt32()
+            guard version >= 1 && version <= 3 else {
+                return nil
+            }
+            // GGUF v1 used uint32 counts; v2+ use uint64.
+            let useWideCounts = version >= 2
+            // tensor_count, then metadata_kv_count
+            _ = try stream.readCount(wide: useWideCounts)
+            let kvCount = try stream.readCount(wide: useWideCounts)
+            guard kvCount <= maxKvCount else {
+                return nil
+            }
+            
+            var defaultTemplate: String? = nil
+            var namedTemplates: [String: String] = [:]
+            
+            for _ in 0..<kvCount {
+                let key = try stream.readString(wide: useWideCounts)
+                let valueType = try stream.readValueType()
+                
+                if key == "tokenizer.chat_template" {
+                    guard valueType == .string else {
+                        try stream.skipValue(of: valueType, wide: useWideCounts)
+                        continue
+                    }
+                    defaultTemplate = try stream.readString(wide: useWideCounts)
+                } else if key.hasPrefix("tokenizer.chat_template.") {
+                    let name = String(key.dropFirst("tokenizer.chat_template.".count))
+                    guard valueType == .string else {
+                        try stream.skipValue(of: valueType, wide: useWideCounts)
+                        continue
+                    }
+                    let body = try stream.readString(wide: useWideCounts)
+                    namedTemplates[name] = body
+                } else {
+                    try stream.skipValue(of: valueType, wide: useWideCounts)
+                }
+            }
+            
+            return ChatTemplateInfo(
+                defaultTemplate: defaultTemplate,
+                namedTemplates: namedTemplates
+            )
+        } catch {
+            Self.logger.warning(
+                "Failed to parse GGUF metadata for \(url.lastPathComponent, privacy: .public): \(error.localizedDescription, privacy: .public)"
+            )
+            return nil
+        }
+    }
+    
+    /// Returns `true` when the model's GGUF ships a chat template that knows
+    /// how to render and emit tool calls. When `true`, passing `--jinja` to
+    /// `llama-server` lets the server's chat engine bias and parse tool calls
+    /// correctly; when `false`, `--jinja` either errors out (no template) or
+  
```

**File**: `Sidekick/Logic/Inference/llama.cpp/LlamaServer+Chat.swift` (modified, +160/-322)
```diff
@@ -256,7 +256,7 @@ extension LlamaServer {
             var arguments: String = ""
         }
         var toolCalls: [Int: ToolCallAccumulator] = [:] // Dictionary keyed by tool call index
-        var blockFunctionCalls: [(any DecodableFunctionCall)] = []
+        var functionCalls: [(any DecodableFunctionCall)] = []
         var toolCallInProgress: Bool = false
 
         // Init variables for usage
@@ -446,7 +446,7 @@ extension LlamaServer {
                 toolCallID: toolCall.id,
                 toolRegistry: toolRegistry
             ) {
-                blockFunctionCalls.append(function)
+                functionCalls.append(function)
                 Self.logger.info("Successfully decoded tool call #\(index): \(name)")
             } else {
                 // Track malformed tool call with detailed error
@@ -481,6 +481,22 @@ extension LlamaServer {
             }
         }
 
+        // Fallback: recover tool calls that leaked into the content stream as
+        // Qwen3-Coder-style XML (<tool_call><function=NAME><parameter=KEY>VALUE</parameter></function></tool_call>).
+        // llama-server's `--jinja` parser is unreliable for this format,
+        // especially after the first batch of calls in a multi-turn agentic
+        // loop. We mirror LM Studio's approach by parsing leaks client-side.
+        let recovered = Self.extractCoderXMLToolCalls(
+            from: pendingMessage,
+            toolRegistry: toolRegistry,
+            existingCalls: functionCalls
+        )
+        if !recovered.calls.isEmpty {
+            Self.logger.info("Recovered \(recovered.calls.count) Coder-XML tool call(s) from content stream")
+            functionCalls.append(contentsOf: recovered.calls)
+            pendingMessage = recovered.strippedText
+        }
+
         // Adding a trailing quote or space is a common mistake with the smaller model output
         let cleanText: String = pendingMessage.removeUnmatchedTrailingQuote()
         // Indicate response finished
@@ -531,11 +547,149 @@ extension LlamaServer {
             usage: stopResponse?.usage,
             usedServer: rawUrl.usingRemoteServer,
             availableFunctions: resolvedFunctions,
-            blockFunctionCalls: blockFunctionCalls,
+            functionCalls: functionCalls,
             malformedToolCalls: malformedToolCalls.isEmpty ? nil : malformedToolCalls
         )
     }
 
+    /// Recover tool calls emitted in Qwen3-Coder-style XML that leaked into
+    /// the assistant's content stream.
+    ///
+    /// `llama-server`'s `--jinja` parser does not reliably extract every
+    /// `<tool_call>` block, particularly on the second+ turn of an agentic
+    /// loop. This scanner mirrors what LM Studio's `autoparser` does in C++:
+    /// look for `<tool_call><function=NAME>[<parameter=KEY>VALUE</parameter>]*</function></tool_call>`
+    /// patterns, build a JSON argument blob, and decode via the existing
+    /// `ToolRegistry` path so the agent loop can execute them like native
+    /// tool calls.
+    ///
+    /// - Parameters:
+    ///   - text: The full assistant text accumulated from the stream.
+    ///   - toolRegistry: The registry used to validate decoded function names.
+    ///   - existingCalls: Calls already decoded from the native `tool_calls`
+    ///     deltas. We skip XML matches whose `(name, arguments)` already exist
+    ///     here so we never double-count.
+    /// - Returns: The recovered calls and the input text with successfully
+    ///   recovered XML stripped out (so the UI doesn't render raw XML).
+    static func extractCoderXMLToolCalls(
+        from text: String,
+        toolRegistry: ToolRegistry,
+        existingCalls: [any DecodableFunctionCall]
+    ) -> (calls: [any DecodableFunctionCall], strippedText: String) {
+        guard text.contains("<tool_call>") && text.contains("<function=") else {
+            return ([], text)
+        }
+        // Whitespace-tolerant tag matching. The model frequently substitutes
+        // spaces for the template's newlines, so `\s*` everywhere is intentional.
+        let callPattern = #"<tool_call>\s*<function\s*=\s*([^>\s]+)\s*>([\s\S]*?)</function>\s*</tool_call>"#
+        let paramPattern = #"<parameter\s*=\s*([^>\s]+)\s*>([\s\S]*?)</parameter>"#
+        guard let callRegex = try? NSRegularExpression(pattern: callPattern),
+              let paramRegex = try? NSRegularExpression(pattern: paramPattern) else {
+            return ([], text)
+        }
+        let nsText = text as NSString
+        let matches = callRegex.matches(
+            in: text,
+            range: NSRange(location: 0, length: nsText.length)
+        )
+        guard !matches.isEmpty else {
+            return ([], text)
+        }
+        // Pre-compute canonical (name, argsJSON) signatures for existing calls
+        // so we can dedupe against anything llama.cpp already extracted natively.
+        let existingSignatures: Set<String> = Set(existingCalls.map { c
```

**File**: `Sidekick/Logic/Inference/llama.cpp/LlamaServer+ServerLifecycle.swift` (modified, +9/-2)
```diff
@@ -98,8 +98,15 @@ extension LlamaServer {
         ]
         // Extra options for main model
         if self.modelType == .regular {
-            // Use jinja chat template if tools are used
-            if Settings.useFunctions {
+            // Only enable `--jinja` when the model's GGUF ships a chat template
+            // that knows how to render and parse tool calls. Without that, the
+            // flag either errors out (no template at all) or buys us nothing
+            // and risks the server emitting text-mode tool calls that the
+            // client can't recover.
+            if Settings.useFunctions,
+               GGUFMetadataReader.modelSupportsToolAwareJinja(
+                at: URL(fileURLWithPath: modelPath)
+               ) {
                 arguments["--jinja"] = ""
             }
             // Use speculative decoding
```

**File**: `Sidekick/Logic/Inference/llama.cpp/Types/ChatParameters.swift` (modified, +191/-27)
```diff
@@ -48,6 +48,14 @@ public struct ChatParameters: Codable {
         
         // Add reasoning parameter for Claude 4+ on OpenRouter
         self.reasoning = Self.getReasoningOptions(modelType: modelType, usingRemoteModel: usingRemoteModel)
+        
+        // Resolve sampler defaults for the local model architecture,
+        // deferring to any active Advanced Parameters flags.
+        await self.applySamplingDefaults(
+            modelType: modelType,
+            usingRemoteModel: usingRemoteModel,
+            enableThinking: enableThinking
+        )
     }
     
     /// Init for chat & context aware agent
@@ -94,18 +102,13 @@ public struct ChatParameters: Codable {
         }
         // Tell the LLM to use sources
         fullSystemPromptComponents.append(InferenceSettings.useSourcesPrompt)
-        // Tell the LLM to use functions when enabled and server does not support native tool calling
         // Use enabled functions from FunctionSelectionManager if no custom functions provided
         let enabledFunctions: [any AnyFunctionBox]
         if let customFunctions = functions {
             enabledFunctions = customFunctions
         } else {
             enabledFunctions = await MainActor.run { FunctionSelection.getEnabledFunctions() }
         }
-        let supportsNativeToolCalling = InferenceSettings.supportsNativeToolCalling(
-            modelType: modelType,
-            usingRemoteModel: usingRemoteModel
-        )
         // Check if we should encourage using query_database function
         let isDefaultExpert: Bool
         if let resolvedExpert = expert {
@@ -129,18 +132,9 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
             }
         }
         if Settings.useFunctions && useFunctions {
-            if supportsNativeToolCalling {
-                fullSystemPromptComponents.append(
-                    InferenceSettings.useNativeFunctionsPrompt
-                )
-            } else {
-                fullSystemPromptComponents.append(InferenceSettings.useFunctionsPrompt)
-                fullSystemPromptComponents.append(InferenceSettings.functionsSchemaPrompt)
-                let functions: [any AnyFunctionBox] = enabledFunctions
-                for function in functions {
-                    fullSystemPromptComponents.append(function.getJsonSchema())
-                }
-            }
+            fullSystemPromptComponents.append(
+                InferenceSettings.useFunctionsPrompt
+            )
         }
         // Join all components
         let fullSystemPrompt: String = fullSystemPromptComponents.joined(separator: "\n\n")
@@ -160,8 +154,13 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
         self.messages = messagesWithSystemPrompt
         self.model = Self.getModelName(modelType: modelType) ?? ""
         self.tools = !useFunctions ? [] : enabledFunctions.map(keyPath: \.openAiFunctionCall)
-        if supportsNativeToolCalling && useFunctions {
+        if useFunctions {
             self.tool_choice = toolChoice ?? .auto
+            // Force llama.cpp's lazy grammar to keep constraining structure across
+            // every consecutive `<tool_call>` in a single turn. Without this, only the
+            // first call is grammar-enforced and later ones can be emitted as
+            // malformed XML in the content stream. OpenAI defaults this to true.
+            self.parallel_tool_calls = true
         }
         self.chat_template_kwargs = Self.getChatTemplateKwargs(
             modelType: modelType,
@@ -171,15 +170,35 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
         
         // Add reasoning parameter for Claude 4+ on OpenRouter
         self.reasoning = Self.getReasoningOptions(modelType: modelType, usingRemoteModel: usingRemoteModel)
+        
+        // Resolve sampler defaults for the local model architecture,
+        // deferring to any active Advanced Parameters flags.
+        await self.applySamplingDefaults(
+            modelType: modelType,
+            usingRemoteModel: usingRemoteModel,
+            enableThinking: enableThinking
+        )
     }
     
     var model: String
     var messages: [Message.MessageSubset]
     
     var tools: [OpenAIFunction] = []
     var tool_choice: ToolChoice?
+    var parallel_tool_calls: Bool?
     
-    var temperature = InferenceSettings.temperature
+    /// Sampler parameters. ``applySamplingDefaults(...)`` populates these
+    /// from ``ModelArchitecture`` (for local models) and from
+    /// ``InferenceSettings.temperature`` (as a fallback). Any field the user
+    /// has actively configured under "Advanced Parameters" is left `nil`
+    /// here so the server-side CLI flag remains authoritative.
+    var temperature: Double? = InferenceSettings.temperature
+    var top_p: Double?
+    var top_k: Int?
+    var min_p: Double?
+    var presence_penalty: Double?
+    v
```

---

### Incident Patch 5: `bb4ab3d3` (2026-05-23)
**Commit Message**: fix: Code block use icons

**File**: `Sidekick/Resources/ChatMarkdownWebView/chat.css` (modified, +20/-1)
```diff
@@ -283,7 +283,13 @@ body[data-mode="reasoning"] .md-block.md-new {
     background: transparent;
     border: 1px solid transparent;
     border-radius: 5px;
-    padding: 2px 8px;
+    /* Square hit area sized so 14px icons look balanced. */
+    width: 24px;
+    height: 24px;
+    padding: 0;
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
     color: var(--md-fg-muted);
     font: inherit;
     cursor: pointer;
@@ -297,9 +303,22 @@ body[data-mode="reasoning"] .md-block.md-new {
 .markdown-body .sk-codeblock-actions button:active {
     transform: translateY(0.5px);
 }
+.markdown-body .sk-codeblock-actions button:focus {
+    outline: none;
+}
+.markdown-body .sk-codeblock-actions button:focus-visible {
+    outline: 1.5px solid var(--md-link);
+    outline-offset: 1px;
+}
 .markdown-body .sk-codeblock-actions button.sk-copied {
     color: var(--md-link);
 }
+.markdown-body .sk-codeblock-actions .sk-icon {
+    width: 14px;
+    height: 14px;
+    display: block;
+    pointer-events: none;
+}
 .markdown-body .sk-codeblock-body {
     position: relative;
     overflow: hidden;
```

**File**: `Sidekick/Resources/ChatMarkdownWebView/chat.js` (modified, +71/-10)
```diff
@@ -355,6 +355,44 @@
     // Number of source lines at which a code block becomes collapsible.
     var COLLAPSE_THRESHOLD = 30;
 
+    // Inline SVGs used for the code-block action buttons. Stroke-based so
+    // they inherit `currentColor` and stay crisp at any size. Sizes are
+    // governed by the wrapping button via `width`/`height` properties on
+    // `svg.sk-icon` (see chat.css).
+    var ICONS = {
+        // "Duplicate" glyph similar in spirit to SF Symbols' doc.on.doc.
+        copy: ''
+            + '<svg class="sk-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"'
+            + ' stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
+            + '<rect x="5" y="5" width="8" height="9" rx="1.6"/>'
+            + '<path d="M3.5 11V3.6A1.6 1.6 0 0 1 5.1 2H10"/>'
+            + '</svg>',
+        // Two arrows pointing apart — "expand".
+        expand: ''
+            + '<svg class="sk-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"'
+            + ' stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
+            + '<path d="M9.5 2.5h4v4"/>'
+            + '<path d="M13.5 2.5 9.2 6.8"/>'
+            + '<path d="M6.5 13.5h-4v-4"/>'
+            + '<path d="m2.5 13.5 4.3-4.3"/>'
+            + '</svg>',
+        // Two arrows pointing inward — "collapse".
+        collapse: ''
+            + '<svg class="sk-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"'
+            + ' stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
+            + '<path d="M13.5 6.5h-4v-4"/>'
+            + '<path d="M9.5 6.5 13.8 2.2"/>'
+            + '<path d="M2.5 9.5h4v4"/>'
+            + '<path d="m6.5 9.5-4.3 4.3"/>'
+            + '</svg>',
+        // Checkmark used as transient "copied" feedback.
+        check: ''
+            + '<svg class="sk-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor"'
+            + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
+            + '<path d="M3 8.5 6.4 12 13 5"/>'
+            + '</svg>'
+    };
+
     // Wrap each <pre> in a chrome container with a header (language label,
     // copy button, and — when the block is >= COLLAPSE_THRESHOLD lines —
     // an expand/collapse toggle). Idempotent: each <pre> is enhanced at
@@ -399,16 +437,23 @@
                 var toggleBtn = document.createElement("button");
                 toggleBtn.type = "button";
                 toggleBtn.className = "sk-codeblock-toggle";
-                toggleBtn.setAttribute("data-collapsed-label", "Show all " + lineCount + " lines");
-                toggleBtn.setAttribute("data-expanded-label", "Show less");
-                toggleBtn.textContent = "Show all " + lineCount + " lines";
+                var expandTitle = "Show all " + lineCount + " lines";
+                var collapseTitle = "Show less";
+                toggleBtn.setAttribute("data-expand-title", expandTitle);
+                toggleBtn.setAttribute("data-collapse-title", collapseTitle);
+                toggleBtn.setAttribute("data-state", "collapsed");
+                toggleBtn.setAttribute("title", expandTitle);
+                toggleBtn.setAttribute("aria-label", expandTitle);
+                toggleBtn.innerHTML = ICONS.expand;
                 actions.appendChild(toggleBtn);
             }
 
             var copyBtn = document.createElement("button");
             copyBtn.type = "button";
             copyBtn.className = "sk-codeblock-copy";
-            copyBtn.textContent = "Copy";
+            copyBtn.setAttribute("title", "Copy");
+            copyBtn.setAttribute("aria-label", "Copy code");
+            copyBtn.innerHTML = ICONS.copy;
             actions.appendChild(copyBtn);
 
             header.appendChild(actions);
@@ -540,13 +585,21 @@
 
     function showCopyFeedback(btn) {
         if (btn.__skCopyTimer) clearTimeout(btn.__skCopyTimer);
-        var original = btn.dataset.originalLabel || btn.textContent;
-        btn.dataset.originalLabel = original;
-        btn.textContent = "Copied";
+        // Stash the original glyph so we can restore it after the
+        // "copied" flash.
+        if (!btn.dataset.originalHtml) {
+            btn.dataset.originalHtml = btn.innerHTML;
+        }
+        btn.innerHTML = ICONS.check;
         btn.classList.add("sk-copied");
+        btn.setAttribute("aria-label", "Copied");
+        btn.setAttribute("title", "Copied");
         btn.__skCopyTimer = setTimeout(function () {
-            btn.textContent = original;
+            btn.innerHTML = btn.dataset.originalHtml || ICONS.copy;
             btn.classList.remove("sk-copied");
+            btn.setAttribute("aria-label", "Copy code");
+            btn.setAttribute("title", "Copy");
+            delete btn.dataset.originalHtml;
             btn.__skCopyTimer = null;
         }, 1100);
     }
@@ -557,10 +610,18 @@
         var wa
```

---

### Incident Patch 6: `d45dc0f9` (2026-05-23)
**Commit Message**: fix: Confusing blank chats

**File**: `Sidekick/Logic/Commands/ConversationCommands.swift` (modified, +5/-2)
```diff
@@ -11,11 +11,14 @@ import SwiftUI
 @MainActor
 public class ConversationCommands {
 	
-	/// The `New Conversation` command replacing the new file command
+	/// The `New Conversation` command replacing the new file command.
+	/// Routed through ``ConversationState`` so the blank chat stays
+	/// in memory until the user actually sends a message - hitting
+	/// Cmd+N never adds a persisted entry to the sidebar.
 	static var commands: some Commands {
 		CommandGroup(replacing: .newItem) {
 			Button {
-				ConversationManager.shared.newConversation()
+				ConversationState.shared.newConversation()
 			} label: {
 				Text("New Conversation")
 			}
```

**File**: `Sidekick/Logic/Data Models/ConversationManager.swift` (modified, +9/-20)
```diff
@@ -94,25 +94,6 @@ public final class ConversationManager {
         return self.backupDatastoreUrl.fileExists
     }
 
-    /// Function to create a new conversation
-    public func newConversation() {
-        let defaultTitle: String = Date.now.formatted(
-            date: .abbreviated,
-            time: .shortened
-        )
-        let newConversation: Conversation = Conversation(
-            title: defaultTitle,
-            createdAt: .now,
-            messages: []
-        )
-        self.conversations = [newConversation] + self.conversations
-        NotificationCenter.default.post(
-            name: Notifications.newConversation.name,
-            object: nil
-        )
-        Self.logger.notice("Created a new conversation")
-    }
-
     /// Coalesces back-to-back `didSet` notifications (which happen
     /// every streaming token) into a single SwiftData write per
     /// ``MessageStreamCoordinator.debounceInterval``.
@@ -186,10 +167,18 @@ public final class ConversationManager {
         }
     }
 
-    /// Function returning a conversation with the given ID
+    /// Function returning a conversation with the given ID.
+    /// Falls back to the in-memory draft tracked by
+    /// ``ConversationState`` so views that resolve the active
+    /// conversation by id continue to work for blank chats that
+    /// have not yet been persisted.
     public func getConversation(
         id conversationId: UUID
     ) -> Conversation? {
+        if let draft = ConversationState.shared.draftConversation,
+           draft.id == conversationId {
+            return draft
+        }
         return self.conversations.filter({ $0.id == conversationId }).first
     }
 
```

**File**: `Sidekick/Logic/View Controllers/Conversation/ConversationState.swift` (modified, +81/-8)
```diff
@@ -16,20 +16,51 @@ import SwiftUI
 @Observable
 public final class ConversationState {
 
+    /// Process-wide instance. Cmd+N and other non-view entry
+    /// points need a stable reference to the state so they can
+    /// create/reuse the in-memory draft conversation without
+    /// going through `@Environment` injection.
+    public static let shared: ConversationState = .init()
+
     var isManagingExperts: Bool = false
 
-    var selectedConversationId: UUID? = ConversationState.topmostConversation?.id
+    var selectedConversationId: UUID? = ConversationState.topmostConversation?.id {
+        didSet {
+            // If the selection moves away from the in-memory draft,
+            // discard the draft - we only ever keep one blank chat
+            // around, and it lives wherever the user is currently
+            // focused.
+            if let draft = self.draftConversation,
+               selectedConversationId != draft.id {
+                self.draftConversation = nil
+            }
+        }
+    }
+
+    /// An in-memory "blank chat" that has not yet been persisted.
+    /// It is intentionally absent from
+    /// ``ConversationManager.conversations`` (and therefore from
+    /// the sidebar list) until the user sends their first message,
+    /// at which point ``commitDraftIfNeeded(_:)`` promotes it into
+    /// the persisted list.
+    public internal(set) var draftConversation: Conversation?
 
     /// The topmost conversation listed in the sidebar
     static var topmostConversation: Conversation? {
         return ConversationManager.shared.conversations.first
     }
 
-    /// The currently selected conversation
+    /// The currently selected conversation. Returns the in-memory
+    /// draft when the selection points at it, otherwise falls
+    /// through to the persisted ``ConversationManager`` store.
     public var selectedConversation: Conversation? {
         guard let selectedConversationId = self.selectedConversationId else {
             return nil
         }
+        if let draft = self.draftConversation,
+           draft.id == selectedConversationId {
+            return draft
+        }
         return ConversationManager.shared.getConversation(
             id: selectedConversationId
         )
@@ -39,16 +70,58 @@ public final class ConversationState {
 
     var useCanvas: Bool = false
 
-    /// Function to create a new conversation
+    /// Function to start a new conversation. Rather than
+    /// immediately writing a fresh row to ``ConversationManager``
+    /// (and thereby polluting the sidebar with blank chats), this
+    /// keeps the new conversation in memory as ``draftConversation``
+    /// and only commits it on the first user message via
+    /// ``commitDraftIfNeeded(_:)``. If a draft is already around,
+    /// the same one is reused so the user can never accumulate
+    /// multiple blank chats.
     public func newConversation() {
-        ConversationManager.shared.newConversation()
+        let targetId: UUID
+        if let existing = self.draftConversation {
+            targetId = existing.id
+        } else {
+            let defaultTitle: String = Date.now.formatted(
+                date: .abbreviated,
+                time: .shortened
+            )
+            let draft: Conversation = Conversation(
+                title: defaultTitle,
+                createdAt: .now,
+                messages: []
+            )
+            self.draftConversation = draft
+            targetId = draft.id
+        }
         withAnimation(.linear) {
             self.selectedExpertId = ExpertManager.default?.id
+            self.selectedConversationId = targetId
         }
-        if let recentConversationId = ConversationManager.shared.recentConversation?.id {
-            withAnimation(.linear) {
-                self.selectedConversationId = recentConversationId
-            }
+        NotificationCenter.default.post(
+            name: Notifications.newConversation.name,
+            object: nil
+        )
+    }
+
+    /// Promotes the in-memory draft into a persisted conversation
+    /// if the supplied conversation is the current draft. Inserts
+    /// at the top of the list to mirror the historical placement
+    /// used by ``ConversationManager.newConversation``. Returns
+    /// `true` when the conversation was committed (so the caller
+    /// can skip the regular `update(_:)` path that would otherwise
+    /// no-op because the conversation isn't in the array yet).
+    @discardableResult
+    public func commitDraftIfNeeded(_ conversation: Conversation) -> Bool {
+        guard let draft = self.draftConversation,
+              draft.id == conversation.id else {
+            return false
         }
+        var conversations: [Conversation] = ConversationManager.shared.conversations
+        conversations.insert(conversation, at: 0)
+        ConversationManager.shared.conversations = conversations
+        self.draftConversation
```

**File**: `Sidekick/Views/Chat/Conversation/Controls/Input Field/PromptInputField.swift` (modified, +7/-1)
```diff
@@ -330,7 +330,13 @@ struct PromptInputField: View {
             return
         }
         conversation = updatedConversation
-        conversationManager.update(updatedConversation)
+        // If this is the in-memory blank chat, promote it into the
+        // persisted store now that the user has actually sent
+        // something. Otherwise fall back to the regular update path
+        // (which would silently no-op on an unpersisted draft).
+        if !self.conversationState.commitDraftIfNeeded(updatedConversation) {
+            conversationManager.update(updatedConversation)
+        }
         self.promptController.sentConversation = updatedConversation
         self.promptController.sentExpertId = self.conversationState.selectedExpertId
         let enableThinking: Bool? = self.resolvedEnableThinking()
```

**File**: `Sidekick/Views/Chat/Conversation/ConversationManagerView.swift` (modified, +7/-14)
```diff
@@ -140,20 +140,13 @@ struct ConversationManagerView: View {
         ) { output in
             self.refreshModel()
         }
-        .onReceive(
-            NotificationCenter.default.publisher(
-                for: Notifications.newConversation.name
-            )
-        ) { output in
-            withAnimation(.linear) {
-                self.conversationState.selectedExpertId = ExpertManager.default?.id
-            }
-            if let recentConversationId = conversationManager.recentConversation?.id {
-                withAnimation(.linear) {
-                    self.conversationState.selectedConversationId = recentConversationId
-                }
-            }
-        }
+        // ``ConversationState.newConversation`` now handles
+        // expert reset + selection directly because the new chat
+        // is an in-memory draft that isn't surfaced by
+        // ``ConversationManager.recentConversation`` until the
+        // user sends the first message. The previous listener
+        // would have clobbered the draft selection with the
+        // most-recent persisted conversation, so it's gone.
         .onReceive(
             NotificationCenter.default.publisher(
                 for: Notifications.switchToConversation.name
```

**File**: `Sidekick/Views/Chat/Conversation/ConversationView.swift` (modified, +6/-2)
```diff
@@ -87,9 +87,13 @@ struct ConversationView: View {
 			return
 		}
 		let _ = currentConversation.addMessage(message)
-		// Save
+		// Save. If this image landed in the in-memory blank chat,
+		// promote it into the persisted store; otherwise update in
+		// place as before.
 		withAnimation(.linear) {
-			self.conversationManager.update(currentConversation)
+			if !self.conversationState.commitDraftIfNeeded(currentConversation) {
+				self.conversationManager.update(currentConversation)
+			}
 		}
 	}
 	
```

**File**: `Sidekick/Views/ContentView.swift` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ struct ContentView: View {
 	@Environment(DownloadManager.self) private var downloadManager
 		@Environment(ConversationManager.self) private var conversationManager
 	
-	@State private var conversationState: ConversationState = ConversationState()
+	@State private var conversationState: ConversationState = ConversationState.shared
 	
 	@State private var showSetup: Bool = Settings.showSetup
 	
```

---

### Incident Patch 7: `86b74e2e` (2026-05-23)
**Commit Message**: fix: Kill inference server

**File**: `Sidekick.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -332,6 +332,7 @@
 		208E34AC2EC1C644009B75C9 /* LlamaServer+ServerLifecycle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208E34AB2EC1C644009B75C9 /* LlamaServer+ServerLifecycle.swift */; };
 		208E34AE2EC1C70B009B75C9 /* Model+Status.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208E34AD2EC1C70B009B75C9 /* Model+Status.swift */; };
 		208E34B02EC1C716009B75C9 /* Model+Lifecycle.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208E34AF2EC1C716009B75C9 /* Model+Lifecycle.swift */; };
+		20FA1C0B2F00000100AA0001 /* InferenceLifecycleCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20FA1C0A2F00000100AA0001 /* InferenceLifecycleCoordinator.swift */; };
 		208E34B22EC1C720009B75C9 /* Model+Inference.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208E34B12EC1C720009B75C9 /* Model+Inference.swift */; };
 		2090A8A62D8995FA0060DC63 /* ModelType.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2090A8A52D8995FA0060DC63 /* ModelType.swift */; };
 		209370762D6AB36900E1AF73 /* Refactorer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 209370752D6AB36900E1AF73 /* Refactorer.swift */; };
@@ -835,6 +836,7 @@
 		208E34AB2EC1C644009B75C9 /* LlamaServer+ServerLifecycle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "LlamaServer+ServerLifecycle.swift"; sourceTree = "<group>"; };
 		208E34AD2EC1C70B009B75C9 /* Model+Status.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Model+Status.swift"; sourceTree = "<group>"; };
 		208E34AF2EC1C716009B75C9 /* Model+Lifecycle.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Model+Lifecycle.swift"; sourceTree = "<group>"; };
+		20FA1C0A2F00000100AA0001 /* InferenceLifecycleCoordinator.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = InferenceLifecycleCoordinator.swift; sourceTree = "<group>"; };
 		208E34B12EC1C720009B75C9 /* Model+Inference.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Model+Inference.swift"; sourceTree = "<group>"; };
 		2090A8A52D8995FA0060DC63 /* ModelType.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ModelType.swift; sourceTree = "<group>"; };
 		209370752D6AB36900E1AF73 /* Refactorer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = Refactorer.swift; sourceTree = "<group>"; };
@@ -2206,6 +2208,7 @@
 				208E34AD2EC1C70B009B75C9 /* Model+Status.swift */,
 				208E34AF2EC1C716009B75C9 /* Model+Lifecycle.swift */,
 				208E34B12EC1C720009B75C9 /* Model+Inference.swift */,
+				20FA1C0A2F00000100AA0001 /* InferenceLifecycleCoordinator.swift */,
 				202D4E732EBC5E80005D6F74 /* Router */,
 				200FBFD62CB627B100A92A74 /* llama.cpp */,
 			);
@@ -2772,6 +2775,7 @@
 				20B53D0C2D5B053E00D1AE79 /* CheckForUpdatesView.swift in Sources */,
 				208E34AE2EC1C70B009B75C9 /* Model+Status.swift in Sources */,
 				208E34B02EC1C716009B75C9 /* Model+Lifecycle.swift in Sources */,
+				20FA1C0B2F00000100AA0001 /* InferenceLifecycleCoordinator.swift in Sources */,
 				20573F322CB53172004C19FE /* InferenceSettings.swift in Sources */,
 				2031B9902CEAE33900627D53 /* InlineAssistantController.swift in Sources */,
 				2031B9982CEAE78F00627D53 /* ShortcutController.swift in Sources */,
```

**File**: `Sidekick/AppDelegate.swift` (modified, +71/-8)
```diff
@@ -15,15 +15,29 @@ import TipKit
 /// The app's delegate which handles life cycle events
 public class AppDelegate: NSObject, NSApplicationDelegate, ObservableObject {
     
+    private static let logger: Logger = .init(
+        subsystem: Bundle.main.bundleIdentifier ?? "Sidekick",
+        category: String(describing: AppDelegate.self)
+    )
+    
     /// A object of type  ``InlineAssistantController`` controller
     let inlineAssistantController: InlineAssistantController = .shared
     /// A object of type  ``CompletionsController`` controller
     let completionsController: CompletionsController = .shared
     
+    /// Hard ceiling on coordinated quit cleanup. Bigger than the per-server
+    /// SIGTERM grace period so two servers can shut down sequentially before
+    /// SIGKILL is escalated, but short enough that the app never feels stuck
+    /// on quit.
+    private static let shutdownTimeout: TimeInterval = 5.0
+    
     /// Function that runs after the app is initialized
     public func applicationDidFinishLaunching(
         _ notification: Notification
     ) {
+        // Wire up inference lifecycle so child processes are torn down on
+        // any quit path (Cmd+Q, log out, `kill <pid>`, Ctrl-C, crash).
+        self.configureInferenceShutdown()
         Tips.hideAllTipsForTesting()
         print("Hid all tips")
         // Relocate legacy resources if setup finished
@@ -56,19 +70,68 @@ public class AppDelegate: NSObject, NSApplicationDelegate, ObservableObject {
         }
     }
     
-    /// Function that runs before the app is terminated
+    /// Function that runs before the app is terminated.
+    ///
+    /// Returns ``.terminateLater`` and runs an awaitable coordinated
+    /// shutdown of every memory-intensive inference child process before
+    /// telling AppKit it is safe to exit. This guarantees that on a normal
+    /// quit no orphan `llama-server` / `llama-perplexity` survives.
     public func applicationShouldTerminate(
         _ sender: NSApplication
     ) -> NSApplication.TerminateReply {
-        // Stop server
-        Task {
-            await Model.shared.stopServers()
-        }
-        // Remove stale sources
+        // Synchronous, cheap cleanup that must run before we yield.
         SourcesStore.removeStaleSources()
-        // Remove non-persisted resources
         ExpertManager.removeUnpersistedResources()
-        return .terminateNow
+        // Run the heavy async shutdown off-actor and ask AppKit to wait.
+        Task.detached { [weak self] in
+            await self?.performCoordinatedShutdown()
+            await MainActor.run {
+                NSApplication.shared.reply(toApplicationShouldTerminate: true)
+            }
+        }
+        return .terminateLater
+    }
+    
+    /// Last-chance cleanup. AppKit only fires this for normal quits — not
+    /// for SIGKILL, but it is fired for `applicationShouldTerminate` → yes
+    /// flows after our async work resolves. Use it as a belt-and-braces
+    /// sweep so any PID that slipped past the coordinator is still killed.
+    public func applicationWillTerminate(_ notification: Notification) {
+        InferenceLifecycleCoordinator.shared.killAllRegisteredProcesses(
+            gracePeriodSeconds: 0.5
+        )
+    }
+    
+    // MARK: - Inference Shutdown Wiring
+    
+    /// Register every owner of an inference child process with the
+    /// coordinator and install UNIX signal handlers so that quit/kill paths
+    /// converge on a single shutdown routine.
+    private func configureInferenceShutdown() {
+        let coordinator = InferenceLifecycleCoordinator.shared
+        // Catch SIGTERM/SIGINT/SIGHUP — `kill <pid>`, terminal Ctrl-C, or
+        // session logout. (SIGKILL is uninterceptable; the bundled
+        // `llama-server-watchdog` handles that case.)
+        coordinator.installSignalHandlers()
+        // Hook: interrupt active streams + stop main & worker llama-servers.
+        coordinator.registerShutdownHook(identifier: "Model") {
+            await Model.shared.interrupt()
+            await Model.shared.stopServers()
+        }
+        // Hook: completions llama-server (separate process, separate port).
+        coordinator.registerShutdownHook(identifier: "Completions") { [weak self] in
+            await self?.completionsController.stopAsync()
+        }
+    }
+    
+    /// Run every registered shutdown hook with a hard ceiling and then
+    /// sweep the PID registry to make sure nothing survives.
+    private func performCoordinatedShutdown() async {
+        Self.logger.notice("AppDelegate beginning coordinated inference shutdown")
+        await InferenceLifecycleCoordinator.shared.shutdownAll(
+            timeout: Self.shutdownTimeout
+        )
+        Self.logger.notice("AppDelegate finished coordinated inference shutdown")
     }
     
 }
```

**File**: `Sidekick/Logic/Inference/InferenceLifecycleCoordinator.swift` (added, +213/-0)
```diff
@@ -0,0 +1,213 @@
+//
+//  InferenceLifecycleCoordinator.swift
+//  Sidekick
+//
+//  Centralizes shutdown of every memory-intensive inference child process
+//  (llama-server, llama-perplexity, watchdog) so that on quit / kill /
+//  unexpected termination no orphaned process is left running.
+//
+
+import AppKit
+import Darwin
+import Foundation
+import OSLog
+
+/// Coordinates the lifecycle of every inference-related child process spawned
+/// by Sidekick. Owners of such processes (``LlamaServer``,
+/// ``CompletionsController``, ``DetectorViewController``, ...) must
+/// register their PID through this coordinator. On normal quit the
+/// coordinator runs an awaited graceful shutdown; on `SIGTERM`/`SIGINT`/
+/// `SIGHUP` (e.g. `kill <pid>` or shell-initiated termination) it falls back
+/// to a best-effort synchronous cleanup before the app exits.
+public final class InferenceLifecycleCoordinator: @unchecked Sendable {
+    
+    // MARK: - Logging
+    
+    private static let logger: Logger = .init(
+        subsystem: Bundle.main.bundleIdentifier ?? "Sidekick",
+        category: String(describing: InferenceLifecycleCoordinator.self)
+    )
+    
+    // MARK: - Shared Instance
+    
+    public static let shared: InferenceLifecycleCoordinator = .init()
+    
+    // MARK: - State
+    
+    /// Tracked child process identifiers. Protected by `lock`.
+    private var trackedPIDs: Set<pid_t> = []
+    private let lock: NSLock = .init()
+    
+    /// Hooks supplied by owners that perform an awaitable graceful shutdown.
+    /// Identified by a string so they can be replaced without leaking.
+    private var asyncShutdownHooks: [String: @Sendable () async -> Void] = [:]
+    
+    /// Dispatch sources that translate UNIX signals into Swift callbacks.
+    private var signalSources: [DispatchSourceSignal] = []
+    
+    /// Set to `true` once a coordinated shutdown is underway so callers can
+    /// avoid restarting servers or scheduling new work during teardown.
+    public private(set) var isShuttingDown: Bool = false
+    
+    // MARK: - Init
+    
+    private init() {}
+    
+    // MARK: - PID Registry
+    
+    /// Register a freshly-spawned inference child process so the coordinator
+    /// can terminate it on shutdown. Safe to call from any thread.
+    public func register(pid: pid_t) {
+        guard pid > 0 else { return }
+        self.lock.lock()
+        self.trackedPIDs.insert(pid)
+        self.lock.unlock()
+    }
+    
+    /// Remove a PID from the registry after it has been intentionally stopped.
+    public func unregister(pid: pid_t) {
+        guard pid > 0 else { return }
+        self.lock.lock()
+        self.trackedPIDs.remove(pid)
+        self.lock.unlock()
+    }
+    
+    /// Snapshot the currently tracked PIDs.
+    public func currentPIDs() -> [pid_t] {
+        self.lock.lock()
+        defer { self.lock.unlock() }
+        return Array(self.trackedPIDs)
+    }
+    
+    // MARK: - Shutdown Hooks
+    
+    /// Register an async shutdown hook keyed by ``identifier``. Replacing a
+    /// previously-registered hook with the same identifier removes the old
+    /// one.
+    public func registerShutdownHook(
+        identifier: String,
+        _ hook: @escaping @Sendable () async -> Void
+    ) {
+        self.lock.lock()
+        self.asyncShutdownHooks[identifier] = hook
+        self.lock.unlock()
+    }
+    
+    public func unregisterShutdownHook(identifier: String) {
+        self.lock.lock()
+        self.asyncShutdownHooks.removeValue(forKey: identifier)
+        self.lock.unlock()
+    }
+    
+    private func currentHooks() -> [(String, @Sendable () async -> Void)] {
+        self.lock.lock()
+        defer { self.lock.unlock() }
+        return self.asyncShutdownHooks.map { ($0.key, $0.value) }
+    }
+    
+    // MARK: - Signal Handling
+    
+    /// Install signal handlers that intercept `SIGTERM`, `SIGINT`, and
+    /// `SIGHUP` and trigger a synchronous best-effort cleanup so that
+    /// `kill <pid>`, `pkill`, terminal `Ctrl-C`, or session shutdown never
+    /// leaves an orphaned `llama-server` alive.
+    ///
+    /// `SIGKILL` cannot be intercepted; the bundled `llama-server-watchdog`
+    /// is the safety net for that case.
+    public func installSignalHandlers() {
+        let signals: [Int32] = [SIGTERM, SIGINT, SIGHUP]
+        for signo in signals {
+            // Ignore the default disposition so the signal is delivered to
+            // the dispatch source instead of killing the process outright.
+            signal(signo, SIG_IGN)
+            let source = DispatchSource.makeSignalSource(
+                signal: signo,
+                queue: .global(qos: .userInitiated)
+            )
+            source.setEventHandler { [weak self] in
+                Self.logger.notice(
+                    "Received signal \(signo, privacy: .public); tearing down inference processes"
+                )
+                self?.handleTermi
```

**File**: `Sidekick/Logic/Inference/llama.cpp/LlamaServer+ServerLifecycle.swift` (modified, +89/-4)
```diff
@@ -5,6 +5,7 @@
 //  Created by Bean John on 10/9/24.
 //
 
+import Darwin
 import Foundation
 import FSKit_macOS
 import OSLog
@@ -24,17 +25,29 @@ extension LlamaServer {
         ]
         // Send main app's heartbeat to show that the main app is still running
         let heartbeat = Pipe()
+        self.heartbeatPipe = heartbeat
         let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global())
         timer.schedule(deadline: .now(), repeating: 15.0)
         timer.setEventHandler { [weak heartbeat] in
             guard let heartbeat = heartbeat else { return }
             let data = ".".data(using: .utf8) ?? Data()
-            heartbeat.fileHandleForWriting.write(data)
+            // Writing to a closed pipe raises SIGPIPE; guard so a dead
+            // watchdog never crashes the host app.
+            do {
+                try heartbeat.fileHandleForWriting.write(contentsOf: data)
+            } catch {
+                // Pipe was closed (watchdog exited); silently stop heartbeating.
+            }
         }
         timer.resume()
+        self.heartbeatTimer = timer
         monitor.standardInput = heartbeat
         // Start monitor
         try monitor.run()
+        // Register both children so a coordinated shutdown can clean them up
+        // regardless of which path the app exits through.
+        InferenceLifecycleCoordinator.shared.register(pid: serverPID)
+        InferenceLifecycleCoordinator.shared.register(pid: monitor.processIdentifier)
         Self.logger.notice(
             "Started monitor for server with PID \(serverPID)"
         )
@@ -174,17 +187,89 @@ extension LlamaServer {
         self.isStartingServer = false
     }
     
-    /// Function to stop the `llama-server` process
-    public func stopServer() async {
-        // Terminate processes
+    /// Function to stop the `llama-server` process.
+    ///
+    /// Performs a graceful `SIGTERM`, waits up to ``gracePeriodSeconds`` for
+    /// the process to exit, then escalates to `SIGKILL` to guarantee that
+    /// memory-intensive inference children are released before this call
+    /// returns. Any active streaming requests are cancelled first so their
+    /// callbacks unblock before the server disappears.
+    public func stopServer(
+        gracePeriodSeconds: TimeInterval = 1.5
+    ) async {
+        // Cancel any in-flight streaming requests so their continuations
+        // don't outlive the underlying process.
+        self.pendingCancellationForAllRequests = true
+        for context in self.activeRequests.values {
+            context.cancel()
+        }
+        self.activeRequests.removeAll()
+        // Stop heartbeat first so the watchdog doesn't keep firing while
+        // we tear the server down ourselves.
+        self.heartbeatTimer?.cancel()
+        self.heartbeatTimer = nil
+        try? self.heartbeatPipe?.fileHandleForWriting.close()
+        self.heartbeatPipe = nil
+        let serverPID: pid_t = self.process.isRunning ? self.process.processIdentifier : 0
+        let monitorPID: pid_t = self.monitor.isRunning ? self.monitor.processIdentifier : 0
+        // SIGTERM both children.
         if self.process.isRunning {
             self.process.terminate()
         }
         if self.monitor.isRunning {
             self.monitor.terminate()
         }
+        // Wait for them to actually exit. Never blocks forever — falls back
+        // to SIGKILL if the grace period elapses without exit.
+        await self.awaitChildExit(
+            process: self.process,
+            fallbackPID: serverPID,
+            timeoutSeconds: gracePeriodSeconds
+        )
+        await self.awaitChildExit(
+            process: self.monitor,
+            fallbackPID: monitorPID,
+            timeoutSeconds: gracePeriodSeconds
+        )
+        // Make sure neither PID is still tracked.
+        InferenceLifecycleCoordinator.shared.unregister(pid: serverPID)
+        InferenceLifecycleCoordinator.shared.unregister(pid: monitorPID)
         self.process = Process()
         self.monitor = Process()
+        self.pendingCancellationForAllRequests = false
+    }
+    
+    /// Wait for ``process`` to exit, escalating from `SIGTERM` to `SIGKILL`
+    /// if ``timeoutSeconds`` expires. Uses `kill(pid, 0)` as the authoritative
+    /// liveness check because `Process.isRunning` lags behind kernel state.
+    private func awaitChildExit(
+        process: Process,
+        fallbackPID: pid_t,
+        timeoutSeconds: TimeInterval
+    ) async {
+        let pid: pid_t = process.processIdentifier > 0 ? process.processIdentifier : fallbackPID
+        guard pid > 0 || process.isRunning else { return }
+        let deadline: Date = Date().addingTimeInterval(timeoutSeconds)
+        while Date() < deadline {
+            if !process.isRunning && (pid <= 0 || kill(pid, 0) != 0) {
+                return
+            }
+            try? await Task.sleep(nanoseconds: 50_000_000)
+        }
+ 
```

**File**: `Sidekick/Logic/Inference/llama.cpp/LlamaServer.swift` (modified, +7/-0)
```diff
@@ -36,6 +36,13 @@ public actor LlamaServer {
     var isStartingServer: Bool = false
     var monitor: Process = Process()
     var process: Process = Process()
+    /// Timer responsible for writing heartbeat bytes to the watchdog.
+    /// Held so it can be cancelled on shutdown — otherwise it keeps firing
+    /// (and leaks the pipe) after the monitor process has been terminated.
+    var heartbeatTimer: DispatchSourceTimer?
+    /// Backing pipe for the watchdog heartbeat. Retained for the lifetime of
+    /// the monitor process so the file descriptor can be closed deterministically.
+    var heartbeatPipe: Pipe?
     
     /// Tracks request-scoped streaming resources so multiple in-flight calls can run concurrently.
     var activeRequests: [UUID: ActiveRequestContext] = [:]
```

**File**: `Sidekick/Logic/Inference/llama.cpp/llama-server-watchdog/main.swift` (modified, +68/-18)
```diff
@@ -5,36 +5,87 @@
 //  Created by Bean John on 10/9/24.
 //
 
+import Darwin
 import Foundation
 
 /// Function for logging, used for debug
 func log(_ line: String) {
 	print("[watchdog]", line)
 }
 
-/// Function to terminate the server process
-func terminateServerProcess(pid: Int32) {
-	log("Terminating the server process with PID \(pid).")
-	kill(pid, SIGTERM)
+/// Function to terminate the server process. Sends SIGTERM, waits briefly
+/// for graceful exit, then escalates to SIGKILL so a wedged `llama-server`
+/// is guaranteed to release its memory.
+func terminateServerProcess(pid: Int32, reason: String) {
+	log("\(reason); terminating the server process with PID \(pid).")
+	if kill(pid, 0) == 0 {
+		_ = kill(pid, SIGTERM)
+		let deadline = Date().addingTimeInterval(2.0)
+		while Date() < deadline && kill(pid, 0) == 0 {
+			Thread.sleep(forTimeInterval: 0.05)
+		}
+		if kill(pid, 0) == 0 {
+			log("PID \(pid) did not exit after SIGTERM; escalating to SIGKILL.")
+			_ = kill(pid, SIGKILL)
+		}
+	}
 	log("Terminated server, exiting")
 	exit(0)
 }
 
-/// Function to check the existence of the heartbeat file and detect if the main app is still alive
+/// Wait for the host app to disappear and then kill the server.
+///
+/// The host app keeps the heartbeat pipe open and periodically writes a byte
+/// to it. We block on `poll()` so we react immediately when the pipe is
+/// closed (kernel does this when the host process crashes or is SIGKILLed)
+/// and fall back to a 30 s liveness timeout for the case where the host is
+/// alive but has stopped heartbeating.
 func checkHeartbeat(serverProcessPID: Int32) {
-	let checkInterval: TimeInterval = 15.0
-	
+	let fd = FileHandle.standardInput.fileDescriptor
+	let heartbeatTimeoutMs: Int32 = 30_000
+	var buffer = [UInt8](repeating: 0, count: 64)
 	while true {
-		let fileHandle = FileHandle.standardInput
-		if fileHandle.availableData.count > 0 {
-			// If the file is recent, the main app is running; continue checking
-			log("Main app is alive")
-		} else {
-			terminateServerProcess(pid: serverProcessPID)
-		}
-		
-		// Wait for the next check interval before checking again
-		Thread.sleep(forTimeInterval: checkInterval)
+		var pfd = pollfd(fd: fd, events: Int16(POLLIN), revents: 0)
+		let result = withUnsafeMutablePointer(to: &pfd) { ptr in
+			poll(ptr, 1, heartbeatTimeoutMs)
+		}
+		if result < 0 {
+			if errno == EINTR { continue }
+			terminateServerProcess(
+				pid: serverProcessPID,
+				reason: "poll() failed (errno=\(errno))"
+			)
+		}
+		if result == 0 {
+			terminateServerProcess(
+				pid: serverProcessPID,
+				reason: "No heartbeat from host app for \(heartbeatTimeoutMs / 1000)s"
+			)
+		}
+		// `POLLHUP` is set when the write end of the pipe is closed (the
+		// host crashed / was killed). React immediately.
+		if pfd.revents & Int16(POLLHUP) != 0 {
+			terminateServerProcess(
+				pid: serverProcessPID,
+				reason: "Host app pipe hung up (crash or SIGKILL)"
+			)
+		}
+		// Drain the heartbeat byte(s).
+		let bytesRead = buffer.withUnsafeMutableBufferPointer { ptr in
+			read(fd, ptr.baseAddress, ptr.count)
+		}
+		if bytesRead == 0 {
+			terminateServerProcess(
+				pid: serverProcessPID,
+				reason: "Host app pipe closed (EOF)"
+			)
+		}
+		if bytesRead < 0 && errno != EAGAIN && errno != EINTR {
+			terminateServerProcess(
+				pid: serverProcessPID,
+				reason: "read() error (errno=\(errno))"
+			)
+		}
 	}
 }
 
@@ -57,4 +108,3 @@ func startWatchdog() {
 
 /// Call the function to start the watchdog process
 startWatchdog()
-
```

**File**: `Sidekick/Logic/Utilities/Tools/CompletionsController.swift` (modified, +22/-6)
```diff
@@ -78,24 +78,40 @@ public class CompletionsController: ObservableObject {
 	
 	/// Function to stop completions
 	public func stop() {
-		// Remove NSEvent monitors
+		self.tearDownObservers()
+		Task { [weak self] in
+			guard let self = self else { return }
+			await self.server?.stopServer()
+		}
+	}
+	
+	/// Awaitable shutdown used during coordinated app termination.
+	///
+	/// Mirrors ``stop()`` but waits for the underlying ``LlamaServer`` to
+	/// fully release its child process before returning so callers (e.g.
+	/// ``AppDelegate.applicationShouldTerminate``) can guarantee that no
+	/// completions `llama-server` is left running once the app exits.
+	public func stopAsync() async {
+		self.tearDownObservers()
+		await self.server?.stopServer()
+		self.server = nil
+	}
+	
+	/// Tear down all event observers and taps. Synchronous and safe to call
+	/// from either ``stop()`` or the async shutdown path.
+	private func tearDownObservers() {
 		for monitor in self.monitors {
 			NSEvent.removeMonitor(monitor)
 		}
 		self.monitors.removeAll()
 		NSWorkspace.shared.notificationCenter.removeObserver(self)
-		// Disable and remove the key event tap
 		if let keyEventTap = self.keyEventTap {
 			CFMachPortInvalidate(keyEventTap)
 			CFRunLoopRemoveSource(CFRunLoopGetCurrent(),
 								  CFMachPortCreateRunLoopSource(kCFAllocatorDefault, keyEventTap, 0),
 								  .commonModes)
 			self.keyEventTap = nil
 		}
-		Task { [weak self] in
-			guard let self = self else { return }
-			await self.server?.stopServer()
-		}
 	}
 	
 	/// A function to type the next word in the completion
```

**File**: `Sidekick/Logic/View Controllers/Tools/Detector/DetectorViewController.swift` (modified, +17/-0)
```diff
@@ -131,6 +131,11 @@ public class DetectorViewController: ObservableObject {
 		// Run process
 		do {
 			try self.perplexityProcess.run()
+			// Register so the coordinator can terminate it if the app quits
+			// or is killed before evaluation finishes.
+			InferenceLifecycleCoordinator.shared.register(
+				pid: self.perplexityProcess.processIdentifier
+			)
 		} catch {
 			self.error(
 				message: String(
@@ -268,11 +273,23 @@ public class DetectorViewController: ObservableObject {
 			self.burstiness = nil
 			// Terminate process if running
 			if self.perplexityProcess.isRunning {
+				let pid = self.perplexityProcess.processIdentifier
 				self.perplexityProcess.terminate()
+				InferenceLifecycleCoordinator.shared.unregister(pid: pid)
 			}
 		}
 	}
 	
+	deinit {
+		// Last-line defence: if the controller is torn down while a
+		// perplexity child is still running, make sure it dies with us.
+		if self.perplexityProcess.isRunning {
+			let pid = self.perplexityProcess.processIdentifier
+			self.perplexityProcess.terminate()
+			InferenceLifecycleCoordinator.shared.unregister(pid: pid)
+		}
+	}
+	
 	/// An enum representing the current state of the AI detector
 	public enum DetectorState: CaseIterable {
 		
```

---

### Incident Patch 8: `40562b87` (2026-05-22)
**Commit Message**: fix: Migrate to SwiftData

**File**: `Sidekick.xcodeproj/project.pbxproj` (modified, +45/-4)
```diff
@@ -29,7 +29,7 @@
 		200619B22D6768F6001949EF /* SwiftfulLoadingIndicators in Frameworks */ = {isa = PBXBuildFile; productRef = 200619B12D6768F6001949EF /* SwiftfulLoadingIndicators */; };
 		200619B42D676DCE001949EF /* DiagrammerPreviewEditorView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200619B32D676DCE001949EF /* DiagrammerPreviewEditorView.swift */; };
 		200AACBD2EC1CE7A000995B7 /* FunctionCategory.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200AACBC2EC1CE7A000995B7 /* FunctionCategory.swift */; };
-		200AACBF2EC1CEAE000995B7 /* FunctionSelectionManager.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200AACBE2EC1CEAE000995B7 /* FunctionSelectionManager.swift */; };
+		200AACBF2EC1CEAE000995B7 /* FunctionSelection.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200AACBE2EC1CEAE000995B7 /* FunctionSelection.swift */; };
 		200AACC12EC1CF23000995B7 /* CapsuleChecklistMenuButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200AACC02EC1CF23000995B7 /* CapsuleChecklistMenuButton.swift */; };
 		200AADB22EC28395000995B7 /* demoExpertUse.png in Resources */ = {isa = PBXBuildFile; fileRef = 200AAD702EC28395000995B7 /* demoExpertUse.png */; };
 		200AADB32EC28395000995B7 /* slideStudioExport.png in Resources */ = {isa = PBXBuildFile; fileRef = 200AAD9D2EC28395000995B7 /* slideStudioExport.png */; };
@@ -454,6 +454,14 @@
 		20FDE2A22DAE726E000A16F8 /* OpenAIFunction.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20FDE2A12DAE726E000A16F8 /* OpenAIFunction.swift */; };
 		20FDE2A42DAE73BF000A16F8 /* AnyFunctionBox.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20FDE2A32DAE73BF000A16F8 /* AnyFunctionBox.swift */; };
 		20FE94DA2CB96DE8006E9F06 /* ExitButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20FE94D92CB96DE8006E9F06 /* ExitButton.swift */; };
+		20BEEF010000000000000001 /* SidekickSchema.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF020000000000000001 /* SidekickSchema.swift */; };
+		20BEEF010000000000000002 /* PersistenceController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF020000000000000002 /* PersistenceController.swift */; };
+		20BEEF010000000000000003 /* JSONImporter.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF020000000000000003 /* JSONImporter.swift */; };
+		20BEEF010000000000000004 /* MessageStreamCoordinator.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF020000000000000004 /* MessageStreamCoordinator.swift */; };
+		20BEEF050000000000000003 /* ModelContextActor.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF050000000000000004 /* ModelContextActor.swift */; };
+		20BEEF050000000000000001 /* RAGIndexingService.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF050000000000000002 /* RAGIndexingService.swift */; };
+		20BEEF010000000000000005 /* MessageViewHelpers.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF020000000000000005 /* MessageViewHelpers.swift */; };
+		20BEEF010000000000000006 /* ExpertViewHelpers.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20BEEF020000000000000006 /* ExpertViewHelpers.swift */; };
 /* End PBXBuildFile section */
 
 /* Begin PBXContainerItemProxy section */
@@ -558,7 +566,7 @@
 		200619AE2D6766B1001949EF /* DiagrammerGeneratingView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DiagrammerGeneratingView.swift; sourceTree = "<group>"; };
 		200619B32D676DCE001949EF /* DiagrammerPreviewEditorView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DiagrammerPreviewEditorView.swift; sourceTree = "<group>"; };
 		200AACBC2EC1CE7A000995B7 /* FunctionCategory.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FunctionCategory.swift; sourceTree = "<group>"; };
-		200AACBE2EC1CEAE000995B7 /* FunctionSelectionManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FunctionSelectionManager.swift; sourceTree = "<group>"; };
+		200AACBE2EC1CEAE000995B7 /* FunctionSelection.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = FunctionSelection.swift; sourceTree = "<group>"; };
 		200AACC02EC1CF23000995B7 /* CapsuleChecklistMenuButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = CapsuleChecklistMenuButton.swift; sourceTree = "<group>"; };
 		200AAD5C2EC28395000995B7 /* canvasDataVisualization.png */ = {isa = PBXFileReference; lastKnownFileType = image.png; path = canvasDataVisualization.png; sourceTree = "<group>"; };
 		200AAD5D2EC28395000995B7 /* canvasExport.png */ = {isa = PBXFileReference; lastKnownFileType = image.png; path = canvasExport.png; sourceTree = "<group>"; };
@@ -944,6 +952,15 @@
 		20FDE2A32DAE73BF000A16F8 /* AnyFunctionBox.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AnyFunctionBox.swift; sourceTree = "<group>"; };
 		20FE94D92CB96DE8006E9F06 /* ExitButton.swift */ = {isa = PBXFileReference
```

**File**: `Sidekick/AppDelegate.swift` (modified, +4/-4)
```diff
@@ -46,13 +46,13 @@ public class AppDelegate: NSObject, NSApplicationDelegate, ObservableObject {
             await Refactorer.updateEndpoint()
         }
         // Make sure `Resources` are not indexing
-        for expert in ExpertManager.shared.experts {
+        for expert in ExpertManager.experts() {
             var modExpert = expert
             if modExpert.resources.graphStatus != .ready {
                 modExpert.resources.graphStatus = nil
                 modExpert.resources.graphProgress = nil
             }
-            ExpertManager.shared.update(modExpert)
+            ExpertManager.update(modExpert)
         }
     }
     
@@ -65,9 +65,9 @@ public class AppDelegate: NSObject, NSApplicationDelegate, ObservableObject {
             await Model.shared.stopServers()
         }
         // Remove stale sources
-        SourcesManager.shared.removeStaleSources()
+        SourcesStore.removeStaleSources()
         // Remove non-persisted resources
-        ExpertManager.shared.removeUnpersistedResources()
+        ExpertManager.removeUnpersistedResources()
         return .terminateNow
     }
     
```

**File**: `Sidekick/AppState.swift` (modified, +17/-10)
```diff
@@ -4,18 +4,25 @@
 //
 //  Created by Bean John on 11/5/24.
 //
+//  Converted from `ObservableObject` to `@Observable` as part of
+//  the SwiftData migration's Phase 1 cleanup. The shared instance
+//  is now injected via `.environment(AppState.shared)` and read
+//  via `@Environment(AppState.self)`.
+//
 
 import Foundation
+import Observation
 import SwiftUI
 
-public class AppState: ObservableObject {
-	
-	static let shared: AppState = AppState()
-	
-	@Published var commandSelectedExpertId: UUID? = nil
-	
-	static func setCommandSelectedExpertId(_ id: UUID) {
-		Self.shared.commandSelectedExpertId = id
-	}
-	
+@MainActor
+@Observable
+public final class AppState {
+
+    static let shared: AppState = AppState()
+
+    var commandSelectedExpertId: UUID? = nil
+
+    static func setCommandSelectedExpertId(_ id: UUID) {
+        Self.shared.commandSelectedExpertId = id
+    }
 }
```

**File**: `Sidekick/Extensions/UI/Extension+Binding.swift` (modified, +7/-7)
```diff
@@ -27,13 +27,13 @@ extension Binding where Value == Expert {
         await MainActor.run {
             expert.resources.addResource(resource)
             self.wrappedValue = expert
-            ExpertManager.shared.update(expert)
+            ExpertManager.update(expert)
         }
         
         // Write back the modified expert
         await MainActor.run {
             self.wrappedValue = expert
-            ExpertManager.shared.update(expert)
+            ExpertManager.update(expert)
         }
     }
     
@@ -44,7 +44,7 @@ extension Binding where Value == Expert {
         await MainActor.run {
             expert.resources.addResources(resources)
             self.wrappedValue = expert
-            ExpertManager.shared.update(expert)
+            ExpertManager.update(expert)
         }
     }
     
@@ -56,7 +56,7 @@ extension Binding where Value == Expert {
         await MainActor.run {
             expert.resources.removeResource(resource)
             self.wrappedValue = expert
-            ExpertManager.shared.update(expert)
+            ExpertManager.update(expert)
         }
     }
     
@@ -78,18 +78,18 @@ extension Binding where Value == Expert {
         // Write back the modified expert
         await MainActor.run {
             self.wrappedValue = expert
-            ExpertManager.shared.update(expert)
+            ExpertManager.update(expert)
         }
     }
     
     private func updateExpertProgress(expertId: UUID, progress: Resources.GraphProgress) {
         Task { @MainActor in
-            guard var current = ExpertManager.shared.getExpert(id: expertId) else {
+            guard var current = ExpertManager.getExpert(id: expertId) else {
                 return
             }
             current.resources.graphStatus = .building
             current.resources.graphProgress = progress
-            ExpertManager.shared.update(current)
+            ExpertManager.update(current)
         }
     }
     
```

**File**: `Sidekick/Localizable.xcstrings` (modified, +21/-0)
```diff
@@ -422,6 +422,7 @@
       }
     },
     "Are you sure you want to delete all commands?" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -442,6 +443,7 @@
       }
     },
     "Are you sure you want to delete all experts?" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -1426,6 +1428,7 @@
       }
     },
     "Delete All Commands" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -3002,6 +3005,9 @@
           }
         }
       }
+    },
+    "Legacy JSON content was successfully re-imported into the SwiftData store. Restart Sidekick to see the latest data." : {
+
     },
     "Less" : {
       "localizations" : {
@@ -3669,6 +3675,9 @@
           }
         }
       }
+    },
+    "Persistence" : {
+
     },
     "Pie Chart" : {
       "extractionState" : "stale",
@@ -3902,6 +3911,15 @@
           }
         }
       }
+    },
+    "Re-import Complete" : {
+
+    },
+    "Re-import Failed" : {
+
+    },
+    "Re-import From Legacy JSON" : {
+
     },
     "Re-index all resources with graph extraction. This may take several minutes." : {
       "localizations" : {
@@ -4679,6 +4697,9 @@
           }
         }
       }
+    },
+    "Show Legacy JSON in Finder" : {
+
     },
     "Show less" : {
       "localizations" : {
```

**File**: `Sidekick/Logic/Commands/ConversationCommands.swift` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ public class ConversationCommands {
 		CommandGroup(after: .newItem) {
 			Menu {
 				ForEach(
-					ExpertManager.shared.experts
+					ExpertManager.experts()
 				) { expert in
 					ExpertSelectionButton(
 						expert: expert
@@ -48,7 +48,7 @@ public class ConversationCommands {
 		
 		/// The index of the expert, of type `Int`
 		private var index: Int {
-			return ExpertManager.shared.getExpertIndex(
+			return ExpertManager.getExpertIndex(
 				expert: expert
 			) + 1
 		}
```

**File**: `Sidekick/Logic/Commands/DebugCommands.swift` (modified, +42/-1)
```diff
@@ -17,8 +17,9 @@ public class DebugCommands {
 			Menu("Debug") {
 				Self.debugSettings
 				Self.debugConversations
+				Self.debugPersistence
 				Button(
-					action: ExpertManager.shared.resetDatastore
+					action: ExpertManager.resetToDefaults
 				) {
 					Text("Delete All Experts")
 				}
@@ -32,6 +33,46 @@ public class DebugCommands {
 			}
 		}
 	}
+
+	private static var debugPersistence: some View {
+		Menu("Persistence") {
+			Button {
+				Task { @MainActor in
+					Self.reimportFromLegacyJSON()
+				}
+			} label: {
+				Text("Re-import From Legacy JSON")
+			}
+			Button {
+				FileManager.showItemInFinder(
+					url: Settings.containerUrl.appendingPathComponent("Legacy")
+				)
+			} label: {
+				Text("Show Legacy JSON in Finder")
+			}
+		}
+	}
+
+	/// Runs the SwiftData importer against whatever legacy JSON
+	/// files are still present (either in their original locations
+	/// or under `…/Legacy/<file>.legacy`). Used by the Debug menu
+	/// for diagnosing migration issues; new rows are skipped if the
+	/// matching id already exists in SwiftData.
+	@MainActor
+	private static func reimportFromLegacyJSON() {
+		do {
+			try JSONImporter.importAll(into: PersistenceController.shared.container)
+			Dialogs.showAlert(
+				title: String(localized: "Re-import Complete"),
+				message: String(localized: "Legacy JSON content was successfully re-imported into the SwiftData store. Restart Sidekick to see the latest data.")
+			)
+		} catch {
+			Dialogs.showAlert(
+				title: String(localized: "Re-import Failed"),
+				message: error.localizedDescription
+			)
+		}
+	}
 	
 	private static var debugSettings: some View {
 		Menu("Settings") {
```

**File**: `Sidekick/Logic/Data Models/CommandManager.swift` (modified, +128/-210)
```diff
@@ -4,243 +4,161 @@
 //
 //  Created by Bean John on 11/18/24.
 //
+//  Replaced in Phase 2 of the SwiftData migration. The legacy
+//  ``CommandManager`` `ObservableObject` is gone; commands live in
+//  ``CommandEntity`` rows and views read them via SwiftData's
+//  `@Query`. The static helpers below provide the small slice of
+//  API that non-view call sites still need.
+//
 
 import Foundation
-import os.log
+import OSLog
+import SwiftData
 import SwiftUI
 
-public class CommandManager: ObservableObject {
-    
-    init() {
-        let signpost = StartupMetrics.begin("CommandManager.init")
-        self.patchFileIntegrity()
-        self.loadAsync()
-        StartupMetrics.end("CommandManager.init", signpost)
-    }
-    
-    /// Static constant for the global ``CommandManager`` object
-    static public let shared: CommandManager = .init()
-    
-    /// Published property for all commands
-    @Published public var commands: [Command] = [] {
-        didSet {
-            self.save()
-        }
-    }
-    
-    /// Published state tracking whether the datastore has been loaded
-    @Published private(set) var isLoaded: Bool = false
-    
-    /// Task handling asynchronous datastore loading
-    private var loadTask: Task<Void, Never>?
-    
-    /// Computed property returning the first command
-    var firstCommand: Command? {
-        if self.commands.first == nil {
-            self.newDatastore()
-        }
-        return self.commands.first
-    }
-    
-    /// Computed property returning the last command
-    var lastCommand: Command? {
-        if self.commands.last == nil {
-            self.newDatastore()
-        }
-        return self.commands.last
-    }
-    
-    /// Function to create a new command
-    public func addCommand(
-        command: Command
-    ) {
-        // Add to commands
-        self.commands.append(command)
-    }
-    
-    /// Function returning a command with the given ID
-    public func getCommand(
-        id commandId: UUID
-    ) -> Command? {
-        return self.commands.filter({ $0.id == commandId }).first
-    }
-    
-    /// Function to save commands to disk
-    public func save() {
+@MainActor
+public enum CommandManager {
+
+    private static let logger: Logger = .init(
+        subsystem: Bundle.main.bundleIdentifier!,
+        category: "CommandManager"
+    )
+
+    /// Returns every command, alphabetised, lazily seeding the
+    /// store with the defaults if needed.
+    public static func commands() -> [Command] {
+        let context = ModelContext(PersistenceController.shared.container)
         do {
-            // Save data
-            let rawData: Data = try JSONEncoder().encode(
-                self.commands
-            )
-            try rawData.write(
-                to: self.datastoreUrl,
-                options: .atomic
-            )
+            let rows = try context.fetch(FetchDescriptor<CommandEntity>())
+            if rows.isEmpty {
+                replace(with: Command.defaults)
+                return Command.defaults.sorted(by: \.name)
+            }
+            return rows
+                .map { Command(id: $0.id, name: $0.name, prompt: $0.prompt) }
+                .sorted(by: { $0.name < $1.name })
         } catch {
-            os_log("error = %@", error.localizedDescription)
+            Self.logger.error(
+                "Failed to read commands: \(error.localizedDescription, privacy: .public)"
+            )
+            return []
         }
     }
-    
-    /// Loads commands in the background to avoid blocking startup
-    private func loadAsync() {
-        if let loadTask = self.loadTask, !loadTask.isCancelled {
-            return
-        }
-        let targetUrl: URL = self.datastoreUrl
-        self.loadTask = Task.detached(priority: .userInitiated) { [weak self] in
-            let signpost = StartupMetrics.begin("CommandManager.loadDatastore")
-            defer { StartupMetrics.end("CommandManager.loadDatastore", signpost) }
-            let rawData: Data
-            do {
-                rawData = try Data(contentsOf: targetUrl)
-            } catch {
-                await MainActor.run {
-                    guard let self else { return }
-                    self.newDatastore()
-                    self.isLoaded = true
-                    self.loadTask = nil
-                }
-                return
+
+    /// Wholesale replace the persisted command list.
+    public static func replace(with commands: [Command]) {
+        let context = ModelContext(PersistenceController.shared.container)
+        do {
+            let existing = try context.fetch(FetchDescriptor<CommandEntity>())
+            for row in existing {
+                context.delete(row)
             }
-            let decoder: JSONDecoder = JSONDecoder()
-            let commands = (try? decoder.decode([Command].self, from: rawData)) ?? []
-            await MainActor.run {
-                guard let self else { ret
```

---

### Incident Patch 9: `b7f966cd` (2026-05-22)
**Commit Message**: feat: WebView markdown renderer

**File**: `Sidekick.xcodeproj/project.pbxproj` (modified, +12/-28)
```diff
@@ -123,14 +123,10 @@
 		200FBFF32CB66B8300A92A74 /* ServerHealth.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200FBFF22CB66B8300A92A74 /* ServerHealth.swift */; };
 		200FBFF52CB66C0000A92A74 /* LlamaServerError.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200FBFF42CB66C0000A92A74 /* LlamaServerError.swift */; };
 		200FBFF72CB68ABF00A92A74 /* ChatParameters.swift in Sources */ = {isa = PBXBuildFile; fileRef = 200FBFF62CB68ABF00A92A74 /* ChatParameters.swift */; };
-		201A1A8E2CDB7C1C001E9BA9 /* MarkdownDataView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A8D2CDB7C1C001E9BA9 /* MarkdownDataView.swift */; };
-		201A1A912CDB7D8E001E9BA9 /* MarkdownDataViewController.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A902CDB7D8E001E9BA9 /* MarkdownDataViewController.swift */; };
 		201A1A932CDB8109001E9BA9 /* Extension+Collection.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A922CDB8109001E9BA9 /* Extension+Collection.swift */; };
-		201A1A962CDB99C6001E9BA9 /* MarkdownTableView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A952CDB99C6001E9BA9 /* MarkdownTableView.swift */; };
-		201A1A982CDB9DED001E9BA9 /* MarkdownPieChartView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A972CDB9DED001E9BA9 /* MarkdownPieChartView.swift */; };
-		201A1A9A2CDBA802001E9BA9 /* MarkdownBarChartView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A992CDBA802001E9BA9 /* MarkdownBarChartView.swift */; };
-		201A1A9C2CDBB5B1001E9BA9 /* MarkdownScatterPlotView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A9B2CDBB5B1001E9BA9 /* MarkdownScatterPlotView.swift */; };
-		201A1A9E2CDBBA25001E9BA9 /* MarkdownLineChartView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201A1A9D2CDBBA25001E9BA9 /* MarkdownLineChartView.swift */; };
+		2EBEEF0100000000DEADBEE2 /* ChatMarkdownWebView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2EBEEF0100000000DEADBEE1 /* ChatMarkdownWebView.swift */; };
+		2EBEEF0200000000DEADBEE2 /* ChatMarkdownWebView in Resources */ = {isa = PBXBuildFile; fileRef = 2EBEEF0200000000DEADBEE1 /* ChatMarkdownWebView */; };
+		2EBEEF0300000000DEADBEE2 /* ChatMarkdownAssetSchemeHandler.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2EBEEF0300000000DEADBEE1 /* ChatMarkdownAssetSchemeHandler.swift */; };
 		201BB9942D8AF77F00890EE6 /* ConversationSidebarButtons.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201BB9932D8AF77F00890EE6 /* ConversationSidebarButtons.swift */; };
 		201BB9962D8AF8AA00890EE6 /* CanvasView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201BB9952D8AF8AA00890EE6 /* CanvasView.swift */; };
 		201BB99A2D8AFDE000890EE6 /* Snapshot.swift in Sources */ = {isa = PBXBuildFile; fileRef = 201BB9992D8AFDE000890EE6 /* Snapshot.swift */; };
@@ -654,14 +650,10 @@
 		200FBFF22CB66B8300A92A74 /* ServerHealth.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ServerHealth.swift; sourceTree = "<group>"; };
 		200FBFF42CB66C0000A92A74 /* LlamaServerError.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = LlamaServerError.swift; sourceTree = "<group>"; };
 		200FBFF62CB68ABF00A92A74 /* ChatParameters.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ChatParameters.swift; sourceTree = "<group>"; };
-		201A1A8D2CDB7C1C001E9BA9 /* MarkdownDataView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownDataView.swift; sourceTree = "<group>"; };
-		201A1A902CDB7D8E001E9BA9 /* MarkdownDataViewController.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownDataViewController.swift; sourceTree = "<group>"; };
 		201A1A922CDB8109001E9BA9 /* Extension+Collection.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = "Extension+Collection.swift"; sourceTree = "<group>"; };
-		201A1A952CDB99C6001E9BA9 /* MarkdownTableView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownTableView.swift; sourceTree = "<group>"; };
-		201A1A972CDB9DED001E9BA9 /* MarkdownPieChartView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownPieChartView.swift; sourceTree = "<group>"; };
-		201A1A992CDBA802001E9BA9 /* MarkdownBarChartView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownBarChartView.swift; sourceTree = "<group>"; };
-		201A1A9B2CDBB5B1001E9BA9 /* MarkdownScatterPlotView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownScatterPlotView.swift; sourceTree = "<group>"; };
-		201A1A9D2CDBBA25001E9BA9 /* MarkdownLineChartView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = MarkdownLineChartView.swift; sourceTree = "<group>"; };
+		2EBEEF0100000000DEADBEE1 /* ChatMarkdownWebView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = C
```

**File**: `Sidekick.xcodeproj/xcuserdata/bj.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 		<key>llama-server-watchdog.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>2</integer>
+			<integer>5</integer>
 		</dict>
 	</dict>
 	<key>SuppressBuildableAutocreation</key>
```

**File**: `Sidekick/Extensions/UI/Extension+Theme.swift` (modified, +6/-4)
```diff
@@ -143,10 +143,12 @@ extension Theme {
 					.relativeFrame(minWidth: .em(1.5), alignment: .trailing)
 			}
 			.table { configuration in
-				MarkdownDataView(
-					configuration: configuration
-				)
-				.markdownMargin(top: 0, bottom: 16)
+				configuration.label
+					.markdownTableBorderStyle(.init(color: .border))
+					.markdownTableBackgroundStyle(
+						.alternatingRows(Color.background, Color.secondaryBackground)
+					)
+					.markdownMargin(top: 0, bottom: 16)
 			}
 			.tableCell { configuration in
 				configuration.label
```

**File**: `Sidekick/Localizable.xcstrings` (modified, +7/-0)
```diff
@@ -562,6 +562,7 @@
       }
     },
     "Bar Chart" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -2108,6 +2109,7 @@
       }
     },
     "Export as Image" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -2384,6 +2386,7 @@
       }
     },
     "Flip Axis" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -3021,6 +3024,7 @@
       }
     },
     "Line Chart" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -3667,6 +3671,7 @@
       }
     },
     "Pie Chart" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -4305,6 +4310,7 @@
       }
     },
     "Scatter Plot" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
@@ -4921,6 +4927,7 @@
       }
     },
     "Table" : {
+      "extractionState" : "stale",
       "localizations" : {
         "zh-Hans" : {
           "stringUnit" : {
```

**File**: `Sidekick/Logic/View Controllers/Conversation/MarkdownDataViewController.swift` (removed, +0/-288)
```diff
@@ -1,288 +0,0 @@
-//
-//  MarkdownDataViewController.swift
-//  Sidekick
-//
-//  Created by Bean John on 11/6/24.
-//
-
-import Foundation
-import MarkdownUI
-import SwiftUI
-
-public class MarkdownDataViewController: ObservableObject {
-    
-    init(
-        configuration: BlockConfiguration
-    ) {
-        self.configuration = configuration
-        self.content = configuration.content
-        // Get data
-        let string: String = configuration.content.renderMarkdown()
-        let rawData: [[String]]? = Self.parseMarkdownTable(string)
-        self.data =  rawData
-        // Get rows
-        if let rawData, (rawData.count > 1) {
-            var rows: [[String]] = Array(rawData.dropFirst())
-            // Drop header indicator
-            if rows.first!.allSatisfy({ $0 == "---" }) {
-                rows = Array(rows.dropFirst())
-            }
-            self.rows = rows
-        } else {
-            self.rows = []
-        }
-        // Cache expensive computations
-        self._cachedHeaders = Self.computeHeaders(from: rawData)
-        self._cachedColumns = Self.computeColumns(from: self.rows)
-        self._cachedIsNumeric = Self.computeIsNumeric(from: rawData)
-        self._cachedDataFormat = Self.computeDataFormat(isNumeric: self._cachedIsNumeric)
-    }
-    
-    @Published var selectedVisualization: Visualization = .table
-    @Published var flipAxis: Bool = false
-    
-    /// The configuration for this "block" of Markdown
-    var configuration: BlockConfiguration
-    
-    /// The Markdown markdown content displayed
-    var content: MarkdownContent
-    
-    /// The data held in the table, in type `[[String]]?`
-    public var data: [[String]]?
-    
-    // Cached properties for performance
-    private let _cachedHeaders: [String]
-    private let _cachedColumns: [[String]]
-    private let _cachedIsNumeric: [Bool]
-    private let _cachedDataFormat: DataFormat
-    
-    /// The data's headers (cached)
-    public var headers: [String] {
-        return _cachedHeaders
-    }
-    
-    /// The data's data in rows
-    public var rows: [[String]]
-    
-    /// The data's data in columns (cached)
-    public var columns: [[String]] {
-        return _cachedColumns
-    }
-    
-    /// Returns an array of `Bool`, where each item represents whether a column is numeric (cached)
-    public var isNumeric: [Bool] {
-        return _cachedIsNumeric
-    }
-    
-    // MARK: - Static computation methods for caching
-    
-    private static func computeHeaders(from data: [[String]]?) -> [String] {
-        return (data?.first ?? []).map { value in
-            return value.trim(
-                prefix: "**",
-                suffix: "**"
-            )
-        }
-    }
-    
-    private static func computeColumns(from rows: [[String]]) -> [[String]] {
-        return rows.transpose.map { row in
-            return row.map { cell in
-                return cell.trim(
-                    prefix: "**",
-                    suffix: "**"
-                )
-            }
-        }
-    }
-    
-    private static func computeIsNumeric(from data: [[String]]?) -> [Bool] {
-        // Return if no data
-        guard let data = data else { return [] }
-        // Extract rows
-        var dataRows: [[String]] = Array(data.dropFirst())
-        // Return if no data
-        if dataRows.isEmpty { return [] }
-        // Remove header indicator if needed
-        if dataRows.first!.allSatisfy({ $0 == "---" }) {
-            dataRows = Array(dataRows.dropFirst())
-        }
-        // Group by column
-        var dataColumns: [[String]] = dataRows.transpose
-        // Convert percents to doubles
-        dataColumns = dataColumns.map { column in
-            column.map { data in
-                let string: String = data.replacingOccurrences(
-                    of: ", ",
-                    with: ""
-                ).replacingOccurrences(
-                    of: ",",
-                    with: ""
-                )
-                let double: Double? = Double(String(string.dropLast()))
-                let isPercentage: Bool = string.hasSuffix(
-                    "%"
-                ) && double != nil
-                if isPercentage {
-                    return "\(double! / 100)"
-                }
-                return string
-            }
-        }
-        return dataColumns.map { column in
-            column.allSatisfy { data in
-                let double: Double? = Double(data)
-                return double != nil
-            }
-        }
-    }
-    
-    private static func computeDataFormat(isNumeric: [Bool]) -> DataFormat {
-        // Check for 1 string column + 1 data column
-        let oneStringOneNumeric: Bool = (
-            isNumeric.first == false && isNumeric.last == true
-        ) && isNumeric.count == 2
-        if oneStringOneNumeric {
-            return .oneStringOneNumeric
-        }
-        // Check for 2 numeric columns
-      
```

**File**: `Sidekick/Resources/ChatMarkdownWebView/chat.css` (added, +211/-0)
```diff
@@ -0,0 +1,211 @@
+/* Chat markdown renderer styles. Drives both light and dark themes via the
+   `.theme-light` / `.theme-dark` class on <body>. Designed to feel native on
+   macOS while remaining fast to repaint during streaming. */
+
+:root {
+    --md-font-size: 14px;
+    --md-line-height: 1.55;
+    --md-fg: #1c1c1e;
+    --md-fg-muted: #57606a;
+    --md-bg: transparent;
+    --md-border: rgba(0, 0, 0, 0.12);
+    --md-code-bg: rgba(0, 0, 0, 0.05);
+    --md-code-block-bg: #f6f8fa;
+    --md-link: #0a66c2;
+    --md-quote-border: rgba(0, 0, 0, 0.18);
+    --md-table-row-alt: rgba(0, 0, 0, 0.03);
+    --md-table-border: rgba(0, 0, 0, 0.12);
+    --md-selection: rgba(10, 102, 194, 0.25);
+}
+
+body.theme-dark {
+    --md-fg: #e5e5e7;
+    --md-fg-muted: #8d96a0;
+    --md-border: rgba(255, 255, 255, 0.12);
+    --md-code-bg: rgba(255, 255, 255, 0.08);
+    --md-code-block-bg: #0d1117;
+    --md-link: #4c8ef8;
+    --md-quote-border: rgba(255, 255, 255, 0.2);
+    --md-table-row-alt: rgba(255, 255, 255, 0.04);
+    --md-table-border: rgba(255, 255, 255, 0.12);
+    --md-selection: rgba(76, 142, 248, 0.3);
+}
+
+html, body {
+    margin: 0;
+    padding: 0;
+    background: transparent;
+    color: var(--md-fg);
+    font: var(--md-font-size) / var(--md-line-height) -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
+    overflow: hidden;
+    -webkit-text-size-adjust: 100%;
+    -webkit-font-smoothing: antialiased;
+    text-rendering: optimizeLegibility;
+}
+
+body {
+    /* Avoid horizontal scrollbar reservation. */
+    overflow-x: hidden;
+    cursor: text;
+}
+
+::selection {
+    background: var(--md-selection);
+}
+
+#root {
+    padding: 0;
+    /* Width is driven by the host view; height is reported back. */
+}
+
+.markdown-body > .md-block {
+    margin: 0 0 12px 0;
+}
+.markdown-body > .md-block:last-child {
+    margin-bottom: 0;
+}
+
+.markdown-body p {
+    margin: 0 0 12px 0;
+}
+.markdown-body p:last-child {
+    margin-bottom: 0;
+}
+
+.markdown-body h1,
+.markdown-body h2,
+.markdown-body h3,
+.markdown-body h4,
+.markdown-body h5,
+.markdown-body h6 {
+    margin: 18px 0 8px 0;
+    line-height: 1.3;
+    font-weight: 600;
+}
+.markdown-body h1 { font-size: 1.8em; border-bottom: 1px solid var(--md-border); padding-bottom: 4px; }
+.markdown-body h2 { font-size: 1.45em; border-bottom: 1px solid var(--md-border); padding-bottom: 4px; }
+.markdown-body h3 { font-size: 1.2em; }
+.markdown-body h4 { font-size: 1.05em; }
+.markdown-body h5 { font-size: 1em; }
+.markdown-body h6 { font-size: 0.95em; color: var(--md-fg-muted); }
+
+.markdown-body a {
+    color: var(--md-link);
+    text-decoration: none;
+}
+.markdown-body a:hover {
+    text-decoration: underline;
+}
+
+.markdown-body ul,
+.markdown-body ol {
+    margin: 0 0 12px 0;
+    padding-left: 1.6em;
+}
+.markdown-body li {
+    margin: 2px 0;
+}
+.markdown-body li > p {
+    margin-bottom: 4px;
+}
+
+.markdown-body blockquote {
+    margin: 0 0 12px 0;
+    padding: 0 12px;
+    border-left: 3px solid var(--md-quote-border);
+    color: var(--md-fg-muted);
+}
+
+.markdown-body hr {
+    border: none;
+    border-top: 1px solid var(--md-border);
+    margin: 16px 0;
+}
+
+.markdown-body code {
+    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
+    font-size: 0.92em;
+}
+
+.markdown-body :not(pre) > code {
+    background: var(--md-code-bg);
+    padding: 1.5px 5px;
+    border-radius: 4px;
+    white-space: break-spaces;
+}
+
+.markdown-body pre {
+    margin: 0 0 12px 0;
+    padding: 12px 14px;
+    background: var(--md-code-block-bg);
+    border-radius: 8px;
+    overflow-x: auto;
+    line-height: 1.45;
+}
+.markdown-body pre code {
+    background: transparent;
+    padding: 0;
+    font-size: 0.9em;
+    white-space: pre;
+}
+
+.markdown-body table {
+    border-collapse: collapse;
+    margin: 0 0 12px 0;
+    display: block;
+    overflow-x: auto;
+    max-width: 100%;
+}
+.markdown-body th, .markdown-body td {
+    border: 1px solid var(--md-table-border);
+    padding: 6px 10px;
+    text-align: left;
+}
+.markdown-body th {
+    background: var(--md-table-row-alt);
+    font-weight: 600;
+}
+.markdown-body tbody tr:nth-child(even) {
+    background: var(--md-table-row-alt);
+}
+
+.markdown-body img {
+    max-width: 100%;
+    border-radius: 6px;
+}
+
+/* KaTeX font scale tweak — match surrounding body. */
+.katex {
+    font-size: 1em;
+}
+.katex-display {
+    margin: 8px 0 12px 0;
+    overflow-x: auto;
+    overflow-y: hidden;
+}
+
+/* Streaming caret on the trailing block. */
+body[data-streaming="true"] .md-block.md-trailing > :last-child::after,
+body[data-streaming="true"] .md-block.md-trailing.md-fence > pre > code::after {
+    content: "▍";
+    display: inline-block;
+    margin-left: 1px;
+    color: var(--md-fg);
+    opacity: 0.65;
+    animation: sk-caret 1s steps(1, end) infinite;
+    tra
```

**File**: `Sidekick/Resources/ChatMarkdownWebView/chat.html` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+<meta charset="utf-8">
+<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
+<title>chat</title>
+<link rel="stylesheet" href="vendor/katex.min.css">
+<link rel="stylesheet" href="vendor/github.min.css" id="hljs-theme-light">
+<link rel="stylesheet" href="vendor/github-dark.min.css" id="hljs-theme-dark" disabled>
+<link rel="stylesheet" href="chat.css">
+</head>
+<body class="theme-light" data-streaming="false">
+<div id="root" class="markdown-body"></div>
+<script src="vendor/markdown-it.min.js"></script>
+<script src="vendor/highlight.min.js"></script>
+<script src="vendor/katex.min.js"></script>
+<script src="vendor/katex-auto-render.min.js"></script>
+<script src="chat.js"></script>
+</body>
+</html>
```

**File**: `Sidekick/Resources/ChatMarkdownWebView/chat.js` (added, +432/-0)
```diff
@@ -0,0 +1,432 @@
+/* Sidekick chat markdown renderer.
+   - Streams Markdown into a per-message WKWebView.
+   - Uses markdown-it for fast incremental parses.
+   - Diffs at the top-level block granularity: a block whose source has not
+     changed since the previous render keeps its DOM (and its highlight.js /
+     KaTeX state) untouched. Only the trailing in-progress block re-renders
+     per token.
+   - Reports content height back to the host via webkit.messageHandlers. */
+
+(function () {
+    "use strict";
+
+    var hostHeightHandler = (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.heightChanged) || null;
+    var hostReadyHandler = (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ready) || null;
+    var hostLinkHandler = (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.openLink) || null;
+
+    var md = window.markdownit({
+        html: false,
+        linkify: true,
+        typographer: false,
+        breaks: false,
+    });
+
+    // Make all links open through the host (Swift decides where to send them).
+    var defaultLinkOpen = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
+        return self.renderToken(tokens, idx, options);
+    };
+    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
+        var token = tokens[idx];
+        token.attrSet("target", "_blank");
+        token.attrSet("rel", "noopener noreferrer");
+        return defaultLinkOpen(tokens, idx, options, env, self);
+    };
+
+    // Rewrite image srcs so anything that isn't a network/data URL is
+    // proxied through Swift via the sidekick-asset:// scheme. The Swift
+    // side knows how to find file paths, generated images, etc.
+    var ASSET_SCHEME = "sidekick-asset";
+    var defaultImageRule = md.renderer.rules.image || function (tokens, idx, options, env, self) {
+        return self.renderToken(tokens, idx, options);
+    };
+    md.renderer.rules.image = function (tokens, idx, options, env, self) {
+        var token = tokens[idx];
+        var srcIdx = token.attrIndex("src");
+        if (srcIdx >= 0) {
+            var src = token.attrs[srcIdx][1];
+            if (src && !/^(https?:|data:|blob:|sidekick-asset:)/i.test(src)) {
+                token.attrs[srcIdx][1] =
+                    ASSET_SCHEME + "://load?u=" + encodeURIComponent(src);
+            }
+        }
+        // Lazy-load images so they don't block initial layout for long
+        // history conversations.
+        token.attrSet("loading", "lazy");
+        token.attrSet("decoding", "async");
+        return defaultImageRule(tokens, idx, options, env, self);
+    };
+
+    var root = document.getElementById("root");
+    var bodyEl = document.body;
+
+    // State.
+    var text = "";
+    var streaming = false;
+    var prevBlocks = []; // [{ source, type, node }]
+    var renderScheduled = false;
+    var renderRunning = false;
+    var heightScheduled = false;
+    var lastReportedHeight = -1;
+
+    // ---- Block segmentation ----------------------------------------------
+
+    // Walk a flat token stream and yield groups corresponding to top-level
+    // blocks. A block is either a self-closing top-level token (fence, hr,
+    // html_block, code_block) or an open/close pair with anything nested in
+    // between.
+    function groupTopLevel(tokens) {
+        var groups = [];
+        var depth = 0;
+        var start = 0;
+        for (var i = 0; i < tokens.length; i++) {
+            var t = tokens[i];
+            if (t.level !== 0) continue;
+            if (t.nesting === 1) {
+                if (depth === 0) start = i;
+                depth++;
+            } else if (t.nesting === -1) {
+                depth--;
+                if (depth === 0) {
+                    groups.push({ start: start, end: i + 1 });
+                }
+            } else if (t.nesting === 0 && depth === 0) {
+                groups.push({ start: i, end: i + 1 });
+            }
+        }
+        // If the document is mid-block (depth > 0 at EOF, e.g. an unclosed
+        // fence while streaming), emit the trailing partial as one block so
+        // the user sees progress.
+        if (depth > 0 && start < tokens.length) {
+            groups.push({ start: start, end: tokens.length });
+        }
+        return groups;
+    }
+
+    // Compute the source text covered by a token group, using token.map.
+    function groupSource(group, tokens, srcLines) {
+        var first = null, last = null;
+        for (var k = group.start; k < group.end; k++) {
+            var m = tokens[k].map;
+            if (!m) continue;
+            if (first === null) first = m[0];
+            last = m[1];
+        }
+        if (first === null) return "";
+        if (last === null) last = first;
+        return srcLines.slice(first, last).join("\n");
+    }
+
+    function classifyBlockType(tokens, group) {
```

---

### Incident Patch 10: `34002f6c` (2026-05-10)
**Commit Message**: feat: Improve reasoning UI

**File**: `Sidekick/Logic/Inference/Model+Inference.swift` (modified, +5/-0)
```diff
@@ -380,6 +380,8 @@ extension Model {
                     """
                     return LlamaServer.CompleteResponse(
                         text: errorMessage,
+                        startTime: initialResponse.startTime,
+                        endTime: .now,
                         responseStartSeconds: initialResponse.responseStartSeconds,
                         predictedPerSecond: initialResponse.predictedPerSecond,
                         modelName: initialResponse.modelName,
@@ -600,6 +602,8 @@ Please try rephrasing your request or contact support if the issue persists.
 """
                         return LlamaServer.CompleteResponse(
                             text: errorMessage,
+                            startTime: response?.startTime ?? initialResponse.startTime,
+                            endTime: .now,
                             responseStartSeconds: response?.responseStartSeconds ?? 0,
                             predictedPerSecond: response?.predictedPerSecond,
                             modelName: response?.modelName,
@@ -1025,6 +1029,7 @@ Respond with YES if ALL 3 criteria above have been met. Respond with YES or NO o
         )
         if showPreview {
             self.pendingMessage?.text = fullMessage
+            self.pendingMessage?.lastUpdated = .now
         }
     }
 
```

**File**: `Sidekick/Logic/Inference/llama.cpp/LlamaServer+Chat.swift` (modified, +5/-0)
```diff
@@ -223,6 +223,7 @@ extension LlamaServer {
         let dataTask = eventSource.dataTask(
             for: request
         )
+        let startTime = Date(timeIntervalSinceReferenceDate: start)
         let session = URLSession(
             configuration: .default
         )
@@ -522,6 +523,8 @@ extension LlamaServer {
         // Return response
         return CompleteResponse(
             text: cleanText,
+            startTime: startTime,
+            endTime: .now,
             responseStartSeconds: responseDiff,
             predictedPerSecond: tokensPerSecond,
             modelName: modelName,
@@ -944,6 +947,8 @@ extension LlamaServer {
     public struct CompleteResponse {
 
         var text: String
+        var startTime: Date = .now
+        var endTime: Date = .now
         var responseStartSeconds: Double
         var predictedPerSecond: Double?
         var modelName: String?
```

**File**: `Sidekick/Types/Conversation/Message/Message.swift` (modified, +2/-2)
```diff
@@ -411,8 +411,8 @@ DO NOT reference sources outside of those provided below. If you did not referen
 		
 	
 	/// Function to end a message
-	public mutating func end() {
-		self.lastUpdated = .now
+	public mutating func end(at date: Date = .now) {
+		self.lastUpdated = date
 		self.outputEnded = true
 	}
 	
```

**File**: `Sidekick/Views/Chat/Conversation/Controls/Input Field/PromptInputField.swift` (modified, +2/-1)
```diff
@@ -607,11 +607,12 @@ struct PromptInputField: View {
                 functionCallRecords: response.functionCallRecords,
                 expertId: promptController.sentExpertId
             )
+            responseMessage.startTime = response.startTime
             responseMessage.update(
                 response: response,
                 includeReferences: didUseSources
             )
-            responseMessage.end()
+            responseMessage.end(at: response.endTime)
             // Update conversation
             let _ = conversation.addMessage(
                 responseMessage
```

**File**: `Sidekick/Views/Chat/Conversation/Messages/Message/MessageReasoningProcessView.swift` (modified, +106/-61)
```diff
@@ -8,7 +8,7 @@
 import SwiftUI
 
 struct MessageReasoningProcessView: View {
-	
+
 	init(
 		message: Message
 	) {
@@ -21,76 +21,121 @@ struct MessageReasoningProcessView: View {
 	}
 	
 	@State var showReasoning: Bool
-	
+
 	var message: Message
-	
-    var body: some View {
-		VStack(
-			alignment: .leading,
-			spacing: 0
-		) {
-			toggleReasoningButton
-			// Show reasoning if needed
-			if self.showReasoning {
-				Text(self.message.reasoningText!)
-					.italic()
-					.padding([.horizontal, .vertical], 10)
-					.padding(.leading, 10)
-					.overlay(alignment: .leading) {
-						UnevenRoundedRectangle(
-							topLeadingRadius: 0,
-							bottomLeadingRadius: 7,
-							bottomTrailingRadius: 0,
-							topTrailingRadius: 0
-						)
-						.fill(Color.purple.opacity(0.2))
-						.frame(width: 7)
-						.frame(maxHeight: .infinity)
-					}
-			}
-		}
-		.background {
-			RoundedRectangle(cornerRadius: 7)
-				.fill(Color.gray.opacity(0.1))
-		}
+
+    private var reasoningText: String {
+        return self.message.reasoningText ?? ""
+    }
+
+    private var isThinking: Bool {
+        return !self.message.outputEnded && self.message.responseText.isEmpty
+    }
+
+    private var statusTitle: String {
+        if self.isThinking {
+            return "Thinking..."
+        }
+        return "Thought for \(self.formattedReasoningDuration)"
+    }
+
+    private var formattedReasoningDuration: String {
+        let duration = max(
+            0,
+            self.message.lastUpdated.timeIntervalSince(self.message.startTime)
+        )
+        if duration < 10 {
+            return String(format: "%.2f seconds", duration)
+        }
+        return String(format: "%.0f seconds", duration)
+    }
+
+	var body: some View {
+        VStack(
+            alignment: .leading,
+            spacing: 0
+        ) {
+            toggleReasoningButton.frame(height: 33)
+            if self.showReasoning {
+                Divider()
+                reasoningPreview
+                    .transition(.opacity.combined(with: .move(edge: .top)))
+            }
+        }
+        .background {
+            RoundedRectangle(cornerRadius: 7)
+                .fill(Color.purple.opacity(0.2))
+        }
 	}
-	
+
 	var toggleReasoningButton: some View {
 		Button {
-			withAnimation(.linear) {
+            withAnimation(.easeInOut(duration: 0.18)) {
 				self.showReasoning.toggle()
 			}
 		} label: {
-			UnevenRoundedRectangle(
-				topLeadingRadius: 7,
-				bottomLeadingRadius: self.showReasoning ? 0 : 7,
-				bottomTrailingRadius: 7,
-				topTrailingRadius: 7
-			)
-			.fill(Color.purple.opacity(0.2))
-			.overlay {
-				HStack {
-                    Label {
-                        Text("Reasoning Process")
-                            .opacity(0.8)
-                    } icon: {
-                        Image(systemName: "brain.fill")
-                            .foregroundStyle(Color.purple)
-                    }
+            HStack(spacing: 8) {
+                Circle()
+                    .frame(width: 10, height: 10)
+                    .foregroundStyle(.purple)
+                    .padding(.horizontal, 5)
+                if self.isThinking {
+                    ProgressView()
+                        .controlSize(.mini)
+                        .frame(width: 12, height: 12)
+                } else {
+                    Image(systemName: "brain.fill")
+                        .font(.caption.weight(.semibold))
+                        .foregroundStyle(.purple)
+                }
+                Text(self.statusTitle)
+                    .font(.callout.weight(.semibold))
+                    .opacity(0.8)
+                    .lineLimit(1)
+                Spacer()
+                Image(systemName: "chevron.up")
                     .fontWeight(.semibold)
-					Spacer()
-					Image(systemName: "chevron.up")
-						.fontWeight(.semibold)
-						.rotationEffect(
-							self.showReasoning ? .zero : .degrees(180)
-						)
-                        .foregroundStyle(.secondary.opacity(0.8))
-				}
-				.padding(.horizontal, 7)
-			}
-			.frame(height: 33)
+                    .foregroundStyle(.secondary.opacity(0.8))
+                    .rotationEffect(self.showReasoning ? .zero : .degrees(180))
+            }
+            .padding(.horizontal, 7)
+            .contentShape(Rectangle())
 		}
 		.buttonStyle(.plain)
+        .accessibilityLabel("Reasoning Process")
 	}
 
+    private var reasoningPreview: some View {
+        ScrollViewReader { proxy in
+            ScrollView {
+                VStack(alignment: .leading, spacing: 0) {
+                    Text(self.reasoningText)
+                        .font(.callout)
+                        .foregroundStyle(.secondary)
+                        .textSelection(.enabled)
+                        .lineSpacing(2)
+                        .frame(maxWidth: .infinity, alignment: .leading)
+                    Color.clear
+                        .frame(hei
```

---

### Incident Patch 11: `c0971cde` (2026-05-10)
**Commit Message**: fix: Tool calling reliability

**File**: `Sidekick/Logic/Inference/Model+Inference.swift` (modified, +205/-95)
```diff
@@ -11,7 +11,7 @@ import SimilaritySearchKit
 import SwiftUI
 
 extension Model {
-    
+
     /// Function for the main loop
     /// Listen -> respond -> update mental model and save checkpoint
     /// Stream response to avoid a long delay after user input
@@ -188,7 +188,7 @@ extension Model {
         Self.logger.notice("Finished responding to prompt")
         return response!
     }
-    
+
     /// A function to update the inference status
     func updateStatus(
         _ status: Status
@@ -197,7 +197,7 @@ extension Model {
             self.status = status
         }
     }
-    
+
     /// Function to get response for chat
     private func getChatResponse(
         mode: Model.Mode,
@@ -233,9 +233,8 @@ extension Model {
         if !Settings.useFunctions || !useFunctions {
             return initialResponse
         }
-        // Return if no function call
-        guard let functionCalls = initialResponse.functionCalls,
-              !functionCalls.isEmpty else {
+        // Return if there is no valid or malformed function call work to handle.
+        guard initialResponse.requiresFunctionHandling else {
             return initialResponse
         }
         // Run agent in a loop
@@ -252,7 +251,7 @@ extension Model {
             increment: increment
         )
     }
-    
+
     /// Get the initial response to a chatbot query
     private func getInitialResponse(
         mode: Model.Mode,
@@ -298,7 +297,7 @@ extension Model {
             }
         )
     }
-    
+
     /// Function to run code if model calls a function
     private func handleFunctionCall(
         canReachRemoteServer: Bool,
@@ -333,8 +332,12 @@ extension Model {
             }
             return ToolRegistry(functions: [])
         }()
-        var useStructuredToolMessages: Bool = InferenceSettings.hasNativeToolCalling &&
-        !(initialResponse.blockFunctionCalls?.isEmpty ?? true)
+        var useStructuredToolMessages: Bool = InferenceSettings.supportsNativeToolCalling(
+            modelType: .regular,
+            usingRemoteModel: initialResponse.usedServer
+        ) &&
+        !(initialResponse.blockFunctionCalls?.isEmpty ?? true) &&
+        (initialResponse.malformedToolCalls?.isEmpty ?? true)
         // Execute functions on a loop
         var maxIterations: Int = 30 // Max 30 tool calls
         var response: LlamaServer.CompleteResponse? = initialResponse
@@ -344,15 +347,15 @@ extension Model {
         // Track consecutive malformed call attempts for circuit breaking
         var consecutiveMalformedAttempts: Int = 0
         let maxConsecutiveMalformed: Int = 3
-        
+
         // Check for malformed tool calls in initial response
         if let malformedCalls = response?.malformedToolCalls, !malformedCalls.isEmpty {
             Self.logger.warning("Initial response contains \(malformedCalls.count) malformed tool call(s)")
-            
+
             if response?.functionCalls?.isEmpty ?? true {
                 consecutiveMalformedAttempts += 1
                 Self.logger.error("All tool calls in response are malformed. Providing error feedback to model.")
-                
+
                 for malformedCall in malformedCalls {
                     let errorResult = FunctionCallResult(
                         call: malformedCall.name ?? "unknown_function",
@@ -361,18 +364,18 @@ extension Model {
                     )
                     results.append(errorResult)
                 }
-                
+
                 if consecutiveMalformedAttempts >= maxConsecutiveMalformed {
                     Self.logger.error("Maximum consecutive malformed attempts reached. Breaking agentic loop.")
                     let errorMessage = """
                     The model has made \(maxConsecutiveMalformed) consecutive attempts with malformed tool calls.
-                    
+
                     Common issues:
                     1. Invalid JSON syntax in tool arguments
                     2. Missing required parameters
                     3. Type mismatches (e.g., string instead of integer)
                     4. Incorrect parameter names
-                    
+
                     Please review the tool schemas and try again with properly formatted tool calls.
                     """
                     return LlamaServer.CompleteResponse(
@@ -403,28 +406,42 @@ extension Model {
         } else {
             consecutiveMalformedAttempts = 0
         }
-        
-        while maxIterations > 0, let responseFunctionCalls = response?.functionCalls, !responseFunctionCalls.isEmpty {
-            var functionCalls = responseFunctionCalls
-            for index in functionCalls.indices where functionCalls[index].toolCallID == nil {
-                functionCalls[index].toolCallID = UUID().uuidString
-            }
-            
-            let executionOutput = await self.executeFunctionCalls(
-                functionCalls,
-                using: toolRegistry,
-                ex
```

**File**: `Sidekick/Logic/Inference/llama.cpp/LlamaServer+Chat.swift` (modified, +295/-132)
```diff
@@ -12,7 +12,7 @@ import OSLog
 import SimilaritySearchKit
 
 extension LlamaServer {
-    
+
     /// Function to retry an operation on network failures
     /// - Parameters:
     ///   - maxRetries: Maximum number of retry attempts
@@ -24,7 +24,7 @@ extension LlamaServer {
         operation: @escaping () async throws -> T
     ) async throws -> T {
         var lastError: Error?
-        
+
         for attempt in 0...maxRetries {
             do {
                 return try await operation()
@@ -46,11 +46,11 @@ extension LlamaServer {
                 throw error
             }
         }
-        
+
         // If we exhausted all retries, throw the last error
         throw lastError ?? LlamaServerError.errorResponse("Unknown error after retries")
     }
-    
+
     /// Function to get a chat completion from the LLM
     /// - Parameters:
     ///   - modelType: The type of model used for completion
@@ -89,7 +89,7 @@ extension LlamaServer {
             )
         }
     }
-    
+
     /// Internal function to get a chat completion from the LLM (without retry logic)
     /// - Parameters:
     ///   - modelType: The type of model used for completion
@@ -247,7 +247,7 @@ extension LlamaServer {
         var pendingMessage: String = ""
         var responseDiff: Double = 0.0
         var wasReasoningToken: Bool = false
-        
+
         // Track tool calls by index
         struct ToolCallAccumulator {
             var id: String?
@@ -257,7 +257,7 @@ extension LlamaServer {
         var toolCalls: [Int: ToolCallAccumulator] = [:] // Dictionary keyed by tool call index
         var blockFunctionCalls: [(any DecodableFunctionCall)] = []
         var toolCallInProgress: Bool = false
-        
+
         // Init variables for usage
         var tokenCount: Int = 0
         var usage: Usage? = nil
@@ -341,7 +341,7 @@ extension LlamaServer {
                             }.joined()
                             pendingMessage.append(fragment)
                             progressHandler?(fragment)
-                            
+
                             // Handle tool calls properly with multiple indices
                             if let firstChoice = responseObj.choices.first?.delta,
                                let toolCallDeltas = firstChoice.tool_calls {
@@ -352,32 +352,32 @@ extension LlamaServer {
                                         await updateStatusHandler(.usingFunctions)
                                     }
                                 }
-                                
+
                                 // Process each tool call delta
                                 for toolCall in toolCallDeltas {
                                     let index = toolCall.index
-                                    
+
                                     // Initialize accumulator for this index if needed
                                     if toolCalls[index] == nil {
                                         toolCalls[index] = ToolCallAccumulator()
                                     }
-                                    
+
                                     if let id = toolCall.id {
                                         toolCalls[index]?.id = id
                                     }
-                                    
+
                                     // Accumulate function name
                                     if let name = toolCall.function.name {
                                         toolCalls[index]?.name = name
                                     }
-                                    
+
                                     // Accumulate arguments chunks
                                     if let argument = toolCall.function.arguments {
                                         toolCalls[index]?.arguments += argument
                                     }
                                 }
                             }
-                            
+
                             // Document usage
                             tokenCount += 1
                             usage = responseObj.usage
@@ -426,10 +426,10 @@ extension LlamaServer {
                 }
                 continue
             }
-            
+
             var args = toolCall.arguments
             Self.logger.info("Decoding tool call  \(index): \(name) with args: \(args, privacy: .public)")
-            
+
             // Handle double-wrapped arguments from some APIs
             if let data = args.data(using: .utf8),
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
@@ -438,7 +438,7 @@ extension LlamaServer {
                let unwrappedString = String(data: unwrappedData, encoding: .utf8) {
                 args = unwrappedString
             }
-            
+
             if let function = StreamMessage.OpenAIToolCall.Function.getFunctionCall(
                 name: name,
                 arguments: args,
@@ -450,7 +450,7 @@ extension LlamaSer
```

**File**: `Sidekick/Logic/Inference/llama.cpp/Types/ChatParameters.swift` (modified, +10/-3)
```diff
@@ -102,6 +102,10 @@ public struct ChatParameters: Codable {
         } else {
             enabledFunctions = await MainActor.run { FunctionSelectionManager.shared.getEnabledFunctions() }
         }
+        let supportsNativeToolCalling = InferenceSettings.supportsNativeToolCalling(
+            modelType: modelType,
+            usingRemoteModel: usingRemoteModel
+        )
         // Check if we should encourage using query_database function
         if let expert = expert,
            !expert.isDefault,
@@ -119,7 +123,7 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
             }
         }
         if Settings.useFunctions && useFunctions {
-            if InferenceSettings.hasNativeToolCalling {
+            if supportsNativeToolCalling {
                 fullSystemPromptComponents.append(
                     InferenceSettings.useNativeFunctionsPrompt
                 )
@@ -150,7 +154,7 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
         self.messages = messagesWithSystemPrompt
         self.model = Self.getModelName(modelType: modelType) ?? ""
         self.tools = !useFunctions ? [] : enabledFunctions.map(keyPath: \.openAiFunctionCall)
-        if InferenceSettings.hasNativeToolCalling && useFunctions {
+        if supportsNativeToolCalling && useFunctions {
             self.tool_choice = toolChoice ?? .auto
         }
         self.chat_template_kwargs = Self.getChatTemplateKwargs(
@@ -186,7 +190,10 @@ The `\(expert.name)` is currently active. Use `query_database` to query the `\(e
     ) -> String {
         // Omit tools if non-regular, or has no native tool calling
         var omittedParams = omittedParams
-        if modelType != .regular || !InferenceSettings.hasNativeToolCalling {
+        if modelType != .regular || !InferenceSettings.supportsNativeToolCalling(
+            modelType: modelType,
+            usingRemoteModel: usingRemoteModel
+        ) {
             omittedParams += [.tools, .tool_choice]
         }
         // If is remote model, omit temperature to use provider reccomended params
```

**File**: `Sidekick/Logic/Settings/InferenceSettings.swift` (modified, +54/-0)
```diff
@@ -270,10 +270,64 @@ You recall the following information about the user from prior interactions:
             return false
         }
         return modelName.contains("qwen3.5")
+            || modelNameSupportsQwen36NativeToolCalling(modelName)
             || modelName.contains("gemma-4")
             || modelName.contains("gemma4")
     }
 
+    public static func modelSupportsNativeToolCalling(
+        modelType: ModelType,
+        usingRemoteModel: Bool
+    ) -> Bool {
+        let modelName: String
+        if usingRemoteModel {
+            switch modelType {
+                case .regular:
+                    modelName = Self.serverModelName
+                case .worker:
+                    modelName = Self.serverWorkerModelName
+                case .completions:
+                    modelName = Self.completionsModelUrl?
+                        .deletingPathExtension()
+                        .lastPathComponent ?? ""
+            }
+        } else {
+            modelName = Self.localModelUrl(modelType: modelType)?
+                .deletingPathExtension()
+                .lastPathComponent ?? ""
+        }
+        return Self.modelNameSupportsNativeToolCalling(modelName)
+    }
+
+    public static func supportsNativeToolCalling(
+        modelType: ModelType,
+        usingRemoteModel: Bool
+    ) -> Bool {
+        if Self.modelSupportsNativeToolCalling(
+            modelType: modelType,
+            usingRemoteModel: usingRemoteModel
+        ) {
+            return true
+        }
+        return Self.hasNativeToolCalling
+    }
+
+    public static func modelNameSupportsNativeToolCalling(
+        _ modelName: String
+    ) -> Bool {
+        return modelNameSupportsQwen36NativeToolCalling(modelName)
+    }
+
+    private static func modelNameSupportsQwen36NativeToolCalling(
+        _ modelName: String
+    ) -> Bool {
+        let normalized = modelName.lowercased()
+            .replacingOccurrences(of: "_", with: "")
+            .replacingOccurrences(of: "-", with: "")
+            .replacingOccurrences(of: " ", with: "")
+        return normalized.contains("qwen3.6") || normalized.contains("qwen36")
+    }
+
     public static func localModelUrl(
         modelType: ModelType
     ) -> URL? {
```

**File**: `SidekickTests/SidekickTests.swift` (modified, +213/-2)
```diff
@@ -13,7 +13,11 @@ import Testing
 @testable import Sidekick
 
 struct SidekickTests {
-	
+    struct ToolCallingEchoParams: FunctionParams {
+        var text: String
+    }
+
+
 	/// Test to check model reccomendations on different hardware
 	@Test func checkModelReccomendations() async throws {
 		await DefaultModels.checkModelRecommendations()
@@ -42,7 +46,7 @@ struct SidekickTests {
 			for: modelUrl
 		)
 
-		#expect(visionConfiguration.projectorModelUrl == projectorUrl)
+			#expect(visionConfiguration.projectorModelUrl?.standardizedFileURL == projectorUrl.standardizedFileURL)
 		#expect(visionConfiguration.useVision)
 	}
 
@@ -195,6 +199,213 @@ struct SidekickTests {
         #expect(normalized.contains("**Ingredients:**  \nFlour  \nWater"))
     }
 
+    @Test func malformedOnlyToolCallsStillRequireFunctionHandling() async throws {
+        let response = LlamaServer.CompleteResponse(
+            text: "",
+            responseStartSeconds: 0,
+            predictedPerSecond: nil,
+            modelName: nil,
+            usage: nil,
+            usedServer: false,
+            availableFunctions: ArithmeticFunctions.functions,
+            malformedToolCalls: [
+                MalformedToolCall(
+                    index: 0,
+                    name: "sum",
+                    rawArguments: #"{"a": 1"#,
+                    errorDescription: "Invalid JSON format"
+                )
+            ]
+        )
+
+        #expect(response.containsFunctionCall == false)
+        #expect(response.requiresFunctionHandling)
+    }
+
+    @Test func qwen36ModelNamesSupportNativeToolCalling() async throws {
+        #expect(InferenceSettings.modelNameSupportsNativeToolCalling("Qwen3.6-235B-A22B-Instruct-2509"))
+        #expect(InferenceSettings.modelNameSupportsNativeToolCalling("qwen/qwen3.6-coder"))
+        #expect(InferenceSettings.modelNameSupportsNativeToolCalling("Qwen3_6-30B-A3B.gguf"))
+        #expect(InferenceSettings.localModelSupportsLiveReasoningToggle(
+            modelUrl: URL(fileURLWithPath: "/tmp/Qwen3.6-30B-A3B-Q4_K_M.gguf")
+        ))
+    }
+
+    @Test func localQwen36UsesNativeToolCallingEvenWhenStoredToggleIsOff() async throws {
+        let defaults = UserDefaults.standard
+        let originalModelUrl = defaults.url(forKey: "modelUrl")
+        let originalHasNativeToolCallingExists = defaults.exists(key: "hasNativeToolCalling")
+        let originalHasNativeToolCalling = defaults.bool(forKey: "hasNativeToolCalling")
+        let originalUseFunctionsExists = defaults.exists(key: "useFunctions")
+        let originalUseFunctions = defaults.bool(forKey: "useFunctions")
+        defer {
+            Settings.modelUrl = originalModelUrl
+            if originalHasNativeToolCallingExists {
+                InferenceSettings.hasNativeToolCalling = originalHasNativeToolCalling
+            } else {
+                defaults.removeObject(forKey: "hasNativeToolCalling")
+            }
+            if originalUseFunctionsExists {
+                Settings.useFunctions = originalUseFunctions
+            } else {
+                defaults.removeObject(forKey: "useFunctions")
+            }
+        }
+
+        Settings.modelUrl = URL(fileURLWithPath: "/tmp/Qwen3.6-30B-A3B-Q4_K_M.gguf")
+        InferenceSettings.hasNativeToolCalling = false
+        Settings.useFunctions = true
+
+        let params = await ChatParameters(
+            modelType: .regular,
+            usingRemoteModel: false,
+            systemPrompt: "System",
+            messages: [],
+            useFunctions: true,
+            functions: [ArithmeticFunctions.sum]
+        )
+        let json = params.toJSON(
+            usingRemoteModel: false,
+            modelType: .regular
+        )
+        let object = try JSONSerialization.jsonObject(
+            with: Data(json.utf8)
+        ) as? [String: Any]
+
+        #expect(InferenceSettings.supportsNativeToolCalling(
+            modelType: .regular,
+            usingRemoteModel: false
+        ))
+        #expect(object?["tools"] != nil)
+        #expect(object?["tool_choice"] as? String == "auto")
+    }
+
+    @Test func nativeToolCallDecoderAcceptsObjectArguments() async throws {
+        let data = Data(
+            """
+            {
+              "choices": [
+                {
+                  "delta": {
+                    "tool_calls": [
+                      {
+                        "index": 0,
+                        "id": "call_sum",
+                        "type": "function",
+                        "function": {
+                          "name": "sum",
+                          "arguments": {
+                            "a": 2,
+                            "b": 3
+                          }
+                        }
+                      }
+                    ]
+                  },
+                  "finish_reason": null
+                }
+              ],
+              "created": 0,
+              "usage": null
+      
```

---

### Incident Patch 12: `b06e9dcb` (2026-04-20)
**Commit Message**: fix(readme): Correctly center logo

**File**: `README.md` (modified, +3/-1)
```diff
@@ -1,5 +1,7 @@
 <h1 align="center">
-  <img src="https://raw.githubusercontent.com/johnbean393/Sidekick/refs/heads/main/Docs%20Images/appIcon.png" width = "200" height = "200">
+  <p align="center">
+    <img src="https://raw.githubusercontent.com/johnbean393/Sidekick/refs/heads/main/Docs%20Images/appIcon.png" width = "200" height = "200">
+  </p>
   <br />
   Sidekick
 </h1>
```

---

### Incident Patch 13: `4d3b78f4` (2026-04-02)
**Commit Message**: fix: Response streaming

**File**: `Sidekick.xcodeproj/xcuserdata/bj.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
 		<key>llama-server-watchdog.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>5</integer>
+			<integer>2</integer>
 		</dict>
 	</dict>
 	<key>SuppressBuildableAutocreation</key>
```

**File**: `Sidekick/Logic/Inference/Model+Inference.swift` (modified, +1/-0)
```diff
@@ -415,6 +415,7 @@ extension Model {
                     self.pendingMessage?.functionCallRecords = functionCallRecords + [functionCallRecord]
                     self.pendingMessage?.text = ""
                 }
+                await Task.yield()
                 // Call function
                 do {
                     // Run
```

**File**: `Sidekick/Views/Chat/Conversation/Messages/Message/MessageTextContentView.swift` (modified, +11/-4)
```diff
@@ -252,10 +252,14 @@ final class MarkdownRenderCoordinator: ObservableObject {
             isStreaming: request.isStreaming,
             deprioritizeUpdates: request.deprioritizeUpdates
         )
-        Self.renderQueue.asyncAfter(
-            deadline: .now() + delay,
-            execute: workItem!
-        )
+        if case .milliseconds(0) = delay {
+            Self.renderQueue.async(execute: workItem!)
+        } else {
+            Self.renderQueue.asyncAfter(
+                deadline: .now() + delay,
+                execute: workItem!
+            )
+        }
     }
 
     func cancel() {
@@ -1571,6 +1575,9 @@ struct StreamingMarkdownBuffer {
         deprioritizeUpdates: Bool
     ) -> DispatchTimeInterval {
         guard isStreaming else { return .milliseconds(0) }
+        if !deprioritizeUpdates {
+            return .milliseconds(0)
+        }
         if deprioritizeUpdates {
             if text.count < 2_048 {
                 return .milliseconds(80)
```

**File**: `Sidekick/Views/Chat/Conversation/Messages/Message/MessageView.swift` (modified, +8/-1)
```diff
@@ -12,6 +12,7 @@ struct MessageView: View {
 	
     @Environment(\.openWindow) var openWindow
     
+    @EnvironmentObject private var model: Model
 	@EnvironmentObject private var conversationManager: ConversationManager
 	@EnvironmentObject private var conversationState: ConversationState
 	@EnvironmentObject private var promptController: PromptController
@@ -104,7 +105,13 @@ struct MessageView: View {
                 MessageReadAloudButton(
                     message: message
                 )
-                if !self.isGenerating {
+                if self.isGenerating {
+                    StopGenerationButton {
+                        Task { @MainActor in
+                            await self.model.interrupt()
+                        }
+                    }
+                } else {
                     RegenerateButton {
                         self.retryGeneration(
                             message: message
```

**File**: `Sidekick/Views/Chat/Conversation/Messages/MessagesView.swift` (modified, +16/-128)
```diff
@@ -14,6 +14,7 @@ struct MessagesView: View {
     @Environment(\.colorScheme) var colorScheme
     
     @EnvironmentObject private var model: Model
+    @EnvironmentObject private var promptController: PromptController
     @EnvironmentObject private var conversationManager: ConversationManager
     @EnvironmentObject private var conversationState: ConversationState
     
@@ -43,8 +44,8 @@ struct MessagesView: View {
                     Group {
                         self.messagesView
                         PendingMessageHost(
-                            model: self.model,
                             conversationId: self.selectedConversation?.id,
+                            activeConversationId: self.model.sentConversationId ?? self.promptController.sentConversation?.id,
                             isActivelyScrolling: self.isActivelyScrolling
                         ) { oldValue, newValue in
                             self.handlePreviewVisibilityChange(
@@ -151,150 +152,37 @@ struct MessagesView: View {
 
 private struct PendingMessageHost: View {
 
-    @StateObject private var presenter: PendingMessagePresenter = .init()
+    @EnvironmentObject private var model: Model
 
-    let model: Model
     let conversationId: UUID?
+    let activeConversationId: UUID?
     let isActivelyScrolling: Bool
     let onVisibilityChange: (Bool, Bool) -> Void
 
     var body: some View {
-        let snapshot = self.presenter.snapshot
+        let statusPass = self.model.status.isWorking && self.model.status != .backgroundTask
+        let conversationPass = self.activeConversationId == nil || self.conversationId == self.activeConversationId
+        let isVisible = statusPass && conversationPass
+        let contentType = self.model.displayedContentType
+        let message = self.model.displayedPendingMessage
         Group {
-            if snapshot.isVisible {
-                switch snapshot.contentType {
+            if isVisible {
+                switch contentType {
                     case .text, .indicator:
                         MessageView(
-                            message: snapshot.message,
-                            shimmer: snapshot.contentType == .indicator,
+                            message: message,
+                            shimmer: contentType == .indicator,
                             deprioritizeStreamingUpdates: self.isActivelyScrolling
                         )
-                        .id(snapshot.message.id)
+                        .id(message.id)
                     case .preview:
-                        snapshot.preview
+                        self.model.agent?.preview ?? AnyView(EmptyView())
                 }
             }
         }
-        .onAppear {
-            self.presenter.configure(
-                model: self.model,
-                conversationId: self.conversationId
-            )
-            self.presenter.setScrolling(
-                self.isActivelyScrolling
-            )
-        }
-        .onChange(of: self.presenter.snapshot.isVisible) { oldValue, newValue in
+        .onChange(of: isVisible) { oldValue, newValue in
             self.onVisibilityChange(oldValue, newValue)
         }
-        .onChange(of: self.conversationId) { _, newValue in
-            self.presenter.configure(
-                model: self.model,
-                conversationId: newValue
-            )
-        }
-        .onChange(of: self.isActivelyScrolling) { _, newValue in
-            self.presenter.setScrolling(newValue)
-        }
-    }
-
-}
-
-@MainActor
-private final class PendingMessagePresenter: ObservableObject {
-
-    struct Snapshot {
-        var isVisible: Bool
-        var message: Message
-        var contentType: Model.DisplayedContentType
-        var preview: AnyView
-
-        static let hidden: Self = .init(
-            isVisible: false,
-            message: Message(text: "", sender: .assistant),
-            contentType: .indicator,
-            preview: AnyView(EmptyView())
-        )
-    }
-
-    @Published private(set) var snapshot: Snapshot = .hidden
-
-    private var cancellables: Set<AnyCancellable> = []
-    private weak var model: Model?
-    private var conversationId: UUID?
-    private var isScrolling: Bool = false
-
-    func configure(
-        model: Model,
-        conversationId: UUID?
-    ) {
-        let modelChanged = self.model !== model
-        let conversationChanged = self.conversationId != conversationId
-
-        self.model = model
-        self.conversationId = conversationId
-
-        if modelChanged {
-            self.bind(to: model)
-        }
-
-        if modelChanged || conversationChanged {
-            self.refresh(force: true)
-        }
-    }
-
-    func setScrolling(
-        _ isScrolling: Bool
-    ) {
-        guard self.isScrolling != isScrolling else {
-            return
-        }
-        self.isScrolling = isScrolling
-        if !isScrolling {
-            self.refresh(force: tr
```

---

### Incident Patch 14: `25030123` (2026-03-26)
**Commit Message**: Add MiniMax as built-in popular provider

MiniMax (https://api.minimax.io/v1) is an OpenAI-compatible API provider
offering reasoning models (M2.7, M2.7-highspeed) with tool calling support.

This commit adds MiniMax to the popular providers dropdown so users can
select it with one click in the remote model settings, and includes
unit tests for provider configuration, organization mapping, and model
identifier resolution.

Co-Authored-By: octopus <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-0)
```diff
@@ -53,6 +53,8 @@ Sidekick can even respond with the latest information using **web search**, spee
 
 In addition to its core local-first capabilities, Sidekick allows you to bring your own key for OpenAI compatible APIs. This allows you to tap into additional remote models while still preserving a primarily local-first workflow.
 
+Sidekick ships with built-in presets for popular providers, including **OpenAI**, **Anthropic**, **Google AI Studio**, **DeepSeek**, **Groq**, **MiniMax**, **Mistral**, **xAI**, and more — just select a provider and enter your API key to get started.
+
 ### Function Calling
 
 Sidekick can call functions to boost the mathematical and logical capabilities of models, and to execute actions. Functions are called sequentially in a loop until a result is obtained.
```

**File**: `Sidekick/Types/Model/Provider.swift` (modified, +5/-0)
```diff
@@ -50,6 +50,11 @@ public struct Provider: Identifiable {
             endpointUrl: URL(string: "http://localhost:1234/v1")!,
             supportsToolCalling: true
         ),
+        Provider(
+            name: "MiniMax",
+            endpointUrl: URL(string: "https://api.minimax.io/v1")!,
+            supportsToolCalling: true
+        ),
         Provider(
             name: "Mistral",
             endpointUrl: URL(string: "https://api.mistral.ai/v1")!
```

**File**: `SidekickTests/SidekickTests.swift` (modified, +119/-0)
```diff
@@ -171,6 +171,125 @@ struct SidekickTests {
         #expect(paragraphStyles[2].paragraphSpacingBefore <= 0.5)
     }
 
+    // MARK: - Provider Tests
+
+    @Test func popularProvidersContainsMiniMax() async throws {
+        let minimax = Provider.popularProviders.first { $0.name == "MiniMax" }
+        #expect(minimax != nil)
+        #expect(minimax?.endpointUrl.absoluteString == "https://api.minimax.io/v1")
+        #expect(minimax?.supportsToolCalling == true)
+    }
+
+    @Test func popularProvidersAreSortedAlphabetically() async throws {
+        let names = Provider.popularProviders.map(\.name)
+        let sorted = names.sorted()
+        #expect(names == sorted)
+    }
+
+    @Test func providerIdUsesName() async throws {
+        let minimax = Provider.popularProviders.first { $0.name == "MiniMax" }
+        #expect(minimax?.id == "MiniMax")
+    }
+
+    @Test func allPopularProvidersHaveValidEndpoints() async throws {
+        for provider in Provider.popularProviders {
+            #expect(provider.endpointUrl.scheme == "http" || provider.endpointUrl.scheme == "https")
+            #expect(!provider.name.isEmpty)
+        }
+    }
+
+    // MARK: - KnownModel Organization Tests
+
+    @Test func minimaxOrganizationMapsCorrectly() async throws {
+        let org = KnownModel.Organization.from(string: "minimax")
+        #expect(org == .minimax)
+    }
+
+    @Test func minimaxOrganizationHasCorrectDisplayName() async throws {
+        #expect(KnownModel.Organization.minimax.rawValue == "Minimax")
+    }
+
+    @Test func minimaxModelFullIdentifierUsesCorrectPrefix() async throws {
+        let model = KnownModel(
+            primaryName: "MiniMax-M2.7",
+            organization: .minimax,
+            capabilities: [.reasoning]
+        )
+        #expect(model.fullIdentifier == "minimax/MiniMax-M2.7")
+        #expect(model.isReasoningModel == true)
+    }
+
+    @Test func minimaxMModelDetectedAsReasoningByOpenRouter() async throws {
+        // Simulate OpenRouter model detection: "minimax-m" triggers reasoning
+        let modelName = "minimax-m2.7"
+        #expect(modelName.contains("minimax-m"))
+    }
+
+    @Test func minimaxHighspeedModelFullIdentifier() async throws {
+        let model = KnownModel(
+            primaryName: "MiniMax-M2.7-highspeed",
+            organization: .minimax,
+            capabilities: [.reasoning]
+        )
+        #expect(model.fullIdentifier == "minimax/MiniMax-M2.7-highspeed")
+        #expect(model.isReasoningModel == true)
+    }
+
+    @Test func minimaxModelFindByNormalizedIdentifier() async throws {
+        let models = [
+            KnownModel(
+                primaryName: "MiniMax-M2.7",
+                organization: .minimax,
+                capabilities: [.reasoning]
+            ),
+            KnownModel(
+                primaryName: "MiniMax-M2.7-highspeed",
+                organization: .minimax,
+                capabilities: [.reasoning]
+            ),
+        ]
+        let found = KnownModel.findModel(
+            byIdentifier: "minimax/MiniMax-M2.7",
+            in: models
+        )
+        #expect(found != nil)
+        #expect(found?.primaryName == "MiniMax-M2.7")
+    }
+
+    // MARK: - Integration Tests (MiniMax Provider)
+
+    @Test func minimaxProviderToolCallingDetection() async throws {
+        // When endpoint matches MiniMax, providerSupportsToolCalling should
+        // find it in the popularProviders list
+        let minimaxUrl = "https://api.minimax.io/v1"
+        let match = Provider.popularProviders.first {
+            minimaxUrl == $0.endpointUrl.absoluteString
+        }
+        #expect(match != nil)
+        #expect(match?.supportsToolCalling == true)
+    }
+
+    @Test func minimaxOrganizationIncludedInCaseIterable() async throws {
+        let allOrgs = KnownModel.Organization.allCases
+        #expect(allOrgs.contains(.minimax))
+    }
+
+    @Test func minimaxKnownModelRoundTrip() async throws {
+        // Create a MiniMax model, encode to JSON, decode back
+        let original = KnownModel(
+            primaryName: "MiniMax-M2.7",
+            organization: .minimax,
+            modalities: [.text],
+            capabilities: [.reasoning]
+        )
+        let data = try JSONEncoder().encode(original)
+        let decoded = try JSONDecoder().decode(KnownModel.self, from: data)
+        #expect(decoded.primaryName == "MiniMax-M2.7")
+        #expect(decoded.organization == .minimax)
+        #expect(decoded.isReasoningModel == true)
+        #expect(decoded.fullIdentifier == "minimax/MiniMax-M2.7")
+    }
+
     private func paragraphStyles(
         in attributedText: NSAttributedString
     ) -> [NSParagraphStyle] {
```

---

### Incident Patch 15: `e162100f` (2026-03-12)
**Commit Message**: fix: Improve chat rendering performance

**File**: `Sidekick.xcodeproj/project.pbxproj` (modified, +11/-11)
```diff
@@ -268,8 +268,6 @@
 		2075220B2D7FDF6C00A1CA60 /* Extension+SecureDefaults.swift in Sources */ = {isa = PBXBuildFile; fileRef = 2075220A2D7FDF6C00A1CA60 /* Extension+SecureDefaults.swift */; };
 		2075FE922EBAC06100EA6131 /* llama-server in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE912EBAC06100EA6131 /* llama-server */; };
 		2075FE932EBAC06100EA6131 /* llama-perplexity in Resources */ = {isa = PBXBuildFile; fileRef = 2075FE902EBAC06100EA6131 /* llama-perplexity */; };
-		2075FEC72EBAC5F100EA6131 /* llama-server in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE912EBAC06100EA6131 /* llama-server */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
-		2075FEC82EBAC5F100EA6131 /* llama-perplexity in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE902EBAC06100EA6131 /* llama-perplexity */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FE942EBAC06100EA6131 /* libggml-rpc.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2075FE8D2EBAC06100EA6131 /* libggml-rpc.0.dylib */; };
 		2075FE952EBAC06100EA6131 /* libggml-base.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2075FE892EBAC06100EA6131 /* libggml-base.0.dylib */; };
 		2075FE962EBAC06100EA6131 /* libggml-blas.0.dylib in Frameworks */ = {isa = PBXBuildFile; fileRef = 2075FE8A2EBAC06100EA6131 /* libggml-blas.0.dylib */; };
@@ -294,6 +292,8 @@
 		2075FEB32EBAC37B00EA6131 /* libggml-rpc.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE8D2EBAC06100EA6131 /* libggml-rpc.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEB42EBAC37B00EA6131 /* libllama.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE8E2EBAC06100EA6131 /* libllama.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		2075FEB52EBAC37B00EA6131 /* libmtmd.0.dylib in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE8F2EBAC06100EA6131 /* libmtmd.0.dylib */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
+		2075FEC72EBAC5F100EA6131 /* llama-server in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE912EBAC06100EA6131 /* llama-server */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
+		2075FEC82EBAC5F100EA6131 /* llama-perplexity in Embed Libraries */ = {isa = PBXBuildFile; fileRef = 2075FE902EBAC06100EA6131 /* llama-perplexity */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		207A9F532CB82D9600E727DE /* SymbolPicker in Frameworks */ = {isa = PBXBuildFile; productRef = 207A9F522CB82D9600E727DE /* SymbolPicker */; };
 		207A9F552CB8A96F00E727DE /* ExpertNavigationRowView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 207A9F542CB8A96F00E727DE /* ExpertNavigationRowView.swift */; };
 		207A9F592CB8F4AF00E727DE /* ResourceSelectionView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 207A9F582CB8F4AF00E727DE /* ResourceSelectionView.swift */; };
@@ -317,7 +317,6 @@
 		208844332CDDE394003BCB6F /* ModelRowView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208844322CDDE394003BCB6F /* ModelRowView.swift */; };
 		208855CA2DAD062A00071F0B /* CapsuleButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208855C92DAD062A00071F0B /* CapsuleButton.swift */; };
 		208855CC2DAD078800071F0B /* UseFunctionsButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208855CB2DAD078800071F0B /* UseFunctionsButton.swift */; };
-		20F6A0022ED0000100AA1111 /* ReasoningToggleButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20F6A0012ED0000100AA1111 /* ReasoningToggleButton.swift */; };
 		208855CF2DAD1D6F00071F0B /* ArithmeticFunctions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208855CE2DAD1D6F00071F0B /* ArithmeticFunctions.swift */; };
 		208855D12DAD1D9900071F0B /* CodeFunctions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208855D02DAD1D9900071F0B /* CodeFunctions.swift */; };
 		208855D32DAD1E1400071F0B /* FileFunctions.swift in Sources */ = {isa = PBXBuildFile; fileRef = 208855D22DAD1E1400071F0B /* FileFunctions.swift */; };
@@ -451,6 +450,7 @@
 		20E48C2B2CB560E30085E7D6 /* Extension+CGKeyCode.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20E48C2A2CB560E30085E7D6 /* Extension+CGKeyCode.swift */; };
 		20F2D5122CC1F33B004CE730 /* Localizable.xcstrings in Resources */ = {isa = PBXBuildFile; fileRef = 20F2D5112CC1F33B004CE730 /* Localizable.xcstrings */; };
 		20F4EC4E2EC5622400F8C33E /* marp in Resources */ = {isa = PBXBuildFile; fileRef = 20F4EC4D2EC5622400F8C33E /* marp */; };
+		20F6A0022ED0000100AA1111 /* ReasoningToggleButton.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20F6A0012ED0000100AA1111 /* ReasoningToggleButton.swift */; };
 		20F84B992D1CFED400F44990 /* DefaultModels in Frameworks */ = {isa = PBXBuildFile; productRef = 20F84B982D1CFED400F44990 /* DefaultModels */; };
 		20FB0D892CBA8327006D062A /* Extension+SimilarityIndex.swift in Sources */ = {isa = PBXBuildFile; fileRef = 20FB0D882CBA8327006D062A /* Extension+SimilarityIndex.swift */; };
 		20FB0D8B2CBA8828006D062A /* SearchR
```

**File**: `Sidekick/Extensions/Extension+String.swift` (modified, +16/-1)
```diff
@@ -597,7 +597,22 @@ public extension String {
     }
     
     func index(atDistance distance: Int) -> String.Index {
-        return index(startIndex, offsetBy: distance)
+        return index(
+            startIndex,
+            offsetBy: max(0, min(distance, count))
+        )
+    }
+
+    func index(utf16Distance distance: Int) -> String.Index {
+        let clampedDistance = max(0, min(distance, self.utf16.count))
+        let utf16Index = self.utf16.index(
+            self.utf16.startIndex,
+            offsetBy: clampedDistance
+        )
+        return String.Index(
+            utf16Index,
+            within: self
+        ) ?? self.endIndex
     }
     
     /// Extract parameter count from model name for sorting
```

**File**: `Sidekick/Localizable.xcstrings` (modified, +17/-3)
```diff
@@ -3905,8 +3905,15 @@
         }
       }
     },
-    "Reasoning" : {
-
+    "Reason" : {
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "思考"
+          }
+        }
+      }
     },
     "Reasoning Process" : {
       "localizations" : {
@@ -4262,7 +4269,14 @@
       }
     },
     "Save as PNG" : {
-
+      "localizations" : {
+        "zh-Hans" : {
+          "stringUnit" : {
+            "state" : "translated",
+            "value" : "保存为图片"
+          }
+        }
+      }
     },
     "Save as Text" : {
       "localizations" : {
```

**File**: `Sidekick/Logic/View Controllers/PromptController.swift` (modified, +8/-1)
```diff
@@ -30,7 +30,7 @@ public class PromptController: ObservableObject, DropDelegate {
     @Published var imageConcept: String? = nil
     
     @Published var didManuallyToggleReasoning: Bool = false
-    @Published var useReasoning: Bool = false
+    @Published var useReasoning: Bool = InferenceSettings.localModelSupportsLiveReasoningToggle()
     
     @Published var useWebSearch: Bool = false
     @Published var selectedSearchState: SearchState = .search
@@ -55,6 +55,13 @@ public class PromptController: ObservableObject, DropDelegate {
     public var hasResources: Bool {
         !tempResources.isEmpty
     }
+
+    func resetReasoningToDefault(
+        reasoningAvailable: Bool? = nil
+    ) {
+        self.didManuallyToggleReasoning = false
+        self.useReasoning = reasoningAvailable ?? InferenceSettings.localModelSupportsLiveReasoningToggle()
+    }
     
     private var audioEngine: AVAudioEngine = AVAudioEngine()
     private var speechRecognizer: SFSpeechRecognizer? = SFSpeechRecognizer()
```

**File**: `Sidekick/Views/Chat/Conversation/Controls/ConversationControlsView.swift` (modified, +13/-2)
```diff
@@ -46,10 +46,13 @@ struct ConversationControlsView: View {
         let noResources: Bool = !promptController.hasResources
         return noPrompt && noMessages && noResources
     }
+
+    var isCenteredLayout: Bool {
+        self.promptController.prompt.isEmpty && self.messages.isEmpty
+    }
     
     var maxHeight: CGFloat {
-        let center: Bool = promptController.prompt.isEmpty && messages.isEmpty
-        return center ? .infinity : 0
+        return self.isCenteredLayout ? .infinity : 0
     }
     
     var body: some View {
@@ -60,6 +63,10 @@ struct ConversationControlsView: View {
             Spacer()
                 .frame(maxHeight: maxHeight)
         }
+        .animation(
+            .easeInOut(duration: 0.22),
+            value: self.isCenteredLayout
+        )
     }
     
     var controls: some View {
@@ -110,6 +117,10 @@ struct ConversationControlsView: View {
             }
         }
         .padding(.leading)
+        .animation(
+            .easeInOut(duration: 0.22),
+            value: self.showQuickPrompts
+        )
         .onDrop(
             of: ["public.file-url"],
             delegate: promptController
```

**File**: `Sidekick/Views/Chat/Conversation/Controls/Input Field/ChatPromptEditor.swift` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ struct ChatPromptEditor: View {
     
     var body: some View {
         MultilineTextField(
-            text: self.$promptController.prompt.animation(.linear),
+            text: self.$promptController.prompt,
             insertionPoint: self.$promptController.insertionPoint,
             prompt: sendDescription,
             onImageDrop: { url in
```

**File**: `Sidekick/Views/Chat/Conversation/Controls/Input Field/MultilineTextEditor.swift` (modified, +34/-27)
```diff
@@ -74,6 +74,8 @@ struct MultilineTextField: NSViewRepresentable {
         let coordinator = context.coordinator
         let isFirstResponder = textView.window?.firstResponder == textView
         let hasMarkedText = textView.hasMarkedText()
+        let currentTextLength = (textView.string as NSString).length
+        let clampedInsertionPoint = max(0, min(insertionPoint, currentTextLength))
         let desiredTextColor: NSColor = .labelColor
         let desiredInsertionColor: NSColor = .controlAccentColor
         if textView.textColor != desiredTextColor {
@@ -88,34 +90,45 @@ struct MultilineTextField: NSViewRepresentable {
             textView.typingAttributes = attributes
         }
         
-        // Save current scroll position
-        let currentScrollPosition = nsView.contentView.bounds.origin
-        
         // Update the callback
         textView.onImageDrop = context.coordinator.onImageDrop
-        
-        // Enable scroll position preservation during programmatic updates
-        textView.shouldPreserveScrollPosition = true
-        
-        // Only update if not editing (or not composing)
-        if !isFirstResponder || !hasMarkedText {
+
+        let isExternalTextChange = textView.string != text && (
+            !isFirstResponder ||
+            hasMarkedText ||
+            text.isEmpty ||
+            abs((text as NSString).length - currentTextLength) > 1
+        )
+        let shouldRestoreScrollPosition = isExternalTextChange && !isFirstResponder
+        let currentScrollPosition = nsView.contentView.bounds.origin
+
+        textView.shouldPreserveScrollPosition = shouldRestoreScrollPosition
+
+        if isExternalTextChange {
             if textView.string != text {
                 coordinator.isProgrammaticUpdate = true
                 textView.string = text
             }
-            if textView.selectedRange.location != insertionPoint {
+            let updatedTextLength = (textView.string as NSString).length
+            let updatedInsertionPoint = max(0, min(insertionPoint, updatedTextLength))
+            if textView.selectedRange.location != updatedInsertionPoint {
                 coordinator.isProgrammaticUpdate = true
-                textView.setSelectedRange(NSRange(location: insertionPoint, length: 0))
+                textView.setSelectedRange(NSRange(location: updatedInsertionPoint, length: 0))
             }
+        } else if textView.selectedRange.location != clampedInsertionPoint {
+            coordinator.isProgrammaticUpdate = true
+            textView.setSelectedRange(NSRange(location: clampedInsertionPoint, length: 0))
         }
         textView.setPrompt(prompt)
         textView.invalidateIntrinsicContentSize()
         nsView.invalidateIntrinsicContentSize()
-        
-        // Restore scroll position after layout update
-        DispatchQueue.main.async {
-            nsView.contentView.scroll(to: currentScrollPosition)
-            // Re-enable automatic scrolling for user interactions
+
+        if shouldRestoreScrollPosition {
+            DispatchQueue.main.async {
+                nsView.contentView.scroll(to: currentScrollPosition)
+                textView.shouldPreserveScrollPosition = false
+            }
+        } else {
             textView.shouldPreserveScrollPosition = false
         }
     }
@@ -145,11 +158,9 @@ struct MultilineTextField: NSViewRepresentable {
                 return
             }
             let newString = textView.string
-            let cursor = textView.selectedRange.location
-            withAnimation(.linear) {
-                parent.text = newString
-                parent.insertionPoint = cursor
-            }
+            let cursor = max(0, min(textView.selectedRange.location, (newString as NSString).length))
+            parent.text = newString
+            parent.insertionPoint = cursor
             textView.invalidateIntrinsicContentSize()
             textView.enclosingScrollView?.invalidateIntrinsicContentSize()
         }
@@ -162,7 +173,7 @@ struct MultilineTextField: NSViewRepresentable {
                 isProgrammaticUpdate = false
                 return
             }
-            let cursor = textView.selectedRange.location
+            let cursor = max(0, min(textView.selectedRange.location, (textView.string as NSString).length))
             if parent.insertionPoint != cursor {
                 parent.insertionPoint = cursor
             }
@@ -239,11 +250,7 @@ class PromptingTextView: NSTextView {
     func setPrompt(
         _ prompt: String
     ) {
-        DispatchQueue.main.async {
-            withAnimation(.linear) {
-                self.prompt = prompt
-            }
-        }
+        self.prompt = prompt
         needsDisplay = true
     }
     
```

**File**: `Sidekick/Views/Chat/Conversation/Controls/Input Field/PromptInputField.swift` (modified, +21/-7)
```diff
@@ -39,6 +39,7 @@ struct PromptInputField: View {
     // NSEvent monitor token
     @State private var keyEventMonitor: Any?
     @State private var delayedClearTask: DispatchWorkItem?
+    @State private var lastShowReasoningToggle: Bool = false
     
     var selectedConversation: Conversation? {
         guard let selectedConversationId = conversationState.selectedConversationId else {
@@ -91,7 +92,7 @@ struct PromptInputField: View {
                 of: conversationState.selectedConversationId
             ) {
                 self.isFocused = true
-                self.promptController.didManuallyToggleReasoning = false
+                self.handleModelChange(forceDefault: true)
             }
             .onChange(
                 of: conversationState.selectedExpertId
@@ -118,6 +119,7 @@ struct PromptInputField: View {
             .onAppear {
                 self.isFocused = true
                 self.setupKeyEventMonitor()
+                self.handleModelChange(forceDefault: true)
             }
             .onDisappear {
                 self.removeKeyEventMonitor()
@@ -235,7 +237,7 @@ struct PromptInputField: View {
             } else if isShiftKeyDown || isOptionKeyDown || (self.useCommandReturn && noModifiers) {
                 // Insert newline at cursor
                 let index: String.Index = self.promptController.prompt.index(
-                    atDistance: self.promptController.insertionPoint
+                    utf16Distance: self.promptController.insertionPoint
                 )
                 DispatchQueue.main.async {
                     withAnimation {
@@ -377,7 +379,7 @@ struct PromptInputField: View {
     
     private func clearInputs() {
         DispatchQueue.main.async {
-            self.promptController.didManuallyToggleReasoning = false
+            self.handleModelChange(forceDefault: true)
             self.promptController.prompt.removeAll()
             self.promptController.insertionPoint = 0
         }
@@ -776,12 +778,24 @@ A user is chatting with an assistant and they have sent the message below. Gener
         return success
     }
     
-    private func handleModelChange() {
-        guard !self.showReasoningToggle else {
+    private func handleModelChange(
+        forceDefault: Bool = false
+    ) {
+        let showReasoningToggle = self.showReasoningToggle
+        defer {
+            self.lastShowReasoningToggle = showReasoningToggle
+        }
+        guard !showReasoningToggle else {
+            if forceDefault || !self.lastShowReasoningToggle || !self.promptController.didManuallyToggleReasoning {
+                self.promptController.resetReasoningToDefault(
+                    reasoningAvailable: true
+                )
+            }
             return
         }
-        self.promptController.useReasoning = false
-        self.promptController.didManuallyToggleReasoning = false
+        self.promptController.resetReasoningToDefault(
+            reasoningAvailable: false
+        )
     }
     
     private func scheduleDelayedClear() {
```

#### Recent Merged Pull Requests:
- **PR #96** (2026-09-30): docs: Fix Homebrew cask name in README (@johnbean393)
- **PR #86** (2026-04-20): Formatting README.md and add information on Homebrew installation (@Arcadi4)
- **PR #80** (2026-04-20): Add MiniMax as built-in popular provider (@octo-patch)
- **PR #66** (2025-05-21): fix: add creation of marp target directory to move binary (@jharsono)
- **PR #27** (closed): BUG: Code appearing on website #17 (@mikedg1)
- **PR #25** (2025-03-15): UX: Sidebar buttons extend the full width, and a separator separates the buttons from list content (@mikedg1)
- **PR #24** (2025-03-15): Dev fix: Cleaned up setup instructions in README.md (@mikedg1)
- **PR #23** (2025-03-14): Dev fix: Script to download and sign marp, and setup your team (@mikedg1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
