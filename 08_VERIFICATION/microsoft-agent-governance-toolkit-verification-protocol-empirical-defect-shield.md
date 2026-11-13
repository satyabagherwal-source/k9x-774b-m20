# Verification Protocol: Verification Protocol: Empirical Defect Shield for microsoft/agent/governance/toolkit

<!-- PROVENANCE_START
{
  "source_repository": "microsoft/agent/governance/toolkit",
  "source_url": "https://github.com/microsoft/agent/governance/toolkit",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [microsoft/agent/governance/toolkit](https://github.com/microsoft/agent/governance/toolkit) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `microsoft/agent/governance/toolkit` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `b9a7b08e`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T04:32:07.409Z  
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
> **Harvest Timestamp**: 2026-11-12T04:32:07.198Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6554 stars

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
- **Issue #4424** (2026-11-11): **run_tool executes the tool before failing on an unbound post_tool_call**
  *Symptoms*: ### Package  policy-engine  ### Description  If a manifest binds `pre_tool_call` but not `post_tool_call`, `run_tool` runs the tool first and then raises `AgentControlBlocked` with `runtime_error:intervention_point_unknown`. The side effect happens, but the caller is told the call was blocked.  I'm not asking to change the fail-closed rule as. #3528 explains why an unbound point should deny, and why a `post_*` block that withholds an unchecked result is intended ([`_native_adapter_runtime.py` L99-L106](https://github.com/microsoft/agent-governance-toolkit/blob/70a4ab8e8a0434f481ba85a52ccf988a0572ceeb/agent-governance-python/agent-os/src/agent_os/integrations/_native_adapter_runtime.py#L99-L106)).  My suggestion is in two parts:  - **Document it now.** The docs say `run_tool` evaluates both tool points, but not that both must be bound. A short note in the docstring and the docs would prevent most cases, with no change in behavior.  - **Optionally, fail earlier.** If `post_tool_call` isn't bound, `run_tool` already knows it will deny before it calls `execute`. It could raise the same error at that point. The verdict, the reason and the withheld result would all be the same, but the tool wouldn't run.   **Possible fixes**  1. **Document it (suggested first step).** This is small, needs no behavior change, and is worth doing whether or not option 2 follows. State that `run_tool`, `protect_tool` and the adapters built on them need both `pre_tool_call` and `post_tool_call` bound, a

- **Issue #4178** (2026-10-02): **[Bug]: Claude Code plugin: recursive-delete rule never matches rm -rf (fix from #3834 never merged)**
  *Symptoms*: ### Package  Other  ### Description  Package: agent-governance-claude-code (also affects agent-governance-copilot-cli) The bundled `recursive-delete` deny rule of the Claude Code plugin never matches a real `rm -rf` command, so recursive deletes   are not blocked. Filed publicly because the issue is already public in #3834 and #3662.    **Where**   - `agent-governance-claude-code/config/default-policy.json`, line 41 (plugin 5.0.0, `main` at 625559f, 2026-09-28):     `"source": "\\brm\\b[\\s\\S]*\\b-rf\\b"`   - The same pattern ships in the Copilot CLI extension:   `agent-governance-copilot-cli/assets/extensions/agt-global-policy/config/default-policy.json` (line 112) and the `advisory`,   `balanced` and `strict` profiles.    **Why**   `\b-rf` requires a word character immediately before the hyphen. After a space there is no word boundary, so `rm -rf <target>`   never matches. Only nonsense forms like `rm x-rf` do.    **History**   - #3834 fixed exactly this for Claude Code, but was closed as stale on 2026-09-26 without being merged.   - #3662 / #4129 fixed the same problem for OpenCode only, with a quote-aware tokenizer (merged 2026-09-25).    **Suggested fix**   Apply the #4129 approach (tokenizer + flag parser) to the Claude Code plugin and to the Copilot CLI policies, or at least a   regex that requires whitespace before the flag.    **Workaround we use** (custom policy via `AGT_CLAUDE_POLICY_PATH`, JS regex, flag `i`):   `(?<!git\s)\brm\s+(?:[^\n;&|]*\s)?(?:-[a-z]*r[a-z]*

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

### Incident Patch 1: `bc83c555` (2026-11-11)
**Commit Message**: fix(agent-os): refuse run_tool before executing when post_tool_call is unbound (#4428)

* fix(policy-engine): refuse run_tool before execution when post_tool_call is unbound

With pre_tool_call bound and post_tool_call not, run_tool executed the
tool and only then raised AgentControlBlocked for post_tool_call with
runtime_error:intervention_point_unknown. The side effect happened while
the caller was told the call was blocked, and a retry could repeat it.
protect_tool and the MCP, LangChain, Semantic Kernel and Foundry
adapters call run_tool, so they had the same order.

In enforce mode run_tool now reads the bound points from the runtime
client's policy_labels map, which covers parents of an extends chain,
and once the pre-check permits the call raises the same block with the
same verdict and reason before calling the tool. A tool-call budget slot
reserved for the call is released, and the telemetry event is emitted
as before. The fail-closed rule for an unbound point is unchanged. A
custom runtime client without policy_labels keeps the previous order,
since the engine stays the only authority it has.

The run_tool and protect_tool docstrings, the Python SDK README, the
quickstart

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **policy-engine: agent-control-spec 0.4.0-alpha.4 (#4224).** The engine now accepts both manifest contracts (`0.4.0-alpha.1`, `0.5.0-alpha.1`); `bundle_url` and `system_prompt_url` are accepted on a pinned chain and fetched by the bundled dispatchers at dispatch time; `acs_builder_set_url_fetch_limits` stores the limits and returns `0` instead of the former `-1` "unsupported"; `REMOVED_MANIFEST_FIELDS` is deprecated in favour of `UNSUPPORTED_MANIFEST_FIELDS`. See BREAKING_CHANGES.md for the consumer-side notes.
 
 ### Fixed
+- **Python `AgentControl.run_tool` no longer runs the tool when the manifest does not bind `post_tool_call`.** With `pre_tool_call` bound and `post_tool_call` not, `run_tool` (and so `protect_tool` and the MCP, LangChain, Semantic Kernel and Foundry adapters) executed the tool and only then raised `AgentControlBlocked` for `post_tool_call` with `runtime_error:intervention_point_unknown`, so the side effect happened while the caller was told the call was blocked, and a retry could repeat it. In enforce mode `run_tool` now checks, once the pre-check permits the call, that `post_tool_call` is bound in the merged manifest (a parent of an `extends` chain counts) and raises the same block with the same verdict and reason before calling the tool; a reserved tool-call budget slot is released. The fail-closed rule for an unbound point is unchanged. A custom runtime client that does not expose `policy_labels` keeps the previous order. The `run_tool` and `protect_tool` docstrings, the Python SDK README, the quickstart and the tutorial now say both points must be bound (#4424).
 - **Hypervisor command denylist no longer misses a denied command written without a space, by path or quoted.** `RingEnforcer.check_command` compared the first whitespace-separated token against `DENIED_COMMANDS` after stripping only trailing `;&|`, so `curl;rm -rf /`, `curl&&id`, `|curl`, `/usr/bin/curl`, `./bash`, `"curl"` and `\curl` were all reported as allowed, as were `curl>out`, `(curl x)`, `` `curl x` ``, `$(curl x)`, `{ curl; }`, `$'curl'`, `>out curl` and `>"my file" curl`. The command now has redirections dropped together with their targets (`>out`, `2>&1`, `< /dev/null`, and quoted or escaped targets such as `>"my file"` or `>a\ b`), then has shell quotes (including `$'...'` and `$"..."`) and backslashes removed, is split at whitespace, `;`, `&`, `|`, `<`, `>`, `(`, `)` and backticks, skips a leading `{`, `!` or `$(`, and the first command is reduced to its executable name before matching. A token made only of control operators, or a redirection to an empty file name (`>"" curl`), is denied as having no executable name instead of being allowed.
 - **Hypervisor command denylist no longer misses a denied command after a variable assignment or a wrapper.** `RingEnforcer.check_command` took the first word as the executable, so `FOO=x curl`, `env -i curl`, `exec curl`, `nohup curl`, `nice -n 5 curl`, `timeout 5 curl`, `command curl` and `time curl` were checked as `FOO=x`, `env`, `exec` and so on and allowed, and a line continuation (`cu\<newline>rl`) split the name. Backslash-newline pairs are now removed first, leading `NAME=value` assignments (with quoted or escaped values) are skipped, and `env`, `exec`, `nohup`, `nice`, `timeout`, `stdbuf`, `time`, `command` and `builtin` are unwrapped by reading their options, so the command they run is checked. A wrapper that runs no command (`env`, `command -v curl`) is still the executable, and a wrapper whose options cannot be read (an unknown option, a missing option argument, or `env -S`) is denied (#4331).
 - **Hypervisor command denylist no longer treats a quoted `<` or `>` as a redirection.** `RingEnforcer.check_command` dropped redirections with a pattern that did not honour quotes, so a quoted or escaped `<` or `>` (`FOO=">" ls`, `echo ">"`, `echo '<'`, `echo \>`) was read as a redirection whose target ran into the rest of the command, and the command was denied as having no executable. Closed quotes and backslash escapes are now skipped when looking for redirections, as the shell reads them as part of a word; an unterminated quote is handled as before (#4335).
```

**File**: `docs/tutorials/55-agent-control-specification.md` (modified, +4/-1)
```diff
@@ -207,7 +207,10 @@ asyncio.run(main())
 ```
 
 `run_tool()` evaluates `pre_tool_call` before execution and `post_tool_call`
-after the tool returns.
+after the tool returns. The manifest must bind both points. An unbound point
+denies with `runtime_error:intervention_point_unknown`, and if `post_tool_call`
+is missing, `run_tool()` raises that block before it calls the tool, so no
+side effect happens for a call it would report as blocked.
 
 ## Step 6: Run it
 
```

**File**: `policy-engine/QUICKSTART.md` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ Driving each point by hand with `evaluate_intervention_point` works, but every S
 | --- | --- |
 | `run` | `input` and `output` around a run callable |
 | `run_model` | `pre_model_call` and `post_model_call` around a model call |
-| `run_tool` and `protect_tool` | `pre_tool_call` and `post_tool_call` around a tool execution |
+| `run_tool` and `protect_tool` | `pre_tool_call` and `post_tool_call` around a tool execution. Both points must be bound; an unbound point denies, and in enforce mode the Python SDK refuses the call before the tool runs when `post_tool_call` is missing. |
 
 In enforce mode these helpers raise a blocked error on `deny` and consult an approval resolver on `escalate`. The resolver is a host callback that returns allow, deny, or suspend. Wiring details and the per language method names are in the SDK READMEs under repository checkout path `sdk/` and in copied artifact docs such as `PYTHON_README.md`, `NODE_README.md`, and `DOTNET_README.md`.
 
```

**File**: `policy-engine/README.md` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ Input -> Model -> Tool Call -> Tool Result -> Output
 
 ## Example manifest
 
+This manifest suits a host that calls `pre_tool_call` directly. `run_tool`,
+`protect_tool` and the adapters built on them also evaluate `post_tool_call`,
+so bind that point too before using them.
+
 ```yaml
 agent_control_specification_version: "0.4.0-alpha.1"
 metadata:
```

**File**: `policy-engine/sdk/python/README.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ Runnable pieces today:
 - `parse_manifest()`, `validate_manifest()`, and `validate_manifest_overlay()` backed by the Rust runtime parser
 - `AgentControl.evaluate_intervention_point()` delegating to an abstract runtime client
 - `AgentControl.run()` enforcing `input` and `output`
-- `AgentControl.protect_tool()` / `run_tool()` enforcing `pre_tool_call` and `post_tool_call`
+- `AgentControl.protect_tool()` / `run_tool()` enforcing `pre_tool_call` and `post_tool_call`. The manifest must bind both points, including for the MCP, LangChain, Semantic Kernel and Foundry adapters, which call `run_tool`. An unbound point denies with `runtime_error:intervention_point_unknown`; when `post_tool_call` is not bound, enforce mode raises that `AgentControlBlocked` before the tool runs, so the side effect does not happen.
 - stateless adapter helpers:
   - `guard_run()` for generic agent/run callables
   - `run_model_call()` / `guard_model_call()` for `pre_model_call` and `post_model_call`
```

**File**: `policy-engine/sdk/python/agent_control_specification/_orchestration.py` (modified, +90/-0)
```diff
@@ -61,6 +61,11 @@ def __init__(
         # which case policy_id is None and annotators fall back to the executed
         # annotation keys on the result.
         self._policy_id_index, self._annotator_index = _labels_from_client(runtime_client)
+        # The set of intervention points the merged manifest binds, read from
+        # the same ``policy_labels`` map, or None when the client does not say.
+        # ``run_tool`` consults it so a tool whose ``post_tool_call`` result
+        # could never be checked is refused before it runs (#4424).
+        self._bound_points = _bound_points_from_client(runtime_client)
         self._approval_config = _approval_config_from_client(runtime_client)
 
     @classmethod
@@ -277,6 +282,12 @@ def protect_tool(
         snapshot: Mapping[str, JsonValue] | SnapshotSource | None = None,
         approval_resolver: ApprovalResolver | None = None,
     ) -> Callable[..., Awaitable[ToolRunResult]]:
+        """Wrap ``execute`` so each call goes through :meth:`run_tool`.
+
+        The manifest must bind both ``pre_tool_call`` and ``post_tool_call``;
+        see :meth:`run_tool` for what happens when one of them is missing.
+        """
+
         default_snapshot = snapshot if isinstance(snapshot, SnapshotSource) else dict(snapshot or {})
 
         async def guarded_tool(
@@ -309,6 +320,24 @@ async def run_tool(
         mode: EnforcementMode | str = EnforcementMode.ENFORCE,
         approval_resolver: ApprovalResolver | None = None,
     ) -> ToolRunResult:
+        """Run ``execute`` between ``pre_tool_call`` and ``post_tool_call``.
+
+        The manifest must bind both points. An unbound point denies with
+        ``runtime_error:intervention_point_unknown`` (see #3528), so with only
+        ``pre_tool_call`` bound the tool could run and its result would still
+        be withheld. In enforce mode ``run_tool`` therefore checks, once the
+        pre-check permits the call, that ``post_tool_call`` is bound, and
+        raises that same :class:`AgentControlBlocked` for ``post_tool_call``
+        before calling ``execute`` (#4424). The verdict and reason match what
+        the engine returns after the tool ran; only the side effect is
+        avoided. A point bound in a parent of an ``extends`` chain counts as
+        bound. The check needs the runtime client to expose ``policy_labels``
+        (every native-backed constructor does); a custom client without it
+        falls back to the engine's answer at ``post_tool_call``, after the
+        tool has run. :meth:`protect_tool` and the adapters built on
+        ``run_tool`` behave the same way.
+        """
+
         enforcement_mode = EnforcementMode(mode)
         source = snapshot if isinstance(snapshot, SnapshotSource) else None
         ambient = {} if source is not None else dict(snapshot or {})
@@ -335,6 +364,15 @@ def build(
             await self.enforce(
                 InterventionPoint.PRE_TOOL_CALL, pre_result, enforcement_mode, approval_resolver=approval_resolver
             )
+            if enforcement_mode == EnforcementMode.ENFORCE and not self._binds(InterventionPoint.POST_TOOL_CALL):
+                # The engine would deny the post-check of this call whatever
+                # the tool returns, and the result would be withheld. Raise
+                # that same block now, so the caller is not told the call was
+                # blocked after its side effect already happened (#4424).
+                started_at = time.perf_counter() if self._telemetry_sink is not None else 0.0
+                unbound_result = _point_not_bound_result()
+                self._emit_telemetry(InterventionPoint.POST_TOOL_CALL, enforcement_mode, unbound_result, started_at)
+                raise AgentControlBlocked(InterventionPoint.POST_TOOL_CALL, unbound_result)
         except BaseException:
             # The call does not go ahead, so it does not count.
             if source is not None:
@@ -363,6 +401,16 @@ def build(
             post_tool_call_result=post_result,
         )
 
+    def _binds(self, intervention_point: InterventionPoint) -> bool:
+        """Whether the manifest binds ``intervention_point``.
+
+        True when the runtime client does not report its bound points, so a
+        custom client keeps the engine as the sole authority on the question.
+        """
+
+        bound = self._bound_points
+        return bound is None or intervention_point.value in bound
+
     async def enforce(
         self,
         intervention_point: InterventionPoint,
@@ -569,6 +617,23 @@ def _approval_unresolved_result() -> InterventionPointResult:
     )
 
 
+def _point_not_bound_result() -> InterventionPointResult:
+    """The result the engine returns for a point the manifest does not bind.
+
+    Mirrors the core's ``runtime_error_verdict`` for
+    ``InterventionPointUnknown``: a deny with the reserved reason, the generic
+    message, and no policy input, since no policy was consulted.
+    "
```

**File**: `policy-engine/sdk/python/agent_control_specification/_types.py` (modified, +5/-3)
```diff
@@ -299,9 +299,11 @@ class AgentControlInterruption(RuntimeError):
 class AgentControlBlocked(AgentControlInterruption):
     """Raised when an enforcing wrapper receives a deny or unapproved escalate verdict.
 
-    For a ``post_*`` intervention point the guarded action has already executed;
-    a block prevents the result from propagating, it does not undo the side effect.
-    Use ``pre_*`` points to prevent side effects.
+    For a ``post_*`` intervention point the guarded action has usually already
+    executed; a block prevents the result from propagating, it does not undo the
+    side effect. The one exception is ``run_tool``, which raises for an unbound
+    ``post_tool_call`` before it runs the tool. Use ``pre_*`` points to prevent
+    side effects.
     """
 
     def __init__(self, intervention_point: InterventionPoint, result: InterventionPointResult):
```

**File**: `policy-engine/sdk/python/tests/test_run_tool_unbound_post.py` (added, +308/-0)
```diff
@@ -0,0 +1,308 @@
+# Copyright (c) Microsoft Corporation.
+# Licensed under the MIT License.
+"""``run_tool`` refuses a tool whose ``post_tool_call`` is not bound before it runs (#4424).
+
+An unbound intervention point denies with
+``runtime_error:intervention_point_unknown`` (#3528). Before the fix the SDK
+only learned that from the engine's answer to the post-check, by which time
+the tool had already run. These tests pin the order: the same block, the same
+reason, and a tool callable that is never invoked.
+"""
+
+from __future__ import annotations
+
+import os
+import tempfile
+import unittest
+
+from agent_control_specification import (
+    AgentControl,
+    AgentControlBlocked,
+    Decision,
+    EnforcementMode,
+    InterventionPoint,
+    InterventionPointResult,
+    SnapshotBuilder,
+    Verdict,
+)
+
+try:
+    from agent_control_specification import _native  # noqa: F401
+except ImportError:
+    _NATIVE_AVAILABLE = False
+else:
+    _NATIVE_AVAILABLE = True
+
+
+_HEADER = """agent_control_specification_version: 0.4.0-alpha.1
+metadata:
+  name: run-tool-binding
+policies:
+  tools:
+    type: custom
+    adapter: test
+"""
+
+_PRE_POINT = """  pre_tool_call:
+    policy_target: $.tool_call.args
+    policy:
+      id: tools
+"""
+
+_POST_POINT = """  post_tool_call:
+    policy_target: $.tool_result
+    policy:
+      id: tools
+"""
+
+MANIFEST_PRE_ONLY = _HEADER + "intervention_points:\n" + _PRE_POINT
+MANIFEST_BOTH = _HEADER + "intervention_points:\n" + _PRE_POINT + _POST_POINT
+# ``input`` is bound so the manifest is valid while neither tool point is.
+MANIFEST_NEITHER = (
+    _HEADER
+    + """intervention_points:
+  input:
+    policy_target: $.input
+    policy:
+      id: tools
+"""
+)
+# The parent binds ``post_tool_call``; the child binds ``pre_tool_call``.
+MANIFEST_CHAIN_PARENT = _HEADER + "intervention_points:\n" + _POST_POINT
+MANIFEST_CHAIN_CHILD = """agent_control_specification_version: 0.4.0-alpha.1
+intervention_points:
+""" + _PRE_POINT
+
+UNKNOWN = "runtime_error:intervention_point_unknown"
+
+
+class RecordingPolicy:
+    """Allows every call unless told to deny a given policy target value."""
+
+    def __init__(self, deny_when=None):
+        self.deny_when = deny_when
+        self.invocations = []
+
+    def evaluate(self, invocation):
+        self.invocations.append(invocation)
+        value = invocation["input"]["policy_target"]["value"]
+        if self.deny_when is not None and self.deny_when(value):
+            return {"decision": "deny", "reason": "policy_said_no"}
+        return {"decision": "allow"}
+
+
+class SpyTool:
+    def __init__(self):
+        self.calls = []
+
+    def __call__(self, args):
+        self.calls.append(args)
+        return {"sent": args["amount"]}
+
+
+@unittest.skipUnless(_NATIVE_AVAILABLE, "native extension not built")
+class RunToolUnboundPostToolCallTests(unittest.IsolatedAsyncioTestCase):
+    async def test_pre_only_manifest_blocks_before_the_tool_runs(self):
+        policy = RecordingPolicy()
+        control = AgentControl.from_native(MANIFEST_PRE_ONLY, policy_dispatcher=policy)
+        tool = SpyTool()
+
+        with self.assertRaises(AgentControlBlocked) as ctx:
+            await control.run_tool("send_payment", {"amount": 100}, tool)
+
+        self.assertEqual(tool.calls, [], "the tool ran although the call was reported blocked")
+        self.assertEqual(ctx.exception.intervention_point, InterventionPoint.POST_TOOL_CALL)
+        self.assertEqual(ctx.exception.result.verdict.decision, Decision.DENY)
+        self.assertEqual(ctx.exception.result.verdict.reason, UNKNOWN)
+        self.assertIsNone(ctx.exception.result.policy_input)
+        self.assertEqual(str(ctx.exception), f"Agent Control Specification blocked post_tool_call ({UNKNOWN}).")
+        # The pre-check still ran and permitted the call, as before.
+        self.assertEqual(len(policy.invocations), 1)
+
+    async def test_pre_only_block_matches_the_engine_verdict_for_an_unbound_point(self):
+        # The early block must be indistinguishable from what the engine
+        # returned after the tool ran, so existing callers see no difference.
+        policy = RecordingPolicy()
+        control = AgentControl.from_native(MANIFEST_PRE_ONLY, policy_dispatcher=policy)
+        engine = await control.evaluate_intervention_point(
+            InterventionPoint.POST_TOOL_CALL,
+            {"tool_call": {"name": "send_payment", "args": {}}, "tool_result": {}},
+        )
+
+        with self.assertRaises(AgentControlBlocked) as ctx:
+            await control.run_tool("send_payment", {"amount": 100}, SpyTool())
+
+        self.assertEqual(ctx.exception.result, engine)
+
+    async def test_pre_only_manifest_releases_the_tool_call_slot(self):
+        control = AgentControl.from_native(MANIFEST_PRE_ONLY, policy_dispatcher=RecordingPolicy())
+        builder = SnapshotBuilder(agent_id="agent", session_id="s")
+
+        with self.assertRaises(AgentContro
```

#### Recent Merged Pull Requests:
- **PR #4558** (2026-11-10): chore(deps-dev): Update pydantic requirement from <3.0,>=2.14.1 to >=2.14.2,<3.0 in /agent-governance-python/agent-sre (@dependabot[bot])
- **PR #4557** (2026-11-10): chore(deps): Update pydantic requirement from <3.0,>=2.14.1 to >=2.14.2,<3.0 in /agent-governance-python/agent-primitives (@dependabot[bot])
- **PR #4556** (2026-11-10): chore(deps-dev): Update pydantic requirement from <3.0,>=2.14.1 to >=2.14.2,<3.0 in /agent-governance-python/agent-mesh (@dependabot[bot])
- **PR #4555** (2026-11-10): chore(deps-dev): Update hypothesis requirement from <7.0,>=6.170.12 to >=6.170.14,<7.0 in /agent-governance-python/agent-mesh (@dependabot[bot])
- **PR #4553** (2026-11-10): chore(deps-dev): Update hypothesis requirement from <7.0,>=6.170.12 to >=6.170.14,<7.0 in /agent-governance-python/agent-hypervisor (@dependabot[bot])
- **PR #4552** (2026-11-10): chore(deps-dev): Update pydantic requirement from <3.0,>=2.14.1 to >=2.14.2,<3.0 in /agent-governance-python/agent-hypervisor (@dependabot[bot])

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

## X. agent-os): refuse run_tool before executing when post_tool_call is unbound (#442

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/agent-governance-toolkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bc83c555`: agent-os): refuse run_tool before executing when post_tool_call is unbound (#4428). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- **Python `AgentControl.run_tool` no longer runs the tool when the manifest does not bind `post_tool_call`.** With `pre_tool_call` bound and `post_tool_call` not, `run_tool` (and so `protect_tool` and the MCP, LangChain, Semantic Kernel and Foundry adapters) executed the tool and only then raised `AgentControlBlocked` for `post_tool_call` with `runtime_error:intervention_point_unknown`, so the side effect happened while the caller was told the call was blocked, and a retry could repeat it. In enforce mode `run_tool` now checks, once the pre-check permits the call, that `post_tool_call` is bound in the merged manifest (a parent of an `extends` chain counts) and raises the same block with the same verdict and reason before calling the tool; a reserved tool-call budget slot is released. The fail-closed rule for an unbound point is unchanged. A custom runtime client that does not expose `policy_labels` keeps the previous order. The `run_tool` and `protect_tool` docstrings, the Python SDK README, the quickstart and the tutorial now say both points must be bound (#4424).
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bc83c555` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
