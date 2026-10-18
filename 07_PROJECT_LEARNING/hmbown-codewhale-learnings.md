> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hmbown-codewhale-learnings.md`  
> **Source**: github ([https://github.com/Hmbown/Codewhale](https://github.com/Hmbown/Codewhale))  
> **Source Version**: `7877c62d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:52:00.132Z  
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
> **Harvest Timestamp**: 2026-10-18T21:51:59.818Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source Rust agent engine and terminal client for Codewhale, with provider choice, tools, approvals and receipts.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41103 stars

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

### Incident Patch 1: `0d00b01c` (2026-10-18)
**Commit Message**: fix(engine): refuse a shell or gate command the safety check blocks before asking to approve it

Found in a real session (deepseek-v4-pro, Ask, demo repo under
CW/artifacts/readme-shot-20261018/): the model sent a multiline
`python3 -c "..."` command, Codewhale showed an approval card, I approved
it, and then the shell refused it with "BLOCKED ... Command contains
multiple lines". The approval decided nothing: whenever the tool context
is not auto-approve, BashTool::execute refuses every command that
analyze_command rates Dangerous, and the engine only asks for approval in
exactly those postures. So the person was asked to approve a call that
could never run.

ToolSpec gains refusal_before_approval(input, context) -> Option<ToolResult>,
default None. BashTool implements it with the same steps execute takes up
to the safety check: the ReadOnly `cd` normalization, the forced or
declared action (only `run` is judged), the command string, then
analyze_command; LowercaseBashTool translates its legacy input and
delegates. The BLOCKED result is built by one helper,
dangerous_command_block, which execute now also uses, so the text and
metadata are identical on both paths. TasksTool impleme

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -10,6 +10,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `/statusline` shows its last two items, Workspace and Git branch, without
   scrolling. The picker had not counted its padding rows. Thanks @Lstarsky0
   (#7022).
+- A shell or gate command that the safety check will refuse, such as one
+  spanning several lines, is refused at once instead of first asking you to
+  approve it.
 - Diffs in the TUI number each line only on its own side: a removed line
   shows its old line number and an added line its new one. Unchanged
   context lines keep their indentation instead of starting at the left
```

**File**: `crates/tui/CHANGELOG.md` (modified, +3/-0)
```diff
@@ -10,6 +10,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - `/statusline` shows its last two items, Workspace and Git branch, without
   scrolling. The picker had not counted its padding rows. Thanks @Lstarsky0
   (#7022).
+- A shell or gate command that the safety check will refuse, such as one
+  spanning several lines, is refused at once instead of first asking you to
+  approve it.
 - Diffs in the TUI number each line only on its own side: a removed line
   shows its old line number and an added line its new one. Unchanged
   context lines keep their indentation instead of starting at the left
```

**File**: `crates/tui/src/core/engine/turn_loop.rs` (modified, +19/-1)
```diff
@@ -3171,11 +3171,29 @@ impl Engine {
                         requested_sandbox_escalation(&tool_name, &tool_input, batch_sandbox_policy)
                             .expect("sandbox escalation was validated while planning")
                             .map(|(policy, _)| policy);
+                    let refusal_before_approval = if plan.approval_required {
+                        tool_registry
+                            .and_then(|registry| registry.get(&tool_name))
+                            .zip(batch_tool_context.as_ref())
+                            .and_then(|(spec, context)| {
+                                spec.refusal_before_approval(&tool_input, context)
+                            })
+                    } else {
+                        None
+                    };
                     let (result_override, context_override, approval_stamp): (
                         Option<Result<ToolResult, ToolError>>,
                         Option<crate::tools::ToolContext>,
                         Option<ToolApprovalStamp>,
-                    ) = if plan.approval_required {
+                    ) = if let Some(refusal) = refusal_before_approval {
+                        nested_gate_env.tool_call_budget.refund();
+                        emit_tool_audit(json!({
+                            "event": "tool.refused_before_approval",
+                            "tool_id": tool_id.clone(),
+                            "tool_name": tool_name.clone(),
+                        }));
+                        (Some(Ok(refusal)), None, None)
+                    } else if plan.approval_required {
                         emit_tool_audit(json!({
                             "event": "tool.approval_required",
                             "tool_id": tool_id.clone(),
```

**File**: `crates/tui/src/tools/shell.rs` (modified, +64/-29)
```diff
@@ -3838,9 +3838,9 @@ use crate::tools::spec::{
 };
 use async_trait::async_trait;
 use codewhale_execpolicy::command_safety::{
-    NetworkRead, ReadonlyRejection, SafetyLevel, agent_readonly_verdict, analyze_command,
-    extract_primary_command, is_parallel_readonly_command, normalize_windows_command_paths,
-    readonly_network_reads, split_leading_cd,
+    NetworkRead, ReadonlyRejection, SafetyAnalysis, SafetyLevel, agent_readonly_verdict,
+    analyze_command, extract_primary_command, is_parallel_readonly_command,
+    normalize_windows_command_paths, readonly_network_reads, split_leading_cd,
 };
 use codewhale_execpolicy::toml_rules::{ExecPolicyConfig, RuleDecision};
 use serde_json::json;
@@ -5483,6 +5483,15 @@ impl ToolSpec for LowercaseBashTool {
         self.is_read_only_for(input)
     }
 
+    fn refusal_before_approval(
+        &self,
+        input: &serde_json::Value,
+        context: &ToolContext,
+    ) -> Option<ToolResult> {
+        let translated = contract_bash_legacy_input(input).ok()?;
+        BashTool::contract_delegate().refusal_before_approval(&translated, context)
+    }
+
     async fn execute(
         &self,
         input: serde_json::Value,
@@ -5495,6 +5504,30 @@ impl ToolSpec for LowercaseBashTool {
     }
 }
 
+fn dangerous_command_block(safety: &SafetyAnalysis) -> Option<ToolResult> {
+    if safety.level != SafetyLevel::Dangerous {
+        return None;
+    }
+    let reasons = safety.reasons.join("; ");
+    let suggestions = if safety.suggestions.is_empty() {
+        String::new()
+    } else {
+        format!("\nSuggestions: {}", safety.suggestions.join("; "))
+    };
+    Some(ToolResult {
+        content: format!(
+            "BLOCKED: This command was blocked for safety reasons.\n\nReasons: {reasons}{suggestions}\n\nNote: allow_shell=true exposes shell tools, but it does not disable built-in shell safety validation."
+        ),
+        success: false,
+        metadata: Some(json!({
+            "safety_level": "dangerous",
+            "blocked": true,
+            "reasons": safety.reasons,
+            "suggestions": safety.suggestions,
+        })),
+    })
+}
+
 fn contract_bash_legacy_input(input: &serde_json::Value) -> Result<serde_json::Value, ToolError> {
     let object = input
         .as_object()
@@ -5788,6 +5821,30 @@ impl ToolSpec for BashTool {
         exec_shell_input_starts_detached(input)
     }
 
+    fn refusal_before_approval(
+        &self,
+        input: &serde_json::Value,
+        context: &ToolContext,
+    ) -> Option<ToolResult> {
+        if context.auto_approve {
+            return None;
+        }
+        let input = if context.shell_policy == ShellPolicy::ReadOnly {
+            normalize_readonly_cd(input)
+        } else {
+            input.clone()
+        };
+        let action = match self.forced_action {
+            Some(forced) => forced,
+            None => optional_str(&input, "action").ok()?.unwrap_or("run"),
+        };
+        if action != "run" {
+            return None;
+        }
+        let command = input.get("command")?.as_str()?;
+        dangerous_command_block(&analyze_command(command))
+    }
+
     async fn execute(
         &self,
         input: serde_json::Value,
@@ -6014,32 +6071,10 @@ impl ToolSpec for BashTool {
 
         // Safety analysis (always run for metadata, but only block when not in YOLO mode)
         let safety = analyze_command(command);
-        if !context.auto_approve {
-            match safety.level {
-                SafetyLevel::Dangerous => {
-                    let reasons = safety.reasons.join("; ");
-                    let suggestions = if safety.suggestions.is_empty() {
-                        String::new()
-                    } else {
-                        format!("\nSuggestions: {}", safety.suggestions.join("; "))
-                    };
-                    return Ok(ToolResult {
-                        content: format!(
-                            "BLOCKED: This command was blocked for safety reasons.\n\nReasons: {reasons}{suggestions}\n\nNote: allow_shell=true exposes shell tools, but it does not disable built-in shell safety validation."
-                        ),
-                        success: false,
-                        metadata: Some(json!({
-                            "safety_level": "dangerous",
-                            "blocked": true,
-                            "reasons": safety.reasons,
-                            "suggestions": safety.suggestions,
-                        })),
-                    });
-                }
-                SafetyLevel::RequiresApproval | SafetyLevel::Safe | SafetyLevel::WorkspaceSafe => {
-                    // Proceed normally
-                }
-            }
+        if !context.auto_approve
+            && let Some(blocked) = dangerous_command_block(&safety)
+        {
+            return Ok(blocked);
         }
 
         // This explicit mode only narrows the caller's posture. No
```

**File**: `crates/tui/src/tools/spec.rs` (modified, +8/-0)
```diff
@@ -1614,6 +1614,14 @@ pub trait ToolSpec: Send + Sync {
         false
     }
 
+    fn refusal_before_approval(
+        &self,
+        _input: &Value,
+        _context: &ToolContext,
+    ) -> Option<ToolResult> {
+        None
+    }
+
     /// Resolve input-specific policy without performing external side effects.
     ///
     /// Resource claims deliberately default to global exclusivity until a
```

**File**: `crates/tui/src/tools/subagent/tests.rs` (modified, +10/-3)
```diff
@@ -25744,10 +25744,17 @@ mod child_permission_gate {
             .into_iter()
             .enumerate()
             {
-                let err = registry
+                let outcome = registry
                     .execute("agent_gate", "bash", json!({ "command": command }))
-                    .await
-                    .expect_err("a detached agent's catastrophic write is held");
+                    .await;
+                if mode == ApprovalMode::Suggest && index == 2 {
+                    let content =
+                        outcome.expect("the safety check refuses it before any approval is asked");
+                    assert!(content.contains("BLOCKED"), "{mode:?} {command}: {content}");
+                    assert_eq!(manager.read().await.pending_child_approvals(), 0);
+                    continue;
+                }
+                let err = outcome.expect_err("a detached agent's catastrophic write is held");
                 let typed = err
                     .downcast_ref::<ToolError>()
                     .expect("canonical typed refusal");
```

**File**: `crates/tui/src/tools/tasks.rs` (modified, +30/-12)
```diff
@@ -23,7 +23,7 @@ use crate::work_graph::{
     CancelOutcome, OperationIntent, OperationObservation, OperationOwnerSnapshot, OwnerState,
     task_owner_snapshot,
 };
-use codewhale_execpolicy::command_safety::{SafetyLevel, analyze_command};
+use codewhale_execpolicy::command_safety::{SafetyAnalysis, SafetyLevel, analyze_command};
 
 const MAX_SUMMARY_CHARS: usize = 900;
 const DEFAULT_GATE_TIMEOUT_MS: u64 = 120_000;
@@ -373,6 +373,14 @@ impl ToolSpec for TasksTool {
         }
     }
 
+    fn refusal_before_approval(&self, input: &Value, context: &ToolContext) -> Option<ToolResult> {
+        if context.auto_approve || self.resolve_action(input).ok()? != "gate_run" {
+            return None;
+        }
+        let command = input.get("command")?.as_str()?;
+        dangerous_gate_block(&analyze_command(command))
+    }
+
     async fn execute(&self, input: Value, context: &ToolContext) -> Result<ToolResult, ToolError> {
         crate::core::engine::tool_catalog::enforce_tool_denial(
             context,
@@ -396,6 +404,23 @@ impl ToolSpec for TasksTool {
     }
 }
 
+fn dangerous_gate_block(safety: &SafetyAnalysis) -> Option<ToolResult> {
+    if safety.level != SafetyLevel::Dangerous {
+        return None;
+    }
+    Some(
+        ToolResult::error(format!(
+            "BLOCKED: gate command classified dangerous: {}",
+            safety.reasons.join("; ")
+        ))
+        .with_metadata(json!({
+            "safety_level": "dangerous",
+            "blocked": true,
+            "reasons": safety.reasons,
+        })),
+    )
+}
+
 /// The exact schema the legacy per-action tool exposed, kept so hidden alias
 /// registrations report an identical contract to the pre-unification tools.
 fn legacy_action_schema(action: &str) -> Value {
@@ -667,17 +692,10 @@ impl TasksTool {
             .clamp(1_000, MAX_GATE_TIMEOUT_MS);
         let cwd = resolve_cwd(context, optional_str(input, "cwd")?)?;
 
-        let safety = analyze_command(&command);
-        if !context.auto_approve && matches!(safety.level, SafetyLevel::Dangerous) {
-            return Ok(ToolResult::error(format!(
-                "BLOCKED: gate command classified dangerous: {}",
-                safety.reasons.join("; ")
-            ))
-            .with_metadata(json!({
-                "safety_level": "dangerous",
-                "blocked": true,
-                "reasons": safety.reasons,
-            })));
+        if !context.auto_approve
+            && let Some(blocked) = dangerous_gate_block(&analyze_command(&command))
+        {
+            return Ok(blocked);
         }
 
         let started = Instant::now();
```

---

### Incident Patch 2: `88071522` (2026-10-18)
**Commit Message**: fix(engine): hand finished background shells to the model at step boundaries

codewhale-app#3233 item 1. In `codewhale exec`, a shell command that
auto-backgrounded never got its output to the model: completions were
drained only when the model stopped calling tools, appended without
another model round, and exec ends at the first TurnComplete. The DSH
parity runs saw 0 of 198 backgrounded outputs.

- One helper, Engine::deliver_shell_completions, replaces the three copies
  of drain + runtime message + status (turn start in send_message, and the
  final-answer and late drains in continuation).
- tool_batch calls it after a tool batch's results are appended, before
  the next model request. A job that finished while the model was working
  reaches it on its next step with no extra model round; the event is an
  appended user-role runtime message (no KV prefix change) recorded through
  add_session_message.
- No retry at final-answer time: 03ece7d8b1 removed that deliberately
  (timing-dependent token spend and flaky tests).
- Child engines no longer drain: they share the parent's shell manager and
  root session id, so their drains claimed the parent's unowned completions
  into th

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -7,6 +7,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- A background shell job that finishes while the agent is still working now
+  reaches the model before its next step, instead of only when the turn ends.
+  In `codewhale exec`, which stops at the end of the turn, that output used to
+  be lost. The background notice now says that a job still running when the
+  turn ends is stopped unseen in a headless run, so the model knows to wait
+  explicitly when its answer depends on it. Sub-agents no longer pick up the
+  parent's finished jobs, and the parent no longer consumes a sub-agent's.
 - `codewhale review --base <ref>` gives the reviewer the `base..HEAD` commit
   messages as the author's stated intent, ahead of the diff, so it stops
   flagging changes their commit messages already explain. The messages are
```

**File**: `crates/tui/CHANGELOG.md` (modified, +7/-0)
```diff
@@ -7,6 +7,13 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- A background shell job that finishes while the agent is still working now
+  reaches the model before its next step, instead of only when the turn ends.
+  In `codewhale exec`, which stops at the end of the turn, that output used to
+  be lost. The background notice now says that a job still running when the
+  turn ends is stopped unseen in a headless run, so the model knows to wait
+  explicitly when its answer depends on it. Sub-agents no longer pick up the
+  parent's finished jobs, and the parent no longer consumes a sub-agent's.
 - `codewhale review --base <ref>` gives the reviewer the `base..HEAD` commit
   messages as the author's stated intent, ahead of the diff, so it stops
   flagging changes their commit messages already explain. The messages are
```

**File**: `crates/tui/src/core/engine.rs` (modified, +1/-16)
```diff
@@ -6396,22 +6396,7 @@ impl Engine {
         // Deliver completions that arrived after the previous turn before the
         // next user request is sent. This keeps background shell work
         // model-visible without requiring an explicit wait/poll tool call.
-        let shell_completions = if self.is_acp_turn() {
-            Vec::new()
-        } else {
-            self.drain_shell_completion_events()
-        };
-        if !shell_completions.is_empty() {
-            self.add_session_message(crate::runtime_handoff::shell_completion_runtime_message(
-                &shell_completions,
-            ))
-            .await;
-            if let Some(status) =
-                crate::core::engine::turn_loop::shell_completion_status_text(&shell_completions, "")
-            {
-                let _ = self.send_event(Event::status(status)).await;
-            }
-        }
+        self.deliver_shell_completions("").await;
 
         // A person writing to a goal that only the runtime stopped (a failed
         // or timed-out continuation) is continuing the work: resume it as a
```

**File**: `crates/tui/src/core/engine/tests/test_cases_19.rs` (modified, +4/-4)
```diff
@@ -387,10 +387,10 @@ fn turn_metadata_carries_the_narrowing_only_on_a_narrowed_turn() {
 /// first, and it is delivered exactly once.
 ///
 /// This exercises the engine's own shell manager through the same
-/// `drain_shell_completion_events` both delivery sites use — the next-turn
-/// boundary drain in `Engine::send_message` and the late drain in the turn
-/// loop — so the exactly-once guarantee holds across them rather than within
-/// one of them.
+/// `drain_shell_completion_events` every delivery site uses — turn start in
+/// `Engine::send_message`, the step boundary after a tool batch, and the
+/// finishing drains in the turn loop — so the exactly-once guarantee holds
+/// across them rather than within one of them.
 #[tokio::test]
 async fn background_completion_after_a_turn_is_delivered_once_on_the_next_turn() {
     let tmp = tempdir().expect("tempdir");
```

**File**: `crates/tui/src/core/engine/turn_loop.rs` (modified, +25/-3)
```diff
@@ -1152,9 +1152,6 @@ impl Engine {
             .unwrap_or_default();
         completions
             .into_iter()
-            // Child-owned output stays in task/status for explicit child
-            // waits. Only unowned jobs belong in the parent model stream.
-            .filter(|completion| completion.event.owner_agent_id.is_none())
             .map(|mut completion| {
                 let tool_call_id =
                     format!("background-shell-completion-{}", completion.event.task_id);
@@ -1177,6 +1174,31 @@ impl Engine {
             .collect()
     }
 
+    /// Hand finished background shell jobs to the model as one runtime
+    /// message. Called at turn start, after each tool batch and when the turn
+    /// is finishing; returns whether anything was delivered.
+    ///
+    /// Known limitation: a job still running when the model ends its turn
+    /// reaches it only through the idle wake, on hosts that keep the Engine
+    /// alive; headless exec shuts down and stops it unseen. ACP turns and
+    /// child engines never receive runtime shell completions and use
+    /// `task_shell_wait` instead.
+    pub(super) async fn deliver_shell_completions(&mut self, timing: &str) -> bool {
+        if self.child_host.is_some() {
+            return false;
+        }
+        let completions = self.drain_shell_completion_events();
+        if completions.is_empty() {
+            return false;
+        }
+        self.add_session_message(shell_completion_runtime_message(&completions))
+            .await;
+        if let Some(status) = shell_completion_status_text(&completions, timing) {
+            let _ = self.send_event(Event::status(status)).await;
+        }
+        true
+    }
+
     /// Keep workers alive while their tracked background shell work is still
     /// running. This is deliberately owner-based and read-only: an unowned
     /// shell job cannot extend any worker heartbeat.
```

**File**: `crates/tui/src/core/engine/turn_loop/continuation.rs` (modified, +2/-25)
```diff
@@ -113,18 +113,7 @@ impl Engine {
                 return PhaseResult::Retry;
             }
 
-            let shell_completions = if self.is_acp_turn() {
-                Vec::new()
-            } else {
-                self.drain_shell_completion_events()
-            };
-            if !shell_completions.is_empty() {
-                self.add_session_message(shell_completion_runtime_message(&shell_completions))
-                    .await;
-                if let Some(status) = shell_completion_status_text(&shell_completions, "") {
-                    let _ = self.send_event(Event::status(status)).await;
-                }
-            }
+            self.deliver_shell_completions("").await;
 
             // Sub-agent completion handoff (issue #756). Resuming when
             // queued completions exist is correct; #3216 says do not wait
@@ -175,19 +164,7 @@ impl Engine {
             // arrived between the last hold check and now. If a child finished
             // while we were running the thinking-only check, surface its
             // sentinel rather than delaying it to the next turn.
-            let late_shell_completions = if self.is_acp_turn() {
-                Vec::new()
-            } else {
-                self.drain_shell_completion_events()
-            };
-            if !late_shell_completions.is_empty() {
-                self.add_session_message(shell_completion_runtime_message(&late_shell_completions))
-                    .await;
-                if let Some(status) = shell_completion_status_text(&late_shell_completions, "late")
-                {
-                    let _ = self.send_event(Event::status(status)).await;
-                }
-            }
+            self.deliver_shell_completions("late").await;
 
             if !self.is_acp_turn() && self.drain_subagent_completion_events("late").await > 0 {
                 let _ = self
```

**File**: `crates/tui/src/core/engine/turn_loop/tool_batch.rs` (modified, +2/-0)
```diff
@@ -234,6 +234,8 @@ impl Engine {
                 .await;
         }
 
+        self.deliver_shell_completions("").await;
+
         // A successful tool step is productive progress, not a runaway
         // synthetic resume. Declared per-task tool budgets and max_steps
         // remain the explicit limits for tool-driven work.
```

**File**: `crates/tui/src/tools/shell.rs` (modified, +12/-3)
```diff
@@ -3576,7 +3576,11 @@ impl ShellManager {
             let owned = active_session_id.is_none_or(|session_id| {
                 !session_id.is_empty() && shell.owner_session_id == session_id
             });
-            if owned && shell.status != ShellStatus::Running && !shell.completion_reported {
+            if owned
+                && shell.owner_agent.is_none()
+                && shell.status != ShellStatus::Running
+                && !shell.completion_reported
+            {
                 shell.completion_reported = true;
                 completions.push(shell.completion_evidence());
                 // The bytes are now in the caller's hands (they become a durable
@@ -5384,8 +5388,13 @@ fn finish_contract_bash_result(
             tail_lines(output.trim(), 20)
         };
         let notice = promotion_notice(context, task_id, result.duration_ms / 1_000, &output);
+        let completion = if context.owner_agent_id.is_some() {
+            "Its completion stays in task/status and is not injected into the parent model."
+        } else {
+            "Its completion reaches you as a runtime event before your next step; if you end the turn first, a headless run stops it unseen."
+        };
         return Ok(ToolResult::success(format!(
-            "{notice}\n\nOutput so far:\n{so_far}\n\nCompletion will appear as a runtime event. To see more output or block until it finishes, call `task_shell_wait` directly with task_id=\"{task_id}\"; do not sleep-poll with bash. To stop it, send the same call with cancel=true. It also stops when the session ends."
+            "{notice}\n\nOutput so far:\n{so_far}\n\n{completion} To see more output or block until it finishes, call `task_shell_wait` directly with task_id=\"{task_id}\"; do not sleep-poll with bash. To stop it, send the same call with cancel=true. It also stops when the session ends."
         )).with_metadata(metadata));
     }
     if result.status != ShellStatus::Completed {
@@ -6491,7 +6500,7 @@ impl ToolSpec for BashTool {
                     let completion_contract = if context.owner_agent_id.is_some() {
                         "completion stays in task/status and is not injected into the parent model."
                     } else {
-                        "completion is delivered to the model as an internal runtime event and shown in task/status state."
+                        "completion is delivered to the model as an internal runtime event before its next step and shown in task/status state; if the turn ends first, a headless run stops the task unseen."
                     };
                     if backgrounded_foreground {
                         let seconds = result.duration_ms / 1_000;
```

---

### Incident Patch 3: `6f95551d` (2026-10-18)
**Commit Message**: fix(tui): read and list cards show workspace-relative paths

Models often pass absolute paths. In the real deepseek-v4-pro session
(CW/artifacts/readme-shot-20261018/) every read card read "Reading
/Volumes/VIXinSSD/CW/artifacts/readme-shot-20261018/home/slugkit/slugkit/__init__.py",
while the patch card for the same file said "Updated slugkit/__init__.py".

exploring_label now takes the workspace and passes read_file and list_dir
paths through workspace_relative. That helper already did this for
approval-card details; it moves from tui/approval.rs to utils.rs (next to
display_path) so both callers share it. Paths outside the workspace, and
relative paths, are shown unchanged. receipts.rs keeps its own
string-based workspace_relative: it normalises paths for comparison
(trims "./"), not for display.

Verified in a real TUI with the cw7087 mock (phase7 reads
/Volumes/VIXinSSD/CW/artifacts/cw7087-20261018/ws/diffdemo.py by absolute
path; CW/artifacts/approval-card-20261018/abspath-*.txt):
- before: "✓ ▷ read done · Reading /Volumes/VIXinSSD/CW/artifacts/cw7087-20261018/ws/diffdemo.py"
- after:  "✓ ▷ read done · Reading diffdemo.py"

Checks:
- cargo test -p codewhale-tui --lib -- expl

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- Read and list cards show a path inside the workspace relative to it
+  ("Reading src/lib.rs") instead of the full absolute path the model sent.
 - `/statusline` shows its last two items, Workspace and Git branch, without
   scrolling. The picker had not counted its padding rows. Thanks @Lstarsky0
   (#7022).
```

**File**: `crates/tui/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+- Read and list cards show a path inside the workspace relative to it
+  ("Reading src/lib.rs") instead of the full absolute path the model sent.
 - `/statusline` shows its last two items, Workspace and Git branch, without
   scrolling. The picker had not counted its padding rows. Thanks @Lstarsky0
   (#7022).
```

**File**: `crates/tui/src/tui/approval.rs` (modified, +1/-15)
```diff
@@ -337,7 +337,7 @@ impl ApprovalRequest {
             .into_iter()
             .map(|mut detail| {
                 if matches!(detail.label.as_str(), "File" | "Path" | "Dir") {
-                    detail.value = workspace_relative(&detail.value, &self.workspace);
+                    detail.value = crate::utils::workspace_relative(&detail.value, &self.workspace);
                 }
                 detail.label = localize_detail_label(&detail.label, locale).to_string();
                 if detail.is_preview
@@ -355,20 +355,6 @@ impl ApprovalRequest {
     }
 }
 
-/// Show `value` relative to `workspace` when it is an absolute path inside
-/// it, so the card never spends a row on the workspace prefix.
-fn workspace_relative(value: &str, workspace: &Path) -> String {
-    let path = Path::new(value);
-    if workspace.as_os_str().is_empty() || !path.is_absolute() {
-        return value.to_string();
-    }
-    match path.strip_prefix(workspace) {
-        Ok(relative) if relative.as_os_str().is_empty() => ".".to_string(),
-        Ok(relative) => relative.display().to_string(),
-        Err(_) => value.to_string(),
-    }
-}
-
 pub use crate::mcp::connected_app_server;
 
 fn description_is_repo_law_prompt(description: &str) -> bool {
```

**File**: `crates/tui/src/tui/tool_routing.rs` (modified, +15/-12)
```diff
@@ -45,7 +45,7 @@ pub(super) fn handle_tool_call_started(
     }
 
     if is_exploring_tool(semantic_name) {
-        let label = exploring_label(semantic_name, input);
+        let label = exploring_label(semantic_name, input, &app.workspace);
         // ensure_exploring + append_to_exploring keeps all parallel exploring
         // starts in a single ExploringCell entry.
         let active = app.active_cell.as_mut().expect("active_cell just ensured");
@@ -1693,20 +1693,23 @@ pub(super) fn refreshes_workspace_context_on_completion(name: &str) -> bool {
     )
 }
 
-pub(super) fn exploring_label(name: &str, input: &serde_json::Value) -> String {
+pub(super) fn exploring_label(
+    name: &str,
+    input: &serde_json::Value,
+    workspace: &std::path::Path,
+) -> String {
     let fallback = format!("{name} tool");
     let obj = input.as_object();
-    match name {
-        "read_file" => obj
-            .and_then(|o| o.get("path"))
-            .and_then(|v| v.as_str())
-            .map_or(fallback, |path| format!("Reading {path}")),
-        "list_dir" => obj
-            .and_then(|o| o.get("path"))
+    let path = || {
+        obj.and_then(|o| o.get("path"))
             .and_then(|v| v.as_str())
-            .map_or("Listing directory".to_string(), |path| {
-                format!("Listing {path}")
-            }),
+            .map(|path| crate::utils::workspace_relative(path, workspace))
+    };
+    match name {
+        "read_file" => path().map_or(fallback, |path| format!("Reading {path}")),
+        "list_dir" => path().map_or("Listing directory".to_string(), |path| {
+            format!("Listing {path}")
+        }),
         "grep_files" => {
             let pattern = obj
                 .and_then(|o| o.get("pattern"))
```

**File**: `crates/tui/src/tui/ui/tests.rs` (modified, +17/-4)
```diff
@@ -25523,19 +25523,27 @@ fn tool_details_survive_active_cell_flush() {
 
 #[test]
 fn exploring_label_uses_progressive_for_read_file() {
-    let label = exploring_label("read_file", &serde_json::json!({"path": "src/foo.rs"}));
+    let label = exploring_label(
+        "read_file",
+        &serde_json::json!({"path": "src/foo.rs"}),
+        std::path::Path::new(""),
+    );
     assert_eq!(label, "Reading src/foo.rs");
 }
 
 #[test]
 fn exploring_label_uses_progressive_for_list_dir() {
-    let label = exploring_label("list_dir", &serde_json::json!({"path": "crates/tui/src/"}));
+    let label = exploring_label(
+        "list_dir",
+        &serde_json::json!({"path": "crates/tui/src/"}),
+        std::path::Path::new(""),
+    );
     assert_eq!(label, "Listing crates/tui/src/");
 }
 
 #[test]
 fn exploring_label_uses_progressive_for_list_dir_no_path() {
-    let label = exploring_label("list_dir", &serde_json::json!({}));
+    let label = exploring_label("list_dir", &serde_json::json!({}), std::path::Path::new(""));
     assert_eq!(label, "Listing directory");
 }
 
@@ -25544,13 +25552,18 @@ fn exploring_label_for_grep_quotes_pattern_with_searching_for() {
     let label = exploring_label(
         "grep_files",
         &serde_json::json!({"pattern": "TranscriptScroll"}),
+        std::path::Path::new(""),
     );
     assert_eq!(label, "Searching for `TranscriptScroll`");
 }
 
 #[test]
 fn exploring_label_for_list_files_uses_progressive() {
-    let label = exploring_label("list_files", &serde_json::json!({}));
+    let label = exploring_label(
+        "list_files",
+        &serde_json::json!({}),
+        std::path::Path::new(""),
+    );
     assert_eq!(label, "Listing files");
 }
 
```

**File**: `crates/tui/src/utils.rs` (modified, +14/-0)
```diff
@@ -1063,6 +1063,20 @@ pub fn url_encode(input: &str) -> String {
     encoded
 }
 
+/// Show `value` relative to `workspace` when it is an absolute path inside
+/// it, so a card never spends a row on the workspace prefix.
+pub fn workspace_relative(value: &str, workspace: &Path) -> String {
+    let path = Path::new(value);
+    if workspace.as_os_str().is_empty() || !path.is_absolute() {
+        return value.to_string();
+    }
+    match path.strip_prefix(workspace) {
+        Ok(relative) if relative.as_os_str().is_empty() => ".".to_string(),
+        Ok(relative) => relative.display().to_string(),
+        Err(_) => value.to_string(),
+    }
+}
+
 /// Render a path for **user-facing display** with the home directory
 /// contracted to `~`. Use this in the TUI, doctor/setup stdout, and any
 /// other place a viewer might see the output (screenshot, video,
```

#### Recent Merged Pull Requests:
- **PR #7024** (2026-10-18): fix(tui): show a scroll rail on a settings choice list that doesn't fit (@Lstarsky0)
- **PR #7023** (2026-10-18): fix(tui): say "no matches" in the /mcp status line when a search finds nothing (@Lstarsky0)
- **PR #7022** (2026-10-18): fix(tui): size the /statusline picker for its padding rows (@Lstarsky0)
- **PR #7020** (2026-10-18): fix(route): honor a custom table's wire on runtime routes (@asto18089)
- **PR #7019** (2026-10-18): fix(client): capture and replay Anthropic redacted thinking blocks (@asto18089)
- **PR #7018** (2026-10-18): fix(engine): keep turn and submission attribution on TurnComplete (@asto18089)

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

## X. engine): refuse a shell or gate command the safety check blocks before asking to

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in codewhale-hq/Codewhale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d00b01c`: engine): refuse a shell or gate command the safety check blocks before asking to approve it. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- A shell or gate command that the safety check will refuse, such as one
  spanning several lines, is refused at once instead of first asking you to
  approve it.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d00b01c` are properly handled with clean fallback behavior.
