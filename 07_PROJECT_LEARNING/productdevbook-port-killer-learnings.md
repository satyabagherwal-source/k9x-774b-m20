# Forensic Learning Record (Deep Inspection): productdevbook/port-killer

> **Canonical Artifact**: `07_PROJECT_LEARNING/productdevbook-port-killer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/productdevbook/port-killer](https://github.com/productdevbook/port-killer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:56:52.063Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `productdevbook/port-killer`
- **Description**: A powerful cross-platform port management tool for developers. Monitor ports, manage Kubernetes port forwards, integrate Cloudflare Tunnels, and kill processes with one click.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5099 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `platforms/macos/Sources/AppState+AutoRefresh.swift`
```
import Foundation
import Defaults

extension AppState {
    /// Stops the auto-refresh task.
    func stopAutoRefresh() {
        refreshTask?.cancel()
        refreshTask = nil
    }

    /// Starts a background task that periodically refreshes the port list.
    func startAutoRefresh() {
        stopAutoRefresh()
        refreshTask = Task { @MainActor [weak self] in
            guard let self else { return }
            var unchangedCycles = 0
            _ = await self.refresh()
            while !Task.isCancelled {
                let baseInterval = max(1, Defaults[.refreshInterval])
                let delaySeconds = self.adaptiveRefreshDelay(baseInterval: baseInterval, unchangedCycles: unchangedCycles)
                try? await Task.sleep(for: .seconds(delaySeconds))
                guard !Task.isCancelled else { break }

                let didChange = await self.refresh()
                unchangedCycles = didChange ? 0 : min(unchangedCycles + 1, 60)
            }
        }
    }

    /// Dynamically backs off polling when the port list stays stable.
    private func adaptiveRefreshDelay(baseInterval: Int, unchangedCycles: Int) -> Double {
        let base = Double(baseInterval)
        let multiplier: Double

        switch unchangedCycles {
        case 0..<6:
            multiplier = 1.0
        case 6..<12:
            multiplier = 1.5
        default:
            multiplier = 2.0
        }

        return min(base * multiplier, 30.0)
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+Favorites.swift`
```
import Foundation

extension AppState {
    /// Toggles favorite status for a port (delegates to FavoritesState)
    func toggleFavorite(_ port: Int) {
        favoritesState.toggle(port)
    }

    /// Checks if a port is marked as favorite (delegates to FavoritesState)
    func isFavorite(_ port: Int) -> Bool {
        favoritesState.isFavorite(port)
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+KeyboardShortcuts.swift`
```
import Foundation
import AppKit
import KeyboardShortcuts

extension AppState {
    /// Sets up global keyboard shortcuts.
    func setupKeyboardShortcuts() {
        KeyboardShortcuts.onKeyUp(for: .toggleMainWindow) { [weak self] in
            // KeyboardShortcuts callbacks run on the main thread, so we can use assumeIsolated
            // This avoids creating a detached Task that outlives the callback context
            MainActor.assumeIsolated {
                self?.toggleMainWindow()
            }
        }
    }

    /// Toggles the main window visibility.
    func toggleMainWindow() {
        if let window = NSApp.windows.first(where: { $0.title == "PortKiller" || $0.identifier?.rawValue == "main" }) {
            if window.isVisible {
                window.orderOut(nil)
            } else {
                NSApp.setActivationPolicy(.regular)
                NSApp.activate(ignoringOtherApps: true)
                window.makeKeyAndOrderFront(nil)
                window.orderFrontRegardless()
            }
        } else {
            NSApp.setActivationPolicy(.regular)
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+PortLabels.swift`
```
import Foundation
import Defaults

extension AppState {
    /// Returns the custom label for a port, if any
    func portLabel(for port: Int) -> String? {
        let label = Defaults[.portLabels][String(port)]
        return (label?.isEmpty ?? true) ? nil : label
    }

    /// Sets a custom label for a port
    func setPortLabel(_ label: String, for port: Int) {
        if label.isEmpty {
            Defaults[.portLabels].removeValue(forKey: String(port))
        } else {
            Defaults[.portLabels][String(port)] = label
        }
    }

    /// Removes the custom label for a port
    func removePortLabel(for port: Int) {
        Defaults[.portLabels].removeValue(forKey: String(port))
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+PortNotes.swift`
```
import Foundation
import Defaults

extension AppState {
    /// Returns the freeform note for a port, if any
    func portNote(for port: Int) -> String? {
        let note = Defaults[.portNotes][String(port)]
        return (note?.isEmpty ?? true) ? nil : note
    }

    /// Sets a freeform note for a port (empty string clears it)
    func setPortNote(_ note: String, for port: Int) {
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            Defaults[.portNotes].removeValue(forKey: String(port))
        } else {
            Defaults[.portNotes][String(port)] = trimmed
        }
    }

    /// Removes the note for a port
    func removePortNote(for port: Int) {
        Defaults[.portNotes].removeValue(forKey: String(port))
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+PortOperations.swift`
```
import Foundation

extension AppState {
    /// Refreshes the port list by scanning for active ports.
    @discardableResult
    func refresh() async -> Bool {
        if isScanning {
            hasPendingRefreshRequest = true
            return false
        }

        var didChangeAny = false

        repeat {
            hasPendingRefreshRequest = false
            isScanning = true

            let scanned = await scanner.scanPorts()
            let previousPorts = ports
            let didChange = updatePorts(scanned)
            didChangeAny = didChangeAny || didChange

            // Check process type notifications for newly appeared ports
            if didChange {
                checkProcessTypeNotifications(oldPorts: previousPorts, newPorts: scanned)
            }

            // Always update watcher state to keep transition baseline accurate.
            checkWatchedPorts()

            // Check auto-kill rules
            autoKillManager.check(ports: ports) { [weak self] port in
                Task { await self?.killPort(port) }
            }

            isScanning = false
        } while hasPendingRefreshRequest

        return didChangeAny
    }

    /// Updates the internal port list only if there are changes.
    @discardableResult
    func updatePorts(_ newPorts: [PortInfo]) -> Bool {
        let newSet = Set(newPorts.map { "\($0.port)-\($0.pid)" })
        let oldSet = Set(ports.map { "\($0.port)-\($0.pid)" })
        guard newSet != oldSet else { return false }

        ports = newPorts.sorted { a, b in
            let aFav = favorites.contains(a.port)
            let bFav = favorites.contains(b.port)
            if aFav != bFav { return aFav }
            return a.port < b.port
        }
        return true
    }

    /// Kills the process using the specified port.
    func killPort(_ port: PortInfo) async {
        if await scanner.killProcessGracefully(pid: port.pid) {
            ports.removeAll { $0.id == port.id }
            await refresh()
        }
    }

    /// Kills the listening process and all processes with ESTABLISHED connections to the port.
    func killPortDeep(_ port: PortInfo) async {
        // 1. Kill the listener
        _ = await scanner.killProcessGracefully(pid: port.pid)

        // 2. Find and kill ESTABLISHED connections
        let establishedPids = await scanner.findEstablishedPids(for: port.port)
        for pid in establishedPids where pid != port.pid {
            _ = await scanner.killProcessGracefully(pid: pid)
        }

        ports.removeAll { $0.id == port.id }
        await refresh()
    }

    /// Kills all processes currently using ports.
    func killAll() async {
        for port in ports {
            _ = await scanner.killProcessGracefully(pid: port.pid)
        }
        ports.removeAll()
        await refresh()
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+ProcessTypeNotifications.swift`
```
import Foundation
import Defaults

extension AppState {
    /// Checks for new ports matching enabled process type notifications.
    /// Call after each scan to detect newly appeared ports.
    func checkProcessTypeNotifications(oldPorts: [PortInfo], newPorts: [PortInfo]) {
        let enabledTypes = Defaults[.notifyProcessTypes]
        guard !enabledTypes.isEmpty else { return }

        let oldPortPids = Set(oldPorts.map { "\($0.port)-\($0.pid)" })

        for port in newPorts {
            let key = "\(port.port)-\(port.pid)"
            guard !oldPortPids.contains(key) else { continue }
            guard enabledTypes.contains(port.processType.rawValue) else { continue }

            NotificationService.shared.notify(
                title: "New \(port.processType.rawValue) on Port \(port.port)",
                body: "\(port.processName) started listening."
            )
        }
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+ProcessTypeOverrides.swift`
```
import Foundation
import Defaults

extension AppState {
    /// Sets a process type override for a given process name
    func setProcessTypeOverride(processName: String, type: ProcessType) {
        Defaults[.processTypeOverrides][processName] = type.rawValue
    }

    /// Clears the process type override for a given process name
    func clearProcessTypeOverride(processName: String) {
        Defaults[.processTypeOverrides].removeValue(forKey: processName)
    }

    /// Returns the overridden process type for a process name, if any
    func processTypeOverride(for processName: String) -> ProcessType? {
        guard let rawValue = Defaults[.processTypeOverrides][processName] else { return nil }
        return ProcessType(rawValue: rawValue)
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState+WatchedPorts.swift`
```
import Foundation

extension AppState {
    /// Toggles watch status for a port (delegates to WatchedPortsState)
    func toggleWatch(_ port: Int) {
        watchedPortsState.toggle(port)
    }

    /// Checks if a port is being watched (delegates to WatchedPortsState)
    func isWatching(_ port: Int) -> Bool {
        watchedPortsState.isWatching(port)
    }

    /// Updates notification preferences for a watched port (delegates to WatchedPortsState)
    func updateWatch(_ port: Int, onStart: Bool, onStop: Bool) {
        watchedPortsState.updateWatch(port, onStart: onStart, onStop: onStop)
    }

    /// Removes a watched port by its ID (delegates to WatchedPortsState)
    func removeWatch(_ id: UUID) {
        watchedPortsState.removeWatch(id)
    }

    /// Checks watched ports for state changes and triggers notifications
    func checkWatchedPorts() {
        watchedPortsState.checkForChanges(ports: ports)
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/AppState.swift`
```
import Foundation
import SwiftUI
import Defaults
import KeyboardShortcuts
import Sparkle

// MARK: - Defaults Keys

extension Defaults.Keys {
    static let favorites = Key<Set<Int>>("favorites", default: [])
    static let watchedPorts = Key<[WatchedPort]>("watchedPorts", default: [])
    static let useTreeView = Key<Bool>("useTreeView", default: false)
    static let hideSystemProcesses = Key<Bool>("hideSystemProcesses", default: false)
    static let skipKillConfirmation = Key<Bool>("skipKillConfirmation", default: false)
    static let refreshInterval = Key<Int>("refreshInterval", default: 5)
    static let cloudflaredProtocol = Key<CloudflaredProtocol>("cloudflaredProtocol", default: .http2)

    // Process type overrides (processName → ProcessType.rawValue)
    static let processTypeOverrides = Key<[String: String]>("processTypeOverrides", default: [:])

    // Port labels (port number string → custom name)
    static let portLabels = Key<[String: String]>("portLabels", default: [:])

    // Port notes (port number string → freeform note)
    static let portNotes = Key<[String: String]>("portNotes", default: [:])

    // Process type notification filters (rawValues of enabled types, empty = disabled)
    static let notifyProcessTypes = Key<Set<String>>("notifyProcessTypes", default: [])

    // Auto-kill rules
    static let autoKillRules = Key<[AutoKillRule]>("autoKillRules", default: [])

    // Kubernetes-related keys
    static let customNamespaces = Key<[String]>("customNamespaces", default: [])

    // Onboarding
    static let hasCompletedOnboarding = Key<Bool>("hasCompletedOnboarding", default: false)

    // Sponsor-related keys
    static let sponsorCache = Key<SponsorCache?>("sponsorCache", default: nil)
    static let lastSponsorWindowShown = Key<Date?>("lastSponsorWindowShown", default: nil)
    static let sponsorDisplayInterval = Key<SponsorDisplayInterval>("sponsorDisplayInterval", default: .bimonthly)
}

// MARK: - Keyboard Shortcuts

extension KeyboardShortcuts.Name {
    static let toggleMainWindow = Self("toggleMainWindow")
}

// MARK: - App State

/// AppState manages the core application state including ports, favorites,
/// watched ports, filters, keyboard shortcuts, and auto-refresh functionality.
@Observable
@MainActor
final class AppState {
    // MARK: - Decomposed State Objects

    /// Manages favorite ports (extracted state)
    let favoritesState: FavoritesState

    /// Manages watched ports (extracted state)
    let watchedPortsState: WatchedPortsState

    // MARK: - Port State

    /// All currently scanned ports
    var ports: [PortInfo] = []

    /// Whether a port scan is currently in progress
    var isScanning = false

    // MARK: - Filter State

    /// Current filter settings for the port list
    var filter = PortFilter()

    /// Currently selected sidebar item (affects which ports are shown)
    var selectedSidebarItem: SidebarItem = .allPorts

    /// ID of the currently selected port in the detail view
    var selectedPortID: String? = nil

    /// The currently selected port, if any
    var selectedPort: PortInfo? {
        guard let id = selectedPortID else { return nil }
        return ports.first { $0.id == id }
    }

    /// ID of the currently selected port-forward connection
    var selectedPortForwardConnectionId: UUID? = nil

    /// Tunnel UUID of the currently selected named tunnel (for the right-pane detail view).
    var selectedNamedTunnelID: String? = nil

    /// The currently selected named tunnel, if any.
    var selectedNamedTunnel: NamedCloudflareTunnel? {
        guard let id = selectedNamedTunnelID else { return nil }
        return namedTunnelManager.tunnels.first { $0.tunnelID == id }
    }

    /// The currently selected port-forward connection, if any
    var selectedPortForwardConnection: PortForwardConnectionState? {
        guard let id = selectedPortForwardConnectionId else { return nil }
        return portForwardManager.connections.first { $0.id == id }
    }

    // MARK: - Cached Filtered Ports (Memory Optimization)

    /// Cache for filtered ports to avoid repeated allocations
    @ObservationIgnored private var _cachedFilteredPorts: [PortInfo] = []
    @ObservationIgnored private var _filterCacheKey: FilterCacheKey?

    /// Cache key to detect when recalculation is needed
    private struct FilterCacheKey: Equatable {
        let portsCount: Int
        let portsHash: Int
        let sidebarItem: SidebarItem
        let filterActive: Bool
        let filterText: String
        let hideSystem: Bool
        let favoritesCount: Int
        let watchedCount: Int
    }

    /// Returns filtered ports based on sidebar selection and active filters.
    /// Uses caching to avoid repeated array allocations on each access.
    var filteredPorts: [PortInfo] {
        let currentKey = FilterCacheKey(
            portsCount: ports.count,
            portsHash: ports.isEmpty ? 0 : ports[0].hashValue ^ ports.count,
            sidebarItem: selectedSidebarItem,
            filterActive: filter.isActive,
            filterText: filter.searchText,
            hideSystem: Defaults[.hideSystemProcesses],
            favoritesCount: favorites.count,
            watchedCount: watchedPorts.count
        )

        // Return cached value if nothing changed
        if currentKey == _filterCacheKey {
            return _cachedFilteredPorts
        }

        // Recompute and cache
        _cachedFilteredPorts = computeFilteredPorts()
        _filterCacheKey = currentKey
        return _cachedFilteredPorts
    }

    /// Computes filtered ports (called only when cache is invalidated)
    private func computeFilteredPorts() -> [PortInfo] {
        if case .settings = selectedSidebarItem { return [] }

        var result: [PortInfo]

        switch selectedSidebarItem {
        case .allPorts, .settings, .sponsors, .kubernetesPortForward, .cloudflareTunnels:
            result = ports
        case .favorites:
            var activePorts = Set<Int>()
            result = ports.compactMap { port -> PortInfo? in
                guard favorites.contains(port.port) else { return nil }
                activePorts.insert(port.port)
                return port
            }
            for favPort in favorites where !activePorts.contains(favPort) {
                result.append(PortInfo.inactive(port: favPort))
            }
        case .watched:
            let watchedPortNumbers = Set(watchedPorts.map { $0.port })
            var activePorts = Set<Int>()
            result = ports.compactMap { port -> PortInfo? in
                guard watchedPortNumbers.contains(port.port) else { return nil }
                activePorts.insert(port.port)
                return port
            }
            for watchedPort in watchedPortNumbers where !activePorts.contains(watchedPort) {
                result.append(PortInfo.inactive(port: watchedPort))
            }
        case .processType(let type):
            result = ports.filter { $0.processType == type }
        }

        if filter.isActive {
            result = result.filter { filter.matches($0, favorites: favorites, watched: watchedPorts) }
        }

        if Defaults[.hideSystemProcesses] {
            result = result.filter { $0.processType != .system }
        }

        return result
    }

    // MARK: - Backward Compatibility Accessors

    /// Port numbers marked as favorites by the user (delegates to FavoritesState)
    var favorites: Set<Int> {
        get { favoritesState.favorites }
        set { favoritesState.favorites = newValue }
    }

    /// Ports being watched for state changes (delegates to WatchedPortsState)
    var watchedPorts: [WatchedPort] {
        get { watchedPortsState.watchedPorts }
        set { watchedPortsState.watchedPorts = newValue }
    }

    /// Tracks previous port states for watch notifications (delegates to WatchedPortsState)
    var previousPortStates: [Int: Bool] {
        get { watchedPortsState.previousPortStates }
        set { watchedPortsState.previousPortStates = newValue }
    }

    // MARK: - Managers

    /// Manages Sparkle auto-update functionality
    let updateManager = UpdateManager()

    /// Manages Kubernetes port-forward connections
    let portForwardManager = PortForwardManager()

    /// Manages Cloudflare Quick Tunnel connections (ephemeral `*.trycloudflare.com`)
    let tunnelManager: TunnelManager

    /// Manages persistent (named) Cloudflare tunnels discovered from `~/.cloudflared/`
    let namedTunnelManager: NamedTunnelManager

    /// Evaluates auto-kill rules against the scanned ports
    let autoKillManager = AutoKillManager()

    // MARK: - Internal Properties (for extensions)

    /// Port scanning actor
    let scanner: PortScannerProtocol

    /// Background task for auto-refresh
    @ObservationIgnored var refreshTask: Task<Void, Never>?
    /// Coalesces concurrent refresh requests into a single follow-up scan.
    @ObservationIgnored var hasPendingRefreshRequest = false

    // MARK: - Initialization

    init(
        scanner: PortScannerProtocol = PortScanner(),
        favoritesState: FavoritesState? = nil,
        watchedPortsState: WatchedPortsState? = nil
    ) {
        self.scanner = scanner
        self.favoritesState = favoritesState ?? FavoritesState()
        self.watchedPortsState = watchedPortsState ?? WatchedPortsState()

        let cloudflared = CloudflaredService()
        self.tunnelManager = TunnelManager(cloudflaredService: cloudflared)
        self.namedTunnelManager = NamedTunnelManager(cloudflaredService: cloudflared)

        setupKeyboardShortcuts()
        startAutoRefresh()
    }

    deinit {
        refreshTask?.cancel()
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/Managers/TunnelState.swift`
```
/**
 * TunnelState.swift
 * PortKiller
 *
 * Pure UI state for Cloudflare tunnels.
 * Extracted from TunnelManager for separation of concerns.
 */

import Foundation

/// Observable state for Cloudflare tunnels
@Observable
@MainActor
final class TunnelState {
    /// Active tunnel states
    var tunnels: [CloudflareTunnelState] = []

    /// Cached installation status
    private(set) var isCloudflaredInstalled: Bool = false

    /// Number of currently active tunnels
    var activeTunnelCount: Int {
        tunnels.filter { $0.status == .active }.count
    }

    /// Update installation status
    func setInstalled(_ installed: Bool) {
        isCloudflaredInstalled = installed
    }

    /// Add a new tunnel state
    func addTunnel(_ tunnel: CloudflareTunnelState) {
        tunnels.append(tunnel)
    }

    /// Remove tunnel by ID
    func removeTunnel(id: UUID) {
        tunnels.removeAll { $0.id == id }
    }

    /// Remove all tunnels
    func removeAllTunnels() {
        tunnels.removeAll()
    }

    /// Get tunnel for a specific port
    func tunnel(for port: Int) -> CloudflareTunnelState? {
        tunnels.first { $0.port == port }
    }

    /// Check if port has a non-error tunnel
    func hasTunnel(for port: Int) -> Bool {
        tunnels.contains { $0.port == port && $0.status != .error }
    }
}

```

### Core Architecture Module: `platforms/macos/Sources/State/FavoritesState.swift`
```
/**
 * FavoritesState.swift
 * PortKiller
 *
 * Manages favorite ports state with persistence.
 * Extracted from AppState for single responsibility.
 */

import Foundation

/// Manages favorite ports
@Observable
@MainActor
final class FavoritesState {
    /// Storage backend for persistence
    private let storage: FavoritesStorageProtocol

    /// Cached favorites, synced with storage on change
    private var _favorites: Set<Int> {
        didSet {
            storage.save(_favorites)
        }
    }

    /// Port numbers marked as favorites
    var favorites: Set<Int> {
        get { _favorites }
        set { _favorites = newValue }
    }

    /// Initialize with storage backend
    /// - Parameter storage: Storage implementation (defaults to UserDefaults)
    init(storage: FavoritesStorageProtocol = DefaultsFavoritesStorage()) {
        self.storage = storage
        self._favorites = storage.load()
    }

    /// Toggles favorite status for a port
    /// - Parameter port: Port number to toggle
    func toggle(_ port: Int) {
        if _favorites.contains(port) {
            _favorites.remove(port)
        } else {
            _favorites.insert(port)
        }
    }

    /// Checks if a port is marked as favorite
    /// - Parameter port: Port number to check
    /// - Returns: True if the port is a favorite
    func isFavorite(_ port: Int) -> Bool {
        _favorites.contains(port)
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #94** (2026-03-09): **Process names with non-ASCII characters (e.g., Chinese) are displayed as raw hex bytes (UTF-8 escape sequences)**
  *Symptoms*: Description:  When a process has a Chinese name (or a path containing Chinese characters), PortKiller displays the process name as raw UTF-8 hex sequences (e.g., \xe4\xbc\x81\xe4\xb8\x9a\xe5\xbe\xae\xe4\xbf\xa1) instead of the actual characters.  Steps to Reproduce:  - Run an application with a Chinese name (e.g., WeCom / 企业微信).  - Open PortKiller and locate the process.  - Observe the process name in the list.  Expected Behavior:  The process name should be rendered correctly as "企业微信".  <img width="410" height="38" alt="Image" src="https://github.com/user-attachments/assets/d74cca90-58d6-4f93-b7fc-f312395813ca" />  <img width="1072" height="752" alt="Image" src="https://github.com/user-attachments/assets/9a6bc63f-7100-442d-837f-6dd2db10f581" />  Actual Behavior:  The name is shown as \xe4\xbc\x81\xe4\xb8\x9a\xe5\xbe\xae\xe4\xbf\xa1....  <img width="355" height="665" alt="Image" src="https://github.com/user-attachments/assets/cdd339f2-98da-4568-b561-8c116e504559" />  Environment:  OS: macOS Tahoe Beta 26.4 (25E5218f)
  **Post-Mortem & Fix Analysis**:
  > This issue might be similar to #86 :)
  > #86 I thought it was spam, but it wasn't. :D 
  > <img width="912" height="744" alt="Image" src="https://github.com/user-attachments/assets/e9a7fbad-1fd3-4910-bfe1-70d09b8160f5" />  Confirmed: #86 is actually the same process name ("企业微信") but rendered in different encoding lol

- **Issue #93** (2026-06-13): **Mac Dock icon - incorrect size**
  *Symptoms*: Hi,  Not really a big issue, but worth mentioning.  On macOS Sequoia 15.6.1, the size of the icon seems to be off in comparison with the other dock icons.  <img width="644" height="154" alt="Image" src="https://github.com/user-attachments/assets/89cdf49f-c75d-4141-9673-96dc3cb82c77" />  FYI: There is a reddit post the might be usefull: https://www.reddit.com/r/PWA/comments/rm2v38/macos_dock_icon_sizing/  I'm running PortKiller: <img width="792" height="598" alt="Image" src="https://github.com/user-attachments/assets/b89de60f-6422-4282-971a-ae5d245ad46b" />
  **Post-Mortem & Fix Analysis**:
  > Fixed in cacb9b9. The icon artwork filled the full 1024×1024 canvas with no transparent margin, so it rendered larger than other Dock icons. The SVG now wraps the artwork in a centered 824×824 content box (100px margin per side, matching the macOS app-icon grid), and the fallback `AppIcon.icns` was regenerated from it.  One caveat for verification: the primary icon path is the Xcode 26 `AppIcon.icon` (Icon Composer) package, which composes its own `plug.svg`/`cross.svg` layers and normally applies the standard margin itself; the regenerated `.icns` is the CI fallback. After the next release please confirm the Dock size looks right — if it still looks oversized, the `position.scale` of the layers inside `AppIcon.icon` would need a small reduction in Icon Composer.

- **Issue #87** (2026-03-09): **Killing a port leaves ESTABLISHED connections from other processes**
  *Symptoms*: ## Description  When killing a port (e.g., port 8080), PortKiller only terminates the process that has the port in `LISTEN` state, but leaves other processes with `ESTABLISHED` connections to that port still running.  ## Steps to Reproduce  1. Start a Node.js server on port 8080 2. Have other processes connect to it (e.g., Chrome DevTools, other Node processes) 3. Use PortKiller to kill port 8080 4. Run `lsof -i :8080`  ## Expected Behavior  The port should be completely free with no processes associated.  ## Actual Behavior  While the main listening process is killed and the port appears "free", running `lsof -i :8080` still shows other processes with ESTABLISHED connections:  ``` COMMAND     PID           USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME Google      942 gustavomarrero   40u  IPv6 0xc2c529762dc3b166      0t0  TCP localhost:56524->localhost:http-alt (ESTABLISHED) node      66490 gustavomarrero   25u  IPv6 0x6e8aaddeb86bbe7d      0t0  TCP localhost:56500->localhost:http-alt (ESTABLISHED) ```  These are client connections that were connected to the server. They remain in an orphaned state.  ## Suggested Solution  Add an option to also kill processes that have ESTABLISHED connections to the target port, not just the LISTEN process. This could be:  1. A setting/preference: "Also kill connected processes" 2. A confirmation dialog showing all affected processes before killing 3. A "Deep Kill" vs "Quick Kill" option  ## Environment  - macOS Sequoia - PortKiller

- **Issue #86** (2026-03-09): **The i18n app name didn't show currect**
  *Symptoms*: /Applications/M-dM-<M^AM-dM-8M^ZM-eM->M-.M-dM-?M-!.app/Contents/MacOS/M-dM-<M^AM-dM-8M^ZM-eM->M-.M-dM-?M-!

- **Issue #72** (2026-01-08): **brew broken new version**
  *Symptoms*: ``` brew install portkiller ✔︎ JSON API formula.jws.json                                                                                                                                         Downloaded   32.1MB/ 32.1MB ✔︎ JSON API cask.jws.json                                                                                                                                            Downloaded   15.3MB/ 15.3MB ==> Downloading https://github.com/productdevbook/port-killer/releases/download/v3.1.0/PortKiller-v3.1.0-arm64.dmg curl: (56) The requested URL returned error: 404  Error: Download failed on Cask 'portkiller' with message: Download failed: https://github.com/productdevbook/port-killer/releases/download/v3.1.0/PortKiller-v3.1.0-arm64.dmg ```
  **Post-Mortem & Fix Analysis**:
  > Would you try again? `brew install portkiller` 
  > I’m seeing the same issue on my setup. `brew install portkiller` also fails with the same download error:  ``` ❯ brew install portkiller ==> Fetching downloads for: productdevbook/tap/portkiller ✘ Cask portkiller (3.1.0) Error: Download failed on Cask 'portkiller' with message: Download failed: https://github.com/productdevbook/port-killer/releases/download/v3.1.0/PortKiller-v3.1.0-arm64.dmg ```
  > ``` brew cleanup brew cleanup --prune=all ```   They seem to be stuck in the cache. Could you do that and try again?

- **Issue #38** (2025-12-18): **`shift+command+p` is a bad keybind choice, conflicts with code editors**
  *Symptoms*: Hello,  I installed this after seeing on Twitter, and it's a useful tool for sure.  But after an update today, I noticed that the tool adds a keybind for <kbd>shift+command+p</kbd> to open, which is a terrible choice, honestly. Many apps like code editors and other use that to open a command picker. With Port-Killer opened, it makes it basically impossible to open that.
  **Post-Mortem & Fix Analysis**:
  > which used version ? 
  > You can change this in the settings.  <img width="1122" height="358" alt="Image" src="https://github.com/user-attachments/assets/3d4444a6-433c-4caa-8638-1d31ab71b26e" />
  > v2.5.6  Managed to clear the setting, and now I can properly use binding of other apps.  I still think this should not be the default. <kbd>shift+command+p</kbd> is simply too common. It conflicts with _so_ many apps...

- **Issue #36** (2025-12-17): **Opening settings crashes app**
  *Symptoms*: Crashreport <details><summary>Details</summary> <p>  ``` ------------------------------------- Translated Report (Full Report Below) ------------------------------------- Process:             PortKiller [63891] Path:                /Applications/PortKiller.app/Contents/MacOS/PortKiller Identifier:          com.portkiller.app Version:             2.5.0 (110) Code Type:           ARM-64 (Native) Role:                Foreground Parent Process:      launchd [1] Coalition:           com.portkiller.app [12148] User ID:             502  Date/Time:           2025-12-17 11:07:54.9430 -0500 Launch Time:         2025-12-17 11:07:48.5107 -0500 Hardware Model:      MacBookPro18,2 OS Version:          macOS 26.2 (25C56) Release Type:        User  Crash Reporter Key:  3BB12B61-5E0A-0F0F-EB6B-68CCE600280F Incident Identifier: 52F1482D-A4FA-4B47-950C-60C59E557F11  Sleep/Wake UUID:       F9E248E4-C162-411B-9453-6FC091666EF8  Time Awake Since Boot: 23000 seconds Time Since Wake:       3995 seconds  System Integrity Protection: enabled  Triggered by Thread: 0, Dispatch Queue: com.apple.main-thread  Exception Type:    EXC_BREAKPOINT (SIGTRAP) Exception Codes:   0x0000000000000001, 0x00000001ab2f19d4  Termination Reason:  Namespace SIGNAL, Code 5, Trace/BPT trap: 5 Terminating Process: exc handler [63891]   Thread 0 Crashed::  Dispatch queue: com.apple.main-thread 0   libswiftCore.dylib            	       0x1ab2f19d4 _assertionFailure(_:_:file:line:flags:) + 176 1   PortKiller                    	
  **Post-Mortem & Fix Analysis**:
  > Yes :( i see. My 8 attempts are almost entirely due to these shortcuts from the library; I just can't find them. There's no problem locally, but when published, the dmg gets corrupted.
  > Okay, I managed to run the error locally, let's see if I can fix it.
  > Same thing here for me. Here's the complete log:  <details><summary>Details</summary> <p>   ``` ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               PortKiller [44428] Path:                  /Applications/PortKiller.app/Contents/MacOS/PortKiller Identifier:            com.portkiller.app Version:               2.5.2 (116) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2025-12-17 13:59:22.7678 -0300 OS Version:            macOS 15.6.1 (24G90) Report Version:        12 Anonymous UUID:        57F7EF66-55C1-9064-2146-D7BE23BCF42D  Sleep/Wake UUID:       B4308EE0-94E7-4128-A8FD-BA328C03C118  Time Awake Since Boot: 290000 seconds Time Since Wake:       115 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:   

- **Issue #33** (2025-12-17): **Right panel resizing acting weird**
  *Symptoms*: I don't know what causes this and if this happens to anyone else, but the right side panel resizing is acting weird with me. Can't really resize it eassily  https://github.com/user-attachments/assets/e34fed10-668b-41fe-9e23-0eddbee7e0ac
  **Post-Mortem & Fix Analysis**:
  > I just can't get used to this SwiftUI coding. :D 

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

### Incident Patch 1: `fcfdb5a0` (2026-07-24)
**Commit Message**: feat(linux): native tray app, Rust core and AppImage releases (#112)

Adds Linux support: a GTK 3 system tray application, the Rust scanning
core, CI, and an AppImage published on each release.

Scope:
- portkiller-core carries only the Linux backends. The macOS and Windows
  implementations are omitted along with the Windows crate dependency —
  those platforms have native Swift and .NET apps that do not use this
  crate. portkiller-ffi is not included.
- platforms/linux/ is self-contained Python and does not depend on the
  Rust core today.

CI (.github/workflows/ci-linux.yml):
- cargo build/test/clippy/fmt on Ubuntu. The Linux code is cfg-gated, so
  it was never compiled by the existing macOS and Windows jobs.
- Python parser tests on 3.9 and 3.12, plus shellcheck on install.sh.
- A GTK import smoke test, since the parser tests never load the UI
  modules and would not catch a broken import there.

Release (build-linux job):
- Builds a self-contained AppImage and attaches it to the release.
- The GTK stack is taken from the host rather than bundled: PyGObject
  binds tightly to the system GLib/GTK and bundling it breaks on distros
  whose versions differ from the build image. T

**File**: `.github/workflows/ci-linux.yml` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+name: CI (Linux)
+
+on:
+  push:
+    branches: [main]
+    paths:
+      - 'platforms/linux/**'
+      - 'portkiller-core/**'
+      - '.github/workflows/ci-linux.yml'
+    tags-ignore:
+      - 'v*'
+  pull_request:
+    branches: [main]
+    paths:
+      - 'platforms/linux/**'
+      - 'portkiller-core/**'
+      - '.github/workflows/ci-linux.yml'
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: true
+
+jobs:
+  rust:
+    name: Rust Core (Linux)
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@v4
+
+      - name: Install Rust toolchain
+        uses: dtolnay/rust-toolchain@stable
+        with:
+          components: clippy, rustfmt
+
+      - name: Cache cargo
+        uses: actions/cache@v4
+        with:
+          path: |
+            ~/.cargo/registry
+            ~/.cargo/git
+            portkiller-core/target
+          key: ${{ runner.os }}-cargo-${{ hashFiles('portkiller-core/Cargo.toml') }}
+          restore-keys: |
+            ${{ runner.os }}-cargo-
+
+      - name: Install scan tools
+        # The scanner shells out to these; without them the integration
+        # tests fail rather than exercising the real code paths.
+        run: sudo apt-get update -qq && sudo apt-get install -y -qq procps iproute2 lsof
+
+      - name: Build
+        working-directory: portkiller-core
+        run: cargo build --verbose
+
+      - name: Test
+        working-directory: portkiller-core
+        run: cargo test --verbose
+
+      - name: Clippy
+        working-directory: portkiller-core
+        run: cargo clippy -- -D warnings
+
+      - name: Format check
+        working-directory: portkiller-core
+        run: cargo fmt --check
+
+  python:
+    name: Linux Tray App
+    runs-on: ubuntu-latest
+
+    strategy:
+      fail-fast: false
+      matrix:
+        python-version: ['3.9', '3.12']
+
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@v4
+
+      - name: Set up Python ${{ matrix.python-version }}
+        uses: actions/setup-python@v5
+        with:
+          python-version: ${{ matrix.python-version }}
+
+      - name: Syntax check
+        run: python3 -m compileall -q platforms/linux/src platforms/linux/port-killer.py
+
+      - name: Run parser tests
+        # These cover pure string parsing only, so no GTK stack is needed.
+        run: python3 -m unittest discover -s platforms/linux/tests -v
+
+      - name: Validate installer
+        run: |
+          bash -n platforms/linux/install.sh
+          sudo apt-get update -qq && sudo apt-get install -y -qq shellcheck
+          shellcheck platforms/linux/install.sh
+
+  smoke:
+    name: Import Smoke Test
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@v4
+
+      - name: Install GTK stack
+        run: |
+          sudo apt-get update -qq
+          sudo apt-get install -y -qq \
+            python3-gi python3-gi-cairo gir1.2-gtk-3.0 \
+            gir1.2-ayatanaappindicator3-0.1 xvfb
+
+      - name: Import all modules
+        # Catches broken imports and syntax errors that the parser tests,
+        # which never touch the GTK modules, would miss.
+        run: |
+          cd platforms/linux
+          xvfb-run -a python3 -c "
+          import src.config, src.scanner
+          import src.services.clipboard, src.services.cloudflare, src.services.k8s
+          import src.ui.dialogs, src.ui.window, src.ui.tray
+          print('All modules import cleanly')
+          "
```

**File**: `.github/workflows/release.yml` (modified, +120/-0)
```diff
@@ -448,3 +448,123 @@ jobs:
           $version = "${{ env.RELEASE_VERSION }}"
           gh release upload $version "PortKiller-${version}-windows-x64.zip" --clobber
           gh release upload $version "PortKiller-${version}-windows-arm64.zip" --clobber
+
+  build-linux:
+    name: Build Linux
+    needs: create-release
+    # Skip for PR builds (macOS only)
+    if: ${{ always() && !inputs.is_pr_build && (needs.create-release.result == 'success' || needs.create-release.result == 'skipped') }}
+    runs-on: ubuntu-22.04
+
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@v4
+
+      - name: Install build dependencies
+        run: |
+          sudo apt-get update -qq
+          sudo apt-get install -y -qq \
+            python3 python3-gi python3-gi-cairo \
+            gir1.2-gtk-3.0 gir1.2-ayatanaappindicator3-0.1 \
+            librsvg2-bin desktop-file-utils file
+
+      - name: Build AppImage
+        run: |
+          VERSION="${{ env.RELEASE_VERSION }}"
+          VERSION="${VERSION#v}"
+          APPDIR=AppDir
+
+          # Lay out the AppDir
+          mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/share/port-killer"
+          mkdir -p "$APPDIR/usr/share/applications"
+          mkdir -p "$APPDIR/usr/share/icons/hicolor/scalable/apps"
+
+          cp -r platforms/linux/src "$APPDIR/usr/share/port-killer/"
+          cp platforms/linux/port-killer.py "$APPDIR/usr/share/port-killer/"
+          chmod +x "$APPDIR/usr/share/port-killer/port-killer.py"
+
+          # Icon: AppImage needs it at the AppDir root as well as in the theme
+          cp platforms/macos/Resources/AppIcon.svg "$APPDIR/usr/share/icons/hicolor/scalable/apps/port-killer.svg"
+          cp platforms/macos/Resources/AppIcon.svg "$APPDIR/port-killer.svg"
+          # Some desktop environments will not read an SVG-only AppImage icon
+          rsvg-convert -w 256 -h 256 platforms/macos/Resources/AppIcon.svg -o "$APPDIR/port-killer.png"
+
+          cat > "$APPDIR/usr/share/applications/port-killer.desktop" <<'DESKTOP'
+          [Desktop Entry]
+          Type=Application
+          Name=PortKiller
+          Comment=Monitor listening ports and terminate processes from system tray
+          Exec=port-killer
+          Icon=port-killer
+          Terminal=false
+          Categories=Development;
+          StartupNotify=false
+          StartupWMClass=port-killer
+          DESKTOP
+          cp "$APPDIR/usr/share/applications/port-killer.desktop" "$APPDIR/port-killer.desktop"
+          desktop-file-validate "$APPDIR/port-killer.desktop"
+
+          # Launcher. The GTK stack is taken from the host rather than bundled:
+          # PyGObject binds tightly to the system GLib/GTK, and bundling them
+          # breaks on distros whose versions differ from the build image.
+          cat > "$APPDIR/usr/bin/port-killer" <<'LAUNCH'
+          #!/bin/bash
+          HERE="$(dirname "$(readlink -f "${0}")")"
+          APPROOT="$(dirname "$(dirname "$HERE")")"
+
+          for dep in "gi:python3-gi" "gi.repository.Gtk:gir1.2-gtk-3.0"; do
+              mod="${dep%%:*}"
+              if ! python3 -c "import ${mod%%.*}" 2>/dev/null; then
+                  echo "PortKiller: missing ${dep##*:}." >&2
+                  echo "Install the GTK Python bindings, e.g.:" >&2
+                  echo "  Debian/Ubuntu: sudo apt install python3-gi gir1.2-ayatanaappindicator3-0.1" >&2
+                  echo "  Fedora:        sudo dnf install python3-gobject libayatana-appindicator-gtk3" >&2
+                  echo "  Arch:          sudo pacman -S python-gobject libayatana-appindicator" >&2
+                  exit 1
+              fi
+          done
+
+          exec python3 "$APPROOT/usr/share/port-killer/port-killer.py" "$@"
+          LAUNCH
+          chmod +x "$APPDIR/usr/bin/port-killer"
+
+          # AppRun -> launcher
+          ln -s usr/bin/port-killer "$APPDIR/AppRun"
+
+          # Package
+          curl -fsSL -o appimagetool \
+            "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
+          chmod +x appimagetool
+
+          ARCH=x86_64 ./appimagetool --appimage-extract-and-run \
+            "$APPDIR" "PortKiller-${{ env.RELEASE_VERSION }}-linux-x86_64.AppImage"
+
+      - name: Verify AppImage
+        run: |
+          FILE="PortKiller-${{ env.RELEASE_VERSION }}-linux-x86_64.AppImage"
+          [ -f "$FILE" ] || { echo "AppImage not produced"; exit 1; }
+          chmod +x "$FILE"
+          file "$FILE"
+
+          # Confirm the payload is actually in there
+          ./"$FILE" --appimage-extract >/dev/null
+          [ -f squashfs-root/usr/share/port-killer/port-killer.py ] || { echo "Missing entry point"; exit 1; }
+          [ -f squashfs-root/usr/share/port-killer/src/ui/tray.py ] || { echo "Missing src/"; exit 1; }
+          [ -x squashfs-root/AppRun ] || { echo "AppRun not executable"; exit 1; }
+          rm -rf squashfs-root
+          echo "AppI
```

**File**: `.gitignore` (modified, +9/-0)
```diff
@@ -64,3 +64,12 @@ bun.lockb
 
 # Rust
 **/target/
+
+# Python (Linux tray app)
+__pycache__/
+*.py[cod]
+
+# Linux packaging
+AppDir/
+*.AppImage
+appimagetool
```

**File**: `CONTRIBUTING.md` (modified, +76/-3)
```diff
@@ -2,9 +2,11 @@
 
 ## Requirements
 
-- **macOS 15.0+** / **Windows 10+**
+- **macOS 15.0+** / **Windows 10+** / **Linux**
 - **Xcode 16+** with Swift 6.0 (for macOS)
 - **.NET 9 SDK** (for Windows)
+- **Python 3.9+**, PyGObject (GTK 3) and libayatana-appindicator (for Linux)
+- **Rust stable** (for `portkiller-core`, used by the Linux app only)
 
 ## Setup
 
@@ -37,6 +39,32 @@ cd platforms/windows/PortKiller
 dotnet run
 ```
 
+### Linux
+
+A native system tray app built with Python, GTK 3 and AppIndicator.
+
+```bash
+# Run directly
+./platforms/linux/port-killer.py &
+
+# Or install it (registers a launcher and autostart on login)
+./platforms/linux/install.sh
+```
+
+Install the dependencies first — `install.sh` checks for them and stops with
+hints if any are missing:
+
+```bash
+# Debian/Ubuntu
+sudo apt install python3 python3-gi gir1.2-ayatanaappindicator3-0.1
+
+# Fedora
+sudo dnf install python3 python3-gobject libayatana-appindicator-gtk3
+
+# Arch
+sudo pacman -S python python-gobject libayatana-appindicator
+```
+
 ## Building
 
 ### macOS
@@ -56,6 +84,33 @@ dotnet build             # Debug
 dotnet publish -c Release -r win-x64  # Release
 ```
 
+### Linux
+
+The tray app is plain Python, so there is no build step. The Rust core is
+built separately:
+
+```bash
+cd portkiller-core
+cargo build              # Debug
+cargo build --release    # Release
+```
+
+Releases ship an AppImage, produced by the `build-linux` job in
+`.github/workflows/release.yml`.
+
+## Tests
+
+```bash
+# macOS
+cd platforms/macos && swift test
+
+# Linux tray app (parser tests, no GTK needed)
+python3 -m unittest discover -s platforms/linux/tests
+
+# Rust core (Linux only)
+cd portkiller-core && cargo test
+```
+
 ## Pull Requests
 
 1. Fork the repo
@@ -76,6 +131,11 @@ dotnet publish -c Release -r win-x64  # Release
 - C# with WPF
 - MVVM pattern
 
+### Linux
+- Python 3 with GTK 3 (PyGObject)
+- Scans run on a worker thread; UI updates go back through `GLib.idle_add`
+- Parsers are pure functions, kept testable without a GTK stack
+
 ## Project Structure
 
 ```
@@ -88,6 +148,19 @@ platforms/
 │   │   └── Views/                 # SwiftUI views
 │   ├── Resources/                 # Assets, Info.plist
 │   └── scripts/                   # Build scripts
-└── windows/
-    └── PortKiller/                # .NET WPF project
+├── windows/
+│   └── PortKiller/                # .NET WPF project
+└── linux/
+    ├── port-killer.py             # Entry point
+    ├── install.sh                 # Launcher + autostart installer
+    ├── src/
+    │   ├── scanner.py             # ss/lsof parsing, process killing
+    │   ├── config.py              # Persisted preferences
+    │   ├── services/              # Clipboard, Cloudflare, k8s
+    │   └── ui/                    # Tray, window, dialogs
+    └── tests/                     # Parser tests
+
+portkiller-core/                   # Rust core (Linux only)
+├── src/scanner/                   # Port scanning
+└── src/process/                   # Process termination
 ```
```

**File**: `platforms/linux/install.sh` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+#!/bin/bash
+set -e
+
+# Linux Installer for PortKiller Native Tray App
+SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
+INSTALL_DIR="$HOME/.local/share/port-killer"
+AUTOSTART_DIR="$HOME/.config/autostart"
+APPLICATIONS_DIR="$HOME/.local/share/applications"
+ICONS_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
+
+echo "Installing PortKiller for Linux..."
+
+# Verify runtime dependencies before installing anything
+missing=""
+
+if ! command -v python3 >/dev/null 2>&1; then
+    missing="$missing python3"
+fi
+
+if ! python3 -c "import gi; gi.require_version('Gtk', '3.0')" >/dev/null 2>&1; then
+    missing="$missing python3-gi/GTK3"
+fi
+
+if ! python3 -c "
+import gi
+try:
+    gi.require_version('AppIndicator3', '0.1')
+except ValueError:
+    gi.require_version('AyatanaAppIndicator3', '0.1')
+" >/dev/null 2>&1; then
+    missing="$missing libappindicator3/libayatana-appindicator3"
+fi
+
+if [ -n "$missing" ]; then
+    echo "Error: missing required dependencies:$missing" >&2
+    echo "" >&2
+    echo "Install them first, e.g.:" >&2
+    echo "  Debian/Ubuntu: sudo apt install python3 python3-gi gir1.2-ayatanaappindicator3-0.1" >&2
+    echo "  Fedora:        sudo dnf install python3 python3-gobject libayatana-appindicator-gtk3" >&2
+    echo "  Arch:          sudo pacman -S python python-gobject libayatana-appindicator" >&2
+    exit 1
+fi
+
+# Create install directories
+mkdir -p "$INSTALL_DIR"
+mkdir -p "$AUTOSTART_DIR"
+mkdir -p "$APPLICATIONS_DIR"
+
+# Copy python script and assets
+cp -r "$SCRIPT_DIR/src" "$INSTALL_DIR/"
+cp "$SCRIPT_DIR/port-killer.py" "$INSTALL_DIR/"
+chmod +x "$INSTALL_DIR/port-killer.py"
+
+# Install the app icon. Never create a placeholder here: get_icon_path() only
+# rejects a missing file, so an empty AppIcon.svg would be handed to
+# AppIndicator instead of falling back to the system icon.
+SOURCE_ICON="$SCRIPT_DIR/../macos/Resources/AppIcon.svg"
+ICON_NAME="port-killer"
+
+if [ -s "$SOURCE_ICON" ]; then
+    cp "$SOURCE_ICON" "$INSTALL_DIR/AppIcon.svg"
+
+    # Also register in the hicolor theme so the icon resolves by name
+    mkdir -p "$ICONS_DIR"
+    cp "$SOURCE_ICON" "$ICONS_DIR/$ICON_NAME.svg"
+    DESKTOP_ICON="$ICON_NAME"
+
+    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
+        gtk-update-icon-cache -q -t -f "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
+    fi
+else
+    echo "Warning: $SOURCE_ICON not found or empty; using a system fallback icon." >&2
+    rm -f "$INSTALL_DIR/AppIcon.svg"
+    DESKTOP_ICON="utilities-system-monitor"
+fi
+
+# Generate desktop file
+DESKTOP_FILE="$APPLICATIONS_DIR/port-killer.desktop"
+AUTOSTART_FILE="$AUTOSTART_DIR/port-killer.desktop"
+
+# Generate launcher desktop entry
+cat <<EOF > "$DESKTOP_FILE"
+[Desktop Entry]
+Type=Application
+Name=PortKiller
+Comment=Monitor listening ports and terminate processes from system tray
+Exec=$INSTALL_DIR/port-killer.py
+Icon=$DESKTOP_ICON
+Terminal=false
+Categories=Development;
+StartupNotify=false
+StartupWMClass=port-killer
+EOF
+
+# Copy desktop file to autostart so it starts on login
+cp "$DESKTOP_FILE" "$AUTOSTART_FILE"
+chmod +x "$DESKTOP_FILE"
+chmod +x "$AUTOSTART_FILE"
+
+echo "✓ PortKiller installed successfully!"
+echo "You can now find PortKiller in your application launcher, or start it immediately by running:"
+echo "  $INSTALL_DIR/port-killer.py &"
+echo ""
+echo "It will also start automatically every time you log in."
```

**File**: `platforms/linux/port-killer.py` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+#!/usr/bin/env python3
+import os
+import sys
+
+# Add the directory containing the 'src' package to sys.path
+script_dir = os.path.dirname(os.path.abspath(__file__))
+sys.path.insert(0, script_dir)
+
+from src.main import main
+
+if __name__ == '__main__':
+    main()
```

**File**: `platforms/linux/src/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+# PortKiller Linux Package
```

**File**: `platforms/linux/src/config.py` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+import os
+import json
+
+CONFIG_DIR = os.path.expanduser("~/.config/port-killer")
+CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")
+
+DEFAULT_CONFIG = {
+    "use_tree_view": True,
+    "hide_system_processes": True,
+    "favorites": []
+}
+
+class AppConfig:
+    def __init__(self):
+        self.data = DEFAULT_CONFIG.copy()
+        self.load()
+
+    def load(self):
+        if os.path.exists(CONFIG_FILE):
+            try:
+                with open(CONFIG_FILE, "r") as f:
+                    self.data.update(json.load(f))
+            except Exception as e:
+                print(f"Error loading config: {e}")
+
+    def save(self):
+        try:
+            os.makedirs(CONFIG_DIR, exist_ok=True)
+            with open(CONFIG_FILE, "w") as f:
+                json.dump(self.data, f, indent=4)
+        except Exception as e:
+            print(f"Error saving config: {e}")
+
+    @property
+    def use_tree_view(self):
+        return self.data.get("use_tree_view", True)
+
+    @use_tree_view.setter
+    def use_tree_view(self, val):
+        self.data["use_tree_view"] = bool(val)
+        self.save()
+
+    @property
+    def hide_system_processes(self):
+        return self.data.get("hide_system_processes", True)
+
+    @hide_system_processes.setter
+    def hide_system_processes(self, val):
+        self.data["hide_system_processes"] = bool(val)
+        self.save()
+
+    @property
+    def favorites(self):
+        return self.data.get("favorites", [])
+
+    def add_favorite(self, port):
+        if port not in self.data["favorites"]:
+            self.data["favorites"].append(port)
+            self.save()
+
+    def remove_favorite(self, port):
+        if port in self.data["favorites"]:
+            self.data["favorites"].remove(port)
+            self.save()
+
+    def is_favorite(self, port):
+        return port in self.data["favorites"]
+
+# Global config instance
+config = AppConfig()
+
+def get_icon_path():
+    import sys
+    src_dir = os.path.dirname(os.path.abspath(__file__)) # /path/to/src
+    parent_dir = os.path.dirname(src_dir) # /path/to
+    
+    candidates = [
+        os.path.join(parent_dir, "AppIcon.svg"),
+        os.path.join(src_dir, "AppIcon.svg"),
+        os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), "AppIcon.svg"),
+    ]
+    # Require a non-empty file: an empty AppIcon.svg (e.g. left by an older
+    # installer) would otherwise be passed to AppIndicator instead of letting
+    # the caller fall back to a system icon name.
+    for p in candidates:
+        if os.path.isfile(p) and os.path.getsize(p) > 0:
+            return p
+    return None
+
```

---

### Incident Patch 2: `38a3df2d` (2026-06-21)
**Commit Message**: fix: use latest homebrew syntax for depends on (#109)

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -377,7 +377,7 @@ jobs:
             desc "Menu bar app to find and kill processes running on open ports"
             homepage "https://github.com/productdevbook/port-killer"
 
-            depends_on macos: ">= :sequoia"
+            depends_on macos: :sequoia
 
             app "PortKiller.app"
 
```

---

### Incident Patch 3: `45df0779` (2026-06-13)
**Commit Message**: feat(design): add shared UI components on top of tokens

Five token-driven components under Views/Components/DesignSystem/ to replace
copy-pasted UI patterns:

- StatusDot      (18 inline Circle status dots)
- Badge          (8 inline capsule pills)
- Card           (6 inline RoundedRectangle+border containers)
- IconBadge      (5 inline icon-in-circle headers)
- AlertBanner    (generalizes the two warning banners)

Migrate DependencyWarningBanner onto AlertBanner as the first real usage.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `platforms/macos/Sources/Views/Components/DependencyWarningBanner.swift` (modified, +5/-22)
```diff
@@ -4,20 +4,11 @@ struct DependencyWarningBanner: View {
     @State private var isInstalling = false
 
     var body: some View {
-        HStack(spacing: 12) {
-            Image(systemName: "exclamationmark.triangle.fill")
-                .foregroundStyle(.orange)
-
-            VStack(alignment: .leading, spacing: 2) {
-                Text("Missing Dependencies")
-                    .font(.headline)
-                Text("kubectl is required for port forwarding")
-                    .font(.caption)
-                    .foregroundStyle(.secondary)
-            }
-
-            Spacer()
-
+        AlertBanner(
+            icon: "exclamationmark.triangle.fill",
+            title: "Missing Dependencies",
+            message: "kubectl is required for port forwarding"
+        ) {
             if isInstalling {
                 ProgressView()
                     .scaleEffect(0.8)
@@ -28,14 +19,6 @@ struct DependencyWarningBanner: View {
                 .buttonStyle(.bordered)
             }
         }
-        .padding(12)
-        .background(Color.orange.opacity(0.1))
-        .overlay(
-            Rectangle()
-                .fill(Color.orange)
-                .frame(height: 2),
-            alignment: .top
-        )
     }
 
     private func installDependencies() {
```

**File**: `platforms/macos/Sources/Views/Components/DesignSystem/AlertBanner.swift` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import SwiftUI
+
+/// A tinted inline banner with a leading icon, title/subtitle, a top accent bar, and a
+/// trailing action area. Generalizes DependencyWarningBanner and CloudflaredMissingBanner.
+struct AlertBanner<Trailing: View>: View {
+    let icon: String
+    let title: String
+    let message: String
+    var tint: Color = Theme.Colors.statusWarning
+    @ViewBuilder var trailing: Trailing
+
+    var body: some View {
+        HStack(spacing: Spacing.lg) {
+            Image(systemName: icon)
+                .foregroundStyle(tint)
+
+            VStack(alignment: .leading, spacing: Spacing.xxs) {
+                Text(title)
+                    .textStyle(.sectionTitle)
+                Text(message)
+                    .textStyle(.rowSubtitle)
+                    .foregroundStyle(.secondary)
+            }
+
+            Spacer()
+
+            trailing
+        }
+        .padding(Spacing.lg)
+        .background(tint.opacity(0.1))
+        .overlay(
+            Rectangle()
+                .fill(tint)
+                .frame(height: 2),
+            alignment: .top
+        )
+    }
+}
+
+extension AlertBanner where Trailing == EmptyView {
+    init(icon: String, title: String, message: String, tint: Color = Theme.Colors.statusWarning) {
+        self.init(icon: icon, title: title, message: message, tint: tint) { EmptyView() }
+    }
+}
```

**File**: `platforms/macos/Sources/Views/Components/DesignSystem/Badge.swift` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import SwiftUI
+
+/// A colored capsule label. Consolidates the repeated
+/// `Text(...).padding(...).background(color.opacity(0.15)).clipShape(Capsule())` pattern.
+struct Badge: View {
+    let text: String
+    let color: Color
+    var font: Font = TextRole.badge.font
+
+    var body: some View {
+        Text(text)
+            .font(font)
+            .padding(.horizontal, Spacing.sm)
+            .padding(.vertical, Spacing.xxs)
+            .background(color.opacity(0.15))
+            .foregroundStyle(color)
+            .clipShape(Capsule())
+    }
+}
```

**File**: `platforms/macos/Sources/Views/Components/DesignSystem/Card.swift` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import SwiftUI
+
+/// A rounded container with a fill and a hairline border. Consolidates the repeated
+/// `RoundedRectangle(cornerRadius:).fill(...)` + `.strokeBorder(...)` card pattern.
+struct Card<Content: View>: View {
+    var background: Color = Theme.Colors.surfaceCard
+    var border: Color = Theme.Colors.border
+    var cornerRadius: CGFloat = Radius.md
+    var padding: CGFloat = Spacing.lg
+    @ViewBuilder var content: Content
+
+    var body: some View {
+        content
+            .padding(padding)
+            .background(
+                RoundedRectangle(cornerRadius: cornerRadius)
+                    .fill(background)
+            )
+            .overlay(
+                RoundedRectangle(cornerRadius: cornerRadius)
+                    .strokeBorder(border, lineWidth: 0.5)
+            )
+    }
+}
```

**File**: `platforms/macos/Sources/Views/Components/DesignSystem/IconBadge.swift` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import SwiftUI
+
+/// An SF Symbol inside a tinted circle, used as a header glyph. Consolidates the
+/// `ZStack { Circle().fill(color.opacity(0.2)); Image(systemName:).foregroundStyle(color) }`
+/// pattern in detail panels and section headers.
+struct IconBadge: View {
+    let systemName: String
+    let color: Color
+    var size: CGFloat = Sizing.iconBadge
+
+    var body: some View {
+        ZStack {
+            Circle()
+                .fill(color.opacity(0.2))
+                .frame(width: size, height: size)
+            Image(systemName: systemName)
+                .font(.system(size: size * 0.4))
+                .foregroundStyle(color)
+        }
+    }
+}
```

**File**: `platforms/macos/Sources/Views/Components/DesignSystem/StatusDot.swift` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import SwiftUI
+
+/// A small filled circle used as a status indicator. Replaces the many inline
+/// `Circle().fill(...).frame(width:height:).shadow(...)` copies across rows.
+struct StatusDot: View {
+    let color: Color
+    var size: CGFloat = Sizing.statusDot
+    /// When true, adds a soft glow in the dot's color (used for "active" states).
+    var glow: Bool = false
+
+    var body: some View {
+        Circle()
+            .fill(color)
+            .frame(width: size, height: size)
+            .shadow(color: glow ? color.opacity(0.5) : .clear, radius: 3)
+    }
+}
```

---

### Incident Patch 4: `cacb9b9f` (2026-06-13)
**Commit Message**: fix: add standard transparent margin to app icon (#93, #19)

The icon artwork filled the entire 1024x1024 canvas with no padding, so it
rendered noticeably larger than neighbouring icons in the Dock. Wrap the
artwork in an 824x824 content box centered with a 100px margin on every side,
matching the macOS app-icon grid, and regenerate the fallback AppIcon.icns
from the corrected SVG (rsvg-convert + iconutil).

Closes #93
Closes #19

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `platforms/macos/Resources/AppIcon.svg` (modified, +25/-19)
```diff
@@ -11,29 +11,35 @@
     </linearGradient>
   </defs>
 
-  <!-- Background -->
-  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
+  <!-- All artwork lives inside an 824x824 content box centered in the 1024 canvas
+       (100px transparent margin on every side), matching the macOS app-icon grid.
+       Without this margin the icon renders larger than its neighbors in the Dock
+       (issues #93, #19). -->
+  <g transform="translate(100, 100) scale(0.8046875)">
+    <!-- Background -->
+    <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
 
-  <!-- Plug body - scaled 1.6x and centered -->
-  <g transform="translate(512, 420) scale(1.6)">
-    <!-- Plug base -->
-    <rect x="-140" y="20" width="280" height="200" rx="30" fill="url(#plug)"/>
+    <!-- Plug body - scaled 1.6x and centered -->
+    <g transform="translate(512, 420) scale(1.6)">
+      <!-- Plug base -->
+      <rect x="-140" y="20" width="280" height="200" rx="30" fill="url(#plug)"/>
 
-    <!-- Plug prongs -->
-    <rect x="-100" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
-    <rect x="50" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
+      <!-- Plug prongs -->
+      <rect x="-100" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
+      <rect x="50" y="-120" width="50" height="160" rx="12" fill="url(#plug)"/>
 
-    <!-- Ground prong -->
-    <rect x="-25" y="-80" width="50" height="120" rx="12" fill="url(#plug)"/>
+      <!-- Ground prong -->
+      <rect x="-25" y="-80" width="50" height="120" rx="12" fill="url(#plug)"/>
 
-    <!-- Cord -->
-    <path d="M 0 220 Q 0 300 -50 350 Q -100 400 -100 450"
-          stroke="url(#plug)" stroke-width="50" stroke-linecap="round" fill="none"/>
-  </g>
+      <!-- Cord -->
+      <path d="M 0 220 Q 0 300 -50 350 Q -100 400 -100 450"
+            stroke="url(#plug)" stroke-width="50" stroke-linecap="round" fill="none"/>
+    </g>
 
-  <!-- Kill X overlay - scaled 1.6x -->
-  <g transform="translate(512, 480) scale(1.6)">
-    <line x1="-180" y1="-180" x2="180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
-    <line x1="180" y1="-180" x2="-180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
+    <!-- Kill X overlay - scaled 1.6x -->
+    <g transform="translate(512, 480) scale(1.6)">
+      <line x1="-180" y1="-180" x2="180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
+      <line x1="180" y1="-180" x2="-180" y2="180" stroke="#FFE066" stroke-width="80" stroke-linecap="round"/>
+    </g>
   </g>
 </svg>
```

---

### Incident Patch 5: `f6f79c45` (2026-06-13)
**Commit Message**: fix: plug memory growth sources in port-forward and auto-refresh (#75)

Two concrete accumulation/retain sources found by code audit:

- PortForwardProcessManager.killProcesses now drops the stored log and
  port-conflict handler closures itself. Previously cleanup depended on every
  caller either reconnecting (overwriting the handler) or explicitly removing
  it; a caller that did neither would leak a closure capturing connection
  state. Removes the now-redundant explicit removes in stopConnection and the
  unused remove* methods.

- AppState auto-refresh Task captured self strongly while being stored on
  AppState, forming a retain cycle that kept AppState (and everything it owns)
  alive past teardown. Capture [weak self].

Addresses #75; full confirmation needs a long-running profile.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `platforms/macos/Sources/AppState+AutoRefresh.swift` (modified, +3/-2)
```diff
@@ -11,12 +11,13 @@ extension AppState {
     /// Starts a background task that periodically refreshes the port list.
     func startAutoRefresh() {
         stopAutoRefresh()
-        refreshTask = Task { @MainActor in
+        refreshTask = Task { @MainActor [weak self] in
+            guard let self else { return }
             var unchangedCycles = 0
             _ = await self.refresh()
             while !Task.isCancelled {
                 let baseInterval = max(1, Defaults[.refreshInterval])
-                let delaySeconds = adaptiveRefreshDelay(baseInterval: baseInterval, unchangedCycles: unchangedCycles)
+                let delaySeconds = self.adaptiveRefreshDelay(baseInterval: baseInterval, unchangedCycles: unchangedCycles)
                 try? await Task.sleep(for: .seconds(delaySeconds))
                 guard !Task.isCancelled else { break }
 
```

**File**: `platforms/macos/Sources/Managers/PortForwardManager.swift` (modified, +1/-2)
```diff
@@ -199,9 +199,8 @@ final class PortForwardManager {
         state.clearLogs()
 
         Task {
+            // killProcesses also drops the stored log/port-conflict handlers.
             await processManager.killProcesses(for: id)
-            await processManager.removeLogHandler(for: id)
-            await processManager.removePortConflictHandler(for: id)
         }
     }
 
```

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager.swift` (modified, +5/-8)
```diff
@@ -18,18 +18,10 @@ actor PortForwardProcessManager {
         logHandlers[id] = handler
     }
 
-    func removeLogHandler(for id: UUID) {
-        logHandlers.removeValue(forKey: id)
-    }
-
     func setPortConflictHandler(for id: UUID, handler: @escaping PortConflictHandler) {
         portConflictHandlers[id] = handler
     }
 
-    func removePortConflictHandler(for id: UUID) {
-        portConflictHandlers.removeValue(forKey: id)
-    }
-
     // MARK: - Output Reading
 
     func startReadingOutput(pipe: Pipe, id: UUID, type: PortForwardProcessType) {
@@ -108,6 +100,11 @@ actor PortForwardProcessManager {
         }
         processes[id] = nil
         connectionErrors.removeValue(forKey: id)
+        // Drop stored handler closures so they can't outlive the connection. Callers that
+        // immediately reconnect re-register fresh handlers; this keeps the cleanup correct
+        // even for callers that don't.
+        logHandlers.removeValue(forKey: id)
+        portConflictHandlers.removeValue(forKey: id)
 
         let scriptPath = "/tmp/pf-wrapper-\(id.uuidString).sh"
         try? FileManager.default.removeItem(atPath: scriptPath)
```

---

### Incident Patch 6: `78a1c054` (2026-03-09)
**Commit Message**: fix: group tree view by process name instead of PID (#101)

Previously, two instances of the same process (e.g., two node servers)
were shown as separate groups because grouping was by PID. Now they
are grouped by process name, so all ports from the same process appear
under one collapsible group.

Fixes #85

Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `platforms/macos/Sources/Models/ProcessGroup.swift` (modified, +6/-3)
```diff
@@ -14,12 +14,15 @@ import Foundation
 /// their owning process. This provides a hierarchical view where users can
 /// expand/collapse processes to see all their associated ports.
 struct ProcessGroup: Identifiable, Sendable {
-    /// Process ID (PID) - used as stable identifier
-    let id: Int
+    /// Process name - used as stable identifier for grouping
+    let id: String
 
     /// Name of the process owning these ports
     let processName: String
 
-    /// All ports owned by this process
+    /// All PIDs in this group
+    let pids: [Int]
+
+    /// All ports owned by this process (across all PIDs)
     let ports: [PortInfo]
 }
```

**File**: `platforms/macos/Sources/Services/PortGroupingService.swift` (modified, +10/-8)
```diff
@@ -33,11 +33,12 @@ actor PortGroupingService {
     /// // groups[0] might contain: ProcessGroup(id: 1234, processName: "node", ports: [3000, 3001])
     /// ```
     func groupByProcess(_ ports: [PortInfo]) -> [ProcessGroup] {
-        let grouped = Dictionary(grouping: ports) { $0.pid }
-        return grouped.map { pid, ports in
+        let grouped = Dictionary(grouping: ports) { $0.processName }
+        return grouped.map { name, ports in
             ProcessGroup(
-                id: pid,
-                processName: ports.first?.processName ?? "Unknown",
+                id: name,
+                processName: name,
+                pids: Array(Set(ports.map(\.pid))).sorted(),
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { $0.processName.localizedCaseInsensitiveCompare($1.processName) == .orderedAscending }
@@ -54,11 +55,12 @@ actor PortGroupingService {
     ///   - watched: Set of watched port numbers
     /// - Returns: Array of ProcessGroup instances, sorted by priority then name
     func groupByProcessWithPriority(_ ports: [PortInfo], favorites: Set<Int>, watched: Set<Int>) -> [ProcessGroup] {
-        let grouped = Dictionary(grouping: ports) { $0.pid }
-        return grouped.map { pid, ports in
+        let grouped = Dictionary(grouping: ports) { $0.processName }
+        return grouped.map { name, ports in
             ProcessGroup(
-                id: pid,
-                processName: ports.first?.processName ?? "Unknown",
+                id: name,
+                processName: name,
+                pids: Array(Set(ports.map(\.pid))).sorted(),
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { a, b in
```

**File**: `platforms/macos/Sources/Views/Components/ProcessGroupRow.swift` (modified, +3/-2)
```diff
@@ -48,11 +48,12 @@ struct ProcessGroupListRow: View {
             }
             .frame(width: 150, alignment: .leading)
 
-            // PID (aligned with PID column of header)
-            Text("\(group.id)")
+            // PID(s) (aligned with PID column of header)
+            Text(group.pids.count == 1 ? "\(group.pids[0])" : "\(group.pids.count) PIDs")
                 .font(.system(.body, design: .monospaced))
                 .foregroundStyle(.secondary)
                 .frame(width: 70, alignment: .leading)
+                .help(group.pids.map(String.init).joined(separator: ", "))
 
             // Port Count Badge (aligned with Type column of header effectively)
             if !showConfirm {
```

**File**: `platforms/macos/Sources/Views/MenuBar/MenuBarPortList.swift` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ struct MenuBarPortList: View {
     let filteredPortForwardConnections: [PortForwardConnectionState]
     let groupedByProcess: [ProcessGroup]
     let useTreeView: Bool
-    @Binding var expandedProcesses: Set<Int>
+    @Binding var expandedProcesses: Set<String>
     @Binding var confirmingKillPort: String?
     @Bindable var state: AppState
 
```

**File**: `platforms/macos/Sources/Views/MenuBar/MenuBarProcessGroupRow.swift` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ struct MenuBarProcessGroupRow: View {
                     if group.ports.contains(where: { state.isWatching($0.port) }) { Image(systemName: "eye.fill").font(.caption2).foregroundStyle(.blue) }
                 }
                 Spacer()
-                Text("PID \(String(group.id))").font(.caption2).foregroundStyle(.secondary)
+                Text(group.pids.count == 1 ? "PID \(group.pids[0])" : "\(group.pids.count) PIDs").font(.caption2).foregroundStyle(.secondary)
                 if !(isHovered || showConfirm) {
                     Text("\(group.ports.count)").font(.caption2).foregroundStyle(.secondary).padding(.horizontal, 5).background(.tertiary.opacity(0.5)).clipShape(Capsule())
                 } else if !showConfirm {
```

**File**: `platforms/macos/Sources/Views/MenuBar/MenuBarView.swift` (modified, +6/-5)
```diff
@@ -16,7 +16,7 @@ struct MenuBarView: View {
     @State private var confirmingKillAll = false
     @State private var confirmingKillPort: String?
     @State private var hoveredPort: String?
-    @State private var expandedProcesses: Set<Int> = []
+    @State private var expandedProcesses: Set<String> = []
     @Default(.useTreeView) private var useTreeView
     @Default(.hideSystemProcesses) private var hideSystemProcesses
 
@@ -70,11 +70,12 @@ struct MenuBarView: View {
         }
 
         // Compute groups from cached filtered ports
-        let grouped = Dictionary(grouping: cachedFilteredPorts) { $0.pid }
-        cachedGroups = grouped.map { pid, ports in
+        let grouped = Dictionary(grouping: cachedFilteredPorts) { $0.processName }
+        cachedGroups = grouped.map { name, ports in
             ProcessGroup(
-                id: pid,
-                processName: ports.first?.processName ?? "Unknown",
+                id: name,
+                processName: name,
+                pids: Array(Set(ports.map(\.pid))).sorted(),
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { a, b in
```

**File**: `platforms/macos/Sources/Views/PortTable/PortTableView.swift` (modified, +6/-5)
```diff
@@ -17,7 +17,7 @@ struct PortTableView: View {
     @State private var sortOrder: SortOrder = .port
     @State private var sortAscending = true
     @Default(.useTreeView) private var useTreeView
-    @State private var expandedProcesses: Set<Int> = []
+    @State private var expandedProcesses: Set<String> = []
 
     var body: some View {
         VStack(spacing: 0) {
@@ -206,11 +206,12 @@ struct PortTableView: View {
 
     /// Groups ports by process for tree view
     private var groupedPorts: [ProcessGroup] {
-        let grouped = Dictionary(grouping: appState.filteredPorts) { $0.pid }
-        return grouped.map { pid, ports in
+        let grouped = Dictionary(grouping: appState.filteredPorts) { $0.processName }
+        return grouped.map { name, ports in
             ProcessGroup(
-                id: pid,
-                processName: ports.first?.processName ?? "Unknown",
+                id: name,
+                processName: name,
+                pids: Array(Set(ports.map(\.pid))).sorted(),
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { $0.processName.localizedCaseInsensitiveCompare($1.processName) == .orderedAscending }
```

---

### Incident Patch 7: `3066aee8` (2026-03-09)
**Commit Message**: fix: decode all lsof hex escape sequences for non-ASCII process names (#95)

Previously only \x20 (space) and \x2f (slash) were decoded. Now all
\xHH sequences are collected and decoded as UTF-8, correctly rendering
multi-byte characters like Chinese (企业微信).

Fixes #94, fixes #86

Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +48/-6)
```diff
@@ -194,12 +194,10 @@ actor PortScanner: PortScannerProtocol {
             let components = line.split(separator: " ", omittingEmptySubsequences: true)
             guard components.count >= 9 else { continue }
 
-            // Extract process name and handle escaped characters
-            // lsof escapes special characters: "Code Helper" → "Code\x20Helper"
-            var processName = String(components[0])
-            processName = processName
-                .replacingOccurrences(of: "\\x20", with: " ")  // Space
-                .replacingOccurrences(of: "\\x2f", with: "/")  // Slash
+            // Extract process name and decode all hex escape sequences from lsof
+            // lsof escapes special/non-ASCII characters as \xHH sequences
+            // e.g., "Code\x20Helper", "\xe4\xbc\x81\xe4\xb8\x9a" (企业)
+            let processName = Self.decodeLsofEscapes(String(components[0]))
 
             guard let pid = Int(components[1]) else { continue }
 
@@ -293,6 +291,50 @@ actor PortScanner: PortScannerProtocol {
         )
     }
 
+    /**
+     * Decodes lsof hex escape sequences (\xHH) into proper characters.
+     *
+     * lsof escapes non-ASCII bytes and some special characters as \xHH sequences.
+     * This method collects all escaped bytes and decodes them as UTF-8, which
+     * correctly handles multi-byte characters like Chinese (e.g., \xe4\xbc\x81 → 企).
+     */
+    nonisolated static func decodeLsofEscapes(_ input: String) -> String {
+        var result = ""
+        var pendingBytes: [UInt8] = []
+        var i = input.startIndex
+
+        while i < input.endIndex {
+            // Check for \xHH pattern
+            if input[i] == "\\" {
+                let next = input.index(after: i)
+                if next < input.endIndex, input[next] == "x" {
+                    let hexStart = input.index(after: next)
+                    let hexEnd = input.index(hexStart, offsetBy: 2, limitedBy: input.endIndex)
+                    if let hexEnd, let byte = UInt8(input[hexStart..<hexEnd], radix: 16) {
+                        pendingBytes.append(byte)
+                        i = hexEnd
+                        continue
+                    }
+                }
+            }
+
+            // Flush any pending bytes as UTF-8 before appending a literal character
+            if !pendingBytes.isEmpty {
+                result += String(decoding: pendingBytes, as: UTF8.self)
+                pendingBytes.removeAll()
+            }
+            result.append(input[i])
+            i = input.index(after: i)
+        }
+
+        // Flush remaining bytes
+        if !pendingBytes.isEmpty {
+            result += String(decoding: pendingBytes, as: UTF8.self)
+        }
+
+        return result
+    }
+
     /**
      * Kills a process by sending a termination signal.
      *
```

---

### Incident Patch 8: `b1585448` (2026-02-05)
**Commit Message**: refactor: enhance memory management and error handling in PortForwardProcessManager and PortScanner

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager+ConflictResolution.swift` (modified, +28/-28)
```diff
@@ -4,45 +4,45 @@ import Darwin
 extension PortForwardProcessManager {
     /// Kills any process using the specified port.
     func killProcessOnPort(_ port: Int) async {
-        let lsof = Process()
-        lsof.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
-        lsof.arguments = ["-ti", "tcp:\(port)"]
+        // Wrap Process/Pipe lifecycle in autoreleasepool to release Obj-C bridged objects.
+        // Read pipe data BEFORE waitUntilExit to avoid deadlock if output exceeds pipe buffer.
+        let output: String = autoreleasepool {
+            let lsof = Process()
+            lsof.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
+            lsof.arguments = ["-ti", "tcp:\(port)"]
 
-        let pipe = Pipe()
-        lsof.standardOutput = pipe
-        lsof.standardError = FileHandle.nullDevice
+            let pipe = Pipe()
+            lsof.standardOutput = pipe
+            lsof.standardError = FileHandle.nullDevice
 
-        do {
-            try lsof.run()
-            lsof.waitUntilExit()
-
-            // Use autoreleasepool to prevent memory accumulation
-            var output: String = ""
-            autoreleasepool {
+            do {
+                try lsof.run()
                 let data = pipe.fileHandleForReading.readDataToEndOfFile()
-                output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
+                lsof.waitUntilExit()
+                return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
+            } catch {
+                return ""
             }
+        }
 
-            if !output.isEmpty {
-                let pids = output.split(separator: "\n")
-                for pidStr in pids {
-                    if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
-                        kill(pid, SIGTERM)
-                    }
+        // Kill logic uses Darwin.kill (pure C) and await, so stays outside the pool
+        if !output.isEmpty {
+            let pids = output.split(separator: "\n")
+            for pidStr in pids {
+                if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
+                    kill(pid, SIGTERM)
                 }
+            }
 
-                try? await Task.sleep(for: .milliseconds(300))
+            try? await Task.sleep(for: .milliseconds(300))
 
-                for pidStr in pids {
-                    if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
-                        if kill(pid, 0) == 0 {
-                            kill(pid, SIGKILL)
-                        }
+            for pidStr in pids {
+                if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
+                    if kill(pid, 0) == 0 {
+                        kill(pid, SIGKILL)
                     }
                 }
             }
-        } catch {
-            // Ignore errors
         }
     }
 }
```

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager.swift` (modified, +4/-0)
```diff
@@ -105,6 +105,7 @@ actor PortForwardProcessManager {
             }
         }
         processes[id] = nil
+        connectionErrors.removeValue(forKey: id)
 
         let scriptPath = "/tmp/pf-wrapper-\(id.uuidString).sh"
         try? FileManager.default.removeItem(atPath: scriptPath)
@@ -138,5 +139,8 @@ actor PortForwardProcessManager {
             for (_, task) in tasks { task.cancel() }
         }
         outputTasks.removeAll()
+        connectionErrors.removeAll()
+        logHandlers.removeAll()
+        portConflictHandlers.removeAll()
     }
 }
```

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +78/-78)
```diff
@@ -32,36 +32,39 @@ actor PortScanner: PortScannerProtocol {
      * @returns Array of PortInfo objects representing all listening ports
      */
     func scanPorts() async -> [PortInfo] {
-        let process = Process()
-        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
-        process.arguments = ["-iTCP", "-sTCP:LISTEN", "-P", "-n", "+c", "0"]
-
-        let pipe = Pipe()
-        process.standardOutput = pipe
-        process.standardError = FileHandle.nullDevice
-
-        do {
-            try process.run()
-            process.waitUntilExit()
-
-            // Use autoreleasepool to immediately release Obj-C bridged Data objects
-            // Without this, FileHandle.readDataToEndOfFile() causes memory accumulation
-            var output: String = ""
-            autoreleasepool {
+        // Wrap entire Process/Pipe lifecycle in autoreleasepool to release Obj-C bridged
+        // objects (Process, Pipe, FileHandle, URL, Data) immediately after each scan.
+        // Without this, these objects accumulate across the long-lived scanning Task,
+        // causing ~35KB per scan × 47,520 scans over 66 hours = ~1.7GB leak.
+        let output: String = autoreleasepool {
+            let process = Process()
+            process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
+            process.arguments = ["-iTCP", "-sTCP:LISTEN", "-P", "-n", "+c", "0"]
+
+            let pipe = Pipe()
+            process.standardOutput = pipe
+            process.standardError = FileHandle.nullDevice
+
+            do {
+                try process.run()
+
+                // CRITICAL: Read data BEFORE waitUntilExit to avoid deadlock.
+                // If lsof output exceeds the pipe buffer (~64KB), lsof blocks waiting
+                // to write. If we waitUntilExit first, we deadlock.
                 let data = pipe.fileHandleForReading.readDataToEndOfFile()
-                output = String(data: data, encoding: .utf8) ?? ""
-            }
+                process.waitUntilExit()
 
-            guard !output.isEmpty else {
-                return []
+                return String(data: data, encoding: .utf8) ?? ""
+            } catch {
+                print("[PortScanner] Failed to scan ports: \(error.localizedDescription)")
+                return ""
             }
-
-            let commands = await getProcessCommands()
-            return parseLsofOutput(output, commands: commands)
-        } catch {
-            print("[PortScanner] Failed to scan ports: \(error.localizedDescription)")
-            return []
         }
+
+        guard !output.isEmpty else { return [] }
+
+        let commands = await getProcessCommands()
+        return parseLsofOutput(output, commands: commands)
     }
 
     /**
@@ -74,57 +77,52 @@ actor PortScanner: PortScannerProtocol {
      * @returns Dictionary mapping PID to full command string
      */
     private func getProcessCommands() async -> [Int: String] {
-        let process = Process()
-        process.executableURL = URL(fileURLWithPath: "/bin/ps")
-        process.arguments = ["-axo", "pid,command"]
-
-        let pipe = Pipe()
-        process.standardOutput = pipe
-        process.standardError = FileHandle.nullDevice
-
-        do {
-            try process.run()
-
-            // CRITICAL: Read data BEFORE waitUntilExit to avoid deadlock
-            // Explanation: If the pipe buffer fills up (common with large process lists),
-            // ps will block waiting to write more data. If we call waitUntilExit first,
-            // we'll wait forever for ps to finish, but ps is waiting for us to read the pipe.
-            // Reading first prevents this deadlock.
-
-            // Use autoreleasepool to immediately release Obj-C bridged Data objects
-            var output: String = ""
-            autoreleasepool {
+        // Wrap Process/Pipe lifecycle in autoreleasepool; parsing stays outside
+        let output: String = autoreleasepool {
+            let process = Process()
+            process.executableURL = URL(fileURLWithPath: "/bin/ps")
+            process.arguments = ["-axo", "pid,command"]
+
+            let pipe = Pipe()
+            process.standardOutput = pipe
+            process.standardError = FileHandle.nullDevice
+
+            do {
+                try process.run()
+
+                // CRITICAL: Read data BEFORE waitUntilExit to avoid deadlock.
+                // If the pipe buffer fills up (common with large process lists),
+                // ps blocks waiting to write. waitUntilExit first = deadlock.
                 let data = pipe.fileHandleForReading.readDataToEndOfFile()
-                output = String(data: data, encoding: .utf8) ?? ""
-            }
-            process.waitUntilExit()
+                process.waitUntilExit()
 
-            guard !output.isEmpty else {
-                return [:]
+                return String(data: data, encoding: .utf8) ?? ""
+            } catch {
+      
```

---

### Incident Patch 9: `17008047` (2026-01-30)
**Commit Message**: feat: add cloudflared protocol selection for tunnels in settings and UI (#91)

**File**: `platforms/macos/Sources/AppState.swift` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ extension Defaults.Keys {
     static let useTreeView = Key<Bool>("useTreeView", default: false)
     static let hideSystemProcesses = Key<Bool>("hideSystemProcesses", default: false)
     static let refreshInterval = Key<Int>("refreshInterval", default: 5)
+    static let cloudflaredProtocol = Key<CloudflaredProtocol>("cloudflaredProtocol", default: .http2)
 
     // Kubernetes-related keys
     static let customNamespaces = Key<[String]>("customNamespaces", default: [])
```

**File**: `platforms/macos/Sources/Models/CloudflaredProtocol.swift` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+import Defaults
+import Foundation
+
+/// Supported transport protocols for cloudflared quick tunnels.
+enum CloudflaredProtocol: String, CaseIterable, Codable, Defaults.Serializable, Sendable {
+    case http2 = "http2"
+    case quic = "quic"
+
+    var displayName: String {
+        switch self {
+        case .http2: return "HTTP/2"
+        case .quic: return "QUIC"
+        }
+    }
+}
```

**File**: `platforms/macos/Sources/Services/CloudflaredService.swift` (modified, +3/-1)
```diff
@@ -1,5 +1,6 @@
 import Foundation
 import Darwin
+import Defaults
 
 // MARK: - Cloudflared Service Actor
 
@@ -48,7 +49,8 @@ actor CloudflaredService {
 
         let process = Process()
         process.executableURL = URL(fileURLWithPath: cloudflaredPath)
-        process.arguments = ["tunnel", "--url", "localhost:\(port)"]
+        let protocolValue = Defaults[.cloudflaredProtocol].rawValue
+        process.arguments = ["tunnel", "--url", "localhost:\(port)", "--protocol", protocolValue]
 
         let pipe = Pipe()
         process.standardOutput = pipe
```

**File**: `platforms/macos/Sources/Views/Settings/CloudflaredSettingsSection.swift` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+/// CloudflaredSettingsSection - Cloudflare tunnel preferences
+///
+/// Displays cloudflared settings including:
+/// - Transport protocol selection (HTTP/2 or QUIC)
+
+import SwiftUI
+import Defaults
+
+struct CloudflaredSettingsSection: View {
+    @Default(.cloudflaredProtocol) private var protocolSelection
+
+    var body: some View {
+        SettingsGroup("Cloudflare Tunnels", icon: "cloud.fill") {
+            SettingsRowContainer {
+                HStack {
+                    VStack(alignment: .leading, spacing: 2) {
+                        Text("Tunnel protocol")
+                            .fontWeight(.medium)
+                        Text("Choose how cloudflared connects to Cloudflare (applies to new tunnels)")
+                            .font(.caption)
+                            .foregroundStyle(.secondary)
+                    }
+
+                    Spacer()
+
+                    Picker("", selection: $protocolSelection) {
+                        ForEach(CloudflaredProtocol.allCases, id: \.self) { option in
+                            Text(option.displayName).tag(option)
+                        }
+                    }
+                    .labelsHidden()
+                    .pickerStyle(.segmented)
+                    .frame(width: 160)
+                }
+            }
+        }
+    }
+}
```

**File**: `platforms/macos/Sources/Views/Settings/SettingsView.swift` (modified, +3/-0)
```diff
@@ -36,6 +36,9 @@ struct SettingsView: View {
                 // MARK: - Port Forwarding
                 PortForwardingSettingsSection()
 
+                // MARK: - Cloudflare Tunnels
+                CloudflaredSettingsSection()
+
                 // MARK: - Keyboard Shortcuts
                 ShortcutsSection()
 
```

**File**: `platforms/windows/PortKiller/App.xaml.cs` (modified, +2/-1)
```diff
@@ -46,7 +46,8 @@ private void ConfigureServices(IServiceCollection services)
         ));
         services.AddSingleton<TunnelViewModel>(sp => new TunnelViewModel(
             sp.GetRequiredService<TunnelService>(),
-            NotificationService.Instance
+            NotificationService.Instance,
+            sp.GetRequiredService<SettingsService>()
         ));
     }
 }
```

**File**: `platforms/windows/PortKiller/CloudflareTunnelsView.xaml` (modified, +12/-0)
```diff
@@ -91,6 +91,18 @@
                 </StackPanel>
 
                 <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
+                    <StackPanel Orientation="Horizontal" VerticalAlignment="Center" Margin="0,0,12,0">
+                        <TextBlock Text="Protocol" FontSize="12" Foreground="#A0A0A0" VerticalAlignment="Center" Margin="0,0,8,0"/>
+                        <ComboBox Width="90"
+                                  ItemsSource="{Binding ProtocolOptions}"
+                                  SelectedValuePath="Value"
+                                  SelectedValue="{Binding CloudflaredProtocol, Mode=TwoWay}"
+                                  DisplayMemberPath="Label"
+                                  Background="#3A3A3A"
+                                  Foreground="#E0E0E0"
+                                  BorderThickness="0"
+                                  Padding="6,2"/>
+                    </StackPanel>
                     <Button Content="Stop All" 
                             Click="StopAllButton_Click"
                             Style="{StaticResource DangerButton}"
```

**File**: `platforms/windows/PortKiller/MainWindow.xaml` (modified, +13/-0)
```diff
@@ -613,6 +613,19 @@
                                     <TextBlock Text="Cloudflare Tunnels" FontSize="20" FontWeight="SemiBold" Foreground="#E0E0E0"/>
                                 </StackPanel>
                                 <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
+                                    <StackPanel Orientation="Horizontal" VerticalAlignment="Center" Margin="0,0,12,0">
+                                        <TextBlock Text="Protocol" FontSize="12" Foreground="#A0A0A0" VerticalAlignment="Center" Margin="0,0,8,0"/>
+                                        <ComboBox x:Name="TunnelProtocolCombo"
+                                                  Width="90"
+                                                  ItemsSource="{Binding ProtocolOptions}"
+                                                  SelectedValuePath="Value"
+                                                  SelectedValue="{Binding CloudflaredProtocol, Mode=TwoWay}"
+                                                  DisplayMemberPath="Label"
+                                                  Background="#3A3A3A"
+                                                  Foreground="#E0E0E0"
+                                                  BorderThickness="0"
+                                                  Padding="6,2"/>
+                                    </StackPanel>
                                     <Button x:Name="StopAllTunnelsButton" 
                                             Content="Stop All" 
                                             Click="StopAllTunnels_Click"
```

---

### Incident Patch 10: `3e0f7fc4` (2026-01-30)
**Commit Message**: fix(windows): add loading spinner when killing process (#77)

**File**: `platforms/windows/PortKiller/MainWindow.xaml` (modified, +46/-5)
```diff
@@ -4,6 +4,7 @@
         xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
         xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
         xmlns:tb="http://www.hardcodet.net/taskbar"
+        xmlns:helpers="clr-namespace:PortKiller.Helpers"
         mc:Ignorable="d"
         Title="PortKiller" 
         Height="700" Width="1200"
@@ -19,6 +20,7 @@
     <Window.Resources>
         <!-- Boolean to Visibility Converter -->
         <BooleanToVisibilityConverter x:Key="BoolToVisibilityConverter"/>
+        <helpers:InverseBoolToVisibilityConverter x:Key="InverseBoolToVisibilityConverter"/>
 
         <!-- Modern Card Style -->
         <Style x:Key="Card" TargetType="Border">
@@ -403,16 +405,55 @@
                                                         </TextBlock>
                                                     </StackPanel>
 
-                                                    <!-- Actions (Minimal Kill Button) -->
+                                                    <!-- Actions (Kill Button and Spinner) -->
                                                     <StackPanel Grid.Column="2" Orientation="Horizontal" VerticalAlignment="Center">
-                                                        <Button Content="✕" 
-                                                                Click="KillButton_Click" 
+                                                        <!-- Loading Spinner (visible when killing) -->
+                                                        <Border Padding="10,6"
+                                                                Visibility="{Binding IsKilling, Converter={StaticResource BoolToVisibilityConverter}}">
+                                                            <Grid Width="16" Height="16" RenderTransformOrigin="0.5,0.5">
+                                                                <Grid.RenderTransform>
+                                                                    <RotateTransform/>
+                                                                </Grid.RenderTransform>
+                                                                <Ellipse Width="14" Height="14"
+                                                                         Stroke="#e74c3c"
+                                                                         StrokeThickness="2"
+                                                                         Opacity="0.3"/>
+                                                                <Path Data="M 7,0 A 7,7 0 0 1 14,7"
+                                                                      Stroke="#e74c3c"
+                                                                      StrokeThickness="2"
+                                                                      StrokeStartLineCap="Round"
+                                                                      StrokeEndLineCap="Round"
+                                                                      Margin="1"/>
+                                                                <Grid.Style>
+                                                                    <Style TargetType="Grid">
+                                                                        <Style.Triggers>
+                                                                            <DataTrigger Binding="{Binding IsKilling}" Value="True">
+                                                                                <DataTrigger.EnterActions>
+                                                                                    <BeginStoryboard>
+                                                                                        <Storyboard RepeatBehavior="Forever">
+                                                                                            <DoubleAnimation
+                                                                                                Storyboard.TargetProperty="(Grid.RenderTransform).(RotateTransform.Angle)"
+                                                                                                From="0" To="360" Duration="0:0:0.8"/>
+                                                                                        </Storyboard>
+                                                                                    </BeginStoryboard>
+                                                                                </DataTrigger.EnterActions>
+                                                                            </DataTrigger>
+                                                                        </Style.Triggers>
+                                                                    </Style>
+                                                                </Grid.Style>
+                                                            </Grid>
+                                                        </Border>
+
+                            
```

---

### Incident Patch 11: `f14d98b0` (2026-01-14)
**Commit Message**: refactor: optimize memory usage with caching in AppState, PortForwardManager, TunnelManager, and MenuBarView

**File**: `platforms/macos/Sources/AppState.swift` (modified, +43/-0)
```diff
@@ -77,8 +77,51 @@ final class AppState {
         return portForwardManager.connections.first { $0.id == id }
     }
 
+    // MARK: - Cached Filtered Ports (Memory Optimization)
+
+    /// Cache for filtered ports to avoid repeated allocations
+    @ObservationIgnored private var _cachedFilteredPorts: [PortInfo] = []
+    @ObservationIgnored private var _filterCacheKey: FilterCacheKey?
+
+    /// Cache key to detect when recalculation is needed
+    private struct FilterCacheKey: Equatable {
+        let portsCount: Int
+        let portsHash: Int
+        let sidebarItem: SidebarItem
+        let filterActive: Bool
+        let filterText: String
+        let hideSystem: Bool
+        let favoritesCount: Int
+        let watchedCount: Int
+    }
+
     /// Returns filtered ports based on sidebar selection and active filters.
+    /// Uses caching to avoid repeated array allocations on each access.
     var filteredPorts: [PortInfo] {
+        let currentKey = FilterCacheKey(
+            portsCount: ports.count,
+            portsHash: ports.isEmpty ? 0 : ports[0].hashValue ^ ports.count,
+            sidebarItem: selectedSidebarItem,
+            filterActive: filter.isActive,
+            filterText: filter.searchText,
+            hideSystem: Defaults[.hideSystemProcesses],
+            favoritesCount: favorites.count,
+            watchedCount: watchedPorts.count
+        )
+
+        // Return cached value if nothing changed
+        if currentKey == _filterCacheKey {
+            return _cachedFilteredPorts
+        }
+
+        // Recompute and cache
+        _cachedFilteredPorts = computeFilteredPorts()
+        _filterCacheKey = currentKey
+        return _cachedFilteredPorts
+    }
+
+    /// Computes filtered ports (called only when cache is invalidated)
+    private func computeFilteredPorts() -> [PortInfo] {
         if case .settings = selectedSidebarItem { return [] }
 
         var result: [PortInfo]
```

**File**: `platforms/macos/Sources/Managers/PortForwardManager.swift` (modified, +9/-4)
```diff
@@ -145,19 +145,21 @@ final class PortForwardManager {
         state.portForwardTask = Task { [weak self, weak state] in
             guard let self = self, let state = state else { return }
 
-            // Set log handler with proper weak capture
+            // Set log handler with proper weak capture (including inner Task)
             let logHandler: LogHandler = { [weak state] message, type, isError in
                 guard let state = state else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak state] in
+                    guard let state = state else { return }
                     state.appendLog(message, type: type, isError: isError)
                 }
             }
             await self.processManager.setLogHandler(for: id, handler: logHandler)
 
-            // Set port conflict handler with proper weak capture
+            // Set port conflict handler with proper weak capture (including inner Task)
             let conflictHandler: PortConflictHandler = { [weak self, weak state] port in
                 guard let self = self, let state = state else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak self, weak state] in
+                    guard let self = self, let state = state else { return }
                     state.appendLog("Port \(port) in use, auto-recovering...", type: .portForward, isError: false)
 
                     await self.processManager.killProcessOnPort(port)
@@ -188,6 +190,9 @@ final class PortForwardManager {
         state.portForwardTask = nil
         state.portForwardStatus = .disconnected
 
+        // Clear logs to free memory when connection is stopped
+        state.clearLogs()
+
         Task {
             await processManager.killProcesses(for: id)
             await processManager.removeLogHandler(for: id)
```

**File**: `platforms/macos/Sources/Managers/TunnelManager.swift` (modified, +6/-4)
```diff
@@ -101,10 +101,11 @@ final class TunnelManager {
         Task { [weak self, weak tunnelState] in
             guard let self = self, let tunnelState = tunnelState else { return }
 
-            // Set URL handler
+            // Set URL handler with proper weak capture in inner Task
             let urlHandler: @Sendable (String) -> Void = { [weak self, weak tunnelState] url in
                 guard let tunnelState = tunnelState else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak self, weak tunnelState] in
+                    guard let tunnelState = tunnelState else { return }
                     tunnelState.tunnelURL = url
                     tunnelState.status = .active
                     tunnelState.startTime = Date()
@@ -117,10 +118,11 @@ final class TunnelManager {
             }
             await self.cloudflaredService.setURLHandler(for: tunnelState.id, handler: urlHandler)
 
-            // Set error handler
+            // Set error handler with proper weak capture in inner Task
             let errorHandler: @Sendable (String) -> Void = { [weak tunnelState] error in
                 guard let tunnelState = tunnelState else { return }
-                Task { @MainActor in
+                Task { @MainActor [weak tunnelState] in
+                    guard let tunnelState = tunnelState else { return }
                     tunnelState.lastError = error
                     if tunnelState.status != .active {
                         tunnelState.status = .error
```

**File**: `platforms/macos/Sources/Models/PortForwardConnection.swift` (modified, +6/-3)
```diff
@@ -130,12 +130,15 @@ final class PortForwardConnectionState: Identifiable, Hashable {
     /// Tracks if the connection was stopped intentionally by the user (vs unexpected disconnect)
     var isIntentionallyStopped: Bool = false
 
+    /// Maximum log entries to keep per connection (memory optimization)
+    private static let maxLogEntries = 100
+
     func appendLog(_ message: String, type: PortForwardProcessType, isError: Bool = false) {
         let entry = PortForwardLogEntry(timestamp: Date(), message: message, type: type, isError: isError)
         logs.append(entry)
-        // Keep only last 500 log entries
-        if logs.count > 500 {
-            logs.removeFirst(logs.count - 500)
+        // Keep only last N log entries to prevent memory accumulation
+        if logs.count > Self.maxLogEntries {
+            logs.removeFirst(logs.count - Self.maxLogEntries)
         }
     }
 
```

**File**: `platforms/macos/Sources/Views/MenuBar/MenuBarView.swift` (modified, +54/-33)
```diff
@@ -19,57 +19,83 @@ struct MenuBarView: View {
     @State private var expandedProcesses: Set<Int> = []
     @Default(.useTreeView) private var useTreeView
     @Default(.hideSystemProcesses) private var hideSystemProcesses
+
+    // MARK: - Cached Data (Memory Optimization)
+    @State private var cachedFilteredPorts: [PortInfo] = []
     @State private var cachedGroups: [ProcessGroup] = []
-    @State private var groupingTrigger = 0
+    @State private var lastCacheKey: CacheKey?
+
+    /// Cache key to detect when recalculation is needed
+    private struct CacheKey: Equatable {
+        let portsCount: Int
+        let firstPortHash: Int
+        let searchText: String
+        let hideSystem: Bool
+    }
 
     private var groupedByProcess: [ProcessGroup] { cachedGroups }
 
-    /// Updates cached process groups from filtered ports
-    private func updateGroupedByProcess() {
-        let grouped = Dictionary(grouping: filteredPorts) { $0.pid }
+    /// Updates all cached data only when inputs change
+    private func updateCachedData() {
+        let currentKey = CacheKey(
+            portsCount: state.ports.count,
+            firstPortHash: state.ports.first?.hashValue ?? 0,
+            searchText: searchText,
+            hideSystem: hideSystemProcesses
+        )
+
+        // Skip if nothing changed
+        guard currentKey != lastCacheKey else { return }
+        lastCacheKey = currentKey
+
+        // Compute filtered ports once
+        var filtered: [PortInfo]
+        if searchText.isEmpty {
+            filtered = state.ports
+        } else {
+            filtered = state.ports.filter {
+                String($0.port).contains(searchText) || $0.processName.localizedCaseInsensitiveContains(searchText)
+            }
+        }
+
+        if hideSystemProcesses {
+            filtered = filtered.filter { $0.processType != .system }
+        }
+
+        cachedFilteredPorts = filtered.sorted { a, b in
+            let aFav = state.isFavorite(a.port)
+            let bFav = state.isFavorite(b.port)
+            if aFav != bFav { return aFav }
+            return a.port < b.port
+        }
+
+        // Compute groups from cached filtered ports
+        let grouped = Dictionary(grouping: cachedFilteredPorts) { $0.pid }
         cachedGroups = grouped.map { pid, ports in
             ProcessGroup(
                 id: pid,
                 processName: ports.first?.processName ?? "Unknown",
                 ports: ports.sorted { $0.port < $1.port }
             )
         }.sorted { a, b in
-            // Check if groups have favorite or watched ports
             let aHasFavorite = a.ports.contains(where: { state.isFavorite($0.port) })
             let aHasWatched = a.ports.contains(where: { state.isWatching($0.port) })
             let bHasFavorite = b.ports.contains(where: { state.isFavorite($0.port) })
             let bHasWatched = b.ports.contains(where: { state.isWatching($0.port) })
 
-            // Priority: Favorite > Watched > Neither
             let aPriority = aHasFavorite ? 2 : (aHasWatched ? 1 : 0)
             let bPriority = bHasFavorite ? 2 : (bHasWatched ? 1 : 0)
 
             if aPriority != bPriority {
                 return aPriority > bPriority
             } else {
-                // Same priority, sort alphabetically by process name
                 return a.processName.localizedCaseInsensitiveCompare(b.processName) == .orderedAscending
             }
         }
     }
 
-    /// Filters ports based on search text and sorts by favorites
-    private var filteredPorts: [PortInfo] {
-        var filtered = searchText.isEmpty ? state.ports : state.ports.filter {
-            String($0.port).contains(searchText) || $0.processName.localizedCaseInsensitiveContains(searchText)
-        }
-
-        if hideSystemProcesses {
-            filtered = filtered.filter { $0.processType != .system }
-        }
-
-        return filtered.sorted { a, b in
-            let aFav = state.isFavorite(a.port)
-            let bFav = state.isFavorite(b.port)
-            if aFav != bFav { return aFav }
-            return a.port < b.port
-        }
-    }
+    /// Cached filtered ports (no allocation on access)
+    private var filteredPorts: [PortInfo] { cachedFilteredPorts }
 
     /// Filters port-forward connections based on search text
     private var filteredPortForwardConnections: [PortForwardConnectionState] {
@@ -109,14 +135,9 @@ struct MenuBarView: View {
             )
         }
         .frame(width: 340)
-        .onAppear { groupingTrigger += 1 }
-        .onChange(of: state.ports) { _, _ in groupingTrigger += 1 }
-        .onChange(of: searchText) { _, _ in groupingTrigger += 1 }
-        .onChange(of: hideSystemProcesses) { _, _ in groupingTrigger += 1 }
-        .task(id: groupingTrigger) {
-            // Debounce rapid changes to avoid excessive CPU/memory churn
-            try? await Task.sleep(for: .milliseconds(100))
-            updateGroupedByProcess()
-    
```

---

### Incident Patch 12: `29374082` (2026-01-14)
**Commit Message**: refactor: use autoreleasepool to prevent memory accumulation in process handling across multiple managers and services

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager+ConflictResolution.swift` (modified, +9/-4)
```diff
@@ -16,10 +16,15 @@ extension PortForwardProcessManager {
             try lsof.run()
             lsof.waitUntilExit()
 
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
-            if let output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
-               !output.isEmpty {
-                let pids = output.components(separatedBy: .newlines)
+            // Use autoreleasepool to prevent memory accumulation
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
+            }
+
+            if !output.isEmpty {
+                let pids = output.split(separator: "\n")
                 for pidStr in pids {
                     if let pid = Int32(pidStr.trimmingCharacters(in: .whitespaces)) {
                         kill(pid, SIGTERM)
```

**File**: `platforms/macos/Sources/Managers/PortForwardProcessManager+Kubernetes.swift` (modified, +18/-10)
```diff
@@ -74,17 +74,22 @@ extension PortForwardProcessManager {
                 let outputAccumulator = DataAccumulator()
                 let errorAccumulator = DataAccumulator()
 
+                // Use autoreleasepool in handlers - background queues don't auto-drain
                 outputPipe.fileHandleForReading.readabilityHandler = { handle in
-                    let data = handle.availableData
-                    if !data.isEmpty {
-                        outputAccumulator.append(data)
+                    autoreleasepool {
+                        let data = handle.availableData
+                        if !data.isEmpty {
+                            outputAccumulator.append(data)
+                        }
                     }
                 }
 
                 errorPipe.fileHandleForReading.readabilityHandler = { handle in
-                    let data = handle.availableData
-                    if !data.isEmpty {
-                        errorAccumulator.append(data)
+                    autoreleasepool {
+                        let data = handle.availableData
+                        if !data.isEmpty {
+                            errorAccumulator.append(data)
+                        }
                     }
                 }
 
@@ -95,10 +100,13 @@ extension PortForwardProcessManager {
                     outputPipe.fileHandleForReading.readabilityHandler = nil
                     errorPipe.fileHandleForReading.readabilityHandler = nil
 
-                    let remainingOutput = outputPipe.fileHandleForReading.readDataToEndOfFile()
-                    let remainingError = errorPipe.fileHandleForReading.readDataToEndOfFile()
-                    outputAccumulator.append(remainingOutput)
-                    errorAccumulator.append(remainingError)
+                    // Use autoreleasepool for final reads
+                    autoreleasepool {
+                        let remainingOutput = outputPipe.fileHandleForReading.readDataToEndOfFile()
+                        let remainingError = errorPipe.fileHandleForReading.readDataToEndOfFile()
+                        outputAccumulator.append(remainingOutput)
+                        errorAccumulator.append(remainingError)
+                    }
 
                     let output = String(data: outputAccumulator.value, encoding: .utf8) ?? ""
                     let errorOutput = String(data: errorAccumulator.value, encoding: .utf8) ?? ""
```

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +17/-4)
```diff
@@ -44,8 +44,15 @@ actor PortScanner: PortScannerProtocol {
             try process.run()
             process.waitUntilExit()
 
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
-            guard let output = String(data: data, encoding: .utf8) else {
+            // Use autoreleasepool to immediately release Obj-C bridged Data objects
+            // Without this, FileHandle.readDataToEndOfFile() causes memory accumulation
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8) ?? ""
+            }
+
+            guard !output.isEmpty else {
                 return []
             }
 
@@ -83,10 +90,16 @@ actor PortScanner: PortScannerProtocol {
             // ps will block waiting to write more data. If we call waitUntilExit first,
             // we'll wait forever for ps to finish, but ps is waiting for us to read the pipe.
             // Reading first prevents this deadlock.
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
+
+            // Use autoreleasepool to immediately release Obj-C bridged Data objects
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8) ?? ""
+            }
             process.waitUntilExit()
 
-            guard let output = String(data: data, encoding: .utf8) else {
+            guard !output.isEmpty else {
                 return [:]
             }
 
```

**File**: `platforms/macos/Sources/Services/CloudflaredService.swift` (modified, +17/-9)
```diff
@@ -102,17 +102,25 @@ actor CloudflaredService {
             let handle = pipe.fileHandleForReading
 
             while !Task.isCancelled {
-                let data = handle.availableData
-                if data.isEmpty { break }
-
-                if let output = String(data: data, encoding: .utf8)?
-                    .trimmingCharacters(in: .whitespacesAndNewlines),
-                   !output.isEmpty {
-                    let lines = output.components(separatedBy: .newlines)
-                    for line in lines where !line.isEmpty {
-                        await self?.parseLine(line, for: id)
+                // Use autoreleasepool to prevent memory accumulation from FileHandle reads
+                var output: String = ""
+                autoreleasepool {
+                    let data = handle.availableData
+                    if data.isEmpty {
+                        output = ""
+                    } else {
+                        output = String(data: data, encoding: .utf8)?
+                            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                     }
                 }
+
+                if output.isEmpty { break }
+
+                // Use split for zero-copy iteration
+                let lines = output.split(separator: "\n", omittingEmptySubsequences: true)
+                for line in lines {
+                    await self?.parseLine(String(line), for: id)
+                }
             }
         }
         outputTasks[id] = task
```

**File**: `platforms/macos/Sources/Services/DependencyChecker.swift` (modified, +6/-2)
```diff
@@ -143,8 +143,12 @@ actor DependencyChecker {
             try process.run()
             process.waitUntilExit()
 
-            let data = pipe.fileHandleForReading.readDataToEndOfFile()
-            let output = String(data: data, encoding: .utf8) ?? ""
+            // Use autoreleasepool to prevent memory accumulation
+            var output: String = ""
+            autoreleasepool {
+                let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                output = String(data: data, encoding: .utf8) ?? ""
+            }
 
             return process.terminationStatus == 0 ? (true, "Installed") : (false, output)
         } catch {
```

**File**: `platforms/macos/Sources/Views/Components/CloudflaredMissingBanner.swift` (modified, +10/-3)
```diff
@@ -140,14 +140,21 @@ struct CloudflaredMissingBanner: View {
                 try process.run()
                 process.waitUntilExit()
 
+                // Use autoreleasepool to prevent memory accumulation
+                var errorOutput: String = ""
+                if process.terminationStatus != 0 {
+                    autoreleasepool {
+                        let data = pipe.fileHandleForReading.readDataToEndOfFile()
+                        errorOutput = String(data: data, encoding: .utf8) ?? "Unknown error"
+                    }
+                }
+
                 await MainActor.run {
                     isInstalling = false
                     if process.terminationStatus == 0 {
                         appState.tunnelManager.recheckInstallation()
                     } else {
-                        let data = pipe.fileHandleForReading.readDataToEndOfFile()
-                        let output = String(data: data, encoding: .utf8) ?? "Unknown error"
-                        installError = "Installation failed: \(output.prefix(100))"
+                        installError = "Installation failed: \(errorOutput.prefix(100))"
                     }
                 }
             } catch {
```

---

### Incident Patch 13: `1bc09442` (2026-01-14)
**Commit Message**: refactor: optimize string handling in PortScanner for zero-copy memory access

**File**: `platforms/macos/Package.swift` (modified, +4/-1)
```diff
@@ -33,7 +33,10 @@ let package = Package(
                 .enableExperimentalFeature("NonisolatedNonsendingByDefault"),
                 .enableExperimentalFeature("InlineArrayTypeSugar"),
                 // Default MainActor isolation - reduces boilerplate, prevents actor hops
-                .enableUpcomingFeature("DefaultIsolationMainActor")
+                .enableUpcomingFeature("DefaultIsolationMainActor"),
+                // Enable Span types for zero-copy memory access (Swift 6.2+)
+                .enableExperimentalFeature("LifetimeDependence"),
+                .enableExperimentalFeature("Span")
             ]
         ),
         .testTarget(
```

**File**: `platforms/macos/Sources/PortScanner.swift` (modified, +10/-7)
```diff
@@ -91,10 +91,12 @@ actor PortScanner: PortScannerProtocol {
             }
 
             var commands: [Int: String] = [:]
-            let lines = output.components(separatedBy: .newlines)
+            // Use split for zero-copy Substring iteration
+            let lines = output.split(separator: "\n", omittingEmptySubsequences: false)
 
             for line in lines.dropFirst() {
-                let trimmed = line.trimmingCharacters(in: .whitespaces)
+                // Trim whitespace using Substring operations
+                let trimmed = line.drop(while: { $0.isWhitespace })
                 guard !trimmed.isEmpty else { continue }
 
                 let parts = trimmed.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
@@ -135,7 +137,8 @@ actor PortScanner: PortScannerProtocol {
     nonisolated private func parseLsofOutput(_ output: String, commands: [Int: String]) -> [PortInfo] {
         var ports: [PortInfo] = []
         var seen: Set<String> = []
-        let lines = output.components(separatedBy: .newlines)
+        // Use split for zero-copy Substring iteration (no allocation per line)
+        let lines = output.split(separator: "\n", omittingEmptySubsequences: false)
 
         // Skip header line and process each data line
         for line in lines.dropFirst() {
@@ -156,7 +159,7 @@ actor PortScanner: PortScannerProtocol {
 
             guard let pid = Int(components[1]) else { continue }
 
-            // User name
+            // User name - use Substring directly where possible
             let user = String(components[2])
 
             // File descriptor
@@ -166,9 +169,9 @@ actor PortScanner: PortScannerProtocol {
             // It's usually the second-to-last column, before "(LISTEN)"
             // Format: "127.0.0.1:3000", "*:8080", or "[::1]:3000"
             // We search backwards to find a component with ":" that isn't a device ID
-            var addressPart = ""
+            var addressPart: Substring = ""
             for i in stride(from: components.count - 1, through: 8, by: -1) {
-                let comp = String(components[i])
+                let comp = components[i]
                 // Skip device IDs (0x...) and sizes (0t...)
                 if comp.contains(":") && !comp.hasPrefix("0x") && !comp.hasPrefix("0t") {
                     addressPart = comp
@@ -181,7 +184,7 @@ actor PortScanner: PortScannerProtocol {
             // Get full command from ps output
             let command = commands[pid] ?? processName
 
-            guard let portInfo = parseAddress(addressPart, processName: processName, pid: pid, user: user, command: command, fd: fd) else {
+            guard let portInfo = parseAddress(String(addressPart), processName: processName, pid: pid, user: user, command: command, fd: fd) else {
                 continue
             }
 
```

---

### Incident Patch 14: `eedb36d3` (2026-01-14)
**Commit Message**: fix: update build script to fetch dependencies without full build

**File**: `.github/workflows/ci.yml` (modified, +1/-3)
```diff
@@ -42,6 +42,7 @@ jobs:
           path: |
             platforms/macos/.build
             ~/Library/Caches/org.swift.swiftpm
+            /tmp/Sparkle-2.8.1
           key: ${{ runner.os }}-spm-${{ hashFiles('platforms/macos/Package.resolved') }}
           restore-keys: |
             ${{ runner.os }}-spm-
@@ -58,9 +59,6 @@ jobs:
             echo "No compiler warnings."
           fi
 
-      - name: Build (Release)
-        run: swift build -c release
-
       - name: Run Tests
         run: swift test --parallel
 
```

**File**: `platforms/macos/scripts/build-app.sh` (modified, +3/-3)
```diff
@@ -14,9 +14,9 @@ CONTENTS_DIR="$APP_DIR/Contents"
 MACOS_DIR="$CONTENTS_DIR/MacOS"
 RESOURCES_DIR="$CONTENTS_DIR/Resources"
 
-# First build to fetch dependencies
-echo "🔨 Building release binary (fetching dependencies)..."
-swift build -c release --arch arm64 --arch x86_64
+# Fetch dependencies (no need for full build)
+echo "📦 Fetching dependencies..."
+swift package resolve
 
 # Patch the CHECKOUT source files directly (not DerivedSources which gets regenerated)
 # This patches the actual library code before the final build
```

---

### Incident Patch 15: `14296008` (2026-01-05)
**Commit Message**: fix: remove command string truncation from data layer and move truncation logic to view layer (#79)

Co-authored-by: zhaodongjin <[REDACTED_EMAIL]>

**File**: `Sources/PortScanner.swift` (modified, +1/-2)
```diff
@@ -62,7 +62,6 @@ actor PortScanner {
      * Executes: `ps -axo pid,command`
      *
      * This provides more detailed command information than lsof alone.
-     * Commands longer than 200 characters are truncated with "...".
      *
      * @returns Dictionary mapping PID to full command string
      */
@@ -102,7 +101,7 @@ actor PortScanner {
                       let pid = Int(parts[0]) else { continue }
 
                 let fullCommand = String(parts[1])
-                commands[pid] = fullCommand.count > 200 ? String(fullCommand.prefix(200)) + "..." : fullCommand
+                commands[pid] = fullCommand
             }
 
             return commands
```

**File**: `Sources/Views/PortDetailView.swift` (modified, +3/-1)
```diff
@@ -145,7 +145,9 @@ struct PortDetailView: View {
                 .controlSize(.small)
             }
 
-            Text(port.command)
+            Text(port.command.count > AppConstants.maxCommandLength
+                ? String(port.command.prefix(AppConstants.maxCommandLength)) + "..."
+                : port.command)
                 .font(.system(.caption, design: .monospaced))
                 .foregroundStyle(.secondary)
                 .textSelection(.enabled)
```

#### Recent Merged Pull Requests:
- **PR #112** (closed): feat(linux): native tray app, Rust core and AppImage releases (@productdevbook)
- **PR #111** (2026-07-24): feat(linux): native tray application and Linux process scanner (@raine1120)
- **PR #110** (closed): feat(linux): cross-platform support and modular tray application (@raine1120)
- **PR #109** (2026-06-21): fix: Use latest homebrew syntax for macos "depends on" (@builtbyleo)
- **PR #108** (2026-06-13): feat: support named Cloudflare tunnels (@OhThatMatt)
- **PR #106** (2026-03-09): feat: add request log monitoring for Cloudflare tunnels (@productdevbook)
- **PR #105** (2026-03-09): feat: add auto-kill rules for idle ports (@productdevbook)
- **PR #104** (2026-03-09): feat: add onboarding wizard for first-time users (@productdevbook)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
