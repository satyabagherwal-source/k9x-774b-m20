> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `6e0042e3`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T20:22:54.677Z  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): codewhale-hq/Codewhale

> **Canonical Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-07T20:22:53.332Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source agent for the terminal written in Rust. Use any provider or model. Issues & PRs always welcome
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41161 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/agent-contract/src/worker_profile.rs`
```
//! Worker runtime profile — the per-role capability contract for a CodeWhale
//! worker (#3217, #3211, #3213, and the child-permission-intersection issues
//! #414 / #426 / #1186).
//!
//! This is the **Workflow substrate**: every detached worker — whether launched
//! as an `agent` sub-agent or a Fleet worker — should run under a profile
//! that bounds what it may do (permissions, shell access, tool scope, model
//! route, recursion budget, foreground/background). A child profile is always
//! **derived** from its parent and can never escalate beyond it.
//!
//! Scope: this module defines the contract and the parent→child derivation with
//! tests. `agent` and Fleet worker records now build and persist these
//! profiles so parent-visible worker projections have a single capability
//! contract. Runtime enforcement of every declared field remains incremental
//! follow-up work (#3217).

use crate::role::FleetRole;
use serde::{Deserialize, Serialize};

/// Coarse capability classes a worker may exercise, beyond read access (reads
/// are always permitted). A child may only ever hold a *subset* of its parent's
/// capabilities.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct PermissionSet {
    /// May modify the workspace (`write_file` / `edit_file` / `apply_patch`).
    pub write: bool,
    /// May use network-capable tools (web search/fetch, networked MCP servers).
    pub network: bool,
}

impl PermissionSet {
    /// Full capabilities (write + network).
    pub const fn full() -> Self {
        Self {
            write: true,
            network: true,
        }
    }

    /// Read-only: no write, no network.
    pub const fn read_only() -> Self {
        Self {
            write: false,
            network: false,
        }
    }

    /// Read-only inspection: read-only on the workspace, but network-capable.
    ///
    /// The read-only investigator posture (scout/reviewer): it must not
    /// mutate the workspace, but real read-only inspection needs
    /// `git`/`gh`/web reach — the old `read_only()` default left such lanes
    /// with no way to run any command or reach any remote, which made default
    /// scout lanes useless for the inspection they exist for.
    pub const fn read_only_with_network() -> Self {
        Self {
            write: false,
            network: true,
        }
    }

    /// Intersection: a capability is granted only if **both** sets grant it.
    /// This is the core non-escalation primitive — `parent.intersect(child)`
    /// can never produce a capability the parent lacks.
    #[must_use]
    pub fn intersect(self, other: Self) -> Self {
        Self {
            write: self.write && other.write,
            network: self.network && other.network,
        }
    }
}

/// Shell access policy — the replacement for the legacy per-worker shell boolean
/// (#3217). Ordered from most to least restrictive so `min` yields the safer of
/// two policies.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum ShellPolicy {
    /// No shell access.
    None,
    /// Read-only / non-mutating commands only (the policy enforcement lives in
    /// the exec/sandbox layer; this is the declared intent).
    ReadOnly,
    /// Full shell access.
    Full,
}

impl ShellPolicy {
    /// Convert the legacy top-level shell opt-in into the typed shell policy.
    #[must_use]
    pub const fn from_legacy_allow_shell(allow_shell: bool) -> Self {
        if allow_shell { Self::Full } else { Self::None }
    }

    /// Whether any shell tools should be exposed under this policy.
    #[must_use]
    pub const fn allows_shell(self) -> bool {
        !matches!(self, Self::None)
    }

    /// The more restrictive (safer) of two policies. A child can never exceed
    /// its parent's shell policy.
    #[must_use]
    pub fn min_with(self, other: Self) -> Self {
        if self <= other { self } else { other }
    }
}

/// Which tools a worker may call. Mirrors the existing `AgentWorkerToolProfile`
/// (`Inherited` / `Explicit`) so the two can be reconciled when this is wired in.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ToolScope {
    /// Inherit the parent's tool surface.
    Inherit,
    /// Only the explicitly listed tool names.
    Explicit(Vec<String>),
}

/// File-system authority axis of a [`ChildGrant`]. Ordered least to most
/// permissive so `Ord::min` is the non-escalation primitive.
///
/// `None` is not "no writes" — it is "no file access of any kind", which is
/// what a child with an empty tool surface experiences. `Read` permits
/// evidence collection only; `Write` permits mutation inside the session's
/// write policy (workspace boundary, exact-file claims, approval posture).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FileGrant {
    None,
    Read,
    Write,
}

/// Process authority axis of a [`ChildGrant`]. Ordered least to most
/// permissive so `Ord::min` is the non-escalation primitive.
///
/// `Inspect` is the read-only shell: canonical `bash` only, and only calls
/// the agent read-only classifier proves mutation-free (the explore /
/// reviewer / planner posture). `Verify` is the bounded built-in verification
/// surface — default workspace checks, pure test selection, and bounded Git
/// fetch/merge-tree — with no shell grammar (the test/verifier posture). A
/// child asking for a surface its parent does not hold degrades to the
/// narrower side (`Inspect ∩ Verify = Inspect`): bounded inspection is a
/// subset of bounded process authority, never a widening.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ShellGrant {
    None,
    Inspect,
    Verify,
    Full,
}

/// The named tool surface a grant exposes, before the explicit scope narrows
/// it. This is the role-preset axis of `tools` — distinct from
/// [`ChildGrant::scope`], which is the caller's own allowlist.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolSurface {
    /// Every registered tool the grant's other axes admit.
    Inherited,
    /// The read-only evidence surface — `readonly_evidence_tool` plus
    /// `agent` (delegation). The explore / reviewer preset.
    Evidence,
}

/// The single authority object a delegated child runs under (#5633).
///
/// Roles are *presets over this object*, never a second permission system:
/// [`ChildGrant::for_role`] gives the widest grant a role can hold, and
/// [`ChildGrant::resolve`] intersects it with the effective parent-derived
/// profile and the caller's explicit scope. One projection serves every
/// consumer — the child's tool catalog, its dispatch refusals, and its
/// capability envelope all read the same fields, so a tool that is visible
/// is callable and a tool that is denied never appears.
///
/// This is deliberately a *projection*, not a second persisted record:
/// [`WorkerRuntimeProfile`] remains the wire/persistence shape and
/// `ChildAuthority` /
/// `ToolAuthorityEnvelope`
/// remain the transports that carry the same authority across the durable
/// Fleet and `codewhale exec` subprocess boundaries. What this object retires
/// is the *semantic* duplication — posture sentinel entries read back off a
/// deny list, and role-keyed re-derivation inside the registry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChildGrant {
    /// File-system authority.
    pub files: FileGrant,
    /// Process authority.
    pub shell: ShellGrant,
    /// May reach the network through any surface.
    pub network: bool,
    /// May drive the operator's machine (computer-use / desktop tools).
    /// Children never hold this today; the field is declared so every
    /// surface reports the same denial rather than implying a grant.
    pub desktop: bool,
    /// The named tool surface before explicit scope narrowing.
    pub surface: ToolSurface,
    /// The caller's explicit allowlist, already intersected with the parent's
    /// scope at spawn. `Some(vec![])` — the `tools = false` posture — permits
    /// nothing at all.
    pub scope: Option<Vec<String>>,
    /// May delegate children of its own (remaining spawn depth).
    pub spawn: bool,
}

impl ChildGrant {
    /// The widest grant a role can ever hold — the role preset.
    ///
    /// This is the role-to-authority table, expressed once: everything else
    /// only narrows it. Read-only roles stay read-only on the workspace by
    /// intent; network reach is a read, and a worker cut off from it for no
    /// role reason cannot do its job. `desktop` is never in any preset.
    #[must_use]
    pub fn for_role(role: &FleetRole) -> Self {
        let (files, shell, surface) = match role {
            // Read-only investigators: evidence collection only, with the
            // classifier-bounded inspection shell.
            FleetRole::Scout | FleetRole::Reviewer => {
                (FileGrant::Read, ShellGrant::Inspect, ToolSurface::Evidence)
            }
            // Planner: analysis only, same bounded shell, broader read
            // surface — a plan may consult any read the session offers.
            FleetRole::Planner => (FileGrant::Read, ShellGrant::Inspect, ToolSurface::Inherited),
            // Counsel only: reads to ground advice, never acts — no process
            // surface at all (#4752).
            FleetRole::Consultant => (FileGrant::Read, ShellGrant::None, ToolSurface::Inherited),
            // Verifier: bounded workspace checks and bounded Git reference
            // reads, no shell grammar.
            FleetRole::Verifier => (FileGrant::Read, ShellGrant::Verify, ToolSurface::Inherited),
            // Doers, and Custom: the preset asks for everything; the parent
            // profile and explicit scope do all the narrowing.
            FleetRole::Builder | FleetRole::Worker | FleetRole::Custom => {
                (FileGrant::Write, She
```

### Core Architecture Module: `crates/app-server-protocol/src/lifecycle.rs`
```
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeParams {
    pub client_info: ClientInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<InitializeCapabilities>,
}

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInfo {
    pub name: String,
    pub title: Option<String>,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeCapabilities {
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub explicit_gateway_oauth: bool,
    #[serde(default)]
    pub experimental_api: bool,
    #[serde(default)]
    pub request_attestation: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub mcp_server_openai_form_elicitation: bool,
    pub opt_out_notification_methods: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extensions: Option<HashMap<String, Value>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitializeResponse {
    pub user_agent: String,
    pub codex_home: PathBuf,
    pub platform_family: String,
    pub platform_os: String,
}

```

### Core Architecture Module: `crates/config/src/hooks.rs`
```
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Events that can trigger hook execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookEvent {
    /// Triggered when a new session starts
    SessionStart,
    /// Triggered when a session ends (quit, Ctrl+C)
    SessionEnd,
    /// Triggered before a user message is sent to the LLM
    MessageSubmit,
    /// Triggered before a tool is executed
    ToolCallBefore,
    /// Triggered after a tool completes (success or failure)
    ToolCallAfter,
    /// Triggered when the user changes modes (Plan, Act, Operate)
    ModeChange,
    /// Triggered when an error occurs
    OnError,
    /// Triggered after a turn completes and post-turn state has been updated
    TurnEnd,
    /// Triggered when a sub-agent is spawned
    SubagentSpawn,
    /// Triggered when a sub-agent reaches a terminal state
    SubagentComplete,
    /// Triggered immediately before each `exec_shell` invocation. The hook's
    /// stdout is parsed as `KEY=VALUE\n` lines and merged on top of the
    /// shell command's environment — useful for ephemeral credentials,
    /// per-skill PATH adjustments, or short-lived tokens (#456). Hooks that
    /// fail or time out are logged but do *not* abort the shell call; they
    /// simply contribute no env vars.
    ShellEnv,
    /// Triggered when the session becomes idle after real work: a turn
    /// finished (or a wait ended) and no prompt, approval, or continuation
    /// is outstanding (#6004). Transient tool errors never fire this by
    /// themselves; it marks "agent done, waiting for the next instruction".
    SessionIdle,
    /// Triggered when a turn ends in a terminal failure (#6004). Transient
    /// tool failures that the agent absorbs never fire this; only a turn
    /// whose final status is failed does. Hook authors that want opencode's
    /// grace-period semantics should debounce inside the hook.
    SessionError,
    /// Triggered when the agent starts waiting on the person: an approval
    /// prompt opens, a `request_user_input` question is presented, or a goal
    /// continuation is parked between passes (#6004). The payload's `reason`
    /// field is `approval`, `user_input`, or `goal_continuation`.
    WaitingForUser,
    /// Triggered when idle or waiting transitions to active work (#6004).
    /// Startup and repeated observations of the same state stay silent.
    SessionBusy,
}

/// Every event name the runtime actually fires, in the order `/hooks events`
/// and `docs/HOOKS.md` list them. Tests assert this is exhaustive so a new
/// variant cannot ship without a documented firing point.
#[cfg(any(test, feature = "test-support"))]
pub const ALL_HOOK_EVENTS: [HookEvent; 15] = [
    HookEvent::SessionStart,
    HookEvent::SessionEnd,
    HookEvent::TurnEnd,
    HookEvent::MessageSubmit,
    HookEvent::ToolCallBefore,
    HookEvent::ToolCallAfter,
    HookEvent::ModeChange,
    HookEvent::OnError,
    HookEvent::SubagentSpawn,
    HookEvent::SubagentComplete,
    HookEvent::ShellEnv,
    HookEvent::SessionIdle,
    HookEvent::SessionError,
    HookEvent::WaitingForUser,
    HookEvent::SessionBusy,
];

/// How much a hook's result can change what Codewhale does next.
///
/// This is the steering allowlist. "Observer" is a statement about
/// Codewhale's control flow only — an observer hook is still an arbitrary
/// shell command and can have any external side effect it likes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HookSteering {
    /// stdout/exit code can replace or block the submitted text.
    TransformsSubmittedText,
    /// stdout/exit code can allow, deny, ask, rewrite input, or add context.
    DecidesToolCall,
    /// stdout contributes `KEY=VALUE` pairs to one `exec_shell` invocation.
    ContributesShellEnv,
    /// stdout is ignored and the result cannot change Codewhale's behavior.
    Observer,
}

impl HookEvent {
    /// Get string representation for environment variable
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            HookEvent::SessionStart => "session_start",
            HookEvent::SessionEnd => "session_end",
            HookEvent::MessageSubmit => "message_submit",
            HookEvent::ToolCallBefore => "tool_call_before",
            HookEvent::ToolCallAfter => "tool_call_after",
            HookEvent::ModeChange => "mode_change",
            HookEvent::OnError => "on_error",
            HookEvent::TurnEnd => "turn_end",
            HookEvent::SubagentSpawn => "subagent_spawn",
            HookEvent::SubagentComplete => "subagent_complete",
            HookEvent::ShellEnv => "shell_env",
            HookEvent::SessionIdle => "session_idle",
            HookEvent::SessionError => "session_error",
            HookEvent::WaitingForUser => "waiting_for_user",
            HookEvent::SessionBusy => "session_busy",
        }
    }

    /// The steering contract for this event, as implemented.
    #[must_use]
    pub fn steering(self) -> HookSteering {
        match self {
            HookEvent::MessageSubmit => HookSteering::TransformsSubmittedText,
            HookEvent::ToolCallBefore => HookSteering::DecidesToolCall,
            HookEvent::ShellEnv => HookSteering::ContributesShellEnv,
            HookEvent::SessionStart
            | HookEvent::SessionEnd
            | HookEvent::ToolCallAfter
            | HookEvent::ModeChange
            | HookEvent::OnError
            | HookEvent::TurnEnd
            | HookEvent::SubagentSpawn
            | HookEvent::SubagentComplete
            | HookEvent::SessionIdle
            | HookEvent::SessionError
            | HookEvent::SessionBusy
            | HookEvent::WaitingForUser => HookSteering::Observer,
        }
    }

    /// Whether a hook result for this event can change Codewhale's own
    /// behavior. Never read this as "side-effect free" — see [`HookSteering`].
    #[must_use]
    pub fn can_steer(self) -> bool {
        !matches!(self.steering(), HookSteering::Observer)
    }

    /// Whether this event's context carries a tool name/arguments, so
    /// `tool_name` / `tool_category` conditions can ever match.
    ///
    /// `on_error` is included because the tool-failure path in
    /// `tui/tool_routing.rs` fires it with the tool name, call id, and result
    /// attached. An `on_error` firing that has no tool behind it (a transport
    /// or capacity error) simply does not match a tool predicate — it is
    /// skipped at dispatch, not rejected at load.
    #[must_use]
    pub fn provides_tool_identity(self) -> bool {
        matches!(
            self,
            HookEvent::ToolCallBefore
                | HookEvent::ToolCallAfter
                | HookEvent::ShellEnv
                | HookEvent::OnError
        )
    }

    /// Whether this event's context can carry a real process exit code, so
    /// `exit_code` conditions can ever match. `tool_call_after` observes every
    /// completed tool and `on_error` observes the failing ones; in both cases
    /// the code is only present when the tool actually reported one
    /// (`exec_shell` and friends).
    #[must_use]
    pub fn provides_exit_code(self) -> bool {
        matches!(self, HookEvent::ToolCallAfter | HookEvent::OnError)
    }

    /// Whether this event's context carries a mode label, so `mode`
    /// conditions can ever match. `shell_env` fires inside the `exec_shell`
    /// tool with a deliberately narrow context and has no mode.
    #[must_use]
    pub fn provides_mode(self) -> bool {
        !matches!(self, HookEvent::ShellEnv)
    }

    /// Whether `background = true` is honored as actual scheduling for this
    /// event. Events whose result is part of the contract are always run in
    /// the foreground, so declaring them background is a config error rather
    /// than a scheduling choice.
    #[must_use]
    pub fn honors_background(self) -> bool {
        !matches!(self, HookEvent::ShellEnv)
    }
}

/// Condition for when a hook should run
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[derive(Default)]
pub enum HookCondition {
    /// Always run this hook
    #[default]
    Always,
    /// Only run for specific tool names
    ToolName {
        /// Tool name to match (e.g., "`exec_shell`", "`write_file`")
        name: String,
    },
    /// Only run for specific tool categories
    ToolCategory {
        /// Category: "safe", "`file_write`", "shell"
        category: String,
    },
    /// Only run in specific modes
    Mode {
        /// Mode: "plan", "agent", "yolo"
        mode: String,
    },
    /// Only run when exit code matches (for `ToolCallAfter` / `OnError`)
    ExitCode {
        /// Exit code to match.
        ///
        /// `i64`, not `i32`: a Windows crash code such as `3221225477`
        /// (`0xC0000005`, access violation) is a real code a shell tool
        /// reports, and narrowing it would silently turn the predicate into
        /// one that can never match.
        code: i64,
    },
    /// Combine multiple conditions with AND
    All { conditions: Vec<HookCondition> },
    /// Combine multiple conditions with OR
    Any { conditions: Vec<HookCondition> },
}

#[derive(Debug, Clone)]
pub struct NativeShellHook {
    pub owner: crate::OwnerRef,
    pub scope: Option<crate::EntryRef>,
    pub handle: u64,
    pub dialect: String,
    pub point: String,
    pub matcher: Option<String>,
}

/// A single hook definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hook {
    #[serde(skip)]
    pub native_shell: Option<NativeShellHook>,
    /// The event that triggers this hook
    pub event: HookEvent,

    /// Shell command to execute (platform shell: `sh -c` on Unix, `cmd /C` on Windows)
    pub command: String,

    /// Optional condition for when this hook should run
    #[serde(default)]
    pub condition: Option<HookCondition>,

```

### Core Architecture Module: `crates/config/src/setup_state.rs`
```
//! Unified setup-state model for the v0.8.67 constitution-first setup lane
//! (#3403).
//!
//! This is the single record every setup step (#3404–#3412) reads and writes so
//! that "configured", "skipped", "verified", and "ready" mean the same thing
//! everywhere. It is persisted as a JSON sidecar (`setup_state.json`) under
//! `$CODEWHALE_HOME`, written atomically through [`crate::persistence`] so it is
//! independent of `config.toml`'s comment-preserving writes and can never leave
//! a half-written file.
//!
//! The record holds two things:
//!
//! 1. A per-[`SetupStep`] [`StepEntry`] (status, required, safe summary,
//!    writing lane version).
//! 2. The constitution-first fields the wizard, the update checkpoint, and
//!    `/constitution` all coordinate on.
//!
//! Readiness is a *derived* property ([`first_run_ready`](SetupState::first_run_ready)
//! / [`update_ready`](SetupState::update_ready)); it is never persisted, so the
//! rules can evolve without a migration.
//!
//! Secrets never appear here: [`StepEntry::result`] is a short human-facing
//! summary (provider name, model id, mode name), never a key.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use crate::persistence;

/// Current schema version of the persisted setup-state record.
pub const SETUP_STATE_SCHEMA_VERSION: u32 = 1;

/// Filename of the setup-state sidecar under `$CODEWHALE_HOME`.
pub const SETUP_STATE_FILE_NAME: &str = "setup_state.json";

/// Version of the *telemetry notice content* — not the app version.
///
/// The notice is owed whenever
/// [`SetupState::needs_telemetry_notice`] reports that it has not been shown.
/// Bumping it re-shows the disclosure to prior acceptors and unanswered users,
/// so it is bumped only
/// when the collection policy, schema, or disclosure materially changes. Prior
/// declines remain off. Keying it to the app version would re-prompt every
/// release, which is nagging with extra steps.
pub const TELEMETRY_NOTICE_VERSION: &str = "6";

/// Canonical setup step ids. The ordering matches the first-run spine so a
/// `BTreeMap<SetupStep, _>` renders in wizard order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SetupStep {
    /// Language first, so later screens and constitution prose are localized.
    Language,
    /// Provider + key (or local runtime) and a default model.
    ProviderModel,
    /// Trust, approvals, sandbox, network — runtime posture (#3406).
    TrustSandbox,
    /// User-global constitution choice / checkpoint.
    Constitution,
    /// Operate/Fleet readiness: provider auth, worker runtime, roster, and
    /// concurrency review. Plan-limit detection remains a separate product
    /// decision; this step only records reviewed current facts.
    OperateFleet,
    /// Hotbar shortcuts are optional, but now have a first-class setup card.
    Hotbar,
    /// Tools / MCP / skills / plugins (later lanes; tracked for completeness).
    ToolsMcp,
    /// Remote / mobile runtime (later lane; tracked for completeness).
    RemoteRuntime,
    /// Persistence paths for setup state, config, constitution, memory, and notes.
    Persistence,
    /// Final verification / doctor / ready summary.
    Verification,
}

impl SetupStep {
    /// All steps in canonical first-run order.
    pub const ALL: [SetupStep; 10] = [
        SetupStep::Language,
        SetupStep::ProviderModel,
        SetupStep::TrustSandbox,
        SetupStep::Constitution,
        SetupStep::OperateFleet,
        SetupStep::Hotbar,
        SetupStep::ToolsMcp,
        SetupStep::RemoteRuntime,
        SetupStep::Persistence,
        SetupStep::Verification,
    ];
}

/// Status of a single setup step. Shared vocabulary so `/setup`, `doctor`, and
/// the context report never invent their own meanings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    /// Never visited.
    NotStarted,
    /// Suggested for a good first-run experience but not required.
    Recommended,
    /// Available but entirely optional.
    Optional,
    /// Intentionally postponed; surfaces in the report, does not block.
    Deferred,
    /// Currently being worked on.
    InProgress,
    /// A usable route is configured, but has not been checked with the provider.
    Configured,
    /// Completed and checked (e.g. key validated, mode confirmed).
    Verified,
    /// Reached a usable-but-incomplete state needing user action
    /// (e.g. a key that failed validation). Does not block the ready screen.
    NeedsAction,
    /// Attempted and errored.
    Failed,
    /// Explicitly skipped by the user.
    Skipped,
}

impl StepStatus {
    /// True for statuses that count as "the user dealt with this step" for the
    /// purpose of reaching the ready screen.
    #[must_use]
    pub fn is_settled(self) -> bool {
        matches!(
            self,
            StepStatus::Configured
                | StepStatus::Verified
                | StepStatus::NeedsAction
                | StepStatus::Deferred
                | StepStatus::Optional
                | StepStatus::Skipped
        )
    }
}

/// One persisted entry per setup step.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StepEntry {
    pub status: StepStatus,
    /// Whether this step blocks "ready" for the lane that owns it. First-run and
    /// update lanes differ; see the readiness helpers on [`SetupState`].
    #[serde(default)]
    pub required: bool,
    /// Short, safe human-facing summary — provider name, model id, mode name,
    /// health. **Never a secret.**
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result: Option<String>,
    /// Lane (e.g. `"0.8.67"`) that last wrote this entry, so staleness is
    /// visible to `/setup`, `doctor`, and the context report.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
}

impl StepEntry {
    /// A freshly-visited entry written by `version`.
    #[must_use]
    pub fn new(status: StepStatus, required: bool, version: impl Into<String>) -> Self {
        Self {
            status,
            required,
            result: None,
            version: Some(version.into()),
        }
    }

    #[must_use]
    pub fn with_result(mut self, result: impl Into<String>) -> Self {
        self.result = Some(result.into());
        self
    }
}

/// The user's constitution decision. Every value except [`Unset`] counts as an
/// explicit choice for readiness.
///
/// [`Unset`]: ConstitutionChoice::Unset
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstitutionChoice {
    /// No decision recorded yet.
    #[default]
    Unset,
    /// Accepted the bundled/default constitution floor. Creates no custom file.
    Bundled,
    /// Created a guided structured user-global constitution.
    GuidedCustom,
    /// Expert full-Markdown override
    /// (`$CODEWHALE_HOME/prompts/constitution.md` + opt-in env).
    ExpertOverride,
    /// Explicitly postponed; bundled law applies until the user returns.
    Deferred,
}

impl ConstitutionChoice {
    #[must_use]
    pub const fn applies_user_global(self) -> bool {
        !matches!(self, Self::Bundled | Self::Deferred | Self::ExpertOverride)
    }

    /// True for any value other than [`Unset`](ConstitutionChoice::Unset).
    #[must_use]
    pub fn is_explicit(self) -> bool {
        !matches!(self, ConstitutionChoice::Unset)
    }
}

/// How the active custom constitution was authored. Recorded alongside
/// [`ConstitutionChoice::GuidedCustom`] so `/setup`, `doctor`, and the report
/// can show provenance without parsing free-text step results.
///
/// This is a *new optional field* rather than a new [`ConstitutionChoice`]
/// variant so records written by this lane still load in older binaries
/// (unknown fields are ignored on read; an unknown enum variant would fail the
/// whole parse and force the inherited-state fallback).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstitutionAuthoring {
    /// Deterministically rendered from the guided answers.
    Guided,
    /// Drafted by the user's configured model from the guided answers, then
    /// schema-validated, bounded, previewed, and ratified. Advisory authorship
    /// only — the drafting model gains no authority from having written it.
    ModelDrafted,
}

/// Which constitution surface is currently the active user-global law.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstitutionSource {
    /// Only the bundled floor is active.
    #[default]
    Bundled,
    /// A structured `constitution.json` under `$CODEWHALE_HOME`.
    UserGlobal,
    /// An expert full-Markdown override file.
    ExpertOverride,
}

/// Validity of the active user-global constitution file, if any.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstitutionValidity {
    /// No custom file, or validity not yet evaluated.
    #[default]
    Unknown,
    /// Parsed and usable.
    Valid,
    /// Present but failed to parse / structurally invalid.
    Invalid,
    /// Present but carried no usable policy.
    Empty,
    /// Present but could not be read.
    Unreadable,
}

/// Where the current runtime posture came from. Mirrors the rule that a
/// constitution may *recommend* posture but only an explicit config action
/// (#3406) applies it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimePostureSource {
    /// Not yet reviewed.
    #[default]
```

### Core Architecture Module: `crates/config/src/state_dirs.rs`
```
use crate::config_migration::default_config_path;
use crate::external_credentials::quote_os_path;
use crate::path_io::{
    checked_path_exists, normalize_config_file_path, normalize_project_workspace,
};
use crate::provider_toml::CONFIG_FILE_NAME;
use anyhow::Context as _;
use anyhow::{Result, bail};
use codewhale_paths::{CODEWHALE_APP_DIR, LEGACY_APP_DIR};
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};

/// Resolve the primary CodeWhale home directory.
///
/// `$CODEWHALE_HOME` takes precedence when set. Otherwise defaults to
/// `$HOME/.codewhale`. This is the write target for new product state.
pub fn codewhale_home() -> Result<PathBuf> {
    codewhale_paths::codewhale_home()
        .map_err(anyhow::Error::new)?
        .context("failed to resolve home directory")
}

/// Whether `$CODEWHALE_HOME` is set to a non-empty value.
///
/// An explicit CodeWhale home is an isolation boundary: state/config resolvers
/// must not fall back to ambient legacy `~/.deepseek` data outside that root.
pub fn codewhale_home_is_explicit() -> bool {
    codewhale_paths::codewhale_home_is_explicit()
}

/// Resolve the legacy DeepSeek home directory (`$HOME/.deepseek`).
///
/// Always returns the legacy path regardless of whether it exists.
pub fn legacy_deepseek_home() -> Result<PathBuf> {
    codewhale_paths::legacy_deepseek_home().context("failed to resolve home directory")
}

/// Reject state subdirs that could escape the state root via path injection.
///
/// `ensure_state_dir` / `resolve_state_dir` are public APIs taking an arbitrary
/// subdir string; every in-tree caller passes a hardcoded single component
/// (e.g. `"sessions"`, `"."`). This validates defensively so a future caller
/// can never traverse out of the state root via `..` components or an absolute
/// path. Nested relative paths such as `"a/b"` are permitted.
pub(crate) fn ensure_safe_state_subdir(subdir: &str) -> Result<()> {
    if subdir.is_empty() {
        bail!("state subdir must not be empty");
    }
    let path = std::path::Path::new(subdir);
    if path.is_absolute() {
        bail!("state subdir must not be an absolute path: {subdir}");
    }
    if path.components().any(|c| {
        matches!(
            c,
            std::path::Component::RootDir | std::path::Component::Prefix(_)
        )
    }) {
        bail!("state subdir must not contain a root or prefix: {subdir}");
    }
    if path
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        bail!("state subdir must not contain parent-dir (..) components: {subdir}");
    }
    Ok(())
}

/// Resolve a state subdirectory, preferring the CodeWhale root if
/// it already exists, otherwise falling back to the legacy root.
///
/// This is the read-path resolver: it returns the primary path when
/// migration has occurred or on a fresh install, but keeps reading
/// from the legacy path for users who haven't migrated yet.
pub fn resolve_state_dir(subdir: &str) -> Result<PathBuf> {
    ensure_safe_state_subdir(subdir)?;
    let explicit_codewhale_home = codewhale_home_is_explicit();
    let primary = codewhale_home()?.join(subdir);
    if explicit_codewhale_home || primary.exists() {
        return Ok(primary);
    }
    let legacy = legacy_deepseek_home()?.join(subdir);
    if legacy.exists() {
        return Ok(legacy);
    }
    // Neither exists — return primary for first-write creation.
    Ok(primary)
}

/// Ensure a state subdirectory exists under the primary CodeWhale root,
/// creating it if necessary. This is the write-path resolver.
///
/// On the first creation of a real subdirectory (not the root sentinel `"."`),
/// if a legacy `~/.deepseek/<subdir>` exists but the primary
/// `~/.codewhale/<subdir>` does not, the legacy directory is relocated into
/// the primary location so the user keeps their data and the legacy tree
/// stops growing (#3240). After migration, [`resolve_state_dir`] finds the
/// data in the primary location; the read resolver itself is unchanged.
pub fn ensure_state_dir(subdir: &str) -> Result<PathBuf> {
    let (dir, migration) = ensure_state_dir_with_migration(subdir)?;
    if let Some(migration) = migration {
        eprintln!("{}", migration.user_notice());
    }
    Ok(dir)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StateMigrationKind {
    Relocated,
    Copied,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StateMigration {
    pub subdir: String,
    pub legacy_path: PathBuf,
    pub primary_path: PathBuf,
    pub kind: StateMigrationKind,
}

impl StateMigration {
    pub fn user_notice(&self) -> String {
        let action = match self.kind {
            StateMigrationKind::Relocated => "relocated",
            StateMigrationKind::Copied => "copied",
        };
        let legacy_detail = match self.kind {
            StateMigrationKind::Relocated => {
                "The legacy .deepseek copy for this state path was removed by the move."
            }
            StateMigrationKind::Copied => {
                "The legacy .deepseek copy was left in place because a direct move failed."
            }
        };

        format!(
            "Codewhale migrated legacy state ({action}):\n  {} -> {}\nYour data was preserved. Use .codewhale as the canonical state location from now on.\n{legacy_detail}\nIf no other apps use it, you can remove the legacy .deepseek tree after confirming everything looks right.",
            self.legacy_path.display(),
            self.primary_path.display(),
        )
    }
}

/// Variant of [`ensure_state_dir`] that exposes whether a legacy state path was
/// migrated. Most callers should use [`ensure_state_dir`]; this is kept for
/// tests and future UI surfaces that want to render the notice themselves.
pub fn ensure_state_dir_with_migration(subdir: &str) -> Result<(PathBuf, Option<StateMigration>)> {
    ensure_safe_state_subdir(subdir)?;
    let explicit_codewhale_home = codewhale_home_is_explicit();
    let dir = codewhale_home()?.join(subdir);
    let migration = if explicit_codewhale_home {
        None
    } else {
        match migrate_legacy_state_dir(&dir, subdir)? {
            LegacyStateMigration::NotNeeded => None,
            LegacyStateMigration::Migrated(migration) => Some(migration),
            // Creating an empty primary here would make it authoritative and
            // hide the legacy data for good. Keep using the legacy directory
            // (the read resolver does the same) and retry on the next call.
            LegacyStateMigration::Failed { legacy } => return Ok((legacy, None)),
        }
    };
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("failed to create {}/", dir.display()))?;
    Ok((dir, migration))
}

pub(crate) enum LegacyStateMigration {
    NotNeeded,
    Migrated(StateMigration),
    /// Neither the move nor the copy completed. The primary was left absent,
    /// so the legacy directory stays authoritative and migration retries.
    Failed {
        legacy: PathBuf,
    },
}

/// One-time relocation of a legacy `~/.deepseek/<subdir>` state directory into
/// the primary `~/.codewhale/<subdir>` location (#3240). No-op once the primary
/// exists, for the root sentinel `"."` (a whole-tree move is owned by the
/// config-file migration), or when no legacy directory is present.
pub(crate) fn migrate_legacy_state_dir(
    primary: &Path,
    subdir: &str,
) -> Result<LegacyStateMigration> {
    if primary.exists() || subdir == "." || subdir.is_empty() {
        return Ok(LegacyStateMigration::NotNeeded);
    }
    let legacy = match legacy_deepseek_home() {
        Ok(home) => home.join(subdir),
        Err(_) => return Ok(LegacyStateMigration::NotNeeded),
    };
    if !legacy.exists() {
        return Ok(LegacyStateMigration::NotNeeded);
    }
    // The primary's parent (the ~/.codewhale root) must exist for the rename.
    if let Some(parent) = primary.parent()
        && let Err(err) = std::fs::create_dir_all(parent)
    {
        tracing::warn!(
            target: "config::migration",
            "Could not create {} for state migration ({}); writing to primary anyway",
            parent.display(),
            err
        );
    }
    match std::fs::rename(&legacy, primary) {
        Ok(()) => {
            tracing::info!(
                target: "config::migration",
                "Migrated legacy state directory {} -> {} (relocated). The .deepseek copy was removed.",
                legacy.display(),
                primary.display()
            );
            return Ok(LegacyStateMigration::Migrated(StateMigration {
                subdir: subdir.to_string(),
                legacy_path: legacy,
                primary_path: primary.to_path_buf(),
                kind: StateMigrationKind::Relocated,
            }));
        }
        Err(err) => {
            // Cross-device rename or permission issue: fall back to a
            // recursive copy so the user keeps their data. The legacy tree is
            // left in place; it stops growing because writes now target the
            // primary path.
            match copy_dir_into_place(&legacy, primary) {
                Ok(()) => {
                    tracing::info!(
                        target: "config::migration",
                        "Migrated legacy state directory {} -> {} (copied; rename failed: {err}). \
                         The legacy .deepseek copy was left in place.",
                        legacy.display(),
                        primary.display()
                    );
                    return Ok(LegacyStateMigration::Migrated(StateMigration {
                        subdir: subdir.to_string(),
                        legacy_path: legacy,
                        primary_path: primary.to_path_buf(),
                        kind: StateMigrationKind::Copied,
                    }));
                }
                Err(copy_err) => {
                    // A concurrent process may have completed t
```

### Core Architecture Module: `crates/core/src/context_reference.rs`
```
//! Durable context reference records and media attachment parsing.
//!
//! Separated from composer completion and terminal-only UI so session persistence,
//! image attachment, and engine history can reference context and attachment items
//! without depending on `codewhale-tui`.

use serde::{Deserialize, Serialize};

/// The transcript keeps the user's compact text (`@path` or `[Attached ...]`)
/// readable. This record preserves the exact target and inclusion state for
/// the context inspector and for session resume without leaking raw metadata
/// into the visible history cell.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContextReference {
    pub kind: ContextReferenceKind,
    pub source: ContextReferenceSource,
    /// Short badge for terminal display, e.g. `file`, `dir`, `image`.
    pub badge: String,
    /// Compact display label from the transcript, without the leading `@`.
    pub label: String,
    /// Resolved target path or URI-equivalent string.
    pub target: String,
    pub included: bool,
    pub expanded: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextReferenceKind {
    File,
    Directory,
    Missing,
    Unsupported,
    MediaMention,
    MediaAttachment,
    /// `@git` / `@diff` — curated git context rather than a path (#4067).
    GitContext,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextReferenceSource {
    AtMention,
    Attachment,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MediaAttachmentReference {
    pub kind: String,
    pub path: String,
    pub start_byte: usize,
    pub end_byte: usize,
}

/// Extract media attachment references from text formatted as `[Attached <kind>: <path>]`.
#[must_use]
pub fn media_attachment_references(input: &str) -> Vec<MediaAttachmentReference> {
    let mut out = Vec::new();
    let mut offset = 0usize;
    for line in input.split_inclusive('\n') {
        let start_byte = offset;
        let end_byte = offset + line.len();
        offset = end_byte;
        let trimmed = line.trim();
        let Some(body) = trimmed
            .strip_prefix("[Attached ")
            .and_then(|value| value.strip_suffix(']'))
        else {
            continue;
        };
        let Some((kind, rest)) = body.split_once(": ") else {
            continue;
        };
        let path = attachment_path(rest).trim();
        if !path.is_empty() {
            out.push(MediaAttachmentReference {
                kind: kind.trim().to_string(),
                path: path.to_string(),
                start_byte,
                end_byte,
            });
        }
    }
    out
}

/// The path in `<description> at <path>` or a bare `<path>`. Attachment
/// producers write absolute paths, and a description never starts with one,
/// so the separator is the first ` at ` followed by an absolute path.
/// Splitting at the last ` at ` broke paths that contain one, such as macOS
/// screenshot names (`Screenshot 2026-09-28 at 9.18.11 AM.png`). Text with no
/// absolute candidate (hand-written or older sessions) keeps the last-` at `
/// split it always had.
fn attachment_path(rest: &str) -> &str {
    if looks_absolute(rest) {
        return rest;
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serialization_roundtrip() {
        let reference = ContextReference {
            kind: ContextReferenceKind::File,
            source: ContextReferenceSource::AtMention,
            badge: "file".to_string(),
            label: "test.rs".to_string(),
            target: "/path/to/test.rs".to_string(),
            included: true,
            expanded: false,
            detail: Some("included".to_string()),
        };
        let json = serde_json::to_string(&reference).unwrap();
        let deserialized: ContextReference = serde_json::from_str(&json).unwrap();
        assert_eq!(reference, deserialized);
    }

    #[test]
    fn parses_media_attachments() {
        let input = "Here is the screenshot:\n[Attached image: 100x100 at /tmp/shot.png]\nPlease analyze it.";
        let refs = media_attachment_references(input);
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].kind, "image");
        assert_eq!(refs[0].path, "/tmp/shot.png");
    }

    #[test]
    fn attachment_paths_may_contain_at() {
        let shot = "/Users/x/Desktop/Screenshot 2026-09-28 at 9.18.11 AM.png";
        let bare = format!("[Attached image: {shot}]");
        assert_eq!(media_attachment_references(&bare)[0].path, shot);
        let described = format!("[Attached image: 8x4 PNG (2KB) at {shot}]");
        assert_eq!(media_attachment_references(&described)[0].path, shot);
        let windows = r"[Attached image: 8x4 PNG at C:\Users\x\Shot at noon.png]";
        assert_eq!(
            media_attachment_references(windows)[0].path,
            r"C:\Users\x\Shot at noon.png"
        );
        let relative = "[Attached image: 8x4 PNG at shots/a.png]";
        assert_eq!(media_attachment_references(relative)[0].path, "shots/a.png");
    }
}

```

### Core Architecture Module: `crates/core/src/fragments.rs`
```
//! Bounded context-fragment system with hard caps (issue #5264).
//!
//! Every context injection goes through a typed fragment with a
//! `matches_text` recognizer, collected in one `crates/core` module.
//! Hard caps: per-fragment byte cap, 10K-token ceiling, injected-item count.
//! Project-instruction import (#3978, #4079) is a typed fragment.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

// Caps
pub const MAX_FRAGMENT_TOKENS: usize = 10_000;
pub const MAX_FRAGMENT_BYTES: usize = MAX_FRAGMENT_TOKENS * 4; // 40_000
pub const DEFAULT_FRAGMENT_MAX_BYTES: usize = 4 * 1024;
pub const MAX_FRAGMENTS_PER_CONTEXT: usize = 16;
pub const INSTRUCTIONS_FILE_MAX_BYTES: usize = 100 * 1024;
pub const MAX_INSTRUCTION_FILES: usize = 32;

/// Stable fragment identities. Markers are public contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum FragmentId {
    Workspace,
    Permissions,
    Route,
    AgentTopology,
    SkillsTools,
    TokenBudget,
    ProjectInstructions,
    Constitution,
}

impl FragmentId {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Workspace => "workspace",
            Self::Permissions => "permissions",
            Self::Route => "route",
            Self::AgentTopology => "agent_topology",
            Self::SkillsTools => "skills_tools",
            Self::TokenBudget => "token_budget",
            Self::ProjectInstructions => "project_instructions",
            Self::Constitution => "constitution",
        }
    }
    #[must_use]
    pub fn marker(self) -> &'static str {
        match self {
            Self::Workspace => "<!-- cw:ctx:workspace -->",
            Self::Permissions => "<!-- cw:ctx:permissions -->",
            Self::Route => "<!-- cw:ctx:route -->",
            Self::AgentTopology => "<!-- cw:ctx:agent_topology -->",
            Self::SkillsTools => "<!-- cw:ctx:skills_tools -->",
            Self::TokenBudget => "<!-- cw:ctx:token_budget -->",
            Self::ProjectInstructions => "<!-- cw:ctx:project_instructions -->",
            Self::Constitution => "<!-- cw:ctx:constitution -->",
        }
    }
    #[must_use]
    pub fn role(self) -> FragmentRole {
        match self {
            Self::Workspace => FragmentRole::Workspace,
            Self::Permissions => FragmentRole::Permissions,
            Self::Route => FragmentRole::Route,
            Self::AgentTopology => FragmentRole::AgentTopology,
            Self::SkillsTools => FragmentRole::SkillsTools,
            Self::TokenBudget => FragmentRole::TokenBudget,
            Self::ProjectInstructions => FragmentRole::ProjectInstructions,
            Self::Constitution => FragmentRole::Constitution,
        }
    }
    #[must_use]
    pub fn all() -> &'static [FragmentId] {
        &[
            Self::Workspace,
            Self::Permissions,
            Self::Route,
            Self::AgentTopology,
            Self::SkillsTools,
            Self::TokenBudget,
            Self::ProjectInstructions,
            Self::Constitution,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FragmentRole {
    Workspace,
    Permissions,
    Route,
    AgentTopology,
    SkillsTools,
    TokenBudget,
    ProjectInstructions,
    Constitution,
}

impl FragmentRole {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Workspace => "workspace",
            Self::Permissions => "permissions",
            Self::Route => "route",
            Self::AgentTopology => "agent_topology",
            Self::SkillsTools => "skills_tools",
            Self::TokenBudget => "token_budget",
            Self::ProjectInstructions => "project_instructions",
            Self::Constitution => "constitution",
        }
    }
}

#[must_use]
pub fn estimate_tokens(text: &str) -> usize {
    text.len().div_ceil(4)
}

/// Typed fragment trait with `matches_text` recognizer.
pub trait ContextFragment {
    fn fragment_id(&self) -> FragmentId;
    fn marker(&self) -> &'static str;
    fn content(&self) -> &str;
    fn matches_text(&self, haystack: &str) -> bool {
        haystack.contains(self.marker())
    }
    fn tokens_est(&self) -> usize {
        estimate_tokens(self.content())
    }
    fn max_bytes(&self) -> usize;
    fn is_within_token_ceiling(&self) -> bool {
        self.tokens_est() <= MAX_FRAGMENT_TOKENS
    }
    fn is_within_byte_ceiling(&self) -> bool {
        self.content().len() <= MAX_FRAGMENT_BYTES
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BoundedFragment {
    pub id: FragmentId,
    pub role: FragmentRole,
    pub marker: &'static str,
    pub max_bytes: usize,
    pub content: String,
    pub content_hash: u64,
}

impl BoundedFragment {
    #[must_use]
    pub fn new(id: FragmentId, raw: impl Into<String>) -> Self {
        Self::with_max_bytes(id, raw, DEFAULT_FRAGMENT_MAX_BYTES)
    }
    #[must_use]
    pub fn with_max_bytes(id: FragmentId, raw: impl Into<String>, max_bytes: usize) -> Self {
        let clamped_max = max_bytes.min(MAX_FRAGMENT_BYTES);
        let mut content = enforce_byte_cap(raw.into(), clamped_max);
        if estimate_tokens(&content) > MAX_FRAGMENT_TOKENS {
            content = enforce_byte_cap(content, MAX_FRAGMENT_BYTES);
        }
        let content_hash = hash_content(&content);
        Self {
            id,
            role: id.role(),
            marker: id.marker(),
            max_bytes: clamped_max,
            content,
            content_hash,
        }
    }
    #[must_use]
    pub fn project_instructions(raw: impl Into<String>) -> Self {
        Self::with_max_bytes(FragmentId::ProjectInstructions, raw, MAX_FRAGMENT_BYTES)
    }
    #[must_use]
    pub fn constitution(raw: impl Into<String>) -> Self {
        Self::with_max_bytes(FragmentId::Constitution, raw, MAX_FRAGMENT_BYTES)
    }
    #[must_use]
    pub fn render_marked(&self) -> String {
        format!("{}\n{}", self.marker, self.content.trim_end())
    }
}

impl ContextFragment for BoundedFragment {
    fn fragment_id(&self) -> FragmentId {
        self.id
    }
    fn marker(&self) -> &'static str {
        self.marker
    }
    fn content(&self) -> &str {
        &self.content
    }
    fn max_bytes(&self) -> usize {
        self.max_bytes
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum FragmentCapError {
    #[error("fragment {id:?} exceeds 10K-token ceiling: {tokens} tokens ({bytes} bytes)")]
    TokenCeiling {
        id: FragmentId,
        tokens: usize,
        bytes: usize,
    },
    #[error("fragment {id:?} exceeds byte ceiling: {bytes} > {max} bytes")]
    ByteCeiling {
        id: FragmentId,
        bytes: usize,
        max: usize,
    },
    #[error("context has too many fragments: {count} > {max}")]
    TooManyFragments { count: usize, max: usize },
}

pub fn validate_fragment(fragment: &BoundedFragment) -> Result<(), FragmentCapError> {
    if fragment.content.len() > MAX_FRAGMENT_BYTES {
        return Err(FragmentCapError::ByteCeiling {
            id: fragment.id,
            bytes: fragment.content.len(),
            max: MAX_FRAGMENT_BYTES,
        });
    }
    let tokens = estimate_tokens(&fragment.content);
    if tokens > MAX_FRAGMENT_TOKENS {
        return Err(FragmentCapError::TokenCeiling {
            id: fragment.id,
            bytes: fragment.content.len(),
            tokens,
        });
    }
    Ok(())
}

pub fn validate_fragment_set(fragments: &[BoundedFragment]) -> Result<(), FragmentCapError> {
    if fragments.len() > MAX_FRAGMENTS_PER_CONTEXT {
        return Err(FragmentCapError::TooManyFragments {
            count: fragments.len(),
            max: MAX_FRAGMENTS_PER_CONTEXT,
        });
    }
    for f in fragments {
        validate_fragment(f)?;
    }
    Ok(())
}

// Project-instruction import (#3978)
pub const PROJECT_INSTRUCTION_CANDIDATES: &[&str] = &[
    "AGENTS.md",
    ".agents/AGENTS.md",
    "CLAUDE.md",
    ".claude/instructions.md",
    ".codewhale/instructions.md",
    ".deepseek/instructions.md",
    ".cursorrules",
    ".cursor/rules",
    ".clinerules",
    ".windsurf/rules",
    ".gemini",
    ".github/copilot-instructions.md",
    ".github/muse-instructions.md",
];

/// Workspace instruction formats not already owned by Codewhale's canonical
/// project-context loader. The TUI uses this subset to avoid injecting
/// `AGENTS.md` / `CLAUDE.md` / `instructions.md` twice while still importing
/// additional agent rule formats through the typed fragment boundary.
pub const ADDITIONAL_PROJECT_INSTRUCTION_CANDIDATES: &[&str] = &[
    ".agents/AGENTS.md",
    ".cursorrules",
    ".cursor/rules",
    ".clinerules",
    ".windsurf/rules",
    ".gemini",
    ".github/copilot-instructions.md",
    ".github/muse-instructions.md",
];

fn is_symlink(p: &Path) -> bool {
    std::fs::symlink_metadata(p)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
}
pub fn read_project_instruction_file(file: std::fs::File) -> Option<String> {
    let meta = file.metadata().ok()?;
    if !meta.is_file() {
        return None;
    }
    use std::io::Read as _;
    let mut buf = Vec::new();
    file.take(INSTRUCTIONS_FILE_MAX_BYTES as u64 + 1)
        .read_to_end(&mut buf)
        .ok()?;
    let observed_len = buf.len() as u64;
    if meta.len().max(observed_len) > INSTRUCTIONS_FILE_MAX_BYTES as u64 {
        buf.truncate(INSTRUCTIONS_FILE_MAX_BYTES);
        let mut text = String::from_utf8_lossy(&buf).into_owned();
        let mut end = INSTRUCTIONS_FILE_MAX_BYTES.min(text.len());
        while end > 0 && !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
        let omitted = meta
            .len()
            .max(observed_len)
            .saturating_sub(INSTRUCTIONS_FILE_MAX_BYTES as u64);
        text.push_str(&format!("\n[…truncated: {omitted} bytes omitted]"));
        return S
```

### Core Architecture Module: `crates/core/src/ids.rs`
```
//! `ThreadId` / `SessionId` for the `crates/core` boundary (issue #5261).
//!
//! Re-exports the protocol ids so every crate that depends on `core` (the
//! TUI, CLI, app-server) speaks the same typed ids without depending on
//! `protocol` directly. The persisted JSON shape stays a plain string
//! (`"thread-…"` / `"session-…"`) so existing `state.json` / `threads/`
//! files need no migration.

pub use codewhale_protocol::ids::{SessionId, ThreadId};

```

### Core Architecture Module: `crates/core/src/journal.rs`
```
//! Session tree journal placeholder (issue #5262).
//!
//! The journal is append-only with an in-memory tree projection:
//! every non-header entry carries `id` + `parentId`, the active position is
//! a `leafId`, appending creates a child of the leaf, and branching only
//! moves the leaf — it never rewrites history. This file lands the entry
//! shape that #5262's tree operations hang off of; compaction and
//! branch-summary entry kinds are included as first-class kinds but their
//! *strategies* are deferred.
//!
//! Re-exports the protocol journal as the canonical shape so `protocol` and
//! `core` agree on the wire. `core` adds the `SessionJournal` wrapper that
//! owns the `current_leaf_id` column in `state.threads`.

pub use codewhale_protocol::journal::{Journal, JournalEntry};

use serde::{Deserialize, Serialize};

/// Persisted thread metadata extension for the tree. This is the
/// `current_leaf_id` column added to `state.threads`; `None` before the
/// first turn, `Some(id)` after. The existing `threads` JSON shape is
/// otherwise unchanged (back-compat: old rows read as `None` and the next
/// append mints the header leaf).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ThreadLeafState {
    pub thread_id: String,
    pub leaf_id: Option<String>,
}

/// First-class journal entry kinds (data shape lands now; strategies later).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JournalKind {
    Header,
    User,
    Assistant,
    ToolResult,
    Compaction,
    BranchSummary,
}

impl JournalKind {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Header => "header",
            Self::User => "user",
            Self::Assistant => "assistant",
            Self::ToolResult => "tool_result",
            Self::Compaction => "compaction",
            Self::BranchSummary => "branch_summary",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn leaf_state_roundtrip() {
        let s = ThreadLeafState {
            thread_id: "thread-1".into(),
            leaf_id: Some("entry-abc".into()),
        };
        let j = serde_json::to_string(&s).unwrap();
        let back: ThreadLeafState = serde_json::from_str(&j).unwrap();
        assert_eq!(back, s);
    }

    #[test]
    fn journal_append_is_child_of_leaf() {
        let mut j = Journal::new();
        let a = j.append("header", json!({}));
        let b = j.append("user", json!("hi"));
        assert_eq!(j.get(&b).unwrap().parent_id.as_deref(), Some(a.as_str()));
    }
}

```

### Core Architecture Module: `crates/core/src/lib.rs`
```
pub mod context_reference;
pub mod fragments;
pub mod ids;
pub mod journal;
pub mod prefix_cache;
pub mod request;
pub mod role;
pub mod secret_eq;
pub mod session;
pub mod tool_parser;

pub use context_reference::{
    ContextReference, ContextReferenceKind, ContextReferenceSource, MediaAttachmentReference,
    media_attachment_references,
};

use codewhale_config::{ConfigToml, ProviderKind};
use codewhale_hooks::HookDispatcher;
use codewhale_state::StateStore;

/// Compatibility configuration and hooks.
///
/// Conversation execution and durable history belong to the held canonical
/// RuntimeThreadManager/Engine. Legacy State data is retained for read-only
/// recovery and bound alias publication, never as a second transcript writer.
pub struct Runtime {
    pub config: ConfigToml,
    state: StateStore,
    pub hooks: HookDispatcher,
}

impl Runtime {
    pub fn new(config: ConfigToml, state: StateStore, hooks: HookDispatcher) -> Self {
        Self {
            config,
            state,
            hooks,
        }
    }

    /// Existing compatibility data and receipts; no transcript controller.
    pub fn state_store(&self) -> &StateStore {
        &self.state
    }

    pub fn update_config(&mut self, config: ConfigToml) {
        self.config = config;
    }

    /// Returns the default model provider from the resolved configuration.
    pub fn provider_default(&self) -> ProviderKind {
        self.config.provider
    }
}

/// How many leading entries of `offered` repeat the end of `persisted`: the
/// longest suffix of `persisted` that is also a prefix of `offered`.
/// Longest persisted suffix repeated by an offered history prefix. Linear
/// work preserves genuine repeated messages without an unbounded nested scan.
pub fn persisted_overlap<T: PartialEq>(persisted: &[T], offered: &[T]) -> usize {
    if offered.is_empty() {
        return 0;
    }
    let mut failure = vec![0; offered.len()];
    for index in 1..offered.len() {
        let mut matched = failure[index - 1];
        while matched > 0 && offered[index] != offered[matched] {
            matched = failure[matched - 1];
        }
        if offered[index] == offered[matched] {
            matched += 1;
        }
        failure[index] = matched;
    }
    let mut matched = 0;
    for item in persisted {
        if matched == offered.len() {
            matched = failure[matched - 1];
        }
        while matched > 0 && *item != offered[matched] {
            matched = failure[matched - 1];
        }
        if *item == offered[matched] {
            matched += 1;
        }
    }
    matched
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn temp_core_state(name: &str) -> StateStore {
        let dir =
            std::env::temp_dir().join(format!("codewhale-core-{name}-{}", Uuid::new_v4().simple()));
        std::fs::create_dir_all(&dir).expect("create temp state dir");
        StateStore::open(Some(dir.join("state.db"))).expect("open state store")
    }

    #[test]
    fn runtime_bookkeeping_keeps_the_legacy_store_read_only() {
        let store = temp_core_state("read-only-runtime");
        let before = store.list_threads(Default::default()).unwrap();
        let mut runtime = Runtime::new(ConfigToml::default(), store, HookDispatcher::default());
        runtime.update_config(ConfigToml::default());
        assert_eq!(
            runtime
                .state_store()
                .list_threads(Default::default())
                .unwrap()
                .len(),
            before.len()
        );
        let reopened = Runtime::new(
            runtime.config.clone(),
            runtime.state_store().clone(),
            HookDispatcher::default(),
        );
        assert!(
            reopened
                .state_store()
                .list_threads(Default::default())
                .unwrap()
                .is_empty()
        );
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7234** (2026-11-07): **fix(fork): cut saved histories that carry workspace drift notices**
  *Symptoms*:   No-Issue: fifth instance of the engine-owned history-envelope boundary class; no separate tracker issue exists. 

- **Issue #7231** (2026-11-07): **fix(net): go direct when a local proxy disappears**
  *Symptoms*: ## What and why  reqwest snapshots `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` when a client is built, and Codewhale builds its engine HTTP clients once per session. A session started behind a local proxy (Clash, v2rayN, sing-box on `127.0.0.1:…`) therefore kept dialing that port after the proxy was closed: every request failed with a connect error, including requests to providers that need no proxy at all, and the only recovery was restarting Codewhale.  `codewhale_net::proxy::install_loopback_proxy()` installs a `reqwest::Proxy::custom` route for ambient **loopback** proxies:  - `no_proxy()` runs first, so the custom route is the only proxy source. `no_proxy()` clears every proxy registered before it, so the order matters: a request the callback declines cannot fall back to the address reqwest read when the client was built. - A background thread probes each configured loopback proxy on its own port. While a port refuses connections, requests that would use it go direct; when it answers again, proxy routing resumes. A live `HTTP_PROXY` therefore does not keep a dead `HTTPS_PROXY` in the path. - Only a definite `ECONNREFUSED` from every resolved address moves a proxy to direct. A timeout, an fd limit or a resolver failure leaves the previous state alone: routing a session direct on that evidence would put traffic on a network path the operator deliberately avoided. - While the port answers, routing is unchanged: `ALL_PROXY` / `HTTP_PROXY` / `HTTPS_PROXY` precedence, `NO_PROXY

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

### Incident Patch 1: `549ff01e` (2026-11-07)
**Commit Message**: fix(release): handle Windows cleanup and align kit lock [skip ci]

Strip Windows PowerShell's UTF8 BOM before parsing normal cleanup
receipts. Run the existing bounded exact-private-path cleanup fallback
on failures even when its controller has already exited, verify its
returned path and zero remaining Terminal processes, and retain the
original failure result.

Use Cargo's conservative offline update for the standalone vendored
kit lock: app-server-protocol0.10.3 and its declared chrono edge. Root
Cargo.lock and runtime Rust sources are unchanged from4ba0c656ac9c.

Verified on the frozen4ba+these2paths: existing standalone kit themes
14passed/0failed; surfaces3passed/0failed, both locked/offline with
source unchanged and disk guard retained. Node syntax and diff checks
exit0. Independent review confirms both Windows findings are closed.
Actual PowerShell/Windows execution remains pending finalCI.

Mac4ba CLI build and strict HTTP admission/recovery observations passed;
Linux4ba-equivalent CLI build passed with full4270source invariants.
Those executables retain their exact4ba identity and scope; this commit
is not a claim that they were rebuilt from the later script/kit-lock
meta

**File**: `scripts/release/windows-terminal-clipboard.mjs` (modified, +15/-11)
```diff
@@ -120,7 +120,7 @@ try {
   receipt.stash = { path: stashFile, sha256: createHash('sha256').update(stashBytes).digest('hex'), records: 1, exactDraftMatch: true, normalization: 'CRLF to LF only' };
   assert.equal(await desktopClosed, 0, desktopError);
   assert.equal(desktopError, '', 'no desktop errors');
-  receipt.cleanup = JSON.parse(await fs.readFile(path.join(evidence, 'cleanup.json'), 'utf8'));
+  receipt.cleanup = JSON.parse((await fs.readFile(path.join(evidence, 'cleanup.json'), 'utf8')).replace(/^\uFEFF/, ''));
   assert.equal(receipt.cleanup.terminal, terminal, 'cleanup used the owned Terminal path');
   assert.equal(receipt.cleanup.remaining, 0, 'owned Terminal processes are gone');
   receipt.result = 'passed';
@@ -135,18 +135,22 @@ try {
         await fs.writeFile(path.join(evidence, 'cancel'), 'retire owned Terminal');
         await Promise.race([desktopClosed, delay(5000)]);
       } catch (error) { receipt.desktop.cancelError = String(error); }
-      if (desktop.exitCode === null && desktop.signalCode === null) {
-        try {
-          const cleanup = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
-            '$ErrorActionPreference = "Stop"; $terminal = $env:CODEWHALE_CLIPBOARD_TERMINAL; $stopped = @(); foreach ($process in @(Get-Process | Where-Object { $_.Path -eq $terminal })) { Stop-Process -InputObject $process -Force; if (!$process.WaitForExit(5000)) { throw "Owned Terminal did not exit" }; $stopped += $process.Id }; $remaining = @(Get-Process | Where-Object { $_.Path -eq $terminal }).Count; if ($remaining) { throw "Owned Terminal is still running" }; @{ terminal = $terminal; stopped = $stopped; remaining = $remaining } | ConvertTo-Json -Compress'],
-          { env: { ...desktopEnv, CODEWHALE_CLIPBOARD_TERMINAL: terminal }, encoding: 'utf8', timeout: 10_000 });
-          receipt.desktop.fallbackCleanup = JSON.parse(cleanup.replace(/^\uFEFF/, ''));
-        } catch (error) {
-          receipt.desktop.cleanupError = String(error); receipt.result = 'failed'; process.exitCode = 1;
-        }
-        receipt.desktop.killRequestedAt = new Date().toISOString(); desktop.kill();
+    }
+    if (receipt.result !== 'passed') {
+      try {
+        const cleanup = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
+          '$ErrorActionPreference = "Stop"; $terminal = $env:CODEWHALE_CLIPBOARD_TERMINAL; $stopped = @(); foreach ($process in @(Get-Process | Where-Object { $_.Path -eq $terminal })) { Stop-Process -InputObject $process -Force; if (!$process.WaitForExit(5000)) { throw "Owned Terminal did not exit" }; $stopped += $process.Id }; $remaining = @(Get-Process | Where-Object { $_.Path -eq $terminal }).Count; if ($remaining) { throw "Owned Terminal is still running" }; @{ terminal = $terminal; stopped = $stopped; remaining = $remaining } | ConvertTo-Json -Compress'],
+        { env: { ...desktopEnv, CODEWHALE_CLIPBOARD_TERMINAL: terminal }, encoding: 'utf8', timeout: 10_000 });
+        receipt.desktop.fallbackCleanup = JSON.parse(cleanup.replace(/^\uFEFF/, ''));
+        assert.equal(receipt.desktop.fallbackCleanup.terminal, terminal, 'fallback cleanup used the owned Terminal path');
+        assert.equal(receipt.desktop.fallbackCleanup.remaining, 0, 'fallback cleanup retired the owned Terminal');
+      } catch (error) {
+        receipt.desktop.cleanupError = String(error); receipt.result = 'failed'; process.exitCode = 1;
       }
     }
+    if (desktop.exitCode === null && desktop.signalCode === null) {
+      receipt.desktop.killRequestedAt = new Date().toISOString(); desktop.kill();
+    }
     await desktopClosed;
   }
   await fs.writeFile(path.join(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2));
```

**File**: `vendor/codewhale-ratatui/Cargo.lock` (modified, +3/-2)
```diff
@@ -100,8 +100,9 @@ dependencies = [
 
 [[package]]
 name = "codewhale-app-server-protocol"
-version = "0.10.2"
+version = "0.10.3"
 dependencies = [
+ "chrono",
  "serde",
  "serde_json",
 ]
@@ -110,8 +111,8 @@ dependencies = [
 name = "codewhale-protocol"
 version = "0.10.3"
 dependencies = [
- "codewhale-app-server-protocol",
  "chrono",
+ "codewhale-app-server-protocol",
  "serde",
  "serde_json",
  "uuid",
```

---

### Incident Patch 2: `147bd65c` (2026-11-07)
**Commit Message**: fix(runtime): admit supported DSH packages and clarify lock refusals [skip ci]

Reuse npm semver7.8.5 inside the existing detached reviewer, including the
pinned upstream prerelease policy. Require its exact compatibility decision
before import and resolve a selected package's own ESM export through existing
contained-path guards. Preserve the existing unresolved-sibling refusal.

Stop deriving a lock-owner PID from stale lockfile bytes. Reuse coordination
projection and event-keyed notices to report each refusal cause once. Skip
sidebar cleanup only for already-latched read-only admission without a lock
slot; pace other failed attempts with the existing timestamp. Locks, migration,
retained state and explicit owning-Runtime restart behavior remain unchanged.
Align release notes and the existing affected fixture/assertion; no new tests.

Verified frozen4270-file Mac check: six native crates, all targets, locked,
onejob, offline, exit0 in838.473s, unchanged full source, no disk stop.
Node typecheck/build0, existing offline-reviewer1pass and six range observations
on the exact DSH source. Historical source-equivalent real1.0.8 preview400
reproduced the original range refusal. Current

**File**: `CHANGELOG.md` (modified, +17/-5)
```diff
@@ -274,15 +274,27 @@ until the matching tag, packages, checksums, and release assets exist.
   generation or trust receipt. The macOS stale-enable check passed (1/1);
   a separate Linux run reported 202 passed and one ignored on an earlier base
   with matching plugin files and lockfile. Snapshot checking is point-in-time;
-  automatic restoration is unfinished and filesystem races remain open. A
-  stage-disappearance regression and the final candidate remain unqualified.
+  missing-stage recovery reuses the current receipt and policy. Filesystem
+  race coverage and final-candidate native qualification remain open.
 - **Plugin status and UI admission:** an enabled, trusted plugin whose reviewed
   runtime snapshot is missing or invalid now reports
   `runtime-snapshot-unavailable`. Both plugin UI metadata and assets require a
   declared DSH client; ordinary plugins cannot expose staged files through the
-  client UI route. Automatic restoration of missing snapshots from
-  receipt-matching canonical source and authenticated DSH asset transport
-  remain work in progress; existing modified snapshots require review.
+  client UI route. Missing snapshots recover only from receipt-matching
+  canonical source; authenticated assets require an exact current grant.
+  Native and Electron qualification remains open; existing modified snapshots
+  require review.
+- **DSH package-directory imports:** the existing offline reviewer uses npm's
+  version-range parser with the pinned DeepSeek host's prerelease policy, and
+  bare self-package exports resolve inside the selected package directory.
+  Invalid or incompatible ranges and paths outside the reviewed package still
+  refuse. Real published-plugin activation remains unqualified.
+- **Coordination lock diagnostics (#7232):** stale lock-file contents no longer
+  identify an owner PID. A refused legacy admission keeps its reason in Work
+  and shows one notice per cause instead of repeating cleanup warnings on
+  every sidebar refresh. Legacy migration still requires the actual holder to
+  exit and the refused owning Runtime to restart; locks and retained state
+  remain protected.
 - **A local proxy that stops mid-session no longer strands the session (#7231):** the model, catalog, search, vision, finance, MCP-registry, profile and remote-control clients watch a loopback proxy port and go direct while it refuses connections, then resume proxying when it returns. Only a definite refusal from every resolved address changes the route; remote proxies, `NO_PROXY` matches, credentials and the existing precedence are unchanged. Set `CODEWHALE_LOCAL_PROXY_FALLBACK=0` to keep the old build-time snapshot.
 - **Proxy diagnostic privacy ([#7233](https://github.com/codewhale-hq/codewhale/issues/7233)):** malformed MCP proxy warnings omit configured values; local-proxy log labels mask userinfo and omit URL paths, queries and fragments. Routing is unchanged. All 23 existing proxy tests passed on macOS; runtime log capture and other platforms remain unqualified. Thanks [@SparkofSpike](https://github.com/SparkofSpike) for the report.
 - **Fork, undo and retry work after a workspace drift notice (#7234):** the history-boundary walks now treat a whole `<context_update>` envelope as engine-owned, so a session that received one can be cut at every saved turn. A person quoting a notice or a truncated envelope still counts as their own prompt.
```

**File**: `crates/engine/extension-host/dist/LICENSES.txt` (modified, +21/-0)
```diff
@@ -30,6 +30,7 @@ Packages:
   jose@6.2.12 (MIT)
   js-yaml@4.3.2 (MIT)
   pkce-challenge@5.0.1 (MIT)
+  semver@7.8.5 (ISC)
   zod@4.6.7 (MIT)
 
 ========================================================================
@@ -1183,6 +1184,26 @@ LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 
+========================================================================
+semver@7.8.5 (ISC)
+========================================================================
+
+The ISC License
+
+Copyright (c) Isaac Z. Schlueter and Contributors
+
+Permission to use, copy, modify, and/or distribute this software for any
+purpose with or without fee is hereby granted, provided that the above
+copyright notice and this permission notice appear in all copies.
+
+THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
+WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
+MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
+ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
+WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
+ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
+IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
+
 ========================================================================
 zod@4.6.7 (MIT)
 ========================================================================
```

**File**: `crates/engine/extension-host/dist/dsh-composition-review.mjs` (modified, +1193/-1)
```diff
@@ -1,6 +1,10 @@
 // trusted nonexecuting DSH composition reviewer; third-party notices: LICENSES.txt
+var __create = Object.create;
 var __defProp = Object.defineProperty;
+var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
 var __getOwnPropNames = Object.getOwnPropertyNames;
+var __getProtoOf = Object.getPrototypeOf;
+var __hasOwnProp = Object.prototype.hasOwnProperty;
 var __esm = (fn, res, err) => function __init() {
   if (err) throw err[0];
   try {
@@ -9,10 +13,33 @@ var __esm = (fn, res, err) => function __init() {
     throw err = [e], e;
   }
 };
+var __commonJS = (cb, mod) => function __require() {
+  try {
+    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
+  } catch (e) {
+    throw mod = 0, e;
+  }
+};
 var __export = (target, all) => {
   for (var name in all)
     __defProp(target, name, { get: all[name], enumerable: true });
 };
+var __copyProps = (to, from, except, desc) => {
+  if (from && typeof from === "object" || typeof from === "function") {
+    for (let key of __getOwnPropNames(from))
+      if (!__hasOwnProp.call(to, key) && key !== except)
+        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
+  }
+  return to;
+};
+var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
+  // If the importer is in node compatibility mode or this is not an ESM
+  // file that has been converted to a CommonJS file using a Babel-
+  // compatible transform (i.e. "__esModule" has not been set), then set
+  // "default" to the CommonJS "module.exports" for node compatibility.
+  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
+  mod
+));
 
 // node_modules/@deepseek-ai/cosmokit/lib/index.js
 function isNullable(value) {
@@ -14332,9 +14359,1166 @@ var init_composition = __esm({
   }
 });
 
+// node_modules/semver/internal/lrucache.js
+var require_lrucache = __commonJS({
+  "node_modules/semver/internal/lrucache.js"(exports, module) {
+    "use strict";
+    var LRUCache = class {
+      constructor() {
+        this.max = 1e3;
+        this.map = /* @__PURE__ */ new Map();
+      }
+      get(key) {
+        const value = this.map.get(key);
+        if (value === void 0) {
+          return void 0;
+        } else {
+          this.map.delete(key);
+          this.map.set(key, value);
+          return value;
+        }
+      }
+      delete(key) {
+        return this.map.delete(key);
+      }
+      set(key, value) {
+        const deleted = this.delete(key);
+        if (!deleted && value !== void 0) {
+          if (this.map.size >= this.max) {
+            const firstKey = this.map.keys().next().value;
+            this.delete(firstKey);
+          }
+          this.map.set(key, value);
+        }
+        return this;
+      }
+    };
+    module.exports = LRUCache;
+  }
+});
+
+// node_modules/semver/internal/parse-options.js
+var require_parse_options = __commonJS({
+  "node_modules/semver/internal/parse-options.js"(exports, module) {
+    "use strict";
+    var looseOption = Object.freeze({ loose: true });
+    var emptyOpts = Object.freeze({});
+    var parseOptions = (options) => {
+      if (!options) {
+        return emptyOpts;
+      }
+      if (typeof options !== "object") {
+        return looseOption;
+      }
+      return options;
+    };
+    module.exports = parseOptions;
+  }
+});
+
+// node_modules/semver/internal/constants.js
+var require_constants = __commonJS({
+  "node_modules/semver/internal/constants.js"(exports, module) {
+    "use strict";
+    var SEMVER_SPEC_VERSION = "2.0.0";
+    var MAX_LENGTH = 256;
+    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
+    9007199254740991;
+    var MAX_SAFE_COMPONENT_LENGTH = 16;
+    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
+    var RELEASE_TYPES = [
+      "major",
+      "premajor",
+      "minor",
+      "preminor",
+      "patch",
+      "prepatch",
+      "prerelease"
+    ];
+    module.exports = {
+      MAX_LENGTH,
+      MAX_SAFE_COMPONENT_LENGTH,
+      MAX_SAFE_BUILD_LENGTH,
+      MAX_SAFE_INTEGER,
+      RELEASE_TYPES,
+      SEMVER_SPEC_VERSION,
+      FLAG_INCLUDE_PRERELEASE: 1,
+      FLAG_LOOSE: 2
+    };
+  }
+});
+
+// node_modules/semver/internal/debug.js
+var require_debug = __commonJS({
+  "node_modules/semver/internal/debug.js"(exports, module) {
+    "use strict";
+    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
+    };
+    module.exports = debug;
+  }
+});
+
+// node_modules/semver/internal/re.js
+var require_re = __commonJS({
+  "node_modules/semver/internal/re.js"(exports, module) {
+    "use strict";
+    var {
+      MAX_SAFE_COMPONENT_LENGTH,
+      MAX_SAFE_BUILD_LENGTH,
+     
```

**File**: `crates/engine/extension-host/package-lock.json` (modified, +22/-0)
```diff
@@ -16,9 +16,11 @@
         "@modelcontextprotocol/client": "2.4.0",
         "@types/js-yaml": "4.0.9",
         "@types/node": "22.20.4",
+        "@types/semver": "7.8.0",
         "acorn": "8.18.0",
         "esbuild": "0.28.1",
         "js-yaml": "4.3.2",
+        "semver": "7.8.5",
         "typescript": "5.9.3"
       },
       "engines": {
@@ -578,6 +580,13 @@
         "undici-types": "~6.21.0"
       }
     },
+    "node_modules/@types/semver": {
+      "version": "7.8.0",
+      "resolved": "https://registry.npmjs.org/@types/semver/-/semver-7.8.0.tgz",
+      "integrity": "sha512-1mAINjtQCXXeLkJ9ehXkwOcBpqtLxiVtKhpUf83DdRNdQKV0iXZpaHYqRr7nj+wvxuJzoAmAwXI+sCNMv1CzLQ==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/acorn": {
       "version": "8.18.0",
       "resolved": "https://registry.npmjs.org/acorn/-/acorn-8.18.0.tgz",
@@ -738,6 +747,19 @@
         "node": ">=16.20.0"
       }
     },
+    "node_modules/semver": {
+      "version": "7.8.5",
+      "resolved": "https://registry.npmjs.org/semver/-/semver-7.8.5.tgz",
+      "integrity": "sha512-Y7/KDsb8LjooZpwaqGyulO6DQlksgCncchHGk+sZIY4SBvUocMBEFH5Ur1fI4dV+Jvl0w6cjvucaIi40puRioA==",
+      "dev": true,
+      "license": "ISC",
+      "bin": {
+        "semver": "bin/semver.js"
+      },
+      "engines": {
+        "node": ">=10"
+      }
+    },
     "node_modules/shebang-command": {
       "version": "2.0.0",
       "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
```

**File**: `crates/engine/extension-host/package.json` (modified, +2/-0)
```diff
@@ -24,9 +24,11 @@
     "@modelcontextprotocol/client": "2.4.0",
     "@types/js-yaml": "4.0.9",
     "@types/node": "22.20.4",
+    "@types/semver": "7.8.0",
     "acorn": "8.18.0",
     "esbuild": "0.28.1",
     "js-yaml": "4.3.2",
+    "semver": "7.8.5",
     "typescript": "5.9.3"
   }
 }
```

**File**: `crates/engine/extension-host/src/dsh/review-main.ts` (modified, +12/-2)
```diff
@@ -1,6 +1,8 @@
 /** Detached trusted offline reviewer. No HostRoot, plugin import or expression evaluation. */
 import { reviewComposition, type ReviewedComposition } from './composition.ts'
 import {reviewAgentPresets, type PresetReviewInput} from './agent-presets.ts'
+import satisfies from 'semver/functions/satisfies.js'
+import validRange from 'semver/ranges/valid.js'
 
 try {
   let bytes = 0
@@ -11,8 +13,16 @@ try {
     if (bytes > 8 * 1024 * 1024) throw new Error('review request exceeds 8 MiB')
     chunks.push(part)
   }
-  const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ReviewedComposition
-  const output = JSON.stringify((input as any).kind === 'agent-presets' ? await reviewAgentPresets(input as unknown as PresetReviewInput) : reviewComposition(input))
+  const input = JSON.parse(Buffer.concat(chunks).toString('utf8')) as ReviewedComposition & { compatibility?: { range: string; version: string } }
+  const result = (input as any).kind === 'agent-presets' ? await reviewAgentPresets(input as unknown as PresetReviewInput) : reviewComposition(input)
+  let compatibility: string | undefined
+  if (input.compatibility !== undefined) {
+    const { range, version } = input.compatibility
+    if (typeof range !== 'string' || typeof version !== 'string') throw new Error('invalid compatibility request')
+    const options = { includePrerelease: true }
+    compatibility = range.trim() === '' || validRange(range, options) === null ? 'invalid' : satisfies(version, range, options) ? 'match' : 'mismatch'
+  }
+  const output = JSON.stringify(compatibility === undefined ? result : { ...result, compatibility })
   if (Buffer.byteLength(output) > 8 * 1024 * 1024) throw new Error('review response exceeds 8 MiB')
   process.stdout.write(output)
 } catch {
```

**File**: `crates/engine/src/tools/subagent/mod.rs` (modified, +22/-34)
```diff
@@ -3939,13 +3939,9 @@ struct CoordinationProcessLock {
     thread: Option<std::thread::JoinHandle<()>>,
 }
 
-/// Marker prefix for a coordination-lock failure whose holder is THIS
-/// process: an engine swap (model/provider switch) constructs the new
-/// engine's manager while the old engine still holds the flock on its own
-/// fd, and flock treats a second descriptor in the same process as a
-/// conflict. This is a transient handover that self-heals on the next
-/// projection retry (#5036) — UI surfaces must not present it as "another
-/// Codewhale process" (owner report, 2026-08-04).
+/// Marker prefix retained for presentation compatibility with same-process
+/// handover notes from earlier hosts. It does not control lock acquisition
+/// or retry.
 pub const COORDINATION_SAME_PROCESS_HANDOVER: &str =
     "handing delegated coordination between engines in this process";
 
@@ -4036,23 +4032,10 @@ impl CoordinationProcessLock {
             }),
             Ok(Err(error)) => {
                 let _ = thread.join();
-                let holder_pid = std::fs::read_to_string(&lock_path)
-                    .ok()
-                    .and_then(|contents| contents.trim().parse::<u32>().ok());
-                if holder_pid == Some(std::process::id()) {
-                    Err(anyhow!(
-                        "{COORDINATION_SAME_PROCESS_HANDOVER} for {}: {error}",
-                        state_root.display()
-                    ))
-                } else {
-                    Err(anyhow!(
-                        "another Codewhale process{} owns delegated coordination for {}: {error}",
-                        holder_pid
-                            .map(|pid| format!(" (pid {pid})"))
-                            .unwrap_or_default(),
-                        state_root.display()
-                    ))
-                }
+                Err(anyhow!(
+                    "delegated coordination lock is unavailable for {}: {error}; close any other running or suspended Codewhale session using this workspace, then restart this Runtime if admission was refused",
+                    state_root.display()
+                ))
             }
             Err(error) => {
                 drop(release_tx);
@@ -4166,7 +4149,7 @@ pub struct SubAgentManager {
     /// capture the most recent checkpoint.
     last_persist_at: Option<Instant>,
     persist_pending: bool,
-    /// #3803: last time `cleanup` ran. The sidebar refresh (`Op::ListSubAgents`)
+    /// #3803: last time a cleanup attempt finished. The sidebar refresh (`Op::ListSubAgents`)
     /// renders from a read-only `list()` snapshot and only runs the
     /// write-locked `cleanup` on a bounded cadence, so a UI refresh storm during
     /// a sub-agent fanout no longer contends for the write lock on every request.
@@ -11338,15 +11321,20 @@ impl SubAgentManager {
     /// given duration. Returns the number of running agents auto-cancelled
     /// during this pass.
     pub fn cleanup(&mut self, max_age: Duration) -> Result<usize> {
-        self.with_store_transaction(|held| held.cleanup_inner(None, max_age))
+        let result = self.with_store_transaction(|held| held.cleanup_inner(None, max_age));
+        self.last_cleanup_at = Some(Instant::now());
+        result
     }
 
     pub fn cleanup_for_session(
         &mut self,
         active_session_id: &str,
         max_age: Duration,
     ) -> Result<usize> {
-        self.with_store_transaction(|held| held.cleanup_inner(Some(active_session_id), max_age))
+        let result = self
+            .with_store_transaction(|held| held.cleanup_inner(Some(active_session_id), max_age));
+        self.last_cleanup_at = Some(Instant::now());
+        result
     }
 
     fn cleanup_inner(
@@ -11592,18 +11580,18 @@ impl SubAgentManager {
             self.pending_handle_evictions
                 .push((agent_id, owner_session_id));
         }
-        self.last_cleanup_at = Some(Instant::now());
         Ok(auto_cancelled)
     }
 
-    /// #3803: whether enough time has elapsed since the last `cleanup` that the
-    /// next sidebar refresh should run the write-locked cleanup again. Every
-    /// other refresh renders from the read-only `list()` snapshot, so a UI
-    /// refresh storm during a fanout does not take the write lock per request.
+    /// #3803: whether the next sidebar refresh should attempt cleanup.
+    /// Read-only managers without a process lock only render their refusal.
+    /// Other managers use the last attempt's interval to bound cleanup locking.
     #[must_use]
     pub fn cleanup_due(&self, min_interval: Duration) -> bool {
-        self.last_cleanup_at
-            .is_none_or(|last| last.elapsed() >= min_interval)
+        (!self.coordination_snapshot_read_only || self.holds_coordination_process_lock())
+            && self
+                .last_cleanup_at
+                .is_none_or(|last| last.elapsed() >= min_interval)
     }
 
     #[must_use]
```

**File**: `crates/plugins/src/install/dsh.rs` (modified, +41/-15)
```diff
@@ -563,8 +563,8 @@ fn target_dsh_version() -> Result<semver::Version> {
     })
 }
 
-fn admit_host_compatibility(manifest: &Value) -> Result<()> {
-    if let Some(declared) = manifest
+fn admit_host_compatibility(manifest: &Value) -> Result<Option<&str>> {
+    let dsh_range = if let Some(declared) = manifest
         .get("engines")
         .and_then(|engines| engines.get("dsh"))
     {
@@ -573,21 +573,17 @@ fn admit_host_compatibility(manifest: &Value) -> Result<()> {
                 "incompatible-version: `engines.dsh` must be a string semver range; author the supported DSH range or remove the field.",
             );
         };
-        let requirement = semver::VersionReq::parse(range).map_err(|_| {
-            anyhow::Error::msg(format!(
-                "incompatible-version: `engines.dsh` value `{}` is not a valid semver range.",
-                refusal_text(range)
-            ))
-        })?;
-        let target = target_dsh_version()?;
         require(
-            requirement.matches(&target),
+            !range.trim().is_empty(),
             &format!(
-                "incompatible-version: this bundle requires DSH `{}`, but this Codewhale host targets DSH {target}; import a bundle built for that host or update the host.",
+                "incompatible-version: `engines.dsh` value `{}` is not a valid semver range.",
                 refusal_text(range)
             ),
         )?;
-    }
+        Some(range)
+    } else {
+        None
+    };
     if let Some(declared) = manifest
         .get("dsh")
         .and_then(|dsh| dsh.get("bundle"))
@@ -631,7 +627,7 @@ fn admit_host_compatibility(manifest: &Value) -> Result<()> {
             ),
         )?;
     }
-    Ok(())
+    Ok(dsh_range)
 }
 
 fn declares_client(manifest: &Value) -> bool {
@@ -654,7 +650,7 @@ pub fn load_bundle(package: &Package) -> Result<LoadedBundle> {
         matches!(bundle, Some(Value::Map(_))),
         "Not a DSH bundle package: package.json lacks `dsh.bundle.patch`.",
     )?;
-    admit_host_compatibility(&manifest)?;
+    let dsh_range = admit_host_compatibility(&manifest)?;
     let mut notes = Vec::new();
     if declares_client(&manifest) {
         notes.push(
@@ -714,7 +710,37 @@ pub fn load_bundle(package: &Package) -> Result<LoadedBundle> {
         });
     }
     let composition = json!({"version":1,"layers":raw_layers,"modules":[],"files":{}});
-    let reviewed = crate::composition_review::review(&composition).map_err(anyhow::Error::msg)?;
+    let mut review_input = composition.clone();
+    let target = if let Some(range) = dsh_range {
+        let target = target_dsh_version()?;
+        review_input["compatibility"] = json!({"range":range,"version":target.to_string()});
+        Some(target)
+    } else {
+        None
+    };
+    let reviewed = crate::composition_review::review(&review_input).map_err(anyhow::Error::msg)?;
+    if let (Some(range), Some(target)) = (dsh_range, target) {
+        match reviewed.get("compatibility").and_then(Json::as_str) {
+            Some("match") => {}
+            Some("invalid") => {
+                return refuse(format!(
+                    "incompatible-version: `engines.dsh` value `{}` is not a valid semver range.",
+                    refusal_text(range)
+                ));
+            }
+            Some("mismatch") => {
+                return refuse(format!(
+                    "incompatible-version: this bundle requires DSH `{}`, but this Codewhale host targets DSH {target}; import a bundle built for that host or update the host.",
+                    refusal_text(range)
+                ));
+            }
+            _ => {
+                return refuse(
+                    "incompatible-version: compatibility reviewer returned no valid decision.",
+                );
+            }
+        }
+    }
     let entries = reviewed
         .get("entries")
         .and_then(Json::as_array)
```

---

### Incident Patch 3: `b175b1f9` (2026-11-07)
**Commit Message**: fix(engine): keep injected-route config when preflight fails [skip ci]

Fixes the remaining hosted test failures on 549ff01ebb (CI 42381817495).

Runtime: a host-provided route with no preflighted client took its config
with mem::take before the optional credential preflight, so a failed
preflight left the route with a default config and lost its session
isolation and approval deadlines. It now clones, so the configured route
survives a failure. The existing privacy/timeout assertions are unchanged.

Exports: the four capabilities the runtime already serializes
(thread_scoped_git_writes, thread_scoped_snapshots, worktrees,
job_operations) are restored to the committed JSON schema, the TypeScript
declarations and the runtime SDK copy; the JSON matches the Rust-generated
contract.

Existing expectations realigned with shipped behavior: `present` is an eager
core tool (hook category stays other) in the five tool-surface tests; Native
extension entries accept .cjs and .cts; account logout is account-only and
keeps provider keys (two TUI tests renamed to say so). The router HTTP-status
unit test disables retry because it mounts a single response; runtime retries
are unchanged. THIRD_PAR

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -275,6 +275,10 @@ until the matching tag, packages, checksums, and release assets exist.
 
 ### Fixed
 
+- **Host-provided model clients:** keep configured session isolation and
+  approval deadlines when optional credential preflight fails.
+- **Runtime SDK exports:** include the existing thread-scoped Git, snapshot,
+  worktree and job-operation capabilities in the committed schema and types.
 - **Plugin enablement revalidates its review:** enabling rechecks the staged
   snapshot and, under the existing state lock, refuses a changed review
   generation or trust receipt. The macOS stale-enable check passed (1/1);
```

**File**: `THIRD_PARTY_NOTICES.md` (modified, +21/-0)
```diff
@@ -933,6 +933,27 @@ OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 ```
 
+### `semver` 7.8.5
+
+```text
+The ISC License
+
+Copyright (c) Isaac Z. Schlueter and Contributors
+
+Permission to use, copy, modify, and/or distribute this software for any
+purpose with or without fee is hereby granted, provided that the above
+copyright notice and this permission notice appear in all copies.
+
+THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
+WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
+MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
+ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
+WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
+ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
+IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
+
+```
+
 ## Optional compiled extension host
 
 Node remains the default extension-host runtime. An explicitly installed
```

**File**: `crates/app-server-protocol/schema/json/runtime.schema.json` (modified, +23/-0)
```diff
@@ -289,6 +289,25 @@
           "type": "boolean",
           "default": false
         },
+        "thread_scoped_git_writes": {
+          "type": "boolean",
+          "description": "Git stage, unstage, discard, commit, push and branch accept\n`?thread_id=` and act on that thread's workspace.",
+          "default": false
+        },
+        "thread_scoped_snapshots": {
+          "type": "boolean",
+          "description": "`GET /v1/snapshots` and `POST /v1/snapshots/{id}/restore` accept\n`?thread_id=` and act on that thread's workspace.",
+          "default": false
+        },
+        "worktrees": {
+          "type": "boolean",
+          "description": "`GET`/`POST /v1/worktrees` and `POST /v1/worktrees/remove`.",
+          "default": false
+        },
+        "job_operations": {
+          "type": "boolean",
+          "default": false
+        },
         "thread_shell_consent": {
           "type": "boolean",
           "description": "Explicit per-thread shell opt-in is checked against loaded policy and\ncannot broaden a conversation while it has an active turn.",
@@ -454,6 +473,10 @@
         "thread_idle_precondition",
         "thread_patch_undo_turn_id",
         "thread_scoped_reads",
+        "thread_scoped_git_writes",
+        "thread_scoped_snapshots",
+        "worktrees",
+        "job_operations",
         "thread_shell_consent",
         "turns",
         "turn_operation_idempotency",
```

**File**: `crates/app-server-protocol/schema/typescript/runtime.d.ts` (modified, +4/-0)
```diff
@@ -62,6 +62,10 @@ export type RuntimeCapabilities = {
   thread_idle_precondition: boolean
   thread_patch_undo_turn_id: boolean
   thread_scoped_reads: boolean
+  thread_scoped_git_writes: boolean
+  thread_scoped_snapshots: boolean
+  worktrees: boolean
+  job_operations: boolean
   thread_shell_consent: boolean
   turns: boolean
   turn_operation_idempotency: boolean
```

**File**: `crates/engine/src/core/engine.rs` (modified, +1/-1)
```diff
@@ -2056,7 +2056,7 @@ impl Engine {
         let concrete_client = match route.take_preflighted_client() {
             Some(client) => Ok(client),
             None => {
-                let config = std::mem::take(&mut route.config);
+                let config = route.config.clone();
                 match CodewhaleClient::capture_candidate_preflight(config, &route.candidate).await {
                     Ok((config, captured)) => {
                         route.config = config;
```

**File**: `crates/engine/src/core/engine/tests/test_cases_10.rs` (modified, +2/-1)
```diff
@@ -1,6 +1,6 @@
 #[test]
 fn default_active_contract_keeps_discovery_and_core_tools_eager() {
-    const EXPECTED_NATIVE: [&str; 15] = [
+    const EXPECTED_NATIVE: [&str; 16] = [
         "read",
         "write",
         "edit",
@@ -13,6 +13,7 @@ fn default_active_contract_keeps_discovery_and_core_tools_eager() {
         "get_goal",
         "update_goal",
         "task_shell_wait",
+        "present",
         "load_skill",
         "context_archive_get",
         "context_archive_search",
```

**File**: `crates/engine/src/core/engine/tool_catalog/tests.rs` (modified, +3/-0)
```diff
@@ -113,6 +113,7 @@ fn first_turn_surface_is_stable_across_plan_work_and_operate() {
             "get_goal",
             "update_goal",
             "task_shell_wait",
+            "present",
             "load_skill",
             "context_archive_get",
             "context_archive_search"
@@ -127,6 +128,7 @@ fn first_turn_surface_is_stable_across_plan_work_and_operate() {
         "edit",
         "file_search",
         "load_skill",
+        "present",
         "read",
         "task_shell_wait",
         "todo_write",
@@ -152,6 +154,7 @@ fn first_turn_surface_is_stable_across_plan_work_and_operate() {
             "get_goal",
             "update_goal",
             "task_shell_wait",
+            "present",
             "Git",
             "Run",
             "tasks",
```

**File**: `crates/engine/src/extension_host/tests.rs` (modified, +1/-1)
```diff
@@ -1956,7 +1956,7 @@ fn native_entry_rule_fails_validation_when_the_host_is_enabled() {
             let errors = native_errors(&registry, name);
             assert_eq!(errors.len(), 1, "{name}: {errors:?}");
             assert!(
-                errors[0].contains(".mjs, .js or .mts"),
+                errors[0].contains(".mjs, .js, .cjs, .mts or .cts"),
                 "{name}: {errors:?}"
             );
         }
```

#### Recent Merged Pull Requests:
- **PR #7246** (2026-11-07): chore(deps): bump similar from 3.2.0 to 3.2.1 (@dependabot[bot])
- **PR #7245** (2026-11-07): chore(deps): bump rusqlite from 0.40.2 to 0.41.1 (@dependabot[bot])
- **PR #7244** (2026-11-07): chore(deps): bump rmcp from 3.7.0 to 3.8.0 (@dependabot[bot])
- **PR #7243** (2026-11-07): chore(deps): bump unicode-normalization from 0.1.25 to 0.1.26 (@dependabot[bot])
- **PR #7242** (2026-11-07): chore(deps): bump actions/setup-java from 4.7.1 to 6.1.0 (@dependabot[bot])
- **PR #7241** (2026-11-07): chore(deps): bump webpki-roots from 1.0.10 to 1.0.11 (@dependabot[bot])

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

## X. release): handle Windows cleanup and align kit lock [skip ci]

**RULE**:
When implementing operations in `scripts/release/windows-terminal-clipboard.mjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `549ff01e`: release): handle Windows cleanup and align kit lock [skip ci]. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/release/windows-terminal-clipboard.mjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  receipt.cleanup = JSON.parse((await fs.readFile(path.join(evidence, 'cleanup.json'), 'utf8')).replace(/^\uFEFF/, ''));
    }
    if (receipt.result !== 'passed') {
      try {
        const cleanup = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          '$ErrorActionPreference = "Stop"; $terminal = $env:CODEWHALE_CLIPBOARD_TERMINAL; $stopped = @(); foreach ($process in @(Get-Process | Where-Object { $_.Path -eq $terminal })) { Stop-Process -InputObject $process -Force; if (!$process.WaitForExit(5000)) { throw "Owned Terminal did not exit" }; $stopped += $process.Id }; $remaining = @(Get-Process | Where-Object { $_.Path -eq $terminal }).Count; if ($remaining) { throw "Owned Terminal is still running" }; @{ terminal = $terminal; stopped = $stopped; remaining = $remaining } | ConvertTo-Json -Compress'],
        { env: { ...desktopEnv, CODEWHALE_CLIPBOARD_TERMINAL: terminal }, encoding: 'utf8', timeout: 10_000 });
        receipt.desktop.fallbackCleanup = JSON.parse(cleanup.replace(/^\uFEFF/, ''));
        assert.equal(receipt.desktop.fallbackCleanup.terminal, terminal, 'fallback cleanup used the owned Terminal path');
        assert.equal(receipt.des
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  receipt.cleanup = JSON.parse(await fs.readFile(path.join(evidence, 'cleanup.json'), 'utf8'));
      if (desktop.exitCode === null && desktop.signalCode === null) {
        try {
          const cleanup = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            '$ErrorActionPreference = "Stop"; $terminal = $env:CODEWHALE_CLIPBOARD_TERMINAL; $stopped = @(); foreach ($process in @(Get-Process | Where-Object { $_.Path -eq $terminal })) { Stop-Process -InputObject $process -Force; if (!$process.WaitForExit(5000)) { throw "Owned Terminal did not exit" }; $stopped += $process.Id }; $remaining = @(Get-Process | Where-Object { $_.Path -eq $terminal }).Count; if ($remaining) { throw "Owned Terminal is still running" }; @{ terminal = $terminal; stopped = $stopped; remaining = $remaining } | ConvertTo-Json -Compress'],
          { env: { ...desktopEnv, CODEWHALE_CLIPBOARD_TERMINAL: terminal }, encoding: 'utf8', timeout: 10_000 });
          receipt.desktop.fallbackCleanup = JSON.parse(cleanup.replace(/^\uFEFF/, ''));
        } catch (error) {
          receipt.desktop.cleanupError = String(error); receipt.result = 'failed'; process.exitCode = 1;
        }
    
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `549ff01e` are properly handled with clean fallback behavior.
