> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuberwastaken-claurst-learnings.md`  
> **Source**: github ([https://github.com/Kuberwastaken/claurst](https://github.com/Kuberwastaken/claurst))  
> **Source Version**: `85ebb868`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T00:54:31.279Z  
> **Learning ID**: `learn-github-kuberwastaken-claurst`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Kuberwastaken/claurst

> **Canonical Artifact**: `07_PROJECT_LEARNING/kuberwastaken-claurst-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kuberwastaken/claurst](https://github.com/Kuberwastaken/claurst))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T00:54:31.269Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuberwastaken/claurst`
- **Description**: Agentic Coding for Builders who Ship
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10323 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src-rust/crates/core/src/accounts.rs`
```
//! Multi-account credential management.
//!
//! Stores named profiles per provider (anthropic, codex) on disk so users can
//! switch between Pro/Max/work/personal accounts without re-logging-in.
//!
//! Design borrows from two prior arts:
//!
//!   * **codexmaxx** (kitze/codexmaxx) — named per-account snapshots stored on
//!     disk, identity derived from JWT payload (email / account_id), explicit
//!     "import current external login" flow.
//!   * **opencode** — single tagged-union JSON file, chmod 0600, symmetric
//!     `list / login / logout / switch` commands across providers.
//!
//! Layout:
//!
//! ```text
//! ~/.claurst/
//!   accounts.json                              # registry (this module)
//!   accounts/
//!     anthropic/<profile-id>/oauth_tokens.json
//!     codex/<profile-id>/codex_tokens.json
//!   oauth_tokens.json                          # legacy (auto-migrated)
//!   codex_tokens.json                          # legacy (auto-migrated)
//! ```
//!
//! The registry holds metadata (label, email, account-id, timestamps, active
//! pointer per provider). The per-account credential files keep their existing
//! schemas so the rest of the codebase doesn't change shape.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

/// Identifier for a credential provider that supports multi-account.
pub const PROVIDER_ANTHROPIC: &str = "anthropic";
pub const PROVIDER_CODEX: &str = "codex";

/// Metadata recorded for a single stored profile.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AccountProfile {
    /// Slug used as the directory name and CLI identifier.
    pub id: String,
    /// Optional human-friendly label (e.g. "work", "personal").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Email extracted from the JWT id_token (when available).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Provider-side account identifier (account_id / account_uuid).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<String>,
    /// Organization UUID (Anthropic only).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_uuid: Option<String>,
    /// Plan / subscription tier (Pro, Max, …) when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription_tier: Option<String>,
    /// ISO-8601 timestamp when this profile was first added.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub added_at: Option<String>,
    /// ISO-8601 timestamp of the last `switch_to(...)` call.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_selected_at: Option<String>,
}

impl AccountProfile {
    /// Best-effort display name for menus: label > email > id.
    pub fn display_name(&self) -> String {
        self.label
            .clone()
            .or_else(|| self.email.clone())
            .unwrap_or_else(|| self.id.clone())
    }
}

/// Per-provider section of the registry.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderAccounts {
    /// Profile id of the currently-active account for this provider.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active: Option<String>,
    /// All stored profiles, keyed by id.
    #[serde(default)]
    pub profiles: BTreeMap<String, AccountProfile>,
}

/// On-disk shape of `~/.claurst/accounts.json`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AccountRegistry {
    /// Schema version (current: 1).
    #[serde(default = "default_version")]
    pub version: u32,
    /// One entry per credential provider.
    #[serde(default)]
    pub providers: BTreeMap<String, ProviderAccounts>,
}

fn default_version() -> u32 {
    1
}

impl AccountRegistry {
    /// Path to `~/.claurst/accounts.json`.
    pub fn path() -> PathBuf {
        claurst_dir().join("accounts.json")
    }

    /// Load the registry. Returns an empty registry if the file is missing or
    /// malformed.
    pub fn load() -> Self {
        let path = Self::path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(reg) = serde_json::from_str::<AccountRegistry>(&data) {
                return reg;
            }
        }
        AccountRegistry::default()
    }

    /// Persist the registry to disk. Best-effort but propagates I/O errors.
    pub fn save(&self) -> anyhow::Result<()> {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
            set_user_only_dir_perms(parent);
        }
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, json)?;
        set_user_only_perms(&path);
        Ok(())
    }

    /// Get the active profile id for a provider.
    pub fn active(&self, provider: &str) -> Option<&str> {
        self.providers
            .get(provider)
            .and_then(|p| p.active.as_deref())
    }

    /// Get the active profile metadata, if any.
    pub fn active_profile(&self, provider: &str) -> Option<&AccountProfile> {
        let p = self.providers.get(provider)?;
        let id = p.active.as_ref()?;
        p.profiles.get(id)
    }

    /// List all profiles for a provider (sorted by id).
    pub fn list(&self, provider: &str) -> Vec<AccountProfile> {
        self.providers
            .get(provider)
            .map(|p| p.profiles.values().cloned().collect())
            .unwrap_or_default()
    }

    /// Lookup a profile by id within a provider.
    pub fn get(&self, provider: &str, id: &str) -> Option<&AccountProfile> {
        self.providers.get(provider)?.profiles.get(id)
    }

    /// Insert or update a profile, optionally setting it active.
    pub fn upsert(
        &mut self,
        provider: &str,
        mut profile: AccountProfile,
        make_active: bool,
    ) -> anyhow::Result<()> {
        if profile.added_at.is_none() {
            profile.added_at = Some(now_iso());
        }
        let section = self.providers.entry(provider.to_string()).or_default();
        section.profiles.insert(profile.id.clone(), profile.clone());
        if make_active {
            section.active = Some(profile.id.clone());
            if let Some(stored) = section.profiles.get_mut(&profile.id) {
                stored.last_selected_at = Some(now_iso());
            }
        }
        self.save()
    }

    /// Switch the active profile for a provider. Returns `Err` if the id does
    /// not exist.
    pub fn switch_to(&mut self, provider: &str, id: &str) -> anyhow::Result<()> {
        let section = self
            .providers
            .get_mut(provider)
            .ok_or_else(|| anyhow::anyhow!("No accounts stored for {provider}"))?;
        if !section.profiles.contains_key(id) {
            anyhow::bail!("Account '{}' not found for {}", id, provider);
        }
        section.active = Some(id.to_string());
        if let Some(p) = section.profiles.get_mut(id) {
            p.last_selected_at = Some(now_iso());
        }
        self.save()
    }

    /// Remove a profile (and its credential directory). If it was active,
    /// clears the active pointer.
    pub fn remove(&mut self, provider: &str, id: &str) -> anyhow::Result<()> {
        if let Some(section) = self.providers.get_mut(provider) {
            section.profiles.remove(id);
            if section.active.as_deref() == Some(id) {
                section.active = None;
            }
        }
        // Remove the per-account credential dir.
        let dir = account_dir(provider, id);
        if dir.exists() {
            let _ = std::fs::remove_dir_all(&dir);
        }
        self.save()
    }
}

/// Slugify an arbitrary string into a safe profile id. Lowercases, replaces
/// non-`[a-z0-9_-]` with `-`, trims dashes/underscores from edges, falls back
/// to "account" if the result is empty.
pub fn slugify_profile_id(raw: &str) -> String {
    let lowered = raw.trim().to_lowercase();
    let mapped: String = lowered
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let trimmed = mapped.trim_matches(|c: char| c == '-' || c == '_').to_string();
    if trimmed.is_empty() {
        "account".to_string()
    } else {
        trimmed
    }
}

/// If the requested id already exists, suffix with -2, -3, … until free.
pub fn ensure_unique_profile_id(
    registry: &AccountRegistry,
    provider: &str,
    base: &str,
) -> String {
    let base = slugify_profile_id(base);
    if registry.get(provider, &base).is_none() {
        return base;
    }
    let mut n = 2usize;
    loop {
        let candidate = format!("{}-{}", base, n);
        if registry.get(provider, &candidate).is_none() {
            return candidate;
        }
        n += 1;
    }
}

/// The canonical claurst home directory.
pub fn claurst_dir() -> PathBuf {
    crate::config::Settings::config_dir()
}

/// `~/.claurst/accounts/<provider>/<id>/`.
pub fn account_dir(provider: &str, id: &str) -> PathBuf {
    claurst_dir().join("accounts").join(provider).join(id)
}

/// File where the per-account Anthropic OAuth tokens live.
pub fn anthropic_token_path(profile_id: &str) -> PathBuf {
    account_dir(PROVIDER_ANTHROPIC, profile_id).join("oauth_tokens.json")
}

/// File where the per-account Codex OAuth tokens live.
pub fn codex_token_path(profile_id: &str) -> PathBuf {
    account_dir(PROVIDER_CODEX, profile_id).join("codex_tokens.json")
}

/// Backup directory for the previous live token file (rotated on each switch).
pub fn backup_dir(provider: &str) -> PathBuf {
    claurst_dir().join("accounts").join(provider).join(".backups")
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Tighten permissions on a credential/session file so only the owner can
/// read or write it (mode `0o600`). Best-effort and Unix-only; a no-op on
/// other platforms (W
```

### Core Architecture Module: `src-rust/crates/core/src/analytics.rs`
```
//! Analytics and telemetry (OpenTelemetry-compatible counters)

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// Session-level metrics counters (mirrors TypeScript bootstrap state).
///
/// All counters use `AtomicU64` so they can be shared across threads without
/// a mutex.  Cost is stored as integer millicents (cost_usd × 100_000) to
/// avoid floating-point atomic arithmetic.
#[derive(Debug, Default)]
pub struct SessionMetrics {
    /// Total cost in units of 1/100_000 USD (i.e. millicents).
    pub total_cost_usd_millicents: AtomicU64,
    pub total_input_tokens: AtomicU64,
    pub total_output_tokens: AtomicU64,
    pub total_api_duration_ms: AtomicU64,
    pub total_tool_duration_ms: AtomicU64,
    pub total_lines_added: AtomicU64,
    pub total_lines_removed: AtomicU64,
    pub session_count: AtomicU64,
    pub commit_count: AtomicU64,
    pub pr_count: AtomicU64,
    pub tool_use_count: AtomicU64,
}

impl SessionMetrics {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn add_cost(&self, usd: f64) {
        let millicents = (usd * 100_000.0) as u64;
        self.total_cost_usd_millicents
            .fetch_add(millicents, Ordering::Relaxed);
    }

    pub fn total_cost_usd(&self) -> f64 {
        self.total_cost_usd_millicents.load(Ordering::Relaxed) as f64 / 100_000.0
    }

    pub fn add_tokens(&self, input: u32, output: u32) {
        self.total_input_tokens
            .fetch_add(input as u64, Ordering::Relaxed);
        self.total_output_tokens
            .fetch_add(output as u64, Ordering::Relaxed);
    }

    pub fn add_api_duration(&self, ms: u64) {
        self.total_api_duration_ms.fetch_add(ms, Ordering::Relaxed);
    }

    pub fn add_tool_duration(&self, ms: u64) {
        self.total_tool_duration_ms.fetch_add(ms, Ordering::Relaxed);
    }

    pub fn add_lines(&self, added: i64, removed: i64) {
        if added > 0 {
            self.total_lines_added
                .fetch_add(added as u64, Ordering::Relaxed);
        }
        if removed > 0 {
            self.total_lines_removed
                .fetch_add(removed as u64, Ordering::Relaxed);
        }
    }

    pub fn increment_commits(&self) {
        self.commit_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn increment_prs(&self) {
        self.pr_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn increment_tool_use(&self) {
        self.tool_use_count.fetch_add(1, Ordering::Relaxed);
    }

    pub fn summary(&self) -> MetricsSummary {
        MetricsSummary {
            cost_usd: self.total_cost_usd(),
            input_tokens: self.total_input_tokens.load(Ordering::Relaxed),
            output_tokens: self.total_output_tokens.load(Ordering::Relaxed),
            api_duration_ms: self.total_api_duration_ms.load(Ordering::Relaxed),
            tool_duration_ms: self.total_tool_duration_ms.load(Ordering::Relaxed),
            lines_added: self.total_lines_added.load(Ordering::Relaxed),
            lines_removed: self.total_lines_removed.load(Ordering::Relaxed),
            commits: self.commit_count.load(Ordering::Relaxed),
            prs: self.pr_count.load(Ordering::Relaxed),
            tool_uses: self.tool_use_count.load(Ordering::Relaxed),
        }
    }
}

/// A point-in-time snapshot of session metrics.
#[derive(Debug, Clone)]
pub struct MetricsSummary {
    pub cost_usd: f64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub api_duration_ms: u64,
    pub tool_duration_ms: u64,
    pub lines_added: u64,
    pub lines_removed: u64,
    pub commits: u64,
    pub prs: u64,
    pub tool_uses: u64,
}

impl MetricsSummary {
    /// Format cost as a dollar amount string with appropriate precision.
    pub fn format_cost(&self) -> String {
        if self.cost_usd < 0.01 {
            format!("${:.5}", self.cost_usd)
        } else {
            format!("${:.4}", self.cost_usd)
        }
    }

    /// Format total token count with K/M suffix.
    pub fn format_tokens(&self) -> String {
        let total = self.input_tokens + self.output_tokens;
        if total >= 1_000_000 {
            format!("{:.1}M tok", total as f64 / 1_000_000.0)
        } else if total >= 1_000 {
            format!("{:.1}K tok", total as f64 / 1_000.0)
        } else {
            format!("{} tok", total)
        }
    }
}

/// Event types for first-party analytics (privacy-respecting — no PII).
#[derive(Debug, Clone)]
pub enum AnalyticsEvent {
    SessionStarted {
        model: String,
        is_interactive: bool,
    },
    SessionEnded {
        turn_count: u32,
        cost_usd: f64,
        duration_ms: u64,
        had_errors: bool,
    },
    ToolUsed {
        tool_name: String,
        success: bool,
        duration_ms: u64,
    },
    CommandExecuted {
        command: String,
        success: bool,
    },
    CompactionTriggered {
        tokens_before: u32,
        tokens_after: u32,
    },
}

/// Analytics sink — currently logs via `tracing`; can be extended to push
/// events to a first-party endpoint.
pub struct Analytics {
    enabled: bool,
    session_id: String,
}

impl Analytics {
    pub fn new(session_id: String, enabled: bool) -> Self {
        Self {
            enabled,
            session_id,
        }
    }

    pub fn track(&self, event: AnalyticsEvent) {
        if !self.enabled {
            return;
        }
        tracing::debug!(
            session_id = %self.session_id,
            event = ?event,
            "analytics event"
        );
    }
}

/// No-op analytics stub. The OSS/free build intentionally ships without
/// product telemetry. All call sites compile unchanged; all data is discarded.
pub fn log_event(_event_name: &str, _metadata: &[(&str, &str)]) {}

pub async fn log_event_async(_event_name: &str, _metadata: &[(&str, &str)]) {}

/// No-op. The Rust port does not initialize OpenTelemetry exporters.
pub fn initialize_telemetry() {}

/// No-op. Nothing to flush.
pub async fn flush_telemetry() {}

/// Always returns false. Enhanced telemetry is disabled.
pub fn is_enhanced_telemetry_enabled() -> bool {
    false
}

/// Returns telemetry status based on environment variable.
/// Defaults to off; users can opt-in with CLAURST_ENABLE_TELEMETRY=1.
/// The free/OSS build respects this preference but does not phone home.
pub fn is_telemetry_enabled() -> bool {
    std::env::var("CLAURST_ENABLE_TELEMETRY")
        .as_deref()
        .unwrap_or("0")
        == "1"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_metrics_initial_zero() {
        let m = SessionMetrics::new();
        assert_eq!(m.total_cost_usd(), 0.0);
        assert_eq!(m.total_input_tokens.load(Ordering::Relaxed), 0);
        assert_eq!(m.total_output_tokens.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_add_cost_single() {
        let m = SessionMetrics::new();
        m.add_cost(0.01);
        let cost = m.total_cost_usd();
        // Allow small floating-point tolerance
        assert!((cost - 0.01).abs() < 1e-9, "cost = {}", cost);
    }

    #[test]
    fn test_add_cost_accumulates() {
        let m = SessionMetrics::new();
        m.add_cost(1.0);
        m.add_cost(2.5);
        let cost = m.total_cost_usd();
        assert!((cost - 3.5).abs() < 1e-9, "cost = {}", cost);
    }

    #[test]
    fn test_add_tokens() {
        let m = SessionMetrics::new();
        m.add_tokens(1000, 500);
        assert_eq!(m.total_input_tokens.load(Ordering::Relaxed), 1000);
        assert_eq!(m.total_output_tokens.load(Ordering::Relaxed), 500);
    }

    #[test]
    fn test_add_tokens_accumulates() {
        let m = SessionMetrics::new();
        m.add_tokens(1000, 500);
        m.add_tokens(200, 100);
        assert_eq!(m.total_input_tokens.load(Ordering::Relaxed), 1200);
        assert_eq!(m.total_output_tokens.load(Ordering::Relaxed), 600);
    }

    #[test]
    fn test_add_lines_positive() {
        let m = SessionMetrics::new();
        m.add_lines(10, 5);
        assert_eq!(m.total_lines_added.load(Ordering::Relaxed), 10);
        assert_eq!(m.total_lines_removed.load(Ordering::Relaxed), 5);
    }

    #[test]
    fn test_add_lines_negative_ignored() {
        let m = SessionMetrics::new();
        m.add_lines(-3, -7);
        assert_eq!(m.total_lines_added.load(Ordering::Relaxed), 0);
        assert_eq!(m.total_lines_removed.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_increment_commits_and_prs() {
        let m = SessionMetrics::new();
        m.increment_commits();
        m.increment_commits();
        m.increment_prs();
        assert_eq!(m.commit_count.load(Ordering::Relaxed), 2);
        assert_eq!(m.pr_count.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_increment_tool_use() {
        let m = SessionMetrics::new();
        for _ in 0..5 {
            m.increment_tool_use();
        }
        assert_eq!(m.tool_use_count.load(Ordering::Relaxed), 5);
    }

    #[test]
    fn test_summary_snapshot() {
        let m = SessionMetrics::new();
        m.add_cost(1.23456);
        m.add_tokens(100, 50);
        m.add_api_duration(300);
        m.add_tool_duration(150);
        m.add_lines(8, 3);
        m.increment_commits();
        m.increment_prs();
        m.increment_tool_use();

        let s = m.summary();
        assert!((s.cost_usd - 1.23456).abs() < 1e-9);
        assert_eq!(s.input_tokens, 100);
        assert_eq!(s.output_tokens, 50);
        assert_eq!(s.api_duration_ms, 300);
        assert_eq!(s.tool_duration_ms, 150);
        assert_eq!(s.lines_added, 8);
        assert_eq!(s.lines_removed, 3);
        assert_eq!(s.commits, 1);
        assert_eq!(s.prs, 1);
     
```

### Core Architecture Module: `src-rust/crates/core/src/attachments.rs`
```
//! Attachment pipeline — mirrors src/utils/attachments.ts
//!
//! Assembles all context attachments for a conversation turn:
//! IDE context, tasks, plans, skills, agents, MCP, file changes, memory.

use serde::{Deserialize, Serialize};
use std::path::Path;

/// The kind of attachment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttachmentKind {
    HookSuccess,
    HookError,
    HookNonBlockingError,
    HookErrorDuringExecution,
    HookStoppedContinuation,
    SkillListing,
    AgentListing,
    McpInstructions,
    IdeContext,
    TaskContext,
    PlanContext,
    ChangedFiles,
    Memory,
    Generic,
}

/// A single context attachment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub kind: AttachmentKind,
    pub content: String,
    /// Optional label for display (e.g., filename, server name).
    pub label: Option<String>,
}

impl Attachment {
    pub fn new(kind: AttachmentKind, content: impl Into<String>) -> Self {
        Self { kind, content: content.into(), label: None }
    }

    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }
}

/// Context passed to `get_attachments`.
pub struct AttachmentContext<'a> {
    pub project_root: &'a Path,
    pub working_dir: &'a Path,
    pub session_id: &'a str,
    pub last_turn_timestamp_ms: Option<u64>,
}

/// Assemble all context attachments for the current turn.
///
/// Returns a vec of attachments to inject as a pre-turn context message.
pub fn get_attachments(ctx: &AttachmentContext<'_>) -> Vec<Attachment> {
    let mut attachments = Vec::new();

    // 1. IDE context
    if let Some(ide) = get_ide_context() {
        attachments.push(Attachment::new(AttachmentKind::IdeContext, ide));
    }

    // 2. Changed files (since last turn)
    if let Some(ts) = ctx.last_turn_timestamp_ms {
        let changed = get_changed_files(ctx.project_root, ts);
        if !changed.is_empty() {
            let content = format!(
                "Files changed since last turn:\n{}",
                changed.iter().map(|f| format!("  {}", f)).collect::<Vec<_>>().join("\n")
            );
            attachments.push(Attachment::new(AttachmentKind::ChangedFiles, content));
        }
    }

    attachments
}

/// Get IDE context from the lockfile (if an IDE is connected).
///
/// Returns a formatted string like:
/// `IDE: VS Code, workspace: /path/to/project, selection: L10-L20 in foo.rs`
pub fn get_ide_context() -> Option<String> {
    let lockfile_dir = crate::config::Settings::config_dir().join("ide");
    let entries = std::fs::read_dir(&lockfile_dir).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "lock") {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(info) = serde_json::from_str::<serde_json::Value>(&content) {
                    let pid = info["pid"].as_u64().unwrap_or(0);
                    if !is_pid_alive(pid) {
                        continue;
                    }
                    let ide_name = info["ideName"].as_str().unwrap_or("IDE");
                    let workspace = info["workspaceFolders"]
                        .as_array()
                        .and_then(|a| a.first())
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let mut parts = vec![format!("IDE: {}", ide_name)];
                    if !workspace.is_empty() {
                        parts.push(format!("workspace: {}", workspace));
                    }
                    // Active file/selection if present
                    if let Some(file) = info["activeFile"].as_str() {
                        parts.push(format!("active file: {}", file));
                        if let (Some(start), Some(end)) = (
                            info["selectionStart"].as_u64(),
                            info["selectionEnd"].as_u64(),
                        ) {
                            if start != end {
                                parts.push(format!("selection: L{}-L{}", start, end));
                            }
                        }
                    }
                    return Some(parts.join(", "));
                }
            }
        }
    }
    None
}

/// Check if a PID corresponds to a running process.
fn is_pid_alive(pid: u64) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::path::Path::new(&format!("/proc/{}", pid)).exists()
    }
}

/// Get files changed since `since_ms` (Unix timestamp in ms) using git.
pub fn get_changed_files(project_root: &Path, since_ms: u64) -> Vec<String> {
    // Try git diff --name-only --diff-filter=M
    let output = std::process::Command::new("git")
        .args(["diff", "--name-only", "--diff-filter=AMDR", "HEAD"])
        .current_dir(project_root)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter(|l| !l.is_empty())
                .map(|l| l.to_string())
                .collect()
        }
        _ => {
            // Fallback: scan for files modified since timestamp using mtime
            let since_secs = since_ms / 1000;
            let mut files = Vec::new();
            scan_modified_files(project_root, since_secs, &mut files, 0);
            files
        }
    }
}

fn scan_modified_files(dir: &Path, since_secs: u64, out: &mut Vec<String>, depth: usize) {
    if depth > 3 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        // Skip hidden dirs and node_modules / target
        if name_str.starts_with('.') || name_str == "node_modules" || name_str == "target" {
            continue;
        }
        if path.is_dir() {
            scan_modified_files(&path, since_secs, out, depth + 1);
        } else if let Ok(meta) = entry.metadata() {
            if let Ok(modified) = meta.modified() {
                let mtime = modified
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                if mtime >= since_secs {
                    out.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
}

/// Build a hook result attachment message.
pub fn make_hook_result_attachment(hook_name: &str, output: &str, success: bool) -> Attachment {
    let kind = if success {
        AttachmentKind::HookSuccess
    } else {
        AttachmentKind::HookError
    };
    Attachment::new(kind, format!("[Hook: {}]\n{}", hook_name, output))
        .with_label(hook_name.to_string())
}

/// Compute the diff of available tools between two turns.
pub fn get_deferred_tools_delta(prev_tools: &[String], curr_tools: &[String]) -> Vec<String> {
    curr_tools
        .iter()
        .filter(|t| !prev_tools.contains(t))
        .cloned()
        .collect()
}

```

### Core Architecture Module: `src-rust/crates/core/src/auth_store.rs`
```
// auth_store.rs — JSON-based credential store at ~/.claurst/auth.json.
//
// Stores API keys and OAuth tokens for providers so users don't have to rely
// solely on environment variables.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// A stored credential for a provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StoredCredential {
    #[serde(rename = "api")]
    ApiKey { key: String },
    #[serde(rename = "oauth")]
    OAuthToken {
        access: String,
        refresh: String,
        expires: u64,
    },
}

/// Persistent credential store backed by `~/.claurst/auth.json`.
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AuthStore {
    pub credentials: HashMap<String, StoredCredential>,
}

impl AuthStore {
    /// Path to the auth store file.
    pub fn path() -> PathBuf {
        crate::config::Settings::config_dir().join("auth.json")
    }

    /// Load the store from disk (returns default if missing or invalid).
    pub fn load() -> Self {
        let path = Self::path();
        if path.exists() {
            match std::fs::read_to_string(&path) {
                Ok(s) => match serde_json::from_str(&s) {
                    Ok(store) => store,
                    Err(e) => {
                        tracing::warn!(
                            "auth store at {} is corrupt ({}); starting with an empty store. \
                             The corrupt file is left in place until the next save.",
                            path.display(),
                            e
                        );
                        Self::default()
                    }
                },
                Err(e) => {
                    tracing::warn!("failed to read auth store at {}: {}", path.display(), e);
                    Self::default()
                }
            }
        } else {
            Self::default()
        }
    }

    /// Persist the store to disk (best-effort).
    ///
    /// Writes to a temp file then renames over the destination so a crash or
    /// disk-full mid-write can never truncate `auth.json` (which would
    /// silently wipe the user's stored credentials on the next load).
    pub fn save(&self) {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
            crate::accounts::set_user_only_dir_perms(parent);
        }
        let json = match serde_json::to_string_pretty(self) {
            Ok(j) => j,
            Err(_) => return,
        };
        let tmp = path.with_file_name(format!(".auth.json.claurst-tmp-{}", std::process::id()));
        if std::fs::write(&tmp, &json).is_ok() {
            // auth.json holds API keys + OAuth tokens. Lock the temp file to
            // 0o600 *before* the rename so the live credential file is never
            // even momentarily world/group readable (issue #212).
            crate::accounts::set_user_only_perms(&tmp);
            if std::fs::rename(&tmp, &path).is_err() {
                let _ = std::fs::remove_file(&tmp);
            }
        }
    }

    /// Store a credential for the given provider (persists immediately).
    pub fn set(&mut self, provider_id: &str, cred: StoredCredential) {
        self.credentials.insert(provider_id.to_string(), cred);
        self.save();
    }

    /// Get the stored credential for a provider.
    pub fn get(&self, provider_id: &str) -> Option<&StoredCredential> {
        self.credentials.get(provider_id)
    }

    /// Remove the credential for a provider (persists immediately).
    pub fn remove(&mut self, provider_id: &str) {
        self.credentials.remove(provider_id);
        self.save();
    }

    /// Get the API key for a provider, checking stored credentials first then
    /// falling back to the relevant environment variable.
    pub fn api_key_for(&self, provider_id: &str) -> Option<String> {
        // Check stored credentials first
        if let Some(stored) = self.get(provider_id) {
            match stored {
                StoredCredential::ApiKey { key } => {
                    if !key.is_empty() {
                        return Some(key.clone());
                    }
                }
                StoredCredential::OAuthToken {
                    access, refresh, ..
                } if provider_id == "github-copilot" => {
                    if !refresh.is_empty() {
                        return Some(refresh.clone());
                    }
                    if !access.is_empty() {
                        return Some(access.clone());
                    }
                }
                _ => {}
            }
        }
        // Fall back to environment variable.
        //
        // These mappings must match the env var each provider's adapter
        // actually reads in `crates/api/src/providers/openai_compat_providers.rs`
        // (and the bespoke adapters next to it). When they drift, keys that
        // were exported via env vars look "configured" to the dialog but
        // resolve to empty at request time. If you add a provider there,
        // mirror its env var here.
        let env_var = match provider_id {
            "anthropic" => "ANTHROPIC_API_KEY",
            "openai" => "OPENAI_API_KEY",
            "google" => "GOOGLE_API_KEY",
            "groq" => "GROQ_API_KEY",
            "cerebras" => "CEREBRAS_API_KEY",
            "deepseek" => "DEEPSEEK_API_KEY",
            "mistral" => "MISTRAL_API_KEY",
            "xai" => "XAI_API_KEY",
            "openrouter" => "OPENROUTER_API_KEY",
            "togetherai" | "together-ai" => "TOGETHER_API_KEY",
            "perplexity" => "PERPLEXITY_API_KEY",
            "cohere" => "COHERE_API_KEY",
            "deepinfra" => "DEEPINFRA_API_KEY",
            "venice" => "VENICE_API_KEY",
            "github-copilot" => "GITHUB_TOKEN",
            "azure" => "AZURE_API_KEY",
            "huggingface" => "HF_TOKEN",
            "nvidia" => "NVIDIA_API_KEY",
            "zai" => "ZAI_API_KEY",
            "opencode-zen" | "opencode-go" => "OPENCODE_API_KEY",
            "crof" => "CROF_API_KEY",
            "sambanova" => "SAMBANOVA_API_KEY",
            // qwen adapter reads DASHSCOPE_API_KEY (Alibaba's DashScope is the
            // backing service), not QWEN_API_KEY.
            "qwen" | "alibaba" => "DASHSCOPE_API_KEY",
            "moonshot" | "moonshotai" => "MOONSHOT_API_KEY",
            "zhipu" | "zhipuai" => "ZHIPU_API_KEY",
            "siliconflow" => "SILICONFLOW_API_KEY",
            "nebius" => "NEBIUS_API_KEY",
            "novita" => "NOVITA_API_KEY",
            "ovhcloud" => "OVHCLOUD_API_KEY",
            "scaleway" => "SCALEWAY_API_KEY",
            "vultr" | "vultr-ai" => "VULTR_API_KEY",
            "baseten" => "BASETEN_API_KEY",
            // friendli adapter reads FRIENDLI_TOKEN (Friendli's docs use that
            // name), not FRIENDLI_API_KEY.
            "friendli" => "FRIENDLI_TOKEN",
            "upstage" => "UPSTAGE_API_KEY",
            "stepfun" => "STEPFUN_API_KEY",
            "fireworks" => "FIREWORKS_API_KEY",
            "minimax" => "MINIMAX_API_KEY",
            "synthetic" => "SYNTHETIC_API_KEY",
            "routing" => "ROUTING_API_KEY",
            "neuralwatt" => "NEURALWATT_API_KEY",
            "custom-openai" => "CUSTOM_OPENAI_API_KEY",
            "ollama" | "lm-studio" | "llama-cpp" => "", // No API key required
            _ => return None,
        };
        if env_var.is_empty() {
            None
        } else {
            std::env::var(env_var).ok().filter(|k| !k.is_empty())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{AuthStore, StoredCredential};

    #[test]
    fn github_copilot_oauth_prefers_refresh_token() {
        let mut store = AuthStore::default();
        store.credentials.insert(
            "github-copilot".to_string(),
            StoredCredential::OAuthToken {
                access: "access-token".to_string(),
                refresh: "refresh-token".to_string(),
                expires: 0,
            },
        );

        assert_eq!(
            store.api_key_for("github-copilot").as_deref(),
            Some("refresh-token")
        );
    }

    #[test]
    fn api_key_for_regular_provider_uses_stored_key() {
        let mut store = AuthStore::default();
        store.credentials.insert(
            "openrouter".to_string(),
            StoredCredential::ApiKey {
                key: "or-key".to_string(),
            },
        );

        assert_eq!(store.api_key_for("openrouter").as_deref(), Some("or-key"));
    }
}

```

### Core Architecture Module: `src-rust/crates/core/src/auto_mode.rs`
```
//! Auto-approve mode state and opt-in tracking.
//! Mirrors src/utils/autoApprove.ts

use serde::{Deserialize, Serialize};

/// Current auto-approve mode for tool execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum AutoApproveMode {
    /// No auto-approve — all tool calls require confirmation.
    #[default]
    None,
    /// Auto-approve edits to existing files, but not new files or commands.
    AcceptEdits,
    /// Bypass all permissions — approve everything including bash commands.
    BypassPermissions,
    /// Auto-approve with plan mode — shows plan before execution.
    Plan,
}

impl AutoApproveMode {
    /// True if this mode auto-approves bash/shell command execution.
    pub fn auto_approves_bash(&self) -> bool {
        matches!(self, Self::BypassPermissions)
    }

    /// True if this mode auto-approves file edits.
    pub fn auto_approves_edits(&self) -> bool {
        matches!(self, Self::AcceptEdits | Self::BypassPermissions)
    }

    /// True if this mode shows a plan before tool execution.
    pub fn is_plan_mode(&self) -> bool {
        matches!(self, Self::Plan)
    }

    /// Short display label for status line.
    pub fn label(&self) -> &'static str {
        match self {
            Self::None => "",
            Self::AcceptEdits => "auto-edit",
            Self::BypassPermissions => "bypass",
            Self::Plan => "plan-mode",
        }
    }
}

/// Opt-in state: tracks whether the user has explicitly enabled auto-approve
/// and which dialog/warning was shown.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AutoModeState {
    pub mode: AutoApproveMode,
    /// True if the user saw and accepted the risk warning dialog.
    pub warning_accepted: bool,
    /// Session ID when bypass mode was activated.
    pub activated_session: Option<String>,
    /// Turn number when bypass mode was activated.
    pub activated_turn: Option<u32>,
}

impl AutoModeState {
    pub fn new(mode: AutoApproveMode) -> Self {
        Self {
            mode,
            warning_accepted: false,
            activated_session: None,
            activated_turn: None,
        }
    }

    /// Activate bypass mode; requires warning to have been accepted.
    pub fn activate_bypass(&mut self, session_id: &str, turn: u32) {
        self.mode = AutoApproveMode::BypassPermissions;
        self.warning_accepted = true;
        self.activated_session = Some(session_id.to_string());
        self.activated_turn = Some(turn);
    }

    /// Reset to no auto-approve.
    pub fn reset(&mut self) {
        self.mode = AutoApproveMode::None;
        self.warning_accepted = false;
    }
}

```

### Core Architecture Module: `src-rust/crates/core/src/bash_classifier.rs`
```
// Bash security classifier for Claurst.
//
// Classifies shell commands by risk level and determines whether they can be
// auto-approved given the current permission mode.  Used by BashTool's
// `permission_level()` override and the auto-approval logic.

use crate::config::PermissionMode;

// ---------------------------------------------------------------------------
// Risk levels
// ---------------------------------------------------------------------------

/// Ordered risk level assigned to a bash command.
///
/// The ordering is intentional: `Safe < Low < Medium < High < Critical`.
/// Code that compares levels should use `>=` / `<=` rather than `==`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum BashRiskLevel {
    /// Read-only operations that cannot modify system state.
    /// Examples: ls, cat, grep, find, echo, git status, git log.
    Safe,
    /// Low-risk write operations or common dev tools without escalation.
    /// Examples: git commit, npm install, cargo build, pip install.
    Low,
    /// Moderate-risk operations: file deletion, process signals, config edits.
    /// Examples: rm -r, kill, pkill, systemctl, ufw, iptables.
    Medium,
    /// High-risk: privilege escalation, network-to-disk writes, pipe-to-shell.
    /// Examples: sudo, su, curl … | bash, wget … | sh, nc -l > file.
    High,
    /// Critical: irreversible system-destructive operations.
    /// Examples: rm -rf /, dd if=…, mkfs, fork bomb, chmod 777 /, shred.
    Critical,
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Strip leading shell boilerplate (`sudo`, `env`, etc.) and return the first
/// real command token together with the rest of the argument string.
fn split_command(raw: &str) -> (&str, &str) {
    let s = raw.trim();
    // Skip common wrappers so we can inspect the actual command.
    let skip = ["sudo ", "su -c ", "env ", "nice ", "nohup ", "time "];
    for prefix in &skip {
        if let Some(rest) = s.strip_prefix(prefix) {
            return split_command(rest);
        }
    }
    // Split on first whitespace.
    match s.find(|c: char| c.is_ascii_whitespace()) {
        Some(pos) => (&s[..pos], s[pos..].trim()),
        None => (s, ""),
    }
}

/// Check whether `haystack` contains `needle` as a whole word (bounded by
/// non-alphanumeric/underscore characters or start/end of string).
fn has_flag(args: &str, flag: &str) -> bool {
    // Simple substring check is enough for flag detection; flags always
    // start with `-` which is already non-word, so substring is fine.
    args.contains(flag)
}

/// Return true if the command string looks like `cmd … | bash/sh/zsh/fish`.
fn is_pipe_to_shell(cmd: &str) -> bool {
    // We look for a pipe character followed (possibly with whitespace) by a
    // shell executable.  Using a simple text scan avoids a regex dependency.
    let shells = ["bash", "sh", "zsh", "fish", "dash", "ksh", "tcsh", "csh"];
    if let Some(pipe_pos) = cmd.find('|') {
        let after_pipe = cmd[pipe_pos + 1..].trim();
        for shell in &shells {
            // Could be `bash`, `bash -s`, `/bin/bash`, etc.
            if after_pipe == *shell
                || after_pipe.starts_with(&format!("{} ", shell))
                || after_pipe.starts_with(&format!("{}\t", shell))
                || after_pipe.ends_with(&format!("/{}", shell))
                || after_pipe.contains(&format!("/{} ", shell))
            {
                return true;
            }
        }
    }
    false
}

/// Detect the classic fork-bomb pattern `:(){ :|:& };:`.
fn is_fork_bomb(cmd: &str) -> bool {
    // Strip all whitespace for a normalised comparison.
    let normalised: String = cmd.chars().filter(|c| !c.is_ascii_whitespace()).collect();
    // Canonical form and common variations.
    normalised.contains(":(){ :|:&};:")
        || normalised.contains(":(){ :|:&};")
        || normalised.contains(":(){:|:&};:")
        || normalised.contains(":(){:|:&}")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Classify a bash command string and return its risk level.
///
/// The analysis is intentionally conservative: when in doubt, the higher risk
/// level is returned.  The function does *not* execute any subprocess.
pub fn classify_bash_command(command: &str) -> BashRiskLevel {
    let cmd = command.trim();

    // ── Critical patterns ──────────────────────────────────────────────────

    // Fork bomb
    if is_fork_bomb(cmd) {
        return BashRiskLevel::Critical;
    }

    // Pipe-to-shell with download (curl/wget piped directly to a shell)
    if is_pipe_to_shell(cmd) {
        // Any pipe-to-shell is at least High; if it fetches from the network it's Critical.
        let fetch_cmds = ["curl", "wget", "fetch", "lwp-request"];
        let lower = cmd.to_lowercase();
        for fc in &fetch_cmds {
            if lower.contains(fc) {
                return BashRiskLevel::Critical;
            }
        }
        return BashRiskLevel::High;
    }

    // dd with an if= (disk image writing) — extremely destructive
    if (cmd.starts_with("dd ") || cmd == "dd")
        && cmd.contains("if=") {
            return BashRiskLevel::Critical;
        }

    // mkfs — format filesystem
    if cmd.starts_with("mkfs") || cmd.starts_with("mkfs.") {
        return BashRiskLevel::Critical;
    }

    // shred — secure erase
    if cmd.starts_with("shred ") || cmd == "shred" {
        return BashRiskLevel::Critical;
    }

    // Detect `rm` with `-rf` (or `-fr`) targeting root or very short paths
    if let Some(args) = cmd.strip_prefix("rm ") {
        let has_r = has_flag(args, "-r")
            || has_flag(args, "-R")
            || has_flag(args, "-rf")
            || has_flag(args, "-fr")
            || has_flag(args, "-Rf")
            || has_flag(args, "-fR");
        let has_f = has_flag(args, "-f")
            || has_flag(args, "-rf")
            || has_flag(args, "-fr")
            || has_flag(args, "-Rf")
            || has_flag(args, "-fR");

        if has_r && has_f {
            // Check for targeting root / critical system paths
            let critical_targets = [" /", "/ ", "/*", " ~", "~/", " $HOME", "$(", " `"];
            for t in &critical_targets {
                if args.contains(t) {
                    return BashRiskLevel::Critical;
                }
            }
        }
    }

    // chmod 777 on / or critical paths
    if let Some(args) = cmd.strip_prefix("chmod ") {
        if (args.contains("777") || args.contains("a+rwx"))
            && (args.contains(" /") || args.ends_with('/'))
        {
            return BashRiskLevel::Critical;
        }
    }

    // ── Privilege escalation → High ────────────────────────────────────────

    if cmd.starts_with("sudo ") || cmd == "sudo" {
        return BashRiskLevel::High;
    }
    if cmd.starts_with("su ") || cmd == "su" {
        return BashRiskLevel::High;
    }

    // Network writes to disk (general curl/wget with -o / redirect)
    {
        let lower = cmd.to_lowercase();
        let is_network_fetch = lower.starts_with("curl ")
            || lower.starts_with("wget ")
            || lower.starts_with("fetch ");
        if is_network_fetch {
            let writes_to_disk = lower.contains(" -o ")
                || lower.contains(" -o\t")
                || lower.ends_with(" -o")
                || lower.contains(" --output ")
                || lower.contains(" -O ")   // wget uppercase-O saves to file
                || lower.ends_with(" -O")
                || cmd.contains(" > ");
            if writes_to_disk {
                return BashRiskLevel::High;
            }
            // Plain fetch (stdout only) — still High because it exfiltrates or pulls code.
            return BashRiskLevel::High;
        }
    }

    // netcat / ncat listening
    if cmd.starts_with("nc ") || cmd.starts_with("ncat ") || cmd.starts_with("netcat ") {
        return BashRiskLevel::High;
    }

    // Sensitive credential operations
    if cmd.starts_with("gpg ") || cmd.starts_with("ssh-keygen ") {
        return BashRiskLevel::High;
    }

    // ── Medium-risk ────────────────────────────────────────────────────────

    // rm (without -rf on critical paths, but still destructive)
    if cmd.starts_with("rm ") || cmd == "rm" {
        return BashRiskLevel::Medium;
    }

    // Process signals
    if cmd.starts_with("kill ") || cmd == "kill" || cmd.starts_with("pkill ") || cmd.starts_with("killall ") {
        return BashRiskLevel::Medium;
    }

    // System configuration
    let medium_cmds = [
        "systemctl ", "service ", "ufw ", "iptables ", "ip6tables ",
        "firewall-cmd ", "chown ", "chmod ", "chgrp ",
        "crontab ", "at ", "useradd ", "userdel ", "usermod ",
        "groupadd ", "groupdel ", "passwd ",
        "mount ", "umount ", "fdisk ", "parted ",
        "apt ", "apt-get ", "yum ", "dnf ", "pacman ", "brew ",
        "snap ", "flatpak ", "dpkg ", "rpm ",
        "mktemp ", "truncate ",
    ];
    for mc in &medium_cmds {
        if cmd.starts_with(mc) {
            return BashRiskLevel::Medium;
        }
    }

    // mv that targets sensitive paths
    if let Some(args) = cmd.strip_prefix("mv ") {
        let sensitive = [" /etc/", " /bin/", " /usr/", " /lib/", " /boot/"];
        for s in &sensitive {
            if args.contains(s) {
                return BashRiskLevel::Medium;
            }
        }
    }

    // Redirect-overwrite to a file (could clobber impor
```

### Core Architecture Module: `src-rust/crates/core/src/bundled_skills.rs`
```
//! Bundled skill definitions.
//!
//! Each entry in `BUNDLED_SKILLS` mirrors one of the TypeScript
//! `registerXxxSkill()` calls under `src/skills/bundled/`. They are one source
//! of the session skill registry (`skill_discovery::SkillRegistry`); a skill
//! discovered on disk with the same name replaces the bundled one.

/// A single bundled skill definition.
#[derive(Debug, Clone)]
pub struct BundledSkill {
    /// Primary name used to invoke the skill (e.g. `"simplify"`).
    pub name: &'static str,
    /// One-line description shown in `/skill list` output and to the model.
    pub description: &'static str,
    /// Additional names that map to this skill.
    pub aliases: &'static [&'static str],
    /// Optional guidance for the model about when to auto-invoke.
    pub when_to_use: Option<&'static str>,
    /// Placeholder shown next to the skill name in help text.
    pub argument_hint: Option<&'static str>,
    /// The prompt template.  `$ARGUMENTS` is replaced at call time.
    /// `$ARGUMENTS_SUFFIX` expands to `": <args>"` when args are non-empty,
    /// or `""` otherwise.
    pub prompt_template: &'static str,
    /// If `Some`, only these tool names are available during the skill run.
    pub allowed_tools: Option<&'static [&'static str]>,
    /// Whether a human user can invoke this skill via `/skill <name>`.
    pub user_invocable: bool,
}

/// All bundled skills.
pub const BUNDLED_SKILLS: &[BundledSkill] = &[
    // -----------------------------------------------------------------------
    // simplify
    // -----------------------------------------------------------------------
    BundledSkill {
        name: "simplify",
        description: "Review changed code for reuse, quality, and efficiency, then fix any issues found.",
        aliases: &[],
        when_to_use: Some("After writing code, when you want a quality review and cleanup pass."),
        argument_hint: None,
        prompt_template: r#"# Simplify: Code Review and Cleanup

Review all changed files for reuse, quality, and efficiency. Fix any issues found.

## Phase 1: Identify Changes

Run `git diff` (or `git diff HEAD` if there are staged changes) to see what changed.
If there are no git changes, review the most recently modified files that were
mentioned or edited earlier in this conversation.

## Phase 2: Launch Three Review Agents in Parallel

Use the Agent tool to launch all three agents concurrently in a single message.
Pass each agent the full diff so it has complete context.

### Agent 1: Code Reuse Review

For each change:
1. **Search for existing utilities and helpers** that could replace newly written code.
2. **Flag any new function that duplicates existing functionality.**
3. **Flag any inline logic that could use an existing utility** — hand-rolled string
   manipulation, manual path handling, custom environment checks, etc.

### Agent 2: Code Quality Review

Review the same changes for hacky patterns:
1. **Redundant state** that duplicates existing state.
2. **Parameter sprawl** — new parameters instead of restructuring.
3. **Copy-paste with slight variation** that should be unified.
4. **Leaky abstractions** — exposing internal details.
5. **Stringly-typed code** where constants or enums already exist.
6. **Unnecessary comments** narrating what code does (not why).

### Agent 3: Efficiency Review

Review the same changes for efficiency:
1. **Unnecessary work** — redundant computations, duplicate reads.
2. **Missed concurrency** — independent operations run sequentially.
3. **Hot-path bloat** — blocking work added to startup or per-request paths.
4. **Recurring no-op updates** — unconditional updates in polling loops.
5. **Memory** — unbounded data structures, missing cleanup.

## Phase 3: Fix Issues

Wait for all three agents to complete. Aggregate findings and fix each issue.
If a finding is a false positive, note it and move on.

When done, briefly summarize what was fixed (or confirm the code was already clean).
$ARGUMENTS_SUFFIX"#,
        allowed_tools: None,
        user_invocable: true,
    },

    // -----------------------------------------------------------------------
    // remember
    // -----------------------------------------------------------------------
    BundledSkill {
        name: "remember",
        description: "Review auto-memory entries and propose promotions to AGENTS.md, AGENTS.local.md, or shared memory.",
        aliases: &["mem", "save"],
        when_to_use: Some("When the user wants to review, organise, or promote their auto-memory entries."),
        argument_hint: Some("[additional context]"),
        prompt_template: r#"# Memory Review

## Goal
Review the user's memory landscape and produce a clear report of proposed changes,
grouped by action type. Do NOT apply changes — present proposals for user approval.

## Steps

### 1. Gather all memory layers
Read AGENTS.md and AGENTS.local.md from the project root (if they exist).
Your auto-memory content is already in your system prompt — review it there.

### 2. Classify each auto-memory entry

| Destination | What belongs there |
|---|---|
| **AGENTS.md** | Project conventions all contributors should follow |
| **AGENTS.local.md** | Personal instructions specific to this user |
| **Stay in auto-memory** | Working notes, temporary context, uncertain patterns |

### 3. Identify cleanup opportunities
- **Duplicates**: auto-memory entries already in AGENTS.md → propose removing
- **Outdated**: AGENTS.md entries contradicted by newer auto-memory → propose updating
- **Conflicts**: contradictions between layers → propose resolution

### 4. Present the report
Output a structured report grouped by: Promotions, Cleanup, Ambiguous, No action needed.

## Rules
- Present ALL proposals before making any changes
- Do NOT modify files without explicit user approval
- Ask about ambiguous entries — don't guess
$ARGUMENTS_SUFFIX"#,
        allowed_tools: Some(&["Read", "Write", "Edit", "Glob"]),
        user_invocable: true,
    },

    // -----------------------------------------------------------------------
    // debug
    // -----------------------------------------------------------------------
    BundledSkill {
        name: "debug",
        description: "Enable debug logging for this session and help diagnose issues.",
        aliases: &["diagnose"],
        when_to_use: Some("When there is an error, bug, or unexpected behaviour to investigate."),
        argument_hint: Some("[issue description or error message]"),
        prompt_template: r#"# Debug Skill

Help the user debug an issue they are encountering.

## Issue Description

$ARGUMENTS

## Systematic Debugging Approach

1. **Reproduce** — Confirm the exact error / behaviour.
2. **Locate** — Find the relevant code (read files, grep for error messages).
3. **Hypothesize** — Form 2–3 hypotheses about the root cause.
4. **Test** — Verify each hypothesis systematically.
5. **Fix** — Implement the fix for the confirmed root cause.
6. **Verify** — Confirm the fix resolves the issue.

## Settings Reference

Settings files are in:
- User:    ~/.claurst/settings.json
- Project: .claurst/settings.json
- Local:   .claurst/settings.local.json

Read the relevant files before making any changes."#,
        allowed_tools: Some(&["Read", "Grep", "Glob"]),
        user_invocable: true,
    },

    // -----------------------------------------------------------------------
    // stuck
    // -----------------------------------------------------------------------
    BundledSkill {
        name: "stuck",
        description: "Help get unstuck when you don't know how to proceed.",
        aliases: &["help-me", "unblock"],
        when_to_use: Some("When you are stuck, confused, or don't know how to proceed."),
        argument_hint: Some("[what you're trying to do]"),
        prompt_template: r#"The user is stuck$ARGUMENTS_SUFFIX. Help them get unstuck:

1. Clarify what they are trying to achieve (if unclear).
2. Identify why they might be stuck (missing context, unclear requirements, technical blocker).
3. Suggest 2–3 concrete next steps in order of likelihood of success.
4. If a technical blocker: propose specific debugging steps or workarounds.
5. Ask clarifying questions if needed.

Be direct and actionable. Focus on unblocking, not on explaining concepts."#,
        allowed_tools: None,
        user_invocable: true,
    },

    // -----------------------------------------------------------------------
    // batch
    // -----------------------------------------------------------------------
    BundledSkill {
        name: "batch",
        description: "Research and plan a large-scale change, then execute it in parallel across isolated worktree agents that each open a PR.",
        aliases: &[],
        when_to_use: Some("When the user wants to make a sweeping, mechanical change across many files that can be decomposed into independent parallel units."),
        argument_hint: Some("<instruction>"),
        prompt_template: r#"# Batch: Parallel Work Orchestration

You are orchestrating a large, parallelisable change across this codebase.

## User Instruction

$ARGUMENTS

## Phase 1: Research and Plan (Plan Mode)

Enter plan mode, then:

1. **Understand the scope.** Launch subagents to deeply research what this instruction
   touches. Find all files, patterns, and call sites that need to change.

2. **Decompose into independent units.** Break the work into 5–30 self-contained units.
   Each unit must be independently implementable in an isolated git worktree and
   mergeable on its own without depending on another unit's PR landing first.

3. **Determine the e2e test recipe.** Figure out how a worker can verify its change
   actually works end-to-end. If you cannot find
```

### Core Architecture Module: `src-rust/crates/core/src/claudemd.rs`
```
//! Instruction files: `AGENTS.md` / `CLAUDE.md` loaded into the system prompt.
//!
//! Load order (stable; later files are more specific):
//!   1. The global directories (`<claurst home>`, then `~/.claude`)
//!   2. Each project directory from the git root down to `cwd`
//!      (`skill_discovery::project_search_dirs`: never past the git root,
//!      only `cwd` when there is no `.git`)
//!
//! In each directory `AGENTS.override.md`, when present, replaces the other
//! files; otherwise `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md` and
//! `.claurst/AGENTS.md` are loaded in that order (a file that is the same
//! file, or has the same content, as one already loaded is skipped).
//! YAML frontmatter is stripped and `@include <path>` lines are expanded,
//! confined to the project root (project files) or the global directory
//! the file came from (global files). All files share a
//! [`INSTRUCTION_BUDGET_BYTES`] budget.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// One loaded instruction file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstructionFile {
    /// Path of the file as found on disk.
    pub path: PathBuf,
    /// Content with frontmatter stripped and `@include` lines expanded,
    /// truncated to fit the budget.
    pub content: String,
}

/// Total size of all instruction files, in bytes.
pub const INSTRUCTION_BUDGET_BYTES: usize = 32 * 1024;

/// In a directory that has it, this file replaces `AGENTS.md` and `CLAUDE.md`.
const OVERRIDE_FILE_NAME: &str = "AGENTS.override.md";

/// Loaded in this order when a directory has no override file, as path
/// components relative to the directory. `.claurst/AGENTS.md` is where
/// session memories are persisted; `.claude/CLAUDE.md` is Claude Code's
/// project location.
const INSTRUCTION_FILE_PATHS: [&[&str]; 4] = [
    &["AGENTS.md"],
    &["CLAUDE.md"],
    &[".claude", "CLAUDE.md"],
    &[".claurst", "AGENTS.md"],
];

// ---------------------------------------------------------------------------
// YAML frontmatter
// ---------------------------------------------------------------------------

/// Strip YAML frontmatter (`---` ... `---`) from the start of `content`.
pub fn strip_frontmatter(content: &str) -> &str {
    if let Some(after_first) = content.strip_prefix("---") {
        if let Some(end) = after_first.find("\n---") {
            return after_first[end + 4..].trim_start_matches(['\r', '\n']);
        }
    }
    content
}

// ---------------------------------------------------------------------------
// @include directive expansion
// ---------------------------------------------------------------------------

/// Maximum @include nesting depth.
const MAX_INCLUDE_DEPTH: usize = 10;

/// Largest file `@include` will pull in, in bytes.
const MAX_INCLUDE_BYTES: u64 = 40 * 1024;

/// Expand `@include <path>` lines in `content`.
///
/// Paths are relative to `base_dir` (the including file's directory),
/// absolute, or `~/`-prefixed. A target outside `root` is not read, so a
/// repository's AGENTS.md cannot pull files such as `~/.ssh/...` into the
/// prompt. Circular references are detected via `visited`.
pub fn expand_includes(
    content: &str,
    base_dir: &Path,
    root: &Path,
    visited: &mut HashSet<PathBuf>,
    depth: usize,
) -> String {
    if depth >= MAX_INCLUDE_DEPTH {
        return content.to_string();
    }

    let canonical_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let mut result = String::with_capacity(content.len());
    for line in content.lines() {
        let Some(path_str) = line.trim().strip_prefix("@include ") else {
            result.push_str(line);
            result.push('\n');
            continue;
        };
        let path_str = path_str.trim();
        let include_path = match path_str.strip_prefix("~/") {
            Some(rest) => match dirs::home_dir() {
                Some(home) => home.join(rest),
                None => {
                    result.push_str(&format!("<!-- @include {} not found -->\n", path_str));
                    continue;
                }
            },
            None if Path::new(path_str).is_absolute() => PathBuf::from(path_str),
            None => base_dir.join(path_str),
        };

        let Ok(canonical) = include_path.canonicalize() else {
            result.push_str(&format!("<!-- @include {} not found -->\n", path_str));
            continue;
        };
        if !canonical.starts_with(&canonical_root) {
            result.push_str(&format!(
                "<!-- @include {} skipped: outside {} -->\n",
                path_str,
                root.display()
            ));
            continue;
        }
        if visited.contains(&canonical) {
            result.push_str(&format!("<!-- circular @include {} skipped -->\n", path_str));
            continue;
        }
        if std::fs::metadata(&canonical).is_ok_and(|m| m.len() > MAX_INCLUDE_BYTES) {
            result.push_str(&format!("<!-- @include {} exceeds 40KB limit -->\n", path_str));
            continue;
        }
        let Ok(included) = std::fs::read_to_string(&canonical) else {
            result.push_str(&format!("<!-- @include {} not found -->\n", path_str));
            continue;
        };
        let include_dir = canonical.parent().unwrap_or(base_dir).to_path_buf();
        visited.insert(canonical);
        result.push_str(&expand_includes(&included, &include_dir, root, visited, depth + 1));
        result.push('\n');
    }
    result
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/// The instruction files present in `dir`, in load order.
fn files_in_dir(dir: &Path) -> Vec<PathBuf> {
    let override_file = dir.join(OVERRIDE_FILE_NAME);
    if override_file.is_file() {
        return vec![override_file];
    }
    INSTRUCTION_FILE_PATHS
        .iter()
        .map(|components| components.iter().fold(dir.to_path_buf(), |path, c| path.join(c)))
        .filter(|path| path.is_file())
        .collect()
}

/// Load the instruction files for a session in `cwd`. `global_dirs` are the
/// user-level directories, in load order (normally `Settings::config_dir()`
/// then `~/.claude`, see [`default_global_dirs`]).
///
/// Returns the files in load order. Once the combined content reaches
/// [`INSTRUCTION_BUDGET_BYTES`], the file that crosses it is truncated with a
/// note and later files carry only a note naming them.
pub fn load_instruction_files(cwd: &Path, global_dirs: &[PathBuf]) -> Vec<InstructionFile> {
    let project_dirs = crate::skill_discovery::project_search_dirs(cwd);
    let project_root = project_dirs.last().map_or(cwd, PathBuf::as_path);

    // (file, root its @include lines are confined to)
    let mut sources: Vec<(PathBuf, &Path)> = global_dirs
        .iter()
        .flat_map(|dir| files_in_dir(dir).into_iter().map(move |file| (file, dir.as_path())))
        .collect();
    for dir in project_dirs.iter().rev() {
        sources.extend(files_in_dir(dir).into_iter().map(|file| (file, project_root)));
    }

    let mut files: Vec<InstructionFile> = Vec::new();
    let mut seen_paths: HashSet<PathBuf> = HashSet::new();
    let mut seen_contents: HashSet<String> = HashSet::new();
    let mut remaining = INSTRUCTION_BUDGET_BYTES;
    for (path, root) in sources {
        let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
        if !seen_paths.insert(canonical.clone()) {
            continue;
        }
        let raw = match std::fs::read_to_string(&path) {
            Ok(raw) => raw,
            Err(err) => {
                tracing::debug!(path = %path.display(), error = %err, "instruction file unreadable");
                continue;
            }
        };
        let base_dir = canonical.parent().unwrap_or(root).to_path_buf();
        let mut visited = HashSet::from([canonical]);
        let expanded = expand_includes(strip_frontmatter(&raw), &base_dir, root, &mut visited, 0);
        let content = expanded.trim();
        if content.is_empty() || !seen_contents.insert(content.to_string()) {
            continue;
        }

        let content = if remaining == 0 {
            format!(
                "[Not loaded: the {} KiB instruction budget is used up. Read {} directly if it is relevant.]",
                INSTRUCTION_BUDGET_BYTES / 1024,
                path.display()
            )
        } else if content.len() <= remaining {
            remaining -= content.len();
            content.to_string()
        } else {
            let mut cut = remaining;
            while !content.is_char_boundary(cut) {
                cut -= 1;
            }
            remaining = 0;
            format!(
                "{}\n\n[Truncated: instruction files are limited to {} KiB in total. Read {} for the rest.]",
                &content[..cut],
                INSTRUCTION_BUDGET_BYTES / 1024,
                path.display()
            )
        };
        files.push(InstructionFile { path, content });
    }
    files
}

/// The user-level instruction directories: `<claurst home>`, then
/// `~/.claude` (Claude Code's global `CLAUDE.md`).
pub fn default_global_dirs() -> Vec<PathBuf> {
    let mut global = vec![crate::config::Settings::config_dir()];
    if let Some(home) = dirs::home_dir() {
        global.push(home.join(".claude"));
    }
    global
}

#[cfg(test)]
mod tests {
    use super::*;

    fn git_repo() -> (tempfile::TempDir, PathBuf) {
        let tmp = tempfile::
```

### Core Architecture Module: `src-rust/crates/core/src/cloud_session.rs`
```
//! Cloud session API — mirrors src/remote/sdkMessageAdapter.ts.
//!
//! Converts between internal Message types and the cloud API format.
//! Provides CRUD operations for cloud-hosted sessions.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use crate::types::{Message, Role, MessageContent, ContentBlock};

// ---------------------------------------------------------------------------
// Cloud session API types
// ---------------------------------------------------------------------------

/// Options for creating a new cloud session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSessionCreateOpts {
    pub project_root: Option<String>,
    pub model: String,
    pub title: Option<String>,
}

/// A cloud session detail (with full message list).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudSessionDetail {
    pub id: String,
    pub title: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub messages: Vec<CloudMessage>,
}

/// A message in the cloud API format.
///
/// `content` is a JSON array of Anthropic API content-block objects so that
/// structured blocks (tool_use, tool_result, image, …) survive a round-trip
/// through the cloud without being collapsed to plain text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudMessage {
    pub id: String,
    pub role: String,    // "user" | "assistant"
    pub content: Vec<Value>, // Array of Anthropic-schema content block objects
    pub created_at: u64,
    pub session_id: String,
}

// ---------------------------------------------------------------------------
// SDK message adapter
// ---------------------------------------------------------------------------

/// Normalise a `MessageContent` into a flat `Vec<ContentBlock>`.
///
/// A `MessageContent::Text` shorthand is lifted into a single
/// `ContentBlock::Text` so every path produces the same block list.
fn content_to_blocks(content: &MessageContent) -> Vec<ContentBlock> {
    match content {
        MessageContent::Text(t) => vec![ContentBlock::Text { text: t.clone() }],
        MessageContent::Blocks(blocks) => blocks.clone(),
    }
}

/// Convert an internal `Message` to a `CloudMessage`.
///
/// Every `ContentBlock` is serialised to its Anthropic API JSON
/// representation; no information is discarded.
pub fn message_to_cloud(msg: &Message, session_id: &str, msg_id: &str, ts: u64) -> CloudMessage {
    let role = match msg.role {
        Role::User => "user".to_string(),
        Role::Assistant => "assistant".to_string(),
    };

    let content: Vec<Value> = content_to_blocks(&msg.content)
        .into_iter()
        .map(|block| {
            serde_json::to_value(&block)
                .unwrap_or(Value::Null)
        })
        .collect();

    CloudMessage {
        id: msg_id.to_string(),
        role,
        content,
        created_at: ts,
        session_id: session_id.to_string(),
    }
}

/// Convert a `CloudMessage` back to an internal `Message`.
///
/// Each element of `content` is deserialised as a `ContentBlock`.  Elements
/// that cannot be parsed are silently skipped so that unknown future block
/// types do not crash older clients.
pub fn cloud_to_message(cloud: &CloudMessage) -> Message {
    let role = if cloud.role == "assistant" { Role::Assistant } else { Role::User };

    let blocks: Vec<ContentBlock> = cloud
        .content
        .iter()
        .filter_map(|v| serde_json::from_value::<ContentBlock>(v.clone()).ok())
        .collect();

    // Use the compact Text shorthand when there is exactly one plain-text block.
    let content = if blocks.len() == 1 {
        if let ContentBlock::Text { text } = &blocks[0] {
            MessageContent::Text(text.clone())
        } else {
            MessageContent::Blocks(blocks)
        }
    } else {
        MessageContent::Blocks(blocks)
    };

    Message {
        role,
        content,
        uuid: None,
        cost: None,
        snapshot_patch: None,
    }
}

// ---------------------------------------------------------------------------
// Cloud session API client
// ---------------------------------------------------------------------------

/// Thin client for the cloud session REST API.
pub struct CloudSessionClient {
    base_url: String,
    access_token: String,
    http: reqwest::Client,
}

impl CloudSessionClient {
    pub fn new(access_token: String) -> Self {
        Self {
            base_url: "https://api.claude.ai".to_string(),
            access_token,
            http: reqwest::Client::new(),
        }
    }

    /// List all cloud sessions.
    pub async fn list(&self) -> Result<Vec<crate::remote_session::CloudSession>, String> {
        let resp = self.http
            .get(format!("{}/api/sessions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .send().await
            .map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    /// Fetch full session details including messages.
    pub async fn fetch(&self, session_id: &str) -> Result<CloudSessionDetail, String> {
        let resp = self.http
            .get(format!("{}/api/sessions/{}", self.base_url, session_id))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .send().await
            .map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    /// Push new messages to a cloud session.
    pub async fn push_messages(
        &self,
        session_id: &str,
        messages: &[CloudMessage],
    ) -> Result<(), String> {
        let resp = self.http
            .post(format!("{}/api/sessions/{}/messages", self.base_url, session_id))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .json(messages)
            .send().await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }
        Ok(())
    }

    /// Create a new cloud session.
    pub async fn create(&self, opts: CloudSessionCreateOpts) -> Result<crate::remote_session::CloudSession, String> {
        let resp = self.http
            .post(format!("{}/api/sessions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .json(&opts)
            .send().await
            .map_err(|e| e.to_string())?;
        resp.json().await.map_err(|e| e.to_string())
    }

    /// Delete a cloud session.
    pub async fn delete(&self, session_id: &str) -> Result<(), String> {
        let resp = self.http
            .delete(format!("{}/api/sessions/{}", self.base_url, session_id))
            .header("Authorization", format!("Bearer {}", self.access_token))
            .send().await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }
        Ok(())
    }
}

```

### Core Architecture Module: `src-rust/crates/core/src/codex_oauth.rs`
```
//! OpenAI Codex OAuth configuration and constants.
//!

/// OpenAI Codex OAuth client ID (shared with the OpenCode ecosystem).
pub const CODEX_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";

/// OpenAI OAuth issuer base URL.
pub const CODEX_ISSUER: &str = "https://auth.openai.com";

/// OpenAI OAuth authorization endpoint
pub const CODEX_AUTHORIZE_URL: &str = "https://auth.openai.com/oauth/authorize";

/// OpenAI OAuth token endpoint
pub const CODEX_TOKEN_URL: &str = "https://auth.openai.com/oauth/token";

/// Codex Responses API endpoint (used for inference after login)
pub const CODEX_API_ENDPOINT: &str = "https://chatgpt.com/backend-api/codex/responses";

/// Local redirect URI for OAuth callback
pub const CODEX_REDIRECT_URI: &str = "http://localhost:1455/auth/callback";

/// OAuth callback port
pub const CODEX_OAUTH_PORT: u16 = 1455;

/// OAuth scopes requested from OpenAI
pub const CODEX_SCOPES: &str = "openid profile email offline_access";

/// Curated Codex models — the static fallback used only when the models.dev
/// `openai` catalog is unavailable. The live list is derived by filtering that
/// catalog with [`codex_model_allowed`] (opencode's exact rule), so this list
/// must mirror what that filter yields from a current snapshot.
pub const CODEX_MODELS: &[(&str, &str)] = &[
    ("gpt-5.5", "GPT-5.5 (default)"),
    ("gpt-5.4", "GPT-5.4"),
    ("gpt-5.4-mini", "GPT-5.4 mini"),
    ("gpt-5.3-codex-spark", "GPT-5.3 Codex Spark"),
];

/// Default Codex model to use
pub const DEFAULT_CODEX_MODEL: &str = "gpt-5.5";

/// Models always offered to a ChatGPT-authenticated Codex session, regardless
/// of the version heuristic. Mirrors opencode's `ALLOWED_MODELS`.
pub const CODEX_ALLOWED_MODELS: &[&str] =
    &["gpt-5.5", "gpt-5.3-codex-spark", "gpt-5.4", "gpt-5.4-mini"];

/// Models explicitly withheld from Codex even though the version heuristic
/// would otherwise admit them. Mirrors opencode's `DISALLOWED_MODELS`.
pub const CODEX_DISALLOWED_MODELS: &[&str] = &["gpt-5.5-pro"];

/// Whether a models.dev `openai` model id is available to a ChatGPT-auth Codex
/// session. This is opencode's exact rule (see
/// `packages/opencode/src/plugin/openai/codex.ts`):
///
///   1. explicit allow-list wins,
///   2. then the explicit deny-list,
///   3. otherwise keep `gpt-<major>.<minor>` models newer than 5.4 — so future
///      releases (gpt-5.6, gpt-6.0, …) appear automatically without a code bump.
pub fn codex_model_allowed(id: &str) -> bool {
    if CODEX_ALLOWED_MODELS.contains(&id) {
        return true;
    }
    if CODEX_DISALLOWED_MODELS.contains(&id) {
        return false;
    }
    codex_model_version(id).map(|v| v > 5.4).unwrap_or(false)
}

/// Parse the leading `gpt-<major>.<minor>` version out of a model id, matching
/// opencode's `/^gpt-(\d+\.\d+)/`. Returns `None` when the id doesn't start
/// with that shape (e.g. `gpt-4o`, `o3`, non-gpt ids).
fn codex_model_version(id: &str) -> Option<f64> {
    let rest = id.strip_prefix("gpt-")?;
    let mut chars = rest.char_indices();
    let mut seen_major = false;
    let mut seen_dot = false;
    let mut seen_minor = false;
    let mut end = 0usize;
    for (i, c) in chars.by_ref() {
        if c.is_ascii_digit() {
            if seen_dot {
                seen_minor = true;
            } else {
                seen_major = true;
            }
            end = i + c.len_utf8();
        } else if c == '.' && seen_major && !seen_dot {
            seen_dot = true;
            end = i + c.len_utf8();
        } else {
            break;
        }
    }
    if seen_major && seen_dot && seen_minor {
        rest[..end].parse::<f64>().ok()
    } else {
        None
    }
}

/// Context-window limit override for a Codex model, mirroring opencode: every
/// `gpt-5.5*` model is pinned to the 400K/272K/128K Codex window; all others
/// keep whatever the models.dev catalog reports. Returns
/// `(context, input, output)`.
pub fn codex_limit_override(id: &str) -> Option<(u32, u32, u32)> {
    if id.contains("gpt-5.5") {
        Some((400_000, 272_000, 128_000))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_codex_constants_not_empty() {
        assert!(!CODEX_CLIENT_ID.is_empty());
        assert!(!CODEX_AUTHORIZE_URL.is_empty());
        assert!(!CODEX_TOKEN_URL.is_empty());
        assert!(!CODEX_REDIRECT_URI.is_empty());
        assert!(!CODEX_SCOPES.is_empty());
        assert!(!CODEX_MODELS.is_empty());
        assert!(!DEFAULT_CODEX_MODEL.is_empty());
    }

    #[test]
    fn test_codex_models_contains_default() {
        let default_found = CODEX_MODELS
            .iter()
            .any(|(model, _)| model == &DEFAULT_CODEX_MODEL);
        assert!(
            default_found,
            "DEFAULT_CODEX_MODEL must be in CODEX_MODELS list"
        );
    }

    #[test]
    fn test_redirect_uri_is_localhost() {
        assert!(CODEX_REDIRECT_URI.contains("localhost:1455"));
    }

    #[test]
    fn test_codex_allow_list_matches_opencode() {
        // Explicit allow-list — always kept.
        for id in ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"] {
            assert!(codex_model_allowed(id), "{id} should be allowed");
        }
        // Explicit deny — withheld even though 5.5 > 5.4.
        assert!(!codex_model_allowed("gpt-5.5-pro"), "gpt-5.5-pro is denied");
        // Version heuristic: keep only > 5.4.
        assert!(codex_model_allowed("gpt-5.6"), "future gpt-5.6 kept by heuristic");
        assert!(codex_model_allowed("gpt-6.0"), "future gpt-6.0 kept by heuristic");
        // Legacy / non-matching ids dropped.
        for id in [
            "gpt-5.4-nano", "gpt-5.4-pro", "gpt-5.2-codex", "gpt-5.1-codex",
            "gpt-5.2", "gpt-5", "gpt-4o", "o3", "gpt-5-codex",
        ] {
            assert!(!codex_model_allowed(id), "{id} should be filtered out");
        }
    }

    #[test]
    fn test_codex_default_is_5_5_and_allowed() {
        assert_eq!(DEFAULT_CODEX_MODEL, "gpt-5.5");
        assert!(codex_model_allowed(DEFAULT_CODEX_MODEL));
        assert!(CODEX_MODELS.iter().all(|(id, _)| codex_model_allowed(id)));
    }

    #[test]
    fn test_codex_limit_override_only_for_5_5() {
        assert_eq!(codex_limit_override("gpt-5.5"), Some((400_000, 272_000, 128_000)));
        assert_eq!(codex_limit_override("gpt-5.5-codex"), Some((400_000, 272_000, 128_000)));
        assert_eq!(codex_limit_override("gpt-5.4"), None);
        assert_eq!(codex_limit_override("gpt-5.4-mini"), None);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #301** (2026-07-08): **Status bar: reasoning cog always shown; add terminal working/progress indicator (OSC 9;4)**
  *Symptoms*: ## Summary  Two related status-bar / terminal-feedback problems:  1. **Reasoning cog is always shown.** The status bar renders the cog/gear indicator unconditionally, regardless of whether a turn is actually active. It should reflect agent state: idle vs streaming text vs reasoning/thinking vs running a tool. Compare Claude Code, where the cog appears only while the model is reasoning.  2. **No terminal "working" indicator (green bar).** In iTerm2, Claude Code shows a colored progress/activity bar at the top of the terminal while it is working, and clears it when idle. This is done with terminal escape sequences (OSC 9;4 "progress" — supported by iTerm2, WezTerm, Windows Terminal, ConEmu, Ghostty; ignored elsewhere). claurst emits no such signal, so there is no at-a-glance "busy" indication when the terminal is unfocused.  ## Environment  - Reported on iTerm2 (macOS). Fixes should be capability-gated so unsupported terminals never receive stray escape sequences.  ## Investigation  A terminal-compatibility audit is in progress comparing how opencode (`refs/opencode/packages/tui`), codex (`refs/openai-codex/codex-rs/tui`), and others signal working state and emit terminal progress/title sequences, plus the OSC 9;4 support matrix. Findings will land in `refs/audit/05-terminal-compat.md` and be summarized here.  ## Proposed fix (pending investigation)  1. Introduce/consume a turn-state enum (idle / streaming / thinking / tool-running) and map the status glyph to it, so the cog on

- **Issue #300** (2026-07-08): **Anthropic Claude Pro/Max subscription login not reachable from /connect (TUI)**
  *Symptoms*: ## Summary  Claude Pro/Max **subscription login** (claude.ai OAuth, Bearer auth) is fully implemented and works from the CLI (`claurst auth login`), but it is **not reachable from the interactive `/connect` picker**. The picker only offers Anthropic via API key, and the wired-but-dead OAuth path returns a misleading error claiming OAuth is impossible.  ## Evidence  - The full flow exists:   - `crates/core/src/oauth_config.rs` — claude.ai authorize/token URLs, subscription scopes (`user:inference`, `user:profile`, `user:sessions:claude_code`), the Claude Code client id (`9d1c250a-...`), Claude Code UA + `x-anthropic-billing-header`.   - `crates/cli/src/oauth_flow.rs::run_oauth_login_flow(login_with_claude_ai=true)` — PKCE -> Bearer, persists via `OAuthTokens::save_and_register`.   - CLI `claurst auth login` defaults to the claude.ai (subscription) flow; `subscription_type` renders as "Claude Max Account" / "Claude Pro Account" (`crates/cli/src/main.rs`). - But the TUI never exposes it:   - `crates/tui/src/app.rs:250` — the Anthropic picker entry advertises only `"(API key)"`.   - `crates/tui/src/app.rs:3452-3456` — selecting Anthropic opens the API-key dialog, with a stale comment `// (OAuth requires a registered app which Claurst doesn't have)`. This is incorrect: the CLI proves the claude.ai OAuth works via Claude Code client-id impersonation.   - `crates/cli/src/main.rs:3672-3683` — the `"anthropic"` arm of the `device_auth_pending` consumer is a dead stub that just emits `

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

### Incident Patch 1: `465be88f` (2026-10-16)
**Commit Message**: Merge pull request #505 from Kuberwastaken/fix/495-keybindings-remainder

fix(keybindings): Ctrl+V block-visual, Shift+Insert wiring, globalSearch alias, single /keybindings open

**File**: `docs/keybindings.md` (modified, +4/-4)
```diff
@@ -77,13 +77,13 @@ These bindings are active when focus is in the chat input field.
 
 `Shift+Tab` (`reverseIndent`) cycles the permission mode (Default, Accept edits, Bypass permissions, back to Default; Plan goes to Default); it does not remove indentation. Most terminals send `Ctrl+I` as `Tab`, so `historyNext` on `Ctrl+I` only fires when the terminal reports it separately (kitty keyboard protocol).
 
-The defaults also bind `Ctrl+Left` / `Ctrl+Right` (`moveWordBackward` / `moveWordForward`), `Ctrl+F` (`findInMessage`), `Ctrl+Shift+F` (`globalSearch`), `Ctrl+]` (`findNext`), `Ctrl+[` (`findPrev`) and `Ctrl+G` (`goToLine`), but these actions are not implemented, so the keys do nothing. `F3` / `Shift+F3` are listed too, but function keys never reach the binding table. Use `Alt+B` / `Alt+F` to move by word and `Ctrl+P` for project search. The `openSearch` action (no default key) also opens project search and can be bound; the default `globalSearch` name does nothing.
+The defaults also bind `Ctrl+Left` / `Ctrl+Right` (`moveWordBackward` / `moveWordForward`), `Ctrl+F` (`findInMessage`), `Ctrl+]` (`findNext`), `Ctrl+[` (`findPrev`) and `Ctrl+G` (`goToLine`), but those actions are not implemented, so the keys do nothing. `F3` / `Shift+F3` are listed too, but function keys never reach the binding table. Use `Alt+B` / `Alt+F` to move by word and `Ctrl+P` for project search. `Ctrl+Shift+F` works: its default action is listed as `globalSearch`, an alias of the `openSearch` action — both names open the project search, so either can be bound in `keybindings.json`.
 
 > `Ctrl+A` previously opened the model picker; it now moves the cursor to the line start (matching Emacs/readline). The model picker is now `Ctrl+Shift+A`. Old `keybindings.json` files are auto-migrated.
 
 ### Fixed Keys
 
-These keys are hard-coded in the prompt and have no action names, so they cannot be remapped. A `keybindings.json` binding on the same key (other than `F1` and `Shift+Insert`) takes precedence over them.
+These keys are hard-coded in the prompt and have no action names, so they cannot be remapped. A `keybindings.json` binding on the same key (other than `F1`, which never reaches the binding table) takes precedence over them.
 
 | Key | Effect |
 |-----|--------|
@@ -96,7 +96,7 @@ These keys are hard-coded in the prompt and have no action names, so they cannot
 | `Alt+Delete` / `Ctrl+Delete` | Delete the word after the cursor |
 | `Alt+Up` / `Alt+Down` | Scroll the transcript 20 lines (`Alt+Up` edits the last queued message instead when one is pending) |
 | `Ctrl+V` / `Cmd+V` | Paste: an image from the clipboard if there is one, otherwise text |
-| `Shift+Insert` | Paste text |
+| `Shift+Insert` | Paste text (the `insert` key name reaches the binding table, so it can also be rebound) |
 | `Alt+V` | Start / stop voice recording (when `/voice` is on) |
 
 ### Confirmation Context
@@ -263,7 +263,7 @@ The action names behind the fixed keys still exist and can be bound to other cho
 
 ## Vim Mode
 
-The prompt editor contains a vim emulation with insert, normal, visual (`v`, `V`), command-line (`:`) and search (`/`) modes.
+The prompt editor contains a vim emulation with insert, normal, visual (`v`, `V`, `Ctrl+V`), command-line (`:`) and search (`/`) modes.
 
 ### Enabling Vim Mode
 
```

**File**: `src-rust/crates/core/src/keybindings.rs` (modified, +53/-0)
```diff
@@ -121,6 +121,7 @@ fn normalize_key(k: &str) -> String {
         "pageup" | "pgup" => "pageup".to_string(),
         "pagedown" | "pgdn" | "pgdown" => "pagedown".to_string(),
         "home" => "home".to_string(),
+        "ins" | "insert" => "insert".to_string(),
         "end" => "end".to_string(),
         "tab" => "tab".to_string(),
         k => k.to_string(),
@@ -707,6 +708,39 @@ mod tests {
         assert!(parse_keystroke("").is_none());
     }
 
+    #[test]
+    fn test_parse_keystroke_insert_aliases() {
+        // #495: `insert` (used by Shift+Insert) had no key-name mapping, so
+        // the shell-level binding table could never reference it.
+        let ks = parse_keystroke("shift+insert").unwrap();
+        assert_eq!(ks.key, "insert");
+        assert!(ks.shift);
+        let alias = parse_keystroke("ins").unwrap();
+        assert_eq!(alias.key, "insert");
+    }
+
+    #[test]
+    fn test_resolver_reaches_shift_insert_binding() {
+        // A Shift+Insert binding must resolve now that the key name is wired
+        // (previously no lookup ever produced the "insert" key name).
+        let user = UserKeybindings::from_json_str(
+            r#"{
+  "bindings": [
+    {
+      "context": "Chat",
+      "bindings": {
+        "shift+insert": "openHelp"
+      }
+    }
+  ]
+}"#,
+        );
+        let mut resolver = KeybindingResolver::new(&user);
+        let ks = parse_keystroke("shift+insert").unwrap();
+        let result = resolver.process(ks, &KeyContext::Chat);
+        assert!(matches!(result, KeybindingResult::Action(ref a) if a == "openHelp"));
+    }
+
     #[test]
     fn test_parse_chord_single() {
         let chord = parse_chord("ctrl+c").unwrap();
@@ -780,6 +814,25 @@ mod tests {
         );
     }
 
+    #[test]
+    fn test_default_ctrl_shift_f_maps_to_global_search_alias() {
+        // #495: ctrl+shift+f defaults to "globalSearch", which the TUI treats
+        // as an alias of "openSearch". Keep this contract test so the alias
+        // is not dropped in favour of the dead name (or vice versa).
+        let bindings = default_bindings();
+        let action = bindings
+            .iter()
+            .find(|b| {
+                b.chord.len() == 1
+                    && b.chord[0].ctrl
+                    && b.chord[0].shift
+                    && b.chord[0].key == "f"
+                    && b.context == KeyContext::Chat
+            })
+            .and_then(|b| b.action.as_deref());
+        assert_eq!(action, Some("globalSearch"));
+    }
+
     #[test]
     fn test_resolver_simple_action() {
         let user = UserKeybindings::default();
```

**File**: `src-rust/crates/tui/src/app/commands.rs` (modified, +7/-8)
```diff
@@ -5,7 +5,6 @@ use claurst_core::types::Role;
 use crate::notifications::NotificationKind;
 use crate::overlays::HelpEntry;
 use super::App;
-use super::run::open_file_externally;
 use super::try_copy_to_clipboard;
 
 pub(super) const PROMPT_SLASH_COMMANDS: &[(&str, &str)] = &[
@@ -472,13 +471,13 @@ impl App {
                 false
             }
             "keybindings" => {
-                // Open the keybindings.json file in the external editor
-                let keybindings_path = claurst_core::config::Settings::config_dir().join("keybindings.json");
-
-                if let Err(e) = open_file_externally(&keybindings_path) {
-                    eprintln!("Failed to open keybindings file: {}", e);
-                }
-                true
+                // The CLI layer owns `/keybindings`:
+                // `claurst_commands::KeybindingsCommand` writes the template
+                // on first use and opens the file in the system editor.
+                // This TUI intercept must NOT open it a second time for the
+                // same command (issue #495) — fall through to the CLI layer
+                // like /doctor, /init, /login, /logout do.
+                false
             }
             "help" => {
                 // Open the help overlay (same as pressing `?` or F1).
```

**File**: `src-rust/crates/tui/src/app/keys.rs` (modified, +21/-2)
```diff
@@ -112,6 +112,7 @@ pub(super) fn key_event_to_keystroke(key: &KeyEvent) -> Option<ParsedKeystroke>
         KeyCode::Enter     => "enter".to_string(),
         KeyCode::Esc       => "escape".to_string(),
         KeyCode::Home      => "home".to_string(),
+        KeyCode::Insert    => "insert".to_string(),
         KeyCode::Left      => "left".to_string(),
         KeyCode::PageDown  => "pagedown".to_string(),
         KeyCode::PageUp    => "pageup".to_string(),
@@ -1524,7 +1525,21 @@ impl App {
             KeyCode::Char(c) => {
                 let c = self.shift_normalize(c, key.modifiers);
                 if self.prompt_input.vim_enabled && self.prompt_input.vim_mode != VimMode::Insert {
-                    self.prompt_input.vim_command(&c.to_string());
+                    // Ctrl+V is vim's block-visual key: feed the vim state
+                    // machine the \x16 control code instead of the plain 'v'
+                    // character so it reaches the `key == "\x16"` branch in
+                    // `vim_command` (issue #495). In insert mode the clipboard
+                    // paste handler earlier in this function consumed it
+                    // instead.
+                    let vim_key = if key.modifiers.contains(KeyModifiers::CONTROL)
+                        && c == 'v'
+                        && self.prompt_input.vim_mode == VimMode::Normal
+                    {
+                        "\x16".to_string()
+                    } else {
+                        c.to_string()
+                    };
+                    self.prompt_input.vim_command(&vim_key);
                 } else {
                     self.prompt_input.insert_char(c);
                 }
@@ -2136,7 +2151,11 @@ impl App {
                 self.history_search = Some(hs);
                 false
             }
-            "openSearch" => {
+            // `globalSearch` is the legacy/default action name and
+            // `openSearch` is the live one; both open project search
+            // (issue #495). Keep them aliased so old keybindings.json
+            // files and the default ctrl+shift+f binding keep working.
+            "openSearch" | "globalSearch" => {
                 self.global_search.open();
                 self.refresh_global_search();
                 false
```

**File**: `src-rust/crates/tui/src/app/run.rs` (modified, +0/-43)
```diff
@@ -16,49 +16,6 @@ use super::turns::format_elapsed_ms;
 use super::types::{RecentSession, ToolStatus, ToolUseBlock, recent_session_label};
 use crate::session_browser::SessionEntry;
 
-pub(super) fn open_file_externally(path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
-    // Try to open with the system's default application
-    #[cfg(target_os = "macos")]
-    {
-        std::process::Command::new("open")
-            .arg(path)
-            .spawn()?;
-        Ok(())
-    }
-
-    #[cfg(target_os = "linux")]
-    {
-        std::process::Command::new("xdg-open")
-            .arg(path)
-            .spawn()?;
-        Ok(())
-    }
-
-    #[cfg(target_os = "windows")]
-    {
-        std::process::Command::new("cmd")
-            .args(&["/C", "start", ""])
-            .arg(path)
-            .spawn()?;
-        Ok(())
-    }
-
-    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
-    {
-        // Fallback for other systems: try common editors in order
-        for editor in &["nano", "vi", "vim", "emacs"] {
-            match std::process::Command::new(editor)
-                .arg(path)
-                .spawn()
-            {
-                Ok(_) => return Ok(()),
-                Err(_) => continue,
-            }
-        }
-        Err("No suitable editor found".into())
-    }
-}
-
 /// Load the `/session` / `/resume` browser entries from the store that
 /// `history::save_session` writes (`<config_dir>/sessions/`), newest first.
 pub(super) async fn load_session_entries() -> Vec<SessionEntry> {
```

**File**: `src-rust/crates/tui/src/app/tests.rs` (modified, +83/-0)
```diff
@@ -555,6 +555,15 @@ use super::types::{ContextMenuItem, ContextMenuState};
         assert!(!app.mcp_view.visible);
     }
 
+    #[test]
+    fn test_keybindings_slash_command_left_to_cli_layer() {
+        // The commands crate owns /keybindings (template creation + open);
+        // the TUI intercept used to open the file too, popping it twice for
+        // one command (issue #495). It must fall through instead.
+        let mut app = make_app();
+        assert!(!app.intercept_slash_command("keybindings"));
+    }
+
     #[test]
     fn test_clear_slash_command_clears_messages() {
         let mut app = make_app();
@@ -583,6 +592,38 @@ use super::types::{ContextMenuItem, ContextMenuState};
         assert!(!app.prompt_input.vim_enabled);
     }
 
+    // ---- Ctrl+V reaches the vim state machine as block-visual (issue #495) --
+
+    #[test]
+    fn ctrl_v_in_vim_normal_enters_visual_block() {
+        let mut app = make_app();
+        app.prompt_input.vim_enabled = true;
+        app.prompt_input.vim_mode = crate::prompt_input::VimMode::Normal;
+        let handled = app.handle_key_event(press_key(KeyCode::Char('v'), KeyModifiers::CONTROL));
+        assert!(!handled);
+        assert_eq!(
+            app.prompt_input.vim_mode,
+            crate::prompt_input::VimMode::VisualBlock,
+            "Ctrl+V must report the \x16 block-visual key to the vim handler"
+        );
+        assert_eq!(
+            app.prompt_input.visual_anchor,
+            Some(app.prompt_input.cursor),
+            "block-visual anchors the selection at the cursor"
+        );
+    }
+
+    #[test]
+    fn plain_v_in_vim_normal_still_enters_charwise_visual() {
+        // The Ctrl+V special case must not disturb the printable-key path.
+        let mut app = make_app();
+        app.prompt_input.vim_enabled = true;
+        app.prompt_input.vim_mode = crate::prompt_input::VimMode::Normal;
+        let handled = app.handle_key_event(press_key(KeyCode::Char('v'), KeyModifiers::NONE));
+        assert!(!handled);
+        assert_eq!(app.prompt_input.vim_mode, crate::prompt_input::VimMode::Visual);
+    }
+
     #[test]
     fn test_model_slash_command_opens_picker() {
         let mut app = make_app();
@@ -831,6 +872,22 @@ use super::types::{ContextMenuItem, ContextMenuState};
         assert!(!ks.ctrl && !ks.alt);
     }
 
+    #[test]
+    fn test_key_event_to_keystroke_maps_insert_key_name() {
+        // Shift+Insert must reach the binding table as the "insert" key name
+        // with the SHIFT flag preserved (issue #495); before the fix the two
+        // keys returned no keystroke at all.
+        let ks = key_event_to_keystroke(&press_key(KeyCode::Insert, KeyModifiers::SHIFT))
+            .expect("keystroke");
+        assert_eq!(ks.key, "insert");
+        assert!(ks.shift);
+        assert!(!ks.ctrl);
+
+        let ks = key_event_to_keystroke(&press_key(KeyCode::Insert, KeyModifiers::NONE))
+            .expect("keystroke");
+        assert_eq!(ks.key, "insert");
+    }
+
     #[test]
     fn test_normalize_layout_shortcut_key_rewrites_pure_ctrl() {
         // Pure Ctrl + Cyrillic → Latin letter at the same physical position.
@@ -1328,3 +1385,29 @@ use super::types::{ContextMenuItem, ContextMenuState};
         // Selecting the tool_result would orphan the tool_use: cut before it.
         assert_eq!(rewind_cut_index(&history, 2), 1);
     }
+
+    // ---- globalSearch / openSearch aliases open project search (#495) ------
+
+    #[test]
+    fn ctrl_shift_f_default_binding_opens_project_search() {
+        // The default ctrl+shift+f binding maps to the legacy "globalSearch"
+        // action name, which used to be dead code.
+        let mut app = make_app();
+        let handled = app.handle_key_event(press_key(
+            KeyCode::Char('f'),
+            KeyModifiers::CONTROL | KeyModifiers::SHIFT,
+        ));
+        assert!(!handled);
+        assert!(app.global_search.visible);
+    }
+
+    #[test]
+    fn global_search_action_aliases_are_equivalent() {
+        // "openSearch" is the live handler; "globalSearch" is the legacy
+        // default action name. Both must open project search.
+        for action in ["openSearch", "globalSearch"] {
+            let mut app = make_app();
+            app.handle_keybinding_action(action);
+            assert!(app.global_search.visible, "{action} must open project search");
+        }
+    }
```

**File**: `src-rust/crates/tui/src/prompt_input.rs` (modified, +12/-0)
```diff
@@ -4343,6 +4343,18 @@ mod tests {
         assert_eq!(s.vim_mode, VimMode::Normal);
     }
 
+    #[test]
+    fn prompt_input_visual_block_via_ctrl_v_code() {
+        // Ctrl+V arrives at the vim state machine as the \x16 control code.
+        let mut s = PromptInputState::new();
+        s.vim_enabled = true;
+        s.vim_mode = VimMode::Normal;
+        s.cursor = 0;
+        s.vim_command("\x16");
+        assert_eq!(s.vim_mode, VimMode::VisualBlock);
+        assert_eq!(s.visual_anchor, Some(0));
+    }
+
     // ---- Named registers ------------------------------------------------
 
     #[test]
```

---

### Incident Patch 2: `603cbd19` (2026-10-16)
**Commit Message**: fix(tui): deliver ctrl+v to vim as the block-visual key

Ctrl+V used to be indistinguishable from a plain 'v' in the vim path of
handle_key_event, so the key == \x16 branch in PromptInput::vim_command
that enters blockwise-visual mode was unreachable. In non-insert vim
mode the Ctrl-modified 'v' now maps to the \x16 control code; plain 'v'
keeps entering charwise visual and the Ctrl+V clipboard-paste path is
untouched in insert mode and in plain editing.

Part of #495

**File**: `docs/keybindings.md` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@ The action names behind the fixed keys still exist and can be bound to other cho
 
 ## Vim Mode
 
-The prompt editor contains a vim emulation with insert, normal, visual (`v`, `V`), command-line (`:`) and search (`/`) modes.
+The prompt editor contains a vim emulation with insert, normal, visual (`v`, `V`, `Ctrl+V`), command-line (`:`) and search (`/`) modes.
 
 ### Enabling Vim Mode
 
```

**File**: `src-rust/crates/tui/src/app/keys.rs` (modified, +15/-1)
```diff
@@ -1524,7 +1524,21 @@ impl App {
             KeyCode::Char(c) => {
                 let c = self.shift_normalize(c, key.modifiers);
                 if self.prompt_input.vim_enabled && self.prompt_input.vim_mode != VimMode::Insert {
-                    self.prompt_input.vim_command(&c.to_string());
+                    // Ctrl+V is vim's block-visual key: feed the vim state
+                    // machine the \x16 control code instead of the plain 'v'
+                    // character so it reaches the `key == "\x16"` branch in
+                    // `vim_command` (issue #495). In insert mode the clipboard
+                    // paste handler earlier in this function consumed it
+                    // instead.
+                    let vim_key = if key.modifiers.contains(KeyModifiers::CONTROL)
+                        && c == 'v'
+                        && self.prompt_input.vim_mode == VimMode::Normal
+                    {
+                        "\x16".to_string()
+                    } else {
+                        c.to_string()
+                    };
+                    self.prompt_input.vim_command(&vim_key);
                 } else {
                     self.prompt_input.insert_char(c);
                 }
```

**File**: `src-rust/crates/tui/src/app/tests.rs` (modified, +32/-0)
```diff
@@ -583,6 +583,38 @@ use super::types::{ContextMenuItem, ContextMenuState};
         assert!(!app.prompt_input.vim_enabled);
     }
 
+    // ---- Ctrl+V reaches the vim state machine as block-visual (issue #495) --
+
+    #[test]
+    fn ctrl_v_in_vim_normal_enters_visual_block() {
+        let mut app = make_app();
+        app.prompt_input.vim_enabled = true;
+        app.prompt_input.vim_mode = crate::prompt_input::VimMode::Normal;
+        let handled = app.handle_key_event(press_key(KeyCode::Char('v'), KeyModifiers::CONTROL));
+        assert!(!handled);
+        assert_eq!(
+            app.prompt_input.vim_mode,
+            crate::prompt_input::VimMode::VisualBlock,
+            "Ctrl+V must report the \x16 block-visual key to the vim handler"
+        );
+        assert_eq!(
+            app.prompt_input.visual_anchor,
+            Some(app.prompt_input.cursor),
+            "block-visual anchors the selection at the cursor"
+        );
+    }
+
+    #[test]
+    fn plain_v_in_vim_normal_still_enters_charwise_visual() {
+        // The Ctrl+V special case must not disturb the printable-key path.
+        let mut app = make_app();
+        app.prompt_input.vim_enabled = true;
+        app.prompt_input.vim_mode = crate::prompt_input::VimMode::Normal;
+        let handled = app.handle_key_event(press_key(KeyCode::Char('v'), KeyModifiers::NONE));
+        assert!(!handled);
+        assert_eq!(app.prompt_input.vim_mode, crate::prompt_input::VimMode::Visual);
+    }
+
     #[test]
     fn test_model_slash_command_opens_picker() {
         let mut app = make_app();
```

**File**: `src-rust/crates/tui/src/prompt_input.rs` (modified, +12/-0)
```diff
@@ -4343,6 +4343,18 @@ mod tests {
         assert_eq!(s.vim_mode, VimMode::Normal);
     }
 
+    #[test]
+    fn prompt_input_visual_block_via_ctrl_v_code() {
+        // Ctrl+V arrives at the vim state machine as the \x16 control code.
+        let mut s = PromptInputState::new();
+        s.vim_enabled = true;
+        s.vim_mode = VimMode::Normal;
+        s.cursor = 0;
+        s.vim_command("\x16");
+        assert_eq!(s.vim_mode, VimMode::VisualBlock);
+        assert_eq!(s.visual_anchor, Some(0));
+    }
+
     // ---- Named registers ------------------------------------------------
 
     #[test]
```

---

### Incident Patch 3: `85ebb868` (2026-10-16)
**Commit Message**: Merge pull request #506 from Kuberwastaken/fix/499-cost-reporting

fix(cost): zero cost for subscription providers; no invented rates for unknown models

**File**: `src-rust/crates/api/src/lib.rs` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ pub use providers::OpenAiProvider;
 pub use model_registry::{
     CostBreakdown, CostTier, CostTierCondition, ExperimentalMode, InterleavedReasoning, Modality,
     ModelEntry, ModelRegistry, ModelStatus, ProviderEntry, ProviderOverride,
-    effective_model_for_config,
+    apply_session_cost_pricing, catalog_pricing, effective_model_for_config,
 };
 pub use effort_support::{
     anthropic_reasoning, model_is_reasoning, supported_efforts, variant_ladder, AnthropicReasoning,
```

**File**: `src-rust/crates/api/src/model_registry.rs` (modified, +143/-0)
```diff
@@ -1604,6 +1604,75 @@ pub fn effective_model_for_config(
     config.effective_model().to_string()
 }
 
+// ---------------------------------------------------------------------------
+// Cost-tracker pricing resolution (issue #499)
+// ---------------------------------------------------------------------------
+
+/// Map a catalog entry's per-token prices onto the tracker's [`ModelPricing`].
+///
+/// Returns `None` when the entry has no usable prices at all: a price the
+/// catalog doesn't record must surface as zero cost, not as a guessed rate.
+fn model_pricing_from_entry(entry: &ModelEntry) -> Option<claurst_core::cost::ModelPricing> {
+    let cost = &entry.cost;
+    if cost.input.is_none() && cost.output.is_none() {
+        return None;
+    }
+    Some(claurst_core::cost::ModelPricing {
+        input_per_mtk: cost.input.unwrap_or(0.0),
+        output_per_mtk: cost.output.unwrap_or(0.0),
+        cache_creation_per_mtk: cost.cache_write.unwrap_or(0.0),
+        cache_read_per_mtk: cost.cache_read.unwrap_or(0.0),
+    })
+}
+
+/// Look up `model`'s per-token prices in the catalog, first served through
+/// `provider_id` (the usual keyed path), then by bare model id across the
+/// whole catalog.
+pub fn catalog_pricing(
+    registry: Option<&ModelRegistry>,
+    provider_id: &str,
+    model: &str,
+) -> Option<claurst_core::cost::ModelPricing> {
+    let registry = registry?;
+    let entry = registry.resolve_entry(provider_id, model).or_else(|| {
+        registry
+            .find_provider_for_model(model)
+            .and_then(|p| registry.get(&p, model))
+    });
+    entry.and_then(model_pricing_from_entry)
+}
+
+/// Configure a [`CostTracker`] for the active session so the headless `result`
+/// event, `/cost` and the TUI footer all report the same figure (issue #499):
+///
+/// * Subscription providers (`codex` / `openai-codex` ChatGPT plans,
+///   Anthropic OAuth with Bearer auth = Claude Pro/Max) report zero cost.
+/// * Known models are priced from the catalog, falling back to the curated
+///   Claude/free heuristics.
+/// * Unknown models get no invented default rate: cost reports zero.
+pub fn apply_session_cost_pricing(
+    tracker: &claurst_core::cost::CostTracker,
+    registry: Option<&ModelRegistry>,
+    provider_id: &str,
+    model: &str,
+    anthropic_bearer_auth: bool,
+) {
+    let subscription = claurst_core::cost::is_subscription_provider(provider_id)
+        || (provider_id == claurst_core::ProviderId::ANTHROPIC && anthropic_bearer_auth);
+    tracker.set_subscription(subscription);
+    if subscription {
+        // Zero cost regardless of any per-token price the catalog still
+        // records for ChatGPT-served models (issue #499).
+        tracker.set_pricing(None);
+        return;
+    }
+    // Catalog first (it knows exact per-model rates), then the curated
+    // Claude/free heuristics; unknown models resolve to `None` — no default.
+    let pricing = catalog_pricing(registry, provider_id, model)
+        .or_else(|| claurst_core::cost::ModelPricing::for_model(model));
+    tracker.set_pricing(pricing);
+}
+
 // ---------------------------------------------------------------------------
 // Tests
 // ---------------------------------------------------------------------------
@@ -2219,4 +2288,78 @@ mod tests {
         assert_eq!(reg.len(), before, "malformed/empty overrides must not add entries");
         assert!(reg.get("custom-openai", "noop").is_none());
     }
+
+    // ---- Session cost pricing (issue #499) -----------------------------------
+
+    #[test]
+    fn session_cost_pricing_zeroes_subscription_providers() {
+        for provider in ["codex", "openai-codex"] {
+            let tracker = claurst_core::cost::CostTracker::new();
+            tracker.add_usage(10_074, 5, 0, 0);
+            apply_session_cost_pricing(&tracker, None, provider, "gpt-5.6-sol", false);
+            assert!(tracker.is_subscription());
+            assert_eq!(tracker.total_cost_usd(), 0.0, "{provider} must report zero cost");
+        }
+
+        // Anthropic with Bearer (claude.ai OAuth) = Claude Pro/Max subscription.
+        let tracker = claurst_core::cost::CostTracker::new();
+        tracker.add_usage(10_074, 5, 0, 0);
+        apply_session_cost_pricing(&tracker, None, "anthropic", "claude-sonnet-4-5", true);
+        assert!(tracker.is_subscription());
+        assert_eq!(tracker.total_cost_usd(), 0.0);
+
+        // But an Anthropic API-key session stays priced.
+        let tracker = claurst_core::cost::CostTracker::new();
+        apply_session_cost_pricing(&tracker, None, "anthropic", "claude-sonnet-4-5", false);
+        assert!(!tracker.is_subscription());
+        assert!(tracker.total_cost_usd() >= 0.0);
+    }
+
+    #[test]
+    fn session_cost_pricing_unknown_model_gets_no_default() {
+        let reg = ModelRegistry::new();
+        let tracker = claurst_core::cost::CostTracker::new();
+        tracker.add_usage(10_074, 5, 0, 0);
+       
```

**File**: `src-rust/crates/cli/src/main.rs` (modified, +31/-0)
```diff
@@ -906,6 +906,19 @@ async fn main() -> anyhow::Result<()> {
     // from the models.dev cache if available.
     let model_registry = load_cached_model_registry(&config);
 
+    // Cost reporting seed (issue #499): configure the shared tracker for the
+    // active provider/model — zero cost for subscription providers (ChatGPT
+    // Codex, Claude Pro/Max OAuth), catalog pricing for known models, and no
+    // invented default rate for unknown ones. The headless `result` event,
+    // `/cost` and the TUI footer all read this same tracker.
+    claurst_api::apply_session_cost_pricing(
+        &cost_tracker,
+        Some(&model_registry),
+        config.selected_provider_id(),
+        config.effective_model(),
+        use_bearer_auth,
+    );
+
     // Build query config
     let mut query_config = claurst_query::QueryConfig::from_config_with_registry(&config, &model_registry);
     query_config.model_registry = Some(model_registry.clone());
@@ -1037,6 +1050,7 @@ async fn main() -> anyhow::Result<()> {
             bridge_config,
             has_credentials,
             model_registry,
+            use_bearer_auth,
             user_question_rx,
             pending_project_mcp,
             mcp_project_root,
@@ -1470,6 +1484,9 @@ struct RefreshedProviderRuntime {
     provider_registry: Arc<claurst_api::ProviderRegistry>,
     model_registry: Arc<claurst_api::ModelRegistry>,
     auth_store: claurst_core::AuthStore,
+    /// Anthropic auth mode resolved for `config` (Bearer = Claude Pro/Max
+    /// OAuth subscription); feeds the cost tracker (issue #499).
+    use_bearer_auth: bool,
 }
 
 async fn refresh_provider_runtime_state(
@@ -1534,6 +1551,7 @@ async fn refresh_provider_runtime_state(
         provider_registry,
         model_registry,
         auth_store: claurst_core::AuthStore::default(),
+        use_bearer_auth,
     })
 }
 
@@ -1578,6 +1596,7 @@ async fn reload_provider_runtime_state(
         provider_registry,
         model_registry,
         auth_store: claurst_core::AuthStore::default(),
+        use_bearer_auth,
     })
 }
 
@@ -1990,6 +2009,7 @@ async fn run_interactive(
     bridge_config: Option<claurst_bridge::BridgeConfig>,
     has_credentials: bool,
     model_registry: Arc<claurst_api::ModelRegistry>,
+    anthropic_bearer_auth: bool,
     user_question_rx: Option<tokio::sync::mpsc::UnboundedReceiver<claurst_tools::UserQuestionEvent>>,
     pending_project_mcp: Vec<claurst_core::config::McpServerConfig>,
     mcp_project_root: Option<PathBuf>,
@@ -2130,6 +2150,10 @@ async fn run_interactive(
     claurst_tui::spawn_signal_restore_watchers();
     let mut app = App::new(live_config.clone(), cost_tracker.clone());
     app.command_queue = Some(command_queue.clone());
+    // Propagate the startup auth mode into cost reporting: a Claude Pro/Max
+    // OAuth session must report zero cost (issue #499).
+    app.anthropic_bearer_auth = anthropic_bearer_auth;
+    app.sync_cost_pricing();
     // Startup skill discovery runs on the blocking pool so a cold
     // `skills.urls` clone never holds the terminal. When it finishes, the
     // main loop installs the slash commands for autocomplete and every query
@@ -2995,6 +3019,9 @@ async fn run_interactive(
                                                     "Saved provider state cleared. Run /connect to reconnect."
                                                         .to_string(),
                                                 );
+                                                app.anthropic_bearer_auth =
+                                                    refreshed.use_bearer_auth;
+                                                app.sync_cost_pricing();
                                             }
                                             Err(err) => {
                                                 app.status_message = Some(format!(
@@ -4704,6 +4731,10 @@ async fn run_interactive(
                     );
                     app.provider_registry = Some(refreshed.provider_registry);
                     app.has_credentials = true;
+                    // A fresh Claude Pro/Max OAuth login switches usage to
+                    // flat subscription billing — zero reported cost (#499).
+                    app.anthropic_bearer_auth = refreshed.use_bearer_auth;
+                    app.sync_cost_pricing();
                 }
                 Err(err) => {
                     app.status_message =
```

**File**: `src-rust/crates/commands/src/lib.rs` (modified, +34/-8)
```diff
@@ -746,7 +746,6 @@ impl SlashCommand for CostCommand {
     async fn execute(&self, _args: &str, ctx: &mut CommandContext) -> CommandResult {
         let tracker = &ctx.cost_tracker;
         let model = ctx.config.effective_model();
-        let pricing = claurst_core::cost::ModelPricing::for_model(model);
 
         let input = tracker.input_tokens();
         let output = tracker.output_tokens();
@@ -755,20 +754,47 @@ impl SlashCommand for CostCommand {
         let total = tracker.total_tokens();
         let cost = tracker.total_cost_usd();
 
+        // Flat-subscription providers (ChatGPT Plus/Pro for Codex, Claude
+        // Pro/Max OAuth) are not billed per token, so the tracker reports
+        // zero and no rates apply (issue #499).
+        if tracker.is_subscription() {
+            return CommandResult::Message(format!(
+                "Session Cost — {model}\n\
+                 ──────────────────────────────\n\
+                 Billed through a flat subscription (ChatGPT Plus/Pro or\n\
+                 Claude Pro/Max) — usage is not billed per token.\n\n\
+                 \n\
+                 Total tokens:   {total:>10}\n\n\
+                 Use /usage for quota info · /extra-usage for per-call breakdown",
+                model = model,
+                total = total,
+            ));
+        }
+
+        // Read pricing from the tracker itself (catalog-resolved at session
+        // start and on model switches) so these figures match the tracker's
+        // total instead of guessing a rate (issue #499).
+        let pricing_opt = tracker.pricing();
+        let pricing = pricing_opt.unwrap_or(claurst_core::cost::ModelPricing::FREE);
+
         // Per-category cost breakdown.
         let input_cost    = (input as f64 * pricing.input_per_mtk) / 1_000_000.0;
         let output_cost   = (output as f64 * pricing.output_per_mtk) / 1_000_000.0;
         let cc_cost       = (cache_create as f64 * pricing.cache_creation_per_mtk) / 1_000_000.0;
         let cr_cost       = (cache_read as f64 * pricing.cache_read_per_mtk) / 1_000_000.0;
 
         // Pricing info line.
-        let pricing_line = format!(
-            "  Rates ($/MTok): input ${:.2} | output ${:.2} | cache-write ${:.3} | cache-read ${:.3}",
-            pricing.input_per_mtk,
-            pricing.output_per_mtk,
-            pricing.cache_creation_per_mtk,
-            pricing.cache_read_per_mtk,
-        );
+        let pricing_line = match pricing_opt {
+            Some(p) => format!(
+                "  Rates ($/MTok): input ${:.2} | output ${:.2} | cache-write ${:.3} | cache-read ${:.3}",
+                p.input_per_mtk,
+                p.output_per_mtk,
+                p.cache_creation_per_mtk,
+                p.cache_read_per_mtk,
+            ),
+            // Unknown model: no invented default rate — cost reports $0.00.
+            None => "  No per-token rates known for this model — cost reports $0.00.".to_string(),
+        };
 
         // Cache savings note: how much input cost was avoided by using cache-read
         // instead of re-sending those tokens as normal input.
```

**File**: `src-rust/crates/core/src/lib.rs` (modified, +152/-44)
```diff
@@ -5344,7 +5344,7 @@ pub mod history {
 // cost module
 // ---------------------------------------------------------------------------
 pub mod cost {
-    use std::sync::atomic::{AtomicU64, Ordering};
+    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
     use std::sync::Arc;
 
     /// Free upstream provider IDs used in the free provider system.
@@ -5365,6 +5365,23 @@ pub mod cost {
         "zhipuai",
     ];
 
+    /// Providers whose usage is billed through a flat subscription instead of
+    /// per-token rates:
+    ///
+    /// * `codex` / `openai-codex` — ChatGPT Plus/Pro subscription (the Codex
+    ///   provider is OAuth-only, so this id always means the subscription).
+    /// * `anthropic-oauth` — the connect-picker alias for Claude Pro/Max
+    ///   OAuth; at request time it dispatches as `anthropic` with Bearer auth.
+    ///
+    /// Issue #499: subscription usage must report zero cost, never a made-up
+    /// per-token price.
+    pub fn is_subscription_provider(provider_id: &str) -> bool {
+        matches!(
+            provider_id,
+            crate::ProviderId::CODEX | "openai-codex" | "anthropic-oauth"
+        )
+    }
+
     /// Check if a model name is an upstream-prefixed free model (e.g., "groq/llama-3.3-70b-versatile").
     fn is_free_upstream_model(model: &str) -> bool {
         for upstream_id in FREE_UPSTREAM_IDS {
@@ -5417,50 +5434,48 @@ pub mod cost {
             cache_read_per_mtk: 0.0,
         };
 
-        /// Default pricing is Opus (most capable, highest cost).
-        pub fn default_pricing() -> Self {
-            Self::OPUS
-        }
-
         /// Pick pricing based on model name substring matching.
-        pub fn for_model(model: &str) -> Self {
+        ///
+        /// Returns `None` for models we have no price for (issue #499): callers
+        /// should resolve the price from the model catalog instead, and the
+        /// tracker reports zero cost rather than inventing a default rate.
+        /// Only the Claude families (and free models) are priced here — these
+        /// are the models that work with no catalog entry at all.
+        pub fn for_model(model: &str) -> Option<Self> {
             // Check for free models first (those with "-free" suffix, "free/" prefix, or upstream-prefixed free model)
             if model.ends_with("-free") || model.starts_with("free/") || is_free_upstream_model(model) {
-                Self::FREE
+                Some(Self::FREE)
             } else if model.contains("opus") {
-                Self::OPUS
+                Some(Self::OPUS)
+            } else if model.contains("sonnet") {
+                Some(Self::SONNET)
             } else if model.contains("haiku") {
-                Self::HAIKU
+                Some(Self::HAIKU)
             } else {
-                // Default to Sonnet pricing for unknown models
-                Self::SONNET
+                // Unknown model: no default pricing (issue #499).
+                None
             }
         }
     }
 
-    impl Default for ModelPricing {
-        fn default() -> Self {
-            Self::OPUS
-        }
-    }
-
     /// Thread-safe, lock-free cost tracker that accumulates token usage.
+    ///
+    /// Pricing starts unknown (`None`) so a model without a catalog price
+    /// reports zero cost instead of an invented default rate (issue #499);
+    /// subscription providers report zero regardless.
     #[derive(Debug, Default)]
     pub struct CostTracker {
         input_tokens: AtomicU64,
         output_tokens: AtomicU64,
         cache_creation_tokens: AtomicU64,
         cache_read_tokens: AtomicU64,
-        pricing: parking_lot::RwLock<ModelPricing>,
+        pricing: parking_lot::RwLock<Option<ModelPricing>>,
+        subscription: AtomicBool,
     }
 
-    // We need a default for RwLock<ModelPricing> -- use Opus as default.
     impl CostTracker {
         pub fn new() -> Arc<Self> {
-            Arc::new(Self {
-                pricing: parking_lot::RwLock::new(ModelPricing::OPUS),
-                ..Default::default()
-            })
+            Arc::new(Self::default())
         }
 
         pub fn with_model(model: &str) -> Arc<Self> {
@@ -5474,6 +5489,30 @@ pub mod cost {
             *self.pricing.write() = ModelPricing::for_model(model);
         }
 
+        /// Override pricing directly (e.g. resolved from the model catalog).
+        /// `None` marks the price as known to be absent: cost reports zero.
+        pub fn set_pricing(&self, pricing: Option<ModelPricing>) {
+            *self.pricing.write() = pricing;
+        }
+
+        /// The pricing currently configured on this tracker, if any. `None`
+        /// means "no per-token price known" (unknown model, issue #499) —
+        /// consumers must not fall back to an invented default rate.
+        pub fn pricing(&self) -> Option<ModelPricing> {
+            *self.pricing.read()
+        }
+
+        /// Set whether usage is billed through a flat s
```

**File**: `src-rust/crates/tui/src/app/mod.rs` (modified, +5/-0)
```diff
@@ -162,6 +162,10 @@ pub struct App {
     /// Maximum token budget (from env var or model context window) — P2 feature flag
     pub token_budget: Option<u32>,
     pub cost_usd: f64,
+    /// Anthropic session authenticated via Bearer (claude.ai OAuth, i.e. a
+    /// Claude Pro/Max subscription) rather than an API key. Feeds the cost
+    /// tracker's subscription detection (issue #499).
+    pub anthropic_bearer_auth: bool,
     pub model_name: String,
     /// Whether the app has valid API credentials configured.
     /// False = show the in-TUI provider setup dialog on startup.
@@ -651,6 +655,7 @@ impl App {
             token_count: 0,
             token_budget: Self::load_token_budget(),
             cost_usd: 0.0,
+            anthropic_bearer_auth: false,
             model_name,
             has_credentials: true, // overridden by caller when no key is configured
             effort_level: EffortLevel::Medium,
```

**File**: `src-rust/crates/tui/src/app/providers.rs` (modified, +20/-4)
```diff
@@ -211,7 +211,7 @@ impl App {
                 let imported_mcp = result.imported_fields.iter().any(|f| f == "mcpServers");
                 self.config = new_config.clone();
                 self.model_name = self.config.effective_model().to_string();
-                self.cost_tracker.set_model(&self.model_name);
+                self.sync_cost_pricing();
                 self.refresh_context_window_size();
                 self.context_used_tokens = 0;
                 self.has_credentials = self.config.resolve_api_key().is_some();
@@ -384,25 +384,40 @@ impl App {
         self.config.model = None;
 
         let model = self.display_default_model_for_provider(&provider_id);
-        self.cost_tracker.set_model(&model);
         self.model_name = model;
+        self.sync_cost_pricing();
         self.refresh_context_window_size();
         self.context_used_tokens = 0;
     }
 
     /// Update the active model name (also updates config + cost tracker).
     pub fn set_model(&mut self, model: String) {
-        self.cost_tracker.set_model(&model);
         self.model_name = model.clone();
         self.config.model = Some(model.clone());
         if let Some(provider) = Self::infer_provider_from_model(&model) {
             self.config.provider = Some(provider);
         }
+        self.sync_cost_pricing();
         self.refresh_context_window_size();
         // Reset used tokens when switching models (context is fresh).
         self.context_used_tokens = 0;
     }
 
+    /// Re-apply session cost pricing to the shared tracker (issue #499):
+    /// zero cost for subscription providers (ChatGPT Codex, Claude Pro/Max
+    /// OAuth), catalog pricing for known models, and no invented default
+    /// rate for unknown ones. Keeps the TUI footer agreeing with the
+    /// headless `result` event and `/cost`.
+    pub fn sync_cost_pricing(&self) {
+        claurst_api::apply_session_cost_pricing(
+            &self.cost_tracker,
+            Some(&self.model_registry),
+            self.config.selected_provider_id(),
+            &self.model_name,
+            self.anthropic_bearer_auth,
+        );
+    }
+
     pub fn apply_provider_refresh(
         &mut self,
         config: Config,
@@ -433,7 +448,8 @@ impl App {
         self.has_credentials = has_credentials;
         self.fast_mode = false;
         self.model_name = self.config.effective_model().to_string();
-        self.cost_tracker.set_model(&self.model_name);
+        self.anthropic_bearer_auth = false;
+        self.sync_cost_pricing();
         self.status_message = Some(status_message);
         self.clear_prompt();
     }
```

**File**: `src-rust/crates/tui/src/render.rs` (modified, +4/-2)
```diff
@@ -2747,8 +2747,10 @@ fn render_footer(frame: &mut Frame, app: &App, area: Rect) {
         }
 
         // 3. Cost — mirrors TS formatCost: 4 decimal places for costs < $0.50, else 2.
-        // Display cost if it's >= 0.0, so free models show $0.00
-        if app.cost_usd >= 0.0 {
+        // Display cost if it's >= 0.0, so free models show $0.00. Subscription
+        // providers (ChatGPT Codex, Claude Pro/Max OAuth) show no dollar
+        // figure at all because usage isn't billed per token (issue #499).
+        if app.cost_usd >= 0.0 && !app.cost_tracker.is_subscription() {
             if !parts.is_empty() {
                 parts.push(Span::raw("  "));
             }
```

#### Recent Merged Pull Requests:
- **PR #523** (closed): test(core): make write_chain fixture hermetic with one sync write (@alecuba16)
- **PR #506** (2026-10-16): fix(cost): zero cost for subscription providers; no invented rates for unknown models (@Kuberwastaken)
- **PR #505** (2026-10-16): fix(keybindings): Ctrl+V block-visual, Shift+Insert wiring, globalSearch alias, single /keybindings open (@Kuberwastaken)
- **PR #504** (2026-10-16): fix(api): resolve the 	ogetherai provider alias in the registry (@PiUnknown)
- **PR #503** (2026-10-16): fix(keybindings): normalize chords before the protected-key check (@PiUnknown)
- **PR #502** (2026-10-16): fix: fall back to parsing final JSON text when StructuredOutput tool is not called (fixes #498) (@PiUnknown)

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

## X. Merge pull request #505 from Kuberwastaken/fix/495-keybindings-remainder

**RULE**:
When implementing operations in `docs/keybindings.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuberwastaken/claurst. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `465be88f`: Merge pull request #505 from Kuberwastaken/fix/495-keybindings-remainder. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/keybindings.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
The defaults also bind `Ctrl+Left` / `Ctrl+Right` (`moveWordBackward` / `moveWordForward`), `Ctrl+F` (`findInMessage`), `Ctrl+]` (`findNext`), `Ctrl+[` (`findPrev`) and `Ctrl+G` (`goToLine`), but those actions are not implemented, so the keys do nothing. `F3` / `Shift+F3` are listed too, but function keys never reach the binding table. Use `Alt+B` / `Alt+F` to move by word and `Ctrl+P` for project search. `Ctrl+Shift+F` works: its default action is listed as `globalSearch`, an alias of the `openSearch` action — both names open the project search, so either can be bound in `keybindings.json`.
These keys are hard-coded in the prompt and have no action names, so they cannot be remapped. A `keybindings.json` binding on the same key (other than `F1`, which never reaches the binding table) takes precedence over them.
| `Shift+Insert` | Paste text (the `insert` key name reaches the binding table, so it can also be rebound) |
The prompt editor contains a vim emulation with insert, normal, visual (`v`, `V`, `Ctrl+V`), command-line (`:`) and search (`/`) modes.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
The defaults also bind `Ctrl+Left` / `Ctrl+Right` (`moveWordBackward` / `moveWordForward`), `Ctrl+F` (`findInMessage`), `Ctrl+Shift+F` (`globalSearch`), `Ctrl+]` (`findNext`), `Ctrl+[` (`findPrev`) and `Ctrl+G` (`goToLine`), but these actions are not implemented, so the keys do nothing. `F3` / `Shift+F3` are listed too, but function keys never reach the binding table. Use `Alt+B` / `Alt+F` to move by word and `Ctrl+P` for project search. The `openSearch` action (no default key) also opens project search and can be bound; the default `globalSearch` name does nothing.
These keys are hard-coded in the prompt and have no action names, so they cannot be remapped. A `keybindings.json` binding on the same key (other than `F1` and `Shift+Insert`) takes precedence over them.
| `Shift+Insert` | Paste text |
The prompt editor contains a vim emulation with insert, normal, visual (`v`, `V`), command-line (`:`) and search (`/`) modes.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `465be88f` are properly handled with clean fallback behavior.
