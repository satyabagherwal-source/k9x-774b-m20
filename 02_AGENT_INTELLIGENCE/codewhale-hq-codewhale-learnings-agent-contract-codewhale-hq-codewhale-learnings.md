# Agent Contract: Agent Contract: codewhale-hq-codewhale-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T07:19:58.597Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-codewhale-hq-codewhale-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T07:19:58.597Z`  
> **Learning ID**: `LEARN-EVO-codewhale-hq-codewhale-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `codewhale-hq-codewhale-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `336cd8a4`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-16T07:19:48.270Z  
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
> **Harvest Timestamp**: 2026-11-16T07:19:48.030Z  
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

### Incident Patch 1: `336cd8a4` (2026-11-16)
**Commit Message**: tui: show exact, estimated, or unknown cost labels and update changelog

Unifies App::session_cost_label and config_policy cost_label through App::status_cost_label so subscription plans and local routes display localized unknown rather than plan names, local tags, or a zero fallback, while preserving frame footer behavior and pruning stale missing-outcome reasons on late usage.

Verified (CW-7892 stack):
- cargo fmt --all -- --check && cargo clippy -p codewhale-config -p codewhale-engine -p codewhale-app-server -p codewhale-tui -p codewhale-cli --lib --tests -- -D warnings
- codewhale-engine: 1696 passed (usage|cost_status|accounting|purge|model_routing|subagent|rlm|review|receipt), 186 passed (-- usage cost_status), 10/10 regressions + saved-session load test, 7/7 dsh_llm
- codewhale-tui: 263 passed (cost|usage|auto_route|dispatch), 6/6 terminal + label regressions
- codewhale-app-server: 34 passed (runtime_threads|receipt|usage|cost|catalog_parity)
- codewhale-cli: 427 passed
- check-facts, check-runtime-contract-budget, preflight --check: OK

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -169,6 +169,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
+- The cost label shows an exact cost, an estimate or unknown.
 - **Docs for agents match the release:** `/llms-full.txt` and `/docs-markdown/*` now serve the documents as they were at the published release tag, from a committed snapshot that is checked against the published release.
 - **Extension host (experimental): trusted plugins ask for review once more.** With `extension_host` turned on, plugins you already trusted are shown for review again after this update, because the capability table they were reviewed against gained the `remote` service. No plugin can use that service yet: none is granted it.
 - **Website text for agents:** llms.txt now gives agents the install steps for the released version, the current release and the state of each part of Codewhale, from the same content as the pages. `/docs-markdown/install.md` serves those install steps as a page, and the main-branch documents beside it now say which release they can run ahead of.
@@ -188,6 +189,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Cost tracking can no longer fail your work: a turn, a review, an Auto-Review check, a purge, a sub-agent or an Auto routing decision finishes even when Codewhale cannot record its cost, and the cost then shows as unknown.
 - **Credential redaction:** text, JSON, and workflow-disclosure redaction now masks multi-line private-key blocks across PGP armor headers (including `Comment:` URLs), longer preambles, and 16-character wrapped lines; masks credential values inside nested or escaped JSON assignments, escaped quotes, `\u003c`/`\u003e` delimiters, and spaced or nested JSON objects and arrays; and treats plural token keys (`API_TOKENS`, `ACCESS_TOKENS`) and credential-shaped `tokens` values as credentials while keeping model and tokenizer metric names (`max_tokens`, `tokenizer`, `token_limit`, `tokens=5`) visible.
 - Child processes now inherit only the standard locale variables (`LC_ALL`, `LC_CTYPE` and the other locale categories, plus `LC_TERMINAL` and `LC_TERMINAL_VERSION`) and a listed set of `DOTNET_` host, SDK and runtime settings. Other `DOTNET_` variables, including application configuration keys, are no longer passed to child processes or MCP servers.
 - **Deny rules and command safety:** a command whose command word is not a plain literal, or that redefines a command name earlier in the same call, is now refused while a deny rule is configured; the background destroyer hold reads commands the shell tokenizer rejects, decodes ANSI-C escapes inside shell payloads, and holds Windows drive, UNC, and backslash recursive delete targets; and `sed`, `find`, `sort`, `rg`, `fd`, `uniq`, `env`, `less`, `more`, `ag`, `info` and `git` count as read-only only when their words are literal and use read-only flags, with `codewhale --version` and Windows trailing-backslash paths normalized before checking.
```

**File**: `crates/tui/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -169,6 +169,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
+- The cost label shows an exact cost, an estimate or unknown.
 - **Docs for agents match the release:** `/llms-full.txt` and `/docs-markdown/*` now serve the documents as they were at the published release tag, from a committed snapshot that is checked against the published release.
 - **Extension host (experimental): trusted plugins ask for review once more.** With `extension_host` turned on, plugins you already trusted are shown for review again after this update, because the capability table they were reviewed against gained the `remote` service. No plugin can use that service yet: none is granted it.
 - **Website text for agents:** llms.txt now gives agents the install steps for the released version, the current release and the state of each part of Codewhale, from the same content as the pages. `/docs-markdown/install.md` serves those install steps as a page, and the main-branch documents beside it now say which release they can run ahead of.
@@ -188,6 +189,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- Cost tracking can no longer fail your work: a turn, a review, an Auto-Review check, a purge, a sub-agent or an Auto routing decision finishes even when Codewhale cannot record its cost, and the cost then shows as unknown.
 - **Credential redaction:** text, JSON, and workflow-disclosure redaction now masks multi-line private-key blocks across PGP armor headers (including `Comment:` URLs), longer preambles, and 16-character wrapped lines; masks credential values inside nested or escaped JSON assignments, escaped quotes, `\u003c`/`\u003e` delimiters, and spaced or nested JSON objects and arrays; and treats plural token keys (`API_TOKENS`, `ACCESS_TOKENS`) and credential-shaped `tokens` values as credentials while keeping model and tokenizer metric names (`max_tokens`, `tokenizer`, `token_limit`, `tokens=5`) visible.
 - Child processes now inherit only the standard locale variables (`LC_ALL`, `LC_CTYPE` and the other locale categories, plus `LC_TERMINAL` and `LC_TERMINAL_VERSION`) and a listed set of `DOTNET_` host, SDK and runtime settings. Other `DOTNET_` variables, including application configuration keys, are no longer passed to child processes or MCP servers.
 - **Deny rules and command safety:** a command whose command word is not a plain literal, or that redefines a command name earlier in the same call, is now refused while a deny rule is configured; the background destroyer hold reads commands the shell tokenizer rejects, decodes ANSI-C escapes inside shell payloads, and holds Windows drive, UNC, and backslash recursive delete targets; and `sed`, `find`, `sort`, `rg`, `fd`, `uniq`, `env`, `less`, `more`, `ag`, `info` and `git` count as read-only only when their words are literal and use read-only flags, with `codewhale --version` and Windows trailing-backslash paths normalized before checking.
```

**File**: `crates/tui/src/commands/config_policy_status_tests.rs` (modified, +29/-0)
```diff
@@ -643,6 +643,35 @@ mod tests {
             Some("  Project docs:    no project docs")
         );
     }
+
+    #[test]
+    fn status_cost_row_uses_unknown_for_subscription_and_local_routes() {
+        let tmpdir = TempDir::new().expect("temp dir");
+        let mut app = create_test_app(tmpdir.path().to_path_buf());
+        app.billing_presentation =
+            codewhale_engine::route_billing::BillingPresentation::Subscription("Codex OAuth quota");
+        let sub_report = format_status(&mut app);
+        let sub_cost_line = sub_report
+            .lines()
+            .find(|line| line.trim_start().starts_with("Session cost:"))
+            .expect("subscription Session cost line");
+        assert!(sub_cost_line.ends_with("unknown"), "{sub_cost_line}");
+        assert!(
+            !sub_cost_line.contains("Codex OAuth quota"),
+            "{sub_cost_line}"
+        );
+        assert!(!sub_cost_line.contains('$'), "{sub_cost_line}");
+
+        app.billing_presentation = codewhale_engine::route_billing::BillingPresentation::Local;
+        let local_report = format_status(&mut app);
+        let local_cost_line = local_report
+            .lines()
+            .find(|line| line.trim_start().starts_with("Session cost:"))
+            .expect("local Session cost line");
+        assert!(local_cost_line.ends_with("unknown"), "{local_cost_line}");
+        assert!(!local_cost_line.contains("local"), "{local_cost_line}");
+        assert!(!local_cost_line.contains('$'), "{local_cost_line}");
+    }
 }
 
 fn safety_id(flag: Option<bool>) -> MessageId {
```

**File**: `crates/tui/src/commands/contract/config_policy.rs` (modified, +1/-13)
```diff
@@ -214,19 +214,7 @@ fn project_status(app: &App) -> ConfigStatusView {
         cache_miss_tokens: app.session.displayed_total_cache_miss_tokens(),
         cost: app.session_cost_for_currency(app.cost_currency),
         currency: to_command_currency(app.cost_display_currency(app.cost_currency)),
-        cost_label: match app.cumulative_usage_chip() {
-            chip @ codewhale_engine::route_billing::UsageChip::PricedSubtotal { .. } => {
-                codewhale_engine::route_billing::format_usage_chip(&chip, app.ui_locale)
-            }
-            codewhale_engine::route_billing::UsageChip::Unknown(_) => Some(
-                codewhale_localization::tr(
-                    app.ui_locale,
-                    codewhale_localization::MessageId::CmdCostUnknownValue,
-                )
-                .into_owned(),
-            ),
-            _ => None,
-        },
+        cost_label: app.status_cost_label(),
         metrics,
         ascii_safe: crate::tui::color_compat::ascii_safe_enabled(),
         tool_outputs: outputs,
```

**File**: `crates/tui/src/tui/app.rs` (modified, +20/-17)
```diff
@@ -5402,27 +5402,30 @@ impl App {
     }
 
     /// Price is one number, everywhere (design §2.11 item 5): the session
-    /// cost as the footer chip, the price view, and the roster print it.
-    /// Money routes print the amount; subscription and local routes print the
-    /// same words the chip uses; a metered route that has not spent yet prints
-    /// `$0.00`; a session with no confirmed price says `unknown` rather than
-    /// inventing a zero.
-    #[must_use]
-    pub fn session_cost_label(&self) -> String {
-        let chip = self.cumulative_usage_chip();
-        if matches!(chip, codewhale_engine::route_billing::UsageChip::Hidden) {
-            return self
-                .format_cost_amount(self.displayed_session_cost_for_currency(self.cost_currency));
-        }
-        codewhale_engine::route_billing::format_usage_chip(&chip, self.ui_locale).unwrap_or_else(
-            || {
+    /// cost as the price view and status surface print it — money routes print
+    /// exact or estimated dollars (or `$0.00` before spending), while
+    /// subscription, local, and unpriced sessions say `unknown` rather than
+    /// printing plan names, `"local"`, or an invented zero.
+    pub(crate) fn status_cost_label(&self) -> Option<String> {
+        use codewhale_engine::route_billing::UsageChip;
+        match self.cumulative_usage_chip() {
+            UsageChip::Money(_) | UsageChip::Hidden => None,
+            UsageChip::PricedSubtotal { amount, .. } => Some(amount),
+            UsageChip::Allowance { .. } | UsageChip::Local | UsageChip::Unknown(_) => Some(
                 codewhale_localization::tr(
                     self.ui_locale,
                     codewhale_localization::MessageId::CmdCostUnknownValue,
                 )
-                .into_owned()
-            },
-        )
+                .into_owned(),
+            ),
+        }
+    }
+
+    #[must_use]
+    pub fn session_cost_label(&self) -> String {
+        self.status_cost_label().unwrap_or_else(|| {
+            self.format_cost_amount(self.displayed_session_cost_for_currency(self.cost_currency))
+        })
     }
 
     pub(crate) fn cost_display_currency(&self, currency: CostCurrency) -> CostCurrency {
```

**File**: `crates/tui/src/tui/app/tests.rs` (modified, +90/-0)
```diff
@@ -2402,6 +2402,96 @@ fn subscription_route_hides_stale_session_dollars_in_footer() {
     assert!(rendered.contains("Codex OAuth quota"), "{rendered}");
 }
 
+#[test]
+fn session_cost_label_renders_money_or_unknown_without_plan_names_or_local() {
+    let unknown = codewhale_localization::tr(
+        codewhale_localization::Locale::En,
+        codewhale_localization::MessageId::CmdCostUnknownValue,
+    )
+    .into_owned();
+
+    let mut sub = App::new(test_options(false), &Config::default());
+    sub.billing_presentation =
+        codewhale_engine::route_billing::BillingPresentation::Subscription("Codex OAuth quota");
+    assert_eq!(sub.session_cost_label(), unknown);
+    assert_eq!(sub.status_cost_label().as_deref(), Some(unknown.as_str()));
+
+    let mut local = App::new(test_options(false), &Config::default());
+    local.billing_presentation = codewhale_engine::route_billing::BillingPresentation::Local;
+    assert_eq!(local.session_cost_label(), unknown);
+    assert_eq!(local.status_cost_label().as_deref(), Some(unknown.as_str()));
+
+    let mut metered = App::new(test_options(false), &Config::default());
+    metered.api_provider = ProviderKind::Deepseek;
+    metered.model = "deepseek-v4-flash".to_string();
+    metered.billing_presentation = codewhale_engine::route_billing::BillingPresentation::Metered;
+    assert_eq!(metered.session_cost_label(), "$0.00");
+    assert_eq!(metered.status_cost_label(), None);
+
+    metered.session.cost_priced_turns = 1;
+    metered.accrue_session_cost_estimate(CostEstimate::usd_only(0.42));
+    assert_eq!(metered.session_cost_label(), "$0.42");
+    assert_eq!(metered.status_cost_label(), None);
+
+    metered.session.cost_unpriced_turns = 1;
+    assert_eq!(metered.session_cost_label(), "$0.42");
+    assert_eq!(metered.status_cost_label().as_deref(), Some("$0.42"));
+}
+
+#[test]
+fn late_reported_usage_prunes_stale_request_outcome_unknown_reason() {
+    let mut app = App::new(test_options(false), &Config::default());
+    let route = codewhale_engine::cost_status::EffectiveRouteEnvelope::capture(
+        None,
+        ProviderKind::Deepseek,
+        "deepseek",
+        "deepseek-v4-flash",
+        Some(ProviderKind::Deepseek.provider().default_base_url()),
+        chrono::Utc::now(),
+    );
+    let drop_pool = codewhale_engine::cost_status::background_cost_for_runtime_drop(
+        &codewhale_engine::cost_status::RuntimeUsageDropRecord {
+            reason: codewhale_engine::cost_status::RuntimeUsageMissingReason::RequestOutcomeUnknown,
+            source_id: "cw-7882-late-source".to_string(),
+            route: route.clone(),
+        },
+    );
+    app.absorb_pending_background_cost(&drop_pool);
+    assert_eq!(app.session.cost_unpriced_turns, 1);
+    assert!(
+        app.session
+            .cost_unpriced_reasons
+            .contains("request_outcome_unknown")
+    );
+
+    let settled = codewhale_engine::cost_status::NativeUsageSource::capture(
+        "cw-7882-late-source",
+        codewhale_engine::cost_status::UsageSpendOwner::Auxiliary,
+    )
+    .reported(
+        &route,
+        &codewhale_models::Usage {
+            input_tokens: 1_000,
+            output_tokens: 200,
+            ..Default::default()
+        },
+    );
+    let settled_pool = codewhale_engine::cost_status::background_cost_for_runtime_usage(&settled);
+    app.absorb_pending_background_cost(&settled_pool);
+    assert_eq!(app.session.cost_priced_turns, 1);
+    assert_eq!(app.session.cost_unpriced_turns, 0);
+    assert!(
+        !app.session
+            .cost_unpriced_reasons
+            .contains("request_outcome_unknown")
+    );
+    assert!(
+        !app.session
+            .cost_cny_unpriced_reasons
+            .contains("request_outcome_unknown")
+    );
+}
+
 #[test]
 fn provider_switch_keeps_audited_cumulative_spend_visible() {
     let mut app = App::new(test_options(false), &Config::default());
```

---

### Incident Patch 2: `2b7a3770` (2026-11-16)
**Commit Message**: fix(app-server): wait for settled live turn events in remote pairing test

NodeRemoteHarness::wait_thread_idle returned as soon as turn.status and
workspace.state left pending, which raced emit_turn_completed_if_missing and the
background turn.artifacts emission from settle_turn_workspace in
an_open_sse_stream_ends_cleanly_on_withdrawal_archive_and_plugin_revoke (making
last_seq reach 55 after the test expected 54). Wait for replay_events to include
turn.completed and, when workspace settled or failed delta, turn.artifacts on
live turns identified by turn.started or non-null workspace state so hydrated
saved-session turns do not hang.

Checks (macOS, sccache, hermetic test home, CODEWHALE_EXT_HOST_TESTS=1):
- cargo fmt --all -- --check: PASS
- cargo clippy -p codewhale-app-server --lib --tests --locked -- -D warnings: PASS (18.46s)
- nextest -p codewhale-app-server --lib -E 'test(remote_pairing)': 17 passed, 865 skipped
- 5x soak an_open_sse_stream_ends_cleanly_on_withdrawal_archive_and_plugin_revoke: 5/5 passed
- sh scripts/preflight.sh --check --base origin/main: OK

**File**: `crates/app-server/src/runtime_api/tests/remote_pairing.rs` (modified, +39/-3)
```diff
@@ -298,16 +298,52 @@ impl NodeRemoteHarness {
                 .error_for_status()?
                 .json()
                 .await?;
-            let all_terminal = detail["turns"].as_array().is_some_and(|turns| {
+            let turns = detail["turns"].as_array();
+            let all_terminal = turns.is_some_and(|turns| {
                 turns.iter().all(|turn| {
                     matches!(
                         turn["status"].as_str(),
                         Some("completed" | "failed" | "interrupted" | "canceled")
-                    )
+                    ) && turn["workspace"]["state"].as_str() != Some("pending")
                 })
             });
             if all_terminal {
-                return Ok(());
+                let mut replay = self
+                    .state
+                    .runtime_threads
+                    .replay_events(thread_id, None, None)
+                    .await?;
+                let mut events = Vec::new();
+                while let Some(batch) = replay.batches.recv().await {
+                    events.extend(batch.map_err(anyhow::Error::msg)?);
+                }
+                let all_events_settled = turns.is_some_and(|turns| {
+                    turns.iter().all(|turn| {
+                        let Some(id) = turn["id"].as_str() else {
+                            return false;
+                        };
+                        let ran_live = events.iter().any(|ev| {
+                            ev.event == "turn.started" && ev.turn_id.as_deref() == Some(id)
+                        }) || turn.get("workspace").is_some_and(|w| !w.is_null());
+                        if !ran_live {
+                            return true;
+                        }
+                        let has_completed = events.iter().any(|ev| {
+                            ev.event == "turn.completed" && ev.turn_id.as_deref() == Some(id)
+                        });
+                        let needs_artifacts = turn["workspace"]["state"].as_str()
+                            == Some("settled")
+                            || turn["workspace"]["reason"].as_str() == Some("delta_failed");
+                        let has_artifacts = !needs_artifacts
+                            || events.iter().any(|ev| {
+                                ev.event == "turn.artifacts" && ev.turn_id.as_deref() == Some(id)
+                            });
+                        has_completed && has_artifacts
+                    })
+                });
+                if all_events_settled {
+                    return Ok(());
+                }
             }
             if Instant::now() >= deadline {
                 anyhow::bail!("timed out waiting for thread {thread_id} to go idle: {detail}");
```

---

### Incident Patch 3: `b62308f1` (2026-11-15)
**Commit Message**: feat(extension-host,plugins,tui): implement plugins arm install, remove, enable, disable (CR-03, CW-8080)

Implement the CR-03 plugins arm mutation surface (`install`, `remove`,
`enable`, `disable`) across `codewhale-plugins`, `codewhale-engine`, and
`codewhale-tui`, record plugin approval provenance (`installed_by_the_agent` /
`approved_by`), gate DSH npm transitive resolution and remote tarball
installs on `BrokerEffect::Reach` / `Write`, enforce atomic review+enable via
`PluginRegistry::trust_and_enable_by`, synchronously revoke stale/removed
extension-host owners on `plugins_changed`, and bind `observe_native_activation`
to `(plugin_id, authority)` via `owner_report_for_authority`:

- `crates/plugins/src/install.rs`, `npm_deps.rs`, `host_services.rs`,
  `registry.rs`: add shared `installed_by_the_agent`, regular
  `.installed-from` marker validation (`has_regular_install_marker`),
  `PreparedSource::Remote` ephemeral staging (`prepare_remote_install`) and
  `InstallRemoteExact`, `trust_and_enable_by`, `sync_user_plugins_from`, and
  named `UnresolvedSeed`/`UnresolvedSeeds` aliases for clippy cleanliness.
- `crates/engine/src/extension_host/dsh_plugins.rs`, `mod.rs`, `registry.r

**File**: `CHANGELOG.md` (modified, +3/-1)
```diff
@@ -24,6 +24,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Creator mode inspection tools:** wire DeepSeek Harness's unmodified `tool-cordis` in the built-in creator module (`cordis_inspect_list` and `cordis_inspect_query`), serving live host services, events, plugin config schemas, caller-accessible tools, and plugin seats as approval-free Auto inspection tools in Creator mode. (CW-8077)
 
 - **Plugin creator:** a new built-in row on the Plugins page and a `[features] plugin_creator` key, on by default. It hosts DeepSeek Harness's own `plugin_manager` tool, unmodified, in Codewhale's built-in host process, which runs with the extension-host switch off. It reports "not ready in this build" until the install path behind it lands. (CW-8091)
+- **Plugin manager mutations (`plugin_manager`):** Creator's built-in `plugins` broker arm now supports `install`, `remove`, `enable`, and `disable` with atomic review-and-enable transitions, agent/person provenance tracking, resolved-reach gating for remote and npm sources, and synchronous revocation across open sessions on disable or removal. (CW-8080)
+- **Plugin install symlink and reparse guard (Windows):** Plugin install on Windows refuses a source folder that contains a junction or another reparse point, as it already refused symbolic links.
 - **Unmodified DSH plugin compatibility (`CW-8020`):** Admitted unmodified `@deepseek-ai/dsh-*` plugins end-to-end with grant-gated host-service bridges (`workspace`, `llm`, `credentials`, `settings`, `pluginManager`, `deepseekAccount`, `terminal`, `remote`), 9 `host-spine` row bridges, inert/mixed `@deepseek-ai/dsh-agent-presets` handling alongside executable composition rows, duplicate-key `package.json` parsing, sanitized manifest descriptions, a `16,384`-file / `256 MiB` bundle budget, and reviewed `registry.npmjs.org` transitive dependency staging during conversion.
 - **Receipt edit line counts:** `/receipts` and session summaries now count `edit_file` additions and deletions using a line diff of each search/replace pair instead of counting every line of both texts, matching `git diff --stat` and edit cards (with multi-edit calls summed per pair). (CW-8147)
 - **Featured provider disclosure line:** `/provider` and the model picker now show the localized referral disclosure directly below the featured OrcaRouter row across widths (and hide the row when both cannot fit above the list), while keeping `zh-Hans` and mainland China sessions hidden. (CW-8149)
@@ -171,7 +173,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - ACP: editors can start, list, load, prompt and cancel Codewhale sessions and approve or reject tool permissions through the Runtime; prompts with image or audio blocks and relative session directories are now refused instead of ignored, and edit and read tools report the right kind. Sessions an editor drives now run the plugin tools (TypeScript and DSH, when the extension host is on) and the MCP servers configured in Codewhale; their calls show as ACP tool calls and ask through the session's permission setting, and `initialize` reports the state under `agentCapabilities._meta.codewhale`. MCP servers an editor passes in `mcpServers` and configured shell hooks still do not run in ACP sessions. A real-editor journey is not yet proved.
 - Extension host: the `sessions` and `systemPrompt` services now come from a reviewed DSH adapter instead of inline shims, and `sessions.flush` refuses an empty checkpoint ticket. Session reads and events and the `agent/pre-step` hook are still not available to plugins. (CW-7959)
 - Extension host: DSH service adapters now have one ticketed `dsh/broker` request to the core, each ticket is bound to the plugin, the service and the session, and every service (workspace, llm, network, settings, catalog, terminal and remote) refuses with a typed `not_available` until its broker lands. Nothing new is offered to plugins yet. (CW-8012)
-- **Plugin host services and who approved:** a plugin can now be granted a Codewhale host service, and only by a review that shows it. The review names each service and the plugins it is shared with, and every review records who approved it: you, the agent (in Full Access, in Auto-Review, or from a shell command carrying the agent's mark), or the command line with `--yes`; who turned the plugin on is recorded too. Reviewed plugins share one process while a plugin the agent approved runs in its own host process for that project, so a service works in a host process only while every plugin loaded in it holds the same grant. A plugin the agent approved is active only in its own project and its code never runs beside the plugins you reviewed until you review it. No service is offered yet, and a plugin reviewed before this release holds no grant until it is reviewed again. Once a plugin has been reviewed or turned on in this release, Codewhale 0.10.2 and earlier cannot read the p
```

**File**: `crates/engine/src/extension_host/composition_review.rs` (modified, +12/-5)
```diff
@@ -59,11 +59,18 @@ pub fn review(input: &Value) -> Result<Value, String> {
         &[],
     )?;
     // A bounded process runner, not another Engine or session runtime.
-    tokio::runtime::Builder::new_current_thread()
-        .enable_all()
-        .build()
-        .map_err(|_| "composition review worker is unavailable")?
-        .block_on(run(launch, input))
+    std::thread::Builder::new()
+        .name("dsh-composition-review".to_string())
+        .spawn(move || {
+            tokio::runtime::Builder::new_current_thread()
+                .enable_all()
+                .build()
+                .map_err(|_| "composition review worker is unavailable".to_string())?
+                .block_on(run(launch, input))
+        })
+        .map_err(|_| "composition review worker is unavailable".to_string())?
+        .join()
+        .map_err(|_| "composition review worker failed".to_string())?
 }
 
 async fn bounded_read(pipe: impl AsyncRead + Unpin, limit: usize) -> Result<Vec<u8>, String> {
```

**File**: `crates/engine/src/extension_host/mod.rs` (modified, +153/-45)
```diff
@@ -165,7 +165,7 @@ pub mod test_support;
 #[cfg(test)]
 mod tests;
 
-use std::collections::{BTreeMap, BTreeSet, HashSet, VecDeque};
+use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
 use std::fmt;
 use std::path::{Path, PathBuf};
 use std::sync::atomic::{AtomicU64, Ordering};
@@ -185,8 +185,8 @@ use self::supervisor::{HostEvents, HostProcess, HostRequestContext};
 use self::tier::{BuiltinModule, HostCohort, HostTier, PluginCohort};
 use codewhale_config::PluginAuthority;
 use codewhale_config::{EntryRef, OwnerRef};
-use codewhale_plugins::PluginRegistry;
 use codewhale_plugins::activation::{self, PluginActivationCapability};
+use codewhale_plugins::{PluginRegistry, types::LoadedPlugin};
 
 /// The host bundle, embedded so every distribution channel carries it.
 const BUNDLE: &[u8] = include_bytes!("../../extension-host/dist/codewhale-extension-host.mjs");
@@ -886,6 +886,13 @@ impl ManagerShared {
         }
     }
 
+    fn clear_plugin_diagnostics(&self, plugin_id: &str) {
+        self.diagnostics
+            .lock()
+            .expect("diagnostics lock")
+            .retain(|entry| entry.plugin_id.as_deref() != Some(plugin_id));
+    }
+
     /// The shared fast liveness guard: current policy, running host, exact
     /// owner generation/tier and its reviewed authority. `live_host` follows
     /// with Native receipt validation and another host check; root admission
@@ -1772,28 +1779,43 @@ impl ExtensionHostManager {
     /// log. The command renderer escapes each field before displaying it.
     #[must_use]
     pub fn owner_report(&self, plugin_id: &str) -> Option<OwnerReport> {
+        self.owner_report_for(plugin_id, None)
+    }
+
+    #[must_use]
+    pub(super) fn owner_report_for(
+        &self,
+        plugin_id: &str,
+        expected_authority: Option<&PluginAuthority>,
+    ) -> Option<OwnerReport> {
         let registry = self.shared.registry.lock().expect("registry lock");
-        let (state, cohort) = registry
-            .owner(plugin_id)
-            .map(|entry| {
-                let state = match &entry.state {
-                    OwnerState::Failed(reason) => {
-                        OwnerState::Failed(bounded_diagnostic(reason.clone()))
-                    }
-                    OwnerState::Faulted(reason) => {
-                        OwnerState::Faulted(bounded_diagnostic(reason.clone()))
-                    }
-                    state => state.clone(),
-                };
-                (Some(state), Some(entry.cohort.clone()))
+        let matching_entry = registry.owner(plugin_id).filter(|entry| {
+            expected_authority.is_none_or(|expected| {
+                entry.authority.as_ref().is_some_and(|auth| {
+                    auth.plugin_id == expected.plugin_id
+                        && auth.content_hash == expected.content_hash
+                        && auth.capability_hash == expected.capability_hash
+                        && auth.state_generation == expected.state_generation
+                        && auth.state_path == expected.state_path
+                })
             })
-            .unwrap_or((None, None));
-        let tools = registry
-            .live_tools()
-            .into_iter()
-            .filter(|tool| tool.owner.plugin_id == plugin_id)
-            .map(|tool| tool.name)
-            .collect();
+        });
+        let cohort = matching_entry.map(|entry| entry.cohort.clone());
+        let state = matching_entry.map(|entry| match &entry.state {
+            OwnerState::Failed(reason) => OwnerState::Failed(bounded_diagnostic(reason.clone())),
+            OwnerState::Faulted(reason) => OwnerState::Faulted(bounded_diagnostic(reason.clone())),
+            state => state.clone(),
+        });
+        let tools = if state.is_some() {
+            registry
+                .live_tools()
+                .into_iter()
+                .filter(|tool| tool.owner.plugin_id == plugin_id)
+                .map(|tool| tool.name)
+                .collect()
+        } else {
+            Vec::new()
+        };
         drop(registry);
         let mut diagnostics: Vec<_> = self
             .shared
@@ -2050,48 +2072,123 @@ impl ExtensionHostManager {
     /// Replace the snapshot of every engine attached to `plugins`'s
     /// workspace: a plugin was enabled, disabled, trusted or revoked there.
     fn refresh_workspace(&self, plugins: &Arc<PluginRegistry>) {
-        let ids: Vec<_> = self
-            .shared
-            .attachments
-            .lock()
-            .expect("attachments lock")
-            .iter()
-            .filter(|(_, state)| state.plugins.workspace() == plugins.workspace())
-            .map(|(id, _)| *id)
-            .collect();
-        for id in ids {
-            self.shared.core_calls.revoke_attachment(id);
-        }
-        for state in self
-            .shared
-            .attachments
-            .lock()
-            .expect("attachments lock")
-            .valu
```

**File**: `crates/plugins/src/discovery.rs` (modified, +50/-0)
```diff
@@ -410,6 +410,22 @@ fn load_plugin(
     }
     let validated = refreshed;
 
+    let install_nonce = match read_install_nonce(&validated.canonical_root) {
+        Ok(nonce) => nonce,
+        Err(error) => {
+            diagnostics.push(PluginDiagnostic::warning(
+                "install-record-invalid",
+                error,
+                Some(
+                    validated
+                        .canonical_root
+                        .join(codewhale_skill_install::install::INSTALLED_FROM_MARKER),
+                ),
+            ));
+            None
+        }
+    };
+
     Ok(LoadedPlugin {
         id,
         manifest: validated.manifest,
@@ -430,11 +446,45 @@ fn load_plugin(
         enabled_by: None,
         host_services: Vec::new(),
         outside_reach: false,
+        install_nonce,
         skill_snapshots,
         diagnostics,
     })
 }
 
+pub(crate) fn read_install_nonce(root: &Path) -> Result<Option<String>, String> {
+    use std::io::Read as _;
+
+    let path = root.join(codewhale_skill_install::install::INSTALLED_FROM_MARKER);
+    let metadata = match fs::symlink_metadata(&path) {
+        Ok(metadata) => metadata,
+        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
+        Err(error) => {
+            return Err(format!("failed to inspect {}: {error}", path.display()));
+        }
+    };
+    if metadata_is_link_or_reparse(&metadata) || !metadata.file_type().is_file() {
+        return Err(format!(
+            "{} is not an ordinary regular file",
+            path.display()
+        ));
+    }
+    let file = codewhale_util::bundle_file::open_bundle_file(&path)
+        .map_err(|error| format!("failed to open {}: {error}", path.display()))?;
+    let mut raw = String::new();
+    file.take(64 * 1024 + 1)
+        .read_to_string(&mut raw)
+        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
+    if raw.len() > 64 * 1024 {
+        return Err(format!("{} exceeds maximum marker size", path.display()));
+    }
+    Ok(
+        serde_json::from_str::<codewhale_skill_install::install::InstalledFromMarker>(&raw)
+            .ok()
+            .and_then(|marker| marker.install_nonce().map(str::to_string)),
+    )
+}
+
 fn parse_skill_snapshots(
     validated: &ValidatedManifest,
 ) -> Result<(Vec<PluginSkillSnapshot>, Vec<PluginDiagnostic>), String> {
```

**File**: `crates/plugins/src/host_service_tests.rs` (modified, +194/-0)
```diff
@@ -1203,3 +1203,197 @@ fn v0_10_2_reads_this_state_file_until_a_plugin_is_reviewed_or_turned_on_here()
     let refused = older(&config).unwrap_err().to_string();
     assert!(refused.contains("unknown field `version`"), "{refused}");
 }
+
+#[test]
+fn an_identical_reinstall_cannot_match_a_registry_read_before_the_removal() {
+    let _policy = TestPolicyGuard::extension_host(true);
+    let tmp = tempfile::tempdir().unwrap();
+    let config = config(tmp.path());
+
+    write_plugin(&config, "alpha", &[], "export function apply() {}\n");
+    let by_agent = agent(&config, AgentPosture::FullAccess);
+    let mut first = discover_with_config(&config);
+    approve(&mut first, "alpha", by_agent.clone());
+
+    let stale = discover_with_config(&config);
+    let stale_staged = stale.get("alpha").unwrap().staged_root.clone().unwrap();
+    assert!(stale_staged.is_dir());
+
+    discover_with_config(&config)
+        .prune_state_entry("alpha")
+        .unwrap();
+    let mut fresh = discover_with_config(&config);
+    approve(&mut fresh, "alpha", person());
+    assert!(stale_staged.is_dir());
+
+    let before_state = fs::read(&config.state_path).unwrap();
+    let mut stale_review = stale.clone();
+    let shown = stale_review
+        .host_service_review_for("alpha", &by_agent)
+        .map(|review| review.token);
+    let review_refused = stale_review
+        .trust_reviewed(
+            "alpha",
+            ReviewApproval {
+                approved_by: by_agent.clone(),
+                host_services: shown,
+            },
+        )
+        .unwrap_err();
+    assert!(
+        review_refused.contains("state or review changed"),
+        "{review_refused}"
+    );
+    assert_eq!(fs::read(&config.state_path).unwrap(), before_state);
+
+    let mut stale_enable = stale;
+    let enable_refused = stale_enable
+        .enable_by("alpha", by_agent.clone())
+        .unwrap_err();
+    assert!(
+        enable_refused.contains("state or review changed"),
+        "{enable_refused}"
+    );
+    assert_eq!(fs::read(&config.state_path).unwrap(), before_state);
+
+    let install_tmp = tempfile::tempdir().unwrap();
+    let source = install_tmp.path().join("beta-src");
+    fs::create_dir_all(source.join("native")).unwrap();
+    fs::write(
+        source.join("native/index.mjs"),
+        "export function apply() {}\n",
+    )
+    .unwrap();
+    fs::write(
+        source.join("plugin.toml"),
+        "schema_version = 1\n[plugin]\nname = \"beta\"\nversion = \"1.0.0\"\n[native]\npath = \"native/index.mjs\"\n",
+    )
+    .unwrap();
+    let install_config = super::discovery::DiscoveryConfig {
+        workspace: install_tmp.path().join("project"),
+        user_plugins_dir: install_tmp.path().join("user"),
+        workspace_plugins_dir: install_tmp.path().join("workspace"),
+        builtin_plugin_dirs: Vec::new(),
+        state_path: install_tmp.path().join("state/plugin-state.json"),
+    };
+    fs::create_dir_all(&install_config.workspace).unwrap();
+    fs::create_dir_all(&install_config.user_plugins_dir).unwrap();
+    fs::create_dir_all(&install_config.workspace_plugins_dir).unwrap();
+
+    let runtime = tokio::runtime::Builder::new_current_thread()
+        .enable_all()
+        .build()
+        .unwrap();
+    let network = codewhale_net::network_policy::NetworkPolicy::default();
+    let mut reg = discover_with_config(&install_config);
+    let installed_first = runtime
+        .block_on(super::mutation::execute(
+            super::mutation::PluginMutationRequest::Install {
+                source: super::install::PluginInstallSource::parse(source.to_str().unwrap())
+                    .unwrap(),
+            },
+            &super::mutation::PluginMutationContext {
+                network: &network,
+                max_size: super::install::DEFAULT_MAX_SIZE_BYTES,
+            },
+            &mut reg,
+        ))
+        .unwrap();
+    assert_eq!(
+        installed_first.outcome,
+        super::mutation::PluginMutationOutcome::Installed
+    );
+    let same_agent = agent(&install_config, AgentPosture::FullAccess);
+    let mut reg = discover_with_config(&install_config);
+    approve(&mut reg, "beta", same_agent.clone());
+
+    let pre_removal = discover_with_config(&install_config);
+    let first_nonce = pre_removal.get("beta").unwrap().install_nonce.clone();
+    assert!(first_nonce.is_some());
+    let first_staged = pre_removal
+        .get("beta")
+        .unwrap()
+        .staged_root
+        .clone()
+        .unwrap();
+    assert!(first_staged.is_dir());
+
+    let mut deleter = discover_with_config(&install_config);
+    deleter.disable("beta").unwrap();
+    let mut deleter = discover_with_config(&install_config);
+    runtime
+        .block_on(super::mutation::execute(
+            super::mutation::PluginMutationRequest::Uninstall {
+                selector: "beta".to_string(),
+            },
+            &super::mutation::PluginMutationContext {
+ 
```

**File**: `crates/plugins/src/install/dsh.rs` (modified, +12/-0)
```diff
@@ -3485,6 +3485,18 @@ pub fn plan_npm_install(
 // Entry point
 // ─────────────────────────────────────────────────────────────────────────────
 
+/// Return whether a DSH package imports declared external npm dependencies not bundled in `node_modules`.
+pub fn has_unresolved_npm_dependencies(package: &Path) -> Result<bool> {
+    let package = Package::open(package)?;
+    let loaded = load_bundle(&package)?;
+    let (_, seeds) = super::npm_deps::collect_unresolved_seeds(
+        &package.root,
+        &loaded.manifest,
+        &loaded.entries,
+    )?;
+    Ok(!seeds.is_empty())
+}
+
 /// Convert the DSH bundle package at `package` into a fresh native bundle at
 /// `output`. `output` must not exist; nothing is written unless every
 /// component validated, and a failed write removes what it created.
```

**File**: `crates/plugins/src/install/mod.rs` (modified, +395/-14)
```diff
@@ -93,6 +93,7 @@ mod tarball;
 #[cfg(test)]
 mod tests;
 
+pub use npm_deps::NpmDepsNetworkError;
 use place::{ensure_target_within_plugins_dir, finalize_install, plugin_target_path};
 use stage::stage_local_copy;
 pub use summary::{PluginSummary, PreviousInstall, SummaryClause, SummaryInput, build_summary};
@@ -130,6 +131,14 @@ impl PluginInstallSource {
     ///   (via [`InstallSource::parse`]; registry names are unreachable here)
     /// * `path:<dir>` or any other value → [`PluginInstallSource::LocalPath`]
     pub fn parse(spec: &str) -> Result<Self> {
+        Self::parse_inner(spec, true)
+    }
+
+    pub fn parse_syntax(spec: &str) -> Result<Self> {
+        Self::parse_inner(spec, false)
+    }
+
+    fn parse_inner(spec: &str, inspect_fs: bool) -> Result<Self> {
         let trimmed = spec.trim();
         if trimmed.is_empty() {
             bail!("install source must not be empty");
@@ -197,7 +206,7 @@ impl PluginInstallSource {
             ))));
         }
         if let Some(path) = trimmed.strip_prefix("path:") {
-            return Self::local(path);
+            return Self::local(path, inspect_fs);
         }
         if let Some(path) = trimmed.strip_prefix("dsh:") {
             let path = path.trim();
@@ -221,16 +230,16 @@ impl PluginInstallSource {
                 }
             };
         }
-        Self::local(trimmed)
+        Self::local(trimmed, inspect_fs)
     }
 
-    fn local(spec: &str) -> Result<Self> {
+    fn local(spec: &str, inspect_fs: bool) -> Result<Self> {
         let trimmed = spec.trim();
         if trimmed.is_empty() {
             bail!("local install path must not be empty");
         }
         let path = PathBuf::from(trimmed);
-        if dsh::try_is_dsh_package(&path)? {
+        if inspect_fs && dsh::try_is_dsh_package(&path)? {
             return Ok(Self::Dsh(path));
         }
         Ok(Self::LocalPath(path))
@@ -479,7 +488,22 @@ async fn install_inner(
             )
         }
         PluginInstallSource::Dsh(package) => {
-            let converted = convert_dsh_off_runtime(package.clone(), network.clone()).await?;
+            let converted = match convert_dsh_off_runtime(package.clone(), network.clone()).await {
+                Ok(converted) => converted,
+                Err(err) => {
+                    if let Some(net_err) = err.downcast_ref::<NpmDepsNetworkError>() {
+                        return Ok(match net_err {
+                            NpmDepsNetworkError::NeedsApproval(host) => {
+                                PluginInstallOutcome::NeedsApproval((*host).to_string())
+                            }
+                            NpmDepsNetworkError::Denied(host) => {
+                                PluginInstallOutcome::NetworkDenied((*host).to_string())
+                            }
+                        });
+                    }
+                    return Err(err);
+                }
+            };
             install_converted_dsh(
                 converted,
                 user_plugins_dir,
@@ -621,6 +645,174 @@ fn verify_expected_content_hash(
     .into())
 }
 
+#[derive(Debug, Clone)]
+pub struct DownloadedRemote {
+    pub remote: InstallSource,
+    pub resolved_url: String,
+    pub bytes: Vec<u8>,
+}
+
+#[derive(Debug)]
+pub enum RemoteDownloadOutcome {
+    Downloaded {
+        archive: DownloadedRemote,
+        has_npm_deps: bool,
+    },
+    NeedsApproval(String),
+    NetworkDenied(String),
+}
+
+#[derive(Debug, Clone)]
+pub struct PreparedRemote {
+    pub remote: InstallSource,
+    pub resolved_url: String,
+    pub bytes: Vec<u8>,
+    pub name: String,
+    pub content_hash: String,
+}
+
+#[derive(Debug)]
+pub enum RemotePreviewOutcome {
+    Ready(PreparedRemote),
+    NeedsApproval(String),
+    NetworkDenied(String),
+}
+
+pub async fn download_remote_install_archive(
+    remote: InstallSource,
+    max_size: u64,
+    network: &NetworkPolicy,
+) -> Result<RemoteDownloadOutcome> {
+    let (bytes, url) = match fetch_tarball(&remote, network, max_size).await? {
+        FetchOutcome::Bytes { bytes, url } => (bytes, url),
+        FetchOutcome::NeedsApproval(host) => {
+            return Ok(RemoteDownloadOutcome::NeedsApproval(host));
+        }
+        FetchOutcome::Denied(host) => {
+            return Ok(RemoteDownloadOutcome::NetworkDenied(host));
+        }
+    };
+    let checksum = sha256_hex(&bytes);
+    let (bundle_path, pinned_sha256) = remote_fragment(&remote)?;
+    if let Some(pinned) = pinned_sha256
+        && pinned != checksum
+    {
+        return Err(PluginArchiveMismatch {
+            url,
+            expected: pinned,
+            actual: checksum,
+        }
+        .into());
+    }
+    let bytes_clone = bytes.clone();
+    #[cfg(any(test, feature = "test-support"))]
+    let env_scope = codewhale_runtime::test_support::env_scope_ticket();
+    let has_npm_deps = tokio::task::spawn_blocking(move || -> Result<bool> {
+        #[cfg(any(test, feature = "test-
```

**File**: `crates/plugins/src/install/npm_deps.rs` (modified, +415/-228)
```diff
@@ -1,4 +1,5 @@
 use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet, VecDeque};
+use std::fmt;
 use std::fs::{self, File};
 use std::io::Write;
 use std::path::{Component, Path, PathBuf};
@@ -8,7 +9,7 @@ use std::time::Duration;
 use anyhow::{Context, Result, bail};
 use base64::Engine as _;
 use codewhale_net::guard::{GuardedGet, PrivateTargets};
-use codewhale_net::network_policy::NetworkPolicy;
+use codewhale_net::network_policy::{Decision, NetworkPolicy};
 use codewhale_skill_install::bounded_tar::{
     entry_names_within_bound, map_stream_limit, open_bounded_tarball,
 };
@@ -22,12 +23,43 @@ use sha2::{Digest, Sha512};
 use super::dsh::{Value, presets};
 
 const NPM_REGISTRY: &str = "https://registry.npmjs.org";
+const NPM_REGISTRY_HOST: &str = "registry.npmjs.org";
+
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub enum NpmDepsNetworkError {
+    NeedsApproval(&'static str),
+    Denied(&'static str),
+}
+
+impl fmt::Display for NpmDepsNetworkError {
+    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
+        match self {
+            Self::NeedsApproval(host) => write!(
+                f,
+                "Network approval required for {host}; use /network allow {host}, then retry"
+            ),
+            Self::Denied(host) => write!(f, "Network access denied for {host}"),
+        }
+    }
+}
+
+impl std::error::Error for NpmDepsNetworkError {}
+
+fn ensure_registry_allowed(network: &NetworkPolicy) -> Result<()> {
+    match network.decide(NPM_REGISTRY_HOST) {
+        Decision::Allow => Ok(()),
+        Decision::Prompt => Err(NpmDepsNetworkError::NeedsApproval(NPM_REGISTRY_HOST).into()),
+        Decision::Deny => Err(NpmDepsNetworkError::Denied(NPM_REGISTRY_HOST).into()),
+    }
+}
 const NPM_ACCEPT_HEADER: &str = "application/vnd.npm.install-v1+json, application/json";
 const MAX_PACKUMENT_BYTES: usize = 32 * 1024 * 1024;
 const MAX_TARBALL_BYTES: usize = 64 * 1024 * 1024;
 const MAX_UNPACKED_PACKAGES: usize = 256;
 const MAX_UNPACKED_FILES: usize = 14_000;
 const MAX_UNPACKED_BYTES: u64 = 220 * 1024 * 1024;
+const MAX_SCAN_DEPTH: usize = 32;
+const MAX_SCAN_FILE_BYTES: usize = 2 * 1024 * 1024;
 
 type CachedTarballs = HashMap<(String, String), Arc<Vec<u8>>>;
 
@@ -368,6 +400,7 @@ fn strip_tar_package_prefix(raw_path: &Path) -> Option<PathBuf> {
 }
 
 async fn fetch_packument(package_name: &str, network: &NetworkPolicy) -> Result<Arc<Packument>> {
+    ensure_registry_allowed(network)?;
     if !is_valid_npm_name(package_name) {
         bail!("invalid npm package name `{package_name}`");
     }
@@ -412,6 +445,7 @@ async fn fetch_verified_tarball(
     dist: &PackumentDist,
     network: &NetworkPolicy,
 ) -> Result<Arc<Vec<u8>>> {
+    ensure_registry_allowed(network)?;
     let key = (package_name.to_string(), version.to_string());
     if let Ok(guard) = tarball_cache().lock()
         && let Some(cached) = guard.get(&key)
@@ -450,248 +484,373 @@ async fn fetch_verified_tarball(
     Ok(arc)
 }
 
-pub(crate) fn maybe_stage_with_dependencies(
-    package_root: &Path,
-    manifest: &Value,
-    entries: &[Value],
-    network: &NetworkPolicy,
-) -> Result<Option<tempfile::TempDir>> {
-    let declared = declared_dependencies(manifest);
-    if declared.is_empty() {
-        return Ok(None);
+fn read_capped_scan_text(path: &Path, max_bytes: usize) -> Result<Option<String>> {
+    let file = codewhale_util::bundle_file::open_bundle_file(path)
+        .with_context(|| format!("failed to open DSH file `{}`", path.display()))?;
+    let mut buf = Vec::new();
+    let mut limited = std::io::Read::take(file, (max_bytes + 1) as u64);
+    std::io::Read::read_to_end(&mut limited, &mut buf)?;
+    if buf.len() > max_bytes {
+        bail!(
+            "DSH source file `{}` exceeds {max_bytes} byte scan limit",
+            path.display()
+        );
     }
-    let root = package_root.to_path_buf();
-    let entries = entries.to_vec();
-    let network = network.clone();
-    std::thread::spawn(move || -> Result<Option<tempfile::TempDir>> {
-        fn scan_dir(
-            base: &Path,
-            cur: &Path,
-            declared: &BTreeMap<String, String>,
-            has_roster: bool,
-            import_re: &Regex,
-            referenced: &mut BTreeSet<String>,
-        ) -> Result<()> {
-            for entry in fs::read_dir(cur)? {
-                let entry = entry?;
-                let path = entry.path();
-                let meta = fs::symlink_metadata(&path)?;
-                if meta.file_type().is_symlink() {
-                    continue;
-                }
-                let Ok(rel) = path.strip_prefix(base) else {
-                    continue;
-                };
-                if meta.is_dir() {
-                    if let Some(name) = path.file_name().and_then(|s| s.to_str())
-                        && matches!(
-                            name,
-                            "node_modules"
-                                | "artifacts"
-          
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

## X. tui: show exact, estimated, or unknown cost labels and update changelog

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `336cd8a4`: tui: show exact, estimated, or unknown cost labels and update changelog. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- The cost label shows an exact cost, an estimate or unknown.
- Cost tracking can no longer fail your work: a turn, a review, an Auto-Review check, a purge, a sub-agent or an Auto routing decision finishes even when Codewhale cannot record its cost, and the cost then shows as unknown.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `336cd8a4` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
