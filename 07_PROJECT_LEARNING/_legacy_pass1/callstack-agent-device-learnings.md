# Forensic Learning Record (Deep Inspection): callstack/agent-device

> **Canonical Artifact**: `07_PROJECT_LEARNING/callstack-agent-device-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/callstack/agent-device](https://github.com/callstack/agent-device))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:38:48.908Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/agent-device`
- **Description**: Mobile app automation and verification for AI coding agents. CLI, MCP server, and typed Node.js API for iOS, Android, HarmonyOS, TV, web, macOS, and Linux.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4831 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apple/snapshot-bridge/SnapshotBridgeCapture.h`
```
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef id _Nullable (^SnapshotElementReader)(id element, NSUInteger depth, NSUInteger nodes, NSError **error);

/// Native request accounting for one acquisition: requests issued, requests the accessibility
/// server rejected at their depth, continuations (requests that reached the reader beyond the
/// root's accepted one), and the native levels of the last accepted request.
typedef struct {
  NSUInteger requests;
  NSUInteger rejected;
  NSUInteger continuations;
  NSUInteger acceptedLevels;
} SnapshotCaptureRecovery;

/// Materializes one bounded tree; retries bounded native acquisition failures and re-roots withheld
/// children. `nativeLevelsHint` (0 for none) caps only the first request's native levels; the
/// delivered depth, node bounds, and completeness rules are unchanged.
NSDictionary *_Nullable captureSnapshotTree(id element, NSUInteger maxDepth, NSUInteger maxNodes,
                                           NSUInteger nativeLevelsHint, SnapshotElementReader reader,
                                           BOOL *truncated, SnapshotCaptureRecovery *_Nullable recovery,
                                           NSError **error);

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `apple/snapshot-bridge/SnapshotBridgeRuntime.h`
```
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

extern NSString *const kProtocolVersionKey;
extern NSString *const kSourceVersionKey;
extern NSString *const kRequestIdKey;
extern NSString *const kSourceVersion;
extern const NSUInteger kProtocolVersion;
extern const uint32_t kMaximumFrameBytes;
extern const NSUInteger kMaximumDepth;
extern const NSUInteger kMaximumNodes;
extern const NSUInteger kMaximumDurationMs;

NSDictionary *failureResponse(NSString *requestId,
                              NSString *kind,
                              NSString *code,
                              NSString *message);

@interface BridgeRuntime : NSObject
- (nullable instancetype)initWithError:(NSString *_Nullable *_Nullable)error;
- (nullable NSDictionary *)snapshotForProcess:(pid_t)pid
                                    maxDepth:(NSUInteger)maxDepth
                                    maxNodes:(NSUInteger)maxNodes
                            nativeLevelsHint:(NSUInteger)nativeLevelsHint
                                  requestId:(NSString *)requestId
                                generation:(NSString *)generation
                              maxDurationMs:(NSUInteger)maxDurationMs
                                    error:(NSDictionary *_Nullable *_Nonnull)error;
@end

BridgeRuntime *_Nullable sharedRuntime(NSString *_Nullable *_Nullable error);

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `bin/agent-device.mjs`
```
#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distPaths = [
  join(here, '..', 'dist', 'src', 'internal', 'bin.js'),
  join(here, '..', 'dist', 'src', 'bin.js'),
];
const distPath = distPaths.find((candidate) => existsSync(candidate));

if (!distPath) {
  process.stderr.write('Missing dist build. Run `pnpm build` before using the binary.\n');
  process.exit(1);
}

await import(pathToFileURL(distPath).href);

```

### Core Architecture Module: `examples/sdk/ai-sdk-tools.ts`
```
/**
 * AI SDK tool set: build a typed tool set from the command registry with
 * `createAgentDeviceTools()`, drive it through a `ToolLoopAgent`, then close
 * the session — no hand-written tool definitions.
 *
 * Demonstrates: `createAgentDeviceTools` from the `agent-device/ai-sdk`
 * subpath.
 *
 * Prerequisites: an `agent-device` daemon target (a booted iOS simulator),
 * `ai` installed, and `AI_MODEL` set to a model available through your
 * configured AI SDK provider. This file typechecks without any of those;
 * running it for real also requires `pnpm build` first, so the package
 * resolves at runtime.
 *
 * Run: node --experimental-strip-types examples/sdk/ai-sdk-tools.ts
 */
import { ToolLoopAgent } from 'ai';
import { createAgentDeviceTools } from 'agent-device/ai-sdk';

async function main(): Promise<void> {
  const { tools, client, toolApproval } = await createAgentDeviceTools({
    session: 'sdk-example-ai-sdk',
    platform: 'ios',
    // Closing the session is the one destructive action in this example's
    // default tool set, so require a human decision before the model can call it.
    approval: { close: 'user-approval' },
  });

  const agent = new ToolLoopAgent({
    model: process.env.AI_MODEL!,
    instructions: [
      'Inspect the current UI before acting.',
      'Verify the requested outcome with another snapshot before reporting success.',
    ].join('\n'),
    tools,
    toolApproval,
  });

  try {
    await client.apps.open({ app: 'com.apple.Preferences', platform: 'ios' });

    const result = await agent.generate({
      prompt: 'Open Notifications settings and report whether notifications are enabled.',
    });

    console.log(result.text);
  } finally {
    await client.sessions.close();
  }
}

await main();

```

### Core Architecture Module: `examples/sdk/batch-orchestration.ts`
```
/**
 * Batch orchestration for a custom transport: `runBatch` keeps step
 * validation, inherited flags, serial execution, partial results, and
 * daemon-shaped error envelopes aligned with the CLI's `batch` command, so a
 * bridge that owns command dispatch itself does not have to reimplement them.
 *
 * Demonstrates: `runBatch` from `agent-device/batch`, consumed against the
 * `DaemonResponse` result type from `agent-device/contracts`.
 *
 * Prerequisites: none — `dispatch` below is a stub; a real integration would
 * replace it with a call into the bridge's own command dispatcher.
 *
 * Run: node --experimental-strip-types examples/sdk/batch-orchestration.ts
 */
import { runBatch } from 'agent-device/batch';
import type { DaemonResponse } from 'agent-device/contracts';

type BatchRequest = Parameters<typeof runBatch>[0];

async function dispatch(stepReq: unknown): Promise<Record<string, unknown>> {
  console.log('dispatching step', stepReq);
  return { handled: true };
}

function bridgeErrorToDaemonResponse(error: unknown): Extract<DaemonResponse, { ok: false }> {
  return {
    ok: false,
    error: {
      code: 'COMMAND_FAILED',
      message: error instanceof Error ? error.message : 'Unknown bridge error',
    },
  };
}

async function handleBatch(req: BatchRequest): Promise<DaemonResponse> {
  return await runBatch(req, req.session ?? 'default', async (stepReq) => {
    try {
      return { ok: true, data: await dispatch(stepReq) };
    } catch (error) {
      return bridgeErrorToDaemonResponse(error);
    }
  });
}

const result = await handleBatch({
  command: 'batch',
  positionals: [],
  flags: {
    batchSteps: [
      { command: 'wait', input: { text: 'Welcome' } },
      { command: 'back', input: {} },
    ],
  },
});

if (result.ok) {
  console.log(`batch completed: ${JSON.stringify(result.data)}`);
} else {
  console.error(`batch failed [${result.error.code}]: ${result.error.message}`);
  process.exitCode = 1;
}

```

### Core Architecture Module: `examples/sdk/client-session.ts`
```
/**
 * Root client session: create a client, open an app, capture a snapshot, tap
 * a node, then close the session — with typed error handling via the
 * exported error helpers.
 *
 * Demonstrates: `createAgentDeviceClient`, `AppError`, `isAgentDeviceError`,
 * and `normalizeAgentDeviceError` from the `agent-device` root export.
 *
 * Prerequisites: an `agent-device` daemon target (a booted iOS simulator).
 * This file typechecks without one; running it for real also requires
 * `pnpm build` first, so the package resolves at runtime.
 *
 * Run: node --experimental-strip-types examples/sdk/client-session.ts
 */
import {
  AppError,
  createAgentDeviceClient,
  isAgentDeviceError,
  normalizeAgentDeviceError,
} from 'agent-device';
import type { AgentDeviceClient, AgentDeviceDevice } from 'agent-device';

async function resolveSnapshotCapableIosDevice(
  client: AgentDeviceClient,
): Promise<AgentDeviceDevice> {
  const devices = await client.devices.list({ platform: 'ios' });
  const device = devices[0];
  if (!device) {
    throw new AppError('DEVICE_NOT_FOUND', 'No iOS device available');
  }

  const capabilities = await client.devices.capabilities({ platform: 'ios' });
  if (!capabilities.availableCommands.includes('snapshot')) {
    throw new AppError('UNSUPPORTED_OPERATION', 'Selected target does not support snapshots');
  }

  return device;
}

function reportAgentDeviceError(error: unknown): void {
  const normalized = normalizeAgentDeviceError(error);
  console.error(`agent-device error [${normalized.code}]: ${normalized.message}`);
  if (normalized.hint) {
    console.error(`hint: ${normalized.hint}`);
  }
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const client = createAgentDeviceClient({
    session: 'sdk-example',
    lockPolicy: 'reject',
    lockPlatform: 'ios',
  });

  try {
    const device = await resolveSnapshotCapableIosDevice(client);

    await client.apps.open({
      app: 'com.apple.Preferences',
      platform: 'ios',
      udid: device.id,
    });

    const snapshot = await client.capture.snapshot({ interactiveOnly: true });
    const target = snapshot.nodes.find((node) => node.role === 'button');
    if (target) {
      await client.interactions.press({ ref: target.ref });
    }
  } catch (error) {
    if (!isAgentDeviceError(error)) throw error;
    reportAgentDeviceError(error);
  } finally {
    await client.sessions.close();
  }
}

await main();

```

### Core Architecture Module: `examples/sdk/contracts-result.ts`
```
/**
 * Typed result consumption from `agent-device/contracts`: compute the center
 * point of a snapshot node's rect, using the same `centerOfRect` helper the
 * daemon and CLI use internally.
 *
 * Demonstrates: `centerOfRect` from `agent-device/contracts`, consumed
 * against the `CaptureSnapshotResult` shape returned by the root client.
 *
 * Prerequisites: an `agent-device` daemon target with an app already open.
 * This file typechecks without one.
 *
 * Run: node --experimental-strip-types examples/sdk/contracts-result.ts
 */
import { createAgentDeviceClient } from 'agent-device';
import { centerOfRect } from 'agent-device/contracts';

function assertHasRect<T extends { rect?: unknown }>(
  node: T | undefined,
): asserts node is T & { rect: NonNullable<T['rect']> } {
  if (!node?.rect) {
    throw new Error('No visible node with a rect in the snapshot');
  }
}

async function main(): Promise<void> {
  const client = createAgentDeviceClient({ session: 'sdk-example' });

  try {
    const snapshot = await client.capture.snapshot({ interactiveOnly: true });
    const node = snapshot.nodes.find((candidate) => candidate.rect !== undefined);
    assertHasRect(node);

    const center = centerOfRect(node.rect);
    console.log(
      `center of ${node.role ?? 'node'} "${node.label ?? node.ref}": (${center.x}, ${center.y})`,
    );
  } finally {
    await client.sessions.close();
  }
}

await main();

```

### Core Architecture Module: `examples/sdk/metro-runtime.ts`
```
/**
 * Metro runtime helpers: normalize a Metro base URL and resolve the
 * host/port/scheme a client should connect through, given the runtime hints
 * a daemon response (or `AppOpenOptions.runtime`) carries.
 *
 * Demonstrates: `normalizeBaseUrl` and `resolveRuntimeTransport` from
 * `agent-device/metro`.
 *
 * Prerequisites: none — both functions are pure and need no daemon, device,
 * or running Metro bundler.
 *
 * Run: node --experimental-strip-types examples/sdk/metro-runtime.ts
 */
import { normalizeBaseUrl, resolveRuntimeTransport } from 'agent-device/metro';
import type { SessionRuntimeHints } from 'agent-device/contracts';

const baseUrl = normalizeBaseUrl('https://metro.example.dev///');
console.log(`normalized base URL: ${baseUrl}`);

const hints: SessionRuntimeHints = {
  platform: 'ios',
  metroHost: 'metro.example.dev',
  metroPort: 443,
};

const transport = resolveRuntimeTransport(hints);
if (!transport) {
  throw new Error('Unable to resolve a Metro runtime transport from the provided hints');
}

console.log(`resolved transport: ${transport.scheme}://${transport.host}:${transport.port}`);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2965** (2026-09-28): **fix(apple-runner): inline status probes must not clear outstanding command charges**
  *Symptoms*: ## Problem  ## Deletion-first acceptance  This is part of #2803's simplify-and-shrink initiative. Before production simplification, name the production mechanism, duplicated decision, state, fallback, forwarding layer, or public/internal interface this change removes. Compare deletion and inlining against extraction. Moving the same state into another file is not a deletion case.  Every PR reports baseline/final SHAs; added, deleted and net production lines; test/fixture/documentation changes separately; and the exact mechanisms removed. Use a rename-aware diff (`git diff --numstat -M BASE...HEAD`) and account for all affected production paths, including destination packages. Moving tests out of production files, generated output, formatting churn, and moving code elsewhere are not production-code deletion. Preserve readable code; no compressed formatting to hit a number.  Default for simplification work: net production reduction. A required behavior-preserving size split may be line-neutral. Growth needs an explicit, quantified explanation of the correctness or type guarantee it buys, why deletion/inlining cannot achieve it, and what old mechanism is removed; it is not automatically acceptable because ownership looks cleaner. If the only benefit is relocating fields or adding a wrapper, defer the change. Required regression tests and a minimal correctness fix are allowed to grow without inventing unrelated deletion to offset them.  ## Priority and scope gate  Priority: first
  **Post-Mortem & Fix Analysis**:
  > Fixed by #2994: an inline status probe no longer clears an outstanding command charge.

- **Issue #2935** (2026-09-25): **Refuse the XCTestDevices redirect when an Xcode xcrun shim (simctl or devicectl) has an armed first-launch hook: scoped simulator set deletion**
  *Symptoms*: ## Purpose  **Bug class: agent-device points `~/Library/Developer/XCTestDevices` at a user-owned simulator set while Apple's first-launch cleanup can run. That cleanup deletes every device in the user's set (data loss).**  Found while validating #2917 (see the #2878 evidence, "Live: scoped simulator set"). Reproduced on origin/main `dbc08a417a`, re-checked on `2db7c42a8b` and `6428c54853`. The code has not changed.  What happens (watcher log `2878b-watch.log`, request log `2878b-state-main/sessions/s2878bm/requests/*.ndjson`):  1. A cold `open com.apple.Preferences --ios-simulator-device-set <set> --udid <udid>` finds no cached runner (`runner_xctestrun_cache` `reason: missing_xctestrun`). It starts the runner `xcodebuild build-for-testing` inside `withXcodebuildSimulatorSetRedirect` (`packages/platform-apple/src/runner/runner-artifact.ts:475`), which calls `acquireXcodebuildSimulatorSetRedirect` (`runner-device-set.ts:68`). That call swaps `XCTestDevices` for a symlink to the user's set (`runner-device-set.ts:116-119`, `installDeviceSetRedirect` at `:164`). 2. At the same time, `open` runs `xcrun simctl --set <set> launch <udid> …`. `xcrun simctl` resolves to the Xcode shim `$DEVELOPER_DIR/usr/bin/simctl`, a bash script. The shim compares its hard-coded `EXPECTED_VERSION` (Xcode 26.2: `1051.17.7`) with the installed CoreSimulator `CFBundleVersion` (this host: `1155.4`). When they differ, the shim runs `xcodebuild -runFirstLaunch` before every simctl call. 3. `xcodebuild -run
  **Post-Mortem & Fix Analysis**:
  > ## Redesign: stop redirecting XCTestDevices and point xcodebuild at the scoped set directly  This supersedes the refusal design in this issue and in #2947.  **Finding.** xcodebuild honors the Xcode user default `DVTSimulatorSetLocation`, passed as the `-DVTSimulatorSetLocation=<set>` argument. It must be the `-Key=value` form; xcodebuild rejects the space-separated form as an invalid option. With it, xcodebuild resolves destinations in that CoreSimulator device set and runs tests there. The runner therefore no longer needs `~/Library/Developer/XCTestDevices`, and the data-loss path goes away instead of being detected.  **Evidence.** - Live, Xcode 26.2: `-showdestinations` lists the scoped devices. `-showBuildSettings -destination id=<scoped udid>` resolves the device only when the argument is present. `test-without-building` with the production runner flags reached `AGENT_DEVICE_RUNNER_LISTENER_READY`, and the runner process ran from `<set>/<udid>/data`. XCTestDevices was never touched

- **Issue #2890** (2026-09-25): **fix(ios-runner): app-launch policy is decided by the retry flag; querySelector launches a stopped app**
  *Symptoms*: ## Purpose  `CommandTraits.readOnly` is documented as one axis and consumed as several, so opting a command out of one decision silently opts it out of the others. `querySelector` is the live instance: it is deliberately not retried, and as a side effect it is no longer refused when its app is stopped, so it bare-launches the app instead of answering `APP_NOT_RUNNING`.  This issue separates app-launch policy from retry eligibility inside the existing exhaustive classification, and fixes the command's behavior.  Citations are at `f47e9c9ef4`.  ## Current behavior  - `RunnerTests+Models.swift:52-53` documents `readOnly` as "Whether the command is eligible for the session-invalidating retry". The struct comment at `:44-48` presents the table as three independent axes. - Five runner-side decisions read that one flag: retry (`RunnerTests+Lifecycle.swift:454`), the stopped-app refusal `notRunningReadResponse` (`:321-325`), activation routing (`RunnerTests+CommandDispatch.swift:445-451`), recorded-failure→session invalidation (`:536`, jointly with `isLifecycle`), and remembered-text-entry tap clearing (`RunnerTests+CommandExecution.swift:11`). - `querySelector` is classified `readOnly: .never` (`RunnerTests+Models.swift:116`, comment at `:114`). Because the refusal and the activation both read the retry bit, a `querySelector` whose target app is `.notRunning` skips `notRunningReadResponse` and reaches `activateTarget(bundleId:reason:"bundle_changed")` at `CommandDispatch.swift:451`.

- **Issue #2866** (2026-09-24): **A selector read right after `wait text` can answer from the tree captured before the screen changed**
  *Symptoms*: ## Problem  A selector read (`get`, `is`) issued right after a `wait text` can answer from the tree captured **before** the screen changed, and report `Selector did not match` for an element the wait has just observed.  Mechanism (`src/commands/interaction/runtime/wait-text.ts`, `src/daemon/selector-capture-runtime.ts`):  1. Each `wait text` poll calls the owner's native `findText` first and captures the tree only on a miss. The capture is stored on the session (`session.snapshot`). 2. The screen changes during the 300 ms poll sleep. The next poll's `findText` hits, and the wait succeeds without a new capture. 3. The next `get`/`is` runs less than 750 ms after the miss capture, so `reusableSessionSnapshot` serves the stored pre-navigation tree. The request completes in about 1 ms with no capture.  Nothing retires the stored tree when a native read observes the device after it.  ## Evidence  - `smoke:automation-input` failed locally 3/5 at `get text id="automation-event-name"` (74 ms, `COMMAND_FAILED`, request log: `request_start` then `request_failed` 1 ms later, no capture). The preceding `wait` took 585 ms: findText miss, capture, sleep, findText hit. - Minimal live repro on an iOS 26.2 simulator (fixture app): relaunch home, start `wait text "Automation lab"`, the app opens the deep link 0.4-1.3 s later, then `get text id="automation-event-name"`: **8/12 failures** on origin/main.  ## Required behavior  A native observation retires the stored tree from the session-snapshot

- **Issue #2799** (2026-09-23): **fix(macos): reject --fullscreen for macOS desktop/menubar helper surfaces**
  *Symptoms*: ## Decision **Reject `--fullscreen` for macOS desktop and menubar surfaces, and keep it for macOS app sessions.** This decision was cross-checked with a second model and against the code at `01328de411`.  ## Facts - The macOS helper reads only non-app surfaces: see `usesMacOsHelperSurface` / `usesMacOsSurfaceScreenshot` in `packages/platform-apple/src/interactor.ts:417-425`. App sessions go through the runner, which handles `--fullscreen` correctly by choosing between the full display and the app window (`apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+CommandExecution.swift:2058`). Don't change that path. - For desktop and menubar surfaces, the helper parses `--fullscreen` (`apple/macos-helper/Sources/AgentDeviceMacOSHelper/main.swift:439`), ignores it (`:550-551` `_ = fullscreen`), always captures the **main display** (`:557-566`), and echoes the flag back (`:441`, `ScreenshotResponse.fullscreen` at `:78`). TS sends the flag (`packages/platform-apple/src/os/macos/helper.ts:476-485`) and reports it (`core/screenshot.ts:157,169,234`). - This has been the behavior since #311 (876f091c00, v0.11.2).  ## Required behavior - On macOS, a `screenshot` with an explicit `fullscreen` and `surface` set to `desktop` or `menubar` fails with `INVALID_ARGS`, saying these surfaces always capture the main display. It fails before any capture. Without `fullscreen`, the behavior is unchanged. - macOS app sessions and every other platform keep accepting `--fullscreen` unchang

- **Issue #2796** (2026-09-24): **fix(ios): runtime clang builds must not use -Werror; cache the fold helper build**
  *Symptoms*: ## Purpose Two runtime clang builds compile with `-Werror`: `packages/platform-apple/src/snapshot-source/cache.ts:101` (the AX bridge) and `packages/platform-apple/src/foldable/simulator-hid.ts:28` (fold). A new warning in a future Xcode SDK would break these features on users' machines. The code itself hasn't changed, and users can't fix it.  Fold also recompiles `apple/fold-helper/Fold.m` into a temp directory on every fold call (`simulator-hid.ts:19-38`; the temp directory is deleted at `:66-68`). The bridge already has a content-hashed, locked build cache (`cache.ts:53-78`).  Line references are at `01328de411`.  ## Required behavior - Runtime builds do not use `-Werror`. Warnings still fail the repo's own CI checks, if such a check exists or is added. Record which one in the PR. - The fold helper is built through the same cache mechanism as the bridge. The cache key includes the source hash and the toolchain identity (`cache.ts:54,138`), so switching `DEVELOPER_DIR` never serves a stale binary.  ## Completion conditions - Unit tests assert that neither argv contains `-Werror`, and that a second fold call does not invoke clang. - `pnpm check:affected --run` is green. 

- **Issue #2789** (2026-09-23): **fix(ios): visionOS taps request synthesis the runner cannot perform**
  *Symptoms*: ## Purpose `isIosFamily` (`packages/kernel/src/device.ts:110-112`) includes visionOS, so the daemon sends `synthesized: true` for visionOS taps (`packages/platform-apple/src/interactions.ts:394-396`, `runner/runner-sequence.ts:219`). The runner synthesizes only under `#if os(iOS)`. The `#else` branch (`apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SynthesizedInteraction.swift:154-158`) returns "not supported on macOS" and falls back to XCTest. Every visionOS tap therefore pays for a failed synthesis attempt and reports a misleading fallback diagnostic.  Line references are at `01328de411`.  ## Required behavior Choose the smaller of these: - (a) The daemon sends `synthesized` only for platforms where the runner synthesizes (iOS and iPadOS), using a named predicate, not `isIosFamily`. - (b) The runner's non-iOS branch names the actual OS and returns unsupported without a diagnostic.  Prefer (a).  ## Completion conditions - A unit test asserts that a visionOS tap command has no `synthesized: true`. - `pnpm check:affected --run` is green. 

- **Issue #2788** (2026-09-24): **fix(ios-runner): one synthesize-then-XCTest-fallback helper; align sequence tap with standalone tap**
  *Symptoms*: ## Purpose A synthesized tap step inside a `sequence` and a standalone synthesized coordinate `tap` behave differently when synthesis fails. Paths are under `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/`; line references are at `01328de411`. - **Sequence step:** `RunnerTests+SequenceExecution.swift:149-189` uses the `.synthesizedDrag` policy. When accessibility is unavailable, the policy (`RunnerTests+SynthesizedGesturePolicy.swift:106-110`) blocks the XCTest fallback. When the coordinate context is nil, the step returns `unsupported`. - **Standalone tap:** `RunnerTests+CommandExecution.swift:1789-1808` uses `.coordinateTap` (`xctestCoordinateAllowed`) and always falls back.  The comment at `RunnerTests+SequenceExecution.swift:146` says the sequence step mirrors the individual tap command, but it does not. The same "synthesize, log the policy, fall back to XCTest" block appears five times: selector tap, coordinate tap, sequence step, type-focus, and drag. Two enums with three cases each (`RunnerTests+SynthesizedGesturePolicy.swift:15-47`) encode the policy. `.whenAccessibilityHealthy` is used only by a test (`:199`).  ## Required behavior - One helper performs "synthesized gesture, then XCTest coordinate fallback if the policy allows it". All five sites use it. Site-specific bookkeeping (text-entry tap memory, keyboard probes) stays at the call site. - A tap step inside a sequence uses the same policy kind as a standalone coordinate tap (`.coordinateTap`), and beh

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

### Incident Patch 1: `0aeaba7b` (2026-09-30)
**Commit Message**: fix(provider-webdriver): never resend a mutating WebDriver request (#3070)

* test(provider-webdriver): prove mutating WebDriver routes get resent today

A tap, a key send, and a back navigation each resend their mutating request
when it times out, because the transport's default retry policy treats a
timeout as retriable for every route alike, mutations included. Characterizes
the bug through the real WebDriverClient/interactor before it is fixed.

* fix(provider-webdriver): never resend a mutating WebDriver request

Every mutating route (actions, keys, back, orientation/rotation, app
lifecycle, install, delete-session, and the mutating mobile: scripts) now
gets exactly one attempt via a named MUTATION_REQUEST_POLICY, instead of
inheriting the transport's default one-retry budget meant for idempotent
reads. A resend after a timeout or a 5xx cannot tell whether the first
attempt's side effect already landed, so retrying risked a doubled tap, key
send, or navigation.

The transport also now classifies every failed request's outcome via
details.dispatched: 'unknown' for a timeout or a >=500 answer (the driver
may have started or finished the mutation), and 'no' for a connection
refus

**File**: `packages/provider-webdriver/package.json` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
   "dependencies": {
     "@agent-device/capture-kit": "workspace:*",
     "@agent-device/contracts": "workspace:*",
+    "@agent-device/host-kit": "workspace:*",
     "@agent-device/kernel": "workspace:*",
     "@agent-device/xml": "workspace:*"
   },
```

**File**: `packages/provider-webdriver/src/webdriver-client.ts` (modified, +45/-39)
```diff
@@ -1,6 +1,8 @@
 import fs from 'node:fs/promises';
 import { AppError } from '@agent-device/kernel/errors';
 import {
+  emitWebDriverDiagnostic,
+  isWebDriverRouteUnsupported,
   WebDriverTransport,
   type WebDriverAuth,
   type WebDriverRequestOverrides,
@@ -92,17 +94,13 @@ export class WebDriverClient {
       'POST',
       '/session',
       { capabilities: normalizeCapabilities(capabilities) },
-      {
-        retryAttempts: 0,
-        timeoutMs: budgetWithin(this.sessionCreateTimeoutMs, options?.deadline),
-      },
+      { timeoutMs: budgetWithin(this.sessionCreateTimeoutMs, options?.deadline) },
     );
     const session = readSession(value);
     this.sessionId = session.sessionId;
     return session;
   }
 
-  // fallow-ignore-next-line unused-class-member
   async deleteSession(): Promise<void> {
     const sessionId = this.requireSessionId();
     await this.requestValue('DELETE', `/session/${sessionId}`);
@@ -114,18 +112,36 @@ export class WebDriverClient {
   }
 
   async activateApp(appId: string): Promise<void> {
-    try {
-      await this.sessionRequest('POST', '/appium/device/activate_app', { appId });
-    } catch {
-      await this.executeScript('mobile: activateApp', [{ appId, bundleId: appId }]);
-    }
+    await this.appRouteWithSibling('/appium/device/activate_app', 'mobile: activateApp', appId);
   }
 
   async terminateApp(appId: string): Promise<void> {
+    await this.appRouteWithSibling('/appium/device/terminate_app', 'mobile: terminateApp', appId);
+  }
+
+  /**
+   * Sends the Appium app route, and the `mobile:` sibling script only when the driver answered
+   * that it does not implement the first route.
+   */
+  private async appRouteWithSibling(
+    route: string,
+    siblingScript: string,
+    appId: string,
+  ): Promise<void> {
     try {
-      await this.sessionRequest('POST', '/appium/device/terminate_app', { appId });
-    } catch {
-      await this.executeScript('mobile: terminateApp', [{ appId, bundleId: appId }]);
+      await this.sessionRequest('POST', route, { appId });
+    } catch (error) {
+      if (!isWebDriverRouteUnsupported(error)) throw error;
+      const { status } = await this.transport.request(
+        'POST',
+        `/session/${this.requireSessionId()}/execute/sync`,
+        { script: siblingScript, args: [{ appId, bundleId: appId }] },
+      );
+      emitWebDriverDiagnostic('webdriver_route_fallback', {
+        from: route,
+        to: siblingScript,
+        status,
+      });
     }
   }
 
@@ -134,17 +150,15 @@ export class WebDriverClient {
   }
 
   async releaseActions(): Promise<void> {
-    await this.sessionRequest('DELETE', '/actions', undefined, { retryAttempts: 0 });
+    await this.sessionRequest('DELETE', '/actions');
   }
 
   async sendKeys(text: string): Promise<void> {
     await this.sessionRequest('POST', '/keys', { value: Array.from(text) });
   }
 
   async hideKeyboard(): Promise<void> {
-    await this.sessionRequest('POST', '/appium/device/hide_keyboard', undefined, {
-      retryAttempts: 0,
-    });
+    await this.sessionRequest('POST', '/appium/device/hide_keyboard');
   }
 
   /**
@@ -167,7 +181,7 @@ export class WebDriverClient {
         ...(timeoutMs === undefined ? {} : { timeoutMs }),
       });
     } catch (error) {
-      if (isUnimplementedWebDriverRoute(error)) return 'unsupported';
+      if (isWebDriverRouteUnsupported(error)) return 'unsupported';
       throw error;
     }
     return typeof value === 'boolean' ? value : 'unsupported';
@@ -207,7 +221,7 @@ export class WebDriverClient {
         await this.sessionRequest('GET', '/element/active', undefined, requestBudget(deadline)),
       );
     } catch (error) {
-      if (isUnimplementedWebDriverRoute(error)) return 'unsupported';
+      if (isWebDriverRouteUnsupported(error)) return 'unsupported';
       if (isNoSuchElementError(error)) return 'none';
       throw error;
     }
@@ -221,7 +235,7 @@ export class WebDriverClient {
       );
     
```

**File**: `packages/provider-webdriver/src/webdriver-interactor.ts` (modified, +1/-1)
```diff
@@ -363,7 +363,7 @@ class WebDriverInteractor implements Interactor {
 
   async readClipboard(): Promise<string> {
     this.requireSupport('clipboard.read');
-    const value = await this.client.executeScript('mobile: getClipboard', [{}]);
+    const value = await this.client.executeReadScript('mobile: getClipboard', [{}]);
     return typeof value === 'string' ? value : '';
   }
 
```

**File**: `packages/provider-webdriver/src/webdriver-mutation-resend.test.ts` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import path from 'node:path';
+import { afterEach, test, vi } from 'vitest';
+import { withDiagnosticsScope } from '@agent-device/host-kit/diagnostics';
+import { AppError } from '@agent-device/kernel/errors';
+import { createCloudWebDriverCapabilities } from './capabilities.ts';
+import { mkdtempForTest } from './tmp-dir.fixtures.ts';
+import { WebDriverClient } from './webdriver-client.ts';
+import { createWebDriverInteractor } from './webdriver-interactor.ts';
+
+const realFetch = globalThis.fetch;
+
+afterEach(() => {
+  globalThis.fetch = realFetch;
+});
+
+/**
+ * The route a request addresses: the `mobile:` script name for `POST .../execute/sync`, otherwise
+ * the method and path with the session id replaced by `:id`.
+ */
+function routeOf(input: Parameters<typeof fetch>[0], init?: RequestInit): string {
+  const url = new URL(input instanceof Request ? input.url : String(input));
+  const method = init?.method ?? 'GET';
+  const pathname = url.pathname
+    .replace(/^\/wd\/hub/, '')
+    .replace(/^\/session\/wd-1/, '/session/:id');
+  if (pathname.endsWith('/execute/sync') && typeof init?.body === 'string') {
+    return (JSON.parse(init.body) as { script: string }).script;
+  }
+  return `${method} ${pathname}`;
+}
+
+/**
+ * A grid that never answers `hangRoute` until the transport's own timeout aborts it, answers
+ * `unsupportedRoute` with a W3C 404, and answers every other route immediately. A hung request is
+ * the shape a slow driver takes on a real provider: it received the request and is still working
+ * on it.
+ */
+function hangingWebDriverFetch(
+  hangRoute: string,
+  unsupportedRoute?: string,
+  unsupportedErrorCode = 'unknown command',
+): { fetch: typeof globalThis.fetch; sendsTo: (route: string) => number } {
+  const routes: string[] = [];
+  const fetch: typeof globalThis.fetch = async (input, init) => {
+    const route = routeOf(input, init);
+    routes.push(route);
+    if (route === hangRoute) {
+      return await new Promise<Response>((_resolve, reject) => {
+        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error));
+      });
+    }
+    if (route === 'POST /session') {
+      return Response.json({ value: { sessionId: 'wd-1', capabilities: {} } });
+    }
+    if (route === unsupportedRoute) {
+      return Response.json(
+        { value: { error: unsupportedErrorCode, message: 'refused' } },
+        { status: 404 },
+      );
+    }
+    return Response.json({ value: null });
+  };
+  return { fetch, sendsTo: (route) => routes.filter((sent) => sent === route).length };
+}
+
+/**
+ * A real `WebDriverClient` and `createWebDriverInteractor` over the hanging grid. The default
+ * transport policy retries once, so a request that is resent shows two sends.
+ */
+async function connectedWebDriverInteractor(options: {
+  hangRoute: string;
+  unsupportedRoute?: string;
+  unsupportedErrorCode?: string;
+  createSession?: boolean;
+}) {
+  const { fetch, sendsTo } = hangingWebDriverFetch(
+    options.hangRoute,
+    options.unsupportedRoute,
+    options.unsupportedErrorCode,
+  );
+  globalThis.fetch = fetch;
+  const client = new WebDriverClient({
+    clientVersion: '0.0.0-test',
+    endpoint: 'http://cloud-webdriver.test/wd/hub/',
+    requestPolicy: { timeoutMs: 20, retryDelayMs: 5, sessionCreateTimeoutMs: 20 },
+  });
+  if (options.createSession !== false) await client.createSession({ platformName: 'Android' });
+  const interactor = createWebDriverInteractor({
+    client,
+    backend: 'android',
+    capabilities: createCloudWebDriverCapabilities({
+      provider: 'test',
+      platform: 'android',
+      overrides: {
+        home: 'supported',
+        'clipboard.read': 'supported',
+        'clipboard.write': 'supported',
+      },
+    }),
+  });
+  return { client, interactor, sendsTo };
+}
+
+type Connected = Awaited<ReturnType<typeof connectedWebD
```

**File**: `packages/provider-webdriver/src/webdriver-orientation.test.ts` (modified, +55/-23)
```diff
@@ -1,21 +1,49 @@
-import { test } from 'vitest';
+import { afterEach, test } from 'vitest';
 import assert from 'node:assert/strict';
 
 import { AppError } from '@agent-device/kernel/errors';
 import type { WebDriverClient } from './webdriver-client.ts';
 import { setWebDriverOrientation } from './webdriver-orientation.ts';
+import { WebDriverTransport } from './webdriver-transport.ts';
 
 type Call = { method: string; args: unknown[] };
 
-/** A driver answering "I do not implement this route" — the only case that earns a fallback. */
-function unsupportedEndpointError(): AppError {
-  return new AppError('COMMAND_FAILED', 'Unknown command', {
-    status: 404,
-    response: { value: { error: 'unknown command' } },
+const realFetch = globalThis.fetch;
+
+afterEach(() => {
+  globalThis.fetch = realFetch;
+});
+
+/** The error the real transport raises for this driver answer. */
+async function driverAnswerError(driver: typeof globalThis.fetch): Promise<unknown> {
+  const transport = new WebDriverTransport({
+    clientVersion: '0.0.0-test',
+    endpoint: 'http://cloud-webdriver.test/wd/hub/',
+    requestPolicy: { timeoutMs: 20 },
   });
+  globalThis.fetch = driver;
+  try {
+    await transport.requestValue('POST', '/session/wd-1/rotation', {});
+  } catch (error) {
+    return error;
+  } finally {
+    globalThis.fetch = realFetch;
+  }
+  throw new Error('the driver answer did not fail');
+}
+
+function answer(status: number, body: unknown): () => Promise<unknown> {
+  return () => driverAnswerError(async () => Response.json(body, { status }));
 }
 
-function makeClient(options: { reject?: readonly string[]; rejectWith?: () => unknown } = {}): {
+/** A driver answering "I do not implement this route" — the only case that earns a fallback. */
+const unsupportedEndpointError = answer(404, {
+  value: { error: 'unknown command', message: 'Unknown command' },
+});
+
+function makeClient(
+  options: { reject?: readonly string[]; rejectWith?: () => Promise<unknown> } = {},
+): {
   client: WebDriverClient;
   calls: Call[];
 } {
@@ -25,7 +53,7 @@ function makeClient(options: { reject?: readonly string[]; rejectWith?: () => un
   const record = (method: string) => {
     return async (...args: unknown[]): Promise<void> => {
       calls.push({ method, args });
-      if (reject.has(method)) throw rejectWith();
+      if (reject.has(method)) throw await rejectWith();
     };
   };
   return {
@@ -84,40 +112,44 @@ test('a driver rejecting /rotation degrades to the two-way endpoint', async () =
 // A transport that fails for any reason other than "not implemented" must surface as itself. The
 // earlier implementation caught everything, so a timeout or an expired session was reported as an
 // orientation-support problem with the real cause discarded.
-const NON_FALLBACK_FAILURES: readonly { name: string; error: () => unknown }[] = [
+const NON_FALLBACK_FAILURES: readonly { name: string; error: () => Promise<unknown> }[] = [
   {
     name: 'a request timeout',
-    error: () => Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }),
+    error: () =>
+      driverAnswerError(
+        async (_input, init) =>
+          await new Promise<Response>((_resolve, reject) => {
+            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error));
+          }),
+      ),
   },
   {
     name: 'an auth rejection',
-    error: () => new AppError('COMMAND_FAILED', 'Forbidden', { status: 403 }),
+    error: answer(403, { value: { error: 'unable to set cookie', message: 'Forbidden' } }),
   },
   {
     name: 'a provider 5xx',
-    error: () => new AppError('COMMAND_FAILED', 'Bad gateway', { status: 502 }),
+    error: answer(502, { value: { error: 'unknown error', message: 'Bad gateway' } }),
   },
   {
     name: 'a dead session',
-    error: () => new AppError('SESSION_NOT_FOUND', 'WebDriver session has not been created yet.'),
+    error: async () =>
+      new AppError('SESSION_NOT
```

---

### Incident Patch 2: `999a38b5` (2026-09-30)
**Commit Message**: fix(daemon-client): classify endpoint-unavailable errors by typed reason (#3068)

* fix(daemon-client): classify endpoint-unavailable errors by typed reason

* test(daemon-client): move classifier and cover the producer route

* test(daemon-client): name the catch parameter error

**File**: `src/daemon-client/__tests__/daemon-client-transport.test.ts` (modified, +32/-1)
```diff
@@ -8,7 +8,11 @@ import {
   DAEMON_RPC_PROTOCOL_VERSION,
 } from '@agent-device/contracts/daemon-http';
 import { sendToDaemon } from '../daemon-client.ts';
-import { sendRequest } from '../daemon-client-transport.ts';
+import {
+  canConnect,
+  isDaemonTransportUnavailableError,
+  sendRequest,
+} from '../daemon-client-transport.ts';
 import { resolveDaemonPaths } from '../../daemon-resolution.ts';
 import { createDaemonProxyServer } from '../../remote/daemon-proxy.ts';
 import {
@@ -381,3 +385,30 @@ test('proxy forwards cached upstream identity and rejects a restarted upstream b
     await closeLoopbackServer(upstream);
   }
 });
+
+test('an endpoint missing for the requested transport rejects with a typed reason the classifier accepts', async () => {
+  const socketOnly = { port: 1, token: 't', pid: 1 };
+  const error = await canConnect(socketOnly, 'http').then(
+    () => undefined,
+    (error: unknown) => error,
+  );
+  assert.ok(error instanceof AppError);
+  assert.equal(error.details?.reason, 'daemon_endpoint_unavailable');
+  assert.equal(error.details?.transport, 'http');
+  assert.equal(isDaemonTransportUnavailableError(error), true);
+});
+
+test('the classifier ignores message text', () => {
+  assert.equal(
+    isDaemonTransportUnavailableError(
+      new AppError('COMMAND_FAILED', 'Daemon HTTP endpoint is unavailable'),
+    ),
+    false,
+  );
+  assert.equal(
+    isDaemonTransportUnavailableError(
+      new AppError('COMMAND_FAILED', 'reworded', { reason: 'daemon_endpoint_unavailable' }),
+    ),
+    true,
+  );
+});
```

**File**: `src/daemon-client/daemon-client-lifecycle.ts` (modified, +1/-11)
```diff
@@ -45,8 +45,7 @@ import {
 import {
   canConnect,
   cachedRemoteDaemonHealth,
-  DAEMON_HTTP_ENDPOINT_UNAVAILABLE_MESSAGE,
-  DAEMON_SOCKET_ENDPOINT_UNAVAILABLE_MESSAGE,
+  isDaemonTransportUnavailableError,
 } from './daemon-client-transport.ts';
 
 export type DaemonClientSettings = {
@@ -277,15 +276,6 @@ async function canConnectReusableDaemon(
   }
 }
 
-function isDaemonTransportUnavailableError(error: unknown): boolean {
-  return (
-    error instanceof AppError &&
-    error.code === 'COMMAND_FAILED' &&
-    (error.message === DAEMON_HTTP_ENDPOINT_UNAVAILABLE_MESSAGE ||
-      error.message === DAEMON_SOCKET_ENDPOINT_UNAVAILABLE_MESSAGE)
-  );
-}
-
 function newerDaemonRefusedError(
   info: DaemonInfo,
   decision: Extract<DaemonTakeoverDecision, { kind: 'refuseNewer' }>,
```

**File**: `src/daemon-client/daemon-client-transport.ts` (modified, +22/-10)
```diff
@@ -30,8 +30,25 @@ type SendRequestOptions = {
 
 const LOCAL_DAEMON_HEALTHCHECK_TIMEOUT_MS = 500;
 const REMOTE_DAEMON_HEALTHCHECK_TIMEOUT_MS = 3000;
-export const DAEMON_HTTP_ENDPOINT_UNAVAILABLE_MESSAGE = 'Daemon HTTP endpoint is unavailable';
-export const DAEMON_SOCKET_ENDPOINT_UNAVAILABLE_MESSAGE = 'Daemon socket endpoint is unavailable';
+const DAEMON_ENDPOINT_UNAVAILABLE_REASON = 'daemon_endpoint_unavailable';
+
+export function isDaemonTransportUnavailableError(error: unknown): boolean {
+  return (
+    error instanceof AppError &&
+    error.code === 'COMMAND_FAILED' &&
+    error.details?.reason === DAEMON_ENDPOINT_UNAVAILABLE_REASON
+  );
+}
+
+function daemonEndpointUnavailableError(transport: ResolvedDaemonTransport): AppError {
+  return new AppError(
+    'COMMAND_FAILED',
+    transport === 'http'
+      ? 'Daemon HTTP endpoint is unavailable'
+      : 'Daemon socket endpoint is unavailable',
+    { reason: DAEMON_ENDPOINT_UNAVAILABLE_REASON, transport },
+  );
+}
 
 export type RemoteDaemonHealth = {
   reachable: boolean;
@@ -394,12 +411,7 @@ function requireDaemonTransport(
   transport: ResolvedDaemonTransport,
 ): ResolvedDaemonTransport {
   if (hasDaemonTransport(info, transport)) return transport;
-  throw new AppError(
-    'COMMAND_FAILED',
-    transport === 'http'
-      ? DAEMON_HTTP_ENDPOINT_UNAVAILABLE_MESSAGE
-      : DAEMON_SOCKET_ENDPOINT_UNAVAILABLE_MESSAGE,
-  );
+  throw daemonEndpointUnavailableError(transport);
 }
 
 function handleTransportError(
@@ -439,7 +451,7 @@ async function sendSocketRequest(
   options: SendRequestOptions,
 ): Promise<DaemonResponse> {
   const port = info.port;
-  if (!port) throw new AppError('COMMAND_FAILED', DAEMON_SOCKET_ENDPOINT_UNAVAILABLE_MESSAGE);
+  if (!port) throw daemonEndpointUnavailableError('socket');
   return new Promise((resolve, reject) => {
     let requestWritten = false;
     const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
@@ -540,7 +552,7 @@ async function sendHttpRequest(
     : info.httpPort
       ? new URL(`http://127.0.0.1:${info.httpPort}/rpc`)
       : null;
-  if (!rpcUrl) throw new AppError('COMMAND_FAILED', DAEMON_HTTP_ENDPOINT_UNAVAILABLE_MESSAGE);
+  if (!rpcUrl) throw daemonEndpointUnavailableError('http');
   const rpcPayload = JSON.stringify(buildHttpRpcPayload(req, { includeTokenParam: !info.baseUrl }));
   const headers: Record<string, string | number> = {
     'content-type': 'application/json',
```

---

### Incident Patch 3: `eb51a880` (2026-09-30)
**Commit Message**: fix(android): wait out a device-offline refusal and retry once (#3055)

* fix(android): wait out a device-offline refusal and retry once

An emulator drops to offline for a few seconds after boot while adbd
restarts. adb refuses commands on the host side then, so a helper
install could fail with 'adb: device offline'. The device-scoped
executor now waits for the device and runs the command once more.

The wait and retry stay inside the caller's timeoutMs (wait gets at
most half, 15s cap). A device that stays offline through its wait
fails fast for 30s instead of making every call wait.

* fix(android): retry only the bare host refusal, inside the remaining budget

- match only stderr that is exactly adb's device-offline refusal, empty
  stdout, no timeout, so device output never triggers a rerun
- wait takes half of the remaining budget; no budget left, refusal stands
- wait uses the command's adb server and env
- timeouts and cancels keep the stayed-offline mark
- key the mark by adb server and serial

* test(android): prove the offline retry gets only the budget the wait left

The wait stub now moves the clock 1500 ms, so the retry must get 4000 - 1500 ms;
a retry given the calle

**File**: `packages/platform-android/src/__tests__/adb-executor.test.ts` (modified, +12/-9)
```diff
@@ -495,16 +495,17 @@ test('the local adb executor attaches classified hints to thrown command failure
   assert.equal(Object.hasOwn(error.details ?? {}, 'retriable'), false);
 });
 
-test('the local adb executor flags transient transport failures retriable', async () => {
+test('the local adb executor flags a device that stays offline retriable', async () => {
   mockRunCmd.mockClear();
-  mockRunCmd.mockRejectedValueOnce(
-    new AppError('COMMAND_FAILED', 'adb exited with code 1', {
-      exitCode: 1,
-      stdout: '',
-      stderr: 'adb: device offline',
-      processExitError: true,
-    }),
-  );
+  const offline = new AppError('COMMAND_FAILED', 'adb exited with code 1', {
+    exitCode: 1,
+    stdout: '',
+    stderr: 'adb: device offline',
+    processExitError: true,
+  });
+  mockRunCmd.mockRejectedValueOnce(offline);
+  mockRunCmd.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
+  mockRunCmd.mockRejectedValueOnce(offline);
   const adb = createDeviceAdbExecutor({
     platform: 'android',
     id: 'emulator-5554',
@@ -521,6 +522,8 @@ test('the local adb executor flags transient transport failures retriable', asyn
   assert.ok(error instanceof AppError);
   assert.equal(error.details?.adbFailure, 'device_offline');
   assert.equal(error.details?.retriable, true);
+  assert.equal(mockRunCmd.mock.calls.length, 3);
+  assert.ok(mockRunCmd.mock.calls[1]?.[1].includes('wait-for-device'));
 });
 
 test('the local adb executor classifies exec-layer timeouts as a wedged adb server', async () => {
```

**File**: `packages/platform-android/src/adb-failure.test.ts` (modified, +32/-0)
```diff
@@ -23,6 +23,38 @@ test('ADB failure classification keeps transport on stderr and install verdicts
   );
 });
 
+test('only the bare host adb device-offline refusal is classified as a host refusal', () => {
+  for (const stderr of ['adb: device offline\n', "error: device 'emulator-5554' offline"]) {
+    assert.deepEqual(classifyAndroidAdbFailure(stderr), {
+      reason: 'device_offline',
+      hint: classifyAndroidAdbFailure('device offline')?.hint,
+      retriable: true,
+      hostRefusal: true,
+    });
+  }
+  for (const [stderr, stdout] of [
+    ['adb: device offline', 'partial'],
+    ['flash: device offline, giving up', ''],
+  ] as const) {
+    const failure = classifyAndroidAdbFailure(stderr, stdout);
+    assert.equal(failure?.reason, 'device_offline');
+    assert.equal(failure?.hostRefusal, undefined);
+  }
+
+  const refused = attachAdbFailureHint(
+    new AppError('COMMAND_FAILED', 'adb exited with code 1', { stderr: 'adb: device offline' }),
+  );
+  assert.equal(refused.details?.adbHostRefusal, true);
+  const timedOut = attachAdbFailureHint(
+    new AppError('COMMAND_FAILED', 'adb timed out after 10ms', {
+      stderr: 'adb: device offline',
+      timeoutMs: 10,
+    }),
+  );
+  assert.equal(timedOut.details?.adbFailure, 'timeout');
+  assert.equal(Object.hasOwn(timedOut.details ?? {}, 'adbHostRefusal'), false);
+});
+
 test('ADB discovery classifies transport failures from stderr without trusting stdout', () => {
   const stdoutOnly = androidDiscoveryCommandError(
     'adb devices failed',
```

**File**: `packages/platform-android/src/adb-failure.ts` (modified, +23/-9)
```diff
@@ -16,6 +16,8 @@ export type AndroidAdbFailureClassification = Readonly<{
   reason: AndroidAdbFailureReason;
   hint: string;
   retriable?: boolean;
+  /** The host adb refused the command before it reached the device, so it had no effect there. */
+  hostRefusal?: true;
 }>;
 
 type AndroidAdbFailureMatcher = readonly [
@@ -24,6 +26,20 @@ type AndroidAdbFailureMatcher = readonly [
   matchStdout?: true,
 ];
 
+const ANDROID_ADB_DEVICE_OFFLINE_FAILURE = {
+  reason: 'device_offline',
+  hint: 'The device is connected but offline — wait for it to finish booting or run adb reconnect, then retry.',
+  retriable: true,
+} as const satisfies AndroidAdbFailureClassification;
+
+/** The entire stderr, lowercased, of a command the host adb refused because the device was offline. */
+const ADB_DEVICE_OFFLINE_HOST_REFUSAL = /^(?:adb|error): device (?:'[^']*' )?offline$/;
+
+const ANDROID_ADB_DEVICE_OFFLINE_HOST_REFUSAL: AndroidAdbFailureClassification = Object.freeze({
+  ...ANDROID_ADB_DEVICE_OFFLINE_FAILURE,
+  hostRefusal: true,
+});
+
 const ANDROID_ADB_FAILURE_MATCHERS = [
   [
     /device unauthorized|device still authorizing/,
@@ -32,14 +48,7 @@ const ANDROID_ADB_FAILURE_MATCHERS = [
       hint: 'USB debugging is not authorized — accept the authorization prompt on the device screen (re-plug the cable if none appears), then retry.',
     },
   ],
-  [
-    /device offline/,
-    {
-      reason: 'device_offline',
-      hint: 'The device is connected but offline — wait for it to finish booting or run adb reconnect, then retry.',
-      retriable: true,
-    },
-  ],
+  [/device offline/, ANDROID_ADB_DEVICE_OFFLINE_FAILURE],
   [
     /more than one (?:device\/emulator|device and emulator)/,
     {
@@ -126,6 +135,9 @@ export function classifyAndroidAdbFailure(
 ): AndroidAdbFailureClassification | undefined {
   const stderrText = stderr.toLowerCase();
   const stdoutText = stdout.toLowerCase();
+  if (stdoutText === '' && ADB_DEVICE_OFFLINE_HOST_REFUSAL.test(stderrText.trim())) {
+    return ANDROID_ADB_DEVICE_OFFLINE_HOST_REFUSAL;
+  }
   for (const [pattern, classification, matchStdout] of ANDROID_ADB_FAILURE_MATCHERS) {
     if (pattern.test(stderrText) || (matchStdout && pattern.test(stdoutText))) {
       return classification;
@@ -141,7 +153,8 @@ import type { AndroidAdbExecutorResult } from './adb-transport.ts';
 
 /**
  * Enriches a failed adb command error in place with the classified hint,
- * `retriable` flag, and machine-readable `adbFailure` family, so every adb call
+ * `retriable` flag, machine-readable `adbFailure` family, and `adbHostRefusal` when the host adb
+ * refused the command before it reached the device, so every adb call
  * site surfaces guidance without per-site classification. Exec-layer timeouts
  * classify as `timeout` even though they leave no stderr. No-op for errors that
  * are not adb command failures or that carry no recognized failure signal; an
@@ -154,6 +167,7 @@ export function attachAdbFailureHint<T>(error: T): T {
   error.details = {
     ...error.details,
     adbFailure: classification.reason,
+    ...(classification.hostRefusal ? { adbHostRefusal: true } : {}),
     ...(typeof error.details?.hint === 'string' ? {} : { hint: classification.hint }),
     ...(classification.retriable !== undefined && error.details?.retriable === undefined
       ? { retriable: classification.retriable }
```

**File**: `packages/platform-android/src/adb-provider-scope.test.ts` (modified, +244/-1)
```diff
@@ -1,9 +1,11 @@
-import { expect, test } from 'vitest';
+import { expect, onTestFinished, test, vi } from 'vitest';
+import { AppError } from '@agent-device/kernel/errors';
 import type { DeviceInfo } from '@agent-device/kernel/device';
 import { deviceShellArgv } from '@agent-device/kernel/device-shell';
 import { bindAndroidAdbHostStub } from './adb-host.fixtures.ts';
 import {
   createLocalAndroidAdbProvider,
+  createStayedOfflineDevices,
   createDeviceAdbExecutor,
   resolveAndroidAdbExecutor,
   resolveAndroidAdbProvider,
@@ -108,6 +110,225 @@ test('outside any scope, resolution falls back to host adb for the device serial
   ]);
 });
 
+/** Whether a host call is the readiness wait adb models as addressing, not as a command. */
+function isWaitForDevice(invocation: AndroidAdbInvocation): boolean {
+  return invokedArgv(invocation).includes('wait-for-device');
+}
+
+test('a command adb refused as device offline waits for the device and runs once more', async () => {
+  const calls: Array<{ args: string[]; timeoutMs?: number }> = [];
+  let offline = true;
+  bindAndroidAdbHostStub({
+    execAdb: async (invocation, options) => {
+      calls.push({ args: invokedArgv(invocation), timeoutMs: options?.timeoutMs });
+      if (isWaitForDevice(invocation)) {
+        offline = false;
+        return ok();
+      }
+      return offline
+        ? { exitCode: 1, stdout: '', stderr: 'adb: device offline' }
+        : { exitCode: 0, stdout: 'installed', stderr: '' };
+    },
+  });
+
+  const result = await createDeviceAdbExecutor(DEVICE)(['install', '-r', 'helper.apk'], {
+    allowFailure: true,
+  });
+
+  expect(result).toEqual({ exitCode: 0, stdout: 'installed', stderr: '' });
+  expect(calls).toEqual([
+    { args: ['-s', 'emulator-5554', 'install', '-r', 'helper.apk'], timeoutMs: undefined },
+    { args: ['-s', 'emulator-5554', 'wait-for-device'], timeoutMs: 15_000 },
+    { args: ['-s', 'emulator-5554', 'install', '-r', 'helper.apk'], timeoutMs: undefined },
+  ]);
+});
+
+test('a thrown device-offline refusal gets the same one retry', async () => {
+  const commands: string[] = [];
+  bindAndroidAdbHostStub({
+    execAdb: async (invocation) => {
+      if (isWaitForDevice(invocation)) {
+        commands.push('wait-for-device');
+        return ok();
+      }
+      commands.push(invocation.command[0] ?? '');
+      if (commands.length === 1) {
+        throw new AppError('COMMAND_FAILED', 'adb exited with code 1', {
+          exitCode: 1,
+          stdout: '',
+          stderr: 'error: device offline',
+        });
+      }
+      return ok();
+    },
+  });
+
+  await expect(createDeviceAdbExecutor(DEVICE)(['install', 'helper.apk'])).resolves.toEqual(ok());
+  expect(commands).toEqual(['install', 'wait-for-device', 'install']);
+});
+
+test('the wait and the retry share the caller timeout', async () => {
+  vi.useFakeTimers({ toFake: ['Date'] });
+  onTestFinished(() => {
+    vi.useRealTimers();
+  });
+  const timeouts: Array<number | undefined> = [];
+  let offline = true;
+  bindAndroidAdbHostStub({
+    execAdb: async (invocation, options) => {
+      timeouts.push(options?.timeoutMs);
+      if (isWaitForDevice(invocation)) {
+        vi.setSystemTime(Date.now() + 1_500);
+        offline = false;
+      }
+      return offline ? { exitCode: 1, stdout: '', stderr: 'adb: device offline' } : ok();
+    },
+  });
+
+  await createDeviceAdbExecutor(DEVICE)(['install', 'helper.apk'], {
+    allowFailure: true,
+    timeoutMs: 4_000,
+  });
+
+  expect(timeouts).toEqual([4_000, 2_000, 2_500]);
+});
+
+test('a caller that aborts during the wait gets no retry', async () => {
+  const controller = new AbortController();
+  const commands: string[] = [];
+  bindAndroidAdbHostStub({
+    execAdb: async (invocation) => {
+      if (isWaitForDevice(invocation)) {
+        commands.push('wait-for-device');
+        controller.abort();
+        throw new AppError('COMMAND_FAILED', 'adb canceled');
+      }
+      comma
```

**File**: `packages/platform-android/src/adb-provider-scope.ts` (modified, +160/-6)
```diff
@@ -6,6 +6,7 @@ import {
   deviceShellExecutableOf,
   type ShellWord,
 } from '@agent-device/kernel/device-shell';
+import { AppError } from '@agent-device/kernel/errors';
 import {
   androidAdbInvocation,
   androidAdbPayloadWithoutSerial,
@@ -35,7 +36,11 @@ import {
   type AndroidAdbCommandExecutorOverride,
   type AndroidAdbHostTransport,
 } from './adb-host.ts';
-import { withAdbFailureHints } from './adb-failure.ts';
+import {
+  attachAdbFailureHint,
+  classifyAndroidAdbFailure,
+  withAdbFailureHints,
+} from './adb-failure.ts';
 import { createExecAndroidPortReverseProvider } from './adb-port-reverse.ts';
 import { normalizeAndroidAdbProvider } from './adb-provider-normalization.ts';
 
@@ -60,15 +65,164 @@ export function createDeviceAdbExecutor(
 
 function createSerialAdbExecutor(serial: string, serverPort?: number): AndroidAdbExecutor {
   return withAdbFailureHints(async (args, options) => {
-    const request = deviceAdbRouteRequest(serial, serverPort, args, options);
-    // A device-scoped executor is the terminal local route: an installed provider must not
-    // capture it and route the call back into itself.
-    return await requireAndroidAdbHost().withoutAdbCommandExecutorOverride(
-      async () => await requireAndroidAdbHost().execAdb(request.invocation, request.options),
+    const host = requireAndroidAdbHost();
+    const exec = async (
+      argv: readonly string[],
+      execOptions: AndroidAdbExecutorOptions | undefined,
+    ): Promise<AndroidAdbExecutorResult> => {
+      const request = deviceAdbRouteRequest(serial, serverPort, argv, execOptions);
+      // A device-scoped executor is the terminal local route: an installed provider must not
+      // capture it and route the call back into itself.
+      return await host.withoutAdbCommandExecutorOverride(
+        async () => await host.execAdb(request.invocation, request.options),
+      );
+    };
+    return await retryOnceAfterDeviceOffline(
+      `${serverPort ?? options?.serverPort ?? ''}/${serial}`,
+      options,
+      async (attemptOptions) => await exec(args, attemptOptions),
+      async (timeoutMs) => {
+        await exec(['wait-for-device'], {
+          allowFailure: true,
+          timeoutMs,
+          signal: options?.signal,
+          env: options?.env,
+          serverPort: options?.serverPort,
+        }).catch(() => undefined);
+      },
     );
   });
 }
 
+/** Devices, keyed by adb server and serial, that stayed offline through a wait for the device. */
+export type StayedOfflineDevices = Readonly<{
+  /** Whether the device's refusals still surface without another wait. */
+  has(device: string): boolean;
+  /** Records that the device stayed offline, and drops every mark that has lapsed. */
+  mark(device: string): void;
+  forget(device: string): void;
+}>;
+
+export function createStayedOfflineDevices(
+  windowMs: number,
+  expiries = new Map<string, number>(),
+): StayedOfflineDevices {
+  return {
+    has: (device) => (expiries.get(device) ?? 0) > Date.now(),
+    mark: (device) => {
+      const now = Date.now();
+      for (const [key, expiresAt] of expiries) {
+        if (expiresAt <= now) expiries.delete(key);
+      }
+      expiries.set(device, now + windowMs);
+    },
+    forget: (device) => {
+      expiries.delete(device);
+    },
+  };
+}
+
+/**
+ * The longest a command refused as `device offline` waits for the device before its one retry. An
+ * emulator drops to offline for a few seconds after boot while its adbd restarts.
+ */
+const ANDROID_DEVICE_OFFLINE_WAIT_MS = 15_000;
+
+/** A device that stayed offline through a wait has its refusals surface without another for 30 s. */
+const devicesStayingOffline = createStayedOfflineDevices(30_000);
+
+/**
+ * Runs `run`, and once more after `waitForDevice` when the host adb refused it as `device offline`.
+ * The refusal comes before the command reaches the device, so the retry cannot repeat an effect.
+ * The wait and the retry stay insi
```

---

### Incident Patch 4: `0a7221d5` (2026-09-30)
**Commit Message**: fix(daemon): probe a live daemon again before replacing it as unreachable (#3050)

* fix(daemon): probe a live daemon again before replacing it as unreachable

A 500 ms connect probe measures wall-clock time on the client's event
loop. A client that stalls past it (large sync parse, GC on a loaded CI
host) reads a listening daemon as unreachable, and the takeover kills
it, ending every live session. The next command then meets no session:
2 devices match equally, Daemon request timed out, Invalid daemon
response. While the recorded daemon process is still ours, probe up to
three more times before replacing it.

* test(daemon): cover the probe retry with a deterministic missed probe

On Linux the stalled-client test's first probe still connects, so the
retry never ran under coverage. A mocked miss exercises it on every host;
the stall test skips with the reason where the host outruns it.

* fix(daemon): gate the probe retry on liveness, not the ps identity read

Under the load that stalls the probe, ps misses its deadline too and the
identity read fails closed, ending the retries. The takeover still proves
identity before it signals.

* fix(daemon): ask client-transport reachability

**File**: `src/daemon-client/__tests__/daemon-client-lifecycle.test.ts` (modified, +1/-1)
```diff
@@ -490,7 +490,7 @@ test('sendToDaemon does not reuse reachable daemon metadata with mismatched vers
 
       assert.deepEqual(response, { ok: true, data: { via: 'fresh-daemon' } });
       assert.equal(mockRunCmdDetached.mock.calls.length, 1);
-      assert.deepEqual(staleDaemon.seenPaths, ['GET /health']);
+      assert.deepEqual(staleDaemon.seenPaths, []);
       assert.deepEqual(freshDaemon.seenPaths, ['GET /health', 'POST /rpc']);
       const staleVersion = fixture.version ?? readVersion();
       assert.equal(
```

**File**: `src/daemon-client/__tests__/daemon-client-stalled-probe.test.ts` (added, +315/-0)
```diff
@@ -0,0 +1,315 @@
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import net from 'node:net';
+import path from 'node:path';
+import { test, vi } from 'vitest';
+import { runCmdBackground } from '@agent-device/host-kit/command';
+import { computeDaemonCodeSignature } from '@agent-device/host-kit/code-signature';
+import {
+  isProcessAlive,
+  readProcessCommand,
+  readProcessStartTime,
+  waitForProcessExit,
+} from '@agent-device/host-kit/process';
+import { findProjectRoot, readVersion } from '@agent-device/host-kit/version';
+import { resolveDaemonPaths } from '../../daemon-resolution.ts';
+import { sendToDaemon } from '../daemon-client.ts';
+import {
+  closeLoopbackServer,
+  listenOnLoopback,
+  supportsLoopbackBind,
+} from '../../__tests__/test-utils/loopback.ts';
+import { mkdtempForTestSync } from '../../__tests__/test-utils/tmp-dir.ts';
+import { AppError } from '@agent-device/kernel/errors';
+
+const NEWER_DAEMON_VERSION = '999.0.0';
+
+// The spawned stand-in's identity is read once and pinned: a second real `ps` can miss its
+// deadline under suite load and misclassify the live process as gone.
+const { mockReadProcessStartTime, mockReadProcessCommand } = vi.hoisted(() => ({
+  mockReadProcessStartTime: vi.fn<(pid: number) => string | null | undefined>(),
+  mockReadProcessCommand: vi.fn<(pid: number) => string | null | undefined>(),
+}));
+
+// Every probe's answer, in order, with the port it asked; a test can also make the next one miss.
+const { probeAnswers, probedPorts, mockMissNextProbe, mockEmitDiagnostic, mockSpawnDaemon } =
+  vi.hoisted(() => ({
+    probeAnswers: [] as boolean[],
+    probedPorts: [] as (number | undefined)[],
+    mockMissNextProbe: { value: false },
+    mockEmitDiagnostic: vi.fn(),
+    mockSpawnDaemon: vi.fn(),
+  }));
+
+vi.mock('@agent-device/host-kit/diagnostics', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('@agent-device/host-kit/diagnostics')>();
+  return {
+    ...actual,
+    emitDiagnostic: (...args: Parameters<typeof actual.emitDiagnostic>) => {
+      mockEmitDiagnostic(...args);
+      actual.emitDiagnostic(...args);
+    },
+  };
+});
+
+vi.mock('@agent-device/host-kit/command', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('@agent-device/host-kit/command')>();
+  return { ...actual, runCmdDetachedMonitored: mockSpawnDaemon };
+});
+
+vi.mock('../daemon-client-transport.ts', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('../daemon-client-transport.ts')>();
+  return {
+    ...actual,
+    canConnect: async (...args: Parameters<typeof actual.canConnect>) => {
+      const reachable = mockMissNextProbe.value ? false : await actual.canConnect(...args);
+      mockMissNextProbe.value = false;
+      probeAnswers.push(reachable);
+      probedPorts.push(args[0].port);
+      return reachable;
+    },
+  };
+});
+
+vi.mock('@agent-device/host-kit/process', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('@agent-device/host-kit/process')>();
+  return {
+    ...actual,
+    readProcessStartTime: (pid: number) =>
+      mockReadProcessStartTime(pid) ?? actual.readProcessStartTime(pid),
+    readProcessCommand: (pid: number) =>
+      mockReadProcessCommand(pid) ?? actual.readProcessCommand(pid),
+  };
+});
+
+function resolveCurrentDaemonCodeSignature(): string {
+  const root = findProjectRoot();
+  const distPath = path.join(root, 'dist', 'src', 'internal', 'daemon.js');
+  const sourcePath = path.join(root, 'src', 'daemon.ts');
+  const entryPath =
+    process.execArgv.includes('--experimental-strip-types') || !fs.existsSync(distPath)
+      ? sourcePath
+      : distPath;
+  return computeDaemonCodeSignature(entryPath, root);
+}
+
+type LiveStandIn = { stateDir: string; pid: number };
+
+/**
+ * Runs `body` against a daemon.json naming a live process that reads as an agent-device daemon
+ * and a loopback sock
```

**File**: `src/daemon-client/__tests__/daemon-launch-spec.test.ts` (modified, +17/-3)
```diff
@@ -122,6 +122,20 @@ test('an unreachable newer daemon is replaced like any version mismatch', async
   );
 });
 
+test('a version mismatch is decided without asking the client transport', async () => {
+  let asked = false;
+  const decision = await resolveDaemonTakeover(runningDaemon({ version: '0.0.1' }), {
+    onClientTransport: async () => {
+      asked = true;
+      return false;
+    },
+    onAnyAdvertisedTransport: async () => false,
+  });
+
+  assert.equal(decision.kind, 'replace');
+  assert.equal(asked, false);
+});
+
 test('a newer daemon alive only on a transport the client does not prefer is still refused', async () => {
   assert.deepEqual(
     await resolveDaemonTakeover(runningDaemon({ version: '999.0.0' }), onlyOnAnotherTransport()),
@@ -159,15 +173,15 @@ function useClientTree(sourceCheckout: boolean): void {
 }
 
 function reachable(): DaemonReachability {
-  return { viaClientTransport: true, onAnyAdvertisedTransport: async () => true };
+  return { onClientTransport: async () => true, onAnyAdvertisedTransport: async () => true };
 }
 
 function unreachable(): DaemonReachability {
-  return { viaClientTransport: false, onAnyAdvertisedTransport: async () => false };
+  return { onClientTransport: async () => false, onAnyAdvertisedTransport: async () => false };
 }
 
 function onlyOnAnotherTransport(): DaemonReachability {
-  return { viaClientTransport: false, onAnyAdvertisedTransport: async () => true };
+  return { onClientTransport: async () => false, onAnyAdvertisedTransport: async () => true };
 }
 
 function runningDaemon(info: {
```

**File**: `src/daemon-client/daemon-client-lifecycle.ts` (modified, +33/-5)
```diff
@@ -8,7 +8,7 @@ import type { DaemonRequest, DaemonResponse } from '../daemon/daemon-request.ts'
 import { runCmdDetachedMonitored, type ExecDetachedExit } from '@agent-device/host-kit/command';
 import { shellQuoteIfNeeded } from '@agent-device/kernel/device-shell';
 import { emitDiagnostic } from '@agent-device/host-kit/diagnostics';
-import { readProcessStartTime } from '@agent-device/host-kit/process';
+import { isProcessAlive, readProcessStartTime } from '@agent-device/host-kit/process';
 import { sleep } from '@agent-device/host-kit/retry';
 
 import { findUnrecoveredRepairCommitFailure } from '../session-repair-tombstone.ts';
@@ -76,6 +76,8 @@ type DaemonStartupWaitResult =
   | { kind: 'timeout' };
 
 const DAEMON_STARTUP_TIMEOUT_MS = 15_000;
+const LIVE_DAEMON_PROBE_RETRIES = 3;
+const LIVE_DAEMON_PROBE_RETRY_DELAY_MS = 200;
 const DAEMON_STARTUP_ATTEMPTS = 2;
 const DAEMON_STARTUP_LOG_TAIL_BYTES = 64_000;
 const LOOPBACK_BLOCK_LIST = new net.BlockList();
@@ -199,11 +201,9 @@ async function readReusableLocalDaemon(settings: DaemonClientSettings): Promise<
   const existing = readDaemonInfo(settings.paths.infoPath);
   if (!existing) return null;
 
-  const viaClientTransport = await canConnectReusableDaemon(existing, settings.transportPreference);
   const decision = await resolveDaemonTakeover(existing, {
-    viaClientTransport,
-    onAnyAdvertisedTransport: async () =>
-      viaClientTransport || (await canConnectReusableDaemon(existing, 'auto')),
+    onClientTransport: () => canReachReusableDaemon(existing, settings.transportPreference),
+    onAnyAdvertisedTransport: () => canReachReusableDaemon(existing, 'auto'),
   });
   if (decision.kind === 'reuse') return existing;
   if (decision.kind === 'refuseNewer') {
@@ -216,6 +216,34 @@ async function readReusableLocalDaemon(settings: DaemonClientSettings): Promise<
   return null;
 }
 
+/**
+ * A daemon whose pid is still alive is probed again before it can be judged unreachable. A probe's
+ * budget is wall-clock time on this client's event loop, so a client that stalls past it (a large
+ * synchronous parse, a GC pause on a loaded host) reads a listening daemon as unreachable, and
+ * replacing it ends every session the daemon holds. Liveness is the signal-0 check, not the `ps`
+ * identity read: under the load that stalls the probe, `ps` misses its deadline too, and the
+ * takeover still proves identity before it signals anything.
+ */
+async function canReachReusableDaemon(
+  info: DaemonInfo,
+  preference: DaemonTransportPreference,
+): Promise<boolean> {
+  if (await canConnectReusableDaemon(info, preference)) return true;
+  for (let retry = 1; retry <= LIVE_DAEMON_PROBE_RETRIES; retry += 1) {
+    if (!isProcessAlive(info.pid)) return false;
+    await sleep(LIVE_DAEMON_PROBE_RETRY_DELAY_MS);
+    if (await canConnectReusableDaemon(info, preference)) {
+      emitDiagnostic({
+        level: 'warn',
+        phase: 'daemon_probe_recovered',
+        data: { pid: info.pid, retry },
+      });
+      return true;
+    }
+  }
+  return false;
+}
+
 /**
  * ADR 0029: a caller that names a daemon policy must not silently use a daemon that enforces a
  * different one (or none). A caller that names no policy uses whatever the daemon enforces.
```

**File**: `src/daemon-client/daemon-launch-spec.ts` (modified, +3/-2)
```diff
@@ -119,7 +119,8 @@ export type DaemonTakeoverDecision =
  * transport preference the daemon does not serve must still see a live newer daemon.
  */
 export type DaemonReachability = {
-  viaClientTransport: boolean;
+  /** Asked last, only once version and code identity leave the decision to it. */
+  onClientTransport: () => Promise<boolean>;
   onAnyAdvertisedTransport: () => Promise<boolean>;
 };
 
@@ -152,7 +153,7 @@ export async function resolveDaemonTakeover(
   const localIdentity = await resolveLocalDaemonCodeIdentity();
   const codeMismatch = resolveCodeIdentityMismatch(localIdentity, info);
   if (codeMismatch) return { kind: 'replace', reason: codeMismatch };
-  if (!reachability.viaClientTransport) return { kind: 'replace', reason: 'unreachable' };
+  if (!(await reachability.onClientTransport())) return { kind: 'replace', reason: 'unreachable' };
   return { kind: 'reuse' };
 }
 
```

---

### Incident Patch 5: `44e4ec5c` (2026-09-30)
**Commit Message**: fix(ios): write the simulator clipboard from the runner (#3065)

* fix(ios): write the simulator clipboard from the runner

Under Xcode 27, simctl pbcopy exits 0 but leaves the device pasteboard
empty: it hands the simulator a promise of the data owned by the simctl
process, which exits before anything reads it. clipboard write now sets
UIPasteboard.general from the runner's own process through a new
pasteboardWrite runner command. Reads keep simctl pbpaste, which works.

* fix(ios): runner demand and managed admission for the runner clipboard write

writeClipboard now needs the runner, so the simulator runner-demand table
marks it runner and the managed owner withholds it on iOS, where no
managed path starts a runner. A tvOS simulator has no UIPasteboard for its
runner, so it keeps simctl pbcopy. Runner tests pin the command's
missing-text refusal and that the general pasteboard holds the text.

* fix(ios): pass the cancel signal to the tvOS pbcopy write, and tidy the pasteboard test

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+CommandDispatch.swift` (modified, +31/-0)
```diff
@@ -66,6 +66,35 @@ extension RunnerTests {
     return Response(ok: true, data: DataPayload(applicationState: Self.applicationStateName(state)))
   }
 
+  /// Sets the device's general pasteboard to `text` from the runner's own process. A simulator's
+  /// `simctl pbcopy` only promises the data from the short-lived `simctl` process, which exits before
+  /// anything on the device reads it, so the runner is the writer that leaves the text in place.
+  @MainActor
+  func executePasteboardWrite(command: Command) -> Response {
+    guard let text = command.text else {
+      return Response(
+        ok: false,
+        error: ErrorPayload(
+          code: "INVALID_ARGS",
+          message: "pasteboardWrite requires text",
+          hint: "Set text to the string the pasteboard should hold."
+        )
+      )
+    }
+#if os(iOS) || os(visionOS)
+    UIPasteboard.general.string = text
+    return Response(ok: true, data: DataPayload(message: "pasteboard written"))
+#else
+    return Response(
+      ok: false,
+      error: ErrorPayload(
+        code: "UNSUPPORTED_OPERATION",
+        message: "pasteboardWrite is supported on iOS and visionOS runners"
+      )
+    )
+#endif
+  }
+
   /// `XCUIApplication.State` by the names the TypeScript `AppleApplicationState` type declares, the
   /// same names the activation disclosure gives its prior state.
   static func applicationStateName(_ state: XCUIApplication.State) -> String {
@@ -423,6 +452,8 @@ extension RunnerTests {
       return executeUptime()
     case .appState:
       return executeAppState(command: command)
+    case .pasteboardWrite:
+      return executePasteboardWrite(command: command)
     case .activate:
       guard
         let bundleId = command.appBundleId?.trimmingCharacters(in: .whitespacesAndNewlines),
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+CommandExecution.swift` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ extension RunnerTests {
     }
     switch command.command {
     case .status, .activate, .terminate, .targetReset, .shutdown, .recordStart, .recordStop, .uptime,
-      .appState, .snapshot:
+      .appState, .pasteboardWrite, .snapshot:
       return Response(
         ok: false,
         error: ErrorPayload(
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+CommandJournal.swift` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ final class RunnerCommandJournal {
          .remotePress, .type, .swipe, .scroll, .desktopScroll, .findText, .querySelector, .readText,
          .backInApp, .backSystem, .home, .rotate, .appSwitcher, .actionButton, .keyboardDismiss, .keyboardReturn,
          .alert, .sequence, .gesture, .gestureViewport, .recordStart, .recordStop,
-         .status, .uptime, .appState, .activate, .terminate, .targetReset, .shutdown:
+         .status, .uptime, .appState, .pasteboardWrite, .activate, .terminate, .targetReset, .shutdown:
       return true
     }
   }
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+Models.swift` (modified, +9/-0)
```diff
@@ -34,6 +34,7 @@ enum CommandType: String, Codable, CaseIterable {
   case status
   case uptime
   case appState
+  case pasteboardWrite
   case activate
   case terminate
   case targetReset
@@ -149,6 +150,11 @@ fileprivate extension CommandTraits {
   /// The runner's own lifecycle: no session app is brought forward, and no mutation is proven.
   static let runnerLifecycle = CommandTraits(launchPolicy: .noApp)
 
+  /// Device state the runner sets from its own process, such as the pasteboard: no app is brought
+  /// forward, since the state belongs to the device rather than to the session app, and no UI
+  /// mutation is proven.
+  static let deviceState = CommandTraits(launchPolicy: .noApp)
+
   /// Commands hosted by the surface that already has focus, which no activation may cancel. A
   /// hardware press belongs to the system rather than to the session app, and an alert answers from
   /// the modal where it sits; both mutate.
@@ -253,6 +259,9 @@ extension Command {
     case .recordStop, .uptime, .terminate, .targetReset, .shutdown:
       return .runnerLifecycle
 
+    case .pasteboardWrite:
+      return .deviceState
+
     case .actionButton:
       return .presentedSurfaceMutation
 
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/UnitTests/RunnerTests+ModelsTests.swift` (modified, +5/-3)
```diff
@@ -198,16 +198,17 @@ extension RunnerTests {
   ]
 
   /// Commands that did not exist at the merge-base, so no classification of its is compared with
-  /// theirs. `appState` arrived with #2929.
-  private static let commandsNewerThanTheMergeBase: Set<CommandType> = [.appState]
+  /// theirs. `appState` arrived with #2929, `pasteboardWrite` with the runner-written simulator
+  /// clipboard.
+  private static let commandsNewerThanTheMergeBase: Set<CommandType> = [.appState, .pasteboardWrite]
 
   /// The commands production never runs through the prepared path's body: `executeOnMain` answers
   /// these before `executeOnMainPrepared` runs, and `executeDispatched` answers `snapshot` earlier
   /// still, on both this and the merge-base chain. The merge-base witness predicate was therefore
   /// never evaluated for them and neither is the derived one. If a command starts reaching the
   /// prepared path, removing it here is a claim the equivalence assertion below has to keep proving.
   private static let commandsAnsweredBeforeThePreparedPath: Set<CommandType> = [
-    .status, .uptime, .appState, .activate, .terminate, .targetReset, .shutdown,
+    .status, .uptime, .appState, .pasteboardWrite, .activate, .terminate, .targetReset, .shutdown,
     .recordStart, .recordStop, .snapshot,
   ]
 
@@ -286,6 +287,7 @@ extension RunnerTests {
       (.status, expectation(interaction: false, retry: true, launch: .noApp, converts: false)),
       (.uptime, expectation(interaction: false, retry: false, launch: .noApp, converts: false)),
       (.appState, expectation(interaction: false, retry: true, launch: .noApp, converts: false)),
+      (.pasteboardWrite, expectation(interaction: false, retry: false, launch: .noApp, converts: false)),
       (.activate, expectation(interaction: false, retry: false, launch: .mayLaunch, converts: true)),
       (.terminate, expectation(interaction: false, retry: false, launch: .noApp, converts: false)),
       (.targetReset, expectation(interaction: false, retry: false, launch: .noApp, converts: false)),
```

---

### Incident Patch 6: `df9f8a49` (2026-09-29)
**Commit Message**: fix(daemon-client): a client whose daemon lost the start race adopts the winner (#3057)

* fix(daemon-client): a client whose daemon lost the start race adopts the winner

Two clients that find no daemon both launch one. The daemon that loses
the startup lock exits cleanly, and its client took that as a failed
start: it deleted daemon.json and stopped the live daemon it named,
the winner every other client was using, then failed with 'Failed to
start daemon'. 3 concurrent clients on an empty state dir: 8/30 failed
and the daemon was gone in 8/10 trials.

The startup wait now accepts any reachable daemon first, and keeps
waiting when its own daemon exited because a live daemon holds the
lock. An adopted daemon is not startedByClient, so a one-shot
replay/test does not tear down a daemon another client started.

* fix(daemon-client): adopt a start-race winner only as a reusable daemon

The winner of a start race goes through the same takeover decision as
any existing daemon: compatible is reused, newer is refused, older or
mismatched is replaced. This client's own daemon is recognized by pid
and process start time, so a reused pid is never taken for it.

* test(daemon-client): stamp 

**File**: `src/daemon-client/__tests__/daemon-client-startup-race.test.ts` (added, +205/-0)
```diff
@@ -0,0 +1,205 @@
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import { afterEach, beforeAll, test, vi } from 'vitest';
+import { mkdtempForTestSync } from '../../__tests__/test-utils/tmp-dir.ts';
+
+vi.mock('@agent-device/host-kit/command', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('@agent-device/host-kit/command')>()),
+  runCmdDetachedMonitored: vi.fn(),
+}));
+vi.mock('@agent-device/host-kit/retry', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('@agent-device/host-kit/retry')>()),
+  sleep: vi.fn(async () => {}),
+}));
+const winner = vi.hoisted(() => ({ pid: 43_300, alive: true }));
+vi.mock('../../daemon-process.ts', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('../../daemon-process.ts')>();
+  return {
+    ...actual,
+    isAgentDeviceDaemonProcess: vi.fn((pid: number, startTime: string | undefined) =>
+      pid === winner.pid ? winner.alive : actual.isAgentDeviceDaemonProcess(pid, startTime),
+    ),
+    stopProcessForTakeover: vi.fn(
+      async (pid: number, options: Parameters<typeof actual.stopProcessForTakeover>[1]) => {
+        if (pid !== winner.pid) return await actual.stopProcessForTakeover(pid, options);
+        winner.alive = false;
+      },
+    ),
+  };
+});
+
+import { resolveDaemonPaths, type DaemonPaths } from '../../daemon-resolution.ts';
+import { sendToDaemon } from '../daemon-client.ts';
+import { runCmdDetachedMonitored, type ExecDetachedExit } from '@agent-device/host-kit/command';
+import { sleep } from '@agent-device/host-kit/retry';
+import { readVersion } from '@agent-device/host-kit/version';
+import { resolveLocalDaemonCodeIdentity } from '../daemon-launch-spec.ts';
+import {
+  startHttpDaemonFixture,
+  type HttpDaemonFixture,
+} from '../../__tests__/test-utils/daemon-http-fixture.ts';
+import { closeLoopbackServer, supportsLoopbackBind } from '../../__tests__/test-utils/loopback.ts';
+
+// Two clients that find no daemon both launch one; the daemon that loses the startup lock exits
+// cleanly. These pin that the losing client adopts the winner instead of tearing it down.
+
+const WINNER_PID = winner.pid;
+const LOSER_PID = 43_301;
+
+const mockRunCmdDetached = vi.mocked(runCmdDetachedMonitored);
+const mockSleep = vi.mocked(sleep);
+
+afterEach(() => {
+  winner.alive = true;
+  mockRunCmdDetached.mockReset();
+  mockSleep.mockReset();
+  mockSleep.mockImplementation(async () => {});
+  vi.unstubAllEnvs();
+});
+
+/** The code signature this client stamps on, and expects of, a daemon it may reuse. */
+let codeSignature: string | undefined;
+
+beforeAll(async () => {
+  const identity = await resolveLocalDaemonCodeIdentity();
+  codeSignature = identity.origin === 'installed' ? undefined : identity.codeSignature;
+});
+
+/** Records the winning daemon the way it would: the startup lock, then its reachable metadata. */
+function writeWinner(
+  paths: DaemonPaths,
+  fixture: HttpDaemonFixture,
+  parts: 'lock' | 'all',
+  version = readVersion(),
+): void {
+  fs.mkdirSync(paths.baseDir, { recursive: true });
+  fs.writeFileSync(
+    paths.lockPath,
+    JSON.stringify({ pid: WINNER_PID, processStartTime: 'winner', startedAt: Date.now() }),
+  );
+  if (parts === 'lock') return;
+  fs.writeFileSync(
+    paths.infoPath,
+    JSON.stringify({
+      token: 'winner-secret',
+      pid: WINNER_PID,
+      version,
+      codeSignature,
+      processStartTime: 'winner',
+      httpPort: fixture.port,
+      transport: 'http',
+    }),
+  );
+}
+
+test('a client whose daemon lost the startup lock uses the daemon that won it', async (t) => {
+  if (!(await supportsLoopbackBind())) {
+    t.skip('loopback listeners are not permitted in this environment');
+    return;
+  }
+  const stateDir = mkdtempForTestSync('agent-device-daemon-start-race-');
+  const paths = resolveDaemonPaths(stateDir);
+  vi.stubEnv('AGENT_DEVICE_STATE_DIR', stateDir);
+  const fixture = await start
```

**File**: `src/daemon-client/daemon-client-lifecycle.ts` (modified, +29/-7)
```diff
@@ -8,6 +8,7 @@ import type { DaemonRequest, DaemonResponse } from '../daemon/daemon-request.ts'
 import { runCmdDetachedMonitored, type ExecDetachedExit } from '@agent-device/host-kit/command';
 import { shellQuoteIfNeeded } from '@agent-device/kernel/device-shell';
 import { emitDiagnostic } from '@agent-device/host-kit/diagnostics';
+import { readProcessStartTime } from '@agent-device/host-kit/process';
 import { sleep } from '@agent-device/host-kit/retry';
 
 import { findUnrecoveredRepairCommitFailure } from '../session-repair-tombstone.ts';
@@ -30,6 +31,7 @@ import {
   cleanupFailedDaemonStartupMetadata,
   cleanupStaleDaemonLockIfSafe,
   getDaemonMetadataState,
+  isDaemonLockHeldByAnotherDaemon,
   isRemoteDaemon,
   readDaemonInfo,
   recoverDaemonLockHolder,
@@ -63,11 +65,13 @@ export type EnsuredDaemon = {
 
 type DaemonStartupLaunch = {
   pid: number;
+  /** The launched process's start time, so a reused pid is never taken for it. */
+  startTime?: string;
   exited: Promise<ExecDetachedExit>;
 };
 
 type DaemonStartupWaitResult =
-  | { kind: 'ready'; info: DaemonInfo }
+  | { kind: 'ready'; daemon: EnsuredDaemon }
   | { kind: 'early_exit'; exit: ExecDetachedExit }
   | { kind: 'timeout' };
 
@@ -274,7 +278,7 @@ async function startLocalDaemon(settings: DaemonClientSettings): Promise<Ensured
     }
 
     const startup = await waitForDaemonStartup(DAEMON_STARTUP_TIMEOUT_MS, settings, launch);
-    if (startup.kind === 'ready') return { info: startup.info, startedByClient: true };
+    if (startup.kind === 'ready') return startup.daemon;
     if (startup.kind === 'early_exit') {
       daemonProcess = startup.exit;
       startError = describeDaemonEarlyExit(startup.exit);
@@ -299,7 +303,7 @@ async function startLocalDaemon(settings: DaemonClientSettings): Promise<Ensured
     cleanupResults.push(cleanup);
     if (cleanup.retainedInfoProcess || cleanup.retainedLockProcess) {
       const extended = await waitForDaemonStartup(DAEMON_STARTUP_TIMEOUT_MS, settings, launch);
-      if (extended.kind === 'ready') return { info: extended.info, startedByClient: true };
+      if (extended.kind === 'ready') return extended.daemon;
       if (extended.kind === 'early_exit') {
         daemonProcess = extended.exit;
         startError = describeDaemonEarlyExit(extended.exit);
@@ -589,17 +593,34 @@ async function waitForDaemonStartup(
   });
 
   while (Date.now() - start < timeoutMs) {
-    if (earlyExit) return { kind: 'early_exit', exit: earlyExit };
     const info = readDaemonInfo(settings.paths.infoPath);
     if (info && (await canConnect(info, settings.transportPreference))) {
-      return { kind: 'ready', info };
+      if (isLaunchedDaemon(info, launch)) {
+        return { kind: 'ready', daemon: { info, startedByClient: true } };
+      }
+      // Another client's daemon won the start: adopt it only as a reusable daemon would be. An
+      // incompatible one is replaced, and this wait then sees its own daemon's early exit.
+      const winner = await readReusableLocalDaemon(settings);
+      if (winner) return { kind: 'ready', daemon: { info: winner, startedByClient: false } };
+    }
+    // A daemon that lost the startup lock exits cleanly; the daemon that won it is still starting.
+    if (earlyExit && !isDaemonLockHeldByAnotherDaemon(settings.paths, earlyExit.pid)) {
+      return { kind: 'early_exit', exit: earlyExit };
     }
-    if (earlyExit) return { kind: 'early_exit', exit: earlyExit };
     await sleep(100);
   }
   return { kind: 'timeout' };
 }
 
+/** Whether `info` names the daemon process this client launched: same pid and start time. */
+function isLaunchedDaemon(info: DaemonInfo, launch: DaemonStartupLaunch): boolean {
+  return (
+    info.pid === launch.pid &&
+    launch.startTime !== undefined &&
+    info.processStartTime === launch.startTime
+  );
+}
+
 function startDaemon(settings: DaemonClientSettings): DaemonStartupLaunch {
   const launchSpec = resolveDaemonLaunchSpec();
   con
```

**File**: `src/daemon-client/daemon-client-metadata.ts` (modified, +13/-0)
```diff
@@ -118,6 +118,19 @@ function readDaemonLockInfo(lockPath: string): DaemonLockInfo | null {
   };
 }
 
+/**
+ * Whether a live daemon other than `pid` holds the startup lock: another client's daemon won the
+ * start, and the daemon at `pid` exited because it lost the lock.
+ */
+export function isDaemonLockHeldByAnotherDaemon(paths: DaemonPaths, pid: number): boolean {
+  const lockInfo = readDaemonLockInfo(paths.lockPath);
+  return (
+    lockInfo !== null &&
+    lockInfo.pid !== pid &&
+    isAgentDeviceDaemonProcess(lockInfo.pid, lockInfo.processStartTime)
+  );
+}
+
 export function removeDaemonInfo(infoPath: string): void {
   removeFileIfExists(infoPath);
 }
```

---

### Incident Patch 7: `e323ddf7` (2026-09-29)
**Commit Message**: fix(android): honor boot --timeout as the emulator boot deadline (#3059)

* fix(android): honor boot --timeout as the emulator boot deadline

The startup deadline EnsureReadyInput already carries now bounds both the
emulator-appearance wait and the sys.boot_completed wait, shared as one budget.
Expiry reports reason boot_timeout, the same reason iOS uses, and leaves the
emulator booting. open --timeout reaches the same wait. HarmonyOS, Vega, and
Linux have no boot wait.

* refactor(readiness): one boot_timeout reason and hint for every boot deadline

**File**: `packages/command-registry/src/flag-definitions-workflow.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export const WORKFLOW_FLAG_DEFINITIONS: readonly FlagDefinition[] = [
     min: 1,
     usageLabel: '--timeout <ms>',
     usageDescription:
-      'Boot/Open/Prepare: startup budget covering the Simulator boot (and runner preparation for prepare). Replay/Snapshot/Test: maximum wall-clock time for the command or attempt. With --settle: the settle-wait deadline (default 10s)',
+      'Boot/Open/Prepare: startup budget covering the device boot (and runner preparation for prepare). Replay/Snapshot/Test: maximum wall-clock time for the command or attempt. With --settle: the settle-wait deadline (default 10s)',
     projectConfig: true,
     recorded: false,
   },
```

**File**: `packages/command-registry/src/registry.ts` (modified, +1/-1)
```diff
@@ -714,7 +714,7 @@ export const RAW_COMMAND_DESCRIPTORS = [
       sessionKind: 'state',
     },
     platformExecution: { kind: 'device-runtime', uses: deviceBootRuntimeUses },
-    // --timeout is a startup budget: it reaches the Simulator boot wait, same as open/prepare
+    // --timeout is a startup budget: it reaches the device boot wait, same as open/prepare
     // (#2325). A first boot can outlast the fixed 90s envelope (#3004).
     timeoutPolicy: { ...DEFAULT_TIMEOUT_POLICY, budget: { source: 'flag', envelope: 'margin' } },
     batchable: true,
```

**File**: `packages/contracts/src/client-device-view.ts` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ export type StartupPerfSample = {
 
 export type DeviceBootOptions = DeviceCommandBaseOptions & {
   headless?: boolean;
-  /** Startup budget in milliseconds: bounds the Simulator boot wait on a cold device. */
+  /** Startup budget in milliseconds: bounds the boot wait on a cold Simulator or emulator. */
   timeoutMs?: number;
 };
 
```

**File**: `packages/contracts/src/device-readiness-runtime.ts` (modified, +5/-1)
```diff
@@ -1,12 +1,16 @@
 import type { DeviceInfo } from '@agent-device/kernel/device';
 import type { DeviceInventoryRequest } from './device-inventory.ts';
 
+/** Typed `details.reason` every platform reports when the boot deadline expires. */
+export const BOOT_TIMEOUT_REASON = 'boot_timeout';
+
 export type EnsureReadyInput = Readonly<{
   serial?: string;
   androidSerialAllowlist?: readonly string[];
   /**
    * Absolute deadline (epoch ms), from `boot --timeout`, already validated finite and positive.
-   * Bounds a cold Simulator boot wait; the Apple runtime is the only current consumer.
+   * Bounds a cold boot wait; the Apple and Android runtimes honor it. HarmonyOS, Vega, and Linux
+   * have no boot wait to bound.
    */
   deadlineAtMs?: number;
 }>;
```

**File**: `packages/platform-android/src/lifecycle.ts` (modified, +6/-2)
```diff
@@ -54,8 +54,12 @@ export function bindAndroidApplicationLifecycle(
     resolveOpenTarget: async (input) =>
       await host.androidApplications.resolveOpenTarget(device, input),
     prepareApplicationOpen: async (input) => {
-      await ensureAndroidReady(host, device, { headless: false }, signal);
-      void input;
+      await ensureAndroidReady(
+        host,
+        device,
+        { headless: false, deadlineAtMs: input.execution.startupDeadlineAtMs },
+        signal,
+      );
     },
     openApplication: async (input) => await openAndroidApplication(host, binding, input),
     applyRuntimeHints: async (input) =>
```

---

### Incident Patch 8: `1df5a7a1` (2026-09-29)
**Commit Message**: fix(apple-runner): a penalized snapshot plan falls back to the bounded XCTest probe (#3051)

* fix(apple-runner): a penalized snapshot plan falls back to the bounded XCTest probe

* fix(apple-runner): only the bounded tree stays behind a deferred plan, and names the budget

The query sweep's grind is what penalizes the channel, so it stays off a
deferred plan; the occupancy test's no-sweep contract holds again. A
capture the bounded tree recovered reports 'budget', not 'deferred'.

* fix(apple-runner): a deferred plan that ran the bounded tree reports the budget on every path

The sparse terminal path kept the seeded 'deferred' reason after the
bounded tree ran. Both paths now stamp 'budget' once an XCTest tier ran
behind private AX. A unit-test seam lets plan-runner tests make private
AX read nothing, as it does behind an out-of-process sheet, and pins
recovered/tree/budget and sparse/budget.

* fix(apple-runner): the recovery log line names the reason the verdict carries

* test(apple-runner): a bounded tree that misses its slice skips the recovery test

On a host too loaded for the 1 s slice the plan ends sparse; the verdict
must still say budget, and the recovery assertions ski

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests+SnapshotCapturePlan.swift` (modified, +40/-6)
```diff
@@ -205,6 +205,19 @@ extension RunnerTests {
     }
   }
 
+  /// The reason a capture's verdict carries. Once an XCTest-backed tier ran behind a deferred plan,
+  /// it ran on the bounded probe's short slice, so the capture reports that constraint ('budget')
+  /// whether the tier recovered it or the plan ended sparse, rather than the pre-selection
+  /// ('deferred') the plan was seeded with.
+  static func planVerdictReason(
+    xCTestTierRan: Bool,
+    state: SnapshotXCTestChannelPlanState,
+    firstFailure: (reason: String, code: String)?
+  ) -> (reason: String, code: String)? {
+    guard xCTestTierRan, state == .deferredToIndependentBackend else { return firstFailure }
+    return xcTestChannelStateFirstFailure(.boundedXCTestProbe)
+  }
+
   /// Pure gate: a capture is planned as penalized when the channel penalty is
   /// active OR the daemon pinned the private-AX backend (same-backend evidence
   /// probe) — both mean "do not enter XCTest tree work first, and stamp the
@@ -251,10 +264,14 @@ extension RunnerTests {
     let availablePlan = plan.filter { availableBackends.contains($0) }
     let recoveryPlan = availablePlan.filter { !$0.usesXCTestAccessibilityChannel }
     if !recoveryPlan.isEmpty {
+      // The independent backend reads only the app it can match as the active AX application, so
+      // an out-of-process surface over the app (the Save Password sheet) leaves it empty for the
+      // whole penalty. The tree, on the bounded probe's short slice, stays behind it; the query
+      // sweep does not, since its grind is what the penalty keeps off the main thread.
       return EffectiveSnapshotCapturePlan(
-        plan: recoveryPlan,
+        plan: recoveryPlan + availablePlan.filter { $0 == .recursiveTree },
         xCTestChannelState: .deferredToIndependentBackend,
-        treeCaptureSliceBudgetOverride: nil,
+        treeCaptureSliceBudgetOverride: Self.penalizedXCTestProbeTreeSliceBudget,
         preferredBackend: nil
       )
     }
@@ -285,6 +302,7 @@ extension RunnerTests {
     // A caller may share the pre-plan system-modal probe's deadline; otherwise own the full budget (#1244).
     let deadline = deadline ?? Date().addingTimeInterval(Self.snapshotPlanBudget)
     let suppressXCTestPenalty = snapshotXCTestPenaltyWarmupExemption.consume()
+    var xCTestTierRan = false
 
     // Reorder is iOS-only because hostile screens can make XCTest tree/query work grind while
     // the app remains visually responsive. Simulators can avoid that channel through private AX;
@@ -344,6 +362,7 @@ extension RunnerTests {
         }
         continue
       }
+      if kind.usesXCTestAccessibilityChannel { xCTestTierRan = true }
       let attempt = try captureWithBackend(
         kind,
         target: target,
@@ -391,18 +410,23 @@ extension RunnerTests {
       }
 
       let recovered = kind != effectivePlan.first || effective.xCTestChannelState != .normal
+      let verdictReason = Self.planVerdictReason(
+        xCTestTierRan: kind.usesXCTestAccessibilityChannel,
+        state: effective.xCTestChannelState,
+        firstFailure: firstFailure
+      )
       if recovered {
         NSLog(
           "AGENT_DEVICE_RUNNER_SNAPSHOT_RECOVERED backend=%@ reason=%@",
           kind.rawValue,
-          firstFailure?.reason ?? "sparse tree"
+          verdictReason?.reason ?? "sparse tree"
         )
       }
       return stampedSnapshotPayload(
         capture,
         backend: kind,
         state: recovered ? .recovered : .healthy,
-        reason: recovered || firstFailure?.code == "requested-backend" ? firstFailure : nil
+        reason: recovered || firstFailure?.code == "requested-backend" ? verdictReason : nil
       )
     }
 
@@ -425,13 +449,18 @@ extension RunnerTests {
       }
     }
 
+    let terminalReason = Self.planVerdictReason(
+      xCTestTierRan: xCTestTierRan,
+      state: effective.xCTestChannelState,
+      firstFailure: firstFailure
+    )
     let fallbackPayload =
-
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/RunnerTests.swift` (modified, +4/-0)
```diff
@@ -5,6 +5,7 @@
 //  Created by Michał Pierzchała on 30/01/2026.
 //
 
+import AgentDeviceSnapshotPresentation
 import XCTest
 import Network
 #if canImport(UIKit)
@@ -199,6 +200,9 @@ final class RunnerTests: XCTestCase {
   // live SpringBoard alert. Production never compiles this property. Stored here (rather than in
   // the extension that reads it) because Swift extensions cannot hold stored properties.
   var systemModalProbeOverrideForTesting: (@MainActor (Date) -> DataPayload?)?
+  /// Stands in for the private AX tier's acquisition in unit-test builds, so a plan can meet the
+  /// out-of-process sheet the tier cannot read. Production builds compile none of this.
+  var privateAXAcquisitionOverrideForTesting: (() -> SnapshotAcquisition?)?
   var blockingSystemModalPresenceOverrideForTesting: Bool?
   var alertResolutionOverrideForTesting: (@MainActor (Date) -> RunnerAlert?)?
   var alertButtonHittabilityProbeOverrideForTesting: (@MainActor (Date) -> Bool)?
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/UnitTests/RunnerTests+SnapshotCapturePlanOccupancyTests.swift` (modified, +122/-0)
```diff
@@ -380,5 +380,127 @@ extension RunnerTests {
     )
     XCTAssertFalse(hasAbandonedMainThreadWork())
   }
+
+  /// The Save Password sheet shape: the channel is penalized and private AX cannot match the app
+  /// behind the out-of-process sheet. The deferred plan recovers through the bounded tree and
+  /// reports the bounded slice as its reason. That the sweep stays off the plan is the plan's own
+  /// contract (`effectiveSnapshotCapturePlan`).
+  func testPenalizedPlanRecoversThroughTheBoundedTreeWhenPrivateAXReadsNothing() throws {
+    let captureTarget = try launchPenalizedPrivateAXBlindTarget(
+      bundleId: "com.callstack.agentdevice.runner.penalized-tree-recovery-test"
+    )
+    defer { tearDownPenalizedPrivateAXBlindTarget() }
+
+    let payload = try runDeferredPlanOffMain(target: captureTarget)
+
+    let quality = try XCTUnwrap(payload.snapshotQuality)
+    XCTAssertEqual(quality.reasonCode, "budget")
+    if quality.state == .sparse {
+      throw XCTSkip("the bounded tree did not answer within its slice on this host")
+    }
+    XCTAssertEqual(quality.state, .recovered)
+    XCTAssertEqual(quality.backend, SnapshotBackendKind.recursiveTree.rawValue)
+    XCTAssertGreaterThan(payload.nodes?.count ?? 0, 1, "the bounded tree answers with a real tree")
+  }
+
+  /// When the bounded tree also grinds past its slice, the plan ends sparse, and the verdict still
+  /// names the bounded slice the capture ran on rather than the seeded pre-selection.
+  func testPenalizedPlanThatEndsSparseAfterTheBoundedTreeReportsTheBudget() throws {
+    guard
+      let snapshotMethod = class_getInstanceMethod(
+        XCUIApplication.self,
+        #selector(XCUIElement.snapshot)
+      ),
+      let stubMethod = class_getInstanceMethod(
+        RunnerBlockingSnapshotStub.self,
+        #selector(RunnerBlockingSnapshotStub.snapshot)
+      )
+    else {
+      XCTFail("unable to install the blocking snapshot stub")
+      return
+    }
+    let captureTarget = try launchPenalizedPrivateAXBlindTarget(
+      bundleId: "com.callstack.agentdevice.runner.penalized-tree-timeout-test"
+    )
+    RunnerBlockingSnapshotGate.release = DispatchSemaphore(value: 0)
+    RunnerBlockingSnapshotGate.entered = DispatchSemaphore(value: 0)
+    let originalImplementation = method_getImplementation(snapshotMethod)
+    method_setImplementation(snapshotMethod, method_getImplementation(stubMethod))
+    defer {
+      RunnerBlockingSnapshotGate.release.signal()
+      method_setImplementation(snapshotMethod, originalImplementation)
+      let drainDeadline = Date().addingTimeInterval(3)
+      while hasAbandonedMainThreadWork(), Date() < drainDeadline {
+        RunLoop.current.run(until: Date().addingTimeInterval(0.05))
+      }
+      tearDownPenalizedPrivateAXBlindTarget()
+    }
+
+    let payload = try runDeferredPlanOffMain(target: captureTarget) {
+      RunnerBlockingSnapshotGate.release.signal()
+    }
+
+    let quality = try XCTUnwrap(payload.snapshotQuality)
+    XCTAssertEqual(quality.state, .sparse)
+    XCTAssertEqual(quality.reasonCode, "budget")
+  }
+
+  private func launchPenalizedPrivateAXBlindTarget(bundleId: String) throws -> SnapshotCaptureTarget {
+    app.launchArguments = ["--agent-device-selector-read-regression"]
+    app.launch()
+    XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
+    XCTAssertFalse(app.frame.isEmpty)
+    MainActor.assumeIsolated {
+      mainOwned.app = app
+      mainOwned.bundleId = bundleId
+    }
+    snapshotXCTestPenaltyWarmupExemption.isPending = false
+    let captureTarget = MainActor.assumeIsolated { takeSnapshotCaptureTarget(app: app) }
+    penalizeSnapshotXCTestChannel(bundleId: captureTarget.bundleId, reason: "test-setup")
+    privateAXAcquisitionOverrideForTesting = { nil }
+    return captureTarget
+  }
+
+  private func tearDownPenalizedPrivateAXBlindTarget() {
+    privateAXAcquisitionOverrideForTesting = nil
+    clearSnapshotXCTestChannelPenalty(reason: "test-
```

**File**: `apple/runner/AgentDeviceRunner/AgentDeviceRunnerUITests/UnitTests/RunnerTests+SnapshotCapturePlanTests.swift` (modified, +20/-3)
```diff
@@ -403,14 +403,14 @@ extension RunnerTests {
     XCTAssertEqual(pinned.xCTestChannelState, .deferredToIndependentBackend)
   }
 
-  func testEffectiveSnapshotCapturePlanDefersXCTestBackedTiersOnlyWhenPenalizedRegularPlan() {
+  func testEffectiveSnapshotCapturePlanPutsXCTestBackedTiersBehindPrivateAXOnlyWhenPenalizedRegularPlan() {
     let regular = Self.effectiveSnapshotCapturePlan(
       Self.regularVisiblePlan,
       xCTestChannelPenalized: true
     )
-    XCTAssertEqual(regular.plan, [.privateAX])
+    XCTAssertEqual(regular.plan, [.privateAX, .recursiveTree])
     XCTAssertEqual(regular.xCTestChannelState, .deferredToIndependentBackend)
-    XCTAssertNil(regular.treeCaptureSliceBudgetOverride)
+    XCTAssertEqual(regular.treeCaptureSliceBudgetOverride, Self.penalizedXCTestProbeTreeSliceBudget)
 
     let unpenalized = Self.effectiveSnapshotCapturePlan(
       Self.regularVisiblePlan,
@@ -430,6 +430,23 @@ extension RunnerTests {
     XCTAssertNil(raw.treeCaptureSliceBudgetOverride)
   }
 
+  func testPlanVerdictReasonNamesTheBoundedProbeOnceAnXCTestTierRanBehindPrivateAX() {
+    let deferred = Self.xcTestChannelStateFirstFailure(.deferredToIndependentBackend)
+    XCTAssertEqual(
+      Self.planVerdictReason(
+        xCTestTierRan: true, state: .deferredToIndependentBackend, firstFailure: deferred
+      )?.code,
+      "budget"
+    )
+    XCTAssertEqual(
+      Self.planVerdictReason(
+        xCTestTierRan: false, state: .deferredToIndependentBackend, firstFailure: deferred
+      )?.code,
+      "deferred"
+    )
+    XCTAssertNil(Self.planVerdictReason(xCTestTierRan: true, state: .normal, firstFailure: nil))
+  }
+
   func testEffectiveSnapshotCapturePlanUsesBoundedXCTestProbeWhenNoIndependentBackendRuns() {
     let physicalDevicePlan = Self.effectiveSnapshotCapturePlan(
       Self.regularVisiblePlan,
```

---

### Incident Patch 9: `0903e3dd` (2026-09-29)
**Commit Message**: fix(daemon-client): a restart probe cut short by the RPC deadline reports the timeout (#3056)

* fix(daemon-client): a restart probe cut short by the RPC deadline reports the timeout

Node timers start from the event loop's cached clock, so the restart
health probe's timer can expire while performance.now() is still short
of the RPC deadline. The retry then threw 'Remote daemon is
unavailable' instead of the request timeout, which flaked 'a delayed
restart health probe stops at the RPC deadline without retrying' on CI.

The health probe now marks a result that ran out of time, and the
restart retry reports a probe the deadline capped that timed out as
the RPC timing out.

* test(daemon-client): pin that the lagging-clock test reaches the probe

**File**: `src/daemon-client/__tests__/daemon-client-transport.test.ts` (modified, +35/-1)
```diff
@@ -1,6 +1,6 @@
 import assert from 'node:assert/strict';
 import http from 'node:http';
-import { test } from 'vitest';
+import { test, vi } from 'vitest';
 import { AppError } from '@agent-device/kernel/errors';
 import {
   DAEMON_HTTP_INSTANCE_HEADER,
@@ -222,6 +222,40 @@ test('a delayed restart health probe stops at the RPC deadline without retrying'
   }
 });
 
+test('a restart health probe cut short by the RPC deadline reports the deadline on a lagging clock', async (t) => {
+  if (await skipWhenLoopbackUnavailable(t)) return;
+  let rpcCount = 0;
+  let healthProbes = 0;
+  const server = http.createServer((req, res) => {
+    if (req.url === '/health') {
+      healthProbes += 1;
+      const delayedResponse = setTimeout(() => res.end('{}'), 1000);
+      res.on('close', () => clearTimeout(delayedResponse));
+      return;
+    }
+    rpcCount += 1;
+    res.statusCode = 409;
+    res.setHeader(DAEMON_HTTP_INSTANCE_MISMATCH_HEADER, 'true');
+    res.end();
+  });
+  // Timers start from the event loop's cached clock, so the probe's timer can fire while
+  // performance.now() is still short of the deadline. A frozen clock makes that gap certain.
+  const now = vi.spyOn(performance, 'now').mockReturnValue(performance.now());
+  try {
+    const port = await listenOnLoopback(server);
+    await assert.rejects(
+      sendWithStaleInstance(port, 150),
+      (error: unknown) =>
+        error instanceof AppError && error.details?.reason === 'daemon_transport_timeout',
+    );
+    assert.equal(rpcCount, 1);
+    assert.equal(healthProbes, 1);
+  } finally {
+    now.mockRestore();
+    await closeLoopbackServer(server);
+  }
+});
+
 test('proxy forwards cached upstream identity and rejects a restarted upstream before dispatch', async (t) => {
   if (await skipWhenLoopbackUnavailable(t)) return;
   let upstreamInstance = 'upstream-one';
```

**File**: `src/daemon-client/daemon-client-transport.ts` (modified, +26/-6)
```diff
@@ -42,6 +42,8 @@ export type RemoteDaemonHealth = {
   instanceId?: string;
   /** The daemon behind a proxy, as the proxy's health reported it. */
   upstream?: RemoteDaemonHealthLink;
+  /** The probe ran out of its time budget before an answer, rather than failing outright. */
+  timedOut?: true;
 };
 
 type RemoteDaemonHealthLink = Pick<
@@ -137,9 +139,12 @@ async function readDaemonHttpHealth(
     info.baseUrl ? REMOTE_DAEMON_HEALTHCHECK_TIMEOUT_MS : LOCAL_DAEMON_HEALTHCHECK_TIMEOUT_MS,
     probeTimeoutMs ?? Number.POSITIVE_INFINITY,
   );
-  if (timeoutMs <= 0) return { reachable: false };
+  if (timeoutMs <= 0) return { reachable: false, timedOut: true };
+  const signal = AbortSignal.timeout(Math.ceil(timeoutMs));
   return await new Promise((resolve) => {
     const headers = info.baseUrl ? buildDaemonHttpAuthHeaders(info.token) : {};
+    const unreachable = (): RemoteDaemonHealth =>
+      signal.aborted ? { reachable: false, timedOut: true } : { reachable: false };
     const req = transport.request(
       {
         protocol: url.protocol,
@@ -148,7 +153,7 @@ async function readDaemonHttpHealth(
         path: url.pathname + url.search,
         method: 'GET',
         timeout: timeoutMs,
-        signal: AbortSignal.timeout(Math.ceil(timeoutMs)),
+        signal,
         headers,
       },
       (res) => {
@@ -165,16 +170,16 @@ async function readDaemonHttpHealth(
             ...readHealthPayload(body),
           });
         });
-        res.on('error', () => resolve({ reachable: false }));
-        res.on('aborted', () => resolve({ reachable: false }));
+        res.on('error', () => resolve(unreachable()));
+        res.on('aborted', () => resolve(unreachable()));
       },
     );
     req.on('timeout', () => {
       req.destroy();
-      resolve({ reachable: false });
+      resolve({ reachable: false, timedOut: true });
     });
     req.on('error', () => {
-      resolve({ reachable: false });
+      resolve(unreachable());
     });
     req.end();
   });
@@ -255,6 +260,21 @@ async function retryAfterRemoteInstanceMismatch(
     deadline,
   );
   const health = await readRemoteDaemonHealth(info, probeTimeoutMs);
+  // The probe's timer starts from the event loop's cached clock, so it can expire while
+  // performance.now() is still short of the deadline: a probe the RPC deadline capped that ran out
+  // of time is the RPC timing out.
+  if (
+    health.timedOut &&
+    timeoutMs !== undefined &&
+    probeTimeoutMs !== undefined &&
+    probeTimeoutMs <= REMOTE_DAEMON_HEALTHCHECK_TIMEOUT_MS
+  ) {
+    throw handleRequestTimeout({
+      info,
+      statePaths,
+      ...timeoutRequestContext(req, true, timeoutMs),
+    });
+  }
   const remainingMs = remainingRemoteRequestTimeoutMs(info, req, statePaths, timeoutMs, deadline);
   if (!health.reachable) {
     throw new AppError('COMMAND_FAILED', 'Remote daemon is unavailable', {
```

**File**: `test/wire-compat/ledger.json` (modified, +12/-12)
```diff
@@ -63,9 +63,9 @@
     "src/daemon-client/daemon-client-rpc.ts#rejectDaemonHttpRpcError": "sha256:83b0312fe88bc3b3497de799e23d8d14455f665b7cf880f4617cd62b181351cd",
     "src/daemon-client/daemon-client-rpc.ts#resolveDaemonHttpResult": "sha256:296f9d376ce67c8cb20209bdf1c59c2423ffcfa35b5565a99e70271263149048",
     "src/daemon-client/daemon-client-rpc.ts#toDaemonHttpRpcError": "sha256:888246763c48670e7da893054d025744654f8715c3b4906312617a2b5028316b",
-    "src/daemon-client/daemon-client-transport.ts#RemoteDaemonHealth": "sha256:df6b92e343a451a03b194e1e4aacac0c89b48a632723af24e087b377e73e05e3",
+    "src/daemon-client/daemon-client-transport.ts#RemoteDaemonHealth": "sha256:a3380ef1b8d85808111eb0a00533430cf64ea76d9d0c35596080077795380475",
     "src/daemon-client/daemon-client-transport.ts#RemoteDaemonHealthLink": "sha256:464809c9bb14b44d098781722e9e9e2ff044c45464e3c7c4cb5690886e857fdf",
-    "src/daemon-client/daemon-client-transport.ts#readDaemonHttpHealth": "sha256:6b64ae9b8e461a4b7dc1afb88465fcbaef908c31cc0be24499b2f440616e1cb5",
+    "src/daemon-client/daemon-client-transport.ts#readDaemonHttpHealth": "sha256:eef0e153eb6f0bc02175e464dd6d98559b500b65ea8c74ba2203cfef09ec09a0",
     "src/daemon-client/daemon-client-transport.ts#readHealthLink": "sha256:d7a84687d1c9b089460151a0532870e92a932d45f9567d248cea7accf8908593",
     "src/daemon-client/daemon-client-transport.ts#readHealthPayload": "sha256:4e85ffc3e35e02379c393e9312344757e003cf1f0ad9eb8d1f77d90c81c861f1",
     "src/daemon-client/daemon-client-transport.ts#readRemoteDaemonHealth": "sha256:bcefa89fbb7fcbd6fee1b5ecb217955b9eee8d6fd2ad175fb653011edbd199d9",
@@ -267,11 +267,6 @@
       "digest": "sha256:4e85ffc3e35e02379c393e9312344757e003cf1f0ad9eb8d1f77d90c81c861f1",
       "rationale": "#2198 slice B teaches the client to read the `upstream` link a proxy's /health already nests. The field is optional and additive: a daemon or proxy that does not send it parses exactly as before, and no request shape changes. readHealthPayload reads the same top-level fields through readHealthLink and additionally the nested `upstream` object when present; a payload without it yields the previous shape."
     },
-    {
-      "declaration": "src/daemon-client/daemon-client-transport.ts#readDaemonHttpHealth",
-      "digest": "sha256:6b64ae9b8e461a4b7dc1afb88465fcbaef908c31cc0be24499b2f440616e1cb5",
-      "rationale": "#2650 gives every HTTP health probe a total-time cap (3s remote or 500ms local), including response-body reads. A restart retry also uses the RPC's remaining deadline. The health request and accepted payload fields are unchanged; stalled probes now end sooner."
-    },
     {
       "declaration": "src/daemon-client/daemon-client-transport.ts#readRemoteDaemonHealth",
       "digest": "sha256:bcefa89fbb7fcbd6fee1b5ecb217955b9eee8d6fd2ad175fb653011edbd199d9",
@@ -357,11 +352,6 @@
       "digest": "sha256:4398710f0faac4dbe76ca448c1dd87ff6d062016c1f4e52f610f7a8729453688",
       "rationale": "#2650 adds an optional daemon instance ID to health metadata or reads it when present. Older peers ignore the added field, and new clients keep probing legacy peers without an instance ID; existing fields and RPC envelopes are unchanged."
     },
-    {
-      "declaration": "src/daemon-client/daemon-client-transport.ts#RemoteDaemonHealth",
-      "digest": "sha256:df6b92e343a451a03b194e1e4aacac0c89b48a632723af24e087b377e73e05e3",
-      "rationale": "#2650 adds an optional daemon instance ID to health metadata or reads it when present. Older peers ignore the added field, and new clients keep probing legacy peers without an instance ID; existing fields and RPC envelopes are unchanged."
-    },
     {
       "declaration": "src/daemon-client/daemon-client-transport.ts#RemoteDaemonHealthLink",
       "digest": "sha256:464809c9bb14b44d098781722e9e9e2ff044c45464e3c7c4cb5690886e857fdf",
@@ -426,6 +416,16 @@
       "declaration": "src/daemon-client/daemon-client-transport.ts#isRemoteInstanceMismat
```

---

### Incident Patch 10: `289871b8` (2026-09-29)
**Commit Message**: fix(ios): give boot a --timeout startup budget (#3008)

* fix(ios): give boot a --timeout startup budget (#3004)

The first boot of a never-booted Simulator runs Apple's first-boot
migration, which can take minutes, but `boot`'s fixed 90s client
envelope and 120s daemon-side boot wait had no way to raise it.

- `boot --timeout <ms>` is a daemon-side startup budget, mirroring
  open/prepare (#2325): the client envelope keeps a 30s margin over it
  so the daemon's own `boot_timeout` result wins the race, and the
  budget reaches the Simulator boot wait as an absolute deadline.
- Expiry fails with `error.details.reason: boot_timeout` and leaves
  the Simulator booting, so a retry finds it further along.

Closes #3004

* fix(daemon): validate boot's --timeout deadline and cover it with a test

Compute the absolute boot deadline once at the daemon boundary, the same
way open/prepare already do, instead of converting a raw timeoutMs inside
the Apple runtime. This fixes a NaN/non-positive value silently disabling
the boot_timeout budget, and removes the second, looser conversion path.

Also adds a handler test asserting flags.timeoutMs reaches bootTarget's
deadline, tightens the runtime-l

**File**: `packages/command-registry/src/flag-definitions-workflow.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export const WORKFLOW_FLAG_DEFINITIONS: readonly FlagDefinition[] = [
     min: 1,
     usageLabel: '--timeout <ms>',
     usageDescription:
-      'Open/Prepare: startup budget covering the Simulator boot (and runner preparation for prepare). Replay/Snapshot/Test: maximum wall-clock time for the command or attempt. With --settle: the settle-wait deadline (default 10s)',
+      'Boot/Open/Prepare: startup budget covering the Simulator boot (and runner preparation for prepare). Replay/Snapshot/Test: maximum wall-clock time for the command or attempt. With --settle: the settle-wait deadline (default 10s)',
     projectConfig: true,
     recorded: false,
   },
```

**File**: `packages/command-registry/src/registry.ts` (modified, +3/-1)
```diff
@@ -714,7 +714,9 @@ export const RAW_COMMAND_DESCRIPTORS = [
       sessionKind: 'state',
     },
     platformExecution: { kind: 'device-runtime', uses: deviceBootRuntimeUses },
-    timeoutPolicy: DEFAULT_TIMEOUT_POLICY,
+    // --timeout is a startup budget: it reaches the Simulator boot wait, same as open/prepare
+    // (#2325). A first boot can outlast the fixed 90s envelope (#3004).
+    timeoutPolicy: { ...DEFAULT_TIMEOUT_POLICY, budget: { source: 'flag', envelope: 'margin' } },
     batchable: true,
   },
   {
```

**File**: `packages/contracts/src/client-device-view.ts` (modified, +2/-0)
```diff
@@ -101,6 +101,8 @@ export type StartupPerfSample = {
 
 export type DeviceBootOptions = DeviceCommandBaseOptions & {
   headless?: boolean;
+  /** Startup budget in milliseconds: bounds the Simulator boot wait on a cold device. */
+  timeoutMs?: number;
 };
 
 export type DeviceShutdownOptions = DeviceCommandBaseOptions;
```

**File**: `packages/contracts/src/device-readiness-runtime.ts` (modified, +5/-0)
```diff
@@ -4,6 +4,11 @@ import type { DeviceInventoryRequest } from './device-inventory.ts';
 export type EnsureReadyInput = Readonly<{
   serial?: string;
   androidSerialAllowlist?: readonly string[];
+  /**
+   * Absolute deadline (epoch ms), from `boot --timeout`, already validated finite and positive.
+   * Bounds a cold Simulator boot wait; the Apple runtime is the only current consumer.
+   */
+  deadlineAtMs?: number;
 }>;
 
 export type DeviceReadinessRuntimeOperations = Readonly<{
```

**File**: `packages/platform-apple/src/runtime.test.ts` (modified, +48/-0)
```diff
@@ -522,6 +522,54 @@ test('readiness and boot keep the Apple automation helper warm inside the platfo
   expect(keepHot).toHaveBeenNthCalledWith(3, device);
 });
 
+test('bootTarget forwards a --timeout budget as the Simulator boot deadline (#3004)', async () => {
+  const host = platformRuntimeHostFixture();
+  let state = 'Shutdown';
+  const calls: Array<{ args: readonly string[]; timeoutMs?: number }> = [];
+  const runtime = createApplePlatformRuntime({
+    ...host,
+    appleTools: {
+      ...host.appleTools,
+      run: vi.fn(async (request) => {
+        calls.push({ args: request.args, timeoutMs: request.timeoutMs });
+        if (request.args.includes('list')) {
+          return {
+            stdout: JSON.stringify({ devices: { ios: [{ udid: 'apple-fact', state }] } }),
+            stderr: '',
+            exitCode: 0,
+          };
+        }
+        if (request.args.includes('boot')) state = 'Booted';
+        return { stdout: '', stderr: '', exitCode: 0 };
+      }),
+    },
+  });
+  const device = appleDevice({ booted: false });
+  const binding = await runtime.bind({
+    device,
+    intent: { kind: 'ordinary' },
+    scope: {
+      signal: new AbortController().signal,
+      diagnostics: { emit: () => {} },
+      progress: { report: () => {} },
+    },
+  });
+
+  const deadlineAtMs = Date.now() + 45_000;
+  await binding.operations.bootTarget?.({ deadlineAtMs });
+
+  // The startup budget reaches the boot wait, same as open/prepare (#2325): every simctl call the
+  // wait issues runs under the caller's --timeout budget until the absolute deadline, not a fixed
+  // default. Both `boot` and `bootstatus` derive their timeout from the same deadline, so both
+  // must sit within a tight window of the 45s budget - a fixed default like 10s or 30s would fail.
+  const bootCall = calls.find((call) => call.args.includes('boot'));
+  const bootstatusCall = calls.find((call) => call.args.includes('bootstatus'));
+  expect(bootCall?.timeoutMs).toBeGreaterThan(44_900);
+  expect(bootCall?.timeoutMs).toBeLessThanOrEqual(45_000);
+  expect(bootstatusCall?.timeoutMs).toBeGreaterThan(44_900);
+  expect(bootstatusCall?.timeoutMs).toBeLessThanOrEqual(45_000);
+});
+
 test('macOS readiness is a no-op while boot remains unavailable', async () => {
   const host = platformRuntimeHostFixture();
   const ensureConnected = vi.fn(host.deviceReadiness.applePhysical.ensureConnected);
```

#### Recent Merged Pull Requests:
- **PR #3070** (2026-09-30): fix(provider-webdriver): never resend a mutating WebDriver request (@thymikee)
- **PR #3068** (2026-09-30): fix(daemon-client): classify endpoint-unavailable errors by typed reason (@thymikee)
- **PR #3066** (2026-09-30): test(web): wait for the killed fake daemon to be reaped before asserting it is gone (@okwasniewski)
- **PR #3065** (2026-09-30): fix(ios): write the simulator clipboard from the runner (@okwasniewski)
- **PR #3064** (2026-09-30): feat: add daemon policy to confine devices, commands, and device shutdown (@szdziedzic)
- **PR #3063** (2026-09-29): test(ios-smoke): wait once more when the runner is still starting behind a deep link (@okwasniewski)
- **PR #3059** (2026-09-29): fix(android): honor boot --timeout as the emulator boot deadline (@thymikee)
- **PR #3058** (2026-09-29): test(daemon-client): a restart probe that fails outright near the RPC deadline reports the daemon unavailable (@thymikee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
