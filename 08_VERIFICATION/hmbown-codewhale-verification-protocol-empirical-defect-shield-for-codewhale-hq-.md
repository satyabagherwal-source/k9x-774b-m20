# Verification Protocol: Verification Protocol: Empirical Defect Shield for codewhale-hq/Codewhale

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/Hmbown/Codewhale",
  "source_version": "02e1c520",
  "license": "MIT",
  "timestamp": "2026-11-27T15:18:20.359Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/Hmbown/Codewhale) (Revision: `02e1c520`).  
> **License**: MIT | **Timestamp**: `2026-11-27T15:18:20.359Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## 1. Scope & Verification Target
- **Target Repository**: `codewhale-hq/Codewhale` (Commit: `02e1c520`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): codewhale-hq/Codewhale

> **Canonical Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-27T15:18:18.873Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source Rust coding agent for terminal, web, and desktop. Any model, multi-agent fleets, MCP & plugins, OS sandboxing, and session receipts.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41215 stars

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
    SessionRelay,
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
            Self::SessionRelay => "session_relay",
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
            Self::SessionRelay => "<!-- cw:ctx:session_relay -->",
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
            Self::SessionRelay => FragmentRole::SessionRelay,
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
            Self::SessionRelay,
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
    SessionRelay,
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
            Self::SessionRelay => "session_relay",
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
- **Issue #7565** (2026-11-27): **fix(engine): preserve pasted summary headers during compaction**
  *Symptoms*: ## What and why  Compaction could replace a real user message that began with the exact legacy summary header. This change uses checkpoint structure and provenance to choose what it can replace. A bare header follows the normal user-text retention budget. When a pasted header shares a message with a tool result, the result stays only if its matching call survives.  The next compaction replaces the previous verified checkpoint. A legacy checkpoint can be identified during restore when the saved system summary matches it. An older save with only a bare history row keeps that row as conversation text. Under pressure this can make compaction preserve the original history and report that it could not shrink it. The published era-based retention API keeps its existing behavior.  ## Where this came from  Closes #7562. Thanks for tracing the compaction-time deletion and separating it from the restore case.  ## How I tested it  - The baseline compaction path dropped the pasted text. The isolated harness used the production selection, replacement, and shrink checks and reported `test result: ok. 13 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s`. With a fixed summary response, two consecutive passes reduced the fixture from 2,429 to 809 and from 3,068 to 809 estimated tokens. The pasted text survived exactly once, each tool result kept its matching call, and the previous checkpoint was replaced. - The same harness covered an older bare TUI snapshot and a sna

- **Issue #7563** (2026-11-27): **fix(tui): open inline skill completion after CJK text**
  *Symptoms*: ## What and why  An inline skill mention (`/my-review` or `$my-review` inside a message) only opens the skill completion popup when the `/` or `$` follows whitespace or an ASCII bracket or quote. Chinese and Japanese text has no spaces between words, so `请用$my` or `请用/my` shows nothing, while `please use $my` lists `$my-review`.  This is the same check #7258 relaxed for `@` file mentions. `is_inline_skill_mention_start` now also accepts a CJK character before the trigger, using the same `codewhale_tui_kit::translation::is_cjk`, so `（$my` and `看看，/my` open the popup too. A `/` after ASCII text, as in `path/my`, still doesn't open it.  One side effect: in `是/否`, the popup briefly lists every skill right after the `/` is typed and closes once `否` is typed, because skill names are ASCII and the partial no longer matches. Pressing Enter right after a trailing `/` picks a skill, which is what `please use /` already does.  ## Where this came from  Bug fix, a sister of #7258.  ## How I tested it  - Added `inline_skill_popup_opens_directly_after_cjk_text`. It covers `请用/my`, `请用$my`, `（$my` and `看看，/my`, and checks that `path/my` stays closed. Without the `is_cjk` line it fails on the first input with `left: []` against `right: ["/my-review"]`. - `cargo test -p codewhale-tui --lib` filtered to `inline_skill` (6), `slash` (88), `skill` (121) and `mention` (90): all pass. - `RUST_MIN_STACK=16777216 cargo test -p codewhale-tui --lib tui::`: 3998 passed. The 1 failure is `config_panel_gol

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

### Incident Patch 1: `a82afef9` (2026-11-27)
**Commit Message**: fix(engine): compaction summaries reuse the turn's cached prefix on DeepSeek

What: manual /compact now sends the tools the last turn's request carried
(Session::last_request_tools, recorded where the primary and RLM requests
are prepared), as the auto and overflow-recovery passes already did. On
DeepSeek the summary request sends the turn's tool_choice
(default_tool_choice(false), {"type":"auto"}) instead of "none". A summary
reply containing a tool call now takes the existing unusable-summary path
(one conservative retry, then failure with history kept) instead of
failing the pass outright. docs/CACHE.md (en and zh_hans) gains a
"Compaction summary requests" section.

Why (#7564, reported by LmeSzinc): on deepseek-v4-flash every summary hit
only the system prompt (17,920 tokens on two manual passes in two
sessions, about 20k on auto passes) and missed 169k-765k tokens. Manual
passes sent no tools, so the prefix diverged right after the system
prompt. Auto passes sent tool_choice "none". DeepSeek thinking turns never
send tool_choice, because the chat client drops auto/required but forwards
none, and non-thinking turns send auto, so the summary was the only
request that carried "n

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **`/compact` and automatic compaction reuse the turn's prompt cache on DeepSeek:** the manual summary request now carries the tools the last turn sent, and on DeepSeek every summary request sends the turn's own `tool_choice` instead of `none`, so the cached system prompt, tools and history are no longer billed again as cache misses. A summary reply that calls a tool is treated as unusable and retried once with the stricter prompt; if that also fails, the conversation is kept unchanged. Thanks [@LmeSzinc](https://github.com/LmeSzinc) for the audit-log numbers that pinned this down. (#7564)
 - **Contained processes are killed when Codewhale exits on a signal:** process groups started for `sandbox run`, verifier gates, hooks, MCP servers and other contained helpers are now killed on SIGINT, SIGTERM or SIGHUP, a crashed MCP server's leftover processes are killed as soon as its exit is seen, and a timed-out or stopped verifier gate kills its whole process tree on Windows. (#6558)
 - **A failed or timed-out Python REPL round no longer leaves child processes behind:** the round, and REPL shutdown, now kill every process the interpreter started, not only the interpreter. (#6559)
 - **A lane start that fails after creating its worktree no longer orphans it:** the failed lane records the worktree and branch, and the worktree TTL applies. (#6558)
```

**File**: `crates/engine/src/client/test_cases_01.rs` (modified, +47/-32)
```diff
@@ -1030,51 +1030,66 @@ fn compaction_summary_request_extends_the_parent_turn_prompt_bytes() {
     ];
     let system = SystemPrompt::Text("pinned system prompt".to_string());
     let tools = vec![test_tool("read"), test_tool("bash")];
-    let effort = "high";
-    let parent = codewhale_core::request::prepare_primary_turn_request(
-        codewhale_core::request::PrimaryTurnRequest {
-            model: model.to_string(),
-            messages: history.clone(),
-            max_tokens: 64_000,
-            system: Some(system.clone()),
-            tools: Some(tools.clone()),
-            tool_choice: Some(json!({"type": "auto"})),
-            reasoning_effort: Some(effort.to_string()),
-        },
-    );
     let config = crate::compaction::CompactionConfig {
         model: model.to_string(),
         ..Default::default()
     };
-    let mut summary_history = history;
+    let mut summary_history = history.clone();
     summary_history.push(text(Role::User, "write the handoff summary"));
-    let summary = crate::compaction::compaction_summary_request(
-        summary_history,
-        &config,
-        Some(&system),
-        Some(&tools),
-        Some(effort),
-        8_192,
-    );
+    let parent_for = |effort: &str| {
+        codewhale_core::request::prepare_primary_turn_request(
+            codewhale_core::request::PrimaryTurnRequest {
+                model: model.to_string(),
+                messages: history.clone(),
+                max_tokens: 64_000,
+                system: Some(system.clone()),
+                tools: Some(tools.clone()),
+                tool_choice: Some(json!({"type": "auto"})),
+                reasoning_effort: Some(effort.to_string()),
+            },
+        )
+    };
+    let summary_for = |effort: &str, provider: ProviderKind| {
+        crate::compaction::compaction_summary_request(
+            summary_history.clone(),
+            &config,
+            Some(&system),
+            Some(&tools),
+            Some(effort),
+            8_192,
+            provider,
+        )
+    };
 
     // Chat Completions: system and history share one `messages` array.
     let client = deepseek_request_boundary_client(
         "https://api.deepseek.com/v1",
         "http://127.0.0.1:9".into(),
     );
-    let parent_body = client
-        .prepare_outbound_request(parent.clone(), true)
-        .expect("parent prepares")
-        .body;
-    let summary_body = client
-        .prepare_outbound_request(summary.clone(), false)
-        .expect("summary prepares")
-        .body;
-    assert_extends("chat", &parent_body["messages"], &summary_body["messages"]);
-    for key in ["model", "tools", "reasoning_effort", "thinking"] {
-        assert_eq!(parent_body.get(key), summary_body.get(key), "chat {key}");
+    for effort in ["high", "off"] {
+        let parent_body = client
+            .prepare_outbound_request(parent_for(effort), true)
+            .expect("parent prepares")
+            .body;
+        let summary_body = client
+            .prepare_outbound_request(summary_for(effort, ProviderKind::Deepseek), false)
+            .expect("summary prepares")
+            .body;
+        assert_extends("chat", &parent_body["messages"], &summary_body["messages"]);
+        for key in ["model", "tools", "tool_choice", "reasoning_effort", "thinking"] {
+            assert_eq!(
+                parent_body.get(key),
+                summary_body.get(key),
+                "chat {effort} {key}"
+            );
+        }
     }
 
+    let effort = "high";
+    let parent = parent_for(effort);
+    let summary = summary_for(effort, ProviderKind::OpenaiCodex);
+    assert_eq!(summary.tool_choice, Some(json!("none")));
+
     // Responses (the Codex route where the 0% hit was recorded).
     let parent_body =
         responses::build_responses_body_for_provider(&parent, ProviderKind::OpenaiCodex, None);
```

**File**: `crates/engine/src/compaction.rs` (modified, +98/-26)
```diff
@@ -101,8 +101,8 @@ pub struct PreparedCompactionEnvelope {
     pub input_token_ratio: (usize, usize),
     /// Durable handoff owner; set by the engine, never added to the stable prefix.
     pub session_id: Option<String>,
-    /// Exact tool prefix of the interrupted request. Tool execution remains
-    /// disabled on the summary call; retaining schemas preserves cache reuse.
+    /// Exact tool prefix of the interrupted request. A summary reply that
+    /// calls a tool is never executed; retaining schemas preserves cache reuse.
     pub tools: Option<Vec<Tool>>,
     /// Resolved reasoning tier the parent turn sends (#6540). Reasoning
     /// routes render the effort into the head of the prompt, so a summary
@@ -1877,30 +1877,36 @@ fn validate_compaction_summary(summary: &str) -> Result<String> {
 /// controls differ (output cap, streaming, tool choice), so the provider's
 /// prefix cache covers the history the turn already paid for (#6540).
 ///
-/// Known limit: `tool_choice: "none"` keeps the summary from executing tools.
-/// Anthropic Messages documents a `tool_choice` change as invalidating the
-/// cached *message* blocks (system and tools stay cached), so on those routes
-/// the history is still re-read uncached. The Responses builder forwards
-/// `none` (and sends `auto` for every other choice); its cache effect on
-/// Responses and Chat Completions routes has not been measured live.
+/// On DeepSeek the summary sends the turn's own `tool_choice` (`auto`): a
+/// `none` the turn never sends moved the cached prefix, and the reply is
+/// rejected as unusable if it calls a tool (#7564). Other routes send
+/// `tool_choice: "none"`. Anthropic Messages documents a `tool_choice` change
+/// as invalidating the cached *message* blocks (system and tools stay cached),
+/// so on those routes the history is still re-read uncached; the cache effect
+/// on Responses and other Chat Completions routes has not been measured live.
 pub fn compaction_summary_request(
     history: Vec<Message>,
     config: &CompactionConfig,
     system_prompt: Option<&SystemPrompt>,
     tools: Option<&[Tool]>,
     reasoning_effort: Option<&str>,
     max_tokens: u32,
+    provider: codewhale_config::ProviderKind,
 ) -> MessageRequest {
     MessageRequest {
         model: config.model.clone(),
         messages: history,
         max_tokens,
         system: system_prompt.cloned(),
         tools: tools.map(<[Tool]>::to_vec),
-        // Tool schemas stay for prefix parity; execution stays off.
         tool_choice: tools
             .filter(|tools| !tools.is_empty())
-            .map(|_| serde_json::json!("none")),
+            .map(|_| match provider {
+                codewhale_config::ProviderKind::Deepseek => {
+                    crate::core::engine::tool_catalog::default_tool_choice(false)
+                }
+                _ => serde_json::json!("none"),
+            }),
         metadata: None,
         thinking: None,
         reasoning_effort: reasoning_effort.map(str::to_string),
@@ -2021,6 +2027,7 @@ async fn create_summary(
             tools,
             reasoning_effort,
             max_tokens,
+            cost_route.provider,
         );
 
         let accounting_origin = notice_sink.and_then(|sink| match sink.accounting_origin() {
@@ -2184,27 +2191,27 @@ async fn create_summary(
                 codewhale_models::stop_reason_detail(response.stop_reason.as_deref())
             );
         }
-        if response
+        let summary = if response
             .content
             .iter()
             .any(|block| matches!(block, ContentBlock::ToolUse { .. }))
         {
-            anyhow::bail!(
+            Err(anyhow::anyhow!(
                 "Making room returned a tool call instead of a summary; the original conversation was preserved."
-            );
-        }
-
-        let summary = response
-            .content
-            .iter()
-            .filter_map(|block| match block {
-                ContentBlock::Text { text, .. } => Some(text.clone()),
-                _ => None,
-            })
-            .collect::<Vec<_>>()
-            .join("\n");
-
-        let summary = validate_compaction_summary(&summary);
+            ))
+        } else {
+            validate_compaction_summary(
+                &response
+                    .content
+                    .iter()
+                    .filter_map(|block| match block {
+                        ContentBlock::Text { text, .. } => Some(text.clone()),
+                        _ => None,
+                    })
+                    .collect::<Vec<_>>()
+                    .join("\n"),
+            )
+        };
         if let Err(error) = summary {
             if quality_retry_used {
                 return Err(error.context(
@@ -4545,6 +4552,71 @@ mod tests {
         assert!(!blocks[0].text.contains("(no summary available)"));
     }
 
+    #[tokio::test]
+    async fn tool_call_only_summary_is_unusable_and_retried_o
```

**File**: `crates/engine/src/core/engine/compaction.rs` (modified, +2/-1)
```diff
@@ -534,7 +534,8 @@ impl Engine {
         let mut turn_status = TurnOutcomeStatus::Completed;
         let mut turn_error = None;
 
-        let prepared = self.prepare_compaction_envelope(self.config.compaction.clone());
+        let mut prepared = self.prepare_compaction_envelope(self.config.compaction.clone());
+        prepared.tools.clone_from(&self.session.last_request_tools);
         let threshold_tokens = prepared.config.token_threshold;
         let compaction_window_tokens = prepared.config.effective_context_window;
         let pass = |path: Option<crate::compaction::CompactionPath>, usage: Usage| CompactionPass {
```

**File**: `crates/engine/src/core/engine/tests/compaction.rs` (modified, +144/-0)
```diff
@@ -756,3 +756,147 @@ fn a_request_that_cannot_fit_names_the_cause_and_one_next_step() {
         "headless has no command layer: {message}"
     );
 }
+
+#[tokio::test]
+async fn manual_compaction_reuses_the_last_turn_request_header() {
+    use wiremock::matchers::{method, path};
+    use wiremock::{Mock, MockServer, Request, ResponseTemplate};
+
+    let _env_lock = lock_test_env();
+    let _cost_scope = crate::cost_status::test_scope();
+    let workspace = tempdir().expect("isolated compaction workspace");
+    let _home = EnvVarGuard::set("CODEWHALE_HOME", workspace.path());
+    let server = MockServer::start().await;
+    Mock::given(method("POST"))
+        .and(path("/v1/chat/completions"))
+        .respond_with(|request: &Request| {
+            let body: Value = serde_json::from_slice(&request.body).expect("request JSON");
+            if body["stream"] == json!(true) {
+                ResponseTemplate::new(200)
+                    .insert_header("content-type", "text/event-stream")
+                    .set_body_string(concat!(
+                        "data: {\"id\":\"turn\",\"choices\":[{\"index\":0,",
+                        "\"delta\":{\"content\":\"The store migration is transactional now.\"},",
+                        "\"finish_reason\":null}]}\n\n",
+                        "data: {\"id\":\"turn\",\"choices\":[{\"index\":0,",
+                        "\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
+                        "data: [DONE]\n\n",
+                    ))
+            } else {
+                ResponseTemplate::new(200).set_body_json(json!({
+                    "id": "summary",
+                    "object": "chat.completion",
+                    "model": codewhale_config::descriptors::defaults::DEFAULT_TEXT_MODEL,
+                    "choices": [{
+                        "index": 0,
+                        "message": { "role": "assistant", "content": "Primary request: keep the session store migration transactional. Completed: the migration was made transactional. Next: run session_store::roundtrip and report the result." },
+                        "finish_reason": "stop",
+                    }],
+                    "usage": { "prompt_tokens": 41, "completion_tokens": 7, "total_tokens": 48 },
+                }))
+            }
+        })
+        .mount(&server)
+        .await;
+    let route_config = {
+        let provider = Some("deepseek".to_string());
+        let mut config: Config = Config::default();
+        config.provider = provider;
+        config
+    }
+    .with_legacy_root(
+        Some("fixture-key".to_string()),
+        Some(format!("{}/v1", server.uri())),
+    );
+    let (engine, handle) = Engine::new(
+        EngineConfig {
+            workspace: workspace.path().to_path_buf(),
+            snapshots_enabled: false,
+            subagents_enabled: false,
+            ..EngineConfig::default()
+        },
+        &route_config,
+    );
+    let run_task = tokio::spawn(engine.run());
+    let wait_for_terminal = |expect_compaction: bool| {
+        let handle = &handle;
+        async move {
+            let mut rx = handle.rx_event.write().await;
+            loop {
+                let event = tokio::time::timeout(Duration::from_secs(30), rx.recv())
+                    .await
+                    .expect("engine terminal")
+                    .expect("engine event channel");
+                if let Event::TurnComplete {
+                    compaction_id,
+                    status,
+                    error,
+                    ..
+                } = event
+                {
+                    assert_eq!(compaction_id.is_some(), expect_compaction);
+                    assert_eq!(status, TurnOutcomeStatus::Completed, "{error:?}");
+                    return;
+                }
+            }
+        }
+    };
+
+    handle
+        .send(external_user_message_op(
+            "Keep the session store migration transactional.",
+            AppMode::Agent,
+            &route_config,
+        ))
+        .await
+        .expect("send turn");
+    wait_for_terminal(false).await;
+    handle
+        .send(Op::CompactContext {
+            id: "compact-header-parity".to_string(),
+            route: resolved_route_for_test(
+                &route_config,
+                codewhale_config::descriptors::defaults::DEFAULT_TEXT_MODEL,
+            ),
+            compaction: Box::new(CompactionConfig::default()),
+        })
+        .await
+        .expect("send manual compaction");
+    wait_for_terminal(true).await;
+    run_task.abort();
+
+    let bodies = server
+        .received_requests()
+        .await
+        .expect("recorded requests")
+        .iter()
+        .map(|request| serde_json::from_slice::<Value>(&request.body).expect("request JSON"))
+        .collect::<Vec<_>>();
+    let turn = bodies
+        .iter()
+        .find(|body| body["stream"] == json!(true))
+        .expect("turn request");
+    let sum
```

**File**: `crates/engine/src/core/engine/tests/test_cases_07.rs` (modified, +2/-2)
```diff
@@ -714,8 +714,8 @@ fn automatic_compaction_continues_one_task_and_preserves_failed_history() {
                             if fail_summary {
                                 assert_eq!(status, TurnOutcomeStatus::Failed, "{error:?}");
                                 assert!(error.as_deref().is_some_and(|message| {
-                                    message.contains("tool call instead of a summary")
-                                        && message.contains("original conversation was preserved")
+                                    message.contains("remained unusable after one conservative retry")
+                                        && message.contains("no replacement checkpoint was committed")
                                 }), "{error:?}");
                             } else {
                                 assert_eq!(status, TurnOutcomeStatus::Completed, "{error:?}");
```

**File**: `crates/engine/src/core/engine/turn_loop/preparation.rs` (modified, +2/-0)
```diff
@@ -687,6 +687,7 @@ impl Engine {
             .and_then(|limits| limits.context_tokens);
 
         turn.stop_diagnostics.last_prepared_output_limit_tokens = Some(request.max_tokens);
+        self.session.last_request_tools.clone_from(&request.tools);
 
         // Stream the response. Keep the request around (cloned into the
         // first call) so we can resend it on a transparent retry below
@@ -936,6 +937,7 @@ impl Engine {
             );
         turn.last_request_snapshot = Some(snapshot.clone());
         turn.stop_diagnostics.last_prepared_output_limit_tokens = Some(request.max_tokens);
+        self.session.last_request_tools.clone_from(&request.tools);
         let _ = self
             .send_event(Event::ToolRequestSnapshot { snapshot })
             .await;
```

**File**: `crates/engine/src/core/session.rs` (modified, +3/-0)
```diff
@@ -445,6 +445,8 @@ pub struct Session {
     /// (#5577). Cleared when history is rewritten (compaction, restore).
     pub latest_parent_input_tokens: Option<u32>,
 
+    pub last_request_tools: Option<Vec<codewhale_models::Tool>>,
+
     pub agent_preset: Option<String>,
 }
 
@@ -521,6 +523,7 @@ impl Session {
             tool_activation_cache: ToolActivationCache::default(),
             messages_revision: 0,
             latest_parent_input_tokens: None,
+            last_request_tools: None,
             agent_preset: None,
         }
     }
```

---

### Incident Patch 2: `ed8612f4` (2026-11-27)
**Commit Message**: docs(credits): credit chuenchen309 for the CJK skill completion fix (PR 7563)

check-contributor-credit.py requires every commit author in the release
window on docs/CONTRIBUTORS.md, the CHANGELOG Contributors block and
web/lib/release-credits.ts. Check: all 11 contributors credited.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -79,6 +79,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **The shared pet companion (`codewhale pet serve`)** and, in the terminal, sound, replay export, the browser appearance studio, source selection, the pixel, particle, cove, braille and whale-girl views, view cycling and avatar packs; `/pet inspect|status|appearance|style|source|export|sound|avatar|action|view` and the F6 and F8 keys. F5 still opens replies and agents. Files left in `~/.codewhale/pet-shared` are neither read nor deleted. Plugins can still register avatar packs; the terminal no longer draws them.
 - **The `SUPERFAST_ENABLED`, `SUPERFAST_PROVIDER`, `SUPERFAST_BASE_URL`, `SUPERFAST_MODEL` and `SUPERFAST_TIMEOUT_MS` variables** and the gate's separate 150 ms call. Setting any of them logs one warning naming `[auto.router] shadow_gate`. (#6603)
 
+### Contributors
+
+Thanks to [@chuenchen309](https://github.com/chuenchen309) and [@NieZhuZhu](https://github.com/NieZhuZhu).
+
 ## [0.10.5] - 2026-11-24
 
 Codewhale v0.10.5 simplifies the terminal and runtime, expands DeepSeek Harness 0.2.2 host compatibility (with 13/33 pinned packages passing the full local Engine lifecycle and 15/36 cold-activating in the extension host), serves the shared `codewhale-app` web build from `codewhale web`, adds external ACP agent selection in `/model`, unifies the `codewhale-design` 5.5.0 Obsidian/Porcelain Whale Dark/Light palette and Title Case permission dial across all 15 TUI locales, aligns telemetry disclosures to first-party-only collection, and lands community security and reliability fixes.
```

**File**: `crates/tui/CHANGELOG.md` (modified, +4/-0)
```diff
@@ -79,6 +79,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **The shared pet companion (`codewhale pet serve`)** and, in the terminal, sound, replay export, the browser appearance studio, source selection, the pixel, particle, cove, braille and whale-girl views, view cycling and avatar packs; `/pet inspect|status|appearance|style|source|export|sound|avatar|action|view` and the F6 and F8 keys. F5 still opens replies and agents. Files left in `~/.codewhale/pet-shared` are neither read nor deleted. Plugins can still register avatar packs; the terminal no longer draws them.
 - **The `SUPERFAST_ENABLED`, `SUPERFAST_PROVIDER`, `SUPERFAST_BASE_URL`, `SUPERFAST_MODEL` and `SUPERFAST_TIMEOUT_MS` variables** and the gate's separate 150 ms call. Setting any of them logs one warning naming `[auto.router] shadow_gate`. (#6603)
 
+### Contributors
+
+Thanks to [@chuenchen309](https://github.com/chuenchen309) and [@NieZhuZhu](https://github.com/NieZhuZhu).
+
 ## [0.10.5] - 2026-11-24
 
 Codewhale v0.10.5 simplifies the terminal and runtime, expands DeepSeek Harness 0.2.2 host compatibility (with 13/33 pinned packages passing the full local Engine lifecycle and 15/36 cold-activating in the extension host), serves the shared `codewhale-app` web build from `codewhale web`, adds external ACP agent selection in `/model`, unifies the `codewhale-design` 5.5.0 Obsidian/Porcelain Whale Dark/Light palette and Title Case permission dial across all 15 TUI locales, aligns telemetry disclosures to first-party-only collection, and lands community security and reliability fixes.
```

**File**: `docs/CONTRIBUTORS.md` (modified, +2/-1)
```diff
@@ -18,7 +18,7 @@ and [CHANGELOG.md](../CHANGELOG.md).
 
 448 people have code, co-authored commits, carried-forward pull requests or credited reports in Codewhale. GitHub's contributor count includes only commit authors and co-authors whose email is linked to their account, so it misses many of them. If your commits are missing there, add your commit email to your GitHub account and they will link.
 
-[0gl20shk0sbt36](https://github.com/0gl20shk0sbt36) · [1Git2Clone](https://github.com/1Git2Clone) · [20bytes](https://github.com/20bytes) · [47Cid](https://github.com/47Cid) · [7jrxt42BxFZo4iAnN4CX](https://github.com/7jrxt42BxFZo4iAnN4CX) · [8sero](https://github.com/8sero) · [A-Corner](https://github.com/A-Corner) · [aboimpinto](https://github.com/aboimpinto) · [Aboysky](https://github.com/Aboysky) · [adity982](https://github.com/adity982) · [AdityaVG13](https://github.com/AdityaVG13) · [AGSaturn](https://github.com/AGSaturn) · [ai-dengwsh](https://github.com/ai-dengwsh) · [aiapienthusiast](https://github.com/aiapienthusiast) · [Aitensa](https://github.com/Aitensa) · [AiurArtanis](https://github.com/AiurArtanis) · [alitvak69](https://github.com/alitvak69) · [all-lopezg](https://github.com/all-lopezg) · [alphapku-ux](https://github.com/alphapku-ux) · [alvin1](https://github.com/alvin1) · [amuthantamil](https://github.com/amuthantamil) · [AnaheimEX](https://github.com/AnaheimEX) · [Andrea-Bruno](https://github.com/Andrea-Bruno) · [Angel-Hair](https://github.com/Angel-Hair) · [angziii](https://github.com/angziii) · [AnonymousUser443](https://github.com/AnonymousUser443) · [antarikshraya](https://github.com/antarikshraya) · [Anyexyz](https://github.com/Anyexyz) · [Apeiron0w0](https://github.com/Apeiron0w0) · [aqilaziz](https://github.com/aqilaziz) · [AquaZhang](https://github.com/AquaZhang) · [AresNing](https://github.com/AresNing) · [ArronAI007](https://github.com/ArronAI007) · [Artenx](https://github.com/Artenx) · [asdfg314284230](https://github.com/asdfg314284230) · [Asteria1028](https://github.com/Asteria1028) · [asto18089](https://github.com/asto18089) · [atmosuwiryo](https://github.com/atmosuwiryo) · [axobase001](https://github.com/axobase001) · [aznikline](https://github.com/aznikline) · [b84330808](https://github.com/b84330808) · [baendlorel](https://github.com/baendlorel) · [banqii](https://github.com/banqii) · [Beltran12138](https://github.com/Beltran12138) · [bevis-wong](https://github.com/bevis-wong) · [BH8GCJ](https://github.com/BH8GCJ) · [BigBenLabs](https://github.com/BigBenLabs) · [Biilow](https://github.com/Biilow) · [bistack](https://github.com/bistack) · [BrathonBai](https://github.com/BrathonBai) · [bruce6135](https://github.com/bruce6135) · [BryonGo](https://github.com/BryonGo) · [buiducnhat](https://github.com/buiducnhat) · [buko](https://github.com/buko) · [BX166](https://github.com/BX166) · [c020627](https://github.com/c020627) · [cacdcaecawae](https://github.com/cacdcaecawae) · [caeserchen](https://github.com/caeserchen) · [caiyilian](https://github.com/caiyilian) · [CCChisato](https://github.com/CCChisato) · [ccomma](https://github.com/ccomma) · [cenab](https://github.com/cenab) · [ChaceLyee2101](https://github.com/ChaceLyee2101) · [chatman-media](https://github.com/chatman-media) · [chennest](https://github.com/chennest) · [chinaqy110](https://github.com/chinaqy110) · [chnjames](https://github.com/chnjames) · [chuntseevolving](https://github.com/chuntseevolving) · [ci4ic4](https://github.com/ci4ic4) · [cian-lien](https://github.com/cian-lien) · [cmdcorp6534](https://github.com/cmdcorp6534) · [cmyyy](https://github.com/cmyyy) · [codepgq](https://github.com/codepgq) · [Colorful-glassblock](https://github.com/Colorful-glassblock) · [ComeFromTheMars](https://github.com/ComeFromTheMars) · [CrepuscularIRIS](https://github.com/CrepuscularIRIS) · [ct-jaryn](https://github.com/ct-jaryn) · [ctxyao](https://github.com/ctxyao) · [cy2311](https://github.com/cy2311) · [cyq1017](https://github.com/cyq1017) · [czf0718](https://github.com/czf0718) · [DarrellThomas](https://github.com/DarrellThomas) · [ddlw](https://github.com/ddlw) · [demian-welt](https://github.com/demian-welt) · [deosiree](https://github.com/deosiree) · [Dev-next-gen](https://github.com/Dev-next-gen) · [dfwqdyl-ui](https://github.com/dfwqdyl-ui) · [DI-HUO-MING-YI](https://github.com/DI-HUO-MING-YI) · [diegovskytl](https://github.com/diegovskytl) · [DieMoe233](https://github.com/DieMoe233) · [DingYong4223](https://github.com/DingYong4223) · [disappear00](https://github.com/disappear00) · [djairjr](https://github.com/djairjr) · [dmitri-0](https://github.com/dmitri-0) · [dmt4](https://github.com/dmt4) · [donglovejava](https://github.com/donglovejava) · [douglarek](https://github.com/douglarek) · [Dr3259](https://github.com/Dr3259) · [DracheTek](https://github.com/DracheTek) · [drpars](https://github.com/drpars) · [dsingal0](https://github.com/dsingal0) · [dst1213](https://github.com/dst1213) · [duanchao-lab](https://github.com/duanchao
```

**File**: `web/lib/release-credits.ts` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ export const RELEASE_CONTRIBUTORS: string[] = [
  * one. scripts/check-contributor-credit.py requires them here now; the release
  * cut moves them into RELEASE_CONTRIBUTORS with that release's changelog block.
  */
-export const UNRELEASED_CONTRIBUTORS: string[] = [];
+export const UNRELEASED_CONTRIBUTORS: string[] = ["@chuenchen309"];
 
 /**
  * Contributors who helped with reports, reproductions, and verification.
```

---

### Incident Patch 3: `eb3a402d` (2026-11-27)
**Commit Message**: fix(release): qualify the Windows piped-stdin import on x64 and ARM64

The three executables on each Windows target in nightly 45843049590 stopped on Kernel32 PeekNamedPipe. Add only the observed pair. Microsoft documents Windows 2000 Professional for x64; the native ARM64 export probe in run 46009560246 resolved 450/450 on build 26200.9974. Keep machine profiles, minimum floors and the import checker intact.

Replayed all six retained object dumps: x64 459/459, ARM64 450/450 for each executable. Verified a single rejected pair before the change and zero after. Engine preflight and diff checks passed. These checks do not execute the Windows binaries.

**File**: `scripts/release/windows-import-floor.json` (modified, +40/-3)
```diff
@@ -6,7 +6,7 @@
       "osArchitecture": "x64",
       "qualification": {
         "result": "PASS",
-        "kind": "reporter exact-OS export resolution plus 19 documented Microsoft named API minima",
+        "kind": "reporter exact-OS export resolution plus 20 documented Microsoft named API minima",
         "evidence": {
           "issue": "https://github.com/codewhale-hq/Codewhale/issues/6953",
           "binary": "https://github.com/codewhale-hq/Codewhale/releases/download/v0.10.1/codewhale-windows-x64.exe",
@@ -16,7 +16,7 @@
           "previous_sha256": "f7b35a1e928f67884637f36b01fc72854f50690130f191bac3bcf62ece3c1d84"
         },
         "runtimeAcceptance": "Final 0.10.2 release bytes on 14393 not run",
-        "qualifiedPairs": 475,
+        "qualifiedPairs": 476,
         "namedApiContracts": [
           {
             "dll": "advapi32.dll",
@@ -131,6 +131,12 @@
             "symbol": "IsProcessorFeaturePresent",
             "minimumClient": "Windows 2000 Professional",
             "source": "https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-isprocessorfeaturepresent"
+          },
+          {
+            "dll": "kernel32.dll",
+            "symbol": "PeekNamedPipe",
+            "minimumClient": "Windows 2000 Professional",
+            "source": "https://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-peeknamedpipe"
           }
         ],
         "namedApiContractEvidence": {
@@ -174,6 +180,16 @@
                 "kernel32.dll!IsProcessorFeaturePresent"
               ],
               "scope": "api-ms-win-crt-math-l1-1-0.dll!cosf from f32::cos() in TUI/ratatui 5.4.0 live motion and kernel32.dll!IsProcessorFeaturePresent from the windows-2025-vs2026 runner's MSVC 14.52 / Visual Studio 18.12 toolchain update (not a Codewhale call site); documentation-backed static contracts, same limits as above"
+            },
+            {
+              "candidateRun": "https://github.com/codewhale-hq/Codewhale/actions/runs/45843049590",
+              "source": "8838e415c0074e05931313e81e16de1c91210d99",
+              "binarySha256": "6e1ee958ad1ca7f9fe4d607ff201dc2f401d396f393c5b22869994615cae2090",
+              "importReceiptSha256": "5ca1eb5757ccf4e1b41db8493e09339db230eaf5b8782a2902146177935cd8f4",
+              "pairs": [
+                "kernel32.dll!PeekNamedPipe"
+              ],
+              "scope": "The Windows TUI reads piped stdin with PeekNamedPipe. Microsoft documents this Kernel32 export before the Windows 10 build 14393 floor."
             }
           ]
         }
@@ -533,6 +549,7 @@
           "OpenThread",
           "OutputDebugStringA",
           "OutputDebugStringW",
+          "PeekNamedPipe",
           "PostQueuedCompletionStatus",
           "Process32FirstW",
           "Process32NextW",
@@ -990,7 +1007,26 @@
               }
             }
           }
-        }
+        },
+        "additionalExportProbes": [
+          {
+            "pairs": [
+              "kernel32.dll!PeekNamedPipe"
+            ],
+            "time": "2026-11-27T13:44:14.6692724Z",
+            "osBuild": "26200.9974",
+            "processArchitecture": "ARM64",
+            "source": "8838e415c0074e05931313e81e16de1c91210d99",
+            "buildRun": "https://github.com/codewhale-hq/Codewhale/actions/runs/45843049590",
+            "probeRun": "https://github.com/codewhale-hq/Codewhale/actions/runs/46009560246",
+            "binarySha256": "8707e805f714d9a2f684a899ee38cbca7279d7c702a9d41fcf72b6c59fb8a137",
+            "importReceiptSha256": "6a678edcc271ceb97fc23438283fce7f9db74f81463c413dccfb5a0500421122",
+            "probeReceiptSha256": "ef1cddbd19ae952531b11a5c16a62cbedba591e114a383d51383348c1152a6dc",
+            "kernel32Sha256": "3b05fea371380c19022ca18c8ece9690057108954794038e9818f0dfeaf1cb46",
+            "resolved": 450,
+            "unresolved": 0
+          }
+        ]
       },
       "imports": {
         "advapi32.dll": [
@@ -1347,6 +1383,7 @@
           "OpenThread",
           "OutputDebugStringA",
           "OutputDebugStringW",
+          "PeekNamedPipe",
           "PostQueuedCompletionStatus",
           "Process32FirstW",
           "Process32NextW",
```

#### Recent Merged Pull Requests:
- **PR #7565** (2026-11-27): fix(engine): preserve pasted summary headers during compaction (@NieZhuZhu)
- **PR #7563** (2026-11-27): fix(tui): open inline skill completion after CJK text (@chuenchen309)
- **PR #7561** (2026-11-25): fix(util,engine): resolve remaining R5 durability, grep timeout cancel, and bounded review read defects (@NieZhuZhu)
- **PR #7560** (2026-11-25): chore(release): cut 0.10.5 (@Hmbown)
- **PR #7559** (closed): docs(changelog): consolidate and deduplicate the 0.10.5 Unreleased notes (@Hmbown)
- **PR #7558** (2026-11-24): feat(0.10.5): DSH 0.2.2 host services, per-plugin settings, telemetry honesty, and Wave 2 runtime (@Hmbown)

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

## X. engine): compaction summaries reuse the turn's cached prefix on DeepSeek

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a82afef9`: engine): compaction summaries reuse the turn's cached prefix on DeepSeek. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **`/compact` and automatic compaction reuse the turn's prompt cache on DeepSeek:** the manual summary request now carries the tools the last turn sent, and on DeepSeek every summary request sends the turn's own `tool_choice` instead of `none`, so the cached system prompt, tools and history are no longer billed again as cache misses. A summary reply that calls a tool is treated as unusable and retried once with the stricter prompt; if that also fails, the conversation is kept unchanged. Thanks [@LmeSzinc](https://github.com/LmeSzinc) for the audit-log numbers that pinned this down. (#7564)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a82afef9` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
