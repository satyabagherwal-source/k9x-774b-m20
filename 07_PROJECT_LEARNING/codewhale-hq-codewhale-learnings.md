> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `2947e4c5`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T07:19:15.887Z  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): codewhale-hq/Codewhale

---

## 1. Executive Forensic Architecture & System Mechanics

`codewhale-hq/Codewhale` is an enterprise-grade, local-first autonomous coding agent and multi-agent orchestrator written in Rust. It exposes multiple operator surfaces: a Ratatui-based Terminal User Interface (TUI), a headless daemon/app-server exposing JSON-RPC over stdio and Unix domain sockets, and a full HTTP/Server-Sent Events (SSE) control engine (`/v1/*`).

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   OPERATOR SURFACES                    │
                    │   Ratatui TUI   │  JSON-RPC stdio  │  Daemon Socket    │
                    └────────┬────────┴────────┬─────────┴────────┬──────────┘
                             │                 │                  │
                             ▼                 ▼                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                             CRATES/APP-SERVER                              │
│   Compatibility Admission Guard: Enforces allowed_tools: [] for stdio/sock │
│   JSON-RPC Dispatcher ──► Maps ThreadRequest / PromptRequest               │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL ENGINE & RUNTIME                          │
│   RuntimeThreadManager │ Event Journal (Append-only tree) │ StateStore     │
│   PrefixStabilityManager: Immutable KV Prefix (System + Ordered Tool Schemas)│
└───────────────────┬──────────────────────────────────┬─────────────────────┘
                    │                                  │
                    ▼                                  ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────┐
│         SUB-AGENT DELEGATION         │  │         TOOL EXECUTION           │
│  crates/agent-contract/worker_profile│  │  Bubblewrap Linux Sandbox        │
│  ChildGrant Lattice Intersection:    │  │  PTY Session Isolation (setsid)  │
│  FileGrant ∩ ShellGrant ∩ Tools      │  │  Approval Engine & Policy Engine │
└──────────────────────────────────────┘  └──────────────────────────────────┘
```

### Core Architectural Boundaries

1. **The Transport vs. Authority Boundary (`crates/app-server` vs. `crates/runtime`)**:
   Compatibility transports (stdio JSON-RPC, daemon sockets, legacy port 8787 HTTP) lack bidirectional interactive authorization channels. The architecture strictly quarantines these transports from executing arbitrary tool mutations or autonomous goals. They are constrained to read-only turns with an explicit `allowed_tools: []` contract. All tool invocations, approval prompts, and streaming interactions must execute via the canonical HTTP/SSE engine on port 7878 (`codewhale app-server --http`).

2. **Lattice-Based Capability Non-Escalation (`crates/agent-contract/src/worker_profile.rs`)**:
   Detached subagents (Fleet workers, explorer scouts, verifiers) operate under a monotonic non-escalation capability lattice. Child authorities are computed by performing an intersection operation ($\text{Child} = \text{Parent} \sqcap \text{Requested}$). Process authority (`ShellGrant`: `None < Inspect < Verify < Full`) and filesystem authority (`FileGrant`: `None < Read < Write`) derive via `Ord::min`. A child can never widen privileges beyond its parent.

3. **Prefix Stability & KV-Cache Economics (`crates/core/src/prefix_cache.rs`)**:
   To minimize LLM token costs and inference latency with models like DeepSeek V4.1, the engine enforces strict byte-level prefix stability. The prefix (System Prompt + Tool Definitions serialized to JSON in stable wire order) is fingerprinted via SHA-256. Request preparation maintains three contiguous memory regions:
   - *Region 1*: Frozen Immutable Prefix (system + tool schemas).
   - *Region 2*: Append-only turn history.
   - *Region 3*: Volatile latest user message.
   Any prefix drift is flagged and prevents silent cache invalidation.

4. **Append-Only Tree Journaling (`crates/core/src/journal.rs`)**:
   Thread history avoids in-place mutation. Every event (user, assistant, tool result, compaction) is recorded as a directed node referencing a `parent_id`. Thread state tracks an active `leaf_id`. Branching and rollbacks simply redirect the `leaf_id` pointer.

5. **Sandbox & PTY Isolation (`crates/cli`, `crates/tui`, Bubblewrap)**:
   Host execution occurs inside isolated Linux Bubblewrap containers. To prevent standard shell job control signals (`SIGINT`, `Ctrl-C`) from terminating the supervisor wrapper instead of the spawned process, the runtime allocates a controlling terminal within the PID namespace using `setsid`, ensuring clean process tree teardown.

---

## 2. Net-New Universal Engineering Rules

### 1. Monotonic Capability Derivation via Lattice Intersections
**RULE**:
When an autonomous system delegates tasks to child agents, background workers, or sandboxed sub-processes, the child's effective capability set MUST be derived strictly through a mathematical intersection ($\sqcap$) against the parent's current grant. The runtime MUST NOT permit an explicit allowlist or configuration object to widen any capability beyond the parent's bounds.

**WHY**:
Allowing subagent spawn routines to accept raw permission configurations without checking against the parent creates privilege escalation vulnerabilities. If a read-only "Reviewer" agent spawns a helper to run tests, and the helper configuration defaults to `allow_shell = true`, the child escalates beyond the parent's sandbox boundaries.

**WHEN TO APPLY**:
Apply in any multi-agent runtime, plugin architecture, sub-process launcher, or role-based delegation system across Rust, Go, Python, or TypeScript.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FileGrant {
    None = 0,
    Read = 1,
    Write = 2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ShellGrant {
    None = 0,
    Inspect = 1,
    Verify = 2,
    Full = 3,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CapabilityProfile {
    pub files: FileGrant,
    pub shell: ShellGrant,
    pub network: bool,
    pub allowed_tools: Option<Vec<String>>,
}

impl CapabilityProfile {
    #[must_use]
    pub fn derive_child(&self, requested: &CapabilityProfile) -> Self {
        // Enforce lattice lower-bound (Ord::min guarantees non-escalation)
        let effective_files = self.files.min(requested.files);
        let effective_shell = self.shell.min(requested.shell);
        let effective_network = self.network && requested.network;

        // Tool allowlist intersection
        let effective_tools = match (&self.allowed_tools, &requested.allowed_tools) {
            (Some(parent_tools), Some(req_tools)) => {
                Some(req_tools.iter().filter(|t| parent_tools.contains(t)).cloned().collect())
            }
            (Some(parent_tools), None) => Some(parent_tools.clone()),
            (None, Some(req_tools)) => Some(req_tools.clone()),
            (None, None) => None,
        };

        Self {
            files: effective_files,
            shell: effective_shell,
            network: effective_network,
            allowed_tools: effective_tools,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly assigning requested permissions if set,
// or falling back to default permissive capabilities.
pub fn spawn_child_insecure(parent: &CapabilityProfile, req: &SpawnRequest) -> CapabilityProfile {
    CapabilityProfile {
        // ESCALATION HAZARD: Child becomes Write even if Parent is Read!
        files: req.files.unwrap_or(FileGrant::Write),
        shell: req.shell.unwrap_or(parent.shell),
        network: req.network.unwrap_or(true),
        allowed_tools: req.tools.clone(),
    }
}
```

**VERIFICATION METHOD**:
Enforce compliance using a property-based test (e.g., `proptest` or `quickcheck`) asserting that for all arbitrary pairs `(p, r)`:
```rust
assert!(p.derive_child(&r).files <= p.files);
assert!(p.derive_child(&r).shell <= p.shell);
if !p.network { assert!(!p.derive_child(&r).network); }
```

---

### 2. Transport Admission Quarantine for Interactive Capabilities
**RULE**:
A protocol transport or API endpoint MUST explicitly reject requests that require operator approvals, human clarifications, or tool executions UNLESS the transport implements a full bidirectional interactive communication channel. The server MUST fail closed during request admission rather than stalling mid-execution or dropping interactions silently.

**WHY**:
Exposing tool-running or goal-seeking APIs across unidirectional or non-interactive transports (like stdio JSON-RPC or simplified HTTP webhooks) leads to deadlock states. When an autonomous agent attempts to execute a command that triggers an approval prompt or requests disambiguation, the non-interactive transport cannot reply. The agent hangs until a timeout occurs, leaking system resources and worker threads.

**WHEN TO APPLY**:
Apply whenever an engine supports multiple RPC layers (e.g., CLI stdio pipes, VSCode ACP protocol, headless daemons, and full WebSockets/SSE endpoints).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub async fn validate_turn_admission(
    is_interactive_transport: bool,
    allowed_tools: Option<&[String]>,
    is_goal_execution: bool,
) -> Result<(), TransportAdmissionError> {
    if !is_interactive_transport {
        // Enforce tool-free, non-goal admission on compatibility transports
        let has_empty_tools = matches!(allowed_tools, Some([]));
        if !has_empty_tools || is_goal_execution {
            return Err(TransportAdmissionError::InteractiveExecutionUnsupported {
                code: -32602,
                message: "Compatibility transports cannot answer approvals or clarification requests. \
                          Interactive execution requires a bidirectional SSE/WebSocket transport. \
                          Tool-free turns require explicit allowed_tools: [].".into(),
            });
        }
    }
    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Accepting requests on any transport and discovering
// downstream during turn execution that approvals cannot be gathered.
pub async fn execute_turn(req: TurnRequest, transport: &Transport) {
    let result = run_agent_loop(&req).await;
    if let AgentState::NeedsApproval(prompt) = result {
        // Transport cannot deliver or await response; fails silently or deadlocks!
        if transport.is_unidirectional() {
            log::warn!("Cannot ask for approval on this channel; skipping.");
        }
    }
}
```

**VERIFICATION METHOD**:
Automated integration test verifying that all compatibility entrypoints reject non-empty `allowed_tools` and interactive actions with JSON-RPC `-32602`:
```rust
#[tokio::test]
async fn test_compatibility_transport_refuses_tools() {
    let client = TestStdioClient::spawn().await;
    let err = client.call("prompt/run", json!({"prompt": "ls", "allowed_tools": ["bash"]})).await.unwrap_err();
    assert_eq!(err.code, -32602);
}
```

---

### 3. Stable Byte Order Serialization for Prefix-Cache Fingerprints
**RULE**:
When generating cryptographic hashes or tracking cache stability for LLM KV caches (e.g., DeepSeek, Anthropic prompt caching), tool catalog schemas and system prompts MUST NOT be serialized from unordered maps or sorted arbitrarily. They MUST be serialized strictly in the deterministic wire order presented to the LLM backend.

**WHY**:
Modern frontier LLMs utilize prefix KV-caching that operates on sequential token bytes. Sorting a tool catalog lexicographically before hashing creates a false-positive cache hit internally, while the provider backend experiences a total cache bust if its actual request payload serialized tools in registration order.

**WHEN TO APPLY**:
Apply in any context caching system, LLM client library, prompt optimizer, or caching reverse-proxy.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use sha2::{Digest, Sha256};
use serde_json::Value;

pub fn compute_provider_prefix_hash(system_prompt: &str, raw_tool_json: &[Value]) -> String {
    let mut hasher = Sha256::new();
    // 1. Hash system prompt
    hasher.update(system_prompt.as_bytes());
    hasher.update(b":");
    
    // 2. Hash tools IN EXACT WIRE ORDER (never sort by name)
    for tool in raw_tool_json {
        let serialized = serde_json::to_vec(tool).expect("valid tool json");
        hasher.update(&serialized);
        hasher.update(b",");
    }
    format!("{:x}", hasher.finalize())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Sorting keys or tool vectors to make hashes 'canonical'.
// This diverges from the provider's actual received byte stream!
pub fn compute_hash_insecure(tools: &mut [Tool]) -> String {
    tools.sort_by(|a, b| a.name.cmp(&b.name)); // BUSTS CACHE SYNC!
    serde_json::to_string(tools).unwrap()
}
```

**VERIFICATION METHOD**:
Run an assert verifying that rearranging the tool definition array produces a different cache fingerprint:
```rust
let tools_a = vec![tool_read(), tool_write()];
let tools_b = vec![tool_write(), tool_read()];
assert_ne!(
    compute_provider_prefix_hash("prompt", &tools_a),
    compute_provider_prefix_hash("prompt", &tools_b)
);
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Compatibility Transport Deadlock on Interactive Tool Approval
- **Context**: `crates/app-server/src/lib.rs`, `crates/protocol/src/lib.rs`
- **What Was Expected**: Legacy JSON-RPC stdio and Unix daemon sockets should execute tool-free completion turns cleanly without hanging on approval prompts.
- **What Actually Happened**: External scripts and SDKs initiated turns through compatibility transports without declaring tool allowlists. When tasks triggered tool invocations or interactive approval checkpoints, the compatibility transports—having no interactive approval endpoints—deadlocked or hung indefinitely.
- **Evidence in Repo**: Commit `109d0a3f`, Files: `crates/app-server/src/lib.rs`, `crates/protocol/src/lib.rs`.
- **Root Cause**: The engine did not enforce admission gating on incoming requests over compatibility transports. It admitted arbitrary turns without validating if the requested tools could be approved through the transport.
- **Remediation Code Diff**:
```rust
// crates/app-server/src/lib.rs
@@ -1618,6 +1645,9 @@ async fn run_bridged_turn<W: AsyncWrite + Unpin>(
     turn: BridgedTurn<'_>,
     transcript: Option<&mut TurnTranscript>,
 ) -> std::result::Result<Value, JsonRpcError> {
+// Refuse execution before turn admission if allowed_tools is not explicitly empty
+    if !matches!(turn.allowed_tools, Some([])) {
+        return Err(JsonRpcError::unsupported_interactive_execution());
+    }
```
- **Lesson**: Gate protocol requests at the transport edge. If a transport does not implement interactive callbacks, require explicit proof of non-interactivity (`allowed_tools: []`) before scheduling work.

---

### Incident 2: Bubblewrap Sandboxed Terminal SIGINT Self-Termination
- **Context**: `crates/cli/src/lib.rs`, Linux PTY Executor
- **What Was Expected**: Pressing `Ctrl-C` (`SIGINT`) in an interactive terminal session running inside a Bubblewrap container should cancel the foreground child command (e.g., `make`, `pytest`) while preserving the terminal session and sandbox container.
- **What Actually Happened**: `SIGINT` was broadcast to the entire process group, immediately killing the Bubblewrap wrapper process itself. This abruptly dropped the PTY connection and orphaned running child processes.
- **Evidence in Repo**: Commit `109d0a3f`, Files: `CHANGELOG.md`, `crates/tui/CHANGELOG.md`.
- **Root Cause**: The sandboxed PTY process was spawned without assigning a new controlling terminal inside its isolated PID namespace. Consequently, terminal line-discipline signals were delivered to the parent wrapper rather than isolated to the child process session.
- **Remediation Code Diff**:
```bash
# ExecEnv Linux launch harness execution
# - bwrap --ro-bind / / ... "$SHELL"
# + bwrap --ro-bind / / ... setsid -c "$SHELL"
```
```rust
// Linux bubblewrap launches assign the controlling terminal inside 
// the PID namespace using util-linux setsid to isolate terminal signals:
cmd.arg("setsid").arg("-c").arg(command);
```
- **Lesson**: Linux containers utilizing PTYs must invoke `setsid` inside the PID namespace to ensure terminal signals target the session leader rather than container supervisors.

---

### Incident 3: Destructive Installer Failure During Forced Reinstall
- **Context**: `scripts/release/install.sh`, `web/public/install.sh`
- **What Was Expected**: Installing or re-installing Codewhale via `curl | sh` with `CODEWHALE_FORCE_REINSTALL=1` should be atomic. If unpacking or binary verification fails, any existing installation should remain intact.
- **What Actually Happened**: The installer moved existing binaries (`codewhale`, `codew`) into temporary backup files before downloading and verifying the new release. When downloads failed or were aborted, the backup files were not restored, leaving the user with an empty `~/.local/bin`.
- **Evidence in Repo**: Commit `b63e5af3`, Files: `scripts/release/install.sh`, `web/public/install.sh`.
- **Root Cause**: Missing rollback trap handlers. Backups were performed sequentially in-place without registering an `EXIT`/`INT`/`TERM` recovery stack.
- **Remediation Code Diff**:
```bash
// web/public/install.sh
@@ -245,6 +245,15 @@ esac
 tmpdir="$(mktemp -d 2>/dev/null || mktemp -d -t codewhale-install)"
 trap 'rm -rf "$tmpdir"' EXIT INT TERM
+forced_backups="$tmpdir/.forced-backups"
+: > "$forced_backups"
+
+restore_forced_backups() {
+  while IFS= read -r backup; do
+    [ -n "$backup" ] || continue
+    [ -e "$backup" ] || continue
+    destination="$(printf '%s' "$backup" | sed 's/\.bak-[0-9TZ]*\(-[0-9][0-9]*\)\{0,1\}$//')"
+    if [ ! -e "$destination" ] && [ ! -L "$destination" ]; then
+      mv "$backup" "$destination" && echo "Restored $destination" >&2
+    fi
+  done < "$forced_backups"
+}
+trap 'restore_forced_backups; rm -rf "$tmpdir"' EXIT INT TERM
```
- **Lesson**: Destructive deployment scripts must maintain a manifest of relocated assets and bind a restoration pass to shell exit/interrupt signal traps.

---

### Incident 4: Silent Model Refresh Inconsistency from Unseeded Remote Providers
- **Context**: `crates/config/assets/provider_descriptors.json`, `scripts/catalog_models_dev.py`
- **What Was Expected**: Offline and freshly initialized installations should have access to standard models across all 52 supported providers.
- **What Actually Happened**: The model catalog contained seed information for only 23 providers. The remaining 24 remote providers had no static offline seed facts. In air-gapped or newly provisioned systems, calls to remote providers crashed or failed model resolution because the catalog was empty.
- **Evidence in Repo**: Issue `#7058`: "v0.11: Model refresh can still drift — 24 unseeded remote providers".
- **Root Cause**: The catalog update architecture relied on live network discovery without enforcing a complete compile-time offline baseline for all declared provider descriptors.
- **Remediation Code Diff**:
```python
# scripts/catalog/models_dev_seed.py
# Automated static verification enforcing 1:1 parity between declared 
# providers in provider_descriptors.json and static seed entries:
def verify_provider_seeds():
    descriptors = json.load(open("crates/config/assets/provider_descriptors.json"))
    seeds = toml.load(open("scripts/catalog/models_dev_seed.toml"))
    for p in descriptors["providers"]:
        if p["kind"] not in seeds and not p["is_loopback"]:
            raise AssertionError(f"Provider {p['kind']} has no offline seed facts!")
```
- **Lesson**: Any system implementing dynamic external catalog refreshes must maintain a statically verified offline baseline that passes 100% coverage checks in CI.

---

### Incident 5: Signal Eradication in Job Control Suspend Handler
- **Context**: `crates/tui/src/tui/ui/job_control_guard.rs`
- **What Was Expected**: Suspending the agent process with `Ctrl-Z` (`SIGTSTP`) or receiving background input (`SIGTTIN`) should allow standard job control restoration via `fg`, and output clear diagnostics.
- **What Actually Happened**: The process stopped, but shells reported `zsh: suspended (signal)` rather than `suspended (tty input)`. The application left no logs, generated no crash markers, and displayed a confusing prompt to run `codewhale --continue` (which creates a second competing process) rather than informing the user to type `fg`.
- **Evidence in Repo**: Issue `#7051`: "bug(tui): a job-control suspend leaves no receipt".
- **Root Cause**: The signal handler intercepted `SIGTSTP` and `SIGTTIN`, reset the terminal modes, and terminated by invoking `libc::raise(libc::SIGSTOP)`. Raising raw `SIGSTOP` overrode the original signal cause in the parent shell's process status table, erasing the distinction between user-requested suspension and background terminal contention.
- **Remediation Code Diff**:
```rust
// crates/tui/src/tui/ui/job_control_guard.rs
// - libc::raise(libc::SIGSTOP);
// + // Re-raise original caught signal so parent shell retains exact suspension context
// + match caught_sig {
// +     libc::SIGTSTP => {
// +         signal(libc::SIGTSTP, libc::SIG_DFL);
// +         libc::raise(libc::SIGTSTP);
// +     }
// +     libc::SIGTTIN => {
// +         signal(libc::SIGTTIN, libc::SIG_DFL);
// +         libc::raise(libc::SIGTTIN);
// +     }
// +     _ => libc::raise(libc::SIGSTOP),
// + }
```
- **Lesson**: When handling POSIX job-control signals, restore default handlers (`SIG_DFL`) and re-raise the specific intercepted signal rather than flattening them to generic `SIGSTOP`.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### Ambiguous Path Boundary Parsing
Paths with spaces and separator words (e.g., macOS screenshots containing `at`) break naive string splits.
```rust
// crates/core/src/context_reference.rs
fn attachment_path(rest: &str) -> &str {
    if looks_absolute(rest) {
        return rest;
    }
    // Hazard: splitting on the last " at " fails on "Screenshot 2026 at 9 AM at /tmp/img.png"
    // Fix: Match first occurrence of " at " that is followed by an absolute path
    rest.match_indices(" at ")
        .map(|(idx, sep)| &rest[idx + sep.len()..])
        .find(|candidate| looks_absolute(candidate))
        .or_else(|| rest.rsplit_once(" at ").map(|(_, path)| path))
        .unwrap_or(rest)
}

fn looks_absolute(path: &str) -> bool {
    let bytes = path.as_bytes();
    path.starts_with(['/', '\\', '~'])
        || (bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && matches!(bytes[2], b'\\' | b'/'))
}
```

#### Linear History Overlap Matching (Avoiding $O(N \cdot M)$ Pitfalls)
When checking if offered history matches existing persisted records, naive nested scans cause exponential slowdowns during large context synchronization. Codewhale implements a Knuth-Morris-Pratt (KMP) failure table over slice tokens:
```rust
// crates/core/src/lib.rs
pub fn persisted_overlap<T: PartialEq>(persisted: &[T], offered: &[T]) -> usize {
    if offered.is_empty() { return 0; }
    let mut failure = vec![0; offered.len()];
    for index in 1..offered.len() {
        let mut matched = failure[index - 1];
        while matched > 0 && offered[index] != offered[matched] {
            matched = failure[matched - 1];
        }
        if offered[index] == offered[matched] { matched += 1; }
        failure[index] = matched;
    }
    let mut matched = 0;
    for item in persisted {
        if matched == offered.len() { matched = failure[matched - 1]; }
        while matched > 0 && *item != offered[matched] {
            matched = failure[matched - 1];
        }
        if *item == offered[matched] { matched += 1; }
    }
    matched
}
```

---

### 2. Infinite Loop & Recursion Guards

#### UTF-8 Character Boundary Safe Truncation
When reading external context files (e.g., `AGENTS.md`) up to a hard byte cap (e.g., 100KB), truncating blindly at the byte index will panic if it falls within a multi-byte UTF-8 sequence.
```rust
// crates/core/src/fragments.rs
let mut end = INSTRUCTIONS_FILE_MAX_BYTES.min(text.len());
while end > 0 && !text.is_char_boundary(end) {
    end -= 1; // Safely back up to valid UTF-8 boundary
}
text.truncate(end);
```

#### Monotonic Recursion Budget on Subagent Spawns
To prevent autonomous agents from recursively spawning infinite subagent hierarchies:
```rust
pub struct ChildGrant {
    pub spawn: bool, // Set to false when remaining depth <= 1
}

pub fn derive_spawn_authority(current_depth: usize, max_depth: usize) -> bool {
    current_depth < max_depth
}
```

---

### 3. UI & UX Micro-Mechanics

#### Terminal Job Control & Suspension Receipt
When suspending the terminal UI, terminal states (raw mode, alternate screens) must be cleared immediately. The application must avoid race conditions where input read operations consume partial escape sequences after resume:
```rust
// Job control state machine must execute in strictly synchronized sequence:
// 1. Enter Mutex guard
// 2. Disable raw mode (cbreak -> normal)
// 3. Show cursor, leave alternate screen buffer
// 4. Reset signal disposition to SIG_DFL
// 5. Raise caught signal
// 6. On resumption: Re-enter alternate screen, enable raw mode, redraw immediately
```

---

### 4. Backend Concurrency & Memory Safety

#### Bounded History Queues to Prevent Memory Leaks
Dynamic tracking of cache prefix changes uses a fixed-capacity ring buffer (`VecDeque`) to guarantee bounded memory allocation over sessions lasting days:
```rust
// crates/core/src/prefix_cache.rs
const PREFIX_HISTORY_CAP: usize = 32;

if self.history.len() >= PREFIX_HISTORY_CAP {
    self.history.pop_front();
}
self.history.push_back(entry);
```

#### Sidecar Atomic Write Isolation
Configuration and state persistence operations must never write directly to their targets, avoiding corrupted half-written files on sudden power loss or process kill:
```rust
// crates/config/src/setup_state.rs
// Atomic persistence writes to a temporary file in the same filesystem,
// calls fsync, then renames over the target atomically via crate::persistence.
```

---

### 5. Defect & Error Prevention ("Galti Pakadna")

#### MCP Configuration Validation in Adapters
When adapting different agent standards (e.g., Anthropic Client Protocol / ACP into Codewhale), unsupported configuration options must be validated and rejected early:
```rust
// crates/tui/src/acp_server.rs
fn validate_mcp_servers(params: &Value) -> std::result::Result<(), AcpError> {
    match params.get("mcpServers") {
        None => Ok(()),
        Some(Value::Array(servers)) if servers.is_empty() => Ok(()),
        Some(Value::Array(_)) => Err(AcpError::invalid_params(
            "Client-supplied MCP servers are unsupported by Codewhale's ACP adapter. \
             Use an empty mcpServers list, or configure MCP through codewhale app-server --http."
        )),
        Some(_) => Err(AcpError::invalid_params("mcpServers must be an array")),
    }
}
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Layout**: Strict separation between core protocol types (`crates/protocol`), engine primitives (`crates/core`), execution contracts (`crates/agent-contract`), transport listeners (`crates/app-server`), and UI orchestrators (`crates/tui`).
- **State Ownership**: Single-writer principle. Only the canonical `RuntimeThreadManager` writes to the active transcript and journal. Read-only recovery instances open read-only database connections.

### 2. Core Abstractions
- **`ChildGrant`**: Complete authority projection containing `FileGrant`, `ShellGrant`, `network`, `desktop`, and `ToolSurface`.
- **`BoundedFragment`**: Context injection container enforcing hard token ceilings ($\le 10,000$ tokens) and byte caps ($40,000$ bytes) with content hashing.
- **`PrefixFingerprint`**: SHA-256 compound structure (`system_sha256:tools_sha256`) maintaining byte-exact KV cache alignment.

### 3. Error Handling
- **Categorized Fault Domains**: JSON-RPC errors map server availability faults (`-32000..-32099`, retryable) separately from protocol validation failures (`-32602`, client-side rejection).
- **Graceful Truncation**: Context ingestion errors do not drop whole files; they clamp to byte ceilings, align to character boundaries, and append informational truncation notices.

### 4. Testing
- **Multi-surface Verification**: Portable configuration and session harnesses test Linux, macOS, and Windows compatibility across discrete workspaces.
- **Contract Tests**: TypeScript integration suites (`public-installer-contract.test.ts`) assert external installer behavior against release bundles.

### 5. Security
- **Strict Capability Minimization**: Subagent roles default to minimal required permissions (e.g., `Consultant` has `ShellGrant::None`, `Scout` has `FileGrant::Read`).
- **Environment Sanitization**: Bubblewrap containers clean host environment variables before spawning tools to prevent leaking tokens or keys.

### 6. Performance
- **KMP Suffix Overlap**: Longest overlapping history suffix matching executes in $O(N + M)$ linear time instead of quadratic scan.
- **Tool Catalog Serialization Caching**: `ToolCatalogCache` hashes serialized tool JSON once, avoiding microsecond serialization penalties on every conversation turn.

### 7. Deployment
- **Multi-Stage Container Builds**: Docker builds compile via cross-compilation toolchains with architecture-specific cargo cache mounts, yielding small distribution images.
- **Atomic Self-Update Recovery**: Installers register POSIX trap routines restoring original binaries if package unpacking fails mid-run.

### 8. Agent Patterns
- **Three-Region Request Model**: Prompts partition into Immutable Prefix, Append-Only History, and Volatile Turn Content to maximize provider cache hit rates.
- **Evidence-Only Scopes**: Investigative agents run with tool scopes that prevent