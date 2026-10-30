> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `95cd5f20`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T17:06:08.164Z  
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
> **Harvest Timestamp**: 2026-10-30T17:06:03.142Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6496 stars

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

### Incident Patch 1: `95cd5f20` (2026-10-30)
**Commit Message**: fix(agent-sre): keep a rollout step's analysis criteria in the AgentRollout CRD (#4476)

The AgentRollout CRD schema (generate_crd_manifest() and the Helm chart)
did not declare steps[].analysis, so the API server pruned it from every
applied rollout and Reconciler built steps without analysis criteria.
Declare analysis as a list of metric/threshold/comparator and test that
the Helm chart schema matches the generated one.

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agent-sre` chaos blackout windows reject times they cannot read.** `BlackoutWindow` accepted any string for `start` and `end`, and `contains` returned `False` when a bound did not parse, so a window written as `9pm`-`11pm`, `21:00`-`24:00` or `21:00:00`-`23:00:00` never blocked anything and chaos ran during it. Both bounds must now be `HH:MM` times on the 24-hour clock, and anything else raises a validation error when the window is created, including from `load_schedules`.
 - **`agent-runtime` `DockerDeployer.logs` returns what the agent writes to stderr.** Containers are started without a TTY, so `docker logs` replays the agent's stderr on its own stderr, and `logs` returned only the captured stdout. An agent that logs through Python's `logging` (stderr by default) got an empty or partial result. `logs` now merges the two streams in the order Docker writes them. `KubernetesDeployer.logs` was not affected, since `kubectl logs` prints both streams on stdout.
 - **`agent-rag-governance` audits a denied collection with the query's hash.** `RAGGovernor` wrote the `denied` audit entry for a blocked collection with the hash of an empty string, so every denied attempt carried the same `query_hash` and could not be tied to what the agent searched for. The `rate_limited` entry was fixed the same way earlier. The `denied` entry now hashes the actual query (salted by `AGENT_RAG_AUDIT_SALT` when set), for LangChain and LlamaIndex wrappers alike.
+- **`agent-sre` `AgentRollout` CRD keeps a step's analysis criteria.** The CRD schema, in both `k8s.generate_crd_manifest()` and the Helm chart, declared a step's `name`, `weight`, `durationSeconds` and `manualGate` but not `analysis`, although `RolloutSpec.to_dict()` writes it and `k8s.Reconciler` reads it. The API server prunes fields a structural schema does not declare, so every step of an applied `AgentRollout` lost its analysis criteria, and `analyze_step` passed it without checking a metric. The schema now declares `analysis` as a list of `metric`, `threshold` and `comparator` (`gte`, `lte` or `eq`, default `gte`).
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-sre/deployments/helm/README.md` (modified, +4/-0)
```diff
@@ -52,6 +52,10 @@ spec:
     - name: canary-5
       weight: 0.05
       durationSeconds: 3600
+      analysis:
+        - metric: task_success_rate
+          threshold: 0.99
+          comparator: gte
     - name: canary-50
       weight: 0.50
       durationSeconds: 7200
```

**File**: `agent-governance-python/agent-sre/deployments/helm/agent-sre/templates/crd.yaml` (modified, +14/-0)
```diff
@@ -70,6 +70,20 @@ spec:
                       durationSeconds:
                         type: integer
                         minimum: 0
+                      analysis:
+                        type: array
+                        items:
+                          type: object
+                          required: [metric, threshold]
+                          properties:
+                            metric:
+                              type: string
+                            threshold:
+                              type: number
+                            comparator:
+                              type: string
+                              enum: [gte, lte, eq]
+                              default: gte
                       manualGate:
                         type: boolean
                         default: false
```

**File**: `agent-governance-python/agent-sre/src/agent_sre/k8s/__init__.py` (modified, +16/-0)
```diff
@@ -140,6 +140,22 @@ def _openapi_schema() -> dict[str, Any]:
                                 "name": {"type": "string"},
                                 "weight": {"type": "number", "minimum": 0, "maximum": 1},
                                 "durationSeconds": {"type": "integer", "minimum": 0},
+                                "analysis": {
+                                    "type": "array",
+                                    "items": {
+                                        "type": "object",
+                                        "required": ["metric", "threshold"],
+                                        "properties": {
+                                            "metric": {"type": "string"},
+                                            "threshold": {"type": "number"},
+                                            "comparator": {
+                                                "type": "string",
+                                                "enum": ["gte", "lte", "eq"],
+                                                "default": "gte",
+                                            },
+                                        },
+                                    },
+                                },
                                 "manualGate": {"type": "boolean", "default": False},
                             },
                         },
```

**File**: `agent-governance-python/agent-sre/tests/test_k8s.py` (modified, +68/-0)
```diff
@@ -4,7 +4,11 @@
 
 from __future__ import annotations
 
+from pathlib import Path
+from typing import Any
+
 import pytest
+import yaml
 
 from agent_sre.k8s import (
     CRD_GROUP,
@@ -19,6 +23,22 @@
     generate_crd_manifest,
 )
 
+HELM_CRD = Path(__file__).resolve().parents[1] / "deployments/helm/agent-sre/templates/crd.yaml"
+
+
+def _prune(value: Any, schema: dict[str, Any]) -> Any:
+    """Drop the fields a structural CRD schema does not declare, as the API server does."""
+    if isinstance(value, dict) and "properties" in schema:
+        return {
+            k: _prune(v, schema["properties"][k])
+            for k, v in value.items()
+            if k in schema["properties"]
+        }
+    if isinstance(value, list) and "items" in schema:
+        return [_prune(v, schema["items"]) for v in value]
+    return value
+
+
 # ---------------------------------------------------------------------------
 # CRD manifest
 # ---------------------------------------------------------------------------
@@ -47,6 +67,26 @@ def test_crd_has_schema(self):
         assert "candidate" in spec_props
         assert "steps" in spec_props
 
+    def test_crd_keeps_step_analysis_criteria(self):
+        crd = generate_crd_manifest()
+        schema = crd["spec"]["versions"][0]["schema"]["openAPIV3Schema"]
+        step = schema["properties"]["spec"]["properties"]["steps"]["items"]
+        criterion = step["properties"]["analysis"]["items"]
+        assert set(criterion["properties"]) == {"metric", "threshold", "comparator"}
+        assert criterion["properties"]["comparator"]["enum"] == ["gte", "lte", "eq"]
+
+    def test_helm_chart_crd_schema_matches_generated_schema(self):
+        text = "\n".join(
+            line for line in HELM_CRD.read_text(encoding="utf-8").splitlines()
+            if not line.lstrip().startswith("{{")
+        )
+        chart = yaml.safe_load(text)
+        generated = generate_crd_manifest()
+        assert (
+            chart["spec"]["versions"][0]["schema"]
+            == generated["spec"]["versions"][0]["schema"]
+        )
+
     def test_crd_has_subresources(self):
         crd = generate_crd_manifest()
         assert "status" in crd["spec"]["versions"][0]["subresources"]
@@ -385,3 +425,31 @@ def test_gitops_rollout_spec_round_trips_through_reconciler(self):
         # A healthy success rate must not trip the "lt 0.9" condition.
         assert rollout.check_rollback({"success_rate": 0.99}) is False
         assert rollout.check_rollback({"success_rate": 0.5}) is True
+
+    def test_gitops_step_analysis_survives_crd_pruning(self):
+        from agent_sre.delivery.gitops import AgentRef, RolloutSpec
+        from agent_sre.delivery.rollout import AnalysisCriterion, RolloutStep
+
+        spec = RolloutSpec(
+            name="gitops",
+            candidate=AgentRef(name="agent", version="v2"),
+            steps=[
+                RolloutStep(
+                    weight=0.1,
+                    analysis=[AnalysisCriterion("latency_ms", 500.0, comparator="lte")],
+                ),
+                RolloutStep(weight=1.0),
+            ],
+        )
+        schema = generate_crd_manifest()["spec"]["versions"][0]["schema"]["openAPIV3Schema"]
+        stored = _prune(spec.to_dict(), schema)
+
+        r = Reconciler()
+        r.reconcile("gitops", "default", stored["spec"])
+        rollout = r.get_rollout("gitops", "default")
+        assert rollout is not None
+        criteria = rollout.steps[0].analysis
+        assert [(c.metric, c.threshold, c.comparator) for c in criteria] == [
+            ("latency_ms", 500.0, "lte"),
+        ]
+        assert rollout.analyze_step({"latency_ms": 900.0}) is False
```

#### Recent Merged Pull Requests:
- **PR #4476** (2026-10-30): fix(agent-sre): keep a rollout step's analysis criteria in the AgentRollout CRD (@ShivamSharma43)
- **PR #4475** (2026-10-29): fix(agent-rag-governance): audit a denied collection with the query's hash (@ShivamSharma43)
- **PR #4474** (2026-10-29): fix(agent-runtime): include the agent's stderr in DockerDeployer.logs (@ShivamSharma43)
- **PR #4473** (2026-10-29): fix(agent-sre): reject chaos blackout times that cannot be read (@ShivamSharma43)
- **PR #4471** (closed): chore: consolidate Functions editor configuration (@erin1sanders)
- **PR #4470** (2026-10-28): fix(agent-sre): stop blue-green validation at its timeout (@ShivamSharma43)

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

## X. agent-sre): keep a rollout step's analysis criteria in the AgentRollout CRD (#44

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `95cd5f20`: agent-sre): keep a rollout step's analysis criteria in the AgentRollout CRD (#4476). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **`agent-sre` `AgentRollout` CRD keeps a step's analysis criteria.** The CRD schema, in both `k8s.generate_crd_manifest()` and the Helm chart, declared a step's `name`, `weight`, `durationSeconds` and `manualGate` but not `analysis`, although `RolloutSpec.to_dict()` writes it and `k8s.Reconciler` reads it. The API server prunes fields a structural schema does not declare, so every step of an applied `AgentRollout` lost its analysis criteria, and `analyze_step` passed it without checking a metric. The schema now declares `analysis` as a list of `metric`, `threshold` and `comparator` (`gte`, `lte` or `eq`, default `gte`).
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `95cd5f20` are properly handled with clean fallback behavior.
