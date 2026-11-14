# Agent Contract: Agent Contract: codewhale-hq-codewhale-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T14:40:19.446Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-codewhale-hq-codewhale-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T14:40:19.446Z`  
> **Learning ID**: `LEARN-EVO-codewhale-hq-codewhale-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `codewhale-hq-codewhale-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `0f339089`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T14:40:08.877Z  
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
> **Harvest Timestamp**: 2026-11-14T14:40:08.869Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: An open-source coding agent for your terminal, written in Rust. It works with any model, can split one task across several agents, and every line of it is yours to read.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41174 stars

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

### Incident Patch 1: `9b567b2b` (2026-11-11)
**Commit Message**: feat(extension-host): fill the dsh/broker llm arm on the Engine's own auxiliary model call (CW-7973)

The llm arm serves two typed methods: catalog and complete (usage/quota counters and synthetic session call caps are intentionally absent per decision §148.8). A completion dispatches one admitted Engine turn through the captured auxiliary-call authority in completion mode: one step, no tools, session route, and RlmPromptPolicy::IsolatedPlugin.

Isolation and cache boundary: IsolatedPlugin uses a dedicated minimal system prompt and omits instruction_assembly, extension_prompt_block, and constitution_block (each delivered as history messages for Session RLM calls under CW-7925, preserved across Engine::new_admitted, refresh_system_prompt_from_context_with_reason, and compose_preview_prefix via RlmHostState::instruction_assembly and EngineHostSetup::instruction_assembly) plus clears hook_executor, so untrusted plugin prompts cannot inherit session privileges or workspace/policy guidance. Because no prefix is shared with the active conversation, each plugin completion reads no warm session prompt cache and writes none the session consumes. Nested turns live only in an ephemeral per-ca

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Plugin index hooks:** hooks with the same name and event now have distinct row IDs, so clients can keep every configured hook visible.
 - **Extension service approvals:** plugin service acts use the session permission gate and retain their approved or refused act records when a tool call fails. Closing a call seals its broker-act record so a late approval cannot authorize an unrecorded act. Ordinary nested-call receipts may still show an in-flight outcome when cancellation ends the call early.
 - **Extension workspace confinement:** plugin workspace file reads, listings, and overlay writes now verify pinned ancestors and non-linked targets at the point of use without letting session trust flags escape the workspace, reject Windows alternate data streams and 8.3 short-name aliases for protected metadata directories, and check caller deny rules for git review queries before requesting approval. (CW-8056)
+- **Plugin LLM broker arm (gated off):** adds the `dsh/broker` `llm` service arm (`catalog`, `complete`) and TypeScript SDK adapter, routing completions over the active session route with an isolated plugin prompt (omitting workspace instructions, account constitution, and other plugins' prompt sections), session permission-gate checks (`Read`/`Reach`), and bounded concurrency; host injection stays disabled by default pending final review. (CW-7973)
 - **Delayed-message workspaces and shell stdin approvals:** `send_later` `schedule` now keeps its workspace inside the session's reachable paths instead of accepting an arbitrary directory, and `send_later` approval prompts show the requested workspace; session shell grants now match exact inputs when `stdin` (`stdin`, `input`, `data`) is supplied instead of reusing a command-only grant across different `stdin`.
 - **Sub-agent approvals and worktree isolation:** a child sub-agent's built-in verification calls now ask the same approval as the main session, a read-only agent started with `workspace_policy: "worktree"` shows the approval card, and a sub-agent worktree is refused when its root or nested adoption path passes through a symlink.
 - **OCR image signature check:** `image_ocr` and the OCR branch of `read_file` now refuse files without a PNG, JPEG, TIFF, BMP, GIF, or WebP signature before any OCR backend runs, and run `tesseract` in an empty temporary working directory.
```

**File**: `crates/engine/extension-host/src/dsh/llm.ts` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+import { Service } from '@deepseek-ai/cordis'
+import { ErrorCode } from '../protocol.ts'
+import { RpcError } from '../rpc.ts'
+import type { AdapterHost, DshAdapter } from './adapters.ts'
+
+export const SESSION_PROVIDER = 'session'
+
+export interface BrokeredModel {
+  provider: string
+  id: string
+  name: string
+  context_window: number | null
+  default_max_output_tokens: number
+  max_output_tokens: number
+}
+
+export interface BrokeredCatalog {
+  providers: { id: string, name: string }[]
+  models: BrokeredModel[]
+  limits: Record<string, number>
+}
+
+export interface BrokeredUsage {
+  coverage: string
+  input_tokens: number | null
+  output_tokens: number | null
+  cache_read_tokens: number | null
+  cache_write_tokens: number | null
+  reasoning_tokens: number | null
+}
+
+export interface BrokeredCompletion {
+  text: string
+  finish: string
+  route: { provider: string, model: string } | null
+  usage: BrokeredUsage
+  receipt: { requests: number, duration_ms: number }
+}
+
+interface StreamOptions {
+  provider?: unknown
+  model?: unknown
+  messages?: unknown
+  system?: unknown
+  tools?: unknown
+  toolHistory?: unknown
+  maxTokens?: unknown
+  signal?: AbortSignal
+}
+
+type Chunk =
+  | { type: 'block-start', index: number, blockType: 'text' }
+  | { type: 'text-delta', index: number, text: string }
+  | { type: 'block-end', index: number, block: { type: 'text', text: string } }
+  | { type: 'usage', usage: { inputTokens: number, outputTokens: number, totalTokens: number, cacheReadTokens?: number, cacheWriteTokens?: number, reasoningTokens?: number } }
+  | { type: 'finish', reason: { kind: 'stop' } | { kind: 'aborted' | 'error', failure: { message: string, code: string } } }
+
+const invalid = (message: string) => new RpcError(ErrorCode.InvalidParams, message)
+const notBrokered = (method: string): never => {
+  throw new RpcError(ErrorCode.NotAvailable, `llm.${method} is not available: Codewhale brokers model calls on the session's approved route and registers no plugin adapters, providers or keys`)
+}
+
+function catalogOf(value: unknown): BrokeredCatalog {
+  const catalog = value as Partial<BrokeredCatalog> | null
+  if (catalog === null || typeof catalog !== 'object' || !Array.isArray(catalog.providers) || !Array.isArray(catalog.models)
+    || catalog.models.some((model) => model === null || typeof model !== 'object' || typeof model.id !== 'string' || typeof model.provider !== 'string')) {
+    throw new RpcError(ErrorCode.Internal, 'invalid llm broker catalog')
+  }
+  return catalog as BrokeredCatalog
+}
+
+function completionOf(value: unknown): BrokeredCompletion {
+  const completion = value as Partial<BrokeredCompletion> | null
+  if (completion === null || typeof completion !== 'object' || typeof completion.text !== 'string'
+    || typeof completion.finish !== 'string' || completion.finish.length === 0
+    || completion.usage === null || typeof completion.usage !== 'object' || typeof completion.usage.coverage !== 'string') {
+    throw new RpcError(ErrorCode.Internal, 'invalid llm broker completion')
+  }
+  return completion as BrokeredCompletion
+}
+
+function textOf(content: unknown): string {
+  if (typeof content === 'string') return content
+  if (!Array.isArray(content)) throw invalid('the llm broker takes text message content')
+  return content.map((block) => {
+    if (block === null || typeof block !== 'object' || block.type !== 'text' || typeof block.text !== 'string') {
+      throw invalid('the llm broker takes text blocks only; images, files and tool calls are not brokered')
+    }
+    return block.text as string
+  }).join('')
+}
+
+export function promptOf(messages: unknown): string {
+  if (!Array.isArray(messages) || messages.length === 0) throw invalid('the llm broker needs at least one message')
+  const turns = messages.map((message) => {
+    if (message === null || typeof message !== 'object' || typeof message.role !== 'string') throw invalid('each message has a role and content')
+    if (message.role === 'tool') throw invalid('tool results are not brokered')
+    return { role: message.role as string, text: textOf(message.content) }
+  })
+  const only = turns.length === 1 ? turns[0] : undefined
+  if (only !== undefined && only.role === 'user') return only.text
+  return turns.map((turn) => `${turn.role}: ${turn.text}`).join('\n\n')
+}
+
+function modelInfo(model: BrokeredModel) {
+  return {
+    provider: model.provider,
+    id: model.id,
+    name: model.name,
+    inputModalities: ['text'] as const,
+    ...(typeof model.context_window === 'number' ? { context: { contextWindow: model.context_window } } : {}),
+    defaultMaxTokens: model.default_max_output_tokens,
+  }
+}
+
+function usageChunk(usage: BrokeredUsage): Chunk | undefined {
+  if (usage.coverage !== 'reported' || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') return undefined
+  return {
+    type: 'usage',
+    u
```

**File**: `crates/engine/extension-host/test/llm.test.mjs` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+import { test, before } from 'node:test'
+import assert from 'node:assert/strict'
+import { mkdtempSync, rmSync } from 'node:fs'
+import { join, dirname } from 'node:path'
+import { fileURLToPath, pathToFileURL } from 'node:url'
+import { build } from 'esbuild'
+
+const here = dirname(fileURLToPath(import.meta.url))
+let llmAdapter
+let promptOf
+
+before(async () => {
+  const dir = mkdtempSync(join(here, '..', 'node_modules', '.cw-llm-'))
+  const outfile = join(dir, 'llm.mjs')
+  await build({ entryPoints: [join(here, '../src/dsh/llm.ts')], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', absWorkingDir: join(here, '..'), logLevel: 'silent' })
+  ;({ llmAdapter, promptOf } = await import(pathToFileURL(outfile).href))
+  process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
+})
+
+const catalog = {
+  providers: [{ id: 'session', name: 'Codewhale session route' }],
+  models: [{ provider: 'session', id: 'm-1', name: 'm-1', context_window: 1000, default_max_output_tokens: 4096, max_output_tokens: 16384 }],
+  limits: {},
+}
+const reported = { coverage: 'reported', input_tokens: 5, output_tokens: 3, cache_read_tokens: null, cache_write_tokens: null, reasoning_tokens: null }
+const completion = (usage) => ({ text: 'hello', finish: 'stop', route: { provider: 'p', model: 'm-1' }, usage, receipt: { requests: 1, duration_ms: 2 } })
+
+function service(answers) {
+  const calls = []
+  const host = {
+    tier: 'plugin',
+    broker: async (ctx, name, method, input) => {
+      calls.push({ name, method, input })
+      const answer = answers[method]
+      if (answer instanceof Error) throw answer
+      return answer
+    },
+  }
+  const instance = Object.create(llmAdapter.define(host).prototype)
+  instance.ctx = {}
+  return { llm: instance, calls }
+}
+
+async function drain(stream) {
+  const chunks = []
+  for await (const chunk of stream) chunks.push(chunk)
+  return chunks
+}
+
+test('a consumer-shaped stream is one typed complete call and ends with usage and a finish', async () => {
+  const { llm, calls } = service({ complete: completion(reported) })
+  const chunks = await drain(llm.stream({
+    provider: 'session', model: 'm-1', system: 'be brief', maxTokens: 64,
+    messages: [{ role: 'user', content: [{ type: 'text', text: 'say ' }, { type: 'text', text: 'hello' }] }],
+  }))
+  assert.deepEqual(calls, [{ name: 'llm', method: 'complete', input: { prompt: 'say hello', system: 'be brief', provider: 'session', model: 'm-1', max_output_tokens: 64 } }])
+  assert.deepEqual(chunks.map((chunk) => chunk.type), ['block-start', 'text-delta', 'block-end', 'usage', 'finish'])
+  assert.equal(chunks[1].text, 'hello')
+  assert.deepEqual(chunks[3].usage, { inputTokens: 5, outputTokens: 3, totalTokens: 8 })
+  assert.deepEqual(chunks[4].reason, { kind: 'stop' })
+})
+
+test('unreported usage yields no usage chunk, and a refusal or abort is a terminal finish', async () => {
+  const missing = { ...reported, coverage: 'missing', input_tokens: null, output_tokens: null }
+  const quiet = await drain(service({ complete: completion(missing) }).llm.stream({ messages: [{ role: 'user', content: 'hi' }] }))
+  assert.deepEqual(quiet.map((chunk) => chunk.type), ['block-start', 'text-delta', 'block-end', 'finish'])
+  const refused = await drain(service({ complete: new Error('the model call ran out of time') }).llm.stream({ messages: [{ role: 'user', content: 'hi' }] }))
+  assert.deepEqual(refused, [{ type: 'finish', reason: { kind: 'error', failure: { message: 'the model call ran out of time', code: 'BROKER_REFUSED' } } }])
+  const { llm, calls } = service({ complete: completion(reported) })
+  const aborted = await drain(llm.stream({ messages: [{ role: 'user', content: 'hi' }], signal: AbortSignal.abort() }))
+  assert.equal(aborted[0].reason.kind, 'aborted')
+  assert.deepEqual(calls, [])
+  const controller = new AbortController()
+  const host = {
+    tier: 'plugin',
+    broker: async () => {
+      controller.abort()
+      throw new Error('withdrawn')
+    },
+  }
+  const aborting = Object.create(llmAdapter.define(host).prototype)
+  aborting.ctx = {}
+  const midFlightAbort = await drain(aborting.stream({ messages: [{ role: 'user', content: 'hi' }], signal: controller.signal }))
+  assert.deepEqual(midFlightAbort, [{ type: 'finish', reason: { kind: 'aborted', failure: { message: 'the model call was aborted', code: 'ABORTED' } } }])
+})
+
+test('tools, non-text content and tool results are refused locally, and a transcript keeps its roles', async () => {
+  const { llm, calls } = service({ complete: completion(reported) })
+  await assert.rejects(drain(llm.stream({ messages: [{ role: 'user', content: 'x' }], tools: [{ name: 't' }] })), /without tools/)
+  await assert.rejects(drain(llm.stream({ messages: [{ role: 'user', content: 'x' }], tools: { read: {} } })), /without tools/)
+  await assert.rejects(drain(llm.stream({ messages: [{ role: 'use
```

**File**: `crates/engine/src/core/engine.rs` (modified, +19/-7)
```diff
@@ -2396,7 +2396,7 @@ impl Engine {
             prompts::PromptHost::Headless
         };
         let (system_prompt, instruction_assembly) = if let Some(host) = host.as_ref() {
-            (host.system_prompt().clone(), None)
+            (host.system_prompt().clone(), host.instruction_assembly())
         } else if api_config.runtime_chat_isolated {
             (
                 SystemPrompt::Text(ISOLATED_CHAT_SYSTEM_PROMPT.to_string()),
@@ -2464,10 +2464,10 @@ impl Engine {
                 Some((&raw, &instruction_settings, initial_instruction_budgets)),
             );
             session.project_context = Some(raw);
-            (prompt, Some(assembly))
+            (prompt, Some(Arc::new(assembly)))
         };
         let pending_instruction_notices = Vec::new();
-        session.instruction_assembly = instruction_assembly.map(Arc::new);
+        session.instruction_assembly = instruction_assembly;
         let stable_prompt = Some(system_prompt);
         session.last_system_prompt_hash = Some(system_prompt_hash(stable_prompt.as_ref()));
         session.system_prompt = stable_prompt;
@@ -10085,7 +10085,7 @@ impl Engine {
             return;
         }
         let (stable_prompt, assembly) = match self.host_owned_system_prompt() {
-            Some(prompt) => (Some(prompt), None),
+            Some(prompt) => (Some(prompt), self.host_owned_instruction_assembly()),
             None => {
                 self.record_project_trust_warning();
                 let raw = self.capture_project_instructions_for(context);
@@ -10103,10 +10103,10 @@ impl Engine {
                     budgets,
                 );
                 self.session.project_context = Some(raw);
-                (Some(prompt), Some(assembly))
+                (Some(prompt), Some(Arc::new(assembly)))
             }
         };
-        self.session.instruction_assembly = assembly.map(Arc::new);
+        self.session.instruction_assembly = assembly;
         self.instruction_guard_key = None;
         let stable_hash = system_prompt_hash(stable_prompt.as_ref());
         self.session.pinned_prompt_context = Some(context.clone());
@@ -10253,6 +10253,14 @@ impl Engine {
         None
     }
 
+    fn host_owned_instruction_assembly(
+        &self,
+    ) -> Option<Arc<crate::project_context::InstructionAssembly>> {
+        self.rlm_host
+            .as_ref()
+            .and_then(rlm_host::RlmHostState::instruction_assembly)
+    }
+
     /// Compose the stable system prompt for an explicit route, without
     /// touching session state.
     ///
@@ -10278,7 +10286,11 @@ impl Engine {
         Option<crate::project_context::InstructionAssembly>,
     ) {
         if let Some(prompt) = self.host_owned_system_prompt() {
-            return (Some(prompt), None, None);
+            return (
+                Some(prompt),
+                None,
+                self.host_owned_instruction_assembly().as_deref().cloned(),
+            );
         }
         let raw = self.capture_project_instructions_for(context);
         let memory = codewhale_runtime::native_memory::native_prompt_block(
```

**File**: `crates/engine/src/core/engine/rlm_host.rs` (modified, +72/-7)
```diff
@@ -15,9 +15,17 @@ pub enum RlmMode {
     Recursive { depth_remaining: u32 },
 }
 
+#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
+pub enum RlmPromptPolicy {
+    #[default]
+    Session,
+    IsolatedPlugin,
+}
+
 pub struct RlmInvocation {
     pub prompt: String,
     pub mode: RlmMode,
+    pub prompt_policy: RlmPromptPolicy,
     pub max_tokens: Option<u32>,
     pub task_instructions: Option<String>,
     pub deadline: Option<tokio::time::Instant>,
@@ -40,6 +48,7 @@ pub struct CapturedRlmCaller {
     injected: bool,
     config: EngineConfig,
     system: SystemPrompt,
+    instruction_assembly: Option<Arc<crate::project_context::InstructionAssembly>>,
     extension_prompt_block: Option<String>,
     constitution_block: Option<String>,
     approval_store: Result<ApprovalReceiptStore, String>,
@@ -147,6 +156,7 @@ impl CapturedRlmCaller {
                 system: engine.session.system_prompt.clone().ok_or_else(|| {
                     ToolError::not_available("the Core policy prompt is unavailable")
                 })?,
+                instruction_assembly: engine.session.instruction_assembly.clone(),
                 extension_prompt_block: engine.extension_prompt_block.clone(),
                 constitution_block: engine.constitution_block.clone(),
                 approval_store: engine.approval_receipt_store.clone(),
@@ -213,6 +223,18 @@ impl CapturedRlmCaller {
         self.deadline
     }
 
+    pub(crate) fn route_model(&self) -> &str {
+        &self.route.model
+    }
+
+    pub(crate) fn route_provider_id(&self) -> String {
+        self.route.identity.key.to_string()
+    }
+
+    pub(crate) fn route_context_window(&self) -> Option<u32> {
+        (self.route.context_window.tokens > 0).then_some(self.route.context_window.tokens)
+    }
+
     /// Boxing breaks recursive future types; the future still borrows this
     /// caller and never enters the persistent session map or PythonRuntime.
     pub fn dispatch<'call>(
@@ -335,6 +357,7 @@ pub(super) struct RlmHostState {
     pub caller: Arc<CapturedRlmCaller>,
     pub run_id: String,
     pub mode: RlmMode,
+    pub prompt_policy: RlmPromptPolicy,
     pub system_prompt: SystemPrompt,
     pub prompt: String,
     pub deadline: Option<tokio::time::Instant>,
@@ -350,12 +373,30 @@ pub(super) struct RlmHostState {
     pub error: Option<String>,
     pub model_rounds: u32,
 }
+impl RlmHostState {
+    pub(super) fn instruction_assembly(
+        &self,
+    ) -> Option<Arc<crate::project_context::InstructionAssembly>> {
+        session_instruction_assembly(&self.caller, self.prompt_policy)
+    }
+}
+
+fn session_instruction_assembly(
+    caller: &CapturedRlmCaller,
+    policy: RlmPromptPolicy,
+) -> Option<Arc<crate::project_context::InstructionAssembly>> {
+    (policy == RlmPromptPolicy::Session)
+        .then(|| caller.instruction_assembly.clone())
+        .flatten()
+}
+
 impl From<RlmHostSetup> for RlmHostState {
     fn from(setup: RlmHostSetup) -> Self {
         Self {
             caller: setup.caller,
             run_id: String::new(),
             mode: setup.invocation.mode,
+            prompt_policy: setup.invocation.prompt_policy,
             system_prompt: setup.system_prompt,
             prompt: setup.invocation.prompt,
             deadline: setup.invocation.deadline,
@@ -405,12 +446,24 @@ impl Engine {
         config.turn_wall_clock = invocation.deadline.map_or(Duration::MAX, |deadline| {
             deadline.saturating_duration_since(tokio::time::Instant::now())
         });
+        let isolated = invocation.prompt_policy == RlmPromptPolicy::IsolatedPlugin;
+        if isolated {
+            anyhow::ensure!(
+                invocation.mode == RlmMode::Completion,
+                "isolated plugin RLM policy is valid only in completion mode"
+            );
+            config.hook_executor = None;
+        }
         config.compaction.runtime_cost_owner = caller.runtime_owner.clone();
-        let system_prompt = crate::rlm::prompt::captured_rlm_prompt(
-            &caller.system,
-            invocation.mode,
-            invocation.task_instructions.as_deref(),
-        )?;
+        let system_prompt = if isolated {
+            crate::rlm::prompt::isolated_plugin_rlm_prompt(invocation.task_instructions.as_deref())?
+        } else {
+            crate::rlm::prompt::captured_rlm_prompt(
+                &caller.system,
+                invocation.mode,
+                invocation.task_instructions.as_deref(),
+            )?
+        };
         let mut kernel = None;
         if invocation.mode != RlmMode::Completion {
             let path = tempfile::TempPath::try_from_path(codewhale_repl::write_context_file(
@@ -450,8 +503,10 @@ impl Engine {
         engine.model_client_injected = caller.injected;
         handle.client_preflight_required = false;
         engine.repl_kernel = kernel;
-        engine.extension_prompt_block = caller.extension_prompt_block.clone();
-        engine.constitu
```

**File**: `crates/engine/src/core/engine/tests/rlm_host.rs` (modified, +129/-1)
```diff
@@ -1,7 +1,7 @@
 //! Actual Core fixtures for the migrated RLM contract. Replies are adapted to
 //! the existing stream decoder; there is no fixture model/code loop.
 use super::*;
-use crate::core::engine::rlm_host::{CapturedRlmCaller, RlmInvocation, RlmMode};
+use crate::core::engine::rlm_host::{CapturedRlmCaller, RlmInvocation, RlmMode, RlmPromptPolicy};
 use crate::llm_client::LlmClient;
 use crate::rlm::bridge::{RlmBridge, RlmUsageAccumulator};
 use codewhale_models::{MessageRequest, MessageResponse, StreamEvent};
@@ -335,6 +335,7 @@ pub async fn run_admitted_fixture(
             mode: RlmMode::Recursive {
                 depth_remaining: depth,
             },
+            prompt_policy: RlmPromptPolicy::Session,
             max_tokens: None,
             task_instructions: task,
             deadline: Some(deadline),
@@ -407,6 +408,7 @@ async fn captured_identity_cancel_and_task_bounds_refuse_before_any_provider() {
         .dispatch(RlmInvocation {
             prompt: "no effect".into(),
             mode: RlmMode::Completion,
+            prompt_policy: RlmPromptPolicy::Session,
             max_tokens: Some(0),
             task_instructions: None,
             deadline: caller.deadline(),
@@ -426,6 +428,7 @@ async fn captured_identity_cancel_and_task_bounds_refuse_before_any_provider() {
         .dispatch(RlmInvocation {
             prompt: "no effect".into(),
             mode: RlmMode::Completion,
+            prompt_policy: RlmPromptPolicy::Session,
             max_tokens: None,
             task_instructions: Some("x".repeat(4097)),
             deadline: caller.deadline(),
@@ -440,6 +443,7 @@ async fn captured_identity_cancel_and_task_bounds_refuse_before_any_provider() {
         .dispatch(RlmInvocation {
             prompt: "no effect".into(),
             mode: RlmMode::Completion,
+            prompt_policy: RlmPromptPolicy::Session,
             max_tokens: None,
             task_instructions: None,
             deadline: caller.deadline(),
@@ -495,6 +499,7 @@ async fn dropping_an_actual_dispatched_core_call_keeps_unknown_usage_without_ret
     let mut dispatch = caller.dispatch(RlmInvocation {
         prompt: "pending".into(),
         mode: RlmMode::Completion,
+        prompt_policy: RlmPromptPolicy::Session,
         max_tokens: None,
         task_instructions: None,
         deadline: Some(tokio::time::Instant::now() + Duration::from_secs(600)),
@@ -616,6 +621,7 @@ async fn full_caller_channel_never_delays_original_cancel_or_loses_usage_and_ker
     let call = caller.dispatch(RlmInvocation {
         prompt: "context held only by Python".into(),
         mode: RlmMode::Recursive { depth_remaining: 0 },
+        prompt_policy: RlmPromptPolicy::Session,
         max_tokens: None,
         task_instructions: None,
         deadline: Some(tokio::time::Instant::now() + Duration::from_secs(60)),
@@ -705,6 +711,7 @@ async fn nested_host_never_claims_or_overwrites_parent_posture_revision() {
         RlmInvocation {
             prompt: "no provider invocation".into(),
             mode: RlmMode::Completion,
+            prompt_policy: RlmPromptPolicy::Session,
             max_tokens: None,
             task_instructions: None,
             deadline: Some(tokio::time::Instant::now() + Duration::from_secs(60)),
@@ -773,6 +780,7 @@ async fn repeated_real_core_preparation_failures_have_bounded_receipts_without_p
     let invocation = || RlmInvocation {
         prompt: "real request preparation must retain this whole input".into(),
         mode: RlmMode::Completion,
+        prompt_policy: RlmPromptPolicy::Session,
         max_tokens: None,
         task_instructions: None,
         deadline: Some(tokio::time::Instant::now() + Duration::from_secs(60)),
@@ -820,6 +828,7 @@ async fn actual_expired_python_startup_releases_the_staged_context() {
         RlmInvocation {
             prompt: prompt.clone(),
             mode: RlmMode::Recursive { depth_remaining: 0 },
+            prompt_policy: RlmPromptPolicy::Session,
             max_tokens: None,
             task_instructions: None,
             deadline: Some(tokio::time::Instant::now()),
@@ -856,3 +865,122 @@ async fn actual_expired_python_startup_releases_the_staged_context() {
     }
     assert_eq!(mock.call_count(), 0);
 }
+
+#[tokio::test]
+async fn a_plugin_completion_carries_no_constitution_and_no_plugin_prompt_section() {
+    let workspace = tempfile::tempdir().unwrap();
+    std::fs::write(
+        workspace.path().join("AGENTS.md"),
+        "WORKSPACE_INSTRUCTION_SENTINEL\n",
+    )
+    .unwrap();
+    let config = fixture_config("captured-model");
+    let mock = Arc::new(crate::llm_client::mock::MockLlmClient::new(Vec::new()));
+    let reply = |text: &str| MessageResponse {
+        id: "isolated-policy-msg".into(),
+        r#type: "message".into(),
+        role: "assistant".into(),
+        content: vec![ContentBlock::Text {
+            text: text.to_string(),
+            cache_control: None,
+        
```

**File**: `crates/engine/src/extension_host/core_call_tests.rs` (modified, +390/-1)
```diff
@@ -1921,6 +1921,7 @@ async fn dsh_broker_tickets_bind_plugin_service_and_session_and_every_refusal_is
                 | DshService::Terminal
                 | DshService::Workspace
                 | DshService::Catalog
+                | DshService::Llm
         )
     }) {
         let ticket = &tickets_a[service.name()];
@@ -2204,6 +2205,7 @@ async fn dsh_broker_services_are_granted_by_one_check_and_an_ungranted_service_i
                 | DshService::Terminal
                 | DshService::Workspace
                 | DshService::Catalog
+                | DshService::Llm
         ) {
             let result = f
                 .broker(
@@ -5388,7 +5390,394 @@ async fn dsh_catalog_arm_plans_reviewed_installs_approved_routes_and_a_keyless_b
         dsh_refusal(&revoked),
         (error_code::REFUSED, "ticket_refused".into())
     );
-    drop(guard_b);
     drop(guard);
     assert_eq!(f.manager.shared.core_calls.live_tickets(), 0);
 }
+
+#[tokio::test]
+async fn dsh_llm_arm_dispatches_through_the_engine_and_refuses_foreign_tickets_and_unknown_methods()
+{
+    use super::dsh_broker::TABLE;
+    use super::protocol::DshService;
+    use crate::core::engine::tests::rlm_host::{context_for_replies, fixture_config};
+    use std::collections::BTreeMap;
+
+    let _grants = super::dsh_broker::TestGrants::only(&[DshService::Workspace, DshService::Llm]);
+    let mock = Arc::new(crate::llm_client::mock::MockLlmClient::new(Vec::new()));
+    mock.push_message_response(codewhale_models::MessageResponse {
+        id: "mock_msg".to_string(),
+        r#type: "message".to_string(),
+        role: "assistant".to_string(),
+        content: vec![codewhale_models::ContentBlock::Text {
+            text: "from the one engine".to_string(),
+            cache_control: None,
+        }],
+        model: "captured-model".to_string(),
+        stop_reason: Some("end_turn".to_string()),
+        stop_sequence: None,
+        container: None,
+        title: None,
+        stop_details: None,
+        refusal: None,
+        usage: codewhale_models::Usage {
+            input_tokens: 5,
+            output_tokens: 3,
+            ..codewhale_models::Usage::default()
+        },
+    });
+    let mut f = fixture(true);
+    f.context = context_for_replies(
+        &fixture_config("captured-model"),
+        "captured-model",
+        &f.context,
+        mock.clone(),
+    );
+    f.in_session("llm-session-a");
+    let guard_a = f.begin(7, &f.owner);
+    let tickets: BTreeMap<String, String> = guard_a
+        .broker_tickets()
+        .unwrap()
+        .into_iter()
+        .map(|wire| (wire.service, wire.ticket))
+        .collect();
+    let llm = tickets["llm"].clone();
+    let ask = json!({"prompt": "say it"});
+
+    let unknown = f
+        .broker(TABLE, &f.owner, &llm, "llm", "registerAdapter", json!({}))
+        .await;
+    assert_eq!(
+        dsh_refusal(&unknown),
+        (error_code::INVALID_PARAMS, "unknown_method".into())
+    );
+    let removed_usage = f
+        .broker(TABLE, &f.owner, &llm, "llm", "usage", json!({}))
+        .await;
+    assert_eq!(
+        dsh_refusal(&removed_usage),
+        (error_code::INVALID_PARAMS, "unknown_method".into())
+    );
+    assert_eq!(mock.call_count(), 0, "no refusal reached the provider");
+
+    let served = f
+        .broker(TABLE, &f.owner, &llm, "llm", "complete", ask.clone())
+        .await
+        .unwrap();
+    assert_eq!(served["text"], "from the one engine");
+    assert_eq!(served["usage"]["coverage"], "reported");
+    assert_eq!(served["usage"]["input_tokens"], 5);
+    assert_eq!(served["usage"]["output_tokens"], 3);
+    assert_eq!(mock.call_count(), 1);
+
+    f.in_session("llm-session-b");
+    let guard_b = f.begin(7, &f.owner);
+    let llm_b = guard_b
+        .broker_tickets()
+        .unwrap()
+        .into_iter()
+        .find(|wire| wire.service == "llm")
+        .unwrap()
+        .ticket;
+    drop(guard_a);
+    let ended_invocation = f
+        .broker(TABLE, &f.owner, &llm, "llm", "complete", ask.clone())
+        .await;
+    assert_eq!(
+        dsh_refusal(&ended_invocation),
+        (error_code::REFUSED, "ticket_refused".into())
+    );
+
+    f.manager.shared.core_calls.revoke_owner("a");
+    let revoked = f
+        .broker(TABLE, &f.owner, &llm_b, "llm", "complete", ask)
+        .await;
+    assert_eq!(
+        dsh_refusal(&revoked),
+        (error_code::REFUSED, "ticket_refused".into())
+    );
+    drop(guard_b);
+    assert_eq!(mock.call_count(), 1);
+    assert_eq!(f.manager.shared.core_calls.live_tickets(), 0);
+}
+
+#[tokio::test]
+async fn a_completion_asks_the_session_gate_and_a_no_dispatches_nothing() {
+    use super::dsh_broker::TABLE;
+    use super::protocol::DshService;
+    use crate::core::engine::tests::rlm_host::{context_for_replies, fixture_config};
+
+    let _grants = super::dsh_broker::TestGrants::only(&[DshService::Workspace, DshService::Llm]);
+    let mock = Arc::new(crate::llm_
```

**File**: `crates/engine/src/extension_host/dsh_llm.rs` (modified, +1183/-3)
```diff
@@ -1,6 +1,1186 @@
-use super::dsh_broker::{BrokerCall, BrokerFuture, not_available};
+use std::collections::HashMap;
+use std::sync::{Arc, Mutex, OnceLock};
+use std::time::{Duration, Instant};
+
+use codewhale_config::OwnerRef;
+use codewhale_execpolicy::tool_rules::tool_denied;
+use serde::Deserialize;
+use serde_json::{Value, json};
+use tokio_util::sync::CancellationToken;
+
+use super::dsh_broker::{
+    BrokerCall, BrokerContext, BrokerEffect, BrokerFuture, BrokerMethods, BrokerRefusal, decode,
+};
 use super::protocol::DshService;
+use crate::core::engine::rlm_host::{CapturedRlmCaller, RlmInvocation, RlmMode, RlmPromptPolicy};
+use crate::llm_client::ProviderUsageCoverage;
+use crate::rlm::bridge::{RlmUsageAccumulator, RlmUsageSnapshot};
+use crate::tools::rlm::RLM_TOOL_NAME;
+use crate::tools::spec::ToolContext;
+
+pub const SESSION_PROVIDER: &str = "session";
+const MAX_PROMPT_BYTES: usize = 256 * 1024;
+const MAX_SYSTEM_BYTES: usize = 4096;
+const MAX_NAME_BYTES: usize = 256;
+const DEFAULT_OUTPUT_TOKENS: u32 = 4096;
+const MAX_OUTPUT_TOKENS: u32 = 16_384;
+const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);
+const MAX_TIMEOUT: Duration = Duration::from_secs(300);
+const MAX_IN_FLIGHT: u32 = 2;
+const MAX_IN_FLIGHT_ROWS: usize = 256;
+const LOG: &str = "codewhale::dsh_llm";
+
+#[derive(Deserialize)]
+#[serde(tag = "method", content = "input", deny_unknown_fields)]
+enum LlmMethod {
+    #[serde(rename = "catalog")]
+    Catalog(Empty),
+    #[serde(rename = "complete")]
+    Complete(CompleteInput),
+}
+
+impl BrokerMethods for LlmMethod {
+    const NAMES: &'static [&'static str] = &["catalog", "complete"];
+}
+
+#[derive(Deserialize)]
+#[serde(deny_unknown_fields)]
+struct Empty {}
+
+#[derive(Deserialize)]
+#[serde(deny_unknown_fields)]
+struct CompleteInput {
+    prompt: String,
+    #[serde(default)]
+    system: Option<String>,
+    #[serde(default)]
+    provider: Option<String>,
+    #[serde(default)]
+    model: Option<String>,
+    #[serde(default)]
+    max_output_tokens: Option<u32>,
+    #[serde(default)]
+    timeout_ms: Option<u64>,
+}
+
+fn invalid(message: &str) -> BrokerRefusal {
+    BrokerRefusal::InvalidInput {
+        service: DshService::Llm,
+        message: message.to_string(),
+    }
+}
+
+fn refused(message: &str) -> BrokerRefusal {
+    BrokerRefusal::Refused {
+        service: DshService::Llm,
+        message: message.to_string(),
+    }
+}
+
+fn denied(message: &str) -> BrokerRefusal {
+    BrokerRefusal::Denied {
+        service: DshService::Llm,
+        message: message.to_string(),
+    }
+}
+
+#[derive(Clone)]
+enum Gate {
+    Live(Arc<BrokerContext>),
+    #[cfg(test)]
+    Stub,
+}
+
+impl Gate {
+    async fn act(
+        &self,
+        method: &str,
+        effect: BrokerEffect,
+        target: Option<&str>,
+    ) -> Result<(), BrokerRefusal> {
+        match self {
+            Self::Live(context) => context.act(method, effect, target).await,
+            #[cfg(test)]
+            Self::Stub => Ok(()),
+        }
+    }
+
+    fn record(&self, entry: Value) -> bool {
+        match self {
+            Self::Live(context) => context.record(entry),
+            #[cfg(test)]
+            Self::Stub => true,
+        }
+    }
+}
+
+type FlightKey = (String, String);
+
+fn flights() -> &'static Mutex<HashMap<FlightKey, u32>> {
+    static FLIGHTS: OnceLock<Mutex<HashMap<FlightKey, u32>>> = OnceLock::new();
+    FLIGHTS.get_or_init(Mutex::default)
+}
+
+fn flight_key(owner: &OwnerRef, session_id: &str) -> FlightKey {
+    (owner.plugin_id.clone(), session_id.to_string())
+}
+
+fn with_flights<T>(act: impl FnOnce(&mut HashMap<FlightKey, u32>) -> T) -> T {
+    act(&mut flights()
+        .lock()
+        .unwrap_or_else(std::sync::PoisonError::into_inner))
+}
+
+#[cfg(test)]
+fn in_flight_count(key: &FlightKey) -> u32 {
+    with_flights(|table| table.get(key).copied().unwrap_or(0))
+}
+
+fn reserve(table: &mut HashMap<FlightKey, u32>, key: &FlightKey) -> Result<(), BrokerRefusal> {
+    if !table.contains_key(key) && table.len() >= MAX_IN_FLIGHT_ROWS {
+        return Err(refused("the llm broker is busy"));
+    }
+    let count = table.entry(key.clone()).or_insert(0);
+    if *count >= MAX_IN_FLIGHT {
+        return Err(refused(
+            "this plugin already has model calls running in this session",
+        ));
+    }
+    *count += 1;
+    Ok(())
+}
+
+fn release(table: &mut HashMap<FlightKey, u32>, key: &FlightKey) {
+    if let Some(count) = table.get_mut(key) {
+        if *count <= 1 {
+            table.remove(key);
+        } else {
+            *count -= 1;
+        }
+    }
+}
+
+struct RecordMeta {
+    plugin_id: String,
+    session_id: String,
+    provider: String,
+    model: String,
+    prompt_bytes: usize,
+    prompt_sha256: String,
+    system_bytes: usize,
+    system_sha256: Option<String>,
+    started: Instant,
+}
+
+fn record_completion(
+    meta: &RecordMeta,
+    gate: &Gate,
+    outcome: &str,
+    observed
```

---

### Incident Patch 2: `7e307504` (2026-11-13)
**Commit Message**: fix(receipts): count edit lines with a line diff, not both whole texts (CW-8147)

edit_line_counts reported every line of the replacement as added and every
line of the searched text as removed, so keeping a 5-line block and adding two
lines printed (+7 -5) where git and the edit card show (+2 -0). Each
search/replace pair is now diffed with make_unified_diff, the diff the edit
card is built from, and counted through the existing diff_counts_by_path;
multi-edit calls sum per pair. Snippets lacking a trailing newline are given
one so counts equal git's whole-file numbers. Removes the stale doc comment
on edit_line_counts, adds a CHANGELOG entry, and adds a regression for insert,
replace, delete, no-trailing-newline, whole new text and multi-edit shapes.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## [Unreleased]
 
 - **Unmodified DSH plugin compatibility (`CW-8020`):** Admitted unmodified `@deepseek-ai/dsh-*` plugins end-to-end with grant-gated host-service bridges (`workspace`, `llm`, `credentials`, `settings`, `pluginManager`, `deepseekAccount`, `terminal`, `remote`), 9 `host-spine` row bridges, inert/mixed `@deepseek-ai/dsh-agent-presets` handling alongside executable composition rows, duplicate-key `package.json` parsing, sanitized manifest descriptions, a `16,384`-file / `256 MiB` bundle budget, and reviewed `registry.npmjs.org` transitive dependency staging during conversion.
+- **Receipt edit line counts:** `/receipts` and session summaries now count `edit_file` additions and deletions using a line diff of each search/replace pair instead of counting every line of both texts, matching `git diff --stat` and edit cards (with multi-edit calls summed per pair). (CW-8147)
 - **Plugin service hardening (terminals, remote pairing, network):** plugin background terminal sessions enforce the per-plugin cap inside the shared session registry after approval waits and close when the plugin owner is revoked or disabled (CW-8051); plugin remote pairing and status serve reviewed plugins only, refuse child-agent and stale requests, validate pairing labels and one-time loopback redemption through host secrets, and keep `remote` in the refused Cordis service and inspect catalogs (CW-8000); plugin network credentials are bound to a single `https` origin per plugin build in a private credential file, check live session posture and destination guards before egress, serialize first-send confirmation per site through `plugin_network_send`, and scrub returned URLs, headers and bodies before returning to plugins (CW-7979).
 - **Auto-Review unattended runs:** tasks, automations, delayed messages and exec runs in Auto-Review follow the unattended rules: they never wait for an approval card.
 - **Agent `cwd` in sibling worktrees:** spawning an agent with `cwd` pointing to an existing linked worktree (or a subdirectory inside it) under the repository's `.codewhale-worktrees/<repo>/` root is now accepted when both share the same repository common git directory; outside directories and foreign or plain directories under `.codewhale-worktrees/` stay refused. (CW-8215)
```

**File**: `crates/engine/src/receipts.rs` (modified, +18/-10)
```diff
@@ -45,6 +45,7 @@ use crate::runtime_threads::{
     RuntimeEventRecord, RuntimeTurnStatus, ThreadRecord, TurnItemKind, TurnItemLifecycleStatus,
     TurnItemRecord, TurnRecord,
 };
+use crate::tools::diff_format::make_unified_diff;
 
 const MAX_COMMAND_CHARS: usize = 200;
 const MAX_ERROR_CHARS: usize = 160;
@@ -1350,8 +1351,6 @@ fn files_from_input(semantic: &str, input: &Value, outcome: StepOutcome) -> Vec<
     }
 }
 
-/// `(+, -)` from an edit call's replacement pairs: the lines of every
-/// replacement text against the lines of every searched text.
 fn edit_line_counts(input: &Value) -> (Option<u64>, Option<u64>) {
     const SEARCH: &[&str] = &["search", "old_string", "old_str", "oldText", "old_text"];
     const REPLACE: &[&str] = &[
@@ -1376,8 +1375,10 @@ fn edit_line_counts(input: &Value) -> (Option<u64>, Option<u64>) {
             continue;
         }
         any = true;
-        removed += line_count(old.as_deref().unwrap_or(""));
-        added += line_count(new.as_deref().unwrap_or(""));
+        let (pair_added, pair_removed) =
+            pair_line_counts(old.as_deref().unwrap_or(""), new.as_deref().unwrap_or(""));
+        added += pair_added;
+        removed += pair_removed;
     }
     if any {
         (Some(added), Some(removed))
@@ -1386,12 +1387,19 @@ fn edit_line_counts(input: &Value) -> (Option<u64>, Option<u64>) {
     }
 }
 
-fn line_count(text: &str) -> u64 {
-    if text.is_empty() {
-        0
-    } else {
-        text.lines().count() as u64
-    }
+fn pair_line_counts(old: &str, new: &str) -> (u64, u64) {
+    let whole_lines = |text: &str| {
+        if text.is_empty() || text.ends_with('\n') {
+            text.to_string()
+        } else {
+            format!("{text}\n")
+        }
+    };
+    let diff = make_unified_diff("edit", &whole_lines(old), &whole_lines(new));
+    diff_counts_by_path(&diff)
+        .get("edit")
+        .copied()
+        .unwrap_or_default()
 }
 
 /// Files and counts from a patch the call supplied: `*** Add/Update/Delete
```

**File**: `crates/engine/src/receipts/tests.rs` (modified, +25/-0)
```diff
@@ -1292,3 +1292,28 @@ fn thread_receipt_sums_turn_tokens_and_points_to_the_usage_endpoint_for_cost() {
             .any(|note| note.starts_with("Cost:"))
     );
 }
+
+#[test]
+fn edit_line_counts_match_git_numstat_for_the_same_edit() {
+    let block = "a\nb\nc\nd\ne\n";
+    let counts = |old: &str, new: &str| {
+        edit_line_counts(&json!({"path": "f", "search": old, "replace": new}))
+    };
+    let some = |added: u64, removed: u64| (Some(added), Some(removed));
+
+    assert_eq!(counts(block, "a\nb\nc\nd\ne\nx\ny\n"), some(2, 0), "insert");
+    assert_eq!(
+        counts(block, "a\nb\nX\nd\ne\n"),
+        some(1, 1),
+        "replace one line"
+    );
+    assert_eq!(counts(block, "a\nb\nd\ne\n"), some(0, 1), "delete");
+    assert_eq!(counts("a\nb", "a\nb\nc"), some(1, 0), "no trailing newline");
+    assert_eq!(counts("", "x\ny\nz\n"), some(3, 0), "whole new text");
+
+    let multi = edit_line_counts(&json!({"path": "f", "edits": [
+        {"search": block, "replace": "a\nb\nX\nd\ne\n"},
+        {"search": "q\nr\n", "replace": "q\nr\ns\n"},
+    ]}));
+    assert_eq!(multi, some(2, 1), "multi-edit sums per pair");
+}
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ## [Unreleased]
 
 - **Unmodified DSH plugin compatibility (`CW-8020`):** Admitted unmodified `@deepseek-ai/dsh-*` plugins end-to-end with grant-gated host-service bridges (`workspace`, `llm`, `credentials`, `settings`, `pluginManager`, `deepseekAccount`, `terminal`, `remote`), 9 `host-spine` row bridges, inert/mixed `@deepseek-ai/dsh-agent-presets` handling alongside executable composition rows, duplicate-key `package.json` parsing, sanitized manifest descriptions, a `16,384`-file / `256 MiB` bundle budget, and reviewed `registry.npmjs.org` transitive dependency staging during conversion.
+- **Receipt edit line counts:** `/receipts` and session summaries now count `edit_file` additions and deletions using a line diff of each search/replace pair instead of counting every line of both texts, matching `git diff --stat` and edit cards (with multi-edit calls summed per pair). (CW-8147)
 - **Plugin service hardening (terminals, remote pairing, network):** plugin background terminal sessions enforce the per-plugin cap inside the shared session registry after approval waits and close when the plugin owner is revoked or disabled (CW-8051); plugin remote pairing and status serve reviewed plugins only, refuse child-agent and stale requests, validate pairing labels and one-time loopback redemption through host secrets, and keep `remote` in the refused Cordis service and inspect catalogs (CW-8000); plugin network credentials are bound to a single `https` origin per plugin build in a private credential file, check live session posture and destination guards before egress, serialize first-send confirmation per site through `plugin_network_send`, and scrub returned URLs, headers and bodies before returning to plugins (CW-7979).
 - **Auto-Review unattended runs:** tasks, automations, delayed messages and exec runs in Auto-Review follow the unattended rules: they never wait for an approval card.
 - **Agent `cwd` in sibling worktrees:** spawning an agent with `cwd` pointing to an existing linked worktree (or a subdirectory inside it) under the repository's `.codewhale-worktrees/<repo>/` root is now accepted when both share the same repository common git directory; outside directories and foreign or plain directories under `.codewhale-worktrees/` stay refused. (CW-8215)
```

---

### Incident Patch 3: `3ac1d9e6` (2026-11-14)
**Commit Message**: fix(engine,workflow,cli): atomic tool outputs, output_path scope, and confined fleet reads

Publish pandoc_convert and speech outputs via atomic workspace replace rather than opening symlinks, follow unresolved link targets component-by-component without lexical normalization before existence checks, reject unknown pandoc_convert fields, judge pandoc_convert write scope on output_path, and refuse symlinked Fleet/Router files across both engine and CLI loaders.

Checks:
- Local preflight: cargo fmt --all -- --check, sh scripts/sync-changelog.sh --check, sh scripts/preflight.sh --check (preflight: OK; 244 literal HTTP paths, 109 suppressions, 668 blocking sites)
- Local clippy: cargo clippy --locked -p codewhale-cli -p codewhale-workflow -p codewhale-engine --lib --tests -- -D warnings (0 warnings)
- Local tests (CODEWHALE_DEV_NEXTEST=0): workflow named_fleet (15 passed, 231 filtered), workflow reasoning_router (12 passed, 234 filtered), cli fleet (4 passed, 381 filtered), engine fleet:: (455 passed, 6985 filtered), engine tools::output_link_tests:: (4 passed, 7436 filtered), engine tools::pandoc (12 passed, 7428 filtered), engine tools::speech (13 passed, 7427 filtered), engine tool

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Chat bridges thread ownership:** Chat bridges now list and resume only the threads the chat itself created: `/threads` shows owned threads, `/resume` refuses any other thread id with one fixed message, and `/new` always starts a new thread. In an existing thread map each chat keeps only the thread it is bound to, so threads it created earlier and left are no longer listed or resumable; a thread that several chats already pointed at is usable from none of them (send `/new`). Review `thread-map.json` after upgrading.
 - **Skill and plugin installs:** skill and plugin installs now enforce the uncompressed size cap on the whole decompressed archive, and reject archive entries with names longer than 4096 bytes.
 - **Built-in execution rules:** a `Bash` deny rule now also blocks built-in test and verifier runs (`Run` / `run_tests` / `run_verifiers`), `workflow` runs with `verify: true`, and delayed-message scheduling (`send_later` `schedule`) while keeping task reads, status checks, management actions, and the bounded verifier's own default verification runs working.
+- **Document conversion, speech output, and workspace Fleet rosters:** `pandoc_convert` and `speech` now replace their output path atomically instead of writing through a symbolic link; `pandoc_convert` rejects unknown input fields, and its write-scope checks follow `output_path`; and repository Fleet and Reasoning Router files (including `--fleet` on the CLI) that are symbolic links are refused as I/O errors rather than being followed or treated as absent.
 - **README and contributor credit:** the repository front page now opens the way the website does: the line "The model can be anyone's. The agent should be yours.", one sentence on what Codewhale is, the install command and one picture, with reference detail moved into the linked guides; the 18 translated READMEs follow the same structure and say they are machine-drafted. The contributor wall and the website now count the same 433 people (407 GitHub accounts and the commit authors whose email is not linked to an account), where the website had counted accounts only. `DEPENDENCY_SECURITY.md` moved into `docs/dependency-maintenance.md`, and `.github/SUPPORT.md` says where to ask for help.
 - **Website Plugins page:** The website's Plugins page now describes what the released version does, and a labelled section says what 0.10.3 adds: one Plugins place, Standard and Creator mode, and the Permissions control.
 - **Website `/app` captures:** the `/app` page's desktop build screenshots (`conversation.webp`, `approval.webp`, `model-picker.webp`) and their alt and caption text have been refreshed from the current 0.10.3 desktop UI.
```

**File**: `crates/cli/src/lib.rs` (modified, +5/-22)
```diff
@@ -1384,12 +1384,8 @@ fn run_workflow_command(
                 workspace.clone()
             };
 
-            // A fleet is an optional pin layer, not a requirement: role-only
-            // tasks resolve against the built-in roster and the session route
-            // (matching the TUI tool path). When a fleet IS given, it is
-            // loaded and validated before the run starts.
             if let Some(name) = fleet.as_deref() {
-                let roots = named_fleet_search_roots(&workspace);
+                let roots = codewhale_engine::fleet::exact::fleet_search_roots(&workspace);
                 let loaded =
                     codewhale_workflow::load_named_fleet(name, &roots).with_context(|| {
                         format!("load Fleet `{name}` from {}", display_roots(&roots))
@@ -1535,23 +1531,10 @@ fn validate_workflow_source_file(path: &Path) -> Result<()> {
     Ok(())
 }
 
-/// The same roots, in the same order, as the TUI's `fleet_search_roots`:
-/// `$CODEWHALE_HOME`, then `<workspace>/.codewhale` (where the Fleet store
-/// saves folder Fleets), then the workspace root for checked-in rosters.
-fn named_fleet_search_roots(workspace: &Path) -> Vec<PathBuf> {
-    let mut roots = Vec::new();
-    if let Ok(home) = codewhale_config::codewhale_home() {
-        roots.push(home);
-    }
-    roots.push(workspace.join(".codewhale"));
-    roots.push(workspace.to_path_buf());
-    roots
-}
-
-fn display_roots(roots: &[PathBuf]) -> String {
+fn display_roots(roots: &[codewhale_workflow::FleetSearchRoot]) -> String {
     roots
         .iter()
-        .map(|root| root.display().to_string())
+        .map(|root| root.root.display().to_string())
         .collect::<Vec<_>>()
         .join(", ")
 }
@@ -9701,13 +9684,13 @@ verbosity = "concise"
     #[test]
     fn named_fleet_search_roots_include_the_saved_workspace_dir() {
         let workspace = Path::new("/ws");
-        let roots = named_fleet_search_roots(workspace);
+        let roots = codewhale_engine::fleet::exact::fleet_search_roots(workspace);
         let tail: Vec<&Path> = roots
             .iter()
             .rev()
             .take(2)
             .rev()
-            .map(PathBuf::as_path)
+            .map(|root| root.root.as_path())
             .collect();
         assert_eq!(tail, [Path::new("/ws/.codewhale"), Path::new("/ws")]);
     }
```

**File**: `crates/engine/src/fleet/exact.rs` (modified, +11/-8)
```diff
@@ -81,14 +81,17 @@ pub fn fleet_search_roots(workspace: &std::path::Path) -> Vec<FleetSearchRoot> {
     if let Ok(home) = personal_fleet_root() {
         roots.push(FleetSearchRoot::new("codewhale_home", home));
     }
-    roots.push(FleetSearchRoot::new(
-        "workspace",
-        workspace.join(".codewhale"),
-    ));
-    roots.push(FleetSearchRoot::new(
-        "workspace_root",
-        workspace.to_path_buf(),
-    ));
+    roots.push(
+        FleetSearchRoot::new(
+            "workspace",
+            codewhale_util::files::workspace_state_dir(workspace),
+        )
+        .with_reader(super::store::read_repository_fleet_file),
+    );
+    roots.push(
+        FleetSearchRoot::new("workspace_root", workspace.to_path_buf())
+            .with_reader(super::store::read_repository_fleet_file),
+    );
     roots
 }
 
```

**File**: `crates/engine/src/fleet/link_tests.rs` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+use std::fs;
+use std::os::unix::fs::symlink;
+
+use codewhale_workflow::{
+    FleetDocument, NamedFleetError, ReasoningRouterError, ReasoningRouterProfile,
+};
+use tempfile::tempdir;
+
+use super::exact::fleet_search_roots;
+use super::store::{
+    FleetFile, FleetMember, FleetOperator, FleetScope, list_fleets, load_fleet_in_scope,
+    read_declared_schema, save_fleet, v2_fleet_candidates,
+};
+use crate::test_support::SealedHome;
+
+const LEGACY: &str = "name = \"OUTSIDE-MARKER\"\n\n[roles]\nbuilder = \"builder\"\n";
+const ROUTER: &str = "name = \"luna-low\"\nschema = \"reasoning_router\"\nschema_revision = 1\nprovider = \"openai\"\nmodel = \"gpt-5.6-luna\"\n";
+const NOT_TOML: &str = "machine example.test login OUTSIDE-MARKER\n";
+
+fn legacy(name: &str) -> String {
+    format!("name = \"{name}\"\n\n[roles]\nbuilder = \"builder\"\n")
+}
+
+fn team() -> FleetFile {
+    let mut fleet = FleetFile::new("Team".to_string(), None).expect("valid fleet");
+    fleet.operator = Some(FleetOperator {
+        provider: "deepseek".to_string(),
+        model: "deepseek-v4-flash".to_string(),
+        reasoning: Some("low".to_string()),
+    });
+    fleet.members.push(FleetMember {
+        id: "scout".to_string(),
+        display_name: None,
+        shortlist: false,
+        role: "scout".to_string(),
+        provider: None,
+        model: None,
+        reasoning: None,
+        instructions: None,
+        requires: Vec::new(),
+    });
+    fleet
+}
+
+fn assert_refused_without_content(error: &NamedFleetError) {
+    assert!(matches!(error, NamedFleetError::Io { .. }), "{error:?}");
+    assert!(!error.to_string().contains("OUTSIDE-MARKER"), "{error}");
+}
+
+#[test]
+fn linked_fleet_and_router_files_are_refused_whether_or_not_the_target_exists() {
+    let _home = SealedHome::new();
+    let ws = tempdir().unwrap();
+    let outside = tempdir().unwrap();
+    fs::create_dir_all(ws.path().join("fleets")).unwrap();
+    fs::create_dir_all(ws.path().join("routers")).unwrap();
+    fs::write(outside.path().join("fleet.toml"), LEGACY).unwrap();
+    fs::write(outside.path().join("router.txt"), NOT_TOML).unwrap();
+    symlink(
+        outside.path().join("fleet.toml"),
+        ws.path().join("fleets").join("linked.toml"),
+    )
+    .unwrap();
+    symlink(
+        outside.path().join("absent.toml"),
+        ws.path().join("fleets").join("dangling.toml"),
+    )
+    .unwrap();
+    symlink(
+        outside.path().join("router.txt"),
+        ws.path().join("routers").join("leak.toml"),
+    )
+    .unwrap();
+    symlink(
+        outside.path().join("absent.toml"),
+        ws.path().join("routers").join("gone.toml"),
+    )
+    .unwrap();
+    let roots = fleet_search_roots(ws.path());
+
+    for name in ["linked", "dangling"] {
+        let error = FleetDocument::load_by_name(name, &roots).expect_err(name);
+        assert_refused_without_content(&error);
+    }
+    for name in ["leak", "gone"] {
+        let error = ReasoningRouterProfile::load_by_name(name, &roots).expect_err(name);
+        assert!(
+            matches!(error, ReasoningRouterError::Io { .. }),
+            "{error:?}"
+        );
+        assert!(!error.to_string().contains("OUTSIDE-MARKER"), "{error}");
+    }
+}
+
+#[test]
+fn linked_fleet_directories_are_refused() {
+    let _home = SealedHome::new();
+    let ws = tempdir().unwrap();
+    let outside = tempdir().unwrap();
+    fs::create_dir_all(outside.path().join("fleets")).unwrap();
+    fs::create_dir_all(outside.path().join("routers")).unwrap();
+    fs::write(
+        outside.path().join("fleets").join("pair.toml"),
+        legacy("pair"),
+    )
+    .unwrap();
+    fs::write(outside.path().join("routers").join("luna-low.toml"), ROUTER).unwrap();
+    symlink(outside.path().join("fleets"), ws.path().join("fleets")).unwrap();
+    symlink(outside.path().join("routers"), ws.path().join("routers")).unwrap();
+    let roots = fleet_search_roots(ws.path());
+
+    FleetDocument::load_by_name("pair", &roots).expect_err("a linked fleets directory");
+    ReasoningRouterProfile::load_by_name("luna-low", &roots)
+        .expect_err("a linked routers directory");
+
+    let state = tempdir().unwrap();
+    fs::create_dir_all(state.path().join("fleets")).unwrap();
+    fs::write(
+        state.path().join("fleets").join("held.toml"),
+        legacy("held"),
+    )
+    .unwrap();
+    let linked_state = tempdir().unwrap();
+    symlink(state.path(), linked_state.path().join(".codewhale")).unwrap();
+    let roots = fleet_search_roots(linked_state.path());
+    FleetDocument::load_by_name("workspace/held", &roots).expect_err("a linked .codewhale");
+}
+
+#[test]
+fn plain_files_and_operator_owned_links_still_load() {
+    let home = SealedHome::new();
+    let ws = tempdir().unwrap();
+    fs::create_dir_all(ws.path().join("fleets")).unwrap();
+    fs::create_dir_all(ws.path().join(".codewhale").join("fleets")).unwrap();
+    fs::create_dir_all(ws.pa
```

**File**: `crates/engine/src/fleet/mod.rs` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ pub mod executor;
 pub mod host;
 pub mod identity;
 pub mod ledger;
+#[cfg(all(test, unix))]
+mod link_tests;
 pub mod manager;
 pub mod members;
 pub mod placement;
```

**File**: `crates/engine/src/fleet/store.rs` (modified, +71/-29)
```diff
@@ -603,7 +603,38 @@ fn personal_fleets_dir() -> Result<PathBuf, FleetStoreError> {
 }
 
 fn workspace_fleets_dir(workspace: &Path) -> PathBuf {
-    workspace.join(".codewhale").join(FLEET_DIR)
+    codewhale_util::files::workspace_state_path(workspace, Path::new(FLEET_DIR)).1
+}
+
+pub fn read_repository_fleet_file(path: &Path) -> std::io::Result<String> {
+    let root = path
+        .parent()
+        .and_then(Path::parent)
+        .ok_or_else(|| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
+    if root
+        .file_name()
+        .is_some_and(|name| name == codewhale_paths::CODEWHALE_APP_DIR)
+    {
+        let metadata = fs::symlink_metadata(root)?;
+        if codewhale_util::path_identity::metadata_is_link_or_reparse(&metadata) {
+            return Err(std::io::Error::new(
+                std::io::ErrorKind::InvalidInput,
+                format!("Refusing symlinked path {}", root.display()),
+            ));
+        }
+    }
+    codewhale_util::fs_confined::read_to_string(root, path)
+}
+
+fn read_store_file(path: &Path) -> std::io::Result<String> {
+    if personal_fleets_dir()
+        .ok()
+        .is_some_and(|personal| path.starts_with(personal))
+    {
+        fs::read_to_string(path)
+    } else {
+        read_repository_fleet_file(path)
+    }
 }
 
 /// The fleet directory for a scope, creating it if needed.
@@ -658,11 +689,13 @@ pub fn list_fleets(workspace: &Path) -> Vec<FleetEntry> {
     if let Ok(dir) = personal_fleets_dir() {
         collect_entries(&dir, FleetScope::Personal, &mut entries);
     }
-    collect_entries(
-        &workspace_fleets_dir(workspace),
-        FleetScope::Workspace,
-        &mut entries,
-    );
+    if reject_linked_workspace_dir(FleetScope::Workspace, workspace).is_ok() {
+        collect_entries(
+            &workspace_fleets_dir(workspace),
+            FleetScope::Workspace,
+            &mut entries,
+        );
+    }
     entries.sort_by(|a, b| {
         a.scope
             .label()
@@ -687,18 +720,18 @@ fn collect_entries(dir: &Path, scope: FleetScope, out: &mut Vec<FleetEntry>) {
             .file_stem()
             .map(|s| s.to_string_lossy().into_owned())
             .unwrap_or_default();
-        let text = fs::read_to_string(&path).ok();
-        let parse_error = text
-            .as_deref()
-            .and_then(|text| FleetFile::parse(text).err())
-            .map(|e| e.to_string());
+        let read = read_store_file(&path);
+        let text = read.as_deref().ok();
+        let parse_error = match &read {
+            Ok(text) => FleetFile::parse(text).err().map(|e| e.to_string()),
+            Err(e) => Some(e.to_string()),
+        };
         let legacy = parse_error.as_deref().is_some_and(|err| {
             err.contains("unknown schema") || err.contains("invalid fleet TOML")
         });
         // The row shows the Fleet's own display name, never the file slug —
         // a file saved as `Temp Fleet` must not appear as `temp-fleet`.
         let name = text
-            .as_deref()
             .and_then(|text| toml::from_str::<toml::Value>(text).ok())
             .and_then(|value| {
                 value
@@ -735,7 +768,6 @@ pub fn v2_fleet_candidates(name: &str, workspace: &Path) -> Vec<(FleetScope, Pat
         (FleetScope::Workspace, workspace),
     ] {
         if let Some(path) = path
-            && path.is_file()
             && declares_v2_schema(&path)
         {
             found.push((scope, path));
@@ -748,7 +780,7 @@ pub fn v2_fleet_candidates(name: &str, workspace: &Path) -> Vec<(FleetScope, Pat
 /// the file cannot be read; `Some(None)` when it is readable but declares no
 /// schema (or is not valid TOML).
 pub fn read_declared_schema(path: &Path) -> Option<Option<String>> {
-    fs::read_to_string(path)
+    read_store_file(path)
         .ok()
         .map(|text| codewhale_workflow::fleet_exact::declared_schema_kind(&text))
 }
@@ -782,7 +814,7 @@ pub fn load_fleet(
     let Some((scope, path)) = found.pop() else {
         return Err(FleetStoreError::NotFound(name.to_string()));
     };
-    let text = fs::read_to_string(&path).map_err(|e| FleetStoreError::Io {
+    let text = read_store_file(&path).map_err(|e| FleetStoreError::Io {
         path: path.display().to_string(),
         message: e.to_string(),
     })?;
@@ -806,17 +838,27 @@ pub fn load_fleet_in_scope(
         FleetScope::Workspace => workspace_fleets_dir(workspace),
     };
     let path = dir.join(format!("{}.toml", slugify(name)));
-    if !path.is_file() {
-        return Err(FleetStoreError::NotFound(format!(
-            "{} ({})",
-            name,
-            scope.label()
-        )));
-    }
-    let text = fs::read_to_string(&path).map_err(|e| FleetStoreError::Io {
-        path: path.display().to_string(),
-        message: e.to_string(),
-    })?;
+    let text = match read_store_file(&path) {
+        Ok(text) => text,
+        Err(e)
+            if matches!(
+                e.kind()
```

**File**: `crates/engine/src/tools/file.rs` (modified, +9/-2)
```diff
@@ -695,7 +695,10 @@ async fn acquire_file_mutation(
 /// rename (and a retry loop on Windows) must not park a Tokio worker
 /// (blocking-call convention, #6149). Error shape matches the historical
 /// inline call.
-async fn run_blocking_write_atomic(path: &Path, contents: Vec<u8>) -> Result<(), ToolError> {
+pub(super) async fn run_blocking_write_atomic(
+    path: &Path,
+    contents: Vec<u8>,
+) -> Result<(), ToolError> {
     let path = path.to_path_buf();
     tokio::task::spawn_blocking(move || {
         codewhale_util::utils::write_atomic_workspace(&path, &contents).map_err(|e| {
@@ -939,7 +942,11 @@ async fn contract_mutation_result(
     }))
 }
 
-fn reject_primitive_unknown(input: &Value, tool: &str, allowed: &[&str]) -> Result<(), ToolError> {
+pub(super) fn reject_primitive_unknown(
+    input: &Value,
+    tool: &str,
+    allowed: &[&str],
+) -> Result<(), ToolError> {
     let object = input
         .as_object()
         .ok_or_else(|| ToolError::invalid_input(format!("{tool} input must be an object")))?;
```

**File**: `crates/engine/src/tools/mod.rs` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@ pub mod lsp;
 pub mod mcp_registry;
 pub mod native_memory;
 pub mod notify;
+#[cfg(all(test, unix))]
+mod output_link_tests;
 pub mod pandoc;
 pub mod pdf;
 pub mod plan;
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

## X. extension-host): fill the dsh/broker llm arm on the Engine's own auxiliary model

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9b567b2b`: extension-host): fill the dsh/broker llm arm on the Engine's own auxiliary model call (CW-7973). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **Plugin LLM broker arm (gated off):** adds the `dsh/broker` `llm` service arm (`catalog`, `complete`) and TypeScript SDK adapter, routing completions over the active session route with an isolated plugin prompt (omitting workspace instructions, account constitution, and other plugins' prompt sections), session permission-gate checks (`Read`/`Reach`), and bounded concurrency; host injection stays disabled by default pending final review. (CW-7973)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9b567b2b` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
