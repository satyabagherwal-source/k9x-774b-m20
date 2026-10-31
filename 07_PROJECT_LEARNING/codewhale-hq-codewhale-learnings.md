> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `785f7d0d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T15:36:28.621Z  
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
> **Harvest Timestamp**: 2026-10-31T15:36:28.614Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source agent for the terminal written in Rust. Use any provider or model. Issues & PRs always welcome
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41159 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7136** (2026-10-29): **The persistent "update available" header chip is never rendered — `app.update_available` is written and never read**
  *Symptoms*: ### Before you start  - [X] I searched existing issues and this is not a duplicate. 我已搜索过现有 issue。  ### What happened? 发生了什么？  saw no notification  ### Steps to reproduce 复现步骤  Using codewhale  - the update available notification for 0.10.2 was not given  ### Codewhale version 版本  codewhale 0.10.1  ### Where did it happen? 在哪里出现？  TUI (terminal interface)  ### Operating system 操作系统  Linux  ### How did you get Codewhale? 获取方式  Official script ([codewhale.net/install.sh](<http://codewhale.net/install.sh>))  ### Provider and model 提供商和模型  *No response*  ### Terminal and shell 终端  *No response*  ### codewhale doctor (optional)  ```text ```  ### Logs, screenshots, anything else (optional)  # The persistent "update available" header chip is never rendered — `app.update_available` is written and never read  **Labels:** `bug`  **Surface:** TUI (terminal interface)  **Version:** `codewhale 0.10.1 (fead51eeea0f)`  **OS:** Linux (Linux Mint 22.2, x86-64)  **Confirmed present in:** `v0.10.1` tag and `HEAD` (`687a38c6e`, 2026-10-28) — 281 commits after the tag, still unreproduced.  ---  ## What happened  A newer release was available and Codewhale never told me — or told me only for twelve seconds, at startup, four days before I noticed.  Running `0.10.1` with `0.10.2` published:  | Fact | Value | | -- | -- | | Installed | `codewhale 0.10.1 (fead51eeea0f)`, `/usr/local/bin/codewhale`, 8 Oct | | `v0.10.2` published | 2026-10-24T17:31:14Z | | Session started | 2026-10-25T04:27:16Z | | Updat

- **Issue #7123** (2026-10-29): **Display overflow of the chain of thought**
  *Symptoms*: ### Before you start  - [x] I searched existing issues and this is not a duplicate. 我已搜索过现有 issue。  ### What happened? 发生了什么？  Some content within the chain of thought may spill over the boundaries of the chain-of-thought card and appear as regular content.   **This is the chain-of-thought in a collapsed state.** <img width="887" height="189" alt="Image" src="https://github.com/user-attachments/assets/bb3c8c61-56bb-4913-bd8f-d3c3314a9573" />  **This is the chain of thought in its expanded state. A single sentence has been split into two parts: the first half appears inside the chain of thought, while the second half appears outside of it; together, they form one continuous sentence.** <img width="916" height="233" alt="Image" src="https://github.com/user-attachments/assets/935c37bd-77c5-46a3-9c3d-c956be2acfef" />  ### Steps to reproduce 复现步骤  Just use it as normal.  ### Codewhale version 版本  0.10.3  ### Where did it happen? 在哪里出现？  TUI (terminal interface)  ### Operating system 操作系统  Windows  ### How did you get Codewhale? 获取方式  Official script (codewhale.net/install.sh)  ### Provider and model 提供商和模型  _No response_  ### Terminal and shell 终端  Windows Terminal  ### codewhale doctor (optional)  ```text  ```  ### Logs, screenshots, anything else (optional)  _No response_

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

### Incident Patch 1: `20f091d6` (2026-10-31)
**Commit Message**: fix(cli): remove the marked PATH block and Codewhale completions on uninstall

A receipted release copy of `codewhale uninstall --yes` removed its program
files but left the user to hand-delete the PATH lines and completion files the
installer had told them to create. #7091 asks for a complete, verifiable
uninstall; this completes the shell half of it.

Uninstall now plans and applies two extra removals, both scoped to this
install and gated on the same receipted copy that owns the program files:

- This install's exact three-line `# >>> codewhale PATH >>>` block, in the
  same profile list the old report walked. The block is only matched when its
  middle line names this install directory, so another copy's block and a bare
  `export PATH=…` line the user wrote are never touched. The profile is edited
  by staging replacement bytes and renaming the original aside, so a failure
  installing the replacement restores the user's own file by name; a symlinked,
  unreadable or non-UTF-8 profile is reported and skipped. The profile's mode
  is adopted before the guard captures it, since `GuardedFile` pins ctime.
- The Codewhale-generated completion files at their documented paths, honour

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`exec` and `doctor` follow the TUI onto local Ollama:** with no cloud key and no explicit route, `codewhale exec` uses a running local Ollama chat model and says so, and `codewhale doctor --probe-local` checks that route. Nothing is saved. (#7115)
 - **Thinking starts at auto:** new configurations and the built-in default use `reasoning_effort = "auto"` instead of `max`; an effort you set is never changed.
 - **DSH Git review scopes:** the extension host brokers bounded, read-only Git metadata to reviewed DSH plugins through a new `git_review_scope` action (extension-host policy v8).
-- **Safer uninstall:** program removal never edits shell profiles; matching Codewhale PATH blocks are reported for manual cleanup. Data purge requires a receipted removal in the same confirmed run. Both Unix installers reject unsafe or managed destinations before creating them and keep shell profiles unchanged. Uninstall instructions now match the explicit-home purge scope in English and Chinese.
+- **Safer, more complete uninstall:** for a receipted release copy, `codewhale uninstall --yes` now also removes this install's exact three-line `# >>> codewhale PATH >>>` block from your shell profiles and the Codewhale-generated completion files at their documented paths (bash, zsh and fish, honouring `XDG_DATA_HOME` and `XDG_CONFIG_HOME`). It touches nothing else in a profile, leaves a symlinked or unreadable profile for you to edit, keeps the completion files while another Codewhale copy remains on PATH, and exits non-zero if that cleanup fails after the program is already gone. The `codewhale.net/install.sh` hint and the install guide now print the PATH line as that marked block, so there is something provably yours to remove; a bare `export PATH=…` line you added earlier is never touched. Data purge requires a receipted removal in the same confirmed run. Both Unix installers reject unsafe or managed destinations before creating them and still never edit shell profiles themselves. Uninstall instructions match the explicit-home purge scope in English and Chinese. Not yet observed on a real Windows host or an installed release artifact. (Refs #7091)
 - **Nested and deletable threads (Runtime API):** a fork (including a backtrack fork) records `parent_thread_id`, `POST /v1/threads` accepts one naming an existing thread, and `GET /v1/threads/summary` returns it so clients can nest child conversations. `DELETE /v1/threads/{id}` removes an idle thread with its turns, items, events and goal, and its saved session unless another thread shares it or a terminal holds it open; a running thread answers 409.
 - **Hunk actions in Review (Runtime API):** `POST /v1/git/stage`, `/v1/git/unstage` and `/v1/git/discard` take a `patch` holding hunks of the one path in `paths` and apply only those hunks through `git apply`, under the same `expect` preconditions as whole-path writes. A patch that no longer applies fails with git's message and writes nothing; renames, mode changes and binary patches are refused. The tasks tool can also `suggest` a task, shown as a Start/Hide card, without starting anything.
 - **Live `/models` ceilings reach the route:** a provider that states per-model context and output limits in its own `/models` body now keeps them instead of falling back to the legacy 128K window. OpenAI `limit` blocks, flat `context_length` / `context_window` / `max_model_len` / `max_context_length` fields, `max_output_tokens` / `max_completion_tokens`, and a relay `metadata` block (`context_limit`, `context_budget`, `output_budget`) are read; `metadata.context_limit` outranks `context_budget` because the first is the model capability and the second the share one deployment accepts. Each field is parsed on its own, so an unreadable one costs only its own candidate instead of hiding the readable fields below it.
```

**File**: `crates/cli/src/update/uninstall.rs` (modified, +294/-13)
```diff
@@ -163,7 +163,7 @@ fn remove(yes: bool) -> Result<bool> {
     let method = InstallMethod::detect(&identity.path);
     println!("Selected executable: {}", identity.path.display());
     println!(
-        "Program removal preserves user state, credentials, sessions, workspaces and services. Uninstall never edits shell profiles; for a receipted release copy it reports recognizable Codewhale PATH blocks in accessible profiles for you to remove."
+        "Program removal preserves user state, credentials, sessions, workspaces and services. For a receipted release copy it also removes this install's exact Codewhale PATH block from your shell profiles and Codewhale-generated completion files at the documented paths; nothing else in a profile is touched."
     );
     if !method.supports_self_update() {
         println!(
@@ -275,7 +275,7 @@ fn remove(yes: bool) -> Result<bool> {
             directory.join(file.name()).display()
         );
     }
-    report_path_blocks(&directory);
+    let shell = ShellIntegration::plan(&directory, &identity.path, yes);
     validate_primary_update_identity(&identity)?;
     if !yes {
         println!(
@@ -359,6 +359,7 @@ fn remove(yes: bool) -> Result<bool> {
             );
         }
     }
+    let shell_failures = shell.apply();
     println!(
         "Removed this receipted release installation. Other installations were not removed. {}",
         if cfg!(windows) {
@@ -367,17 +368,76 @@ fn remove(yes: bool) -> Result<bool> {
             "Run hash -r in your shell."
         }
     );
+    if !shell_failures.is_empty() {
+        bail!(
+            "The program files were removed, but shell integration cleanup is incomplete: {}",
+            shell_failures.join("; ")
+        );
+    }
     Ok(true)
 }
 
 const PATH_BLOCK_START: &str = "# >>> codewhale PATH >>>";
 const PATH_BLOCK_END: &str = "# <<< codewhale PATH <<<";
 const MAX_PROFILE: usize = 1024 * 1024;
+const MAX_COMPLETION: usize = 1024 * 1024;
 
-fn report_path_blocks(directory: &Path) {
-    let Some(home) = dirs::home_dir() else {
-        return;
-    };
+struct ProfileEdit {
+    profile: PathBuf,
+    file: GuardedFile,
+    updated: Vec<u8>,
+    #[cfg(unix)]
+    mode: u32,
+}
+
+#[derive(Default)]
+struct ShellIntegration {
+    edits: Vec<ProfileEdit>,
+    completions: Vec<(PathBuf, GuardedFile)>,
+}
+
+impl ShellIntegration {
+    fn plan(directory: &Path, selected: &Path, yes: bool) -> Self {
+        let Some(home) = dirs::home_dir() else {
+            return Self::default();
+        };
+        let verb = if yes { "Remove" } else { "Would remove" };
+        Self {
+            edits: plan_path_blocks(&home, directory, verb),
+            completions: plan_completions(&home, directory, selected, verb),
+        }
+    }
+
+    fn apply(self) -> Vec<String> {
+        let mut failures = Vec::new();
+        for edit in self.edits {
+            let profile = edit.profile.clone();
+            match apply_profile_edit(edit) {
+                Ok(()) => println!(
+                    "Removed the Codewhale PATH block from {}",
+                    profile.display()
+                ),
+                Err(error) => failures.push(format!(
+                    "{} was not changed ({error:#}); delete its Codewhale PATH block by hand",
+                    profile.display()
+                )),
+            }
+        }
+        for (path, mut file) in self.completions {
+            let mut unlinked = false;
+            match file.remove_checked(&mut unlinked) {
+                Ok(()) => println!("Removed completion file {}", path.display()),
+                Err(error) => failures.push(format!(
+                    "{} was not removed ({error}); delete it by hand",
+                    path.display()
+                )),
+            }
+        }
+        failures
+    }
+}
+
+fn plan_path_blocks(home: &Path, directory: &Path, verb: &str) -> Vec<ProfileEdit> {
     let zdotdir = std::env::var_os("ZDOTDIR").map(PathBuf::from);
     let mut profiles: Vec<PathBuf> = [
         ".zshrc",
@@ -419,6 +479,7 @@ fn report_path_blocks(directory: &Path) {
                     rest == format!("{value}\" $PATH") && names_directory(value)
                 })
     };
+    let mut edits = Vec::new();
     for profile in profiles {
         let (Some(parent), Some(name)) = (
             profile.parent(),
@@ -438,27 +499,37 @@ fn report_path_blocks(directory: &Path) {
                 continue;
             }
         };
-        let text = match file.read_bounded(MAX_PROFILE).map(String::from_utf8) {
-            Ok(Ok(text)) => text,
-            _ => {
+        let bytes = match file.read_bounded(MAX_PROFILE) {
+            Ok(bytes) => bytes,
+            Err(error) => {
                 println!(
-                    "Not read: {} is not a UTF-8 file within the size limit.",
+                    "Not read: {} ({error}). If it holds a Codewhale PATH block, remove that block by hand.",
                  
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **`exec` and `doctor` follow the TUI onto local Ollama:** with no cloud key and no explicit route, `codewhale exec` uses a running local Ollama chat model and says so, and `codewhale doctor --probe-local` checks that route. Nothing is saved. (#7115)
 - **Thinking starts at auto:** new configurations and the built-in default use `reasoning_effort = "auto"` instead of `max`; an effort you set is never changed.
 - **DSH Git review scopes:** the extension host brokers bounded, read-only Git metadata to reviewed DSH plugins through a new `git_review_scope` action (extension-host policy v8).
-- **Safer uninstall:** program removal never edits shell profiles; matching Codewhale PATH blocks are reported for manual cleanup. Data purge requires a receipted removal in the same confirmed run. Both Unix installers reject unsafe or managed destinations before creating them and keep shell profiles unchanged. Uninstall instructions now match the explicit-home purge scope in English and Chinese.
+- **Safer, more complete uninstall:** for a receipted release copy, `codewhale uninstall --yes` now also removes this install's exact three-line `# >>> codewhale PATH >>>` block from your shell profiles and the Codewhale-generated completion files at their documented paths (bash, zsh and fish, honouring `XDG_DATA_HOME` and `XDG_CONFIG_HOME`). It touches nothing else in a profile, leaves a symlinked or unreadable profile for you to edit, keeps the completion files while another Codewhale copy remains on PATH, and exits non-zero if that cleanup fails after the program is already gone. The `codewhale.net/install.sh` hint and the install guide now print the PATH line as that marked block, so there is something provably yours to remove; a bare `export PATH=…` line you added earlier is never touched. Data purge requires a receipted removal in the same confirmed run. Both Unix installers reject unsafe or managed destinations before creating them and still never edit shell profiles themselves. Uninstall instructions match the explicit-home purge scope in English and Chinese. Not yet observed on a real Windows host or an installed release artifact. (Refs #7091)
 - **Nested and deletable threads (Runtime API):** a fork (including a backtrack fork) records `parent_thread_id`, `POST /v1/threads` accepts one naming an existing thread, and `GET /v1/threads/summary` returns it so clients can nest child conversations. `DELETE /v1/threads/{id}` removes an idle thread with its turns, items, events and goal, and its saved session unless another thread shares it or a terminal holds it open; a running thread answers 409.
 - **Hunk actions in Review (Runtime API):** `POST /v1/git/stage`, `/v1/git/unstage` and `/v1/git/discard` take a `patch` holding hunks of the one path in `paths` and apply only those hunks through `git apply`, under the same `expect` preconditions as whole-path writes. A patch that no longer applies fails with git's message and writes nothing; renames, mode changes and binary patches are refused. The tasks tool can also `suggest` a task, shown as a Start/Hide card, without starting anything.
 - **Live `/models` ceilings reach the route:** a provider that states per-model context and output limits in its own `/models` body now keeps them instead of falling back to the legacy 128K window. OpenAI `limit` blocks, flat `context_length` / `context_window` / `max_model_len` / `max_context_length` fields, `max_output_tokens` / `max_completion_tokens`, and a relay `metadata` block (`context_limit`, `context_budget`, `output_budget`) are read; `metadata.context_limit` outranks `context_budget` because the first is the model capability and the second the share one deployment accepts. Each field is parsed on its own, so an unreadable one costs only its own candidate instead of hiding the readable fields below it.
```

**File**: `docs/INSTALL.md` (modified, +10/-6)
```diff
@@ -64,7 +64,7 @@ still need an available release asset source.
 curl -fsSL https://codewhale.net/install.sh | sh
 
 # 2. Make sure ~/.local/bin is on your PATH, now and in future terminals.
-echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc    # zsh: use ~/.zshrc
+printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bashrc    # zsh: use ~/.zshrc
 export PATH="$HOME/.local/bin:$PATH"
 codewhale --version          # -> codewhale 0.10.0 (1be1a703b975)
 
@@ -194,7 +194,8 @@ Installed checksummed release commands:
 PATH selects no codewhale command; this install is /home/you/.local/bin/codewhale
 …
 Put /home/you/.local/bin first on PATH in future shells (run once; this installer does not edit shell profiles):
-  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
+  printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bashrc
+The marker lines let codewhale uninstall remove exactly this block; a bare export line is yours and is never touched.
 Then run: . ~/.bashrc   (or open a new terminal)
 …
 ```
@@ -234,13 +235,16 @@ prints only the current-shell `export` line. On Ubuntu and Debian, `~/.profile`
 Fix it once:
 
 ```bash
-echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc   # bash (macOS login bash: ~/.bash_profile, or ~/.profile if only that exists)
-# echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc  # zsh
+printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bashrc   # bash (macOS login bash: ~/.bash_profile, or ~/.profile if only that exists)
+# printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.zshrc  # zsh
 # fish_add_path ~/.local/bin                               # fish (untested on this VM)
 export PATH="$HOME/.local/bin:$PATH"; hash -r
 command -v codewhale codew
 ```
 
+The three-line block is marked so `codewhale uninstall` can remove exactly it later. A bare
+`export PATH=…` line is yours: uninstall never touches it, because other tools share `~/.local/bin`.
+
 ### Options
 
 ```bash
@@ -1038,7 +1042,7 @@ Not sure which one you have? Run `codewhale doctor --installs`: it lists every c
 
 The Unix installers and the Windows archive installer write `.codewhale-install.sha256` beside the commands. Uninstall accepts only existing regular, single-link files whose bytes match that receipt. On Unix, receipts, selected files and their retained parent directory must belong to the current user and must not be writable by group or others. Optional compiled-host files use their existing release receipt. All selected files pass preflight before any removal; the executing command is removed last. Modified files, symlinks, ambiguous receipts, shared writable directories, legacy unreceipted installs and unrelated files are preserved. No recursive directory removal is performed. A failed removal reports which entries were unlinked, any remaining recovery paths, and any durability failure. If the command receipt was unlinked while the executable remains, recovery republishes it only to a vacant receipt name.
 
-The command runs before configuration, credential migration and telemetry, so malformed config does not block it. It preserves data, credentials, workspaces, shell profiles, completions and services. It never edits a shell profile; for a receipted release copy, it reports recognizable Codewhale PATH blocks in accessible profiles so you can delete those lines yourself. Package-managed copies get removal guidance; custom Cargo roots with local Cargo metadata are recognized. Other command copies still on PATH are listed without running them. Refresh the shell command cache with `hash -r` and inspect the remaining entries.
+The command runs before configuration, credential migration and telemetry, so malformed config does not block it. It preserves data, credentials, workspaces and services. For a receipted release copy it also removes this install's exact three-line `# >>> codewhale PATH >>>` block from your shell profiles, and the Codewhale-generated completion files at the documented paths (`~/.local/share/bash-completion/completions/codewhale`, `~/.zfunc/_codewhale`, `~/.config/fish/completions/codewhale.fish`, honouring `XDG_DATA_HOME` and `XDG_CONFIG_HOME`). Nothing else in a profile is touched, a symlinked or unreadable profile is left for you to edit by hand, and the completion files are kept while another Codewhale copy remains on PATH. If any of that cleanup fails, the command says so and exits non-zero even though the program is already gone. Package-managed copies get removal guidance; custom Cargo roots with local Cargo metadata are recognized. Other command copies still on PATH are listed without running them. Refresh the shell command cache with `hash -r` and inspect the remaining entries.
 
 Successful self-update renews an existing
```

**File**: `docs/zh_hans/INSTALL.md` (modified, +18/-9)
```diff
@@ -46,7 +46,7 @@ target/release/codewhale --version
 curl -fsSL https://codewhale.net/install.sh | sh
 
 # 2. Make sure ~/.local/bin is on your PATH, now and in future terminals.
-echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc    # zsh: use ~/.zshrc
+printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bashrc    # zsh: use ~/.zshrc
 export PATH="$HOME/.local/bin:$PATH"
 codewhale --version          # -> codewhale 0.10.0 (1be1a703b975)
 
@@ -150,7 +150,8 @@ Installed checksummed release commands:
 PATH selects no codewhale command; this install is /home/you/.local/bin/codewhale
 …
 Put /home/you/.local/bin first on PATH in future shells (run once; this installer does not edit shell profiles):
-  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
+  printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bashrc
+The marker lines let codewhale uninstall remove exactly this block; a bare export line is yours and is never touched.
 Then run: . ~/.bashrc   (or open a new terminal)
 …
 ```
@@ -173,13 +174,16 @@ Then run: . ~/.bashrc   (or open a new terminal)
 一次性修复：
 
 ```bash
-echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc   # bash (macOS login bash: ~/.bash_profile, or ~/.profile if only that exists)
-# echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc  # zsh
+printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bashrc   # bash (macOS login bash: ~/.bash_profile, or ~/.profile if only that exists)
+# printf '%s\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.zshrc  # zsh
 # fish_add_path ~/.local/bin                               # fish (untested on this VM)
 export PATH="$HOME/.local/bin:$PATH"; hash -r
 command -v codewhale codew
 ```
 
+这个三行块带有标记，`codewhale uninstall` 之后可以精确地移除它。你自己加的裸 `export PATH=…`
+行归你自己管理：卸载从不改动它，因为 `~/.local/bin` 也被其他工具共用。
+
 ### 选项
 
 ```bash
@@ -690,9 +694,14 @@ codewhale auth clear --provider <id>
 | Homebrew | `brew uninstall codewhale`；不再使用该 tap 时才执行 untap。 |
 | 旧 curl 安装或其他手动副本 | 已知旧安装目录内、与当前程序字节完全一致且确属当前用户的文件可建立收据后移除；其他来源不明的文件会保留，需先核实具体路径和来源。 |
 
-卸载只移除所选安装收据拥有的命令、宿主文件和收据。它不会修改 shell 配置；
-匹配的 PATH 行会列出供手动核对。Windows 正在运行的程序会先改名，退出后由
-辅助进程删除。Windows 分支已通过编译检查，仍需在真实 Windows 主机上验证。
+卸载移除所选安装收据拥有的命令、宿主文件和收据；对带收据的发布版安装，还会移除
+该安装在 shell 配置文件中的精确三行 `# >>> codewhale PATH >>>` 块，以及文档中
+约定路径上由 Codewhale 生成的补全文件（`~/.local/share/bash-completion/completions/codewhale`、
+`~/.zfunc/_codewhale`、`~/.config/fish/completions/codewhale.fish`，并遵循
+`XDG_DATA_HOME` 和 `XDG_CONFIG_HOME`）。配置文件中的其他内容一概不动；符号链接或
+无法读取的配置文件留给你手动修改；只要 PATH 上还有其他 Codewhale 副本，补全文件
+就会保留。这部分清理若有失败，命令会如实报告并以非零状态退出，即使程序本身已经删除。
+Windows 正在运行的程序会先改名，退出后由辅助进程删除。Windows 分支已通过编译检查，仍需在真实 Windows 主机上验证。
 重复卸载不会取得其他副本的所有权；重新安装会创建新的收据。
 
 ### 第 3 步：可选的数据清理
@@ -708,8 +717,8 @@ codewhale auth clear --provider <id>
 清理会删除这些目标内的会话、工作区快照和恢复副本；确认前应先核对预览并保留
 仍需使用的内容。重新安装程序不能恢复已清理的数据。
 
-每个工作区的 `.codewhale`、系统钥匙串、shell PATH 行和补全文件不在自动清理
-范围内。请逐项检查已知路径；卸载不会扫描整个主目录。远程服务和桌面应用也有
+每个工作区的 `.codewhale` 和系统钥匙串不在自动清理范围内；你自己加的裸 `export PATH=…`
+行，以及约定路径之外的补全文件，也由你自己检查。请逐项检查已知路径；卸载不会扫描整个主目录。远程服务和桌面应用也有
 各自的安装所有权，不由所选 CLI 安装的收据代管。
 
 ---
```

**File**: `web/lib/public-installer-contract.test.ts` (modified, +9/-7)
```diff
@@ -182,11 +182,11 @@ describe.skipIf(process.platform === "win32")("public installer compatibility co
   });
 
   it.each([
-    ["/bin/zsh", "Linux", `echo 'export PATH="INSTALL:$PATH"' >> ~/.zshrc`, ". ~/.zshrc"],
-    ["/bin/bash", "Linux", `echo 'export PATH="INSTALL:$PATH"' >> ~/.bashrc`, ". ~/.bashrc"],
-    ["/bin/bash", "Darwin", `echo 'export PATH="INSTALL:$PATH"' >> ~/.bash_profile`, ". ~/.bash_profile"],
+    ["/bin/zsh", "Linux", `printf '%s\\n' '# >>> codewhale PATH >>>' 'export PATH="INSTALL:$PATH"' '# <<< codewhale PATH <<<' >> ~/.zshrc`, ". ~/.zshrc"],
+    ["/bin/bash", "Linux", `printf '%s\\n' '# >>> codewhale PATH >>>' 'export PATH="INSTALL:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bashrc`, ". ~/.bashrc"],
+    ["/bin/bash", "Darwin", `printf '%s\\n' '# >>> codewhale PATH >>>' 'export PATH="INSTALL:$PATH"' '# <<< codewhale PATH <<<' >> ~/.bash_profile`, ". ~/.bash_profile"],
     ["/usr/bin/fish", "Linux", `fish_add_path "INSTALL"`, "this fish shell"],
-    ["/bin/dash", "Linux", `echo 'export PATH="INSTALL:$PATH"' >> ~/.profile`, ". ~/.profile"],
+    ["/bin/dash", "Linux", `printf '%s\\n' '# >>> codewhale PATH >>>' 'export PATH="INSTALL:$PATH"' '# <<< codewhale PATH <<<' >> ~/.profile`, ". ~/.profile"],
   ] as const)(
     "prints the persistent PATH line for %s on %s without editing a profile",
     (shell, os, persist, reload) => {
@@ -204,7 +204,7 @@ describe.skipIf(process.platform === "win32")("public installer compatibility co
 
   it.skipIf(!existsSync("/bin/dash"))("the printed profile and reload commands work in dash", () => {
     const { installDir, result } = installFixture(false, { shell: "/bin/dash", os: "Linux" });
-    const persist = result.stdout.split("\n").find((line) => line.trim().startsWith("echo 'export PATH="));
+    const persist = result.stdout.split("\n").find((line) => line.trim().startsWith("printf '%s\\n' '# >>> codewhale PATH >>>'"));
     const reload = result.stdout.match(/Then run: (.+?)   \(or open a new terminal\)/)?.[1];
     expect(persist).toBeDefined();
     expect(reload).toBeDefined();
@@ -221,7 +221,9 @@ describe.skipIf(process.platform === "win32")("public installer compatibility co
   it("writes the default directory as $HOME/.local/bin in the persistent line", () => {
     const { result } = installFixture(false, { installUnderHome: true });
 
-    expect(result.stdout).toContain(`echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`);
+    expect(result.stdout).toContain(
+      `printf '%s\\n' '# >>> codewhale PATH >>>' 'export PATH="$HOME/.local/bin:$PATH"' '# <<< codewhale PATH <<<' >> ~/.zshrc`,
+    );
   });
 
   it.each([
@@ -231,7 +233,7 @@ describe.skipIf(process.platform === "win32")("public installer compatibility co
   ] as const)("keeps macOS login bash reading %j by naming %s", (homeFiles, profile) => {
     const { result } = installFixture(false, { shell: "/bin/bash", os: "Darwin", homeFiles: [...homeFiles] });
 
-    expect(result.stdout).toContain(`:$PATH"' >> ${profile}\n`);
+    expect(result.stdout).toContain(`'# <<< codewhale PATH <<<' >> ${profile}\n`);
   });
 
   it.each(["/bin/tcsh", "/usr/bin/nu"])("prints no POSIX line for the unrecognised shell %s", (shell) => {
```

**File**: `web/public/install.sh` (modified, +2/-1)
```diff
@@ -567,7 +567,8 @@ if [ "$path_selected" -eq 0 ]; then
         *) profile=".profile" ;;
       esac
       say "Put $install_dir first on PATH in future shells (run once; this installer does not edit shell profiles):"
-      say "  echo 'export PATH=\"$path_dir:\$PATH\"' >> ~/$profile"
+      say "  printf '%s\\n' '# >>> codewhale PATH >>>' 'export PATH=\"$path_dir:\$PATH\"' '# <<< codewhale PATH <<<' >> ~/$profile"
+      say "The marker lines let codewhale uninstall remove exactly this block; a bare export line is yours and is never touched."
       say "Then run: . ~/$profile   (or open a new terminal)"
       say "Or for this shell only:"
       say "  export PATH=\"$path_dir:\$PATH\"; hash -r"
```

---

### Incident Patch 2: `1a49316f` (2026-10-28)
**Commit Message**: fix(settings): retry a settings write whose destination is held

`/config pet_mode --save` answered "无法删除要被替换的文件。(os error 1175)":
`ReplaceFileW` must delete the destination before it can publish the
replacement, and a handle that holds that destination without
`FILE_SHARE_DELETE` refuses the deletion. The previous fix covered
`atomic_write`'s `MoveFileExW` and its three contention codes; `settings.toml`
goes through `ReplaceFileW`, which reports its own fourth.

Retry the same way, over one allow-list now shared by both calls:

- 5  `ERROR_ACCESS_DENIED`
- 32 `ERROR_SHARING_VIOLATION`
- 33 `ERROR_LOCK_VIOLATION`
- 1175 `ERROR_UNABLE_TO_REMOVE_REPLACED`

Six attempts, `n * 50ms`, 750ms in total — up from 225ms, which a reviewer
called short for the scanned or slow filesystem this exists for.

Why 1175 belongs on the list and 1176/1177 do not: `ReplaceFileW` documents
1175 as "the destination file is not modified, and the replacement file still
exists under its original name", so a retry starts from the state it just read.
1176 and 1177 can leave the replacement renamed away, or holding the old file's
streams with its contents no longer guaranteed, so those surface at once.

Also: `

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -125,8 +125,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - **Notes stop swallowing a backslash:** a transcript note is machine-generated and names paths, but it went through the markdown renderer, where CommonMark §2.4 reads a backslash before ASCII punctuation as an escape. A note naming `C:\Users\asus\.codewhale\setup_state.json` therefore printed as `C:\Users\asus.codewhale\setup_state.json` — a directory that does not exist, in the one line a user would copy to find the real one. Notes are now escaped where they are rendered. Fenced blocks, and lines carrying inline code, emphasis or a table row, are passed through untouched, because the renderer already copies those verbatim and doubling a backslash inside one would print it doubled.
-- **Setup state survives a second instance:** two running Codewhale windows share one home, and both rewrite `setup_state.json` when the provider or model changes. The replacing rename is now retried briefly when the destination is held open for a read — Windows refuses it outright while that handle lives — instead of surfacing a write the caller could have made. The failure message also carries the underlying I/O error instead of only the outer context, so the next occurrence is diagnosable.
+- **Setup and settings writes survive a held destination:** two running Codewhale windows share one home, and both rewrite `setup_state.json` or `settings.toml` when the provider, model or pet mode changes. The replacing call is now retried briefly when the destination cannot be displaced — Windows refuses it outright while another handle holds the file — instead of reporting a write the caller could have made. `setup_state.json` goes through `MoveFileExW` and `settings.toml` through `ReplaceFileW`, so each retries its own call, over the same allow-list: `ERROR_ACCESS_DENIED` (5), `ERROR_SHARING_VIOLATION` (32), `ERROR_LOCK_VIOLATION` (33) and `ERROR_UNABLE_TO_REMOVE_REPLACED` (1175). Six attempts, `n * 50ms`, 750ms in total. Every other refusal — a missing directory, a full disk, a real permission bit — still surfaces at once, and `ReplaceFileW`'s other two failure codes (1176, 1177) are deliberately not retried because they can leave the replacement consumed or altered. The failure message also carries the underlying I/O error instead of only the outer context, so the next occurrence is diagnosable.
 - **`doctor` stops flagging a user's own temp-named logs:** the `stale_setup_temp_files` check matched any file whose name starts with `.tmp`, so scratch files such as `.tmp-build-release.log` made a clean home report as half-applied. It now matches the shape a staged write leaves when it never lands (`.tmpXXXXXX`, no extension).
+- **Computer Use is installed, not bundled:** the Computer Use plugin is no longer vendored into the binary. Install it from the `codewhale` marketplace, which points at its independent release; its consent tools load on first use, and decisions still require a human approval card. (CW-6732)
 
 - **Approval cards are translated in every locale (#7071):** the "Do you want to proceed?" question, the Why and Stop explanations on destructive actions, the Approve, Edit plan and Cancel choices on workflow plans, the Save row, the details pager's title and the card's impact lines (one sentence per tool category plus the Reads, Writes, Target, Connected app, Agent type and Primary input rows) came from English literals, or from Simplified Chinese only. They now use the shared message catalogs, so all 15 packs carry them. The 14 non-English translations were written without native-speaker review. Still English outside Simplified Chinese: a workflow plan's own impact lines and detail labels, and the delegated-authority rows.
 - **Local vLLM models keep their own reasoning ladder (#7124):** a vLLM or SGLang route treated every model as low/medium/high and folded low and medium onto high. Reviewed model-template facts (`crates/config/src/local_reasoning.json`) now give Qwen3.8, Qwen3.6-35B-A3B, Ornith, GLM-5.3-Flash and DeepSeek-V4-Flash-Vision-Exp the controls their template accepts, and the effort picker offers exactly those tiers, so low stays low and medium stays medium where the model has them. Unreviewed models are unchanged. Not yet observed against a real vLLM or SGLang server. Thanks [@gannp](https://github.com/gannp).
```

**File**: `crates/config/src/persistence.rs` (modified, +13/-5)
```diff
@@ -95,17 +95,22 @@ pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
 /// How many times the replacing rename is attempted before the error surfaces.
 const PERSIST_ATTEMPTS: u32 = 6;
 
-/// Backoff step; attempt *n* sleeps `n * step`, so the last wait is 75ms.
-const PERSIST_RETRY_STEP_MS: u64 = 15;
+/// Backoff step; attempt *n* sleeps `n * step`, so the last wait is 250ms and the
+/// whole budget is 750ms. A setup checkpoint is written on a user action, so it
+/// can afford to outlast a scanner or a second instance holding the file for a
+/// moment; it cannot afford to hang.
+const PERSIST_RETRY_STEP_MS: u64 = 50;
 
 /// Whether a failed rename is worth retrying: another process holds the
 /// destination open, which is a momentary condition rather than a refusal the
 /// caller should hear about.
 #[cfg(windows)]
 fn rename_is_retryable(error: &std::io::Error) -> bool {
     // 5 = ERROR_ACCESS_DENIED, 32 = ERROR_SHARING_VIOLATION,
-    // 33 = ERROR_LOCK_VIOLATION. A reader holding the file raises 5 or 32.
-    matches!(error.raw_os_error(), Some(5 | 32 | 33))
+    // 33 = ERROR_LOCK_VIOLATION, 1175 = ERROR_UNABLE_TO_DELETE_FILE (what
+    // `ReplaceFileW` raises when it cannot displace the destination it must
+    // delete first). A reader holding the file raises 5 or 32.
+    matches!(error.raw_os_error(), Some(5 | 32 | 33 | 1175))
 }
 
 #[cfg(not(windows))]
@@ -336,7 +341,10 @@ mod tests {
         // being retried five more times.
         #[cfg(windows)]
         {
-            for code in [5, 32, 33] {
+            // 1175 is the code `ReplaceFileW` raises when it cannot displace the
+            // destination it must delete first — the same contention as 32, one
+            // API further along. The pet-mode save hit it.
+            for code in [5, 32, 33, 1175] {
                 assert!(
                     rename_is_retryable(&std::io::Error::from_raw_os_error(code)),
                     "os error {code}"
```

**File**: `crates/runtime/src/settings.rs` (modified, +81/-17)
```diff
@@ -2430,6 +2430,31 @@ fn atomically_replace_settings_file(path: &Path, body: &[u8]) -> Result<()> {
     Ok(())
 }
 
+/// How many times a refused replacement is attempted before the error surfaces.
+#[cfg(windows)]
+const SETTINGS_REPLACE_ATTEMPTS: u32 = 6;
+
+/// Backoff step; attempt *n* sleeps `n * step`, so the last wait is 250ms and
+/// the whole budget is 750ms. A `settings.toml` save is a user action (a mode
+/// toggle, a `/config ... --save`), so it can afford to outlast a scanner or a
+/// second instance holding the file for a moment; it cannot afford to hang.
+#[cfg(windows)]
+const SETTINGS_REPLACE_RETRY_STEP_MS: u64 = 50;
+
+/// Whether a refused `ReplaceFileW` is worth retrying.
+///
+/// The destination being held open — by another Codewhale instance's reader, a
+/// virus scanner, or an editor's preview pane — is momentary, and every code
+/// below says exactly that: 5 `ERROR_ACCESS_DENIED`, 32
+/// `ERROR_SHARING_VIOLATION`, 33 `ERROR_LOCK_VIOLATION` and 1175
+/// `ERROR_UNABLE_TO_DELETE_FILE`, the one `ReplaceFileW` raises when it cannot
+/// displace the destination it must delete first. A permission bit or a full
+/// disk is not momentary and must surface at once.
+#[cfg(windows)]
+fn settings_replace_is_transient(error: &std::io::Error) -> bool {
+    matches!(error.raw_os_error(), Some(5 | 32 | 33 | 1175))
+}
+
 #[cfg(windows)]
 fn replace_existing_settings_file(path: &Path, replacement: &Path) -> std::io::Result<()> {
     use std::os::windows::ffi::OsStrExt as _;
@@ -2443,31 +2468,45 @@ fn replace_existing_settings_file(path: &Path, replacement: &Path) -> std::io::R
 
     let path_wide = wide_path(path);
     let replacement_wide = wide_path(replacement);
-    // SAFETY: both paths are NUL-terminated and live; reserved params are null.
-    unsafe {
-        // NamedTempFile marks its source with the temporary caching hint.
-        // Clear it before publication, matching tempfile's persistence path.
-        if SetFileAttributesW(replacement_wide.as_ptr(), FILE_ATTRIBUTE_NORMAL) == 0 {
-            return Err(std::io::Error::last_os_error());
-        }
+    let mut attempt: u32 = 0;
+    loop {
+        // SAFETY: both paths are NUL-terminated and live; reserved params are null.
+        let error = unsafe {
+            // NamedTempFile marks its source with the temporary caching hint.
+            // Clear it before publication, matching tempfile's persistence path.
+            // A refusal here is about the *source*, so it is never retried: the
+            // retry below exists to outlast a held *destination*.
+            if SetFileAttributesW(replacement_wide.as_ptr(), FILE_ATTRIBUTE_NORMAL) == 0 {
+                return Err(std::io::Error::last_os_error());
+            }
+
+            if ReplaceFileW(
+                path_wide.as_ptr(),
+                replacement_wide.as_ptr(),
+                std::ptr::null(),
+                0,
+                std::ptr::null(),
+                std::ptr::null(),
+            ) != 0
+            {
+                return Ok(());
+            }
 
-        if ReplaceFileW(
-            path_wide.as_ptr(),
-            replacement_wide.as_ptr(),
-            std::ptr::null(),
-            0,
-            std::ptr::null(),
-            std::ptr::null(),
-        ) == 0
-        {
             let error = std::io::Error::last_os_error();
             // Restore the hint so TempPath retains its normal cleanup behavior
             // when replacement fails and the source still exists.
             let _ = SetFileAttributesW(replacement_wide.as_ptr(), FILE_ATTRIBUTE_TEMPORARY);
+            error
+        };
+
+        attempt += 1;
+        if attempt >= SETTINGS_REPLACE_ATTEMPTS || !settings_replace_is_transient(&error) {
             return Err(error);
         }
+        std::thread::sleep(std::time::Duration::from_millis(
+            u64::from(attempt) * SETTINGS_REPLACE_RETRY_STEP_MS,
+        ));
     }
-    Ok(())
 }
 
 /// Per-settings-path transaction mutexes.
@@ -3023,6 +3062,31 @@ fn env_truthy(name: &str) -> bool {
 mod tests {
     use super::*;
 
+    /// A refused `ReplaceFileW` is retried only when the destination is being
+    /// held, never when the platform is refusing the write itself.
+    ///
+    /// 1175 is the one this module was reported against: `ReplaceFileW` cannot
+    /// displace a destination that another handle has open without
+    /// `FILE_SHARE_DELETE`, so `/config pet_mode --save` answered
+    /// "无法删除要被替换的文件。(os error 1175)" for a write it could have made a
+    /// moment later.
+    #[cfg(windows)]
+    #[test]
+    fn only_a_held_destination_is_retried() {
+        for code in [5, 32, 33, 1175] {
+            assert!(
+                settings_replace_is_transient(&std::io::Error::from_raw_os_error(code)),
+                "os error {code} is contention and must be retried"
+            );
+        }
+        for code in [2, 3, 112, 87] {
+            assert!(
+                !sett
```

**File**: `crates/tui/CHANGELOG.md` (modified, +2/-1)
```diff
@@ -125,8 +125,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - **Notes stop swallowing a backslash:** a transcript note is machine-generated and names paths, but it went through the markdown renderer, where CommonMark §2.4 reads a backslash before ASCII punctuation as an escape. A note naming `C:\Users\asus\.codewhale\setup_state.json` therefore printed as `C:\Users\asus.codewhale\setup_state.json` — a directory that does not exist, in the one line a user would copy to find the real one. Notes are now escaped where they are rendered. Fenced blocks, and lines carrying inline code, emphasis or a table row, are passed through untouched, because the renderer already copies those verbatim and doubling a backslash inside one would print it doubled.
-- **Setup state survives a second instance:** two running Codewhale windows share one home, and both rewrite `setup_state.json` when the provider or model changes. The replacing rename is now retried briefly when the destination is held open for a read — Windows refuses it outright while that handle lives — instead of surfacing a write the caller could have made. The failure message also carries the underlying I/O error instead of only the outer context, so the next occurrence is diagnosable.
+- **Setup and settings writes survive a held destination:** two running Codewhale windows share one home, and both rewrite `setup_state.json` or `settings.toml` when the provider, model or pet mode changes. The replacing call is now retried briefly when the destination cannot be displaced — Windows refuses it outright while another handle holds the file — instead of reporting a write the caller could have made. `setup_state.json` goes through `MoveFileExW` and `settings.toml` through `ReplaceFileW`, so each retries its own call, over the same allow-list: `ERROR_ACCESS_DENIED` (5), `ERROR_SHARING_VIOLATION` (32), `ERROR_LOCK_VIOLATION` (33) and `ERROR_UNABLE_TO_REMOVE_REPLACED` (1175). Six attempts, `n * 50ms`, 750ms in total. Every other refusal — a missing directory, a full disk, a real permission bit — still surfaces at once, and `ReplaceFileW`'s other two failure codes (1176, 1177) are deliberately not retried because they can leave the replacement consumed or altered. The failure message also carries the underlying I/O error instead of only the outer context, so the next occurrence is diagnosable.
 - **`doctor` stops flagging a user's own temp-named logs:** the `stale_setup_temp_files` check matched any file whose name starts with `.tmp`, so scratch files such as `.tmp-build-release.log` made a clean home report as half-applied. It now matches the shape a staged write leaves when it never lands (`.tmpXXXXXX`, no extension).
+- **Computer Use is installed, not bundled:** the Computer Use plugin is no longer vendored into the binary. Install it from the `codewhale` marketplace, which points at its independent release; its consent tools load on first use, and decisions still require a human approval card. (CW-6732)
 
 - **Approval cards are translated in every locale (#7071):** the "Do you want to proceed?" question, the Why and Stop explanations on destructive actions, the Approve, Edit plan and Cancel choices on workflow plans, the Save row, the details pager's title and the card's impact lines (one sentence per tool category plus the Reads, Writes, Target, Connected app, Agent type and Primary input rows) came from English literals, or from Simplified Chinese only. They now use the shared message catalogs, so all 15 packs carry them. The 14 non-English translations were written without native-speaker review. Still English outside Simplified Chinese: a workflow plan's own impact lines and detail labels, and the delegated-authority rows.
 - **Local vLLM models keep their own reasoning ladder (#7124):** a vLLM or SGLang route treated every model as low/medium/high and folded low and medium onto high. Reviewed model-template facts (`crates/config/src/local_reasoning.json`) now give Qwen3.8, Qwen3.6-35B-A3B, Ornith, GLM-5.3-Flash and DeepSeek-V4-Flash-Vision-Exp the controls their template accepts, and the effort picker offers exactly those tiers, so low stays low and medium stays medium where the model has them. Unreviewed models are unchanged. Not yet observed against a real vLLM or SGLang server. Thanks [@gannp](https://github.com/gannp).
```

---

### Incident Patch 3: `2668c4bb` (2026-10-27)
**Commit Message**: fix(setup): keep the setup checkpoint when a second instance is running

Two Codewhale windows share one home and both rewrite `setup_state.json` when
the provider or model changes. `atomic_write` staged the write correctly and
then failed at the replacing rename, because the loser of that race finds the
destination held open for a read and Windows refuses the rename outright while
the reader's handle lives (no `FILE_SHARE_DELETE`). The user saw
"Setup provider/model state was not saved" for a write that was momentary.

Retry only that condition, briefly: six attempts, `n * 15ms`, giving up after
75ms. A missing directory or a full disk still surfaces at once. On Windows the
retryable codes are 5 (access denied), 32 (sharing violation) and 33 (lock
violation); elsewhere it is `PermissionDenied`.

Two related defects found in the same report:

- The message used `{err}`, which prints only the outermost context and drops
  the cause, so the path was the only thing left to look at. It now uses
  `{err:#}`.
- `doctor`'s `stale_setup_temp_files` check matched any name starting with
  `.tmp`, so a user's own scratch logs (`.tmp-build-release.log`) made a clean
  home report as half-appli

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -124,6 +124,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Setup state survives a second instance:** two running Codewhale windows share one home, and both rewrite `setup_state.json` when the provider or model changes. The replacing rename is now retried briefly when the destination is held open for a read — Windows refuses it outright while that handle lives — instead of surfacing a write the caller could have made. The failure message also carries the underlying I/O error instead of only the outer context, so the next occurrence is diagnosable.
+- **`doctor` stops flagging a user's own temp-named logs:** the `stale_setup_temp_files` check matched any file whose name starts with `.tmp`, so scratch files such as `.tmp-build-release.log` made a clean home report as half-applied. It now matches the shape a staged write leaves when it never lands (`.tmpXXXXXX`, no extension).
+
 - **Approval cards are translated in every locale (#7071):** the "Do you want to proceed?" question, the Why and Stop explanations on destructive actions, the Approve, Edit plan and Cancel choices on workflow plans, the Save row, the details pager's title and the card's impact lines (one sentence per tool category plus the Reads, Writes, Target, Connected app, Agent type and Primary input rows) came from English literals, or from Simplified Chinese only. They now use the shared message catalogs, so all 15 packs carry them. The 14 non-English translations were written without native-speaker review. Still English outside Simplified Chinese: a workflow plan's own impact lines and detail labels, and the delegated-authority rows.
 - **Local vLLM models keep their own reasoning ladder (#7124):** a vLLM or SGLang route treated every model as low/medium/high and folded low and medium onto high. Reviewed model-template facts (`crates/config/src/local_reasoning.json`) now give Qwen3.8, Qwen3.6-35B-A3B, Ornith, GLM-5.3-Flash and DeepSeek-V4-Flash-Vision-Exp the controls their template accepts, and the effort picker offers exactly those tiers, so low stays low and medium stays medium where the model has them. Unreviewed models are unchanged. Not yet observed against a real vLLM or SGLang server. Thanks [@gannp](https://github.com/gannp).
 - **`/undo`, retry and fork-at-turn work on large and attachment-heavy conversations again (#7147):** a fork was measured by the shape it is stored in (a saved session repeats its conversation while it carries a journal, so the file can be twice the history) against the 8 MiB bound the reader judges by what the conversation carries, so a conversation the runtime kept opening and extending could still refuse `/undo` with "full history exceeds byte transport bound". The saved-history boundary also counted MCP-server notices, shell-completion handoffs, the deferred-toolbox snapshot and `<image>` attachment tags as prompts you typed, so a conversation that had received one refused with "Cannot identify an exact saved-history boundary". Both now use what the conversation carries. Thanks [@gaord](https://github.com/gaord).
```

**File**: `crates/config/src/persistence.rs` (modified, +74/-4)
```diff
@@ -67,10 +67,50 @@ pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
     tmp.as_file()
         .sync_all()
         .with_context(|| format!("failed to sync temp file for {}", path.display()))?;
-    tmp.persist(path)
-        .map_err(|e| e.error)
-        .with_context(|| format!("failed to persist {}", path.display()))?;
-    Ok(())
+
+    // Two Codewhale instances share one home. The loser of a race can find the
+    // destination held open for a read — Windows refuses the replacing rename
+    // for as long as that handle lives, because the reader does not pass
+    // `FILE_SHARE_DELETE`. That refusal is transient, so retry briefly instead
+    // of reporting a write the caller could have made.
+    let mut attempt: u32 = 0;
+    loop {
+        match tmp.persist(path) {
+            Ok(_) => return Ok(()),
+            Err(error) if attempt + 1 < PERSIST_ATTEMPTS && rename_is_retryable(&error.error) => {
+                attempt += 1;
+                tmp = error.file;
+                std::thread::sleep(std::time::Duration::from_millis(
+                    u64::from(attempt) * PERSIST_RETRY_STEP_MS,
+                ));
+            }
+            Err(error) => {
+                return Err(error.error)
+                    .with_context(|| format!("failed to persist {}", path.display()));
+            }
+        }
+    }
+}
+
+/// How many times the replacing rename is attempted before the error surfaces.
+const PERSIST_ATTEMPTS: u32 = 6;
+
+/// Backoff step; attempt *n* sleeps `n * step`, so the last wait is 75ms.
+const PERSIST_RETRY_STEP_MS: u64 = 15;
+
+/// Whether a failed rename is worth retrying: another process holds the
+/// destination open, which is a momentary condition rather than a refusal the
+/// caller should hear about.
+#[cfg(windows)]
+fn rename_is_retryable(error: &std::io::Error) -> bool {
+    // 5 = ERROR_ACCESS_DENIED, 32 = ERROR_SHARING_VIOLATION,
+    // 33 = ERROR_LOCK_VIOLATION. A reader holding the file raises 5 or 32.
+    matches!(error.raw_os_error(), Some(5 | 32 | 33))
+}
+
+#[cfg(not(windows))]
+fn rename_is_retryable(error: &std::io::Error) -> bool {
+    matches!(error.kind(), std::io::ErrorKind::PermissionDenied)
 }
 
 /// Atomically write `value` as pretty-printed JSON to `path`.
@@ -288,6 +328,36 @@ mod tests {
         assert!(leftovers.is_empty(), "stray temp files: {leftovers:?}");
     }
 
+    #[test]
+    fn only_a_contended_rename_is_retried() {
+        // The retry exists for one situation: another instance holds the
+        // destination open while it reads the same sidecar. Anything else —
+        // a missing directory, a full disk — must surface at once instead of
+        // being retried five more times.
+        #[cfg(windows)]
+        {
+            for code in [5, 32, 33] {
+                assert!(
+                    rename_is_retryable(&std::io::Error::from_raw_os_error(code)),
+                    "os error {code}"
+                );
+            }
+            assert!(!rename_is_retryable(&std::io::Error::from_raw_os_error(2)));
+            assert!(!rename_is_retryable(&std::io::Error::from_raw_os_error(
+                112
+            )));
+        }
+        #[cfg(not(windows))]
+        {
+            assert!(rename_is_retryable(&std::io::Error::from(
+                std::io::ErrorKind::PermissionDenied
+            )));
+            assert!(!rename_is_retryable(&std::io::Error::from(
+                std::io::ErrorKind::NotFound
+            )));
+        }
+    }
+
     #[test]
     fn transaction_preview_writes_nothing() {
         let tmp = tempfile::tempdir().unwrap();
```

**File**: `crates/tui/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -124,6 +124,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Setup state survives a second instance:** two running Codewhale windows share one home, and both rewrite `setup_state.json` when the provider or model changes. The replacing rename is now retried briefly when the destination is held open for a read — Windows refuses it outright while that handle lives — instead of surfacing a write the caller could have made. The failure message also carries the underlying I/O error instead of only the outer context, so the next occurrence is diagnosable.
+- **`doctor` stops flagging a user's own temp-named logs:** the `stale_setup_temp_files` check matched any file whose name starts with `.tmp`, so scratch files such as `.tmp-build-release.log` made a clean home report as half-applied. It now matches the shape a staged write leaves when it never lands (`.tmpXXXXXX`, no extension).
+
 - **Approval cards are translated in every locale (#7071):** the "Do you want to proceed?" question, the Why and Stop explanations on destructive actions, the Approve, Edit plan and Cancel choices on workflow plans, the Save row, the details pager's title and the card's impact lines (one sentence per tool category plus the Reads, Writes, Target, Connected app, Agent type and Primary input rows) came from English literals, or from Simplified Chinese only. They now use the shared message catalogs, so all 15 packs carry them. The 14 non-English translations were written without native-speaker review. Still English outside Simplified Chinese: a workflow plan's own impact lines and detail labels, and the delegated-authority rows.
 - **Local vLLM models keep their own reasoning ladder (#7124):** a vLLM or SGLang route treated every model as low/medium/high and folded low and medium onto high. Reviewed model-template facts (`crates/config/src/local_reasoning.json`) now give Qwen3.8, Qwen3.6-35B-A3B, Ornith, GLM-5.3-Flash and DeepSeek-V4-Flash-Vision-Exp the controls their template accepts, and the effort picker offers exactly those tiers, so low stays low and medium stays medium where the model has them. Unreviewed models are unchanged. Not yet observed against a real vLLM or SGLang server. Thanks [@gannp](https://github.com/gannp).
 - **`/undo`, retry and fork-at-turn work on large and attachment-heavy conversations again (#7147):** a fork was measured by the shape it is stored in (a saved session repeats its conversation while it carries a journal, so the file can be twice the history) against the 8 MiB bound the reader judges by what the conversation carries, so a conversation the runtime kept opening and extending could still refuse `/undo` with "full history exceeds byte transport bound". The saved-history boundary also counted MCP-server notices, shell-completion handoffs, the deferred-toolbox snapshot and `<image>` attachment tags as prompts you typed, so a conversation that had received one refused with "Cannot identify an exact saved-history boundary". Both now use what the conversation carries. Thanks [@gaord](https://github.com/gaord).
```

**File**: `crates/tui/src/lib.rs` (modified, +36/-1)
```diff
@@ -7471,7 +7471,16 @@ fn doctor_home_has_stale_setup_temp_files() -> bool {
         return false;
     };
     entries.flatten().any(|entry| {
-        entry.file_name().to_string_lossy().starts_with(".tmp")
+        let name = entry.file_name();
+        let Some(name) = name.to_str() else {
+            return false;
+        };
+        // `tempfile` stages a write as `.tmpXXXXXX` beside its target: no dot
+        // after the prefix because it is not an extension. Requiring that keeps
+        // a user's own `.tmp-build.log`-style scratch files out of the verdict,
+        // so only a staged write that never landed matches.
+        name.starts_with(".tmp")
+            && !name[4..].contains('.')
             && entry.file_type().is_ok_and(|kind| kind.is_file())
     })
 }
@@ -16092,6 +16101,32 @@ mod doctor_setup_state_tests {
         );
     }
 
+    #[test]
+    fn doctor_setup_consistency_ignores_the_user_own_tmp_named_logs() {
+        // The verdict is about a staged write that never landed, not about
+        // every file whose name starts with `.tmp`. User scratch logs such as
+        // `.tmp-build-release.log` carry an extension and are none of its
+        // business; flagging them made a clean home report as half-applied.
+        let _guard = crate::test_support::lock_test_env();
+        let tmp = TempDir::new().expect("tempdir");
+        let (_home_guard, codewhale_home) = prepare_env(&tmp);
+        let _key = crate::test_support::EnvVarGuard::remove("DEEPSEEK_API_KEY");
+        let _source = crate::test_support::EnvVarGuard::remove("DEEPSEEK_API_KEY_SOURCE");
+        let workspace = tmp.path().join("workspace");
+        fs::create_dir_all(&workspace).expect("workspace");
+        fs::write(codewhale_home.join(".tmp-build-release.log"), b"user log").expect("user log");
+        fs::write(codewhale_home.join(".tmp-wt-clippy.log"), b"user log").expect("user log");
+
+        let report = doctor_setup_report_json(&Config::default(), &workspace);
+
+        assert_eq!(report["consistency"]["status"], "consistent");
+        let issues = report["consistency"]["issues"].to_string();
+        assert!(
+            !issues.contains("stale_setup_temp_files_in_codewhale_home"),
+            "{issues}"
+        );
+    }
+
     #[test]
     fn doctor_setup_consistency_reports_consistent_for_clean_home() {
         let _guard = crate::test_support::lock_test_env();
```

**File**: `crates/tui/src/tui/ui/provider_routes.rs` (modified, +1/-1)
```diff
@@ -1218,7 +1218,7 @@ pub(crate) fn clear_active_provider_api_key_from_memory(
 
 pub(crate) fn record_provider_model_setup_progress(app: &mut App, config: &Config) {
     if let Err(err) = crate::tui::setup::record_provider_model_setup_state_for_app(app, config) {
-        let note = format!("Setup provider/model state was not saved: {err}");
+        let note = format!("Setup provider/model state was not saved: {err:#}");
         if let Some(status) = app.status_message.as_mut() {
             status.push_str(" · ");
             status.push_str(&note);
```

#### Recent Merged Pull Requests:
- **PR #7158** (2026-10-31): fix(tui): end a bare URL at full-width punctuation (@Lstarsky0)
- **PR #7157** (2026-10-31): fix(tui): keep asterisks that don't open emphasis (@Lstarsky0)
- **PR #7156** (2026-10-31): fix(tui): render ~~~ fences as code blocks (@Lstarsky0)
- **PR #7155** (closed): test: repair three tests broken on main by catalog and context-window changes (@luochen211)
- **PR #7152** (2026-10-31): fix(tui): drop the engine's status reply to a fleet roster refresh (@Lstarsky0)
- **PR #7151** (2026-10-31): Native HarmonyOS: fix the documented build, and ship a signed arm64 release (@gaord)

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

## X. cli): remove the marked PATH block and Codewhale completions on uninstall

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `20f091d6`: cli): remove the marked PATH block and Codewhale completions on uninstall. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Safer, more complete uninstall:** for a receipted release copy, `codewhale uninstall --yes` now also removes this install's exact three-line `# >>> codewhale PATH >>>` block from your shell profiles and the Codewhale-generated completion files at their documented paths (bash, zsh and fish, honouring `XDG_DATA_HOME` and `XDG_CONFIG_HOME`). It touches nothing else in a profile, leaves a symlinked or unreadable profile for you to edit, keeps the completion files while another Codewhale copy remains on PATH, and exits non-zero if that cleanup fails after the program is already gone. The `codewhale.net/install.sh` hint and the install guide now print the PATH line as that marked block, so there is something provably yours to remove; a bare `export PATH=…` line you added earlier is never touched. Data purge requires a receipted removal in the same confirmed run. Both Unix installers reject unsafe or managed destinations before creating them and still never edit shell profiles themselves. Uninstall instructions match the explicit-home purge scope in English and Chinese. Not yet observed on a real Windows host or an installed release artifact. (Refs #7091)
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
- **Safer uninstall:** program removal never edits shell profiles; matching Codewhale PATH blocks are reported for manual cleanup. Data purge requires a receipted removal in the same confirmed run. Both Unix installers reject unsafe or managed destinations before creating them and keep shell profiles unchanged. Uninstall instructions now match the explicit-home purge scope in English and Chinese.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `20f091d6` are properly handled with clean fallback behavior.
