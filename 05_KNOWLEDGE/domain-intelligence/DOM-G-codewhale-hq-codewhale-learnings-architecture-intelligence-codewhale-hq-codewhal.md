# Domain G — Architecture Intelligence: Architecture Intelligence: codewhale-hq-codewhale-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:17:47.482Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-codewhale-hq-codewhale-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:17:47.482Z`  
> **Learning ID**: `LEARN-EVO-codewhale-hq-codewhale-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from codewhale-hq-codewhale-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `8838e415`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T09:17:31.677Z  
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
> **Harvest Timestamp**: 2026-11-27T09:17:31.670Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source Rust coding agent for terminal, web, and desktop. Any model, multi-agent fleets, MCP & plugins, OS sandboxing, and session receipts.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41219 stars

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
- **Issue #7561** (2026-11-25): **fix(util,engine): resolve remaining R5 durability, grep timeout cancel, and bounded review read defects**
  *Symptoms*: ## What and why  Resolves the remaining unaddressed R5 audit gaps from #7461 (on top of `1fa6548ce` and `7e003749f` already landed on `main`) and adds missing behavioral regression tests:  - **R5-L10-01** (`crates/util/src/{utils,fs_confined}.rs`, `crates/engine/src/tools/workflow/journal.rs`): Exported shared best-effort `codewhale_util::utils::sync_directory`, added `codewhale_util::fs_confined::append_durable` (data `sync_all` + best-effort parent directory sync on create), and routed `WorkflowRunJournal::append_record` through it. - **R5-L10-02** (`crates/engine/src/session_manager.rs`, `test_cases_04.rs`): Replaced hard-failing `File::open(...)?.sync_all()?` calls left by `1fa6548ce` (which break on network/FUSE mounts) with shared best-effort `sync_directory` across all session/sidecar/checkpoint/archive unlink paths, with regression test `delete_session_removes_sidecars_and_preserves_shared_runtime_store`. - **R5-L7-01** (`crates/engine/src/tools/search.rs`, `tests.rs`): Derived a child `worker_cancel_token` with `drop_guard` in `run_blocking_grep` (matching `run_blocking_file_search`) so timeouts cancel the worker without cancelling the caller's parent token, with regression test `test_grep_blocking_wrapper_cancels_worker_on_timeout`. - **R5-L9-02** (`crates/engine/src/tools/review.rs`): Passed caller `max_chars` into `resolve_review_source` / `resolve_file_target`, pre-checked size against `max_chars * 4`, read boundedly via `File::take(max_bytes + 1)` inside `spawn_

- **Issue #7557** (2026-11-24): **fix(tui): use the engine catalog effort parser and add the Ollama Cloud effort ladder**
  *Symptoms*: The model picker had its own catalog-token parser (`catalog_effort_value`) duplicating one the engine already owns.  - Use `ReasoningEffort::from_catalog_token` and `ReasoningEffort::catalog_effort_values_for_offering` instead, and always keep `Auto` first in the resulting list. - Add an explicit Ollama Cloud effort ladder (`Auto`, `Off`, `Low`, `Medium`, `High`, `Max`).  Rebased onto current `main`. The branch's separate skills commit was dropped: that work is already on `main` via #7544, and re-applying it would have reverted the merged version.  Net effect: `crates/tui/src/tui/model_picker.rs`, one file. <!-- devin-review-badge-begin -->  ---  <a href="https://app.devin.ai/review/codewhale-hq/codewhale/pull/7557" target="_blank"><picture><source media="(prefers-color-scheme: dark)" srcset="https://static.devin.ai/assets/gh-devin-review-dark.svg?v=4"><img src="https://static.devin.ai/assets/gh-devin-review-light.svg?v=4" alt="Devin Review"></picture></a> <!-- devin-review-badge-end -->
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"942707f524abff1409e2682fc600857967ae4775","has_any_findings":true,"has_unresolved_findings":true,"status":"failed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  <details> <summary><strong>Codex Review Summary</strong>: ❌ Failed</summary>  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ❌ **Failed** <relative-time datetime="2026-11-24T19:35:39.042376Z">2026-11-24T19:35:39.042376Z</relative-time><br/>We couldn’t complete this review. Comment `@codex review` to try again. | `942707f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when yo
  > You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage). To continue using code reviews, add credits to your account and enable them for code reviews in your [settings](https://chatgpt.com/settings/code-review).

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

### Incident Patch 1: `2d6e57d5` (2026-11-26)
**Commit Message**: fix(engine): expand prompt-bound user commands on the Runtime turn path (CW-8421)

A plugin, project or global command such as /ship sent as a Runtime API
turn reached the model as the literal "/ship": only the terminal's
user_registry::try_dispatch applied the command template, so every such
command was broken in Desktop and other Runtime clients.

try_dispatch is split into lookup (registry resolution plus dispatch_error)
and expand_template (plugin authority plus apply_template). The
CommandCatalog trait gains expands_user_commands/expand_user_command;
CommandTable implements them with the same registry view /v1/commands
lists, so the terminal and the Runtime share one implementation and the
terminal's precedence (user commands before builtins; skills never own a
slash spelling on the Runtime path).

The Runtime turn endpoint expands /name args before admission: the model
gets the template, input_summary keeps the typed text, the command's
allowed_tools only narrows the request's or thread's tools, a denied
plugin command is a 422 user_command_denied (never sent raw), and the
response's user_command names what ran. Steer expands too and refuses a
tool-restricting command mid-tur

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -69,6 +69,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Ask asks before every command, read-only ones included:** in Ask, a shell command the Engine classes as read-only (such as `ls` or `git status -s`) ran without a card, while its description promises it asks before every edit and command. It now opens the card like any other command, and a code-mode program with no session permission gate refuses shell calls in Ask because it cannot ask. Sub-agents still run their bounded read-only commands without a card, so read-only scouts keep working when no one can answer. Accept Edits, Auto-Review, Full Access and Plan are unchanged.
 - **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. A turn now waits at most one second for it, never past Stop, reuses a read of the same account for 30 seconds, and otherwise uses the last read for that account or the local constitution while a slower read finishes in the background (5 second limit).
 - **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. Each turn still reads the account profile, but waits at most one second for it and never past Stop; a slower read (5 second limit) finishes in the background and the next turn uses it. Until then the turn uses the last profile loaded for that account, or the local constitution with a one-time notice that account preferences are still loading. A signed-out local constitution is read fresh every turn. Why the account service is slow for the Engine in production is still being investigated.
+
+- **Plugin, project and global commands such as `/ship` now run in the Desktop:** a turn sent over the Runtime API as `/name args` is expanded with the same command registry and template the terminal uses, so the model gets the command's instructions instead of the bare text. The command's tool list can only narrow the turn's tools, a plugin command whose plugin is no longer trusted is refused, the turn's response names the command that ran, and the command catalog marks these commands `runtime_expands` so clients stop showing them as terminal only.
+
 ### Removed
 
 - **The shared pet companion (`codewhale pet serve`)** and, in the terminal, sound, replay export, the browser appearance studio, source selection, the pixel, particle, cove, braille and whale-girl views, view cycling and avatar packs; `/pet inspect|status|appearance|style|source|export|sound|avatar|action|view` and the F6 and F8 keys. F5 still opens replies and agents. Files left in `~/.codewhale/pet-shared` are neither read nor deleted. Plugins can still register avatar packs; the terminal no longer draws them.
```

**File**: `crates/app-server/src/runtime_api.rs` (modified, +97/-2)
```diff
@@ -2086,6 +2086,45 @@ struct StartTurnResponse {
     /// byte-identical — a client that never sends a key sees no change.
     #[serde(skip_serializing_if = "replay_flag_is_absent")]
     idempotent_replay: bool,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    user_command: Option<UserCommandRun>,
+}
+
+#[derive(Debug, Serialize)]
+struct UserCommandRun {
+    name: String,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    plugin_id: Option<String>,
+}
+
+async fn expand_user_command(
+    state: &RuntimeApiState,
+    workspace: &std::path::Path,
+    prompt: &str,
+) -> Result<Option<codewhale_engine::command_catalog::ExpandedUserCommand>, ApiError> {
+    if !prompt.trim_start().starts_with('/') {
+        return Ok(None);
+    }
+    let Some(catalog) = codewhale_engine::command_catalog::installed()
+        .filter(|catalog| catalog.expands_user_commands())
+    else {
+        return Ok(None);
+    };
+    let discovery = Arc::clone(&state.plugin_discovery);
+    let workspace = workspace.to_path_buf();
+    let input = prompt.to_string();
+    #[cfg(any(test, feature = "test-support"))]
+    let env_ticket = codewhale_engine::test_support::env_scope_ticket();
+    tokio::task::spawn_blocking(move || {
+        #[cfg(any(test, feature = "test-support"))]
+        let _membership = codewhale_engine::test_support::join_env_scope(env_ticket);
+        let plugins = discovery.registry_for_workspace(&workspace);
+        catalog.expand_user_command(&workspace, &plugins, &input)
+    })
+    .await
+    .map_err(|error| ApiError::internal(error.to_string()))?
+    .transpose()
+    .map_err(|reason| ApiError::unprocessable(reason).with_code("user_command_denied"))
 }
 
 fn replay_flag_is_absent(replayed: &bool) -> bool {
@@ -6142,7 +6181,9 @@ struct CommandCatalogEntry {
     /// `builtin` and `extension` are registered code; `user` expands a stored template.
     kind: &'static str,
     /// `host` runs locally, `extension` invokes the Runtime command endpoint,
-    /// and `prompt` expands into the request the model sees.
+    /// and `prompt` is a template that expands into the request the model
+    /// sees: in the terminal always, and through the Runtime turn endpoint
+    /// when `runtime_expands` is set.
     binding: &'static str,
     /// `primary` | `advanced` | `compatibility` — builtins only; `hidden`
     /// covers rows the product does not advertise anywhere.
@@ -6161,6 +6202,8 @@ struct CommandCatalogEntry {
     plugin_id: Option<String>,
     #[serde(skip_serializing_if = "std::ops::Not::not")]
     workspace_sourced: bool,
+    #[serde(skip_serializing_if = "std::ops::Not::not")]
+    runtime_expands: bool,
     #[serde(skip_serializing_if = "Option::is_none")]
     registration_id: Option<String>,
 }
@@ -6173,6 +6216,7 @@ struct CommandsResponse {
 fn command_catalog(
     builtins: &[codewhale_engine::command_catalog::BuiltinCommand],
     users: &[codewhale_engine::command_catalog::UserCommand],
+    runtime_expands: bool,
 ) -> Vec<CommandCatalogEntry> {
     let mut commands = Vec::new();
     for info in builtins {
@@ -6222,6 +6266,7 @@ fn command_catalog(
             origin: None,
             plugin_id: None,
             workspace_sourced: false,
+            runtime_expands: false,
             registration_id: None,
         });
     }
@@ -6247,6 +6292,7 @@ fn command_catalog(
             origin: None,
             plugin_id: command.plugin_id.clone(),
             workspace_sourced: command.workspace_sourced,
+            runtime_expands,
             registration_id: None,
         });
     }
@@ -6291,6 +6337,7 @@ async fn list_commands(
         let mut commands = command_catalog(
             &catalog.builtins(),
             &catalog.user_commands_with_plugins(&workspace, &plugins),
+            catalog.expands_user_commands(),
         );
         let mut counts = std::collections::HashMap::new();
         for entry in &extensions {
@@ -6335,6 +6382,7 @@ async fn list_commands(
                 origin: Some(reference.origin.clone()),
                 plugin_id: Some(reference.plugin_id.clone()),
                 workspace_sourced: false,
+                runtime_expands: false,
                 registration_id: query
                     .thread_id
                     .as_deref()
@@ -10949,6 +10997,7 @@ async fn start_thread_watch_turn(
             thread,
             turn,
             idempotent_replay: replayed,
+            user_command: None,
         }),
     ))
 }
@@ -11041,6 +11090,35 @@ async fn start_thread_turn_for_caller(
     if scope.is_some() {
         sanitize_remote_turn_request(&mut req)?;
     }
+    let target = state
+        .runtime_threads
+        .get_thread(&id)
+        .await
+        .map_err(map_thread_err)?;
+    let expanded = expand_user_command(&state, &target.workspace, &req.prompt).await?;
+    let user_command = expanded.map(|expanded| {
+        if req.input_summary.is_none() {
+            req.input_s
```

**File**: `crates/app-server/src/runtime_api/review.rs` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ pub(super) async fn start_thread_review(
             thread,
             turn,
             idempotent_replay: replayed,
+            user_command: None,
         }),
     ))
 }
```

**File**: `crates/app-server/src/runtime_api/tests/command_catalog.rs` (modified, +120/-1)
```diff
@@ -67,7 +67,7 @@ fn command_catalog_marks_user_shadowing_of_builtin_names_and_aliases() {
         builtin("subagents", vec!["agents".to_string()]),
     ];
     let users = [user("model"), user("agents")];
-    let commands = command_catalog(&builtins, &users);
+    let commands = command_catalog(&builtins, &users, false);
 
     let model = entry(&commands, "model");
     assert_eq!(model.shadowed_by.as_deref(), Some("model"));
@@ -976,3 +976,122 @@ async fn post_thread_builtin_command_serves_only_the_host_allowlist() -> Result<
     handle.abort();
     Ok(())
 }
+
+struct ShipCatalog;
+impl CommandCatalog for ShipCatalog {
+    fn answers_to(&self, _name: &str) -> bool {
+        false
+    }
+    fn builtins(&self) -> Vec<BuiltinCommand> {
+        Vec::new()
+    }
+    fn user_commands(&self, _workspace: &Path) -> Vec<UserCommand> {
+        let mut ship = user("ship");
+        ship.builtin_bindings.clear();
+        ship.plugin_id = Some("user/fixture/release-kit".into());
+        vec![ship]
+    }
+    fn expands_user_commands(&self) -> bool {
+        true
+    }
+    fn expand_user_command(
+        &self,
+        _workspace: &Path,
+        _plugins: &codewhale_plugins::PluginRegistry,
+        input: &str,
+    ) -> Option<Result<codewhale_engine::command_catalog::ExpandedUserCommand, String>> {
+        (input.split_whitespace().next() == Some("/ship")).then(|| {
+            Ok(codewhale_engine::command_catalog::ExpandedUserCommand {
+                name: "ship".into(),
+                message: "Reply with the single word shipped. Do not use tools.".into(),
+                allowed_tools: Some(vec!["read_file".into()]),
+                plugin_id: Some("user/fixture/release-kit".into()),
+            })
+        })
+    }
+}
+
+#[tokio::test]
+async fn a_runtime_turn_sends_a_prompt_bound_user_command_as_its_expanded_template() -> Result<()> {
+    let _env = lock_test_env();
+    let temp = tempfile::tempdir()?;
+    let workspace = temp.path().join("workspace");
+    fs::create_dir_all(&workspace)?;
+    let _catalog = codewhale_engine::command_catalog::CatalogGuard::install(Arc::new(ShipCatalog));
+    let config = Config::default().with_legacy_root(
+        Some("ship-fixture-key".into()),
+        Some("http://127.0.0.1:1/v1".into()),
+    );
+    let Some((addr, runtime_threads, handle)) =
+        spawn_test_server_with_root_token_mobile_workspace_and_overrides(
+            temp.path().join("runtime"),
+            temp.path().join("sessions"),
+            None,
+            false,
+            workspace,
+            TestServerOverrides {
+                config: Some(config),
+                ..TestServerOverrides::default()
+            },
+        )
+        .await?
+    else {
+        return Ok(());
+    };
+    let client = codewhale_release::tls::reqwest_client();
+    let model = Arc::new(codewhale_engine::llm_client::mock::MockLlmClient::new(
+        vec![codewhale_engine::llm_client::mock::canned::simple_text_turn("shipped")],
+    ));
+    runtime_threads.set_test_model_client(model.clone());
+    let thread = runtime_threads
+        .create_thread(CreateThreadRequest {
+            model: Some("deepseek-v4-pro".into()),
+            ..Default::default()
+        })
+        .await?;
+
+    let catalog: Value = client
+        .get(format!("http://{addr}/v1/commands?thread_id={}", thread.id))
+        .send()
+        .await?
+        .error_for_status()?
+        .json()
+        .await?;
+    let ship = catalog["commands"]
+        .as_array()
+        .and_then(|rows| rows.iter().find(|row| row["name"] == "ship"))
+        .context("ship row")?;
+    assert_eq!(ship["binding"], "prompt");
+    assert_eq!(ship["runtime_expands"], true);
+
+    let started: Value = client
+        .post(format!("http://{addr}/v1/threads/{}/turns", thread.id))
+        .json(&json!({ "prompt": "/ship" }))
+        .send()
+        .await?
+        .error_for_status()?
+        .json()
+        .await?;
+    assert_eq!(started["user_command"]["name"], "ship");
+    assert_eq!(
+        started["user_command"]["plugin_id"],
+        "user/fixture/release-kit"
+    );
+    assert_eq!(started["turn"]["input_summary"], "/ship");
+    let turn_id = started["turn"]["id"].as_str().context("turn id")?;
+    assert_eq!(
+        wait_for_terminal_turn_status(&client, addr, &thread.id, turn_id, Duration::from_secs(20))
+            .await?,
+        "completed"
+    );
+    let requests = model.captured_requests();
+    assert_eq!(requests.len(), 1);
+    let sent = format!("{:?}", requests[0]);
+    assert!(
+        sent.contains("Reply with the single word shipped. Do not use tools."),
+        "the model must receive the command template: {sent}"
+    );
+    assert!(!sent.contains("\"/ship\""), "{sent}");
+    handle.abort();
+    Ok(())
+}
```

**File**: `crates/engine/src/command_catalog.rs` (modified, +20/-0)
```diff
@@ -34,6 +34,14 @@ pub struct UserCommand {
     pub builtin_bindings: Vec<String>,
 }
 
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub struct ExpandedUserCommand {
+    pub name: String,
+    pub message: String,
+    pub allowed_tools: Option<Vec<String>>,
+    pub plugin_id: Option<String>,
+}
+
 /// The host’s read-only command metadata and collision checks, implemented
 /// by the commands side.
 pub trait CommandCatalog: Send + Sync {
@@ -50,6 +58,18 @@ pub trait CommandCatalog: Send + Sync {
     ) -> Vec<UserCommand> {
         self.user_commands(workspace)
     }
+    fn expands_user_commands(&self) -> bool {
+        false
+    }
+    fn expand_user_command(
+        &self,
+        workspace: &Path,
+        plugins: &codewhale_plugins::PluginRegistry,
+        input: &str,
+    ) -> Option<Result<ExpandedUserCommand, String>> {
+        let _ = (workspace, plugins, input);
+        None
+    }
     /// Whether this host executes `name` remotely at all. Checked before any
     /// thread state is assembled, so a name outside the remote surface is
     /// refused exactly like a name no host knows. `false` is the default: a
```

**File**: `crates/engine/src/runtime_threads/manager.rs` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ pub use permission_rules::{
 pub(super) const EVENT_CHANNEL_CAPACITY: usize = 1024;
 pub(super) const MAX_ACTIVE_THREADS_DEFAULT: usize = 8;
 pub(super) const MAX_PENDING_DYNAMIC_TOOL_CALLS: usize = 128;
-pub(super) const SUMMARY_LIMIT: usize = 280;
+pub const SUMMARY_LIMIT: usize = 280;
 pub(super) const STREAM_DELTA_BATCH_MAX_LATENCY: Duration = Duration::from_millis(32);
 pub(super) const STREAM_DELTA_BATCH_MAX_BYTES: usize = 16 * 1024;
 /// How long `steer_turn` observes the engine's verdict before answering with
```

**File**: `crates/runtime/src/config.rs` (modified, +1/-1)
```diff
@@ -3093,7 +3093,7 @@ pub fn approval_policy_baseline_from_permission_posture(
 impl Config {
     #[must_use]
     pub fn catalog_auto_refresh_enabled(&self) -> bool {
-        self.catalog.as_ref().map_or(true, |c| c.auto_refresh)
+        self.catalog.as_ref().is_none_or(|c| c.auto_refresh)
     }
     /// Whether Linux shell commands prefer bubblewrap confinement.
     ///
```

**File**: `crates/tui/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -69,6 +69,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Ask asks before every command, read-only ones included:** in Ask, a shell command the Engine classes as read-only (such as `ls` or `git status -s`) ran without a card, while its description promises it asks before every edit and command. It now opens the card like any other command, and a code-mode program with no session permission gate refuses shell calls in Ask because it cannot ask. Sub-agents still run their bounded read-only commands without a card, so read-only scouts keep working when no one can answer. Accept Edits, Auto-Review, Full Access and Plan are unchanged.
 - **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. A turn now waits at most one second for it, never past Stop, reuses a read of the same account for 30 seconds, and otherwise uses the last read for that account or the local constitution while a slower read finishes in the background (5 second limit).
 - **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. Each turn still reads the account profile, but waits at most one second for it and never past Stop; a slower read (5 second limit) finishes in the background and the next turn uses it. Until then the turn uses the last profile loaded for that account, or the local constitution with a one-time notice that account preferences are still loading. A signed-out local constitution is read fresh every turn. Why the account service is slow for the Engine in production is still being investigated.
+
+- **Plugin, project and global commands such as `/ship` now run in the Desktop:** a turn sent over the Runtime API as `/name args` is expanded with the same command registry and template the terminal uses, so the model gets the command's instructions instead of the bare text. The command's tool list can only narrow the turn's tools, a plugin command whose plugin is no longer trusted is refused, the turn's response names the command that ran, and the command catalog marks these commands `runtime_expands` so clients stop showing them as terminal only.
+
 ### Removed
 
 - **The shared pet companion (`codewhale pet serve`)** and, in the terminal, sound, replay export, the browser appearance studio, source selection, the pixel, particle, cove, braille and whale-girl views, view cycling and avatar packs; `/pet inspect|status|appearance|style|source|export|sound|avatar|action|view` and the F6 and F8 keys. F5 still opens replies and agents. Files left in `~/.codewhale/pet-shared` are neither read nor deleted. Plugins can still register avatar packs; the terminal no longer draws them.
```

---

### Incident Patch 2: `e8873a91` (2026-11-26)
**Commit Message**: fix(engine): read the account profile every turn without caching what it renders

Review of b5d4f4d7c3d found these problems:

- Blocking: a signed-out user's local constitution was cached for 30 s,
  so a local edit or a ratification arrived up to 30 s late. Now nothing
  rendered is cached. AccountConstitution keeps only the last account
  snapshot for the turn's admitted AccountEpoch. No account renders the
  local file at use time, every turn, as on main.
- Every turn starts a fresh /api/me read, or joins the one still in
  flight for that epoch. It waits at most 1 s and never past Stop. A
  read that is not ready finishes in the background, and the next turn
  uses it. Meanwhile a turn uses the last snapshot for that epoch. With
  none, it uses the local constitution and shows a new one-time notice
  (ProfileConstitutionLoadingLocal, in all 15 packs), so a signed-in
  person learns that the turn ran without account preferences. After a
  background read fails, turns stop waiting (zero wait) and use the
  existing failure notice and local fallback until a read succeeds.
- An unknown epoch (key None) keeps nothing: no snapshot, no failure,
  and its read is aborted rather than l

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - **Cheaper workflow progress, visible disk-sync failures, review diffs that stop when cancelled:** workflow progress and event lines no longer force a full disk flush each; the next run snapshot flushes them, a newly created journal still syncs its directory, and a recovery snapshot written after a crash-torn last line is no longer lost. Directory syncs after a new journal, approval log or state file now log a warning on real failures (for example EIO, ENOSPC, or a directory that cannot be opened) and stay silent only when the filesystem cannot sync directories. A cancelled or dropped review now stops its local `git` diff instead of letting it run to completion. Thanks [@NieZhuZhu](https://github.com/NieZhuZhu) for the durability and directory-sync groundwork in #7561. (Refs #7461, #6561)
 - **Ask asks before every command, read-only ones included:** in Ask, a shell command the Engine classes as read-only (such as `ls` or `git status -s`) ran without a card, while its description promises it asks before every edit and command. It now opens the card like any other command, and a code-mode program with no session permission gate refuses shell calls in Ask because it cannot ask. Sub-agents still run their bounded read-only commands without a card, so read-only scouts keep working when no one can answer. Accept Edits, Auto-Review, Full Access and Plan are unchanged.
 - **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. A turn now waits at most one second for it, never past Stop, reuses a read of the same account for 30 seconds, and otherwise uses the last read for that account or the local constitution while a slower read finishes in the background (5 second limit).
+- **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. Each turn still reads the account profile, but waits at most one second for it and never past Stop; a slower read (5 second limit) finishes in the background and the next turn uses it. Until then the turn uses the last profile loaded for that account, or the local constitution with a one-time notice that account preferences are still loading. A signed-out local constitution is read fresh every turn. Why the account service is slow for the Engine in production is still being investigated.
 ### Removed
 
 - **The shared pet companion (`codewhale pet serve`)** and, in the terminal, sound, replay export, the browser appearance studio, source selection, the pixel, particle, cove, braille and whale-girl views, view cycling and avatar packs; `/pet inspect|status|appearance|style|source|export|sound|avatar|action|view` and the F6 and F8 keys. F5 still opens replies and agents. Files left in `~/.codewhale/pet-shared` are neither read nor deleted. Plugins can still register avatar packs; the terminal no longer draws them.
```

**File**: `crates/engine/src/core/engine.rs` (modified, +52/-24)
```diff
@@ -1144,6 +1144,7 @@ pub struct Engine {
     /// The local-fallback notice for an unavailable account profile is shown
     /// once per engine; later turns only log it.
     profile_constitution_fallback_noticed: bool,
+    profile_constitution_pending_noticed: bool,
     account_constitution: crate::profile_constitution::AccountConstitution,
     turn_account_fence: Option<Arc<crate::profile_constitution::AccountFence>>,
     /// Model requests in a row that failed with the same upstream HTTP
@@ -2846,6 +2847,7 @@ impl Engine {
             creator_unavailable_noted: None,
             constitution_block: None,
             profile_constitution_fallback_noticed: false,
+            profile_constitution_pending_noticed: false,
             account_constitution: Default::default(),
             turn_account_fence: None,
             repeated_upstream_failure: None,
@@ -7323,38 +7325,60 @@ impl Engine {
             self.constitution_block.clone()
         } else {
             let host_supplied = profile_constitution.is_some();
-            if provenance.can_authorize_work() {
-                self.turn_account_fence = Some(Arc::new(
+            let fence = if provenance.can_authorize_work() {
+                Some(Arc::new(
                     crate::profile_constitution::AccountFence::capture(
                         self.api_config.account_profile.as_deref(),
                     )
                     .await,
-                ));
-            }
+                ))
+            } else {
+                None
+            };
             let captured = match profile_constitution {
-                Some(snapshot) => Some(
-                    snapshot
-                        .render()
-                        .map(Some)
-                        .map_err(|error| error.to_string()),
-                ),
-                None => {
-                    self.account_constitution
-                        .capture(
-                            self.api_config.account_profile.as_deref(),
-                            self.turn_account_fence.as_deref(),
-                            &self.cancel_token,
-                        )
-                        .await
-                }
+                Some(snapshot) => snapshot
+                    .render()
+                    .map(Some)
+                    .map_err(|error| error.to_string()),
+                None => match self
+                    .account_constitution
+                    .capture(
+                        self.api_config.account_profile.as_deref(),
+                        fence.as_deref(),
+                        &self.cancel_token,
+                    )
+                    .await
+                {
+                    crate::profile_constitution::AccountRead::Ready(result) => result,
+                    crate::profile_constitution::AccountRead::Pending {
+                        last: Some(block), ..
+                    } => Ok(Some(block)),
+                    crate::profile_constitution::AccountRead::Pending {
+                        last: None,
+                        signed_in,
+                    } => {
+                        if signed_in && !self.profile_constitution_pending_noticed {
+                            self.profile_constitution_pending_noticed = true;
+                            let _ = self
+                                .send_event(Event::status(
+                                    codewhale_localization::tr(
+                                        codewhale_localization::resolve_locale(&self.config.locale_tag),
+                                        codewhale_localization::MessageId::ProfileConstitutionLoadingLocal,
+                                    )
+                                    .to_string(),
+                                ))
+                                .await;
+                        }
+                        Ok(crate::prompts::load_user_constitution_block())
+                    }
+                },
             };
-            match captured {
-                Some(Ok(block)) => block,
-                None => crate::prompts::load_user_constitution_block(),
+            let block = match captured {
+                Ok(block) => block,
                 // Local use never depends on the Codewhale account: an expired
                 // sign-in or unreachable account service falls back to the
                 // signed-out local constitution, never another account's.
-                Some(Err(error)) if !host_supplied => {
+                Err(error) if !host_supplied => {
                     tracing::warn!(%error, "account profile constitution unavailable; using local constitution");
                     if !self.profile_constitution_fallback_noticed {
                         self.profile_constitution_fallback_noticed = true;
@@ -7370,7 +7394,7 @@ impl Engine {
                     }
                     crate::prompts::load_user_constitution_block()
                 }
-         
```

**File**: `crates/engine/src/core/engine/tests/profile_constitution.rs` (modified, +200/-0)
```diff
@@ -263,3 +263,203 @@ async fn host_supplied_invalid_profile_refuses_the_turn_without_a_local_fallback
             .any(|event| matches!(event, Event::Status { message } if *message == notice))
     );
 }
+
+fn account_me(notes: &str) -> serde_json::Value {
+    serde_json::json!({"user":{"id":"acct_fixture","settingsRevision":7,
+        "preferences":{"constitution":ProfileConstitution { notes: notes.into(), ..Default::default() }}}})
+}
+
+async fn slow_account_service(delay: Duration) -> wiremock::MockServer {
+    use wiremock::{
+        Mock, MockServer, ResponseTemplate,
+        matchers::{method, path},
+    };
+    let server = MockServer::start().await;
+    Mock::given(method("GET"))
+        .and(path("/api/me"))
+        .respond_with(
+            ResponseTemplate::new(200)
+                .set_body_json(account_me("Account profile preference."))
+                .set_delay(delay),
+        )
+        .mount(&server)
+        .await;
+    server
+}
+
+async fn account_requests(server: &wiremock::MockServer) -> usize {
+    server
+        .received_requests()
+        .await
+        .map_or(0, |requests| requests.len())
+}
+
+async fn prompt_turn(
+    engine: &mut Engine,
+    config: &Config,
+    mock: &crate::llm_client::mock::MockLlmClient,
+) -> String {
+    let Op::SendMessage(spec) = external_user_message_op("Say hello", AppMode::Agent, config)
+    else {
+        unreachable!()
+    };
+    let started = std::time::Instant::now();
+    let outcome = engine.handle_send_message(spec).await;
+    assert!(!matches!(outcome, SendMessageOutcome::NotStarted { .. }));
+    assert!(
+        started.elapsed() < Duration::from_secs(3),
+        "the turn waited {:?} on a 4 s account read",
+        started.elapsed()
+    );
+    serde_json::to_string(mock.captured_requests().last().unwrap()).unwrap()
+}
+
+#[tokio::test]
+async fn slow_account_service_does_not_delay_the_turn_and_its_read_is_used_next_turn() {
+    use crate::llm_client::mock::{MockLlmClient, canned};
+    let _home = crate::test_support::SealedHome::new();
+    save_local_constitution();
+    let server = slow_account_service(Duration::from_secs(4)).await;
+    let _account = crate::profile_constitution::serve_account_for_test(
+        crate::profile_constitution::fixture_account_store(&server.uri()),
+        server.uri(),
+        crate::profile_constitution::TURN_WAIT,
+    );
+    let workspace = tempfile::tempdir().unwrap();
+    let config = Config::default();
+    let mock = Arc::new(MockLlmClient::new(vec![
+        canned::simple_text_turn("Done"),
+        canned::simple_text_turn("Done again"),
+    ]));
+    let (mut engine, handle) = Engine::new_with_model_client(
+        deterministic_engine_config(workspace.path()),
+        &config,
+        mock.clone(),
+    );
+    let events = collect_events(handle);
+    let first = prompt_turn(&mut engine, &config, &mock).await;
+    assert!(first.contains("Local fallback preference."));
+    assert!(!first.contains("Account profile preference."));
+    let deadline = std::time::Instant::now() + Duration::from_secs(30);
+    while engine.account_constitution.read_in_flight() {
+        assert!(
+            std::time::Instant::now() < deadline,
+            "the account read never finished"
+        );
+        tokio::time::sleep(Duration::from_millis(20)).await;
+    }
+    let second = prompt_turn(&mut engine, &config, &mock).await;
+    assert!(
+        second.contains("Account profile preference."),
+        "the finished read reaches the next turn"
+    );
+    assert!(account_requests(&server).await >= 2);
+    let loading = codewhale_localization::tr(
+        codewhale_localization::resolve_locale(&engine.config.locale_tag),
+        codewhale_localization::MessageId::ProfileConstitutionLoadingLocal,
+    )
+    .to_string();
+    let unavailable = fallback_notice(&engine);
+    engine
+        .send_event(Event::status(END_OF_EVENTS))
+        .await
+        .unwrap();
+    let events = events.await.unwrap();
+    let count = |wanted: &str| {
+        events
+            .iter()
+            .filter(|event| matches!(event, Event::Status { message } if message == wanted))
+            .count()
+    };
+    assert_eq!(
+        count(&loading),
+        1,
+        "the person is told once that the account read is late"
+    );
+    assert_eq!(count(&unavailable), 0);
+    assert_eq!(
+        events
+            .iter()
+            .filter(|event| matches!(event, Event::TurnStarted { .. }))
+            .count(),
+        2
+    );
+}
+
+#[tokio::test]
+async fn stop_ends_a_slow_account_read_at_once_for_interactive_and_hosted_turns() {
+    use crate::llm_client::mock::{MockLlmClient, canned};
+    let _home = crate::test_support::SealedHome::new();
+    let server = slow_account_service(Duration::from_secs(30)).await;
+    let _account = crate::profile_constitution::serve_account_for_test(
+        crate::profile_constitution::fixture_account_store(&se
```

**File**: `crates/engine/src/profile_constitution.rs` (modified, +266/-171)
```diff
@@ -9,13 +9,13 @@
 use anyhow::{Context, Result, ensure};
 use codewhale_config::user_constitution::ProfileConstitutionSnapshot;
 use codewhale_secrets::account::{
-    AccountSessionState, AccountSessionStore, secure_account_session_secrets,
+    AccountSessionSnapshot, AccountSessionState, AccountSessionStore,
+    secure_account_session_secrets,
 };
 
 const DESKTOP_BROWSER_SERVER: &str = "codewhale-browser";
 const ACCOUNT_LOAD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);
-const TURN_WAIT: std::time::Duration = std::time::Duration::from_secs(1);
-const FRESH_FOR: std::time::Duration = std::time::Duration::from_secs(30);
+pub(crate) const TURN_WAIT: std::time::Duration = std::time::Duration::from_secs(1);
 
 #[derive(Clone, Debug, PartialEq, Eq)]
 pub struct AccountEpoch {
@@ -29,8 +29,13 @@ pub struct AccountEpoch {
 #[cfg(not(any(test, feature = "test-support")))]
 pub fn account_epoch(profile: Option<&str>) -> Result<AccountEpoch> {
     let api_base = runtime_account_api_base();
-    let snapshot = AccountSessionStore::new(secure_account_session_secrets()?, profile, &api_base)
-        .snapshot()?;
+    epoch_of(
+        &AccountSessionStore::new(secure_account_session_secrets()?, profile, &api_base)
+            .snapshot()?,
+    )
+}
+
+fn epoch_of(snapshot: &AccountSessionSnapshot) -> Result<AccountEpoch> {
     let info = snapshot.runtime_info_at(chrono::Utc::now())?;
     let state = match info.state {
         AccountSessionState::OfflineCached => AccountSessionState::Authenticated,
@@ -77,6 +82,13 @@ async fn read_account_epoch(profile: Option<String>) -> Option<AccountEpoch> {
     if let Some(seam) = TEST_ACCOUNT_EPOCH.with(|cell| cell.borrow().clone()) {
         return seam;
     }
+    #[cfg(any(test, feature = "test-support"))]
+    if let Some((store, ..)) = TEST_ACCOUNT_SOURCE.with(|cell| cell.borrow().clone()) {
+        return store
+            .snapshot()
+            .ok()
+            .and_then(|snapshot| epoch_of(&snapshot).ok());
+    }
     tokio::task::spawn_blocking(move || account_epoch(profile.as_deref()))
         .await
         .ok()?
@@ -116,9 +128,16 @@ pub async fn admit_desktop_browser_call(
 /// with their own provider key never requires a Codewhale sign-in. A
 /// host-supplied snapshot (Runtime API) still fails its turn closed.
 pub async fn load(profile: Option<&str>) -> Result<Option<ProfileConstitutionSnapshot>> {
+    load_for(profile, None).await
+}
+
+async fn load_for(
+    profile: Option<&str>,
+    expected: Option<&AccountEpoch>,
+) -> Result<Option<ProfileConstitutionSnapshot>> {
     let api_base = runtime_account_api_base();
     let store = AccountSessionStore::new(secure_account_session_secrets()?, profile, &api_base);
-    load_from(&store, &api_base).await
+    load_from(&store, &api_base, expected).await
 }
 
 /// Offline preview cannot promise a request hash before account admission.
@@ -173,8 +192,15 @@ pub fn normalize_runtime_account_api_base(value: &str) -> Option<String> {
 async fn load_from(
     store: &AccountSessionStore,
     api_base: &str,
+    expected: Option<&AccountEpoch>,
 ) -> Result<Option<ProfileConstitutionSnapshot>> {
     let captured = store.snapshot()?;
+    if let Some(expected) = expected {
+        ensure!(
+            epoch_of(&captured)? == *expected,
+            "The signed-in account changed while loading its constitution; retry"
+        );
+    }
     let Some(auth) = captured.load()? else {
         return Ok(None);
     };
@@ -240,12 +266,21 @@ pub fn snapshot_from_me(
     Ok(Some(snapshot))
 }
 
-pub type Captured = Result<Option<String>, String>;
+type Loaded = Result<Option<ProfileConstitutionSnapshot>, String>;
+
+pub enum AccountRead {
+    Ready(Result<Option<String>, String>),
+    Pending {
+        last: Option<String>,
+        signed_in: bool,
+    },
+}
 
 #[derive(Default)]
 pub struct AccountConstitution {
-    ready: Option<(Option<AccountEpoch>, std::time::Instant, Captured)>,
-    pending: Option<(Option<AccountEpoch>, tokio::task::JoinHandle<Captured>)>,
+    last: Option<(AccountEpoch, ProfileConstitutionSnapshot)>,
+    failure: Option<(AccountEpoch, String)>,
+    pending: Option<(AccountEpoch, tokio::task::JoinHandle<Loaded>)>,
 }
 
 impl AccountConstitution {
@@ -254,20 +289,34 @@ impl AccountConstitution {
         profile: Option<&str>,
         fence: Option<&AccountFence>,
         cancel: &tokio_util::sync::CancellationToken,
-    ) -> Option<Captured> {
+    ) -> AccountRead {
+        let key = fence.and_then(|fence| fence.admitted.clone());
+        let expected = key.clone();
         #[cfg(any(test, feature = "test-support"))]
         {
             if let Some(message) = TEST_ACCOUNT_LOAD_FAILURE.get() {
-                return Some(Err(message.to_owned()));
+                return AccountRead::Ready(Err(message.to_owned()));
+            }
+            if let Some((store, api_base, wait)) =
+                TEST_ACCOUNT_SOURCE.with(|cell| cell.b
```

**File**: `crates/localization/locales/ca.json` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
   "TerminalDockLive": "actiu",
   "ExtensionPromptUnavailable": "Les instruccions de les extensions no estan disponibles; consulta /plugin show.",
   "ProfileConstitutionUnavailableLocal": "No s'han pogut carregar les preferències del compte de Codewhale; aquest torn fa servir la configuració local. La clau del proveïdor continua funcionant; executa codewhale login per recuperar les preferències del compte.",
+  "ProfileConstitutionLoadingLocal": "Les preferències del compte de Codewhale encara s'estan carregant; aquest torn fa servir la configuració local. Els torns següents les faran servir quan s'hagin carregat.",
   "AccountPreferencesNotLoaded": "Compte no carregat. Executa {command}. La clau del proveïdor continua funcionant.",
   "ComposerOversizedSubmitHeld": "No s’ha enviat: el missatge supera els {limit} caràcters i no s’ha pogut desar en un fitxer de text enganxat ({error}). El text complet continua al camp d’entrada: escurça’l o habilita l’escriptura a .codewhale/pastes i torna a prémer Enter.",
   "ComposerOversizedSubmitHeldShort": "No s’ha enviat: supera els {limit} caràcters; no s’ha desat el fitxer d’enganxat.",
```

**File**: `crates/localization/locales/de.json` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
   "TerminalDockLive": "aktiv",
   "ExtensionPromptUnavailable": "Anweisungen von Erweiterungen sind nicht verfügbar; prüfe /plugin show.",
   "ProfileConstitutionUnavailableLocal": "Die Codewhale-Kontoeinstellungen konnten nicht geladen werden; dieser Durchlauf nutzt deine lokalen Einstellungen. Dein Anbieter-Schlüssel funktioniert weiter; führe codewhale login aus, um die Kontoeinstellungen wiederherzustellen.",
+  "ProfileConstitutionLoadingLocal": "Die Codewhale-Kontoeinstellungen werden noch geladen; dieser Durchlauf nutzt deine lokalen Einstellungen. Spätere Durchläufe verwenden sie, sobald sie geladen sind.",
   "AccountPreferencesNotLoaded": "Konto nicht geladen. Führe {command} aus. Dein Anbieter-Schlüssel funktioniert weiter.",
   "ComposerOversizedSubmitHeld": "Nicht gesendet: Diese Nachricht enthält mehr als {limit} Zeichen und konnte nicht als Einfügedatei gespeichert werden ({error}). Der vollständige Text steht noch im Eingabefeld: Kürze ihn oder mache .codewhale/pastes beschreibbar und drücke dann erneut Enter.",
   "ComposerOversizedSubmitHeldShort": "Nicht gesendet: über {limit} Zeichen; Einfügedatei nicht gespeichert.",
```

**File**: `crates/localization/locales/en.json` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
   "TerminalDockLive": "live",
   "ExtensionPromptUnavailable": "Extension instructions are unavailable; inspect /plugin show.",
   "ProfileConstitutionUnavailableLocal": "Codewhale account preferences could not be loaded, so this turn uses your local settings. Your provider key still works; run codewhale login to restore account preferences.",
+  "ProfileConstitutionLoadingLocal": "Codewhale account preferences are still loading, so this turn uses your local settings. Later turns use them once they load.",
   "AccountPreferencesNotLoaded": "Account not loaded. Run {command}. Your provider key still works.",
   "ComposerOversizedSubmitHeld": "Not sent: this message is over {limit} characters and could not be saved as a paste file ({error}). The full text is still in the composer: shorten it, or make .codewhale/pastes writable, then press Enter again.",
   "ComposerOversizedSubmitHeldShort": "Not sent: over {limit} characters; paste file not saved.",
```

**File**: `crates/localization/locales/es-419.json` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@
   "TerminalDockLive": "activo",
   "ExtensionPromptUnavailable": "Las instrucciones de las extensiones no están disponibles; revisa /plugin show.",
   "ProfileConstitutionUnavailableLocal": "No se pudieron cargar las preferencias de la cuenta de Codewhale; este turno usa tu configuración local. Tu clave del proveedor sigue funcionando; ejecuta codewhale login para restaurar las preferencias de la cuenta.",
+  "ProfileConstitutionLoadingLocal": "Las preferencias de la cuenta de Codewhale todavía se están cargando; este turno usa tu configuración local. Los turnos siguientes las usarán cuando terminen de cargarse.",
   "AccountPreferencesNotLoaded": "Cuenta no cargada. Ejecuta {command}. Tu clave del proveedor sigue funcionando.",
   "ComposerOversizedSubmitHeld": "No se envió: este mensaje supera los {limit} caracteres y no se pudo guardar en un archivo de texto pegado ({error}). El texto completo sigue en el campo de entrada: acórtalo o habilita la escritura en .codewhale/pastes y vuelve a presionar Enter.",
   "ComposerOversizedSubmitHeldShort": "No se envió: supera los {limit} caracteres; no se guardó el archivo pegado.",
```

---

### Incident Patch 3: `f48345d6` (2026-11-26)
**Commit Message**: fix(engine): keep the account profile read off the turn's critical path

Production walkthrough (member-walkthrough-20261125, prod-fixes-r2/copy):
in 23 of 25 turns turn.lifecycle in_progress arrived 10.01-10.04 s after
turn.started and Stop did nothing during that window. Every signed-in
interactive turn awaited profile_constitution::capture, a GET /api/me with
a 10 s reqwest timeout and no cancel token, before TurnStarted.

The read exists so a person's account constitution (preferences, with its
settings revision) enters the turn, never another account's, with the
signed-out local constitution as the fallback when the account service is
unavailable. That contract is kept:

- AccountConstitution (one per Engine) runs the read in a spawned task.
  A turn waits at most 1 s for it and stops waiting at once on Stop
  (biased select on the turn's cancel token), so interactive admission
  then returns NotStarted promptly and a host-managed turn proceeds to its
  ordered TurnStarted/Interrupted as before.
- Results, successes and failures alike, are keyed by the turn's admitted
  AccountEpoch (account, session, api base, signed-out revision) and are
  reused for 30 s. A read still in fl

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Cheaper workflow progress, visible disk-sync failures, review diffs that stop when cancelled:** workflow progress and event lines no longer force a full disk flush each; the next run snapshot flushes them, a newly created journal still syncs its directory, and a recovery snapshot written after a crash-torn last line is no longer lost. Directory syncs after a new journal, approval log or state file now log a warning on real failures (for example EIO, ENOSPC, or a directory that cannot be opened) and stay silent only when the filesystem cannot sync directories. A cancelled or dropped review now stops its local `git` diff instead of letting it run to completion. Thanks [@NieZhuZhu](https://github.com/NieZhuZhu) for the durability and directory-sync groundwork in #7561. (Refs #7461, #6561)
 - **Ask asks before every command, read-only ones included:** in Ask, a shell command the Engine classes as read-only (such as `ls` or `git status -s`) ran without a card, while its description promises it asks before every edit and command. It now opens the card like any other command, and a code-mode program with no session permission gate refuses shell calls in Ask because it cannot ask. Sub-agents still run their bounded read-only commands without a card, so read-only scouts keep working when no one can answer. Accept Edits, Auto-Review, Full Access and Plan are unchanged.
+- **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. A turn now waits at most one second for it, never past Stop, reuses a read of the same account for 30 seconds, and otherwise uses the last read for that account or the local constitution while a slower read finishes in the background (5 second limit).
 ### Removed
 
 - **The shared pet companion (`codewhale pet serve`)** and, in the terminal, sound, replay export, the browser appearance studio, source selection, the pixel, particle, cove, braille and whale-girl views, view cycling and avatar packs; `/pet inspect|status|appearance|style|source|export|sound|avatar|action|view` and the F6 and F8 keys. F5 still opens replies and agents. Files left in `~/.codewhale/pet-shared` are neither read nor deleted. Plugins can still register avatar packs; the terminal no longer draws them.
```

**File**: `crates/engine/src/core/engine.rs` (modified, +33/-10)
```diff
@@ -1144,6 +1144,7 @@ pub struct Engine {
     /// The local-fallback notice for an unavailable account profile is shown
     /// once per engine; later turns only log it.
     profile_constitution_fallback_noticed: bool,
+    account_constitution: crate::profile_constitution::AccountConstitution,
     turn_account_fence: Option<Arc<crate::profile_constitution::AccountFence>>,
     /// Model requests in a row that failed with the same upstream HTTP
     /// status on the same model (#6889). Cleared when a request opens its
@@ -2845,6 +2846,7 @@ impl Engine {
             creator_unavailable_noted: None,
             constitution_block: None,
             profile_constitution_fallback_noticed: false,
+            account_constitution: Default::default(),
             turn_account_fence: None,
             repeated_upstream_failure: None,
             api_provider,
@@ -7321,17 +7323,38 @@ impl Engine {
             self.constitution_block.clone()
         } else {
             let host_supplied = profile_constitution.is_some();
-            match crate::profile_constitution::capture(
-                self.api_config.account_profile.as_deref(),
-                profile_constitution,
-            )
-            .await
-            {
-                Ok(block) => block,
+            if provenance.can_authorize_work() {
+                self.turn_account_fence = Some(Arc::new(
+                    crate::profile_constitution::AccountFence::capture(
+                        self.api_config.account_profile.as_deref(),
+                    )
+                    .await,
+                ));
+            }
+            let captured = match profile_constitution {
+                Some(snapshot) => Some(
+                    snapshot
+                        .render()
+                        .map(Some)
+                        .map_err(|error| error.to_string()),
+                ),
+                None => {
+                    self.account_constitution
+                        .capture(
+                            self.api_config.account_profile.as_deref(),
+                            self.turn_account_fence.as_deref(),
+                            &self.cancel_token,
+                        )
+                        .await
+                }
+            };
+            match captured {
+                Some(Ok(block)) => block,
+                None => crate::prompts::load_user_constitution_block(),
                 // Local use never depends on the Codewhale account: an expired
                 // sign-in or unreachable account service falls back to the
                 // signed-out local constitution, never another account's.
-                Err(error) if !host_supplied => {
+                Some(Err(error)) if !host_supplied => {
                     tracing::warn!(%error, "account profile constitution unavailable; using local constitution");
                     if !self.profile_constitution_fallback_noticed {
                         self.profile_constitution_fallback_noticed = true;
@@ -7347,7 +7370,7 @@ impl Engine {
                     }
                     crate::prompts::load_user_constitution_block()
                 }
-                Err(error) => {
+                Some(Err(error)) => {
                     crate::cost_status::record_runtime_usage_batch(
                         initial_cost_scope,
                         initial_origin.as_ref(),
@@ -7368,7 +7391,7 @@ impl Engine {
                 }
             }
         };
-        if provenance.can_authorize_work() {
+        if provenance.can_authorize_work() && (is_review || self.rlm_host.is_some()) {
             self.turn_account_fence = Some(Arc::new(
                 crate::profile_constitution::AccountFence::capture(
                     self.api_config.account_profile.as_deref(),
```

**File**: `crates/engine/src/profile_constitution.rs` (modified, +206/-16)
```diff
@@ -13,6 +13,9 @@ use codewhale_secrets::account::{
 };
 
 const DESKTOP_BROWSER_SERVER: &str = "codewhale-browser";
+const ACCOUNT_LOAD_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);
+const TURN_WAIT: std::time::Duration = std::time::Duration::from_secs(1);
+const FRESH_FOR: std::time::Duration = std::time::Duration::from_secs(30);
 
 #[derive(Clone, Debug, PartialEq, Eq)]
 pub struct AccountEpoch {
@@ -184,7 +187,7 @@ async fn load_from(
         .context("Sign in again to load your profile constitution")?;
     let client = crate::platform_client_builder()
         .redirect(reqwest::redirect::Policy::none())
-        .timeout(std::time::Duration::from_secs(10))
+        .timeout(ACCOUNT_LOAD_TIMEOUT)
         .build()?;
     let response = client
         .get(format!("{api_base}/api/me"))
@@ -237,26 +240,106 @@ pub fn snapshot_from_me(
     Ok(Some(snapshot))
 }
 
-pub async fn capture(
-    profile: Option<&str>,
-    supplied: Option<ProfileConstitutionSnapshot>,
-) -> Result<Option<String>> {
-    if let Some(snapshot) = supplied {
-        return snapshot.render().map(Some);
+pub type Captured = Result<Option<String>, String>;
+
+#[derive(Default)]
+pub struct AccountConstitution {
+    ready: Option<(Option<AccountEpoch>, std::time::Instant, Captured)>,
+    pending: Option<(Option<AccountEpoch>, tokio::task::JoinHandle<Captured>)>,
+}
+
+impl AccountConstitution {
+    pub async fn capture(
+        &mut self,
+        profile: Option<&str>,
+        fence: Option<&AccountFence>,
+        cancel: &tokio_util::sync::CancellationToken,
+    ) -> Option<Captured> {
+        #[cfg(any(test, feature = "test-support"))]
+        {
+            if let Some(message) = TEST_ACCOUNT_LOAD_FAILURE.get() {
+                return Some(Err(message.to_owned()));
+            }
+            if !account_api_base_is_loopback() {
+                return Some(Ok(crate::prompts::load_user_constitution_block()));
+            }
+        }
+        let profile = profile.map(str::to_owned);
+        let key = fence.and_then(|fence| fence.admitted.clone());
+        self.capture_with(key, cancel, TURN_WAIT, async move {
+            rendered(load(profile.as_deref()).await)
+        })
+        .await
     }
-    #[cfg(any(test, feature = "test-support"))]
+
+    async fn capture_with<F>(
+        &mut self,
+        key: Option<AccountEpoch>,
+        cancel: &tokio_util::sync::CancellationToken,
+        wait: std::time::Duration,
+        read: F,
+    ) -> Option<Captured>
+    where
+        F: std::future::Future<Output = Captured> + Send + 'static,
     {
-        if let Some(message) = TEST_ACCOUNT_LOAD_FAILURE.get() {
-            anyhow::bail!(message);
+        if let Some((pending_key, mut handle)) = self.pending.take() {
+            if pending_key != key {
+                handle.abort();
+            } else if handle.is_finished() {
+                let captured = (&mut handle)
+                    .await
+                    .unwrap_or_else(|error| Err(error.to_string()));
+                self.ready = Some((pending_key, std::time::Instant::now(), captured));
+            } else {
+                self.pending = Some((pending_key, handle));
+                return self.cached(&key);
+            }
+        }
+        if let Some((ready_key, read_at, captured)) = &self.ready
+            && *ready_key == key
+            && read_at.elapsed() < FRESH_FOR
+        {
+            return Some(captured.clone());
+        }
+        let mut handle = tokio::spawn(read);
+        tokio::select! {
+            biased;
+            () = cancel.cancelled() => {}
+            joined = &mut handle => {
+                let captured = joined.unwrap_or_else(|error| Err(error.to_string()));
+                self.ready = Some((key, std::time::Instant::now(), captured.clone()));
+                return Some(captured);
+            }
+            () = tokio::time::sleep(wait) => {}
         }
-        if !account_api_base_is_loopback() {
-            return Ok(crate::prompts::load_user_constitution_block());
+        let cached = self.cached(&key);
+        self.pending = Some((key, handle));
+        cached
+    }
+
+    fn cached(&self, key: &Option<AccountEpoch>) -> Option<Captured> {
+        self.ready
+            .as_ref()
+            .filter(|(ready_key, ..)| ready_key == key)
+            .map(|(_, _, captured)| captured.clone())
+    }
+}
+
+impl Drop for AccountConstitution {
+    fn drop(&mut self) {
+        if let Some((_, handle)) = self.pending.take() {
+            handle.abort();
         }
     }
-    if let Some(snapshot) = load(profile).await? {
-        return snapshot.render().map(Some);
+}
+
+fn rendered(loaded: Result<Option<ProfileConstitutionSnapshot>>) -> Captured {
+    match loaded {
+        Ok(Some(snapshot)) => snapshot.render().map(Some),
+        Ok(None) => Ok(crate::prompts::load_user_constitution_block()),
+        Err(error) => Err(error),
     }
-    Ok(crate::prompt
```

**File**: `crates/tui/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - **Cheaper workflow progress, visible disk-sync failures, review diffs that stop when cancelled:** workflow progress and event lines no longer force a full disk flush each; the next run snapshot flushes them, a newly created journal still syncs its directory, and a recovery snapshot written after a crash-torn last line is no longer lost. Directory syncs after a new journal, approval log or state file now log a warning on real failures (for example EIO, ENOSPC, or a directory that cannot be opened) and stay silent only when the filesystem cannot sync directories. A cancelled or dropped review now stops its local `git` diff instead of letting it run to completion. Thanks [@NieZhuZhu](https://github.com/NieZhuZhu) for the durability and directory-sync groundwork in #7561. (Refs #7461, #6561)
 - **Ask asks before every command, read-only ones included:** in Ask, a shell command the Engine classes as read-only (such as `ls` or `git status -s`) ran without a card, while its description promises it asks before every edit and command. It now opens the card like any other command, and a code-mode program with no session permission gate refuses shell calls in Ask because it cannot ask. Sub-agents still run their bounded read-only commands without a card, so read-only scouts keep working when no one can answer. Accept Edits, Auto-Review, Full Access and Plan are unchanged.
+- **A slow Codewhale account service no longer holds up the start of a turn or Stop:** a signed-in turn waited up to 10 seconds for the account profile read before it started, and Stop did nothing until that read ended. A turn now waits at most one second for it, never past Stop, reuses a read of the same account for 30 seconds, and otherwise uses the last read for that account or the local constitution while a slower read finishes in the background (5 second limit).
 ### Removed
 
 - **The shared pet companion (`codewhale pet serve`)** and, in the terminal, sound, replay export, the browser appearance studio, source selection, the pixel, particle, cove, braille and whale-girl views, view cycling and avatar packs; `/pet inspect|status|appearance|style|source|export|sound|avatar|action|view` and the F6 and F8 keys. F5 still opens replies and agents. Files left in `~/.codewhale/pet-shared` are neither read nor deleted. Plugins can still register avatar packs; the terminal no longer draws them.
```

#### Recent Merged Pull Requests:
- **PR #7561** (2026-11-25): fix(util,engine): resolve remaining R5 durability, grep timeout cancel, and bounded review read defects (@NieZhuZhu)
- **PR #7560** (2026-11-25): chore(release): cut 0.10.5 (@Hmbown)
- **PR #7559** (closed): docs(changelog): consolidate and deduplicate the 0.10.5 Unreleased notes (@Hmbown)
- **PR #7558** (2026-11-24): feat(0.10.5): DSH 0.2.2 host services, per-plugin settings, telemetry honesty, and Wave 2 runtime (@Hmbown)
- **PR #7557** (2026-11-24): fix(tui): use the engine catalog effort parser and add the Ollama Cloud effort ladder (@Hmbown)
- **PR #7556** (2026-11-24): test(engine): match the strict [skills] contract in the creator-skills test (@Hmbown)

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

## X. engine): expand prompt-bound user commands on the Runtime turn path (CW-8421)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2d6e57d5`: engine): expand prompt-bound user commands on the Runtime turn path (CW-8421). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:

- **Plugin, project and global commands such as `/ship` now run in the Desktop:** a turn sent over the Runtime API as `/name args` is expanded with the same command registry and template the terminal uses, so the model gets the command's instructions instead of the bare text. The command's tool list can only narrow the turn's tools, a plugin command whose plugin is no longer trusted is refused, the turn's response names the command that ran, and the command catalog marks these commands `runtime_expands` so clients stop showing them as terminal only.

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2d6e57d5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
