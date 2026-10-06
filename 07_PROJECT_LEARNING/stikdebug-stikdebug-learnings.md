# Forensic Learning Record (Deep Inspection): StikDebug/StikDebug

> **Canonical Artifact**: `07_PROJECT_LEARNING/stikdebug-stikdebug-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StikDebug/StikDebug](https://github.com/StikDebug/StikDebug))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:25:18.372Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StikDebug/StikDebug`
- **Description**: An on-device debugger/JIT enabler for iOS versions 17.4+, powered by idevice.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2608 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `StikDebug/Core/Localization.swift`
```
import Foundation

extension String {
    var localized: String {
        NSLocalizedString(self, comment: "")
    }
}

```

### Core Architecture Module: `StikDebug/Core/LogManager.swift`
```
//
//  LogManager.swift
//  StikDebug
//
//  Created by neoarz on 3/29/25.
//

import Foundation

final class LogManager: ObservableObject {
    static let shared = LogManager()

    @Published var logs: [LogEntry] = []
    @Published var errorCount: Int = 0

    struct LogEntry: Identifiable, Sendable {
        let id: UUID
        let timestamp: Date
        let type: LogType
        let message: String

        enum LogType: String, Sendable {
            case info    = "INFO"
            case error   = "ERROR"
            case debug   = "DEBUG"
            case warning = "WARNING"
        }

        init(timestamp: Date, type: LogType, message: String) {
            self.id = UUID()
            self.timestamp = timestamp
            self.type = type
            self.message = message
        }
    }

    private static let redundantPrefixes: [String] = [
        "Info: ", "INFO: ", "Information: ",
        "Error: ", "ERROR: ", "ERR: ",
        "Debug: ", "DEBUG: ", "DBG: ",
        "Warning: ", "WARN: ", "WARNING: "
    ]

    private init() {
        addInfoLog("StikDebug starting up")
        addInfoLog("Initializing environment")
    }

    func addLog(message: String, type: LogEntry.LogType) {
        let clean = Self.redundantPrefixes
            .first(where: { message.hasPrefix($0) })
            .map { String(message.dropFirst($0.count)) } ?? message

        DispatchQueue.main.async {
            self.logs.append(LogEntry(timestamp: Date(), type: type, message: clean))
            if type == .error { self.errorCount += 1 }
            if self.logs.count > 1000 { self.logs.removeFirst(100) }
        }
    }

    func addInfoLog(_ message: String)    { addLog(message: message, type: .info) }
    func addErrorLog(_ message: String)   { addLog(message: message, type: .error) }
    func addDebugLog(_ message: String)   { addLog(message: message, type: .debug) }
    func addWarningLog(_ message: String) { addLog(message: message, type: .warning) }

    func setLogs(_ entries: [LogEntry]) {
        DispatchQueue.main.async {
            self.logs = entries
            self.errorCount = entries.filter { $0.type == .error }.count
        }
    }

    func appendLogs(_ entries: [LogEntry], maxTotal: Int = 1000) {
        DispatchQueue.main.async {
            self.logs.append(contentsOf: entries)
            self.errorCount += entries.filter { $0.type == .error }.count
            if self.logs.count > maxTotal {
                let excess = self.logs.count - maxTotal
                let removed = self.logs.prefix(excess)
                self.logs.removeFirst(excess)
                let removedErrors = removed.filter { $0.type == .error }.count
                self.errorCount = max(0, self.errorCount - removedErrors)
            }
        }
    }

    func clearLogs() {
        DispatchQueue.main.async {
            self.logs.removeAll()
            self.errorCount = 0
        }
    }
}

```

### Core Architecture Module: `StikDebug/App/AppBootstrapper.swift`
```
//
//  AppBootstrapper.swift
//  StikDebug
//

import Foundation
import ObjectiveC.runtime
import UIKit

enum AppBootstrapper {
    static func configure() {
        IdeviceLogFileManager.shared.prepareForLogging()
        registerDefaultSettings()
        ensureKeepAliveSelection()
        applyDocumentPickerCopyWorkaround()
    }

    private static func registerDefaultSettings() {
        let os = ProcessInfo.processInfo.operatingSystemVersion
        let enableAdvancedOptions = os.majorVersion >= 19

        UserDefaults.standard.register(defaults: [
            "enableAdvancedOptions": enableAdvancedOptions,
            UserDefaults.Keys.txmOverride: false,
            UserDefaults.Keys.confirmExternalJITRequests: true,
            "keepAliveAudio": true,
            "keepAliveLocation": true
        ])
    }

    private static func ensureKeepAliveSelection() {
        let defaults = UserDefaults.standard
        if !defaults.bool(forKey: "keepAliveAudio"), !defaults.bool(forKey: "keepAliveLocation") {
            defaults.set(true, forKey: "keepAliveAudio")
        }
    }

    private static func applyDocumentPickerCopyWorkaround() {
        let fixedSelector = NSSelectorFromString("fix_initForOpeningContentTypes:asCopy:")
        let originalSelector = #selector(UIDocumentPickerViewController.init(forOpeningContentTypes:asCopy:))

        guard let fixedMethod = class_getInstanceMethod(UIDocumentPickerViewController.self, fixedSelector),
              let originalMethod = class_getInstanceMethod(UIDocumentPickerViewController.self, originalSelector) else {
            return
        }

        method_exchangeImplementations(originalMethod, fixedMethod)
    }
}

```

### Core Architecture Module: `StikDebug/App/AppFeature.swift`
```
//
//  AppFeature.swift
//  StikDebug
//

import SwiftUI

enum AppFeature: String, CaseIterable, Identifiable {
    case home
    case scripts
    case tools
    case console
    case deviceInfo = "deviceinfo"
    case profiles
    case processes
    case location
    case settings

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .home:
            return "Apps"
        case .scripts:
            return "Scripts"
        case .tools:
            return "Tools"
        case .console:
            return "Console"
        case .deviceInfo:
            return "Device Info"
        case .profiles:
            return "App Expiry"
        case .processes:
            return "Processes"
        case .location:
            return "Location"
        case .settings:
            return "Settings"
        }
    }

    var detail: String {
        switch self {
        case .home:
            return "Manage installed apps"
        case .scripts:
            return "Manage and run JS scripts"
        case .tools:
            return "Access additional tools"
        case .console:
            return "Live device logs"
        case .deviceInfo:
            return "View detailed device metadata"
        case .profiles:
            return "Check app expiration dates"
        case .processes:
            return "Inspect running apps"
        case .location:
            return "Simulate GPS location"
        case .settings:
            return "Configure StikDebug"
        }
    }

    var toolTitle: String {
        switch self {
        case .location:
            return "Location Simulation"
        default:
            return title
        }
    }

    var systemImage: String {
        switch self {
        case .home:
            return "square.grid.2x2"
        case .scripts:
            return "scroll"
        case .tools:
            return "wrench.and.screwdriver"
        case .console:
            return "terminal"
        case .deviceInfo:
            return "iphone.and.arrow.forward"
        case .profiles:
            return "calendar.badge.clock"
        case .processes:
            return "rectangle.stack.person.crop"
        case .location:
            return "location"
        case .settings:
            return "gearshape.fill"
        }
    }

    @ViewBuilder
    var destination: some View {
        switch self {
        case .home:
            HomeView()
        case .scripts:
            ScriptListView()
        case .tools:
            ToolsView()
        case .console:
            ConsoleLogsView()
        case .deviceInfo:
            DeviceInfoView()
        case .profiles:
            ProfileView()
        case .processes:
            ProcessInspectorView()
        case .location:
            LocationSimulationView()
        case .settings:
            SettingsView()
        }
    }
}

extension AppFeature {
    static let mainTabs: [AppFeature] = [.home, .tools, .settings]
    static let toolList: [AppFeature] = [.scripts, .console, .deviceInfo, .profiles, .processes, .location]
}

```

### Core Architecture Module: `StikDebug/App/Intents.swift`
```
import AppIntents
import Foundation

// MARK: - Installed App Entity

struct InstalledAppEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(
        name: "Installed App",
        numericFormat: "\(placeholder: .int) apps"
    )
    static var defaultQuery = InstalledAppQuery()

    var id: String // bundle ID
    var displayName: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(displayName)", subtitle: "\(id)")
    }
}

struct InstalledAppQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [InstalledAppEntity] {
        let allApps = (try? JITEnableContext.shared.getAppList()) ?? [:]
        return identifiers.compactMap { bundleID in
            guard let name = allApps[bundleID] else { return nil }
            return InstalledAppEntity(id: bundleID, displayName: name)
        }
    }

    func entities(matching string: String) async throws -> [InstalledAppEntity] {
        let all = try await suggestedEntities()
        guard !string.isEmpty else { return all }
        let lower = string.lowercased()
        return all.filter {
            $0.displayName.lowercased().contains(lower) ||
            $0.id.lowercased().contains(lower)
        }
    }

    func suggestedEntities() async throws -> [InstalledAppEntity] {
        await ensureTunnel()
        let allApps = (try? JITEnableContext.shared.getAppList()) ?? [:]
        return allApps.map { InstalledAppEntity(id: $0.key, displayName: $0.value) }
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }
}

// MARK: - Running Process Entity

struct RunningProcessEntity: AppEntity {
    static var typeDisplayRepresentation = TypeDisplayRepresentation(
        name: "Running Process",
        numericFormat: "\(placeholder: .int) processes"
    )
    static var defaultQuery = RunningProcessQuery()

    // Use a stable identifier (bundleID or name) so the entity survives PID changes
    var id: String
    var pid: Int
    var displayName: String
    var bundleID: String?

    var displayRepresentation: DisplayRepresentation {
        let subtitle: String
        if let bundleID, !bundleID.isEmpty {
            subtitle = "\(bundleID) — PID \(pid)"
        } else {
            subtitle = "PID \(pid)"
        }
        return DisplayRepresentation(title: "\(displayName)", subtitle: "\(subtitle)")
    }

    /// Resolve the current PID for this process by re-fetching the process list.
    func resolveCurrentPID() -> Int? {
        var err: NSError?
        let entries = ProcessInfoEntry.currentEntries(&err)
        for item in entries {
            // Match by bundle ID first (most stable), then by name
            if let myBundle = bundleID, !myBundle.isEmpty, item.bundleID == myBundle {
                return item.pid
            }
            if item.displayName == displayName {
                return item.pid
            }
        }
        return nil
    }
}

struct RunningProcessQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [RunningProcessEntity] {
        // Always fetch fresh so PIDs are current
        await ensureTunnel()
        let all = try fetchProcessEntities()
        let idSet = Set(identifiers)
        return all.filter { idSet.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [RunningProcessEntity] {
        let all = try await suggestedEntities()
        guard !string.isEmpty else { return all }
        let lower = string.lowercased()
        return all.filter {
            $0.displayName.lowercased().contains(lower) ||
            ($0.bundleID?.lowercased().contains(lower) ?? false) ||
            "\($0.pid)".contains(string)
        }
    }

    func suggestedEntities() async throws -> [RunningProcessEntity] {
        await ensureTunnel()
        return try fetchProcessEntities()
    }

    private func fetchProcessEntities() throws -> [RunningProcessEntity] {
        var err: NSError?
        let entries = ProcessInfoEntry.currentEntries(&err)
        if let err { throw err }

        return entries.map { entry in
            RunningProcessEntity(
                id: entry.stableIdentifier,
                pid: entry.pid,
                displayName: entry.displayName,
                bundleID: entry.bundleID
            )
        }
        .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }
}

// MARK: - Enable JIT Intent

struct EnableJITIntent: AppIntent, ForegroundContinuableIntent {
    static var title: LocalizedStringResource = "Enable JIT"
    static var description = IntentDescription(
        "Enables JIT compilation for an installed app using StikDebug.",
        categoryName: "StikDebug"
    )
    static var openAppWhenRun: Bool = true

    @Parameter(title: "App", description: "The app to enable JIT for",
               requestValueDialog: "Which app would you like to enable JIT for?")
    var app: InstalledAppEntity?

    static var parameterSummary: some ParameterSummary {
        Summary("Enable JIT for \(\.$app)")
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let bundleID = app?.id else {
            return .result(value: "Select an app to enable JIT for.")
        }

        await ensureTunnel()

        var scriptData: Data? = nil
        var scriptName: String? = nil
        if let preferred = ScriptStore.preferredScript(for: bundleID) {
            scriptData = preferred.data
            scriptName = preferred.name
        }

        var callback: DebugAppCallback? = nil
        if ProcessInfo.processInfo.hasTXM, let sd = scriptData {
            let name = scriptName ?? bundleID
            callback = { pid, debugProxyHandle, remoteServerHandle, semaphore in
                let model = RunJSViewModel(
                    pid: Int(pid),
                    debugProxy: debugProxyHandle,
                    remoteServer: remoteServerHandle,
                    semaphore: semaphore
                )
                DispatchQueue.main.async {
                    NotificationCenter.default.post(
                        name: .intentJSScriptReady,
                        object: nil,
                        userInfo: ["model": model, "scriptData": sd, "scriptName": name]
                    )
                }
                do { try model.runScript(data: sd, name: name) }
                catch {
                    semaphore.signal()
                    LogManager.shared.addErrorLog("Script error: \(error.localizedDescription)")
                }
            }
        }

        let logger: LogFunc = { message in
            if let message { LogManager.shared.addInfoLog(message) }
        }

        let target = app?.displayName ?? bundleID
        let success = JITEnableContext.shared.debugApp(withBundleID: bundleID, logger: logger, jsCallback: callback)

        if success {
            LogManager.shared.addInfoLog("JIT enabled for \(target) via Shortcut")
            return .result(value: "Successfully enabled JIT for \(target).")
        } else {
            LogManager.shared.addErrorLog("Failed to enable JIT for \(target) via Shortcut")
            return .result(value: "Failed to enable JIT for \(target).")
        }
    }
}

// MARK: - Kill Process Intent

struct KillProcessIntent: AppIntent {
    static var title: LocalizedStringResource = "Kill Process"
    static var description = IntentDescription(
        "Terminates a running process on the device using StikDebug.",
        categoryName: "StikDebug"
    )
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Process", description: "The process to terminate",
               requestValueDialog: "Which process would you like to kill?")
    var process: RunningProcessEntity?

    @Parameter(title: "Process ID", description: "A specific PID to kill instead of selecting a process")
    var pid: Int?

    static var parameterSummary: some ParameterSummary {
        Summary("Kill \(\.$process)")
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let targetPID: Int
        let targetName: String

        if let pid {
            targetPID = pid
            targetName = "PID \(pid)"
            await ensureTunnel()
        } else if let process {
            await ensureTunnel()

            // Always re-resolve to get the current PID — the stored one may be stale
            guard let resolved = process.resolveCurrentPID() else {
                return .result(value: "\(process.displayName) is no longer running.")
            }
            targetPID = resolved
            targetName = process.displayName
        } else {
            return .result(value: "Select a process or provide a PID.")
        }

        var err: NSError?
        let success = KillDeviceProcess(Int32(targetPID), &err)

        if success {
            LogManager.shared.addInfoLog("Killed \(targetName) via Shortcut")
            return .result(value: "Successfully killed \(targetName).")
        } else {
            let reason = err?.localizedDescription ?? "Unknown error"
            LogManager.shared.addErrorLog("Failed to kill \(targetName) via Shortcut: \(reason)")
            return .result(value: "Failed to kill \(targetName): \(reason)")
        }
    }
}

// MARK: - Shortcuts Provider

struct StikDebugShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: EnableJITIntent(),
            phrases: [
                "Enable JIT for \(\.$app) with \(.applicationName)",
                "Enable JIT for \(\.$app) using \(.applicationName)",
                "Enable JIT for \(\.$app) in \(.applicationName)",
                "\(.applicationName) enable JIT for \(\.$app)",
                "\(.applicationName) enable JIT",
    
```

### Core Architecture Module: `StikDebug/App/StikDebugApp.swift`
```
//
//  StikDebugApp.swift
//  StikDebug
//
//  Created by Stephen on 3/26/25.
//

import SwiftUI

@main
struct StikDebugApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var shouldAttemptTunnelReconnect = false

    init() {
        AppBootstrapper.configure()
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .task {
                    await downloadMissingDeveloperDiskImageFiles()
                }
                .onChange(of: scenePhase) { _, newPhase in
                    handleScenePhaseChange(newPhase)
                }
        }
    }

    private func handleScenePhaseChange(_ newPhase: ScenePhase) {
        switch newPhase {
        case .background:
            shouldAttemptTunnelReconnect = true
        case .active:
            if shouldAttemptTunnelReconnect {
                shouldAttemptTunnelReconnect = false
                startTunnelInBackground(showErrorUI: false)
            }
        default:
            break
        }
    }

    private func downloadMissingDeveloperDiskImageFiles() async {
        do {
            try await DeveloperDiskImageService.shared.downloadMissingFiles()
            MountingProgress.shared.pubMount()
        } catch {
            await MainActor.run {
                showAlert(
                    title: "An Error has Occurred",
                    message: "[Download DDI Error]: \(error.localizedDescription)",
                    showOk: true
                )
            }
        }
    }
}

```

### Core Architecture Module: `StikDebug/Device/DeviceConnectionContext.swift`
```
//
//  DeviceConnectionContext.swift
//  StikDebug
//
//  Created by Stephen.
//

import Foundation

enum DeviceConnectionContext {
    static let defaultTargetIPAddress = "10.7.0.1"

    static var targetIPAddress: String {
        let stored = UserDefaults.standard
            .string(forKey: UserDefaults.Keys.targetDeviceIP)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let stored, !stored.isEmpty else {
            return defaultTargetIPAddress
        }
        return stored
    }
}

```

### Core Architecture Module: `StikDebug/Device/DeviceInfoManager.swift`
```
//
//  DeviceInfoManager.swift
//  StikDebug
//
//  Created by Stephen on 8/2/25.
//

import SwiftUI
import UIKit
import UniformTypeIdentifiers
import idevice

// MARK: - Device Info Manager

struct LockdownClientSendable: @unchecked Sendable {
    let raw: OpaquePointer
}

@MainActor
final class DeviceInfoManager: ObservableObject {
    @Published var entries: [(key: String, value: String)] = []
    @Published var busy = false
    @Published var error: (title: String, message: String)?
    private var initialized = false
    private let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    
    private var lockdownHandle: LockdownClientSendable? = nil

    func initAndLoad() {
        guard !initialized else { loadInfo(); return }
        busy = true
        Task.detached {
            do {
                try JITEnableContext.shared.ensureTunnel()
            } catch {
                await MainActor.run {
                    self.error = ("Initialization Failed", error.localizedDescription)
                    self.busy = false
                }
                return
            }
            do {
                let lockdownHandle = LockdownClientSendable(raw: try JITEnableContext.shared.ideviceInfoInit())

                await MainActor.run {
                    self.lockdownHandle = lockdownHandle
                    self.initialized = true
                    self.loadInfo()
                }
            } catch {
                await MainActor.run {
                    self.error = ("Initialization Failed", error.localizedDescription)
                    self.busy = false
                }
            }

        }
    }

    private func loadInfo() {
        busy = true
        Task.detached {
            let lockdownHandle = await MainActor.run { self.lockdownHandle }
            var cXml: UnsafeMutablePointer<CChar>?
            do {
                cXml = try JITEnableContext.shared.ideviceInfoGetXML(withLockdownClient: lockdownHandle?.raw)
            } catch {
                await MainActor.run {
                    self.error = ("Fetch Error", "Failed to fetch device info \(error)")
                    self.busy = false
                }
                return
            }
            guard let cXml else { return }
            
            defer { plist_mem_free(cXml) }
            guard let xml = String(validatingUTF8: cXml) else {
                await MainActor.run {
                    self.error = ("Parse Error", "Invalid XML data")
                    self.busy = false
                }
                return
            }
            do {
                let data = Data(xml.utf8)
                guard let dict = try PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [String: Any] else {
                    throw NSError(domain: "DeviceInfo", code: 0,
                                  userInfo: [NSLocalizedDescriptionKey: "Expected dictionary"])
                }
                let formatted = dict.keys.sorted().map { ($0, Self.convertToString(dict[$0]!)) }
                await MainActor.run {
                    self.entries = formatted
                    self.busy = false
                }
            } catch {
                await MainActor.run {
                    self.error = ("Parse Error", error.localizedDescription)
                    self.busy = false
                }
            }
        }
    }

    func cleanup() {
        if let lockdownHandle {
            lockdownd_client_free(lockdownHandle.raw)
            self.lockdownHandle = nil
        }

        initialized = false
    }

    nonisolated private static func convertToString(_ raw: Any) -> String {
        switch raw {
        case let s as String: return s
        case let n as NSNumber: return n.stringValue
        default: return String(describing: raw)
        }
    }

    func exportToCSV() throws -> URL {
        var csv = "Key,Value\n"
        for (k, v) in entries {
            csv += "\"\(k.replacingOccurrences(of: "\"", with: "\"\""))\","
            csv += "\"\(v.replacingOccurrences(of: "\"", with: "\"\""))\"\n"
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("DeviceInfo.csv")
        try csv.data(using: .utf8)?.write(to: url)
        return url
    }
}

// MARK: - Device Info UI

struct DeviceInfoView: View {
    @StateObject private var mgr = DeviceInfoManager()
    @State private var importer = false
    @State private var exportURL: URL?
    @State private var isShowingExporter = false
    @State private var shareItems: [Any] = []
    @State private var showShareSheet = false
    @State private var justCopied = false

    private var pairingURL: URL { PairingFileStore.prepareURL() }
    private var isPaired: Bool { FileManager.default.fileExists(atPath: pairingURL.path) }

    @State private var searchText = ""
    @State private var alert = false
    @State private var alertTitle = ""
    @State private var alertMsg = ""
    @State private var alertSuccess = false

    var filteredEntries: [(key: String, value: String)] {
        guard !searchText.isEmpty else { return mgr.entries }
        return mgr.entries.filter {
            $0.key.localizedCaseInsensitiveContains(searchText)
            || $0.value.localizedCaseInsensitiveContains(searchText)
        }
    }
    

    var body: some View {
        NavigationStack {
            List {
                if !isPaired {
                    Section {
                        Label("No pairing file detected", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                        Text("Import your device's pairing file to get started.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if !mgr.entries.isEmpty {
                    Section {
                        ForEach(filteredEntries, id: \.key) { entry in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.key)
                                    .font(.subheadline.weight(.semibold))
                                Text(entry.value)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                                    .textSelection(.enabled)
                            }
                            .padding(.vertical, 2)
                            .contextMenu {
                                Button { copyToPasteboard(entry.value) } label: {
                                    Label("Copy Value", systemImage: "doc.on.doc")
                                }
                                Button { copyToPasteboard("\(entry.key): \(entry.value)") } label: {
                                    Label("Copy Key & Value", systemImage: "doc.on.clipboard")
                                }
                            }
                        }
                    }
                } else if !mgr.busy && isPaired {
                    Section {
                        Text("No info available").foregroundStyle(.secondary)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .searchable(
                text: $searchText,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Search device info…"
            )
            .navigationTitle("Device Info")
            .overlay {
                if mgr.busy {
                    Color.black.opacity(0.35).ignoresSafeArea()
                    ProgressView("Fetching device info…")
                        .padding(16)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                if justCopied {
                    VStack {
                        Spacer()
                        Text("Copied")
                            .font(.footnote.weight(.semibold))
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .background(.ultraThinMaterial, in: Capsule())
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                            .padding(.bottom, 30)
                    }
                    .animation(.easeInOut(duration: 0.25), value: justCopied)
                }
            }
            .alert(alertTitle, isPresented: $alert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(alertMsg)
            }
            .toolbar {
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    if isPaired {
                        Button { mgr.initAndLoad() } label: {
                            Label("Reload", systemImage: "arrow.clockwise")
                        }

                        Button {
                            do {
                                exportURL = try mgr.exportToCSV()
                                isShowingExporter = true
                            } catch {
                                fail("Export Failed", error.localizedDescription)
                            }
                        } label: {
                            Label("Export", systemImage: "square.and.arrow.up")
                        }
                        .disabled(mgr.entries.isEmpty)

                        Menu {
                            Button { copyAllText() } label: {
                                Label("Copy All (Text)", systemImage: "doc.on.doc")
                            }
                            Button { copyAllCSV() } label: {
                                Label("Copy All (CSV)", systemImage: "tablecells")
                            }
                            Button { shareAll() } label: {
```

### Core Architecture Module: `StikDebug/Device/IdeviceFFIBridge.swift`
```
//
//  IdeviceFFIBridge.swift
//  StikDebug
//
//  Created by Stephen on 2026/3/30.
//

import Foundation
import UIKit
import idevice

private enum IdeviceBridge {
    static let processQueue = DispatchQueue(label: "com.stikdebug.processInspector", qos: .userInitiated)

    static func makeError(
        domain: String = "StikDebug",
        code: Int = -1,
        message: String
    ) -> NSError {
        NSError(
            domain: domain,
            code: code,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
    }

    static func string(from cString: UnsafePointer<CChar>?) -> String? {
        guard let cString else { return nil }
        return String(validatingUTF8: cString)
    }

    static func consumeFFIError(
        _ ffiError: UnsafeMutablePointer<IdeviceFfiError>?,
        fallback: String,
        domain: String = "StikDebug"
    ) -> NSError {
        guard let ffiError else {
            return makeError(domain: domain, message: fallback)
        }

        let code = Int(ffiError.pointee.code)
        let message = string(from: ffiError.pointee.message) ?? fallback
        idevice_error_free(ffiError)
        return makeError(domain: domain, code: code, message: message)
    }

    static func mappedFileData(atPath path: String, description: String) throws -> Data {
        let url = URL(fileURLWithPath: path)

        do {
            let data = try Data(contentsOf: url, options: .mappedIfSafe)
            guard !data.isEmpty else {
                throw makeError(message: "\(description) is empty")
            }
            return data
        } catch let error as NSError {
            throw makeError(code: error.code, message: "Failed to read \(description): \(error.localizedDescription)")
        }
    }

    static func uint64Value(from plist: plist_t?, fieldName: String) throws -> UInt64 {
        guard let plist else {
            throw makeError(message: "\(fieldName) was not returned by lockdownd")
        }

        var value: UInt64 = 0
        plist_get_uint_val(plist, &value)

        guard value != 0 else {
            throw makeError(message: "Failed to decode \(fieldName)")
        }

        return value
    }

    static func withTunnelHandles<T>(
        for context: JITEnableContext,
        _ body: (OpaquePointer, OpaquePointer) throws -> T
    ) throws -> T {
        let handles = try activeTunnelHandles(for: context)
        return try body(handles.adapter, handles.handshake)
    }

    static func connectClient(
        fallback: String,
        missingClientMessage: String,
        domain: String = "StikDebug",
        connect: (UnsafeMutablePointer<OpaquePointer?>) -> UnsafeMutablePointer<IdeviceFfiError>?
    ) throws -> OpaquePointer {
        var client: OpaquePointer?
        if let ffiError = connect(&client) {
            throw consumeFFIError(ffiError, fallback: fallback, domain: domain)
        }

        guard let client else {
            throw makeError(domain: domain, message: missingClientMessage)
        }

        return client
    }

    static func withConnectedClient<T>(
        fallback: String,
        missingClientMessage: String,
        domain: String = "StikDebug",
        connect: (UnsafeMutablePointer<OpaquePointer?>) -> UnsafeMutablePointer<IdeviceFfiError>?,
        cleanup: (OpaquePointer) -> Void,
        _ body: (OpaquePointer) throws -> T
    ) throws -> T {
        let client = try connectClient(
            fallback: fallback,
            missingClientMessage: missingClientMessage,
            domain: domain,
            connect: connect
        )
        defer { cleanup(client) }
        return try body(client)
    }

    static func plistDictionaries(adapter: OpaquePointer, handshake: OpaquePointer) throws -> [[String: Any]] {
        try withConnectedClient(
            fallback: "Failed to connect to installation proxy",
            missingClientMessage: "Installation proxy client was not created",
            connect: { installation_proxy_connect_rsd(adapter, handshake, $0) },
            cleanup: { installation_proxy_client_free($0) }
        ) { client in
            var rawApps: UnsafeMutableRawPointer?
            var count = 0
            if let ffiError = installation_proxy_get_apps(client, nil, nil, 0, &rawApps, &count) {
                throw consumeFFIError(ffiError, fallback: "Failed to fetch installed apps")
            }

            guard let rawApps, count > 0 else { return [] }

            let apps = rawApps.assumingMemoryBound(to: plist_t?.self)
            defer {
                for index in 0..<count {
                    plist_free(apps[index])
                }
                idevice_data_free(
                    rawApps.assumingMemoryBound(to: UInt8.self),
                    UInt(count * MemoryLayout<plist_t?>.stride)
                )
            }

            var dictionaries: [[String: Any]] = []
            dictionaries.reserveCapacity(count)

            for index in 0..<count {
                var binaryPlist: UnsafeMutablePointer<CChar>?
                var binaryLength: UInt32 = 0
                let app = apps[index]

                guard plist_to_bin(app, &binaryPlist, &binaryLength) == PLIST_ERR_SUCCESS,
                      let binaryPlist,
                      binaryLength > 0 else {
                    continue
                }

                let data = Data(bytes: binaryPlist, count: Int(binaryLength))
                plist_mem_free(binaryPlist)

                guard let plist = try? PropertyListSerialization.propertyList(from: data, format: nil),
                      let dictionary = plist as? [String: Any] else {
                    continue
                }

                dictionaries.append(dictionary)
            }

            return dictionaries
        }
    }

    static func appName(from dictionary: [String: Any]) -> String {
        if let displayName = dictionary["CFBundleDisplayName"] as? String, !displayName.isEmpty {
            return displayName
        }
        if let name = dictionary["CFBundleName"] as? String, !name.isEmpty {
            return name
        }
        return "Unknown"
    }

    static func hasGetTaskAllow(_ dictionary: [String: Any]) -> Bool {
        guard let entitlements = dictionary["Entitlements"] as? [String: Any] else {
            return false
        }

        if let flag = entitlements["get-task-allow"] as? Bool {
            return flag
        }

        if let flag = entitlements["get-task-allow"] as? NSNumber {
            return flag.boolValue
        }

        return false
    }

    static func isHiddenSystemApp(_ dictionary: [String: Any]) -> Bool {
        guard let applicationType = dictionary["ApplicationType"] as? String,
              applicationType == "System" || applicationType == "HiddenSystemApp" else {
            return false
        }

        if let isHidden = dictionary["IsHidden"] as? Bool, isHidden {
            return true
        }

        if let isHidden = dictionary["IsHidden"] as? NSNumber, isHidden.boolValue {
            return true
        }

        guard let tags = dictionary["SBAppTags"] as? [String] else {
            return false
        }

        return tags.contains("hidden") || tags.contains("hidden-system-app")
    }

    static func appDictionary(
        adapter: OpaquePointer,
        handshake: OpaquePointer,
        requireGetTaskAllow: Bool,
        filter: (([String: Any]) -> Bool)? = nil
    ) throws -> [String: String] {
        let dictionaries = try plistDictionaries(adapter: adapter, handshake: handshake)
        var result: [String: String] = [:]
        result.reserveCapacity(dictionaries.count)

        for dictionary in dictionaries {
            if requireGetTaskAllow && !hasGetTaskAllow(dictionary) {
                continue
            }

            if let filter, !filter(dictionary) {
                continue
            }

            guard let bundleID = dictionary["CFBundleIdentifier"] as? String,
                  !bundleID.isEmpty else {
                continue
            }

            result[bundleID] = appName(from: dictionary)
        }

        return result
    }

    static func activeTunnelHandles(for context: JITEnableContext) throws -> (adapter: OpaquePointer, handshake: OpaquePointer) {
        try context.ensureTunnel()

        guard let adapterHandle = context.adapterHandle,
              let handshakeHandle = context.handshakeHandle else {
            throw makeError(message: "Tunnel is not connected")
        }

        return (adapterHandle, handshakeHandle)
    }
}

extension JITEnableContext {
    func isDeveloperDiskImageMounted() throws -> Bool {
        try IdeviceBridge.withTunnelHandles(for: self) { adapter, handshake in
            var installed: UnsafeMutablePointer<InstalledCryptexC>?
            let ffiError = cryptexd_installed_ddi(adapter, handshake, &installed)
            let queryError = ffiError.map {
                IdeviceBridge.consumeFFIError($0, fallback: "Failed to query installed DDI cryptex")
            }
            defer { cryptexd_free_installed_cryptex(installed) }
            if installed != nil {
                return true
            }

            let legacyMounted = (try? IdeviceBridge.withConnectedClient(
                fallback: "Failed to connect to image mounter",
                missingClientMessage: "Image mounter client was not created",
                connect: { image_mounter_connect_rsd(adapter, handshake, $0) },
                cleanup: { image_mounter_free($0) }
            ) { client in
                var devices: UnsafeMutablePointer<plist_t?>?
                var deviceCount = 0
                if let error = image_mounter_copy_devices(client, &devices, &deviceCount) {
                    throw IdeviceBridge.consumeFFIError(error, fallback: "Failed to fetch mounted devices")
                }
                if let devices {
                    for index in 0..<d
```

### Core Architecture Module: `StikDebug/Device/JITEnableContext.swift`
```
//
//  JITEnableContext.swift
//  StikDebug
//
//  Created by Stephen on 2026/3/30.
//

import Foundation
import idevice
import Darwin

typealias LogFunc = (String?) -> Void
typealias DebugAppCallback = (_ pid: Int32, _ debugProxy: OpaquePointer?, _ remoteServer: OpaquePointer?, _ semaphore: DispatchSemaphore) -> Void
typealias SyslogLineHandler = (String) -> Void
typealias SyslogErrorHandler = (NSError?) -> Void

final class JITEnableContext {
    static let shared = JITEnableContext()

    private static func withCStringArray<R>(
        _ strings: [String], _ body: (UnsafePointer<UnsafePointer<CChar>?>?, UInt) -> R
    ) -> R {
        if strings.isEmpty {
            return body(nil, 0)
        }
        var cStrings: [UnsafeMutablePointer<CChar>?] = strings.map { strdup($0) }
        defer { cStrings.forEach { free($0) } }
        return cStrings.withUnsafeBufferPointer { buffer in
            buffer.baseAddress!.withMemoryRebound(to: UnsafePointer<CChar>?.self, capacity: buffer.count) { rebound in
                body(rebound, UInt(buffer.count))
            }
        }
    }

    private static func mallocDebugEnvVars() -> [String] {
        let defaults = UserDefaults.standard
        let enableAll = defaults.bool(forKey: UserDefaults.Keys.mallocDebug)
        let guardEdges = enableAll || defaults.bool(forKey: UserDefaults.Keys.mallocGuardEdges)
        let scribble = enableAll || defaults.bool(forKey: UserDefaults.Keys.mallocScribble)

        var envVars: [String] = []
        if guardEdges {
            envVars.append("MallocGuardEdges=1")
        }
        if scribble {
            envVars.append("MallocScribble=1")
        }
        return envVars
    }

    private struct TunnelHandles {
        var adapter: OpaquePointer?
        var handshake: OpaquePointer?

        mutating func free() {
            if let handshake {
                rsd_handshake_free(handshake)
                self.handshake = nil
            }
            if let adapter {
                adapter_free(adapter)
                self.adapter = nil
            }
        }
    }

    private var adapter: OpaquePointer?
    private var handshake: OpaquePointer?

    private let tunnelLock = NSLock()
    private var tunnelConnecting = false
    private var tunnelSemaphore: DispatchSemaphore?
    private var lastTunnelError: NSError?

    private let syslogQueue = DispatchQueue(label: "com.stik.syslogrelay.queue")
    private var syslogStreaming = false
    private var syslogClient: OpaquePointer?
    private var syslogLineHandler: SyslogLineHandler?
    private var syslogErrorHandler: SyslogErrorHandler?

    var adapterHandle: OpaquePointer? { adapter }
    var handshakeHandle: OpaquePointer? { handshake }

    private init() {
        var path = Array(IdeviceLogFileManager.logURL.path.utf8CString)
        path.withUnsafeMutableBufferPointer { buffer in
            _ = idevice_init_logger(Info, Debug, buffer.baseAddress)
        }
    }

    deinit {
        stopSyslogRelay()
        if let handshake {
            rsd_handshake_free(handshake)
        }
        if let adapter {
            adapter_free(adapter)
        }
    }

    private func makeError(_ message: String, code: Int = -1) -> NSError {
        NSError(
            domain: "StikDebug",
            code: code,
            userInfo: [NSLocalizedDescriptionKey: message]
        )
    }

    private func nsString(from cString: UnsafePointer<CChar>?, fallback: String) -> String {
        guard let cString, let string = String(validatingUTF8: cString) else {
            return fallback
        }
        return string
    }

    private func error(from ffiError: UnsafeMutablePointer<IdeviceFfiError>?, fallback: String) -> NSError {
        guard let ffiError else {
            return makeError(fallback)
        }
        let message = nsString(from: ffiError.pointee.message, fallback: fallback)
        let error = makeError(message, code: Int(ffiError.pointee.code))
        idevice_error_free(ffiError)
        return error
    }

    private func routeLog(_ message: String) {
        if message.localizedCaseInsensitiveContains("error") {
            LogManager.shared.addErrorLog(message)
        } else if message.localizedCaseInsensitiveContains("warning") {
            LogManager.shared.addWarningLog(message)
        } else if message.localizedCaseInsensitiveContains("debug") {
            LogManager.shared.addDebugLog(message)
        } else {
            LogManager.shared.addInfoLog(message)
        }
    }

    private func emitLog(_ message: String, logger: LogFunc?) {
        routeLog(message)
        logger?(message)
    }

    private func getPairingFile() throws -> OpaquePointer {
        let pairingFileURL = PairingFileStore.prepareURL()

        guard FileManager.default.fileExists(atPath: pairingFileURL.path) else {
            throw makeError("Pairing file not found!", code: -17)
        }

        var pairingFile: OpaquePointer?
        let ffiError = pairingFileURL.path.withCString { path in
            rp_pairing_file_read(path, &pairingFile)
        }

        if let ffiError {
            throw error(from: ffiError, fallback: "Failed to read pairing file!")
        }

        guard let pairingFile else {
            throw makeError("Failed to read pairing file!", code: -17)
        }

        return pairingFile
    }

    private func createTunnel(hostname: String) throws -> TunnelHandles {
        let pairingFile = try getPairingFile()
        defer { rp_pairing_file_free(pairingFile) }

        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = in_port_t(49152).bigEndian

        let deviceIP = DeviceConnectionContext.targetIPAddress
        let parseResult = deviceIP.withCString { inet_pton(AF_INET, $0, &addr.sin_addr) }
        guard parseResult == 1 else {
            throw makeError("Failed to parse target IP address.", code: -18)
        }

        var tunnel = TunnelHandles()
        let ffiError = hostname.withCString { hostname in
            withUnsafePointer(to: &addr) { pointer in
                pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    tunnel_create_rppairing(
                        $0,
                        socklen_t(MemoryLayout<sockaddr_in>.stride),
                        hostname,
                        pairingFile,
                        nil,
                        nil,
                        &tunnel.adapter,
                        &tunnel.handshake
                    )
                }
            }
        }

        if let ffiError {
            throw error(from: ffiError, fallback: "Failed to create tunnel")
        }

        guard tunnel.adapter != nil, tunnel.handshake != nil else {
            var incompleteTunnel = tunnel
            incompleteTunnel.free()
            throw makeError("Tunnel was created without valid handles")
        }

        return tunnel
    }

    func startTunnel() throws {
        tunnelLock.lock()
        if tunnelConnecting {
            let waitSemaphore = tunnelSemaphore
            tunnelLock.unlock()

            if let waitSemaphore {
                guard waitSemaphore.wait(timeout: .now() + .seconds(15)) == .success else {
                    throw makeError("Timed out waiting for the tunnel connection", code: -19)
                }
                waitSemaphore.signal()
            }

            if let lastTunnelError {
                throw lastTunnelError
            }
            return
        }

        tunnelConnecting = true
        let completionSemaphore = DispatchSemaphore(value: 0)
        tunnelSemaphore = completionSemaphore
        tunnelLock.unlock()

        var newAdapter: OpaquePointer?
        var newHandshake: OpaquePointer?
        var finalError: NSError?

        defer {
            tunnelLock.lock()
            tunnelConnecting = false
            tunnelSemaphore = nil
            lastTunnelError = finalError
            tunnelLock.unlock()
            completionSemaphore.signal()
        }

        do {
            let newTunnel = try createTunnel(hostname: "StikDebug")
            newAdapter = newTunnel.adapter
            newHandshake = newTunnel.handshake
        } catch let tunnelError as NSError {
            finalError = tunnelError
            throw tunnelError
        }

        if let handshake {
            rsd_handshake_free(handshake)
        }
        if let adapter {
            adapter_free(adapter)
        }

        adapter = newAdapter
        handshake = newHandshake
    }

    func ensureTunnel() throws {
        if adapter == nil || handshake == nil {
            try startTunnel()
        }
    }

    private func withFreshDebugTunnel<T>(
        hostname: String,
        _ body: (OpaquePointer, OpaquePointer) throws -> T
    ) throws -> T {
        var tunnel = try createTunnel(hostname: hostname)
        defer { tunnel.free() }

        guard let adapter = tunnel.adapter, let handshake = tunnel.handshake else {
            throw makeError("Tunnel is not connected")
        }

        return try body(adapter, handshake)
    }

    private struct DebugSession {
        var remoteServer: OpaquePointer?
        var debugProxy: OpaquePointer?

        mutating func free() {
            if let debugProxy {
                debug_proxy_free(debugProxy)
                self.debugProxy = nil
            }
            if let remoteServer {
                remote_server_free(remoteServer)
                self.remoteServer = nil
            }
        }
    }

    private final class DebugHeartbeatKeepAlive {
        private static let defaultInterval: UInt64 = 2
        private static let maxInterval: UInt64 = 3

        private let queue = DispatchQueue(label: "com.stikdebug.debug-heartbeat", qos: .utility)
        private let stateLock = NSLock()
        private let startupSemaphore = DispatchSemaphore(value: 0)
        private let stoppedSemaphore = Dispatch
```

### Core Architecture Module: `StikDebug/Device/MountingProgress.swift`
```
//
//  MountingProgress.swift
//  StikDebug
//

import Foundation
import idevice

final class MountingProgress: ObservableObject {
    static let shared = MountingProgress()

    @Published private(set) var mountingThread: Thread?
    @Published private(set) var coolisMounted: Bool = false

    private let mountCheckLock = NSLock()
    private var mountCheckInProgress = false
    private let mountLock = NSLock()
    private var mountInProgress = false

    private init() {}

    func checkforMounted() {
        guard TunnelManager.shared.isConnected else { return }

        mountCheckLock.lock()
        guard !mountCheckInProgress else {
            mountCheckLock.unlock()
            return
        }
        mountCheckInProgress = true
        mountCheckLock.unlock()

        DispatchQueue.global(qos: .utility).async {
            let status = checkMountStatus()

            self.mountCheckLock.lock()
            self.mountCheckInProgress = false
            self.mountCheckLock.unlock()

            DispatchQueue.main.async {
                if status != .unreachable {
                    self.coolisMounted = status == .mounted
                }
            }
        }
    }

    func pubMount() {
        guard TunnelManager.shared.isConnected, DeveloperDiskImageService.filesAreReady else { return }

        mountLock.lock()
        guard !mountInProgress else {
            mountLock.unlock()
            return
        }
        mountInProgress = true
        mountLock.unlock()

        let thread = Thread { [weak self] in
            self?.mount()
        }
        thread.qualityOfService = .background
        thread.name = "mounting"
        DispatchQueue.main.async {
            self.mountingThread = thread
        }
        thread.start()
    }

    private func mount() {
        switch checkMountStatus() {
        case .mounted:
            finishMount {
                self.coolisMounted = true
            }
            return
        case .unreachable:
            finishMount()
            return
        case .notMounted:
            break
        }

        guard isPairing() else {
            finishMount()
            return
        }

        let mountError = mountDeveloperDiskImage(from: DeveloperDiskImageService.directoryURL.path)
        let mounted = mountError == nil || checkMountStatus() == .mounted
        finishMount {
            if mounted {
                self.coolisMounted = true
                self.checkforMounted()
            } else if let mountError {
                LogManager.shared.addErrorLog("Failed to mount DDI: \(mountError)")
                showAlert(title: "DDI Mount Failed", message: mountError, showOk: true, showTryAgain: true) { shouldTryAgain in
                    if shouldTryAgain {
                        self.pubMount()
                    }
                }
            }
        }
    }

    private func finishMount(_ completion: @escaping () -> Void = {}) {
        DispatchQueue.main.async {
            self.mountingThread = nil
            self.mountLock.lock()
            self.mountInProgress = false
            self.mountLock.unlock()
            completion()
        }
    }
}

func isPairing() -> Bool {
    let pairingPath = PairingFileStore.prepareURL().path
    var pairingFile: RpPairingFileHandle?
    let error = rp_pairing_file_read(pairingPath, &pairingFile)
    if error != nil {
        return false
    }
    rp_pairing_file_free(pairingFile)
    return true
}

```

### Core Architecture Module: `StikDebug/Device/SystemLogStream.swift`
```
//
//  SystemLogStream.swift
//  StikDebug
//
//  Created by Stephen on 09/21/2025.
//

import Foundation

@MainActor
final class SystemLogStream: ObservableObject {
    struct Entry: Identifiable {
        let id = UUID()
        let timestamp: Date
        let message: String
        let raw: String
        let searchableRaw: String

        init(timestamp: Date, message: String, raw: String) {
            self.timestamp = timestamp
            self.message = message
            self.raw = raw
            self.searchableRaw = raw.lowercased()
        }
    }

    @Published private(set) var entries: [Entry] = []
    @Published var lastError: String? = nil
    @Published private(set) var isStreaming: Bool = false
    @Published private(set) var isPaused: Bool = false
    @Published var updateInterval: TimeInterval = 0 {
        didSet {
            if updateInterval < 0 { updateInterval = 0 }
            flushTimer?.invalidate()
            flushTimer = nil
            if !isPaused && !pendingEntries.isEmpty {
                if updateInterval == 0 {
                    flushAllPending()
                } else {
                    scheduleFlushIfNeeded()
                }
            }
        }
    }

    private let maxEntries = 1500
    private var pendingEntries: [Entry] = []
    private var flushTimer: Timer?
    private var retryTimer: Timer?
    private var batchTimer: Timer?
    private static let batchInterval: TimeInterval = 0.1

    func start() {
        retryTimer?.invalidate()
        retryTimer = nil
        guard !isStreaming else {
            if isPaused { resume() }
            return
        }
        isStreaming = true
        isPaused = false
        lastError = nil
        startBatchTimer()

        JITEnableContext.shared.startSyslogRelay(handler: { [weak self] line in
            Task { @MainActor [weak self] in
                self?.handleLine(line)
            }
        }, onError: { [weak self] error in
            Task { @MainActor [weak self] in
                self?.handleError(error)
            }
        })
    }

    func stop() {
        guard isStreaming else { return }
        isStreaming = false
        isPaused = false
        JITEnableContext.shared.stopSyslogRelay()
        flushTimer?.invalidate()
        flushTimer = nil
        batchTimer?.invalidate()
        batchTimer = nil
        pendingEntries.removeAll()
        retryTimer?.invalidate()
        retryTimer = nil
    }

    func clear() {
        entries.removeAll()
        pendingEntries.removeAll()
        flushTimer?.invalidate()
        flushTimer = nil
        retryTimer?.invalidate()
        retryTimer = nil
    }

    func togglePause() {
        isPaused ? resume() : pause()
    }

    func pause() {
        guard !isPaused else { return }
        isPaused = true
        flushTimer?.invalidate()
        flushTimer = nil
    }

    func resume() {
        guard isPaused else { return }
        isPaused = false
        if updateInterval == 0 {
            flushAllPending()
        } else {
            scheduleFlushIfNeeded()
        }
    }

    private func handleLine(_ line: String) {
        guard isStreaming else { return }
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let entry = Entry(timestamp: Date(), message: prettify(line: trimmed), raw: trimmed)
        pendingEntries.append(entry)
        if pendingEntries.count > maxEntries {
            pendingEntries.removeFirst(pendingEntries.count - maxEntries)
        }
        // Batching is handled by batchTimer / scheduleFlushIfNeeded
        if updateInterval > 0 {
            scheduleFlushIfNeeded()
        }
    }

    private func handleError(_ error: NSError?) {
        isStreaming = false
        isPaused = false
        flushTimer?.invalidate()
        flushTimer = nil
        batchTimer?.invalidate()
        batchTimer = nil
        lastError = error?.localizedDescription ?? "System log stream stopped"
        scheduleAutoRetry()
    }

    private func startBatchTimer() {
        batchTimer?.invalidate()
        batchTimer = Timer.scheduledTimer(withTimeInterval: Self.batchInterval, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                guard !self.isPaused, self.updateInterval == 0, !self.pendingEntries.isEmpty else { return }
                self.flushAllPending()
            }
        }
        if let batchTimer {
            RunLoop.main.add(batchTimer, forMode: .common)
        }
    }

    private func flushAllPending() {
        guard !pendingEntries.isEmpty else { return }
        entries.append(contentsOf: pendingEntries)
        pendingEntries.removeAll()
        if entries.count > maxEntries {
            entries.removeFirst(entries.count - maxEntries)
        }
    }

    private func prettify(line: String) -> String {
        if let range = line.range(of: ": ") {
            let messagePart = line[range.upperBound...]
            return String(messagePart)
        }
        return line
    }

    private func scheduleFlushIfNeeded() {
        guard !isPaused else { return }
        guard !pendingEntries.isEmpty else { return }
        guard flushTimer == nil else { return }
        guard updateInterval > 0 else {
            // Live mode uses batchTimer instead
            return
        }

        flushTimer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.flushTimer = nil
                guard !self.isPaused else { return }
                self.flushAllPending()
                if !self.pendingEntries.isEmpty {
                    self.scheduleFlushIfNeeded()
                }
            }
        }

        if let flushTimer {
            RunLoop.main.add(flushTimer, forMode: .common)
        }
    }

    private func scheduleAutoRetry() {
        guard !isStreaming else { return }
        guard retryTimer == nil else { return }
        let timer = Timer(timeInterval: 2.0, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.retryTimer = nil
                if !self.isStreaming && !self.isPaused {
                    self.start()
                }
            }
        }
        retryTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #474** (2026-10-04): **Tunnel creation fails on iOS 26.7 —  `missing field public_key` with idevice /  `ConnectionReset ` with iLoader (LocalDevVPN confirmed connected)**
  *Symptoms*: ### Description  On iOS 26.7, tunnel creation/JIT enabling in StikDebug consistently fails. I have performed extensive troubleshooting—including testing pairing files generated by both iLoader and idevice—and the issue persists across multiple fresh setup attempts.  ### Steps to Reproduce  On an iPhone running iOS 26.7:  1. Sideloaded StikDebug via iLoader 2. Connected to LocalDevVPN (confirmed "Connected" throughout the entire process). 3. Closed iCloud Private Relay and ensured Date & Time are set to automatic. 4. Deleted and recreated the VPN configuration profile. 5. Attempted to re-pair the device and establish the tunnel in StikDebug: I. Attempt A (via iLoader pairing file): Re-paired device and imported  pairing file. Initial attempt failed, and repeated full re-pairings still consistently fail with  `(Code1)  iLoaderConnectionReset` II. Attempt B (via idevice pairing file): Generated pairing file using  (verified valid with , , etc.) `idevice` `DeviceCertificate` `HostPrivateKey.Imported` into StikDebug, but it fails with  `(Code5) missing field 'public_key'` 6. Verified that the same tunnel establishment steps to the same address fail completely in other apps built on the same underlying library (SideStore, iLoader, AltStore).  ### Expected Behavior  The tunnel should be established successfully and JIT enabled after importing a valid pairing file over LocalDevVPN.  ### iOS Version  26.7  ### Device  iPhone 14 Pro Max  ### StikDebug Version  3.1.13  ### Logs  ```shel
  **Post-Mortem & Fix Analysis**:
  > Solved by https://github.com/StikDebug/StikDebug/issues/446 With [idevice pair.](https://github.com/jkcoxson/idevice_pair/releases/latest)

- **Issue #472** (2026-09-30): **Amethyst needs a new script/TXM issues**
  *Symptoms*: ### Description  Amethyst launches java edition but on neoforge it crashes on world join  ### Steps to Reproduce  Enable jit for Amethyst Launch Neoforge instance Join world Crash  ### Expected Behavior  To not crash like on all other modloaders   ### iOS Version  27.0DB3  ### Device  iPhone 12 Pro  ### StikDebug Version  Latest  ### Logs  ```shell  ```  ### Screenshots  Im aware this isn’t a stikdebug issue but jit does just randomly disappear while playing
  **Post-Mortem & Fix Analysis**:
  > Also universal script is how i managed to get it to launch, i have a world on there which has 1200+ hours and jit not working has stuffed it up completely, if you cannot recreate this issue then i will repost it to amethyst
  > This is not a StikDebug issue. Is it maybe something with your mods?
  > > This is not a StikDebug issue. Is it maybe something with your mods?  It worked in ios 26.2!

- **Issue #469** (2026-09-24): **DDI Mount Failed / Connection refused (os error 61) on iOS 27**
  *Symptoms*: ### Description  Getting a consistent Connection refused (os error 61) error immediately when opening StikDebug — the error appears before the app list even loads, both as a "Connection Error" (tunnel could not be created) and as "DDI Mount Failed" with the same underlying error.  ### Steps to Reproduce  1.Fresh pairing file placed via iLoader (confirmed working — SideStore installs/refreshes apps fine with the same file) 2.LocalDevVPN installed and connected (Wi-Fi), tunnel IP confirmed at 10.7.0.1 3.Open StikDebug 4.Error appears immediately on launch — app list never loads, "Try Again" does not resolve it  ### Expected Behavior  Reinstalling StikDebug and LocalDevVPN multiple times Re-placing pairing file with iLoader multiple times Resetting LocalDevVPN's local IP to 10.7.0.0/tunnel 10.7.0.1 Re-signing StikDebug itself with a free Apple ID certificate instead of a paid Ad Hoc certificate — same error persists, ruling out entitlement/signing as the cause  ### iOS Version  27.0  ### Device  iPhone 16  ### StikDebug Version  3.1.10  ### Logs  ```shell  ```  ### Screenshots  <img width="590" height="1278" alt="Image" src="https://github.com/user-attachments/assets/be4e0812-06ff-440c-999b-ec07b4e36a1d" /> <img width="590" height="1278" alt="Image" src="https://github.com/user-attachments/assets/ce8e80aa-b0f9-4e7b-894f-1e6c8f70330c" />
  **Post-Mortem & Fix Analysis**:
  > Something was setup wrong
  > so how do you fix? 
  > Try replacing your pairing file with iloader (press "delete stored pairing" first), or idevice_pair, or Impactor

- **Issue #466** (2026-09-21): **Location Simulation “Simulate Route” taking too long to load**
  *Symptoms*: ### Description  The routes are taking way too long and sometimes they never complete to be able to play the route   Version 3.1.10 iOS 26.1  ### Steps to Reproduce  Go to location simulation   Then tap to simulate route  Then there is the bug, loading with no results unable to press play route   ### Expected Behavior  I expected to be able to simulate the route   ### iOS Version  26.1  ### Device  iPhone 15 Pro  ### StikDebug Version  3.1.10  ### Logs  ```shell  ```  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > It is calculating all the speed limits. The longer the route, the longer it takes to load.

- **Issue #465** (2026-09-24): **Can't enable JIT on the 18 Pro Max**
  *Symptoms*: ### Description  Using iLoader to place the Pairing File on a 18 Pro Max results in a "DDI Mount Failed" error. Please refer to the images below.  ### Steps to Reproduce  1. Place Pairing file via iLoader. 2. Connect to DevPN. 3. Get DDI Mount Failed error mentioning a BadBuildManifest.  ### Expected Behavior  No errors  ### iOS Version  27.0  ### Device  iPhone 18 Po Max  ### StikDebug Version  3.1.9  ### Logs  ```shell  ```  ### Screenshots  <img width="660" height="1434" alt="Image" src="https://github.com/user-attachments/assets/b4c9f4d7-0c63-4569-b491-785761642d12" />
  **Post-Mortem & Fix Analysis**:
  > External repo it gets ddi from hasn't been updated yet 
  > 3.1.11

- **Issue #464** (2026-09-24): **On the ios27 system, ddi mount failed**
  *Symptoms*: ### Description  <img width="590" height="1278" alt="Image" src="https://github.com/user-attachments/assets/65782923-bb19-4ae6-84d1-c19ecc3af77a" />  ### Steps to Reproduce  Upgrade to ios27 system, open localdevvpn, and enter stikdebug (try to re-import new pairing files, but still fail)  ### Expected Behavior  can run  ### iOS Version  27.0  ### Device  iPhone 15 pro  ### StikDebug Version  3.1.10  ### Logs  ```shell  ```  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > same here bro pls share if you have any solution T^T i guess it's because of the new ios
  > Me too on my iPhone 18 pro max
  > Apple requires you to mount a developer disk image (or ddi) before you attach a debugger and releases new ddi in Xcode updates as new models come out, we pull those DDIs from an upstream GitHub repo that hadn't been updated for Apple's latest models yet. It usually doesn't take more than a week but once it has been updated it will work for you.

- **Issue #458** (2026-09-17): **Bug**
  *Symptoms*: ### Description  iOS still kills stikdebug in the background even if I have location set to always and silent noise enabled. Maybe it’s the Ram issue but dude i am only running geode I also tried other apps but the same result  ### Steps to Reproduce  1. Launch JIT script  2. do something/nothing 3. ios kills stikdebug and then the app crashes because the script is no longer running  ### Expected Behavior  I except iOS not killing it because I have all background anti-kills on  ### iOS Version  26.5  ### Device  iPhone 11  ### StikDebug Version  3.1.10  ### Logs  ```shell  ```  ### Screenshots  _No response_

- **Issue #454** (2026-09-04): **No app being shown**
  *Symptoms*: ### Description  I open stik debug, no app shows up, after replacing the pairing file in every way, I don’t know why?  ### Steps to Reproduce  1. Sideload the latest stikdebug. 2. Activate localdevvpn  3. Open app, send pairing file via iloader. 4. Refresh, nothing shows up?  ### Expected Behavior  I thought apps would be listed?  ### iOS Version  26.5.2  ### Device  iPad Air m2  ### StikDebug Version  3.1.1.0  ### Logs  ```shell  ```  ### Screenshots  <img width="1180" height="820" alt="Image" src="https://github.com/user-attachments/assets/727ff761-98ef-4bad-a306-73949c8ad73e" />
  **Post-Mortem & Fix Analysis**:
  > Did you give it the correct permissions, and does it show an error? Also it's probably not a bug, as when I first sideloaded it this happened, after closing and reopening a lot it fixed. 
  > > Did you give it the correct permissions, and does it show an error?  Can u elaborate by permissions? I gave it a pairing file, I keep refreshing, no error message is shown, or logs.
  > Like, Local Network Access, Location, etc Also; 3.1.1.0 is a really old version, update if that's actually your version I am assuming you meant 3.1.10 if you did type the wrong number

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

### Incident Patch 1: `e7ef9491` (2026-09-27)
**Commit Message**: fix: preserve background activity sessions

**File**: `StikDebug/App/AppBootstrapper.swift` (modified, +3/-8)
```diff
@@ -11,7 +11,7 @@ enum AppBootstrapper {
     static func configure() {
         IdeviceLogFileManager.shared.prepareForLogging()
         registerDefaultSettings()
-        startConfiguredKeepAliveServices()
+        ensureKeepAliveSelection()
         applyDocumentPickerCopyWorkaround()
     }
 
@@ -28,15 +28,10 @@ enum AppBootstrapper {
         ])
     }
 
-    private static func startConfiguredKeepAliveServices() {
+    private static func ensureKeepAliveSelection() {
         let defaults = UserDefaults.standard
-        if defaults.bool(forKey: "keepAliveAudio") {
-            BackgroundAudioManager.shared.start()
-        } else if defaults.bool(forKey: "keepAliveLocation") {
-            BackgroundLocationManager.shared.start()
-        } else {
+        if !defaults.bool(forKey: "keepAliveAudio"), !defaults.bool(forKey: "keepAliveLocation") {
             defaults.set(true, forKey: "keepAliveAudio")
-            BackgroundAudioManager.shared.start()
         }
     }
 
```

**File**: `StikDebug/Services/BackgroundAudioManager.swift` (modified, +2/-9)
```diff
@@ -11,7 +11,6 @@ final class BackgroundAudioManager {
     private var engine = AVAudioEngine()
     private var player = AVAudioPlayerNode()
     private var isRunning = false
-    private var persistentEnabled = false
     private var activityCount = 0
     private var healthCheckTimer: Timer?
 
@@ -30,13 +29,7 @@ final class BackgroundAudioManager {
         )
     }
 
-    func start() {
-        persistentEnabled = true
-        refreshRunningState()
-    }
-
-    func stop() {
-        persistentEnabled = false
+    func configurationDidChange() {
         refreshRunningState()
     }
 
@@ -51,7 +44,7 @@ final class BackgroundAudioManager {
     }
 
     private func refreshRunningState() {
-        let shouldRun = persistentEnabled || (activityCount > 0 && UserDefaults.standard.bool(forKey: "keepAliveAudio"))
+        let shouldRun = activityCount > 0 && UserDefaults.standard.bool(forKey: "keepAliveAudio")
         guard shouldRun != isRunning else {
             if shouldRun {
                 recoverIfNeeded()
```

**File**: `StikDebug/Services/BackgroundLocationManager.swift` (modified, +49/-17)
```diff
@@ -4,14 +4,15 @@
 //
 
 import CoreLocation
+import UIKit
 
 final class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
     static let shared = BackgroundLocationManager()
 
     private let locationManager = CLLocationManager()
     private var isRunning = false
-    private var persistentEnabled = false
     private var activityCount = 0
+    private var isRequestingAuthorization = false
 
     private override init() {
         super.init()
@@ -22,13 +23,7 @@ final class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
         locationManager.pausesLocationUpdatesAutomatically = false
     }
 
-    func start() {
-        persistentEnabled = true
-        refreshRunningState()
-    }
-
-    func stop() {
-        persistentEnabled = false
+    func configurationDidChange() {
         refreshRunningState()
     }
 
@@ -42,8 +37,22 @@ final class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
         refreshRunningState()
     }
 
+    func requestAuthorizationIfNeeded() {
+        switch locationManager.authorizationStatus {
+        case .authorizedAlways, .authorizedWhenInUse:
+            return
+        case .notDetermined:
+            isRequestingAuthorization = true
+            locationManager.requestAlwaysAuthorization()
+        case .denied, .restricted:
+            restoreAudioFallback()
+        @unknown default:
+            restoreAudioFallback()
+        }
+    }
+
     private func refreshRunningState() {
-        let shouldRun = persistentEnabled || (activityCount > 0 && UserDefaults.standard.bool(forKey: "keepAliveLocation"))
+        let shouldRun = activityCount > 0 && UserDefaults.standard.bool(forKey: "keepAliveLocation")
         guard shouldRun != isRunning else { return }
 
         isRunning = shouldRun
@@ -67,24 +76,47 @@ final class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
     }
 
     func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
-        guard isRunning else { return }
         switch manager.authorizationStatus {
         case .authorizedAlways, .authorizedWhenInUse:
-            manager.startUpdatingLocation()
+            isRequestingAuthorization = false
+            if isRunning {
+                manager.startUpdatingLocation()
+            }
         case .denied, .restricted:
-            restoreAudioFallback()
+            if isRunning || isRequestingAuthorization {
+                isRequestingAuthorization = false
+                restoreAudioFallback()
+            }
         case .notDetermined:
             return
         @unknown default:
-            restoreAudioFallback()
+            if isRunning || isRequestingAuthorization {
+                isRequestingAuthorization = false
+                restoreAudioFallback()
+            }
         }
     }
 
     private func restoreAudioFallback() {
-        persistentEnabled = false
-        isRunning = activityCount > 0 && UserDefaults.standard.bool(forKey: "keepAliveLocation")
-        UserDefaults.standard.set(true, forKey: "keepAliveAudio")
-        BackgroundAudioManager.shared.start()
+        let defaults = UserDefaults.standard
+        defaults.set(false, forKey: "keepAliveLocation")
+        defaults.set(true, forKey: "keepAliveAudio")
+        refreshRunningState()
+        BackgroundAudioManager.shared.configurationDidChange()
+
+        showAlert(
+            title: "Location Access Refused",
+            message: "Location access was refused. Open Settings to enable it.",
+            showOk: false,
+            showTryAgain: true,
+            primaryButtonText: "Settings"
+        ) { openSettings in
+            guard openSettings,
+                  let settingsURL = URL(string: UIApplication.openSettingsURLString) else {
+                return
+            }
+            UIApplication.shared.open(settingsURL)
+        }
     }
 
     func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
```

**File**: `StikDebug/Services/LocationSimulationSession.swift` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import Foundation
+import CoreLocation
+import Combine
+
+final class LocationSimulationSession: ObservableObject {
+    static let shared = LocationSimulationSession()
+
+    @Published private(set) var isActive = false
+    @Published private(set) var coordinate: CLLocationCoordinate2D?
+    @Published private(set) var routeCoordinates: [CLLocationCoordinate2D]?
+    private var resendTimer: Timer?
+    private var routeID: UUID?
+
+    private init() {}
+
+    func start(at coordinate: CLLocationCoordinate2D) {
+        self.coordinate = coordinate
+        if !isActive {
+            isActive = true
+            BackgroundAudioManager.shared.requestStart()
+            BackgroundLocationManager.shared.requestStart()
+        }
+    }
+
+    func startResending(at coordinate: CLLocationCoordinate2D, _ operation: @escaping () -> Void) {
+        start(at: coordinate)
+        resendTimer?.invalidate()
+        let timer = Timer(timeInterval: 4, repeats: true) { _ in operation() }
+        RunLoop.main.add(timer, forMode: .common)
+        resendTimer = timer
+    }
+
+    func startRoute(at coordinate: CLLocationCoordinate2D, coordinates: [CLLocationCoordinate2D]) -> UUID {
+        let routeID = UUID()
+        self.routeID = routeID
+        routeCoordinates = coordinates
+        start(at: coordinate)
+        return routeID
+    }
+
+    func isCurrentRoute(_ routeID: UUID) -> Bool {
+        self.routeID == routeID
+    }
+
+    func clearRoute() {
+        routeID = nil
+        routeCoordinates = nil
+    }
+
+    func pauseResending() {
+        resendTimer?.invalidate()
+        resendTimer = nil
+    }
+
+    func updateCoordinate(_ coordinate: CLLocationCoordinate2D) {
+        self.coordinate = coordinate
+    }
+
+    func stop() {
+        pauseResending()
+        clearRoute()
+        guard isActive else { return }
+        isActive = false
+        coordinate = nil
+        BackgroundAudioManager.shared.requestStop()
+        BackgroundLocationManager.shared.requestStop()
+    }
+}
```

**File**: `StikDebug/Views/MainTabView.swift` (modified, +18/-2)
```diff
@@ -7,6 +7,7 @@
 
 import SwiftUI
 import Foundation
+import CoreLocation
 
 private enum ExternalLocationAction: Identifiable {
     case simulate(URL, Double, Double)
@@ -223,7 +224,22 @@ struct MainTabView: View {
 
             DispatchQueue.main.async {
                 if code == 0 {
-                    BackgroundLocationManager.shared.requestStart()
+                    LocationSimulationSession.shared.clearRoute()
+                    LocationSimulationSession.shared.startResending(
+                        at: CLLocationCoordinate2D(
+                            latitude: coordinate.latitude,
+                            longitude: coordinate.longitude
+                        )
+                    ) {
+                        LocationSimulationCommandQueue.shared.async {
+                            _ = simulate_location(
+                                DeviceConnectionContext.targetIPAddress,
+                                coordinate.latitude,
+                                coordinate.longitude,
+                                pairingFile.path
+                            )
+                        }
+                    }
                     LogManager.shared.addInfoLog(
                         String(format: "Simulated location from URL: %.6f, %.6f", coordinate.latitude, coordinate.longitude)
                     )
@@ -243,7 +259,7 @@ struct MainTabView: View {
             let code = clear_simulated_location()
             DispatchQueue.main.async {
                 if code == 0 {
-                    BackgroundLocationManager.shared.requestStop()
+                    LocationSimulationSession.shared.stop()
                     LogManager.shared.addInfoLog("Cleared simulated location from URL")
                 } else {
                     showAlert(
```

**File**: `StikDebug/Views/MapSelectionView.swift` (modified, +50/-24)
```diff
@@ -724,11 +724,11 @@ final class LocationSearchCompleter: NSObject, ObservableObject, MKLocalSearchCo
 }
 
 struct LocationSimulationView: View {
+    @ObservedObject private var simulationSession = LocationSimulationSession.shared
     @State private var coordinate: CLLocationCoordinate2D?
     @State private var position: MapCameraPosition = .userLocation(fallback: .automatic)
 
     @State private var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid
-    @State private var resendTimer: Timer?
     @State private var routeLoadTask: Task<Void, Never>?
     @State private var routeSpeedPrefetchTask: Task<Void, Never>?
     @State private var routePlaybackTask: Task<Void, Never>?
@@ -788,11 +788,11 @@ struct LocationSimulationView: View {
     }
 
     private var hasActiveSimulation: Bool {
-        simulatedCoordinate != nil || routePlaybackTask != nil
+        simulationSession.isActive || simulatedCoordinate != nil || routePlaybackTask != nil
     }
 
     private var isRouteRunning: Bool {
-        routePlaybackTask != nil
+        routePlaybackTask != nil || simulationSession.routeCoordinates != nil
     }
 
     private var hasRouteContext: Bool {
@@ -801,7 +801,12 @@ struct LocationSimulationView: View {
         routePlan != nil ||
         isLoadingRoute ||
         isPrefetchingRouteSpeeds ||
-        routePlaybackCoordinate != nil
+        routePlaybackCoordinate != nil ||
+        simulationSession.routeCoordinates != nil
+    }
+
+    private var displayedRouteCoordinate: CLLocationCoordinate2D? {
+        simulationSession.routeCoordinates == nil ? routePlaybackCoordinate : simulationSession.coordinate
     }
 
     private var routeSummaryText: String? {
@@ -818,6 +823,9 @@ struct LocationSimulationView: View {
     }
 
     private var routeStatusText: String {
+        if simulationSession.routeCoordinates != nil {
+            return "Route simulation active."
+        }
         if isLoadingRoute {
             return "Calculating route…"
         }
@@ -892,8 +900,8 @@ struct LocationSimulationView: View {
                             Marker("End", coordinate: routeEndCoordinate)
                                 .tint(.red)
                         }
-                        if let routePlaybackCoordinate {
-                            Marker("Current", coordinate: routePlaybackCoordinate)
+                        if let displayedRouteCoordinate {
+                            Marker("Current", coordinate: displayedRouteCoordinate)
                                 .tint(.blue)
                         }
                     } else if let coordinate {
@@ -1025,17 +1033,28 @@ struct LocationSimulationView: View {
         }
         .onAppear {
             loadBookmarks()
+            if let routeCoordinates = simulationSession.routeCoordinates {
+                coordinate = nil
+                routePolyline = makeRoutePolyline(for: routeCoordinates)
+                routeStartSelection = routeCoordinates.first.map {
+                    RouteSearchSelection(title: "Route Start", coordinate: $0)
+                }
+                routeEndSelection = routeCoordinates.last.map {
+                    RouteSearchSelection(title: "Route End", coordinate: $0)
+                }
+                if let routePolyline {
+                    position = .rect(routePolyline.boundingMapRect)
+                }
+            } else if let activeCoordinate = simulationSession.coordinate {
+                coordinate = activeCoordinate
+                simulatedCoordinate = activeCoordinate
+            }
         }
         .onDisappear {
             routeLoadTask?.cancel()
             routeLoadTask = nil
             routeSpeedPrefetchTask?.cancel()
             routeSpeedPrefetchTask = nil
-            cancelRoutePlayback(resetMarker: true)
-            stopResendLoop()
-            if backgroundTaskID != .invalid {
-                BackgroundLocationManager.shared.requestStop()
-            }
             endBackgroundTask()
         }
     }
@@ -1297,14 +1316,14 @@ struct LocationSimulationView: View {
         ) {
             routePlaybackCoordinate = nil
             beginBackgroundTask()
+            LocationSimulationSession.shared.clearRoute()
             startResendLoop(with: coord)
-            BackgroundLocationManager.shared.requestStart()
         }
     }
 
     private func simulateRoute() {
         guard pairingExists,
-              routePlan != nil,
+              let routePlan,
               let firstCoordinate = routePlaybackSamples.first?.coordinate,
               !isBusy else {
             return
@@ -1319,10 +1338,13 @@ struct LocationSimulationView: View {
             operation: { locationUpdateCode(for: firstCoordinate) }
         ) {
             beginBackgroundTask()
-            BackgroundLocationManager.shared.requestStart()
+            let routeID = LocationSimulationSession.shared.startRoute(
+                at: firstCoordinate,
+                coordina
```

**File**: `StikDebug/Views/SettingsView.swift` (modified, +8/-18)
```diff
@@ -242,32 +242,22 @@ struct SettingsView: View {
     }
 
     private func handleAudioKeepAliveChange(_ enabled: Bool) {
-        if enabled {
-            BackgroundAudioManager.shared.start()
-            BackgroundLocationManager.shared.stop()
-            return
-        }
-
-        if !keepAliveLocation {
+        if !enabled, !keepAliveLocation {
             keepAliveLocation = true
+            BackgroundLocationManager.shared.requestAuthorizationIfNeeded()
         }
-        BackgroundAudioManager.shared.stop()
-        BackgroundLocationManager.shared.start()
+        BackgroundAudioManager.shared.configurationDidChange()
+        BackgroundLocationManager.shared.configurationDidChange()
     }
 
     private func handleLocationKeepAliveChange(_ enabled: Bool) {
         if enabled {
-            if !keepAliveAudio {
-                BackgroundLocationManager.shared.start()
-            }
-            return
-        }
-
-        BackgroundLocationManager.shared.stop()
-        if !keepAliveAudio {
+            BackgroundLocationManager.shared.requestAuthorizationIfNeeded()
+        } else if !keepAliveAudio {
             keepAliveAudio = true
-            BackgroundAudioManager.shared.start()
         }
+        BackgroundAudioManager.shared.configurationDidChange()
+        BackgroundLocationManager.shared.configurationDidChange()
     }
 
     // MARK: - Business Logic
```

---

### Incident Patch 2: `6a078be1` (2026-09-27)
**Commit Message**: fix: require a background keep alive

**File**: `StikDebug/App/AppBootstrapper.swift` (modified, +8/-3)
```diff
@@ -29,10 +29,15 @@ enum AppBootstrapper {
     }
 
     private static func startConfiguredKeepAliveServices() {
-        guard UserDefaults.standard.bool(forKey: "keepAliveAudio") else {
-            return
+        let defaults = UserDefaults.standard
+        if defaults.bool(forKey: "keepAliveAudio") {
+            BackgroundAudioManager.shared.start()
+        } else if defaults.bool(forKey: "keepAliveLocation") {
+            BackgroundLocationManager.shared.start()
+        } else {
+            defaults.set(true, forKey: "keepAliveAudio")
+            BackgroundAudioManager.shared.start()
         }
-        BackgroundAudioManager.shared.start()
     }
 
     private static func applyDocumentPickerCopyWorkaround() {
```

**File**: `StikDebug/Services/BackgroundLocationManager.swift` (modified, +43/-20)
```diff
@@ -10,6 +10,7 @@ final class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
 
     private let locationManager = CLLocationManager()
     private var isRunning = false
+    private var persistentEnabled = false
     private var activityCount = 0
 
     private override init() {
@@ -22,35 +23,46 @@ final class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
     }
 
     func start() {
-        isRunning = true
-        switch locationManager.authorizationStatus {
-        case .authorizedAlways:
-            locationManager.startUpdatingLocation()
-        case .authorizedWhenInUse:
-            locationManager.requestAlwaysAuthorization()
-        case .notDetermined:
-            locationManager.requestAlwaysAuthorization()
-        default:
-            break
-        }
+        persistentEnabled = true
+        refreshRunningState()
     }
 
     func stop() {
-        isRunning = false
-        locationManager.stopUpdatingLocation()
+        persistentEnabled = false
+        refreshRunningState()
     }
 
     func requestStart() {
         activityCount += 1
-        if activityCount == 1, UserDefaults.standard.bool(forKey: "keepAliveLocation") {
-            start()
-        }
+        refreshRunningState()
     }
 
     func requestStop() {
         activityCount = max(activityCount - 1, 0)
-        if activityCount == 0 {
-            stop()
+        refreshRunningState()
+    }
+
+    private func refreshRunningState() {
+        let shouldRun = persistentEnabled || (activityCount > 0 && UserDefaults.standard.bool(forKey: "keepAliveLocation"))
+        guard shouldRun != isRunning else { return }
+
+        isRunning = shouldRun
+        guard shouldRun else {
+            locationManager.stopUpdatingLocation()
+            return
+        }
+
+        switch locationManager.authorizationStatus {
+        case .authorizedAlways:
+            locationManager.startUpdatingLocation()
+        case .authorizedWhenInUse:
+            locationManager.requestAlwaysAuthorization()
+        case .notDetermined:
+            locationManager.requestAlwaysAuthorization()
+        case .denied, .restricted:
+            restoreAudioFallback()
+        @unknown default:
+            restoreAudioFallback()
         }
     }
 
@@ -59,11 +71,22 @@ final class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
         switch manager.authorizationStatus {
         case .authorizedAlways, .authorizedWhenInUse:
             manager.startUpdatingLocation()
-        default:
-            break
+        case .denied, .restricted:
+            restoreAudioFallback()
+        case .notDetermined:
+            return
+        @unknown default:
+            restoreAudioFallback()
         }
     }
 
+    private func restoreAudioFallback() {
+        persistentEnabled = false
+        isRunning = activityCount > 0 && UserDefaults.standard.bool(forKey: "keepAliveLocation")
+        UserDefaults.standard.set(true, forKey: "keepAliveAudio")
+        BackgroundAudioManager.shared.start()
+    }
+
     func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
         // Location fixes may fail (e.g. no GPS indoors) — that's fine.
         // The manager just needs to be running, not actually fix a location.
```

**File**: `StikDebug/Views/SettingsView.swift` (modified, +31/-3)
```diff
@@ -95,8 +95,7 @@ struct SettingsView: View {
                         }
                     }
                     .onChange(of: keepAliveAudio) { _, enabled in
-                        if enabled { BackgroundAudioManager.shared.start() }
-                        else { BackgroundAudioManager.shared.stop() }
+                        handleAudioKeepAliveChange(enabled)
                     }
 
                     Toggle(isOn: $keepAliveLocation) {
@@ -107,7 +106,7 @@ struct SettingsView: View {
                         }
                     }
                     .onChange(of: keepAliveLocation) { _, enabled in
-                        if !enabled { BackgroundLocationManager.shared.stop() }
+                        handleLocationKeepAliveChange(enabled)
                     }
 
                 } header: {
@@ -242,6 +241,35 @@ struct SettingsView: View {
         return "Version \(appVersion) • iOS \(UIDevice.current.systemVersion) • \(txmLabel)"
     }
 
+    private func handleAudioKeepAliveChange(_ enabled: Bool) {
+        if enabled {
+            BackgroundAudioManager.shared.start()
+            BackgroundLocationManager.shared.stop()
+            return
+        }
+
+        if !keepAliveLocation {
+            keepAliveLocation = true
+        }
+        BackgroundAudioManager.shared.stop()
+        BackgroundLocationManager.shared.start()
+    }
+
+    private func handleLocationKeepAliveChange(_ enabled: Bool) {
+        if enabled {
+            if !keepAliveAudio {
+                BackgroundLocationManager.shared.start()
+            }
+            return
+        }
+
+        BackgroundLocationManager.shared.stop()
+        if !keepAliveAudio {
+            keepAliveAudio = true
+            BackgroundAudioManager.shared.start()
+        }
+    }
+
     // MARK: - Business Logic
 
     private func openAppFolder() {
```

---

### Incident Patch 3: `2d09a405` (2026-09-27)
**Commit Message**: fix: limit idevice log file size

**File**: `StikDebug/App/AppBootstrapper.swift` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ import UIKit
 
 enum AppBootstrapper {
     static func configure() {
+        IdeviceLogFileManager.shared.prepareForLogging()
         registerDefaultSettings()
         startConfiguredKeepAliveServices()
         applyDocumentPickerCopyWorkaround()
```

**File**: `StikDebug/Device/JITEnableContext.swift` (modified, +1/-5)
```diff
@@ -82,11 +82,7 @@ final class JITEnableContext {
     var handshakeHandle: OpaquePointer? { handshake }
 
     private init() {
-        let logURL = FileManager.default
-            .urls(for: .documentDirectory, in: .userDomainMask)[0]
-            .appendingPathComponent("idevice_log.txt")
-
-        var path = Array(logURL.path.utf8CString)
+        var path = Array(IdeviceLogFileManager.logURL.path.utf8CString)
         path.withUnsafeMutableBufferPointer { buffer in
             _ = idevice_init_logger(Info, Debug, buffer.baseAddress)
         }
```

**File**: `StikDebug/Services/IdeviceLogFileManager.swift` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+//
+//  IdeviceLogFileManager.swift
+//  StikDebug
+//
+
+import Foundation
+
+final class IdeviceLogFileManager {
+    static let shared = IdeviceLogFileManager()
+    static let logURL = URL.documentsDirectory.appendingPathComponent("idevice_log.txt")
+
+    private static let maximumSize: UInt64 = 20 * 1024 * 1024
+    private static let retainedSize: UInt64 = 10 * 1024 * 1024
+    private static let checkInterval: TimeInterval = 5
+
+    private let queue = DispatchQueue(label: "com.stik.ideviceLogFile", qos: .utility)
+    private var timer: DispatchSourceTimer?
+
+    private init() {}
+
+    func prepareForLogging() {
+        compactIfNeeded()
+
+        queue.async {
+            guard self.timer == nil else { return }
+
+            let timer = DispatchSource.makeTimerSource(queue: self.queue)
+            timer.schedule(deadline: .now() + Self.checkInterval, repeating: Self.checkInterval)
+            timer.setEventHandler { [weak self] in
+                self?.compactIfNeeded()
+            }
+            self.timer = timer
+            timer.resume()
+        }
+    }
+
+    private func compactIfNeeded() {
+        let fileManager = FileManager.default
+        guard let attributes = try? fileManager.attributesOfItem(atPath: Self.logURL.path),
+              let fileSize = attributes[.size] as? NSNumber,
+              fileSize.uint64Value > Self.maximumSize,
+              let handle = try? FileHandle(forUpdating: Self.logURL) else {
+            return
+        }
+
+        defer { try? handle.close() }
+
+        do {
+            let endOffset = try handle.seekToEnd()
+            let startOffset = endOffset > Self.retainedSize ? endOffset - Self.retainedSize : 0
+            try handle.seek(toOffset: startOffset)
+            var recentData = try handle.readToEnd() ?? Data()
+
+            if startOffset > 0, let newlineIndex = recentData.firstIndex(of: 0x0A) {
+                recentData.removeSubrange(recentData.startIndex...newlineIndex)
+            }
+
+            try handle.truncate(atOffset: 0)
+            try handle.seek(toOffset: 0)
+            try handle.write(contentsOf: recentData)
+            try handle.synchronize()
+        } catch {
+            return
+        }
+    }
+}
```

**File**: `StikDebug/Views/ConsoleLogsView.swift` (modified, +3/-3)
```diff
@@ -266,7 +266,7 @@ struct ConsoleLogsView: View {
 
     @ViewBuilder
     private var exportMenuOption: some View {
-        let logURL: URL = URL.documentsDirectory.appendingPathComponent("idevice_log.txt")
+        let logURL = IdeviceLogFileManager.logURL
         if FileManager.default.fileExists(atPath: logURL.path) {
             ShareLink(
                 item: logURL,
@@ -309,7 +309,7 @@ struct ConsoleLogsView: View {
         guard !isLoadingLogs else { return }
         isLoadingLogs = true
 
-        let logPath = URL.documentsDirectory.appendingPathComponent("idevice_log.txt").path
+        let logPath = IdeviceLogFileManager.logURL.path
 
         guard FileManager.default.fileExists(atPath: logPath) else {
             await MainActor.run {
@@ -368,7 +368,7 @@ struct ConsoleLogsView: View {
         guard !isLoadingLogs else { return }
         isLoadingLogs = true
 
-        let logPath = URL.documentsDirectory.appendingPathComponent("idevice_log.txt").path
+        let logPath = IdeviceLogFileManager.logURL.path
         let previousCount = lastProcessedLineCount
 
         guard FileManager.default.fileExists(atPath: logPath) else {
```

---

### Incident Patch 4: `cbaf467b` (2026-09-27)
**Commit Message**: fix: restore personalized DDI mounting

**File**: `StikDebug/Device/IdeviceFFIBridge.swift` (modified, +82/-0)
```diff
@@ -44,6 +44,35 @@ private enum IdeviceBridge {
         return makeError(domain: domain, code: code, message: message)
     }
 
+    static func mappedFileData(atPath path: String, description: String) throws -> Data {
+        let url = URL(fileURLWithPath: path)
+
+        do {
+            let data = try Data(contentsOf: url, options: .mappedIfSafe)
+            guard !data.isEmpty else {
+                throw makeError(message: "\(description) is empty")
+            }
+            return data
+        } catch let error as NSError {
+            throw makeError(code: error.code, message: "Failed to read \(description): \(error.localizedDescription)")
+        }
+    }
+
+    static func uint64Value(from plist: plist_t?, fieldName: String) throws -> UInt64 {
+        guard let plist else {
+            throw makeError(message: "\(fieldName) was not returned by lockdownd")
+        }
+
+        var value: UInt64 = 0
+        plist_get_uint_val(plist, &value)
+
+        guard value != 0 else {
+            throw makeError(message: "Failed to decode \(fieldName)")
+        }
+
+        return value
+    }
+
     static func withTunnelHandles<T>(
         for context: JITEnableContext,
         _ body: (OpaquePointer, OpaquePointer) throws -> T
@@ -295,6 +324,59 @@ extension JITEnableContext {
         }
     }
 
+    func mountPersonalDDI(withImagePath imagePath: String, trustcachePath: String, manifestPath: String) throws {
+        let imageData = try IdeviceBridge.mappedFileData(atPath: imagePath, description: "developer disk image")
+        let trustcacheData = try IdeviceBridge.mappedFileData(atPath: trustcachePath, description: "developer disk image trust cache")
+        let manifestData = try IdeviceBridge.mappedFileData(atPath: manifestPath, description: "developer disk image manifest")
+
+        try IdeviceBridge.withTunnelHandles(for: self) { adapter, handshake in
+            let uniqueChipID = try IdeviceBridge.withConnectedClient(
+                fallback: "Failed to connect to lockdownd",
+                missingClientMessage: "Lockdownd client was not created",
+                connect: { lockdownd_connect_rsd(adapter, handshake, $0) },
+                cleanup: { lockdownd_client_free($0) }
+            ) { lockdownClient in
+                var uniqueChipIDPlist: plist_t?
+                if let ffiError = lockdownd_get_value(lockdownClient, "UniqueChipID", nil, &uniqueChipIDPlist) {
+                    throw IdeviceBridge.consumeFFIError(ffiError, fallback: "Failed to query UniqueChipID")
+                }
+                defer { plist_free(uniqueChipIDPlist) }
+                return try IdeviceBridge.uint64Value(from: uniqueChipIDPlist, fieldName: "UniqueChipID")
+            }
+
+            try IdeviceBridge.withConnectedClient(
+                fallback: "Failed to connect to image mounter",
+                missingClientMessage: "Image mounter client was not created",
+                connect: { image_mounter_connect_rsd(adapter, handshake, $0) },
+                cleanup: { image_mounter_free($0) }
+            ) { imageMounterClient in
+                let ffiError = imageData.withUnsafeBytes { imageBuffer in
+                    trustcacheData.withUnsafeBytes { trustcacheBuffer in
+                        manifestData.withUnsafeBytes { manifestBuffer in
+                            image_mounter_mount_personalized_rsd(
+                                imageMounterClient,
+                                adapter,
+                                handshake,
+                                imageBuffer.bindMemory(to: UInt8.self).baseAddress,
+                                imageData.count,
+                                trustcacheBuffer.bindMemory(to: UInt8.self).baseAddress,
+                                trustcacheData.count,
+                                manifestBuffer.bindMemory(to: UInt8.self).baseAddress,
+                                manifestData.count,
+                                nil,
+                                uniqueChipID
+                            )
+                        }
+                    }
+                }
+
+                if let ffiError {
+                    throw IdeviceBridge.consumeFFIError(ffiError, fallback: "Failed to mount personalized DDI")
+                }
+            }
+        }
+    }
+
     func fetchAllProfiles() throws -> [Data] {
         try IdeviceBridge.withTunnelHandles(for: self) { adapter, handshake in
             try IdeviceBridge.withConnectedClient(
```

**File**: `StikDebug/Device/MountingProgress.swift` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ final class MountingProgress: ObservableObject {
                 self.coolisMounted = true
                 self.checkforMounted()
             } else if let mountError {
-                LogManager.shared.addErrorLog("Failed to install DDI cryptex: \(mountError)")
+                LogManager.shared.addErrorLog("Failed to mount DDI: \(mountError)")
                 showAlert(title: "DDI Mount Failed", message: mountError, showOk: true, showTryAgain: true) { shouldTryAgain in
                     if shouldTryAgain {
                         self.pubMount()
```

**File**: `StikDebug/Device/mountDDI.swift` (modified, +9/-1)
```diff
@@ -33,7 +33,15 @@ func checkMountStatus() -> MountCheckResult {
 
 func mountDeveloperDiskImage(from directoryPath: String) -> String? {
     do {
-        try JITEnableContext.shared.installCryptexDDI(from: directoryPath)
+        if DeveloperDiskImageService.usesCryptexDDI {
+            try JITEnableContext.shared.installCryptexDDI(from: directoryPath)
+        } else {
+            try JITEnableContext.shared.mountPersonalDDI(
+                withImagePath: URL(fileURLWithPath: directoryPath).appendingPathComponent("Image.dmg").path,
+                trustcachePath: URL(fileURLWithPath: directoryPath).appendingPathComponent("Image.dmg.trustcache").path,
+                manifestPath: URL(fileURLWithPath: directoryPath).appendingPathComponent("BuildManifest.plist").path
+            )
+        }
     } catch {
         return error.localizedDescription
     }
```

**File**: `StikDebug/Services/DeveloperDiskImageService.swift` (modified, +72/-8)
```diff
@@ -12,7 +12,11 @@ final class DeveloperDiskImageService {
     static var filesAreReady: Bool {
         downloadItems.allSatisfy {
             FileManager.default.fileExists(atPath: directoryURL.appendingPathComponent($0.fileName).path)
-        }
+        } && (try? String(contentsOf: mountMethodURL, encoding: .utf8)) == mountMethod.rawValue
+    }
+
+    static var usesCryptexDDI: Bool {
+        mountMethod == .cryptex
     }
 
     private let fileManager: FileManager
@@ -24,20 +28,21 @@ final class DeveloperDiskImageService {
     }
 
     func downloadMissingFiles() async throws {
-        let hasCryptexMarker = ["Image.dmg.cryptex_info", "Image.dmg.root_hash"].contains {
-            fileManager.fileExists(atPath: Self.directoryURL.appendingPathComponent($0).path)
-        }
-        let replaceLegacyFiles = !hasCryptexMarker && Self.downloadItems.contains {
-            fileManager.fileExists(atPath: Self.directoryURL.appendingPathComponent($0.fileName).path)
+        let installedMethod = try? String(contentsOf: Self.mountMethodURL, encoding: .utf8)
+        let replaceFiles = installedMethod != Self.mountMethod.rawValue
+
+        if !Self.usesCryptexDDI {
+            try removeCryptexOnlyFiles()
         }
 
         for item in Self.downloadItems {
             let destinationURL = Self.directoryURL.appendingPathComponent(item.fileName)
-            guard replaceLegacyFiles || !fileManager.fileExists(atPath: destinationURL.path) else {
+            guard replaceFiles || !fileManager.fileExists(atPath: destinationURL.path) else {
                 continue
             }
             try await downloadFile(from: item.urlString, to: destinationURL)
         }
+        try Self.mountMethod.rawValue.write(to: Self.mountMethodURL, atomically: true, encoding: .utf8)
     }
 
     func downloadFile(from urlString: String, to destinationURL: URL) async throws {
@@ -70,6 +75,12 @@ final class DeveloperDiskImageService {
         var completedStages = 0.0
 
         progressHandler?(0.0, "Removing existing DDI files...")
+        if fileManager.fileExists(atPath: Self.mountMethodURL.path) {
+            try fileManager.removeItem(at: Self.mountMethodURL)
+        }
+        if !Self.usesCryptexDDI {
+            try removeCryptexOnlyFiles()
+        }
         let completionMarker = Self.directoryURL.appendingPathComponent("Image.dmg.root_hash")
         if fileManager.fileExists(atPath: completionMarker.path) {
             try fileManager.removeItem(at: completionMarker)
@@ -92,10 +103,40 @@ final class DeveloperDiskImageService {
             progressHandler?(completedStages / totalStages, "\(item.name) ready")
         }
 
+        try Self.mountMethod.rawValue.write(to: Self.mountMethodURL, atomically: true, encoding: .utf8)
+
         progressHandler?(1.0, "DDI download complete.")
     }
 
-    private static let downloadItems: [DDIDownloadItem] = [
+    private func removeCryptexOnlyFiles() throws {
+        for fileName in Self.cryptexOnlyFileNames {
+            let fileURL = Self.directoryURL.appendingPathComponent(fileName)
+            if fileManager.fileExists(atPath: fileURL.path) {
+                try fileManager.removeItem(at: fileURL)
+            }
+        }
+    }
+
+    private static var mountMethod: DDIMountMethod {
+        let version = ProcessInfo.processInfo.operatingSystemVersion
+        return version.majorVersion > 26 || (version.majorVersion == 26 && version.minorVersion >= 4)
+            ? .cryptex
+            : .personalized
+    }
+
+    private static let mountMethodURL = directoryURL.appendingPathComponent("MountMethod")
+    private static let cryptexOnlyFileNames = ["Image.dmg.cryptex_info", "Image.dmg.root_hash"]
+
+    private static var downloadItems: [DDIDownloadItem] {
+        switch mountMethod {
+        case .cryptex:
+            return cryptexDownloadItems
+        case .personalized:
+            return personalizedDownloadItems
+        }
+    }
+
+    private static let cryptexDownloadItems: [DDIDownloadItem] = [
         .init(
             name: "Build Manifest",
             fileName: "BuildManifest.plist",
@@ -122,6 +163,29 @@ final class DeveloperDiskImageService {
             urlString: "https://github.com/doronz88/DeveloperDiskImage/raw/refs/heads/main/PersonalizedImages/Xcode_iOS_DDI_Cryptex/Image.dmg.root_hash"
         )
     ]
+
+    private static let personalizedDownloadItems: [DDIDownloadItem] = [
+        .init(
+            name: "Build Manifest",
+            fileName: "BuildManifest.plist",
+            urlString: "https://github.com/doronz88/DeveloperDiskImage/raw/refs/heads/main/PersonalizedImages/Xcode_iOS_DDI_Personalized/BuildManifest.plist"
+        ),
+        .init(
+            name: "Image",
+            fileName: "Image.dmg",
+            urlString: "https://github.com/doronz88/DeveloperDiskImage/raw/refs/heads/main/PersonalizedImages/Xcode_iOS_DDI_Personalized/Image.dmg"
+        ),
+        .init(
+            name
```

---

### Incident Patch 5: `94bc9e8c` (2026-09-09)
**Commit Message**: Add Malloc Debugging (#460)

* added malloc implementation

* update malloc debugging label in settings

---------

Co-authored-by: Leviidev <[REDACTED_EMAIL]>

**File**: `StikDebug/Device/JITEnableContext.swift` (modified, +34/-1)
```diff
@@ -17,6 +17,37 @@ typealias SyslogErrorHandler = (NSError?) -> Void
 final class JITEnableContext {
     static let shared = JITEnableContext()
 
+    private static func withCStringArray<R>(
+        _ strings: [String], _ body: (UnsafePointer<UnsafePointer<CChar>?>?, UInt) -> R
+    ) -> R {
+        if strings.isEmpty {
+            return body(nil, 0)
+        }
+        var cStrings: [UnsafeMutablePointer<CChar>?] = strings.map { strdup($0) }
+        defer { cStrings.forEach { free($0) } }
+        return cStrings.withUnsafeBufferPointer { buffer in
+            buffer.baseAddress!.withMemoryRebound(to: UnsafePointer<CChar>?.self, capacity: buffer.count) { rebound in
+                body(rebound, UInt(buffer.count))
+            }
+        }
+    }
+
+    private static func mallocDebugEnvVars() -> [String] {
+        let defaults = UserDefaults.standard
+        let enableAll = defaults.bool(forKey: UserDefaults.Keys.mallocDebug)
+        let guardEdges = enableAll || defaults.bool(forKey: UserDefaults.Keys.mallocGuardEdges)
+        let scribble = enableAll || defaults.bool(forKey: UserDefaults.Keys.mallocScribble)
+
+        var envVars: [String] = []
+        if guardEdges {
+            envVars.append("MallocGuardEdges=1")
+        }
+        if scribble {
+            envVars.append("MallocScribble=1")
+        }
+        return envVars
+    }
+
     private struct TunnelHandles {
         var adapter: OpaquePointer?
         var handshake: OpaquePointer?
@@ -603,7 +634,9 @@ final class JITEnableContext {
             try withProcessControl(remoteServer: remoteServer) { processControl in
                 var pid: UInt64 = 0
                 let ffiError = bundleID.withCString { bundleID in
-                    process_control_launch_app(processControl, bundleID, nil, 0, nil, 0, true, false, &pid)
+                    Self.withCStringArray(Self.mallocDebugEnvVars()) { envPtr, envCount in
+                        process_control_launch_app(processControl, bundleID, envPtr, envCount, nil, 0, true, false, &pid)
+                    }
                 }
 
                 if let ffiError {
```

**File**: `StikDebug/Support/UserDefaults+Keys.swift` (modified, +4/-0)
```diff
@@ -15,5 +15,9 @@ extension UserDefaults {
         static let defaultScriptName = "DefaultScriptName"
         static let defaultScriptNameValue = ""
         static let targetDeviceIP = "TunnelDeviceIP"
+        /// Attaches processes with MallocGuardEdges and MallocScribble.
+        static let mallocDebug = "enableMallocDebug"
+        static let mallocGuardEdges = "enableMallocGuardEdges"
+        static let mallocScribble = "enableMallocScribble"
     }
 }
```

**File**: `StikDebug/Views/SettingsView.swift` (modified, +11/-0)
```diff
@@ -19,6 +19,7 @@ struct SettingsView: View {
     @AppStorage("keepAliveAudio") private var keepAliveAudio = true
     @AppStorage("keepAliveLocation") private var keepAliveLocation = true
     @AppStorage(UserDefaults.Keys.targetDeviceIP) private var targetDeviceIP = DeviceConnectionContext.defaultTargetIPAddress
+    @AppStorage(UserDefaults.Keys.mallocDebug) private var mallocDebug = false
 
     @State private var isShowingPairingFilePicker = false
     @State private var isImportingFile = false
@@ -131,6 +132,16 @@ struct SettingsView: View {
                     }
                 }
 
+                Section("Debugging") {
+                    Toggle(isOn: $mallocDebug) {
+                        VStack(alignment: .leading, spacing: 2) {
+                            Text("Malloc Debugging")
+                            Text("Attaches processes with MallocGuardEdges and MallocScribble to detect memory corruption.")
+                                .font(.caption).foregroundStyle(.secondary)
+                        }
+                    }
+                }
+
                 Section("Advanced") {
                     HStack {
                         Text("Target Device IP")
```

---

### Incident Patch 6: `c5bad70d` (2026-08-27)
**Commit Message**: ci: integrate source update into build workflow

**File**: `.github/scripts/update_source.sh` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+#!/bin/bash
+
+set -euo pipefail
+
+website_directory=${1:?Usage: update_source.sh WEBSITE_DIRECTORY RELEASE_VERSION}
+release_version=${2:?Usage: update_source.sh WEBSITE_DIRECTORY RELEASE_VERSION}
+
+cd "$website_directory"
+
+git config user.name 'GitHub Action'
+git config user.email 'action@github.com'
+
+python3 updatesource.py index.json
+git add index.json
+
+if git diff --staged --quiet; then
+    echo 'Website/index.json is already current.'
+    exit 0
+fi
+
+git commit -m "chore: update StikDebug source for $release_version"
+git push origin main
```

**File**: `.github/workflows/build_ipa.yml` (modified, +34/-12)
```diff
@@ -7,12 +7,6 @@ on:
   pull_request:
     branches: [ "main" ]
   workflow_dispatch:
-    inputs:
-      create_release:
-        description: Create a GitHub release from this ref
-        required: false
-        default: false
-        type: boolean
 
 permissions:
   contents: write
@@ -21,6 +15,8 @@ jobs:
   build:
     name: Build IPA
     runs-on: macos-latest
+    outputs:
+      version: ${{ steps.version.outputs.version }}
     env:
       UPLOAD_IPA: ${{ vars.UPLOAD_IPA || 'true' }}
 
@@ -59,14 +55,14 @@ jobs:
 
       - name: 5. Name workflow artifact
         id: artifact
-        if: env.UPLOAD_IPA == 'true' && (github.event_name == 'push' || github.event_name == 'pull_request')
+        if: env.UPLOAD_IPA == 'true'
         run: |
           file_name="StikDebug-${GITHUB_SHA::7}.ipa"
           cp StikDebug.ipa "$file_name"
           echo "file_name=$file_name" >> "$GITHUB_OUTPUT"
 
       - name: 6. Store IPA as Workflow Artifact
-        if: env.UPLOAD_IPA == 'true' && (github.event_name == 'push' || github.event_name == 'pull_request')
+        if: env.UPLOAD_IPA == 'true'
         uses: actions/upload-artifact@v7
         with:
           path: ${{ steps.artifact.outputs.file_name }}
@@ -75,7 +71,7 @@ jobs:
 
       - name: Read version
         id: version
-        if: startsWith(github.ref, 'refs/tags/') || inputs.create_release
+        if: startsWith(github.ref, 'refs/tags/')
         run: |
           version=$(xcodebuild -project StikDebug.xcodeproj -scheme StikDebug -showBuildSettings | awk -F ' = ' '/ MARKETING_VERSION = / { print $2; exit }')
           test -n "$version"
@@ -85,16 +81,42 @@ jobs:
           echo "version=$version" >> "$GITHUB_OUTPUT"
 
       - name: Name release asset
-        if: startsWith(github.ref, 'refs/tags/') || inputs.create_release
+        if: startsWith(github.ref, 'refs/tags/')
         run: mv StikDebug.ipa StikDebug-${{ steps.version.outputs.version }}.ipa
 
       - name: Publish release
-        if: startsWith(github.ref, 'refs/tags/') || inputs.create_release
+        if: startsWith(github.ref, 'refs/tags/')
         uses: softprops/action-gh-release@v3
         with:
           name: ${{ steps.version.outputs.version }}
-          tag_name: ${{ github.ref_type == 'tag' && github.ref_name || steps.version.outputs.version }}
+          tag_name: ${{ github.ref_name }}
           target_commitish: ${{ github.sha }}
           files: StikDebug-${{ steps.version.outputs.version }}.ipa
           generate_release_notes: true
           fail_on_unmatched_files: true
+
+  update-source:
+    name: Update website source
+    if: startsWith(github.ref, 'refs/tags/')
+    needs: build
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: Checkout source
+        uses: actions/checkout@v6
+
+      - name: Checkout website
+        uses: actions/checkout@v6
+        with:
+          repository: StikDebug/Website
+          ref: main
+          path: Website
+          token: ${{ secrets.WEBSITE_TOKEN }}
+
+      - name: Set up Python
+        uses: actions/setup-python@v7
+        with:
+          python-version: '3.x'
+
+      - name: Update StikDebug source
+        run: .github/scripts/update_source.sh Website '${{ needs.build.outputs.version }}'
```

**File**: `.github/workflows/updatesource.yml` (removed, +0/-74)
```diff
@@ -1,74 +0,0 @@
-name: Update StikDebug Source
-
-on:
-  push:
-    tags: ["[0-9]*"]
-
-permissions:
-  actions: read
-
-jobs:
-  update-source:
-    runs-on: ubuntu-latest
-    steps:
-    - name: Wait for IPA build
-      env:
-        GH_TOKEN: ${{ github.token }}
-      run: |
-        endpoint="$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/actions/workflows/build_ipa.yml/runs?event=push&branch=$GITHUB_REF_NAME&head_sha=$GITHUB_SHA"
-        for _ in {1..120}; do
-          run=$(curl --fail --silent --show-error \
-            -H "Authorization: Bearer $GH_TOKEN" \
-            -H "Accept: application/vnd.github+json" \
-            "$endpoint" | jq '.workflow_runs[0] // empty')
-          status=$(jq -r '.status // empty' <<< "$run")
-          conclusion=$(jq -r '.conclusion // empty' <<< "$run")
-          if [ "$status" = "completed" ]; then
-            test "$conclusion" = "success"
-            exit 0
-          fi
-          sleep 30
-        done
-        echo "Timed out waiting for Build Debug IPA."
-        exit 1
-
-    - name: Checkout Website
-      uses: actions/checkout@v6
-      with:
-        repository: StikDebug/Website
-        ref: main
-        path: Website
-        token: ${{ secrets.WEBSITE_TOKEN }}
-
-    - name: Set up Python
-      uses: actions/setup-python@v7
-      with:
-        python-version: '3.x'
-
-    - name: Update StikDebug source
-      id: update_source
-      working-directory: Website
-      run: |
-        git config --global user.name 'GitHub Action'
-        git config --global user.email 'action@github.com'
-
-        python updatesource.py index.json
-        git add index.json
-        if git diff --staged --quiet; then
-          echo "changes=false" >> $GITHUB_OUTPUT
-          echo "No changes detected in index.json"
-        else
-          git commit -m "Update StikDebug source for latest release"
-          git push origin main
-          echo "changes=true" >> $GITHUB_OUTPUT
-        fi
-
-    - name: Create job summary
-      run: |
-        if [[ "${{ steps.update_source.outputs.changes }}" == "true" ]]; then
-          echo "## StikDebug source updated" >> $GITHUB_STEP_SUMMARY
-          echo "Website/index.json was updated and pushed." >> $GITHUB_STEP_SUMMARY
-        else
-          echo "## StikDebug source already current" >> $GITHUB_STEP_SUMMARY
-          echo "No change to Website/index.json was needed." >> $GITHUB_STEP_SUMMARY
-        fi
```

---

### Incident Patch 7: `b916fe51` (2026-08-27)
**Commit Message**: fix: prevent stalled tunnel connections from exhausting threads

**File**: `StikDebug/Device/JITEnableContext.swift` (modified, +3/-1)
```diff
@@ -188,7 +188,9 @@ final class JITEnableContext {
             tunnelLock.unlock()
 
             if let waitSemaphore {
-                waitSemaphore.wait()
+                guard waitSemaphore.wait(timeout: .now() + .seconds(15)) == .success else {
+                    throw makeError("Timed out waiting for the tunnel connection", code: -19)
+                }
                 waitSemaphore.signal()
             }
 
```

**File**: `StikDebug/Device/MountingProgress.swift` (modified, +20/-0)
```diff
@@ -13,11 +13,29 @@ final class MountingProgress: ObservableObject {
     @Published private(set) var mountingThread: Thread?
     @Published private(set) var coolisMounted: Bool = false
 
+    private let mountCheckLock = NSLock()
+    private var mountCheckInProgress = false
+
     private init() {}
 
     func checkforMounted() {
+        guard TunnelManager.shared.isConnected else { return }
+
+        mountCheckLock.lock()
+        guard !mountCheckInProgress else {
+            mountCheckLock.unlock()
+            return
+        }
+        mountCheckInProgress = true
+        mountCheckLock.unlock()
+
         DispatchQueue.global(qos: .utility).async {
             let mounted = isMounted()
+
+            self.mountCheckLock.lock()
+            self.mountCheckInProgress = false
+            self.mountCheckLock.unlock()
+
             DispatchQueue.main.async {
                 self.coolisMounted = mounted
             }
@@ -32,6 +50,8 @@ final class MountingProgress: ObservableObject {
     }
 
     func pubMount() {
+        guard TunnelManager.shared.isConnected else { return }
+
         DispatchQueue.global(qos: .utility).async { [weak self] in
             self?.mount()
         }
```

**File**: `StikDebug/Features/InstalledApps/InstalledAppsViewModel.swift` (modified, +6/-1)
```diff
@@ -20,10 +20,15 @@ final class InstalledAppsViewModel: ObservableObject {
     private let cacheKeyDebuggable = "cachedDebuggableApps"
     private let cacheKeyNonDebuggable = "cachedNonDebuggableApps"
     private let cacheKeySystem = "cachedSystemApps"
+    private var cancellables: Set<AnyCancellable> = []
 
     init() {
         loadCachedApps()
-        refreshAppLists()
+        TunnelManager.shared.$isConnected
+            .removeDuplicates()
+            .filter { $0 }
+            .sink { [weak self] _ in self?.refreshAppLists() }
+            .store(in: &cancellables)
     }
 
     func refreshAppLists() {
```

**File**: `StikDebug/Views/InstalledAppsListView.swift` (modified, +3/-1)
```diff
@@ -83,7 +83,9 @@ struct InstalledAppsListView: View {
             handleLoadingChange(isLoading)
         }
         .onReceive(NotificationCenter.default.publisher(for: .pairingFileImported)) { _ in
-            viewModel.refreshAppLists()
+            if TunnelManager.shared.isConnected {
+                viewModel.refreshAppLists()
+            }
         }
     }
 
```

---

### Incident Patch 8: `460fb235` (2026-08-25)
**Commit Message**: Fix uncomfortable blue line

**File**: `README.md` (modified, +4/-9)
```diff
@@ -37,15 +37,10 @@
 > [!NOTE]
 > **Notice:** StikDebug is no longer available on the App Store. Please use the official download methods below.
 
-<h3>
-<div align="center" style="display: flex; justify-content: center; align-items: center; gap: 16px; flex-wrap: wrap;">
-   <a href="https://altdirect.app/?url=https://stikdebug.xyz/index.json" target="_blank">
-     <img src="https://altdirect.app/assets/png/AltSource_Blue.png" alt="Add AltSource" width="200">
-   </a>
-   <a href="https://github.com/StikDebug/StikDebug/releases/download/3.1.9/StikDebug-3.1.9.ipa" target="_blank">
-     <img src="https://altdirect.app/assets/png/Download_Blue.png" alt="Download .ipa" width="200">
-   </a>
-</div>
+<h3 align="center">
+<a href="https://altdirect.app/?url=https://stikdebug.xyz/index.json" target="_blank"><img src="https://altdirect.app/assets/png/AltSource_Blue.png" alt="Add AltSource" width="200"></a>
+&nbsp;
+<a href="https://github.com/StikDebug/StikDebug/releases/download/3.1.9/StikDebug-3.1.9.ipa" target="_blank"><img src="https://altdirect.app/assets/png/Download_Blue.png" alt="Download .ipa" width="200"></a>
 </h3>
 
 ## Compatibility
```

---

### Incident Patch 9: `70d31322` (2026-08-25)
**Commit Message**: Fix DDI mount watchdog crash (hopefully)

**File**: `StikDebug/Device/MountingProgress.swift` (modified, +4/-2)
```diff
@@ -32,7 +32,9 @@ final class MountingProgress: ObservableObject {
     }
 
     func pubMount() {
-        mount()
+        DispatchQueue.global(qos: .utility).async { [weak self] in
+            self?.mount()
+        }
     }
 
     private func mount() {
@@ -62,7 +64,7 @@ final class MountingProgress: ObservableObject {
                 if let mountError {
                     showAlert(title: "DDI Mount Failed", message: mountError, showOk: true, showTryAgain: true) { shouldTryAgain in
                         if shouldTryAgain {
-                            self.mount()
+                            self.pubMount()
                         }
                     }
                 } else {
```

---

### Incident Patch 10: `ae460a7a` (2026-08-07)
**Commit Message**: Fix extra line

**File**: `README.md` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@
 > [!NOTE]
 > **Notice:** StikDebug is no longer available on the App Store. Please use the official download methods below.
 
-<h1>
+<h3>
 <div align="center" style="display: flex; justify-content: center; align-items: center; gap: 16px; flex-wrap: wrap;">
    <a href="https://altdirect.app/?url=https://stikdebug.xyz/index.json" target="_blank">
      <img src="https://altdirect.app/assets/png/AltSource_Blue.png" alt="Add AltSource" width="200">
@@ -46,7 +46,7 @@
      <img src="https://altdirect.app/assets/png/Download_Blue.png" alt="Download .ipa" width="200">
    </a>
 </div>
-</h1>
+</h3>
 
 ## Compatibility
 
```

---

### Incident Patch 11: `8fdfb193` (2026-08-07)
**Commit Message**: Fix image links in README.md

**File**: `README.md` (modified, +4/-2)
```diff
@@ -37,14 +37,16 @@
 > [!NOTE]
 > **Notice:** StikDebug is no longer available on the App Store. Please use the official download methods below.
 
+<h1>
 <div align="center" style="display: flex; justify-content: center; align-items: center; gap: 16px; flex-wrap: wrap;">
    <a href="https://altdirect.app/?url=https://stikdebug.xyz/index.json" target="_blank">
-     <img src="https://github.com/stikdebug/altdirect/blob/main/assets/png/AltSource_Blue.png" alt="Add AltSource" width="200">
+     <img src="https://altdirect.app/assets/png/AltSource_Blue.png" alt="Add AltSource" width="200">
    </a>
    <a href="https://github.com/StikDebug/StikDebug/releases/download/3.1.9/StikDebug-3.1.9.ipa" target="_blank">
-     <img src="https://github.com/stikdebug/altdirect/blob/main/assets/png/Download_Blue.png" alt="Download .ipa" width="200">
+     <img src="https://altdirect.app/assets/png/Download_Blue.png" alt="Download .ipa" width="200">
    </a>
 </div>
+</h1>
 
 ## Compatibility
 
```

---

### Incident Patch 12: `a8a4892a` (2026-08-04)
**Commit Message**: fix: target Website source workflow

**File**: `.github/workflows/updatesource.yml` (modified, +3/-1)
```diff
@@ -32,10 +32,12 @@ jobs:
         echo "Timed out waiting for Build Debug IPA."
         exit 1
 
-    - name: Checkout StikDebug
+    - name: Checkout Website
       uses: actions/checkout@v6
       with:
+        repository: StikDebug/Website
         ref: main
+        path: Website
         token: ${{ secrets.WEBSITE_TOKEN }}
 
     - name: Set up Python
```

---

### Incident Patch 13: `30a147aa` (2026-08-01)
**Commit Message**: ci: wait for tagged IPA builds

**File**: `.github/workflows/updatesource.yml` (modified, +26/-4)
```diff
@@ -1,21 +1,43 @@
 name: Update StikDebug Source
 
 on:
-  release:
-    types: [published]
-  workflow_dispatch:
+  push:
+    tags: ["[0-9]*"]
+
+permissions:
+  actions: read
 
 jobs:
   update-source:
     runs-on: ubuntu-latest
     steps:
+    - name: Wait for IPA build
+      env:
+        GH_TOKEN: ${{ github.token }}
+      run: |
+        endpoint="$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/actions/workflows/build_ipa.yml/runs?event=push&branch=$GITHUB_REF_NAME&head_sha=$GITHUB_SHA"
+        for _ in {1..120}; do
+          run=$(curl --fail --silent --show-error \
+            -H "Authorization: Bearer $GH_TOKEN" \
+            -H "Accept: application/vnd.github+json" \
+            "$endpoint" | jq '.workflow_runs[0] // empty')
+          status=$(jq -r '.status // empty' <<< "$run")
+          conclusion=$(jq -r '.conclusion // empty' <<< "$run")
+          if [ "$status" = "completed" ]; then
+            test "$conclusion" = "success"
+            exit 0
+          fi
+          sleep 30
+        done
+        echo "Timed out waiting for Build Debug IPA."
+        exit 1
+
     - name: Checkout Website-Stuff
       uses: actions/checkout@v6
       with:
         repository: StephenDev0/Website-Stuff
         ref: main
         path: Website-Stuff
-        # A repository-scoped GITHUB_TOKEN cannot push to Website-Stuff.
         token: ${{ secrets.WEBSITE_STUFF_TOKEN }}
 
     - name: Set up Python
```

---

### Incident Patch 14: `60accbe1` (2026-07-26)
**Commit Message**: Reuse open remote server for JIT bounce-back to avoid cold-launch race

**File**: `StikDebug/Device/JITEnableContext.swift` (modified, +27/-12)
```diff
@@ -645,18 +645,7 @@ final class JITEnableContext {
     func relaunchApp(_ bundleID: String, logger: LogFunc? = nil) -> Bool {
         do {
             let pid = try withConnectedRemoteServer { remoteServer in
-                try withProcessControl(remoteServer: remoteServer) { processControl in
-                    var pid: UInt64 = 0
-                    let ffiError = bundleID.withCString { bundleID in
-                        process_control_launch_app(processControl, bundleID, nil, 0, nil, 0, false, false, &pid)
-                    }
-
-                    if let ffiError {
-                        throw error(from: ffiError, fallback: "Failed to return to app")
-                    }
-
-                    return pid
-                }
+                try relaunchApp(bundleID, remoteServer: remoteServer)
             }
 
             emitLog("Returned to \(bundleID) (PID \(pid))", logger: logger)
@@ -667,6 +656,32 @@ final class JITEnableContext {
         }
     }
 
+    func relaunchApp(_ bundleID: String, usingRemoteServer remoteServer: OpaquePointer, logger: LogFunc? = nil) -> Bool {
+        do {
+            let pid = try relaunchApp(bundleID, remoteServer: remoteServer)
+            emitLog("Returned to \(bundleID) (PID \(pid))", logger: logger)
+            return true
+        } catch {
+            emitLog("Failed to return to \(bundleID): \(error.localizedDescription)", logger: logger)
+            return false
+        }
+    }
+
+    private func relaunchApp(_ bundleID: String, remoteServer: OpaquePointer) throws -> UInt64 {
+        try withProcessControl(remoteServer: remoteServer) { processControl in
+            var pid: UInt64 = 0
+            let ffiError = bundleID.withCString { bundleID in
+                process_control_launch_app(processControl, bundleID, nil, 0, nil, 0, false, false, &pid)
+            }
+
+            if let ffiError {
+                throw error(from: ffiError, fallback: "Failed to return to app")
+            }
+
+            return pid
+        }
+    }
+
     func startSyslogRelay(handler: @escaping SyslogLineHandler, onError: @escaping SyslogErrorHandler) {
         do {
             try ensureTunnel()
```

**File**: `StikDebug/JSSupport/RunJSView.swift` (modified, +6/-1)
```diff
@@ -132,7 +132,12 @@ final class RunJSViewModel: ObservableObject, Identifiable, @unchecked Sendable
         resumeLock.unlock()
 
         appendLog("Returning to \(resumeBundleID)...")
-        let success = JITEnableContext.shared.relaunchApp(resumeBundleID)
+        let success: Bool
+        if let remoteServer {
+            success = JITEnableContext.shared.relaunchApp(resumeBundleID, usingRemoteServer: remoteServer)
+        } else {
+            success = JITEnableContext.shared.relaunchApp(resumeBundleID)
+        }
         guard success else {
             appendLog("Failed to return to \(resumeBundleID) — continuing in the foreground.")
             return "failed to return to \(resumeBundleID)"
```

---

### Incident Patch 15: `c1189928` (2026-07-26)
**Commit Message**: Fix JIT race on cold URL-scheme launch

**File**: `StikDebug/App/StikDebugApp.swift` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ struct StikDebugApp: App {
     private func downloadMissingDeveloperDiskImageFiles() async {
         do {
             try await DeveloperDiskImageService.shared.downloadMissingFiles()
+            MountingProgress.shared.pubMount()
         } catch {
             await MainActor.run {
                 showAlert(
```

**File**: `StikDebug/Views/HomeView.swift` (modified, +23/-2)
```diff
@@ -308,8 +308,18 @@ struct HomeView: View {
             let keepAliveLease = DebugKeepAliveLease()
             defer { keepAliveLease.invalidate() }
 
-            if triggeredByURLScheme {
-                sleep(1)
+            if triggeredByURLScheme, !waitForJITPrerequisites() {
+                DispatchQueue.main.async {
+                    withAnimation {
+                        debugFeedback = nil
+                    }
+                    showAlert(
+                        title: "Failed to Enable JIT".localized,
+                        message: "The device connection or Developer Disk Image wasn't ready in time. Open StikDebug directly, wait for it to finish connecting, then try again.".localized,
+                        showOk: true
+                    )
+                }
+                return
             }
 
             let finishProcessing: (Bool, String?) -> Void = { success, detail in
@@ -384,6 +394,17 @@ struct HomeView: View {
         }
     }
 
+    private func waitForJITPrerequisites(timeout: TimeInterval = 20) -> Bool {
+        let deadline = Date().addingTimeInterval(timeout)
+        while Date() < deadline {
+            if TunnelManager.shared.isConnected && MountingProgress.shared.coolisMounted {
+                return true
+            }
+            usleep(250_000)
+        }
+        return TunnelManager.shared.isConnected && MountingProgress.shared.coolisMounted
+    }
+
     private func base64URLToBase64(_ base64url: String) -> String {
         var base64 = base64url.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
         let pad = 4 - (base64.count % 4)
```

#### Recent Merged Pull Requests:
- **PR #468** (closed): fix(ddi): mount generic Cryptex developer images on iOS 27 (@zeuzmakessoftware)
- **PR #462** (closed): Fix location simulation offset in mainland China (GCJ-02 → WGS-84) (@starsdaisuki)
- **PR #460** (2026-09-09): Add Malloc Debugging (@Leviidev)
- **PR #457** (closed): Cellular fix (@OpenUmar)
- **PR #456** (closed): Disable silent audio keep-alive (@autosequence-music)
- **PR #452** (closed): Codex/embedded tunnel (@zy860)
- **PR #451** (closed): Add PocketJ Launcher to universal script assignments (@EricoEC)
- **PR #444** (closed): feat(location): add China coordinate correction for location simulation (@derekjkyang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
