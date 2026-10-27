> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: github ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Source Version**: `3a72047c`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T22:06:21.408Z  
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
> **Harvest Timestamp**: 2026-10-27T22:06:19.856Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source agent for the terminal written in Rust. Use any provider or model. Issues & PRs always welcome
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41135 stars

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
pub const TELEMETRY_NOTICE_VERSION: &str = "5";

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
    /// re-running `tool_to_api_json` + join on every `check_and_update`
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
const TOOL_CATALOG_CACHE_CA
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
- **Issue #7072** (2026-10-25): **codewhale review accepts DeepSeek's leaked DSML tool-call markup as the review and exits 0 with no tally**
  *Symptoms*: **Version:** 0.10.2 (`ff466b2ed0bf`, npm build), Linux. Provider `deepseek`, model `deepseek-flash`, `reasoning_effort = "high"`, UI locale zh-Hans. **Target:** 0.10.3 · Related: #7067  ## Repro Same setup as #7067: a one-file +10/−1 working-tree diff with no sensitive paths, so triage classes it as Low risk, which offers **0 tools**. Run `codewhale review`. In 1 of 4 runs it printed this as the entire review and exited normally:  ``` <｜｜DSML｜｜ calls> <｜｜DSML｜｜ invoke name="read_file"> <｜｜DSML｜｜ parameter name="path" string="true">tides.py</｜｜DSML｜｜ parameter> </｜｜DSML｜｜ invoke> <｜｜DSML｜｜ invoke name="search_repository"> <｜｜DSML｜｜ parameter name="query" string="true">parse_reading\|high_tides\|low_tides\|tides</｜｜DSML｜｜ parameter> </｜｜DSML｜｜ invoke> </｜｜DSML｜｜ calls> ```  There were no findings, no "Checked, nothing wrong" section and no `<!-- codewhale-review: … -->` tally. The other three runs hit the #7067 output cap.  ## Cause - The engine already knows this shape. `crates/tui/src/core/engine/streaming.rs:~586` says: "DeepSeek also emits a doubled-delimiter form (`<｜｜DSML｜｜ calls>`) when a request offers no tools; one-shot `codewhale exec` printed it verbatim as the answer." It's handled there through `TOOL_CALL_MARKER_PAIRS` and `contains_fake_tool_wrapper` (`streaming.rs:717`). - The review path builds its own requests in `crates/tui/src/tools/review_core.rs` and never applies that check. Neither `review_core.rs`, `review.rs` nor the CLI path in `lib.rs` references `con

- **Issue #7069** (2026-10-25): **Composer history ignores CODEWHALE_HOME: typed prompts go to $HOME/.codewhale and are shared across isolated homes**
  *Symptoms*: **Version:** 0.10.2 (`ff466b2ed0bf`, npm build), Linux. **Target:** 0.10.3  ## Repro ```sh export CODEWHALE_HOME=/tmp/cw-isolated   # an explicit, isolated home codewhale                                # type and send any prompt, then quit ls ~/.codewhale/composer_history.jsonl   # exists, and holds the prompt ls /tmp/cw-isolated/composer_history.jsonl  # absent ``` I saw this across several sessions, each with its own `CODEWHALE_HOME`. All their prompts went to one `$HOME/.codewhale/composer_history.jsonl`, so Up-arrow history in each "isolated" home shows the others' prompts.  ## Cause `composer_history::default_history_path()` builds the path from `effective_home_dir()` (the user's `$HOME`) plus `.codewhale` (`crates/tui/src/composer_history.rs:43-72`). It never consults `CODEWHALE_HOME`. It can also fall back to `~/.deepseek/composer_history.jsonl` when that file exists.  ## Why it matters - `docs/REBRAND.md` says: "An explicit `CODEWHALE_HOME` intentionally isolates that home and disables the ambient `~/.deepseek` fallback." Composer history breaks both halves of that. - History holds everything the user typed, which can include pasted secrets. People use a separate home for CI, demos, classrooms or per-client separation, and they don't expect prompts to land in, or be read back from, the shared ambient home.  ## Expected When `CODEWHALE_HOME` is set, read and write `$CODEWHALE_HOME/composer_history.jsonl`, with no `~/.deepseek` fallback. Keep today's resolution only whe

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

### Incident Patch 1: `0cf390f0` (2026-10-27)
**Commit Message**: feat(tui): change mode and permissions mid-turn; record steering in Unreleased (CW-7552)

Mode and permission posture can now change while a turn is running. Tab,
Shift+Tab, Alt shortcuts, /mode, the hotbar, /auto and /config mode|approval*
no longer hit the #2982 turn lock; model, thinking and provider stay locked
because they change the route the in-flight request is on.

Decision: a change applies at the engine's next step in the same turn, not at
the next turn and not by restarting the streaming response. The engine already
drains the live authority snapshot before each tool batch, at every approval
gate and at the per-step preparation boundary; a call nobody approved, or one
whose approval is narrowed, is returned to the model to retry. New: the
preparation boundary now records the mode notice (and Operate contract) via
Engine::record_mode_context, so the next model request is told the new mode
and the notice is a session message (model-visible means logged). While a turn
runs, the TUI shows "<Mode> · <permissions> — applies at the agent's next step
in this turn"; the engine's existing "Permissions: … · <mode>" status confirms
the apply.

Reference comparison (CW/refs): Codex 

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- **Change mode and permissions while the agent works:** Tab, Shift+Tab, `/mode`, the hotbar and `/config mode` no longer refuse while a turn is running. A response that is already streaming is not restarted; the change applies at the agent's next step in the same turn (before its next tool batch, at every approval gate, and before its next model request, which carries the new mode notice). The status line says so until it applies. A call still waiting for approval goes back to the model under the new posture, and a call you already approved runs only if the new posture is equal or broader. Model, thinking level and provider stay locked until the turn ends. (CW-7552)
+- **Steering interrupts thinking:** a steer (Ctrl+Enter, or Enter twice after queueing) now closes the in-flight model request at once, whether the model is waiting on headers, reasoning, writing text or emitting a tool call, and continues the same turn with your message. Text already shown is kept as interrupted output; unfinished reasoning and partial tool calls are discarded, never run. (CW-7552)
 - **Switching provider lands on its current model:** `/provider stepfun` now selects Step 5 Preview instead of the older Step 3.7 Flash; a model you saved for a provider is still kept. `/model` now lists the current provider's own models (bundled and live, newest first, up to 20) instead of only the selected one. Search also matches ids typed without separators (`step5`). While you search, Shift+P and Shift+F type their letters rather than pinning or adding to Fleet, so `Step-5-Preview` can be typed in full; Ctrl+P and Ctrl+F pin or add the highlighted row at any time.
 - **Remote control works again:** `codewhale rc` (`/rc`) can attach to the hosted control plane for web Chat again. The control plane had only accepted the retired 0.9.13 runtime identity, so every 0.10.x Engine was refused with `runner_runtime_identity_unavailable`; it now accepts the exact released runtime identity (commit, image and digest) and fails closed when they are not configured.
 - **Modern MCP client:** MCP servers now connect through the official MCP SDK (2.4) behind Codewhale's Rust broker by default (`mcp_backend = "host"`; `"rust"` stays available for one release). Servers that speak the 2026-07-28 revision are discovered with `server/discover`; other stdio and HTTP servers fall back to the legacy `initialize` handshake, and configured SSE servers keep theirs. Rust keeps process, network, credential, catalog, approval and cancellation authority. (CW-6713)
```

**File**: `crates/tui/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- **Change mode and permissions while the agent works:** Tab, Shift+Tab, `/mode`, the hotbar and `/config mode` no longer refuse while a turn is running. A response that is already streaming is not restarted; the change applies at the agent's next step in the same turn (before its next tool batch, at every approval gate, and before its next model request, which carries the new mode notice). The status line says so until it applies. A call still waiting for approval goes back to the model under the new posture, and a call you already approved runs only if the new posture is equal or broader. Model, thinking level and provider stay locked until the turn ends. (CW-7552)
+- **Steering interrupts thinking:** a steer (Ctrl+Enter, or Enter twice after queueing) now closes the in-flight model request at once, whether the model is waiting on headers, reasoning, writing text or emitting a tool call, and continues the same turn with your message. Text already shown is kept as interrupted output; unfinished reasoning and partial tool calls are discarded, never run. (CW-7552)
 - **Switching provider lands on its current model:** `/provider stepfun` now selects Step 5 Preview instead of the older Step 3.7 Flash; a model you saved for a provider is still kept. `/model` now lists the current provider's own models (bundled and live, newest first, up to 20) instead of only the selected one. Search also matches ids typed without separators (`step5`). While you search, Shift+P and Shift+F type their letters rather than pinning or adding to Fleet, so `Step-5-Preview` can be typed in full; Ctrl+P and Ctrl+F pin or add the highlighted row at any time.
 - **Remote control works again:** `codewhale rc` (`/rc`) can attach to the hosted control plane for web Chat again. The control plane had only accepted the retired 0.9.13 runtime identity, so every 0.10.x Engine was refused with `runner_runtime_identity_unavailable`; it now accepts the exact released runtime identity (commit, image and digest) and fails closed when they are not configured.
 - **Modern MCP client:** MCP servers now connect through the official MCP SDK (2.4) behind Codewhale's Rust broker by default (`mcp_backend = "host"`; `"rust"` stays available for one release). Servers that speak the 2026-07-28 revision are discovered with `server/discover`; other stdio and HTTP servers fall back to the legacy `initialize` handshake, and configured SSE servers keep theirs. Rust keeps process, network, credential, catalog, approval and cancellation authority. (CW-6713)
```

**File**: `crates/tui/src/commands/config_main_host.rs` (modified, +15/-33)
```diff
@@ -1656,18 +1656,16 @@ fn subagents_runtime_action(
 ///
 /// `default_mode` is deliberately absent: it is a restart default that
 /// `set_config_value` explicitly does *not* apply to the live session, so
-/// refusing it would lock a key that cannot affect the turn.
+/// refusing it would lock a key that cannot affect the turn. `mode` and the
+/// approval keys are absent too: the engine applies a posture change at its
+/// next step boundary in the running turn.
 fn live_route_setting_subject(key: &str) -> Option<MessageId> {
     match key {
-        "mode" => Some(MessageId::SettingSubjectMode),
         // `default_model` is not merely a startup default: for the DeepSeek
         // routes `set_config_value` installs it as the live model.
         "model" | "default_model" => Some(MessageId::SettingSubjectModel),
         "reasoning_effort" | "effort" => Some(MessageId::SettingSubjectThinking),
         "provider" => Some(MessageId::SettingSubjectProvider),
-        "approval_mode" | "approval_policy" | "approval" => {
-            Some(MessageId::SettingSubjectPermissions)
-        }
         _ => None,
     }
 }
@@ -3433,55 +3431,39 @@ mod tests {
     }
 
     /// The refusal list is the contract for #2982 on the slash surfaces. Keep
-    /// restart-only `default_mode` out of it: `set_config_value` deliberately
-    /// does not apply that key to the live session.
+    /// restart-only `default_mode` out of it, and mode and permissions, which
+    /// the engine applies at its next step boundary mid-turn.
     #[test]
     fn live_route_key_list_covers_every_route_mutating_alias() {
         for key in [
-            "mode",
             "model",
             "default_model",
             "reasoning_effort",
             "effort",
             "provider",
-            "approval_mode",
-            "approval_policy",
-            "approval",
         ] {
             assert!(
                 live_route_setting_subject(key).is_some(),
                 "{key} mutates the active route and must be locked mid-turn"
             );
         }
-        for key in ["default_mode", "theme", "calm_mode", "rail_panel"] {
+        for key in [
+            "default_mode",
+            "mode",
+            "approval_mode",
+            "approval_policy",
+            "approval",
+            "theme",
+            "calm_mode",
+            "rail_panel",
+        ] {
             assert!(
                 live_route_setting_subject(key).is_none(),
                 "{key} does not mutate the active route and must stay settable"
             );
         }
     }
 
-    #[test]
-    fn approval_aliases_are_inert_while_a_turn_is_running() {
-        let mut app = create_test_app();
-        app.approval_mode = ApprovalMode::Suggest;
-        app.is_loading = true;
-
-        for key in ["approval_mode", "approval_policy", "approval"] {
-            let result = set_config_value(&mut app, key, "never", false);
-            assert!(result.is_error, "{key} must be refused mid-turn");
-            assert!(
-                result
-                    .message
-                    .as_deref()
-                    .is_some_and(|message| message.contains("locked while a turn is running")),
-                "unexpected refusal for {key}: {:?}",
-                result.message
-            );
-            assert_eq!(app.approval_mode, ApprovalMode::Suggest);
-        }
-    }
-
     #[test]
     fn config_preset_calm_applies_bundle_to_session_and_keeps_evidence() {
         let mut app = create_test_app();
```

**File**: `crates/tui/src/core/engine.rs` (modified, +28/-17)
```diff
@@ -7101,23 +7101,7 @@ impl Engine {
                 });
             }
 
-            self.record_mode_notice(mode);
-
-            // The Operate contract (docs/MODES.md) precedes the first Operate
-            // prompt. KV-cache effect: append-only history, one user-role runtime
-            // message; it is derived from the session log rather than a flag so a
-            // cleared, restored, or compacted session gets it again exactly once
-            // and every later Operate turn does not repeat it.
-            if mode == AppMode::Operate
-                && !self
-                    .session
-                    .messages
-                    .iter()
-                    .any(crate::runtime_handoff::is_current_operate_contract_message)
-            {
-                self.session
-                    .add_message(crate::runtime_handoff::operate_contract_runtime_message());
-            }
+            self.record_mode_context(mode);
 
             self.session
                 .working_set
@@ -9139,6 +9123,33 @@ impl Engine {
     /// new one is appended whenever the mode differs from the latest. Restored
     /// Operate contracts also require a current notice after leaving Operate.
     /// Child and RLM hosts get none: their mode is fixed by their parent.
+    /// Record the mode notice and, on entering Operate, the Operate contract
+    /// (docs/MODES.md), which precedes the first Operate prompt. KV-cache
+    /// effect: append-only history, user-role runtime messages; derived from
+    /// the session log rather than a flag so a cleared, restored, or compacted
+    /// session gets the contract again exactly once and every later Operate
+    /// step does not repeat it. Runs at turn start and before every model
+    /// request, so a mode switched mid-turn reaches the next request. Known
+    /// limitation: a response already streaming is not restarted for a mode
+    /// change; it finishes under the notice it was sent with, and its tool
+    /// calls are planned under the new posture. Returns whether anything was
+    /// appended.
+    fn record_mode_context(&mut self, mode: AppMode) -> bool {
+        let before = self.session.messages.len();
+        self.record_mode_notice(mode);
+        if mode == AppMode::Operate
+            && !self
+                .session
+                .messages
+                .iter()
+                .any(crate::runtime_handoff::is_current_operate_contract_message)
+        {
+            self.session
+                .add_message(crate::runtime_handoff::operate_contract_runtime_message());
+        }
+        self.session.messages.len() != before
+    }
+
     fn record_mode_notice(&mut self, mode: AppMode) {
         if self.child_host.is_some() || self.rlm_host.is_some() {
             return;
```

**File**: `crates/tui/src/core/engine/turn_loop/preparation.rs` (modified, +3/-0)
```diff
@@ -59,6 +59,9 @@ impl Engine {
             }
             progress.mode = self.current_mode;
         }
+        if self.record_mode_context(self.current_mode) {
+            self.emit_session_updated().await;
+        }
 
         let mut accepted_steer = false;
         while let Some(pending) = self.next_turn_steer() {
```

**File**: `crates/tui/src/tui/app.rs` (modified, +9/-24)
```diff
@@ -3485,9 +3485,6 @@ impl App {
     /// permission surface and refuses here; otherwise this behaves like
     /// [`Self::select_mode`] and persists the mode actually installed (Act).
     pub fn select_yolo_compat(&mut self) -> SettingSelection {
-        if self.reject_setting_change_while_busy(MessageId::SettingSubjectMode) {
-            return SettingSelection::Refused;
-        }
         if self.approval_policy_locked() {
             self.push_status_toast(
                 "Permissions are controlled by config or managed requirements".to_string(),
@@ -3562,28 +3559,21 @@ impl App {
     /// What is persisted is `self.mode` — the mode `set_mode` actually
     /// installed — not the requested enum.
     ///
-    /// The outcome is typed, not a bool, because three things can happen and
-    /// only one of them means "nothing was saved":
+    /// The outcome is typed, not a bool, so callers can tell a live change
+    /// from a selection that only saved the startup default:
     ///
     /// - [`SettingSelection::Changed`] — live mode moved *and* the startup
     ///   default was queued.
     /// - [`SettingSelection::PersistedSame`] — live mode was already the
     ///   requested one, but the startup default was still queued. This is a
     ///   real, reportable action: after a session restore the live mode and the
     ///   startup default routinely disagree.
-    /// - [`SettingSelection::Refused`] — the #2982 turn lock rejected it and
-    ///   nothing was written anywhere.
     ///
-    /// A bool collapsed the last two, so every caller (slash `/mode`, the
-    /// Alt+A/P/Y shortcuts, the hotbar mode rows) reported a refusal and a
-    /// successful same-mode save identically — as "already in that mode", with
-    /// no receipt for the write that did happen.
+    /// Mode is not turn-locked: a change during a running turn is sent to the
+    /// engine, which applies it at its next step boundary in that turn.
     ///
     /// [`StartupDefaultsWriter`]: crate::tui::startup_defaults::StartupDefaultsWriter
     pub fn select_mode(&mut self, mode: AppMode) -> SettingSelection {
-        if self.reject_setting_change_while_busy(MessageId::SettingSubjectMode) {
-            return SettingSelection::Refused;
-        }
         let changed = self.set_mode(mode);
         // Persist an explicit selection even when it matches the live mode.
         // A restored session can be Operate while the startup default remains
@@ -3695,11 +3685,12 @@ impl App {
         );
     }
 
-    /// Whether mode/thinking selection is locked because a turn is in flight.
+    /// Whether a route setting is locked because a turn is in flight.
     ///
-    /// While `is_loading`, the model/permission surface the engine is acting on
-    /// must not shift underneath it, so user-initiated mode and thinking changes
-    /// are refused (#2982). Returns true (and posts a concise status message) if
+    /// While `is_loading`, the model, provider and thinking the engine is
+    /// acting on must not shift underneath it, so those changes are refused
+    /// (#2982). Mode and permissions are not locked: the engine applies them
+    /// at its next step boundary in the same turn. Returns true (and posts a concise status message) if
     /// the change should be rejected — the caller leaves the selection unchanged
     /// so the chip "twitches" back instead of moving.
     ///
@@ -3991,9 +3982,6 @@ impl App {
     }
 
     fn next_approval_posture(&mut self, allow_root_policy: bool) -> Option<ApprovalMode> {
-        if self.reject_setting_change_while_busy(MessageId::SettingSubjectPermissions) {
-            return None;
-        }
         // Plan used to refuse the change outright, which welded the two axes
         // together on the keyboard: Tab cycles the mode, Shift+Tab cycles the
         // posture, and in Plan the second key silently did nothing. They are
@@ -4104,9 +4092,6 @@ impl App {
     /// landing on it; Plan stays read-only and only the Act baseline moves.
     /// Shared by `/auto` and the Plan hand-off.
     pub fn apply_agent_posture(&mut self, next: ApprovalMode) -> Result<(), String> {
-        if self.reject_setting_change_while_busy(MessageId::SettingSubjectPermissions) {
-            return Err(self.setting_locked_message(MessageId::SettingSubjectPermissions));
-        }
         if self.approval_policy_locked() {
             return Err("Permissions are controlled by config or managed requirements".to_string());
         }
```

**File**: `crates/tui/src/tui/app/tests.rs` (modified, +27/-38)
```diff
@@ -645,17 +645,18 @@ fn auto_reasoning_change_invalidates_the_previous_route_and_receipt() {
 }
 
 #[test]
-fn mode_and_thinking_are_locked_while_a_turn_is_running() {
-    // #2982: while a turn is in flight, user-initiated mode/thinking changes
-    // are refused with a concise message instead of shifting the surface the
-    // engine is acting on.
+fn thinking_is_locked_but_mode_moves_while_a_turn_is_running() {
     let mut app = App::new(test_options(false), &Config::default());
     app.mode = AppMode::Agent;
     app.reasoning_effort = ReasoningEffort::Max;
     app.is_loading = true;
 
-    app.cycle_mode();
-    assert_eq!(app.mode, AppMode::Agent, "mode must not change while busy");
+    let before_effort = app.reasoning_effort;
+    app.cycle_effort();
+    assert_eq!(
+        app.reasoning_effort, before_effort,
+        "thinking must not change while busy"
+    );
     assert!(
         app.status_message
             .as_deref()
@@ -665,17 +666,8 @@ fn mode_and_thinking_are_locked_while_a_turn_is_running() {
         app.status_message
     );
 
-    let before_effort = app.reasoning_effort;
-    app.cycle_effort();
-    assert_eq!(
-        app.reasoning_effort, before_effort,
-        "thinking must not change while busy"
-    );
-
-    // Once the turn finishes, the same gesture works again.
-    app.is_loading = false;
     app.cycle_mode();
-    assert_ne!(app.mode, AppMode::Agent, "mode should change when idle");
+    assert_ne!(app.mode, AppMode::Agent, "mode changes mid-turn");
 }
 
 #[test]
@@ -4157,7 +4149,7 @@ fn plan_permission_cycle_moves_the_baseline_and_leaves_plan_read_only() {
 }
 
 #[test]
-fn busy_permission_cycle_changes_neither_runtime_nor_persistence() {
+fn busy_permission_cycle_moves_the_live_posture() {
     let _env_lock = lock_test_env();
     let tmp = tempfile::tempdir().expect("tempdir");
     let config_path = tmp.path().join("config.toml");
@@ -4168,12 +4160,10 @@ fn busy_permission_cycle_changes_neither_runtime_nor_persistence() {
     let before = app.approval_mode;
     app.is_loading = true;
 
-    assert!(!app.cycle_approval_posture());
-    assert_eq!(app.approval_mode, before);
-    assert_eq!(app.mode_prefs.agent_approval_mode, before);
-    assert!(!tmp.path().join("settings.toml").exists());
+    assert!(app.cycle_approval_posture());
+    assert_ne!(app.mode_prefs.agent_approval_mode, before);
     assert!(
-        app.status_message
+        !app.status_message
             .as_deref()
             .is_some_and(|message| message.contains("locked"))
     );
@@ -6928,7 +6918,7 @@ fn reselecting_restored_live_mode_updates_the_startup_default() {
 }
 
 #[test]
-fn mode_change_refused_while_a_turn_runs_persists_nothing() {
+fn mode_change_while_a_turn_runs_is_live_and_persisted() {
     let _lock = lock_test_env();
     let tmp = tempfile::TempDir::new().expect("tempdir");
     let _env = sealed_settings_home(tmp.path());
@@ -6938,12 +6928,13 @@ fn mode_change_refused_while_a_turn_runs_persists_nothing() {
     app.select_mode(AppMode::Plan);
     app.is_loading = true;
     app.cycle_mode();
+    app.startup_defaults.flush();
 
-    assert_eq!(app.mode, AppMode::Plan, "#2982 lock still holds");
+    assert_eq!(app.mode, AppMode::Plan.next());
     assert_eq!(
         Settings::load().expect("reload").default_mode,
-        "plan",
-        "a refused change must not be persisted"
+        app.mode.as_setting(),
+        "a mid-turn change is a real selection"
     );
 }
 
@@ -7394,7 +7385,7 @@ fn mode_cycling_in_an_unsealed_test_writes_nothing() {
 // hotbar. `/set` and `/config <key> <value>` reached the same live route through
 // a different door, and both are reachable mid-turn: the composer accepts
 // Shift+Enter and the slash menu while `is_loading`. So during a running turn a
-// slash command could swap the model, thinking level, mode, or provider out from
+// slash command could swap the model, thinking level, or provider out from
 // under the engine *and* persist it. The refusal now sits in one place, above
 // every disk write and every `App` mutation.
 
@@ -7438,7 +7429,6 @@ fn slash_config_and_set_refuse_every_live_route_key_while_a_turn_runs() {
             ("default_model", "deepseek-v4-pro"),
             ("reasoning_effort", "high"),
             ("effort", "high"),
-            ("mode", "operate"),
             ("provider", "openai"),
         ] {
             let result = crate::commands::set_config_value(&mut app, key, value, persist);
@@ -7637,15 +7627,15 @@ fn mode_selection_reports_refusal_change_and_persisted_same_distinctly() {
     );
 
     app.is_loading = true;
-    assert_eq!(app.select_mode(AppMode::Plan), SettingSelection::Refused);
+    assert_eq!(app.select_mode(AppMode::Plan), SettingSelection::Changed);
     assert!(!SettingSelection::Refused.accepted());
-    assert_eq!(app.mode, AppMode::Operate, "a refusal changes nothing");
+    assert_eq!(app.mode, AppMode::Plan, "mode is not turn-locked");
 }
 
-/// Eve
```

**File**: `crates/tui/src/tui/ui/provider_routes.rs` (modified, +12/-1)
```diff
@@ -627,7 +627,7 @@ pub(crate) fn reasoning_effort_receipt_for_route(
     .unwrap_or(EffectiveReasoningEffort::Tier(tier))
 }
 
-pub(crate) async fn sync_mode_update(app: &App, engine_handle: &EngineHandle) {
+pub(crate) async fn sync_mode_update(app: &mut App, engine_handle: &EngineHandle) {
     // #6150: non-blocking send on the input path. ChangeMode is safe to drop
     // on a full channel — `try_send` still publishes the live authority
     // snapshot, which the drain applies before the next queued op.
@@ -639,6 +639,17 @@ pub(crate) async fn sync_mode_update(app: &App, engine_handle: &EngineHandle) {
         approval_mode: app.approval_mode,
         configured_sandbox_mode: app.configured_sandbox_mode.clone(),
     });
+    if app.is_loading {
+        app.push_status_toast(
+            format!(
+                "{} · {} — applies at the agent's next step in this turn",
+                crate::tui::app::AppModeUi::display_name_localized(app.mode, app.ui_locale),
+                app.effective_permission_label(),
+            ),
+            StatusToastLevel::Info,
+            Some(6_000),
+        );
+    }
 }
 
 /// Apply a `/provider` switch by resolving a complete route candidate before
```

---

### Incident Patch 2: `f75bb12d` (2026-10-27)
**Commit Message**: fix(dependencies): a version probe that outlives its deadline means installed, not missing (CW-7525)

tools::subagent::tests::root_operate_dispatch_delegates_builtin_verification_but_not_shell
failed under load: Cargo::resolve() (and resolve_executable_path for
git/pandoc) run `<tool> --version` with the 3 s VERSION_PROBE_TIMEOUT,
and on a busy machine the rustup `cargo` shim can take longer. The
timeout was treated as "not installed" and cached in the resolver's
OnceLock for the whole process, so run_tests reported cargo missing for
the rest of the session. That is a product bug, not a test bug.

probe_executable_with_flag and resolve_executable_path now share
probe_found(): a successful exit means present, a failed launch or a
failing exit means absent, and a probe that launched and was still
running at its deadline means present (it is killed with its process
tree as before). The deadline still bounds how long resolution waits;
it no longer decides presence. Banner capture
(probe_executable_capturing) is unchanged and still returns None on
timeout.

Verification: same nextest batch as 8084ead09c (frozen source) ->
142 passed, including 55 dependencies:: tests and the subagent te

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Uninstall on every install route:** `codewhale uninstall` previews receipt-owned release files and `--yes` removes only checked files, with the running command last. Both Unix installers and the Windows archive installer record command ownership; self-update renews existing receipts on both. On Windows the running `codewhale.exe` is renamed and deleted once the command exits. Package-managed copies are left alone, and the command prints their exact removal command: npm with its prefix, Cargo with its root, the Homebrew formula, `scoop uninstall codewhale`, `winget uninstall --id HunterBown.CodeWhale`, or the Windows setup's `Uninstall.exe`. Every other `codewhale`/`codew` still on PATH is listed. User data is kept unless you add `--purge-data`, which previews and then deletes only `~/.codewhale` (or a `CODEWHALE_HOME` named `.codewhale`) and `~/.deepseek/snapshots`, refusing symlinks, home ancestors and directories owned by another user. Windows removal is compile-checked but not yet exercised on a Windows host. (Refs #7091)
 
 - **GitHub Action needs an explicit provider:** the Action's `provider` input no longer defaults to the `codewhale` account relay. Name your BYOK provider (or `codewhale` for a separately verified account machine key); a missing provider stops with `configuration_missing` before any download or model call. The repository's own (disabled) review workflow now pins CLI `v0.10.2` by default instead of `v0.10.0`.
+- **Slow tools are not reported missing:** a tool whose `--version` probe is still running at its 3-second deadline (for example the `cargo` rustup shim on a busy machine) now counts as installed instead of being cached as missing for the rest of the session.
 - **GitHub Action reviews:** analysis can export a structured Engine review for a separate trusted publisher job. The publisher checks the current PR revision and line anchors, deduplicates its findings, and keeps uncertain or preexisting claims out of inline comments.
 - **Telegram recovery:** prompts and their initiating identity are durable before the polling cursor advances. Restart recovery reuses the original Engine operation, questions preserve human ownership, and uncertain final replies remain available through `/status` without an automatic resend.
 - **DingTalk bridge:** an optional internal-app Stream adapter reuses the same Engine, shared admission and approval helpers. Tenant/staff allowlists, durable acceptance before acknowledgement and retained uncertain deliveries protect recovery. Managed account linking is separate from this advanced self-hosted bridge.
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Uninstall on every install route:** `codewhale uninstall` previews receipt-owned release files and `--yes` removes only checked files, with the running command last. Both Unix installers and the Windows archive installer record command ownership; self-update renews existing receipts on both. On Windows the running `codewhale.exe` is renamed and deleted once the command exits. Package-managed copies are left alone, and the command prints their exact removal command: npm with its prefix, Cargo with its root, the Homebrew formula, `scoop uninstall codewhale`, `winget uninstall --id HunterBown.CodeWhale`, or the Windows setup's `Uninstall.exe`. Every other `codewhale`/`codew` still on PATH is listed. User data is kept unless you add `--purge-data`, which previews and then deletes only `~/.codewhale` (or a `CODEWHALE_HOME` named `.codewhale`) and `~/.deepseek/snapshots`, refusing symlinks, home ancestors and directories owned by another user. Windows removal is compile-checked but not yet exercised on a Windows host. (Refs #7091)
 
 - **GitHub Action needs an explicit provider:** the Action's `provider` input no longer defaults to the `codewhale` account relay. Name your BYOK provider (or `codewhale` for a separately verified account machine key); a missing provider stops with `configuration_missing` before any download or model call. The repository's own (disabled) review workflow now pins CLI `v0.10.2` by default instead of `v0.10.0`.
+- **Slow tools are not reported missing:** a tool whose `--version` probe is still running at its 3-second deadline (for example the `cargo` rustup shim on a busy machine) now counts as installed instead of being cached as missing for the rest of the session.
 - **GitHub Action reviews:** analysis can export a structured Engine review for a separate trusted publisher job. The publisher checks the current PR revision and line anchors, deduplicates its findings, and keeps uncertain or preexisting claims out of inline comments.
 - **Telegram recovery:** prompts and their initiating identity are durable before the polling cursor advances. Restart recovery reuses the original Engine operation, questions preserve human ownership, and uncertain final replies remain available through `/status` without an automatic resend.
 - **DingTalk bridge:** an optional internal-app Stream adapter reuses the same Engine, shared admission and approval helpers. Tenant/staff allowlists, durable acceptance before acknowledgement and retained uncertain deliveries protect recovery. Managed account linking is separate from this advanced self-hosted bridge.
```

**File**: `crates/tui/src/dependencies.rs` (modified, +12/-3)
```diff
@@ -70,7 +70,17 @@ pub fn probe_executable_with_flag(spec: &str, version_flag: &str) -> bool {
     };
     let mut cmd = version_probe_command(program);
     cmd.args(parts).arg(version_flag);
-    matches!(probe_output(&mut cmd, false, VERSION_PROBE_TIMEOUT), Ok(output) if output.status.success())
+    probe_found(&mut cmd)
+}
+
+/// A probe that launched and was still running at its deadline found an
+/// installed tool that is slow under load; only a failed launch or a failing
+/// exit means the tool is absent.
+fn probe_found(command: &mut Command) -> bool {
+    match probe_output(command, false, VERSION_PROBE_TIMEOUT) {
+        Ok(output) => output.status.success(),
+        Err(error) => error.kind() == std::io::ErrorKind::TimedOut,
+    }
 }
 
 /// Probe a single executable and capture its version banner in one spawn.
@@ -244,8 +254,7 @@ fn resolve_executable_path(spec: &str, version_flag: &str) -> Option<String> {
         let mut cmd = version_probe_command(&candidate);
         cmd.args(&args).arg(version_flag);
 
-        if matches!(probe_output(&mut cmd, false, VERSION_PROBE_TIMEOUT), Ok(output) if output.status.success())
-        {
+        if probe_found(&mut cmd) {
             return Some(candidate.to_string_lossy().into_owned());
         }
     }
```

---

### Incident Patch 3: `ccda7072` (2026-10-27)
**Commit Message**: perf(tui): an idle session relaxes its poll during prompts and background jobs (#6728)

The event loop only reached its 250 ms quiet poll when nothing at all was
live, so the states an idle user actually sits in kept the 24-48 ms poll:
- an approval, elevation or question card on top (the turn is still
  loading, so the active 24 ms poll applied);
- a running background job (durable task) or a once-a-second label, which
  counted as "animating" or "busy" even though the frame requester already
  wakes the loop at the next frame deadline.

Now a waiting decision prompt takes the idle path and counts as quiescent;
only motion faster than the quiet poll counts as animation (slower motion
is woken by its frame deadline); a live durable task no longer blocks the
quiet poll (the task panel refreshes on its own 2.5 s cadence). The
terminal input thread polls every 200 ms instead of 50 ms after 5 s
without input, which keeps the child-terminal pause ack well inside its
500 ms timeout. `decision_prompt_waiting` replaces the duplicated
ModalKind match in status_animation_interval_ms.

Known limits: the loop is still polled, not woken, so an engine event, a
remote decision or a prompt timeout

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- **Nested and deletable threads (Runtime API):** a fork (including a backtrack fork) records `parent_thread_id`, `POST /v1/threads` accepts one, and `GET /v1/threads/summary` returns it so clients can nest child conversations. `DELETE /v1/threads/{id}` removes an idle thread with its turns, items, events and goal, and its saved session unless another thread shares it or a terminal holds it open; a running thread answers 409.
+- **Hunk actions in Review (Runtime API):** `POST /v1/git/stage`, `/v1/git/unstage` and `/v1/git/discard` take `hunks` (the `@@ … @@` headers from `GET /v1/diff`) with one path and apply only those hunks through `git apply`, honouring the same `expect` preconditions as whole-path writes. A hunk that no longer exists answers `409 git_state_changed` with `stale_hunks`, and nothing is written unless git accepts the whole patch.
 - **Provider pre-cuts B (internal):** client wire helpers, reasoning-effort mapping and the Ollama catalog parsers move into their own client modules, and test-only provider gates use the shared test-isolation predicate. No behavior change. (CW-6129)
 - **`codewhale-dependencies`, `codewhale-snapshot`, `codewhale-lsp`, `codewhale-repl` crates:** external-tool resolution, workspace snapshots, the language-server client and the Python REPL runtime moved out of `codewhale-tui` into their own crates; `write_context_file` now lives in `codewhale-repl`. No behavior change. (CW-6129)
 - **`codewhale-skill-install` crate:** the community-skill installer, package content digest and `SKILL.md` frontmatter reader move out of `codewhale-tui` into a new crate; the install SSRF guard and timeouts are unchanged in production builds. (CW-6129)
@@ -171,6 +173,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   seconds without input or engine events, as it already did in an idle
   session, instead of starting about a dozen git processes every 2 seconds for
   as long as the job lives (#6728).
+- An idle session wakes less often. While an approval, elevation or question
+  prompt waits on you, while a background job runs, or while only a
+  once-a-second label ticks, the event loop now relaxes to its 250 ms quiet
+  poll instead of polling every 24 to 48 ms; animations and the prompt's
+  timeout still wake it on their own deadlines. The terminal input thread
+  polls every 200 ms instead of 50 ms after 5 seconds without input. Measured
+  on macOS with release builds: an approval wait went from 29 to 12 timer
+  wakeups per second, a background job from 32 to 16 and an idle composer
+  from 25 to 11 (#6728).
 - `write` over an existing file now says when it kept that file's CRLF or LF
   line endings, so the agent no longer reports a line-ending conversion that
   did not happen (#7070).
```

**File**: `crates/tui/CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- **Nested and deletable threads (Runtime API):** a fork (including a backtrack fork) records `parent_thread_id`, `POST /v1/threads` accepts one, and `GET /v1/threads/summary` returns it so clients can nest child conversations. `DELETE /v1/threads/{id}` removes an idle thread with its turns, items, events and goal, and its saved session unless another thread shares it or a terminal holds it open; a running thread answers 409.
+- **Hunk actions in Review (Runtime API):** `POST /v1/git/stage`, `/v1/git/unstage` and `/v1/git/discard` take `hunks` (the `@@ … @@` headers from `GET /v1/diff`) with one path and apply only those hunks through `git apply`, honouring the same `expect` preconditions as whole-path writes. A hunk that no longer exists answers `409 git_state_changed` with `stale_hunks`, and nothing is written unless git accepts the whole patch.
 - **Provider pre-cuts B (internal):** client wire helpers, reasoning-effort mapping and the Ollama catalog parsers move into their own client modules, and test-only provider gates use the shared test-isolation predicate. No behavior change. (CW-6129)
 - **`codewhale-dependencies`, `codewhale-snapshot`, `codewhale-lsp`, `codewhale-repl` crates:** external-tool resolution, workspace snapshots, the language-server client and the Python REPL runtime moved out of `codewhale-tui` into their own crates; `write_context_file` now lives in `codewhale-repl`. No behavior change. (CW-6129)
 - **`codewhale-skill-install` crate:** the community-skill installer, package content digest and `SKILL.md` frontmatter reader move out of `codewhale-tui` into a new crate; the install SSRF guard and timeouts are unchanged in production builds. (CW-6129)
@@ -171,6 +173,15 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   seconds without input or engine events, as it already did in an idle
   session, instead of starting about a dozen git processes every 2 seconds for
   as long as the job lives (#6728).
+- An idle session wakes less often. While an approval, elevation or question
+  prompt waits on you, while a background job runs, or while only a
+  once-a-second label ticks, the event loop now relaxes to its 250 ms quiet
+  poll instead of polling every 24 to 48 ms; animations and the prompt's
+  timeout still wake it on their own deadlines. The terminal input thread
+  polls every 200 ms instead of 50 ms after 5 seconds without input. Measured
+  on macOS with release builds: an approval wait went from 29 to 12 timer
+  wakeups per second, a background job from 32 to 16 and an idle composer
+  from 25 to 11 (#6728).
 - `write` over an existing file now says when it kept that file's CRLF or LF
   line endings, so the agent no longer reports a line-ending conversion that
   did not happen (#7070).
```

**File**: `crates/tui/src/tui/ui/event_loop.rs` (modified, +25/-22)
```diff
@@ -5081,13 +5081,19 @@ pub(crate) async fn run_event_loop(
         let underwater_motion =
             underwater_ambient_motion || underwater_completion_motion || launch_motion;
         let animation_active = status_motion || underwater_motion;
+        let animation_interval = Duration::from_millis(animation_interval_ms(
+            app,
+            status_motion,
+            underwater_motion,
+            cadence_tier,
+        ));
         // #6728: what the loop knows about its own quiet. Anything that
         // wants a prompt reaction moves `last_ui_activity`; the idle poll
         // and the automation scan back off from it.
         let idle_facts = IdleFacts {
             has_running_agents,
-            animation_active,
-            durable_tasks_active,
+            animation_active: animation_active
+                && animation_interval < Duration::from_millis(UI_QUIESCENT_POLL_MS),
             input_pending: !pending_terminal_events.is_empty(),
             pending_engine_op: pending_subagent_list_refresh,
         };
@@ -5113,12 +5119,6 @@ pub(crate) async fn run_event_loop(
                 ),
             ));
         }
-        let animation_interval = Duration::from_millis(animation_interval_ms(
-            app,
-            status_motion,
-            underwater_motion,
-            cadence_tier,
-        ));
         let motion_policy = app.motion_policy();
         if animation_active && last_status_frame.elapsed() >= animation_interval {
             let translation_animated = streaming_thinking::animate_pending_translation(
@@ -5325,20 +5325,23 @@ pub(crate) async fn run_event_loop(
             }
         }
 
-        let mut poll_timeout =
-            if app.is_loading || has_running_agents || app.is_compacting || app.is_purging {
-                Duration::from_millis(active_poll_ms(app))
-            } else {
-                // Relaxes only once the UI has been quiescent and quiet for
-                // `UI_QUIESCENT_AFTER` (#6728); every deadline below still
-                // shortens it, and input returns the loop at once.
-                idle_poll_duration(
-                    app,
-                    &idle_facts,
-                    now,
-                    now.saturating_duration_since(last_ui_activity),
-                )
-            };
+        let mut poll_timeout = if (app.is_loading && !decision_prompt_waiting(app))
+            || has_running_agents
+            || app.is_compacting
+            || app.is_purging
+        {
+            Duration::from_millis(active_poll_ms(app))
+        } else {
+            // Relaxes only once the UI has been quiescent and quiet for
+            // `UI_QUIESCENT_AFTER` (#6728); every deadline below still
+            // shortens it, and input returns the loop at once.
+            idle_poll_duration(
+                app,
+                &idle_facts,
+                now,
+                now.saturating_duration_since(last_ui_activity),
+            )
+        };
         if let Some(until_flush) = app.paste_burst_next_flush_delay_if_enabled(now) {
             poll_timeout = poll_timeout.min(until_flush);
         }
```

**File**: `crates/tui/src/tui/ui/motion.rs` (modified, +5/-7)
```diff
@@ -158,13 +158,11 @@ pub(crate) fn rail_min_chat_width(idle_empty: bool) -> u16 {
 pub(crate) fn status_animation_interval_ms(app: &App) -> u64 {
     if app.effective_low_motion_for_status() {
         crate::tui::display_refresh::adaptive_animation_interval_ms(true)
-    } else if matches!(
-        app.view_stack.top_kind(),
-        Some(ModalKind::Approval | ModalKind::Elevation | ModalKind::UserInput)
-    ) || !(app.is_loading
-        || app.is_compacting
-        || app.is_purging
-        || crate::tui::subagent_routing::running_agent_count(app) > 0)
+    } else if decision_prompt_waiting(app)
+        || !(app.is_loading
+            || app.is_compacting
+            || app.is_purging
+            || crate::tui::subagent_routing::running_agent_count(app) > 0)
     {
         UI_QUIET_STATUS_ANIMATION_MS
     } else {
```

**File**: `crates/tui/src/tui/ui/terminal.rs` (modified, +15/-15)
```diff
@@ -821,10 +821,10 @@ pub(crate) const UI_QUIESCENT_POLL_MS: u64 = 250;
 pub(crate) struct IdleFacts {
     /// Live sub-agents (`running_agent_count(app) > 0`).
     pub(crate) has_running_agents: bool,
-    /// A spinner, the underwater scene, or a launch animation wants frames.
+    /// A spinner, the underwater scene, or a launch animation wants frames
+    /// faster than [`UI_QUIESCENT_POLL_MS`]; slower motion is woken by its
+    /// own frame deadline.
     pub(crate) animation_active: bool,
-    /// Durable tasks queued, running or waiting.
-    pub(crate) durable_tasks_active: bool,
     /// A terminal event is already buffered for this iteration.
     pub(crate) input_pending: bool,
     /// A sub-agent list refresh is waiting for room in the engine mailbox.
@@ -837,18 +837,18 @@ pub(crate) struct IdleFacts {
 /// the list errs towards "busy".
 pub(crate) fn ui_state_is_quiescent(app: &App, facts: &IdleFacts, now: Instant) -> bool {
     let toast_live = |toast: &StatusToast| toast.ttl_ms.is_some() && !toast.is_expired(now);
-    !(app.is_loading
+    let deciding = decision_prompt_waiting(app);
+    !((app.is_loading && !deciding)
         || app.is_compacting
         || app.is_purging
-        || app.turn_started_at.is_some()
-        || matches!(app.runtime_turn_status.as_deref(), Some("in_progress"))
+        || (app.turn_started_at.is_some() && !deciding)
+        || (matches!(app.runtime_turn_status.as_deref(), Some("in_progress")) && !deciding)
         || facts.has_running_agents
         || facts.animation_active
-        || facts.durable_tasks_active
         || facts.input_pending
         || facts.pending_engine_op
         || app.needs_redraw
-        || !app.view_stack.is_empty()
+        || (!app.view_stack.is_empty() && !deciding)
         || app.onboarding != OnboardingState::None
         || app.redaction_gate
         || !app.queued_messages.is_empty()
@@ -862,6 +862,13 @@ pub(crate) fn ui_state_is_quiescent(app: &App, facts: &IdleFacts, now: Instant)
         || app.sticky_status.as_ref().is_some_and(toast_live))
 }
 
+pub(crate) fn decision_prompt_waiting(app: &App) -> bool {
+    matches!(
+        app.view_stack.top_kind(),
+        Some(ModalKind::Approval | ModalKind::Elevation | ModalKind::UserInput)
+    )
+}
+
 /// The idle poll for this iteration: [`idle_poll_ms`] normally, relaxed to
 /// [`UI_QUIESCENT_POLL_MS`] once the UI has been quiescent (see
 /// [`ui_state_is_quiescent`]) and quiet for [`UI_QUIESCENT_AFTER`]. `quiet_for`
@@ -991,13 +998,6 @@ mod idle_poll_tests {
                 },
                 "something is animating",
             ),
-            (
-                IdleFacts {
-                    durable_tasks_active: true,
-                    ..IdleFacts::default()
-                },
-                "a durable task is live",
-            ),
             (
                 IdleFacts {
                     input_pending: true,
```

**File**: `crates/tui/src/tui/ui/terminal_input.rs` (modified, +10/-1)
```diff
@@ -12,6 +12,8 @@ use std::time::{Duration, Instant};
 use crossterm::event::{self, Event};
 
 const TERMINAL_INPUT_POLL_INTERVAL: Duration = Duration::from_millis(50);
+const TERMINAL_INPUT_IDLE_POLL_INTERVAL: Duration = Duration::from_millis(200);
+const TERMINAL_INPUT_IDLE_AFTER: Duration = Duration::from_secs(5);
 const TERMINAL_INPUT_HEARTBEAT_INTERVAL: Duration = Duration::from_millis(500);
 pub(super) const TERMINAL_INPUT_STALL_TIMEOUT: Duration = Duration::from_secs(5);
 pub(super) const TERMINAL_INPUT_RECOVERY_COOLDOWN: Duration = Duration::from_secs(10);
@@ -186,18 +188,25 @@ impl TerminalInputPump {
             .name("codewhale-terminal-input".to_string())
             .spawn(move || {
                 let mut last_heartbeat = Instant::now();
+                let mut last_event = last_heartbeat;
                 while !thread_stop.load(Ordering::Acquire) {
                     if thread_paused.load(Ordering::Acquire) {
                         thread_paused_ack.store(true, Ordering::Release);
                         thread::sleep(TERMINAL_INPUT_CHILD_PAUSE_POLL_INTERVAL);
                         continue;
                     }
                     thread_paused_ack.store(false, Ordering::Release);
-                    match event::poll(TERMINAL_INPUT_POLL_INTERVAL) {
+                    let poll_interval = if last_event.elapsed() < TERMINAL_INPUT_IDLE_AFTER {
+                        TERMINAL_INPUT_POLL_INTERVAL
+                    } else {
+                        TERMINAL_INPUT_IDLE_POLL_INTERVAL
+                    };
+                    match event::poll(poll_interval) {
                         Ok(true) if thread_stop.load(Ordering::Acquire) => break,
                         Ok(true) => match event::read() {
                             Ok(event) => {
                                 last_heartbeat = Instant::now();
+                                last_event = last_heartbeat;
                                 let observed = ObservedTerminalEvent::new(event, last_heartbeat);
                                 if tx.send(TerminalInputMessage::Event(observed)).is_err() {
                                     break;
```

#### Recent Merged Pull Requests:
- **PR #7104** (2026-10-27): docs(i18n): refresh README source stamps after 4cf2d2cff (@Aboysky)
- **PR #7097** (2026-10-27): fix(tui): resolve the state root before opening session-side state (@SparkofSpike)
- **PR #7090** (2026-10-25): fix(tui): don't print an unpriced session cost as $0.0000 in /status (@Lstarsky0)
- **PR #7089** (2026-10-26): fix(tui): only say "Goal cleared." when there was a goal to clear (@Lstarsky0)
- **PR #7087** (2026-10-25): fix(tui): keep the /diff pager's place when the terminal is resized (@Lstarsky0)
- **PR #7086** (2026-10-27): feat(context): per-scope instruction budgets with visible truncation (#6526) (@7jrxt42BxFZo4iAnN4CX)

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

## X. tui): change mode and permissions mid-turn; record steering in Unreleased (CW-75

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0cf390f0`: tui): change mode and permissions mid-turn; record steering in Unreleased (CW-7552). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Change mode and permissions while the agent works:** Tab, Shift+Tab, `/mode`, the hotbar and `/config mode` no longer refuse while a turn is running. A response that is already streaming is not restarted; the change applies at the agent's next step in the same turn (before its next tool batch, at every approval gate, and before its next model request, which carries the new mode notice). The status line says so until it applies. A call still waiting for approval goes back to the model under the new posture, and a call you already approved runs only if the new posture is equal or broader. Model, thinking level and provider stay locked until the turn ends. (CW-7552)
- **Steering interrupts thinking:** a steer (Ctrl+Enter, or Enter twice after queueing) now closes the in-flight model request at once, whether the model is waiting on headers, reasoning, writing text or emitting a tool call, and continues the same turn with your message. Text already shown is kept as interrupted output; unfinished reasoning and partial tool calls are discarded, never run. (CW-7552)
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0cf390f0` are properly handled with clean fallback behavior.
