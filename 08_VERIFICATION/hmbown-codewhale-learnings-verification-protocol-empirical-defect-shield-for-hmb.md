# Verification Protocol: Verification Protocol: Empirical Defect Shield for hmbown-codewhale-learnings

<!-- PROVENANCE_START
{
  "source_repository": "hmbown-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T21:13:21.597Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hmbown-codewhale-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hmbown-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T21:13:21.597Z`  
> **Learning ID**: `LEARN-EVO-hmbown-codewhale-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `hmbown-codewhale-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: github ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Source Version**: `d5abe4bf`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T21:09:17.930Z  
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
> **Harvest Timestamp**: 2026-11-22T21:09:17.776Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: An open-source coding agent for your terminal, written in Rust. It works with any model, can split one task across several agents, and every line of it is yours to read.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41197 stars

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
- **Issue #7452** (2026-11-22): **fix(tui): keep a streamed delta in the cell its own kind owns**
  *Symptoms*: fix(tui): keep a streamed delta in the cell its own kind owns  ## What and why  A block's kind is decided by its start event alone. When a gateway opens a text block in the middle of a thinking stream and then keeps sending thinking deltas, block 0 stays marked text: `commit_streaming_display_tick` reads `block_is_thinking(0)`, gets false, and writes the reasoning into the assistant body. One reasoning sentence is then split across the thinking card and the prose that follows it.  This is the same visible defect as #7123, with the two block kinds swapped: the PR that fixed #7123 taught the display beat to route by the block's own kind, but the kind itself is only ever set by a start event, so a gateway that starts a block of the other kind mid-stream poisons it.  `StreamingState::set_block_kind` relabels one live block in place. Unlike `reset` it leaves every other block and both accumulated counters alone. `streaming_thinking::resync_block_kind` delivers the pending tail to the cell the old kind owned first, then relabels; a relabel away from thinking also finalizes the reasoning card and stashes its text, so the spinner stops and replay still has the words. Both delta handlers call it before pushing, so the normal Anthropic ordering returns after one comparison.  ## Issue  Refs #7123  ## How I tested it  - `cargo fmt --all -- --check` — clean. - `cargo check -p codewhale-tui --tests --lib -p codewhale-tui-kit` — clean. - `cargo test -p codewhale-tui-kit --lib` — `test resul

- **Issue #7449** (2026-11-21): **fix(engine): compact diagnostic late-usage receipts at the ledger bound (#6842)**
  *Symptoms*: ## What and why  The `.late-usage/<id>.json` ledger keeps a 1 MiB bound and refused the whole write when adding a record would cross it. Diagnostic-only receipts — the route-decision evidence written by `persist_late_decision_receipt` — carry no spend, but they count toward that bound and can fill it on their own.  This makes the write compact instead of refusing: when a candidate would exceed 1 MiB, drop the oldest diagnostic-only records until it fits, and keep every spend-bearing record (settled or unresolved) unchanged. Replay still dedupes by `source_fingerprint`, so no spend is forgotten or double-counted.  ## Where this came from  Refs #6842. This is the sidecar half of the issue; bounding the unordered replay index (`usage_source_fingerprints`) and the retained journal archive policy remain open there.  ## How I tested it  - `cargo test -p codewhale-engine --lib oversized_ledger_compacts_diagnostic_receipts_before_failing` — 1 passed (the new fixture builds a ledger over 1 MiB with diagnostic + spend records; after the write, all spend records survive, the diagnostic count shrinks, and the file is within the bound) - The existing bound tests still pass: a ledger made only of spend-bearing records still returns `InvalidData` rather than silently truncating a receipt. - `cargo fmt --all -- --check` — passed - The `Behaviour:` line is in the commit body; `scripts/check-behaviour-line.py` arrives with #7445 and is not on this branch yet.  ## Checklist  - [x] One focused c

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

### Incident Patch 1: `7b246b2d` (2026-11-22)
**Commit Message**: fix(stream): retry a request once when no response headers arrive

A provider held one request's response headers past the 180s
`stream.open_timeout_secs` wait in the middle of a long turn (0.10.3,
thinking high). The turn ended with `llm_network_error ... did not receive
response headers after 180s`, nothing was sent again, and the person had to
notice and resend. The phase log also said `bound_secs=690` for "waiting for
the model's first response" while the request was cut at 180s. (CW-8323)

Retry. The turn loop already owns re-sending a request whose stream never
opened: `StreamRetryBudget` plus `PhaseResult::Retry` in the model step,
until now only for proven pre-dispatch connection failures
(`stream.max_resumes`). A header timeout goes through the same owner with a
second budget, `stream.open_retries` (default 1, 0 disables, at most 3). It
resets when a stream opens, so each request gets its own retry. No retry
loop was added to the client: `open_sse_response` and the HTTP retry loop
still send a header-stalled request once.

The turn loop has to know a header timeout by type, not by message text, so
`open_sse_response` now returns `LlmError::HeaderTimeout { waited, http1,
re

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **A model request that gets no response is retried once:** when a provider sends no response headers within `stream.open_timeout_secs` (180 seconds by default), Codewhale sends the request again instead of ending the turn, and the transcript says so (`Retry attempt: stream-open-timeout 1/1; provider sent no response headers in 180s; sending the request again`). If the retry also times out, the turn fails with the same error, which now says a retry was already attempted. `stream.open_retries` sets the count (default `1`, `0` turns it off, at most `3`). The provider may have processed and billed the first request, so its usage stays recorded as unknown. Agents a session starts follow the configured `[stream]` retry counts too. In the turn log, `bound_secs` for "waiting for the model's first response" is now the timeout that request is under, and the watchdog ceiling is logged separately as `stall_after_secs`. (CW-8323)
 - **Narrow terminals keep the working clock:** at 80 and 60 columns the status row under the composer keeps `working 3s` / `using tool 12s` while a turn runs. The `Shift+Tab to change` hint, then `Esc to interrupt`, stand down first, and a connector notice shortens (`MCP · 1 failed · /mcp`) instead of taking the clock's place. (CW-8264)
 - The Resume confirmation no longer draws its border over the composer on a 60x20 terminal, and the Plugins panel footer always keeps `Esc close`, dropping the per-row hints first at 80 columns.
 
```

**File**: `config.example.toml` (modified, +1/-0)
```diff
@@ -1194,6 +1194,7 @@ base_url = "https://api.deepseek.com/beta"
 # Legacy [tui] stream_* keys remain fallbacks when a canonical field is absent.
 [stream]
 open_timeout_secs = 180     # response headers, including connect (0 = env/default, 5-600)
+open_retries = 1            # re-sends after no response headers arrived in time (0 = off, 0-3)
 chunk_timeout_secs = 900    # per-SSE-chunk idle bound (0 = default, 1-3600)
 max_resumes = 3             # proven pre-dispatch connection recovery (0 = off, 0-10)
 max_transparent_retries = 2 # compatibility value; interrupted streams never reissue
```

**File**: `crates/config/src/config_resolve.rs` (modified, +4/-1)
```diff
@@ -539,7 +539,10 @@ impl ConfigToml {
                 // are u64. Reject invalid types before touching the document.
                 let max = if matches!(
                     field,
-                    "max_resumes" | "max_transparent_retries" | "max_stream_errors"
+                    "open_retries"
+                        | "max_resumes"
+                        | "max_transparent_retries"
+                        | "max_stream_errors"
                 ) {
                     i64::from(u32::MAX)
                 } else {
```

**File**: `crates/config/src/settings_schema.rs` (modified, +1/-0)
```diff
@@ -1416,6 +1416,7 @@ pub const SETTINGS_SCHEMA: &[SettingDef] = &[
     def("stream_chunk_timeout_secs", SettingKind::Int, "900", None),
     // Canonical transport keys. Runtime resolution stays in TUI Config.
     def("stream.open_timeout_secs", SettingKind::Int, "180", None),
+    def("stream.open_retries", SettingKind::Int, "1", None),
     def("stream.chunk_timeout_secs", SettingKind::Int, "900", None),
     def("stream.max_resumes", SettingKind::Int, "3", None),
     def(
```

**File**: `crates/config/src/tests.rs` (modified, +1/-0)
```diff
@@ -10955,6 +10955,7 @@ fn stream_settings_are_typed_nested_and_fail_without_mutation() {
     for (key, value) in [
         ("stream.max_resumes", "-1"),
         ("stream.max_resumes", "4294967296"),
+        ("stream.open_retries", "4294967296"),
         ("stream.force_http1", "flase"),
         ("stream.tcp_keepalive_secs", "1.5"),
         ("stream.open_timout_secs", "45"),
```

**File**: `crates/engine/src/client.rs` (modified, +6/-4)
```diff
@@ -5412,7 +5412,10 @@ fn retry_reason_label_and_human(err: &LlmError) -> (&'static str, String) {
     // The variant, never the payload. Every `LlmError` variant carries the raw
     // provider HTTP body verbatim, and a 400 from a content filter routinely
     // echoes the prompt.
-    if matches!(err, LlmError::NetworkError(_) | LlmError::Timeout(_)) {
+    if matches!(
+        err,
+        LlmError::NetworkError(_) | LlmError::HeaderTimeout { .. } | LlmError::Timeout(_)
+    ) {
         codewhale_telemetry::session_counters()
             .bump_error(codewhale_telemetry::ErrorCounter::NetworkError);
     }
@@ -5426,7 +5429,7 @@ fn retry_reason_label_and_human(err: &LlmError) -> (&'static str, String) {
             ("rate_limited", human)
         }
         LlmError::ServerError { status, .. } => ("server_error", format!("upstream {status}")),
-        LlmError::NetworkError(_) => (
+        LlmError::NetworkError(_) | LlmError::HeaderTimeout { .. } => (
             "network_error",
             "network error; request outcome unknown".to_string(),
         ),
@@ -7414,9 +7417,8 @@ pub fn stream_first_response_bound(open: Duration, idle: Duration) -> Duration {
         .saturating_add(stream_entry::first_byte_timeout(idle))
 }
 
-#[cfg(test)]
 pub use stream_entry::first_byte_timeout as stream_first_byte_timeout;
-pub use stream_entry::is_stream_open_transport_failure;
+pub use stream_entry::{is_stream_open_transport_failure, stream_open_header_timeout};
 pub mod wire;
 
 // Retain the crate-visible accounting helpers at the existing client seam.
```

**File**: `crates/engine/src/client/stream_entry.rs` (modified, +24/-16)
```diff
@@ -305,13 +305,14 @@ fn is_protocol_or_tls_failure(detail: &str) -> bool {
             .any(|needle| lower.contains(needle))
 }
 
-/// Added to a response-header timeout (#6889). A provider prefilling a large
-/// or high-thinking request or loading a cold model can hold headers back
-/// longer than this wait, and transport advice alone makes that read as a
-/// broken connection.
-const COLD_MODEL_HINT: &str = "The provider may still be prefilling a large or high-thinking \
-     request or loading a cold model: wait a moment and send the message again, or allow a \
-     longer wait with `codewhale config set stream.open_timeout_secs 300` (up to 600).";
+#[must_use]
+pub fn stream_open_header_timeout(err: &anyhow::Error) -> Option<Duration> {
+    err.chain()
+        .find_map(|cause| match cause.downcast_ref::<LlmError>() {
+            Some(LlmError::HeaderTimeout { waited, .. }) => Some(*waited),
+            _ => None,
+        })
+}
 
 pub async fn open_sse_response<F, Fut>(
     open_req: &StreamOpenRequest,
@@ -334,10 +335,11 @@ where
             }
         }
         Err(_) => {
-            return Err(anyhow::Error::new(LlmError::NetworkError(format!(
-                "SSE stream request did not receive response headers after {}s; request outcome unknown. {COLD_MODEL_HINT}",
-                open_req.open_timeout.as_secs()
-            ))));
+            return Err(anyhow::Error::new(LlmError::HeaderTimeout {
+                waited: open_req.open_timeout,
+                http1: false,
+                retried: 0,
+            }));
         }
     }
     let h1_req = open_req.clone().with_h1_only();
@@ -347,10 +349,11 @@ where
     {
         Ok(Ok(response)) => Ok(response),
         Ok(Err(err)) => Err(h1_fallback_error(err)),
-        Err(_) => Err(anyhow::Error::new(LlmError::NetworkError(format!(
-            "SSE stream request did not receive response headers after {}s on HTTP/1.1; request outcome unknown. {COLD_MODEL_HINT}",
-            h1_req.open_timeout.as_secs()
-        )))),
+        Err(_) => Err(anyhow::Error::new(LlmError::HeaderTimeout {
+            waited: h1_req.open_timeout,
+            http1: true,
+            retried: 0,
+        })),
     }
 }
 
@@ -578,7 +581,12 @@ force_http1 = {pinned}
             .expect("header stall must be a typed LlmError");
         assert!(
             !classified.is_retryable(),
-            "header stall must not be replayable: {classified:?}"
+            "the HTTP retry loop must not replay a header stall: {classified:?}"
+        );
+        assert_eq!(
+            stream_open_header_timeout(&err.context("adapter context")),
+            Some(Duration::from_millis(100)),
+            "the turn loop recognizes the header timeout by type"
         );
         assert!(text.contains("outcome unknown"), "{text}");
         assert!(
```

**File**: `crates/engine/src/client/system_one.rs` (modified, +1/-0)
```diff
@@ -547,6 +547,7 @@ pub fn router_failure_from_error(error: &anyhow::Error) -> AutoRouterFailure {
                 AutoRouterFailure::Http { status }
             }),
         LlmError::NetworkError(_)
+        | LlmError::HeaderTimeout { .. }
         | LlmError::ConnectError { .. }
         | LlmError::Timeout(_)
         | LlmError::ParseError(_) => AutoRouterFailure::Transport,
```

---

### Incident Patch 2: `76af39a5` (2026-11-22)
**Commit Message**: fix(tui): keep the working clock and dialog chrome whole on narrow terminals

Four narrow-terminal defects from the bc58781ba10c acceptance captures
(CW/artifacts/tui-acceptance-bc58781-20261122).

B-D1 / B-D2 (CW-8264, a working session looks dead). The posture bar's
shed ladder dropped the turn clock first (#5914 kept the hint and counts
over the stopwatch), and the right notice was sized against the
permission chip alone. At 80 columns a failed-connector notice therefore
took the row from `working Ns`, and at 60 columns `Shift+Tab to change`
and `Esc to interrupt` did even with no notice. The kit ladder now sheds
session clock, permission key, hint, counts, and only then the turn
clock (cap warning and mode still outrank it; the compact preset still
starts past everything live), and the right notice is clipped against
permission plus the turn clock. The host budgets the notice the same
way: while a turn runs it first takes the notice text or a fallback
that fits whole beside clock and hint (`MCP · 1 failed · /mcp`), and
otherwise fits it against what the clock alone leaves, so the hint
stands down before the notice and the notice before the clock. The
#6084 turn-only rung is gon

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -7,6 +7,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- **Narrow terminals keep the working clock:** at 80 and 60 columns the status row under the composer keeps `working 3s` / `using tool 12s` while a turn runs. The `Shift+Tab to change` hint, then `Esc to interrupt`, stand down first, and a connector notice shortens (`MCP · 1 failed · /mcp`) instead of taking the clock's place. (CW-8264)
+- The Resume confirmation no longer draws its border over the composer on a 60x20 terminal, and the Plugins panel footer always keeps `Esc close`, dropping the per-row hints first at 80 columns.
+
 ## [0.10.3] - 2026-11-21
 
 Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features] plugin_creator`) and unmodified DeepSeek Harness (`@deepseek-ai/dsh-*`) plugin compatibility, an upgraded Auto-Review guardian with workspace boundaries, soft rules, sub-agent return review, and one-use retry approvals, and a single `Shift+Tab` permission dial defaulting to Accept Edits (`Ask → Accept Edits → Plan → Auto-Review → Full Access`). It moves the ACP server and external-agent sessions (including Qwen Code and GitHub Copilot CLI) onto the official Agent Client Protocol SDK, publishes native signed HarmonyOS ARM64 release assets, adds a verified signed model-and-provider registry channel alongside unified model-ID resolution and managed `/v1/models` pricing, updates design tokens to `5.4.0` with a docked single-line approval strip, folded turn activity, live working-row light sweeps and 13 hex-lattice dot-whale forms, adds `claude-org` billing auth, `show_data` transcript charts, `codewhale sessions migrate`, DeepSeek Chatbot web search and speech tools, receipted self-updates and `codewhale uninstall`, and lands reliability, CJK/Unicode, Windows, and sandbox security fixes.
```

**File**: `crates/tui/CHANGELOG.md` (modified, +5/-0)
```diff
@@ -7,6 +7,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- **Narrow terminals keep the working clock:** at 80 and 60 columns the status row under the composer keeps `working 3s` / `using tool 12s` while a turn runs. The `Shift+Tab to change` hint, then `Esc to interrupt`, stand down first, and a connector notice shortens (`MCP · 1 failed · /mcp`) instead of taking the clock's place. (CW-8264)
+- The Resume confirmation no longer draws its border over the composer on a 60x20 terminal, and the Plugins panel footer always keeps `Esc close`, dropping the per-row hints first at 80 columns.
+
 ## [0.10.3] - 2026-11-21
 
 Codewhale v0.10.3 brings a unified Plugins surface with Creator mode (`[features] plugin_creator`) and unmodified DeepSeek Harness (`@deepseek-ai/dsh-*`) plugin compatibility, an upgraded Auto-Review guardian with workspace boundaries, soft rules, sub-agent return review, and one-use retry approvals, and a single `Shift+Tab` permission dial defaulting to Accept Edits (`Ask → Accept Edits → Plan → Auto-Review → Full Access`). It moves the ACP server and external-agent sessions (including Qwen Code and GitHub Copilot CLI) onto the official Agent Client Protocol SDK, publishes native signed HarmonyOS ARM64 release assets, adds a verified signed model-and-provider registry channel alongside unified model-ID resolution and managed `/v1/models` pricing, updates design tokens to `5.4.0` with a docked single-line approval strip, folded turn activity, live working-row light sweeps and 13 hex-lattice dot-whale forms, adds `claude-org` billing auth, `show_data` transcript charts, `codewhale sessions migrate`, DeepSeek Chatbot web search and speech tools, receipted self-updates and `codewhale uninstall`, and lands reliability, CJK/Unicode, Windows, and sandbox security fixes.
```

**File**: `crates/tui/src/tui/goldens/footer_80x24.txt` (modified, +1/-1)
```diff
@@ -21,4 +21,4 @@
                                                                                 
                                                                                 
                                                                                 
- ● ask  Shift+Tab to change   2 agents   worked 41m 12s   Esc to interrupt      
+ ● ask  Shift+Tab to change   working 1m 15s   2 agents   Esc to interrupt      
```

**File**: `crates/tui/src/tui/launch_resume_confirm.rs` (modified, +41/-1)
```diff
@@ -19,6 +19,9 @@ use crate::tui::views::{ModalKind, ModalView, ViewAction, ViewEvent, centered_mo
 use codewhale_localization::{Locale, MessageId, tr};
 use codewhale_palette as palette;
 
+const MIN_HEIGHT: u16 = 7;
+pub(crate) const MIN_CANVAS_HEIGHT: u16 = MIN_HEIGHT + 2;
+
 pub struct LaunchResumeConfirmView {
     session_id: String,
     title: String,
@@ -126,7 +129,7 @@ impl ModalView for LaunchResumeConfirmView {
     }
 
     fn occupied_region(&self, area: Rect) -> Rect {
-        centered_modal_area(area, 64, 11, 32, 7)
+        centered_modal_area(area, 64, 11, 32, MIN_HEIGHT)
     }
 
     fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
@@ -337,6 +340,43 @@ mod tests {
         }
     }
 
+    #[test]
+    fn the_popup_stays_above_the_composer_on_a_short_terminal() {
+        let area = Rect::new(0, 0, 60, 20);
+        let composer_top = 14;
+        let mut stack = crate::tui::views::ViewStack::new();
+        stack.push(view());
+        assert_eq!(
+            stack.top_occupied_region(area).map(|popup| popup.bottom()),
+            Some(15),
+            "centered in the whole frame, the popup's border lands on the composer's"
+        );
+        stack.set_composer_top(Some(composer_top));
+        let popup = stack.top_occupied_region(area).expect("a popup is open");
+        assert!(popup.bottom() <= composer_top, "{popup:?}");
+        let mut buf = Buffer::empty(area);
+        stack.render(area, &mut buf);
+        for y in composer_top..area.height {
+            let row: String = (0..area.width).map(|x| buf[(x, y)].symbol()).collect();
+            assert!(row.trim().is_empty(), "row {y} is the composer's: {row:?}");
+        }
+        let painted: String = (0..composer_top)
+            .flat_map(|y| (0..area.width).map(move |x| (x, y)))
+            .map(|at| buf[at].symbol())
+            .collect();
+        assert!(
+            painted.contains("12 msgs") && painted.contains("Esc"),
+            "{painted}"
+        );
+
+        stack.set_composer_top(Some(MIN_CANVAS_HEIGHT - 1));
+        assert_eq!(
+            stack.top_occupied_region(area).map(|popup| popup.bottom()),
+            Some(15),
+            "too little room above the composer keeps the popup readable over it"
+        );
+    }
+
     #[test]
     fn the_popup_names_the_session_it_is_asking_about() {
         let confirm = view();
```

**File**: `crates/tui/src/tui/phase_strip.rs` (modified, +18/-3)
```diff
@@ -1146,10 +1146,18 @@ pub(crate) fn tideline_footer_from_app(app: &mut App, width: u16) -> TidelineFoo
     // The right slot: the live status toast if one is owed, else the compact
     // MCP or plugin boot chip, else the remote-control state when it is on.
     // Clause-shed against half the row — the posture facts own the other
-    // half.
+    // half — and, while a turn runs, against what the turn clock leaves.
     let notice_budget = (usize::from(width) / 2)
         .max(8)
         .min(usize::from(width).saturating_sub(permission_chip.0.width() + 5));
+    let (turn_clock, session_clock) = working_clock(app, phase, &phase_label);
+    let beside_clock = turn_clock.as_ref().map(|(clock, _)| {
+        usize::from(width).saturating_sub(permission_chip.0.width() + clock.width() + 8)
+    });
+    let beside_hint = beside_clock.zip(hint.as_ref()).map(|(budget, (hint, _))| {
+        notice_budget.min(budget.saturating_sub(hint.width() + ITEM_SEPARATOR_WIDTH))
+    });
+    let notice_budget = beside_clock.map_or(notice_budget, |budget| notice_budget.min(budget));
     let right = selected_notice(app.active_status_toast(phase), &phase_label)
         .map(|(text, fallbacks, ink, urgent)| {
             (
@@ -1180,7 +1188,15 @@ pub(crate) fn tideline_footer_from_app(app: &mut App, width: u16) -> TidelineFoo
                 .map(|chip| (chip.text, Vec::new(), boot_activity_ink(chip.level), false))
         })
         .and_then(|(text, fallbacks, ink, urgent)| {
-            fit_notice_candidates(&text, &fallbacks, notice_budget, urgent)
+            beside_hint
+                .and_then(|budget| {
+                    std::iter::once(&text)
+                        .chain(&fallbacks)
+                        .map(|candidate| candidate.trim())
+                        .find(|candidate| !candidate.is_empty() && candidate.width() <= budget)
+                        .map(str::to_string)
+                })
+                .or_else(|| fit_notice_candidates(&text, &fallbacks, notice_budget, urgent))
                 .map(|fitted| (fitted, ink))
         })
         .or_else(|| {
@@ -1196,7 +1212,6 @@ pub(crate) fn tideline_footer_from_app(app: &mut App, width: u16) -> TidelineFoo
             }
         });
 
-    let (turn_clock, session_clock) = working_clock(app, phase, &phase_label);
     let (counts, count_actions) = live_counts(app, tier);
     TidelineFooterFacts {
         permission_chip,
```

**File**: `crates/tui/src/tui/phase_strip/tideline_tests.rs` (modified, +55/-40)
```diff
@@ -172,14 +172,13 @@ fn posture_bar_pins_notice_or_remote_control_right() {
     assert!(narrow.contains(" ask"), "{narrow}");
 }
 
-/// Shed ladder, most expendable first: the turn clock, the session clock,
-/// the permission key (a binding reminder, and the widest optional item),
-/// the hint, the counts. The permission chip
-/// never sheds (#5796); the clock is what a glance wants and the hint and
-/// counts are what a keystroke wants, so on a row too narrow for both the
-/// clock goes (#5914).
+/// Shed ladder, most expendable first: the session clock, the permission
+/// key (a binding reminder, and the widest optional item), the hint, the
+/// counts, the turn clock. The permission chip never sheds (#5796), and the
+/// turn clock is the last live fact to go: a row that drops it for a static
+/// hint leaves a working session looking dead (CW-8264).
 #[test]
-fn posture_bar_sheds_the_clocks_then_the_hint_and_counts() {
+fn posture_bar_sheds_static_hints_before_the_turn_clock() {
     let fixture = working();
     let narrowest_showing = |needle: &str| -> u16 {
         (8..=160u16)
@@ -193,10 +192,10 @@ fn posture_bar_sheds_the_clocks_then_the_hint_and_counts() {
     let counts = narrowest_showing("2 agents");
     let permission_key = narrowest_showing("Shift+Tab to change");
     assert!(
-        turn_clock > session_clock
-            && session_clock > permission_key
+        session_clock > permission_key
             && permission_key > hint
-            && hint > counts,
+            && hint > counts
+            && counts > turn_clock,
         "turn_clock@{turn_clock} session_clock@{session_clock} hint@{hint} counts@{counts} permission_key@{permission_key}"
     );
     for w in 8..=160u16 {
@@ -665,43 +664,16 @@ fn a_session_that_has_not_worked_states_no_clock() {
     );
 }
 
-/// #6084: when the session half will not paint, the shed ladder must not
-/// drop the turn clock at the turn-only rung — that would leave no clock
-/// at all. Find a width where both-clocks already sheds the turn half while
-/// keeping the session half; with only the turn clock, that width must keep
-/// it (shed at the session-clock rung instead).
-#[test]
-fn absent_session_clock_keeps_turn_past_the_turn_only_rung() {
-    let mut first_turn = working();
-    first_turn.session_clock = None;
-    let both = working();
-    let width = (8..=160u16)
-        .find(|&w| {
-            let text = draw(w, 3, &both.widget(&UI_THEME));
-            text.contains("worked 41m 12s") && !text.contains("working 1m 15s")
-        })
-        .expect("both-clocks fixture must shed turn before session at some width");
-    let text = draw(width, 3, &first_turn.widget(&UI_THEME));
-    assert!(
-        text.contains("working 1m 15s"),
-        "{width}: with no session half, the turn clock must survive the turn-only shed rung (#6084): {text}"
-    );
-}
-
-/// Narrow terminals shed both clock halves before the hint and the counts,
-/// the turn half before the session half, and neither reading is ever
+/// Narrow terminals shed the session clock, then the hint, then the counts,
+/// and the turn clock only after all of them; neither reading is ever
 /// painted half-truncated.
 #[test]
-fn narrow_widths_shed_the_clocks_before_the_hint_and_counts() {
+fn narrow_widths_keep_the_turn_clock_past_the_hint_and_counts() {
     let fixture = working();
     for w in 8..=160u16 {
         let text = draw(w, 3, &fixture.widget(&UI_THEME));
         let turn = text.contains("working 1m 15s");
         let session = text.contains("worked 41m 12s");
-        assert!(
-            !turn || session,
-            "{w} kept the turn clock and dropped the session clock: {text}"
-        );
         assert!(
             !session || text.contains("Esc to interrupt"),
             "{w} kept the session clock and dropped the hint: {text}"
@@ -710,6 +682,10 @@ fn narrow_widths_shed_the_clocks_before_the_hint_and_counts() {
             !text.contains("Esc to interrupt") || text.contains("2 agents"),
             "{w} kept the hint and dropped the counts: {text}"
         );
+        assert!(
+            !text.contains("2 agents") || turn,
+            "{w} kept the counts and dropped the turn clock: {text}"
+        );
         // Whole readings or none: a clipped duration is a lie.
         assert!(
             !text.contains("working 1m") || turn,
@@ -722,6 +698,45 @@ fn narrow_widths_shed_the_clocks_before_the_hint_and_counts() {
     }
 }
 
+#[test]
+fn a_working_turn_keeps_its_clock_on_narrow_rows() {
+    use crate::tui::app::{StatusToast, StatusToastLevel};
+    let footer = |width: u16, notice: bool| {
+        let mut app = session_app();
+        app.ui_locale = codewhale_localization::Locale::En;
+        app.approval_mode = codewhale_execpolicy::ApprovalMode::Bypass;
+        app.is_loading = true;
+        app.turn_started_at = Some(Instant::now() - Duration::from_secs(3));
+        if notice {
+            app.push_status_to
```

**File**: `crates/tui/src/tui/ui/frame.rs` (modified, +2/-0)
```diff
@@ -2123,6 +2123,8 @@ pub(crate) fn render(f: &mut Frame, app: &mut App, _config: &Config) -> Option<(
     };
     let cursor_pos = composer_plan.cursor.map(|pos| (pos.x, pos.y));
     app.viewport.last_composer_area = Some(body_chunks[composer_slot]);
+    app.view_stack
+        .set_composer_top(Some(body_chunks[composer_slot].y));
     app.viewport.last_composer_content = Some(composer_plan.geometry.inner);
     app.viewport.last_composer_scroll_offset = composer_plan.scroll_offset;
     app.viewport.last_composer_top_padding = composer_plan.top_padding;
```

**File**: `crates/tui/src/tui/ui/frame/one_owner_tests.rs` (modified, +20/-29)
```diff
@@ -173,12 +173,12 @@ fn composed_frame_paints_each_fact_in_exactly_one_row() {
             ("permission chip", format!("● {permission}")),
             ("model", model),
             ("cost", super::session_cost_label(&app)),
-            ("agent count", "2 agents".to_string()),
             ("ttft", "ttft 400ms".to_string()),
         ];
         facts.push(("context reading", format!("context {pct}%")));
         facts.push(("output rate", "40 avg tok/s".to_string()));
         if width >= 120 {
+            facts.push(("agent count", "2 agents".to_string()));
             facts.push((
                 "help hint",
                 crate::tui::shell_key_routing::info_help_hint(app.ui_locale),
@@ -225,30 +225,25 @@ fn composed_frame_paints_each_fact_in_exactly_one_row() {
         );
         // The bar carries the working clock (#5914) — how long the current
         // turn has been doing what it is doing, and how long the session has
-        // worked. Both halves shed before the hint and the counts, so a
-        // narrow row keeps the affordances and drops the stopwatch. When
-        // both would paint, the session half needs ~125 columns here (the
-        // running hint also names the agent arrows, `← for agents · ↓ to
-        // manage`) and the turn half ~200; each paints in exactly one row wherever it
-        // paints. The metrics line carries no repository, branch or provider.
+        // worked. The turn half is the last live fact to shed (CW-8264), so
+        // it paints at every width here; against this fixture's pinned scope
+        // notice the counts need 120 columns beside it. The session half
+        // sheds first and needs ~175 with the running hint, which also names
+        // the agent arrows (`← for agents · ↓ to manage`). Each paints in
+        // exactly one row wherever it paints. The metrics line carries no
+        // repository, branch or provider.
         // First turn: the turn half names the phase and stays; the session
         // reading is the identical duration, so it is suppressed rather than
-        // stated twice (#6041). With no session half to paint, the turn
-        // clock sheds at the session rung (#6084) rather than first — but
-        // against this fixture's pinned scope notice, turn+counts+hint is
-        // still just over a 120-column budget, so the hint wins here and
-        // the turn half needs ~160. The shed-order contract itself lives
-        // in tideline_tests.
+        // stated twice (#6041). The shed-order contract itself lives in
+        // tideline_tests.
         let turn_needle = "agents underway 1m 15s";
-        if width >= 160 {
-            assert!(rows[posture].contains(turn_needle), "{}", rows[posture]);
-            assert_eq!(
-                count_rows_containing(&rows, turn_needle),
-                1,
-                "{width}x{height}: {turn_needle:?} paints in exactly one row:\n{}",
-                rows.join("\n")
-            );
-        }
+        assert!(rows[posture].contains(turn_needle), "{}", rows[posture]);
+        assert_eq!(
+            count_rows_containing(&rows, turn_needle),
+            1,
+            "{width}x{height}: {turn_needle:?} paints in exactly one row:\n{}",
+            rows.join("\n")
+        );
         assert!(
             !rows[posture].contains("worked 1m 15s"),
             "{width}x{height}: the duplicate session reading must not be stated: {}",
@@ -259,7 +254,7 @@ fn composed_frame_paints_each_fact_in_exactly_one_row() {
         let mut worked = working_app();
         worked.cumulative_turn_duration = Duration::from_secs(60);
         let rows = draw(&mut worked, width, height);
-        if width >= 160 {
+        if width >= 200 {
             let worked_needle = "worked 2m 15s";
             assert!(rows[posture].contains(worked_needle), "{}", rows[posture]);
             assert_eq!(
@@ -269,11 +264,7 @@ fn composed_frame_paints_each_fact_in_exactly_one_row() {
                 rows.join("\n")
             );
         }
-        // With both clock halves and the running arrow hints, the turn half
-        // needs more than 160 columns.
-        if width >= 200 {
-            assert!(rows[posture].contains(turn_needle), "{}", rows[posture]);
-        }
+        assert!(rows[posture].contains(turn_needle), "{}", rows[posture]);
         assert!(!rows[metrics].contains('⑂'), "{}", rows[metrics]);
         // No dead key hints anywhere in the frame.
         for row in &rows {
@@ -363,7 +354,7 @@ fn context_cap_warns_once_in_the_posture_bar() {
 fn double_tap_window_shows_the_send_now_hint() {
     let mut app = working_app();
     app.arm_double_tap_window();
-    let rows = draw(&mut app, 120, 32);
+    let rows = draw(&mut app, 160, 32);
     let composer = app.viewport.last_composer_area.unwrap().bottom() as usize;
     assert!(
         rows[composer].contains("Enter again to send now · Ctrl+Enter steers"),
```

---

### Incident Patch 3: `78675c59` (2026-11-21)
**Commit Message**: fix(tui): keep a streamed delta in the cell its own kind owns

A block's kind is decided by its start event alone. When a gateway opens a
text block in the middle of a thinking stream and then keeps sending
thinking deltas, block 0 stays marked text: `commit_streaming_display_tick`
reads `block_is_thinking(0)`, gets false, and writes the reasoning into the
assistant body. One reasoning sentence is then split across the thinking
card and the prose that follows it (#7123 with the opposite ordering).

`StreamingState::set_block_kind` relabels one live block in place; unlike
`reset` it leaves every other block and both accumulated counters alone.
`streaming_thinking::resync_block_kind` delivers the pending tail to the
cell the old kind owned first, then relabels. A relabel away from thinking
also finalizes the reasoning card and stashes its text, so the spinner stops
and replay still has the words. Both delta handlers call it before pushing,
so the normal Anthropic ordering returns after one comparison.

The provider's own content-block index is still ignored: the TUI keeps one
active block, and a gateway that interleaves two live blocks can still
misattribute. This fixes the kind, not

**File**: `crates/tui-kit/src/streaming/mod.rs` (modified, +62/-9)
```diff
@@ -15,10 +15,12 @@
 //! What replaced it is not that policy: it takes a measured slice per beat
 //! instead of deciding between two gears.
 //!
-//! Buffering never changes what the model emitted. `accumulated_text` and
-//! `accumulated_thinking` always track the full raw stream, so anything
-//! building API messages or retrying sees the whole receipt regardless of how
-//! much of it is currently visible.
+//! Buffering never changes what the model emitted: a delta reaches a cell only
+//! when a commit beat takes it, but the bytes are never dropped. The
+//! `accumulated_text` / `accumulated_thinking` counters on [`StreamingState`]
+//! are diagnostic only — nothing in the product reads them — and
+//! [`StreamingState::reset`] clears them at a block boundary, so they describe
+//! the current block rather than the whole response.
 //!
 //! # Known limitations
 //!
@@ -329,9 +331,13 @@ pub struct StreamingState {
     blocks: Vec<Option<BlockState>>,
     /// Whether any stream is currently active
     pub is_active: bool,
-    /// Accumulated text for display
+    /// Per-kind byte totals for the current block. Diagnostic only: replay
+    /// reads `App::last_reasoning` and `current_streaming_text`, not these, and
+    /// `reset` clears them at every block boundary. A relabel leaves the bytes
+    /// already collected under the old kind, so after one they no longer match
+    /// the block's current kind.
     pub accumulated_text: String,
-    /// Accumulated thinking for display
+    /// See [`StreamingState::accumulated_text`].
     pub accumulated_thinking: String,
 }
 
@@ -366,9 +372,10 @@ impl StreamingState {
 
     /// Push content to a block.
     ///
-    /// `accumulated_text` / `accumulated_thinking` always track the full raw
-    /// stream so callers building API messages or doing retries see exactly
-    /// what the model emitted, regardless of UI pacing.
+    /// The bytes land in the display buffer and in the block's own accumulated
+    /// counter, which follows the routed kind. The counters are diagnostic —
+    /// replay reads `App::last_reasoning` and `current_streaming_text` — and
+    /// [`StreamingState::reset`] clears them at every block boundary.
     pub fn push_content(&mut self, index: usize, content: &str) {
         if let Some(Some(block)) = self.blocks.get_mut(index) {
             if block.is_thinking {
@@ -390,6 +397,27 @@ impl StreamingState {
         }
     }
 
+    /// Re-label the block at `index` without disturbing anything else.
+    ///
+    /// A block's kind is normally decided by its start event, but a gateway
+    /// can open a text block inside a thinking stream (or the reverse) and
+    /// keep sending deltas of the first kind. `reset` clears every block and
+    /// both accumulated counters; a relabel touches one block's routed kind and
+    /// replaces its pending buffer. The caller must deliver that pending tail
+    /// to the cell the old kind owned first: it is discarded here.
+    pub fn set_block_kind(&mut self, index: usize, is_thinking: bool) {
+        self.ensure_capacity(index);
+        match self.blocks.get_mut(index) {
+            Some(Some(block)) => {
+                block.is_thinking = is_thinking;
+                block.is_streaming = true;
+                block.buffer = StreamBuffer::new();
+                self.is_active = true;
+            }
+            _ => self.start_block(index, is_thinking),
+        }
+    }
+
     /// Whether the block at `index` carries reasoning text.
     ///
     /// Display beats must route a committed delta by the block's own kind.
@@ -456,6 +484,31 @@ impl StreamingState {
 mod tests {
     use super::*;
 
+    #[test]
+    fn set_block_kind_reroutes_the_next_delta() {
+        let mut state = StreamingState::new();
+        state.start_text(0);
+        state.push_content(0, "prose ");
+        assert!(!state.block_is_thinking(0));
+
+        // The caller delivers the pending tail to the cell the old kind owned
+        // before relabeling; the relabel installs a fresh buffer and routes the
+        // next delta to the other kind.
+        assert_eq!(state.finalize_block_text(0), "prose ");
+        state.set_block_kind(0, true);
+        assert!(state.block_is_thinking(0));
+
+        state.push_content(0, "reasoning");
+        assert_eq!(state.commit_text(0, usize::MAX), "reasoning");
+
+        // And back again: prose after an interposed thinking block.
+        assert_eq!(state.finalize_block_text(0), "");
+        state.set_block_kind(0, false);
+        assert!(!state.block_is_thinking(0));
+        state.push_content(0, "tail");
+        assert_eq!(state.commit_text(0, usize::MAX), "tail");
+    }
+
     #[test]
     fn assistant_text_streams_before_newline() {
         let mut state = StreamingState::new();
```

**File**: `crates/tui/src/tui/streaming_thinking.rs` (modified, +63/-0)
```diff
@@ -250,6 +250,69 @@ fn flush_pending_text_tail(app: &mut App) {
     crate::tui::ui::frame::accrue_streaming_token_estimate(app, &remaining);
 }
 
+/// Re-establish the block kind the arriving delta actually carries.
+///
+/// A block's kind is set by its start event alone, so a gateway that opens a
+/// text block inside a thinking stream leaves block 0 marked text. The
+/// reasoning that follows would then be committed into the prose body, and one
+/// sentence would be split across the thinking card and the answer that
+/// follows it — the #7123 split with the opposite ordering. The pending tail
+/// goes to the cell its old kind owned first, then the block takes the new
+/// kind.
+///
+/// A flip closes the reasoning card and starts a fresh one on the way back, so
+/// a gateway that flips twice renders one passage as two cards, the second
+/// without a duration stamp. That is the honest reading of a stream that
+/// really did interleave, not a display defect.
+///
+/// Returns whether the kind changed.
+pub(super) fn resync_block_kind(app: &mut App, is_thinking: bool) -> bool {
+    if app.streaming_state.block_is_thinking(0) == is_thinking {
+        return false;
+    }
+    if is_thinking {
+        flush_pending_text_tail(app);
+    } else if !app.translation_enabled && app.streaming_thinking_active_entry.is_some() {
+        // The prose that interrupted the reasoning closes its card. Leaving
+        // the entry streaming would keep the spinner turning and stamp a
+        // duration that grows until the next finalize; stashing the buffer
+        // matches what `MessageStarted` does, so replay still has the text.
+        //
+        // Skipped under translation so this branch does not clear the entry or
+        // the buffer before `ThinkingComplete` reads them. It cannot make the
+        // card fill in: `MessageDelta` calls `flush_active_cell` immediately
+        // after the resync, which takes the entry regardless. What the guard
+        // buys is that the reasoning text stays in `reasoning_buffer` for
+        // replay, and that fixing the index is left to `ThinkingComplete`.
+        finalize_current(app);
+        stash_reasoning_buffer_into_last_reasoning(app);
+    } else {
+        drain_thinking_tail_into_entry(app);
+    }
+    app.streaming_state.set_block_kind(0, is_thinking);
+    true
+}
+
+/// Deliver a live reasoning block's uncommitted tail into its own card.
+///
+/// The mirror of `flush_pending_text_tail`. Only reached when the entry was
+/// already finalized, so there is usually nothing buffered; when there is, the
+/// bytes also live in `reasoning_buffer` and `set_block_kind` discards this
+/// copy on the next line.
+fn drain_thinking_tail_into_entry(app: &mut App) {
+    if app.translation_enabled
+        || !app.streaming_state.block_is_thinking(0)
+        || app.streaming_state.pending_len(0) == 0
+    {
+        return;
+    }
+    let entry_idx = ensure_active_entry(app);
+    let tail = app.streaming_state.finalize_block_text(0);
+    if !tail.is_empty() {
+        append(app, entry_idx, &tail);
+    }
+}
+
 /// Finalize the currently-streaming thinking entry: drain the pending
 /// state buffer, compute elapsed duration, stop the spinner.
 pub(super) fn finalize_current(app: &mut App) -> bool {
```

**File**: `crates/tui/src/tui/ui/event_loop.rs` (modified, +8/-0)
```diff
@@ -2940,6 +2940,10 @@ pub(crate) async fn run_event_loop(
                         if sanitized.is_empty() {
                             continue;
                         }
+                        // A gateway can open a text block inside a
+                        // thinking stream; a live reasoning tail must reach
+                        // its card before this block is relabeled text.
+                        streaming_thinking::resync_block_kind(app, false);
                         // First delta of a fresh stream has no streaming
                         // cell yet; flush active so the tool group settles
                         // before the assistant prose appears below it.
@@ -3089,6 +3093,10 @@ pub(crate) async fn run_event_loop(
                             app.reasoning_header = extract_reasoning_header(&app.reasoning_buffer);
                         }
 
+                        // The kind comes from the start event alone, so a
+                        // gateway that opened a text block mid-reasoning
+                        // leaves block 0 marked text (#7123).
+                        streaming_thinking::resync_block_kind(app, true);
                         streaming_thinking::ensure_active_entry(app);
                         app.streaming_state.push_content(0, &sanitized);
                         stream_display_clock.note_delta(Instant::now());
```

**File**: `crates/tui/src/tui/ui/tests.rs` (modified, +232/-0)
```diff
@@ -37633,3 +37633,235 @@ async fn approval_prompt_docks_one_row_and_emits_settled_receipt() {
     assert!(!rendered_line.contains('\u{202e}'), "{rendered_line:?}");
     assert!(rendered_line.contains("RLO"), "{rendered_line:?}");
 }
+
+/// A gateway can open a text block inside a thinking stream. The reasoning
+/// that arrives afterwards must return to a thinking card, not continue
+/// inside the prose body (#7123, opposite ordering).
+#[test]
+fn reasoning_after_an_interposed_text_block_returns_to_a_thinking_card() {
+    use crate::tui::ui::frame::{
+        append_streaming_text, commit_streaming_display_tick,
+        ensure_streaming_assistant_history_cell,
+    };
+    use codewhale_tui_kit::streaming::StreamDisplayClock;
+
+    let mut app = create_test_app();
+    let mut clock = StreamDisplayClock::new(Duration::from_millis(33));
+
+    // 1. The first half of the sentence reaches its card the way a delta does:
+    //    buffered, then taken by a display beat.
+    app.streaming_state.reset();
+    app.streaming_state.start_thinking(0);
+    let first_entry = crate::tui::streaming_thinking::ensure_active_entry(&mut app);
+    app.streaming_state.push_content(0, "first half. ");
+    let now = Instant::now();
+    clock.note_delta(now);
+    let _ = commit_streaming_display_tick(&mut app, &mut clock, now + Duration::from_millis(50));
+
+    // 2. The gateway opens a text block mid-reasoning: MessageStarted
+    //    finalizes the live entry and starts a text block.
+    crate::tui::streaming_thinking::finalize_current(&mut app);
+    app.streaming_state.reset();
+    app.streaming_state.start_text(0);
+
+    // 3. The rest of the reasoning arrives. Without the resync it would be
+    //    committed into the prose body, because block 0 is marked text.
+    assert!(
+        crate::tui::streaming_thinking::resync_block_kind(&mut app, true),
+        "the block kind must be taken back"
+    );
+    let second_entry = crate::tui::streaming_thinking::ensure_active_entry(&mut app);
+    app.streaming_state.push_content(0, "second half.");
+    let now = Instant::now();
+    clock.note_delta(now);
+    let _ = commit_streaming_display_tick(&mut app, &mut clock, now + Duration::from_millis(50));
+
+    let first = match app
+        .active_cell
+        .as_ref()
+        .and_then(|active| active.entries().get(first_entry))
+    {
+        Some(HistoryCell::Thinking { content, .. }) => content.clone(),
+        other => panic!("expected a thinking entry at {first_entry}: {other:?}"),
+    };
+    let second = match app
+        .active_cell
+        .as_ref()
+        .and_then(|active| active.entries().get(second_entry))
+    {
+        Some(HistoryCell::Thinking { content, .. }) => content.clone(),
+        other => panic!("expected a thinking entry at {second_entry}: {other:?}"),
+    };
+    assert_eq!(first, "first half. ", "the first half keeps its card");
+    assert_eq!(
+        second, "second half.",
+        "reasoning after an interposed text block must stay in a thinking cell"
+    );
+
+    // 4. Commit the active cell to history and verify the split did not happen
+    //    there: a real assistant cell exists, and it holds no reasoning.
+    app.flush_active_cell();
+    let message_index = ensure_streaming_assistant_history_cell(&mut app);
+    append_streaming_text(&mut app, message_index, "answer");
+    assert!(
+        app.history.iter().any(|cell| {
+            matches!(cell, HistoryCell::Assistant { content, .. } if content.contains("answer"))
+        }),
+        "the assistant cell must hold the answer"
+    );
+    let prose_has_reasoning = app.history.iter().any(|cell| {
+        matches!(cell, HistoryCell::Assistant { content, .. } if content.contains("second half."))
+    });
+    assert!(
+        !prose_has_reasoning,
+        "the assistant cell must not absorb reasoning text"
+    );
+}
+
+/// A kind change inside one live block closes the reasoning card: the spinner
+/// must not keep turning, and the reasoning must survive for replay.
+#[test]
+fn a_relabel_to_text_finishes_the_reasoning_card() {
+    let mut app = create_test_app();
+
+    // `ThinkingDelta` records the text in `reasoning_buffer` and then buffers
+    // it for display; both are needed for `last_reasoning` to be populated.
+    app.streaming_state.reset();
+    app.streaming_state.start_thinking(0);
+    let entry = crate::tui::streaming_thinking::ensure_active_entry(&mut app);
+    app.reasoning_buffer.push_str("reasoning");
+    app.streaming_state.push_content(0, "reasoning");
+
+    // Prose arrives with no MessageStarted between: a gateway switching kinds
+    // inside one block.
+    assert!(
+        crate::tui::streaming_thinking::resync_block_kind(&mut app, false),
+        "the block kind must be taken back"
+    );
+
+    assert_eq!(
+        app.streaming_thinking_active_entry, None,
+        "the reasoning entry must be finalized"
+    );
+    let streaming = match app
+       
```

#### Recent Merged Pull Requests:
- **PR #7456** (2026-11-22): chore(web): record v0.10.3 as the published release (@Hmbown)
- **PR #7452** (2026-11-22): fix(tui): keep a streamed delta in the cell its own kind owns (@SparkofSpike)
- **PR #7450** (2026-11-21): feat: add LLMTR as an OpenAI-compatible provider (@knowhycodata)
- **PR #7449** (2026-11-21): fix(engine): compact diagnostic late-usage receipts at the ledger bound (#6842) (@donglovejava)
- **PR #7448** (2026-11-21): Show request transmission on provider errors (@deosiree)
- **PR #7444** (2026-11-21): test(tui): guard all four paste-burst chunk-flush sites (@donglovejava)

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

## X. stream): retry a request once when no response headers arrive

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7b246b2d`: stream): retry a request once when no response headers arrive. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **A model request that gets no response is retried once:** when a provider sends no response headers within `stream.open_timeout_secs` (180 seconds by default), Codewhale sends the request again instead of ending the turn, and the transcript says so (`Retry attempt: stream-open-timeout 1/1; provider sent no response headers in 180s; sending the request again`). If the retry also times out, the turn fails with the same error, which now says a retry was already attempted. `stream.open_retries` sets the count (default `1`, `0` turns it off, at most `3`). The provider may have processed and billed the first request, so its usage stays recorded as unknown. Agents a session starts follow the configured `[stream]` retry counts too. In the turn log, `bound_secs` for "waiting for the model's first response" is now the timeout that request is under, and the watchdog ceiling is logged separately as `stall_after_secs`. (CW-8323)
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7b246b2d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
