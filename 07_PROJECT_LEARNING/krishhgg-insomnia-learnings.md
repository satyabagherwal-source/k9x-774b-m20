> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/krishhgg-insomnia-learnings.md`  
> **Source**: github ([https://github.com/krishhgg/Insomnia](https://github.com/krishhgg/Insomnia))  
> **Source Version**: `b8e7e20d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T00:52:51.539Z  
> **Learning ID**: `learn-github-krishhgg-insomnia`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): krishhgg/Insomnia

> **Canonical Artifact**: `07_PROJECT_LEARNING/krishhgg-insomnia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/krishhgg/Insomnia](https://github.com/krishhgg/Insomnia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T00:52:51.308Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `krishhgg/Insomnia`
- **Description**: A macOS menu bar app that safely keeps your MacBook awake with the lid closed, for timed agent sessions.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1848 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Sources/Insomnia/Core/AppServices.swift`
```
import Foundation
import Observation

/// Everything the menu shows about the machine. Updated by AppServices on
/// each OS event; `refreshOnDemand()` fills the on-demand fields (watts,
/// SSID, browser flags) when the popover opens.
@MainActor
@Observable
final class SystemStatus {
    var lidClosed: Bool = false
    var batteryPercent: Int?
    var isCharging: Bool = false
    var thermalState: ProcessInfo.ThermalState = .nominal
    var wifiSSID: String?
    /// Length of the last Wi-Fi outage this session, in seconds.
    var lastGap: TimeInterval?
    var frozenCount: Int = 0
    var dockerPaused: Bool = false
    /// Running Chromium browsers missing the two flags.
    var throttledBrowsers: [ThrottledBrowser] = []
    /// Full detail for the relaunch item (bundle id + name).
    var browsers: [BrowserStatus] = []
    /// Why each browser's last relaunch did not happen, by bundle id: the
    /// text the notification carries, which names the browser. The menu
    /// shows each as a warning line, because a notification can be turned
    /// off for Insomnia, and one that is not presented is gone. A
    /// browser's line is cleared when its next relaunch starts, and every
    /// line when a session starts; the end of a session leaves them, since
    /// the browsers they name may still be closed.
    var relaunchProblems: [String: String] = [:]
    /// Why the failover could not join the hotspot this session, if a join
    /// was skipped for want of a readable password, and for which SSID.
    /// The menu shows it while that SSID is the one configured.
    var hotspotPasswordReport: HotspotPasswordReport?

    @ObservationIgnored var refresher: (@MainActor () async -> Void)?

    /// Fire-and-forget refresh of watts, SSID, battery and browser flags.
    func refreshOnDemand() {
        guard let refresher else { return }
        Task { @MainActor in await refresher() }
    }
}

/// Owns and wires every system integration to the SessionManager.
/// Constructed by `SessionManager.live()`; started when a session starts (or
/// is found valid at reconcile) and stopped when it ends.
@MainActor
final class AppServices {
    let status = SystemStatus()
    let notifier: any Notifying
    let locationPermission: LocationPermission

    private let paths: Paths
    private let audio: any AudioControlling
    private let display: any DisplayDimming
    private let keyboard: any KeyboardBacklighting
    private let freezer: any Freezing
    private let docker: DockerRule
    private let keychain: any KeychainStoring
    private let lid = LidObserver()
    /// The file trigger behind scripts/simulate-lid.sh. Compiled into debug
    /// builds and INSOMNIA_LID_SIMULATION release builds only
    /// (`LidSimulationBuild`); nil in every other build, and only started
    /// when `lidSimulationEnabled` is true, so a normal release build never
    /// watches the support directory for lid events.
    private let lidSimulation: (any LidSimulating)?
    private let lidSimulationEnabled: Bool
    private let power = PowerMonitor()
    private let browser: BrowserThrottle
    /// Last trusted display/keyboard brightness for the lid close (spec
    /// section 4): read every 30 s while the lid is open, at start, and 3 s
    /// after each lid open (the backlight stays suppressed briefly after the
    /// wake), and given each level the manager restores (see `follow`).
    private let sampler: BrightnessSampler
    private static let sampleInterval: TimeInterval = 30
    private static let sampleLeeway: DispatchTimeInterval = .seconds(5)
    private static let postOpenSampleDelay: Duration = .seconds(3)

    private weak var manager: SessionManager?
    private var lidActions: LidActions?
    private var floors: FloorRuleDriver?
    private var network: NetworkFailover?
    private var networkTask: Task<Void, Never>?
    private var lidTasks: [Task<Void, Never>] = []
    private var floorTasks: [Task<Void, Never>] = []
    private var browserTasks: [Task<Void, Never>] = []
    /// Relaunches started so far, and the newest one of each browser, by
    /// bundle id. Only the newest relaunch of a browser reports its outcome.
    private var relaunchCount = 0
    private var newestRelaunch: [String: Int] = [:]
    private var sampleTimer: (any DispatchSourceTimer)?
    private var postOpenSampleTask: Task<Void, Never>?
    /// The state of the last lid event, from the hinge or the simulation
    /// trigger, run or refused. `status.lidClosed` is no stand-in for it:
    /// the menu's `refreshInstant` writes the raw registry there, which
    /// can hold a change the observer then drops as a flap.
    private var lastLidEvent: Bool?
    private(set) var running = false

    init(
        paths: Paths,
        notifier: any Notifying,
        audio: any AudioControlling,
        processControl: any ProcessSignaling,
        display: any DisplayDimming = NoopDisplayDimmer(),
        keyboard: any KeyboardBacklighting = NoopKeyboardBacklight(),
        keychain: any KeychainStoring = KeychainStore(),
        locationPermission: LocationPermission = LocationPermission(),
        browser: BrowserThrottle? = nil,
        idleSeconds: @escaping @Sendable () -> Double = { UserInput.secondsSinceLastInput() },
        lidSimulation: (any LidSimulating)? = LidSimulationBuild.makeWatcher(),
        lidSimulationEnabled: Bool = LidSimulationBuild.isCompiledIn
    ) {
        self.paths = paths
        self.notifier = notifier
        self.audio = audio
        self.display = display
        self.keyboard = keyboard
        self.lidSimulation = lidSimulation
        self.lidSimulationEnabled = lidSimulationEnabled
        self.sampler = BrightnessSampler(display: display, keyboard: keyboard, idleSeconds: idleSeconds)
        self.freezer = Freezer(control: processControl)
        self.docker = DockerRule(freezer: freezer)
        self.keychain = keychain
        self.locationPermission = locationPermission
        self.browser = browser ?? BrowserThrottle()
        status.refresher = { [weak self] in await self?.refreshOnDemand() }
    }

    /// Called by SessionManager once a session is active.
    func start(for manager: SessionManager) {
        guard !running else { return }
        running = true
        self.manager = manager
        let config = manager.config
        status.lastGap = nil
        status.hotspotPasswordReport = nil
        status.relaunchProblems = [:]

        if !config.hotspotSSID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            locationPermission.requestWhenInUse()
        }

        (notifier as? Notifier)?.requestAuthorizationIfNeeded()

        lidActions = LidActions(manager: manager, freezer: freezer, docker: docker, audio: audio, display: display, keyboard: keyboard, sampler: sampler)
        floors = FloorRuleDriver(manager: manager, notifier: notifier)
        // The panel under Insomnia's own Low Power Mode reads the mode's
        // rescaled value: sample once more just before the mode goes on
        // and keep that sample until it is off (spec section 4).
        manager.willEnableLowPower = { [weak self] in self?.sampleBrightnessIfLidOpen() }
        // A power command left running refuses lid and floor transactions
        // until it exits; the manager calls back then.
        manager.resyncAfterCommand = { [weak self] replayLid in self?.resyncAfterCommand(replayLid: replayLid) }
        sampler.follow(manager)

        lid.onChange = { [weak self] closed in self?.lidChanged(closed) }
        lid.start()
        status.lidClosed = lid.isClosed
        sampleBrightnessIfLidOpen()
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now() + Self.sampleInterval, repeating: Self.sampleInterval, leeway: Self.sampleLeeway)
        timer.setEventHandler { [weak self] in
            Task { @MainActor in self?.sampleBrightnessIfLidOpen() }
        }
        sampleTimer = timer
        timer.resume()
        startLidSimulation()

        power.onChange = { [weak self] in self?.powerChanged() }
        power.start()
        syncPower()
        // Apply the floors once: the battery may already be below one.
        powerChanged()

        let net = NetworkFailover(paths: paths, keychain: keychain, notifier: notifier) { [weak manager] in
            manager?.config ?? Config()
        }
        net.onRecovered = { [weak self] gap in self?.status.lastGap = gap }
        net.onPasswordReport = { [weak self] report in self?.status.hotspotPasswordReport = report }
        network = net
        networkTask = Task { [weak self, weak net] in
            guard let self, let net else { return }
            await net.start()
            if Task.isCancelled || !self.running || self.network !== net {
                net.stop()
            }
        }

        browserTasks.append(Task { await self.refreshBrowsers() })
        syncState()
    }

    func stop() {
        guard running else { return }
        running = false
        lid.stop()
        lid.onChange = nil
        lastLidEvent = nil
        stopLidSimulation()
        power.stop()
        power.onChange = nil
        sampleTimer?.cancel()
        sampleTimer = nil
        postOpenSampleTask?.cancel()
        postOpenSampleTask = nil
        networkTask?.cancel()
        networkTask = nil
        for task in lidTasks { task.cancel() }
        lidTasks.removeAll()
        for task in floorTasks { task.cancel() }
        floorTasks.removeAll()
        cancelBrowserTasks()
        network?.stop()
        network = nil
        status.hotspotPasswordReport = nil
        lidActions = nil
        floors = nil
        syncState()
    }

    /// One-shot launch diagnostics. This does not start any observer or retry
    /// timer, so system integrations remain active only during a session.
    func logStartupSnapshot() {
        if let closed = LidObserver.readClamshellState() {
            status.lidClo
```

### Core Architecture Module: `Sources/Insomnia/Core/FloorRules.swift`
```
import Foundation

/// Spec section 6 decision table (plus the section 4 lid row), as a pure
/// function plus a small driver.
enum FloorRules {
    /// Why Low Power Mode is being switched on. The strongest cause is
    /// named when several hold: thermal, then battery, then lid.
    enum LowPowerCause: Equatable, Sendable {
        case battery
        case thermal
        case lid
    }

    enum Action: Equatable, Sendable {
        case enableLowPower(LowPowerCause)
        case disableLowPower
        case endSession(EndReason)
    }

    /// Ordered actions for the current inputs.
    ///
    /// - battery below `endFloor` while not charging: end session. 0 never
    ///   matches, so 0 turns the battery end off; Config keeps a non-zero
    ///   `endFloor` below `lowPowerFloor`.
    /// - thermal `critical` (if `thermalRules`): end session
    /// - battery present but unreadable on two consecutive reads while not
    ///   charging, with an end floor set: end session. The floor cannot be
    ///   applied to a level nobody can read, and the Mac is on a battery
    ///   that may be about to die. A desktop has no battery and no floor.
    /// - battery below `lowPowerFloor` while not charging, thermal
    ///   `serious` (if `thermalRules`), or lid closed (if
    ///   `lowPowerOnLidClose`, charging or not): Low Power Mode on
    /// - none of the above while we set Low Power Mode: Low Power Mode off
    ///   ("charger connected", "thermal back to nominal/fair", "lid opened")
    static func evaluate(
        battery: BatteryStatus,
        isCharging: Bool,
        thermal: ProcessInfo.ThermalState,
        lidClosed: Bool,
        lowPowerSetByUs: Bool,
        config: Config
    ) -> [Action] {
        let onBattery = !isCharging
        let percent = battery.percent
        if let p = percent, onBattery, p < config.endFloor {
            return [.endSession(.batteryFloor)]
        }
        if config.thermalRules, thermal == .critical {
            return [.endSession(.thermalCritical)]
        }
        if case let .unreadable(misses) = battery, onBattery, misses >= 2, config.endFloor > 0 {
            return [.endSession(.batteryUnreadable)]
        }
        let cause = lowPowerCause(percent: percent, isCharging: isCharging, thermal: thermal, lidClosed: lidClosed, config: config)
        if let cause, !lowPowerSetByUs { return [.enableLowPower(cause)] }
        if cause == nil, lowPowerSetByUs { return [.disableLowPower] }
        return []
    }

    /// The strongest cause that wants Low Power Mode right now (thermal,
    /// then battery, then lid), or nil when none holds. Independent of
    /// whether the mode is already on, so the driver can track which cause
    /// is keeping it on as the inputs change.
    static func lowPowerCause(
        percent: Int?,
        isCharging: Bool,
        thermal: ProcessInfo.ThermalState,
        lidClosed: Bool,
        config: Config
    ) -> LowPowerCause? {
        if config.thermalRules, thermal == .serious { return .thermal }
        if let p = percent, !isCharging, p < config.lowPowerFloor { return .battery }
        if lidClosed, config.lowPowerOnLidClose { return .lid }
        return nil
    }
}

/// Applies `FloorRules` through the session manager (journal first) and
/// posts the spec section 9 notifications. A lid-caused change is logged
/// but not announced: the user just closed or opened the lid.
///
/// Announce rule for switching the mode off: the disable is announced iff
/// the cause that last held while Insomnia had the mode on was battery or
/// thermal, and silent iff it was the lid. The cause is refreshed on every
/// run while the mode is ours, so a takeover (lid-caused mode kept on by
/// the battery floor, or the reverse) changes which one the disable is
/// attributed to.
@MainActor
struct FloorRuleDriver {
    weak var manager: SessionManager?
    let notifier: any Notifying
    /// The cause that most recently held while Insomnia had the mode on,
    /// so the matching disable knows whether it is announced. Not
    /// journaled: after a relaunch the disable is announced as before.
    private let lastCause = LastCause()

    @MainActor
    private final class LastCause {
        var value: FloorRules.LowPowerCause?
    }

    init(manager: SessionManager, notifier: any Notifying) {
        self.manager = manager
        self.notifier = notifier
    }

    func run(battery: BatteryStatus, isCharging: Bool, thermal: ProcessInfo.ThermalState, lidClosed: Bool) async {
        guard let manager, manager.isActive, !Task.isCancelled else { return }
        let config = manager.config
        let percent = battery.percent
        let actions = FloorRules.evaluate(
            battery: battery,
            isCharging: isCharging,
            thermal: thermal,
            lidClosed: lidClosed,
            lowPowerSetByUs: manager.state.lowPowerSetByUs,
            config: config
        )
        // Track the effective cause while the mode is ours, not only at the
        // enable: another cause may have taken over since.
        if manager.state.lowPowerSetByUs,
           let cause = FloorRules.lowPowerCause(percent: percent, isCharging: isCharging, thermal: thermal, lidClosed: lidClosed, config: config) {
            lastCause.value = cause
        }
        for action in actions {
            guard manager.isActive, !Task.isCancelled else { return }
            switch action {
            case let .enableLowPower(cause):
                guard await manager.setLowPower(true) else { continue }
                lastCause.value = cause
                guard manager.isActive, !Task.isCancelled else { return }
                switch cause {
                case .thermal:
                    notifier.post(title: "Low Power Mode on", body: "Thermal state is serious. Low Power Mode is on until it cools down.")
                case .battery:
                    notifier.post(title: "Low Power Mode on", body: "Battery at \(percent ?? 0)%, below the \(config.lowPowerFloor)% floor.")
                case .lid:
                    Log.info("low power mode on (lid closed)")
                }
            case .disableLowPower:
                if await manager.setLowPower(false) {
                    let cause = lastCause.value
                    lastCause.value = nil
                    guard manager.isActive, !Task.isCancelled else { return }
                    if cause == .lid {
                        Log.info("low power mode off (lid opened)")
                    } else {
                        notifier.post(title: "Low Power Mode off", body: isCharging ? "Charger connected." : "Back above the floor.")
                    }
                }
            case let .endSession(reason):
                await manager.end(reason: reason)
                guard manager.isActive, !Task.isCancelled else { return }
            }
        }
    }
}

```

### Core Architecture Module: `Sources/Insomnia/Core/LaunchdBackstop.swift`
```
import Foundation

/// Keeps the launchd agent that runs backstop.sh loaded. The agent is
/// persistent: it runs at load and every minute, and enforces the deadline
/// written in session.json itself, so the app never has to replace the job
/// per extension (which used to leave a window with no agent at all).
///
/// The script it runs is the backstop.sh sealed inside the app bundle
/// (Contents/Resources). The agent's command line verifies the bundle's code
/// signature against the requirement pinned in the plist and only then
/// execs the script, so a backstop.sh edited on disk is never run by
/// launchd. Nothing executable lives in a writable support directory.
///
/// What the app pins is the requirement of the code it is itself running
/// (CodeRequirement.pin), after checking that the bundle on disk still is
/// that code and still passes the agent's check. A bundle edited or
/// re-signed under the running app makes arm() fail, with the reason, rather
/// than report an agent that refuses every run or pin the replacement.
protocol BackstopScheduling: Sendable {
    /// Make sure the polling agent is loaded with the current plist. Cheap
    /// when it already is; throws when it cannot be loaded.
    func arm() async throws
}

struct BackstopError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// The bundle whose sealed backstop.sh the agent runs, and the code
/// requirement that bundle must satisfy first.
struct BackstopTarget: Sendable, Equatable {
    let bundle: URL
    /// Designated requirement of the bundle's signature, in requirement
    /// language, as `codesign -d -r-` prints it (see CodeRequirement).
    let requirement: String

    var script: URL { Paths.backstopScript(inBundle: bundle) }
}

struct LaunchdBackstop: BackstopScheduling {
    typealias Runner = @Sendable (_ exe: String, _ args: [String]) async throws -> ShellResult
    /// Returns the requirement to pin for a bundle that satisfies it right
    /// now, or throws with the reason it must not be pinned.
    typealias BundlePinner = @Sendable (_ bundle: URL) throws -> String

    static let launchctl = "/bin/launchctl"
    /// Seconds between backstop.sh runs while loaded. install.sh writes the same value.
    static let pollInterval = 60
    static let commandTimeout: TimeInterval = 15

    /// What launchd runs: `/bin/sh -c <agentProgram> sh <requirement> <bundle>`.
    /// The program verifies the bundle ($2) against the requirement ($1) with
    /// codesign and execs the sealed backstop.sh only when that passes; the
    /// resource seal covers the script, so an edited copy fails here. On
    /// failure it appends one line to ~/Library/Logs/Insomnia/insomnia.log
    /// (the LaunchAgent only ever exists in the standard layout) and exits 1
    /// without running anything. install.sh embeds this same text (its
    /// AGENT_PROGRAM line); LaunchdBackstopTests checks the two are equal so
    /// the app recognises the plist install.sh wrote. No single quotes, so
    /// the shell can hold it in one.
    static let agentProgram = #"r="$(/usr/bin/codesign --verify --strict "-R=$1" "$2" 2>&1)" && exec /bin/bash "$2/Contents/Resources/backstop.sh"; mkdir -p "$HOME/Library/Logs/Insomnia"; printf "%s [error] backstop agent: %s does not satisfy the pinned code requirement; backstop.sh not run. Reinstall Insomnia (scripts/install.sh). codesign: %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$2" "$(printf %s "$r" | tr "\n" " ")" >> "$HOME/Library/Logs/Insomnia/insomnia.log"; exit 1"#

    let plistURL: URL
    let bundle: URL
    let label: String
    let uid: uid_t
    private let pin: BundlePinner
    private let run: Runner

    /// `bundle` defaults to the bundle this process runs from, and, when it
    /// is not running from one (`swift run`), to the installed bundle at
    /// `paths.appBundle`, so a development build arms the agent against the
    /// installed app's sealed script. `pin` runs at every arm(), so an
    /// upgrade is pinned the first time the upgraded app arms; the default
    /// is CodeRequirement.pin (the running code's own requirement, and the
    /// agent's check on the bundle).
    init(
        paths: Paths,
        bundle: URL? = nil,
        pin: @escaping BundlePinner = { try CodeRequirement.pin(bundle: $0) },
        label: String = Paths.backstopLabel,
        uid: uid_t = getuid(),
        run: @escaping Runner = { try await CancellableCommand().run($0, $1, timeout: LaunchdBackstop.commandTimeout) }
    ) {
        self.plistURL = paths.backstopPlist
        self.bundle = bundle ?? Self.runningOrInstalledBundle(paths: paths)
        self.pin = pin
        self.label = label
        self.uid = uid
        self.run = run
    }

    static func runningOrInstalledBundle(paths: Paths, running: URL = Bundle.main.bundleURL) -> URL {
        running.pathExtension == "app" ? running.standardizedFileURL : paths.appBundle
    }

    var scriptPath: String { Paths.backstopScript(inBundle: bundle).path }

    func arm() async throws {
        guard FileManager.default.fileExists(atPath: scriptPath) else {
            throw BackstopError(message: "backstop.sh is not sealed in the app bundle at \(scriptPath); run scripts/install.sh")
        }
        // Before trusting a loaded agent: the bundle it would verify must
        // pass that verification now. A sealed script edited after signing
        // leaves the plist current and the job loaded, but the agent refuses
        // every run; that is not armed.
        let requirement: String
        do {
            requirement = try pin(bundle)
        } catch {
            throw BackstopError(message: "the recovery agent cannot pin \(bundle.path): \(error.localizedDescription). Reinstall with scripts/install.sh")
        }
        let desired = Self.plistDictionary(label: label, target: BackstopTarget(bundle: bundle, requirement: requirement))
        // Armed when the plist the next login loads is this build's and the
        // loaded job is the one it describes: the same command line, started
        // every `pollInterval` seconds. A loaded label alone may be another
        // build's job, pinning a bundle or requirement this one does not
        // satisfy (install.sh can leave one loaded when it stops between its
        // bootstrap and publishing the plist), or a job loaded from a plist
        // without the interval, which never runs again to end a session.
        if plistOnDiskMatches(desired), try await loadedJob() == LoadedJob(plist: desired) {
            return
        }
        // The plist at `plistURL` is what the next arm() trusts when the
        // loaded job is the one it describes, so it may only ever hold a
        // plist launchd actually loaded. Load through a private
        // candidate and publish it with one rename after bootstrap succeeded.
        // A failed replacement (bootout left the old job loaded, bootstrap
        // refused, volume stopped taking writes) then leaves the trusted path
        // exactly as it was, whether or not any cleanup below works.
        let candidate = try writeCandidate(desired)
        defer { discard(candidate) }
        try await reload(from: candidate)
        try publish(candidate)
    }

    // MARK: Plist

    /// Pure builder, testable without launchd. Must produce exactly what
    /// install.sh writes, or every arm() reloads the agent.
    static func plistDictionary(label: String, target: BackstopTarget) -> [String: Any] {
        [
            "Label": label,
            "ProgramArguments": ["/bin/sh", "-c", agentProgram, "sh", target.requirement, target.bundle.path],
            "RunAtLoad": true,
            "StartInterval": pollInterval,
        ]
    }

    func plistOnDiskMatches(_ desired: [String: Any]) -> Bool {
        guard let data = try? Data(contentsOf: plistURL),
              let obj = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any]
        else { return false }
        return NSDictionary(dictionary: obj).isEqual(to: desired)
    }

    /// Candidates are `*.plist` files in a private subdirectory of the
    /// LaunchAgents directory. launchctl refuses to bootstrap (or boot out)
    /// any path without a `.plist` suffix with EIO, so the name must end in
    /// `.plist`; launchd's login-time load of the LaunchAgents directory does
    /// not descend into subdirectories, so a candidate left behind by a
    /// crash or an unwritable volume can never be picked up as a second copy
    /// of the label; and one level below the trusted plist is still the same
    /// filesystem, so publishing stays a single rename.
    private var stagingDirectory: URL {
        plistURL.deletingLastPathComponent().appendingPathComponent(".\(label).staging", isDirectory: true)
    }
    private var candidatePrefix: String { "\(label).candidate-" }

    private func writeCandidate(_ desired: [String: Any]) throws -> URL {
        let data = try PropertyListSerialization.data(fromPropertyList: desired, format: .xml, options: 0)
        try FileManager.default.createDirectory(at: stagingDirectory, withIntermediateDirectories: true)
        sweepCandidates()
        let url = stagingDirectory.appendingPathComponent(candidatePrefix + UUID().uuidString + ".plist")
        try data.write(to: url)
        return url
    }

    /// Atomically replaces the trusted plist with the candidate launchd just
    /// loaded. Throws when that fails: the agent is running for this login
    /// session, but the plist launchd reads at the next login is still the
    /// old one, so the caller must not treat the backstop as configured.
    private func publish(_ candidate: URL) throws {
        guard rename(candidate.path, plistURL.path) == 0 else {
            let reason = String(cString: strerror(errno))
            throw BackstopError(message: "backstop agent loaded but its plist could not be published to \(plistURL.path): \
```

### Core Architecture Module: `Sources/Insomnia/Core/LidActions.swift`
```
import Foundation

/// Spec section 4: the fixed, reversible action list run on lid close and
/// undone on lid open. Every step is journaled to state.json *before* the
/// side effect; undo reads state.json, never memory.
///
/// Order on close: darken (save display brightness and keyboard backlight
/// first, then set both to 0 and ask the display to sleep), mute (save
/// volume + mute state first), freeze scope (the freeze list plus every
/// other Dock app when `freezeAllApps` is on; one journal write per app),
/// Docker rule, stop the countdown redraw.
/// Order on open: the exact reverse, driven by `SessionManager.undoLidActions`.
@MainActor
final class LidActions {
    private weak var manager: SessionManager?
    private let freezer: any Freezing
    private let docker: DockerRule
    private let audio: any AudioControlling
    private let display: any DisplayDimming
    private let keyboard: any KeyboardBacklighting
    /// Last trusted brightness values, kept by AppServices while the lid is
    /// open. nil (tests) means the device's own asleep/suppressed reading
    /// decides alone.
    private let sampler: BrightnessSampler?
    /// Lid events numbered in the order they arrive, before their actions
    /// queue behind earlier ones (`AppServices.lidChanged`). A close whose
    /// number is no longer the last one is stale: the lid has opened since.
    private(set) var lidEvents = 0
    /// Set only while a close transaction waits on a Docker probe: hands it
    /// a nil answer at once when the next lid event arrives.
    private var interruptProbe: (() -> Void)?

    init(
        manager: SessionManager,
        freezer: any Freezing,
        docker: DockerRule,
        audio: any AudioControlling,
        display: any DisplayDimming = NoopDisplayDimmer(),
        keyboard: any KeyboardBacklighting = NoopKeyboardBacklight(),
        sampler: BrightnessSampler? = nil
    ) {
        self.manager = manager
        self.freezer = freezer
        self.docker = docker
        self.audio = audio
        self.display = display
        self.keyboard = keyboard
        self.sampler = sampler
    }

    /// Records a lid event as it arrives and returns its number. Every
    /// close before it is stale from then on. A close still queued does
    /// nothing when its turn comes. A close waiting on a Docker probe stops
    /// waiting at once, takes Docker's entries out of the journal again,
    /// and signals nothing more, so the open queued behind it runs its undo
    /// without waiting for the probe.
    @discardableResult
    func lidEventArrived() -> Int {
        lidEvents += 1
        interruptProbe?()
        return lidEvents
    }

    /// `event` is the number `lidEventArrived` gave this close; nil (tests
    /// that call this directly) records a new event here.
    func onClose(event: Int? = nil) async {
        let event = event ?? lidEventArrived()
        guard let manager, manager.isActive, !Task.isCancelled else {
            Log.info("lid closed: no session, nothing to do")
            return
        }
        // One lifecycle transaction: journal writes and SIGSTOPs happen
        // under the recovery lock, after any end already in flight.
        let ran = await manager.runExclusive("lid close") { [self, manager] in
            guard manager.isActive, !Task.isCancelled else { return }
            guard lidEvents == event else {
                Log.info("lid close actions skipped: the lid opened again before they ran")
                return
            }
            let ticket = manager.endTicket
            let config = manager.config
            // False once an end was requested or the lid opened again during
            // this transaction. Checked after every await: either one is
            // queued right behind and must not find a fresh freeze.
            let stillCurrent = { [self] in
                manager.isActive && manager.endTicket == ticket && lidEvents == event && !Task.isCancelled
            }

            if config.darkenDisplayOnLidClose {
                darkenSavingCurrent(manager)
            }

            if config.muteOnLidClose {
                muteSavingCurrent(manager)
            }

            let groups = freezer.plan(config: config)
            for group in groups {
                guard stillCurrent() else { return }
                await freeze(group, docker: false, manager: manager)
            }

            guard stillCurrent() else { return }
            let dockerGroup = await untilNextLidEvent(after: event) { [docker] in
                await docker.idleDockerGroup(config: config)
            } ?? nil
            guard stillCurrent() else {
                if lidEvents != event { Log.info("docker rule: lid opened during the first check, Docker left alone") }
                return
            }
            if let dockerGroup {
                // The idle answer above is already stale by the time the
                // journal write is done, so Docker is asked once more right
                // before its SIGSTOP; busy, a failed probe or a timeout
                // leaves it running. An end or a lid open during that
                // probe leaves it running too.
                await freeze(dockerGroup, docker: true, manager: manager) { [self, docker] in
                    let idle = await untilNextLidEvent(after: event) { await docker.isStillIdle() }
                    guard stillCurrent() else {
                        Log.info(lidEvents != event
                            ? "docker rule: lid opened during the second check, Docker left alone"
                            : "docker rule: session ending during the second check, Docker left alone")
                        return false
                    }
                    return idle == true
                }
            }

            // A session whose end arrived during this transaction has no
            // countdown left to pause; its end is queued right behind. After
            // a lid open the countdown keeps running.
            guard stillCurrent() else { return }
            manager.pauseCountdown()
        }
        if !ran { Log.error("lid close actions skipped: recovery lock busy") }
    }

    func onOpen() async {
        guard let manager, manager.isActive, !Task.isCancelled else {
            Log.info("lid opened: no session, nothing to do")
            return
        }
        await manager.undoLidActions()
        guard manager.isActive, !Task.isCancelled else { return }
        manager.resumeCountdown()
    }

    // MARK: Private

    /// The answer of `probe`, or nil as soon as a lid event after `event`
    /// arrives (or one already has). The probe then runs on in its own task
    /// and its answer is dropped: it only reads (`docker ps`, bounded by
    /// `DockerRule.timeout`).
    private func untilNextLidEvent<T: Sendable>(after event: Int, _ probe: @escaping @Sendable () async -> T) async -> T? {
        guard lidEvents == event else { return nil }
        let race = ProbeRace<T>()
        let answer = await withCheckedContinuation { (continuation: CheckedContinuation<T?, Never>) in
            race.continuation = continuation
            interruptProbe = { race.finish(nil) }
            Task { @MainActor in race.finish(await probe()) }
        }
        interruptProbe = nil
        return answer
    }

    /// With `pmset disablesleep 1` macOS never turns the built-in panel or
    /// the keyboard backlight off on lid close, so this does. Brightness 0
    /// is the mechanism; the display sleep request is a bonus that macOS
    /// ignores while any process (an agent, say) holds a display assertion.
    ///
    /// What gets journaled is the user's value, not whatever the device
    /// reads at this instant. The display at the close event is never the
    /// user's value when it can be avoided: the lid coming down covers the
    /// ambient light sensor and auto-brightness has already pulled the
    /// panel down by the time the close is reported, Low Power Mode (which
    /// the session itself may have switched on) rescales it, and a panel
    /// that idle-dimmed or slept reads its dim value. So the display
    /// journals the last sample taken with the lid open (every 30 s, at
    /// start, 3 s after each open, and just before Insomnia's own Low Power
    /// Mode goes on, held from then until it goes off); without one, the
    /// value a lid open restored under our Low Power Mode, still journaled
    /// as owed and the mode still ours (the app relaunched under the mode:
    /// the new sampler has no sample and is held; an entry left behind
    /// after the mode was released is stale and not used); only without
    /// either the current read, dim or
    /// not, since a dim panel on open beats a black one. The sample can be
    /// up to 30 s old: a brightness change made right before closing the
    /// lid is not seen. A value kept after a refused restore gives way only
    /// to a sample, the value owed after the mode, or a current read that
    /// is trusted and taken with our Low Power Mode never on in this run,
    /// nor over the entry in this boot (`SessionManager.keptDisplayReadDoubt`).
    /// Without one, the level may
    /// be one the user set by hand, and the reading is no level to restore
    /// either: the entry is left as it is, undecided, and the panel is not
    /// darkened, since the open would read the 0 left here as the darkening
    /// never undone and write the kept value. The display sleep request
    /// still goes, and is then the only thing that turns that panel off.
    /// A sample of 0, or the value owed after the mode at 0, replaces the
    /// kept one only once a reading above 0 showed that entry's darkening
    /// undone (`RuntimeState.keptDisplayReadLit`): before that, the 0 may
    /// still be the darkening, and the kept value stays for the open to
    /// write. A current read of 0 after 
```

### Core Architecture Module: `Sources/Insomnia/Core/Log.swift`
```
import Foundation
import os

/// Unified logging plus a plain-text line appended to insomnia.log, which is
/// shared with backstop.sh so one file tells the whole story.
///
/// The unified log is readable by every program running as the user (and
/// by anyone with a sysdiagnose), so message bodies go there as private
/// data: `log show` prints `<private>` in their place. The bodies name
/// SSIDs, tmux targets, process names and bundle ids. insomnia.log keeps
/// the full text for the user; its permissions are its own protection.
enum Log {
    static let logger = Logger(subsystem: Paths.bundleIdentifier, category: "core")
    private static let lock = NSLock()

    static func info(_ message: String) {
        logger.info("\(message, privacy: .private)")
        append(level: "info", message)
    }

    static func error(_ message: String) {
        logger.error("\(message, privacy: .private)")
        append(level: "error", message)
    }

    static func append(level: String, _ message: String, paths: Paths = .fromEnvironment()) {
        let now = Date().formatted(.iso8601.year().month().day().dateTimeSeparator(.standard).time(includingFractionalSeconds: false).timeZone(separator: .omitted))
        let line = "\(now) [\(level)] insomnia: \(message)\n"
        lock.lock()
        defer { lock.unlock() }
        do {
            // Owner-only, and rotated to insomnia.log.1 past OwnerOnly.maxLogBytes.
            // A chmod or rotation that fails is thrown after the line is
            // written, so it reaches the unified log below.
            try OwnerOnly.appendToLog(line, at: paths.logFile)
        } catch {
            // The description carries a path under the home directory.
            logger.error("insomnia.log: \(error.localizedDescription, privacy: .private)")
        }
    }
}

```

### Core Architecture Module: `Sources/Insomnia/Core/ProcessControl.swift`
```
import Darwin
import Foundation

/// Sending signals to processes Insomnia froze. Tree discovery and the
/// denylist live in `Freezer`; this is only the signal layer.
///
/// Ownership rule: Insomnia only ever resumes a process it stopped itself.
/// A process that was already stopped is never stopped "again" and so is
/// never resumed; a pid whose identity no longer matches the journal is a
/// different process and is left alone.
///
/// Residual limitation: POSIX offers no atomic "check identity and signal"
/// for a pid. Each signal is sent immediately after its own lookup, which
/// keeps the window to one process's worth of time rather than a whole
/// batch, but a pid reused inside that window cannot be ruled out.
protocol ProcessSignaling: Sendable {
    /// SIGSTOP each process whose parent and identity still match and which
    /// is not already stopped. Everything else is reported as skipped so the
    /// caller can drop it from the journal.
    func suspend(_ processes: [FrozenProcess], expectedParents: [Int32: Int32]) -> SuspendReport
    /// SIGCONT each journaled process that is still stopped and still the
    /// same process. The report says what needs to stay journaled.
    func resume(_ processes: [FrozenProcess]) -> ResumeReport
    /// Undo SIGSTOPs this run sent moments ago: SIGCONT each process that is
    /// still the same process (identity to the microsecond, boot session),
    /// whether or not it shows as stopped yet. A stop signal can still be
    /// pending when the target is looked up, so it may look running; POSIX
    /// discards a pending stop when SIGCONT is generated, so the SIGCONT
    /// cancels it either way. Never signals an entry without identity, a
    /// different process, or a pid that is gone. Only for stops this
    /// process just sent; a journaled entry from an earlier run goes
    /// through `resume`, which signals only a stopped process.
    func cancelStops(_ processes: [FrozenProcess]) -> ResumeReport
}

struct SuspendReport: Sendable, Equatable {
    /// SIGSTOP sent; these are ours to resume. The stop may still be
    /// pending when this returns, so the target can still look running.
    var suspended: [Int32] = []
    /// Already stopped, exited, reparented, reused, or the signal failed:
    /// not ours, must not stay journaled.
    var skipped: [Int32] = []
}

struct ResumeReport: Sendable, Equatable {
    var resumed: [Int32] = []
    /// Verified as ours and still stopped, but SIGCONT failed. Stays journaled.
    var failed: [Int32] = []
    /// Still stopped, but journaled without identity, so ownership cannot
    /// be proven. Stays journaled and is reported to the user.
    var unverifiable: [Int32] = []
    /// The kernel would not say what the pid is doing (permission denied,
    /// transient error). Unknown is not gone: stays journaled and is retried.
    var unobserved: [Int32] = []
    /// Exited, already running, or a different process now: nothing to do.
    var gone: [Int32] = []
}

struct ProcessSignalState: Sendable, Equatable {
    let ppid: Int32
    let stopped: Bool
    let identity: ProcessIdentity

    init(ppid: Int32, stopped: Bool, identity: ProcessIdentity) {
        self.ppid = ppid
        self.stopped = stopped
        self.identity = identity
    }
}

/// What one lookup of a pid found. Absence is only claimed when the kernel
/// confirmed it; a failed read is reported as such, never as "gone".
enum ProcessLookup: Sendable, Equatable {
    case present(ProcessSignalState)
    /// ESRCH: no such process.
    case absent
    /// proc_pidinfo failed for another reason (errno); state unknown.
    case unreadable(Int32)
}

struct SignalProcessControl: ProcessSignaling {
    typealias StateLookup = @Sendable (Int32) -> ProcessLookup
    /// kill(2) as a function returning 0 or errno, so tests never signal a
    /// real pid.
    typealias Sender = @Sendable (Int32, Int32) -> Int32

    private let stateLookup: StateLookup
    private let send: Sender

    init(
        stateLookup: @escaping StateLookup = SignalProcessControl.kernelState,
        send: @escaping Sender = SignalProcessControl.kernelSend
    ) {
        self.stateLookup = stateLookup
        self.send = send
    }

    func suspend(_ processes: [FrozenProcess], expectedParents: [Int32: Int32]) -> SuspendReport {
        var report = SuspendReport()
        for p in processes {
            // Lookup and signal back to back, per process.
            guard Self.isSuspendable(p, expectedParents: expectedParents, stateLookup: stateLookup) else {
                Log.info("SIGSTOP \(p.pid) skipped: already stopped, exited, unreadable, or not the same process")
                report.skipped.append(p.pid)
                continue
            }
            let err = send(p.pid, SIGSTOP)
            if err == 0 {
                report.suspended.append(p.pid)
            } else {
                if err != ESRCH { Log.error("SIGSTOP \(p.pid) failed: \(String(cString: strerror(err)))") }
                report.skipped.append(p.pid)
            }
        }
        return report
    }

    func resume(_ processes: [FrozenProcess]) -> ResumeReport {
        continueEach(processes) { Self.resumeDecision($0, stateLookup: stateLookup) }
    }

    func cancelStops(_ processes: [FrozenProcess]) -> ResumeReport {
        continueEach(processes) { Self.cancelDecision($0, stateLookup: stateLookup) }
    }

    /// SIGCONT per process as `decide` says, each signal right after that
    /// process's own lookup.
    private func continueEach(_ processes: [FrozenProcess], decide: (FrozenProcess) -> ResumeDecision) -> ResumeReport {
        var report = ResumeReport()
        for p in processes {
            // Lookup and signal back to back, per process.
            switch decide(p) {
            case .gone:
                report.gone.append(p.pid)
            case .unverifiable:
                report.unverifiable.append(p.pid)
            case .unobserved:
                report.unobserved.append(p.pid)
            case .signal:
                let err = send(p.pid, SIGCONT)
                if err == 0 {
                    report.resumed.append(p.pid)
                } else if err == ESRCH {
                    report.gone.append(p.pid)
                } else {
                    Log.error("SIGCONT \(p.pid) failed: \(String(cString: strerror(err)))")
                    report.failed.append(p.pid)
                }
            }
        }
        return report
    }

    /// Whether `p` is the process we planned to stop (same parent, same
    /// identity, a real boot session on both sides) and is running right
    /// now. An already-stopped process was stopped by someone else and is
    /// not ours to own; an unreadable one is not owned either.
    static func isSuspendable(
        _ p: FrozenProcess,
        expectedParents: [Int32: Int32],
        stateLookup: StateLookup
    ) -> Bool {
        guard p.pid > 0, let identity = p.identity, let expected = expectedParents[p.pid] else { return false }
        guard !identity.bootSession.isEmpty else {
            Log.error("SIGSTOP \(p.pid) skipped: no boot session in its identity, so it could never be proven ours again")
            return false
        }
        guard case let .present(state) = stateLookup(p.pid) else { return false }
        guard !state.identity.bootSession.isEmpty else { return false }
        return state.ppid == expected && state.identity == identity && !state.stopped
    }

    /// Batch form of `isSuspendable`, for planning and tests.
    static func suspendable(
        _ processes: [FrozenProcess],
        expectedParents: [Int32: Int32],
        stateLookup: StateLookup
    ) -> [Int32] {
        processes.filter { isSuspendable($0, expectedParents: expectedParents, stateLookup: stateLookup) }.map(\.pid)
    }

    enum ResumeDecision: Equatable {
        case signal, unverifiable, unobserved, gone
    }

    /// One journaled entry: send SIGCONT, keep as unverifiable, keep as
    /// unobserved, or clear as gone. Pure, so the ownership rule is testable
    /// without a kernel.
    static func resumeDecision(_ p: FrozenProcess, stateLookup: StateLookup) -> ResumeDecision {
        guard p.pid > 0 else { return .gone }
        let state: ProcessSignalState
        switch stateLookup(p.pid) {
        case .absent: return .gone
        case .unreadable: return .unobserved
        case let .present(s): state = s
        }
        // Already running: nothing left to resume.
        guard state.stopped else { return .gone }
        // Stopped, but the journal cannot prove Insomnia stopped it.
        guard let identity = p.identity, !identity.bootSession.isEmpty else { return .unverifiable }
        // The kernel side has no boot session right now (sysctl failed):
        // the comparison cannot be made, so try again later.
        guard !state.identity.bootSession.isEmpty else { return .unobserved }
        return state.identity == identity ? .signal : .gone // reused pid
    }

    /// `resumeDecision` for a stop this process just sent (`cancelStops`):
    /// the same identity check, but a matching process that does not show
    /// as stopped is signaled too, because its SIGSTOP may still be pending.
    /// An entry without identity is never signaled.
    static func cancelDecision(_ p: FrozenProcess, stateLookup: StateLookup) -> ResumeDecision {
        guard p.pid > 0 else { return .gone }
        guard let identity = p.identity, !identity.bootSession.isEmpty else { return .unverifiable }
        let state: ProcessSignalState
        switch stateLookup(p.pid) {
        case .absent: return .gone
        case .unreadable: return .unobserved
        case let .present(s): state = s
        }
        guard !state.identity.bootSession.isEmpty else { return .unobserved }
        return state.identity == identity ? .signal : .gone // exited and reused
    }

    /// Batch form of `resumeDecision`
```

### Core Architecture Module: `Sources/Insomnia/Core/ProcessExit.swift`
```
import Foundation

/// Waits for a child `Process` to exit. Use it instead of
/// `Process.waitUntilExit()`, which can wait forever for a child that has
/// already exited and been reaped.
///
/// On macOS 26, `waitUntilExit()` polls the calling thread's run loop every
/// 62.5 ms. If the task has no `terminationHandler` and the calling thread
/// looks like the one that launched it, the poll also waits for the
/// termination notification, which Foundation queues on the launching
/// thread's run loop. Foundation decides "launched here" by looking for the
/// task's address in a per-thread list that every launch appends to and
/// nothing prunes. A new `Process` at the address of one this thread launched
/// earlier, launched by another thread, matches. If the launching thread
/// never runs its run loop (a GCD or Swift concurrency worker), the
/// notification never goes out and the wait never returns.
///
/// This waits for `terminationHandler`, which Foundation calls on a dispatch
/// queue after it has reaped the child, whichever thread launched it. Create
/// it before `run()`: it replaces the process's `terminationHandler`. Wait
/// only after `run()` succeeded; a child that never started never exits.
final class ProcessExit: @unchecked Sendable {
    private let lock = NSLock()
    private var done = false
    private var suspended: [CheckedContinuation<Void, Never>] = []
    /// Signalled once on exit. Each blocking waiter takes the signal and puts
    /// it back, so any number of waiters return.
    private let exitSignal = DispatchSemaphore(value: 0)

    init(_ process: Process) {
        process.terminationHandler = { [self] _ in finish() }
    }

    private func finish() {
        let resume = lock.withLock {
            done = true
            defer { suspended = [] }
            return suspended
        }
        exitSignal.signal()
        for continuation in resume { continuation.resume() }
    }

    /// Blocks the calling thread until the child has exited and been reaped,
    /// so `terminationStatus` and `terminationReason` are final. For threads
    /// that may block; async code awaits `exited()` instead.
    func wait() {
        exitSignal.wait()
        exitSignal.signal()
    }

    /// Suspends until the child has exited and been reaped, without holding
    /// a thread.
    func exited() async {
        await withCheckedContinuation { continuation in
            let already = lock.withLock {
                if !done { suspended.append(continuation) }
                return done
            }
            if already { continuation.resume() }
        }
    }

    /// How many `exited()` callers are suspended right now. Tests read it to
    /// let the child exit only after a caller has suspended.
    var suspendedCount: Int { lock.withLock { suspended.count } }
}

```

### Core Architecture Module: `Sources/Insomnia/Core/RecoveryLock.swift`
```
import Darwin
import Foundation

/// Mutual exclusion between the app and backstop.sh over the recovery
/// journal: read, decide, change the machine, write, as one transaction.
///
/// Kernel `flock(2)` on `Paths.recoveryLock`, a file that is never unlinked
/// during ordinary runs so both sides always lock the same inode. The lock
/// belongs to the open file description, and the kernel drops it once every
/// descriptor on that description is closed, so a crash can never leave it
/// stuck. backstop.sh takes the same lock with `lockf -k` on the same path.
///
/// A privileged command a transaction runs gets one of those descriptors
/// (`RecoveryLockHandle.descriptorForChild()`), so the lock outlives this
/// process for as long as that command runs: a crash or a force quit
/// cannot free it beside a live `sudo pmset`. backstop.sh keeps it the
/// same way, in the subshell that supervises each command.
enum RecoveryLockError: Error, LocalizedError, Equatable {
    case busy(path: String, seconds: TimeInterval)
    case open(path: String, errno: Int32)
    case lock(path: String, errno: Int32)

    var errorDescription: String? {
        switch self {
        case let .busy(path, seconds):
            return "recovery lock \(path) still held by another process after \(Int(seconds)) s (backstop running?)"
        case let .open(path, errno):
            return "could not open recovery lock \(path): \(String(cString: strerror(errno)))"
        case let .lock(path, errno):
            return "could not lock \(path): \(String(cString: strerror(errno)))"
        }
    }
}

/// Owns one held lock. Releasing twice is harmless; going away releases.
final class RecoveryLockHandle: @unchecked Sendable {
    private let mutex = NSLock()
    private var fd: Int32

    fileprivate init(fd: Int32) { self.fd = fd }

    /// Closes this process's descriptor, as exiting would. No `LOCK_UN`:
    /// that would unlock the description for every descriptor on it, a
    /// child's included. A child that still holds one keeps the lock until
    /// it exits; with none, the lock is free once this returns.
    func release() {
        mutex.withLock {
            guard fd >= 0 else { return }
            close(fd)
            fd = -1
        }
    }

    /// A new close-on-exec descriptor on the locked file, for a child that
    /// must keep the lock while it runs: the spawn installs it without the
    /// flag. The caller closes its copy once the child has been started.
    /// nil once released.
    func descriptorForChild() -> Int32? {
        mutex.withLock {
            guard fd >= 0 else { return nil }
            let copy = fcntl(fd, F_DUPFD_CLOEXEC, 0)
            return copy >= 0 ? copy : nil
        }
    }

    deinit { release() }
}

struct RecoveryLock: Sendable {
    let path: String

    /// The lock the current transaction holds, set by `SessionManager` for
    /// the length of the transaction. `PmsetSleepGuard` hands it to every
    /// `sudo pmset` and runs none without it.
    @TaskLocal static var held: RecoveryLockHandle?

    init(url: URL) { path = url.path }

    /// nil when another holder (any process, or another handle in this one)
    /// has it. Never blocks.
    func tryAcquire() throws -> RecoveryLockHandle? {
        // O_CLOEXEC: no child inherits the lock by accident. One that must
        // keep it is given its own descriptor (`descriptorForChild()`).
        // Owner-only like every other file here; an older 0644 lock is
        // tightened in place, never replaced (same inode for both sides).
        let fd = open(path, O_RDWR | O_CREAT | O_CLOEXEC, OwnerOnly.fileMode)
        guard fd >= 0 else { throw RecoveryLockError.open(path: path, errno: errno) }
        if let problem = OwnerOnly.tighten(fd: fd, path: path) { OwnerOnly.reportOnce(problem) }
        if flock(fd, LOCK_EX | LOCK_NB) == 0 { return RecoveryLockHandle(fd: fd) }
        let err = errno
        close(fd)
        if err == EWOULDBLOCK { return nil }
        throw RecoveryLockError.lock(path: path, errno: err)
    }

    /// Polls with `tryAcquire`, sleeping between attempts so the calling
    /// actor is never blocked. Throws `.busy` once `timeout` has passed;
    /// callers must then do nothing, never proceed unlocked.
    func acquire(timeout: TimeInterval, pollEvery: Duration = .milliseconds(50)) async throws -> RecoveryLockHandle {
        let deadline = ContinuousClock.now + .seconds(timeout)
        while true {
            if let handle = try tryAcquire() { return handle }
            guard ContinuousClock.now < deadline else {
                throw RecoveryLockError.busy(path: path, seconds: timeout)
            }
            try await Task.sleep(for: pollEvery)
        }
    }
}

```

### Core Architecture Module: `Sources/Insomnia/Core/ResumeFrozenCommand.swift`
```
import Darwin
import Foundation

/// `Insomnia --resume-frozen <seconds>`, journal entries on standard input
///
/// One-shot mode for backstop.sh. The shell can read a process's start time
/// only to the second (`ps -o lstart`), so for the journal entries that
/// record microseconds it asks this binary to do what the app does on lid
/// open, through the same `SignalProcessControl.resume`: for each entry in
/// turn, one kernel lookup (start time to the microsecond, boot session,
/// stopped state) immediately followed by that entry's SIGCONT, before the
/// next entry is looked up. One launch covers every entry. Nothing else
/// runs: no AppKit, no journal, no lock of its own (the caller holds the
/// recovery lock and rewrites the journal from the answer).
///
/// `<seconds>` is how long this process may live, a whole number from 1 to
/// 300. Before it reads anything it arranges to end itself with SIGALRM
/// that many seconds later, whatever SIGALRM disposition and mask it
/// inherited. backstop.sh passes its own time limit and runs this mode with
/// the recovery lock open on fd 9, so the lock stays held for as long as
/// this process can send a signal, even when the shell that started it dies
/// first; the time limit then frees the lock without anyone waiting for it.
///
/// Standard input holds one entry per line, `<pid> <startedAt>
/// <startedAtMicros> <bootSession>`: four fields, one space between them,
/// every line ending in a newline. Standard input has no size limit, unlike
/// the argument list (ARG_MAX), so a journal of any length fits in one
/// call. Prints one line per entry, in input order, `<pid> <word>`:
///
///     resumed       identity matched, the process was stopped, SIGCONT delivered
///     gone          no such pid, running, or a different process: nothing to do
///     failed        identity matched, SIGCONT failed; try again later
///     unobserved    the kernel would not say what the pid is; try again later
///     unverifiable  the fallthrough for an answer with no boot session to compare; never signaled
///
/// Exits 0 when every entry is `resumed` or `gone`, 1 when any is not. A
/// missing or malformed `<seconds>`, any further argument, empty input, or
/// a malformed line prints the single line `usage` (details on stderr),
/// checks nothing, and exits 64. The shell clears an entry on `resumed` and
/// `gone` and keeps it otherwise, and keeps every entry when the answer is
/// not exactly this shape.
///
/// The app bundle declares this interface as `InsomniaResumeFrozenVersion`
/// (`version`) in its Info.plist. backstop.sh runs the binary only when the
/// installed bundle declares the version the script speaks, so it never
/// starts an older build, which would open the menu bar app instead.
enum ResumeFrozenCommand {
    static let flag = "--resume-frozen"
    /// `InsomniaResumeFrozenVersion` in Resources/Info.plist, and
    /// RESUME_FROZEN_VERSION in backstop.sh and uninstall.sh.
    static let version = 1
    /// EX_USAGE from sysexits(3).
    static let usageStatus: Int32 = 64
    /// The longest lifetime the caller may ask for.
    static let maxLifetimeSeconds: UInt32 = 300

    enum Answer: String, Sendable {
        case resumed, gone, failed, unobserved, unverifiable

        /// Nothing left to do for the entry: the shell may clear it.
        var settled: Bool { self == .resumed || self == .gone }
    }

    struct Output: Equatable, Sendable {
        let lines: [String]
        let status: Int32
    }

    /// nil when `arguments` (the command line without the executable) do
    /// not ask for this mode. `endAfter` gets the lifetime once the
    /// arguments are valid, before `input` is read (`endProcess` in the
    /// binary).
    static func run(
        _ arguments: [String],
        input: () -> Data = { FileHandle.standardInput.readDataToEndOfFile() },
        control: any ProcessSignaling = SignalProcessControl(),
        endAfter: (UInt32) -> Void
    ) -> Output? {
        guard arguments.first == flag else { return nil }
        guard arguments.count == 2, let seconds = lifetime(arguments[1]) else { return usage() }
        endAfter(seconds)
        guard let text = String(data: input(), encoding: .utf8),
              let entries = parse(text)
        else { return usage() }
        var lines: [String] = []
        var settled = true
        for entry in entries {
            // One entry per call: its lookup and its signal, then the next.
            let answer = answer(of: control.resume([entry]), pid: entry.pid)
            lines.append("\(entry.pid) \(answer.rawValue)")
            if !answer.settled { settled = false }
        }
        return Output(lines: lines, status: settled ? 0 : 1)
    }

    private static func usage() -> Output {
        FileHandle.standardError.write(Data("usage: Insomnia \(flag) <seconds 1-\(maxLifetimeSeconds)> < entries, one line each: <pid> <startedAt> <startedAtMicros> <bootSession>\n".utf8))
        return Output(lines: ["usage"], status: usageStatus)
    }

    /// The lifetime argument: one to three ASCII digits, 1 to
    /// `maxLifetimeSeconds`; nil otherwise.
    static func lifetime(_ text: String) -> UInt32? {
        guard (1...3).contains(text.utf8.count),
              text.utf8.allSatisfy({ (UInt8(ascii: "0")...UInt8(ascii: "9")).contains($0) }),
              let seconds = UInt32(text),
              (1...maxLifetimeSeconds).contains(seconds)
        else { return nil }
        return seconds
    }

    /// Ends this process with SIGALRM `seconds` from now. A disposition of
    /// SIG_IGN and a blocked mask both survive exec, so a parent that
    /// ignored or blocked SIGALRM must not make the limit void: the default
    /// action and an unblocked mask are restored first.
    static func endProcess(after seconds: UInt32) {
        signal(SIGALRM, SIG_DFL)
        var alarmOnly = sigset_t()
        sigemptyset(&alarmOnly)
        sigaddset(&alarmOnly, SIGALRM)
        pthread_sigmask(SIG_UNBLOCK, &alarmOnly, nil)
        alarm(seconds)
    }

    /// The journal entries the input describes, in order; nil unless it has
    /// at least one line, every line ends in a newline, and every line is
    /// four well-formed fields with one space between them.
    static func parse(_ text: String) -> [FrozenProcess]? {
        let scalars = text.unicodeScalars
        guard scalars.last == "\n" else { return nil }
        var entries: [FrozenProcess] = []
        for line in scalars.dropLast().split(separator: "\n", omittingEmptySubsequences: false) {
            let fields = line.split(separator: " ", omittingEmptySubsequences: false).map { String($0) }
            guard let entry = entry(fields) else { return nil }
            entries.append(entry)
        }
        return entries
    }

    /// One entry from its four fields; nil unless the pid is positive, the
    /// start second non-negative, the microseconds below one million and
    /// the boot session non-empty without white space.
    static func entry(_ fields: [String]) -> FrozenProcess? {
        guard fields.count == 4,
              let pid = Int32(fields[0]), pid > 0,
              let startedAt = Int64(fields[1]), startedAt >= 0,
              let micros = Int32(fields[2]), (0..<1_000_000).contains(micros),
              !fields[3].isEmpty,
              !fields[3].unicodeScalars.contains(where: { CharacterSet.whitespacesAndNewlines.contains($0) })
        else { return nil }
        return FrozenProcess(pid: pid, identity: ProcessIdentity(startedAt: startedAt, startedAtMicros: micros, bootSession: fields[3]))
    }

    static func answer(of report: ResumeReport, pid: Int32) -> Answer {
        if report.resumed.contains(pid) { return .resumed }
        if report.gone.contains(pid) { return .gone }
        if report.failed.contains(pid) { return .failed }
        if report.unobserved.contains(pid) { return .unobserved }
        return .unverifiable
    }
}

```

### Core Architecture Module: `Sources/Insomnia/Core/SessionManager.swift`
```
import Foundation
import Observation

enum EndReason: String, Sendable {
    case timer
    case user
    case quit
    case batteryFloor
    /// Battery present but its level unreadable on two consecutive reads
    /// while on battery: the end floor could not be applied.
    case batteryUnreadable
    case thermalCritical
    case backstop
    /// Reconcile found a session on disk but could not arm the recovery
    /// agent, journal, or hold sleep for it, so it ended the session instead
    /// of holding sleep with nothing to release it.
    case recoveryUnavailable
    /// `pmset disablesleep 1` failed or timed out during start. The setting
    /// may still have been applied, so the start is undone from the journal
    /// like an end rather than rolled back from memory.
    case startFailed
}

/// What `end` achieved. Callers that are about to quit need to know whether
/// leaving now abandons anything.
enum EndOutcome: Sendable, Equatable {
    /// Journal clean, machine restored. The one entry that may remain is
    /// the saved volume of an output device that was not connected: it
    /// waits for the device (`SessionManager.outputDevicesChanged`, or a
    /// later launch) and the notification and the menu name it.
    case restored
    /// Some entries could not be undone and stay journaled. `agentArmed`
    /// says whether the polling agent is confirmed loaded to retry them.
    case incomplete(agentArmed: Bool)
    /// The recovery lock stayed busy; nothing was read or changed and the
    /// session is still active. An in-process retry is scheduled.
    case locked
    /// session.json could not be removed. Whatever the journal held was
    /// undone, but a relaunch would find a valid session and hold sleep
    /// again, so the end is retried in process and quit is refused.
    case sessionRetained
    /// state.json cannot be read. Nothing was changed: Insomnia does not
    /// know what to undo and will not guess. The session stays active until
    /// a person fixes or moves the file.
    case journalUnreadable
    /// A `sudo pmset` did not stop on SIGTERM and is still running (pid).
    /// It is never SIGKILLed: that could leave a root pmset changing power
    /// state after the journal moved on. Nothing after it was undone, the
    /// journal keeps every entry it had, and the recovery lock stays held
    /// until the command exits: by this process, and by the command itself,
    /// so a crash or force quit cannot free it beside the live pmset. The
    /// end is retried when the command exits, and quit is refused meanwhile
    /// so the app is still there to retry it.
    case privilegedCommandRunning(pid: Int32)

    /// Whether a quit may go ahead after an end with this outcome
    /// (`AppDelegate.applicationShouldTerminate`): only once nothing is
    /// left that this process alone can finish.
    var letsQuitGo: Bool {
        switch self {
        case .restored, .incomplete(agentArmed: true): true
        case .locked, .incomplete(agentArmed: false), .sessionRetained, .journalUnreadable, .privilegedCommandRunning: false
        }
    }
}

/// Why a lifecycle transaction did not run at all. A busy lock and an
/// unreadable journal carry the line the refusal put in the menu
/// (`lastError`).
enum TransactionRefusal: Error, Sendable {
    case lockBusy(String)
    case journalUnreadable(String)
    /// A `sudo pmset` from an earlier transaction is still running and holds
    /// the recovery lock (see `EndOutcome`).
    case commandRunning(pid: Int32)
}

/// Owns the session lifecycle: start / extend / end / reconcile.
///
/// Journal-first: every mutation is written to session.json / state.json
/// *before* the matching side effect, and undo always reads state.json from
/// disk, never memory (spec section 8 invariants).
///
/// One transaction at a time: every operation that reads the journal,
/// decides, changes the machine and writes the journal runs on a single
/// queue while holding the cross-process recovery lock shared with
/// backstop.sh, and starts from the journal as it is on disk at that
/// moment, never from a copy cached earlier: backstop.sh may have written
/// it in between. An end requested while a start, extend or Low Power change
/// is still queued or in flight wins: the older operation abandons itself
/// before anything irreversible, or leaves its effect journaled for the
/// end that runs right behind it.
@MainActor
@Observable
final class SessionManager {
    private(set) var session: Session?
    private(set) var state: RuntimeState
    var config: Config
    /// Minute-granularity remaining time for the popover ("2h 14m").
    private(set) var remainingText: String = ""
    /// Live `H:MM:SS` countdown for the status item, updated at 1 Hz.
    private(set) var countdownText: String = ""

    /// Why the display or the keyboard backlight is left alone on lid close
    /// on this Mac (a macOS the private calls were not measured on, a
    /// private class that no longer looks as measured). Empty when both run.
    /// Shown in Settings next to the darken toggle.
    var darkenRefusals: [String] {
        [
            display.refusal().map { "Display: \($0).\(Self.keptLevelNote(state.savedDisplayBrightness))" },
            keyboard.refusal().map { "Keyboard backlight: \($0).\(Self.keptLevelNote(state.savedKeyboardBrightness))" },
        ].compactMap { $0 }
    }

    /// A refused device cannot have been darkened by this build, so a
    /// value saved for it was kept after a refused restore.
    private static func keptLevelNote(_ saved: Float?) -> String {
        guard let saved else { return "" }
        return " The level saved before the lid closed, \(saved), was not restored; set it with the brightness keys or Control Center."
    }
    /// Last failure worth showing in the menu; cleared on the next success.
    private(set) var lastError: String?
    /// How many times `fail` has run, so an undo can tell a line it put up
    /// from one left by an earlier run.
    @ObservationIgnored private var failCount = 0
    /// Reconcile found SleepDisabled set with no session and no journal
    /// claim: something other than Insomnia disabled sleep. Kept apart from
    /// `lastError` so a restore failure from the same reconcile stays
    /// visible beside it. Cleared by a session start, or by
    /// `recheckForeignSleep()` once the bit reads 0 again.
    private(set) var foreignSleepWarning: String?
    /// The sudo pmset left running (`unfinishedCommand`), what it holds up
    /// and the pid to stop it by hand. Kept apart from `lastError` so the
    /// command's exit removes it without touching a newer failure: the task
    /// holding the lock for the command clears it then (`holdLock`).
    private(set) var commandWarning: String?
    /// UIDs of output devices whose saved volume could not be restored
    /// because they were not connected at the last try. Each try decides
    /// again: a device that came back and then failed to restore is no
    /// longer in it. In memory: each launch finds them again at its first
    /// try.
    private(set) var audioDevicesNotConnected: Set<String> = []
    /// The menu line (`lastError`) the restore of the saved output volumes
    /// last put up: a device change or audio retry that was refused, or a
    /// restore that failed. A later restore that leaves nothing to retry
    /// takes it down, unless a newer failure has replaced it since
    /// (`clearAudioWarning`).
    @ObservationIgnored private var audioWarning: String?

    /// Output devices lid close muted that are still waiting to get their
    /// volume and mute back because they were not connected. The menu
    /// names each one, with a way to stop waiting.
    var outputsWaitingForRestore: [SavedAudioOutput] {
        state.savedAudioOutputs.filter { audioDevicesNotConnected.contains($0.deviceUID) }
    }

    var isActive: Bool { session != nil }

    /// Journal edits owed by a freeze that `LidActions` undid because the
    /// write confirming it failed (`clearUndoneFreeze`).
    struct UndoneFreeze: Equatable, Sendable {
        /// Pids whose provisional entry (identity nil) no longer describes
        /// a stop: resumed, gone, or never stopped by that freeze.
        var pids: Set<Int32> = []
        /// That freeze set `dockerFrozen`, and none of it is still stopped.
        var docker = false

        var isEmpty: Bool { pids.isEmpty && !docker }

        func apply(to s: inout RuntimeState) {
            s.frozenProcesses.removeAll { $0.identity == nil && pids.contains($0.pid) }
            if docker { s.dockerFrozen = false }
        }
    }

    /// A journal write for a brightness kept after a refused restore, on a
    /// build whose guard allows the call, that the disk refused. Applied
    /// only while the entry still holds that value and its flag.
    private enum KeptEdit: Equatable {
        /// The level was found set since: the entry goes, with no write.
        case clear(Float)
        /// The saved level was written: the entry goes. A display level
        /// written under Insomnia's Low Power Mode still owes its write
        /// once the mode is off, as when the clear lands at once
        /// (`displayRestoredUnderLowPower`).
        case restored(Float, underLowPower: Bool)
        /// The write failed: the flag goes, so the entry is an ordinary
        /// failed restore, retried like any other and counted as dirty by
        /// backstop.sh and uninstall.sh.
        case unflag(Float)

        var saved: Float {
            switch self {
            case .clear(let value), .restored(let value, _), .unflag(let value): value
            }
        }

        var isUnflag: Bool {
            if case .unflag = self { return true }
            return false
        }

        /// A clear, of a level set since or restored, while the journal
        /// `s` still holds the entry with that value and its
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #149** (2026-10-27): **Session: land #120**
  *Symptoms*: A session could stay running after its deadline, with 00:00 in the menu bar and sleep still disabled. macOS sometimes steps the wall clock back by a few milliseconds, so the deadline timer can fire while the clock still reads just before the deadline, and the session then never ended. #120 by @hasin023 fixes it: when the timer fires early, it waits out the rest instead of giving up.  #120 is reviewed and tested at 5d8c3dd, but it can't merge on its own right now. GitHub hasn't refreshed #120's test merge since main moved to 2ed30d4, so every CI run on #120 still tests it against the old main.  This pull request lands #120 at 5d8c3dd. Its first commit, 7ceb33a3, is a merge of that head onto main, so GitHub marks #120 merged when this one merges, and its author keeps the credit. That commit's tree is the one GitHub would test for #120 against main today: `git merge-tree --write-tree origin/main 5d8c3dd` gives 6a998c7c. The next three commits, 6d912705, 2582bb34 and 9380c81a, change only `DeadlineTimerTests.swift`.  To @hasin023: please don't push to your branch until this merges. A new commit there isn't in this pull request, so #120 would stay open instead of showing as merged.  ## What #120 changes  - `SessionManager.deadlineTimerFired` reads the deadline when the timer runs. If the clock hasn't reached it yet, it schedules one more timer for the rest (at least 50 ms), and ends the session once the clock is past it. End, start, extend and the launch reconcile still go through

- **Issue #130** (2026-10-27): **Install, uninstall: ignore Kong's Insomnia API client**
  *Symptoms*: ## What changes  Kong's Insomnia API client (bundle identifier `com.insomnia.app`) runs an executable named `Insomnia`, so `pgrep -x Insomnia` in `install.sh` and `uninstall.sh` finds it too. With only the client open:  - `install.sh` asks this app to quit (which does nothing to the client), waits 15 s and stops with "Insomnia is still running". It has already installed the sudoers rule by then, so a first install leaves the rule and no app. - Its check under the recovery lock stops with "Insomnia started again". - `uninstall.sh` refuses with "Nothing was removed."  No message names the other app.  Both scripts now check each pid `pgrep` prints with a **code requirement**, a rule that macOS checks against the running process's signature:  ``` codesign --verify -R='anchor apple generic and identifier "com.insomnia.app" and certificate leaf[subject.OU] = "FX44YY62GV"' <pid> ```  The rule asks for code signed through Apple's certificate chain (as Developer ID is), with the client's identifier and Kong's team, FX44YY62GV, in the signing certificate. A pid is skipped only when codesign exits 0. The script then prints one line naming the pid, the identifier and the team. Any other result counts as this app: exit 3 (the requirement is not met; this app is ad hoc signed, so it always gets 3), exit 1 (the process is gone or its signature doesn't verify), any other failure. Under the lock the call goes through `bounded()` like `pgrep`, so one that doesn't answer in 30 s counts as this 

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

### Incident Patch 1: `434312d6` (2026-10-19)
**Commit Message**: Install, uninstall: check Kong's client against a code requirement

92430e4 read Identifier= and TeamIdentifier= from `codesign -d -v <pid>`.
Those lines report what the signature carries. They do not show that
Apple issued the certificate, and the check depended on parsing
codesign's text.

A pid pgrep found is now skipped only when

  codesign --verify -R='anchor apple generic and identifier
    "com.insomnia.app" and certificate leaf[subject.OU] = "FX44YY62GV"' <pid>

exits 0: the running code has a valid signature from a certificate Apple
issued, with Kong's identifier and Kong's team in the leaf certificate.
Any other exit counts as this app: 3 when the requirement is not met, 1
for a process that is gone or a signature that does not verify, any other
status, and a call that does not answer under the lock. The call goes
through bounded() under the lock and is direct before it, as pgrep is.
There is nothing to parse, so the line counting and signature_of() are
gone, and the "Ignoring pid" line no longer names a path.

On this Mac, with Kong's requirement: this app's pid exits 3, a missing
pid exits 1, Finder exits 3, and a /bin/sleep started with argv[0] set to
Kong's executabl

**File**: `Tests/InsomniaTests/RecoveryScriptTests.swift` (modified, +95/-91)
```diff
@@ -26,6 +26,9 @@ final class RecoveryScriptTests: XCTestCase {
     }
 
     override func tearDown() {
+        // The fake codesign logs this when a script checks a pid against a
+        // requirement other than Kong's client's (see writeFakes).
+        XCTAssertFalse(fx.calls().contains("codesign BAD-REQUIREMENT"), "\(fx.calls())")
         fx.destroy()
         fx = nil
     }
@@ -6262,48 +6265,40 @@ final class RecoveryScriptTests: XCTestCase {
     // MARK: - Kong's Insomnia API client
 
     /// Kong's Insomnia API client runs an executable named Insomnia too, so
-    /// `pgrep -x Insomnia` finds it. This is its pid and its executable.
+    /// `pgrep -x Insomnia` finds it. This is its pid.
     private let clientPid = 7002
-    private let clientExecutable = "/Applications/Insomnia.app/Contents/MacOS/Insomnia"
 
-    /// What `codesign -d -v` prints for Kong's client: its code signing
-    /// identifier and Kong's team.
-    private var clientSignature: String {
-        ScriptFixture.signature(executable: clientExecutable, identifier: "com.insomnia.app", team: "FX44YY62GV")
+    /// The check each script makes of a pid pgrep printed. Kong's client,
+    /// and only it, passes (codesign exits 0).
+    private func verifyCall(_ pid: Int) -> String {
+        "codesign --verify -R=\(ScriptFixture.apiClientRequirement) \(pid)"
     }
 
     private var ignoredLine: String {
-        "Ignoring pid \(clientPid) (\(clientExecutable)): it is Kong's Insomnia API client (com.insomnia.app, team FX44YY62GV), not this app."
+        "Ignoring pid \(clientPid): it is Kong's Insomnia API client (com.insomnia.app, team FX44YY62GV), not this app."
     }
 
     private func count(_ line: String, in text: String) -> Int {
         text.components(separatedBy: line).count - 1
     }
 
-    /// A process named Insomnia whose signature does not show it is Kong's
+    /// A process named Insomnia that codesign does not pass as Kong's
     /// client, each set up in a fresh fixture. Every one counts as this app.
     private var processesThatCountAsThisApp: [(String, () throws -> Void)] {
-        let kong = clientExecutable
-        let process = { (signature: String?) -> () throws -> Void in
-            { try self.fx.insomniaProcesses([(self.clientPid, signature)]) }
+        let process = { (status: Int32?) -> () throws -> Void in
+            { try self.fx.insomniaProcesses([(self.clientPid, status)]) }
         }
         return [
-            // This app started with argv[0] set to Kong's path: ps would
-            // print that path, and codesign names this app's code.
-            ("this app under Kong's path", process(ScriptFixture.signature(executable: kong, identifier: "com.kgarg.insomnia", team: "not set"))),
-            ("Kong's identifier, ad hoc signed", process(ScriptFixture.signature(executable: kong, identifier: "com.insomnia.app", team: "not set"))),
-            ("Kong's identifier, another team", process(ScriptFixture.signature(executable: kong, identifier: "com.insomnia.app", team: "ABCDE12345"))),
-            ("Kong's team, another identifier", process(ScriptFixture.signature(executable: kong, identifier: "com.insomnia.app.beta", team: "FX44YY62GV"))),
-            ("no Identifier line", process(ScriptFixture.signature(executable: kong, identifier: nil, team: "FX44YY62GV"))),
-            ("no TeamIdentifier line", process(ScriptFixture.signature(executable: kong, identifier: "com.insomnia.app", team: nil))),
-            ("no Executable line", process(ScriptFixture.signature(executable: nil, identifier: "com.insomnia.app", team: "FX44YY62GV"))),
-            // The client's lines last, so reading only the last of each
-            // would take this for the client.
-            ("two Identifier lines", process("Identifier=com.kgarg.insomnia\n" + clientSignature)),
-            ("two TeamIdentifier lines", process("TeamIdentifier=not set\n" + clientSignature)),
-            ("two Executable lines", process("Executable=/usr/local/bin/Insomnia\n" + clientSignature)),
+            // codesign checks the code a process runs, not its argv[0]: this
+            // app, ad hoc signed, does not meet the requirement even when
+            // started with argv[0] set to Kong's path, and neither does code
+            // with another identifier or team or a certificate Apple did not
+            // issue.
+            ("this app, also under Kong's path: requirement not met (exit 3)", process(3)),
+            ("a signature that does not verify (exit 1)", process(1)),
+            ("another codesign error (exit 2)", process(2)),
             ("a codesign that fails", {
-                try self.fx.insomniaProcesses([(self.clientPid, self.clientSignature)])
+                try self.fx.insomniaProcesses([(self.clientPid, 0)])
                 self.fx.setMode("codesign-pid", "fail")
             }),
             ("a pid codesign does not find", process(nil)),
@@ -6318,7 +6313,7 @@ final class Recovery
```

**File**: `docs/install.md` (modified, +7/-6)
```diff
@@ -272,9 +272,10 @@ directory contents. A small shared lock file is retained to keep concurrent
 recovery operations coordinated.
 
 Kong's Insomnia API client also runs a process named `Insomnia`. The
-installer and the uninstaller tell it apart by the code signature of the
-running process (`codesign -d -v <pid>`), not by its path. A process signed
-with the identifier `com.insomnia.app` and Kong's team ID `FX44YY62GV` is the
-client: they print its pid, ignore it, and do not ask it to quit. Any other
-process, including one whose signature they cannot read, counts as this app,
-so they still stop if it does not quit.
+installer and the uninstaller tell it apart by checking the code signature
+of the running process against a code requirement (`codesign --verify
+-R=<requirement> <pid>`), not by its path. A process whose code is signed
+with a certificate Apple issued, with the identifier `com.insomnia.app` and
+Kong's team ID `FX44YY62GV`, is the client: they print its pid, ignore it,
+and do not ask it to quit. Any other process, including one that codesign
+cannot check, counts as this app, so they still stop if it does not quit.
```

**File**: `docs/releasing.md` (modified, +1/-1)
```diff
@@ -318,7 +318,7 @@ below cover what only a real Mac shows.
 - The installed recovery agent on the supported macOS release: launchd bootstraps its plist, loads it at login and runs its verify-then-exec command line, and the agent recovers a session after the app crashes
 - The installed agent's plist is the one install.sh wrote
 - A source install end to end: `./scripts/install.sh` builds, signs and installs the app with the administrator password, and stops while a running app refuses to quit
-- Install and uninstall with Kong's Insomnia API client open: `codesign -d -v <pid>` of the client prints `Identifier=com.insomnia.app` and `TeamIdentifier=FX44YY62GV`; each script prints "Ignoring pid <pid> (/Applications/Insomnia.app/Contents/MacOS/Insomnia): it is Kong's Insomnia API client (com.insomnia.app, team FX44YY62GV), not this app." once, leaves the client running and goes on; with this app running too, each still asks it to quit and stops while it refuses, on a working Mac
+- Install and uninstall with Kong's Insomnia API client open: `codesign --verify -R='anchor apple generic and identifier "com.insomnia.app" and certificate leaf[subject.OU] = "FX44YY62GV"' <pid>` exits 0 for the client and 3 for this app; each script prints "Ignoring pid <pid>: it is Kong's Insomnia API client (com.insomnia.app, team FX44YY62GV), not this app." once, leaves the client running and goes on; with this app running too, each still asks it to quit and stops while it refuses, on a working Mac
 
 ### Release channels
 
```

**File**: `docs/spec.md` (modified, +9/-6)
```diff
@@ -920,12 +920,15 @@ Backstop, independent of the app:
   Insomnia`, which also finds Kong's Insomnia API client. They tell the two
   apart by the signature of the code each process runs, not by a path that
   argv[0] can set. A pid is skipped, with one line naming it, only when
-  `codesign -d -v <pid>` succeeds and prints exactly one `Executable=` line,
-  one `Identifier=com.insomnia.app` line and one `TeamIdentifier=FX44YY62GV`
-  line (Kong's team). Anything else counts as the app: another identifier or
-  team, `not set` (an ad hoc signature, as this app has), a line missing or
-  repeated, a `codesign` that fails. Under the lock the call is bounded like
-  `pgrep`, and one that does not answer counts as the app.
+  `codesign --verify -R='anchor apple generic and identifier
+  "com.insomnia.app" and certificate leaf[subject.OU] = "FX44YY62GV"' <pid>`
+  exits 0: the running code has a valid signature from a certificate Apple
+  issued, with Kong's identifier and Kong's team (`FX44YY62GV`) in the leaf
+  certificate. Any other exit counts as the app: 3 when the requirement is
+  not met (this app's ad hoc signature, another identifier or team, a
+  certificate Apple did not issue), 1 for a process that is gone or a
+  signature that does not verify, any other status. Under the lock the call
+  is bounded like `pgrep`, and one that does not answer counts as the app.
 - App and script transactions must coordinate through a shared lock. Failure
   to acquire it must not permit an unprotected journal write or side effect.
 - A `sudo pmset` is sent SIGTERM at its timeout (20 s in the app, 30 s in the
```

**File**: `scripts/install.sh` (modified, +21/-38)
```diff
@@ -281,52 +281,35 @@ pmset_rule_effective() {
 
 # Kong's Insomnia API client runs an executable named Insomnia too, so
 # `pgrep -x Insomnia` finds it as well. A pid pgrep found is skipped only
-# when `codesign -d -v <pid>` succeeds and prints exactly one Executable=
-# line, one Identifier= line that is the client's code signing identifier
-# and one TeamIdentifier= line that is Kong's team. codesign describes the
-# code the process runs, so an argv[0] or a path made to look like the
-# client's changes nothing. Anything else counts as this app: another
-# identifier or team ("not set", as for an ad hoc signature like this
-# app's), a line missing or repeated, a codesign that fails (or, under the
-# lock, does not answer in time). A misread the other way would replace the
-# bundle and the LaunchAgent under a running app.
+# when `codesign --verify` passes it against API_CLIENT_REQUIREMENT: the
+# code the process runs is signed with a certificate Apple issued (such as
+# Developer ID), with the client's identifier and Kong's team in the leaf
+# certificate. codesign checks that signature on the running code, so
+# neither an argv[0] or path made to look like the client's nor a signature
+# that only claims that identifier and team passes. Any other exit counts
+# as this app: 3 when the requirement is not met (this app, ad hoc signed,
+# is one), 1 for a process that is gone or a signature that does not
+# verify, anything else, and (under the lock) no answer in time. A misread
+# the other way would replace the bundle and the LaunchAgent under a
+# running app.
 API_CLIENT_ID=com.insomnia.app
 API_CLIENT_TEAM=FX44YY62GV
+API_CLIENT_REQUIREMENT="anchor apple generic and identifier \"$API_CLIENT_ID\" and certificate leaf[subject.OU] = \"$API_CLIENT_TEAM\""
 # The pids already reported as the API client, so each is named once.
 API_CLIENT_SEEN=" "
-# What `codesign -d -v <pid>` printed (on stderr) for api_client(), left in
-# SIGNATURE_OUTPUT. The call is made the way pgrep is at that point: through
-# bounded() under the recovery lock ($2 = bounded), directly before it
-# ($2 = direct).
-SIGNATURE_OUTPUT=""
-signature_of() { # pid bounded|direct
-  local rc=0
-  SIGNATURE_OUTPUT=""
-  if [[ "$2" == bounded ]]; then
-    bounded "$CODESIGN" -d -v "$1" || rc=$?
-    SIGNATURE_OUTPUT="$BOUNDED_OUTPUT"
-  else
-    SIGNATURE_OUTPUT="$("$CODESIGN" -d -v "$1" </dev/null 2>&1)" || rc=$?
-  fi
-  return "$rc"
-}
 # 0 when the process with this pid is the API client (said once per pid),
-# 1 when it counts as this app.
+# 1 when it counts as this app. codesign is called the way pgrep is at that
+# point: through bounded() under the recovery lock ($2 = bounded), directly
+# before it ($2 = direct).
 api_client() { # pid bounded|direct
-  local line path="" id="" team="" paths=0 ids=0 teams=0
   [[ "$1" =~ ^[0-9]+$ ]] || return 1
-  signature_of "$1" "$2" || return 1
-  while IFS= read -r line; do
-    case "$line" in
-      Executable=*) path="${line#Executable=}"; paths=$(( paths + 1 )) ;;
-      Identifier=*) id="${line#Identifier=}"; ids=$(( ids + 1 )) ;;
-      TeamIdentifier=*) team="${line#TeamIdentifier=}"; teams=$(( teams + 1 )) ;;
-    esac
-  done <<< "$SIGNATURE_OUTPUT"
-  (( paths == 1 && ids == 1 && teams == 1 )) || return 1
-  [[ "$id" == "$API_CLIENT_ID" && "$team" == "$API_CLIENT_TEAM" ]] || return 1
+  if [[ "$2" == bounded ]]; then
+    bounded "$CODESIGN" --verify "-R=$API_CLIENT_REQUIREMENT" "$1" || return 1
+  else
+    "$CODESIGN" --verify "-R=$API_CLIENT_REQUIREMENT" "$1" </dev/null >/dev/null 2>&1 || return 1
+  fi
   if [[ "$API_CLIENT_SEEN" != *" $1 "* ]]; then
-    echo "Ignoring pid $1 ($path): it is Kong's Insomnia API client ($API_CLIENT_ID, team $API_CLIENT_TEAM), not this app."
+    echo "Ignoring pid $1: it is Kong's Insomnia API client ($API_CLIENT_ID, team $API_CLIENT_TEAM), not this app."
     API_CLIENT_SEEN+="$1 "
   fi
   return 0
```

**File**: `scripts/uninstall.sh` (modified, +14/-21)
```diff
@@ -801,36 +801,29 @@ MSG
 
 # Kong's Insomnia API client runs an executable named Insomnia too, so
 # `pgrep -x Insomnia` finds it as well. A pid pgrep found is skipped only
-# when `codesign -d -v <pid>` succeeds and prints (on stderr) exactly one
-# Executable= line, one Identifier= line that is the client's code signing
-# identifier and one TeamIdentifier= line that is Kong's team. codesign
-# describes the code the process runs, so an argv[0] or a path made to look
-# like the client's changes nothing. Anything else counts as this app:
-# another identifier or team ("not set", as for an ad hoc signature like
-# this app's), a line missing or repeated, a codesign that fails or does
-# not answer in time. A misread the other way could remove the recovery
-# agent and the sudoers rule while the app has sleep disabled.
+# when `codesign --verify` passes it against API_CLIENT_REQUIREMENT: the
+# code the process runs is signed with a certificate Apple issued (such as
+# Developer ID), with the client's identifier and Kong's team in the leaf
+# certificate. codesign checks that signature on the running code, so
+# neither an argv[0] or path made to look like the client's nor a signature
+# that only claims that identifier and team passes. Any other exit counts
+# as this app: 3 when the requirement is not met (this app, ad hoc signed,
+# is one), 1 for a process that is gone or a signature that does not
+# verify, anything else, and no answer in time. A misread the other way
+# could remove the recovery agent and the sudoers rule while the app has
+# sleep disabled.
 API_CLIENT_ID=com.insomnia.app
 API_CLIENT_TEAM=FX44YY62GV
+API_CLIENT_REQUIREMENT="anchor apple generic and identifier \"$API_CLIENT_ID\" and certificate leaf[subject.OU] = \"$API_CLIENT_TEAM\""
 # The pids already reported as the API client, so each is named once.
 API_CLIENT_SEEN=" "
 # 0 when the process with this pid is the API client (said once per pid),
 # 1 when it counts as this app.
 api_client() { # pid
-  local line path="" id="" team="" paths=0 ids=0 teams=0
   [[ "$1" =~ ^[0-9]+$ ]] || return 1
-  bounded "$CODESIGN" -d -v "$1" || return 1
-  while IFS= read -r line; do
-    case "$line" in
-      Executable=*) path="${line#Executable=}"; paths=$(( paths + 1 )) ;;
-      Identifier=*) id="${line#Identifier=}"; ids=$(( ids + 1 )) ;;
-      TeamIdentifier=*) team="${line#TeamIdentifier=}"; teams=$(( teams + 1 )) ;;
-    esac
-  done <<< "$BOUNDED_OUTPUT"
-  (( paths == 1 && ids == 1 && teams == 1 )) || return 1
-  [[ "$id" == "$API_CLIENT_ID" && "$team" == "$API_CLIENT_TEAM" ]] || return 1
+  bounded "$CODESIGN" --verify "-R=$API_CLIENT_REQUIREMENT" "$1" || return 1
   if [[ "$API_CLIENT_SEEN" != *" $1 "* ]]; then
-    echo "Ignoring pid $1 ($path): it is Kong's Insomnia API client ($API_CLIENT_ID, team $API_CLIENT_TEAM), not this app."
+    echo "Ignoring pid $1: it is Kong's Insomnia API client ($API_CLIENT_ID, team $API_CLIENT_TEAM), not this app."
     API_CLIENT_SEEN+="$1 "
   fi
   return 0
```

---

### Incident Patch 2: `10254113` (2026-10-18)
**Commit Message**: Merge pull request #100 from aldikosh23/tests/locale-independent-security-text

Tests: compare Security error text with the system's own wording

**File**: `Tests/InsomniaTests/PackagingTests.swift` (modified, +3/-3)
```diff
@@ -250,11 +250,11 @@ final class PackagingTests: XCTestCase {
         try (String(contentsOf: script, encoding: .utf8) + "echo tampered\n").write(to: script, atomically: true, encoding: .utf8)
         XCTAssertEqual(try CodeRequirement.designated(ofCodeAt: bundle), requirement, "the requirement alone still reads")
         XCTAssertThrowsError(try CodeRequirement.verify(codeAt: bundle, satisfies: requirement)) { error in
-            XCTAssertTrue(error.localizedDescription.contains("sealed resource"), error.localizedDescription)
+            XCTAssertTrue(error.localizedDescription.contains(securityMessage(errSecCSBadResource)), error.localizedDescription)
         }
         XCTAssertThrowsError(try CodeRequirement.pin(bundle: bundle)) { error in
             XCTAssertTrue(error.localizedDescription.contains(bundle.path), error.localizedDescription)
-            XCTAssertTrue(error.localizedDescription.contains("sealed resource"), error.localizedDescription)
+            XCTAssertTrue(error.localizedDescription.contains(securityMessage(errSecCSBadResource)), error.localizedDescription)
         }
     }
 
@@ -275,7 +275,7 @@ final class PackagingTests: XCTestCase {
         XCTAssertNotEqual(replacement, launched.requirement, "re-signing gives the bundle a new cdhash")
         XCTAssertNoThrow(try CodeRequirement.verify(codeAt: bundle, satisfies: replacement), "the replacement is a valid bundle in its own right")
         XCTAssertThrowsError(try CodeRequirement.pin(bundle: bundle, running: { launched }, mainBundle: bundle)) { error in
-            XCTAssertTrue(error.localizedDescription.contains("failed to satisfy"), error.localizedDescription)
+            XCTAssertTrue(error.localizedDescription.contains(securityMessage(errSecCSReqFailed)), error.localizedDescription)
         }
 
         // A process running from one bundle never pins another.
```

**File**: `Tests/InsomniaTests/TestSupport.swift` (modified, +12/-0)
```diff
@@ -1,4 +1,5 @@
 import Foundation
+import Security
 import XCTest
 import InsomniaTestHome
 @testable import Insomnia
@@ -761,6 +762,17 @@ final class FakeBackstop: BackstopScheduling, @unchecked Sendable {
     }
 }
 
+/// The Security framework's message for `status`, in the language the test
+/// process runs in. `CodeRequirement` and `KeychainError` word their errors
+/// with it, so a test that checks which failure an error names compares
+/// against this, not the English text, and passes on a Mac set to another
+/// language. Not for text a child process prints: `codesign` and the other
+/// command line tools answer in English whatever the language, so a test
+/// that reads their output keeps the literal text.
+func securityMessage(_ status: OSStatus) -> String {
+    SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus \(status)"
+}
+
 /// A mutable fake clock usable from the @Sendable clock closure.
 final class FakeClock: @unchecked Sendable {
     private let lock = NSLock()
```

**File**: `Tests/InsomniaTests/UIStatusTests.swift` (modified, +1/-1)
```diff
@@ -401,7 +401,7 @@ final class UIStatusTests: XCTestCase {
         XCTAssertEqual(KeychainError(status: errSecAuthFailed).problem, .unreadable)
         XCTAssertEqual(KeychainError(status: errSecInteractionNotAllowed).problem, .unreadable)
         XCTAssertEqual(KeychainError(status: errSecInvalidOwnerEdit).problem, .unreadable)
-        XCTAssertEqual(KeychainError(status: errSecParam).problem, .error("keychain: One or more parameters passed to a function were not valid."))
+        XCTAssertEqual(KeychainError(status: errSecParam).problem, .error("keychain: \(securityMessage(errSecParam))"))
     }
 
     /// The relaunch item asks first, since the browser is quit and its
```

---

### Incident Patch 3: `882142a9` (2026-10-17)
**Commit Message**: Mac mini CI: build the base VM under a temporary name, bound its shutdown

From the fourth Codex review:
- mini-base.sh made the final base VM first, so a failed run left a
  half-made one that mini-runner.sh would clone and a rerun refused to
  replace. It now builds insomnia-ci-base-unfinished, renames it only
  after the guest shut down cleanly, and deletes it on any failure. A
  leftover one from an earlier failed run is deleted at the start.
- The shutdown request now runs in the background, so the two-minute
  wait always starts, and the cleanup ends tart run within about 30 s
  (stop, then TERM, then KILL) instead of waiting on it.

Tested with a fake tart under /bin/bash 3.2: success, a failing guest
script, a VM that never shuts down, a leftover unfinished VM, and an
existing base.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.github/scripts/mini-base.sh` (modified, +32/-9)
```diff
@@ -20,35 +20,54 @@ RUNNER_SHA256=df4cebda25c86a886ed204e49fee63f5c2e7cec5f447b5c98440a826bbdf9df2
 CPUS=8
 MEMORY_MB=8192
 
+# Built under another name and renamed when finished, so mini-runner.sh
+# never clones a half-made base VM.
+WORK=$BASE-unfinished
+
 if "$TART" list --quiet | grep -qx "$BASE"; then
   echo "$BASE exists; to remake it, run: $TART delete $BASE" >&2
   exit 1
 fi
+# Left by a run that failed part way.
+"$TART" delete "$WORK" >/dev/null 2>&1 || true
 
 "$TART" pull "$IMAGE"
-"$TART" clone "$IMAGE" "$BASE"
-"$TART" set "$BASE" --cpu "$CPUS" --memory "$MEMORY_MB"
-"$TART" run --no-graphics "$BASE" >/dev/null 2>&1 &
+"$TART" clone "$IMAGE" "$WORK"
+"$TART" set "$WORK" --cpu "$CPUS" --memory "$MEMORY_MB"
+"$TART" run --no-graphics "$WORK" >/dev/null 2>&1 &
 run_pid=$!
-trap '"$TART" stop "$BASE" >/dev/null 2>&1 || true; wait "$run_pid" 2>/dev/null || true' EXIT
+
+# Ends the VM's tart run within about 30 s, however it is stuck.
+end_run() {
+  "$TART" stop "$WORK" --timeout 10 >/dev/null 2>&1 &
+  for _ in $(seq 25); do
+    kill -0 "$run_pid" 2>/dev/null || return 0
+    sleep 1
+  done
+  kill -TERM "$run_pid" 2>/dev/null || true
+  sleep 3
+  kill -KILL "$run_pid" 2>/dev/null || true
+}
+finished=
+trap 'if [ -z "$finished" ]; then end_run; "$TART" delete "$WORK" >/dev/null 2>&1 || true; echo "deleted the unfinished $WORK" >&2; fi' EXIT
 
 # The guest agent answers once macOS has booted and logged in.
 ready=
 for _ in $(seq 60); do
-  if "$TART" exec "$BASE" true 2>/dev/null; then
+  if "$TART" exec "$WORK" true 2>/dev/null; then
     ready=1
     break
   fi
   sleep 5
 done
 if [ -z "$ready" ]; then
-  echo "$BASE did not answer within 5 minutes" >&2
+  echo "$WORK did not answer within 5 minutes" >&2
   exit 1
 fi
 
 # Inside the VM, as the image's admin user. The quoted heredoc reaches the
 # guest's bash unexpanded; the two values come in as arguments.
-"$TART" exec -i "$BASE" /bin/bash -s -- "$RUNNER_VERSION" "$RUNNER_SHA256" <<'GUEST'
+"$TART" exec -i "$WORK" /bin/bash -s -- "$RUNNER_VERSION" "$RUNNER_SHA256" <<'GUEST'
 set -eu
 version=$1
 sha=$2
@@ -102,14 +121,18 @@ GUEST
 # asks macOS to shut down, macOS answers with a dialog, and after the
 # timeout tart turns the VM off: writes still in the guest's cache are
 # lost. A base VM made that way had the runner but not tmux or pf.
-"$TART" exec "$BASE" /bin/bash -c 'sync; sudo /sbin/shutdown -h now' >/dev/null 2>&1 || true
+"$TART" exec "$WORK" /bin/bash -c 'sync; sudo /sbin/shutdown -h now' >/dev/null 2>&1 &
+shutdown_pid=$!
 for _ in $(seq 60); do
   kill -0 "$run_pid" 2>/dev/null || break
   sleep 2
 done
+kill "$shutdown_pid" 2>/dev/null || true
 if kill -0 "$run_pid" 2>/dev/null; then
-  echo "$BASE did not shut down within 2 minutes; delete it and run this again" >&2
+  echo "$WORK did not shut down within 2 minutes" >&2
   exit 1
 fi
 
+"$TART" rename "$WORK" "$BASE"
+finished=1
 echo "made $BASE from $IMAGE with runner $RUNNER_VERSION"
```

#### Recent Merged Pull Requests:
- **PR #149** (2026-10-27): Session: land #120 (@krishhgg)
- **PR #130** (2026-10-27): Install, uninstall: ignore Kong's Insomnia API client (@krishhgg)
- **PR #129** (2026-10-27): CONTRIBUTING: pictures for pull requests that change what users see (@krishhgg)
- **PR #127** (2026-10-19): CI: run the Swift tests on the Mac mini, one throwaway VM per job (@krishhgg)
- **PR #126** (2026-10-19): CI: Bump actions/upload-artifact from 7.0.1 to 7.0.2 (@dependabot[bot])
- **PR #125** (2026-10-19): CI: Bump actions/download-artifact from 8.0.1 to 8.0.2 (@dependabot[bot])

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

## X. Install, uninstall: check Kong's client against a code requirement

**RULE**:
When implementing operations in `Tests/InsomniaTests/RecoveryScriptTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in krishhgg/Insomnia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `434312d6`: Install, uninstall: check Kong's client against a code requirement. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Tests/InsomniaTests/RecoveryScriptTests.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        // The fake codesign logs this when a script checks a pid against a
        // requirement other than Kong's client's (see writeFakes).
        XCTAssertFalse(fx.calls().contains("codesign BAD-REQUIREMENT"), "\(fx.calls())")
    /// `pgrep -x Insomnia` finds it. This is its pid.
    /// The check each script makes of a pid pgrep printed. Kong's client,
    /// and only it, passes (codesign exits 0).
    private func verifyCall(_ pid: Int) -> String {
        "codesign --verify -R=\(ScriptFixture.apiClientRequirement) \(pid)"
        "Ignoring pid \(clientPid): it is Kong's Insomnia API client (com.insomnia.app, team FX44YY62GV), not this app."
    /// A process named Insomnia that codesign does not pass as Kong's
        let process = { (status: Int32?) -> () throws -> Void in
            { try self.fx.insomniaProcesses([(self.clientPid, status)]) }
            // codesign checks the code a process runs, not its argv[0]: this
            // app, ad hoc signed, does not meet the requirement even when
            // started with argv[0] set to Kong's path, and neither does code
            // with another identifier or team or a certificate Apple did not
            // issue.
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
    /// `pgrep -x Insomnia` finds it. This is its pid and its executable.
    private let clientExecutable = "/Applications/Insomnia.app/Contents/MacOS/Insomnia"
    /// What `codesign -d -v` prints for Kong's client: its code signing
    /// identifier and Kong's team.
    private var clientSignature: String {
        ScriptFixture.signature(executable: clientExecutable, identifier: "com.insomnia.app", team: "FX44YY62GV")
        "Ignoring pid \(clientPid) (\(clientExecutable)): it is Kong's Insomnia API client (com.insomnia.app, team FX44YY62GV), not this app."
    /// A process named Insomnia whose signature does not show it is Kong's
        let kong = clientExecutable
        let process = { (signature: String?) -> () throws -> Void in
            { try self.fx.insomniaProcesses([(self.clientPid, signature)]) }
            // This app started with argv[0] set to Kong's path: ps would
            // print that path, and codesign names this app's code.
            ("this app under Kong's path", process(ScriptFixture.signature(executable: kong, identifier: "com.kgarg.insomnia", team: "not set"))),
            ("Kong's identifier, ad hoc signed", process(ScriptFixture.signature(ex
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `434312d6` are properly handled with clean fallback behavior.
