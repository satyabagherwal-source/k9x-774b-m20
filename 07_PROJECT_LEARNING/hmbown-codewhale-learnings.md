> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: github ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Source Version**: `622a4930`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T07:47:05.747Z  
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
> **Harvest Timestamp**: 2026-11-13T07:47:05.740Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: An open-source coding agent for your terminal, written in Rust. It works with any model, can split one task across several agents, and every line of it is yours to read.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41176 stars

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
- **Issue #7323** (2026-11-12): **fix(app-server): read the original path of a worktree-side rename**
  *Symptoms*: ## What and why  `parse_porcelain` in `crates/app-server/src/runtime_api/git.rs` read the extra original-path record of a rename/copy only when the **index** column was `R` or `C`.  Git reports a rename in either column, and since 2.18 the worktree column carries one when only the working tree moved — for example `git mv` followed by `git reset` and `git add -N`, which reports `" R new.md\0old.md\0"`. The original-path record was then parsed as a status row of its own:  - With a non-ASCII source (`ab说明.md`), `record[3..]` sliced at byte 3, inside `说` (`E8 AF B4`), and panicked. The panic happens inside `spawn_blocking`, so every `GET /v1/git` and `GET /v1/changes` returned 500 `git status failed` until the worktree changed. - With an ASCII source, a phantom row appeared (`index = 'a'`, `worktree = '.'`, `path = "xt"`), corrupting the file list, the staged/unstaged counts and the row revision tokens.  The parser now reads the original path when either column reports a rename or copy, and slices the path through `get` before consuming the next field, so a malformed record is skipped instead of panicking and the record stream stays in sync.  ## Where this came from  Refs #7309  ## How I tested it  Two new tests in the existing `runtime_api::git::tests` module. Both use a real temporary repository and drive the same sequence the issue describes (`git mv`, `git reset`, `git add -N`), so neither mocks the parser input.  `cargo test -p codewhale-app-server --lib -- worktree_column_r

- **Issue #7322** (2026-11-12): **fix(tui): count characters, not bytes, for the session title limit**
  *Symptoms*: ## What and why  Renaming a session in the session picker rejected a 36-character Chinese title as too long ("1–100 characters").  - **Root cause**: `SessionPickerView::rename_selected` checked `new_title.len() > 100`, which counts bytes. A CJK character is three bytes in UTF-8, so a Chinese title over 33 characters failed the check. The engine's own rename validation already counts characters against `MAX_SESSION_TITLE_CHARS`. - **Fix**: the picker counts characters and uses `MAX_SESSION_TITLE_CHARS` instead of the literal `100`, so it matches the engine and the message.  ## Where this came from  Bug fix, no issue.  ## How I tested it  - New regression test `rename_selected_limits_title_by_characters` (36 Chinese characters, 108 bytes). It fails on `main` (the rename is rejected) and passes with the fix. - With the branch merged onto current `main`: `RUST_MIN_STACK=16777216 cargo test --locked -p codewhale-tui --lib -- session_picker::tests::rename_selected`: 2 passed, 0 failed. With the old byte check put back: 1 passed, 1 failed (`rename_selected_limits_title_by_characters`). - `cargo fmt --all -- --check`: clean  ## Checklist  - [x] One focused change, started from current `main` (no need to rebase when `main` moves) - [x] `cargo fmt --all` passes, and tests cover new or changed behavior - [ ] If this adds or changes a user-facing feature, I updated its docs and its row in `docs/features.toml` (not applicable: bug fix only) 

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

### Incident Patch 1: `3f2a0194` (2026-11-12)
**Commit Message**: fix(state,snapshot): keep index entries after a torn line and clamp prune age (#7316)

* fix(state,snapshot): keep index entries after a torn line and clamp prune age

Session index: a crash mid-append leaves a final line with no trailing
newline. The next append_thread_name wrote straight after it, so the new
entry joined the fragment, failed to parse and was skipped, and the name
the caller had just saved was lost. Start the entry on a new line when
the file does not end in one. The existing torn-line test wrote its
fragment with writeln!, so it never covered the unterminated case.

Snapshot prune: cutoff was `now - max_age.as_secs() as i64`. A
max_age_days above about 1.07e14 (for example i64::MAX as "keep
forever") gives more than i64::MAX seconds after saturating_mul, the
cast wraps negative, the cutoff lands in the future and every snapshot
is pruned at boot. Clamp to i64::MAX and use saturating_sub.

Both new tests fail on main (thread-3 lookup None; 1 snapshot removed
instead of 0) and pass here: codewhale-state 28 passed,
codewhale-snapshot 92 passed.

Refs #7298

* chore: keep changelog edits out of the branch

**File**: `crates/snapshot/src/repo.rs` (modified, +17/-1)
```diff
@@ -1851,7 +1851,7 @@ impl SnapshotRepo {
             .duration_since(UNIX_EPOCH)
             .map_err(|e| io_other(format!("clock error: {e}")))?
             .as_secs() as i64;
-        let cutoff = now - max_age.as_secs() as i64;
+        let cutoff = now.saturating_sub(i64::try_from(max_age.as_secs()).unwrap_or(i64::MAX));
 
         let snapshots = self.list(usize::MAX)?;
         if snapshots.is_empty() {
@@ -3949,6 +3949,22 @@ mod tests {
         assert_eq!(list[0].label, "turn:1");
     }
 
+    #[test]
+    fn prune_with_an_age_beyond_i64_keeps_every_snapshot() {
+        let tmp = tempdir().unwrap();
+        let (repo, _home) = make_repo(tmp.path());
+        std::fs::write(repo.work_tree().join("f.txt"), "v0").unwrap();
+        repo.snapshot("turn:0").unwrap();
+        std::thread::sleep(Duration::from_millis(1100));
+
+        let removed = repo
+            .prune_older_than(Duration::from_secs(u64::MAX))
+            .unwrap();
+
+        assert_eq!(removed, 0);
+        assert_eq!(repo.list(10).unwrap().len(), 1);
+    }
+
     /// The 2026-08-04 regression: with a cut in the MIDDLE of history,
     /// `prune_older_than` used to `update-ref HEAD <oldest survivor>`, which
     /// orphaned (and gc destroyed) the NEWEST snapshots while keeping the
```

**File**: `crates/state/src/lib.rs` (modified, +37/-2)
```diff
@@ -11,7 +11,7 @@ mod runtime_aliases;
 
 use std::collections::HashMap;
 use std::fs::{self, OpenOptions};
-use std::io::{BufRead, BufReader, Write};
+use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
 use std::path::{Path, PathBuf};
 use std::sync::{Arc, LazyLock, Mutex, MutexGuard};
 
@@ -1453,6 +1453,7 @@ impl StateStore {
         self.with_session_index_lock(|| {
             let mut file = OpenOptions::new()
                 .create(true)
+                .read(true)
                 .append(true)
                 .open(&self.session_index_path)
                 .with_context(|| {
@@ -1461,7 +1462,14 @@ impl StateStore {
                         self.session_index_path.display()
                     )
                 })?;
-            writeln!(file, "{encoded}").context("failed to append session index entry")?;
+            let mut last = *b"\n";
+            if file.metadata()?.len() > 0 {
+                file.seek(SeekFrom::End(-1))?;
+                file.read_exact(&mut last)?;
+            }
+            let separator = if last[0] == b'\n' { "" } else { "\n" };
+            writeln!(file, "{separator}{encoded}")
+                .context("failed to append session index entry")?;
             // Durability: without this a crash mid-write can leave a torn
             // final line. Reads tolerate one (see `session_index_map`), but
             // not losing the entry beats recovering from having lost it.
@@ -2922,6 +2930,33 @@ mod tests {
         );
     }
 
+    #[test]
+    fn session_index_append_after_an_unterminated_torn_line_is_kept() {
+        let store = temp_state_store("session-index-unterminated");
+        store
+            .append_thread_name("thread-1", Some("first".to_string()), 1, None)
+            .expect("append first entry");
+        {
+            let mut file = OpenOptions::new()
+                .append(true)
+                .open(&store.session_index_path)
+                .expect("open session index");
+            write!(file, "{{\"thread_id\":\"thread-2\",\"thread_na").expect("write torn line");
+        }
+
+        store
+            .append_thread_name("thread-3", Some("third".to_string()), 3, None)
+            .expect("append third entry");
+
+        assert_eq!(
+            store
+                .find_thread_name_by_id("thread-3")
+                .expect("lookup thread-3")
+                .as_deref(),
+            Some("third"),
+        );
+    }
+
     /// Hook fired by compaction between writing the snapshot and renaming it
     /// over the live index — the window a concurrent append can be lost in.
     /// Only the store whose path a test registered is affected, so tests
```

---

### Incident Patch 2: `97c1ad92` (2026-11-13)
**Commit Message**: feat(web): first-time guide for people who have never used a terminal (CW-8181)

New docs page /docs/first-time ("Use Codewhale for the first time", en + zh)
on the existing DocArticle renderer and docs-map registry. It covers opening a
terminal on macOS, Windows and Linux; installing and checking the version;
choosing the folder Codewhale works in and when that choice matters; opening a
terminal in a folder from Finder (Services > New Terminal at Folder),
File Explorer (Open in Terminal / Open PowerShell window here), `cd` + drag,
or `codewhale -C <dir>`; first run and provider choice; a first task; and
Esc, /undo, /diff, /receipts, /exit and `codewhale --continue`.

Every claim was checked against the v0.10.2 release, not main:
- workspace = current directory or -C/--workspace (resolve_workspace)
- file tools stay in the workspace unless /trust add, /trust on or Full Access
- Seatbelt on macOS, bubblewrap on Linux only when installed, no Windows sandbox
- snapshots and /undo are off in /, home, and ~/Desktop, Documents,
  Downloads, Library, Movies, Music and Pictures themselves
  (unsafe_workspace_snapshot_reason); snapshots do not need git
- no-git folders ask before edits ("No

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Qwen Code as an external agent:** Codewhale now finds an installed Qwen Code CLI (`qwen`, 0.6.1 or newer) and can run it as a session over ACP with `qwen --acp`. `GET /v1/agents/external` lists it, an older install is reported as needing `npm i -g @qwen-code/qwen-code@latest`, and sign-in stays inside Qwen Code (`/auth`). Thanks [@MannXo](https://github.com/MannXo) (#7293).
 - **README and contributor credit:** the repository front page now opens the way the website does: the line "The model can be anyone's. The agent should be yours.", one sentence on what Codewhale is, the install command and one picture, with reference detail moved into the linked guides; the 18 translated READMEs follow the same structure and say they are machine-drafted. The contributor wall and the website now count the same 433 people (407 GitHub accounts and the commit authors whose email is not linked to an account), where the website had counted accounts only. `DEPENDENCY_SECURITY.md` moved into `docs/dependency-maintenance.md`, and `.github/SUPPORT.md` says where to ask for help.
 - **Website Plugins page:** The website's Plugins page now describes what the released version does, and a labelled section says what 0.10.3 adds: one Plugins place, Standard and Creator mode, and the Permissions control.
+- **First-time guide on the website:** a new docs page, "Use Codewhale for the first time" (`/docs/first-time`, English and Simplified Chinese), walks someone who has never used a terminal through opening one, installing, choosing the folder Codewhale works in and when that choice matters, opening a terminal in a folder from Finder or File Explorer, connecting a model, a first task, and stopping, undoing and quitting. The install page gains a short "New to the terminal?" block for macOS and Windows that links to it, and `llms.txt` carries the same steps.
 - **Plugin docs and plugin-creator:** Docs now say everything you add is a plugin. The bundled plugin-creator skill no longer tells an agent never to trust or enable a plugin (in Full Access it may, for one it wrote and installed from its project), points code and screen plugins at cordis-plugin-development, and an untouched copy from 0.10.2 now upgrades. The Chinese extension and Runtime API docs now say editor ACP sessions get plugin tools and configured MCP servers.
 - **Model thinking:** New installs show model thinking by default: it streams live in the transcript and collapses under a "Thought for …" header when the answer starts. Existing installs keep their saved setting; turn it on under Model reasoning in chat in /config.
 - **Footer clock:** The footer clock and phase now say "thinking", matching the transcript.
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -16,6 +16,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Qwen Code as an external agent:** Codewhale now finds an installed Qwen Code CLI (`qwen`, 0.6.1 or newer) and can run it as a session over ACP with `qwen --acp`. `GET /v1/agents/external` lists it, an older install is reported as needing `npm i -g @qwen-code/qwen-code@latest`, and sign-in stays inside Qwen Code (`/auth`). Thanks [@MannXo](https://github.com/MannXo) (#7293).
 - **README and contributor credit:** the repository front page now opens the way the website does: the line "The model can be anyone's. The agent should be yours.", one sentence on what Codewhale is, the install command and one picture, with reference detail moved into the linked guides; the 18 translated READMEs follow the same structure and say they are machine-drafted. The contributor wall and the website now count the same 433 people (407 GitHub accounts and the commit authors whose email is not linked to an account), where the website had counted accounts only. `DEPENDENCY_SECURITY.md` moved into `docs/dependency-maintenance.md`, and `.github/SUPPORT.md` says where to ask for help.
 - **Website Plugins page:** The website's Plugins page now describes what the released version does, and a labelled section says what 0.10.3 adds: one Plugins place, Standard and Creator mode, and the Permissions control.
+- **First-time guide on the website:** a new docs page, "Use Codewhale for the first time" (`/docs/first-time`, English and Simplified Chinese), walks someone who has never used a terminal through opening one, installing, choosing the folder Codewhale works in and when that choice matters, opening a terminal in a folder from Finder or File Explorer, connecting a model, a first task, and stopping, undoing and quitting. The install page gains a short "New to the terminal?" block for macOS and Windows that links to it, and `llms.txt` carries the same steps.
 - **Plugin docs and plugin-creator:** Docs now say everything you add is a plugin. The bundled plugin-creator skill no longer tells an agent never to trust or enable a plugin (in Full Access it may, for one it wrote and installed from its project), points code and screen plugins at cordis-plugin-development, and an untouched copy from 0.10.2 now upgrades. The Chinese extension and Runtime API docs now say editor ACP sessions get plugin tools and configured MCP servers.
 - **Model thinking:** New installs show model thinking by default: it streams live in the transcript and collapses under a "Thought for …" header when the answer starts. Existing installs keep their saved setting; turn it on under Model reasoning in chat in /config.
 - **Footer clock:** The footer clock and phase now say "thinking", matching the transcript.
```

**File**: `web/app/[locale]/docs/first-time/page.tsx` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { DocArticle } from "../_components/doc-article";
+import { getDocsFirstTime } from "@/lib/i18n/dictionaries";
+import { buildPageMetadata } from "@/lib/page-meta";
+
+export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
+  const { locale } = await params;
+  const t = getDocsFirstTime(locale);
+  return buildPageMetadata({
+    path: "/docs/first-time",
+    locale,
+    title: t.metaTitle,
+    description: t.metaDescription,
+  });
+}
+
+export default async function FirstTimePage({ params }: { params: Promise<{ locale: string }> }) {
+  const { locale } = await params;
+  return <DocArticle t={getDocsFirstTime(locale)} locale={locale} />;
+}
```

**File**: `web/app/[locale]/install/page.tsx` (modified, +24/-0)
```diff
@@ -97,6 +97,30 @@ export default async function InstallPage({ params }: { params: Promise<{ locale
         <div lang={copyLocale}>
           {locale === "zh" ? mirrors : null}
 
+          <Block id="install-new-to-terminal" title={t(INSTALL_COPY.newTitle)}>
+            {p(INSTALL_COPY.newLead)}
+            <Channel id="install-new-macos" title={t(INSTALL_COPY.newMacTitle)}>
+              <ol>
+                <li><Rich text={t(INSTALL_COPY.newMac1)} /></li>
+                <li><Rich text={t(INSTALL_COPY.newMac2)} />{code(INSTALL_COMMANDS.shell)}</li>
+                <li><Rich text={t(INSTALL_COPY.newMac3)} /></li>
+              </ol>
+            </Channel>
+            <Channel id="install-new-windows" title={t(INSTALL_COPY.newWinTitle)}>
+              <ol>
+                <li><Rich text={t(INSTALL_COPY.newWin1)} /></li>
+                <li><Rich text={t(INSTALL_COPY.newWin2)} />{code(INSTALL_COMMANDS.windows)}</li>
+                <li><Rich text={t(INSTALL_COPY.newWin3)} /></li>
+              </ol>
+            </Channel>
+            <p>
+              <Link href={`/${locale}/docs/first-time`} className="section-link">
+                {t(INSTALL_COPY.newNext)}
+                <Icon name="arrow-right" className="icon icon-flip" />
+              </Link>
+            </p>
+          </Block>
+
           <Block id="install-path" title={t(INSTALL_COPY.pathTitle)}>
             {p(INSTALL_COPY.pathPlaces)}
             <ul>
```

**File**: `web/app/styles/install-guide.css` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
 .install-guide ul { list-style: disc; }
 .install-guide ol { list-style: decimal; }
 .install-guide li { margin-block: var(--space-1); }
+.install-guide li > .code { margin-block: var(--space-3); }
 .install-guide ::marker { color: var(--muted); }
 .install-guide a:not(.btn) { color: var(--accent); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--accent) 40%, transparent); text-underline-offset: 0.2em; }
 .install-guide a:not(.btn):hover { text-decoration-color: var(--accent); }
```

**File**: `web/data/agent-docs.release-index.json` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 {
   "tag": "v0.10.2",
   "slugs": [
+    "first-time",
     "install",
     "guide",
     "auth",
```

**File**: `web/gt-catalog/en.json` (modified, +273/-0)
```diff
@@ -2299,6 +2299,279 @@
     ],
     "sourceNote": "Source documents: docs/public-surface-facts.json (trust), docs/TELEMETRY.md, docs/SANDBOX.md · Update docs-map.ts when changing."
   },
+  "docs-first-time": {
+    "metaTitle": "Use Codewhale for the first time · Codewhale Docs",
+    "metaDescription": "Open a terminal, install Codewhale, pick the folder it works in, connect a model and finish a first task, with no terminal experience needed.",
+    "bodyClassName": "text-ink-soft leading-relaxed",
+    "title": "Use Codewhale for the first time",
+    "lede": "This page takes you from opening a terminal for the first time to finishing a small task with Codewhale. It also explains which folder to start in, because that folder decides what Codewhale can change.",
+    "sections": [
+      {
+        "id": "what-you-need",
+        "title": "Check what you need",
+        "blocks": [
+          {
+            "p": "You need a Mac, a Windows x64 PC or a Linux computer, and an internet connection for the install. To get answers you also need a model: an API key from a hosted provider such as DeepSeek, or a model running on your own computer with Ollama."
+          },
+          {
+            "p": "Codewhale is free and needs no account. A hosted provider bills you directly for what you use, and a model you run yourself needs no key."
+          }
+        ]
+      },
+      {
+        "id": "open-terminal",
+        "title": "Open a terminal",
+        "blocks": [
+          {
+            "p": "A terminal is a window where you type commands instead of clicking. A command runs when you press Return, which is Enter on Windows."
+          },
+          {
+            "rows": [
+              [
+                "macOS",
+                "Press Cmd+Space, type Terminal and press Return."
+              ],
+              [
+                "Windows",
+                "Open the Start menu, type PowerShell and press Enter."
+              ],
+              [
+                "Linux",
+                "Open your applications menu and search for Terminal. On Ubuntu, Ctrl+Alt+T opens one."
+              ]
+            ]
+          },
+          {
+            "note": "Paste with Cmd+V on a Mac and Ctrl+V on Windows. Most Linux terminals paste with Ctrl+Shift+V."
+          }
+        ]
+      },
+      {
+        "id": "install",
+        "title": "Install Codewhale",
+        "blocks": [
+          {
+            "p": "On a Mac or Linux, paste this command and press Return. It downloads Codewhale, checks the download, and adds Codewhale to your PATH, the list of folders your terminal searches for commands."
+          },
+          {
+            "code": "curl -fsSL https://codewhale.net/install.sh | sh",
+            "lang": "macOS · Linux"
+          },
+          {
+            "p": "On Windows, paste this command and press Enter:"
+          },
+          {
+            "code": "winget install --id HunterBown.CodeWhale --exact --source winget",
+            "lang": "Windows"
+          },
+          {
+            "p": "When it finishes, open a new terminal window so it picks up the new PATH. Then check that it worked: a version number means Codewhale is installed."
+          },
+          {
+            "code": "codewhale --version",
+            "lang": "Terminal"
+          },
+          {
+            "p": "If the terminal says `command not found`, follow [the PATH steps on the install page](/install#install-path)."
+          }
+        ]
+      },
+      {
+        "id": "choose-folder",
+        "title": "Choose the folder to work in",
+        "blocks": [
+          {
+            "p": "Codewhale works in the folder your terminal is in when you start it. That folder is its workspace: Codewhale reads and changes files there, and its file tools cannot reach other folders unless you allow it."
+          },
+          {
+            "p": "On a Mac, an operating-system sandbox also stops its commands from writing outside the workspace, apart from temporary files. Linux gets the same sandbox when bubblewrap is installed. Windows has no such sandbox yet, so Codewhale relies on asking you first."
+          },
+          {
+            "rows": [
+              [
+                "A folder for one project",
+                "The best choice for most work. Codewhale sees only that project, and `/undo` can take back what it changed."
+              ],
+              [
+                "A new, empty folder",
+                "A good start for something new, such as a website or a script. The next section shows how to make one."
+              ],
+              [
+                "A folder that holds several projects",
+                "Lets one task read and change files across all of them. Pick the smallest folder that holds everything the task needs; in a very large folder Codewhale turns snapshots off and tells you."
+              ],
+              [
+                "Your home folder, Desktop, Documents or
```

**File**: `web/gt-catalog/zh.json` (modified, +273/-0)
```diff
@@ -2296,6 +2296,279 @@
     ],
     "sourceNote": "来源文档：docs/public-surface-facts.json（trust）、docs/TELEMETRY.md、docs/SANDBOX.md · 修改时同步更新 docs-map.ts。"
   },
+  "docs-first-time": {
+    "metaTitle": "第一次使用 Codewhale · Codewhale 文档",
+    "metaDescription": "打开终端、安装 Codewhale、选择它工作的文件夹、连接模型并完成第一个任务，不需要任何终端经验。",
+    "bodyClassName": "text-ink-soft leading-[1.9] tracking-wide",
+    "title": "第一次使用 Codewhale",
+    "lede": "这一页带你从第一次打开终端开始，一直到用 Codewhale 完成一个小任务。它还会说明应该从哪个文件夹启动，因为这个文件夹决定了 Codewhale 能修改什么。",
+    "sections": [
+      {
+        "id": "what-you-need",
+        "title": "确认你需要准备什么",
+        "blocks": [
+          {
+            "p": "你需要一台 Mac、一台 Windows x64 电脑或一台 Linux 电脑，安装时还需要联网。要得到回答，你还需要一个模型：来自 DeepSeek 等托管提供商的 API 密钥，或者用 Ollama 在你自己电脑上运行的模型。"
+          },
+          {
+            "p": "Codewhale 免费，也不需要账号。托管提供商会按你的用量直接向你收费；你自己运行的模型不需要密钥。"
+          }
+        ]
+      },
+      {
+        "id": "open-terminal",
+        "title": "打开终端",
+        "blocks": [
+          {
+            "p": "终端是一个用输入命令代替点击的窗口。按下回车键后，命令就会运行。"
+          },
+          {
+            "rows": [
+              [
+                "macOS",
+                "按 Cmd+空格键，输入 Terminal，然后按回车键。"
+              ],
+              [
+                "Windows",
+                "打开“开始”菜单，输入 PowerShell，然后按回车键。"
+              ],
+              [
+                "Linux",
+                "打开应用程序菜单并搜索“终端”。在 Ubuntu 上，按 Ctrl+Alt+T 也能打开。"
+              ]
+            ]
+          },
+          {
+            "note": "在 Mac 上用 Cmd+V 粘贴，在 Windows 上用 Ctrl+V 粘贴。大多数 Linux 终端用 Ctrl+Shift+V 粘贴。"
+          }
+        ]
+      },
+      {
+        "id": "install",
+        "title": "安装 Codewhale",
+        "blocks": [
+          {
+            "p": "在 Mac 或 Linux 上，粘贴下面这条命令并按回车键。它会下载 Codewhale、校验下载内容，并把 Codewhale 加入 PATH，也就是终端查找命令时会搜索的文件夹列表。"
+          },
+          {
+            "code": "curl -fsSL https://codewhale.net/install.sh | sh",
+            "lang": "macOS · Linux"
+          },
+          {
+            "p": "在 Windows 上，粘贴下面这条命令并按回车键："
+          },
+          {
+            "code": "winget install --id HunterBown.CodeWhale --exact --source winget",
+            "lang": "Windows"
+          },
+          {
+            "p": "安装完成后，打开一个新的终端窗口，让它读取新的 PATH。然后确认安装成功：显示版本号就说明 Codewhale 已经安装好了。"
+          },
+          {
+            "code": "codewhale --version",
+            "lang": "终端"
+          },
+          {
+            "p": "如果终端提示 `command not found`，请按照[安装页面上的 PATH 步骤](/install#install-path)操作。"
+          }
+        ]
+      },
+      {
+        "id": "choose-folder",
+        "title": "选择工作的文件夹",
+        "blocks": [
+          {
+            "p": "Codewhale 在你启动它时终端所在的文件夹里工作。这个文件夹就是它的工作区：Codewhale 在这里读取和修改文件，除非你允许，它的文件工具无法访问其他文件夹。"
+          },
+          {
+            "p": "在 Mac 上，操作系统沙箱还会阻止它的命令写入工作区以外的位置（临时文件除外）。在 Linux 上，安装 bubblewrap 后也有同样的沙箱。Windows 目前还没有这种沙箱，因此 Codewhale 依靠先征求你的同意。"
+          },
+          {
+            "rows": [
+              [
+                "只放一个项目的文件夹",
+                "大多数情况下的最佳选择。Codewhale 只看到这个项目，`/undo` 可以撤回它做的修改。"
+              ],
+              [
+                "一个新的空文件夹",
+                "适合开始做新东西，比如一个网站或一个脚本。下一节会说明如何创建。"
+              ],
+              [
+                "包含多个项目的文件夹",
+                "让一个任务可以读取和修改所有这些项目里的文件。请选择能装下任务所需全部内容的最小文件夹；文件夹非常大时，Codewhale 会关闭快照并告诉你。"
+              ],
+              [
+                "你的主文件夹、桌面、文稿或下载",
+                "Codewhale 可以在这里运行，但在这些文件夹本身中 `/undo` 和快照是关闭的，因为它们范围太大，无法安全地做快照。它们里面的子文件夹可以正常使用。"
+              ]
+            ]
+          },
+          {
+            "note": "快照是 Codewhale 为它修改的文件保存的副本。它们保存在 Codewhale 的设置文件夹里，而不是你的项目里，并且不需要 git。"
+          },
+          {
+            "p": "要让 Codewhale 多访问一个文件夹，请在 Codewhale 中输入 `/trust add` 和该文件夹的路径。Full Access 模式可以访问所有文件夹，并且在没有沙箱的情况下运行命令，所以只有在你希望 Codewhale 在整台电脑范围内工作时才使用它。"
+          },
+          {
+            "p": "默认情况下，在 git 仓库中 Codewhale 会直接修改文件，并向你展示改了什么。在没有 git 的文件夹中，它会在每次修改前询问你。"
+          }
+        ]
+      },
+      {
+        "id": "open-in-folder",
+        "title": "在那个文件夹中打开终端",
+        "blocks": [
+          {
+            "rows": [
+              [
+                "macOS 访达",
+                "按住 Control 点按该文件夹，选择“服务”>“新建位于文件夹位置的终端窗口”。如果没有这一项，请在“系统设置”>“键盘”>“键盘快捷键”>“服务”>“文件和文件夹”中打开它。"
+              ],
+              [
+                "Windows 文件资源管理器",
+                "右键点击该文件夹，选择“在终端中打开”。在 Windows 10 上，按住 Shift 再右键点击，选择“在此处打开 PowerShell 窗口”。"
+              ],
+              [
+                "任意终端",
+                "输入 `cd` 和一个空格，把文件夹从访达或文件资源管理器拖进窗口，然后按回车键。"
+              ],
+              [
+                "不切换文件夹",
+                "启动 Codewhale 时加上 `-C` 和文件夹路径，例如在 Mac 上输入 `codewhale -C ~/Projects/my-site`。"
+              ]
+            ]
+          },
+          {
+            "p": "下面这些命令可以在终端里切换和查看文件夹。它们在 Mac、Linux 和 PowerShell 中都能用。"
+          },
+          {
+            "codeTerms": true,
+            "rows": [
+            
```

---

### Incident Patch 3: `622a4930` (2026-11-13)
**Commit Message**: feat(tui-kit): animated data displays an agent can send as JSON (CW-8202)

The vendored terminal kit could move things (MotionStep, MotionPolicy) but
had nothing that shows numbers. This adds three displays and a data
description of them:

- DataSparkline: one row, newest values on the right, with now/min/max in
  words. DataBars: a titled list of bars in eighth-cell steps that grow
  with a stagger and glide from previous values. DataTrend: a braille line
  chart with its range on the axis; it draws in from the left with a
  body-ink pen and falls back to a sparkline when too small.
- Every value is in the words, so colour and ink never carry a fact alone,
  and ASCII and NoColor profiles keep the rules. Draw-in reads a caller
  progress from the new MotionStep::drawn, so reduced and still motion
  paint the end state and the kit still never reads a clock.
- DataDisplay is the same vocabulary as serde JSON, borrowing the UI SDK
  idea (vercel-labs/ui) that a component says what it is and holds as data
  so an agent reads and writes facts, not pixels. from_json validates at
  the trust boundary (finite numbers, <=1024 points, <=24 bars, labels
  <=120 chars, trend rows 3..=16); des

**File**: `vendor/codewhale-ratatui/CHANGELOG.md` (modified, +10/-0)
```diff
@@ -2,6 +2,16 @@
 
 ## Unreleased — 0.2.0
 
+- Add data displays: `DataSparkline`, `DataBars` and `DataTrend` (a braille
+  line chart). The words carry every value; the ink draws in from a caller
+  progress (`MotionStep::drawn`) and is at its end state under reduced or
+  still motion. Bars glide from their previous values.
+- Add `DataDisplay`, the same displays as JSON an agent can send:
+  `DataDisplay::from_json` validates it (finite numbers, at most 1024 points
+  or 24 bars, labels up to 120 characters), `describe` says the same facts as
+  plain text, and `DATA_DISPLAY_SCHEMA` is its tool schema. Try
+  `cargo run --example data`.
+
 - Reexport the shared avatar contract from Codewhale Protocol. Rendering and
   artwork stay in this library. Protocol 0.10.3 registry proof must precede
   this package publication.
```

**File**: `vendor/codewhale-ratatui/COMPONENTS.md` (modified, +1/-0)
```diff
@@ -57,6 +57,7 @@ Gallery names are the exact names accepted by the gallery example; the
 | Engine `agent_roster.rs::render_agent_roster`, `widgets/workflow_panel.rs::row_receipt_text`, `gate_receipts.rs`; GPUI `usage.rs::TurnRow`, `workbar.rs::Readout`, `working_context.rs::ExecutionReceipt` | `Receipt`, `ReceiptTable`, `ReceiptValue`, `Cost`, formatting helpers | Primitive/composite | `receipt-row`, `receipt-table`, `receipt-table-compact`, `receipt-table-minimal`, `receipt-table-clipped` |
 | Engine `diff_render.rs::BoundedDiffRender`, `render_diff_bounded`, `history/file_mutation.rs`; GPUI `review.rs::DiffRowKind`, `workspace/render/review.rs::ReviewRows` | `Diff`, `DiffLine`, `DiffKind`, `DiffGutter`, `DiffHighlight`, `parse_unified` | Primitive | `diff`, `diff-wrapped`, `diff-no-numbers`, `diff-highlighted`, `review-scene` |
 | Engine `widgets/workflow_panel.rs::WorkflowPanel`, `WorkflowPanelRow`, `history/checklist.rs`; GPUI `plans.rs`, `workspace/render/workers.rs` | `WorkflowTree`, `TreeNode`, `TreeState`, `CountBar` | Primitive/composite | `workflow-tree`, `workflow-tree-selected`, `workflow-tree-clipped`, `workflow-tree-long`, `count-bars` |
+| Kit-native; data from the host or an agent's JSON (CW-8202) | `DataSparkline`, `DataBars`, `DataBarItem`, `DataTrend`, `DataDisplay`, `DataDisplayView`, `DataWords`, `DATA_DISPLAY_SCHEMA`, `MotionStep::drawn` | Primitive | `data-sparkline`, `data-bars`, `data-bars-growing`, `data-trend`, `data-trend-drawing`, `data-from-agent` |
 | Engine `approval/view.rs::ApprovalView`, `approval/elevation.rs::ElevationView`, `auto_review.rs`; GPUI `workspace/render/conversation.rs::Workspace::render_attention`, `workspace/render/review.rs::Workspace::render_restore_confirmation` | `ApprovalCard`, `ApprovalSubject`, `ApprovalState`, `ApprovalChoice`, `ApprovalPaint`, `DecisionBand`, `DecisionBandPlan`, `DecisionBandAction`, `DecisionBandSave`, `ReviewVerdict`, `ReviewAggregate` | Composite | `approval-command`, `approval-outside`, `approval-patch`, `approval-elevation`, `approval-clipped`, `approval-spoofed`, `approval-native-band`, `approval-native-band-collapsed`, `review-verdicts`, `review-aggregate` |
 | GPUI `workspace/render/conversation.rs::Workspace::render_attention`, `workspace/render/files.rs::Workspace::render_artifact_column` | `AttentionQueue`, `AttentionItem`, `ArtifactShelf`, `Artifact` | Composite | `attention-queue`, `attention-focused`, `attention-narrow`, `attention-empty`, `artifact`, `artifact-shelf`, `artifact-narrow`, `artifact-unknown`, `artifact-empty` |
 | Engine `views/mod.rs::ConfigView`, `ConfigRow`, `ConfigView::render_setting_detail`; GPUI `settings.rs::Spec`, `Applies`, `workspace/settings/mod.rs::Settings` | `SettingRow`, `SettingDetail`, `SettingWords` | Composite | `setting-row`, `setting-detail` |
```

**File**: `vendor/codewhale-ratatui/examples/data.rs` (added, +276/-0)
```diff
@@ -0,0 +1,276 @@
+//! Live data displays: `cargo run --example data`.
+//!
+//! A sparkline takes a new value every 400 ms, the trend draws in, and the
+//! bars glide to new values every three seconds. r replays, m switches
+//! between full and reduced motion, q or Escape exits.
+//!
+//! `--json FILE` shows one agent-sent [`DataDisplay`] instead.
+//! `--text` prints the final frame and each display's plain description.
+//! `--svg DIR` writes frames at fixed draw-in points.
+
+use std::{
+    io,
+    path::PathBuf,
+    time::{Duration, Instant},
+};
+
+use codewhale_ratatui::{
+    DataBarItem, DataDisplay, DataWords, MotionEasing, MotionMode, MotionPolicy, MotionStep,
+    MotionTiming, Paint, Role, Theme,
+    testing::{self, Profile},
+};
+use crossterm::{
+    event::{self, Event, KeyCode, KeyEventKind},
+    execute,
+    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
+};
+use ratatui::{Terminal, backend::CrosstermBackend, buffer::Buffer, layout::Rect};
+
+const TICK: Duration = Duration::from_millis(400);
+const RESHUFFLE: Duration = Duration::from_secs(3);
+const DRAW_IN: MotionTiming =
+    MotionTiming::space(Duration::from_millis(1_400), MotionEasing::EaseOut);
+const GLIDE: MotionTiming = MotionTiming::PANEL;
+
+struct Noise(u64);
+
+impl Noise {
+    fn next(&mut self) -> f64 {
+        self.0 = self
+            .0
+            .wrapping_mul(6_364_136_223_846_793_005)
+            .wrapping_add(1);
+        (self.0 >> 33) as f64 / f64::from(1u32 << 31)
+    }
+}
+
+struct Board {
+    noise: Noise,
+    requests: Vec<f64>,
+    latency: Vec<f64>,
+    bars: DataDisplay,
+    bars_before: DataDisplay,
+    draw: MotionStep,
+    glide: MotionStep,
+    agent: Option<DataDisplay>,
+}
+
+fn crate_bars(noise: &mut Noise) -> DataDisplay {
+    DataDisplay::Bars {
+        label: "Tests by crate".into(),
+        unit: "tests".into(),
+        items: ["engine", "tui", "runtime", "protocol", "config"]
+            .into_iter()
+            .map(|name| DataBarItem::new(name, (40.0 + noise.next() * 400.0).round()))
+            .collect(),
+    }
+}
+
+impl Board {
+    fn new(agent: Option<DataDisplay>) -> Self {
+        let mut noise = Noise(7);
+        let latency = (0..96)
+            .map(|i| 80.0 + 45.0 * (f64::from(i) / 9.0).sin() + noise.next() * 30.0)
+            .collect();
+        let requests = (0..40).map(|_| 20.0 + noise.next() * 60.0).collect();
+        let bars = crate_bars(&mut noise);
+        Self {
+            noise,
+            requests,
+            latency,
+            bars_before: DataDisplay::Bars {
+                label: String::new(),
+                unit: String::new(),
+                items: Vec::new(),
+            },
+            bars,
+            draw: MotionStep::at_rest(0.0),
+            glide: MotionStep::at_rest(1.0),
+            agent,
+        }
+    }
+
+    fn replay(&mut self, now: Instant, policy: MotionPolicy) {
+        self.draw = MotionStep::at_rest(0.0);
+        self.draw.go(1.0, now, DRAW_IN, policy);
+    }
+
+    fn tick(&mut self) {
+        let last = self.requests.last().copied().unwrap_or(50.0);
+        let next = (last + (self.noise.next() - 0.5) * 30.0).clamp(5.0, 120.0);
+        self.requests.push(next.round());
+        if self.requests.len() > 200 {
+            self.requests.remove(0);
+        }
+    }
+
+    fn reshuffle(&mut self, now: Instant, policy: MotionPolicy) {
+        self.bars_before = std::mem::replace(&mut self.bars, crate_bars(&mut self.noise));
+        self.glide = MotionStep::at_rest(0.0);
+        self.glide.go(1.0, now, GLIDE, policy);
+    }
+
+    fn paint(&self, area: Rect, buf: &mut Buffer, theme: &Theme, draw: f32, glide: f32) {
+        buf.set_style(area, theme.bg(Role::Background));
+        let inner = Rect::new(
+            area.x + 2,
+            area.y + 1,
+            area.width.saturating_sub(4),
+            area.height.saturating_sub(2),
+        );
+        if let Some(agent) = &self.agent {
+            agent.view().drawn(draw).paint(inner, buf, theme);
+            return;
+        }
+        let row =
+            |y: u16, h: u16| Rect::new(inner.x, inner.y + y, inner.width, h).intersection(inner);
+        let requests = DataDisplay::Sparkline {
+            label: "Requests".into(),
+            unit: "rpm".into(),
+            values: self.requests.clone(),
+        };
+        let latency = DataDisplay::Trend {
+            label: "Latency".into(),
+            unit: "ms".into(),
+            values: self.latency.clone(),
+            rows: Some(9),
+        };
+        requests.view().drawn(draw).paint(row(0, 1), buf, theme);
+        latency.view().drawn(draw).paint(row(2, 9), buf, theme);
+        self.bars
+            .view()
+            .from(&self.bars_before)
+            .drawn(glide.min(draw))
+            .paint(row(12, 6), buf, theme);
+    }
+
+    fn displays(&self) -> Vec<DataDisplay> {
+        if let Some(agent)
```

**File**: `vendor/codewhale-ratatui/src/components/chart.rs` (added, +1261/-0)
```diff
@@ -0,0 +1,1261 @@
+//! Data displays: numbers the host or an agent reports, drawn as a
+//! sparkline, a bar list or a trend.
+//!
+//! - The words carry every fact (`now 42  min 3  max 57`); the ink is a
+//!   picture of the same numbers and never the only place a value appears.
+//! - Each display takes `drawn`, a caller-clock progress in `0..=1` from
+//!   [`crate::MotionStep::drawn`]. Under reduced or still motion that is the
+//!   end state, so nothing moves and every value is shown.
+//! - [`DataDisplay`] is the same vocabulary as data: an agent sends JSON,
+//!   the host validates it with [`DataDisplay::from_json`] and paints it with
+//!   [`DataDisplay::view`]. [`DataDisplay::describe`] says the same facts as
+//!   plain text for a transcript, a screen reader or the model's own context.
+
+use std::borrow::Cow;
+use std::fmt;
+
+use ratatui::{
+    buffer::Buffer,
+    layout::Rect,
+    style::{Modifier, Style},
+    text::{Line, Span},
+    widgets::Widget,
+};
+use serde::{Deserialize, Serialize};
+
+use crate::{Paint, Role, Theme, glyphs, text};
+
+/// The most points a [`DataDisplay`] sparkline or trend may carry.
+pub const DATA_MAX_POINTS: usize = 1024;
+/// The most rows a [`DataDisplay`] bar list may carry.
+pub const DATA_MAX_BARS: usize = 24;
+/// The longest label or unit, in characters.
+pub const DATA_MAX_LABEL: usize = 120;
+/// The rows a trend may ask for.
+pub const DATA_TREND_ROWS: std::ops::RangeInclusive<u16> = 3..=16;
+
+const SPARK: [&str; 8] = [
+    "\u{2581}", "\u{2582}", "\u{2583}", "\u{2584}", "\u{2585}", "\u{2586}", "\u{2587}", "\u{2588}",
+];
+const SPARK_ASCII: [&str; 8] = ["_", "_", ".", "-", "-", "=", "#", "#"];
+const EIGHTHS: [&str; 8] = [
+    "", "\u{258F}", "\u{258E}", "\u{258D}", "\u{258C}", "\u{258B}", "\u{258A}", "\u{2589}",
+];
+const FULL: &str = "\u{2588}";
+const MIN_SPARK: usize = 4;
+const MAX_SPARK: usize = 64;
+const MIN_BAR: usize = 4;
+const BAR_STAGGER: f32 = 0.35;
+
+/// Words the data displays print. `Default` is English.
+#[derive(Clone, Debug, PartialEq, Eq)]
+pub struct DataWords {
+    pub now: Cow<'static, str>,
+    pub min: Cow<'static, str>,
+    pub max: Cow<'static, str>,
+    /// Shown when there are no values yet.
+    pub empty: Cow<'static, str>,
+    /// `24 points` in [`DataDisplay::describe`].
+    pub points: Cow<'static, str>,
+}
+
+impl Default for DataWords {
+    fn default() -> Self {
+        Self {
+            now: Cow::Borrowed("now"),
+            min: Cow::Borrowed("min"),
+            max: Cow::Borrowed("max"),
+            empty: Cow::Borrowed("no data yet"),
+            points: Cow::Borrowed("points"),
+        }
+    }
+}
+
+/// A short form of `value`: `42`, `3.14`, `12.4k`, `1.2M`.
+#[must_use]
+pub fn data_number(value: f64) -> String {
+    if !value.is_finite() {
+        return "?".to_owned();
+    }
+    if value == 0.0 {
+        return "0".to_owned();
+    }
+    let a = value.abs();
+    let (scaled, suffix) = if a >= 1e9 {
+        (value / 1e9, "B")
+    } else if a >= 1e6 {
+        (value / 1e6, "M")
+    } else if a >= 1e4 {
+        (value / 1e3, "k")
+    } else {
+        (value, "")
+    };
+    let s = if scaled.abs() >= 100.0 {
+        format!("{scaled:.0}")
+    } else if scaled.abs() >= 10.0 {
+        format!("{scaled:.1}")
+    } else {
+        format!("{scaled:.2}")
+    };
+    let s = if s.contains('.') {
+        s.trim_end_matches('0').trim_end_matches('.').to_owned()
+    } else {
+        s
+    };
+    format!("{s}{suffix}")
+}
+
+fn with_unit(value: f64, unit: &str) -> String {
+    let n = data_number(value);
+    let unit = text::display_safe(unit);
+    match unit.as_ref() {
+        "" => n,
+        "%" => format!("{n}%"),
+        u => format!("{n} {u}"),
+    }
+}
+
+fn unit_f(v: f32) -> f32 {
+    if v.is_nan() { 1.0 } else { v.clamp(0.0, 1.0) }
+}
+
+fn bounds(values: &[f64]) -> Option<(f64, f64)> {
+    let mut it = values.iter().copied().filter(|v| v.is_finite());
+    let first = it.next()?;
+    Some(it.fold((first, first), |(lo, hi), v| (lo.min(v), hi.max(v))))
+}
+
+fn level(v: f64, lo: f64, hi: f64, steps: usize) -> usize {
+    if !v.is_finite() || steps == 0 {
+        return 0;
+    }
+    if hi <= lo {
+        return steps / 2;
+    }
+    let t = ((v - lo) / (hi - lo)).clamp(0.0, 1.0);
+    ((t * (steps - 1) as f64).round() as usize).min(steps - 1)
+}
+
+struct Stats {
+    full: Vec<Span<'static>>,
+    short: Vec<Span<'static>>,
+    full_w: usize,
+    short_w: usize,
+}
+
+fn stats(values: &[f64], unit: &str, words: &DataWords, theme: &Theme) -> Option<Stats> {
+    let (lo, hi) = bounds(values)?;
+    let last = values.iter().rev().copied().find(|v| v.is_finite())?;
+    let muted = theme.fg(Role::Muted);
+    let ink = theme.fg(Role::Foreground);
+    let pair = |word: &str, v: f64| {
+        [
+            Span::styled(format!("{} ", text::display_safe(word)), muted),
+            Span::styled(with_unit(v, unit), ink),
+        ]
+    };
+  
```

**File**: `vendor/codewhale-ratatui/src/components/mod.rs` (modified, +2/-0)
```diff
@@ -59,10 +59,12 @@ pub use tabs::*;
 pub use toggle::*;
 
 // Package Display.
+mod chart;
 mod diff;
 mod progress;
 mod receipt;
 mod tree;
+pub use chart::*;
 pub use diff::*;
 pub use progress::*;
 pub use receipt::*;
```

**File**: `vendor/codewhale-ratatui/src/components/motion.rs` (modified, +8/-0)
```diff
@@ -366,6 +366,14 @@ impl MotionStep {
         }
     }
 
+    /// Progress for a draw-in, in `0..=1`: eased where `policy` lets space
+    /// move, the target where it does not. Feed it to a data display's
+    /// `drawn`.
+    #[must_use]
+    pub fn drawn(&self, now: Instant, policy: MotionPolicy) -> f32 {
+        self.shown(now, policy, MotionChannel::Space)
+    }
+
     /// A column between `from` and `to`: slide a marker, nudge a panel.
     #[must_use]
     pub fn offset(&self, now: Instant, policy: MotionPolicy, from: u16, to: u16) -> u16 {
```

**File**: `vendor/codewhale-ratatui/src/components/snapshots/codewhale_ratatui__components__chart__tests__data-displays.snap` (added, +360/-0)
```diff
@@ -0,0 +1,360 @@
+---
+source: src/components/chart.rs
+assertion_line: 1242
+expression: "testing::snapshot(12, |area, buf, theme|\n{\n    let row = |y: u16, h: u16|\n    { Rect::new(area.x, area.y + y, area.width, h).intersection(area) };\n    DataSparkline::new(\"Requests\",\n    &values).unit(\"rpm\").paint(row(0, 1), buf, theme);\n    DataBars::new(\"Tokens by model\",\n    &items).unit(\"tokens\").paint(row(2, 5), buf, theme);\n    DataTrend::new(\"Latency\",\n    &values).unit(\"ms\").rows(5).paint(row(7, 5), buf, theme);\n})"
+---
+== dark-truecolor · 40x12
+Requests  ▁▃▅▄▅▆▇███▆▅▄▃▂▁  now 45.6 rpm
+
+Tokens by model
+opus    ██████████████████  12.4k tokens
+sonnet  ███████████▌        7900 tokens
+haiku   ████▌               3100 tokens
+cache                       0 tokens
+Latency  now 45.6 ms
+69.7 ms │  ⡠⠒⠑⠒⠒⠢⣀             ⡀⡠⠔⠉⠉⢢⡀
+        │⢀⠔⠁      ⢇          ⢀⠔⠉     ⠈⠑⢄
+        │⠁         ⠑⠢⡀      ⡠⠊
+17.2 ms │            ⠈⠱⣀⣀⠤⠊⠊
+---
+r0 c0..8 fg=Foreground bg=Background bold
+r0 c8..10 bg=Background
+r0 c10..26 fg=Accent bg=Background
+r0 c26..28 bg=Background
+r0 c28..32 fg=Muted bg=Background
+r0 c32..40 fg=Foreground bg=Background
+r1 c0..40 bg=Background
+r2 c0..15 fg=Foreground bg=Background bold
+r2 c15..40 bg=Background
+r3 c0..6 fg=Foreground bg=Background
+r3 c6..8 bg=Background
+r3 c8..26 fg=Accent bg=Background
+r3 c26..28 bg=Background
+r3 c28..40 fg=Muted bg=Background
+r4 c0..6 fg=Foreground bg=Background
+r4 c6..8 bg=Background
+r4 c8..20 fg=Accent bg=Background
+r4 c20..28 bg=Background
+r4 c28..39 fg=Muted bg=Background
+r4 c39..40 bg=Background
+r5 c0..6 fg=Foreground bg=Background
+r5 c6..8 bg=Background
+r5 c8..13 fg=Accent bg=Background
+r5 c13..28 bg=Background
+r5 c28..39 fg=Muted bg=Background
+r5 c39..40 bg=Background
+r6 c0..6 fg=Foreground bg=Background
+r6 c6..28 bg=Background
+r6 c28..36 fg=Muted bg=Background
+r6 c36..40 bg=Background
+r7 c0..7 fg=Foreground bg=Background bold
+r7 c7..9 bg=Background
+r7 c9..13 fg=Muted bg=Background
+r7 c13..20 fg=Foreground bg=Background
+r7 c20..40 bg=Background
+r8 c0..8 fg=Muted bg=Background
+r8 c8..9 fg=Dim bg=Background
+r8 c9..11 bg=Background
+r8 c11..18 fg=Accent bg=Background
+r8 c18..31 bg=Background
+r8 c31..38 fg=Accent bg=Background
+r8 c38..40 bg=Background
+r9 c0..8 fg=Muted bg=Background
+r9 c8..9 fg=Dim bg=Background
+r9 c9..12 fg=Accent bg=Background
+r9 c12..18 bg=Background
+r9 c18..19 fg=Accent bg=Background
+r9 c19..29 bg=Background
+r9 c29..32 fg=Accent bg=Background
+r9 c32..37 bg=Background
+r9 c37..40 fg=Accent bg=Background
+r10 c0..8 fg=Muted bg=Background
+r10 c8..9 fg=Dim bg=Background
+r10 c9..10 fg=Accent bg=Background
+r10 c10..19 bg=Background
+r10 c19..22 fg=Accent bg=Background
+r10 c22..28 bg=Background
+r10 c28..30 fg=Accent bg=Background
+r10 c30..40 bg=Background
+r11 c0..8 fg=Muted bg=Background
+r11 c8..9 fg=Dim bg=Background
+r11 c9..21 bg=Background
+r11 c21..28 fg=Accent bg=Background
+r11 c28..40 bg=Background
+
+== dark-truecolor · 80x12
+Requests  ▂▁▁▁▁▁▂▂▂▃▃▄▅▆▆▆▇▇████▇▇▆▆▅▅  now 45.6 rpm  min 17.2 rpm  max 69.7 rpm
+
+Tokens by model
+opus    ██████████████████████████████████████████████████████████  12.4k tokens
+sonnet  █████████████████████████████████████                       7900 tokens
+haiku   ██████████████▌                                             3100 tokens
+cache                                                               0 tokens
+Latency  now 45.6 ms  min 17.2 ms  max 69.7 ms
+69.7 ms │     ⣀⠤⠒⠊⠑⠒⠒⠒⠒⠒⠒⠢⠤⢄⣀                               ⣀ ⣀⡠⠤⠒⠒⠉⠉⠉⠉⠢⢄⣀⣀
+        │ ⣀⠤⠒⠉               ⠑⠤⣀                        ⢀⡠⠒⠉ ⠉             ⠉⠑⠒⠤⣀
+        │⠉                      ⠉⠑⠒⠤⢄⣀               ⡠⠔⠊⠁
+17.2 ms │                             ⠉⠑⢄⣀⣀⣀⣀⣀⠤⠤⠒⠊⠒⠊⠉
+---
+r0 c0..8 fg=Foreground bg=Background bold
+r0 c8..10 bg=Background
+r0 c10..38 fg=Accent bg=Background
+r0 c38..40 bg=Background
+r0 c40..44 fg=Muted bg=Background
+r0 c44..52 fg=Foreground bg=Background
+r0 c52..54 bg=Background
+r0 c54..58 fg=Muted bg=Background
+r0 c58..66 fg=Foreground bg=Background
+r0 c66..68 bg=Background
+r0 c68..72 fg=Muted bg=Background
+r0 c72..80 fg=Foreground bg=Background
+r1 c0..80 bg=Background
+r2 c0..15 fg=Foreground bg=Background bold
+r2 c15..80 bg=Background
+r3 c0..6 fg=Foreground bg=Background
+r3 c6..8 bg=Background
+r3 c8..66 fg=Accent bg=Background
+r3 c66..68 bg=Background
+r3 c68..80 fg=Muted bg=Background
+r4 c0..6 fg=Foreground bg=Background
+r4 c6..8 bg=Background
+r4 c8..45 fg=Accent bg=Background
+r4 c45..68 bg=Background
+r4 c68..79 fg=Muted bg=Background
+r4 c79..80 bg=Background
+r5 c0..6 fg=Foreground bg=Background
+r5 c6..8 bg=Background
+r5 c8..23 fg=Accent bg=Background
+r5 c23..68 bg=Background
+r5 c68..79 fg=Muted bg=Background
+r5 c79..80 bg=Background
+r6 c0..6 fg=Foreground bg=Background
+r6 c6..68 bg=Background
+r6 c68..76 fg=Muted bg=Background
+r6 c76..80 bg=Background
+r7 c0..7 fg=Foreground bg=Background bold
+r7 c7..9 bg=Background
+r7 c9..
```

**File**: `vendor/codewhale-ratatui/src/gallery/chart.rs` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+//! Gallery: data displays fully drawn, mid draw-in, empty and from agent JSON.
+
+use ratatui::{buffer::Buffer, layout::Rect};
+
+use super::Entry;
+use crate::{DataBarItem, DataBars, DataDisplay, DataSparkline, DataTrend, Paint, Theme};
+
+fn series() -> Vec<f64> {
+    (0..64)
+        .map(|i| 120.0 + 60.0 * (f64::from(i) / 6.0).sin() + f64::from((i * 7) % 11) * 3.0)
+        .collect()
+}
+
+fn items() -> Vec<DataBarItem> {
+    vec![
+        DataBarItem::new("engine", 412.0),
+        DataBarItem::new("tui", 268.0),
+        DataBarItem::new("runtime", 131.0),
+        DataBarItem::new("protocol", 44.0),
+    ]
+}
+
+fn row(area: Rect, y: u16, h: u16) -> Rect {
+    Rect::new(area.x, area.y.saturating_add(y), area.width, h).intersection(area)
+}
+
+fn sparklines(area: Rect, buf: &mut Buffer, theme: &Theme) {
+    let values = series();
+    DataSparkline::new("Requests", &values)
+        .unit("rpm")
+        .paint(row(area, 0, 1), buf, theme);
+    DataSparkline::new("Requests", &values)
+        .unit("rpm")
+        .drawn(0.45)
+        .paint(row(area, 1, 1), buf, theme);
+    DataSparkline::new("Requests", &[]).paint(row(area, 2, 1), buf, theme);
+}
+
+fn bars(area: Rect, buf: &mut Buffer, theme: &Theme) {
+    let items = items();
+    DataBars::new("Tests by crate", &items).paint(row(area, 0, 5), buf, theme);
+}
+
+fn bars_growing(area: Rect, buf: &mut Buffer, theme: &Theme) {
+    let items = items();
+    DataBars::new("Tests by crate", &items)
+        .previous(&[300.0, 300.0, 300.0, 300.0])
+        .drawn(0.5)
+        .paint(row(area, 0, 5), buf, theme);
+}
+
+fn trend(area: Rect, buf: &mut Buffer, theme: &Theme) {
+    let values = series();
+    DataTrend::new("Latency", &values)
+        .unit("ms")
+        .rows(7)
+        .paint(area, buf, theme);
+}
+
+fn trend_drawing(area: Rect, buf: &mut Buffer, theme: &Theme) {
+    let values = series();
+    DataTrend::new("Latency", &values)
+        .unit("ms")
+        .rows(7)
+        .drawn(0.6)
+        .paint(area, buf, theme);
+}
+
+fn from_agent(area: Rect, buf: &mut Buffer, theme: &Theme) {
+    let shown = DataDisplay::from_json(
+        r#"{"kind":"bars","label":"Tokens this turn","unit":"tokens",
+            "items":[{"label":"read","value":18200},{"label":"wrote","value":2400},
+                     {"label":"cached","value":61000}]}"#,
+    )
+    .expect("gallery fixture is a valid data display");
+    shown.view().paint(area, buf, theme);
+}
+
+pub(crate) fn entries() -> Vec<Entry> {
+    vec![
+        Entry {
+            name: "data-sparkline",
+            width: 80,
+            height: 3,
+            draw: sparklines,
+        },
+        Entry {
+            name: "data-bars",
+            width: 60,
+            height: 5,
+            draw: bars,
+        },
+        Entry {
+            name: "data-bars-growing",
+            width: 60,
+            height: 5,
+            draw: bars_growing,
+        },
+        Entry {
+            name: "data-trend",
+            width: 72,
+            height: 7,
+            draw: trend,
+        },
+        Entry {
+            name: "data-trend-drawing",
+            width: 72,
+            height: 7,
+            draw: trend_drawing,
+        },
+        Entry {
+            name: "data-from-agent",
+            width: 60,
+            height: 4,
+            draw: from_agent,
+        },
+    ]
+}
```

#### Recent Merged Pull Requests:
- **PR #7323** (closed): fix(app-server): read the original path of a worktree-side rename (@SparkofSpike)
- **PR #7322** (2026-11-12): fix(tui): count characters, not bytes, for the session title limit (@luochen211)
- **PR #7319** (2026-11-12): fix(mcp,lsp): answer server requests instead of taking them as replies (@luochen211)
- **PR #7317** (2026-11-12): fix: show non-ASCII paths as written in /diff and git mentions (@luochen211)
- **PR #7316** (2026-11-12): fix(state,snapshot): keep index entries after a torn line and clamp prune age (@luochen211)
- **PR #7315** (2026-11-12): fix(config): read every env alias chain through env_non_blank (@luochen211)

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

## X. state,snapshot): keep index entries after a torn line and clamp prune age (#7316

**RULE**:
When implementing operations in `crates/snapshot/src/repo.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3f2a0194`: state,snapshot): keep index entries after a torn line and clamp prune age (#7316). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/snapshot/src/repo.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        let cutoff = now.saturating_sub(i64::try_from(max_age.as_secs()).unwrap_or(i64::MAX));
    #[test]
    fn prune_with_an_age_beyond_i64_keeps_every_snapshot() {
        let tmp = tempdir().unwrap();
        let (repo, _home) = make_repo(tmp.path());
        std::fs::write(repo.work_tree().join("f.txt"), "v0").unwrap();
        repo.snapshot("turn:0").unwrap();
        std::thread::sleep(Duration::from_millis(1100));

        let removed = repo
            .prune_older_than(Duration::from_secs(u64::MAX))
            .unwrap();

        assert_eq!(removed, 0);
        assert_eq!(repo.list(10).unwrap().len(), 1);
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
        let cutoff = now - max_age.as_secs() as i64;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3f2a0194` are properly handled with clean fallback behavior.
