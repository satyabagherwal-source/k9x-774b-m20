# Forensic Learning Record (Deep Inspection): Kuberwastaken/claurst

> **Canonical Artifact**: `07_PROJECT_LEARNING/kuberwastaken-claurst-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kuberwastaken/claurst](https://github.com/Kuberwastaken/claurst))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:46:35.809Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuberwastaken/claurst`
- **Description**: Agentic Coding for Builders who Ship
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10310 stars

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

### Core Architecture Module: `src-rust/crates/core/src/claudemd.rs`
```
//! AGENTS.md hierarchical memory loading.
//! Mirrors src/utils/claudemd.ts (1,479 lines).
//!
//! Priority order: managed > user > project > local
//! Supports @include directives, YAML frontmatter, and mtime-based caching.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Memory file type / priority scope.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryScope {
    /// `~/.claurst/rules/*.md` — global managed policy.
    Managed,
    /// `~/.claurst/AGENTS.md` — user-level memory.
    User,
    /// `{project_root}/AGENTS.md` — project-level memory.
    Project,
    /// `{project_root}/.claurst/AGENTS.md` — local override.
    Local,
}

/// Frontmatter parsed from a AGENTS.md file.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryFrontmatter {
    #[serde(default)]
    pub memory_type: Option<String>,
    #[serde(default)]
    pub priority: Option<u32>,
    #[serde(default)]
    pub scope: Option<String>,
}

/// Loaded memory file with metadata.
#[derive(Debug, Clone)]
pub struct MemoryFileInfo {
    pub path: PathBuf,
    pub scope: MemoryScope,
    pub content: String,
    pub frontmatter: MemoryFrontmatter,
    pub mtime: Option<SystemTime>,
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/// Simple mtime-keyed file cache.
#[derive(Default)]
pub struct MemoryCache {
    entries: HashMap<PathBuf, (SystemTime, String)>,
}

impl MemoryCache {
    /// Return cached content if the file hasn't changed since last read.
    pub fn get(&self, path: &Path) -> Option<&str> {
        let mtime = std::fs::metadata(path).ok()?.modified().ok()?;
        let (cached_mtime, content) = self.entries.get(path)?;
        if *cached_mtime == mtime { Some(content.as_str()) } else { None }
    }

    /// Store file content with its current mtime.
    pub fn insert(&mut self, path: PathBuf, content: String) {
        if let Ok(mtime) = std::fs::metadata(&path).and_then(|m| m.modified()) {
            self.entries.insert(path, (mtime, content));
        }
    }
}

// ---------------------------------------------------------------------------
// YAML frontmatter parsing
// ---------------------------------------------------------------------------

/// Strip YAML frontmatter (--- ... ---) from content and parse it.
/// Returns (frontmatter, body_without_frontmatter).
pub fn parse_frontmatter(content: &str) -> (MemoryFrontmatter, &str) {
    if !content.starts_with("---") {
        return (MemoryFrontmatter::default(), content);
    }
    let after_first = &content[3..];
    if let Some(end) = after_first.find("\n---") {
        let yaml = after_first[..end].trim();
        let body = &after_first[end + 4..];
        // Minimal YAML key-value parse (no external dependency).
        let mut fm = MemoryFrontmatter::default();
        for line in yaml.lines() {
            let line = line.trim();
            if let Some((key, val)) = line.split_once(':') {
                let val = val.trim().to_string();
                match key.trim() {
                    "memory_type" => fm.memory_type = Some(val),
                    "priority" => fm.priority = val.parse().ok(),
                    "scope" => fm.scope = Some(val),
                    _ => {}
                }
            }
        }
        return (fm, body.trim_start_matches('\n'));
    }
    (MemoryFrontmatter::default(), content)
}

// ---------------------------------------------------------------------------
// @include directive expansion
// ---------------------------------------------------------------------------

/// Maximum @include nesting depth.
const MAX_INCLUDE_DEPTH: usize = 10;

/// Expand @include directives in content.
/// Circular references are detected via `visited` set.
pub fn expand_includes(
    content: &str,
    base_dir: &Path,
    visited: &mut HashSet<PathBuf>,
    depth: usize,
) -> String {
    if depth >= MAX_INCLUDE_DEPTH {
        return content.to_string();
    }

    let mut result = String::with_capacity(content.len());
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(path_str) = trimmed.strip_prefix("@include ") {
            let path_str = path_str.trim();
            // Resolve relative to base_dir; expand ~ to home dir.
            let include_path = if path_str.starts_with('~') {
                dirs::home_dir()
                    .unwrap_or_default()
                    .join(&path_str[2..])
            } else if Path::new(path_str).is_absolute() {
                PathBuf::from(path_str)
            } else {
                base_dir.join(path_str)
            };

            let canonical = include_path.canonicalize().unwrap_or(include_path.clone());
            if visited.contains(&canonical) {
                result.push_str(&format!("<!-- circular @include {} skipped -->\n", path_str));
                continue;
            }
            if let Ok(included) = std::fs::read_to_string(&include_path) {
                // Check max size.
                if included.len() > 40 * 1024 {
                    result.push_str(&format!("<!-- @include {} exceeds 40KB limit -->\n", path_str));
                    continue;
                }
                visited.insert(canonical);
                let expanded = expand_includes(
                    &included,
                    include_path.parent().unwrap_or(base_dir),
                    visited,
                    depth + 1,
                );
                result.push_str(&expanded);
                result.push('\n');
            } else {
                result.push_str(&format!("<!-- @include {} not found -->\n", path_str));
            }
        } else {
            result.push_str(line);
            result.push('\n');
        }
    }
    result
}

// ---------------------------------------------------------------------------
// Loading API
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE: u64 = 40 * 1024; // 40 KB

/// Load a single AGENTS.md file (respects MAX_FILE_SIZE, expands @includes).
pub fn load_memory_file(path: &Path, scope: MemoryScope) -> Option<MemoryFileInfo> {
    let meta = std::fs::metadata(path).ok()?;
    if meta.len() > MAX_FILE_SIZE {
        eprintln!("WARNING: {} exceeds 40KB limit, skipping", path.display());
        return None;
    }
    let raw = std::fs::read_to_string(path).ok()?;
    let mtime = meta.modified().ok();

    let (frontmatter, body) = parse_frontmatter(&raw);
    let mut visited = HashSet::new();
    visited.insert(path.canonicalize().unwrap_or(path.to_path_buf()));
    let content = expand_includes(body, path.parent().unwrap_or(Path::new(".")), &mut visited, 0);

    Some(MemoryFileInfo {
        path: path.to_path_buf(),
        scope,
        content,
        frontmatter,
        mtime,
    })
}

/// Load memory files from a directory for a given scope.
///
/// Loads `AGENTS.md` first (primary/universal standard), then `CLAUDE.md` if
/// present (Claude-specific additions or overrides). Either file may be absent.
fn load_scope_files(dir: &Path, scope: MemoryScope, files: &mut Vec<MemoryFileInfo>) {
    for name in &["AGENTS.md", "CLAUDE.md"] {
        let path = dir.join(name);
        if path.exists() {
            if let Some(f) = load_memory_file(&path, scope) {
                files.push(f);
            }
        }
    }
}

/// Load all memory files for the given project root, in priority order.
///
/// At each scope `AGENTS.md` is loaded first (universal standard), followed by
/// `CLAUDE.md` if present (Claude-specific context). Either or both may exist.
///
/// Returned list is ordered: Managed (highest) → User → Project → Local.
pub fn load_all_memory_files(project_root: &Path) -> Vec<MemoryFileInfo> {
    let mut files = Vec::new();

    // 1. Managed: <claurst home>/rules/*.md
    {
        let claurst = crate::config::Settings::config_dir();
        let rules_dir = claurst.join("rules");
        if let Ok(entries) = std::fs::read_dir(&rules_dir) {
            let mut paths: Vec<PathBuf> = entries
                .flatten()
                .filter_map(|e| {
                    let p = e.path();
                    if p.extension().is_some_and(|x| x == "md") { Some(p) } else { None }
                })
                .collect();
            paths.sort();
            for p in paths {
                if let Some(f) = load_memory_file(&p, MemoryScope::Managed) {
                    files.push(f);
                }
            }
        }

        // 2. User: <claurst home>/AGENTS.md then <claurst home>/CLAUDE.md
        load_scope_files(&claurst, MemoryScope::User, &mut files);
    }

    // 3. Project: {project_root}/AGENTS.md then {project_root}/CLAUDE.md
    load_scope_files(project_root, MemoryScope::Project, &mut files);

    // 4. Local: {project_root}/.claurst/AGENTS.md then {project_root}/.claurst/CLAUDE.md
    load_scope_files(&project_root.join(".claurst"), MemoryScope::Local, &mut files);

    files
}

/// Concatenate all memory file contents into a single system-prompt fragment.
pub fn build_memory_prompt(files: &[MemoryFileInfo]) -> String {
    files
        .iter()
        .filter(|f| !f.content.trim().is_empty())
        .map(|f| f.content.trim().to_string())
        .colle
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

### Core Architecture Module: `src-rust/crates/core/src/context_collapse.rs`
```
//! Context Collapse Service
//!
//! Automatically reduces conversation size to fit within model context windows.
//! Uses simple word-count estimation and message dropping strategy.
//!
//! Gated behind `cached_microcompact` feature flag.

use crate::types::Message;
#[cfg(feature = "cached_microcompact")]
use crate::types::Role;
use serde::{Deserialize, Serialize};

/// Strategy for collapsing a conversation when it exceeds token limits.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CollapseStrategy {
    /// Drop oldest non-system messages first
    DropOldest,
    /// Summarize the middle of the conversation
    Summarize,
}

/// Collapse state persisted to disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollapseState {
    pub session_id: String,
    pub messages_dropped: usize,
    pub tokens_before: u64,
    pub tokens_after: u64,
    pub strategy_used: String,
    pub collapsed_at: String,
}

/// Simple token estimator: ~4 characters per token
const CHARS_PER_TOKEN: usize = 4;

/// Estimate token count from text using simple heuristic.
fn estimate_tokens(text: &str) -> u64 {
    (text.len() / CHARS_PER_TOKEN).max(1) as u64
}

/// Estimate total tokens in a message list.
pub fn estimate_message_tokens(messages: &[Message]) -> u64 {
    messages
        .iter()
        .map(|m| {
            let content_tokens = estimate_tokens(&format!("{:?}", m.content));
            let role_tokens = 2u64; // "user", "assistant", etc.
            content_tokens + role_tokens
        })
        .sum()
}

/// Collapse a message list to fit within max_tokens.
/// Returns the collapsed message list and collapse state (if collapsing occurred).
#[cfg(feature = "cached_microcompact")]
pub fn collapse_context(
    messages: Vec<Message>,
    max_tokens: u64,
    strategy: CollapseStrategy,
) -> (Vec<Message>, Option<CollapseState>) {
    let initial_tokens = estimate_message_tokens(&messages);

    // Already under limit
    if initial_tokens <= max_tokens {
        return (messages, None);
    }

    let (collapsed, dropped_count) = match strategy {
        CollapseStrategy::DropOldest => drop_oldest_messages(messages, max_tokens),
        CollapseStrategy::Summarize => summarize_messages(messages, max_tokens),
    };

    let final_tokens = estimate_message_tokens(&collapsed);

    let state = CollapseState {
        session_id: "unknown".to_string(),
        messages_dropped: dropped_count,
        tokens_before: initial_tokens,
        tokens_after: final_tokens,
        strategy_used: format!("{:?}", strategy),
        collapsed_at: chrono::Utc::now().to_rfc3339(),
    };

    (collapsed, Some(state))
}

#[cfg(not(feature = "cached_microcompact"))]
pub fn collapse_context(
    messages: Vec<Message>,
    _max_tokens: u64,
    _strategy: CollapseStrategy,
) -> (Vec<Message>, Option<CollapseState>) {
    // Without feature flag, return as-is
    (messages, None)
}

/// Drop oldest non-system messages until under token limit.
#[cfg(feature = "cached_microcompact")]
fn drop_oldest_messages(mut messages: Vec<Message>, max_tokens: u64) -> (Vec<Message>, usize) {
    let mut dropped = 0;

    // Find first non-system user/assistant message (skip system roles)
    let first_user_idx = messages
        .iter()
        .position(|m| m.role != Role::Assistant) // Keep assistant responses, drop user turns
        .unwrap_or(0);

    // Drop messages starting from first_user_idx
    while estimate_message_tokens(&messages) > max_tokens && messages.len() > first_user_idx + 1 {
        messages.remove(first_user_idx);
        dropped += 1;
    }

    (messages, dropped)
}

/// Summarize conversation by keeping first and last N messages.
/// (Full summarization would require calling Claude, so this is a placeholder.)
#[cfg(feature = "cached_microcompact")]
fn summarize_messages(messages: Vec<Message>, _max_tokens: u64) -> (Vec<Message>, usize) {
    let initial_len = messages.len();

    // Simple heuristic: keep first and last 30% of messages
    let target_len = (messages.len() as f64 * 0.6) as usize;
    let keep_per_side = target_len / 2;

    let result = if messages.len() > target_len {
        let mut kept = Vec::new();

        // Keep first messages
        for (i, msg) in messages.iter().enumerate() {
            if i < keep_per_side {
                kept.push(msg.clone());
            }
        }

        // Skip to near end and keep last messages
        let skip_idx = initial_len.saturating_sub(keep_per_side);
        for (i, msg) in messages.iter().enumerate() {
            if i >= skip_idx {
                kept.push(msg.clone());
            }
        }
        kept
    } else {
        messages
    };

    let dropped = initial_len - result.len();
    (result, dropped)
}

/// Persist collapse state to ~/.claurst/context_collapse_state.json
#[cfg(feature = "cached_microcompact")]
pub fn save_collapse_state(_session_id: &str, state: &CollapseState) -> anyhow::Result<()> {
    let path = crate::config::Settings::config_dir().join("context_collapse_state.json");

    std::fs::create_dir_all(path.parent().unwrap())?;
    let json = serde_json::to_string(state)?;
    std::fs::write(&path, json)?;
    Ok(())
}

/// Load collapse state from ~/.claurst/context_collapse_state.json
#[cfg(feature = "cached_microcompact")]
pub fn load_collapse_state(_session_id: &str) -> Option<CollapseState> {
    let path = crate::config::Settings::config_dir().join("context_collapse_state.json");

    if !path.exists() {
        return None;
    }

    let json = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&json).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_tokens() {
        let text = "This is a test message with some content";
        let tokens = estimate_tokens(text);
        assert!(tokens > 0);
    }
}

```

### Core Architecture Module: `src-rust/crates/core/src/crypto_utils.rs`
```
//! Cryptographic utilities — mirrors src/utils/crypto.ts
//!
//! Provides SHA-256 hashing, UUID generation, base64url encoding,
//! and work secret generation.

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

/// Compute the SHA-256 hash of `data` and return it as a lowercase hex string.
pub fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Compute the SHA-256 hash of a UTF-8 string.
pub fn sha256_hex_str(s: &str) -> String {
    sha256_hex(s.as_bytes())
}

/// Encode bytes as base64url (no padding) — same as `btoa` + replace in TS.
pub fn base64url_encode(data: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(data)
}

/// Decode base64url (no padding) bytes.
pub fn base64url_decode(s: &str) -> Result<Vec<u8>, base64::DecodeError> {
    URL_SAFE_NO_PAD.decode(s)
}

/// Generate a random UUID v4 string ("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx").
pub fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Generate a cryptographically random work secret (32 bytes, base64url-encoded).
pub fn generate_work_secret() -> String {
    let mut bytes = [0u8; 32];
    if getrandom::getrandom(&mut bytes).is_err() {
        // Fallback: use time-based entropy
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos();
        let pid = std::process::id();
        let seed = format!("{}-{}", ts, pid);
        let seed_bytes = seed.as_bytes();
        let copy_len = seed_bytes.len().min(32);
        bytes[..copy_len].copy_from_slice(&seed_bytes[..copy_len]);
    }
    base64url_encode(&bytes)
}

/// Encode a project root path for use as a directory name (base64url of the path).
/// Mirrors `src/utils/projectRoot.ts`'s `encodeProjectRoot()`.
pub fn encode_project_root(project_root: &str) -> String {
    base64url_encode(project_root.as_bytes())
}

/// Decode a project root directory name back to a path.
pub fn decode_project_root(encoded: &str) -> Option<String> {
    base64url_decode(encoded)
        .ok()
        .and_then(|bytes| String::from_utf8(bytes).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_known_value() {
        // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
        assert_eq!(
            sha256_hex_str("hello"),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn base64url_roundtrip() {
        let data = b"hello world";
        let encoded = base64url_encode(data);
        let decoded = base64url_decode(&encoded).unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn project_root_roundtrip() {
        let root = "/Users/alice/my-project";
        let encoded = encode_project_root(root);
        let decoded = decode_project_root(&encoded).unwrap();
        assert_eq!(decoded, root);
    }

    #[test]
    fn uuid_format() {
        let u = generate_uuid();
        assert_eq!(u.len(), 36);
        assert_eq!(&u[8..9], "-");
        assert_eq!(&u[13..14], "-");
    }
}

```

### Core Architecture Module: `src-rust/crates/core/src/device_code.rs`
```
// device_code.rs — GitHub Device Code Flow (RFC 8628).
//
// Provides helpers for initiating a device authorization request and polling
// for the resulting access token.  Used primarily for GitHub Copilot auth.

use serde::Deserialize;

const DEVICE_FLOW_USER_AGENT: &str = concat!("claurst/", env!("CARGO_PKG_VERSION"));

/// Response from the device authorization endpoint.
#[derive(Debug, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub interval: u64,
}

/// Initiate a device code flow.
///
/// Returns the device code response containing the user code and verification
/// URI that should be shown to the user.
pub async fn request_device_code(
    client_id: &str,
    scope: &str,
    device_code_url: &str,
) -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(device_code_url)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("User-Agent", DEVICE_FLOW_USER_AGENT)
        .json(&serde_json::json!({
            "client_id": client_id,
            "scope": scope,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    resp.json::<DeviceCodeResponse>()
        .await
        .map_err(|e| e.to_string())
}

/// Poll the token endpoint until the user authorizes or we time out.
///
/// Returns the access token on success.
pub async fn poll_for_token(
    client_id: &str,
    device_code: &str,
    token_url: &str,
    interval: u64,
    timeout_secs: u64,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let start = std::time::Instant::now();

    loop {
        if start.elapsed().as_secs() > timeout_secs {
            return Err("Timed out waiting for authorization".into());
        }

        tokio::time::sleep(std::time::Duration::from_secs(interval + 1)).await;

        let resp = client
            .post(token_url)
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .header("User-Agent", DEVICE_FLOW_USER_AGENT)
            .json(&serde_json::json!({
                "client_id": client_id,
                "device_code": device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

        if let Some(token) = json.get("access_token").and_then(|v| v.as_str()) {
            return Ok(token.to_string());
        }

        if let Some(error) = json.get("error").and_then(|v| v.as_str()) {
            match error {
                "authorization_pending" => continue,
                "slow_down" => {
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
                _ => return Err(format!("Auth error: {}", error)),
            }
        }
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

### Incident Patch 1: `b0637c97` (2026-09-02)
**Commit Message**: Merge pull request #403 from SlugThug/refactor/split-tui-app

refactor(tui): split 7.8k-line app.rs into cohesive app/ modules

**File**: `src-rust/crates/tui/src/app/commands.rs` (added, +391/-0)
```diff
@@ -0,0 +1,391 @@
+//! Slash-command catalog and dispatch.
+
+use claurst_core::config::Theme;
+use claurst_core::types::Role;
+use crate::notifications::NotificationKind;
+use crate::overlays::HelpEntry;
+use super::App;
+use super::run::open_file_externally;
+use super::try_copy_to_clipboard;
+
+pub(super) const PROMPT_SLASH_COMMANDS: &[(&str, &str)] = &[
+    ("advisor", "Set or unset the server-side advisor model"),
+    ("agent", "List available agents or show agent details"),
+    ("agents", "Browse agent definitions and active agents"),
+    ("changes", "Inspect changes from the current session"),
+    ("clear", "Clear the conversation transcript"),
+    ("compact", "Compact the conversation context"),
+    ("config", "Open settings"),
+    ("connect", "Connect an AI provider"),
+    ("context", "Show context window and rate limit usage"),
+    ("copy", "Copy the last assistant response to clipboard"),
+    ("cost", "Show cost breakdown"),
+    ("diff", "Inspect the current git diff"),
+    ("doctor", "Run diagnostics"),
+    ("effort", "Set effort level (low/medium/high/max)"),
+    ("exit", "Quit Claurst"),
+    ("export", "Export conversation"),
+    ("fast", "Toggle fast mode"),
+    ("fork", "Fork session into a new branch"),
+    ("goal", "Set or view the current session goal"),
+    ("heapdump", "Show process memory and diagnostic information"),
+    ("help", "Show help"),
+    ("hooks", "Browse configured hooks (read-only)"),
+    ("import-config", "Import CLAUDE.md and settings.json from ~/.claude"),
+    ("init", "Initialize AGENTS.md for this project"),
+    ("insights", "Generate a session analysis report with conversation statistics"),
+    ("keybindings", "Show keybinding configuration"),
+    ("links", "Open URLs from this session in your browser"),
+    ("login", "Log in to Claurst"),
+    ("logout", "Log out of Claurst"),
+    ("managed-agents", "Configure manager-executor managed agent system"),
+    ("mcp", "Browse configured MCP servers"),
+    ("memory", "Browse and open AGENTS.md memory files"),
+    ("model", "Change the AI model"),
+    ("move", "Re-home this session to another worktree of the same project"),
+    ("new", "Start a fresh session (keeps model, provider & directory)"),
+    ("output-style", "Show or switch the output style / persona"),
+    ("plugin", "Manage plugins (list/info/enable/disable/reload)"),
+    ("providers", "List available AI providers and their status"),
+    ("caveman", "Caveman persona output style — save big token"),
+    ("rocky", "Rocky persona output style — amaze amaze amaze"),
+    ("normal", "Reset persona / output style to default"),
+    ("quit", "Exit Claurst"),
+    ("refresh", "Clear saved provider auth and model caches"),
+    ("rename", "Rename this session"),
+    ("resume", "Resume a previous session"),
+    ("review", "Review changes (git diff)"),
+    ("rewind", "Rewind to an earlier turn"),
+    ("session", "Browse and manage sessions"),
+    ("settings", "Open settings"),
+    ("share", "Upload the current session as a secret gist and get a shareable URL"),
+    ("stats", "Open token and cost stats"),
+    ("survey", "Open session feedback survey"),
+    ("theme", "Open the theme picker"),
+    ("ultrareview", "Run an exhaustive multi-dimensional code review"),
+    ("update", "Check for updates and upgrade to the latest version"),
+    ("upgrade", "Check for updates and upgrade to the latest version"),
+    ("vim", "Toggle vim keybindings"),
+    ("voice", "Toggle voice input mode"),
+];
+
+pub(super) fn help_command_category(name: &str) -> &'static str {
+    match name {
+        "connect" | "model" | "providers" | "refresh" | "fast" | "effort" | "voice" => "Model & Provider",
+        "changes" | "diff" | "review" | "rewind" | "export" | "copy" | "share" | "links" => "Review & History",
+        "stats" | "cost" | "context" | "insights" | "heapdump" | "doctor" => "Diagnostics",
+        "config" | "settings" | "theme" | "keybindings" | "hooks" | "mcp" | "import-config" => {
+            "Workspace"
+        }
+        "agent" | "agents" | "memory" | "plugin" | "survey" => "Tools",
+        "session" | "resume" | "rename" | "fork" | "clear" | "new" | "move" | "compact"
+        | "quit" | "exit" => "Session",
+        _ => "Commands",
+    }
+}
+
+pub(super) fn help_overlay_entries() -> Vec<HelpEntry> {
+    PROMPT_SLASH_COMMANDS
+        .iter()
+        .map(|(name, description)| HelpEntry {
+            name: (*name).to_string(),
+            aliases: String::new(),
+            description: (*description).to_string(),
+            category: help_command_category(name).to_string(),
+        })
+        .collect()
+}
+
+impl App {
+    /// Handle slash commands that should open UI screens rather than execute
+    /// as normal commands. Returns `true` if the command was intercepted.
+    pub fn intercept_slash_command_with_args(&mut self, cmd: &str, args: &str) -> bool {
+        if cmd == "mcp" && !args.trim().is_empty(
```

**File**: `src-rust/crates/tui/src/app/messages.rs` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+//! Transcript operations: add/replace/push, notifications, scroll.
+
+use claurst_core::types::{Message, Role};
+use crate::notifications::NotificationKind;
+use super::App;
+use super::types::{SystemAnnotation, SystemMessageStyle};
+
+impl App {
+    /// Add a message directly (e.g. from a non-streaming source).
+    pub fn add_message(&mut self, role: Role, text: String) {
+        let msg = match role {
+            Role::User => Message::user(text),
+            Role::Assistant => Message::assistant(text),
+        };
+        if role == Role::User {
+            self.begin_user_turn_snapshot();
+        }
+        self.messages.push(msg);
+        self.invalidate_transcript();
+        self.on_new_message();
+    }
+
+    pub fn replace_messages(&mut self, messages: Vec<Message>) {
+        self.messages = messages;
+        self.sync_turn_metadata_to_messages();
+        self.invalidate_transcript();
+    }
+
+    pub fn push_message(&mut self, message: Message) {
+        if message.role == Role::User {
+            self.begin_user_turn_snapshot();
+        }
+        self.messages.push(message);
+        self.sync_turn_metadata_to_messages();
+        self.invalidate_transcript();
+        self.on_new_message();
+    }
+
+    /// Push a synthetic system annotation into the conversation pane.
+    /// It will appear after the current last message.
+    /// Push a notification and, for Error-kind notifications, reset the error
+    /// modal scroll offset so a newly arrived error is always shown from the top.
+    pub fn push_notification(&mut self, kind: NotificationKind, msg: String, duration_secs: Option<u64>) {
+        if kind == NotificationKind::Error {
+            self.error_modal_scroll_offset = 0;
+        }
+        self.notifications.push(kind, msg, duration_secs);
+    }
+
+    pub fn push_system_message(&mut self, text: String, style: SystemMessageStyle) {
+        self.system_annotations.push(SystemAnnotation {
+            after_index: self.messages.len(),
+            text,
+            style,
+        });
+        self.invalidate_transcript();
+    }
+
+    /// Called whenever a new message is appended to `messages`.
+    /// Manages the auto-scroll / new-message-counter state.
+    pub(super) fn on_new_message(&mut self) {
+        if self.auto_scroll {
+            // Auto-scroll: keep offset at 0 so render shows the bottom.
+            self.scroll_offset = 0;
+        } else {
+            self.new_messages_while_scrolled =
+                self.new_messages_while_scrolled.saturating_add(1);
+        }
+    }
+
+    pub fn invalidate_transcript(&self) {
+        self.transcript_version
+            .set(self.transcript_version.get().wrapping_add(1));
+    }
+
+    /// Check current token usage and push token warning notifications as
+    /// appropriate.  Call this after updating `token_count`.
+    pub fn check_token_warnings(&mut self) {
+        let window =
+            claurst_query::context_window_for_model(&self.model_name) as u32;
+        if window == 0 {
+            return;
+        }
+        let pct = (self.token_count as f64 / window as f64 * 100.0) as u8;
+
+        // Only escalate — never repeat a threshold already shown.
+        if pct >= 100 && self.token_warning_threshold_shown < 100 {
+            self.token_warning_threshold_shown = 100;
+            self.push_notification(
+                NotificationKind::Error,
+                "Context window full. Running auto-compact\u{2026}".to_string(),
+                None,
+            );
+        } else if pct >= 95 && self.token_warning_threshold_shown < 95 {
+            self.token_warning_threshold_shown = 95;
+            self.push_notification(
+                NotificationKind::Error,
+                "Context window 95% full! Run /compact now.".to_string(),
+                None, // persistent until dismissed
+            );
+        } else if pct >= 80 && self.token_warning_threshold_shown < 80 {
+            self.token_warning_threshold_shown = 80;
+            self.push_notification(
+                NotificationKind::Warning,
+                "Context window 80% full. Consider /compact.".to_string(),
+                Some(30),
+            );
+        }
+    }
+
+    /// Take the current input buffer, push it to history, and return it.
+    pub fn take_input(&mut self) -> String {
+        let input = self.prompt_input.take();
+        if !input.is_empty() {
+            self.prompt_input.history.push(input.clone());
+            self.prompt_input.history_pos = None;
+            self.prompt_input.history_draft.clear();
+            self.input_history = self.prompt_input.history.clone();
+            self.history_index = self.prompt_input.history_pos;
+        }
+        self.refresh_prompt_input();
+        input
+    }
+
+    /// Scroll the transcript up by `amount` lines and disable auto-follow.
+    ///
+    /// `scroll_offset` counts lines above the bottom (0 = pinned to the
```

**File**: `src-rust/crates/tui/src/app/mod.rs` (added, +945/-0)
```diff
@@ -0,0 +1,945 @@
+//! App state struct and main event loop.
+
+mod commands;
+mod keys;
+mod messages;
+mod mouse;
+mod prompt;
+mod providers;
+mod run;
+#[cfg(test)]
+mod tests;
+mod turns;
+mod types;
+mod views;
+
+pub use types::{
+    ContextMenuKind, DisplayMessage, FocusTarget, HistorySearch,
+    RecentSession, SystemAnnotation, SystemMessageStyle, ToolStatus,
+    ToolUseBlock, TurnMetadata, recent_session_label,
+};
+
+use std::cell::{Cell, RefCell};
+use std::sync::{Arc, Mutex};
+
+use claurst_core::config::{Config, Settings, Theme};
+use claurst_core::cost::CostTracker;
+use claurst_core::file_history::FileHistory;
+use claurst_core::keybindings::{KeybindingResolver, UserKeybindings};
+use claurst_core::types::Message;
+use crate::agents_view::AgentsMenuState;
+use crate::bridge_state::BridgeConnectionState;
+use crate::context_viz::ContextVizState;
+use crate::dialog_select::{DialogSelectState, SelectItem};
+use crate::dialogs::{McpApprovalDialogState, PermissionRequest};
+use crate::diff_viewer::DiffViewerState;
+use crate::export_dialog::ExportDialogState;
+use crate::import_config_dialog::ImportConfigDialogState;
+use crate::mcp_view::McpViewState;
+use crate::model_picker::{EffortLevel, ModelPickerState};
+use crate::notifications::NotificationQueue;
+use crate::overlays::{
+    GlobalSearchState, HelpOverlay, HistorySearchOverlay,
+    MessageSelectorOverlay, RewindFlowOverlay,
+};
+use crate::plugin_views::PluginHintBanner;
+use crate::prompt_input::PromptInputState;
+use crate::session_browser::SessionBrowserState;
+use crate::settings_screen::SettingsScreen;
+use crate::stats_dialog::StatsDialogState;
+use crate::tasks_overlay::TasksOverlay;
+use crate::theme_screen::ThemeScreen;
+use ratatui::style::Color;
+use commands::{PROMPT_SLASH_COMMANDS, help_overlay_entries};
+use providers::{import_config_picker_items, provider_picker_items};
+use types::{ContextMenuState, GoToLineDialog};
+
+/// Attempt to copy text to the system clipboard using platform CLI tools.
+/// Returns true if successful.
+///
+/// Crate-level public API — re-exported by `lib.rs` (`pub use app::try_copy_to_clipboard`).
+pub fn try_copy_to_clipboard(text: &str) -> bool {
+    // Windows
+    #[cfg(target_os = "windows")]
+    {
+        use std::io::Write;
+        if let Ok(mut child) = std::process::Command::new("clip")
+            .stdin(std::process::Stdio::piped())
+            .stdout(std::process::Stdio::null())
+            .stderr(std::process::Stdio::null())
+            .spawn()
+        {
+            if let Some(mut stdin) = child.stdin.take() {
+                let _ = stdin.write_all(text.as_bytes());
+                drop(stdin);
+            }
+            return child.wait().map(|s| s.success()).unwrap_or(false);
+        }
+    }
+    // macOS
+    #[cfg(target_os = "macos")]
+    {
+        use std::io::Write;
+        if let Ok(mut child) = std::process::Command::new("pbcopy")
+            .stdin(std::process::Stdio::piped())
+            .spawn()
+        {
+            if let Some(stdin) = child.stdin.as_mut() {
+                let _ = stdin.write_all(text.as_bytes());
+            }
+            return child.wait().map(|s| s.success()).unwrap_or(false);
+        }
+    }
+    // Linux / Wayland / X11
+    #[cfg(target_os = "linux")]
+    {
+        use std::io::Write;
+        for cmd in &["wl-copy", "xclip -selection clipboard", "xsel --clipboard --input"] {
+            let parts: Vec<&str> = cmd.split_whitespace().collect();
+            if let Some((prog, args)) = parts.split_first() {
+                if let Ok(mut child) = std::process::Command::new(prog)
+                    .args(args)
+                    .stdin(std::process::Stdio::piped())
+                    .spawn()
+                {
+                    if let Some(stdin) = child.stdin.as_mut() {
+                        let _ = stdin.write_all(text.as_bytes());
+                    }
+                    if child.wait().map(|s| s.success()).unwrap_or(false) {
+                        return true;
+                    }
+                }
+            }
+        }
+    }
+    false
+}
+
+/// The top-level TUI application.
+pub struct App {
+    // Core state
+    pub config: Config,
+    pub cost_tracker: Arc<CostTracker>,
+    pub messages: Vec<Message>,
+    /// Combined display list kept in sync with `messages`: real conversation turns
+    /// plus injected system annotations. Used by the renderer so it can iterate
+    /// a single sequence instead of merging two lists on every frame.
+    pub display_messages: Vec<DisplayMessage>,
+    /// Synthetic system annotations interleaved between real messages at render time.
+    pub system_annotations: Vec<SystemAnnotation>,
+    pub input: String,
+    pub prompt_input: PromptInputState,
+    pub input_history: Vec<String>,
+    pub history_index: Option<usize>,
+    pub scroll_offset: usize,
+    pub is_streaming: bool,
+    pub streaming_text: String,
+    pub streaming_th
```

**File**: `src-rust/crates/tui/src/app/mouse.rs` (added, +658/-0)
```diff
@@ -0,0 +1,658 @@
+//! Pointer input: mouse events, selection, context menu, paste viewer.
+
+use crate::notifications::NotificationKind;
+use crossterm::event::{KeyCode, KeyModifiers, MouseEvent, MouseEventKind};
+use tracing::debug;
+use super::App;
+use super::types::{ContextMenuKind, ContextMenuItem, ContextMenuState, FocusTarget};
+
+impl App {
+    /// Detect if a click is a double-click based on timing and position.
+    /// Returns true if the click is within ~500ms and ~5px of the last click.
+    pub(super) fn is_double_click(&self, current_pos: (u16, u16)) -> bool {
+        let now = std::time::Instant::now();
+        match (self.last_click_time, self.last_click_position) {
+            (Some(last_time), Some(last_pos)) => {
+                let elapsed = now.duration_since(last_time);
+                let distance = ((current_pos.0 as i32 - last_pos.0 as i32).abs()
+                    + (current_pos.1 as i32 - last_pos.1 as i32).abs()) as u16;
+                elapsed.as_millis() < 500 && distance <= 5
+            }
+            _ => false,
+        }
+    }
+
+    /// Find word boundaries for the character at (col, row) in the rendered
+    /// transcript buffer. Returns absolute (start_col, end_col) for the word
+    /// containing the click. A "word" is a run of non-whitespace characters.
+    pub(super) fn find_word_boundaries(&self, col: u16, row: u16) -> Option<(u16, u16)> {
+        let cache = self.last_row_text.borrow();
+        let line = cache.get(&row)?;
+        if line.is_empty() {
+            return None;
+        }
+        let selectable_area = self.last_selectable_area.get();
+        if col < selectable_area.x {
+            return None;
+        }
+        let local = (col - selectable_area.x) as usize;
+        let chars: Vec<char> = line.chars().collect();
+        if local >= chars.len() {
+            return None;
+        }
+        let is_word = |c: char| !c.is_whitespace();
+        if !is_word(chars[local]) {
+            return None;
+        }
+        let mut start = local;
+        while start > 0 && is_word(chars[start - 1]) {
+            start -= 1;
+        }
+        let mut end = local;
+        while end + 1 < chars.len() && is_word(chars[end + 1]) {
+            end += 1;
+        }
+        Some((selectable_area.x + start as u16, selectable_area.x + end as u16))
+    }
+
+    /// Find paragraph boundaries (run of non-blank rows) around `row` and
+    /// return (start_row, end_row, end_col) where end_col is the trimmed end
+    /// of the last row's content. Used by triple-click selection so a
+    /// "paragraph" — a contiguous block of text rows — is selected as a unit
+    /// instead of a single visual row.
+    pub(super) fn find_paragraph_boundaries(&self, row: u16) -> Option<(u16, u16, u16)> {
+        let cache = self.last_row_text.borrow();
+        let selectable_area = self.last_selectable_area.get();
+        if selectable_area.width == 0 || selectable_area.height == 0 {
+            return None;
+        }
+        let row_text = cache.get(&row)?;
+        if row_text.trim().is_empty() {
+            return None;
+        }
+        let max_row = selectable_area
+            .y
+            .saturating_add(selectable_area.height)
+            .saturating_sub(1);
+        let mut start = row;
+        while start > selectable_area.y {
+            let prev = start - 1;
+            if cache.get(&prev).map(|s| s.trim().is_empty()).unwrap_or(true) {
+                break;
+            }
+            start = prev;
+        }
+        let mut end = row;
+        while end < max_row {
+            let next = end + 1;
+            if cache.get(&next).map(|s| s.trim().is_empty()).unwrap_or(true) {
+                break;
+            }
+            end = next;
+        }
+        let last_text = cache.get(&end)?;
+        let trimmed = last_text.trim_end();
+        let end_col = selectable_area.x + trimmed.chars().count().saturating_sub(1) as u16;
+        Some((start, end, end_col))
+    }
+
+    /// Find line boundaries for the row containing the click.
+    /// Returns (start_row, end_row) for the line.
+    #[allow(dead_code)]
+    fn find_line_boundaries(&self, row: u16) -> Option<(u16, u16)> {
+        let selectable_area = self.last_selectable_area.get();
+        let line_start = selectable_area.y;
+        let line_end = selectable_area.y.saturating_add(selectable_area.height).saturating_sub(1);
+
+        if row >= line_start && row <= line_end {
+            Some((row, row))
+        } else {
+            None
+        }
+    }
+
+    pub(super) fn context_menu_items(kind: ContextMenuKind) -> &'static [ContextMenuItem] {
+        match kind {
+            ContextMenuKind::Message { .. } => &[ContextMenuItem::Copy, ContextMenuItem::Fork],
+            ContextMenuKind::Selection => &[ContextMenuItem::Copy],
+        }
+    }
+
+    pub(super) fn message_index_at_row(&self, row: u16) -> Option<usize> {
+        self.message_row_map.bo
```

**File**: `src-rust/crates/tui/src/app/prompt.rs` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+//! Prompt input state machine and voice hold-to-talk.
+
+use crate::overlays::SelectorMessage;
+use crate::prompt_input::InputMode;
+use super::App;
+use super::commands::PROMPT_SLASH_COMMANDS;
+
+impl App {
+    /// Open the rewind flow with the current message list converted to
+    /// `SelectorMessage` entries.
+    pub fn open_rewind_flow(&mut self) {
+        let selector_msgs: Vec<SelectorMessage> = self
+            .messages
+            .iter()
+            .enumerate()
+            .map(|(i, m)| {
+                let text = m.get_all_text();
+                let preview: String = text.chars().take(80).collect();
+                let has_tool_use = !m.get_tool_use_blocks().is_empty();
+                SelectorMessage {
+                    idx: i,
+                    role: format!("{:?}", m.role).to_lowercase(),
+                    preview,
+                    has_tool_use,
+                }
+            })
+            .collect();
+        self.rewind_flow.open(selector_msgs);
+    }
+
+    pub(super) fn prompt_mode(&self) -> InputMode {
+        // Note: previously returned Readonly while streaming, but the prompt
+        // now accepts input during streaming so the user can compose / queue
+        // a follow-up message. Plan mode still wins.
+        if self.plan_mode {
+            InputMode::Plan
+        } else {
+            InputMode::Default
+        }
+    }
+
+    pub(super) fn sync_legacy_prompt_fields(&mut self) {
+        self.input = self.prompt_input.text.clone();
+        self.cursor_pos = self.prompt_input.cursor;
+        self.history_index = self.prompt_input.history_pos;
+    }
+
+    pub fn refresh_prompt_input(&mut self) {
+        self.prompt_input.mode = self.prompt_mode();
+        if self.file_injection_dialog.visible {
+            // Don't update suggestions while the injection dialog is open.
+            self.sync_legacy_prompt_fields();
+            return;
+        }
+        let file_autocomplete_limit = self.config.file_autocomplete_limit;
+        let file_autocomplete_show_hidden = self.config.file_autocomplete_show_hidden_files;
+        self.prompt_input.update_suggestions(PROMPT_SLASH_COMMANDS, file_autocomplete_limit, file_autocomplete_show_hidden);
+        self.sync_legacy_prompt_fields();
+    }
+
+    pub fn set_prompt_text(&mut self, text: String) {
+        self.prompt_input.replace_text(text);
+        self.refresh_prompt_input();
+    }
+
+    /// Start PTT recording: open the microphone capture stream and signal the
+    /// UI.  No-op when no voice recorder is attached or recording is already
+    /// in progress.
+    pub fn handle_voice_ptt_start(&mut self) {
+        if self.voice_recording || self.voice_recorder.is_none() {
+            return;
+        }
+        let (tx, rx) = tokio::sync::mpsc::channel(16);
+        self.voice_event_rx = Some(rx);
+        self.voice_recording = true;
+        if let Some(ref recorder_arc) = self.voice_recorder {
+            let recorder = recorder_arc.clone();
+            tokio::task::spawn_blocking(move || {
+                if let Ok(mut r) = recorder.lock() {
+                    tokio::runtime::Handle::current()
+                        .block_on(r.start_recording(tx))
+                        .ok();
+                }
+            });
+        }
+        self.status_message = Some("Recording\u{2026} release V or press Enter to transcribe".to_string());
+    }
+
+    /// Stop PTT recording: flip the AtomicBool inside VoiceRecorder so the
+    /// capture thread exits, then fire a "Transcribing…" notice.  The
+    /// transcript text arrives later via `voice_event_rx` and is injected into
+    /// the prompt by the event-loop drain.
+    pub fn handle_voice_ptt_stop(&mut self) {
+        if !self.voice_recording {
+            return;
+        }
+        self.voice_recording = false;
+        if let Some(ref recorder_arc) = self.voice_recorder {
+            let recorder = recorder_arc.clone();
+            tokio::task::spawn_blocking(move || {
+                if let Ok(mut r) = recorder.lock() {
+                    tokio::runtime::Handle::current()
+                        .block_on(r.stop_recording())
+                        .ok();
+                }
+            });
+        }
+        self.status_message = Some("Transcribing\u{2026}".to_string());
+    }
+
+    pub(super) fn clear_prompt(&mut self) {
+        self.prompt_input.clear();
+        self.refresh_prompt_input();
+    }
+
+    /// Handle Enter while a typeahead popup is open. Accepts the highlighted
+    /// suggestion and returns whether the prompt should now be submitted.
+    ///
+    /// - Slash command: complete the highlighted command *and* run it in a
+    ///   single Enter — the popup acts as a command menu, so a second Enter to
+    ///   "run" it should not be required (issue #183). Returns `true`.
+    /// - File reference: complete the path, append a space, and keep editing so
+    ///   the us
```

**File**: `src-rust/crates/tui/src/app/providers.rs` (added, +441/-0)
```diff
@@ -0,0 +1,441 @@
+//! Provider/model/config management and import-config flow.
+
+use claurst_core::config::{Config, Settings};
+use crate::dialog_select::{DialogSelectState, SelectItem};
+use crate::import_config_dialog::ImportConfigDialogState;
+use crate::model_picker::ModelPickerState;
+use super::App;
+
+/// Return the environment variable name for a given provider ID.
+#[allow(dead_code)]
+fn get_env_var_for_provider(id: &str) -> &'static str {
+    match id {
+        "anthropic" => "ANTHROPIC_API_KEY",
+        "openai" => "OPENAI_API_KEY",
+        "google" | "google-vertex" => "GOOGLE_API_KEY",
+        "github-copilot" => "GITHUB_TOKEN",
+        "groq" => "GROQ_API_KEY",
+        "cerebras" => "CEREBRAS_API_KEY",
+        "sambanova" => "SAMBANOVA_API_KEY",
+        "deepseek" => "DEEPSEEK_API_KEY",
+        "mistral" => "MISTRAL_API_KEY",
+        "openrouter" => "OPENROUTER_API_KEY",
+        "togetherai" => "TOGETHER_API_KEY",
+        "perplexity" => "PERPLEXITY_API_KEY",
+        "cohere" => "COHERE_API_KEY",
+        "xai" => "XAI_API_KEY",
+        "deepinfra" => "DEEPINFRA_API_KEY",
+        "azure" => "AZURE_API_KEY",
+        "amazon-bedrock" => "AWS_ACCESS_KEY_ID",
+        "sap-ai-core" => "AICORE_SERVICE_KEY",
+        "gitlab" => "GITLAB_TOKEN",
+        "cloudflare-ai-gateway" | "cloudflare-workers-ai" => "CLOUDFLARE_API_TOKEN",
+        "vercel" => "AI_GATEWAY_API_KEY",
+        "helicone" => "HELICONE_API_KEY",
+        "huggingface" => "HF_TOKEN",
+        "nvidia" => "NVIDIA_API_KEY",
+        "alibaba" => "DASHSCOPE_API_KEY",
+        "venice" => "VENICE_API_KEY",
+        "moonshotai" => "MOONSHOT_API_KEY",
+        "zhipuai" => "ZHIPU_API_KEY",
+        "zai" => "ZAI_API_KEY",
+        "siliconflow" => "SILICONFLOW_API_KEY",
+        "nebius" => "NEBIUS_API_KEY",
+        "novita" => "NOVITA_API_KEY",
+        "minimax" => "MINIMAX_API_KEY",
+        "ovhcloud" => "OVHCLOUD_API_KEY",
+        "scaleway" => "SCALEWAY_API_KEY",
+        "vultr" => "VULTR_API_KEY",
+        "baseten" => "BASETEN_API_KEY",
+        "friendli" => "FRIENDLI_TOKEN",
+        "upstage" => "UPSTAGE_API_KEY",
+        "stepfun" => "STEPFUN_API_KEY",
+        "fireworks" => "FIREWORKS_API_KEY",
+        _ => "API_KEY",
+    }
+}
+
+/// Return a URL hint for obtaining an API key from a given provider.
+#[allow(dead_code)]
+fn get_url_for_provider(id: &str) -> &'static str {
+    match id {
+        "anthropic" => "console.anthropic.com",
+        "openai" => "platform.openai.com/api-keys",
+        "google" => "aistudio.google.com/apikey",
+        "github-copilot" => "github.com/settings/tokens",
+        "groq" => "console.groq.com/keys",
+        "cerebras" => "cloud.cerebras.ai",
+        "sambanova" => "cloud.sambanova.ai",
+        "deepseek" => "platform.deepseek.com/api_keys",
+        "mistral" => "console.mistral.ai/api-keys",
+        "openrouter" => "openrouter.ai/keys",
+        "togetherai" => "api.together.xyz/settings/api-keys",
+        "perplexity" => "perplexity.ai/settings/api",
+        "cohere" => "dashboard.cohere.com/api-keys",
+        "xai" => "console.x.ai",
+        "deepinfra" => "deepinfra.com/dash/api_keys",
+        "azure" => "portal.azure.com",
+        "amazon-bedrock" => "console.aws.amazon.com/bedrock",
+        "minimax" => "platform.minimaxi.com",
+        "huggingface" => "huggingface.co/settings/tokens",
+        "nvidia" => "build.nvidia.com",
+        "venice" => "venice.ai/settings/api",
+        "zai" => "z.ai/manage-apikey/apikey-list",
+        _ => "the provider's website",
+    }
+}
+
+pub(super) fn import_config_picker_items() -> Vec<SelectItem> {
+    vec![
+        SelectItem {
+            id: "claude-md".into(),
+            title: "CLAUDE.md".into(),
+            description: "Import ~/.claude/CLAUDE.md".into(),
+            category: "Import".into(),
+            badge: None,
+        },
+        SelectItem {
+            id: "settings".into(),
+            title: "settings.json".into(),
+            description: "Import ~/.claude/settings.json".into(),
+            category: "Import".into(),
+            badge: None,
+        },
+        SelectItem {
+            id: "both".into(),
+            title: "Both".into(),
+            description: "Import both CLAUDE.md and settings.json".into(),
+            category: "Import".into(),
+            badge: Some("SAFE".into()),
+        },
+    ]
+}
+
+pub(super) fn provider_picker_items() -> Vec<SelectItem> {
+    vec![
+        SelectItem { id: "free".into(), title: "Free Mode".into(), description: "OpenCode Zen → OpenRouter free fallback (no spend)".into(), category: "Popular".into(), badge: Some("FREE".into()) },
+        SelectItem { id: "openai".into(), title: "OpenAI".into(), description: "(API key)".into(), category: "Popular".into(), badge: None },
+        SelectItem { id: "openai-codex".into(), title: "OpenAI Codex".into(), description: "(ChatGPT Plus/Pro — browser login)".into(), category: "
```

**File**: `src-rust/crates/tui/src/app/run.rs` (added, +628/-0)
```diff
@@ -0,0 +1,628 @@
+//! Main event loop, query events, jump-to-error, file open.
+
+use std::io::Stdout;
+
+use claurst_core::types::Message;
+use claurst_core::{sample_completion_verb, sample_spinner_verb};
+use claurst_query::QueryEvent;
+use crate::notifications::NotificationKind;
+use crate::render;
+use crossterm::event::{self, Event, KeyCode, KeyModifiers};
+use ratatui::backend::CrosstermBackend;
+use ratatui::Terminal;
+use tracing::debug;
+use super::App;
+use super::turns::format_elapsed_ms;
+use super::types::{RecentSession, ToolStatus, ToolUseBlock, recent_session_label};
+
+pub(super) fn open_file_externally(path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
+    // Try to open with the system's default application
+    #[cfg(target_os = "macos")]
+    {
+        std::process::Command::new("open")
+            .arg(path)
+            .spawn()?;
+        Ok(())
+    }
+
+    #[cfg(target_os = "linux")]
+    {
+        std::process::Command::new("xdg-open")
+            .arg(path)
+            .spawn()?;
+        Ok(())
+    }
+
+    #[cfg(target_os = "windows")]
+    {
+        std::process::Command::new("cmd")
+            .args(&["/C", "start", ""])
+            .arg(path)
+            .spawn()?;
+        Ok(())
+    }
+
+    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
+    {
+        // Fallback for other systems: try common editors in order
+        for editor in &["nano", "vi", "vim", "emacs"] {
+            match std::process::Command::new(editor)
+                .arg(path)
+                .spawn()
+            {
+                Ok(_) => return Ok(()),
+                Err(_) => continue,
+            }
+        }
+        Err("No suitable editor found".into())
+    }
+}
+
+impl App {
+    /// Detect the current PR from environment variables or git.
+    pub fn detect_pr(&mut self) {
+        // Check CLAUDE_PR_NUMBER and CLAUDE_PR_URL env vars
+        if let Ok(num) = std::env::var("CLAUDE_PR_NUMBER") {
+            if let Ok(n) = num.parse::<u32>() {
+                self.pr_number = Some(n);
+            }
+        }
+        if let Ok(url) = std::env::var("CLAUDE_PR_URL") {
+            self.pr_url = Some(url);
+        }
+        if let Ok(state) = std::env::var("CLAUDE_PR_STATE") {
+            if !state.trim().is_empty() {
+                self.pr_state = Some(state.trim().to_string());
+            }
+        }
+        // Fall back to gh CLI if no env vars
+        if self.pr_number.is_none() {
+            if let Ok(output) = std::process::Command::new("gh")
+                .args(["pr", "view", "--json", "number,url", "--jq", ".number,.url"])
+                .output()
+            {
+                if output.status.success() {
+                    let text = String::from_utf8_lossy(&output.stdout);
+                    let parts: Vec<&str> = text.trim().split('\n').collect();
+                    if parts.len() >= 2 {
+                        if let Ok(n) = parts[0].trim().parse::<u32>() {
+                            self.pr_number = Some(n);
+                            self.pr_url = Some(parts[1].trim().to_string());
+                        }
+                    }
+                }
+            }
+        }
+    }
+
+    /// Push a completed assistant message and trigger auto-scroll bookkeeping.
+    pub(super) fn push_assistant_message(&mut self, text: String) {
+        let msg = Message::assistant(text);
+        self.messages.push(msg);
+        self.invalidate_transcript();
+        self.on_new_message();
+    }
+
+    /// Process a query event from the agentic loop.
+    pub fn handle_query_event(&mut self, event: QueryEvent) {
+        // Auto-dismiss error modal when assistant responds
+        match &event {
+            QueryEvent::Stream(_) | QueryEvent::TurnComplete { .. } => {
+                self.dismiss_error_notifications();
+            }
+            _ => {}
+        }
+
+        match event {
+            QueryEvent::Stream(stream_evt) => {
+                if !self.is_streaming {
+                    let seed = self.frame_count as usize ^ (self.messages.len() * 17);
+                    self.spinner_verb = Some(sample_spinner_verb(seed).to_string());
+                    // turn_start is set in begin_user_turn_snapshot (prompt
+                    // submission time).  Only fall back here if somehow no
+                    // user message was pushed before streaming began (e.g.
+                    // headless / programmatic callers).
+                    if self.turn_start.is_none() {
+                        self.turn_start = Some(std::time::Instant::now());
+                    }
+                    self.streaming_thinking.clear();
+                }
+                self.is_streaming = true;
+                match stream_evt {
+                    claurst_api::AnthropicStreamEvent::ContentBlockDelta { delta, .. } => {
+                        // Reset stall timer on any incoming delta — w
```

**File**: `src-rust/crates/tui/src/app/tests.rs` (added, +960/-0)
```diff
@@ -0,0 +1,960 @@
+//! Tests for the app module.
+
+use super::*;
+
+use claurst_core::config::Config;
+use claurst_core::types::Role;
+use super::keys::{
+    key_event_to_keystroke, layout_to_latin, normalize_char_with_shift,
+    normalize_layout_shortcut_key,
+};
+use super::types::{ContextMenuItem, ContextMenuState};
+
+    
+    use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyEventState, KeyModifiers};
+
+    fn make_app() -> App {
+        let config = Config::default();
+        let cost_tracker = claurst_core::cost::CostTracker::new();
+        App::new(config, cost_tracker)
+    }
+
+    fn press_key(code: KeyCode, modifiers: KeyModifiers) -> KeyEvent {
+        KeyEvent {
+            code,
+            modifiers,
+            kind: KeyEventKind::Press,
+            state: KeyEventState::NONE,
+        }
+    }
+
+    // ---- recent-activity label (issue #277) ----
+
+    #[test]
+    fn recent_session_label_prefers_title() {
+        let label = recent_session_label(
+            Some("My Title".to_string()),
+            Some("some prompt".to_string()),
+        );
+        assert_eq!(label, "My Title");
+    }
+
+    #[test]
+    fn recent_session_label_falls_back_to_first_prompt_line() {
+        let label = recent_session_label(
+            None,
+            Some("  fix the bug\nand more details".to_string()),
+        );
+        assert_eq!(label, "fix the bug");
+    }
+
+    #[test]
+    fn recent_session_label_skips_blank_title_and_untitled_default() {
+        // Blank/whitespace title is ignored in favour of the prompt.
+        assert_eq!(
+            recent_session_label(Some("   ".to_string()), Some("do it".to_string())),
+            "do it"
+        );
+        // Nothing usable → untitled.
+        assert_eq!(recent_session_label(None, None), "(untitled)");
+        assert_eq!(
+            recent_session_label(Some(String::new()), Some("\n\n".to_string())),
+            "(untitled)"
+        );
+    }
+
+    #[test]
+    fn recent_session_label_truncates_long_prompt() {
+        let long = "x".repeat(200);
+        let label = recent_session_label(None, Some(long));
+        assert_eq!(label.chars().count(), 80);
+    }
+
+    // ---- mouse capture gate (issue #104) ----
+
+    fn scroll_up_event() -> crossterm::event::MouseEvent {
+        crossterm::event::MouseEvent {
+            kind: crossterm::event::MouseEventKind::ScrollUp,
+            column: 0,
+            row: 0,
+            modifiers: KeyModifiers::NONE,
+        }
+    }
+
+    #[test]
+    fn mouse_events_processed_when_capture_enabled() {
+        // Default config leaves mouse capture on, so a scroll wheel event
+        // should move the scroll offset — provided there is content to scroll
+        // over (a render must have established a non-zero max_scroll).
+        let mut app = make_app();
+        assert!(app.config.mouse_capture_enabled());
+        assert_eq!(app.scroll_offset, 0);
+        app.last_max_scroll.set(50);
+        app.handle_mouse_event(scroll_up_event());
+        assert!(app.scroll_offset > 0, "scroll should advance when capture is on");
+        assert!(app.scroll_offset <= 50, "scroll stays within max_scroll");
+    }
+
+    // ---- click-to-view paste placeholders ----
+
+    #[test]
+    fn prompt_click_on_placeholder_opens_viewer() {
+        let mut app = make_app();
+        // Bottom pane as rendered: 1 status row (height > 2), then the top
+        // separator at y=21, text rows from y=22. Prefix "❯ " is 2 cells.
+        app.last_input_area.set(ratatui::layout::Rect { x: 0, y: 20, width: 80, height: 8 });
+        for c in "hi ".chars() {
+            app.prompt_input.insert_char(c);
+        }
+        app.prompt_input.paste("l1\nl2\nl3");
+        assert!(app.prompt_input.text.contains("[Pasted text #1"));
+
+        // Click on the separator row: nothing opens.
+        app.handle_prompt_click(10, 21);
+        assert!(!app.paste_viewer.visible);
+
+        // Click inside the placeholder on the first text row: the viewer
+        // opens read-only — the placeholder stays in the buffer and the body
+        // stays stored so submit-time expansion is unaffected.
+        app.handle_prompt_click(2 + 5, 22);
+        assert!(app.paste_viewer.visible);
+        assert_eq!(app.paste_viewer.paste_id, 1);
+        assert_eq!(app.paste_viewer.line_count(), 3);
+        assert!(app.prompt_input.text.contains("[Pasted text #1"));
+        assert!(!app.prompt_input.paste_contents.is_empty());
+    }
+
+    #[test]
+    fn paste_viewer_alt_e_expands_into_prompt() {
+        let mut app = make_app();
+        app.last_input_area.set(ratatui::layout::Rect { x: 0, y: 20, width: 80, height: 8 });
+        for c in "hi ".chars() {
+            app.prompt_input.insert_char(c);
+        }
+        app.prompt_input.paste("l1\nl2\nl3");
+        app.handle_prompt_click(2 + 5, 22);
+        assert!(app.paste_viewer.visible);
+
+        let alt_e = crossterm::event::KeyEvent::
```

---

### Incident Patch 2: `ff364a45` (2026-09-02)
**Commit Message**: refactor(tui): split 7.8k-line app.rs into cohesive app/ modules

Pure structural move with zero behavior change: app.rs (7,807 lines)
becomes app/ with one module per responsibility — input (keys, mouse),
state model (types), provider management (providers), command dispatch
(commands), session lifecycle (turns, messages, run), and the test
suite (tests). Public API and re-exports are unchanged; the only
visibility adjustment is pub(super) on moved private methods, which
restores exactly the visibility the single-module layout provided.

Verified: workspace cargo check clean, full test suite green (~1,000
tests), and cargo clippy --workspace --all-targets -D warnings clean.

**File**: `src-rust/crates/tui/src/app/commands.rs` (added, +391/-0)
```diff
@@ -0,0 +1,391 @@
+//! Slash-command catalog and dispatch.
+
+use claurst_core::config::Theme;
+use claurst_core::types::Role;
+use crate::notifications::NotificationKind;
+use crate::overlays::HelpEntry;
+use super::App;
+use super::run::open_file_externally;
+use super::try_copy_to_clipboard;
+
+pub(super) const PROMPT_SLASH_COMMANDS: &[(&str, &str)] = &[
+    ("advisor", "Set or unset the server-side advisor model"),
+    ("agent", "List available agents or show agent details"),
+    ("agents", "Browse agent definitions and active agents"),
+    ("changes", "Inspect changes from the current session"),
+    ("clear", "Clear the conversation transcript"),
+    ("compact", "Compact the conversation context"),
+    ("config", "Open settings"),
+    ("connect", "Connect an AI provider"),
+    ("context", "Show context window and rate limit usage"),
+    ("copy", "Copy the last assistant response to clipboard"),
+    ("cost", "Show cost breakdown"),
+    ("diff", "Inspect the current git diff"),
+    ("doctor", "Run diagnostics"),
+    ("effort", "Set effort level (low/medium/high/max)"),
+    ("exit", "Quit Claurst"),
+    ("export", "Export conversation"),
+    ("fast", "Toggle fast mode"),
+    ("fork", "Fork session into a new branch"),
+    ("goal", "Set or view the current session goal"),
+    ("heapdump", "Show process memory and diagnostic information"),
+    ("help", "Show help"),
+    ("hooks", "Browse configured hooks (read-only)"),
+    ("import-config", "Import CLAUDE.md and settings.json from ~/.claude"),
+    ("init", "Initialize AGENTS.md for this project"),
+    ("insights", "Generate a session analysis report with conversation statistics"),
+    ("keybindings", "Show keybinding configuration"),
+    ("links", "Open URLs from this session in your browser"),
+    ("login", "Log in to Claurst"),
+    ("logout", "Log out of Claurst"),
+    ("managed-agents", "Configure manager-executor managed agent system"),
+    ("mcp", "Browse configured MCP servers"),
+    ("memory", "Browse and open AGENTS.md memory files"),
+    ("model", "Change the AI model"),
+    ("move", "Re-home this session to another worktree of the same project"),
+    ("new", "Start a fresh session (keeps model, provider & directory)"),
+    ("output-style", "Show or switch the output style / persona"),
+    ("plugin", "Manage plugins (list/info/enable/disable/reload)"),
+    ("providers", "List available AI providers and their status"),
+    ("caveman", "Caveman persona output style — save big token"),
+    ("rocky", "Rocky persona output style — amaze amaze amaze"),
+    ("normal", "Reset persona / output style to default"),
+    ("quit", "Exit Claurst"),
+    ("refresh", "Clear saved provider auth and model caches"),
+    ("rename", "Rename this session"),
+    ("resume", "Resume a previous session"),
+    ("review", "Review changes (git diff)"),
+    ("rewind", "Rewind to an earlier turn"),
+    ("session", "Browse and manage sessions"),
+    ("settings", "Open settings"),
+    ("share", "Upload the current session as a secret gist and get a shareable URL"),
+    ("stats", "Open token and cost stats"),
+    ("survey", "Open session feedback survey"),
+    ("theme", "Open the theme picker"),
+    ("ultrareview", "Run an exhaustive multi-dimensional code review"),
+    ("update", "Check for updates and upgrade to the latest version"),
+    ("upgrade", "Check for updates and upgrade to the latest version"),
+    ("vim", "Toggle vim keybindings"),
+    ("voice", "Toggle voice input mode"),
+];
+
+pub(super) fn help_command_category(name: &str) -> &'static str {
+    match name {
+        "connect" | "model" | "providers" | "refresh" | "fast" | "effort" | "voice" => "Model & Provider",
+        "changes" | "diff" | "review" | "rewind" | "export" | "copy" | "share" | "links" => "Review & History",
+        "stats" | "cost" | "context" | "insights" | "heapdump" | "doctor" => "Diagnostics",
+        "config" | "settings" | "theme" | "keybindings" | "hooks" | "mcp" | "import-config" => {
+            "Workspace"
+        }
+        "agent" | "agents" | "memory" | "plugin" | "survey" => "Tools",
+        "session" | "resume" | "rename" | "fork" | "clear" | "new" | "move" | "compact"
+        | "quit" | "exit" => "Session",
+        _ => "Commands",
+    }
+}
+
+pub(super) fn help_overlay_entries() -> Vec<HelpEntry> {
+    PROMPT_SLASH_COMMANDS
+        .iter()
+        .map(|(name, description)| HelpEntry {
+            name: (*name).to_string(),
+            aliases: String::new(),
+            description: (*description).to_string(),
+            category: help_command_category(name).to_string(),
+        })
+        .collect()
+}
+
+impl App {
+    /// Handle slash commands that should open UI screens rather than execute
+    /// as normal commands. Returns `true` if the command was intercepted.
+    pub fn intercept_slash_command_with_args(&mut self, cmd: &str, args: &str) -> bool {
+        if cmd == "mcp" && !args.trim().is_empty(
```

**File**: `src-rust/crates/tui/src/app/messages.rs` (added, +161/-0)
```diff
@@ -0,0 +1,161 @@
+//! Transcript operations: add/replace/push, notifications, scroll.
+
+use claurst_core::types::{Message, Role};
+use crate::notifications::NotificationKind;
+use super::App;
+use super::types::{SystemAnnotation, SystemMessageStyle};
+
+impl App {
+    /// Add a message directly (e.g. from a non-streaming source).
+    pub fn add_message(&mut self, role: Role, text: String) {
+        let msg = match role {
+            Role::User => Message::user(text),
+            Role::Assistant => Message::assistant(text),
+        };
+        if role == Role::User {
+            self.begin_user_turn_snapshot();
+        }
+        self.messages.push(msg);
+        self.invalidate_transcript();
+        self.on_new_message();
+    }
+
+    pub fn replace_messages(&mut self, messages: Vec<Message>) {
+        self.messages = messages;
+        self.sync_turn_metadata_to_messages();
+        self.invalidate_transcript();
+    }
+
+    pub fn push_message(&mut self, message: Message) {
+        if message.role == Role::User {
+            self.begin_user_turn_snapshot();
+        }
+        self.messages.push(message);
+        self.sync_turn_metadata_to_messages();
+        self.invalidate_transcript();
+        self.on_new_message();
+    }
+
+    /// Push a synthetic system annotation into the conversation pane.
+    /// It will appear after the current last message.
+    /// Push a notification and, for Error-kind notifications, reset the error
+    /// modal scroll offset so a newly arrived error is always shown from the top.
+    pub fn push_notification(&mut self, kind: NotificationKind, msg: String, duration_secs: Option<u64>) {
+        if kind == NotificationKind::Error {
+            self.error_modal_scroll_offset = 0;
+        }
+        self.notifications.push(kind, msg, duration_secs);
+    }
+
+    pub fn push_system_message(&mut self, text: String, style: SystemMessageStyle) {
+        self.system_annotations.push(SystemAnnotation {
+            after_index: self.messages.len(),
+            text,
+            style,
+        });
+        self.invalidate_transcript();
+    }
+
+    /// Called whenever a new message is appended to `messages`.
+    /// Manages the auto-scroll / new-message-counter state.
+    pub(super) fn on_new_message(&mut self) {
+        if self.auto_scroll {
+            // Auto-scroll: keep offset at 0 so render shows the bottom.
+            self.scroll_offset = 0;
+        } else {
+            self.new_messages_while_scrolled =
+                self.new_messages_while_scrolled.saturating_add(1);
+        }
+    }
+
+    pub fn invalidate_transcript(&self) {
+        self.transcript_version
+            .set(self.transcript_version.get().wrapping_add(1));
+    }
+
+    /// Check current token usage and push token warning notifications as
+    /// appropriate.  Call this after updating `token_count`.
+    pub fn check_token_warnings(&mut self) {
+        let window =
+            claurst_query::context_window_for_model(&self.model_name) as u32;
+        if window == 0 {
+            return;
+        }
+        let pct = (self.token_count as f64 / window as f64 * 100.0) as u8;
+
+        // Only escalate — never repeat a threshold already shown.
+        if pct >= 100 && self.token_warning_threshold_shown < 100 {
+            self.token_warning_threshold_shown = 100;
+            self.push_notification(
+                NotificationKind::Error,
+                "Context window full. Running auto-compact\u{2026}".to_string(),
+                None,
+            );
+        } else if pct >= 95 && self.token_warning_threshold_shown < 95 {
+            self.token_warning_threshold_shown = 95;
+            self.push_notification(
+                NotificationKind::Error,
+                "Context window 95% full! Run /compact now.".to_string(),
+                None, // persistent until dismissed
+            );
+        } else if pct >= 80 && self.token_warning_threshold_shown < 80 {
+            self.token_warning_threshold_shown = 80;
+            self.push_notification(
+                NotificationKind::Warning,
+                "Context window 80% full. Consider /compact.".to_string(),
+                Some(30),
+            );
+        }
+    }
+
+    /// Take the current input buffer, push it to history, and return it.
+    pub fn take_input(&mut self) -> String {
+        let input = self.prompt_input.take();
+        if !input.is_empty() {
+            self.prompt_input.history.push(input.clone());
+            self.prompt_input.history_pos = None;
+            self.prompt_input.history_draft.clear();
+            self.input_history = self.prompt_input.history.clone();
+            self.history_index = self.prompt_input.history_pos;
+        }
+        self.refresh_prompt_input();
+        input
+    }
+
+    /// Scroll the transcript up by `amount` lines and disable auto-follow.
+    ///
+    /// `scroll_offset` counts lines above the bottom (0 = pinned to the
```

**File**: `src-rust/crates/tui/src/app/mod.rs` (added, +945/-0)
```diff
@@ -0,0 +1,945 @@
+//! App state struct and main event loop.
+
+mod commands;
+mod keys;
+mod messages;
+mod mouse;
+mod prompt;
+mod providers;
+mod run;
+#[cfg(test)]
+mod tests;
+mod turns;
+mod types;
+mod views;
+
+pub use types::{
+    ContextMenuKind, DisplayMessage, FocusTarget, HistorySearch,
+    RecentSession, SystemAnnotation, SystemMessageStyle, ToolStatus,
+    ToolUseBlock, TurnMetadata, recent_session_label,
+};
+
+use std::cell::{Cell, RefCell};
+use std::sync::{Arc, Mutex};
+
+use claurst_core::config::{Config, Settings, Theme};
+use claurst_core::cost::CostTracker;
+use claurst_core::file_history::FileHistory;
+use claurst_core::keybindings::{KeybindingResolver, UserKeybindings};
+use claurst_core::types::Message;
+use crate::agents_view::AgentsMenuState;
+use crate::bridge_state::BridgeConnectionState;
+use crate::context_viz::ContextVizState;
+use crate::dialog_select::{DialogSelectState, SelectItem};
+use crate::dialogs::{McpApprovalDialogState, PermissionRequest};
+use crate::diff_viewer::DiffViewerState;
+use crate::export_dialog::ExportDialogState;
+use crate::import_config_dialog::ImportConfigDialogState;
+use crate::mcp_view::McpViewState;
+use crate::model_picker::{EffortLevel, ModelPickerState};
+use crate::notifications::NotificationQueue;
+use crate::overlays::{
+    GlobalSearchState, HelpOverlay, HistorySearchOverlay,
+    MessageSelectorOverlay, RewindFlowOverlay,
+};
+use crate::plugin_views::PluginHintBanner;
+use crate::prompt_input::PromptInputState;
+use crate::session_browser::SessionBrowserState;
+use crate::settings_screen::SettingsScreen;
+use crate::stats_dialog::StatsDialogState;
+use crate::tasks_overlay::TasksOverlay;
+use crate::theme_screen::ThemeScreen;
+use ratatui::style::Color;
+use commands::{PROMPT_SLASH_COMMANDS, help_overlay_entries};
+use providers::{import_config_picker_items, provider_picker_items};
+use types::{ContextMenuState, GoToLineDialog};
+
+/// Attempt to copy text to the system clipboard using platform CLI tools.
+/// Returns true if successful.
+///
+/// Crate-level public API — re-exported by `lib.rs` (`pub use app::try_copy_to_clipboard`).
+pub fn try_copy_to_clipboard(text: &str) -> bool {
+    // Windows
+    #[cfg(target_os = "windows")]
+    {
+        use std::io::Write;
+        if let Ok(mut child) = std::process::Command::new("clip")
+            .stdin(std::process::Stdio::piped())
+            .stdout(std::process::Stdio::null())
+            .stderr(std::process::Stdio::null())
+            .spawn()
+        {
+            if let Some(mut stdin) = child.stdin.take() {
+                let _ = stdin.write_all(text.as_bytes());
+                drop(stdin);
+            }
+            return child.wait().map(|s| s.success()).unwrap_or(false);
+        }
+    }
+    // macOS
+    #[cfg(target_os = "macos")]
+    {
+        use std::io::Write;
+        if let Ok(mut child) = std::process::Command::new("pbcopy")
+            .stdin(std::process::Stdio::piped())
+            .spawn()
+        {
+            if let Some(stdin) = child.stdin.as_mut() {
+                let _ = stdin.write_all(text.as_bytes());
+            }
+            return child.wait().map(|s| s.success()).unwrap_or(false);
+        }
+    }
+    // Linux / Wayland / X11
+    #[cfg(target_os = "linux")]
+    {
+        use std::io::Write;
+        for cmd in &["wl-copy", "xclip -selection clipboard", "xsel --clipboard --input"] {
+            let parts: Vec<&str> = cmd.split_whitespace().collect();
+            if let Some((prog, args)) = parts.split_first() {
+                if let Ok(mut child) = std::process::Command::new(prog)
+                    .args(args)
+                    .stdin(std::process::Stdio::piped())
+                    .spawn()
+                {
+                    if let Some(stdin) = child.stdin.as_mut() {
+                        let _ = stdin.write_all(text.as_bytes());
+                    }
+                    if child.wait().map(|s| s.success()).unwrap_or(false) {
+                        return true;
+                    }
+                }
+            }
+        }
+    }
+    false
+}
+
+/// The top-level TUI application.
+pub struct App {
+    // Core state
+    pub config: Config,
+    pub cost_tracker: Arc<CostTracker>,
+    pub messages: Vec<Message>,
+    /// Combined display list kept in sync with `messages`: real conversation turns
+    /// plus injected system annotations. Used by the renderer so it can iterate
+    /// a single sequence instead of merging two lists on every frame.
+    pub display_messages: Vec<DisplayMessage>,
+    /// Synthetic system annotations interleaved between real messages at render time.
+    pub system_annotations: Vec<SystemAnnotation>,
+    pub input: String,
+    pub prompt_input: PromptInputState,
+    pub input_history: Vec<String>,
+    pub history_index: Option<usize>,
+    pub scroll_offset: usize,
+    pub is_streaming: bool,
+    pub streaming_text: String,
+    pub streaming_th
```

**File**: `src-rust/crates/tui/src/app/mouse.rs` (added, +658/-0)
```diff
@@ -0,0 +1,658 @@
+//! Pointer input: mouse events, selection, context menu, paste viewer.
+
+use crate::notifications::NotificationKind;
+use crossterm::event::{KeyCode, KeyModifiers, MouseEvent, MouseEventKind};
+use tracing::debug;
+use super::App;
+use super::types::{ContextMenuKind, ContextMenuItem, ContextMenuState, FocusTarget};
+
+impl App {
+    /// Detect if a click is a double-click based on timing and position.
+    /// Returns true if the click is within ~500ms and ~5px of the last click.
+    pub(super) fn is_double_click(&self, current_pos: (u16, u16)) -> bool {
+        let now = std::time::Instant::now();
+        match (self.last_click_time, self.last_click_position) {
+            (Some(last_time), Some(last_pos)) => {
+                let elapsed = now.duration_since(last_time);
+                let distance = ((current_pos.0 as i32 - last_pos.0 as i32).abs()
+                    + (current_pos.1 as i32 - last_pos.1 as i32).abs()) as u16;
+                elapsed.as_millis() < 500 && distance <= 5
+            }
+            _ => false,
+        }
+    }
+
+    /// Find word boundaries for the character at (col, row) in the rendered
+    /// transcript buffer. Returns absolute (start_col, end_col) for the word
+    /// containing the click. A "word" is a run of non-whitespace characters.
+    pub(super) fn find_word_boundaries(&self, col: u16, row: u16) -> Option<(u16, u16)> {
+        let cache = self.last_row_text.borrow();
+        let line = cache.get(&row)?;
+        if line.is_empty() {
+            return None;
+        }
+        let selectable_area = self.last_selectable_area.get();
+        if col < selectable_area.x {
+            return None;
+        }
+        let local = (col - selectable_area.x) as usize;
+        let chars: Vec<char> = line.chars().collect();
+        if local >= chars.len() {
+            return None;
+        }
+        let is_word = |c: char| !c.is_whitespace();
+        if !is_word(chars[local]) {
+            return None;
+        }
+        let mut start = local;
+        while start > 0 && is_word(chars[start - 1]) {
+            start -= 1;
+        }
+        let mut end = local;
+        while end + 1 < chars.len() && is_word(chars[end + 1]) {
+            end += 1;
+        }
+        Some((selectable_area.x + start as u16, selectable_area.x + end as u16))
+    }
+
+    /// Find paragraph boundaries (run of non-blank rows) around `row` and
+    /// return (start_row, end_row, end_col) where end_col is the trimmed end
+    /// of the last row's content. Used by triple-click selection so a
+    /// "paragraph" — a contiguous block of text rows — is selected as a unit
+    /// instead of a single visual row.
+    pub(super) fn find_paragraph_boundaries(&self, row: u16) -> Option<(u16, u16, u16)> {
+        let cache = self.last_row_text.borrow();
+        let selectable_area = self.last_selectable_area.get();
+        if selectable_area.width == 0 || selectable_area.height == 0 {
+            return None;
+        }
+        let row_text = cache.get(&row)?;
+        if row_text.trim().is_empty() {
+            return None;
+        }
+        let max_row = selectable_area
+            .y
+            .saturating_add(selectable_area.height)
+            .saturating_sub(1);
+        let mut start = row;
+        while start > selectable_area.y {
+            let prev = start - 1;
+            if cache.get(&prev).map(|s| s.trim().is_empty()).unwrap_or(true) {
+                break;
+            }
+            start = prev;
+        }
+        let mut end = row;
+        while end < max_row {
+            let next = end + 1;
+            if cache.get(&next).map(|s| s.trim().is_empty()).unwrap_or(true) {
+                break;
+            }
+            end = next;
+        }
+        let last_text = cache.get(&end)?;
+        let trimmed = last_text.trim_end();
+        let end_col = selectable_area.x + trimmed.chars().count().saturating_sub(1) as u16;
+        Some((start, end, end_col))
+    }
+
+    /// Find line boundaries for the row containing the click.
+    /// Returns (start_row, end_row) for the line.
+    #[allow(dead_code)]
+    fn find_line_boundaries(&self, row: u16) -> Option<(u16, u16)> {
+        let selectable_area = self.last_selectable_area.get();
+        let line_start = selectable_area.y;
+        let line_end = selectable_area.y.saturating_add(selectable_area.height).saturating_sub(1);
+
+        if row >= line_start && row <= line_end {
+            Some((row, row))
+        } else {
+            None
+        }
+    }
+
+    pub(super) fn context_menu_items(kind: ContextMenuKind) -> &'static [ContextMenuItem] {
+        match kind {
+            ContextMenuKind::Message { .. } => &[ContextMenuItem::Copy, ContextMenuItem::Fork],
+            ContextMenuKind::Selection => &[ContextMenuItem::Copy],
+        }
+    }
+
+    pub(super) fn message_index_at_row(&self, row: u16) -> Option<usize> {
+        self.message_row_map.bo
```

**File**: `src-rust/crates/tui/src/app/prompt.rs` (added, +157/-0)
```diff
@@ -0,0 +1,157 @@
+//! Prompt input state machine and voice hold-to-talk.
+
+use crate::overlays::SelectorMessage;
+use crate::prompt_input::InputMode;
+use super::App;
+use super::commands::PROMPT_SLASH_COMMANDS;
+
+impl App {
+    /// Open the rewind flow with the current message list converted to
+    /// `SelectorMessage` entries.
+    pub fn open_rewind_flow(&mut self) {
+        let selector_msgs: Vec<SelectorMessage> = self
+            .messages
+            .iter()
+            .enumerate()
+            .map(|(i, m)| {
+                let text = m.get_all_text();
+                let preview: String = text.chars().take(80).collect();
+                let has_tool_use = !m.get_tool_use_blocks().is_empty();
+                SelectorMessage {
+                    idx: i,
+                    role: format!("{:?}", m.role).to_lowercase(),
+                    preview,
+                    has_tool_use,
+                }
+            })
+            .collect();
+        self.rewind_flow.open(selector_msgs);
+    }
+
+    pub(super) fn prompt_mode(&self) -> InputMode {
+        // Note: previously returned Readonly while streaming, but the prompt
+        // now accepts input during streaming so the user can compose / queue
+        // a follow-up message. Plan mode still wins.
+        if self.plan_mode {
+            InputMode::Plan
+        } else {
+            InputMode::Default
+        }
+    }
+
+    pub(super) fn sync_legacy_prompt_fields(&mut self) {
+        self.input = self.prompt_input.text.clone();
+        self.cursor_pos = self.prompt_input.cursor;
+        self.history_index = self.prompt_input.history_pos;
+    }
+
+    pub fn refresh_prompt_input(&mut self) {
+        self.prompt_input.mode = self.prompt_mode();
+        if self.file_injection_dialog.visible {
+            // Don't update suggestions while the injection dialog is open.
+            self.sync_legacy_prompt_fields();
+            return;
+        }
+        let file_autocomplete_limit = self.config.file_autocomplete_limit;
+        let file_autocomplete_show_hidden = self.config.file_autocomplete_show_hidden_files;
+        self.prompt_input.update_suggestions(PROMPT_SLASH_COMMANDS, file_autocomplete_limit, file_autocomplete_show_hidden);
+        self.sync_legacy_prompt_fields();
+    }
+
+    pub fn set_prompt_text(&mut self, text: String) {
+        self.prompt_input.replace_text(text);
+        self.refresh_prompt_input();
+    }
+
+    /// Start PTT recording: open the microphone capture stream and signal the
+    /// UI.  No-op when no voice recorder is attached or recording is already
+    /// in progress.
+    pub fn handle_voice_ptt_start(&mut self) {
+        if self.voice_recording || self.voice_recorder.is_none() {
+            return;
+        }
+        let (tx, rx) = tokio::sync::mpsc::channel(16);
+        self.voice_event_rx = Some(rx);
+        self.voice_recording = true;
+        if let Some(ref recorder_arc) = self.voice_recorder {
+            let recorder = recorder_arc.clone();
+            tokio::task::spawn_blocking(move || {
+                if let Ok(mut r) = recorder.lock() {
+                    tokio::runtime::Handle::current()
+                        .block_on(r.start_recording(tx))
+                        .ok();
+                }
+            });
+        }
+        self.status_message = Some("Recording\u{2026} release V or press Enter to transcribe".to_string());
+    }
+
+    /// Stop PTT recording: flip the AtomicBool inside VoiceRecorder so the
+    /// capture thread exits, then fire a "Transcribing…" notice.  The
+    /// transcript text arrives later via `voice_event_rx` and is injected into
+    /// the prompt by the event-loop drain.
+    pub fn handle_voice_ptt_stop(&mut self) {
+        if !self.voice_recording {
+            return;
+        }
+        self.voice_recording = false;
+        if let Some(ref recorder_arc) = self.voice_recorder {
+            let recorder = recorder_arc.clone();
+            tokio::task::spawn_blocking(move || {
+                if let Ok(mut r) = recorder.lock() {
+                    tokio::runtime::Handle::current()
+                        .block_on(r.stop_recording())
+                        .ok();
+                }
+            });
+        }
+        self.status_message = Some("Transcribing\u{2026}".to_string());
+    }
+
+    pub(super) fn clear_prompt(&mut self) {
+        self.prompt_input.clear();
+        self.refresh_prompt_input();
+    }
+
+    /// Handle Enter while a typeahead popup is open. Accepts the highlighted
+    /// suggestion and returns whether the prompt should now be submitted.
+    ///
+    /// - Slash command: complete the highlighted command *and* run it in a
+    ///   single Enter — the popup acts as a command menu, so a second Enter to
+    ///   "run" it should not be required (issue #183). Returns `true`.
+    /// - File reference: complete the path, append a space, and keep editing so
+    ///   the us
```

**File**: `src-rust/crates/tui/src/app/providers.rs` (added, +441/-0)
```diff
@@ -0,0 +1,441 @@
+//! Provider/model/config management and import-config flow.
+
+use claurst_core::config::{Config, Settings};
+use crate::dialog_select::{DialogSelectState, SelectItem};
+use crate::import_config_dialog::ImportConfigDialogState;
+use crate::model_picker::ModelPickerState;
+use super::App;
+
+/// Return the environment variable name for a given provider ID.
+#[allow(dead_code)]
+fn get_env_var_for_provider(id: &str) -> &'static str {
+    match id {
+        "anthropic" => "ANTHROPIC_API_KEY",
+        "openai" => "OPENAI_API_KEY",
+        "google" | "google-vertex" => "GOOGLE_API_KEY",
+        "github-copilot" => "GITHUB_TOKEN",
+        "groq" => "GROQ_API_KEY",
+        "cerebras" => "CEREBRAS_API_KEY",
+        "sambanova" => "SAMBANOVA_API_KEY",
+        "deepseek" => "DEEPSEEK_API_KEY",
+        "mistral" => "MISTRAL_API_KEY",
+        "openrouter" => "OPENROUTER_API_KEY",
+        "togetherai" => "TOGETHER_API_KEY",
+        "perplexity" => "PERPLEXITY_API_KEY",
+        "cohere" => "COHERE_API_KEY",
+        "xai" => "XAI_API_KEY",
+        "deepinfra" => "DEEPINFRA_API_KEY",
+        "azure" => "AZURE_API_KEY",
+        "amazon-bedrock" => "AWS_ACCESS_KEY_ID",
+        "sap-ai-core" => "AICORE_SERVICE_KEY",
+        "gitlab" => "GITLAB_TOKEN",
+        "cloudflare-ai-gateway" | "cloudflare-workers-ai" => "CLOUDFLARE_API_TOKEN",
+        "vercel" => "AI_GATEWAY_API_KEY",
+        "helicone" => "HELICONE_API_KEY",
+        "huggingface" => "HF_TOKEN",
+        "nvidia" => "NVIDIA_API_KEY",
+        "alibaba" => "DASHSCOPE_API_KEY",
+        "venice" => "VENICE_API_KEY",
+        "moonshotai" => "MOONSHOT_API_KEY",
+        "zhipuai" => "ZHIPU_API_KEY",
+        "zai" => "ZAI_API_KEY",
+        "siliconflow" => "SILICONFLOW_API_KEY",
+        "nebius" => "NEBIUS_API_KEY",
+        "novita" => "NOVITA_API_KEY",
+        "minimax" => "MINIMAX_API_KEY",
+        "ovhcloud" => "OVHCLOUD_API_KEY",
+        "scaleway" => "SCALEWAY_API_KEY",
+        "vultr" => "VULTR_API_KEY",
+        "baseten" => "BASETEN_API_KEY",
+        "friendli" => "FRIENDLI_TOKEN",
+        "upstage" => "UPSTAGE_API_KEY",
+        "stepfun" => "STEPFUN_API_KEY",
+        "fireworks" => "FIREWORKS_API_KEY",
+        _ => "API_KEY",
+    }
+}
+
+/// Return a URL hint for obtaining an API key from a given provider.
+#[allow(dead_code)]
+fn get_url_for_provider(id: &str) -> &'static str {
+    match id {
+        "anthropic" => "console.anthropic.com",
+        "openai" => "platform.openai.com/api-keys",
+        "google" => "aistudio.google.com/apikey",
+        "github-copilot" => "github.com/settings/tokens",
+        "groq" => "console.groq.com/keys",
+        "cerebras" => "cloud.cerebras.ai",
+        "sambanova" => "cloud.sambanova.ai",
+        "deepseek" => "platform.deepseek.com/api_keys",
+        "mistral" => "console.mistral.ai/api-keys",
+        "openrouter" => "openrouter.ai/keys",
+        "togetherai" => "api.together.xyz/settings/api-keys",
+        "perplexity" => "perplexity.ai/settings/api",
+        "cohere" => "dashboard.cohere.com/api-keys",
+        "xai" => "console.x.ai",
+        "deepinfra" => "deepinfra.com/dash/api_keys",
+        "azure" => "portal.azure.com",
+        "amazon-bedrock" => "console.aws.amazon.com/bedrock",
+        "minimax" => "platform.minimaxi.com",
+        "huggingface" => "huggingface.co/settings/tokens",
+        "nvidia" => "build.nvidia.com",
+        "venice" => "venice.ai/settings/api",
+        "zai" => "z.ai/manage-apikey/apikey-list",
+        _ => "the provider's website",
+    }
+}
+
+pub(super) fn import_config_picker_items() -> Vec<SelectItem> {
+    vec![
+        SelectItem {
+            id: "claude-md".into(),
+            title: "CLAUDE.md".into(),
+            description: "Import ~/.claude/CLAUDE.md".into(),
+            category: "Import".into(),
+            badge: None,
+        },
+        SelectItem {
+            id: "settings".into(),
+            title: "settings.json".into(),
+            description: "Import ~/.claude/settings.json".into(),
+            category: "Import".into(),
+            badge: None,
+        },
+        SelectItem {
+            id: "both".into(),
+            title: "Both".into(),
+            description: "Import both CLAUDE.md and settings.json".into(),
+            category: "Import".into(),
+            badge: Some("SAFE".into()),
+        },
+    ]
+}
+
+pub(super) fn provider_picker_items() -> Vec<SelectItem> {
+    vec![
+        SelectItem { id: "free".into(), title: "Free Mode".into(), description: "OpenCode Zen → OpenRouter free fallback (no spend)".into(), category: "Popular".into(), badge: Some("FREE".into()) },
+        SelectItem { id: "openai".into(), title: "OpenAI".into(), description: "(API key)".into(), category: "Popular".into(), badge: None },
+        SelectItem { id: "openai-codex".into(), title: "OpenAI Codex".into(), description: "(ChatGPT Plus/Pro — browser login)".into(), category: "
```

**File**: `src-rust/crates/tui/src/app/run.rs` (added, +628/-0)
```diff
@@ -0,0 +1,628 @@
+//! Main event loop, query events, jump-to-error, file open.
+
+use std::io::Stdout;
+
+use claurst_core::types::Message;
+use claurst_core::{sample_completion_verb, sample_spinner_verb};
+use claurst_query::QueryEvent;
+use crate::notifications::NotificationKind;
+use crate::render;
+use crossterm::event::{self, Event, KeyCode, KeyModifiers};
+use ratatui::backend::CrosstermBackend;
+use ratatui::Terminal;
+use tracing::debug;
+use super::App;
+use super::turns::format_elapsed_ms;
+use super::types::{RecentSession, ToolStatus, ToolUseBlock, recent_session_label};
+
+pub(super) fn open_file_externally(path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
+    // Try to open with the system's default application
+    #[cfg(target_os = "macos")]
+    {
+        std::process::Command::new("open")
+            .arg(path)
+            .spawn()?;
+        Ok(())
+    }
+
+    #[cfg(target_os = "linux")]
+    {
+        std::process::Command::new("xdg-open")
+            .arg(path)
+            .spawn()?;
+        Ok(())
+    }
+
+    #[cfg(target_os = "windows")]
+    {
+        std::process::Command::new("cmd")
+            .args(&["/C", "start", ""])
+            .arg(path)
+            .spawn()?;
+        Ok(())
+    }
+
+    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
+    {
+        // Fallback for other systems: try common editors in order
+        for editor in &["nano", "vi", "vim", "emacs"] {
+            match std::process::Command::new(editor)
+                .arg(path)
+                .spawn()
+            {
+                Ok(_) => return Ok(()),
+                Err(_) => continue,
+            }
+        }
+        Err("No suitable editor found".into())
+    }
+}
+
+impl App {
+    /// Detect the current PR from environment variables or git.
+    pub fn detect_pr(&mut self) {
+        // Check CLAUDE_PR_NUMBER and CLAUDE_PR_URL env vars
+        if let Ok(num) = std::env::var("CLAUDE_PR_NUMBER") {
+            if let Ok(n) = num.parse::<u32>() {
+                self.pr_number = Some(n);
+            }
+        }
+        if let Ok(url) = std::env::var("CLAUDE_PR_URL") {
+            self.pr_url = Some(url);
+        }
+        if let Ok(state) = std::env::var("CLAUDE_PR_STATE") {
+            if !state.trim().is_empty() {
+                self.pr_state = Some(state.trim().to_string());
+            }
+        }
+        // Fall back to gh CLI if no env vars
+        if self.pr_number.is_none() {
+            if let Ok(output) = std::process::Command::new("gh")
+                .args(["pr", "view", "--json", "number,url", "--jq", ".number,.url"])
+                .output()
+            {
+                if output.status.success() {
+                    let text = String::from_utf8_lossy(&output.stdout);
+                    let parts: Vec<&str> = text.trim().split('\n').collect();
+                    if parts.len() >= 2 {
+                        if let Ok(n) = parts[0].trim().parse::<u32>() {
+                            self.pr_number = Some(n);
+                            self.pr_url = Some(parts[1].trim().to_string());
+                        }
+                    }
+                }
+            }
+        }
+    }
+
+    /// Push a completed assistant message and trigger auto-scroll bookkeeping.
+    pub(super) fn push_assistant_message(&mut self, text: String) {
+        let msg = Message::assistant(text);
+        self.messages.push(msg);
+        self.invalidate_transcript();
+        self.on_new_message();
+    }
+
+    /// Process a query event from the agentic loop.
+    pub fn handle_query_event(&mut self, event: QueryEvent) {
+        // Auto-dismiss error modal when assistant responds
+        match &event {
+            QueryEvent::Stream(_) | QueryEvent::TurnComplete { .. } => {
+                self.dismiss_error_notifications();
+            }
+            _ => {}
+        }
+
+        match event {
+            QueryEvent::Stream(stream_evt) => {
+                if !self.is_streaming {
+                    let seed = self.frame_count as usize ^ (self.messages.len() * 17);
+                    self.spinner_verb = Some(sample_spinner_verb(seed).to_string());
+                    // turn_start is set in begin_user_turn_snapshot (prompt
+                    // submission time).  Only fall back here if somehow no
+                    // user message was pushed before streaming began (e.g.
+                    // headless / programmatic callers).
+                    if self.turn_start.is_none() {
+                        self.turn_start = Some(std::time::Instant::now());
+                    }
+                    self.streaming_thinking.clear();
+                }
+                self.is_streaming = true;
+                match stream_evt {
+                    claurst_api::AnthropicStreamEvent::ContentBlockDelta { delta, .. } => {
+                        // Reset stall timer on any incoming delta — w
```

**File**: `src-rust/crates/tui/src/app/tests.rs` (added, +960/-0)
```diff
@@ -0,0 +1,960 @@
+//! Tests for the app module.
+
+use super::*;
+
+use claurst_core::config::Config;
+use claurst_core::types::Role;
+use super::keys::{
+    key_event_to_keystroke, layout_to_latin, normalize_char_with_shift,
+    normalize_layout_shortcut_key,
+};
+use super::types::{ContextMenuItem, ContextMenuState};
+
+    
+    use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyEventState, KeyModifiers};
+
+    fn make_app() -> App {
+        let config = Config::default();
+        let cost_tracker = claurst_core::cost::CostTracker::new();
+        App::new(config, cost_tracker)
+    }
+
+    fn press_key(code: KeyCode, modifiers: KeyModifiers) -> KeyEvent {
+        KeyEvent {
+            code,
+            modifiers,
+            kind: KeyEventKind::Press,
+            state: KeyEventState::NONE,
+        }
+    }
+
+    // ---- recent-activity label (issue #277) ----
+
+    #[test]
+    fn recent_session_label_prefers_title() {
+        let label = recent_session_label(
+            Some("My Title".to_string()),
+            Some("some prompt".to_string()),
+        );
+        assert_eq!(label, "My Title");
+    }
+
+    #[test]
+    fn recent_session_label_falls_back_to_first_prompt_line() {
+        let label = recent_session_label(
+            None,
+            Some("  fix the bug\nand more details".to_string()),
+        );
+        assert_eq!(label, "fix the bug");
+    }
+
+    #[test]
+    fn recent_session_label_skips_blank_title_and_untitled_default() {
+        // Blank/whitespace title is ignored in favour of the prompt.
+        assert_eq!(
+            recent_session_label(Some("   ".to_string()), Some("do it".to_string())),
+            "do it"
+        );
+        // Nothing usable → untitled.
+        assert_eq!(recent_session_label(None, None), "(untitled)");
+        assert_eq!(
+            recent_session_label(Some(String::new()), Some("\n\n".to_string())),
+            "(untitled)"
+        );
+    }
+
+    #[test]
+    fn recent_session_label_truncates_long_prompt() {
+        let long = "x".repeat(200);
+        let label = recent_session_label(None, Some(long));
+        assert_eq!(label.chars().count(), 80);
+    }
+
+    // ---- mouse capture gate (issue #104) ----
+
+    fn scroll_up_event() -> crossterm::event::MouseEvent {
+        crossterm::event::MouseEvent {
+            kind: crossterm::event::MouseEventKind::ScrollUp,
+            column: 0,
+            row: 0,
+            modifiers: KeyModifiers::NONE,
+        }
+    }
+
+    #[test]
+    fn mouse_events_processed_when_capture_enabled() {
+        // Default config leaves mouse capture on, so a scroll wheel event
+        // should move the scroll offset — provided there is content to scroll
+        // over (a render must have established a non-zero max_scroll).
+        let mut app = make_app();
+        assert!(app.config.mouse_capture_enabled());
+        assert_eq!(app.scroll_offset, 0);
+        app.last_max_scroll.set(50);
+        app.handle_mouse_event(scroll_up_event());
+        assert!(app.scroll_offset > 0, "scroll should advance when capture is on");
+        assert!(app.scroll_offset <= 50, "scroll stays within max_scroll");
+    }
+
+    // ---- click-to-view paste placeholders ----
+
+    #[test]
+    fn prompt_click_on_placeholder_opens_viewer() {
+        let mut app = make_app();
+        // Bottom pane as rendered: 1 status row (height > 2), then the top
+        // separator at y=21, text rows from y=22. Prefix "❯ " is 2 cells.
+        app.last_input_area.set(ratatui::layout::Rect { x: 0, y: 20, width: 80, height: 8 });
+        for c in "hi ".chars() {
+            app.prompt_input.insert_char(c);
+        }
+        app.prompt_input.paste("l1\nl2\nl3");
+        assert!(app.prompt_input.text.contains("[Pasted text #1"));
+
+        // Click on the separator row: nothing opens.
+        app.handle_prompt_click(10, 21);
+        assert!(!app.paste_viewer.visible);
+
+        // Click inside the placeholder on the first text row: the viewer
+        // opens read-only — the placeholder stays in the buffer and the body
+        // stays stored so submit-time expansion is unaffected.
+        app.handle_prompt_click(2 + 5, 22);
+        assert!(app.paste_viewer.visible);
+        assert_eq!(app.paste_viewer.paste_id, 1);
+        assert_eq!(app.paste_viewer.line_count(), 3);
+        assert!(app.prompt_input.text.contains("[Pasted text #1"));
+        assert!(!app.prompt_input.paste_contents.is_empty());
+    }
+
+    #[test]
+    fn paste_viewer_alt_e_expands_into_prompt() {
+        let mut app = make_app();
+        app.last_input_area.set(ratatui::layout::Rect { x: 0, y: 20, width: 80, height: 8 });
+        for c in "hi ".chars() {
+            app.prompt_input.insert_char(c);
+        }
+        app.prompt_input.paste("l1\nl2\nl3");
+        app.handle_prompt_click(2 + 5, 22);
+        assert!(app.paste_viewer.visible);
+
+        let alt_e = crossterm::event::KeyEvent::
```

---

### Incident Patch 3: `7c041f88` (2026-08-22)
**Commit Message**: fix(vscode): drop model/effort/provider pills — session config is fixed at process start

**File**: `editors/vscode/media/main.css` (modified, +0/-23)
```diff
@@ -13,29 +13,6 @@ body {
   height: 100vh;
 }
 
-#header {
-  display: flex;
-  gap: 6px;
-  padding: 6px 8px;
-  border-bottom: 1px solid var(--vscode-panel-border);
-  flex-shrink: 0;
-}
-
-.pill {
-  background: var(--vscode-badge-background);
-  color: var(--vscode-badge-foreground);
-  border: none;
-  border-radius: 999px;
-  padding: 2px 10px;
-  font-size: 0.85em;
-  cursor: pointer;
-  font-family: var(--vscode-editor-font-family, monospace);
-}
-
-.pill:hover {
-  background: var(--vscode-button-hoverBackground);
-}
-
 #messages {
   flex: 1;
   overflow-y: auto;
```

**File**: `editors/vscode/src/chatPanel.ts` (modified, +13/-136)
```diff
@@ -2,12 +2,6 @@ import * as os from 'os';
 import * as vscode from 'vscode';
 import { AcpClient, PermissionOption, ToolCallUpdate } from './acpClient';
 
-const EFFORT_LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultracode'];
-const COMMON_PROVIDERS = [
-  'anthropic', 'openai', 'google', 'groq', 'cerebras', 'deepseek', 'mistral',
-  'xai', 'openrouter', 'togetherai', 'cohere', 'ollama', 'azure', 'amazon-bedrock',
-];
-
 /** Owns one webview panel and its backing AcpClient/session. */
 export class ChatPanel {
   public static current: ChatPanel | undefined;
@@ -17,10 +11,6 @@ export class ChatPanel {
   private readonly outputChannel: vscode.OutputChannel;
   private disposables: vscode.Disposable[] = [];
 
-  /** While true, streamed events update `status` instead of the visible transcript. */
-  private silent = false;
-  private status: { model?: string; provider?: string; effort?: string } = {};
-
   static createOrShow(extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel): ChatPanel {
     if (ChatPanel.current) {
       ChatPanel.current.panel.reveal();
@@ -63,11 +53,6 @@ export class ChatPanel {
   <title>Claurst</title>
 </head>
 <body>
-  <div id="header">
-    <button class="pill" id="model-pill" title="Change model">model: …</button>
-    <button class="pill" id="provider-pill" title="Change provider">provider: …</button>
-    <button class="pill" id="effort-pill" title="Change reasoning effort">effort: …</button>
-  </div>
   <div id="messages"></div>
   <div id="input-row">
     <textarea id="input-box" rows="1" placeholder="Ask claurst..."></textarea>
@@ -87,23 +72,9 @@ export class ChatPanel {
     const executablePath = vscode.workspace.getConfiguration('claurst').get<string>('executablePath', 'claurst');
 
     this.client = new AcpClient(executablePath, cwd, {
-      onTextChunk: (text, isThought) => {
-        if (!this.silent) {
-          this.postToWebview({ type: 'textChunk', text, isThought });
-        }
-      },
-      onToolCall: (update) => {
-        this.captureStatusFromToolResult(update);
-        if (!this.silent) {
-          this.postToWebview({ type: 'toolCall', ...toolCallPayload(update) });
-        }
-      },
-      onToolCallUpdate: (update) => {
-        this.captureStatusFromToolResult(update);
-        if (!this.silent) {
-          this.postToWebview({ type: 'toolCallUpdate', ...toolCallPayload(update) });
-        }
-      },
+      onTextChunk: (text, isThought) => this.postToWebview({ type: 'textChunk', text, isThought }),
+      onToolCall: (update) => this.postToWebview({ type: 'toolCall', ...toolCallPayload(update) }),
+      onToolCallUpdate: (update) => this.postToWebview({ type: 'toolCallUpdate', ...toolCallPayload(update) }),
       onRequestPermission: (toolCall, options) => this.promptForPermission(toolCall, options),
       onStderr: (line) => this.outputChannel.appendLine(line),
       onExit: (code) => {
@@ -115,60 +86,23 @@ export class ChatPanel {
       await this.client.initialize();
       await this.client.newSession(cwd);
       this.postToWebview({ type: 'status', text: `Session started in ${cwd}` });
-      await this.refreshStatus();
     } catch (e) {
       this.reportError(e);
     }
   }
 
-  /** Silently asks the agent to report model/provider/effort via the Config
-   * tool and updates the header pills. Doesn't appear in the visible transcript. */
-  private async refreshStatus(): Promise<void> {
-    if (!this.client) {
-      return;
-    }
-    this.silent = true;
-    try {
-      await this.client.prompt(
-        'Call the Config tool three times, once each with setting="model", setting="provider", ' +
-        'and setting="effort" (omit "value" every time — these are reads, not writes). ' +
-        'After the three tool calls finish, reply with just the word "ok".',
-      );
-    } catch (e) {
-      this.outputChannel.appendLine(`[claurst-vscode] status refresh failed: ${e}`);
-    } finally {
-      this.silent = false;
-      this.pushStatus();
-    }
-  }
-
-  /** Parses `key = "value"` out of a Config tool result and updates the header. */
-  private captureStatusFromToolResult(update: ToolCallUpdate): void {
-    if (update.title !== 'Config' || !update.resultText) {
-      return;
-    }
-    const match = update.resultText.match(/^(model|provider|effort)\s*=\s*"?([^"\n]+)"?/);
-    if (!match) {
-      return;
-    }
-    const [, key, value] = match;
-    (this.status as any)[key] = value;
-    this.pushStatus();
-  }
-
-  private pushStatus(): void {
-    this.postToWebview({ type: 'headerUpdate', ...this.status });
-  }
-
-  private async promptForPermission(toolCall: ToolCallUpdate, options: PermissionOption[]): Promise<string> {
+  /**
+   * Returns the chosen option id, or `undefined` if the user dismissed the
+   * quick pick without choosing. `undefined` is sent back to the agent as a
+   * `Cancelled` outcome (not an implicit grant) — see acpClient's
+   * handleInco
```

---

### Incident Patch 4: `6022e20a` (2026-08-22)
**Commit Message**: fix(vscode): route through acpProtocol; send Cancelled instead of guessing an option

**File**: `editors/vscode/src/acpClient.ts` (modified, +41/-81)
```diff
@@ -1,15 +1,10 @@
 import * as cp from 'child_process';
 import * as readline from 'readline';
+import { extractText, parseLine } from './acpProtocol';
 
-/** Minimal newline-delimited JSON-RPC 2.0 client for the Agent Client Protocol,
- * matching the wire format implemented in src-rust/crates/acp/src/connection.rs:
- * one UTF-8 line per message, no Content-Length framing. */
-
-export interface JsonRpcError {
-  code: number;
-  message: string;
-  data?: unknown;
-}
+/** Speaks ACP to a `claurst acp` child process over stdio. Wire parsing
+ * itself lives in acpProtocol.ts; this class owns the process, the
+ * pending-request map, and dispatch to caller-supplied event callbacks. */
 
 export type PermissionOption = {
   optionId: string;
@@ -22,21 +17,19 @@ export type ToolCallUpdate = {
   title?: string;
   status?: string;
   kind?: string;
-  /** First text content block from the tool's result, if any. */
-  resultText?: string;
 };
 
 export interface AcpClientEvents {
   onTextChunk?: (text: string, isThought: boolean) => void;
   onToolCall?: (update: ToolCallUpdate) => void;
   onToolCallUpdate?: (update: ToolCallUpdate) => void;
-  /** Must resolve to one of the option ids offered in `options`. */
-  onRequestPermission?: (toolCall: ToolCallUpdate, options: PermissionOption[]) => Promise<string>;
+  /** Return the chosen option id, or `undefined` to cancel the request
+   * (e.g. the user dismissed the picker without choosing). */
+  onRequestPermission?: (toolCall: ToolCallUpdate, options: PermissionOption[]) => Promise<string | undefined>;
   onStderr?: (line: string) => void;
   onExit?: (code: number | null) => void;
 }
 
-/** Speaks ACP to a `claurst acp` child process over stdio. */
 export class AcpClient {
   private child: cp.ChildProcessWithoutNullStreams;
   private rl: readline.Interface;
@@ -66,47 +59,37 @@ export class AcpClient {
   }
 
   private handleLine(line: string): void {
-    const trimmed = line.trim();
-    if (trimmed.length === 0) {
-      return;
-    }
-    let msg: any;
-    try {
-      msg = JSON.parse(trimmed);
-    } catch {
-      this.events.onStderr?.(`[claurst-vscode] malformed line from agent: ${trimmed}`);
+    const parsed = parseLine(line);
+    if (!parsed) {
+      if (line.trim().length > 0) {
+        this.events.onStderr?.(`[claurst-vscode] malformed line from agent: ${line.trim()}`);
+      }
       return;
     }
 
-    const hasId = msg.id !== undefined && msg.id !== null;
-    const hasResult = 'result' in msg;
-    const hasError = 'error' in msg;
-    const hasMethod = typeof msg.method === 'string';
-
-    if (hasId && (hasResult || hasError) && !hasMethod) {
-      const pending = this.pending.get(msg.id);
-      if (!pending) {
+    switch (parsed.kind) {
+      case 'response': {
+        const pending = this.pending.get(parsed.id);
+        if (!pending) {
+          return;
+        }
+        this.pending.delete(parsed.id);
+        if (parsed.error) {
+          pending.reject(Object.assign(new Error(parsed.error.message ?? 'ACP error'), { data: parsed.error }));
+        } else {
+          pending.resolve(parsed.result);
+        }
         return;
       }
-      this.pending.delete(msg.id);
-      if (hasError) {
-        pending.reject(Object.assign(new Error(msg.error?.message ?? 'ACP error'), { data: msg.error }));
-      } else {
-        pending.resolve(msg.result);
-      }
-      return;
-    }
-
-    if (hasId && hasMethod) {
-      // Agent → client request. Only session/request_permission is expected in v1.
-      this.handleIncomingRequest(msg.id, msg.method, msg.params).catch((e) => {
-        this.events.onStderr?.(`[claurst-vscode] failed to handle ${msg.method}: ${e}`);
-      });
-      return;
-    }
-
-    if (hasMethod) {
-      this.handleNotification(msg.method, msg.params);
+      case 'request':
+        // Agent → client request. Only session/request_permission is expected in v1.
+        this.handleIncomingRequest(parsed.id, parsed.method, parsed.params).catch((e) => {
+          this.events.onStderr?.(`[claurst-vscode] failed to handle ${parsed.method}: ${e}`);
+        });
+        return;
+      case 'notification':
+        this.handleNotification(parsed.method, parsed.params);
+        return;
     }
   }
 
@@ -123,12 +106,14 @@ export class AcpClient {
         name: o.name,
         kind: o.kind,
       }));
-      const chosen = (await this.events.onRequestPermission?.(toolCall, options)) ?? options[0]?.optionId;
-      this.writeMessage({
-        jsonrpc: '2.0',
-        id,
-        result: { outcome: { outcome: 'selected', optionId: chosen } },
-      });
+      const chosen = await this.events.onRequestPermission?.(toolCall, options);
+      // No selection (dismissed picker, or no handler wired up) must NOT
+      // grant an option — respond Cancelled, matching the ACP spec's
+      // Cancelled outcome rather than guessing an option to grant.
+      const result = chosen
+        ? { outco
```

---

### Incident Patch 5: `dda2b6f4` (2026-08-22)
**Commit Message**: fix(vscode): preserve tool-call title across status updates

**File**: `editors/vscode/media/main.js` (modified, +7/-19)
```diff
@@ -6,9 +6,6 @@
   const inputEl = document.getElementById('input-box');
   const sendBtn = document.getElementById('send-btn');
   const stopBtn = document.getElementById('stop-btn');
-  const modelPill = document.getElementById('model-pill');
-  const providerPill = document.getElementById('provider-pill');
-  const effortPill = document.getElementById('effort-pill');
 
   let currentAgentBubble = null;
   const toolCallEls = new Map();
@@ -32,6 +29,9 @@
     return '•';
   }
 
+  // The initial tool_call event carries a title; the tool_call_update sent
+  // on completion never does (the agent only sends status + content there).
+  // Remember the title on the element itself so completion doesn't blank it.
   function upsertToolCall(id, title, status) {
     let el = id ? toolCallEls.get(id) : null;
     if (!el) {
@@ -42,8 +42,11 @@
         toolCallEls.set(id, el);
       }
     }
+    if (title) {
+      el.dataset.title = title;
+    }
     el.className = 'tool-call ' + (status || '');
-    el.textContent = `${statusIcon(status)} ${title || '(tool call)'}`;
+    el.textContent = `${statusIcon(status)} ${el.dataset.title || '(tool call)'}`;
     messagesEl.scrollTop = messagesEl.scrollHeight;
   }
 
@@ -79,9 +82,6 @@
       send();
     }
   });
-  modelPill.addEventListener('click', () => vscode.postMessage({ type: 'pickModel' }));
-  providerPill.addEventListener('click', () => vscode.postMessage({ type: 'pickProvider' }));
-  effortPill.addEventListener('click', () => vscode.postMessage({ type: 'pickEffort' }));
 
   setBusy(false);
 
@@ -104,23 +104,11 @@
         upsertToolCall(msg.toolCallId, msg.title, msg.status);
         break;
       }
-      case 'userEcho': {
-        currentAgentBubble = null;
-        appendRow(msg.text, 'user');
-        setBusy(true);
-        break;
-      }
       case 'status': {
         currentAgentBubble = null;
         appendRow(msg.text, 'system');
         break;
       }
-      case 'headerUpdate': {
-        if (msg.model) modelPill.textContent = 'model: ' + msg.model;
-        if (msg.provider) providerPill.textContent = 'provider: ' + msg.provider;
-        if (msg.effort) effortPill.textContent = 'effort: ' + msg.effort;
-        break;
-      }
       case 'turnEnded': {
         currentAgentBubble = null;
         setBusy(false);
```

---

### Incident Patch 6: `601c7be9` (2026-08-22)
**Commit Message**: fix(cli): drop guarded unwrap() on suggestion_index in enter-key handler (#334)

suggestion_index.unwrap() was guarded by a preceding is_some() check so
not an active bug, but AGENTS.md bans unwrap()/expect() on fallible
operations outright. Replace with is_some_and()/get().is_some_and(),
same behavior, no unwrap.

**File**: `src-rust/crates/cli/src/main.rs` (modified, +6/-4)
```diff
@@ -2320,10 +2320,12 @@ async fn run_interactive(
                     if plain_enter && !app.is_streaming && !any_dialog_open {
                         // If a file-ref suggestion is active, accept it instead of submitting.
                         if !app.prompt_input.suggestions.is_empty()
-                            && app.prompt_input.suggestion_index.is_some()
-                            && app.prompt_input.suggestions.get(app.prompt_input.suggestion_index.unwrap())
-                                .map(|s| s.source == claurst_tui::prompt_input::TypeaheadSource::FileRef)
-                                .unwrap_or(false)
+                            && app.prompt_input.suggestion_index.is_some_and(|index| {
+                                app.prompt_input
+                                    .suggestions
+                                    .get(index)
+                                    .is_some_and(|s| s.source == claurst_tui::prompt_input::TypeaheadSource::FileRef)
+                            })
                         {
                             app.prompt_input.accept_suggestion();
                             app.prompt_input.insert_char(' ');
```

---

### Incident Patch 7: `c445559e` (2026-08-22)
**Commit Message**: fix(mcp): recover from mutex poisoning instead of panicking in rmcp_backend (#333)

* fix(mcp): recover from mutex poisoning in legacy SSE endpoint discovery

LegacySseRmcpTransport::start_sse_listener panicked on a poisoned mutex
via .expect(...), which violates the no-expect-on-fallible-ops rule and
cascades one earlier panic into a permanently unusable client. Add a
lock_recover() helper that recovers the guarded state via
PoisonError::into_inner() instead, and use it in start_sse_listener.

* fix(mcp): recover from mutex poisoning in send/close/drop paths

Apply the lock_recover() helper to the remaining .lock().expect(...)
sites in LegacySseRmcpTransport: Drop::drop, Transport::send,
Transport::close, and handle_legacy_sse_http_response. Removes the
last production-path panics on mutex poisoning in this file.

**File**: `src-rust/crates/mcp/src/rmcp_backend.rs` (modified, +35/-26)
```diff
@@ -22,6 +22,16 @@ use tokio::sync::{mpsc, oneshot, Mutex};
 use tokio::task::JoinHandle;
 use tokio_stream::wrappers::ReceiverStream;
 
+/// Lock a `std::sync::Mutex`, recovering from poisoning instead of panicking.
+///
+/// A poisoned mutex only means some other thread panicked while holding the
+/// lock; the guarded state is still valid to read/write here, so panicking
+/// again on every subsequent lock would just cascade one earlier failure
+/// into a permanently unusable client.
+fn lock_recover<T>(mutex: &StdMutex<T>) -> std::sync::MutexGuard<'_, T> {
+    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
+}
+
 pub struct RmcpNotificationClient {
     notifications_tx: mpsc::UnboundedSender<Value>,
     client_info: rmcp_model::ClientInfo,
@@ -281,12 +291,8 @@ impl LegacySseRmcpTransport {
             let result = transport::process_sse_response(response, |event, data| {
                 if matches!(event, Some("endpoint")) {
                     let endpoint = transport::resolve_legacy_endpoint(&sse_url, data)?;
-                    *post_endpoint.lock().expect("endpoint mutex poisoned") = Some(endpoint.clone());
-                    if let Some(tx) = endpoint_tx_for_task
-                        .lock()
-                        .expect("endpoint sender mutex poisoned")
-                        .take()
-                    {
+                    *lock_recover(&post_endpoint) = Some(endpoint.clone());
+                    if let Some(tx) = lock_recover(&endpoint_tx_for_task).take() {
                         let _ = tx.send(Ok(endpoint));
                     }
                     return Ok(());
@@ -304,24 +310,16 @@ impl LegacySseRmcpTransport {
 
             if let Err(e) = result {
                 tracing::warn!(server = %server_name, error = %e, "Legacy SSE stream closed with error");
-                if let Some(tx) = endpoint_tx_for_task
-                    .lock()
-                    .expect("endpoint sender mutex poisoned")
-                    .take()
-                {
+                if let Some(tx) = lock_recover(&endpoint_tx_for_task).take() {
                     let _ = tx.send(Err(anyhow::anyhow!(e.to_string())));
                 }
-            } else if let Some(tx) = endpoint_tx_for_task
-                .lock()
-                .expect("endpoint sender mutex poisoned")
-                .take()
-            {
+            } else if let Some(tx) = lock_recover(&endpoint_tx_for_task).take() {
                 let _ = tx.send(Err(anyhow::anyhow!(
                     "legacy SSE stream closed before announcing endpoint"
                 )));
             }
         });
-        self.background_tasks.lock().expect("task mutex poisoned").push(task);
+        lock_recover(&self.background_tasks).push(task);
 
         let endpoint = tokio::time::timeout(std::time::Duration::from_secs(10), endpoint_rx)
             .await
@@ -337,7 +335,7 @@ impl LegacySseRmcpTransport {
                     self.server_name
                 )
             })??;
-        *self.post_endpoint.lock().expect("endpoint mutex poisoned") = Some(endpoint);
+        *lock_recover(&self.post_endpoint) = Some(endpoint);
         Ok(())
     }
 }
@@ -347,7 +345,7 @@ impl Drop for LegacySseRmcpTransport {
         // Some upper-layer paths drop the backend instead of calling close()
         // explicitly. Abort the listener tasks again here so legacy SSE does
         // not outlive the connection teardown.
-        let mut tasks = self.background_tasks.lock().expect("task mutex poisoned");
+        let mut tasks = lock_recover(&self.background_tasks);
         for handle in tasks.drain(..) {
             handle.abort();
         }
@@ -361,11 +359,7 @@ impl rmcp::transport::Transport<RoleClient> for LegacySseRmcpTransport {
         &mut self,
         item: rmcp::service::TxJsonRpcMessage<RoleClient>,
     ) -> impl std::future::Future<Output = Result<(), Self::Error>> + Send + 'static {
-        let endpoint = self
-            .post_endpoint
-            .lock()
-            .expect("endpoint mutex poisoned")
-            .clone();
+        let endpoint = lock_recover(&self.post_endpoint).clone();
         let client = self.client.clone();
         let auth_token = self.auth_token.clone();
         let server_name = self.server_name.clone();
@@ -417,7 +411,7 @@ impl rmcp::transport::Transport<RoleClient> for LegacySseRmcpTransport {
     fn close(&mut self) -> impl std::future::Future<Output = Result<(), Self::Error>> + Send {
         let background_tasks = Arc::clone(&self.background_tasks);
         async move {
-            let mut tasks = background_tasks.lock().expect("task mutex poisoned");
+            let mut tasks = lock_recover(&background_tasks);
             for handle in tasks.drain(..) {
                 handle.abort();
             }
@@ -476,7 +470,7 @@ async fn handle_legacy_sse_http_response(
                 tracing::warn!(server = %server_name_for_task, error = %e, "legacy
```

---

### Incident Patch 8: `3b2b3bcc` (2026-08-22)
**Commit Message**: fix(mcp): reject path traversal in MCP token file names (#332)

* fix(mcp): reject path traversal in MCP token file names

token_path() joined the raw server_name into a file path. A server_name
containing ".." or path separators could escape the token store
directory. Reduce to the path's file-name component before joining, so
traversal segments are stripped instead of trusted.

* fix(mcp): propagate PKCE verifier RNG failure instead of panicking

pkce_verifier() called .expect() on getrandom(), which would crash the
whole process on a rare RNG failure during OAuth login. Return
std::io::Result and propagate through both call sites instead.

**File**: `src-rust/crates/mcp/src/oauth.rs` (modified, +30/-6)
```diff
@@ -52,8 +52,16 @@ fn token_store_dir() -> PathBuf {
 }
 
 /// Path to the token store for a given MCP server.
+///
+/// `server_name` is untrusted (it comes from MCP server config), so it is
+/// reduced to its file-name component before joining — this rejects path
+/// separators and `..` traversal instead of trusting the raw string.
 fn token_path(server_name: &str) -> PathBuf {
-    token_store_dir().join(format!("{}.json", server_name))
+    let safe_name = std::path::Path::new(server_name)
+        .file_name()
+        .map(|name| name.to_string_lossy().into_owned())
+        .unwrap_or_default();
+    token_store_dir().join(format!("{}.json", safe_name))
 }
 
 /// Persist an MCP OAuth token to disk.
@@ -187,7 +195,7 @@ pub async fn begin_mcp_auth(
     let redirect_port = oauth_port_alloc()
         .map_err(|e| anyhow::anyhow!("Failed to allocate OAuth redirect port: {}", e))?;
     let redirect_uri = format!("http://127.0.0.1:{}/callback", redirect_port);
-    let verifier = pkce_verifier();
+    let verifier = pkce_verifier().map_err(|e| anyhow::anyhow!("Failed to generate PKCE verifier: {}", e))?;
     let auth_url = build_mcp_auth_url(
         &metadata.authorization_endpoint,
         &redirect_uri,
@@ -365,12 +373,12 @@ pub async fn get_valid_mcp_access_token(
 // ---------------------------------------------------------------------------
 
 /// Generate a PKCE code verifier (43 URL-safe random chars per RFC 7636).
-pub fn pkce_verifier() -> String {
+pub fn pkce_verifier() -> std::io::Result<String> {
     use base64::Engine as _;
     let mut bytes = [0u8; 32];
-    getrandom::getrandom(&mut bytes).expect("getrandom failed");
+    getrandom::getrandom(&mut bytes).map_err(std::io::Error::other)?;
     // base64url-encode → 43 chars (256 bits of entropy, no padding)
-    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
+    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes))
 }
 
 /// Derive a PKCE code challenge from a verifier (S256 method).
@@ -416,7 +424,7 @@ pub fn initiate_xaa_login(
     idp_url: &str,
 ) -> std::io::Result<XaaLoginState> {
     let port = oauth_port_alloc()?;
-    let verifier = pkce_verifier();
+    let verifier = pkce_verifier()?;
     let challenge = pkce_challenge(&verifier);
     let redirect_uri = format!("http://127.0.0.1:{}/callback", port);
 
@@ -568,6 +576,22 @@ pub async fn refresh_mcp_token(server_name: &str, token_endpoint: &str) -> anyho
 mod tests {
     use super::*;
 
+    #[test]
+    fn token_path_strips_path_traversal() {
+        let traversal = token_path("../../etc/passwd");
+        assert_eq!(traversal.file_name().unwrap(), "passwd.json");
+        assert_eq!(traversal.parent().unwrap(), token_store_dir());
+
+        let normal = token_path("my-server");
+        assert_eq!(normal.file_name().unwrap(), "my-server.json");
+    }
+
+    #[test]
+    fn pkce_verifier_is_43_chars() {
+        let v = pkce_verifier().expect("getrandom should succeed in tests");
+        assert_eq!(v.len(), 43);
+    }
+
     #[test]
     fn pkce_challenge_length() {
         let v = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
```

---

### Incident Patch 9: `31286b3d` (2026-08-22)
**Commit Message**: fix: make nix dependency Unix-only for Windows compilation (#68)

The nix crate is Unix-only and was listed as an unconditional dependency
in the cli Cargo.toml, preventing compilation on Windows. The actual
usage in main.rs is already gated behind #[cfg(unix)], so this just
moves the dep to [target.'cfg(unix)'.dependencies] to match.

Co-authored-by: nullislander <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `src-rust/crates/cli/Cargo.toml` (modified, +3/-1)
```diff
@@ -38,12 +38,14 @@ url = { workspace = true }
 crossterm = { workspace = true }
 parking_lot = { workspace = true }
 dirs = { workspace = true }
-nix = { workspace = true }
 base64 = "0.22"
 sha2 = "0.10"
 open = "5"
 urlencoding = "2"
 xxhash-rust = { version = "0.8", features = ["xxh64"] }
 
+[target.'cfg(unix)'.dependencies]
+nix = { workspace = true }
+
 [build-dependencies]
 chrono = { workspace = true }
```

---

### Incident Patch 10: `97a73161` (2026-08-22)
**Commit Message**: fix(npm): make CLI entrypoint executable (#188)



---

### Incident Patch 11: `014ab024` (2026-07-31)
**Commit Message**: feat(vscode): redesign chat UI with bubbles, header pills, and busy state

Replaces the flat message list with aligned user/agent bubbles, a
header row of clickable model/provider/effort pills, in-place tool-call
updates keyed by toolCallId (instead of a new line per update), an
auto-resizing input box, and a Send/Stop toggle driven by turn state.

**File**: `editors/vscode/media/main.css` (modified, +94/-12)
```diff
@@ -1,3 +1,7 @@
+:root {
+  --bubble-radius: 10px;
+}
+
 body {
   font-family: var(--vscode-font-family);
   font-size: var(--vscode-font-size);
@@ -9,43 +13,101 @@ body {
   height: 100vh;
 }
 
+#header {
+  display: flex;
+  gap: 6px;
+  padding: 6px 8px;
+  border-bottom: 1px solid var(--vscode-panel-border);
+  flex-shrink: 0;
+}
+
+.pill {
+  background: var(--vscode-badge-background);
+  color: var(--vscode-badge-foreground);
+  border: none;
+  border-radius: 999px;
+  padding: 2px 10px;
+  font-size: 0.85em;
+  cursor: pointer;
+  font-family: var(--vscode-editor-font-family, monospace);
+}
+
+.pill:hover {
+  background: var(--vscode-button-hoverBackground);
+}
+
 #messages {
   flex: 1;
   overflow-y: auto;
-  padding: 8px 12px;
+  padding: 10px 12px;
+  display: flex;
+  flex-direction: column;
+  gap: 4px;
 }
 
-.message {
+.row {
+  display: flex;
+}
+
+.row.user { justify-content: flex-end; }
+.row.agent, .row.thought, .row.system { justify-content: flex-start; }
+
+.bubble {
+  max-width: 85%;
+  padding: 7px 11px;
+  border-radius: var(--bubble-radius);
   white-space: pre-wrap;
-  margin-bottom: 12px;
-  line-height: 1.4;
+  line-height: 1.45;
+  overflow-wrap: anywhere;
 }
 
-.message.user {
-  color: var(--vscode-textLink-foreground);
+.bubble.user {
+  background: var(--vscode-button-background);
+  color: var(--vscode-button-foreground);
+  border-bottom-right-radius: 2px;
 }
 
-.message.thought {
+.bubble.agent {
+  background: var(--vscode-editorWidget-background, var(--vscode-input-background));
+  border-bottom-left-radius: 2px;
+}
+
+.bubble.thought {
+  background: transparent;
   color: var(--vscode-descriptionForeground);
   font-style: italic;
+  padding-left: 0;
 }
 
-.tool-call {
-  border-left: 2px solid var(--vscode-textLink-foreground);
-  padding-left: 8px;
-  margin: 6px 0;
+.bubble.system {
+  background: transparent;
   color: var(--vscode-descriptionForeground);
   font-size: 0.9em;
+  padding: 2px 0;
+}
+
+.tool-call {
+  align-self: flex-start;
+  max-width: 90%;
+  border-left: 3px solid var(--vscode-textLink-foreground);
+  background: var(--vscode-textCodeBlock-background, transparent);
+  padding: 4px 10px;
+  border-radius: 4px;
+  color: var(--vscode-descriptionForeground);
+  font-size: 0.88em;
+  font-family: var(--vscode-editor-font-family, monospace);
 }
 
 .tool-call.completed { border-left-color: var(--vscode-testing-iconPassed, #4caf50); }
 .tool-call.failed { border-left-color: var(--vscode-testing-iconFailed, #f44336); }
 
 #input-row {
   display: flex;
+  align-items: flex-end;
   gap: 6px;
   padding: 8px;
   border-top: 1px solid var(--vscode-panel-border);
+  flex-shrink: 0;
 }
 
 #input-box {
@@ -54,15 +116,23 @@ body {
   background: var(--vscode-input-background);
   color: var(--vscode-input-foreground);
   border: 1px solid var(--vscode-input-border, transparent);
-  padding: 6px;
+  border-radius: 6px;
+  padding: 7px 9px;
   font-family: inherit;
   font-size: inherit;
+  max-height: 200px;
+  overflow-y: auto;
+}
+
+#input-box:focus {
+  outline: 1px solid var(--vscode-focusBorder);
 }
 
 button {
   background: var(--vscode-button-background);
   color: var(--vscode-button-foreground);
   border: none;
+  border-radius: 4px;
   padding: 6px 12px;
   cursor: pointer;
 }
@@ -75,3 +145,15 @@ button:disabled {
   opacity: 0.5;
   cursor: default;
 }
+
+#stop-btn {
+  background: var(--vscode-inputValidation-errorBackground, #a1260d);
+}
+
+#stop-btn:hover {
+  background: var(--vscode-inputValidation-errorBorder, #be1100);
+}
+
+#stop-btn.hidden {
+  display: none;
+}
```

**File**: `editors/vscode/media/main.js` (modified, +68/-21)
```diff
@@ -6,36 +6,68 @@
   const inputEl = document.getElementById('input-box');
   const sendBtn = document.getElementById('send-btn');
   const stopBtn = document.getElementById('stop-btn');
+  const modelPill = document.getElementById('model-pill');
+  const providerPill = document.getElementById('provider-pill');
+  const effortPill = document.getElementById('effort-pill');
 
   let currentAgentBubble = null;
+  const toolCallEls = new Map();
 
-  function appendMessage(text, cls) {
-    const el = document.createElement('div');
-    el.className = 'message ' + cls;
-    el.textContent = text;
-    messagesEl.appendChild(el);
+  function appendRow(text, cls) {
+    const row = document.createElement('div');
+    row.className = 'row ' + cls;
+    const bubble = document.createElement('div');
+    bubble.className = 'bubble ' + cls;
+    bubble.textContent = text;
+    row.appendChild(bubble);
+    messagesEl.appendChild(row);
     messagesEl.scrollTop = messagesEl.scrollHeight;
-    return el;
+    return bubble;
   }
 
-  function appendToolCall(title, status) {
-    const el = document.createElement('div');
+  function statusIcon(status) {
+    if (status === 'completed') return '✓';
+    if (status === 'failed') return '✗';
+    if (status === 'in_progress' || status === 'pending') return '◌';
+    return '•';
+  }
+
+  function upsertToolCall(id, title, status) {
+    let el = id ? toolCallEls.get(id) : null;
+    if (!el) {
+      el = document.createElement('div');
+      el.className = 'tool-call';
+      messagesEl.appendChild(el);
+      if (id) {
+        toolCallEls.set(id, el);
+      }
+    }
     el.className = 'tool-call ' + (status || '');
-    el.textContent = title || '(tool call)';
-    el.dataset.title = title || '';
-    messagesEl.appendChild(el);
+    el.textContent = `${statusIcon(status)} ${title || '(tool call)'}`;
     messagesEl.scrollTop = messagesEl.scrollHeight;
-    return el;
   }
 
+  function setBusy(busy) {
+    sendBtn.disabled = busy;
+    stopBtn.classList.toggle('hidden', !busy);
+  }
+
+  function autoResize() {
+    inputEl.style.height = 'auto';
+    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
+  }
+  inputEl.addEventListener('input', autoResize);
+
   function send() {
     const text = inputEl.value.trim();
     if (!text) {
       return;
     }
-    appendMessage(text, 'user');
+    appendRow(text, 'user');
     inputEl.value = '';
+    autoResize();
     currentAgentBubble = null;
+    setBusy(true);
     vscode.postMessage({ type: 'prompt', text });
   }
 
@@ -47,36 +79,51 @@
       send();
     }
   });
+  modelPill.addEventListener('click', () => vscode.postMessage({ type: 'pickModel' }));
+  providerPill.addEventListener('click', () => vscode.postMessage({ type: 'pickProvider' }));
+  effortPill.addEventListener('click', () => vscode.postMessage({ type: 'pickEffort' }));
+
+  setBusy(false);
 
   window.addEventListener('message', (event) => {
     const msg = event.data;
     switch (msg.type) {
       case 'textChunk': {
-        if (!currentAgentBubble || currentAgentBubble.dataset.isThought !== String(msg.isThought)) {
-          currentAgentBubble = appendMessage('', msg.isThought ? 'thought' : 'agent');
-          currentAgentBubble.dataset.isThought = String(msg.isThought);
+        const cls = msg.isThought ? 'thought' : 'agent';
+        if (!currentAgentBubble || currentAgentBubble.dataset.cls !== cls) {
+          currentAgentBubble = appendRow('', cls);
+          currentAgentBubble.dataset.cls = cls;
         }
         currentAgentBubble.textContent += msg.text;
         messagesEl.scrollTop = messagesEl.scrollHeight;
         break;
       }
-      case 'toolCall': {
+      case 'toolCall':
+      case 'toolCallUpdate': {
         currentAgentBubble = null;
-        appendToolCall(msg.title, msg.status);
+        upsertToolCall(msg.toolCallId, msg.title, msg.status);
         break;
       }
-      case 'toolCallUpdate': {
+      case 'userEcho': {
         currentAgentBubble = null;
-        appendToolCall(msg.title, msg.status);
+        appendRow(msg.text, 'user');
+        setBusy(true);
         break;
       }
       case 'status': {
         currentAgentBubble = null;
-        appendMessage(msg.text, 'thought');
+        appendRow(msg.text, 'system');
+        break;
+      }
+      case 'headerUpdate': {
+        if (msg.model) modelPill.textContent = 'model: ' + msg.model;
+        if (msg.provider) providerPill.textContent = 'provider: ' + msg.provider;
+        if (msg.effort) effortPill.textContent = 'effort: ' + msg.effort;
         break;
       }
       case 'turnEnded': {
         currentAgentBubble = null;
+        setBusy(false);
         break;
       }
       default:
```

---

### Incident Patch 12: `74f1f81d` (2026-07-31)
**Commit Message**: feat(vscode): add launch/build config for F5 debugging

Without .vscode/launch.json the "extensionHost" debug type never
appears in VS Code's debugger picker, so F5 has nothing to run.
Add launch.json (runs an Extension Development Host against this
folder) and tasks.json (npm run compile as the pre-launch build step).

Carve out an exception in the root .gitignore's blanket ".vscode/"
rule for this one nested directory — it's required project config for
authoring the extension, not personal editor state.

**File**: `.gitignore` (modified, +5/-0)
```diff
@@ -23,3 +23,8 @@ refs/
 .vscode/
 .claurst/
 
+# ...except the VS Code extension's own launch/build config, which is
+# required (not personal editor prefs) for F5 debugging to work.
+!editors/vscode/.vscode/
+!editors/vscode/.vscode/*.json
+
```

**File**: `editors/vscode/.vscode/launch.json` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{
+  "version": "0.2.0",
+  "configurations": [
+    {
+      "name": "Run Claurst Extension",
+      "type": "extensionHost",
+      "request": "launch",
+      "runtimeExecutable": "${execPath}",
+      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
+      "outFiles": ["${workspaceFolder}/out/**/*.js"],
+      "preLaunchTask": "npm: compile"
+    }
+  ]
+}
```

**File**: `editors/vscode/.vscode/tasks.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "version": "2.0.0",
+  "tasks": [
+    {
+      "type": "npm",
+      "script": "compile",
+      "group": { "kind": "build", "isDefault": true },
+      "problemMatcher": ["$tsc"]
+    }
+  ]
+}
```

---

### Incident Patch 13: `36efcc79` (2026-07-31)
**Commit Message**: feat(vscode): add chat webview markup styling and message rendering

Vanilla HTML/CSS/JS webview (no framework) rendering streamed agent
text, italicized thinking chunks, and colored tool-call status lines,
themed via VS Code's CSS custom properties so it matches light/dark.

**File**: `editors/vscode/media/main.css` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+body {
+  font-family: var(--vscode-font-family);
+  font-size: var(--vscode-font-size);
+  color: var(--vscode-foreground);
+  padding: 0;
+  margin: 0;
+  display: flex;
+  flex-direction: column;
+  height: 100vh;
+}
+
+#messages {
+  flex: 1;
+  overflow-y: auto;
+  padding: 8px 12px;
+}
+
+.message {
+  white-space: pre-wrap;
+  margin-bottom: 12px;
+  line-height: 1.4;
+}
+
+.message.user {
+  color: var(--vscode-textLink-foreground);
+}
+
+.message.thought {
+  color: var(--vscode-descriptionForeground);
+  font-style: italic;
+}
+
+.tool-call {
+  border-left: 2px solid var(--vscode-textLink-foreground);
+  padding-left: 8px;
+  margin: 6px 0;
+  color: var(--vscode-descriptionForeground);
+  font-size: 0.9em;
+}
+
+.tool-call.completed { border-left-color: var(--vscode-testing-iconPassed, #4caf50); }
+.tool-call.failed { border-left-color: var(--vscode-testing-iconFailed, #f44336); }
+
+#input-row {
+  display: flex;
+  gap: 6px;
+  padding: 8px;
+  border-top: 1px solid var(--vscode-panel-border);
+}
+
+#input-box {
+  flex: 1;
+  resize: none;
+  background: var(--vscode-input-background);
+  color: var(--vscode-input-foreground);
+  border: 1px solid var(--vscode-input-border, transparent);
+  padding: 6px;
+  font-family: inherit;
+  font-size: inherit;
+}
+
+button {
+  background: var(--vscode-button-background);
+  color: var(--vscode-button-foreground);
+  border: none;
+  padding: 6px 12px;
+  cursor: pointer;
+}
+
+button:hover {
+  background: var(--vscode-button-hoverBackground);
+}
+
+button:disabled {
+  opacity: 0.5;
+  cursor: default;
+}
```

**File**: `editors/vscode/media/main.js` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+// Webview-side script. Runs in a restricted context with no Node access;
+// all agent communication goes through the extension host via postMessage.
+(function () {
+  const vscode = acquireVsCodeApi();
+  const messagesEl = document.getElementById('messages');
+  const inputEl = document.getElementById('input-box');
+  const sendBtn = document.getElementById('send-btn');
+  const stopBtn = document.getElementById('stop-btn');
+
+  let currentAgentBubble = null;
+
+  function appendMessage(text, cls) {
+    const el = document.createElement('div');
+    el.className = 'message ' + cls;
+    el.textContent = text;
+    messagesEl.appendChild(el);
+    messagesEl.scrollTop = messagesEl.scrollHeight;
+    return el;
+  }
+
+  function appendToolCall(title, status) {
+    const el = document.createElement('div');
+    el.className = 'tool-call ' + (status || '');
+    el.textContent = title || '(tool call)';
+    el.dataset.title = title || '';
+    messagesEl.appendChild(el);
+    messagesEl.scrollTop = messagesEl.scrollHeight;
+    return el;
+  }
+
+  function send() {
+    const text = inputEl.value.trim();
+    if (!text) {
+      return;
+    }
+    appendMessage(text, 'user');
+    inputEl.value = '';
+    currentAgentBubble = null;
+    vscode.postMessage({ type: 'prompt', text });
+  }
+
+  sendBtn.addEventListener('click', send);
+  stopBtn.addEventListener('click', () => vscode.postMessage({ type: 'stop' }));
+  inputEl.addEventListener('keydown', (e) => {
+    if (e.key === 'Enter' && !e.shiftKey) {
+      e.preventDefault();
+      send();
+    }
+  });
+
+  window.addEventListener('message', (event) => {
+    const msg = event.data;
+    switch (msg.type) {
+      case 'textChunk': {
+        if (!currentAgentBubble || currentAgentBubble.dataset.isThought !== String(msg.isThought)) {
+          currentAgentBubble = appendMessage('', msg.isThought ? 'thought' : 'agent');
+          currentAgentBubble.dataset.isThought = String(msg.isThought);
+        }
+        currentAgentBubble.textContent += msg.text;
+        messagesEl.scrollTop = messagesEl.scrollHeight;
+        break;
+      }
+      case 'toolCall': {
+        currentAgentBubble = null;
+        appendToolCall(msg.title, msg.status);
+        break;
+      }
+      case 'toolCallUpdate': {
+        currentAgentBubble = null;
+        appendToolCall(msg.title, msg.status);
+        break;
+      }
+      case 'status': {
+        currentAgentBubble = null;
+        appendMessage(msg.text, 'thought');
+        break;
+      }
+      case 'turnEnded': {
+        currentAgentBubble = null;
+        break;
+      }
+      default:
+        break;
+    }
+  });
+})();
```

---

### Incident Patch 14: `595b0ebe` (2026-07-31)
**Commit Message**: fix: claurst upgrade fails with Text file busy (ETXTBSY) (#325)

* fix: replace ETXTBSY crash in claurst upgrade with rename-based swap

std::fs::copy() on the unix path of swap_binary() opens the current
executable with O_TRUNC and writes into its existing inode. That
inode is the running process's own mapped text segment, so the
kernel rejects the write with ETXTBSY ("Text file busy") — this is
exactly the failure users hit running `claurst upgrade`.

Stage the downloaded binary next to the current one and swap it in
with rename() instead, which repoints the directory entry to a new
inode without touching the one still mapped and executing. Added a
regression test that spawns a real running binary and swaps it out
from under itself.

* fix(cli): harden Unix upgrade staging

Use exclusive same-directory staging files, persist executable permissions before the atomic rename, and cover the swap with portable native-executable tests.

Fixes #325

---------

Co-authored-by: Kuber Mehta <[REDACTED_EMAIL]>

**File**: `src-rust/crates/cli/src/upgrade.rs` (modified, +255/-10)
```diff
@@ -293,6 +293,68 @@ fn walkdir_shallow(root: &Path, max_depth: usize) -> Vec<PathBuf> {
 // Atomic binary swap
 // ---------------------------------------------------------------------------
 
+#[cfg(unix)]
+struct StagedBinary {
+    path: PathBuf,
+}
+
+#[cfg(unix)]
+impl StagedBinary {
+    fn create_next_to(current: &Path) -> Result<(Self, std::fs::File)> {
+        use std::ffi::OsString;
+        use std::fs::OpenOptions;
+        use std::io::ErrorKind;
+        use std::sync::atomic::{AtomicU64, Ordering};
+
+        static NEXT_STAGE_ID: AtomicU64 = AtomicU64::new(0);
+        const MAX_ATTEMPTS: usize = 128;
+
+        let parent = current
+            .parent()
+            .ok_or_else(|| anyhow!("installed binary path has no parent: {}", current.display()))?;
+        let file_name = current.file_name().ok_or_else(|| {
+            anyhow!(
+                "installed binary path has no file name: {}",
+                current.display()
+            )
+        })?;
+
+        for _ in 0..MAX_ATTEMPTS {
+            let id = NEXT_STAGE_ID.fetch_add(1, Ordering::Relaxed);
+            let mut staged_name = OsString::from(".");
+            staged_name.push(file_name);
+            staged_name.push(format!(".upgrade-{}-{}", std::process::id(), id));
+            let path = parent.join(staged_name);
+
+            match OpenOptions::new().write(true).create_new(true).open(&path) {
+                Ok(file) => return Ok((Self { path }, file)),
+                Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
+                Err(error) => {
+                    return Err(error).with_context(|| {
+                        format!(
+                            "failed to create upgrade staging file next to {}",
+                            current.display()
+                        )
+                    });
+                }
+            }
+        }
+
+        bail!(
+            "failed to create a unique upgrade staging file next to {} after {} attempts",
+            current.display(),
+            MAX_ATTEMPTS
+        )
+    }
+}
+
+#[cfg(unix)]
+impl Drop for StagedBinary {
+    fn drop(&mut self) {
+        let _ = std::fs::remove_file(&self.path);
+    }
+}
+
 fn swap_binary(current: &Path, new: &Path) -> Result<()> {
     #[cfg(target_os = "windows")]
     {
@@ -314,19 +376,49 @@ fn swap_binary(current: &Path, new: &Path) -> Result<()> {
         Ok(())
     }
 
-    #[cfg(not(target_os = "windows"))]
+    #[cfg(unix)]
     {
-        // On unix, std::fs::rename won't work across mounts; copy + chmod is safer.
-        // The kernel will let us replace the file even while it's running because
-        // unlink-and-replace just frees the directory entry.
-        std::fs::copy(new, current)
-            .with_context(|| format!("failed to copy new binary into {}", current.display()))?;
-        let _ = std::process::Command::new("chmod")
-            .arg("755")
-            .arg(current)
-            .status();
+        use std::io::Write;
+        use std::os::unix::fs::PermissionsExt;
+
+        // std::fs::copy() writes into the existing inode (open + O_TRUNC), and
+        // that inode is the running process's own text segment — the kernel
+        // rejects the write with ETXTBSY ("Text file busy"). rename() instead
+        // swaps the directory entry to point at a new inode, which the kernel
+        // allows even while the old inode is still mapped and executing.
+        // rename() requires src/dest on the same filesystem, so stage the
+        // temp file next to `current` rather than relying on the OS tmp dir.
+        let (staged, mut staged_file) = StagedBinary::create_next_to(current)?;
+        let mut source = std::fs::File::open(new)
+            .with_context(|| format!("failed to open new binary at {}", new.display()))?;
+        std::io::copy(&mut source, &mut staged_file)
+            .with_context(|| format!("failed to stage new binary at {}", staged.path.display()))?;
+        staged_file
+            .set_permissions(std::fs::Permissions::from_mode(0o755))
+            .with_context(|| {
+                format!(
+                    "failed to make staged binary executable at {}",
+                    staged.path.display()
+                )
+            })?;
+        staged_file.flush().with_context(|| {
+            format!("failed to flush staged binary at {}", staged.path.display())
+        })?;
+        staged_file.sync_all().with_context(|| {
+            format!("failed to sync staged binary at {}", staged.path.display())
+        })?;
+        drop(staged_file);
+
+        std::fs::rename(&staged.path, current)
+            .with_context(|| format!("failed to swap new binary into {}", current.display()))?;
         Ok(())
     }
+
+    #[cfg(not(any(target_os = "windows", unix)))]
+    {
+        let _ = (current, new);
+        bail!("Unsupported OS for upgrade")
+    }
 }
 
 // ---------------------------------------------------
```

---

### Incident Patch 15: `b34e1172` (2026-07-25)
**Commit Message**: fix(local): discover loaded LM Studio models and usage (#329)

Fixes #326

**File**: `src-rust/crates/api/src/providers/openai_compat.rs` (modified, +170/-7)
```diff
@@ -11,6 +11,7 @@ use async_trait::async_trait;
 use claurst_core::provider_id::{ModelId, ProviderId};
 use claurst_core::types::ContentBlock;
 use futures::Stream;
+use serde::Deserialize;
 use serde_json::{json, Value};
 
 use crate::error_handling::parse_error_response;
@@ -88,6 +89,10 @@ pub struct ProviderQuirks {
     /// root (e.g. `"http://localhost:11434"`) so the native API can be called
     /// independently of the `/v1` base URL used for chat completions.
     pub ollama_native_host: Option<String>,
+
+    /// Native LM Studio host used to discover loaded model instances and their
+    /// configured context lengths from `/api/v1/models`.
+    pub lm_studio_native_host: Option<String>,
 }
 
 // ---------------------------------------------------------------------------
@@ -104,6 +109,37 @@ pub struct OpenAiCompatProvider {
     http_client: reqwest::Client,
 }
 
+#[derive(Debug, Deserialize)]
+struct LmStudioModelsResponse {
+    #[serde(default)]
+    models: Vec<LmStudioModel>,
+}
+
+#[derive(Debug, Deserialize)]
+struct LmStudioModel {
+    #[serde(rename = "type")]
+    model_type: String,
+    key: String,
+    #[serde(default)]
+    display_name: Option<String>,
+    #[serde(default)]
+    loaded_instances: Vec<LmStudioLoadedInstance>,
+    #[serde(default)]
+    max_context_length: Option<u32>,
+}
+
+#[derive(Debug, Deserialize)]
+struct LmStudioLoadedInstance {
+    id: String,
+    config: LmStudioInstanceConfig,
+}
+
+#[derive(Debug, Deserialize)]
+struct LmStudioInstanceConfig {
+    #[serde(default)]
+    context_length: Option<u32>,
+}
+
 impl OpenAiCompatProvider {
     /// Create a new compat provider.  `base_url` should already include any
     /// path prefix (e.g. `"https://api.groq.com/openai/v1"`).
@@ -152,21 +188,24 @@ impl OpenAiCompatProvider {
 
     /// Override the base URL (e.g. from a user-supplied --api-base flag).
     ///
-    /// When the provider uses Ollama's native API host (set by the `ollama()`
-    /// factory), keep it in sync with the new base URL.  Otherwise health
-    /// checks and native model discovery would keep targeting the original
-    /// (localhost) host even though chat completions go to the overridden
-    /// server.
+    /// Keep any native API host in sync with the OpenAI-compatible base URL.
     pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
         self.base_url = base_url.into();
-        if self.quirks.ollama_native_host.is_some() {
+        if self.quirks.ollama_native_host.is_some()
+            || self.quirks.lm_studio_native_host.is_some()
+        {
             let native_host = self
                 .base_url
                 .trim_end_matches('/')
                 .trim_end_matches("/v1")
                 .trim_end_matches('/')
                 .to_string();
-            self.quirks.ollama_native_host = Some(native_host);
+            if self.quirks.ollama_native_host.is_some() {
+                self.quirks.ollama_native_host = Some(native_host.clone());
+            }
+            if self.quirks.lm_studio_native_host.is_some() {
+                self.quirks.lm_studio_native_host = Some(native_host);
+            }
         }
         self
     }
@@ -652,6 +691,56 @@ impl OpenAiCompatProvider {
         Ok(models.into_iter().map(|(info, _, _)| info).collect())
     }
 
+    /// Return loaded LM Studio LLM instances. `None` means the native endpoint
+    /// is unavailable, so the caller should fall back to `/v1/models`.
+    async fn discover_models_lm_studio_native(
+        &self,
+        lm_studio_host: &str,
+    ) -> Option<Vec<ModelInfo>> {
+        let url = format!("{}/api/v1/models", lm_studio_host.trim_end_matches('/'));
+        let builder = self.apply_auth(self.http_client.get(url));
+        let response = self.apply_extra_headers(builder).send().await.ok()?;
+        if !response.status().is_success() {
+            return None;
+        }
+        let response: LmStudioModelsResponse = response.json().await.ok()?;
+        Some(Self::parse_lm_studio_native_models(response, &self.id))
+    }
+
+    fn parse_lm_studio_native_models(
+        response: LmStudioModelsResponse,
+        provider_id: &ProviderId,
+    ) -> Vec<ModelInfo> {
+        let mut discovered = Vec::new();
+        let mut seen = std::collections::HashSet::new();
+        for model in response.models {
+            if model.model_type != "llm" {
+                continue;
+            }
+            let display_name = model.display_name.unwrap_or(model.key);
+            let max_context = model.max_context_length.unwrap_or(128_000);
+
+            for instance in model.loaded_instances {
+                if !seen.insert(instance.id.clone()) {
+                    continue;
+                }
+                let context_window = instance
+                    .config
+                    .context_length
+                    .unwrap_or(max_context);
+                discovered.push(ModelInfo {
+                    id
```

**File**: `src-rust/crates/api/src/providers/openai_compat_providers.rs` (modified, +8/-1)
```diff
@@ -104,11 +104,18 @@ pub fn ollama() -> OpenAiCompatProvider {
 pub fn lm_studio() -> OpenAiCompatProvider {
     let host =
         std::env::var("LM_STUDIO_HOST").unwrap_or_else(|_| "http://localhost:1234".to_string());
-    let base_url = format!("{}/v1", host.trim_end_matches('/'));
+    let native_host = host
+        .trim_end_matches('/')
+        .trim_end_matches("/v1")
+        .trim_end_matches('/')
+        .to_string();
+    let base_url = format!("{}/v1", native_host);
     OpenAiCompatProvider::new(ProviderId::LM_STUDIO, "LM Studio", base_url).with_quirks(
         ProviderQuirks {
             overflow_patterns: vec!["greater than the context length".to_string()],
+            include_usage_in_stream: true,
             no_api_key_required: true,
+            lm_studio_native_host: Some(native_host),
             ..Default::default()
         },
     )
```

**File**: `src-rust/crates/api/src/registry.rs` (modified, +60/-14)
```diff
@@ -35,6 +35,14 @@ fn normalize_openai_base(override_base: &str) -> String {
     }
 }
 
+fn canonical_local_provider_id(provider_id: &str) -> &str {
+    match provider_id {
+        "lmstudio" => ProviderId::LM_STUDIO,
+        "llamacpp" | "llama-server" => ProviderId::LLAMA_CPP,
+        _ => provider_id,
+    }
+}
+
 pub fn resolve_provider_api_base(
     config: &claurst_core::config::Config,
     provider_id: &str,
@@ -313,20 +321,26 @@ impl ProviderRegistry {
     ///
     /// # Panics
     /// Panics if no provider with that ID has been registered.
-    pub fn set_default(&mut self, id: ProviderId) -> &mut Self {
-        assert!(
-            self.providers.contains_key(&id),
-            "set_default: provider '{}' is not registered",
-            id,
-        );
-        self.default_provider_id = id;
-        self
-    }
-
-    /// Get a provider by ID.
-    pub fn get(&self, id: &ProviderId) -> Option<&Arc<dyn LlmProvider>> {
-        self.providers.get(id)
-    }
+    pub fn set_default(&mut self, id: ProviderId) -> &mut Self {
+        let canonical_id = ProviderId::new(canonical_local_provider_id(&id));
+        assert!(
+            self.providers.contains_key(&canonical_id),
+            "set_default: provider '{}' is not registered",
+            id,
+        );
+        self.default_provider_id = canonical_id;
+        self
+    }
+
+    /// Get a provider by ID.
+    pub fn get(&self, id: &ProviderId) -> Option<&Arc<dyn LlmProvider>> {
+        self.providers.get(id).or_else(|| {
+            let canonical_id = canonical_local_provider_id(id);
+            (canonical_id != &**id)
+                .then(|| self.providers.get(&ProviderId::new(canonical_id)))
+                .flatten()
+        })
+    }
 
     /// Get the default provider.
     pub fn default_provider(&self) -> Option<&Arc<dyn LlmProvider>> {
@@ -651,3 +665,35 @@ impl Default for ProviderRegistry {
         Self::new()
     }
 }
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+    use crate::providers;
+
+    #[test]
+    fn local_provider_aliases_resolve_to_canonical_registrations() {
+        let mut registry = ProviderRegistry::new();
+        registry.register(Arc::new(providers::lm_studio()));
+        registry.register(Arc::new(providers::llama_cpp()));
+
+        let lm_studio = registry
+            .get(&ProviderId::new("lmstudio"))
+            .expect("lmstudio alias should resolve");
+        let llama_cpp = registry
+            .get(&ProviderId::new("llamacpp"))
+            .expect("llamacpp alias should resolve");
+
+        assert_eq!(&**lm_studio.id(), ProviderId::LM_STUDIO);
+        assert_eq!(&**llama_cpp.id(), ProviderId::LLAMA_CPP);
+    }
+
+    #[test]
+    fn alias_can_select_canonical_default_provider() {
+        let mut registry = ProviderRegistry::new();
+        registry.register(Arc::new(providers::lm_studio()));
+        registry.set_default(ProviderId::new("lmstudio"));
+
+        assert_eq!(&**registry.default_provider_id(), ProviderId::LM_STUDIO);
+    }
+}
```

**File**: `src-rust/crates/cli/src/main.rs` (modified, +9/-5)
```diff
@@ -3674,15 +3674,19 @@ async fn run_interactive(
                     // no-op and never wipes the projection. For copilot the id
                     // IS the api.id, so this is the by-api.id merge.
                     //
-                    // Anthropic is the exception: its discovery result is the
-                    // subscription/key set already intersected with the catalog,
-                    // so we REPLACE (dropping legacy claude-3.x the credential
-                    // can't serve). An empty result (discovery failed / offline)
-                    // is a no-op that keeps the full catalog projection.
+                    // Anthropic and local runtimes return authoritative lists.
+                    // Anthropic keeps the catalog projection when discovery is
+                    // empty because that can mean authentication failed. Local
+                    // discovery reports failures separately, so empty means no
+                    // models are loaded.
                     if provider == "anthropic" {
                         if !entries.is_empty() {
                             app.model_picker.set_models(entries);
                         }
+                    } else if claurst_tui::model_picker::provider_has_authoritative_live_models(
+                        &provider,
+                    ) {
+                        app.model_picker.set_models(entries);
                     } else {
                         app.model_picker.merge_models(entries);
                     }
```

**File**: `src-rust/crates/query/src/lib.rs` (modified, +55/-4)
```diff
@@ -292,6 +292,17 @@ const MAX_STEPS_DEGRADATION_MSG: &str =
 /// text so the message history stays well-formed.
 const TOOL_CANCELLED_MSG: &str = "Tool execution was cancelled by the user before it completed.";
 
+fn merge_provider_stream_usage(current: &mut UsageInfo, update: &UsageInfo) {
+    if update.total_input() > 0 {
+        current.input_tokens = update.input_tokens;
+        current.cache_read_input_tokens = update.cache_read_input_tokens;
+        current.cache_creation_input_tokens = update.cache_creation_input_tokens;
+    }
+    if update.output_tokens > 0 {
+        current.output_tokens = update.output_tokens;
+    }
+}
+
 // Spinner verbs are imported from claurst_core::spinner
 
 /// Resolve the effective effort level for a turn.
@@ -1051,9 +1062,7 @@ pub async fn run_query_loop(
                                         match &evt {
                                             claurst_api::StreamEvent::MessageStart { id, usage: u, .. } => {
                                                 msg_id = id.clone();
-                                                usage.input_tokens = u.input_tokens;
-                                                usage.cache_read_input_tokens = u.cache_read_input_tokens;
-                                                usage.cache_creation_input_tokens = u.cache_creation_input_tokens;
+                                                merge_provider_stream_usage(&mut usage, u);
                                             }
                                             claurst_api::StreamEvent::ContentBlockStart {
                                                 index,
@@ -1086,7 +1095,7 @@ pub async fn run_query_loop(
                                                     None => "end_turn".to_string(),
                                                 };
                                                 if let Some(u) = u {
-                                                    usage.output_tokens = u.output_tokens;
+                                                    merge_provider_stream_usage(&mut usage, u);
                                                 }
                                             }
                                             claurst_api::StreamEvent::MessageStop => break,
@@ -2071,6 +2080,48 @@ mod tests {
     use super::*;
     use claurst_api::SystemPrompt;
 
+    #[test]
+    fn final_stream_usage_supplies_prompt_tokens_to_turn_usage() {
+        let mut turn_usage = UsageInfo::default();
+        let final_usage = UsageInfo {
+            input_tokens: 1_200,
+            output_tokens: 80,
+            cache_creation_input_tokens: 0,
+            cache_read_input_tokens: 300,
+        };
+
+        merge_provider_stream_usage(&mut turn_usage, &final_usage);
+
+        assert_eq!(turn_usage.input_tokens, 1_200);
+        assert_eq!(turn_usage.cache_read_input_tokens, 300);
+        assert_eq!(turn_usage.output_tokens, 80);
+        let context_counter_increment = turn_usage.input_tokens
+            + turn_usage.output_tokens
+            + turn_usage.cache_creation_input_tokens
+            + turn_usage.cache_read_input_tokens;
+        assert_eq!(context_counter_increment, 1_580);
+    }
+
+    #[test]
+    fn output_only_final_usage_preserves_start_input_tokens() {
+        let mut turn_usage = UsageInfo {
+            input_tokens: 900,
+            output_tokens: 0,
+            cache_creation_input_tokens: 100,
+            cache_read_input_tokens: 0,
+        };
+        let final_usage = UsageInfo {
+            output_tokens: 75,
+            ..Default::default()
+        };
+
+        merge_provider_stream_usage(&mut turn_usage, &final_usage);
+
+        assert_eq!(turn_usage.input_tokens, 900);
+        assert_eq!(turn_usage.cache_creation_input_tokens, 100);
+        assert_eq!(turn_usage.output_tokens, 75);
+    }
+
     fn make_config(sys: Option<&str>, append: Option<&str>) -> QueryConfig {
         QueryConfig {
             model: "claude-sonnet-4-6".to_string(),
```

**File**: `src-rust/crates/tui/src/model_picker.rs` (modified, +36/-5)
```diff
@@ -373,18 +373,30 @@ pub fn default_model_for_provider(
 /// intersects it with the discovered set (see the anthropic branch in the
 /// discovery spawn), falling back to the full projection if discovery fails.
 ///
-/// Live-endpoint providers (Ollama/LM Studio/llama.cpp, Copilot, the
-/// openai-compatible gateways, …) and curated-list providers (Codex, free) are
-/// intentionally excluded: they keep populating the picker from their
-/// `discover_models()` result, which the event loop merges additively onto the
-/// catalog projection.
+/// Live-endpoint and curated-list providers are intentionally excluded. The
+/// event loop either replaces or merges the projection according to
+/// [`provider_has_authoritative_live_models`].
 pub fn provider_uses_catalog_projection(provider_id: &str) -> bool {
     matches!(
         provider_id,
         "openai" | "google" | "azure" | "amazon-bedrock" | "cohere" | "minimax"
     )
 }
 
+/// Whether live discovery is the complete set of models usable through a local
+/// runtime. Catalog rows describe models it could host, not what is loaded.
+pub fn provider_has_authoritative_live_models(provider_id: &str) -> bool {
+    matches!(
+        provider_id,
+        "ollama"
+            | "lmstudio"
+            | "lm-studio"
+            | "llamacpp"
+            | "llama-cpp"
+            | "llama-server"
+    )
+}
+
 /// Whether `provider_id` refers to the OpenAI Codex provider under either of
 /// its two id spellings: the canonical `"codex"` (used by `CodexProvider`,
 /// the model registry, and the runtime dispatch) or the `"openai-codex"`
@@ -1551,4 +1563,23 @@ mod tests {
             );
         }
     }
+
+    #[test]
+    fn local_runtime_models_are_authoritative() {
+        for pid in [
+            "ollama",
+            "lmstudio",
+            "lm-studio",
+            "llamacpp",
+            "llama-cpp",
+            "llama-server",
+        ] {
+            assert!(
+                provider_has_authoritative_live_models(pid),
+                "{pid} must replace catalog rows with its live model list"
+            );
+        }
+        assert!(!provider_has_authoritative_live_models("github-copilot"));
+        assert!(!provider_has_authoritative_live_models("openrouter"));
+    }
 }
```

#### Recent Merged Pull Requests:
- **PR #414** (closed): feat: add Yolo-Auto provider (@harryvgiunta)
- **PR #403** (2026-09-02): refactor(tui): split 7.8k-line app.rs into cohesive app/ modules (@SlugThug)
- **PR #402** (closed): refactor(tui): split 7.8k-line app.rs into cohesive app/ modules (@nhogenson)
- **PR #397** (closed): feat: add todo confidence indicators (@alecuba16)
- **PR #388** (closed): feat: bang batch commands, yolo mode, /poke auto-poke command (@alecuba16)
- **PR #387** (closed): feat(tui): session browser improvements + keyboard text selection and copy (@alecuba16)
- **PR #386** (closed): feat: custom providers and model picker overhaul (@alecuba16)
- **PR #385** (closed): feat: status bar indicators — confidence, TPS, todo, skills/MCP, turns, degradation (@alecuba16)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
