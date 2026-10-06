# Forensic Learning Record (Deep Inspection): codewhale-hq/Codewhale

> **Canonical Artifact**: `07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:25.363Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codewhale-hq/Codewhale`
- **Description**: Open-source coding agent for your terminal, built in Rust and on a journey of continuous community improvement. Issues and PRs welcome.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 41055 stars

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
    Unset,
    /// Carried over from existing config without an explicit confirmation.
    Inherited,
    /// The user explicitly reviewed and confirmed t
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

use std::collections::HashMap;

use anyhow::Result;
use codewhale_config::{ConfigToml, ProviderKind};
use codewhale_hooks::HookDispatcher;
use codewhale_protocol::{AppResponse, EventFrame, ResponseChannel, Status};
use codewhale_state::{JobStateRecord, JobStateStatus, StateStore};
use serde_json::{Value, json};
use uuid::Uuid;

/// Status of a background job.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobStatus {
    /// Waiting to be picked up.
    Queued,
    /// Currently executing.
    Running,
    /// Temporarily paused.
    Paused,
    /// Finished successfully.
    Completed,
    /// Finished with an error.
    Failed,
    /// Cancelled by the user.
    Cancelled,
}

impl Status for JobStatus {
    fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Failed | Self::Cancelled)
    }
    fn is_active(&self) -> bool {
        matches!(self, Self::Queued | Self::Running)
    }
    fn is_paused(&self) -> bool {
        matches!(self, Self::Paused)
    }
}

const JOB_DETAIL_SCHEMA_VERSION: u8 = 1;
const DEFAULT_JOB_MAX_ATTEMPTS: u32 = 3;
const DEFAULT_JOB_BACKOFF_BASE_MS: u64 = 500;
const MAX_JOB_HISTORY_ENTRIES: usize = 64;

/// Retry state for a job that failed and may be retried.
#[derive(Debug, Clone)]
pub struct JobRetryMetadata {
    /// Current attempt number (0 = not yet retried).
    pub attempt: u32,
    /// Maximum number of retry attempts before giving up.
    pub max_attempts: u32,
    /// Base delay in milliseconds for exponential backoff.
    pub backoff_base_ms: u64,
    /// Computed delay in milliseconds until the next retry.
    pub next_backoff_ms: u64,
    /// Timestamp when the next retry should be attempted.
    pub next_retry_at: Option<i64>,
}

impl Default for JobRetryMetadata {
    fn default() -> Self {
        Self {
            attempt: 0,
            max_attempts: DEFAULT_JOB_MAX_ATTEMPTS,
            backoff_base_ms: DEFAULT_JOB_BACKOFF_BASE_MS,
            next_backoff_ms: 0,
            next_retry_at: None,
        }
    }
}

/// A single entry in a job's history log.
#[derive(Debug, Clone)]
pub struct JobHistoryEntry {
    /// Timestamp when this entry was recorded.
    pub at: i64,
    /// Phase name (e.g., "created", "running", "failed").
    pub phase: String,
    /// Job status at this point in time.
    pub status: JobStatus,
    /// Progress percentage at this point, if available.
    pub progress: Option<u8>,
    /// Human-readable detail message.
    pub detail: Option<String>,
    /// Retry state snapshot at this point.
    pub retry: JobRetryMetadata,
}

#[derive(Debug, Clone)]
struct PersistedJobDetail {
    pub status: JobStatus,
    pub detail: Option<String>,
    pub retry: JobRetryMetadata,
    pub history: Vec<JobHistoryEntry>,
}

/// A complete job record with all metadata and history.
#[derive(Debug, Clone)]
pub struct JobRecord {
    /// Unique job identifier.
    pub id: String,
    /// Human-readable job name.
    pub name: String,
    /// Current job status.
    pub status: JobStatus,
    /// Current progress percentage (0-100).
    pub progress: Option<u8>,
    /// Human-readable detail about the current state.
    pub detail: Option<String>,
    /// Retry state for failed jobs.
    pub retry: JobRetryMetadata,
    /// Chronological history of state transitions.
    pub history: Vec<JobHistoryEntry>,
    /// Timestamp when the job was created.
    pub created_at: i64,
    /// Timestamp of the last state change.
    pub updated_at: i64,
}

/// Map a durable [`JobRecord`] to the dependency-neutral run read model.
///
/// Pure projection of the record as persisted: unknown budgets stay unset and
/// nothing is fabricated. `updated_at` (epoch seconds) provides the terminal
/// timestamp because the job manager records no separate end time. The
/// free-form job detail is intentionally omitted because this owner does not
/// classify it as safe for a cross-surface read model.
#[must_use]
pub fn job_record_to_agent_run(
    record: &JobRecord,
) -> codewhale_protocol::agent_run::AgentRunSnapshot {
    use codewhale_protocol::agent_run::{
        AgentRunSnapshot, BudgetSummary, RunSource, RunState, TerminalOutcome, TerminalSummary,
    };

    let (state, terminal) = match record.status {
        JobStatus::Queued => (RunState::Queued, None),
        JobStatus::Running => (RunState::Running, None),
        JobStatus::Paused => (RunState::Paused, None),
        JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled => {
            let outcome = match record.status {
                JobStatus::Completed => TerminalOutcome::Completed,
                JobStatus::Failed => TerminalOutcome::Failed,
                _ => TerminalOutcome::Cancelled,
            };
            (
                RunState::Terminal,
                Some(TerminalSummary {
                    outcome,
                    ended_at_ms: record.updated_at.checked_mul(1000),
                    detail: None,
                }),
            )
        }
    };

    AgentRunSnapshot {
        run_id: record.id.clone(),
        parent: None,
        source: RunSource::CoreJob,
        state,
        budget: BudgetSummary::default(),
        terminal,
        refs: Vec::new(),
    }
}

/// Manages background jobs with retry logic and persistence.
#[derive(Debug, Default)]
pub struct JobManager {
    jobs: HashMap<String, JobRecord>,
}

impl JobManager {
    fn now_ts() -> i64 {
        chrono::Utc::now().timestamp()
    }

    fn deterministic_backoff_ms(retry: &JobRetryMetadata) -> u64 {
        if retry.attempt == 0 {
            return 0;
        }
        let exponent = retry.attempt.saturating_sub(1).min(20);
        let multiplier = 1u64.checked_shl(exponent).unwrap_or(u64::MAX);
        retry.backoff_base_ms.saturating_mul(multiplier)
    }

    fn clear_retry_schedule(retry: &mut JobRetryMetadata) {
        retry.next_backoff_ms = 0;
        retry.next_retry_at = None;
    }

    fn push_history(job: &mut JobRecord, phase: &str) {
        job.history.push(JobHistoryEntry {
            at: job.updated_at,
            phase: phase.to_string(),
            status: job.status,
            progress: job.progress,
            detail: job.detail.clone(),
            retry: job.retry.clone(),
        });
        if job.history.len() > MAX_JOB_HISTORY_ENTRIES {
            let to_drain = job.history.len() - MAX_JOB_HISTORY_ENTRIES;
            job.history.drain(0..to_drain);
        }
    }

    fn parse_persisted_detail(raw: Option<&str>) -> Option<PersistedJobDetail> {
        let raw = raw?;
        let parsed: Value = serde_json::from_str(raw).ok()?;
        let status = parsed
            .get("status")
            .and_then(Value::as_str)
            .and_then(job_status_from_str)?;
        let detail = parsed.get("detail").and_then(json_optional_string);
        let retry = parse_retry_metadata(parsed.get("retry"));
        let history = parsed
            .get("history")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(parse_history_entry)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        Some(PersistedJobDetail {
            status,
            detail,
            retry,
            history,
        })
    }

    fn encode_persisted_detail(job: &JobRecord) -> Result<Option<String>> {
        let encoded = json!({
            "schema_version": JOB_DETAIL_SCHEMA_VERSION,
            "status": job_status_to_str(job.status),
            "detail": job.detail.clone(),
            "retry": job_retry_to_value(&job.retry),
            "history": job.history.iter().map(job_history_to_value).collect::<Vec<_>>()
        })
        .to_string();
        Ok(Some(encoded))
    }

    /// Enqueues a new job and returns its record.
    pub fn enqueue(&mut self, name: impl Into<String>) -> JobRecord {
        let now = Self::now_ts();
        let id = format!("job-{}", Uuid::new_v4());
        let mut job = JobRecord {
            id: id.clone(),
            name: name.into(),
            status: JobStatus::Queued,
            progress: Some(0),
            detail: None,
            retry: JobRetryMetadata::default(),
            history: Vec::new(),
            created_at: now,
            updated_at: now,
        };
        Self::push_history(&mut job, "created");
        self.jobs.insert(id, job.clone());
        job
    }

    /// Transitions a job to running and clears its retry schedule.
    pub fn set_running(&mut self, id: &str) {
        if let Some(job) = self.jobs.get_mut(id) {
            job.status = JobStatus::Running;
            Self::clear_retry_schedule(&mut job.retry);
            job.updated_at = Self::now_ts();
            Self::push_history(job, "running");
        }
    }

    /// Updates a job's progress (clamped to 100) and optional detail message.
    pub fn update_progress(&mut self, id: &str, progress: u8, detail: Option<String>) {
        if let Some(job) = self.jobs.get_mut(id) {
            job.progress = Some(progress.min(100));
            job.detail = detail;
            job.updated_at = Self::now_ts();
            Self::push_history(job, "progress_updated");
        }
    }

    /// Marks a job as completed with 100% progress and clears its retry schedule.
    pub fn complete(&mut self, id: &str) {
        if let Some(job) = self.jobs.get_mut(id) {
            job.status = JobStatus::Completed;
            job.progress = Some(100);
            Self::clear_retry_schedule(&mut job.retry);
            job.updated_at = Self::now_ts();
            
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

### Core Architecture Module: `crates/core/src/session.rs`
```
//! `Thread` / `Session` split (issue #5261).
//!
//! `codewhale`'s `Session` was really a thread. The new split is:
//! - `Thread` — durable, persisted, owns the append-only `Journal` and the
//!   `leafId` cursor. One row in `state.threads`, one directory on disk.
//! - `Session` — ephemeral, per-turn / per-engine-lifetime, owns the
//!   in-memory `TurnContext` plus the live approval/sandbox posture for this
//!   `SessionId`. Many sessions can attach to one thread over time, but only
//!   one `Session` drives a turn for a given `ThreadId` at a time.
//!
//! The canonical RuntimeThreadManager creates sessions without a TUI and drives
//! the same Engine turn loop used by mounted clients. These types preserve the
//! shared model, append log, prefix stability and message revision state; the
//! compatibility Core Runtime owns only configuration, hooks and job bookkeeping.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::ids::{SessionId, ThreadId};
use crate::journal::Journal;

/// Durable thread (the former `Session`). One per conversation, persisted in
/// `state.threads`. The only new field vs the old `Session` is `leaf_id` — the
/// journal cursor — plus the typed `ThreadId`. All other fields keep their
/// persisted JSON shape unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub thread_id: ThreadId,
    /// Active branch tip. `None` before the first journal header.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leaf_id: Option<String>,
    /// Journal (append-only). In-memory projection of the persisted
    /// `threads/turns/items/events` layout is derived root→leaf.
    #[serde(default)]
    pub journal: Journal,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<String>,
    pub workspace: PathBuf,
    #[serde(default)]
    pub ephemeral: bool,
}

impl Thread {
    #[must_use]
    pub fn new(thread_id: ThreadId, workspace: PathBuf, model: impl Into<String>) -> Self {
        Self {
            thread_id,
            leaf_id: None,
            journal: Journal::new(),
            model: model.into(),
            reasoning_effort: None,
            workspace,
            ephemeral: false,
        }
    }

    #[must_use]
    pub fn leaf_id(&self) -> Option<&str> {
        self.leaf_id.as_deref()
    }

    pub fn set_leaf(&mut self, leaf: Option<String>) {
        self.leaf_id = leaf;
    }
}

/// Ephemeral session within a thread (one engine lifetime / one turn's
/// live posture). The TUI's `EngineHandle` and the headless `exec` both
/// hold a `Session` that points at the same `ThreadId` but with different
/// `SessionId`s.
#[derive(Debug, Clone)]
pub struct Session {
    pub session_id: SessionId,
    pub thread_id: ThreadId,
    /// Model for this session's next turn (may differ from thread default).
    pub model: String,
    pub workspace: PathBuf,
    /// Monotonic `messages_revision` for prefix-cache memoization (carried
    /// from the former `Session::messages_revision`).
    pub messages_revision: u64,
}

impl Session {
    #[must_use]
    pub fn new(thread_id: ThreadId, workspace: PathBuf, model: impl Into<String>) -> Self {
        Self {
            session_id: SessionId::new(),
            thread_id,
            model: model.into(),
            workspace,
            messages_revision: 0,
        }
    }

    pub fn bump_revision(&mut self) {
        self.messages_revision = self.messages_revision.wrapping_add(1);
    }
}

/// Split helper: derive a `Session` from an existing `Thread` without
/// cloning the journal. Headless and TUI call the same constructor so
/// the request shape stays identical.
#[must_use]
pub fn session_for_thread(thread: &Thread, workspace: PathBuf) -> Session {
    Session::new(thread.thread_id.clone(), workspace, thread.model.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thread_and_session_ids_are_distinct_scopes() {
        let t = Thread::new(ThreadId::new(), PathBuf::from("/tmp"), "deepseek-v4-flash");
        let s1 = Session::new(t.thread_id.clone(), PathBuf::from("/tmp"), &t.model);
        let s2 = Session::new(t.thread_id.clone(), PathBuf::from("/tmp"), &t.model);
        assert_eq!(s1.thread_id, s2.thread_id);
        assert_ne!(s1.session_id, s2.session_id);
    }

    #[test]
    fn leaf_is_moved_not_rewritten() {
        let mut t = Thread::new(ThreadId::new(), PathBuf::from("/tmp"), "m");
        let a = t.journal.append("header", serde_json::json!({}));
        let b = t.journal.append("user", serde_json::json!("b"));
        t.leaf_id = t.journal.leaf_id.clone();
        assert_eq!(t.leaf_id.as_deref(), Some(b.as_str()));
        assert!(t.journal.branch_to(&a));
        t.leaf_id = t.journal.leaf_id.clone();
        assert_eq!(t.leaf_id.as_deref(), Some(a.as_str()));
        assert_eq!(t.journal.len(), 2); // history never rewritten; branching only moved the leaf
    }
}

```

### Core Architecture Module: `crates/core/src/tool_parser.rs`
```
//! Legacy parser for text-based tool calls from DeepSeek models.
//!
//! The engine prefers structured tool-call items and uses this fallback when
//! a response has tool-call markers but no structured calls. Unbalanced argument
//! objects are rejected; they must not become calls with invented empty args.
//!
//! Some DeepSeek outputs tool calls as text in various formats:
//! ```text
//! [TOOL_CALL]
//! {tool => "tool_name", args => {...}}
//! [/TOOL_CALL]
//! ```
//!
//! Or XML-style format:
//! ```text
//! <codewhale:tool_call>
//! <invoke name="tool_name">
//! <parameter name="arg">value</parameter>
//! </invoke>
//! </codewhale:tool_call>
//! ```
//!
//! This module parses these text patterns into structured tool calls.

use regex::Regex;
use serde_json::{Value, json};
use std::sync::OnceLock;

/// A parsed tool call from text content.
#[derive(Debug, Clone)]
pub struct ParsedToolCall {
    /// Tool name
    pub name: String,
    /// Tool arguments as JSON
    pub args: Value,
    /// Generated ID for the tool call
    pub id: String,
}

/// Result of parsing text for tool calls.
#[derive(Debug)]
pub struct ParseResult {
    /// The text with tool call markers removed (for display)
    pub clean_text: String,
    /// Parsed tool calls found in the text
    pub tool_calls: Vec<ParsedToolCall>,
}

static TOOL_CALL_REGEX: OnceLock<Regex> = OnceLock::new();
static XML_TOOL_CALL_REGEX: OnceLock<Regex> = OnceLock::new();
static INVOKE_REGEX: OnceLock<Regex> = OnceLock::new();
static THINKING_REGEX: OnceLock<Regex> = OnceLock::new();
static FAKE_TOOL_WRAPPER_REGEX: OnceLock<Regex> = OnceLock::new();

const FAKE_TOOL_CALL_MARKERS: &[&str] = &[
    "<function_calls>",
    "<｜DSML｜tool_calls>",
    "<｜DSML｜invoke ",
    "<|DSML|tool_calls>",
    "<|DSML|invoke ",
    "<|dsml|tool_calls>",
    "<|dsml|invoke ",
    "<|tool_calls>",
    // DeepSeek native tool-call tokens (#3880). See
    // `engine::streaming::TOOL_CALL_MARKER_PAIRS` for why the `▁` (U+2581)
    // separator matters: these match no DSML entry, so they used to reach the
    // user as visible text.
    "<｜tool▁calls▁begin｜>",
    "<｜tool▁call▁begin｜>",
    "<|tool▁calls▁begin|>",
    "<|tool▁call▁begin|>",
    "<｜tool_calls_begin｜>",
    "<｜tool_call_begin｜>",
    "<|tool_calls_begin|>",
    "<|tool_call_begin|>",
];

/// Tool-call wrapper pairs whose start and end markers are plain literals, so
/// their regex alternative is built by escaping rather than hand-written. The
/// DSML entries stay hand-written above because they carry attributes
/// (`invoke name="…"`) and need `\b[^>]*>` rather than a literal match.
const LITERAL_FAKE_WRAPPER_PAIRS: &[(&str, &str)] = &[
    ("<｜tool▁calls▁begin｜>", "<｜tool▁calls▁end｜>"),
    ("<｜tool▁call▁begin｜>", "<｜tool▁call▁end｜>"),
    ("<｜tool▁outputs▁begin｜>", "<｜tool▁outputs▁end｜>"),
    ("<｜tool▁output▁begin｜>", "<｜tool▁output▁end｜>"),
    ("<|tool▁calls▁begin|>", "<|tool▁calls▁end|>"),
    ("<|tool▁call▁begin|>", "<|tool▁call▁end|>"),
    ("<|tool▁outputs▁begin|>", "<|tool▁outputs▁end|>"),
    ("<|tool▁output▁begin|>", "<|tool▁output▁end|>"),
    ("<｜tool_calls_begin｜>", "<｜tool_calls_end｜>"),
    ("<｜tool_call_begin｜>", "<｜tool_call_end｜>"),
    ("<｜tool_outputs_begin｜>", "<｜tool_outputs_end｜>"),
    ("<｜tool_output_begin｜>", "<｜tool_output_end｜>"),
    ("<|tool_calls_begin|>", "<|tool_calls_end|>"),
    ("<|tool_call_begin|>", "<|tool_call_end|>"),
    ("<|tool_outputs_begin|>", "<|tool_outputs_end|>"),
    ("<|tool_output_begin|>", "<|tool_output_end|>"),
];

fn get_tool_call_regex() -> &'static Regex {
    TOOL_CALL_REGEX.get_or_init(|| {
        // Match [TOOL_CALL] ... [/TOOL_CALL] blocks
        Regex::new(r"(?s)\[TOOL_CALL\]\s*(.*?)\s*\[/TOOL_CALL\]")
            .expect("TOOL_CALL regex pattern is valid")
    })
}

fn get_xml_tool_call_regex() -> &'static Regex {
    XML_TOOL_CALL_REGEX.get_or_init(|| {
        // Match <codewhale:tool_call>...</codewhale:tool_call> or similar XML patterns
        Regex::new(r"(?s)<(?:codewhale:)?tool_call[^>]*>\s*(.*?)\s*</(?:codewhale:)?tool_call>")
            .expect("XML tool_call regex pattern is valid")
    })
}

fn get_invoke_regex() -> &'static Regex {
    INVOKE_REGEX.get_or_init(|| {
        // Match <invoke name="tool_name">...</invoke> patterns
        Regex::new(r#"(?s)<invoke\s+name\s*=\s*"([^"]+)"[^>]*>(.*?)</invoke>"#)
            .expect("invoke regex pattern is valid")
    })
}

fn get_thinking_regex() -> &'static Regex {
    THINKING_REGEX.get_or_init(|| {
        // Match thinking blocks including partial closing tags
        Regex::new(r"(?s)</?(?:think|thinking)[^>]*>").expect("thinking regex pattern is valid")
    })
}

fn get_fake_tool_wrapper_regex() -> &'static Regex {
    FAKE_TOOL_WRAPPER_REGEX.get_or_init(|| {
        let mut alternatives = vec![
            r"<function_calls>.*?</function_calls>".to_string(),
            r"<｜DSML｜tool_calls>.*?</｜DSML｜tool_calls>".to_string(),
            r"<｜DSML｜invoke\b[^>]*>.*?</｜DSML｜invoke>".to_string(),
            r"<\|DSML\|tool_calls>.*?</\|DSML\|tool_calls>".to_string(),
            r"<\|DSML\|invoke\b[^>]*>.*?</\|DSML\|invoke>".to_string(),
            r"<\|dsml\|tool_calls>.*?</\|dsml\|tool_calls>".to_string(),
            r"<\|dsml\|invoke\b[^>]*>.*?</\|dsml\|invoke>".to_string(),
            r"<\|tool_calls>.*?</\|tool_calls>".to_string(),
        ];
        alternatives.extend(
            LITERAL_FAKE_WRAPPER_PAIRS
                .iter()
                .map(|(start, end)| format!("{}.*?{}", regex::escape(start), regex::escape(end))),
        );
        Regex::new(&format!("(?s){}", alternatives.join("|")))
            .expect("fake tool wrapper regex pattern is valid")
    })
}

/// Parse tool calls from text content.
/// Returns the clean text (with markers removed) and any parsed tool calls.
pub fn parse_tool_calls(text: &str) -> ParseResult {
    let mut tool_calls = Vec::new();
    let mut clean_text = text.to_string();
    let mut id_counter = 0;

    // First, remove thinking tags
    let thinking_regex = get_thinking_regex();
    clean_text = thinking_regex.replace_all(&clean_text, "").to_string();

    // Parse [TOOL_CALL] format
    let regex = get_tool_call_regex();
    for cap in regex.captures_iter(text) {
        let (Some(full_match), Some(inner)) = (cap.get(0), cap.get(1)) else {
            continue;
        };
        let full_match = full_match.as_str();
        let inner = inner.as_str().trim();

        if let Some(parsed) = parse_tool_call_inner(inner, &mut id_counter) {
            tool_calls.push(parsed);
        }

        clean_text = clean_text.replace(full_match, "");
    }

    // Parse XML-style <codewhale:tool_call> or <tool_call> format
    let xml_regex = get_xml_tool_call_regex();
    for cap in xml_regex.captures_iter(text) {
        let (Some(full_match), Some(inner)) = (cap.get(0), cap.get(1)) else {
            continue;
        };
        let full_match = full_match.as_str();
        let inner = inner.as_str().trim();

        // Parse invoke blocks inside
        if let Some(parsed) = parse_invoke_block(inner, &mut id_counter) {
            tool_calls.push(parsed);
        } else if let Some(parsed) = parse_tool_call_inner(inner, &mut id_counter) {
            tool_calls.push(parsed);
        }

        clean_text = clean_text.replace(full_match, "");
    }

    // Also parse standalone <invoke> blocks that might not be wrapped
    let invoke_regex = get_invoke_regex();
    for cap in invoke_regex.captures_iter(&clean_text.clone()) {
        let (Some(full_match), Some(tool_name), Some(inner)) = (cap.get(0), cap.get(1), cap.get(2))
        else {
            continue;
        };
        let full_match = full_match.as_str();
        let tool_name = tool_name.as_str();
        let inner = inner.as_str();

        let args = parse_xml_parameters(inner);
        id_counter += 1;
        tool_calls.push(ParsedToolCall {
            name: tool_name.to_string(),
            args,
            id: format!("xml_tool_{id_counter}"),
        });

        clean_text = clean_text.replace(full_match, "");
    }

    clean_text = get_fake_tool_wrapper_regex()
        .replace_all(&clean_text, "")
        .to_string();

    // Clean up extra whitespace and empty lines
    clean_text = clean_text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();

    ParseResult {
        clean_text,
        tool_calls,
    }
}

/// Parse an `<invoke>` block into a tool call.
fn parse_invoke_block(content: &str, id_counter: &mut u32) -> Option<ParsedToolCall> {
    let invoke_regex = get_invoke_regex();
    let cap = invoke_regex.captures(content)?;

    let tool_name = cap.get(1)?.as_str();
    let inner = cap.get(2)?.as_str();

    let args = parse_xml_parameters(inner);

    *id_counter += 1;
    Some(ParsedToolCall {
        name: tool_name.to_string(),
        args,
        id: format!("xml_tool_{id_counter}"),
    })
}

/// Parse XML-style parameters like <parameter name="foo">value</parameter>
fn parse_xml_parameters(content: &str) -> Value {
    let param_regex = Regex::new(
        "<(?:parameter|param)\\s+name\\s*=\\s*\"([^\"]+)\"[^>]*>(.*?)</(?:parameter|param)>",
    )
    .ok();
    let simple_tag_regex =
        Regex::new("<([a-zA-Z_][a-zA-Z0-9_]*)>(.*?)</([a-zA-Z_][a-zA-Z0-9_]*)>").ok();

    let mut map = serde_json::Map::new();

    // Try parsing <parameter name="...">value</parameter>
    if let Some(regex) = param_regex {
        for cap in regex.captures_iter(content) {
            if let (Some(name), Some(value)) = (cap.get(1), cap.get(2)) {
                let name_str = name.as_str();
                let value_str = value.as_str().trim();

                // Try to parse as JSON, otherwise use as string
                let json_value = serde_json::from_str(value_str)
                    .unwrap_or_else(|_| Value::String(value_str.to_string()));
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6827** (2026-10-05): **Windows (npm install): killing node.exe instantly terminates Codewhale with no cleanup; the agent's own "stop node" commands can kill the session**
  *Symptoms*: ### Before you start  - [x] I searched existing issues and this is not a duplicate. 我已搜索过现有 issue。  ### What happened? 发生了什么？  ## Summary  On Windows with the npm install, `codewhale` runs as `node.exe` (npm launcher) → `codewhale.exe`. If anything kills that `node.exe`, `codewhale.exe` is terminated immediately with no cleanup: no log line, no crash file, terminal not restored. PowerShell then gets its prompt back and draws it on top of the frozen Codewhale screen.  The most common way this happens is the agent itself: stopping a dev server with a broad node kill (`Get-Process node | Stop-Process -Force`, `taskkill /IM node.exe`) also kills Codewhale's launcher, and the launchers of any other Codewhale sessions running at the same time.  **Expected:** a command that stops node dev servers should not terminate Codewhale, or Codewhale should at least warn before running it.  ## Process tree (before the kill)  ``` ProcessId 28632  Parent 34880 (PowerShell)  node.exe   "C:\Program Files\nodejs\node.exe" ...\npm/node_modules/codewhale/bin/codewhale.js ProcessId 40608  Parent 28632               codewhale.exe   ...\npm\node_modules\codewhale\bin\downloads\codewhale.exe ```  After `Stop-Process -Id 28632 -Force`, both processes are gone immediately.  ## Why it happens (as far as I can tell)  `npm/codewhale/scripts/run.js` starts the binary with `spawnSync(binaryPath, args, { stdio: "inherit" })` and node stays alive as the parent for the whole session. On Windows, Node places spawn
  **Post-Mortem & Fix Analysis**:
  > A few directions, roughly from most to least thorough:  Remove node.exe from the chain on Windows so codewhale launches the native binary directly. This fixes the root cause, but it's packaging/release plumbing,   Agent context note: tell the agent it runs under the npm launcher (PID X) and must stop servers by PID or port, never by killing node.exe by name. Small, but it touches prompt content...   Shell-tool confirmation for broad node kills on npm installs.   Docs: point Windows users to the native installer.
  > Verified on Windows 11 (10.0.26200), built from the 0.10.1 integration branch at af5fa5c23 (head of #6815 before merge), Full Access mode:   Everything that passed: Get-Process node | Stop-Process -Force is refused by the built-in safety gate, and the session survives.  Stopping by port inline works: Stop-Process -Id (Get-NetTCPConnection -LocalPort 3999 -State Listen).OwningProcess  A literal Stop-Process -Id <pid> passes the gate.   One follow-up: the same stop is refused when the PID is stored in a variable first: $p = (Get-NetTCPConnection -LocalPort 3999 -State Listen).OwningProcess; Stop-Process -Id $p → "unbounded process termination…" That also blocks the usual owned-process pattern ($proc = Start-Process ... -PassThru; Stop-Process -Id $proc.Id), which is what the gate's message recommends. I'll open a separate issue with details, and I'm happy to send a fix.

- **Issue #6704** (2026-09-29): **The text background in the TUI interface is abnormal.**
  *Symptoms*: ## Description  <img width="1004" height="284" alt="Image" src="https://github.com/user-attachments/assets/138a8466-8fb2-4b92-b069-7525ee4ddca4" /> After running in focus for about half an hour, the text background in the TUI interface appears black.      <img width="1113" height="408" alt="Image" src="https://github.com/user-attachments/assets/f4b6a653-f9cd-4e8d-a3be-187f3861d5e8" /> At this point, if you scroll the screen, you will notice remnants of the black background, but they will disappear.  ## Environment  - OS:Windows 11 25H2 - codewhale version:v0.10.0 - Install method:Scoop Installer - `codewhale doctor` summary: - Model/provider:DeepSeek-v4.1-flash - Terminal app:Windows Terminal - Shell:PowerShell 7
  **Post-Mortem & Fix Analysis**:
  > Fixed on main by #6714 — `4a2ff57ed` (hover rules / black holes behind detail target) merged as `a0a3f045f`; both are ancestors of tip `8a5de83f0`.

- **Issue #6697** (2026-09-29): **The latest-message jump button in the TUI renders abnormally.**
  *Symptoms*: ## Description  The jump-to-latest-message button in the TUI is rendered abnormally; there are multiple horizontal lines on the button.  <img width="219" height="209" alt="Image" src="https://github.com/user-attachments/assets/2cbd62bc-b987-4414-90d3-18f790646ecb" />  ## Steps to reproduce  You can see it just by hovering the mouse over the button.  ## Environment  - OS:Windows 11 25H2 - codewhale version:v0.10.0 - Install method:Scoop Installer - `codewhale doctor` summary: - Model/provider:DeepSeek-v4.1-flash - Terminal app:Windows Terminal - Shell:PowerShell 7

- **Issue #6690** (2026-09-28): **v0.10.0: OpenRouter session costs always show "rate unavailable"**
  *Symptoms*: # OpenRouter turns are never priced on v0.10.0 ("rate unavailable"): `~`-alias ids break the provider-lake refresh, and the main turn path ignores `custom_models` overrides  **Repo:** Hmbown/CodeWhale **Version:** 0.10.0 (reproduced on Linux/Pop!_OS 22.04, model `deepseek/deepseek-v4.1-flash:nitro` via OpenRouter) **Severity:** High for any user who relies on session cost estimation on OpenRouter routes (cost accounting silently degrades to "unknown (rate unavailable)" for **every** OpenRouter model, not just this one). **Labels:** pricing, cost-status, provider-catalog, regression  ## Summary  Two independent defects in v0.10.0 combine so that **no OpenRouter turn can be priced on the main interactive path**:  1. The per-provider catalog refresh ("provider lake") for OpenRouter always fails with `invalid_response`, because OpenRouter's `/v1/models` response now contains `~`-prefixed "latest alias" ids that fail Codewhale's `valid_catalog_model_id` validator. The failure is fail-closed for the whole roster, so the lake never becomes `Fresh`. 2. The main interactive turn path freezes pricing **only** from that provider lake (`fresh_provider_live_pricing_quote_at`). It never consults the operator-declared `[[custom_models]]` / `ConfigOverride` / `UserOverride` quote that the background/review path uses (`client.effective_route_envelope`).  Even with #1 fixed, a server-tag-suffixed route (e.g. `…:nitro`) still cannot be priced because the pricing lookup is an exact `wire_model_i

- **Issue #6651** (2026-09-29): **the TUI interface cannot refresh in real time.**
  *Symptoms*: ## Description  When the terminal interface is not in focus, the TUI interface cannot refresh in real time.  ## Steps to reproduce  When the TUI is running, placing the terminal behind other windows is not the same as minimizing it.  ## Expected behavior  The TUI interface content should refresh in real time at all times.  ## Actual behavior  After the terminal gains focus, you must click on the TUI interface to see the latest content.  ## Environment  - OS:Windows 11 25H2 - codewhale version:v0.10.0 - Install method:Scoop Installer - `codewhale doctor` summary: - Model/provider:DeepSeek-v4.1-flash - Terminal app:Windows Terminal - Shell:PowerShell 7
  **Post-Mortem & Fix Analysis**:
  > Same here — I hit this on the same setup (Windows 11, Windows Terminal, PowerShell, v0.10.0), and it reproduces every time: park the window behind something else while the agent is streaming, come back, and the screen sits frozen until you click into it.  Here's what my bot and I found when we went digging.  **Why it happens**  `4a633a0fa` gates frame emission on `FocusLost` unconditionally:      Event::FocusLost => true      // next_unfocused()  That was correct for the bug it was fixing (#6311 — GTK3 pauses the frame clock on full occlusion while VTE keeps queuing damage, so every frame emitted while covered becomes flicker backlog on return). The reasoning recorded in that fix was "terminals without focus reporting never send the events → behavior unchanged, no regression possible."  The catch: Windows Terminal *does* report focus, and on Windows an unfocused window is usually still visible — a side-by-side pane you're actually watching. So the gate fires exactly where nobody wanted
  > Fixed on main in #6519 and awaiting release, with [Windows Terminal confirmation](https://github.com/Hmbown/Codewhale/issues/6651#issuecomment-5851509543) supplied by @SparkofSpike; thank you @luestr for the report.

- **Issue #6566** (2026-09-26): **First run: new users never see onboarding; first message lost or doubled; provider picker, key errors and approval card are developer-facing**
  *Symptoms*: First-run audit (2026-09-24). The installed build and origin/main were run as a brand-new user with a throwaway HOME, against a local mock provider (no real calls), at 80x24 and 160x45, including zh_CN.  ## Findings (file:line on origin/main) 1. **No first-run onboarding.** \`initial_onboarding_state\` (\`crates/tui/src/tui/app.rs:260-284\`) returns \`None\` for a never-onboarded user, who lands on the bare composer with \"no model connected · run /provider\". Welcome, provider, trust and ready screens only appear for returning users missing a key, or after a failed send. The seeded first task (\`onboarding/mod.rs:431\`) is unreachable. 2. **First message lost or doubled.**    - With no key it says \"not sent… send it again\", with DeepSeek-specific help although no provider was chosen (\`session_state.rs:908-956\`, \`config.rs:7390\`).    - A 401 turn stays in the transcript, so the next request re-sends the question and it shows twice after resume.    - The provider screen says \"Getting started · 2/3\" although step 1 never appeared. 3. **Provider picker on day one.** It opens on \"DeepSeek missing key\"; 40+ providers are behind \`A\`, alphabetical, all \"needs key\". Jargon: \"Route:\" (\`provider_picker.rs:3001\`), \"external access choices\", \"\$in/\$out per mtok\", \"price ?\". 4. **Key errors.**    - A bad key shows truncated raw JSON (\`provider_picker.rs:3408\`).    - A good key shows \"Connection checked (/models returned 2xx)\", clipped at 80 columns.    - \"Sav

- **Issue #6565** (2026-09-28): **Background work: the footer shows step chatter, agent names disagree, needs-you never reaches the footer, cache rate hidden by the compact default**
  *Symptoms*: Product audit of the 15 surfaces that report background work, plus the cache-rate display. Founder screenshot: footer \`agents underway 1m 52s · 5 agents\` with right status \`Agent 1: step 6: finished tool 'read_file'\`.  ## Cache rate (was hidden, never removed) - \`66f022ff2d\` (2026-09-12) made \`metrics_line\` default to \`compact\` (\`app/init.rs:1022\`). Compact drops segments with shed priority ≥ 7, and cache is 8 (\`infoline.rs:116,140,273\`). - Fix: set \`Cache\` to 6 so it survives compact and is still the first performance reading to shed on narrow widths. - Also: replace the two copy-pasted percentage calculations in \`frame.rs:300-340\` with \`session_metrics::snapshot_from_app().cache_hit_percent\`, and fix the \`config.rs:1823\` doc. - A provider that never reports cache shows nothing, not 0%. - Tests: compact shows cache; a provider that never reports shows no segment; explicit zero hits show \`cache 0%\`.  ## Quick fixes (~20 lines each) 1. Delete the footer right-slot chatter (\`event_loop.rs:3514\` ← \`tools/subagent/mod.rs:14811\`); every child progress event overwrites it. 2. One name per agent: seed the label map from the workflow's \`task_started\` (\`task_id == agent_id\` + label), so the card, status, roster and notifications agree instead of showing \`loop-prompt\` / \`Agent 1\` / \`explore\` / a raw id. 3. Pending child approvals drive the phase clock to needs-you (\`underwater.rs:619-663\`), instead of \"agents underway\" while an approval waits. 

- **Issue #6563** (2026-09-25): **codewhale config set accepts typos and unknown keys silently; did-you-mean uses a stale key list**
  *Symptoms*: Found while designing settings-by-conversation. Observed on 0.10.0 in a throwaway home: - `codewhale config set calm_mode flase` and `codewhale config set totally_bogus_key 42` both exit 0 and write those values into config.toml. `calm_mode` lives in settings.toml, so nothing ever reads the write. `config doctor` still reports clean. The cause is the fallthrough into `extras` (`crates/config/src/lib.rs` ~2933). - `unknown_setting_message` suggests keys from the hand-kept `Settings::available_settings()` (`settings.rs` ~1933) instead of `SETTINGS_SCHEMA`.  ## Fix - Validate the key and value type against the declared schema. - Refuse unknown keys with the nearest valid key from `SETTINGS_SCHEMA`. - Route settings.toml keys to settings.toml. - Make `config doctor` report keys that nothing reads. - Keep an explicit `--force` escape hatch only if some real workflow needs it.

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

### Incident Patch 1: `ddefec0a` (2026-10-05)
**Commit Message**: fix(contract): pair merged documentation with measured Linux ceiling

Hosted main CI 37359068458 Lint job 111929025135 measured exactly 84865 bytes / 21217 estimated tokens for Act/Operate full catalogs (+714 / +179); only these four ceilings failed. Preserve every other ceiling and identity. This data-only fix needs its own hosted rerun.

Local npm gate on wave with identical JS gate inputs: 1285 passed, 0 failed, 7 skipped; check:web passed. Budget checker and measurement unit tests passed; no claim of full main Rust tests or native Windows proof.

Signed-off-by: CodeWhale Bot <[REDACTED_EMAIL]>

**File**: `scripts/runtime-contract-budget.json` (modified, +7/-6)
```diff
@@ -1,4 +1,6 @@
 {
+  "_codex_0101_remeasure": "2026-10-01: lock the composed candidate measurement after the audited composition-required schema repair (46835a2fc, D04-11) and shared finance-timeout documentation (7c36620d4, D03-m3). Their parent-surface causal controls are recorded in 6655b191e. Act/Operate full catalog measured 84151 bytes / 21038 estimated tokens versus stale 83988 / 20997; no tools or surface identities changed. Plan/active surfaces and other budgets use their measured values. Estimate only, not provider usage. Receipt: CW/artifacts/codex-0101-takeover-20260930/root-runtime-contract-receipt.json.",
+  "_codex_20261005_main_remeasure": "2026-10-05: pair already-merged tool description disclosures with exact hosted Linux measurement on main 3684e2a776fd6ef4f07e8d75e8429d4bed52858b, CI 37359068458 Lint job 111929025135. Only Act/Operate full catalog ceilings failed: 84865 bytes / 21217 estimated tokens versus 84151 / 21038 (+714 B / +179). Accept only that measured increase; tool identities, active/Plan surfaces, prompt and other ceilings unchanged. Estimate only, not provider usage. Wave composition has its own measurement.",
   "_comment": "One-way numeric ceilings and exact structural identities for the provider-free runtime contract. Decreases pass; increases or identity changes fail. Lock in decreases with: python3 scripts/check-runtime-contract-budget.py --update The v0.9.8 child-receipt restore grew every production tool surface by 1496 schema bytes / 374 estimated tokens (agent tool). The v0.9.8 workshop read/tool-result byte fields then grew every production tool surface by 371 schema bytes / 93 estimated tokens. Both raises are explicit maintainer decisions; identities stay on the pre-raise digests only if the name set is unchanged \u2014 re-measure on Linux CI if Lint reports identity drift. The v0.9.8 pinned session prefix added the <context_update> sentence to the base prompt (5848 -> 6084 bytes, every representative stage re-hashed), and the host-side Workflow/Goal verbs plus honest child posture grew the tool catalog (active 16531 -> 16602 bytes, full 71473 -> 72371); both are explicit v0.9.8 maintainer decisions measured from the release train. The v0.9.9 configured-skills change hides only custom configured-root paths, preserves discoverable default-root paths, normalizes Windows prompt separators, and trims 50 redundant skills-prompt bytes. The skill/memory/goal/handoff identities were re-measured without raising any ceiling. Explicit maintainer decision for #5473/#5492. The v0.9.10 full surfaces intentionally add the safe read_media tool; their measured schemas remain below the prior byte/token ceilings. Representative prompt byte metrics now use the same host-independent normalized text as their identities; the normalized base is 6089 bytes. The v0.9.11 model-visible sub-agent surface intentionally retires six legacy agents/* tools in favor of the canonical agent tool; all affected schema and prompt metrics decrease. The v0.9.12 plugin prompt-match slice intentionally adds the request_plugin_install tool to the full tool surfaces (plan full: +518 schema bytes / +130 estimated tokens / 29 -> 30 tools) so a strong prompt match can surface the human review CTA; explicit maintainer decision for #5663/#5579. The v0.9.13 profile pins a non-executed bare bash shell so interpreter guidance is reproducible across hosts. The duplicate tts catalog entry is intentionally hidden; speech remains canonical and the alias remains available for saved-transcript dispatch. Explicit v0.9.13 maintainer decision (2026-09-08): after removing 1426 repeated guidance bytes and pinning the bash-v2 fixture, accept only the measured tool byte/token ceilings from all-features macOS source e27735bb63c897f88061c71567701fd971f5d396, verified libtest SHA-256 5e8cbe213f32c4ecdec63494c4de5e31857b4a40134edf7b21a55bca926b1b38: active 13274/3319 in every mode, Plan full 39885/9972, Act/Operate full 67603/16901, with no margin. Against the prior budget, active +390 bytes is agent -41 plus retained bash command syntax +431. Plan full also retains Git commit_plan +253, update_goal progress +583, github bounded local-report guidance +127, review complete-input refusal +35, and send_later dispatching status +14. Act/Operate full instead has github +2151 and additionally speech +230, hidden tts -2120, and tasks/automation exact model-route fields +274 each. The older budget predates v0.9.12: that tag had already removed 361 agent bytes and added the two 274-byte route fields; the retained initial increase versus the tag is 751 source-attributed bytes (agent +320, bash +431), not the +390 budget delta. Only the seven active definitions form the initial request; full catalogs include deferred tools. Estimated tokens use the existing bytes/4 heuristic, not provider usage or billing. Prompt, representative-context, skill-discovery and tool-name identities/ceilings are unchanged. Explicit v0.9.13 maintainer decision (2
```

---

### Incident Patch 2: `3684e2a7` (2026-10-05)
**Commit Message**: fix(windows): strip \\?\ from reviewed MCP child argv/cwd

After the LPAC realpath fallback, native_mcp activation succeeds on Windows
and exposes the next failure: freeze_plugin_stdio_paths hands Path::canonicalize
verbatim paths (\\?\C:\...) to Node as the peer.mjs argv/cwd. Node's ESM loader
exits 1 before handshake, so connect_all reports Connection closed / exit code 1.
Reviewed stderr is scrubbed, so the job log only showed the exit status.

Strip the verbatim prefix at the BrokerSession spawn boundary only —
containment checks keep the prefixed form. Same rule as runtime_api job cwd
and Git for Windows. Also make the mixed_native_graphs scope.path assertion
separator-agnostic via Path::ends_with (Windows keeps backslashes).

Evidence: plain_windows_child_path unit coverage; standalone helper check on
this box. Hosted Windows Test is the LPAC proof.

Signed-off-by: CodeWhale Bot <[REDACTED_EMAIL]>

**File**: `crates/tui/src/extension_host/native_mcp/tests.rs` (modified, +10/-12)
```diff
@@ -9,6 +9,7 @@ use crate::extension_host::{ExtensionHostManager, HostAttachment, TestManagerGua
 use crate::mcp::{McpBackend, McpPool};
 use crate::plugins::activation::TestPolicyGuard;
 use serde_json::json;
+use std::path::Path;
 use std::time::Duration;
 
 fn selected(fixture: &FixturePlugins, tag: &str) -> Arc<PluginRegistry> {
@@ -112,21 +113,18 @@ async fn mixed_native_graphs_use_one_core_catalog_and_selected_child_pool_on_bot
     );
     // Same owner and public names, distinct exact selected entry handles.
     assert_eq!(a_defs[0].0, b_defs[0].0);
+    // Path::ends_with is separator-agnostic. A string suffix of "native/a.mjs"
+    // fails on Windows because scope paths keep backslashes (and may carry a
+    // verbatim prefix from canonicalize).
     assert!(
-        a_defs[0]
-            .3
-            .registration
-            .scope
-            .path
-            .ends_with("native/a.mjs")
+        Path::new(&a_defs[0].3.registration.scope.path).ends_with(Path::new("native/a.mjs")),
+        "{}",
+        a_defs[0].3.registration.scope.path
     );
     assert!(
-        b_defs[0]
-            .3
-            .registration
-            .scope
-            .path
-            .ends_with("native/b.mjs")
+        Path::new(&b_defs[0].3.registration.scope.path).ends_with(Path::new("native/b.mjs")),
+        "{}",
+        b_defs[0].3.registration.scope.path
     );
     for backend in [McpBackend::Rust, McpBackend::Host] {
         let mut parent = pool(&fixture, &a, backend);
```

**File**: `crates/tui/src/mcp.rs` (modified, +63/-0)
```diff
@@ -7015,6 +7015,43 @@ fn resolve_project_mcp_cwd(workspace: &Path, cwd: Option<&Path>) -> Result<PathB
     Ok(resolved)
 }
 
+/// Drop the Win32 verbatim prefix before handing a path to an external child
+/// (Node MCP peers, etc.). `Path::canonicalize` returns `\\?\C:\...`; Node's
+/// ESM loader and several Windows tools refuse or mis-handle that spelling for
+/// ordinary paths under MAX_PATH. Containment checks keep the prefixed form;
+/// only argv and current_dir are rewritten. Same rule as runtime_api job cwd
+/// and Git for Windows.
+#[cfg(any(windows, test))]
+fn plain_windows_child_path(path: &str) -> String {
+    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
+        return format!(r"\\{rest}");
+    }
+    match path.strip_prefix(r"\\?\") {
+        Some(rest)
+            if rest.as_bytes().first().is_some_and(u8::is_ascii_alphabetic)
+                && rest.as_bytes().get(1) == Some(&b':') =>
+        {
+            rest.to_string()
+        }
+        _ => path.to_string(),
+    }
+}
+
+#[cfg(windows)]
+pub(crate) fn strip_windows_verbatim_for_child(
+    path: impl AsRef<std::ffi::OsStr>,
+) -> std::ffi::OsString {
+    let raw = path.as_ref().to_string_lossy();
+    std::ffi::OsString::from(plain_windows_child_path(&raw))
+}
+
+#[cfg(not(windows))]
+pub(crate) fn strip_windows_verbatim_for_child(
+    path: impl AsRef<std::ffi::OsStr>,
+) -> std::ffi::OsString {
+    path.as_ref().to_os_string()
+}
+
 fn normalize_path_components(path: &Path) -> PathBuf {
     let mut normalized = PathBuf::new();
     for component in path.components() {
@@ -7656,6 +7693,32 @@ fn snapshot_from_config(
     }
 }
 
+#[cfg(test)]
+mod windows_child_path_tests {
+    use super::plain_windows_child_path;
+
+    #[test]
+    fn plain_windows_child_path_drops_only_the_verbatim_prefix() {
+        assert_eq!(
+            plain_windows_child_path(r"\\?\C:\ws\peer.mjs"),
+            r"C:\ws\peer.mjs"
+        );
+        assert_eq!(
+            plain_windows_child_path(r"\\?\UNC\host\share\peer.mjs"),
+            r"\\host\share\peer.mjs"
+        );
+        for unchanged in [
+            r"C:\ws\peer.mjs",
+            r"\\host\share",
+            r"\\?\Volume{0}\ws",
+            "/tmp/peer.mjs",
+            "peer.mjs",
+        ] {
+            assert_eq!(plain_windows_child_path(unchanged), unchanged);
+        }
+    }
+}
+
 #[cfg(test)]
 mod qualified_plugin_server_name_tests {
     use super::{qualified_plugin_server_name, split_qualified_plugin_server_name};
```

**File**: `crates/tui/src/mcp/process_broker.rs` (modified, +16/-5)
```diff
@@ -108,15 +108,26 @@ impl BrokerSession {
         } else {
             None
         };
+        // Windows: Path::canonicalize yields a verbatim prefix. Node's ESM loader
+        // (and several other Windows tools) refuse that spelling for ordinary
+        // paths under MAX_PATH, so the reviewed peer exits 1 before handshake.
+        // Strip only at the child boundary; containment kept the prefixed form.
         let mut cmd = reviewed_launch.as_ref().map_or_else(
             || {
-                let mut command_process = tokio::process::Command::new(command);
-                command_process.args(&config.args);
+                let mut command_process =
+                    tokio::process::Command::new(super::strip_windows_verbatim_for_child(command));
+                for arg in &config.args {
+                    command_process.arg(super::strip_windows_verbatim_for_child(arg.as_str()));
+                }
                 command_process
             },
             |launch| {
-                let mut command_process = tokio::process::Command::new(&launch.command);
-                command_process.args(&launch.args);
+                let mut command_process = tokio::process::Command::new(
+                    super::strip_windows_verbatim_for_child(&launch.command),
+                );
+                for arg in &launch.args {
+                    command_process.arg(super::strip_windows_verbatim_for_child(arg));
+                }
                 command_process
             },
         );
@@ -130,7 +141,7 @@ impl BrokerSession {
             .and_then(|launch| launch.cwd.as_ref())
             .or(config.cwd.as_ref().filter(|_| reviewed_launch.is_none()));
         if let Some(cwd) = launch_cwd {
-            cmd.current_dir(cwd);
+            cmd.current_dir(super::strip_windows_verbatim_for_child(cwd.as_os_str()));
         }
         #[cfg(unix)]
         if let Some(cwd_fd) = reviewed_launch
```

---

### Incident Patch 3: `d57ec08c` (2026-10-05)
**Commit Message**: Merge pull request #6855 from asto18089/upstream/app-server-proxy-timeouts

fix(app-server): bound chat-completions proxy requests in time

**File**: `crates/app-server/src/chat_completions.rs` (modified, +43/-1)
```diff
@@ -28,6 +28,21 @@ use serde_json::Value;
 
 use super::AppState;
 
+// ── Upstream deadlines ─────────────────────────────────────────────────
+
+/// Connect budget for the upstream forward. Matches the 10s connect bound
+/// used by the TUI client's non-streaming requests (vision, the shared
+/// retry client).
+const UPSTREAM_CONNECT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
+
+/// Total budget for one upstream forward, connect through body end. The
+/// handler rejects streaming (`stream: true`) and reads the full upstream
+/// body, so without a client-level total a provider that accepts the
+/// connection and stalls — or trickles the body — wedges this handler (and
+/// the caller's connection) indefinitely. 1800s mirrors the TUI client's
+/// non-streaming envelope for the same request class.
+const UPSTREAM_TOTAL_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(1800);
+
 // ── Resolved endpoint ──────────────────────────────────────────────────
 
 /// Everything needed to forward a single chat-completions request upstream.
@@ -397,8 +412,12 @@ pub(crate) async fn chat_completions_handler(
             .into_response();
     }
 
-    // Build upstream request.
+    // Build upstream request. The shared platform builder sets no timeouts,
+    // so the proxy would hang forever on an accept-and-stall upstream;
+    // bound both the connect and the whole non-streaming round trip.
     let upstream_req = codewhale_release::platform_http_client_builder()
+        .connect_timeout(UPSTREAM_CONNECT_TIMEOUT)
+        .timeout(UPSTREAM_TOTAL_TIMEOUT)
         .build()
         .map_err(|e| {
             (
@@ -498,6 +517,29 @@ mod tests {
         crate::install_test_crypto_provider();
     }
 
+    // The proxy forwards with a client built per request, and reqwest gives
+    // no accessor for a built client's budgets, so a behavioral test would
+    // need an accept-and-stall upstream and a multi-second (connect) or
+    // half-hour (total) wait. Pin the values instead: if the handler stops
+    // applying them this test cannot see it, but a silent constant change
+    // or an inversion of the connect/total ordering cannot slip through.
+    #[test]
+    fn upstream_deadlines_are_bounded_and_ordered() {
+        assert_eq!(UPSTREAM_CONNECT_TIMEOUT, std::time::Duration::from_secs(10));
+        assert_eq!(UPSTREAM_TOTAL_TIMEOUT, std::time::Duration::from_secs(1800));
+        assert!(
+            UPSTREAM_TOTAL_TIMEOUT > UPSTREAM_CONNECT_TIMEOUT,
+            "the total forward budget must leave room beyond the connect budget"
+        );
+        // The shared platform builder must accept both bounds; the handler
+        // chains them onto this builder.
+        codewhale_release::platform_http_client_builder()
+            .connect_timeout(UPSTREAM_CONNECT_TIMEOUT)
+            .timeout(UPSTREAM_TOTAL_TIMEOUT)
+            .build()
+            .expect("platform builder accepts the proxy deadlines");
+    }
+
     /// Start a minimal upstream mock server that echoes back what it received.
     async fn start_mock_upstream() -> (String, tokio::task::JoinHandle<()>) {
         let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
```

---

### Incident Patch 4: `1703dfd1` (2026-10-05)
**Commit Message**: fix(models,tui): repair the snapshot scan and align catalog gates (review round 1)

Review findings from the two independent PR reviewers:

- `strip_date_stamp` split at `len - 10` without a char-boundary guard; a
  multi-byte model id panicked in `split_at` (reproduced locally:
  `byte index 14 is not a char boundary`). Guard with `is_char_boundary`
  and pin it with a non-ASCII regression test.
- The widened custom-host probe left the picker's freshness receipt
  behind: `provider_catalog_receipt_for_route` still gated on the old
  named-gateway set and its comment described the pre-widening behavior.
  Both the refresh spawn and the receipt now gate on one shared predicate,
  `provider_catalog_live::provider_owns_live_catalog`.
- The refresh comment overclaimed "OpenAI-compatible only"; every custom
  host is probed, so the wording now says so.

**File**: `crates/models/src/lib.rs` (modified, +15/-2)
```diff
@@ -310,8 +310,10 @@ fn strip_snapshot_or_variant_suffix(id: &str) -> Option<String> {
 /// inferred: the sibling-metadata contract rejects that shape (see
 /// `unrecognized_deepseek_models_do_not_inherit_sibling_metadata`).
 fn strip_date_stamp(id: &str) -> Option<String> {
-    // `-YYYY-MM-DD`: a ten-character tail preceded by its own dash.
-    if id.len() > 11 {
+    // `-YYYY-MM-DD`: a ten-character tail preceded by its own dash. The split
+    // index is a byte offset, so it must land on a char boundary: a multi-byte
+    // model id would panic in `split_at` otherwise.
+    if id.len() > 11 && id.is_char_boundary(id.len() - 10) {
         let (head, tail) = id.split_at(id.len() - 10);
         if let Some(head) = head.strip_suffix('-')
             && !head.is_empty()
@@ -1303,6 +1305,17 @@ mod tests {
         assert!(model_is_openai_reasoning_family("gpt-5.5-2026-06-01"));
     }
 
+    /// Multi-byte model ids must not panic the byte-indexed date scan: the
+    /// `-YYYY-MM-DD` layer splits at `len - 10`, which need not be a UTF-8
+    /// char boundary (review finding from the PR #6 review).
+    #[test]
+    fn non_ascii_ids_do_not_panic_the_snapshot_scan() {
+        for model in ["模型模型模型模型", "ローカルモデル-2026", "モデル-0813"] {
+            assert_eq!(context_window_for_model(model), None, "{model}");
+            assert_eq!(model_reasoning_capability(model), None, "{model}");
+        }
+    }
+
     #[test]
     fn compaction_threshold_scales_with_context_window() {
         assert_eq!(
```

**File**: `crates/tui/src/client.rs` (modified, +4/-15)
```diff
@@ -3398,21 +3398,10 @@ impl CodewhaleClient {
             };
             let provider = identity.provider;
             // Custom hosts include Baseten (its `/models` dialect is detected
-            // at fetch time) and every other OpenAI-compatible gateway. The
-            // probe is the only way to learn a private roster, and a failed
-            // probe stays non-fatal.
-            let is_custom_host = provider == ProviderKind::Custom;
-            if !matches!(
-                provider,
-                ProviderKind::Openrouter
-                    | ProviderKind::Telecomjs
-                    | ProviderKind::Edenai
-                    | ProviderKind::Zenmux
-                    | ProviderKind::Concentrate
-                    | ProviderKind::Codewhale
-                    | ProviderKind::Ollama
-            ) && !is_custom_host
-            {
+            // at fetch time) and every other custom host. A private route is
+            // the only place its roster exists, and a failed probe stays
+            // non-fatal.
+            if !crate::provider_catalog_live::provider_owns_live_catalog(provider) {
                 return;
             }
 
```

**File**: `crates/tui/src/provider_catalog_live.rs` (modified, +18/-0)
```diff
@@ -511,6 +511,24 @@ fn storage_provider(kind: ProviderKind, identity: &str) -> String {
     format!("{}:{}", kind.as_str(), identity.trim())
 }
 
+/// Providers whose model list is owned by their own `/v1/models` roster
+/// rather than the cross-provider Models.dev snapshot: the named live
+/// gateways, plus custom hosts whose private roster no snapshot can serve
+/// (#6289 widened). The active-provider refresh and the picker's freshness
+/// receipt both gate on this one predicate, so they cannot drift apart.
+pub(crate) fn provider_owns_live_catalog(provider: ProviderKind) -> bool {
+    matches!(
+        provider,
+        ProviderKind::Openrouter
+            | ProviderKind::Telecomjs
+            | ProviderKind::Edenai
+            | ProviderKind::Zenmux
+            | ProviderKind::Concentrate
+            | ProviderKind::Codewhale
+            | ProviderKind::Ollama
+    ) || provider == ProviderKind::Custom
+}
+
 /// Whether a catalog scope holds an account-scoped roster that must never be
 /// shared across credentials (#6289).
 ///
```

**File**: `crates/tui/src/tui/model_picker.rs` (modified, +4/-11)
```diff
@@ -2599,17 +2599,10 @@ fn provider_catalog_receipt_for_route(
     .ok()?;
     (admitted.provider == provider).then_some(())?;
     let identity = admitted.key.as_str();
-    // A custom route owns its catalog only on Baseten's endpoint, whose
-    // account-scoped roster no snapshot can serve (#6289).
-    let owns_provider_catalog = matches!(
-        provider,
-        ProviderKind::Openrouter
-            | ProviderKind::Telecomjs
-            | ProviderKind::Edenai
-            | ProviderKind::Zenmux
-    ) || (provider == ProviderKind::Custom
-        && codewhale_config::catalog::endpoint_is_baseten(&config.base_url_for_route(&admitted)));
-    if !owns_provider_catalog {
+    // One predicate with the active-provider refresh: any route whose roster
+    // is probed (named live gateways and custom hosts) reports its freshness
+    // here, so a widened probe cannot leave this receipt behind.
+    if !crate::provider_catalog_live::provider_owns_live_catalog(provider) {
         return None;
     }
 
```

---

### Incident Patch 5: `79bbc102` (2026-10-05)
**Commit Message**: feat(tui): probe custom providers' /v1/models for the model picker

A custom OpenAI-compatible host (private relay, self-hosted router) is not
in the Models.dev snapshot, so its `/model` picker stayed empty even
though the chat route already talks to the same endpoint. Custom hosts
are now included in the active-provider catalog refresh; the probe stays
best-effort and non-fatal, and Baseten's `/models` dialect is still
detected at fetch time.

**File**: `crates/tui/src/client.rs` (modified, +10/-7)
```diff
@@ -3381,8 +3381,10 @@ impl CodewhaleClient {
     /// Activated for model-list authorities that are not satisfied by the
     /// cross-provider Models.dev snapshot: OpenRouter, named live gateways,
     /// and Baseten's account-scoped endpoint (no static snapshot can serve a
-    /// per-credential roster). Every other custom host is an ordinary
-    /// provider served by Models.dev plus its configured models (#6289).
+    /// per-credential roster). Custom OpenAI-compatible hosts are included
+    /// too: a private relay is not in the Models.dev snapshot, so without a
+    /// probe its `/model` picker stays empty even though the chat route
+    /// already talks to the same endpoint (#6289 widened).
     /// The refresh is non-fatal: on failure, persisted prior rows and static
     /// seeds remain available with a typed failed receipt.
     pub fn spawn_active_provider_catalog_refresh(config: &Config) {
@@ -3395,10 +3397,11 @@ impl CodewhaleClient {
                 return;
             };
             let provider = identity.provider;
-            let is_baseten_endpoint = provider == ProviderKind::Custom
-                && codewhale_config::catalog::endpoint_is_baseten(
-                    &config.base_url_for_route(&identity),
-                );
+            // Custom hosts include Baseten (its `/models` dialect is detected
+            // at fetch time) and every other OpenAI-compatible gateway. The
+            // probe is the only way to learn a private roster, and a failed
+            // probe stays non-fatal.
+            let is_custom_host = provider == ProviderKind::Custom;
             if !matches!(
                 provider,
                 ProviderKind::Openrouter
@@ -3408,7 +3411,7 @@ impl CodewhaleClient {
                     | ProviderKind::Concentrate
                     | ProviderKind::Codewhale
                     | ProviderKind::Ollama
-            ) && !is_baseten_endpoint
+            ) && !is_custom_host
             {
                 return;
             }
```

---

### Incident Patch 6: `cb0d2a1a` (2026-10-05)
**Commit Message**: fix(models): resolve snapshot and variant ids to their reviewed rows

A custom gateway serves DeepSeek V4 under snapshot and variant ids the
reviewed catalog does not enumerate (`deepseek-v4-pro-0813`,
`deepseek-v4-flash-vision`). They denote the same rows as their base ids,
but every resolver (context window, max output, reasoning capability) fell
through to `None`, so the UI showed the 128K unknown shape.

`reviewed_snapshot_model` now normalizes one layer at a time - a trailing
`-MMDD` / `-YYYY-MM-DD` stamp, or an explicit `-vision` / `-exp` marker -
and accepts a shortening only when the remaining id is an exact reviewed
intrinsic row. The compact `-YYYYMMDD` shape stays un-inferred: the
sibling-metadata contract rejects it.
`model_is_openai_reasoning_family` now requires the resolved target to be
an OpenAI reasoning row, so a DeepSeek snapshot is not relabelled as one.

**File**: `crates/models/src/lib.rs` (modified, +138/-14)
```diff
@@ -222,10 +222,13 @@ pub fn effective_muse_wire_id(model: &str) -> &str {
 #[must_use]
 pub fn model_is_openai_reasoning_family(model: &str) -> bool {
     let lower = model.to_ascii_lowercase();
-    codewhale_config::catalog::reviewed::bundled_reviewed()
-        .openai_reasoning_ids
-        .contains_key(&lower)
-        || reviewed_snapshot_model(&lower).is_some()
+    let reviewed = codewhale_config::catalog::reviewed::bundled_reviewed();
+    reviewed.openai_reasoning_ids.contains_key(&lower)
+        // Snapshot resolution spans every reviewed family; the resolved
+        // target must itself be an OpenAI reasoning row, or a DeepSeek
+        // snapshot would be relabelled as one.
+        || reviewed_snapshot_model(&lower)
+            .is_some_and(|target| reviewed.openai_reasoning_ids.contains_key(target))
 }
 
 pub fn is_openai_gpt_56_api_model(model_lower: &str) -> bool {
@@ -249,6 +252,100 @@ pub fn has_date_snapshot_suffix(model_lower: &str, prefix: &str) -> bool {
             .all(|(idx, byte)| idx == 4 || idx == 7 || byte.is_ascii_digit())
 }
 
+/// Resolve a snapshot or variant model id to the reviewed intrinsic row it
+/// denotes, without inventing facts for names the catalog does not own.
+///
+/// Two documented contracts, applied in order:
+/// - the authored `snapshot_prefixes` rows (`gpt-5.5-<YYYY-MM-DD>`);
+/// - a trailing date stamp (`-YYYY-MM-DD` or `-MMDD`) or an explicit variant
+///   marker (`-vision-exp`, `-vision`, `-exp`), accepted only when stripping
+///   it leaves the exact id of a reviewed intrinsic row
+///   (`deepseek-v4-pro-0813` denotes `deepseek-v4-pro`;
+///   `deepseek-v4-flash-vision` denotes `deepseek-v4-flash`).
+///   The compact `-YYYYMMDD` shape is deliberately not inferred: the
+///   sibling-metadata contract rejects it.
+///
+/// Every layer is resolved against the bundled reviewed catalog only. An
+/// unrecognized name still returns `None`: the unknown stays observable.
+fn reviewed_snapshot_model(model: &str) -> Option<&'static str> {
+    let reviewed = codewhale_config::catalog::reviewed::bundled_reviewed();
+    let via_authored_contract = |candidate: &str| {
+        reviewed
+            .snapshot_prefixes
+            .iter()
+            .find_map(|(prefix, target)| {
+                has_date_snapshot_suffix(candidate, prefix).then_some(target.as_str())
+            })
+    };
+    let mut candidate = model.to_ascii_lowercase();
+    for _ in 0..3 {
+        if let Some(target) = via_authored_contract(&candidate) {
+            return Some(target);
+        }
+        let stripped = strip_snapshot_or_variant_suffix(&candidate)?;
+        if let Some((key, _)) = reviewed.intrinsic.get_key_value(&stripped) {
+            return Some(key.as_str());
+        }
+        candidate = stripped;
+    }
+    None
+}
+
+/// One snapshot/variant normalization layer, longest marker first. The
+/// caller re-resolves the shortened id against the reviewed catalog and
+/// never accepts a shortening on its own.
+fn strip_snapshot_or_variant_suffix(id: &str) -> Option<String> {
+    for marker in ["-vision-exp", "-vision", "-exp"] {
+        if let Some(base) = id.strip_suffix(marker)
+            && !base.is_empty()
+        {
+            return Some(base.to_string());
+        }
+    }
+    strip_date_stamp(id)
+}
+
+/// Strip one trailing date stamp: `-YYYY-MM-DD` or `-MMDD` (the reviewed
+/// snapshot conventions). The compact `-YYYYMMDD` form is deliberately not
+/// inferred: the sibling-metadata contract rejects that shape (see
+/// `unrecognized_deepseek_models_do_not_inherit_sibling_metadata`).
+fn strip_date_stamp(id: &str) -> Option<String> {
+    // `-YYYY-MM-DD`: a ten-character tail preceded by its own dash.
+    if id.len() > 11 {
+        let (head, tail) = id.split_at(id.len() - 10);
+        if let Some(head) = head.strip_suffix('-')
+            && !head.is_empty()
+            && has_date_snapshot_suffix(tail, "")
+        {
+            return Some(head.to_string());
+        }
+    }
+    let (head, tail) = id.rsplit_once('-')?;
+    if head.is_empty() || tail.is_empty() {
+        return None;
+    }
+    let digits = tail.as_bytes();
+    if digits.len() == 4
+        && digits.iter().all(u8::is_ascii_digit)
+        && valid_month_day(&digits[0..2], &digits[2..4])
+    {
+        return Some(head.to_string());
+    }
+    None
+}
+
+/// Validate a two-digit month/day pair (ranges only, no calendar math).
+fn valid_month_day(month_digits: &[u8], day_digits: &[u8]) -> bool {
+    let two = |bytes: &[u8]| -> Option<u32> {
+        (bytes.len() == 2 && bytes.iter().all(u8::is_ascii_digit))
+            .then(|| u32::from(bytes[0] - b'0') * 10 + u32::from(bytes[1] - b'0'))
+    };
+    match (two(month_digits), two(day_digits)) {
+        (Some(month), Some(day)) => (1..=12).contains(&month) && (1..=31).contains(&day),
+        _ => false,
+    }
+}
+
 /// The context window a model name's `_Nk` suffix advertises, when the
 /// c
```

---

### Incident Patch 7: `ad47f695` (2026-10-05)
**Commit Message**: Merge pull request #6851 from asto18089/upstream/install-timeouts

fix(skills): bound skill and plugin install HTTP requests

**File**: `crates/tui/src/skills/install.rs` (modified, +69/-0)
```diff
@@ -50,8 +50,34 @@ use thiserror::Error;
 
 use crate::network_policy::{Decision, NetworkPolicy, host_from_url};
 
+/// Connect and total budgets for install and registry-sync HTTP requests.
+fn install_http_timeouts() -> (std::time::Duration, std::time::Duration) {
+    if cfg!(test) {
+        // Short enough that the stalled-server regression test finishes
+        // quickly, long enough that happy-path tests never approach it.
+        (
+            std::time::Duration::from_millis(250),
+            std::time::Duration::from_secs(2),
+        )
+    } else {
+        (
+            std::time::Duration::from_secs(10),
+            std::time::Duration::from_secs(600),
+        )
+    }
+}
+
 fn reqwest_client() -> reqwest::Client {
+    let (connect_timeout, total_timeout) = install_http_timeouts();
     codewhale_release::platform_http_client_builder()
+        // The shared platform builder sets no timeouts; without a bound, a
+        // connection that opens but stalls (dead proxy, black-holed route)
+        // hangs installs and registry sync forever. Connect is bounded
+        // tightly; the total budget is generous for 5 MiB tarballs on slow
+        // links (registry sync fans out `SYNC_REGISTRY_CONCURRENCY` of
+        // these in parallel).
+        .connect_timeout(connect_timeout)
+        .timeout(total_timeout)
         .build()
         .expect("build platform HTTP client")
 }
@@ -1840,6 +1866,49 @@ mod tests {
         }
     }
 
+    /// A server that accepts the connection and then never reads or writes
+    /// another byte, so the request can only end through the client's own
+    /// timeouts.
+    async fn stalled_server() -> std::net::SocketAddr {
+        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+        let addr = listener.local_addr().unwrap();
+        tokio::spawn(async move {
+            // Hold every accepted socket open without responding.
+            let mut held = Vec::new();
+            while let Ok((socket, _)) = listener.accept().await {
+                held.push(socket);
+            }
+        });
+        addr
+    }
+
+    #[tokio::test]
+    async fn stalled_registry_fetch_fails_through_the_client_timeouts() {
+        let addr = stalled_server().await;
+        let url = format!("http://{addr}/index.json");
+        let policy = NetworkPolicy {
+            default: Decision::Allow.into(),
+            allow: Vec::new(),
+            deny: Vec::new(),
+            proxy: Vec::new(),
+            proxy_fake_ip_cidrs: Vec::new(),
+            audit: false,
+        };
+        // Without the install client's own timeouts this call never returns;
+        // the outer bound only converts that hang into a test failure.
+        let outcome = tokio::time::timeout(
+            std::time::Duration::from_secs(30),
+            fetch_registry(&policy, &url),
+        )
+        .await
+        .unwrap_or_else(|_| panic!("install HTTP must honor its own timeouts"));
+        let err = match outcome {
+            Ok(_) => panic!("a stalled registry connection must fail, not succeed"),
+            Err(err) => format!("{err:#}"),
+        };
+        assert!(err.contains("timed out"), "{err}");
+    }
+
     #[test]
     fn parse_github_source() {
         let s = InstallSource::parse("github:Hmbown/test-skill").unwrap();
```

---

### Incident Patch 8: `d23ee370` (2026-10-05)
**Commit Message**: Merge pull request #6844 from Lstarsky0/fix/locale-extraction-commas

fix(tui): drop the commas the locale extraction put after ←, → and ⚠

**File**: `crates/localization/locales/ca.json` (modified, +3/-3)
```diff
@@ -286,7 +286,7 @@
   "ConfigEditCurrentLabel": "Actual: ",
   "ConfigEditHintLabel": "Pista: ",
   "ConfigEditNewLabel": "Nou: ",
-  "ConfigEditFooter": " Enter=aplicar, Esc=cancel·lar, Ctrl+U=netejar, Ctrl+A=tot, ←,/→,=moure ",
+  "ConfigEditFooter": " Enter=aplicar, Esc=cancel·lar, Ctrl+U=netejar, Ctrl+A=tot, ←/→=moure ",
   "ConfigLocalePartialBadge": "parcial",
   "ConfigLocalePartialDetail": "Paquet de traducció parcial; les cadenes que falten es mostren en anglès.",
   "ConfigRowEffective": " (efectiu {currency})",
@@ -785,7 +785,7 @@
   "SettingsTuiPrefsQuarantined": "Les claus de tui.toml sense cap opció s'han conservat a {path}: {keys}",
   "ClearConversation": "Conversació esborrada",
   "ClearConversationBusy": "No s'ha esborrat res (l'estat de treball o el runtime està ocupat; espera i torna a provar /clear)",
-  "ModelChanged": "Model canviat: {old} →, {new}",
+  "ModelChanged": "El model ara és {new} (abans {old}).",
   "LinksProjectTitle": "Codewhale i comunitat:",
   "LinksDocumentation": "Documentació:",
   "LinksCommunity": "Comunitat i contribució:",
@@ -1186,7 +1186,7 @@
   "ApprovalIntentLabel": "Intenció: ",
   "ApprovalMoreLines": "  … (+{count} línies)",
   "ApprovalAutoDeniedSession": "{tool} denegat automàticament: ja has denegat una sol·licitud coincident en aquest torn. Envia un missatge nou perquè se't torni a preguntar.",
-  "ElevationTitleSandboxDenied": "  ⚠, Sandbox denegat ",
+  "ElevationTitleSandboxDenied": "  ⚠ Sandbox denegat ",
   "ElevationTitleRequired": " Cal elevació del sandbox ",
   "ElevationFieldTool": "  Eina: ",
   "ElevationFieldCmd": "  Cmd:  ",
```

**File**: `crates/localization/locales/de.json` (modified, +3/-3)
```diff
@@ -286,7 +286,7 @@
   "ConfigEditCurrentLabel": "Aktuell: ",
   "ConfigEditHintLabel": "Hinweis: ",
   "ConfigEditNewLabel": "Neu: ",
-  "ConfigEditFooter": " Enter=Übernehmen, Esc=Abbrechen, Ctrl+U=Leeren, Ctrl+A=Alles, ←,/→,=Bewegen ",
+  "ConfigEditFooter": " Enter=Übernehmen, Esc=Abbrechen, Ctrl+U=Leeren, Ctrl+A=Alles, ←/→=Bewegen ",
   "ConfigLocalePartialBadge": "teilweise",
   "ConfigLocalePartialDetail": "Teilweise übersetztes Sprachpaket; fehlende Texte fallen auf Englisch zurück.",
   "ConfigRowEffective": " (effektiv {currency})",
@@ -785,7 +785,7 @@
   "SettingsTuiPrefsQuarantined": "tui.toml-Schlüssel ohne passende Einstellung wurden in {path} aufbewahrt: {keys}",
   "ClearConversation": "Gespräch gelöscht",
   "ClearConversationBusy": "Nichts gelöscht (Work-State oder Laufzeitarbeit beschäftigt; warten, dann /clear erneut versuchen)",
-  "ModelChanged": "Modell gewechselt: {old} →, {new}",
+  "ModelChanged": "Modell ist jetzt {new} (vorher {old}).",
   "LinksProjectTitle": "Codewhale & Community:",
   "LinksDocumentation": "Dokumentation:",
   "LinksCommunity": "Community & Mitwirken:",
@@ -1186,7 +1186,7 @@
   "ApprovalIntentLabel": "Absicht: ",
   "ApprovalMoreLines": "  … (+{count} Zeilen)",
   "ApprovalAutoDeniedSession": "Auto-abgelehnt {tool}: Sie haben eine passende Anfrage in dieser Runde bereits abgelehnt. Senden Sie eine neue Nachricht, um erneut gefragt zu werden.",
-  "ElevationTitleSandboxDenied": "  ⚠, Sandbox verweigert ",
+  "ElevationTitleSandboxDenied": "  ⚠ Sandbox verweigert ",
   "ElevationTitleRequired": " Sandbox-Elevation erforderlich ",
   "ElevationFieldTool": "  Tool: ",
   "ElevationFieldCmd": "  Befehl:  ",
```

**File**: `crates/localization/locales/en.json` (modified, +2/-2)
```diff
@@ -286,7 +286,7 @@
   "ConfigEditCurrentLabel": "Current: ",
   "ConfigEditHintLabel": "Hint: ",
   "ConfigEditNewLabel": "New: ",
-  "ConfigEditFooter": " Enter=apply, Esc=cancel, Ctrl+U=clear, Ctrl+A=all, ←,/→,=move ",
+  "ConfigEditFooter": " Enter=apply, Esc=cancel, Ctrl+U=clear, Ctrl+A=all, ←/→=move ",
   "ConfigLocalePartialBadge": "partial",
   "ConfigLocalePartialDetail": "Partial translation pack; missing strings fall back to English.",
   "ConfigRowEffective": " (effective {currency})",
@@ -1209,7 +1209,7 @@
   "ApprovalIntentLabel": "Intent: ",
   "ApprovalMoreLines": "  … (+{count} lines)",
   "ApprovalAutoDeniedSession": "Auto-denied {tool}: you denied a matching request earlier in this turn. Send a new message to be asked again.",
-  "ElevationTitleSandboxDenied": "  ⚠, Sandbox Denied ",
+  "ElevationTitleSandboxDenied": "  ⚠ Sandbox Denied ",
   "ElevationTitleRequired": " Sandbox Elevation Required ",
   "ElevationFieldTool": "  Tool: ",
   "ElevationFieldCmd": "  Cmd:  ",
```

**File**: `crates/localization/locales/es-419.json` (modified, +3/-3)
```diff
@@ -286,7 +286,7 @@
   "ConfigEditCurrentLabel": "Actual: ",
   "ConfigEditHintLabel": "Pista: ",
   "ConfigEditNewLabel": "Nuevo: ",
-  "ConfigEditFooter": " Enter=aplicar, Esc=cancelar, Ctrl+U=limpiar, Ctrl+A=todo, ←,/→,=mover ",
+  "ConfigEditFooter": " Enter=aplicar, Esc=cancelar, Ctrl+U=limpiar, Ctrl+A=todo, ←/→=mover ",
   "ConfigLocalePartialBadge": "parcial",
   "ConfigLocalePartialDetail": "Paquete de traducción parcial; los textos sin traducir se muestran en inglés.",
   "ConfigRowEffective": " (efectivo {currency})",
@@ -802,7 +802,7 @@
   "SettingsTuiPrefsQuarantined": "Las claves de tui.toml sin ninguna opción se conservaron en {path}: {keys}",
   "ClearConversation": "Conversación limpia",
   "ClearConversationBusy": "No se borró nada (el estado de Trabajo o la ejecución está ocupada; espera y vuelve a intentar /clear)",
-  "ModelChanged": "Modelo cambiado: {old} →, {new}",
+  "ModelChanged": "El modelo ahora es {new} (antes {old}).",
   "LinksProjectTitle": "Codewhale y comunidad:",
   "LinksDocumentation": "Documentación:",
   "LinksCommunity": "Comunidad y contribuciones:",
@@ -1207,7 +1207,7 @@
   "ApprovalIntentLabel": "Intención: ",
   "ApprovalMoreLines": "  … (+{count} líneas)",
   "ApprovalAutoDeniedSession": "Se rechazó automáticamente {tool}: rechazaste antes una solicitud coincidente en este turno. Envía un mensaje nuevo para que se te vuelva a preguntar.",
-  "ElevationTitleSandboxDenied": "  ⚠, Sandbox Denegado ",
+  "ElevationTitleSandboxDenied": "  ⚠ Sandbox Denegado ",
   "ElevationTitleRequired": " Elevación de Sandbox Requerida ",
   "ElevationFieldTool": "  Herramienta: ",
   "ElevationFieldCmd": "  Comando:  ",
```

**File**: `crates/localization/locales/fr.json` (modified, +3/-3)
```diff
@@ -286,7 +286,7 @@
   "ConfigEditCurrentLabel": "Actuel : ",
   "ConfigEditHintLabel": "Indice : ",
   "ConfigEditNewLabel": "Nouveau : ",
-  "ConfigEditFooter": " Enter=appliquer, Esc=annuler, Ctrl+U=vider, Ctrl+A=tout, ←,/→,=déplacer ",
+  "ConfigEditFooter": " Enter=appliquer, Esc=annuler, Ctrl+U=vider, Ctrl+A=tout, ←/→=déplacer ",
   "ConfigLocalePartialBadge": "partiel",
   "ConfigLocalePartialDetail": "Pack de traduction partiel ; les chaînes manquantes s'affichent en anglais.",
   "ConfigRowEffective": " (effectif {currency})",
@@ -785,7 +785,7 @@
   "SettingsTuiPrefsQuarantined": "Les clés de tui.toml sans réglage correspondant ont été conservées dans {path} : {keys}",
   "ClearConversation": "Conversation effacée",
   "ClearConversationBusy": "Rien n'a été effacé (état Work ou exécution occupée ; patientez, puis réessayez /clear)",
-  "ModelChanged": "Modèle changé : {old} →, {new}",
+  "ModelChanged": "Le modèle est maintenant {new} (avant : {old}).",
   "LinksProjectTitle": "Codewhale et communauté :",
   "LinksDocumentation": "Documentation :",
   "LinksCommunity": "Communauté et contribution :",
@@ -1186,7 +1186,7 @@
   "ApprovalIntentLabel": "Intention : ",
   "ApprovalMoreLines": "  … (+{count} lignes)",
   "ApprovalAutoDeniedSession": "{tool} refusé automatiquement : vous avez déjà refusé une demande correspondante pendant ce tour. Envoyez un nouveau message pour être à nouveau sollicité.",
-  "ElevationTitleSandboxDenied": "  ⚠, Sandbox refusé ",
+  "ElevationTitleSandboxDenied": "  ⚠ Sandbox refusé ",
   "ElevationTitleRequired": " Élévation du sandbox requise ",
   "ElevationFieldTool": "  Outil : ",
   "ElevationFieldCmd": "  Cmde :  ",
```

**File**: `crates/localization/locales/hi.json` (modified, +3/-3)
```diff
@@ -286,7 +286,7 @@
   "ConfigEditCurrentLabel": "वर्तमान: ",
   "ConfigEditHintLabel": "संकेत: ",
   "ConfigEditNewLabel": "नया: ",
-  "ConfigEditFooter": " Enter=लागू करें, Esc=रद्द, Ctrl+U=साफ़, Ctrl+A=सभी, ←,/→,=घुमाएँ ",
+  "ConfigEditFooter": " Enter=लागू करें, Esc=रद्द, Ctrl+U=साफ़, Ctrl+A=सभी, ←/→=घुमाएँ ",
   "ConfigLocalePartialBadge": "आंशिक",
   "ConfigLocalePartialDetail": "आंशिक अनुवाद पैक; अनुपलब्ध स्ट्रिंग English में दिखती हैं।",
   "ConfigRowEffective": " (प्रभावी {currency})",
@@ -785,7 +785,7 @@
   "SettingsTuiPrefsQuarantined": "जिन tui.toml कुंजियों की कोई सेटिंग नहीं है, वे {path} में रखी गई हैं: {keys}",
   "ClearConversation": "वार्तालाप साफ़ किया गया",
   "ClearConversationBusy": "कुछ साफ़ नहीं हुआ (कार्य स्थिति या रनटाइम कार्य व्यस्त है; प्रतीक्षा करें, फिर /clear दोबारा आज़माएँ)",
-  "ModelChanged": "मॉडल बदला गया: {old} →, {new}",
+  "ModelChanged": "मॉडल अब {new} है (पहले {old} था)।",
   "LinksProjectTitle": "Codewhale और समुदाय:",
   "LinksDocumentation": "दस्तावेज़:",
   "LinksCommunity": "समुदाय और योगदान:",
@@ -1186,7 +1186,7 @@
   "ApprovalIntentLabel": "इरादा: ",
   "ApprovalMoreLines": "  … (+{count} पंक्तियाँ)",
   "ApprovalAutoDeniedSession": "स्वतः अस्वीकृत {tool}: आपने इसी टर्न में पहले मिलता-जुलता अनुरोध अस्वीकार किया था। फिर से पूछे जाने के लिए नया संदेश भेजें।",
-  "ElevationTitleSandboxDenied": "  ⚠, सैंडबॉक्स अस्वीकृत ",
+  "ElevationTitleSandboxDenied": "  ⚠ सैंडबॉक्स अस्वीकृत ",
   "ElevationTitleRequired": " सैंडबॉक्स एलिवेशन आवश्यक ",
   "ElevationFieldTool": "  टूल: ",
   "ElevationFieldCmd": "  Cmd:  ",
```

**File**: `crates/localization/locales/id.json` (modified, +1/-1)
```diff
@@ -785,7 +785,7 @@
   "SettingsTuiPrefsQuarantined": "Kunci tui.toml tanpa pengaturan yang cocok disimpan di {path}: {keys}",
   "ClearConversation": "Percakapan dibersihkan",
   "ClearConversationBusy": "Tidak ada yang dibersihkan (status Work atau pekerjaan runtime sibuk; tunggu, lalu coba /clear lagi)",
-  "ModelChanged": "Model diubah: {old} → {new}",
+  "ModelChanged": "Model sekarang {new} (sebelumnya {old}).",
   "LinksProjectTitle": "Codewhale & komunitas:",
   "LinksDocumentation": "Dokumentasi:",
   "LinksCommunity": "Komunitas & kontribusi:",
```

**File**: `crates/localization/locales/ja.json` (modified, +3/-3)
```diff
@@ -286,7 +286,7 @@
   "ConfigEditCurrentLabel": "現在: ",
   "ConfigEditHintLabel": "ヒント: ",
   "ConfigEditNewLabel": "新規: ",
-  "ConfigEditFooter": " Enter=適用, Esc=キャンセル, Ctrl+U=クリア, Ctrl+A=全選択, ←,/→,=移動 ",
+  "ConfigEditFooter": " Enter=適用, Esc=キャンセル, Ctrl+U=クリア, Ctrl+A=全選択, ←/→=移動 ",
   "ConfigLocalePartialBadge": "一部翻訳",
   "ConfigLocalePartialDetail": "一部のみ翻訳された言語パックです。未翻訳の文字列は英語にフォールバックします。",
   "ConfigRowEffective": " (実効 {currency})",
@@ -802,7 +802,7 @@
   "SettingsTuiPrefsQuarantined": "対応する設定がない tui.toml のキーは {path} に保管しました: {keys}",
   "ClearConversation": "会話履歴をクリアしました",
   "ClearConversationBusy": "何もクリアされませんでした（Work 状態またはランタイム処理が実行中です。待ってから /clear を再実行してください）",
-  "ModelChanged": "モデルを変更しました: {old} → {new}",
+  "ModelChanged": "モデルは {new} になりました（以前は {old}）。",
   "LinksProjectTitle": "Codewhale とコミュニティ：",
   "LinksDocumentation": "ドキュメント：",
   "LinksCommunity": "コミュニティとコントリビューション：",
@@ -1207,7 +1207,7 @@
   "ApprovalIntentLabel": "意図：",
   "ApprovalMoreLines": "  … (+{count} 行)",
   "ApprovalAutoDeniedSession": "{tool} を自動的に拒否しました: このターンで一致するリクエストをすでに拒否しています。もう一度確認するには新しいメッセージを送信してください。",
-  "ElevationTitleSandboxDenied": "  ⚠, サンドボックス拒否 ",
+  "ElevationTitleSandboxDenied": "  ⚠ サンドボックス拒否 ",
   "ElevationTitleRequired": " サンドボックス昇格 ",
   "ElevationFieldTool": "  ツール：",
   "ElevationFieldCmd": "  コマンド：",
```

---

### Incident Patch 9: `5d110e82` (2026-10-05)
**Commit Message**: fix(windows): tolerate LPAC EPERM from realpathSync.native on directories

f0080cd2e stopped JS realpathSync from walking to C:\ under LPAC by using
realpathSync.native and comparing canonical-to-canonical. Hosted Windows on
#6846 still failed the six native_mcp activations with
`EPERM: operation not permitted, realpath '...\source'`: admitReviewedClosure
canonicalizes the reviewed source directory, and native realpath opens it with
FILE_FLAG_BACKUP_SEMANTICS, which AppContainers refuse.

On win32 EPERM/EACCES, keep stripVerbatim(normalize(path)) instead of
throwing. Core already refused links while granting that tree. File checks
still prefer native when it succeeds. Bundles rebuilt.

Evidence (Linux box, node 20): node --test test/canonical-path.test.mjs
passes. Windows LPAC proof is hosted Test (windows-latest).

Signed-off-by: CodeWhale Bot <[REDACTED_EMAIL]>

**File**: `crates/tui/extension-host/dist/agent-presets.mjs` (modified, +10/-1)
```diff
@@ -6106,7 +6106,16 @@ var init_skill_filesystem = __esm({
 import { realpathSync } from "node:fs";
 import { posix, win32 } from "node:path";
 function canonicalPath(path, platform = process.platform) {
-  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+  if (platform !== "win32") return realpathSync(path);
+  try {
+    return stripVerbatim(realpathSync.native(path), platform);
+  } catch (error) {
+    const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
+    if (code === "EPERM" || code === "EACCES") {
+      return stripVerbatim(win32.normalize(path), platform);
+    }
+    throw error;
+  }
 }
 function stripVerbatim(path, platform = process.platform) {
   if (platform !== "win32") return path;
```

**File**: `crates/tui/extension-host/dist/codewhale-extension-host.mjs` (modified, +10/-1)
```diff
@@ -6482,7 +6482,16 @@ var init_skill_filesystem = __esm({
 import { realpathSync } from "node:fs";
 import { posix, win32 } from "node:path";
 function canonicalPath(path, platform = process.platform) {
-  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+  if (platform !== "win32") return realpathSync(path);
+  try {
+    return stripVerbatim(realpathSync.native(path), platform);
+  } catch (error) {
+    const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
+    if (code === "EPERM" || code === "EACCES") {
+      return stripVerbatim(win32.normalize(path), platform);
+    }
+    throw error;
+  }
 }
 function stripVerbatim(path, platform = process.platform) {
   if (platform !== "win32") return path;
```

**File**: `crates/tui/extension-host/dist/dsh-composition-review.mjs` (modified, +10/-1)
```diff
@@ -6057,7 +6057,16 @@ var init_skill_filesystem = __esm({
 import { realpathSync } from "node:fs";
 import { posix, win32 } from "node:path";
 function canonicalPath(path, platform = process.platform) {
-  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+  if (platform !== "win32") return realpathSync(path);
+  try {
+    return stripVerbatim(realpathSync.native(path), platform);
+  } catch (error) {
+    const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
+    if (code === "EPERM" || code === "EACCES") {
+      return stripVerbatim(win32.normalize(path), platform);
+    }
+    throw error;
+  }
 }
 function stripVerbatim(path, platform = process.platform) {
   if (platform !== "win32") return path;
```

**File**: `crates/tui/extension-host/dist/shell-hooks.mjs` (modified, +10/-1)
```diff
@@ -7,7 +7,16 @@ import { resolve, relative, isAbsolute, sep } from "node:path";
 import { realpathSync } from "node:fs";
 import { posix, win32 } from "node:path";
 function canonicalPath(path, platform = process.platform) {
-  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+  if (platform !== "win32") return realpathSync(path);
+  try {
+    return stripVerbatim(realpathSync.native(path), platform);
+  } catch (error) {
+    const code = error && typeof error === "object" && "code" in error ? error.code : void 0;
+    if (code === "EPERM" || code === "EACCES") {
+      return stripVerbatim(win32.normalize(path), platform);
+    }
+    throw error;
+  }
 }
 function stripVerbatim(path, platform = process.platform) {
   if (platform !== "win32") return path;
```

**File**: `crates/tui/extension-host/src/dsh/canonical-path.ts` (modified, +20/-1)
```diff
@@ -10,6 +10,13 @@
  * never compared with a raw one. Both sides go through `canonicalPath`, then
  * `pathKey`, and containment is `relative(canonical root, canonical target)`.
  *
+ * Under LPAC, `realpathSync.native` still fails with EPERM on some paths —
+ * especially directories such as the reviewed `source/` root — because the
+ * open uses FILE_FLAG_BACKUP_SEMANTICS. Core already refused links while
+ * granting that tree, so on EPERM/EACCES we keep a stable stripped spelling
+ * instead of throwing and aborting admitReviewedClosure. Link refusal for
+ * files still goes through the same helper when native succeeds.
+ *
  * Elsewhere `realpathSync` is unchanged.
  */
 import { realpathSync } from 'node:fs'
@@ -18,7 +25,19 @@ import { posix, win32 } from 'node:path'
 type Platform = NodeJS.Platform
 
 export function canonicalPath(path: string, platform: Platform = process.platform): string {
-  return stripVerbatim(platform === 'win32' ? realpathSync.native(path) : realpathSync(path), platform)
+  if (platform !== 'win32') return realpathSync(path)
+  try {
+    return stripVerbatim(realpathSync.native(path), platform)
+  } catch (error) {
+    const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: string }).code : undefined
+    // LPAC cannot open some granted paths the way native realpath requires
+    // (notably directories). Fall back to a stable spelling; Core's grant
+    // already refused links/reparse points in the admitted tree.
+    if (code === 'EPERM' || code === 'EACCES') {
+      return stripVerbatim(win32.normalize(path), platform)
+    }
+    throw error
+  }
 }
 
 /** Drop the Win32 verbatim prefix: `\\?\C:\x` → `C:\x`, `\\?\UNC\h\s` → `\\h\s`. Case is kept. */
```

---

### Incident Patch 10: `6958ca6d` (2026-10-05)
**Commit Message**: fix(windows): compare reviewed plugin paths canonical-to-canonical under LPAC

Hosted Windows (LPAC) refuses lstat on the drive root, so Node's JS
realpathSync — which walks every ancestor — failed the reviewed-closure
checks with EPERM lstat 'C:\' (13 failures on #6815, mostly
extension_host::native_mcp and raw_agent_presets). The earlier attempt
(4e1905b66, reverted) used realpathSync.native but compared its spelling
against raw input.

New src/dsh/canonical-path.ts is the one comparison rule: canonicalize
with realpathSync.native on win32 (GetFinalPathNameByHandle, no ancestor
walk) and realpathSync elsewhere, strip \\?\ and \\?\UNC\, compare
case-insensitively on win32, and express containment as
relative(canonical root, canonical target). A canonical path is never
compared to a raw one. resolve-hooks keys closures by canonical root and
remembers the raw root; the Node load hook now also refuses symlinked
closure modules (under --preserve-symlinks an in-closure symlink pointing
outside kept its in-closure URL and loaded — reproduced on HEAD).

Evidence (macOS): npm --prefix crates/tui/extension-host test: 406 tests,
399 pass, 0 fail, 7 skipped (new canonical-path test passes);


**File**: `crates/tui/extension-host/dist/agent-presets.mjs` (modified, +85/-26)
```diff
@@ -6102,6 +6102,52 @@ var init_skill_filesystem = __esm({
   }
 });
 
+// src/dsh/canonical-path.ts
+import { realpathSync } from "node:fs";
+import { posix, win32 } from "node:path";
+function canonicalPath(path, platform = process.platform) {
+  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+}
+function stripVerbatim(path, platform = process.platform) {
+  if (platform !== "win32") return path;
+  if (/^[\\/]{2}\?[\\/]UNC[\\/]/i.test(path)) return `\\\\${path.slice(8)}`;
+  if (/^[\\/]{2}\?[\\/]/.test(path)) return path.slice(4);
+  return path;
+}
+function pathKey(path, platform = process.platform) {
+  if (platform !== "win32") return posix.normalize(path);
+  return win32.normalize(stripVerbatim(path, platform)).toLowerCase();
+}
+function samePath(a, b, platform = process.platform) {
+  return pathKey(a, platform) === pathKey(b, platform);
+}
+function insideKey(root, target, platform = process.platform) {
+  const path = platform === "win32" ? win32 : posix;
+  const inside = path.relative(stripVerbatim(root, platform), stripVerbatim(target, platform));
+  if (inside === ".." || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) return void 0;
+  return platform === "win32" ? inside.split(win32.sep).join("/") : inside;
+}
+function isUnlinkedInside(root, key, target, platform = process.platform) {
+  let canonicalRoot, canonicalTarget;
+  try {
+    canonicalRoot = canonicalPath(root, platform);
+    canonicalTarget = canonicalPath(target, platform);
+  } catch {
+    return false;
+  }
+  return unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform);
+}
+function unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform = process.platform) {
+  if (!key || key.split("/").some((part) => !part || part === "." || part === "..")) return false;
+  const path = platform === "win32" ? win32 : posix;
+  return samePath(path.join(stripVerbatim(canonicalRoot, platform), ...key.split("/")), canonicalTarget, platform);
+}
+var init_canonical_path = __esm({
+  "src/dsh/canonical-path.ts"() {
+    "use strict";
+  }
+});
+
 // src/dsh/upstream/hooks/hook-protocol/src/matcher.ts
 function isMatchAll(matcher) {
   return matcher === void 0 || matcher === "" || matcher === "*";
@@ -6250,14 +6296,14 @@ var init_config2 = __esm({
 
 // src/dsh/shell-hooks.ts
 import { createHash } from "node:crypto";
-import { readFileSync, realpathSync, lstatSync } from "node:fs";
+import { readFileSync, lstatSync } from "node:fs";
 import { resolve, relative, isAbsolute, sep } from "node:path";
 function reviewedHookModule(dialect, root, files) {
   return { name: `hooks-${dialect}`, inject: ["shellHooks"], apply(ctx, config) {
     if (!config || typeof config.configPath !== "string") throw new Error("hook bridge needs its reviewed configPath");
     const path = resolve(root, config.configPath);
     const inside = relative(root, path).split(sep).join("/");
-    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || realpathSync(path) !== path || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
+    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || !isUnlinkedInside(root, inside, path) || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
     const bytes = readFileSync(path);
     if (bytes.length > 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== files[inside]) throw new Error("hook config changed after review or exceeds 1 MiB");
     if (config.projectDir !== void 0) throw new Error("explicit projectDir is unsupported; each process uses its current core workspace");
@@ -6282,6 +6328,8 @@ var EVENTS;
 var init_shell_hooks = __esm({
   "src/dsh/shell-hooks.ts"() {
     "use strict";
+    init_canonical_path();
+    init_canonical_path();
     init_config();
     init_config2();
     EVENTS = { SessionStart: "session_start", UserPromptSubmit: "message_submit", PreToolUse: "tool_call_before", PostToolUse: "tool_call_after", Stop: "turn_end", SubagentStart: "subagent_spawn", SubagentStop: "subagent_complete" };
@@ -12005,52 +12053,63 @@ var init_bun_closure = __esm({
 
 // src/dsh/resolve-hooks.ts
 import { fileURLToPath as fileURLToPath2, pathToFileURL as pathToFileURL2 } from "node:url";
-import { relative as relative2, resolve as resolve2, sep as sep2, isAbsolute as isAbsolute2, dirname } from "node:path";
-import { readFileSync as readFileSync2, realpathSync as realpathSync2 } from "node:fs";
+import { resolve as resolve2, isAbsolute as isAbsolute2, dirname } from "node:path";
+function keyIn(closure, path) {
+  const canonical = insideKey(closure.canonicalRoot, path);
+  if (canonical !== void 0) return canonical;
+  for (const root of closure.rawRoots) {
+    const raw = insideKey(root, path);
+    if (raw !== void 0) return raw;
+  }
+}
 function
```

**File**: `crates/tui/extension-host/dist/codewhale-extension-host.mjs` (modified, +96/-25)
```diff
@@ -6478,6 +6478,53 @@ var init_skill_filesystem = __esm({
   }
 });
 
+// src/dsh/canonical-path.ts
+import { realpathSync } from "node:fs";
+import { posix, win32 } from "node:path";
+function canonicalPath(path, platform = process.platform) {
+  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+}
+function stripVerbatim(path, platform = process.platform) {
+  if (platform !== "win32") return path;
+  if (/^[\\/]{2}\?[\\/]UNC[\\/]/i.test(path)) return `\\\\${path.slice(8)}`;
+  if (/^[\\/]{2}\?[\\/]/.test(path)) return path.slice(4);
+  return path;
+}
+function pathKey(path, platform = process.platform) {
+  if (platform !== "win32") return posix.normalize(path);
+  return win32.normalize(stripVerbatim(path, platform)).toLowerCase();
+}
+function samePath(a, b, platform = process.platform) {
+  return pathKey(a, platform) === pathKey(b, platform);
+}
+function insideKey(root, target, platform = process.platform) {
+  const path = platform === "win32" ? win32 : posix;
+  const inside = path.relative(stripVerbatim(root, platform), stripVerbatim(target, platform));
+  if (inside === ".." || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) return void 0;
+  return platform === "win32" ? inside.split(win32.sep).join("/") : inside;
+}
+function isUnlinkedInside(root, key, target, platform = process.platform) {
+  let canonicalRoot, canonicalTarget;
+  try {
+    canonicalRoot = canonicalPath(root, platform);
+    canonicalTarget = canonicalPath(target, platform);
+  } catch {
+    return false;
+  }
+  return unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform);
+}
+function unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform = process.platform) {
+  if (!key || key.split("/").some((part) => !part || part === "." || part === "..")) return false;
+  const path = platform === "win32" ? win32 : posix;
+  return samePath(path.join(stripVerbatim(canonicalRoot, platform), ...key.split("/")), canonicalTarget, platform);
+}
+var init_canonical_path = __esm({
+  "src/dsh/canonical-path.ts"() {
+    "use strict";
+    init_define_BUILTIN_MODULE_DIGESTS();
+  }
+});
+
 // src/dsh/upstream/hooks/hook-protocol/src/matcher.ts
 function isMatchAll(matcher) {
   return matcher === void 0 || matcher === "" || matcher === "*";
@@ -6629,14 +6676,14 @@ var init_config2 = __esm({
 
 // src/dsh/shell-hooks.ts
 import { createHash } from "node:crypto";
-import { readFileSync, realpathSync, lstatSync } from "node:fs";
+import { readFileSync, lstatSync } from "node:fs";
 import { resolve as resolve2, relative, isAbsolute, sep } from "node:path";
 function reviewedHookModule(dialect, root, files) {
   return { name: `hooks-${dialect}`, inject: ["shellHooks"], apply(ctx, config) {
     if (!config || typeof config.configPath !== "string") throw new Error("hook bridge needs its reviewed configPath");
     const path = resolve2(root, config.configPath);
     const inside = relative(root, path).split(sep).join("/");
-    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || realpathSync(path) !== path || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
+    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || !isUnlinkedInside(root, inside, path) || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
     const bytes = readFileSync(path);
     if (bytes.length > 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== files[inside]) throw new Error("hook config changed after review or exceeds 1 MiB");
     if (config.projectDir !== void 0) throw new Error("explicit projectDir is unsupported; each process uses its current core workspace");
@@ -6662,6 +6709,8 @@ var init_shell_hooks = __esm({
   "src/dsh/shell-hooks.ts"() {
     "use strict";
     init_define_BUILTIN_MODULE_DIGESTS();
+    init_canonical_path();
+    init_canonical_path();
     init_config();
     init_config2();
     EVENTS = { SessionStart: "session_start", UserPromptSubmit: "message_submit", PreToolUse: "tool_call_before", PostToolUse: "tool_call_after", Stop: "turn_end", SubagentStart: "subagent_spawn", SubagentStop: "subagent_complete" };
@@ -12631,8 +12680,8 @@ var init_bun_closure = __esm({
 import * as nodeModule2 from "node:module";
 import { createHash as createHash2 } from "node:crypto";
 import { fileURLToPath as fileURLToPath2, pathToFileURL as pathToFileURL3 } from "node:url";
-import { relative as relative2, resolve as resolve3, sep as sep2, isAbsolute as isAbsolute2, dirname } from "node:path";
-import { readFileSync as readFileSync2, realpathSync as realpathSync2 } from "node:fs";
+import { resolve as resolve3, isAbsolute as isAbsolute2, dirname } from "node:path";
+import { readFileSync as readFileSync2 } from "node:fs";
 function packageName(specifier) {
   const parts = specifier.s
```

**File**: `crates/tui/extension-host/dist/dsh-composition-review.mjs` (modified, +85/-26)
```diff
@@ -6053,6 +6053,52 @@ var init_skill_filesystem = __esm({
   }
 });
 
+// src/dsh/canonical-path.ts
+import { realpathSync } from "node:fs";
+import { posix, win32 } from "node:path";
+function canonicalPath(path, platform = process.platform) {
+  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+}
+function stripVerbatim(path, platform = process.platform) {
+  if (platform !== "win32") return path;
+  if (/^[\\/]{2}\?[\\/]UNC[\\/]/i.test(path)) return `\\\\${path.slice(8)}`;
+  if (/^[\\/]{2}\?[\\/]/.test(path)) return path.slice(4);
+  return path;
+}
+function pathKey(path, platform = process.platform) {
+  if (platform !== "win32") return posix.normalize(path);
+  return win32.normalize(stripVerbatim(path, platform)).toLowerCase();
+}
+function samePath(a, b, platform = process.platform) {
+  return pathKey(a, platform) === pathKey(b, platform);
+}
+function insideKey(root, target, platform = process.platform) {
+  const path = platform === "win32" ? win32 : posix;
+  const inside = path.relative(stripVerbatim(root, platform), stripVerbatim(target, platform));
+  if (inside === ".." || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) return void 0;
+  return platform === "win32" ? inside.split(win32.sep).join("/") : inside;
+}
+function isUnlinkedInside(root, key, target, platform = process.platform) {
+  let canonicalRoot, canonicalTarget;
+  try {
+    canonicalRoot = canonicalPath(root, platform);
+    canonicalTarget = canonicalPath(target, platform);
+  } catch {
+    return false;
+  }
+  return unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform);
+}
+function unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform = process.platform) {
+  if (!key || key.split("/").some((part) => !part || part === "." || part === "..")) return false;
+  const path = platform === "win32" ? win32 : posix;
+  return samePath(path.join(stripVerbatim(canonicalRoot, platform), ...key.split("/")), canonicalTarget, platform);
+}
+var init_canonical_path = __esm({
+  "src/dsh/canonical-path.ts"() {
+    "use strict";
+  }
+});
+
 // src/dsh/upstream/hooks/hook-protocol/src/matcher.ts
 function isMatchAll(matcher) {
   return matcher === void 0 || matcher === "" || matcher === "*";
@@ -6201,14 +6247,14 @@ var init_config2 = __esm({
 
 // src/dsh/shell-hooks.ts
 import { createHash } from "node:crypto";
-import { readFileSync, realpathSync, lstatSync } from "node:fs";
+import { readFileSync, lstatSync } from "node:fs";
 import { resolve, relative, isAbsolute, sep } from "node:path";
 function reviewedHookModule(dialect, root, files) {
   return { name: `hooks-${dialect}`, inject: ["shellHooks"], apply(ctx, config) {
     if (!config || typeof config.configPath !== "string") throw new Error("hook bridge needs its reviewed configPath");
     const path = resolve(root, config.configPath);
     const inside = relative(root, path).split(sep).join("/");
-    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || realpathSync(path) !== path || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
+    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || !isUnlinkedInside(root, inside, path) || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
     const bytes = readFileSync(path);
     if (bytes.length > 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== files[inside]) throw new Error("hook config changed after review or exceeds 1 MiB");
     if (config.projectDir !== void 0) throw new Error("explicit projectDir is unsupported; each process uses its current core workspace");
@@ -6233,6 +6279,8 @@ var EVENTS;
 var init_shell_hooks = __esm({
   "src/dsh/shell-hooks.ts"() {
     "use strict";
+    init_canonical_path();
+    init_canonical_path();
     init_config();
     init_config2();
     EVENTS = { SessionStart: "session_start", UserPromptSubmit: "message_submit", PreToolUse: "tool_call_before", PostToolUse: "tool_call_after", Stop: "turn_end", SubagentStart: "subagent_spawn", SubagentStop: "subagent_complete" };
@@ -11956,52 +12004,63 @@ var init_bun_closure = __esm({
 
 // src/dsh/resolve-hooks.ts
 import { fileURLToPath as fileURLToPath2, pathToFileURL as pathToFileURL2 } from "node:url";
-import { relative as relative2, resolve as resolve2, sep as sep2, isAbsolute as isAbsolute2, dirname } from "node:path";
-import { readFileSync as readFileSync2, realpathSync as realpathSync2 } from "node:fs";
+import { resolve as resolve2, isAbsolute as isAbsolute2, dirname } from "node:path";
+function keyIn(closure, path) {
+  const canonical = insideKey(closure.canonicalRoot, path);
+  if (canonical !== void 0) return canonical;
+  for (const root of closure.rawRoots) {
+    const raw = insideKey(root, path);
+    if (raw !== void 0) return raw;
+  }
+}
 function
```

**File**: `crates/tui/extension-host/dist/shell-hooks.mjs` (modified, +49/-3)
```diff
@@ -1,8 +1,49 @@
 // src/dsh/shell-hooks.ts
 import { createHash } from "node:crypto";
-import { readFileSync, realpathSync, lstatSync } from "node:fs";
+import { readFileSync, lstatSync } from "node:fs";
 import { resolve, relative, isAbsolute, sep } from "node:path";
 
+// src/dsh/canonical-path.ts
+import { realpathSync } from "node:fs";
+import { posix, win32 } from "node:path";
+function canonicalPath(path, platform = process.platform) {
+  return stripVerbatim(platform === "win32" ? realpathSync.native(path) : realpathSync(path), platform);
+}
+function stripVerbatim(path, platform = process.platform) {
+  if (platform !== "win32") return path;
+  if (/^[\\/]{2}\?[\\/]UNC[\\/]/i.test(path)) return `\\\\${path.slice(8)}`;
+  if (/^[\\/]{2}\?[\\/]/.test(path)) return path.slice(4);
+  return path;
+}
+function pathKey(path, platform = process.platform) {
+  if (platform !== "win32") return posix.normalize(path);
+  return win32.normalize(stripVerbatim(path, platform)).toLowerCase();
+}
+function samePath(a, b, platform = process.platform) {
+  return pathKey(a, platform) === pathKey(b, platform);
+}
+function insideKey(root, target, platform = process.platform) {
+  const path = platform === "win32" ? win32 : posix;
+  const inside = path.relative(stripVerbatim(root, platform), stripVerbatim(target, platform));
+  if (inside === ".." || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) return void 0;
+  return platform === "win32" ? inside.split(win32.sep).join("/") : inside;
+}
+function isUnlinkedInside(root, key, target, platform = process.platform) {
+  let canonicalRoot, canonicalTarget;
+  try {
+    canonicalRoot = canonicalPath(root, platform);
+    canonicalTarget = canonicalPath(target, platform);
+  } catch {
+    return false;
+  }
+  return unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform);
+}
+function unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform = process.platform) {
+  if (!key || key.split("/").some((part) => !part || part === "." || part === "..")) return false;
+  const path = platform === "win32" ? win32 : posix;
+  return samePath(path.join(stripVerbatim(canonicalRoot, platform), ...key.split("/")), canonicalTarget, platform);
+}
+
 // src/dsh/upstream/hooks/hook-protocol/src/matcher.ts
 function isMatchAll(matcher) {
   return matcher === void 0 || matcher === "" || matcher === "*";
@@ -136,7 +177,7 @@ function reviewedHookModule(dialect, root, files) {
     if (!config || typeof config.configPath !== "string") throw new Error("hook bridge needs its reviewed configPath");
     const path = resolve(root, config.configPath);
     const inside = relative(root, path).split(sep).join("/");
-    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || realpathSync(path) !== path || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
+    if (!inside || inside.startsWith("../") || isAbsolute(inside) || !files[inside] || !isUnlinkedInside(root, inside, path) || !lstatSync(path).isFile()) throw new Error("hook config is absent from the reviewed regular-file closure");
     const bytes = readFileSync(path);
     if (bytes.length > 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== files[inside]) throw new Error("hook config changed after review or exceeds 1 MiB");
     if (config.projectDir !== void 0) throw new Error("explicit projectDir is unsupported; each process uses its current core workspace");
@@ -158,5 +199,10 @@ function reviewedHookModule(dialect, root, files) {
   } };
 }
 export {
-  reviewedHookModule
+  insideKey,
+  pathKey,
+  reviewedHookModule,
+  samePath,
+  stripVerbatim,
+  unlinkedKeyMatches
 };
```

**File**: `crates/tui/extension-host/src/dsh/canonical-path.ts` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+/**
+ * One canonical-path rule for the reviewed-closure checks.
+ *
+ * Windows: JS `realpathSync` lstats every ancestor starting at the drive root,
+ * and a Windows LPAC (AppContainer) host cannot read `C:\` (EPERM).
+ * `realpathSync.native` asks the OS for the opened file's final path
+ * (GetFinalPathNameByHandle) and needs access to that file alone. Its spelling
+ * differs from the caller's: a `\\?\` prefix, long names in place of 8.3 short
+ * names (`RUNNER~1`), drive-letter and on-disk case. So a canonical path is
+ * never compared with a raw one. Both sides go through `canonicalPath`, then
+ * `pathKey`, and containment is `relative(canonical root, canonical target)`.
+ *
+ * Elsewhere `realpathSync` is unchanged.
+ */
+import { realpathSync } from 'node:fs'
+import { posix, win32 } from 'node:path'
+
+type Platform = NodeJS.Platform
+
+export function canonicalPath(path: string, platform: Platform = process.platform): string {
+  return stripVerbatim(platform === 'win32' ? realpathSync.native(path) : realpathSync(path), platform)
+}
+
+/** Drop the Win32 verbatim prefix: `\\?\C:\x` → `C:\x`, `\\?\UNC\h\s` → `\\h\s`. Case is kept. */
+export function stripVerbatim(path: string, platform: Platform = process.platform): string {
+  if (platform !== 'win32') return path
+  if (/^[\\/]{2}\?[\\/]UNC[\\/]/i.test(path)) return `\\\\${path.slice(8)}`
+  if (/^[\\/]{2}\?[\\/]/.test(path)) return path.slice(4)
+  return path
+}
+
+/** The identity used for equality: normalized and, on Windows, case-folded. Never joined or displayed. */
+export function pathKey(path: string, platform: Platform = process.platform): string {
+  if (platform !== 'win32') return posix.normalize(path)
+  return win32.normalize(stripVerbatim(path, platform)).toLowerCase()
+}
+
+export function samePath(a: string, b: string, platform: Platform = process.platform): boolean {
+  return pathKey(a, platform) === pathKey(b, platform)
+}
+
+/**
+ * The `/`-separated path of `target` inside `root`, or `undefined` when it is
+ * outside. Both arguments must be spelled the same way (both raw, or both
+ * from `canonicalPath`). `''` is the root itself, which is never a file key.
+ * Win32 `relative` compares case-insensitively and keeps `target`'s case.
+ */
+export function insideKey(root: string, target: string, platform: Platform = process.platform): string | undefined {
+  const path = platform === 'win32' ? win32 : posix
+  const inside = path.relative(stripVerbatim(root, platform), stripVerbatim(target, platform))
+  if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) return undefined
+  return platform === 'win32' ? inside.split(win32.sep).join('/') : inside
+}
+
+/**
+ * True when `target` names `root/key` with no symbolic link (or junction)
+ * inside the root: its canonical path is the canonical root joined with the
+ * reviewed key. Links above the root are the root's own location and are
+ * absorbed by canonicalizing it. A missing or unreadable target is false.
+ */
+export function isUnlinkedInside(root: string, key: string, target: string, platform: Platform = process.platform): boolean {
+  let canonicalRoot: string, canonicalTarget: string
+  try {
+    canonicalRoot = canonicalPath(root, platform)
+    canonicalTarget = canonicalPath(target, platform)
+  } catch {
+    return false
+  }
+  return unlinkedKeyMatches(canonicalRoot, key, canonicalTarget, platform)
+}
+
+/** Pure half of `isUnlinkedInside`, over already-canonical paths. */
+export function unlinkedKeyMatches(canonicalRoot: string, key: string, canonicalTarget: string, platform: Platform = process.platform): boolean {
+  if (!key || key.split('/').some((part) => !part || part === '.' || part === '..')) return false
+  const path = platform === 'win32' ? win32 : posix
+  return samePath(path.join(stripVerbatim(canonicalRoot, platform), ...key.split('/')), canonicalTarget, platform)
+}
```

**File**: `crates/tui/extension-host/src/dsh/resolve-hooks.ts` (modified, +49/-20)
```diff
@@ -19,8 +19,9 @@
 import * as nodeModule from 'node:module'
 import {createHash} from 'node:crypto'
 import {fileURLToPath,pathToFileURL} from 'node:url'
-import {relative,resolve,sep,isAbsolute,dirname} from 'node:path'
-import {readFileSync,realpathSync} from 'node:fs'
+import {resolve,isAbsolute,dirname} from 'node:path'
+import {readFileSync} from 'node:fs'
+import { canonicalPath, insideKey, pathKey, unlinkedKeyMatches } from './canonical-path.ts'
 import { RUNTIME } from '../runtime.ts'
 import { prepareBunSource, REVIEWED_IMPORT } from './bun-closure.ts'
 
@@ -124,7 +125,7 @@ function installBunResolver(modules: Record<string, Record<string, unknown>>) {
     const name=String(specifier)
     const closure=closureAt(caller)
     if(!closure)throw new Error('composition module closure is no longer admitted')
-    const target=checkedBunSpecifier(name,closure.root,closure.receipt.files,caller,false)
+    const target=checkedBunSpecifier(name,closure.receipt,caller,false)
     const singleton=classifySpecifier(target)
     if(singleton!==null)return modules[singleton]
     return import(target,options as any)
@@ -152,22 +153,22 @@ function installBunResolver(modules: Record<string, Record<string, unknown>>) {
               :extension==='jsx' || extension==='js'?'jsx':'js'
           return {contents:readFileSync(args.path,'utf8'),loader}
         }
-        if(!(closure.path in closure.receipt.files) || realpathSync(args.path)!==args.path)throw new Error('module was absent from reviewed composition closure or contains a symbolic link')
+        if(!(closure.path in closure.receipt.files) || !unlinkedInside(closure.receipt,closure.path,args.path))throw new Error('module was absent from reviewed composition closure or contains a symbolic link')
         const bytes=readFileSync(args.path)
         if(bytes.length>64*1024*1024 || createHash('sha256').update(bytes).digest('hex')!==closure.receipt.files[closure.path])throw new Error('composition module bytes changed after review')
         // Bun 1.4 runtime onLoad treats its JSON loader as JS. Preserve exact
         // JSON semantics (including __proto__ data keys) via a JS data module.
         if(closure.path.endsWith('.json'))return {contents:`export default JSON.parse(${JSON.stringify(bytes.toString('utf8'))});`,loader:'js'}
         let source:string
-        try {source=prepareBunSource(bytes.toString('utf8'),args.path,(specifier,require)=>checkedBunSpecifier(specifier,closure.root,closure.receipt.files,pathToFileURL(args.path).href,require))}
+        try {source=prepareBunSource(bytes.toString('utf8'),args.path,(specifier,require)=>checkedBunSpecifier(specifier,closure.receipt,pathToFileURL(args.path).href,require))}
         catch(error){if(error instanceof SyntaxError)throw new Error('reviewed composition module has unsupported JavaScript syntax');throw error}
         return {contents:source,loader:'js'}
       })
     },
   })
 }
 
-function checkedBunSpecifier(specifier:string,root:string,files:Readonly<Record<string,string>>,caller:string,require:boolean):string {
+function checkedBunSpecifier(specifier:string,closure:ReviewedClosure,caller:string,require:boolean):string {
   const key=classifySpecifier(specifier)
   if(key!==null) {
     if(!(key in (globalThis as any)[REGISTRY_KEY]))throw new UnsupportedPeerError(specifier)
@@ -179,49 +180,74 @@ function checkedBunSpecifier(specifier:string,root:string,files:Readonly<Record<
   const path=file?(require && !specifier.startsWith('file:')?resolve(dirname(fileURLToPath(caller)),specifier):resolve(fileURLToPath(file))):undefined
   if(!path)throw new Error('bare dependency is absent from this reviewed composition; package its reviewed relative source')
   if(file?.search || file?.hash)throw new Error('Bun does not preserve reviewed module query or fragment identity; select [extension_host] runtime = \"node\" for this composition')
-  const inside=relative(root,path).split(sep).join('/')
-  if(inside==='..' || inside.startsWith('../') || isAbsolute(inside) || !(inside in files))throw new Error('composition import escapes the reviewed file closure')
+  const inside=keyIn(closure,path)
+  if(inside===undefined || !(inside in closure.files))throw new Error('composition import escapes the reviewed file closure')
   return require?path:file!.href
 }
 
 // Module graph admission for an already-reviewed composition. This is an
 // ephemeral resolver index over the existing tree's file receipt, not an owner,
 // session or plugin state store. Native JS remains arbitrary co-resident code.
-const reviewedClosures=new Map<string,{files:Readonly<Record<string,string>>,refs:number}>()
+//
+// Keyed by the canonical root's `pathKey`. A module path is matched lexically
+// against the canonical root or a raw root it was admitted under — never a raw
+// spelling against a canonical one (see canonical-path.ts): on Windows the two
+// differ in prefix, 8.3 names and case for the very same directory.
+interface R
```

**File**: `crates/tui/extension-host/src/dsh/shell-hooks.ts` (modified, +5/-2)
```diff
@@ -1,15 +1,18 @@
 /** Pinned configuration/matcher semantics adapted onto the existing core hook catalog. No agent/session runtime. */
 import { createHash } from 'node:crypto'
-import { readFileSync,realpathSync,lstatSync } from 'node:fs'
+import { readFileSync,lstatSync } from 'node:fs'
 import { resolve,relative,isAbsolute,sep } from 'node:path'
+import { isUnlinkedInside } from './canonical-path.ts'
+// Re-exported for the pure path-normalization unit test (test/canonical-path.test.mjs).
+export { insideKey, pathKey, samePath, stripVerbatim, unlinkedKeyMatches } from './canonical-path.ts'
 import { parseClaudeCodeConfig } from './upstream/hooks/hooks-claude-code/src/config.ts'
 import { parseCodexConfig } from './upstream/hooks/hooks-codex/src/config.ts'
 const EVENTS:Record<string,string>={SessionStart:'session_start',UserPromptSubmit:'message_submit',PreToolUse:'tool_call_before',PostToolUse:'tool_call_after',Stop:'turn_end',SubagentStart:'subagent_spawn',SubagentStop:'subagent_complete'}
 export function reviewedHookModule(dialect:'claude-code'|'codex',root:string,files:Readonly<Record<string,string>>) {
  return {name:`hooks-${dialect}`,inject:['shellHooks'],apply(ctx:any,config:any) {
   if(!config || typeof config.configPath!=='string')throw new Error('hook bridge needs its reviewed configPath')
   const path=resolve(root,config.configPath);const inside=relative(root,path).split(sep).join('/')
-  if(!inside || inside.startsWith('../') || isAbsolute(inside) || !files[inside] || realpathSync(path)!==path || !lstatSync(path).isFile())throw new Error('hook config is absent from the reviewed regular-file closure')
+  if(!inside || inside.startsWith('../') || isAbsolute(inside) || !files[inside] || !isUnlinkedInside(root,inside,path) || !lstatSync(path).isFile())throw new Error('hook config is absent from the reviewed regular-file closure')
   const bytes=readFileSync(path)
   if(bytes.length>1024*1024 || createHash('sha256').update(bytes).digest('hex')!==files[inside])throw new Error('hook config changed after review or exceeds 1 MiB')
   // The only substitutions are the sealed bundle and current per-call core workspace.
```

**File**: `crates/tui/extension-host/test/canonical-path.test.mjs` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import {insideKey,pathKey,samePath,stripVerbatim,unlinkedKeyMatches} from '../dist/shell-hooks.mjs'
+
+// Pure string normalization: runs on every OS by naming the platform.
+test('win32 canonical compare ignores the verbatim prefix and case, never the path itself',()=>{
+  assert.equal(stripVerbatim('\\\\?\\C:\\Users\\runneradmin\\x','win32'),'C:\\Users\\runneradmin\\x')
+  assert.equal(stripVerbatim('\\\\?\\UNC\\host\\share\\x','win32'),'\\\\host\\share\\x')
+  assert.ok(samePath('\\\\?\\C:\\Users\\RunnerAdmin\\Bundle\\hooks.json','c:\\users\\runneradmin\\bundle\\hooks.json','win32'))
+  assert.equal(pathKey('\\\\?\\C:\\A\\B','win32'),pathKey('c:\\a\\b','win32'))
+  assert.ok(!samePath('C:\\a\\b','C:\\a\\c','win32'))
+  // Case folds only on win32.
+  assert.ok(!samePath('/a/B','/a/b','linux'))
+  // Containment against a differently spelled canonical root keeps the target's case.
+  assert.equal(insideKey('\\\\?\\C:\\Users\\RUNNERADMIN\\bundle','c:\\users\\runneradmin\\bundle\\Mod\\a.js','win32'),'Mod/a.js')
+  assert.equal(insideKey('C:\\bundle','C:\\bundle-evil\\a.js','win32'),undefined)
+  assert.equal(insideKey('C:\\bundle','D:\\bundle\\a.js','win32'),undefined)
+  assert.equal(insideKey('/r','/r/../x','linux'),undefined)
+  // A file is unlinked when its canonical path is the canonical root joined with its reviewed key.
+  assert.ok(unlinkedKeyMatches('\\\\?\\C:\\Users\\runneradmin\\bundle','hooks.json','C:\\USERS\\RunnerAdmin\\Bundle\\HOOKS.JSON','win32'))
+  assert.ok(!unlinkedKeyMatches('C:\\bundle','link.json','C:\\bundle\\hooks.json','win32'))
+  assert.ok(!unlinkedKeyMatches('C:\\bundle','../x.json','C:\\x.json','win32'))
+  assert.ok(!unlinkedKeyMatches('/r','link.json','/r/hooks.json','linux'))
+})
```

---

### Incident Patch 11: `f180a763` (2026-10-05)
**Commit Message**: fix(app-server): bound chat-completions proxy requests in time

The `/v1/chat/completions` handler built its upstream client from the
shared platform builder, which sets no timeouts. The handler rejects
streaming and reads the full upstream body, so a provider that accepts
the connection and then stalls — or trickles the body — wedged the
handler, and with it the caller's connection, indefinitely.

Bound the forward with a 10s connect budget (matching the connect bound
used by the TUI client's vision requests and key verification) and a
1800s total budget (matching the TUI client's non-streaming envelope
for the same request class). A unit test pins both values and their
ordering; reqwest exposes no accessor for a built client's budgets, so
exercising the stall path behaviorally would need a deliberately wedged
upstream and a multi-second to half-hour wait, which the test comment
states.

Known follow-up: the runtime-bridge client in `crates/app-server/src/lib.rs`
remains unbounded; that is a separate surface.

Signed-off-by: asto <[REDACTED_EMAIL]>

**File**: `crates/app-server/src/chat_completions.rs` (modified, +43/-1)
```diff
@@ -28,6 +28,21 @@ use serde_json::Value;
 
 use super::AppState;
 
+// ── Upstream deadlines ─────────────────────────────────────────────────
+
+/// Connect budget for the upstream forward. Matches the 10s connect bound
+/// used by the TUI client's non-streaming requests (vision, the shared
+/// retry client).
+const UPSTREAM_CONNECT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
+
+/// Total budget for one upstream forward, connect through body end. The
+/// handler rejects streaming (`stream: true`) and reads the full upstream
+/// body, so without a client-level total a provider that accepts the
+/// connection and stalls — or trickles the body — wedges this handler (and
+/// the caller's connection) indefinitely. 1800s mirrors the TUI client's
+/// non-streaming envelope for the same request class.
+const UPSTREAM_TOTAL_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(1800);
+
 // ── Resolved endpoint ──────────────────────────────────────────────────
 
 /// Everything needed to forward a single chat-completions request upstream.
@@ -397,8 +412,12 @@ pub(crate) async fn chat_completions_handler(
             .into_response();
     }
 
-    // Build upstream request.
+    // Build upstream request. The shared platform builder sets no timeouts,
+    // so the proxy would hang forever on an accept-and-stall upstream;
+    // bound both the connect and the whole non-streaming round trip.
     let upstream_req = codewhale_release::platform_http_client_builder()
+        .connect_timeout(UPSTREAM_CONNECT_TIMEOUT)
+        .timeout(UPSTREAM_TOTAL_TIMEOUT)
         .build()
         .map_err(|e| {
             (
@@ -498,6 +517,29 @@ mod tests {
         crate::install_test_crypto_provider();
     }
 
+    // The proxy forwards with a client built per request, and reqwest gives
+    // no accessor for a built client's budgets, so a behavioral test would
+    // need an accept-and-stall upstream and a multi-second (connect) or
+    // half-hour (total) wait. Pin the values instead: if the handler stops
+    // applying them this test cannot see it, but a silent constant change
+    // or an inversion of the connect/total ordering cannot slip through.
+    #[test]
+    fn upstream_deadlines_are_bounded_and_ordered() {
+        assert_eq!(UPSTREAM_CONNECT_TIMEOUT, std::time::Duration::from_secs(10));
+        assert_eq!(UPSTREAM_TOTAL_TIMEOUT, std::time::Duration::from_secs(1800));
+        assert!(
+            UPSTREAM_TOTAL_TIMEOUT > UPSTREAM_CONNECT_TIMEOUT,
+            "the total forward budget must leave room beyond the connect budget"
+        );
+        // The shared platform builder must accept both bounds; the handler
+        // chains them onto this builder.
+        codewhale_release::platform_http_client_builder()
+            .connect_timeout(UPSTREAM_CONNECT_TIMEOUT)
+            .timeout(UPSTREAM_TOTAL_TIMEOUT)
+            .build()
+            .expect("platform builder accepts the proxy deadlines");
+    }
+
     /// Start a minimal upstream mock server that echoes back what it received.
     async fn start_mock_upstream() -> (String, tokio::task::JoinHandle<()>) {
         let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
```

---

### Incident Patch 12: `e94c2d9b` (2026-10-05)
**Commit Message**: fix(tools): bound and reap pandoc conversions

`pandoc_convert` ran `pandoc` through sync `std::process::Command` from
the async execute path: the blocking `output()` pinned an executor thread
and nothing bounded it, and a cancelled call left the converter running
orphaned. The one-shot `pandoc --version` sandbox-version probe had the
same shape.

Move both invocations to `tokio::process::Command`. The conversion gets
a 600s budget (mirroring the js_execution interpreter budget) answered
with `ToolError::Timeout`; both children are kill-on-drop, so a timeout
or dropped future reaps the process. The probe gets a 10s budget and,
like an unparseable banner, lets the conversion through on expiry —
pandoc then reports unknown flags itself. The probe cache moves to
`tokio::sync::OnceCell` since the probe is now async; a cancelled probe
leaves the cell uninitialized and the next caller retries.

Validation: cargo fmt --all -- --check; cargo clippy -p codewhale-tui
--all-targets --all-features --locked; cargo test -p codewhale-tui pandoc.

Disclosure: the timeout paths cannot be behaviorally tested without
injecting a wedged pandoc past the process-global resolve_pandoc() cache;
the bounds

**File**: `crates/tui/src/tools/pandoc.rs` (modified, +62/-19)
```diff
@@ -31,11 +31,12 @@
 
 use std::ffi::OsString;
 use std::path::{Path, PathBuf};
-use std::process::{Command, Stdio};
-use std::sync::OnceLock;
+use std::process::Stdio;
+use std::time::Duration;
 
 use async_trait::async_trait;
 use serde_json::{Value, json};
+use tokio::process::Command as TokioCommand;
 
 use super::spec::{
     ApprovalRequirement, ToolCapability, ToolContext, ToolError, ToolResult, ToolSpec,
@@ -60,6 +61,18 @@ pub(crate) const SUPPORTED_TARGET_FORMATS: &[&str] = &[
     "asciidoc",   // AsciiDoc
 ];
 
+/// Wall-clock bound for one pandoc conversion: a pathological document
+/// (giant epub, pathological LaTeX) would otherwise hold the call for as
+/// long as pandoc felt like taking. Mirrors the 600s interpreter budget
+/// used by js_execution.
+const PANDOC_TIMEOUT: Duration = Duration::from_secs(600);
+
+/// Bound for the one-shot `pandoc --version` probe. A probe that cannot
+/// finish in 10s means the binary itself is wedged; like an unparseable
+/// banner, the gate then lets the conversion through and pandoc reports
+/// any flag it does not know itself.
+const PANDOC_VERSION_PROBE_TIMEOUT: Duration = Duration::from_secs(10);
+
 /// Tool implementing `pandoc_convert`. Converts a source file into
 /// a target format and either writes the output to disk or returns
 /// the converted text inline.
@@ -162,20 +175,27 @@ impl ToolSpec for PandocConvertTool {
                  Windows: `winget install JohnMacFarlane.Pandoc`) and restart codewhale.",
             )
         })?;
-        require_sandbox_support(&pandoc)?;
+        require_sandbox_support(&pandoc).await?;
 
-        let mut cmd = Command::new(&pandoc);
+        let mut cmd = TokioCommand::new(&pandoc);
         cmd.args(pandoc_args(
             &source_path,
             &target_format,
             resolved_output_path.as_deref(),
         ));
+        // Kill the converter if the timeout below drops the output()
+        // future: pandoc on a pathological document would otherwise keep
+        // running orphaned after the call already failed.
+        cmd.kill_on_drop(true);
         cmd.stdin(Stdio::null())
             .stdout(Stdio::piped())
             .stderr(Stdio::piped());
 
-        let output = cmd
-            .output()
+        let output = tokio::time::timeout(PANDOC_TIMEOUT, cmd.output())
+            .await
+            .map_err(|_| ToolError::Timeout {
+                seconds: PANDOC_TIMEOUT.as_secs(),
+            })?
             .map_err(|e| ToolError::execution_failed(format!("failed to launch pandoc: {e}")))?;
 
         if !output.status.success() {
@@ -235,19 +255,27 @@ fn parse_pandoc_version(banner: &str) -> Option<(u32, u32)> {
 
 /// Refuse a pandoc older than 2.15 with an actionable message instead of
 /// pandoc's own "Unknown option --sandbox". The version probe runs once per
-/// process; an unparseable banner is let through, and pandoc itself then
-/// rejects the flag if it does not know it.
-fn require_sandbox_support(pandoc: &str) -> Result<(), ToolError> {
-    static VERSION: OnceLock<Option<(u32, u32)>> = OnceLock::new();
-    let version = *VERSION.get_or_init(|| {
-        let out = Command::new(pandoc)
-            .arg("--version")
-            .stdin(Stdio::null())
-            .stderr(Stdio::null())
-            .output()
-            .ok()?;
-        parse_pandoc_version(&String::from_utf8_lossy(&out.stdout))
-    });
+/// process; an unparseable banner — or a probe that outlives its bound — is
+/// let through, and pandoc itself then rejects the flag if it does not know
+/// it. The child is async and kill-on-drop so a wedged `--version` can
+/// neither block the executor nor outlive the probe.
+async fn require_sandbox_support(pandoc: &str) -> Result<(), ToolError> {
+    static VERSION: tokio::sync::OnceCell<Option<(u32, u32)>> = tokio::sync::OnceCell::const_new();
+    let version = *VERSION
+        .get_or_init(|| async {
+            let mut cmd = TokioCommand::new(pandoc);
+            cmd.arg("--version")
+                .stdin(Stdio::null())
+                .stdout(Stdio::piped())
+                .stderr(Stdio::null())
+                .kill_on_drop(true);
+            let out = tokio::time::timeout(PANDOC_VERSION_PROBE_TIMEOUT, cmd.output())
+                .await
+                .ok()?
+                .ok()?;
+            parse_pandoc_version(&String::from_utf8_lossy(&out.stdout))
+        })
+        .await;
     match version {
         Some(found) if found < MIN_SANDBOX_VERSION => Err(ToolError::execution_failed(format!(
             "pandoc_convert: pandoc {}.{} or newer is required (found {}.{}). \
@@ -420,6 +448,21 @@ mod tests {
         assert!((3, 0) >= MIN_SANDBOX_VERSION);
     }
 
+    // Both invocations are bounded in time; a conversion that outlives its
+    // budget is answered with ToolError::Timeout and its child killed, but
+    // exercising that path would need a wedged `pandoc` injected past the
+    // process-global resolve_p
```

---

### Incident Patch 13: `99c519a9` (2026-10-05)
**Commit Message**: fix(client): bound non-streaming model requests with a retry-aware envelope

The shared client intentionally has no client-level total timeout, so
every non-streaming completion (chat/Responses/Messages generation,
compaction, translate, list-models, provider-native search, FIM, speech)
was unbounded in time: a provider that accepts the connection and stalls
wedged the caller forever, and a gateway answering 429 with an hour-long
Retry-After kept the turn suspended for as long as it kept answering.
Streaming requests were already protected per-chunk; only this path had
nothing.

Give the non-streaming retry loop two bounded layers, mirroring the
streaming open/lifetime split:

- each attempt carries NON_STREAMING_REQUEST_ENVELOPE (30 minutes) as a
  reqwest per-request total, which covers connect through body end, so a
  slow-drip body cannot outlive the attempt either;
- the whole loop - attempts, backoff, and honored Retry-After waits - is
  wrapped in one outer envelope of the same length, and the loop envelope
  dominates the per-attempt total it wraps so a caller-pinned budget is
  never strangled by it.

Streaming opens must not carry any of this: reqwest's per-request
timeou

**File**: `crates/tui/src/client.rs` (modified, +153/-8)
```diff
@@ -390,6 +390,37 @@ fn client_user_agent(_api_provider: ProviderKind) -> &'static str {
 /// of committing to the full remaining window up front.
 const RATE_LIMIT_PAUSE_RECHECK_INTERVAL: Duration = Duration::from_millis(250);
 
+/// Total budget for one non-streaming request. Two layers use it: each
+/// attempt carries it as a reqwest per-request total (connect through body
+/// end, so a trickling body cannot extend forever), and the retry loop
+/// through `send_with_retry` is wrapped in one outer envelope of the same
+/// length (all attempts, backoff, and honored Retry-After included). The
+/// shared client intentionally has no client-level total timeout, so without
+/// these nothing bounds a non-streaming completion: a provider that accepts
+/// the connection and then stalls — or a gateway answering 429 +
+/// `Retry-After: 3600` forever — wedged the caller indefinitely.
+///
+/// Streaming paths never carry it: their opens go through
+/// `send_stream_open_with_retry`, which sets no per-request total (a total
+/// would ride on the returned body and hard-cut a live stream), so a stream
+/// stays bounded by its open cap and per-chunk idle checks only.
+pub(super) const NON_STREAMING_REQUEST_ENVELOPE: Duration = Duration::from_secs(1800);
+
+#[cfg(test)]
+static TEST_NON_STREAMING_ENVELOPE_MS: std::sync::atomic::AtomicU64 =
+    std::sync::atomic::AtomicU64::new(0);
+
+fn non_streaming_request_envelope() -> Duration {
+    #[cfg(test)]
+    {
+        let ms = TEST_NON_STREAMING_ENVELOPE_MS.load(std::sync::atomic::Ordering::SeqCst);
+        if ms > 0 {
+            return Duration::from_millis(ms);
+        }
+    }
+    NON_STREAMING_REQUEST_ENVELOPE
+}
+
 pub(super) const SSE_BACKPRESSURE_HIGH_WATERMARK: usize = 1024 * 1024; // 1 MB
 pub(super) const SSE_BACKPRESSURE_SLEEP_MS: u64 = 10;
 pub(super) const SSE_MAX_LINES_PER_CHUNK: usize = 256;
@@ -3267,9 +3298,16 @@ impl CodewhaleClient {
                         let disclosure = ErrorBodyDisclosure::Guarded {
                             request_secrets: request_query_secret_values(&url),
                         };
-                        self.send_with_retry_error_body(build, &disclosure)
-                            .await
-                            .map_err(ModelsFetchError::Interactive)?
+                        // The pinned 30s per-attempt total survives: the retry
+                        // loop's shared envelope is not allowed to overwrite a
+                        // caller's own budget.
+                        self.send_with_retry_total_error_body(
+                            NON_STREAMING_HTTP_TIMEOUT,
+                            build,
+                            &disclosure,
+                        )
+                        .await
+                        .map_err(ModelsFetchError::Interactive)?
                     }
                     ModelsRequestMode::Refresh => build()
                         .send()
@@ -3698,7 +3736,28 @@ impl CodewhaleClient {
     /// much of the body reaches retry logs, state updates and the user.
     async fn send_with_retry_error_body<F>(
         &self,
-        mut build: F,
+        build: F,
+        disclosure: &ErrorBodyDisclosure,
+    ) -> Result<reqwest::Response>
+    where
+        F: FnMut() -> reqwest::RequestBuilder,
+    {
+        if self.isolated_request_state {
+            return self.send_with_isolated_retry(build, disclosure).await;
+        }
+        self.send_retry_loop(build, Some(non_streaming_request_envelope()), disclosure)
+            .await
+    }
+
+    /// [`Self::send_with_retry_error_body`] with a caller-pinned per-attempt
+    /// total (connect through body end). `list_models` pins its own 30s: the
+    /// plain variant would otherwise stretch that pinned budget out to the
+    /// shared envelope, because `.timeout()` on the builder is a pure
+    /// overwrite.
+    async fn send_with_retry_total_error_body<F>(
+        &self,
+        total: Duration,
+        build: F,
         disclosure: &ErrorBodyDisclosure,
     ) -> Result<reqwest::Response>
     where
@@ -3707,13 +3766,58 @@ impl CodewhaleClient {
         if self.isolated_request_state {
             return self.send_with_isolated_retry(build, disclosure).await;
         }
+        self.send_retry_loop(build, Some(total), disclosure).await
+    }
+
+    /// The streaming-open twin of [`Self::send_with_retry`]: the same retry
+    /// and rate-limit handling with no total deadline anywhere. reqwest's
+    /// per-request timeout wraps the response *body*, so a total set on the
+    /// open would ride along inside the returned body and hard-cut a live
+    /// stream mid-generation. Stream opens stay bounded by the caller's
+    /// `stream_open_timeout` around the open and per-chunk idle checks on
+    /// the returned body instead.
+    pub(super) async fn send_stream_open_with_retry<F>(&self, build: F) -> Result<reqwest::Response>
+    where
+        F: FnMut() -> reqwest::RequestBuilder,
```

**File**: `crates/tui/src/client/anthropic.rs` (modified, +7/-6)
```diff
@@ -236,11 +236,12 @@ impl CodewhaleClient {
     /// Open the streaming Messages request through the shared stream-entry
     /// transport policy: bounded header wait, dual-client selection, and at
     /// most one HTTP/1.1 fallback retry on a classified H2 header stall.
-    /// Inside each open attempt the provider retry loop (`send_with_retry`)
-    /// handles rate limits and transient upstream failures before any stream
-    /// body exists, as the Chat and Responses adapters do. Wire-specific
-    /// request construction (headers, endpoint, body) stays here at the
-    /// adapter edge.
+    /// Inside each open attempt the provider retry loop
+    /// (`send_stream_open_with_retry`) handles rate limits and transient
+    /// upstream failures before any stream body exists — with no total
+    /// deadline, which would ride on the returned body — as the Chat and
+    /// Responses adapters do. Wire-specific request construction (headers,
+    /// endpoint, body) stays here at the adapter edge.
     async fn open_anthropic_stream_response(
         &self,
         url: &str,
@@ -259,7 +260,7 @@ impl CodewhaleClient {
                     self.http1_fallback_client(),
                     policy,
                 );
-                self.send_with_retry(|| {
+                self.send_stream_open_with_retry(|| {
                     client
                         .post(&url)
                         .header(reqwest::header::CONTENT_TYPE, "application/json")
```

**File**: `crates/tui/src/client/chat.rs` (modified, +4/-1)
```diff
@@ -1351,7 +1351,10 @@ impl CodewhaleClient {
                         .await?)
                 }
                 super::stream_entry::StreamHttpPolicy::DualWithH1Fallback => {
-                    self.send_json_with_retry(url, body).await
+                    // Stream open, not a JSON retry: the response body outlives
+                    // the open, so this path must not carry any total deadline
+                    // (`open_stream_json_with_retry`, not `send_json_with_retry`).
+                    self.open_stream_json_with_retry(url, body).await
                 }
             }
         })
```

**File**: `crates/tui/src/client/responses.rs` (modified, +4/-1)
```diff
@@ -200,7 +200,10 @@ impl CodewhaleClient {
                     self.http1_fallback_client(),
                     policy,
                 );
-                self.send_with_retry(|| {
+                // Stream open: the same retry and rate-limit handling with no
+                // total deadline — a per-request total would ride on the
+                // returned SSE body and hard-cut the live stream.
+                self.send_stream_open_with_retry(|| {
                     client
                         .post(&url)
                         .header("Content-Type", "application/json")
```

**File**: `crates/tui/src/client/test_cases_01.rs` (modified, +159/-0)
```diff
@@ -526,6 +526,165 @@
         client
     }
 
+    /// Swap in a short non-streaming envelope for the test's duration,
+    /// restoring the previous value on drop.
+    struct NonStreamingEnvelopeGuard(u64);
+
+    impl NonStreamingEnvelopeGuard {
+        fn millis(ms: u64) -> Self {
+            Self(TEST_NON_STREAMING_ENVELOPE_MS.swap(ms, std::sync::atomic::Ordering::SeqCst))
+        }
+    }
+
+    impl Drop for NonStreamingEnvelopeGuard {
+        fn drop(&mut self) {
+            TEST_NON_STREAMING_ENVELOPE_MS.store(self.0, std::sync::atomic::Ordering::SeqCst);
+        }
+    }
+
+    /// The provider accepts the connection but stalls far past the budgeted
+    /// envelope before answering: the non-streaming request must be cut off
+    /// with a timeout instead of wedging the caller (mid-turn compaction,
+    /// translate, provider-native search) indefinitely.
+    #[tokio::test]
+    async fn non_streaming_envelope_bounds_a_stalled_provider() {
+        // The injected budget is process-global; serialize against other tests
+        // (which may issue non-streaming requests with their own timing
+        // assumptions) through the shared test-env lock.
+        let _env_lock = crate::test_support::lock_test_env();
+        let _envelope = NonStreamingEnvelopeGuard::millis(2000);
+        let server = MockServer::start().await;
+        Mock::given(method("POST"))
+            .respond_with(
+                ResponseTemplate::new(200)
+                    .set_body_json(json!({
+                        "id": "chatcmpl_envelope",
+                        "object": "chat.completion",
+                        "model": "deepseek-v4-pro",
+                        "choices": [{
+                            "index": 0,
+                            "message": {"role": "assistant", "content": "late"},
+                            "finish_reason": "stop"
+                        }],
+                        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}
+                    }))
+                    .set_delay(Duration::from_secs(5)),
+            )
+            .mount(&server)
+            .await;
+
+        let client = deepseek_request_boundary_client(&server.uri(), server.uri());
+        let err = client
+            .create_message(k3_request_fixture("deepseek-v4-pro", Some("off"), false))
+            .await
+            .expect_err("a provider that never answers must hit the envelope");
+        assert!(
+            err.to_string().to_lowercase().contains("timed out"),
+            "envelope timeout must be reported as such; got {err:#}"
+        );
+    }
+
+    /// Every attempt answers 429 with an hour-long Retry-After. Honoring the
+    /// header must not hand the total budget to the server: the retry loop is
+    /// capped by the envelope, so a gateway answering 429 + Retry-After: 3600
+    /// forever fails the turn in bounded time instead of wedging it for hours.
+    #[tokio::test]
+    async fn retry_after_honoring_cannot_extend_the_non_streaming_envelope() {
+        let _env_lock = crate::test_support::lock_test_env();
+        let _envelope = NonStreamingEnvelopeGuard::millis(2000);
+        let server = MockServer::start().await;
+        Mock::given(method("POST"))
+            .respond_with(
+                ResponseTemplate::new(429)
+                    .insert_header("retry-after", "3600")
+                    .set_body_string("rate limited"),
+            )
+            .mount(&server)
+            .await;
+
+        let client = deepseek_request_boundary_client(&server.uri(), server.uri());
+        let started = std::time::Instant::now();
+        let err = client
+            .create_message(k3_request_fixture("deepseek-v4-pro", Some("off"), false))
+            .await
+            .expect_err("unbounded Retry-After honoring must still hit the envelope");
+        assert!(
+            err.to_string().to_lowercase().contains("timed out"),
+            "the envelope must cut off the Retry-After wait; got {err:#}"
+        );
+        assert!(
+            started.elapsed() < Duration::from_secs(30),
+            "a 3600s Retry-After must not run past the envelope; took {:?}",
+            started.elapsed()
+        );
+        crate::retry_status::clear();
+        crate::retry_status::clear_rate_limit();
+    }
+
+    /// The open answers past the injected non-streaming envelope. The
+    /// streaming-open path must not inherit any total: reqwest's per-request
+    /// timeout wraps the response body, so a total set on the open would ride
+    /// on the returned body and hard-cut a live stream mid-generation.
+    #[tokio::test]
+    async fn stream_open_retry_path_sets_no_total_deadline() {
+        let _env_lock = crate::test_support::lock_test_env();
+        let _envelope = NonStreamingEnvelopeGuard::millis(2000);
+        let server = MockServer::start().await;
+        Mock::given(method("POST"))
+            .respond_with(
+          
```

---

### Incident Patch 14: `68dfd066` (2026-10-05)
**Commit Message**: fix(snapshot): bound git subprocesses so a wedged git cannot stall the turn

The snapshot side repo shells out to git with blocking Command::output
calls that have no time bound: a wedged git — a stalled NFS/FUSE mount,
lock contention, a hung hook — blocks the per-turn snapshot path, the
restore path, and the prune path indefinitely. Every caller already
treats a snapshot error as snapshot-disabled-with-warning, so the bound
only has to surface as a normal error to degrade gracefully.

All three unbounded call sites in snapshot/repo.rs — the one-time
`git init`, the date-pinned `commit-tree` on the per-turn prune path,
and the shared run_git helper — now route through one bounded core with
a generous 300s budget (`git add -A` on a large workspace is
legitimately slow). The core drains both pipes while the child runs,
exactly what Command::output does: the restore path's `ls-tree -r` and
the diff commands emit output that grows with workspace size, and a
child blocked on a full pipe buffer never exits, which would turn every
such call into a guaranteed timeout. After git exits, the drain collect
is bounded by a short grace so a grandchild that inherited the pipes (a
daemonizing pos

**File**: `crates/tui/src/snapshot/repo.rs` (modified, +240/-16)
```diff
@@ -19,6 +19,8 @@ use std::path::{Component, Path, PathBuf};
 use std::process::Output;
 use std::time::{Duration, SystemTime, UNIX_EPOCH};
 
+use wait_timeout::ChildExt as _;
+
 use crate::dependencies::ExternalTool;
 
 use super::paths::{ensure_snapshot_dir, snapshot_git_dir};
@@ -476,13 +478,11 @@ impl SnapshotRepo {
         // and stores metadata in `.git`. We then continue to use
         // explicit `--git-dir` / `--work-tree` flags for every other
         // command so behaviour is invariant of cwd.
-        let init = crate::dependencies::Git::command()
-            .ok_or_else(|| io_other("git not found on PATH"))?
-            .arg("init")
-            .arg("--quiet")
-            .arg(parent)
-            .output()
-            .map_err(|e| io_other(format!("failed to spawn git init: {e}")))?;
+        let mut git =
+            crate::dependencies::Git::command().ok_or_else(|| io_other("git not found on PATH"))?;
+        let init = git.arg("init").arg("--quiet").arg(parent);
+        let init = run_bounded_git(init, "init")
+            .map_err(|e| io_other(format!("failed to run git init: {e}")))?;
         if !init.status.success() {
             return Err(io_other(format!(
                 "git init failed: {}",
@@ -1863,16 +1863,17 @@ impl SnapshotRepo {
     /// age instead of stamping "now".
     fn commit_tree_preserving_date(&self, args: &[&str], timestamp: i64) -> io::Result<String> {
         let date = format!("{timestamp} +0000");
-        let out = crate::dependencies::Git::command()
-            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "git not found on PATH"))?
+        let mut command = crate::dependencies::Git::command()
+            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "git not found on PATH"))?;
+        command
             .arg("--git-dir")
             .arg(&self.git_dir)
             .arg("--work-tree")
             .arg(&self.work_tree)
             .env("GIT_AUTHOR_DATE", &date)
             .env("GIT_COMMITTER_DATE", &date)
-            .args(args)
-            .output()?;
+            .args(args);
+        let out = run_bounded_git(&mut command, args.first().copied().unwrap_or("git"))?;
         if !out.status.success() {
             return Err(io_other(format!(
                 "commit-tree failed: {}",
@@ -2188,15 +2189,157 @@ fn cleanup_stale_pack_temps_in(
     Ok(removed)
 }
 
+// Generous budget: `git add -A` on a large workspace is legitimately slow,
+// but a wedged git (stalled NFS/FUSE, hung hook) must not block the turn
+// pipeline forever — every caller treats a snapshot error as
+// snapshot-disabled-with-warning and proceeds without the git data. Tests
+// use a tighter budget so a regression that deadlocks a child on its own
+// output fails in seconds instead of hanging for the full window.
+#[cfg(not(test))]
+const GIT_COMMAND_TIMEOUT: Duration = Duration::from_secs(300);
+#[cfg(test)]
+const GIT_COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
+
+/// Grace granted to the pipe readers after git has exited. A clean git
+/// closes its own write ends, so EOF is already waiting; only a grandchild
+/// that inherited the pipes (a post-checkout hook, a `git gc` pack worker)
+/// can hold them past exit, and it must not hold the turn pipeline either.
+const GIT_PIPE_DRAIN_GRACE: Duration = Duration::from_secs(2);
+
+/// Run a pre-configured git command under [`GIT_COMMAND_TIMEOUT`] with both
+/// pipes drained while the child runs (the same concurrent drain
+/// `Command::output` performs). Every git invocation in this module goes
+/// through here, so a wedged git — stalled NFS/FUSE, hung hook — degrades
+/// the snapshot with an error instead of hanging the turn pipeline.
+/// (`delta.rs`'s read-view git commands are not routed here yet; that is a
+/// known follow-up.)
+///
+/// The timeout path kills the child and reaps it on a detached thread: on a
+/// hard-wedged mount git can sit in uninterruptible kernel I/O where even
+/// SIGKILL is deferred, and a blocking `wait()` would hang the pipeline
+/// exactly like the wedged git would. Killing without git's own cleanup can
+/// leave a fresh `index.lock` behind; later snapshots then fail fast on the
+/// lock with an error naming it.
+fn run_bounded_git(cmd: &mut std::process::Command, subcommand: &str) -> io::Result<Output> {
+    run_bounded_git_with_timeout(cmd, subcommand, GIT_COMMAND_TIMEOUT)
+}
+
+fn run_bounded_git_with_timeout(
+    cmd: &mut std::process::Command,
+    subcommand: &str,
+    timeout: Duration,
+) -> io::Result<Output> {
+    cmd.stdin(std::process::Stdio::null())
+        .stdout(std::process::Stdio::piped())
+        .stderr(std::process::Stdio::piped());
+    let mut child = cmd.spawn()?;
+    // Drain both pipes while waiting: the restore path's `ls-tree -r` and
+    // the diff commands emit output that grows with workspace size, and a
+    // child blocked on a full pipe buffer never exits — it would turn every
+    // such call in
```

---

### Incident Patch 15: `abd40bbf` (2026-10-05)
**Commit Message**: fix(web): bound the fetch SSRF pre-flight DNS lookup

The SSRF pre-flight in `validate_fetch_target` resolves the target host
with an unbounded `tokio::net::lookup_host`. The lookup runs before the
guarded request — and once more per redirect — so a wedged resolver
stalled the fetch tool past its own 60s HARD_MAX_TIMEOUT envelope with
no way for the caller to recover.

Bound the pre-flight resolution at 10 seconds. A resolver that does not
answer in time now fails the pre-flight with an explicit "timed out
resolving host" permission error instead of stalling the tool; the
documented request hard cap itself is unchanged. A test pins the bound
below the fetch hard cap, and the existing unresolved-host regressions
cover the preserved DNS-failure error path.

Signed-off-by: asto <[REDACTED_EMAIL]>

**File**: `crates/tui/src/tools/web/guard.rs` (modified, +32/-7)
```diff
@@ -9,6 +9,13 @@
 use crate::network_policy::{Decision, NetworkPolicyDecider};
 use crate::tools::spec::{ToolContext, ToolError};
 use std::net::IpAddr;
+use std::time::Duration;
+
+/// Wall-clock bound for one pre-flight DNS resolution. The resolution runs
+/// before the guarded request (and once per redirect), so a hung resolver
+/// would otherwise stall the tool far beyond the documented request timeout
+/// envelope (`super::fetch::HARD_MAX_TIMEOUT`).
+const DNS_PREFLIGHT_TIMEOUT: Duration = Duration::from_secs(10);
 
 /// DNS pin returned when a hostname was resolved to a validated public IP.
 /// Callers should pass this to `reqwest::ClientBuilder::resolve` so the
@@ -111,13 +118,17 @@ pub(crate) async fn validate_fetch_target(
         return Ok(None);
     }
 
-    let addrs = tokio::net::lookup_host((host.as_str(), 0u16))
-        .await
-        .map_err(|e| {
-            ToolError::permission_denied(format!(
-                "could not resolve host before {tool} request: {e}"
-            ))
-        })?;
+    let addrs = tokio::time::timeout(
+        DNS_PREFLIGHT_TIMEOUT,
+        tokio::net::lookup_host((host.as_str(), 0u16)),
+    )
+    .await
+    .map_err(|_| {
+        ToolError::permission_denied(format!("timed out resolving host before {tool} request"))
+    })?
+    .map_err(|e| {
+        ToolError::permission_denied(format!("could not resolve host before {tool} request: {e}"))
+    })?;
     let mut first_valid: Option<IpAddr> = None;
     for addr in addrs {
         validate_dns_resolved_ip(&host, &addr.ip(), context.network_policy.as_ref(), tool)?;
@@ -744,4 +755,18 @@ mod tests {
             "error should be labeled for web_run or report restricted IP; got {err}"
         );
     }
+
+    #[test]
+    fn dns_preflight_bound_stays_below_the_fetch_hard_cap() {
+        // The pre-flight resolution runs before every guarded request (and
+        // once per redirect); its own bound must leave room inside the fetch
+        // tool's hard cap instead of being able to outlast it. A wedged
+        // resolver surfaces as a timeout error, not a stalled tool.
+        assert!(
+            DNS_PREFLIGHT_TIMEOUT < super::super::fetch::HARD_MAX_TIMEOUT,
+            "DNS pre-flight bound {:?} must stay below the fetch hard cap {:?}",
+            DNS_PREFLIGHT_TIMEOUT,
+            super::super::fetch::HARD_MAX_TIMEOUT
+        );
+    }
 }
```

#### Recent Merged Pull Requests:
- **PR #6870** (2026-10-05): fix(models,tui): resolve snapshot model ids and probe custom provider rosters (@SparkofSpike)
- **PR #6863** (2026-10-05): fix(client): bound non-streaming model requests with a retry-aware envelope (@asto18089)
- **PR #6862** (closed): fix(engine): resolve pending approvals when the engine or runtime goes away (@asto18089)
- **PR #6861** (closed): fix(rlm): honor the advertised sub-query timeout instead of a hardcoded cap (@asto18089)
- **PR #6859** (2026-10-05): fix(snapshot): bound git subprocesses so a wedged git cannot stall the turn (@asto18089)
- **PR #6856** (2026-10-05): docs(tools): align remaining tool descriptions with approval and platform behavior (@asto18089)
- **PR #6855** (2026-10-05): fix(app-server): bound chat-completions proxy requests in time (@asto18089)
- **PR #6854** (2026-10-05): fix(tools): bound and reap pandoc conversions (@asto18089)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
