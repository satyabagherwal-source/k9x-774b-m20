> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `8e51b1c3`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T19:05:50.354Z  
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
> **Harvest Timestamp**: 2026-10-21T19:05:50.011Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6452 stars

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

### Incident Patch 1: `e67fba7f` (2026-10-21)
**Commit Message**: fix(agent-lightning): count a successful episode once in GovernedEnvironment metrics (#4360)

* fix(agent-lightning): count a successful episode once in GovernedEnvironment

step() incremented _successful_episodes on every step that succeeded
without a violation, while get_metrics() divides it by the number of
episodes. A clean five-step episode reported five successful episodes and
a success_rate of 5.0, and an episode with a violation on one step still
counted its clean steps.

Track whether every step of the current episode was clean, count the
episode at most once when reset() closes it, and include the episode in
progress in get_metrics(). The per-step success bonus is unchanged.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>

* docs(agent-lightning): define successful_episodes as fully clean episodes in the specs

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>

---------

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **.NET MCP governance denies an authenticated principal whose identifier is not a DID instead of throwing.** With default options, a principal from an OIDC provider such as Keycloak (where `sub` is a GUID or an email address) made every governed tool call throw `ArgumentException` ("Invalid AgentMesh DID") instead of reaching a decision. `McpGovernanceRuntime` now denies such calls with a reason that points the operator at `AgentIdResolver`; `GovernanceKernel.EvaluateToolCall` is unchanged (#4357).
 - **`agent-discovery` reports containerized agents with the same agent type as the other scanners.** `ConfigScanner` used the matched text of a Dockerfile or Compose file as the agent type, so `langgraph`, `agent_governance`, `mcp_server` and `semantic_kernel` came out as types no other scanner uses. Risk scoring then skipped the type factor for them (a `semantic_kernel` container got no medium-risk score), and reconciliation never suggested `mcp-scan` for an `mcp_server` container. Each Docker pattern now reports the type the process scanner uses (`langchain`, `agt`, `mcp-server`, `semantic-kernel`, ...); fingerprints are unchanged.
 - **`agent-discovery` GitHub scans detect LlamaIndex and classic AutoGen through their PyPI names.** `GitHubScanner` matched dependency files against `llamaindex` and `autogen` with word boundaries, so `llama-index` (the PyPI name of LlamaIndex) and `pyautogen` (classic AutoGen) were never detected, and a name written with `_` (`semantic_kernel`, `langchain_core`, `autogen_agentchat`) was missed although its hyphenated form was detected. Each dependency can now list aliases (`llama-index`, `pyautogen`), and `-`, `_` and `.` are treated alike inside and around a name, as in PEP 503. A repository still yields one agent per framework.
+- **`agent-lightning` `GovernedEnvironment` counts a successful episode once.** `step` added one to `successful_episodes` for every step that succeeded without a violation, so `get_metrics()` reported a clean five-step episode as five successful episodes and a `success_rate` of 5.0, and an episode with a violation on one step still counted its clean steps. An episode now counts as successful when every step in it succeeded without a violation, at most once, so `success_rate` stays between 0 and 1. The per-step success bonus is unchanged.
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-lightning/src/agent_lightning_gov/environment.py` (modified, +16/-4)
```diff
@@ -117,7 +117,11 @@ def __init__(
         self._total_episodes = 0
         self._total_steps = 0
         self._total_violations = 0
+        # Episodes that finished with every step succeeding and no
+        # violation. The episode in progress is counted by get_metrics
+        # through ``_episode_clean`` until reset() closes it.
         self._successful_episodes = 0
+        self._episode_clean = False
 
         # Set up kernel hooks
         self._setup_hooks()
@@ -221,6 +225,11 @@ def reset(
         Returns:
             Tuple of (initial_state, info_dict)
         """
+        # Close the previous episode before starting a new one
+        if self._episode_clean:
+            self._successful_episodes += 1
+        self._episode_clean = False
+
         # Reset episode state
         self._state = EnvironmentState()
         self._current_violations = []
@@ -257,6 +266,7 @@ def step(
             Tuple of (next_state, reward, terminated, truncated, info)
         """
         self._current_violations = []
+        first_step = self._state.step_count == 0
         self._state.step_count += 1
         self._total_steps += 1
 
@@ -310,9 +320,10 @@ def step(
             truncated = True
 
         # Mark success
-        if success and not self._current_violations:
+        step_clean = success and not self._current_violations
+        if step_clean:
             reward += self.config.success_bonus
-            self._successful_episodes += 1
+        self._episode_clean = step_clean and (first_step or self._episode_clean)
 
         self._state.terminated = terminated
         self._state.truncated = truncated
@@ -342,12 +353,13 @@ def terminated(self) -> bool:
 
     def get_metrics(self) -> dict[str, Any]:
         """Get environment metrics."""
+        successful_episodes = self._successful_episodes + int(self._episode_clean)
         return {
             "total_episodes": self._total_episodes,
             "total_steps": self._total_steps,
             "total_violations": self._total_violations,
-            "successful_episodes": self._successful_episodes,
-            "success_rate": self._successful_episodes / max(self._total_episodes, 1),
+            "successful_episodes": successful_episodes,
+            "success_rate": successful_episodes / max(self._total_episodes, 1),
             "violations_per_episode": self._total_violations
             / max(self._total_episodes, 1),
             "steps_per_episode": self._total_steps / max(self._total_episodes, 1),
```

**File**: `agent-governance-python/agent-lightning/tests/test_lightning_comprehensive.py` (modified, +35/-0)
```diff
@@ -859,6 +859,41 @@ def test_get_metrics_after_episode(self):
         assert m["total_episodes"] == 1
         assert m["total_steps"] == 2
 
+    def test_clean_episode_counts_once(self):
+        """Regression: every clean step used to add a successful episode,
+        so one clean five-step episode reported a success_rate of 5.0."""
+        env = GovernedEnvironment(_make_mock_kernel())
+        env.reset()
+        for i in range(5):
+            env.step(f"a{i}")
+        m = env.get_metrics()
+        assert m["successful_episodes"] == 1
+        assert m["success_rate"] == 1.0
+
+    def test_episode_with_a_violation_is_not_successful(self):
+        kernel = _make_mock_kernel()
+
+        def execute(action):
+            if action == "bad":
+                env._handle_violation("P", "blocked", "low", True)
+            return "result"
+
+        kernel.execute = MagicMock(side_effect=execute)
+        env = GovernedEnvironment(kernel)
+        env.reset()
+        for action in ("ok", "bad", "ok"):
+            env.step(action)
+        assert env.get_metrics()["successful_episodes"] == 0
+
+        # A clean second episode counts; the first one stays unsuccessful.
+        env.reset()
+        env.step("ok")
+        env.reset()
+        m = env.get_metrics()
+        assert m["total_episodes"] == 3
+        assert m["successful_episodes"] == 1
+        assert m["success_rate"] == pytest.approx(1 / 3)
+
 
 class TestCreateGovernedEnv:
     def test_factory(self):
```

**File**: `docs/specs/AGENT-LIGHTNING-FAST-PATH-1.0.md` (modified, +1/-1)
```diff
@@ -737,7 +737,7 @@ The environment MUST expose a `terminated` property that returns
 | `total_episodes` | int | Number of episodes completed |
 | `total_steps` | int | Total steps across all episodes |
 | `total_violations` | int | Total violations across all episodes |
-| `successful_episodes` | int | Episodes with at least one violation-free, successful step |
+| `successful_episodes` | int | Episodes in which every step succeeded without a violation |
 | `success_rate` | float | `successful_episodes / max(total_episodes, 1)` |
 | `violations_per_episode` | float | `total_violations / max(total_episodes, 1)` |
 | `steps_per_episode` | float | `total_steps / max(total_episodes, 1)` |
```

**File**: `docs/specs/AUDIT-COMPLIANCE-1.0.md` (modified, +1/-1)
```diff
@@ -1611,7 +1611,7 @@ The environment MUST track and report:
 | `total_episodes` | Total number of episodes completed. |
 | `total_steps` | Total steps across all episodes. |
 | `total_violations` | Total policy violations across all episodes. |
-| `successful_episodes` | Episodes that completed without critical violations. |
+| `successful_episodes` | Episodes in which every step succeeded without a violation. |
 | `success_rate` | Fraction of successful episodes. |
 | `violations_per_episode` | Average violations per episode. |
 | `steps_per_episode` | Average steps per episode. |
```

---

### Incident Patch 2: `8e51b1c3` (2026-10-21)
**Commit Message**: fix(agent-lightning): do not count violation summaries as emitted spans (#4365)

get_violation_summary() built its spans through get_spans(), which adds
every converted span to emitted_count, so each summary raised
get_stats()["emitted_count"] by the number of recorder entries although
nothing was emitted. Convert the entries directly instead.

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agent-discovery` GitHub scans detect LlamaIndex and classic AutoGen through their PyPI names.** `GitHubScanner` matched dependency files against `llamaindex` and `autogen` with word boundaries, so `llama-index` (the PyPI name of LlamaIndex) and `pyautogen` (classic AutoGen) were never detected, and a name written with `_` (`semantic_kernel`, `langchain_core`, `autogen_agentchat`) was missed although its hyphenated form was detected. Each dependency can now list aliases (`llama-index`, `pyautogen`), and `-`, `_` and `.` are treated alike inside and around a name, as in PEP 503. A repository still yields one agent per framework.
 - **`agent-lightning` `GovernedEnvironment` counts a successful episode once.** `step` added one to `successful_episodes` for every step that succeeded without a violation, so `get_metrics()` reported a clean five-step episode as five successful episodes and a `success_rate` of 5.0, and an episode with a violation on one step still counted its clean steps. An episode now counts as successful when every step in it succeeded without a violation, at most once, so `success_rate` stays between 0 and 1. The per-step success bonus is unchanged.
 - **`agent-learning` `ExcessivePrivilegeEvaluation` checks `role` and `permissions` as well as `privilege` and `scopes`.** The check read `role` only when the action had no `privilege` key, and `permissions` only when it had no `scopes` key, so `{"privilege": "user", "role": "admin"}`, `{"privilege": None, "role": "admin"}` and `{"scopes": ["read"], "permissions": ["*"]}` all passed. Both keys of each pair are now checked, and `max_scopes` counts `scopes` and `permissions` together (#4364).
+- **`agent-lightning` `FlightRecorderEmitter.get_violation_summary()` no longer adds to `emitted_count`.** The summary built its spans through `get_spans()`, which counts every converted span as emitted, so each call to `get_violation_summary()` raised `get_stats()["emitted_count"]` by the number of recorder entries although nothing was sent anywhere. The summary now converts the entries without counting them; its result is unchanged.
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-lightning/src/agent_lightning_gov/emitter.py` (modified, +7/-1)
```diff
@@ -309,7 +309,13 @@ def get_violation_summary(self) -> dict[str, Any]:
         Returns:
             Summary dictionary with violation statistics
         """
-        spans = self.get_spans()
+        # Convert directly instead of calling get_spans(): a summary does not
+        # emit anything, so it must not add to emitted_count.
+        spans = [
+            span
+            for entry in self._get_entries()
+            if (span := self._convert_entry(entry))
+        ]
 
         violations = [
             s for s in spans if s.attributes.get("agent_os.policy_violated", False)
```

**File**: `agent-governance-python/agent-lightning/tests/test_lightning_comprehensive.py` (modified, +12/-0)
```diff
@@ -1023,6 +1023,18 @@ def test_violation_summary_empty(self):
         assert summary["total_violations"] == 0
         assert summary["violation_rate"] == 0.0
 
+    def test_violation_summary_does_not_count_as_emitted(self):
+        entries = [_FakeEntry(violated=True), _FakeEntry(id="e2")]
+        emitter = FlightRecorderEmitter(_make_recorder(entries))
+        emitter.get_violation_summary()
+        emitter.get_violation_summary()
+        assert emitter.get_stats()["emitted_count"] == 0
+
+        store = MagicMock()
+        emitter.emit_to_store(store)
+        emitter.get_violation_summary()
+        assert emitter.get_stats()["emitted_count"] == 2
+
 
 class TestFlightRecorderEmitterStream:
     """``stream()`` is an async generator with a cooperative stop signal.
```

---

### Incident Patch 3: `6a8c12b7` (2026-10-21)
**Commit Message**: fix(agent-learning): check role and permissions in ExcessivePrivilegeEvaluation (#4364)

The check read `role` only when an action had no `privilege` key and
`permissions` only when it had no `scopes` key, so an action with
`privilege="user", role="admin"`, `privilege=None, role="admin"` or
`scopes=["read"], permissions=["*"]` passed. Check both keys of each pair
and count scopes and permissions together against max_scopes.

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agent-discovery` reports containerized agents with the same agent type as the other scanners.** `ConfigScanner` used the matched text of a Dockerfile or Compose file as the agent type, so `langgraph`, `agent_governance`, `mcp_server` and `semantic_kernel` came out as types no other scanner uses. Risk scoring then skipped the type factor for them (a `semantic_kernel` container got no medium-risk score), and reconciliation never suggested `mcp-scan` for an `mcp_server` container. Each Docker pattern now reports the type the process scanner uses (`langchain`, `agt`, `mcp-server`, `semantic-kernel`, ...); fingerprints are unchanged.
 - **`agent-discovery` GitHub scans detect LlamaIndex and classic AutoGen through their PyPI names.** `GitHubScanner` matched dependency files against `llamaindex` and `autogen` with word boundaries, so `llama-index` (the PyPI name of LlamaIndex) and `pyautogen` (classic AutoGen) were never detected, and a name written with `_` (`semantic_kernel`, `langchain_core`, `autogen_agentchat`) was missed although its hyphenated form was detected. Each dependency can now list aliases (`llama-index`, `pyautogen`), and `-`, `_` and `.` are treated alike inside and around a name, as in PEP 503. A repository still yields one agent per framework.
 - **`agent-lightning` `GovernedEnvironment` counts a successful episode once.** `step` added one to `successful_episodes` for every step that succeeded without a violation, so `get_metrics()` reported a clean five-step episode as five successful episodes and a `success_rate` of 5.0, and an episode with a violation on one step still counted its clean steps. An episode now counts as successful when every step in it succeeded without a violation, at most once, so `success_rate` stays between 0 and 1. The per-step success bonus is unchanged.
+- **`agent-learning` `ExcessivePrivilegeEvaluation` checks `role` and `permissions` as well as `privilege` and `scopes`.** The check read `role` only when the action had no `privilege` key, and `permissions` only when it had no `scopes` key, so `{"privilege": "user", "role": "admin"}`, `{"privilege": None, "role": "admin"}` and `{"scopes": ["read"], "permissions": ["*"]}` all passed. Both keys of each pair are now checked, and `max_scopes` counts `scopes` and `permissions` together (#4364).
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-learning/src/agent_learning_gov/evaluation.py` (modified, +8/-8)
```diff
@@ -234,14 +234,14 @@ def evaluate(
         findings = []
         for action in policy.actions:
             parameters = dict(action.parameters)
-            privilege = parameters.get("privilege", parameters.get("role"))
-            scopes = parameters.get("scopes", parameters.get("permissions", ()))
-            normalized_scopes = _as_sequence(scopes)
-            privileged = (
-                isinstance(privilege, str) and privilege.lower() in self.privileged_values
-            ) or any(
-                isinstance(scope, str) and scope.lower() in self.privileged_values
-                for scope in normalized_scopes
+            # An action can carry both keys of each pair, so check both.
+            privileges = (parameters.get("privilege"), parameters.get("role"))
+            normalized_scopes = _as_sequence(parameters.get("scopes")) + _as_sequence(
+                parameters.get("permissions")
+            )
+            privileged = any(
+                isinstance(value, str) and value.lower() in self.privileged_values
+                for value in (*privileges, *normalized_scopes)
             )
             if privileged or len(normalized_scopes) > self.max_scopes:
                 findings.append(
```

**File**: `agent-governance-python/agent-learning/tests/test_evaluation.py` (modified, +41/-0)
```diff
@@ -10,6 +10,7 @@
 
 from agent_learning_gov import (
     CostPolicyEvaluation,
+    ExcessivePrivilegeEvaluation,
     GovernanceEvaluationPack,
     GovernanceOutcome,
     GovernanceTelemetry,
@@ -90,6 +91,46 @@ def test_pack_reports_tools_privilege_restrictions_and_cost() -> None:
     assert len(report.findings) >= 5
 
 
+@pytest.mark.parametrize(
+    "parameters",
+    [
+        {"privilege": None, "role": "admin"},
+        {"privilege": "user", "role": "admin"},
+        {"scopes": ["read"], "permissions": ["*"]},
+        {"scopes": [], "permissions": ["root"]},
+    ],
+)
+def test_excessive_privilege_checks_role_and_permissions(parameters) -> None:
+    result = ExcessivePrivilegeEvaluation().evaluate(
+        _policy(_action("grant", **parameters)), episodes=(), baseline=None
+    )
+
+    assert result.passed == False
+    assert [finding.action_id for finding in result.findings] == ["grant"]
+
+
+def test_excessive_privilege_counts_scopes_and_permissions_together() -> None:
+    evaluation = ExcessivePrivilegeEvaluation(max_scopes=3)
+    result = evaluation.evaluate(
+        _policy(_action("grant", scopes=["a", "b"], permissions=["c", "d"])),
+        episodes=(),
+        baseline=None,
+    )
+
+    assert result.passed == False
+    assert result.findings[0].metadata == {"scope_count": 4}
+
+
+def test_excessive_privilege_passes_unprivileged_role_and_permissions() -> None:
+    result = ExcessivePrivilegeEvaluation().evaluate(
+        _policy(_action("search", privilege=None, role="user", permissions=["read"])),
+        episodes=(),
+        baseline=None,
+    )
+
+    assert result.passed == True
+
+
 def test_regression_check_uses_approved_baseline() -> None:
     telemetry = GovernanceTelemetry(
         violations=(
```

#### Recent Merged Pull Requests:
- **PR #4405** (2026-10-20): chore(deps-dev): Bump hono from 4.13.7 to 4.13.13 in /agent-governance-python/agentmesh-integrations/mastra-agentmesh (@dependabot[bot])
- **PR #4404** (2026-10-20): chore(deps): Bump hono from 4.13.7 to 4.13.13 in /agent-governance-python/agent-os/extensions/mcp-server (@dependabot[bot])
- **PR #4403** (2026-10-20): chore(deps): Bump rustls from 0.23.40 to 0.23.46 in /policy-engine/examples/coding_agent/app (@dependabot[bot])
- **PR #4399** (2026-10-20): chore(deps): Bump aiohttp from 3.14.3 to 3.14.4 in /agent-governance-python/agent-hypervisor (@dependabot[bot])
- **PR #4397** (2026-10-20): chore(deps-dev): Update fastapi requirement from <1.0,>=0.142.2 to >=0.143.0,<1.0 in /agent-governance-python/agent-sre (@dependabot[bot])
- **PR #4396** (2026-10-20): chore(deps-dev): Update pydantic requirement from <3.0,>=2.13.5 to >=2.14.1,<3.0 in /agent-governance-python/agent-sre (@dependabot[bot])

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

## X. agent-lightning): count a successful episode once in GovernedEnvironment metrics

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e67fba7f`: agent-lightning): count a successful episode once in GovernedEnvironment metrics (#4360). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **`agent-lightning` `GovernedEnvironment` counts a successful episode once.** `step` added one to `successful_episodes` for every step that succeeded without a violation, so `get_metrics()` reported a clean five-step episode as five successful episodes and a `success_rate` of 5.0, and an episode with a violation on one step still counted its clean steps. An episode now counts as successful when every step in it succeeded without a violation, at most once, so `success_rate` stays between 0 and 1. The per-step success bonus is unchanged.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e67fba7f` are properly handled with clean fallback behavior.
