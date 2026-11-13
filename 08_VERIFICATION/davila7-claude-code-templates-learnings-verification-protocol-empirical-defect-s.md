# Verification Protocol: Verification Protocol: Empirical Defect Shield for davila7-claude-code-templates-learnings

<!-- PROVENANCE_START
{
  "source_repository": "davila7-claude-code-templates-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:34:54.430Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-davila7-claude-code-templates-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [davila7-claude-code-templates-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:34:54.430Z`  
> **Learning ID**: `LEARN-REEXTRACT-davila7-claude-code-templates-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `davila7-claude-code-templates-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/davila7-claude-code-templates-learnings.md`  
> **Source**: github ([https://github.com/davila7/claude-code-templates](https://github.com/davila7/claude-code-templates))  
> **Source Version**: `3b2daa1a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T21:40:02.935Z  
> **Learning ID**: `learn-github-davila7-claude-code-templates`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): davila7/claude-code-templates

> **Canonical Artifact**: `07_PROJECT_LEARNING/davila7-claude-code-templates-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/davila7/claude-code-templates](https://github.com/davila7/claude-code-templates))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-05T21:40:01.719Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `davila7/claude-code-templates`
- **Description**: Open-source registry and CLI for Claude Code components: agents, commands, skills, hooks, MCPs, settings and mods
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 33145 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/telegram-pr-webhook.py`
```
#!/usr/bin/env python3
"""
Telegram PR Webhook Hook
Sends a Telegram notification when a new PR is created via `gh pr create`.
Includes the PR URL and the Vercel preview URL.

Required environment variables:
  TELEGRAM_BOT_TOKEN  - Bot token from @BotFather
  TELEGRAM_CHAT_ID    - Chat ID for notifications

Optional environment variables:
  VERCEL_PROJECT_NAME - Vercel project name (for preview URL)
  VERCEL_TEAM_SLUG    - Vercel team slug (for preview URL)
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.parse


def get_input():
    try:
        return json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}


def extract_pr_url(text):
    """Extract GitHub PR URL from command output."""
    match = re.search(r"https://github\.com/[^\s]+/pull/\d+", text)
    return match.group(0) if match else None


def get_branch_name():
    """Get the current git branch name."""
    try:
        return subprocess.check_output(
            ["git", "branch", "--show-current"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        return None


def build_vercel_preview_url(branch):
    """Build Vercel preview URL from branch name and env vars."""
    project = os.environ.get("VERCEL_PROJECT_NAME", "")
    team = os.environ.get("VERCEL_TEAM_SLUG", "")

    if not project or not team:
        return None

    # Vercel slugifies branch names: lowercase, replace non-alphanumeric with -
    slug = re.sub(r"[^a-z0-9]+", "-", branch.lower()).strip("-")
    return f"https://{project}-git-{slug}-{team}.vercel.app"


def send_telegram(message):
    """Send a message via Telegram Bot API."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        print(
            "Telegram notification skipped: "
            "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID",
            file=sys.stderr,
        )
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
    ).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=data, method="POST")
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f"Failed to send Telegram notification: {e}", file=sys.stderr)
        return False


def main():
    input_data = get_input()

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    # Only act on gh pr create commands
    if tool_name != "Bash" or "gh pr create" not in command:
        sys.exit(0)

    # Extract PR URL from tool response
    tool_response = input_data.get("tool_response", "")
    if isinstance(tool_response, dict):
        tool_response = tool_response.get("stdout", "") or json.dumps(tool_response)

    pr_url = extract_pr_url(str(tool_response))
    if not pr_url:
        # No PR URL found — the command may have failed
        sys.exit(0)

    # Build Vercel preview URL
    branch = get_branch_name()
    vercel_url = build_vercel_preview_url(branch) if branch else None

    # Compose Telegram message
    lines = [
        "<b>New Pull Request Created</b>",
        "",
        f"<b>PR:</b> <a href=\"{pr_url}\">{pr_url}</a>",
    ]

    if vercel_url:
        lines.append(f"<b>Preview:</b> <a href=\"{vercel_url}\">{vercel_url}</a>")
    else:
        lines.append(
            "<b>Preview:</b> Check the PR checks tab for the Vercel deployment URL"
        )

    if branch:
        lines.append(f"<b>Branch:</b> <code>{branch}</code>")

    message = "\n".join(lines)
    send_telegram(message)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `cli-rust/src/util/fs_ext.rs`
```
//! Filesystem helpers that reproduce the byte-level behavior of the Node CLI's
//! `fs-extra` usage (`ensureDir`, `readJson`, `writeJson({spaces:2})`, `chmod`).

use anyhow::{Context, Result};
use serde_json::Value;
use std::fs;
use std::path::Path;

/// Equivalent of `fs.ensureDir` — create a directory and all parents.
pub fn ensure_dir(dir: &Path) -> Result<()> {
    fs::create_dir_all(dir).with_context(|| format!("failed to create directory {}", dir.display()))
}

/// Equivalent of `fs.readJson` — read + parse a JSON file into a `Value`.
pub fn read_json(path: &Path) -> Result<Value> {
    let text =
        fs::read_to_string(path).with_context(|| format!("failed to read {}", path.display()))?;
    let value = serde_json::from_str(&text)
        .with_context(|| format!("failed to parse JSON {}", path.display()))?;
    Ok(value)
}

/// Equivalent of `fs.writeJson(path, value, {spaces: 2})`.
///
/// `serde_json::to_string_pretty` uses a 2-space indent, matching Node's
/// `{spaces: 2}`. `fs-extra`/`jsonfile` appends a trailing newline by default
/// (`finalEOL: true`), so we append one too for byte parity.
pub fn write_json_pretty(path: &Path, value: &Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    let mut text = serde_json::to_string_pretty(value).context("failed to serialize JSON")?;
    text.push('\n');
    fs::write(path, text).with_context(|| format!("failed to write {}", path.display()))?;
    Ok(())
}

/// Write a text file (UTF-8), creating parent directories. Optionally mark it
/// executable (`chmod 0o755`) on Unix; a no-op on Windows.
pub fn write_file(path: &Path, content: &str, executable: bool) -> Result<()> {
    if let Some(parent) = path.parent() {
        ensure_dir(parent)?;
    }
    fs::write(path, content).with_context(|| format!("failed to write {}", path.display()))?;
    if executable {
        make_executable(path)?;
    }
    Ok(())
}

/// `chmod 0o755` on Unix; no-op elsewhere.
#[cfg(unix)]
pub fn make_executable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(path)
        .with_context(|| format!("failed to stat {}", path.display()))?
        .permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms)
        .with_context(|| format!("failed to chmod {}", path.display()))?;
    Ok(())
}

#[cfg(not(unix))]
pub fn make_executable(_path: &Path) -> Result<()> {
    Ok(())
}

```

### Core Architecture Module: `cli-rust/src/util/mod.rs`
```
//! Small filesystem + path helpers shared across commands.

pub mod fs_ext;
pub mod paths;

```

### Core Architecture Module: `cli-rust/src/util/paths.rs`
```
//! Path resolution helpers: home dir, settings-location mapping, enterprise
//! managed-settings directories, and relative-path computation for tracking.

use directories::UserDirs;
use std::path::{Path, PathBuf};

/// Resolve the user's home directory (equivalent to `os.homedir()`).
pub fn home_dir() -> PathBuf {
    UserDirs::new()
        .map(|d| d.home_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

/// A resolved install location for a setting/hook: the directory the settings
/// file lives in and the filename. Mirrors the branching in
/// `installIndividualSetting` / `installIndividualHook`.
pub struct ResolvedLocation {
    /// Base dir the additional files resolve against (`currentTargetDir`).
    pub current_target_dir: PathBuf,
    /// Absolute path of the settings JSON file to merge into.
    pub settings_file: PathBuf,
}

/// Map a location keyword (`user`/`project`/`local`/`enterprise`) to concrete
/// paths, given the project `target_dir`. Returns `None` for unsupported
/// enterprise platforms (Node falls back to user settings in that case — the
/// caller handles the fallback).
pub fn resolve_location(location: &str, target_dir: &Path) -> ResolvedLocation {
    match location {
        "user" => {
            let dir = home_dir();
            ResolvedLocation {
                settings_file: dir.join(".claude").join("settings.json"),
                current_target_dir: dir,
            }
        }
        "project" => ResolvedLocation {
            current_target_dir: target_dir.to_path_buf(),
            settings_file: target_dir.join(".claude").join("settings.json"),
        },
        "enterprise" => {
            if let Some(dir) = enterprise_dir() {
                let file = dir.join("managed-settings.json");
                ResolvedLocation {
                    current_target_dir: dir,
                    settings_file: file,
                }
            } else {
                // Fallback to user settings (matches Node's else branch).
                let dir = home_dir();
                ResolvedLocation {
                    settings_file: dir.join(".claude").join("settings.json"),
                    current_target_dir: dir,
                }
            }
        }
        // "local" and any unknown value default to local settings.
        _ => ResolvedLocation {
            current_target_dir: target_dir.to_path_buf(),
            settings_file: target_dir.join(".claude").join("settings.local.json"),
        },
    }
}

/// Enterprise managed-settings directory per platform.
/// macOS: `/Library/Application Support/ClaudeCode`
/// Linux/WSL: `/etc/claude-code`
/// Windows: `C:\ProgramData\ClaudeCode`
fn enterprise_dir() -> Option<PathBuf> {
    if cfg!(target_os = "macos") {
        Some(PathBuf::from("/Library/Application Support/ClaudeCode"))
    } else if cfg!(target_os = "linux") {
        Some(PathBuf::from("/etc/claude-code"))
    } else if cfg!(target_os = "windows") {
        Some(PathBuf::from("C:\\ProgramData\\ClaudeCode"))
    } else {
        None
    }
}

/// Resolve an "additional file" path the way Node does: a leading `~` expands
/// to the home directory, otherwise it resolves against `current_target_dir`.
pub fn resolve_additional_file(file_path: &str, current_target_dir: &Path) -> PathBuf {
    if let Some(rest) = file_path.strip_prefix('~') {
        // `path.join(homedir(), filePath.slice(1))` — strip the `~`, keep rest.
        let rest = rest.strip_prefix('/').unwrap_or(rest);
        home_dir().join(rest)
    } else {
        current_target_dir.join(file_path)
    }
}

/// Best-effort equivalent of `path.relative(from, to)` for tracking metadata.
pub fn relative_path(from: &Path, to: &Path) -> String {
    pathdiff::diff_paths(to, from)
        .unwrap_or_else(|| to.to_path_buf())
        .to_string_lossy()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn local_location_uses_settings_local_json() {
        let target = PathBuf::from("/tmp/proj");
        let r = resolve_location("local", &target);
        assert_eq!(r.settings_file, target.join(".claude/settings.local.json"));
        assert_eq!(r.current_target_dir, target);
    }

    #[test]
    fn project_location_uses_settings_json() {
        let target = PathBuf::from("/tmp/proj");
        let r = resolve_location("project", &target);
        assert_eq!(r.settings_file, target.join(".claude/settings.json"));
    }

    #[test]
    fn user_location_resolves_under_home() {
        let r = resolve_location("user", Path::new("/tmp/proj"));
        assert_eq!(r.settings_file, home_dir().join(".claude/settings.json"));
        assert_eq!(r.current_target_dir, home_dir());
    }

    #[test]
    fn additional_file_expands_tilde_to_home() {
        let resolved = resolve_additional_file("~/.claude/x.py", Path::new("/tmp/proj"));
        assert_eq!(resolved, home_dir().join(".claude/x.py"));
    }

    #[test]
    fn additional_file_resolves_relative_against_target() {
        let resolved = resolve_additional_file(".claude/scripts/s.py", Path::new("/tmp/proj"));
        assert_eq!(resolved, PathBuf::from("/tmp/proj/.claude/scripts/s.py"));
    }

    #[test]
    fn relative_path_computes_dotdot() {
        let rel = relative_path(Path::new("/a/b"), Path::new("/a/c/d"));
        assert_eq!(rel, "../c/d");
    }
}

```

### Core Architecture Module: `cli-tool/analytics-ui/public/services/StateService.js`
```
/**
 * StateService - Manages application state and state changes
 * Part of the modular frontend architecture
 */
class StateService {
  constructor() {
    this.state = {
      conversations: [],
      summary: {},
      chartData: {},
      selectedConversation: null,
      conversationStates: {},
      systemHealth: {},
      isLoading: false,
      error: null,
      lastUpdate: null
    };
    
    this.subscribers = new Set();
    this.stateHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Callback to call on state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get specific state property
   * @param {string} key - State property key
   * @returns {*} State property value
   */
  getStateProperty(key) {
    return this.state[key];
  }

  /**
   * Update state and notify subscribers
   * @param {Object} newState - New state object
   * @param {string} action - Action that caused the state change
   */
  setState(newState, action = 'setState') {
    // Save current state to history
    this.saveStateToHistory(action);

    // Update state
    this.state = {
      ...this.state,
      ...newState,
      lastUpdate: Date.now()
    };

    // Notify all subscribers
    this.notifySubscribers(action, newState);
  }

  /**
   * Update specific state property
   * @param {string} key - State property key
   * @param {*} value - New value
   * @param {string} action - Action that caused the change
   */
  setStateProperty(key, value, action = `set_${key}`) {
    this.setState({ [key]: value }, action);
  }

  /**
   * Save current state to history
   * @param {string} action - Action that caused the state change
   */
  saveStateToHistory(action) {
    this.stateHistory.push({
      state: { ...this.state },
      action,
      timestamp: Date.now()
    });

    // Keep history size manageable
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  /**
   * Notify all subscribers of state changes
   * @param {string} action - Action that caused the change
   * @param {Object} changedState - The state that changed
   */
  notifySubscribers(action, changedState) {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state, action, changedState);
      } catch (error) {
        console.error('Error in StateService subscriber:', error);
      }
    });
  }
  
  /**
   * Notify listeners with specific action and data (alias for real-time events)
   * @param {string} action - Action type
   * @param {Object} data - Event data
   */
  notifyListeners(action, data) {
    this.notifySubscribers(action, data);
  }

  /**
   * Update conversations data
   * @param {Array} conversations - New conversations data
   */
  updateConversations(conversations) {
    this.setState({ conversations }, 'update_conversations');
  }

  /**
   * Update conversation states for real-time updates
   * @param {Object} states - New conversation states
   */
  updateConversationStates(states) {
    this.setState({ conversationStates: states }, 'update_conversation_states');
  }

  /**
   * Update summary statistics
   * @param {Object} summary - New summary data
   */
  updateSummary(summary) {
    this.setState({ summary }, 'update_summary');
  }

  /**
   * Update chart data
   * @param {Object} chartData - New chart data
   */
  updateChartData(chartData) {
    this.setState({ chartData }, 'update_chart_data');
  }

  /**
   * Set selected conversation
   * @param {Object} conversation - Selected conversation
   */
  setSelectedConversation(conversation) {
    this.setState({ selectedConversation: conversation }, 'select_conversation');
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    this.setState({ isLoading }, 'set_loading');
  }

  /**
   * Set error state
   * @param {Error|string} error - Error object or message
   */
  setError(error) {
    this.setState({ error }, 'set_error');
  }

  /**
   * Clear error state
   */
  clearError() {
    this.setState({ error: null }, 'clear_error');
  }

  /**
   * Update system health
   * @param {Object} health - System health data
   */
  updateSystemHealth(health) {
    this.setState({ systemHealth: health }, 'update_system_health');
  }

  /**
   * Handle conversation state change notification
   * @param {string} conversationId - ID of the conversation that changed
   * @param {string} newState - New state of the conversation
   */
  notifyConversationStateChange(conversationId, newState) {
    const currentStates = { ...this.state.conversationStates };
    currentStates[conversationId] = newState;
    
    this.setState({ conversationStates: currentStates }, 'conversation_state_change');
    
    // Also update the conversation in the conversations array
    const updatedConversations = this.state.conversations.map(conv => 
      conv.id === conversationId ? { ...conv, status: newState } : conv
    );
    
    this.setState({ conversations: updatedConversations }, 'update_conversation_status');
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Object|null} Conversation object or null if not found
   */
  getConversationById(conversationId) {
    return this.state.conversations.find(conv => conv.id === conversationId) || null;
  }

  /**
   * Get conversations by status
   * @param {string} status - Conversation status
   * @returns {Array} Array of conversations with specified status
   */
  getConversationsByStatus(status) {
    return this.state.conversations.filter(conv => conv.status === status);
  }

  /**
   * Get state history
   * @returns {Array} State history
   */
  getStateHistory() {
    return [...this.stateHistory];
  }

  /**
   * Clear state history
   */
  clearStateHistory() {
    this.stateHistory = [];
  }

  /**
   * Reset state to initial values
   */
  resetState() {
    this.setState({
      conversations: [],
      summary: {},
      chartData: {},
      selectedConversation: null,
      conversationStates: {},
      systemHealth: {},
      isLoading: false,
      error: null,
      lastUpdate: null
    }, 'reset_state');
  }

  /**
   * Get state statistics
   * @returns {Object} State statistics
   */
  getStateStats() {
    return {
      subscribers: this.subscribers.size,
      historySize: this.stateHistory.length,
      conversationsCount: this.state.conversations.length,
      lastUpdate: this.state.lastUpdate,
      hasError: !!this.state.error,
      isLoading: this.state.isLoading
    };
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateService;
}
```

### Core Architecture Module: `cli-tool/components/hooks/automation/change-logger.py`
```
#!/usr/bin/env python3
"""
Change Logger Hook
Logs every file mutation (Edit, Write, Bash) to a CSV file for demo prep and session review.
Output: .claude/critical_log_changes.csv
"""

import csv
import json
import os
import sys
from datetime import datetime

# Read-only commands that should not be logged
READONLY_COMMANDS = {
    "cat", "head", "tail", "less", "more",
    "ls", "dir", "tree", "pwd", "which", "where", "whereis",
    "echo", "printf",
    "grep", "rg", "find", "fd", "ag",
    "git status", "git log", "git diff", "git show", "git branch",
    "git remote", "git stash list", "git tag",
    "node -e", "python -c", "ruby -e",
    "type", "file", "wc", "du", "df",
}

CSV_PATH = ".claude/critical_log_changes.csv"
CSV_HEADERS = ["timestamp", "tool", "file_path", "action", "details"]


def is_readonly_command(command):
    """Check if a bash command is read-only and should be skipped."""
    cmd_stripped = command.strip()
    for ro_cmd in READONLY_COMMANDS:
        if cmd_stripped.startswith(ro_cmd):
            return True
    return False


def log_change(tool_name, file_path, action, details=""):
    """Append a row to the CSV change log."""
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)

    write_header = not os.path.exists(CSV_PATH)

    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        if write_header:
            writer.writerow(CSV_HEADERS)
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            tool_name,
            file_path,
            action,
            details[:200],
        ])


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    if tool_name in ("Edit", "MultiEdit"):
        file_path = tool_input.get("file_path", "unknown")
        log_change(tool_name, file_path, "modified")

    elif tool_name == "Write":
        file_path = tool_input.get("file_path", "unknown")
        log_change(tool_name, file_path, "created")

    elif tool_name == "Bash":
        command = tool_input.get("command", "")
        if command and not is_readonly_command(command):
            log_change(tool_name, "-", "executed", command[:200])

    # Never block tool execution
    sys.exit(0)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `cli-tool/components/hooks/automation/plan-mode-game/server.js`
```
#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3456;
const PID_FILE = path.join(__dirname, 'server.pid');
const SECRET_FILE = path.join(__dirname, '.secret');
const sseClients = new Set();

function getSecret() {
  try {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
    return secret;
  }
}

const hmacSecret = getSecret();

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Serve the game
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    fs.readFile(htmlPath, (err, data) => {
      if (err) { res.writeHead(500); return res.end('Error loading game'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // SSE endpoint
  if (req.method === 'GET' && req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Trigger announcement
  if (req.method === 'POST' && req.url === '/done') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      const message = body || 'Claude Termino';
      for (const client of sseClients) {
        client.write(`event: done\ndata: ${message}\n\n`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, clients: sseClients.size }));
    });
    return;
  }

  // Activity feed from hooks
  if (req.method === 'POST' && req.url === '/activity') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
    req.on('end', () => {
      for (const client of sseClients) {
        client.write(`event: activity\ndata: ${body}\n\n`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  // Pause - Claude needs user input
  if (req.method === 'POST' && req.url === '/pause') {
    for (const client of sseClients) {
      client.write(`event: pause\ndata: Claude needs you\n\n`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // Status - check if plan mode is active
  if (req.method === 'GET' && req.url === '/status') {
    const planActive = fs.existsSync(path.join(__dirname, '.plan-active'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ planActive }));
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', clients: sseClients.size }));
  }

  // Share scores - generate signed URL
  if (req.method === 'POST' && req.url === '/share') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      try {
        const { dino, snake, flappy } = JSON.parse(body);
        const payload = { d: dino || 0, s: snake || 0, f: flappy || 0, t: Date.now() };
        const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const sig = crypto.createHmac('sha256', hmacSecret).update(payloadB64).digest('hex').slice(0, 16);
        const token = `${payloadB64}.${sig}`;
        const url = `http://localhost:${PORT}/v/${token}`;
        const text = [
          'Plan Mode Game Scores:',
          `\u{1F995} Dino Runner: ${payload.d} pts`,
          `\u{1F40D} Snake: ${payload.s} pts`,
          `\u{1F426} Flappy Bird: ${payload.f} pts`,
          '',
          `Verify → ${url}`
        ].join('\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ url, text }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
    return;
  }

  // Verify scores - render verification page
  if (req.method === 'GET' && req.url.startsWith('/v/')) {
    const token = req.url.slice(3);
    const dotIdx = token.lastIndexOf('.');
    let valid = false, payload = null;

    if (dotIdx > 0) {
      const payloadB64 = token.slice(0, dotIdx);
      const sig = token.slice(dotIdx + 1);
      const expected = crypto.createHmac('sha256', hmacSecret).update(payloadB64).digest('hex').slice(0, 16);
      valid = sig === expected;
      try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()); } catch { valid = false; }
    }

    const ts = payload && payload.t ? new Date(payload.t).toLocaleString() : 'Unknown';
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${valid ? 'Verified' : 'Invalid'} - Plan Mode Game</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;color:#e5e7eb;font-family:'Courier New',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{text-align:center;max-width:420px;padding:40px;background:#12121f;border:1px solid #2d2d4e;border-radius:16px}
.icon{width:100px;height:100px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:48px}
.icon.valid{background:linear-gradient(135deg,#059669,#10b981);box-shadow:0 0 40px rgba(16,185,129,0.3)}
.icon.invalid{background:linear-gradient(135deg,#dc2626,#ef4444);box-shadow:0 0 40px rgba(239,68,68,0.3)}
h1{font-size:28px;margin-bottom:8px;letter-spacing:1px}
h1.valid{color:#10b981}
h1.invalid{color:#ef4444}
.subtitle{color:#6b7280;font-size:13px;margin-bottom:28px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
td{padding:10px 16px;border-bottom:1px solid #1e1e35;font-size:14px}
tr:last-child td{border-bottom:none}
.game{color:#d1d5db;text-align:left}
.pts{color:#a78bfa;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.meta{color:#4b5563;font-size:11px;letter-spacing:0.5px}
.play-link{display:inline-block;margin-top:20px;color:#a78bfa;text-decoration:none;font-size:13px;letter-spacing:1px;padding:10px 24px;border:1px solid #7c3aed;border-radius:8px;transition:all 0.2s}
.play-link:hover{background:#7c3aed;color:#fff}
</style></head><body><div class="card">
<div class="icon ${valid ? 'valid' : 'invalid'}">${valid ? '✓' : '✗'}</div>
<h1 class="${valid ? 'valid' : 'invalid'}">${valid ? 'VERIFIED' : 'INVALID'}</h1>
<p class="subtitle">${valid ? 'These scores are authentic' : 'This score link has been tampered with'}</p>
${valid && payload ? `<table>
<tr><td class="game">\u{1F995} Dino Runner</td><td class="pts">${payload.d} pts</td></tr>
<tr><td class="game">\u{1F40D} Snake</td><td class="pts">${payload.s} pts</td></tr>
<tr><td class="game">\u{1F426} Flappy Bird</td><td class="pts">${payload.f} pts</td></tr>
</table>
<p class="meta">Shared on ${ts}</p>` : ''}
<a class="play-link" href="/">Play Plan Mode Game</a>
</div></body></html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Handle port conflicts
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use. Exiting.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  fs.writeFileSync(PID_FILE, String(process.pid));
  console.log(`Plan Mode Game server running on http://localhost:${PORT}`);
});

// SSE heartbeat - keeps connections alive and cleans dead clients
setInterval(() => {
  for (const client of sseClients) {
    try { client.write(': heartbeat\n\n'); }
    catch { sseClients.delete(client); }
  }
}, 30000);

// Cleanup on exit
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

function cleanup() {
  try { fs.unlinkSync(PID_FILE); } catch {}
  server.close();
  process.exit(0);
}

```

### Core Architecture Module: `cli-tool/components/hooks/automation/telegram-pr-webhook.py`
```
#!/usr/bin/env python3
"""
Telegram PR Webhook Hook
Sends a Telegram notification when a new PR is created via `gh pr create`.
Includes the PR URL and the Vercel preview URL.

Required environment variables:
  TELEGRAM_BOT_TOKEN  - Bot token from @BotFather
  TELEGRAM_CHAT_ID    - Chat ID for notifications

Optional environment variables:
  VERCEL_PROJECT_NAME - Vercel project name (for preview URL)
  VERCEL_TEAM_SLUG    - Vercel team slug (for preview URL)
"""

import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.parse


def get_input():
    try:
        return json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return {}


def extract_pr_url(text):
    """Extract GitHub PR URL from command output."""
    match = re.search(r"https://github\.com/[^\s]+/pull/\d+", text)
    return match.group(0) if match else None


def get_branch_name():
    """Get the current git branch name."""
    try:
        return subprocess.check_output(
            ["git", "branch", "--show-current"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        return None


def build_vercel_preview_url(branch):
    """Build Vercel preview URL from branch name and env vars."""
    project = os.environ.get("VERCEL_PROJECT_NAME", "")
    team = os.environ.get("VERCEL_TEAM_SLUG", "")

    if not project or not team:
        return None

    # Vercel slugifies branch names: lowercase, replace non-alphanumeric with -
    slug = re.sub(r"[^a-z0-9]+", "-", branch.lower()).strip("-")
    return f"https://{project}-git-{slug}-{team}.vercel.app"


def send_telegram(message):
    """Send a message via Telegram Bot API."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not token or not chat_id:
        print(
            "Telegram notification skipped: "
            "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID",
            file=sys.stderr,
        )
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": message, "parse_mode": "HTML"}
    ).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=data, method="POST")
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f"Failed to send Telegram notification: {e}", file=sys.stderr)
        return False


def main():
    input_data = get_input()

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    # Only act on gh pr create commands
    if tool_name != "Bash" or "gh pr create" not in command:
        sys.exit(0)

    # Extract PR URL from tool response
    tool_response = input_data.get("tool_response", "")
    if isinstance(tool_response, dict):
        tool_response = tool_response.get("stdout", "") or json.dumps(tool_response)

    pr_url = extract_pr_url(str(tool_response))
    if not pr_url:
        # No PR URL found — the command may have failed
        sys.exit(0)

    # Build Vercel preview URL
    branch = get_branch_name()
    vercel_url = build_vercel_preview_url(branch) if branch else None

    # Compose Telegram message
    lines = [
        "<b>New Pull Request Created</b>",
        "",
        f"<b>PR:</b> <a href=\"{pr_url}\">{pr_url}</a>",
    ]

    if vercel_url:
        lines.append(f"<b>Preview:</b> <a href=\"{vercel_url}\">{vercel_url}</a>")
    else:
        lines.append(
            "<b>Preview:</b> Check the PR checks tab for the Vercel deployment URL"
        )

    if branch:
        lines.append(f"<b>Branch:</b> <code>{branch}</code>")

    message = "\n".join(lines)
    send_telegram(message)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `cli-tool/components/hooks/git/conventional-commits.py`
```
#!/usr/bin/env python3
import json
import sys
import re

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
    sys.exit(1)

tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})
command = tool_input.get("command", "")

# Only validate git commit commands
if tool_name != "Bash" or "git commit" not in command:
    sys.exit(0)

# Extract commit message from -m flag
# Handle both -m "message" and -m 'message' formats
match = re.search(r'git commit.*?-m\s+["\']([^"\']+)["\']', command)
if not match:
    # Also try heredoc format: -m "$(cat <<'EOF' ... EOF)"
    heredoc_match = re.search(r'git commit.*?-m\s+"?\$\(cat\s+<<["\']?EOF["\']?\s*\n(.+?)\nEOF', command, re.DOTALL)
    if heredoc_match:
        commit_msg = heredoc_match.group(1).strip()
    else:
        sys.exit(0)  # Can't extract message, allow it
else:
    commit_msg = match.group(1)

# Check if message follows Conventional Commits format
# Format: type(scope)?: description
# Types: feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert
conventional_pattern = r'^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?:\s.+'

if not re.match(conventional_pattern, commit_msg):
    reason = f"""❌ Invalid commit message format

Your message: {commit_msg}

Commit messages must follow Conventional Commits:
  type(scope): description

Types:
  feat:     New feature
  fix:      Bug fix
  docs:     Documentation changes
  style:    Code style changes (formatting)
  refactor: Code refactoring
  perf:     Performance improvements
  test:     Adding or updating tests
  chore:    Maintenance tasks
  ci:       CI/CD changes
  build:    Build system changes
  revert:   Revert previous commit

Examples:
  ✅ feat: add user authentication
  ✅ feat(auth): implement JWT tokens
  ✅ fix: resolve memory leak in parser
  ✅ fix(api): handle null responses
  ✅ docs: update API documentation

Invalid:
  ❌ Added new feature (no type)
  ❌ feat:add feature (missing space after colon)
  ❌ feature: add login (wrong type, use 'feat')

💡 Tip: Start your message with one of the types above followed by a colon and space."""

    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason
        }
    }
    print(json.dumps(output))
    sys.exit(0)

# Allow the command
sys.exit(0)

```

### Core Architecture Module: `cli-tool/components/hooks/git/prevent-direct-push.py`
```
#!/usr/bin/env python3
import json
import sys
import subprocess

try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
    sys.exit(1)

tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})
command = tool_input.get("command", "")

# Only validate git push commands
if tool_name != "Bash" or "git push" not in command:
    sys.exit(0)

# Get current branch
try:
    current_branch = subprocess.check_output(
        ["git", "branch", "--show-current"],
        stderr=subprocess.DEVNULL,
        text=True
    ).strip()
except:
    current_branch = ""

# Check if pushing to main or develop
push_cmd = command
is_force_push = "--force" in push_cmd or "-f" in push_cmd

# Check if command or current branch targets protected branches
targets_protected = (
    "origin main" in push_cmd or
    "origin develop" in push_cmd or
    current_branch in ["main", "develop"]
)

# Block direct push to main/develop (unless force push which is already dangerous)
if targets_protected and not is_force_push:
    if current_branch in ["main", "develop"] or "origin main" in push_cmd or "origin develop" in push_cmd:
        reason = f"""❌ Direct push to main/develop is not allowed!

Protected branches:
  - main (production)
  - develop (integration)

Git Flow workflow:
  1. Create a feature branch:
     /feature <name>

  2. Make your changes and commit

  3. Push feature branch:
     git push origin feature/<name>

  4. Create pull request:
     gh pr create

  5. After approval, merge with:
     /finish

For releases:
  /release <version> → PR → /finish

For hotfixes:
  /hotfix <name> → PR → /finish

Current branch: {current_branch}

💡 Use feature/release/hotfix branches instead of pushing directly to main/develop."""

        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason
            }
        }
        print(json.dumps(output))
        sys.exit(0)

# Allow the command
sys.exit(0)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #99** (2026-03-26): **getting 404 while using the plugin**
  *Symptoms*: Tried to do setup the playright   /testing-suite:e2e-setup is running… [playwright]    ⎿  Model: sonnet   ⎿  Allowed 4 tools for this command   ⎿  API Error: 404 {"type":"error","error":{"type":"not_found_error","message":"model:        sonnet"},"request_id":"req_011CTy94mk1kwncWHHkXCYdo"}
  **Post-Mortem & Fix Analysis**:
  > I updated the prompt in  .claude/plugins/marketplaces/claude-code-templates/cli-tool/components/commands/testing  and removed the model from the command  Works!
  > #102 

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

### Incident Patch 1: `28425450` (2026-11-03)
**Commit Message**: Improve security scan reporting for fork PRs (#1309)

Fixes #963 by skipping the component security report comment for fork pull requests, where the token is read-only. Add job summaries so fork contributors can see audit counts and top failures without downloading the artifact. Retain same-repository comments and the full report artifact.

Co-authored-by: Neil Aldred <[REDACTED_EMAIL]>
Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `.github/workflows/component-security-validation.yml` (modified, +61/-2)
```diff
@@ -60,8 +60,68 @@ jobs:
           path: cli-tool/security-report.json
           retention-days: 30
 
+      - name: Add report to job summary
+        if: always()
+        uses: actions/github-script@v9
+        with:
+          script: |
+            const fs = require('fs');
+            const reportPath = 'cli-tool/security-report.json';
+
+            if (!fs.existsSync(reportPath)) {
+              core.info('No security report found.');
+              return;
+            }
+
+            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
+            const { passed, failed, warnings, total } = report.summary;
+            const status = failed === 0 ? '✅ PASSED' : '❌ FAILED';
+
+            await core.summary
+              .addHeading(`Security Audit Report: ${status}`)
+              .addTable([
+                [
+                  { data: 'Metric', header: true },
+                  { data: 'Count', header: true },
+                ],
+                ['Total Components', String(total)],
+                ['✅ Passed', String(passed)],
+                ['❌ Failed', String(failed)],
+                ['⚠️ Warnings', String(warnings)],
+              ])
+              .addRaw(`\n[View the full report artifact](https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}).\n`)
+              .write();
+
+            if (failed > 0) {
+              const failedComponents = report.components
+                .filter(component => !component.overall.valid)
+                .sort((a, b) => b.overall.errorCount - a.overall.errorCount);
+              const rows = failedComponents.slice(0, 5).map(component => [
+                component.component.path.split('/').pop().replace(/\.md$/, ''),
+                String(component.overall.errorCount),
+                String(component.overall.warningCount),
+                `${component.overall.score}/100`,
+              ]);
+
+              await core.summary
+                .addHeading('Failed Components (Top 5)', 3)
+                .addTable([
+                  [
+                    { data: 'Component', header: true },
+                    { data: 'Errors', header: true },
+                    { data: 'Warnings', header: true },
+                    { data: 'Score', header: true },
+                  ],
+                  ...rows,
+                ])
+                .addRaw(failedComponents.length > 5
+                  ? `\n_${failedComponents.length - 5} more failed component(s) are included in the report artifact._\n`
+                  : '')
+                .write();
+            }
+
       - name: Comment PR with Results
-        if: github.event_name == 'pull_request' && always()
+        if: github.event_name == 'pull_request' && always() && github.event.pull_request.head.repo.full_name == github.repository
         uses: actions/github-script@v9
         with:
           script: |
@@ -125,4 +185,3 @@ jobs:
               repo: context.repo.repo,
               body: comment
             });
-
```

**File**: `.github/workflows/skill-security-scan.yml` (modified, +64/-15)
```diff
@@ -1,10 +1,11 @@
 name: Skill Security Scan
 
 # Runs SkillSpector (NVIDIA, Apache-2.0) static analysis on skill components
-# changed in a PR. Posts a report comment and blocks the PR if a changed
-# skill scores HIGH/CRITICAL (risk score > 50) and its score rose compared
-# with the merge base (a new skill counts as 0). Skills that already scored
-# that high on main can be edited without being blocked for old findings.
+# changed in a PR. Adds a job summary for every PR and a report comment for
+# same-repository PRs. Blocks the PR if a changed skill scores HIGH/CRITICAL
+# (risk score > 50) and its score rose compared with the merge base (a new
+# skill counts as 0). Skills that already scored that high on main can be
+# edited without being blocked for old findings.
 
 on:
   pull_request:
@@ -68,34 +69,82 @@ jobs:
           sarif_file: skillspector.sarif
           category: skillspector
 
-      - name: Comment PR with results
+      - name: Add report to job summary
         if: always()
         uses: actions/github-script@v9
         with:
           script: |
             const fs = require('fs');
             const reportPath = 'skillspector-report.md';
+
             if (!fs.existsSync(reportPath)) {
               console.log('No SkillSpector report found.');
               return;
             }
+
             const body = fs.readFileSync(reportPath, 'utf8');
+            const summaryLimit = 1024 * 1024;
+            const truncationNotice = '\n\n> Report truncated to fit the 1 MiB GitHub Actions job summary limit. See the workflow artifact for the full report.\n';
+            let summaryBody = body;
+
+            if (Buffer.byteLength(body, 'utf8') > summaryLimit) {
+              const bytes = Buffer.from(body, 'utf8');
+              const prefixLimit = summaryLimit - Buffer.byteLength(truncationNotice, 'utf8');
+              let end = prefixLimit;
+
+              // Back off byte-by-byte so truncation never splits a UTF-8 character.
+              while (end > 0) {
+                try {
+                  summaryBody = new TextDecoder('utf-8', { fatal: true })
+                    .decode(bytes.subarray(0, end));
+                  break;
+                } catch {
+                  end -= 1;
+                }
+              }
+
+              summaryBody += truncationNotice;
+            }
+
+            await core.summary.addRaw(summaryBody).write();
+
+      - name: Comment PR with results
+        if: github.event_name == 'pull_request' && always() && github.event.pull_request.head.repo.full_name == github.repository
+        uses: actions/github-script@v9
+        with:
+          script: |
+            const fs = require('fs');
+            const reportPath = 'skillspector-report.md';
             const marker = '<!-- skillspector-report:v1 -->';
+
+            if (!fs.existsSync(reportPath)) {
+              console.log('No SkillSpector report found.');
+              return;
+            }
+
+            const body = fs.readFileSync(reportPath, 'utf8');
             const { owner, repo } = context.repo;
-            const issue_number = context.issue.number;
-
-            const existing = await github.paginate(
-              github.rest.issues.listComments,
-              { owner, repo, issue_number, per_page: 100 }
-            );
-            const prev = existing.find(c => c.body && c.body.includes(marker));
-            if (prev) {
+            const comments = await github.paginate(github.rest.issues.listComments, {
+              owner,
+              repo,
+              issue_number: context.issue.number,
+              per_page: 100,
+            });
+            const existing = comments.find(comment => comment.body?.includes(marker));
+
+            if (existing) {
               await github.rest.issues.updateComment({
-                owner, repo, comment_id: prev.id, body,
+                owner,
+                repo,
+                comment_id: existing.id,
+                body,
               });
             } else {
               await github.rest.issues.createComment({
-                owner, repo, issue_number, body,
+                owner,
+                repo,
+                issue_number: context.issue.number,
+                body,
               });
             }
 
```

---

### Incident Patch 2: `3b2daa1a` (2026-11-05)
**Commit Message**: chore(community): issue/PR templates, SECURITY response times, CODEOWNERS fix, grouped Dependabot (#1400)

- CODEOWNERS pointed at @danipower; the maintainer's login is @davila7.
- Issue forms (bug report, component idea) and config.yml that sends
  vulnerabilities to private advisories and questions to Discussions.
- PR template with the component checklist and the generated-files rule.
- SECURITY.md: advisories as preferred channel, supported versions,
  response targets (ack 3 business days, triage 7 days, fix 30/90 days).
- Dependabot: group minor+patch per ecosystem, add / and
  cloudflare-workers/*, use the existing "dependencies" label for Actions.
- CONTRIBUTING: skills, mods and loops sections, plus what reviews a PR
  and the triage labels.


Claude-Session: https://claude.ai/code/session_012PXzccciaBMepZz2vGDd4f

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.github/CODEOWNERS` (modified, +5/-5)
```diff
@@ -1,6 +1,6 @@
 # Protect CI/CD and security-sensitive paths
-.github/                @danipower
-scripts/                @danipower
-.npmrc                  @danipower
-CLAUDE.md               @danipower
-dashboard/src/pages/api/ @danipower
+.github/                @davila7
+scripts/                @davila7
+.npmrc                  @davila7
+CLAUDE.md               @davila7
+dashboard/src/pages/api/ @davila7
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+name: Bug report
+description: Something in the CLI, a component or aitmpl.com does not work as described.
+labels: ["bug"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Thanks for reporting. If this is a security vulnerability, stop here and [report it privately](https://github.com/davila7/claude-code-templates/security/advisories/new) instead.
+  - type: dropdown
+    id: area
+    attributes:
+      label: Area
+      options:
+        - CLI (npx claude-code-templates)
+        - A component (agent, command, skill, hook, MCP, setting, mod, loop)
+        - aitmpl.com website
+        - Other
+    validations:
+      required: true
+  - type: input
+    id: component
+    attributes:
+      label: Component path
+      description: For a component bug, its path as shown on aitmpl.com, e.g. `security/secret-redactor`.
+  - type: textarea
+    id: what
+    attributes:
+      label: What happened and what you expected
+    validations:
+      required: true
+  - type: textarea
+    id: repro
+    attributes:
+      label: Steps to reproduce
+      description: The exact command you ran and its output.
+      render: shell
+    validations:
+      required: true
+  - type: input
+    id: cli-version
+    attributes:
+      label: claude-code-templates version
+      description: Output of `npx claude-code-templates@latest --version`.
+    validations:
+      required: true
+  - type: input
+    id: cc-version
+    attributes:
+      label: Claude Code version
+      description: Output of `claude --version`. Required for mods and hooks.
+  - type: input
+    id: os
+    attributes:
+      label: OS and Node.js version
+      placeholder: macOS 15.1, Node 22.11
+    validations:
+      required: true
```

**File**: `.github/ISSUE_TEMPLATE/component_request.yml` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+name: Component idea or improvement
+description: Suggest a new component or an improvement to an existing one.
+labels: ["enhancement"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        If you already built the component, open a pull request instead (see [CONTRIBUTING.md](https://github.com/davila7/claude-code-templates/blob/main/CONTRIBUTING.md)). Paid placements are not requested here: they never change catalog ranking or search.
+  - type: dropdown
+    id: type
+    attributes:
+      label: Component type
+      options: [Agent, Command, Skill, Hook, MCP, Setting, Mod, Loop, Template, Not sure]
+    validations:
+      required: true
+  - type: textarea
+    id: problem
+    attributes:
+      label: What problem it solves
+    validations:
+      required: true
+  - type: textarea
+    id: proposal
+    attributes:
+      label: What it should do
+      description: For an existing component, include its path and what to change.
+    validations:
+      required: true
+  - type: textarea
+    id: access
+    attributes:
+      label: What it needs access to
+      description: Files, commands, network or external services it would use. Components that run code get extra review.
```

**File**: `.github/ISSUE_TEMPLATE/config.yml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+blank_issues_enabled: false
+contact_links:
+  - name: Report a security vulnerability
+    url: https://github.com/davila7/claude-code-templates/security/advisories/new
+    about: Please report vulnerabilities privately. Do not open a public issue (see SECURITY.md).
+  - name: Ask a question
+    url: https://github.com/davila7/claude-code-templates/discussions
+    about: Questions about using the CLI or a component go to Discussions.
```

**File**: `.github/dependabot.yml` (modified, +18/-10)
```diff
@@ -1,25 +1,33 @@
 version: 2
 updates:
+  # Minor and patch bumps arrive grouped (one PR per ecosystem and week);
+  # majors stay one PR each because they usually need code changes.
+  # Security updates are separate and not limited by these groups.
   - package-ecosystem: "npm"
-    directory: "/cli-tool"
-    schedule:
-      interval: "weekly"
-    open-pull-requests-limit: 5
-    labels:
-      - "dependencies"
-
-  - package-ecosystem: "npm"
-    directory: "/dashboard"
+    directories:
+      - "/"
+      - "/cli-tool"
+      - "/dashboard"
+      - "/cloudflare-workers/*"
     schedule:
       interval: "weekly"
     open-pull-requests-limit: 5
     labels:
       - "dependencies"
+    groups:
+      npm-minor-and-patch:
+        update-types:
+          - "minor"
+          - "patch"
 
   - package-ecosystem: "github-actions"
     directory: "/"
     schedule:
       interval: "weekly"
     open-pull-requests-limit: 5
     labels:
-      - "ci"
+      - "dependencies"
+    groups:
+      actions:
+        patterns:
+          - "*"
```

**File**: `.github/pull_request_template.md` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+## What this PR does
+
+<!-- One or two sentences. Link the issue it closes, if any (Closes #123). -->
+
+## Type
+
+- [ ] New component
+- [ ] Change to an existing component
+- [ ] CLI (`cli-tool/src`, `cli-tool/bin`)
+- [ ] Website (`dashboard/`)
+- [ ] Docs or other
+
+## Checklist for components
+
+- [ ] Files are under `cli-tool/components/{type}/{category}/` with a kebab-case name
+- [ ] Frontmatter has `name` and a specific `description` (for skills, `name` matches the folder)
+- [ ] No API keys, tokens or absolute paths; secrets are read from environment variables
+- [ ] If it runs code (hook script, MCP, mod), the README or description says what it runs and what it accesses
+- [ ] I did **not** commit `docs/components.json` or `dashboard/public/` (they are regenerated after merge)
+
+## How I tested it
+
+<!-- The command you ran, e.g. npx claude-code-templates@latest --skill category/name --dry-run, and what you saw. -->
```

**File**: `CONTRIBUTING.md` (modified, +37/-1)
```diff
@@ -6,7 +6,14 @@ We welcome contributions! Help us make Claude Code even better for everyone.
 
 ## 🧩 Contributing Components
 
-The easiest way to contribute is by adding individual components like agents, commands, MCPs, settings, or hooks.
+The easiest way to contribute is by adding individual components: agents, commands, skills, MCPs, settings, hooks, mods or loops.
+
+### ✅ Before you open a pull request
+
+- **Only commit your component.** Do not run `scripts/generate_components_json.py` and do not commit `docs/components.json` or anything under `dashboard/public/`. Those files are regenerated automatically after merge, and a PR that touches them fails the `generated-files-guard` check.
+- **One component (or one small set of related components) per PR.** Large PRs and PRs that mix unrelated components take much longer to review.
+- **What reviews your PR:** automated checks run Claude Code's own validator (`claude plugin validate`), [NVIDIA SkillSpector](https://github.com/NVIDIA/skillspector) security scanning and AI code review. A maintainer or the daily triage then labels it `triage:accept`, `triage:changes` (see the comment for what to fix), `triage:human` (needs a maintainer's manual review: hooks with scripts, mods, anything that runs code or sends data off the machine) or `triage:reject` (with the reason).
+- **Paid placements never apply here.** Sponsoring a component on aitmpl.com does not change review, ranking or search.
 
 ### 🤖 Adding Agents
 
@@ -227,6 +234,35 @@ Hooks provide automation triggers for different development events.
    touch your-hook-name.json
    ```
 
+### 🧠 Adding Skills
+
+Skills are folders under `cli-tool/components/skills/{category}/{name}/` with a `SKILL.md` (YAML frontmatter with `name` and `description`) and any supporting files.
+
+- `name` in the frontmatter must match the folder name (kebab-case).
+- The `description` says what the skill does **and when Claude should use it**.
+- Do not put skills under `.claude-plugin/` or `.claude/skills/`: those paths are not part of the catalog.
+- Every changed skill is scanned by SkillSpector; a HIGH or CRITICAL score blocks the PR.
+- A skill whose code lives in your own repository can be listed with a `source.json` pinned to a commit instead of copying it (see "External skills" in [CLAUDE.md](CLAUDE.md)).
+
+Test it with `npx claude-code-templates@latest --skill {category}/{name} --dry-run`.
+
+### 🧩 Adding Mods
+
+Mods (Claude Mods) are plugin directories under `cli-tool/components/mods/{category}/{name}/`: `.claude-plugin/plugin.json`, `hooks/hooks.json`, the hooks modules under `hooks/`, a `README.md`, and optionally `commands/`, `types/` and `tests/`. Before opening the PR:
+
+```bash
+cd cli-tool/components/mods
+npx -y -p typescript@5 tsc -p tsconfig.json          # must typecheck against types/claude-code.d.ts
+claude plugin validate {category}/{name}
+claude plugin test {category}/{name}                 # if the mod ships tests
+```
+
+The README must state the command, the options and the minimum Claude Code version. Mods always get a maintainer's manual review because they run inside Claude Code.
+
+### 🔁 Adding Loops
+
+Loops are autonomous workflows (goal + interval + stop condition) under `cli-tool/components/loops/{category}/{name}.md`. They may reference other catalog components, which are installed with the loop, so every referenced component must already exist in the catalog.
+
 ## 📦 Contributing Templates
 
 Templates are complete project configurations that include CLAUDE.md, .claude/* files, and .mcp.json.
```

**File**: `SECURITY.md` (modified, +24/-2)
```diff
@@ -12,11 +12,33 @@ The security of our CLI tool and the templates it generates is our top priority.
 
 If you discover a security vulnerability in Claude Code Templates, please report it to us in one of the following ways:
 
+### GitHub Security Advisories (preferred)
+Use [Report a vulnerability](https://github.com/davila7/claude-code-templates/security/advisories/new). It keeps the report private, lets us work on the fix with you in a private fork, and gives you credit when the advisory is published.
+
 ### Email
 Send details of the vulnerability to [dan.avila7@gmail.com](mailto:dan.avila7@gmail.com) with the subject line "SECURITY: Claude Code Templates Vulnerability Report"
 
-### GitHub Security Advisories
-You can also report vulnerabilities through [GitHub Security Advisories](https://github.com/davila7/claude-code-templates/security/advisories/new) for this repository.
+Please do not open a public issue, pull request or discussion for a vulnerability.
+
+## Supported Versions
+
+Only the latest minor release of the `claude-code-templates` npm package receives security fixes. Fixes ship as a new release, and `npx claude-code-templates@latest` always runs it. Components in the catalog are fixed in place on `main`; reinstall a component to get the fixed version.
+
+| Version | Supported |
+|---------|-----------|
+| Latest minor (see [npm](https://www.npmjs.com/package/claude-code-templates)) | Yes |
+| Older releases | No |
+
+## What Happens After You Report
+
+| Step | Target |
+|------|--------|
+| Acknowledge the report | 3 business days |
+| Triage: confirm, ask for details, or explain why it is not a vulnerability | 7 days |
+| Fix released, or a plan with a date shared with you | 30 days (90 days at most for complex issues) |
+| Advisory published with a CVE and credit to you | When the fixed release is on npm |
+
+We keep the report private until the fix is released. If we miss one of these targets, you are welcome to send a reminder by email. Duplicates of an already reported issue are credited to the first reporter.
 
 ## What to Include in Your Report
 
```

---

### Incident Patch 3: `6ee961d7` (2026-11-04)
**Commit Message**: feat(skills): cloudflare/security-audit-skill as an external skill (#1393)

* feat(skills): add Cloudflare security-audit as an external skill

Pinned to cloudflare/security-audit-skill@c1c8a8c (MIT). Folder is
security/cloudflare-security-audit because security/security-audit is
already taken by an existing skill.

Anchor the cloudflare-*/ ignore rule to the repo root: it was meant for
sandbox output folders and silently ignored any component folder whose
name starts with cloudflare-.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012PXzcY9B179Z9u3M3fP8z1

* feat(skills): pin Cloudflare security-audit files, regenerate catalog

Ship only the files the skill uses (include drops the *.test.cjs dev tests)
and regenerate the catalog with --skip-downloads.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012PXzcY9B179Z9u3M3fP8z1

---------

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ coverage
 
 # Sandbox output directories
 sandbox-*/
-cloudflare-*/
+/cloudflare-*/
 !cloudflare-workers/
 
 # Test directories (local only)
```

**File**: `cli-tool/components/skills/security/cloudflare-security-audit/source.json` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+{
+  "repo": "cloudflare/security-audit-skill",
+  "path": "skills/security-audit",
+  "commit": "c1c8a8c1471069fb0e188eeaff69b8e8db6564a8",
+  "license": "MIT",
+  "author": "Cloudflare",
+  "include": [
+    "AI-AND-LLM.md",
+    "ATTACK-CLASSES.md",
+    "CLIENT-SIDE.md",
+    "CLOUD-AND-DEPLOYMENT.md",
+    "DATA-ISOLATION-AND-LIFECYCLE.md",
+    "DESKTOP-MOBILE-AND-LOCAL-IPC.md",
+    "HUNTING.md",
+    "MEMORY-SAFETY-AND-BINARY.md",
+    "PROTOCOLS-RPC-AND-MESSAGING.md",
+    "RECONNAISSANCE.md",
+    "RESOURCE-EXHAUSTION-AND-AVAILABILITY.md",
+    "SKILL.md",
+    "SUPPLY-CHAIN-AND-RELEASE.md",
+    "VALIDATION-AND-REPORTING.md",
+    "WEB-PROTOCOL-AND-AUTH.md",
+    "report-schema.json",
+    "validate-coverage-ledger.cjs",
+    "validate-findings.cjs"
+  ]
+}
```

**File**: `dashboard/public/api/v1/catalog/loops.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"schemaVersion":"1.1.0","generatedAt":"2026-11-04T03:15:33Z","source":"https://github.com/davila7/claude-code-templates","docs":"https://www.aitmpl.com/developers/catalog-api","count":18,"components":[{"id":"loops/engineering/adversarial-review-loop","type":"loops","name":"adversarial-review-loop","category":"engineering","path":"engineering/adversarial-review-loop.md","description":"Has a second, independent model review every change before merge so two different reviewers must agree — code only lands when both clear the bar.","author":null,"repo":null,"version":null,"license":null,"keywords":["code-review","cross-model","quality","loop"],"downloads":8,"install":{"command":"npx claude-code-templates@latest --loop engineering/adversarial-review-loop","args":["--loop","engineering/adversarial-review-loop"]},"urls":{"page":"https://www.aitmpl.com/component/loops/engineering/adversarial-review-loop","source":"https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/loops/engineering/adversarial-review-loop.md","content":"https://www.aitmpl.com/component-content/loops/engineering/adversarial-review-loop.json"},"files":null,"scan":{"tool":"skillspector","toolVersion":"2.12.0","severity":"LOW","score":0,"scannedAt":"2026-10-17T20:36:45Z"},"source":null},{"id":"loops/engineering/anti-spin-build-loop","type":"loops","name":"anti-spin-build-loop","category":"engineering","path":"engineering/anti-spin-build-loop.md","description":"Builds toward a machine-checkable contract with explicit anti-spin guardrails — stops on no progress, repeated approaches, flip-flopping, or a spend budget.","author":null,"repo":null,"version":null,"license":null,"keywords":["reliability","guardrails","budget","loop"],"downloads":5,"install":{"command":"npx claude-code-templates@latest --loop engineering/anti-spin-build-loop","args":["--loop","engineering/anti-spin-build-loop"]},"urls":{"page":"https://www.aitmpl.com/component/loops/engineering/anti-spin-build-loop","source":"https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/loops/engineering/anti-spin-build-loop.md","content":"https://www.aitmpl.com/component-content/loops/engineering/anti-spin-build-loop.json"},"files":null,"scan":{"tool":"skillspector","toolVersion":"2.12.0","severity":"LOW","score":0,"scannedAt":"2026-10-17T20:36:45Z"},"source":null},{"id":"loops/engineering/build-test-fix-loop","type":"loops","name":"build-test-fix-loop","category":"engineering","path":"engineering/build-test-fix-loop.md","description":"Builds the next item on the plan, then runs tests, typecheck and lint, feeding every failure back as the next instruction until the build is green.","author":null,"repo":null,"version":null,"license":null,"keywords":["testing","build","ci","loop"],"downloads":9,"install":{"command":"npx claude-code-templates@latest --loop engineering/build-test-fix-loop","args":["--loop","engineering/build-test-fix-loop"]},"urls":{"page":"https://www.aitmpl.com/component/loops/engineering/build-test-fix-loop","source":"https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/loops/engineering/build-test-fix-loop.md","content":"https://www.aitmpl.com/component-content/loops/engineering/build-test-fix-loop.json"},"files":null,"scan":{"tool":"skillspector","toolVersion":"2.12.0","severity":"LOW","score":0,"scannedAt":"2026-10-17T20:36:45Z"},"source":null},{"id":"loops/engineering/builder-reviewer-loop","type":"loops","name":"builder-reviewer-loop","category":"engineering","path":"engineering/builder-reviewer-loop.md","description":"Passes code between a builder and an independent reviewer subagent until the review has no blocking findings and tests pass.","author":null,"repo":null,"version":null,"license":null,"keywords":["code-review","subagents","quality","loop"],"downloads":6,"install":{"command":"npx claude-code-templates@latest --loop engineering/builder-reviewer-loop","args":["--loop","engineering/builder-reviewer-loop"]},"urls":{"page":"https://www.aitmpl.com/component/loops/engineering/builder-reviewer-loop","source":"https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/loops/engineering/builder-reviewer-loop.md","content":"https://www.aitmpl.com/component-content/loops/engineering/builder-reviewer-loop.json"},"files":null,"scan":{"tool":"skillspector","toolVersion":"2.12.0","severity":"LOW","score":0,"scannedAt":"2026-10-17T20:36:45Z"},"source":null},{"id":"loops/engineering/completion-contract-loop","type":"loops","name":"completion-contract-loop","category":"engineering","path":"engineering/completion-contract-loop.md","description":"Writes a contract of what \"done\" means and what evidence proves each requirement before any work starts, then refuses to claim success without that evidence.","author":null,"repo":null,"version":null,"license":null,"keywords":["goal","verification","definition-of-done","loop"],"downloads":7,"install":{"command":"npx claude-code-templat
```

**File**: `dashboard/public/api/v1/version.json` (modified, +4/-4)
```diff
@@ -1,15 +1,15 @@
 {
   "schemaVersion": "1.1.0",
-  "generatedAt": "2026-11-04T03:15:33Z",
-  "sha256": "659124f96553fc7f1a792a53064a067ae5f7bed81ddd5e4fe84ffaa46b2a6a80",
-  "count": 1939,
+  "generatedAt": "2026-11-04T19:34:07Z",
+  "sha256": "23d3b0d8e4987859df475e51cf2b31dd85a6d0f94f546af628350393dab51ba6",
+  "count": 1940,
   "counts": {
     "agents": 422,
     "commands": 288,
     "mcps": 111,
     "settings": 79,
     "hooks": 63,
-    "skills": 908,
+    "skills": 909,
     "loops": 18,
     "mods": 50
   },
```

**File**: `dashboard/public/counts.json` (modified, +1/-1)
```diff
@@ -1 +1 @@
-{"agents": 422, "commands": 288, "mcps": 111, "settings": 79, "hooks": 63, "sandbox": 11, "skills": 908, "loops": 18, "mods": 50, "templates": 14, "plugins": 0}
\ No newline at end of file
+{"agents": 422, "commands": 288, "mcps": 111, "settings": 79, "hooks": 63, "sandbox": 11, "skills": 909, "loops": 18, "mods": 50, "templates": 14, "plugins": 0}
\ No newline at end of file
```

**File**: `docs/components.json` (modified, +137/-32)
```diff
@@ -77060,6 +77060,111 @@
         "scannedAt": "2026-10-17T20:36:45Z"
       }
     },
+    {
+      "name": "cloudflare-security-audit",
+      "path": "security/cloudflare-security-audit",
+      "category": "security",
+      "type": "skill",
+      "description": "Security guidance and vulnerability review for codebases, APIs, services, CLI tools, libraries, and daemons. Use for security questions, focused reviews, vulnerability research, security audits, or pen tests. Run the complete workflow only for explicit codebase audit or pen-test requests, full/comprehensive/end-to-end reviews, or requested report artifacts.",
+      "author": "Cloudflare",
+      "repo": "https://github.com/cloudflare/security-audit-skill",
+      "version": "",
+      "license": "MIT",
+      "keywords": [],
+      "downloads": 0,
+      "security": {
+        "validated": false,
+        "valid": null,
+        "score": null,
+        "errorCount": 0,
+        "warningCount": 0,
+        "lastValidated": null
+      },
+      "references": [
+        "AI-AND-LLM.md",
+        "ATTACK-CLASSES.md",
+        "CLIENT-SIDE.md",
+        "CLOUD-AND-DEPLOYMENT.md",
+        "DATA-ISOLATION-AND-LIFECYCLE.md",
+        "DESKTOP-MOBILE-AND-LOCAL-IPC.md",
+        "HUNTING.md",
+        "MEMORY-SAFETY-AND-BINARY.md",
+        "PROTOCOLS-RPC-AND-MESSAGING.md",
+        "RECONNAISSANCE.md",
+        "RESOURCE-EXHAUSTION-AND-AVAILABILITY.md",
+        "SUPPLY-CHAIN-AND-RELEASE.md",
+        "VALIDATION-AND-REPORTING.md",
+        "WEB-PROTOCOL-AND-AUTH.md",
+        "report-schema.json",
+        "validate-coverage-ledger.cjs",
+        "validate-findings.cjs"
+      ],
+      "source": {
+        "repo": "cloudflare/security-audit-skill",
+        "path": "skills/security-audit",
+        "commit": "c1c8a8c1471069fb0e188eeaff69b8e8db6564a8",
+        "license": "MIT",
+        "url": "https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit",
+        "requires": []
+      },
+      "skillspector": {
+        "score": 100,
+        "severity": "CRITICAL",
+        "recommendation": "DO_NOT_INSTALL",
+        "issueCount": 12,
+        "analysis": "partial",
+        "findings": [
+          {
+            "id": "AE1",
+            "category": "analysis-evasion",
+            "severity": "HIGH",
+            "title": "Incomplete referenced artifact analysis",
+            "file": "SKILL.md",
+            "line": 48,
+            "count": 5
+          },
+          {
+            "id": "MP3",
+            "category": "Memory Poisoning",
+            "severity": "HIGH",
+            "title": "Memory Manipulation",
+            "file": "AI-AND-LLM.md",
+            "line": 29,
+            "count": 1
+          },
+          {
+            "id": "PE3",
+            "category": "Privilege Escalation",
+            "severity": "HIGH",
+            "title": "Credential Access",
+            "file": "ATTACK-CLASSES.md",
+            "line": 118,
+            "count": 1
+          },
+          {
+            "id": "PE3",
+            "category": "Privilege Escalation",
+            "severity": "HIGH",
+            "title": "Credential Access",
+            "file": "DESKTOP-MOBILE-AND-LOCAL-IPC.md",
+            "line": 15,
+            "count": 1
+          },
+          {
+            "id": "EA2",
+            "category": "Excessive Agency",
+            "severity": "MEDIUM",
+            "title": "Autonomous Decision Making",
+            "file": "SKILL.md",
+            "line": 14,
+            "count": 1
+          }
+        ],
+        "hash": "54c4c1e3782c3b43",
+        "version": "2.12.0",
+        "scannedAt": "2026-11-04T19:33:37Z"
+      }
+    },
     {
       "name": "cra-vulnerability-obligations",
       "path": "security/cra-vulnerability-obligations",
@@ -89297,9 +89402,9 @@
       "description": "Common project template",
       "files": [
         "README.md",
+        "CLAUDE.md",
         ".claude/commands/project-setup.md",
-        ".claude/commands/git-workflow.md",
-        "CLAUDE.md"
+        ".claude/commands/git-workflow.md"
       ],
       "installCommand": "npx claude-code-templates@latest --template=common --yes",
       "downloads": 0
@@ -89313,10 +89418,10 @@
       "language": "python",
       "description": "Django-App with Python",
       "files": [
-        ".claude/commands/admin.md",
-        ".claude/commands/views.md",
+        "CLAUDE.md",
         ".claude/commands/django-model.md",
-        "CLAUDE.md"
+        ".claude/commands/admin.md",
+        ".claude/commands/views.md"
       ],
       "installCommand": "npx claude-code-templates@latest --template=django-app --yes",
       "downloads": 0
@@ -89330,12 +89435,12 @@
       "language": "python",
       "description": "Fastapi-App with Python",
       "files": [
-        ".claude/commands/deployment.md",
+        "CLAUDE.md",
         ".claude/commands/auth.md",
+        ".claude/comma
```

#### Recent Merged Pull Requests:
- **PR #1400** (2026-11-05): chore(community): issue/PR templates, SECURITY response times, CODEOWNERS fix, grouped Dependabot (@davila7)
- **PR #1399** (2026-11-05): dashboard: Supporters page and NVIDIA in the footer (@davila7)
- **PR #1393** (2026-11-04): feat(skills): cloudflare/security-audit-skill as an external skill (@davila7)
- **PR #1381** (2026-11-03): feat(skills): kajisho5/ffmpeg-skill as an external skill (re-land of #1301) (@davila7)
- **PR #1376** (2026-11-03): feat(trending): Agents vs humans tab + CLAUDE.md for the CLI's client signals (@davila7)
- **PR #1372** (2026-11-03): feat(dashboard): load Google Analytics on every page (@davila7)

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

## X. Improve security scan reporting for fork PRs (#1309)

**RULE**:
When implementing operations in `.github/workflows/component-security-validation.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in davila7/claude-code-templates. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `28425450`: Improve security scan reporting for fork PRs (#1309). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/component-security-validation.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
      - name: Add report to job summary
        if: always()
        uses: actions/github-script@v9
        with:
          script: |
            const fs = require('fs');
            const reportPath = 'cli-tool/security-report.json';

            if (!fs.existsSync(reportPath)) {
              core.info('No security report found.');
              return;
            }

            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            const { passed, failed, warnings, total } = report.summary;
            const status = failed === 0 ? '✅ PASSED' : '❌ FAILED';

            await core.summary
              .addHeading(`Security Audit Report: ${status}`)
              .addTable([
                [
                  { data: 'Metric', header: true },
                  { data: 'Count', header: true },
                ],
                ['Total Components', String(total)],
                ['✅ Passed', String(passed)],
                ['❌ Failed', String(failed)],
                ['⚠️ Warnings', String(warnings)],
              ])
              .addRaw(`\n[View the full report artifact](https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${cont
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
        if: github.event_name == 'pull_request' && always()

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `28425450` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
