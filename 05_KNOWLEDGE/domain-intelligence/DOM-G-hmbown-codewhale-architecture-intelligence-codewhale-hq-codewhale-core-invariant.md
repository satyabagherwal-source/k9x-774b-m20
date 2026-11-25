# Domain G — Architecture Intelligence: Architecture Intelligence: codewhale-hq/Codewhale Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/Hmbown/Codewhale",
  "source_version": "b4f71726",
  "license": "MIT",
  "timestamp": "2026-11-25T06:47:44.167Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/Hmbown/Codewhale) (Revision: `b4f71726`).  
> **License**: MIT | **Timestamp**: `2026-11-25T06:47:44.167Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence)
- **Confidence Rating**: 56%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from codewhale-hq/Codewhale:

# Forensic Learning Record (Deep Inspection): codewhale-hq/Codewhale

> **Canonical Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T06:47:43.356Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source Rust coding agent for terminal, web, and desktop. Any model, multi-agent fleets, MCP & plugins, OS sandboxing, and session receipts.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41205 stars

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
- **Issue #7557** (2026-11-24): **fix(tui): use the engine catalog effort parser and add the Ollama Cloud effort ladder**
  *Symptoms*: The model picker had its own catalog-token parser (`catalog_effort_value`) duplicating one the engine already owns.  - Use `ReasoningEffort::from_catalog_token` and `ReasoningEffort::catalog_effort_values_for_offering` instead, and always keep `Auto` first in the resulting list. - Add an explicit Ollama Cloud effort ladder (`Auto`, `Off`, `Low`, `Medium`, `High`, `Max`).  Rebased onto current `main`. The branch's separate skills commit was dropped: that work is already on `main` via #7544, and re-applying it would have reverted the merged version.  Net effect: `crates/tui/src/tui/model_picker.rs`, one file. <!-- devin-review-badge-begin -->  ---  <a href="https://app.devin.ai/review/codewhale-hq/codewhale/pull/7557" target="_blank"><picture><source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-devin-review-dark.svg?v=4"><img src="https://static.devin.ai/assets/gh-devin-review-light.svg?v=4" alt="Devin Review"></picture></a> <!-- devin-review-badge-end -->
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"942707f524abff1409e2682fc600857967ae4775","has_any_findings":true,"has_unresolved_findings":true,"status":"failed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  <details> <summary><strong>Codex Review Summary</strong>: ❌ Failed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ❌ **Failed** <relative-time datetime="2026-11-24T19:35:39.042376Z">2026-11-24T19:35:39.042376Z</relative-time><br/>We couldn’t complete this review. Comment `@codex review` to try again. | `942707f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when yo
  > You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage). To continue using code reviews, add credits to your account and enable them for code reviews in your [settings](https://chatgpt.com/settings/code-review).

- **Issue #7555** (2026-11-24): **fix(security): hardening batch — grants, secrets, runtime probes, execpolicy deny bypasses**
  *Symptoms*: Security hardening for 0.10.5, rebased onto current `main` (four commits already landed there, including the CodeQL fixes, dropped out):  - Fail closed on grant/posture persist failures and redact tool logs. - Harden the runtime bundle secrets path, URL redaction and webhook TLS. - Harden the remote runtime probe against loopback and metadata targets. - Harden read-only and auto-approved git commands against repo config helpers. - Reject elevated automation permissions and unattended full-access dispatch. - Port 7 execpolicy deny-bypass fixes (from #7397) and fail closed on dynamic `PermitLocalCommand` and unsplit `screen -X`. - Stabilise heartbeat and unbound-thread respawn flakes (CW-8242), gate unix-only test imports on Windows, gate the unix-only `is_secret_env` binding in the remote_setup bundle. - Record post-0.10.4 contributor credits and the unreleased changelog.  Net effect: 30 files, +2432/−281.  Rebased onto current `main`; the one conflicting hunk (`config/tests.rs`, `Runtime` vs `Full` env policy) was resolved in favour of `main`, where that repair already landed. <!-- devin-review-badge-begin -->  ---  <a href="https://app.devin.ai/review/codewhale-hq/codewhale/pull/7555" target="_blank"><picture><source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-devin-review-dark.svg?v=4"><img src="https://static.devin.ai/assets/gh-devin-review-light.svg?v=4" alt="Devin Review"></picture></a> <!-- devin-review-badge-end -->

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

### Incident Patch 1: `3235e2ec` (2026-11-24)
**Commit Message**: docs(dsh,release): record 0.10.5 DSH qualification, restore credits, and fix web tests

- Refresh docs/DSH_COMPATIBILITY.md and docs/DSH_PLUGIN_COMPAT.md with verified 0.10.5 source-build receipts (13/33 pinned full local lifecycle, 3/33 pinned BLOCKED, 17/33 npm-approval gated, 0 scan-limit failures; 15/36 direct extension-host cold-activate; codewhale web shared-dist HTTP 200).
- Consolidate CHANGELOG.md [Unreleased], restore @Goldloli (#7521), @jperla (#7350 TrustedRouter), @WTFitsmemyself (#7496), and @Serendo (#7451, Refs #6225, #6418) receipts with zero §284 forbidden mentions, and sync crates/tui/CHANGELOG.md.
- Fix all 3 web.yml test failures: export gt-catalog/{en,zh}.json, align docs/public-surface-facts.json sourceCandidate telemetry version (0.10.4 pre-bump) and public-surface-contract.test.ts policy notice version 6, and filter agent-docs.test.ts mainOnly lines against released snapshot text so paragraph re-wraps do not false-positive.

Checks:
- §284 forbidden grep: 0 matches
- python3 scripts/check-contributor-credit.py: PASS (10/10 contributors)
- ./scripts/release/check-versions.sh --range-audit-advisory: PASS (4/4 linked issue receipts, workspace=0.10.4)
- sh scri

**File**: `CHANGELOG.md` (modified, +9/-21)
```diff
@@ -10,44 +10,32 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Added
 
 - **DSH P1/P2 host shims, client frame allowlist, and seat table lockstep:** added `@deepseek-ai/dsh-agent` and `@deepseek-ai/dsh-app-boot` module singletons plus read-only/owner-scoped `sessionPersistence`, `storageDomain`, `invariants`, and `permissionPresets` services in the extension host (keeping all mutating/escalation paths fail-closed); admitted `@deepseek-ai/dsh-settings`, `@deepseek-ai/dsh-tools`, and `@deepseek-ai/dsh-credentials` in `DSH_FRAME_MODULES`, synced `DSH_SEAT_TABLE` with desktop DSH slot aliases, and listed `npm:`/`git:`/`dsh:` sources in the plugin install error hint (§280).
+- **Serve the shared web app build from `codewhale web`:** `codewhale web` now serves a built `codewhale-app/apps/web/dist` directory when `CODEWHALE_WEB_DIST` points to a valid directory containing `index.html`, including `/plugin-host.html` (with sandboxed `connect-src 'none'` / `frame-ancestors 'self'` CSP), immutable `/static/*` hashed assets, bounded SPA route fallback, path-traversal/symlink refusal, and preserved auth-bootstrap cookie sessions; falls back to the embedded web client when unset. (#7237)
+- **Choose an external ACP agent in the terminal:** `/model` now lists installed external ACP agents (`antigravity`, `opencode`, `copilot`, `dsh`, and others) alongside Codewhale models, showing why non-runnable agents are blocked and what to run, and `codewhale --agent <id>` / `codewhale exec --agent <id>` starts an interactive or headless session through the Engine ACP executor. (CW-8361)
 - **Verified candidate evaluator for experimental search workflows:** `workflows/operate_best_of_n.workflow.js` now supports an optional host-owned `args.evaluator` (`task.verifyCandidate`) that freezes a clean Git baseline, seals candidate diffs, and replays public and held-out gates inside Linux bubblewrap with `proposal_only` receipts. Thanks [@axobase001](https://github.com/axobase001). (#7294)
+- **TrustedRouter bundled provider and inclusion bar:** added `TrustedRouter` (`trustedrouter`, `TRUSTEDROUTER_API_KEY`) as a bundled OpenAI-compatible provider and documented the bundled-provider inclusion bar. Thanks [@jperla](https://github.com/jperla). (#7350)
+- **Simplified Chinese Auto-Review documentation:** added `docs/zh_hans/AUTO_REVIEW.md` covering Auto-Review posture, approval flow, and configuration. Thanks [@Goldloli](https://github.com/Goldloli). (#7521)
+
 ### Changed
 
 - **Full Access is selected through `Shift+Tab` instead of the legacy yolo-compat funnel:** removed `Alt+Y`, `Alt+Shift+Y`, and the `/mode yolo|bypass|4` permission shortcut; `/mode yolo` now points to `Shift+Tab` (or `/auto`), and `/zidong` is now an alias for `/auto` (Auto-Review). Launch flags (`--yolo`, `--full-access`, `CODEWHALE_YOLO`, `default_mode = "yolo"`) keep their startup behavior.
+- **Test-only Fleet methods gated behind `#[cfg(test)]`:** gated the five remaining test-only `pub` methods in `crates/engine/src/fleet/` (`FleetLedger::{claim_next,record_alert,mark_task_terminal_status_if_unchanged}`, `FleetScheduler::cancel_run`, `FleetExecutor::all_terminal`) under `#[cfg(test)]` so production builds expose no unused Fleet helpers. Thanks [@luochen211](https://github.com/luochen211). (Refs #7270)
+- **Updated `0.10.5` DSH compatibility documentation:** refreshed `docs/DSH_COMPATIBILITY.md` and `docs/DSH_PLUGIN_COMPAT.md` with verified `0.10.5` pinned 33-row Engine lifecycle receipts (13 full local lifecycle, 3 pinned blocked, 17 npm-approval gated, 0 scan-limit failures), 15/36 direct extension-host cold-activate results, and `codewhale web` loopback dist verification (§280).
 
 ### Fixed
 
+- **Adopt a populated Runtime store on session switch:** switching sessions in the TUI now adopts an already-populated Runtime session store instead of dropping live Runtime thread state. Thanks [@Serendo](https://github.com/Serendo). (#7451, Refs #6225, #6418)
+- **Treat `find -delete` as a destructive action in execution policy:** `execpolicy` now classifies `find ... -delete` as destructive so Auto-Review and Ask postures gate it consistently. Thanks [@WTFitsmemyself](https://github.com/WTFitsmemyself). (#7496)
 - **Composer vim mode no longer swallows typing after pressing `v`:** removed the unfinished `VimMode::Visual` state that absorbed all keys until `Esc` with no on-screen indicator or operators.
 - **Lone non-ASCII keys now reach normal key routing on untrusted terminals:** single IME/non-ASCII commits in paste-burst detection keep their Enter-suppression window while falling through to the main key match (vim Normal mode, Esc-Esc backtrack reset, and ordinary insertion) instead of bypassing it.
 - **Launch-card resume always opens confirmation from mouse and keyboard:** unified mouse and keyboard launch-action dispatchers into one `apply_launch_action` path and removed the unreachable direct-resume mouse arm.
-### Adde
```

**File**: `crates/tui/CHANGELOG.md` (modified, +9/-21)
```diff
@@ -10,44 +10,32 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Added
 
 - **DSH P1/P2 host shims, client frame allowlist, and seat table lockstep:** added `@deepseek-ai/dsh-agent` and `@deepseek-ai/dsh-app-boot` module singletons plus read-only/owner-scoped `sessionPersistence`, `storageDomain`, `invariants`, and `permissionPresets` services in the extension host (keeping all mutating/escalation paths fail-closed); admitted `@deepseek-ai/dsh-settings`, `@deepseek-ai/dsh-tools`, and `@deepseek-ai/dsh-credentials` in `DSH_FRAME_MODULES`, synced `DSH_SEAT_TABLE` with desktop DSH slot aliases, and listed `npm:`/`git:`/`dsh:` sources in the plugin install error hint (§280).
+- **Serve the shared web app build from `codewhale web`:** `codewhale web` now serves a built `codewhale-app/apps/web/dist` directory when `CODEWHALE_WEB_DIST` points to a valid directory containing `index.html`, including `/plugin-host.html` (with sandboxed `connect-src 'none'` / `frame-ancestors 'self'` CSP), immutable `/static/*` hashed assets, bounded SPA route fallback, path-traversal/symlink refusal, and preserved auth-bootstrap cookie sessions; falls back to the embedded web client when unset. (#7237)
+- **Choose an external ACP agent in the terminal:** `/model` now lists installed external ACP agents (`antigravity`, `opencode`, `copilot`, `dsh`, and others) alongside Codewhale models, showing why non-runnable agents are blocked and what to run, and `codewhale --agent <id>` / `codewhale exec --agent <id>` starts an interactive or headless session through the Engine ACP executor. (CW-8361)
 - **Verified candidate evaluator for experimental search workflows:** `workflows/operate_best_of_n.workflow.js` now supports an optional host-owned `args.evaluator` (`task.verifyCandidate`) that freezes a clean Git baseline, seals candidate diffs, and replays public and held-out gates inside Linux bubblewrap with `proposal_only` receipts. Thanks [@axobase001](https://github.com/axobase001). (#7294)
+- **TrustedRouter bundled provider and inclusion bar:** added `TrustedRouter` (`trustedrouter`, `TRUSTEDROUTER_API_KEY`) as a bundled OpenAI-compatible provider and documented the bundled-provider inclusion bar. Thanks [@jperla](https://github.com/jperla). (#7350)
+- **Simplified Chinese Auto-Review documentation:** added `docs/zh_hans/AUTO_REVIEW.md` covering Auto-Review posture, approval flow, and configuration. Thanks [@Goldloli](https://github.com/Goldloli). (#7521)
+
 ### Changed
 
 - **Full Access is selected through `Shift+Tab` instead of the legacy yolo-compat funnel:** removed `Alt+Y`, `Alt+Shift+Y`, and the `/mode yolo|bypass|4` permission shortcut; `/mode yolo` now points to `Shift+Tab` (or `/auto`), and `/zidong` is now an alias for `/auto` (Auto-Review). Launch flags (`--yolo`, `--full-access`, `CODEWHALE_YOLO`, `default_mode = "yolo"`) keep their startup behavior.
+- **Test-only Fleet methods gated behind `#[cfg(test)]`:** gated the five remaining test-only `pub` methods in `crates/engine/src/fleet/` (`FleetLedger::{claim_next,record_alert,mark_task_terminal_status_if_unchanged}`, `FleetScheduler::cancel_run`, `FleetExecutor::all_terminal`) under `#[cfg(test)]` so production builds expose no unused Fleet helpers. Thanks [@luochen211](https://github.com/luochen211). (Refs #7270)
+- **Updated `0.10.5` DSH compatibility documentation:** refreshed `docs/DSH_COMPATIBILITY.md` and `docs/DSH_PLUGIN_COMPAT.md` with verified `0.10.5` pinned 33-row Engine lifecycle receipts (13 full local lifecycle, 3 pinned blocked, 17 npm-approval gated, 0 scan-limit failures), 15/36 direct extension-host cold-activate results, and `codewhale web` loopback dist verification (§280).
 
 ### Fixed
 
+- **Adopt a populated Runtime store on session switch:** switching sessions in the TUI now adopts an already-populated Runtime session store instead of dropping live Runtime thread state. Thanks [@Serendo](https://github.com/Serendo). (#7451, Refs #6225, #6418)
+- **Treat `find -delete` as a destructive action in execution policy:** `execpolicy` now classifies `find ... -delete` as destructive so Auto-Review and Ask postures gate it consistently. Thanks [@WTFitsmemyself](https://github.com/WTFitsmemyself). (#7496)
 - **Composer vim mode no longer swallows typing after pressing `v`:** removed the unfinished `VimMode::Visual` state that absorbed all keys until `Esc` with no on-screen indicator or operators.
 - **Lone non-ASCII keys now reach normal key routing on untrusted terminals:** single IME/non-ASCII commits in paste-burst detection keep their Enter-suppression window while falling through to the main key match (vim Normal mode, Esc-Esc backtrack reset, and ordinary insertion) instead of bypassing it.
 - **Launch-card resume always opens confirmation from mouse and keyboard:** unified mouse and keyboard launch-action dispatchers into one `apply_launch_action` path and removed the unreachable direct-resume mouse arm.
-### Adde
```

**File**: `docs/DSH_COMPATIBILITY.md` (modified, +91/-70)
```diff
@@ -1,39 +1,52 @@
 # Published DeepSeek Harness packages in Codewhale
 
-Of the 32 published DeepSeek Harness packages we tried unmodified, 2
-activate in the Codewhale terminal with the default network policy.
-`@michengai/dsh-code-review` 1.0.9 registers its `dsh_code_review` tool and
-three commands, and its tool ran end to end in one terminal turn against a
-scripted local model: the plugin was called, started its reviewer sub-agent
-and returned its report. Review quality with a real model was not tested.
-`dsh-anchored-standard` 1.2.1 activates and registers nothing. A third,
-`dsh-plugin-model-proxy` 0.1.6, activates once `registry.npmjs.org` is allowed
-and registers nothing. The other 29 do not activate; each now reports the
-service, module or export it is missing, or stops at import review and says
-why.
-
-This page lists every published DeepSeek Harness (DSH) package we tried,
-unmodified, in the terminal. The services and limits behind each row are in
+On the `0.10.5` source build (`6f093967ae3`, macOS arm64, default network
+policy, no model provider calls):
+
+- **Pinned 33-row Engine lifecycle (`dsh_acceptance.py run`):** **13 of 33**
+  packages pass every local Engine lifecycle step (`admission.preview`,
+  `install`, `trust`, `enable`, `restart_retained`, `revoke`, `uninstall`, and
+  `security.no_key_leak`; provider and desktop slot steps remain `UNAVAILABLE`),
+  **3 of 33** match their pinned `BLOCKED` admission refusals
+  (`dsh-agent-squad`, `dsh-im`, `dsh-archive-manager`), and **17 of 33** stop
+  cleanly at `registry.npmjs.org` network approval (**0** stop at the 2 MiB
+  scan limit).
+- **Direct extension-host cold-activate (all 36 surveyed tarballs, without
+  `npm install`):** **15 of 36** activate cleanly in the extension host,
+  registering **18 tools**, **9 commands**, and **2 hooks** (`dsh-image-gen` 6
+  tools, `dsh-client-ui-task-board` 8 tools + 1 hook, `modsearch` 2 tools,
+  `modlens` 1 tool, `dsh-code-review` 1 tool + 3 commands, `dsh-btw` 3 commands
+  + 1 hook, `dsh-pet` 3 commands, plus 8 zero-registration plugins). Of the
+  remaining 21: **14** fail only on missing third-party npm packages in the raw
+  tarball (zero missing `@deepseek-ai/*` peers prior to npm staging), **6** hit
+  explicit policy or runtime boundaries, and **1** (`dsh-web-ui`) has no server
+  entry.
+- **Prior `0.10.3` scripted-turn check:** `@michengai/dsh-code-review` 1.0.9
+  ran its `dsh_code_review` tool end to end in one terminal turn against a
+  scripted local model (starting its reviewer sub-agent and returning its
+  report). Review quality with a real model was not tested.
+
+This page lists the published DeepSeek Harness (DSH) packages we qualified,
+unmodified, in Codewhale. The services and limits behind each row are in
 [DSH plugin compatibility](DSH_PLUGIN_COMPAT.md).
 
 ## How this was tested
 
-Built from source on 2026-11-22 (codewhale 0.10.3 dev build of this change,
-macOS arm64, Node 26.10). Each package got its own throwaway Codewhale home
-with `[features] extension_host = true`, telemetry and update checks off, and
-the provider pointed at a closed local port, so no model provider was called.
-For each package: `codewhale plugins import dsh <dir>`, `plugins import dsh
-approve <dir> <hash>`, `plugins trust <name> --review-token <token> --yes`,
-`plugins enable <name>`, then the terminal UI was started once and the
-extension host's line for the plugin was read from the log. Packages marked
-"npm approved" were run again with `registry.npmjs.org` in `allow` under
-`[network]`, which fetches their declared npm dependencies. For
-`dsh-code-review`, the terminal UI was then pointed at a local scripted
-OpenAI-compatible endpoint that asks for one `dsh_code_review` call and
-answers the reviewer sub-agent with fixed text; both approval cards (the
-plugin tool and the sub-agent start) were approved by hand. The packages are
-the SHA-256-pinned tarballs of the 0.10.3 survey. Nothing here was run on
-Windows, Linux, Bun or the desktop app.
+Built from source on 2026-11-24 (`0.10.5` wave-3 build `6f093967ae3`, macOS
+arm64, Node runtime). Two checks ran with zero model-provider calls:
+
+1. **Pinned 33-row Engine lifecycle:** `scripts/dsh-plugin-acceptance/dsh_acceptance.py`
+   (`selftest` 15/15 passed; `pins` 33/33 SHA-256 verified) drove every pinned
+   row through `/v1/apps/plugins` on a throwaway `CODEWHALE_HOME` with
+   `--enable extension_host` and default network policy (no `--allow-provider`).
+2. **Direct extension-host cold-activate:** each of the 36 SHA-256-pinned
+   survey tarballs was extracted without `npm install` and activated directly
+   against `crates/engine/extension-host/dist/codewhale-extension-host.mjs`
+   with an isolated `data_dir`.
+
+Earlier `0.10.3` npm-approved terminal checks and the scripted local-model turn
+for `dsh-code-review` are marked where carried forward. Nothing here was run on
+Windows, Linux, Bun, or live Desktop slot mounts.
 
```

**File**: `docs/DSH_PLUGIN_COMPAT.md` (modified, +12/-4)
```diff
@@ -102,6 +102,9 @@ walkthroughs below.
 | `subagents.getProvider('fork')`, `inheritsParentContext`, command `invocation.agent.session` | not provided | Not implemented |
 | `agents`, `systemPrompt` | injectable so plugins that name them activate; `agents` offers nothing and `systemPrompt` methods refuse outside a child's `agent/created` context | Verified with the child-agent probe |
 | `llm`, `credentials` | grant-gated brokered host services in `compatibility.json` v3 | Grant-gated brokered |
+| `sessionPersistence`, `storageDomain`, `invariants`, `permissionPresets` | read-only / owner-scoped `0.10.5` P1/P2 host services (bounded JSON-serializable `storageDomain` values at 64 KiB, 64-entry per-owner `invariants` cap, fail-closed on mutating/escalation paths; all 4 in `refused_services` so plugins cannot override them) | Verified by focused extension-host tests (`e42ec6f09f0`, `e5571935a95`) |
+| `@deepseek-ai/dsh-agent`, `@deepseek-ai/dsh-app-boot` | `0.10.5` P1/P2 module singletons (`assembleContextFor`, `installModelSelection`, `getDshRuntimeVersion`; fail-closed `loadProfileDirectory`, `resolveBundleDir`, `createRuntimeResolution`) | Verified by focused extension-host tests (`e42ec6f09f0`) |
+| `agentPresets`, `agentDefaultModel`, `sessionProjections`, `workspaceRegistry`, `typertGateway`, `web` | `0.10.5` read-only/scoped adapters plus pure-API module exports (`ReasoningEffortId`, `deriveEventMessage`, `KNOWN_SESSION_EVENT_TYPES`, `credentialRef`, `settingsNamespace`, `resolveDshHome`, `writeFileAtomic`, `Remote`, `TypertRemoteService`) | Verified by focused extension-host tests and `0.10.5` 36-tarball cold-activate survey (15/36 pass) |
 | `approval`, `fs`, `subprocess` | refused by design until each maps to Engine authority | Not implemented |
 | Rich or media tool output | dropped | Not implemented |
 | Git review scopes | Bounded `execFile` metadata requests use the Engine Git tool and its approval path; the Native host still cannot read the repository directly | Current-source qualification pending |
@@ -110,11 +113,13 @@ walkthroughs below.
 
 The same DSH-format probe plugin (a tool that saves the session and asks one
 question, plus two commands), run against a local fake model provider on
-macOS with no account or spend:
+macOS with no account or spend, plus the `0.10.5` loopback `codewhale web`
+dist check (`6f093967ae3`):
 
 | Surface | What was seen | Status |
 | --- | --- | --- |
-| Runtime API | preview → exact-hash install → review → trust → enable; first-turn tool; approval; question answered through `POST /v1/user-input`; command result | Verified |
+| Runtime API | preview → exact-hash install → review → trust → enable; first-turn tool; approval; question answered through `POST /v1/user-input`; command result; plus `0.10.5` pinned 33-row lifecycle (`13` full local lifecycle pass, `3` pinned `BLOCKED`, `17` npm-approval gated) | Verified |
+| `codewhale web` (`CODEWHALE_WEB_DIST`) | `GET /` HTTP 200 (byte-for-byte match with `codewhale-app/apps/web/dist/index.html`) and `GET /v1/apps/plugins` HTTP 200 on loopback (`6f093967ae3`) | Verified |
 | `codewhale exec --auto` | first-turn tool runs and saves the session; the plugin's question is refused with `NO_PROVIDER` because no person is present to answer | Verified |
 | Desktop app | the tool's approval card; the plugin's question rendered as a native card (option descriptions, your own answer, Skip, Send answers); the answer reaches the plugin; `/probe-count` in the command palette with plugin attribution | Verified (plugin installed through the Runtime API, not the app's own settings flow) |
 | Terminal UI (interactive) | — | Not walked through; its question and approval code is covered by focused tests only |
@@ -154,8 +159,11 @@ An imported DSH plugin's client UI is served, on the seats the Engine admits.
 The importer retains the reviewed client closure; at serve time the Engine
 re-verifies it byte for byte against the reviewed hashes, maps each declared
 slot key to a seat, and loads one Engine-generated bootstrap built from those
-bytes. A native client is admitted only on `customize.plugins.detail`. A slot
-key with no seat answers `plugin_ui_seat_unsupported`; several keys on one seat
+bytes. A native client is admitted only on `customize.plugins.detail`. In `0.10.5`,
+`DSH_FRAME_MODULES` admits `@deepseek-ai/dsh-settings`,
+`@deepseek-ai/dsh-tools`, and `@deepseek-ai/dsh-credentials`, and
+`DSH_SEAT_TABLE` is synced to 41 entries matching desktop `DSH_SLOT_ALIASES`
+(`5cdf092bc77`). A slot key with no seat answers `plugin_ui_seat_unsupported`; several keys on one seat
 need the caller to name one (`plugin_ui_dsh_slot_required`). A closure that needs
 a host module the frame does not provide, uses ES module syntax or is not valid
 JSON answers `plugin_ui_unsupported`. Code Review 1.0.8's client decorates
```

**File**: `docs/public-surface-facts.json` (modified, +1/-1)
```diff
@@ -198,7 +198,7 @@
     "localRuntime": "runtime, workspace state, and audit log stay on the user's machine",
     "hostedProviderBoundary": "the selected hosted provider receives turn context required for inference",
     "localInference": "a loopback local-model route can keep inference local",
-    "telemetry": "Codewhale 0.10.5 counts anonymous usage by default and discloses it at first launch (policy notice version 6, naming Codewhale as the sole first-party collector), while the earlier 0.9.11 release asked first; turning it off is a saved choice that later versions keep, an opt-out recorded under the earlier opt-in policy stays off, and showing the notice never records any acceptance on the user's behalf; Codewhale does not collect conversations, code, prompts, files, file/repo/branch names, model content, credentials, or per-turn/per-tool timelines; while on, sessions post aggregate counts and closed enums (including provider families, public catalog models, token totals, and built-in tool counts) to the first-party endpoint https://telemetry.codewhale.net/v1/telemetry, whose storage has no IP, country, or geo column and a fixed three-month retention; counts are first-party only and not forwarded to any third-party analytics processor; telemetry_endpoint = \"\" writes only to a local dry-run file; no mandatory hosted relay",
+    "telemetry": "Codewhale 0.10.4 counts anonymous usage by default and discloses it at first launch (policy notice version 6, naming Codewhale as the sole first-party collector), while the earlier 0.9.11 release asked first; turning it off is a saved choice that later versions keep, an opt-out recorded under the earlier opt-in policy stays off, and showing the notice never records any acceptance on the user's behalf; Codewhale does not collect conversations, code, prompts, files, file/repo/branch names, model content, credentials, or per-turn/per-tool timelines; while on, sessions post aggregate counts and closed enums (including provider families, public catalog models, token totals, and built-in tool counts) to the first-party endpoint https://telemetry.codewhale.net/v1/telemetry, whose storage has no IP, country, or geo column and a fixed three-month retention; counts are first-party only and not forwarded to any third-party analytics processor; telemetry_endpoint = \"\" writes only to a local dry-run file; no mandatory hosted relay",
     "account": "no account required for the local runtime",
     "plan": "Plan centrally refuses file mutation and shell execution; policy-allowed research may contact external services and local session state can still be persisted.",
     "sandbox": "Seatbelt is used on macOS when available; Linux bubblewrap is on by default once installed and verified working, and prefer_bwrap = false opts out; Windows currently reports no OS sandbox",
```

**File**: `web/gt-catalog/en.json` (modified, +1/-1)
```diff
@@ -2237,7 +2237,7 @@
               ],
               [
                 "Sent while on",
-                "Version and platform classes, session length and outcome, feature and error counts as fixed categories, and a random install id that changes every 90 days."
+                "Version and platform classes, session length and outcome, built-in provider IDs, bundled public-catalog model IDs (custom/private/local models map to \"other\"), aggregate token totals, built-in tool call and error counts, feature and error counts as fixed categories, and a random install id that changes every 90 days."
               ],
               [
                 "Where it goes",
```

**File**: `web/gt-catalog/zh.json` (modified, +1/-1)
```diff
@@ -2234,7 +2234,7 @@
               ],
               [
                 "开启时发送",
-                "版本与平台类别、会话时长与结果、以固定类别统计的功能与错误计数，以及一个每 90 天更换一次的随机安装 id。"
+                "版本与平台类别、会话时长与结果、内置提供商 ID、内置公开目录中的模型 ID（自定义/私有/本地模型记为 \"other\"）、汇总 token 数量、内置工具调用与错误计数、以固定类别统计的功能与错误计数，以及一个每 90 天更换一次的随机安装 id。"
               ],
               [
                 "发往哪里",
```

**File**: `web/lib/agent-docs.test.ts` (modified, +2/-2)
```diff
@@ -12,9 +12,9 @@ import { REPO_URL } from "./i18n/links";
 const release = FACTS.latestPublishedRelease!;
 const SNAPSHOT: typeof RELEASE_DOCS = JSON.parse(readFileSync(new URL("../data/agent-docs.release.json", import.meta.url), "utf8"));
 const SERVED = SNAPSHOT.topics.filter((topic) => topic.slug !== "install");
-const releasedLines = new Set(SNAPSHOT.topics.flatMap((topic) => topic.sources.flatMap((source) => source.content.split("\n"))));
+const releasedText = SNAPSHOT.topics.flatMap((topic) => topic.sources.map((source) => source.content)).join("\n");
 const mainOnly = [...new Set(AGENT_DOCS.filter((topic) => topic.slug !== "install").flatMap((topic) => topic.sources.flatMap((source) => source.content.split("\n"))))]
-  .filter((line) => line.trim().length >= 40 && !releasedLines.has(line));
+  .filter((line) => line.trim().length >= 40 && !releasedText.includes(line));
 
 async function topicBody(slug: string): Promise<string> {
   const topic = `${slug}.md`;
```

---

### Incident Patch 2: `7f0497a5` (2026-11-24)
**Commit Message**: fix(wave2): resolve clippy, conformance golden, strict skills test, quarantine guard, flake, and @jperla credit

- Fix clippy contains() lints in child_host.rs tests.
- Update provider_error_after_tool_call.golden.jsonl line 10 for structured ProviderFailureCause (#7328).
- Update extension_creator_skills_config_cannot_be_set_from_config_toml for #[serde(deny_unknown_fields)] on [skills].
- Align default_launch allow_shell value assertion in runtime_api tests with Config::default().
- Guard rebuild_thread_from_event_log when a pending seed journal exists so startup quarantine is preserved.
- Bump sleep 0.2 -> 0.8 in consumed_worker_exit_is_not_recorded_as_a_timeout.
- Credit @jperla (#7350) in AUTHOR_MAP, CONTRIBUTORS.md, CHANGELOG.md, and release-credits.ts; sync facts.generated.ts and crates/tui/CHANGELOG.md.

Checks:
- extension_creator_skills_config_cannot_be_set_from_config_toml: PASS
- startup_quarantines_only_the_thread_whose_seed_journal_is_uncertain: PASS
- damaged_thread_record_rebuilds_from_event_log_on_load_and_list: PASS
- settings_schema_allow_shell_reports_interactive_default_and_explicit_opt_out: PASS
- settings_schema_telemetry_config_toggle_persists_and_validates:

**File**: `.github/AUTHOR_MAP` (modified, +2/-0)
```diff
@@ -336,3 +336,5 @@ River (Codex) = axobase001 <138223345+axobase001@users.noreply.github.com>
 river@users.noreply.github.com = axobase001 <138223345+axobase001@users.noreply.github.com>
 samhandsome = SamhandsomeLee <135809116+SamhandsomeLee@users.noreply.github.com>
 samhandsome@vip.qq.com = SamhandsomeLee <135809116+SamhandsomeLee@users.noreply.github.com>
+Joseph Perla = jperla <3724+jperla@users.noreply.github.com>
+claude@jperla.com = jperla <3724+jperla@users.noreply.github.com>
```

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Cross-process item index cache and owner-only indexing:** cached the item index across processes and skipped non-owner records during indexing. Thanks [@gaord](https://github.com/gaord). (#7446, #7522)
 - **Simplified Chinese Auto-Review documentation:** added `docs/zh_hans/AUTO_REVIEW.md`. Thanks [@Goldloli](https://github.com/Goldloli). (#7521)
-- **Bundled Onomeo and AtmoRouter providers:** added Onomeo (`ONOMEO_API_KEY`, thanks [@Owaid0723666](https://github.com/Owaid0723666), #7525) and AtmoRouter (`ATMOROUTER_API_KEY`, thanks [@BeckleyTenriajeng](https://github.com/BeckleyTenriajeng), #7506) as bundled OpenAI-compatible provider descriptors.
+- **Bundled Onomeo, AtmoRouter, and TrustedRouter providers:** added Onomeo (`ONOMEO_API_KEY`, thanks [@Owaid0723666](https://github.com/Owaid0723666), #7525), AtmoRouter (`ATMOROUTER_API_KEY`, thanks [@BeckleyTenriajeng](https://github.com/BeckleyTenriajeng), #7506), and TrustedRouter (`TRUSTEDROUTER_API_KEY`, thanks [@jperla](https://github.com/jperla), #7350) as bundled OpenAI-compatible provider descriptors.
 - **One paste path in the terminal and off-thread clipboard reads:** simplified Ctrl+V handling to a single press/release edge rule and moved clipboard file reads off the UI thread. (#7516)
 - **`/model` splits use-now from saving the default:** pressing `Enter` switches the current session's model immediately while `Shift+D` saves it as the default route. (#7517)
 - **Standalone `/pet` dot whale:** every terminal draws the dot whale directly from its own session activity without depending on the companion source session. (#7514)
```

**File**: `crates/app-server/src/runtime_api/tests.rs` (modified, +1/-1)
```diff
@@ -14143,7 +14143,7 @@ async fn settings_schema_allow_shell_reports_interactive_default_and_explicit_op
         .iter()
         .find(|row| row["key"] == "allow_shell")
         .expect("allow_shell row present");
-    assert_eq!(default_launch_row["value"], "false");
+    assert_eq!(default_launch_row["value"], "true");
     assert_eq!(default_launch_row["persisted"], true);
     Ok(())
 }
```

**File**: `crates/engine/src/core/engine/tests/child_host.rs` (modified, +2/-12)
```diff
@@ -2567,12 +2567,7 @@ async fn child_engine_inherits_parent_tools_overrides_and_excludes_disabled_tool
         )
         .await;
     assert!(
-        baseline
-            .surface
-            .registry
-            .names()
-            .iter()
-            .any(|name| *name == "diagnostics"),
+        baseline.surface.registry.names().contains(&"diagnostics"),
         "control: worker child includes diagnostics without overrides"
     );
 
@@ -2618,12 +2613,7 @@ async fn child_engine_inherits_parent_tools_overrides_and_excludes_disabled_tool
             .await;
         for disabled in ["diagnostics", "tasks"] {
             assert!(
-                !restricted
-                    .surface
-                    .registry
-                    .names()
-                    .iter()
-                    .any(|name| *name == disabled),
+                !restricted.surface.registry.names().contains(&disabled),
                 "child registry must exclude disabled tool {disabled}"
             );
             assert!(
```

**File**: `crates/engine/src/fleet/manager.rs` (modified, +2/-2)
```diff
@@ -4429,7 +4429,7 @@ sleep 30
         let fake = fake_codewhale(
             &tmp,
             r#"#!/bin/sh
-sleep 0.2
+sleep 0.8
 printf '{"type":"done"}\n'
 exit 0
 "#,
@@ -4473,7 +4473,7 @@ exit 0
         let fake = fake_codewhale(
             &tmp,
             r#"#!/bin/sh
-sleep 0.2
+sleep 0.8
 printf '{"type":"done"}\n'
 exit 0
 "#,
```

**File**: `crates/engine/src/runtime_threads.rs` (modified, +6/-0)
```diff
@@ -3393,6 +3393,12 @@ impl RuntimeThreadStore {
 
     pub fn rebuild_thread_from_event_log(&self, thread_id: &str) -> Result<Option<ThreadRecord>> {
         validated_record_id(thread_id, "thread id")?;
+        if self
+            .seed_journal_path(thread_id)
+            .is_ok_and(|journal_path| journal_path.exists())
+        {
+            return Ok(None);
+        }
         let mut rebuilt: Option<ThreadRecord> = None;
         let mut latest_turn_id: Option<String> = None;
         let mut latest_ts: Option<DateTime<Utc>> = None;
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Cross-process item index cache and owner-only indexing:** cached the item index across processes and skipped non-owner records during indexing. Thanks [@gaord](https://github.com/gaord). (#7446, #7522)
 - **Simplified Chinese Auto-Review documentation:** added `docs/zh_hans/AUTO_REVIEW.md`. Thanks [@Goldloli](https://github.com/Goldloli). (#7521)
-- **Bundled Onomeo and AtmoRouter providers:** added Onomeo (`ONOMEO_API_KEY`, thanks [@Owaid0723666](https://github.com/Owaid0723666), #7525) and AtmoRouter (`ATMOROUTER_API_KEY`, thanks [@BeckleyTenriajeng](https://github.com/BeckleyTenriajeng), #7506) as bundled OpenAI-compatible provider descriptors.
+- **Bundled Onomeo, AtmoRouter, and TrustedRouter providers:** added Onomeo (`ONOMEO_API_KEY`, thanks [@Owaid0723666](https://github.com/Owaid0723666), #7525), AtmoRouter (`ATMOROUTER_API_KEY`, thanks [@BeckleyTenriajeng](https://github.com/BeckleyTenriajeng), #7506), and TrustedRouter (`TRUSTEDROUTER_API_KEY`, thanks [@jperla](https://github.com/jperla), #7350) as bundled OpenAI-compatible provider descriptors.
 - **One paste path in the terminal and off-thread clipboard reads:** simplified Ctrl+V handling to a single press/release edge rule and moved clipboard file reads off the UI thread. (#7516)
 - **`/model` splits use-now from saving the default:** pressing `Enter` switches the current session's model immediately while `Shift+D` saves it as the default route. (#7517)
 - **Standalone `/pet` dot whale:** every terminal draws the dot whale directly from its own session activity without depending on the companion source session. (#7514)
```

**File**: `crates/tui/tests/fixtures/conformance/events/provider_error_after_tool_call.golden.jsonl` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 {"event":"tool_request_snapshot","snapshot":{"active_tool_catalog_sha256":"511d2f86960858be97eeec3cb89937ebced084359012281aad9bb5cc0ccfb4d5","capture_source":"prepared model-client request","delivery_status":"unknown (capture does not prove provider delivery)","omitted_tool_count":0,"payload_json_bytes":15275,"payload_measurement_status":"exact (within 1048576-byte measurement bound)","provider":{"model":"deepseek-v4-pro","provider":"Deepseek","status":"available"},"registry_facts_present":true,"registry_only_tools":{"status":"known","value":{"count":43,"omitted":11,"rendered":[{"truncated":false,"value":"Git"},{"truncated":false,"value":"Run"},{"truncated":false,"value":"Web"},{"truncated":false,"value":"apply_patch"},{"truncated":false,"value":"automation"},{"truncated":false,"value":"context_archive_get"},{"truncated":false,"value":"context_archive_search"},{"truncated":false,"value":"diagnostics"},{"truncated":false,"value":"finance"},{"truncated":false,"value":"get_goal"},{"truncated":false,"value":"github"},{"truncated":false,"value":"handle_read"},{"truncated":false,"value":"harness"},{"truncated":false,"value":"image_ocr"},{"truncated":false,"value":"note"},{"truncated":false,"value":"notify"},{"truncated":false,"value":"pandoc_convert"},{"truncated":false,"value":"project_map"},{"truncated":false,"value":"registry_sync"},{"truncated":false,"value":"request_plugin_install"},{"truncated":false,"value":"request_user_input"},{"truncated":false,"value":"retrieve_tool_result"},{"truncated":false,"value":"revert_turn"},{"truncated":false,"value":"review"},{"truncated":false,"value":"rlm"},{"truncated":false,"value":"send_later"},{"truncated":false,"value":"session_get"},{"truncated":false,"value":"session_search"},{"truncated":false,"value":"show_data"},{"truncated":false,"value":"start_mcp_server"},{"truncated":false,"value":"start_registry_mcp_server"},{"truncated":false,"value":"task_shell_wait"}]}},"registry_tool_count":{"status":"known","value":70},"rendered_tool_count":13,"schema_version":1,"step":0,"tool_count":13,"tools":[{"allowed_callers":{"status":"known","value":{"count":1,"omitted":0,"rendered":[{"truncated":false,"value":"direct"}]}},"approval":{"status":"known","value":{"truncated":false,"value":"Required"}},"cache_control_type":{"reason":"request field absent","status":"unknown"},"capabilities":{"status":"known","value":{"count":3,"omitted":0,"rendered":[{"truncated":false,"value":"ExecutesCode"},{"truncated":false,"value":"Sandboxable"},{"truncated":false,"value":"RequiresApproval"}]}},"defer_loading":{"status":"known","value":false},"description":{"truncated":true,"value":"Execute a shell command in the workspace (optional cwd) and return stdout and stderr (last 400 lines or 16KB; the full output is saved as an artifact). Optional timeout is foreground seconds (default 30 seconds); a command still running then moves to the background by itself — never killed for time — returning output so far, last-output age, build phase, and a task_id. Set background=true for >5s or parallel jobs, and description for a short UI label. Call task_shell_wait with that task_id to read more or w"},"input_examples":{"reason":"request field absent","status":"unknown"},"input_schema_json":{"truncated":true,"value":"{\"additionalProperties\":false,\"properties\":{\"background\":{\"description\":\"Run immediately in the background and return a task_id (good for >5s or parallel jobs; incompatible with read_only=true). Call task_shell_wait to wait or cancel.\",\"type\":\"boolean\"},\"command\":{\"description\":\"The command to execute. Actual execution shell: `/bin/bash`. Use Bash syntax: pipelines, redirections, $(command), and && / || are supported. Quote paths and variable expansions, such as \\\"$path\\\"; use single quotes for literal text. For literal multiline input, use a quoted heredoc delimiter (<<'EOF') with its closing delimiter on a separate line. Use only installed programs; do not assume GNU-specific flags on macOS/BSD. Example: printf '%s\\\\n' 'sample'.\",\"type\":\"string\"},\"cwd\":{\"description\":\"Optional workspace-relative working directory.\",\"type\":\"string\"},\"description\":{\"description\":\"Optional few-word summary shown to the user beside the command.\",\"type\":\"string\"},\"justification\":{\"description\":\"Required with sandbox_permissions: one sentence explaining why this exact command needs wider access.\",\"type\":\"string\"},\"read_only\":{\"description\":\"Set true to run analysis code (including Python/SQLite) or a network fetch (curl) with mandatory native filesystem read-only isolation. Outbound network is on only in Full Access when the session sandbox, the network policy and your network grant allow it. Available during peer writes. Refused when native enforcement is unavailable; no background, stdin, external backend, or sandbox escalation.\",\"type\":\"boolean\"},\"sandbox_permissions\":{\"description\":\"The wider sandbox mode this exact command n
```

---

### Incident Patch 3: `9874729a` (2026-11-24)
**Commit Message**: fix(tui): box run_event_loop and fat handle_view_events futures to prevent debug stack overflow

- Box run_event_loop inside run_tui so startup and poll frames never
  coexist on the codewhale-main stack.
- Box apply_model_picker_choice, open_provider_picker,
  open_model_connection_setup, apply_plan_handoff, switch_provider, and
  apply_range_undo inside handle_view_events.

Verified locally:
- cargo fmt --all -- --check
- sh scripts/sync-changelog.sh --check
- python3 scripts/check-contributor-credit.py (exit 0)

**File**: `crates/tui/src/tui/ui/event_loop.rs` (modified, +2/-2)
```diff
@@ -1535,7 +1535,7 @@ pub async fn run_tui(
     if let Some(millis) = codewhale_runtime::startup_trace::cold_start_ms() {
         codewhale_telemetry::set_cold_start_ms(millis);
     }
-    let result = run_event_loop(
+    let result = Box::pin(run_event_loop(
         &mut terminal,
         &mut app,
         config,
@@ -1545,7 +1545,7 @@ pub async fn run_tui(
         translation_client,
         pending_telemetry_notice,
         dispatch_completion_rx,
-    )
+    ))
     .await;
     automation_cancel.cancel();
     automation_scheduler.abort();
```

**File**: `crates/tui/src/tui/ui/handlers.rs` (modified, +47/-17)
```diff
@@ -1982,13 +1982,13 @@ pub(crate) async fn handle_view_events(
                         let identity = config
                             .builtin_provider_identity(ProviderKind::Codewhale)
                             .map_err(anyhow::Error::msg)?;
-                        let switched = switch_provider(
+                        let switched = Box::pin(switch_provider(
                             app,
                             engine_handle,
                             config,
                             identity,
                             Some(model.clone()),
-                        )
+                        ))
                         .await;
                         if switched {
                             if app.onboarding == OnboardingState::Provider {
@@ -2026,7 +2026,7 @@ pub(crate) async fn handle_view_events(
                                 app.ui_locale,
                             ))
                     }
-                    Some(false) => open_provider_picker(app, config, engine_handle).await,
+                    Some(false) => Box::pin(open_provider_picker(app, config, engine_handle)).await,
                     None if app.onboarding == OnboardingState::Provider => {
                         back_from_provider_onboarding(app)
                     }
@@ -2084,7 +2084,13 @@ pub(crate) async fn handle_view_events(
                 app.push_status_toast(message, level, Some(8_000));
                 if needs_model {
                     begin_first_connection_setup(app);
-                    open_model_connection_setup(app, config, engine_handle, false).await;
+                    Box::pin(open_model_connection_setup(
+                        app,
+                        config,
+                        engine_handle,
+                        false,
+                    ))
+                    .await;
                 }
                 app.needs_redraw = true;
             }
@@ -2182,17 +2188,24 @@ pub(crate) async fn handle_view_events(
                 if is_plan_handoff_request(app, &tool_id) =>
             {
                 let choice = crate::tui::plan_handoff::choice(app.ui_locale, &response);
-                apply_plan_handoff(app, config, engine_handle, &tool_id, choice).await?;
+                Box::pin(apply_plan_handoff(
+                    app,
+                    config,
+                    engine_handle,
+                    &tool_id,
+                    choice,
+                ))
+                .await?;
             }
             // Esc follows the same owned-seed cleanup as Keep planning.
             ViewEvent::UserInputCancelled { tool_id } if is_plan_handoff_request(app, &tool_id) => {
-                apply_plan_handoff(
+                Box::pin(apply_plan_handoff(
                     app,
                     config,
                     engine_handle,
                     &tool_id,
                     crate::tui::plan_handoff::PlanHandoffChoice::KeepPlanning,
-                )
+                ))
                 .await?;
             }
             ViewEvent::UserInputSubmitted { tool_id, response } => {
@@ -3125,7 +3138,7 @@ pub(crate) async fn handle_view_events(
                         .replace("{model}", &model);
                     app.add_message(HistoryCell::System { content: notice });
                 }
-                apply_model_picker_choice(
+                Box::pin(apply_model_picker_choice(
                     app,
                     engine_handle,
                     config,
@@ -3135,7 +3148,7 @@ pub(crate) async fn handle_view_events(
                     previous_model,
                     previous_effort,
                     save_as_startup_default,
-                )
+                ))
                 .await;
                 refresh_parked_fleet_roster(app, config);
             }
@@ -3265,7 +3278,7 @@ pub(crate) async fn handle_view_events(
                 apply_status_toast_event(app, message, level);
             }
             ViewEvent::TopbarRoutePickerRequested => {
-                open_provider_picker(app, config, engine_handle).await;
+                Box::pin(open_provider_picker(app, config, engine_handle)).await;
             }
             ViewEvent::TopbarModelPickerRequested => {
                 if app.view_stack.top_kind() != Some(ModalKind::ModelPicker) {
@@ -3296,8 +3309,14 @@ pub(crate) async fn handle_view_events(
             ViewEvent::ProviderPickerApplied { identity } => {
                 let provider = identity.provider;
                 let model_override = provider_picker_model_override(app, config, &identity);
-                let switched =
-                    switch_provider(app, engine_handle, config, identity, model_override).await;
+                let switched = Box::pin(switch_provider(
+                    app,
+                    engine_handle,
+                    config,
+                    identity,
+                    model_override,
+                ))
+   
```

#### Recent Merged Pull Requests:
- **PR #7559** (closed): docs(changelog): consolidate and deduplicate the 0.10.5 Unreleased notes (@Hmbown)
- **PR #7558** (2026-11-24): feat(0.10.5): DSH 0.2.2 host services, per-plugin settings, telemetry honesty, and Wave 2 runtime (@Hmbown)
- **PR #7557** (2026-11-24): fix(tui): use the engine catalog effort parser and add the Ollama Cloud effort ladder (@Hmbown)
- **PR #7556** (2026-11-24): test(engine): match the strict [skills] contract in the creator-skills test (@Hmbown)
- **PR #7555** (2026-11-24): fix(security): hardening batch — grants, secrets, runtime probes, execpolicy deny bypasses (@Hmbown)
- **PR #7554** (2026-11-24): fix(tui): guard background session persistence while dispatch_in_flight (@Hmbown)

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

## X. docs(dsh,release): record 0.10.5 DSH qualification, restore credits, and fix web

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3235e2ec`: docs(dsh,release): record 0.10.5 DSH qualification, restore credits, and fix web tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Serve the shared web app build from `codewhale web`:** `codewhale web` now serves a built `codewhale-app/apps/web/dist` directory when `CODEWHALE_WEB_DIST` points to a valid directory containing `index.html`, including `/plugin-host.html` (with sandboxed `connect-src 'none'` / `frame-ancestors 'self'` CSP), immutable `/static/*` hashed assets, bounded SPA route fallback, path-traversal/symlink refusal, and preserved auth-bootstrap cookie sessions; falls back to the embedded web client when unset. (#7237)
- **Choose an external ACP agent in the terminal:** `/model` now lists installed external ACP agents (`antigravity`, `opencode`, `copilot`, `dsh`, and others) alongside Codewhale models, showing why non-runnable agents are blocked and what to run, and `codewhale --agent <id>` / `codewhale exec --agent <id>` starts an interactive or headless session through the Engine ACP executor. (CW-8361)
- **TrustedRouter bundled provider and inclusion bar:** added `TrustedRouter` (`trustedrouter`, `TRUSTEDROUTER_API_KEY`) as a bundled OpenAI-compatible provider and documented the bundled-provider inclusion bar. Thanks [@jperla](https://github.com/jperla). (#7350)
- **Simplified Chinese Auto
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
### Adde
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3235e2ec` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
