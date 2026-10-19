> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/thaw-app-thaw-learnings.md`  
> **Source**: github ([https://github.com/thaw-app/Thaw](https://github.com/thaw-app/Thaw))  
> **Source Version**: `75795724`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T11:09:12.052Z  
> **Learning ID**: `learn-github-thaw-app-thaw`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): thaw-app/Thaw

---

## 1. Executive Forensic Architecture & System Mechanics

`thaw-app/Thaw` (formerly Ice) is an open-source macOS menu bar manager developed in Swift and SwiftUI. It operates in an unprivileged yet highly intrusive user-space boundary, managing third-party and system menu bar extras without requiring kernel extensions or root privileges. 

```
                                      +---------------------------------------------+
                                      |             Thaw.app (Main GUI)             |
                                      |  SwiftUI Settings / Hotkeys / State Engine  |
                                      +----------------------+----------------------+
                                                             |
                           +---------------------------------+---------------------------------+
                           |                                                                   |
                           v                                                                   v
+-----------------------------------------------------+             +-----------------------------------------------------+
|         MenuBarCaptureService (XPC Target)          |             |        Accessibility & CG Window Manager (AX/CG)    |
| - SkyLight.framework CGSWindow capture              |             | - AXUIElement systemWide tree traversal             |
| - Window server backing store bitmap ingestion      |             | - ExtrasMenuBar negative cache & probe memory       |
| - IPC frame rate & display-sleep throttling         |             | - MarkerPairResolver: Bidirectional width matching   |
+-----------------------------------------------------+             +-----------------------------------------------------+
                           |                                                                   |
                           +---------------------------------+---------------------------------+
                                                             |
                                                             v
                                              +-----------------------------+
                                              | macOS WindowServer & AppKit |
                                              | - com.apple.controlcenter   |
                                              | - Third-party status items  |
                                              | - Dynamic / Aerial Wallpapers|
                                              +-----------------------------+
```

### 1.1 Architectural Boundaries & Decoupling
1. **Host-Target XPC Split**: Menu bar screen scraping and window frame acquisition rely on Apple's private `SkyLight.framework` (`CGSWindow` APIs) alongside Accessibility (`AXSwift6`/`ApplicationServices`). To prevent memory leaks and graphics driver crashes from destabilizing the main UI, image capture runs in an isolated XPC service (`MenuBarCaptureService`), mediated by strict Mach ports and peer validation via code signing identities (`CodeSigningInfo`).
2. **Dual-Layer Window Resolution Pipeline**:
   - *CoreGraphics Layer (`CGWindowListCopyWindowInfo`)*: Fast, non-blocking enumeration of window geometry, window level (`kCGMainMenuWindowLevel`, `kCGStatusWindowLevel`), owning PIDs, and on-screen visibility. It identifies physical bounding boxes but cannot inspect internal view hierarchies or identify processes obscured behind hosting daemons.
   - *Accessibility Layer (`AXUIElementCopyAttributeValue`)*: Deep inspection into process UI trees (`kAXExtrasMenuBarAttribute`, `kAXChildrenAttribute`, `kAXIdentifierAttribute`). It provides semantic identification and event dispatch (`press`), but is fundamentally synchronous and blocks the caller on the target application's main run loop.
3. **State Ownership & Layout Synchronization**: Menu bar items are partitioned into three conceptual sections: `Visible`, `Hidden`, and `Always-Hidden`. Layout state is maintained via a unified profile configuration persisted on disk. Reordering is performed either via synthetic input sequences (LCS diff-based simulated drag operations) or non-destructive hiding toggles where dividers mask out status items.

### 1.2 Subsystem Invariants & Core Mechanics
- **AX IPC Stall Containment**: Calling AX APIs against an unresponsive third-party app defaults to a 6-second system-wide thread block. Thaw explicitly overrides this globally to `1.0` second (`SharedConstants.axMessagingTimeout = 1.0`) during startup via `AXUIElementSetMessagingTimeout`.
- **Negative Caching with Backoff Ladders**: Polling 170+ background processes over AX during menu bar scans introduces severe stutter. Thaw employs a stateful Fibonacci-like backoff ladder (`ExtrasMenuBarNegativeCachePolicy`) and persistent disk memory across reboots (`ExtrasMenuBarProbeMemory`) to prevent recurring IPC stalls.
- **Ambiguity-Proof Identifier Disambiguation**: Modern macOS versions host status items within `com.apple.controlcenter`. Thaw uses a bidirectional width-matching heuristic (`MarkerPairResolver`) to correlate generic `Item-N` status windows with orphaned helper marker windows without misattributing identical items.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Bidirectional Uniqueness Guard for Heuristic IPC Reconciliation
**RULE**:
When correlating ambiguous objects between two asynchronous system APIs (e.g., matching visual `CGWindowID` handles with semantic `AXUIElement` trees) using scalar properties such as geometry dimensions, reconciliation MUST require uniqueness in BOTH directions: `Count(Target == Key) == 1` AND `Count(Candidate == Key) == 1`. If either set contains collisions, resolution for that key MUST be aborted.

**WHY**:
Unidirectional validation causes catastrophic misattribution. If Window A and Window B both share a width of `32pt`, and Marker X has a width of `32pt`, checking only `markers.filter { $0.width == icon.width }.count == 1` will cause Marker X to match both Window A and Window B. In macOS status item resolution, this causes Control Center widgets (e.g., Wi-Fi, Audio) to be hijacked and assigned third-party bundle IDs, corrupting system preferences and layout ordering.

**WHEN TO APPLY**:
Apply in any cross-layer abstraction bridge where an underlying operating system or multi-process service fails to provide a 1:1 foreign key between an OS display surface and an application entity (e.g., window servers, accessibility bridges, web automation DOM-to-compositor matching).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Swift 6: Bidirectional 1-to-1 matching invariant pattern
struct VisualEntity: Equatable {
    let id: UInt32
    let width: CGFloat
}

struct MetadataEntity: Equatable {
    let id: UInt32
    let width: CGFloat
    let bundleIdentifier: String
}

struct MatchResult: Equatable {
    let visualID: UInt32
    let metadataID: UInt32
    let resolvedIdentifier: String
}

func reconcileEntities(
    visuals: [VisualEntity],
    metadata: [MetadataEntity]
) -> [MatchResult] {
    // Phase 1: Compute cardinality of visual dimensions
    var visualCounts = [CGFloat: Int]()
    for item in visuals {
        visualCounts[item.width, default: 0] += 1
    }

    // Phase 2: Compute cardinality of metadata dimensions
    var metadataCounts = [CGFloat: Int]()
    for meta in metadata {
        metadataCounts[meta.width, default: 0] += 1
    }

    var resolved = [MatchResult]()

    // Phase 3: Enforce strict bidirectional 1:1 invariant
    for visual in visuals {
        // Must be globally unique in candidate visual space
        guard visualCounts[visual.width] == 1 else { continue }
        // Must be globally unique in metadata space
        guard metadataCounts[visual.width] == 1 else { continue }

        guard let matchedMeta = metadata.first(where: { $0.width == visual.width }) else {
            continue
        }

        resolved.append(MatchResult(
            visualID: visual.id,
            metadataID: matchedMeta.id,
            resolvedIdentifier: matchedMeta.bundleIdentifier
        ))
    }

    return resolved
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Unidirectional matching.
// Allows multiple visuals with identical widths to claim the same metadata marker.
func reconcileEntitiesUnsafe(visuals: [VisualEntity], metadata: [MetadataEntity]) -> [MatchResult] {
    return visuals.compactMap { visual in
        // BUG: If 3 visual items have width 24.0, all 3 match this single meta!
        let matches = metadata.filter { $0.width == visual.width }
        guard matches.count == 1, let match = matches.first else { return nil }
        return MatchResult(visualID: visual.id, metadataID: match.id, resolvedIdentifier: match.bundleIdentifier)
    }
}
```

**VERIFICATION METHOD**:
Enforce via unit tests generating duplicate candidates on both sides:
1. Input: 2 visual icons with width `24.0`, 1 metadata marker with width `24.0`. Assert output is `[]` (0 matches).
2. Input: 1 visual icon with width `24.0`, 2 metadata markers with width `24.0`. Assert output is `[]` (0 matches).
3. Input: 1 visual icon with width `24.0`, 1 metadata marker with width `24.0`. Assert output contains exactly 1 resolved pair.

---

### 2. Saturated Clamp & Strict Type Sanitization on IPC Boundary Payloads
**RULE**:
All scalar configuration parameters received over inter-process communication (XPC, Mach channels, WebSockets, or CLI inputs) that influence memory allocation, time intervals, or file operations MUST be clamped using closed mathematical bounds and checked for IEEE 754 non-finite states (`.isFinite`, `.isNaN`) BEFORE hitting locks, arithmetic operations, or dispatch timers.

**WHY**:
Passing unchecked floating-point or integer primitives across IPC allows hostile or corrupted peers to inject `NaN`, `+Infinity`, `-1`, or `Int.min`. In Swift/C-based dispatch environments, passing non-finite values into `DispatchTime` or `ContinuousClock` triggers immediate fatal arithmetic overflows or traps the dispatch loop, while negative retention windows or zero counters trigger unbounded file deletion during maintenance cycles.

**WHEN TO APPLY**:
Any serialization/deserialization boundary (XPC, JSON-RPC, Protobuf, Command-Line flags, Environment variables) handling policy models that control retention, thread sleeps, scheduling intervals, or file rotations.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Swift 6: Clamped invariant for IPC-deserialized system policies
struct ServicePolicy: Codable, Equatable, Sendable {
    var retentionDays: Int = 2
    var maxFileCount: Int = 50
    var maxFileSizeBytes: UInt64 = 10_485_760 // 10 MiB
    var rotationInterval: TimeInterval = 86400

    static let minRetentionDays = 1
    static let maxRetentionDays = 3650
    static let minRetainedFileCount = 1
    static let maxRetainedFileCount = 10000
    static let maxRotationInterval: TimeInterval = 365 * 86400
    static let maxSizeBytes: UInt64 = 1 << 40 // 1 TiB

    func sanitized() -> ServicePolicy {
        var copy = self
        // Clamp retention days: prevent Int.min overflow and 0/-1 wiping everything
        copy.retentionDays = min(max(Self.minRetentionDays, retentionDays), Self.maxRetentionDays)
        
        // Clamp file count: prevent zero which drops all files instantly
        copy.maxFileCount = min(max(Self.minRetainedFileCount, maxFileCount), Self.maxRetainedFileCount)
        
        // Clamp size: prevent UInt64 overflow in allocation checks
        copy.maxFileSizeBytes = min(maxFileSizeBytes, Self.maxSizeBytes)
        
        // Guard against IEEE 754 NaN and +/- Infinity crashing DispatchSourceTimer
        if copy.rotationInterval.isFinite && !copy.rotationInterval.isNaN {
            copy.rotationInterval = min(max(0, copy.rotationInterval), Self.maxRotationInterval)
        } else {
            copy.rotationInterval = 0 // Disabled default
        }
        
        return copy
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Trusting IPC values directly in system timers and file pruners.
func applyPolicyUnsafe(_ policy: ServicePolicy) {
    // If rotationInterval is NaN or +Inf, dispatch_time_t conversion crashes the app
    let deadline = DispatchTime.now() + policy.rotationInterval 
    timer.schedule(deadline: deadline)
    
    // If retentionDays is negative (e.g. -1), date calculation sets cutoff in the future!
    let cutoffDate = Calendar.current.date(byAdding: .day, value: -policy.retentionDays, to: Date())!
    // Result: ALL active logs have creationDate < cutoffDate and get DELETED!
    deleteAllFilesOlderThan(cutoffDate)
}
```

**VERIFICATION METHOD**:
Deploy fuzz testing harnesses (libFuzzer / `SwiftCheck`) feeding randomized byte patterns directly into the deserialization pipeline and assert:
```swift
func testFuzzPolicyLimits() {
    let badPolicies = [
        ServicePolicy(retentionDays: Int.min, maxFileCount: 0, rotationInterval: .nan),
        ServicePolicy(retentionDays: -50, maxFileCount: -1, rotationInterval: .infinity),
        ServicePolicy(retentionDays: Int.max, maxFileCount: Int.max, rotationInterval: -.infinity)
    ]
    for bad in badPolicies {
        let safe = bad.sanitized()
        XCTAssertGreaterThanOrEqual(safe.retentionDays, 1)
        XCTAssertGreaterThanOrEqual(safe.maxFileCount, 1)
        XCTAssertTrue(safe.rotationInterval.isFinite)
        XCTAssertGreaterThanOrEqual(safe.rotationInterval, 0.0)
    }
}
```

---

### 3. Content-Addressable Release Asset Immutability Guard
**RULE**:
CI/CD release publishing scripts MUST verify existing assets against remote cryptographic digests (SHA-256) before uploading. If an asset already exists with the identical digest, it MUST be skipped idempotently. If an asset exists with a differing digest, the release step MUST fail immediately. Assets MUST NEVER be overwritten in-place.

**WHY**:
In automated build pipelines, partial failures during signing, packaging, or network transmission often lead to workflow reruns. If a release pipeline overwrites binary artifacts (e.g., DMGs, appcasts, signatures) in-place without strict hash matching, users or package managers (such as Homebrew) that downloaded the initial build will fail verification due to checksum mismatch errors, or worse, execute mixed-state binaries if delta updates were computed against the prior artifact.

**WHEN TO APPLY**:
Any deployment pipeline packaging desktop applications, embedded firmware, or release archives distributed through Sparkle, GitHub Releases, S3, or Homebrew Casks.

**VERIFIED IMPLEMENTATION PATTERN**:
```bash
#!/usr/bin/env bash
# Production Release Immutability Guard
set -euo pipefail

repo="$1"
tag="$2"
shift 2

# Fetch existing assets and their remote sha256 digests
existing="$(gh release view "$tag" --repo "$repo" --json assets \
  --jq '.assets[] | "\(.name)\t\(.digest // "")"')"

for file in "$@"; do
  name="$(basename "$file")"
  digest="sha256:$(shasum -a 256 "$file" | cut -d' ' -f1)"
  
  match="$(awk -F'\t' -v target="$name" '$1 == target { print "present:" $2; exit }' <<< "$existing")"
  published="${match#present:}"
  
  if [[ -z "$match" ]]; then
    gh release upload "$tag" "$file" --repo "$repo"
    echo "Successfully uploaded ${name}"
  elif [[ "$published" == "$digest" ]]; then
    echo "Kept ${name}: identical cryptographic digest already published (${digest})"
  else
    echo "FATAL: ${repo}@${tag} already contains ${name} with mismatched digest!" >&2
    echo "Remote digest:    ${published:-[NO_REMOTE_DIGEST]}" >&2
    echo "Calculated local: ${digest}" >&2
    exit 1
  fi
done
```

**NEGATIVE CONSTRAINT**:
```bash
# ANTI-PATTERN: Blindly clobbering releases with --clobber
# Destroys auditability and breaks downstream package manager checksums.
for file in "$@"; do
  gh release upload "$tag" "$file" --repo "$repo" --clobber
done
```

**VERIFICATION METHOD**:
Execute an integration test within GitHub Actions runner:
1. Upload `artifact.zip` (version A).
2. Re-run script with identical `artifact.zip` (version A) -> Exit code 0, log confirms "kept identical".
3. Modify one byte of `artifact.zip` (version B) and rerun -> Exit code 1, script aborts before publishing.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Sparkle Appcast Stripping Pre-Existing Release Notes During Delta Generation (BUG-THAW-01)
- **Context**: Release engineering pipeline; `.github/actions/prepare-appcasts/prepare_appcasts.py` and `.github/workflows/release.yml`.
- **What Was Expected**: Running Sparkle's official `generate_appcast` utility to produce delta updates against older archives should retain the `<description>` release notes of all historical releases present in `appcast.xml`.
- **What Actually Happened**: Sparkle's `generate_appcast` stripped the `<description>` elements of all previous release versions (from 2.0.0 through 2.1.0-beta.6) when re-parsing prior `.zip` archives, leaving the live feed with completely blank update prompts for earlier clients.
- **Evidence in Repo**: Commit `5f2a3eeb`, PR #1218, files `prepare_appcasts.py` and `release.yml`.
- **Root Cause**: `generate_appcast` inspects local zip archives to compute binary diffs. Because raw binary zip files do not store rich HTML release notes internally, `generate_appcast` overwrote the existing XML channel items with bare nodes lacking `<description>`.
- **Remediation Code Diff**:
```python
# - Buggy approach: Allowing generate_appcast output to directly replace appcast.xml
# + Fixed pattern: Snapshot previous XML, extract descriptions by build, and restore before publication

def previous_descriptions(xml: bytes | None):
    if not xml:
        return {}
    with minidom.parseString(xml) as document:
        return {
            build: item.getElementsByTagName("description")[0].cloneNode(True)
            for item in document.getElementsByTagName("item")
            if (build := build_number(item)) and has_description(item)
        }

def prepare_appcasts(xml: bytes, release_tag: str, previous_xml: bytes | None = None) -> tuple[bytes, bytes | None]:
    descriptions = previous_descriptions(previous_xml)
    with minidom.parseString(xml) as document:
        for item in document.getElementsByTagName("item"):
            build = build_number(item)
            # Restore missing description dropped by generate_appcast
            if build in descriptions and not has_description(item):
                for empty in item.getElementsByTagName("description"):
                    item.removeChild(empty)
                restored = document.importNode(descriptions[build], True)
                enclosures = update_enclosures(item)
                item.insertBefore(restored, enclosures[0] if enclosures else None)
```
- **Lesson**: CLI utilities that regenerate downstream XML artifacts cannot be trusted to perform additive merges; snapshot prior states and enforce state reconciliation over immutable historical metadata.

---

### Incident 2: Hidden Menu Bar Items Moving to Visible on Process Launch (BUG-THAW-02)
- **Context**: Menu bar layout management; `CHANGELOG.md` (Issue #1357), PR by `@diazdesandi`.
- **What Was Expected**: In "Manual arrangement" mode, status items placed in the `Hidden` section must remain hidden across application launches, reboots, and display topology changes.
- **What Actually Happened**: Whenever any menu-bar-enabled application launched or restarted, or whenever a secondary display was connected, all hidden items abruptly snapped into the `Visible` section.
- **Evidence in Repo**: Commit `ba22f437`, CHANGELOG entry for `3.0.0-alpha.10`, Issue #1357.
- **Root Cause**: During system display reconfiguration or new process spawn events, Thaw executed a full scan and evaluated each item's physical display coordinates. Because macOS parks status items at transient screen locations prior to finalizing rendering, Thaw read the raw coordinate positions from macOS and mistakenly inferred that the items were in the `Visible` section, permanently overwriting the stored user profile layout.
- **Remediation Code Diff**:
```swift
// - Buggy logic: On every running process change or display notification, re-read section from OS position:
// func handleProcessLaunch() {
//     updateItemSectionsFromCurrentCoordinates()
// }

// + Fixed pattern: Section classification from OS coordinates occurs ONLY once at initial startup.
// Subsequent process launches preserve profile section assignments:
func handleProcessLaunch(isInitialStartup: Bool) {
    if isInitialStartup {
        updateItemSectionsFromCurrentCoordinates()
    } else {
        // Retain user's configured section mappings; only register new unknown items
        reconcileNewItemsWithoutOverwritingExistingSections()
    }
}
```
- **Lesson**: Never infer permanent user configuration preferences from transient, operating-system-reported spatial coordinates during system bootstrap or layout reconfiguration windows.

---

### Incident 3: Concealed Section Sort Inaction in Menu Bar Layout (BUG-THAW-03)
- **Context**: Menu bar reordering engine; Issue #1116 (`applyProfileLayout`, `relaxConcealedSectionOrder`).
- **What Was Expected**: Clicking "Sort A to Z" on the `Hidden` or `Always-Hidden` sections in Settings should reorder the off-screen items alphabetically on the physical menu bar.
- **What Actually Happened**: The alphabetical sort was written to the profile on disk, but the actual status items on the menu bar never moved. Only the `Visible` section sorted properly.
- **Evidence in Repo**: Issue #1116, closed 2026-09-14.
- **Root Cause**: To avoid hijacking the user's cursor to reorder parked items off-screen during routine background operations, `applyProfileLayout` enforced an internal optimization called `relaxConcealedSectionOrder` (controlled by `enforceConcealedSectionOrder = false`). This function silently replaced the requested profile sort order with the menu bar's *current* physical order, causing the Longest Common Subsequence (LCS) planner to calculate 0 move operations.
- **Remediation Code Diff**:
```swift
// - Buggy logic: enforceConcealedSectionOrder was hardcoded to false
// func sortSectionAlphabetically(_ section: Section) {
//     saveSortedOrderToProfile(section)
//     applyProfileLayout() // Uses default enforceConcealedSectionOrder = false!
// }

// + Fixed pattern: User-initiated sort must explicitly bypass order relaxation
func sortSectionAlphabetically(_ section: Section) {
    saveSortedOrderToProfile(section)
    // Explicit user action overrides background cursor-preservation heuristics
    applyProfileLayout(enforceConcealedSectionOrder: true)
}
```
- **Lesson**: Background defensive heuristics (such as cursor-hijack suppression) must never override explicit foreground user commands without an opt-in bypass mechanism.

---

### Incident 4: Cursor Movement Destruction and Screen Thrashing via Automated Drag Actions (BUG-THAW-04)
- **Context**: Menu bar layout arrangement; Issue #899 (`Shared/Utilities/AXHelpers.swift`, mouse synthesizers).
- **What Was Expected**: Reordering status items on macOS 26+ should adjust item spacing smoothly without locking up the user's mouse cursor.
- **What Actually Happened**: The mouse cursor became unresponsive, rapidly jumped across the screen, expanded and shrunk erratically, and appeared as three distinct phantom cursors, rendering the operating system completely unusable until process kill.
- **Evidence in Repo**: Issue #899, closed 2026-08-15.
- **Root Cause**: On macOS, status item reordering historically required synthesizing `CGEvent` mouse-down, mouse-drag, and mouse-up events with the Command (⌘) modifier key held down. An unconstrained layout repair loop executed multiple drag attempts per second when status item coordinates reported fractional point discrepancies, starving the OS event tap and destabilizing macOS cursor graphics rendering.
- **Remediation Code Diff**:
```swift
// - Buggy logic: Immediate reactive re-ordering on coordinate jitter
// func onLayoutChanged() {
//     synthesizeCommandDragReorder(items)
// }

// + Fixed pattern: Suppress background tidying while user is interacting or hiding state is settling
func scheduleLayoutRepair() {
    guard !isUserDragging && !isHidingStateChanging else {
        cancelPendingRepairs()
        return
    }
    // Debounce and wait for menu bar coordinates to settle completely
    repairDebouncer.schedule(after: .seconds(2.0)) {
        guard !hasTransientCoordinates() else { return }
        executeCommandDragReorder()
    }
}
```
- **Lesson**: Never run automated, synthetic GUI input loops in response to continuous coordinate events without debouncing and strict cancellation guards linked to physical user input.

---

### Incident 5: Cold-Start Accessibility Scan Causing 4-Second Application Freeze (BUG-THAW-05)
- **Context**: Startup scanning; `Shared/Utilities/ExtrasMenuBarProbeMemory.swift` and `Shared/Utilities/ExtrasMenuBarNegativeCachePolicy.swift`.
- **What Was Expected**: Thaw should launch instantly and restore menu bar layout within 100 milliseconds.
- **What Actually Happened**: Application startup took nearly 4 seconds (3.85 seconds recorded in issue #956), freezing the UI while traversing running applications.
- **Evidence in Repo**: `ExtrasMenuBarProbeMemory.swift`, Issue #956.
- **Root Cause**: On macOS, out of ~170 running applications, only ~16 host menu bar extras (`AXExtrasMenuBar`). Querying `AXUIElementCopyAttributeValue` synchronously queries the target process's main thread. Querying ~150 non-menu-bar processes sequentially during startup blocked Thaw's execution while waiting on background helper runloops.
- **Remediation Code Diff**:
```swift
// - Buggy logic: Probe every running application on startup
// for app in NSRunningApplication.runningApplications() {
//     _ = AXHelpers.extrasMenuBar(for: Application(app))
// }

// + Fixed pattern: Persist multi-session memory of apps that lack status items
// Seed cache with 1st rung TTL (5s) to skip cold-start scan without losing late-launching apps:
let seededState = ExtrasMenuBarProbeMemory.seed(forRememberedMisses: storedMisses)
if let seededState {
    negativeCache.register(bundleID: app.bundleIdentifier, ttl: seededState.initialTTL)
} else {
    // Only query AX for apps known to have status items or newly installed apps
    queryExtrasMenuBar(app)
}
```
- **Lesson**: Cross-process synchronous accessibility calls must be backed by multi-session persistent negative caches to eliminate cold-start IO/IPC latency bottlenecks.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 4.1 Micro-Syntax & Token-Level Precision
1. **IEEE 754 Non-Finite Clamping**: In Swift, checking `TimeInterval > 0` evaluates to `true` when the value is `Double.infinity`, and evaluates to `false` when it is `Double.nan`. As observed in `DiagnosticLogger.RotationPolicy.sanitized()`:
   ```swift
   policy.rotationInterval = rotationInterval.isFinite
       ? min(max(0, rotationInterval), Self.maxRotationInterval)
       : 0
   ```
   *Rule*: Always use `.isFinite` prior to numeric clamping of floating-point values passed to system dispatch timers.
2. **Reverse-DNS Token Splitting Invariant**: When comparing bundle identifiers against window titles in `HostedItemOwnership.swift`, bare strings without namespace separators must not qualify as bundle prefixes:
   ```swift
   guard needle.split(separator: ".", omittingEmptySubsequences: false).count >= 2 else {
       return nil
   }
   ```
   *Rule*: Never treat a single token (e.g. `"Slack"`) as a bundle identifier; require at least two subcomponents separated by `.` to prevent collision with arbitrary top-level window names.

### 4.2 Infinite Loop & Recursion Guards
1. **Termination Invariant in Persistent Cache Merging**: In `ExtrasMenuBarProbeMemory.merged()`, dictionary compaction must avoid unbounded collection growth under heavy PID recycling:
   ```swift
   guard merged.count > capacity else { return merged }
   // Evict everything not running right now; strict upper bound guarantee
   return merged.filter { runningBundleIDs.contains($0.key) }
   ```
2. **Cancellation of Layout Repair Loops**: When rearranging displays or dragging menu bar items, the event loop must discard pending repair closures. As proven in the 3.0.0-alpha.10 patch, any incoming physical event (`⌘-drag`, menu activation) explicitly cancels scheduled background timer sources before they can fire.

### 4.3 UI & UX Micro-Mechanics
1. **Coordinate Jitter Debouncing**: During display reconfiguration, macOS exposes transient coordinates (e.g., origin at `x: -4323, y: 0` or negative heights). In `WindowInfo.isDegenerate`:
   ```swift
   var isDegenerate: Bool {
       bounds.isEmpty // Rejects zero-width, zero-height, or invalid coordinate rectangles
   }
   ```
   *Rule*: Never trigger layout reflow or calculate status item offsets if `window.bounds.isEmpty` is true.
2. **Electron/Chromium Event Retargeting Trap**: Electron and Chromium apps do not implement standard macOS AppKit menu bar event chains. As exposed in `AXHelpers.press()`:
   ```swift
   @discardableResult
   static func press(_ element: UIElement) -> Bool {
       do {
           try element.performAction(.press)
           return true
       } catch {
           return false
       }
   }
   ```
   *Rule*: Synthetic `CGEvent` mouse clicks are silently dropped by Chromium tray items. The system must fall back to `AXUIElement` action `.press` to trigger tray dropdowns.

### 4.4 Backend Concurrency & Memory Safety
1. **`OSAllocatedUnfairLock` Granular Mutex Boundaries**: In `DiagnosticLogger.swift`, mutable properties are protected against concurrent mutation across threads without holding the lock during blocking I/O:
   ```swift
   private let isEnabledLock = OSAllocatedUnfairLock(initialState: false)
   var isEnabled: Bool {
       get { isEnabledLock.withLock { $0 } }
       set {
           // Swap state on writeQueue to prevent dropping messages
           writeQueue.sync {
               let wasEnabled = isEnabled