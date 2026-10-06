# Forensic Learning Record (Deep Inspection): thaw-app/Thaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/thaw-app-thaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/thaw-app/Thaw](https://github.com/thaw-app/Thaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:44.990Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thaw-app/Thaw`
- **Description**: The open source menu bar manager
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11769 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Shared/Utilities/AXHelpers.swift`
```
//
//  AXHelpers.swift
//  Project: Thaw
//
//  Copyright (Ice) © 2023–2025 Jordan Baird
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import AXSwift6
import Cocoa

nonisolated enum AXHelpers {
    @discardableResult
    static func isProcessTrusted(prompt: Bool = false) -> Bool {
        checkIsProcessTrusted(prompt: prompt)
    }

    static func element(at point: CGPoint) -> UIElement? {
        try? systemWideElement.elementAtPosition(Float(point.x), Float(point.y))
    }

    static func application(for runningApp: NSRunningApplication) -> Application? {
        Application(runningApp)
    }

    static func extrasMenuBar(for app: Application) -> UIElement? {
        try? app.attribute(.extrasMenuBar)
    }

    static func children(for element: UIElement) -> [UIElement] {
        (try? element.arrayAttribute(.children)) ?? []
    }

    static func isEnabled(_ element: UIElement) -> Bool {
        (try? element.attribute(.enabled)) ?? false
    }

    /// The raw AXEnabled attribute, or nil when the element does not expose it.
    /// Unlike isEnabled, this tells a missing attribute from an explicit false.
    static func enabledAttribute(_ element: UIElement) -> Bool? {
        try? element.attribute(.enabled)
    }

    static func frame(for element: UIElement) -> CGRect? {
        try? element.attribute(.frame)
    }

    /// The element's `AXIdentifier` attribute (e.g. `com.apple.menuextra.wifi`
    /// for a Control Center-hosted module), when the element publishes one.
    static func identifier(for element: UIElement) -> String? {
        try? element.attribute(.identifier)
    }

    /// The element's `AXHelp` attribute (tooltip/description string).
    static func help(for element: UIElement) -> String? {
        try? element.attribute(.help)
    }

    /// The element's `AXTitle` attribute.
    static func title(for element: UIElement) -> String? {
        try? element.attribute(.title)
    }

    static func role(for element: UIElement) -> Role? {
        try? element.role()
    }

    static func pid(for element: UIElement) -> pid_t? {
        try? element.pid()
    }

    /// Performs the press action on the given element, returning whether it
    /// succeeded. Used to open the menus of Electron/Chromium tray items, which
    /// ignore synthetic mouse clicks.
    @discardableResult
    static func press(_ element: UIElement) -> Bool {
        do {
            try element.performAction(.press)
            return true
        } catch {
            return false
        }
    }
}

```

### Core Architecture Module: `Shared/Utilities/CodeSigningInfo.swift`
```
//
//  CodeSigningInfo.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Security

nonisolated enum CodeSigningInfo {
    /// The team identifier of the current process, or `nil` when signed
    /// without one (ad-hoc), in which case a same-team peer requirement can't pass.
    static let processTeamIdentifier: String? = {
        var code: SecCode?
        guard SecCodeCopySelf([], &code) == errSecSuccess, let code else { return nil }
        var staticCode: SecStaticCode?
        guard SecCodeCopyStaticCode(code, [], &staticCode) == errSecSuccess, let staticCode else { return nil }
        var info: CFDictionary?
        let flags = SecCSFlags(rawValue: kSecCSSigningInformation)
        guard SecCodeCopySigningInformation(staticCode, flags, &info) == errSecSuccess,
              let dict = info as? [String: Any]
        else {
            return nil
        }
        return dict[kSecCodeInfoTeamIdentifier as String] as? String
    }()
}

```

### Core Architecture Module: `Shared/Utilities/DiagnosticLogger.swift`
```
//
//  DiagnosticLogger.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Foundation
import OSLog

/// Writes log messages to a file when diagnostic logging is enabled, so users
/// can capture debug logs without a debug build.
///
/// Log files are written to `~/Library/Logs/Thaw/`.
final nonisolated class DiagnosticLogger: @unchecked Sendable {
    static let shared = DiagnosticLogger()

    /// Whether diagnostic logging to file is currently enabled.
    /// Thread-safe via OSAllocatedUnfairLock.
    private let isEnabledLock = OSAllocatedUnfairLock(initialState: false)

    var isEnabled: Bool {
        get { isEnabledLock.withLock { $0 } }
        set {
            // Runs on `writeQueue`, ordered against queued writes: swapping the
            // handle off-queue could drop an accepted message or send it to the
            // wrong file. Concurrent toggles can't interleave; the last one wins.
            writeQueue.sync {
                let wasEnabled = isEnabledLock.withLock { $0 }
                guard newValue != wasEnabled else { return }
                if newValue {
                    openLogFile()
                } else {
                    // Stop accepting writes before the footer is written, so no
                    // line can land after it.
                    isEnabledLock.withLock { $0 = false }
                    closeLogFile()
                }
            }
        }
    }

    /// The directory where log files are stored.
    var logDirectory: URL {
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Logs", isDirectory: true)
            .appendingPathComponent("Thaw", isDirectory: true)
    }

    /// Returns whether any log files exist in the log directory.
    var hasLogFiles: Bool {
        latestLogFile != nil
    }

    /// Returns the most recent log file in the log directory, if any.
    var latestLogFile: URL? {
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: logDirectory,
            includingPropertiesForKeys: [.creationDateKey],
            options: .skipsHiddenFiles
        ) else {
            return nil
        }
        return contents
            .filter { $0.pathExtension == "log" }
            .sorted { a, b in
                let dateA = (try? a.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? .distantPast
                let dateB = (try? b.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? .distantPast
                return dateA > dateB
            }
            .first
    }

    /// The current log file URL, if logging is active.
    private let currentLogFileLock = OSAllocatedUnfairLock<URL?>(initialState: nil)

    var currentLogFile: URL? {
        currentLogFileLock.withLock { $0 }
    }

    /// A bounded text view of the newest bytes in one diagnostic log file.
    struct TailSnapshot: Equatable {
        /// The log file that was read.
        let fileURL: URL

        /// UTF-8 decoded text from the bounded tail window.
        let text: String
    }

    private let fileHandleLock = OSAllocatedUnfairLock<FileHandle?>(initialState: nil)

    /// Internal logger for DiagnosticLogger's own messages.
    private let osLog = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.stonerl.Thaw",
        category: "DiagnosticLogger"
    )

    private let timestampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private let fileNameFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    /// Serial queue for file I/O.
    private let writeQueue = DispatchQueue(
        label: "com.stonerl.Thaw.DiagnosticLogger.writeQueue",
        qos: .utility
    )

    // MARK: - Rotation State

    /// How the log file is rotated and how long old files are kept.
    ///
    /// Set by the app and sent to the XPC targets with the log path, so both
    /// prune by the same rules. Only the process that mints a file rotates it.
    struct RotationPolicy: Codable, Equatable, Sendable {
        /// Rotate once the file reaches this size. `0` disables size rotation.
        var maxFileSizeBytes: UInt64 = 0
        /// Rotate this many seconds after the segment was opened. `0` disables
        /// time rotation.
        var rotationInterval: TimeInterval = 0
        /// Delete log files older than this many days.
        var retentionDays: Int = 2
        /// Never keep more than this many log files, so a small size limit
        /// cannot pile up hundreds of segments inside the retention window.
        var maxFileCount: Int = 50

        /// The widest values any of these settings may take.
        ///
        /// Far above anything the settings UI offers; they only stop external
        /// values from overflowing the arithmetic.
        static let maxRetentionDays = 3650
        static let maxRetainedFileCount = 10000
        static let maxRotationInterval: TimeInterval = 365 * 86400
        static let maxSizeBytes: UInt64 = 1 << 40 // 1 TiB

        /// Returns the policy with every field forced into a usable range.
        ///
        /// A policy can arrive over XPC, and ad-hoc builds have no peer
        /// requirement. Unchecked, a negative retention or zero count deletes
        /// every log, `Int.min` traps, and a non-finite interval breaks the timer.
        func sanitized() -> RotationPolicy {
            var policy = self
            policy.retentionDays = min(max(1, retentionDays), Self.maxRetentionDays)
            policy.maxFileCount = min(max(1, maxFileCount), Self.maxRetainedFileCount)
            policy.maxFileSizeBytes = min(maxFileSizeBytes, Self.maxSizeBytes)
            policy.rotationInterval = rotationInterval.isFinite
                ? min(max(0, rotationInterval), Self.maxRotationInterval)
                : 0
            return policy
        }
    }

    private let policyLock = OSAllocatedUnfairLock(initialState: RotationPolicy())

    /// The current rotation policy.
    var rotationPolicy: RotationPolicy {
        policyLock.withLock { $0 }
    }

    /// Updates the rotation policy and reschedules the maintenance timer.
    ///
    /// Sanitized here because one caller is an untrusted XPC peer.
    func setRotationPolicy(_ policy: RotationPolicy) {
        policyLock.withLock { $0 = policy.sanitized() }
        writeQueue.async { [weak self] in
            self?.rescheduleMaintenanceTimer()
        }
    }

    /// Whether this process owns rotation and pruning. True only in the process
    /// that minted the file via `openLogFile()`; the XPC target attaches to a
    /// path handed to it and merely follows.
    private let isRotationOwnerLock = OSAllocatedUnfairLock(initialState: false)

    /// Called after the owner rotates, so the app can repoint the XPC service.
    /// A closure because `Shared` can't reach the app-only connection. Takes no
    /// argument: reading ``currentLogFile`` at send time avoids pushing a stale path.
    private let onRotateLock = OSAllocatedUnfairLock<(@Sendable () -> Void)?>(initialState: nil)

    var onRotate: (@Sendable () -> Void)? {
        get { onRotateLock.withLock { $0 } }
        set { onRotateLock.withLock { $0 = newValue } }
    }

    /// Timer that polls file size and elapsed time. `writeQueue` only.
    private var maintenanceTimer: DispatchSourceTimer?

    /// When the current segment was opened, on a clock that does not move when
    /// the user or the network changes the system time. `writeQueue` only.
    private var segmentOpenedAt = ContinuousClock.now

    /// Bytes this process has written since the last size check, used to
    /// throttle `fstat` on the hot write path. `writeQueue` only.
    private var bytesSinceSizeCheck = 0

    private init() {
        // Intentionally empty: `DiagnosticLogger` is a singleton, and log file setup is deferred until logging is enabled.
    }

    // MARK: - File Management

    /// Enables diagnostic logging to a file chosen by another process. The XPC
    /// services call this with the app's path so both append to one file.
    /// Safe to call repeatedly.
    ///
    /// - Returns: Whether this process is now writing to `fileURL`. On `false`
    ///   the previous segment is still in use, and the caller must report it.
    @discardableResult
    func attachToFile(at fileURL: URL) -> Bool {
        // Attaching follows a path chosen elsewhere, so this process never owns
        // rotation or pruning.
        isRotationOwnerLock.withLock { $0 = false }
        // Swap on the write queue (see `isEnabled`). A failed open keeps the
        // current segment.
        return writeQueue.sync {
            // The same path can arrive twice; re-opening would write a spurious
            // header and footer into the live file.
            let alreadyAttached = currentLogFileLock.withLock { $0 == fileURL }
                && fileHandleLock.withLock { $0 != nil }
            guard !alreadyAttached else { return true }
            return openLogFile(at: fileURL)
        }
    }

    /// Opens a freshly minted log file. The app calls this when logging is
    /// turned on, then shares the URL via attachToFile(at:).
    private func openLogFile() {
        // The process that mints the file owns rotation and pruning.
        isRotationOwnerLock.withLock { $0 = true }

        let dir = logDirectory
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        } catch {
            osLog.error("Faile
```

### Core Architecture Module: `Shared/Utilities/ExtrasMenuBarNegativeCachePolicy.swift`
```
//
//  ExtrasMenuBarNegativeCachePolicy.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

/// TTL ladder for the per-application extras-menu-bar negative cache.
///
/// Only ~16 of ~170 running apps have an extras menu bar, and each AX read
/// blocks the target app's main thread, so a wide scan stutters the system.
/// A "no result" flag cleared on every cleanup was useless, since cleanup runs
/// on any process launch or exit (~9s). Backoff deadlines replace it: early
/// rungs catch late status items, later ones stop re-probing empty apps.
nonisolated enum ExtrasMenuBarNegativeCachePolicy {
    /// How long an application that reported no extras menu bar is skipped,
    /// after `misses` consecutive checks have come back empty (1 = the first
    /// miss).
    ///
    /// Values at or below 1 clamp to the first rung, so errors mean more scanning.
    static func ttl(afterConsecutiveMisses misses: Int) -> Duration {
        switch misses {
        case ...1: .seconds(5)
        case 2: .seconds(30)
        case 3: .seconds(120)
        default: .seconds(300)
        }
    }
}

```

### Core Architecture Module: `Shared/Utilities/ExtrasMenuBarProbeMemory.swift`
```
//
//  ExtrasMenuBarProbeMemory.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Foundation

/// What the extras-menu-bar probe learned about each application in earlier
/// sessions, so a cold start does not pay to learn it again.
///
/// Without it the first scan of each launch probes every app over AX (3.85s
/// in #956), right while the layout restores. An app with no extras menu bar
/// last session almost certainly has none now.
///
/// This memory only reorders work and never produces an answer: a skip leaves
/// items unresolved for one scan, never attributed to the wrong owner.
nonisolated enum ExtrasMenuBarProbeMemory {
    /// The largest number of remembered applications kept.
    ///
    /// A busy system runs ~170 applications; this only bounds growth.
    static let capacity = 1024

    /// How many consecutive misses an application must have accumulated
    /// before the result is worth remembering across launches.
    ///
    /// One miss is not evidence: an app still launching or wedged reports none,
    /// and `getOrCreateExtrasMenuBar()` can't detect every such case.
    static let minimumMissesToRemember = 2

    /// The largest miss count stored.
    ///
    /// `ExtrasMenuBarNegativeCachePolicy.ttl(afterConsecutiveMisses:)`
    /// saturates at its top rung.
    static let maximumRememberedMisses = 4

    /// The state a freshly created cache entry should adopt for an
    /// application the memory has an opinion about, or `nil` when it has
    /// none worth acting on.
    ///
    /// The deadline is the *first* rung, not the one the count earns: enough to
    /// skip the cold-start scan, not enough to miss an app that gained a status
    /// item. The seeded count lets a repeat miss resume the ladder where it left off.
    static func seed(forRememberedMisses misses: Int?) -> (misses: Int, initialTTL: Duration)? {
        guard let misses, misses >= minimumMissesToRemember else {
            return nil
        }
        return (
            misses: min(misses, maximumRememberedMisses),
            initialTTL: ExtrasMenuBarNegativeCachePolicy.ttl(afterConsecutiveMisses: 1)
        )
    }

    /// The memory to persist, given what was already stored and what this
    /// session observed.
    ///
    /// - Parameters:
    ///   - persisted: The memory as it was last written.
    ///   - observed: Consecutive misses per bundle identifier for the
    ///     applications running now. Zero means the application has an extras
    ///     menu bar, since finding one resets the count.
    ///   - runningBundleIDs: The applications running now, used to decide
    ///     what to evict when the memory is over capacity.
    ///
    /// An observation always wins over what was stored, so an app that now has
    /// an extras menu bar loses its entry outright.
    static func merged(
        persisted: [String: Int],
        observed: [String: Int],
        runningBundleIDs: Set<String>
    ) -> [String: Int] {
        var merged = persisted

        for (bundleID, misses) in observed {
            if misses >= minimumMissesToRemember {
                merged[bundleID] = min(misses, maximumRememberedMisses)
            } else {
                merged.removeValue(forKey: bundleID)
            }
        }

        guard merged.count > capacity else {
            return merged
        }
        // Keep everything running now; evict the rest, like `MenuBarItemNameMemory`.
        return merged.filter { runningBundleIDs.contains($0.key) }
    }
}

```

### Core Architecture Module: `Shared/Utilities/MarkerPairResolver.swift`
```
//
//  MarkerPairResolver.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import CoreGraphics
import Foundation

/// Pairs unresolved on-screen menu bar icons with bundle-ID-titled
/// marker windows so their NSStatusItem sourcePIDs can be recovered
/// after the spatial AX pass fails.
///
/// On macOS 26 some widgets (Little Snitch's agent) are hosted by Control
/// Center at the AX layer with no AXExtrasMenuBar, so sourcePID stays nil and
/// the namespace collides with com.apple.controlcenter. Each such widget also
/// publishes a second CG window titled with its bundle ID and the icon's width
/// (heights differ). Lookups are injected so the algorithm stays pure.
nonisolated enum MarkerPairResolver {
    /// A marker window candidate distilled from the items-only list.
    /// Markers carry bundle-ID-shaped titles (titles containing a ".")
    /// and serve as the recovery handle for paired on-screen icons.
    struct Marker: Equatable {
        let windowID: CGWindowID
        let size: CGSize
        let title: String
        /// CG-layer kCGWindowOwnerPID. Preferred PID source when it
        /// resolves to a bundle ID that is not Control Center or Thaw.
        let owningPID: pid_t?
    }

    /// A candidate icon: an on-screen menu bar window with a non-
    /// bundle-ID-shaped title that needs PID resolution.
    struct UnresolvedIcon: Equatable {
        let windowID: CGWindowID
        let title: String?
        let size: CGSize
    }

    /// One successful resolution: which icon resolved to which PID,
    /// via which marker.
    struct Resolution: Equatable {
        let iconWindowID: CGWindowID
        let resolvedPID: pid_t
        let markerWindowID: CGWindowID
        let markerTitle: String
    }

    /// Pairs unresolved icons with same-size marker windows and
    /// resolves each icon to a sourcePID via the marker. The pairing
    /// must be unique in *both* directions: a width matching more than
    /// one marker is ambiguous, and so is a width shared by more than
    /// one unresolved icon. Thaw and Control Center are excluded from
    /// the resolution paths so a marker hosted by either does not
    /// collapse the resolution back to those PIDs.
    ///
    /// Both halves matter: checking only markers let one marker resolve five
    /// icons, stamping CC's Sound and Wi-Fi with a third-party bundle ID. A
    /// wrong PID is worse than none: it renames the item and slips past the
    /// unresolved-sourcePID gates.
    ///
    /// - Parameters:
    ///   - unresolvedIcons: candidate on-screen icons. Icons whose own
    ///     title is bundle-ID-shaped (contains a dot) are skipped so
    ///     two markers cannot pair with each other.
    ///   - markers: bundle-ID-titled marker windows extracted from the
    ///     items-only list. Callers are expected to pre-filter Thaw
    ///     control items and the Thaw self-registration window.
    ///   - thawBundleID: Thaw's own bundle identifier; excluded from
    ///     both resolution paths.
    ///   - ccBundleID: Control Center's bundle identifier; excluded
    ///     from the marker's owning-PID resolution path.
    ///   - pidToBundleID: closure mapping a PID to its bundle ID,
    ///     mirroring NSRunningApplication(processIdentifier:).
    ///   - bundleIDToPID: closure mapping a bundle ID to a running
    ///     app's PID, mirroring NSRunningApplication.
    ///     runningApplications(withBundleIdentifier:).first?.
    ///     processIdentifier.
    /// - Returns: one Resolution per successfully resolved icon.
    static func resolve(
        unresolvedIcons: [UnresolvedIcon],
        markers: [Marker],
        thawBundleID: String,
        ccBundleID: String,
        pidToBundleID: (pid_t) -> String?,
        bundleIDToPID: (String) -> pid_t?
    ) -> [Resolution] {
        // Icons with bundle-ID-shaped titles are markers, not candidates.
        let candidates = unresolvedIcons.filter { icon in
            guard let title = icon.title else { return true }
            return !title.contains(".")
        }

        // When several candidates share a width, none resolve.
        var candidatesPerWidth = [CGFloat: Int]()
        for icon in candidates {
            candidatesPerWidth[icon.size.width, default: 0] += 1
        }

        var result = [Resolution]()
        for icon in candidates {
            guard candidatesPerWidth[icon.size.width] == 1 else { continue }

            // Match by width only: the icon takes the menu bar height (22-30pt)
            // while the marker has a placeholder height (33pt). The two
            // uniqueness checks still prevent misattribution.
            let matching = markers.filter {
                $0.windowID != icon.windowID && $0.size.width == icon.size.width
            }
            guard matching.count == 1, let marker = matching.first else { continue }

            let resolvedPID: pid_t? = {
                if let pid = marker.owningPID,
                   let bundleID = pidToBundleID(pid),
                   bundleID != ccBundleID,
                   bundleID != thawBundleID
                {
                    return pid
                }
                if let pid = bundleIDToPID(marker.title),
                   let bundleID = pidToBundleID(pid),
                   bundleID != ccBundleID,
                   bundleID != thawBundleID
                {
                    return pid
                }
                return nil
            }()

            guard let pid = resolvedPID else { continue }
            result.append(Resolution(
                iconWindowID: icon.windowID,
                resolvedPID: pid,
                markerWindowID: marker.windowID,
                markerTitle: marker.title
            ))
        }
        return result
    }

    /// Extracts marker candidates from raw items-only windows. A
    /// window qualifies as a marker if its title contains a dot
    /// (bundle-identifier shape), is not a Thaw control item, and is
    /// not the Thaw self-registration window.
    static func extractMarkers(
        from windows: [(windowID: CGWindowID, title: String?, size: CGSize, owningPID: pid_t?)],
        thawControlItemPrefix: String,
        thawBundleID: String
    ) -> [Marker] {
        windows.compactMap { window in
            guard let title = window.title, title.contains(".") else { return nil }
            if title.hasPrefix(thawControlItemPrefix) {
                return nil
            }
            if title == thawBundleID {
                return nil
            }
            return Marker(
                windowID: window.windowID,
                size: window.size,
                title: title,
                owningPID: window.owningPID
            )
        }
    }

    /// True when a CG window title has the generic Item-N shape macOS assigns to
    /// Control-Center-hosted items that publish no name of their own (Item-0,
    /// Item-38, ...). Shared by MenuBarItemTag.isControlCenterGenericItem and
    /// isCCHostedGenericSlot so the two can't drift.
    static func isGenericControlCenterTitle(_ title: String?) -> Bool {
        guard let title else { return false }
        return title.wholeMatch(of: /Item-\d+/) != nil
    }

    /// Returns true when a strict 1pt match only confirms Control Center
    /// hosting of a generic Item-N slot. CC's PID would mark it a transient CC
    /// widget that can't be hidden, so it is left for marker-pair.
    ///
    /// On one display the markers may never publish, leaving the item
    /// unresolved for the session; that beats a permanent mislabel. Named CC
    /// items (Clock, WiFi) and widgets with their own extras child are unaffected.
    static func isCCHostedGenericSlot(
        appBundleID: String?,
        windowTitle: String?,
        ccBundleID: String
    ) -> Bool {
        appBundleID == ccBundleID && isGenericControlCenterTitle(windowTitle)
    }
}

/// Decides whether a Control Center-hosted window's title names its owning
/// app. Corroborates SourcePIDCache's loose spatial fallback (AirBuddy ~2pt
/// off, SpamSieve ~8pt) so a nearby unrelated neighbor is never attributed.
nonisolated enum HostedItemOwnership {
    /// Returns the single running bundle identifier a window title names
    /// outright, or `nil`. Case-insensitive.
    ///
    /// Unlike ``titleIndicatesOwner(_:bundleID:)``, exact equality needs no
    /// spatial corroboration, which CC-hosted items can never supply (#854).
    /// Requiring a unique match rules out two processes sharing an identifier.
    static func exactlyNamedOwner(_ title: String?, runningBundleIDs: [String]) -> String? {
        guard let title, !title.isEmpty else { return nil }
        let needle = title.lowercased()
        // A bundle identifier has at least two components; without this a
        // one-word slot title could match a malformed identifier.
        guard needle.split(separator: ".", omittingEmptySubsequences: false).count >= 2 else {
            return nil
        }
        let matches = runningBundleIDs.filter { $0.lowercased() == needle }
        guard matches.count == 1 else { return nil }
        return matches[0]
    }

    /// Returns true when title and bundleID, as reverse-DNS strings, agree on
    /// at least two leading components and either one is a component-prefix of
    /// the other or their first differing component is a prefix of its
    /// counterpart. Case-insensitive.
    ///
    /// Matches codes.rambo.AirBuddy.Menu to codes.rambo.AirBuddyHelper; rejects
    /// pl.maketheweb.pixelsnap2 vs pl.maketheweb.cleanshotx. A title with no
    /// dots qualifies only as the bundle's final component (BetterTouchTool).
    static func titleIndicatesOwner(_ title: String?, bundleID: String) -> Bool {
        guard let title, !title.isEmpty else { return false }
        let titleParts = title.lowercased().split(separator: ".", omitti
```

### Core Architecture Module: `Shared/Utilities/SharedConstants.swift`
```
//
//  SharedConstants.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Foundation

/// Constants shared across all targets (main app and XPC services).
/// Only values that are needed in every target belong here; app-only
/// constants live in `Constants` (Thaw target).
nonisolated enum SharedConstants {
    // MARK: - System Framework Paths

    /// Info.plist key used to configure the SkyLight private framework path.
    static let skyLightFrameworkPathInfoPlistKey = "ThawSkyLightFrameworkPath"

    /// Path to the SkyLight private framework for window capture APIs.
    static let skyLightFrameworkPath: String = requiredInfoPlistString(skyLightFrameworkPathInfoPlistKey)

    // MARK: - Accessibility

    /// Ceiling, in seconds, on a single accessibility message.
    ///
    /// AX calls are synchronous IPC, so a stalled app blocks us for the
    /// six-second system default (#767). Healthy calls take well under 100 ms.
    /// The app applies it in `applicationWillFinishLaunching` (overridable via
    /// `axMessagingTimeout`); `MenuBarItemService` uses it directly.
    static let axMessagingTimeout = 1.0

    // MARK: - Menu Bar Host

    /// Bundle identifier of the process that hosts the menu bar's status
    /// items on this OS. Maintenance tools use it to locate (and reset) the
    /// preference domain holding every saved status-item position.
    static let menuBarHostingBundleID = "com.apple.controlcenter"

    // MARK: - Helpers

    /// Returns a required string from the bundle's Info.plist.
    private static func requiredInfoPlistString(_ key: String) -> String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else {
            fatalError("Missing or invalid Info.plist string for key: \(key)")
        }
        return value
    }
}

```

### Core Architecture Module: `Shared/Utilities/SharedExtensions.swift`
```
//
//  SharedExtensions.swift
//  Project: Thaw
//
//  Copyright (Ice) © 2023–2025 Jordan Baird
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import CoreGraphics
import Dispatch

// MARK: - CGError

nonisolated extension CGError {
    /// A string to use for logging purposes.
    nonisolated var logString: String {
        switch self {
        case .success: "\(rawValue): success"
        case .failure: "\(rawValue): failure"
        case .illegalArgument: "\(rawValue): illegalArgument"
        case .invalidConnection: "\(rawValue): invalidConnection"
        case .invalidContext: "\(rawValue): invalidContext"
        case .cannotComplete: "\(rawValue): cannotComplete"
        case .notImplemented: "\(rawValue): notImplemented"
        case .rangeCheck: "\(rawValue): rangeCheck"
        case .typeCheck: "\(rawValue): typeCheck"
        case .invalidOperation: "\(rawValue): invalidOperation"
        case .noneAvailable: "\(rawValue): noneAvailable"
        @unknown default: "\(rawValue): unknown"
        }
    }
}

// MARK: - CGPoint

nonisolated extension CGPoint {
    /// Returns the distance between this point and another point.
    func distance(to other: CGPoint) -> CGFloat {
        hypot(x - other.x, y - other.y)
    }
}

// MARK: - CGRect

nonisolated extension CGRect {
    /// The center point of the rectangle.
    var center: CGPoint {
        CGPoint(x: midX, y: midY)
    }
}

// MARK: - DispatchQueue

nonisolated extension DispatchQueue {
    /// Creates and returns a new dispatch queue that targets the global
    /// system queue with the specified quality-of-service class.
    static func targetingGlobal(
        label: String,
        qos: DispatchQoS.QoSClass = .default,
        attributes: Attributes = []
    ) -> DispatchQueue {
        let target = DispatchQueue.global(qos: qos)
        return DispatchQueue(label: label, attributes: attributes, target: target)
    }
}

```

### Core Architecture Module: `Shared/Utilities/SourcePIDNegativeCachePolicy.swift`
```
//
//  SourcePIDNegativeCachePolicy.swift
//  Project: Thaw
//
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

/// TTL ladder for the source-PID negative cache.
///
/// The first AX scan after launch under-resolves while other apps' trees warm
/// up, and the app's requests are front-loaded into its startup window. A flat
/// TTL outlasts every retry and the cache never converges, so early failures
/// get short deadlines and repeats back off to the steady-state TTL.
nonisolated enum SourcePIDNegativeCachePolicy {
    /// The negative-cache deadline applied after `failures` consecutive
    /// full scans have left a window unresolved (1 = the first failure).
    ///
    /// Values at or below 1 clamp to the first rung, so errors mean more scanning.
    static func ttl(afterConsecutiveFailures failures: Int) -> Duration {
        switch failures {
        case ...1: .seconds(5)
        case 2: .seconds(15)
        default: .seconds(60)
        }
    }
}

```

### Core Architecture Module: `Shared/Utilities/WindowInfo.swift`
```
//
//  WindowInfo.swift
//  Project: Thaw
//
//  Copyright (Ice) © 2023–2025 Jordan Baird
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Cocoa
import OSLog

/// Information for a window.
nonisolated struct WindowInfo {
    /// The window's identifier.
    let windowID: CGWindowID

    /// The identifier of the process that owns the window.
    let ownerPID: pid_t

    /// The window's bounds, specified in screen coordinates.
    let bounds: CGRect

    /// The window's layer number.
    let layer: Int

    /// The window's title.
    let title: String?

    /// The name of the process that owns the window.
    ///
    /// This may have a value when ``owningApplication`` does not have
    /// a localized name.
    let ownerName: String?

    /// A Boolean value that indicates whether the window is on screen.
    let isOnScreen: Bool

    /// The application that owns the window.
    var owningApplication: NSRunningApplication? {
        NSRunningApplication(processIdentifier: ownerPID)
    }

    /// A Boolean value that indicates whether the window belongs to the
    /// window server.
    var isWindowServerWindow: Bool {
        ownerName == "Window Server"
    }

    /// A Boolean value that indicates whether the window has no area to
    /// match an accessibility element against.
    ///
    /// Every source-PID match compares this window's centre with an AX frame,
    /// so a scan started for a zero-width or zero-height window can't succeed.
    /// These exist and persist (#956: `(-4323, 0, 0, 0)`, unresolved for minutes).
    var isDegenerate: Bool {
        bounds.isEmpty
    }

    /// A Boolean value that indicates whether the window is a menu-related window.
    ///
    /// This property returns `true` if the window's layer corresponds to a
    /// pop-up menu, status window, or main menu, or if it belongs to the
    /// Window Server (which often owns the actual menu windows for apps).
    var isMenuRelated: Bool {
        let level = CGWindowLevel(Int32(layer))
        return level == CGWindowLevelForKey(.popUpMenuWindow) ||
            level == CGWindowLevelForKey(.popUpMenuWindow) - 1 || // Some menus are slightly below
            level == CGWindowLevelForKey(.statusWindow) ||
            level == CGWindowLevelForKey(.mainMenuWindow) ||
            isWindowServerWindow
    }

    /// Creates a window with the given dictionary.
    private init?(dictionary: CFDictionary) {
        guard
            let info = dictionary as? [CFString: Any],
            let windowID = info[kCGWindowNumber] as? CGWindowID,
            let ownerPID = info[kCGWindowOwnerPID] as? pid_t,
            let boundsDict = info[kCGWindowBounds] as? NSDictionary,
            let bounds = CGRect(dictionaryRepresentation: boundsDict),
            let layer = info[kCGWindowLayer] as? Int
        else {
            return nil
        }
        self.windowID = windowID
        self.ownerPID = ownerPID
        self.bounds = bounds
        self.layer = layer
        self.title = info[kCGWindowName] as? String
        self.ownerName = info[kCGWindowOwnerName] as? String
        self.isOnScreen = info[kCGWindowIsOnscreen] as? Bool ?? false
    }

    /// Creates a window with the given window identifier.
    ///
    /// - Parameter windowID: A window identifier.
    init?(windowID: CGWindowID) {
        guard let window = WindowInfo.createWindows(from: [windowID]).first else {
            return nil
        }
        self = window
    }

    /// Returns the current bounds of the window.
    func currentBounds() -> CGRect? {
        Bridging.getWindowBounds(for: windowID)
    }
}

// MARK: - Memberwise Init

nonisolated extension WindowInfo {
    /// Creates a window from its individual properties.
    ///
    /// Lets tests exercise the derived rules without a live window server.
    init(
        windowID: CGWindowID,
        ownerPID: pid_t,
        bounds: CGRect,
        layer: Int,
        title: String? = nil,
        ownerName: String? = nil,
        isOnScreen: Bool = true
    ) {
        self.windowID = windowID
        self.ownerPID = ownerPID
        self.bounds = bounds
        self.layer = layer
        self.title = title
        self.ownerName = ownerName
        self.isOnScreen = isOnScreen
    }
}

// MARK: - Window List

nonisolated extension WindowInfo {
    private static let diagLog = DiagLog(category: "WindowInfo")

    /// Creates a list of windows from the given list of window identifiers.
    ///
    /// - Parameter windowIDs: A list of window identifiers.
    static func createWindows(from windowIDs: [CGWindowID]) -> [WindowInfo] {
        guard let array = Bridging.createCGWindowArray(with: windowIDs) else {
            diagLog.warning("createWindows: createCGWindowArray returned nil for \(windowIDs.count) window IDs")
            return []
        }
        guard let list = CGWindowListCreateDescriptionFromArray(array) as? [CFDictionary] else {
            diagLog.warning("createWindows: CGWindowListCreateDescriptionFromArray returned nil for \(windowIDs.count) window IDs")
            return []
        }
        let windows = list.compactMap { WindowInfo(dictionary: $0) }
        if windows.count != windowIDs.count {
            diagLog.debug("createWindows: \(windowIDs.count) IDs -> \(list.count) descriptions -> \(windows.count) WindowInfo objects (some may have failed init)")
        }
        return windows
    }

    /// Creates a list of windows using the given options.
    ///
    /// - Parameter option: Options that filter the returned list.
    ///   Pass an empty option set to return all available windows.
    static func createWindows(option: Bridging.WindowListOption = []) -> [WindowInfo] {
        createWindows(from: Bridging.getWindowList(option: option))
    }

    /// Creates a list of windows for the elements in the menu bar
    /// using the given options.
    ///
    /// - Parameter option: Options that filter the returned list.
    ///   Pass an empty option set to return all available windows.
    static func createMenuBarWindows(option: Bridging.MenuBarWindowListOption = []) -> [WindowInfo] {
        createWindows(from: Bridging.getMenuBarWindowList(option: option))
    }
}

// MARK: - Specific Windows

nonisolated extension WindowInfo {
    /// Returns the wallpaper window for the given display from the
    /// given list of windows.
    static func wallpaperWindow(from windows: [WindowInfo], for display: CGDirectDisplayID) -> WindowInfo? {
        let displayBounds = CGDisplayBounds(display)
        return windows.first { window in
            // Wallpaper window belongs to the Dock process.
            window.owningApplication?.bundleIdentifier == "com.apple.dock" &&
                window.title?.hasPrefix("Wallpaper") == true &&
                displayBounds.contains(window.bounds)
        }
    }

    /// Creates and returns the wallpaper window for the given display.
    static func wallpaperWindow(for display: CGDirectDisplayID) -> WindowInfo? {
        wallpaperWindow(from: createWindows(option: .onScreen), for: display)
    }

    // MARK: Menu Bar Window

    /// Returns the menu bar window for the given display from the
    /// given list of windows.
    static func menuBarWindow(from windows: [WindowInfo], for display: CGDirectDisplayID) -> WindowInfo? {
        let displayBounds = CGDisplayBounds(display)
        return windows.first { window in
            // Menu bar window belongs to the WindowServer process.
            window.isWindowServerWindow &&
                window.isOnScreen &&
                window.layer == kCGMainMenuWindowLevel &&
                window.title == "Menubar" &&
                displayBounds.contains(window.bounds)
        }
    }

    /// Creates and returns the menu bar window for the given display.
    static func menuBarWindow(for display: CGDirectDisplayID) -> WindowInfo? {
        menuBarWindow(from: createMenuBarWindows(option: .onScreen), for: display)
    }
}

// MARK: WindowInfo: Codable

nonisolated extension WindowInfo: Codable {}

// MARK: WindowInfo: Equatable

nonisolated extension WindowInfo: Equatable {
    static func == (lhs: WindowInfo, rhs: WindowInfo) -> Bool {
        lhs.windowID == rhs.windowID &&
            lhs.ownerPID == rhs.ownerPID &&
            lhs.bounds == rhs.bounds &&
            lhs.layer == rhs.layer &&
            lhs.title == rhs.title &&
            lhs.ownerName == rhs.ownerName &&
            lhs.isOnScreen == rhs.isOnScreen
    }
}

// MARK: WindowInfo: Hashable

nonisolated extension WindowInfo: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(windowID)
        hasher.combine(ownerPID)
        hasher.combine(bounds.origin.x)
        hasher.combine(bounds.origin.y)
        hasher.combine(bounds.size.width)
        hasher.combine(bounds.size.height)
        hasher.combine(layer)
        hasher.combine(title)
        hasher.combine(ownerName)
        hasher.combine(isOnScreen)
    }
}

```

### Core Architecture Module: `Thaw/Events/RunLoopLocalEventMonitor.swift`
```
//
//  RunLoopLocalEventMonitor.swift
//  Project: Thaw
//
//  Copyright (Ice) © 2023–2025 Jordan Baird
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import Cocoa
import Combine

final nonisolated class RunLoopLocalEventMonitor {
    private let runLoop = CFRunLoopGetCurrent()
    private let mask: NSEvent.EventTypeMask
    private let mode: RunLoop.Mode
    private let handler: @Sendable (NSEvent) -> NSEvent?
    private let observer: CFRunLoopObserver?

    init(
        mask: NSEvent.EventTypeMask,
        mode: RunLoop.Mode,
        handler: @escaping @Sendable (_ event: NSEvent) -> NSEvent?
    ) {
        self.mask = mask
        self.mode = mode
        self.handler = handler
        let capturedMask = mask
        let capturedHandler = handler
        let obs = CFRunLoopObserverCreateWithHandler(
            kCFAllocatorDefault,
            CFRunLoopActivity.beforeSources.rawValue,
            true,
            0
        ) { _, _ in
            let events = Self.drainMainRunLoop()

            for event in events {
                var handledEvent: NSEvent?

                if !capturedMask.contains(NSEvent.EventTypeMask(rawValue: 1 << event.type.rawValue)) {
                    handledEvent = event
                } else if let eventFromHandler = capturedHandler(event) {
                    handledEvent = eventFromHandler
                }

                guard let handledEvent else {
                    continue
                }

                Self.postEvent(handledEvent, atStart: false)
            }
        }
        self.observer = obs
    }

    private static nonisolated var sharedApp: NSApplication {
        let sel = #selector(getter: NSApplication.shared)
        typealias SharedImp = @convention(c) (AnyClass, Selector) -> NSApplication
        let imp = unsafeBitCast(NSApplication.self.method(for: sel), to: SharedImp.self)
        return imp(NSApplication.self, sel)
    }

    private static nonisolated func drainMainRunLoop() -> [NSEvent] {
        var events = [NSEvent]()
        let app = sharedApp
        let nextSel = #selector(NSApplication.nextEvent(matching:until:inMode:dequeue:))
        typealias NextImp = @convention(c) (AnyObject, Selector, NSEvent.EventTypeMask, Date?, RunLoop.Mode, Bool) -> NSEvent?
        let nextImp = unsafeBitCast(app.method(for: nextSel), to: NextImp.self)
        while let event = nextImp(app, nextSel, .any, nil, .default, true) {
            events.append(event)
        }
        return events
    }

    private static nonisolated func postEvent(_ event: NSEvent, atStart: Bool) {
        let app = sharedApp
        let sel = #selector(NSApplication.postEvent(_:atStart:))
        typealias PostImp = @convention(c) (AnyObject, Selector, NSEvent, Bool) -> Void
        let postImp = unsafeBitCast(app.method(for: sel), to: PostImp.self)
        postImp(app, sel, event, atStart)
    }

    deinit {
        stop()
    }

    func start() {
        CFRunLoopAddObserver(
            runLoop,
            observer,
            CFRunLoopMode(mode.rawValue as CFString)
        )
    }

    func stop() {
        CFRunLoopRemoveObserver(
            runLoop,
            observer,
            CFRunLoopMode(mode.rawValue as CFString)
        )
    }
}

nonisolated extension RunLoopLocalEventMonitor {
    struct RunLoopLocalEventPublisher: Publisher {
        typealias Output = NSEvent
        typealias Failure = Never

        let mask: NSEvent.EventTypeMask
        let mode: RunLoop.Mode

        func receive(subscriber: some Subscriber<Output, Failure> & Sendable) {
            let subscription = RunLoopLocalEventSubscription(mask: mask, mode: mode, subscriber: subscriber)
            subscriber.receive(subscription: subscription)
        }
    }

    static func publisher(for mask: NSEvent.EventTypeMask, mode: RunLoop.Mode) -> RunLoopLocalEventPublisher {
        RunLoopLocalEventPublisher(mask: mask, mode: mode)
    }
}

nonisolated extension RunLoopLocalEventMonitor.RunLoopLocalEventPublisher {
    private final class RunLoopLocalEventSubscription<S: Subscriber<Output, Failure> & Sendable>: Subscription, @unchecked Sendable {
        let mask: NSEvent.EventTypeMask
        let mode: RunLoop.Mode
        private var subscriber: S?

        private lazy var monitor = RunLoopLocalEventMonitor(mask: mask, mode: mode) { [weak self] event in
            _ = self?.subscriber?.receive(event)
            return event
        }

        init(mask: NSEvent.EventTypeMask, mode: RunLoop.Mode, subscriber: S) {
            self.mask = mask
            self.mode = mode
            self.subscriber = subscriber
            self.monitor.start()
        }

        func request(_: Subscribers.Demand) {
            // Backpressure is not applicable — events are pushed by the run loop regardless of demand.
        }

        func cancel() {
            monitor.stop()
            subscriber = nil
        }
    }
}

```

### Core Architecture Module: `Thaw/Main/AppState.swift`
```
//
//  AppState.swift
//  Project: Thaw
//
//  Copyright (Ice) © 2023–2025 Jordan Baird
//  Copyright (Thaw) © 2026 Toni Förster
//  Licensed under the GNU GPLv3

import AsyncAlgorithms
import Combine
import CoreGraphics
import Observation
import SwiftUI

/// The model for app-wide state.
@MainActor
@Observable
final class AppState {
    /// Information for the active space.
    private(set) var activeSpace = SpaceInfo.activeSpace()

    /// A Boolean value that indicates whether the user is dragging a menu bar item.
    private(set) var isDraggingMenuBarItem = false

    /// Tracks presentation of the update consent sheet.
    var isUpdateConsentPresented = false

    /// Tracks presentation of the onboarding sheet.
    var isOnboardingPresented = false

    /// Model for the app's settings.
    let settings = AppSettings()

    /// Model for the app's permissions.
    let permissions = AppPermissions()

    /// Model for app-wide navigation.
    let navigationState = AppNavigationState()

    /// Manager for the state of the menu bar.
    let menuBarManager = MenuBarManager()

    /// Manager for the menu bar's appearance.
    let appearanceManager = MenuBarAppearanceManager()

    /// Manager for menu bar item spacing.
    let spacingManager = MenuBarItemSpacingManager()

    /// Manager for menu bar items.
    let itemManager = MenuBarItemManager()

    /// Global cache for menu bar item images.
    let imageCache = MenuBarItemImageCache()

    /// Owner of the user's menu bar spacer items.
    let spacerManager = MenuBarSpacerManager()

    /// Owner of user-authored menu bar item groups.
    let itemGroupManager = MenuBarItemGroupManager()

    /// Manager for input events received by the app.
    let hidEventManager = HIDEventManager()

    /// Manager for settings profiles.
    let profileManager = ProfileManager()

    /// Manager for app updates.
    let updatesManager = UpdatesManager()

    /// Manager for user notifications.
    let userNotificationManager = UserNotificationManager()

    /// Engages zen mode while the screen is mirrored or being shared.
    let presentationMonitor = PresentationMonitor()

    /// Storage for internal observers.
    private var cancellables = Set<AnyCancellable>()

    /// Observes `navigationState.isAppFrontmost` and `isSettingsPresented`.
    private var navigationStateObservationTask: Task<Void, Never>?

    /// Observes `hidEventManager.isDraggingMenuBarItem`.
    private var hidEventManagerObservationTask: Task<Void, Never>?

    /// Observes `NSApplication.didChangeScreenParametersNotification`, debounced.
    private var screenParametersObservationTask: Task<Void, Never>?

    /// Track open windows to prevent duplicates
    private var openWindows = Set<IceWindowIdentifier>()

    /// Whether settings, permissions, search, or the Thaw Bar is up.
    /// Those surfaces activate as a regular app, so a menu-bar hide retry
    /// must not switch back to accessory and hide their Dock icon.
    var explicitUIWantsRegularActivation: Bool {
        navigationState.isSettingsPresented
            || navigationState.isSearchPresented
            || navigationState.isIceBarPresented
            || openWindows.contains(.settings)
            || openWindows.contains(.permissions)
    }

    /// Track last known screen count to detect disconnects.
    private var lastKnownScreenCount = NSScreen.screens.count

    /// Prevent repeated restart attempts.
    private var isRestarting = false

    /// Diagnostic logger for the app state.
    let diagLog = DiagLog(category: "AppState")

    /// `@ObservationIgnored`: the macro can't handle a `lazy` property, and no
    /// view reads it.
    @ObservationIgnored
    private lazy var setupTask = Task { @MainActor in
        // Repoint the XPC service on rotation. Installed before logging starts
        // so the first rotation is covered too.
        DiagnosticLogger.shared.onRotate = {
            Task { await MenuBarItemService.Connection.shared.syncLogging() }
        }

        // Opening a log file prunes, so set retention first; the settings model
        // isn't built yet.
        DiagnosticLogger.shared.setRotationPolicy(AdvancedSettings.persistedRotationPolicy())

        #if DEBUG
            // Debug builds always have diagnostic logging on so logs are
            // captured during development without depending on the toggle.
            DiagnosticLogger.shared.isEnabled = true
        #else
            if Defaults.bool(forKey: .enableDiagnosticLogging) {
                DiagnosticLogger.shared.isEnabled = true
            }
        #endif

        diagLog.debug("setupTask: starting AppState setup sequence")
        permissions.stopAllChecks()
        diagLog.debug("setupTask: permissions state = \(String(describing: self.permissions.permissionsState)), accessibility = \(self.permissions.accessibility.hasPermission), screenRecording = \(self.permissions.screenRecording.hasPermission)")

        settings.performSetup(with: self)
        menuBarManager.performSetup(with: self)
        diagLog.debug("setupTask: settings and menuBarManager setup complete")

        diagLog.debug("setupTask: starting MenuBarItemService XPC connection")
        await MenuBarItemService.Connection.shared.start()
        diagLog.debug("setupTask: MenuBarItemService XPC connection started")
        // Capture is optional: don't block item/manager setup if the helper is slow.
        Task {
            await MenuBarCaptureService.Connection.shared.start()
        }
        diagLog.debug("setupTask: MenuBarCaptureService XPC start kicked off")

        appearanceManager.performSetup(with: self)
        hidEventManager.performSetup(with: self)
        diagLog.debug("setupTask: starting itemManager setup")
        await itemManager.performSetup(with: self)
        diagLog.debug("setupTask: itemManager setup scheduled, invalidating menuBarHeightCache")
        NSScreen.invalidateMenuBarHeightCache()
        diagLog.debug("setupTask: starting imageCache setup")
        imageCache.performSetup(with: self)
        diagLog.debug("setupTask: imageCache setup complete")
        spacerManager.performSetup(with: self)
        presentationMonitor.performSetup(with: self)
        updatesManager.performSetup(with: self)
        userNotificationManager.performSetup(with: self)
        profileManager.performSetup(with: self)

        configureCancellables()
        diagLog.debug("setupTask: AppState setup sequence complete")
    }

    /// Allows explicit starting of the updater from UI flows.
    func startUpdaterIfNeeded() {
        updatesManager.startUpdaterIfNeeded()
    }

    /// Presents the onboarding sheet if the user hasn't seen it yet.
    func presentOnboardingIfNeeded() {
        if !Defaults.bool(forKey: .hasSeenOnboarding) {
            isOnboardingPresented = true
        }
    }

    /// Completes first-launch setup based on the permissions currently granted,
    /// then brings the app to regular activation and opens Settings. Shared by
    /// the permissions window's Continue button and onboarding's final slide.
    func completeFirstLaunchSetup() {
        dismissWindow(.permissions)
        Defaults.set(true, forKey: .hasSeenOnboarding)

        let hasPermissions = permissions.permissionsState != .missing
        performSetup(hasPermissions: hasPermissions)
        Defaults.set(true, forKey: .hasCompletedFirstLaunch)

        guard hasPermissions else { return }

        Task {
            activate(withPolicy: .regular)
            openWindow(.settings)
        }
    }

    func dismissWindow(_ id: IceWindowIdentifier) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            self.openWindows.remove(id)
            self.diagLog.debug("Dismissing window with id: \(id)")
            EnvironmentValues().dismissWindow(id: id)
        }
    }

    /// Performs app state setup.
    ///
    /// - Parameter hasPermissions: If `true`, continues with setup normally.
    ///   If `false`, prompts the user to grant permissions.
    func performSetup(hasPermissions: Bool) {
        if hasPermissions {
            Task {
                diagLog.debug("Setting up app state")
                await setupTask.value

                // Warm up the activation policy system.
                NSApp.setActivationPolicy(.regular)
                try? await Task.sleep(for: .milliseconds(50))
                NSApp.setActivationPolicy(.accessory)

                diagLog.debug("Finished setting up app state")
            }
        } else {
            Task {
                // Delay to prevent conflicts with the app delegate.
                try? await Task.sleep(for: .milliseconds(100))
                activate(withPolicy: .regular)
                dismissWindow(.settings) // Shouldn't be open anyway.
                openWindow(.permissions)
            }
        }
    }

    /// Configures the internal observers for the app state.
    private func configureCancellables() {
        var c = Set<AnyCancellable>()

        // Listen for changes to the active space. We need handle some special
        // cases that NSWorkspace.shared.notificationCenter seems to miss.
        //
        // Special cases:
        //
        // * Changes to the frontmost application -- may indicate that a space
        //   on another display was made active.
        // * Left mouse down -- user may have clicked into a fullscreen space.
        //   To account for variations in system timing, we publish a value
        //   immediately upon receipt of the event, then publish another value
        //   after a delay.
        NSWorkspace.shared.notificationCenter
            .publisher(for: NSWorkspace.activeSpaceDidChangeNotification)
            .discardMerge(NSWorkspace.shared.publisher(for: \.frontmostApplication))
            .discardMerge(
                EventMonitor.publish(events: .leftMouseDown, scope: .universal)
                    .
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1116** (2026-09-14): **[Bug] Sort A->Z does nothing for hidden and always-hidden sections**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read the tracking issue first  ### Problem / Use Case  The "Sort A to Z" button in Settings, Menu Bar Layout writes the sorted order to the active profile, but for the **hidden** and **always-hidden** sections the menu bar never reorders. The sort persists to disk and nothing moves on the bar. The **visible** section sorts correctly.  ### Steps to reproduce  1. Put several items in the hidden section in a non-alphabetical order. 2. Open Settings, Menu Bar Layout. 3. Click "Sort A to Z" on the hidden section heading.  ### Expected behavior  The hidden section's items reorder alphabetically on the bar.  ### Actual behavior  Nothing moves. The on-disk profile carries the sorted order, but the bar keeps its previous order.  ### Thaw version  2.1.0-beta.2  ### macOS version  26  ### Display setup  Single display  ### Anything else?  The sort calls `applyProfileLayout`, which by default relaxes concealed-section order (`enforceConcealedSectionOrder` defaults to false, no user toggle). `relaxConcealedSectionOrder` rewrites the desired order back to the current order, so the LCS plans zero moves. Visible is not relaxed, so it sorts fine. The relaxation is intentional for background work (it avoids hijacking the cursor to reorder items parked off-screen), but an explicit user sort needs to opt out of it for that one pass. 
  **Post-Mortem & Fix Analysis**:
  > 👋 Hi @diazdesandi! Thanks for opening this issue.  To help us investigate, could you please add one piece of evidence for the bug, such as a diagnostic log, screenshot, or short screen recording showing the hidden or always-hidden section staying in its previous order after using Sort A to Z?  Once we have that, we can take a closer look. Thanks!  > Generated by [Issue Triage](https://github.com/thaw-app/Thaw/actions/runs/34862964877) for #1116 · copilot · gpt54 · 13 AIC · ⌖ 5.95 AIC · ⊞ 20.3K · [◷](https://github.com/search?q=repo%3Athaw-app%2FThaw+%22gh-aw-workflow-call-id%3A+thaw-app%2FThaw%2Fissue-triage%22&type=issues)  <!-- gh-aw-agentic-workflow: Issue Triage, engine: copilot, model: gpt-5.4, id: 34862964877, workflow_id: issue-triage, run: https://github.com/thaw-app/Thaw/actions/runs/34862964877 --> <!-- gh-aw-workflow-call-id: thaw-app/Thaw/issue-triage -->

- **Issue #899** (2026-08-15): **[Bug] RC2.1 destroys my cursor moves**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  After switching from rc 2.0 und rc 2.1 the space between the icons is set to Standard and I have no chance to reduce this back. But on my macOS 26.6 I can´t use the new release because the cursor is moving unmotivated, went big and smal sometimes I see 3 ones - activating the log was a challenge:-)  I´m back on rc 2.0 :-(  ### Steps to Reproduce  brew upgrade Start thaw and see the problem  ### Expected Behavior  should be good  ### App Version  rc 2.1  ### macOS Version  26.6  ### Display Setup  Single monitor  ### Logs / Console Output  [thaw_2026-08-06_14-03-56.log](https://github.com/user-attachments/files/30792643/thaw_2026-08-06_14-03-56.log)  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, I am looking into it, it's likely a duplicate of #895 , closing it until it's clear
  > Thank you very much - I'm not sure about the duplicate - for me the description of 895 is very complicated - I can't follow that - but if you think and maybe my log will help, then I'll try again when 895 is fixed :-)  Thank you for the great work!
  > Can you try https://github.com/thaw-app/Thaw/actions/runs/31127665694/artifacts/8974810339 ?

- **Issue #898** (2026-08-30): **[Bug]  自动移动问题**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  https://github.com/user-attachments/assets/c91b25a8-44b7-4e17-89f8-db449810434a 这样正常吗。   BTW：  我自己开发的qbmiller/xxmac  menu icon死活显示不出来[忽然这样的]，别人电脑ok。 各种debug 都没能解决。 issue那 https://github.com/qbmiller/xxMac/blob/main/docs/menu-bar-status-item-troubleshooting.md  求教macos大佬   ### Steps to Reproduce  1. 就是眼镜  vs 竖杠  。 它俩问题  ### Expected Behavior  1  ### App Version  latest  ### macOS Version  26.6  ### Display Setup  Single monitor  ### Logs / Console Output  [config.json](https://github.com/user-attachments/files/30770484/config.json)  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 👋 方便我们排查的话,还需要补充:  - 期望结果(你希望自动移动后是什么表现) - 实际结果(现在实际发生了什么) - 更精确的复现步骤 - 具体 Thaw 版本号(`latest` 不够)  你这里已经提供了 macOS 26.6;如果问题涉及某个第三方菜单栏图标,也请说明是哪一个 app。    > Generated by [Issue Triage](https://github.com/thaw-app/Thaw/actions/runs/31068428183) for #898 · gpt50mini · 7.25 AIC · ⌖ 1.85 AIC · ⊞ 16.9K · [◷](https://github.com/search?q=repo%3Athaw-app%2FThaw+%22gh-aw-workflow-call-id%3A+thaw-app%2FThaw%2Fissue-triage%22&type=issues)  <!-- gh-aw-agentic-workflow: Issue Triage, engine: copilot, version: 1.0.71, model: gpt-5-mini, id: 31068428183, workflow_id: issue-triage, run: https://github.com/thaw-app/Thaw/actions/runs/31068428183 --> <!-- gh-aw-workflow-call-id: thaw-app/Thaw/issue-triage -->

- **Issue #893** (2026-08-05): **[Bug] The icons are grayed out**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  The icons are grayed out.   ### Steps to Reproduce  Open the **Layout** menu.   ### Expected Behavior  The icons are white (I think?).   ### App Version  Version 2.0.0-rc.2 (47)  ### macOS Version  26  ### Display Setup  Multiple monitors  ### Logs / Console Output  [thaw_2026-08-05_21-35-14.log](https://github.com/user-attachments/files/30759233/thaw_2026-08-05_21-35-14.log)  ### Additional Context  <img width="955" height="372" alt="Image" src="https://github.com/user-attachments/assets/151449da-1807-4263-afe2-93860d8cfb43" />
  **Post-Mortem & Fix Analysis**:
  > Fixed on rc2.1 that was released 9 hours ago.
  > > Fixed on rc2.1 that was released 9 hours ago.  I'm on it. Sorry, I missed the version in the description: **Version 2.0.0-rc.2 (47)**. 
  > Version 2.0.0-rc.2.1(49), this issue was the reason of the hotfix.

- **Issue #890** (2026-08-15): **[Bug] Section divider preferred positions can never be written: ControlItemDefaults setter discards preflightSetup and resetChevronPositions**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read #687 and this report is a specific new bug not already covered there (or this is not about macOS 27) - [x] I'm using the latest app version  ### What happened?  `ControlItemDefaults`'s subscript setter refuses to write a preferred position for either section divider. `preflightSetup(for:)` and `resetChevronPositions()` both try to do exactly that, so all of their writes are discarded. The hidden divider never gets the position the code intends to give it.  In `ControlItem.swift` at `54345d40`:  ```swift static subscript<Value>(key: Key<Value>, autosaveName: String) -> Value? {     set {         // Prevent saving preferred position for section divider chevrons         if key.isPreferredPosition, isSectionDivider(autosaveName: autosaveName) {             return         }         ...     } }  static func isSectionDivider(autosaveName: String) -> Bool {     autosaveName == ControlItem.Identifier.hidden.rawValue ||         autosaveName == ControlItem.Identifier.alwaysHidden.rawValue } ```  Three write sites route through that setter and are silently dropped:  ```swift // preflightSetup(for:) — dropped case .hidden:     ControlItemDefaults[.preferredPosition, autosaveName] = 1  // preflightSetup(for:), under "Always reset section divider positions to defaults" — dropped if isSectionDivider(autosaveName: autosaveName) {    
  **Post-Mortem & Fix Analysis**:
  > sup @lathe-agent-oa, try this one https://github.com/thaw-app/Thaw/actions/runs/31034915661/artifacts/8942372634
  > Tested the artifact from run 31034915661 (commit `9c82211`, DMG sha256 `8ec600ad…`) on the machine this issue was filed from. Same display setup as the issue body; the bar was healthy when the test started: dividers seeded at Visible=198 / Hidden=1051 / AlwaysHidden=6105, saved layout 64 visible / 46 hidden / 12 always-hidden, on-screen `visible=14, hidden=10, alwaysHidden=0`.  **Result: this build rewrites the divider geometry destructively on this bar. Deterministic, 2 of 2 clean launches.**  Within ~35 seconds of each launch:  1. The Hidden divider's preferred position went from 1051 to **193**, with the Visible divider at 160 — 33 pt of visible span on a bar whose saved layout has 64 visible items. Nearly everything reclassified as hidden: on-screen went to `visible=4, hidden=20`. 2. A save then persisted the drain: 64/46/12 → **42/52/12**. The zero-width gates never fired — 160/193 is not zero width, so from the gate's point of view the geometry is legitimate. 3. No log line recor

- **Issue #885** (2026-08-15): **[Bug] Hidden section order is permuted by a bulk apply while its membership stays correct**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read #687 and this report is a specific new bug not already covered there (or this is not about macOS 27) - [x] I'm using the latest app version  ### What happened?  The saved order of the hidden section was scrambled while its membership stayed correct. Every count-based check passes, so nothing surfaces it: the section holds the right items, and only their sequence is wrong.  Measured against a known-good `MenuBarItemManager.savedSectionOrder` captured before the incident:  ``` visible       good=64  cur=64  order identical hidden        good=46  cur=47  order identical = NO alwaysHidden  good=12  cur=12  order identical ```  Over the 46 items common to both, **all 46 sit at a different index. None retains its original position.** It is close to an inversion without being one: mean deviation from a perfect reversal is 9.3 positions (14 of 46 within ±3), against 22.3 from the original order (0 of 46 within ±3).  This is not the #868 collapse and not an identity-resolution failure. On this run the #876 gate had nothing to refuse — zero `hidden section has zero width` refusals — and identity resolution was clean, `25 valid, 0 invalid (filtered), 0 couldn't find section`. The divider geometry was healthy throughout.  The trigger was an app creating a **second** status item. Fluid already had `com.FluidApp.app:Item-0` in alw
  **Post-Mortem & Fix Analysis**:
  > Update to get 2.0.0-rc.2.1 @lathe-agent-oa 
  > Follow-up from repairing the layout described above. The repair worked, and it surfaced something about #876 that matters more than the ordering bug: the gate has no recovery path.  ## What I did  Quit the app, restored the known-good `MenuBarItemManager.savedSectionOrder` with `defaults import`, relaunched. The saved order came back correct — all three sections byte-identical to the pre-incident copy.  ## What happened on relaunch  Both clean launches came up with the dividers collapsed, and every gate did exactly what it was built to do:  ``` 06:54:42.835 [WARNING] Skipping saveSectionOrder; hidden section has zero width between the dividers              (hidden.minX=-3870.0, alwaysHidden.maxX=-3870.0) 06:54:51.761 [WARNING] applySavedLayout: skipping (windowID change); hidden section has zero width 06:55:34.102 [WARNING] applySavedLayout: skipping (windowID change); hidden section has zero width ```  On-screen state while that held:  ``` Updated menu bar item cache: visible=14, hidd

- **Issue #884** (2026-08-05): **[Bug] Intentionally left blank as the github action workflow is broken**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  Intentionally left blank as the github action workflow is broken   ### Steps to Reproduce  Intentionally left blank as the github action workflow is broken   ### Expected Behavior  Intentionally left blank as the github action workflow is broken   ### App Version  Intentionally left blank as the github action workflow is broken   ### macOS Version  Intentionally left blank as the github action workflow is broken   ### Display Setup  Single monitor  ### Logs / Console Output  [openai.png](https://github.com/user-attachments/assets/5fb70b13-6953-42f9-b78e-953f3ec0e376)  ### Additional Context  _No response_

- **Issue #882** (2026-08-08): **[Bug] Issue triage workflow closes issues for P0 regressions in RC2 (as duplicates of old closed issues)**
  *Symptoms*: ### Pre-submission Checklist  - [x] I searched existing issues (open & closed) and found no duplicates - [x] If this is about macOS 27 / Golden Gate, I have read - [x] I'm using the latest app version  ### What happened?  The automated issue-triage workflow is closing new bug reports against the current rc2 as duplicates of older issues, that have already been closed as completed.  ### Steps to Reproduce  1. See a bug in rc2 2. Report the issue 3. Get github action bot closing the issue, pointing to a closed issue  ### Expected Behavior  The new issue should not be closed. For that matter, the old issue shouldn't be closed prematurely before proper testing anyways  If the bot finds a possible related CLOSED issue, it should just leave a comment. Someone filing a bug on a closed issue is a sign that something has gone wrong! If the *closed* issue is "reactor failure at chernobyl", and someone files a new issue "reactor failure in xxxxx", you want to leave the new issue open since the previous one is closed! Matching to closed issues in the prompt of the workflow is insane.   ### App Version  irrelevant, go fix your .github/workflows  ### macOS Version  irrelevant  ### Display Setup  Single monitor  ### Logs / Console Output  [openai.png](https://github.com/user-attachments/assets/1cf0547a-86d4-4b1a-8c7f-53653b5b10b3)  ### Additional Context  For example:  #881 reports the mouse cursor disappearing and jumping to the top-right while running 2.0.0-rc.2. The workflow closed it as
  **Post-Mortem & Fix Analysis**:
  > It's an agent, lmao. Going to update it; it was set up to close issues before we required log files for them.
  > > irrelevant, go fix your .github/workflows  Fix would be in https://github.com/thaw-app/Thaw/blob/development/.github/workflows/issue-triage.md

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

### Incident Patch 1: `7abd161a` (2026-10-05)
**Commit Message**: build(deps): bump SonarSource/sonarqube-scan-action (#1238)

Bumps the github-actions group with 1 update: [SonarSource/sonarqube-scan-action](https://github.com/sonarsource/sonarqube-scan-action).


Updates `SonarSource/sonarqube-scan-action` from 8.2.2 to 8.3.0
- [Release notes](https://github.com/sonarsource/sonarqube-scan-action/releases)
- [Commits](https://github.com/sonarsource/sonarqube-scan-action/compare/ba9859eae8dd6bd29e412f25ddbbef3d032000f4...d209202bc7d53ff1cc128f7f907dac145c9d6ae9)

---
updated-dependencies:
- dependency-name: SonarSource/sonarqube-scan-action
  dependency-version: 8.3.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: github-actions
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -289,7 +289,7 @@ jobs:
       # sonar.coverageReportPaths out of sonar-project.properties.
       - name: SonarQube Scan
         if: env.SONAR_ENABLED == 'true'
-        uses: SonarSource/sonarqube-scan-action@ba9859eae8dd6bd29e412f25ddbbef3d032000f4 # v8.2.2
+        uses: SonarSource/sonarqube-scan-action@d209202bc7d53ff1cc128f7f907dac145c9d6ae9 # v8.3.0
         env:
           SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
         with:
```

---

### Incident Patch 2: `5f2a3eeb` (2026-10-02)
**Commit Message**: ci(release): promote a release candidate to stable without a rebuild (#1218)

* ci(release): promote a release candidate to stable without a rebuild

A candidate built with its final version (MARKETING_VERSION 2.1.0, tagged
2.1.0-rc.1) can now ship as 2.1.0 unchanged. promote.yml drops the feed
item's sparkle:channel, renames it, gives it the stable notes, tags the
candidate's commit and republishes its DMG, SBOM, Sigstore bundles and
provenance, which still verify because the bytes are the same. It refuses a
candidate built with its prerelease version.

generate_appcast resets shortVersionString from the bundle on every run, so
appcast preparation now shows a channel item's tag as its version: testers
see 2.1.0-rc.1, and a promoted item keeps the bundle's 2.1.0. Its channel
sticks, because --channel only applies to items generate_appcast creates.

generate_appcast also drops the notes of every earlier archive it re-reads
for deltas, which is why the live feed has no notes for 2.0.0 through
2.1.0-beta.6. release.yml now snapshots the feed first and appcast
preparation restores the missing notes from it.

Checked with the Sparkle 2.10.0 tools against throwaway builds: rc.1
release, 

**File**: `.github/actions/prepare-appcasts/action.yml` (modified, +11/-1)
```diff
@@ -1,5 +1,8 @@
 name: Prepare Thaw appcasts
-description: Apply the macOS 26 cap to 2.x entries and prepare the legacy feed for 2.x releases.
+description: >-
+  Apply the macOS 26 cap to 2.x entries, show prerelease tags as their version,
+  restore notes generate_appcast dropped, and prepare the legacy feed for 2.x
+  releases.
 
 inputs:
   appcast-path:
@@ -8,6 +11,12 @@ inputs:
   release-tag:
     description: Release tag; only 2.x releases produce a legacy feed
     required: true
+  previous-appcast-path:
+    description: >-
+      The feed as it was before this run. Items generate_appcast left without
+      notes get them back from here. Empty or missing skips the restore.
+    required: false
+    default: ""
 
 outputs:
   appcast-path:
@@ -27,4 +36,5 @@ runs:
         ACTION_PATH: ${{ github.action_path }}
         APPCAST_PATH: ${{ inputs.appcast-path }}
         RELEASE_TAG: ${{ inputs.release-tag }}
+        PREVIOUS_APPCAST_PATH: ${{ inputs.previous-appcast-path }}
       run: python3 "$ACTION_PATH/prepare_appcasts.py"
```

**File**: `.github/actions/prepare-appcasts/attach_release_assets.sh` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+#!/usr/bin/env bash
+# Usage: attach_release_assets.sh <owner/repo> <tag> <file>...
+#
+# Uploads each file the release is missing. A published asset is never
+# replaced: one that already matches is kept, and one that differs fails the
+# run, since someone may already have downloaded it.
+set -euo pipefail
+
+repo="$1" tag="$2"
+shift 2
+
+existing="$(gh release view "$tag" --repo "$repo" --json assets \
+  --jq '.assets[] | "\(.name)\t\(.digest // "")"')"
+
+for file in "$@"; do
+  name="$(basename "$file")"
+  digest="sha256:$(shasum -a 256 "$file" | cut -d' ' -f1)"
+  # "present:<digest>" when the release has an asset with exactly this name.
+  match="$(awk -F'\t' -v name="$name" '$1 == name { print "present:" $2; exit }' <<< "$existing")"
+  published="${match#present:}"
+  if [[ -z "$match" ]]; then
+    gh release upload "$tag" "$file" --repo "$repo"
+    echo "uploaded ${name}"
+  elif [[ "$published" == "$digest" ]]; then
+    echo "kept ${name}: already published with the same digest"
+  else
+    echo "::error::${repo}@${tag} already has a different ${name} (${published:-no digest}, expected ${digest})"
+    exit 1
+  fi
+done
```

**File**: `.github/actions/prepare-appcasts/prepare_appcasts.py` (modified, +78/-6)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
 import os
+import re
 from pathlib import Path
 from xml.dom import Node, minidom
 
@@ -15,18 +16,87 @@ def sparkle_elements(item, name):
     ]
 
 
-def prepare_appcasts(xml: bytes, release_tag: str) -> tuple[bytes, bytes | None]:
+# The release tag in an enclosure file name: Thaw_2.1.0-rc.1.zip, or a bare 2.1.0-rc.1.zip.
+ENCLOSURE_TAG = re.compile(r"(?:^|_)(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)\.zip$")
+
+
+def text(element):
+    return "".join(
+        node.data for node in element.childNodes
+        if node.nodeType in (Node.TEXT_NODE, Node.CDATA_SECTION_NODE)
+    ).strip()
+
+
+def build_number(item):
+    builds = sparkle_elements(item, "version")
+    return text(builds[0]) if len(builds) == 1 else None
+
+
+def has_description(item):
+    return any(text(node) for node in item.getElementsByTagName("description"))
+
+
+def update_enclosures(item):
+    # Direct children only: delta enclosures nest inside sparkle:deltas.
+    return [
+        child for child in item.childNodes
+        if child.nodeType == Node.ELEMENT_NODE and child.namespaceURI is None
+        and child.localName == "enclosure"
+    ]
+
+
+def enclosure_tag(item):
+    enclosures = update_enclosures(item)
+    if len(enclosures) != 1:
+        return None
+    match = ENCLOSURE_TAG.search(enclosures[0].getAttribute("url").rsplit("/", 1)[-1])
+    return match.group(1) if match else None
+
+
+def previous_descriptions(xml: bytes | None):
+    if not xml:
+        return {}
+    with minidom.parseString(xml) as document:
+        return {
+            build: item.getElementsByTagName("description")[0].cloneNode(True)
+            for item in document.getElementsByTagName("item")
+            if (build := build_number(item)) and has_description(item)
+        }
+
+
+def prepare_appcasts(
+    xml: bytes, release_tag: str, previous_xml: bytes | None = None
+) -> tuple[bytes, bytes | None]:
+    descriptions = previous_descriptions(previous_xml)
     # DOM serialization preserves CDATA, namespace prefixes, and enclosure signatures.
     with minidom.parseString(xml) as document:
         legacy_exclusions = []
         for item in document.getElementsByTagName("item"):
+            # generate_appcast drops the notes of every prior archive it re-reads
+            # for deltas, so carry them over from the feed it started from.
+            build = build_number(item)
+            if build in descriptions and not has_description(item):
+                for empty in item.getElementsByTagName("description"):
+                    item.removeChild(empty)
+                restored = document.importNode(descriptions[build], True)
+                enclosures = update_enclosures(item)
+                item.insertBefore(restored, enclosures[0] if enclosures else None)
+
             versions = sparkle_elements(item, "shortVersionString")
             if len(versions) != 1:
                 raise ValueError("Appcast item must have one sparkle:shortVersionString")
-            version = "".join(
-                node.data for node in versions[0].childNodes
-                if node.nodeType in (Node.TEXT_NODE, Node.CDATA_SECTION_NODE)
-            ).strip()
+
+            # Prereleases are built with their final version so they can be
+            # promoted unchanged. On a channel, show the tag (2.1.0-rc.1);
+            # once promoted, the channel is gone and the bundle's 2.1.0 stays.
+            # generate_appcast resets this from the bundle, so reapply every run.
+            tag = enclosure_tag(item)
+            if sparkle_elements(item, "channel") and tag and "-" in tag and text(versions[0]) != tag:
+                for node in list(versions[0].childNodes):
+                    versions[0].removeChild(node)
+                versions[0].appendChild(document.createTextNode(tag))
+
+            version = text(versions[0])
             if not version:
                 raise ValueError("Appcast item has an empty sparkle:shortVersionString")
 
@@ -58,8 +128,10 @@ def prepare_appcasts(xml: bytes, release_tag: str) -> tuple[bytes, bytes | None]
 
 
 def main():
+    previous_path = os.environ.get("PREVIOUS_APPCAST_PATH", "")
+    previous = Path(previous_path).read_bytes() if previous_path and Path(previous_path).is_file() else None
     canonical, legacy = prepare_appcasts(
-        Path(os.environ["APPCAST_PATH"]).read_bytes(), os.environ["RELEASE_TAG"]
+        Path(os.environ["APPCAST_PATH"]).read_bytes(), os.environ["RELEASE_TAG"], previous
     )
     directory = Path(os.environ["RUNNER_TEMP"]) / "thaw-appcasts"
     directory.mkdir(parents=True, exist_ok=True)
```

**File**: `.github/actions/prepare-appcasts/tests/test_prepare_appcasts.py` (modified, +56/-0)
```diff
@@ -87,6 +87,62 @@ def test_empty_feed(self):
         self.assertEqual(versions(canonical), [])
         self.assertEqual(versions(legacy), [])
 
+    def test_channel_items_show_their_tag_and_promoted_items_keep_the_bundle_version(self):
+        def item(build, short, tag, channel):
+            channel = f"<sparkle:channel>{channel}</sparkle:channel>" if channel else ""
+            # Like the live feed: delta enclosures nest inside sparkle:deltas.
+            return f"""<item>
+  <sparkle:version>{build}</sparkle:version>
+  <sparkle:shortVersionString>{short}</sparkle:shortVersionString>
+  {channel}
+  <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+  <enclosure url="https://example.org/download/{tag}/Thaw_{tag}.zip" length="1" type="application/octet-stream"/>
+  <sparkle:deltas>
+    <enclosure url="https://example.org/download/{tag}/Thaw{build}-60.delta" sparkle:deltaFrom="60" length="1"/>
+    <enclosure url="https://example.org/download/{tag}/Thaw{build}-59.delta" sparkle:deltaFrom="59" length="1"/>
+  </sparkle:deltas>
+</item>"""
+
+        items = "".join([
+            item(64, "2.1.1", "2.1.1-rc.1", "beta"),  # built with its final version
+            item(63, "2.1.0", "2.1.0-rc.1", None),  # promoted: channel removed
+            item(62, "2.1.0-beta.6", "2.1.0-beta.6", "beta"),
+            item(56, "2.0.1", "2.0.1", None),
+        ])
+        xml = f'<rss xmlns:sparkle="{SPARKLE_NS}" version="2.0"><channel>{items}</channel></rss>'.encode()
+        canonical, legacy = prepare_appcasts(xml, "2.1.1-rc.1")
+        self.assertEqual(versions(canonical), ["2.1.1-rc.1", "2.1.0", "2.1.0-beta.6", "2.0.1"])
+        self.assertEqual(versions(legacy), versions(canonical))
+        self.assertEqual(prepare_appcasts(canonical, "2.1.1-rc.1"), (canonical, legacy))
+
+    def test_notes_generate_appcast_dropped_come_back_from_the_previous_feed(self):
+        def item(build, notes):
+            description = f"<description><![CDATA[{notes}]]></description>" if notes is not None else ""
+            return f"""<item>
+  <sparkle:version>{build}</sparkle:version>
+  <sparkle:shortVersionString>2.1.{build}</sparkle:shortVersionString>
+  <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+  {description}
+  <enclosure url="https://example.org/Thaw_2.1.{build}.zip" length="1" type="application/octet-stream"/>
+</item>"""
+
+        def wrap(*items):
+            body = "".join(items)
+            return f'<rss xmlns:sparkle="{SPARKLE_NS}" version="2.0"><channel>{body}</channel></rss>'.encode()
+
+        previous = wrap(item(2, "<p>Two & more</p>"), item(1, "<p>One</p>"))
+        generated = wrap(item(3, "<p>Three</p>"), item(2, None), item(1, ""))
+        canonical, _ = prepare_appcasts(generated, "2.1.3", previous)
+        with minidom.parseString(canonical) as document:
+            notes = {
+                item.getElementsByTagNameNS(SPARKLE_NS, "version")[0].firstChild.data:
+                    [node.firstChild.data for node in item.getElementsByTagName("description")]
+                for item in document.getElementsByTagName("item")
+            }
+        self.assertEqual(notes, {"3": ["<p>Three</p>"], "2": ["<p>Two & more</p>"], "1": ["<p>One</p>"]})
+        self.assertIn(b"<![CDATA[<p>Two & more</p>]]>", canonical)
+        self.assertEqual(prepare_appcasts(canonical, "2.1.3", previous)[0], canonical)
+
     def test_action_entry_point_outputs_paths_without_modifying_source(self):
         with tempfile.TemporaryDirectory() as directory:
             directory = Path(directory)
```

**File**: `.github/workflows/promote.yml` (added, +374/-0)
```diff
@@ -0,0 +1,374 @@
+name: Promote
+
+# Ships a release candidate as the stable release without rebuilding it. The
+# candidate must have been built with its final version (MARKETING_VERSION
+# 2.1.0, tagged 2.1.0-rc.1), so the same signed, notarized bytes become 2.1.0.
+#
+# Sparkle offers an item with no sparkle:channel to everyone, so promotion
+# removes the candidate's channel in the feed. generate_appcast keeps an
+# existing item's channel on later runs, so the promotion sticks.
+#
+# Every step checks for its own result first, so a failed run can be rerun
+# with the same tag and picks up where it stopped.
+
+on:
+  workflow_dispatch:
+    inputs:
+      tag:
+        description: Published release candidate to promote (for example, 2.1.0-rc.1)
+        required: true
+        type: string
+      publish_appcast:
+        description: Push the promoted appcast to thaw-app/updates gh-pages
+        required: false
+        type: boolean
+        default: true
+      dry_run:
+        description: "Dry run: check and report only. Tags, releases and publishes nothing."
+        required: false
+        type: boolean
+        default: false
+      release_notes:
+        description: >-
+          Optional override for the stable release notes (Markdown). If blank,
+          the CHANGELOG.md section for the stable version on the branch this
+          runs from is used ("## [2.1.0]").
+        required: false
+        type: string
+        default: ""
+
+concurrency:
+  # Shares the feed with release.yml; never edit it from two runs at once.
+  group: sparkle-appcast${{ inputs.dry_run && '-dry-run' || '' }}
+  cancel-in-progress: false
+
+permissions:
+  contents: read
+
+jobs:
+  promote:
+    if: github.repository == 'thaw-app/Thaw'
+    runs-on: ubuntu-latest
+    environment: release
+    permissions:
+      contents: write
+    env:
+      UPDATES_REPOSITORY: thaw-app/updates
+      LEGACY_APPCAST_REPOSITORY: stonerl/Thaw
+    steps:
+      # Notes and the appcast action come from the branch this runs from, so
+      # the stable notes can be written after the candidate was tagged.
+      - name: Checkout notes and actions
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          sparse-checkout: |
+            .github/actions
+            CHANGELOG.md
+          sparse-checkout-cone-mode: false
+
+      - name: Resolve versions
+        id: meta
+        env:
+          TAG: ${{ inputs.tag }}
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          set -euo pipefail
+
+          if [[ ! "$TAG" =~ ^([0-9]+\.[0-9]+\.[0-9]+)-(rc|beta)\.[0-9]+$ ]]; then
+            echo "::error::Only rc and beta tags can be promoted, for example 2.1.0-rc.1"
+            exit 1
+          fi
+          stable="${BASH_REMATCH[1]}"
+
+          is_draft="$(gh release view "$TAG" --repo "$GITHUB_REPOSITORY" --json isDraft --jq .isDraft)"
+          if [[ "$is_draft" != "false" ]]; then
+            echo "::error::Release ${TAG} must be published before it can be promoted"
+            exit 1
+          fi
+          commit="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${TAG}" --jq .sha)"
+
+          # A rerun finds the stable tag it made last time; anything else is a conflict.
+          if stable_commit="$(gh api "repos/${GITHUB_REPOSITORY}/commits/${stable}" --jq .sha 2>/dev/null)"; then
+            if [[ "$stable_commit" != "$commit" ]]; then
+              echo "::error::${stable} is already tagged at ${stable_commit}, not ${TAG}'s ${commit}"
+              exit 1
+            fi
+            echo "::notice::${stable} already tags ${TAG}'s commit; resuming"
+          fi
+
+          {
+            echo "tag=$TAG"
+            echo "stable=$stable"
+            echo "commit=$commit"
+          } >> "$GITHUB_OUTPUT"
+          echo "promote $TAG ($commit) to $stable"
+
+      - name: Resolve release notes
+        id: notes
+        env:
+          STABLE: ${{ steps.meta.outputs.stable }}
+          RELEASE_NOTES_INPUT: ${{ inputs.release_notes }}
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          set -euo pipefail
+          python3 - <<'PY'
+          import os
+          import re
+
+          stable = os.environ["STABLE"]
+          notes = os.environ.get("RELEASE_NOTES_INPUT", "")
+          if not notes.strip():
+              text = open("CHANGELOG.md", encoding="utf-8").read()
+              match = re.search(r"^##\s+\[?" + re.escape(stable) + r"\]?.*$", text, re.MULTILINE)
+              if not match:
+                  raise SystemExit(f"::error::Add a '## [{stable}]' section to CHANGELOG.md, or pass release_notes")
+              rest = text[match.end():]
+              next_heading = re.search(r"^##\s+", rest, re.MULTILINE)
+              notes = (rest[: next_heading.start()] if next_heading else rest).strip()
+          path = os.path.join(os.environ["RUNNER_TEMP"], "notes.md")
+          with open(path, "w", encoding="utf-8")
```

**File**: `.github/workflows/release.yml` (modified, +25/-0)
```diff
@@ -293,6 +293,30 @@ jobs:
             echo "dmg-digest=sha256:${dmg_hex}"
           } >> "$GITHUB_OUTPUT"
 
+      # generate_appcast drops the notes of prior archives it re-reads for
+      # deltas; Prepare appcasts restores them from this copy.
+      - name: Snapshot current appcast
+        id: previous-appcast
+        env:
+          GH_TOKEN: ${{ secrets.UPDATES_GITHUB_TOKEN }}
+        run: |
+          set -euo pipefail
+          path="$RUNNER_TEMP/appcast-before.xml"
+          # Raw, because the JSON form leaves content empty above 1 MB.
+          if gh api -H "Accept: application/vnd.github.raw" \
+            "repos/${UPDATES_REPOSITORY}/contents/appcast.xml?ref=gh-pages" \
+            > "$path" 2> "$RUNNER_TEMP/appcast-before.err" && [[ -s "$path" ]]; then
+            echo "path=$path" >> "$GITHUB_OUTPUT"
+          elif grep -q 'HTTP 404' "$RUNNER_TEMP/appcast-before.err"; then
+            echo "No appcast yet; nothing to restore"
+            echo "path=" >> "$GITHUB_OUTPUT"
+          else
+            # Publishing without it would wipe the notes of every prior release.
+            cat "$RUNNER_TEMP/appcast-before.err"
+            echo "::error::Could not snapshot the current appcast"
+            exit 1
+          fi
+
       - name: Sparkle ZIP and appcast
         id: sparkle
         uses: thaw-app/org-ci/actions/sparkle-release@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
@@ -318,6 +342,7 @@ jobs:
         with:
           appcast-path: ${{ steps.sparkle.outputs.appcast-path }}
           release-tag: ${{ steps.meta.outputs.tag }}
+          previous-appcast-path: ${{ steps.previous-appcast.outputs.path }}
 
       - name: Collect update assets
         id: update-assets
```

**File**: `docs/RELEASES.md` (modified, +27/-2)
```diff
@@ -230,6 +230,28 @@ that build and are offered nothing; stable subscribers pick it up. Two items
 sharing a version and differing only by channel is the case to avoid. For 2.x
 releases, promotion also reaches the mirrored legacy appcast.
 
+### Promoting a release candidate
+
+[`.github/workflows/promote.yml`](../.github/workflows/promote.yml) ships a
+published candidate as stable without rebuilding it. This only works for a
+candidate **built with its final version**: `MARKETING_VERSION = "2.1.0"`, a new
+build number, tagged `2.1.0-rc.1`. The version string is inside the signed app,
+so a build made as `2.1.0-rc.1` would say so in About forever, and the workflow
+refuses it. While the build is on the beta channel, appcast preparation shows
+the tag as its version, so testers still see `2.1.0-rc.1`.
+
+1. Add a `## [2.1.0]` section to `CHANGELOG.md` on `development`.
+2. Run **Promote** from `development` with **tag** `2.1.0-rc.1` (dry run first).
+
+It removes the item's channel, renames it `2.1.0` and gives it the stable notes;
+uploads the same ZIP as `Thaw_2.1.0.zip` to a `2.1.0` release on
+`thaw-app/updates`, so later stable releases can build deltas from it; tags
+`2.1.0` on the candidate's commit; and publishes a `2.1.0` release with the
+candidate's DMG, SBOM, Sigstore bundles and provenance, which still verify
+because the bytes are the same. `generate_appcast --channel` only applies to
+items it creates, so later releases leave the promoted item alone. Each step checks for its own
+result first, so a run that fails partway can be rerun with the same tag.
+
 Switching *away* from alpha does not roll a user back. The alpha app's version
 line is ahead of the shipping app's, so the stable feed offers nothing newer
 and Sparkle stays put. Returning to the shipping app is a reinstall, which is
@@ -255,8 +277,11 @@ Only **new** items point at `thaw-app/updates` releases.
 ## Appcast preparation
 
 The local [`prepare-appcasts`](../.github/actions/prepare-appcasts/action.yml)
-action owns both appcast rules: reapply missing macOS 26 caps to 2.x entries,
-and generate a 1.x/2.x-only legacy feed when releasing a 2.x tag. It uses Python's
+action owns the appcast rules: reapply missing macOS 26 caps to 2.x entries,
+show a channel item's tag as its version (`2.1.0-rc.1` for a build made as
+`2.1.0`), restore the notes `generate_appcast` drops from every earlier archive
+it re-reads for deltas (from a snapshot of the feed taken before the run), and
+generate a 1.x/2.x-only legacy feed when releasing a 2.x tag. It uses Python's
 standard-library XML parser without external dependencies. Its two output paths
 feed publishing, dry-run comparisons, and artifact uploads.
 
```

---

### Incident Patch 3: `87839d2b` (2026-10-01)
**Commit Message**: ci(release): build local sources and prepare appcasts (#1216)

Remove private-source build plumbing and use each checked-out ref's deployment target. Preserve local workflow actions across tag checkout and select the latest installed Xcode.

Centralize appcast preparation in a Python composite action, retain the macOS 26 cap for 2.x, and filter newer release lines out of the legacy mirror. Add direct regression tests and update release documentation.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `.github/actions/checkout-source/action.yml` (modified, +35/-274)
```diff
@@ -1,326 +1,87 @@
 name: Checkout source
-description: >-
-  Check out the repository a Thaw build comes from. "Thaw" is this repository;
-  "thaw-next" is the private macOS 27 codebase, which needs a read token and
-  one binary package fetched by hand. Everything specific to building
-  thaw-next from this repository lives here, so when that source is merged or
-  published the whole directory can be deleted and callers go back to a plain
-  actions/checkout.
+description: Check out this repository and report its release build settings.
 
 inputs:
-  source:
-    description: Thaw or thaw-next
-    required: true
   ref:
-    description: Branch, tag, or commit to check out (empty = default branch)
+    description: Branch, tag, or commit to check out (empty = triggering commit)
     required: false
     default: ""
   fetch-depth:
     description: Passed to actions/checkout
     required: false
     default: "1"
-  thaw-next-token:
-    description: >-
-      Fine-grained PAT with contents read on thaw-app/thaw-next and on the
-      repository that publishes its binary package. Only read when source is
-      thaw-next.
-    required: false
-    default: ""
-  binary-package:
-    description: >-
-      SwiftPM identity of the binary package thaw-next pins from a private
-      release (the THAW_NEXT_BINARY_PACKAGE repository variable). Only read
-      when source is thaw-next; never written into this repository.
-    required: false
-    default: ""
-  github-token:
-    description: Token for the Thaw source (defaults to the job token)
-    required: false
-    default: ${{ github.token }}
 
 outputs:
   repository:
     description: owner/name that was checked out
-    value: ${{ steps.meta.outputs.repository }}
+    value: ${{ github.repository }}
   commit:
     description: Full commit SHA that was checked out
     value: ${{ steps.meta.outputs.commit }}
   project-name:
-    description: Xcode project to build, or empty when a workspace is used
+    description: Xcode project to build
     value: ${{ steps.meta.outputs.project_name }}
-  workspace-name:
-    description: Xcode workspace to build, or empty when the project is used
-    value: ${{ steps.meta.outputs.workspace_name }}
   deployment-target:
-    description: MACOSX_DEPLOYMENT_TARGET for this source
+    description: MACOSX_DEPLOYMENT_TARGET from the app's Release configuration
     value: ${{ steps.meta.outputs.deployment_target }}
-  swift-compiler:
-    description: >-
-      The swiftlang build string (for example swiftlang-6.4.0.27.1) the
-      binary package's Swift module was compiled by, or empty when the source
-      has no such constraint. The binary ships without library evolution, so
-      only the Xcode carrying exactly this compiler can import it; the Select
-      Xcode step picks by it.
-    value: ${{ steps.binary.outputs.swift_compiler }}
 
 runs:
   using: composite
   steps:
-    - name: Resolve the source token
-      id: token
-      shell: bash
-      env:
-        SOURCE: ${{ inputs.source }}
-        INPUT_REF: ${{ inputs.ref }}
-        THAW_NEXT_TOKEN: ${{ inputs.thaw-next-token }}
-        GITHUB_TOKEN: ${{ inputs.github-token }}
-      run: |
-        set -euo pipefail
-        case "$SOURCE" in
-          Thaw)
-            token="$GITHUB_TOKEN"
-            repository="$GITHUB_REPOSITORY"
-            ;;
-          thaw-next)
-            if [[ -z "$THAW_NEXT_TOKEN" ]]; then
-              echo "::error::thaw-next-token is empty; set THAW_NEXT_READ_TOKEN where this workflow reads its secrets"
-              exit 1
-            fi
-            token="$THAW_NEXT_TOKEN"
-            repository="thaw-app/thaw-next"
-            ;;
-          *)
-            echo "::error::Unsupported source: $SOURCE"
-            exit 1
-            ;;
-        esac
-        # actions/checkout resolves an empty ref on the triggering repository
-        # to github.context.ref, the ref that dispatched the workflow, not to
-        # the default branch the "empty = default branch" contract promises.
-        # Resolve the default branch explicitly for Thaw; thaw-next keeps the
-        # empty ref, for which checkout already uses the foreign default branch.
-        checkout_ref=""
-        if [[ "$SOURCE" == "Thaw" && -z "$INPUT_REF" ]]; then
-          checkout_ref="refs/heads/$(gh api "repos/$GITHUB_REPOSITORY" --jq .default_branch)"
-        fi
-        echo "::add-mask::$token"
-        {
-          echo "token=$token"
-          echo "repository=$repository"
-          echo "ref=$checkout_ref"
-        } >> "$GITHUB_OUTPUT"
-
-    # Checking out over the caller's sparse checkout of this repository is
-    # fine for the build: actions/checkout wipes the directory when the remote
-    # differs and reuses it when it matches. It is not fine for the runner,
-    # which comes back to this directory at the end of the job to run the
-    # post steps of the actions used here and fails the job when the action
-    # file
```

**File**: `.github/actions/prepare-appcasts/action.yml` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+name: Prepare Thaw appcasts
+description: Apply the macOS 26 cap to 2.x entries and prepare the legacy feed for 2.x releases.
+
+inputs:
+  appcast-path:
+    description: Signed appcast generated by Sparkle (left unchanged)
+    required: true
+  release-tag:
+    description: Release tag; only 2.x releases produce a legacy feed
+    required: true
+
+outputs:
+  appcast-path:
+    description: Canonical appcast with the 2.x macOS cap applied
+    value: ${{ steps.prepare.outputs.appcast-path }}
+  legacy-appcast-path:
+    description: Appcast containing only 1.x and 2.x entries, or empty for other release lines
+    value: ${{ steps.prepare.outputs.legacy-appcast-path }}
+
+runs:
+  using: composite
+  steps:
+    - name: Prepare appcasts
+      id: prepare
+      shell: bash
+      env:
+        ACTION_PATH: ${{ github.action_path }}
+        APPCAST_PATH: ${{ inputs.appcast-path }}
+        RELEASE_TAG: ${{ inputs.release-tag }}
+      run: python3 "$ACTION_PATH/prepare_appcasts.py"
```

**File**: `.github/actions/prepare-appcasts/prepare_appcasts.py` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+from __future__ import annotations
+
+import os
+from pathlib import Path
+from xml.dom import Node, minidom
+
+SPARKLE_NS = "http://www.andymatuschak.org/xml-namespaces/sparkle"
+
+
+def sparkle_elements(item, name):
+    return [
+        child for child in item.childNodes
+        if child.nodeType == Node.ELEMENT_NODE
+        and child.namespaceURI == SPARKLE_NS and child.localName == name
+    ]
+
+
+def prepare_appcasts(xml: bytes, release_tag: str) -> tuple[bytes, bytes | None]:
+    # DOM serialization preserves CDATA, namespace prefixes, and enclosure signatures.
+    with minidom.parseString(xml) as document:
+        legacy_exclusions = []
+        for item in document.getElementsByTagName("item"):
+            versions = sparkle_elements(item, "shortVersionString")
+            if len(versions) != 1:
+                raise ValueError("Appcast item must have one sparkle:shortVersionString")
+            version = "".join(
+                node.data for node in versions[0].childNodes
+                if node.nodeType in (Node.TEXT_NODE, Node.CDATA_SECTION_NODE)
+            ).strip()
+            if not version:
+                raise ValueError("Appcast item has an empty sparkle:shortVersionString")
+
+            # generate_appcast can rewrite prior entries, so reapply missing caps on every run.
+            if version.startswith("2.") and not sparkle_elements(item, "maximumSystemVersion"):
+                minimums = sparkle_elements(item, "minimumSystemVersion")
+                if len(minimums) != 1:
+                    raise ValueError(f"{version} must have one minimumSystemVersion to anchor the cap on")
+                minimum = minimums[0]
+                name = f"{minimum.prefix}:maximumSystemVersion" if minimum.prefix else "maximumSystemVersion"
+                maximum = document.createElementNS(SPARKLE_NS, name)
+                maximum.appendChild(document.createTextNode("26.99"))
+                spacing = minimum.nextSibling
+                item.insertBefore(maximum, spacing)
+                if spacing and spacing.nodeType == Node.TEXT_NODE and not spacing.data.strip():
+                    item.insertBefore(spacing.cloneNode(True), maximum)
+
+            if not version.startswith(("1.", "2.")):
+                legacy_exclusions.append(item)
+
+        canonical = document.toxml(encoding="utf-8")
+        if not release_tag.startswith("2."):
+            return canonical, None
+
+        for item in legacy_exclusions:
+            item.parentNode.removeChild(item)
+            item.unlink()
+        return canonical, document.toxml(encoding="utf-8")
+
+
+def main():
+    canonical, legacy = prepare_appcasts(
+        Path(os.environ["APPCAST_PATH"]).read_bytes(), os.environ["RELEASE_TAG"]
+    )
+    directory = Path(os.environ["RUNNER_TEMP"]) / "thaw-appcasts"
+    directory.mkdir(parents=True, exist_ok=True)
+    canonical_path = directory / "appcast.xml"
+    canonical_path.write_bytes(canonical)
+    legacy_path = directory / "legacy-appcast.xml"
+    if legacy is not None:
+        legacy_path.write_bytes(legacy)
+    else:
+        legacy_path.unlink(missing_ok=True)
+    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
+        output.write(f"appcast-path={canonical_path}\n")
+        output.write(f"legacy-appcast-path={legacy_path if legacy is not None else ''}\n")
+
+
+if __name__ == "__main__":
+    main()
```

**File**: `.github/actions/prepare-appcasts/tests/test_prepare_appcasts.py` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import os
+from pathlib import Path
+import subprocess
+import sys
+import tempfile
+import unittest
+from xml.dom import minidom
+
+ACTION_PATH = Path(__file__).resolve().parents[1]
+sys.path.insert(0, str(ACTION_PATH))
+from prepare_appcasts import SPARKLE_NS, prepare_appcasts
+
+
+def feed(*versions):
+    items = "".join(
+        f"""<item>
+  <sparkle:shortVersionString>{version}</sparkle:shortVersionString>
+  <sparkle:minimumSystemVersion>26.0</sparkle:minimumSystemVersion>
+  <description><![CDATA[<p>Notes & details</p>]]></description>
+  <enclosure url="https://example.org/{version}.zip" sparkle:edSignature="signature-{version}" length="123" type="application/octet-stream"/>
+</item>"""
+        for version in versions
+    )
+    return f'<rss xmlns:sparkle="{SPARKLE_NS}" version="2.0"><channel><title>Thaw</title>{items}</channel></rss>'.encode()
+
+
+def versions(xml):
+    with minidom.parseString(xml) as document:
+        return [node.firstChild.data for node in document.getElementsByTagNameNS(SPARKLE_NS, "shortVersionString")]
+
+
+class PrepareAppcastsTests(unittest.TestCase):
+    def test_mixed_feed_keeps_all_canonical_entries_and_only_legacy_versions_in_mirror(self):
+        all_versions = ["3.0.0-alpha.7", "3.0.0-beta.1", "3.0.0", "4.0.0", "2.1.0-beta.6", "2.0.1", "1.2.0"]
+        canonical, legacy = prepare_appcasts(feed(*all_versions), "2.1.0-beta.6")
+        self.assertEqual(versions(canonical), all_versions)
+        self.assertEqual(versions(legacy), ["2.1.0-beta.6", "2.0.1", "1.2.0"])
+        for xml in (canonical, legacy):
+            self.assertIn(b"<![CDATA[<p>Notes & details</p>]]>", xml)
+            with minidom.parseString(xml) as document:
+                for item in document.getElementsByTagName("item"):
+                    version = item.getElementsByTagNameNS(SPARKLE_NS, "shortVersionString")[0].firstChild.data
+                    enclosure = item.getElementsByTagName("enclosure")[0]
+                    self.assertEqual(enclosure.getAttributeNS(SPARKLE_NS, "edSignature"), f"signature-{version}")
+                    self.assertEqual(enclosure.getAttribute("url"), f"https://example.org/{version}.zip")
+                    self.assertEqual(enclosure.getAttribute("length"), "123")
+                    caps = item.getElementsByTagNameNS(SPARKLE_NS, "maximumSystemVersion")
+                    self.assertEqual([cap.firstChild.data for cap in caps], ["26.99"] if version.startswith("2.") else [])
+
+    def test_existing_cap_is_preserved_and_preparation_is_idempotent(self):
+        xml = feed("2.0.1").replace(b"</item>", b"<sparkle:maximumSystemVersion>26.5</sparkle:maximumSystemVersion></item>")
+        canonical, legacy = prepare_appcasts(xml, "2.0.1")
+        self.assertEqual(prepare_appcasts(canonical, "2.0.1"), (canonical, legacy))
+        self.assertIn(b">26.5<", canonical)
+        self.assertNotIn(b">26.99<", canonical)
+
+    def test_new_cap_is_idempotent(self):
+        canonical, legacy = prepare_appcasts(feed("2.0.1", "1.2.0"), "2.0.1")
+        self.assertEqual(prepare_appcasts(canonical, "2.0.1"), (canonical, legacy))
+        self.assertEqual(versions(legacy), ["2.0.1", "1.2.0"])
+
+    def test_three_x_release_still_caps_two_x_but_has_no_legacy_feed(self):
+        canonical, legacy = prepare_appcasts(feed("3.0.0-beta.1", "2.0.1"), "3.0.0-beta.1")
+        self.assertIsNone(legacy)
+        self.assertIn(b">26.99<", canonical)
+        self.assertEqual(versions(canonical), ["3.0.0-beta.1", "2.0.1"])
+
+    def test_alternate_namespace_prefix(self):
+        xml = feed("2.0.1").replace(b"sparkle:", b"s:").replace(b"xmlns:sparkle=", b"xmlns:s=")
+        canonical, _ = prepare_appcasts(xml, "2.0.1")
+        self.assertIn(b"<s:maximumSystemVersion>26.99</s:maximumSystemVersion>", canonical)
+        minidom.parseString(canonical).unlink()
+
+    def test_missing_version_or_minimum_fails(self):
+        for field in ("shortVersionString", "minimumSystemVersion"):
+            with self.subTest(field=field):
+                xml = feed("2.0.1")
+                with minidom.parseString(xml) as document:
+                    node = document.getElementsByTagNameNS(SPARKLE_NS, field)[0]
+                    node.parentNode.removeChild(node)
+                    xml = document.toxml(encoding="utf-8")
+                with self.assertRaises(ValueError):
+                    prepare_appcasts(xml, "2.0.1")
+
+    def test_empty_feed(self):
+        canonical, legacy = prepare_appcasts(feed(), "2.0.1")
+        self.assertEqual(versions(canonical), [])
+        self.assertEqual(versions(legacy), [])
+
+    def test_action_entry_point_outputs_paths_without_modifying_source(self):
+        with tempfile.TemporaryDirectory() as directory:
+            directory = Path(directory)
+            source = directory / "source.xml"
+            original = feed("3.0.0", "2.0.1")
+            source.write_bytes(original)
+            output = director
```

**File**: `.github/workflows/build-dmg.yml` (modified, +7/-54)
```diff
@@ -1,27 +1,18 @@
 name: Build DMG
 
 # Manual signed, notarized DMG as a short-lived artifact, never a release.
-# source=thaw-next needs THAW_NEXT_READ_TOKEN at repository level too.
 
 on:
   workflow_dispatch:
     inputs:
-      source:
-        description: Repository to build (thaw-next is the private macOS 27 codebase)
-        required: true
-        type: choice
-        default: Thaw
-        options:
-          - Thaw
-          - thaw-next
       ref:
-        description: Branch, tag, or commit to build (empty = the source repository's default branch)
+        description: Branch, tag, or commit to build (empty = the commit on the selected workflow branch)
         required: false
         type: string
         default: ""
 
 concurrency:
-  group: build-dmg-${{ inputs.source }}-${{ inputs.ref || github.ref }}
+  group: build-dmg-${{ inputs.ref || github.ref }}
   cancel-in-progress: true
 
 permissions:
@@ -47,49 +38,12 @@ jobs:
         id: source
         uses: ./.github/actions/checkout-source
         with:
-          source: ${{ inputs.source }}
           ref: ${{ inputs.ref }}
-          thaw-next-token: ${{ secrets.THAW_NEXT_READ_TOKEN }}
-          binary-package: ${{ vars.THAW_NEXT_BINARY_PACKAGE }}
 
-      - name: Select Xcode
-        env:
-          XCODE_APP: Xcode_27
-          # thaw-next: the exact compiler its binary package was built with; the package
-          # has no library evolution, so a newer Xcode can't import it.
-          REQUIRED_SWIFT: ${{ steps.source.outputs.swift-compiler }}
-        run: |
-          set -euo pipefail
-          shopt -s nullglob
-          # A prefix, so a preview image's Xcode_27.0-beta.N.app is picked up
-          # as well as a final Xcode_27.0.app. The last glob match sorts highest.
-          candidates=(/Applications/"${XCODE_APP}"*.app)
-          if [[ ${#candidates[@]} -eq 0 ]]; then
-            echo "No /Applications/${XCODE_APP}*.app on this runner. Installed:"
-            ls -d /Applications/Xcode*.app || true
-            exit 1
-          fi
-          selected=""
-          if [[ -n "$REQUIRED_SWIFT" ]]; then
-            for candidate in "${candidates[@]}"; do
-              swiftc="$candidate/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc"
-              if [[ -x "$swiftc" ]] && "$swiftc" --version 2>/dev/null | grep -qF "$REQUIRED_SWIFT"; then
-                selected="$candidate"
-              fi
-            done
-            if [[ -z "$selected" ]]; then
-              echo "No installed Xcode carries ${REQUIRED_SWIFT}, which the binary package requires. Installed:"
-              for candidate in "${candidates[@]}"; do
-                swiftc="$candidate/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc"
-                echo "  $candidate: $("$swiftc" --version 2>/dev/null | head -1)"
-              done
-              exit 1
-            fi
-          else
-            selected="${candidates[${#candidates[@]}-1]}"
-          fi
-          sudo xcode-select -s "$selected/Contents/Developer"
-          xcodebuild -version
+      - name: Select latest installed Xcode (including betas)
+        uses: maxim-lobanov/setup-xcode@ed7a3b1fda3918c0306d1b724322adc0b8cc0a90 # v1.7.0
+        with:
+          xcode-version: latest
 
       - name: Configure signing
         uses: thaw-app/org-ci/actions/configure-signing@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
@@ -105,7 +59,6 @@ jobs:
         with:
           apple-team-id: ${{ secrets.APPLE_TEAM_ID }}
           project-name: ${{ steps.source.outputs.project-name }}
-          workspace-name: ${{ steps.source.outputs.workspace-name }}
           scheme-name: Thaw
           deployment-target: ${{ steps.source.outputs.deployment-target }}
 
@@ -125,7 +78,7 @@ jobs:
       - name: Upload DMG
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
         with:
-          name: Thaw-dmg-${{ inputs.source }}-${{ steps.source.outputs.commit }}
+          name: Thaw-dmg-${{ steps.source.outputs.commit }}
           path: build/${{ env.DMG_NAME }}
           retention-days: 3
 
```

**File**: `.github/workflows/release.yml` (modified, +65/-211)
```diff
@@ -7,17 +7,9 @@ on:
   workflow_dispatch:
     inputs:
       tag:
-        description: Existing release tag to publish (for example, 1.2.3 or 2.0.0-rc.1)
+        description: Existing release tag to publish (for example, 3.0.0-beta.1)
         required: true
         type: string
-      source:
-        description: Repository the tag is built from (thaw-next is the private macOS 27 codebase)
-        required: true
-        type: choice
-        default: Thaw
-        options:
-          - Thaw
-          - thaw-next
       channel:
         description: Sparkle channel (auto infers from tag suffix)
         required: true
@@ -110,11 +102,8 @@ jobs:
         id: source
         uses: ./.github/actions/checkout-source
         with:
-          source: ${{ inputs.source }}
           ref: refs/tags/${{ inputs.tag }}
           fetch-depth: 0
-          thaw-next-token: ${{ secrets.THAW_NEXT_READ_TOKEN }}
-          binary-package: ${{ vars.THAW_NEXT_BINARY_PACKAGE }}
 
       - name: Resolve tag and channel
         id: meta
@@ -168,19 +157,9 @@ jobs:
         env:
           TAG: ${{ steps.meta.outputs.tag }}
           RELEASE_NOTES_INPUT: ${{ inputs.release_notes }}
-          SOURCE_REPOSITORY: ${{ steps.source.outputs.repository }}
-          GH_TOKEN: ${{ github.token }}
         run: |
           set -euo pipefail
-          # The changelog lives here even for thaw-next builds, so fetch this
-          # repository's CHANGELOG.md at the dispatching ref.
-          own_changelog=""
-          if [[ "$SOURCE_REPOSITORY" != "$GITHUB_REPOSITORY" ]]; then
-            own_changelog="$RUNNER_TEMP/CHANGELOG.md"
-            gh api "repos/${GITHUB_REPOSITORY}/contents/CHANGELOG.md?ref=${GITHUB_SHA}" \
-              -H "Accept: application/vnd.github.raw" > "$own_changelog"
-          fi
-          OWN_CHANGELOG="$own_changelog" python3 - <<'PY'
+          python3 - <<'PY'
           import os
           import re
           import uuid
@@ -190,9 +169,8 @@ jobs:
           source = "release_notes input"
 
           # Without manual notes, use this tag's CHANGELOG.md section ("## [x.y.z]" to
-          # the next "## "), trying OWN_CHANGELOG first on cross-repo builds.
-          candidates = [os.environ.get("OWN_CHANGELOG", ""), "CHANGELOG.md", "Thaw/Resources/CHANGELOG.md"]
-          candidates = [p for p in candidates if p]
+          # the next "## ") from the checked-out release tag.
+          candidates = ["CHANGELOG.md", "Thaw/Resources/CHANGELOG.md"]
           changelog = next((p for p in candidates if os.path.isfile(p)), None)
           if not notes.strip() and changelog:
               text = open(changelog, encoding="utf-8").read()
@@ -218,44 +196,10 @@ jobs:
           print(f"Release notes source: {source}")
           PY
 
-      - name: Select Xcode
-        env:
-          XCODE_APP: Xcode_27
-          # thaw-next: the exact compiler its binary package was built with; the package
-          # has no library evolution, so a newer Xcode can't import it.
-          REQUIRED_SWIFT: ${{ steps.source.outputs.swift-compiler }}
-        run: |
-          set -euo pipefail
-          shopt -s nullglob
-          # A prefix, so a preview image's Xcode_27.0-beta.N.app is picked up
-          # as well as a final Xcode_27.0.app. The last glob match sorts highest.
-          candidates=(/Applications/"${XCODE_APP}"*.app)
-          if [[ ${#candidates[@]} -eq 0 ]]; then
-            echo "No /Applications/${XCODE_APP}*.app on this runner. Installed:"
-            ls -d /Applications/Xcode*.app || true
-            exit 1
-          fi
-          selected=""
-          if [[ -n "$REQUIRED_SWIFT" ]]; then
-            for candidate in "${candidates[@]}"; do
-              swiftc="$candidate/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc"
-              if [[ -x "$swiftc" ]] && "$swiftc" --version 2>/dev/null | grep -qF "$REQUIRED_SWIFT"; then
-                selected="$candidate"
-              fi
-            done
-            if [[ -z "$selected" ]]; then
-              echo "No installed Xcode carries ${REQUIRED_SWIFT}, which the binary package requires. Installed:"
-              for candidate in "${candidates[@]}"; do
-                swiftc="$candidate/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc"
-                echo "  $candidate: $("$swiftc" --version 2>/dev/null | head -1)"
-              done
-              exit 1
-            fi
-          else
-            selected="${candidates[${#candidates[@]}-1]}"
-          fi
-          sudo xcode-select -s "$selected/Contents/Developer"
-          xcodebuild -version
+      - name: Select latest installed Xcode (including betas)
+        uses: maxim-lobanov/setup-xcode@ed7a3b1fda3918c0306d1b724322adc0b8cc0a90 # v1.7.0
+        with:
+          xcode-version: latest
 
       - name: Configure signing
         uses: thaw-app/org-ci/actions/configure-signing@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
@
```

**File**: `docs/RELEASES.md` (modified, +60/-15)
```diff
@@ -99,6 +99,10 @@ pass it as the action `token` input, because softprops v3 ignores `env: GITHUB_T
 
 ## Dispatching a release
 
+Releases build an existing tag in `thaw-app/Thaw`, using that tag's project,
+deployment target, dependencies, and changelog. There is no separate source
+repository or private-package token to configure.
+
 The workflow is `workflow_dispatch` only, and its **tag** input is free text:
 Actions `choice` inputs are a static list in the YAML, so they cannot be filled
 from the tags that exist. [`scripts/release.sh`](../scripts/release.sh) supplies
@@ -111,8 +115,25 @@ scripts/release.sh          # override the target with REPO=owner/repo
 ```
 
 Anything the script does can be done by hand from the Actions tab or with
-`gh workflow run release.yml -f tag=2.1.0 ...`; the script only removes the
-chance of dispatching a tag that does not exist.
+`gh workflow run release.yml -f tag=3.0.0-beta.1 ...`; the script only removes the
+chance of dispatching a tag that does not exist. A `3.0.0-beta.1` tag selects the
+beta channel automatically.
+
+### Xcode selection
+
+Release and DMG builds use `setup-xcode` with `xcode-version: latest` on the
+`xcode-27` runner. This selects the newest installed Xcode, including betas;
+it does not download versions that are absent from the runner. The action is
+pinned to a commit, but the Xcode version follows runner-image updates. Use an
+exact `xcode-version` instead if a release needs a fixed toolchain.
+
+### Building a DMG without releasing
+
+[`.github/workflows/build-dmg.yml`](../.github/workflows/build-dmg.yml) builds a
+signed, notarized DMG as an artifact retained for three days. Select the workflow
+branch to build its triggering commit, or set **ref** to another branch, tag, or
+commit in this repository. Leaving **ref** empty does not switch to the default
+branch. The `.build` PR command uses this behavior to build the PR branch.
 
 ### Release discussions
 
@@ -126,8 +147,8 @@ step 7. Setting it on the draft in step 5 would do nothing.
 Check **Dry run** when dispatching the workflow to build and report without
 publishing anything. Steps 1–3 run normally; steps 4–7 are skipped, so no
 GitHub Release is created (not even a draft), nothing is cosign-signed or
-attested, and no appcast is pushed to either `thaw-app/updates` or the legacy
-mirror.
+attested, and no appcast is pushed. For 3.x releases, `thaw-app/updates` is the
+only appcast destination; 2.x releases also mirror to the legacy repository.
 
 Signing and attestation are skipped deliberately: cosign keyless signing and
 GitHub Artifact Attestations write permanent, public Sigstore / attestation
@@ -138,13 +159,16 @@ The run's job summary then reports:
 - every asset that *would* be uploaded, to which repository, with size and
   SHA-256, and whether the release would be a draft or published;
 - the SBOM component inventory;
-- a unified diff of the generated `appcast.xml` against the currently live feeds
-  at `thaw-app.github.io/updates` and `stonerl.github.io/Thaw`, so you can see
-  exactly what an update push would change.
+- a unified diff of the generated `appcast.xml` against the live feed at
+  `thaw-app.github.io/updates`, plus the filtered legacy appcast against
+  `stonerl.github.io/Thaw` for 2.x releases only, so you can see exactly what
+  each update push would change.
 
 The DMG checksum, SBOM (+ checksum), and generated appcast are attached to the
-run as a `dry-run-<tag>` artifact for local inspection. The DMG itself is not
-attached, because it is large and is rebuilt by the real release run.
+run as a `dry-run-<tag>` artifact for local inspection. For 2.x releases, this
+also includes `legacy-appcast.xml`, the filtered feed destined for the mirror.
+The DMG itself is not attached, because it is large and is rebuilt by the real
+release run.
 
 Dry runs use a separate concurrency group, so they never queue behind or block a
 real release.
@@ -203,8 +227,8 @@ Promotion between stable and beta stays cheap, because they share a feed: to
 move a build from beta to stable, drop its `sparkle:channel` rather than
 publishing a second item for the same version. Beta subscribers already have
 that build and are offered nothing; stable subscribers pick it up. Two items
-sharing a version and differing only by channel is the case to avoid. It also
-reaches the mirrored legacy appcast.
+sharing a version and differing only by channel is the case to avoid. For 2.x
+releases, promotion also reaches the mirrored legacy appcast.
 
 Switching *away* from alpha does not roll a user back. The alpha app's version
 line is ahead of the shipping app's, so the stable feed offers nothing newer
@@ -215,15 +239,36 @@ worth saying wherever alpha is advertised.
 
 Older builds may still poll `https://stonerl.github.io/Thaw/appcast.xml`
 (GitHub Pages from [`stonerl/Thaw`](https://github.com/stonerl/Thaw) `main`,
-path `/appcast.xml`). Release CI **mirrors** the same signed `appcast.xml` t
```

---

### Incident Patch 4: `1590afd5` (2026-10-01)
**Commit Message**: docs(changelog): add the display unplug fix to 3.0.0-beta.1 and date it today

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -7,7 +7,7 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
-## [3.0.0-beta.1] - 2026-09-30
+## [3.0.0-beta.1] - 2026-10-01
 
 **macOS 27 only · Build 111 · First beta**
 
@@ -95,6 +95,7 @@ Switches in Settings > Experiments swap these for Thaw icons you can move or hid
 
 - **Settings no longer crashes** on notched MacBooks or at 110% zoom. Reported by @ifangxiang and @NickBenthem in [#1194](https://github.com/thaw-app/Thaw/issues/1194).
 - **Thaw no longer reorders the menu bar around its own icons.**
+- **Unplugging a display no longer quits menu bar apps.** A different spacing on each display used to relaunch every app with a menu bar item, Chrome included. The new spacing now applies the next time those apps launch, or at once with Reapply Spacing. [#1215](https://github.com/thaw-app/Thaw/issues/1215)
 - **A full menu bar stays in order.** When macOS has no room to draw some Visible items, Thaw moves the extra ones to Hidden instead of rearranging the bar again and again.
 - **Apps with more than one icon stay where you put them.**
 - **Items keep their section** when you reorder Hidden or Always Hidden in Layout.
```

---

### Incident Patch 5: `bbbb29ab` (2026-10-01)
**Commit Message**: docs(changelog): note the UI cleanup in 3.0.0-beta.1

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -21,6 +21,11 @@ and the Sparkle appcast, unless overridden with the `release_notes` input.
 >
 > If your issue isn't fixed in this build, comment on it. Thank you to everyone who sent logs, recordings and crash reports.
 
+> [!NOTE]
+> **A leaner Thaw**
+>
+> We're trimming, tidying and improving the interface over the next betas. If something feels cluttered, confusing or missing, tell us on GitHub or Discord. Help is appreciated.
+
 > [!TIP]
 > **The short version**
 >
```

---

### Incident Patch 6: `51545ec3` (2026-09-30)
**Commit Message**: docs(changelog): update the 3.0.0-beta.1 notes for build 111

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +20/-3)
```diff
@@ -7,9 +7,9 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
-## [3.0.0-beta.1] - 2026-09-29
+## [3.0.0-beta.1] - 2026-09-30
 
-**macOS 27 only · Build 110 · First beta**
+**macOS 27 only · Build 111 · First beta**
 
 > [!IMPORTANT]
 > **This is the first 3.0.0 beta.**
@@ -29,13 +29,15 @@ and the Sparkle appcast, unless overridden with the `release_notes` input.
 > - New option to show Live Activities and the camera indicator while apps are hidden.
 > - Folders, opening items by letter, and rounded screen corners.
 > - Pick the icon Thaw shows for any item.
+> - Open hidden items in the menu bar, under their own icon.
 > - One menu for every item, and fewer settings.
 >
 > **What's fixed**
 > - Settings no longer crashes on notched MacBooks, or at 110% zoom.
 > - Passwords' menu bar key can move to Hidden.
 > - "Who arranges items" is now Item arrangement, and says what it does.
-> - Thaw no longer reorders the menu bar around its own icons.
+> - Thaw no longer reorders the menu bar around its own icons, or when it runs out of room.
+> - The camera and microphone indicators stay in view with the Live Activities option on.
 > - Fast User Switching, AirDrop, Focus and Now Playing stay reachable.
 > - macOS's » button works again on notched MacBooks.
 
@@ -69,6 +71,13 @@ For items macOS never draws on macOS 27.
 
 - **A new option in Settings > General** keeps Live Activities and the camera and microphone indicators on the menu bar while apps are hidden, and stops hidden items from flashing when Notification Center opens.
 - **It's in beta and off by default.** Thaw offers it once at launch and asks for access to one file.
+- **The camera and microphone indicator stays in Visible.** It could land among hidden items and stay out of sight.
+- **An app Control Center doesn't know stays on the bar** instead of switching the option back to the usual hiding, which hid the indicators again.
+
+### New: open hidden items in the menu bar
+
+- **Open hidden items in the menu bar**, in Settings > Thaw Bar, shows a hidden item in the menu bar and opens its menu under the icon, from the Thaw Bar, search or a shortcut. Off, the menu opens without the icon, as before.
+- **An app that ignores the click** still opens without its icon.
 
 ### Apple's items Thaw can't hide
 
@@ -91,6 +100,14 @@ Switches in Settings > Experiments swap these for Thaw icons you can move or hid
 
 - **Settings no longer crashes** on notched MacBooks or at 110% zoom. Reported by @ifangxiang and @NickBenthem in [#1194](https://github.com/thaw-app/Thaw/issues/1194).
 - **Thaw no longer reorders the menu bar around its own icons.**
+- **A full menu bar stays in order.** When macOS has no room to draw some Visible items, Thaw moves the extra ones to Hidden instead of rearranging the bar again and again.
+- **Apps with more than one icon stay where you put them.**
+- **Items keep their section** when you reorder Hidden or Always Hidden in Layout.
+- **The menu bar is no longer covered** while Thaw updates item pictures.
+- **Thaw waits while the screen is locked** instead of updating pictures and positions against the lock screen.
+- **Apple's items keep their pictures** on taller notched menu bars.
+- **The menu bar background follows reveals at once**, on the right display.
+- **The Thaw Bar stays put** when the Thaw icon is turned off.
 - **Hidden items open reliably**, and open in the Thaw Bar when the menu bar is full. Reported by @Kodiak-01 in [#1115](https://github.com/thaw-app/Thaw/issues/1115).
 - **macOS's » button works** on notched MacBooks. Reported by @joaofrgomes in [#1195](https://github.com/thaw-app/Thaw/issues/1195).
 - **Passwords' menu bar key can move to Hidden.** [#1205](https://github.com/thaw-app/Thaw/issues/1205)
```

---

### Incident Patch 7: `3baafa5b` (2026-09-27)
**Commit Message**: feat(menubar): move circuit breaker, #1190 drop fix, beta updates on macOS 27, and codebase cleanup (#1192)

* feat(menubar): let opened items stay a set time after their menu closes

A hidden item opened from search or the Thaw Bar went back to its section as soon as its menu closed. A single mis-click outside the menu therefore sent the item straight back, and using the same item a few times in a row meant searching for it again every time.

The new "Hide opened items again after" setting under General, After revealing, keeps the item in the menu bar for up to 30 seconds. The delay counts from the moment the menu closes, and reopening the menu restarts it. It defaults to 0 so the current behaviour is unchanged. The value is saved in profiles, reset with the other settings, reachable through settings search and settings URLs, and profiles written before it existed still load.

Closes #342

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* docs(changelog): add the hide-again delay to 2.1.0-beta.6

Starts the 2.1.0-beta.6 section with the new setting for how long an opened item stays in the menu bar after its menu closes.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* chore(lint

**File**: `.swiftformat` (modified, +4/-2)
```diff
@@ -14,8 +14,10 @@
 # --trailing-commas always: Matches 'trailing_comma: mandatory_comma: true'.
 --trailing-commas always
 
-# --header: Matches 'file_header' rule.
---header "//\n//  {file}\n//  Project: Thaw\n//\n//  Copyright (Ice) © 2023–2025 Jordan Baird\n//  Copyright (Thaw) © 2026 Toni Förster\n//  Licensed under the GNU GPLv3"
+# --header ignore: SwiftLint's 'file_header' rule checks the header. The Ice
+# line belongs only on files that still contain Jordan Baird's code, so a single
+# literal template here would stamp it back onto every file.
+--header ignore
 
 # --enable isEmpty: Opt-in rule to match SwiftLint's 'empty_count'.
 --enable isEmpty
```

**File**: `.swiftlint.yml` (modified, +2/-2)
```diff
@@ -61,8 +61,8 @@ file_header:
     //  SWIFTLINT_CURRENT_FILENAME
     //  Project: Thaw
     //
-    //  Copyright \(Ice\) © 2023–2025 Jordan Baird
-    //  Copyright \(Thaw\) © 2026 Toni Förster
+    (//  Copyright \(Ice\) © 2023–2025 Jordan Baird
+    )?//  Copyright \(Thaw\) © 2026 Toni Förster
     //  Licensed under the GNU GPLv3
 
 modifier_order:
```

**File**: `CHANGELOG.md` (modified, +21/-0)
```diff
@@ -7,6 +7,27 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
+## [2.1.0-beta.6] - 2026-09-26
+
+**macOS 26 only**
+
+Thaw stops rearranging your menu bar in a loop, drops into Always Hidden stay put, and macOS 27 users are pointed at the right update channel.
+
+### New
+
+- **Opened items can stay a while after their menu closes.** A hidden item you open from search or the Thaw Bar went back as soon as its menu closed, so one click in the wrong place sent it away and you had to find it again. "Hide opened items again after" (Settings > General > After revealing) keeps it in the menu bar for up to 30 seconds after the menu closes. It starts at 0 seconds, which works as before. [#342](https://github.com/thaw-app/Thaw/issues/342)
+- **Thaw pauses its own moves when they go wrong.** When the menu bar kept putting an item back, Thaw could drag it again and again, so your icons shuffled around. Failed moves also kept hiding the pointer while Thaw retried. Thaw now notices both and pauses its automatic moves for a minute, and longer if it happens again. Your own drags always go through, and a drag that lands ends the pause.
+
+### Fixes
+
+1. **Items dropped into Always Hidden stay there.** When Always Hidden held only a Control Center item whose app Thaw couldn't identify, a dragged item landed off-screen and jumped back to the visible section. Layout now places the drop at the edge of the section, and no longer lets you drag that Control Center item while it's parked out of sight. [#1190](https://github.com/thaw-app/Thaw/issues/1190)
+2. **The Thaw icon stays put after reconnecting a display on a notched Mac.** While macOS briefly reported Control Center in the wrong place, Thaw could restore your saved layout against that position and move the Thaw icon far to the left. It now waits for the menu bar to settle first.
+
+### Updates
+
+- **The macOS 27 notice sends you to beta updates.** If you run this version on macOS 27, the notice now says support comes through the alpha and beta channels, and its button switches you to beta updates. Until the first 3.0 beta is out, the beta channel on macOS 27 also offers the 3.0 alphas, so there's always a build that runs. Nothing changes on macOS 26.
+- **Under the hood.** A large cleanup: shorter code comments, less unused code, and the biggest source files split up. None of it should change how Thaw behaves. If something does, please report it.
+
 ## [3.0.0-alpha.7] - 2026-09-25
 
 **macOS 27 only · Build 108 · Beta candidate**
```

**File**: `MenuBarCaptureService/Listener.swift` (modified, +4/-12)
```diff
@@ -2,7 +2,6 @@
 //  Listener.swift
 //  Project: Thaw
 //
-//  Copyright (Ice) © 2023–2025 Jordan Baird
 //  Copyright (Thaw) © 2026 Toni Förster
 //  Licensed under the GNU GPLv3
 
@@ -25,9 +24,7 @@ final nonisolated class Listener: @unchecked Sendable {
     private var captureCount = 0
 
     private init() {
-        // Intentionally empty: the Connection is a singleton whose state
-        // initializes at its property declarations, so there is nothing to
-        // do here. The private visibility keeps external callers on `shared`.
+        // Intentionally empty: singleton state initializes at its declarations.
     }
 
     deinit {
@@ -42,9 +39,7 @@ final nonisolated class Listener: @unchecked Sendable {
                 return .start
             case let .configureLogging(filePath, rotationPolicy):
                 if let rotationPolicy {
-                    // The app owns the shared log directory's retention, so
-                    // pruning here follows its policy instead of this
-                    // target's defaults.
+                    // Prune by the app's retention policy, not this target's defaults.
                     DiagnosticLogger.shared.setRotationPolicy(rotationPolicy)
                 }
                 guard let filePath else {
@@ -64,11 +59,8 @@ final nonisolated class Listener: @unchecked Sendable {
                     return nil
                 }
                 guard DiagnosticLogger.shared.attachToFile(at: requested) else {
-                    // Answering success here would leave the app believing
-                    // both processes share a file while this one keeps
-                    // writing to the previous segment — which retention
-                    // eventually deletes out from under it. Failing the
-                    // request makes the app retry.
+                    // Replying success would leave this process writing to the old
+                    // segment, which retention later deletes. Failing makes the app retry.
                     diagLog.error(
                         "Capture listener failed to attach diagnostic logging to \(requested.path)"
                     )
```

**File**: `MenuBarCaptureService/main.swift` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@
 //  main.swift
 //  Project: Thaw
 //
-//  Copyright (Ice) © 2023–2025 Jordan Baird
 //  Copyright (Thaw) © 2026 Toni Förster
 //  Licensed under the GNU GPLv3
 
```

**File**: `MenuBarItemService/ExtrasMenuBarProbeStore.swift` (modified, +5/-12)
```diff
@@ -2,21 +2,16 @@
 //  ExtrasMenuBarProbeStore.swift
 //  Project: Thaw
 //
-//  Copyright (Ice) © 2023–2025 Jordan Baird
 //  Copyright (Thaw) © 2026 Toni Förster
 //  Licensed under the GNU GPLv3
 
 import Foundation
 
 /// Reads and writes ``ExtrasMenuBarProbeMemory``'s contents.
 ///
-/// The service has no access to the app's `Defaults`, and does not need it:
-/// this memory is written by the process that does the probing and read by
-/// nobody else, so it lives in the service's own defaults domain
-/// (`com.stonerl.Thaw.MenuBarItemService`). Keeping it out of the app's
-/// domain also keeps it out of everything that treats that domain as user
-/// settings — this is a measurement, not a preference, and losing it costs
-/// one slow scan.
+/// Stored in the service's own defaults domain
+/// (`com.stonerl.Thaw.MenuBarItemService`), not the app's: it is a
+/// measurement, not a user setting, and losing it costs one slow scan.
 nonisolated enum ExtrasMenuBarProbeStore {
     private static let key = "ExtrasMenuBarProbeMisses"
 
@@ -29,10 +24,8 @@ nonisolated enum ExtrasMenuBarProbeStore {
 
     /// Writes `misses`, unless it matches what is already stored.
     ///
-    /// The write guard is what makes it safe to call this from the cache
-    /// cleanup, which runs whenever any process on the system starts or exits
-    /// — roughly every nine seconds in the field. The memory converges within
-    /// the first minute of a session and then stops changing.
+    /// The write guard makes this safe to call from cache cleanup, which runs
+    /// on every process launch or exit (about every nine seconds).
     static func save(_ misses: [String: Int]) {
         guard misses != stored() else {
             return
```

**File**: `MenuBarItemService/Listener.swift` (modified, +6/-19)
```diff
@@ -16,16 +16,13 @@ import XPC
 /// target's default actor isolation is MainActor.
 final nonisolated class Listener: @unchecked Sendable {
     private let diagLog = DiagLog(category: "Listener")
-    /// The shared listener.
     static let shared = Listener()
 
-    /// The service name.
     private let name = MenuBarItemService.name
 
     /// The underlying XPC listener object.
     private var xpcListener: XPCListener?
 
-    /// Creates the shared listener.
     private init() {
         // Intentionally empty: this type is a singleton and is configured via `activate()`.
     }
@@ -34,7 +31,6 @@ final nonisolated class Listener: @unchecked Sendable {
         cancel()
     }
 
-    /// Handles a received message.
     private func handleMessage(_ message: XPCReceivedMessage) -> MenuBarItemService.Response? {
         do {
             let request = try message.decode(as: MenuBarItemService.Request.self)
@@ -55,11 +51,8 @@ final nonisolated class Listener: @unchecked Sendable {
                     diagLog.debug("Listener disabled diagnostic logging")
                     return .configureLogging
                 }
-                // Only attach to files inside the app's approved log
-                // directory. The path arrives from the XPC peer, and in
-                // teamless (ad-hoc) builds the listener has no peer
-                // requirement, so an arbitrary path could otherwise make
-                // this service open and append to any user-writable file.
+                // Only attach inside the approved log directory. Ad-hoc builds have no
+                // peer requirement, so a peer could otherwise point us at any writable file.
                 let requested = URL(fileURLWithPath: filePath)
                     .standardizedFileURL.resolvingSymlinksInPath()
                 let approvedDir = DiagnosticLogger.shared.logDirectory
@@ -71,10 +64,8 @@ final nonisolated class Listener: @unchecked Sendable {
                     return nil
                 }
                 guard DiagnosticLogger.shared.attachToFile(at: requested) else {
-                    // Answering success here would leave the app believing both
-                    // processes share a file while this one keeps writing to the
-                    // previous segment — which retention eventually deletes out
-                    // from under it. Failing the request makes the app retry.
+                    // Replying success would leave this process writing to the old
+                    // segment, which retention later deletes. Failing makes the app retry.
                     diagLog.error("Listener failed to attach diagnostic logging to \(requested.path)")
                     return nil
                 }
@@ -104,11 +95,8 @@ final nonisolated class Listener: @unchecked Sendable {
 
     /// Activates the listener.
     ///
-    /// Session peers must be signed with the same team identifier as the
-    /// service process. Builds signed without a team identifier
-    /// (ad-hoc/personal builds) activate without a peer requirement, since
-    /// `.isFromSameTeam()` can never be satisfied there and every session
-    /// would be cancelled before the first message.
+    /// Peers must share the service's team identifier. Ad-hoc builds skip the
+    /// peer requirement, since `.isFromSameTeam()` can never pass there.
     func activate() {
         guard xpcListener == nil else {
             diagLog.notice("Listener is already active")
@@ -132,7 +120,6 @@ final nonisolated class Listener: @unchecked Sendable {
         }
     }
 
-    /// Cancels the listener.
     func cancel() {
         diagLog.debug("Canceling listener")
         xpcListener.take()?.cancel()
```

**File**: `MenuBarItemService/SourcePIDCache.swift` (modified, +93/-272)
```diff
@@ -13,32 +13,16 @@ import os
 
 /// A cache for the source process identifiers for menu bar item windows.
 ///
-/// We use the term "source process" to refer to the process that created
-/// a menu bar item. Originally, we used the CGWindowList API to get the
-/// window's owning process (`kCGWindowOwnerPID`), which was always the
-/// source process. However, as of macOS 26, item windows are owned by
-/// the Control Center.
+/// The "source process" is the process that created a menu bar item. As of
+/// macOS 26, item windows are owned by Control Center, so `kCGWindowOwnerPID`
+/// no longer identifies it and we resolve it through Accessibility instead.
+/// Accessibility calls block, so the work runs in this XPC service.
 ///
-/// We can find what we need using the Accessibility API, but doing it
-/// efficiently ends up being a fairly complex process. Since calls to
-/// Accessibility are thread blocking, we do most of the heavy lifting
-/// in a dedicated XPC service, which we then call asynchronously from
-/// the main app.
-///
-/// This type is an `actor`. Only the Combine observer wiring in
-/// `start()` (and its backing `cancellable` lazy var) is actually
-/// actor-isolated — that state had no synchronization of its own
-/// before this conversion. Everything else (`state`, `scanLock`, and
-/// the `CachedApplication` cache entries) was already protected by its
-/// own `OSAllocatedUnfairLock`, so those members and the methods that
-/// only touch them are marked `nonisolated`. This preserves the exact
-/// pre-actor concurrency semantics: cache-hit reads in `pidBody` can
-/// still proceed without waiting on an in-flight full AX scan, and
-/// `scanLock` (not actor isolation) is still what serializes full
-/// scans across concurrent callers. Making these methods actor-isolated
-/// instead would have serialized *all* calls — including fast
-/// cache-hit checks — behind any long-running blocking AX scan, which
-/// would have been a behavior change, not just a safety upgrade.
+/// Only the Combine wiring in `start()` (and `cancellable`) is actor-isolated.
+/// `state`, `scanLock`, and `CachedApplication` entries have their own
+/// `OSAllocatedUnfairLock`, so members that only touch them are `nonisolated`.
+/// Isolating them would serialize fast cache-hit reads behind blocking AX
+/// scans; `scanLock` is what serializes full scans.
 actor SourcePIDCache {
     private static let diagLog = DiagLog(category: "SourcePIDCache")
     /// An object that contains a running application and provides an
@@ -62,7 +46,6 @@ actor SourcePIDCache {
 
         private let lock = OSAllocatedUnfairLock(initialState: State())
 
-        /// The app's process identifier.
         var processIdentifier: pid_t {
             runningApp.processIdentifier
         }
@@ -98,11 +81,9 @@ actor SourcePIDCache {
         /// Whether an unexpired negative deadline would make
         /// ``getOrCreateExtrasMenuBar()`` skip its accessibility calls.
         ///
-        /// Diagnostics only, and sampled outside the lock that
-        /// ``getOrCreateExtrasMenuBar()`` takes, so it is a count rather
-        /// than a guarantee. It exists because a field log that reports
-        /// only "checked N apps" cannot distinguish a scan that probed the
-        /// whole system from one the negative cache spared.
+        /// Diagnostics only, sampled outside the lock that
+        /// ``getOrCreateExtrasMenuBar()`` takes, so it is a count rather than a
+        /// guarantee. It tells a full-system probe from one the negative cache spared.
         var isSkippingExtrasMenuBarProbe: Bool {
             lock.withLock { state in
                 guard state.extrasMenuBar == nil, let retryAfter = state.retryAfter else {
@@ -126,11 +107,9 @@ actor SourcePIDCache {
         /// application.
         ///
         /// - Parameter seed: What earlier sessions learned about this
-        ///   application, from ``ExtrasMenuBarProbeMemory``. Starting on a
-        ///   rung of the ladder rather than at the bottom is what keeps a
-        ///   cold start from re-probing the whole system; a seeded deadline
-        ///   still expires within seconds, so the memory is confirmed rather
-        ///   than believed.
+        ///   application, from ``ExtrasMenuBarProbeMemory``. Starting partway up
+        ///   the ladder keeps a cold start from re-probing the whole system; a
+        ///   seeded deadline still expires within seconds.
         init(_ runningApp: NSRunningApplication, seed: (misses: Int, initialTTL: Duration)? = nil) {
             self.runningApp = runningApp
             guard let seed else {
@@ -145,8 +124,7 @@ actor SourcePIDCache {
         /// Returns the accessibility element representing the app's extras
         /// menu bar, creating it if necessary.
         ///
-        /// When the element is first created, it gets stored for efficient
-        /// access on subsequent calls.
+        /// The element is cache
```

---

### Incident Patch 8: `2f581878` (2026-09-25)
**Commit Message**: ci(release): pin org-ci to the duplicate-build fix

The 2.1.0-beta.5 release failed at the appcast step: Sparkle 2.10's
generate_appcast refuses two archives with one bundle version, and the
beta.2 and beta.3 archives it fetched for deltas are both build 58.
org-ci d90bbc8 skips a prior archive whose build is already in the set.
Every org-ci action in this workflow moves to that commit, which
changes only the sparkle-release action.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +5/-5)
```diff
@@ -258,7 +258,7 @@ jobs:
           xcodebuild -version
 
       - name: Configure signing
-        uses: thaw-app/org-ci/actions/configure-signing@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/configure-signing@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           apple-application-cert: ${{ secrets.APPLE_APPLICATION_CERT }}
           apple-application-cert-password: ${{ secrets.APPLE_APPLICATION_CERT_PASSWORD }}
@@ -267,7 +267,7 @@ jobs:
           apple-team-id: ${{ secrets.APPLE_TEAM_ID }}
 
       - name: Build
-        uses: thaw-app/org-ci/actions/build@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/build@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           apple-team-id: ${{ secrets.APPLE_TEAM_ID }}
           project-name: ${{ steps.source.outputs.project-name }}
@@ -276,14 +276,14 @@ jobs:
           deployment-target: ${{ steps.source.outputs.deployment-target }}
 
       - name: Export Archive
-        uses: thaw-app/org-ci/actions/export-and-package@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/export-and-package@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           apple-team-id: ${{ secrets.APPLE_TEAM_ID }}
           app-name: ${{ env.APP_NAME }}
           dmg-name: ${{ env.DMG_NAME }}
 
       - name: Notarize
-        uses: thaw-app/org-ci/actions/notarize-and-validate@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/notarize-and-validate@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           dmg-name: ${{ env.DMG_NAME }}
           app-name: ${{ env.APP_NAME }}
@@ -352,7 +352,7 @@ jobs:
 
       - name: Sparkle ZIP and appcast
         id: sparkle
-        uses: thaw-app/org-ci/actions/sparkle-release@6adcb3aa53a28cfa9d4cd2f55e2d5f5c75af980b
+        uses: thaw-app/org-ci/actions/sparkle-release@d90bbc87aa4dff91d3bc9e30fb6ceef0765bd986
         with:
           tag: ${{ steps.meta.outputs.tag }}
           channel: ${{ steps.meta.outputs.channel }}
```

---

### Incident Patch 9: `26f454bc` (2026-09-21)
**Commit Message**: build(deps): bump the github-actions group with 3 updates (#1173)

Bumps the github-actions group with 3 updates: [SonarSource/sonarqube-scan-action](https://github.com/sonarsource/sonarqube-scan-action), [github/codeql-action/init](https://github.com/github/codeql-action) and [github/codeql-action/analyze](https://github.com/github/codeql-action).


Updates `SonarSource/sonarqube-scan-action` from 8.2.1 to 8.2.2
- [Release notes](https://github.com/sonarsource/sonarqube-scan-action/releases)
- [Commits](https://github.com/sonarsource/sonarqube-scan-action/compare/22918119ff8e1ca75a623e15c8296b6ea4fbe28f...ba9859eae8dd6bd29e412f25ddbbef3d032000f4)

Updates `github/codeql-action/init` from 4.38.0 to 4.38.1
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/github/codeql-action/compare/b96794f015dfd88f77b49b1c93e0fa7110f94c63...1c5b675653bb5c22dbe9b12b556ec555138e09fd)

Updates `github/codeql-action/analyze` from 4.38.0 to 4.38.1
- [Release notes](https://github.com/github/codeql-action/releases)
- [Changelog](https://github.com/github/codeql-action/blob/main/

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -260,7 +260,7 @@ jobs:
       # a missing file would fail the scanner on cold branches.
       - name: SonarQube Scan
         if: env.SONAR_ENABLED == 'true'
-        uses: SonarSource/sonarqube-scan-action@22918119ff8e1ca75a623e15c8296b6ea4fbe28f # v8.2.1
+        uses: SonarSource/sonarqube-scan-action@ba9859eae8dd6bd29e412f25ddbbef3d032000f4 # v8.2.2
         env:
           SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
         with:
```

**File**: `.github/workflows/codeql.yml` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@ jobs:
           persist-credentials: false
 
       - name: Initialize CodeQL
-        uses: github/codeql-action/init@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/init@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           languages: swift
           build-mode: manual
@@ -52,6 +52,6 @@ jobs:
             CODE_SIGNING_ALLOWED=NO
 
       - name: Perform CodeQL Analysis
-        uses: github/codeql-action/analyze@b96794f015dfd88f77b49b1c93e0fa7110f94c63 # v4.38.0
+        uses: github/codeql-action/analyze@1c5b675653bb5c22dbe9b12b556ec555138e09fd # v4.38.1
         with:
           category: "/language:swift"
```

---

### Incident Patch 10: `8be744b4` (2026-09-21)
**Commit Message**: docs(changelog): add the alpha.6 fixes shipped after the first cut

The 3.0.0-alpha.6 section predates the right-click, Time Machine, parked
Thaw icon, blank-capture, and reveal-mask fixes, so What's New and the
release notes did not mention them. Adds those bullets, updates the
control-item investigation note, and dates the section 2026-09-21.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +8/-2)
```diff
@@ -28,7 +28,7 @@ A bug-fix pass on the menu bar layout engine and its settings, plus one new opti
 7. **App-icon mode stops sampling the menu bar.** "Always use app icon for menu bar items" only changed what Thaw drew; it still captured the menu bar for previews, which is what raises the screen-recording indicator. With the setting on, Thaw no longer captures. [#1051](https://github.com/thaw-app/Thaw/issues/1051)
 8. **The Thaw Bar uses the right icon tint on every display.** Opening the bar on a second display briefly showed the other display's light or dark icon tint. Thaw now keeps a per-display icon snapshot and restores it before the bar appears. [#1065](https://github.com/thaw-app/Thaw/issues/1065)
 
-## [3.0.0-alpha.6] - 2026-09-20
+## [3.0.0-alpha.6] - 2026-09-21
 
 **macOS 27 only · Build 106**
 
@@ -72,6 +72,10 @@ A bug-fix pass on the menu bar layout engine and its settings, plus one new opti
 - **A Core Foundation result that is not an array or a dictionary no longer crashes the app.** Five bridging sites are checked before use.
 - **A Manual-arrangement reorder is refused with a warning** instead of silently overwriting the order you saved.
 - **A missing capture no longer leaves a blank slot.** An item with no app icon and no capture, such as a concealed Apple module, now falls back to a substitute glyph instead of an empty cell.
+- **Right-clicking an item in the Thaw Bar opens its menu again.** Alpha 6 sent the right click through the move path, so an item macOS would not let Thaw move never got a context menu.
+- **A failed menu bar capture falls back to the app icon** instead of leaving the slot blank or black.
+- **A reveal whose menu bar capture fails no longer pegs a CPU core.** The join loop spun the main thread, which is the system-wide lag some of you saw during a reveal.
+- **Time Machine is recognized by name.** macOS 27 stopped reporting a title for it, so Thaw filed it as an unnamed item and could not place it.
 
 ### Menu bar reliability
 
@@ -92,10 +96,12 @@ A bug-fix pass on the menu bar layout engine and its settings, plus one new opti
 - **A move the position store cannot express still completes** through the Command-drag fallback. Drops can land next to parked-band items, and two icons of one app sitting on one weight are separated.
 - **The Thaw icon honours a held Option**, and Always Hidden presents the Thaw Bar when it is on.
 - **The capture helper no longer aborts while ScreenCaptureKit builds its window filter**, and Layout opens right after the Thaw Bar without the multi-second wait.
+- **The Thaw Bar stays beside the Thaw icon when macOS parks it.** It used to anchor to the parked position and land at the left edge of the screen.
+- **The Thaw icon comes back after a display change.** Recovery used to give up for the rest of the session.
 
 ### Still under investigation
 
-- **Thaw's own menu bar item can still go missing on macOS 27.** A stranded control item is now reseated instead of staying invisible until relaunch. This needs a live test on macOS 27 before it is called fixed. [#1135](https://github.com/thaw-app/Thaw/issues/1135)
+- **Thaw's own menu bar item can still go missing on macOS 27.** Thaw now treats a parked Thaw icon as parked, so the bar and the layout engine stop planning on that position, and recovery retries after a display change. macOS can still park the item, so this needs a live test before it is called fixed. [#1135](https://github.com/thaw-app/Thaw/issues/1135)
 - **Hidden section items still look wrong in some cases.** Always-hidden icons are captured after the section settles, and edge-ring knock-out helps full-frame icons, but the reports stay open. [#1119](https://github.com/thaw-app/Thaw/issues/1119)
 - **The five clicking bugs reported against alpha.5 have fixes in this build.** The reports stay open until someone confirms them on a live macOS 27 setup: empty-spot clicks, the Notification Center shortcut, the right-click menu, hidden-section collapse, and a dead Thaw Bar icon. [#1145](https://github.com/thaw-app/Thaw/issues/1145), [#1146](https://github.com/thaw-app/Thaw/issues/1146), [#1147](https://github.com/thaw-app/Thaw/issues/1147), [#1148](https://github.com/thaw-app/Thaw/issues/1148), [#1149](https://github.com/thaw-app/Thaw/issues/1149)
 - **Uneven gaps after a spacing change are not resolved.** [#1126](https://github.com/thaw-app/Thaw/issues/1126)
```

---

### Incident Patch 11: `ffdb1a1a` (2026-09-21)
**Commit Message**: docs(changelog): add the Dock-icon option and Thaw Bar tint fix to 2.1.0-beta.4 (#1168)

#1065 and #1127 merged after the section was written. Add the new
General setting and the per-display tint fix, and update the count.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +6/-1)
```diff
@@ -11,7 +11,11 @@ and the Sparkle appcast, unless overridden with the `release_notes` input.
 
 **macOS 26 only · Build 60**
 
-A bug-fix pass on the menu bar layout engine and its settings. Seven field reports are fixed here, from parked reorders that reverted to the screen-recording indicator.
+A bug-fix pass on the menu bar layout engine and its settings, plus one new option. Eight field reports are fixed here, from parked reorders that reverted to the screen-recording indicator.
+
+### New
+
+- **Keep Thaw out of the Dock while you toggle the bar.** "Hide Dock icon when toggling the menu bar" (General) stops Thaw switching to a regular activation policy when it shows or hides hidden items, so the Dock icon no longer flashes on every toggle. Overflow that would have hidden the frontmost app's menus opens in the Thaw Bar instead. Settings and other explicit windows still appear normally. [#1128](https://github.com/thaw-app/Thaw/issues/1128)
 
 ### Fixes
 
@@ -22,6 +26,7 @@ A bug-fix pass on the menu bar layout engine and its settings. Seven field repor
 5. **The Smart rehide interval is visible where it is used.** Smart falls back to the same interval Timed uses, but the slider only appeared under Timed, so the value that governed Smart could not be seen or changed. The slider now appears under both. Focus rehides on activation and ignores the interval. [#1049](https://github.com/thaw-app/Thaw/issues/1049)
 6. **A renamed anchor still places new items.** A "New items" anchor saved under a helper's name stopped matching after the namespace was canonicalized, so new items fell back to the section default. Anchor lookup now canonicalizes, and the placement names the live item. [#1069](https://github.com/thaw-app/Thaw/issues/1069)
 7. **App-icon mode stops sampling the menu bar.** "Always use app icon for menu bar items" only changed what Thaw drew; it still captured the menu bar for previews, which is what raises the screen-recording indicator. With the setting on, Thaw no longer captures. [#1051](https://github.com/thaw-app/Thaw/issues/1051)
+8. **The Thaw Bar uses the right icon tint on every display.** Opening the bar on a second display briefly showed the other display's light or dark icon tint. Thaw now keeps a per-display icon snapshot and restores it before the bar appears. [#1065](https://github.com/thaw-app/Thaw/issues/1065)
 
 ## [3.0.0-alpha.6] - 2026-09-20
 
```

---

### Incident Patch 12: `0d61a337` (2026-09-20)
**Commit Message**: fix(icebar): restore correct icon tint when opening on another display (#1065)

* fix(icebar): restore correct icon tint when opening on another display

Drop the main-display-only color sample guards, keep a warm per-display
icon snapshot, and recapture through the existing SkyLight cadence so a
secondary-screen Thaw Bar open no longer flashes the previous screen's
baked light/dark glyphs. Settle delay stays at 500 ms.

Signed-off-by: jiayuqi7813 <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>

* fix(icebar): snapshot only the tags a capture produced per display

storeImages copied the whole standing image cache under one display, so a
one-section recapture on display B recorded display A's bitmaps for the
other sections as B's snapshot. Track the tags a capture actually produced
and merge only those, dropping entries no longer in the standing cache.

recaptureSection also did not check Task.isCancelled after the capture, so
a cancelled recapture could still store the new display's bitmaps under the
old display. Bail out before storing when cancelled.

Addresses the CodeRabbit findings on #1065.

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

---------

Signed-off-by

**File**: `Thaw/MenuBar/IceBar/IceBar.swift` (modified, +37/-13)
```diff
@@ -34,6 +34,10 @@ final class IceBarPanel: NSPanel {
     /// change posts that notification, racing with the show).
     private var lastShowTimestamp: Date?
 
+    /// Display the Thaw Bar was last shown on. Cross-screen opens must drop
+    /// the previous screen's icon captures (light/dark tint is baked in).
+    private var lastShownDisplayID: CGDirectDisplayID?
+
     /// Storage for internal observers.
     private var cancellables = Set<AnyCancellable>()
 
@@ -228,9 +232,26 @@ final class IceBarPanel: NSPanel {
         currentSection = section
         lastShowTimestamp = Date()
 
-        // Show the panel immediately with whatever cached data we have.
-        // The SwiftUI view observes itemManager and imageCache, so it
-        // will re-render automatically as the background updates land.
+        // Menu bar icon light/dark tint is baked into the captured bitmaps.
+        // Restore this display's warm snapshot when we have one; otherwise clear
+        // wrong-display icons so the panel can still appear instantly (Loading)
+        // while a background SkyLight recapture fills the correct tint.
+        let switchedDisplay = lastShownDisplayID.map { $0 != screen.displayID } ?? false
+        let needsBackgroundRecapture = appState.imageCache.prepareImagesForThawBar(
+            displayID: screen.displayID,
+            section: section
+        )
+        if switchedDisplay {
+            colorManager.invalidateColorInfo()
+            diagLog.notice(
+                "show: display \(self.lastShownDisplayID.map(String.init) ?? "nil") → \(screen.displayID); warmCache=\(!needsBackgroundRecapture)"
+            )
+        }
+        lastShownDisplayID = screen.displayID
+
+        // Show the panel immediately. Never defer orderFront: setting
+        // currentSection without a visible panel makes isHidden flip to false,
+        // so a second click would call hide() instead of show().
         contentView = IceBarHostingView(
             appState: appState,
             colorManager: colorManager,
@@ -242,23 +263,23 @@ final class IceBarPanel: NSPanel {
 
         // Color manager must be updated after updating the panel's origin,
         // but before it is shown.
-        //
-        // Color manager handles frame changes automatically, but does so on
-        // the main queue, so we need to update manually once before showing
-        // the panel to prevent the color from flashing.
         colorManager.updateAllProperties(with: frame, screen: screen)
 
         orderFrontRegardless()
 
-        // Rehide temporarily shown items and refresh caches in the
-        // background. Ordering is preserved: rehide moves items back
-        // to their correct sections before the cache is rebuilt.
-        // The task is cancelled in close() to avoid holding appState.
+        // Refresh color + icons in the background. Keep the settle delay so
+        // control-item positioning does not leave the hidden section empty.
+        let panelFrame = frame
+        let targetDisplayID = screen.displayID
         cacheTask?.cancel()
-        cacheTask = Task { [weak appState] in
+        cacheTask = Task { [weak appState, weak colorManager] in
             guard let appState else { return }
+
+            await colorManager?.refresh(with: panelFrame, screen: screen)
+
             await appState.itemManager.rehideTemporarilyShownItems(force: true)
             guard !Task.isCancelled else { return }
+
             // Settle delay: when the IceBar just opened on a screen that
             // was previously inactive, the menu bar has moved screens and
             // NSStatusItem windows (control item chevrons) are still
@@ -270,7 +291,10 @@ final class IceBarPanel: NSPanel {
             guard !Task.isCancelled else { return }
             await appState.itemManager.cacheItemsIfNeeded()
             guard !Task.isCancelled else { return }
-            await appState.imageCache.updateCache()
+            await appState.imageCache.recaptureSection(
+                section,
+                preferredDisplayID: targetDisplayID
+            )
         }
     }
 
```

**File**: `Thaw/MenuBar/IceBar/IceBarColorManager.swift` (modified, +60/-35)
```diff
@@ -10,6 +10,10 @@ import Combine
 import Observation
 import SwiftUI
 
+/// Samples the menu bar / wallpaper strip under the Thaw Bar for icon contrast.
+///
+/// Sampling runs on whatever screen the panel is on — not only the main
+/// display — so a secondary-screen open does not keep the previous brightness.
 @MainActor
 @Observable
 final class IceBarColorManager {
@@ -47,17 +51,17 @@ final class IceBarColorManager {
         if let iceBarPanel {
             iceBarPanel.publisher(for: \.screen)
                 .receive(on: DispatchQueue.main)
-                .sink { [weak self] screen in
-                    guard
-                        let self,
-                        let screen,
-                        screen == .main
-                    else {
+                .sink { [weak self, weak iceBarPanel] screen in
+                    guard let self, let screen, let iceBarPanel, iceBarPanel.isVisible else {
                         return
                     }
+                    // Drop the previous display's sample before the new capture
+                    // lands so icon contrast cannot briefly reuse the old screen.
+                    self.invalidateColorInfo()
+                    let frame = iceBarPanel.frame
                     Task { [weak self] in
                         guard let self else { return }
-                        await self.updateWindowImage(for: screen)
+                        await self.refresh(with: frame, screen: screen)
                     }
                 }
                 .store(in: &c)
@@ -69,8 +73,7 @@ final class IceBarColorManager {
                         let self,
                         let iceBarPanel,
                         let screen = iceBarPanel.screen,
-                        iceBarPanel.isVisible,
-                        screen == .main
+                        iceBarPanel.isVisible
                     else {
                         return
                     }
@@ -103,15 +106,14 @@ final class IceBarColorManager {
                 guard
                     let iceBarPanel,
                     iceBarPanel.isVisible,
-                    let screen = iceBarPanel.screen,
-                    screen == .main
+                    let screen = iceBarPanel.screen
                 else {
                     return
                 }
                 let frame = iceBarPanel.frame
                 Task { [weak self] in
                     guard let self else { return }
-                    await self.updateWindowImage(for: screen)
+                    guard await self.updateWindowImage(for: screen) else { return }
                     withAnimation {
                         self.updateColorInfo(with: frame, screen: screen)
                     }
@@ -120,22 +122,17 @@ final class IceBarColorManager {
             .store(in: &c)
 
             // Manage visibility: update colors immediately + start/stop periodic timer.
-            // Single subscription replaces the previous two \.isVisible observers.
             iceBarPanel.publisher(for: \.isVisible)
                 .removeDuplicates()
                 .receive(on: DispatchQueue.main)
                 .sink { [weak self, weak iceBarPanel] isVisible in
                     guard let self else { return }
                     if isVisible {
-                        // Refresh windowImage immediately so the first color
-                        // update isn't stale. Awaiting inside a Task so
-                        // updateColorInfo reads the fresh capture, not the
-                        // previous cycle's leftover.
-                        if let iceBarPanel, let screen = iceBarPanel.screen, screen == .main {
+                        if let iceBarPanel, let screen = iceBarPanel.screen {
                             let frame = iceBarPanel.frame
                             Task { [weak self] in
                                 guard let self else { return }
-                                await self.updateWindowImage(for: screen)
+                                guard await self.updateWindowImage(for: screen) else { return }
                                 self.updateColorInfo(with: frame, screen: screen)
                             }
                         }
@@ -160,15 +157,14 @@ final class IceBarColorManager {
                     let self,
                     let iceBarPanel,
                     iceBarPanel.isVisible,
-                    let screen = iceBarPanel.screen,
-                    screen == .main
+                    let screen = iceBarPanel.screen
                 else {
                     return
                 }
                 let frame = iceBarPanel.frame
                 Task { [weak self] in
                     guard let self else { return }
-                    await self.updateWindowImage(for: screen)
+                    guard await self.updateWindowImage(for: screen) else { return }
                     withAnimation {
                         s
```

**File**: `Thaw/MenuBar/MenuBarItems/MenuBarItemImageCache.swift` (modified, +309/-19)
```diff
@@ -161,6 +161,18 @@ final class MenuBarItemImageCache: @unchecked Sendable {
     /// The cached item images, keyed by their corresponding tags.
     private(set) var images = [MenuBarItemTag: CapturedImage]()
 
+    /// Display ID of the screen the current ``images`` were last captured for.
+    ///
+    /// Used by the Thaw Bar to drop stale bitmaps when opening on a different
+    /// screen: menu bar icon light/dark tint is baked into the capture, so
+    /// reusing another display's cache briefly shows the wrong icon colors.
+    private(set) var lastCaptureDisplayID: CGDirectDisplayID?
+
+    /// Per-display icon snapshots so switching screens can restore the correct
+    /// light/dark tint immediately instead of flashing the previous screen.
+    @ObservationIgnored
+    private var imagesByDisplay = [CGDirectDisplayID: [MenuBarItemTag: CapturedImage]]()
+
     /// Tracks which items are blinking for attention.
     ///
     /// Deliberately not observable: it is fed on every capture, and the
@@ -866,7 +878,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
 
             let nav = appState.navigationState
 
-            let preferredDisplayID = appState.itemManager.itemCache.displayID
+            let preferredDisplayID = preferredCaptureDisplayID(appState: appState)
             guard let resolvedScreen = Self.resolveScreen(preferredDisplayID: preferredDisplayID) else {
                 MenuBarItemImageCache.diagLog.warning("liveRefresh: no connected screens available, skipping")
                 try? await Task.sleep(for: .seconds(max(interval, Self.minIconRefreshInterval)))
@@ -938,6 +950,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
 
             var hiddenItems = [MenuBarItem]()
             var alwaysHiddenItems = [MenuBarItem]()
+            var capturedTags = [MenuBarItemTag]()
 
             for section in sections {
                 let availableItems = appState.itemManager.itemCache.managedItems(for: section)
@@ -971,6 +984,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                         await withCapturePermit {
                             await refreshImages(of: items, scale: scale, viaSCK: true)
                         }
+                        capturedTags.append(contentsOf: items.map(\.tag))
                     }
                     nextWake = min(
                         nextWake,
@@ -1016,6 +1030,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 await withCapturePermit {
                     await refreshImages(of: hiddenItems, scale: scale)
                 }
+                capturedTags.append(contentsOf: hiddenItems.map(\.tag))
             case .alwaysHidden:
                 lastAlwaysHiddenRefreshAt = now
                 MenuBarItemImageCache.diagLog.debug(
@@ -1024,10 +1039,15 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 await withCapturePermit {
                     await refreshImages(of: alwaysHiddenItems, scale: scale)
                 }
+                capturedTags.append(contentsOf: alwaysHiddenItems.map(\.tag))
             case .visible, nil:
                 break
             }
 
+            await MainActor.run {
+                storeImages(for: screen.displayID, capturedTags: capturedTags)
+            }
+
             if let hiddenInterval, !hiddenItems.isEmpty {
                 nextWake = min(
                     nextWake,
@@ -1817,6 +1837,24 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 "Memory pressure: Cleared \(tagsToRemove.count) items from cache"
             )
         }
+
+        // Per-display warm snapshots are independent of the standing LRU; drop
+        // non-standing displays first, then trim the standing copy to match.
+        let standing = lastCaptureDisplayID
+        for displayID in imagesByDisplay.keys where displayID != standing {
+            imagesByDisplay.removeValue(forKey: displayID)
+        }
+        if let standing, var standingImages = imagesByDisplay[standing] {
+            standingImages = standingImages.filter { images[$0.key] != nil }
+            if standingImages.count > images.count {
+                let excess = standingImages.count - images.count
+                let dropKeys = Array(standingImages.keys.prefix(excess))
+                for key in dropKeys {
+                    standingImages.removeValue(forKey: key)
+                }
+            }
+            imagesByDisplay[standing] = standingImages
+        }
     }
 
     /// Returns the count least recently used tags, sorted by access time (oldest first).
@@ -1850,19 +1888,29 @@ final class MenuBarItemImageCache: @unchecked Sendable {
     /// exact tag (including windowID) is not found. This handles disk-loaded
     /// entries where the windowID is unavailable.
     func image(for tag: MenuBarItemTag) -> CapturedImage? {
-        if let image = images[tag] {
+        guard let image = Self.image(for
```

---

### Incident Patch 13: `a691df93` (2026-09-20)
**Commit Message**: fix(menubar): land parked moves and fix rehide, scroll, placement, and capture regressions (#1162)

* fix(menubar): keep planned release point for parked teleports

While a parked item is held, WindowServer reports it at the display
origin and the parked lane reads as reflowed by roughly a thousand
points. Rebuilding the release point from that mid-hold snapshot landed
past the end of the lane, so every parked reorder reverted and the user
saw 'could not be kept in its new position'.

A parked teleport now releases at the point planned just before the
press. A source-anchored retry does the same only when its destination
is parked; against a visible destination the reflow is real and the
fresh point is correct.

Refs #1074, #1102, #1104, #1133

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

* fix(menubar): drop rehide context when the source process terminated

A temporarily shown item whose owning process quit was re-queued for up
to ten not-found attempts, leaving a dead icon in the Thaw Bar until the
retries exhausted. rehideTemporarilyShownItems now probes the source PID
and drops the context immediately when it is gone, clearing the pending
relocation so the item is not resur

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -7,6 +7,22 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
+## [2.1.0-beta.4] - 2026-09-20
+
+**macOS 26 only · Build 60**
+
+A bug-fix pass on the menu bar layout engine and its settings. Seven field reports are fixed here, from parked reorders that reverted to the screen-recording indicator.
+
+### Fixes
+
+1. **Parked reorders land again.** While a parked item is held, WindowServer reports it at the display origin and the parked lane reads as reflowed by roughly a thousand points. Rebuilding the release point from that mid-hold snapshot landed the item past the end of the lane, so every hidden-section reorder was refused and the user saw "could not be kept in its new position". A parked teleport now releases at the point planned just before the press. A source-anchored retry keeps its planned point only when the destination is parked; against a visible destination the reflow is real and the fresh point is correct. [#1074](https://github.com/thaw-app/Thaw/issues/1074), [#1102](https://github.com/thaw-app/Thaw/issues/1102), [#1104](https://github.com/thaw-app/Thaw/issues/1104), [#1133](https://github.com/thaw-app/Thaw/issues/1133)
+2. **A quit app no longer leaves a dead icon in the Thaw Bar.** A temporarily shown item whose owning process had terminated was re-queued for up to ten not-found attempts before being dropped. Thaw now probes the source PID and drops the item immediately when it is gone, clearing the pending relocation so it is not resurrected later. [#1149](https://github.com/thaw-app/Thaw/issues/1149)
+3. **Scrolling on the Thaw icon reveals the hidden section again.** The reveal gesture only accepted empty menu bar space, which deliberately excludes the Thaw icon, so scrolling directly on the icon did nothing. The icon region is now accepted as well. [#1073](https://github.com/thaw-app/Thaw/issues/1073)
+4. **New items land where the "New items" placeholder sits.** Default (no-anchor) placement inserted a new item at the section end, while the Layout editor badge defaults to the section start, so a new app appeared next to the Thaw icon instead of at the placeholder. Default placement now uses the same slot the badge defaults to. [#1069](https://github.com/thaw-app/Thaw/issues/1069)
+5. **The Smart rehide interval is visible where it is used.** Smart falls back to the same interval Timed uses, but the slider only appeared under Timed, so the value that governed Smart could not be seen or changed. The slider now appears under both. Focus rehides on activation and ignores the interval. [#1049](https://github.com/thaw-app/Thaw/issues/1049)
+6. **A renamed anchor still places new items.** A "New items" anchor saved under a helper's name stopped matching after the namespace was canonicalized, so new items fell back to the section default. Anchor lookup now canonicalizes, and the placement names the live item. [#1069](https://github.com/thaw-app/Thaw/issues/1069)
+7. **App-icon mode stops sampling the menu bar.** "Always use app icon for menu bar items" only changed what Thaw drew; it still captured the menu bar for previews, which is what raises the screen-recording indicator. With the setting on, Thaw no longer captures. [#1051](https://github.com/thaw-app/Thaw/issues/1051)
+
 ## [3.0.0-alpha.6] - 2026-09-20
 
 **macOS 27 only · Build 106**
```

**File**: `Thaw.xcodeproj/project.pbxproj` (modified, +8/-8)
```diff
@@ -700,7 +700,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = A7CKWF99ML;
@@ -719,7 +719,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_APPROACHABLE_CONCURRENCY = YES;
@@ -741,7 +741,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = A7CKWF99ML;
@@ -760,7 +760,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_APPROACHABLE_CONCURRENCY = YES;
@@ -777,7 +777,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEVELOPMENT_TEAM = A7CKWF99ML;
 				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -788,7 +788,7 @@
 				INFOPLIST_KEY_NSHumanReadableCopyright = "Copyright © 2026 Toni Förster et al.\nCopyright © 2023–2025 Jordan Baird (Ice)";
 				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw.MenuBarItemService;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				REGISTER_APP_GROUPS = YES;
@@ -810,7 +810,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "-";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 59;
+				CURRENT_PROJECT_VERSION = 60;
 				DEVELOPMENT_TEAM = A7CKWF99ML;
 				ENABLE_APP_SANDBOX = NO;
 				ENABLE_HARDENED_RUNTIME = YES;
@@ -821,7 +821,7 @@
 				INFOPLIST_KEY_NSHumanReadableCopyright = "Copyright © 2026 Toni Förster et al.\nCopyright © 2023–2025 Jordan Baird (Ice)";
 				LOCALIZATION_PREFERS_STRING_CATALOGS = YES;
 				MACOSX_DEPLOYMENT_TARGET = 26.0;
-				MARKETING_VERSION = "2.1.0-beta.3";
+				MARKETING_VERSION = "2.1.0-beta.4";
 				PRODUCT_BUNDLE_IDENTIFIER = com.stonerl.Thaw.MenuBarItemService;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				REGISTER_APP_GROUPS = YES;
```

**File**: `Thaw/Events/HIDEventManager.swift` (modified, +8/-1)
```diff
@@ -1581,9 +1581,16 @@ extension HIDEventManager {
         appState: AppState,
         screen: NSScreen
     ) {
+        // `isMouseInsideEmptyMenuBarSpace` excludes the Thaw icon, but
+        // scrolling on the icon must reveal too. (#1073)
+        let overEmptyMenuBarSpace = isMouseInsideEmptyMenuBarSpace(
+            appState: appState,
+            screen: screen
+        )
+        let overThawIcon = isMouseInsideIceIcon(appState: appState)
         guard
             appState.settings.general.showOnScroll,
-            isMouseInsideEmptyMenuBarSpace(appState: appState, screen: screen),
+            overEmptyMenuBarSpace || overThawIcon,
             !isCursorOverForeignWidgetUIElement(),
             let hiddenSection = appState.menuBarManager.section(
                 withName: .hidden
```

**File**: `Thaw/MenuBar/MenuBarItems/LayoutReconciler.swift` (modified, +43/-4)
```diff
@@ -295,6 +295,38 @@ nonisolated enum LayoutReconciler {
                 return desiredFiltered.endIndex
             }
         }
+        /// Default insertion index for a section when no NewItemsPlacement
+        /// anchor applies. Mirrors `defaultNewItemsBadgeIndex` so the badge
+        /// and a new item's slot cannot disagree. (#1069)
+        func sectionDefaultIndex(for section: MenuBarSection.Name) -> Int {
+            switch section {
+            case .visible:
+                // Visible is the first block, so its leftmost slot is 0.
+                // Skip a leading chevron only; the icon can sit mid-section.
+                if let chevron = controlUIDs.visible, desiredFiltered.first == chevron {
+                    return 1
+                }
+                return 0
+            case .hidden:
+                return controlUIDs.alwaysHidden != nil
+                    ? sectionStartIndex(for: .hidden)
+                    : sectionEndIndex(for: .hidden)
+            case .alwaysHidden:
+                return sectionEndIndex(for: .alwaysHidden)
+            }
+        }
+        /// Whether a section's default slot is at its start, where successive
+        /// defaults need an offset to keep their order.
+        func sectionDefaultIsAtStart(_ section: MenuBarSection.Name) -> Bool {
+            switch section {
+            case .visible:
+                return true
+            case .hidden:
+                return controlUIDs.alwaysHidden != nil
+            case .alwaysHidden:
+                return false
+            }
+        }
         func sectionKeyString(for section: MenuBarSection.Name) -> String {
             switch section {
             case .visible: return "visible"
@@ -446,16 +478,23 @@ nonisolated enum LayoutReconciler {
             }
         }
 
-        // Pass 3: .newItemDefault placements. Insert at the section
-        // end in unmanagedUIDs order so their relative ordering
-        // matches the current menu bar.
+        // Pass 3: .newItemDefault placements, at the badge's default slot so
+        // a new item lands where the placeholder sits. (#1069)
+        var defaultInsertedCount = [MenuBarSection.Name: Int]()
         for uid in unmanagedUIDs {
             if case let .newItemDefault(section) = placements[uid] {
                 // Guards the caller invariant: see pass 1.
                 if desiredFiltered.contains(uid) {
                     continue
                 }
-                desiredFiltered.insert(uid, at: sectionEndIndex(for: section))
+                // A start slot is stable, so offset each insert; an end slot
+                // advances on its own.
+                let base = sectionDefaultIndex(for: section)
+                let offset = sectionDefaultIsAtStart(section)
+                    ? defaultInsertedCount[section, default: 0]
+                    : 0
+                desiredFiltered.insert(uid, at: base + offset)
+                defaultInsertedCount[section, default: 0] += 1
                 sectionMap[uid] = sectionKeyString(for: section)
             }
         }
```

**File**: `Thaw/MenuBar/MenuBarItems/LayoutSolver.swift` (modified, +15/-4)
```diff
@@ -1320,15 +1320,17 @@ nonisolated enum LayoutSolver {
                 continue
             }
 
-            // 2. NewItemsPlacement anchor (if configured and present in
-            //    the current menu bar).
+            // 2. NewItemsPlacement anchor (if configured and present in the
+            //    current bar), resolved to the live UID. (#1069)
             if newItemsPlacement.relation != .sectionDefault,
                let anchor = newItemsPlacement.anchorIdentifier,
-               currentUIDs.contains(anchor)
+               let liveAnchor = currentUIDs.first(where: {
+                   newItemsAnchorMatches($0, anchor)
+               })
             {
                 result[uid] = .newItemAnchored(
                     section: newItemsSection,
-                    anchorUID: anchor,
+                    anchorUID: liveAnchor,
                     relation: newItemsPlacement.relation
                 )
                 continue
@@ -1634,6 +1636,15 @@ nonisolated enum LayoutSolver {
         return "\(canonical):\(titlePortion(forIdentifier: identifier))"
     }
 
+    /// Whether `identifier` names the same NewItemsPlacement anchor as
+    /// `anchor`, allowing for persisted-identifier canonicalization. (#1069)
+    static nonisolated func newItemsAnchorMatches(_ identifier: String, _ anchor: String) -> Bool {
+        if identifier == anchor {
+            return true
+        }
+        return canonicalIdentifier(identifier) == canonicalIdentifier(anchor)
+    }
+
     /// Applies ``canonicalIdentifier(_:)`` across a saved section order.
     ///
     /// Runs before pruning at load, so an entry that only looks unmatchable
```

**File**: `Thaw/MenuBar/MenuBarItems/MenuBarItemImageCache.swift` (modified, +19/-9)
```diff
@@ -575,7 +575,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 // new items that the layout pane will need).
                 let nav = self.makeNavigationStateSnapshot()
                 let hasVisible = self.hasVisibleCaptureConsumer(nav: nav)
-                let settingsOpen = self.isSettingsPaneOpen
+                let settingsOpen = self.isSettingsPaneOpen && !nav.prefersAppIcon
                 guard hasVisible || settingsOpen else {
                     return
                 }
@@ -618,22 +618,24 @@ final class MenuBarItemImageCache: @unchecked Sendable {
             // that this class is @Observable (no more $isItemHotkeyListExpanded
             // Combine projection to subscribe to).
 
-            // Restart the live refresh loop when its cadence or global
-            // attention demand changes. The initial observation also starts
-            // global detection when there is no visible UI consumer.
+            // Restart the live refresh loop when its cadence, global attention
+            // demand, or app-icon mode changes. The initial observation also
+            // starts global detection when there is no visible UI consumer.
             let advancedSettings = appState.settings.advanced
             iconRefreshIntervalObservationTask = Task { @MainActor [weak self] in
-                var previous: (interval: TimeInterval, globalAttention: Bool)?
+                var previous: (interval: TimeInterval, globalAttention: Bool, prefersAppIcon: Bool)?
                 let changes = Observations {
                     (
                         interval: advancedSettings.iconRefreshInterval,
-                        globalAttention: advancedSettings.surfaceItemsSeekingAttention
+                        globalAttention: advancedSettings.surfaceItemsSeekingAttention,
+                        prefersAppIcon: advancedSettings.alwaysUseAppIconForMenuBarItems
                     )
                 }
                 for await state in changes {
                     guard let self else { return }
                     guard previous?.interval != state.interval
                         || previous?.globalAttention != state.globalAttention
+                        || previous?.prefersAppIcon != state.prefersAppIcon
                     else { continue }
                     previous = state
                     self.liveRefreshTask?.cancel()
@@ -656,6 +658,7 @@ final class MenuBarItemImageCache: @unchecked Sendable {
         let isSettingsPresented: Bool
         let settingsNavigationIdentifier: SettingsNavigationIdentifier?
         let isItemHotkeyListExpanded: Bool
+        let prefersAppIcon: Bool
     }
 
     /// Constructs a NavigationStateSnapshot from the current appState in a single MainActor hop.
@@ -669,7 +672,8 @@ final class MenuBarItemImageCache: @unchecked Sendable {
                 isAppFrontmost: false,
                 isSettingsPresented: false,
                 settingsNavigationIdentifier: nil,
-                isItemHotkeyListExpanded: false
+                isItemHotkeyListExpanded: false,
+                prefersAppIcon: false
             )
         }
         return NavigationStateSnapshot(
@@ -678,7 +682,8 @@ final class MenuBarItemImageCache: @unchecked Sendable {
             isAppFrontmost: appState.navigationState.isAppFrontmost,
             isSettingsPresented: appState.navigationState.isSettingsPresented,
             settingsNavigationIdentifier: appState.navigationState.settingsNavigationIdentifier,
-            isItemHotkeyListExpanded: isItemHotkeyListExpanded
+            isItemHotkeyListExpanded: isItemHotkeyListExpanded,
+            prefersAppIcon: appState.settings.advanced.alwaysUseAppIconForMenuBarItems
         )
     }
 
@@ -751,6 +756,10 @@ final class MenuBarItemImageCache: @unchecked Sendable {
 
     /// Returns whether any visible surface currently needs live item captures.
     private func hasVisibleCaptureConsumer(nav: NavigationStateSnapshot) -> Bool {
+        // App-icon mode renders no capture, so no visible consumer needs one.
+        if nav.prefersAppIcon {
+            return false
+        }
         if nav.isIceBarPresented || nav.isSearchPresented {
             return true
         }
@@ -783,7 +792,8 @@ final class MenuBarItemImageCache: @unchecked Sendable {
             isAppFrontmost: appState.navigationState.isAppFrontmost,
             isSettingsPresented: appState.navigationState.isSettingsPresented,
             settingsNavigationIdentifier: appState.navigationState.settingsNavigationIdentifier,
-            isItemHotkeyListExpanded: isItemHotkeyListExpanded
+            isItemHotkeyListExpanded: isItemHotkeyListExpanded,
+            prefersAppIcon: appState.settings.advanced.alwaysUseAppIconForMenuBarItems
         )
         return hasVisibleCaptureConsumer(nav: nav)
     }
```

**File**: `Thaw/MenuBar/MenuBarItems/MenuBarItemManager/MenuBarItemManager+Move.swift` (modified, +28/-1)
```diff
@@ -142,6 +142,25 @@ extension MenuBarItemManager {
             case .sourceAnchoredTeleport: "sourceAnchoredTeleport"
             }
         }
+
+        /// Whether this move releases at the point planned before the press
+        /// instead of a mid-hold snapshot. While a parked item is held, its
+        /// lane reads as reflowed by roughly a thousand points.
+        /// (#1074, #1102, #1104, #1133)
+        func keepsPlannedReleasePoint(
+            targetDisposition: MoveEndpointDisposition
+        ) -> Bool {
+            switch self {
+            case .parkedTeleport:
+                return true
+            case .sourceAnchoredTeleport:
+                // A source-anchored retry can address a visible destination,
+                // where the reflow is real and the fresh point is correct.
+                return targetDisposition == .parked
+            case .teleport, .faithfulDrag, .crossNotchTeleport:
+                return false
+            }
+        }
     }
 
     /// Whether a horizontal on-bar gesture can stay inside one safe segment.
@@ -1413,14 +1432,22 @@ extension MenuBarItemManager {
                     targetBounds: releaseEndpoints.target.bounds,
                     on: displayID
                 )
+                let releaseLocation = strategy.keepsPlannedReleasePoint(
+                    targetDisposition: geometry.target
+                ) ? eventLocations.release : releasePoints.end
+                if releaseLocation != releasePoints.end {
+                    MenuBarItemManager.diagLog.debug(
+                        "Parked release kept planned point \(releaseLocation.x) instead of reflowed \(releasePoints.end.x)"
+                    )
+                }
                 let liveReleaseItem = strategy == .sourceAnchoredTeleport
                     ? releaseEndpoints.source
                     : releaseEndpoints.target
                 guard let liveMouseUp = CGEvent.menuBarItemEvent(
                     item: liveReleaseItem,
                     source: source,
                     type: .move(.mouseUp),
-                    location: releasePoints.end
+                    location: releaseLocation
                 ) else {
                     throw EventError.eventCreationFailure(releaseEndpoints.source)
                 }
```

**File**: `Thaw/MenuBar/MenuBarItems/MenuBarItemManager/MenuBarItemManager+TemporaryShow.swift` (modified, +15/-0)
```diff
@@ -986,6 +986,21 @@ extension MenuBarItemManager {
 
         while let context = currentContexts.popLast() {
             guard let item = items.first(matchingTag: context.tag, pid: context.sourcePID) else {
+                // The owning process is gone, so the item never comes back;
+                // drop it now instead of retrying for a dead icon. (#1149)
+                if context.sourcePID > 0, !Self.previousPIDIsLive(context.sourcePID) {
+                    MenuBarItemManager.diagLog.debug(
+                        """
+                        Dropping temporarily shown item \(context.tag) after its \
+                        source process (\(context.sourcePID)) terminated
+                        """
+                    )
+                    // Keep the persisted pendingRelocations /
+                    // pendingReturnDestinations records: relocatePendingItems
+                    // uses them to restore the item's original section and
+                    // ordering when the app relaunches.
+                    continue
+                }
                 context.notFoundAttempts += 1
                 MenuBarItemManager.diagLog.debug(
                     """
```

---

### Incident Patch 14: `5233713f` (2026-09-15)
**Commit Message**: docs: fix formatting in CHANGELOG for macOS 27 section

Signed-off-by: René <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ and the Sparkle appcast, unless overridden with the `release_notes` input.
 
 ## [3.0.0-alpha.4] - 2026-09-14
 
-### ### macOS 27 only
+### macOS 27 only
 
 This is one of the last alphas. We are targeting the beta release by the end of this week. Once beta lands and the core functions are stable and reliable, the codebase opens for contributions.
 
```

---

### Incident Patch 15: `df71ccac` (2026-09-14)
**Commit Message**: docs(changelog): update changelog for 3.0.0-alpha.4 release with new features and fixes

Signed-off-by: René Jiménez <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +78/-0)
```diff
@@ -7,6 +7,84 @@ The `release.yml` workflow reads the section matching the release tag
 (`## [tag]`) and uses it as the release notes for both the GitHub Release
 and the Sparkle appcast, unless overridden with the `release_notes` input.
 
+## [3.0.0-alpha.4] - 2026-09-14
+
+This is one of the last alphas. We are targeting the beta release by the end of this week. Once beta lands and the core functions are stable and reliable, the codebase opens for contributions.
+
+Settings is rebuilt. The fifteen-pane sidebar is gone. What replaces it is a grouped sidebar with no nested tabs, a dedicated Thaw Bar page with a live preview, a customizable sidebar, and a separate appearance for the Thaw Bar itself.
+
+Something broke? [Open an issue](https://github.com/thaw-app/Thaw/issues/new/choose). Something missing? [Tell us here](https://github.com/thaw-app/Thaw/discussions).
+
+---
+
+### Upgrade from 3.0.0-alpha.3
+
+1. Nothing to do. Profiles, saved layouts, hotkeys, appearance, and permissions all carry over.
+2. Your last settings pane reopens. If it moved, it remaps to its new home.
+3. You can now hide sidebar destinations you don't use. Open the overflow menu and pick "Customize Sidebar."
+
+---
+
+### Settings
+
+- **Fifteen panes down to a grouped sidebar.** General, Layout, Visibility, Appearance, Thaw Bar, Profiles, Shortcuts, Automation, Displays, Spaces, Privacy, Experiments, and Troubleshooting. Grouped with the system's inter-section spacing, no text headings. About lives in the status-item menu. Scripts and Custom Status Icon are reachable through search and Experiments.
+- **Layout and Visibility are direct peers, not a nested tab.** Menu Bar used to be one destination with an Arrange / Behavior segmented control inside it. Now Layout and Visibility each have their own sidebar row. Layout holds the bar editor and every layout control. Visibility holds the reveal and rehide lifecycle, search configuration, and tooltips.
+- **Advanced is gone.** Its three controls moved to where they belong. App-menu hiding and the secondary context menu are in General. Auto-zen-while-presenting is in Automation. The reorder timeout is parked behind the Advanced layout controls disclosure; its write path is bypassed on macOS 27, so the UI is hidden until it has a visible effect.
+- **Customize the sidebar.** Hide destinations you don’t use from the overflow menu’s “Customize Sidebar” sheet. Hidden panes stay reachable through search. The current pane and the last visible pane can’t be hidden.
+
+### Thaw Bar
+
+- **Dedicated page with a live preview.** The Thaw Bar configuration that was buried inside Displays now has its own sidebar entry. The preview shows the hidden section's items in the chosen arrangement (horizontal, vertical, grid), on the real menu-bar surface, with the actual Thaw Bar shape and border from the appearance config. An "Open Thaw Bar" button opens the real panel. When it's off, the button says "Enable & Open."
+- **Separate Thaw Bar appearance.** Ported from the 2.1.0 beta versions. The Thaw Bar can now draw with its own shape, tint, and border, independent of the menu bar's. The override is off by default and seeded from the values on screen, so turning it on changes nothing until you edit something. Rounded corners, tint (solid or gradient), tint opacity, border color, and border width. The border shape omits the top edge on square corners so it is not clipped by the display's rounded screen corners.
+
+### Menu Bar editor
+
+- **One short instruction instead of four.** The heading, drag instructions, the Command-drag tip, and the macOS limitation note collapsed into a single line beside the editor. The OS limitation is a footnote. The refusal notice still appears when a move fails.
+- **Empty groups state is a compact row.** The 110pt centered empty state is gone. A one-line footnote says what to do instead.
+- **Command-drag toggle moved.** "Show all sections when Command-dragging" moved from Visibility to Layout's Advanced layout controls disclosure, where the other advanced layout behaviors live.
+
+### General
+
+- **Contextual menu controls moved here.** "Hide app menus when showing menu bar items" and "Enable secondary context menu" (plus its quit sub-toggle) moved from the dissolved Advanced pane to General.
+- **"No active profile" instead of "None."** The sidebar's profile footer says what it means.
+
+### Profiles
+
+- **Quieter rows.** Creation and modification dates moved into the "Save Current" menu as a detail, not beside the name. "Update" is now "Save Current" with clearer wording. The auto-switching link is a single inline footnote, not a section card.
+- **Profile auto-switching moved to Automation.** The display and Space profile-assignment controls moved from Profiles to Automation, with a direct link from Profiles.
+
+### Experiments
+
+- **Shorter caution, feedback below the list.** The large red introductory pill is gone. A one-line caution sits above the experiments. Fee
```

#### Recent Merged Pull Requests:
- **PR #1255** (2026-10-06): chore(lint): regenerate the size-rule baseline (@diazdesandi)
- **PR #1254** (2026-10-05): feat(layout): explain when macOS keeps an icon out of its section (@camguillory)
- **PR #1253** (2026-10-05): fix(menubar): stop warning about the frame every item has before layout (@camguillory)
- **PR #1252** (2026-10-05): fix(capture): skip the Thaw icon while it is collapsed to a sliver (@camguillory)
- **PR #1251** (2026-10-05): fix(items): drag straight away for an item whose writes the agent ignores (@camguillory)
- **PR #1249** (2026-10-05): fix(thaw-bar): keep a pointer-placed bar where it opened (@camguillory)
- **PR #1248** (2026-10-05): fix(capture): recapture promptly when the active bar moves between displays (@camguillory)
- **PR #1247** (2026-10-05): fix(capture): let a hidden Thaw icon's sliver stop blocking its neighbours (@camguillory)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
