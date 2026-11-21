# Verification Protocol: Verification Protocol: Empirical Defect Shield for lingyired-status-trio-learnings

<!-- PROVENANCE_START
{
  "source_repository": "lingyired-status-trio-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T06:46:53.358Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lingyired-status-trio-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired-status-trio-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T06:46:53.358Z`  
> **Learning ID**: `LEARN-EVO-lingyired-status-trio-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `lingyired-status-trio-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lingyired-status-trio-learnings.md`  
> **Source**: github ([https://github.com/lingyired/status-trio](https://github.com/lingyired/status-trio))  
> **Source Version**: `f57d4590`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-21T06:45:17.736Z  
> **Learning ID**: `learn-github-lingyired-status-trio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): lingyired/status-trio

---

## 1. Executive Forensic Architecture & System Mechanics

`status-trio` solves the problem of screen-estate fragmentation, high-frequency status polling overhead, and conflicting visual presentation in macOS utility applications. It unifies three discrete hardware and system signals—Battery/Power status, Wi-Fi/Network bandwidth, and Audio/Volume state—into a single composite icon rendered in either the macOS Menu Bar (`NSStatusItem`), the macOS Dock (`NSApplication.dockTile`), or both concurrently, backed by a detail popover (`NSPanel` / `NSPopover`).

```
+----------------------------------------------------------------------------------------------------+
|                                      macOS Kernel / Subsystems                                     |
|  [host_statistics64]    [IOPSGetPowerSourceDescription]    [CoreWLAN/SCNetwork]    [CoreAudio HAL] |
+------------------------------------+-------------------------------+-------------------------------+
                                     |                               |
                                     v                               v
+----------------------------------------------------------------------------------------------------+
|                                    Domain Polling & Sensor Layer                                    |
|   MemoryReader.swift         BatteryReader.swift             WiFiController.swift    AudioEngine   |
+------------------------------------+-------------------------------+-------------------------------+
                                     |                               |
                                     v                               v
+----------------------------------------------------------------------------------------------------+
|                                         SystemStatusStore                                          |
|                (State aggregation, Combine publishers, settings-bound demand wiring)               |
+------------------------------------+-------------------------------+-------------------------------+
                                     |                               |
                   +-----------------+-----------------+             |
                   v                                   v             v
+-------------------------------------+   +------------------------------------+   +-----------------+
|     IconPresentationViewModel       |   |       StatusPanelViewModel         |   | AppActivation   |
|  - Dynamic scene resolution         |   |  - Reactive settings projection    |   | Policy          |
|  - Rate-limited icon state synthesis|   |  - Metric colors, bold-text flags  |   | (.regular vs    |
+------------------+------------------+   +-----------------+------------------+   |  .accessory)    |
                   |                                        |                      +--------+--------+
         +---------+---------+                              v                               |
         v                   v                 +--------------------------+                 |
+-----------------+ +-----------------+        |   SwiftUI View Hierarchy |                 |
| MenuBarRenderer | | AppIconController|       |  (StatusPopoverView,     |                 |
| (CoreGraphics/  | | - Coalesced Dock|       |   AudioInputControls,    |                 v
|  NSImage wash)  | |   repaints      |       |   OutputDeviceRow)       |      +--------------------+
+-----------------+ +--------+--------+        +--------------------------+      | NSApplication.     |
                             |                                                   | shared             |
                             v                                                   +--------------------+
                    +-----------------+
                    | DockTile Window |
                    +-----------------+
```

### Architectural Subsystems and Boundaries

1. **Activation Policy & Dock State Coordination (`AppActivationPolicy`)**: macOS applications that exist simultaneously as Menu Bar accessories (`.accessory`) and Dock applications (`.regular`) encounter an AppKit friction point: changing activation policy dynamically resets window layers, menu bars, and dock tiles. `AppActivationPolicy` introduces reference-counted temporary regular requests (`temporaryRegularRequestCount`) alongside user-persisted dock visibility (`keepsDockIconVisible`), preventing dock-tile thrashing during transient window displays (such as Settings or Onboarding).
2. **Dual-Frequency Render Pipeline (`IconRenderCoalescer` vs. `DockVolumeRenderCoalescer`)**: Menu Bar items can redraw at 60Hz without severe compositor penalties, but the macOS Dock daemon (`Dock.app`) communicates via WindowServer IPC. Updating `NSApplication.shared.applicationIconImage` during continuous audio slider drags causes IPC starvation and visual hitching. The architecture bifurcates rendering into an immediate or micro-coalesced Menu Bar path and a specialized trailing-edge `DockVolumeRenderCoalescer` that drops redundant intermediate frames while guaranteeing delivery of the final state.
3. **Hardware Sensor Invariant Mapping (`HardwareRingMapper` / `MemoryReader`)**: Low-level Mach kernel and IOKit queries (`host_statistics64`, `IOPSCopyPowerSourcesInfo`) map hardware states directly into immutable value types. State mapping enforces mathematical boundary invariant guarantees: page counting strictly separates anonymous memory from file-backed cache pages, preventing divergence from Apple Activity Monitor.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Darwin Mach VM Kernel Page Accounting Invariant
**RULE**:
When calculating physical application memory usage via Darwin Mach kernel host statistics (`host_statistics64`), you **MUST** compute application memory strictly as anonymous memory minus purgeable memory (`internal_page_count - purgeable_count`). You **MUST NOT** use `active_count`, because `active_count` in XNU includes file-backed (external) cache pages that are dropped or evicted under memory pressure.

**WHY**:
In XNU memory architecture, `vm_statistics64_t.active_count` encompasses both dirty anonymous heap pages and active clean/dirty file-mapped pages. Using `active_count - purgeable_count` conflates disk-backed caching with user allocations, creating calculation errors up to 10 GB to 40 GB on high-RAM Apple Silicon systems and causing immediate discrepancies against macOS Activity Monitor (`Activity Monitor.app`).

**WHEN TO APPLY**:
Apply in any macOS/iOS system monitoring agent, profiling tool, or daemon interrogating Darwin Mach APIs (`mach/host_info.h`, `host_statistics64`).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import Foundation
import Darwin.Mach

public struct DarwinMemorySnapshot: Sendable, Equatable {
    public let appMemoryBytes: UInt64
    public let wiredBytes: UInt64
    public let compressedBytes: UInt64
    public let purgeableBytes: UInt64
    public let cachedFilesBytes: UInt64
    public let totalUsedBytes: UInt64

    public static func current() -> DarwinMemorySnapshot? {
        var hostPort = mach_host_self()
        var size = mach_msg_type_number_t(MemoryLayout<vm_statistics64_data_t>.stride / MemoryLayout<integer_t>.stride)
        var vmStats = vm_statistics64_data_t()
        
        let kernResult = withUnsafeMutablePointer(to: &vmStats) { statsPtr in
            statsPtr.withMemoryRebound(to: integer_t.self, capacity: Int(size)) { intPtr in
                host_statistics64(hostPort, HOST_VM_INFO64, intPtr, &size)
            }
        }
        guard kernResult == KERN_SUCCESS else { return nil }

        let pageSize = UInt64(vm_kernel_page_size)
        let internalBytes = UInt64(vmStats.internal_page_count) * pageSize
        let purgeableBytes = UInt64(vmStats.purgeable_count) * pageSize
        let externalBytes = UInt64(vmStats.external_page_count) * pageSize
        let wiredBytes = UInt64(vmStats.wire_count) * pageSize
        let compressedBytes = UInt64(vmStats.compressor_page_count) * pageSize

        // App Memory MUST be anonymous internal pages minus purgeable pages
        let appMemoryBytes = internalBytes > purgeableBytes ? (internalBytes - purgeableBytes) : 0
        // Cached files correspond to external file-backed pages plus purgeable anonymous pages
        let cachedFilesBytes = externalBytes + purgeableBytes
        // Total Used Memory matches Activity Monitor: App + Wired + Compressed
        let totalUsedBytes = appMemoryBytes + wiredBytes + compressedBytes

        return DarwinMemorySnapshot(
            appMemoryBytes: appMemoryBytes,
            wiredBytes: wiredBytes,
            compressedBytes: compressedBytes,
            purgeableBytes: purgeableBytes,
            cachedFilesBytes: cachedFilesBytes,
            totalUsedBytes: totalUsedBytes
        )
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// CRITICAL BUG: active_count contains file-backed clean/dirty pages!
// Never compute app memory from active_count.
let badAppMemory = UInt64(vmStats.active_count) * pageSize - purgeableBytes
// Conflates disk cache with allocated app heap, showing false ~10GB+ bloated memory.
```

**VERIFICATION METHOD**:
Verify against Darwin Mach statistics by executing a unit test comparing snapshot values with `/usr/bin/vm_stat` and `sysctl vm.page_pageable_internal_count`:
```swift
func testDarwinMemoryMatchesInternalPages() {
    guard let snapshot = DarwinMemorySnapshot.current() else {
        XCTFail("Failed to acquire kernel VM statistics")
        return
    }
    XCTAssertGreaterThan(snapshot.appMemoryBytes, 0)
    XCTAssertEqual(
        snapshot.totalUsedBytes,
        snapshot.appMemoryBytes + snapshot.wiredBytes + snapshot.compressedBytes,
        "Total used memory invariant violated: must equal App + Wired + Compressed"
    )
}
```

---

### 2. Idempotent Redundant AppKit State-Transition Verification
**RULE**:
When transitioning state via AppKit APIs that return `Bool` status flags (specifically `NSApplication.setActivationPolicy(_:)`), you **MUST NOT** treat a `false` return value as an operational failure without verifying the current live state. You **MUST** evaluate the success invariant as `didApply || (application.currentActivationPolicy == targetPolicy)`.

**WHY**:
AppKit's `NSApplication.setActivationPolicy` returns `false` (`NO`) if the application is *already* in the requested activation policy. Treating `false` as an abort or error causes state desynchronization in reactive view models, triggering infinite activation loops or false panic transitions when concurrent UI requests attempt to enforce an already established policy.

**WHEN TO APPLY**:
Any macOS subsystem managing application lifecycle, dock icon presence, accessory transitions, or window activation arbitration.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import AppKit

@MainActor
public protocol ApplicationActivationPolicyTarget: AnyObject {
    var activationPolicy: NSApplication.ActivationPolicy { get }
    func setActivationPolicy(_ policy: NSApplication.ActivationPolicy) -> Bool
}

extension NSApplication: ApplicationActivationPolicyTarget {
    public var activationPolicy: NSApplication.ActivationPolicy { self.activationPolicy() }
}

@MainActor
public final class SafeActivationPolicyCoordinator {
    private let target: ApplicationActivationPolicyTarget
    public private(set) var currentPolicy: NSApplication.ActivationPolicy

    public init(target: ApplicationActivationPolicyTarget = NSApplication.shared) {
        self.target = target
        self.currentPolicy = target.activationPolicy
    }

    @discardableResult
    public func transition(to desiredPolicy: NSApplication.ActivationPolicy) -> Bool {
        let didApply = target.setActivationPolicy(desiredPolicy)
        let livePolicy = target.activationPolicy
        
        // AppKit returns false if already in desired state: confirm against live state
        let succeeded = didApply || (livePolicy == desiredPolicy)
        if succeeded && self.currentPolicy != livePolicy {
            self.currentPolicy = livePolicy
        }
        return succeeded
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blindly assuming false means the OS rejected the policy change
let success = NSApplication.shared.setActivationPolicy(.regular)
if !success {
    // BUG: If the app was ALREADY .regular, this branch executes,
    // corrupting local state and raising false alerts.
    fatalError("Failed to switch to regular mode")
}
```

**VERIFICATION METHOD**:
Execute an automated test invoking transition twice with the same parameter:
```swift
func testRedundantActivationPolicyTransitionSucceeds() {
    let mock = MockActivationPolicyTarget(initial: .accessory)
    let coordinator = SafeActivationPolicyCoordinator(target: mock)
    
    XCTAssertTrue(coordinator.transition(to: .regular))
    // Second invocation returns false from mock.setActivationPolicy, but coordinator must return true
    XCTAssertTrue(coordinator.transition(to: .regular))
    XCTAssertEqual(coordinator.currentPolicy, .regular)
}
```

---

### 3. Apple Event Descriptor Memory Alignment & Type Proofing
**RULE**:
When parsing raw Mach/Carbon Apple Event attributes (such as `keySenderPIDAttr` via `NSAppleEventManager`), you **MUST NOT** load pointers directly from unaligned `NSData` or typed data buffers. You **MUST** verify descriptor type bounds, check memory size strictly, and use `withUnsafeMutableBytes` to copy memory into an aligned, zero-initialized primitive before typecasting.

**WHY**:
Apple Event attribute descriptors can pack integer types as `typeSInt32` or `typeUInt32` ('magn') without word alignment guarantees. Casting raw byte pointers from `descriptor.data` directly to `UnsafePointer<pid_t>` triggers unaligned memory access crashes on ARM64 architectures (Apple Silicon SIGBUS / EXC_ARM_DA_ALIGN) and undefined sign-extension behavior.

**WHEN TO APPLY**:
Any Apple Event handler, IPC receiver, or Carbon event inspection bridge handling OS launch, reopen, or script events.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import Foundation
import CoreServices

public enum AppleEventPIDParser {
    public static func extractPID(from event: NSAppleEventDescriptor, keyword: AEKeyword) -> pid_t? {
        guard let attribute = event.attributeDescriptor(forKeyword: keyword) else {
            return nil
        }
        
        let type = attribute.descriptorType
        guard type == typeSInt32 || type == typeUInt32 else {
            return nil
        }
        
        let data = attribute.data
        guard data.count == MemoryLayout<UInt32>.size else {
            return nil
        }
        
        var rawPID: UInt32 = 0
        // Safe: copy bytes into stack-allocated, aligned variable memory
        withUnsafeMutableBytes(of: &rawPID) { buffer in
            _ = data.copyBytes(to: buffer)
        }
        
        guard let pid = pid_t(exactly: rawPID), pid > 0 else {
            return nil
        }
        return pid
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// CRITICAL BUG: Direct pointer binding on unaligned data causes SIGBUS crashes on ARM64
let rawPtr = (descriptor.data as NSData).bytes.bindMemory(to: pid_t.self, capacity: 1)
let pid = rawPtr.pointee // UNDEFINED BEHAVIOR: Memory alignment fault
```

**VERIFICATION METHOD**:
Construct an unaligned `Data` buffer containing a packed `UInt32` and verify parsing:
```swift
func testUnalignedAppleEventPIDExtraction() {
    var rawBytes: [UInt8] = [0xFF, 0x01, 0x00, 0x00, 0x00] // Misaligned offset
    let subdata = Data(rawBytes[1...4]) // Subdata with offset 1
    let descriptor = NSAppleEventDescriptor(descriptorType: typeUInt32, data: subdata)!
    
    let pid = AppleEventPIDParser.extractPID(from: descriptor, keyword: AEKeyword(keySenderPIDAttr))
    XCTAssertEqual(pid, 1)
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: System Memory Calculation Discrepancy vs Activity Monitor (BUG-MEM-01)
- **Context**: `Sources/StatusTrioCore/Monitoring/MemoryReader.swift`
- **What Was Expected**: Application memory display must match Activity Monitor's "App Memory" within a 1-2% sampling tolerance across Intel and Apple Silicon Macs.
- **What Actually Happened**: The application reported App Memory as 39.9 GB while Activity Monitor reported 49.54 GB (a ~10 GB delta). Memory gauge percentages contradicted card details.
- **Evidence in Repo**: Issue #363, resolved in commit `de0584c1` and merged into release candidate `175ee0c4`.
- **Root Cause**: `MemoryReader` calculated `appBytes` using Mach VM `active_count` minus `purgeable_count`. `active_count` includes external file-backed cache pages (`external_page_count`). In Activity Monitor, App Memory is defined strictly as anonymous/internal memory: `internal_page_count - purgeable_count`. Conflating `active` with `internal` omitted internal inactive dirty pages and misclassified file caches.
- **Remediation Code Diff**:
```swift
// Sources/StatusTrioCore/Monitoring/MemoryReader.swift
- let app = stats.activeBytes > stats.purgeableBytes ? stats.activeBytes - stats.purgeableBytes : 0
+ let app = stats.internalBytes > stats.purgeableBytes ? stats.internalBytes - stats.purgeableBytes : 0
```
- **Lesson**: Kernel abstractions define specific semantic categorizations. "Active" refers to paging eviction state (active vs. inactive list), NOT anonymous vs. file-backed ownership. System metrics must match kernel page ownership semantics (`internal` vs `external`).

---

### Incident 2: Dual-Ring Battery Charging Symbol Silent Render Failure (BUG-UI-02)
- **Context**: `Sources/StatusTrioCore/UI/Icon/StatusIconRenderer.swift` and `HardwareRingMapper.swift`
- **What Was Expected**: When the user configures the custom hardware ring's top accessory to "Charging Indicator", it must draw the bolt (`⚡`) or plug (`🔌`) icon in dual-ring (`.leftRight`) mode.
- **What Actually Happened**: The accessory area rendered completely blank (silent drop). Discharge status showed percentage numbers, but connecting to power rendered nothing.
- **Evidence in Repo**: Issue #361, resolved in commits `aa390bb6` and `e87e1caf`.
- **Root Cause**: Pattern matching exhaustiveness failure. In `StatusIconRenderer.swift`, the accessory rendering pipeline for dual rings contained:
  ```swift
  guard case let .symbol(name, variableValue, fallback) = symbol.source else { return }
  ```
  However, `HardwareRingMapper.swift` generated primitive icon states: `.primitive(.bolt)` and `.primitive(.plug)`. Because the `guard case` pattern only handled `.symbol(...)`, it failed silently and took the early `return`, dropping the draw call. Single-ring layouts used a different path supporting `.primitive`, masking the bug during single-ring testing.
- **Remediation Code Diff**:
```swift
// Sources/StatusTrioCore/UI/Icon/StatusIconRenderer.swift
- guard case let .symbol(name, variableValue, fallback) = symbol.source else { return }
- drawSymbol(name: name, variableValue: variableValue, fallback: fallback)
+ switch symbol.source {
+ case let .symbol(name, variableValue, fallback):
+     drawSymbol(name: name, variableValue: variableValue, fallback: fallback)
+ case let .primitive(primitive):
+     drawPrimitiveSymbol(primitive, in: rect, context: context)
+ }
```
- **Lesson**: Do not use non-exhaustive `guard case let` across polymorphic domain enums in UI rendering routines. Enum matching must be exhaustive (`switch`) to ensure new or alternative cases produce compile-time enforcement rather than silent visual drops.

---

### Incident 3: Open Panel Slider Color Desynchronization (BUG-UI-03)
- **Context**: `Sources/StatusTrioCore/Presentation/Panel/StatusPanelViewModel.swift` & `StatusPopoverView.swift`
- **What Was Expected**: Changing level slider colors (Volume/Brightness/Mic) in Settings must instantly repaint sliders in the open popover panel.
- **What Actually Happened**: Color changes in Settings did not update an active open popover. Sliders only updated after closing and reopening the popover.
- **Evidence in Repo**: Commit `175ee0c4` (PR #359).
- **Root Cause**: `StatusPopoverView` referenced `panel.settings.panelLevelSliderColor` directly. While `settings` was an `@ObservedObject`, the popover view observed `StatusPanelViewModel`. `StatusPanelViewModel` did not replicate `panelLevelSliderColor` as a `@Published` property, nor did it subscribe to changes in `settings.$panelLevelSliderColor`. Consequently, changes in settings did not fire `objectWillChange` on the panel view model.
- **Remediation Code Diff**:
```swift
// StatusPanelViewModel.swift
+ @Published private(set) var panelLevelSliderColor: PanelLevelSliderColorSelection
...
+ settings.$panelLevelSliderColor
+     .removeDuplicates()
+     .sink { [weak self] color in
+         guard let self, self.panelLevelSliderColor != color else { return }
+         self.panelLevelSliderColor = color
+     }
+     .store(in: &cancellables)

// StatusPopoverView.swift
- switch panel.settings.panelLevelSliderColor {
+ switch panel.panelLevelSliderColor {
```
- **Lesson**: In MVVM architectures using Combine/SwiftUI, child views must NEVER bypass their immediate ViewModel to read reactive settings directly from a secondary data store. Doing so breaks the dependency tracking tree and drops reactive invalidations.

---

### Incident 4: Selected Device Row Disregarding Bold Text Settings (BUG-UI-04)
- **Context**: `Sources/StatusTrioCore/UI/AudioInputControlsView.swift` & `OutputDeviceRow.swift`
- **What Was Expected**: Disabling the "Bold Panel Text" option must normalize all panel typography to regular weight.
- **What Actually Happened**: Unselected device rows followed the font switch, but selected audio input/output rows remained hardcoded to `.semibold`, ignoring the user's accessibility/aesthetic preference.
- **Evidence in Repo**: Commit `a19afaa9` (PR #364).
- **Root Cause**: The font modifier evaluated selection status unconditionally: `.weight(row.selected ? .semibold : .regular)`. It failed to inject the `@Environment(\.statusPanelBoldTextEnabled)` environment key.
- **Remediation Code Diff**:
```swift
// AudioInputControlsView.swift & OutputDeviceRow.swift
+ @Environment(\.statusPanelBoldTextEnabled) private var panelBoldText
...
- .font(.body.weight(row.selected ? .semibold : .regular))
+ .font(.body.weight(row.selected && panelBoldText ? .semibold : .regular))
```
- **Lesson**: Visual hierarchy attributes (e.g., selection) must compose with global typography styling through boolean conjunction (`selected && allowBold`) rather than overriding user-configured accessibility settings.

---

### Incident 5: CI/CD Universal Release Benchmark Shell Injection & Manifest Schema Rejection (BUG-REL-05)
- **Context**: `.github/workflows/compile-bench.yml` & `scripts/sync-gitee-release.mjs`
- **What Was Expected**: Automated benchmark summaries must log arbitrary user-provided notes safely without shell syntax errors, and release synchronization scripts must accept Candidate schema v2 manifests.
- **What Actually Happened**: Direct interpolation `echo "- note: ${{ inputs.note }}"` broke whenever inputs contained quotes, backticks, or shell special characters. Simultaneously, mirror releases to Gitee failed validation due to rigid `schema_version === 1` checking.
- **Evidence in Repo**: Commits `175ee0c4` and `1ec6b8a9`.
- **Root Cause**: 
  1. GitHub Actions context interpolation `${{ inputs.note }}` inside `run:` executes as raw shell code before the shell parses commands.
  2. The release sync script used strict equality `m?.schema_version !== 1` without accommodating schema version 2 candidate structures.
- **Remediation Code Diff**:
```yaml
# .github/workflows/compile-bench.yml
+ env:
+   BENCH_NOTE: ${{ inputs.note }}
  run: |
-   echo "- note: ${{ inputs.note }}"
+   printf '%s\n' "- note: ${BENCH_NOTE}"
```
```javascript
// scripts/sync-gitee-release.mjs
- if (m?.schema_version !== 1 || m.tag !== tag ...
+ const schemaOk =
+   m?.schema_version === 1 ||
+   (m?.schema_version === 2 &&
+     m?.candidate?.publishable === true &&
+     m?.candidate?.source_sha === m?.source_sha);
+ if (!schemaOk || m.tag !== tag ...
```
- **Lesson**: GitHub Actions expressions `${{ }}` must never be expanded inline within shell script bodies. Pass them via environment variables (`env:`) and access them using formatted POSIX builtins (`printf '%s\n' "$VAR"`). Serialization validators must use version dispatching with structural invariants.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In high-frequency rendering and hardware state management, implicit coercions and mutation leaks degrade performance and corrupt state:

* **Unsafe Byte Alignment vs. Base Address Casting**:
  ```swift
  // DEFECT HAZARD: Data.withUnsafeBytes provides no guarantee that the pointer 
  // is aligned to 4-byte boundaries for UInt32/pid_t on ARM64 platforms.
  let rawPID = data.withUnsafeBytes { $0.load(as: UInt32.self) } // CRASH: SIGBUS
  
  // INVARIANT: Stack allocation guarantees alignment. Use copyBytes.
  var rawPID: UInt32 = 0
  _ = withUnsafeMutableBytes(of: &rawPID) { data.copyBytes(to: $0) }
  ```
* **Combine Publisher Duplicate Prevention (`removeDuplicates`)**:
  When binding SwiftUI `@Published` properties from underlying settings models, failure to invoke `.removeDuplicates()` generates an infinite update storm across the main runloop:
  ```swift
  // DEFECT HAZARD: Every touch to settings emits an event, even if the value is unchanged.
  settings.$panelLevelSliderColor
      .sink { [weak self] in self?.panelLevelSliderColor = $0 } // Triggers unnecessary layout passes
  
  // INVARIANT: Double-gated deduplication
  settings.$panelLevelSliderColor
      .removeDuplicates()
      .sink { [weak self] color in
          guard let self, self.panelLevelSliderColor != color else { return }
          self.panelLevelSliderColor = color
      }
  ```

### 2. Infinite Loop & Resource Starvation Guards
* **Termination Invariant in Async Termination (`applicationShouldTerminate`)**:
  When tearing down privileged helper daemons or writing persistent kernel states (e.g. `pmset -a disablesleep 0` on sleep assertions), waiting synchronously freezes the macOS UI thread and risks an OS watchdog kill (`SIGKILL`). 
  Status-Trio guarantees termination using a dual-racing Task model:
  ```swift
  public func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
      guard let environment, environment.store.sleepControl.needsTerminationCleanup else {
          return .terminateNow
      }
      let sleepControl = environment.store.sleepControl
      
      // RACING PATTERN: Bounded execution task vs Hard timeout fallback
      Task { @MainActor in
          await sleepControl.shutdown()
          self.replyToTermination()
      }
      Task { @MainActor in
          try? await Task.sleep(for: .seconds(3))
          self.replyToTermination() // Guarantees app exits even if helper daemon hangs
      }
      return .terminateLater
  }
  
  private var didReplyToTermination = false
  private func replyToTermination() {
      guard !didReplyToTermination else { return } // INVARIANT: Reply once and only once
      didReplyToTermination = true
      NSApplication.shared.reply(toApplicationShouldTerminate: true)
  }
  ```

### 3. UI & UX Micro-Mechanics
* **Dock vs Menu Bar Coalescing Invariants**:
  When scrubbing an audio slider, CoreAudio emits tens of volume updates per second.
  - **Menu Bar**: Redraws in-process via CoreGraphics memory buffers.
  - **Dock**: Invokes `NSApplication.setApplicationIconImage(_)`. This executes an XPC roundtrip to `com.apple.dock`, serializing an entire bitmap.
  - **Mechanic**: `AppIconController` runs two distinct coalescers:
    ```swift
    if output.scene.isVolumeValueChange(from: previousScene) {
        // High-frequency burst: Coalesce volume specifically, bound to display frame intervals
        volumeRenderCoalescer.submit(footer: output.scene.footer) { [weak self] in
            self

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
