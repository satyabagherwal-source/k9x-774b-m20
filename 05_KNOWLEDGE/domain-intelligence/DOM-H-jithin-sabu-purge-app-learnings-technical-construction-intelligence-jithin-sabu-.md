# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: jithin-sabu-purge-app-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "jithin-sabu-purge-app-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T22:56:52.070Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-jithin-sabu-purge-app-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [jithin-sabu-purge-app-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T22:56:52.070Z`  
> **Learning ID**: `LEARN-EVO-jithin-sabu-purge-app-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 54%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from jithin-sabu-purge-app-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jithin-sabu-purge-app-learnings.md`  
> **Source**: github ([https://github.com/jithin-sabu/purge-app](https://github.com/jithin-sabu/purge-app))  
> **Source Version**: `6e5c3d30`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T22:56:27.477Z  
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
> **Harvest Timestamp**: 2026-11-17T22:56:27.081Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jithin-sabu/purge-app`
- **Description**: Free up your Mac. Safely. A free, open-source native Mac app that clears the cache and junk your Mac piles up on its own. Files go to the Trash by default, so you can put them back.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1954 stars

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
        typealias Validate = @convention(c) (AnyObject, Selector, AnyObject, AutoreleasingUnsafeMutablePointer<AnyObject?>) -> ObjCBool
        let validate = unsafeBitCast(method_getImplementation(validMethod), to: Validate.self)
        var returnedError: AnyObject?
        let valid = validate(subscription, validSelector, manager, &returnedError).boolValue
        if let returnedError = returnedError as? NSError { return returnedError }
        guard valid else {
            let name = message(subscription, "name") as? String ?? "?"
            return CallError("macOS rejected the subscription \(name)")
        }
        return nil
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
- **Issue #395** (2026-11-17): **Large Files lists Ollama blobs when Purge doesn't know the store's path**
  *Symptoms*: Large Files lists each blob of an Ollama model store as a loose file, as `sha256-…` rows. This happens when the store sits in a folder Large Files walks but Purge doesn't know its path. One example is `OLLAMA_MODELS` set only in a shell profile while Purge started from the Dock.  Trashing one of those blobs breaks every model that uses it, and Ollama goes on listing the models.  ## How it was found  While live-testing #318. With `OLLAMA_MODELS` set, a store on an added drive stayed out of Large Files as intended. With it unset, the same store's 26 MB blob showed up as a loose file. The same thing already happens on main for a store in `~/Documents`. #318 makes it more likely, because the reporter there keeps Ollama models on an external drive.  ## Fix  - The Large Files walk recognises an Ollama store by its shape, a folder holding both `blobs` and `manifests`, and skips it like the known model stores. - The Large Files delete gate refuses anything inside such a folder. - AI Models doesn't list these stores. Only the Large Files walk can find them, and `FileDeleter` also asks the AI model gate about plain Large Files rows, so a gate that accepted store files would let a lone blob through again. 

- **Issue #385** (2026-11-16): **Unable to reinstall Apple Intelligence Models**
  *Symptoms*: ### What happened?  I got the following message when trying to reinstall the Apple Intelligence models:  Purge 1.16.1 (45), macOS Version 27.2.1 (Build 26B131)  subscribe imageGeneration, spatialPhotos: com.apple.UnifiedAssetFramework -1: Subscription imageGeneration references unknown value language_en in usage type VisualGeneration.GenerativePlayground  ### What did you expect to happen?  For it to work.  ### Steps to reproduce  1. Open Purge 2. Remove Apple Intelligence models 3. Attempt to redownload Apple Intelligence models  ### Purge version  1.6.1  ### macOS version  macOS 27.2.1  ### Logs, screenshots, or screen recording  N/A

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

### Incident Patch 1: `5d909efd` (2026-11-17)
**Commit Message**: fix: keep an Ollama store Purge doesn't know out of Large Files (#395) (#396)

* fix: keep an Ollama store Purge doesn't know out of Large Files (#395)

Large Files listed each blob of an Ollama store as a loose sha256 file
when the store sat in a walked folder at a path Purge didn't know, such
as OLLAMA_MODELS set only in a shell profile. Trashing one blob breaks
every model that uses it, and Ollama goes on listing them.

The walk now skips any folder holding both blobs and manifests, read
from the names it already listed, so it costs no extra call. A root with
that shape is skipped too. manifests/registry.ollama.ai is not required,
because models pulled from hf.co are filed under manifests/hf.co.

The Large Files delete gate refuses anything inside such a folder, by
the path given and by its real path, so a saved row can't trash a blob
either.

AI Models does not list these stores. Only the Large Files walk can
find them, and FileDeleter also asks the AI model gate about plain Large
Files rows, so letting that gate accept store files would let a lone
blob through again.

OllamaStoreShapeTests: 8 tests. Without the fix, 6 fail and 2 pass
(the two controls). Full suite minus Folder

**File**: `PurgeTests/OllamaStoreShapeTests.swift` (added, +273/-0)
```diff
@@ -0,0 +1,273 @@
+import Foundation
+import Testing
+@testable import Purge
+
+/// An Ollama store in a folder Large Files walks, at a path Purge doesn't know
+/// (`OLLAMA_MODELS` set only in a shell profile while Purge started from the
+/// Dock), is known by its shape: `blobs` beside `manifests`. Large Files never
+/// lists its blobs one by one, and its gate refuses them, because trashing one
+/// blob breaks every model that uses it. AI Models doesn't list such a store
+/// either. Every fixture is a throwaway home in the temporary folder.
+@Suite("An Ollama store Purge doesn't know stays out of Large Files")
+struct OllamaStoreShapeTests {
+    // MARK: - Fixtures
+
+    private struct Home {
+        let url: URL
+
+        init() throws {
+            url = FileManager.default.temporaryDirectory
+                .appendingPathComponent("purge-ollama-shape-\(UUID().uuidString)", isDirectory: true)
+                .standardizedFileURL
+            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
+        }
+
+        @discardableResult
+        func file(_ relative: String, bytes: Int = 4096) throws -> URL {
+            let file = url.appendingPathComponent(relative)
+            try FileManager.default.createDirectory(
+                at: file.deletingLastPathComponent(), withIntermediateDirectories: true
+            )
+            try Data(repeating: 0x01, count: bytes).write(to: file)
+            return file
+        }
+
+        /// An Ollama store at `relative`: one model pulled from `registry`,
+        /// with one blob. Returns the blob.
+        @discardableResult
+        func ollamaStore(_ relative: String, registry: String = "registry.ollama.ai") throws -> URL {
+            let manifest = url.appendingPathComponent("\(relative)/manifests/\(registry)/library/gemma3/latest")
+            try FileManager.default.createDirectory(
+                at: manifest.deletingLastPathComponent(), withIntermediateDirectories: true
+            )
+            let body: [String: Any] = [
+                "schemaVersion": 2,
+                "layers": [["mediaType": "application/vnd.ollama.image.model", "digest": "sha256:aaa"]],
+            ]
+            try JSONSerialization.data(withJSONObject: body).write(to: manifest)
+            return try file("\(relative)/blobs/sha256-aaa")
+        }
+
+        func remove() { try? FileManager.default.removeItem(at: url) }
+    }
+
+    private func scannedPaths(_ home: Home, roots: [String]) async -> Set<String> {
+        let stream = LargeFileScanner().scanStream(
+            minBytes: 1024,
+            staleDays: 0,
+            roots: roots.map { home.url.appendingPathComponent($0, isDirectory: true) },
+            virtualMachineRoots: [],
+            iCloudDriveRoots: [],
+            installedApps: [],
+            isAppRunning: { _ in false },
+            home: home.url,
+            exclusions: ScanExclusions(keys: []),
+            isExcluded: { _ in false }
+        )
+        var paths = Set<String>()
+        for await file in stream {
+            paths.insert(URL(fileURLWithPath: file.id).resolvingSymlinksInPath().path)
+        }
+        return paths
+    }
+
+    private func real(_ url: URL) -> String { url.resolvingSymlinksInPath().path }
+
+    // MARK: - The walk
+
+    /// The bug: the store's blob showed up as a `sha256-…` row of its own.
+    @Test
+    func blobsOfAnUnknownStoreAreNotListed() async throws {
+        let home = try Home()
+        defer { home.remove() }
+        try home.ollamaStore("Documents/ollama-models")
+        let film = try home.file("Documents/film.mov")
+
+        #expect(await scannedPaths(home, roots: ["Documents"]) == [real(film)])
+    }
+
+    /// Ollama files a model pulled from Hugging Face under `manifests/hf.co`,
+    /// so a store holding only those is still a store.
+    @Test
+    func aStoreWithModelsFromAnotherRegistryIsSkipped() async throws {
+        let home = try Home()
+        defer { home.remove() }
+        try home.ollamaStore("Documents/Deep/Down/models", registry: "hf.co")
+
+        #expect(await scannedPaths(home, roots: ["Documents"]).isEmpty)
+    }
+
+    /// A walked root that is itself a store, such as one picked as a folder to
+    /// scan, lists nothing.
+    @Test
+    func aRootThatIsAStoreListsNothing() async throws {
+        let home = try Home()
+        defer { home.remove() }
+        try home.ollamaStore("Models")
+
+        #expect(await scannedPaths(home, roots: ["Models"]).isEmpty)
+    }
+
+    /// APFS compares names without case, so `Blobs` beside `Manifests` is the
+    /// same shape. The walk skips it and the gate refuses it alike, so no row
+    /// is listed that could only come back "skipped for safety".
+    @Test
+    func aStoreInOtherCapitalsIsSkippedAndRefused() async throws {
+        let home = try Home()
+        defer { home.remove() }
+        let blob = try home.file("Documents/models/Blobs/sha2
```

**File**: `docs/safety-notes.md` (modified, +43/-0)
```diff
@@ -11,6 +11,49 @@ that belongs here, [SECURITY.md](../SECURITY.md) says how to report it.
 
 Newest first.
 
+## 2026-11-17: Large Files offered single Ollama blobs from a store Purge didn't know
+
+**Found internally** while testing [#318](https://github.com/jithin-sabu/purge-app/issues/318) ([#395](https://github.com/jithin-sabu/purge-app/issues/395)), no report. **Fixed:** [#396](https://github.com/jithin-sabu/purge-app/pull/396), not shipped yet. **Affected:** every release up to v1.16.2.
+
+### What happened
+
+An Ollama store keeps each model's weights as blobs named by digest
+(`blobs/sha256-…`), and lists the models in `manifests`. Purge reads
+`OLLAMA_MODELS` to find the store, and Large Files skips the store when it sits
+in a folder Large Files walks. When Purge can't see the variable, such as one
+set only in a shell profile while Purge started from the Dock, it doesn't know
+the store's path. A store in `~/Documents` or another walked folder was then
+walked like any folder, and each blob over the size floor was a row of its own
+with a `sha256-…` name.
+
+Trashing one blob breaks every model that uses it, and Ollama goes on listing
+those models.
+
+### Who was affected
+
+Nobody reported a loss. It took a store in a walked folder at a path Purge
+couldn't see, and a click on a row named only by a hash. The blob went to the
+Trash and could be put back.
+
+### What changed
+
+The Large Files walk knows a store by its shape, a folder holding both `blobs`
+and `manifests`, compared without case, and skips it
+(`AIModelScanPolicy.isOllamaStore`). It also skips a root that is a store or
+sits inside one. The Large Files delete gate refuses anything under a folder
+with that shape, by the path given and by its real path
+(`AIModelScanPolicy.isInsideOllamaStore`), so a row saved before the fix can't
+trash a blob either. AI Models doesn't list these stores, because `FileDeleter`
+also asks the AI model gate about plain Large Files rows.
+
+### What would have caught it earlier
+
+A walk test with a store at a path Purge doesn't know, not only at the paths
+it reads from the environment.
+[`PurgeTests/OllamaStoreShapeTests.swift`](../PurgeTests/OllamaStoreShapeTests.swift)
+now walks such a store, a mixed-case one and a root inside one, expects no
+blob rows, and expects `FileDeleter` to skip a blob for safety.
+
 ## 2026-11-12: Retry could move a scripts folder that had gained files
 
 **Found internally** in a deletion-safety review before 1.15.0 ([#362](https://github.com/jithin-sabu/purge-app/issues/362)), no report. **Fixed:** [#363](https://github.com/jithin-sabu/purge-app/pull/363), shipped in v1.16.0 (2026-11-16). **Affected:** v1.15.0.
```

**File**: `purge/Services/AIModelScanPolicy.swift` (modified, +53/-0)
```diff
@@ -110,6 +110,59 @@ nonisolated enum AIModelScanPolicy {
         return home.appendingPathComponent(".ollama/models", isDirectory: true).standardizedFileURL
     }
 
+    /// The two folders every Ollama store holds: `blobs` for the weights, named
+    /// by digest, and `manifests` for the models that use them. Ollama files a
+    /// model pulled from another registry under `manifests/<host>` (`hf.co`),
+    /// so the folder for its own registry is not required.
+    nonisolated static let ollamaStoreFolders: Set<String> = ["blobs", "manifests"]
+
+    /// Whether a folder is shaped like an Ollama store, read from the names of
+    /// its entries that are not regular files: folders, and links, so a store
+    /// with a linked `manifests` is still a store. Names are compared without
+    /// case, as APFS compares them by default. Large Files skips such a folder
+    /// even when Purge doesn't know it is Ollama's, such as `OLLAMA_MODELS` set
+    /// only in a shell profile while Purge started from the Dock. Trashing one
+    /// blob from it breaks every model that uses the blob, and Ollama goes on
+    /// listing them.
+    nonisolated static func isOllamaStore(folderNames: some Sequence<String>) -> Bool {
+        ollamaStoreFolders.isSubset(of: Set(folderNames.lazy.map { $0.lowercased() }))
+    }
+
+    /// Whether a folder on disk is shaped like an Ollama store, read the way
+    /// the Large Files walk reads it, so the walk and the delete gate always
+    /// agree. False for a folder that can't be listed.
+    nonisolated static func isOllamaStore(_ folder: URL) -> Bool {
+        guard let entries = DirectoryListing.entries(of: folder.path) else { return false }
+        return isOllamaStore(folderNames: entries.lazy.filter { !$0.isRegularFile }.map(\.name))
+    }
+
+    /// Whether any folder above `url` is shaped like an Ollama store. Large
+    /// Files' delete gate asks this, so a blob never goes alone, even from a
+    /// row saved before the walk knew the shape. The walk asks it of each
+    /// root, so a root inside a store lists nothing the gate would refuse.
+    ///
+    /// A folder above that can't be listed counts as a store: it may be one,
+    /// such as a store whose read permission was taken away after the scan. A
+    /// link counts as neither, because the listing doesn't follow it; the gate
+    /// also asks this of the real path, which passes through where it leads.
+    nonisolated static func isInsideOllamaStore(_ url: URL) -> Bool {
+        var folder = url.standardizedFileURL.deletingLastPathComponent()
+        while folder.path != "/", !folder.path.isEmpty {
+            if let entries = DirectoryListing.entries(of: folder.path) {
+                if isOllamaStore(folderNames: entries.lazy.filter { !$0.isRegularFile }.map(\.name)) { return true }
+            } else if !isLink(folder) {
+                return true
+            }
+            folder = folder.deletingLastPathComponent()
+        }
+        return false
+    }
+
+    private nonisolated static func isLink(_ url: URL) -> Bool {
+        var info = stat()
+        return lstat(url.path, &info) == 0 && (info.st_mode & S_IFMT) == S_IFLNK
+    }
+
     /// Current LM Studio location first, then the pre-0.3 cache location. Both
     /// are checked because an upgrade leaves the old directory behind.
     nonisolated static func lmStudioRoots(home: URL) -> [URL] {
```

**File**: `purge/Services/LargeFileScanPolicy.swift` (modified, +10/-1)
```diff
@@ -247,7 +247,8 @@ enum LargeFileScanPolicy {
     /// a VM bundle (`.pvm`, `.utm`, `.vmwarevm`) that is not in use, under a scan
     /// root or a VM root, and a Safari download bundle in `~/Downloads`. A loose
     /// file in a VM root is never eligible; that walk lists bundles only. Nor is a
-    /// file inside either kind of bundle.
+    /// file inside either kind of bundle, or inside a folder shaped like an
+    /// Ollama store, which the walk skips.
     ///
     /// This is Large Files' own gate, not `DeletionSafetyPolicy.evaluate(_:)`:
     /// these are the user's files, which the cache allowlist refuses by design.
@@ -281,6 +282,14 @@ enum LargeFileScanPolicy {
         let realPath = real.path
         if realPath.contains("/Library/") || isInHomeLibrary(realPath, home: home) { return false }
         if isInsideExcludedDirectory(real) { return false }
+        // Nothing in a folder shaped like an Ollama store is a Large Files
+        // row, whether or not Purge knows the store is Ollama's. A blob
+        // trashed alone breaks every model that uses it.
+        if AIModelScanPolicy.isInsideOllamaStore(std) || AIModelScanPolicy.isInsideOllamaStore(real) { return false }
+        // Nor is the store itself, whatever it is named (`models.pvm`).
+        if isDir.boolValue, AIModelScanPolicy.isOllamaStore(std) || AIModelScanPolicy.isOllamaStore(real) {
+            return false
+        }
 
         func walkedPath(_ root: URL) -> String? {
             walkedFolder(for: root, home: home, volumes: volumes, isLocalDisk: isLocalDisk).map {
```

**File**: `purge/Services/LargeFileScanner.swift` (modified, +27/-0)
```diff
@@ -216,6 +216,18 @@ nonisolated final class LargeFileScanner {
                 if !bundlesOnly { summary.checkedRoots.append(root) }
                 continue
             }
+            // A root that is shaped like an Ollama store, or sits inside one,
+            // holds nothing but blobs and manifests. The delete gate refuses
+            // anything under a store-shaped folder at any height, so the root
+            // is asked the same, by its spelling and where it really is. See
+            // the check on each folder below.
+            let realFolder = folder.resolvingSymlinksInPath()
+            if [root, realFolder].contains(where: {
+                AIModelScanPolicy.isOllamaStore($0) || AIModelScanPolicy.isInsideOllamaStore($0)
+            }) {
+                if !bundlesOnly { summary.checkedRoots.append(root) }
+                continue
+            }
             // How the enumerator spells the root, taken from its first child rather
             // than from `root`: it can differ (`/private/var` for `/var`), and
             // matching is on the path below this prefix. See `ScanExclusions`.
@@ -278,6 +290,11 @@ nonisolated final class LargeFileScanner {
                     if isVirtualMachine
                         || (!bundlesOnly && LargeFileScanPolicy.isSafariDownloadBundle(fileURL, home: home)) {
                         if isUserExcluded(fileURL) { return ([], false) }
+                        // A store shaped like Ollama's is never a row, whatever
+                        // it is named, such as `models.pvm`. Asked only of the
+                        // folders that would be rows, so the walk lists no
+                        // other folder twice.
+                        if AIModelScanPolicy.isOllamaStore(fileURL) { return ([], false) }
                         // A VM that may be running is left off the list; the
                         // delete check refuses it again in case it starts later.
                         if isVirtualMachine,
@@ -410,6 +427,16 @@ nonisolated final class LargeFileScanner {
                     }
                     // As `FileManager` lists with `.skipsHiddenFiles`.
                     let children = DirectoryListing.entries(of: folderURL.path) ?? []
+                    // A folder shaped like an Ollama store is skipped like the
+                    // known model stores, even where Purge doesn't know it is
+                    // Ollama's: listed one by one, each blob would be a row
+                    // that breaks models when trashed. Read from the names
+                    // just listed, so it costs no call.
+                    if AIModelScanPolicy.isOllamaStore(
+                        folderNames: children.lazy.filter { !$0.isRegularFile }.map(\.name)
+                    ) {
+                        return []
+                    }
                     var steps: [TreeStep<[Finding], WalkFolder>] = []
                     for child in children where !child.isHidden {
                         // A file under the size floor that is not a cloud
```

---

### Incident Patch 2: `ec40fc72` (2026-11-16)
**Commit Message**: fix: retry and explain Apple Intelligence removals that fail on macOS 27.3 (#343) (#390)

* fix: retry and explain Apple Intelligence removals that fail on macOS 27.3 (#343)

On the macOS 27.3 beta every release fails with NSCocoaErrorDomain 4097:
the asset service drops the connection. RemoveMacAI #123 shows the same.
A user there got through by removing the profile, letting the downloads
finish, then removing again.

A release or download request whose connection drops goes out again,
up to 3 times, 3 s and 6 s apart. A set that answers with a lock reply
gets one more request. Every request still names exactly one set.

Purge now watches the sets it released for up to 60 s before it judges
them, since macOS answers before it deletes. Sets that go within 15 min
of a failed removal are booked then, and the row says Removed.

Details now opens with what to try next, and adds what the asset
service logged while the requests ran. When nothing was removed, the
undo button reads Remove Profile, since that is all it does. Stopping a
removal now says Stopped instead of reporting a failure.

Tested on macOS 27.0 only. Not verified on 27.3.

* fix: hold Stop and book only real late removals

**File**: `PurgeTests/AppleIntelligenceModelStoreTests.swift` (modified, +551/-15)
```diff
@@ -323,66 +323,132 @@ struct AppleIntelligenceModelStoreTests {
     }
 
     /// A Mac that answers the worker from memory and records what was asked of
-    /// it, so `remove` and `downloadAgain` can run whole in a test.
+    /// it, so `remove` and `downloadAgain` can run whole in a test. Nothing
+    /// waits: pauses return at once.
     @MainActor
     private final class FakeMac {
-        var reading: AppleIntelligenceReading
         var blocks: [String]
         var siriLanguage: String? = "zh-TW"
         var resets: [String] = []
+        /// Each release request as sent, so a test can see how many sets one named.
+        var resetRequests: [[String]] = []
+        var subscribeCalls = 0
         var subscribed: [[String: Any]] = []
         var recorded: [[AppleIntelligenceModelSet]] = []
         /// What the worker answers for an op instead of success.
         var failing: [String: AppleIntelligenceWorker.Outcome] = [:]
         /// What the worker answers for a release of one set, by set name.
         var failingResets: [String: AppleIntelligenceWorker.Outcome] = [:]
-        /// What the Mac reads as once a release has been asked for.
+        /// Answers for a set's releases in order, before `failingResets` applies.
+        var resetReplies: [String: [AppleIntelligenceWorker.Outcome]] = [:]
+        /// Answers for the download requests in order, before `failing` applies.
+        var subscribeReplies: [AppleIntelligenceWorker.Outcome] = []
+        /// What the Mac reads as once a release has been asked for, and after
+        /// how many more readings, since macOS deletes after it answers.
         var readingAfterReset: AppleIntelligenceReading?
+        var readsBeforeDeleted = 0
+        /// How many releases macOS takes before `readingAfterReset` applies.
+        var resetsBeforeDeleted = 1
+        /// What the asset service logged, for the details.
+        var serviceLog: [String] = []
+        /// Runs after each release request, with how many have gone out.
+        var afterReset: ((Int) -> Void)?
+        /// Runs after a set's asset-type lookup.
+        var afterLookup: (() -> Void)?
+        /// Runs inside each pause, as a click during it would.
+        var duringPause: (() -> Void)?
+
+        func paused() { duringPause?() }
 
         /// The current reading, behind a lock: the store reads it off the main actor.
-        private final class ReadingBox: @unchecked Sendable {
+        final class ReadingBox: @unchecked Sendable {
             private let lock = NSLock()
             private var value: AppleIntelligenceReading
+            private var pending: (reading: AppleIntelligenceReading, reads: Int)?
             init(_ value: AppleIntelligenceReading) { self.value = value }
-            func get() -> AppleIntelligenceReading { lock.withLock { value } }
-            func set(_ new: AppleIntelligenceReading) { lock.withLock { value = new } }
+            func get() -> AppleIntelligenceReading {
+                lock.withLock {
+                    if let next = pending {
+                        if next.reads <= 0 {
+                            value = next.reading
+                            pending = nil
+                        } else {
+                            pending = (next.reading, next.reads - 1)
+                        }
+                    }
+                    return value
+                }
+            }
+            func set(_ new: AppleIntelligenceReading, afterReads reads: Int = 0) {
+                lock.withLock { pending = (new, reads) }
+            }
         }
 
+        let current: ReadingBox
+
         init(reading: AppleIntelligenceReading, blocks: [String]) {
-            self.reading = reading
+            current = ReadingBox(reading)
             self.blocks = blocks
         }
 
+        private let accepted = AppleIntelligenceWorker.Outcome(ok: true, result: [:], error: nil)
+
         var services: Store.Services {
             var services = Store.Services()
-            let current = ReadingBox(reading)
+            let current = current
             services.read = { current.get() }
             services.installedBlocks = { [blocks] in blocks }
             services.siriLanguage = { [siriLanguage] in siriLanguage }
             services.recordRemoval = { [self] sets, _, _ in self.recorded.append(sets) }
+            services.pause = { [self] _ in await self.paused() }
+            services.serviceLog = { [serviceLog] _ in serviceLog }
             services.runWorker = { [self] op, input, _ in
                 switch op {
                 case "asset-type":
+                    defer { self.afterLookup?() }
+                    if let failure = self.failing[op] { return failure }
                     let name = input["assetSet"] as? String
                     let type = AppleIntelligenceCatalog.sets.first { $0.name == name }?.assetType
                     return AppleIntelligenceWorker.Outcome(ok: true, result: [
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ You do not need to understand any of it to use it. But if you ever want to check
 - **Scan Everything** (⇧⌘R) scans every category, one at a time so the Mac stays responsive. When you open Purge it does the same on its own. Large Files, the app list and leftovers need Full Disk Access. Without it Purge still scans App Caches and Dev Tools, and skips the places macOS protects, such as sandboxed apps' caches
 - Each byte is counted once: an app's cache folder counts under App Caches, not again under the app
 - **Hidden in System Data**: a card under the categories for space macOS counts as System Data. Its **Time Machine snapshots** row is where you remove local snapshots, and on macOS 27 it also holds the Apple Intelligence models
-- **Apple Intelligence models** (macOS 27, Apple silicon): the on-device models macOS files under System Data, with no switch to remove them. Remove releases them through Apple's asset service and installs a profile, which you approve once, so they don't download again. Download Again asks you to remove the profile in System Settings, then asks macOS for the sets Purge removed, in your Siri language. The size shown is Apple's figure; Purge records what the disk really gave back
+- **Apple Intelligence models** (macOS 27, Apple silicon): the on-device models macOS files under System Data, with no switch to remove them. Remove releases them through Apple's asset service and installs a profile, which you approve once, so they don't download again. Download Again asks you to remove the profile in System Settings, then asks macOS for the sets Purge removed, in your Siri language. The size shown is Apple's figure; Purge records what the disk really gave back. If a removal fails, **Details** says what to try and shows everything macOS answered, and when nothing was removed the button reads **Remove Profile**
 
 ### App Caches
 
```

**File**: `README.ru.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@
 - **Сканировать всё** (⇧⌘R) проверяет каждую категорию по очереди, чтобы Mac оставался отзывчивым. При открытии Purge делает то же самое сам. Для больших файлов, списка приложений и остатков нужен «Полный доступ к диску». Без него Purge всё равно сканирует кэши приложений и инструменты разработчика и пропускает места, которые защищает macOS, например кэши приложений из песочницы
 - Каждый байт считается один раз: папка кэша приложения учитывается в кэшах приложений и не повторяется в самом приложении
 - **Скрыто в «Системных данных»**: карточка под категориями для места, которое macOS относит к «Системным данным». В её строке **Снимки Time Machine** удаляются локальные снимки, а в macOS 27 там же находятся модели Apple Intelligence
-- **Модели Apple Intelligence** (macOS 27, Apple silicon): модели на устройстве, которые macOS складывает в раздел «Системные данные», без переключателя для их удаления. «Удалить» освобождает их через службу ресурсов Apple и устанавливает профиль, который вы один раз подтверждаете, чтобы они больше не скачивались. «Скачать снова» просит вас удалить профиль в Системных настройках, а затем запрашивает у macOS наборы, которые удалил Purge, на языке Siri. Показанный размер — цифра Apple; Purge записывает, сколько места диск действительно вернул
+- **Модели Apple Intelligence** (macOS 27, Apple silicon): модели на устройстве, которые macOS складывает в раздел «Системные данные», без переключателя для их удаления. «Удалить» освобождает их через службу ресурсов Apple и устанавливает профиль, который вы один раз подтверждаете, чтобы они больше не скачивались. «Скачать снова» просит вас удалить профиль в Системных настройках, а затем запрашивает у macOS наборы, которые удалил Purge, на языке Siri. Показанный размер — цифра Apple; Purge записывает, сколько места диск действительно вернул. Если удаление не удалось, **Подробности** подсказывают, что попробовать, и показывают полный ответ macOS, а если ничего не удалено, кнопка называется **Удалить профиль**
 
 ### Кэши приложений
 
```

**File**: `README.uk.md` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@
 - **Scan Everything** (⇧⌘R) сканує всі категорії по черзі, щоб Mac не гальмував. Коли ви відкриваєте Purge, він робить це сам. Для Large Files, списку застосунків і залишків потрібен «Повний доступ до диска». Без нього Purge однаково сканує App Caches і Dev Tools та пропускає місця, які захищає macOS, наприклад кеші застосунків у пісочниці
 - Кожен байт рахується один раз: папка кешу застосунку рахується в App Caches, а не ще раз у самому застосунку
 - **Hidden in System Data** («сховане в системних даних»): картка під категоріями для місця, яке macOS зараховує до системних даних. У її рядку **Time Machine snapshots** видаляються локальні знімки, а на macOS 27 там же є моделі Apple Intelligence
-- **Моделі Apple Intelligence** (macOS 27, Apple silicon): моделі на пристрої, які macOS записує до системних даних і для яких немає перемикача, щоб їх видалити. Remove вивільняє їх через службу ресурсів Apple і встановлює профіль, який ви схвалюєте один раз, щоб вони не завантажувалися знову. Download Again просить вас видалити профіль у Системних параметрах, а потім запитує в macOS набори, які видалив Purge, мовою вашої Siri. Показаний розмір — це цифра Apple; Purge записує, скільки диск звільнив насправді
+- **Моделі Apple Intelligence** (macOS 27, Apple silicon): моделі на пристрої, які macOS записує до системних даних і для яких немає перемикача, щоб їх видалити. Remove вивільняє їх через службу ресурсів Apple і встановлює профіль, який ви схвалюєте один раз, щоб вони не завантажувалися знову. Download Again просить вас видалити профіль у Системних параметрах, а потім запитує в macOS набори, які видалив Purge, мовою вашої Siri. Показаний розмір — це цифра Apple; Purge записує, скільки диск звільнив насправді. Якщо видалити не вдалося, **Details** підказує, що спробувати, і показує повну відповідь macOS, а якщо нічого не видалено, кнопка називається **Remove Profile**
 
 ### Кеші застосунків (App Caches)
 
```

**File**: `README.zh-CN.md` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@
 - **扫描全部**（⇧⌘R）会逐个扫描所有类别，一次只扫一个，让 Mac 保持流畅。打开 Purge 时，它也会自动执行同样的操作。大文件、应用列表和残留文件需要完全磁盘访问权限。没有该权限时，Purge 仍会扫描应用缓存和开发工具，并跳过受 macOS 保护的位置，例如沙盒应用的缓存
 - 每个字节只统计一次：应用的缓存文件夹计入应用缓存，不会在该应用名下重复计算
 - **藏在“系统数据”中**：位于各类别下方的一张卡片，显示 macOS 计入“系统数据”的空间。其中的 **时间机器快照** 一行用来移除本地快照；在 macOS 27 上，它还包含 Apple 智能模型
-- **Apple 智能模型**（macOS 27，Apple 芯片）：macOS 归入“系统数据”的设备端模型，系统没有提供移除它们的开关。**移除** 会通过 Apple 的资源服务释放它们，并安装一个描述文件（你只需批准一次），让它们不会再次下载。**重新下载** 会请你在系统设置中移除该描述文件，然后按你的 Siri 语言向 macOS 请求 Purge 移除的那些模型。显示的大小是 Apple 给出的数字；Purge 记录的是磁盘实际释放的空间
+- **Apple 智能模型**（macOS 27，Apple 芯片）：macOS 归入“系统数据”的设备端模型，系统没有提供移除它们的开关。**移除** 会通过 Apple 的资源服务释放它们，并安装一个描述文件（你只需批准一次），让它们不会再次下载。**重新下载** 会请你在系统设置中移除该描述文件，然后按你的 Siri 语言向 macOS 请求 Purge 移除的那些模型。显示的大小是 Apple 给出的数字；Purge 记录的是磁盘实际释放的空间。如果移除失败，**详细信息** 会告诉你可以尝试的办法，并显示 macOS 的完整回应；如果什么都没有移除，按钮会显示为 **移除描述文件**
 
 ### 应用缓存（App Caches）
 
```

**File**: `SECURITY.md` (modified, +6/-1)
```diff
@@ -150,7 +150,12 @@ and the one change it makes that outlasts the app:
   Settings. It only points the model downloads at a dead local address so
   macOS does not fetch them again. It stays in Device Management until you
   choose Download Again or remove it there. Download Again also asks macOS
-  for the models back.
+  for the models back. When a removal took nothing, the same button reads
+  Remove Profile and only removes the profile.
+- **One log read, after a failure only.** When a request fails, Purge reads
+  what the asset service, `assetsubscriptiond`, logged meanwhile with
+  `log show`, so the row's Details can show it. Private values stay redacted,
+  and nothing leaves the Mac unless you copy it into a report.
 - **Nothing automatic.** Neither scheduled cleaning nor Clean Safe Items ever
   touches the models.
 
```

**File**: `purge/Models/AppleIntelligenceModels.swift` (modified, +29/-1)
```diff
@@ -202,6 +202,8 @@ nonisolated enum AppleIntelligenceOutcome: Equatable, Sendable {
     /// `reason` is short enough for the row. `details` is everything macOS
     /// answered, for the Details button; nil when Purge has no more to say (#343).
     case someLeft(removed: Int, left: Int, reason: String, details: String?)
+    /// The user stopped the removal between sets, and nothing failed.
+    case stopped(removed: Int, left: Int)
     /// The profile was never installed, so nothing was released.
     case profileNotInstalled
     case notReady(String, details: String?)
@@ -217,8 +219,34 @@ nonisolated enum AppleIntelligenceOutcome: Equatable, Sendable {
         switch self {
         case .someLeft(_, _, _, let details), .notReady(_, let details), .downloadRequestFailed(_, let details):
             return details
-        case .removed, .profileNotInstalled, .downloadRequested, .downloadNotStarted, .profileStillInstalled:
+        case .removed, .stopped, .profileNotInstalled, .downloadRequested, .downloadNotStarted, .profileStillInstalled:
             return nil
         }
     }
+
+    /// What the user can do after a failed Remove or Download Again, for the
+    /// row's Details. `undoTitle` is the title the button that lifts the block
+    /// has right now, so the steps name the button the row shows.
+    ///
+    /// A restart comes first: it lets go of a model something still holds
+    /// (RemoveMacAI's issue 38) and of a download stuck on the block (its issue
+    /// 109). The second step is what got the removal through on the macOS 27.3
+    /// beta, where the service dropped every release (its issue 123, #343).
+    func nextSteps(undoTitle: String) -> [String] {
+        switch self {
+        case .someLeft:
+            return [
+                String(localized: "Restart your Mac, then click Remove again."),
+                String(localized: "If they still stay, click \(undoTitle), leave your Mac on until macOS has finished downloading the models, then click Remove again."),
+            ]
+        case .downloadRequestFailed:
+            return [
+                String(localized: "Restart your Mac, then click Download Again."),
+                String(localized: "The profile is gone, so macOS also downloads the models by itself when you use a feature that needs them."),
+            ]
+        case .removed, .stopped, .notReady, .profileNotInstalled, .downloadRequested, .downloadNotStarted,
+             .profileStillInstalled:
+            return []
+        }
+    }
 }
```

**File**: `purge/Services/AppleIntelligenceModelReader.swift` (modified, +56/-2)
```diff
@@ -494,6 +494,14 @@ nonisolated enum AppleIntelligenceWorker {
         func detailLine(op: String, subject: String) -> String {
             "\(op) \(subject): \(error ?? "no reason given")"
         }
+
+        /// The connection to the service broke rather than the service saying
+        /// no. The service starts on demand and can go away mid-request, so
+        /// these are worth asking again; a release or a subscription asked
+        /// twice is the same request.
+        var isConnectionDrop: Bool {
+            AppleIntelligenceWorker.connectionProblem(domain: domain, code: code) != nil
+        }
     }
 
     /// The three ways the connection to macOS's asset service fails, in plain
@@ -516,11 +524,18 @@ nonisolated enum AppleIntelligenceWorker {
     /// The text behind the row's Details button, made to be pasted into a bug
     /// report: the Purge and macOS versions, then one line per failed call.
     /// The lines are the service's own words, so they stay as they came.
-    static func details(_ lines: [String], purge: String = AppleIntelligenceWorker.purgeVersion,
+    /// `serviceLog` is what the asset service itself logged meanwhile, which is
+    /// the only place its reason shows when it drops the connection (#343).
+    static func details(_ lines: [String], serviceLog: [String] = [],
+                        purge: String = AppleIntelligenceWorker.purgeVersion,
                         system: String = ProcessInfo.processInfo.operatingSystemVersionString) -> String? {
         guard !lines.isEmpty else { return nil }
         // A blank line between requests: each one wraps over several lines.
-        return (["Purge \(purge), macOS \(system)"] + lines).joined(separator: "\n\n")
+        var parts = ["Purge \(purge), macOS \(system)"] + lines
+        if !serviceLog.isEmpty {
+            parts.append((["assetsubscriptiond log:"] + serviceLog).joined(separator: "\n"))
+        }
+        return parts.joined(separator: "\n\n")
     }
 
     static var purgeVersion: String {
@@ -618,6 +633,45 @@ nonisolated enum AppleIntelligenceWorker {
     }
 }
 
+/// What macOS's asset service, `assetsubscriptiond`, logged while Purge's
+/// requests ran. When the service drops the connection, the worker gets only
+/// NSCocoaErrorDomain 4097 and the reason is in this log (#343), so a failed
+/// request's details carry it. Read with `log show`, which keeps private
+/// values redacted; nothing is read unless a request failed.
+nonisolated enum AppleIntelligenceServiceLog {
+    /// The service's request handling (`UAFXPCService`, which also logs a
+    /// client it turns away and a relaunch), its faults, and its errors about
+    /// releasing. Its other errors are routine catalog checks, dozens a minute.
+    static let predicate = #"process == "assetsubscriptiond" AND (eventMessage CONTAINS "UAFXPCService" OR messageType == fault OR (messageType == error AND (eventMessage CONTAINS[c] "reset" OR eventMessage CONTAINS[c] "eliminat" OR eventMessage CONTAINS[c] "unauthorized")))"#
+
+    static let maxLines = 30
+    static let maxLineLength = 400
+
+    static func lines(since start: Date) async -> [String] {
+        let formatter = DateFormatter()
+        formatter.locale = Locale(identifier: "en_US_POSIX")
+        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
+        guard let output = await ProcessRunner.runAsync(
+            executablePath: "/usr/bin/log",
+            arguments: ["show", "--start", formatter.string(from: start.addingTimeInterval(-2)),
+                        "--predicate", predicate, "--style", "compact"],
+            timeout: 30
+        ), output.succeeded else { return [] }
+        return parse(output.stdoutText)
+    }
+
+    /// One line per entry, newest last, each cut to a readable length. A
+    /// message's continuation lines and the header are left out.
+    static func parse(_ text: String) -> [String] {
+        let entries = text.split(whereSeparator: \.isNewline).map(String.init).filter { line in
+            line.first?.isNumber == true
+        }
+        return entries.suffix(maxLines).map { line in
+            line.count > maxLineLength ? String(line.prefix(maxLineLength)) + "…" : line
+        }
+    }
+}
+
 /// Free blocks only, with no purgeable accounting. On macOS 27 freshly
 /// downloaded models are purgeable, so they vanish from the figure System
 /// Settings shows but not from this one; the two together say what a removal
```

---

### Incident Patch 3: `08c1bf14` (2026-11-16)
**Commit Message**: fix: count APFS clones once in Large Files rows (#376) (#384)

* fix: count APFS clones once in Large Files rows (#376)

A file duplicated in Finder is a clone. Both copies showed their full
size in Large Files, and Duplicates said trashing the extra copy freed
all of it. Trashing either frees nothing while the other stays.

Large Files rows for single files now show a full clone's share, as
folder scans do since #131, so a duplicated file adds up to one copy.
The size floor still reads the whole allocated size, so a copy of a big
file stays on the list. Purgeable files keep their full size.

Duplicates leaves out a file that shares all its blocks with clones,
as it already leaves out hard-linked files.

DirectoryListing asks for the extended flags and clone count, never
ATTR_CMNEXT_PRIVATESIZE. One SharedBlocks.FileState reader now serves
the folder walk, the listing, single-file reads and the contents-clean
booking.

* fix: list a folder without clone state when the extended read fails

DirectoryListing now always asks for the extended flags and clone
count. When the first getattrlistbulk call fails with them, it tries
once more without them, as the folder walk does, and the file

**File**: `PurgeTests/LargeFileCloneTests.swift` (added, +256/-0)
```diff
@@ -0,0 +1,256 @@
+import Darwin
+import Foundation
+import Testing
+@testable import Purge
+
+/// Large Files rows count an APFS clone set once, as folder scans do (#376).
+/// A file duplicated in Finder is a clone, and trashing one copy frees nothing
+/// while the other stays. Real clones are made in temporary folders only,
+/// never the user's own.
+@Suite("Clones in Large Files (#376)")
+struct LargeFileCloneTests {
+    private let fm = FileManager.default
+
+    private static var countsClones: Bool {
+        SharedBlocks.attributes & attrgroup_t(ATTR_CMNEXT_CLONE_REFCNT) != 0
+    }
+
+    /// The folder the scan walks, inside a folder of the test's own. Remove
+    /// the parent when done.
+    private func makeRoot() throws -> URL {
+        let root = fm.temporaryDirectory
+            .appendingPathComponent("purge-large-clones-\(UUID().uuidString)/files", isDirectory: true)
+        try fm.createDirectory(at: root, withIntermediateDirectories: true)
+        return root
+    }
+
+    private func write(_ bytes: Int, to url: URL, seed: UInt8 = 31) throws {
+        try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
+        try Data((0..<bytes).map { UInt8(truncatingIfNeeded: $0) &* seed }).write(to: url)
+    }
+
+    private func clone(_ source: URL, to destination: URL) throws {
+        try fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
+        try #require(clonefile(source.path, destination.path, 0) == 0, "clonefile: \(errno)")
+    }
+
+    private func allocated(_ url: URL) throws -> Int64 {
+        Int64(try #require(url.resourceValues(forKeys: [.totalFileAllocatedSizeKey]).totalFileAllocatedSize))
+    }
+
+    private func scan(_ root: URL, minBytes: Int64) async -> [LargeFile] {
+        let ledger = FileAccessLedger(
+            fileURL: root.deletingLastPathComponent().appendingPathComponent("ledger/access-times.json")
+        )
+        let stream = LargeFileScanner().scanEvents(
+            minBytes: minBytes,
+            staleDays: 0,
+            roots: [root],
+            virtualMachineRoots: [],
+            iCloudDriveRoots: [],
+            installedApps: [],
+            isAppRunning: { _ in false },
+            home: root,
+            exclusions: ScanExclusions(keys: []),
+            isExcluded: { _ in false },
+            accessLedger: ledger
+        )
+        var files: [LargeFile] = []
+        for await event in stream {
+            if case .file(let file) = event { files.append(file) }
+        }
+        return files
+    }
+
+    private func row(_ name: String, in rows: [LargeFile]) throws -> LargeFile {
+        try #require(rows.first { $0.path.lastPathComponent == name })
+    }
+
+    // MARK: The rule
+
+    /// Keep Only in iCloud is offered only for purgeable files, and its row
+    /// shows what eviction gives back, so a purgeable file keeps its size.
+    @Test
+    func aPurgeableFileKeepsItsSize() {
+        let purgeable = SharedBlocks.FileState(flags: UInt64(EF_IS_PURGEABLE), cloneCount: 1)
+        #expect(!purgeable.isFullClone)
+        #expect(purgeable.countedBytes(allocated: 90_112) == 90_112)
+    }
+
+    @Test
+    func aFullCloneShowsItsShareAndAnythingElseItsSize() {
+        let sharesAll = UInt64(EF_SHARES_ALL_BLOCKS) | UInt64(EF_MAY_SHARE_BLOCKS)
+        let full = SharedBlocks.FileState(flags: sharesAll, cloneCount: 2)
+        #expect(full.isFullClone)
+        #expect(full.countedBytes(allocated: 90_112) == 45_056)
+        // A purgeable clone still shows only its share: evicting it frees
+        // nothing while another clone stays.
+        let purgeableClone = SharedBlocks.FileState(flags: sharesAll | UInt64(EF_IS_PURGEABLE), cloneCount: 3)
+        #expect(purgeableClone.isFullClone)
+        #expect(purgeableClone.countedBytes(allocated: 90_112) == 30_038)
+
+        for other in [
+            SharedBlocks.FileState.unknown,
+            SharedBlocks.FileState(flags: 0, cloneCount: 1),
+            SharedBlocks.FileState(flags: UInt64(EF_MAY_SHARE_BLOCKS), cloneCount: 2),
+            SharedBlocks.FileState(flags: sharesAll, cloneCount: 1),
+            SharedBlocks.FileState(flags: sharesAll, cloneCount: nil),
+        ] {
+            #expect(!other.isFullClone)
+            #expect(other.countedBytes(allocated: 90_112) == 90_112)
+        }
+    }
+
+    // MARK: Reading the volume
+
+    @Test(.enabled(if: countsClones))
+    func bothReadsSeeAClone() throws {
+        let root = try makeRoot()
+        defer { try? fm.removeItem(at: root.deletingLastPathComponent()) }
+        let original = root.appendingPathComponent("original.mov")
+        let copy = root.appendingPathComponent("original copy.mov")
+        let plain = root.appendingPathComponent("plain.mov")
+        try write(300_000, to: original)
+        try clone(original, to: copy)
+        try write(300_000, to: plain, seed: 7)
+
+        #expect(
```

**File**: `purge/Services/DuplicateFileDetector.swift` (modified, +11/-4)
```diff
@@ -22,10 +22,10 @@ import Foundation
 /// Trash is a thin backstop for that.
 ///
 /// **Hard links** are collapsed before bucketing: two names for one inode are not
-/// two copies, and deleting one frees nothing. **APFS clones** are not detectable
-/// this way — they have distinct inodes but share storage, so a clone pair is
-/// reported as a duplicate whose reclaimable bytes overstate what deleting
-/// actually frees. There is no cheap public API for block sharing.
+/// two copies, and deleting one frees nothing. **APFS clones** are left out
+/// the same way (#376): a file that shares all its blocks with another full
+/// clone, such as a copy made with Finder's Duplicate, has its own inode but
+/// no blocks of its own, so deleting it frees nothing either.
 ///
 /// `nonisolated` is load-bearing, not tidiness — same reason as `LargeFileScanner`.
 /// The project builds with `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`, so without
@@ -123,6 +123,13 @@ nonisolated final class DuplicateFileDetector {
             // the failure this feature cannot afford.
             guard linkCount(for: url) == 1 else { continue }
 
+            // A full clone is left out for the same reason (#376). While any
+            // other clone stays, its blocks stay too, so its group would
+            // promise space that trashing it never gives back. A copy that was
+            // written to after it was cloned shares only some blocks and is
+            // still compared.
+            guard !SharedBlocks.state(ofFileAt: url.path).isFullClone else { continue }
+
             // One file can still have two rows when a folder on the way is a
             // symlink: one inode by two paths, each with a link count of 1. They
             // are one file, not two copies, and trashing the "extra copy" would
```

**File**: `purge/Services/LargeFileScanner.swift` (modified, +23/-5)
```diff
@@ -254,7 +254,7 @@ nonisolated final class LargeFileScanner {
                 if walkedRootPrefix == nil {
                     walkedRootPrefix = fileURL.deletingLastPathComponent().path + "/"
                 }
-                units.append((fileURL, (try? fileURL.resourceValues(forKeys: resourceKeys)).map(Seen.init)))
+                units.append((fileURL, (try? fileURL.resourceValues(forKeys: resourceKeys)).map { Seen($0, url: fileURL) }))
             }
             let prefix = walkedRootPrefix
 
@@ -348,8 +348,17 @@ nonisolated final class LargeFileScanner {
                     let provider = LargeFileScanSummary.CloudProvider.provider(for: fileURL, isUbiquitous: isUbiquitous, home: home)
                     return ([.cloudOnly(provider, bytes: Int64(logical))], false)
                 }
+                // A file that shares all its blocks with clones shows its share,
+                // so a file duplicated in Finder adds up to one copy (#376).
+                // The size floor still reads the whole allocated size: a copy
+                // of a big file is a big file to the person looking for it.
+                // Read only for a file past the floor, since a root's own
+                // entries cost a call each.
+                let rowBytes = size >= minBytes
+                    ? values.allocatedBytes.map { values.sharedBlocks().countedBytes(allocated: $0) }
+                    : nil
                 guard let file = listed(
-                    fileURL, size: size, lastUsed: max(accessed, modified),
+                    fileURL, size: size, rowBytes: rowBytes, lastUsed: max(accessed, modified),
                     minBytes: minBytes, staleDays: staleDays, now: now,
                     installedApps: installedApps, isExcluded: isExcluded,
                     home: home, downloadOnly: walk.downloadOnly
@@ -455,8 +464,12 @@ nonisolated final class LargeFileScanner {
         let accessDate: Date
         let modificationDate: Date
         let isPackage: () -> Bool
+        /// The blocks a file shares with clones. `URLResourceValues` has no
+        /// key for them, so for an entry read that way they are asked of the
+        /// file when the walk needs them.
+        let sharedBlocks: () -> SharedBlocks.FileState
 
-        init(_ values: URLResourceValues) {
+        init(_ values: URLResourceValues, url: URL) {
             // A package reads as a folder here, as it did in the walk's checks.
             isDirectory = values.isDirectory == true || values.isPackage == true
             isRegularFile = values.isRegularFile == true
@@ -466,6 +479,7 @@ nonisolated final class LargeFileScanner {
             modificationDate = values.contentModificationDate ?? .distantPast
             let isPackage = values.isPackage == true
             self.isPackage = { isPackage }
+            sharedBlocks = { SharedBlocks.state(ofFileAt: url.path) }
         }
 
         init(_ entry: ListingEntry, url: URL) {
@@ -476,6 +490,8 @@ nonisolated final class LargeFileScanner {
             accessDate = entry.accessDate
             modificationDate = entry.modificationDate
             isPackage = { (try? url.resourceValues(forKeys: [.isPackageKey]))?.isPackage == true }
+            let sharedBlocks = entry.sharedBlocks
+            self.sharedBlocks = { sharedBlocks }
         }
     }
 
@@ -517,10 +533,12 @@ nonisolated final class LargeFileScanner {
     }
 
     /// The checks every listed item passes, file or bundle, and the row it
-    /// becomes. Nil when the item stays off the list.
+    /// becomes. Nil when the item stays off the list. `size` is what the size
+    /// floor compares, and the row shows `rowBytes` when given (#376).
     private static func listed(
         _ fileURL: URL,
         size: Int64,
+        rowBytes: Int64? = nil,
         lastUsed: Date,
         minBytes: Int64,
         staleDays: Int,
@@ -571,7 +589,7 @@ nonisolated final class LargeFileScanner {
 
         return LargeFile(
             path: fileURL.standardizedFileURL,
-            sizeBytes: size,
+            sizeBytes: rowBytes ?? size,
             lastUsed: lastUsed,
             category: LargeFileCategory.category(forExtension: fileURL.pathExtension),
             syncsWithICloud: syncsWithICloud,
```

**File**: `purge/Utilities/FolderWalker.swift` (modified, +81/-25)
```diff
@@ -439,29 +439,69 @@ nonisolated enum SharedBlocks {
     /// One file read on its own, without following a link: `allocated` when
     /// the volume says nothing or the file can't be read.
     static func countedBytes(ofFileAt path: String, allocated: Int64) -> Int64 {
-        guard attributes & attrgroup_t(ATTR_CMNEXT_CLONE_REFCNT) != 0 else { return allocated }
+        state(ofFileAt: path).countedBytes(allocated: allocated)
+    }
+}
+
+/// One file's shared blocks, read on their own or from a listing: Large Files
+/// rows and Duplicates (#376), and the sizes a contents clean books.
+nonisolated extension SharedBlocks {
+    /// What the volume reports about one file's shared blocks. Both are nil
+    /// when it reports nothing.
+    struct FileState {
+        var flags: UInt64?
+        var cloneCount: UInt32?
+
+        static let unknown = FileState(flags: nil, cloneCount: nil)
+
+        /// The file shares all its blocks with at least one other full clone,
+        /// so moving it to the Trash gives back nothing while they stay.
+        var isFullClone: Bool {
+            guard let flags, flags & UInt64(EF_SHARES_ALL_BLOCKS) != 0, let cloneCount else { return false }
+            return cloneCount > 1
+        }
+
+        /// A full clone's share of `allocated`, and all of it for any other
+        /// file, a purgeable one included.
+        func countedBytes(allocated: Int64) -> Int64 {
+            SharedBlocks.countedBytes(allocated: allocated, flags: flags, cloneCount: cloneCount)
+        }
+    }
+
+    /// Reads one file's flags and clone count with `getattrlist`, without
+    /// following a link. `.unknown` when it can't be read.
+    static func state(ofFileAt path: String) -> FileState {
+        guard attributes != 0 else { return .unknown }
         var list = attrlist()
         list.bitmapcount = u_short(ATTR_BIT_MAP_COUNT)
         list.commonattr = attrgroup_t(ATTR_CMN_RETURNED_ATTRS)
         list.forkattr = attributes
+        // Length, returned set, then a UInt64 and a UInt32.
         var buffer = [UInt8](repeating: 0, count: 64)
         let options = UInt32(FSOPT_NOFOLLOW) | UInt32(FSOPT_ATTR_CMN_EXTENDED)
-        return buffer.withUnsafeMutableBytes { raw -> Int64 in
-            guard let base = raw.baseAddress, getattrlist(path, &list, base, raw.count, options) == 0 else {
-                return allocated
-            }
-            // A 4-byte length, the returned set, then the attributes by bit.
+        return buffer.withUnsafeMutableBytes { raw -> FileState in
+            guard let base = raw.baseAddress,
+                  getattrlist(path, &list, base, raw.count, options) == 0 else { return .unknown }
             var field = base + 4
             let returned = field.loadUnaligned(as: attribute_set_t.self)
             field += MemoryLayout<attribute_set_t>.size
-            guard returned.forkattr & attrgroup_t(ATTR_CMNEXT_EXT_FLAGS) != 0,
-                  returned.forkattr & attrgroup_t(ATTR_CMNEXT_CLONE_REFCNT) != 0
-            else { return allocated }
-            let flags = field.loadUnaligned(as: UInt64.self)
+            return readState(from: &field, returned: returned)
+        }
+    }
+
+    /// Reads the flags and clone count where `field` points, in the order the
+    /// kernel packs them, and moves `field` past them.
+    static func readState(from field: inout UnsafeMutableRawPointer, returned: attribute_set_t) -> FileState {
+        var state = FileState.unknown
+        if returned.forkattr & attrgroup_t(ATTR_CMNEXT_EXT_FLAGS) != 0 {
+            state.flags = field.loadUnaligned(as: UInt64.self)
             field += MemoryLayout<UInt64>.size
-            let cloneCount = field.loadUnaligned(as: UInt32.self)
-            return countedBytes(allocated: allocated, flags: flags, cloneCount: cloneCount)
         }
+        if returned.forkattr & attrgroup_t(ATTR_CMNEXT_CLONE_REFCNT) != 0 {
+            state.cloneCount = field.loadUnaligned(as: UInt32.self)
+            field += MemoryLayout<UInt32>.size
+        }
+        return state
     }
 }
 
@@ -623,16 +663,7 @@ nonisolated final class DirectoryReader {
             allocated = field.loadUnaligned(as: Int64.self)
             field += MemoryLayout<Int64>.size
         }
-        var flags: UInt64?
-        if returned.forkattr & attrgroup_t(ATTR_CMNEXT_EXT_FLAGS) != 0 {
-            flags = field.loadUnaligned(as: UInt64.self)
-            field += MemoryLayout<UInt64>.size
-        }
-        var cloneCount: UInt32?
-        if returned.forkattr & attrgroup_t(ATTR_CMNEXT_CLONE_REFCNT) != 0 {
-            cloneCount = field.loadUnaligned(as: UInt32.self)
-        }
-        let counted = SharedBlocks.countedBytes(allocated: max(0, allocated), flags: flags, cloneCount: cloneCount)
+        let counted = SharedBlocks.readState(from: &field, returned: returned).countedBytes(allocated: max(0, allocated))
         if counting == .regularFiles {
             guard type == VREG.
```

#### Recent Merged Pull Requests:
- **PR #396** (2026-11-17): fix: keep an Ollama store Purge doesn't know out of Large Files (#395) (@jithin-sabu)
- **PR #394** (2026-11-17): feat: scan added folders and drives in Large Files and Developer Projects (#318) (@jithin-sabu)
- **PR #391** (2026-11-16): docs: add a website badge to the README (@jithin-sabu)
- **PR #390** (2026-11-16): fix: retry and explain Apple Intelligence removals that fail on macOS 27.3 (#343) (@jithin-sabu)
- **PR #389** (2026-11-16): refactor: name every case in switches over Purge's own enums (#186) (@jithin-sabu)
- **PR #388** (2026-11-16): fix: stop a stray kill on timeout and show app names as typed (#182) (@jithin-sabu)

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

## X. keep an Ollama store Purge doesn't know out of Large Files

**RULE**:
When implementing operations in `PurgeTests/OllamaStoreShapeTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jithin-sabu/purge-app. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5d909efd`: keep an Ollama store Purge doesn't know out of Large Files. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `PurgeTests/OllamaStoreShapeTests.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
import Foundation
import Testing
@testable import Purge

/// An Ollama store in a folder Large Files walks, at a path Purge doesn't know
/// (`OLLAMA_MODELS` set only in a shell profile while Purge started from the
/// Dock), is known by its shape: `blobs` beside `manifests`. Large Files never
/// lists its blobs one by one, and its gate refuses them, because trashing one
/// blob breaks every model that uses it. AI Models doesn't list such a store
/// either. Every fixture is a throwaway home in the temporary folder.
@Suite("An Ollama store Purge doesn't know stays out of Large Files")
struct OllamaStoreShapeTests {
    // MARK: - Fixtures

    private struct Home {
        let url: URL

        init() throws {
            url = FileManager.default.temporaryDirectory
                .appendingPathComponent("purge-ollama-shape-\(UUID().uuidString)", isDirectory: true)
                .standardizedFileURL
            try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        }

        @discardableResult
        func file(_ relative: String, bytes: Int = 4096) throws -> URL {
            let file = url.appendingPathComponent(relative)
            try
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5d909efd` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
