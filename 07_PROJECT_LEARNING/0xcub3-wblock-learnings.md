> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/0xcub3-wblock-learnings.md`  
> **Source**: github ([https://github.com/0xCUB3/wBlock](https://github.com/0xCUB3/wBlock))  
> **Source Version**: `04c047f8`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T13:13:33.431Z  
> **Learning ID**: `learn-github-0xcub3-wblock`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): 0xCUB3/wBlock

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Architectural Problem Statement
WebKit on Apple platforms (macOS, iOS, iPadOS, visionOS) imposes structural constraints on privacy and content-filtering extensions:
1. **Rule Limits**: Native Safari Content Blocker extensions (`SFContentBlockerManager`) are hard-capped by WebKit at 150,000 rules per extension target.
2. **Context Isolation**: Each Content Blocker operates as an isolated black box in memory. An exception rule (`@@||example.com^`) compiled into Extension Target $A$ cannot suppress a block rule compiled into Extension Target $B$.
3. **Telemetry Absence**: Safari Content Blockers evaluate rules directly inside the WebKit networking process; WebKit yields zero callbacks, counts, or blocked-request telemetry back to the extension process.
4. **Inter-Process Sandboxing**: Sandboxed app extensions, CLI background update agents (`FilterUpdateAgent`), launch daemons, and the main SwiftUI GUI app operate across distinct PID and container boundaries, communicating exclusively through Darwin notifications and POSIX App Group shared containers.

```
+--------------------------------------------------------------------------------------------------+
|                                    wBlock Application Space                                      |
|                                                                                                  |
|  +--------------------+        App Group Container (group.skula.wBlock)       +---------------+  |
|  |  SwiftUI Main App  | <---------------------------------------------------> | Update Agent  |  |
|  | (State & Compiler) |                                                       | (macOS Daemon)|  |
|  +---------+----------+                                                       +-------+-------+  |
|            |                                                                          |          |
|            | Darwin Notify: CFNotificationCenterGetDarwinNotifyCenter()               |          |
|            v                                                                          v          |
|  +--------------------+---------------------+--------------------+--------------------+          |
|  | Content Blocker 1  | Content Blocker 2   | Content Blocker 3  | Content Blocker 4  | ... (5)  |
|  | (150k JSON Rules)  | (150k JSON Rules)   | (150k JSON Rules)  | (150k JSON Rules)  |          |
|  +--------------------+---------------------+--------------------+--------------------+          |
|            |                     |                    |                    |                     |
|  +---------v---------------------v--------------------v--------------------v------------------+  |
|  |                               WebKit Networking Core Layer                                 |  |
|  |                     (Isolated Rule Engines - No Cross-Slot Communication)                  |  |
|  +--------------------------------------------------------------------------------------------+  |
|                                                  ^                                               |
|                                                  | DNR Priority Mirroring (1..1,700,000)         |
|  +-----------------------------------------------+--------------------------------------------+  |
|  |              wBlock Scripts WebExtension (Declarative Net Request Engine)                 |  |
|  |  - Blocked Request Counter (DNR Rule IDs 1.66M - 1.70M)                                     |  |
|  |  - Userscript Injection Engine (Greasemonkey GM_*, Scriptlets, UserCSS Engine)            |  |
|  +--------------------------------------------------------------------------------------------+  |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 System Mechanics & Invariant Contracts
- **Five Content Blocker Topology**: wBlock deploys 5 parallel native Content Blocker extension targets (aggregating a maximum theoretical capacity of 750,000 rules).
- **Compilation Engine (`wBlockCoreService`)**: Parses Adblock Plus/AdGuard-format filter lists into WebKit-compatible JSON bytecode arrays (`[{"trigger": {...}, "action": {...}}]`).
- **DNR Shadow Engine (`BlockedCountDNRRules`)**: Because WebKit drops content blocker telemetry, wBlock compiles a parallel shadow set of host-anchored rules into the WebExtension `declarativeNetRequest` (DNR) schema. When WebKit triggers a DNR block, it increments the extension's badge counter without interfering with Content Blocker evaluation.
- **Actor-Isolated Persistence (`SharedAutoUpdateManager`, `ConcurrentLogManager`)**: Thread safety and mutation synchronization across asynchronous network downloads, compilation pipelines, and multi-extension reloading are guarded by Swift Concurrency actors and explicit `Task.checkCancellation()` boundaries.

---

## 2. Net-New Universal Engineering Rules

### 1. Multi-Target Sharding of Exception-Isolated Rule Engines
**RULE**:
When sharding a rule set across multiple isolated execution partitions (such as Safari Content Blockers) where partitions do not share state, rules MUST be divided by a stable non-cryptographic hash (such as 64-bit FNV-1a), BUT every exception rule (`@@`), directive, badfilter (`$badfilter`), and domain affinity rule MUST be replicated identically across 100% of the active partitions.

**WHY**:
Partition-isolated rule engines evaluate independent data sets sequentially or in parallel without cross-target communication. If an exception rule resides in Partition $A$ while the corresponding block rule resides in Partition $B$, Partition $B$'s engine will execute the block rule on the network request. The exception in Partition $A$ has zero visibility into Partition $B$, resulting in catastrophic website breakage.

**WHEN TO APPLY**:
- Multi-slot Safari Content Blockers (`SFContentBlockerManager`).
- Sharded WebExtension Declarative Net Request (DNR) dynamic rule sets.
- Partitioned Web Application Firewalls (WAFs) or edge-routing filters with isolated memory spaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
public struct ContentBlockerDistribution: Sendable {
    public var filtersByTarget: [ContentBlockerTargetInfo: [FilterList]]
    public var shardsByTarget: [ContentBlockerTargetInfo: [UUID: ContentBlockerShard]] = [:]
}

public struct ContentBlockerShard: Hashable, Sendable {
    public let index: Int
    public let count: Int

    /// Stable FNV-1a 64-bit hash distribution for block rules.
    public func keepsRule(identity: String) -> Bool {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in identity.utf8 {
            hash = (hash ^ UInt64(byte)) &* 0x100000001b3
        }
        // FNV low bits are sensitive to parity; fold high bits before modulo
        let mixed = hash ^ (hash >> 32)
        return Int(mixed % UInt64(count)) == index
    }
}

// In the compiler loop:
if line.hasPrefix("@@") || line.hasPrefix("!#") || line.contains("$badfilter") {
    // CRITICAL: Replicate exception/directive to EVERY shard partition
    emitToAllShards(line)
} else if let shard = activeShard {
    // Block rules spread evenly by identity hash
    if shard.keepsRule(identity: line) {
        emitToCurrentShard(line)
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Naive line-count or chunk slicing of filter lists
let chunkSize = rules.count / targetCount
for (index, target) in targets.enumerated() {
    // FATAL: Exceptions at the bottom of the list will NOT protect
    // block rules placed in earlier targets.
    let targetRules = rules[(index * chunkSize)..<((index + 1) * chunkSize)]
    compile(targetRules, to: target)
}
```

**VERIFICATION METHOD**:
Automated unit test: Feed a test list containing 170,000 block rules and 1 exception rule targeting rule #7 (`@@||big-7.example^`). Compile against 2 sharded slots. Assert:
1. Shard 1 rule count + Shard 2 rule count $\ge$ 170,000.
2. JSON payload of Shard 1 AND Shard 2 both contain `"type": "ignore-previous-rules"`.
3. An HTTP request simulation to `big-7.example` returns allowed across both slots.

---

### 2. Multi-Process Darwin IPC State-Coalescing Invariant
**RULE**:
When coordinating asynchronous state mutations across sandboxed application extensions and background daemons via POSIX App Groups and Darwin Notifications (`CFNotificationCenterGetDarwinNotifyCenter`), state transitions MUST use a monotonic state machine (`idle` $\to$ `pending` $\to$ `applying` $\to$ `succeeded` | `failed`) backed by a cross-thread lock and atomic UserDefaults writes. Repeated trigger notifications received while the state is `pending` or `applying` MUST be dropped (coalesced).

**WHY**:
Darwin Notifications carry zero payload and queue unpredictably. If a user rapidly taps a UI button in an extension popup, multiple Darwin notifications fire across process boundaries. Without a serialized state check, the host app spawns overlapping compilation actors that attempt to write to the same JSON rule files simultaneously, corrupting WebKit's local rule cache and throwing lock contention errors.

**WHEN TO APPLY**:
- Shared state updates between macOS Menu Bar/App Extension and Main Container.
- Safari WebExtension `browser.runtime.sendNativeMessage` / Darwin Notification bridging.
- Multi-process daemons modifying shared APFS files.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
public enum ResumeStatus: String {
    case idle, pending, applying, succeeded, failed
}

public static func requestResume(groupIdentifier: String) -> ResumeStatus {
    guard let defaults = UserDefaults(suiteName: groupIdentifier) else { return .idle }
    
    resumeRequestLock.lock()
    defer { resumeRequestLock.unlock() }
    
    let raw = defaults.string(forKey: resumeStatusKey) ?? ResumeStatus.idle.rawValue
    let currentStatus = ResumeStatus(rawValue: raw) ?? .idle
    
    // Coalesce: Do not re-trigger if already working
    if currentStatus == .pending || currentStatus == .applying {
        return currentStatus
    }

    defaults.set(true, forKey: resumeRequestKey)
    defaults.set(ResumeStatus.pending.rawValue, forKey: resumeStatusKey)
    defaults.removeObject(forKey: resumeErrorKey)
    
    // Notify host daemon via Darwin IPC
    CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName(rawValue: resumeRequestNotificationName as CFString),
        nil,
        nil,
        true
    )
    return .pending
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Naked notification dispatch without state guards
func onButtonTapped() {
    // Spams notification center; induces race conditions in host daemon
    CFNotificationCenterPostNotification(
        CFNotificationCenterGetDarwinNotifyCenter(),
        CFNotificationName("run_update" as CFString),
        nil, nil, true
    )
}
```

**VERIFICATION METHOD**:
Simulate 10 concurrent threads invoking `requestResume()`. Verify via assertion that `CFNotificationCenterPostNotification` is executed exactly once, and that `currentStatus` transitions to `.pending` without intermediate state thrashing.

---

### 3. Progressive Pipeline Lifecycle Preservation Invariant
**RULE**:
In an asynchronous multi-phase processing pipeline driving a UI progress indicator, the pipeline MUST NOT report `.finished` or allow the progress sheet to dismiss until *all* follow-up side effects (e.g., secondary file saves, cache serializations, engine registrations) are fully committed. When transitioning between stages where no work is needed in an intermediate phase, the pipeline MUST explicitly emit terminal-stage progress (e.g., `.saving`) rather than holding a completed percentage while background locks remain active.

**WHY**:
If UI sheets dismiss upon completion of phase $N$ (e.g., rule download) while phase $N+1$ (engine compilation and userscript disk commits) runs unobserved in the background, users will interact with UI rows that are being concurrently mutated by the background task. This leads to dropped user changes, Time-of-Check to Time-of-Use (TOCTOU) inconsistencies, or UI freezings where the toolbar spins indefinitely with no explanation.

**WHEN TO APPLY**:
- Multi-step background data synchronizations driving modal sheets.
- Compilers writing artifacts to disk after network fetches.
- Database migration pipelines reporting to a frontend progress bar.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
public enum RunProgress: Sendable {
    case checking(done: Int, total: Int)
    case converting(done: Int, total: Int)
    case reloading(done: Int, total: Int)
    case saving // Engine publish, userscript sync, and disk flush
    case finished
}

// In the coordination actor:
public func executePipeline() async throws {
    await reportProgress(.converting(done: 100, total: 100))
    
    let reloadResults = try await reloadTargets(targets)
    
    // CRITICAL: Explicitly transition to .saving before engine publish
    await reportProgress(.saving)
    
    await autoUpdateUserScriptsIfNeeded()
    try await commitProtobufToDisk()
    
    // Terminal state ONLY after disk sync is complete
    await reportProgress(.finished)
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Emitting completion immediately after the primary loop
for target in targets {
    await reload(target)
}
await reportProgress(.finished) // WRONG: UI unfreezes here!
// Silent background work continues while user modifies settings:
await autoUpdateUserScripts()
await writeStateToDisk()
```

**VERIFICATION METHOD**:
XCTest harness monitoring the sequence of published enum values. Assert that between `reloading(done: total, total: total)` and `finished`, the `saving` state is always emitted, and that no mutations to the `FilterList` state are accepted until the pipeline yields `finished`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Content Blocker Slot Rule Truncation & Exception Erasure (BUG-WBLOCK-01)
- **Context**: `wBlockCoreService/ContentBlockerMappingService.swift`, `wBlockCoreService/wBlockCoreService.swift`
- **What Was Expected**: When a user selected large ad-blocking filter lists (exceeding 120,000 rules), the compiler was supposed to distribute rules across 5 Safari content blockers without dropping rules or breaking website compatibility.
- **What Actually Happened**: Individual large filter lists (e.g., 170,000 rules) were allocated entirely to a single blocker target. Safari’s converter silently truncated rules exceeding its 150,000 limit. The compiler did not detect this truncation, reported successful compilation, and dropped the remaining 20,000+ rules. Crucially, when lists were partially trimmed, exception rules were lost, causing widespread site breakages.
- **Evidence in Repo**: Commit `b4e3ff82`, Test: `scripts/test_content_blocker_slot_overflow.swift`.
- **Root Cause**: The allocation algorithm (`distribute`) assigned filter lists atomically based on estimated initial source counts. A list with 170k rules was assigned whole to the target with the lowest current load, guaranteeing an overflow in that single target. Furthermore, `discardedSafariRules` from the converter was ignored by the caller.
- **Remediation Code Diff**:
```swift
// - In ContentBlockerMappingService.swift:
-    public static func distribute(selectedFilters: [FilterList], across targets: [ContentBlockerTargetInfo]) -> [ContentBlockerTargetInfo: [FilterList]] {
-        // Assigned entire lists to targets.min(by: estimatedSourceRules)
-    }

// + In ContentBlockerMappingService.swift:
+    static let shardBudget = ContentBlockerService.safariContentBlockerRuleLimit * 4 / 5
+    public static func plan(selectedFilters: [FilterList], across targets: [ContentBlockerTargetInfo]) -> ContentBlockerDistribution {
+        // Calculate shard count based on shardBudget (120k rules)
+        let parts = min(targets.count, max(1, (cost + shardBudget - 1) / shardBudget))
+        for index in 0..<parts {
+            items.append(Item(filter: filter, order: order,
+                shard: parts > 1 ? ContentBlockerShard(index: index, count: parts) : nil,
+                cost: (cost + parts - 1 - index) / parts))
+        }
+        // Distribute shards across blockers; replicate exceptions across all shards
+    }

// + In wBlockCoreService.swift:
+    if discardedRulesCount > 0 {
+        try? FileManager.default.removeItem(at: baseCountURL)
+        return (safariRulesCount: safariRulesCount, truncatedRuleCount: discardedRulesCount, advancedRulesText: result.advancedRulesText, outputChanged: false)
+    }
```
- **Lesson**: Subsystem budgets must incorporate safe operating margins (e.g., 80% of hard capacity) to absorb converter expansion, directive overhead, and exception replication. Downstream converter truncation must be surfaced as an error/truncation event rather than treated as a silent success.

---

### Incident 2: Premature Progress Dismissal & Indefinite Toolbar Freezing (BUG-WBLOCK-02)
- **Context**: `wBlock/AppFilterManager.swift`, `wBlockCoreService/SharedAutoUpdateManager.swift`
- **What Was Expected**: Running a manual update check or catch-up reload would visually reflect progress until all data was saved and WebExtension userscripts were fully updated.
- **What Actually Happened**: When an update check found no new network rules, the engine skipped the conversion step and immediately executed blocker reloads without emitting progress. The progress sheet stalled at 100%, but the main toolbar spinner spun for another 20+ seconds while the engine published rules and updated userscripts.
- **Evidence in Repo**: Commit `77023ea6`.
- **Root Cause**: `SharedAutoUpdateManager` had disparate reload loops with uncoordinated progress emissions. Bypassing the `.converting` state left the UI sheet waiting for state machine transitions that never fired, while post-reload saving operations lacked an explicit state representation.
- **Remediation Code Diff**:
```swift
// - In SharedAutoUpdateManager.swift:
-    for target in ContentBlockerReloadPolicy.orderedTargets(targets, ruleCounts: counts) {
-        let reloadResult = await ContentBlockerService.reloadWithRetry(...)
-        if !reloadResult.success { failedTargets.append(target.displayName) }
-    }
-    // No progress reporting for post-reload work

// + In SharedAutoUpdateManager.swift:
+    public enum RunProgress: Sendable {
+        case checking(done: Int, total: Int)
+        case converting(done: Int, total: Int)
+        case reloading(done: Int, total: Int)
+        case saving // Engine publish, userscript updates, and final save
+        case finished
+    }
+    let reloadResults = try await reloadTargets(targets, ruleCounts: counts, policy: policy)
+    await reportRunProgress(.saving)
```
- **Lesson**: Progress state machines must cover 100% of the wall-clock execution time. Any lifecycle phase that performs file I/O, network requests, or IPC must have an explicit enum state.

---

### Incident 3: TOCTOU Mutation of In-Flight Compilation Pipelines (BUG-WBLOCK-03)
- **Context**: `wBlock/ContentView.swift`, `wBlock/UserScriptManagerView.swift`
- **What Was Expected**: When the user pressed "Apply Changes", the compilation and extension reload pipeline ran atomically against a snapshot of the user's list selections.
- **What Actually Happened**: The modal sheet was made non-modal/dismissed early, allowing users to toggle filter lists and userscript checkboxes *while* the compilation pipeline was reading from disk and compiling rules. The new toggles were partially overwritten or queued silently, leaving the UI state out-of-sync with the compiled Safari rules.
- **Evidence in Repo**: Commit `5f9165e2`.
- **Root Cause**: UI views (`ContentView`, `UserScriptManagerView`) lacked bindings to the manager's compilation state (`isApplying`), leaving interaction enabled during asynchronous execution.
- **Remediation Code Diff**:
```swift
// - In ContentView.swift & UserScriptManagerView.swift:
-    UserScriptManagerView(
-        onRefresh: { ... },
-        applyButton: AnyView(applyChangesToolbarButton)
-    )

// + In ContentView.swift & UserScriptManagerView.swift:
+    UserScriptManagerView(
+        onRefresh: { ... },
+        applyButton: AnyView(applyChangesToolbarButton),
+        isApplying: filterManager.showingApplyProgressSheet
+    )
+    // Lock the list row container to prevent mutations during execution
+    .disabled(filterManager.showingApplyProgressSheet)
```
- **Lesson**: Every long-running async compiler pipeline must impose mutual exclusion on user input vectors by disabling editing controls at the root container level.

---

### Incident 4: Safari Extension Registration Loss via Binary Relocation (BUG-WBLOCK-04)
- **Context**: Issue #1046, macOS Extension Registry & LaunchServices
- **What Was Expected**: Upgrading wBlock via Homebrew Cask or manual drag-and-drop preserves the registration of `wBlock Scripts` in Safari's Settings $\to$ Extensions pane.
- **What Actually Happened**: Following Homebrew migration from version 3.1.0 to 3.2.2, `wBlock Scripts` completely vanished from Safari’s extension list. Toggling the app or rebooting failed to restore it.
- **Evidence in Repo**: Issue #1046 post-mortem, `.github/workflows/homebrew-cask.yml`.
- **Root Cause**: macOS `launchservicesd` tracks Safari App Extensions by absolute path and bundle designated requirement (code signature). Homebrew Cask extracted the updated application into a temporary quarantine path before moving it to `/Applications`, causing LaunchServices to register the extension bundle under a transient path that was subsequently deleted. Safari was left with a dead registration pointer.
- **Remediation Invariant**:
Extensions distributed outside the Mac App Store via Homebrew Cask or Sparkle MUST register LaunchServices explicitly in post-install scripts using `lsregister`:
```bash
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f /Applications/wBlock.app
```
Furthermore, the main application startup sequence must verify extension registration status and prompt the user to trigger `SFSafariApplication.showPreferencesForExtension(withIdentifier:)` if Safari reports the target extension missing.
- **Lesson**: On macOS, never assume LaunchServices tracks in-place application overwrites correctly across non-App Store package managers.

---

### Incident 5: Visual Layout Thrashing in Dynamic Banners (BUG-WBLOCK-05)
- **Context**: Issue #1059, `wBlock/ContentView.swift`
- **What Was Expected**: Update status notifications appear as smooth, non-disruptive banner overlays above the content list.
- **What Actually Happened**: Status banners had no explicit background material or geometry frame. The text rendered directly on top of list cells, causing visual bleed-through. When banners transitioned in and out, the underlying `ScrollView` suffered layout reflows, jumping the scroll offset up and down by the height of the banner.
- **Evidence in Repo**: Issue #1059.
- **Root Cause**: Banners were placed directly inside the vertical layout flow without fixed coordinate heights or background materials (`.background(.ultraThinMaterial)`), causing the SwiftUI layout engine to recalculate child scroll offsets on insertion/removal.
- **Remediation Invariant**:
Status banners positioned above scrollable viewports MUST:
1. Render using explicit background materials with full opacity/blur to obscure background cells.
2. Be positioned either via an `.overlay(alignment: .top)` modifier with explicit safe-area padding or maintain a stable reserved layout slot to prevent viewport displacement.
```swift
// Safe Layout Invariant:
.overlay(alignment: .top) {
    if showBanner {
        UpdateBannerView(text: statusText)
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .shadow(radius: 4)
            .transition(.move(edge: .top).combined(with: .opacity))
    }
}
```
- **Lesson**: Dynamic informational alerts positioned near scroll containers must use overlay or coordinate-isolated layers to eliminate layout reflow and scroll jumping.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision

#### 1. FNV-1a Hash Bit-Folding Invariant
When calculating distribution buckets for sharding, naive modulo arithmetic directly on raw 64-bit FNV-1a hashes exhibits bit-bias in low-entropy inputs:
```swift
// WRONG: Low bits of FNV-1a are a direct parity of input bytes.
// Modulo by small target counts (e.g., 2, 3, 5) yields severe bucket skew!
let bucket = Int(hash % UInt64(count))

// CORRECT: Fold high 32 bits into low 32 bits before modulo
let mixed = hash ^ (hash >> 32)
let bucket = Int(mixed % UInt64(count))
```

#### 2. Integer Overflow Clamping in Nanosecond Time Conversion
Direct integer multiplication of time values (`seconds * 1_000_000_000`) crashes on 32-bit platforms or triggers overflow traps in Swift:
```swift
// INVARIANT: Always guard multiplication boundaries before scaling
private static func clampedNanoseconds(_ value: Int, multiplier: UInt64) -> UInt64 {
    guard value > 0 else { return 0 }
    let unsignedValue = UInt64(value)
    // Prevent fatal integer overflow trap:
    guard unsignedValue <= UInt64.max / multiplier else { return UInt64.max }
    return unsignedValue * multiplier
}
```

#### 3. Regex Option Delimiter Parsing
Adblock rule syntax allows regex patterns to contain forward slashes and dollar signs (`/pattern$/$options`). Naive string splitting on `$` corrupts the regex:
```swift
// INVARIANT: Regex dollar-signs must be differentiated from rule option delimiters
let isRegex = body.hasPrefix("/") && (
    body.range(of: "/$", options: .backwards) != nil || 
    (body.hasSuffix("/") && body.count > 1)
)
let optionsStart = isRegex
    ? body.range(of: "/$", options: .backwards).map { body.index(before: $0.upperBound) }
    : body.lastIndex(of: "$")
let pattern = optionsStart.map { String(body[..<$0]) } ?? body
```

---

### 4.2 Infinite Loop & Recursion Guards

#### 1. Background Task Resubmission Throttling
Background tasks that encounter network or compilation errors must not be allowed to enter an immediate re-execution cycle:
```swift
// INVARIANT: Minimum forward backoff clamp prevents CPU thrashing
public static func earliestBeginDate(
    now: Date,
    intervalHours: Double,
    nextEligibleTime: Int64,
    lastCheckTime: Int64
) -> Date {
    let due: Date
    if nextEligibleTime > 0 {
        due = Date(timeIntervalSince1970: TimeInterval(nextEligibleTime))
    } else if lastCheckTime > 0 {
        let hours = intervalHours.isFinite && intervalHours > 0 ? intervalHours : 6
        due = Date(timeIntervalSince1970: TimeInterval(lastCheckTime) + hours * 3600)
    } else {
        due = now
    }
    // Absolute Invariant: Never allow an overdue task to trigger within 60 seconds of 'now'
    return max(due, now.addingTimeInterval(60))
}
```

#### 2. Userscript Injection Idempotency Guard
Userscript injection in dynamic single-page applications (SPAs) frequently executes multiple times as the DOM changes. Recursive execution or repeated monkey-patching of `Window.prototype` causes execution loops and call-stack exhaustion:
```javascript
// INVARIANT: Immutable prototype-level execution marker
(function(source, args) {
    const flag = "done";
    const uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
    
    // Check if already executed on this window context
    if (source.uniqueId && Window.prototype.toString[uniqueIdentifier] === flag) {
        return;
    }

    try {
        executeScriptlet();
        
        // Seal execution record to prevent tampering or re-entry
        if (source.uniqueId) {
            Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                value: flag,
                enumerable: false,
                writable: false,
                