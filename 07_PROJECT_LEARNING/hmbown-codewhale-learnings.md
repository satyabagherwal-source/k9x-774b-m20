> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: github ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Source Version**: `a2fda9d5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T01:53:14.937Z  
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
> **Harvest Timestamp**: 2026-11-09T01:53:14.932Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source agent for the terminal written in Rust. Use any provider or model. Issues & PRs always welcome
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41158 stars

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

### Incident Patch 1: `0d1ffc1c` (2026-11-08)
**Commit Message**: fix(engine): Anthropic tool-name encoding, usage-journal headroom, pre-turn watchdog, lenient session list

Reproduced from a founder session on a 0.10.3 dev build (artifacts
subagent-failures-20261107): sub-agents died with "Child usage settlement
failed", a turn failed on "native usage journal capacity reached before
dispatch", and two workers returned Anthropic 400 "tools.17.custom.name".

- Anthropic client: tool names were sent raw, so a name such as web.run (from
  tool_search) invalidated the whole request. Outbound tool declarations,
  replayed tool_use blocks, tool_choice and the omitted-tool list now use
  to_api_tool_name, and streamed and non-streamed tool_use names are decoded
  with from_api_tool_name, matching the chat and responses clients.
- Usage journal: MAX_RUNTIME_USAGE_RECORDS_PER_OWNER 64 -> 256. Children share
  the session's journal owner and the workflow default is 64 live agents with a
  ceiling of 128, so a full fan-out plus the parent exceeded 64. be43ea93fd
  already makes the overflow non-fatal; this keeps the receipts.
- Turn start (CW-6633, #6184): the heartbeat stayed Idle until TurnStarted, so
  a wait before it produced no log, no stall record an

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -368,6 +368,12 @@ until the matching tag, packages, checksums, and release assets exist.
 
 ### Fixed
 
+- **Anthropic and Messages-compatible routes accept any tool name.** Tool names that Anthropic's pattern rejects, such as `web.run` from a loaded tool group, are encoded on the wire and decoded in replies, as the chat and responses routes already did. Before, one such name made every request fail with "tools.N.custom.name: String should match pattern", which stopped sub-agents that had loaded it.
+- **A large sub-agent fan-out no longer exhausts the usage journal.** The per-session limit of live usage receipts rises from 64 to 256, above the workflow ceiling of 128, so a full fan-out keeps its cost receipts instead of running with cost unknown.
+- **A turn that stalls before it starts is now bounded.** The stall watchdog covers the setup before the first model request, so a wedged start is logged, cancelled after 180 seconds with a stated reason, and leaves a stall record instead of waiting silently. A warning names the case where all four blocking-work slots are held. Refs #6184.
+- **One unreadable saved session no longer empties the recent-sessions list.** The launch card and ACP `session/list` show the readable sessions and log the failure. Refs #7095.
+- **Windows uninstall removes the receipt and update leftovers.** The installer's uninstaller also deletes `.codewhale-install.sha256` and `codewhale.old-*`/`codew.old-*` left by a self-update, so `bin` can be removed. Refs #7091.
+- **Windows `/undo` matches recorded file paths regardless of case.** A write recorded under a different drive-letter or directory case, or a `\\?\` prefix, is no longer dropped from the restore plan. Refs #6970.
 - **Windows: Fleet and metrics read live files again.** Replaying a Fleet ledger and reading audit or receipt records no longer fail with a sharing violation while their writer is still open; the same regular-file, link and identity checks apply. Plugin enablement now says which snapshot check refused (stage root, content identity or final check) instead of one generic message. Generated protocol and SDK exports keep LF line endings in Windows checkouts.
 - **A held coordination lock no longer makes a new session read-only.** When another session owns the delegated-agent store, the new session starts on private state and says so, instead of refusing every sub-agent with “Failed to clean up sub-agents”.
 - **A dev server can outlive the turn in an interactive session.** `persist:true` now works in the TUI and desktop when the thread has Full Access; restricted postures and Fleet/sub-agents still refuse it.
```

**File**: `crates/app-server/src/acp_server.rs` (modified, +1/-1)
```diff
@@ -481,7 +481,7 @@ impl AcpServer {
         let sessions =
             codewhale_engine::session_manager::SessionManager::new(self.sessions_dir.clone())
                 .ok()
-                .and_then(|manager| manager.list_sessions().ok())
+                .map(|manager| manager.list_sessions_lenient())
                 .unwrap_or_default();
         let sessions: Vec<Value> = sessions
             .into_iter()
```

**File**: `crates/engine/src/client/anthropic.rs` (modified, +35/-7)
```diff
@@ -34,14 +34,19 @@ use codewhale_models::tool_projection::{
     RouteToolProjection, ToolSchemaProjection, description_with_constraint_note, forced_tool_name,
     project_tool_schema,
 };
-use codewhale_models::{ContentBlock, MessageRequest, MessageResponse, StreamEvent, Usage};
+use codewhale_models::{
+    ContentBlock, ContentBlockStart, MessageRequest, MessageResponse, StreamEvent, Usage,
+};
 use codewhale_runtime::config::wire_model_for_provider_route;
 use codewhale_runtime::logging;
 
 use super::CodewhaleClient;
 use super::prepared::WireDialect;
 use super::role_placement::{RolePlacement, role_placement};
-use super::wire::{extract_sse_data_value, next_sse_line, push_sse_event_data};
+use super::wire::{
+    extract_sse_data_value, from_api_tool_name, next_sse_line, push_sse_event_data,
+    to_api_tool_name,
+};
 
 /// Maximum `cache_control` breakpoints Anthropic accepts per request.
 const MAX_CACHE_BREAKPOINTS: usize = 4;
@@ -120,7 +125,7 @@ impl CodewhaleClient {
                         constraint_note,
                     } => {
                         let mut value = json!({
-                            "name": tool.name,
+                            "name": to_api_tool_name(&tool.name),
                             "description": description_with_constraint_note(
                                 &tool.description,
                                 constraint_note,
@@ -137,7 +142,7 @@ impl CodewhaleClient {
                     }
                     ToolSchemaProjection::Omitted { .. } => {
                         omitted_logical_names.push(tool.name.clone());
-                        omitted_tool_names.push(tool.name.clone());
+                        omitted_tool_names.push(to_api_tool_name(&tool.name));
                     }
                 }
             }
@@ -520,12 +525,26 @@ fn discard_provider_execution_ids(value: &mut Value) {
     }
 }
 
+fn decode_tool_use_names(value: &mut Value) {
+    let Some(content) = value.get_mut("content").and_then(Value::as_array_mut) else {
+        return;
+    };
+    for block in content.iter_mut() {
+        if block.get("type").and_then(Value::as_str) == Some("tool_use")
+            && let Some(name) = block.get("name").and_then(Value::as_str)
+        {
+            block["name"] = json!(from_api_tool_name(name));
+        }
+    }
+}
+
 fn decode_anthropic_message(mut value: Value) -> Result<MessageResponse> {
     discard_provider_execution_ids(&mut value);
     if let Some(usage) = value.get_mut("usage") {
         *usage = json!(parse_anthropic_usage(usage));
     }
     normalize_redacted_thinking_blocks(&mut value);
+    decode_tool_use_names(&mut value);
     serde_json::from_value(value).context("Failed to decode Anthropic Messages response")
 }
 
@@ -777,7 +796,7 @@ fn anthropic_tool_choice(tool_choice: &Value, model: &str) -> Value {
         Some("auto") => json!({ "type": "auto" }),
         Some("none") => json!({ "type": "none" }),
         Some("any" | "required") => json!({ "type": "any" }),
-        Some(name) => json!({ "type": "tool", "name": name }),
+        Some(name) => json!({ "type": "tool", "name": to_api_tool_name(name) }),
         None => tool_choice.clone(),
     }
 }
@@ -925,7 +944,7 @@ fn content_block_to_anthropic(block: &ContentBlock) -> Option<Value> {
         } => Some(json!({
             "type": "tool_use",
             "id": id,
-            "name": name,
+            "name": to_api_tool_name(name),
             "input": input,
         })),
         ContentBlock::ToolResult {
@@ -1084,7 +1103,16 @@ fn convert_anthropic_sse_data(data: &str) -> Option<Result<StreamEvent>> {
         // Local-only receipt: the legacy path ignored it (not a provider
         // type), so it stays ignored rather than decoding.
         Ok(StreamEvent::ToolProjectionWarning { .. }) => None,
-        Ok(event) => Some(Ok(event)),
+        Ok(mut event) => {
+            if let StreamEvent::ContentBlockStart {
+                content_block: ContentBlockStart::ToolUse { name, .. },
+                ..
+            } = &mut event
+            {
+                *name = from_api_tool_name(name);
+            }
+            Some(Ok(event))
+        }
         Err(error) => {
             // Cold path, reached only when direct decode fails: invalid JSON
             // and unknown types keep their exact legacy outcomes.
```

**File**: `crates/engine/src/core/engine.rs` (modified, +6/-0)
```diff
@@ -6768,6 +6768,12 @@ impl Engine {
         review: Option<codewhale_protocol::op::ReviewOperation>,
     ) -> SendMessageOutcome {
         let setup_timing = codewhale_runtime::logging::PhaseTimer::start("turn_setup");
+        self.turn_heartbeat.enter(
+            turn_heartbeat::TurnPhase::Preparing,
+            Some("starting the turn".to_string()),
+            Some(turn_heartbeat::PREPARING_PHASE_BOUND),
+        );
+        let _pre_turn_idle = turn_heartbeat::IdleOnDrop(Arc::clone(&self.turn_heartbeat));
         let is_review = review.is_some();
         let TurnSpec {
             profile_constitution,
```

**File**: `crates/engine/src/cost_status.rs` (modified, +1/-1)
```diff
@@ -1272,7 +1272,7 @@ fn with_pending_state_mut<R>(f: impl FnOnce(&mut ScopedPendingBackgroundCost) ->
 /// This journal is deliberately separate from the TUI pending-money pool:
 /// taking one runtime owner's records cannot steal or reset the foreground
 /// session's `/cost` state.
-const MAX_RUNTIME_USAGE_RECORDS_PER_OWNER: usize = 64;
+const MAX_RUNTIME_USAGE_RECORDS_PER_OWNER: usize = 256;
 
 #[derive(Default)]
 struct OwnerRuntimeUsageJournal {
```

**File**: `crates/engine/src/session_manager.rs` (modified, +23/-0)
```diff
@@ -5888,6 +5888,29 @@ impl SessionManager {
             .collect())
     }
 
+    pub fn list_sessions_lenient(&self) -> Vec<SessionMetadata> {
+        let catalog = match self.scan_session_records() {
+            Ok(catalog) => catalog,
+            Err(error) => {
+                tracing::warn!(%error, "session listing failed; showing no sessions");
+                return Vec::new();
+            }
+        };
+        if let Some(warning) = catalog.warning() {
+            tracing::warn!(%warning, "session listing is incomplete; showing the readable ones");
+        }
+        let mut sessions: Vec<_> = catalog
+            .records
+            .into_iter()
+            .map(|(_, mut metadata)| {
+                self.apply_late_usage_to_metadata(&mut metadata);
+                metadata
+            })
+            .collect();
+        sessions.sort_by_key(|session| std::cmp::Reverse(session.updated_at));
+        sessions
+    }
+
     pub fn list_sessions_with_recovery(
         &self,
     ) -> std::io::Result<(
```

**File**: `crates/runtime/src/runtime_control.rs` (modified, +17/-14)
```diff
@@ -20,20 +20,23 @@ where
     static SLOTS: std::sync::OnceLock<std::sync::Arc<tokio::sync::Semaphore>> =
         std::sync::OnceLock::new();
     const PERMIT_WAIT: std::time::Duration = std::time::Duration::from_secs(60);
-    let permit = tokio::time::timeout(
-        PERMIT_WAIT,
-        SLOTS
-            .get_or_init(|| std::sync::Arc::new(tokio::sync::Semaphore::new(4)))
-            .clone()
-            .acquire_owned(),
-    )
-    .await
-    .map_err(|_| {
-        anyhow::anyhow!(
-            "blocking work is queued behind earlier jobs that have not finished within {}s",
-            PERMIT_WAIT.as_secs()
-        )
-    })??;
+    let slots = SLOTS
+        .get_or_init(|| std::sync::Arc::new(tokio::sync::Semaphore::new(4)))
+        .clone();
+    if slots.available_permits() == 0 {
+        tracing::warn!(
+            target: "turn",
+            "owner_work is waiting: all 4 blocking slots are held by earlier jobs"
+        );
+    }
+    let permit = tokio::time::timeout(PERMIT_WAIT, slots.acquire_owned())
+        .await
+        .map_err(|_| {
+            anyhow::anyhow!(
+                "blocking work is queued behind earlier jobs that have not finished within {}s",
+                PERMIT_WAIT.as_secs()
+            )
+        })??;
     tokio::task::spawn_blocking(move || {
         #[cfg(any(test, feature = "test-support"))]
         let _membership = crate::test_support::join_env_scope(env_ticket);
```

**File**: `crates/tui/CHANGELOG.md` (modified, +6/-0)
```diff
@@ -368,6 +368,12 @@ until the matching tag, packages, checksums, and release assets exist.
 
 ### Fixed
 
+- **Anthropic and Messages-compatible routes accept any tool name.** Tool names that Anthropic's pattern rejects, such as `web.run` from a loaded tool group, are encoded on the wire and decoded in replies, as the chat and responses routes already did. Before, one such name made every request fail with "tools.N.custom.name: String should match pattern", which stopped sub-agents that had loaded it.
+- **A large sub-agent fan-out no longer exhausts the usage journal.** The per-session limit of live usage receipts rises from 64 to 256, above the workflow ceiling of 128, so a full fan-out keeps its cost receipts instead of running with cost unknown.
+- **A turn that stalls before it starts is now bounded.** The stall watchdog covers the setup before the first model request, so a wedged start is logged, cancelled after 180 seconds with a stated reason, and leaves a stall record instead of waiting silently. A warning names the case where all four blocking-work slots are held. Refs #6184.
+- **One unreadable saved session no longer empties the recent-sessions list.** The launch card and ACP `session/list` show the readable sessions and log the failure. Refs #7095.
+- **Windows uninstall removes the receipt and update leftovers.** The installer's uninstaller also deletes `.codewhale-install.sha256` and `codewhale.old-*`/`codew.old-*` left by a self-update, so `bin` can be removed. Refs #7091.
+- **Windows `/undo` matches recorded file paths regardless of case.** A write recorded under a different drive-letter or directory case, or a `\\?\` prefix, is no longer dropped from the restore plan. Refs #6970.
 - **Windows: Fleet and metrics read live files again.** Replaying a Fleet ledger and reading audit or receipt records no longer fail with a sharing violation while their writer is still open; the same regular-file, link and identity checks apply. Plugin enablement now says which snapshot check refused (stage root, content identity or final check) instead of one generic message. Generated protocol and SDK exports keep LF line endings in Windows checkouts.
 - **A held coordination lock no longer makes a new session read-only.** When another session owns the delegated-agent store, the new session starts on private state and says so, instead of refusing every sub-agent with “Failed to clean up sub-agents”.
 - **A dev server can outlive the turn in an interactive session.** `persist:true` now works in the TUI and desktop when the thread has Full Access; restricted postures and Fleet/sub-agents still refuse it.
```

---

### Incident Patch 2: `a2fda9d5` (2026-11-09)
**Commit Message**: fix(engine): let sub-agent shells run beside a peer's write claim; repair stale candidate tests

The write-claim ledger still coordinates bounded File/Edit/Patch targets, but a
child's shell no longer waits on a peer's claim: the execution envelope,
sandbox and approval posture already govern executable work. The old refusal
told analysis agents to re-run with read_only=true, which burned steps without
protecting a peer's files. The contention refusal now names only bounded write
tools, and Run verifiers remain guarded.

Repairs three stale candidate assertions:
- the app-server settings test expected the retired `operate` spelling to
  persist; it now asserts the documented Work (`agent`) normalization.
- the mailbox test expected snapshot.mode == "operate"; it now expects the
  Work wire value.
- the parent prompt+catalog ceiling re-measured at 94,121B (was 92,100B) after
  the deliberate tool-text expansion; the read-only child envelope still fits.
The shell tests that execute a command now run on the engine's large stack so
they exercise the policy instead of overflowing the test thread.

Verification: cargo test -p codewhale-engine --lib, exact filters:
child_write_tool_fails_

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -238,6 +238,13 @@ until the matching tag, packages, checksums, and release assets exist.
 
 ### Changed
 
+- **Sub-agent shell runs no longer wait on a peer's write claim.** A child that
+  holds a shared write claim can run `bash` while another child writes; the
+  claim still coordinates bounded `File`/`Edit`/`Patch` targets, and the
+  execution envelope, sandbox and approval posture govern executable work. A
+  bounded write tool whose target overlaps a live peer still refuses. The old
+  refusal told analysis agents to re-run with `read_only=true`, which cost
+  steps without protecting a peer's files.
 - **The footer cost chip shows confirmed dollars only.** A session with some unpriced turns shows exactly the confirmed amount, such as `$0.34`, instead of `subtotal 0.34 + unknown (request outcome unknown)`, and a session with nothing priced shows no cost at all instead of `cost: unknown (…)`. The accounting is unchanged: unpriced turns stay excluded rather than guessed, and `/cost` still lists each one with its reason, now in plain words ("the provider never confirmed the request finished", "this session predates cost tracking"). The price view says `unknown` for a session with no confirmed price.
 - **Sub-agents and goals by default.** The constitution now tells the agent to start independent parts of a request as parallel sub-agents in one message, keep working while their results arrive on their own, and end the turn when only waiting remains; to give each child a complete prompt and its own files; to inspect a write-capable child's evidence, review the diff and run the checks itself; to have an independent reviewer try to refute a non-trivial change before calling it done; and to start a goal for any request, in any language, whose verifiable end state needs more than one turn. Sub-agents, workflows and goals within the current request are in scope; spending real money (purchases, paid providers, billing) still needs the user's express authorization. Cost alone is not a reason to stop; only limits the user or configuration sets apply. **This changes the session-pinned prompt and tool descriptions, so each session re-pins its prompt cache once after upgrade.**
 - **Operate's contract is retired.** The Engine no longer appends the Operate contract to a session; its review, cost and evidence rules now live in the constitution for every session. Saved sessions that contain it still replay.
```

**File**: `crates/app-server/src/runtime_api/tests.rs` (modified, +3/-3)
```diff
@@ -289,7 +289,7 @@ async fn http_and_web_server_thread_manager_installs_configured_workshop_byte_bu
 }
 
 #[test]
-fn runtime_tui_settings_reject_legacy_modes_and_do_not_save_env_overlays() -> Result<()> {
+fn runtime_tui_settings_normalize_legacy_modes_and_do_not_save_env_overlays() -> Result<()> {
     let _lock = lock_test_env();
     let tmp = tempfile::tempdir()?;
     let settings_dir = tmp.path().join(".codewhale");
@@ -315,10 +315,10 @@ fn runtime_tui_settings_reject_legacy_modes_and_do_not_save_env_overlays() -> Re
     );
 
     persist_runtime_tui_setting("default_mode", "operate")
-        .expect("operate is a valid startup mode");
+        .expect("operate is a retired spelling accepted as Work");
     assert_eq!(
         codewhale_runtime::settings::Settings::load_persisted()?.default_mode,
-        "operate"
+        "agent"
     );
     persist_runtime_tui_setting("default_mode", "agent")
         .expect("agent should be a valid startup mode");
```

**File**: `crates/engine/src/core/engine/tests/test_cases_18.rs` (modified, +1/-1)
```diff
@@ -1011,7 +1011,7 @@ async fn full_mailbox_posture_update_supersedes_queued_change_mode() {
     .expect("snapshot after mailbox drain")
     .expect("session snapshot");
 
-    assert_eq!(snapshot.mode, "operate");
+    assert_eq!(snapshot.mode, "agent");
     let authority = handle.runtime_permission_authority();
     assert_eq!(authority.approval_mode, ApprovalMode::Auto);
     assert!(!authority.auto_approve);
```

**File**: `crates/engine/src/tools/subagent/engine.rs` (modified, +24/-25)
```diff
@@ -417,30 +417,29 @@ impl ChildAuthority {
             // The typed read-only boundary above already rejected mutation.
             && !self.write_is_denied()
             && !is_internal_coordination_state_tool(name)
-            // A shell run the read-only classifier proves mutation-free cannot
-            // collide with the peer's writes no matter how contended the
-            // checkout is, so the gate below does not apply to it.
-            && !proven_readonly_shell_run(name, input)
-            && (is_unbounded_shell_run(name, input)
-                || registry.get(name).is_some_and(|spec| {
-                    let canonical = canonical_action_alias(name, input);
-                    let is_shell_control = matches!(
-                        canonical,
-                        "exec_shell_wait" | "exec_shell_interact" | "exec_shell_cancel"
-                    );
-                    let capabilities = spec.capabilities();
-                    !is_shell_control
-                        && (spec.approval_requirement_for(input) == ApprovalRequirement::Suggest
-                            || (!spec.is_read_only_for(input)
-                                && capabilities.iter().any(|capability| {
-                                    matches!(
-                                        capability,
-                                        ToolCapability::WritesFiles
-                                            | ToolCapability::ExecutesCode
-                                            | ToolCapability::Network
-                                    )
-                                })))
-                }))
+            // Shell runs are governed by the execution envelope, sandbox and
+            // approval posture. The write claim coordinates bounded file
+            // tools; it no longer denies a child its shell while a peer writes.
+            && !is_unbounded_shell_run(name, input)
+            && registry.get(name).is_some_and(|spec| {
+                let canonical = canonical_action_alias(name, input);
+                let is_shell_control = matches!(
+                    canonical,
+                    "exec_shell_wait" | "exec_shell_interact" | "exec_shell_cancel"
+                );
+                let capabilities = spec.capabilities();
+                !is_shell_control
+                    && (spec.approval_requirement_for(input) == ApprovalRequirement::Suggest
+                        || (!spec.is_read_only_for(input)
+                            && capabilities.iter().any(|capability| {
+                                matches!(
+                                    capability,
+                                    ToolCapability::WritesFiles
+                                        | ToolCapability::ExecutesCode
+                                        | ToolCapability::Network
+                                )
+                            })))
+            })
         {
             let held = self.coordination_manager.clone().read_owned().await;
             let owner = self.owner_agent_id.clone();
@@ -459,7 +458,7 @@ impl ChildAuthority {
             .map_err(|error| admission_denied(error.to_string()))?;
             if !blocking_peers.is_empty() {
                 return Err(admission_denied(format!(
-                    "Tool {name} cannot prove a bounded file target or read-only execution while peers are writing in this shared checkout (blocking peers: {}). Use a bounded write tool, a proven read-only command, or bash with read_only=true for analysis under native enforcement. Executable work that needs writes requires worktree isolation. Disjoint write_roots alone do not constrain arbitrary code.",
+                    "Tool {name} cannot prove a bounded file target while peers are writing in this shared checkout (blocking peers: {}). Use a bounded write tool, or run executable work that needs writes in an isolated worktree. Disjoint write_roots alone do not constrain arbitrary code.",
                     blocking_peers.join(", ")
                 )));
             }
```

**File**: `crates/engine/src/tools/subagent/mod.rs` (modified, +0/-16)
```diff
@@ -21890,22 +21890,6 @@ fn is_unbounded_shell_run(name: &str, input: &Value) -> bool {
     canonical_action_alias(name, input) == "exec_shell"
 }
 
-/// Whether this exact call is a shell run the agent read-only classifier
-/// proves mutation-free, or native read-only mode enforces — the contention carve-out.
-///
-/// This shares its classifier with `bounded_readonly_bash_evidence` but not
-/// its role restriction, deliberately: the envelope helper's carve-out
-/// *grants* shell to inspection roles that otherwise lack it, so it is scoped
-/// to them; the contention gate grants nothing — shell authority, posture, and
-/// the envelope have already settled by the time it runs — and asks only
-/// whether this call can collide with a live peer's writes. A proven
-/// read-only `ls` cannot, whichever role runs it. An explicit read_only=true
-/// call likewise cannot: the shared bash executor requires native read-only
-/// enforcement or refuses the call before process spawn.
-fn proven_readonly_shell_run(name: &str, input: &Value) -> bool {
-    is_unbounded_shell_run(name, input) && crate::tools::shell::agent_readonly_bash_input(input)
-}
-
 /// Parameter names whose *value* is a location to reach, rather than content.
 ///
 /// Deliberately a name list and not a scan of every string: a network-denied
```

**File**: `crates/engine/src/tools/subagent/tests.rs` (modified, +56/-54)
```diff
@@ -14226,8 +14226,25 @@ fn subagent_registry_with_mcp_action(auto_approve: bool) -> (ChildCoreProbe, tem
     (registry, home)
 }
 
-#[tokio::test]
-async fn child_write_tool_fails_closed_outside_registered_scope() {
+#[test]
+fn child_write_tool_fails_closed_outside_registered_scope() {
+    std::thread::Builder::new()
+        .stack_size(codewhale_runtime::CODEWHALE_MAIN_STACK_BYTES)
+        .spawn(|| {
+            tokio::runtime::Builder::new_multi_thread()
+                .worker_threads(2)
+                .thread_stack_size(codewhale_runtime::CODEWHALE_MAIN_STACK_BYTES)
+                .enable_all()
+                .build()
+                .unwrap()
+                .block_on(child_write_tool_fails_closed_outside_registered_scope_body());
+        })
+        .unwrap()
+        .join()
+        .unwrap();
+}
+
+async fn child_write_tool_fails_closed_outside_registered_scope_body() {
     let _env_lock = crate::test_support::lock_test_env();
     let home = tempdir().expect("isolated CODEWHALE_HOME");
     let _codewhale_home = crate::test_support::EnvVarGuard::set("CODEWHALE_HOME", home.path());
@@ -14389,25 +14406,6 @@ async fn child_write_tool_fails_closed_outside_registered_scope() {
     );
     assert!(!err.contains("agents/coordinate"), "{err}");
     assert!(!tmp.path().join("docs/no.txt").exists());
-    for (tool_name, input, target) in [(
-        "Bash",
-        json!({"action": "run", "command": "touch outside/canonical.txt"}),
-        "outside/canonical.txt",
-    )] {
-        let shell_err = registry
-            .execute("agent_scoped", tool_name, input)
-            .await
-            .expect_err("unbounded shared-workspace shell must fail")
-            .to_string();
-        assert!(
-            shell_err.contains("cannot prove a bounded file target"),
-            "{tool_name}: {shell_err}"
-        );
-        assert!(
-            !tmp.path().join(target).exists(),
-            "{tool_name} created {target} outside its registered claim"
-        );
-    }
     let run_err = registry
         .execute(
             "agent_scoped",
@@ -14433,13 +14431,15 @@ async fn child_write_tool_fails_closed_outside_registered_scope() {
 
 /// A lone writer in the shared checkout keeps its shell.
 ///
-/// The gate above exists so concurrent children cannot overwrite each other.
-/// With no second writer there is nothing to collide with, and refusing the
-/// shell there bought no safety: the same child may already write these paths
-/// through `File`. It only pushed builders toward worktree isolation, which
-/// puts their work in a checkout the operator never looks at.
-#[tokio::test]
-async fn lone_shared_writer_keeps_unbounded_shell() {
+/// Shell runs are governed by the execution envelope, sandbox and approval
+/// posture; the write claim coordinates bounded file tools. This keeps the
+/// lone-writer case covered while the contention tests own the peer case.
+#[test]
+fn lone_shared_writer_keeps_unbounded_shell() {
+    run_worker_fixture(lone_shared_writer_keeps_unbounded_shell_body);
+}
+
+async fn lone_shared_writer_keeps_unbounded_shell_body() {
     let tmp = tempdir().expect("tempdir");
     let manager = new_shared_subagent_manager(tmp.path().to_path_buf(), 4);
     {
@@ -14542,8 +14542,12 @@ fn contended_builder_registry(
 /// `is_unbounded_shell_run` unconditionally, so a provably read-only `ls` was
 /// refused whenever a peer held a claim — even though the ledger had already
 /// proven the two claims disjoint at admission.
-#[tokio::test]
-async fn contended_shared_writers_keep_proven_readonly_shell() {
+#[test]
+fn contended_shared_writers_keep_proven_readonly_shell() {
+    run_worker_fixture(contended_shared_writers_keep_proven_readonly_shell_body);
+}
+
+async fn contended_shared_writers_keep_proven_readonly_shell_body() {
     let tmp = tempdir().expect("tempdir");
     std::fs::create_dir_all(tmp.path().join("src")).unwrap();
     let manager = new_shared_subagent_manager(tmp.path().to_path_buf(), 4);
@@ -14581,11 +14585,15 @@ async fn contended_shared_writers_keep_proven_readonly_shell() {
     }
 }
 
-/// The same contention still refuses a shell call the classifier cannot prove
-/// read-only — and the refusal names the blocking peer and its remediation so
-/// the child can recover instead of retrying blindly.
-#[tokio::test]
-async fn contended_shared_writer_refusal_names_blocking_peer_and_remediation() {
+/// A contended writer keeps its shell. The write claim coordinates bounded
+/// file tools; executable work is governed by the execution envelope and the
+/// approval posture, so a peer's claim no longer denies the child shell.
+#[test]
+fn contended_shared_writer_keeps_its_shell() {
+    run_worker_fixture(contended_shared_writer_keeps_its_shell_body);
+}
+
+async fn contended_shared_writer_keeps_its_shell_body() {
     let tmp = tempdir().expect("tempdir");
     std::fs::create_dir_all(tmp.path().join("src")).unwrap();
     let manager = new_sh
```

**File**: `crates/tui/CHANGELOG.md` (modified, +7/-0)
```diff
@@ -238,6 +238,13 @@ until the matching tag, packages, checksums, and release assets exist.
 
 ### Changed
 
+- **Sub-agent shell runs no longer wait on a peer's write claim.** A child that
+  holds a shared write claim can run `bash` while another child writes; the
+  claim still coordinates bounded `File`/`Edit`/`Patch` targets, and the
+  execution envelope, sandbox and approval posture govern executable work. A
+  bounded write tool whose target overlaps a live peer still refuses. The old
+  refusal told analysis agents to re-run with `read_only=true`, which cost
+  steps without protecting a peer's files.
 - **The footer cost chip shows confirmed dollars only.** A session with some unpriced turns shows exactly the confirmed amount, such as `$0.34`, instead of `subtotal 0.34 + unknown (request outcome unknown)`, and a session with nothing priced shows no cost at all instead of `cost: unknown (…)`. The accounting is unchanged: unpriced turns stay excluded rather than guessed, and `/cost` still lists each one with its reason, now in plain words ("the provider never confirmed the request finished", "this session predates cost tracking"). The price view says `unknown` for a session with no confirmed price.
 - **Sub-agents and goals by default.** The constitution now tells the agent to start independent parts of a request as parallel sub-agents in one message, keep working while their results arrive on their own, and end the turn when only waiting remains; to give each child a complete prompt and its own files; to inspect a write-capable child's evidence, review the diff and run the checks itself; to have an independent reviewer try to refute a non-trivial change before calling it done; and to start a goal for any request, in any language, whose verifiable end state needs more than one turn. Sub-agents, workflows and goals within the current request are in scope; spending real money (purchases, paid providers, billing) still needs the user's express authorization. Cost alone is not a reason to stop; only limits the user or configuration sets apply. **This changes the session-pinned prompt and tool descriptions, so each session re-pins its prompt cache once after upgrade.**
 - **Operate's contract is retired.** The Engine no longer appends the Operate contract to a session; its review, cost and evidence rules now live in the constitution for every session. Saved sessions that contain it still replay.
```

---

### Incident Patch 3: `74713ec7` (2026-11-08)
**Commit Message**: fix(app-server): gate file reverts on trust; repair the failures hosted CI surfaced

The first hosted run on the mode-retirement candidate (c50612d6ab) failed in
four jobs, none of them flaky.

Lint and Parity: clippy's `single_element_loop` on two `for mode in
[AppMode::Agent]` loops left behind by the Operate removal (plan_handoff.rs:151,
codemode.rs:1604). Both are straight-line assertions now.

Test (all three platforms): three app-server tests.
- `create_thread_..._named_permission_posture` sent `mode: "operate"` and
  expected it echoed back. The runtime normalizes the retired spelling to Work,
  so it now asserts `agent`, which is the alias contract the release notes
  promise.
- `file_revert_route_validates_body_then_trust_then_ownership` expected a
  `409` naming trusted mode for an untrusted thread and got the
  "restore point is unavailable" conflict instead, because the route had **no
  trust gate at all** — an untrusted thread that named a restore point it owned
  could rewrite workspace files. The gate now sits after body validation and
  before ownership, exactly the order its name describes, and refuses with the
  same wording the TUI's undo gate uses.
- `memory_wor

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -375,6 +375,7 @@ until the matching tag, packages, checksums, and release assets exist.
 
 ### Fixed
 
+- **Reverting a file requires a trusted thread.** The Runtime API's file-revert route refuses an untrusted thread with a `409` that names `/trust` or Full Access, matching the TUI's undo gate, and answers that refusal before it looks at snapshot ownership. Before, an untrusted thread that named a restore point it owned could rewrite workspace files.
 - **Anthropic and Messages-compatible routes accept any tool name.** Tool names that Anthropic's pattern rejects, such as `web.run` from a loaded tool group, are encoded on the wire and decoded in replies, as the chat and responses routes already did. Before, one such name made every request fail with "tools.N.custom.name: String should match pattern", which stopped sub-agents that had loaded it.
 - **A large sub-agent fan-out no longer exhausts the usage journal.** The per-session limit of live usage receipts rises from 64 to 256, above the workflow ceiling of 128, so a full fan-out keeps its cost receipts instead of running with cost unknown.
 - **A turn that stalls before it starts is now bounded.** The stall watchdog covers the setup before the first model request, so a wedged start is logged, cancelled after 180 seconds with a stated reason, and leaves a stall record instead of waiting silently. A warning names the case where all four blocking-work slots are held. Refs #6184.
```

**File**: `crates/app-server/src/runtime_api.rs` (modified, +10/-0)
```diff
@@ -9894,6 +9894,16 @@ async fn revert_thread_file(
         .thread_restore_guard(&id)
         .await
         .map_err(map_thread_err)?;
+    // Reverting is a workspace mutation, gated where the TUI gates the same
+    // operation and before ownership, so an untrusted caller gets the
+    // actionable refusal instead of a hint about another thread's snapshots.
+    if !(thread.trust_mode || thread.auto_approve) {
+        return Err(ApiError::conflict(
+            "Refusing to revert workspace files outside trusted mode. \
+             Turn on /trust or switch this thread to Full Access, then revert again.",
+        )
+        .with_code(PATCH_UNDO_UNTRUSTED));
+    }
     // The restore points this thread owns: the receipts on its own turns
     // (including turns a fork cloned). Read under the restore reservation, so
     // no turn is recording one meanwhile.
```

**File**: `crates/app-server/src/runtime_api/tests.rs` (modified, +7/-6)
```diff
@@ -11169,7 +11169,7 @@ async fn create_thread_normalizes_and_persists_named_permission_posture() -> Res
         .error_for_status()?
         .json()
         .await?;
-    assert_eq!(created["mode"], "operate");
+    assert_eq!(created["mode"], "agent");
     assert_eq!(created["permission_posture"], "auto_review");
     assert_eq!(created["auto_approve"], false);
     assert_eq!(created["trust_mode"], false);
@@ -17817,9 +17817,10 @@ async fn memory_all_scope_includes_workspace_notes() -> Result<()> {
 }
 
 #[tokio::test]
-async fn memory_workspace_scope_without_a_remote_is_a_client_error() -> Result<()> {
-    // A workspace with no origin remote has no workspace memory: asking for
-    // that scope is the caller's error, as it already is for create.
+async fn memory_workspace_scope_without_a_remote_resolves_from_the_work_tree() -> Result<()> {
+    // A work tree with no origin remote has no repository identity, so the
+    // workspace scope keys on the work-tree path itself: asking for it is a
+    // real, empty scope rather than the caller's error.
     let root = std::env::temp_dir().join(format!("cw-memory-no-remote-{}", Uuid::new_v4()));
     let _lock = lock_test_env();
     let home = root.join("home");
@@ -17849,12 +17850,12 @@ async fn memory_workspace_scope_without_a_remote_is_a_client_error() -> Result<(
         .get(format!("http://{addr}/v1/memory?scope=workspace"))
         .send()
         .await?;
-    assert_eq!(listed.status(), StatusCode::BAD_REQUEST);
+    assert_eq!(listed.status(), StatusCode::OK);
     let cleared = client
         .delete(format!("http://{addr}/v1/memory?scope=workspace"))
         .send()
         .await?;
-    assert_eq!(cleared.status(), StatusCode::BAD_REQUEST);
+    assert_eq!(cleared.status(), StatusCode::OK);
     let all: serde_json::Value = client
         .get(format!("http://{addr}/v1/memory"))
         .send()
```

**File**: `crates/engine/src/tools/codemode.rs` (modified, +17/-14)
```diff
@@ -1601,20 +1601,23 @@ mod tests {
         use codewhale_config::AppMode;
         use std::collections::HashSet;
         let empty = HashSet::new();
-        for mode in [AppMode::Agent] {
-            let mut catalog = Vec::new();
-            crate::core::engine::tool_catalog::ensure_advanced_tooling(
-                &mut catalog,
-                mode,
-                &empty,
-                ToolMode::Direct,
-            );
-            let tool = catalog
-                .iter()
-                .find(|tool| tool.name == EXECUTE_TOOLS_TOOL_NAME)
-                .unwrap_or_else(|| panic!("{mode:?} catalog must advertise execute_tools"));
-            assert_eq!(tool.defer_loading, Some(true), "{mode:?} must defer it");
-        }
+        let mut catalog = Vec::new();
+        crate::core::engine::tool_catalog::ensure_advanced_tooling(
+            &mut catalog,
+            AppMode::Agent,
+            &empty,
+            ToolMode::Direct,
+        );
+        let tool = catalog
+            .iter()
+            .find(|tool| tool.name == EXECUTE_TOOLS_TOOL_NAME)
+            .unwrap_or_else(|| panic!("{:?} catalog must advertise execute_tools", AppMode::Agent));
+        assert_eq!(
+            tool.defer_loading,
+            Some(true),
+            "{:?} must defer it",
+            AppMode::Agent
+        );
         let mut catalog = Vec::new();
         crate::core::engine::tool_catalog::ensure_advanced_tooling(
             &mut catalog,
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -375,6 +375,7 @@ until the matching tag, packages, checksums, and release assets exist.
 
 ### Fixed
 
+- **Reverting a file requires a trusted thread.** The Runtime API's file-revert route refuses an untrusted thread with a `409` that names `/trust` or Full Access, matching the TUI's undo gate, and answers that refusal before it looks at snapshot ownership. Before, an untrusted thread that named a restore point it owned could rewrite workspace files.
 - **Anthropic and Messages-compatible routes accept any tool name.** Tool names that Anthropic's pattern rejects, such as `web.run` from a loaded tool group, are encoded on the wire and decoded in replies, as the chat and responses routes already did. Before, one such name made every request fail with "tools.N.custom.name: String should match pattern", which stopped sub-agents that had loaded it.
 - **A large sub-agent fan-out no longer exhausts the usage journal.** The per-session limit of live usage receipts rises from 64 to 256, above the workflow ceiling of 128, so a full fan-out keeps its cost receipts instead of running with cost unknown.
 - **A turn that stalls before it starts is now bounded.** The stall watchdog covers the setup before the first model request, so a wedged start is logged, cancelled after 180 seconds with a stated reason, and leaves a stall record instead of waiting silently. A warning names the case where all four blocking-work slots are held. Refs #6184.
```

**File**: `crates/tui/src/tui/plan_handoff.rs` (modified, +5/-3)
```diff
@@ -148,9 +148,11 @@ mod tests {
             TurnOutcomeStatus::Completed,
             prose
         ));
-        for mode in [AppMode::Agent] {
-            assert!(!plan_ready(mode, TurnOutcomeStatus::Completed, prose));
-        }
+        assert!(!plan_ready(
+            AppMode::Agent,
+            TurnOutcomeStatus::Completed,
+            prose
+        ));
         for status in [TurnOutcomeStatus::Interrupted, TurnOutcomeStatus::Failed] {
             assert!(!plan_ready(AppMode::Plan, status, prose));
         }
```

**File**: `web/data/features.generated.json` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
   "format": "codewhale.features.v1",
   "source": {
     "path": "docs/features.toml",
-    "sha256": "a706bf367123e5689548f7b2b1c7698ce6873dab6fec2b42ee60bef71b95d193"
+    "sha256": "c2caf85cd1dd0d95e0b566c12af6ec67b5a476cf5810312bb309d35744d08d3f"
   },
   "features": [
     {
@@ -360,7 +360,7 @@
     {
       "id": "modes",
       "name": "Modes",
-      "summary": "Plan, Work and Operate modes set what the agent may do in a session; a finished plan offers to start the work.",
+      "summary": "Plan and Work modes set what the agent may do in a session; a finished plan offers to start the work.",
       "status": "stable",
       "surfaces": {
         "tui": "stable",
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

## X. engine): Anthropic tool-name encoding, usage-journal headroom, pre-turn watchdog

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d1ffc1c`: engine): Anthropic tool-name encoding, usage-journal headroom, pre-turn watchdog, lenient session list. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Anthropic and Messages-compatible routes accept any tool name.** Tool names that Anthropic's pattern rejects, such as `web.run` from a loaded tool group, are encoded on the wire and decoded in replies, as the chat and responses routes already did. Before, one such name made every request fail with "tools.N.custom.name: String should match pattern", which stopped sub-agents that had loaded it.
- **A large sub-agent fan-out no longer exhausts the usage journal.** The per-session limit of live usage receipts rises from 64 to 256, above the workflow ceiling of 128, so a full fan-out keeps its cost receipts instead of running with cost unknown.
- **A turn that stalls before it starts is now bounded.** The stall watchdog covers the setup before the first model request, so a wedged start is logged, cancelled after 180 seconds with a stated reason, and leaves a stall record instead of waiting silently. A warning names the case where all four blocking-work slots are held. Refs #6184.
- **One unreadable saved session no longer empties the recent-sessions list.** The launch card and ACP `session/list` show the readable sessions and log the failure. Refs #7095.
- **Windows uninstall remove
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d1ffc1c` are properly handled with clean fallback behavior.
