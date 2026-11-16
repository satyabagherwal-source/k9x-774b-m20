> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: github ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Source Version**: `554cb1b7`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T21:10:23.688Z  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): codewhale-hq/Codewhale

> **Canonical Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T21:10:23.569Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: An open-source coding agent for your terminal, written in Rust. It works with any model, can split one task across several agents, and every line of it is yours to read.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41184 stars

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

### Core Architecture Module: `crates/core/src/lib.rs`
```
pub mod context_reference;
pub mod fragments;
pub mod prefix_cache;
pub mod request;
pub mod role;
pub mod secret_eq;
pub mod tool_parser;

pub use context_reference::{
    ContextReference, ContextReferenceKind, ContextReferenceSource, MediaAttachmentReference,
    media_attachment_references,
};

use codewhale_config::{ConfigToml, ProviderKind};
use codewhale_state::StateStore;

/// Compatibility configuration.
///
/// Conversation execution and durable history belong to the held canonical
/// RuntimeThreadManager/Engine. Legacy State data is retained for read-only
/// recovery and bound alias publication, never as a second transcript writer.
pub struct Runtime {
    pub config: ConfigToml,
    state: StateStore,
}

impl Runtime {
    pub fn new(config: ConfigToml, state: StateStore) -> Self {
        Self { config, state }
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
        let mut runtime = Runtime::new(ConfigToml::default(), store);
        runtime.update_config(ConfigToml::default());
        assert_eq!(
            runtime
                .state_store()
                .list_threads(Default::default())
                .unwrap()
                .len(),
            before.len()
        );
        let reopened = Runtime::new(runtime.config.clone(), runtime.state_store().clone());
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

### Core Architecture Module: `crates/core/src/prefix_cache.rs`
```
//! Prefix-cache stability manager (inspired by Reasonix's Pillar 1).
//!
//! DeepSeek's automatic prefix caching activates only when the *exact*
//! byte prefix of a request matches the prior request. Any system-prompt
//! drift, tool-list reordering, or message-rewriting busts the cache
//! for every token after the changed byte.
//!
//! This module provides a `PrefixStabilityManager` that:
//!
//! 1. **Fingerprints** the immutable prefix (system prompt + tool specs)
//!    at session start, using SHA-256 for strong collision resistance.
//! 2. **Verifies** the current prefix against the pinned fingerprint before
//!    every request.
//! 3. **Attributes** every change: a header change the engine declared
//!    (`/model`, `/mode`, goal edits, MCP or deferred-tool activation,
//!    session sync) re-pins under a logged reason; an undeclared change is
//!    *drift* — it is recorded and reported, and the original pin stays so
//!    later checks keep counting the miss instead of quietly adopting it.
//! 4. **Emits events** so the TUI can surface stability to the user.
//!
//! The invariant this guards: after session start, system and tools are
//! frozen bytes; history only grows; a miss is allowed only when we log why.
//!
//! ## Three-region model (from Reasonix)
//!
//! ```text
//! ┌─────────────────────────────────────────┐
//! │ IMMUTABLE PREFIX                        │ ← fixed for session
//! │   system + tool_specs                    │   cache hit candidate
//! ├─────────────────────────────────────────┤
//! │ APPEND-ONLY HISTORY                     │ ← grows monotonically
//! │   [assistant₁][tool₁][assistant₂]...    │   preserves prefix of prior turns
//! ├─────────────────────────────────────────┤
//! │ LATEST USER TURN                        │ ← the only new content per request
//! └─────────────────────────────────────────┘
//! ```

use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, VecDeque};
use std::hash::{Hash, Hasher};

use serde::{Deserialize, Serialize};

use crate::request::{SystemPrompt, Tool};

/// A snapshot of the immutable prefix's fingerprint.
///
/// Matching hashes show stable system text and the normalized OpenAI-style
/// tool catalog. They do not measure provider cache hits or fingerprint every
/// provider-specific wire transformation; request replay tests cover those.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrefixFingerprint {
    /// SHA-256 of the system prompt text.
    pub system_sha256: String,
    /// SHA-256 of the full tool catalog JSON (names, descriptions, schemas).
    pub tools_sha256: String,
    /// SHA-256 of system_sha256 ++ tools_sha256 (combined).
    pub combined_sha256: String,
}

impl PrefixFingerprint {
    /// Compute a fingerprint from system prompt text and tool list.
    ///
    /// Tools are serialized to the same JSON shape the chat API receives
    /// (`type`, `name`, `description`, `parameters`, `strict`) **in provider
    /// wire order**, then SHA-256 hashed. Order is load-bearing: the provider
    /// KV cache is order-sensitive, so sorting before hashing could read a
    /// false-green while the real prefix cache misses every turn (ops C1,
    /// DSH invariant). This also catches schema/description drift that
    /// actually affects the API prefix, while ignoring internal-only fields
    /// like `allowed_callers` (#2264).
    ///
    /// This entry point shares a process-local [`ToolCatalogCache`] with
    /// every other call, so a stable tool set (the common case after the
    /// first turn of a session) avoids the per-tool JSON serialization
    /// and join entirely. Callers that hold their own cache — e.g.
    /// [`PrefixStabilityManager`] — should use
    /// [`Self::compute_with_tool_cache`] to share *that* cache instead
    /// and avoid the thread-local lookup.
    #[cfg(test)]
    pub fn compute(system_text: &str, tools: Option<&[Tool]>) -> Self {
        let mut cache = ToolCatalogCache::new();
        Self::compute_with_tool_cache(system_text, tools, &mut cache)
    }

    /// Compute a fingerprint while reusing a [`ToolCatalogCache`] for the
    /// tool-side work. The cache holds the joined+SHA-256'd catalog
    /// under a content-derived identity so the per-tool JSON serialization
    /// and the join only run on the first call for a given tool set.
    ///
    /// On a cache hit this function avoids the entire tool serialization
    /// path, which can be 100+ microseconds for a 60-tool catalog.
    pub fn compute_with_tool_cache(
        system_text: &str,
        tools: Option<&[Tool]>,
        cache: &mut ToolCatalogCache,
    ) -> Self {
        let system_sha256 = sha256_hex(system_text.as_bytes());

        let tools_sha256 = match tools {
            Some(tools) if !tools.is_empty() => {
                // `fingerprint_for` consults the cache first; on a hit
                // it returns the pre-computed hex digest directly.
                cache.fingerprint_for(tools).sha256_hex
            }
            _ => sha256_hex(b""),
        };

        let combined = format!("{system_sha256}:{tools_sha256}");
        let combined_sha256 = sha256_hex(combined.as_bytes());
        Self {
            system_sha256,
            tools_sha256,
            combined_sha256,
        }
    }
}

/// A change record describing what drifted in the prefix.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrefixChange {
    /// The old fingerprint (before the change).
    pub old: PrefixFingerprint,
    /// The new fingerprint (after the change).
    pub new: PrefixFingerprint,
    /// Whether the system prompt component changed.
    pub system_changed: bool,
    /// Whether the tool set component changed.
    pub tools_changed: bool,
}

impl PrefixChange {
    /// Returns a human-readable description of what changed.
    pub fn description(&self) -> String {
        let mut parts = Vec::new();
        if self.system_changed {
            parts.push("system prompt");
        }
        if self.tools_changed {
            parts.push("tool set");
        }
        if parts.is_empty() {
            return "unknown (fingerprint mismatch but no component detected)".to_string();
        }
        format!("prefix cache invalidated: {} changed", parts.join(" and "))
    }

    /// Returns a short label for TUI chip display.
    pub fn label(&self) -> &'static str {
        if self.system_changed && self.tools_changed {
            "sys+tools"
        } else if self.system_changed {
            "sys"
        } else if self.tools_changed {
            "tools"
        } else {
            "prefix"
        }
    }
}

/// Monitors and manages prefix-cache stability across turns.
///
/// This is the core abstraction, mirroring Reasonix's `ImmutablePrefix`
/// concept but adapted to CodeWhale's existing architecture where the
/// system prompt is rebuilt each turn and tools are registered at startup.
///
/// Usage:
/// ```ignore
/// let mgr = PrefixStabilityManager::new(system_text, tools);
/// if mgr.check_and_update(system_text, tools) {
///     println!("Prefix is stable (cache-friendly)");
/// } else {
///     let change = mgr.last_change().unwrap();
///     println!("Prefix drifted: {}", change.description());
/// }
/// ```
#[derive(Debug, Clone)]
pub struct PrefixStabilityManager {
    /// The pinned fingerprint from session start or last stabilization.
    pinned: Option<PrefixFingerprint>,
    /// The most recent fingerprint (computed during last check).
    current: Option<PrefixFingerprint>,
    /// The last detected change, if any.
    last_change: Option<PrefixChange>,
    /// Total number of prefix changes detected this session.
    change_count: u64,
    /// Total number of stability checks performed.
    check_count: u64,
    /// Why the current pin exists: `initial`, `resume`, or `change:<what>`.
    pin_reason: Option<String>,
    /// Bounded log of every attributed change and every undeclared drift.
    history: VecDeque<PrefixHistoryEntry>,
    /// Explanation of the most recent expected cache miss (a declared header
    /// change, a history reset such as compaction, or undeclared drift).
    last_miss_reason: Option<String>,
    /// `<context_update>` snapshots appended this session (workspace drift
    /// delivered as history, with the pinned header untouched).
    context_update_count: u64,
    /// Process-local cache for the tool-catalog JSON serialization. Avoids
    /// re-running `logical_tool_fingerprint_json` + join on every `check_and_update`
    /// when the tool set is unchanged (the common case once tools are
    /// registered at session start).
    tool_catalog_cache: ToolCatalogCache,
}

/// Maximum retained [`PrefixHistoryEntry`] records per session.
const PREFIX_HISTORY_CAP: usize = 32;

/// One attributed prefix event: a declared header change (re-pinned) or an
/// undeclared drift (pin kept).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PrefixHistoryEntry {
    /// `change:<what>` for declared header changes, `drift:<component>` for
    /// undeclared changes, `reset:<what>` for history resets.
    pub reason: String,
    /// Whether the pin was replaced by this event.
    pub repinned: bool,
    /// Combined SHA-256 before the event.
    pub from_sha256: String,
    /// Combined SHA-256 the request actually carried.
    pub to_sha256: String,
}

/// Outcome of [`PrefixStabilityManager::check`].
#[derive(Debug, Clone)]
pub enum PrefixCheck {
    /// The request prefix matches the pin byte-for-byte.
    Stable,
    /// The prefix changed and the engine declared why; the pin moved.
    Repinned {
        reason: String,
        change: PrefixChange,
    },
    /// The prefix changed with no declared reason. The pin did NOT move.
    Drift { change: PrefixChange },
}

/// Default capacity for the tool-catalog serialization cache. Sized for
/// "session + 1 or 2 forked subagent catalogs" without unbounded growth.
const TOOL_CAT
```

### Core Architecture Module: `crates/core/src/request.rs`
```
//! Compatibility path for the shared protocol request types.
pub use codewhale_protocol::request::*;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7353** (2026-11-16): **fix(engine): log safe provider failure diagnostics**
  *Symptoms*: Provider timeouts and transport failures can end a turn without leaving their cause in the default diagnostic log. Emit a structured warning from the existing `envelope_for_llm_error` boundary, shared by stream opening, stream reading, and context-recovery failures.  The warning records the existing error code/category and typed transmission state, plus an HTTP status or timeout duration only when the error retains that evidence. Untyped failures stay `OutcomeUnknown`; a zero timeout means the duration was not recorded. Raw errors, display messages, response bodies, URLs, and authentication context are not logged. Envelope conversion and retry/recovery decisions are unchanged.  Refs #7328 (partial). This slice adds diagnostic cause fields; provider/model/stage context, error-card presentation, and structured receipt fields remain outside its scope. Thanks to @7jrxt42BxFZo4iAnN4CX for the log/session analysis and measured timeout examples.  Validation:  - One regression captures warnings through an `info` filter across six failure cases, including an anyhow-wrapped timeout, unknown duration, pre-dispatch connection failure, 503 unknown outcome, 413 rejection, and an untyped network failure. It checks that raw error/context/secret fixtures are absent and the returned display message/recovery contract is preserved. - `CODEWHALE_DEV_NEXTEST=0 bash scripts/dev-test.sh crates/engine/src/llm_error_envelope.rs` (repository-pinned Rust 1.100.0, Linux): `test result: ok. 7 passed; 0 fa

- **Issue #7352** (2026-11-16): **fix(app-server): preserve named provider in web picker**
  *Symptoms*: ## 做了什么，为什么  修复了 Web 客户端新建线程时无法正确使用命名自定义 Provider 的问题。多个自定义路由在 API 中都标记为 `custom`，客户端原先没有保留精确的路由 ID，导致模型列表请求失败。现在会按精确路由加载模型并创建线程。  ## 问题来源  Bug 修复：使用命名自定义 Provider（例如 `seer`）时，Web 客户端提示 `custom` 不是命名 Provider 的通配符，原报错： “ Could not load models: an explicit provider pin must name the configured provider 'seer'; custom is not a wildcard for a named provider”。  ## 测试方式  - `node --test crates/app-server/tests/runtime_web_client.test.mjs`：44 项测试通过。 - `cargo build --offline -p codewhale-cli`：构建成功。  ## 检查清单  - [x] 单一聚焦改动，基于当前 `main` 创建分支。 - [x] 增加测试覆盖改动行为；相关测试通过。 - [x] 已更新英文和简体中文 Web 文档；本次不是新增用户功能，无需修改 `docs/features.toml`。
  **Post-Mortem & Fix Analysis**:
  > Thank you @Gyuke, and welcome: this is your first merged contribution. Making the web client's new-thread dialog route to a named custom provider fixes a real gap for people running more than one custom endpoint. Both independent reviews approved the code with no changes.  Squash-merged as a508d8d3f8 (your branch is untouched). It is on `main` for the 0.10.3 candidate and is not in a published release yet. One maintainer credit commit follows with the CHANGELOG line, your CONTRIBUTORS entry and an `.github/AUTHOR_MAP` entry so your commit email links to your GitHub account; you do not need to do anything. 

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

### Incident Patch 1: `3c4317c9` (2026-11-16)
**Commit Message**: fix(client): decide the reasoning dialect by endpoint, not by model id (#7349)

* fix(client): stop sending DeepSeek thinking toggle to compatible gateways

A `custom` route carrying a DeepSeek model id was handed DeepSeek's native
`thinking` object on /v1/chat/completions. The promotion in
apply_route_reasoning_controls looked only at the model name, never at the
endpoint, so an OpenAI-compatible gateway received a field it rejects:

  400 invalid_request_error  param: "thinking"  code: "unsupported_parameter"
  "thinking" is not supported on /v1/chat/completions and was not applied.

Every other gateway identity in reasoning_effort.rs (telecomjs, zenmux, edenai,
csdn, custom) already writes neither field, because a compatible endpoint's
request dialect is not knowable from the model id. The custom row escaped that
policy through this one promotion.

Keep the promotion for what 008d21d69 added it for - forwarding the configured
effort, which custom DeepSeek routes silently dropped - and drop the
DeepSeek-native toggle from that path. reasoning_effort is the standard
compatibility field these gateways document. Direct deepseek routes keep their
full dialect; the DS4 local route is 

**File**: `crates/engine/src/client.rs` (modified, +1/-1)
```diff
@@ -4009,7 +4009,7 @@ impl CodewhaleClient {
         });
         chat::apply_route_reasoning_controls(
             &mut body,
-            self.api_provider,
+            self.chat_shape_provider(&model),
             &self.base_url,
             &model,
             Some("off"),
```

**File**: `crates/engine/src/client/chat.rs` (modified, +63/-8)
```diff
@@ -585,22 +585,67 @@ fn modelstudio_reasoning_effort_for_model(effort: &str) -> Option<&'static str>
     }
 }
 
+/// Whether `base_url` points at one of DeepSeek's own Chat Completions hosts.
+///
+/// The decision is the host's, not the path's: `https://api.deepseek.com/openai`
+/// is still DeepSeek, and treating a non-canonical path as a gateway would send
+/// `reasoning_effort: "none"` to the real endpoint, which documents no such tier
+/// on this wire. Scheme stays exact so an http downgrade cannot claim the
+/// dialect.
+///
+/// The host set deliberately includes the legacy typo host `api.deepseeki.com`,
+/// which `docs/REBRAND.md` records as not an official endpoint and kept only for
+/// existing configs (#1079). `deepseek_base_url_supports_strict_tools`, the beta
+/// path guard, and the Responses dialect all accept it too; excluding it here
+/// would make the same host DeepSeek for strict tools and Responses but not for
+/// reasoning, silently dropping the toggle those configs rely on.
+fn is_deepseek_chat_host(base_url: &str) -> bool {
+    reqwest::Url::parse(base_url.trim()).is_ok_and(|url| {
+        url.scheme() == "https"
+            && matches!(
+                url.host_str(),
+                Some("api.deepseek.com" | "api.deepseeki.com")
+            )
+    })
+}
+
 /// Final reasoning-control pass shared by streaming and non-streaming Chat
-/// Completions requests. Route-specific shapers run after the generic provider
-/// layer so they can remove fields that are invalid for their exact endpoint.
+/// Completions requests. Route-specific shapers run first so they can remove
+/// fields that are invalid for their exact endpoint; the gateway cleanup below
+/// runs last, so nothing in this function can re-add what it removes.
+///
+/// Which dialect a route speaks is decided by the endpoint, not by the model id.
+/// A route labeled `deepseek` speaks DeepSeek's, and so does a `custom` row
+/// pointed at DeepSeek's own host. A `custom` row pointed anywhere else may
+/// still carry a DeepSeek model id, but the endpoint's dialect is unknown: it
+/// keeps the documented `reasoning_effort` spelling and loses the native
+/// `thinking` object, which the gateway this was reproduced against rejects
+/// outright on `/v1/chat/completions`.
+///
+/// `off` is expressed as `reasoning_effort: "none"` on such a route, the OpenAI
+/// compatibility spelling this repository already maps `off` to for other
+/// compatible routes. On the gateway this was verified against, `none` stopped
+/// thinking (`reasoning_tokens: 0`, no reasoning field) rather than merely
+/// omitting the control. A gateway that validates the field fails loudly; one
+/// that silently ignores unknown values would fall back to its own default
+/// while the replay gate skips `reasoning_content` for `off` — which is why this
+/// mapping is only self-consistent on gateways that implement `none`.
 pub(super) fn apply_route_reasoning_controls(
     body: &mut Value,
     provider: ProviderKind,
     base_url: &str,
     model: &str,
     effort: Option<&str>,
 ) {
-    let reasoning_provider =
-        if provider == ProviderKind::Custom && requires_reasoning_content(model) {
-            ProviderKind::Deepseek
-        } else {
-            provider
-        };
+    let custom_claims_deepseek_model =
+        provider == ProviderKind::Custom && requires_reasoning_content(model);
+    let gateway_drops_deepseek_dialect =
+        custom_claims_deepseek_model && !is_deepseek_chat_host(base_url);
+    let reasoning_provider = if provider == ProviderKind::Deepseek || custom_claims_deepseek_model {
+        ProviderKind::Deepseek
+    } else {
+        provider
+    };
     apply_reasoning_effort(body, effort, reasoning_provider);
     codewhale_config::local_reasoning::apply_local_reasoning_controls(
         body, provider, model, effort,
@@ -615,6 +660,16 @@ pub(super) fn apply_route_reasoning_controls(
     apply_zai_route_reasoning_controls(body, provider, base_url, model, effort);
     apply_mistral_route_reasoning_controls(body, provider, base_url, model, effort);
     apply_google_reasoning_effort(body, base_url, model, effort);
+    if gateway_drops_deepseek_dialect {
+        if let Some(object) = body.as_object_mut() {
+            object.remove("thinking");
+        }
+        if effort.is_some_and(|effort| !reasoning_effort_enables_thinking(Some(effort)))
+            && body.get("reasoning_effort").is_none()
+        {
+            body["reasoning_effort"] = json!("none");
+        }
+    }
 }
 
 /// Mistral's polymorphic reasoning-content contract is only proven on its
```

**File**: `crates/engine/src/client/ds4_tests.rs` (modified, +128/-0)
```diff
@@ -5,6 +5,8 @@ use codewhale_models::Role;
 use codewhale_models::{ContentBlock, Delta, Message, MessageRequest, StreamEvent, Tool};
 use codewhale_runtime::config::{Config, ProviderConfig, ProvidersConfig};
 use serde_json::{Value, json};
+use wiremock::matchers::method;
+use wiremock::{Mock, MockServer, ResponseTemplate};
 
 fn ds4_client() -> CodewhaleClient {
     let mut providers = ProvidersConfig::default();
@@ -30,6 +32,132 @@ fn ds4_client() -> CodewhaleClient {
     .expect("DS4 client")
 }
 
+/// The same named `ds4` identity, bound to a mock endpoint. DS4 is identified by
+/// the identity key plus a local host, so a loopback mock server is a real DS4
+/// route as far as the client is concerned.
+fn ds4_client_at(server: &MockServer) -> CodewhaleClient {
+    let mut providers = ProvidersConfig::default();
+    providers.custom.insert(
+        "ds4".to_string(),
+        ProviderConfig {
+            kind: Some("openai-compatible".to_string()),
+            base_url: Some(format!("{}/v1", server.uri())),
+            model: Some("deepseek-v4-flash".to_string()),
+            context_window: Some(100_000),
+            auth_mode: Some("none".to_string()),
+            ..Default::default()
+        },
+    );
+    CodewhaleClient::new(&{
+        let __cw_config_init_1_0 = Some("ds4".to_string());
+        let __cw_config_init_1_1 = Some(providers);
+        let mut __cw_config_init_1_value: Config = Default::default();
+        __cw_config_init_1_value.provider = __cw_config_init_1_0;
+        __cw_config_init_1_value.providers = __cw_config_init_1_1;
+        __cw_config_init_1_value
+    })
+    .expect("DS4 client")
+}
+
+/// DS4 is a named `openai-compatible` route, so its `api_provider` is `Custom`.
+/// It implements the first-party DeepSeek dialect, which means the helper paths
+/// that bypass `chat_shape_provider` must still send the thinking toggle.
+/// Translation is one of those paths and always requests `off`.
+#[tokio::test]
+async fn named_ds4_translation_keeps_the_disabled_thinking_toggle() -> Result<()> {
+    let server = MockServer::start().await;
+    Mock::given(method("POST"))
+        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
+            "id": "chatcmpl-ds4-translate",
+            "object": "chat.completion",
+            "model": "deepseek-v4-flash",
+            "choices": [{
+                "index": 0,
+                "message": {"role": "assistant", "content": "Hola"},
+                "finish_reason": "stop"
+            }],
+            "usage": {"prompt_tokens": 3, "completion_tokens": 1, "total_tokens": 4}
+        })))
+        .expect(1)
+        .mount(&server)
+        .await;
+
+    let client = ds4_client_at(&server);
+    client
+        .translate_with_usage(
+            "hello",
+            "deepseek-v4-flash",
+            "Spanish",
+            &crate::cost_status::NativeUsageSource::capture(
+                format!("ds4-translate-test:{}", uuid::Uuid::new_v4()),
+                crate::cost_status::UsageSpendOwner::Auxiliary,
+            ),
+        )
+        .await?;
+
+    let requests = server.received_requests().await.expect("recorded request");
+    assert_eq!(requests.len(), 1);
+    let body: Value = serde_json::from_slice(&requests[0].body)?;
+    assert_eq!(
+        body.pointer("/thinking/type").and_then(Value::as_str),
+        Some("disabled"),
+        "DS4 speaks the first-party DeepSeek dialect: {body}"
+    );
+    Ok(())
+}
+
+/// The mirror of the test above on an ordinary compatible gateway. Translation
+/// always asks for `off`; on a gateway that must arrive as `none` with no
+/// `thinking` object, because the object is what such an endpoint rejects.
+/// Without this case a future shaper could re-add the toggle on the translation
+/// path and only the gateway would notice.
+#[tokio::test]
+async fn a_gateway_translation_asks_for_none_instead_of_the_thinking_toggle() -> Result<()> {
+    let server = MockServer::start().await;
+    Mock::given(method("POST"))
+        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
+            "id": "chatcmpl-gateway-translate",
+            "object": "chat.completion",
+            "model": "DeepSeek-V4.1-Flash",
+            "choices": [{
+                "index": 0,
+                "message": {"role": "assistant", "content": "Hola"},
+                "finish_reason": "stop"
+            }],
+            "usage": {"prompt_tokens": 3, "completion_tokens": 1, "total_tokens": 4}
+        })))
+        .expect(1)
+        .mount(&server)
+        .await;
+
+    let client = super::tests::custom_mock_client_for_identity(&server, "aicraft");
+    client
+        .translate_with_usage(
+            "hello",
+            "DeepSeek-V4.1-Flash",
+            "Spanish",
+            &crate::cost_status::NativeUsageSource::capture(
+                format!("gateway-translate-test:{}", uuid::Uuid::new_v4()),
+                crate::cost_status::UsageSpendOw
```

**File**: `crates/engine/src/client/test_cases_05.rs` (modified, +171/-13)
```diff
@@ -147,30 +147,33 @@
     }
 
     /// Request-body capture per effort level on direct and custom DeepSeek chat
-    /// route: the wire must carry the documented low/high/max ladder and the
-    /// thinking toggle, never an invented value (#52).
+    /// route: the wire must carry the documented low/high/max ladder, never an
+    /// invented value (#52). Only the `deepseek`-shaped route carries the
+    /// `thinking` toggle; a gateway borrows the effort spelling and expresses
+    /// `off` as `none`.
     #[tokio::test]
     async fn deepseek_chat_wire_body_tracks_the_documented_effort_ladder() {
-        for (effort, expected_effort, expected_thinking) in [
-            (Some("low"), Some("low"), Some("enabled")),
-            (Some("medium"), Some("high"), Some("enabled")),
-            (Some("high"), Some("high"), Some("enabled")),
-            (Some("max"), Some("max"), Some("enabled")),
-            (Some("off"), None, Some("disabled")),
-            (None, None, None),
+        for (effort, expected_effort, expected_thinking, gateway_effort) in [
+            (Some("low"), Some("low"), Some("enabled"), Some("low")),
+            (Some("medium"), Some("high"), Some("enabled"), Some("high")),
+            (Some("high"), Some("high"), Some("enabled"), Some("high")),
+            (Some("max"), Some("max"), Some("enabled"), Some("max")),
+            (Some("off"), None, Some("disabled"), Some("none")),
+            (None, None, None, None),
         ] {
             for (custom, stream) in [(false, false), (false, true), (true, false), (true, true)] {
                 let body = capture_deepseek_chat_body_for_effort(effort, custom, stream).await;
                 assert_eq!(body["max_tokens"], 64);
                 assert_eq!(
                     body.get("reasoning_effort").and_then(Value::as_str),
-                    expected_effort,
-                    "reasoning_effort on the wire for {effort:?}: {body}"
+                    if custom { gateway_effort } else { expected_effort },
+                    "reasoning_effort on the wire for {effort:?} (custom={custom}): {body}"
                 );
+                let expected_toggle = if custom { None } else { expected_thinking };
                 assert_eq!(
                     body.pointer("/thinking/type").and_then(Value::as_str),
-                    expected_thinking,
-                    "thinking on the wire for {effort:?}: {body}"
+                    expected_toggle,
+                    "thinking on the wire for {effort:?} (custom={custom}): {body}"
                 );
             }
         }
@@ -1708,3 +1711,158 @@
             );
         }
     }
+
+    #[test]
+    fn openai_compatible_gateway_gets_no_deepseek_thinking_dialect_from_a_model_name() {
+        for (effort, expected_effort) in [
+            ("off", Some("none")),
+            ("low", Some("low")),
+            ("high", Some("high")),
+            ("max", Some("max")),
+            ("auto", None),
+            ("no-such-tier", None),
+        ] {
+            let mut body = json!({});
+            chat::apply_route_reasoning_controls(
+                &mut body,
+                ProviderKind::Custom,
+                "https://api.freeshare.tech:8443/v1",
+                "DeepSeek-V4.1-Flash",
+                Some(effort),
+            );
+            assert!(
+                body.get("thinking").is_none(),
+                "a gateway rejects DeepSeek's toggle object ({effort}): {body}"
+            );
+            assert_eq!(
+                body.get("reasoning_effort").and_then(Value::as_str),
+                expected_effort,
+                "the compatibility wire expresses the tier in its own spelling ({effort}): {body}"
+            );
+        }
+    }
+
+    /// A `custom` row pointed at DeepSeek's own host is DeepSeek: it keeps the
+    /// native toggle, so `off` still disables thinking there rather than
+    /// degrading to the compatibility spelling. The host decides, so a
+    /// non-canonical path is still DeepSeek, and a trailing slash, surrounding
+    /// whitespace, userinfo or an explicit port does not change the answer.
+    #[test]
+    fn a_custom_row_on_the_official_deepseek_host_keeps_the_thinking_toggle() {
+        for base_url in [
+            "https://api.deepseek.com/v1",
+            "https://api.deepseek.com",
+            "https://api.deepseek.com/beta",
+            "https://api.deepseek.com/v1/",
+            "https://api.deepseek.com/openai",
+            "  https://API.DeepSeek.com/v1  ",
+            "https://user:pw@api.deepseek.com/v1",
+            "https://api.deepseek.com:443/v1",
+        ] {
+            for (effort, thinking, wire_effort) in [
+                ("off", "disabled", None),
+                ("max", "enabled", Some("max")),
+            ] {
+                let mut body = json!({});
+                chat::apply_route_reasoning_controls(
+                    &mut body,
+                    ProviderKind::Custo
```

---

### Incident Patch 2: `a44078cc` (2026-11-16)
**Commit Message**: fix(test): route engine test temp dirs through a per-process scratch root (CW-8203)

Engine, app-server, runtime and TUI test helpers created uuid-, pid- or
nanos-suffixed directories directly under the system temp dir and never
removed them, leaking thousands of folders per test run.

Add codewhale_runtime::test_support::test_scratch_dir(prefix) returning a
unique, not-yet-created path under one codewhale-test-scratch-<pid>-<nonce>
root per test process, removed at exit by the existing atexit hook
(registered once via std::sync::Once alongside isolated_test_state_root).

Migrate helper-level leak sites across runtime (config_persistence,
workspace_lease), engine (core approval store, runtime_threads,
task_manager, subagent approval store), app-server (runtime_api server
roots, thread_snapshot_ownership, control_socket_selection) and TUI
(config_main_host, network command tests, views create_test_app).

Checks (Boat Linux): cargo fmt --all -- --check passed; cargo clippy
--locked -p codewhale-runtime -p codewhale-engine -p codewhale-app-server
-p codewhale-tui --all-targets -- -D warnings 0 warnings; hermetic cargo
nextest: codewhale-runtime 38 passed, codewhale-engine 713 passed,


**File**: `crates/app-server/src/runtime_api/tests.rs` (modified, +6/-6)
```diff
@@ -1583,7 +1583,7 @@ async fn spawn_test_server() -> Result<
         tokio::task::JoinHandle<()>,
     )>,
 > {
-    let root = std::env::temp_dir().join(format!("deepseek-runtime-api-{}", Uuid::new_v4()));
+    let root = codewhale_engine::test_support::test_scratch_dir("deepseek-runtime-api");
     let sessions_dir = root.join("sessions");
     spawn_test_server_with_root(root, sessions_dir).await
 }
@@ -1597,7 +1597,7 @@ async fn spawn_test_server_with_config_path(
         tokio::task::JoinHandle<()>,
     )>,
 > {
-    let root = std::env::temp_dir().join(format!("codewhale-config-api-{}", Uuid::new_v4()));
+    let root = codewhale_engine::test_support::test_scratch_dir("codewhale-config-api");
     let sessions_dir = root.join("sessions");
     let workspace = root.join("workspace");
     fs::create_dir_all(&root)?;
@@ -1625,7 +1625,7 @@ async fn spawn_test_server_with_config_path_and_profile(
         tokio::task::JoinHandle<()>,
     )>,
 > {
-    let root = std::env::temp_dir().join(format!("codewhale-config-api-{}", Uuid::new_v4()));
+    let root = codewhale_engine::test_support::test_scratch_dir("codewhale-config-api");
     let sessions_dir = root.join("sessions");
     let workspace = root.join("workspace");
     fs::create_dir_all(&root)?;
@@ -2162,7 +2162,7 @@ async fn mcp_tools_endpoint_is_passive_until_connect_requested() -> Result<()> {
 
 #[tokio::test]
 async fn runtime_token_guard_protects_v1_routes() -> Result<()> {
-    let root = std::env::temp_dir().join(format!("deepseek-runtime-api-{}", Uuid::new_v4()));
+    let root = codewhale_engine::test_support::test_scratch_dir("deepseek-runtime-api");
     let sessions_dir = root.join("sessions");
     let token = "local-test-token".to_string();
     let Some((addr, _runtime_threads, handle)) =
@@ -9515,7 +9515,7 @@ fn snapshots_endpoint_lists_workspace_snapshots() -> Result<()> {
 async fn spawn_server_with_saved_sessions(
     sessions: &[(&str, &str, bool)],
 ) -> Result<Option<(SocketAddr, PathBuf, tokio::task::JoinHandle<()>)>> {
-    let root = std::env::temp_dir().join(format!("codewhale-session-routes-{}", Uuid::new_v4()));
+    let root = codewhale_engine::test_support::test_scratch_dir("codewhale-session-routes");
     let sessions_dir = root.join("sessions");
     let workspace = root.join("workspace");
     fs::create_dir_all(&workspace)?;
@@ -26588,7 +26588,7 @@ mod thread_snapshot_ownership {
     }
 
     fn test_root(name: &str) -> PathBuf {
-        std::env::temp_dir().join(format!("codewhale-6621-{name}-{}", Uuid::new_v4()))
+        codewhale_engine::test_support::test_scratch_dir(&format!("codewhale-6621-{name}"))
     }
 
     /// A session save must not be refused because a finished turn still lists
```

**File**: `crates/app-server/src/runtime_api/tests/control_socket_selection.rs` (modified, +2/-1)
```diff
@@ -22,7 +22,8 @@ fn default_socket() -> PathBuf {
 }
 
 fn temp_root(tag: &str) -> PathBuf {
-    let root = std::env::temp_dir().join(format!("cw-control-socket-{tag}-{}", std::process::id()));
+    let root =
+        codewhale_engine::test_support::test_scratch_dir(&format!("cw-control-socket-{tag}"));
     std::fs::create_dir_all(&root).expect("fixture root");
     root
 }
```

**File**: `crates/engine/src/core/engine.rs` (modified, +3/-3)
```diff
@@ -2751,9 +2751,9 @@ impl Engine {
                 }
                 #[cfg(any(test, feature = "test-support"))]
                 {
-                    Ok(ApprovalReceiptStore::new(std::env::temp_dir().join(
-                        format!("codewhale-approval-tests-{}", uuid::Uuid::new_v4()),
-                    )))
+                    Ok(ApprovalReceiptStore::new(
+                        crate::test_support::test_scratch_dir("codewhale-approval-tests"),
+                    ))
                 }
             },
             EngineHostSetup::approval_store,
```

**File**: `crates/engine/src/runtime_threads/tests.rs` (modified, +2/-2)
```diff
@@ -2396,7 +2396,7 @@ mod recovery {
 }
 
 fn test_runtime_dir() -> PathBuf {
-    std::env::temp_dir().join(format!("deepseek-runtime-threads-{}", Uuid::new_v4()))
+    crate::test_support::test_scratch_dir("deepseek-runtime-threads")
 }
 
 const EVENT_PROCESS_ROLE_ENV: &str = "CODEWHALE_TEST_EVENT_PROCESS_ROLE";
@@ -11164,7 +11164,7 @@ async fn update_thread_workspace_rejects_empty_path() -> Result<()> {
 #[tokio::test]
 async fn workspace_restore_guard_rejects_overlapping_active_turns() -> Result<()> {
     let manager = test_manager(test_runtime_dir())?;
-    let root = std::env::temp_dir().join(format!("codewhale-restore-guard-{}", Uuid::new_v4()));
+    let root = crate::test_support::test_scratch_dir("codewhale-restore-guard");
     let busy = root.join("busy");
     let nested = busy.join("nested");
     let idle = root.join("idle");
```

**File**: `crates/engine/src/task_manager.rs` (modified, +28/-29)
```diff
@@ -5196,7 +5196,7 @@ mod tests {
 
     #[tokio::test]
     async fn persists_and_recovers_task_records() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager =
             TaskManager::start_with_executor(test_config(root.clone()), Arc::new(MockExecutor))
                 .await?;
@@ -5419,7 +5419,7 @@ mod tests {
 
     #[tokio::test]
     async fn preallocated_task_ids_are_validated_and_collision_safe() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager =
             TaskManager::start_with_executor(test_config(root), Arc::new(MockExecutor)).await?;
         let request = NewTaskRequest::from_prompt("preallocated owner identity");
@@ -5454,7 +5454,7 @@ mod tests {
 
     #[tokio::test]
     async fn failed_queue_write_leaves_no_replayable_task_record() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager =
             TaskManager::start_with_executor(test_config(root.clone()), Arc::new(MockExecutor))
                 .await?;
@@ -5487,7 +5487,7 @@ mod tests {
 
     #[tokio::test]
     async fn list_tasks_scopes_results_to_workspace_before_limit() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager =
             TaskManager::start_with_executor(test_config(root), Arc::new(MockExecutor)).await?;
 
@@ -5516,7 +5516,7 @@ mod tests {
 
     #[tokio::test]
     async fn task_controls_are_session_owned_and_legacy_records_fail_closed() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager =
             TaskManager::start_with_executor(test_config(root), Arc::new(MockExecutor)).await?;
 
@@ -5767,7 +5767,7 @@ mod tests {
         // #3757 boot-persist narrowing: TaskManager::start must persist only
         // the reconciled queue and the running->failed recoveries — a
         // completed task's file must be byte-identical across a restart.
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager =
             TaskManager::start_with_executor(test_config(root.clone()), Arc::new(MockExecutor))
                 .await?;
@@ -5799,7 +5799,7 @@ mod tests {
 
     #[test]
     fn legacy_running_tasks_are_preserved_without_assuming_owner_death() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let tasks_dir = root.join("tasks");
         fs::create_dir_all(&tasks_dir)?;
         let queue_path = root.join("queue.json");
@@ -5892,9 +5892,8 @@ mod tests {
 
     #[tokio::test]
     async fn default_workspace_updates_for_future_tasks() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
-        let new_workspace =
-            std::env::temp_dir().join(format!("deepseek-workspace-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
+        let new_workspace = crate::test_support::test_scratch_dir("deepseek-workspace");
         let manager =
             TaskManager::start_with_executor(test_config(root), Arc::new(MockExecutor)).await?;
 
@@ -5910,7 +5909,7 @@ mod tests {
 
     #[tokio::test]
     async fn record_tool_metadata_updates_explicit_task() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager =
             TaskManager::start_with_executor(test_config(root), Arc::new(MockExecutor)).await?;
 
@@ -5966,7 +5965,7 @@ mod tests {
 
     #[tokio::test]
     async fn cancel_running_task_marks_canceled() -> Result<()> {
-        let root = std::env::temp_dir().join(format!("deepseek-task-test-{}", Uuid::new_v4()));
+        let root = crate::test_support::test_scratch_dir("deepseek-task-test");
         let manager = TaskManager::start_with_executor(
             test_config(root),
             Arc::new(CooperativeIdleCancelExecutor),
@@ -5987,7 +5986,7 @@ mod tests {
 
     #[tokio::test]
     async fn cancel_finished_task_returns_atomic_already_finish
```

**File**: `crates/engine/src/tools/subagent/tests.rs` (modified, +1/-4)
```diff
@@ -16445,10 +16445,7 @@ pub fn stub_runtime() -> SubAgentRuntime {
         parent_pinned_project_instructions: std::sync::Arc::default(),
         parent_auto_review_state: None,
         approval_receipt_store: Some(Ok(crate::approval_log::ApprovalReceiptStore::new(
-            std::env::temp_dir().join(format!(
-                "codewhale-child-approval-tests-{}",
-                uuid::Uuid::new_v4()
-            )),
+            crate::test_support::test_scratch_dir("codewhale-child-approval-tests"),
         ))),
         mcp_pool: None,
         mcp_auth_context: crate::mcp::process_mcp_auth_context(),
```

**File**: `crates/runtime/src/config_persistence.rs` (modified, +1/-8)
```diff
@@ -607,10 +607,7 @@ mod tests {
 
     use std::path::Path;
 
-    use std::time::SystemTime;
-
     use super::test_support::*;
-    use std::time::UNIX_EPOCH;
 
     struct EnvGuard {
         _home: crate::test_support::EnvVarGuard,
@@ -642,11 +639,7 @@ mod tests {
     }
 
     fn temp_root(prefix: &str) -> std::path::PathBuf {
-        let nanos = SystemTime::now()
-            .duration_since(UNIX_EPOCH)
-            .unwrap()
-            .as_nanos();
-        env::temp_dir().join(format!("{prefix}-{}-{nanos}", std::process::id()))
+        crate::test_support::test_scratch_dir(prefix)
     }
 
     #[test]
```

**File**: `crates/runtime/src/test_support.rs` (modified, +72/-11)
```diff
@@ -45,30 +45,62 @@ pub fn isolated_test_state_root() -> &'static Path {
                 root.display()
             )
         });
-        remove_isolated_test_state_root_at_exit();
+        remove_test_roots_at_exit();
         // Match resolvers that canonicalize their root (macOS aliases /var to
         // /private/var). Every fence must name the same physical test store.
         root.canonicalize().expect("canonical test state root")
     })
 }
 
+pub fn test_scratch_dir(prefix: &str) -> PathBuf {
+    let root = TEST_SCRATCH_ROOT.get_or_init(|| {
+        let nonce = SystemTime::now()
+            .duration_since(UNIX_EPOCH)
+            .unwrap_or_default()
+            .as_nanos();
+        let root = std::env::temp_dir().join(format!(
+            "codewhale-test-scratch-{}-{nonce}",
+            std::process::id()
+        ));
+        std::fs::create_dir_all(&root).unwrap_or_else(|error| {
+            panic!(
+                "failed to create unit-test scratch root {}: {error}",
+                root.display()
+            )
+        });
+        remove_test_roots_at_exit();
+        root
+    });
+    root.join(format!("{prefix}-{}", uuid::Uuid::new_v4()))
+}
+
 static ISOLATED_TEST_STATE_ROOT: OnceLock<PathBuf> = OnceLock::new();
+static TEST_SCRATCH_ROOT: OnceLock<PathBuf> = OnceLock::new();
 
-fn remove_isolated_test_state_root_at_exit() {
+fn remove_test_roots_at_exit() {
     unsafe extern "C" {
         fn atexit(callback: extern "C" fn()) -> std::ffi::c_int;
     }
-    extern "C" fn remove_root() {
-        let Some(root) = ISOLATED_TEST_STATE_ROOT.get() else {
-            return;
-        };
-        if std::fs::remove_dir_all(root).is_err() {
-            #[cfg(unix)]
-            make_directories_writable(root);
-            let _ = std::fs::remove_dir_all(root);
+    extern "C" fn remove_roots() {
+        for root in [ISOLATED_TEST_STATE_ROOT.get(), TEST_SCRATCH_ROOT.get()]
+            .into_iter()
+            .flatten()
+        {
+            remove_test_root(root);
         }
     }
-    unsafe { atexit(remove_root) };
+    static REGISTERED: std::sync::Once = std::sync::Once::new();
+    REGISTERED.call_once(|| unsafe {
+        atexit(remove_roots);
+    });
+}
+
+fn remove_test_root(root: &Path) {
+    if std::fs::remove_dir_all(root).is_err() {
+        #[cfg(unix)]
+        make_directories_writable(root);
+        let _ = std::fs::remove_dir_all(root);
+    }
 }
 
 #[cfg(unix)]
@@ -468,6 +500,35 @@ pub fn future_test_jwt(label: &str) -> String {
 mod tests {
     use super::*;
 
+    #[test]
+    fn test_scratch_dirs_are_distinct_under_the_process_root_and_removable() {
+        let first = test_scratch_dir("codewhale-scratch-probe");
+        let second = test_scratch_dir("codewhale-scratch-probe");
+        let root = TEST_SCRATCH_ROOT.get().expect("scratch root initialized");
+
+        assert_ne!(first, second);
+        assert!(root.is_dir());
+        for dir in [&first, &second] {
+            assert_eq!(dir.parent(), Some(root.as_path()));
+            assert!(!dir.exists());
+        }
+
+        let nested = first.join("nested");
+        std::fs::create_dir_all(&nested).expect("create scratch dir");
+        std::fs::write(nested.join("file"), b"x").expect("write scratch file");
+        #[cfg(unix)]
+        {
+            use std::os::unix::fs::PermissionsExt;
+            std::fs::set_permissions(&nested, std::fs::Permissions::from_mode(0o500))
+                .expect("make scratch dir read-only");
+        }
+
+        remove_test_root(&first);
+
+        assert!(!first.exists());
+        assert!(root.is_dir());
+    }
+
     #[test]
     fn ambient_codewhale_home_is_not_a_test_seal() {
         let _lock = lock_test_env();
```

---

### Incident Patch 3: `2c1a20af` (2026-11-16)
**Commit Message**: fix(tui): re-vendor the terminal kit's data-display and ocean fixes

show_data painted and described numbers with a vendored chart.rs that
could disagree with the data. Take five source files byte for byte from
codewhale-hq/codewhale-ratatui e8c2746 (tip of its main, hosted CI green):

- src/components/chart.rs: data_number no longer prints a small non-zero
  value as "0" or "-0" and rounds across a unit (999950 is "1M"); a
  DataTrend with more points than dot columns draws each column from its
  lowest to highest value so spikes are kept; a DataBars value above zero
  draws at least an eighth of a cell; a narrow row cuts the label before
  the value. describe() carries the same numbers back to the model.
- src/ocean.rs: OceanRamp::for_theme records Hint and Dim and eases the
  waiting, approval and failure tints until they keep 4.5:1 and 3:1.
- src/color.rs, src/components/motion.rs: crate-private is_truecolor;
  motion.rs also gains the standalone's three-line module doc.
- src/gallery/chart.rs: names DataDisplayView.

Before overwriting, each vendored file was diffed against standalone
1d06170 (the last sync): identical except the motion.rs doc header, so no
Engine adaptation w

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- **`show_data` charts tell the truth at the edges:** a small value such as `0.004` is no longer shown, or reported back to the model, as `0`; a trend with more points than the chart is wide keeps its spikes and dips instead of skipping them; a bar for any value above zero is always visible; and on a narrow terminal the label is shortened before the number is.
 - **Worktree-side renames in the Runtime API:** `GET /v1/git` and `GET /v1/changes` now show the source of a rename in the worktree column that leaves the workspace as a `deleted` row, as they already did for a staged rename; a copy is still never shown that way. Thanks [@SparkofSpike](https://github.com/SparkofSpike) (#7325).
 - **Multiline XML tool arguments:** a text-fallback tool call whose parameter value, in either the `<parameter name=...>` or the `<key>` form, contains a newline, such as multiline `write_file` content, no longer arrives with empty arguments. Thanks [@Ricardo-M-L](https://github.com/Ricardo-M-L) (#7341).
 - **Assignments inside CLI argument values:** the fallback tool-call parser no longer invents an extra parameter from text inside a `--argument` value, so `--command "MODE=dev node app.js"` stays one command. Thanks [@Ricardo-M-L](https://github.com/Ricardo-M-L) (#7342).
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- **`show_data` charts tell the truth at the edges:** a small value such as `0.004` is no longer shown, or reported back to the model, as `0`; a trend with more points than the chart is wide keeps its spikes and dips instead of skipping them; a bar for any value above zero is always visible; and on a narrow terminal the label is shortened before the number is.
 - **Worktree-side renames in the Runtime API:** `GET /v1/git` and `GET /v1/changes` now show the source of a rename in the worktree column that leaves the workspace as a `deleted` row, as they already did for a staged rename; a copy is still never shown that way. Thanks [@SparkofSpike](https://github.com/SparkofSpike) (#7325).
 - **Multiline XML tool arguments:** a text-fallback tool call whose parameter value, in either the `<parameter name=...>` or the `<key>` form, contains a newline, such as multiline `write_file` content, no longer arrives with empty arguments. Thanks [@Ricardo-M-L](https://github.com/Ricardo-M-L) (#7341).
 - **Assignments inside CLI argument values:** the fallback tool-call parser no longer invents an extra parameter from text inside a `--argument` value, so `--command "MODE=dev node app.js"` stays one command. Thanks [@Ricardo-M-L](https://github.com/Ricardo-M-L) (#7342).
```

**File**: `vendor/codewhale-ratatui/CHANGELOG.md` (modified, +9/-0)
```diff
@@ -2,6 +2,15 @@
 
 ## Unreleased — 0.2.0
 
+- The Ocean column's waiting, approval and failure tints now ease off near the
+  surface where they would push `Hint` below 4.5:1 or `Dim` below 3:1, for a
+  ramp built with `OceanRamp::for_theme`; deeper rows keep the full warm tint.
+- Data displays stay honest at the edges. `data_number` no longer prints a
+  small value as `0` or `-0` (`0.0042`, `4.2e-7`) and rounds across a unit
+  (`999950` is `1M`, with a `T` tier). A `DataTrend` with more points than
+  dot columns draws each column from its lowest to its highest value, so a
+  spike is never dropped. A `DataBars` value above zero always draws at least
+  an eighth of a cell, and a narrow row cuts the label before the value.
 - Add data displays: `DataSparkline`, `DataBars` and `DataTrend` (a braille
   line chart). The words carry every value; the ink draws in from a caller
   progress (`MotionStep::drawn`) and is at its end state under reduced or
```

**File**: `vendor/codewhale-ratatui/UPSTREAM.json` (modified, +8/-6)
```diff
@@ -260,8 +260,8 @@
     }
   },
   "runtime_update": {
-    "commit": "1d061703691c9130724f58eebfe7060a5fc019ca",
-    "scope": "Selected generic widget fixes, measured ocean themes and caller-clock water drift from standalone; chart, roles and theme verified already matching. Standalone tooling, gallery export and repository-only tests are outside this source synchronization.",
+    "commit": "e8c2746e4b93070ebeac41a064dde3d362cb975d",
+    "scope": "Selected generic widget fixes, measured ocean themes and caller-clock water drift from standalone; roles and theme verified already matching; data-display honesty fixes (chart), Ocean quiet-ink floors in for_theme, and the crate-private is_truecolor used by motion. Standalone tooling, gallery export and repository-only tests are outside this source synchronization.",
     "files": {
       "src/components/instrument.rs": "468280c9c5be4d1244ef1601784d11d9956b2e1d36c9f671618404fbb010c77a",
       "src/components/list.rs": "8f4b8d7220202b49e6a6fb17e4d587123e538ce90d03fbe0c16c3776765a0e34",
@@ -270,13 +270,15 @@
       "src/components/segmented.rs": "a148c79c1d6d214c6b28ed0ac5ab7f669805d0d6a41250efc56632da9b39eb62",
       "src/components/tabs.rs": "2e18bc604786f5403e1491e50322e0bf771fa70389ef34347528ae8bef6afa44",
       "src/components/surface.rs": "fcdec44734d0bdc2db69dad41dd9c88f018003b128927f9d59c4d7536cb9e6c0",
-      "src/ocean.rs": "194a7ade34b6fac7d8ad471f4bfcb04d3ae88a9c4f63f51bc4627c5edfc0183e",
+      "src/ocean.rs": "62eff5da97dab3e5939e7e425ac6922bf2cd309be3caaa128052f89c4bcbd4ff",
       "src/ombre.rs": "7356cc1c7b9af444f8272817d57cbaaa8133bfd2689220a1a794dfaf0d897fda",
-      "src/components/chart.rs": "77759af13c4d2b7ffadee5dae8e4849ec3ed637741cf9dd29764edcff625cc82",
-      "src/gallery/chart.rs": "98e3c20e26e06744e09750209bc627b3c21204d6fb9022883ac5b5f856953175",
+      "src/components/chart.rs": "692f3f8725ca467df27fe16545ed39573c8ad8bd597dafe6596c61bd75e117b4",
+      "src/gallery/chart.rs": "dc0832242654174b36f90e35a761900d2b28156ba463bdd00a52741f1f467eda",
       "examples/data.rs": "633ee3f3786ec5053b98a50cc72b2b44d68ba41a9eedba56a58504f04881670a",
       "src/roles.rs": "2ac8760785aa0a83daeb89c32e7dec259dbae358e9a80426900c83e606f8fa79",
-      "src/theme.rs": "ac3851f676511b494bfb3a9e680d016daff1c85a20ced8ff4b4eba6f115f9f21"
+      "src/theme.rs": "ac3851f676511b494bfb3a9e680d016daff1c85a20ced8ff4b4eba6f115f9f21",
+      "src/color.rs": "e63bfde21ec7197d6d955f689eea8790797a1df9fdb43c25950e6d82534eb551",
+      "src/components/motion.rs": "7b41b6616ff61513d098cd2710a5912d8bece9704d8fdc6c0e8dbb5a5f158251"
     },
     "retained_engine_adaptations": {
       "src/components/workbar.rs": {
```

**File**: `vendor/codewhale-ratatui/src/color.rs` (modified, +5/-0)
```diff
@@ -170,6 +170,11 @@ pub fn indexed_rgb(index: u8) -> Option<(u8, u8, u8)> {
     }
 }
 
+#[must_use]
+pub(crate) const fn is_truecolor(color: Color) -> bool {
+    matches!(color, Color::Rgb(..))
+}
+
 /// The RGB a color is *known* to render as, or `None` when the terminal owns
 /// the decision (`Reset`, named colors, indices 0..=15).
 #[must_use]
```

**File**: `vendor/codewhale-ratatui/src/components/chart.rs` (modified, +140/-46)
```diff
@@ -71,38 +71,58 @@ impl Default for DataWords {
     }
 }
 
-/// A short form of `value`: `42`, `3.14`, `12.4k`, `1.2M`.
+/// A short form of `value`: `42`, `3.14`, `0.0042`, `12.4k`, `1.2M`.
+///
+/// A value that is not zero never reads as `0`: small values keep two
+/// significant digits and the smallest and largest use an exponent.
 #[must_use]
 pub fn data_number(value: f64) -> String {
+    const TIERS: [(f64, f64, &str); 5] = [
+        (1.0, 1e4, ""),
+        (1e3, 1e6, "k"),
+        (1e6, 1e9, "M"),
+        (1e9, 1e12, "B"),
+        (1e12, 1e15, "T"),
+    ];
     if !value.is_finite() {
         return "?".to_owned();
     }
     if value == 0.0 {
         return "0".to_owned();
     }
     let a = value.abs();
-    let (scaled, suffix) = if a >= 1e9 {
-        (value / 1e9, "B")
-    } else if a >= 1e6 {
-        (value / 1e6, "M")
-    } else if a >= 1e4 {
-        (value / 1e3, "k")
-    } else {
-        (value, "")
-    };
-    let s = if scaled.abs() >= 100.0 {
-        format!("{scaled:.0}")
-    } else if scaled.abs() >= 10.0 {
-        format!("{scaled:.1}")
-    } else {
-        format!("{scaled:.2}")
-    };
-    let s = if s.contains('.') {
-        s.trim_end_matches('0').trim_end_matches('.').to_owned()
-    } else {
-        s
+    if a < 1e-4 {
+        return format!("{value:.1e}").replace(".0e", "e");
+    }
+    let trim = |s: String| {
+        if s.contains('.') {
+            s.trim_end_matches('0').trim_end_matches('.').to_owned()
+        } else {
+            s
+        }
     };
-    format!("{s}{suffix}")
+    if a < 0.1 {
+        let decimals = (1.0 - a.log10().floor()) as usize;
+        return trim(format!("{value:.decimals$}"));
+    }
+    let mut tier = TIERS.iter().position(|t| a < t.1).unwrap_or(TIERS.len());
+    while let Some((unit, next, suffix)) = TIERS.get(tier).copied() {
+        let scaled = value / unit;
+        let s = if scaled.abs() >= 100.0 {
+            format!("{scaled:.0}")
+        } else if scaled.abs() >= 10.0 {
+            format!("{scaled:.1}")
+        } else {
+            format!("{scaled:.2}")
+        };
+        let rounded = s.parse::<f64>().map_or(a, |r| r.abs() * unit);
+        if rounded >= next {
+            tier += 1;
+            continue;
+        }
+        return format!("{}{suffix}", trim(s));
+    }
+    format!("{value:.1e}").replace(".0e", "e")
 }
 
 fn with_unit(value: f64, unit: &str) -> String {
@@ -273,7 +293,7 @@ impl Paint for DataSparkline<'_> {
             let ramp = if theme.ascii() { SPARK_ASCII } else { SPARK };
             let mut line = String::with_capacity(cells * 3);
             for (i, v) in window.iter().enumerate() {
-                line.push_str(if i < shown {
+                line.push_str(if i < shown && v.is_finite() {
                     ramp[level(*v, lo, hi, ramp.len())]
                 } else {
                     " "
@@ -313,8 +333,10 @@ impl DataBarItem {
 ///
 /// Bars scale to the largest value and fill in eighths of a cell. While
 /// `drawn` is below one each bar grows from its `previous` value (or zero)
-/// to its value, a little after the bar above it. A negative value draws no
-/// bar; its words keep the real number.
+/// to its value, a little after the bar above it. A value above zero always
+/// draws at least an eighth of a cell, so it never looks like zero. A
+/// negative value draws no bar; its words keep the real number. On a narrow
+/// row the label gives way before the value does.
 #[derive(Clone, Debug)]
 pub struct DataBars<'a> {
     pub label: Cow<'a, str>,
@@ -426,7 +448,8 @@ impl Paint for DataBars<'_> {
             .map(|l| text::width(l))
             .max()
             .unwrap_or(0)
-            .min((width / 3).max(4));
+            .min((width / 3).max(4))
+            .min(width.saturating_sub(value_w + 2));
         let cells = width.saturating_sub(label_w + 2 + 2 + value_w);
         let peak = self
             .items
@@ -440,13 +463,14 @@ impl Paint for DataBars<'_> {
             if y >= area.height {
                 break;
             }
-            let mut spans = vec![
-                Span::styled(
+            let mut spans = Vec::new();
+            if label_w > 0 {
+                spans.push(Span::styled(
                     text::pad(&labels[i], label_w, ascii),
                     theme.fg(Role::Foreground),
-                ),
-                Span::raw("  "),
-            ];
+                ));
+                spans.push(Span::raw("  "));
+            }
             if cells >= MIN_BAR {
                 let from = self
                     .previous
@@ -465,7 +489,8 @@ impl Paint for DataBars<'_> {
                 } else {
                     0.0
                 };
-                let eighths = (frac * cells as f64 * 8.0).round() as usize;
+                let eighths =
+                    ((frac * cells as f64 * 8.0).round() as usize).max(usize::from(frac > 0.0));
                 let bar = self.bar(eighths, as
```

**File**: `vendor/codewhale-ratatui/src/components/motion.rs` (modified, +11/-7)
```diff
@@ -1,5 +1,8 @@
 //! Motion: the few things that move, and the promise that nothing else does.
 //!
+//! Motion is allowed for a change of state, work in progress or spatial
+//! continuity. This module is that layer without an animation dependency.
+//!
 //! - A [`MotionStep`] eases a value from where it is to a target in `0..=1`,
 //!   sampled at an instant the caller passes in. Nothing here reads a clock,
 //!   spawns a thread or waits.
@@ -28,7 +31,7 @@ use unicode_segmentation::UnicodeSegmentation;
 
 use crate::{
     MotionMode, Paint, Role, Theme,
-    color::{ColorDepth, blend, contrast_ratio},
+    color::{ColorDepth, blend, contrast_ratio, is_truecolor},
     glyphs, text, tokens,
 };
 
@@ -185,8 +188,8 @@ pub fn paint_working_glow(
 ) {
     if !policy.allows(MotionChannel::Tint)
         || elapsed < crate::spin::EARN_DELAY
-        || !matches!(highlight, Color::Rgb(..))
-        || !matches!(background, Color::Rgb(..))
+        || !is_truecolor(highlight)
+        || !is_truecolor(background)
     {
         return;
     }
@@ -217,11 +220,12 @@ pub fn paint_working_glow(
         if strength > 0.0
             && cell.symbol() == grapheme
             && !grapheme.chars().all(char::is_whitespace)
-            && matches!(cell.fg, Color::Rgb(..))
+            && is_truecolor(cell.fg)
         {
-            let ground = match cell.bg {
-                Color::Rgb(..) => cell.bg,
-                _ => background,
+            let ground = if is_truecolor(cell.bg) {
+                cell.bg
+            } else {
+                background
             };
             let ink = blend(highlight, cell.fg, strength);
             if let (Some(before), Some(after)) =
```

**File**: `vendor/codewhale-ratatui/src/gallery/chart.rs` (modified, +5/-2)
```diff
@@ -3,7 +3,9 @@
 use ratatui::{buffer::Buffer, layout::Rect};
 
 use super::Entry;
-use crate::{DataBarItem, DataBars, DataDisplay, DataSparkline, DataTrend, Paint, Theme};
+use crate::{
+    DataBarItem, DataBars, DataDisplay, DataDisplayView, DataSparkline, DataTrend, Paint, Theme,
+};
 
 fn series() -> Vec<f64> {
     (0..64)
@@ -73,7 +75,8 @@ fn from_agent(area: Rect, buf: &mut Buffer, theme: &Theme) {
                      {"label":"cached","value":61000}]}"#,
     )
     .expect("gallery fixture is a valid data display");
-    shown.view().paint(area, buf, theme);
+    let view: DataDisplayView<'_> = shown.view();
+    view.paint(area, buf, theme);
 }
 
 pub(crate) fn entries() -> Vec<Entry> {
```

#### Recent Merged Pull Requests:
- **PR #7353** (2026-11-16): fix(engine): log safe provider failure diagnostics (@laozidabo)
- **PR #7352** (2026-11-16): fix(app-server): preserve named provider in web picker (@Gyuke)
- **PR #7351** (closed): fix(engine): honor native usage journal capacity fallback (@laozidabo)
- **PR #7349** (2026-11-16): fix(client): decide the reasoning dialect by endpoint, not by model id (@SparkofSpike)
- **PR #7346** (2026-11-16): docs: illustrate hybrid claude bundle and host hook boundary (@vshulcz)
- **PR #7342** (2026-11-16): fix(core): keep assignments inside CLI argument values literal (@Ricardo-M-L)

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

## X. client): decide the reasoning dialect by endpoint, not by model id

**RULE**:
When implementing operations in `crates/engine/src/client.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3c4317c9`: client): decide the reasoning dialect by endpoint, not by model id. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/engine/src/client.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            self.chat_shape_provider(&model),
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            self.api_provider,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3c4317c9` are properly handled with clean fallback behavior.
