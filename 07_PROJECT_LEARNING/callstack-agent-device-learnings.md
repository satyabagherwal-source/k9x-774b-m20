> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source**: github ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Source Version**: `ed798f9c`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T07:22:24.729Z  
> **Learning ID**: `learn-github-callstack-agent-device`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): callstack/agent-device

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Problem Space
`agent-device` solves the fundamental impedance mismatch between nondeterministic AI coding agents (LLMs) and deterministic mobile operating systems (iOS, Android, HarmonyOS, tvOS, macOS, Linux). 

Traditional mobile automation harnesses (Appium, raw XCUITest, bare ADB) fail under agentic workloads because:
1. **Context Window Saturation**: Full DOM/view hierarchies and raw multi-megabyte screenshots blow through LLM context limits and incur massive latency.
2. **Dynamic Volatility & Race Conditions**: Animations, lazy-loaded lists, floating bars, and OS permission popups cause brittle selector resolution.
3. **Ghost Hangs & Daemon Deadlocks**: Unbounded OS-level sub-commands (e.g., `adb shell dumpsys`, XCTest IPC serialization) hang indefinitely, causing host timeouts that sever agent sessions.
4. **Target Mutation Drift**: Mobile UIs regenerate element memory addresses across view cycles, invalidating standard element handles.

`agent-device` implements a high-throughput, cross-platform automation daemon communicating over JSON-RPC/MCP and a dedicated CLI. It translates raw OS accessibility trees and compositor surfaces into compressed, token-efficient semantic snapshots using short-lived reference handles (`@ref`), tracks UI stabilization across action boundaries with strict time budgets, and provides cross-language differential verification (TypeScript host engine vs. native Swift XCTest runner).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Agent / Client Surface Layer                      │
 │    Claude Code / Codex / Cursor / MCP Client / TypeScript API / CLI    │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ JSON-RPC / IPC Wire Protocol
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                  Host Daemon Kernel & Command Registry                 │
 │  - SessionStore: Durable Capture Resource Slices                       │
 │  - Timeout Policies: Envelope Calculators & Worst-Case Ledgers         │
 │  - Command Registry: Extended vs Fast Tier Execution Rules             │
 └─────────────┬───────────────────────────────────────────┬──────────────┘
               │                                           │
               ▼                                           ▼
 ┌───────────────────────────┐               ┌────────────────────────────┐
 │  Packages/ad-replay       │               │   Packages/capture-kit     │
 │  - Pure Policy Engine     │               │   - Presentation Engine    │
 │  - Single Var Scope Interp│               │   - Geometry / Viewport    │
 │  - Action Scrubbing       │               │   - Shelf Pruning / Occl   │
 └─────────────┬─────────────┘               └─────────────┬──────────────┘
               │                                           │
               ▼                                           ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Platform Transports & Drivers                     │
 ├────────────────────────────┬─────────────────────────────┬─────────────┤
 │     platform-android       │        platform-apple       │  harmonyos  │
 │  - ADB Executor (Bounded)  │  - AppleRunner XCUITest     │  - DevEco   │
 │  - Dumpsys Variant Budget  │  - Tree / Private-AX Pins   │  - Shell    │
 │  - Snapshot Helper APK     │  - Swift Conformance Engine │             │
 └────────────────────────────┴─────────────────────────────┴─────────────┘
```

### 1.2 Subsystem Decoupling & Invariant Boundaries
1. **The Policy vs. Authority Split (`packages/ad-replay` vs. Daemon)**:
   The replay engine (`step-loop.ts`) is strictly pure policy. It cannot mutate the device, snapshot state, or interact with file systems directly. It interacts with the device exclusively via a narrowed interface: `AdReplayStepRuntime`. All OS-side side effects, state mutations, and error recovery remain isolated within the daemon host runtime.
2. **Single-Token Resolution Invariant**:
   In `.ad` script replays, variable interpolation (`${VAR}`) occurs exactly once per step inside the policy loop prior to dispatch. Divergence reporting receives the recorded token (preserving secrecy and avoiding leaking unmasked credentials), while execution receives the expanded token.
3. **Shared Multi-Probe Monotonic Deadlines**:
   Platform inspection routines (like Android's multi-variant `dumpsys` interrogation) are bounded not by individual command timeouts, but by an aggregate shared monotonic `Deadline` object. Multiple fallback reads must share the remaining budget of a single window rather than accumulating multiple discrete timeouts.
4. **Dual-Implementation Differential Verification**:
   The iOS presentation layer exists as two identical implementations: TypeScript (`packages/capture-kit/src/ios-snapshot-engine`) and native Swift (`apple/snapshot-presentation`). They are continuously cross-verified using property-based fuzz testing via `fast-check` in CI to guarantee zero deviation in element filtering, hittability inference, and coordinate compaction.

---

## 2. Net-New Universal Engineering Rules

### 1. Monotonic Shared-Budget Deadline Pattern
**RULE**:
When an operation requires interrogating multiple fallback variants or sub-queries to resolve a single state question (e.g., inspecting foreground activity across window/activity dumps, or querying multiple network/IPC fallbacks), the system MUST NOT apply isolated timeout bounds to each sub-call. It MUST construct a single monotonic `Deadline` at the entry point of the parent question and supply `remainingMs = deadline.remainingMs()` to each sequential sub-operation. If `remainingMs <= 0`, subsequent queries MUST short-circuit immediately and return a typed non-fatal sentinel (e.g., `unknown` or empty string).

**WHY**:
Applying isolated individual timeouts (e.g., 10 seconds per sub-command) across $N$ fallback attempts creates a worst-case cumulative blocking duration of $N \times T$. In automated driver pipelines, this causes the top-level client request envelope to expire before the driver finishes polling, triggering premature timeouts, tearing down healthy daemons, and abandoning pending sub-processes on the host.

**WHEN TO APPLY**:
- Subprocess execution with multiple fallback arguments (e.g., `adb shell dumpsys window`, `dumpsys activity`).
- Resilient network/microservice health checks cascading across secondary nodes.
- DB fallback discovery or multi-region failover discovery loops.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production Invariant from packages/platform-android/src/observation.ts
import { Deadline } from '@agent-device/host-kit/retry';
import { isCommandTimeoutError } from '@agent-device/host-kit/command';

const DUMP_OBSERVATION_BUDGET_MS = 10_000;

export type DumpReader = (words: readonly string[]) => Promise<string>;

export function createDumpReader(
  host: { runAdb: (device: DeviceInfo, args: readonly string[], options: { timeoutMs: number; allowFailure: boolean }) => Promise<{ stdout: string }> },
  device: DeviceInfo
): DumpReader {
  const dumps = new Map<string, Promise<string>>();
  let deadline: Deadline | undefined;

  return (words: readonly string[]): Promise<string> => {
    const key = words.join(' ');
    const cached = dumps.get(key);
    if (cached) return cached;

    // Lazily seed the shared monotonic deadline on the first read of the question
    deadline ??= Deadline.fromTimeoutMs(DUMP_OBSERVATION_BUDGET_MS);
    const remainingMs = deadline.remainingMs();

    // Zero or negative remaining budget short-circuits immediately without I/O
    if (remainingMs <= 0) {
      return Promise.resolve('');
    }

    const pending = host
      .runAdb(device, ['shell', ...words], {
        allowFailure: true,
        timeoutMs: remainingMs,
      })
      .then(
        (result) => result.stdout,
        (error: unknown) => {
          // Swallow timeout errors to degrade gracefully to 'unanswered'
          if (!isCommandTimeoutError(error)) throw error;
          return '';
        }
      );

    dumps.set(key, pending);
    return pending;
  };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Independent timeouts compounding into an unproven multi-minute cascade
async function readForegroundBad(host: Host, device: Device): Promise<string> {
  const variants = [
    ['dumpsys', 'window', 'windows'],
    ['dumpsys', 'window'],
    ['dumpsys', 'activity', 'activities'],
    ['dumpsys', 'activity'],
  ];
  for (const variant of variants) {
    try {
      // DANGER: Each call spends up to 10s. Total worst-case latency = 40s!
      // This completely breaches upper-layer client RPC envelope limits (e.g., 30s).
      const res = await host.runAdb(device, variant, { timeoutMs: 10_000 });
      if (res.stdout) return res.stdout;
    } catch (err) {
      // Loops continue, compounding timeout debt
    }
  }
  return '';
}
```

**VERIFICATION METHOD**:
Verify using a virtual clock test harness that simulates hung sub-commands:
```typescript
test('cascading variant reads do not exceed aggregate budget', async () => {
  const aggregateBudget = 10_000;
  let virtualTime = 0;
  const mockAdb = vi.fn().mockImplementation(async (_dev, _args, opts) => {
    // Simulate each command consuming all available slice or half of it
    const spent = Math.min(opts.timeoutMs, 6_000);
    virtualTime += spent;
    if (spent >= opts.timeoutMs) {
      const err = new Error('adb timeout');
      err.name = 'CommandTimeoutError';
      throw err;
    }
    return { stdout: '' };
  });

  const reader = createDumpReader({ runAdb: mockAdb }, mockDevice);
  await reader(['window', 'windows']);
  await reader(['window']);
  await reader(['activity']);

  expect(virtualTime).toBeLessThanOrEqual(aggregateBudget);
  expect(mockAdb).toHaveBeenCalledTimes(2); // 3rd must short-circuit without invocation
});
```

---

### 2. Proof-by-Ledger Worst-Case RPC Envelope Contract
**RULE**:
Every asynchronous command registered in an automation daemon that exhibits variable multi-step device preparation (such as cold-path APK installations, fallback version comparisons, or long-running gestures) MUST have its top-level request timeout envelope ($T_{\text{envelope}}$) verified by an automated integration test against a simulated worst-case ledger. Envelope values MUST NOT be computed via manual summation or guesswork. Every step in the execution tree MUST be charged its strict execution timeout on a virtual clock ledger. The top-level envelope MUST strictly satisfy:
$$T_{\text{envelope}} \ge \sum_{i=1}^{n} T_{\text{step}_i}^{\text{worst}} + T_{\text{margin}}^{\text{daemon}}$$

**WHY**:
If the outer envelope timeout is smaller than the worst-case path through internal recovery routines (e.g., version mismatch $\to$ APK pull $\to$ hash verification $\to$ failed upgrade $\to$ full uninstall $\to$ re-install $\to$ one-shot gesture run), an outer client timeout will abort the connection while the underlying device is still executing. The client drops the connection, triggering a host-side daemon restart, leaving orphaned instrumentation processes on the device and deadlocking subsequent automation steps.

**WHEN TO APPLY**:
- Automation engines wrapping complex OS bridges (ADB, XCUITest, WebDriver, SSH).
- Workflows with cold-boot initialization, fallback installations, or file transfer verification.
- Any RPC protocol defining a hard outer client abort deadline.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production Invariant from packages/command-registry/src/registry.ts & ledger test
export const SETTLE_FLAG_PRESERVE_DAEMON_TIMEOUT_POLICY = {
  // Proven by test/integration/provider-scenarios/android-longpress-ledger.test.ts
  // 120s max user hold + cold APK uninstall/install + dumpsys dialog budgets + margin
  envelopeMs: 320_000,
};

// Ledger test harness proving the envelope constraint
test('longpress request envelope outlasts the worst-case cold route', async () => {
  let virtualTimeSpentMs = 0;
  const recordedSteps: Array<{ tool: string; timeoutMs: number }> = [];

  const fakeAdbProvider: AndroidAdbProvider = {
    exec: async (args, options) => {
      const timeoutMs = options?.timeoutMs;
      // Invariant: Unbounded operations in the driver fail the ledger test immediately
      assert.ok(
        timeoutMs !== undefined && Number.isFinite(timeoutMs) && timeoutMs > 0,
        `Unbounded adb call detected: ${args.join(' ')}`
      );
      recordedSteps.push({ tool: args[0], timeoutMs });
      virtualTimeSpentMs += timeoutMs;
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  };

  await driveColdAndroidLongPress(fakeAdbProvider, { holdMs: LONG_PRESS_DURATION_MAX_MS });

  const resolvedPolicy = resolveCommandTimeoutPolicy('longpress');
  const configuredEnvelope = resolvedPolicy.envelopeMs;

  assert.ok(
    configuredEnvelope >= virtualTimeSpentMs,
    `Outer envelope (${configuredEnvelope}ms) breached by worst-case execution (${virtualTimeSpentMs}ms)`
  );
});
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Hand-summed arbitrary envelope constant
export const UNVERIFIED_TOUCH_POLICY = {
  // DANGER: Developer assumed: 120s hold + 30s install + 60s buffer = 210s.
  // Reality: pm path (10s) + adb pull (30s) + uninstall (30s) + install (60s) + 
  // dumpsys checks (4 x 10s = 40s) + 120s gesture = 290s!
  // Client drops socket at 210s while device is mid-install, crashing the harness.
  envelopeMs: 210_000, 
};
```

**VERIFICATION METHOD**:
Run static assertion suites ensuring no registered command specifies an `envelopeMs` deviating from the ledger scenario proof:
```bash
pnpm vitest run src/__tests__/command-descriptor-timeout-policy.test.ts
```

---

### 3. Slot-Separation of Intent vs. Fault in Pipeline Verdicts
**RULE**:
In an execution engine or diagnostic capture pipeline, an intentional pre-configuration, manual preference, or forced route (such as requesting a specific backend or tree mode) MUST NOT be stored in the error/failure slot of the execution state machine. Intent MUST occupy a dedicated `preSelection` slot. The `firstFailure` slot MUST remain reserved strictly for runtime faults. The final result verdict resolver MUST evaluate:
$$\text{Verdict} = \text{firstFailure} \parallel \text{preSelection} \parallel \text{Default}$$

**WHY**:
If a pre-selection token (e.g., `'requested-backend'`) is seeded into the `firstFailure` slot at pipeline initialization, any subsequent real runtime failure (e.g., Apple AX server returning `kAXErrorIllegalArgument` or Android dumping an empty hierarchy) will be blocked from recording its failure code. Upstream consumers inspect the verdict, find `'requested-backend'`, falsely assume that the operation succeeded without degradation, and present corrupt, empty, or un-actionable snapshot nodes to the agent.

**WHEN TO APPLY**:
- Multi-tier diagnostic fallbacks (e.g., XCUITest recursive tree $\to$ private Accessibility API $\to$ screenshot fallback).
- Multi-provider database or network client routing where preferred backends can degrade.
- Compiler pass status classification and diagnostic engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Production Invariant from AppleRunner RunnerTests+SnapshotCapturePlan.swift

/// Explicit slot separation: Pre-selection reason (intent) vs First-failure (fault)
static func snapshotPlanPreSelectionReason(
  _ state: SnapshotXCTestChannelPlanState,
  requestPinnedBackend: Bool = false,
  preferredBackend: String? = nil
) -> (reason: String, code: String)? {
  if state == .normal && preferredBackend == SnapshotBackendKind.recursiveTree.rawValue {
    return ("the recursive XCTest tree backend was explicitly selected for this capture", "requested-backend")
  }
  if state == .deferredToIndependentBackend && requestPinnedBackend {
    return ("the private AX backend was selected because this capture asked for custom actions", "requested-backend")
  }
  return nil
}

/// The failure slot ONLY captures actual operational errors
static func xcTestChannelStateFirstFailure(
  _ state: SnapshotXCTestChannelPlanState,
  requestPinnedBackend: Bool = false
) -> (reason: String, code: String)? {
  switch state {
  case .normal:
    return nil
  case .deferredToIndependentBackend:
    if requestPinnedBackend { return nil } // Intent is not failure!
    return ("XCTest-backed snapshot tiers were deferred after recent slow work", "deferred")
  case .boundedXCTestProbe:
    return ("XCTest-backed snapshot tiers ran on a bounded probe", "budget")
  }
}

/// Final verdict prioritizes genuine runtime failure over static intent
static func planVerdictReason(
  xCTestTierRan: Bool,
  state: SnapshotXCTestChannelPlanState,
  firstFailure: (reason: String, code: String)?,
  preSelection: (reason: String, code: String)?
) -> (reason: String, code: String)? {
  guard xCTestTierRan, state == .deferredToIndependentBackend else {
    // Fault ALWAYS overrides intent; fallback to intent only when no fault occurred
    return firstFailure ?? preSelection
  }
  return xcTestChannelStateFirstFailure(.boundedXCTestProbe)
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Seeding intent into the failure slot
var firstFailure: (reason: String, code: String)? = nil
if preferredBackend == "recursiveTree" {
  // DANGER: Seeding the failure slot with an intent code!
  firstFailure = ("Explicitly selected", "requested-backend")
}

// Later during execution...
do {
  try performTreeSnapshot()
} catch {
  // If the code uses null-coalescing or guards:
  if firstFailure == nil {
    firstFailure = ("AX Error: kAXErrorIllegalArgument", "ax-rejected")
  }
  // RESULT: "ax-rejected" is dropped! The caller thinks the tree succeeded cleanly!
}
```

**VERIFICATION METHOD**:
Automated unit test with simulated AX server faults:
```swift
func testPlanVerdictReasonPrefersTheFirstFailureOverThePreSelection() {
  let pin = ("selected", "requested-backend")
  let fault = ("AX Error", "ax-rejected")

  // Scenario A: No fault occurs -> Verdict reflects intent
  XCTAssertEqual(
    planVerdictReason(xCTestTierRan: true, state: .normal, firstFailure: nil, preSelection: pin)?.code,
    "requested-backend"
  )

  // Scenario B: Runtime fault occurs -> Fault MUST displace intent
  XCTAssertEqual(
    planVerdictReason(xCTestTierRan: true, state: .normal, firstFailure: fault, preSelection: pin)?.code,
    "ax-rejected"
  )
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Android Dumpsys Cascade Starvation via Unshared Read Budgets (BUG-AD-01)
- **Context**: `packages/platform-android/src/observation.ts` and `packages/contracts/src/android-observation.ts`.
- **What Was Expected**: Observation tasks probing Android UI state (e.g., detecting foreground application and blocking modal dialogs) inspect up to four `dumpsys` variant commands (`dumpsys window windows`, `dumpsys window`, `dumpsys activity activities`, `dumpsys activity`). When a target device is unresponsive or dropping adb frames, the queries must fail fast without exceeding the global client request timeout.
- **What Actually Happened**: The commands executed with either no timeout or an isolated per-read timeout (10s each). On hung devices, all four variants hung in sequence, each consuming 10s (totaling 40s or infinite wait). This caused the caller's outer RPC client envelope to expire, resulting in a socket reset, daemon restart, and aborted testing session.
- **Evidence in Repo**: Commit `a9fc9a19`, PR #3936.
- **Root Cause**: Failure to treat the foreground query as a single bounded transaction with an aggregate monotonic deadline. Individual variants walked their own timeouts independently.
- **Remediation Code Diff**:
```typescript
--- a/packages/platform-android/src/observation.ts
+++ b/packages/platform-android/src/observation.ts
@@ -32,6 +34,8 @@ const PERMISSION_PACKAGES = new Set([
   'com.google.android.packageinstaller',
 ]);
 
+const DUMP_OBSERVATION_BUDGET_MS = 10_000;
+
 type Question = 'foreground' | 'blockingDialog';
 type DumpReader = (words: readonly string[]) => Promise<string>;
@@ -79,18 +83,37 @@ export function createAndroidObservationAdapter(
 function createDumpReader(host: AndroidObservationHost, device: DeviceInfo): DumpReader {
   const dumps = new Map<string, Promise<string>>();
+  let deadline: Deadline | undefined;
   return (words) => {
     const key = words.join(' ');
-    const pending =
-      dumps.get(key) ??
-      host
-        .runAdb(device, deviceShellArgv('adb', 'shell', words), { allowFailure: true })
-        .then((result) => {
+    const cached = dumps.get(key);
+    if (cached) return cached;
+    deadline ??= Deadline.fromTimeoutMs(DUMP_OBSERVATION_BUDGET_MS);
+    const remainingMs = deadline.remainingMs();
+    if (remainingMs <= 0) return Promise.resolve('');
+    const pending = host
+      .runAdb(device, deviceShellArgv('adb', 'shell', words), {
+        allowFailure: true,
+        timeoutMs: remainingMs,
+      })
+      .then(
+        (result) => {
           recordSections(device, key, result.stdout);
           return result.stdout;
-        });
+        },
+        (error: unknown) => {
+          if (!isCommandTimeoutError(error)) throw error;
+          return '';
+        },
+      );
     dumps.set(key, pending);
     return pending;
   };
```
- **Lesson**: Sub-queries in an exploratory cascade must be driven by a single parent deadline. When time runs out, return empty/unknown immediately.

---

### Incident 2: Longpress Envelope Protocol Race & Unproven Hand-Sum Envelopes (BUG-AD-02)
- **Context**: `packages/command-registry/src/registry.ts`, `src/commands/interaction/runtime/gestures.ts`, `packages/contracts/src/gesture-plan-types.ts`.
- **What Was Expected**: An agent issuing `longpress` with duration up to 120 seconds on Android must complete reliably even when the device must perform a cold-path installation of the instrumentation snapshot APK.
- **What Actually Happened**: The `longpress` command's top-level envelope was hardcoded to 210,000ms (210s) based on an unchecked hand calculation. On slow emulators or test environments requiring APK replacement, the cumulative execution steps (checksum checks, APK pull, incompatible update uninstalls, reinstall, dump observation probes, plus the 120s physical gesture) totaled ~290s. The outer client RPC closed the connection at 210s, throwing a timeout error while the device was still successfully completing the action.
- **Evidence in Repo**: Commit `69b97456`, PR #3937.
- **Root Cause**: The timeout policy envelope was derived by human estimation rather than verified against a mechanical worst-case ledger test harness.
- **Remediation Code Diff**:
```typescript
--- a/packages/command-registry/src/registry.ts
+++ b/packages/command-registry/src/registry.ts
@@ -1298,10 +1298,10 @@ export const RAW_COMMAND_DESCRIPTORS = [
     frameworkTier: 'extended',
     timeoutPolicy: {
       ...SETTLE_FLAG_PRESERVE_DAEMON_TIMEOUT_POLICY,
-      // Android's cold path may inspect/install the helper, hand off a running
-      // snapshot helper, hold for 120 seconds, then use 15 seconds of helper
-      // completion overhead. Keep that complete route inside the envelope.
-      envelopeMs: 210_000,
+      // Android cold-helper worst case at the maximum hold plus the daemon-result margin, applied
+      // to every platform. Proven by the ledger test:
+      // test/integration/provider-scenarios/android-longpress-ledger.test.ts.
+      envelopeMs: 320_000,
     },
     postActionObservation: postActionObservation('longpress'),
     batchable: true,
--- a/packages/contracts/src/gesture-plan-types.ts
+++ b/packages/contracts/src/gesture-plan-types.ts
@@ -15,6 +15,7 @@ export type GestureContactCount = 1 | 2 | 3 | 4 | 5;
 
 export const GESTURE_DURATION_MIN_MS = 16;
 export const GESTURE_DURATION_MAX_MS = 10_000;
+export const LONG_PRESS_DURATION_MAX_MS = 120_000;
 export const DEFAULT_DRAG_SOURCE_HOLD_MS = 800;
```
- **Lesson**: Timeout envelopes cannot be assumed. They must be formally calculated by simulating the absolute worst-case sequence on a virtual clock ledger.

---

### Incident 3: iOS Tree-Pinned AX Failure Masked by Requested-Backend Pre-selection (BUG-AD-03)
- **Context**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotCapturePlan.swift`.
- **What Was Expected**: When capturing an iOS snapshot pinned to the recursive XCTest tree backend, if the screen hierarchy triggers an immediate Accessibility Server failure (`kAXErrorIllegalArgument`), the capture payload must be flagged as `sparse` with `reasonCode: "ax-rejected"`, signaling that the tree was rejected by the OS.
- **What Actually Happened**: The test runner reported `reasonCode: "requested-backend"` and claimed that nothing degraded. The host daemon interpreted this as a successful tree capture, but downstream processing failed to parse the empty payload, translating it into a confusing viewport sizing error that hid the true Accessibility crash.
- **Evidence in Repo**: Commit `3ad4319d`, PR #3916.
- **Root Cause**: `RunnerTests+SnapshotCapturePlan.swift` wrote `"requested-backend"` into the plan's `firstFailure` slot at plan startup. When `-[XCUIElement snapshotWithError:]` subsequently failed with `-1` (`kAXErrorIllegalArgument`), the failure handler saw that `firstFailure` was already populated and did not overwrite it.
- **Remediation Code Diff**:
```swift
--- a/apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotCapturePlan.swift
+++ b/apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotCapturePlan.swift
@@ -235,28 +235,19 @@ extension RunnerTests {
   static func xcTestChannelStateFirstFailure(
     _ state: SnapshotXCTestChannelPlanState,
-    requestPinnedBackend: Bool = false,
-    preferredBackend: String? = nil
+    requestPinnedBackend: Bool = false
   ) -> (reason: String, code: String)? {
-    if state == .normal && preferredBackend == SnapshotBackendKind.recursiveTree.rawValue {
-      return (
-        "the recursive XCTest tree backend was explicitly selected for this capture",
-        "requested-backend"
-      )
-    }
     switch state {
     case .normal:
       return nil
     case .deferredToIndependentBackend:
       if requestPinnedBackend {
-        return (
-          "the private AX backend was selected because this capture asked for accessibility custom actions",
-          "requested-backend"
-        )
+        return nil
       }
@@ -270,16 +261,42 @@ extension RunnerTests {
+  static func snapshotPlanPreSelectionReason(
+    _ state: SnapshotXCTestChannelPlanState,
+    requestPinnedBackend: Bool = false,
+    preferredBackend: String? = nil
+  ) -> (reason: String, code: String)? {
+    if state == .normal && preferredBackend == SnapshotBackendKind.recursiveTree.rawValue {
+      return ("the recursive XCTest tree backend was explicitly selected for this capture", "requested-backend")
+    }
+    return nil
+  }
+
   static func planVerdictReason(
     xCTestTierRan: Bool,
     state: SnapshotXCTestChannelPlanState,
-    firstFailure: (reason: String, code: String)?
+    firstFailure: (reason: String, code: String)?,
+    preSelection: (reason: String, code: String)?
   ) -> (reason: String, code: String)? {
-    guard xCTestTierRan, state == .deferredToIndependentBackend else { return firstFailure }
+    guard xCTestTierRan, state == .deferredToIndependentBackend else { return firstFailure ?? preSelection }
     return xcTestChannelStateFirstFailure(.boundedXCTestProbe)