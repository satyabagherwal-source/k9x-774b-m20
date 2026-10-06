# Forensic Learning Record (Deep Inspection): milanvarady/Applite

> **Canonical Artifact**: `07_PROJECT_LEARNING/milanvarady-applite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milanvarady/Applite](https://github.com/milanvarady/Applite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:27:02.526Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milanvarady/Applite`
- **Description**: A native macOS app store for software that isn't on the App Store, backed by Homebrew Cask
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7070 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Applite/Core/Brew/AskpassIcon.swift`
```
//
//  AskpassIcon.swift
//  Applite
//
//  Created by Milán Várady on 2026.08.03.
//

import AppKit
import OSLog

/// Writes Applite's app icon to its Application Support folder so the askpass dialog
/// (`askpass.js`) can display it — making it clear which app is requesting the
/// password. The dialog runs in a separate `osascript` process and can't reach
/// Applite's bundle, so we hand it the icon via this file instead.
enum AskpassIcon {
    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "AskpassIcon")

    /// Location the icon is written to. Must match the path `askpass.js` computes
    /// (Application Support → `Applite/prompt-icon.png`).
    static let iconURL = AppPaths.applicationSupport.appending(path: "prompt-icon.png")

    /// Refreshes the on-disk icon PNG. Reads the app icon on the main actor (an AppKit
    /// requirement), then encodes and writes it off the main thread so launch isn't
    /// blocked. Best-effort: on failure the dialog falls back to the system caution
    /// icon. Call once at launch.
    @MainActor
    static func write() {
        guard let tiff = (NSApplication.shared.applicationIconImage ?? NSImage()).tiffRepresentation else {
            Self.logger.error("Failed to read app icon for askpass dialog")
            return
        }

        Task.detached(priority: .utility) {
            encodeAndWrite(tiff: tiff)
        }
    }

    /// Encodes the TIFF data to PNG and writes it to ``iconURL``. Runs off the main
    /// actor — it touches no AppKit UI state, only the `Data` handed in.
    private static func encodeAndWrite(tiff: Data) {
        guard let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            Self.logger.error("Failed to encode app icon PNG for askpass dialog")
            return
        }

        do {
            try AppPaths.createApplicationSupportIfNeeded()
            try png.write(to: iconURL)
        } catch {
            Self.logger.error("Failed to write askpass icon: \(error.localizedDescription)")
        }
    }
}

```

### Core Architecture Module: `Applite/Core/Brew/BrewPaths.swift`
```
//
//  BrewPaths.swift
//  Applite
//
//  Created by Milán Várady on 2023. 06. 12..
//

import Foundation

/// Holds the different brew directory and executable paths, provides methods to retrieve and verify the currently selected path
struct BrewPaths {
    /// Brew executable path options
    enum PathOption: Int, CaseIterable, Identifiable {
        /// Applite's own ("annex") brew in the Application Support folder
        case annex = 0
        /// Default path for Apple Silicon macs
        case defaultAppleSilicon = 1
        /// Default path for Intel based macs
        case defaultIntel = 2
        /// User selected custom path
        case custom = 3
        
        var id: Int {
            return self.rawValue
        }
    }
    
    /// Retrieves and sets the currently selected ``PathOption`` from user defaults
    static var selectedBrewOption: PathOption {
        set {
            UserDefaults.standard.setValue(newValue.rawValue, for: Preferences.brewPathOption)
        }
        get {
            return PathOption(rawValue: UserDefaults.standard.value(for: Preferences.brewPathOption)) ?? .annex
        }
    }
    
    /// Returns the `brew` executable URL for the specified option.
    static func brewExecutable(for option: PathOption) -> URL {
        switch option {
        case .annex:
            return annexBrewExecutable

        case .defaultAppleSilicon:
            return URL(fileURLWithPath: "/opt/homebrew/bin/brew")

        case .defaultIntel:
            return URL(fileURLWithPath: "/usr/local/bin/brew")

        case .custom:
            return URL(fileURLWithPath: UserDefaults.standard.value(for: Preferences.customUserBrewPath))
        }
    }
    
    /// Directory of Applite's own ("annex") brew, installed into Application Support
    static let annexBrewDirectory = AppPaths.applicationSupport
        .appending(path: "Homebrew", directoryHint: .isDirectory)

    /// Executable path of Applite's own ("annex") brew, installed into Application Support
    static let annexBrewExecutable = Self.annexBrewDirectory
        .appendingPathComponent("bin", isDirectory: true)
        .appendingPathComponent("brew")

    /// The prefix (Homebrew root) of the currently selected brew. Every option's executable is
    /// `<prefix>/bin/brew`, so the directory is that path with the two trailing components dropped.
    static var currentBrewDirectory: URL {
        currentBrewExecutable
            .deletingLastPathComponent()  // drop "brew"
            .deletingLastPathComponent()  // drop "bin"
    }

    /// The `brew` executable currently in use (selected in settings).
    static var currentBrewExecutable: URL {
        return brewExecutable(for: selectedBrewOption)
    }

    /// Checks if a brew executable path is valid or not
    ///
    /// - Parameters:
    ///   - path: Path to be checked
    ///
    /// - Returns: Whether the path is valid or not
    static func isBrewPathValid(at url: URL) async -> Bool {
        // Check if Homebrew is returned when checking version. Argv-based (the path is never
        // spliced into a shell) and time-boxed so a hung/locked/network-mounted brew can't stall
        // app launch — the whole bootstrap awaits this before it can leave `.checking`.
        guard let output = try? await Shell.run(url, ["--version"], timeout: .seconds(10)) else {
            return false
        }

        return output.contains("Homebrew")
    }

    /// Checks if currently selected brew executable path is valid
    static func isSelectedBrewPathValid() async -> Bool {
        return await isBrewPathValid(at: Self.currentBrewExecutable)
    }

    // MARK: - Detection

    /// Attempts to locate a working Homebrew installation, fail-safe: the two arch-default
    /// prefixes are probed concurrently, then any brew on the user's `PATH` (covering
    /// non-standard prefixes). Every candidate is validated by actually running `brew --version`.
    ///
    /// - Parameter setPathOption: When `true`, the first match is written to
    ///   ``selectedBrewOption`` (and, for a non-standard location, `customUserBrewPath`).
    /// - Returns: The matched ``PathOption``, or `nil` if no working brew was found.
    static func detectHomebrew(setPathOption: Bool) async -> PathOption? {
        async let appleSilicon = isBrewPathValid(at: brewExecutable(for: .defaultAppleSilicon))
        async let intel = isBrewPathValid(at: brewExecutable(for: .defaultIntel))

        if await appleSilicon {
            if setPathOption { selectedBrewOption = .defaultAppleSilicon }
            return .defaultAppleSilicon
        }

        if await intel {
            if setPathOption { selectedBrewOption = .defaultIntel }
            return .defaultIntel
        }

        // Last resort: a brew installed at a non-standard prefix, resolved via the login shell's PATH.
        if let resolved = await resolveBrewOnPath(), await isBrewPathValid(at: resolved) {
            return adopt(resolvedBrewExecutable: resolved, setPathOption: setPathOption)
        }

        return nil
    }

    /// Maps a resolved brew executable to a ``PathOption``. Standard prefixes map to their arch
    /// default; anything else is stored as the custom path so the rest of the app (which switches
    /// on `PathOption`) keeps working.
    private static func adopt(resolvedBrewExecutable url: URL, setPathOption: Bool) -> PathOption {
        let path = url.path(percentEncoded: false)
        let option: PathOption

        switch path {
        case "/opt/homebrew/bin/brew":
            option = .defaultAppleSilicon
        case "/usr/local/bin/brew":
            option = .defaultIntel
        default:
            UserDefaults.standard.setValue(path, for: Preferences.customUserBrewPath)
            option = .custom
        }

        if setPathOption { selectedBrewOption = option }
        return option
    }

    /// Resolves a `brew` executable from the environment: `$HOMEBREW_PREFIX/bin/brew` if set,
    /// otherwise the login shell's `PATH`. The login-shell probe uses a timeout so a hung shell
    /// (e.g. a broken `.zshrc`) can never stall app launch.
    private static func resolveBrewOnPath() async -> URL? {
        if let prefix = ProcessInfo.processInfo.environment["HOMEBREW_PREFIX"], !prefix.isEmpty {
            let candidate = URL(fileURLWithPath: prefix)
                .appendingPathComponent("bin", isDirectory: true)
                .appendingPathComponent("brew")
            if FileManager.default.isExecutableFile(atPath: candidate.path) {
                return candidate
            }
        }

        // A login shell (`-l`) sources the user's profile, so `command -v brew` sees the PATH they
        // actually use — this is what finds brew at a non-standard prefix.
        guard let output = try? await Shell.run(URL(fileURLWithPath: "/bin/zsh"), ["-lc", "command -v brew"], timeout: .seconds(5)) else {
            return nil
        }

        let path = output.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path)
    }
}

```

### Core Architecture Module: `Applite/Core/Brew/BrewService.swift`
```
//
//  BrewService.swift
//  Applite
//
//  Created by Milán Várady on 2026. 02. 11..
//

import Foundation
import SwiftUI
import OSLog

struct ActiveBrewTask: Identifiable {
    let id = UUID()
    /// Groups the rows belonging to the same brew operation (a batch shares one across its casks).
    /// Eviction is scoped to this, so a finishing op only removes its *own* rows — never a
    /// different, still-queued op's row for the same cask (which would make that card vanish and
    /// its cancel silently no-op while brew still ran).
    let operationID: UUID
    let viewModel: CaskViewModel
    let task: Task<Void, Never>
}

/// Progress of an in-flight bulk operation (install-all / update-all).
struct BatchProgress: Equatable {
    var completed: Int
    var total: Int
    /// True for update-all, false for install-all — drives the header wording and lets the
    /// Update-All button ignore a *different* (install-all) batch ending.
    var isUpdate: Bool
}

/// Wraps a streaming brew failure together with the output captured so far,
/// so callers can build tailored error messages from the partial output.
struct BrewStreamError: Error {
    let underlying: Error
    let output: String
}

/// Handles all brew CLI operations (install, uninstall, update, reinstall) on CaskViewModels.
@Observable
@MainActor
final class BrewService {
    private(set) var activeTasks: [ActiveBrewTask] = []

    /// Asks the owner (`CaskManager`) to re-resolve brew when an operation finds the selected path
    /// invalid, returning whether brew ended up usable. Wired to `HomebrewBootstrap.run()` so this
    /// service reports the fault into the one owned brew state instead of deciding on its own how a
    /// broken brew should look (E1/F1). `run()` is single-flight, so a queue of ops collapses into
    /// a single recovery pass.
    var recoverBrew: (@MainActor () async -> Bool)?

    /// Progress of an in-flight bulk operation, or `nil` when none. Drives an aggregate
    /// "Installing X of N…" header (see `ActiveTasksView`).
    private(set) var batchProgress: BatchProgress?

    /// Tail of the serial operation queue. Every brew op chains after this so only ONE brew
    /// process runs at a time — Homebrew doesn't support concurrent `brew` invocations, and
    /// concurrent ones collide on its lock (silently dropping casks). A queued op shows "Waiting…".
    private var queueTail: Task<Void, Never>?

    /// Reference holder so a batch's `Task` can be published (after it's created) for cancellation.
    private final class BatchHandle { var task: Task<Void, Never>? }
    /// The currently-executing bulk op, or nil. Set when a batch actually starts running (not while
    /// queued) so `cancelBatch()` cancels only the running batch, never queued single ops.
    private var runningBatch: BatchHandle?

    /// Label shown on a cask's card while its operation is queued behind a running one.
    private var waitingLabel: String {
        String(localized: "Waiting…", comment: "Queued brew operation label")
    }

    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: BrewService.self)
    )

    // MARK: - Public Operations

    /// Installs the cask. Returns the tracking task so callers (e.g. `installAll`) can
    /// await completion and serialize; discardable for the common fire-and-forget case.
    @discardableResult
    func install(_ vm: CaskViewModel) -> Task<Void, Never> {
        return runTask(for: vm) {
            Self.logger.info("Cask \"\(vm.token)\" installation started")

            // Always --force: the Install button only shows when the cask isn't tracked as
            // installed, so force just overwrites/adopts any untracked copy already on disk instead
            // of erroring — and it's identical to a plain install when nothing is there.
            // Use `fullToken` (like every sibling op) so a tapped token that collides with a core
            // cask installs the intended cask, not the core one.
            var arguments = ["install", "--cask", vm.fullToken, "--force"]
            arguments.append(contentsOf: Self.appdirArguments())

            // Setup progress
            vm.progressState = .busy(withTask: "")

            // Run install command and stream output
            let result = await self.streamBrewCommand(
                arguments,
                vm: vm,
                busyLabel: String(localized: "Installing", comment: "Install progress text")
            )

            // Stopped by the user — no success/failure surface.
            if Task.isCancelled {
                vm.progressState = .idle
                return
            }

            if case .failure(let error) = result {
                let completeOutput = error.output
                var failureMessage = error.underlying.localizedDescription

                // Show a more helpful message in specific cases
                switch completeOutput {
                    // Network error
                case _ where completeOutput.contains("Could not resolve host"):
                    failureMessage = String(localized: "Couldn't download app. No internet connection, or host is unreachable.", comment: "No internet failure message")
                default:
                    // Homebrew error
                    if let result = completeOutput.firstMatch(of: /Error:(.+)/) {
                        failureMessage = String(result.1)
                    }
                }

                await self.showFailure(
                    for: vm,
                    error: error.underlying,
                    output: completeOutput,
                    failureTitle: String(localized: "Failed to install \(vm.name)", comment: "Install failure notification title"),
                    failureMessage: failureMessage
                )

                return
            }

            await self.showSuccess(
                for: vm,
                logMessage: "Successfully installed cask \(vm.token)",
                notificationTitle: String(localized: "\(vm.name) successfully installed!", comment: "Successful app install notification")
            )

            // Update state
            vm.isInstalled = true
        }
    }

    /// Uninstalls the cask
    func uninstall(_ vm: CaskViewModel, zap: Bool = false) {
        runTask(for: vm) {
            vm.progressState = .busy(withTask: String(localized: "Uninstalling", comment: "Uninstall progress text"))

            // Always --force (mirrors the bulk-install rationale): a cask whose files are partly
            // gone — app manually trashed, an orphaned font, a half-finished install — otherwise
            // fails a plain uninstall and strands the entry. Force makes uninstall resilient.
            var arguments: [String] = ["uninstall", "--cask", vm.fullToken, "--force"]

            // --zap additionally removes the cask's app data (prefs/caches/launch agents).
            if zap {
                arguments.append("--zap")
            }

            var output: String = ""

            do {
                output = try await Shell.runBrewCommand(arguments)
            } catch {
                await self.showFailure(
                    for: vm,
                    error: error,
                    output: output,
                    failureTitle: String(localized: "Failed to uninstall \(vm.name)", comment: "Failed app install notification title"),
                    failureMessage: error.localizedDescription
                )
                return
            }

            await self.showSuccess(
                for: vm,
                logMessage: "Successfully uninstalled \(vm.fullToken)",
                notificationTitle: String(localized: "\(vm.name) successfully uninstalled", comment: "Successful app uninstall notification")
            )

            // Update state
            vm.isInstalled = false
        }
    }

    /// Updates the cask. Returns the tracking task so `updateAll` can serialize.
    @discardableResult
    func update(_ vm: CaskViewModel) -> Task<Void, Never> {
        return runTask(for: vm) {
            let updateLabel = String(localized: "Updating", comment: "Update progress text")
            vm.progressState = .busy(withTask: updateLabel)

            let result = await self.streamBrewCommand(["upgrade", "--cask", vm.fullToken], vm: vm, busyLabel: updateLabel)

            // Stopped by the user — no success/failure surface.
            if Task.isCancelled {
                vm.progressState = .idle
                return
            }

            if case .failure(let error) = result {
                await self.showFailure(
                    for: vm,
                    error: error.underlying,
                    output: error.output,
                    failureTitle: String(localized: "Failed to update \(vm.name)", comment: "Failed app update notification title"),
                    failureMessage: error.underlying.localizedDescription
                )
                return
            }

            await self.showSuccess(
                for: vm,
                logMessage: "Successfully updated \(vm.token)",
                notificationTitle: String(localized: "\(vm.name) successfully updated", comment: "Successful app update notification")
            )

            // Update state
            vm.isOutdated = false
        }
    }

    /// Reinstalls the cask
    func reinstall(_ vm: CaskViewModel) {
        runTask(for: vm) {
            let reinstallLabel = String(localized: "Reinstalling", comment: "Reinstall progress text")
            vm.progressState = .busy(withTask: reinstallLabel)

            let result = await self.streamBrewCommand(["reinstall", "--cask", vm.fullToken], vm: vm, busyLabel: reinstallLabel)

            // Stopped by the user — no success/failure surface.
            if Task.isCancelled {
                vm.progressState = 
```

### Core Architecture Module: `Applite/Core/Brew/Installation/AnnexBrewError.swift`
```
//
//  AnnexBrewError.swift
//  Applite
//
//  Created by Milán Várady on 2024.12.25.
//

import Foundation

enum AnnexBrewError: LocalizedError {
    case invalidBrewInstallation

    /// Reaches the user as an alert body, so it's localized.
    var errorDescription: String? {
        switch self {
        case .invalidBrewInstallation:
            return String(localized: "The Brew installation seems to be invalid.",
                          comment: "Error shown when Applite's Homebrew is present but unusable")
        }
    }
}

```

### Core Architecture Module: `Applite/Core/Brew/Installation/AnnexBrewManager.swift`
```
//
//  AnnexBrewManager.swift
//  Applite
//
//  Created by Milán Várady on 2023. 01. 14..
//

import Foundation
import OSLog

/// Installs and maintains Applite's own ("annex") Homebrew installation at
/// `~/Library/Application Support/Applite/Homebrew`.
///
/// Applite only installs **casks** (precompiled app binaries), so it needs neither a compiler
/// nor the Xcode Command Line Tools. The annex is a plain tarball extraction of Homebrew; brew
/// then runs in API mode (cask metadata over curl) with auto-update disabled (see `Shell`), which
/// keeps git — the one tool macOS won't provide without CLT — off the cask install path.
///
/// As of Homebrew 6.0.12 the CLT-free cask flow is handled entirely by brew itself: the fatal ARM
/// dev-tools check and the `xcrun -find` fallback went away in 6.0.10, and the FFI
/// quarantine/xattr/trash helpers (which need no Swift) became the default for all users in 6.0.12
/// (PR #23061), replacing the old `HOMEBREW_DEVELOPER`-gated path. So the annex is now an
/// unpatched, plain extraction that tracks `main` — kept current by the periodic refresh (see
/// `refreshAnnexBrew`), the same rolling source `brew update` pulls. It must be `main` and not
/// `master`; see `brewTarballURL` for what happens otherwise.
struct AnnexBrewManager {
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: AnnexBrewManager.self)
    )

    /// Homebrew source tarball, extracted verbatim into the annex directory.
    ///
    /// Tracks `main` (no version pin) — the same rolling source `brew update` pulls — because the
    /// annex is no longer patched: brew 6.0.10+ handles CLT-free cask installs natively (see the
    /// `AnnexBrewManager` header and `Shell`). The periodic refresh keeps this current.
    ///
    /// **Must be `main`, not `master`.** Homebrew made `main` its default branch and on 2026-09-04
    /// (PR #23733) reduced `master` to a three-file stub: a `bin/brew` that prints "Homebrew's
    /// master branch is no longer supported" and exits 1 for every command except `brew update`.
    /// That stub's migration path is `git fetch` + `git checkout` against a real clone, which the
    /// annex can never satisfy — it is a tarball extraction with no `.git` at all — so there is no
    /// in-place recovery from pointing at `master`. It broke both paths at once: a clean install
    /// extracted 3 files and failed `verifyAnnexInstall`, and the non-destructive refresh overlaid
    /// the stub's `bin/brew` onto a working tree and bricked it.
    static let brewTarballURL = "https://github.com/Homebrew/brew/tarball/main"

    // MARK: - Annex install / refresh

    /// The shell command that fetches the Homebrew tarball and unpacks it into `directory`
    /// (the annex directory by default; a staging dir for an atomic clean reinstall).
    /// Shared by the clean install, the streaming first-run install, and the freshness refresh.
    static func annexExtractCommand(into directory: URL = BrewPaths.annexBrewDirectory) -> String {
        // `set -o pipefail` + `curl -fL`: without them a truncated download or an HTTP error body is
        // swallowed — the pipeline's exit status is tar's, so tar happily extracts a partial (or
        // garbage) tree and the command "succeeds" with a half-installed brew. `verifyAnnexInstall`'s
        // `brew --version` check won't catch that (it loads too little), so it only surfaces later as
        // a missing-file crash. `-f` fails on HTTP errors; pipefail propagates curl's exit through
        // the pipe. (macOS `/bin/sh` is bash, which supports `pipefail`.)
        "set -o pipefail; curl -fL \(brewTarballURL) | tar xz --strip 1 -C \(directory.quotedPath())"
    }

    /// Ensures the annex directory exists.
    ///
    /// - Parameter clean: When `true` the directory is deleted first (a pristine reinstall). When
    ///   `false` the tarball is unpacked *over* the existing tree, which overwrites brew's own
    ///   program files while leaving the runtime dirs (`Caskroom`, `Cellar`, `var`, cache)
    ///   untouched — this is what makes a freshness refresh safe for already-installed apps.
    static func prepareAnnexDirectory(clean: Bool) throws {
        if clean, FileManager.default.fileExists(atPath: BrewPaths.annexBrewDirectory.path) {
            Self.logger.info("Removing existing annex Homebrew directory for a clean install")
            try FileManager.default.removeItem(at: BrewPaths.annexBrewDirectory)
        }

        try FileManager.default.createDirectory(
            at: BrewPaths.annexBrewDirectory,
            withIntermediateDirectories: true
        )
    }

    /// Whether the annex tree holds apps the user installed — that is, a non-empty `Caskroom`.
    ///
    /// Gates the in-place repair in `HomebrewBootstrap.runBootstrap`. `Caskroom` lives *inside* the
    /// annex directory (`~/Library/Application Support/Applite/Homebrew`), so the clean install's
    /// `prepareAnnexDirectory(clean: true)` takes it with the rest of the tree; when there is
    /// something in it, repairing over the top is worth a try first.
    ///
    /// When there is nothing to preserve the clean install is the better answer anyway: it also
    /// clears away any half-extracted leftovers, which an overlay extract would leave behind.
    static func annexHasInstalledApps() -> Bool {
        let caskroom = BrewPaths.annexBrewDirectory
            .appending(path: "Caskroom", directoryHint: .isDirectory)

        guard let entries = try? FileManager.default.contentsOfDirectory(
            atPath: caskroom.path(percentEncoded: false)
        ) else {
            return false
        }

        // Ignore dotfiles so a stray .DS_Store doesn't read as "the user has apps installed".
        return entries.contains { !$0.hasPrefix(".") }
    }

    /// Verifies a brew executable actually runs and reports Homebrew (defaults to the annex's).
    static func verifyAnnexInstall(at executable: URL = BrewPaths.annexBrewExecutable) async throws {
        guard await BrewPaths.isBrewPathValid(at: executable) else {
            throw AnnexBrewError.invalidBrewInstallation
        }
    }

    /// Records "the annex tarball is current as of now" so the freshness check (see
    /// `HomebrewBootstrap.refreshAnnexIfStale`) doesn't immediately re-fetch after an install.
    static func stampAnnexRefreshed() {
        UserDefaults.standard.setValue(Date().timeIntervalSince1970, for: Preferences.annexLastRefreshDate)
    }

    /// Clean install of the annex brew: unpacks the tarball into a staging dir, verifies it, and
    /// only then atomically swaps it into place. Used by the "Reinstall" action.
    ///
    /// Staging-then-swap (P3-2): the old, working install is never touched until a fresh tree has
    /// been fully downloaded, extracted, and verified. A failure at any point (network drop, disk
    /// full, quit mid-extract) leaves the existing Homebrew intact instead of destroying it — the
    /// previous "wipe first, then download" order turned any transient failure into a dead install.
    static func installAnnexClean() async throws {
        Self.logger.info("Clean annex Homebrew install started")

        let fm = FileManager.default
        let finalDir = BrewPaths.annexBrewDirectory
        let parent = finalDir.deletingLastPathComponent()
        let stagingDir = parent.appending(path: "Homebrew.staging", directoryHint: .isDirectory)
        let backupDir = parent.appending(path: "Homebrew.old", directoryHint: .isDirectory)

        // 1. Extract into a clean staging dir and verify it — all before touching the live install.
        try? fm.removeItem(at: stagingDir)
        try fm.createDirectory(at: stagingDir, withIntermediateDirectories: true)
        do {
            try await Shell.runShellScript(annexExtractCommand(into: stagingDir))
            try await verifyAnnexInstall(at: stagingDir.appendingPathComponent("bin/brew"))
        } catch {
            try? fm.removeItem(at: stagingDir)   // leave the existing install untouched
            throw error
        }

        // 2. Swap in the verified tree via fast same-volume renames; the only non-atomic gap is
        //    between two renames (sub-millisecond), and a failure there is rolled back.
        try? fm.removeItem(at: backupDir)
        if fm.fileExists(atPath: finalDir.path) {
            try fm.moveItem(at: finalDir, to: backupDir)
        }
        do {
            try fm.moveItem(at: stagingDir, to: finalDir)
        } catch {
            // Restore the previous install if the swap-in failed.
            if fm.fileExists(atPath: backupDir.path) {
                try? fm.moveItem(at: backupDir, to: finalDir)
            }
            throw error
        }
        try? fm.removeItem(at: backupDir)   // discard the old tree once the new one is in place

        BrewPaths.selectedBrewOption = .annex
        stampAnnexRefreshed()
        Self.logger.info("Clean annex Homebrew install done")
    }

    /// Re-fetches the Homebrew tarball over the existing annex without deleting it, keeping the
    /// program files current while preserving installed apps. No-op unless the annex is the
    /// selected brew. Replaces the git-based `brew update`, which can't run without CLT.
    static func refreshAnnexBrew() async throws {
        guard BrewPaths.selectedBrewOption == .annex else {
            Self.logger.info("Skipping annex refresh — annex is not the selected brew")
            return
        }

        Self.logger.info("Refreshing annex Homebrew (non-destructive overlay)")

        var refreshError: Error?
        do {
            try prepareAnnexDirectory(clean: false)
            try await Shell.runShellScript(annexExtractCommand())
            try await verifyAnnexInstall()
            stampAnnexRefreshed()
            Self.logger.info("Annex Homebrew refresh done")
        } catch {
            ref
```

### Core Architecture Module: `Applite/Core/Brew/Installation/GitShim.swift`
```
//
//  GitShim.swift
//  Applite
//
//  Created by Milán Várady on 2025.07.06.
//

import Foundation
import OSLog

/// A stand-in `git` for the CLT-free annex brew.
///
/// Homebrew refuses to install a cask until `git --version` succeeds (`Utils::Git.ensure_installed!`),
/// even though it never actually clones for normal curl-download casks. On a Mac without the Xcode
/// Command Line Tools there is no usable git, so brew tries to *build* one and fails with
/// "No developer tools installed."
///
/// This shim answers `git --version` with a valid version so brew's availability check passes; brew
/// then downloads the cask with curl as usual. Any real git operation exits non-zero — the same
/// outcome as the annex's missing `.git` repo, which brew already tolerates. It is only used for the
/// annex (see `Shell`); a user's own brew keeps its real git.
///
/// Trade-off: the rare casks that fetch from a git repository (`using: :git`) won't work under the
/// annex. Those users can point Applite at a full Homebrew install in Settings.
enum GitShim {
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: GitShim.self)
    )

    static let directory = AppPaths.applicationSupport
        .appending(path: "git-shim", directoryHint: .isDirectory)

    /// Path Homebrew is pointed at via `HOMEBREW_GIT_PATH`.
    static let executable = directory.appendingPathComponent("git")

    /// Homebrew parses the version from the trailing token of `git --version`, and requires
    /// >= 2.14.3 on macOS — so the line must end in a plain, high-enough version number. We report a
    /// version comfortably above brew's floor (and above current real git releases) so a future bump
    /// to that minimum can't start failing the check. It stays plausible rather than absurdly high so
    /// brew doesn't try to use git features newer than any that exist.
    private static let script = """
    #!/bin/sh
    if [ "$1" = "--version" ]; then
      echo "git version 2.50.0"
      exit 0
    fi
    exit 1
    """

    /// Writes the shim (once) and marks it executable. Cheap to call repeatedly — it no-ops when the
    /// script is already present and up to date.
    static func ensureInstalled() {
        if FileManager.default.isExecutableFile(atPath: executable.path),
           let existing = try? String(contentsOf: executable, encoding: .utf8),
           existing == script {
            return
        }

        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try script.write(to: executable, atomically: true, encoding: .utf8)
            try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: executable.path)
            logger.info("git shim installed at \(executable.path, privacy: .public)")
        } catch {
            logger.error("Failed to install git shim: \(error.localizedDescription)")
        }
    }
}

```

### Core Architecture Module: `Applite/Core/Brew/Installation/HomebrewBootstrap.swift`
```
//
//  HomebrewBootstrap.swift
//  Applite
//
//  Created by Milán Várady on 2025.07.06.
//

import Foundation
import OSLog

/// Resolves a usable Homebrew on launch — with **no onboarding and no Xcode Command Line Tools**.
///
/// Replaces the old first-run setup flow. On launch it honors an existing/selected brew if there
/// is one, otherwise silently installs Applite's own annex brew from a tarball while the (DB-backed)
/// catalog stays browsable underneath. The `phase` drives a non-dismissable overlay over `ContentView`.
@MainActor
@Observable
final class HomebrewBootstrap {
    enum Phase: Equatable {
        /// Detecting an existing brew.
        case checking
        /// Installing the annex brew (drives the progress overlay).
        case installing
        /// The annex was just installed; brew is usable, but the success overlay stays up until the
        /// user acknowledges it (so they learn setup finished and can opt into their own brew).
        case installed
        /// A valid brew is selected; the app can use brew. No overlay.
        case ready
        /// Bootstrap failed; the overlay shows the message plus Retry and the "use my own brew" escape hatch.
        case failed(String)
        /// The user selected their *own* (non-annex) brew and it can't be found. Distinct from
        /// `.failed` so we can name the missing path and never silently install/switch to the annex
        /// over their explicit choice.
        case brewMissing(path: String)
    }

    /// The single source of truth for "can Applite use brew". Every surface that reacts to a
    /// broken/missing brew derives from this — there is no parallel flag anywhere (E1/F1).
    private(set) var phase: Phase = .checking

    /// Whether brew is usable — either a pre-existing brew (`.ready`) or a freshly installed annex
    /// still awaiting the user's acknowledgment (`.installed`). Data loading gates on this.
    var isBrewReady: Bool {
        phase == .ready || phase == .installed
    }

    /// Whether the non-dismissable setup card should cover the window. It's up for the annex install
    /// *and* for every broken outcome, which is why brokenness needs no second UI surface of its own:
    /// the card already shows the real message plus Retry, Troubleshooting and the own-brew escape
    /// hatch. Lives here, next to `phase`, so `ContentView` doesn't re-derive it.
    var needsSetupOverlay: Bool {
        switch phase {
        case .installing, .installed, .failed, .brewMissing: true
        case .checking, .ready: false
        }
    }

    /// Latest streamed line from the tarball install, shown in the overlay.
    private(set) var statusLine: String = ""

    /// Bumped to ask `ContentView` to re-run the bootstrap+load (`.task(id:)`). Bumping cancels
    /// any in-flight annex install (SwiftUI cancels the previous task) — this is how the "use my
    /// own brew" escape hatch and the Retry button interrupt a running install.
    private(set) var attempt = 0

    /// Requests a fresh bootstrap+load pass. The escape hatch calls this after the user has picked
    /// a valid brew in the embedded path selector; Retry calls it after a failure.
    func requestReload() {
        attempt += 1
    }

    /// Dismisses the post-install success overlay. Brew was already usable in `.installed`, so this
    /// just hides the overlay; no reload needed.
    func acknowledgeInstall() {
        if phase == .installed { phase = .ready }
    }

    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: HomebrewBootstrap.self)
    )

    /// Extra re-checks of the user's *own* selected brew before declaring it missing. A single
    /// `brew --version` probe can fail transiently (cold start, machine under load), and we must
    /// not throw a "Homebrew not found" overlay at a user whose brew is actually fine. Only runs
    /// when their brew already looks invalid, so it adds no latency to the healthy path.
    private static let selectedBrewRevalidationRetries = 2
    private static let selectedBrewRevalidationDelay: Duration = .milliseconds(400)

    /// The in-flight bootstrap pass and the `attempt` generation it was started for. Used to make
    /// `run()` single-flight so a second entry point (`loadData(forceSync:)` from ⌘R / Settings)
    /// can't kick off a bootstrap concurrently with the launch one — two `installAnnex()` passes
    /// would both `prepareAnnexDirectory(clean:)`, one wiping the tree the other extracts into.
    @ObservationIgnored private var runTask: Task<Void, Never>?
    @ObservationIgnored private var runningAttempt = -1

    /// Resolves brew, installing the annex only as a last resort. Safe to call again (Retry).
    ///
    /// Single-flight, generation-aware:
    /// - A concurrent call for the *same* `attempt` (e.g. `loadData` overlapping the launch pass)
    ///   awaits the in-flight pass instead of starting a second, concurrent one.
    /// - A call after `attempt` was bumped (Retry / the "use my own brew" escape hatch) supersedes
    ///   the old pass: it cancels it, waits for it to finish unwinding (so the annex directory is
    ///   never touched by two passes at once), then starts fresh.
    func run() async {
        if let runTask, runningAttempt == attempt {
            await runTask.value
            return
        }

        // A newer generation supersedes any still-running older pass.
        runTask?.cancel()
        await runTask?.value

        let started = attempt
        let task = Task { await self.runBootstrap() }
        runningAttempt = started
        runTask = task
        await task.value

        // Only clear if we're still the current pass (a newer generation may have replaced us).
        if runningAttempt == started { runTask = nil }
    }

    /// The actual bootstrap sequence. Runs inside the `run()`-owned `Task`, so `Task.isCancelled`
    /// here reflects `run()` cancelling it when a newer generation supersedes this pass.
    private func runBootstrap() async {
        phase = .checking

        // 1. Honor a working selection first — covers existing users, custom paths, and a prior
        //    annex. Never overrides a brew the user is already pointed at.
        if await BrewPaths.isSelectedBrewPathValid() {
            Self.logger.info("Selected brew path is valid — ready")
            phase = .ready
            return
        }

        // 1b. The user is pointed at their *own* brew (not the annex) and step 1 said it's invalid.
        //     We must NOT fall through to the steps below: detect-and-switch (2) would silently
        //     move them to a *different* brew if theirs is gone, and adopt/install-annex (3, 4)
        //     would switch to the annex — all three orphan their installed apps, the very bug
        //     we're preventing. What we CAN safely do is re-check their *own* path, since a
        //     `brew --version` probe fails transiently now and then; only after it stays invalid
        //     do we surface it (the annex path gets an equivalent recheck at step 3).
        if BrewPaths.selectedBrewOption != .annex {
            for retry in 1...Self.selectedBrewRevalidationRetries {
                try? await Task.sleep(for: Self.selectedBrewRevalidationDelay)
                if Task.isCancelled { return }  // escape hatch / Retry superseded us
                if await BrewPaths.isSelectedBrewPathValid() {
                    Self.logger.info("Selected brew validated on retry \(retry) — ready")
                    phase = .ready
                    return
                }
            }
            let path = BrewPaths.currentBrewExecutable.path(percentEncoded: false)
            Self.logger.error("Selected non-annex brew still invalid at \(path) after \(Self.selectedBrewRevalidationRetries) retries")
            phase = .brewMissing(path: path)
            return
        }

        // 1c. Past 1b the selected option is always `.annex`, so if we got here the annex brew
        //     won't run. When its tree still holds apps the user installed, repair it before
        //     considering anything else: re-extract the tarball *over* it, the same
        //     non-destructive overlay the periodic refresh uses, replacing brew's own program
        //     files and leaving `Caskroom`, `Cellar` and `var` alone.
        //
        //     This has to come before step 2, not after step 3. Step 2's detect-and-switch would
        //     silently move an annex user with a broken annex onto their own `/opt/homebrew`,
        //     which orphans every app in the annex Caskroom — the same "don't switch a user away
        //     from the brew their apps live in" rule step 1b already applies to custom paths. And
        //     step 4's `clean: true` deletes the annex directory outright, Caskroom included.
        //     Either way brew comes back working and knowing about none of the user's apps: the
        //     `.app` files sit in the applications folder while Applite's Installed list is empty
        //     and updates and uninstalls quietly stop working for all of them.
        //
        //     This is the recovery path for the 2026-09-04 `master`-branch breakage (see
        //     `AnnexBrewManager.brewTarballURL`). The refresh overlaid a three-file stub onto a
        //     working tree, so only `bin/brew` is damaged — the rest of Homebrew is still there,
        //     and re-extracting is enough to make it run again.
        //
        //     A first run has no annex tree, so `annexHasInstalledApps()` is false and step 2
        //     still gets its usual chance to adopt an existing Homebrew.
        if AnnexBrewManager.annexHasInstalledApps() {
            switch await repairAnnex() {
            case .repaired:
                return

            case .cancelled:
                // Superseded by Retry or the escape hatch. Leave the tree and the phase alone and

```

### Core Architecture Module: `Applite/Core/Brew/InstalledCaskService.swift`
```
//
//  InstalledCaskService.swift
//  Applite
//
//  Created by Milán Várady on 2025.05.09.
//

import Foundation
import OSLog

/// Service for interacting with the brew CLI to manage installed casks
struct InstalledCaskService {
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: InstalledCaskService.self)
    )

    /// Gets the list of installed casks
    /// - Returns: A set of Cask IDs representing installed casks
    func getInstalledCasks() async throws -> Set<CaskId> {
        let output = try await Shell.runBrewCommand(["list", "--cask", "--full-name"])

        if output.isEmpty {
            logger.notice("No installed casks were found.")
        }

        let caskIds = output
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: "\n")
            .filter { !$0.isEmpty }

        return Set(caskIds)
    }

    /// Gets the list of outdated casks
    /// - Returns: A set of Cask IDs representing outdated casks
    func getOutdatedCasks() async throws -> Set<CaskId> {
        var arguments: [String] = ["outdated", "--cask", "-q"]

        let greedy = UserDefaults.standard.value(for: Preferences.greedyUpgrade)

        if greedy {
            arguments.append("-g")
        }

        let output = try await Shell.runBrewCommand(arguments)

        let caskIds = output
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: .newlines)
            .filter({ !$0.isEmpty })                                        // Remove empty strings
            .map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) })    // Trim whitespace

        return Set(caskIds)
    }
}

```

### Core Architecture Module: `Applite/Core/Brew/Shell.swift`
```
//
//  Shell.swift
//  Applite
//
//  Created by Milán Várady on 2024.12.25.
//

import Foundation
import OSLog
import os

/// Namespace for shell command execution utilities.
///
/// Commands run in one of two ways:
/// - **argv execution** (``run(_:_:pty:timeout:)`` / ``stream(_:_:pty:)`` and the brew helpers):
///   the executable is launched directly with an argument array — there is **no `/bin/sh -c`**, so
///   nothing in `arguments` is ever parsed by a shell. This is the *only* safe path for commands
///   whose arguments include untrusted values (third-party cask tokens, user-entered brew/appdir
///   paths). Even the pty variant funnels the argv through `exec "$0" "$@"`, never string-splicing.
/// - **shell-script execution** (``runShellScript(_:pty:timeout:)`` / ``streamShellScript(_:pty:)``):
///   runs `/bin/sh -c <script>`. Reserved for fixed, trusted script *literals* that genuinely need
///   shell features (globs, pipes, `$HOME`, `set -o pipefail`). Never interpolate untrusted input
///   into such a script — that reopens the injection hole the argv path exists to prevent.
enum Shell {
    private static let logger = Logger(subsystem: Bundle.main.bundleIdentifier!, category: "Shell")

    // MARK: - Argv execution (no shell — injection-proof)

    /// Runs an executable directly with an argv array and returns its combined output.
    ///
    /// - Parameters:
    ///   - executableURL: The program to run.
    ///   - arguments: Argument vector, passed verbatim — no shell parsing, quoting, or word-splitting.
    ///   - pty: Run inside a pseudo-TTY (needed for brew's live progress output).
    ///   - timeout: If set, the process is killed after this duration and ``ShellError/timedOut`` is
    ///     thrown. Use for commands that could hang (e.g. a `brew --version` probe against a broken path).
    @discardableResult
    static func run(_ executableURL: URL, _ arguments: [String], pty: Bool = false, timeout: Duration? = nil) async throws -> String {
        try await runProcessAsync(executableURL: executableURL, arguments: arguments, pty: pty, timeout: timeout)
    }

    /// Streams an executable's output line-by-line. Argv-based; see ``run(_:_:pty:timeout:)``.
    static func stream(_ executableURL: URL, _ arguments: [String], pty: Bool = false) -> AsyncThrowingStream<String, Error> {
        makeStream(executableURL: executableURL, arguments: arguments, pty: pty)
    }

    // MARK: - Brew convenience

    /// Runs the currently-selected `brew` with `arguments`. Argv-based, so tokens/paths are safe.
    @discardableResult
    static func runBrewCommand(_ arguments: [String], pty: Bool = false, timeout: Duration? = nil) async throws -> String {
        try await run(BrewPaths.currentBrewExecutable, arguments, pty: pty, timeout: timeout)
    }

    /// Streams the currently-selected `brew` with `arguments`. Argv-based, so tokens/paths are safe.
    static func streamBrewCommand(_ arguments: [String], pty: Bool = false) -> AsyncThrowingStream<String, Error> {
        stream(BrewPaths.currentBrewExecutable, arguments, pty: pty)
    }

    // MARK: - Shell-script escape hatch (trusted literals only)

    /// Runs `/bin/sh -c <script>`. See the type doc: **fixed, trusted literals only** — never
    /// interpolate untrusted input (cask tokens, user paths) into `script`.
    @discardableResult
    static func runShellScript(_ script: String, pty: Bool = false, timeout: Duration? = nil) async throws -> String {
        try await run(URL(fileURLWithPath: "/bin/sh"), ["-c", script], pty: pty, timeout: timeout)
    }

    /// Streams `/bin/sh -c <script>`. See ``runShellScript(_:pty:timeout:)`` for the safety contract.
    static func streamShellScript(_ script: String, pty: Bool = false) -> AsyncThrowingStream<String, Error> {
        stream(URL(fileURLWithPath: "/bin/sh"), ["-c", script], pty: pty)
    }

    // MARK: - Process implementation

    /// How long a process gets to honor SIGTERM before it is killed outright.
    ///
    /// `terminate()` is a *request*, not a guarantee: a brew wedged in a syscall — or a `script`
    /// wrapper whose child ignored the pty hangup — can outlive it. That matters most at quit, where
    /// the survivor is reparented to launchd and keeps running with no Applite left to stop it
    /// (P3-10). Anything that waits for a clean unwind must allow **more** than this — see
    /// `BrewService.cancelAllAndWait`.
    static let terminationGrace: Duration = .seconds(1)

    /// How long a stream's pipe must stay *silent* after the process exits before we force EOF by
    /// closing our read end. Idle-based rather than a fixed delay, so a slow drain is never cut off —
    /// see the read loop in ``makeStream(executableURL:arguments:pty:)``.
    private static let eofIdleTimeout: Duration = .milliseconds(750)
    private static let eofIdlePollInterval: Duration = .milliseconds(150)

    /// Asks the process to stop, and makes sure it does.
    ///
    /// SIGTERM first so brew can unwind normally, then SIGKILL if it's still alive after
    /// ``terminationGrace``. The liveness re-check reads `isRunning` rather than trusting the cached
    /// pid, so a pid recycled by the OS after the process was reaped can never be signalled.
    static func terminateThenKill(_ process: Process) {
        guard process.isRunning else { return }
        process.terminate()

        let pid = process.processIdentifier
        Task.detached {
            try? await Task.sleep(for: terminationGrace)
            guard process.isRunning else { return }
            kill(pid, SIGKILL)
        }
    }

    /// Runs a process and awaits its termination handler — **never blocks a thread** on
    /// `waitUntilExit()`. Blocking inside async code starves the concurrency pool and stalls
    /// SwiftUI's main-run-loop updates, so all non-streaming runs go through here.
    ///
    /// Cancelling the awaiting `Task` terminates the process (SIGTERM) so a hung brew can't wedge
    /// the serial queue forever; a `timeout`, when set, does the same after the given duration.
    private static func runProcessAsync(executableURL: URL, arguments: [String], pty: Bool, timeout: Duration?) async throws -> String {
        try Task.checkCancellation()

        let displayCommand = ([executableURL.path(percentEncoded: false)] + arguments).joined(separator: " ")
        let (task, pipe) = try createProcess(executableURL: executableURL, arguments: arguments, pty: pty)
        let handle = pipe.fileHandleForReading

        // Drain the pipe *concurrently* (not after exit) so a large output can't fill the ~64 KB
        // pipe buffer and block the child before it exits — which would hang `terminationHandler`
        // (and the continuation) forever. `readabilityHandler` fires on a background queue; the lock
        // makes the append safe against the termination-time tail drain.
        let collected = OSAllocatedUnfairLock<Data>(initialState: Data())
        handle.readabilityHandler = { fileHandle in
            let chunk = fileHandle.availableData
            if !chunk.isEmpty {
                collected.withLock { $0.append(chunk) }
            }
        }

        let watchdog: Task<Void, Never>? = timeout.map { duration in
            Task {
                try? await Task.sleep(for: duration)
                terminateThenKill(task)
            }
        }
        defer { watchdog?.cancel() }

        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                task.terminationHandler = { proc in
                    handle.readabilityHandler = nil
                    // Capture any bytes buffered between the last readability callback and exit.
                    let tail = handle.availableData
                    let data = collected.withLock { buffer -> Data in
                        if !tail.isEmpty { buffer.append(tail) }
                        return buffer
                    }
                    let output = String(decoding: data, as: UTF8.self).cleanTerminalOutput()

                    // A timeout / cancellation kills the process with SIGTERM, escalating to
                    // SIGKILL if it ignores that (see `terminateThenKill`) — distinguish both from
                    // a normal non-zero exit.
                    if proc.terminationReason == .uncaughtSignal,
                       proc.terminationStatus == SIGTERM || proc.terminationStatus == SIGKILL {
                        if let timeout {
                            continuation.resume(throwing: ShellError.timedOut(command: displayCommand, seconds: timeout))
                        } else {
                            continuation.resume(throwing: CancellationError())
                        }
                    } else if proc.terminationStatus == 0 {
                        continuation.resume(returning: output)
                    } else {
                        continuation.resume(throwing: ShellError.nonZeroExit(
                            command: displayCommand,
                            exitCode: proc.terminationStatus,
                            output: output
                        ))
                    }
                }

                do {
                    try task.run()
                    // Cover the narrow race where cancellation arrived after the handler was
                    // installed but before the process was running.
                    if Task.isCancelled { terminateThenKill(task) }
                } catch {
                    handle.readabilityHandler = nil
                    continuation.resume(throwing: error)
                }
            }
        } onCancel: {
            terminateThenKill(task)
        }
    }

    /// Streams a process's output line-by-line as an ``AsyncThrowingStream``.
    /// The consumer cancelling its task (or otherwise stopping iteration) terminates the process.
    private static 
```

### Core Architecture Module: `Applite/Core/Brew/ShellError.swift`
```
//
//  ShellError.swift
//  Applite
//
//  Created by Milán Várady on 2024.12.25.
//

import Foundation

enum ShellError: LocalizedError {
    case askpassNotFound
    case outputDecodingFailed
    case coundtGetHomeDirectory
    case nonZeroExit(command: String, exitCode: Int32, output: String)
    case timedOut(command: String, seconds: Duration)

    /// Reaches the user as an alert body (`AlertManager.show(error:title:)`) and as the text on a
    /// failed app card, so every case is localized. The interpolated command/output stay verbatim —
    /// they're brew's own output, not our copy.
    var errorDescription: String? {
        switch self {
        case .askpassNotFound:
            return String(localized: "askpass script not found",
                          comment: "Shell error: the bundled askpass script is missing")
        case .outputDecodingFailed:
            return String(localized: "Failed to decode command output as UTF-8",
                          comment: "Shell error: a command's output wasn't valid text")
        case .coundtGetHomeDirectory:
            return String(localized: "Failed to get home directory",
                          comment: "Shell error: the user's home folder couldn't be resolved")
        case .nonZeroExit(let command, let exitCode, let output):
            return String(localized: "Failed to run shell command.\nCommand: \(command) (exit code: \(exitCode))\nOutput: \(output)",
                          comment: "Shell error: a command exited with an error (command, exit code, output)")
        case .timedOut(let command, let seconds):
            // Format the Duration first: interpolating one straight into a localized string yields
            // its debug description (and a deprecation warning). `.units` is itself localized.
            let deadline = seconds.formatted(.units(allowed: [.minutes, .seconds], width: .wide))
            return String(localized: "Shell command timed out after \(deadline).\nCommand: \(command)",
                          comment: "Shell error: a command ran past its deadline (duration, command)")
        }
    }
}

```

### Core Architecture Module: `Applite/Core/CaskCore/CaskDataLoader.swift`
```
//
//  CaskDataLoader.swift
//  Applite
//
//  Created by Milán Várady on 2026. 02. 11..
//

import Foundation
import OSLog

// MARK: - CaskDataLoader

/// Orchestrates loading cask data from the database, network, and brew CLI.
@MainActor
final class CaskDataLoader {
    private let dbService: CaskDatabaseService
    private let registry: CaskViewModelRegistry
    private let installedService: InstalledCaskService

    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: CaskDataLoader.self)
    )

    init(
        dbService: CaskDatabaseService = CaskDatabaseService(),
        registry: CaskViewModelRegistry = CaskViewModelRegistry(),
        installedService: InstalledCaskService = InstalledCaskService()
    ) {
        self.dbService = dbService
        self.registry = registry
        self.installedService = installedService
    }

    // MARK: - Main Loading Flow

    /// Loads catalog data (categories + taps) from the database.
    /// Does NOT shell out to the brew CLI — that's `refreshInstalled`/`refreshOutdated`.
    /// On a warm DB this completes in tens of milliseconds; on a cold DB it triggers an API sync first.
    /// Pass `forceSync: true` to bypass the freshness gate (used by the manual refresh action).
    func loadCatalogData(forceSync: Bool = false) async throws -> (categories: [CategoryLoadResult], taps: [TapLoadResult]) {
        logger.info("Starting catalog load (forceSync: \(forceSync))")

        // 1. Sync database from API. If a non-forced sync fails (offline / transient) but the DB
        // already holds a catalog, fall back to that stale data instead of throwing the whole load
        // into an all-session shimmer. A forced manual refresh still throws so the caller can tell
        // the user the refresh didn't go through (their previously-loaded catalog stays on screen).
        do {
            if forceSync {
                try await performSync()
            } else {
                try await syncIfNeeded()
            }
        } catch {
            guard !forceSync, try await dbService.hasCasks() else { throw error }
            logger.warning("Catalog sync failed (\(error.localizedDescription)); using existing database data")
        }

        // 2. Load category definitions from bundled JSON
        let categoryDefs = try loadCategories()

        // 3. Batch fetch records for all tokens referenced by categories
        let categoryTokens = categoryDefs.flatMap(\.casks)
        let categoryRecords = try await dbService.fetchCasks(forTokens: categoryTokens)
        let recordsByToken = Dictionary(categoryRecords.map { ($0.token, $0) }, uniquingKeysWith: { first, _ in first })
        let recordsByFullToken = Dictionary(categoryRecords.map { ($0.fullToken, $0) }, uniquingKeysWith: { first, _ in first })

        // 4. Build view models via registry (get-or-create for identity)
        _ = registry.viewModels(for: categoryRecords)

        // 5. Build category results
        let categoryResults: [CategoryLoadResult] = categoryDefs.compactMap { category in
            let records = category.casks
                .compactMap { token -> CaskRecord? in
                    recordsByToken[token] ?? recordsByFullToken[token]
                }
                // Keep curated categories clean of deprecated/disabled apps
                .filter { !$0.isDeprecatedOrDisabled }
            guard !records.isEmpty else { return nil }
            let vms = registry.viewModels(for: records)
            return CategoryLoadResult(id: category.id, sfSymbol: category.sfSymbol, casks: vms)
        }

        // 6. Build tap results from DB
        let tapResults = try await buildTapResults()

        logger.info("Catalog load completed: \(categoryResults.count) categories, \(tapResults.count) taps")

        return (categories: categoryResults, taps: tapResults)
    }

    // MARK: - Search

    /// Searches casks using FTS5 and returns view models (reuses existing instances)
    func search(query: String, limit: Int = 50) async throws -> [CaskViewModel] {
        let records = try await dbService.search(query: query, limit: limit)
        return registry.viewModels(for: records)
    }

    /// Resolves cask tokens to view models via the DB, creating any that aren't already live.
    /// Unlike `registry.existingViewModels`, this finds casks the user has never browsed — needed
    /// so an imported app list can install anything in the catalog. Unknown tokens are dropped.
    func viewModels(forTokens tokens: Set<CaskId>) async throws -> [CaskViewModel] {
        let records = try await dbService.fetchCasks(forTokens: Array(tokens))
        return registry.viewModels(for: records)
    }

    // MARK: - Refresh

    /// Re-queries brew CLI for installed casks, ensures view models exist for each,
    /// and marks them installed in the registry.
    func refreshInstalled() async throws {
        let tokens = try await installedService.getInstalledCasks()
        let records = try await dbService.fetchCasks(forTokens: Array(tokens))
        _ = registry.viewModels(for: records)
        registry.markInstalled(tokens: tokens)
    }

    /// Re-queries brew CLI for outdated casks, ensures view models exist for each,
    /// and marks them outdated in the registry.
    func refreshOutdated() async throws {
        let tokens = try await installedService.getOutdatedCasks()
        let records = try await dbService.fetchCasks(forTokens: Array(tokens))
        _ = registry.viewModels(for: records)
        registry.markOutdated(tokens: tokens)
    }

    // MARK: - Sync

    /// Checks database freshness and syncs from API if stale
    private func syncIfNeeded() async throws {
        guard try await dbService.shouldSync() else {
            logger.info("Database is fresh, skipping sync")
            return
        }
        try await performSync()
    }

    /// Always runs an API sync regardless of the freshness gate.
    private func performSync() async throws {
        logger.info("Syncing catalog from API")

        // Fetch DTOs, analytics, and tap casks concurrently.
        // The category refresh rides along on the same cadence; it's best-effort and never throws,
        // so a blocked/failed fetch can't abort the sync. It completes before `loadCategories()`
        // (step 2 of `loadCatalogData`), so a fresh list shows up within the same load.
        async let dtos = fetchCaskDTOs()
        async let analytics = fetchAnalytics()
        async let tapDTOs = fetchTapDTOs()
        async let categoriesRefresh: Void = CategoryProvider.refreshRemoteCategories()

        let (dtosResult, analyticsResult, tapDTOsResult) = try await (dtos, analytics, tapDTOs)
        await categoriesRefresh

        // A `nil` tap result means the fetch failed (vs. `[]` = legitimately no tap casks / disabled).
        // On failure, don't prune tap casks from the DB — otherwise one transient hiccup wipes every
        // installed custom-tap cask until the next successful fetch.
        let tapFetchFailed = tapDTOsResult == nil

        // Build analytics lookup
        var analyticsDict: [String: Int] = [:]
        for item in analyticsResult.items {
            if let count = Int(item.count.replacingOccurrences(of: ",", with: "")) {
                analyticsDict[item.cask] = count
            }
        }

        // Convert DTOs → CaskRecords with analytics
        let allDTOs = dtosResult + (tapDTOsResult ?? [])
        let records = allDTOs.map { dto in
            CaskRecord(fromDTO: dto, downloadsIn365days: analyticsDict[dto.token] ?? 0)
        }

        // Sync to database. FTS5 stays in lock-step via synchronize(withTable:) triggers.
        try await dbService.syncFromAPI(records: records, pruneTapCasks: !tapFetchFailed)

        logger.info("Sync completed: \(records.count) casks")
    }

    // MARK: - Network Fetching

    /// Fetches cask DTOs from the Homebrew API
    private func fetchCaskDTOs() async throws -> [CaskDTO] {
        let url = URL(string: "https://formulae.brew.sh/api/cask.json")!
        return try await fetchJSON(from: url, as: [CaskDTO].self)
    }

    /// Fetches analytics data from the Homebrew API
    private func fetchAnalytics() async throws -> BrewAnalytics {
        let url = URL(string: "https://formulae.brew.sh/api/analytics/cask-install/365d.json")!
        return try await fetchJSON(from: url, as: BrewAnalytics.self)
    }

    /// Fetches cask DTOs from third-party taps via brew ruby script.
    ///
    /// Returns `nil` to signal a *failure* (script missing, brew error, unparseable output) as
    /// distinct from `[]` (tap fetch intentionally disabled, or genuinely no tap casks). Callers
    /// must not prune existing tap casks from the DB on `nil` — see `syncFromAPI(pruneTapCasks:)`.
    private func fetchTapDTOs() async -> [CaskDTO]? {
        let enabled = UserDefaults.standard.value(for: Preferences.includeCasksFromTaps)
        guard enabled else {
            logger.info("Tap fetch skipped: includeCasksFromTaps is disabled")
            return []
        }

        guard let scriptPath = Bundle.main.path(forResource: "brew-tap-cask-info", ofType: "rb") else {
            logger.error("Failed to locate tap info ruby script")
            return nil
        }

        logger.info("Running tap fetch: brew ruby \(scriptPath)")

        var shellOutput = ""
        do {
            for try await line in Shell.streamBrewCommand(["ruby", scriptPath]) {
                shellOutput += line + "\n"
            }
        } catch {
            logger.error("Failed to load tap cask info: \(error)")
            return nil
        }

        logger.info("Tap script output length: \(shellOutput.count) chars")

        guard let match = shellOutput.firstMatch(of: /\[((.|\n|\r)*)\]/) else {
            logger.error("Tap script output did not contain a JSON array. First 500 chars: \(shellOutput.prefix(500))")
    
```

### Core Architecture Module: `Applite/Core/CaskCore/CaskLoadError.swift`
```
//
//  CaskLoadError.swift
//  Applite
//
//  Created by Milán Várady on 2024.12.31.
//

import Foundation

enum CaskLoadError: LocalizedError {
    case failedToLoadCategoryJSON
    case failedToLoadAdditionalInfo
    case failedToGetUpdateFrequency

    /// Reaches the user as an alert body (catalog-load failures are surfaced through
    /// `AlertManager`), so every case is localized.
    var errorDescription: String? {
        switch self {
        case .failedToLoadCategoryJSON:
            return String(localized: "Failed to load categories",
                          comment: "Error shown when the app category list couldn't be read")
        case .failedToLoadAdditionalInfo:
            return String(localized: "Failed to load additional info",
                          comment: "Error shown when an app's extra details couldn't be fetched")
        case .failedToGetUpdateFrequency:
            return String(localized: "Failed to get update frequency",
                          comment: "Error shown when the catalog update interval couldn't be read")
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #164** (2026-09-12): **Trim README badges and add a light/dark screenshot**
  *Symptoms*: ## Badges  Down from five to three, all linked, `flat-square` instead of the default bevel, and moved below the title so the project name is the first thing on the page rather than a badge row.  Dropped: - **Contributors** — already visible in the repo sidebar. - **Commits since latest release** — unlinked, and nobody reads "47 commits since v1.4.2". Its alt text (`GitHub commits since latest release (by SemVer including pre-releases)`) was what screen readers announced.  ## Screenshot  The single Discover capture becomes a `<picture>` element that serves a dark screenshot to readers on GitHub's dark theme. Both PNGs are committed under `docs/screenshots/` (~1 MB total) rather than hot-linked from an issue attachment, so they version with the repo instead of dangling off a `user-attachments` URL.  The `srcset` URLs are pinned to `raw.githubusercontent.com/.../main/...`, so **the images render broken in this PR preview** until it merges. Absolute raw URLs rather than relative paths on purpose: GitHub reliably rewrites and camo-proxies `src` on `<img>`, but its handling of relative paths in `<source srcset>` is less certain, and a silently-broken dark variant is the kind of thing that goes unnoticed for months.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01LtkqHQdHSbQDiRdydqmZvd

- **Issue #163** (2026-09-10): **Update the release docs and notes template for applite.app**
  *Symptoms*: Follow-up to the pipeline change, which moved the code but left the paperwork describing the old process.  `Scripts/Release/README.md` still told you to paste `AppliteReleaseModel.swift.txt` into aerolite's Swift, push it, then ssh to the VPS and run `docker compose`. That is the document you read *while cutting a release*, so it was worse than a stale link: instructions for a workflow that no longer exists, referencing a file the pipeline no longer produces.  `release.sh` also seeded `website-notes.md` with a template referring to "the aerolite snippet", so every future release would have started from a draft mentioning something gone.  The template now states that the file **ships verbatim**, which is the part worth knowing: 1.4.2's published page carried bold lead-ins that were not in its `website-notes.md`, meaning the generated output was edited afterwards. That is no longer possible, by design.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01WZEJ3XisHGixmdPA8myED2

- **Issue #162** (2026-09-10): **Point the in-app links at applite.app**
  *Symptoms*: The Help menu still sent people to `aerolite.dev`, now only a redirector, so every click took an extra hop to a domain being retired.  | Menu item | Was | Now | |---|---|---| | Website | `aerolite.dev/applite` | `applite.app` | | Troubleshooting | `aerolite.dev/applite/troubleshooting.html` | `applite.app/troubleshooting` | | Sponsor | PayPal donate link | `applite.app/#support` |  Also updates the troubleshooting link in `ComponentsInstallView`, which is what a user sees when the Homebrew bootstrap fails — the one that matters most, since it appears exactly when something has gone wrong.  **Sponsor points at the site, not at Ko-fi directly.** A menu item is compiled into the binary and cannot be changed once shipped, while that page can be edited any time. It also lets the reader choose between Ko-fi and GitHub Sponsors rather than choosing for them.  **Not changed:** the bundle identifier fallback in `UninstallSelf.swift` keeps `dev.aerolite.Applite`. Renaming the identifier would reset every user's settings, so it stays deliberately.  The two other hits were `static let dummy` SwiftUI preview fixtures. Updated so the retired domain does not linger in the source, but no user ever saw them.  Only future builds get these URLs; everything already installed keeps the old ones, which is what the `aerolite.dev` redirects are for. All five destinations verified live, including the `#support` anchor target.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://c

- **Issue #161** (2026-09-10): **Swap PayPal for Ko-fi in the Sponsor button**
  *Symptoms*: PayPal took roughly 10% of a €5 donation. Ko-fi settles through Stripe at about half that, and GitHub Sponsors takes nothing at all from personal sponsorships because GitHub covers the processing, so it stays first.  Also drops the nine commented placeholder lines the template ships with, which never described anything real about this project.  **The PayPal account should stay open.** Older builds of Applite open that link from the Help menu and cannot be changed retroactively, so it will keep receiving the occasional donation whatever this file says.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01WZEJ3XisHGixmdPA8myED2

- **Issue #159** (2026-09-05): **升级1.4后无法检测需要更新的应用（After upgrading to version 1.4, apps that need to be updated cannot be detected）**
  *Symptoms*: 先打开applite更新频道无法检测到需要更新的应用，先打开wailbrew检测到更新信息后applite刷新状态就可以看到了 If you open the Applite update channel and it doesn't detect any apps that need updating, open Wailbrew first to check for updates; once it detects them, refresh the Applite status and you'll see them.
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to fix this one. I traced the code and it looks like a 1.4 regression in how Applite refreshes Homebrew's metadata.  Root cause: `getOutdatedCasks()` (InstalledCaskService.swift) only runs `brew outdated --cask -q`, and `brew outdated` reports what's in Homebrew's *local* formula metadata. Nothing in the current tree refreshes that metadata: there is no `brew update` call anywhere, and the annex refresh (`refreshAnnexBrew` in AnnexBrewManager.swift) explicitly no-ops unless the annex is the selected brew (`guard BrewPaths.selectedBrewOption == .annex`). So for users on their own Homebrew (e.g. Wailbrew's), the outdated list is only as fresh as the last metadata update that happened outside Applite, which matches the report: open Wailbrew first (it runs `brew update`), then refresh Applite and the updates show up.  This wasn't always the case. The 1.4 annex commit (6626f52, "Replace first-run onboarding with a CLT-free annex Homebrew") removed `updateHomebrew()`, which ran 
  > Let me check this first. I'm not a at my computer right now, I'll get back to this in a few days. 
  > > Hi, I'd like to fix this one. I traced the code and it looks like a 1.4 regression in how Applite refreshes Homebrew's metadata. >  > Root cause: `getOutdatedCasks()` (InstalledCaskService.swift) only runs `brew outdated --cask -q`, and `brew outdated` reports what's in Homebrew's _local_ formula metadata. Nothing in the current tree refreshes that metadata: there is no `brew update` call anywhere, and the annex refresh (`refreshAnnexBrew` in AnnexBrewManager.swift) explicitly no-ops unless the annex is the selected brew (`guard BrewPaths.selectedBrewOption == .annex`). So for users on their own Homebrew (e.g. Wailbrew's), the outdated list is only as fresh as the last metadata update that happened outside Applite, which matches the report: open Wailbrew first (it runs `brew update`), then refresh Applite and the updates show up. >  > This wasn't always the case. The 1.4 annex commit ([6626f52](https://github.com/milanvarady/Applite/commit/6626f52d182e6b52d14a31443829cb39235e5595), "

- **Issue #158** (2026-08-16): **Take over the `brew services` function**
  *Symptoms*: Take over the `brew services` function
  **Post-Mortem & Fix Analysis**:
  > Thanks for the suggestion @axb-c!  `brew services` only works with formulae — it manages the launchd daemons that formulae install, and it has no cask support at all (Homebrew's implementation is formula-only). Applite is deliberately cask-only: it's meant to be an app store for regular Mac apps aimed at non-technical users, not a full Homebrew frontend. Adding service management would mean turning Applite into a formula manager as well, which is a much bigger change than it sounds, and background daemons are quite far from what most Applite users need.  So this isn't something I'm planning to add. But if you have a specific use case in mind, or if I've misunderstood what you meant, let me know and I'll take another look. 

- **Issue #156** (2026-08-04): **i18n: complete all six languages, add a glossary and the catalog tooling**
  *Symptoms*: Brings Hungarian, French, Japanese, Simplified Chinese, Traditional Chinese (HK) and Turkish to **100% of translatable strings** — 263 of 268 live keys; the other 5 are `shouldTranslate: false` (the empty fallback, the colon separator, and the product names Brew/Discord/GitHub). Every live key now carries a translator comment.  The 69 stale entries are **kept deliberately** as reference and are untouched throughout.  Translations were written by Claude rather than sent to the translators, then put through a full quality review (last commit) — see below.  ## Source changes that came out of it  - Every `LocalizedError.errorDescription` now uses `String(localized:comment:)` — **14 strings that were permanently English in all six languages** regardless of locale. - `AppAlert.message` stays `String` (it usually carries brew's own output) but now documents that it takes *resolved* text, so literals must be wrapped at the call site. - `"Are you sure you want to %@install Homebrew?"` split into two whole sentences. A spliced `"re"` fragment is untranslatable, and the Hungarian translation had dropped the placeholder entirely — so a **reinstall** prompt read as *install*. The confirm button branches to match. - `BrewPaths.brokenPathOrInstallMessage` deleted (unreferenced since the alert audit). - Plural variations added for 5 counted keys. Only French inflects after a numeral; Hungarian and Turkish take the bare singular after a number and Japanese/Chinese have no plural, so those get

- **Issue #155** (2026-08-04): **Testing: cover PR #154 in the harness, add an upgrade round**
  *Symptoms*: The manual E2E harness (`Testing/applite_test.py`) was current as of #153 but had never been updated for #154, whose 7-item device checklist was entirely unverified. Every item now has a phase.  Test-only — no app code changes.  ## New Round A phases  - **15 failed install** — red row on the card + Active Tasks entry + **no** dialog, since the alert audit moved brew-op failures off alerts. Forced deterministically by cancelling the sudo prompt on `FAIL_CASK=blackhole-2ch`: a small pkg cask that always needs admin, so the failure needs no network and no timing. - **16 taps + token collision** — that tap casks reach the catalog at all (the stream-truncation bug swallowed exactly these), and that a tap `rectangle` does not inherit core `rectangle`'s installed state (P2-29). - **17 sparkle** — toggles survive a Settings close/reopen (P3-19 snapshot drift), and "Check for Updates" disables during a check (P3-18). - **18 quit mid-install** — auto-verified via `brew_processes()` (P3-10).  ## New `upgrade` round (U0/U1)  `v1.3.1` → this build: the path every existing user takes, and the one nobody had tested.  It probes whether `$HOME`'s volume is case-sensitive, because the annex moved `Applite/homebrew` → `Applite/Homebrew` — the same directory on default APFS, a **different** one (old brew orphaned) on a case-sensitive volume. `PathOption` raw values did not shift between versions, so prefs carry over.  ## Tap fixture  Written by hand into `<prefix>/Library/Taps` — no git, no netw

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

### Incident Patch 1: `fc0b7b4e` (2026-09-05)
**Commit Message**: Appcast: 1.4.2 (build 21)

**File**: `appcast.xml` (modified, +12/-0)
```diff
@@ -2,6 +2,18 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Applite</title>
+        <item>
+            <title>1.4.2</title>
+            <pubDate>Sat, 05 Sep 2026 15:37:34 +0200</pubDate>
+            <sparkle:version>21</sparkle:version>
+            <sparkle:shortVersionString>1.4.2</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>
+                https://aerolite.dev/applite/releases/1.4.2.html
+            </sparkle:releaseNotesLink>
+            <sparkle:criticalUpdate></sparkle:criticalUpdate>
+            <enclosure url="https://github.com/milanvarady/Applite/releases/download/v1.4.2/Applite.dmg" length="7935548" type="application/octet-stream" sparkle:edSignature="L6j8qHgsxIKG7mndLBctd3N0URviftQxyTrfZaoVyJRemtZGzo++CidZXkyxVn/GzAEhZjwTZPRXjZtv9A4lDA=="/>
+        </item>
         <item>
             <title>1.4.0</title>
             <pubDate>Thu, 06 Aug 2026 14:14:38 +0200</pubDate>
```

---

### Incident Patch 2: `9daa060a` (2026-09-05)
**Commit Message**: Release 1.4.2 (build 21)

**File**: `Applite.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -314,7 +314,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 20;
+				CURRENT_PROJECT_VERSION = 21;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Applite/Preview Content\"";
 				DEVELOPMENT_TEAM = 9CLTNBW4Z3;
@@ -331,7 +331,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.4.1;
+				MARKETING_VERSION = 1.4.2;
 				PRODUCT_BUNDLE_IDENTIFIER = dev.aerolite.Applite;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -348,7 +348,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 20;
+				CURRENT_PROJECT_VERSION = 21;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Applite/Preview Content\"";
 				DEVELOPMENT_TEAM = 9CLTNBW4Z3;
@@ -365,7 +365,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.4.1;
+				MARKETING_VERSION = 1.4.2;
 				PRODUCT_BUNDLE_IDENTIFIER = dev.aerolite.Applite;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 3: `95948806` (2026-09-05)
**Commit Message**: Release 1.4.1 (build 20)

**File**: `Applite.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -314,7 +314,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 19;
+				CURRENT_PROJECT_VERSION = 20;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Applite/Preview Content\"";
 				DEVELOPMENT_TEAM = 9CLTNBW4Z3;
@@ -331,7 +331,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.4.0;
+				MARKETING_VERSION = 1.4.1;
 				PRODUCT_BUNDLE_IDENTIFIER = dev.aerolite.Applite;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -348,7 +348,7 @@
 				"CODE_SIGN_IDENTITY[sdk=macosx*]" = "Apple Development";
 				CODE_SIGN_STYLE = Automatic;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 19;
+				CURRENT_PROJECT_VERSION = 20;
 				DEAD_CODE_STRIPPING = YES;
 				DEVELOPMENT_ASSET_PATHS = "\"Applite/Preview Content\"";
 				DEVELOPMENT_TEAM = 9CLTNBW4Z3;
@@ -365,7 +365,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.4.0;
+				MARKETING_VERSION = 1.4.1;
 				PRODUCT_BUNDLE_IDENTIFIER = dev.aerolite.Applite;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 4: `cea6b732` (2026-09-05)
**Commit Message**: Fix updates never being detected on a stale metadata cache

HOMEBREW_NO_AUTO_UPDATE, which Shell sets on every brew command, disables two
things rather than one: the git-based self-update that the CLT-free annex can't
run (intended) and Homebrew's lightweight JSON API metadata refresh (not
intended). In `api.rb`, `fetch_api_files!` resolves `stale_seconds` to nil when
`no_auto_update? && !force_api_auto_update?`, and `skip_download?` returns true
whenever that is nil — so `packages.<tag>.jws.json` is never re-downloaded.
`brew outdated --cask` then compares installed versions against a permanently
frozen catalog and reports nothing outdated, forever.

That is issue #159, and it explains the reporter's workaround exactly: opening
another Homebrew GUI refreshes the shared cache that Applite was forbidden from
touching, after which Applite's own refresh finally sees the updates.

HOMEBREW_FORCE_API_AUTO_UPDATE re-enables only the API refresh and leaves the
git self-update disabled, which is what the annex needs — it has no real git.
Brew throttles the check to one per HOMEBREW_API_AUTO_UPDATE_SECS (450s) since
`outdated` is in AUTO_UPDATE_COMMANDS, so it is safe on every call and need

**File**: `Applite/Core/Brew/Shell.swift` (modified, +8/-0)
```diff
@@ -445,6 +445,14 @@ enum Shell {
             // would pop the macOS CLT install dialog. Applite keeps the annex fresh by
             // re-fetching the tarball instead (see AnnexBrewManager.refreshAnnexBrew).
             "HOMEBREW_NO_AUTO_UPDATE": "1",
+            // …but HOMEBREW_NO_AUTO_UPDATE disables two things, not one: the git self-update above
+            // *and* the lightweight JSON API metadata refresh. Without the API refresh brew never
+            // re-downloads the cask catalog, so `brew outdated --cask` compares installed versions
+            // against a permanently frozen cache and reports nothing outdated, forever (issue #159).
+            // This re-enables only the API refresh, leaving the git self-update disabled. Brew
+            // throttles it to one check per HOMEBREW_API_AUTO_UPDATE_SECS (450s), so it is safe to
+            // set on every command.
+            "HOMEBREW_FORCE_API_AUTO_UPDATE": "1",
             // Pin brew to the system curl (always present on macOS, works without CLT) so it
             // never probes for a Homebrew-installed curl. Cask downloads and the portable-ruby
             // fetch both go through this. Combined with API mode (HOMEBREW_NO_INSTALL_FROM_API
```

---

### Incident Patch 5: `cdbcbe59` (2026-08-06)
**Commit Message**: Appcast: 1.4.0 (build 19)

**File**: `appcast.xml` (modified, +11/-0)
```diff
@@ -2,6 +2,17 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Applite</title>
+        <item>
+            <title>1.4.0</title>
+            <pubDate>Thu, 06 Aug 2026 14:14:38 +0200</pubDate>
+            <sparkle:version>19</sparkle:version>
+            <sparkle:shortVersionString>1.4.0</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>
+                https://aerolite.dev/applite/releases/1.4.0.html
+            </sparkle:releaseNotesLink>
+            <enclosure url="https://github.com/milanvarady/Applite/releases/download/v1.4.0/Applite.dmg" length="7907006" type="application/octet-stream" sparkle:edSignature="8mmyEwSY16zk4DW4tLGXjnP9cgnyPEfQeqOiIow8LuTvRhwHczWuOKMsdZAzvQpEQsLRR6CTfdsM79a6DS8IBQ=="/>
+        </item>
         <item>
             <title>1.3.1</title>
             <pubDate>Sat, 10 May 2025 18:12:13 +0200</pubDate>
```

---

### Incident Patch 6: `da92c02e` (2026-08-06)
**Commit Message**: Release 1.4.0 (build 19)

**File**: `Applite.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -331,7 +331,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.3.1;
+				MARKETING_VERSION = 1.4.0;
 				PRODUCT_BUNDLE_IDENTIFIER = dev.aerolite.Applite;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
@@ -365,7 +365,7 @@
 					"@executable_path/../Frameworks",
 				);
 				MACOSX_DEPLOYMENT_TARGET = 14.0;
-				MARKETING_VERSION = 1.3.1;
+				MARKETING_VERSION = 1.4.0;
 				PRODUCT_BUNDLE_IDENTIFIER = dev.aerolite.Applite;
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				SWIFT_EMIT_LOC_STRINGS = YES;
```

---

### Incident Patch 7: `363db95a` (2026-08-05)
**Commit Message**: Docs: rewrite README and contributing guide, rebuild license notices

README was still describing the app as a "GUI for Homebrew Casks" with a macOS 13
minimum and a package list four dependencies out of date. It now leads with what
actually differentiates the app — it ships its own Homebrew, so it runs on a Mac
that has never had the Command Line Tools installed — and carries a comparison
table against CaskHub, BrewUI and Cork, dated August 2026 so it can be spotted as
stale later. Also a "Development and AI" section stating plainly that Claude Code
is part of the workflow from 1.4 on, what it is and isn't used for, and pointing
anyone who objects on principle at Cork.

CONTRIBUTING gained the two things people ask for in issues: how to get the
Homebrew output of a failed cask operation (the terminal button on the errored
card), and how to filter Console.app to the dev.aerolite.Applite subsystem. Two
screenshot TODOs are left as comments. Also sections on building, project layout,
AI-assisted contributions, and translations.

LICENSE-3RD-PARTY had drifted in both directions — it listed Ifrit,
DebouncedOnChange and CircularProgressSwiftUI, none of which are dependencies any
more (t

**File**: `LICENSE-3RD-PARTY.txt` (modified, +111/-18)
```diff
@@ -1,24 +1,90 @@
---------------------------------------------------------------------------------------------------------------------
-                        The MIT License (MIT)
-        Applies to: 
-        - Ifrit, Kusia (https://github.com/ukushu/ifrit)
-        - Kingfisher, Wei Wang (https://github.com/onevcat/Kingfisher)
-        - DebouncedOnChange, Łukasz Rutkowski (https://github.com/Tunous/DebouncedOnChange)
-        - ButtonKit, Thomas Durand (https://github.com/Dean151/ButtonKit)
-        - SwiftUI-Shimmer, Vikram Kriplaney (https://github.com/markiv/SwiftUI-Shimmer)
-        - CircularProgressSwiftUI, Arnav Motwani (https://github.com/ArnavMotwani/CircularProgressSwiftUI)
---------------------------------------------------------------------------------------------------------------------
-
-Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
+================================================================================
+                    THIRD-PARTY SOFTWARE NOTICES
+                              Applite
+================================================================================
+
+Applite incorporates the third-party software listed below. Each package is
+reproduced with its own copyright notice and license text, as required by the
+respective licenses. Versions correspond to the pinned dependencies in
+Applite.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved.
+
+    1. ButtonKit 0.7.1 ......................................... MIT
+    2. GRDB.swift 7.10.0 ....................................... MIT
+    3. Kingfisher 8.9.0 ........................................ MIT
+    4. Sparkle 2.9.0 ........................................... MIT
+    5. SwiftUI-Shimmer 1.5.1 ................................... MIT
+
+================================================================================
+1. ButtonKit 0.7.1
+   Thomas Durand — https://github.com/Dean151/ButtonKit
+================================================================================
+
+MIT License
+
+Copyright (c) 2026 Thomas Durand
+
+Permission is hereby granted, free of charge, to any person obtaining a copy
+of this software and associated documentation files (the "Software"), to deal
+in the Software without restriction, including without limitation the rights
+to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+copies of the Software, and to permit persons to whom the Software is
+furnished to do so, subject to the following conditions:
+
+The above copyright notice and this permission notice shall be included in all
+copies or substantial portions of the Software.
+
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
+SOFTWARE.
+
+================================================================================
+2. GRDB.swift 7.10.0
+   Gwendal Roué — https://github.com/groue/GRDB.swift
+================================================================================
+
+Copyright (C) 2015-2025 Gwendal Roué
+
+Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
-THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AN
```

**File**: `README.md` (modified, +97/-39)
```diff
@@ -7,37 +7,63 @@
 
 # Applite
 
-User-friendly GUI macOS application for Homebrew Casks
+A native macOS app store for software that isn't on the App Store, backed by [Homebrew Cask](https://github.com/Homebrew/homebrew-cask).
 
 ## Table of Contents
 
-1. [Key Features](#key-features)
-2. [About](#about)
-3. [Screenshots](#screenshots)
-4. [Download](#download)
-5. [Contact](#contact)
-6. [Roadmap](#roadmap)
-7. [Contributing](#contributing)
-8. [Packages Used](#packages-used)
-9. [License](#license)
-10. [Alternatives](#alternatives)
+1. [What Sets Applite Apart](#what-sets-applite-apart)
+2. [Comparison](#comparison)
+3. [Key Features](#key-features)
+4. [Screenshots](#screenshots)
+5. [Download](#download)
+6. [Built With](#built-with)
+7. [Development and AI](#development-and-ai)
+8. [Contact](#contact)
+9. [Roadmap](#roadmap)
+10. [Contributing](#contributing)
+11. [Packages Used](#packages-used)
+12. [Credits](#credits)
+13. [License](#license)
+14. [Alternatives](#alternatives)
+
+## What Sets Applite Apart
+
+**Applite brings its own Homebrew.** Every other Homebrew GUI expects `brew` to already be on the machine, which means the user has opened a Terminal and installed the Xcode Command Line Tools first. Applite downloads a Homebrew tarball into its own Application Support directory on first launch and runs it from there, in API mode behind a git shim.
+
+- **No Terminal, no Command Line Tools.** Applite can be the first app on a fresh Mac.
+- **Brewfile import and export**, so restoring your apps on a new machine is a file and a checklist.
+- **Casks only, by design.** No formulae, no services, no CLI surface. Apps in categories, with icons and a search field.
+- **Uses your existing Homebrew** if you have one. Point it at any prefix in Settings.
+
+## Comparison
+
+Three actively developed alternatives worth knowing about. All of them are good software solving a slightly different problem.
+
+|                          | **Applite**                            | [CaskHub](https://github.com/alielsokary/CaskHub) | [BrewUI](https://github.com/Homebrew/brewui) | [Cork](https://github.com/buresdv/Cork) |
+| ------------------------ | -------------------------------------- | ------------------------------------------------- | -------------------------------------------- | --------------------------------------- |
+| Installs Homebrew itself | Yes, no CLT or Terminal needed         | No, guided manual setup                            | No                                            | No                                       |
+| Scope                    | Casks only                             | Casks only                                         | Formulae and casks                            | Formulae, casks, services, taps          |
+| Audience                 | Non-technical                          | Non-technical                                      | All Homebrew users                            | Power users                              |
+| Price                    | Free                                   | Free                                               | Free                                          | 25 € prebuilt, free if self-compiled     |
+| License                  | MIT                                    | MIT                                                | AGPL-3.0                                      | Commons Clause (source available)        |
+| Minimum macOS            | 14                                     | 15.6                                               | 14                                            | 13                                       |
+| Brewfile import/export   | Yes, with a per-app selection sheet    | No                                                 | Not yet                                       | Yes                                      |
+| Telemetry                | None                                   | Sentry + TelemetryDeck                             | None                                          | None                                     |
+| Status                   | Released                               | Released                                           | Early development                             | Released                                 |
+
+Comparison drawn in August 2026; check the projects themselves for current state.
 
 ## Key Features
 
-- Install, update, and uninstall apps with a single click
-- Clean and simple UI designed for non-technical users
-- Free and open source
-- Works with existing brew installation
-- Supports system proxy (HTTP, HTTPS, and SOCKS5)
-- Handpicked gallery of awesome apps
-
-## About
-
-Applite is a free and open-source macOS application that streamlines the installation and management of third-party apps using [Homebrew](https://brew.sh/). The app is built using [Swift](https://developer.apple.com/swift/) and [SwiftUI](https://developer.apple.com/xcode/swiftui/).
-
-Applite aims to be more of a
```

**File**: `docs/CONTRIBUTING.md` (modified, +115/-37)
```diff
@@ -1,63 +1,141 @@
-# Applite Contribution Guide
+# Contributing to Applite
+
+Contributions are welcome, and not only code. Bug reports, translations, and well-argued feature
+suggestions are all useful.
 
 ## Table of Contents
 
 1. [Project goal](#project-goal)
-2. [If you found a bug](#if-you-found-a-bug)
-   - [Finding logs in `Console.app`](#finding-logs-in-consoleapp)
-3. [If you want to suggest a feature](#if-you-want-to-suggest-a-feature)
-4. [If you want to contribute code](#if-you-want-to-contribute-code)
-
+2. [Reporting a bug](#reporting-a-bug)
+   - [Getting the terminal output](#getting-the-terminal-output)
+   - [Getting logs from Console.app](#getting-logs-from-consoleapp)
+3. [Suggesting a feature](#suggesting-a-feature)
+4. [Contributing code](#contributing-code)
+   - [Building](#building)
+   - [Project layout](#project-layout)
+   - [AI-assisted contributions](#ai-assisted-contributions)
+5. [Contributing a translation](#contributing-a-translation)
 
 ## Project Goal
 
-> Applite aims to be more of an app store for third-party apps than a full-blown homebrew GUI wrapper.
+> Applite aims to be more of an app store for third-party apps than a full-blown Homebrew GUI
+> wrapper.
+
+The goal is to bring Homebrew casks to people who would never open a Terminal. Simple setup, a UI
+that can be understood at a glance, no technical knowledge required.
+
+Applite does have features aimed at experienced users, such as a custom brew path and a custom
+installation directory. Those stay out of the main interface by design. This is the standard the
+project measures suggestions against, and it is the usual reason something gets turned down.
+
+## Reporting a Bug
+
+Open an issue and include:
+
+- What went wrong
+- The steps you took before it happened
+- Any error message or terminal output (see below)
+- App version and hardware, for example "Applite 1.4, MacBook Air M2"
+
+### Getting the terminal output
+
+If the problem happened during an install, update, or uninstall, the app card itself will show a red
+**Error** label with two buttons next to it. The terminal icon opens the full Homebrew output in a
+new window. That output is the single most useful thing you can paste into an issue, so please
+include it rather than only describing the failure.
+
+<!-- TODO: screenshot of the failed-state app card, showing the Error label and terminal button -->
+
+### Getting logs from Console.app
+
+For anything that isn't a failed cask operation, the unified log is the next best source.
+
+1. Open **Console.app** and select your device in the sidebar
+2. Click **Start** to begin streaming
+3. Reproduce the bug, then pause
+4. Filter for the `dev.aerolite.Applite` subsystem, or search for "applite"
+5. Copy the entries around the failure
+
+If values show up as `<private>`, follow [this Stack Exchange
+answer](https://superuser.com/questions/1532031/how-to-show-private-data-in-macos-unified-log/1532052#1532052)
+to reveal them.
+
+<!-- TODO: screenshot of Console.app filtered to the Applite subsystem -->
+
+## Suggesting a Feature
+
+- Open an issue, or a discussion if the idea is open-ended
+- Describe what you're missing and why
+- Suggesting a solution is optional
+
+Check it against the [project goal](#project-goal) first. Features that would only make sense to
+someone who already knows Homebrew are usually declined, however well built.
+
+## Contributing Code
 
-The goal of Applite is to bring the convenience of Homebrew casks to the average user. It aims to be as simple as possible in every aspect. Easy setup, simple UI that can be understood at a glance, and no technical knowledge required.
+Small fixes need no ceremony. If you spot a typo or a minor bug, open a pull request.
 
-Applite has features aimed at more experienced users (e.g. custom brew path and installation directory), but these are not part of the main interface by design.
+For anything larger, open an issue or bring it up on the [Discord
+server](https://discord.gg/MpDMH9cPbK) before you write the code. It is a bad experience for
+everyone when a well-made PR gets turned down on scope, and a five-minute conversation up front
+avoids it.
 
-## If you found a bug
+### Building
 
-> - Open a new issue 
-> - Describe what the problem is
-> - Describe the steps you took before it occurred
-> - Include error messages, logs
-> - Provide app version and device information (e.g. Applite: v1.2, MacBook Air M2)
+Open `Applite.xcodeproj` in Xcode 16 or newer and build. Swift Package Manager resolves the
+dependencies on first build; there is nothing else to install. The deployment target is macOS 14.
 
-If the problem is related to application actions, e.g. installing, updating, or uninstalling. Be sure to check if you can find the error message. When an app encounters an error it should look like this:
+### Project layout
 
-![Info button highlighted](https://i.imgur.com/Kik6s8q.jpg)
+The project uses Xcode 16 **file-system synchronized group
```

---

### Incident Patch 8: `d25897c3` (2026-08-04)
**Commit Message**: Remove fixed sidebar width

Instead of a fixed sidbar width set a min and ideal size

**File**: `Applite/Navigation/ContentView.swift` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ struct ContentView: View {
         NavigationSplitView {
             SidebarView(selection: $selection)
                 .disabled(modifyingBrew)
-                .navigationSplitViewColumnWidth(216)
+                .navigationSplitViewColumnWidth(min: 200, ideal: 216)
         } detail: {
             if !searchInput.isEmpty {
                 SearchView(query: $searchInput)
```

---

### Incident Patch 9: `fa14d745` (2026-08-04)
**Commit Message**: Add TRANSLATING.md glossary; recover 15 fixes a duplicate-key bug dropped

GLOSSARY. TRANSLATING.md records the register rules and the agreed rendering of
the ~50 terms that recur across the UI, so the same button can't end up called
three things. The Apple column was read out of the .loctable files macOS itself
ships — matching English keys and reading the same key back per language — not
written from memory, and the method is documented so it can be re-run.

Frequency is evidence, not a verdict: the same English word is often several UI
concepts. "Note" resolves to Jegyzet/メモ/筆記 because that's the Notes *app*;
Applite means "remark", so it keeps Megjegyzés/備考/備註. "Utilities" resolves
most often to Launchpad's "Other" grouping rather than the folder. Every
deviation from Apple's top hit is listed with its reason.

BUG FOUND BY THE AUDIT. Cross-referencing the catalog against the glossary
showed terms I had already reported as fixed still holding their old values.
batch5 of the previous commit was grouped by language, so 11 keys appeared in
two sections each — and a Python dict literal keeps only the last occurrence,
silently. The applied count still looked right because the duplic

**File**: `Localizable.xcstrings` (modified, +15/-15)
```diff
@@ -677,7 +677,7 @@
         "fr" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "%@ déinstaller avec succès!"
+            "value" : "%@ désinstallé avec succès !"
           }
         },
         "hu" : {
@@ -707,7 +707,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "%@ 已成功卸載"
+            "value" : "%@ 已成功解除安裝"
           }
         }
       }
@@ -2117,7 +2117,7 @@
         "hu" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "App Költöztetés"
+            "value" : "Appok költöztetése"
           }
         },
         "ja" : {
@@ -3042,13 +3042,13 @@
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "您确定要永久卸载 Applite 吗？"
+            "value" : "确定要永久卸载 Applite 吗？"
           }
         },
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "您確定要永久卸載Applite嗎？"
+            "value" : "確定要永久解除安裝 Applite 嗎？"
           }
         }
       }
@@ -5999,7 +5999,7 @@
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "更新の更新に失敗しました"
+            "value" : "アップデートの再取得に失敗しました"
           }
         },
         "tr" : {
@@ -6157,7 +6157,7 @@
         "hu" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "%@ letöltése sikertelen"
+            "value" : "%@ frissítése sikertelen"
           }
         },
         "ja" : {
@@ -7849,7 +7849,7 @@
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "インストール"
+            "value" : "インストール中"
           }
         },
         "tr" : {
@@ -12183,7 +12183,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "卸載"
+            "value" : "解除安裝"
           }
         }
       }
@@ -12265,7 +12265,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "卸載Applite"
+            "value" : "解除安裝 Applite"
           }
         }
       }
@@ -12348,7 +12348,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "卸載Applite…"
+            "value" : "解除安裝 Applite…"
           }
         }
       }
@@ -12413,7 +12413,7 @@
         "ja" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "アンインストール"
+            "value" : "アンインストール中"
           }
         },
         "tr" : {
@@ -12431,7 +12431,7 @@
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "正在卸載"
+            "value" : "正在解除安裝"
           }
         }
       }
@@ -12970,13 +12970,13 @@
         "zh-Hans" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "公用设施"
+            "value" : "实用工具"
           }
         },
         "zh-HK" : {
           "stringUnit" : {
             "state" : "translated",
-            "value" : "公用事業"
+            "value" : "公用程式"
           }
         }
       }
```

**File**: `TRANSLATING.md` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+# Translating Applite
+
+Applite ships in English plus Hungarian, French, Japanese, Simplified Chinese, Traditional Chinese
+(Hong Kong) and Turkish. Everything lives in `Localizable.xcstrings`; English is the source language
+and the key.
+
+This file is the **glossary**: the agreed rendering of the words that recur across the UI. Look a
+term up here before translating a string that contains it — a small app feels wrong much faster from
+calling the same button three different things than from any single awkward sentence.
+
+## Register
+
+Not a matter of taste — this is what the existing translations already established, and new strings
+must match:
+
+| | Register | Buttons |
+|---|---|---|
+| **hu** | formal (magázás) — *"Biztos véglegesen törli?"* | nominal: *Telepítés*, not *Telepítsd* |
+| **fr** | vouvoiement | infinitive: *Installer*. Narrow no-break space before `!` `?` `:` |
+| **ja** | です／ます | noun form; progress labels take *…中* |
+| **zh-Hans / zh-HK** | 你, not 您 (Apple's current style) | space between CJK and Latin/digits |
+| **tr** | formal *-iniz* | sentence case |
+
+## Glossary
+
+Values marked **Apple** were read out of the localization tables macOS itself ships — see
+[Method](#method). Where Applite deviates, the reason is given below the table; a deviation needs a
+reason, and "I'd have said it differently" isn't one.
+
+### Actions
+
+| Term | hu | fr | ja | zh-Hans | zh-HK | tr |
+|---|---|---|---|---|---|---|
+| Install | Telepítés | Installer | インストール | 安装 | 安裝 | Yükle |
+| Reinstall ¹ | Újratelepítés | Réinstaller | 再インストール | 重新安装 | 重新安裝 | Yeniden Yükle |
+| Uninstall | Eltávolítás | Désinstaller | アンインストール | 卸载 | 解除安裝 | Yüklemeyi Kaldır |
+| Update | Frissítés | Mettre à jour | アップデート | 更新 | 更新 | Güncelle |
+| Refresh | Frissítés | Actualiser | 更新 | 刷新 | 重新整理 | Yenile |
+| Download | Letöltés | Télécharger | ダウンロード | 下载 | 下載 | İndir |
+| Import | Importálás | Importer | 読み込む | 导入 | 輸入 | İçe Aktar |
+| Export | Exportálás | Exporter | 書き出す | 导出 | 輸出 | Dışa Aktar |
+| Open | Megnyitás | Ouvrir | 開く | 打开 | 開啟 | Aç |
+| Copy | Másolás | Copier | コピー | 拷贝 | 複製 | Kopyala |
+| Delete | Törlés | Supprimer | 削除 | 删除 | 刪除 | Sil |
+| Remove | Eltávolítás | Supprimer | 削除 | 移除 | 移除 | Kaldır |
+| Stop | Leállítás | Arrêter | 停止 | 停止 | 停止 | Durdur |
+| Cancel | Mégsem | Annuler | キャンセル | 取消 | 取消 | Vazgeç |
+| Retry | Újra ² | Réessayer | 再試行 | 重试 | 再試 | Yeniden Dene |
+| Try Again | Újrapróbálkozás | Réessayer | やり直す | 重试 | 再試 | Yeniden Dene |
+| Continue | Folytatás | Continuer | 続ける | 继续 | 繼續 | Sürdür |
+| Select All | Összes kijelölése | Tout sélectionner | すべてを選択 | 全选 | 全選 | Tümünü Seç |
+| Deselect All | Kijelölés megszüntetése ³ | Tout désélectionner | すべてを選択解除 | 取消全选 | 取消全選 | Seçimi Kaldır |
+| Dismiss / Close | Bezárás | Fermer | 閉じる | 关闭 | 關閉 | Kapat |
+| Search | Keresés | Rechercher | 検索 | 搜索 | 搜尋 | Ara |
+| Done | Kész | Terminé | 完了 | 完成 | 完成 | Bitti |
+
+### States
+
+| Term | hu | fr | ja | zh-Hans | zh-HK | tr |
+|---|---|---|---|---|---|---|
+| Installed | Telepítve | Installée | インストール済み | 已安装 | 已安裝 | Yüklü |
+| Not installed | Nincs telepítve | Non installée | 未インストール | 未安装 | 未安裝 | Yüklü değil |
+| Enabled | Bekapcsolva | Activée | 有効 | 已启用 | 已啟用 | Etkin |
+| Disabled | Letiltva | Désactivée | 無効 | 已停用 | 已停用 | Etkin değil |
+| Outdated | Elavult | Obsolète | アップデートあり | 有可用更新 | 有可用更新 | Güncel değil |
+| Deprecated | Elavult | Obsolète | 非推奨 | 已弃用 | 已棄用 | Artık önerilmiyor |
+| Failed | Sikertelen | Échec | 失敗 | 失败 | 失敗 | Başarısız |
+
+Adjectives in French agree with **l'application** (feminine): *Installée*, *Activée*, *Désactivée*.
+
+### Sections and nouns
+
+| Term | hu | fr | ja | zh-Hans | zh-HK | tr |
+|---|---|---|---|---|---|---|
+| Settings | Beállítások | Réglages | 設定 | 设置 | 設定 | Ayarlar |
+| General | Általános | Général | 一般 | 通用 | 一般 | Genel |
+| Advanced | Haladó | Avancé | 詳細 | 高级 | 進階 | İleri Düzey |
+| Options | Beállítások | Options | オプション | 选项 | 選項 | Seçenekler |
+| Categories | Kategóriák | Catégories | カテゴリ | 分类 ⁴ | 分類 ⁴ | Kategoriler |
+| Utilities | Segédprogramok ⁵ | Utilitaires | ユーティリティ | 实用工具 ⁵ | 工具程式 ⁵ | İzlenceler |
+| Applications / Apps | Alkalmazások | Applications | アプリ | 应用 | 應用程式 | Uygulamalar |
+| Version | Verzió | Version | バージョン | 版本 | 版本 | Sürüm |
+| Date | Dátum | Date | 日付 | 日期 | 日期 | Tarih |
+| File | Fájl | Fichier | ファイル | 文件 | 檔案 | Dosya |
+| Path | Útvonal | Chemin | パス | 路径 | 路徑 | Yol |
+| Cache | Gyorsítótár | Cache | キャッシュ | 缓存 | 快取 | Önbellek |
+| System | Rendszer | Système | システム | 系统 | 系統 | Sistem |
+| Terminal | Terminál | Terminal | ターミナル | 终端 | 終端機 | Terminal |
+| Output | Kimenet | Sortie | 出力 | 输出 | 輸出 | Çıkış |
+| Error | Hiba | Erreur | エラー | 错误 | 錯誤 | Hata |
+| Warning | Figyelmeztetés | Avertissement | 警告 | 警告 | 警告 | Uyarı |
+| Note ⁶ | Megjegyzés | Remarque | 備考 | 备注 | 備註 | Not |
+| Waiting… | Várakozás… | En attente… | 待機中… | 等待中… | 等待中… | Bekleniyor… |
+
+### Homebrew jargon — not Apple
```

---

### Incident Patch 10: `1bf4ef63` (2026-08-04)
**Commit Message**: i18n: complete all six languages, fix errors in the existing ones

Takes hu, fr, ja, zh-Hans, zh-HK and tr from 56% to 100% of translatable
strings (262 of 267 live keys; the other 5 are shouldTranslate:false — the
empty fallback, the colon separator, and the product names Brew/Discord/GitHub).
The 68 stale entries are untouched, as reference.

Method: translated per string across all six languages rather than per language,
because the expensive part is establishing what a string is — which control, how
much room, what the surrounding copy says. Grouped by UI surface so that context
is paid for once per screen.

REGISTER, taken from the existing 144 translations rather than chosen fresh:
hu magázás; fr vouvoiement; ja です/ます with "…中" on progress labels; zh Apple's
你; tr formal -iniz. Buttons follow each language's macOS convention — nominal in
Hungarian ("Telepítés"), infinitive in French ("Installer").

"Install" — the app's most important verb — had no translation in any language.
It now agrees with the established "Installed" in each (hu Telepítés/Telepítve).

PLURALS: of the six, only French inflects after a numeral. Hungarian and Turkish
take the bare singular ("3 alkalmazás",



---

### Incident Patch 11: `716d3a61` (2026-08-04)
**Commit Message**: Review fixes: exact installed-matching, crash window, silent refresh

Three findings from the review of this branch.

1. Re-keying identity to fullToken turned P2-29's data loss into a false
   "installed" state. CaskViewModel.matches(anyOf:) accepted EITHER token,
   which was harmless while a token collision collapsed both casks into
   one view model — but both now exist. `brew list --cask --full-name`
   prints bare names for core casks, so {"firefox"} matched core firefox
   AND mytap/firefox: the tap cask appeared in Installed and Updates, and
   Uninstall would run against a cask that isn't installed.

   Verified against the real catalog: all 7,679 homebrew/cask rows have
   fullToken == token, and tap rows are qualified — so brew's full_name
   output aligns exactly with the fullToken column. Installed state now
   matches on fullToken only.

   `brew outdated --cask -q` is different: it prints BARE tokens even for
   tap casks (checked against an installed tap cask). That's ambiguous
   across taps and can't be made exact, so outdated matching stays loose
   but is gated on isInstalled — only one of two same-token casks can be
   the installed one, and installed state is 

**File**: `Applite/Core/Brew/BrewService.swift` (modified, +6/-2)
```diff
@@ -652,8 +652,12 @@ final class BrewService {
             case .failed:
                 ok = false
             default:
-                // No marker seen — decide from the single brew query.
-                let listed = vm.matches(anyOf: brewTokens)
+                // No marker seen — decide from the single brew query. `list --full-name` is an
+                // exact identity match; `outdated -q` prints bare tokens, so it stays loose but can
+                // only mean *this* cask when it's the installed one.
+                let listed = kind == .install
+                    ? vm.matchesFullName(in: brewTokens)
+                    : (vm.isInstalled && vm.matchesBareToken(in: brewTokens))
                 switch kind {
                 case .install:
                     ok = listed
```

**File**: `Applite/Core/Brew/Shell.swift` (modified, +8/-1)
```diff
@@ -270,9 +270,16 @@ enum Shell {
                                     // final empty read, so waiting for the handler to report EOF would
                                     // hang the read loop forever — a worse failure than the truncation
                                     // this whole watchdog exists to avoid.
+                                    //
+                                    // And deliberately do NOT close the descriptor here. An already
+                                    // dispatched `readabilityHandler` can be inside `availableData`
+                                    // at this exact moment, and that raises an ObjC
+                                    // `NSFileHandleOperationException` on a closed descriptor —
+                                    // uncatchable from Swift, i.e. a crash. Clearing the handler and
+                                    // finishing the stream is enough to release the read loop; the
+                                    // descriptor closes with the `Pipe` when it deallocs.
                                     fileHandle.readabilityHandler = nil
                                     reachedEOF.withLock { $0 = true }
-                                    try? fileHandle.close()
                                     chunkFeed.finish()
                                     return
                                 }
```

**File**: `Applite/Core/CaskCore/CaskManager.swift` (modified, +8/-3)
```diff
@@ -220,7 +220,11 @@ final class CaskManager {
     /// load-failure alert's retry. Reloads the catalog, then — if the selected brew is valid — the
     /// installed/outdated state; otherwise re-runs `bootstrap` to try to recover, leaving the
     /// resulting `bootstrap.phase` to surface a brew that's genuinely unusable.
-    func loadData(forceSync: Bool = false) async {
+    /// Returns whether the load actually completed — callers that show "this needs refreshing"
+    /// affordances must not clear them on a load that silently did nothing (the broken-brew branch
+    /// below deliberately drops its error, so the return value is the only signal).
+    @discardableResult
+    func loadData(forceSync: Bool = false) async -> Bool {
         Self.logger.info("Starting data load process (forceSync: \(forceSync))")
 
         if forceSync { isRefreshingCatalog = true }
@@ -236,7 +240,7 @@ final class CaskManager {
                 alert.show(error: catalogError, title: "Couldn't load app catalog", actions: loadFailureActions)
             }
             await loadInstalledState()
-            return
+            return true
         }
 
         // Selected brew is invalid — attempt recovery (detect existing / reinstall annex).
@@ -255,14 +259,15 @@ final class CaskManager {
                 brew --version output: \(versionOutput)
                 """
             )
-            return
+            return false
         }
 
         // Recovered — the catalog alert is now the only possible surface, so raise it.
         if let catalogError {
             alert.show(error: catalogError, title: "Couldn't load app catalog", actions: loadFailureActions)
         }
         await loadInstalledState()
+        return catalogError == nil
     }
 
     /// Stage 1: catalog (categories + taps) from the local DB — fast, no brew CLI dependency.
```

**File**: `Applite/Core/CaskCore/CaskViewModel.swift` (modified, +20/-2)
```diff
@@ -65,8 +65,26 @@ final class CaskViewModel {
 
     /// True if this cask's short *or* full token is in `tokens`. Brew reports either form
     /// depending on the command, so membership checks must accept both.
-    func matches(anyOf tokens: Set<CaskId>) -> Bool {
-        tokens.contains(token) || tokens.contains(fullToken)
+    /// Exact identity match against names brew printed as `full_name` — `brew list --cask
+    /// --full-name`, and the same query in `reconcileBatch`.
+    ///
+    /// `full_name` is the bare token for core casks and tap-qualified otherwise, which is exactly
+    /// what `fullToken` holds (every `homebrew/cask` row has `fullToken == token`). Matching these
+    /// against the *bare* token instead would let a tap's `firefox` inherit core firefox's installed
+    /// state — harmless while the two collapsed into one view model, wrong now that `fullToken` is
+    /// the identity and both exist.
+    func matchesFullName(in names: Set<CaskId>) -> Bool {
+        names.contains(fullToken)
+    }
+
+    /// Loose match for brew output that prints **bare** tokens even for tap casks — `brew outdated
+    /// --cask -q` does, unlike `list --full-name`.
+    ///
+    /// A bare token can't distinguish two taps' `firefox`, so this is inherently ambiguous and must
+    /// only be applied to casks already known to be installed (see `markOutdated`), which narrows it
+    /// to the one cask that can actually be outdated.
+    func matchesBareToken(in names: Set<CaskId>) -> Bool {
+        names.contains(fullToken) || names.contains(token)
     }
 
     // MARK: - App Launch
```

**File**: `Applite/Core/CaskCore/CaskViewModelRegistry.swift` (modified, +14/-7)
```diff
@@ -41,26 +41,33 @@ final class CaskViewModelRegistry {
 
     // MARK: - Bulk State Updates
 
-    /// Reconciles a boolean flag across every view model against `tokens` (short or full form).
+    /// Reconciles a boolean flag across every view model using `isMatch`.
     /// Only writes when the value actually changes — every assignment to an `@Observable`
     /// property fires `didSet`, so unconditional writes would re-render every dependent view.
-    private func updateFlag(_ keyPath: ReferenceWritableKeyPath<CaskViewModel, Bool>, tokens: Set<CaskId>) {
+    private func updateFlag(
+        _ keyPath: ReferenceWritableKeyPath<CaskViewModel, Bool>,
+        isMatch: (CaskViewModel) -> Bool
+    ) {
         for vm in viewModelsByFullToken.values {
-            let match = vm.matches(anyOf: tokens)
+            let match = isMatch(vm)
             if vm[keyPath: keyPath] != match {
                 vm[keyPath: keyPath] = match
             }
         }
     }
 
-    /// Marks casks as installed. Tokens can be short ("firefox") or full ("homebrew/cask/firefox").
+    /// Marks casks as installed from `brew list --cask --full-name`, which prints each cask's
+    /// `full_name` — so this is an exact `fullToken` match.
     func markInstalled(tokens: Set<CaskId>) {
-        updateFlag(\.isInstalled, tokens: tokens)
+        updateFlag(\.isInstalled) { $0.matchesFullName(in: tokens) }
     }
 
-    /// Marks casks as outdated. Tokens can be short or full.
+    /// Marks casks as outdated from `brew outdated --cask -q`, which prints **bare** tokens even for
+    /// tap casks. That's ambiguous across taps, so it's gated on `isInstalled`: only one of two
+    /// same-token casks can be the installed one, and installed state is reconciled first (see
+    /// `CaskManager.loadInstalledState`, which awaits `refreshInstalled` before `refreshOutdated`).
     func markOutdated(tokens: Set<CaskId>) {
-        updateFlag(\.isOutdated, tokens: tokens)
+        updateFlag(\.isOutdated) { $0.isInstalled && $0.matchesBareToken(in: tokens) }
     }
 
     // MARK: - Computed Filtered Lists
```

**File**: `Applite/Features/Settings/BrewSettingsView.swift` (modified, +6/-1)
```diff
@@ -104,10 +104,15 @@ struct BrewSettingsView: View {
                     Spacer()
 
                     AsyncButton {
-                        await caskManager.loadData(forceSync: true)
+                        let loaded = await caskManager.loadData(forceSync: true)
                         // Recovery may have repointed the selection (detected brew / reinstalled
                         // annex), so re-poll rather than leaving a stale ✗ next to a path that works.
                         isSelectedBrewPathValid = await BrewPaths.isSelectedBrewPathValid()
+                        // Only retire the banner if the refresh actually happened. With a broken
+                        // brew this button is (correctly) still enabled, but `loadData` drops its
+                        // error on that path — clearing the baselines anyway made the prompt vanish
+                        // as though the change had been applied when nothing was fetched.
+                        guard loaded else { return }
                         previousBrewOption = brewPathOption
                         previousIncludeCasksFromTaps = includeCasksFromTaps
                     } label: {
```

---

### Incident Patch 12: `debc33bd` (2026-08-04)
**Commit Message**: Fix stream truncation that silently swallowed tap casks

Shell.makeStream closed its read end from the process's termination
handler, which discards whatever the process had already written into the
pipe but the reader hadn't drained yet — up to the pipe's 64 KB buffer.

Measured on romankurnovskii/awesome-brew: the tap script emits 161,085
chars, the app received 102,184 (63%), losing 58,901 — just under the
buffer size. The JSON was cut mid-object, so decoding failed with
"Unexpected end of file", fetchTapDTOs returned nil, and taps silently
never appeared. Nothing about taps was broken: the tap, the script, the
DTO decoding and the includeCasksFromTaps default were all fine, and the
failure survived a forced ⌘R sync because it wasn't a staleness problem.

The close exists to guarantee EOF when a `script`-wrapped pty lingers
after brew exits, so it's now scoped to the pty path. A plain pipe reaches
EOF on its own once the child exits — the reader drains the backlog first.
The tap fetch is the only pty:false streaming caller, so installs and the
annex extract keep today's behaviour exactly.

Verified end to end: taps now populate (75 casks from that tap, plus 1
from another) where

**File**: `Applite/Core/Brew/Shell.swift` (modified, +11/-1)
```diff
@@ -219,9 +219,19 @@ enum Shell {
                     // finished (or AsyncBytes may not observe EOF promptly). A hung loop here would
                     // freeze the cask on its install/"success" state — so it's never marked installed.
                     // Closing our read end on termination guarantees EOF.
+                    //
+                    // **Only for a pty.** Closing discards whatever the process wrote just before
+                    // exiting and is still sitting in the pipe — up to its 64 KB buffer. A plain pipe
+                    // doesn't need the help: the child's write end closes when it exits, so the
+                    // reader drains the backlog and *then* sees EOF. Forcing it here truncated any
+                    // output the reader hadn't caught up with, which is why the 161 KB tap-cask JSON
+                    // arrived 63% complete and failed to parse ("Unexpected end of file") — taps
+                    // silently never appeared.
                     task.terminationHandler = { _ in
                         processExited.withLock { $0 = true }
-                        try? fileHandle.close()
+                        if pty {
+                            try? fileHandle.close()
+                        }
                     }
 
                     try task.run()
```

**File**: `Localizable.xcstrings` (modified, +13/-5)
```diff
@@ -2158,6 +2158,7 @@
     },
     "Brew path is invalid" : {
       "comment" : "Alert title",
+      "extractionState" : "stale",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -2755,7 +2756,7 @@
 
     },
     "Couldn't download app. No internet connection, or host is unreachable." : {
-      "comment" : "No internet alert message",
+      "comment" : "No internet failure message",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -3962,7 +3963,7 @@
       }
     },
     "Failed to install %@" : {
-      "comment" : "Install failure alert title",
+      "comment" : "Install failure notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -4044,7 +4045,7 @@
       }
     },
     "Failed to reinstall %@" : {
-      "comment" : "Failed reinstall alert title",
+      "comment" : "Failed reinstall notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -4126,7 +4127,7 @@
       }
     },
     "Failed to uninstall %@" : {
-      "comment" : "Failed app install alert title",
+      "comment" : "Failed app install notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -4167,7 +4168,7 @@
       }
     },
     "Failed to update %@" : {
-      "comment" : "Failed app update alert title",
+      "comment" : "Failed app update notification title",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -5797,6 +5798,9 @@
         }
       }
     },
+    "Moved your Homebrew, or want Applite to use its own instead? Change it in Settings." : {
+      "comment" : "Components install sheet note when the user's selected brew is missing"
+    },
     "No" : {
       "comment" : "Cask info boolean value"
     },
@@ -6526,6 +6530,7 @@
     },
     "Quit" : {
       "comment" : "Quit Applite button",
+      "extractionState" : "stale",
       "localizations" : {
         "fr" : {
           "stringUnit" : {
@@ -7901,6 +7906,9 @@
           }
         }
       }
+    },
+    "Try Again" : {
+
     },
     "Turn off few downloads filter" : {
       "comment" : "Filter disable button",
```

---

### Incident Patch 13: `e1b20ba7` (2026-08-04)
**Commit Message**: P3-10: escalate SIGTERM to SIGKILL so quitting can't leave brew running

Every teardown path — task cancellation, the run timeout, and the stream's
onTermination — called Process.terminate(), which is a SIGTERM: a request.
A brew wedged in a syscall, or a `script` wrapper whose child ignored the
pty hangup, outlives it. cancelAllAndWait then gave up after 2s and
applicationShouldTerminate replied .terminateNow anyway, so the survivor
was reparented to launchd and kept running with no Applite left to stop
it — visible to the user as "I quit and it's still downloading".

Shell.terminateThenKill now backs SIGTERM with a SIGKILL one
terminationGrace later, and every teardown path routes through it. The
liveness re-check reads Process.isRunning rather than trusting the cached
pid, so a pid the OS recycled after reaping can never be signalled.

cancelAllAndWait's timeout is now derived from Shell.terminationGrace
instead of being an independent magic number, and must stay longer than
it: SIGTERM goes out immediately, but the SIGKILL only lands a grace
period later. A wait shorter than the grace would return first and the app
would exit before the kill — the same leak with extra steps. It

**File**: `Applite/Core/Brew/BrewService.swift` (modified, +20/-6)
```diff
@@ -286,23 +286,37 @@ final class BrewService {
         activeTasks.removeAll { $0.viewModel == vm }
     }
 
-    /// Cancels every active task and waits for them to unwind (terminating their
-    /// brew processes via `Shell.stream`'s onTermination), bounded by a timeout so
-    /// quitting can never block indefinitely. Used by the quit-confirmation flow.
+    /// Cancels every active task and waits for them to unwind (terminating their brew processes via
+    /// `Shell.stream`'s onTermination), bounded by a timeout so quitting can never block
+    /// indefinitely. Used by the quit path.
+    ///
+    /// The timeout is derived from `Shell.terminationGrace` rather than being its own magic number,
+    /// and must stay **longer** than it: SIGTERM goes out immediately but the SIGKILL that catches a
+    /// process ignoring it only lands one grace period later. A wait shorter than the grace would
+    /// return first, the app would exit, and the very process we escalated for would be reparented
+    /// to launchd still running — the P3-10 leak, just with extra steps.
     func cancelAllAndWait() async {
         let tasks = activeTasks.map(\.task)
         for task in tasks { task.cancel() }
 
-        await withTaskGroup(of: Void.self) { group in
+        let deadline = Shell.terminationGrace + .seconds(1)
+        let unwoundCleanly = await withTaskGroup(of: Bool.self) { group in
             group.addTask {
                 for task in tasks { await task.value }
+                return true
             }
             group.addTask {
-                try? await Task.sleep(for: .seconds(2))
+                try? await Task.sleep(for: deadline)
+                return false
             }
             // Return as soon as either all tasks finished unwinding or the timeout fired.
-            await group.next()
+            let first = await group.next() ?? false
             group.cancelAll()
+            return first
+        }
+
+        if !unwoundCleanly {
+            Self.logger.error("Quit: \(tasks.count) brew task(s) did not unwind within \(deadline); processes were SIGKILLed")
         }
     }
 
```

**File**: `Applite/Core/Brew/Shell.swift` (modified, +35/-7)
```diff
@@ -73,6 +73,32 @@ enum Shell {
 
     // MARK: - Process implementation
 
+    /// How long a process gets to honor SIGTERM before it is killed outright.
+    ///
+    /// `terminate()` is a *request*, not a guarantee: a brew wedged in a syscall — or a `script`
+    /// wrapper whose child ignored the pty hangup — can outlive it. That matters most at quit, where
+    /// the survivor is reparented to launchd and keeps running with no Applite left to stop it
+    /// (P3-10). Anything that waits for a clean unwind must allow **more** than this — see
+    /// `BrewService.cancelAllAndWait`.
+    static let terminationGrace: Duration = .seconds(1)
+
+    /// Asks the process to stop, and makes sure it does.
+    ///
+    /// SIGTERM first so brew can unwind normally, then SIGKILL if it's still alive after
+    /// ``terminationGrace``. The liveness re-check reads `isRunning` rather than trusting the cached
+    /// pid, so a pid recycled by the OS after the process was reaped can never be signalled.
+    static func terminateThenKill(_ process: Process) {
+        guard process.isRunning else { return }
+        process.terminate()
+
+        let pid = process.processIdentifier
+        Task.detached {
+            try? await Task.sleep(for: terminationGrace)
+            guard process.isRunning else { return }
+            kill(pid, SIGKILL)
+        }
+    }
+
     /// Runs a process and awaits its termination handler — **never blocks a thread** on
     /// `waitUntilExit()`. Blocking inside async code starves the concurrency pool and stalls
     /// SwiftUI's main-run-loop updates, so all non-streaming runs go through here.
@@ -101,7 +127,7 @@ enum Shell {
         let watchdog: Task<Void, Never>? = timeout.map { duration in
             Task {
                 try? await Task.sleep(for: duration)
-                if task.isRunning { task.terminate() }
+                terminateThenKill(task)
             }
         }
         defer { watchdog?.cancel() }
@@ -118,9 +144,11 @@ enum Shell {
                     }
                     let output = String(decoding: data, as: UTF8.self).cleanTerminalOutput()
 
-                    // A timeout / cancellation kills the process with SIGTERM (uncaught signal) —
-                    // distinguish that from a normal non-zero exit.
-                    if proc.terminationReason == .uncaughtSignal, proc.terminationStatus == SIGTERM {
+                    // A timeout / cancellation kills the process with SIGTERM, escalating to
+                    // SIGKILL if it ignores that (see `terminateThenKill`) — distinguish both from
+                    // a normal non-zero exit.
+                    if proc.terminationReason == .uncaughtSignal,
+                       proc.terminationStatus == SIGTERM || proc.terminationStatus == SIGKILL {
                         if let timeout {
                             continuation.resume(throwing: ShellError.timedOut(command: displayCommand, seconds: timeout))
                         } else {
@@ -141,14 +169,14 @@ enum Shell {
                     try task.run()
                     // Cover the narrow race where cancellation arrived after the handler was
                     // installed but before the process was running.
-                    if Task.isCancelled, task.isRunning { task.terminate() }
+                    if Task.isCancelled { terminateThenKill(task) }
                 } catch {
                     handle.readabilityHandler = nil
                     continuation.resume(throwing: error)
                 }
             }
         } onCancel: {
-            if task.isRunning { task.terminate() }
+            terminateThenKill(task)
         }
     }
 
@@ -305,7 +333,7 @@ enum Shell {
             continuation.onTermination = { _ in
                 reader.cancel()
                 processHolder.withLock { proc in
-                    if proc?.isRunning == true { proc?.terminate() }
+                    if let proc { terminateThenKill(proc) }
                 }
             }
         }
```

---

### Incident Patch 14: `9d910b4d` (2026-08-04)
**Commit Message**: P3-18/P3-19: bridge Sparkle's updater into SwiftUI observation

SPUUpdater is a KVO-compliant NSObject, not @Observable, so SwiftUI never
saw it change. Two symptoms:

P3-19 — UpdateSettingsView copied automaticallyChecksForUpdates /
automaticallyDownloadsUpdates into @State in init. That's a snapshot: any
change made elsewhere left the toggles showing stale values, and Sparkle
makes exactly such a change itself via its first-launch "check
automatically?" prompt.

P3-18 — nothing read canCheckForUpdates at any of the three "Check for
Updates" call sites (menu bar, Settings, self-card), so the control
stayed live during an in-flight check and repeat clicks stacked with no
feedback.

Adds UpdaterViewModel: an @Observable @MainActor bridge that mirrors the
four properties the UI needs via KVO (not Combine, per the project's
convention), writes UI changes back, and skips the no-op write that
mirroring a KVO change would otherwise cause. The environment key now
carries it instead of the raw SPUUpdater, so the menu bar, Settings and
the self-card all observe one instance.

Sparkle's headers document all four as KVO-compliant and main-thread-only,
so only Bools cross out of the nonisolate

**File**: `Applite/App/AppliteApp.swift` (modified, +8/-3)
```diff
@@ -20,6 +20,10 @@ struct AppliteApp: App {
 
     /// Sparkle update controller
     private let updaterController: SPUStandardUpdaterController
+
+    /// One observable bridge over the updater, shared by the menu bar, Settings and the self-card
+    /// so all three see the same live state.
+    private let updaterModel: UpdaterViewModel
     
     var selectedColorScheme: ColorScheme? {
         switch colorSchemePreference {
@@ -34,6 +38,7 @@ struct AppliteApp: App {
     
     init() {
         updaterController = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
+        updaterModel = UpdaterViewModel(updater: updaterController.updater)
 
         // Setup network proxy for Kingfisher
         KingfisherManager.shared.downloader.sessionConfiguration = NetworkProxyManager.getURLSessionConfiguration()
@@ -43,7 +48,7 @@ struct AppliteApp: App {
         WindowGroup {
             ContentView()
                 .environment(caskManager)
-                .environment(\.updater, updaterController.updater)
+                .environment(\.updater, updaterModel)
                 .frame(minWidth: 970, minHeight: 520)
                 .preferredColorScheme(selectedColorScheme)
                 // Give the app delegate the live manager so it can stop running
@@ -53,11 +58,11 @@ struct AppliteApp: App {
         }
         .windowResizability(.contentSize)
         .commands {
-            CommandsMenu(updaterController: updaterController, caskManager: caskManager)
+            CommandsMenu(updater: updaterModel, caskManager: caskManager)
         }
         
         Settings {
-            SettingsView(updater: updaterController.updater)
+            SettingsView(updater: updaterModel)
                 .environment(caskManager)
                 .preferredColorScheme(selectedColorScheme)
         }
```

**File**: `Applite/App/Commands.swift` (modified, +5/-3)
```diff
@@ -6,11 +6,10 @@
 //
 
 import SwiftUI
-import Sparkle
 import ButtonKit
 
 struct CommandsMenu: Commands {
-    let updaterController: SPUStandardUpdaterController
+    let updater: UpdaterViewModel
     let caskManager: CaskManager
 
     @Environment(\.openWindow) var openWindow
@@ -33,9 +32,12 @@ struct CommandsMenu: Commands {
                 openWindow(id: "uninstall-self")
             }
 
-            Button(action: updaterController.updater.checkForUpdates) {
+            Button(action: updater.checkForUpdates) {
                 Text("Check for Updates...", comment: "Check for update menu bar item")
             }
+            // Sparkle clears this for the duration of a check; without it repeat invocations
+            // stacked up with no feedback (P3-18).
+            .disabled(!updater.canCheckForUpdates)
 
             Divider()
         }
```

**File**: `Applite/AppViews/AppliteAppView.swift` (modified, +4/-1)
```diff
@@ -35,6 +35,7 @@ struct AppliteAppView: View {
             if let updater {
                 Button("Check for Updates", action: updater.checkForUpdates)
                     .cardActionPill()
+                    .disabled(!updater.canCheckForUpdates)
             }
 
             Button {
@@ -55,6 +56,8 @@ struct AppliteAppView: View {
     AppliteAppView()
         .environment(
             \.updater,
-            SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: nil, userDriverDelegate: nil).updater
+            UpdaterViewModel(
+                updater: SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: nil, userDriverDelegate: nil).updater
+            )
         )
 }
```

**File**: `Applite/Core/Database/CaskDatabaseService.swift` (modified, +5/-0)
```diff
@@ -35,6 +35,11 @@ struct CaskDatabaseService {
     }
 
     /// Fetches casks matching a list of tokens (checks both `token` and `fullToken` columns)
+    ///
+    /// Not chunked, deliberately (P2-23): this binds 2× the token count, and the catalog itself is
+    /// ~7.7k casks, so reaching even SQLite's *stock* 32,766-variable limit would take an import
+    /// file with more tokens than there are casks in existence. Apple's build raises the limit to
+    /// 500,000 besides. Chunking here would be complexity guarding an unreachable case.
     func fetchCasks(forTokens tokens: [String]) async throws -> [CaskRecord] {
         guard !tokens.isEmpty else { return [] }
         return try await pool().read { db in
```

**File**: `Applite/Core/Infrastructure/UpdaterEnvironmentKey.swift` (modified, +8/-5)
```diff
@@ -8,18 +8,21 @@
 import SwiftUI
 import Sparkle
 
-/// Exposes the app-wide Sparkle ``SPUUpdater`` through the environment so views
-/// (e.g. the "Applite" self-card) can reuse the single app-level updater instead
-/// of constructing their own ``SPUStandardUpdaterController``.
+/// Exposes the app-wide ``UpdaterViewModel`` through the environment so views (e.g. the "Applite"
+/// self-card) can reuse the single app-level updater instead of constructing their own
+/// ``SPUStandardUpdaterController``.
+///
+/// Carries the view model rather than the raw `SPUUpdater` so every consumer observes the same
+/// live state — `SPUUpdater` itself is KVO-only and invisible to SwiftUI (P3-18/P3-19).
 ///
 /// Optional because the macOS 14 deployment target rules out the `@Entry` macro
 /// and there is no sensible non-nil default updater.
 private struct UpdaterEnvironmentKey: EnvironmentKey {
-    static let defaultValue: SPUUpdater? = nil
+    static let defaultValue: UpdaterViewModel? = nil
 }
 
 extension EnvironmentValues {
-    var updater: SPUUpdater? {
+    var updater: UpdaterViewModel? {
         get { self[UpdaterEnvironmentKey.self] }
         set { self[UpdaterEnvironmentKey.self] = newValue }
     }
```

**File**: `Applite/Core/Infrastructure/UpdaterViewModel.swift` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+//
+//  UpdaterViewModel.swift
+//  Applite
+//
+//  Created by Milán Várady on 2026.08.04.
+//
+
+import Foundation
+import Sparkle
+
+/// Bridges Sparkle's `SPUUpdater` into SwiftUI's observation system.
+///
+/// `SPUUpdater` is a KVO-compliant `NSObject`, not `@Observable`, so SwiftUI can't track it: a view
+/// that reads `updater.automaticallyChecksForUpdates` renders once with whatever the value was then
+/// and never hears about a change. The old code worked around that by copying the values into
+/// `@State` in `init` — which is a snapshot, so the toggles drifted out of sync whenever anything
+/// else moved them (Sparkle's own first-launch "check automatically?" prompt does exactly that)
+/// (P3-19). And nothing observed `canCheckForUpdates` at all, so "Check for Updates" stayed live
+/// during a check and repeat clicks stacked up with no feedback (P3-18).
+///
+/// KVO → `@Observable` rather than Combine, per the project's convention.
+@MainActor
+@Observable
+final class UpdaterViewModel {
+    /// False while a check is already running. Sparkle documents this as the property to bind a
+    /// "Check for Updates" control's enabled state to.
+    private(set) var canCheckForUpdates: Bool
+
+    /// Whether the *option* to auto-download may be offered. Sparkle derives this from
+    /// `automaticallyChecksForUpdates` **and** the host's `SUAllowsAutomaticUpdates` Info.plist key,
+    /// so it's the correct gate — the previous hand-rolled `!automaticallyChecksForUpdates` missed
+    /// the plist half.
+    private(set) var allowsAutomaticUpdates: Bool
+
+    var automaticallyChecksForUpdates: Bool {
+        didSet { write(automaticallyChecksForUpdates, to: \.automaticallyChecksForUpdates) }
+    }
+
+    var automaticallyDownloadsUpdates: Bool {
+        didSet { write(automaticallyDownloadsUpdates, to: \.automaticallyDownloadsUpdates) }
+    }
+
+    private let updater: SPUUpdater
+    @ObservationIgnored private var observations: [NSKeyValueObservation] = []
+
+    init(updater: SPUUpdater) {
+        self.updater = updater
+        self.canCheckForUpdates = updater.canCheckForUpdates
+        self.allowsAutomaticUpdates = updater.allowsAutomaticUpdates
+        self.automaticallyChecksForUpdates = updater.automaticallyChecksForUpdates
+        self.automaticallyDownloadsUpdates = updater.automaticallyDownloadsUpdates
+
+        observations = [
+            observe(\.canCheckForUpdates) { $0.canCheckForUpdates = $1 },
+            observe(\.allowsAutomaticUpdates) { $0.allowsAutomaticUpdates = $1 },
+            observe(\.automaticallyChecksForUpdates) { $0.automaticallyChecksForUpdates = $1 },
+            observe(\.automaticallyDownloadsUpdates) { $0.automaticallyDownloadsUpdates = $1 }
+        ]
+    }
+
+    func checkForUpdates() {
+        updater.checkForUpdates()
+    }
+
+    /// Mirrors one KVO-compliant `Bool` into our observable copy.
+    ///
+    /// Only `change.newValue` crosses the boundary — a `Bool`, not the updater — because the KVO
+    /// callback is nonisolated while these Sparkle properties are documented main-thread-only.
+    private func observe(
+        _ keyPath: KeyPath<SPUUpdater, Bool>,
+        apply: @escaping @MainActor @Sendable (UpdaterViewModel, Bool) -> Void
+    ) -> NSKeyValueObservation {
+        updater.observe(keyPath, options: [.new]) { [weak self] _, change in
+            guard let newValue = change.newValue else { return }
+            Task { @MainActor in
+                guard let self else { return }
+                apply(self, newValue)
+            }
+        }
+    }
+
+    /// Writes a UI-driven change back to Sparkle, skipping the no-op write that mirroring a KVO
+    /// change back would otherwise cause.
+    private func write(_ value: Bool, to keyPath: ReferenceWritableKeyPath<SPUUpdater, Bool>) {
+        guard updater[keyPath: keyPath] != value else { return }
+        updater[keyPath: keyPath] = value
+    }
+}
```

**File**: `Applite/Features/Settings/SettingsView.swift` (modified, +8/-6)
```diff
@@ -30,7 +30,7 @@ public enum ColorSchemePreference: String, CaseIterable, Identifiable, Sendable
 
 /// Settings pane
 struct SettingsView: View {
-    let updater: SPUUpdater
+    let updater: UpdaterViewModel
 
     var body: some View {
         TabView {
@@ -79,10 +79,12 @@ struct SettingsView: View {
 
 #Preview {
     SettingsView(
-        updater: SPUStandardUpdaterController(
-            startingUpdater: false,
-            updaterDelegate: nil,
-            userDriverDelegate: nil
-        ).updater
+        updater: UpdaterViewModel(
+            updater: SPUStandardUpdaterController(
+                startingUpdater: false,
+                updaterDelegate: nil,
+                userDriverDelegate: nil
+            ).updater
+        )
     )
 }
```

**File**: `Applite/Features/Settings/UpdateSettingsView.swift` (modified, +9/-20)
```diff
@@ -6,43 +6,32 @@
 //
 
 import SwiftUI
-import Sparkle
 
 struct UpdateSettingsView: View {
-    private let updater: SPUUpdater
-
-    @State private var automaticallyChecksForUpdates: Bool
-    @State private var automaticallyDownloadsUpdates: Bool
-
-    init(updater: SPUUpdater) {
-        self.updater = updater
-        self.automaticallyChecksForUpdates = updater.automaticallyChecksForUpdates
-        self.automaticallyDownloadsUpdates = updater.automaticallyDownloadsUpdates
-    }
+    /// The app-wide updater bridge. Bound directly — the toggles used to be `@State` copies taken in
+    /// `init`, i.e. a snapshot that never heard about a change made anywhere else (P3-19).
+    @Bindable var updater: UpdaterViewModel
 
     var body: some View {
         Form {
             Section {
                 Button(action: updater.checkForUpdates) {
                     Label("Check for Updates...", systemImage: "arrow.triangle.2.circlepath")
                 }
+                .disabled(!updater.canCheckForUpdates)
 
                 LabeledContent("Current app version") {
                     Text("\(Bundle.main.version) (\(Bundle.main.buildNumber))", comment: "Update settings current app version text (version, build number)")
                 }
             }
 
             Section {
-                Toggle("Automatically check for updates", isOn: $automaticallyChecksForUpdates)
-                    .onChange(of: automaticallyChecksForUpdates) { _, newValue in
-                        updater.automaticallyChecksForUpdates = newValue
-                    }
+                Toggle("Automatically check for updates", isOn: $updater.automaticallyChecksForUpdates)
 
-                Toggle("Automatically download updates", isOn: $automaticallyDownloadsUpdates)
-                    .disabled(!automaticallyChecksForUpdates)
-                    .onChange(of: automaticallyDownloadsUpdates) { _, newValue in
-                        updater.automaticallyDownloadsUpdates = newValue
-                    }
+                // Sparkle's own gate: it folds in the host's `SUAllowsAutomaticUpdates` Info.plist
+                // key as well as the checks-for-updates setting.
+                Toggle("Automatically download updates", isOn: $updater.automaticallyDownloadsUpdates)
+                    .disabled(!updater.allowsAutomaticUpdates)
             }
         }
         .formStyle(.grouped)
```

---

### Incident Patch 15: `ced3e131` (2026-08-04)
**Commit Message**: Merge pull request #153 from milanvarady/fix/tier1-shell-injection-dataloss

Pre-release hardening: fix shell injection, data-loss & state bugs, + cleanup

**File**: `Applite/AppViews/AppView.swift` (modified, +4/-0)
```diff
@@ -158,6 +158,7 @@ struct AppView: View {
         .menuStyle(.borderlessButton)
         .menuIndicator(.hidden)
         .fixedSize()
+        .accessibilityLabel("More options")
     }
 
     private func getInfo() async {
@@ -257,6 +258,7 @@ struct AppView: View {
             .buttonStyle(.plain)
             .frame(width: 30, height: 30)
             .help(caskManager.batchProgress != nil ? "Part of a bulk operation" : "Stop download")
+            .accessibilityLabel("Stop download")
 
         case .success:
             // Handled upstream by `showsSuccessIndicator` in `actionsView`; unreachable here.
@@ -278,6 +280,7 @@ struct AppView: View {
                 }
                 .buttonStyle(.bordered)
                 .help("View terminal output")
+                .accessibilityLabel("View terminal output")
 
                 Button {
                     caskManager.dismissFailure(cask)
@@ -286,6 +289,7 @@ struct AppView: View {
                 }
                 .buttonStyle(.bordered)
                 .help("Dismiss")
+                .accessibilityLabel("Dismiss error")
             }
 
         case .idle:
```

**File**: `Applite/AppViews/AppliteAppView.swift` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ struct AppliteAppView: View {
                     .foregroundStyle(.secondary)
             }
             .buttonStyle(.plain)
+            .accessibilityLabel("Uninstall Applite")
         }
         .frame(width: AppView.dimensions.width, height: AppView.dimensions.height)
     }
```

**File**: `Applite/Components/CardActionPill.swift` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 //
-//  View+CardActionPill.swift
+//  CardActionPill.swift
 //  Applite
 //
 //  Created by Milán Várady on 2026.08.01.
```

**File**: `Applite/Components/EnvironmentInput.swift` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+//
+//  EnvironmentInput.swift
+//  Applite
+//
+//  Created by Milán Várady on 2025.05.09.
+//
+
+import SwiftUI
+
+/// Labelled text field for a single environment variable (used by the Mirror settings).
+struct EnvironmentInput: View {
+    let title: String
+    @Binding var text: String
+
+    var body: some View {
+        VStack(alignment: .leading, spacing: 2) {
+            Text(title)
+                .font(.caption.monospaced())
+                .foregroundStyle(.secondary)
+            TextField(title, text: $text)
+                .labelsHidden()
+                .textFieldStyle(.roundedBorder)
+        }
+    }
+}
```

**File**: `Applite/Components/InfoPopup.swift` (modified, +23/-15)
```diff
@@ -32,21 +32,29 @@ struct InfoPopup: View {
     }
 
     var body: some View {
-        Image(systemName: sfSymbol)
-            .foregroundStyle(color)
-            .onHover { hover in
-                showPopover = hover
-            }
-            .buttonStyle(.plain)
-            .popover(isPresented: $showPopover) {
-                Text(text)
-                    .textSelection(.enabled)
-                    .frame(maxWidth: 400)
-                    .fixedSize(horizontal: true, vertical: true)
-                    .padding(16)
-                    .padding(.top, extraTopPadding)
-                    .padding(.bottom, extraBottomPadding)
-            }
+        // A real Button (not a bare hover-only Image) so keyboard and VoiceOver users can open the
+        // popover too; hover still opens it for mouse users. The info text is exposed as the
+        // accessibility label so assistive tech announces it without having to open the popover (F2).
+        Button {
+            showPopover.toggle()
+        } label: {
+            Image(systemName: sfSymbol)
+                .foregroundStyle(color)
+        }
+        .buttonStyle(.plain)
+        .onHover { hover in
+            showPopover = hover
+        }
+        .popover(isPresented: $showPopover) {
+            Text(text)
+                .textSelection(.enabled)
+                .frame(maxWidth: 400)
+                .fixedSize(horizontal: true, vertical: true)
+                .padding(16)
+                .padding(.top, extraTopPadding)
+                .padding(.bottom, extraBottomPadding)
+        }
+        .accessibilityLabel(Text(text))
     }
 }
 
```

**File**: `Applite/Components/Remark.swift` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+//
+//  Remark.swift
+//  Applite
+//
+//  Created by Milán Várady on 2026.08.03.
+//
+
+import SwiftUI
+
+/// A bold, coloured "**Title:** message" line used for notes/warnings inside Form sections.
+/// Returns `Text` so it composes inline as a section row.
+func remark(title: LocalizedStringKey, color: Color, message: LocalizedStringKey) -> Text {
+    Text(title)
+        .foregroundStyle(color)
+        .fontWeight(.bold)
+    +
+    Text(": ")
+        .foregroundStyle(color)
+        .fontWeight(.bold)
+    +
+    Text(message)
+}
```

**File**: `Applite/Core/Brew/BrewPaths.swift` (modified, +10/-3)
```diff
@@ -9,6 +9,11 @@ import Foundation
 
 /// Holds the different brew directory and executable paths, provides methods to retrieve and verify the currently selected path
 struct BrewPaths {
+    /// User-facing message for a broken brew path or damaged installation. Lives here — the neutral
+    /// brew-path abstraction — so generic callers (BrewService, BrokenInstallView) don't reach into
+    /// annex-specific machinery for it (E3).
+    static let brokenPathOrInstallMessage = "Error. Broken brew path, or damaged installation. Check brew path in settings, or try reinstalling Homebrew (Manage Homebrew->Reinstall)"
+
     /// Brew executable path options
     enum PathOption: Int, CaseIterable, Identifiable {
         /// Applite's own ("annex") brew in the Application Support folder
@@ -81,8 +86,10 @@ struct BrewPaths {
     ///
     /// - Returns: Whether the path is valid or not
     static func isBrewPathValid(at url: URL) async -> Bool {
-        // Check if Homebrew is returned when checking version
-        guard let output = try? await Shell.runAsync("\(url.quotedPath()) --version") else {
+        // Check if Homebrew is returned when checking version. Argv-based (the path is never
+        // spliced into a shell) and time-boxed so a hung/locked/network-mounted brew can't stall
+        // app launch — the whole bootstrap awaits this before it can leave `.checking`.
+        guard let output = try? await Shell.run(url, ["--version"], timeout: .seconds(10)) else {
             return false
         }
 
@@ -161,7 +168,7 @@ struct BrewPaths {
 
         // A login shell (`-l`) sources the user's profile, so `command -v brew` sees the PATH they
         // actually use — this is what finds brew at a non-standard prefix.
-        guard let output = try? await Shell.runAsync("zsh -lc 'command -v brew'", timeout: .seconds(5)) else {
+        guard let output = try? await Shell.run(URL(fileURLWithPath: "/bin/zsh"), ["-lc", "command -v brew"], timeout: .seconds(5)) else {
             return nil
         }
 
```

**File**: `Applite/Core/Brew/BrewService.swift` (modified, +66/-37)
```diff
@@ -11,6 +11,11 @@ import OSLog
 
 struct ActiveBrewTask: Identifiable {
     let id = UUID()
+    /// Groups the rows belonging to the same brew operation (a batch shares one across its casks).
+    /// Eviction is scoped to this, so a finishing op only removes its *own* rows — never a
+    /// different, still-queued op's row for the same cask (which would make that card vanish and
+    /// its cancel silently no-op while brew still ran).
+    let operationID: UUID
     let viewModel: CaskViewModel
     let task: Task<Void, Never>
 }
@@ -72,25 +77,20 @@ final class BrewService {
         return runTask(for: vm) {
             Self.logger.info("Cask \"\(vm.token)\" installation started")
 
-            // Appdir argument
-            let appdirOn = UserDefaults.standard.value(for: Preferences.appdirOn)
-            let appdirPath = UserDefaults.standard.value(for: Preferences.appdirPath)
-            let appdirArgument = "--appdir=\"\(appdirPath)\""
-
             // Always --force: the Install button only shows when the cask isn't tracked as
             // installed, so force just overwrites/adopts any untracked copy already on disk instead
             // of erroring — and it's identical to a plain install when nothing is there.
-            var arguments = [vm.token, "--force"]
-            if appdirOn { arguments.append(appdirArgument) }
-
-            let command = "\(BrewPaths.currentBrewExecutable.quotedPath()) install --cask \(arguments.joined(separator: " "))"
+            // Use `fullToken` (like every sibling op) so a tapped token that collides with a core
+            // cask installs the intended cask, not the core one.
+            var arguments = ["install", "--cask", vm.fullToken, "--force"]
+            arguments.append(contentsOf: Self.appdirArguments())
 
             // Setup progress
             vm.progressState = .busy(withTask: "")
 
             // Run install command and stream output
             let result = await self.streamBrewCommand(
-                command,
+                arguments,
                 vm: vm,
                 busyLabel: String(localized: "Installing", comment: "Install progress text")
             )
@@ -187,9 +187,7 @@ final class BrewService {
             let updateLabel = String(localized: "Updating", comment: "Update progress text")
             vm.progressState = .busy(withTask: updateLabel)
 
-            let command = "\(BrewPaths.currentBrewExecutable.quotedPath()) upgrade --cask \(vm.fullToken)"
-
-            let result = await self.streamBrewCommand(command, vm: vm, busyLabel: updateLabel)
+            let result = await self.streamBrewCommand(["upgrade", "--cask", vm.fullToken], vm: vm, busyLabel: updateLabel)
 
             // Stopped by the user — no success/failure surface.
             if Task.isCancelled {
@@ -225,9 +223,7 @@ final class BrewService {
             let reinstallLabel = String(localized: "Reinstalling", comment: "Reinstall progress text")
             vm.progressState = .busy(withTask: reinstallLabel)
 
-            let command = "\(BrewPaths.currentBrewExecutable.quotedPath()) reinstall --cask \(vm.fullToken)"
-
-            let result = await self.streamBrewCommand(command, vm: vm, busyLabel: reinstallLabel)
+            let result = await self.streamBrewCommand(["reinstall", "--cask", vm.fullToken], vm: vm, busyLabel: reinstallLabel)
 
             // Stopped by the user — no success/failure surface.
             if Task.isCancelled {
@@ -335,14 +331,16 @@ final class BrewService {
         vm.progressState = .busy(withTask: waitingLabel)
 
         let previous = queueTail
+        let operationID = UUID()
         let task = Task {
             await previous?.value
 
             defer {
                 // Keep a failed cask in the task list (so its error stays reachable) until the user
-                // dismisses it; remove it once it succeeds or is otherwise done.
+                // dismisses it; remove it once it succeeds or is otherwise done. Scope to THIS
+                // operation's row so a separate queued op for the same cask isn't evicted (P2-10).
                 self.activeTasks.removeAll {
-                    $0.viewModel == vm && !$0.viewModel.progressState.isFailed
+                    $0.operationID == operationID && !$0.viewModel.progressState.isFailed
                 }
             }
 
@@ -353,9 +351,7 @@ final class BrewService {
             }
 
             // Make sure brew path is valid
-            guard await BrewPaths.isSelectedBrewPathValid() else {
-                Self.logger.error("Couldn't start brew operation because brew path is invalid")
-                alert.show(title: "Brew path is invalid", message: AnnexBrewManager.brokenPathOrInstallMessage)
+            guard await self.brewPathIsValid() else {
                 vm.progressState = .idle
                 return
             }
@@ -364,10 +360,38 @@ final class BrewService {
         }
 
         queueTail = task
-        
```

#### Recent Merged Pull Requests:
- **PR #164** (2026-09-12): Trim README badges and add a light/dark screenshot (@milanvarady)
- **PR #163** (2026-09-10): Update the release docs and notes template for applite.app (@milanvarady)
- **PR #162** (2026-09-10): Point the in-app links at applite.app (@milanvarady)
- **PR #161** (2026-09-10): Swap PayPal for Ko-fi in the Sponsor button (@milanvarady)
- **PR #156** (2026-08-04): i18n: complete all six languages, add a glossary and the catalog tooling (@milanvarady)
- **PR #155** (2026-08-04): Testing: cover PR #154 in the harness, add an upgrade round (@milanvarady)
- **PR #154** (2026-08-04): Deferred review backlog: brew state, alerts, schema identity, stream truncation (@milanvarady)
- **PR #153** (2026-08-04): Pre-release hardening: fix shell injection, data-loss & state bugs, + cleanup (@milanvarady)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
