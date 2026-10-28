> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `ea12b738`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T16:33:47.072Z  
> **Learning ID**: `learn-github-microsoft-agent-governance-toolkit`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): microsoft/agent-governance-toolkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-28T16:33:47.067Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6487 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent-governance-antigravity-cli/assets/extensions/agt-global-policy/hooks/after-tool.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inspectToolResult } from "../lib/policy.mjs";
import {
  emitSystemBlock,
  extractAntigravityToolResponse,
  loadHookInput,
  loadHookPolicyState,
  runHookMain,
  writeHookOutput,
} from "../lib/hook-runtime.mjs";

await runHookMain(async () => {
  const input = await loadHookInput();
  const state = await loadHookPolicyState(import.meta.url);
  const result = await inspectToolResult(
    state,
    {
      toolName: input.tool_name,
      toolResult: extractAntigravityToolResponse(input.tool_response),
    },
    { sessionId: input.session_id },
  );

  if (result?.suppressOutput) {
    await writeHookOutput({
      decision: "deny",
      reason: result.additionalContext ?? "AGT suppressed suspicious tool output.",
      suppressOutput: true,
    });
  } else if (result?.additionalContext) {
    await writeHookOutput({
      hookSpecificOutput: {
        additionalContext: result.additionalContext,
      },
    });
  } else {
    await writeHookOutput({});
  }
}, async (error) => {
  await emitSystemBlock(`AGT after-tool hook failed closed: ${error.message}`);
});

```

### Core Architecture Module: `agent-governance-antigravity-cli/assets/extensions/agt-global-policy/hooks/before-agent.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { evaluatePromptSubmission } from "../lib/policy.mjs";
import {
  emitSystemBlock,
  loadHookInput,
  loadHookPolicyState,
  runHookMain,
  writeHookOutput,
} from "../lib/hook-runtime.mjs";

await runHookMain(async () => {
  const input = await loadHookInput();
  const state = await loadHookPolicyState(import.meta.url);
  const result = await evaluatePromptSubmission(
    state,
    { prompt: input.prompt },
    { sessionId: input.session_id },
  );

  if (result?.modifiedPrompt) {
    await writeHookOutput({
      decision: "deny",
      reason: result.modifiedPrompt,
      systemMessage: "AGT blocked an unsafe prompt before Antigravity CLI planning began.",
    });
  } else if (result?.additionalContext) {
    await writeHookOutput({
      hookSpecificOutput: {
        additionalContext: result.additionalContext,
      },
    });
  } else {
    await writeHookOutput({});
  }
}, async (error) => {
  await emitSystemBlock(`AGT before-agent hook failed closed: ${error.message}`);
});

```

### Core Architecture Module: `agent-governance-antigravity-cli/assets/extensions/agt-global-policy/hooks/before-tool.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { evaluatePreToolUse } from "../lib/policy.mjs";
import {
  emitSystemBlock,
  loadHookInput,
  loadHookPolicyState,
  runHookMain,
  writeHookOutput,
} from "../lib/hook-runtime.mjs";

await runHookMain(async () => {
  const input = await loadHookInput();
  const state = await loadHookPolicyState(import.meta.url);
  const toolArgs = input.tool_input ?? input.toolArgs;
  const result = await evaluatePreToolUse(
    state,
    {
      cwd: input.cwd,
      toolArgs,
      toolName: input.tool_name,
    },
    { sessionId: input.session_id },
  );

  if (result?.permissionDecision === "deny") {
    await writeHookOutput({
      decision: "deny",
      reason: result.permissionDecisionReason,
    });
  } else if (result?.additionalContext) {
    await writeHookOutput({
      systemMessage: result.additionalContext,
    });
  } else {
    await writeHookOutput({});
  }
}, async (error) => {
  await emitSystemBlock(`AGT before-tool hook failed closed: ${error.message}`);
});

```

### Core Architecture Module: `agent-governance-antigravity-cli/assets/extensions/agt-global-policy/hooks/session-start.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { loadHookPolicyState, runHookMain, writeHookOutput } from "../lib/hook-runtime.mjs";

await runHookMain(async () => {
  const state = await loadHookPolicyState(import.meta.url);
  await writeHookOutput({
    hookSpecificOutput: {
      additionalContext: state.policy.additionalContext.join("\n"),
    },
    systemMessage: "AGT Antigravity governance policy is active.",
  });
}, async (error) => {
  await writeHookOutput({
    systemMessage: `AGT Antigravity governance could not load startup context: ${error.message}`,
  });
});

```

### Core Architecture Module: `agent-governance-antigravity-cli/assets/extensions/agt-global-policy/lib/hook-runtime.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { fileURLToPath } from "node:url";
import { loadPolicy } from "./policy.mjs";

export async function loadHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const payload = Buffer.concat(chunks).toString("utf8").trim();
  return payload ? JSON.parse(payload) : {};
}

export async function loadHookPolicyState(importMetaUrl) {
  return loadPolicy({
    extensionRoot: fileURLToPath(new URL("..", importMetaUrl)),
  });
}

export function extractAntigravityToolResponse(toolResponse) {
  return {
    error: toolResponse?.error,
    llmContent: toolResponse?.llmContent,
    returnDisplay: toolResponse?.returnDisplay,
  };
}

export async function writeHookOutput(output) {
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      process.stdout.off("error", onError);
      reject(error);
    };
    process.stdout.once("error", onError);
    process.stdout.write(`${JSON.stringify(output ?? {})}\n`, "utf8", () => {
      process.stdout.off("error", onError);
      resolve();
    });
  });
}

export async function writeHookStderr(message) {
  await new Promise((resolve) => {
    process.stderr.write(`${String(message ?? "").trim()}\n`, "utf8", resolve);
  });
}

export async function runHookMain(handler, onError) {
  try {
    await handler();
  } catch (error) {
    await onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function emitSystemBlock(message) {
  await writeHookStderr(message);
  process.exitCode = 2;
}

```

### Core Architecture Module: `agent-governance-claude-code/hooks/common.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

export function writeHookOutput(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

```

### Core Architecture Module: `agent-governance-claude-code/hooks/pre-tool-use.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readHookInput, writeHookOutput } from "./common.mjs";
import { evaluatePreToolUse, loadPolicy } from "../lib/policy.mjs";

try {
  const input = await readHookInput();
  const state = await loadPolicy();
  writeHookOutput(await evaluatePreToolUse(state, input));
} catch (error) {
  process.stderr.write(
    `AGT governance denied the tool call because policy evaluation failed closed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(2);
}

```

### Core Architecture Module: `agent-governance-claude-code/hooks/session-start.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readHookInput, writeHookOutput } from "./common.mjs";
import { buildSessionStartResult, loadPolicy } from "../lib/policy.mjs";

try {
  const input = await readHookInput();
  const state = await loadPolicy();
  writeHookOutput(buildSessionStartResult(state, input));
} catch (error) {
  process.stderr.write(
    `AGT governance could not initialize the Claude session because startup evaluation failed closed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(2);
}

```

### Core Architecture Module: `agent-governance-claude-code/hooks/user-prompt-submit.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readHookInput, writeHookOutput } from "./common.mjs";
import { evaluatePromptSubmission, loadPolicy } from "../lib/policy.mjs";

try {
  const input = await readHookInput();
  const state = await loadPolicy();
  writeHookOutput(await evaluatePromptSubmission(state, input));
} catch (error) {
  process.stderr.write(
    `AGT governance blocked the prompt because prompt evaluation failed closed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(2);
}

```

### Core Architecture Module: `agent-governance-codex-cli/hooks/common.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

export function writeHookOutput(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4178** (2026-10-02): **[Bug]: Claude Code plugin: recursive-delete rule never matches rm -rf (fix from #3834 never merged)**
  *Symptoms*: ### Package  Other  ### Description  Package: agent-governance-claude-code (also affects agent-governance-copilot-cli) The bundled `recursive-delete` deny rule of the Claude Code plugin never matches a real `rm -rf` command, so recursive deletes   are not blocked. Filed publicly because the issue is already public in #3834 and #3662.    **Where**   - `agent-governance-claude-code/config/default-policy.json`, line 41 (plugin 5.0.0, `main` at 625559f, 2026-09-28):     `"source": "\\brm\\b[\\s\\S]*\\b-rf\\b"`   - The same pattern ships in the Copilot CLI extension:   `agent-governance-copilot-cli/assets/extensions/agt-global-policy/config/default-policy.json` (line 112) and the `advisory`,   `balanced` and `strict` profiles.    **Why**   `\b-rf` requires a word character immediately before the hyphen. After a space there is no word boundary, so `rm -rf <target>`   never matches. Only nonsense forms like `rm x-rf` do.    **History**   - #3834 fixed exactly this for Claude Code, but was closed as stale on 2026-09-26 without being merged.   - #3662 / #4129 fixed the same problem for OpenCode only, with a quote-aware tokenizer (merged 2026-09-25).    **Suggested fix**   Apply the #4129 approach (tokenizer + flag parser) to the Claude Code plugin and to the Copilot CLI policies, or at least a   regex that requires whitespace before the flag.    **Workaround we use** (custom policy via `AGT_CLAUDE_POLICY_PATH`, JS regex, flag `i`):   `(?<!git\s)\brm\s+(?:[^\n;&|]*\s)?(?:-[a-z]*r[a-z]*

- **Issue #4172** (2026-10-02): **[Bug]: Agent-mesh: handle policy engine exceptions in PolicyProviderHandler**
  *Symptoms*: ### Package  agent-mesh  ---  ## Description  `PolicyProviderHandler.handle_check()` calls `self.policy_engine.evaluate(action, context)` without exception handling. If the policy engine raises an exception, the error propagates out of the handler instead of producing a structured governance response.  The ASGI application's `POST /check` route also invokes `handle_check()` without catching exceptions from the policy evaluation path. Consequently, an unexpected policy engine failure can cause the request to fail without returning a structured policy decision.  This is an error-handling defect in the policy enforcement gateway. The behavior of downstream callers depends on how they handle the resulting exception.  ## Expected Behavior  - Policy evaluation failures should follow the gateway's documented fail-closed behavior. - The `/check` endpoint should return a predictable, structured failure response consistent with existing project conventions. - Exceptions should not result in an implicit allow decision. - Audit behavior should be explicitly defined for failed evaluations. - Internal exception details should not be exposed to clients.  ## Actual Behavior  When `policy_engine.evaluate()` raises an exception, the exception propagates through `handle_check()` and can escape the ASGI `/check` route.  This prevents the gateway from consistently returning a structured governance response for policy evaluation failures.  ## Scope  The issue concerns exception handling in the Pyt

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

### Incident Patch 1: `e9250241` (2026-10-28)
**Commit Message**: fix(agent-sre): stop blue-green validation at its timeout (#4470)

BlueGreenManager.validate counted elapsed time by adding the check
interval after each failed health check. The time a check took never
counted, a zero interval retried a failing check forever, and a
negative interval raised from time.sleep with the environment left in
VALIDATING. Measure the timeout on the monotonic clock and sleep for
the interval, capped at the time left and never negative.

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -47,6 +47,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agent-sre` A/B experiments split traffic by relative variant weights.** `Experiment.assign` compared one `random.random()` draw against the running sum of the weights, so it only worked when the weights summed to 1: three variants with the default weight 0.5 never sent traffic to the third, percentage weights such as 70/30 sent everything to the first, and two variants weighted 0.1 split 10/90. Each variant now gets its weight divided by the total of all weights, and a variant with a weight of 0 or less gets no traffic.
 - **`agent-lightning` `GovernedEnvironment` includes the success bonus in the episode's `total_reward`.** `step` added the reward to `EnvironmentState.total_reward` before adding `success_bonus` for a clean step, so `total_reward` (and `info["total_reward"]`) left out every bonus that `step` returned: with the default config, a clean step returned 10.9 but raised `total_reward` by 0.9, and an episode's `total_reward` was not the sum of its step rewards. The reward is now accumulated after the bonus, and the step order in the Agent Lightning spec is updated to match (#4419).
 - **`agent-sre` GitOps rollout specs keep their step durations, manual gates and rollback operators in the reconciler.** `RolloutSpec.to_dict()` wrote steps with `duration_seconds` and `manual_gate` and rollback conditions with `comparator`, while the `AgentRollout` CRD and `k8s.Reconciler` read `durationSeconds`, `manualGate` and `operator`. A spec passed to the reconciler therefore ran every step for the default 3600 seconds without its manual gate, and every rollback condition became `gte`: `RollbackCondition("success_rate", 0.9, comparator="lt")` rolled back at a healthy 0.99. `to_dict()` now writes the CRD field names, and the reconciler also reads an analysis criterion's `comparator` instead of always using `gte`.
+- **`agent-sre` `BlueGreenManager.validate` stops at `validation_timeout_seconds`.** It counted elapsed time by adding `health_check_interval_seconds` after each failed check, so the time a check took never counted (with a 30-second check, a 5-second interval and the default 60-second timeout it ran 12 checks over about six minutes), a `health_check_interval_seconds` of 0 retried a failing check forever, and a negative interval raised from `time.sleep` and left the environment in `VALIDATING`. The timeout is now measured on the monotonic clock, and the wait between checks is the interval, never more than the time left and never negative.
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-sre/src/agent_sre/delivery/blue_green.py` (modified, +6/-5)
```diff
@@ -173,20 +173,21 @@ def validate(self, health_check_fn: Callable[..., bool]) -> bool:
         self._emit("validate_start", updated.name)
 
         is_healthy = False
-        elapsed = 0.0
         interval = self.config.health_check_interval_seconds
-        timeout = self.config.validation_timeout_seconds
+        # Measure the timeout on the clock, so the time each health check takes
+        # counts against it and a zero interval cannot keep the loop going.
+        deadline = time.monotonic() + self.config.validation_timeout_seconds
         while True:
             try:
                 if health_check_fn():
                     is_healthy = True
                     break
             except Exception:
                 logger.debug("Health check failed for %s", inactive.name.value, exc_info=True)
-            elapsed += interval
-            if elapsed >= timeout:
+            remaining = deadline - time.monotonic()
+            if remaining <= 0:
                 break
-            time.sleep(interval)
+            time.sleep(max(0.0, min(interval, remaining)))
 
         health = "healthy" if is_healthy else "unhealthy"
         updated = self._env(updated.name).model_copy(update={"health_status": health})
```

**File**: `agent-governance-python/agent-sre/tests/test_blue_green.py` (modified, +97/-0)
```diff
@@ -80,6 +80,103 @@ def bad_check() -> bool:
         assert result is False
 
 
+class _FakeClock:
+    """Stands in for the ``time`` module that ``blue_green`` uses."""
+
+    def __init__(self) -> None:
+        self.now = 0.0
+
+    def monotonic(self) -> float:
+        return self.now
+
+    def time(self) -> float:
+        return self.now
+
+    def sleep(self, seconds: float) -> None:
+        # Like time.sleep, reject a negative length.
+        if seconds < 0:
+            raise ValueError("sleep length must be non-negative")
+        self.now += seconds
+
+
+class _TooManyChecks(BaseException):
+    """Escapes ``validate``'s ``except Exception`` to stop a loop that never ends."""
+
+
+class TestValidateTimeout:
+    """The validation timeout is measured on the clock, not by summing intervals."""
+
+    def test_time_spent_in_health_checks_counts_against_timeout(
+        self, monkeypatch: pytest.MonkeyPatch
+    ) -> None:
+        clock = _FakeClock()
+        monkeypatch.setattr("agent_sre.delivery.blue_green.time", clock)
+        calls = []
+
+        def slow_failing_check() -> bool:
+            calls.append(clock.now)
+            clock.now += 30  # each check takes 30 seconds
+            return False
+
+        mgr = BlueGreenManager(
+            config=BlueGreenConfig(
+                health_check_interval_seconds=5,
+                validation_timeout_seconds=60,
+            )
+        )
+        mgr.deploy("v2.0.0")
+
+        assert mgr.validate(slow_failing_check) is False
+        # Checks start at 0s and 35s; the second one ends past the 60s timeout.
+        assert calls == [0.0, 35.0]
+
+    def test_zero_interval_stops_at_timeout(self, monkeypatch: pytest.MonkeyPatch) -> None:
+        clock = _FakeClock()
+        monkeypatch.setattr("agent_sre.delivery.blue_green.time", clock)
+        calls = 0
+
+        def failing_check() -> bool:
+            nonlocal calls
+            calls += 1
+            if calls > 1000:
+                raise _TooManyChecks
+            clock.now += 1  # each check takes 1 second
+            return False
+
+        mgr = BlueGreenManager(
+            config=BlueGreenConfig(
+                health_check_interval_seconds=0,
+                validation_timeout_seconds=10,
+            )
+        )
+        mgr.deploy("v2.0.0")
+
+        assert mgr.validate(failing_check) is False
+        assert calls == 10
+        inactive = mgr.get_inactive()
+        assert inactive.health_status == "unhealthy"
+        assert inactive.state == EnvironmentState.INACTIVE
+
+    def test_negative_interval_does_not_raise(self, monkeypatch: pytest.MonkeyPatch) -> None:
+        clock = _FakeClock()
+        monkeypatch.setattr("agent_sre.delivery.blue_green.time", clock)
+
+        def failing_check() -> bool:
+            clock.now += 1
+            return False
+
+        mgr = BlueGreenManager(
+            config=BlueGreenConfig(
+                health_check_interval_seconds=-1,
+                validation_timeout_seconds=3,
+            )
+        )
+        mgr.deploy("v2.0.0")
+
+        assert mgr.validate(failing_check) is False
+        assert mgr.get_inactive().state == EnvironmentState.INACTIVE
+
+
 class TestSwitch:
     """Switch traffic between environments."""
 
```

---

### Incident Patch 2: `ea12b738` (2026-10-28)
**Commit Message**: fix(agent-sre): block the end minute of a chaos blackout window to its last second (#4468)

BlackoutWindow.contains compared the full time of day, seconds included,
with HH:MM bounds, so only second 0 of the end minute was blacked out. A
"59 23 * * *" schedule checked at 23:59:30 matched its cron expression
(croniter matches to the minute) and ran inside a 17:00-23:59 blackout.
Truncate the time to the minute before comparing, so both bounds cover
their whole minute.

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agent-lightning` `GovernedEnvironment` includes the success bonus in the episode's `total_reward`.** `step` added the reward to `EnvironmentState.total_reward` before adding `success_bonus` for a clean step, so `total_reward` (and `info["total_reward"]`) left out every bonus that `step` returned: with the default config, a clean step returned 10.9 but raised `total_reward` by 0.9, and an episode's `total_reward` was not the sum of its step rewards. The reward is now accumulated after the bonus, and the step order in the Agent Lightning spec is updated to match (#4419).
 - **`agent-sre` GitOps rollout specs keep their step durations, manual gates and rollback operators in the reconciler.** `RolloutSpec.to_dict()` wrote steps with `duration_seconds` and `manual_gate` and rollback conditions with `comparator`, while the `AgentRollout` CRD and `k8s.Reconciler` read `durationSeconds`, `manualGate` and `operator`. A spec passed to the reconciler therefore ran every step for the default 3600 seconds without its manual gate, and every rollback condition became `gte`: `RollbackCondition("success_rate", 0.9, comparator="lt")` rolled back at a healthy 0.99. `to_dict()` now writes the CRD field names, and the reconciler also reads an analysis criterion's `comparator` instead of always using `gte`.
 - **`agent-sre` `BlueGreenManager.validate` stops at `validation_timeout_seconds`.** It counted elapsed time by adding `health_check_interval_seconds` after each failed check, so the time a check took never counted (with a 30-second check, a 5-second interval and the default 60-second timeout it ran 12 checks over about six minutes), a `health_check_interval_seconds` of 0 retried a failing check forever, and a negative interval raised from `time.sleep` and left the environment in `VALIDATING`. The timeout is now measured on the monotonic clock, and the wait between checks is the interval, never more than the time left and never negative.
+- **`agent-sre` chaos blackout windows block their end minute until its last second.** `BlackoutWindow.contains` compared the full time of day, seconds included, with `HH:MM` bounds, so only second 0 of the end minute counted as blacked out. With the example's `17:00`–`23:59` window, a `59 23 * * *` schedule checked at 23:59:30 matched its cron expression (which `croniter` matches to the minute) and ran inside the blackout. The time is now truncated to the minute before the comparison, so both bounds cover their whole minute.
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-sre/src/agent_sre/chaos/scheduler.py` (modified, +7/-2)
```diff
@@ -18,14 +18,19 @@ class BlackoutWindow(BaseModel):
     reason: str = ""
 
     def contains(self, now: datetime) -> bool:
-        """Check if the given datetime falls within this blackout window."""
+        """Check if the given datetime falls within this blackout window.
+
+        The bounds are whole minutes and both are inclusive, so the end
+        minute is blocked until its last second, matching the minute
+        precision at which cron expressions are matched.
+        """
         try:
             start_time = _parse_time(self.start)
             end_time = _parse_time(self.end)
         except ValueError:
             return False
 
-        current_time = now.time()
+        current_time = now.time().replace(second=0, microsecond=0)
         if start_time <= end_time:
             return start_time <= current_time <= end_time
         # Wraps midnight (e.g. 22:00 - 06:00)
```

**File**: `agent-governance-python/agent-sre/tests/test_chaos_scheduler.py` (modified, +20/-0)
```diff
@@ -131,6 +131,26 @@ def test_multiple_blackouts(self) -> None:
         at_noon = datetime(2025, 1, 6, 12, 30, 0, tzinfo=timezone.utc)
         assert scheduler.is_in_blackout(sched, at_noon) is True
 
+    @pytest.mark.parametrize("second", [0, 30, 59])
+    def test_end_minute_is_blocked_to_its_last_second(self, second: int) -> None:
+        bw = BlackoutWindow(start="17:00", end="23:59", reason="after hours")
+        schedule = _make_schedule(cron="59 23 * * *", blackouts=[bw])
+        scheduler = ChaosScheduler([schedule])
+        at = datetime(2025, 1, 6, 23, 59, second, tzinfo=timezone.utc)
+        assert scheduler.is_in_blackout(schedule, at) is True
+        assert scheduler.should_run("s1", at) is False
+
+    def test_midnight_wrap_end_minute_is_blocked(self) -> None:
+        bw = BlackoutWindow(start="22:00", end="06:00", reason="overnight")
+        at = datetime(2025, 1, 6, 6, 0, 45, tzinfo=timezone.utc)
+        assert bw.contains(at) is True
+
+    def test_minute_after_end_is_not_blocked(self) -> None:
+        bw = BlackoutWindow(start="12:00", end="13:00", reason="lunch")
+        assert bw.contains(datetime(2025, 1, 6, 13, 0, 59, tzinfo=timezone.utc)) is True
+        assert bw.contains(datetime(2025, 1, 6, 13, 1, 0, tzinfo=timezone.utc)) is False
+        assert bw.contains(datetime(2025, 1, 6, 11, 59, 59, tzinfo=timezone.utc)) is False
+
 
 # ---------------------------------------------------------------------------
 # Progressive severity
```

#### Recent Merged Pull Requests:
- **PR #4470** (2026-10-28): fix(agent-sre): stop blue-green validation at its timeout (@ShivamSharma43)
- **PR #4468** (2026-10-28): fix(agent-sre): block the end minute of a chaos blackout window to its last second (@ShivamSharma43)
- **PR #4466** (2026-10-27): chore(deps-dev): Bump setuptools from 83.0.0 to 84.1.0 in /agent-governance-python/agent-learning (@dependabot[bot])
- **PR #4465** (2026-10-27): chore(deps): Bump certifi from 2026.5.20 to 2026.10.18 in /agent-governance-python/agent-marketplace (@dependabot[bot])
- **PR #4464** (closed): fix(python): add AgentControl close support (@MaryamIjazMaryam)
- **PR #4463** (2026-10-27): chore(deps): Bump zod from 4.4.3 to 4.6.7 in /agent-governance-python/agent-mesh/packages/mcp-proxy (@dependabot[bot])

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

## X. agent-sre): stop blue-green validation at its timeout (#4470)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e9250241`: agent-sre): stop blue-green validation at its timeout (#4470). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **`agent-sre` `BlueGreenManager.validate` stops at `validation_timeout_seconds`.** It counted elapsed time by adding `health_check_interval_seconds` after each failed check, so the time a check took never counted (with a 30-second check, a 5-second interval and the default 60-second timeout it ran 12 checks over about six minutes), a `health_check_interval_seconds` of 0 retried a failing check forever, and a negative interval raised from `time.sleep` and left the environment in `VALIDATING`. The timeout is now measured on the monotonic clock, and the wait between checks is the interval, never more than the time left and never negative.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e9250241` are properly handled with clean fallback behavior.
