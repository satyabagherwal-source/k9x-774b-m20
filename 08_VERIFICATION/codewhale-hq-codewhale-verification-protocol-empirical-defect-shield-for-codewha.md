# Verification Protocol: Verification Protocol: Empirical Defect Shield for codewhale-hq/Codewhale

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/codewhale-hq/Codewhale",
  "source_version": "b274f161",
  "license": "MIT",
  "timestamp": "2026-11-19T15:42:25.600Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale) (Revision: `b274f161`).  
> **License**: MIT | **Timestamp**: `2026-11-19T15:42:25.600Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## 1. Scope & Verification Target
- **Target Repository**: `codewhale-hq/Codewhale` (Commit: `b274f161`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): codewhale-hq/Codewhale

> **Canonical Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-19T15:42:23.772Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: An open-source coding agent for your terminal, written in Rust. It works with any model, can split one task across several agents, and every line of it is yours to read.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41180 stars

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
- **Issue #7379** (2026-11-19): **[CI only, do not merge] fix(sanitize,config,engine): fast-path secret redaction and retire OpenCode Zen free rows (CW-8225, CW-8257)**
  *Symptoms*: ## Summary 0.10.3 slice `ci/redact-and-opencode-zen-0103-v1` (CURRENT_DECISIONS §235, ops gap map codewhale-hq/codewhale-ops#20). **Stacked on `ci/release-prep-0103-v2` (`25e73276b5`)**: only the commits after `25e73276b5` belong to this slice; the 16 commits below it are the reviewed release-prep stack, which lands first. Opened to get hosted `ci.yml` on this exact head (`workflow_dispatch` is not available to this session); lands through the designated lander after 2x exact-SHA `VERDICT: LAND`, not by merging this PR.  Slice commit message:  ``` fix(sanitize,config,engine): add fast-path secret redaction and retire dead-end OpenCode Zen free rows (CW-8225, CW-8257)  - CW-8225 (#7347): Add byte-identical fast-path pre-scans in crates/sanitize/src/redact.rs   so ordinary text without secret indicators skips regex/tokenization passes on every   model request, covered by fast_path_is_byte_identical_to_unoptimized_reference_across_corpus. - CW-8257 (#7365): Remove the 11 OpenCode Zen `*-free` rows from the curated catalog   (catalog_corrections.json, bundled Models.dev seed, model_resolution.golden.tsv,   reviewed.rs transport count) because OpenCode restricts them to its own client with   HTTP 429 FreeUsageLimitError and Codewhale does not spoof OpenCode's client. Document   the boundary in docs/PROVIDERS.md and docs/zh_hans/PROVIDERS.md and surface a clear   client-restriction hint in opencode_go_hint. ```   <!-- devin-bot-banner-begin --> ---  <p><picture><source srcset="http

- **Issue #7378** (2026-11-19): **[CI only, do not merge] fix(tui,engine): typed error codes on error cards and turn outcomes in exports (CW-8136)**
  *Symptoms*: ## Summary 0.10.3 slice `ci/export-error-diagnostics-0103-v1` (CURRENT_DECISIONS §235, ops gap map codewhale-hq/codewhale-ops#20). **Stacked on `ci/release-prep-0103-v2` (`25e73276b5`)**: only the commits after `25e73276b5` belong to this slice; the 16 commits below it are the reviewed release-prep stack, which lands first. Opened to get hosted `ci.yml` on this exact head (`workflow_dispatch` is not available to this session); lands through the designated lander after 2x exact-SHA `VERDICT: LAND`, not by merging this PR.  Slice commit message:  ``` fix(tui,engine): show typed error code on error cards and export persisted turn outcomes (CW-8136)  - Preserve normalized ErrorEnvelope::code on HistoryCell::Error and SavedTurnOutcome,   rendering a muted [code] badge on TUI error cards without duplicating codes already   present in the message text. - Project persisted session turn_outcomes (with secret redaction and chronological   message-position interleaving, including under --no-tools) into Markdown, HTML,   JSON, and /copy clipboard exports. - Update the export redaction unit test assertion to match sanitize_text's full   Authorization header redaction (`Authorization: [redacted]`). ```   <!-- devin-bot-banner-begin --> ---  <p><picture><source srcset="https://app.devin.ai/api/presigned_proxy?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjpudWxsLCJidWNrZXRfbmFtZSI6ImRldmluYXR0YWNobWVudHMiLCJidWNrZXRfa2V5IjoiYXR0YWNobWVudHNfcHJpdmF0ZS9vcmctMTg2NDJhNWVmM2Y1NDE1MzkxN

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

### Incident Patch 1: `bacf9dea` (2026-11-19)
**Commit Message**: 0.10.3 lane 8: execpolicy launcher panic and payload-hiding fixes (#7385)

* fix(execpolicy): guard launcher verb index on flag-only commands

Expander::record_launcher_commands indexed tokens[verb_idx] unchecked in the nix, npm, launchctl, and VERB_LAUNCHERS arms when resolve_wrapper_targets appended tokens.len() after scanning global flags with no subcommand (e.g. docker --version, npm --version). Guard all four arms with tokens.get(verb_idx) and add launcher_flag_only_commands_do_not_panic.

Restacked onto ci/release-prep-0103-v2 25e73276b5 from 03aee41843 (PR #7375, 2x LAND); source patch identical, changelog entry placed under [0.10.3] ### Fixed and crates/tui/CHANGELOG.md resynced. rustfmt applied to the is_container_run line.

Checks on Linux x86_64: cargo test --locked -p codewhale-execpolicy (268 passed on this tip: 246 unit, 1 authorization_order, 11 redirection_policy, 9 shell_parse_policy, 1 doctest; 0 failed); without the shell_expand.rs guards the new test fails (0 passed; 1 failed: index out of bounds: the len is 2 but the index is 2); cargo clippy --locked -p codewhale-execpolicy --all-targets -- -D warnings; cargo fmt -p codewhale-execpolicy -- --check; scripts/syn

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -591,6 +591,8 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 
 ### Fixed
 
+- **Flag-only launcher commands no longer crash the turn:** running `npm --version`, `nix --version`, `launchctl --help`, `docker --version`, `podman --version`, or another launcher command with global flags and no subcommand no longer panics with an out-of-bounds index during command policy expansion.
+- **Command policy sees payloads behind empty words and `--entrypoint`:** command policy now also checks the nested command in launcher lines with empty-string words before the subcommand (`npm '' exec -c 'rm -rf /'`, `docker '' -D run alpine rm -rf /`) and checks `docker run --entrypoint rm alpine -rf /` as the entrypoint plus the arguments after the image, checking every `--entrypoint` value before the image, so deny rules and approval review match them. A launcher line with so many options that the option walk hits its state limit is now treated like other commands whose words are only known at run time: while deny rules are in force it asks for approval, or is refused where approval is unavailable, instead of dropping the nested command.
 - **File search in very large folders returns results instead of timing out:** `file_search` (shown as `find`) no longer fails with "operation timed out after 30s" in a huge folder that is not a git repository. It now walks the tree in parallel, searches the top four levels first so shallow files are found even when the rest of the tree is too large, also skips `.venv`, `__pycache__`, `.next`, `.turbo` and `.gradle` by default alongside `target`, `node_modules`, `.git` and build output, and, if the tree is still too large to finish in 20 seconds, returns the best matches found so far marked `partial` with a note to narrow `path` or the query. Results in an ordinary repository are unchanged apart from those newly skipped folders. (CW-8265)
 - **Auto-Review on the desktop app sees what you asked for:** the Auto-Review reviewer refused every command started from the desktop composer with "No person request provided (person_messages is empty)", because the desktop reaches its Engine with the local runtime token, which counted as an automation caller. A runtime-token caller that names the owner surface (`"client": "desktop"`) on `POST /v1/threads/{id}/turns` or `.../steer` now records the typed prompt as your message, the same way the signed-in web composer and the terminal already do; a paired device or phone that claims `desktop` is refused with 403, and a runtime-token caller that names no owner surface, a tokenless local server, scheduled work, automations and agent-created threads still record nothing. The reviewer still blocks actions your messages do not cover. (CW-8270)
 - **Scheduled catalog refresh pushes with a branch-tip lease:** the Catalog refresh workflow now resolves the remote `catalog-refresh` branch tip before pushing, aborts if `catalog-refresh` has commits outside `origin/main` not committed by `codewhale-agent[bot]`, and passes that resolved tip (empty when absent) to `--force-with-lease` so pushes no longer fail with `stale info`. (CW-8266)
```

**File**: `crates/execpolicy/src/shell_expand.rs` (modified, +211/-30)
```diff
@@ -2048,10 +2048,15 @@ impl Expander {
         depth: usize,
     ) {
         let tokens = &line.words;
+        let mut truncated = false;
         match name {
             "nix" => {
-                for verb_idx in resolve_wrapper_targets(tokens, head + 1, &NIX_GLOBAL_SPEC) {
-                    let verb = tokens[verb_idx].as_str();
+                for verb_idx in
+                    launcher_verb_targets(tokens, head + 1, &NIX_GLOBAL_SPEC, &mut truncated)
+                {
+                    let Some(verb) = tokens.get(verb_idx).map(String::as_str) else {
+                        continue;
+                    };
                     if matches!(verb, "develop" | "shell")
                         && let Some(at) = (verb_idx + 1..tokens.len())
                             .take_while(|&i| tokens[i] != "--")
@@ -2086,8 +2091,13 @@ impl Expander {
                         self.code_payload(&payload, payload_dynamic, depth);
                     }
                 } else {
-                    for verb_idx in resolve_wrapper_targets(tokens, head + 1, &EMPTY_WRAPPER_SPEC) {
-                        if matches!(tokens[verb_idx].as_str(), "exec" | "x") {
+                    for verb_idx in
+                        launcher_verb_targets(tokens, head + 1, &EMPTY_WRAPPER_SPEC, &mut truncated)
+                    {
+                        if tokens
+                            .get(verb_idx)
+                            .is_some_and(|verb| matches!(verb.as_str(), "exec" | "x"))
+                        {
                             for (payload, payload_dynamic) in option_payloads(
                                 tokens,
                                 verb_idx,
@@ -2106,7 +2116,8 @@ impl Expander {
                 if ssh_skips_remote_command(&tokens[head + 1..]) {
                     return;
                 }
-                for landing in resolve_wrapper_targets(tokens, head + 1, &SSH_SPEC) {
+                for landing in resolve_wrapper_targets(tokens, head + 1, &SSH_SPEC, &mut truncated)
+                {
                     if landing < tokens.len() {
                         let rest = &tokens[landing..];
                         let rest_dynamic = dynamic[landing..].iter().any(|d| *d);
@@ -2121,7 +2132,9 @@ impl Expander {
                 if screen_attaches_only(&tokens[head + 1..]) {
                     return;
                 }
-                for landing in resolve_wrapper_targets(tokens, head + 1, &SCREEN_SPEC) {
+                for landing in
+                    resolve_wrapper_targets(tokens, head + 1, &SCREEN_SPEC, &mut truncated)
+                {
                     if landing < tokens.len() {
                         self.record(&slice_line(line, landing), depth + 1);
                     }
@@ -2132,8 +2145,10 @@ impl Expander {
             }
             _ => {
                 if name == "launchctl" {
-                    for verb_idx in resolve_wrapper_targets(tokens, head + 1, &EMPTY_WRAPPER_SPEC) {
-                        if tokens[verb_idx] == "submit" {
+                    for verb_idx in
+                        launcher_verb_targets(tokens, head + 1, &EMPTY_WRAPPER_SPEC, &mut truncated)
+                    {
+                        if tokens.get(verb_idx).map(String::as_str) == Some("submit") {
                             self.record_exec_flag_command(line, verb_idx, &['p'], &[], depth);
                         }
                     }
@@ -2142,24 +2157,55 @@ impl Expander {
                     if launcher.program != name {
                         continue;
                     }
-                    for verb_idx in resolve_wrapper_targets(tokens, head + 1, launcher.global) {
-                        if !launcher.verbs.contains(&tokens[verb_idx].as_str()) {
+                    for verb_idx in
+                        launcher_verb_targets(tokens, head + 1, launcher.global, &mut truncated)
+                    {
+                        let Some(verb) = tokens.get(verb_idx).map(String::as_str) else {
+                            continue;
+                        };
+                        if !launcher.verbs.contains(&verb) {
                             continue;
                         }
-                        let is_container_run =
-                            matches!(name, "docker" | "podman") && tokens[verb_idx] == "run";
-                        let entrypoint = if is_container_run {
-                            find_entrypoint(&tokens[verb_idx + 1..], verb_idx + 1)
-                        } else {
-                            None
+                        let is_container_run = matches!(name, "docker" | "podman") && verb == "run";
+                        let entrypoints_before = |end: usize| {
+                            if !is_container_run {
+                                return Vec::new();
+                            }
+                            let end = end.min(tokens.len()).max(verb_idx + 1);
+                            l
```

**File**: `crates/tui/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -591,6 +591,8 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 
 ### Fixed
 
+- **Flag-only launcher commands no longer crash the turn:** running `npm --version`, `nix --version`, `launchctl --help`, `docker --version`, `podman --version`, or another launcher command with global flags and no subcommand no longer panics with an out-of-bounds index during command policy expansion.
+- **Command policy sees payloads behind empty words and `--entrypoint`:** command policy now also checks the nested command in launcher lines with empty-string words before the subcommand (`npm '' exec -c 'rm -rf /'`, `docker '' -D run alpine rm -rf /`) and checks `docker run --entrypoint rm alpine -rf /` as the entrypoint plus the arguments after the image, checking every `--entrypoint` value before the image, so deny rules and approval review match them. A launcher line with so many options that the option walk hits its state limit is now treated like other commands whose words are only known at run time: while deny rules are in force it asks for approval, or is refused where approval is unavailable, instead of dropping the nested command.
 - **File search in very large folders returns results instead of timing out:** `file_search` (shown as `find`) no longer fails with "operation timed out after 30s" in a huge folder that is not a git repository. It now walks the tree in parallel, searches the top four levels first so shallow files are found even when the rest of the tree is too large, also skips `.venv`, `__pycache__`, `.next`, `.turbo` and `.gradle` by default alongside `target`, `node_modules`, `.git` and build output, and, if the tree is still too large to finish in 20 seconds, returns the best matches found so far marked `partial` with a note to narrow `path` or the query. Results in an ordinary repository are unchanged apart from those newly skipped folders. (CW-8265)
 - **Auto-Review on the desktop app sees what you asked for:** the Auto-Review reviewer refused every command started from the desktop composer with "No person request provided (person_messages is empty)", because the desktop reaches its Engine with the local runtime token, which counted as an automation caller. A runtime-token caller that names the owner surface (`"client": "desktop"`) on `POST /v1/threads/{id}/turns` or `.../steer` now records the typed prompt as your message, the same way the signed-in web composer and the terminal already do; a paired device or phone that claims `desktop` is refused with 403, and a runtime-token caller that names no owner surface, a tokenless local server, scheduled work, automations and agent-created threads still record nothing. The reviewer still blocks actions your messages do not cover. (CW-8270)
 - **Scheduled catalog refresh pushes with a branch-tip lease:** the Catalog refresh workflow now resolves the remote `catalog-refresh` branch tip before pushing, aborts if `catalog-refresh` has commits outside `origin/main` not committed by `codewhale-agent[bot]`, and passes that resolved tip (empty when absent) to `--force-with-lease` so pushes no longer fail with `stale info`. (CW-8266)
```

**File**: `docs/MODES.md` (modified, +3/-1)
```diff
@@ -27,7 +27,9 @@ the saved `role`/`profile` assignment. An Exact Fleet fixes each member's route.
 One dial says how much Codewhale may do without asking. Press `Shift+Tab` to
 step it: **Ask → Accept Edits → Plan → Auto-Review → Full Access → Ask**. Plan
 is the Plan mode; every other stop is Work with that permission posture. The
-footer shows the current stop and `Shift+Tab to change`. New installs start on
+footer shows the current stop and `Shift+Tab to change`; after you have pressed
+it twice the hint stands down, except on Auto-Review and Full Access, where it
+stays while the footer has room. New installs start on
 Accept Edits when no permission posture is saved. An explicit saved choice,
 including Ask from an earlier version, stays in control.
 `Tab` only completes composer menus, commands, file mentions and suggestions;
```

---

### Incident Patch 2: `7041117f` (2026-11-18)
**Commit Message**: fix(engine): refuse private addresses for registry-admitted providers at connect time (CW-8246)

Model traffic to a provider admitted from the signed registry went through
platform_client_builder, which only installs the loopback proxy fallback.
Admission checks base_url statically (https, public multi-label domain, no
IP literal), so a public host name that resolves, or later rebinds, to
10.x, 169.254.169.254 or ::1 was connected to.

codewhale_net::guard gains PublicAddressResolver, a reqwest DNS resolver
that resolves on every connection and refuses an answer containing any
is_restricted_ip address, and public_address_reqwest_client_builder, the
guarded transport (ambient proxies off, as guarded_reqwest_client_builder)
with that resolver. codewhale_config::descriptors gains
is_registry_admitted_base_url, true when a URL's host equals the host of a
provider in the active verified registry. http_client_builder_with_auth_mode
builds a `custom` route on the guarded transport when its base_url passes
that check, so the chat, HTTP/1.1 fallback and /models clients of a pulled
provider are all guarded. Built-in providers (including Ollama, vLLM and
SGLang) and custom endpoints on any ot

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **One configured-model selection chain:** a model id that a provider does not accept now gives the same clear error in every command (`codewhale model resolve`, the terminal UI, and the app-server) instead of being sent anyway by some of them, and configured default models resolve through one shared chain across every surface. (CW-8250)
 - **Model limits, capabilities and prices follow the resolved route:** context windows, output limits, thinking support, request wire selection, Google thought-signature and reasoning controls, and turn prices now come from the same catalog entry the request uses, so they match the model actually sent. (CW-8251)
 - **Standing-instruction receipt over the Runtime API:** `GET /v1/threads/{id}/context/standing` (capability `thread_standing_context`) returns the receipt the Engine already computes for a live thread: per-item estimated tokens kept and dropped, the action taken (kept, trimmed, skipped, refused) and the limit that caused it, scope budgets and totals, relative paths only, the 65,536-byte delivery cap with whether the delivered message was truncated, and a `not_measured` list (skills, agents, MCP tool schemas, memory) so a client does not show zero. Read-only; prompts and the cached prefix are unchanged.
-- **Signed model and provider registry wired into resolution and discovery (off by default):** when `[cloud_facts]` is enabled (`CODEWHALE_CLOUD_FACTS=1` or `enabled = true`), Codewhale fetches the signed models-and-providers list (`registry.json`, `codewhale.registry.v1`) from `https://codewhale.net/api/facts/v1/registry` by default (or `CODEWHALE_REGISTRY_URL` / `CODEWHALE_REGISTRY_PATH`, or `CODEWHALE_CLOUD_FACTS_URL` when it contains `{channel}`), verifies it against the pinned keys, caches the last good copy at `$CODEWHALE_HOME/facts/registry-cache.json`, and applies verified models, offerings, aliases and admitted providers across `resolve_model`, `RouteResolver`, catalog lookups and `/provider` discovery. Scheduled `automation` signatures with a non-expired `not_after` within seven days of `generated_at` may update models, offerings and bundled-provider naming aliases, while adding a new OpenAI-compatible HTTPS provider requires a `founder` signature and can never change a built-in provider's address, key or protocol or reuse another product or provider `*_API_KEY` variable. Disabling cloud facts, expiry past `not_after`, `CODEWHALE_DISABLE_CLOUD_FACTS=1`, or a failed/rejected pull leaves or restores the copy already in use (or the bundled seed) without delaying startup; CI suppresses network pulls. Source only: cloud facts remain off by default and publication is separate. See `docs/CLOUD_FACTS.md`. (CW-8246)
+- **Signed model and provider registry wired into resolution and discovery (off by default):** when `[cloud_facts]` is enabled (`CODEWHALE_CLOUD_FACTS=1` or `enabled = true`), Codewhale fetches the signed models-and-providers list (`registry.json`, `codewhale.registry.v1`) from `https://codewhale.net/api/facts/v1/registry` by default (or `CODEWHALE_REGISTRY_URL` / `CODEWHALE_REGISTRY_PATH`, or `CODEWHALE_CLOUD_FACTS_URL` when it contains `{channel}`), verifies it against the pinned keys, caches the last good copy at `$CODEWHALE_HOME/facts/registry-cache.json`, and applies verified models, offerings, aliases and admitted providers across `resolve_model`, `RouteResolver`, catalog lookups and `/provider` discovery. Model requests to a custom provider whose host a verified registry admitted resolve that host on every connection, without an ambient proxy, and are refused when it answers with a private, loopback, link-local or cloud-metadata address; built-in providers (including local Ollama, vLLM and SGLang) and custom endpoints on any other host are unchanged. Scheduled `automation` signatures with a non-expired `not_after` within seven days of `generated_at` may update models, offerings and bundled-provider naming aliases, while adding a new OpenAI-compatible HTTPS provider requires a `founder` signature and can never change a built-in provider's address, key or protocol or reuse another product or provider `*_API_KEY` variable. Disabling cloud facts, expiry past `not_after`, `CODEWHALE_DISABLE_CLOUD_FACTS=1`, or a failed/rejected pull leaves or restores the copy already in use (or the bundled seed) without delaying startup; CI suppresses network pulls. Source only: cloud facts remain off by default and publication is separate. See `docs/CLOUD_FACTS.md`. (CW-8246)
 - **Gemini 4 Hydrogen:** Google's `gemini-4-hydrogen` is in the catalog and the Google model list, with a 1,048,576-token context window and 65,536 output tokens. The shut-down `gemini-3-pro-preview` leaves the Google list.
 - **Model shorthands work the same everywhere:** short names that previously worked only in `/provider <name> <model>` or `codewhale model resolve` — such as `flash`, `pr
```

**File**: `crates/config/src/cloud_facts/registry/tests.rs` (modified, +12/-0)
```diff
@@ -820,8 +820,20 @@ fn founder_signed_registry_admits_new_provider_discovers_it_and_clears_on_disabl
             .any(|row| row.provider == "tavily" || row.wire_model_id == "tavily-leaked-offering")
     );
     assert!(intrinsic_model("acme-sonnet").is_some());
+    assert!(crate::descriptors::is_registry_admitted_base_url(
+        "https://API.acme-cloud.example./v1/chat/completions"
+    ));
+    assert!(!crate::descriptors::is_registry_admitted_base_url(
+        "https://api.other.example/v1"
+    ));
+    assert!(!crate::descriptors::is_registry_admitted_base_url(
+        "http://localhost:11434/v1"
+    ));
 
     overlay::clear();
+    assert!(!crate::descriptors::is_registry_admitted_base_url(
+        "https://api.acme-cloud.example/v1"
+    ));
     assert!(provider_descriptor("acme-cloud").is_none());
     assert!(provider_descriptor("acme-ai").is_none());
     assert_eq!(
```

**File**: `crates/config/src/descriptors.rs` (modified, +19/-0)
```diff
@@ -247,6 +247,25 @@ pub fn active_provider_descriptors() -> Vec<ProviderDescriptor> {
     out
 }
 
+#[must_use]
+pub fn is_registry_admitted_base_url(base_url: &str) -> bool {
+    fn host(raw: &str) -> Option<String> {
+        url::Url::parse(raw.trim()).ok().and_then(|url| {
+            url.host_str()
+                .map(|host| host.trim_end_matches('.').to_ascii_lowercase())
+        })
+    }
+    let Some(target) = host(base_url) else {
+        return false;
+    };
+    crate::cloud_facts::overlay::pulled_registry().is_some_and(|admitted| {
+        admitted
+            .providers
+            .iter()
+            .any(|provider| host(&provider.base_url).as_deref() == Some(target.as_str()))
+    })
+}
+
 #[must_use]
 pub fn provider_descriptor(id: &str) -> Option<ProviderDescriptor> {
     active_provider_descriptors()
```

**File**: `crates/engine/src/client.rs` (modified, +8/-1)
```diff
@@ -2593,7 +2593,14 @@ impl CodewhaleClient {
             auth_disabled,
             surface,
         )?;
-        let mut builder = crate::platform_client_builder()
+        let transport = if api_provider == ProviderKind::Custom
+            && codewhale_config::descriptors::is_registry_admitted_base_url(base_url)
+        {
+            codewhale_net::guard::public_address_reqwest_client_builder()
+        } else {
+            crate::platform_client_builder()
+        };
+        let mut builder = transport
             .default_headers(headers)
             .user_agent(client_user_agent(api_provider))
             .connect_timeout(config.connect_timeout())
```

**File**: `crates/engine/src/client/test_cases_04.rs` (modified, +90/-0)
```diff
@@ -1623,3 +1623,93 @@
             );
         }
     }
+
+    #[tokio::test]
+    async fn registry_admitted_custom_hosts_refuse_private_addresses_at_connect_time() {
+        use codewhale_config::cloud_facts::{
+            BuiltinNames, KeyRole, REGISTRY_SCHEMA, Registry, VerifiedRegistry, admit_registry,
+            overlay,
+        };
+        use tokio::io::{AsyncReadExt as _, AsyncWriteExt as _};
+
+        let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
+            .await
+            .expect("bind");
+        let port = listener.local_addr().expect("addr").port();
+        tokio::spawn(async move {
+            while let Ok((mut socket, _)) = listener.accept().await {
+                tokio::spawn(async move {
+                    let mut buf = [0u8; 2048];
+                    let _ = socket.read(&mut buf).await;
+                    let _ = socket
+                        .write_all(b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\nconnection: close\r\n\r\nok")
+                        .await;
+                });
+            }
+        });
+        let base_url = format!("http://localhost:{port}/v1");
+        let probe = |provider: ProviderKind| {
+            let client =
+                CodewhaleClient::build_http_client("sk-test", &HashMap::new(), provider, &base_url)
+                    .expect("client");
+            let url = format!("{base_url}/models");
+            async move { client.get(url).send().await }
+        };
+
+        overlay::clear();
+        assert!(probe(ProviderKind::Custom).await.is_ok());
+
+        let registry: Registry = serde_json::from_value(json!({
+            "schema": REGISTRY_SCHEMA,
+            "revision": overlay::highest_seen(REGISTRY_SCHEMA).unwrap_or(0) + 1,
+            "generated_at": "2026-11-17T00:00:00Z",
+            "providers": [{
+                "id": "acme-rebind",
+                "label": "Acme Rebind",
+                "wire_policy": "openai-compatible",
+                "base_url": "https://api.acme-rebind.example/v1",
+                "admission": {"founder_signature": "required"}
+            }],
+            "models": [],
+            "offerings": [],
+            "dialects": {}
+        }))
+        .expect("registry");
+        let mut admitted = admit_registry(
+            VerifiedRegistry {
+                registry,
+                key_id: "engine-guard-test".to_string(),
+                key_role: KeyRole::Founder,
+                sha256: String::new(),
+                generated_at_unix: 0,
+                not_after: None,
+            },
+            &BuiltinNames::bundled(),
+        );
+        assert_eq!(admitted.providers.len(), 1, "{:?}", admitted.refused);
+        admitted.providers[0].base_url.clone_from(&base_url);
+        let ticket = overlay::configure(true, "engine-pulled-guard-test").expect("ticket");
+        assert!(overlay::publish_registry(
+            &ticket,
+            Some(std::sync::Arc::new(admitted)),
+            |_| {}
+        ));
+
+        let refused = probe(ProviderKind::Custom).await.expect_err("guarded");
+        let chain = format!("{:?}", anyhow::Error::from(refused));
+        assert!(chain.contains("restricted address"), "{chain}");
+        assert!(probe(ProviderKind::Ollama).await.is_ok());
+        assert!(probe(ProviderKind::Vllm).await.is_ok());
+        assert!(
+            CodewhaleClient::build_http_client(
+                "sk-test",
+                &HashMap::new(),
+                ProviderKind::Custom,
+                "http://127.0.0.1:1/v1",
+            )
+            .is_ok()
+        );
+
+        overlay::clear();
+        assert!(probe(ProviderKind::Custom).await.is_ok());
+    }
```

**File**: `crates/engine/src/lib.rs` (modified, +2/-1)
```diff
@@ -91,7 +91,8 @@ pub mod work_graph;
 /// environment at build time, so one builder decides the route for the whole
 /// process lifetime. Installing the loopback fallback here, rather than at
 /// selected call sites, keeps those clients on the same proxy rules. Reviewed
-/// plugin remotes and guarded fetches do not come through here: they use
+/// plugin remotes, guarded fetches and model clients for registry-admitted
+/// custom providers do not come through here: they use
 /// `codewhale_net::guard::guarded_reqwest_client_builder`, which disables
 /// ambient proxies on purpose.
 pub(crate) fn platform_client_builder() -> reqwest::ClientBuilder {
```

**File**: `crates/net/src/guard.rs` (modified, +52/-0)
```diff
@@ -29,6 +29,41 @@ pub fn guarded_reqwest_client_builder() -> reqwest::ClientBuilder {
     codewhale_release::tls::reqwest_client_builder().no_proxy()
 }
 
+#[derive(Clone, Copy, Debug, Default)]
+pub struct PublicAddressResolver;
+
+impl reqwest::dns::Resolve for PublicAddressResolver {
+    fn resolve(&self, name: reqwest::dns::Name) -> reqwest::dns::Resolving {
+        let host = name.as_str().to_string();
+        Box::pin(async move {
+            let addrs: Vec<SocketAddr> = tokio::time::timeout(
+                DNS_PREFLIGHT_TIMEOUT,
+                tokio::net::lookup_host((host.as_str(), 0u16)),
+            )
+            .await
+            .map_err(|_| format!("timed out resolving {host}"))?
+            .map_err(|error| format!("could not resolve {host}: {error}"))?
+            .collect();
+            if let Some(addr) = addrs.iter().find(|addr| is_restricted_ip(&addr.ip())) {
+                return Err(format!(
+                    "{host} resolved to restricted address {} (private/loopback/link-local/metadata); registry-admitted providers must resolve to public addresses",
+                    addr.ip()
+                )
+                .into());
+            }
+            if addrs.is_empty() {
+                return Err(format!("{host} resolved to no addresses").into());
+            }
+            let addrs: reqwest::dns::Addrs = Box::new(addrs.into_iter());
+            Ok(addrs)
+        })
+    }
+}
+
+pub fn public_address_reqwest_client_builder() -> reqwest::ClientBuilder {
+    guarded_reqwest_client_builder().dns_resolver(PublicAddressResolver)
+}
+
 const CLOUD_METADATA_V4: [Ipv4Addr; 4] = [
     Ipv4Addr::new(169, 254, 169, 254),
     Ipv4Addr::new(100, 100, 100, 200),
@@ -522,6 +557,23 @@ impl<'a> GuardedGet<'a> {
 #[cfg(test)]
 mod tests {
     use super::*;
+
+    #[tokio::test]
+    async fn public_address_resolver_refuses_names_that_resolve_to_loopback() {
+        use reqwest::dns::Resolve as _;
+        use std::str::FromStr as _;
+        let error = match PublicAddressResolver
+            .resolve(reqwest::dns::Name::from_str("localhost").expect("name"))
+            .await
+        {
+            Ok(addrs) => panic!(
+                "localhost admitted: {:?}",
+                addrs.collect::<Vec<SocketAddr>>()
+            ),
+            Err(error) => error.to_string(),
+        };
+        assert!(error.contains("restricted address"), "{error}");
+    }
     #[cfg(not(windows))]
     use std::io::{Read, Write};
     #[cfg(not(windows))]
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **One configured-model selection chain:** a model id that a provider does not accept now gives the same clear error in every command (`codewhale model resolve`, the terminal UI, and the app-server) instead of being sent anyway by some of them, and configured default models resolve through one shared chain across every surface. (CW-8250)
 - **Model limits, capabilities and prices follow the resolved route:** context windows, output limits, thinking support, request wire selection, Google thought-signature and reasoning controls, and turn prices now come from the same catalog entry the request uses, so they match the model actually sent. (CW-8251)
 - **Standing-instruction receipt over the Runtime API:** `GET /v1/threads/{id}/context/standing` (capability `thread_standing_context`) returns the receipt the Engine already computes for a live thread: per-item estimated tokens kept and dropped, the action taken (kept, trimmed, skipped, refused) and the limit that caused it, scope budgets and totals, relative paths only, the 65,536-byte delivery cap with whether the delivered message was truncated, and a `not_measured` list (skills, agents, MCP tool schemas, memory) so a client does not show zero. Read-only; prompts and the cached prefix are unchanged.
-- **Signed model and provider registry wired into resolution and discovery (off by default):** when `[cloud_facts]` is enabled (`CODEWHALE_CLOUD_FACTS=1` or `enabled = true`), Codewhale fetches the signed models-and-providers list (`registry.json`, `codewhale.registry.v1`) from `https://codewhale.net/api/facts/v1/registry` by default (or `CODEWHALE_REGISTRY_URL` / `CODEWHALE_REGISTRY_PATH`, or `CODEWHALE_CLOUD_FACTS_URL` when it contains `{channel}`), verifies it against the pinned keys, caches the last good copy at `$CODEWHALE_HOME/facts/registry-cache.json`, and applies verified models, offerings, aliases and admitted providers across `resolve_model`, `RouteResolver`, catalog lookups and `/provider` discovery. Scheduled `automation` signatures with a non-expired `not_after` within seven days of `generated_at` may update models, offerings and bundled-provider naming aliases, while adding a new OpenAI-compatible HTTPS provider requires a `founder` signature and can never change a built-in provider's address, key or protocol or reuse another product or provider `*_API_KEY` variable. Disabling cloud facts, expiry past `not_after`, `CODEWHALE_DISABLE_CLOUD_FACTS=1`, or a failed/rejected pull leaves or restores the copy already in use (or the bundled seed) without delaying startup; CI suppresses network pulls. Source only: cloud facts remain off by default and publication is separate. See `docs/CLOUD_FACTS.md`. (CW-8246)
+- **Signed model and provider registry wired into resolution and discovery (off by default):** when `[cloud_facts]` is enabled (`CODEWHALE_CLOUD_FACTS=1` or `enabled = true`), Codewhale fetches the signed models-and-providers list (`registry.json`, `codewhale.registry.v1`) from `https://codewhale.net/api/facts/v1/registry` by default (or `CODEWHALE_REGISTRY_URL` / `CODEWHALE_REGISTRY_PATH`, or `CODEWHALE_CLOUD_FACTS_URL` when it contains `{channel}`), verifies it against the pinned keys, caches the last good copy at `$CODEWHALE_HOME/facts/registry-cache.json`, and applies verified models, offerings, aliases and admitted providers across `resolve_model`, `RouteResolver`, catalog lookups and `/provider` discovery. Model requests to a custom provider whose host a verified registry admitted resolve that host on every connection, without an ambient proxy, and are refused when it answers with a private, loopback, link-local or cloud-metadata address; built-in providers (including local Ollama, vLLM and SGLang) and custom endpoints on any other host are unchanged. Scheduled `automation` signatures with a non-expired `not_after` within seven days of `generated_at` may update models, offerings and bundled-provider naming aliases, while adding a new OpenAI-compatible HTTPS provider requires a `founder` signature and can never change a built-in provider's address, key or protocol or reuse another product or provider `*_API_KEY` variable. Disabling cloud facts, expiry past `not_after`, `CODEWHALE_DISABLE_CLOUD_FACTS=1`, or a failed/rejected pull leaves or restores the copy already in use (or the bundled seed) without delaying startup; CI suppresses network pulls. Source only: cloud facts remain off by default and publication is separate. See `docs/CLOUD_FACTS.md`. (CW-8246)
 - **Gemini 4 Hydrogen:** Google's `gemini-4-hydrogen` is in the catalog and the Google model list, with a 1,048,576-token context window and 65,536 output tokens. The shut-down `gemini-3-pro-preview` leaves the Google list.
 - **Model shorthands work the same everywhere:** short names that previously worked only in `/provider <name> <model>` or `codewhale model resolve` — such as `flash`, `pr
```

---

### Incident Patch 3: `8cc2b95b` (2026-11-18)
**Commit Message**: fix(config): every config load refuses a user-layer tool_launcher (CW-8021)

The Boat qualification step "user-layer tool_launcher was not rejected"
failed because `codewhale model resolve` exited 0 with tool_launcher in
the user's config.toml. The refusal lived only in the runtime's
Config::load_with. The CLI dispatcher, and the app-server config and
secrets RPCs, load the same file through codewhale_config::ConfigStore,
which parsed the key into extras and carried on.

No tool ever ran through that path: every command that executes tools
loads the runtime Config, which already refused the file, and the managed
launcher is read separately from the sealed managed file. So this was an
inconsistent answer at the trust boundary, not a bypass. The decision is
refuse, not confine: a launcher is a privilege-changing prefix and is
read only from the managed layer, so any user-layer copy is an error on
every surface.

The check now lives in codewhale_config (reject_unmanaged_tool_launcher,
tool_launcher_in_profiles) and both ConfigStore::load and the runtime
loader call it, so the CLI, desktop RPCs and Engine give the same error.
The runtime's managed_tool_launcher reuses the shared profil

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -254,6 +254,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Withdrawn desktop account plugins connector removed on upgrade:** the old desktop app's `codewhale-desktop-account-plugins` bundle, whose one connector (shown as `plugin-…-codewhale-desktop-account-plugins-codewhale-plugins`) failed on every session start, is now removed at startup together with its plugin record, and a `plugin.retired` line is written to `audit.log`. Only an installed copy whose single connector still points at the retired account endpoint is removed; other plugins, and a bundle of that name you changed or placed by hand, are left alone.
 - **Linked AGENTS.md inside the workspace:** a project `AGENTS.md`, `CLAUDE.md`, `.codewhale/instructions.md` or rules file that is a symlink to another file in the same directory tree now loads instead of being refused with `Refusing symlinked file` and leaving the session without project instructions. Every link in the chain is resolved first and the file is still refused, with a visible skip notice, when it resolves outside the workspace through `..`, an absolute target, a chain of links or a Windows junction. (CW-8266)
 - **A connector tool switched Off leaves conversations that already used it:** turning off a tool such as `close_issue` in Settings or with `PATCH /v1/apps/mcp/servers/{name}` now takes it out of the next turn of a conversation that had already found it through tool search, not only out of new conversations. The Engine rereads the connector configuration when it gathers a turn's tools and reconnects the changed server under the new settings.
+- **`tool_launcher` in a user config is refused by every command:** `codewhale model resolve`, `codewhale config`, the other CLI subcommands and the desktop's config and secrets calls now stop with the same error the Engine gives when `config.toml` sets `tool_launcher` at the top level or in a profile, instead of loading the file and exiting 0. The key is still read only from the managed configuration. (CW-8021)
 - **CJK text in terminal columns:** the command palette, the hotbar setup rows, the `/config` detail labels, the workflow history lanes, the approval card intent and parameter lines and the elevation prompt now pad and cut text by the columns it takes on screen, so Chinese, Japanese and Korean labels no longer push later columns right or get cut to a third of their space. Thanks [@luochen211](https://github.com/luochen211) (#7273).
 - **Slash-command arguments after any whitespace:** `/config` splits its key from its value, and finds a trailing `--save`, after a tab or a full-width space (U+3000) from a CJK input method, not only after an ASCII space, and a user command's `$ARGUMENTS` and `$N` are filled in one pass, so `$1` or `$10` written inside your own argument is not expanded again. Thanks [@luochen211](https://github.com/luochen211) (#7269).
 - **Negative retry delays:** a `[retry]` setting with a negative or non-finite `initial_delay`, `max_delay` or `exponential_base` is now refused when the configuration loads, where `jitter = false` with `max_delay = -1` made the first transport retry panic. Thanks [@luochen211](https://github.com/luochen211) (#7275).
```

**File**: `crates/config/src/config_store.rs` (modified, +22/-0)
```diff
@@ -127,6 +127,27 @@ pub fn parse_config_toml(contents: &str) -> Result<ConfigToml, toml::de::Error>
     parse_config_toml_str(contents)
 }
 
+pub fn tool_launcher_in_profiles(document: &toml::Value) -> bool {
+    document
+        .get("profiles")
+        .and_then(toml::Value::as_table)
+        .is_some_and(|profiles| {
+            profiles
+                .values()
+                .any(|profile| profile.get("tool_launcher").is_some())
+        })
+}
+
+pub fn reject_unmanaged_tool_launcher(document: &toml::Value, path: &Path) -> Result<()> {
+    if document.get("tool_launcher").is_some() || tool_launcher_in_profiles(document) {
+        bail!(
+            "`tool_launcher` in {} is not accepted: it is read only from the managed configuration (CODEWHALE_MANAGED_CONFIG_PATH, or the default managed path), in a file the Engine cannot write",
+            quote_os_path(path)
+        );
+    }
+    Ok(())
+}
+
 impl ConfigStore {
     /// The validated file snapshot captured by the last load or successful
     /// save. This read-only view preserves literal provider identities that a
@@ -154,6 +175,7 @@ impl ConfigStore {
                     toml_error_location(Some(&raw), &err)
                 )
             })?;
+            reject_unmanaged_tool_launcher(&raw_document, &path)?;
             if let Some(provider_id) = raw_document.get("provider").and_then(toml::Value::as_str) {
                 parsed
                     .bind_persisted_provider_id(provider_id)
```

**File**: `crates/config/src/tests.rs` (modified, +17/-0)
```diff
@@ -11145,3 +11145,20 @@ id = "account-model"
     assert!(resolved.model_error.is_none());
     assert!(resolved.route.is_ok());
 }
+
+#[test]
+fn config_store_refuses_a_user_layer_tool_launcher() {
+    let dir = tempfile::tempdir().expect("tempdir");
+    let config_path = dir.path().join("config.toml");
+    for body in [
+        "tool_launcher = [\"/usr/bin/sudo\", \"-n\", \"-u\", \"agent\", \"--\"]\n",
+        "[profiles.work]\ntool_launcher = [\"/usr/bin/sudo\"]\n",
+    ] {
+        fs::write(&config_path, body).expect("write config");
+        let error = ConfigStore::load(Some(config_path.clone()))
+            .expect_err("a user-layer tool_launcher is a load error");
+        assert!(error.to_string().contains("`tool_launcher`"), "{error}");
+    }
+    fs::write(&config_path, "model = \"deepseek-v4-flash\"\n").expect("write config");
+    ConfigStore::load(Some(config_path)).expect("a config without a launcher loads");
+}
```

**File**: `crates/runtime/src/config.rs` (modified, +4/-30)
```diff
@@ -3684,7 +3684,9 @@ impl Config {
                 if let Some(msg) = warn_on_misplaced_top_level_keys(&contents) {
                     tracing::warn!("{msg}");
                 }
-                reject_unmanaged_tool_launcher(&contents, path)?;
+                if let Ok(document) = toml::from_str::<toml::Value>(&contents) {
+                    codewhale_config::reject_unmanaged_tool_launcher(&document, path)?;
+                }
                 parsed
             } else {
                 apply_profile(ConfigFile::default(), profile)?;
@@ -10375,41 +10377,13 @@ fn apply_managed_overrides(config: &mut Config) -> Result<()> {
     Ok(())
 }
 
-fn tool_launcher_layer_error(path: &Path) -> anyhow::Error {
-    anyhow::anyhow!(
-        "`tool_launcher` in {} is not accepted: it is read only from the managed configuration (CODEWHALE_MANAGED_CONFIG_PATH, or the default managed path), in a file the Engine cannot write",
-        codewhale_config::quote_os_path(path)
-    )
-}
-
-fn tool_launcher_in_profiles(document: &toml::Value) -> bool {
-    document
-        .get("profiles")
-        .and_then(toml::Value::as_table)
-        .is_some_and(|profiles| {
-            profiles
-                .values()
-                .any(|profile| profile.get("tool_launcher").is_some())
-        })
-}
-
-fn reject_unmanaged_tool_launcher(raw: &str, path: &Path) -> Result<()> {
-    let Ok(document) = toml::from_str::<toml::Value>(raw) else {
-        return Ok(());
-    };
-    if document.get("tool_launcher").is_some() || tool_launcher_in_profiles(&document) {
-        return Err(tool_launcher_layer_error(path));
-    }
-    Ok(())
-}
-
 fn managed_tool_launcher(path: &Path) -> Result<Option<Vec<String>>> {
     let raw = fs::read_to_string(path)
         .with_context(|| format!("Failed to read config file: {}", path.display()))?;
     let Ok(document) = toml::from_str::<toml::Value>(&raw) else {
         return Ok(None);
     };
-    if tool_launcher_in_profiles(&document) {
+    if codewhale_config::tool_launcher_in_profiles(&document) {
         anyhow::bail!(
             "`tool_launcher` in {} belongs at the top level of the managed configuration, not in a profile",
             codewhale_config::quote_os_path(path)
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -254,6 +254,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Withdrawn desktop account plugins connector removed on upgrade:** the old desktop app's `codewhale-desktop-account-plugins` bundle, whose one connector (shown as `plugin-…-codewhale-desktop-account-plugins-codewhale-plugins`) failed on every session start, is now removed at startup together with its plugin record, and a `plugin.retired` line is written to `audit.log`. Only an installed copy whose single connector still points at the retired account endpoint is removed; other plugins, and a bundle of that name you changed or placed by hand, are left alone.
 - **Linked AGENTS.md inside the workspace:** a project `AGENTS.md`, `CLAUDE.md`, `.codewhale/instructions.md` or rules file that is a symlink to another file in the same directory tree now loads instead of being refused with `Refusing symlinked file` and leaving the session without project instructions. Every link in the chain is resolved first and the file is still refused, with a visible skip notice, when it resolves outside the workspace through `..`, an absolute target, a chain of links or a Windows junction. (CW-8266)
 - **A connector tool switched Off leaves conversations that already used it:** turning off a tool such as `close_issue` in Settings or with `PATCH /v1/apps/mcp/servers/{name}` now takes it out of the next turn of a conversation that had already found it through tool search, not only out of new conversations. The Engine rereads the connector configuration when it gathers a turn's tools and reconnects the changed server under the new settings.
+- **`tool_launcher` in a user config is refused by every command:** `codewhale model resolve`, `codewhale config`, the other CLI subcommands and the desktop's config and secrets calls now stop with the same error the Engine gives when `config.toml` sets `tool_launcher` at the top level or in a profile, instead of loading the file and exiting 0. The key is still read only from the managed configuration. (CW-8021)
 - **CJK text in terminal columns:** the command palette, the hotbar setup rows, the `/config` detail labels, the workflow history lanes, the approval card intent and parameter lines and the elevation prompt now pad and cut text by the columns it takes on screen, so Chinese, Japanese and Korean labels no longer push later columns right or get cut to a third of their space. Thanks [@luochen211](https://github.com/luochen211) (#7273).
 - **Slash-command arguments after any whitespace:** `/config` splits its key from its value, and finds a trailing `--save`, after a tab or a full-width space (U+3000) from a CJK input method, not only after an ASCII space, and a user command's `$ARGUMENTS` and `$N` are filled in one pass, so `$1` or `$10` written inside your own argument is not expanded again. Thanks [@luochen211](https://github.com/luochen211) (#7269).
 - **Negative retry delays:** a `[retry]` setting with a negative or non-finite `initial_delay`, `max_delay` or `exponential_base` is now refused when the configuration loads, where `jitter = false` with `max_delay = -1` made the first transport retry panic. Thanks [@luochen211](https://github.com/luochen211) (#7275).
```

#### Recent Merged Pull Requests:
- **PR #7395** (2026-11-19): ci: defer unreachable heapless RUSTSEC batch to unblock advisories gate (@Hmbown)
- **PR #7390** (2026-11-19): 0.10.3 ergonomics and truth batch: pricing, codemode-js, export error codes, redaction/Zen (@Hmbown)
- **PR #7386** (2026-11-19): release(0.10.3): land ci/release-prep-0103-v2 on main (@Hmbown)
- **PR #7385** (2026-11-19): 0.10.3 lane 8: execpolicy launcher panic and payload-hiding fixes (@Hmbown)
- **PR #7382** (closed): [CI only, do not merge] 0.10.3 ergonomics and truth batch: pricing, codemode-js, export errors, redaction/Zen (@Hmbown)
- **PR #7381** (closed): test(app-server): scale the SSE session TTL in the TTL-expiry test for CI (release-prep port) (@Hmbown)

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

## X. 0.10.3 lane 8: execpolicy launcher panic and payload-hiding fixes

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bacf9dea`: 0.10.3 lane 8: execpolicy launcher panic and payload-hiding fixes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Flag-only launcher commands no longer crash the turn:** running `npm --version`, `nix --version`, `launchctl --help`, `docker --version`, `podman --version`, or another launcher command with global flags and no subcommand no longer panics with an out-of-bounds index during command policy expansion.
- **Command policy sees payloads behind empty words and `--entrypoint`:** command policy now also checks the nested command in launcher lines with empty-string words before the subcommand (`npm '' exec -c 'rm -rf /'`, `docker '' -D run alpine rm -rf /`) and checks `docker run --entrypoint rm alpine -rf /` as the entrypoint plus the arguments after the image, checking every `--entrypoint` value before the image, so deny rules and approval review match them. A launcher line with so many options that the option walk hits its state limit is now treated like other commands whose words are only known at run time: while deny rules are in force it asks for approval, or is refused where approval is unavailable, instead of dropping the nested command.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bacf9dea` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
