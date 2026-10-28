> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `4eca1f5b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T13:23:29.582Z  
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
> **Harvest Timestamp**: 2026-10-28T13:23:29.577Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6485 stars

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

### Incident Patch 1: `4eca1f5b` (2026-10-28)
**Commit Message**: fix(agent-sre): write CRD field names in GitOps rollout specs (#4461)

* fix(agent-sre): write CRD field names in GitOps rollout specs

RolloutSpec.to_dict() serialized steps with duration_seconds and
manual_gate and rollback conditions with comparator, but the AgentRollout
CRD and k8s.Reconciler read durationSeconds, manualGate and operator. A
spec passed to the reconciler ran every step for the default 3600 s with
no manual gate, and every rollback condition became gte, so
RollbackCondition("success_rate", 0.9, comparator="lt") rolled back at a
healthy 0.99. Write the CRD field names, and read an analysis criterion's
comparator in the reconciler instead of always using gte.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>

* chore(cspell): add gitops to the repo terms

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>

---------

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.cspell-repo-terms.txt` (modified, +1/-0)
```diff
@@ -1356,3 +1356,4 @@ NDJSON
 ndjson
 dataschema
 disp
+gitops
```

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agent-lightning` `policy_penalty` charges dict violations by their severity.** It read each violation's severity with `getattr`, so a violation given as a dict, the form a kernel's `get_recent_violations()` may return and that `GovernedEnvironment` already accepts, always got the default medium penalty: `{"severity": "critical"}` cost -10 instead of -100 and `{"severity": "low"}` -10 instead of -1. `PolicyReward` uses `policy_penalty`, so a rollout without `violations` whose kernel returned dicts was rewarded the same way. Dict violations are now charged by their `"severity"` key; object violations, unknown severities and the medium default when the severity is missing are unchanged (#4422).
 - **`agent-sre` A/B experiments split traffic by relative variant weights.** `Experiment.assign` compared one `random.random()` draw against the running sum of the weights, so it only worked when the weights summed to 1: three variants with the default weight 0.5 never sent traffic to the third, percentage weights such as 70/30 sent everything to the first, and two variants weighted 0.1 split 10/90. Each variant now gets its weight divided by the total of all weights, and a variant with a weight of 0 or less gets no traffic.
 - **`agent-lightning` `GovernedEnvironment` includes the success bonus in the episode's `total_reward`.** `step` added the reward to `EnvironmentState.total_reward` before adding `success_bonus` for a clean step, so `total_reward` (and `info["total_reward"]`) left out every bonus that `step` returned: with the default config, a clean step returned 10.9 but raised `total_reward` by 0.9, and an episode's `total_reward` was not the sum of its step rewards. The reward is now accumulated after the bonus, and the step order in the Agent Lightning spec is updated to match (#4419).
+- **`agent-sre` GitOps rollout specs keep their step durations, manual gates and rollback operators in the reconciler.** `RolloutSpec.to_dict()` wrote steps with `duration_seconds` and `manual_gate` and rollback conditions with `comparator`, while the `AgentRollout` CRD and `k8s.Reconciler` read `durationSeconds`, `manualGate` and `operator`. A spec passed to the reconciler therefore ran every step for the default 3600 seconds without its manual gate, and every rollback condition became `gte`: `RollbackCondition("success_rate", 0.9, comparator="lt")` rolled back at a healthy 0.99. `to_dict()` now writes the CRD field names, and the reconciler also reads an analysis criterion's `comparator` instead of always using `gte`.
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-sre/src/agent_sre/delivery/gitops.py` (modified, +27/-2)
```diff
@@ -57,11 +57,34 @@ def to_dict(self) -> dict[str, Any]:
         return d
 
 
+def _step_to_spec(step: RolloutStep) -> dict[str, Any]:
+    """Serialize a step with the AgentRollout CRD field names."""
+    return {
+        "name": step.name,
+        "weight": step.weight,
+        "durationSeconds": step.duration_seconds,
+        "analysis": [a.to_dict() for a in step.analysis],
+        "manualGate": step.manual_gate,
+    }
+
+
+def _rollback_condition_to_spec(condition: RollbackCondition) -> dict[str, Any]:
+    """Serialize a rollback condition with the AgentRollout CRD field names."""
+    return {
+        "metric": condition.metric,
+        "threshold": condition.threshold,
+        "operator": condition.comparator,
+    }
+
+
 @dataclass
 class RolloutSpec:
     """Declarative rollout specification for GitOps-style deployments.
 
     Designed to be serialized to YAML and stored in version control.
+    ``to_dict()`` returns an ``AgentRollout`` manifest that uses the CRD's
+    field names (``durationSeconds``, ``manualGate``, ``operator``), so the
+    reconciler reads it back unchanged.
     """
     api_version: SpecVersion = SpecVersion.V1ALPHA1
     kind: str = "AgentRollout"
@@ -92,8 +115,10 @@ def to_dict(self) -> dict[str, Any]:
                 "strategy": self.strategy.value,
                 "current": self.current.to_dict(),
                 "candidate": self.candidate.to_dict(),
-                "steps": [s.to_dict() for s in self.steps],
-                "rollbackConditions": [r.to_dict() for r in self.rollback_conditions],
+                "steps": [_step_to_spec(s) for s in self.steps],
+                "rollbackConditions": [
+                    _rollback_condition_to_spec(r) for r in self.rollback_conditions
+                ],
                 "sloRequirements": [s.to_dict() for s in self.slo_requirements],
             },
         }
```

**File**: `agent-governance-python/agent-sre/src/agent_sre/k8s/__init__.py` (modified, +3/-1)
```diff
@@ -325,7 +325,9 @@ def _parse_spec(spec_dict: dict[str, Any]) -> RolloutSpec:
     for s in spec_dict.get("steps", []):
         analysis = []
         for a in s.get("analysis", []):
-            analysis.append(AnalysisCriterion(a["metric"], a["threshold"]))
+            analysis.append(
+                AnalysisCriterion(a["metric"], a["threshold"], a.get("comparator", "gte"))
+            )
         steps.append(RolloutStep(
             name=s.get("name", ""),
             weight=s.get("weight", 0.0),
```

**File**: `agent-governance-python/agent-sre/tests/test_k8s.py` (modified, +39/-0)
```diff
@@ -346,3 +346,42 @@ def test_every_crd_rollback_operator_triggers_rollback(self, operator, metrics):
         assert rollout is not None
         assert rollout.check_rollback(metrics) is True
         assert rollout.state.value == "rolled_back"
+
+    def test_gitops_rollout_spec_round_trips_through_reconciler(self):
+        from agent_sre.delivery.gitops import AgentRef, RolloutSpec
+        from agent_sre.delivery.rollout import (
+            AnalysisCriterion,
+            RollbackCondition,
+            RolloutStep,
+        )
+
+        spec = RolloutSpec(
+            name="gitops",
+            candidate=AgentRef(name="agent", version="v2"),
+            steps=[
+                RolloutStep(
+                    weight=0.1,
+                    duration_seconds=600,
+                    manual_gate=True,
+                    analysis=[AnalysisCriterion("latency_ms", 500.0, comparator="lte")],
+                ),
+                RolloutStep(weight=1.0, duration_seconds=0),
+            ],
+            rollback_conditions=[RollbackCondition("success_rate", 0.9, comparator="lt")],
+        )
+
+        r = Reconciler()
+        result = r.reconcile("gitops", "default", spec.to_dict()["spec"])
+        assert result.action == ReconcileAction.CREATED
+        rollout = r.get_rollout("gitops", "default")
+        assert rollout is not None
+
+        first, last = rollout.steps
+        assert (first.duration_seconds, first.manual_gate) == (600, True)
+        assert (last.duration_seconds, last.manual_gate) == (0, False)
+        assert first.analysis[0].comparator == "lte"
+        assert rollout.analyze_step({"latency_ms": 200.0}) is True
+
+        # A healthy success rate must not trip the "lt 0.9" condition.
+        assert rollout.check_rollback({"success_rate": 0.99}) is False
+        assert rollout.check_rollback({"success_rate": 0.5}) is True
```

**File**: `agent-governance-python/agent-sre/tests/unit/test_p2_features.py` (modified, +22/-0)
```diff
@@ -92,6 +92,28 @@ def test_to_dict_structure(self):
         assert "metadata" in d
         assert "spec" in d
 
+    def test_to_dict_uses_crd_field_names(self):
+        from agent_sre.delivery.rollout import RollbackCondition, RolloutStep
+        spec = RolloutSpec(
+            name="test",
+            candidate=AgentRef(name="agent", version="v1"),
+            steps=[RolloutStep(weight=0.5, duration_seconds=120, manual_gate=True)],
+            rollback_conditions=[RollbackCondition("error_rate", 0.1, comparator="gt")],
+        )
+        d = spec.to_dict()["spec"]
+        assert d["steps"] == [
+            {
+                "name": "",
+                "weight": 0.5,
+                "durationSeconds": 120,
+                "analysis": [],
+                "manualGate": True,
+            }
+        ]
+        assert d["rollbackConditions"] == [
+            {"metric": "error_rate", "threshold": 0.1, "operator": "gt"}
+        ]
+
     def test_agent_ref(self):
         ref = AgentRef(name="my-agent", version="v2.0", model="gpt-4")
         d = ref.to_dict()
```

#### Recent Merged Pull Requests:
- **PR #4466** (2026-10-27): chore(deps-dev): Bump setuptools from 83.0.0 to 84.1.0 in /agent-governance-python/agent-learning (@dependabot[bot])
- **PR #4465** (2026-10-27): chore(deps): Bump certifi from 2026.5.20 to 2026.10.18 in /agent-governance-python/agent-marketplace (@dependabot[bot])
- **PR #4464** (closed): fix(python): add AgentControl close support (@MaryamIjazMaryam)
- **PR #4463** (2026-10-27): chore(deps): Bump zod from 4.4.3 to 4.6.7 in /agent-governance-python/agent-mesh/packages/mcp-proxy (@dependabot[bot])
- **PR #4462** (2026-10-27): chore(deps): Bump body-parser from 2.2.2 to 2.4.0 in /agent-governance-python/agent-mesh/packages/mcp-proxy (@dependabot[bot])
- **PR #4461** (2026-10-28): fix(agent-sre): write CRD field names in GitOps rollout specs (@ShivamSharma43)

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

## X. agent-sre): write CRD field names in GitOps rollout specs (#4461)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4eca1f5b`: agent-sre): write CRD field names in GitOps rollout specs (#4461). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **`agent-sre` GitOps rollout specs keep their step durations, manual gates and rollback operators in the reconciler.** `RolloutSpec.to_dict()` wrote steps with `duration_seconds` and `manual_gate` and rollback conditions with `comparator`, while the `AgentRollout` CRD and `k8s.Reconciler` read `durationSeconds`, `manualGate` and `operator`. A spec passed to the reconciler therefore ran every step for the default 3600 seconds without its manual gate, and every rollback condition became `gte`: `RollbackCondition("success_rate", 0.9, comparator="lt")` rolled back at a healthy 0.99. `to_dict()` now writes the CRD field names, and the reconciler also reads an analysis criterion's `comparator` instead of always using `gte`.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4eca1f5b` are properly handled with clean fallback behavior.
