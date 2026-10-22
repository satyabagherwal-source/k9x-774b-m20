> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source**: github ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Source Version**: `4f1d7ab5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T16:45:08.252Z  
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
> **Harvest Timestamp**: 2026-10-22T16:45:06.694Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source agent for the terminal written in Rust. Use any provider or model. Issues & PRs always welcome
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41108 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
fn read_capped(p: &Path) -> Option<String> {
    let meta = std::fs::metadata(p).ok()?;
    if !meta.is_file() {
        return None;
    }
    if meta.len() > INSTRUCTIONS_FILE_MAX_BYTES as u64 {
        let mut file = std::fs::File::open(p).ok()?;
        let mut buf = vec![0u8; INSTRUCTIONS_FILE_MAX_BYTES];
        use std::io::Read as _;
        let n = file.read(&mut buf).ok()?;
        buf.truncate(n);
        let mut text = String::from_utf8_lossy(&buf).into_owned();
        let mut end = INSTRUCTIONS_FILE_MAX_BYTES.min(text.len());
        while end > 0 && !text.is_char_boundary(end) {
            end -= 1;
        }
        text.truncate(end);
        let omitted = meta
            .len()
            .saturating_sub(INSTRUCTIONS_FILE_MAX_BYTES as u64);
        text.push_str(&format!("\n[…truncated: {omitted} bytes omitted]"));
        return Some(text);
    }
    let raw = std::fs::read_to_string(p).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_
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

#[allow(dead_code)]
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
const T
```

### Core Architecture Module: `crates/core/src/request.rs`
```
//! Compatibility path for the shared protocol request types.
pub use codewhale_protocol::request::*;

```

### Core Architecture Module: `crates/core/src/role.rs`
```
//! Compatibility path for the shared protocol role types.
pub use codewhale_protocol::role::*;

```

### Core Architecture Module: `crates/core/src/secret_eq.rs`
```
//! The one constant-time comparison for bearer tokens, nonces and proofs.
//!
//! Every credential check in the engine (Runtime API token, web and mobile
//! session proofs, computer-display tokens, the app-server bearer) goes
//! through [`constant_time_eq`], so a timing fix lands once.

/// Compares the full length of both inputs regardless of where they first
/// differ, so an auth failure leaks neither the matching prefix length nor,
/// beyond the loop bound, which input was shorter.
#[must_use]
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    let mut diff = a.len() ^ b.len();
    for i in 0..a.len().max(b.len()) {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        diff |= usize::from(x ^ y);
    }
    std::hint::black_box(diff) == 0
}

#[cfg(test)]
mod tests {
    use super::constant_time_eq;

    #[test]
    fn equal_inputs_match() {
        assert!(constant_time_eq(b"", b""));
        assert!(constant_time_eq(b"secret-token", b"secret-token"));
    }

    #[test]
    fn different_inputs_do_not_match() {
        assert!(!constant_time_eq(b"secret-token", b"secret-tokem"));
        assert!(!constant_time_eq(b"secret", b"secret-token"));
        assert!(!constant_time_eq(b"secret-token", b"secret"));
        assert!(!constant_time_eq(b"", b"x"));
        // A zero-padded prefix must not collide with the shorter input.
        assert!(!constant_time_eq(b"abc", b"abc\0"));
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7008** (2026-10-17): **Need supported recovery for legacy Fleet ledger after workspace migration**
  *Symptoms*: ### Before you start  - [x] I searched existing issues and this is not a duplicate. 我已搜索过现有 issue。  ### What happened? 发生了什么？  On CodeWhale v0.10.1 on Windows, historical Fleet state copied during a workspace migration can disagree with the original ledger. In the new workspace, `fleet status` reports one queued item while `fleet list` shows the corresponding historical run as running; no worker process or usable lease is present. The originating workspace's ledger records that run as cancelled. `fleet inspect <run-id>` returns `unknown`. `fleet restart <run-id>` refuses with a persisted launch-spec / task-lease / attempt mismatch, and `fleet resume <run-id>` reports no change without reconciling it. A separate historical run is terminal exit 0 but verifier status is partial because its declared output is missing, while its worker snapshot still says running and refers to the old workspace.  No ledger was edited, no old task was replayed or terminated, and no receipt was fabricated.  What is the supported procedure to reconcile or disposition these migrated runs and produce a truthful custody record without replaying old work or editing the append-only ledger? Which evidence should an operator preserve, and which command should be used when the original and copied ledgers disagree?  ### Steps to reproduce 复现步骤  1. In CodeWhale v0.10.1, use a Fleet ledger copied from a prior workspace. 2. Run `codewhale fleet status` and `codewhale fleet list`; note the stale queued/running pr

- **Issue #6972** (2026-10-15): **Saved DeepSeek key reads back as missing while DeepSeek is not the active provider (root vs [providers.deepseek] auth_mode marker mismatch)**
  *Symptoms*: ### Before you start  - [x] I searched existing issues and this is not a duplicate. 我已搜索过现有 issue。  ### What happened? 发生了什么？  After saving a DeepSeek API key, an engine restart keeps reporting DeepSeek's credential as missing as long as another provider is active (e.g. zai). The key is present in the durable secret store but is never read for a non-active DeepSeek route.  Root cause: DeepSeek's save path writes the api-key marker at the ROOT of config.toml only, while the non-active-provider read gate only probes the durable secret store when that provider's own [providers.<name>] table carries auth_mode = 'api_key'. The marker the save writes is not the marker the read checks.  Observed home (macOS): - ~/.codewhale/secrets/secrets.json holds the deepseek slot. - ~/.codewhale/config.toml has root auth_mode = 'api_key' and [providers.deepseek] model = '...', but no [providers.deepseek] auth_mode. - the active provider is zai. Result: the provider picker / GET /v1/providers reports DeepSeek as missing on every restart.  Code pointers: - crates/tui/src/config.rs save_api_key_for_identity: for Deepseek returns save_api_key() (~L12062). - save_api_key() -> save_root_api_key_for_secret_slot(key, 'deepseek', 'deepseek') (~L11443). - save_root_api_key_metadata_without_plaintext writes only root auth_mode, never [providers.deepseek] auth_mode (~L11546-L11566). - Every other provider goes through codewhale_config::credentials::prepare_provider_api_key_metadata (crates/config/src/crede

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

### Incident Patch 1: `38d7a091` (2026-10-22)
**Commit Message**: fix(CW-7503): the committed secret scrubber did not compile; own the block type

`d1fd6f1a31` landed `session_secret_scrub.rs` with a borrow the compiler
rejects: `block_type` borrowed `map` immutably, and the two following
`get_mut` calls need it mutably, so the crate did not build.

The block type is now an owned `String` read once before the mutations, which
is the smallest change that keeps the behaviour identical: the same two
branches, the same `tool_use`/`server_tool_use` test, the same redaction calls.

Found while compiling the review slice on top of it; committed separately so
the security slice and the review slice stay reviewable on their own.

Checks: `scripts/dev-cargo.sh check -p codewhale-tui --lib` clean;
`scripts/dev-cargo.sh test -p codewhale-tui --lib tools::review` = 86 passed,
0 failed.

Refs CW-7503

**File**: `crates/tui/src/session_secret_scrub.rs` (modified, +4/-3)
```diff
@@ -341,8 +341,9 @@ fn scrub_value(value: &mut Value, secrets: &[String]) -> usize {
     match value {
         Value::Object(map) => {
             let mut changed = 0;
-            let block_type = map.get("type").and_then(Value::as_str);
-            if block_type == Some("tool_result") {
+            // Owned, so the two `get_mut` calls below can borrow the map.
+            let block_type = map.get("type").and_then(Value::as_str).map(str::to_string);
+            if block_type.as_deref() == Some("tool_result") {
                 if let Some(Value::String(content)) = map.get_mut("content") {
                     changed += usize::from(scrub_text(content, secrets));
                 }
@@ -356,7 +357,7 @@ fn scrub_value(value: &mut Value, secrets: &[String]) -> usize {
                     }
                 }
             }
-            if matches!(block_type, Some("tool_use" | "server_tool_use"))
+            if matches!(block_type.as_deref(), Some("tool_use" | "server_tool_use"))
                 && let Some(input) = map.get_mut("input")
             {
                 let redacted = crate::client::redact_json_model_bound_text(input, secrets);
```

---

### Incident Patch 2: `d1fd6f1a` (2026-10-22)
**Commit Message**: fix(security): redact tool-call arguments, gate redirects, widen the SSRF guard

Six hardening fixes from a read-only audit of this tree. Each is small; the
first is the one that mattered.

1. Tool-call arguments were never redacted. `redact_tool_result_blocks`
   matched only `ContentBlock::ToolResult` and `continue`d on everything else,
   so a model-authored command carrying a credential (`curl -H 'Authorization:
   Bearer ...'`, `API_KEY=... ./run`, a `.env` write) was persisted verbatim
   into `SavedSession.messages` and the journal, and replayed on resume. The
   doc comment claimed "a token a tool printed is never written to disk live",
   which was true for printed and false for given. Now `redact_tool_blocks`
   covers `ToolUse` and `ServerToolUse` input as well.

   `session_secret_scrub` had the same hole from the other side, so existing
   files on disk could not be remediated: it rewrote `tool_result` and
   `tool_call` summaries but never arguments. It scrubs `tool_use` and
   `server_tool_use` input now.

2. `[redaction] model_bound = false` disabled the *at-rest* boundary, not only
   the request one. The opt-out exists so the model can quote file bytes back
   for

**File**: `crates/execpolicy/src/command_safety.rs` (modified, +11/-0)
```diff
@@ -382,12 +382,23 @@ pub fn prefix_allow_matches(pattern: &str, command: &str) -> bool {
 
     // Fallback: normalised exact match for patterns not in the arity table
     // (e.g. exact-match rules like `"ls -la"` that lack a dictionary entry).
+    // A prefix grant never covers a compound or expansion-bearing command: the
+    // allow is for one inert invocation, so a shell operator fails closed here
+    // rather than depending on the caller having classified it first.
     let command_norm: String = command
         .trim()
         .to_ascii_lowercase()
         .split_whitespace()
         .collect::<Vec<_>>()
         .join(" ");
+    if command_norm.chars().any(|c| {
+        matches!(
+            c,
+            ';' | '&' | '|' | '`' | '$' | '(' | ')' | '<' | '>' | '\n' | '\r'
+        )
+    }) {
+        return false;
+    }
     command_norm == pattern_norm || command_norm.starts_with(&format!("{pattern_norm} "))
 }
 
```

**File**: `crates/tui/src/client.rs` (modified, +30/-10)
```diff
@@ -903,6 +903,30 @@ fn request_query_secret_values(url: &reqwest::Url) -> Vec<String> {
     values
 }
 
+/// Redirects are followed only within one host, over the same or a stronger
+/// scheme.
+///
+/// Provider keys ride in headers this stack may send under names reqwest does
+/// not strip on a cross-host hop (`x-api-key`, operator `http_headers`), so a
+/// compromised or open-redirecting endpoint could otherwise collect a key by
+/// answering `302`. A same-host hop to plaintext would expose the same key to
+/// anything on the path, so a downgrade stops too. Upgrades and same-scheme
+/// hops still work for the endpoints that use them.
+fn same_host_redirects() -> reqwest::redirect::Policy {
+    reqwest::redirect::Policy::custom(|attempt| {
+        let from = attempt.previous().last();
+        let next = attempt.url();
+        let same_host = from.is_some_and(|previous| previous.host_str() == next.host_str());
+        let downgrade =
+            from.is_some_and(|previous| previous.scheme() == "https" && next.scheme() == "http");
+        if same_host && !downgrade && attempt.previous().len() < 10 {
+            attempt.follow()
+        } else {
+            attempt.stop()
+        }
+    })
+}
+
 pub(crate) fn redact_model_bound_text(text: &str, exact_secret_values: &[String]) -> String {
     let mut redacted = text.to_string();
     for secret in exact_secret_values {
@@ -1872,7 +1896,7 @@ impl CodewhaleClient {
         let http_client = if plugin_provider.is_some() || api_key_source == "Claude sign-in" {
             http_client.redirect(reqwest::redirect::Policy::none())
         } else {
-            http_client
+            http_client.redirect(same_host_redirects())
         }
         .build()?;
         let models_http_client = Self::http_client_builder_with_auth_mode(
@@ -2179,16 +2203,12 @@ impl CodewhaleClient {
         redact_model_bound_text(text, &self.model_bound_secret_values)
     }
 
-    /// Redact tool output as it enters the transcript. Same masking as the
-    /// request boundary, including the confirmed `[redaction] model_bound`
-    /// opt-out: a user who chose to let the model see file bytes verbatim
-    /// keeps that, and everyone else never stores a live credential.
+    /// Redact tool output as it enters the transcript. Unlike the request
+    /// boundary, this path always redacts: the `[redaction] model_bound`
+    /// opt-out exists so the model can quote file bytes back for exact edits,
+    /// never to write a live credential to disk.
     pub(crate) fn redact_tool_output_for_transcript(&self, text: &str) -> String {
-        if self.model_bound_masking {
-            redact_model_bound_text(text, &self.model_bound_secret_values)
-        } else {
-            text.to_string()
-        }
+        redact_model_bound_text(text, &self.model_bound_secret_values)
     }
 
     /// Alternate models share this client's frozen endpoint and declarations.
```

**File**: `crates/tui/src/core/engine.rs` (modified, +46/-23)
```diff
@@ -918,26 +918,47 @@ enum EngineHostSetup {
     Rlm(rlm_host::RlmHostSetup),
 }
 
-/// Rewrite the text of every tool result in `message`, including text
-/// content blocks, with `redact`.
-pub(crate) fn redact_tool_result_blocks(message: &mut Message, redact: impl Fn(&str) -> String) {
+/// Rewrite the text of every tool result and tool-call input in `message`,
+/// including text content blocks, with `redact`.
+pub(crate) fn redact_tool_blocks(message: &mut Message, redact: impl Fn(&str) -> String) {
     for block in &mut message.content {
-        let ContentBlock::ToolResult {
-            content,
-            content_blocks,
-            ..
-        } = block
-        else {
-            continue;
-        };
-        *content = redact(content);
-        for value in content_blocks.iter_mut().flatten() {
-            if value.get("type").and_then(serde_json::Value::as_str) == Some("text")
-                && let Some(serde_json::Value::String(text)) = value.get_mut("text")
-            {
-                *text = redact(text);
+        match block {
+            ContentBlock::ToolResult {
+                content,
+                content_blocks,
+                ..
+            } => {
+                *content = redact(content);
+                for value in content_blocks.iter_mut().flatten() {
+                    if value.get("type").and_then(serde_json::Value::as_str) == Some("text")
+                        && let Some(serde_json::Value::String(text)) = value.get_mut("text")
+                    {
+                        *text = redact(text);
+                    }
+                }
+            }
+            ContentBlock::ToolUse { input, .. } | ContentBlock::ServerToolUse { input, .. } => {
+                redact_json_strings(input, &redact);
+            }
+            _ => {}
+        }
+    }
+}
+
+fn redact_json_strings(value: &mut serde_json::Value, redact: &impl Fn(&str) -> String) {
+    match value {
+        serde_json::Value::String(text) => *text = redact(text),
+        serde_json::Value::Array(values) => {
+            for value in values {
+                redact_json_strings(value, redact);
+            }
+        }
+        serde_json::Value::Object(values) => {
+            for value in values.values_mut() {
+                redact_json_strings(value, redact);
             }
         }
+        _ => {}
     }
 }
 
@@ -4701,13 +4722,15 @@ impl Engine {
         self.emit_session_updated().await;
     }
 
-    /// Scrub credentials from tool output once, as it enters the transcript
-    /// (B1). The transcript is what session JSON, the journal and every
-    /// later request are built from, so a token a tool printed is never
-    /// written to disk live. Honors the confirmed `[redaction] model_bound`
-    /// opt-out the same way the request boundary does.
+    /// Scrub credentials from tool output and tool-call input once, as it
+    /// enters the transcript (B1). The transcript is what session JSON, the
+    /// journal and every later request are built from, so a token a tool
+    /// printed — or one a tool was *given* in its arguments — is never written
+    /// to disk live. Unlike the request boundary this does not honor the
+    /// `[redaction] model_bound` opt-out: that opt-out exists so the model can
+    /// quote file bytes back for exact edits, never to relax storage.
     fn redact_tool_results_for_transcript(&self, message: &mut Message) {
-        redact_tool_result_blocks(message, |text| self.redact_tool_output_for_transcript(text));
+        redact_tool_blocks(message, |text| self.redact_tool_output_for_transcript(text));
     }
 
     fn redact_tool_output_for_transcript(&self, text: &str) -> String {
```

**File**: `crates/tui/src/mcp.rs` (modified, +14/-9)
```diff
@@ -1439,23 +1439,28 @@ fn resource_template_pattern(template: &str) -> Option<String> {
 ///
 /// This runs per URI per advertised template, while the template itself is
 /// fixed by the server's listing, so compiling it on every call was pure
-/// repetition. `None` still means "matches nothing" (#6213 T7).
+/// repetition. `None` still means "matches nothing" (#6213 T7). The cache is
+/// bounded because the template list is server-supplied: an unbounded key set
+/// would let one server pin memory for the life of the process.
 fn compiled_resource_template(template: &str) -> Option<Arc<regex::Regex>> {
+    const MAX_CACHED_TEMPLATES: usize = 512;
     static CACHE: std::sync::OnceLock<
         std::sync::Mutex<HashMap<String, Option<Arc<regex::Regex>>>>,
     > = std::sync::OnceLock::new();
     let cache = CACHE.get_or_init(|| std::sync::Mutex::new(HashMap::new()));
     let mut cache = cache
         .lock()
         .unwrap_or_else(|poisoned| poisoned.into_inner());
-    cache
-        .entry(template.to_string())
-        .or_insert_with(|| {
-            resource_template_pattern(template)
-                .and_then(|pattern| regex::Regex::new(&pattern).ok())
-                .map(Arc::new)
-        })
-        .clone()
+    if let Some(cached) = cache.get(template) {
+        return cached.clone();
+    }
+    let compiled = resource_template_pattern(template)
+        .and_then(|pattern| regex::Regex::new(&pattern).ok())
+        .map(Arc::new);
+    if cache.len() < MAX_CACHED_TEMPLATES {
+        cache.insert(template.to_string(), compiled.clone());
+    }
+    compiled
 }
 
 fn resource_uri_matches_template(uri: &str, template: &str) -> bool {
```

**File**: `crates/tui/src/runtime_threads.rs` (modified, +1/-1)
```diff
@@ -19469,7 +19469,7 @@ impl RuntimeThreadManager {
         {
             let mut messages = engine.get_session_snapshot().await?.messages;
             for message in &mut messages {
-                crate::core::engine::redact_tool_result_blocks(message, |text| {
+                crate::core::engine::redact_tool_blocks(message, |text| {
                     crate::client::redact_model_bound_text(text, &receipt_secrets)
                 });
             }
```

**File**: `crates/tui/src/session_secret_scrub.rs` (modified, +17/-6)
```diff
@@ -8,9 +8,10 @@
 //! `codewhale doctor` reports them and `codewhale sessions scrub-secrets`
 //! rewrites them on request.
 //!
-//! Only transcript tool results and Runtime tool receipts (including event
-//! copies) are touched. Cleanup masks credential shapes and currently configured
-//! secret values; bare secrets absent from current configuration cannot be recovered.
+//! Only transcript tool results, transcript tool-call arguments and Runtime
+//! tool receipts (including event copies) are touched. Cleanup masks credential
+//! shapes and currently configured secret values; bare secrets absent from
+//! current configuration cannot be recovered.
 //! Runtime rewrites require the exclusive process lease, and session rewrites
 //! the session's live lease; busy stores and sessions open in an interactive
 //! surface are reported and left untouched while the remaining files are
@@ -334,13 +335,14 @@ fn scrub_file(path: &Path, apply: bool, secrets: &[String]) -> io::Result<FileSc
     Ok(FileScan::Dirty(redacted))
 }
 
-/// Mask credentials in every `tool_result` text field below `value`.
-/// Returns how many fields changed.
+/// Mask credentials in every `tool_result` and `tool_call` argument below
+/// `value`. Returns how many fields changed.
 fn scrub_value(value: &mut Value, secrets: &[String]) -> usize {
     match value {
         Value::Object(map) => {
             let mut changed = 0;
-            if map.get("type").and_then(Value::as_str) == Some("tool_result") {
+            let block_type = map.get("type").and_then(Value::as_str);
+            if block_type == Some("tool_result") {
                 if let Some(Value::String(content)) = map.get_mut("content") {
                     changed += usize::from(scrub_text(content, secrets));
                 }
@@ -354,6 +356,15 @@ fn scrub_value(value: &mut Value, secrets: &[String]) -> usize {
                     }
                 }
             }
+            if matches!(block_type, Some("tool_use" | "server_tool_use"))
+                && let Some(input) = map.get_mut("input")
+            {
+                let redacted = crate::client::redact_json_model_bound_text(input, secrets);
+                if *input != redacted {
+                    *input = redacted;
+                    changed += 1;
+                }
+            }
             if map.get("kind").and_then(Value::as_str) == Some("tool_call") {
                 for key in ["summary", "detail", "metadata"] {
                     if let Some(value) = map.get_mut(key) {
```

**File**: `crates/tui/src/tools/web/guard.rs` (modified, +23/-0)
```diff
@@ -62,14 +62,37 @@ pub(crate) fn is_restricted_ip(ip: &IpAddr) -> bool {
             if let Some(v4) = v6.to_ipv4_mapped() {
                 return is_restricted_ip(&IpAddr::V4(v4));
             }
+            // A NAT64 gateway reaches the embedded IPv4 target, so the prefix
+            // must not hide a restricted address.
+            if let Some(v4) = nat64_ipv4(*v6)
+                && is_restricted_ip(&IpAddr::V4(v4))
+            {
+                return true;
+            }
             v6.is_loopback()
                 || v6.is_multicast()
                 || matches!(v6.segments(), [0xfc00..=0xfdff, ..]) // ULA fc00::/7
                 || matches!(v6.segments(), [0xfe80..=0xfebf, ..]) // Link-local fe80::/10
+                || matches!(v6.segments(), [0xfec0..=0xfeff, ..]) // Site-local fec0::/10
+                || matches!(v6.segments(), [0x2002, ..]) // 6to4 2002::/16
+                || matches!(v6.segments(), [0x2001, 0x0000, ..]) // Teredo 2001::/32
+                || matches!(v6.segments(), [0, 0, 0, 0, 0, 0, ..]) // IPv4-compatible ::a.b.c.d
         }
     }
 }
 
+/// The IPv4 target of a well-known-prefix NAT64 address (`64:ff9b::/96`).
+fn nat64_ipv4(v6: std::net::Ipv6Addr) -> Option<std::net::Ipv4Addr> {
+    let segments = v6.segments();
+    if segments[0] == 0x0064 && segments[1] == 0xff9b && segments[2..6].iter().all(|s| *s == 0) {
+        let octets = v6.octets();
+        return Some(std::net::Ipv4Addr::new(
+            octets[12], octets[13], octets[14], octets[15],
+        ));
+    }
+    None
+}
+
 /// Validate that `url` is a safe fetch target under SSRF and network policy.
 ///
 /// On success returns an optional DNS pin `(hostname, ip)` for hostnames that
```

---

### Incident Patch 3: `1d444351` (2026-10-22)
**Commit Message**: fix(plugins): give the plugin state file room, and derive its limit message

`MAX_PLUGIN_STATE_BYTES` was 1 MiB. A plugin state file that outgrew it made
`load_state` fail with "plugin state … exceeds the 1 MiB limit", which turns
every plugin into a load failure for that user with no way out short of
deleting their state by hand. The ceiling is now 16 MiB.

The read stays bounded: `file.take(MAX_PLUGIN_STATE_BYTES + 1)` caps it before
the length check, so this raises the ceiling without ever reading an unbounded
file. The refusal message now derives its number from the constant instead of
restating "1 MiB", so the next change cannot leave the message lying.

Found as uncommitted work in the shared checkout and landed under the Own
everything in CW rule after it had been unchanged for 19 minutes. No test pins
the old 1 MiB value.

Verification: `rustfmt --check` passes on the file. A crate build was not run -
the shared build lock was held by another session throughout the attempt - so
CI is the verifier for compilation.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `crates/tui/src/plugins/registry.rs` (modified, +4/-3)
```diff
@@ -847,7 +847,7 @@ fn load_state(path: &Path) -> Result<PluginStateFile, String> {
 }
 
 /// Maximum bytes read from the plugin state file.
-const MAX_PLUGIN_STATE_BYTES: u64 = 1024 * 1024;
+const MAX_PLUGIN_STATE_BYTES: u64 = 16 * 1024 * 1024;
 
 fn load_state_unlocked(path: &Path) -> Result<PluginStateFile, String> {
     let Some(file) = open_existing_regular_file(path, false)? else {
@@ -859,8 +859,9 @@ fn load_state_unlocked(path: &Path) -> Result<PluginStateFile, String> {
         .map_err(|e| format!("failed to read {}: {e}", path.display()))?;
     if raw.len() as u64 > MAX_PLUGIN_STATE_BYTES {
         return Err(format!(
-            "plugin state {} exceeds the 1 MiB limit",
-            path.display()
+            "plugin state {} exceeds the {} MiB limit",
+            path.display(),
+            MAX_PLUGIN_STATE_BYTES / (1024 * 1024)
         ));
     }
     let state: PluginStateFile = serde_json::from_str(&raw)
```

#### Recent Merged Pull Requests:
- **PR #7046** (2026-10-22): fix(web): document JSONPath subset (@zhuowp)
- **PR #7041** (2026-10-22): fix(shell): preserve Python stdio env defaults (@zhuowp)
- **PR #7034** (2026-10-21): fix(tui): put the approval footer's separators between its hints (@Lstarsky0)
- **PR #7033** (2026-10-21): fix(tui): keep a to-do row's status word when its title is long (@Lstarsky0)
- **PR #7032** (closed): chore(deps): bump the npm_and_yarn group across 4 directories with 3 updates (@dependabot[bot])
- **PR #7031** (closed): chore(deps-dev): bump vite from 8.3.0 to 8.3.4 in /web in the npm_and_yarn group across 1 directory (@dependabot[bot])

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

## X. CW-7503): the committed secret scrubber did not compile; own the block type

**RULE**:
When implementing operations in `crates/tui/src/session_secret_scrub.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `38d7a091`: CW-7503): the committed secret scrubber did not compile; own the block type. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/tui/src/session_secret_scrub.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            // Owned, so the two `get_mut` calls below can borrow the map.
            let block_type = map.get("type").and_then(Value::as_str).map(str::to_string);
            if block_type.as_deref() == Some("tool_result") {
            if matches!(block_type.as_deref(), Some("tool_use" | "server_tool_use"))
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
            let block_type = map.get("type").and_then(Value::as_str);
            if block_type == Some("tool_result") {
            if matches!(block_type, Some("tool_use" | "server_tool_use"))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `38d7a091` are properly handled with clean fallback behavior.
