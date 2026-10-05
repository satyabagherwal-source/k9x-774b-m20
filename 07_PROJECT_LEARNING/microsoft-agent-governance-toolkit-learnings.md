# Forensic Learning Record (Deep Inspection): microsoft/agent-governance-toolkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:12:07.085Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-governance-toolkit`
- **Description**: AI Agent Governance Toolkit — Policy enforcement, zero-trust identity, execution sandboxing, and reliability engineering for autonomous AI agents. Covers 10/10 OWASP Agentic Top 10.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 6393 stars

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

### Core Architecture Module: `agent-governance-codex-cli/hooks/pre-tool-use.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Codex adapter: control flow is identical to the Claude Code shim because
// Codex adopted the same hook payload and response schema. The only
// host-specific concern is where AGT state lives — Codex sessions anchor to
// CODEX_HOME (default ~/.codex) rather than Claude Code's ~/.claude, so we
// default the policy and audit paths there unless the caller has overridden them.
import { homedir } from "node:os";
import { join } from "node:path";
import { readHookInput, writeHookOutput } from "./common.mjs";
import { evaluatePreToolUse, loadPolicy } from "../lib/policy.mjs";

const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
process.env.AGT_CODEX_POLICY_PATH ??= join(codexHome, "agt", "policy.json");
process.env.AGT_CODEX_AUDIT_PATH ??= join(codexHome, "agt", "audit-log.json");

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

### Core Architecture Module: `agent-governance-codex-cli/hooks/session-start.mjs`
```
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Codex adapter: see pre-tool-use.mjs for why only the state paths differ
// from the Claude Code shim.
import { homedir } from "node:os";
import { join } from "node:path";
import { readHookInput, writeHookOutput } from "./common.mjs";
import { buildSessionStartResult, loadPolicy } from "../lib/policy.mjs";

const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
process.env.AGT_CODEX_POLICY_PATH ??= join(codexHome, "agt", "policy.json");
process.env.AGT_CODEX_AUDIT_PATH ??= join(codexHome, "agt", "audit-log.json");

try {
  const input = await readHookInput();
  const state = await loadPolicy();
  writeHookOutput(buildSessionStartResult(state, input));
} catch (error) {
  process.stderr.write(
    `AGT governance could not initialize the Codex session because startup evaluation failed closed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(2);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4178** (2026-10-02): **[Bug]: Claude Code plugin: recursive-delete rule never matches rm -rf (fix from #3834 never merged)**
  *Symptoms*: ### Package  Other  ### Description  Package: agent-governance-claude-code (also affects agent-governance-copilot-cli) The bundled `recursive-delete` deny rule of the Claude Code plugin never matches a real `rm -rf` command, so recursive deletes   are not blocked. Filed publicly because the issue is already public in #3834 and #3662.    **Where**   - `agent-governance-claude-code/config/default-policy.json`, line 41 (plugin 5.0.0, `main` at 625559f, 2026-09-28):     `"source": "\\brm\\b[\\s\\S]*\\b-rf\\b"`   - The same pattern ships in the Copilot CLI extension:   `agent-governance-copilot-cli/assets/extensions/agt-global-policy/config/default-policy.json` (line 112) and the `advisory`,   `balanced` and `strict` profiles.    **Why**   `\b-rf` requires a word character immediately before the hyphen. After a space there is no word boundary, so `rm -rf <target>`   never matches. Only nonsense forms like `rm x-rf` do.    **History**   - #3834 fixed exactly this for Claude Code, but was closed as stale on 2026-09-26 without being merged.   - #3662 / #4129 fixed the same problem for OpenCode only, with a quote-aware tokenizer (merged 2026-09-25).    **Suggested fix**   Apply the #4129 approach (tokenizer + flag parser) to the Claude Code plugin and to the Copilot CLI policies, or at least a   regex that requires whitespace before the flag.    **Workaround we use** (custom policy via `AGT_CLAUDE_POLICY_PATH`, JS regex, flag `i`):   `(?<!git\s)\brm\s+(?:[^\n;&|]*\s)?(?:-[a-z]*r[a-z]*
  **Post-Mortem & Fix Analysis**:
  > Welcome to the Agent Governance Toolkit! Thanks for opening your first issue. A maintainer will review this shortly. Check our [Contributing Guide](https://github.com/microsoft/agent-governance-toolkit/blob/main/CONTRIBUTING.md). For security issues, use [private vulnerability reporting](https://github.com/microsoft/agent-governance-toolkit/security/advisories/new).
  > I’ll work on a fix for this in the Claude Code plugin and Copilot CLI extension. I reproduced the issue locally: rm -rf falls through to Bash review instead of hitting the recursive-delete deny rule. The \b-rf boundary prevents the regex from matching real flags, so I’ll adapt the quote-aware tokenizer and flag parser from [#4129](https://github.com/microsoft/agent-governance-toolkit/pull/4129) for both packages. I’ll open a PR with Fixes #4178 and regression unit tests covering the reported failure and flag variants.

- **Issue #4172** (2026-10-02): **[Bug]: Agent-mesh: handle policy engine exceptions in PolicyProviderHandler**
  *Symptoms*: ### Package  agent-mesh  ---  ## Description  `PolicyProviderHandler.handle_check()` calls `self.policy_engine.evaluate(action, context)` without exception handling. If the policy engine raises an exception, the error propagates out of the handler instead of producing a structured governance response.  The ASGI application's `POST /check` route also invokes `handle_check()` without catching exceptions from the policy evaluation path. Consequently, an unexpected policy engine failure can cause the request to fail without returning a structured policy decision.  This is an error-handling defect in the policy enforcement gateway. The behavior of downstream callers depends on how they handle the resulting exception.  ## Expected Behavior  - Policy evaluation failures should follow the gateway's documented fail-closed behavior. - The `/check` endpoint should return a predictable, structured failure response consistent with existing project conventions. - Exceptions should not result in an implicit allow decision. - Audit behavior should be explicitly defined for failed evaluations. - Internal exception details should not be exposed to clients.  ## Actual Behavior  When `policy_engine.evaluate()` raises an exception, the exception propagates through `handle_check()` and can escape the ASGI `/check` route.  This prevents the gateway from consistently returning a structured governance response for policy evaluation failures.  ## Scope  The issue concerns exception handling in the Pyt
  **Post-Mortem & Fix Analysis**:
  > <!-- agt-contributor-check --> 🟡 **Contributor Check: MEDIUM**  | Check | Result | |-------|--------| | Profile | MEDIUM | | Credential | LOW | | **Overall** | **MEDIUM** |  *Automated check by [AGT Contributor Check](https://github.com/microsoft/agent-governance-toolkit/blob/main/docs/tutorials/53-contributor-governance.md).*

- **Issue #4152** (2026-09-29): **[Bug]: Community fallbacks in agent-sre and agent-mesh providers.py import classes that don't exist**
  *Symptoms*: ### Package  agent-sre  ### Description  Six of the community fallbacks in `agent_sre/providers.py` and `agentmesh/providers.py` import a module or class that does not exist, so each `get_*()` call fails as soon as no advanced provider is registered, which is the default for anyone installing from PyPI.  | Function | Import | What exists instead | |---|---|---| | `agent_sre.providers.get_slo_detector()` | `from agent_sre.slo.detector import SLODetector` | no `agent_sre/slo/detector.py` module | | `agent_sre.providers.get_chaos_engine()` | `from agent_sre.chaos.engine import ChaosEngine` | `chaos/engine.py` defines `ChaosExperiment`, `Fault`, ... but no `ChaosEngine` | | `agentmesh.providers.get_delegation_chain()` | `from agentmesh.identity.delegation import DelegationChain` | `ScopeChain` | | `agentmesh.providers.get_audit_logger()` | `from agentmesh.governance.audit import AuditLogger` | `AuditLog` | | `agentmesh.providers.get_trust_decay()` | `from agentmesh.reward.trust_decay import TrustDecayEngine` | `NetworkTrustEngine` | | `agentmesh.providers.get_capability_engine()` | `from agentmesh.trust.capability import CapabilityEngine` | `CapabilityRegistry` |  As far as I can tell from the history, `SLODetector`, `ChaosEngine`, `TrustDecayEngine` and `CapabilityEngine` never existed in these modules. `AuditLogger` and `DelegationChain` do exist elsewhere (e.g. `agent_rag_governance.audit.AuditLogger` and the `*-agentmesh` integrations), but not in the modules these functions 
  **Post-Mortem & Fix Analysis**:
  > @Patrick-SCH03 @MohammadHaroonAbuomar I reproduced all six fallback failures on current `main` at `e7cd145ad5c7b431d81f5765707771ca267a9d0b`.  The AgentMesh mappings look partly recoverable:  - `get_delegation_chain` -> likely `ScopeChain(**kwargs)`, but it requires explicit chain/root/leaf fields. - `get_audit_logger` -> likely `AuditLog(**kwargs)`, but that defaults to in-memory logging; file persistence requires an explicitly configured sink. - `get_trust_decay` -> `NetworkTrustEngine(**kwargs)` looks like a strong direct replacement. - `get_capability_engine` -> `CapabilityRegistry(**kwargs)` looks like a strong direct replacement, with no constructor options.  The two AgentSRE fallbacks are less clear:  - No established drop-in replacement for `get_slo_detector`. - No established drop-in replacement for `get_chaos_engine`.  `SLO`/`SLODashboard` and `ChaosExperiment`/`ChaosScheduler`/`ChaosLibrary` each cover only part of the documented behavior, so I do not want to silently substi
  > > [patrickson (@Patrick-SCH03)](https://github.com/Patrick-SCH03) [MohammadHaroonAbuomar](https://github.com/MohammadHaroonAbuomar) I reproduced all six fallback failures on current `main` at `e7cd145ad5c7b431d81f5765707771ca267a9d0b`. >  > The AgentMesh mappings look partly recoverable: >  > * `get_delegation_chain` -> likely `ScopeChain(**kwargs)`, but it requires explicit chain/root/leaf fields. > * `get_audit_logger` -> likely `AuditLog(**kwargs)`, but that defaults to in-memory logging; file persistence requires an explicitly configured sink. > * `get_trust_decay` -> `NetworkTrustEngine(**kwargs)` looks like a strong direct replacement. > * `get_capability_engine` -> `CapabilityRegistry(**kwargs)` looks like a strong direct replacement, with no constructor options. >  > The two AgentSRE fallbacks are less clear: >  > * No established drop-in replacement for `get_slo_detector`. > * No established drop-in replacement for `get_chaos_engine`. >  > `SLO`/`SLODashboard` and `ChaosExperi
  > Thanks, @electricwolfemarshmallowhypertext , for reproducing this and checking the constructor requirements. I'm happy to coordinate—I'll put together the fix PR as proposed in the issue, and I'd appreciate your review.  I'll start with the two mappings we both agree on, `get_trust_decay` → `NetworkTrustEngine` and `get_capability_engine` → `CapabilityRegistry`, and add regression tests covering both calls. I'll wait for clarification before changing the remaining four getters.  @MohammadHaroonAbuomar, are there intended replacements for those four, or should they explicitly raise `NotImplementedError` where no replacement exists?

- **Issue #4146** (2026-09-25): **[Bug]: AuditLog can expose inconsistent chain, index, and service state during concurrent writes**
  *Symptoms*: ### Package  agent-governance-toolkit-core  ### Description  AuditLog and its service wrappers do not consistently read and publish audit state under the same lock.  This allows: - verify_chain() to report a false integrity failure while an unsuccessful append is being rolled back. - Agent/type indexes to omit committed entries or return them in the wrong “most recent” order. - AuditService.entry_count to include an entry that has not committed and may subsequently disappear during rollback. - AuditService.summary() to combine a count, verification result, and Merkle root from different chain states. - The collector’s verification endpoint to report a count that does not match the entries it verified.  These failures were reproduced deterministically using controlled execution points, without sleep-based races.  This follows up on the remaining consistency gaps identified by @MohammadHaroonAbuomar during review of the earlier reader-consistency fix: [original issue context (#4139)](https://github.com/microsoft/agent-governance-toolkit/issues/4139#event-31797918190).  ### How does this impact your work?  I found this while checking audit consistency during concurrent writes and failed appends.  Consumers can receive incomplete indexed results, false integrity failures, or summary information whose count does not match its Merkle root. This makes audit results unreliable even when the committed records are valid.  A workaround is to serialize all audit reads and writes external
  **Post-Mortem & Fix Analysis**:
  > @MohammadHaroonAbuomar The follow-up fix is ready in [PR #4147](https://github.com/microsoft/agent-governance-toolkit/pull/4147).  It keeps chain verification, agent/type indexes, and service/collector responses consistent during concurrent writes and rollback. Public signatures and response shapes are unchanged.  Focused validation: **345 passed, 3 POSIX-only skips**, with deterministic regression coverage.

- **Issue #4141** (2026-09-26): **[Bug]: OpenCode tokenizer treats quotes in shell comments as syntax**
  *Symptoms*: ### Package Other — `agent-governance-opencode`  ### Description  The OpenCode shell tokenizer does not recognize Bash comments beginning with `#` while outside quotes. A quote character in a comment can therefore change its quote state and swallow following command lines. For example, an apostrophe in `# don't run cleanup below` leaves the tokenizer in single-quote mode across the newline, so it fails to recognize the following recursive-delete command.  I reproduced this with an advisory policy that allows `bash` while retaining the `recursive-delete` deny rule: `evaluateOpenCodeTool` returns `{ effect: "allow", reason: "" }` for the command below. The bundled enforce-mode policy still denies Bash through its review tier; this gap affects advisory and custom policies that allow Bash, where the recursive-delete rule is expected to provide the protection.  ### How does this impact your work?  A recursive-delete command following a comment containing an unmatched quote can bypass the explicit recursive-delete rule in advisory or custom allow-Bash configurations. This makes policy outcomes depend on unrelated prose in shell comments and can leave the configured deletion protection ineffective.  ### Timeline No hard deadline.  ### Steps to Reproduce  1. Load a policy in `advisory` mode that allows `bash` and contains the bundled `recursive-delete` rule. 2. Evaluate this command with `evaluateOpenCodeTool`:  ```sh # don't run cleanup below rm -rf /srv ```  3. Observe that the tok

- **Issue #4139** (2026-09-24): **[Bug]: AuditLog readers can observe inconsistent chain state during concurrent writes**
  *Symptoms*: ### Package  agent-governance-toolkit-core  ### Description  AuditLog readers do not consistently use the chain lock. During an append or rebuild, query() and get_entry() can expose unfinished state. Proof results and TRACE records can combine entries, hashes, and counts from different chain states.  This is separate from failed-append atomicity in #4138: it also happens during successful writes  ### How does this impact your work?  While checking concurrent audit reads, I reproduced inconsistent results. A proof can disagree with its supplied root, and a TRACE record’s transcript, count, and measurement can disagree.  A workaround is to prevent writes while these reads are running.  ### Timeline  _No response_  ### Steps to Reproduce  1. Create an AuditLog containing five entries. 2. Use a controlled hook to pause an append after the entry list changes but before the tree update finishes. Keep the writer’s lock held. 3. From another thread, call query() or get_entry() for the pending entry. 4. Observe that the reader can return the unfinished entry instead of waiting. 5. Release the writer.  Related deterministic checks trigger an append between proof construction and root reads, or between TRACE transcript serialization and its root/count reads. The resulting output combines different chain states. These checks use events and hooks, not sleeps.  ### Environment  - Repository: microsoft/agent-governance-toolkit - Component: AgentMesh - Files: governance/audit.py and governan
  **Post-Mortem & Fix Analysis**:
  > @MohammadHaroonAbuomar I’ve implemented the reader-consistency fix locally with deterministic regression tests. Focused validation: 289 passed, 3 skipped.  The changes are limited to audit.py, trace_sink.py, and test_audit_reader_consistency.py. I’ll wait for #4138 to merge before opening this PR so it contains only the reader fix.
  > #4138 is merged as 2909cb08, so main now has the failed-append rollback. Please open the reader-consistency PR whenever you are ready; the scope you describe (audit.py, trace_sink.py and the new test module) is the right split.
  > > [#4138](https://github.com/microsoft/agent-governance-toolkit/pull/4138) is merged as [2909cb0](https://github.com/microsoft/agent-governance-toolkit/commit/2909cb08b9a750be4dcf74e5f5b819a5776d7e37), so main now has the failed-append rollback. Please open the reader-consistency PR whenever you are ready; the scope you describe (audit.py, trace_sink.py and the new test module) is the right split.  @MohammadHaroonAbuomar #4138 is merged, so I rebased the reader-consistency work onto current main and kept the scope to the three files we discussed. Focused validation remains 289 passed, 3 skipped. I’m opening the focused PR for #4139 now.

- **Issue #4137** (2026-09-24): **[Bug]: MerkleAuditChain failed append can leave entries and Merkle state inconsistent**
  *Symptoms*: ### Package  agent-governance-toolkit-core  ### Description  MerkleAuditChain._add_entry_locked() adds an entry to _entries before completing the Merkle tree update. If that update raises an exception, the entry remains, but the tree and root may still represent the previous state or be partially updated.  The failed write can therefore leave persistent internal inconsistency. Later appends do not necessarily repair it. verify_integrity() can still return true because it checks entry hashes and hash-chain links, not whether the Merkle tree matches the entries.  @MohammadHaroonAbuomar identified this specific pre-existing problem in [his review of PR #4135](https://github.com/microsoft/agent-governance-toolkit/pull/4135#pullrequestreview-5308529098) and explicitly left it for a separate follow-up. This issue covers failed-append atomicity only, not the separate reader-consistency concern.  ### How does this impact your work?  Found while investigating audit-log failure handling following the review of #[4135](https://github.com/microsoft/agent-governance-toolkit/pull/4135).  A caller receives an error indicating that the write failed, but the failed entry can remain in the audit log without a corresponding Merkle tree update. This makes subsequent audit exports and inclusion proofs unreliable.  Normal successful logging is not blocked, but recovery after a failed append is unsafe: retrying or adding another entry does not reliably restore consistency.  ### Timeline  _No respon
  **Post-Mortem & Fix Analysis**:
  > @MohammadHaroonAbuomar The fix is ready in [[PR #4138](https://github.com/microsoft/agent-governance-toolkit/pull/4138)](https://github.com/microsoft/agent-governance-toolkit/pull/4138). It restores the previous audit-log state if the tree update fails, with tests confirming that existing records and proofs remain valid and retrying succeeds.  Focused validation: **235 passed, 3 skipped**. This addresses failed-append handling only; reader consistency remains a separate follow-up.

- **Issue #4134** (2026-09-24): **[Bug]: AuditLog.export() can return records inconsistent with its Merkle root during concurrent append**
  *Symptoms*: ### Package  agent-governance-toolkit-core  ### Description  AuditLog.export() can return an internally inconsistent audit export when another entry is appended after query() captures the exported records but before the Merkle root is read.  In that interleaving, the export can contain N records while merkle_root represents N+1 records.  There is a second manifestation of the same race: an append between the separate root reads can cause merkle_root and chain_root to disagree within a single export.  The issue is reproducible deterministically without sleeps or timing-dependent scheduling.  ### How does this impact your work?  This affects audit-export integrity and reproducibility.  A consumer verifying an exported audit log can receive a Merkle root that does not correspond to the records included in that export, so the supplied integrity evidence cannot be independently reproduced from the exported records.  Filtered exports are also affected by the same race because they intentionally carry the full-chain root.  A workaround would require preventing concurrent writes while an export is being created.  ### Timeline  _No response_  ### Steps to Reproduce  Steps to Reproduce*  - Create an AuditLog. - Add several entries. - Filtered exports intentionally report the full-chain root, which generally cannot be reproduced from the returned subset alone. The concurrency defect is that the records and full-chain root can describe different chain states. - Call export(). - Recompute
  **Post-Mortem & Fix Analysis**:
  > @MohammadHaroonAbuomar The fix is ready in [[PR #4135](https://github.com/microsoft/agent-governance-toolkit/pull/4135)](https://github.com/microsoft/agent-governance-toolkit/pull/4135). It captures audit entries and their Merkle root together under the same lock used by appends, with deterministic regression coverage. Focused validation: 189 passed, 3 skipped.

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

### Incident Patch 1: `09cb915e` (2026-10-04)
**Commit Message**: fix(agent-mesh): stop counting unassessed compliance controls as met (#4227)

ComplianceEngine.generate_report() computed controls_met as
total_controls - violated_controls. The engine only persisted
violations, so a control that check_compliance() never evaluated was
indistinguishable from one that was evaluated and passed. A report
generated with no checks at all came back as controls_met=2,
compliance_score=100.0 for SOC 2.

check_compliance() now records which controls it assessed, per agent.
generate_report() counts a control as met only if it was assessed in
the reporting period (and agent scope) and has no violation. Controls
that were not assessed are reported in the new controls_unassessed and
unassessed_controls fields, so met + partial + failed + unassessed ==
total_controls. compliance_score keeps its formula (met / total * 100),
so frameworks with unassessed controls now score lower instead of
being reported as fully compliant.

Notes:
- Assessments are aggregated per (control, agent, UTC day) as
  first/last timestamps, so memory scales with distinct triples rather
  than with check volume. A day only counts when its first or last
  assessment falls in the period. Tha

**File**: `agent-governance-python/agent-mesh/CHANGELOG.md` (modified, +13/-0)
```diff
@@ -115,6 +115,19 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Compliance reports no longer count unassessed controls as met.**
+  `ComplianceEngine.generate_report()` derived `controls_met` as
+  `total_controls - violated`, so a framework that `check_compliance()` never
+  exercised reported every control as met with a score of 100. The engine now
+  records which controls each check assessed, and `controls_met` counts only
+  controls assessed in the period (and agent scope) without a violation. New
+  `controls_unassessed` and `unassessed_controls` fields report the rest.
+  `compliance_score` is still `controls_met / total_controls * 100`, so scores
+  drop for frameworks with unassessed controls. The Annex IV export labels
+  `total_controls` as "Controls defined" instead of "Controls evaluated" and
+  adds a "Controls not assessed" line. `generate_report()` also accepts naive
+  period bounds (read as UTC) instead of raising `TypeError` once a violation
+  exists (#3957).
 - **Provider fallbacks on the default install.** Without an advanced provider,
   `get_trust_decay()` and `get_capability_engine()` now return `NetworkTrustEngine`
   and `CapabilityRegistry` instead of failing with an `ImportError` for classes that
```

**File**: `agent-governance-python/agent-mesh/docs/api-reference.md` (modified, +1/-1)
```diff
@@ -422,7 +422,7 @@ Trust-specific policy definitions and evaluation.
 | `HandshakeResponse` | `trust.handshake` | `challenge_id`, `responder_did`, `signature`, `capabilities`, `trust_score` |
 | `PolicyDecision` | `governance.policy` | `allowed`, `policy_name`, `matched_rules`, `reason`, `timestamp` |
 | `ComplianceViolation` | `governance.compliance` | `violation_id`, `framework`, `control_id`, `agent_did`, `severity` |
-| `ComplianceReport` | `governance.compliance` | `framework`, `period_start`, `period_end`, `total_controls`, `violations` |
+| `ComplianceReport` | `governance.compliance` | `framework`, `period_start`, `period_end`, `total_controls`, `controls_met`, `controls_unassessed`, `unassessed_controls`, `violations` |
 | `AuditEntry` | `governance.audit` | `entry_id`, `event_type`, `agent_did`, `action`, `resource`, `outcome`, `hash` |
 | `ShadowResult` | `governance.shadow` | `action_id`, `shadow_decision`, `production_decision`, `diverged` |
 | `OPADecision` | `governance.opa` | `result`, `allowed`, `reason` |
```

**File**: `agent-governance-python/agent-mesh/src/agentmesh/governance/annex_iv.py` (modified, +3/-1)
```diff
@@ -201,9 +201,11 @@ def _build_section_1(self) -> AnnexIVSection:
             latest = eu_reports[-1]
             lines.append("")
             lines.append(f"**Compliance score:** {latest.compliance_score:.1f}/100")
-            lines.append(f"**Controls evaluated:** {latest.total_controls}")
+            lines.append(f"**Controls defined:** {latest.total_controls}")
             lines.append(f"**Controls met:** {latest.controls_met}")
             lines.append(f"**Controls failed:** {latest.controls_failed}")
+            if latest.controls_unassessed is not None:
+                lines.append(f"**Controls not assessed:** {latest.controls_unassessed}")
             sources.append("ComplianceReport")
 
         placeholder = ""
```

**File**: `agent-governance-python/agent-mesh/src/agentmesh/governance/compliance.py` (modified, +90/-9)
```diff
@@ -12,7 +12,7 @@
 Every action is mapped to relevant controls automatically.
 """
 
-from datetime import datetime, timezone
+from datetime import date, datetime, timezone
 from typing import Optional, Literal
 from pydantic import BaseModel, Field
 from enum import Enum
@@ -129,11 +129,19 @@ class ComplianceReport(BaseModel):
         period_end: End of the reporting period.
         organization_id: Optional organisation scope.
         agents_covered: Agent DIDs included in the report.
-        total_controls: Total number of controls evaluated.
-        controls_met: Number of controls fully satisfied.
+        total_controls: Number of controls defined for the framework.
+        controls_met: Number of controls that were assessed during the
+            period and have no recorded violation. A control that was never
+            assessed is not counted as met.
         controls_partial: Number of controls partially satisfied.
         controls_failed: Number of controls with violations.
-        compliance_score: Overall score from 0 to 100.
+        controls_unassessed: Number of controls with no recorded assessment
+            during the period (and agent scope). ``None`` means unknown, e.g.
+            a report serialised before assessment tracking existed.
+        unassessed_controls: IDs of the controls counted in
+            ``controls_unassessed``.
+        compliance_score: Overall score from 0 to 100, computed as
+            ``controls_met / total_controls * 100``.
         violations: List of violations found during the period.
         evidence_items: Count of evidence artefacts collected.
         recommendations: Actionable remediation recommendations (max 10).
@@ -156,6 +164,8 @@ class ComplianceReport(BaseModel):
     controls_met: int = 0
     controls_partial: int = 0
     controls_failed: int = 0
+    controls_unassessed: Optional[int] = None
+    unassessed_controls: list[str] = Field(default_factory=list)
     compliance_score: float = 0.0  # 0-100
 
     # Violations
@@ -188,6 +198,13 @@ def __init__(self, frameworks: Optional[list[ComplianceFramework]] = None):
         self._mappings: dict[str, ComplianceMapping] = {}
         self._violations: list[ComplianceViolation] = []
 
+        # Assessment coverage: which controls check_compliance() actually
+        # evaluated, so reports can tell "assessed and passed" apart from
+        # "never assessed". Aggregated per (control_id, agent_did, UTC day)
+        # as (first, last) timestamps, so memory grows with distinct triples
+        # rather than with call volume.
+        self._assessments: dict[tuple[str, str, date], tuple[datetime, datetime]] = {}
+
         # Load default controls
         self._load_default_controls()
 
@@ -373,7 +390,8 @@ def check_compliance(
         """Check an action for compliance violations.
 
         Evaluates the action against all mapped controls for the given
-        action type and records any violations found.
+        action type, records that each of those controls was assessed, and
+        records any violations found.
 
         Args:
             agent_did: DID of the agent performing the action.
@@ -389,11 +407,14 @@ def check_compliance(
         if not mapping:
             return violations
 
+        now = datetime.now(timezone.utc)
         for control_id in mapping.controls:
             control = self._controls.get(control_id)
             if not control:
                 continue
 
+            self._record_assessment(control.control_id, agent_did, now)
+
             # Check requirements
             violation = self._check_control(agent_did, action_type, control, context)
             if violation:
@@ -402,6 +423,42 @@ def check_compliance(
 
         return violations
 
+    def _record_assessment(self, control_id: str, agent_did: str, at: datetime) -> None:
+        """Record that ``control_id`` was assessed for ``agent_did`` at ``at``.
+
+        "Assessed" means ``check_compliance()`` ran the control's checks for an
+        action mapped to it. ``_check_control`` has no specific rules for SOC 2
+        or EU AI Act controls, so for those it means the action was mapped to
+        the control and no violation was raised.
+        """
+        key = (control_id, agent_did, at.date())
+        seen = self._assessments.get(key)
+        if seen is None:
+            self._assessments[key] = (at, at)
+        else:
+            self._assessments[key] = (min(seen[0], at), max(seen[1], at))
+
+    def _assessed_control_ids(
+        self,
+        period_start: datetime,
+        period_end: datetime,
+        agent_ids: Optional[list[str]],
+    ) -> set[str]:
+        """Return IDs of controls assessed within the period and agent scope.
+
+        A day bucket counts only when its first or last assessment falls inside
+        the period. This can under-report coverage for a period shorter than a
+        day whose bounds both fall between the day's first and last as
```

**File**: `agent-governance-python/agent-mesh/tests/governance/test_annex_iv.py` (modified, +25/-0)
```diff
@@ -224,6 +224,31 @@ def test_section_1_includes_compliance_score(
         assert "80.0" in s1.content
         assert "ComplianceReport" in s1.source_artifacts
 
+    def test_section_1_reports_unassessed_controls(self) -> None:
+        exp = TechnicalDocumentationExporter(system_name="S", provider="P")
+        exp.add_compliance_report(
+            _make_compliance_report(
+                total_controls=2,
+                controls_met=0,
+                controls_failed=0,
+                controls_unassessed=2,
+                unassessed_controls=["EUAI-ART9", "EUAI-ART13"],
+                compliance_score=0.0,
+            )
+        )
+        s1 = exp.export().sections[0]
+        assert "**Controls defined:** 2" in s1.content
+        assert "**Controls not assessed:** 2" in s1.content
+        assert "Controls evaluated" not in s1.content
+
+    def test_section_1_omits_unassessed_line_when_unknown(
+        self, exporter: TechnicalDocumentationExporter
+    ) -> None:
+        # Reports that predate assessment tracking leave controls_unassessed
+        # as None; don't render a number we don't have.
+        s1 = exporter.export().sections[0]
+        assert "Controls not assessed" not in s1.content
+
     def test_section_2_lists_policies(self, exporter: TechnicalDocumentationExporter) -> None:
         doc = exporter.export()
         s2 = doc.sections[1]
```

**File**: `agent-governance-python/agent-mesh/tests/test_governance.py` (modified, +137/-0)
```diff
@@ -177,6 +177,143 @@ def test_gdpr_consent_violation(self):
         assert len(violations) > 0
         assert violations[0].framework == ComplianceFramework.GDPR
 
+    @staticmethod
+    def _last_30_days(engine, framework, **kwargs):
+        now = datetime.now(timezone.utc)
+        return engine.generate_report(
+            framework=framework,
+            period_start=now - timedelta(days=30),
+            period_end=now + timedelta(seconds=1),
+            **kwargs,
+        )
+
+    @staticmethod
+    def _assert_counts_add_up(report):
+        assert (
+            report.controls_met
+            + report.controls_partial
+            + report.controls_failed
+            + report.controls_unassessed
+            == report.total_controls
+        )
+
+    def test_report_without_assessments_does_not_count_controls_as_met(self):
+        """Regression for #3957: no check_compliance() call means nothing is met."""
+        engine = ComplianceEngine([ComplianceFramework.SOC2])
+
+        report = self._last_30_days(engine, ComplianceFramework.SOC2)
+
+        assert report.total_controls == 2
+        assert report.controls_met == 0
+        assert report.controls_failed == 0
+        assert report.controls_unassessed == 2
+        assert report.unassessed_controls == ["SOC2-CC6.1", "SOC2-CC7.2"]
+        assert report.compliance_score == 0.0
+        self._assert_counts_add_up(report)
+
+    def test_report_counts_only_assessed_controls_as_met(self):
+        """data_access assesses SOC2-CC6.1 but not SOC2-CC7.2."""
+        engine = ComplianceEngine([ComplianceFramework.SOC2])
+        engine.check_compliance("did:agentmesh:a", "data_access", {})
+
+        report = self._last_30_days(engine, ComplianceFramework.SOC2)
+
+        assert report.controls_met == 1
+        assert report.controls_unassessed == 1
+        assert report.unassessed_controls == ["SOC2-CC7.2"]
+        assert report.compliance_score == 50.0
+        self._assert_counts_add_up(report)
+
+    def test_report_failed_control_is_not_unassessed(self):
+        engine = ComplianceEngine([ComplianceFramework.HIPAA])
+        engine.check_compliance(
+            "did:agentmesh:a", "data_access", {"data_type": "phi", "encrypted": False}
+        )
+
+        report = self._last_30_days(engine, ComplianceFramework.HIPAA)
+
+        assert report.controls_failed == 1
+        assert report.controls_met == 0
+        assert report.unassessed_controls == ["HIPAA-164.312(a)(1)"]
+        assert report.compliance_score == 0.0
+        self._assert_counts_add_up(report)
+
+    def test_report_ignores_assessments_outside_period(self):
+        engine = ComplianceEngine([ComplianceFramework.SOC2])
+        engine.check_compliance("did:agentmesh:a", "data_access", {})
+
+        now = datetime.now(timezone.utc)
+        report = engine.generate_report(
+            framework=ComplianceFramework.SOC2,
+            period_start=now - timedelta(days=30),
+            period_end=now - timedelta(days=1),
+        )
+
+        assert report.controls_met == 0
+        assert report.controls_unassessed == 2
+
+    def test_report_ignores_assessments_outside_agent_scope(self):
+        engine = ComplianceEngine([ComplianceFramework.SOC2])
+        engine.check_compliance("did:agentmesh:a", "data_access", {})
+
+        other = self._last_30_days(
+            engine, ComplianceFramework.SOC2, agent_ids=["did:agentmesh:b"]
+        )
+        same = self._last_30_days(
+            engine, ComplianceFramework.SOC2, agent_ids=["did:agentmesh:a"]
+        )
+
+        assert other.controls_met == 0
+        assert other.controls_unassessed == 2
+        assert same.controls_met == 1
+        assert same.controls_unassessed == 1
+
+    def test_report_accepts_naive_period_bounds(self):
+        """Naive bounds are read as UTC instead of raising TypeError."""
+        engine = ComplianceEngine([ComplianceFramework.HIPAA])
+        engine.check_compliance(
+            "did:agentmesh:a", "data_access", {"data_type": "phi", "encrypted": False}
+        )
+
+        now = datetime.now(timezone.utc).replace(tzinfo=None)
+        report = engine.generate_report(
+            framework=ComplianceFramework.HIPAA,
+            period_start=now - timedelta(days=30),
+            period_end=now + timedelta(seconds=1),
+        )
+
+        assert report.controls_failed == 1
+        assert report.controls_unassessed == 1
+
+    def test_assessment_tracking_does_not_grow_with_call_volume(self):
+        engine = ComplianceEngine([ComplianceFramework.SOC2])
+        for _ in range(500):
+            engine.check_compliance("did:agentmesh:a", "data_access", {})
+
+        # One entry per (control, agent, UTC day), not per call. Two only if
+        # the loop happens to straddle midnight.
+        assert len(engine._assessments) <= 2
+
+    def test_report_from_legacy_json_has_unknown_coverage(self):
+        """Reports serialised before this field existed must not 
```

**File**: `docs/packages/agent-mesh.md` (modified, +6/-3)
```diff
@@ -567,12 +567,15 @@ violations = compliance.check_compliance(
 )
 
 # Generate compliance report
-from datetime import datetime, timedelta
+from datetime import datetime, timedelta, timezone
+now = datetime.now(timezone.utc)
 report = compliance.generate_report(
     framework=ComplianceFramework.SOC2,
-    period_start=datetime.utcnow() - timedelta(days=30),
-    period_end=datetime.utcnow(),
+    period_start=now - timedelta(days=30),
+    period_end=now,
 )
+# Controls never exercised by check_compliance() are not counted as met
+print(report.controls_met, report.unassessed_controls)
 ```
 
 ### EU AI Act Risk Classification
```

**File**: `docs/specs/AUDIT-COMPLIANCE-1.0.md` (modified, +11/-3)
```diff
@@ -741,10 +741,12 @@ A compliance report MUST contain:
 | `period_end` | datetime | REQUIRED | End of assessment period. |
 | `organization_id` | string | OPTIONAL | Organization being assessed. |
 | `agents_covered` | list[string] | REQUIRED | Agent DIDs included in assessment. |
-| `total_controls` | int | REQUIRED | Total number of controls assessed. |
-| `controls_met` | int | REQUIRED | Controls fully satisfied. |
+| `total_controls` | int | REQUIRED | Number of controls defined for the framework. |
+| `controls_met` | int | REQUIRED | Controls assessed during the period with no violation. |
 | `controls_partial` | int | REQUIRED | Controls partially satisfied. |
 | `controls_failed` | int | REQUIRED | Controls not satisfied. |
+| `controls_unassessed` | int or None | OPTIONAL | Controls with no recorded assessment during the period. `None` means unknown. |
+| `unassessed_controls` | list[string] | OPTIONAL | IDs of the controls counted in `controls_unassessed`. |
 | `compliance_score` | float | REQUIRED | Overall score (0--100). |
 | `violations` | list[ComplianceViolation] | REQUIRED | Violations during the period. |
 | `evidence_items` | list[dict] | REQUIRED | Evidence collected. |
@@ -758,11 +760,17 @@ The compliance score MUST be computed as:
 compliance_score = (controls_met / total_controls) * 100
 ```
 
-Where `controls_met = total_controls - count(violated_controls)`.
+Where `controls_met = count(assessed_controls - violated_controls)`.
 
 A control is considered violated if ANY violation references that control's `control_id`
 during the assessment period.
 
+A control is considered assessed if a compliance check evaluated it during the assessment
+period (and, when the report is scoped to agents, for one of those agents). A control with
+a recorded violation is assessed. A control that was not assessed MUST NOT be counted in
+`controls_met`; it is counted in `controls_unassessed`, so that
+`controls_met + controls_partial + controls_failed + controls_unassessed == total_controls`.
+
 ### 10.9 Compliance Check [Pure Specification]
 
 The `check_compliance(action_type, evidence)` method MUST:
```

---

### Incident Patch 2: `83eb1aac` (2026-10-03)
**Commit Message**: chore(deps): Bump brace-expansion (#4222)

Bumps  and [brace-expansion](https://github.com/juliangruber/brace-expansion). These dependencies needed to be updated together.

Updates `brace-expansion` from 5.0.6 to 5.0.12
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.6...v5.0.12)

Updates `brace-expansion` from 1.1.15 to 1.1.21
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.6...v5.0.12)

Updates `brace-expansion` from 2.1.1 to 2.1.7
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.6...v5.0.12)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
- dependency-name: brace-expansion
  dependency-version: 1.1.21
  dependency-type: indirect
- dependency-name: brace-expansion
  dependency-version: 2.1.7
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333

**File**: `agent-governance-python/agent-os/extensions/copilot/package-lock.json` (modified, +10/-10)
```diff
@@ -2942,16 +2942,16 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.6",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.6.tgz",
-      "integrity": "sha512-kLpxurY4Z4r9sgMsyG0Z9uzsBlgiU/EFKhj/h91/8yHu0edo7XuixOIH3VcJ8kkxs6/jPzoI6U9Vj3WqbMQ94g==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
       },
       "engines": {
-        "node": "18 || 20 || >=22"
+        "node": "20 || >=22"
       }
     },
     "node_modules/browserslist": {
@@ -4362,9 +4362,9 @@
       "license": "MIT"
     },
     "node_modules/glob/node_modules/brace-expansion": {
-      "version": "2.1.1",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.1.tgz",
-      "integrity": "sha512-WR1cURNjuvBLMZBMbqM0UoE+WAfdUcEV1ccD8PVBVOI+Z3ND4+SZbN8RsfT2bMuG1qwz5RFvPukSZm5fF2D5eA==",
+      "version": "2.1.7",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-2.1.7.tgz",
+      "integrity": "sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -6827,9 +6827,9 @@
       "license": "MIT"
     },
     "node_modules/test-exclude/node_modules/brace-expansion": {
-      "version": "1.1.15",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.15.tgz",
-      "integrity": "sha512-EwOCDEex4quD37XhqM3omwtMoJjr//isUZz1JopUNWms+4Z2ViyM/k1YIRePpoVNnQhENnxtFjLaxNHrT7xIUg==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 3: `1f694099` (2026-10-03)
**Commit Message**: chore(deps-dev): Bump brace-expansion (#4220)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 1.1.16 to 1.1.21.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v1.1.16...v1.1.21)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 1.1.21
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `agent-governance-python/agent-mesh/packages/mcp-proxy/package-lock.json` (modified, +3/-3)
```diff
@@ -934,9 +934,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.16",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.16.tgz",
-      "integrity": "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 4: `abaf0a5b` (2026-10-03)
**Commit Message**: chore(deps-dev): Bump brace-expansion (#4218)

Bumps [brace-expansion](https://github.com/juliangruber/brace-expansion) from 5.0.7 to 5.0.12.
- [Release notes](https://github.com/juliangruber/brace-expansion/releases)
- [Commits](https://github.com/juliangruber/brace-expansion/compare/v5.0.7...v5.0.12)

---
updated-dependencies:
- dependency-name: brace-expansion
  dependency-version: 5.0.12
  dependency-type: indirect
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `agent-governance-python/agent-os/extensions/mcp-server/package-lock.json` (modified, +4/-4)
```diff
@@ -1732,16 +1732,16 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.7",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.7.tgz",
-      "integrity": "sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
       },
       "engines": {
-        "node": "18 || 20 || >=22"
+        "node": "20 || >=22"
       }
     },
     "node_modules/bytes": {
```

---

### Incident Patch 5: `6d16e242` (2026-10-02)
**Commit Message**: fix(agent-sre): evaluate burn alerts over their declared windows (#4210)

* fix(agent-sre): evaluate burn alerts over their declared windows

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

* docs(agent-sre): note burn alert window correction

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

---------

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agent-sre/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -27,6 +27,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   the in-memory store's row list when the default backend is used.
 
 ### Fixed
+- Burn alerts now evaluate errors over each alert's declared window instead of
+  the default one-hour window, allowing errors from one to 24 hours ago to
+  correctly raise SLO status to WARNING or CRITICAL.
 - **Provider fallbacks on the default install.** Without an advanced provider,
   `get_slo_detector()` and `get_chaos_engine()` raise a `NotImplementedError` naming
   the missing class and the entry point group a provider package must register,
```

**File**: `agent-governance-python/agent-sre/src/agent_sre/slo/objectives.py` (modified, +1/-2)
```diff
@@ -138,8 +138,7 @@ def alerts(self) -> list[BurnRateAlert]:
 
     def firing_alerts(self) -> list[BurnRateAlert]:
         """Get alerts that are currently firing."""
-        current = self.burn_rate()
-        return [a for a in self.alerts() if a.is_firing(current)]
+        return [a for a in self.alerts() if a.is_firing(self.burn_rate(a.window_seconds))]
 
     def to_dict(self) -> dict[str, Any]:
         """Serialize to dictionary."""
```

**File**: `agent-governance-python/agent-sre/tests/unit/test_objectives.py` (modified, +14/-1)
```diff
@@ -2,13 +2,26 @@
 # Licensed under the MIT License.
 """Tests for SLO definitions and error budget engine."""
 
-
+from unittest.mock import patch
 
 from agent_sre.slo.indicators import CostPerTask, PolicyCompliance, TaskSuccessRate
 from agent_sre.slo.objectives import SLO, ErrorBudget, ExhaustionAction, SLOStatus
 
 
 class TestErrorBudget:
+    def test_firing_alerts_use_their_declared_window(self) -> None:
+        budget = ErrorBudget(total=0.01)
+        with patch("agent_sre.slo.objectives.time.monotonic", return_value=1000):
+            budget.record_event(good=False)
+        with patch("agent_sre.slo.objectives.time.monotonic", return_value=8200):
+            assert budget.burn_rate(3600) == 0
+            assert budget.burn_rate(86400) > budget.burn_rate_critical
+            assert {a.name for a in budget.firing_alerts()} == {
+                "burn_rate_warning", "burn_rate_critical"
+            }
+        with patch("agent_sre.slo.objectives.time.monotonic", return_value=87401):
+            assert budget.firing_alerts() == []
+
     def test_initial_state(self) -> None:
         budget = ErrorBudget(total=0.01)  # 1% budget
         assert budget.remaining == 1.0
```

---

### Incident Patch 6: `1db21154` (2026-10-02)
**Commit Message**: fix(agent-sre): preserve alert fingerprint field boundaries (#4208)

* fix(agent-sre): preserve alert fingerprint field boundaries

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

* test(agent-sre): recognize existing alert class in spell check

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

---------

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agent-sre/src/agent_sre/alerts/dedup.py` (modified, +3/-2)
```diff
@@ -13,6 +13,7 @@
 from __future__ import annotations
 
 import hashlib
+import json
 import threading
 import time
 from typing import TYPE_CHECKING
@@ -36,8 +37,8 @@ def alert_fingerprint(alert: Alert, fields: Sequence[str] = ("agent_id", "title"
     parts = []
     for f in fields:
         val = getattr(alert, f, "")
-        parts.append(f"{f}={val}")
-    raw = "|".join(parts)
+        parts.append((f, str(val)))
+    raw = json.dumps(parts)
     return hashlib.sha256(raw.encode()).hexdigest()
 
 
```

**File**: `agent-governance-python/agent-sre/tests/test_alert_dedup.py` (modified, +10/-0)
```diff
@@ -65,6 +65,16 @@ def test_missing_field_uses_empty_string(self):
 
 
 class TestAlertDeduplicator:
+    def test_field_delimiters_do_not_merge_distinct_alerts(self):
+        d = AlertDeduplicator(window_seconds=60)  # cspell:words Deduplicator
+        first = Alert(agent_id="agent|title=worker", title="Breach", message="first")
+        second = Alert(agent_id="agent", title="worker|title=Breach", message="second")
+
+        assert d.consume(first) is True
+        assert d.consume(second) is True
+        assert d.consume(first) is False
+        assert d.consume(second) is False
+
     def test_first_alert_passes(self):
         d = AlertDeduplicator(window_seconds=60)
         a = Alert(title="Breach", message="x", agent_id="a1")
```

---

### Incident Patch 7: `a6db33e9` (2026-10-02)
**Commit Message**: fix(policy-engine): version the core compatibility shim separately (#4204)

* fix(policy-engine): version the core compatibility shim separately

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

* docs(policy-engine): audit core shim lockfile changes

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

---------

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-rust/Cargo.lock` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ dependencies = [
 
 [[package]]
 name = "agent_control_specification_core"
-version = "0.3.1-beta.0"
+version = "0.3.2-beta.0"
 dependencies = [
  "agent-control-spec",
  "jsonschema",
```

**File**: `benchmarks/prompt-injection/harness/agt-rules-baseline/Cargo.lock` (modified, +395/-133)
```diff
@@ -31,41 +31,76 @@ dependencies = [
 
 [[package]]
 name = "aes-gcm"
-version = "0.11.0"
+version = "0.11.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "fdf011db2e21ce0d575593d749db5554b47fed37aff429e4dc50bc91ac93a028"
+checksum = "7f2b8006a0c83f52b62ba44a97b58bf76fe2f70a329e588f67f89691d93d498f"
 dependencies = [
  "aead",
  "aes",
  "cipher",
  "ctr",
+ "ctutils",
  "ghash",
- "subtle",
+]
+
+[[package]]
+name = "agent-control-spec"
+version = "0.4.0-alpha.3"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "92f7c1a0b2f6579980a6b30b78d7ee765b9fc185612b649c5b693e7464ab60e0"
+dependencies = [
+ "agent-hooks-sdk",
+ "async-trait",
+ "base64 0.23.1",
+ "cedar-policy",
+ "regex",
+ "serde",
+ "serde_json",
+ "serde_yaml",
+ "sha2 0.11.0",
+ "ureq",
+ "url",
+]
+
+[[package]]
+name = "agent-hooks-sdk"
+version = "0.1.0-alpha.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "d4b0b9e8954768431c15125a6218ea0e45d8a057b782cab7e358477cc5c243f0"
+dependencies = [
+ "async-trait",
+ "futures-util",
+ "ryu-js",
+ "serde",
+ "serde_json",
+ "sha2 0.11.0",
+ "thiserror",
 ]
 
 [[package]]
 name = "agent_control_specification"
-version = "0.3.1-beta.0"
+version = "0.4.0-beta.0"
 dependencies = [
+ "agent-control-spec",
+ "agent-hooks-sdk",
  "agent_control_specification_core",
  "serde",
  "serde_json",
+ "sha2 0.10.9",
+ "tempfile",
+ "url",
 ]
 
 [[package]]
 name = "agent_control_specification_core"
-version = "0.3.1-beta.0"
+version = "0.3.2-beta.0"
 dependencies = [
- "base64 0.22.1",
- "cedar-policy",
+ "agent-control-spec",
  "jsonschema",
- "regex",
  "serde",
+ "serde-saphyr",
  "serde_json",
- "serde_yaml",
- "sha2",
- "ureq",
- "url",
+ "sha2 0.10.9",
 ]
 
 [[package]]
@@ -83,9 +118,9 @@ dependencies = [
  "regex",
  "regorus",
  "serde",
+ "serde-saphyr",
  "serde_json",
- "serde_yaml",
- "sha2",
+ "sha2 0.10.9",
  "thiserror",
 ]
 
@@ -99,7 +134,7 @@ dependencies = [
  "regex",
  "serde",
  "serde_json",
- "sha2",
+ "sha2 0.10.9",
  "thiserror",
 ]
 
@@ -143,6 +178,23 @@ dependencies = [
  "libc",
 ]
 
+[[package]]
+name = "annotate-snippets"
+version = "0.12.16"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f211a51805bc641f3ad5b7664c77d2547af685cc33b4cd8d31964027a46f13f1"
+dependencies = [
+ "anstyle",
+ "memchr",
+ "unicode-width 0.2.2",
+]
+
+[[package]]
+name = "anstyle"
+version = "1.0.14"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "940b3a0ca603d1eade50a4846a2afffd5ef57a9feac2c0e2ec2e14f9ead76000"
+
 [[package]]
 name = "anyhow"
 version = "1.0.102"
@@ -158,6 +210,12 @@ dependencies = [
  "object",
 ]
 
+[[package]]
+name = "arraydeque"
+version = "0.5.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "7d902e3d592a523def97af8f317b08ce16b7ab854c1985a0c671e6f15cebc236"
+
 [[package]]
 name = "arrayvec"
 version = "0.5.2"
@@ -173,6 +231,17 @@ dependencies = [
  "term",
 ]
 
+[[package]]
+name = "async-trait"
+version = "0.1.92"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "82f6aeea286b8eb4dd3431a1be1b59d290ace00f5bfd8e2a159bc2a05e2c1667"
+dependencies = [
+ "proc-macro2",
+ "quote",
+ "syn 3.0.4",
+]
+
 [[package]]
 name = "autocfg"
 version = "1.5.1"
@@ -197,12 +266,6 @@ version = "0.23.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "ac07cdecf99051d9a5238b80f35af32cdeba5b336e55d957b318b50137e18da5"
 
-[[package]]
-name = "base64ct"
-version = "1.8.3"
-source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2af50177e190e07a26ab74f8b1efbfe2ef87da2116221318cb1c2e82baf7de06"
-
 [[package]]
 name = "bit-set"
 version = "0.5.3"
@@ -306,9 +369,9 @@ dependencies = [
 
 [[package]]
 name = "cedar-policy"
-version = "4.12.0"
+version = "4.13.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f73547a0114dff845fcb8d4877548a665fb8ff949a30cb0963444d6c30ffd962"
+checksum = "5e4f5e46c425491b7133eecb3030d82d27301b84bfa08533c59a6902cca7eb80"
 dependencies = [
  "cedar-policy-core",
  "cedar-policy-formatter",
@@ -327,9 +390,9 @@ dependencies = [
 
 [[package]]
 name = "cedar-policy-core"
-version = "4.12.0"
+version = "4.13.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "c9d9ec16707c7b60aa73b922dc255ec0b97b6892e8e58e45188b15d874ca3590"
+checksum = "7a30d11033d59b262bbb380d8bb5dc5c3dd2dd2281675c558ef4fd8a161ce669"
 dependencies = [
  "chrono",
  "educe",
@@ -355,9 +418,9 @@ dependencies = [
 
 [[package]]
 name = "cedar-policy-formatter"
-version = "4.12.0"
+version = "4.13.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "2483b2fa74f74b1b3945bec59feb7a3fc0ea56b6fb35564ef300884dd8415d4b"
+checksum = "8a2c8dc671e62597c85caa11694365b76050abcd9f2177f0520ccac0580f9a41"
 dependencies = [
  "cedar-policy-core",
  "itertools 0.15.0",
@@ -380,6 +443,17 @@ ver
```

**File**: `docs/dependency-audits/2026-10-02-core-shim-version.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+---
+title: "Dependency audit: separate core shim version"
+last_reviewed: 2026-10-02
+owner: 1aifanatic
+---
+
+<!-- cspell:words aifanatic arraydeque fastrand httparse multiversion nohash simdutf verus prettyplease vstd -->
+
+# Separate core shim version
+
+## Which dependencies changed and why
+
+The local `agent_control_specification_core` compatibility shim changes from
+`0.3.1-beta.0` to `0.3.2-beta.0` to avoid the already published version of the
+previous embedded engine. The standalone Rust SDK pins that new version exactly.
+No dependency manifest ranges other than that exact shim pin change.
+
+The lockfiles in `policy-engine/`, `agent-governance-rust/`, and
+`policy-engine/examples/coding_agent/app/` change only the shim version.
+The benchmark harness lockfile in
+`benchmarks/prompt-injection/harness/agt-rules-baseline/` was stale: it still
+recorded the pre-migration embedded engine and SDK. Cargo regenerated it against
+the current manifests, adding the already declared upstream dependencies and
+refreshing their transitive resolution. Its complete package-version changes are:
+
+| Package | Previous locked versions | New locked versions |
+| --- | --- | --- |
+| `aes-gcm` | 0.11.0 | 0.11.1 |
+| `agent-control-spec` | (absent) | 0.4.0-alpha.3 |
+| `agent-hooks-sdk` | (absent) | 0.1.0-alpha.5 |
+| `agent_control_specification` | 0.3.1-beta.0 | 0.4.0-beta.0 |
+| `agent_control_specification_core` | 0.3.1-beta.0 | 0.3.2-beta.0 |
+| `annotate-snippets` | (absent) | 0.12.16 |
+| `anstyle` | (absent) | 1.0.14 |
+| `arraydeque` | (absent) | 0.5.1 |
+| `async-trait` | (absent) | 0.1.92 |
+| `base64ct` | 1.8.3 | (removed) |
+| `cedar-policy` | 4.12.0 | 4.13.0 |
+| `cedar-policy-core` | 4.12.0 | 4.13.0 |
+| `cedar-policy-formatter` | 4.12.0 | 4.13.0 |
+| `chacha20` | (absent) | 0.10.2 |
+| `const-oid` | 0.9.6 | 0.10.2 |
+| `convert_case` | (absent) | 0.4.0 |
+| `core_detect` | (absent) | 1.0.0 |
+| `curve25519-dalek` | 4.1.3 | 5.0.0 |
+| `der` | 0.7.10 | (removed) |
+| `digest` | 0.10.7 | 0.10.7, 0.11.3 |
+| `ed25519` | 2.2.3 | 3.0.0 |
+| `ed25519-dalek` | 2.2.0 | 3.0.0 |
+| `encoding_rs` | (absent) | 0.8.42 |
+| `encoding_rs_io` | (absent) | 0.1.8 |
+| `errno` | (absent) | 0.3.14 |
+| `fastrand` | (absent) | 2.5.0 |
+| `fiat-crypto` | 0.2.9 | 0.3.0 |
+| `granit-parser` | (absent) | 1.3.0 |
+| `http` | (absent) | 1.5.0 |
+| `httparse` | (absent) | 1.10.1 |
+| `linux-raw-sys` | (absent) | 0.12.1 |
+| `multiversion_no_op` | (absent) | 1.0.0 |
+| `nohash-hasher` | (absent) | 0.2.0 |
+| `pkcs8` | 0.10.2 | (removed) |
+| `ppv-lite86` | 0.2.21 | (removed) |
+| `rand` | 0.8.6 | 0.10.2 |
+| `rand_chacha` | 0.3.1 | (removed) |
+| `rand_core` | 0.10.1, 0.6.4 | 0.10.1 |
+| `regorus` | 0.11.0 | 0.12.0 |
+| `rustix` | (absent) | 1.1.5 |
+| `ryu-js` | (absent) | 1.0.3 |
+| `serde-saphyr` | (absent) | 1.2.0 |
+| `sha2` | 0.10.9 | 0.10.9, 0.11.0 |
+| `signature` | 2.2.0 | 3.0.0 |
+| `simdutf8` | (absent) | 0.1.5 |
+| `spki` | 0.7.3 | (removed) |
+| `tempfile` | (absent) | 3.27.0 |
+| `ureq` | 2.12.1 | 3.4.2 |
+| `ureq-proto` | (absent) | 0.6.4 |
+| `utf8-zero` | (absent) | 0.8.1 |
+| `verus_builtin` | (absent) | 0.0.0-2026-08-09-0044 |
+| `verus_builtin_macros` | (absent) | 0.0.0-2026-08-23-0033 |
+| `verus_prettyplease` | (absent) | 0.0.0-2026-08-09-0044 |
+| `verus_state_machines_macros` | (absent) | 0.0.0-2026-08-02-0125 |
+| `verus_syn` | (absent) | 0.0.0-2026-08-02-0125 |
+| `vstd` | (absent) | 0.0.0-2026-08-23-0033 |
+| `webpki-roots` | 0.26.11, 1.0.9 | 1.0.9 |
+
+## Security advisory relevance
+
+This change resolves a package version collision, not a specific security
+advisory. It does not claim to be a vulnerability audit or to remediate an
+advisory. Registry dependencies retain Cargo-generated checksums; no vendored
+source is added or changed.
+
+## Breaking change risk assessment
+
+The shim source and its public API are unchanged. Consumers using the exact SDK
+pin resolve the distinct shim package version. The main compatibility risk is
+the benchmark harness's refreshed transitive graph; the larger lockfile change
+is confined to that harness rather than the production workspace locks.
+
+Validation completed before submission: locked Cargo metadata for all four
+workspaces, core packaging, 31 core tests, policy-engine formatting and Clippy
+with warnings denied, the policy-engine workspace suite with OPA 0.70.0, and
+the standalone Rust release workspace suite. Compiled checks used WSL because
+the native Windows MSVC linker was unavailable. The harness was checked with
+locked Cargo metadata; its runtime benchmark was not executed.
```

**File**: `policy-engine/Cargo.lock` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ dependencies = [
 
 [[package]]
 name = "agent_control_specification_core"
-version = "0.3.1-beta.0"
+version = "0.3.2-beta.0"
 dependencies = [
  "agent-control-spec",
  "jsonschema 0.17.1",
```

**File**: `policy-engine/QUICKSTART.md` (modified, +1/-1)
```diff
@@ -233,7 +233,7 @@ For an artifact-only kit, validate the installed package from a temporary host p
 
 | SDK | Artifact-only smoke check |
 | --- | --- |
-| Rust | `mkdir crates && for c in agent_control_specification_core agent_control_specification agent_control_specification_openai agent_control_specification_mcp agent_control_specification_rig; do tar -xzf "$ACS_KIT"/artifacts/$c-0.3.1-beta.0.crate -C crates 2>/dev/null || true; done`, then point `[patch.crates-io]` at the extracted `crates/<name>-0.3.1-beta.0` directories before `cargo check` |
+| Rust | `mkdir -p crates && tar -xzf "$ACS_KIT/artifacts/agent_control_specification_core-0.3.2-beta.0.crate" -C crates && tar -xzf "$ACS_KIT/artifacts/agent_control_specification-0.4.0-beta.0.crate" -C crates`, then point `[patch.crates-io]` at `crates/agent_control_specification_core-0.3.2-beta.0` and `crates/agent_control_specification-0.4.0-beta.0` before `cargo check`. If using the optional OpenAI, MCP, or Rig adapters, extract their `0.4.0-beta.0` archives and add their extracted directories to the same patch table. |
 | Python | `python -m venv .venv && .venv/bin/python -m pip install "$ACS_KIT"/artifacts/agent_control_specification-0.3.1b1-*.whl && .venv/bin/python -c "import agent_control_specification as acs; print(acs.AgentControl)"` |
 | Node | `npm init -y && npm install "$ACS_KIT"/artifacts/agent-control-specification-0.3.1-beta.0.tgz "$ACS_KIT"/artifacts/agent-control-specification-linux-x64-gnu-0.3.1-beta.0.tgz "$ACS_KIT"/artifacts/agent-control-specification-opa-linux-x64-0.3.1-beta.0.tgz && node -e "const acs=require('agent-control-specification'); console.log(typeof acs.AgentControl)"` |
 | .NET | `dotnet new console -n AcsSmoke && cd AcsSmoke && dotnet add package AgentControlSpecification --version 0.3.1-beta.0 --source "$ACS_KIT/artifacts" && dotnet build` |
```

**File**: `policy-engine/core/Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "agent_control_specification_core"
-version = "0.3.1-beta.0"
+version = "0.3.2-beta.0"
 edition = "2021"
 rust-version = "1.89"
 description = "Deprecated compatibility shim over agent-control-spec. Use agent-control-spec directly."
```

**File**: `policy-engine/examples/coding_agent/app/Cargo.lock` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ dependencies = [
 
 [[package]]
 name = "agent_control_specification_core"
-version = "0.3.1-beta.0"
+version = "0.3.2-beta.0"
 dependencies = [
  "agent-control-spec",
  "jsonschema",
```

**File**: `policy-engine/sdk/rust/Cargo.toml` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ crate-type = ["lib", "cdylib"]
 agent-control-spec = { version = "=0.4.0-alpha.3", default-features = false, features = ["opa", "cedar", "default-dispatchers"] }
 agent-hooks-sdk = "=0.1.0-alpha.5"
 # Carries the AGT-only artifact validation the C ABI exposes.
-agent_control_specification_core = { version = "=0.3.1-beta.0", path = "../../core", default-features = false }
+agent_control_specification_core = { version = "=0.3.2-beta.0", path = "../../core", default-features = false }
 serde = { version = "1", features = ["derive"] }
 serde_json = "1"
 sha2 = "=0.10.9"
```

---

### Incident Patch 8: `ebf25a9e` (2026-10-02)
**Commit Message**: fix(agent-sre): return in-memory measurements in timestamp order (#4209)

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agent-sre/src/agent_sre/slo/persistence.py` (modified, +4/-1)
```diff
@@ -78,7 +78,10 @@ def append(self, name: str, value: float, timestamp: float, metadata: dict[str,
     def query(self, name: str, since: float) -> list[_Row]:
         """Return rows for *name* with timestamp >= *since* (thread-safe)."""
         with self._lock:
-            return [r for r in self._rows if r.name == name and r.timestamp >= since]
+            return sorted(
+                (r for r in self._rows if r.name == name and r.timestamp >= since),
+                key=lambda r: r.timestamp,
+            )
 
     def clear(self, name: str | None = None) -> None:
         """Delete measurements (thread-safe). Pass *name* to delete one SLI only."""
```

**File**: `agent-governance-python/agent-sre/tests/unit/test_sli_persistence.py` (modified, +14/-0)
```diff
@@ -28,6 +28,20 @@
 
 
 class TestInMemoryMeasurementStore:
+    def test_out_of_order_measurements_match_sqlite(self) -> None:
+        memory = InMemoryMeasurementStore()
+        sqlite = SQLiteMeasurementStore(":memory:")
+        for store in (memory, sqlite):
+            store.append("sli", 0.3, 300, {})
+            store.append("other", 0.9, 250, {})
+            store.append("sli", 0.1, 100, {})
+            store.append("sli", 0.2, 200, {})
+
+        assert [r.value for r in memory.query("sli", 200)] == [0.2, 0.3]
+        assert [r.value for r in memory.query("sli", 200)] == [
+            r.value for r in sqlite.query("sli", 200)
+        ]
+
     def test_append_and_query(self) -> None:
         store = InMemoryMeasurementStore()
         t = time.time()
```

---

### Incident Patch 9: `180ff5fe` (2026-10-02)
**Commit Message**: fix(agent-sre): calculate latency from windowed measurements (#4207)

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agent-sre/src/agent_sre/slo/indicators.py` (modified, +4/-5)
```diff
@@ -194,18 +194,17 @@ def __init__(
     ) -> None:
         super().__init__(f"response_latency_p{int(percentile * 100)}", target_ms, window, store=store)
         self.percentile = percentile
-        self._latencies: list[float] = []
 
     def record_latency(self, latency_ms: float, metadata: dict[str, Any] | None = None) -> SLIValue:
         """Record a response latency in milliseconds."""
-        self._latencies.append(latency_ms)
         return self.record(latency_ms, metadata)
 
     def current_value(self) -> float | None:
-        """Get the percentile latency value."""
-        if not self._latencies:
+        """Get the percentile latency within the configured measurement window."""
+        values = self.values_in_window()
+        if not values:
             return None
-        sorted_vals = sorted(self._latencies)
+        sorted_vals = sorted(v.value for v in values)
         idx = int(len(sorted_vals) * self.percentile)
         idx = min(idx, len(sorted_vals) - 1)
         return sorted_vals[idx]
```

**File**: `agent-governance-python/agent-sre/tests/unit/test_indicators.py` (modified, +26/-1)
```diff
@@ -2,7 +2,7 @@
 # Licensed under the MIT License.
 """Tests for the SLI collector framework."""
 
-
+from unittest.mock import patch
 
 from agent_sre.slo.indicators import (
     SLI,
@@ -16,6 +16,7 @@
     TimeWindow,
     ToolCallAccuracy,
 )
+from agent_sre.slo.persistence import SQLiteMeasurementStore
 
 
 class TestTimeWindow:
@@ -105,6 +106,30 @@ def test_recording(self) -> None:
 
 
 class TestResponseLatency:
+    def test_percentile_excludes_expired_measurements(self) -> None:
+        sli = ResponseLatency(window="1h")
+        with patch("agent_sre.slo.indicators.time.time", return_value=1000):
+            sli.record_latency(10000)
+        with patch("agent_sre.slo.indicators.time.time", return_value=4601):
+            sli.record_latency(200)
+            assert sli.current_value() == 200
+
+    def test_percentile_is_none_after_window_expires(self) -> None:
+        sli = ResponseLatency(window="1h")
+        with patch("agent_sre.slo.indicators.time.time", return_value=1000):
+            sli.record_latency(200)
+        with patch("agent_sre.slo.indicators.time.time", return_value=4601):
+            assert sli.current_value() is None
+
+    def test_percentile_restored_from_persistent_store(self, tmp_path) -> None:
+        db_path = tmp_path / "latency.db"
+        sli = ResponseLatency(store=SQLiteMeasurementStore(db_path))
+        for ms in [100, 200, 300]:
+            sli.record_latency(ms)
+
+        restored = ResponseLatency(store=SQLiteMeasurementStore(db_path))
+        assert restored.current_value() == 300
+
     def test_percentile(self) -> None:
         sli = ResponseLatency(target_ms=5000, percentile=0.95)
         for ms in [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
```

---

### Incident Patch 10: `a3ad6db4` (2026-10-02)
**Commit Message**: fix(agent-sre): measure benchmark duration with a monotonic clock (#4206)

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agent-sre/src/agent_sre/benchmarks/__init__.py` (modified, +3/-3)
```diff
@@ -316,11 +316,11 @@ def _run_scenario(
         scenario: BenchmarkScenario,
     ) -> ScenarioRun:
         """Run a single scenario."""
-        start = time.time()
+        start = time.perf_counter()
         try:
             raw_result = agent_fn(scenario.input_data)
 
-            elapsed_ms = (time.time() - start) * 1000
+            elapsed_ms = (time.perf_counter() - start) * 1000
 
             # Parse agent response
             if isinstance(raw_result, dict):
@@ -367,7 +367,7 @@ def _run_scenario(
             )
 
         except Exception as exc:
-            elapsed_ms = (time.time() - start) * 1000
+            elapsed_ms = (time.perf_counter() - start) * 1000
             return ScenarioRun(
                 scenario_name=scenario.name,
                 category=scenario.category,
```

**File**: `agent-governance-python/agent-sre/tests/test_benchmarks.py` (modified, +21/-0)
```diff
@@ -5,6 +5,9 @@
 from __future__ import annotations
 
 import time
+from unittest.mock import patch
+
+import pytest
 
 from agent_sre.benchmarks import (
     BenchmarkCategory,
@@ -136,6 +139,24 @@ def test_add_scenario(self):
 # ---------------------------------------------------------------------------
 
 class TestRunnerGoodAgent:
+    @pytest.mark.parametrize(
+        "agent_fn, expected_result",
+        [(good_agent, ScenarioResult.FAILED), (error_agent, ScenarioResult.ERROR)],
+    )
+    def test_elapsed_time_does_not_depend_on_wall_clock(self, agent_fn, expected_result):
+        suite = BenchmarkSuite(name="clock-test")
+        suite.add(BenchmarkScenario(
+            name="test", category=BenchmarkCategory.LATENCY, timeout_seconds=0.1
+        ))
+        with (
+            patch("agent_sre.benchmarks.time.time", return_value=1000),
+            patch("agent_sre.benchmarks.time.perf_counter", side_effect=[1, 1.125]),
+        ):
+            report = BenchmarkRunner(suite).run(agent_fn)
+
+        assert report.runs[0].latency_ms == 125
+        assert report.runs[0].result == expected_result
+
     def test_run_all(self):
         suite = BenchmarkSuite.default()
         runner = BenchmarkRunner(suite)
```

---

### Incident Patch 11: `88a361ad` (2026-10-02)
**Commit Message**: fix(migrate): report governance file read failures (#4205)

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agt-policies/src/agt/cli/_migrate_resolution/build.py` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ def _load_yaml(path: Path) -> dict[str, Any]:
         raise ResolutionError.invalid_governance(
             f"failed to parse {path}: {exc}"
         ) from exc
+    except (OSError, UnicodeDecodeError) as exc:
+        raise ResolutionError.invalid_governance(
+            f"failed to read governance file {path} ({type(exc).__name__})"
+        ) from exc
     if data is None:
         return {}
     if not isinstance(data, dict):
```

**File**: `agent-governance-python/agt-policies/tests/test_migrate_resolution.py` (modified, +34/-0)
```diff
@@ -38,6 +38,40 @@
 # ── discover_policies ────────────────────────────────────────────────
 
 
+@pytest.mark.parametrize("error_type", [PermissionError, FileNotFoundError])
+def test_resolve_reports_governance_read_errors(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, error_type: type[OSError]
+) -> None:
+    governance = tmp_path / "governance.yaml"
+    governance.write_text("rules: []\n", encoding="utf-8")
+    original_open = Path.open
+
+    def fail_governance_read(path, *args, **kwargs):
+        if path == governance:
+            raise error_type("cannot read governance file")
+        return original_open(path, *args, **kwargs)
+
+    monkeypatch.setattr(Path, "open", fail_governance_read)
+    bundle = tmp_path / "bundle"
+    with pytest.raises(ResolutionError) as exc:
+        resolve_manifest(tmp_path, tmp_path, bundle_dir=bundle)
+
+    assert exc.value.reason == ResolutionReason.INVALID_GOVERNANCE
+    assert isinstance(exc.value.__cause__, error_type)
+    assert not bundle.exists()
+
+
+def test_resolve_reports_invalid_utf8_governance(tmp_path: Path) -> None:
+    (tmp_path / "governance.yaml").write_bytes(b"rules: []\n# \xff\n")
+    bundle = tmp_path / "bundle"
+    with pytest.raises(ResolutionError) as exc:
+        resolve_manifest(tmp_path, tmp_path, bundle_dir=bundle)
+
+    assert exc.value.reason == ResolutionReason.INVALID_GOVERNANCE
+    assert isinstance(exc.value.__cause__, UnicodeDecodeError)
+    assert not bundle.exists()
+
+
 def test_discover_returns_root_first_order(tmp_path: Path) -> None:
     root = tmp_path
     deep = root / "a" / "b" / "c"
```

---

### Incident Patch 12: `98fee399` (2026-10-02)
**Commit Message**: docs(opencode): fix workspace plugin installation and hook guidance (#4203)

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-opencode/README.md` (modified, +54/-10)
```diff
@@ -47,13 +47,15 @@ governance tools from external workflows.
 
 This initial package enforces:
 
-- `session.start`           — injects AGT governance context into the session
+- `session.created`         — best-effort status logging; no context injection
 - `event` (chat-style)      — scans submitted prompts; throws to block
 - `tool.execute.before`     — allow / review / deny tool calls
 - `tool.execute.after`      — scans tool output and redacts known secret
                               patterns (AWS, GitHub PAT, OpenAI, JWT, PEM
                               private keys, Azure storage keys)
-- `tool.execute.error`      — records audit entry for failed tool calls
+
+There is no failed-tool hook in this plugin. A failed call that never reaches
+`tool.execute.after` does not receive an output audit entry.
 
 It also exposes two custom tools (in-process **and** via the stdio MCP server):
 
@@ -81,16 +83,22 @@ npm run check
 OpenCode loads plugins from:
 
 1. `opencode.json` `plugin` entries (npm specifiers)
-2. `~/.config/opencode/plugins/*.{ts,js,mjs}` (user-global)
-3. `.opencode/plugins/*.{ts,js,mjs}` (workspace-local)
+2. `~/.config/opencode/{plugin,plugins}/*.{ts,js}` (user-global)
+3. `.opencode/{plugin,plugins}/*.{ts,js}` (workspace-local)
+
+Use Option A for a normal installation. Workspace files must use `.js` or `.ts`;
+OpenCode does not auto-discover `.mjs` plugin files. The package's internal
+`.mjs` entry point is loaded through its npm export instead.
 
 Configure AGT through **one** of these plugin-loading paths for a workspace. Do
 not keep duplicate AGT shims or load the package both from `opencode.json` and a
 workspace plugin file. Duplicate registrations for the same OpenCode client and
 workspace are suppressed and emit a warning, but removing the duplicate source
 keeps startup configuration unambiguous.
 
-### Option A — workspace `opencode.json`
+### Option A — workspace `opencode.json` (recommended)
+
+OpenCode installs the configured npm package and its dependencies at startup.
 
 ```json
 {
@@ -99,15 +107,51 @@ keeps startup configuration unambiguous.
 }
 ```
 
-### Option B — workspace plugin file (no install required)
+### Option B — workspace plugin file with an installed package
+
+From your project root, install the package into the OpenCode config directory:
+
+```powershell
+npm install --prefix .opencode @microsoft/agent-governance-opencode
+```
 
-Create `.opencode/plugins/agt.mjs`:
+Create `.opencode/plugins/agt.js` (the singular `.opencode/plugin/` directory
+also works):
 
 ```js
-export { default } from "../../agent-governance-opencode/src/index.mjs";
+export { default } from "@microsoft/agent-governance-opencode";
 ```
 
-### Option C — install the bundled MCP server
+This imports the installed package from `.opencode/node_modules`; it does not
+require an AGT repository checkout or a copied source directory.
+
+### Verify plugin discovery
+
+From the same project root, run this command without invoking a model:
+
+```powershell
+opencode debug config
+```
+
+Inspect the resolved `plugin` array. Option A should include the AGT npm
+specifier; Option B should include a file URL ending in `/agt.js`. If neither
+appears, stop and correct the configuration before using the agent.
+
+Discovery alone does not prove that the module imports, initializes, or runs
+its governance hooks. A broken re-export can still appear in this list. Review
+startup errors and check the loaded plugin's `agt_policy_status` before use;
+policy validity and plugin discovery are separate checks. Out-of-band runtime
+activation evidence is tracked in issue #3708.
+
+### Optional MCP server installation
+
+The MCP server exposes inspection tools. Configuring it alone does not install
+the in-process governance hooks from Option A or B. Install the package in your
+project before using this path:
+
+```powershell
+npm install @microsoft/agent-governance-opencode
+```
 
 In `opencode.json`:
 
@@ -364,4 +408,4 @@ if a latch needs to outlive it.
   redacted value.
 - AGT fails **closed** by default. If the policy file is corrupt or evaluation
   throws, requests are denied. Set `denyOnPolicyError: false` in policy to opt
-  into advisory mode.
\ No newline at end of file
+  into advisory mode.
```

**File**: `agent-governance-opencode/test/installation-docs.test.mjs` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+// Copyright (c) Microsoft Corporation.
+// Licensed under the MIT License.
+
+import assert from "node:assert/strict";
+import { readFile } from "node:fs/promises";
+import test from "node:test";
+
+import AgtGovernance from "../src/index.mjs";
+
+for (const path of ["../README.md", "../../docs/packages/opencode-governance.md"]) {
+  test(`${path} documents a discoverable shim using the package export`, async () => {
+    const doc = await readFile(new URL(path, import.meta.url), "utf8");
+    const shim = doc.match(/\.opencode\/plugins\/agt\.(\w+)/);
+    assert.ok(shim, "document the workspace shim path");
+    assert.ok(["js", "ts"].includes(shim[1]), "OpenCode discovers JS/TS shims");
+    assert.doesNotMatch(doc, /\*\.\{[^}]*mjs[^}]*\}/);
+
+    const reexport = doc.match(/export \{ default \} from "([^"]+)";/);
+    assert.ok(reexport, "document the workspace shim's import");
+    assert.equal(reexport[1], "@microsoft/agent-governance-opencode");
+    assert.equal((await import(reexport[1])).default, AgtGovernance);
+    assert.match(doc, /opencode debug config/);
+    assert.doesNotMatch(doc, /`session\.start`|`tool\.execute\.error`/);
+  });
+}
```

**File**: `docs/packages/opencode-governance.md` (modified, +34/-10)
```diff
@@ -1,5 +1,5 @@
 ---
-last_reviewed: 2026-05-29
+last_reviewed: 2026-10-02
 owner: agt-maintainers
 title: OpenCode CLI governance package
 description: AGT in-process plugin for the OpenCode CLI — enforce policy on prompts, tools, and tool output.
@@ -30,23 +30,22 @@ That model lets this package:
 
 | OpenCode hook | AGT behavior |
 |---|---|
-| `session.start` | Injects governance context describing the active policy and mode. |
+| `session.created` | Attempts to log policy status; does not inject governance context. |
 | `event` (chat-style) | Scans the submitted prompt with the AGT prompt-defense backend. Throws on `deny`. |
 | `tool.execute.before` | Runs `evaluateOpenCodeTool`. Throws on `deny`; marks args on `review`. |
-| `tool.execute.after` | Scans tool output for AWS keys, GitHub PATs, OpenAI keys, Azure storage keys, JWTs, and PEM private keys. Redacts in enforce mode. |
-| `tool.execute.error` | Records an audit entry without re-running policy. |
+| `tool.execute.after` | Scans tool output for AWS keys, GitHub PATs, OpenAI keys, Azure storage keys, JWTs, and PEM private keys. Redacts in enforce and advisory modes. |
+
+A failed call that does not reach `tool.execute.after` has no output audit
+entry. The plugin does not register a failed-tool hook.
 
 It also publishes a stdio MCP server (`server/agt-mcp.mjs`) for operators who
 want to invoke `agt_policy_status` or `agt_policy_check_text` from external
 workflows.
 
 ## Install
 
-```powershell
-npm install @microsoft/agent-governance-opencode
-```
-
-Then add the plugin to your project's `opencode.json`:
+Add the plugin to your project's `opencode.json`. OpenCode installs the npm
+package and its dependencies at startup:
 
 ```json
 {
@@ -55,6 +54,31 @@ Then add the plugin to your project's `opencode.json`:
 }
 ```
 
+Alternatively, install the package with
+`npm install --prefix .opencode @microsoft/agent-governance-opencode` and create
+`.opencode/plugins/agt.js`:
+
+```js
+export { default } from "@microsoft/agent-governance-opencode";
+```
+
+OpenCode discovers `.js` and `.ts` files in either `.opencode/plugin/` or
+`.opencode/plugins/`; it does not auto-discover `.mjs` shims. The import above
+uses `.opencode/node_modules`, so no AGT source checkout is required. Choose one
+installation method to avoid duplicate registrations.
+
+Run `opencode debug config` from the project root and inspect the resolved
+`plugin` array for the npm specifier or the `/agt.js` file URL. This preflight
+does not invoke a model. An absent entry means the plugin was not discovered.
+An entry only proves discovery, not successful import, initialization, or hook
+execution. Inspect startup errors and the loaded plugin's `agt_policy_status`
+as separate checks. Out-of-band activation evidence is tracked in issue #3708.
+
+The optional MCP server provides inspection tools only; it does not activate
+the in-process governance hooks. See the
+[package README](../../agent-governance-opencode/README.md#optional-mcp-server-installation)
+for its separate installation instructions.
+
 ## Configuration
 
 The plugin loads policy from (first match wins):
@@ -64,7 +88,7 @@ The plugin loads policy from (first match wins):
 3. `~/.config/opencode/agt/policy.json`
 4. The bundled `config/default-policy.json` (enforce, fail-closed)
 
-Audit log defaults to `~/.config/opencode/agt/audit.json`; override via
+Audit log defaults to `~/.config/opencode/agt/audit-log.json`; override via
 `AGT_OPENCODE_AUDIT_PATH`.
 
 A minimal review-heavy policy:
```

---

### Incident Patch 13: `d9a526d4` (2026-10-02)
**Commit Message**: fix(agent-sre): prefer higher quality at equal Pareto cost (#4211)

Signed-off-by: Naveen Chatlapalli <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agent-sre/src/agent_sre/cost/optimizer.py` (modified, +4/-4)
```diff
@@ -109,8 +109,8 @@ def recommend(
     def pareto_frontier(self, task: TaskProfile) -> list[CostEstimate]:
         """Compute the Pareto-optimal set of models for a task.
 
-        A model is Pareto-optimal if no other model is both cheaper
-        AND higher quality while meeting the task constraints.
+        A model is Pareto-optimal if no other feasible model costs no more
+        and has no lower quality, with at least one strict improvement.
 
         Args:
             task: Task profile specifying quality and latency constraints.
@@ -131,8 +131,8 @@ def pareto_frontier(self, task: TaskProfile) -> list[CostEstimate]:
         if not feasible:
             return []
 
-        # Sort by cost ascending
-        feasible.sort(key=lambda e: e.estimated_cost)
+        # At equal cost, consider the highest quality first.
+        feasible.sort(key=lambda e: (e.estimated_cost, -e.estimated_quality))
 
         # Build Pareto frontier: walk cost-sorted list, keep only those
         # that improve quality over the best quality seen so far.
```

**File**: `agent-governance-python/agent-sre/tests/test_cost_optimizer.py` (modified, +9/-0)
```diff
@@ -163,6 +163,15 @@ def test_savings_calculation(
 
 
 class TestParetoFrontier:
+    @pytest.mark.parametrize("better_first", [False, True])
+    def test_equal_cost_keeps_only_higher_quality(
+        self, summarization_task: TaskProfile, better_first: bool
+    ) -> None:
+        better = CHEAP_MODEL.model_copy(update={"name": "better", "quality_score": 0.9})
+        models = [better, CHEAP_MODEL] if better_first else [CHEAP_MODEL, better]
+        frontier = CostOptimizer(models).pareto_frontier(summarization_task)
+        assert [estimate.model_name for estimate in frontier] == ["better"]
+
     def test_no_dominated_models(
         self, optimizer: CostOptimizer, summarization_task: TaskProfile
     ) -> None:
```

---

### Incident Patch 14: `efe9ee83` (2026-10-02)
**Commit Message**: fix: restore recursive-delete enforcement in CLI plugins (#4202)

* fix: restore recursive-delete enforcement in CLI plugins

Signed-off-by: Raunak Bhagate <[REDACTED_EMAIL]>

* fix: preserve enclosing shell commands across substitutions

Signed-off-by: Raunak Bhagate <[REDACTED_EMAIL]>

* test: cover contributor deletion and quoted-text cases

Signed-off-by: Raunak Bhagate <[REDACTED_EMAIL]>

---------

Signed-off-by: Raunak Bhagate <[REDACTED_EMAIL]>

**File**: `agent-governance-claude-code/README.md` (modified, +38/-0)
```diff
@@ -44,6 +44,44 @@ including when a message arrives across multiple reads.
 - `PostToolUse` in Claude cannot reliably redact tool output after the tool has already executed, so this package does not claim Copilot-style output suppression parity.
 - Hook execution is out-of-process. The package keeps enforcement in command hooks so policy errors can fail closed.
 
+## Recursive-delete protection for Bash
+
+<!-- cspell:ignore talosrobotics -->
+The bundled `recursive-delete` rule uses a quote-aware command tokenizer and
+flag parser adapted from the OpenCode implementation and shell-comment handling
+in PRs #4129 and #4142 by Ricky-G (MIT). PR #3834 by talosrobotics was the
+earlier Claude Code regex fix for this rule.
+It denies `rm` invocations with both recursive and force flags, including `-rf`,
+`-fr`, `-r -f`, `--recursive --force`, quoted flags, and common wrappers such as
+`sudo`, `env`, `command`, and `timeout`. It respects command boundaries, comments,
+and the `--` end-of-options marker. Substitutions are scanned independently while
+preserving the enclosing command and word, so `rm -r "$(pwd)/src" -f` is denied. Substitution output remains
+unknown rather than being evaluated. Literal text such as `echo $(pwd) rm -rf src`
+or `echo "rm -rf src"` does not trigger this rule. Redirection operators and their filenames are separated
+from command arguments, so a filename such as `-rf` is not treated as a deletion
+flag. Lookup, help, and list modes such as `command -v` do not count as execution.
+
+The cleanup exception applies only to a single command whose targets are all
+recognized relative build artifacts, such as `node_modules` or `dist`. Mixed
+safe/unsafe targets, wildcard or variable targets, redirections, and incomplete
+shell syntax do not qualify. For example, `rm -rf node_modules src/*` is denied.
+Exempt commands still pass through the rest of the policy, including Bash review.
+
+The built-in matcher applies to rules with `id: "recursive-delete"` and a Bash
+tool name, using the configured rule effect. Bundled Bash rules have
+`commandPatterns: []`; explicit user patterns continue to run alongside the
+built-in matcher. Existing policies containing the old regex gain the parser's
+coverage, but their explicit regex can still produce false positives. Remove
+that obsolete pattern from the Bash rule to use only the built-in matcher.
+
+This is a bounded tokenizer, not a full shell evaluator. It does not resolve
+brace or variable expansions, shell strings passed to `eval` or `sh -c`, indirect
+deletion through `find` or `xargs`, remote/container execution, or every wrapper.
+Escaped nested backticks are not fully supported, and command text inside a
+heredoc can conservatively trigger a denial. Recursive deletion without force
+(for example, `rm -r src`) remains subject to the rest of the configured policy.
+Keep Bash review enabled for forms outside this matcher's coverage.
+
 ## Local development
 
 Run these commands from the **repository root** so the relative plugin path resolves correctly.
```

**File**: `agent-governance-claude-code/config/default-policy.json` (modified, +1/-6)
```diff
@@ -36,12 +36,7 @@
       "tool": "Bash",
       "reason": "Recursive delete commands outside common build artifacts are blocked by AGT policy.",
       "effect": "deny",
-      "commandPatterns": [
-        {
-          "source": "\\brm\\b[\\s\\S]*\\b-rf\\b",
-          "flags": "i"
-        }
-      ]
+      "commandPatterns": []
     },
     {
       "id": "dangerous-bootstrap",
```

**File**: `agent-governance-claude-code/lib/policy.mjs` (modified, +12/-3)
```diff
@@ -17,6 +17,7 @@ import {
 
 import { appendAuditEntry, getAuditStatus } from "./audit.mjs";
 import { safeJsonStringify, summarizeText } from "./poisoning.mjs";
+import { isSafeShellCleanupCommand, matchesRecursiveDeleteCommand } from "./recursive-delete.mjs";
 
 export const USER_POLICY_ENV = "AGT_CLAUDE_POLICY_PATH";
 export const AUDIT_PATH_ENV = "AGT_CLAUDE_AUDIT_PATH";
@@ -398,8 +399,12 @@ function createCommandPatternBackend(policy) {
           continue;
         }
 
+        const recursiveDeleteMatched =
+          rule.id === "recursive-delete" &&
+          rule.tool.toLowerCase() === "bash" &&
+          matchesRecursiveDeleteCommand(commandText);
         const matchedPattern = rule.commandPatterns.find((pattern) => pattern.regex.test(commandText));
-        if (!matchedPattern) {
+        if (!recursiveDeleteMatched && !matchedPattern) {
           continue;
         }
         if (shouldBypassBlockedCommandRule(rule, commandText)) {
@@ -409,7 +414,9 @@ function createCommandPatternBackend(policy) {
         return {
           backend: "agt-command-patterns",
           decision: rule.effect,
-          reason: `${rule.reason} Matched /${matchedPattern.source}/${matchedPattern.flags}.`,
+          reason: recursiveDeleteMatched
+            ? `${rule.reason} Matched recursive-delete command.`
+            : `${rule.reason} Matched /${matchedPattern.source}/${matchedPattern.flags}.`,
         };
       }
 
@@ -878,7 +885,9 @@ function createMinimalFallbackPolicy() {
 
 function shouldBypassBlockedCommandRule(rule, commandText) {
   if (rule.id === "recursive-delete") {
-    return isSafeCleanupCommand(commandText);
+    return rule.tool.toLowerCase() === "bash"
+      ? isSafeShellCleanupCommand(commandText)
+      : isSafeCleanupCommand(commandText);
   }
   if (rule.id === "secret-read") {
     return isSafeEnvTemplateReadCommand(commandText);
```

**File**: `agent-governance-claude-code/lib/recursive-delete.mjs` (added, +558/-0)
```diff
@@ -0,0 +1,558 @@
+// Copyright (c) Microsoft Corporation.
+// Licensed under the MIT License.
+
+// cspell:ignore talosrobotics
+// Parser and shell-comment handling adapted from AGT PRs #4129 and #4142
+// by Ricky-G (MIT). Earlier Claude Code rule fix: PR #3834 by talosrobotics.
+// This is a bounded shell tokenizer, not a shell evaluator. Keep both packaged
+// copies in sync; neither package can import runtime files from its sibling.
+// A substitution contributes an unknown fragment to its enclosing shell word.
+// NUL cannot occur in a shell argument; it keeps dynamic names/options opaque.
+const DYNAMIC_WORD_FRAGMENT = "\0";
+
+const SAFE_CLEANUP_TARGETS = new Set([
+  "node_modules", "dist", "build", ".next", "target", "__pycache__",
+  ".pytest_cache", ".venv", "venv", "coverage", ".turbo", "out",
+]);
+
+export function matchesRecursiveDeleteCommand(commandText) {
+  const { commands } = tokenizeShellCommands(commandText);
+  return commands.some((tokens) => {
+    const invocation = getShellCommandInvocation(tokens);
+    if (invocation?.name !== "rm") {
+      return false;
+    }
+
+    let recursive = false;
+    let force = false;
+    let optionsEnded = false;
+    for (const token of invocation.args) {
+      if (optionsEnded) {
+        continue;
+      }
+      if (token === "--") {
+        optionsEnded = true;
+        continue;
+      }
+
+      const option = parseRmOption(token);
+      if (option) {
+        recursive ||= option.recursive;
+        force ||= option.force;
+      }
+    }
+
+    return recursive && force;
+  });
+}
+
+export function isSafeShellCleanupCommand(commandText) {
+  const parsedCommand = tokenizeShellCommands(commandText);
+  if (
+    parsedCommand.hasControlOperator ||
+    parsedCommand.hasUnterminatedSyntax ||
+    parsedCommand.hasRedirection ||
+    parsedCommand.commands.length !== 1
+  ) {
+    return false;
+  }
+
+  const invocation = getShellCommandInvocation(parsedCommand.commands[0]);
+  if (invocation?.name !== "rm") {
+    return false;
+  }
+
+  const candidateTargets = [];
+  let optionsEnded = false;
+  for (const token of invocation.args) {
+    if (!token) {
+      return false;
+    }
+    if (optionsEnded) {
+      if (!addSafeCleanupTargets(candidateTargets, token)) {
+        return false;
+      }
+      continue;
+    }
+    if (token === "--") {
+      optionsEnded = true;
+      continue;
+    }
+    if (token.startsWith("-")) {
+      const option = parseRmOption(token);
+      if (!option?.recognized) {
+        return false;
+      }
+      continue;
+    }
+    if (!addSafeCleanupTargets(candidateTargets, token)) {
+      return false;
+    }
+  }
+
+  return candidateTargets.length > 0 && candidateTargets.every(isSafeCleanupTarget);
+}
+
+function getShellCommandInvocation(tokens) {
+  let index = 0;
+  while (index < tokens.length) {
+    const token = tokens[index];
+    // Assignment values may be dynamic; an executable name may not be inferred.
+    if (token.includes(DYNAMIC_WORD_FRAGMENT) && !/^[a-z_][a-z0-9_]*=/i.test(token)) {
+      return undefined;
+    }
+    const commandName = getLastPathSegment(token.replace(/\\/g, "/")).toLowerCase();
+    if (
+      ["if", "then", "do", "else", "elif", "while", "until", "in"].includes(commandName) ||
+      /^[a-z_][a-z0-9_]*=/i.test(token)
+    ) {
+      index += 1;
+      continue;
+    }
+
+    if (commandName === "exec") {
+      index += 1;
+      while (tokens[index]?.startsWith("-")) {
+        const option = tokens[index];
+        index += option === "-a" ? 2 : 1;
+      }
+      continue;
+    }
+
+    if (["command", "nohup", "busybox"].includes(commandName)) {
+      index += 1;
+      while (tokens[index]?.startsWith("-")) {
+        const option = tokens[index++];
+        if (option === "--") {
+          break;
+        }
+        // Lookup/help modes do not execute the following command.
+        if (
+          (commandName === "command" && /^-[^-]*[vV]/.test(option)) ||
+          ["--help", "--version", "--list", "--list-full"].includes(option)
+        ) {
+          return undefined;
+        }
+      }
+      continue;
+    }
+
+    if (["nice", "time", "timeout"].includes(commandName)) {
+      index += 1;
+      const optionsWithArguments = {
+        nice: new Set(["-n", "--adjustment"]),
+        time: new Set(["-f", "--format", "-o", "--output"]),
+        timeout: new Set(["-k", "--kill-after", "-s", "--signal"]),
+      }[commandName];
+      while (tokens[index]?.startsWith("-")) {
+        const option = tokens[index];
+        index += 1;
+        if (option === "--") {
+          break;
+        }
+        if (optionsWithArguments.has(option)) {
+          index += 1;
+        }
+      }
+      if (commandName === "timeout" && index < tokens.length) {
+        index += 1;
+      }
+      continue;
+    }
+
+    if (commandName === "env") {
+      index += 1;
+      while (index < tokens.length) {
+        const argument = tokens[index];

```

**File**: `agent-governance-claude-code/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
   ],
   "scripts": {
     "build": "npm run check",
-    "check": "node --check ./hooks/common.mjs && node --check ./hooks/session-start.mjs && node --check ./hooks/user-prompt-submit.mjs && node --check ./hooks/pre-tool-use.mjs && node --check ./lib/audit.mjs && node --check ./lib/poisoning.mjs && node --check ./lib/policy.mjs && node --check ./server/agt-mcp.mjs && node --test ./test/*.test.mjs",
+    "check": "node --check ./hooks/common.mjs && node --check ./hooks/session-start.mjs && node --check ./hooks/user-prompt-submit.mjs && node --check ./hooks/pre-tool-use.mjs && node --check ./lib/audit.mjs && node --check ./lib/poisoning.mjs && node --check ./lib/policy.mjs && node --check ./lib/recursive-delete.mjs && node --check ./server/agt-mcp.mjs && node --test ./test/*.test.mjs",
     "test": "node --test ./test/*.test.mjs"
   },
   "keywords": [
```

**File**: `agent-governance-claude-code/test/hooks.test.mjs` (modified, +55/-1)
```diff
@@ -2,7 +2,7 @@
 // Licensed under the MIT License.
 
 import assert from "node:assert/strict";
-import { mkdtemp, readFile, rm } from "node:fs/promises";
+import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import { spawn } from "node:child_process";
@@ -76,6 +76,60 @@ test("user-prompt-submit hook blocks suspicious prompts", async () => {
   await rm(root, { recursive: true, force: true });
 });
 
+
+test("pre-tool-use hook denies recursive deletion without blocking literal text", async (t) => {
+  const root = await mkdtemp(join(tmpdir(), "agt-claude-delete-hook-"));
+  t.after(() => rm(root, { recursive: true, force: true }));
+  const scriptPath = fileURLToPath(new URL("../hooks/pre-tool-use.mjs", import.meta.url));
+  const policyPath = fileURLToPath(new URL("../config/default-policy.json", import.meta.url));
+  for (const [command, expected] of [
+    ["rm -r -f src", "deny"],
+    ["rm -rf node_modules src/*", "deny"],
+    ['echo "rm -rf src"', "ask"],
+    ["rm -rf node_modules", "ask"],
+  ]) {
+    const output = await runNodeHook(scriptPath, {
+      cwd: root, hook_event_name: "PreToolUse", session_id: "recursive-delete-hook",
+      tool_name: "Bash", tool_input: { command },
+    }, { AGT_CLAUDE_POLICY_PATH: policyPath, AGT_CLAUDE_AUDIT_PATH: join(root, "audit.json") });
+    assert.equal(output.code, 0, output.stderr);
+    const decision = JSON.parse(output.stdout).hookSpecificOutput;
+    assert.equal(decision.permissionDecision, expected, command);
+    if (expected === "deny") assert.match(decision.permissionDecisionReason, /Recursive delete commands/, command);
+  }
+});
+
+
+test("hook retains the enclosing command across substitutions with either fallback", async (t) => {
+  const root = await mkdtemp(join(tmpdir(), "agt-claude-substitution-hook-"));
+  t.after(() => rm(root, { recursive: true, force: true }));
+  const scriptPath = fileURLToPath(new URL("../hooks/pre-tool-use.mjs", import.meta.url));
+  const bundledPath = fileURLToPath(new URL("../config/default-policy.json", import.meta.url));
+  const policy = JSON.parse(await readFile(bundledPath, "utf8"));
+  policy.toolPolicies.reviewTools = [];
+  policy.toolPolicies.defaultEffect = "allow";
+  const allowPath = join(root, "allow.json");
+  await writeFile(allowPath, JSON.stringify(policy));
+  for (const policyPath of [bundledPath, allowPath]) {
+    for (const [command, blocked] of [
+      ['rm -r "$(pwd)/src" -f', true],
+      ['rm -r "`pwd`/src" -f', true],
+      ['echo "$(rm -rf src)"', true],
+      ["echo $(pwd) rm -rf src", false],
+      ["echo `pwd` rm -rf src", false],
+    ]) {
+      const output = await runNodeHook(scriptPath, {
+        cwd: root, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command },
+      }, { AGT_CLAUDE_POLICY_PATH: policyPath, AGT_CLAUDE_AUDIT_PATH: join(root, "audit.json") });
+      assert.equal(output.code, 0, output.stderr);
+      const result = JSON.parse(output.stdout).hookSpecificOutput;
+      assert.equal(result.permissionDecision, blocked ? "deny" : policyPath === bundledPath ? "ask" : undefined, command);
+      if (blocked) assert.match(result.permissionDecisionReason, /Recursive delete commands/, command);
+      else assert.doesNotMatch(result.permissionDecisionReason ?? "", /Recursive delete commands/, command);
+    }
+  }
+});
+
 function runNodeHook(scriptPath, input, extraEnv) {
   return new Promise((resolvePromise, reject) => {
     const child = spawn("node", [scriptPath], {
```

**File**: `agent-governance-claude-code/test/policy.test.mjs` (modified, +268/-0)
```diff
@@ -6,6 +6,7 @@ import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import test from "node:test";
+import { isSafeShellCleanupCommand, matchesRecursiveDeleteCommand } from "../lib/recursive-delete.mjs";
 
 import {
   checkArbitraryText,
@@ -112,6 +113,7 @@ test("evaluatePreToolUse denies Windows-style secret reads", async () => {
 });
 
 test("evaluatePreToolUse denies direct URL metadata access regardless of parameter key name", async () => {
+  // cspell:ignore denypath
   const root = await mkdtemp(join(tmpdir(), "agt-claude-url-denypath-"));
   const auditPath = join(root, "audit.json");
   const state = await loadPolicy({ auditPath });
@@ -199,3 +201,269 @@ test("bundled policy load failures block prompt submission in enforce mode", asy
 
   await rm(root, { recursive: true, force: true });
 });
+
+// Cases and expected behavior supplied by the contributor; encoded with AI assistance.
+const CONTRIBUTOR_DELETE_COMMANDS = [
+  'rm --recursive "$(pwd)/src" -f',
+  'echo "$(rm -r "$(pwd)/src" -f)"',
+];
+const CONTRIBUTOR_TEXT_COMMANDS = [
+  'echo rm "-r" "-f" src',
+  'echo "rm --recursive --force src"',
+];
+
+// Review regression inputs specify shell behavior independently of the parser.
+const SUBSTITUTION_DELETE_COMMANDS = [
+  ...CONTRIBUTOR_DELETE_COMMANDS,
+  "rm -r \"$(pwd)/src\" -f",
+  "rm -r x$(pwd) -f",
+  "rm \"$(pwd)/src\" -rf",
+  "rm -r \"`pwd`/src\" -f",
+  "rm -r x`pwd` -f",
+  "rm \"`pwd`/src\" -rf",
+  "rm -r \"$(echo \"$(pwd)\")/src\" -f",
+  "sudo rm -r \"$(pwd)/src\" -f",
+  "rm -r <(pwd) -f",
+  "rm -r >(pwd) -f",
+  "rm -r >\"$(pwd)/log\" -f src",
+  "rm -r >$(pwd)/log -f src",
+  "rm -rf \"$(pwd)/node_modules\"",
+  "echo `rm -r \"$(pwd)/src\" -f`",
+  "echo \"$(echo ready; rm -rf src)\"",
+  "echo \"$(rm -rf src)\"",
+  "rm -rf $(pwd",
+  "rm -rf \"$(pwd",
+  "rm -rf `pwd",
+  "rm -r \"$(pwd)/src\" -f; echo done",
+  "rm -r \"$(pwd)$(pwd)/src\" -f"
+];
+const SUBSTITUTION_TEXT_COMMANDS = [
+  ...CONTRIBUTOR_TEXT_COMMANDS,
+  "echo $(pwd) rm -rf src",
+  "echo `pwd` rm -rf src",
+  "echo \"$(pwd)\" rm -rf src",
+  "echo \"$(echo \"$(pwd)\")\" rm -rf src",
+  "echo x$(pwd) rm -rf src",
+  "echo <(pwd) rm -rf src",
+  "echo >(pwd) rm -rf src",
+  "echo >$(pwd)/log rm -rf src",
+  "echo \"$(pwd)rm -rf src\"",
+  "echo \"$(pwd)$(pwd)\" rm -rf src",
+  "rm -r$(pwd) -f src",
+  "rm -r \"$(pwd)-f\" src",
+  "$(pwd)rm -rf src",
+  "\"$(pwd)/rm\" -rf src",
+  "echo '$(rm -rf src)'",
+  "echo \"$(pwd # ignored rm -rf src\n)\" rm -rf src"
+];
+
+// cspell:ignore uroot ualice Huroot
+const RECURSIVE_DELETE_DENY_COMMANDS = [
+  ...SUBSTITUTION_DELETE_COMMANDS,
+  "rm -rf src",
+  "rm -fr src",
+  "rm -r -f src",
+  "rm -f -r src",
+  "rm -rfv src",
+  "rm -rvf src",
+  "rm -vrf src",
+  "rm -R -f src",
+  "rm --recursive --force src",
+  "rm --force --recursive src",
+  "rm --recursive -f src",
+  "rm -r --force src",
+  "rm --rec --fo src",
+  "rm \"-rf\" src",
+  "rm '-rf' src",
+  "rm -r'f' src",
+  "rm -r\\f src",
+  "r\\m -rf src",
+  "/bin/rm -rf src",
+  "sudo -u root rm -rf src",
+  "env FOO=1 rm -rf src",
+  "command rm -rf src",
+  "timeout 5 rm -rf src",
+  "cd x && rm -rf src",
+  "echo ready; rm -rf src",
+  "false || rm -rf src",
+  "echo \"$(rm -rf src)\"",
+  "echo \"$(echo \"$(rm -rf src)\")\"",
+  "# don't delete\nrm -rf src",
+  "rm -rf node_modules src",
+  "rm -rf node_modules src/*",
+  "rm -rf node_modules src/**",
+  "rm -rf node_modules src/?",
+  "rm -rf node_modules src/[ab]",
+  "rm -rf node_modules \"$TARGET\"",
+  "rm -rf \"$TARGET/node_modules\"",
+  "rm -rf node_modules,dist",
+  "rm -rf node_modules ../src",
+  "rm -rf /tmp/node_modules",
+  "rm -rf node_modules 2>/dev/null",
+  "rm -rf node_modules && rm -rf src",
+  "rm -rf -- src",
+  "rm -rf --bogus node_modules",
+  "rm -rf 'node_modules",
+  "rm -rf node_modules \"\"",
+  "rm -rf node_modules \"$(pwd)/node_modules\"",
+  "rm > -- -rf src",
+  "> /tmp/log rm -rf src",
+  "2>/tmp/log rm -rf src",
+  "rm -r '>' -f src",
+  "rm -r \\> -f src",
+  "rm -rf node_modules > dist",
+  "rm -rf node_modules 2>&1",
+  "rm -rf node_modules &>/tmp/log",
+  "command -- rm -rf src",
+  "echo >$(rm -rf src)",
+  "echo >\"$(echo \"$(rm -rf src)\")\"",
+  "cat <(rm -rf src)",
+  "# don't run it\nrm -rf src",
+  "rm -rf node_modules # quote ' doesn't swallow the next line\nrm -rf src",
+  "sudo -uroot rm -rf src",
+  "sudo -ualice rm -rf src",
+  "sudo -Huroot rm -rf src",
+  "sudo --user=alice rm -rf src",
+  "sudo -D/tmp rm -rf src",
+  "2>log rm -rf src"
+];
+const RECURSIVE_DELETE_SAFE_COMMANDS = [
+  ...SUBSTITUTION_TEXT_COMMANDS,
+  "echo hello",
+  "rm -f file",
+  "rm -r src",
+  "rm --recursive src",
+  "rm -- -rf src",
+  "rm '--' -rf src",
+  "rm -rf node_modules",
+  "rm -fr ./dist",
+  "rm -r -f packages/app/node_modules",
+  "rm --recursive --force node_modules dist",
+  "rm -rf -- node_modules",
+  "rm -rf node_modules #
```

**File**: `agent-governance-claude-code/test/recursive-delete-shell.test.mjs` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+// Copyright (c) Microsoft Corporation.
+// Licensed under the MIT License.
+
+import assert from "node:assert/strict";
+import { existsSync } from "node:fs";
+import { spawnSync } from "node:child_process";
+import test from "node:test";
+import { matchesRecursiveDeleteCommand } from "../lib/recursive-delete.mjs";
+
+test("reviewer fixtures agree with Bash argument boundaries using a mock rm", { skip: !existsSync("/bin/bash") }, () => {
+  // Only these fixed reviewer fixtures execute. The shell functions replace
+  // rm and pwd; no real deletion or arbitrary generated command is executed.
+  const fixtures = [
+    ['rm -r "$(pwd)/src" -f', ["-r", "/fixture/src", "-f"]],
+    ["rm -r x$(pwd) -f", ["-r", "x/fixture", "-f"]],
+    ['rm "$(pwd)/src" -rf', ["/fixture/src", "-rf"]],
+    ['rm -r "`pwd`/src" -f', ["-r", "/fixture/src", "-f"]],
+    ["rm -r x`pwd` -f", ["-r", "x/fixture", "-f"]],
+    ['rm "`pwd`/src" -rf', ["/fixture/src", "-rf"]],
+    ["echo $(pwd) rm -rf src", []],
+    ["echo `pwd` rm -rf src", []],
+  ];
+  for (const [command, expectedArgs] of fixtures) {
+    // cspell:ignore noprofile norc
+    const result = spawnSync("/bin/bash", ["--noprofile", "--norc", "-c",
+      'rm() { printf "%s\\0" "$@" >&2; }; pwd() { printf /fixture; }; ' + command,
+    ], { encoding: "utf8", timeout: 5000, env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } });
+    assert.equal(result.status, 0, result.stderr);
+    const args = result.stderr ? result.stderr.split("\0").slice(0, -1) : [];
+    assert.deepEqual(args, expectedArgs, command);
+    assert.equal(matchesRecursiveDeleteCommand(command), expectedArgs.length > 0, command);
+  }
+});
```

---

### Incident Patch 15: `406ddd4d` (2026-10-02)
**Commit Message**: fix(mcp-receipts): reject unsigned chains and empty signer trust (#4201)

Align offline receipt verification with the library by treating missing
Ed25519 signatures as errors. Distinguish an omitted signer restriction
from an explicit empty list so an empty configuration trusts no signer.

Add CLI/library regression coverage and document the verification contract.

Reviewed in detail by Carlos Hernandez, who takes full responsibility
for this contribution and authorized its submission. Codex assisted
with implementation, tests, documentation, and validation.

Fixes #4165

Signed-off-by: Carlos Hernandez <[REDACTED_EMAIL]>

**File**: `agent-governance-python/agentmesh-integrations/mcp-receipt-governed/README.md` (modified, +12/-1)
```diff
@@ -85,6 +85,17 @@ MCP Tool Call
 
 ## Receipt assurance profiles
 
+Receipt generation supports unsigned receipts when no signing key is configured.
+Both `verify_receipt_chain()` and `scripts/verify_receipts.py` require valid
+signatures: an unsigned receipt fails verification. The CLI exits with code 1,
+reports `"passed": false` in its JSON summary, and records an error for each
+unsigned receipt.
+
+For receipt signer trust, `verify_receipt_chain(..., trusted_keys=None)` verifies
+signatures without restricting the signer keys. An explicit `trusted_keys` list
+accepts only those keys; `trusted_keys=[]` rejects every signer. Signature validity
+alone does not establish trust in a signer or authorization to execute an action.
+
 By default, receipts are **self-attested**: a configured receipt signer records its
 own policy decision. This detects later modification but does not establish that an
 independent party approved the action.
@@ -112,4 +123,4 @@ timestamp; a live adapter evaluates it against the current time before execution
 
 ## License
 
-MIT — see [LICENSE](LICENSE).
+MIT — see [LICENSE](../../../LICENSE).
```

**File**: `agent-governance-python/agentmesh-integrations/mcp-receipt-governed/mcp_receipt_governed/receipt.py` (modified, +5/-2)
```diff
@@ -405,12 +405,15 @@ def verify_receipt_chain(
     Checks: no-parent on first receipt, contiguous parent hashes, no duplicate
     receipt IDs, valid signatures, trusted receipt signers, and externally
     authorized receipts (when present or required).
+
+    ``trusted_keys=None`` verifies signatures without restricting receipt signers.
+    An explicit list accepts only the listed keys; an empty list trusts no signer.
     """
     if not receipts:
         return []
 
     errors: List[str] = []
-    trusted_set = set(trusted_keys) if trusted_keys else None
+    trusted_set = set(trusted_keys) if trusted_keys is not None else None
     seen_ids: set = set()
 
     for i, r in enumerate(receipts):
@@ -435,7 +438,7 @@ def verify_receipt_chain(
                 errors.append(f"[{i}] Malformed signer_public_key for receipt {r.receipt_id}")
             elif not verify_receipt(r):
                 errors.append(f"[{i}] Ed25519 signature invalid for receipt {r.receipt_id}")
-            elif trusted_set and key not in trusted_set:
+            elif trusted_set is not None and key not in trusted_set:
                 errors.append(f"[{i}] Untrusted signer {key[:16]}… — receipt rejected")
         else:
             errors.append(f"[{i}] Unsigned receipt — missing Ed25519 signature")
```

**File**: `agent-governance-python/agentmesh-integrations/mcp-receipt-governed/scripts/verify_receipts.py` (modified, +3/-1)
```diff
@@ -99,7 +99,9 @@ def verify_chain(
                 print(f"      [FAIL] {msg}")
                 errs.append(msg)
         else:
-            print("      [WARN] Unsigned receipt")
+            msg = "Unsigned receipt - missing Ed25519 signature"
+            print(f"      [FAIL] {msg}")
+            errs.append(msg)
 
         if r.assurance_level == "externally_authorized":
             authorization_errors = verify_receipt_authorization(
```

**File**: `agent-governance-python/agentmesh-integrations/mcp-receipt-governed/tests/test_receipt.py` (modified, +19/-0)
```diff
@@ -475,6 +475,25 @@ def test_untrusted_key_rejected(self, signing_key):
         errors = verify_receipt_chain([r], trusted_keys=["deadbeef" * 4])
         assert any("rejected" in e for e in errors)
 
+    def test_empty_trusted_keys_rejects_every_signed_receipt(self, signing_key):
+        receipts = _make_chain("r1", "r2", "r3", sign_with=signing_key)
+
+        errors = verify_receipt_chain(receipts, trusted_keys=[])
+
+        assert len(errors) == len(receipts)
+        for index, error in enumerate(errors):
+            assert error.startswith(f"[{index}] Untrusted signer")
+            assert "receipt rejected" in error
+
+    def test_none_trusted_keys_keeps_signature_verification(self, signing_key):
+        receipts = _make_chain("r1", "r2", sign_with=signing_key)
+        assert verify_receipt_chain(receipts, trusted_keys=None) == []
+
+        receipts[-1].tool_name = "tampered"
+        errors = verify_receipt_chain(receipts, trusted_keys=None)
+        assert len(errors) == 1
+        assert "Ed25519 signature invalid" in errors[0]
+
     def test_duplicate_receipt_id_flagged(self, signing_key):
         r1 = GovernanceReceipt(receipt_id="same", timestamp=1.0)
         sign_receipt(r1, signing_key)
```

**File**: `agent-governance-python/agentmesh-integrations/mcp-receipt-governed/tests/test_verify_receipts.py` (modified, +65/-1)
```diff
@@ -11,7 +11,12 @@
 
 import pytest
 
-from mcp_receipt_governed.receipt import GovernanceReceipt, authorize_receipt, sign_receipt
+from mcp_receipt_governed.receipt import (
+    GovernanceReceipt,
+    authorize_receipt,
+    sign_receipt,
+    verify_receipt_chain,
+)
 
 
 @pytest.fixture()
@@ -68,3 +73,62 @@ def test_verifier_accepts_trusted_external_authorization(tmp_path, ed25519_keys)
 
     assert result.returncode == 0, result.stderr
     assert "External authorization valid and trusted" in result.stdout
+
+
+@pytest.mark.parametrize("json_output", [False, True], ids=["text", "json"])
+@pytest.mark.parametrize("chain_kind", ["unsigned", "mixed", "signed", "tampered"])
+def test_verifier_signature_results_match_library(
+    tmp_path, ed25519_keys, json_output, chain_kind
+):
+    signer_key, _, _ = ed25519_keys
+    receipts = []
+    for index in range(3):
+        receipt = GovernanceReceipt(
+            receipt_id=f"receipt-{index}",
+            tool_name="read",
+            timestamp=float(index + 1),
+            parent_receipt_hash=receipts[-1].payload_hash() if receipts else None,
+        )
+        if chain_kind != "unsigned" and not (chain_kind == "mixed" and index == 1):
+            sign_receipt(receipt, signer_key)
+        receipts.append(receipt)
+    if chain_kind == "tampered":
+        receipts[-1].tool_name = "tampered"
+
+    receipt_file = tmp_path / "receipts.json"
+    receipt_file.write_text(json.dumps([r.to_dict() for r in receipts]), encoding="utf-8")
+    script = Path(__file__).parents[1] / "scripts" / "verify_receipts.py"
+    environment = os.environ | {"PYTHONPATH": str(script.parents[1])}
+    command = [sys.executable, str(script), str(receipt_file)]
+    if json_output:
+        command.append("--json")
+    result = subprocess.run(
+        command, capture_output=True, check=False, env=environment, text=True
+    )
+
+    expected_errors = 0 if chain_kind == "signed" else 3 if chain_kind == "unsigned" else 1
+    assert len(verify_receipt_chain(receipts)) == expected_errors
+    assert result.returncode == (1 if expected_errors else 0), result.stderr
+    if json_output:
+        # The existing CLI writes diagnostics before the final JSON document.
+        report = json.loads(result.stdout[result.stdout.index("{"):])
+        assert report["passed"] is (expected_errors == 0)
+        assert report["exit_code"] == result.returncode
+        assert report["total_receipts"] == 3
+        assert sum(len(r["errors"]) for r in report["receipts"]) == expected_errors
+        for index, entry in enumerate(report["receipts"]):
+            failed = (
+                chain_kind == "unsigned"
+                or (chain_kind == "mixed" and index == 1)
+                or (chain_kind == "tampered" and index == 2)
+            )
+            assert entry["passed"] is (not failed)
+            if chain_kind in {"unsigned", "mixed"} and failed:
+                assert entry["errors"] == ["Unsigned receipt - missing Ed25519 signature"]
+    elif expected_errors:
+        assert "Verification failed" in result.stdout
+        assert "signatures are valid" not in result.stdout
+        if chain_kind in {"unsigned", "mixed"}:
+            assert result.stdout.count("[FAIL] Unsigned receipt") == expected_errors
+    else:
+        assert "Verification passed - chain is contiguous and signatures are valid" in result.stdout
```

#### Recent Merged Pull Requests:
- **PR #4231** (2026-10-05): ci(supply-chain): extend cargo-deny source policy to standalone manifests (@chopmob-cloud)
- **PR #4229** (2026-10-05): ci(supply-chain): enforce Cargo source policy with cargo-deny (@chopmob-cloud)
- **PR #4227** (2026-10-04): fix(agent-mesh): don't count unassessed compliance controls as met (@ShivamSharma43)
- **PR #4223** (2026-10-03): chore(deps): Bump fast-uri from 3.1.7 to 3.1.8 in /agent-governance-python/agent-mesh/packages/mcp-proxy (@dependabot[bot])
- **PR #4222** (2026-10-03): chore(deps): Bump brace-expansion in /agent-governance-python/agent-os/extensions/copilot (@dependabot[bot])
- **PR #4220** (2026-10-03): chore(deps-dev): Bump brace-expansion from 1.1.16 to 1.1.21 in /agent-governance-python/agent-mesh/packages/mcp-proxy (@dependabot[bot])
- **PR #4219** (2026-10-03): chore(deps): Bump axios from 1.18.0 to 1.20.0 in /agent-governance-python/agent-os/extensions/cursor (@dependabot[bot])
- **PR #4218** (2026-10-03): chore(deps-dev): Bump brace-expansion from 5.0.7 to 5.0.12 in /agent-governance-python/agent-os/extensions/mcp-server (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
