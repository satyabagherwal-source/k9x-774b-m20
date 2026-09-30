# Forensic Learning Record (Deep Inspection): graykode/abtop

> **Canonical Artifact**: `07_PROJECT_LEARNING/graykode-abtop-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/graykode/abtop](https://github.com/graykode/abtop))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:04.243Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `graykode/abtop`
- **Description**: Like htop, but for AI coding agents. Monitor Claude    Code & Codex CLI sessions, tokens, context window,    rate limits, and ports in real-time.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3685 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/app.rs`
```
use crate::collector::{read_rate_limits, McpServer, MultiCollector};
use crate::host_info::{AgentAggregate, HostMetrics, HostSampler};
use crate::model::{AgentSession, OrphanPort, RateLimitInfo, SessionStatus};
use crate::theme::Theme;
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Instant;

/// Maximum data points kept for the live token-rate graph.
const GRAPH_HISTORY_LEN: usize = 200;
/// Max concurrent summary jobs.
const MAX_SUMMARY_JOBS: usize = 3;
/// Max summary attempts per session before giving up.
const MAX_SUMMARY_RETRIES: u32 = 2;

/// Produce a terminal-safe fallback summary from a raw prompt.
fn sanitize_fallback(prompt: &str, max_len: usize) -> String {
    prompt
        .chars()
        .filter(|c| !c.is_control() || *c == ' ')
        .take(max_len)
        .collect()
}

/// Outcome of an Enter-key jump attempt. Distinct from `Option<String>` so
/// callers (notably `--exit-on-jump`) can tell a real terminal jump apart from
/// a no-op (unsupported terminal, or empty session list).
#[derive(Debug, PartialEq, Eq)]
pub enum JumpOutcome {
    /// Actually switched to a terminal pane/tab/window.
    Jumped,
    /// Tried to jump through an applicable backend, but the focus command failed.
    Failed(String),
    /// Unsupported terminal, or nothing selected — nothing happened.
    NoOp,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NarrowTab {
    Work,
    Usage,
    System,
}

impl NarrowTab {
    pub const ALL: [Self; 3] = [Self::Work, Self::Usage, Self::System];

    pub fn label(self) -> &'static str {
        match self {
            Self::Work => "Work",
            Self::Usage => "Usage",
            Self::System => "System",
        }
    }

    pub fn shortcut(self) -> char {
        match self {
            Self::Work => 'w',
            Self::Usage => 'u',
            Self::System => 's',
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NarrowSection {
    Sessions,
    Projects,
    Context,
    Quota,
    Tokens,
    Ports,
    Mcp,
}

impl NarrowSection {
    pub fn tab(self) -> NarrowTab {
        match self {
            Self::Sessions | Self::Projects => NarrowTab::Work,
            Self::Context | Self::Quota | Self::Tokens => NarrowTab::Usage,
            Self::Ports | Self::Mcp => NarrowTab::System,
        }
    }
}

pub struct App {
    pub sessions: Vec<AgentSession>,
    pub selected: usize,
    pub should_quit: bool,
    /// Token rate per tick (delta). Ring buffer for the braille graph.
    pub token_rates: VecDeque<f64>,
    /// Account-level rate limits (Claude, Codex, etc.)
    pub rate_limits: Vec<RateLimitInfo>,
    /// Per-session previous token totals, keyed by (agent_cli, session_id).
    prev_tokens: HashMap<(String, String), u64>,
    /// Rate limit poll counter (read every 5 ticks = 10s)
    rate_limit_counter: u32,
    collector: MultiCollector,
    /// Cached LLM-generated summaries, keyed by session_id.
    pub summaries: HashMap<String, String>,
    /// Session IDs currently being summarized.
    pending_summaries: HashSet<String>,
    /// Per-session retry count for failed summary attempts.
    summary_retries: HashMap<String, u32>,
    /// Channel to receive completed summaries from background threads.
    /// Tuple: (session_id, prompt, maybe_summary).
    summary_rx: mpsc::Receiver<(String, String, Option<String>)>,
    summary_tx: mpsc::Sender<(String, String, Option<String>)>,
    /// Ports left open by processes whose parent sessions have ended.
    pub orphan_ports: Vec<OrphanPort>,
    /// Transient status message shown in the footer (auto-clears after 3s).
    pub status_msg: Option<(String, Instant)>,
    /// Kill confirmation: (selected_index, timestamp). Expires after 2s.
    kill_confirm: Option<(usize, Instant)>,
    pub theme: Theme,
    pub show_context: bool,
    pub show_quota: bool,
    pub show_tokens: bool,
    pub show_projects: bool,
    pub show_ports: bool,
    pub show_sessions: bool,
    pub show_mcp: bool,
    pub narrow_tab: NarrowTab,
    pub active_narrow_section: Option<NarrowSection>,
    pub maximized_narrow_section: Option<NarrowSection>,
    /// MCP servers detected on the most recent tick (sourced from
    /// MultiCollector). Populated regardless of `show_mcp` so panel
    /// toggling doesn't cost a discovery roundtrip.
    pub mcp_servers: Vec<McpServer>,
    /// When true (default), mcp-server-owned rollouts are hidden from
    /// the sessions panel. Toggle with Shift+M.
    pub mcp_suppress_sessions: bool,
    pub config_open: bool,
    pub config_selected: usize,
    pub tree_view: bool,
    pub filter_text: String,
    pub filter_active: bool,
    pub show_timeline: bool,
    pub timeline_scroll: usize,
    pub show_file_audit: bool,
    /// Host vitals sampler (CPU% delta needs prior snapshot).
    host_sampler: HostSampler,
    /// Latest host metrics snapshot (None until first valid sample).
    pub host_metrics: Option<HostMetrics>,
    /// Aggregate metrics across all sessions (recomputed each tick).
    pub agent_aggregate: AgentAggregate,
    /// Help overlay (`?`) visibility.
    pub help_open: bool,
    /// View leader overlay (`v`) visibility.
    pub view_open: bool,
}

impl App {
    #[cfg(test)]
    pub fn new_with_config(
        theme: Theme,
        hidden_agents: &[String],
        panels: crate::config::PanelVisibility,
    ) -> Self {
        Self::new_with_config_and_claude_dirs(theme, hidden_agents, panels, &[])
    }

    pub fn new_with_config_and_claude_dirs(
        theme: Theme,
        hidden_agents: &[String],
        panels: crate::config::PanelVisibility,
        claude_config_dirs: &[PathBuf],
    ) -> Self {
        let (tx, rx) = mpsc::channel();
        let summaries = load_summary_cache();
        let mut collector =
            MultiCollector::with_hidden_and_claude_config_dirs(hidden_agents, claude_config_dirs);
        collector.set_mcp_suppress(true);
        Self {
            sessions: Vec::new(),
            selected: 0,
            should_quit: false,
            token_rates: VecDeque::with_capacity(GRAPH_HISTORY_LEN),
            rate_limits: Vec::new(),
            prev_tokens: HashMap::new(),
            rate_limit_counter: 5,
            collector,
            summaries,
            pending_summaries: HashSet::new(),
            summary_retries: HashMap::new(),
            summary_rx: rx,
            summary_tx: tx,
            orphan_ports: Vec::new(),
            status_msg: None,
            kill_confirm: None,
            theme,
            show_context: panels.context,
            show_quota: panels.quota,
            show_tokens: panels.tokens,
            show_projects: panels.projects,
            show_ports: panels.ports,
            show_sessions: panels.sessions,
            show_mcp: panels.mcp,
            narrow_tab: NarrowTab::Work,
            active_narrow_section: Some(NarrowSection::Sessions),
            maximized_narrow_section: None,
            mcp_servers: Vec::new(),
            mcp_suppress_sessions: true,
            config_open: false,
            config_selected: 0,
            tree_view: false,
            filter_text: String::new(),
            filter_active: false,
            show_timeline: false,
            timeline_scroll: 0,
            show_file_audit: false,
            host_sampler: HostSampler::new(),
            host_metrics: None,
            agent_aggregate: AgentAggregate::default(),
            help_open: false,
            view_open: false,
        }
    }

    pub fn toggle_help(&mut self) {
        self.help_open = !self.help_open;
        if self.help_open {
            self.view_open = false;
        }
    }

    pub fn toggle_view_menu(&mut self) {
        self.view_open = !self.view_open;
        if self.view_open {
            self.help_open = false;
        }
    }

    pub fn toggle_panel(&mut self, panel: u8) {
        match panel {
            1 
```

### Core Architecture Module: `src/collector/claude.rs`
```
use super::process::{self, ProcInfo};
use crate::model::{
    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, LaunchSurface,
    SessionFile, SessionStatus, SubAgent, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
#[cfg(all(
    not(target_os = "linux"),
    not(target_vendor = "apple"),
    not(target_os = "windows")
))]
use std::process::Command;

/// A single Claude config directory (sessions + projects + transcripts).
#[derive(Debug, Clone, Eq, PartialEq, Ord, PartialOrd)]
struct ConfigDir {
    sessions_dir: PathBuf,
    projects_dir: PathBuf,
}

impl ConfigDir {
    fn new(base: PathBuf) -> Self {
        Self {
            sessions_dir: base.join("sessions"),
            projects_dir: base.join("projects"),
        }
    }

    fn base_dir(&self) -> PathBuf {
        self.sessions_dir
            .parent()
            .unwrap_or(Path::new("."))
            .to_path_buf()
    }
}

#[derive(Debug, Default)]
struct ProcessOpenPaths {
    cwd: Option<PathBuf>,
    paths: Vec<PathBuf>,
}

pub struct ClaudeCollector {
    /// All known config directories to scan for sessions.
    config_dirs: Vec<ConfigDir>,
    /// User-configured Claude config directories from abtop config.
    configured_config_dirs: Vec<PathBuf>,
    /// Cached transcript parse results keyed by session_id.
    /// On each tick, only new bytes since `new_offset` are parsed.
    transcript_cache: HashMap<String, TranscriptResult>,
}

impl ClaudeCollector {
    #[cfg(test)]
    pub fn new() -> Self {
        Self::with_configured_dirs(Vec::new())
    }

    pub fn with_configured_dirs(configured_config_dirs: Vec<PathBuf>) -> Self {
        Self {
            config_dirs: Vec::new(),
            configured_config_dirs,
            transcript_cache: HashMap::new(),
        }
    }

    /// Discover unique Claude config directories from defaults, configured
    /// profile roots, home sibling profiles, and process environment/open-file
    /// signals when the platform exposes them.
    fn refresh_config_dirs(&mut self, process_info: &HashMap<u32, process::ProcInfo>) {
        // BTreeSet for deterministic iteration order across runs.
        let mut seen = std::collections::BTreeSet::new();

        // Always include the default directory
        let default = dirs::home_dir().unwrap_or_default().join(".claude");
        seen.insert(default);

        if let Some(home) = dirs::home_dir() {
            seen.extend(discover_home_claude_config_dirs(&home));
        }

        for dir in &self.configured_config_dirs {
            if is_claude_config_root(dir) {
                seen.insert(dir.clone());
            }
        }

        // Include CLAUDE_CONFIG_DIR from abtop's own environment
        if let Ok(dir) = std::env::var("CLAUDE_CONFIG_DIR") {
            let p = PathBuf::from(dir);
            if p.is_dir() {
                seen.insert(p);
            }
        }

        // Discover from running Claude processes via /proc/<pid>/environ
        for (pid, info) in process_info {
            if !process::cmd_has_binary(&info.command, "claude") {
                continue;
            }
            if let Some(dir) = read_env_var_from_proc(*pid, "CLAUDE_CONFIG_DIR") {
                let p = PathBuf::from(dir);
                if p.is_dir() {
                    seen.insert(p);
                }
            }
        }

        self.config_dirs = seen.into_iter().map(ConfigDir::new).collect();
    }

    fn collect_sessions(&mut self, shared: &super::SharedProcessData) -> Vec<AgentSession> {
        // Refresh config dirs on slow ticks only (every ~10s) or on first run.
        // Scanning /proc/<pid>/environ for every Claude process is expensive
        // to do every 2s; config dirs change rarely.
        if shared.slow_tick || self.config_dirs.is_empty() {
            self.refresh_config_dirs(&shared.process_info);
        }

        let self_pid = std::process::id();
        let active_session_paths =
            self.discover_active_session_paths(&shared.process_info, self_pid);
        let active_config_dirs: Vec<ConfigDir> = active_session_paths
            .iter()
            .map(|(_, config)| config.clone())
            .collect();
        self.merge_config_dirs(active_config_dirs);

        // Collect all session file paths first to avoid borrowing self
        // immutably (config_dirs) and mutably (load_session) at the same time.
        let mut session_paths: Vec<(PathBuf, ConfigDir)> = Vec::new();
        session_paths.extend(active_session_paths);

        for config in &self.config_dirs {
            let session_files = match fs::read_dir(&config.sessions_dir) {
                Ok(entries) => entries,
                Err(_) => continue,
            };

            for entry in session_files.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                session_paths.push((path, config.clone()));
            }
        }

        let discovery_ctx = build_discovery_context(&session_paths, &shared.process_info, self_pid);

        let mut sessions = self.load_session_paths(
            &session_paths,
            &shared.process_info,
            &shared.children_map,
            &shared.ports,
            &discovery_ctx,
        );

        self.evict_stale_cache(&sessions);

        sessions.sort_by_key(|s| std::cmp::Reverse(s.started_at));
        sessions
    }

    /// Drop `transcript_cache` entries for session_ids that are no longer
    /// in the active set. After `/clear`, the old sid leaves the active
    /// set and its cache entry (with stale token counters) is removed on
    /// the very next tick — without this, counters would persist forever.
    fn evict_stale_cache(&mut self, sessions: &[AgentSession]) {
        let active_ids: std::collections::HashSet<&str> =
            sessions.iter().map(|s| s.session_id.as_str()).collect();
        self.transcript_cache
            .retain(|sid, _| active_ids.contains(sid.as_str()));
    }

    fn load_session_paths(
        &mut self,
        session_paths: &[(PathBuf, ConfigDir)],
        process_info: &HashMap<u32, ProcInfo>,
        children_map: &HashMap<u32, Vec<u32>>,
        ports: &HashMap<u32, Vec<u16>>,
        ctx: &DiscoveryContext,
    ) -> Vec<AgentSession> {
        let mut sessions = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();
        for (path, config) in session_paths {
            if let Some(session) =
                self.load_session(path, config, process_info, children_map, ports, ctx)
            {
                if seen_ids.insert(session.session_id.clone()) {
                    sessions.push(session);
                }
            }
        }
        sessions
    }

    fn merge_config_dirs(&mut self, dirs: Vec<ConfigDir>) {
        let mut seen: std::collections::BTreeSet<ConfigDir> =
            self.config_dirs.iter().cloned().collect();
        seen.extend(dirs);
        self.config_dirs = seen.into_iter().collect();
    }

    fn discover_active_session_paths(
        &self,
        process_info: &HashMap<u32, process::ProcInfo>,
        self_pid: u32,
    ) -> Vec<(PathBuf, ConfigDir)> {
        let pids = Self::find_claude_pids(process_info, self_pid);
        if pids.is_empty() {
            return Vec::new();
        }

        let open_paths = Self::map_pid_to_open_paths(&pids);
        Self::session_paths_from_open_paths(&pids, &open_paths)
    }

    fn session_paths_from_open_paths(
        pids: &[u32],
        open_paths: &HashMap<u32, ProcessOpenPaths>,
    ) -> Vec<(PathBuf, ConfigDir)> {
        let mut paths = Vec::new();
        let mut seen = std::collections::BTreeSet::new();

     
```

### Core Architecture Module: `src/collector/codex.rs`
```
use super::process::{self, ProcInfo};
use crate::model::{
    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, LaunchSurface,
    RateLimitInfo, SessionStatus, ToolCall, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
#[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
use std::process::Command;
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::{Duration, Instant};

/// Collector for OpenAI Codex CLI sessions.
///
/// Discovery strategy (no PID session file like Claude):
/// 1. `ps` to find running codex processes
/// 2. `lsof` to map PID → open rollout-*.jsonl file
/// 3. Parse JSONL for session metadata, tokens, tool usage
///
/// JSONL event types:
/// - `session_meta`: session ID, cwd, cli_version, model_provider, git info
/// - `event_msg` subtypes: task_started, user_message, token_count, agent_message, task_complete
/// - `response_item`: assistant messages (commentary/final), function_call, function_call_output
/// - `turn_context`: model, cwd, effort, context window size
pub struct CodexCollector {
    sessions_dir: PathBuf,
    /// Latest rate limit info parsed from Codex JSONL token_count events.
    pub last_rate_limit: Option<RateLimitInfo>,
    desktop_recent_scanner: DesktopRecentRolloutScanner,
}

#[derive(Clone, Copy)]
struct CodexProcessContext {
    pid: Option<u32>,
    is_exec: bool,
    owns_process_tree: bool,
    unknown_process_owner: bool,
}

struct DesktopRecentRolloutScanResult {
    rollouts: Vec<PathBuf>,
}

struct DesktopRecentRolloutScanner {
    cached: Vec<PathBuf>,
    in_flight: bool,
    last_started: Option<Instant>,
    tx: Sender<DesktopRecentRolloutScanResult>,
    rx: Receiver<DesktopRecentRolloutScanResult>,
}

const DESKTOP_RECENT_ROLLOUT_RESCAN_INTERVAL: Duration = Duration::from_secs(60);

impl DesktopRecentRolloutScanner {
    fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        Self {
            cached: Vec::new(),
            in_flight: false,
            last_started: None,
            tx,
            rx,
        }
    }

    fn update(&mut self, sessions_dir: &Path, active_mtime_secs: u64) -> Vec<PathBuf> {
        self.poll_completed();
        if self.should_start(sessions_dir) {
            self.start(sessions_dir.to_path_buf(), active_mtime_secs);
        }
        self.cached.clone()
    }

    fn poll_completed(&mut self) {
        while let Ok(result) = self.rx.try_recv() {
            self.cached = result.rollouts;
            self.in_flight = false;
        }
    }

    fn should_start(&self, sessions_dir: &Path) -> bool {
        if self.in_flight || !sessions_dir.exists() {
            return false;
        }
        self.last_started
            .is_none_or(|started| started.elapsed() >= DESKTOP_RECENT_ROLLOUT_RESCAN_INTERVAL)
    }

    fn start(&mut self, sessions_dir: PathBuf, active_mtime_secs: u64) {
        self.in_flight = true;
        self.last_started = Some(Instant::now());
        let tx = self.tx.clone();
        std::thread::spawn(move || {
            let rollouts = CodexCollector::recent_desktop_rollouts(
                &sessions_dir,
                &HashSet::new(),
                &HashSet::new(),
                active_mtime_secs,
            );
            let _ = tx.send(DesktopRecentRolloutScanResult { rollouts });
        });
    }
}

impl CodexCollector {
    pub fn new() -> Self {
        let home = dirs::home_dir().unwrap_or_default();
        Self {
            sessions_dir: home.join(".codex").join("sessions"),
            last_rate_limit: None,
            desktop_recent_scanner: DesktopRecentRolloutScanner::new(),
        }
    }

    fn collect_sessions(&mut self, shared: &super::SharedProcessData) -> Vec<AgentSession> {
        if !self.sessions_dir.exists() {
            self.last_rate_limit = None;
            return vec![];
        }

        // Reset live rate limit each pass — only keep it if a current session provides one
        self.last_rate_limit = None;

        // Step 1: Find running codex processes from shared ps data (no extra ps call).
        // When MCP suppression is on, exclude `codex mcp-server` PIDs — those
        // are surfaced through the MCP servers panel instead. See issue #95.
        let codex_pids =
            Self::find_codex_pids_from_shared(&shared.process_info, &shared.mcp_server_pids);
        let just_pids: Vec<u32> = codex_pids.iter().map(|(p, _)| *p).collect();
        let pid_to_jsonl = Self::map_pid_to_jsonl(&just_pids, &self.sessions_dir);
        let pid_is_exec: HashMap<u32, bool> = codex_pids.into_iter().collect();

        let mut sessions = Vec::new();
        let mut seen_jsonl = std::collections::HashSet::new();

        // Active sessions: running codex processes with open JSONL files
        for (pid, jsonl_path) in &pid_to_jsonl {
            let is_exec = pid_is_exec.get(pid).copied().unwrap_or(false);
            if let Some((session, rl)) = self.load_session_with_rate_limit(
                CodexProcessContext {
                    pid: Some(*pid),
                    is_exec,
                    owns_process_tree: true,
                    unknown_process_owner: false,
                },
                jsonl_path,
                &shared.process_info,
                &shared.children_map,
                &shared.ports,
            ) {
                seen_jsonl.insert(jsonl_path.clone());
                if let Some(new_rl) = rl {
                    let newer = self
                        .last_rate_limit
                        .as_ref()
                        .is_none_or(|old| new_rl.updated_at > old.updated_at);
                    if newer {
                        super::rate_limit::write_codex_cache(&new_rl);
                        self.last_rate_limit = Some(new_rl);
                    }
                }
                sessions.push(session);
            }
        }

        let desktop_pids = Self::find_codex_desktop_pids_from_shared(
            &shared.process_info,
            &shared.mcp_server_pids,
        );
        if !desktop_pids.is_empty() {
            let desktop_pid_to_rollouts: HashMap<u32, Vec<PathBuf>> = desktop_pids
                .iter()
                .filter_map(|pid| {
                    shared
                        .desktop_rollout_fd_map
                        .get(pid)
                        .map(|paths| (*pid, paths.clone()))
                })
                .collect();

            // Prefer the filesystem view so Desktop sessions appear immediately,
            // then use the async fd cache only to improve PID ownership.
            let desktop_pid_for_path = Self::desktop_pid_by_rollout_path(
                &desktop_pid_to_rollouts,
                super::mcp::ACTIVE_MTIME_SECS,
            );
            let mut desktop_rollout_paths = Self::foreground_desktop_rollouts(
                &self.sessions_dir,
                &seen_jsonl,
                &shared.mcp_owned_rollouts,
                super::mcp::ACTIVE_MTIME_SECS,
            );
            for path in self
                .desktop_recent_scanner
                .update(&self.sessions_dir, super::mcp::ACTIVE_MTIME_SECS)
            {
                if seen_jsonl.contains(&path) || shared.mcp_owned_rollouts.contains(&path) {
                    continue;
                }
                if !desktop_rollout_paths.contains(&path) {
                    desktop_rollout_paths.push(path);
                }
            }
            Self::sort_rollouts_by_mtime_desc(&mut desktop_rollout_paths);

            for path in desktop_rollout_paths {
                let pid = desktop_pid_for_path.get(&path).copied();
                let process_ctx = CodexProcessContext {
                    pid,
                    is_exec: false,
                    owns_process_tree: false,
                 
```

### Core Architecture Module: `src/collector/mcp.rs`
```
use super::process::{self, ProcInfo};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
#[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
use std::process::{Command, Stdio};
#[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
use std::time::Instant;
use std::time::{Duration, SystemTime};

/// Active-thread mtime threshold: a rollout written within the last 30 minutes
/// ACTIVE_MTIME_SECS counts as "active". File-descriptor presence alone
/// would overcount — `codex mcp-server` keeps fds open for hours after
/// a thread last wrote (so it can resume on demand), so we need a
/// freshness signal in addition to fd presence.
pub const ACTIVE_MTIME_SECS: u64 = 30 * 60;

/// One open `rollout-*.jsonl` fd held by an mcp-server process.
#[derive(Clone, Debug)]
pub struct McpRollout {
    pub path: PathBuf,
    pub mtime: Option<SystemTime>,
    /// Carried for debug / future panel use; not currently rendered.
    #[allow(dead_code)]
    pub size_bytes: u64,
}

impl McpRollout {
    pub fn is_active(&self, now: SystemTime, threshold_secs: u64) -> bool {
        match self.mtime {
            Some(m) => now
                .duration_since(m)
                .map(|d| d.as_secs() < threshold_secs)
                .unwrap_or(false),
            None => false,
        }
    }
}

/// One running MCP server process. Currently only `codex mcp-server`;
/// other MCP server flavors can be added by extending the detection in
/// `is_codex_mcp_server`.
#[derive(Clone, Debug)]
pub struct McpServer {
    pub pid: u32,
    /// Parent process PID — kept for debug; not currently rendered.
    #[allow(dead_code)]
    pub ppid: u32,
    /// Resolved CLI of the parent process: "claude", "codex", or "?".
    pub parent_cli: &'static str,
    /// Full ps command — kept for debug; not currently rendered.
    #[allow(dead_code)]
    pub command: String,
    /// Value of `-c profile=<name>` if present (e.g. "qwen36-litellm").
    /// `None` for the default profile.
    pub profile: Option<String>,
    /// RSS in KB — kept for debug; not currently rendered.
    #[allow(dead_code)]
    pub mem_kb: u64,
    pub rollouts: Vec<McpRollout>,
}

impl McpServer {
    pub fn active_count(&self, now: SystemTime, threshold_secs: u64) -> usize {
        self.rollouts
            .iter()
            .filter(|r| r.is_active(now, threshold_secs))
            .count()
    }

    pub fn latest_mtime(&self) -> Option<SystemTime> {
        self.rollouts.iter().filter_map(|r| r.mtime).max()
    }
}

/// Result of one detection pass — kept as a struct so callers can mutate
/// a `SharedProcessData` with a single method.
pub struct McpDetection {
    pub servers: Vec<McpServer>,
    /// PIDs of detected mcp-server processes. CodexCollector excludes
    /// these so the same rollout isn't double-counted in the sessions
    /// panel.
    pub server_pids: HashSet<u32>,
    /// Rollout file paths currently held open by an mcp-server process.
    /// CodexCollector's "recently finished" pass skips these to avoid
    /// the PID=0 "ghost Done" rows.
    pub owned_rollouts: HashSet<PathBuf>,
}

impl McpDetection {
    pub fn empty() -> Self {
        Self {
            servers: Vec::new(),
            server_pids: HashSet::new(),
            owned_rollouts: HashSet::new(),
        }
    }
}

/// Detect codex mcp-server processes from the shared `ps` snapshot,
/// then map each PID to its full set of open rollout fds.
pub fn detect(process_info: &HashMap<u32, ProcInfo>) -> McpDetection {
    let server_candidates: Vec<&ProcInfo> = process_info
        .values()
        .filter(|info| is_codex_mcp_server(&info.command))
        .collect();

    if server_candidates.is_empty() {
        return McpDetection::empty();
    }

    let pids: Vec<u32> = server_candidates.iter().map(|p| p.pid).collect();
    let pid_to_rollouts = map_pid_to_rollouts(&pids);

    let mut servers = Vec::with_capacity(server_candidates.len());
    let mut owned_rollouts: HashSet<PathBuf> = HashSet::new();
    let mut server_pids: HashSet<u32> = HashSet::new();

    for info in server_candidates {
        let parent_cli = resolve_parent_cli(info.ppid, process_info);
        let profile = parse_profile_flag(&info.command);
        let mut rollouts: Vec<McpRollout> = pid_to_rollouts
            .get(&info.pid)
            .map(|paths| paths.iter().map(rollout_for_path).collect())
            .unwrap_or_default();
        rollouts.sort_by_key(|r| std::cmp::Reverse(r.mtime));

        for r in &rollouts {
            owned_rollouts.insert(r.path.clone());
        }
        server_pids.insert(info.pid);

        servers.push(McpServer {
            pid: info.pid,
            ppid: info.ppid,
            parent_cli,
            command: info.command.clone(),
            profile,
            mem_kb: info.rss_kb,
            rollouts,
        });
    }

    servers.sort_by_key(|s| (s.parent_cli, s.pid));

    McpDetection {
        servers,
        server_pids,
        owned_rollouts,
    }
}

/// True when `cmd` is a `codex mcp-server [...]` invocation.
fn is_codex_mcp_server(cmd: &str) -> bool {
    process::cmd_has_binary(cmd, "codex")
        && cmd.contains("mcp-server")
        && !cmd.contains("grep")
        && !cmd.contains("app-server")
}

/// Pick the parent CLI name from the parent's command line, returning
/// the static label used by the sessions panel.
fn resolve_parent_cli(ppid: u32, process_info: &HashMap<u32, ProcInfo>) -> &'static str {
    let Some(parent) = process_info.get(&ppid) else {
        return "?";
    };
    let cmd = &parent.command;
    if process::cmd_has_binary(cmd, "claude") {
        "claude"
    } else if process::cmd_has_binary(cmd, "codex") {
        "codex"
    } else {
        "?"
    }
}

/// Extract `-c profile=<name>` if present. Codex accepts either
/// `-c profile=NAME` (one arg) or `-c` `profile=NAME` (two args). The
/// substring match handles both since both produce contiguous bytes
/// in `ps`-style output.
fn parse_profile_flag(cmd: &str) -> Option<String> {
    let needle = "profile=";
    let pos = cmd.find(needle)?;
    let tail = &cmd[pos + needle.len()..];
    let end = tail.find(|c: char| c.is_whitespace()).unwrap_or(tail.len());
    let value = tail[..end].trim_matches(|c: char| c == '"' || c == '\'');
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn rollout_for_path(path: &PathBuf) -> McpRollout {
    let (mtime, size_bytes) = match std::fs::metadata(path) {
        Ok(meta) => (meta.modified().ok(), meta.len()),
        Err(_) => (None, 0),
    };
    McpRollout {
        path: path.clone(),
        mtime,
        size_bytes,
    }
}

/// Map mcp-server PIDs to all their open `rollout-*.jsonl` paths.
/// Returns one Vec per PID — preserves the multi-rollout fact rather
/// than the single-PathBuf overwrite the existing CodexCollector path
/// uses (that is intentional in CodexCollector — see issue notes —
/// since fixing it without this MCP panel would flood the sessions
/// panel with phantom rows).
pub(crate) fn map_pid_to_rollouts(pids: &[u32]) -> HashMap<u32, Vec<PathBuf>> {
    let mut map: HashMap<u32, Vec<PathBuf>> = HashMap::new();
    if pids.is_empty() {
        return map;
    }

    #[cfg(target_os = "linux")]
    {
        for &pid in pids {
            for target in process::scan_proc_fds(pid) {
                if is_rollout_path(&target) {
                    map.entry(pid).or_default().push(target);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut sys = sysinfo::System::new();
        let pids_sys: Vec<sysinfo::Pid> = pids
            .iter()
            .copied()
            .map(|p| sysinfo::Pid::from(p as usize))
            .collect();
        sys.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::Some(&pids_sys),
            true,
            sysinfo::ProcessRefreshKind::new().with_memory(),
 
```

### Core Architecture Module: `src/collector/mod.rs`
```
pub mod claude;
pub mod codex;
pub mod mcp;
pub mod opencode;
pub mod process;
pub mod rate_limit;

pub use claude::ClaudeCollector;
pub use codex::CodexCollector;
pub use mcp::McpServer;
pub use opencode::OpenCodeCollector;
pub use rate_limit::read_rate_limits;

/// Abbreviate a filesystem path by replacing the home directory prefix with `~`.
pub(crate) fn abbrev_path(path: &std::path::Path) -> String {
    if let Some(home) = dirs::home_dir() {
        if let Ok(rel) = path.strip_prefix(&home) {
            return format!("~/{}", rel.display());
        }
    }
    path.to_string_lossy().into_owned()
}

/// Redact common secret patterns to avoid displaying credentials in the TUI.
/// Replaces the prefix and all following non-whitespace chars with [REDACTED].
/// Best-effort: covers well-known prefixed tokens, not arbitrary high-entropy strings.
pub(crate) fn redact_secrets(s: &str) -> String {
    const PATTERNS: &[&str] = &[
        // Anthropic / OpenAI / OpenRouter
        "sk-ant-",
        "sk-proj-",
        "sk-or-",
        // Stripe
        "sk_live_",
        "sk_test_",
        "rk_live_",
        "rk_test_",
        // GitHub
        "ghp_",
        "gho_",
        "ghs_",
        "ghr_",
        "ghu_",
        "github_pat_",
        // GitLab
        "glpat-",
        // Slack
        "xoxb-",
        "xoxp-",
        "xoxa-",
        "xoxs-",
        // AWS access key id
        "AKIA",
        "ASIA",
        // Bearer-prefixed headers
        "Bearer ",
    ];
    let mut result = s.to_string();
    for pat in PATTERNS {
        while let Some(pos) = result.find(pat) {
            let end = result[pos..]
                .find(char::is_whitespace)
                .map(|i| pos + i)
                .unwrap_or(result.len());
            result.replace_range(pos..end, "[REDACTED]");
        }
    }
    result
}

/// Strip control characters and Unicode bidi override/isolate marks before
/// transcript text is stored for terminal rendering.
pub(crate) fn sanitize_terminal_text(s: &str) -> String {
    s.chars()
        .filter(|c| {
            !c.is_control()
                && !matches!(
                    *c,
                    '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}' | '\u{200E}' | '\u{200F}'
                )
        })
        .collect()
}

use crate::model::{AgentSession, OrphanPort, RateLimitInfo, SessionStatus};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicU32, Ordering},
    mpsc::{self, Receiver, Sender},
    Arc,
};
use std::time::{Duration, Instant};

/// Trait for agent-specific session collectors.
/// Implement this to add support for a new AI coding agent.
pub trait AgentCollector {
    /// Return all live sessions for this agent type.
    fn collect(&mut self, shared: &SharedProcessData) -> Vec<AgentSession>;

    /// Return agent-specific rate limit info, if available from session data.
    fn live_rate_limit(&self) -> Option<RateLimitInfo> {
        None
    }

    /// Return config directories discovered from running agent processes.
    /// Used to feed rate limit lookups across all active config dirs.
    fn discovered_config_dirs(&self) -> Vec<std::path::PathBuf> {
        Vec::new()
    }
}

/// Process data fetched once per tick and shared across all collectors.
/// Avoids duplicate ps/lsof calls.
pub struct SharedProcessData {
    pub process_info: HashMap<u32, process::ProcInfo>,
    pub children_map: HashMap<u32, Vec<u32>>,
    pub ports: HashMap<u32, Vec<u16>>,
    /// True on slow poll ticks (every 5 ticks ≈ 10s). Collectors should
    /// defer expensive discovery (e.g. /proc reads) to slow ticks.
    pub slow_tick: bool,
    /// PIDs of detected codex mcp-server processes. Populated by
    /// `MultiCollector` after McpDetection runs; CodexCollector
    /// excludes these so a single mcp-server PID isn't double-counted
    /// in the sessions panel.
    pub mcp_server_pids: HashSet<u32>,
    /// Rollout file paths held open by an mcp-server process. The
    /// CodexCollector "recently finished" pass skips these to avoid
    /// PID=0 ghost rows for threads that the mcp-server is still
    /// holding fds for.
    pub mcp_owned_rollouts: HashSet<PathBuf>,
    /// When false, the suppression sets above are empty so the
    /// sessions panel restores upstream behavior. Driven by the user
    /// toggle (Shift+M).
    pub mcp_suppress: bool,
    /// Cached Desktop app-server PID -> open rollout files. This is populated
    /// by a background scanner so slow macOS lsof calls cannot block the TUI.
    pub desktop_rollout_fd_map: HashMap<u32, Vec<PathBuf>>,
}

/// Context window size for this model (e.g. 200K, 1M).
pub(crate) fn context_window_for_model(
    transcript_model: &str,
    configured_model: &str,
    max_context_tokens: u64,
) -> u64 {
    if transcript_model.contains("[1m]")
        || configured_model.contains("[1m]")
        || max_context_tokens > 200_000
    {
        1_000_000
    } else {
        200_000
    }
}

impl SharedProcessData {
    /// Fetch process info every tick, but reuse cached ports when `cached_ports` is provided.
    pub fn fetch(cached_ports: Option<&HashMap<u32, Vec<u16>>>, slow_tick: bool) -> Self {
        let process_info = process::get_process_info();
        let children_map = process::get_children_map(&process_info);
        let ports = match cached_ports {
            Some(p) => p.clone(),
            None => process::get_listening_ports(),
        };
        Self {
            process_info,
            children_map,
            ports,
            slow_tick,
            mcp_server_pids: HashSet::new(),
            mcp_owned_rollouts: HashSet::new(),
            mcp_suppress: true,
            desktop_rollout_fd_map: HashMap::new(),
        }
    }
}

/// Info about a child process that owns an open port, tracked for orphan detection.
#[derive(Clone)]
struct TrackedPortChild {
    port: u16,
    command: String,
    project_name: String,
}

struct DesktopRolloutScanResult {
    pids: Vec<u32>,
    rollouts: Option<HashMap<u32, Vec<PathBuf>>>,
}

struct DesktopRolloutScanner {
    cached: HashMap<u32, Vec<PathBuf>>,
    cached_pids: Vec<u32>,
    in_flight_pids: Option<Vec<u32>>,
    child_pid: Arc<AtomicU32>,
    last_started: Option<Instant>,
    tx: Sender<DesktopRolloutScanResult>,
    rx: Receiver<DesktopRolloutScanResult>,
}

const DESKTOP_ROLLOUT_SCAN_TIMEOUT: Duration = Duration::from_secs(90);
const DESKTOP_ROLLOUT_RESCAN_INTERVAL: Duration = Duration::from_secs(60);

impl DesktopRolloutScanner {
    fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        Self {
            cached: HashMap::new(),
            cached_pids: Vec::new(),
            in_flight_pids: None,
            child_pid: Arc::new(AtomicU32::new(0)),
            last_started: None,
            tx,
            rx,
        }
    }

    fn update(&mut self, pids: &[u32]) -> HashMap<u32, Vec<PathBuf>> {
        self.poll_completed();
        if self.should_start(pids) {
            self.start(pids.to_vec());
        }
        self.cached_for(pids)
    }

    fn poll_completed(&mut self) {
        while let Ok(result) = self.rx.try_recv() {
            self.apply_result(result);
        }
    }

    fn apply_result(&mut self, result: DesktopRolloutScanResult) {
        self.in_flight_pids = None;
        if let Some(rollouts) = result.rollouts {
            self.cached_pids = result.pids;
            self.cached = rollouts;
        }
    }

    fn should_start(&self, pids: &[u32]) -> bool {
        if pids.is_empty() || self.in_flight_pids.is_some() {
            return false;
        }
        if self.cached_pids != pids {
            return true;
        }
        self.last_started
            .is_none_or(|started| started.elapsed() >= DESKTOP_ROLLOUT_RESCAN_INTERVAL)
    }

    fn start(&mut self, pids: Vec<u32>) {
        self.in_flight_pids = Some(pids.clone());
        self.last_started = Some(Instant::now())
```

### Core Architecture Module: `src/collector/opencode.rs`
```
use super::{process, context_window_for_model};
use crate::model::{AgentSession, ChildProcess, LaunchSurface, SessionStatus};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Maximum sessions to fetch from the DB per query.
const MAX_SESSIONS: u32 = 20;

/// Collector for OpenCode sessions.
///
/// Discovery strategy:
/// 1. `ps` to find running opencode processes (from shared process data)
/// 2. Query SQLite DB at ~/.local/share/opencode/opencode.db via `sqlite3` CLI
/// 3. Match running PIDs to sessions by cwd
///
/// Uses `sqlite3 -readonly -json` for safe concurrent reads (WAL mode).
/// DB rows are cached and only refreshed on `shared.slow_tick` (every ~10s)
/// so we don't fork a sqlite3 process every 2s. PID matching, status
/// derivation and the children walk run every tick using live process info.
pub struct OpenCodeCollector {
    db_path: PathBuf,
    /// Whether sqlite3 CLI is available (checked once).
    sqlite3_available: Option<bool>,
    /// Cached DB rows from the last slow-tick query. Reused on fast ticks.
    cached_db_sessions: Vec<DbSession>,
    /// Whether the "sqlite3 missing" warning has been emitted (once).
    #[cfg(target_os = "windows")]
    warned_sqlite3_missing: bool,
}

impl OpenCodeCollector {
    pub fn new() -> Self {
        let data_dir = std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| dirs::home_dir().unwrap_or_default().join(".local/share"));
        let db_path = data_dir.join("opencode").join("opencode.db");
        #[cfg(target_os = "windows")]
        let db_path = windows_db_path(db_path);
        Self {
            db_path,
            sqlite3_available: None,
            cached_db_sessions: Vec::new(),
            #[cfg(target_os = "windows")]
            warned_sqlite3_missing: false,
        }
    }

    fn check_sqlite3(&mut self) -> bool {
        if let Some(available) = self.sqlite3_available {
            return available;
        }
        let available = Command::new("sqlite3").arg("--version").output().is_ok();
        self.sqlite3_available = Some(available);
        available
    }

    fn collect_sessions(&mut self, shared: &super::SharedProcessData) -> Vec<AgentSession> {
        // Security: skip if db_path is a symlink (fail-closed)
        if is_symlink(&self.db_path) || !self.db_path.exists() {
            self.cached_db_sessions.clear();
            return vec![];
        }
        if !self.check_sqlite3() {
            // The DB exists but we can't read it: on Windows sqlite3 is
            // usually not preinstalled, so say why sessions are missing
            // instead of failing silently.
            #[cfg(target_os = "windows")]
            if !self.warned_sqlite3_missing {
                self.warned_sqlite3_missing = true;
                eprintln!(
                    "abtop: OpenCode database found at {} but the `sqlite3` CLI is not on PATH; \
                     OpenCode sessions will not appear. Install it (e.g. `winget install SQLite.SQLite`) \
                     and restart abtop.",
                    self.db_path.display()
                );
            }
            self.cached_db_sessions.clear();
            return vec![];
        }

        // Find running opencode PIDs and their commands for cwd matching
        let opencode_pids = Self::find_opencode_pids(&shared.process_info);
        let pid_commands: HashMap<u32, &str> = opencode_pids
            .iter()
            .filter_map(|&pid| {
                shared
                    .process_info
                    .get(&pid)
                    .map(|p| (pid, p.command.as_str()))
            })
            .collect();

        // Refresh DB rows on slow ticks only; reuse cache on fast ticks so
        // we don't fork sqlite3 every 2s.
        if shared.slow_tick {
            if let Some(rows) = self.query_sessions() {
                self.cached_db_sessions = rows;
            }
        }

        let now_ms = current_time_ms();
        let mut sessions = Vec::new();

        let mut claimed_pids = HashSet::new();
        for ds in &self.cached_db_sessions {
            let matched_pid =
                Self::match_pid_to_session_once(&pid_commands, &ds.directory, &mut claimed_pids);
            // Drop sessions whose process isn't running. (Done sessions are
            // filtered out by MultiCollector::collect anyway, so emitting
            // a Done row here would be dead code.)
            let Some(matched_pid) = matched_pid else {
                continue;
            };

            let proc = shared.process_info.get(&matched_pid);
            let mem_mb = proc.map(|p| p.rss_kb / 1024).unwrap_or(0);

            let age_ms = now_ms.saturating_sub(ds.time_updated);
            let since_update_secs = age_ms / 1000;
            let status = if since_update_secs < 30 {
                SessionStatus::Thinking
            } else {
                let cpu_active = proc.is_some_and(|p| p.cpu_pct > 1.0);
                let has_active_child = process::has_active_descendant(
                    matched_pid,
                    &shared.children_map,
                    &shared.process_info,
                    5.0,
                );
                if cpu_active || has_active_child {
                    SessionStatus::Thinking
                } else {
                    SessionStatus::Waiting
                }
            };

            let project_name = if !ds.project_name.is_empty() {
                ds.project_name.clone()
            } else {
                // last_path_segment also splits on `\` on Windows.
                process::last_path_segment(&ds.directory)
                    .unwrap_or("?")
                    .to_string()
            };

            let current_tasks = if matches!(status, SessionStatus::Waiting) {
                vec!["waiting for input".to_string()]
            } else {
                vec!["thinking...".to_string()]
            };

            // Collect child processes with cycle guard (visited set)
            let mut children = Vec::new();
            let mut stack: Vec<u32> = shared
                .children_map
                .get(&matched_pid)
                .cloned()
                .unwrap_or_default();
            let mut visited = std::collections::HashSet::new();
            while let Some(cpid) = stack.pop() {
                if !visited.insert(cpid) {
                    continue;
                }
                if let Some(cproc) = shared.process_info.get(&cpid) {
                    let port = shared.ports.get(&cpid).and_then(|v| v.first().copied());
                    children.push(ChildProcess {
                        pid: cpid,
                        command: cproc.command.clone(),
                        mem_kb: cproc.rss_kb,
                        port,
                    });
                }
                if let Some(grandchildren) = shared.children_map.get(&cpid) {
                    stack.extend(grandchildren);
                }
            }

            let model = if !ds.provider.is_empty() && !ds.model.is_empty() {
                format!("{}/{}", ds.provider, ds.model)
            } else if !ds.model.is_empty() {
                ds.model.clone()
            } else {
                "-".to_string()
            };

            let context_window = context_window_for_model(&model, "", 0);
            let context_percent = if context_window > 0 {
                ((ds.total_input + ds.total_output) as f64 / context_window as f64) * 100.0
            } else {
                0.0
            };

            sessions.push(AgentSession {
                agent_cli: "opencode",
                launch_surface: LaunchSurface::Cli,
                pid: matched_pid,
                session_id: ds.id.clone(),
                cwd: ds.directory.clone(),
                project_name,
                started
```

### Core Architecture Module: `src/collector/process.rs`
```
use std::collections::HashMap;
#[cfg(target_os = "linux")]
use std::fs;
use std::process::Command;

#[derive(Debug)]
pub struct ProcInfo {
    pub pid: u32,
    pub ppid: u32,
    pub rss_kb: u64,
    pub cpu_pct: f64,
    pub command: String,
}

/// Resolve all symlinks in /proc/{pid}/fd, returning their targets.
/// Used by both port discovery (socket inodes) and Codex JSONL discovery.
#[cfg(target_os = "linux")]
pub fn scan_proc_fds(pid: u32) -> Vec<std::path::PathBuf> {
    let fd_dir = format!("/proc/{}/fd", pid);
    let entries = match fs::read_dir(&fd_dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };
    entries
        .flatten()
        .filter_map(|e| fs::read_link(e.path()).ok())
        .collect()
}

#[cfg(target_os = "linux")]
pub fn get_process_info() -> HashMap<u32, ProcInfo> {
    let mut map = HashMap::new();

    let clk_tck = unsafe { libc::sysconf(libc::_SC_CLK_TCK) } as f64;
    let page_size = unsafe { libc::sysconf(libc::_SC_PAGESIZE) } as u64;

    let uptime_secs: f64 = fs::read_to_string("/proc/uptime")
        .ok()
        .and_then(|s| s.split_whitespace().next()?.parse().ok())
        .unwrap_or(0.0);

    let entries = match fs::read_dir("/proc") {
        Ok(e) => e,
        Err(_) => return map,
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let pid: u32 = match name.to_str().and_then(|s| s.parse().ok()) {
            Some(p) => p,
            None => continue,
        };

        // /proc/{pid}/stat - parse fields after (comm)
        let stat = match fs::read_to_string(format!("/proc/{pid}/stat")) {
            Ok(s) => s,
            Err(_) => continue,
        };
        // comm can contain spaces/parens, so find last ')'
        let after_comm = match stat.rfind(')') {
            Some(pos) if pos + 2 < stat.len() => &stat[pos + 2..],
            _ => continue,
        };
        let fields: Vec<&str> = after_comm.split_whitespace().collect();
        // fields[0]=state, [1]=ppid, [11]=utime, [12]=stime, [19]=starttime, [21]=rss
        if fields.len() < 22 {
            continue;
        }
        let ppid: u32 = fields[1].parse().unwrap_or(0);
        let utime: u64 = fields[11].parse().unwrap_or(0);
        let stime: u64 = fields[12].parse().unwrap_or(0);
        let starttime: u64 = fields[19].parse().unwrap_or(0);
        let rss_pages: u64 = fields[21].parse().unwrap_or(0);

        let rss_kb = rss_pages * page_size / 1024;

        // CPU%: lifetime average (total CPU time / wall time).
        // This differs from ps's instantaneous %CPU but is sufficient for
        // abtop's Working/Waiting threshold (cpu_pct > 1.0). A long-idle
        // process that was busy at startup will show a declining average,
        // eventually dropping below 1.0 as elapsed time grows.
        let uptime_ticks = (uptime_secs * clk_tck) as u64;
        let elapsed_ticks = uptime_ticks.saturating_sub(starttime);
        let cpu_pct = if elapsed_ticks > 0 {
            ((utime + stime) as f64 / elapsed_ticks as f64) * 100.0
        } else {
            0.0
        };

        // /proc/{pid}/cmdline: NUL-separated
        let command = fs::read_to_string(format!("/proc/{pid}/cmdline"))
            .unwrap_or_default()
            .replace('\0', " ")
            .trim()
            .to_string();
        if command.is_empty() {
            continue; // kernel thread, skip
        }

        map.insert(
            pid,
            ProcInfo {
                pid,
                ppid,
                rss_kb,
                cpu_pct,
                command,
            },
        );
    }
    map
}

#[cfg(target_os = "windows")]
pub fn get_process_info() -> HashMap<u32, ProcInfo> {
    use std::sync::{Mutex, OnceLock};

    // sysinfo's `cpu_usage()` is a delta between two refreshes — a freshly
    // constructed `System` always reports 0. Hold one across calls so the
    // second tick onward returns real CPU%, instead of every Windows process
    // looking idle (which would break `has_active_descendant` and the
    // Working/Waiting threshold downstream).
    static SYS: OnceLock<Mutex<sysinfo::System>> = OnceLock::new();
    let sys_mutex = SYS.get_or_init(|| Mutex::new(sysinfo::System::new()));
    let mut sys = sys_mutex
        .lock()
        .expect("process-info system mutex poisoned");

    sys.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::All,
        true,
        sysinfo::ProcessRefreshKind::new()
            .with_cpu()
            .with_memory()
            .with_cmd(sysinfo::UpdateKind::Always),
    );

    let mut map = HashMap::new();
    for (pid, proc_) in sys.processes() {
        let pid_u32 = pid.as_u32();
        // cmd() can be empty on Windows (cmdline retrieval failed for this
        // process); fall back to the executable name so cmd_has_binary still
        // matches `claude` / `codex` for those processes.
        let command = if proc_.cmd().is_empty() {
            proc_.name().to_string_lossy().into_owned()
        } else {
            proc_
                .cmd()
                .iter()
                .map(|s| s.to_string_lossy().into_owned())
                .collect::<Vec<_>>()
                .join(" ")
        };
        if command.is_empty() {
            continue;
        }
        map.insert(
            pid_u32,
            ProcInfo {
                pid: pid_u32,
                ppid: proc_.parent().map(|p| p.as_u32()).unwrap_or(0),
                rss_kb: proc_.memory() / 1024,
                cpu_pct: proc_.cpu_usage() as f64,
                command,
            },
        );
    }
    map
}

#[cfg(all(not(target_os = "linux"), not(target_os = "windows")))]
pub fn get_process_info() -> HashMap<u32, ProcInfo> {
    let mut map = HashMap::new();
    let output = Command::new("ps")
        .args(["-ww", "-eo", "pid,ppid,rss,%cpu,command"])
        .output()
        .ok();

    if let Some(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                if let (Ok(pid), Ok(ppid), Ok(rss)) = (
                    parts[0].parse::<u32>(),
                    parts[1].parse::<u32>(),
                    parts[2].parse::<u64>(),
                ) {
                    let cpu = parts[3].parse::<f64>().unwrap_or(0.0);
                    let command = parts[4..].join(" ");
                    map.insert(
                        pid,
                        ProcInfo {
                            pid,
                            ppid,
                            rss_kb: rss,
                            cpu_pct: cpu,
                            command,
                        },
                    );
                }
            }
        }
    }
    map
}

pub fn get_children_map(procs: &HashMap<u32, ProcInfo>) -> HashMap<u32, Vec<u32>> {
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for proc in procs.values() {
        children.entry(proc.ppid).or_default().push(proc.pid);
    }
    children
}

/// Walk the ppid chain from `pid` and return true if `ancestor` is reached.
/// Used to identify processes spawned by abtop itself (e.g. `claude --print`
/// summary children) so they can be filtered without dropping unrelated
/// non-interactive sessions started by the user.
pub fn is_descendant_of(pid: u32, ancestor: u32, process_info: &HashMap<u32, ProcInfo>) -> bool {
    if pid == 0 || ancestor == 0 || pid == ancestor {
        return false;
    }
    let mut current = pid;
    let mut visited = std::collections::HashSet::new();
    while visited.insert(current) {
        let Some(info) = process_info.get(&current) else {
            return false;
        };
        if info.ppid == ancestor {
            return true;
        }
        if info.ppid == 0 || info.ppid == 1 {
            return false;
        }
 
```

### Core Architecture Module: `src/collector/rate_limit.rs`
```
use crate::model::RateLimitInfo;
use serde::Deserialize;
use std::path::{Path, PathBuf};

/// File written by the StatusLine hook: ~/.claude/abtop-rate-limits.json
const CLAUDE_RATE_FILE: &str = "abtop-rate-limits.json";

/// Cached Codex rate limit: ~/.cache/abtop/codex-rate-limits.json
const CODEX_CACHE_FILE: &str = "codex-rate-limits.json";

#[derive(Debug, Deserialize)]
struct RateLimitFile {
    #[serde(default)]
    source: String,
    #[serde(default)]
    five_hour: Option<WindowInfo>,
    #[serde(default)]
    seven_day: Option<WindowInfo>,
    #[serde(default)]
    updated_at: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct WindowInfo {
    #[serde(default)]
    used_percentage: f64,
    #[serde(default)]
    resets_at: u64,
    #[serde(default)]
    window_minutes: Option<u64>,
}

/// Read rate limit info from all known Claude config directories.
/// Checks the default ~/.claude, CLAUDE_CONFIG_DIR if set, and any
/// additional directories discovered from running Claude processes.
pub fn read_rate_limits(extra_dirs: &[PathBuf]) -> Vec<RateLimitInfo> {
    let mut results = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Collect candidate directories: defaults + discovered
    let mut dirs = Vec::new();
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".claude"));
    }
    if let Ok(dir) = std::env::var("CLAUDE_CONFIG_DIR") {
        dirs.push(PathBuf::from(dir));
    }
    dirs.extend_from_slice(extra_dirs);

    for dir in dirs {
        if !dir.is_dir() || !seen.insert(dir.clone()) {
            continue;
        }
        let path = dir.join(CLAUDE_RATE_FILE);
        if let Some(info) = read_rate_file(&path, "claude") {
            results.push(info);
        }
    }

    results
}

/// Read cached Codex rate limit (fallback when no live session provides one).
/// Rate limits have their own `resets_at` expiry and the cache is refreshed
/// whenever the next Codex session runs, so the reader keeps serving the last
/// known value regardless of file age — the UI shows "N m ago" for staleness.
pub fn read_codex_cache() -> Option<RateLimitInfo> {
    let path = codex_cache_path()?;
    read_rate_file(&path, "codex")
}

/// Write Codex rate limit to cache file (atomic: write temp + rename).
pub fn write_codex_cache(info: &RateLimitInfo) {
    let Some(path) = codex_cache_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let json = format!(
        r#"{{"source":"codex","five_hour":{},"seven_day":{},"updated_at":{}}}"#,
        window_json(
            info.five_hour_pct,
            info.five_hour_resets_at,
            info.five_hour_window_minutes
        ),
        window_json(
            info.seven_day_pct,
            info.seven_day_resets_at,
            info.seven_day_window_minutes
        ),
        info.updated_at
            .map(|v| v.to_string())
            .unwrap_or_else(|| "null".to_string()),
    );

    // Atomic write: temp file + rename to avoid corrupted reads
    let tmp = path.with_extension("tmp");
    if std::fs::write(&tmp, &json).is_ok() {
        let _ = std::fs::rename(&tmp, &path);
    }
}

fn window_json(pct: Option<f64>, resets_at: Option<u64>, window_minutes: Option<u64>) -> String {
    match (pct, resets_at) {
        (Some(p), Some(r)) => match window_minutes {
            Some(m) => format!(
                r#"{{"used_percentage":{},"resets_at":{},"window_minutes":{}}}"#,
                p, r, m
            ),
            None => format!(r#"{{"used_percentage":{},"resets_at":{}}}"#, p, r),
        },
        (Some(p), None) => match window_minutes {
            Some(m) => format!(
                r#"{{"used_percentage":{},"resets_at":0,"window_minutes":{}}}"#,
                p, m
            ),
            None => format!(r#"{{"used_percentage":{},"resets_at":0}}"#, p),
        },
        _ => "null".to_string(),
    }
}

fn codex_cache_path() -> Option<PathBuf> {
    dirs::cache_dir().map(|d| d.join("abtop").join(CODEX_CACHE_FILE))
}

fn read_rate_file(path: &Path, default_source: &str) -> Option<RateLimitInfo> {
    let content = std::fs::read_to_string(path).ok()?;
    let file: RateLimitFile = serde_json::from_str(&content).ok()?;

    // Reject if both windows are absent
    if file.five_hour.is_none() && file.seven_day.is_none() {
        return None;
    }

    let source = if file.source.is_empty() {
        default_source.to_string()
    } else {
        file.source
    };

    Some(RateLimitInfo {
        source,
        five_hour_pct: file.five_hour.as_ref().map(|w| w.used_percentage),
        five_hour_resets_at: file.five_hour.as_ref().map(|w| w.resets_at),
        five_hour_window_minutes: file
            .five_hour
            .as_ref()
            .and_then(|w| w.window_minutes)
            .or(file.five_hour.as_ref().map(|_| 300)),
        seven_day_pct: file.seven_day.as_ref().map(|w| w.used_percentage),
        seven_day_resets_at: file.seven_day.as_ref().map(|w| w.resets_at),
        seven_day_window_minutes: file
            .seven_day
            .as_ref()
            .and_then(|w| w.window_minutes)
            .or(file.seven_day.as_ref().map(|_| 10_080)),
        updated_at: file.updated_at,
    })
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #141** (2026-07-05): **The remaining credit limit displayed by Codex under the Chatgpt Free account is incorrect.**
  *Symptoms*: Operating System: Kubuntu  Problem Encountered: The CodeX usage limit displayed under the ChatGpt Free account is incorrect. It should reset every 30 days, but it's showing '7 days' instead.  >The CodeX limit for the ChatGpt Free account has been changed from resetting every 7 days to every 30 days.  Expected Behavior: Display '30 days'  Screenshot:  <img width="296" height="109" alt="Image" src="https://github.com/user-attachments/assets/4431519b-c3e5-4ffb-ba72-f6fb86c22b6e" />  <img width="716" height="379" alt="Image" src="https://github.com/user-attachments/assets/c387296d-4f2d-44ba-a555-50ee13097958" />

- **Issue #125** (2026-05-24): **OpenCode sessions not detected on macOS arm64 (0 sessions)**
  *Symptoms*: ## Environment - **OS**: macOS arm64 (macOS 26.5, Build 25F71) - **abtop**: v0.4.4 - **opencode**: latest (with active sessions) - **sqlite3**: 3.51.0 ## Description `abtop --once` always reports "0 sessions, 0 mcp servers" despite having active OpenCode sessions. ## What I verified All prerequisites from the detection flow (`src/collector/opencode.rs`) check out: 1. **OpenCode processes running**: Two processes found via `ps` 2. **opencode.db exists and is readable**: ~44MB, contains 17 sessions with valid `session.directory` values 3. **sqlite3 query works manually**: Running the same query abtop uses returns correct session data 4. **Process cwd matches**: `lsof` confirms process cwd exactly matches `session.directory` in the database Yet abtop reports zero sessions. ## Suggestion It would be helpful if abtop had a `--debug` or `--verbose` flag to show which step in the detection pipeline fails (process discovery, db query, cwd matching, etc.). ## Workaround None found. Tried moving binary to `~/.local/bin/` with identical result.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. I reproduced the likely failure mode locally: on macOS, `lsof -p <pid> -d cwd -Fn` can return cwd entries for unrelated processes because the selection terms are ORed unless `-a` is present. Then abtop can parse `/` or another process's cwd instead of the OpenCode PID's cwd, causing the DB `session.directory` match to fail and all OpenCode sessions to be dropped.  This appears to be the same root cause fixed by #121, which merged after v0.4.4. The fix is on `main` in d28dc30 and changes the cwd lookup to `lsof -a -p <pid> -d cwd -Fn`.  Could you try a build from current `main` or the next release when available? For example:  ```bash cargo install --git https://github.com/graykode/abtop --locked ```  If it still reproduces on a build containing d28dc30 or later, please share `abtop --version` and the exact `ps -ww -eo pid,ppid,rss,%cpu,command | grep '[o]pencode'` plus `lsof -a -p <PID> -d cwd -Fn` output for one OpenCode PID.
  > Closing as fixed by #121. Please reopen or file a follow-up if this still reproduces with a build from current main or a release that includes d28dc30.

- **Issue #123** (2026-05-24): **Claude Code Personal Plan does not display**
  *Symptoms*: **Environment** - OS: macOS - Tahoe 26.3.1 - abtop version: `0.4.4` - Claude Code version: `2.1.143 (Claude Code)` - Terminal: iTerm2, Terminal, Hyper, kitty, tmux  **Describe the bug** I have Claude Code Team plan and personal plan running on the same laptop. But the agents of personal plan do not show.  **Steps to reproduce** 1. Open `abtop` in a terminal 2. Open `claude` in your personal plan and begin chatting with claude. 3. Observe the terminal where you are running `abtop`. You won't see any activities shown there.  **Expected behavior** I expect agents of the personal plan are monitored like others.  **Actual behavior** Nothing happens when I interact with Claude Code in my personal plan.  **Screenshots** N/A 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. I need a little more local diagnostic info to identify where discovery is failing.  Could you run these while one Team-plan Claude session and one Personal-plan Claude session are both active?  ```bash ps -eo pid,ppid,command | grep '[c]laude' ```  For the Personal-plan Claude PID that abtop does not show, please also run:  ```bash lsof -p <PID> | grep -E 'sessions|projects|jsonl|claude|CLAUDE' ```  And please check whether a session file exists for that PID:  ```bash ls -la ~/.claude/sessions/ ```  If you use `CLAUDE_CONFIG_DIR` for either account, please include that value too.  Please redact prompts, file contents, usernames, tokens, private paths, or any other sensitive data as needed.
  > ``` ps -eo pid,ppid,command | grep '[c]laude' 88125 47245 claude 49511 48566 claude ``` Then, following the commands: ``` lsof -p 88125 | grep -E 'sessions|projects|jsonl|claude|CLAUDE' 2.1.143 88125 user  txt       REG               1,17 207605280           224414704 /Users/user/.local/share/claude/versions/2.1.143  2.1.138 49511 user  txt       REG               1,17 205062416           218376764 /Users/user/.local/share/claude/versions/2.1.138  ``` To set up different Claude accounts, I created different profile folders for each account. Let's say: ``` ls -lht .claude*  .claude: total 96 0 drwxr-xr-x@ 7 user  staff    224 16 May 10:38 backups 0 drwxr-xr-x@ 4 user  staff    128 26 Apr 11:48 cache .... .... .... 0 drwx------@ 2 user  staff     64 16 May 11:11 sessions 8 -rw-------@ 1  user  staff    338 22 Apr 19:55 settings.json  .claude-personal: total 96 0 drwxr-xr-x@ 7 user  staff    224 16 May 10:38 backups 0 drwxr-xr-x@ 4 user  staff    128 26 Apr 11:48 cache .... .... .... 0 dr
  > @graykode It works again on my machine. It showed all sessions of different Claude plans regardless of personal or team plan before. Now, it only shows the session if I start `abtop` from the folders having `.envrc` as I explained in the previous comment.

- **Issue #68** (2026-04-23): **Behavior with /clear between sessions**
  *Symptoms*: Hi, It seems that when you chain sessions with a simple /clear to reset the context, abtop ends up loosing track of what's happening in the session. Do you confirm that this is somehow expected/normal with the current implementation? S.
  **Post-Mortem & Fix Analysis**:
  > Sorry for the bug classification, maybe it's not. To start, I just wanted to ask a question.
  > Thanks for filing. Quick context: `/clear` keeps the same PID but starts a new `sessionId` and a new transcript file. abtop re-reads `sessions/{PID}.json` every 2s and should pick up the new sessionId automatically, so in theory this should just work.  Could you share a bit more so I can repro: - What exactly does "losing track" look like — tokens frozen, context % wrong, session disappears from the list, status stuck on Working/Waiting, or something else? - Claude Code version (`claude --version`) and abtop version - Does it recover on its own after the next prompt in the cleared session, or stay broken until you restart abtop?  If you can grab a snapshot with `abtop --once` right after `/clear` (with any sensitive paths redacted), that would help a lot.
  > > Thanks for filing. Quick context: `/clear` keeps the same PID but starts a new `sessionId` and a new transcript file. abtop re-reads `sessions/{PID}.json` every 2s and should pick up the new sessionId automatically, so in theory this should just work. >  > Could you share a bit more so I can repro: >  > * What exactly does "losing track" look like — tokens frozen, context % wrong, session disappears from the list, status stuck on Working/Waiting, or something else? > * Claude Code version (`claude --version`) and abtop version > * Does it recover on its own after the next prompt in the cleared session, or stay broken until you restart abtop? >  > If you can grab a snapshot with `abtop --once` right after `/clear` (with any sensitive paths redacted), that would help a lot.  I just had the situation analyzed by Claude and I'm sharing with you the report. Right now I don't have the time to deep dive in. Hope it can help.  ## Observed bug: `/clear` freezes abtop's counters  ### Symptom  

- **Issue #54** (2026-04-20): **Discrepancy between abtop and CC internal counters**
  *Symptoms*: Here's a screenshot of abtop on an idle session; i don't understand the 346% context, is that the sum of all percentages across subagents?  <img width="1266" height="561" alt="Image" src="https://github.com/user-attachments/assets/45119317-03ac-42e0-9b26-53c8bcd7b68d" />   And here's my statusline on that session for comparison  <img width="840" height="85" alt="Image" src="https://github.com/user-attachments/assets/7ef8205f-6bc3-4c03-a343-28fe45c68bc4" />
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report — that's a real bug, not subagent aggregation.  The cause: `src/collector/claude.rs` was computing context as `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`. The third term is wrong — `cache_creation_input_tokens` is a write-side cost for populating cache breakpoints for *future* requests, not content in the current context window. Claude Code uses multiple cache breakpoints (system prompt, tools, memory, conversation history) and refreshes TTL caches aggressively, so `cache_creation` accumulates and easily inflates the percentage past 100% (346% in your case). Your CC statusline is correct.  Fix is up in #56 — context is now `input_tokens + cache_read_input_tokens`, matching what the model actually sees in its window. Will close this once that lands.

- **Issue #22** (2026-04-03): **some track bug on claude code**
  *Symptoms*: **Environment** - OS: macOS - abtop version: v0.2.3<!-- `abtop --version` --> - Claude Code version: 2.1.91 - Terminal: iTerm2    

- **Issue #15** (2026-04-04): **abtop-statusline.sh is hanging**
  *Symptoms*: **Environment** - OS: macOS - abtop version: 0.2.6 - Claude Code version: 2.1.89 - Terminal: wezterm  abstop-statusline.sh is freezing on exection. It's worked once to output abtop-rate-limits.json, but no longer. I've re-run abtop --setup. abtop itself continually says Unavailable in the quota pane. Happy to assist in manually debugging to find the root cause.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report! The root cause is that `cat` in `abtop-statusline.sh` blocks indefinitely when stdin isn't properly closed by Claude Code.  The fix is simple — replacing `cat` with `timeout 5 cat` so the script aborts after 5 seconds instead of hanging forever.  PR: #16  As a workaround until the next release, you can manually edit `~/.claude/abtop-statusline.sh` and change `INPUT=$(cat)` to `INPUT=$(timeout 5 cat)`. @dphase 
  > Thank you, no more hang. Unfortunate I'm still not getting it to output anything to `abtop-rate-limits.json`. I'll continue to dig.
  > Glad the hang is fixed! For the rate limit data not being written, there are a few possible causes:  1. **The JSON data may be too large for a shell argument** — `$INPUT` is passed as a CLI arg to python3, which can hit ARG_MAX limits 2. **Special characters in the JSON** (quotes, newlines) could break shell argument parsing 3. **`2>/dev/null`** is suppressing all errors, so failures are silent 4. **`rate_limits` may not be present** in the StatusLine data depending on your plan  Could you help debug by running this in your terminal?  ```bash echo '{"rate_limits":{"five_hour":{"used_percentage":10,"resets_at":1774715000},"seven_day":{"used_percentage":5,"resets_at":1775320000}}}' | ~/.claude/abtop-statusline.sh cat ~/.claude/abtop-rate-limits.json ```  If that works, the script itself is fine and the issue is with the data Claude Code sends. In that case, try temporarily removing `2>/dev/null` from the last line of `~/.claude/abtop-statusline.sh` and run a Claude session — that should 

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

### Incident Patch 1: `4b965686` (2026-09-14)
**Commit Message**: fix(codex): parse the new rollout schema (item_completed) from Codex ≥ ~0.149 (#170)

Codex rollouts using `event_msg.item_completed` were missing chat, tool
history, and file activity in abtop. This adds parsing for UserMessage,
AgentMessage, CommandExecution, FileChange, and Extension items while
retaining the existing event formats and Code Mode handling from #161.

Progress messages and completed tools keep an active turn running. A
final_answer message, task_complete, or turn_aborted ends it; a new user
item clears the previous completion state. Command durations accept
timestamps on either the item or its wrapper.

Tool previews contain only a known operation and sanitized, bounded path
metadata. Raw commands, scripts, patch bodies, and extension queries are
omitted. Unknown operations use a fixed label. File-access history is
bounded, and missing or unknown fields are tolerated. No new
dependencies, external requests, or command execution are introduced.

Validation: full `cargo test --locked`, `cargo clippy --locked
--all-targets -- -D warnings`, and `cargo build --release --locked`.
Regression tests cover turn lifecycle, private payload exclusion,
terminal control/bidi san

**File**: `src/collector/codex.rs` (modified, +415/-12)
```diff
@@ -1,7 +1,7 @@
 use super::process::{self, ProcInfo};
 use crate::model::{
-    AgentSession, ChatMessage, ChatRole, ChildProcess, LaunchSurface, RateLimitInfo, SessionStatus,
-    ToolCall, MAX_CHAT_MESSAGES,
+    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, LaunchSurface,
+    RateLimitInfo, SessionStatus, ToolCall, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
 };
 use serde_json::Value;
 use std::collections::{HashMap, HashSet};
@@ -207,9 +207,7 @@ impl CodexCollector {
             Self::sort_rollouts_by_mtime_desc(&mut desktop_rollout_paths);
 
             for path in desktop_rollout_paths {
-                let pid = desktop_pid_for_path
-                    .get(&path)
-                    .copied();
+                let pid = desktop_pid_for_path.get(&path).copied();
                 let process_ctx = CodexProcessContext {
                     pid,
                     is_exec: false,
@@ -669,7 +667,7 @@ impl CodexCollector {
                 tool_calls: result.tool_calls,
                 pending_since_ms: result.pending_since_ms,
                 thinking_since_ms: result.thinking_since_ms,
-                file_accesses: vec![],
+                file_accesses: result.file_accesses,
                 config_root: super::abbrev_path(
                     self.sessions_dir
                         .parent()
@@ -906,6 +904,9 @@ struct CodexJSONLResult {
     waiting_for_user: bool,
     /// Timestamp when the current model-thinking segment began.
     thinking_since_ms: u64,
+    /// Files touched, from the item_completed schema (Codex ≥ ~0.149).
+    /// The old schema never carried file information.
+    file_accesses: Vec<FileAccess>,
 }
 
 impl CodexJSONLResult {
@@ -946,6 +947,163 @@ fn sanitize_tool_arg(arg: &str) -> String {
     redacted.chars().take(120).collect()
 }
 
+/// Joined text of an item's `content` array. The schema is not consistent
+/// about casing ("Text" on AgentMessage, "text" on UserMessage), so any
+/// object with a string `text` field counts.
+fn concat_item_text(content: &Value) -> String {
+    content
+        .as_array()
+        .map(|parts| {
+            parts
+                .iter()
+                .filter_map(|p| p["text"].as_str())
+                .collect::<Vec<_>>()
+                .join("\n")
+        })
+        .unwrap_or_default()
+}
+
+/// One completed item from the new rollout schema (Codex ≥ ~0.149).
+///
+/// UserMessage/AgentMessage carry the chat, CommandExecution and Extension
+/// are the tool timeline, and FileChange is the only place file writes appear
+/// (the old schema never reported files at all).
+fn handle_item_completed(payload: &Value, ts: u64, result: &mut CodexJSONLResult) {
+    let item = &payload["item"];
+    match item["type"].as_str() {
+        Some("UserMessage") => {
+            result.task_complete = false;
+            result.model_generating = true;
+            result.thinking_since_ms = ts;
+            let text = concat_item_text(&item["content"]);
+            if !text.is_empty() {
+                if result.initial_prompt.is_empty() {
+                    result.initial_prompt = clean_chat_text(&text, 120);
+                }
+                push_chat_message(
+                    &mut result.chat_messages,
+                    ChatRole::User,
+                    clean_chat_text(&text, 500),
+                );
+            }
+        }
+        Some("AgentMessage") => {
+            result.turn_count += 1;
+            // Progress messages do not end a turn. New rollouts can signal
+            // completion with final_answer even without a task_complete event.
+            if item["phase"].as_str() == Some("final_answer") {
+                result.task_complete = true;
+                result.model_generating = false;
+                result.thinking_since_ms = 0;
+            }
+            let text = concat_item_text(&item["content"]);
+            push_chat_message(
+                &mut result.chat_messag
```

---

### Incident Patch 2: `e2aabfd2` (2026-09-14)
**Commit Message**: fix: preserve privacy and lifecycle in rollout item parsing

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ version = 4
 
 [[package]]
 name = "abtop"
-version = "0.5.3"
+version = "0.5.5"
 dependencies = [
  "chrono",
  "crossterm",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "abtop"
-version = "0.5.3"
+version = "0.5.5"
 edition = "2021"
 rust-version = "1.88"
 description = "AI agent monitor for your terminal"
```

**File**: `src/app.rs` (modified, +2/-0)
```diff
@@ -1012,10 +1012,12 @@ fn is_killable_agent_command(cmd: &str) -> bool {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use crate::model::LaunchSurface;
 
     fn waiting_session(cli: &'static str) -> AgentSession {
         AgentSession {
             agent_cli: cli,
+            launch_surface: LaunchSurface::Cli,
             pid: 1,
             session_id: String::new(),
             cwd: String::new(),
```

**File**: `src/collector/claude.rs` (modified, +90/-2)
```diff
@@ -1,7 +1,7 @@
 use super::process::{self, ProcInfo};
 use crate::model::{
-    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, SessionFile,
-    SessionStatus, SubAgent, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
+    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, LaunchSurface,
+    SessionFile, SessionStatus, SubAgent, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
 };
 use serde_json::Value;
 use std::collections::HashMap;
@@ -264,6 +264,36 @@ impl ClaudeCollector {
         pids
     }
 
+    /// Classify which surface launched a `claude` process, from the resolved
+    /// executable path in its full command line (as reported by `ps`/
+    /// `/proc/{pid}/cmdline`/sysinfo — see `process::ProcInfo::command`).
+    ///
+    /// - The Claude desktop app bundles its own Claude Code binary under a
+    ///   per-user `Claude/claude-code/<version>/` directory (Electron's
+    ///   userData layout: `~/Library/Application Support/Claude/...` on
+    ///   macOS, `%APPDATA%\Claude\...` on Windows, `~/.config/Claude/...`
+    ///   on Linux) — distinct from a plain PATH install.
+    /// - Editor extensions (VS Code, Cursor, Windsurf, ...) vendor the
+    ///   binary under `<editor-extensions-dir>/anthropic.claude-code-<ver>/`.
+    /// - Anything else (homebrew/npm/native install, the auto-updater's
+    ///   `claude/versions/<ver>` layout) is a plain CLI invocation.
+    fn detect_launch_surface(cmd: &str) -> LaunchSurface {
+        // Match against the whole command string rather than the first
+        // whitespace-split token: unlike `cmd_has_binary`'s binary-name
+        // check, these are fixed path fragments with no ambiguity, and the
+        // desktop app's own path already contains an unquoted space
+        // ("Application Support") on macOS that a naive first-token split
+        // would cut through.
+        let normalized = cmd.replace('\\', "/");
+        if normalized.contains("/Claude/claude-code/") {
+            LaunchSurface::App
+        } else if normalized.contains("/extensions/anthropic.claude-code") {
+            LaunchSurface::Ide
+        } else {
+            LaunchSurface::Cli
+        }
+    }
+
     fn map_pid_to_open_paths(pids: &[u32]) -> HashMap<u32, ProcessOpenPaths> {
         if pids.is_empty() {
             return HashMap::new();
@@ -343,6 +373,9 @@ impl ClaudeCollector {
         let pid_alive = proc_cmd
             .map(|c| process::cmd_has_binary(c, "claude"))
             .unwrap_or(false);
+        let launch_surface = proc_cmd
+            .map(Self::detect_launch_surface)
+            .unwrap_or(LaunchSurface::Cli);
 
         // Skip sessions whose PID is a descendant of abtop itself —
         // those are the `claude --print` summary children spawned by
@@ -642,6 +675,7 @@ impl ClaudeCollector {
 
         Some(AgentSession {
             agent_cli: "claude",
+            launch_surface,
             pid: sf.pid,
             session_id: sf.session_id,
             cwd: sf.cwd,
@@ -2026,6 +2060,60 @@ mod tests {
     use super::*;
     use std::io::Write;
 
+    // ---- detect_launch_surface ----
+
+    #[test]
+    fn detect_launch_surface_desktop_app_macos() {
+        let cmd = "/Users/a/Library/Application Support/Claude/claude-code/2.1.266/claude.app/Contents/MacOS/claude";
+        assert_eq!(
+            ClaudeCollector::detect_launch_surface(cmd),
+            LaunchSurface::App
+        );
+    }
+
+    #[test]
+    fn detect_launch_surface_desktop_app_windows_backslashes() {
+        let cmd = r#"C:\Users\a\AppData\Roaming\Claude\claude-code\2.1.266\claude.exe"#;
+        assert_eq!(
+            ClaudeCollector::detect_launch_surface(cmd),
+            LaunchSurface::App
+        );
+    }
+
+    #[test]
+    fn detect_launch_surface_vscode_extension() {
+        let cmd = "/Users/a/.vscode/extensions/anthropic.claude-code-2.1.269-darwin-arm64/resources/native-binary/claude";
+        assert_eq!(
+            ClaudeCollecto
```

**File**: `src/collector/codex.rs` (modified, +640/-79)
```diff
@@ -1,7 +1,7 @@
 use super::process::{self, ProcInfo};
 use crate::model::{
-    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, RateLimitInfo,
-    SessionStatus, ToolCall, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
+    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, LaunchSurface,
+    RateLimitInfo, SessionStatus, ToolCall, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
 };
 use serde_json::Value;
 use std::collections::{HashMap, HashSet};
@@ -207,9 +207,7 @@ impl CodexCollector {
             Self::sort_rollouts_by_mtime_desc(&mut desktop_rollout_paths);
 
             for path in desktop_rollout_paths {
-                let pid = desktop_pid_for_path
-                    .get(&path)
-                    .copied();
+                let pid = desktop_pid_for_path.get(&path).copied();
                 let process_ctx = CodexProcessContext {
                     pid,
                     is_exec: false,
@@ -567,10 +565,14 @@ impl CodexCollector {
                 && process_ctx.pid.is_some_and(|p| {
                     process::has_active_descendant(p, children_map, process_info, 5.0)
                 });
-            if has_active_child || result.pending_since_ms > 0 {
+            if result.task_complete || result.waiting_for_user {
+                SessionStatus::Waiting
+            } else if result.pending_since_ms > 0 {
                 SessionStatus::Executing
             } else if result.model_generating {
                 SessionStatus::Thinking
+            } else if has_active_child {
+                SessionStatus::Executing
             } else {
                 SessionStatus::Waiting
             }
@@ -579,14 +581,14 @@ impl CodexCollector {
         // Current task from last tool use
         // For exec (one-shot) sessions, task_complete means truly finished.
         // For interactive sessions, task_complete fires after every turn — ignore it.
-        let current_tasks = if !result.current_task.is_empty() {
-            vec![result.current_task]
-        } else if matches!(status, SessionStatus::Unknown) {
+        let current_tasks = if matches!(status, SessionStatus::Unknown) {
             vec!["unknown".to_string()]
-        } else if !pid_alive || (process_ctx.is_exec && result.task_complete) {
+        } else if matches!(status, SessionStatus::Done) {
             vec!["finished".to_string()]
         } else if matches!(status, SessionStatus::Waiting) {
             vec!["waiting for input".to_string()]
+        } else if !result.current_task.is_empty() {
+            vec![result.current_task]
         } else {
             vec!["thinking...".to_string()]
         };
@@ -630,6 +632,7 @@ impl CodexCollector {
         Some((
             AgentSession {
                 agent_cli: "codex",
+                launch_surface: LaunchSurface::Cli,
                 pid: display_pid,
                 session_id: result.session_id,
                 cwd: result.cwd,
@@ -877,10 +880,9 @@ struct CodexJSONLResult {
     turn_count: u32,
     current_task: String,
     task_complete: bool,
-    /// True iff the latest event in the rollout is a `user_message` with
-    /// no `agent_message` after it — i.e. the model has been prompted
-    /// but has not yet replied. Combined with recent rollout mtime this
-    /// gates the Thinking status. Mirrors Claude's `last_user_ts_ms > 0`.
+    /// True while a Codex turn is active, from the user prompt until
+    /// `task_complete`. Intermediate progress messages and tool calls do not
+    /// end the turn.
     model_generating: bool,
     last_activity: std::time::SystemTime,
     initial_prompt: String,
@@ -894,11 +896,13 @@ struct CodexJSONLResult {
     token_history: Vec<u64>,
     /// Rate limit info from the latest token_count event.
     rate_limit: Option<RateLimitInfo>,
-    /// Timeline of tool calls extracted from response_item.function_call events.
+    /// Timeline of standard and custom tool calls extracted from response it
```

---

### Incident Patch 3: `3c1ad218` (2026-09-14)
**Commit Message**: fix(codex): track code-mode status lifecycle (#161)

## Summary

- recognize `custom_tool_call` and `custom_tool_call_output` events
emitted by current Codex Code Mode
- keep turns active from `task_started`/`user_message` through
`task_complete`, including automatic turns with no user message
- transition back to Thinking after the final tool result while a turn
is still active
- report explicit user-input requests and completed turns as Waiting,
with descendant CPU used only as a fallback
- preserve standard tool-call and asynchronous
`exec_command`/`write_stdin` tracking
- derive current-task text from the final session status so Done and
Unknown sessions retain consistent labels

## Root cause

The collector treated every `agent_message` as the end of a turn and
only parsed the older `function_call` event shape. Codex CLI 0.144.6
emits intermediate progress messages and routes Code Mode tools through
custom tool-call events, so the parsed state frequently disagreed with
the live turn.

## Testing

- `cargo clippy --all-targets -- -D warnings`
- `cargo test` (207 unit tests and 1 doc test)
- manual `abtop --json` validation against active Codex CLI 0.144.6
sessions covering acti

**File**: `src/collector/codex.rs` (modified, +413/-31)
```diff
@@ -567,10 +567,14 @@ impl CodexCollector {
                 && process_ctx.pid.is_some_and(|p| {
                     process::has_active_descendant(p, children_map, process_info, 5.0)
                 });
-            if has_active_child || result.pending_since_ms > 0 {
+            if result.task_complete || result.waiting_for_user {
+                SessionStatus::Waiting
+            } else if result.pending_since_ms > 0 {
                 SessionStatus::Executing
             } else if result.model_generating {
                 SessionStatus::Thinking
+            } else if has_active_child {
+                SessionStatus::Executing
             } else {
                 SessionStatus::Waiting
             }
@@ -579,14 +583,14 @@ impl CodexCollector {
         // Current task from last tool use
         // For exec (one-shot) sessions, task_complete means truly finished.
         // For interactive sessions, task_complete fires after every turn — ignore it.
-        let current_tasks = if !result.current_task.is_empty() {
-            vec![result.current_task]
-        } else if matches!(status, SessionStatus::Unknown) {
+        let current_tasks = if matches!(status, SessionStatus::Unknown) {
             vec!["unknown".to_string()]
-        } else if !pid_alive || (process_ctx.is_exec && result.task_complete) {
+        } else if matches!(status, SessionStatus::Done) {
             vec!["finished".to_string()]
         } else if matches!(status, SessionStatus::Waiting) {
             vec!["waiting for input".to_string()]
+        } else if !result.current_task.is_empty() {
+            vec![result.current_task]
         } else {
             vec!["thinking...".to_string()]
         };
@@ -878,10 +882,9 @@ struct CodexJSONLResult {
     turn_count: u32,
     current_task: String,
     task_complete: bool,
-    /// True iff the latest event in the rollout is a `user_message` with
-    /// no `agent_message` after it — i.e. the model has been prompted
-    /// but has not yet replied. Combined with recent rollout mtime this
-    /// gates the Thinking status. Mirrors Claude's `last_user_ts_ms > 0`.
+    /// True while a Codex turn is active, from the user prompt until
+    /// `task_complete`. Intermediate progress messages and tool calls do not
+    /// end the turn.
     model_generating: bool,
     last_activity: std::time::SystemTime,
     initial_prompt: String,
@@ -895,11 +898,13 @@ struct CodexJSONLResult {
     token_history: Vec<u64>,
     /// Rate limit info from the latest token_count event.
     rate_limit: Option<RateLimitInfo>,
-    /// Timeline of tool calls extracted from response_item.function_call events.
+    /// Timeline of standard and custom tool calls extracted from response items.
     tool_calls: Vec<ToolCall>,
     /// Earliest start timestamp among currently open tool calls.
     pending_since_ms: u64,
-    /// Timestamp of the latest user prompt not yet followed by assistant output.
+    /// True when an open tool call is explicitly waiting for the user.
+    waiting_for_user: bool,
+    /// Timestamp when the current model-thinking segment began.
     thinking_since_ms: u64,
 }
 
@@ -1024,6 +1029,10 @@ fn output_reports_process_exit(output: &str) -> bool {
         .any(|line| line.trim_start().starts_with("Process exited"))
 }
 
+fn tool_waits_for_user(name: &str) -> bool {
+    matches!(name, "request_user_input" | "AskUserQuestion")
+}
+
 fn close_codex_tool_call(
     call_id: &str,
     end_ms: u64,
@@ -1051,7 +1060,7 @@ fn close_codex_tool_call(
 /// - event_msg.user_message: user prompt
 /// - event_msg.agent_message: turn count
 /// - event_msg.task_complete: session done
-/// - response_item (function_call): current tool use
+/// - response_item (function_call/custom_tool_call): current tool use
 /// - turn_context: model, effort
 fn parse_codex_jsonl(path: &Path) -> Option<CodexJSONLResult> {
     let file = fs::File::open(path).ok()?;
@@ -1082,6 +1091,7 @@ fn parse_codex_jsonl(pat
```

---

### Incident Patch 4: `7fd46246` (2026-09-14)
**Commit Message**: Merge branch 'main' into fix/codex-status-lifecycle

**File**: `Cargo.lock` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ version = 4
 
 [[package]]
 name = "abtop"
-version = "0.5.3"
+version = "0.5.5"
 dependencies = [
  "chrono",
  "crossterm",
```

**File**: `Cargo.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [package]
 name = "abtop"
-version = "0.5.3"
+version = "0.5.5"
 edition = "2021"
 rust-version = "1.88"
 description = "AI agent monitor for your terminal"
```

**File**: `src/app.rs` (modified, +2/-0)
```diff
@@ -1012,10 +1012,12 @@ fn is_killable_agent_command(cmd: &str) -> bool {
 #[cfg(test)]
 mod tests {
     use super::*;
+    use crate::model::LaunchSurface;
 
     fn waiting_session(cli: &'static str) -> AgentSession {
         AgentSession {
             agent_cli: cli,
+            launch_surface: LaunchSurface::Cli,
             pid: 1,
             session_id: String::new(),
             cwd: String::new(),
```

**File**: `src/collector/claude.rs` (modified, +90/-2)
```diff
@@ -1,7 +1,7 @@
 use super::process::{self, ProcInfo};
 use crate::model::{
-    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, SessionFile,
-    SessionStatus, SubAgent, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
+    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, LaunchSurface,
+    SessionFile, SessionStatus, SubAgent, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
 };
 use serde_json::Value;
 use std::collections::HashMap;
@@ -264,6 +264,36 @@ impl ClaudeCollector {
         pids
     }
 
+    /// Classify which surface launched a `claude` process, from the resolved
+    /// executable path in its full command line (as reported by `ps`/
+    /// `/proc/{pid}/cmdline`/sysinfo — see `process::ProcInfo::command`).
+    ///
+    /// - The Claude desktop app bundles its own Claude Code binary under a
+    ///   per-user `Claude/claude-code/<version>/` directory (Electron's
+    ///   userData layout: `~/Library/Application Support/Claude/...` on
+    ///   macOS, `%APPDATA%\Claude\...` on Windows, `~/.config/Claude/...`
+    ///   on Linux) — distinct from a plain PATH install.
+    /// - Editor extensions (VS Code, Cursor, Windsurf, ...) vendor the
+    ///   binary under `<editor-extensions-dir>/anthropic.claude-code-<ver>/`.
+    /// - Anything else (homebrew/npm/native install, the auto-updater's
+    ///   `claude/versions/<ver>` layout) is a plain CLI invocation.
+    fn detect_launch_surface(cmd: &str) -> LaunchSurface {
+        // Match against the whole command string rather than the first
+        // whitespace-split token: unlike `cmd_has_binary`'s binary-name
+        // check, these are fixed path fragments with no ambiguity, and the
+        // desktop app's own path already contains an unquoted space
+        // ("Application Support") on macOS that a naive first-token split
+        // would cut through.
+        let normalized = cmd.replace('\\', "/");
+        if normalized.contains("/Claude/claude-code/") {
+            LaunchSurface::App
+        } else if normalized.contains("/extensions/anthropic.claude-code") {
+            LaunchSurface::Ide
+        } else {
+            LaunchSurface::Cli
+        }
+    }
+
     fn map_pid_to_open_paths(pids: &[u32]) -> HashMap<u32, ProcessOpenPaths> {
         if pids.is_empty() {
             return HashMap::new();
@@ -343,6 +373,9 @@ impl ClaudeCollector {
         let pid_alive = proc_cmd
             .map(|c| process::cmd_has_binary(c, "claude"))
             .unwrap_or(false);
+        let launch_surface = proc_cmd
+            .map(Self::detect_launch_surface)
+            .unwrap_or(LaunchSurface::Cli);
 
         // Skip sessions whose PID is a descendant of abtop itself —
         // those are the `claude --print` summary children spawned by
@@ -642,6 +675,7 @@ impl ClaudeCollector {
 
         Some(AgentSession {
             agent_cli: "claude",
+            launch_surface,
             pid: sf.pid,
             session_id: sf.session_id,
             cwd: sf.cwd,
@@ -2026,6 +2060,60 @@ mod tests {
     use super::*;
     use std::io::Write;
 
+    // ---- detect_launch_surface ----
+
+    #[test]
+    fn detect_launch_surface_desktop_app_macos() {
+        let cmd = "/Users/a/Library/Application Support/Claude/claude-code/2.1.266/claude.app/Contents/MacOS/claude";
+        assert_eq!(
+            ClaudeCollector::detect_launch_surface(cmd),
+            LaunchSurface::App
+        );
+    }
+
+    #[test]
+    fn detect_launch_surface_desktop_app_windows_backslashes() {
+        let cmd = r#"C:\Users\a\AppData\Roaming\Claude\claude-code\2.1.266\claude.exe"#;
+        assert_eq!(
+            ClaudeCollector::detect_launch_surface(cmd),
+            LaunchSurface::App
+        );
+    }
+
+    #[test]
+    fn detect_launch_surface_vscode_extension() {
+        let cmd = "/Users/a/.vscode/extensions/anthropic.claude-code-2.1.269-darwin-arm64/resources/native-binary/claude";
+        assert_eq!(
+            ClaudeCollecto
```

**File**: `src/collector/codex.rs` (modified, +3/-2)
```diff
@@ -1,7 +1,7 @@
 use super::process::{self, ProcInfo};
 use crate::model::{
-    AgentSession, ChatMessage, ChatRole, ChildProcess, RateLimitInfo, SessionStatus, ToolCall,
-    MAX_CHAT_MESSAGES,
+    AgentSession, ChatMessage, ChatRole, ChildProcess, LaunchSurface, RateLimitInfo, SessionStatus,
+    ToolCall, MAX_CHAT_MESSAGES,
 };
 use serde_json::Value;
 use std::collections::{HashMap, HashSet};
@@ -634,6 +634,7 @@ impl CodexCollector {
         Some((
             AgentSession {
                 agent_cli: "codex",
+                launch_surface: LaunchSurface::Cli,
                 pid: display_pid,
                 session_id: result.session_id,
                 cwd: result.cwd,
```

---

### Incident Patch 5: `559dc1c8` (2026-09-14)
**Commit Message**: fix: omit private custom tool payloads from display data

**File**: `src/collector/codex.rs` (modified, +71/-5)
```diff
@@ -1304,12 +1304,11 @@ fn parse_codex_jsonl(path: &Path) -> Option<CodexJSONLResult> {
                 // custom_tool_call; both forms have the same lifecycle.
                 if matches!(item_type, Some("function_call" | "custom_tool_call")) {
                     if let Some(name) = payload["name"].as_str() {
-                        // Extract first arg (typically file path or command)
                         let arg = if item_type == Some("custom_tool_call") {
-                            payload["input"]
-                                .as_str()
-                                .map(sanitize_tool_arg)
-                                .unwrap_or_default()
+                            // Custom inputs are opaque scripts or patch bodies,
+                            // which can contain private file contents. Show only
+                            // the tool name; token-prefix redaction is insufficient.
+                            String::new()
                         } else {
                             payload["arguments"]
                                 .as_str()
@@ -2214,6 +2213,73 @@ mod tests {
         assert_eq!(session.thinking_since_ms, 0);
     }
 
+    #[test]
+    fn test_codex_custom_tool_payloads_stay_out_of_display_data() {
+        for (name, input) in [
+            (
+                "apply_patch",
+                "*** Begin Patch\n*** Add File: .env\n+PASSWORD=private-test-value\n*** End Patch",
+            ),
+            (
+                "exec",
+                "await tools.exec_command({cmd: 'printf private-test-value > .env'});",
+            ),
+            ("future_tool", "private-test-value"),
+        ] {
+            let mut file = tempfile::NamedTempFile::new().unwrap();
+            let call = serde_json::json!({
+                "type": "response_item",
+                "timestamp": "2026-03-28T15:01:06Z",
+                "payload": {
+                    "type": "custom_tool_call",
+                    "name": name,
+                    "input": input,
+                    "call_id": "private_call"
+                }
+            });
+            write_lines(
+                &mut file,
+                &[
+                    SESSION_META,
+                    r#"{"type":"event_msg","timestamp":"2026-03-28T15:01:00Z","payload":{"type":"task_started"}}"#,
+                    &call.to_string(),
+                ],
+            );
+
+            let collector = CodexCollector::new();
+            let mut process_info = HashMap::new();
+            process_info.insert(42, proc_info(42, 1, "codex"));
+            let (session, _) = collector
+                .load_session_with_rate_limit(
+                    owned_process(42),
+                    file.path(),
+                    &process_info,
+                    &HashMap::new(),
+                    &HashMap::new(),
+                )
+                .unwrap();
+
+            // These fields feed the TUI, --once, and JSON snapshots.
+            assert_eq!(session.current_tasks, vec![name.to_string()]);
+            assert_eq!(session.tool_calls.len(), 1);
+            assert_eq!(session.tool_calls[0].name, name);
+            assert!(session.tool_calls[0].arg.is_empty());
+            assert_eq!(session.status, SessionStatus::Executing);
+            assert_eq!(session.pending_since_ms, 1_774_710_066_000);
+
+            write_lines(
+                &mut file,
+                &[r#"{"type":"response_item","timestamp":"2026-03-28T15:01:09Z","payload":{"type":"custom_tool_call_output","call_id":"private_call","output":"private-test-value"}}"#],
+            );
+            let result = parse_codex_jsonl(file.path()).unwrap();
+            assert!(result.current_task.is_empty());
+            assert!(result.tool_calls[0].arg.is_empty());
+            assert_eq!(result.tool_calls[0].duration_ms, 3_000);
+            assert_eq!(result.pending_since_ms, 0);
+            assert!(result.model_generating);
+        }
+    }
+
    
```

---

### Incident Patch 6: `d4064979` (2026-09-10)
**Commit Message**: fix: remove outdated Claude peak-hours warning (#174)

Remove the fixed UTC warning and unused localization keys following the removal of peak-hours limit reductions for Pro and Max accounts. Fixes #173.

**File**: `src/locale.rs` (modified, +0/-4)
```diff
@@ -145,8 +145,6 @@ static LOCALE_EN: LazyLock<std::collections::HashMap<&str, &str>> = LazyLock::ne
     m.insert("footer.quit", "quit");
     m.insert("footer.sessions", "sessions");
     m.insert("footer.auto", "auto");
-    m.insert("footer.peak_hours", "Claude Peak Hours");
-    m.insert("footer.resets_in", "resets in");
     m.insert("footer.esc_clear", "Esc clear, Enter keep");
     m.insert("footer.jump", "jump");
 
@@ -390,8 +388,6 @@ static LOCALE_ZH: LazyLock<std::collections::HashMap<&str, &str>> = LazyLock::ne
     m.insert("footer.quit", "退出");
     m.insert("footer.sessions", "会话");
     m.insert("footer.auto", "自动");
-    m.insert("footer.peak_hours", "Claude 高峰时段");
-    m.insert("footer.resets_in", "重置于");
     m.insert("footer.esc_clear", "Esc 清除，Enter 保留");
     m.insert("footer.jump", "跳转");
 
```

**File**: `src/ui/footer.rs` (modified, +0/-23)
```diff
@@ -1,7 +1,6 @@
 use crate::app::App;
 use crate::locale::t;
 use crate::theme::Theme;
-use chrono::Timelike;
 use ratatui::layout::Rect;
 use ratatui::style::Style;
 use ratatui::text::{Line, Span};
@@ -133,28 +132,6 @@ pub(crate) fn draw_footer(f: &mut Frame, app: &App, area: Rect, theme: &Theme) {
         }
     }
 
-    // Peak hours warning: US business hours = PT 5am–11am = UTC 12:00–18:00
-    let peak_info = {
-        let now = chrono::Utc::now();
-        let hour = now.hour();
-        if (12..18).contains(&hour) {
-            let mins_left = (18 - hour) * 60 - now.minute();
-            let h = mins_left / 60;
-            let m = mins_left % 60;
-            let peak_label = t("footer.peak_hours");
-            let resets_in = t("footer.resets_in");
-            Some(format!("⚡{} ({} {}h{:02}m)", peak_label, resets_in, h, m))
-        } else {
-            None
-        }
-    };
-    if let Some(ref peak) = peak_info.filter(|_| !compact) {
-        spans.push(Span::styled(
-            format!(" {peak} "),
-            Style::default().fg(theme.warning_fg),
-        ));
-    }
-
     let visible_count = app.visible_indices().len();
     let sessions_label = t("footer.sessions");
     let count_label = if visible_count < app.sessions.len() {
```

---

### Incident Patch 7: `efe05194` (2026-09-10)
**Commit Message**: fix: remove outdated Claude peak-hours warning

**File**: `src/locale.rs` (modified, +0/-4)
```diff
@@ -145,8 +145,6 @@ static LOCALE_EN: LazyLock<std::collections::HashMap<&str, &str>> = LazyLock::ne
     m.insert("footer.quit", "quit");
     m.insert("footer.sessions", "sessions");
     m.insert("footer.auto", "auto");
-    m.insert("footer.peak_hours", "Claude Peak Hours");
-    m.insert("footer.resets_in", "resets in");
     m.insert("footer.esc_clear", "Esc clear, Enter keep");
     m.insert("footer.jump", "jump");
 
@@ -390,8 +388,6 @@ static LOCALE_ZH: LazyLock<std::collections::HashMap<&str, &str>> = LazyLock::ne
     m.insert("footer.quit", "退出");
     m.insert("footer.sessions", "会话");
     m.insert("footer.auto", "自动");
-    m.insert("footer.peak_hours", "Claude 高峰时段");
-    m.insert("footer.resets_in", "重置于");
     m.insert("footer.esc_clear", "Esc 清除，Enter 保留");
     m.insert("footer.jump", "跳转");
 
```

**File**: `src/ui/footer.rs` (modified, +0/-23)
```diff
@@ -1,7 +1,6 @@
 use crate::app::App;
 use crate::locale::t;
 use crate::theme::Theme;
-use chrono::Timelike;
 use ratatui::layout::Rect;
 use ratatui::style::Style;
 use ratatui::text::{Line, Span};
@@ -133,28 +132,6 @@ pub(crate) fn draw_footer(f: &mut Frame, app: &App, area: Rect, theme: &Theme) {
         }
     }
 
-    // Peak hours warning: US business hours = PT 5am–11am = UTC 12:00–18:00
-    let peak_info = {
-        let now = chrono::Utc::now();
-        let hour = now.hour();
-        if (12..18).contains(&hour) {
-            let mins_left = (18 - hour) * 60 - now.minute();
-            let h = mins_left / 60;
-            let m = mins_left % 60;
-            let peak_label = t("footer.peak_hours");
-            let resets_in = t("footer.resets_in");
-            Some(format!("⚡{} ({} {}h{:02}m)", peak_label, resets_in, h, m))
-        } else {
-            None
-        }
-    };
-    if let Some(ref peak) = peak_info.filter(|_| !compact) {
-        spans.push(Span::styled(
-            format!(" {peak} "),
-            Style::default().fg(theme.warning_fg),
-        ));
-    }
-
     let visible_count = app.visible_indices().len();
     let sessions_label = t("footer.sessions");
     let count_label = if visible_count < app.sessions.len() {
```

---

### Incident Patch 8: `d30458b3` (2026-08-22)
**Commit Message**: fix(codex): parse the new rollout schema (item_completed) from Codex ≥ ~0.149

Recent Codex CLI versions replaced the user_message / agent_message /
function_call vocabulary with item_completed wrappers, leaving sessions
with empty chat, no tool timeline, no turn count and a status stuck on
Waiting. Handle the new item types — UserMessage/AgentMessage for chat,
CommandExecution (with real durations) and Extension for the tool
timeline, FileChange for file accesses, which the old schema never
carried at all — and adjust generating-state transitions via
task_started/turn_aborted. Old-schema parsing is untouched.

**File**: `src/collector/codex.rs` (modified, +228/-3)
```diff
@@ -1,7 +1,7 @@
 use super::process::{self, ProcInfo};
 use crate::model::{
-    AgentSession, ChatMessage, ChatRole, ChildProcess, RateLimitInfo, SessionStatus, ToolCall,
-    MAX_CHAT_MESSAGES,
+    AgentSession, ChatMessage, ChatRole, ChildProcess, FileAccess, FileOp, RateLimitInfo,
+    SessionStatus, ToolCall, MAX_CHAT_MESSAGES, MAX_FILE_ACCESSES,
 };
 use serde_json::Value;
 use std::collections::{HashMap, HashSet};
@@ -664,7 +664,7 @@ impl CodexCollector {
                 tool_calls: result.tool_calls,
                 pending_since_ms: result.pending_since_ms,
                 thinking_since_ms: result.thinking_since_ms,
-                file_accesses: vec![],
+                file_accesses: result.file_accesses,
                 config_root: super::abbrev_path(
                     self.sessions_dir
                         .parent()
@@ -900,6 +900,9 @@ struct CodexJSONLResult {
     pending_since_ms: u64,
     /// Timestamp of the latest user prompt not yet followed by assistant output.
     thinking_since_ms: u64,
+    /// Files touched, from the item_completed schema (Codex ≥ ~0.149).
+    /// The old schema never carried file information.
+    file_accesses: Vec<FileAccess>,
 }
 
 impl CodexJSONLResult {
@@ -940,6 +943,135 @@ fn sanitize_tool_arg(arg: &str) -> String {
     redacted.chars().take(120).collect()
 }
 
+/// Joined text of an item's `content` array. The schema is not consistent
+/// about casing ("Text" on AgentMessage, "text" on UserMessage), so any
+/// object with a string `text` field counts.
+fn concat_item_text(content: &Value) -> String {
+    content
+        .as_array()
+        .map(|parts| {
+            parts
+                .iter()
+                .filter_map(|p| p["text"].as_str())
+                .collect::<Vec<_>>()
+                .join("\n")
+        })
+        .unwrap_or_default()
+}
+
+/// One completed item from the new rollout schema (Codex ≥ ~0.149).
+///
+/// UserMessage/AgentMessage carry the chat, CommandExecution and Extension
+/// are the tool timeline, and FileChange is the only place file writes appear
+/// (the old schema never reported files at all).
+fn handle_item_completed(item: &Value, ts: u64, result: &mut CodexJSONLResult) {
+    match item["type"].as_str() {
+        Some("UserMessage") => {
+            result.model_generating = true;
+            result.thinking_since_ms = ts;
+            let text = concat_item_text(&item["content"]);
+            if !text.is_empty() {
+                if result.initial_prompt.is_empty() {
+                    let truncated: String = text.chars().take(120).collect();
+                    result.initial_prompt = super::redact_secrets(&truncated);
+                }
+                push_chat_message(
+                    &mut result.chat_messages,
+                    ChatRole::User,
+                    clean_chat_text(&text, 500),
+                );
+            }
+        }
+        Some("AgentMessage") => {
+            result.turn_count += 1;
+            result.model_generating = false;
+            result.thinking_since_ms = 0;
+            let text = concat_item_text(&item["content"]);
+            push_chat_message(
+                &mut result.chat_messages,
+                ChatRole::Assistant,
+                clean_chat_text(&text, 500),
+            );
+        }
+        Some("CommandExecution") => {
+            result.model_generating = false;
+            result.thinking_since_ms = 0;
+            let started = item["started_at_ms"].as_u64().unwrap_or(ts);
+            let completed = item["completed_at_ms"].as_u64().unwrap_or(started);
+            // parsed_cmd names the intent (read/write/search/…) and often a
+            // path; fall back to the raw argv when it is absent.
+            let parsed = &item["parsed_cmd"][0];
+            let name = parsed["type"].as_str().unwrap_or("exec").to_string();
+            let arg_raw = parsed["cmd"]
+                .as_str()
+                .map(str::to_st
```

---

### Incident Patch 9: `09ea4510` (2026-07-27)
**Commit Message**: Merge branch 'main' into fix/codex-status-lifecycle

**File**: `src/collector/claude.rs` (modified, +90/-13)
```diff
@@ -536,13 +536,28 @@ impl ClaudeCollector {
             return None;
         }
 
+        // Derive the project directory from the transcript path (handles worktree sessions),
+        // falling back to the encoded cwd.
+        let project_dir = transcript_path
+            .as_ref()
+            .and_then(|tp| tp.parent().map(|p| p.to_path_buf()))
+            .unwrap_or_else(|| config.projects_dir.join(encode_cwd_path(&sf.cwd)));
+
+        // Collect subagents before deriving the parent status so asynchronous
+        // Agent work keeps the parent active after its tool_result has returned.
+        let subagents_dir = project_dir.join(&sf.session_id).join("subagents");
+        let subagents = Self::collect_subagents(&subagents_dir);
+        let has_working_subagent = subagents.iter().any(|agent| agent.status == "working");
+
         // Status is best-effort. Signals we trust:
         //   1. Active descendant CPU → tool is running.
         //   2. current_task non-empty → latest assistant turn left a
         //      tool_use unanswered. Catches I/O-bound tools (Read, Edit)
         //      whose descendants stay under 5% CPU, so the CPU heuristic
         //      alone would flicker to Waiting while the tool runs.
-        //   3. last_user_ts_ms > 0 → trailing transcript line is a real
+        //   3. A working subagent → an async Agent call is still running even
+        //      though its tool_result has already returned to the parent.
+        //   4. last_user_ts_ms > 0 → trailing transcript line is a real
         //      user prompt with no assistant reply yet, so the model is
         //      generating. tool_result wrappers are skipped at the
         //      parser level so this only fires for actual prompts.
@@ -562,7 +577,7 @@ impl ClaudeCollector {
             // between CPU samples, so has_active_descendant alone misses them.
             let pending_tool = !cached.current_task.is_empty();
             let model_generating = cached.last_user_ts_ms > 0;
-            if has_active_descendant || pending_tool {
+            if has_active_descendant || pending_tool || has_working_subagent {
                 SessionStatus::Executing
             } else if model_generating {
                 SessionStatus::Thinking
@@ -616,17 +631,6 @@ impl ClaudeCollector {
         // Git stats: populated by MultiCollector on slow ticks
         let (git_added, git_modified) = (0, 0);
 
-        // Derive the project directory from the transcript path (handles worktree sessions),
-        // falling back to the encoded cwd.
-        let project_dir = transcript_path
-            .as_ref()
-            .and_then(|tp| tp.parent().map(|p| p.to_path_buf()))
-            .unwrap_or_else(|| config.projects_dir.join(encode_cwd_path(&sf.cwd)));
-
-        // Subagent discovery
-        let subagents_dir = project_dir.join(&sf.session_id).join("subagents");
-        let subagents = Self::collect_subagents(&subagents_dir);
-
         // Memory status
         let memory_dir = project_dir.join("memory");
         let (mem_file_count, mem_line_count) = Self::collect_memory_status(&memory_dir);
@@ -3569,6 +3573,79 @@ n/Users/bob/.claude-alt/projects/-Users-bob-project/session.jsonl
         );
     }
 
+    #[test]
+    fn test_load_session_working_async_subagent_is_executing() {
+        // Regression for #156: an async Agent tool returns immediately, so the
+        // parent has no pending tool while its subagent keeps working. The
+        // working subagent must keep the parent Executing instead of Waiting.
+        let temp = tempfile::tempdir().unwrap();
+        let profile = temp.path().join(".claude");
+        let sessions_dir = profile.join("sessions");
+        let projects = profile.join("projects");
+        let cwd = temp.path().join("repo");
+        std::fs::create_dir_all(&sessions_dir).unwrap();
+        std::fs::create_dir_all(&projects).unwrap();
+        std::fs::create_dir_all(&cwd).unwrap();
+
+        le
```

---

### Incident Patch 10: `148f64d0` (2026-07-27)
**Commit Message**: fix: keep parent active for async subagents (#157)

## Summary

- collect Claude subagents before calculating the parent session status
- keep the parent session `Executing` while any async subagent is still
`working`
- add a regression test covering an immediate async `Agent` tool result
followed by a text-only parent response

## Problem

Async Claude `Agent` calls return a `tool_result` immediately even
though the subagent continues in the background. Once the parent writes
a text-only response, `current_task` is cleared and abtop falls through
to `Waiting`, despite already discovering a working subagent for the
session.

## Test plan

- `cargo clippy -- -D warnings`
- `cargo test`
- `cargo build --release`

Closes #156

**File**: `src/collector/claude.rs` (modified, +90/-13)
```diff
@@ -536,13 +536,28 @@ impl ClaudeCollector {
             return None;
         }
 
+        // Derive the project directory from the transcript path (handles worktree sessions),
+        // falling back to the encoded cwd.
+        let project_dir = transcript_path
+            .as_ref()
+            .and_then(|tp| tp.parent().map(|p| p.to_path_buf()))
+            .unwrap_or_else(|| config.projects_dir.join(encode_cwd_path(&sf.cwd)));
+
+        // Collect subagents before deriving the parent status so asynchronous
+        // Agent work keeps the parent active after its tool_result has returned.
+        let subagents_dir = project_dir.join(&sf.session_id).join("subagents");
+        let subagents = Self::collect_subagents(&subagents_dir);
+        let has_working_subagent = subagents.iter().any(|agent| agent.status == "working");
+
         // Status is best-effort. Signals we trust:
         //   1. Active descendant CPU → tool is running.
         //   2. current_task non-empty → latest assistant turn left a
         //      tool_use unanswered. Catches I/O-bound tools (Read, Edit)
         //      whose descendants stay under 5% CPU, so the CPU heuristic
         //      alone would flicker to Waiting while the tool runs.
-        //   3. last_user_ts_ms > 0 → trailing transcript line is a real
+        //   3. A working subagent → an async Agent call is still running even
+        //      though its tool_result has already returned to the parent.
+        //   4. last_user_ts_ms > 0 → trailing transcript line is a real
         //      user prompt with no assistant reply yet, so the model is
         //      generating. tool_result wrappers are skipped at the
         //      parser level so this only fires for actual prompts.
@@ -562,7 +577,7 @@ impl ClaudeCollector {
             // between CPU samples, so has_active_descendant alone misses them.
             let pending_tool = !cached.current_task.is_empty();
             let model_generating = cached.last_user_ts_ms > 0;
-            if has_active_descendant || pending_tool {
+            if has_active_descendant || pending_tool || has_working_subagent {
                 SessionStatus::Executing
             } else if model_generating {
                 SessionStatus::Thinking
@@ -616,17 +631,6 @@ impl ClaudeCollector {
         // Git stats: populated by MultiCollector on slow ticks
         let (git_added, git_modified) = (0, 0);
 
-        // Derive the project directory from the transcript path (handles worktree sessions),
-        // falling back to the encoded cwd.
-        let project_dir = transcript_path
-            .as_ref()
-            .and_then(|tp| tp.parent().map(|p| p.to_path_buf()))
-            .unwrap_or_else(|| config.projects_dir.join(encode_cwd_path(&sf.cwd)));
-
-        // Subagent discovery
-        let subagents_dir = project_dir.join(&sf.session_id).join("subagents");
-        let subagents = Self::collect_subagents(&subagents_dir);
-
         // Memory status
         let memory_dir = project_dir.join("memory");
         let (mem_file_count, mem_line_count) = Self::collect_memory_status(&memory_dir);
@@ -3569,6 +3573,79 @@ n/Users/bob/.claude-alt/projects/-Users-bob-project/session.jsonl
         );
     }
 
+    #[test]
+    fn test_load_session_working_async_subagent_is_executing() {
+        // Regression for #156: an async Agent tool returns immediately, so the
+        // parent has no pending tool while its subagent keeps working. The
+        // working subagent must keep the parent Executing instead of Waiting.
+        let temp = tempfile::tempdir().unwrap();
+        let profile = temp.path().join(".claude");
+        let sessions_dir = profile.join("sessions");
+        let projects = profile.join("projects");
+        let cwd = temp.path().join("repo");
+        std::fs::create_dir_all(&sessions_dir).unwrap();
+        std::fs::create_dir_all(&projects).unwrap();
+        std::fs::create_dir_all(&cwd).unwrap();
+
+        le
```

#### Recent Merged Pull Requests:
- **PR #175** (2026-09-14): feat: distinguish Claude Desktop App / IDE / CLI sessions (@ntung)
- **PR #174** (2026-09-10): fix: remove outdated Claude peak-hours warning (@graykode)
- **PR #171** (closed): chore: ignore .boss-skills directory (@bossjones)
- **PR #170** (2026-09-14): fix(codex): parse the new rollout schema (item_completed) from Codex ≥ ~0.149 (@DaeYounLee)
- **PR #166** (closed): feat: harden agent monitoring and add multi-provider quotas (@lchojnowski)
- **PR #164** (closed): feat: add Herdr terminal jump support (@lchojnowski)
- **PR #163** (closed): feat: add auditable multi-agent lifecycle monitoring (@lchojnowski)
- **PR #161** (2026-09-14): fix(codex): track code-mode status lifecycle (@kouyichi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
