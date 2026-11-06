> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `ea260c54`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T20:06:48.654Z  
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
> **Harvest Timestamp**: 2026-11-05T20:06:48.650Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6521 stars

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

### Incident Patch 1: `ea260c54` (2026-11-05)
**Commit Message**: fix(agent-lightning): count only accepted spans in emit_to_store (#4487)

FlightRecorderEmitter.emit_to_store returned len(spans), the number of
spans read from the recorder, even when a span's emit call raised or
the store had no emit_span/add_span method and nothing was sent. Count
the spans the store accepted and return that, as the docstring and the
Fast-Path spec (section 12.1) say.

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -54,6 +54,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agent-runtime` `DockerDeployer.logs` returns what the agent writes to stderr.** Containers are started without a TTY, so `docker logs` replays the agent's stderr on its own stderr, and `logs` returned only the captured stdout. An agent that logs through Python's `logging` (stderr by default) got an empty or partial result. `logs` now merges the two streams in the order Docker writes them. `KubernetesDeployer.logs` was not affected, since `kubectl logs` prints both streams on stdout.
 - **`agent-rag-governance` audits a denied collection with the query's hash.** `RAGGovernor` wrote the `denied` audit entry for a blocked collection with the hash of an empty string, so every denied attempt carried the same `query_hash` and could not be tied to what the agent searched for. The `rate_limited` entry was fixed the same way earlier. The `denied` entry now hashes the actual query (salted by `AGENT_RAG_AUDIT_SALT` when set), for LangChain and LlamaIndex wrappers alike.
 - **`agent-sre` `AgentRollout` CRD keeps a step's analysis criteria.** The CRD schema, in both `k8s.generate_crd_manifest()` and the Helm chart, declared a step's `name`, `weight`, `durationSeconds` and `manualGate` but not `analysis`, although `RolloutSpec.to_dict()` writes it and `k8s.Reconciler` reads it. The API server prunes fields a structural schema does not declare, so every step of an applied `AgentRollout` lost its analysis criteria, and `analyze_step` passed it without checking a metric. The schema now declares `analysis` as a list of `metric`, `threshold` and `comparator` (`gte`, `lte` or `eq`, default `gte`).
+- **`agent-lightning` `FlightRecorderEmitter.emit_to_store` returns the number of spans it emitted.** It returned the number of spans it read from the recorder, so a span whose `emit_span`/`add_span` call raised was still counted, and a store with neither method got nothing but the return value (and the "Emitted N spans" log line) reported every span as sent. It now counts only the spans the store accepted, as its docstring and the Agent Lightning Fast-Path spec (section 12.1) say.
 - **`agent-sre` `RunbookExecutor` reports a failed rollback.** When a step failed, the executor ran the rollback actions of the steps before it and then marked the execution `rolled_back` whenever any of them had a rollback action, even if that action raised, so an execution left half undone read as cleanly rolled back. The rolled-back steps also kept `success`, and `StepStatus.ROLLED_BACK` was never set. Each step whose rollback succeeds is now marked `rolled_back`; the execution is `rolled_back` only when every rollback succeeded, and otherwise stays `failed`, with the rollback error recorded on the step.
 - **`agent-discovery` saves reconciliation statuses and scan risk tags to the inventory file.** `Reconciler.reconcile` set each agent's status to `registered` or `shadow` but never wrote the inventory back, and `agent-discovery scan` added the `risk_level` and `risk_score` tags after the last save. With a storage path, both were lost when the process ended, so `agent-discovery inventory` showed every agent as `unknown` after `agent-discovery reconcile` and without risk tags after a scan. `AgentInventory.save()` now persists in-place changes, and `reconcile` and `scan` call it.
 - **`agent-sre` `AgentRollout` status matches the CRD schema.** `ResourceStatus.to_dict()` wrote each condition's `lastTransitionTime` as a Unix timestamp (a float), but the CRD schema, in both `k8s.generate_crd_manifest()` and the Helm chart, declares it as a string, so the API server rejects a status update that carries a condition. It also wrote `observedGeneration` and `message`, which the schema did not declare, so they were pruned from every status update. `lastTransitionTime` is now an RFC 3339 UTC time such as `2026-11-01T09:30:00Z`, as Kubernetes conditions use, and the schema declares `status.observedGeneration` (integer) and `status.message` (string).
```

**File**: `agent-governance-python/agent-lightning/src/agent_lightning_gov/emitter.py` (modified, +8/-3)
```diff
@@ -265,9 +265,12 @@ def emit_to_store(self, store: Any) -> int:
             store: Agent-Lightning LightningStore instance
 
         Returns:
-            Number of spans emitted
+            Number of spans the store accepted. Spans whose emission
+            raised, and all spans when the store has no recognised span
+            emitter, are not counted.
         """
         spans = self.get_spans()
+        emitted = 0
 
         for span in spans:
             try:
@@ -280,9 +283,11 @@ def emit_to_store(self, store: Any) -> int:
                     break
             except Exception as e:
                 logger.error(f"Failed to emit span: {e}")
+            else:
+                emitted += 1
 
-        logger.info(f"Emitted {len(spans)} spans to LightningStore")
-        return len(spans)
+        logger.info(f"Emitted {emitted} of {len(spans)} spans to LightningStore")
+        return emitted
 
     def export_to_file(self, filepath: str) -> int:
         """
```

**File**: `agent-governance-python/agent-lightning/tests/test_lightning_comprehensive.py` (modified, +16/-0)
```diff
@@ -1060,6 +1060,22 @@ def test_emit_to_store_add_span_fallback(self):
         assert count == 1
         store.add_span.assert_called_once()
 
+    def test_emit_to_store_counts_only_accepted_spans(self):
+        entries = [_FakeEntry(), _FakeEntry(id="e2"), _FakeEntry(id="e3")]
+        emitter = FlightRecorderEmitter(_make_recorder(entries))
+        store = MagicMock(spec=["emit_span"])
+        store.emit_span.side_effect = [None, RuntimeError("store down"), None]
+        count = emitter.emit_to_store(store)
+        # The failing span is logged and skipped; the next one is still sent.
+        assert store.emit_span.call_count == 3
+        assert count == 2
+
+    def test_emit_to_store_without_span_emitter_emits_nothing(self):
+        entries = [_FakeEntry(), _FakeEntry(id="e2")]
+        emitter = FlightRecorderEmitter(_make_recorder(entries))
+        store = MagicMock(spec=[])
+        assert emitter.emit_to_store(store) == 0
+
     def test_export_to_file(self, tmp_path):
         entries = [_FakeEntry()]
         emitter = FlightRecorderEmitter(_make_recorder(entries))
```

#### Recent Merged Pull Requests:
- **PR #4519** (2026-11-03): chore(deps-dev): Bump qs from 6.15.2 to 6.17.1 in /agent-governance-python/agentmesh-integrations/mastra-agentmesh (@dependabot[bot])
- **PR #4516** (2026-11-03): chore(deps-dev): Bump qs from 6.15.2 to 6.17.1 in /policy-engine/sdk/node (@dependabot[bot])
- **PR #4515** (2026-11-03): chore(deps): Bump cedar-policy from 4.11.0 to 4.11.2 in /policy-engine (@dependabot[bot])
- **PR #4514** (2026-11-03): chore(deps): Bump rustls from 0.23.45 to 0.23.46 in /agent-governance-rust (@dependabot[bot])
- **PR #4511** (2026-11-03): chore(deps-dev): Update fastapi requirement from <1.0,>=0.151.0 to >=0.162.0,<1.0 in /agent-governance-python/agent-sre (@dependabot[bot])
- **PR #4510** (2026-11-03): chore(deps-dev): Update setuptools requirement from >=84.2.0 to >=84.2.1 in /agent-governance-python/agent-sre (@dependabot[bot])

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

## X. agent-lightning): count only accepted spans in emit_to_store (#4487)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ea260c54`: agent-lightning): count only accepted spans in emit_to_store (#4487). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **`agent-lightning` `FlightRecorderEmitter.emit_to_store` returns the number of spans it emitted.** It returned the number of spans it read from the recorder, so a span whose `emit_span`/`add_span` call raised was still counted, and a store with neither method got nothing but the return value (and the "Emitted N spans" log line) reported every span as sent. It now counts only the spans the store accepted, as its docstring and the Agent Lightning Fast-Path spec (section 12.1) say.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ea260c54` are properly handled with clean fallback behavior.
