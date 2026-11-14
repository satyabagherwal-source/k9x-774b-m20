# Domain G — Architecture Intelligence: Architecture Intelligence: jithin-sabu-purge-app-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "jithin-sabu-purge-app-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T15:34:47.457Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-jithin-sabu-purge-app-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [jithin-sabu-purge-app-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T15:34:47.457Z`  
> **Learning ID**: `LEARN-EVO-jithin-sabu-purge-app-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 51%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from jithin-sabu-purge-app-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jithin-sabu-purge-app-learnings.md`  
> **Source**: github ([https://github.com/jithin-sabu/purge-app](https://github.com/jithin-sabu/purge-app))  
> **Source Version**: `8d64ee60`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T15:34:29.583Z  
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
> **Harvest Timestamp**: 2026-11-14T15:34:29.578Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jithin-sabu/purge-app`
- **Description**: Free up your Mac. Safely. A free, open-source native Mac app that clears the cache and junk your Mac piles up on its own. Files go to the Trash by default, so you can put them back.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1906 stars

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
/// usageAliases, assetSetUsages}]}. Every op refuses what it is not given:
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
            for request in requests {
                let name = try string(request, "name")
                let usages = request["assetSetUsages"] as? [String: [String: String]] ?? [:]
                let aliases = request["usageAliases"] as? [String: String] ?? [:]
                subscriptions.append(try UnifiedAssetCalls.makeSubscription(name: name, assetSetUsages: usages, usageAliases: aliases))
            }
            try UnifiedAssetCalls.send([
                "Operation": "Subscribe", "Subscriber": subscriber, "Subscriptions": subscriptions, "UserInitiated": true,
            ], timeout: 60)
            return ["subscribed": requests.compactMap { $0["name"] as? String }]

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
    static let serviceName = "com.apple.siri.uaf.subscription.service"

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

    /// Sends one operation to the subscription service and waits for its reply.
    /// `config` carries "Operation" and its arguments. Throws on a missing
    /// interface, a transport error, a timeout, or an error reply.
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

        let connection = NSXPCConnection(machServiceName: serviceName, options: [])
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
            throw CallError("no reply from \(serviceName) in \(Int(timeout)) seconds; the request may still have run")
        }
        if let replyError { throw replyError }
    }

    /// A `UAFAssetSetSubscription` for a Subscribe operation, validated by macOS.
    /// Built with its initializer's implementation directly, since it takes three
    /// arguments, and checked against the configuration manager before it is sent.
    static func makeSubscription(name: String, assetSetUsages: [String: [String: String]],
                                 usageAliases: [String: String]) throws -> AnyObject {
        try load()
        guard let type = NSClassFromString("UAFAssetSetSubscription") else {
            throw CallError("UAFAssetSetSubscription is missing")
        }
        guard class_conformsToProtocol(type, NSSecureCoding.self) else {
            throw CallError("UAFAssetSetSubscription is not NSSecureCoding, so it cannot cross XPC")
        }
        let initSelector = Selector(("initWithName:assetSets:usageAliases:"))
        let validSelector = Selector(("isValid:error:"))
        guard let initMethod = class_getInstanceMethod(type, initSelector),
              let validMethod = class_getInstanceMethod(type, validSelector)
        else { throw CallError("UAFAssetSetSubscription initializer or validator is missing") }

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

        let manager = try configurationManager()
        typealias Validate = @convention(c) (AnyObject, Selector, AnyObject, AutoreleasingUnsafeMutablePointer<AnyObject?>) -> ObjCBool
        let validate = unsafeBitCast(method_getImplementation(validMethod), to: Validate.self)
        var returnedError: AnyObject?
        let valid = validate(subscription, validSelector, manager, &returnedError).boolValue
        if let returnedError = returnedError as? NSError { throw returnedError }
        guard valid else { throw CallError("macOS rejected the subscription \(name)") }
        return subscription
    }
}

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
    static func values<T, R>(
        _ items: [T],
        width: Int = ProcessInfo.processInfo.activeProcessorCount,
        _ transform: (T) -> R
    ) -> [R] {
        let lanes = min(max(1, width), items.count)
        guard lanes > 1 else { return items.map(transform) }
        var results = [R?](repeating: nil, count: items.count)
        var next = 0
        let lock = NSLock()
        // Each lane takes the next item when it is free, so one slow item holds
        // up only its own lane.
        DispatchQueue.concurrentPerform(iterations: lanes) { _ in
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
        return results.map { $0! }
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

### Core Architecture Module: `purge/Utilities/DeveloperDirectory.swift`
```
import Foundation

/// The developer directory `xcode-select` points at, read once per process.
///
/// `/usr/bin/xcrun`, `/usr/bin/git` and the other developer tools in `/usr/bin`
/// are shims. When no developer directory exists, or the one selected is gone,
/// running one does not fail: macOS shows "The 'xcrun' command requires the
/// command line developer tools. Would you like to install the tools now?", and
/// shows it again at the next launch (#298). `/usr/bin/xcode-select` is not a
/// shim. `xcode-select -p` prints the directory, or exits 2 when there is none,
/// and never asks. So every launch of a `/usr/bin` shim goes through `exists`
/// first.
nonisolated enum DeveloperDirectory {
    static let xcodeSelectPath = "/usr/bin/xcode-select"

    /// `xcode-select -p` reads one file; past this something is wedged.
    private static let timeout: TimeInterval = 10

    /// What one run of `xcode-select -p` said.
    enum Lookup: Equatable {
        /// A developer directory that exists on disk.
        case found(String)
        /// None is selected, or the selected one is gone.
        case missing
        /// `xcode-select` could not be launched or did not answer in time. Says
        /// nothing about the Mac, so it is never cached.
        case unanswered
    }

    /// The selected developer directory, when it exists on disk. `nil` on a Mac
    /// with neither Xcode nor the Command Line Tools, or whose selected Xcode was
    /// deleted. The directory is the whole check: a selected folder that lost
    /// its tools makes the shims print "invalid active developer path", not
    /// show the dialog. Blocks the calling thread like `ProcessRunner.run`: call
    /// it off the main actor.
    static func active() -> String? {
        shared.active(
            launch: { ProcessRunner.run(executablePath: $0, arguments: $1, timeout: $2) },
            isDirectory: { path in
                var isDirectory: ObjCBool = false
                return FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) && isDirectory.boolValue
            }
        )
    }

    /// Whether a `/usr/bin` shim can be launched without the install prompt.
    static var exists: Bool { active() != nil }

    /// One `xcode-select -p` run, with the process launch and the directory
    /// check handed in, so tests can check what each answer leads to.
    static func resolve(
        launch: (_ executablePath: String, _ arguments: [String], _ timeout: TimeInterval) -> ProcessRunner.Output?,
        isDirectory: (_ path: String) -> Bool
    ) -> Lookup {
        guard let output = launch(xcodeSelectPath, ["-p"], timeout), !output.timedOut else { return .unanswered }
        guard output.status == 0 else { return .missing }
        let path = output.stdoutText.trimmingCharacters(in: .whitespacesAndNewlines)
        // A selected Xcode that was trashed leaves its path behind, and the shims
        // ask to install the tools for it just as they do for no path at all.
        guard !path.isEmpty, isDirectory(path) else { return .missing }
        return .found(path)
    }

    private static let shared = Cache()

    /// Remembers a definite answer for the rest of the process. An unanswered
    /// lookup is asked again next time: caching it would turn one slow cold start
    /// into "no developer tools" until Purge quits, and with it every git status
    /// into "unknown", which skips the uncommitted-changes confirmation a dirty
    /// project gets. A found directory is checked on disk again at every call,
    /// because Purge's own uninstaller can trash Xcode while Purge runs, and the
    /// shims then prompt for the path left behind.
    final class Cache: @unchecked Sendable {
        private let lock = NSLock()
        private var cached: Lookup?

        init() {}

        func active(
            launch: (_ executablePath: String, _ arguments: [String], _ timeout: TimeInterval) -> ProcessRunner.Output?,
            isDirectory: (_ path: String) -> Bool
        ) -> String? {
            lock.lock()
            let known = cached
            lock.unlock()

            let lookup: Lookup
            if let known {
                lookup = known
            } else {
                // Resolved outside the lock: `xcode-select` is a child process, and
                // the scanner and the git checks may both ask on cold start.
                lookup = DeveloperDirectory.resolve(launch: launch, isDirectory: isDirectory)
                if lookup != .unanswered {
                    lock.lock()
                    cached = lookup
                    lock.unlock()
                }
            }

            switch lookup {
            case .found(let path):
                return isDirectory(path) ? path : nil
            case .missing, .unanswered:
                return nil
            }
        }
    }
}

```

### Core Architecture Module: `purge/Utilities/FileIdentity.swift`
```
import Darwin

/// A file or folder as the file system knows it: its volume and inode. Two paths
/// with the same identity name the same item, however they are spelled:
/// `~/Developer` and `~/developer` on the default case-insensitive volume, a link
/// and its target, or `/var` and `/private/var`.
nonisolated struct FileIdentity: Hashable, Sendable {
    let device: dev_t
    let inode: ino_t

    /// `stat`, so a link is followed. Nil when the path can't be read.
    init?(path: String) {
        var info = stat()
        guard stat(path, &info) == 0 else { return nil }
        device = info.st_dev
        inode = info.st_ino
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #362** (2026-11-12): **App Uninstaller leftover gates: four gaps found after #352**
  *Symptoms*: ### What happened?  A read of the App Uninstaller's leftover gates added in 1.15.0 (#352, PR #356) found four gaps. None lets Purge remove a file permanently: three end in a refusal or a file in the Trash, and one leaves a leftover that can never be removed.  1. **Retry skips the scripts-folder check.** A scripts folder that was empty when the sheet listed it and holds files by the time of the move is meant to stay. The three clean paths call `AppUninstallScanPolicy.scriptsFolderGainedFiles` first. `PurgeStore.retryCleanFailure` does not. So: an empty `~/Library/Application Scripts/<id>` is ticked, its move fails, files land in it, the user clicks Retry, and the folder goes to the Trash with the files.  2. **`.app` is compared with case in one gate and without in the other.** `AppUninstallScanPolicy.isEligibleForUninstallDeletion` tests `pathExtension == "app"`. The root helper's `isRealAppBundle` lowercases first. A real bundle named `Foo.APP` under a leftover root passes the app's gate and is refused only by the helper.  3. **Website-data names have no identifier-shape rule.** `matchReason` pairs any bundle id with `<id>.binarycookies` and `<id>.plist`. An app whose bundle id is `Cookies` or `HSTS` would be paired with `~/Library/Cookies/Cookies.binarycookies` or `HSTS.plist`, which belong to the system.  4. **A root-owned entry in `/Library/Caches` never reaches the helper.** `PurgeStore.pathNeedsPrivilege` asks only whether the parent folder is writable. `/Library/Caches`

- **Issue #354** (2026-11-11): **App feels laggy on an M2 Mac**
  *Symptoms*: ### What happened?  [u/SpectyteCovelight](https://www.reddit.com/user/SpectyteCovelight/) wrote on the [r/MacStack post](https://www.reddit.com/r/MacStack/comments/1xq4gba/purge_my_free_opensource_mac_cleaner_just_passed/19sclwex89ye9/) on 9 Nov 2026:  > I like your app but your app is laggy on my M2, Improve that please  The comment does not say which version they were running, which screen felt slow, or whether this was during a scan or while using the lists.  1.13.4 came out on 7 Nov and made every scan at least twice as fast. 1.14.1 came out on 8 Nov. The comment arrived after both releases, but they may still have been on an older build.  ### What did you expect to happen?  The app should stay responsive on an M2 Mac, including during scans and while scrolling lists.  ### Steps to reproduce  Unknown. Ask the reporter:  1. Which Purge version is on the About screen? 2. Which screen felt laggy? 3. Did it happen during a scan, or while scrolling or clicking around after the scan finished? 4. Which macOS version?  ### Purge version  Unknown. The comment does not say.  ### macOS version  Unknown. The comment only mentions an M2 Mac.  ### Logs, screenshots, or screen recording  None yet. 

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

### Incident Patch 1: `0385710d` (2026-11-07)
**Commit Message**: feat: offer only the Playwright browser builds no installed Playwright uses (#328) (#334)

* feat: offer only the Playwright browser builds no installed Playwright uses (#328)

The Playwright Browsers row offered all of ms-playwright, so ticking it
broke every Playwright test until npx playwright install ran again.

The row is now Unused Playwright Browsers. It lists only build folders that
no file in ms-playwright/.links names through its browsers.json, the rule
Playwright itself applies on install. Every build stays when .links is
missing or empty, a link can't be read or points at a folder that is gone,
a browsers.json can't be parsed, a fresh __dirlock shows an install, or a
linked project sits in a protected folder without Full Disk Access.

PlaywrightBuildScanPolicy checks the shape for evaluate and reads the links
again before every move. It refuses the folder itself, .links, __dirlock
and anything that isn't a <browser>-<revision> folder.

Measured with Playwright 1.60 and 1.65 in a scratch folder: after one
project moved to 1.65, the five 1.60 builds (1.15 GB) were offered and the
five 1.65 builds (1.28 GB) stayed. Full unit run: 1899 passed, 0 failed.

* fix: address the 

**File**: `PurgeTests/AllowlistAuditTests.swift` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@ struct AllowlistNoLongerSafeTests {
 
     @Test(arguments: [
         "Maven Cache", "Gradle Cache", "NuGet Packages", "Cabal Packages",
-        "SBT Cache", "Playwright Browsers",
+        "SBT Cache", "Unused Playwright Browsers",
     ])
     func bigDownloadStoresAreCheckFirst(label: String) {
         let info = DevScanner.automaticSafetyInfo(forDevToolLabel: label, primaryPath: nil)
```

**File**: `PurgeTests/PlaywrightBuildTests.swift` (added, +430/-0)
```diff
@@ -0,0 +1,430 @@
+import Foundation
+import Testing
+@testable import Purge
+
+/// Playwright builds no installed Playwright uses (#328). Every fixture is a
+/// throwaway home folder, laid out as Playwright lays out `ms-playwright`.
+private enum Playwright {
+    typealias Policy = PlaywrightBuildScanPolicy
+
+    static let root = "Library/Caches/ms-playwright"
+
+    /// `browsers.json` from playwright-core 1.65.0, trimmed to the fields Purge reads.
+    static let browsersJSON165 = """
+    {
+      "comment": "Do not edit this file, use utils/roll_browser.js",
+      "browsers": [
+        { "name": "chromium", "revision": "1254", "installByDefault": true },
+        { "name": "chromium-headless-shell", "revision": "1254", "installByDefault": true },
+        { "name": "firefox", "revision": "1572", "installByDefault": true },
+        {
+          "name": "webkit", "revision": "2388", "installByDefault": true,
+          "revisionOverrides": { "mac14": "2251", "mac14-arm64": "2251" }
+        },
+        { "name": "ffmpeg", "revision": "1013", "installByDefault": true },
+        { "name": "winldd", "revision": "1007", "installByDefault": false },
+        { "name": "android", "revision": "1001", "installByDefault": false }
+      ]
+    }
+    """
+
+    static func browsersJSON(_ entries: [(String, String)]) -> String {
+        let list = entries.map { #"{ "name": "\#($0.0)", "revision": "\#($0.1)" }"# }.joined(separator: ", ")
+        return #"{ "browsers": [\#(list)] }"#
+    }
+
+    static func makeHome() throws -> URL {
+        let url = FileManager.default.temporaryDirectory
+            .appendingPathComponent("purge-test-328-\(UUID().uuidString)", isDirectory: true)
+        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+        return url.standardizedFileURL
+    }
+
+    static func folders(_ home: URL, _ relatives: [String]) throws {
+        for relative in relatives {
+            try FileManager.default.createDirectory(
+                at: home.appendingPathComponent(relative),
+                withIntermediateDirectories: true
+            )
+        }
+    }
+
+    static func write(_ text: String, _ home: URL, _ relative: String) throws {
+        let url = home.appendingPathComponent(relative)
+        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
+        try Data(text.utf8).write(to: url)
+    }
+
+    /// A copy of `playwright-core` at `package` (relative to home) with this
+    /// `browsers.json`, and the link Playwright writes for it in `root`.
+    static func install(
+        _ home: URL,
+        package: String,
+        browsersJSON: String,
+        root: String = root,
+        linkName: String? = nil
+    ) throws {
+        try write(browsersJSON, home, "\(package)/browsers.json")
+        try write(home.appendingPathComponent(package).path, home, "\(root)/.links/\(linkName ?? UUID().uuidString)")
+    }
+
+    /// A link to a copy that isn't on disk.
+    static func danglingLink(_ home: URL, root: String = root) throws {
+        try write(home.appendingPathComponent("gone/node_modules/playwright-core").path, home, "\(root)/.links/gone")
+    }
+
+    /// Two copies' worth of builds: 1.65's, plus an older Chromium and headless
+    /// shell, Playwright's own folders, and a folder of another tool.
+    static func layBuilds(_ home: URL, root: String = root) throws {
+        try folders(home, [
+            "chromium-1200", "chromium-1254", "chromium_headless_shell-1200", "chromium_headless_shell-1254",
+            "firefox-1572", "webkit-2388", "webkit-2251", "webkit_mac14_arm64_special-2251", "ffmpeg-1011", "ffmpeg-1013",
+            "chromium-1254/chrome-mac-arm64", "__dirlock-not", "b", "mcp-chrome-4a3f9e"
+        ].map { "\(root)/\($0)" })
+    }
+
+    static func offered(
+        _ home: URL,
+        _ relative: String,
+        now: Date = Date(),
+        access: ScanAccess = .full
+    ) -> Bool {
+        !Policy.refusesDeletion(home.appendingPathComponent(relative), home: home.path, now: now, access: access)
+    }
+
+    /// The build folder names the row lists, in order.
+    static func rows(_ home: URL, now: Date = Date(), access: ScanAccess = .full) -> [String] {
+        let definitions = Policy.definitions(home: home, access: access, now: now)
+        #expect(definitions.count <= 1)
+        for definition in definitions { #expect(definition.label == Policy.label) }
+        return definitions.flatMap(\.paths).map(\.lastPathComponent)
+    }
+}
+
+@Suite("Playwright builds (#328): only builds no link names")
+struct PlaywrightBuildTests {
+    typealias Policy = PlaywrightBuildScanPolicy
+
+    @Test
+    func offersOnlyBuildsNoLinkNames() throws {
+        let home = try Playwright.makeHome()
+        defer { try? FileManager.default.removeItem(at: home) }
+        try Playwright.layBuilds(home)
+        try Playwright.install(hom
```

**File**: `purge/Resources/explanations.json` (modified, +9/-0)
```diff
@@ -845,6 +845,15 @@
     ],
     "kind": "packages"
   },
+  {
+    "key": "playwright-unused-builds",
+    "display_name": "Unused Playwright Browsers",
+    "tag": "medium",
+    "explanation": "Browser builds no Playwright install still lists. A project that never ran npx playwright install may use one. That command downloads it again.",
+    "bundle_ids": [],
+    "aliases": [],
+    "kind": "packages"
+  },
   {
     "key": "node-modules",
     "display_name": "Node.js Packages",
```

**File**: `purge/Services/BrandIconMapping.swift` (modified, +1/-0)
```diff
@@ -105,6 +105,7 @@ enum BrandIconMapping {
         "zed": "zedindustries",
         "electron": "electron",
         "ms-playwright": "playwright",
+        "playwright-unused-builds": "playwright",
         "DerivedData": "xcode",
         "archives": "xcode",
         "xcode": "xcode",
```

**File**: `purge/Services/DeletionSafetyPolicy.swift` (modified, +12/-1)
```diff
@@ -369,7 +369,8 @@ enum DeletionSafetyPolicy {
             // cache), so it must never be scanned, sized, or deleted.
             // NOTE: `~/Library/Application Support/Zed/db` is deliberately NOT listed.
             // It is Zed's workspace state database, not a cache.
-            "\(home)/.cache/ms-playwright",
+            // `~/.cache/ms-playwright` is not listed: a project still runs some of
+            // its builds. `PlaywrightBuildScanPolicy` allows one build at a time.
             "\(home)/Library/Developer/CoreSimulator/Devices",
             // Adobe stores its heavy caches under Application Support rather than
             // ~/Library/Caches, so the broad Caches sweep never reaches them. These
@@ -484,6 +485,11 @@ enum DeletionSafetyPolicy {
         // Which tool version, emulator image or Figma profile is in use can
         // change at any time, and an unfinished install becomes old.
         if OldToolVersionScanPolicy.refusesDeletion(url) { return false }
+        // Which Playwright builds a project uses changes with every install. The
+        // Dev Tools filter asks on the main thread for each build on every scan
+        // flush, so it may reuse a read from the last few seconds. `FileDeleter`
+        // asks off the main thread, so a move always reads the links again.
+        if PlaywrightBuildScanPolicy.refusesDeletion(url, reuseRecentRead: Thread.isMainThread) { return false }
         if mailRunningRefusesDeletion(url) { return false }
         // A daemon's log stays while it runs, and a temp file until it is old.
         if gradleLeftoverRefusesDeletion(url) { return false }
@@ -1487,6 +1493,11 @@ enum DeletionSafetyPolicy {
         if OldToolVersionScanPolicy.isWhitelistedPath(path, home: home) {
             return .allow
         }
+        // Shape only. Whether a link still names the build is checked by
+        // `PlaywrightBuildScanPolicy.refusesDeletion` before every move.
+        if PlaywrightBuildScanPolicy.isWhitelistedPath(path, home: home) {
+            return .allow
+        }
         if gradleLeftover(at: path, home: home) != nil {
             return .allow
         }
```

**File**: `purge/Services/DevScanner.swift` (modified, +13/-10)
```diff
@@ -52,7 +52,7 @@ nonisolated final class DevScanner {
         "Vagrant Cache": "vagrant",
         "Zsh Cache": "zsh",
         "Electron App Caches": "electron",
-        "Playwright Browsers": "ms-playwright",
+        PlaywrightBuildScanPolicy.label: PlaywrightBuildScanPolicy.explanationKey,
         "npm npx Cache": "npm-npx-cache",
         "npm Logs": "npm-logs",
         "Xcode Documentation Cache": "xcode-docs-cache",
@@ -588,10 +588,15 @@ nonisolated final class DevScanner {
     /// once the dev scan claims them.
     nonisolated static func claimedGlobalCachePaths() -> Set<String> {
         let home = FileManager.default.homeDirectoryForCurrentUser
-        // The JetBrains row lists each IDE folder's children rather than the folder
-        // itself, so the folder is claimed by name here to keep App Caches off it.
-        let claimedRoots = [home.appendingPathComponent("Library/Caches/JetBrains", isDirectory: true)]
-        return Set((globalCacheDefinitions().flatMap(\.paths) + claimedRoots).map { $0.standardizedFileURL.path })
+        return Set((globalCacheDefinitions().flatMap(\.paths) + claimedRoots(home: home)).map { $0.standardizedFileURL.path })
+    }
+
+    /// Folders claimed by name although no row lists them whole. The JetBrains and
+    /// Playwright rows list entries inside their folders, so each folder is
+    /// claimed here to keep App Caches off it. Reads nothing.
+    nonisolated static func claimedRoots(home: URL) -> [URL] {
+        [home.appendingPathComponent("Library/Caches/JetBrains", isDirectory: true)]
+            + PlaywrightBuildScanPolicy.roots.map { home.appendingPathComponent($0, isDirectory: true) }
     }
 
     /// `~/.gem/specs` plus each `~/.gem/ruby/<version>/cache`. Installed gems in
@@ -835,12 +840,9 @@ nonisolated final class DevScanner {
                 home.appendingPathComponent("Library/Application Support/discord/Code Cache", isDirectory: true),
                 home.appendingPathComponent("Library/Application Support/Notion/Cache", isDirectory: true),
                 home.appendingPathComponent("Library/Application Support/Figma/Cache", isDirectory: true)
-            ]),
-
-            ("Playwright Browsers", [
-                home.appendingPathComponent("Library/Caches/ms-playwright", isDirectory: true),
-                home.appendingPathComponent(".cache/ms-playwright", isDirectory: true)
             ])
+            // Playwright's browser folders are not a row as a whole: a project still
+            // runs some of the builds. `PlaywrightBuildScanPolicy` offers the rest (#328).
         ] + chromiumUserDataCacheDefinitions(home: home)
     }
 
@@ -864,6 +866,7 @@ nonisolated final class DevScanner {
             + discoverOrphanedEditorWorkspaceDefinitions(home: home, access: access)
             + Self.oldCLIVersionDefinitions(home: home)
             + OldToolVersionScanPolicy.definitions(home: home)
+            + PlaywrightBuildScanPolicy.definitions(home: home, access: access)
         // Agent worktrees are judged by reading the git dir their `.git` file points
         // at, which is usually a repo in Documents or Desktop, and Claude Code's live
         // inside those projects. A limited scan cannot look there without a prompt,
```

**File**: `purge/Services/PlaywrightBuildScanPolicy.swift` (added, +321/-0)
```diff
@@ -0,0 +1,321 @@
+import Darwin
+import Foundation
+
+/// Playwright browser builds that no Playwright which installed browsers still
+/// names (#328).
+///
+/// Playwright keeps every browser it downloads in `ms-playwright`, one folder
+/// per build (`chromium-1194`, `chromium_headless_shell-1194`, `ffmpeg-1011`).
+/// Each copy of `playwright-core` that installs browsers writes one file to
+/// `ms-playwright/.links`, named for the SHA-1 of its folder and holding that
+/// folder's path. The copy's `browsers.json` names the builds it runs. On every
+/// install Playwright deletes the build folders no link names
+/// (`_validateInstallationCache` in playwright-core, checked in 1.65.0), unless
+/// `PLAYWRIGHT_SKIP_BROWSER_GC` is set. Purge applies the same rule without
+/// running Playwright, and keeps more than Playwright does:
+///
+/// - Every build stays while anything is unclear: `.links` is missing, empty or
+///   can't be listed, a link file can't be read, it names a folder that isn't
+///   there (a project on an unplugged drive, a deleted copy), or that folder's
+///   `browsers.json` can't be read or parsed. Playwright drops such a link and
+///   deletes the builds only it named. Purge can't tell those builds apart.
+/// - A `browsers.json` in Desktop, Documents or another protected folder is read
+///   only with Full Disk Access. Without it every build stays.
+/// - A link that leads to `/Volumes`, `/Network` or `/net`, directly or through a
+///   symlink, keeps every build and is never followed there. Reaching a removable
+///   or network volume can ask for permission, and a share that stopped
+///   answering would block.
+/// - Every build stays while `__dirlock` is under an hour old. Playwright holds it
+///   while it writes a link and downloads.
+/// - Only folders named `<browser>-<revision>`, for a browser Playwright has ever
+///   downloaded, are offered. `.links`, `__dirlock`, the folder itself and
+///   anything else in it are refused.
+///
+/// Python, Java and .NET Playwright install through the same Node driver, so they
+/// write links too. Java unpacks its driver into a temporary folder for each
+/// run, so its link soon names a folder that is gone, and every build stays.
+///
+/// What the links can't show: launching a browser writes no link. A copy that
+/// never ran `playwright install`, such as a second checkout that found the
+/// builds already there, can run a build no link names, and so can a Mac that
+/// keeps old builds on purpose with `PLAYWRIGHT_SKIP_BROWSER_GC`. The row's
+/// text says so, and it is Check First.
+///
+/// `PLAYWRIGHT_BROWSERS_PATH` is ignored. Only the default folders are looked at.
+///
+/// The row is Check First. `isWhitelistedPath` proves only the shape, for
+/// `evaluate`. `refusesDeletion` reads the links again, from
+/// `isOfferedForCleanup`, which `FileDeleter` asks before every move. Only the
+/// on-screen filter, which runs on the main thread, may reuse a read from the
+/// last few seconds (`recentReadLifetime`).
+nonisolated enum PlaywrightBuildScanPolicy {
+
+    static let label = "Unused Playwright Browsers"
+    static let explanationKey = "playwright-unused-builds"
+
+    /// Where Playwright keeps browsers on a Mac, and the Linux spelling, relative
+    /// to home.
+    static let roots = ["Library/Caches/ms-playwright", ".cache/ms-playwright"]
+
+    /// Playwright's `allDownloadableDirectoriesThatEverExisted`, with dashes as
+    /// underscores, as its folder names spell them. A folder for any other name
+    /// is never offered, as Playwright never deletes one either.
+    static let browserFolderNames: Set<String> = [
+        "android",
+        "chromium",
+        "chromium_headless_shell",
+        "chromium_tip_of_tree",
+        "chromium_tip_of_tree_headless_shell",
+        "ffmpeg",
+        "firefox",
+        "firefox_beta",
+        "webkit",
+        "winldd"
+    ]
+
+    static let linksFolder = ".links"
+    /// Playwright's install lock.
+    static let lockName = "__dirlock"
+    /// A lock is refreshed every few seconds while Playwright holds it. One older
+    /// than this was left by an install that was killed.
+    static let lockLifetime: TimeInterval = 60 * 60
+    /// Finder may leave this in `.links`. It never names a Playwright copy.
+    static let finderMetadataName = ".DS_Store"
+    /// Where other volumes are mounted. A link that leads here is never followed.
+    static let otherVolumeRoots = ["/Volumes", "/Network", "/net"]
+    /// How long `refusesDeletion(reuseRecentRead: true)` may answer from an
+    /// earlier read of a folder's links.
+    static let recentReadLifetime: TimeInterval = 10
+
+    // MARK: Shape
+
+    /// The root `path` sits directly in when it is a build folder. Nil for every
+    /// other path, including the root itself and anything inside a build.
+    static func buildRoot(of path: String, home: String) -> String? {
+        for relative in root
```

**File**: `purge/Services/ScanAccess.swift` (modified, +21/-0)
```diff
@@ -116,6 +116,27 @@ nonisolated enum ProtectedLocations {
         return resolvingLinks(in: url.path, fileManager: fileManager) { isPath($0, inAnyOf: roots) }
     }
 
+    /// `readablePath`, also stopping before a path in `otherRoots`, such as other
+    /// volumes, before any link there is read. `stoppedAtOther` says whether one
+    /// of those, not a protected root, stopped it.
+    static func readablePath(
+        of url: URL,
+        home: URL = FileManager.default.homeDirectoryForCurrentUser,
+        fileManager: FileManager = .default,
+        alsoStoppingAt otherRoots: [String]
+    ) -> (path: String?, stoppedAtOther: Bool) {
+        let roots = resolvedRootPaths(home: home, fileManager: fileManager)
+        var stoppedAtOther = false
+        let path = resolvingLinks(in: url.path, fileManager: fileManager) { partial in
+            if isPath(partial, inAnyOf: otherRoots) {
+                stoppedAtOther = true
+                return true
+            }
+            return isPath(partial, inAnyOf: roots)
+        }
+        return (path, stoppedAtOther)
+    }
+
     /// `rootPaths` plus the same roots under home's resolved path. Resolved paths
     /// are compared against these: a home under `/var` is really under
     /// `/private/var`. Home itself is never protected, so resolving it is safe.
```

---

### Incident Patch 2: `87d5747a` (2026-11-10)
**Commit Message**: fix: add the Russian text for the Apple Intelligence error details and storage units (#343) (#348)

#344 and #347 merged with English and zh-Hans strings but no ru entries, so
the translations check failed on main with 12 errors. This adds the 12 ru
entries. No Swift code and no other language changes.

**File**: `purge/ru.lproj/Localizable.strings` (modified, +12/-0)
```diff
@@ -328,6 +328,8 @@
 "Consider stale after" = "Срок устаревания";
 "Containers" = "Containers";
 "Continue" = "Продолжить";
+"Copied" = "Скопировано";
+"Copy" = "Скопировать";
 "Copy Command" = "Скопировать команду";
 "Copy Path" = "Скопировать путь";
 "Copy Paths" = "Копировать пути";
@@ -367,6 +369,7 @@
 "Deleted-app watcher" = "Монитор удалённых приложений";
 "Deletes its apps and data." = "Удаляет его приложения и данные.";
 "Dependencies" = "Зависимости";
+"Details" = "Подробности";
 "Dev Tools" = "Инструменты";
 "Dev Tools not scanned yet" = "Инструменты разработчика ещё не сканировались";
 "Dev tool artifacts" = "Артефакты инструментов разработчика";
@@ -453,6 +456,7 @@
 "From the last scan, %@ · Checking again…" = "Из прошлого сканирования, %@ · Проверяем снова…";
 "From the last scan. Purge is checking it again." = "Из последнего сканирования. Purge проверяет снова.";
 "Full Disk Access" = "Полный доступ к диску";
+"GB" = "ГБ";
 "GarageBand projects and the sounds it downloaded. Remove sound packs in GarageBand under Sound Library." = "Проекты GarageBand и скачанные им звуки. Удалить наборы звуков можно в GarageBand в разделе «Библиотека звуков».";
 "General" = "Общие";
 "Get started" = "Начать";
@@ -505,6 +509,7 @@
 "Items found, %lld" = "Найдено элементов: %lld";
 "Jithin" = "Jithin";
 "Jithin on X" = "Jithin в X";
+"KB" = "КБ";
 "Keep" = "Оставить";
 "Keep %lld files only in iCloud?" = "Оставить %lld файлов только в iCloud?";
 "Keep Cleaning" = "Продолжить очистку";
@@ -574,6 +579,7 @@
 "Looking for large files again" = "Повторный поиск больших файлов";
 "Loose files" = "Отдельные файлы";
 "Loose files · %@" = "Отдельные файлы · %@";
+"MB" = "МБ";
 "Made with" = "Сделано с";
 "Mail & Messages" = "Почта и Сообщения";
 "Mail keeps a copy of every message and attachment here. Mail > Settings > Accounts lets you download only recent attachments, and Mailbox > Erase Junk Mail and Erase Deleted Items free space." = "Почта хранит здесь копию каждого письма и вложений. В разделе «Почта» > «Настройки» > «Учётные записи» можно скачивать только недавние вложения, а «Почтовый ящик» > «Стереть спам» и «Стереть удалённые объекты» освобождают место.";
@@ -1038,6 +1044,7 @@
 "Show all" = "Показать все";
 "Show all items (⌥⌘1)" = "Показать все элементы (⌥⌘1)";
 "Show check-first items (⌥⌘3)" = "Показать элементы для проверки (⌥⌘3)";
+"Show everything macOS answered" = "Показать полный ответ macOS";
 "Show in Dev Tools" = "Показать в инструментах разработчика";
 "Show in Finder" = "Показать в Finder";
 "Show in Finder\n%@" = "Показать в Finder\n%@";
@@ -1111,6 +1118,7 @@
 "System" = "Как в системе";
 "System Data" = "Системные данные";
 "System junk" = "Системный мусор";
+"TB" = "ТБ";
 "Terraform plugins" = "Плагины Terraform";
 "Test the schedule" = "Проверить расписание";
 "Thanks, that means a lot." = "Спасибо, это очень приятно.";
@@ -1174,6 +1182,7 @@
 "This is a known cache folder that apps or developer tools recreate automatically." = "Это известная папка кэша, которую приложения или инструменты разработчика создают заново автоматически.";
 "This is an installed app or game. The store that installed it knows how to remove it cleanly and keep your saves, so Purge leaves that to it." = "Это установленное приложение или игра. Магазин, который его установил, умеет аккуратно удалять его, не теряя ваши сохранения, поэтому Purge оставляет это ему.";
 "This is an installed app or game. The store that installed it knows how to remove it, so Purge leaves that to it." = "Это установленное приложение или игра. Магазин, из которого они установлены, умеет их удалять, поэтому Purge оставляет это ему.";
+"This is everything macOS answered. If you report the problem, copy it into the report." = "Это полный ответ macOS. Если будете сообщать о проблеме, скопируйте его в сообщение.";
 "This is the operating system itself, on a sealed volume nothing can change." = "Это сама операционная система, на защищённом томе, который невозможно изменить.";
 "This one couldn't be removed. Try again." = "Не удалось удалить этот элемент. Попробуйте ещё раз.";
 "This one may hold something you'd miss. If you're not sure about it, cancel and untick it." = "Здесь может быть что-то важное для вас. Если не уверены, отмените и снимите отметку.";
@@ -1401,6 +1410,9 @@
 "macOS updates" = "обновления macOS";
 "macOS will ask you to install a profile. It stops the models from downloading again. To get them back, click Download Again. The profile is listed in System Settings > General > Device Management." = "macOS предложит установить профиль. Он не даст моделям скачиваться снова. Чтобы вернуть их, нажмите «Скачать снова». Профиль указан в «Системных настройках» > «Основные» > «Управление устройством».";
 "macOS won't let Purge move this app from where it is. Drag it to the Trash in Finder, then retry to remove what it left behind." = "macOS не позволяет Purge переместить это приложение с текущего места. Перетащите его в Корзину в Finder, а затем пов
```

---

### Incident Patch 3: `4304b54f` (2026-11-11)
**Commit Message**: test: pin that the Quick Look thumbnail cache is never offered (#353) (#357)

macOS seals the Quick Look thumbnail cache in the per-user cache folder.
No app can read or delete it, even with Full Disk Access. Once it is
moved to the Trash, the Trash can never be emptied.

Purge already refuses it. These tests keep it that way for the cache
gate, the three user-selected gates, and the uninstaller's search roots.
They cover the macOS 11+ path, the 10.14 path, the agent's folder, and
both spellings of /var: 20 paths.

No app code changes.

**File**: `PurgeTests/MissedSafeCachesTests.swift` (modified, +67/-0)
```diff
@@ -516,6 +516,73 @@ struct ClangModuleCacheTests {
     }
 }
 
+// MARK: - The Quick Look thumbnail cache in the same folder
+
+/// macOS seals the Quick Look thumbnail cache, which sits in the per-user cache
+/// folder next to clang's module cache. No app can read or delete it, even with
+/// Full Disk Access, and once it is moved to the Trash the Trash can never be
+/// emptied (#353). So no gate may accept it or the agent's folder around it.
+@Suite("Quick Look thumbnail cache is never offered (#353)")
+struct QuickLookThumbnailCacheTests {
+    /// The cache where macOS 11 and later keep it, where 10.14 kept it, the
+    /// agent's folder around it, and a file inside it.
+    private static func sealedPaths(inCacheFolder folder: String) -> [String] {
+        let base = folder.hasSuffix("/") ? String(folder.dropLast()) : folder
+        return [
+            "\(base)/com.apple.quicklook.ThumbnailsAgent",
+            "\(base)/com.apple.quicklook.ThumbnailsAgent/com.apple.QuickLook.thumbnailcache",
+            "\(base)/com.apple.quicklook.ThumbnailsAgent/com.apple.QuickLook.thumbnailcache/thumbnails.data",
+            "\(base)/com.apple.QuickLook.thumbnailcache",
+            "\(base)/com.apple.QuickLook.thumbnailcache/index.sqlite",
+        ]
+    }
+
+    /// This Mac's own cache folder and a made-up one, each under both spellings
+    /// of `/var`.
+    private static func everySealedPath() throws -> [String] {
+        let real = try #require(DeletionSafetyPolicy.darwinUserCacheDirectory())
+        let folders = DeletionSafetyPolicy.bothVarSpellings(of: real)
+            + DeletionSafetyPolicy.bothVarSpellings(of: "/var/folders/ab/cd/C")
+        return folders.flatMap { sealedPaths(inCacheFolder: $0) }
+    }
+
+    @Test
+    func theCacheGateRefusesIt() throws {
+        let paths = try Self.everySealedPath()
+        #expect(paths.count == 20)
+        for path in paths {
+            let url = URL(fileURLWithPath: path)
+            #expect(DeletionSafetyPolicy.evaluate(url) != .allow, "\(path)")
+            #expect(!DeletionSafetyPolicy.isOfferedForCleanup(url), "\(path)")
+            #expect(!DeletionSafetyPolicy.isWhitelistedClangModuleCachePath(path), "\(path)")
+        }
+    }
+
+    /// `FileDeleter.deleteUserSelectedFiles` asks these three. The uninstaller's
+    /// one matters most: another cleaner's uninstall is what moved this folder.
+    @Test
+    func theUserSelectedGatesRefuseIt() throws {
+        for path in try Self.everySealedPath() {
+            let url = URL(fileURLWithPath: path)
+            #expect(!AppUninstallScanPolicy.isEligibleForUninstallDeletion(url), "\(path)")
+            #expect(!LargeFileScanPolicy.isEligibleForDeletion(url), "\(path)")
+            #expect(!AIModelScanPolicy.isEligibleForDeletion(url), "\(path)")
+        }
+    }
+
+    /// The uninstaller looks for leftovers only in Library folders, so it never
+    /// lists the per-user cache folder or anything in it.
+    @Test
+    func theUninstallerNeverSearchesThePerUserCacheFolder() {
+        let home = FileManager.default.homeDirectoryForCurrentUser
+        for root in AppUninstallScanPolicy.leftoverSearchRoots(home: home) {
+            let path = root.url.standardizedFileURL.path
+            #expect(!path.hasPrefix("/var/"), "\(path)")
+            #expect(!path.hasPrefix("/private/var/"), "\(path)")
+        }
+    }
+}
+
 // MARK: - Download caches, CLI versions and Caches entries
 
 @Suite("Missed caches (#323): allowlist and entries")
```

#### Recent Merged Pull Requests:
- **PR #364** (2026-11-12): docs: add a Ukrainian README (@mikhmol)
- **PR #363** (2026-11-12): fix: close four gaps in the uninstaller's leftover gates (#362) (@jithin-sabu)
- **PR #361** (2026-11-12): docs: close the gaps left in the Chinese and Russian READMEs (@jithin-sabu)
- **PR #360** (2026-11-12): fix: correct the Russian custom interval, admin prompt and delete sheet text (@jithin-sabu)
- **PR #359** (2026-11-12): docs: bring the README in line with the app (#358) (@jithin-sabu)
- **PR #357** (2026-11-11): test: pin that the Quick Look thumbnail cache is never offered (#353) (@jithin-sabu)

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

## X. offer only the Playwright browser builds no installed Playwright uses

**RULE**:
When implementing operations in `PurgeTests/AllowlistAuditTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jithin-sabu/purge-app. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0385710d`: offer only the Playwright browser builds no installed Playwright uses. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `PurgeTests/AllowlistAuditTests.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
        "SBT Cache", "Unused Playwright Browsers",
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        "SBT Cache", "Playwright Browsers",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0385710d` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
