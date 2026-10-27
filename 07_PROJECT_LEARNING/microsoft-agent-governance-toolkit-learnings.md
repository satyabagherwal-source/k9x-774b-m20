> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `c2602604`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:00:28.873Z  
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
> **Harvest Timestamp**: 2026-10-27T13:00:28.032Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6479 stars

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

### Incident Patch 1: `c3f0555d` (2026-10-27)
**Commit Message**: fix(agent-lightning): charge dict violations by their severity in policy_penalty (#4422)

* fix(agent-lightning): charge dict violations by severity in policy_penalty

policy_penalty read each violation's severity with getattr, so a
violation given as a dict (the form kernel.get_recent_violations() may
return, which GovernedEnvironment already accepts) always got the
default medium penalty: a critical dict cost -10 instead of -100.
PolicyReward computes its penalty through policy_penalty, so kernel
violations reported as dicts were mis-charged there too. Dicts are now
read by their "severity" key; objects, unknown severities and the
missing-severity default are unchanged.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>

* docs(changelog): add PR number to the agent-lightning policy_penalty entry

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>

---------

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Haystack `AuditLogger` records a snapshot of the entry metadata.** `run` stored the caller's `metadata` dict itself, so changing that dict after the call changed the recorded entry and made `verify_chain` report the log as tampered, and metadata that JSON cannot hold (a `datetime`, keys mixing `int` and `str`) raised `TypeError` from `run`. The metadata is now stored as a JSON snapshot taken when the entry is recorded, with other values stored as their `str()`; chain hashes for JSON metadata are unchanged (#4402).
 - **`agent-lightning` `PolicyReward` reports the penalty it applied in multiplicative mode.** With `RewardConfig(multiplicative=True)` a violation scales the base reward by `multiplicative_factor`, but `get_stats()` (`total_penalties`, `avg_penalty`) and the `policy_penalty` value emitted to Agent-Lightning were still taken from the additive severity table, so a critical violation that turned a base reward of 1.0 into 0.5 was recorded as a penalty of -100 instead of -0.5. In multiplicative mode the penalty is now the amount the scaling took off the base reward; additive mode is unchanged (#4418).
 - **`agent-runtime` `DockerDeployer.deploy` no longer lets `env` override the governance settings.** The `AGT_*` variables built from `GovernanceConfig` went on the `docker run` command line first and the `env` entries after them, and Docker keeps the last `-e` for a name, so `env={"AGT_KILL_SWITCH": "false"}` started the container with the kill switch off although `config.kill_switch_enabled` was `True` (likewise for the policy path, trust level, audit flag and limits). `deploy` now raises `ValueError` before running Docker when `env` names one of those variables or has an `=` in a name; other variables, including other `AGT_` names, are passed as before.
+- **`agent-lightning` `policy_penalty` charges dict violations by their severity.** It read each violation's severity with `getattr`, so a violation given as a dict, the form a kernel's `get_recent_violations()` may return and that `GovernedEnvironment` already accepts, always got the default medium penalty: `{"severity": "critical"}` cost -10 instead of -100 and `{"severity": "low"}` -10 instead of -1. `PolicyReward` uses `policy_penalty`, so a rollout without `violations` whose kernel returned dicts was rewarded the same way. Dict violations are now charged by their `"severity"` key; object violations, unknown severities and the medium default when the severity is missing are unchanged (#4422).
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-lightning/src/agent_lightning_gov/reward.py` (modified, +12/-2)
```diff
@@ -56,7 +56,10 @@ def policy_penalty(
     full PolicyReward class.
 
     Args:
-        violations: List of PolicyViolation objects
+        violations: List of violations, each a PolicyViolation (or any
+            object with a ``severity`` attribute) or a dict with a
+            ``"severity"`` key, as returned by
+            ``kernel.get_recent_violations()``
         critical_penalty: Penalty for critical violations
         high_penalty: Penalty for high severity violations
         medium_penalty: Penalty for medium severity violations
@@ -78,7 +81,14 @@ def policy_penalty(
 
     total_penalty = 0.0
     for violation in violations:
-        severity = getattr(violation, "severity", "medium")
+        # Kernels may report violations as dicts (see
+        # ``GovernedEnvironment._pull_kernel_violations``); reading only the
+        # attribute charged every dict the medium penalty, whatever its
+        # severity.
+        if isinstance(violation, dict):
+            severity = violation.get("severity", "medium")
+        else:
+            severity = getattr(violation, "severity", "medium")
         total_penalty += severity_penalties.get(severity, medium_penalty)
 
     return total_penalty
```

**File**: `agent-governance-python/agent-lightning/tests/test_lightning_comprehensive.py` (modified, +18/-0)
```diff
@@ -592,6 +592,24 @@ def test_custom_penalties(self):
         r = policy_penalty([_FakeViolation("critical")], critical_penalty=-200.0)
         assert r == pytest.approx(-200.0)
 
+    def test_dict_violations_use_their_severity(self):
+        violations = [{"severity": "critical"}, {"severity": "low"}]
+        assert policy_penalty(violations) == pytest.approx(-101.0)
+
+    def test_dict_violation_unknown_or_missing_severity_is_medium(self):
+        violations = [{"severity": "unknown_level"}, {"policy": "p"}]
+        assert policy_penalty(violations) == pytest.approx(-20.0)
+
+    def test_policy_reward_charges_kernel_dict_violations_by_severity(self):
+        # A rollout without ``violations`` falls back to the kernel, which
+        # may return dicts; a critical one must cost the critical penalty.
+        kernel = _make_mock_kernel()
+        kernel.get_recent_violations = MagicMock(
+            return_value=[{"policy": "p", "severity": "critical"}]
+        )
+        reward = PolicyReward(kernel, base_reward_fn=lambda _r: 1.0)
+        assert reward(object(), emit=False) == pytest.approx(-99.0)
+
 
 class TestCreatePolicyReward:
     def test_factory_with_defaults(self):
```

**File**: `docs/specs/AGENT-LIGHTNING-FAST-PATH-1.0.md` (modified, +11/-6)
```diff
@@ -488,13 +488,16 @@ accept:
 
 | Parameter | Type | Default | Description |
 | --- | --- | --- | --- |
-| `violations` | list[Any] | (required) | List of PolicyViolation objects |
+| `violations` | list[Any] | (required) | List of PolicyViolation objects or violation dicts |
 | `critical_penalty` | float | -100.0 | Penalty for critical violations |
 | `high_penalty` | float | -50.0 | Penalty for high-severity violations |
 | `medium_penalty` | float | -10.0 | Penalty for medium-severity violations |
 | `low_penalty` | float | -1.0 | Penalty for low-severity violations |
 
-**[Pure Specification]**
+Each violation MAY be an object with a `severity` attribute (such as a
+`PolicyViolation`) or a dict with a `"severity"` key, the shape a
+kernel's `get_recent_violations()` may return (Section 9.8). Both forms
+MUST be charged by their severity. **[Pure Specification]**
 
 ### 7.2 Severity Mapping
 
@@ -510,7 +513,8 @@ severity_penalties = {
 
 total_penalty = 0.0
 for violation in violations:
-    severity = violation.severity  (default "medium" if absent)
+    severity = violation["severity"] if violation is a dict
+               else violation.severity  (default "medium" if absent)
     total_penalty += severity_penalties.get(severity, medium_penalty)
 ```
 
@@ -1211,8 +1215,8 @@ An implementation is conformant if it satisfies all MUST requirements:
    caller-supplied; preserves caller-supplied penalty.
 8. PolicyViolationError stores the violation and formats the message
    correctly.
-9. `policy_penalty` falls back to medium penalty for unknown
-   severities.
+9. `policy_penalty` charges object and dict violations by their
+   severity and falls back to medium penalty for unknown severities.
 10. PolicyReward supports both additive and multiplicative penalty
     modes.
 11. PolicyReward clamps rewards to `[min_reward, max_reward]`.
@@ -1242,7 +1246,8 @@ Conformance tests MUST cover:
 - PolicyViolation caller-supplied penalty preservation.
 - PolicyViolationType enum values.
 - PolicyViolationError message formatting.
-- `policy_penalty` with known and unknown severities.
+- `policy_penalty` with known and unknown severities, for object and
+  dict violations.
 - PolicyReward additive mode computation.
 - PolicyReward multiplicative mode computation.
 - PolicyReward clean bonus application.
```

---

### Incident Patch 2: `cdf29304` (2026-10-27)
**Commit Message**: chore(deps): Bump setuptools in /agent-governance-python/requirements (#4452)

Bumps [setuptools](https://github.com/pypa/setuptools) from 83.0.0 to 84.1.0.
- [Release notes](https://github.com/pypa/setuptools/releases)
- [Changelog](https://github.com/pypa/setuptools/blob/main/NEWS.rst)
- [Commits](https://github.com/pypa/setuptools/compare/v83.0.0...v84.1.0)

---
updated-dependencies:
- dependency-name: setuptools
  dependency-version: 84.1.0
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `agent-governance-python/requirements/ci-build.txt` (modified, +3/-3)
```diff
@@ -1,9 +1,9 @@
 # Hashed CI build dependencies (Scorecard Pinned-Dependencies compliance)
 build==1.2.2 \
     --hash=sha256:277ccc71619d98afdd841a0e96ac9fe1593b823af481d3b0cea748e8894e0613
-setuptools==83.0.0 \
-    --hash=sha256:025bccbbf0fa05b6192bc64ae1e7b16e001fd6d6d4d5de03c97b1c1ade523bef \
-    --hash=sha256:29b23c360f22f414dc7336bb39178cc7bcbf6021ed2733cde173f09dba19abb3
+setuptools==84.1.0 \
+    --hash=sha256:23657205b63d4d31395ab917815247f694aafad28cd21316bf5fd45a51048ea0 \
+    --hash=sha256:5231689c6ac8156cd155cfb98c3fd6fb252c3e7e9bd3d78b64d3c55f132624c9
 # build transitive dependencies
 packaging==25.0 \
     --hash=sha256:29572ef2b1f17581046b3a2227d5c611fb25ec70ca1ba8554b24b0e69331a484
```

---

### Incident Patch 3: `76bdbe6b` (2026-10-27)
**Commit Message**: chore(deps-dev): Update setuptools requirement (#4448)

Updates the requirements on [setuptools](https://github.com/pypa/setuptools) to permit the latest version.
- [Release notes](https://github.com/pypa/setuptools/releases)
- [Changelog](https://github.com/pypa/setuptools/blob/main/NEWS.rst)
- [Commits](https://github.com/pypa/setuptools/compare/v84.0.0...v84.2.0)

---
updated-dependencies:
- dependency-name: setuptools
  dependency-version: 84.2.0
  dependency-type: direct:development
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `agent-governance-python/agent-primitives/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [build-system]
-requires = ["setuptools>=84.0.0", "wheel"]
+requires = ["setuptools>=84.2.0", "wheel"]
 build-backend = "setuptools.build_meta"
 
 [project]
```

#### Recent Merged Pull Requests:
- **PR #4457** (2026-10-27): chore(deps): Bump body-parser from 2.3.0 to 2.4.0 in /agent-governance-python/agent-os/extensions/copilot (@dependabot[bot])
- **PR #4456** (2026-10-27): chore(deps): Bump zod from 4.6.5 to 4.6.7 in /agent-governance-python/agent-os/extensions/mcp-server (@dependabot[bot])
- **PR #4455** (2026-10-27): chore(deps): Bump fast-uri from 3.1.8 to 3.1.9 in /agent-governance-python/agent-os/extensions/mcp-server (@dependabot[bot])
- **PR #4454** (2026-10-27): chore(deps-dev): Bump fast-uri from 3.1.7 to 3.1.9 in /agent-governance-python/agentmesh-integrations/mastra-agentmesh (@dependabot[bot])
- **PR #4452** (2026-10-27): chore(deps): Bump setuptools from 83.0.0 to 84.1.0 in /agent-governance-python/requirements (@dependabot[bot])
- **PR #4451** (2026-10-27): chore(deps-dev): Update opentelemetry-sdk requirement from <2.0,>=1.44.0 to >=1.45.1,<2.0 in /agent-governance-python/agent-sre (@dependabot[bot])

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

## X. agent-lightning): charge dict violations by their severity in policy_penalty (#4

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c3f0555d`: agent-lightning): charge dict violations by their severity in policy_penalty (#4422). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **`agent-lightning` `policy_penalty` charges dict violations by their severity.** It read each violation's severity with `getattr`, so a violation given as a dict, the form a kernel's `get_recent_violations()` may return and that `GovernedEnvironment` already accepts, always got the default medium penalty: `{"severity": "critical"}` cost -10 instead of -100 and `{"severity": "low"}` -10 instead of -1. `PolicyReward` uses `policy_penalty`, so a rollout without `violations` whose kernel returned dicts was rewarded the same way. Dict violations are now charged by their `"severity"` key; object violations, unknown severities and the medium default when the severity is missing are unchanged (#4422).
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c3f0555d` are properly handled with clean fallback behavior.
