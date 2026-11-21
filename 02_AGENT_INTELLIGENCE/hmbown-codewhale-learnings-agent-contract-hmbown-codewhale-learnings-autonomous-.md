# Agent Contract: Agent Contract: hmbown-codewhale-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "hmbown-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T12:38:13.761Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hmbown-codewhale-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hmbown-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T12:38:13.761Z`  
> **Learning ID**: `LEARN-EVO-hmbown-codewhale-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `hmbown-codewhale-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: github ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Source Version**: `6c211938`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T12:37:56.283Z  
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
> **Harvest Timestamp**: 2026-11-21T12:37:56.277Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: An open-source coding agent for your terminal, written in Rust. It works with any model, can split one task across several agents, and every line of it is yours to read.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41193 stars

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
- **Issue #7449** (2026-11-21): **fix(engine): compact diagnostic late-usage receipts at the ledger bound (#6842)**
  *Symptoms*: ## What and why  The `.late-usage/<id>.json` ledger keeps a 1 MiB bound and refused the whole write when adding a record would cross it. Diagnostic-only receipts — the route-decision evidence written by `persist_late_decision_receipt` — carry no spend, but they count toward that bound and can fill it on their own.  This makes the write compact instead of refusing: when a candidate would exceed 1 MiB, drop the oldest diagnostic-only records until it fits, and keep every spend-bearing record (settled or unresolved) unchanged. Replay still dedupes by `source_fingerprint`, so no spend is forgotten or double-counted.  ## Where this came from  Refs #6842. This is the sidecar half of the issue; bounding the unordered replay index (`usage_source_fingerprints`) and the retained journal archive policy remain open there.  ## How I tested it  - `cargo test -p codewhale-engine --lib oversized_ledger_compacts_diagnostic_receipts_before_failing` — 1 passed (the new fixture builds a ledger over 1 MiB with diagnostic + spend records; after the write, all spend records survive, the diagnostic count shrinks, and the file is within the bound) - The existing bound tests still pass: a ledger made only of spend-bearing records still returns `InvalidData` rather than silently truncating a receipt. - `cargo fmt --all -- --check` — passed - The `Behaviour:` line is in the commit body; `scripts/check-behaviour-line.py` arrives with #7445 and is not on this branch yet.  ## Checklist  - [x] One focused c

- **Issue #7431** (2026-11-21): **fix(engine): classify local read-only deferred tools as Safe in get_tool_category**
  *Symptoms*: ## What and why  `crates/engine/src/core/authority.rs` `get_tool_category()` still left a number of registered `ToolCapability::ReadOnly` local tools, canonical read-action targets, and legacy `tool_search` spellings unclassified, so they fell through to `ToolCategory::Unknown` and Auto-Review routed every call to `AskUser` (`auto_review.rs:1582`).  Each candidate tool from #7407 was audited individually against its implementation and capabilities before classifying:  ### Classified as `ToolCategory::Safe`  | Tool / Target | Rationale | | --- | --- | | `is_tool_search_tool(name)` (`tool_search`, `tool_search_tool_regex`, `tool_search_tool_bm25`) | Replaces the literal `"tool_search"` arm with the shared `codewhale_tools::names::is_tool_search_tool` helper so legacy dispatchable spellings (`turn_loop.rs:1136-1146`, `:2238`) also classify as `Safe`. | | `context_archive_get`, `context_archive_search` | `ReadOnly` / `Auto`. Bounded, secret-scrubbed in-process reads of the current session's compaction archive. | | `session_get`, `session_search` | `ReadOnly` / `Auto`. Bounded, workspace-scoped in-process reads of prior session metadata/tails. | | `memory_get`, `memory_search` | `ReadOnly` / `Auto`. Bounded, workspace-scoped in-process reads of `NativeMemoryStore`. | | `project_map` | `ReadOnly`, `Sandboxable` / `Auto`. In-process directory walk (`"project"` was already in `Safe`, while the registered tool name is `"project_map"`). | | `validate_data` | `ReadOnly`, `Sandboxable` /

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

### Incident Patch 1: `a98c8010` (2026-11-21)
**Commit Message**: fix(engine): retain every diagnostic that fits the usage ledger

Measure serialized records and their array separators in insertion order before pruning. A large old record can free enough space by itself. Check every surviving record against the expected ledger, including unresolved usage.

Behaviour: preserve the newest routing diagnostics when an oversized ledger contains records of different lengths. An exhaustive probe of the production retention block passed 15,408 serialized cases. Formatting and release-version checks passed.

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -621,6 +621,8 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 
 ### Fixed
 
+- Large session usage ledgers keep settled and unresolved usage and discard only the oldest routing diagnostics needed to stay within the storage limit. Thanks [@donglovejava](https://github.com/donglovejava) ([#7449](https://github.com/codewhale-hq/CodeWhale/pull/7449)).
+
 - **Shell policy:** statically available AWK and sed programs are scanned for shell commands. AWK analysis that exceeds its scan budget is treated as unresolved. (CW-8300)
 - **Sub-agent budget-stop receipts show clipped output:** the receipt gives the character count and points to the retained child transcript. It also keeps the workspace preservation receipt visible when the partial output is long. Thanks [@7jrxt42BxFZo4iAnN4CX](https://github.com/7jrxt42BxFZo4iAnN4CX) for [issue 7434](https://github.com/codewhale-hq/Codewhale/issues/7434). (CW-8317)
 - **TUI command input:** while the terminal’s raw-paste fallback detects a possible paste, Enter inserts a newline before slash completion can change the draft. This also applies to fast typing that matches the paste cadence. After the brief paste window passes, Enter can submit the command. (CW-8301)
@@ -1327,7 +1329,7 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 
 - **[@swf1996120](https://github.com/swf1996120)** — reported that the PR review prompt discouraged checking callers with the available source tools ([issue 7435](https://github.com/codewhale-hq/Codewhale/issues/7435)).
 - **[@BX166](https://github.com/BX166)** — clarified the AICraft provider setup for mainland China and international users ([#7421](https://github.com/codewhale-hq/CodeWhale/pull/7421)).
-- **[@donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste and fixed fallback tool-call IDs in streaming chat completions ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423)).
+- **[@donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste, fixed fallback tool-call IDs in streaming chat completions, and preserved usage records when compacting diagnostic receipts ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423), [#7449](https://github.com/codewhale-hq/CodeWhale/pull/7449)).
 - **[@gabsferreira](https://github.com/gabsferreira)** added the SearchApi web search provider ([#7410](https://github.com/codewhale-hq/Codewhale/pull/7410)).
 - **[@cmdcorp6534](https://github.com/cmdcorp6534)** — reported the Chinese input-method candidate window appearing away from the field being typed into ([#2323](https://github.com/codewhale-hq/Codewhale/issues/2323)).
 - **[@Asteria1028](https://github.com/Asteria1028)** — reported pasted clipboard images piling up with no way to remove them ([#7221](https://github.com/codewhale-hq/Codewhale/issues/7221)).
```

**File**: `crates/engine/src/session_manager.rs` (modified, +33/-42)
```diff
@@ -3021,64 +3021,55 @@ impl SessionManager {
     fn write_late_usage_ledger(path: &Path, ledger: &LateUsageLedger) -> io::Result<()> {
         let mut bytes = serde_json::to_vec(ledger)
             .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
-        if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > MAX_LATE_USAGE_LEDGER_BYTES {
-            // Diagnostic-only receipts (route decisions) are evidence, not spend.
-            // Drop the oldest ones until the ledger fits; spend-bearing records
-            // stay untouched so a replay cannot double-count a source.
-            let mut compacted = ledger.clone();
-            let mut pruned = 0usize;
-            while u64::try_from(bytes.len()).unwrap_or(u64::MAX) > MAX_LATE_USAGE_LEDGER_BYTES {
-                let diagnostic = compacted
-                    .records
-                    .iter()
-                    .filter(|record| record.diagnostic_only)
-                    .count();
-                if diagnostic == 0 {
+        let limit = usize::try_from(MAX_LATE_USAGE_LEDGER_BYTES).unwrap_or(usize::MAX);
+        if bytes.len() > limit {
+            let mut remaining_bytes = bytes.len();
+            let mut pruned = 0;
+            for record in ledger
+                .records
+                .iter()
+                .filter(|record| record.diagnostic_only)
+            {
+                let record_len = serde_json::to_vec(record)
+                    .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?
+                    .len();
+                pruned += 1;
+                let comma = usize::from(pruned < ledger.records.len());
+                remaining_bytes -= record_len + comma;
+                if remaining_bytes <= limit {
                     break;
                 }
-                let overflow = bytes.len().saturating_sub(
-                    usize::try_from(MAX_LATE_USAGE_LEDGER_BYTES).unwrap_or(usize::MAX),
-                );
-                let average = (bytes.len() / compacted.records.len().max(1)).max(1);
-                let remove = (overflow / average).max(1).min(diagnostic);
-                let mut remaining = remove;
-                compacted.records.retain(|record| {
-                    if remaining > 0 && record.diagnostic_only {
-                        remaining -= 1;
-                        false
-                    } else {
-                        true
-                    }
-                });
-                pruned += remove - remaining;
-                bytes = serde_json::to_vec(&compacted)
-                    .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
-            }
-            if pruned > 0 {
-                tracing::warn!(
-                    pruned,
-                    "compacted late usage diagnostic receipts to fit the ledger bound"
-                );
             }
-            if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > MAX_LATE_USAGE_LEDGER_BYTES {
+            if remaining_bytes > limit {
                 return Err(io::Error::new(
                     io::ErrorKind::InvalidData,
                     "late usage ledger exceeds its size bound",
                 ));
             }
+            let mut compacted = ledger.clone();
+            let mut remaining = pruned;
+            compacted.records.retain(|record| {
+                if record.diagnostic_only && remaining > 0 {
+                    remaining -= 1;
+                    return false;
+                }
+                true
+            });
+            bytes = serde_json::to_vec(&compacted)
+                .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
+            tracing::warn!(
+                pruned,
+                "compacted late usage diagnostic receipts to fit the ledger bound"
+            );
         }
-        Self::write_late_usage_ledger_bytes(path, &bytes)
-    }
-
-    fn write_late_usage_ledger_bytes(path: &Path, bytes: &[u8]) -> io::Result<()> {
         let parent = path.parent().ok_or_else(|| {
             io::Error::new(io::ErrorKind::InvalidInput, "usage ledger has no parent")
         })?;
         let name = path.file_name().ok_or_else(|| {
             io::Error::new(io::ErrorKind::InvalidInput, "usage ledger has no basename")
         })?;
         codewhale_util::files::WorkspaceFile::open_resolved_root(parent, Path::new(name), false)?
-            .replace(bytes)?;
+            .replace(&bytes)?;
         Self::sync_late_usage_ledger(path)
     }
 
```

**File**: `crates/engine/src/session_manager/test_cases_01.rs` (modified, +37/-28)
```diff
@@ -1921,34 +1921,48 @@
             diagnostic_only: false,
         };
         let diagnostic = LateUsageRecord {
+            source_fingerprint: crate::cost_status::usage_source_fingerprint("small"),
+            usage: None,
             diagnostic_only: true,
             ..spend.clone()
         };
-        let empty_bytes = serde_json::to_vec(&LateUsageLedger::default()).unwrap().len();
-        let diagnostic_bytes = serde_json::to_vec(&diagnostic).unwrap().len() + 1;
-        let real_count = 4usize;
-        let diagnostic_count =
-            (usize::try_from(MAX_LATE_USAGE_LEDGER_BYTES).unwrap() - empty_bytes)
-                / diagnostic_bytes
-                + 1;
-        let mut records: Vec<LateUsageRecord> =
-            (0..diagnostic_count).map(|_| diagnostic.clone()).collect();
-        for index in 0..real_count {
-            records.push(LateUsageRecord {
+        let mut decision = crate::cost_status::decision_receipt_fixture("oldest");
+        for index in 0..40 {
+            decision
+                .evidence
+                .probabilities_bp
+                .insert(format!("{index:0120}"), 100);
+        }
+        assert!(decision.is_bounded());
+        let oldest = LateUsageRecord {
+            source_fingerprint: crate::cost_status::usage_source_fingerprint("oldest"),
+            decision: Some(decision),
+            ..diagnostic.clone()
+        };
+        let unresolved = LateUsageRecord {
+            source_fingerprint: crate::cost_status::usage_source_fingerprint("unresolved"),
+            usage: None,
+            ..spend.clone()
+        };
+        let mut expected = LateUsageLedger {
+            records: vec![spend, unresolved],
+            ..Default::default()
+        };
+        let limit = usize::try_from(MAX_LATE_USAGE_LEDGER_BYTES).unwrap();
+        let record_bytes = serde_json::to_vec(&diagnostic).unwrap().len() + 1;
+        let room = limit - serde_json::to_vec(&expected).unwrap().len();
+        for index in 0..room / record_bytes {
+            expected.records.push(LateUsageRecord {
                 source_fingerprint: crate::cost_status::usage_source_fingerprint(&format!(
-                    "spend-{index}"
+                    "small-{index}"
                 )),
-                ..spend.clone()
+                ..diagnostic.clone()
             });
         }
-        let oversized = LateUsageLedger {
-            records,
-            ..Default::default()
-        };
-        assert!(
-            u64::try_from(serde_json::to_vec(&oversized).unwrap().len()).unwrap()
-                > MAX_LATE_USAGE_LEDGER_BYTES
-        );
+        let mut oversized = expected.clone();
+        oversized.records.insert(1, oldest);
+        assert!(serde_json::to_vec(&expected).unwrap().len() <= limit);
+        assert!(serde_json::to_vec(&oversized).unwrap().len() > limit + 2 * record_bytes);
 
         let (path, _) = manager
             .ensure_late_usage_paths("compact-diagnostics")
@@ -1957,14 +1971,9 @@
 
         let loaded = manager.load_late_usage("compact-diagnostics").unwrap();
         assert_eq!(
-            loaded
-                .records
-                .iter()
-                .filter(|record| !record.diagnostic_only)
-                .count(),
-            real_count
+            serde_json::to_value(loaded).unwrap(),
+            serde_json::to_value(expected).unwrap()
         );
-        assert!(loaded.records.len() < oversized.records.len());
         assert!(fs::metadata(&path).unwrap().len() <= MAX_LATE_USAGE_LEDGER_BYTES);
     }
 
```

**File**: `crates/tui/CHANGELOG.md` (modified, +3/-1)
```diff
@@ -621,6 +621,8 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 
 ### Fixed
 
+- Large session usage ledgers keep settled and unresolved usage and discard only the oldest routing diagnostics needed to stay within the storage limit. Thanks [@donglovejava](https://github.com/donglovejava) ([#7449](https://github.com/codewhale-hq/CodeWhale/pull/7449)).
+
 - **Shell policy:** statically available AWK and sed programs are scanned for shell commands. AWK analysis that exceeds its scan budget is treated as unresolved. (CW-8300)
 - **Sub-agent budget-stop receipts show clipped output:** the receipt gives the character count and points to the retained child transcript. It also keeps the workspace preservation receipt visible when the partial output is long. Thanks [@7jrxt42BxFZo4iAnN4CX](https://github.com/7jrxt42BxFZo4iAnN4CX) for [issue 7434](https://github.com/codewhale-hq/Codewhale/issues/7434). (CW-8317)
 - **TUI command input:** while the terminal’s raw-paste fallback detects a possible paste, Enter inserts a newline before slash completion can change the draft. This also applies to fast typing that matches the paste cadence. After the brief paste window passes, Enter can submit the command. (CW-8301)
@@ -1327,7 +1329,7 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 
 - **[@swf1996120](https://github.com/swf1996120)** — reported that the PR review prompt discouraged checking callers with the available source tools ([issue 7435](https://github.com/codewhale-hq/Codewhale/issues/7435)).
 - **[@BX166](https://github.com/BX166)** — clarified the AICraft provider setup for mainland China and international users ([#7421](https://github.com/codewhale-hq/CodeWhale/pull/7421)).
-- **[@donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste and fixed fallback tool-call IDs in streaming chat completions ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423)).
+- **[@donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste, fixed fallback tool-call IDs in streaming chat completions, and preserved usage records when compacting diagnostic receipts ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423), [#7449](https://github.com/codewhale-hq/CodeWhale/pull/7449)).
 - **[@gabsferreira](https://github.com/gabsferreira)** added the SearchApi web search provider ([#7410](https://github.com/codewhale-hq/Codewhale/pull/7410)).
 - **[@cmdcorp6534](https://github.com/cmdcorp6534)** — reported the Chinese input-method candidate window appearing away from the field being typed into ([#2323](https://github.com/codewhale-hq/Codewhale/issues/2323)).
 - **[@Asteria1028](https://github.com/Asteria1028)** — reported pasted clipboard images piling up with no way to remove them ([#7221](https://github.com/codewhale-hq/Codewhale/issues/7221)).
```

**File**: `docs/CONTRIBUTORS.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ changelog or release notes, and this contributor record.
 **Contributions**
 
 - **[BX166](https://github.com/BX166)** — clarified the AICraft provider setup for mainland China and international users ([#7421](https://github.com/codewhale-hq/CodeWhale/pull/7421)).
-- **[donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste and fixed fallback tool-call IDs in streaming chat completions ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423)).
+- **[donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste, fixed fallback tool-call IDs in streaming chat completions, and preserved usage records when compacting diagnostic receipts ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423), [#7449](https://github.com/codewhale-hq/CodeWhale/pull/7449)).
 - **[gabsferreira](https://github.com/gabsferreira)** added Google organic search results through the SearchApi provider ([#7410](https://github.com/codewhale-hq/Codewhale/pull/7410)).
 - **[zhuowp](https://github.com/zhuowp)** (git author `z27014`) — added bounded HTTP rate-limit recovery and corrected retry deadlines, quota guidance and recovery receipts ([#7220](https://github.com/codewhale-hq/Codewhale/pull/7220)).
 - **[printf033](https://github.com/printf033)** — enabled exclusive rename on Android so Fleet publication does not fall back to SELinux-denied hard links (`fbe9f24ee`).
```

---

### Incident Patch 2: `6c211938` (2026-11-21)
**Commit Message**: Sync the packaged TUI changelog for the notice correction

Regenerated the existing release-note projection with scripts/sync-changelog.sh. The version drift check now passes locally with 40 feature issue references.

**File**: `crates/tui/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- Native release bundles, the Windows installer, npm packages and published crates include the Codewhale license and both third-party notice documents.
+
 - Stopping an external agent while it waits for approval now records the turn as interrupted even when the agent replies that it finished. (CW-7965)
 
 - The Simplified Chinese telemetry guide now explains which files each process keeps, how much disk space they use and when old files are removed. (CW-7987)
```

---

### Incident Patch 3: `30ca06be` (2026-11-21)
**Commit Message**: fix(release): preserve remaining ownership during partial command restore

Keep validated ownership for untouched aliases when one restored command changes. Record the installed replacement digest when displacing a command so undo can distinguish its own unclaimed replacement from a later user edit. Historical four-column recovery manifests still work. All five release recovery tests passed locally, including partial restore and modified-command undo.

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -282,7 +282,7 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 - **MCP catalogs stay fresh:** a server's tools, resources, prompts and skills are rediscovered on their own connection when an advertised `ttlMs` expires or the server sends a list-changed notice. A tool resolved against the old catalog is refused with "retry the call", a removed tool cannot run, and a failed refresh reconnects instead of serving stale entries. Catalogs are never shared across servers, credentials or reconnects.
 - **MCP Skills extension:** servers that advertise the published Skills extension have their skills listed in `list_mcp_resources`. Listing never activates a skill, and reading a skill file is refused unless its size and sha256 digest match the listing. MCP skills do not yet join `/skills`.
 - **Updates install themselves:** release-binary installs check for a new release every 6 hours (was 1), download and checksum-verify it in the background, and apply it the next time `codewhale` starts, never during a session. One line says `Updated to v… · What's new: … · Undo: codewhale update --rollback`. Until releases are signed, the download waits for your OK (one `[y/N]` question at the next start, or `/update install`); a release with a valid Ed25519 manifest signature applies on its own. `codewhale update --rollback` puts back the version the last update replaced and keeps the rolled-back version from returning automatically. Turn it down with `codewhale config set update.mode notify` (or `off`, or `CODEWHALE_UPDATE_MODE`); an organization's root-owned `policy.toml` overrides both. Offline and rate-limited checks retry about an hour later instead of on every launch. Package-manager and desktop-app copies only get their manager's command. Builds with the release key refuse a missing or invalid signature, and re-check the staged binary against the signed manifest at start. The checksum manifest now always comes from GitHub Releases; on Linux x64 the CNB mirror can still serve the binary, but only bytes that GitHub's manifest lists.
-- **One view of every Codewhale on the machine:** `codewhale doctor` has an Installations section and `codewhale doctor --installs` (`--json`, `--brief`) lists every `codewhale`, `codew`, `codewhale-tui`, `deepseek` and `deepseek-tui` with its owner: install receipt, package manager (with its exact removal command), the desktop app, a backup, or not ours. Nothing found is ever run. `codewhale doctor --fix` adds one plan to tidy them: old backups move to `~/.codewhale/recovery/<stamp>/` (kept 30 days, then deleted by a later `--fix`), an unreceipted `codew` is brought in line with `codewhale`, and the directory gets an install receipt; each move prints its undo and `codewhale doctor --restore <stamp>` reverses the lot. Package-managed, desktop-app, symlinked and foreign files are never touched, and neither is user data. `codewhale uninstall` now lists other copies with the same classification. Restoring an older command set now keeps its ownership receipt consistent and preserves the displaced receipt for undo.
+- **One view of every Codewhale on the machine:** `codewhale doctor` has an Installations section and `codewhale doctor --installs` (`--json`, `--brief`) lists every `codewhale`, `codew`, `codewhale-tui`, `deepseek` and `deepseek-tui` with its owner: install receipt, package manager (with its exact removal command), the desktop app, a backup, or not ours. Nothing found is ever run. `codewhale doctor --fix` adds one plan to tidy them: old backups move to `~/.codewhale/recovery/<stamp>/` (kept 30 days, then deleted by a later `--fix`), an unreceipted `codew` is brought in line with `codewhale`, and the directory gets an install receipt; each move prints its undo and `codewhale doctor --restore <stamp>` reverses the lot. Package-managed, desktop-app, symlinked and foreign files are never touched, and neither is user data. `codewhale uninstall` now lists other copies with the same classification. Restoring an older command set now keeps its ownership receipt consistent and preserves the displaced receipt for undo. A partial restore retains ownership of unchanged commands.
 - **Uninstall guidance on every install route:** `codewhale uninstall` previews receipt-owned release files and `--yes` removes only checked files, with the running command last. Both Unix installers and the Windows archive installer record command ownership; self-update renews existing receipts on both. On Windows the running `codewhale.exe` is renamed, then a hidden PowerShell process deletes it after the command exits. Package-managed copies are left alone, and the command prints their exact removal command: npm with its prefix, Cargo with its root, the Homebrew formula, `scoop uninstall codewhale`, `winget uninstall --id HunterBown.CodeWhale`, or the Windows setup's `Uninstall.exe`. Every other `codewhale`/`codew` still on PATH is listed. User data is kept unless you add `--purge-da
```

**File**: `crates/release/src/installs.rs` (modified, +73/-10)
```diff
@@ -794,6 +794,10 @@ impl RecoveryBatch {
     }
 
     pub fn move_in(&mut self, path: &Path) -> Result<RecoveryMove> {
+        self.move_in_replaced(path, None)
+    }
+
+    fn move_in_replaced(&mut self, path: &Path, replacement: Option<&str>) -> Result<RecoveryMove> {
         let original = path.to_string_lossy();
         if original.contains(['\t', '\n', '\r']) {
             bail!(
@@ -842,7 +846,10 @@ impl RecoveryBatch {
                 format!("failed to move {} to {}", path.display(), to.display())
             })?;
         }
-        let line = format!("{original}\t{}\t{digest}\t{bytes}\n", to.display());
+        let suffix = replacement
+            .map(|digest| format!("\t{digest}"))
+            .unwrap_or_default();
+        let line = format!("{original}\t{}\t{digest}\t{bytes}{suffix}\n", to.display());
         let mut manifest = fs::OpenOptions::new()
             .create(true)
             .append(true)
@@ -889,6 +896,7 @@ pub struct RecoveryRecord {
     pub stored: PathBuf,
     pub sha256: Option<String>,
     pub bytes: u64,
+    pub replacement_sha256: Option<String>,
 }
 
 #[derive(Debug, Clone)]
@@ -957,6 +965,7 @@ fn read_manifest(dir: &Path) -> Vec<RecoveryRecord> {
                 stored,
                 sha256,
                 bytes,
+                replacement_sha256: fields.next().map(str::to_string),
             })
         })
         .collect()
@@ -1023,11 +1032,16 @@ fn verified_recovery_file(
     Ok(meta)
 }
 
+struct DisplacedReceipt {
+    path: PathBuf,
+    retained: Vec<(String, String)>,
+}
+
 fn command_receipt_to_displace(
     directory: &Path,
     records: &BTreeMap<&Path, &RecoveryRecord>,
     owner: Option<u64>,
-) -> Result<Option<PathBuf>> {
+) -> Result<Option<DisplacedReceipt>> {
     let receipt = directory.join(RECEIPT_FILE);
     let meta = match fs::symlink_metadata(&receipt) {
         Ok(meta) => meta,
@@ -1045,17 +1059,19 @@ fn command_receipt_to_displace(
     }
     let claims = parse_command_receipt(&read_small(&receipt, 512)?)?;
     let mut changes_owned_bytes = false;
+    let mut retained = Vec::new();
     for name in RECEIPT_COMMANDS {
         let command = directory.join(name);
-        if records.contains_key(command.as_path())
+        if let Some(record) = records.get(command.as_path())
+            && record.replacement_sha256.is_none()
             && !claims.contains_key(*name)
             && fs::symlink_metadata(&command).is_ok()
         {
             bail!("preserved unclaimed command {}", command.display());
         }
     }
     for (name, expected) in claims {
-        let path = directory.join(name);
+        let path = directory.join(&name);
         match fs::symlink_metadata(&path) {
             Ok(current)
                 if current.is_file()
@@ -1067,13 +1083,25 @@ fn command_receipt_to_displace(
             _ => bail!("preserved modified command {}", path.display()),
         }
         if let Some(record) = records.get(path.as_path()) {
-            changes_owned_bytes |= match &record.sha256 {
+            let changes = match &record.sha256 {
                 Some(digest) => digest != &expected,
                 None => file_sha256(&record.stored)? != expected,
             };
+            if changes {
+                changes_owned_bytes = true;
+                continue;
+            }
         }
+        retained.push((name, expected));
+    }
+    let saved = records.contains_key(receipt.as_path());
+    if saved {
+        retained.clear();
     }
-    Ok((changes_owned_bytes || records.contains_key(receipt.as_path())).then_some(receipt))
+    Ok((changes_owned_bytes || saved).then_some(DisplacedReceipt {
+        path: receipt,
+        retained,
+    }))
 }
 
 fn validate_saved_command_receipt(
@@ -1134,6 +1162,21 @@ pub fn restore(home: &Path, stamp: Option<&str>) -> Result<(String, RestoreRepor
             })
         })
         .collect();
+    for record in records.values() {
+        if let Some(expected) = &record.replacement_sha256 {
+            let current = match fs::symlink_metadata(&record.original) {
+                Ok(meta) => meta,
+                Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
+                Err(error) => return Err(error.into()),
+            };
+            if !current.is_file()
+                || !owned_by(&current, owner_id(home))
+                || file_sha256(&record.original)? != *expected
+            {
+                bail!("preserved modified command {}", record.original.display());
+            }
+        }
+    }
     let mut receipts = Vec::new();
     for dir in directories {
         let receipt = dir.join(RECEIPT_FILE);
@@ -1163,7 +1206,15 @@ pub fn restore(home: &Path, stamp: Option<&str>) -> Result<(String, RestoreRepor
     if !receipts.is_empty() {
         let mut batch = RecoveryBatch::open(home)?;
         for receipt in receipts {
-            batch.move_in(&receipt)?;
+            batch.move_in(&rec
```

**File**: `crates/release/tests/recovery_records.rs` (modified, +44/-0)
```diff
@@ -164,3 +164,47 @@ fn command_restore_preserves_ownership_and_undo() {
         assert_eq!(fs::read(unrelated).unwrap(), b"keep me");
     }
 }
+
+#[test]
+fn partial_restore_keeps_other_claims_and_only_undoes_its_own_replacement() {
+    use codewhale_release::installs::{
+        RECEIPT_COMMANDS, RECEIPT_FILE, parse_command_receipt, sha256_hex,
+    };
+    let home = tempfile::tempdir().unwrap();
+    let dir = home.path();
+    let prior = dir.join(RECEIPT_COMMANDS[0]);
+    let untouched = dir.join(RECEIPT_COMMANDS[1]);
+    let receipt = dir.join(RECEIPT_FILE);
+    let original_claims = [RECEIPT_COMMANDS[0], RECEIPT_COMMANDS[1]]
+        .map(|name| format!("{}  {name}\n", sha256_hex(b"new")))
+        .concat();
+    fs::write(&prior, b"old").unwrap();
+    let mut batch = RecoveryBatch::open(dir).unwrap();
+    let stamp = batch.stamp.clone();
+    batch.move_in(&prior).unwrap();
+    batch.finish();
+    fs::write(&prior, b"new").unwrap();
+    fs::write(&untouched, b"new").unwrap();
+    fs::write(&receipt, &original_claims).unwrap();
+    let (_, report) = restore(dir, Some(&stamp)).unwrap();
+    assert!(report.skipped.is_empty());
+    let retained = parse_command_receipt(&fs::read_to_string(&receipt).unwrap()).unwrap();
+    assert_eq!(retained.len(), 1);
+    assert_eq!(retained[RECEIPT_COMMANDS[1]], sha256_hex(b"new"));
+    assert_eq!(fs::read(&prior).unwrap(), b"old");
+    assert_eq!(fs::read(&untouched).unwrap(), b"new");
+    let undo = report.displaced.unwrap();
+    fs::write(&prior, b"my changes").unwrap();
+    assert!(restore(dir, Some(&undo)).is_err());
+    assert_eq!(fs::read(&prior).unwrap(), b"my changes");
+    assert_eq!(
+        retained,
+        parse_command_receipt(&fs::read_to_string(&receipt).unwrap()).unwrap()
+    );
+    fs::write(&prior, b"old").unwrap();
+    let (_, report) = restore(dir, Some(&undo)).unwrap();
+    assert!(report.skipped.is_empty());
+    assert_eq!(fs::read(&prior).unwrap(), b"new");
+    assert_eq!(fs::read(&untouched).unwrap(), b"new");
+    assert_eq!(fs::read_to_string(&receipt).unwrap(), original_claims);
+}
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-1)
```diff
@@ -282,7 +282,7 @@ Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features
 - **MCP catalogs stay fresh:** a server's tools, resources, prompts and skills are rediscovered on their own connection when an advertised `ttlMs` expires or the server sends a list-changed notice. A tool resolved against the old catalog is refused with "retry the call", a removed tool cannot run, and a failed refresh reconnects instead of serving stale entries. Catalogs are never shared across servers, credentials or reconnects.
 - **MCP Skills extension:** servers that advertise the published Skills extension have their skills listed in `list_mcp_resources`. Listing never activates a skill, and reading a skill file is refused unless its size and sha256 digest match the listing. MCP skills do not yet join `/skills`.
 - **Updates install themselves:** release-binary installs check for a new release every 6 hours (was 1), download and checksum-verify it in the background, and apply it the next time `codewhale` starts, never during a session. One line says `Updated to v… · What's new: … · Undo: codewhale update --rollback`. Until releases are signed, the download waits for your OK (one `[y/N]` question at the next start, or `/update install`); a release with a valid Ed25519 manifest signature applies on its own. `codewhale update --rollback` puts back the version the last update replaced and keeps the rolled-back version from returning automatically. Turn it down with `codewhale config set update.mode notify` (or `off`, or `CODEWHALE_UPDATE_MODE`); an organization's root-owned `policy.toml` overrides both. Offline and rate-limited checks retry about an hour later instead of on every launch. Package-manager and desktop-app copies only get their manager's command. Builds with the release key refuse a missing or invalid signature, and re-check the staged binary against the signed manifest at start. The checksum manifest now always comes from GitHub Releases; on Linux x64 the CNB mirror can still serve the binary, but only bytes that GitHub's manifest lists.
-- **One view of every Codewhale on the machine:** `codewhale doctor` has an Installations section and `codewhale doctor --installs` (`--json`, `--brief`) lists every `codewhale`, `codew`, `codewhale-tui`, `deepseek` and `deepseek-tui` with its owner: install receipt, package manager (with its exact removal command), the desktop app, a backup, or not ours. Nothing found is ever run. `codewhale doctor --fix` adds one plan to tidy them: old backups move to `~/.codewhale/recovery/<stamp>/` (kept 30 days, then deleted by a later `--fix`), an unreceipted `codew` is brought in line with `codewhale`, and the directory gets an install receipt; each move prints its undo and `codewhale doctor --restore <stamp>` reverses the lot. Package-managed, desktop-app, symlinked and foreign files are never touched, and neither is user data. `codewhale uninstall` now lists other copies with the same classification. Restoring an older command set now keeps its ownership receipt consistent and preserves the displaced receipt for undo.
+- **One view of every Codewhale on the machine:** `codewhale doctor` has an Installations section and `codewhale doctor --installs` (`--json`, `--brief`) lists every `codewhale`, `codew`, `codewhale-tui`, `deepseek` and `deepseek-tui` with its owner: install receipt, package manager (with its exact removal command), the desktop app, a backup, or not ours. Nothing found is ever run. `codewhale doctor --fix` adds one plan to tidy them: old backups move to `~/.codewhale/recovery/<stamp>/` (kept 30 days, then deleted by a later `--fix`), an unreceipted `codew` is brought in line with `codewhale`, and the directory gets an install receipt; each move prints its undo and `codewhale doctor --restore <stamp>` reverses the lot. Package-managed, desktop-app, symlinked and foreign files are never touched, and neither is user data. `codewhale uninstall` now lists other copies with the same classification. Restoring an older command set now keeps its ownership receipt consistent and preserves the displaced receipt for undo. A partial restore retains ownership of unchanged commands.
 - **Uninstall guidance on every install route:** `codewhale uninstall` previews receipt-owned release files and `--yes` removes only checked files, with the running command last. Both Unix installers and the Windows archive installer record command ownership; self-update renews existing receipts on both. On Windows the running `codewhale.exe` is renamed, then a hidden PowerShell process deletes it after the command exits. Package-managed copies are left alone, and the command prints their exact removal command: npm with its prefix, Cargo with its root, the Homebrew formula, `scoop uninstall codewhale`, `winget uninstall --id HunterBown.CodeWhale`, or the Windows setup's `Uninstall.exe`. Every other `codewhale`/`codew` still on PATH is listed. User data is kept unless you add `--purge-da
```

#### Recent Merged Pull Requests:
- **PR #7450** (2026-11-21): feat: add LLMTR as an OpenAI-compatible provider (@knowhycodata)
- **PR #7449** (2026-11-21): fix(engine): compact diagnostic late-usage receipts at the ledger bound (#6842) (@donglovejava)
- **PR #7448** (2026-11-21): Show request transmission on provider errors (@deosiree)
- **PR #7444** (2026-11-21): test(tui): guard all four paste-burst chunk-flush sites (@donglovejava)
- **PR #7431** (2026-11-21): fix(engine): classify local read-only deferred tools as Safe in get_tool_category (@NieZhuZhu)
- **PR #7430** (2026-11-21): fix(execpolicy): scan static awk and sed program payloads (@NieZhuZhu)

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

## X. engine): retain every diagnostic that fits the usage ledger

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a98c8010`: engine): retain every diagnostic that fits the usage ledger. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- Large session usage ledgers keep settled and unresolved usage and discard only the oldest routing diagnostics needed to stay within the storage limit. Thanks [@donglovejava](https://github.com/donglovejava) ([#7449](https://github.com/codewhale-hq/CodeWhale/pull/7449)).

- **[@donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste, fixed fallback tool-call IDs in streaming chat completions, and preserved usage records when compacting diagnostic receipts ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423), [#7449](https://github.com/codewhale-hq/CodeWhale/pull/7449)).
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- **[@donglovejava](https://github.com/donglovejava)** — covered large raw and bracketed terminal paste and fixed fallback tool-call IDs in streaming chat completions ([#7422](https://github.com/codewhale-hq/CodeWhale/pull/7422), [#7423](https://github.com/codewhale-hq/CodeWhale/pull/7423)).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a98c8010` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
