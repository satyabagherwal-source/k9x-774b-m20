> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-agent-governance-toolkit-learnings.md`  
> **Source**: github ([https://github.com/microsoft/agent-governance-toolkit](https://github.com/microsoft/agent-governance-toolkit))  
> **Source Version**: `fcc8eb13`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T08:12:12.443Z  
> **Learning ID**: `learn-github-microsoft-agent-governance-toolkit`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): microsoft/agent-governance-toolkit

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Addressed
Autonomous LLM-driven agents possess dynamic execution capabilities: tool invocation, arbitrary shell execution, file system mutation, relational database operations, and inter-agent task delegation. Standard perimeter security controls (e.g., OAuth tokens, IAM roles, network firewalls) only govern whether an agent can establish a transport session with a resource. They cannot inspect or constrain runtime behavior within an established session. Stochastic system safety cannot rely on prompt-level instructions ("system prompts") because prompt injection, jailbreaks, and goal hijacking reliably bypass natural language constraints (ICLR 2025: 100% attack success rates against frontier models under adaptive probing). 

`microsoft/agent-governance-toolkit` (AGT) solves this problem by inserting a deterministic, out-of-band policy engine and control boundary between the agent reasoning loop and host environment execution interfaces. AGT acts as an enforcement broker across Python, Node.js/TypeScript, and .NET runtimes, intercepting prompts, tool parameters, shell executions, and tool outputs before host state mutation occurs.

### Architectural Boundaries & State Ownership
The architecture isolates runtime evaluation across several strict control boundaries:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             HOST / OPERATOR                              │
│                                                                          │
│  ┌───────────────────────┐          ┌──────────────────────────────────┐ │
│  │ GovernanceConfig      │          │ CLI / Orchestrator               │ │
│  │ (Immutable Invariants)│          │ (Antigravity, Claude Code, etc.) │ │
│  └──────────┬────────────┘          └────────────────┬─────────────────┘ │
└─────────────┼────────────────────────────────────────┼───────────────────┘
              │ Enforced Controls                      │ Invokes Stdin/Stdout
              ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ INTERCEPTION HOOK RUNTIME (Subprocess / STDIO Boundary)                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ hook-runtime.mjs / common.mjs                                      │  │
│  │ - Buffer stdin chunks until stream termination                     │  │
│  │ - Parse payload JSON                                               │  │
│  │ - Catch ALL errors -> write stderr -> EXIT 2 (FAIL-CLOSED)         │  │
│  └──────────────────┬─────────────────────────────────────────────────┘  │
│                     │ Evaluates payload                                  │
│                     ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Policy Engine / Evaluator (Native Rust FFI / OPA WASM / Rego CLI)  │  │
│  │ - evaluatePromptSubmission(state, input)                           │  │
│  │ - evaluatePreToolUse(state, input)                                 │  │
│  │ - inspectToolResult(state, input)                                  │  │
│  └──────────────────┬─────────────────────────────────────────────────┘  │
└─────────────────────┼────────────────────────────────────────────────────┘
                      │ Emits Allow / Deny / Transform
                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ EXECUTION HARNESS & CONTAINMENT                                          │
│                                                                          │
│  ┌─────────────────────────┐            ┌──────────────────────────────┐ │
│  │ DockerDeployer (Runtime)│            │ Reward & Feedback            │ │
│  │ - Isolated network      │            │ (Agent-Lightning)            │ │
│  │ - Read-only rootfs      │            │ - Invariant penalty scaling  │ │
│  │ - Blocked env overrides │            │ - Cryptographic audit logs   │ │
│  └─────────────────────────┘            └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

1. **Subprocess/STDIO Isolation Barrier**: For developer CLI integrations (Claude Code, GitHub Copilot CLI, Antigravity CLI), AGT executes policy hooks as discrete Node.js scripts via non-blocking POSIX stdin/stdout streaming pipes. Host environments communicate through serialized JSON payloads over stdin. Policy decisions (`allow`, `deny`, or output-suppression commands) are emitted over stdout. Any runtime error, policy syntax failure, or execution crash routes directly to stderr and forces an immediate non-zero exit code (`exit(2)`), halting the agent loop before unverified operations execute.
2. **Deterministic Native Evaluation Boundary**: Policy evaluation leverages compiled Rust artifacts (`agent_control_specification` via Maturin PyO3 bindings) and Open Policy Agent (OPA) binaries compiled to standalone static executables. Rego and AST evaluations occur strictly in deterministic local memory space without out-of-band network dependencies.
3. **Container Sandboxing Boundary**: `DockerDeployer` runs untrusted agent processes inside hardened Linux namespaces (`--security-opt no-new-privileges`, `--read-only`, and `/tmp:rw,noexec,nosuid`). Mandatory host configurations (`AGT_KILL_SWITCH`, `AGT_POLICY_PATH`, `AGT_TRUST_LEVEL`) are injected into the execution context and hard-locked against container-level environment variable overrides.
4. **Audit and Reward Boundary**: Cryptographic SHA-256 hash chains trace session metadata immutability across evaluation turns. In reinforcement learning (RL) fine-tuning pipelines (Agent-Lightning), governance violations feed directly into reward penalty calculators to align agent trajectories against safety violations.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. POSIX CLI Parameter Smuggling and Environment Precedence Invariant
**RULE**:
When generating CLI execution arguments for third-party command-line binaries (e.g., `docker run`, `kubectl exec`, `ssh`, or runtime wrappers) where certain internal configuration keys MUST take absolute precedence over user-supplied mappings, the system MUST NOT rely on argument positioning alone. The system MUST explicitly validate user-supplied dictionaries, reject keys matching reserved configuration names, and reject keys containing internal delimiter tokens (such as `=` in key names) before command construction.

**WHY**:
Third-party CLIs parse repeated flags using variable semantics. For example, Docker CLI evaluates repeated environment variables (`-e KEY=val1 -e KEY=val2`) using "last-write-wins". If internal security policies inject `-e AGT_KILL_SWITCH=true` first, and user inputs are appended afterward, a malicious or accidental user entry `{"AGT_KILL_SWITCH": "false"}` completely overrides the security posture. Furthermore, POSIX argument parsers split key-value definitions on the first `=` sign; passing an entry with an `=` in the key (e.g., `{"AGT_KILL_SWITCH=false": "irrelevant"}`) results in the binary parsing `AGT_KILL_SWITCH` as the key and `false` as the value, circumventing key-blocklists that check only exact dictionary key strings.

**WHEN TO APPLY**:
Apply in any orchestration, container dispatch, subprocess wrapper, or CLI proxy written in Python, Go, Node.js, or Rust where system-level security constraints are merged with user-defined environment variables, query parameters, or execution options.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Mapping, Sequence

def build_hardened_container_command(
    image: str,
    reserved_config: Mapping[str, str],
    user_env: Mapping[str, str] | None = None,
) -> list[str]:
    """
    Constructs CLI arguments preventing parameter smuggling and precedence overrides.
    """
    cmd: list[str] = [
        "docker", "run",
        "--rm",
        "--security-opt", "no-new-privileges",
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid",
    ]

    # 1. Enforce reserved immutable governance/security controls
    for key, value in reserved_config.items():
        if "=" in key:
            raise ValueError(f"Reserved configuration key {key!r} contains invalid token '='")
        cmd.extend(["-e", f"{key}={value}"])

    # 2. Strict validation and sanitization of user-provided environment mappings
    if user_env:
        for user_key, user_val in user_env.items():
            # Prevent POSIX CLI delimiter injection where key contains '='
            if "=" in user_key:
                raise ValueError(
                    f"Invalid environment variable name {user_key!r}: must not contain '='"
                )
            # Prevent overriding reserved governance keys
            if user_key in reserved_config:
                raise ValueError(
                    f"Security violation: user environment variable {user_key!r} "
                    f"attempts to override immutable governance config"
                )
            cmd.extend(["-e", f"{user_key}={user_val}"])

    cmd.append(image)
    return cmd
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL VULNERABILITY: Relies on placement or blind appending
def unsafe_build_container_command(image: str, reserved_config: dict, user_env: dict):
    cmd = ["docker", "run"]
    # Appending reserved config first allows user_env appended later to override it in Docker!
    for k, v in reserved_config.items():
        cmd.extend(["-e", f"{k}={v}"])
    
    # Smuggling flaw: If user_env has {"AGT_KILL_SWITCH=false": "1"}, Docker splits on '='
    # and sets AGT_KILL_SWITCH to 'false' even if k == 'AGT_KILL_SWITCH' is explicitly blocked!
    for k, v in user_env.items():
        cmd.extend(["-e", f"{k}={v}"])
    cmd.append(image)
    return cmd
```

**VERIFICATION METHOD**:
Enforce parameter boundary tests that supply both direct collisions and delimiter-smuggled keys:
```python
import pytest

def test_cli_builder_rejects_overrides_and_smuggling():
    reserved = {"SECURITY_ENFORCED": "true"}
    
    # Check direct name collision
    with pytest.raises(ValueError, match="attempts to override"):
        build_hardened_container_command("alpine:latest", reserved, {"SECURITY_ENFORCED": "false"})
        
    # Check delimiter smuggling attack vector
    with pytest.raises(ValueError, match="must not contain '='"):
        build_hardened_container_command("alpine:latest", reserved, {"SECURITY_ENFORCED=false": "value"})
```

---

### 2. Fail-Closed Asynchronous STDIO Interceptor Boundary Invariant
**RULE**:
Process hook handlers intercepting tool calls or agent executions over standard I/O (STDIO) streams MUST buffer input until EOF, handle stdout backpressure asynchronously with error listeners detached upon completion, and enforce a strict catch-all wrapper that writes diagnostic errors to `stderr` and forces an explicit non-zero exit code (MUST NOT exit 0, and MUST NOT allow unhandled promise rejections to let execution fall through).

**WHY**:
CLI agents (such as Claude Code or Antigravity) invoke external lifecycle hooks as child processes and parse stdout as JSON. If a policy evaluation hook crashes due to an unhandled exception, syntax error, or file access error, and the process terminates without setting an explicit exit code, the parent orchestrator may treat the absence of a denial payload as an implicit approval ("fail-open"). Furthermore, synchronous writes to `stdout` under large diagnostic payloads can trigger truncated buffer writes if the OS pipe buffer fills up, resulting in unhandled JSON parsing failures in the orchestrator.

**WHEN TO APPLY**:
All hook scripts, pre-commit scanners, gateway interceptors, and stdio-based CLI wrappers across Node.js/JavaScript, Python, and shell scripts.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// hook-runtime.mjs
import process from "node:process";

/**
 * Executes a policy lifecycle hook with strict fail-closed guarantees.
 * @param {() => Promise<void>} handler
 */
export async function runHookMain(handler) {
  try {
    await handler();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Fail-closed invariant: Write reason to stderr and force exit code 2
    await writeHookStderr(`AGT Policy Hook Execution Failure: ${err.message}\n${err.stack ?? ""}`);
    process.exit(2);
  }
}

/**
 * Safely drains stdout with backpressure handling and leak-free error listener cleanup.
 */
export async function writeHookOutput(payload) {
  const jsonStr = `${JSON.stringify(payload ?? {})}\n`;
  await new Promise((resolve, reject) => {
    const onDrainError = (err) => {
      process.stdout.off("error", onDrainError);
      reject(err);
    };
    process.stdout.once("error", onDrainError);
    process.stdout.write(jsonStr, "utf8", () => {
      process.stdout.off("error", onDrainError);
      resolve();
    });
  });
}

/**
 * Fully buffers stdin until stream termination before invoking parsers.
 */
export async function loadHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// DANGEROUS ANTI-PATTERN: Silent fail-open, uncaught async error, unhandled backpressure
export async function badHook() {
  // 1. Partial read: Stdin might not be finished sending payload
  let data = "";
  process.stdin.on("data", chunk => { data += chunk; });
  
  // 2. Unhandled JSON parse throw crashes node process with exit code 1 or 0
  // In some CI/wrappers exit code 1 without structured json is ignored or falls open!
  const parsed = JSON.parse(data);
  
  // 3. Synchronous write ignoring pipe backpressure
  process.stdout.write(JSON.stringify({ decision: "allow" }));
  // Missing error handler, process leaves open handles or exits before drain
}
```

**VERIFICATION METHOD**:
Execute an integration test that feeds malformed input or triggers internal evaluator errors, verifying that the process terminates with exit code 2 and outputs nothing on `stdout`:
```bash
node -e 'import("./hooks/before-tool.mjs")' < /dev/null
test $? -eq 2 || exit 1
```

---

### 3. Metric-Reward Calculation Equivalence Invariant
**RULE**:
When an optimization, reward-shaping, or governance subsystem applies non-linear or multiplicative transformations to a base score (e.g., penalties scaling rewards by `factor < 1.0`), all exported telemetry, accumulated metrics (`total_penalties`, `avg_penalty`), and emitted event values MUST record the actual delta applied to the baseline (`applied_penalty = final_value - base_value`). Telemetry systems MUST NOT record static additive severity constants from unapplied penalty lookup tables.

**WHY**:
Reinforcement learning loops and compliance telemetry use reported penalties to evaluate policy regressions and credit assignment. If a policy scales a baseline reward of 1.0 down to 0.5 via a multiplicative factor of 0.5, the actual penalty applied is `-0.5`. If the reporting system logs `-100.0` from a static additive lookup table, downstream RL policy gradients destabilize due to incorrect credit assignment, and compliance monitoring dashboards display distorted, uncalibrated risk metrics.

**WHEN TO APPLY**:
Any scoring, rate-limiting, RL reward shaping, token-bucket budgeting, or trust-score calculation engine in Python, Rust, Go, or Java.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from dataclasses import dataclass
from typing import Sequence

@dataclass(frozen=True)
class PolicyViolation:
    severity: str  # "low", "medium", "high", "critical"

@dataclass
class RewardConfig:
    multiplicative: bool = False
    multiplicative_factor: float = 0.5
    clean_bonus: float = 0.0
    min_reward: float | None = None

class PolicyRewardEvaluator:
    SEVERITY_PENALTIES = {
        "low": -5.0,
        "medium": -15.0,
        "high": -50.0,
        "critical": -100.0,
    }

    def __init__(self, config: RewardConfig):
        self.config = config
        self.total_penalties: float = 0.0
        self.evaluation_count: int = 0

    def compute_reward(self, base_reward: float, violations: Sequence[PolicyViolation]) -> tuple[float, float]:
        """
        Computes final reward and the mathematically exact applied penalty delta.
        Returns: (final_reward, applied_penalty)
        """
        if self.config.multiplicative and len(violations) > 0:
            final_reward = base_reward * self.config.multiplicative_factor
            # Mathematical invariant: penalty represents exact degradation against base
            applied_penalty = final_reward - base_reward
        else:
            # Additive calculation
            applied_penalty = sum(self.SEVERITY_PENALTIES.get(v.severity, -10.0) for v in violations)
            final_reward = base_reward + applied_penalty

        if not violations:
            final_reward += self.config.clean_bonus

        if self.config.min_reward is not None:
            final_reward = max(final_reward, self.config.min_reward)

        # Telemetry state strictly matches applied runtime transformation
        self.total_penalties += applied_penalty
        self.evaluation_count += 1

        return final_reward, applied_penalty
```

**NEGATIVE CONSTRAINT**:
```python
# DEFECTIVE CODE: Calculates multiplicative reward, but logs additive constant!
def calculate_reward_bad(base_reward, violations, config):
    # Lookup additive table penalty
    additive_penalty = sum(SEVERITY[v.severity] for v in violations)
    
    if config.multiplicative and violations:
        final_reward = base_reward * config.multiplicative_factor
        # BUG: additive_penalty (-100.0) is returned for logging/stats
        # while final_reward used 0.5 * base_reward (-0.5)!
        penalty_to_report = additive_penalty 
    else:
        final_reward = base_reward + additive_penalty
        penalty_to_report = additive_penalty
        
    return final_reward, penalty_to_report
```

**VERIFICATION METHOD**:
Assert mathematical parity across both modes in property-based unit tests:
```python
def test_applied_penalty_parity():
    cfg = RewardConfig(multiplicative=True, multiplicative_factor=0.5)
    evaluator = PolicyRewardEvaluator(cfg)
    base = 1.0
    final, penalty = evaluator.compute_reward(base, [PolicyViolation("critical")])
    assert final == 0.5
    assert penalty == -0.5
    assert evaluator.total_penalties == -0.5
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: CLI Argument Precedence & Key-Value Smuggling Override in Docker Deployer (BUG-DOCKER-DEPLOY-01)
- **Context**: `agent-governance-python/agent-runtime/src/agent_runtime/deploy.py` inside `DockerDeployer.deploy()`
- **What Was Expected**: The container runtime deployer takes parameters from `GovernanceConfig` (e.g., `kill_switch_enabled`, `policy_path`, `trust_level`) and must guarantee that these governance controls cannot be disabled by user-supplied environment variables passed in the `env` dictionary.
- **What Actually Happened**: `DockerDeployer.deploy` serialized governance settings as `-e KEY=VAL` flags at the start of the `docker run` command line, and subsequently appended caller-provided `env` items. Because the Docker CLI evaluates multiple `-e` arguments with a "last-write-wins" resolution strategy, calling `deploy(..., env={"AGT_KILL_SWITCH": "false"})` overrode `config.kill_switch_enabled=True`. In addition, if a caller passed an environment key containing an equals sign (e.g., `{"AGT_KILL_SWITCH=false": "x"}`), Docker split the string on the first `=` and overrode `AGT_KILL_SWITCH`.
- **Evidence in Repo**: Commit `fcc8eb13`, PR #4409, file `agent-governance-python/agent-runtime/src/agent_runtime/deploy.py`, test file `agent-governance-python/agent-runtime/tests/test_deploy.py`.
- **Root Cause**: Reliance on CLI argument order for authorization boundary enforcement without input validation for key collisions and POSIX token delimiter (`=`) injection.
- **Remediation Code Diff**:
```python
<<<<
-            # Governance config as env vars
-            "-e", f"AGT_POLICY_PATH={config.policy_path}",
-            "-e", f"AGT_TRUST_LEVEL={config.trust_level}",
-            "-e", f"AGT_AUDIT_ENABLED={str(config.audit_enabled).lower()}",
-            "-e", f"AGT_MAX_TOOL_CALLS={config.max_tool_calls}",
-            "-e", f"AGT_RATE_LIMIT_RPM={config.rate_limit_rpm}",
-            "-e", f"AGT_KILL_SWITCH={str(config.kill_switch_enabled).lower()}",
-            "-e", f"AGT_RETENTION_DAYS={config.retention_days}",
         ]
+        governance_env = {
+            "AGT_POLICY_PATH": config.policy_path,
+            "AGT_TRUST_LEVEL": config.trust_level,
+            "AGT_AUDIT_ENABLED": str(config.audit_enabled).lower(),
+            "AGT_MAX_TOOL_CALLS": str(config.max_tool_calls),
+            "AGT_RATE_LIMIT_RPM": str(config.rate_limit_rpm),
+            "AGT_KILL_SWITCH": str(config.kill_switch_enabled).lower(),
+            "AGT_RETENTION_DAYS": str(config.retention_days),
+        }
+        for k, v in governance_env.items():
+            cmd.extend(["-e", f"{k}={v}"])
         if port:
             cmd.extend(["-p", f"127.0.0.1:{port}:8080"])
         if env:
+            for k, v in env.items():
+                if "=" in k:
+                    raise ValueError(
+                        f"invalid environment variable name {k!r}: must not contain '='"
+                    )
+                if k in governance_env:
+                    raise ValueError(
+                        f"env must not set {k}: it is set from GovernanceConfig"
+                    )
                 cmd.extend(["-e", f"{k}={v}"])
         cmd.append(image)
====
```
- **Lesson**: Hardened wrappers around third-party CLI tools must implement defensive input rejection against both name-space collisions and argument-delimiter smuggling.

---

### Incident 2: Multiplicative Reward Penalty Reporting Desynchronization (BUG-LIGHTNING-REWARD-02)
- **Context**: `agent-governance-python/agent-lightning/src/agent_lightning_gov/reward.py`
- **What Was Expected**: When `RewardConfig(multiplicative=True)` is configured, RL policy fine-tuning runs must track the actual penalty applied to the base reward so that `get_stats()` (`total_penalties`, `avg_penalty`) and the `policy_penalty` emission to Agent-Lightning accurately represent training feedback.
- **What Actually Happened**: The calculation correctly multiplied `base_reward * multiplicative_factor`, but the telemetry reporter continued pulling penalty figures from `self._calculate_penalty(violations)` (the additive lookup table). For example, a critical violation on a `1.0` base reward halved the reward to `0.5` (a `-0.5` delta), but emitted a penalty of `-100.0`. This skewed training metrics and corrupted RL credit assignment.
- **Evidence in Repo**: Commit `6dc2093e`, PR #4418, spec document `docs/specs/AGENT-LIGHTNING-FAST-PATH-1.0.md`.
- **Root Cause**: Calculation code branching calculated the return value correctly, but bypassed updating the intermediate variable that was subsequently consumed by telemetry logging.
- **Remediation Code Diff**:
```python
<<<<
-        # Calculate penalty
-        penalty = self._calculate_penalty(violations)
-
-        # Calculate final reward
         if self.config.multiplicative and violations:
             final_reward = base_reward * self.config.multiplicative_factor
+            penalty = final_reward - base_reward
         else:
+            penalty = self._calculate_penalty(violations)
             final_reward = base_reward + penalty
====
```
- **Lesson**: Telemetry, logging, and operational variables must be calculated as direct derivatives of the active transformation logic, not computed via disconnected parallel execution paths.

---

### Incident 3: Regex Word Boundary Hazard on Hyphenated CLI Flags Blocking `rm -rf` Detection (BUG-REGEX-FLAG-03)
- **Context**: `agent-governance-claude-code/config/default-policy.json` and `agent-governance-copilot-cli/.../default-policy.json`
- **What Was Expected**: The built-in safety rule `recursive-delete` was intended to match and block dangerous shell deletion invocations such as `rm -rf /` or `rm -r -f /dir`.
- **What Actually Happened**: The policy rule pattern was authored as `"source": "\\brm\\b[\\s\\S]*\\b-rf\\b"`. In standard regex engines, `\b` asserts a word boundary between a word character (`\w`: letters, digits, underscore) and a non-word character. Because the hyphen `-` is itself a non-word character, `\b-` requires a *word character immediately preceding the hyphen*. Following a whitespace character (`rm -rf`), there is NO word boundary before `-`. As a result, `rm -rf` never matched, and recursive deletes executed unhindered. The rule only triggered on nonsensical syntax like `rm x-rf`.
- **Evidence in Repo**: Issue #4178, Issue #3834, Issue #3662, PR #4129.
- **Root Cause**: Authoring regex rules with `\b` placed adjacent to non-word punctuation characters (`-`), misunderstanding regex engine word-boundary assertion mechanics.
- **Remediation Pattern**:
```json
<<<<
- "source": "\\brm\\b[\\s\\S]*\\b-rf\\b"
====
+ "source": "(?<!git\\s)\\brm\\s+(?:[^\\n;&|]*\\s)?(?:-[a-zA-Z]*r[a-zA-Z]*f|--recursive)"
>>>>
```
- **Lesson**: Never place regex word boundary assertions (`\b`) adjacent to non-alphanumeric punctuation. Security filters inspecting command-line strings must rely on structured AST tokenizers or explicit whitespace-delimited flag parsers rather than naive regular expressions.

---

### Incident 4: Unhandled Policy Engine Exception Causing Fail-Open / Crash in ASGI Gateway (BUG-MESH-GATEWAY-04)
- **Context**: `agent-mesh/src/agent_mesh/policy_provider.py` in `PolicyProviderHandler.handle_check()`
- **What Was Expected**: The agent mesh policy enforcement gateway must enforce a strict "fail-closed" contract. If the underlying policy engine encounters an internal failure, timeout, or uncaught exception, the gateway must produce a structured governance response indicating `deny` and log an audit event, shielding internal exception traces from the caller.
- **What Actually Happened**: `PolicyProviderHandler.handle_check()` called `self.policy_engine.evaluate(action, context)` without an enclosing `try...except` block. When an evaluation raised an exception, the error bubbled unhandled out of the ASGI HTTP `POST /check` route, resulting in an HTTP 500 error without a structured governance payload. Downstream agent client runtimes, unable to parse a valid policy decision payload, failed open or crashed unpredictably.
- **Evidence in Repo**: Issue #4172, CHANGELOG entry regarding .NET and Python `PolicyEngine` evaluation exception consistency.
- **Root Cause**: Missing fail-closed exception translation boundary in the core gateway request pipeline.
- **Remediation Pattern**:
```python
<<<<
    def handle_check(self, action: Action, context: Context) -> PolicyDecision:
        decision = self.policy_engine.evaluate(action, context)
        return decision
====
    def handle_check(self, action: Action, context: Context) -> PolicyDecision:
        try:
            return self.policy_engine.evaluate(action, context)
        except Exception as exc:
            self.audit_logger.record_failure(
                action=action,
                context=context,
                error=str(exc)
            )
            # Mandatory fail-closed contract
            return PolicyDecision(
                decision="deny",
                reason="Policy evaluation failed closed due to an internal error.",
                details={"error_class": exc.__class__.__name__}
            )
>>>>
```
- **Lesson**: Governance gateways must enforce fail-closed exception boundaries at every network and inter-process entrypoint. An unhandled exception must evaluate to an explicit `deny`.

---

### Incident 5: Temporal Decay Accumulation Bug & Mutable Reference Invalidation in Audit Logger (BUG-AUDIT-DECAY-05)
- **Context**: `agent-governance-python/integrations/haystack` in `TrustGate.apply_decay` and `AuditLogger.run`
- **What Was Expected**: 
  1. `TrustGate.apply_decay` should decay agent trust scores proportional to elapsed time since the *last evaluation or activity*.
  2. `AuditLogger.run` should maintain a tamper-evident SHA-256 cryptographic chain of logged session metadata.
- **What Actually Happened**:
  1. `apply_decay` subtracted `decay_rate` for each hour elapsed since the agent's last recorded success/failure, but failed to update `self.last_update` timestamp. On subsequent evaluations, it recalculated decay over the entire cumulative historical window again. An idle agent was unfairly penalized on repeated checks alone (e.g., losing 0.1 on check 1, 0.2 on check 2, 0.3 on check 3).
  2. `AuditLogger.run` stored direct references to the caller's mutable `metadata` dictionary. When callers subsequently modified their local dictionary, the historical logged entry was mutated in memory, causing subsequent calls to `verify_chain()` to report cryptographic tampering. Furthermore, non-JSON-serializable objects (such as `datetime.datetime`) caused serialization crashes inside `run`.
- **Evidence in Repo**: PR #4401, PR #4402, CHANGELOG.md entries.
- **Root Cause**: State update omissions (omitting timestamp progression) combined with shallow reference storage of mutable caller state in cryptographic logging structures.
- **Remediation Pattern**:
```python
# Remediation in TrustGate:
def apply_decay(self, now: datetime) -> None:
    elapsed_hours = (now - self.last_update).total_seconds() / 3600.0
    if elapsed_hours >= 1.0:
        decay_steps = int(elapsed_hours)
        self.trust_score = max(0.0, self.trust_score - (self.decay_rate * decay_steps))
        # Advance baseline timestamp to prevent geometric multi-charging
        self.last_update = now

# Remediation in AuditLogger:
import json

def run(self, entry_id: str, metadata: dict) -> None:
    # Deep snapshot through immutable JSON serialization boundary
    def _default_serializer(obj):
        return str(obj)
    
    snapshot_str = json.dumps(metadata, default=_default_serializer, sort_keys=True)
    immutable_snapshot = json.loads(snapshot_str)
    
    # Store immutable snapshot and hash payload
    self._append_to_hash_chain(entry_id, immutable_snapshot)
```
- **Lesson**: Temporal state processors must advance baseline clocks upon evaluation. Cryptographic audit ledgers must serialize deep immutable snapshots at ingestion time to prevent caller mutations from corrupting verification chains.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Nullish Coalescing vs Falsy Or (`