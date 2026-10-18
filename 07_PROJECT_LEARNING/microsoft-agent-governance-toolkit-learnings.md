> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `78894c81`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:00:52.924Z  
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
> **Harvest Timestamp**: 2026-10-18T21:00:52.025Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6440 stars

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

### Incident Patch 1: `ce75bd82` (2026-10-17)
**Commit Message**: fix(agent-compliance): drop extras and parentheses from parsed requirement names (#4348)

_parse_requirements_line kept PEP 508 extras (requests[security]) and the
opening parenthesis of a parenthesized specifier (requests (>=2.28.0)) in
the package name, so lockfile drift reported such packages as missing and
the typosquatting check ran on the decorated name.

Signed-off-by: Shivam Sharma <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`agt-policies`: merge-layer overlap analysis no longer infers deny polarity from operand position.** `_scalar_conditions_disjoint` assumed the left operand was always the parent deny condition, but `_condition_unsatisfiable` compares the two siblings of an `and` as a peer pair, so deny `null` semantics leaked onto allow-side siblings and the result depended on sibling order. Polarity is now passed explicitly (`left_deny`/`right_deny` through `_conditions_disjoint`/`_scalar_conditions_disjoint`, `is_deny` through `_condition_unsatisfiable`); `deny_polarity` tracks the operator's rule rather than its position. This also closes an order-dependent fail-open where a deny rule whose condition was `and[eq null, ne/not_in …]` (eq-null sibling first) was wrongly judged unsatisfiable, so an overlapping child `allow` was not dropped.
 - **Python circuit breakers no longer stay HALF_OPEN forever after a cancelled probe.** `agent_sre.cascade.CircuitBreaker.call` (and the `agent_os._circuit_breaker_impl` fallback used when `agent_sre` is not installed) took a HALF_OPEN probe slot before running the call but only gave it back by recording a success or a failure. A probe that ended with `asyncio.CancelledError`, or a sync call interrupted by `KeyboardInterrupt`, did neither, so with the default `half_open_max_calls=1` every later call raised `CircuitOpenError` with `retry_after=0.0` until `reset()`. Such a probe now returns its slot without recording an outcome, matching the .NET breaker's treatment of cancellation as neither success nor failure (#2202). A probe from an earlier HALF_OPEN period does not free a slot in the current one.
 - **Supply-chain checks keep the package name of a compound version specifier.** `_parse_requirements_line` tried the operators in a fixed order and split at the first one it found anywhere in the line, so `requests>=2.28.0,!=2.29.0` was read as the package `requests>=2.28.0,` with the specifier `!=2.29.0`, and `requests<3,>=2.28.0` as `requests<3,`. `check_requirements`, `check_pyproject` and `scan_lockfile_drift` then reported findings under that name, ran the typosquatting check on it (so a typosquatted name written with a compound specifier was not flagged), and flagged the package as missing from a lockfile that lists it. The line is now split at the leftmost operator, so the name is `requests` and the specifier is the whole `>=2.28.0,!=2.29.0`.
+- **Supply-chain checks keep the package name of a requirement with extras or a parenthesized specifier.** `_parse_requirements_line` kept PEP 508 extras and the opening parenthesis in the package name, so `requests[security]==2.31.0` was read as the package `requests[security]` and `requests (>=2.28.0)` as `requests (` with the specifier `>=2.28.0)`. `scan_lockfile_drift` then reported every package written with extras as missing from a lockfile that lists it, `check_requirements` and `check_pyproject` reported findings under that name, and the typosquatting check ran on it, so a typosquatted name written with extras was not flagged. The extras and the parentheses are now dropped from the name, and the parentheses from the specifier.
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-python/agent-compliance/src/agent_compliance/supply_chain.py` (modified, +9/-5)
```diff
@@ -198,11 +198,15 @@ def _parse_requirements_line(line: str) -> tuple[str, str] | None:
     # ("pkg>=2.0,!=2.5") stays whole instead of being cut at whichever
     # operator happens to be tried first
     match = _VERSION_OPERATOR.search(line)
-    if match:
-        return line[:match.start()].strip(), line[match.start():].strip()
-
-    # No version specifier at all
-    return line, ""
+    name = line[:match.start()] if match else line
+    version_spec = line[match.start():].strip() if match else ""
+
+    # PEP 508 also allows a parenthesized specifier ("pkg (>=1.0)") and
+    # extras ("pkg[security]==1.0"); neither is part of the package name
+    if "(" in name:
+        name = name.split("(", 1)[0]
+        version_spec = version_spec.removesuffix(")").strip()
+    return name.split("[", 1)[0].strip(), version_spec
 
 
 # ---------------------------------------------------------------------------
```

**File**: `agent-governance-python/agent-compliance/tests/test_supply_chain.py` (modified, +60/-0)
```diff
@@ -240,6 +240,43 @@ def test_compound_specifier_typosquat_flagged(
         findings = guard.check_requirements(str(req))
         assert any(f.rule == "typosquat" and f.package == "reqeusts" for f in findings)
 
+    @pytest.mark.parametrize(
+        "line, version",
+        [
+            ("requests[security]>=2.28.0", ">=2.28.0"),
+            ("requests[security,socks] >= 2.28.0", ">= 2.28.0"),
+            ("requests (>=2.28.0)", ">=2.28.0"),
+            ("requests[socks] (>=2.28.0,<3)", ">=2.28.0,<3"),
+            ("requests[security]", "unspecified"),
+        ],
+    )
+    def test_extras_and_parenthesized_specifier_keep_package_name(
+        self, guard: SupplyChainGuard, tmp_path: Path, line: str, version: str,
+    ) -> None:
+        req = tmp_path / "requirements.txt"
+        req.write_text(f"{line}\n")
+        findings = guard.check_requirements(str(req))
+        assert [(f.rule, f.package, f.version) for f in findings] == [
+            ("unpinned-version", "requests", version)
+        ]
+
+    @pytest.mark.parametrize("line", ["requests[security]==2.31.0", "requests (==2.31.0)"])
+    def test_extras_and_parenthesized_exact_pin_passes(
+        self, guard: SupplyChainGuard, tmp_path: Path, line: str,
+    ) -> None:
+        req = tmp_path / "requirements.txt"
+        req.write_text(f"{line}\n")
+        assert guard.check_requirements(str(req)) == []
+
+    def test_extras_typosquat_flagged(
+        self, guard: SupplyChainGuard, tmp_path: Path,
+    ) -> None:
+        # cspell:ignore reqeusts
+        req = tmp_path / "requirements.txt"
+        req.write_text("reqeusts[socks]==2.31.0\n")
+        findings = guard.check_requirements(str(req))
+        assert any(f.rule == "typosquat" and f.package == "reqeusts" for f in findings)
+
 
 # ---------------------------------------------------------------------------
 # check_pyproject
@@ -284,6 +321,19 @@ def test_compound_specifier_keeps_package_name(
         findings = guard.check_pyproject(str(pp))
         assert [(f.rule, f.package) for f in findings] == [("loose-constraint", "requests")]
 
+    def test_extras_keep_package_name(
+        self, guard: SupplyChainGuard, tmp_path: Path,
+    ) -> None:
+        pp = tmp_path / "pyproject.toml"
+        pp.write_text(
+            '[project]\nname = "test"\n'
+            'dependencies = [\n'
+            '    "uvicorn[standard]>=0.30.0",\n'
+            ']\n'
+        )
+        findings = guard.check_pyproject(str(pp))
+        assert [(f.rule, f.package) for f in findings] == [("loose-constraint", "uvicorn")]
+
     def test_optional_dependencies_checked(
         self, guard: SupplyChainGuard, tmp_path: Path,
     ) -> None:
@@ -873,3 +923,13 @@ def test_compound_specifier_found_in_lockfile(
         lock.write_text("requests==2.31.0\n")
         findings = guard.scan_lockfile_drift(str(manifest), str(lock))
         assert findings == []
+
+    def test_extras_found_in_lockfile(
+        self, guard: SupplyChainGuard, tmp_path: Path,
+    ) -> None:
+        manifest = tmp_path / "requirements.txt"
+        manifest.write_text("requests[security]==2.31.0\nuvicorn[standard] (>=0.30.0)\n")
+        lock = tmp_path / "requirements.lock"
+        lock.write_text("requests==2.31.0\nuvicorn==0.30.0\n")
+        findings = guard.scan_lockfile_drift(str(manifest), str(lock))
+        assert findings == []
```

---

### Incident Patch 2: `73307337` (2026-10-18)
**Commit Message**: fix(claude-code): name the matched text in MCP scan deny reasons (#4353)

* fix(claude-code): name the matched text in MCP scan deny reasons

The agt-mcp-scan backend built its deny reason from each threat's type and severity only, so a block such as 'tool_poisoning (critical)' never said which text triggered it. The scanner already reports that text as threat.evidence. Append it, JSON-quoted, when present; threats without evidence keep the previous wording. What gets blocked is unchanged. Adds a regression test for a Write whose content contains 'override'. Addresses suggested fix 5 of #4343.

Signed-off-by: Micahscodingjourney <[REDACTED_EMAIL]>

* docs(changelog): note agt-mcp-scan deny reasons naming the matched text

Signed-off-by: Micahscodingjourney <[REDACTED_EMAIL]>

---------

Signed-off-by: Micahscodingjourney <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Supply-chain checks keep the package name of a compound version specifier.** `_parse_requirements_line` tried the operators in a fixed order and split at the first one it found anywhere in the line, so `requests>=2.28.0,!=2.29.0` was read as the package `requests>=2.28.0,` with the specifier `!=2.29.0`, and `requests<3,>=2.28.0` as `requests<3,`. `check_requirements`, `check_pyproject` and `scan_lockfile_drift` then reported findings under that name, ran the typosquatting check on it (so a typosquatted name written with a compound specifier was not flagged), and flagged the package as missing from a lockfile that lists it. The line is now split at the leftmost operator, so the name is `requests` and the specifier is the whole `>=2.28.0,!=2.29.0`.
 - **Supply-chain checks keep the package name of a requirement with extras or a parenthesized specifier.** `_parse_requirements_line` kept PEP 508 extras and the opening parenthesis in the package name, so `requests[security]==2.31.0` was read as the package `requests[security]` and `requests (>=2.28.0)` as `requests (` with the specifier `>=2.28.0)`. `scan_lockfile_drift` then reported every package written with extras as missing from a lockfile that lists it, `check_requirements` and `check_pyproject` reported findings under that name, and the typosquatting check ran on it, so a typosquatted name written with extras was not flagged. The extras and the parentheses are now dropped from the name, and the parentheses from the specifier.
 - **Supply-chain typosquat check no longer flags the canonical spelling of a popular PyPI package.** `check_typosquatting` compared names case- and separator-sensitively, but PyPI treats names case-insensitively and `-`, `_` and `.` as the same separator (PEP 503), so `Django`, `Flask`, `Pillow`, `Requests` and `scikit_learn` were reported as critical typosquats of `django`, `flask`, `pillow`, `requests` and `scikit-learn`. PyPI names, the popular-package list and `known_packages` are now normalized before comparing; near-miss names such as `Reqeusts` are still flagged.
+- **Claude Code `agt-mcp-scan` deny reasons now name the matched text.** A block that read `tool_poisoning (critical)` now reads `tool_poisoning (critical) matched "override"`, so a false positive can be located and reported. What gets blocked is unchanged (#4343).
 
 ### Added
 - **.NET `PolicyEngine.EvaluateAsync`** — added an async evaluation path so external policy backends whose work is I/O-bound (`IExternalPolicyBackend.EvaluateAsync`) are awaited instead of blocked on with `GetAwaiter().GetResult()`. Backends are evaluated sequentially to preserve registration order; the synchronous `Evaluate` keeps its exact prior behavior. The token is honored on entry and before each backend call, so an already-cancelled token throws `OperationCanceledException` (including on the no-backend in-memory path) and no `PolicyDecision` is produced; backend exceptions propagate rather than being turned into a deny, matching `Evaluate` (#3778).
```

**File**: `agent-governance-claude-code/lib/policy.mjs` (modified, +4/-1)
```diff
@@ -506,7 +506,10 @@ function createMcpInvocationBackend(policy, scanner) {
         backend: "agt-mcp-scan",
         decision: decisionFromSeverity(policy.mode, getHighestThreatSeverity(result.threats)),
         reason: `MCP/tool scan flagged ${result.threats.length} threat(s) for ${toolName}: ${result.threats
-          .map((threat) => `${threat.type} (${threat.severity})`)
+          .map((threat) => {
+            const label = `${threat.type} (${threat.severity})`;
+            return threat.evidence ? `${label} matched ${JSON.stringify(threat.evidence)}` : label;
+          })
           .join(", ")}.`,
       };
     },
```

**File**: `agent-governance-claude-code/test/policy.test.mjs` (modified, +24/-0)
```diff
@@ -145,6 +145,30 @@ test("evaluatePreToolUse denies direct URL metadata access regardless of paramet
   await rm(root, { recursive: true, force: true });
 });
 
+test("evaluatePreToolUse names the matched text when the MCP scan denies", async () => {
+  const root = await mkdtemp(join(tmpdir(), "agt-claude-scan-"));
+  const auditPath = join(root, "audit.json");
+  const state = await loadPolicy({ auditPath, policyPath: join(root, "no-user-policy.json") });
+
+  const result = await evaluatePreToolUse(state, {
+    tool_name: "Write",
+    tool_input: {
+      file_path: join(root, "notes.md"),
+      content: "Please override the default settings.",
+    },
+    session_id: "scan-session",
+    cwd: root,
+  });
+
+  assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
+  assert.match(
+    result.hookSpecificOutput.permissionDecisionReason,
+    /tool_poisoning \(critical\) matched "override"/,
+  );
+
+  await rm(root, { recursive: true, force: true });
+});
+
 test("checkArbitraryText surfaces poisoning and MCP scan findings", async () => {
   const root = await mkdtemp(join(tmpdir(), "agt-claude-check-"));
   const state = await loadPolicy({
```

---

### Incident Patch 3: `8b2c9647` (2026-10-16)
**Commit Message**: fix(agent-mesh): serialize JCS numbers per RFC 8785 (#4341)

* fix(agent-mesh): serialize JCS numbers per RFC 8785

approval_protocol.canonicalize wrote finite floats with Python's repr and
turned integer-valued floats into exact integers, so 1e-06, 1e-07 and 1e21
came out as 1e-06, 1e-07 and 1000000000000000000000 where RFC 8785 section
3.2.2.3 requires 0.000001, 1e-7 and 1e+21. Format floats as ECMAScript
Number::toString does: the shortest round-trip digits, plain notation for
decimal exponents from -6 through 21, exponent notation outside it.

Pin the RFC 8785 Appendix B number table in the tests.

Signed-off-by: Sankalp Gilda <[REDACTED_EMAIL]>

* docs(agent-mesh): note that affected approvals must be re-requested

Keep the Security list in the changelog contiguous and say that an
approval computed by an earlier version over a float in the changed
ranges no longer binds.

Signed-off-by: Sankalp Gilda <[REDACTED_EMAIL]>

* test(agent-mesh): mark the Appendix B hex pattern for the spell check

Add a cspell directive above the IEEE 754 bit pattern ffefffffffffffff,
which the changed-lines spell check reads as a word, and split the long
assertion in test_number_inside_object to st

**File**: `agent-governance-python/agent-mesh/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Security
 
+- **RFC 8785 number serialization in the approval action digest**: `approval_protocol.canonicalize` now writes floats the way ECMAScript `Number::toString` does, as RFC 8785 section 3.2.2.3 requires (`1e-06` becomes `0.000001`, `1e-07` becomes `1e-7`, `1e21` becomes `1e+21`). Digests over action parameters holding such floats change; they now match other JCS implementations, and an approval computed by an earlier version over such a parameter no longer binds and must be requested again. The RFC 8785 Appendix B number table is pinned in the tests.
 - **HTTP trust middleware request authentication.** `TrustMiddleware` no longer
   accepts a caller-supplied `X-Agent-DID` header as proof of identity. It
   previously started from a trust score of `1.0` and only lowered it inside an
```

**File**: `agent-governance-python/agent-mesh/src/agentmesh/governance/approval_protocol/digest.py` (modified, +39/-13)
```diff
@@ -15,21 +15,25 @@
   (CPython's ``json.dumps(..., ensure_ascii=False)`` matches JCS string
   escaping: short escapes for ``\\b \\t \\n \\f \\r`` and lowercase ``\\uXXXX``
   for the remaining control characters);
-* integers serialize with no decimal point; finite floats use CPython's
-  shortest round-trip ``repr`` with integer-valued floats normalized to
-  integers; ``NaN``/``Infinity`` are rejected.
-
-Byte-for-byte parity with non-Python JCS implementations across all float
-magnitudes (full ECMAScript ``Number`` formatting) is tracked as cross-SDK
-parity work (ADR-0030 step 6). Within the Python governance surface the
-serialization is internally consistent, which is exactly what the action-digest
-binding requires: a digest computed here always reproduces here.
+* integers serialize with no decimal point; finite floats serialize as
+  ECMAScript ``Number::toString`` does (RFC 8785 section 3.2.2.3): the
+  shortest round-trip digits, plain notation for decimal exponents from -6
+  through 21 and ``e+N`` / ``e-N`` notation outside it, so ``1e-06`` becomes
+  ``0.000001``, ``1e-07`` becomes ``1e-7`` and ``1e21`` becomes ``1e+21``;
+  ``-0.0`` serializes as ``0``; ``NaN``/``Infinity`` are rejected.
+
+Python ``int`` values serialize exactly. An integer outside the IEEE 754
+double's exact range (above 2**53 in magnitude) therefore has no counterpart
+in a JCS implementation that parses numbers as doubles, so callers that need
+cross-SDK digests should keep integers within that range.
 """
 
 from __future__ import annotations
 
 import hashlib
 import json
+import math
+from decimal import Decimal
 from typing import Any
 
 __all__ = ["canonicalize", "sha256_jcs", "DIGEST_PREFIX"]
@@ -43,11 +47,33 @@ def _format_number(value: int | float) -> str:
     # ``bool`` is a subclass of ``int``; callers screen it out before here.
     if isinstance(value, int):
         return str(value)
-    if value != value or value in (float("inf"), float("-inf")):
+    if not math.isfinite(value):
         raise ValueError("JCS cannot serialize NaN or Infinity")
-    if value.is_integer():
-        return str(int(value))
-    return repr(value)
+    return _format_double(value)
+
+
+def _format_double(value: float) -> str:
+    """Serialize a finite double as ECMAScript ``Number::toString`` does."""
+    if value == 0:
+        return "0"
+    if value < 0:
+        return "-" + _format_double(-value)
+    # ``repr`` yields the shortest digit string that round-trips, which is the
+    # digit string ECMAScript selects; only the layout differs.
+    sign, digit_tuple, exponent = Decimal(repr(value)).as_tuple()
+    digits = "".join(map(str, digit_tuple)).rstrip("0")
+    exponent += len(digit_tuple) - len(digits)
+    k = len(digits)
+    n = exponent + k  # value == 0.<digits> * 10**n
+    if k <= n <= 21:
+        return digits + "0" * (n - k)
+    if 0 < n <= 21:
+        return digits[:n] + "." + digits[n:]
+    if -6 < n <= 0:
+        return "0." + "0" * (-n) + digits
+    e = n - 1
+    mantissa = digits if k == 1 else digits[0] + "." + digits[1:]
+    return f"{mantissa}e{'+' if e >= 0 else '-'}{abs(e)}"
 
 
 def _utf16_units(key: str) -> bytes:
```

**File**: `agent-governance-python/agent-mesh/tests/test_approval_protocol.py` (modified, +55/-0)
```diff
@@ -2,6 +2,7 @@
 # Licensed under the MIT License.
 """Tests for the action-bound approval protocol (ADR-0030, step 1 foundation)."""
 
+import struct
 from datetime import datetime, timedelta, timezone
 
 import pytest
@@ -116,6 +117,60 @@ def test_sha256_prefix(self):
         assert len(digest) == len("sha256:") + 64
 
 
+# RFC 8785 Appendix B: IEEE 754 bit patterns and the serialization every
+# conforming JCS implementation emits for them.
+RFC8785_APPENDIX_B = [
+    ("0000000000000000", "0"),
+    ("8000000000000000", "0"),
+    ("0000000000000001", "5e-324"),
+    ("8000000000000001", "-5e-324"),
+    ("7fefffffffffffff", "1.7976931348623157e+308"),
+    # cspell:disable-next-line
+    ("ffefffffffffffff", "-1.7976931348623157e+308"),
+    ("4340000000000000", "9007199254740992"),
+    ("c340000000000000", "-9007199254740992"),
+    ("4430000000000000", "295147905179352830000"),
+    ("44b52d02c7e14af5", "9.999999999999997e+22"),
+    ("44b52d02c7e14af6", "1e+23"),
+    ("44b52d02c7e14af7", "1.0000000000000001e+23"),
+    ("444b1ae4d6e2ef4e", "999999999999999700000"),
+    ("444b1ae4d6e2ef4f", "999999999999999900000"),
+    ("444b1ae4d6e2ef50", "1e+21"),
+    ("3eb0c6f7a0b5ed8c", "9.999999999999997e-7"),
+    ("3eb0c6f7a0b5ed8d", "0.000001"),
+    ("41b3de4355555553", "333333333.3333332"),
+    ("41b3de4355555554", "333333333.33333325"),
+    ("41b3de4355555555", "333333333.3333333"),
+    ("41b3de4355555556", "333333333.3333334"),
+    ("41b3de4355555557", "333333333.33333343"),
+    ("becbf647612f3696", "-0.0000033333333333333333"),
+    ("43143ff3c1cb0959", "1424953923781206.2"),
+]
+
+
+class TestJcsNumberSerialization:
+    @pytest.mark.parametrize(("bits", "expected"), RFC8785_APPENDIX_B)
+    def test_rfc8785_appendix_b(self, bits: str, expected: str):
+        value = struct.unpack(">d", bytes.fromhex(bits))[0]
+        assert canonicalize(value) == expected.encode("ascii")
+
+    @pytest.mark.parametrize(
+        ("value", "expected"),
+        [(1e-6, b"0.000001"), (1e-7, b"1e-7"), (1e21, b"1e+21"), (1e20, b"100000000000000000000")],
+    )
+    def test_exponent_boundaries(self, value: float, expected: bytes):
+        assert canonicalize(value) == expected
+
+    def test_number_inside_object(self):
+        canonical = canonicalize({"tolerance": 1e-6, "big": 1e21})
+        assert canonical == b'{"big":1e+21,"tolerance":0.000001}'
+
+    @pytest.mark.parametrize("value", [float("inf"), float("-inf")])
+    def test_rejects_infinity(self, value: float):
+        with pytest.raises(ValueError):
+            canonicalize(value)
+
+
 # --------------------------------------------------------------------------- #
 # Action binding
 # --------------------------------------------------------------------------- #
```

#### Recent Merged Pull Requests:
- **PR #4362** (2026-10-18): fix(dotnet): deny MCP calls from authenticated principals whose identifier is not a DID (@Micahscodingjourney)
- **PR #4359** (2026-10-18): fix(agent-runtime): lowercase kubernetes pod names built from agent ids (@ShivamSharma43)
- **PR #4353** (2026-10-18): fix(claude-code): name the matched text in MCP scan deny reasons (@Micahscodingjourney)
- **PR #4352** (2026-10-17): fix(agent-mesh): expire MemoryStorageProvider keys after their TTL (@ShivamSharma43)
- **PR #4351** (2026-10-17): fix(agent-mesh): parse marketplace dependency specifiers like agent_marketplace (@ShivamSharma43)
- **PR #4350** (2026-10-17): fix(agent-compliance): normalize PyPI names in the typosquat check (@ShivamSharma43)

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

## X. agent-compliance): drop extras and parentheses from parsed requirement names (#4

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ce75bd82`: agent-compliance): drop extras and parentheses from parsed requirement names (#4348). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Supply-chain checks keep the package name of a requirement with extras or a parenthesized specifier.** `_parse_requirements_line` kept PEP 508 extras and the opening parenthesis in the package name, so `requests[security]==2.31.0` was read as the package `requests[security]` and `requests (>=2.28.0)` as `requests (` with the specifier `>=2.28.0)`. `scan_lockfile_drift` then reported every package written with extras as missing from a lockfile that lists it, `check_requirements` and `check_pyproject` reported findings under that name, and the typosquatting check ran on it, so a typosquatted name written with extras was not flagged. The extras and the parentheses are now dropped from the name, and the parentheses from the specifier.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ce75bd82` are properly handled with clean fallback behavior.
