> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jithin-sabu-purge-app-learnings.md`  
> **Source**: github ([https://github.com/jithin-sabu/purge-app](https://github.com/jithin-sabu/purge-app))  
> **Source Version**: `384b5b6c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T07:05:12.104Z  
> **Learning ID**: `learn-github-jithin-sabu-purge-app`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): jithin-sabu/purge-app

> **Canonical Artifact**: `07_PROJECT_LEARNING/jithin-sabu-purge-app-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jithin-sabu/purge-app](https://github.com/jithin-sabu/purge-app))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T07:05:11.987Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jithin-sabu/purge-app`
- **Description**: Free up your Mac. Safely. A free, open-source native Mac app that clears the cache and junk your Mac piles up on its own. Files go to the Trash by default, so you can put them back.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1991 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `PurgeAssetWorker/PurgeAssetWorkerMain.swift`
```
import Foundation

/// Throwaway child process for Purge's two private Apple Intelligence calls
/// (issue #133): releasing the model sets and asking for them again. Purge runs
/// it as `io.getpurge.assetworker <op> <json>` from its own bundle, once per
/// call, and reads one JSON object back on stdout. A changed private interface
/// crashes this process, which Purge reports as such, and never Purge itself.
///
/// Ops: `load`, `asset-type` {assetSet}, `reset` {assetSets}, `unsubscribe`
/// {subscriber, names}, `subscribe` {subscriber, subscriptions: [{name,
/// usageAliasCandidates, assetSetUsages}]}, where each alias lists the values
/// to try in order and gets the first this macOS knows. Every op refuses what it is not given:
/// a reset with no sets is never sent, because the service reads that as all.
@main
enum PurgeAssetWorkerMain {
    static func main() {
        let arguments = Array(CommandLine.arguments.dropFirst())
        guard let op = arguments.first else {
            reply(["ok": false, "error": "no op"])
            return
        }
        let input: [String: Any]
        if arguments.count > 1, let data = arguments[1].data(using: .utf8),
           let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            input = object
        } else {
            input = [:]
        }
        do {
            reply(["ok": true, "result": try perform(op, input)])
        } catch {
            var failure: [String: Any] = ["ok": false, "error": describe(error)]
            // The domain and code go apart from the text, so Purge can put the
            // well-known ones in plain words and keep the whole text for the
            // details (#343). The worker's own refusals have neither.
            if !(error is UnifiedAssetCalls.CallError) {
                let nsError = error as NSError
                failure["errorDomain"] = nsError.domain
                failure["errorCode"] = nsError.code
                failure["errorSummary"] = summary(nsError)
            }
            reply(failure)
        }
    }

    private static func reply(_ object: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: jsonSafe(object)) else {
            FileHandle.standardOutput.write(Data("{\"ok\":false,\"error\":\"reply could not be encoded\"}".utf8))
            return
        }
        FileHandle.standardOutput.write(data)
    }

    /// The error without its userInfo: short enough for one line.
    private static func summary(_ error: NSError) -> String {
        "\(error.domain) \(error.code): \(error.localizedDescription)"
    }

    private static func describe(_ error: Error) -> String {
        if let failure = error as? UnifiedAssetCalls.CallError { return failure.description }
        let nsError = error as NSError
        var parts = [summary(nsError)]
        if let reason = nsError.localizedFailureReason { parts.append(reason) }
        for (key, value) in nsError.userInfo
        where key != NSLocalizedDescriptionKey && key != NSLocalizedFailureReasonErrorKey {
            parts.append("\(key): \(value)")
        }
        return parts.joined(separator: "; ")
    }

    private static func string(_ input: [String: Any], _ key: String) throws -> String {
        guard let value = input[key] as? String, !value.isEmpty else {
            throw UnifiedAssetCalls.CallError("worker input has no \(key)")
        }
        return value
    }

    private static func perform(_ op: String, _ input: [String: Any]) throws -> [String: Any] {
        switch op {
        case "load":
            try UnifiedAssetCalls.load()
            return ["available": true]

        case "asset-type":
            let set = try string(input, "assetSet")
            if let type = try UnifiedAssetCalls.assetType(forSet: set) {
                return ["assetType": type]
            }
            return ["assetType": NSNull()]

        case "reset":
            guard let sets = input["assetSets"] as? [String], !sets.isEmpty,
                  sets.allSatisfy({ !$0.isEmpty })
            else { throw UnifiedAssetCalls.CallError("refusing a reset with no asset sets") }
            try UnifiedAssetCalls.send(["Operation": "ResetAssetSets", "AssetSets": sets], timeout: 120)
            return ["reset": sets]

        case "unsubscribe":
            let subscriber = try string(input, "subscriber")
            guard let names = input["names"] as? [String], !names.isEmpty else {
                throw UnifiedAssetCalls.CallError("no subscription names")
            }
            try UnifiedAssetCalls.send([
                "Operation": "Unsubscribe", "Subscriber": subscriber, "Subscriptions": names, "UserInitiated": true,
            ], timeout: 60)
            return ["unsubscribed": names]

        case "subscribe":
            let subscriber = try string(input, "subscriber")
            guard let requests = input["subscriptions"] as? [[String: Any]], !requests.isEmpty else {
                throw UnifiedAssetCalls.CallError("no subscriptions")
            }
            var subscriptions: [AnyObject] = []
            var sentAliases: [String: [String: String]] = [:]
            var leftOut: [String: [String]] = [:]
            for request in requests {
                let name = try string(request, "name")
                let usages = request["assetSetUsages"] as? [String: [String: String]] ?? [:]
                let candidates = request["usageAliasCandidates"] as? [String: [String]] ?? [:]
                // Each alias gets the first value this macOS knows. One it knows
                // no value for is left out rather than failing the whole request,
                // the way 27.2's removed GenerativePlayground alias did (#385).
                var aliases: [String: String] = [:]
                for alias in candidates.keys.sorted() {
                    if let value = try UnifiedAssetCalls.firstKnownValue(forAlias: alias, candidates: candidates[alias] ?? []) {
                        aliases[alias] = value
                    } else {
                        leftOut[name, default: []].append(alias)
                    }
                }
                // A subscription with nothing left in it would ask for nothing.
                guard !aliases.isEmpty || !usages.isEmpty else {
                    throw UnifiedAssetCalls.CallError(
                        "this macOS knows none of the usage aliases for \(name): \(candidates.keys.sorted().joined(separator: ", "))")
                }
                sentAliases[name] = aliases
                subscriptions.append(try UnifiedAssetCalls.makeSubscription(name: name, assetSetUsages: usages, usageAliases: aliases))
            }
            try UnifiedAssetCalls.send([
                "Operation": "Subscribe", "Subscriber": subscriber, "Subscriptions": subscriptions, "UserInitiated": true,
            ], timeout: 60)
            return [
                "subscribed": requests.compactMap { $0["name"] as? String },
                "usageAliases": sentAliases,
                "leftOut": leftOut,
            ]

        default:
            throw UnifiedAssetCalls.CallError("unknown op \(op)")
        }
    }

    /// JSON can hold strings, numbers, bools, arrays and dictionaries; anything
    /// else a reply carries becomes its description rather than failing the reply.
    private static func jsonSafe(_ value: Any) -> Any {
        switch value {
        case let dictionary as [String: Any]:
            var out: [String: Any] = [:]
            for (key, inner) in dictionary { out[key] = jsonSafe(inner) }
            return out
        case let array as [Any]:
            return array.map(jsonSafe)
        case is String, is NSNumber, is NSNull:
            return value
        default:
            return String(describing: value)
        }
    }
}

```

### Core Architecture Module: `PurgeAssetWorker/UnifiedAssetCalls.swift`
```
import Foundation
import ObjectiveC

/// Apple's private UnifiedAssetFramework and its subscription service, reached
/// through the Objective-C runtime so nothing is linked at build time and every
/// class and selector is checked before use. Mapped by pared
/// (github.com/4evy/pared, MIT) and checked on macOS 27.0 by the spike in
/// `spikes/apple-intelligence-models`. Only the worker target compiles this.
enum UnifiedAssetCalls {
    struct CallError: Error, CustomStringConvertible {
        let description: String
        init(_ description: String) { self.description = description }
    }

    static let frameworkPath =
        "/System/Library/PrivateFrameworks/UnifiedAssetFramework.framework/UnifiedAssetFramework"

    static func load() throws {
        guard dlopen(frameworkPath, RTLD_NOW) != nil else {
            throw CallError("UnifiedAssetFramework is missing on this macOS")
        }
    }

    /// Sends a message that takes no argument or one object, checking first that
    /// the receiver answers it. Nil when it does not, or the reply is not an object.
    private static func message(_ target: AnyObject, _ name: String, _ argument: Any? = nil) -> AnyObject? {
        let selector = Selector((name))
        guard target.responds(to: selector) else { return nil }
        let result: Unmanaged<AnyObject>?
        if let argument {
            result = target.perform(selector, with: argument)
        } else {
            result = target.perform(selector)
        }
        return result?.takeUnretainedValue()
    }

    private static func configurationManager() throws -> AnyObject {
        guard let managerClass = NSClassFromString("UAFConfigurationManager"),
              let manager = message(managerClass as AnyObject, "defaultManager")
        else { throw CallError("UAFConfigurationManager +defaultManager is missing") }
        return manager
    }

    /// The MobileAsset type macOS maps an asset set to, or nil when the set is
    /// unknown to this macOS. Purge compares it with its catalog before sending
    /// anything, so a renamed set is left alone.
    static func assetType(forSet name: String) throws -> String? {
        try load()
        let manager = try configurationManager()
        guard manager.responds(to: Selector(("getAssetSet:"))) else {
            throw CallError("UAFConfigurationManager -getAssetSet: is missing")
        }
        guard let set = message(manager, "getAssetSet:", name) else { return nil }
        guard set.responds(to: Selector(("autoAssetType"))) else {
            throw CallError("the asset set has no autoAssetType")
        }
        return message(set, "autoAssetType") as? String
    }

    /// The first of `candidates` that macOS accepts for the usage alias, or nil
    /// when it accepts none of them. Each is tried as a subscription holding
    /// that alias alone, through the same `isValid:error:` check every
    /// subscription already passes, so this needs nothing more from the
    /// framework. A value a release moved to `UsageAliases/Deprecated` still
    /// passes. Nil is how an alias macOS removed shows up, as
    /// `VisualGeneration.GenerativePlayground` did in 27.2 (#385). A missing
    /// class or method still throws.
    static func firstKnownValue(forAlias alias: String, candidates: [String]) throws -> String? {
        for value in candidates {
            let subscription = try newSubscription(name: "purge.aliasCheck", assetSetUsages: [:], usageAliases: [alias: value])
            if try validationError(subscription) == nil { return value }
        }
        return nil
    }

    /// Sends one operation to the subscription service and waits for its reply.
    /// `config` carries "Operation" and its arguments. Throws on a missing
    /// interface, a transport error, a timeout, or an error reply.
    ///
    /// `AppleIntelligenceModelRoute` picks the service. When the subscription
    /// service refuses or drops the connection, as it does from macOS 27.3,
    /// the same request goes out once more through siriknowledged's service.
    static func send(_ config: [String: Any], timeout: TimeInterval) throws {
        try load()
        guard let interfaceClass = NSClassFromString("UAFXPCProxyServiceInterface"),
              let interface = message(interfaceClass as AnyObject, "defaultInterface") as? NSXPCInterface
        else { throw CallError("UAFXPCProxyServiceInterface +defaultInterface is missing") }
        let selector = Selector(("operationWithConfig:completion:"))
        // A proxy answers every selector, so the interface's protocol is what is checked.
        let described = protocol_getMethodDescription(interface.protocol, selector, true, true).name != nil
            || protocol_getMethodDescription(interface.protocol, selector, false, true).name != nil
        guard described else { throw CallError("the service interface no longer has operationWithConfig:completion:") }

        do {
            try AppleIntelligenceModelRoute.send(timeout: timeout) { service, timeout in
                try send(config, to: service, interface: interface, selector: selector, timeout: timeout)
            }
        } catch let failure as AppleIntelligenceModelRoute.SecondTryFailure {
            // A worker refusal has no domain or code, so the first try joins its text.
            if let second = failure.error as? CallError {
                throw CallError("\(second.description); \(failure.firstTry)")
            }
            throw failure.withFirstTry
        }
    }

    /// One try at one Mach service.
    private static func send(_ config: [String: Any], to service: String, interface: NSXPCInterface,
                             selector: Selector, timeout: TimeInterval) throws {
        let connection = NSXPCConnection(machServiceName: service, options: [])
        connection.remoteObjectInterface = interface
        connection.resume()

        let done = DispatchSemaphore(value: 0)
        let lock = NSLock()
        var finished = false
        var replyError: Error?
        let finish: (Error?) -> Void = { error in
            lock.lock()
            defer { lock.unlock() }
            guard !finished else { return }
            finished = true
            replyError = error
            done.signal()
        }
        let proxy = connection.remoteObjectProxyWithErrorHandler { error in finish(error) } as AnyObject
        let completion: @convention(block) (NSError?) -> Void = { error in finish(error) }
        // Blocks are objects; this hands the completion over as one.
        let completionObject = unsafeBitCast(completion, to: AnyObject.self)
        // The method is `oneway void`: the returned value means nothing and is left alone.
        _ = proxy.perform(selector, with: config as NSDictionary, with: completionObject)

        let waited = done.wait(timeout: .now() + timeout)
        connection.invalidate()
        guard waited == .success else {
            throw CallError("no reply from \(service) in \(Int(timeout)) seconds; the request may still have run")
        }
        if let replyError { throw replyError }
    }

    /// A `UAFAssetSetSubscription` for a Subscribe operation, validated by macOS.
    /// Built with its initializer's implementation directly, since it takes three
    /// arguments, and checked against the configuration manager before it is sent.
    static func makeSubscription(name: String, assetSetUsages: [String: [String: String]],
                                 usageAliases: [String: String]) throws -> AnyObject {
        let subscription = try newSubscription(name: name, assetSetUsages: assetSetUsages, usageAliases: usageAliases)
        if let rejection = try validationError(subscription) { throw rejection }
        return subscription
    }

    /// A `UAFAssetSetSubscription`, not yet validated.
    private static func newSubscription(name: String, assetSetUsages: [String: [String: String]],
                                        usageAliases: [String: String]) throws -> AnyObject {
        try load()
        guard let type = NSClassFromString("UAFAssetSetSubscription") else {
            throw CallError("UAFAssetSetSubscription is missing")
        }
        guard class_conformsToProtocol(type, NSSecureCoding.self) else {
            throw CallError("UAFAssetSetSubscription is not NSSecureCoding, so it cannot cross XPC")
        }
        let initSelector = Selector(("initWithName:assetSets:usageAliases:"))
        guard let initMethod = class_getInstanceMethod(type, initSelector) else {
            throw CallError("UAFAssetSetSubscription initializer is missing")
        }
        guard let allocated = message(type as AnyObject, "alloc") else {
            throw CallError("UAFAssetSetSubscription could not be allocated")
        }
        typealias Initialize = @convention(c) (AnyObject, Selector, NSString, NSDictionary, NSDictionary) -> Unmanaged<AnyObject>?
        let initialize = unsafeBitCast(method_getImplementation(initMethod), to: Initialize.self)
        // alloc gave +1, init consumes it and returns +1.
        guard let subscription = initialize(
            allocated, initSelector, name as NSString, assetSetUsages as NSDictionary, usageAliases as NSDictionary
        )?.takeRetainedValue() else {
            throw CallError("UAFAssetSetSubscription returned nil")
        }
        return subscription
    }

    /// Why macOS rejects `subscription`, or nil when it accepts it. Throws only
    /// when the validator itself is missing.
    private static func validationError(_ subscription: AnyObject) throws -> Error? {
        let validSelector = Selector(("isValid:error:"))
        guard let validMethod = class_getInstanceMethod(type(of: subscription), validSelector) else {
            throw CallError("UAFAssetSetSubscription validator is missing")
        }
        let manager = try configurationManager()
        typealias Validate = @convention(c) (AnyObject, Sel
```

### Core Architecture Module: `purge/Models/ScanQueue.swift`
```
import Foundation

/// One unit of work in the scan queue. App Caches and Dev Tools stay one step
/// because `scanAll` already runs them back to back and they share a generation
/// and cancellation; splitting them would mean two scan pipelines for no gain.
nonisolated enum ScanStep: String, CaseIterable, Sendable {
    case cachesAndDevTools
    case largeFiles
    case apps
    case leftovers
    /// The Everything else walk (#220). Measures only; it feeds no category and
    /// nothing it finds is offered for cleaning.
    case everythingElse
    /// The uninstaller's Command-line tools section (#225). Runs when the tab
    /// opens; it feeds no Overview category.
    case commandLineTools

    /// The Overview categories whose figures this step refreshes.
    var categories: [OverviewCategory] {
        switch self {
        case .cachesAndDevTools: return [.appCaches, .devTools]
        case .largeFiles: return [.largeFiles]
        case .apps: return [.apps]
        case .leftovers: return [.leftovers]
        case .everythingElse, .commandLineTools: return []
        }
    }

    /// Large Files, the uninstaller and orphan leftovers read places a limited
    /// scan must never touch, so they only run with Full Disk Access. The
    /// Everything else walk skips those places instead and says so on its rows.
    var needsFullDiskAccess: Bool {
        switch self {
        case .cachesAndDevTools, .everythingElse, .commandLineTools: return false
        case .largeFiles, .apps, .leftovers: return true
        }
    }

    /// The Everything else walk takes minutes on a big home folder, so it runs
    /// only when the row is opened: never at launch, and not from Scan Everything.
    var runsOnlyOnDemand: Bool {
        switch self {
        case .everythingElse, .commandLineTools: return true
        case .cachesAndDevTools, .largeFiles, .apps, .leftovers: return false
        }
    }
}

/// Which half of the App Caches and Dev Tools step is running, or neither.
nonisolated enum CacheScanStage: Equatable, Sendable {
    case idle
    case appCaches
    case devTools
}

/// The categories the Overview breaks the disk into, in the order each byte is
/// claimed: a file found by an earlier category is never counted again by a later one.
nonisolated enum OverviewCategory: String, CaseIterable, Sendable {
    case appCaches
    case devTools
    case largeFiles
    case apps
    case leftovers

    var step: ScanStep {
        switch self {
        case .appCaches, .devTools: return .cachesAndDevTools
        case .largeFiles: return .largeFiles
        case .apps: return .apps
        case .leftovers: return .leftovers
        }
    }
}

/// What is running and what is waiting. Scans run strictly one at a time: two
/// walks of the same disk slow each other down, and the cache scan already fans
/// out across the cooperative pool, so a second heavy scan beside it risks
/// starving that pool.
nonisolated struct ScanQueueState: Equatable, Sendable {
    private(set) var active: ScanStep?
    private(set) var pending: [ScanStep] = []

    var isRunning: Bool { active != nil || !pending.isEmpty }

    /// A category scan is running or waiting. The Everything else walk is left
    /// out: it feeds no category, so callers waiting on fresh results, and the
    /// Scan Everything button, look past it.
    var isRunningCategoryScan: Bool {
        (active != nil && active != .everythingElse) || pending.contains { $0 != .everythingElse }
    }

    func isQueued(_ step: ScanStep) -> Bool {
        pending.contains(step)
    }

    /// Adds steps to the back in the order given, skipping any already running or waiting.
    mutating func enqueue(_ steps: [ScanStep]) {
        for step in steps where step != active && !pending.contains(step) {
            pending.append(step)
        }
    }

    /// Moves steps to the front, keeping their relative order, so a tab the user
    /// opens runs next instead of waiting behind the rest of a launch scan. A step
    /// that is already running is left alone, unless `requeueingActive` asks for it
    /// to run again once it ends: a Scan button, or access that changed mid-scan.
    mutating func prioritize(_ steps: [ScanStep], requeueingActive: Bool = false) {
        let front = requeueingActive ? steps : steps.filter { $0 != active }
        pending.removeAll { front.contains($0) }
        var seen = Set<ScanStep>()
        pending.insert(contentsOf: front.filter { seen.insert($0).inserted }, at: 0)
    }

    /// Makes the next waiting step the active one and returns it.
    mutating func startNext() -> ScanStep? {
        guard !pending.isEmpty else {
            active = nil
            return nil
        }
        let next = pending.removeFirst()
        active = next
        return next
    }

    mutating func finishActive() {
        active = nil
    }

    /// Drops one waiting step. The running step is the caller's to stop.
    mutating func remove(_ step: ScanStep) {
        pending.removeAll { $0 == step }
    }

    /// Drops everything still waiting. The running step is the caller's to stop.
    mutating func clearPending() {
        pending.removeAll()
    }
}

/// Which steps run when the window opens: every one that has no results in this
/// session, in order.
///
/// A saved record is not a reason to skip a step. It only holds totals, so a skipped
/// step would look finished on the Overview and then scan anyway the moment its tab
/// opened. Scanning everything at launch means each tab is ready once its row is.
nonisolated enum LaunchScanPlan {
    static func steps(
        hasFullDiskAccess: Bool,
        loadedThisSession: Set<ScanStep>
    ) -> [ScanStep] {
        ScanStep.allCases.filter { step in
            !step.runsOnlyOnDemand
                && !loadedThisSession.contains(step)
                && (!step.needsFullDiskAccess || hasFullDiskAccess)
        }
    }
}

```

### Core Architecture Module: `purge/Services/PurgeStore+ScanQueue.swift`
```
import Combine
import Foundation

/// Runs scans one at a time. Every scan the Overview, a tab, Scan Everything, the
/// menu bar or Settings asks for goes through here, and a scheduled clean holds the
/// queue while it rescans, so two heavy walks never run side by side. Onboarding
/// calls `scanAll` itself, which replaces any cache scan in flight rather than
/// running beside it.
extension PurgeStore {
    /// Scan Everything: every category, whether or not it has recent results.
    /// A running or queued Everything else walk is stopped first: the queue
    /// runs one step at a time, the walk can take minutes and feeds no
    /// category, and the page offers to measure again.
    func scanEverything() {
        refreshPermission()
        stopEverythingElse()
        let steps = ScanStep.allCases.filter { !$0.runsOnlyOnDemand && (!$0.needsFullDiskAccess || hasFullDiskAccess) }
        scanQueueForcedSteps.formUnion(steps)
        scanQueue.enqueue(steps)
        startScanQueueIfIdle()
    }

    /// The window opened: scan what has no results yet, one step after another,
    /// in the order App Caches and Dev Tools, Large Files, apps, leftovers.
    func startLaunchScans() {
        refreshPermission()
        let steps = LaunchScanPlan.steps(
            hasFullDiskAccess: hasFullDiskAccess,
            loadedThisSession: Set(ScanStep.allCases.filter { hasSessionResults(for: $0) })
        )
        scanQueue.enqueue(steps)
        startScanQueueIfIdle()
    }

    /// Full Disk Access just landed. App Caches and Dev Tools already have results,
    /// but limited ones, so they rescan first; then the steps access unlocks queue
    /// as they would at launch. A limited scan still running stops rather than
    /// finishing results that are already out of date, and the rescan runs after it.
    func scanAfterAccessGranted() {
        interruptLimitedCacheScan()
        requestScan(.cachesAndDevTools)
        startLaunchScans()
    }

    /// A Scan button: rescan these next, ahead of anything waiting. A step that is
    /// running now runs again once it ends, since the click asked for a fresh scan.
    func requestScan(_ steps: ScanStep...) {
        requestScans(steps)
    }

    private func requestScans(_ steps: [ScanStep]) {
        let allowed = steps.filter { !$0.needsFullDiskAccess || hasFullDiskAccess }
        scanQueueForcedSteps.formUnion(allowed)
        scanQueue.prioritize(allowed, requeueingActive: true)
        startScanQueueIfIdle()
    }

    /// For callers outside the window (the menu bar, Settings) that need a scan and
    /// its results: asks the queue and returns once the step has run, was stopped,
    /// or was never allowed to run. `forced` rescans even when this session already
    /// has results; otherwise results already here are enough.
    func scanThroughQueue(_ step: ScanStep, forced: Bool) async {
        if forced {
            requestScans([step])
        } else {
            requestScanIfNeeded(step)
        }
        await waitUntilSettled(step)
    }

    /// Returns once `step` is neither running nor waiting in the queue.
    func waitUntilSettled(_ step: ScanStep) async {
        for await state in $scanQueue.values where state.active != step && !state.isQueued(step) {
            return
        }
    }

    /// Runs `work` with the queue idle and held: a running step finishes first, and
    /// nothing queued starts until `work` returns. For a scheduled clean, whose own
    /// rescan would otherwise walk the disk beside a queued scan or cut a queued
    /// full scan short.
    func withScanQueueHeld<T>(_ work: () async -> T) async -> T {
        // The Everything else walk can take minutes and feeds no category, so a
        // clean doesn't wait for it. The page offers to measure again.
        stopEverythingElse()
        while scanQueueTask != nil || isScanQueueHeld, !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(100))
        }
        let wasHeld = isScanQueueHeld
        isScanQueueHeld = true
        let result = await work()
        // A cancelled wait can reach here while another holder still runs; that
        // holder releases the queue, not this one.
        if !wasHeld {
            isScanQueueHeld = false
            startScanQueueIfIdle()
        }
        return result
    }

    /// A tab was opened: if it has nothing to show yet, scan it next.
    func requestScanIfNeeded(_ steps: ScanStep...) {
        refreshPermission()
        let needed = steps.filter { step in
            (!step.needsFullDiskAccess || hasFullDiskAccess)
                && !hasSessionResults(for: step)
                && scanQueue.active != step
        }
        guard !needed.isEmpty else { return }
        scanQueue.prioritize(needed)
        // A rescan someone asked for stays ahead of a tab that merely opened: after
        // a grant, the limited App Caches results must be redone before a long
        // Large Files or apps walk starts.
        scanQueue.prioritize(scanQueue.pending.filter { scanQueueForcedSteps.contains($0) })
        startScanQueueIfIdle()
    }

    /// Stop drops everything still waiting and stops the running step. A running App
    /// Caches and Dev Tools step is left to finish: it takes seconds, and the menu bar
    /// and sidebar both track that scan to its end.
    func stopScans() {
        scanQueue.clearPending()
        scanQueueForcedSteps.removeAll()
        guard let active = scanQueue.active, active != .cachesAndDevTools else { return }
        scanQueueStepTask?.cancel()
        scanQueueStepTask = nil
        scanQueueTask?.cancel()
        scanQueueTask = nil
        // The cancelled runner is still unwinding; a new ID stops it from touching
        // the queue state of a runner started after this.
        scanQueueRunID += 1
        if active == .apps {
            cancelRemovableTotals()
        }
        scanQueue.finishActive()
    }

    func isScanQueued(_ step: ScanStep) -> Bool {
        scanQueue.isQueued(step)
    }

    private func startScanQueueIfIdle() {
        guard scanQueueTask == nil, !isScanQueueHeld, !isUninstallingPurge, !scanQueue.pending.isEmpty else { return }
        scanQueueRunID += 1
        let runID = scanQueueRunID
        scanQueueTask = Task { @MainActor [weak self] in
            guard let self else { return }
            while !Task.isCancelled, let step = self.scanQueue.startNext() {
                let forced = self.scanQueueForcedSteps.remove(step) != nil
                if step == .cachesAndDevTools, self.cacheStepStartsNewScan(forced: forced) {
                    self.markCacheScanStarting()
                }
                let stepTask = Task { @MainActor [weak self] in
                    guard let self else { return }
                    await self.runScanStep(step, forced: forced)
                }
                self.scanQueueStepTask = stepTask
                if step == .cachesAndDevTools {
                    await Self.waitForStep(stepTask, patience: self.cacheStepPatience)
                } else {
                    await stepTask.value
                }
                guard self.scanQueueRunID == runID else { return }
                self.scanQueueStepTask = nil
                self.scanQueue.finishActive()
            }
            guard self.scanQueueRunID == runID else { return }
            self.scanQueueTask = nil
            // A request that arrived while the last step was finishing.
            self.startScanQueueIfIdle()
        }
    }

    /// Returns when the step finishes or its patience runs out, whichever comes first.
    static func waitForStep(_ task: Task<Void, Never>, patience: TimeInterval) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            let gate = ResumeOnce(continuation)
            let timeout = Task { @MainActor in
                try? await Task.sleep(nanoseconds: UInt64(patience * 1_000_000_000))
                gate.resume()
            }
            Task { @MainActor in
                await task.value
                timeout.cancel()
                gate.resume()
            }
        }
    }

    /// Whether the App Caches and Dev Tools step starts a scan of its own. A full scan
    /// someone else started is waited on instead, unless it runs with less access
    /// than Purge has now: then its results would be out of date as they land.
    private func cacheStepStartsNewScan(forced: Bool) -> Bool {
        if isScanningAll, !cacheResultsNeedAccessRescan { return false }
        return forced || !hasSessionResults(for: .cachesAndDevTools)
    }

    private func runScanStep(_ step: ScanStep, forced: Bool) async {
        if step.needsFullDiskAccess, let fullAccessStep = scanSources.fullAccessStep {
            await fullAccessStep(step, forced)
            return
        }
        switch step {
        case .cachesAndDevTools:
            if cacheStepStartsNewScan(forced: forced) {
                await scanAll()
            } else if isScanningAll {
                await awaitInFlightFullScan()
            }
            await awaitProjectDiscovery()
        case .largeFiles:
            if forced {
                await scanLargeFiles()
            } else {
                await scanLargeFilesIfNeeded()
            }
        case .apps:
            if forced {
                await scanInstalledApps()
            } else {
                await scanInstalledAppsIfNeeded()
            }
            await awaitRemovableTotals()
        case .leftovers:
            if forced {
                await scanOrphanLeftovers()
            } else {
                await scanOrphanLeftoversIfNeeded()
            }
        case .everythingElse:
            // Only ever queued on demand, so it always measures afresh.
            await measureEverythingElse()
        case .commandLineTools:
            if forced {
                await scanCommandLineTools()

```

### Core Architecture Module: `purge/Utilities/AccessTimeUpdates.swift`
```
import Darwin

/// Reads that leave a file's access time alone (#373).
///
/// Large Files shows a file's access time as "Last used", so Purge's own reads
/// must not move it. On APFS a plain `read()` moves it only when it is older
/// than the modification time, which is a file nobody has read since it was
/// written. With updates off for the thread, it doesn't move at all.
nonisolated enum AccessTimeUpdates {
    /// Runs `body` with access-time updates off for this thread, then puts the
    /// thread's policy back.
    ///
    /// This covers `read()` only. A memory-mapped read still moves the access
    /// time, and so does a read in another process, such as Quick Look's: those
    /// go through `FileAccessLedger`. `body` must not suspend, because a task
    /// can resume on another thread and leave this one with updates off for
    /// whatever runs on it next.
    static func off<T>(_ body: () throws -> T) rethrows -> T {
        let previous = getiopolicy_np(IOPOL_TYPE_VFS_ATIME_UPDATES, IOPOL_SCOPE_THREAD)
        let changed = previous >= 0
            && setiopolicy_np(IOPOL_TYPE_VFS_ATIME_UPDATES, IOPOL_SCOPE_THREAD, IOPOL_ATIME_UPDATES_OFF) == 0
        defer {
            if changed {
                _ = setiopolicy_np(IOPOL_TYPE_VFS_ATIME_UPDATES, IOPOL_SCOPE_THREAD, previous)
            }
        }
        return try body()
    }
}

```

### Core Architecture Module: `purge/Utilities/AppSupportFolder.swift`
```
import Foundation

/// Purge's folder in Application Support, where its stores keep their files.
/// While the tests run it is the run's scratch folder: the tests run inside a
/// hosted copy of the app, and nothing they write may reach the user's own
/// files (#185).
nonisolated enum AppSupportFolder {
    static func url() -> URL {
        if TestHost.isActive() { return TestHost.supportDirectory() }
        return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("io.getpurge.app", isDirectory: true)
    }
}

```

### Core Architecture Module: `purge/Utilities/ByteFormatter.swift`
```
import Foundation

/// Made once: `formatBytes` runs per row per render. Foundation's formatters are
/// safe to share across threads once configured.
nonisolated(unsafe) private let byteCountFormatter: ByteCountFormatter = {
    let formatter = ByteCountFormatter()
    formatter.allowedUnits = [.useBytes, .useKB, .useMB, .useGB, .useTB]
    formatter.countStyle = .file
    formatter.includesUnit = true
    return formatter
}()

nonisolated func formatBytes(_ bytes: Int64) -> String {
    guard bytes > 0 else { return String(localized: "0 bytes") }
    return byteCountFormatter.string(fromByteCount: bytes)
}

/// Formats volume figures for the storage sidebar — one decimal at most (e.g. "313.4 GB").
func formatStorageBytes(_ bytes: Int64) -> String {
    formatOneDecimal(bytes, roundingDown: false)
}

/// Formats a ceiling, rounding **down** so the figure can never overstate.
///
/// `formatBytes` rounds to nearest, which would turn 1.29 GB into "1.3 GB" and quietly
/// promise more than exists. An "up to" figure has to under-promise by construction: the
/// measured outcome must always be able to meet or beat it.
nonisolated func formatBytesRoundedDown(_ bytes: Int64) -> String {
    formatOneDecimal(bytes, roundingDown: true)
}

/// Decimal units with one decimal at most, rounded to nearest or truncated.
/// `decimalSeparator` is injected so the tests can check both ways of writing a
/// fraction without touching the process-wide locale.
nonisolated func formatOneDecimal(
    _ bytes: Int64,
    roundingDown: Bool,
    decimalSeparator: String = Locale.current.decimalSeparator ?? "."
) -> String {
    guard bytes > 0 else { return String(localized: "0 bytes") }

    // Units come from the string tables, so a Mac set to Russian reads "217,5 ГБ"
    // and not "217.5 GB", the way `formatBytes` already writes its own figures.
    let units: [(threshold: Int64, suffix: String)] = [
        (1_000_000_000_000, String(localized: "TB")),
        (1_000_000_000, String(localized: "GB")),
        (1_000_000, String(localized: "MB")),
        (1_000, String(localized: "KB"))
    ]

    for unit in units where bytes >= unit.threshold {
        let tenths = (bytes * 10 + (roundingDown ? 0 : unit.threshold / 2)) / unit.threshold
        let whole = tenths / 10
        let fraction = tenths % 10
        guard fraction > 0 else { return "\(whole) \(unit.suffix)" }
        return "\(whole)\(decimalSeparator)\(fraction) \(unit.suffix)"
    }

    return String(localized: "\(bytes) bytes")
}

```

### Core Architecture Module: `purge/Utilities/CacheHeadline.swift`
```
import Foundation

/// The on-screen title for a cache row Purge could not match to a bundled
/// explanation.
///
/// Those rows get a title built in English from the app's name, like "Slack Cache"
/// or "Arc Old Version 120.0". The same text is stored and matched on (exclusions,
/// row icons), so the model keeps it in English and only the generic words are
/// translated here, at display time. The app name stays as macOS shows it: brand
/// names are not translated.
///
/// The title alone is ambiguous: "Visual Studio Code Cache" is the plain cache of an
/// app called "Visual Studio Code", while "Slack Code Cache" is Slack's `Code Cache`
/// folder. So the caller also passes the cache folder's own name, and only a folder
/// literally named `Code Cache` reads as a code cache.
nonisolated enum CacheHeadline {
    enum Pattern: Equatable {
        case cache(app: String)
        case codeCache(app: String)
        case serviceWorkerCache(app: String)
        case serviceWorkerScriptCache(app: String)
        case oldVersion(app: String, version: String)
    }

    /// `appFolder` is the Application Support folder the row came from, when it has
    /// one. Its cache folders share one row titled "<appFolder> Cache", so that title
    /// is always a plain cache, whichever folder is largest: "T3 Code Cache" is not
    /// T3's code cache.
    static func pattern(of headline: String, cacheFolder: String, appFolder: String? = nil) -> Pattern? {
        if let appFolder, !appFolder.isEmpty, headline == "\(appFolder) Cache" {
            return .cache(app: appFolder)
        }
        if let range = headline.range(of: " Old Version ", options: .backwards),
           range.lowerBound > headline.startIndex,
           range.upperBound < headline.endIndex {
            return .oldVersion(
                app: String(headline[..<range.lowerBound]),
                version: String(headline[range.upperBound...])
            )
        }
        // Longest suffix first, so "X Service Worker Cache" never reads as a plain cache.
        if let app = app(in: headline, before: " Service Worker Script Cache") {
            return .serviceWorkerScriptCache(app: app)
        }
        if let app = app(in: headline, before: " Service Worker Cache") {
            return .serviceWorkerCache(app: app)
        }
        if cacheFolder == "Code Cache", let app = app(in: headline, before: " Code Cache") {
            return .codeCache(app: app)
        }
        if let app = app(in: headline, before: " Cache") {
            return .cache(app: app)
        }
        return nil
    }

    private static func app(in headline: String, before suffix: String) -> String? {
        guard headline.hasSuffix(suffix), headline.count > suffix.count else { return nil }
        return String(headline.dropLast(suffix.count))
    }

    /// `cacheFolder` is the last path component of the row's cache folder.
    static func localized(_ headline: String, cacheFolder: String, appFolder: String? = nil) -> String {
        switch pattern(of: headline, cacheFolder: cacheFolder, appFolder: appFolder) {
        case .cache(let app): return String(localized: "\(app) Cache")
        case .codeCache(let app): return String(localized: "\(app) Code Cache")
        case .serviceWorkerCache(let app): return String(localized: "\(app) Service Worker Cache")
        case .serviceWorkerScriptCache(let app): return String(localized: "\(app) Service Worker Script Cache")
        case .oldVersion(let app, let version): return String(localized: "\(app) Old Version \(version)")
        case nil: return headline
        }
    }

    /// The app folder directly under `Library/Application Support` in `path`, if any.
    static func applicationSupportAppFolder(of path: String) -> String? {
        let parts = path.split(separator: "/").map(String.init)
        guard let index = parts.indices.dropLast().first(where: {
            parts[$0] == "Library" && parts[$0 + 1] == "Application Support"
        }), index + 2 < parts.count else { return nil }
        return parts[index + 2]
    }
}

```

### Core Architecture Module: `purge/Utilities/ConcurrentMap.swift`
```
import Foundation

/// Runs a blocking read for each item on several threads at once and returns
/// the results in the items' order. For independent reads only, such as code
/// signatures or folder listings: `transform` must not depend on another
/// item's result.
///
/// Blocks the calling thread until every item is done, so call it off the main
/// actor. At most `width` items run at once, never more than there are cores;
/// a walk of the disk passes a small width so a scan leaves the rest of the Mac
/// room to work.
nonisolated enum ConcurrentMap {
    /// `outer` runs each lane on a thread of its own instead of through
    /// `concurrentPerform`, for a map whose items run maps of their own: GCD
    /// runs a `concurrentPerform` nested inside another with little or no
    /// parallelism. Plain maps keep `concurrentPerform`, which shares the cores
    /// out between maps that run at the same time.
    static func values<T, R>(
        _ items: [T],
        width: Int = ProcessInfo.processInfo.activeProcessorCount,
        outer: Bool = false,
        _ transform: (T) -> R
    ) -> [R] {
        let lanes = min(max(1, width), items.count)
        guard lanes > 1 else { return items.map(transform) }
        var results = [R?](repeating: nil, count: items.count)
        var next = 0
        let lock = NSLock()
        // Each lane takes the next item when it is free, so one slow item holds
        // up only its own lane.
        let lane: (Int) -> Void = { _ in
            while true {
                lock.lock()
                let index = next
                next += 1
                lock.unlock()
                guard index < items.count else { return }
                let value = transform(items[index])
                lock.lock()
                results[index] = value
                lock.unlock()
            }
        }
        if outer {
            runLanes(lanes, lane)
        } else {
            DispatchQueue.concurrentPerform(iterations: lanes, execute: lane)
        }
        return results.map { $0! }
    }

    /// Runs `body` for lanes `0..<count` side by side and returns when all are
    /// done. Lane 0 runs on the calling thread, the rest on queues of their
    /// own, so a `concurrentPerform` inside a lane is not nested in another.
    fileprivate static func runLanes(_ count: Int, _ body: (Int) -> Void) {
        guard count > 1 else {
            body(0)
            return
        }
        withoutActuallyEscaping(body) { body in
            // The queued blocks hold the closure unretained: a block can outlive
            // its `leave()` for a moment, and a retained copy then would still be
            // alive when this returns, which `withoutActuallyEscaping` traps on.
            // The one retain is dropped after every lane is done.
            let lanes = Unmanaged.passRetained(LaneBody(body))
            let group = DispatchGroup()
            // At the priority of the calling thread, as `concurrentPerform` ran.
            let qos = DispatchQoS(qosClass: DispatchQoS.QoSClass(rawValue: qos_class_self()) ?? .default, relativePriority: 0)
            for lane in 1..<count {
                group.enter()
                DispatchQueue(label: "purge.concurrent-map", qos: qos).async {
                    lanes.takeUnretainedValue().run(lane)
                    group.leave()
                }
            }
            body(0)
            group.wait()
            lanes.release()
        }
    }
}

private nonisolated final class LaneBody {
    let run: (Int) -> Void

    init(_ run: @escaping (Int) -> Void) {
        self.run = run
    }
}

extension ConcurrentMap {
    /// Runs two independent blocking reads side by side and returns both,
    /// each free to run maps of its own. Blocks the calling thread until both
    /// are done.
    static func both<A, B>(_ first: () -> A, _ second: () -> B) -> (A, B) {
        var a: A?
        var b: B?
        let lock = NSLock()
        runLanes(2) { index in
            if index == 0 {
                let value = first()
                lock.lock()
                a = value
                lock.unlock()
            } else {
                let value = second()
                lock.lock()
                b = value
                lock.unlock()
            }
        }
        lock.lock()
        defer { lock.unlock() }
        return (a!, b!)
    }
}

/// One step of a folder that `ConcurrentMap.tree` reads: something found, or
/// a subfolder to read next.
nonisolated enum TreeStep<Value, Child> {
    case value(Value)
    case child(Child)
}

extension ConcurrentMap {
    /// Reads a tree on several threads at once: `read` lists one folder and
    /// returns its steps in listing order. A thread takes the next folder as
    /// soon as it is free, so no folder waits for the others at its depth.
    /// Returns every value in the order one depth-first walk meets them, and
    /// hands them to `onValues` in that order as soon as every folder before
    /// them is read, so a caller can show them while the walk goes on.
    /// `onValues` runs on a reading thread with the walk's lock held, so it
    /// must be quick. Blocks the calling thread; once `isCancelled` turns true
    /// it stops and returns the values handed out so far.
    ///
    /// Kept out of line, and `roots` is read once and copied into a buffer of
    /// its own. In 1.16.0 the walk was inlined into Large Files' async scan,
    /// and the optimized build let `items` take over `roots`' buffer without a
    /// copy: growing `items` freed the buffer `roots` still pointed at. A root
    /// folder with one visible entry then made the walk read a root that did
    /// not exist, and Purge crashed a few seconds after every launch.
    @inline(never)
    static func tree<Item, Value>(
        _ roots: [Item],
        width: Int,
        isCancelled: () -> Bool,
        onValues: (([Value]) -> Void)? = nil,
        read: (Item) -> [TreeStep<Value, Item>]
    ) -> [Value] {
        let rootCount = roots.count
        // Each node's steps, with children replaced by their node's index; nil
        // until the node is read.
        var nodes: [[TreeStep<Value, Int>]?] = Array(repeating: nil, count: rootCount)
        var items: [Item] = []
        items.reserveCapacity(rootCount)
        items.append(contentsOf: roots)
        var queue = Array((0..<rootCount).reversed())
        var busy = 0
        let condition = NSCondition()

        // Where a depth-first walk over the nodes read so far has got to. It
        // stops at the first node not read yet, so values come out in walk
        // order however the reads finish.
        var values: [Value] = []
        var path: [(node: Int, step: Int)] = []
        var nextRoot = 0
        func advance() -> [Value] {
            var ready: [Value] = []
            while true {
                if path.isEmpty {
                    guard nextRoot < rootCount else { break }
                    path.append((nextRoot, 0))
                    nextRoot += 1
                }
                let (node, step) = path[path.count - 1]
                guard let steps = nodes[node] else { break }
                guard step < steps.count else {
                    path.removeLast()
                    continue
                }
                path[path.count - 1].step += 1
                switch steps[step] {
                case .value(let value): ready.append(value)
                case .child(let child): path.append((child, 0))
                }
            }
            return ready
        }

        DispatchQueue.concurrentPerform(iterations: max(1, width)) { _ in
            while true {
                condition.lock()
                while queue.isEmpty, busy > 0 { condition.wait() }
                guard !isCancelled(), let index = queue.popLast() else {
                    condition.broadcast()
                    condition.unlock()
                    return
                }
                let item = items[index]
                busy += 1
                condition.unlock()

                let steps = read(item)

                condition.lock()
                var resolved: [TreeStep<Value, Int>] = []
                resolved.reserveCapacity(steps.count)
                var added: [Int] = []
                for step in steps {
                    switch step {
                    case .value(let value):
                        resolved.append(.value(value))
                    case .child(let child):
                        let childIndex = items.count
                        items.append(child)
                        nodes.append(nil)
                        resolved.append(.child(childIndex))
                        added.append(childIndex)
                    }
                }
                nodes[index] = resolved
                // Reversed, so the first subfolder is read next.
                queue.append(contentsOf: added.reversed())
                busy -= 1
                // Handed out with the lock held, so batches never overtake
                // one another.
                let ready = advance()
                values += ready
                if !ready.isEmpty { onValues?(ready) }
                if !added.isEmpty || busy == 0 { condition.broadcast() }
                condition.unlock()
            }
        }
        return values
    }
}

/// A stop signal that work on `ConcurrentMap`'s threads can read. There
/// `Task.isCancelled` is always false, since those threads run no task, so the
/// caller raises this from `withTaskCancellationHandler`'s `onCancel` instead.
nonisolated final class CancellationFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var raised = false

    var isRaised: Bool {
        lock.lock()
        defer { lock.unlock() }
        return raised
    }

    func raise() {
        lock.lock()
        raised = true
        lock.unlock()
    }
}

```

### Core Architecture Module: `purge/Utilities/ContainerAccessGate.swift`
```
import Foundation

/// Lets one thread at a time look up a path inside other apps' containers.
///
/// Opening a folder in `~/Library/Containers` or `~/Library/Group Containers`
/// makes macOS check, inside the `open` call, that Purge may read it. When two
/// threads of Purge did that at once, one of them sometimes waited 5 to 6 s
/// (measured 2026-11-12: about one cache scan in eight). One at a time it never
/// did, which is how scans met these folders when every folder was sized by a
/// `du` process of its own. Reads that run side by side take this gate for
/// each such lookup; everything outside the containers stays parallel.
nonisolated enum ContainerAccessGate {
    private static let lock = NSLock()

    private static let containerRoots: [String] = {
        let library = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library", isDirectory: true).standardizedFileURL.path
        return ["\(library)/Containers/", "\(library)/Group Containers/"]
    }()

    /// Whether `path` is inside another app's container, spelled as walks
    /// spell it (no trailing slash needed).
    static func isInsideContainers(_ path: String) -> Bool {
        containerRoots.contains { path.hasPrefix($0) }
    }

    /// Runs `body` holding the gate when `path` is inside the containers.
    static func access<T>(_ path: String, _ body: () -> T) -> T {
        guard isInsideContainers(path) else { return body() }
        lock.lock()
        defer { lock.unlock() }
        return body()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #428** (2026-11-21): **Purge 1.17.0 — Homebrew upgrade leaves application running**
  *Symptoms*: ### What happened?  Hi,  I recently upgraded Purge from 1.16.2 to 1.17.0 through Homebrew on my Apple Silicon Mac.  The upgrade completed successfully, including unloading the 2 background services and replacing the application bundle. However, Purge remained running and was never automatically restarted. I had to quit and relaunch it manually.  Both Homebrew and the installed application report version 1.17.0, and Terminal already has App Management permission.  Could you confirm whether Purge should automatically quit and relaunch during updates? It looks like the Homebrew cask might be missing the appropriate quit: lifecycle directive.  Ideally, upgrades should gracefully stop the application, replace it, and restore its running state afterward.  Would you be able to coordinate the necessary change with the Homebrew maintainers?  Thanks!  ### What did you expect to happen?  I expected Purge to be quit and relaunched after brew updated it.  ### Steps to reproduce  _No response_  ### Purge version  1.17.0 (47)  ### macOS version  macOS 27.2.1, Apple silicon  ### Logs, screenshots, or screen recording  _No response_

- **Issue #422** (2026-11-20): **Allowlisted rows outside ~/.cache follow a link to another folder**
  *Symptoms*: ## The gap  The allowlist in `purge/Services/DeletionSafetyPolicy.swift` (`whitelistedAbsolutePrefixes(home:)`) compares path text. #420 closed this for the entries under `~/.cache`. Every other entry still has it.  If `~/.gradle` is a link to `~/Developer`, the row names `~/.gradle/caches`, the text matches, and the move takes `~/Developer/caches`. Found while fixing #420. No report from a user.  ## What each case really moves  Checked in the scanners, the sizing code and `FileDeleter`:  | Where the link is | Example | What a clean does today | | --- | --- | --- | | A folder above the row | `~/.gradle` for `~/.gradle/caches`, `~/.npm` for `~/.npm/_cacache` | Moves the real folder behind the link. The scan sizes it through the link, so the row looks normal. | | The entry itself, and the row is the entry | `~/.npm`, `DerivedData` | Moves only the link. The scan reads the link with `lstat`, so the row is sized at zero. Nothing is freed and the tool makes a new folder on the startup disk. | | A link inside the row's folder | `~/.npm/_cacache/some-link` | Goes to the Trash with the folder, as a link. Its target stays. | | A child of `~/Library/Caches` that is a link | `~/Library/Caches/com.foo` | App Caches never lists it (`isDirectoryKey` is false for a link). A Dev Tools row there is sized at zero and moves as a link. | | `~/Library/Caches` or `~/Library/Logs` itself | | The scan and the entry by entry clean list nothing (`contentsOfDirectory` fails on a linked folder). Dev Too

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

### Incident Patch 1: `09c6920d` (2026-11-20)
**Commit Message**: fix: send Apple Intelligence requests through siriknowledged when macOS 27.3 refuses them (#343) (#418)

* fix: send Apple Intelligence model requests through siriknowledged on macOS 27.3

macOS 27.3 (from beta 1, 26C5035r) puts an anchor apple code-signing
requirement on assetsubscriptiond's com.apple.siri.uaf.subscription.service,
so the asset worker's requests are dropped with NSCocoaErrorDomain 4097 and
removing or downloading the models again does nothing.

siriknowledged serves com.apple.siri.uaf.service with the same interface and
passes operationWithConfig: on unchanged. When the first connection is
refused or dropped (4097 or 4099), the worker now sends the same request once
more through it. Both tries share the original timeout. Error replies from the
service and timeouts are never resent. The first try is unchanged, so older
macOS behaves as before.

Found by pdfux and shipped first by RemoveMacAI (MIT):
https://github.com/omlahore/RemoveMacAI/issues/123
https://github.com/omlahore/RemoveMacAI/commit/84d3da06c69cbfbcc9ccd9b315c10e8142760d59

Written and reviewed on Linux, not built or run on a Mac.

* test: cover the second-service retry rule (#343)

The retry rule lived

**File**: `PurgeAssetWorker/UnifiedAssetCalls.swift` (modified, +22/-3)
```diff
@@ -14,7 +14,6 @@ enum UnifiedAssetCalls {
 
     static let frameworkPath =
         "/System/Library/PrivateFrameworks/UnifiedAssetFramework.framework/UnifiedAssetFramework"
-    static let serviceName = "com.apple.siri.uaf.subscription.service"
 
     static func load() throws {
         guard dlopen(frameworkPath, RTLD_NOW) != nil else {
@@ -78,6 +77,10 @@ enum UnifiedAssetCalls {
     /// Sends one operation to the subscription service and waits for its reply.
     /// `config` carries "Operation" and its arguments. Throws on a missing
     /// interface, a transport error, a timeout, or an error reply.
+    ///
+    /// `AppleIntelligenceModelRoute` picks the service. When the subscription
+    /// service refuses or drops the connection, as it does from macOS 27.3,
+    /// the same request goes out once more through siriknowledged's service.
     static func send(_ config: [String: Any], timeout: TimeInterval) throws {
         try load()
         guard let interfaceClass = NSClassFromString("UAFXPCProxyServiceInterface"),
@@ -89,7 +92,23 @@ enum UnifiedAssetCalls {
             || protocol_getMethodDescription(interface.protocol, selector, false, true).name != nil
         guard described else { throw CallError("the service interface no longer has operationWithConfig:completion:") }
 
-        let connection = NSXPCConnection(machServiceName: serviceName, options: [])
+        do {
+            try AppleIntelligenceModelRoute.send(timeout: timeout) { service, timeout in
+                try send(config, to: service, interface: interface, selector: selector, timeout: timeout)
+            }
+        } catch let failure as AppleIntelligenceModelRoute.SecondTryFailure {
+            // A worker refusal has no domain or code, so the first try joins its text.
+            if let second = failure.error as? CallError {
+                throw CallError("\(second.description); \(failure.firstTry)")
+            }
+            throw failure.withFirstTry
+        }
+    }
+
+    /// One try at one Mach service.
+    private static func send(_ config: [String: Any], to service: String, interface: NSXPCInterface,
+                             selector: Selector, timeout: TimeInterval) throws {
+        let connection = NSXPCConnection(machServiceName: service, options: [])
         connection.remoteObjectInterface = interface
         connection.resume()
 
@@ -115,7 +134,7 @@ enum UnifiedAssetCalls {
         let waited = done.wait(timeout: .now() + timeout)
         connection.invalidate()
         guard waited == .success else {
-            throw CallError("no reply from \(serviceName) in \(Int(timeout)) seconds; the request may still have run")
+            throw CallError("no reply from \(service) in \(Int(timeout)) seconds; the request may still have run")
         }
         if let replyError { throw replyError }
     }
```

**File**: `PurgeTests/AppleIntelligenceModelRouteTests.swift` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+import Foundation
+import Testing
+@testable import Purge
+
+/// The asset worker sends each request through `AppleIntelligenceModelRoute`
+/// (#343). A reset names the model sets to release, so what matters here is
+/// that a request is repeated only after a refused or dropped connection,
+/// only once, and only through the second service.
+@Suite("A refused Apple Intelligence request goes once through the second service, and nothing else is sent again")
+struct AppleIntelligenceModelRouteTests {
+    private typealias Route = AppleIntelligenceModelRoute
+
+    /// Stands in for the worker's own refusals and its timeout, which are
+    /// Swift errors.
+    private struct WorkerRefusal: Error {}
+
+    /// Plays one outcome per try, on a clock that only the tries move.
+    private final class Tries {
+        struct Outcome {
+            var error: Error?
+            var seconds: TimeInterval = 0
+        }
+
+        private(set) var services: [String] = []
+        private(set) var timeouts: [TimeInterval] = []
+        private var clock = Date(timeIntervalSinceReferenceDate: 0)
+        private var outcomes: [Outcome]
+
+        init(_ outcomes: [Outcome]) { self.outcomes = outcomes }
+
+        /// The error the route threw, or nil when the request went through.
+        func send(timeout: TimeInterval) -> Error? {
+            do {
+                try Route.send(timeout: timeout, now: { self.clock }) { service, timeout in
+                    self.services.append(service)
+                    self.timeouts.append(timeout)
+                    let outcome = self.outcomes.isEmpty ? Outcome() : self.outcomes.removeFirst()
+                    self.clock = self.clock.addingTimeInterval(outcome.seconds)
+                    if let error = outcome.error { throw error }
+                }
+                return nil
+            } catch {
+                return error
+            }
+        }
+    }
+
+    private func connectionError(_ code: Int) -> NSError {
+        NSError(domain: NSCocoaErrorDomain, code: code)
+    }
+
+    private var lockReply: NSError {
+        NSError(domain: "com.apple.UnifiedAssetFramework", code: -1,
+                userInfo: [NSLocalizedDescriptionKey: "Could not eliminate as there are current locks"])
+    }
+
+    /// The names are Apple's. A change here is a change to where a release goes.
+    @Test func theTwoServicesAreApplesAssetServices() {
+        #expect(Route.subscriptionService == "com.apple.siri.uaf.subscription.service")
+        #expect(Route.forwardingService == "com.apple.siri.uaf.service")
+    }
+
+    /// macOS 26 and 27.0 to 27.2: the first service takes the request, and
+    /// the second is never asked.
+    @Test func aRequestTheFirstServiceTakesGoesOutOnce() {
+        let tries = Tries([.init()])
+        #expect(tries.send(timeout: 120) == nil)
+        #expect(tries.services == [Route.subscriptionService])
+        #expect(tries.timeouts == [120])
+    }
+
+    /// 4097 is what macOS 27.3 answers Purge with, and 4099 is a service that
+    /// could not be reached.
+    @Test(arguments: [NSXPCConnectionInterrupted, NSXPCConnectionInvalid])
+    func aRefusedOrDroppedConnectionGoesOnceThroughTheSecondService(code: Int) {
+        let tries = Tries([.init(error: connectionError(code)), .init()])
+        #expect(tries.send(timeout: 120) == nil)
+        #expect(tries.services == [Route.subscriptionService, Route.forwardingService])
+    }
+
+    /// The second service is the last one. Its failure keeps its own domain
+    /// and code and carries the first refusal for the details.
+    @Test func nothingIsSentAThirdTime() throws {
+        let tries = Tries([
+            .init(error: connectionError(NSXPCConnectionInterrupted)),
+            .init(error: connectionError(NSXPCConnectionInvalid)),
+            .init(),
+        ])
+        let failure = try #require(tries.send(timeout: 120) as? Route.SecondTryFailure)
+        #expect(tries.services == [Route.subscriptionService, Route.forwardingService])
+        #expect(failure.firstTry
+            == "com.apple.siri.uaf.subscription.service refused the connection first (NSCocoaErrorDomain 4097)")
+        let reported = failure.withFirstTry
+        #expect(reported.domain == NSCocoaErrorDomain)
+        #expect(reported.code == NSXPCConnectionInvalid)
+        #expect(reported.userInfo[Route.firstTryKey] as? String == failure.firstTry)
+    }
+
+    /// An error reply is the service's answer to this request. The lock reply
+    /// is the one Purge reads, and a second service would only repeat it.
+    @Test func theServicesOwnAnswerIsNeverSentAgain() throws {
+        let tries = Tries([.init(error: lockReply), .init()])
+        let error = try #require(tries.send(timeout: 120)) as NSError
+        #expect(tries.services == [Route.subscriptionService])
+        #expect(error.domain == "com.apple.UnifiedAssetFramework")
+        #expect(error.code == -1)
+    }
+
+ 
```

**File**: `PurgeTests/AppleIntelligenceModelStoreTests.swift` (modified, +29/-0)
```diff
@@ -535,6 +535,35 @@ struct AppleIntelligenceModelStoreTests {
         #expect(fine.result["assetType"] as? String == "x")
     }
 
+    /// From macOS 27.3 the worker sends a refused request once more through
+    /// siriknowledged. When that fails too, the reply carries the second
+    /// error's domain and code and names the first try somewhere in its text,
+    /// so the row and the lock check read the service's own answer and the
+    /// details include the first try.
+    @Test func aReplyAfterTheSecondServiceReadsAsThatServicesAnswer() {
+        let firstTry = "PurgeFirstTry: com.apple.siri.uaf.subscription.service refused the connection first (NSCocoaErrorDomain 4097)"
+        let locked = AppleIntelligenceWorker.outcome(fromReply: [
+            "ok": false,
+            "error": "com.apple.UnifiedAssetFramework -1: Could not eliminate as there are current locks; \(firstTry)",
+            "errorDomain": "com.apple.UnifiedAssetFramework",
+            "errorCode": -1,
+            "errorSummary": "com.apple.UnifiedAssetFramework -1: Could not eliminate as there are current locks",
+        ])
+        #expect(!locked.isConnectionDrop)
+        #expect(locked.problem == "com.apple.UnifiedAssetFramework -1: Could not eliminate as there are current locks")
+        #expect(locked.detailLine(op: "reset", subject: "a").contains(firstTry))
+
+        let refusedTwice = AppleIntelligenceWorker.outcome(fromReply: [
+            "ok": false,
+            "error": "NSCocoaErrorDomain 4099: x; \(firstTry)",
+            "errorDomain": NSCocoaErrorDomain,
+            "errorCode": 4099,
+            "errorSummary": "NSCocoaErrorDomain 4099: x",
+        ])
+        #expect(refusedTwice.isConnectionDrop)
+        #expect(refusedTwice.problem == String(localized: "macOS's asset service couldn't be reached"))
+    }
+
     /// The row has room for one short reason. The three ways the connection to
     /// the service fails get plain words; any other error keeps its own first
     /// part and drops the userInfo, which is in the details.
```

**File**: `SECURITY.md` (modified, +4/-0)
```diff
@@ -143,6 +143,10 @@ and the one change it makes that outlasts the app:
   it to release the model sets, the other asks for them back. They run in a
   separate helper, `io.getpurge.assetworker`, started once per call and gone
   after it, so a change in a future macOS crashes that helper and not Purge.
+  When that service refuses or drops the connection, the helper sends the
+  same request once more through Apple's `com.apple.siri.uaf.service`, which
+  passes it on. From macOS 27.3 the first service refuses every app Apple
+  didn't sign, so there each request takes the second route.
   Purge checks that macOS still names each set as expected before sending
   anything, and never sends a release with an empty list, which macOS would
   read as every asset on the Mac.
```

**File**: `purge.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -26,6 +26,7 @@
 		957945A658563B63C6ADC1D7 /* HelperSupport.swift in Sources */ = {isa = PBXBuildFile; fileRef = 8A21D7856EC3D4A4B450ABCB /* HelperSupport.swift */; };
 		AA10C0DE0001000000000005 /* PurgeAssetWorkerMain.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA10C0DE0001000000000002 /* PurgeAssetWorkerMain.swift */; };
 		AA10C0DE0001000000000006 /* UnifiedAssetCalls.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA10C0DE0001000000000003 /* UnifiedAssetCalls.swift */; };
+		AA10C0DE0001000000000020 /* AppleIntelligenceModelRoute.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA10C0DE0001000000000021 /* AppleIntelligenceModelRoute.swift */; };
 		AA10C0DE0001000000000007 /* io.getpurge.assetworker in Embed Asset Worker */ = {isa = PBXBuildFile; fileRef = AA10C0DE0001000000000001 /* io.getpurge.assetworker */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
 		AB099A00000000000000B001 /* AppFolders.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB099A00000000000000F001 /* AppFolders.swift */; };
 		AB127A00000000000000B001 /* MacOSInstallLeftovers.swift in Sources */ = {isa = PBXBuildFile; fileRef = AB127A00000000000000F001 /* MacOSInstallLeftovers.swift */; };
@@ -142,6 +143,7 @@
 		AA10C0DE0001000000000002 /* PurgeAssetWorkerMain.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = PurgeAssetWorkerMain.swift; sourceTree = "<group>"; };
 		AA10C0DE0001000000000003 /* UnifiedAssetCalls.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; path = UnifiedAssetCalls.swift; sourceTree = "<group>"; };
 		AA10C0DE0001000000000004 /* Info.plist */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
+		AA10C0DE0001000000000021 /* AppleIntelligenceModelRoute.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = AppleIntelligenceModelRoute.swift; path = purge/Services/AppleIntelligenceModelRoute.swift; sourceTree = SOURCE_ROOT; };
 		AB099A00000000000000F001 /* AppFolders.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = AppFolders.swift; path = purge/Services/AppFolders.swift; sourceTree = SOURCE_ROOT; };
 		AB127A00000000000000F001 /* MacOSInstallLeftovers.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = MacOSInstallLeftovers.swift; path = purge/PrivilegedHelper/MacOSInstallLeftovers.swift; sourceTree = "<group>"; };
 		AB143A00000000000000F001 /* AppBundleReach.swift */ = {isa = PBXFileReference; includeInIndex = 1; lastKnownFileType = sourcecode.swift; name = AppBundleReach.swift; path = purge/Services/AppBundleReach.swift; sourceTree = SOURCE_ROOT; };
@@ -294,6 +296,7 @@
 			children = (
 				AA10C0DE0001000000000002 /* PurgeAssetWorkerMain.swift */,
 				AA10C0DE0001000000000003 /* UnifiedAssetCalls.swift */,
+				AA10C0DE0001000000000021 /* AppleIntelligenceModelRoute.swift */,
 				AA10C0DE0001000000000004 /* Info.plist */,
 			);
 			path = PurgeAssetWorker;
@@ -533,6 +536,7 @@
 			files = (
 				AA10C0DE0001000000000005 /* PurgeAssetWorkerMain.swift in Sources */,
 				AA10C0DE0001000000000006 /* UnifiedAssetCalls.swift in Sources */,
+				AA10C0DE0001000000000020 /* AppleIntelligenceModelRoute.swift in Sources */,
 			);
 			runOnlyForDeploymentPostprocessing = 0;
 		};
```

**File**: `purge/Services/AppleIntelligenceModelRoute.swift` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import Foundation
+
+/// Which of Apple's two asset services a request for the Apple Intelligence
+/// models goes to, and when it is sent a second time (#343).
+///
+/// From macOS 27.3 the subscription service takes connections only from
+/// clients Apple signed and drops Purge's. siriknowledged's service has the
+/// same interface and passes `operationWithConfig:` on unchanged, so a
+/// refused request goes out once more through it. Found by pdfux and shipped
+/// first by RemoveMacAI (github.com/omlahore/RemoveMacAI, MIT, its issue 123).
+/// On macOS 27.0 siriknowledged logs each request as "proxying to
+/// subscription service", and the subscription service then logs the same
+/// subscriber and names it was sent.
+///
+/// The second try is not limited to 27.3. On any macOS it follows a refused
+/// or dropped first connection, and it sends the same request, so it can
+/// never name more than the first try did.
+///
+/// The rule is kept here, apart from the private calls in `PurgeAssetWorker/`,
+/// so the unit tests can run it. The asset worker compiles this file too, so
+/// it uses Foundation only.
+nonisolated enum AppleIntelligenceModelRoute {
+    /// assetsubscriptiond's service, which does the work.
+    static let subscriptionService = "com.apple.siri.uaf.subscription.service"
+    /// siriknowledged's service, which passes each operation on to `subscriptionService`.
+    static let forwardingService = "com.apple.siri.uaf.service"
+
+    /// A second try is not started with less time left than this.
+    static let leastSecondsForSecondTry: TimeInterval = 1
+
+    /// The userInfo key that carries the first refusal on a second failure.
+    static let firstTryKey = "PurgeFirstTry"
+
+    /// Both services failed. `error` is the second service's and `firstTry`
+    /// says how the first refused.
+    nonisolated struct SecondTryFailure: Error {
+        let error: Error
+        let firstTry: String
+
+        /// The second error with its own domain and code, which Purge reads,
+        /// and the first try in its userInfo for the details.
+        var withFirstTry: NSError {
+            let second = error as NSError
+            var userInfo = second.userInfo
+            userInfo[AppleIntelligenceModelRoute.firstTryKey] = firstTry
+            return NSError(domain: second.domain, code: second.code, userInfo: userInfo)
+        }
+    }
+
+    /// Whether `error` says the connection was dropped or never made, rather
+    /// than the service answering or the wait running out. The worker's own
+    /// refusals and its timeout are Swift errors, which are never in
+    /// `NSCocoaErrorDomain`.
+    static func isRefusedConnection(_ error: Error) -> Bool {
+        let nsError = error as NSError
+        return nsError.domain == NSCocoaErrorDomain
+            && (nsError.code == NSXPCConnectionInterrupted || nsError.code == NSXPCConnectionInvalid)
+    }
+
+    /// Runs `attempt` on the subscription service. When that connection is
+    /// refused or dropped, runs it once more on the forwarding service with
+    /// the time that is left, and never a third time.
+    ///
+    /// Both tries share `timeout`, so the wait is no longer than one try's.
+    /// An error reply is the service's own answer and is not sent again. A
+    /// timeout is not sent again either, because the request may still be
+    /// running. A dropped connection can also mean the request ran. It is
+    /// sent again all the same, because a reset, an unsubscribe and a
+    /// subscribe are each safe to repeat.
+    ///
+    /// Throws the first error when there is no second try, and a
+    /// `SecondTryFailure` when the second try fails too.
+    static func send(timeout: TimeInterval, now: () -> Date = { Date() },
+                     attempt: (_ service: String, _ timeout: TimeInterval) throws -> Void) throws {
+        let deadline = now().addingTimeInterval(timeout)
+        do {
+            try attempt(subscriptionService, timeout)
+        } catch {
+            let remaining = deadline.timeIntervalSince(now())
+            guard isRefusedConnection(error), remaining >= leastSecondsForSecondTry else { throw error }
+            let refused = error as NSError
+            let firstTry = "\(subscriptionService) refused the connection first (\(refused.domain) \(refused.code))"
+            do {
+                try attempt(forwardingService, remaining)
+            } catch {
+                throw SecondTryFailure(error: error, firstTry: firstTry)
+            }
+        }
+    }
+}
```

---

### Incident Patch 2: `61e8c011` (2026-11-20)
**Commit Message**: fix: refuse shape-matched cache rows reached through a link (#424) (#425)

* fix: refuse shape-matched cache rows reached through a link (#424)

Nine rules in DeletionSafetyPolicy.evaluate allow a path by its shape and
have no allowlist entry, so the link check from #422 did not cover them:
Application Support caches, Chromium caches in ~/.gemini, container
caches, Telegram media, gem downloads, unfinished downloads, editor
workspace storage, old CLI versions and Gradle leftovers. With an app's
Crashpad folder a link to ~/Documents, the row named Crashpad/completed
and the move took ~/Documents/completed.

shapeLinkRefusesDeletion refuses such a path when the folder its rule
names, or any folder above the path up to home, is a link. It is the #422
rule with the named folder in place of the entry. isOfferedForCleanup
asks it before its saved answers, so the scan drops the row and
FileDeleter refuses the move.

The links macOS makes in an app container are not on the way to
Data/Library/Caches, so a Mac with no link of the user's own is offered
what it was. Telegram's media folder is emptied entry by entry, so it is
read itself.

Cost per row in a Release build: 0.24 to 0.40 µs on th

**File**: `CLAUDE.md` (modified, +2/-1)
```diff
@@ -48,7 +48,8 @@ Cloud sessions run on Linux, so they can build no Swift code. Run the three Linu
   - `.unknown` is "Not Sure". It never appears in scan results, but the delete confirmation sheets can still list it.
 - Mark a path `.safe` only when it holds nothing but data its app rebuilds by itself. If it can hold settings, installed tools, keys, history, databases, projects, or offline downloads, it is `.medium` or not offered at all.
 - Every cache and Dev Tools removal goes through `DeletionSafetyPolicy.evaluate(_:)`. Never add a delete path that skips it.
-  - The allowlist compares path text, so `isOfferedForCleanup` also asks `DeletionSafetyPolicy.allowlistLinkRefusesDeletion` (#420, #422). A path in an allowlist entry is refused when the entry, or any folder above the path up to home, is a link, even a link to another drive. A link below that moves to the Trash as a link, except a folder emptied entry by entry (`~/Library/Logs/DiagnosticReports`), which is refused when it is a link itself. A simulator device is left alone, because `simctl` removes it by its UDID. A new entry is covered when it is added. The rules in `evaluate` that match by shape, like container caches, have no such check. `AllowlistLinkTests` in `PurgeTests/AllowlistAuditTests.swift` checks each case.
+  - The allowlist compares path text, so `isOfferedForCleanup` also asks `DeletionSafetyPolicy.allowlistLinkRefusesDeletion` (#420, #422). A path in an allowlist entry is refused when the entry, or any folder above the path up to home, is a link, even a link to another drive. A link below that moves to the Trash as a link, except a folder emptied entry by entry (`~/Library/Logs/DiagnosticReports`), which is refused when it is a link itself. A simulator device is left alone, because `simctl` removes it by its UDID. A new entry is covered when it is added. `AllowlistLinkTests` in `PurgeTests/AllowlistAuditTests.swift` checks each case.
+  - Nine rules in `evaluate` allow a path by its shape and have no entry: Application Support caches, Chromium caches outside it, container caches, Telegram media, gem downloads, unfinished downloads, editor workspace storage, old CLI versions and Gradle leftovers. `isOfferedForCleanup` asks `DeletionSafetyPolicy.shapeLinkRefusesDeletion` for them (#424). The rule is the same, with the folder the shape names in place of the entry (`shapeMatchedFolder`): the cache folder, a container's `Data/Library/Caches`, Telegram's `media`, a gem `cache` folder, or the entry itself. The links macOS makes in an app container are not on the way to `Caches`, so they refuse nothing. A new shape rule, or a new shape in an old one, needs a row in `shapeMatchedFolder` and in `ShapeLinkTests`. The shape rules outside home (old browser frameworks, macOS installers, the clang module cache) and the project rules, which follow #190, have no such check.
   - Items the user picks one by one have their own gate instead, because they are the user's own files and `evaluate` refuses those by design. Large Files, AI models, the uninstaller, and command-line tools go through `FileDeleter.deleteUserSelectedFiles`, which checks `LargeFileScanPolicy`, `AIModelScanPolicy`, `AppUninstallScanPolicy`, and `CommandLineToolScanPolicy`. Those gates are deletion-safety code too. They never feed Clean Safe Items or scheduled cleans.
   - Folders the user adds in Settings for Large Files and Dev Projects (#318, `ScanFolders`) follow `AppFolders.refusal(forPicked:)`, except that a whole drive may be added when it holds no `System`, `Users`, `Backups.backupdb` or APFS Time Machine backup. Only local disks count (`AppFolders.isOnLocalDisk`), so never a network share or a macFUSE mount. They widen two gates and nothing else: `LargeFileScanPolicy.isEligibleForDeletion`, which reads the list from disk at delete time and also needs the file on a local disk, and the catalog rule in `isWhitelistedProjectArtifactPath`, which reads `ScanFolders.snapshot`, refreshed at each project scan and at the start of `FileDeleter.deleteItems`. The name-only rule and agent worktrees stay home only. Below an added folder, both walks and both gates skip a copy of a Mac, a home folder (`Library` beside `Desktop`, `Documents` or `Downloads`) or a Time Machine backup, and a folder another sync service keeps (`ScanFolders.isOffLimits`); the project rule also refuses a `Library` folder or a bundle between the added folder and the project, and the project walk never enters a bundle. A pick in or above another sync service's folder is refused like iCloud Drive. Projects in a folder added outside the home folder are Check First (`ProjectCheckFirstReason.addedFolder`), judged by real path too, so a home folder linked onto an added drive counts, `countsAsSafeCleanup` refuses them even when overridden to Safe, and `manualSafeCleanupCandidates` drops any path inside such a saved folder, plugged in or not, so Clean Safe Items and scheduled cleans never reach them. A folder added insid
```

**File**: `PurgeTests/AllowlistAuditTests.swift` (modified, +495/-0)
```diff
@@ -1741,6 +1741,501 @@ struct AllowlistLinkTests {
     }
 }
 
+// MARK: - Shape-matched rows reached through a link (#424)
+
+/// The rules in `evaluate` that allow a path by its shape compare text, like
+/// the allowlist. With an app's `Crashpad` folder a link to `~/Documents`, a
+/// move would take `~/Documents/completed`, so only
+/// `shapeLinkRefusesDeletion` catches it. Every test builds its own home.
+@Suite("Shape-matched rows reached through a link (#424)")
+struct ShapeLinkTests {
+    private static let appSupport = "Library/Application Support"
+    private static let container = "Library/Containers/com.example.app/Data/Library/Caches"
+    private static let telegram = CacheDiscoveryPaths.telegramGroupContainerRelative
+    private static let profile = DeletionSafetyPolicy.chromiumUserDataStores[0].relative
+    private static let workerVersions = "\(DeletionSafetyPolicy.cursorAgentWorkerCLI)/.local/share/cursor-agent/versions"
+
+    /// One path per shape a rule allows, relative to home, with the folder the
+    /// rule names for it. `readsDisk` marks the two rules that also look at
+    /// what is in the folder, so their text can't be asked without one.
+    private static let rows: [(row: String, folder: String, readsDisk: Bool)] = [
+        ("\(appSupport)/Foo/Cache", "\(appSupport)/Foo/Cache", true),
+        ("\(appSupport)/Foo/Code Cache", "\(appSupport)/Foo/Code Cache", true),
+        ("\(appSupport)/Foo/Crashpad/completed", "\(appSupport)/Foo/Crashpad/completed", true),
+        ("\(appSupport)/Foo/web/Crashpad/pending", "\(appSupport)/Foo/web/Crashpad/pending", true),
+        ("\(appSupport)/Foo/User Data/GPUCache", "\(appSupport)/Foo/User Data/GPUCache", true),
+        ("\(appSupport)/Foo/User Data/Default/Code Cache", "\(appSupport)/Foo/User Data/Default/Code Cache", true),
+        ("\(appSupport)/Google/Chrome Beta/Default/Cache", "\(appSupport)/Google/Chrome Beta/Default/Cache", true),
+        ("\(profile)/GPUCache", "\(profile)/GPUCache", true),
+        ("\(profile)/GPUCache/data_0", "\(profile)/GPUCache", true),
+        ("\(profile)/Default/Cache", "\(profile)/Default/Cache", true),
+        ("\(profile)/Default/Cache/Cache_Data/f_0001", "\(profile)/Default/Cache", true),
+        (container, container, false),
+        ("\(container)/com.example.app", container, false),
+        ("\(container)/com.example.app/fsCachedData/a", container, false),
+        ("\(telegram)/stable/account-1/postbox/media", "\(telegram)/stable/account-1/postbox/media", false),
+        ("\(telegram)/stable/account-1/postbox/media/photo.jpg", "\(telegram)/stable/account-1/postbox/media", false),
+        ("\(telegram)/account-2/postbox/media/a/b", "\(telegram)/account-2/postbox/media", false),
+        (".gem/ruby/3.3.0/cache", ".gem/ruby/3.3.0/cache", false),
+        (".gem/ruby/3.3.0/cache/rake-13.0.6.gem", ".gem/ruby/3.3.0/cache", false),
+        ("Downloads/movie.mkv.crdownload", "Downloads/movie.mkv.crdownload", false),
+        ("Downloads/archive.zip.part", "Downloads/archive.zip.part", false),
+        ("Downloads/Big.dmg.download", "Downloads/Big.dmg.download", false),
+        ("Downloads/Big.dmg.download/Info.plist", "Downloads/Big.dmg.download", false),
+        ("\(appSupport)/Code/User/workspaceStorage/0a1b2c3d", "\(appSupport)/Code/User/workspaceStorage/0a1b2c3d", false),
+        ("\(appSupport)/Cursor/User/workspaceStorage/4e5f6a7b", "\(appSupport)/Cursor/User/workspaceStorage/4e5f6a7b", false),
+        (".local/share/claude/versions/2.0.1", ".local/share/claude/versions/2.0.1", false),
+        (".local/share/cursor-agent/versions/2026.01.02-abc/node_modules", ".local/share/cursor-agent/versions/2026.01.02-abc", false),
+        ("\(workerVersions)/2026.01.02-abc", "\(workerVersions)/2026.01.02-abc", false),
+        (".grok/downloads/grok-1.0.13", ".grok/downloads/grok-1.0.13", false),
+        (".gradle/daemon/8.10.2", ".gradle/daemon/8.10.2", false),
+        (".gradle/.tmp", ".gradle/.tmp", false),
+    ]
+
+    /// A temporary home, with a `Developer` folder beside it for links to point at.
+    private static func makeHome() throws -> (base: URL, home: URL, elsewhere: URL) {
+        let fm = FileManager.default
+        let base = fm.temporaryDirectory.appendingPathComponent("shape-link-\(UUID().uuidString)", isDirectory: true)
+        let home = base.appendingPathComponent("home", isDirectory: true)
+        let elsewhere = base.appendingPathComponent("Developer", isDirectory: true)
+        try fm.createDirectory(at: home, withIntermediateDirectories: true)
+        try fm.createDirectory(at: elsewhere, withIntermediateDirectories: true)
+        return (base, home, elsewhere)
+    }
+
+    private static func refuses(_ relative: String, home: URL, reuseRecentRead: Bool = false) -> Bool {
+        DeletionSafetyPolicy.shapeLinkRefusesDeletion(
+            standardizedPath: home.appendingPathComponent(relative).standardizedFileURL.path,
+            home: ho
```

**File**: `docs/safety-notes.md` (modified, +72/-0)
```diff
@@ -11,6 +11,78 @@ that belongs here, [SECURITY.md](../SECURITY.md) says how to report it.
 
 Newest first.
 
+## 2026-11-20: Shape-matched cache rows followed a link to another folder
+
+**Found internally** while fixing [#422](https://github.com/jithin-sabu/purge-app/issues/422) ([#424](https://github.com/jithin-sabu/purge-app/issues/424)), no report. **Fixed:** [#425](https://github.com/jithin-sabu/purge-app/pull/425), not shipped yet. **Affected:** v1.1.2 to v1.16.2.
+
+### What happened
+
+The fix for #422 covered the entries in the allowlist. Nine rules allow a path
+by its shape and have no entry, so they kept the same gap: Application Support
+caches, Chromium caches in `~/.gemini`, container caches, Telegram media, gem
+downloads, unfinished downloads, editor workspace storage, old CLI versions and
+Gradle's daemon logs. Each compares path text and never checked whether a
+folder on the way was a link.
+
+If an app's `Crashpad` folder in Application Support was a link to
+`~/Documents`, the row named `Crashpad/completed`, the name matched, and the
+move took `~/Documents/completed`. A container whose `Data` folder was a link,
+a linked `~/.gem`, or VS Code's `User` folder kept in a dotfiles folder did the
+same: the scan listed rows through the link and the move took what was behind
+it.
+
+Where the scan lists a folder itself, as it does `~/Downloads` and
+`Application Support`, a link there gave no rows. The gate still allowed the
+path by its text, so a link made after the scan was followed.
+
+Gradle's daemon logs and temp folder were the one group already safe:
+`gradleLeftoverRefusesDeletion` asks for real folders at every step.
+
+### Who was affected
+
+Nobody reported a loss. It took a link on the way to a row, and macOS makes
+none there. The links it puts in every app container (`Data/Desktop`,
+`Data/Library/Fonts` and the rest) are not on the way to `Data/Library/Caches`:
+on the Mac this was checked on, all 788 containers had a real `Data`,
+`Data/Library` and `Data/Library/Caches`. A link of the user's own usually led
+to the real cache on another drive. Anything moved went to the Trash and could
+be put back.
+
+### What changed
+
+`DeletionSafetyPolicy.shapeLinkRefusesDeletion` refuses a path one of the nine
+rules can allow when the folder the rule names, or any folder above the path up
+to home, is a link. `shapeMatchedFolder` finds that folder by text: the cache
+folder, a container's `Caches`, Telegram's `media`, a gem `cache` folder, or
+the entry itself for a download, a workspace or a CLI version.
+`isOfferedForCleanup` asks it outside its saved answers, next to the allowlist
+guard, so the scan drops the row and `FileDeleter` refuses the move even when
+the link appeared after the scan.
+
+A link lower down refuses nothing, because it moves to the Trash as a link.
+Telegram's `media` folder is emptied entry by entry and never moved, so it is
+refused when it is a link itself. Folders above a row are found as bytes, as
+in #423, so a name that starts with a combining mark hides none of them.
+
+A Mac with a link on the way to one of these rows no longer gets that row. The
+issue lists them. Nothing changes for unfinished downloads or Gradle, which
+were not offered through a link before.
+
+### What would have caught it earlier
+
+The #422 fixture, run for the rules that have no allowlist entry.
+`ShapeLinkTests` in
+[`PurgeTests/AllowlistAuditTests.swift`](../PurgeTests/AllowlistAuditTests.swift)
+builds a temporary home and checks each rule with a folder above the row
+linked, the named folder linked, a link inside it and nothing linked.
+`everyDiscoveredApplicationSupportCacheIsGuarded` and
+`everyDiscoveredChromiumUserDataCacheIsGuarded` fail if the scan lists a cache
+the guard does not read, and `everyPathATextRuleAllowsIsGuarded` fails if a
+text rule allows a path the guard has no folder for.
+`theLinksMacOSMakesInAContainerRefuseNothing` keeps the guard off a normal Mac.
+`aNameThatStartsWithACombiningMarkHidesNoFolder` checks the byte walk for each
+rule.
+
 ## 2026-11-19: Allowlisted rows followed a link to another folder
 
 **Found internally** while fixing [#420](https://github.com/jithin-sabu/purge-app/issues/420) ([#422](https://github.com/jithin-sabu/purge-app/issues/422)), no report. **Fixed:** [#423](https://github.com/jithin-sabu/purge-app/pull/423), not shipped yet. **Affected:** v1.1.0 to v1.16.2.
```

**File**: `purge/Services/DeletionSafetyPolicy.swift` (modified, +219/-1)
```diff
@@ -519,6 +519,8 @@ enum DeletionSafetyPolicy {
         // the scan (#420, #422). Same split as Playwright: the on-screen filter may
         // reuse a read from the last few seconds, and a move reads the disk again.
         if allowlistLinkRefusesDeletion(standardizedPath: key, reuseRecentRead: Thread.isMainThread) { return false }
+        // The rules that allow a path by its shape compare text too (#424).
+        if shapeLinkRefusesDeletion(standardizedPath: key, reuseRecentRead: Thread.isMainThread) { return false }
         if prekToolsRefuseDeletion(url) { return false }
         if mailRunningRefusesDeletion(url) { return false }
         // A daemon's log stays while it runs, and a temp file until it is old.
@@ -698,7 +700,25 @@ enum DeletionSafetyPolicy {
         // The lowest folder that has to be real: the row itself when it is the
         // entry or is emptied entry by entry, else the folder the row sits in.
         let contentsOnly = home == cachedHomePath ? cachedContentsOnlyPrefixes : contentsOnlyPrefixes(home: home)
-        let folder = path == entry || contentsOnly.contains(path) ? path : PathContainment.parentFolder(of: path)
+        return rowReachesThroughLink(
+            path,
+            readsRowItself: path == entry || contentsOnly.contains(path),
+            home: home,
+            reuseRecentRead: reuseRecentRead
+        )
+    }
+
+    /// The walk both link guards share. `readsRowItself` is true for a row that
+    /// is the folder its rule names, an allowlist entry or the folder a shape
+    /// rule matched, and for a folder emptied entry by entry. Any other row
+    /// may be a link itself, so the walk stops at the folder it sits in.
+    private nonisolated static func rowReachesThroughLink(
+        _ path: String,
+        readsRowItself: Bool,
+        home: String,
+        reuseRecentRead: Bool
+    ) -> Bool {
+        let folder = readsRowItself ? path : PathContainment.parentFolder(of: path)
         guard reuseRecentRead else { return PathContainment.reachesThroughLink(folder, home: home) }
 
         let now = ProcessInfo.processInfo.systemUptime
@@ -715,6 +735,204 @@ enum DeletionSafetyPolicy {
         return refuses
     }
 
+    // MARK: - Shape-matched rows reached through a link (#424)
+
+    /// The folders the shape rules below look in, relative to home and ending
+    /// in `/`. A path under none of them matches none of the rules. The stores
+    /// come from their own lists, so a new one is covered when it is added.
+    nonisolated static let shapeRuleRoots: [String] = [
+        "Library/Application Support/",
+        "Library/Containers/",
+        "\(CacheDiscoveryPaths.telegramGroupContainerRelative)/",
+        "Downloads/",
+        ".gem/ruby/",
+        ".gradle/"
+    ]
+        + chromiumUserDataStores.map { "\($0.relative)/" }
+        + cliVersionStores.map { "\($0.versions)/" }
+        + EditorWorkspaceStoragePolicy.relativeRoots.map { "\($0.relative)/" }
+
+    /// `shapeRuleRoots` by their first folder, so a row in `~/Library/Caches` or
+    /// in a project costs one lookup and three comparisons. A root inside
+    /// another is left out.
+    private nonisolated static let shapeRuleRootsByFirstFolder: [Substring: [String]] = {
+        var index: [Substring: [String]] = [:]
+        for root in shapeRuleRoots where !shapeRuleRoots.contains(where: { $0 != root && root.hasPrefix($0) }) {
+            index[Substring(String(firstFolder(of: root[...]))), default: []].append(root)
+        }
+        return index
+    }()
+
+    /// Every name an Application Support cache row can end in: the cache names
+    /// `CacheDiscoveryPaths.isApplicationSupportCachePath` accepts. Crash report
+    /// folders are matched by their last two names, and the fixed paths in
+    /// `applicationSupportRelativeCachePaths` whole.
+    private nonisolated static let applicationSupportCacheFolderNames: Set<String> =
+        CacheDiscoveryPaths.applicationSupportDirectCacheNames.union(CacheDiscoveryPaths.chromiumProfileCacheNames)
+
+    /// `path` when it could be a row of `isWhitelistedApplicationSupportCachePath`,
+    /// by its names alone. That rule reads the disk and allows only the cache or
+    /// crash report folder itself, never a path inside one, so the row is the
+    /// folder the rule names. Wider than the rule on purpose: it never reads.
+    private nonisolated static func applicationSupportCacheFolder(_ path: String, home: String) -> String? {
+        let prefix = "\(home)/Library/Application Support/"
+        guard path.hasPrefix(prefix) else { return nil }
+        // Split as the rule splits it: the app's folder, then the names it judges.
+        let parts = path.dropFirst(prefix.count).split(separator: "/")
+        guard parts.count >= 2, let name = parts.last else { return nil }
+        if applicationSupportCacheFolderNames.contains(String(name)) { return path }
+        if CacheDiscoveryPaths.applicationSupp
```

---

### Incident Patch 3: `f4d9fcc0` (2026-11-20)
**Commit Message**: fix: refuse allowlisted rows reached through a link (#422) (#423)

* fix: refuse allowlisted rows reached through a link (#422)

The allowlist compares path text. #420 closed the gap for the entries
under ~/.cache. Every other entry still had it: with ~/.gradle a link to
~/Developer, the row named ~/.gradle/caches and the move took
~/Developer/caches.

allowlistLinkRefusesDeletion refuses a path in an allowlist entry when
the entry, or any folder above the path up to home, is a link.
isOfferedForCleanup asks it outside its saved answers, so the scan drops
the row and FileDeleter refuses the move. It replaces the ~/.cache and
prek checks, which now ask it for their own folders.

A link lower down refuses nothing: it moves to the Trash as a link. A
simulator device is left alone, because simctl removes it by its UDID.
A folder that can't be read is refused.

A path in no entry costs a dictionary lookup. Any other is read with
lstat: 1.2 µs for a row in ~/Library/Caches, against 12.5 µs through
URL. On the main thread a read from the last 10 s is reused. A move
always reads again.

A Mac with no link on the way to a row is offered what it was before.
A cache linked to another drive is

**File**: `CLAUDE.md` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ Cloud sessions run on Linux, so they can build no Swift code. Run the three Linu
   - `.unknown` is "Not Sure". It never appears in scan results, but the delete confirmation sheets can still list it.
 - Mark a path `.safe` only when it holds nothing but data its app rebuilds by itself. If it can hold settings, installed tools, keys, history, databases, projects, or offline downloads, it is `.medium` or not offered at all.
 - Every cache and Dev Tools removal goes through `DeletionSafetyPolicy.evaluate(_:)`. Never add a delete path that skips it.
+  - The allowlist compares path text, so `isOfferedForCleanup` also asks `DeletionSafetyPolicy.allowlistLinkRefusesDeletion` (#420, #422). A path in an allowlist entry is refused when the entry, or any folder above the path up to home, is a link, even a link to another drive. A link below that moves to the Trash as a link, except a folder emptied entry by entry (`~/Library/Logs/DiagnosticReports`), which is refused when it is a link itself. A simulator device is left alone, because `simctl` removes it by its UDID. A new entry is covered when it is added. The rules in `evaluate` that match by shape, like container caches, have no such check. `AllowlistLinkTests` in `PurgeTests/AllowlistAuditTests.swift` checks each case.
   - Items the user picks one by one have their own gate instead, because they are the user's own files and `evaluate` refuses those by design. Large Files, AI models, the uninstaller, and command-line tools go through `FileDeleter.deleteUserSelectedFiles`, which checks `LargeFileScanPolicy`, `AIModelScanPolicy`, `AppUninstallScanPolicy`, and `CommandLineToolScanPolicy`. Those gates are deletion-safety code too. They never feed Clean Safe Items or scheduled cleans.
   - Folders the user adds in Settings for Large Files and Dev Projects (#318, `ScanFolders`) follow `AppFolders.refusal(forPicked:)`, except that a whole drive may be added when it holds no `System`, `Users`, `Backups.backupdb` or APFS Time Machine backup. Only local disks count (`AppFolders.isOnLocalDisk`), so never a network share or a macFUSE mount. They widen two gates and nothing else: `LargeFileScanPolicy.isEligibleForDeletion`, which reads the list from disk at delete time and also needs the file on a local disk, and the catalog rule in `isWhitelistedProjectArtifactPath`, which reads `ScanFolders.snapshot`, refreshed at each project scan and at the start of `FileDeleter.deleteItems`. The name-only rule and agent worktrees stay home only. Below an added folder, both walks and both gates skip a copy of a Mac, a home folder (`Library` beside `Desktop`, `Documents` or `Downloads`) or a Time Machine backup, and a folder another sync service keeps (`ScanFolders.isOffLimits`); the project rule also refuses a `Library` folder or a bundle between the added folder and the project, and the project walk never enters a bundle. A pick in or above another sync service's folder is refused like iCloud Drive. Projects in a folder added outside the home folder are Check First (`ProjectCheckFirstReason.addedFolder`), judged by real path too, so a home folder linked onto an added drive counts, `countsAsSafeCleanup` refuses them even when overridden to Safe, and `manualSafeCleanupCandidates` drops any path inside such a saved folder, plugged in or not, so Clean Safe Items and scheduled cleans never reach them. A folder added inside home keeps the home rules. The project walk goes 12 levels below an added folder, and 4 below the built-in roots, 1 below the home folder itself (#392). Right before each project artifact moves, and again on Retry, `FileDeleter` asks `ScanFolders.permitsProjectArtifactMove`, which refuses an artifact under a saved folder that left the snapshot or now has a link in its path, and `ProjectActivityPolicy.artifactBelongsToActiveProject`, which refuses it while a process works in the project or git holds a lock there. `PurgeTests/ProjectScanDepthTests.swift` checks both. `OLLAMA_MODELS` naming `/`, home or above is ignored, and under the Ollama root the gate takes only `manifests/` files and `blobs/sha256-*`. `PurgeTests/ScanFoldersTests.swift` and `ProjectAddedFolderTests.swift` check each rule.
   - The Go Module Cache row (#397) offers Go's whole module cache, found the way Go finds it: `GOMODCACHE`, else the first `GOPATH` entry plus `pkg/mod`, else `~/go/pkg/mod`, each read from Purge's environment, then launchd, then Go's env file. Purge can't see a value set only in a shell profile, so it may offer the default folder while Go uses another; that folder still has to pass every check below. Nothing about it is in the static allowlist: `GoModuleCacheScanPolicy` is the gate, and `evaluate` allows only the folder it found. The folder must be a real local folder reached through no link. It must not be home or above, `/System` or `/private` (other spellings of real folders), under a never-delete prefix or one of the exact folders, in iCloud (Drive, CloudStorage, o
```

**File**: `PurgeTests/AllowlistAuditTests.swift` (modified, +399/-0)
```diff
@@ -1342,6 +1342,405 @@ struct OpencodeCacheTests {
     }
 }
 
+// MARK: - Allowlisted rows reached through a link (#422)
+
+/// The allowlist accepts `.gradle/caches` by its text. With `~/.gradle` a link
+/// to `~/Developer`, a move would take `~/Developer/caches`, so only
+/// `allowlistLinkRefusesDeletion` catches it. Every test builds its own home.
+@Suite("Allowlisted rows reached through a link (#422)")
+struct AllowlistLinkTests {
+    /// A temporary home, with a `Developer` folder beside it for links to point at.
+    private static func makeHome() throws -> (base: URL, home: URL, elsewhere: URL) {
+        let fm = FileManager.default
+        let base = fm.temporaryDirectory.appendingPathComponent("allowlist-link-\(UUID().uuidString)", isDirectory: true)
+        let home = base.appendingPathComponent("home", isDirectory: true)
+        let elsewhere = base.appendingPathComponent("Developer", isDirectory: true)
+        try fm.createDirectory(at: home, withIntermediateDirectories: true)
+        try fm.createDirectory(at: elsewhere, withIntermediateDirectories: true)
+        return (base, home, elsewhere)
+    }
+
+    /// Every allowlist entry, relative to home.
+    private static func entries(_ home: URL) -> [String] {
+        DeletionSafetyPolicy.whitelistedAbsolutePrefixes(home: home.path).map { String($0.dropFirst(home.path.count + 1)) }
+    }
+
+    private static func refuses(_ relative: String, home: URL) -> Bool {
+        DeletionSafetyPolicy.allowlistLinkRefusesDeletion(home.appendingPathComponent(relative), home: home.path)
+    }
+
+    private static func makeFolder(_ url: URL) throws {
+        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+    }
+
+    /// Where `relative` lands when `link`, a folder at or above it, points at `target`.
+    private static func behind(_ relative: String, link: String, target: URL) -> URL {
+        let rest = relative.dropFirst(link.count).drop { $0 == "/" }
+        return rest.isEmpty ? target : target.appendingPathComponent(String(rest), isDirectory: true)
+    }
+
+    /// The guard starts from the list itself, so a new entry is covered the day
+    /// it is added.
+    @Test
+    func everyEntryIsFoundByItsText() {
+        let home = "/Users/someone"
+        let entries = DeletionSafetyPolicy.whitelistedAbsolutePrefixes(home: home)
+        #expect(entries.count > 80)
+        for entry in entries {
+            #expect(DeletionSafetyPolicy.allowlistEntry(containing: entry, home: home) == entry, "\(entry)")
+            #expect(DeletionSafetyPolicy.allowlistEntry(containing: "\(entry)/a/b", home: home) == entry, "\(entry)")
+            #expect(DeletionSafetyPolicy.allowlistEntry(containing: "\(entry)-old", home: home) == nil, "\(entry)")
+        }
+        for other in [
+            home, "\(home)/", "\(home)/.gradle", "\(home)/.gradle/jdks", "\(home)/Library", "\(home)/Library/CachesX/a",
+            "\(home)/.cache/unknown", "\(home)2/.npm", "/Users/other/.npm", "/Library/Caches/a", "",
+        ] {
+            #expect(DeletionSafetyPolicy.allowlistEntry(containing: other, home: home) == nil, "\(other)")
+        }
+    }
+
+    /// `~/.gradle`, `~/Library` or `~/Movies` as a link: the move would take the
+    /// folder behind it.
+    @Test
+    func everyEntryIsRefusedWhenItsFirstFolderIsALink() throws {
+        let fm = FileManager.default
+        let byFirstFolder = Dictionary(grouping: Self.entries(URL(fileURLWithPath: "/Users/someone"))) {
+            String($0.split(separator: "/")[0])
+        }
+        #expect(byFirstFolder.count > 30)
+        for (first, entries) in byFirstFolder {
+            let (base, home, elsewhere) = try Self.makeHome()
+            defer { try? fm.removeItem(at: base) }
+            try fm.createSymbolicLink(at: home.appendingPathComponent(first), withDestinationURL: elsewhere)
+            for relative in entries {
+                // The folder a move would really take.
+                let behind = Self.behind(relative, link: first, target: elsewhere)
+                try Self.makeFolder(behind.appendingPathComponent("inner", isDirectory: true))
+                for path in [relative, "\(relative)/inner", "\(relative)/inner/deeper"] {
+                    #expect(Self.refuses(path, home: home), "\(path)")
+                }
+                #expect(fm.fileExists(atPath: home.appendingPathComponent("\(relative)/inner").path))
+            }
+        }
+    }
+
+    /// `~/.npm` or `DerivedData` as a link: its own row would only move the
+    /// link, and a row inside it would take what is behind.
+    @Test
+    func everyEntryIsRefusedWhenItsOwnFolderIsALink() throws {
+        let fm = FileManager.default
+        let (base, home, elsewhere) = try Self.makeHome()
+        defer { try? fm.removeItem(at: base) }
+        for (index, relative) in Self.entries(home).enumerated() {
+            let entry = home.appendingPathComponent(relative)
+     
```

**File**: `docs/safety-notes.md` (modified, +61/-0)
```diff
@@ -11,6 +11,67 @@ that belongs here, [SECURITY.md](../SECURITY.md) says how to report it.
 
 Newest first.
 
+## 2026-11-19: Allowlisted rows followed a link to another folder
+
+**Found internally** while fixing [#420](https://github.com/jithin-sabu/purge-app/issues/420) ([#422](https://github.com/jithin-sabu/purge-app/issues/422)), no report. **Fixed:** [#423](https://github.com/jithin-sabu/purge-app/pull/423), not shipped yet. **Affected:** v1.1.0 to v1.16.2.
+
+### What happened
+
+The fix for #420 covered the allowlist entries under `~/.cache`. Every other
+entry had the same gap. The allowlist compares path text, and never checked
+whether a folder on the way was a link.
+
+If `~/.gradle` was a link to `~/Developer`, the row named `~/.gradle/caches`,
+the text matched, and the move took `~/Developer/caches`. The same held for a
+row inside an entry, such as `~/.npm/_cacache` with `~/.npm` linked, or a
+JetBrains cache with `~/Library/Caches/JetBrains` linked.
+
+Many of these rows are Safe to Clean, so Clean Safe Items or a scheduled clean
+could have moved the folder behind the link without asking.
+
+An entry that was itself a link, and its own row, did less harm: the move took
+only the link. The row was still wrong. Nothing was freed, and the tool made a
+new folder on the startup disk.
+
+### Who was affected
+
+Nobody reported a loss. It took a tool folder linked to a place that held a
+folder named like a cache: `caches`, `repository`, `registry`, `pkgs`. The
+common setup, a tool folder linked to another drive, moved the cache the tool
+really used. Anything moved went to the Trash and could be put back.
+
+### What changed
+
+`DeletionSafetyPolicy.allowlistLinkRefusesDeletion` refuses a path in an
+allowlist entry when the entry, or any folder above the path up to home, is a
+link. It finds the entry in the allowlist itself, so a new row is covered when
+it is added. `isOfferedForCleanup` asks it outside its saved answers, so the
+scan drops the row and `FileDeleter` refuses the move even when the link
+appeared after the scan. The checks for `~/.cache` and prek are now this one
+check.
+
+A link lower down refuses nothing, because it moves to the Trash as a link. A
+folder emptied entry by entry is the exception: it is never moved itself, so
+`~/Library/Logs/DiagnosticReports` as a link is refused too. A simulator
+device is left alone, because `simctl` removes it by its UDID and its path is
+never moved.
+
+A Mac with a link on the way to a row no longer gets that row. That includes a
+cache linked to another drive. Offering those again would need rows that say
+where they really are, and that never go into Clean Safe Items or a scheduled
+clean.
+
+### What would have caught it earlier
+
+The #420 fixture, run for every entry and not only the ones under `~/.cache`.
+`AllowlistLinkTests` in
+[`PurgeTests/AllowlistAuditTests.swift`](../PurgeTests/AllowlistAuditTests.swift)
+builds a temporary home and checks every allowlist entry with its first folder
+linked, its own folder linked and nothing linked, and checks a folder on the
+way, a folder between an entry and a row, a link inside a folder, and a
+linked folder that is emptied entry by entry.
+`everyEntryIsFoundByItsText` fails if the guard misses an entry.
+
 ## 2026-11-19: Rows under `~/.cache` followed a link to another folder
 
 **Found internally** in review of [#417](https://github.com/jithin-sabu/purge-app/pull/417) ([#420](https://github.com/jithin-sabu/purge-app/issues/420)), no report. **Fixed:** [#421](https://github.com/jithin-sabu/purge-app/pull/421), not shipped yet. **Affected:** v1.1.0 to v1.16.2.
```

**File**: `purge/Services/DeletionSafetyPolicy.swift` (modified, +143/-32)
```diff
@@ -459,7 +459,7 @@ enum DeletionSafetyPolicy {
             // session loads its packages from here, and `bin` holds downloaded tools.
             // `~/.local/share/opencode` holds sessions, snapshots and `auth.json`, and
             // `~/.config/opencode` the settings. Neither is listed. Refused when
-            // reached through a link; see `dotCacheLinkRefusesDeletion`.
+            // reached through a link; see `allowlistLinkRefusesDeletion`.
             "\(home)/.cache/opencode",
             // The videos only. The thumbnails next to them are the covers System
             // Settings shows; deleting those blanks the wallpaper picker.
@@ -515,10 +515,10 @@ enum DeletionSafetyPolicy {
         // The Go module cache is moved whole only while it still holds nothing
         // but modules. Same split as Playwright: a move reads the folder again.
         if GoModuleCacheScanPolicy.refusesDeletion(url, reuseRecentRead: Thread.isMainThread) { return false }
-        // `~/.cache` or a cache folder in it can become a link after the scan (#420).
-        if dotCacheLinkRefusesDeletion(standardizedPath: key) { return false }
-        // Recheck before a move in case the prek store was redirected since the scan.
-        if prekStoreLinkRefusesDeletion(url) { return false }
+        // An allowlisted folder, or a folder above the row, can become a link after
+        // the scan (#420, #422). Same split as Playwright: the on-screen filter may
+        // reuse a read from the last few seconds, and a move reads the disk again.
+        if allowlistLinkRefusesDeletion(standardizedPath: key, reuseRecentRead: Thread.isMainThread) { return false }
         if prekToolsRefuseDeletion(url) { return false }
         if mailRunningRefusesDeletion(url) { return false }
         // A daemon's log stays while it runs, and a temp file until it is old.
@@ -550,12 +550,12 @@ enum DeletionSafetyPolicy {
         return verdict
     }
 
-    /// The allowlist compares path text, so if `~/.cache/prek` or `~/.cache` were a
-    /// link to `~/Developer`, its `repos`, `tools` and `cache` would be the user's own
-    /// folders. Any link on the way down from home refuses the path.
+    /// `allowlistLinkRefusesDeletion` asked for prek's store alone: `repos`,
+    /// `hooks`, `tools` and `cache` under `~/.cache/prek`.
     nonisolated static func prekStoreLinkRefusesDeletion(_ url: URL, home: String = cachedHomePath) -> Bool {
-        guard PathContainment.isInside(url.standardizedFileURL.path, "\(home)/.cache/prek") else { return false }
-        return PathContainment.containsSymlinkComponent(url, home: home)
+        let path = url.standardizedFileURL.path
+        guard PathContainment.isInside(path, "\(home)/.cache/prek") else { return false }
+        return allowlistLinkRefusesDeletion(standardizedPath: path, home: home)
     }
 
     /// Installed prek hooks can retain absolute paths to managed Rust tools.
@@ -572,39 +572,147 @@ enum DeletionSafetyPolicy {
         return isExcluded(root.appendingPathComponent("hooks", isDirectory: true))
     }
 
-    /// The allowlist entries under `~/.cache`, taken from the list itself, so a
-    /// new one is covered by `dotCacheLinkRefusesDeletion` the day it is added.
+    /// The allowlist entries under `~/.cache`, taken from the list itself.
     nonisolated static func dotCacheEntries(home: String) -> [String] {
         whitelistedPrefixes(home: home).filter { PathContainment.isInside($0, "\(home)/.cache") }
     }
 
+    /// `allowlistLinkRefusesDeletion` asked for the entries under `~/.cache`
+    /// alone (#420). With `~/.cache` a link to `~/Developer`, the move would take
+    /// `~/Developer/uv`, or `~/Developer/opencode`, which could be a clone of
+    /// that repository.
+    nonisolated static func dotCacheLinkRefusesDeletion(_ url: URL, home: String = cachedHomePath) -> Bool {
+        let path = url.standardizedFileURL.path
+        guard path.hasPrefix("\(home)/.cache/") else { return false }
+        return allowlistLinkRefusesDeletion(standardizedPath: path, home: home)
+    }
+
+    // MARK: - Rows reached through a link (#420, #422)
+
+    /// One allowlist entry, with its path below home.
+    private nonisolated struct AllowlistEntry: Sendable {
+        let path: String
+        let relative: String
+    }
+
+    /// The allowlist's entries by their first folder below home, so a path is
+    /// compared only with the few entries that start the same way.
+    private nonisolated static func allowlistEntriesByFirstFolder(home: String) -> [Substring: [AllowlistEntry]] {
+        var index: [Substring: [AllowlistEntry]] = [:]
+        for path in whitelistedPrefixes(home: home) {
+            guard let below = pathBelowHome(path, home: home) else { continue }
+            index[Substring(String(firstFolder(of: below))), default: []]
+                .append(AllowlistEntry(path: path, relative: String(below)))
+        }
+        return index
+    }

```

**File**: `purge/Services/FileDeleter.swift` (modified, +2/-6)
```diff
@@ -1110,13 +1110,9 @@ nonisolated final class FileDeleter: Sendable {
     }
 
     /// Returns the simulator UDID when `url` is exactly `…/CoreSimulator/Devices/{UUID}`.
+    /// The link guard asks the same rule, so it lives in the policy (#422).
     private static func coreSimulatorDeviceUDID(from url: URL) -> String? {
-        let std = url.standardizedFileURL
-        let name = std.lastPathComponent
-        guard UUID(uuidString: name) != nil else { return nil }
-        guard std.deletingLastPathComponent().lastPathComponent == "Devices" else { return nil }
-        guard std.path.contains("CoreSimulator/Devices") else { return nil }
-        return name
+        DeletionSafetyPolicy.simulatorDeviceUDID(from: url)
     }
 
     /// Deleting a large device is real disk work, so this is generous — but still bounded, so a
```

**File**: `purge/Utilities/PathContainment.swift` (modified, +60/-0)
```diff
@@ -31,6 +31,66 @@ nonisolated enum PathContainment {
         return false
     }
 
+    private static let slash = UInt8(ascii: "/")
+
+    /// Where the `/` that follows `root` sits in `path`, or nil when `path` is
+    /// `root` itself or not under it.
+    ///
+    /// Separators are found as bytes, never as characters. Swift joins a `/` and
+    /// a combining mark after it into one character, so a search by character
+    /// walks past the `/` in front of a name that starts with such a mark, and
+    /// a folder on the way is never looked at (#422 review).
+    static func separatorIndex(after root: String, in path: String) -> String.Index? {
+        var rootBytes = root.utf8[...]
+        if rootBytes.last == slash { rootBytes = rootBytes.dropLast() }
+        let bytes = path.utf8
+        if bytes.starts(with: rootBytes) {
+            guard bytes.count > rootBytes.count else { return nil }
+            let index = bytes.index(bytes.startIndex, offsetBy: rootBytes.count)
+            return bytes[index] == slash ? index : nil
+        }
+        // The same root spelled with another form of an accented letter is the
+        // same text with other bytes. Plain ASCII has only one spelling.
+        guard !rootBytes.allSatisfy({ $0 < 0x80 }) else { return nil }
+        let rootText = String(Substring(rootBytes))
+        var search = bytes.startIndex
+        while let index = bytes[search...].firstIndex(of: slash) {
+            if String(path[..<index]) == rootText { return index }
+            search = bytes.index(after: index)
+        }
+        return nil
+    }
+
+    /// The folder `path` sits in: everything before its last `/` byte.
+    static func parentFolder(of path: String) -> String {
+        String(path[..<(path.utf8.lastIndex(of: slash) ?? path.endIndex)])
+    }
+
+    /// True when `folder`, or a folder above it up to `home`, is a link or can't
+    /// be read, and when `folder` is not under `home` at all. `home` itself is
+    /// never read. A step that isn't there ends the walk: nothing below it
+    /// exists, so nothing below it is a link.
+    ///
+    /// The same walk as `containsSymlinkComponent`, on plain paths with
+    /// `lstat`, for callers that ask for every row of a scan (#422): 1 µs for
+    /// two steps, against 12 µs through `URL`. Each step ends at a `/` byte.
+    static func reachesThroughLink(_ folder: String, home: String) -> Bool {
+        guard folder != home else { return false }
+        guard var separator = separatorIndex(after: home, in: folder) else { return true }
+        let bytes = folder.utf8
+        while true {
+            let stepEnd = bytes[bytes.index(after: separator)...].firstIndex(of: slash) ?? bytes.endIndex
+            var info = stat()
+            // `errno` is read inside the call, before the path's C string is
+            // freed, so nothing can change it first.
+            let failure: Int32? = String(folder[..<stepEnd]).withCString { lstat($0, &info) == 0 ? nil : errno }
+            if let failure { return !(failure == ENOENT || failure == ENOTDIR) }
+            if (info.st_mode & S_IFMT) == S_IFLNK { return true }
+            guard stepEnd < bytes.endIndex else { return false }
+            separator = stepEnd
+        }
+    }
+
     /// `url` resolves to somewhere under `root`, and `root` itself is reached
     /// through no link, so a link inside the root cannot point the delete
     /// elsewhere. `includingRoot` also accepts `url` resolving to `root` itself.
```

#### Recent Merged Pull Requests:
- **PR #430** (2026-11-21): feat: offer old rustup toolchains as Check First (#406) (@jithin-sabu)
- **PR #429** (2026-11-21): fix: bring Purge forward at launch when the Dock icon is hidden (#428) (@jithin-sabu)
- **PR #427** (2026-11-20): docs: mark the shape-matched link guard safety note as shipped in 1.17.0 (#424) (@jithin-sabu)
- **PR #426** (2026-11-20): docs: mark four safety notes as shipped in 1.17.0 (@jithin-sabu)
- **PR #425** (2026-11-20): fix: refuse shape-matched cache rows reached through a link (#424) (@jithin-sabu)
- **PR #423** (2026-11-20): fix: refuse allowlisted rows reached through a link (#422) (@jithin-sabu)

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

## X. send Apple Intelligence requests through siriknowledged when macOS 27.3 refuses 

**RULE**:
When implementing operations in `PurgeAssetWorker/UnifiedAssetCalls.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jithin-sabu/purge-app. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `09c6920d`: send Apple Intelligence requests through siriknowledged when macOS 27.3 refuses them. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `PurgeAssetWorker/UnifiedAssetCalls.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    ///
    /// `AppleIntelligenceModelRoute` picks the service. When the subscription
    /// service refuses or drops the connection, as it does from macOS 27.3,
    /// the same request goes out once more through siriknowledged's service.
        do {
            try AppleIntelligenceModelRoute.send(timeout: timeout) { service, timeout in
                try send(config, to: service, interface: interface, selector: selector, timeout: timeout)
            }
        } catch let failure as AppleIntelligenceModelRoute.SecondTryFailure {
            // A worker refusal has no domain or code, so the first try joins its text.
            if let second = failure.error as? CallError {
                throw CallError("\(second.description); \(failure.firstTry)")
            }
            throw failure.withFirstTry
        }
    }

    /// One try at one Mach service.
    private static func send(_ config: [String: Any], to service: String, interface: NSXPCInterface,
                             selector: Selector, timeout: TimeInterval) throws {
        let connection = NSXPCConnection(machServiceName: service, options: [])
            throw CallError("no reply from \(service) in \(Int(ti
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    static let serviceName = "com.apple.siri.uaf.subscription.service"
        let connection = NSXPCConnection(machServiceName: serviceName, options: [])
            throw CallError("no reply from \(serviceName) in \(Int(timeout)) seconds; the request may still have run")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `09c6920d` are properly handled with clean fallback behavior.
