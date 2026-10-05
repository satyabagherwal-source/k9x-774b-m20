# Forensic Learning Record (Deep Inspection): yohey-w/multi-agent-shogun

> **Canonical Artifact**: `07_PROJECT_LEARNING/yohey-w-multi-agent-shogun-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yohey-w/multi-agent-shogun](https://github.com/yohey-w/multi-agent-shogun))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:22:10.756Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yohey-w/multi-agent-shogun`
- **Description**: Samurai-inspired multi-agent system for Claude Code. Orchestrate parallel AI tasks via tmux with shogun → karo → ashigaru hierarchy.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1424 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.opencode/tools/mark-as-read.ts`
```
import { tool } from "@opencode-ai/plugin";
import {
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const LOCK_RETRY_COUNT = 50;
const LOCK_RETRY_DELAY_MS = 100;

// Dedicated inbox state updater.
// It only flips a processed inbox entry from read:false to read:true.

const AGENT_ID_RE = /^[a-z][a-z0-9_-]*$/;

type InboxBlock = {
  id?: string;
  idLine?: number;
  read?: "true" | "false";
  readLine?: number;
};

function stripYamlScalarQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function resolveInboxPath(worktree: string, agentId: string): string {
  const normalizedAgentId = agentId.trim();
  if (!AGENT_ID_RE.test(normalizedAgentId)) {
    throw new Error(
      `Invalid agentId ${JSON.stringify(agentId)}. Expected a simple inbox name such as karo or ashigaru3.`,
    );
  }

  const inboxRoot = path.resolve(worktree, "queue", "inbox");
  const inboxPath = path.resolve(inboxRoot, `${normalizedAgentId}.yaml`);
  const relativeToInboxRoot = path.relative(inboxRoot, inboxPath);

  if (
    relativeToInboxRoot.startsWith("..") ||
    path.isAbsolute(relativeToInboxRoot)
  ) {
    throw new Error(
      `Refusing to access path outside queue/inbox: ${inboxPath}`,
    );
  }

  return inboxPath;
}

function parseInbox(raw: string): {
  lines: string[];
  newline: string;
  blocks: InboxBlock[];
} {
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);

  const headerIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && trimmed !== "---" && !trimmed.startsWith("#");
  });
  if (
    headerIndex === -1 ||
    !lines[headerIndex].trim().startsWith("messages:")
  ) {
    throw new Error("Inbox YAML must start with a top-level 'messages:' key.");
  }

  const blocks: InboxBlock[] = [];
  let currentBlock: InboxBlock | null = null;

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.startsWith("- ")) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {};
      continue;
    }

    if (!currentBlock) {
      continue;
    }

    const idMatch = line.match(/^  id:\s*(.+)$/);
    if (idMatch) {
      if (currentBlock.id !== undefined) {
        throw new Error(
          "Inbox YAML contains a duplicate id field within one message block.",
        );
      }
      currentBlock.id = stripYamlScalarQuotes(idMatch[1].trim());
      currentBlock.idLine = i;
      continue;
    }

    const readMatch = line.match(/^  read:\s*(true|false)\s*$/);
    if (readMatch) {
      if (currentBlock.read !== undefined) {
        throw new Error(
          "Inbox YAML contains a duplicate read field within one message block.",
        );
      }
      currentBlock.read = readMatch[1] as "true" | "false";
      currentBlock.readLine = i;
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return { lines, newline, blocks };
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(tempPath, contents, "utf8");
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withInboxLock<T>(
  inboxPath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockDir = `${inboxPath}.lock.d`;

  for (let attempt = 0; attempt < LOCK_RETRY_COUNT; attempt += 1) {
    try {
      await mkdir(lockDir);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "EEXIST") {
        throw error;
      }
      await sleep(LOCK_RETRY_DELAY_MS);
      continue;
    }

    try {
      return await operation();
    } finally {
      await rmdir(lockDir).catch(() => {});
    }
  }

  throw new Error(
    `Failed to acquire inbox lock: ${path.relative(process.cwd(), lockDir)}`,
  );
}

function assertCurrentAgent(targetAgentId: string): void {
  const currentAgentId = process.env.OPENCODE_AGENT_ID?.trim();
  if (!currentAgentId) {
    throw new Error(
      "OPENCODE_AGENT_ID is required so mark-as-read can only update the current agent's inbox.",
    );
  }
  if (currentAgentId !== targetAgentId) {
    throw new Error(
      `Refusing to mark another agent's inbox as read: current=${currentAgentId}, target=${targetAgentId}.`,
    );
  }
}

async function markAsRead(
  worktree: string,
  agentId: string,
  messageId: string,
): Promise<{
  inboxPath: string;
  relativeInboxPath: string;
  changed: boolean;
}> {
  const normalizedMessageId = messageId.trim();
  if (!normalizedMessageId) {
    throw new Error("messageId must not be empty.");
  }

  const normalizedAgentId = agentId.trim();
  assertCurrentAgent(normalizedAgentId);

  const inboxPath = resolveInboxPath(worktree, normalizedAgentId);
  return withInboxLock(inboxPath, async () => {
    const raw = await readFile(inboxPath, "utf8");
    const { lines, newline, blocks } = parseInbox(raw);

    const targetBlocks = blocks.filter(
      (block) => block.id === normalizedMessageId,
    );
    if (targetBlocks.length === 0) {
      throw new Error(
        `Message ${JSON.stringify(normalizedMessageId)} was not found in ${path.relative(worktree, inboxPath)}.`,
      );
    }
    if (targetBlocks.length > 1) {
      throw new Error(
        `Inbox YAML contains duplicate message id ${JSON.stringify(normalizedMessageId)}.`,
      );
    }

    const targetBlock = targetBlocks[0];
    if (targetBlock.read === undefined) {
      throw new Error(
        `Message ${JSON.stringify(normalizedMessageId)} in ${path.relative(worktree, inboxPath)} has no read field.`,
      );
    }

    if (targetBlock.read === "true") {
      return {
        inboxPath,
        relativeInboxPath: path
          .relative(worktree, inboxPath)
          .split(path.sep)
          .join("/"),
        changed: false,
      };
    }

    if (targetBlock.readLine === undefined) {
      throw new Error(
        `Message ${JSON.stringify(normalizedMessageId)} in ${path.relative(worktree, inboxPath)} has no read line.`,
      );
    }

    lines[targetBlock.readLine] = "  read: true";
    const updated = lines.join(newline);
    await atomicWrite(
      inboxPath,
      updated.endsWith(newline) ? updated : `${updated}${newline}`,
    );

    return {
      inboxPath,
      relativeInboxPath: path
        .relative(worktree, inboxPath)
        .split(path.sep)
        .join("/"),
      changed: true,
    };
  });
}

export default tool({
  description:
    "Mark one processed inbox entry as read without using the generic Edit tool",
  args: {
    agentId: tool.schema
      .string()
      .trim()
      .regex(
        AGENT_ID_RE,
        "Agent IDs must match an inbox file name such as karo or ashigaru3",
      )
      .describe("Target inbox owner"),
    messageId: tool.schema
      .string()
      .trim()
      .min(1)
      .describe("Inbox message id to mark as read"),
  },
  async execute(args, context) {
    if (!context.worktree) {
      throw new Error(
        "mark-as-read requires context.worktree so it can edit queue/inbox files under the repo root.",
      );
    }

    const result = await markAsRead(
      context.worktree,
      args.agentId,
      args.messageId,
    );
    return result.changed
      ? `Marked ${result.relativeInboxPath} message ${args.messageId} as read.`
      : `Message ${args.messageId} in ${result.relativeInboxPath} was already read.`;
  },
});

```

### Core Architecture Module: `scripts/dashboard-viewer.py`
```
#!/usr/bin/env python3
"""
dashboard-viewer.py

Serves dashboard.md as a browser-viewable page with auto-refresh on file change.
Uses only Python3 standard library. No pip install required.

Usage:
    python3 scripts/dashboard-viewer.py
"""

import http.server
import json
import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

PORT = 8787

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #e6edf3;
      --accent: #58a6ff;
      --code-bg: #1c2128;
      --muted: #8b949e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      height: 100%;
    }
    #app {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px 20px 40px;
    }
    #status-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 4px 12px;
      font-size: 11px;
      color: var(--muted);
      z-index: 100;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #status-bar .dot {
      display: inline-block;
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #3fb950;
      margin-right: 5px;
      vertical-align: middle;
    }
    #status-bar .dot.stale { background: #f85149; }
    #content {
      margin-top: 32px;
    }
    /* Markdown styles */
    #content h1, #content h2, #content h3,
    #content h4, #content h5, #content h6 {
      color: var(--heading);
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
      margin: 20px 0 10px;
    }
    #content h1 { font-size: 1.5em; }
    #content h2 { font-size: 1.25em; }
    #content h3 { font-size: 1.1em; border-bottom: none; }
    #content p { margin: 8px 0; }
    #content ul, #content ol {
      margin: 6px 0 6px 20px;
    }
    #content li { margin: 2px 0; }
    #content code {
      background: var(--code-bg);
      padding: 1px 5px;
      border-radius: 4px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.9em;
    }
    #content pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      margin: 10px 0;
    }
    #content pre code {
      background: none;
      padding: 0;
    }
    #content blockquote {
      border-left: 3px solid var(--border);
      padding-left: 12px;
      color: var(--muted);
      margin: 8px 0;
    }
    #content table {
      border-collapse: collapse;
      width: 100%;
      margin: 10px 0;
      font-size: 0.92em;
    }
    #content th, #content td {
      border: 1px solid var(--border);
      padding: 5px 10px;
      text-align: left;
    }
    #content th {
      background: var(--surface);
      color: var(--heading);
    }
    #content a {
      color: var(--accent);
      text-decoration: none;
    }
    #content a:hover { text-decoration: underline; }
    #content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <div id="status-bar">
    <span><span class="dot" id="dot"></span><span id="status-text">Connecting...</span></span>
    <span id="last-updated"></span>
  </div>
  <div id="app">
    <div id="content"><em>Loading...</em></div>
  </div>
  <script>
    let lastMtime = null;
    const dot = document.getElementById('dot');
    const statusText = document.getElementById('status-text');
    const lastUpdated = document.getElementById('last-updated');
    const contentEl = document.getElementById('content');

    async function fetchMtime() {
      const res = await fetch('/api/mtime');
      const data = await res.json();
      return data.mtime;
    }

    async function fetchDashboard() {
      const res = await fetch('/api/dashboard');
      return await res.text();
    }

    async function render() {
      const md = await fetchDashboard();
      contentEl.innerHTML = marked.parse(md);
    }

    function setStatus(ok, text) {
      dot.className = 'dot' + (ok ? '' : ' stale');
      statusText.textContent = text;
    }

    async function poll() {
      try {
        const mtime = await fetchMtime();
        if (mtime !== lastMtime) {
          lastMtime = mtime;
          await render();
          const d = new Date();
          lastUpdated.textContent = 'Updated ' + d.toLocaleTimeString('ja-JP');
        }
        setStatus(true, 'Live');
      } catch (e) {
        setStatus(false, 'Connection error');
      }
    }

    poll();
    setInterval(poll, 1500);
  </script>
</body>
</html>
"""


def get_repo_root() -> Path:
    """Resolve the git repository root."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        )
        return Path(result.stdout.strip())
    except subprocess.CalledProcessError:
        # Fall back to the directory containing this script's parent
        return Path(__file__).resolve().parent.parent


class DashboardHandler(http.server.BaseHTTPRequestHandler):
    dashboard_path: Path  # set before server starts

    def log_message(self, fmt, *args):
        # Suppress default access log to keep terminal clean
        pass

    def do_GET(self):
        if self.path == "/":
            self._serve_html()
        elif self.path == "/api/dashboard":
            self._serve_markdown()
        elif self.path == "/api/mtime":
            self._serve_mtime()
        else:
            self.send_error(404)

    def _serve_html(self):
        body = HTML_TEMPLATE.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_markdown(self):
        try:
            text = self.dashboard_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            self.send_error(404, "dashboard.md not found")
            return
        body = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_mtime(self):
        try:
            mtime = self.dashboard_path.stat().st_mtime
        except FileNotFoundError:
            self.send_error(404, "dashboard.md not found")
            return
        body = json.dumps({"mtime": mtime}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    repo_root = get_repo_root()
    dashboard_path = repo_root / "dashboard.md"

    if not dashboard_path.exists():
        print(f"Error: dashboard.md not found at {dashboard_path}", file=sys.stderr)
        sys.exit(1)

    # Inject path into handler class
    DashboardHandler.dashboard_path = dashboard_path

    import socket

    try:
        server = http.server.HTTPServer(("127.0.0.1", PORT), DashboardHandler)
    except OSError as e:
        if e.errno == 48 or
```

### Core Architecture Module: `scripts/slim_yaml.py`
```
#!/usr/bin/env python3
"""
YAML Slimming Utility

Removes completed/archived items from YAML queue files to maintain performance.
- For Karo: Archives completed task/report files and finished command queue entries.
- For all agents: Archives read: true messages from inbox files.
"""

import os
import sys
import time
from datetime import datetime
from pathlib import Path

import yaml

CANONICAL_TASKS = {f'ashigaru{i}' for i in range(1, 9)} | {'gunshi'}
CANONICAL_REPORTS = {f'ashigaru{i}_report' for i in range(1, 9)} | {'gunshi_report'}
IDLE_STUB = {'task': {'status': 'idle'}}
TOP_LEVEL_IDLE_STUB = {'status': 'idle'}
TERMINAL_STATUSES = {'done', 'cancelled', 'paused'}
ACTIVE_STATUSES = {'pending', 'in_progress', 'blocked'}
TASK_ACTIVE_STATUSES = {'idle', 'assigned', 'pending_blocked'}
INVENTORY_AGE_SECONDS = 30 * 86400


def load_yaml(filepath):
    """Safely load YAML file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}
    except yaml.YAMLError as e:
        print(f"Error parsing {filepath}: {e}", file=sys.stderr)
        return {}


def save_yaml(filepath, data):
    """Safely save YAML file."""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)
        return True
    except Exception as e:
        print(f"Error writing {filepath}: {e}", file=sys.stderr)
        return False


def get_timestamp():
    """Generate archive filename timestamp."""
    return datetime.now().strftime('%Y%m%d%H%M%S')


def get_queue_dir():
    override = os.environ.get('SHOGUN_QUEUE_DIR')
    if override:
        return Path(override).resolve()
    return Path(__file__).resolve().parent.parent / 'queue'


def get_item_status(item):
    """Return status from current top-level YAML or legacy task.status YAML."""
    if not isinstance(item, dict):
        return ''
    if item.get('status') is not None:
        return str(item.get('status'))
    task = item.get('task')
    if isinstance(task, dict) and task.get('status') is not None:
        return str(task.get('status'))
    return ''


def uses_legacy_task_status(data):
    return isinstance(data, dict) and isinstance(data.get('task'), dict) and 'status' in data['task'] and 'status' not in data


def idle_stub_for(stem, data):
    if uses_legacy_task_status(data):
        return IDLE_STUB
    stub = dict(TOP_LEVEL_IDLE_STUB)
    if stem in CANONICAL_TASKS:
        stub['worker_id'] = stem
    return stub


def is_old_timestamp(value, now=None, age_seconds=INVENTORY_AGE_SECONDS):
    if not value:
        return False
    now = now or datetime.now().astimezone()
    text = str(value)
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.astimezone()
    return (now - parsed).total_seconds() >= age_seconds


def print_inventory(message):
    print(f"[INVENTORY] {message}", file=sys.stderr)


def get_active_cmd_ids():
    """Return command IDs in shogun_to_karo that are not terminal."""
    queue_dir = get_queue_dir()
    shogun_file = queue_dir / 'shogun_to_karo.yaml'
    data = load_yaml(shogun_file)

    key = 'commands' if 'commands' in data else 'queue'
    commands = data.get(key, []) if isinstance(data, dict) else []
    if not isinstance(commands, list):
        return set()

    active = set()
    for cmd in commands:
        if not isinstance(cmd, dict):
            continue
        if cmd.get('id') is None:
            continue
        if get_item_status(cmd) in TERMINAL_STATUSES:
            continue
        active.add(cmd.get('id'))
    return active


def inventory_commands(commands):
    unknown = []
    old_active = []
    for cmd in commands:
        if not isinstance(cmd, dict):
            continue
        status = get_item_status(cmd) or 'unknown'
        cmd_id = cmd.get('id', '<missing-id>')
        if status not in TERMINAL_STATUSES and status not in ACTIVE_STATUSES:
            unknown.append(f"{cmd_id}:{status}")
        if status in ACTIVE_STATUSES and is_old_timestamp(cmd.get('timestamp')):
            old_active.append(f"{cmd_id}:{status}:{cmd.get('timestamp')}")

    if unknown:
        print_inventory("non-canonical command status: " + ", ".join(unknown))
    if old_active:
        print_inventory("old non-terminal commands kept for human review: " + ", ".join(old_active))


def inventory_ntfy_inbox(dry_run=False):
    """Report old ntfy entries without deleting or changing them."""
    queue_dir = get_queue_dir()
    ntfy_file = queue_dir / 'ntfy_inbox.yaml'
    if not ntfy_file.exists():
        return True

    data = load_yaml(ntfy_file)
    entries = data.get('inbox', []) if isinstance(data, dict) else []
    if not isinstance(entries, list):
        print("Error: ntfy inbox is not a list", file=sys.stderr)
        return False

    old_pending = []
    old_terminal = []
    for item in entries:
        if not isinstance(item, dict):
            continue
        status = get_item_status(item) or 'unknown'
        item_id = item.get('id', '<missing-id>')
        if is_old_timestamp(item.get('timestamp')):
            if status in TERMINAL_STATUSES:
                old_terminal.append(f"{item_id}:{status}")
            else:
                old_pending.append(f"{item_id}:{status}")

    prefix = "[DRY-RUN] " if dry_run else ""
    if old_pending:
        print_inventory(prefix + "old ntfy pending/non-terminal entries kept: " + ", ".join(old_pending))
    if old_terminal:
        print_inventory(prefix + "old ntfy terminal entries available for explicit cleanup: " + ", ".join(old_terminal))
    return True


def ensure_parent_dir(path):
    path.parent.mkdir(parents=True, exist_ok=True)


def archive_taskspec(filepath, archive_path, data, dry_run=False):
    if dry_run:
        print(f"[DRY-RUN] would archive: {filepath}")
        print(f"[DRY-RUN] would write: {archive_path}")
        return True

    ensure_parent_dir(archive_path)
    if not save_yaml(archive_path, data):
        return False

    if filepath.name in archive_path.name:
        return True
    return filepath.rename(archive_path)


def slim_tasks(dry_run=False):
    queue_dir = get_queue_dir()
    tasks_dir = queue_dir / 'tasks'
    archive_dir = queue_dir / 'archive' / 'tasks'

    if not tasks_dir.exists():
        return True

    timestamp = get_timestamp()
    for filepath in sorted(tasks_dir.glob('*.yaml')):
        data = load_yaml(filepath)
        if not isinstance(data, dict):
            continue

        status = get_item_status(data)
        if not status:
            continue

        stem = filepath.stem
        if stem in CANONICAL_TASKS:
            if status not in TERMINAL_STATUSES:
                if status not in TASK_ACTIVE_STATUSES:
                    print_inventory(f"canonical task {filepath.name} has non-canonical status '{status}'")
                continue

            archive_path = archive_dir / f'{stem}_{timestamp}.yaml'
            if not archive_taskspec(filepath, archive_path, data, dry_run=dry_run):
                return False

            if dry_run:
                print(f"[DRY-RUN] would overwrite: {filepath} with {idle_stub_for(stem, data)}")
                continue

            if not save_yaml(filepath, idle_stub_for(stem, data)):
                return False
            continue

        if status not in TERMINAL_STATUSES:
            if status not in TASK_ACTIVE_STATUSES and status not in ACTIVE_STATUSES:
                print_inventory(f"task file {filepath.name} has non-canonical status '{status}'")
            continue

        archive_path = archive_dir / filepath.name
        if archive_path.exists():
            archive_path = archive_dir / f'{filepath.stem}_{timestamp}{filepath.suffix}'

        if dry_run:
            print(f"[DRY-RUN] would archive: {file
```

### Core Architecture Module: `skills/shogun-screenshot/scripts/mask_sensitive.py`
```
#!/usr/bin/env python3
"""機微情報マスキングスクリプト — スクショ内の機密情報を黒塗りする"""
import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        description="スクショ内の機微情報を矩形で塗りつぶす",
        epilog='例: mask_sensitive.py --input shot.png --output masked.png --regions "100,50,400,80" "500,200,800,230"',
    )
    parser.add_argument("--input", required=True, help="入力画像のパス")
    parser.add_argument("--output", required=True, help="出力画像のパス")
    parser.add_argument(
        "--regions",
        nargs="+",
        required=True,
        help='マスク領域 "x1,y1,x2,y2"（複数指定可。左上(0,0)基準、ピクセル値）',
    )
    parser.add_argument(
        "--color",
        default="0,0,0",
        help='塗りつぶし色 "R,G,B"（デフォルト: 0,0,0 = 黒）',
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="マスク領域を赤枠で表示（塗りつぶさない。位置確認用）",
    )
    args = parser.parse_args()

    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print(
            "ERROR: Pillow が未インストールです。以下のコマンドでインストールしてください:",
            file=sys.stderr,
        )
        print("  pip install Pillow", file=sys.stderr)
        sys.exit(1)

    # 色のパース
    try:
        fill_color = tuple(int(v.strip()) for v in args.color.split(","))
        if len(fill_color) != 3:
            raise ValueError
    except ValueError:
        print(
            'ERROR: --color は "R,G,B" 形式で指定してください（例: "0,0,0"）',
            file=sys.stderr,
        )
        sys.exit(1)

    # 画像読み込み
    try:
        img = Image.open(args.input)
    except FileNotFoundError:
        print(f"ERROR: 入力ファイルが見つかりません: {args.input}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: 画像を開けません: {e}", file=sys.stderr)
        sys.exit(1)

    w, h = img.size
    draw = ImageDraw.Draw(img)
    masked_count = 0

    for i, region in enumerate(args.regions, 1):
        try:
            coords = tuple(int(v.strip()) for v in region.split(","))
            if len(coords) != 4:
                raise ValueError
            x1, y1, x2, y2 = coords
        except ValueError:
            print(
                f'ERROR: 領域{i} "{region}" は "x1,y1,x2,y2" 形式で指定してください',
                file=sys.stderr,
            )
            sys.exit(1)

        # 座標をクランプ
        x1 = max(0, min(x1, w))
        y1 = max(0, min(y1, h))
        x2 = max(x1, min(x2, w))
        y2 = max(y1, min(y2, h))

        if args.preview:
            # プレビューモード: 赤枠で表示
            draw.rectangle([x1, y1, x2, y2], outline=(255, 0, 0), width=3)
        else:
            # マスクモード: 塗りつぶし
            draw.rectangle([x1, y1, x2, y2], fill=fill_color)
        masked_count += 1

    img.save(args.output)
    mode = "preview" if args.preview else "masked"
    print(f"OK: {args.output} ({w}x{h}, {masked_count} regions {mode})")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/shogun-screenshot/scripts/trim_image.py`
```
#!/usr/bin/env python3
"""画像トリミングスクリプト — shogun-screenshot スキル用"""
import argparse
import sys

def main():
    parser = argparse.ArgumentParser(description="画像をトリミングする")
    parser.add_argument("--input", required=True, help="入力画像のパス")
    parser.add_argument("--output", required=True, help="出力画像のパス")
    parser.add_argument("--crop", required=True,
                        help='トリミング座標 "x1,y1,x2,y2"（左上(0,0)基準、ピクセル値）')
    parser.add_argument("--resize", default=None,
                        help='リサイズ "width,height"（省略時はトリミングのみ）')
    args = parser.parse_args()

    try:
        from PIL import Image
    except ImportError:
        print("ERROR: Pillow が未インストールです。以下のコマンドでインストールしてください:", file=sys.stderr)
        print("  pip install Pillow", file=sys.stderr)
        sys.exit(1)

    try:
        coords = tuple(int(v.strip()) for v in args.crop.split(","))
        if len(coords) != 4:
            raise ValueError
        x1, y1, x2, y2 = coords
    except ValueError:
        print('ERROR: --crop は "x1,y1,x2,y2" 形式で指定してください（例: "100,50,800,600"）', file=sys.stderr)
        sys.exit(1)

    try:
        img = Image.open(args.input)
    except FileNotFoundError:
        print(f"ERROR: 入力ファイルが見つかりません: {args.input}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: 画像を開けません: {e}", file=sys.stderr)
        sys.exit(1)

    w, h = img.size
    x1 = max(0, min(x1, w))
    y1 = max(0, min(y1, h))
    x2 = max(x1, min(x2, w))
    y2 = max(y1, min(y2, h))

    cropped = img.crop((x1, y1, x2, y2))

    if args.resize:
        try:
            rw, rh = (int(v.strip()) for v in args.resize.split(","))
            cropped = cropped.resize((rw, rh), Image.LANCZOS)
        except ValueError:
            print('ERROR: --resize は "width,height" 形式で指定してください', file=sys.stderr)
            sys.exit(1)

    cropped.save(args.output)
    print(f"OK: {args.output} ({cropped.size[0]}x{cropped.size[1]})")

if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #173** (2026-07-29): **SEC-001: gitleaksの自動実行および検出対象が不足している**
  *Symptoms*: ## 重大度 High  ## 問題 - `.gitleaks.toml` は存在するが、GitHub ActionsでもRun pre-commitでも実行されない - カスタムルールの対象が限定的（APIキー系が中心） - SSH秘密鍵ブロック、PEM証明書、Tailscale auth key（tskey-）等の重大な漏洩パターンを   十分に検出できない - 開発者が「安全網がある」と誤認する可能性がある  「設定ファイルだけ存在して自動実行されない」状態は、削除して安全網がないと 明示される状態より危険である。  ## 違反する要件 - NFR-014（秘密情報管理） - NFR-015（構成管理対象） - AC-016（CIによる秘密情報混入検証）— 現状では受入不可 - AC-020（Discord Webhook等の秘密情報保護）  ## 完了条件 1. Pull Requestおよび主要ブランチへのpush時にgitleaksが実行される 2. 全Git履歴または適切なコミット範囲を検査する 3. CI失敗時にマージを阻止できる 4. ローカルpre-commitまたは同等の事前検査手段を用意する 5. SSH秘密鍵、各種秘密鍵ブロック、認証トークン、Webhook URL等を検出対象にする 6. 意図的なテスト文字列に対するallowlistを最小限にする 7. 検出テストをCIへ追加する 8. READMEまたはセキュリティ手順に実行方法を記載する  ## 注記 公開用のPEM証明書自体は秘密情報とは限らない。一律にPEMファイルを禁止するのではなく、 秘密鍵ブロックや秘密情報を含むPEMを確実に検出する設計が適切。  ## cmd_001との関係 cmd_001（AIエージェント監視・可視化システム構築）は本Issueとは分離し、変更なしで継続する。 ただし、cmd_001のAC-016・AC-020はSEC-001解消まで未達とする。 Webhook・Tailscale認証キー等の実秘密情報を扱う工程（Phase 7）は、 SEC-001解消前には進めないことを推奨する。  ## 発見の経緯 cmd_001の品質チェック中に軍師が発見。QC-005（*secret*パターンの過剰ブロックにより 検査機構自体がgit追跡から除外される自己矛盾）の調査中に判明した別件。 
  **Post-Mortem & Fix Analysis**:
  > すみません。記載リポジトリのミスです。

- **Issue #171** (2026-07-02): **skill_candidate pipeline が null 常態化と finalize bypass で機能不全になる**
  *Symptoms*: Filed in the wrong repository by mistake. Content moved to the private tracker. Sorry for the noise.

- **Issue #168** (2026-06-12): **feat(guard): Hook #7 — 上流 repo への gh pr create を機械ブロック**
  *Symptoms*: ## 概要  V002 CRITICAL 恒久対策。足軽1が `yohey-w/multi-agent-shogun` に2度誤 PR した事例を受け、 `guard.sh` に Hook #7 を追加。`gh pr create` 実行時に上流 repo が指定されている場合を PreToolUse 段階で強制拒否する。  ## 変更内容  ### `scripts/hooks/guard.sh` — Hook #7 追加  - `gh pr create` コマンドで `--repo yohey-w/*` / `--repo digital-go-jp/*` を検知 → exit 2 - `cwd` の `git remote origin` が上流を指している場合も同様にブロック - read-only 操作 (`gh api` / `gh pr list` 等) はブロックしない  ### `scripts/hooks/test_hooks.sh` — テスト 5 件追加  | テストケース | 期待 | |---|---| | `gh pr create --repo yohey-w/multi-agent-shogun` | BLOCK | | `gh pr create --repo digital-go-jp/genai-web` | BLOCK | | `gh pr create --repo halsk/multi-agent-shogun` | ALLOW | | `gh pr create --repo geolonia/geonicdb-docs` | ALLOW | | `gh api repos/yohey-w/multi-agent-shogun/pulls` (read-only) | ALLOW |  ## テスト結果  ``` bash scripts/hooks/test_hooks.sh Results: PASS=68, FAIL=0 ✅ 全テスト通過 ```  ## 構文チェック  ``` bash -n scripts/hooks/guard.sh → 構文OK ```
  **Post-Mortem & Fix Analysis**:
  > 誤作成。halsk/multi-agent-shogun に作り直します。

- **Issue #167** (2026-06-12): **feat(scripts): macOS Keychain 秘密キャッシュ helper (cmd_514)**
  *Symptoms*: ## Summary  - `scripts/get-secret.sh`: macOS は Keychain 優先 / op fallback、WSL/Linux は op 直接委譲 - `scripts/sync-secrets-to-keychain.sh`: 1Password → macOS Keychain 一括同期スクリプト (macOS 専用) - `.gitignore`: ホワイトリストに2ファイルを追加  ## 軍師条件付きPASS 対応 (C1-C6 + V1)  | 条件 | 対応 | |------|------| | C1: -A 禁止、partition-list 最小権限 | `security set-generic-password-partition-list -S "apple-tool:,apple:"` で実装。失敗時は警告+継続 | | C2: argv 秘密露出回避 | ヘッダコメントに限界と対策を明記。macOS では他ユーザのプロセス args は不可視 | | C3: set+x / echo・log 禁止 | スクリプト冒頭 `set +x`、関数内でも再設定。秘密を stdout 以外に一切出力しない | | C4a: rotation 手順明記 | `sync-secrets-to-keychain.sh` ヘッダの ROTATION PROCEDURE セクション | | C4b: miss→fallback→exit 1 | Keychain miss → op fallback → 両失敗で exit 1 | | C5: FileVault 推奨明記 | 両スクリプトのセキュリティノートに FileVault 有効化手順を記載 | | C6: WSL2 非破壊 | Darwin 分岐のみ追加。WSL/Linux は `op item get` 直接で完全非破壊 | | V1: prompt-free 実証 | `bash -c 'source scripts/get-secret.sh; get_secret test-keychain-entry'` → Touch ID なしで値取得を実機確認 |  ## Test plan  - [ ] `bash -n scripts/get-secret.sh` → syntax OK - [ ] `bash -n scripts/sync-secrets-to-keychain.sh` → syntax OK - [ ] WSL/Linux で `sync-secrets-to-keychain.sh` 実行 → `INFO: macOS-only. Skipping.` で即 exit 0 - [ ] macOS で `bash -c 'source scripts/get-secret.sh; get_secret <synced-key>'` → Touch ID なしで値返却 - [ ] op 未認証時に `get_secret nonexistent` → `ERROR: ... not found` + exit 1
  **Post-Mortem & Fix Analysis**:
  > 誤作成。halsk/multi-agent-shogun に正 PR を作成します。

- **Issue #166** (2026-06-11): **feat(gunshi2): Fable 5 第二軍師を swarm に常設追加 (創造/知識業務専任)**
  *Symptoms*: ## Summary  - gunshi2 (claude-fable-5) を 10 番目エージェントとして swarm に常設追加 - gunshi (Opus) = cyber/security/QC、gunshi2 (Fable) = 創造/知識業務 の役割分担を確立 - Fable の cyber タスク Usage Policy 拒否を防ぐため、karo.md に明示的な振り分けルールを追加  ## Changes  | ファイル | 内容 | |---------|------| | `instructions/gunshi2.md` | 第二軍師指示書。F006 cyber FORBIDDEN 明記 | | `lib/cli_adapter.sh` | `get_instruction_file` + Fable 表示名 (`*fable*→Fable`) 追加 | | `scripts/watcher_supervisor.sh` | `ALL_AGENTS` に gunshi2 追加 | | `scripts/switch_cli.sh` | フォールバック固定マッピングに gunshi2 (pane_base+9) 追加 | | `scripts/inbox_watcher.sh` | command-layer agent 判定 2 箇所に gunshi2 追加 | | `scripts/ratelimit_check.sh` | `ALL_AGENTS` に gunshi2 追加 | | `instructions/karo.md` | gunshi vs gunshi2 振り分けルール + dispatch 手順追記 | | `docs/migration-to-macos.md` | 10 pane 構成 + gunshi2 手動追加手順 | | `.gitignore` | `instructions/gunshi2.md` を whitelist 追加 |  ## Test plan  - [x] `bash -n` 全変更スクリプト構文チェック OK - [x] `get_cli_type gunshi2` → `claude` - [x] `get_agent_model gunshi2` → `claude-fable-5` - [x] `get_model_display_name gunshi2` → `Fable+T` (worktree lib 使用時) - [x] `inbox_write → gunshi2` 到達確認 (queue/inbox/gunshi2.yaml に届くことを実証) - [x] config/settings.yaml gunshi2 エントリ追加確認 - [x] queue/inbox/gunshi2.yaml, queue/tasks/gunshi2.yaml, queue/reports/gunshi2_report.yaml 作成済  ## Notes  - `config/settings.yaml` は gitignore 対象のため PR 外。殿/将軍が手動で追加済み - queue/ ファイル (inbox/tasks/reports) も gitignore 対象のため PR 外。メインリポに直接作成済み - gunshi2 pane の実際の起動は `docs/migration-to-macos.md` の手動手順を参照
  **Post-Mortem & Fix Analysis**:
  > 誤作成。halsk fork 側で PR を作成し直します。

- **Issue #164** (2026-06-03): **post-merge live GATE-NG: ashigaru3-7 and haru_urara panes fell back to bash with blank @agent_cli**
  *Symptoms*: ## Summary  During cmd_525 post-merge verification for switch_cli partial settings preservation, live status showed new GATE-NG lanes unrelated to the verified type-only settings preservation regression.  ## Evidence collected on 2026-06-03 UTC  - `origin/persona/umamusume` is at `9901ac5d10f9a45edea499a5789458e4efdbf7f1`, satisfying the requested post-merge baseline. - `bash -n scripts/switch_cli.sh` passed. - `bats tests/unit/test_switch_cli.bats` printed `ok 1` through `ok 58` with no FAIL/SKIP lines, but the bats parent process did not exit cleanly and remained waiting after output completion. - `bash scripts/agent_status.sh` showed:   - `daiwa_scarlet`: codex / waiting / task done / inbox 0   - `ashigaru1`: opencode / waiting / task done / inbox 0   - `ashigaru2`: opencode / waiting / task done / inbox 0   - `ashigaru3`: opencode / ゲートNG   - `ashigaru4`: codex / ゲートNG   - `ashigaru5`: codex / ゲートNG   - `ashigaru6`: codex / ゲートNG   - `ashigaru7`: codex / ゲートNG   - `haru_urara`: codex / ゲートNG - tmux metadata/current command snapshot:   - `pane=3 agent=ashigaru3 cli= model=OpenCode (deepseek/deepseek-v4-flash) cmd=bash`   - `pane=4 agent=ashigaru4 cli= model=Spark cmd=bash`   - `pane=5 agent=ashigaru5 cli= model=Spark cmd=bash`   - `pane=6 agent=ashigaru6 cli= model=Spark cmd=bash`   - `pane=7 agent=ashigaru7 cli= model=Spark cmd=bash`   - `pane=8 agent=haru_urara cli= model=Spark cmd=bash` - runtime watcher env still expects AI CLIs:   - `ashigaru3 EXPECTED_CLI=opencode`  
  **Post-Mortem & Fix Analysis**:
  > Opened in the wrong repository during local multi-worktree triage. The relevant evidence is being tracked in NEXTAltair/multi-agent-shogun issues #39 and #49 instead. Closing this upstream issue with no action requested here.
  > Closing as opened in the wrong repository; no upstream action requested.

- **Issue #163** (2026-06-06): **feat: レートリミット時の代理指揮・状態監視メンバーを追加**
  *Symptoms*:  ## 概要  Claude Code / Codex 等の上位エージェントがレートリミットに到達した場合でも、タスク状態の把握・引き継ぎ・監視が止まらないようにする。  具体的には、将軍・家老・軍師などの上位陣が「給料分働いたので休憩」に入った場合でも、まだ稼働可能なエージェントが代理で状況確認・引き継ぎ・再割り当てを行える仕組みを追加する。  ## 背景  弱小な殿の運用では、Claude Code を Claude Pro のアカウント認証、Codex を ChatGPT Plus のアカウント認証で動作させている。  この場合、将軍・家老・軍師などの上位エージェントが比較的早くレートリミットに到達し、以下の問題が発生する。  1. タスクが中途半端な状態で停止する 2. 上位陣が休止すると、全体の情報把握・進捗管理も止まる 3. まだ稼働可能な足軽・別エージェントが存在しても、誰が何を引き継ぐべきか判断できない 4. 殿が手動で状況確認・再指示しないと再開しづらい  まるで近代軍のように、指揮系統が一部停止しても代替指揮・状態監視・引き継ぎが行われる仕組みが必要と思われる。  ## 要件  ### 1. エージェント状態の監視  各エージェントについて、少なくとも以下の状態を確認できるようにする。  - 稼働中 - レートリミット到達中 - 応答待ち - タスク実行中 - 最終応答時刻 - 担当中の task / cmd / issue - 引き継ぎ可能かどうか  状態は dashboard / YAML / ログ等、既存構成に馴染む形で記録する。  ### 2. 上位エージェント停止時の代理指揮  将軍・家老・軍師などの上位エージェントがレートリミット等で停止した場合、稼働可能な別エージェントが以下を代行できるようにする。  - 現在の未完了タスク一覧の確認 - 停止したエージェントの担当タスク確認 - 中途半端なタスクの状態整理 - 引き継ぎ先候補の提示 - 必要に応じた再割り当て - 殿への報告  ただし、代理指揮は無制限に権限を持つのではなく、危険な操作や大きな方針変更は殿または正規の上位エージェント確認待ちとする。  ### 3. 状態監視専任メンバーの追加  常時または定期的に、全体状態を監視する専任ロールを追加する案を検討する。  仮称：  - 見張り - 目付 - 番頭 - 監軍 - watcher supervisor 拡張  役割：  - 各エージェントの生存確認 - レートリミット状態の検出 - 長時間停止しているタスクの検出 - 中途半端な作業の検出 - 代理指揮が必要な場合の起票または通知 - dashboard 更新  ### 4. 引き継ぎルール  レートリミット等により担当者が停止した場合、次のようなルールを定義する。  - 一定時間応答がなければ「要確認」とする - 担当エージェントがレートリミット中なら「代理可能」状態にする - 未完了タスクには `handover_required` のようなフラグを立てる - 引き継ぎ先は、稼働可能かつ負荷が低いエージェントから選ぶ - 引き継ぎ時には、前任者の作業ログ・現在状態・次にやることを要約する  例：  ```yaml agent_status:   shogun:     state: rate_limited     last_seen_at: "2026-06-02T09:00:00+09:00"     current_task: "cmd_XXX
  **Post-Mortem & Fix Analysis**:
  > ご提案ありがとうございます。継戦能力の確保という観点は非常に重要で、要件の整理も丁寧でわかりやすかったです。  ただ、現時点では実装に割けるリソースがなく、着手できる見通しが立っていません。エージェント状態管理・専任監視ロール・引き継ぎルール・代理指揮フローと、実装すべき範囲が広く、中途半端に入れるよりもきちんと設計してから取り組みたい領域です。  もし実装に興味のある方がいれば、コントリビューションは大歓迎です。その際はこのISSUEを参照いただければ要件が整理されています。  引き続きよろしくお願いします。

- **Issue #162** (2026-06-06): **Harden agent startup & setup (inbox, hooks, MCP, permissions)**
  *Symptoms*: ## Why A post-restart 正常化 pass surfaced four independent ways the system could come up degraded — and in three of them, silently. Each fix targets a startup/setup failure mode that left agents running without their comms layer, hooks, or MCP tools, with nothing reported.  ## What & rationale  ### 1. Self-healing inbox symlink  (`fix`) `queue/inbox` symlinks to `~/.local/share/multi-agent-shogun/inbox` to keep the mailbox off the slow `/mnt/c` drvfs mount. The target dir was only created when the symlink itself didn't exist, so a re-run with a stale symlink + missing target left a **dangling link** that broke all agent-to-agent messaging at boot. Now the target is created unconditionally (idempotent), and `inbox_write.sh` recovers a dangling link before writing.  ### 2. Environment-independent Stop hook  (`fix`) `.claude/settings.json` hardcoded a `/home/tono/...` absolute path from another machine, so the Stop hook errored on every turn end here and stop-time inbox delivery never ran. Switched to the relative `bash scripts/stop_hook_inbox.sh`, matching the working SessionStart hook.  ### 3. MCP init-failure detection  (`feat`) One codex agent booted with `codex_apps` not initialized ("MCP startup interrupted") while its siblings were fine — a transient init timeout from simultaneous codex launches, and **silent**. Added `scripts/mcp_health_check.sh` (scans codex panes for MCP init errors) and wired it into `shutsujin` STEP 6.9 (10s settle → check →
  **Post-Mortem & Fix Analysis**:
  > 誠にご尽力、かたじけなく存ずる。@kazumori102 殿。inbox のシンボリックリンク復旧・MCP ヘルスチェック・起動時の権限付与改善、いずれも実運用で痛みのある箇所への的確な一手でございました。一点のみ手を加えさせていただきました。first_setup.sh の sudo chmod を素の chmod に戻しております。sudo が使えぬ環境（CI・共用ホスト）での動作を守るためでございます。commit 1368e1c にて main へ取り込み申した。改めて御礼申し上げます。

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

### Incident Patch 1: `f84d3b74` (2026-07-10)
**Commit Message**: chore(memory): purge retired Memory MCP from instructions/hooks; file-based memory is sole SoT

- CLAUDE.md / .claude/settings.json: land the uncommitted 2026-07-01 memory
  architecture change (Memory MCP retirement note, autoMemoryDirectory pin)
- instructions/{shogun,karo,gunshi,ashigaru}.md: remove dead read_graph steps
  from recovery/context-loading procedures; shogun's "Memory MCP" section
  rewritten as file-based memory procedure
- cli_specific/claude_tools.md: Memory MCP section -> file-based memory;
  recovery step 2 now reads memory/MEMORY.md (shogun only)
- cli_specific/{codex,copilot,kimi}_tools.md: comparison tables no longer
  claim Claude Code has a built-in Memory MCP
- scripts/session_start_hook.sh: drop mcp__memory__read_graph step (agents
  were instructed to call a retired MCP on every session start)
- regenerate instructions/generated/, AGENTS.md, copilot-instructions.md,
  agents/default/system.md via build_instructions.sh

Repo memory/ dir also tidied (untracked): stale MEMORY.md + dead
shogun_memory.jsonl archived to memory/archive_20260711/, pointer stub
installed, CoDD/SEO memories relocated to their canonical stores.

Co-Authored-By: Claude Opus 4.8 (1M

**File**: `.claude/settings.json` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 {
+  "autoMemoryDirectory": "/home/tono/.claude/projects/-home-tono-multi-agent-shogun/memory",
   "hooks": {
     "SessionStart": [
       {
```

**File**: `.github/copilot-instructions.md` (modified, +11/-5)
```diff
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see copilot-instructions.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *GitHub Copilot CLI users: this file is also auto-loaded via GitHub Copilot CLI's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/generated/copilot-shogun.md`, karo→`instructions/generated/copilot-karo.md`, ashigaru→`instructions/generated/copilot-ashigaru.md`, gunshi→`instructions/generated/copilot-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *GitHub Copilot CLI users: this file is also auto-loaded via GitHub Copilot CLI's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/generated/copilot-shogun.md`, karo→`instructions/generated/copilot-karo.md`, ashigaru→`instructions/generated/copilot-ashigaru.md`, gunshi→`instructions/generated/copilot-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -199,7 +200,12 @@ Race condition is eliminated: the context reset wipes old context. Agent re-read
 # Context Layers
 
 ```
-Layer 1: Memory MCP     — persistent across sessions (preferences, rules, lessons)
+Layer 1: Auto-memory (file-based) — persistent across sessions (preferences, rules, lessons)
+         2026-07-01以降は4分割: グローバル(~/.copilot/global-memory/)、
+         CoDD固有(~/.copilot/projects/-home-tono-codd-dev/memory/)、
+         大里LMS固有(~/.copilot/projects/-home-tono-osato-lms/memory/)、
+         shogun固有(本ディレクトリ memory/)。各プロジェクトの autoMemoryDirectory 設定で振り分け。
+         Memory MCP(server-memory)は廃止済み。
 Layer 2: Project files   — persistent per-project (config/, projects/, context/)
 Layer 3: YAML Queue      — persistent task data (queue/ — authoritative source of truth)
 Layer 4: Session context — volatile (copilot-instructions.md auto-loaded, instructions/*.md, lost on /clear)
```

**File**: `AGENTS.md` (modified, +11/-5)
```diff
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see AGENTS.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Codex CLI users: this file is also auto-loaded via Codex CLI's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/generated/codex-shogun.md`, karo→`instructions/generated/codex-karo.md`, ashigaru→`instructions/generated/codex-ashigaru.md`, gunshi→`instructions/generated/codex-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Codex CLI users: this file is also auto-loaded via Codex CLI's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/generated/codex-shogun.md`, karo→`instructions/generated/codex-karo.md`, ashigaru→`instructions/generated/codex-ashigaru.md`, gunshi→`instructions/generated/codex-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -199,7 +200,12 @@ Race condition is eliminated: the context reset wipes old context. Agent re-read
 # Context Layers
 
 ```
-Layer 1: Memory MCP     — persistent across sessions (preferences, rules, lessons)
+Layer 1: Auto-memory (file-based) — persistent across sessions (preferences, rules, lessons)
+         2026-07-01以降は4分割: グローバル(~/.codex/global-memory/)、
+         CoDD固有(~/.codex/projects/-home-tono-codd-dev/memory/)、
+         大里LMS固有(~/.codex/projects/-home-tono-osato-lms/memory/)、
+         shogun固有(本ディレクトリ memory/)。各プロジェクトの autoMemoryDirectory 設定で振り分け。
+         Memory MCP(server-memory)は廃止済み。
 Layer 2: Project files   — persistent per-project (config/, projects/, context/)
 Layer 3: YAML Queue      — persistent task data (queue/ — authoritative source of truth)
 Layer 4: Session context — volatile (AGENTS.md auto-loaded, instructions/*.md, lost on /new)
```

**File**: `CLAUDE.md` (modified, +22/-16)
```diff
@@ -19,7 +19,7 @@ files:
   tasks: "queue/tasks/ashigaru{N}.yaml" # Karo → Ashigaru assignments (per-ashigaru)
   gunshi_task: queue/tasks/gunshi.yaml  # Karo → Gunshi strategic assignments
   pending_tasks: queue/tasks/pending.yaml # Karo管理の保留タスク（blocked未割当）
-  reports: "queue/reports/ashigaru{N}_report.yaml" # Ashigaru → Gunshi reports
+  reports: "queue/reports/ashigaru{N}_report.yaml" # Ashigaru → Gunshi reports
   gunshi_report: queue/reports/gunshi_report.yaml  # Gunshi → Karo strategic reports
   dashboard: dashboard.md              # Human-readable summary (secondary data)
   daily_log: "logs/daily/YYYY-MM-DD.md" # Karo appends cmd summary on completion. Shogun reads for daily reports.
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see CLAUDE.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Claude Code users: this file is also auto-loaded via Claude Code's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/shogun.md`, karo→`instructions/karo.md`, ashigaru→`instructions/ashigaru.md`, gunshi→`instructions/gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Claude Code users: this file is also auto-loaded via Claude Code's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/shogun.md`, karo→`instructions/karo.md`, ashigaru→`instructions/ashigaru.md`, gunshi→`instructions/gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -119,8 +120,8 @@ Examples:
 # Shogun → Karo
 bash scripts/inbox_write.sh karo "cmd_048を書いた。実行せよ。" cmd_new shogun
 
-# Ashigaru → Gunshi
-bash scripts/inbox_write.sh gunshi "足軽5号、任務完了。品質チェックを仰ぎたし。" report_received ashigaru5
+# Ashigaru → Gunshi
+bash scripts/inbox_write.sh gunshi "足軽5号、任務完了。品質チェックを仰ぎたし。" report_received ashigaru5
 
 # Karo → Ashigaru
 bash scripts/inbox_write.sh ashigaru3 "タスクYAMLを読んで作業開始せよ。" task_assigned karo
@@ -141,15 +142,15 @@ The nudge is minimal: `inboxN` (e.g. `inbox3` = 3 unread). That's it.
 **Agent reads the inbox file itself.** Message content never travels through tmux — only a short wake-up signal.
 
 Special cases (CLI commands sent via `tmux send-keys`):
-- `type: clear_command` → sends context reset command via send-keys (Claude/Copilot/Kimi: `/clear`, Codex/OpenCode: `/new`)
+- `type: clear_command` → sends context reset command via send-keys (Claude/Copilot/Kimi: `/clear`, Codex/OpenCode: `/new`)
 - `type: model_switch` → sends the /model comma
```

**File**: `agents/default/system.md` (modified, +11/-5)
```diff
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see agents/default/system.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Kimi K2 CLI users: this file is also auto-loaded via Kimi K2 CLI's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/generated/kimi-shogun.md`, karo→`instructions/generated/kimi-karo.md`, ashigaru→`instructions/generated/kimi-ashigaru.md`, gunshi→`instructions/generated/kimi-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Kimi K2 CLI users: this file is also auto-loaded via Kimi K2 CLI's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/generated/kimi-shogun.md`, karo→`instructions/generated/kimi-karo.md`, ashigaru→`instructions/generated/kimi-ashigaru.md`, gunshi→`instructions/generated/kimi-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -199,7 +200,12 @@ Race condition is eliminated: the context reset wipes old context. Agent re-read
 # Context Layers
 
 ```
-Layer 1: Memory MCP     — persistent across sessions (preferences, rules, lessons)
+Layer 1: Auto-memory (file-based) — persistent across sessions (preferences, rules, lessons)
+         2026-07-01以降は4分割: グローバル(~/.kimi/global-memory/)、
+         CoDD固有(~/.kimi/projects/-home-tono-codd-dev/memory/)、
+         大里LMS固有(~/.kimi/projects/-home-tono-osato-lms/memory/)、
+         shogun固有(本ディレクトリ memory/)。各プロジェクトの autoMemoryDirectory 設定で振り分け。
+         Memory MCP(server-memory)は廃止済み。
 Layer 2: Project files   — persistent per-project (config/, projects/, context/)
 Layer 3: YAML Queue      — persistent task data (queue/ — authoritative source of truth)
 Layer 4: Session context — volatile (agents/default/system.md auto-loaded, instructions/*.md, lost on /clear)
```

---

### Incident Patch 2: `84d2043a` (2026-06-06)
**Commit Message**: fix: repair get_cli_type Python snippet and copilot model default

Auto-merge mangled the get_cli_type Python block — restored clean logic
using normalize_cli() + full 7-CLI allowed tuple. Added copilot case to
get_agent_model() returning empty string so --model flag is not appended
when copilot manages model selection internally.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `lib/cli_adapter.sh` (modified, +12/-13)
```diff
@@ -180,7 +180,7 @@ get_cli_type() {
     local result
     result=$("$CLI_ADAPTER_PROJECT_ROOT/.venv/bin/python3" -c "
 import yaml, sys
-allowed = ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'antigravity')
+allowed = ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor', 'antigravity')
 def normalize_cli(value):
     value = str(value or '').lower()
     if value in ('gemini', 'agy'):
@@ -194,23 +194,18 @@ try:
         print('claude'); sys.exit(0)
     agents = cli.get('agents', {})
     if not isinstance(agents, dict):
-        print(cli.get('default', 'claude') if cli.get('default', 'claude') in ('claude','codex','copilot','kimi','opencode','cursor') else 'claude')
+        default = normalize_cli(cli.get('default', 'claude'))
+        print(default if default in allowed else 'claude')
         sys.exit(0)
     agent_cfg = agents.get('${agent_id}')
     if isinstance(agent_cfg, dict):
-        t = agent_cfg.get('type', '')
-        if t in ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor'):
-            print(t); sys.exit(0)
-    elif isinstance(agent_cfg, str):
-        if agent_cfg in ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor'):
-            print(agent_cfg); sys.exit(0)
-    default = cli.get('default', 'claude')
-    if default in ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor'):
-        default = normalize_cli(cli.get('default', 'claude'))
-        print(default if default in allowed else 'claude')
         t = normalize_cli(agent_cfg.get('type', ''))
         if t in allowed:
+            print(t); sys.exit(0)
+    elif isinstance(agent_cfg, str):
         t = normalize_cli(agent_cfg)
+        if t in allowed:
+            print(t); sys.exit(0)
     default = normalize_cli(cli.get('default', 'claude'))
     if default in allowed:
         print(default)
@@ -482,8 +477,12 @@ get_agent_model() {
             # Antigravity CLI はホスト側の既定/最後のモデル設定を使う。
             echo "auto"
             ;;
+        copilot)
+            # Copilot CLI manages model selection internally; no default
+            echo ""
+            ;;
         *)
-            # Claude Code/Codex/Copilot用デフォルトモデル
+            # Claude Code/Codex用デフォルトモデル
             case "$agent_id" in
                 shogun)         echo "opus" ;;
                 karo)           echo "sonnet" ;;
```

---

### Incident Patch 3: `4fe68ed5` (2026-06-06)
**Commit Message**: fix: repair cursor/antigravity case syntax in inbox_watcher and build_instructions

Auto-merge dropped closing `;;` and `return 0; fi` from the cursor
case block in both files, causing syntax errors that broke CI.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `scripts/build_instructions.sh` (modified, +1/-0)
```diff
@@ -106,6 +106,7 @@ EOFYAML
             ;;
         cursor)
             cat "$PARTS_DIR/cli_specific/cursor_tools.md" >> "$output_path"
+            ;;
         antigravity)
             cat "$PARTS_DIR/cli_specific/antigravity_tools.md" >> "$output_path"
             ;;
```

**File**: `scripts/inbox_watcher.sh` (modified, +3/-0)
```diff
@@ -627,6 +627,9 @@ send_cli_command() {
                 timeout 5 tmux send-keys -t "$PANE_TARGET" Enter 2>/dev/null || true
                 sleep 3
                 NEW_CONTEXT_SENT=1
+                return 0
+            fi
+            ;;
         antigravity)
             if [[ "$cmd" == /model* ]]; then
                 echo "[$(date)] Skipping $cmd (Antigravity model changes are restart-only)" >&2
```

---

### Incident Patch 4: `1368e1cd` (2026-06-06)
**Commit Message**: feat: harden agent startup — inbox, hooks, MCP health check, dangling symlink fix (PR #162)

- .claude/settings.json: stop hook uses relative path (portable)
- scripts/inbox_write.sh: recover dangling queue/inbox symlink before mkdir
- scripts/mcp_health_check.sh: new script — detect MCP init failures in codex panes
- shutsujin_departure.sh: mkdir inbox dir before symlink check (idempotent); add STEP 6.9 MCP health check
- first_setup.sh: batch chmod (without sudo) for script permissions

Co-Authored-By: kazumori102 <github@example.com>
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -118,6 +118,7 @@
 !scripts/ratelimit_check.sh
 !scripts/switch_cli.sh
 !scripts/dashboard-viewer.py
+!scripts/mcp_health_check.sh
 
 
 # SayTask (sample template only, not actual data)
```

**File**: `first_setup.sh` (modified, +11/-2)
```diff
@@ -774,13 +774,22 @@ SCRIPTS=(
     "first_setup.sh"
 )
 
+TARGETS=()
+
 for script in "${SCRIPTS[@]}"; do
     if [ -f "$SCRIPT_DIR/$script" ]; then
-        chmod +x "$SCRIPT_DIR/$script"
-        log_info "$script に実行権限を付与しました"
+        TARGETS+=("$SCRIPT_DIR/$script")
     fi
 done
 
+if [ "${#TARGETS[@]}" -ne 0 ]; then
+    chmod +x "${TARGETS[@]}"
+
+    for target in "${TARGETS[@]}"; do
+        log_info "$(basename "$target") に実行権限を付与しました"
+    done
+fi
+
 RESULTS+=("実行権限: OK")
 
 # ============================================================
```

**File**: `scripts/inbox_write.sh` (modified, +6/-1)
```diff
@@ -27,8 +27,13 @@ if [ "$FROM" = "$TARGET" ]; then
 fi
 
 # Initialize inbox if not exists
+# dangling symlink recovery: queue/inbox が壊れたシンボリックリンクならリンク先を再生成
+_inbox_parent="$(dirname "$INBOX")"
+if [ -L "$_inbox_parent" ] && [ ! -d "$_inbox_parent" ]; then
+    mkdir -p "$(readlink "$_inbox_parent")"
+fi
 if [ ! -f "$INBOX" ]; then
-    mkdir -p "$(dirname "$INBOX")"
+    mkdir -p "$_inbox_parent"
     echo "messages: []" > "$INBOX"
 fi
 
```

**File**: `scripts/mcp_health_check.sh` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+#!/usr/bin/env bash
+set -uo pipefail
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
+LOG_FILE="${PROJECT_ROOT}/logs/mcp_health.log"
+TIMESTAMP="$(date '+%Y-%m-%dT%H:%M:%S')"
+
+mkdir -p "${PROJECT_ROOT}/logs"
+
+errors=0
+checked=0
+
+echo "[${TIMESTAMP}] MCP Health Check Start" | tee -a "$LOG_FILE"
+
+# multiagent:agents セッションの全ペインを走査
+if ! tmux has-session -t multiagent 2>/dev/null; then
+    echo "[${TIMESTAMP}] SKIP: multiagent session not found" | tee -a "$LOG_FILE"
+    exit 0
+fi
+
+while IFS= read -r pane_id; do
+    agent_cli=$(tmux display-message -t "multiagent:agents.${pane_id}" -p '#{@agent_cli}' 2>/dev/null || echo "")
+    agent_id=$(tmux display-message -t "multiagent:agents.${pane_id}" -p '#{@agent_id}' 2>/dev/null || echo "pane${pane_id}")
+
+    if [ "$agent_cli" != "codex" ]; then
+        continue
+    fi
+
+    checked=$((checked + 1))
+    capture=$(tmux capture-pane -t "multiagent:agents.${pane_id}" -p -S -100 2>/dev/null || echo "")
+
+    if echo "$capture" | grep -qiE 'MCP startup interrupted|servers were not initialized|MCP server .+ failed|MCP connection .+ timed out'; then
+        echo "[${TIMESTAMP}] ${agent_id} (codex): NG - MCP initialization error detected" | tee -a "$LOG_FILE"
+        errors=$((errors + 1))
+    else
+        echo "[${TIMESTAMP}] ${agent_id} (codex): OK" | tee -a "$LOG_FILE"
+    fi
+done < <(tmux list-panes -t "multiagent:agents" -F '#{pane_index}' 2>/dev/null || true)
+
+echo "[${TIMESTAMP}] Result: ${errors} errors found (checked ${checked} codex panes)" | tee -a "$LOG_FILE"
+
+if [ "$errors" -gt 0 ]; then
+    echo "⚠️ MCP Health Check: ${errors} error(s) detected. Run 'bash scripts/switch_cli.sh <agent>' to restart affected agents."
+    exit 1
+else
+    echo "✅ MCP Health Check: All codex agents OK (${checked} checked)"
+    exit 0
+fi
```

**File**: `shutsujin_departure.sh` (modified, +15/-1)
```diff
@@ -380,8 +380,8 @@ fi
 # macOSではfswatch使用のためシンボリックリンク不要
 if [ "$(uname -s)" != "Darwin" ]; then
     INBOX_LINUX_DIR="$HOME/.local/share/multi-agent-shogun/inbox"
+    mkdir -p "$INBOX_LINUX_DIR"  # 常に実行（べき等）— dangling symlink 防止
     if [ ! -L ./queue/inbox ]; then
-        mkdir -p "$INBOX_LINUX_DIR"
         [ -d ./queue/inbox ] && cp ./queue/inbox/*.yaml "$INBOX_LINUX_DIR/" 2>/dev/null && rm -rf ./queue/inbox
         ln -sf "$INBOX_LINUX_DIR" ./queue/inbox
         log_info "  └─ inbox → Linux FS ($INBOX_LINUX_DIR) にシンボリックリンク作成"
@@ -1017,6 +1017,20 @@ else
 fi
 echo ""
 
+# ═══════════════════════════════════════════════════════════════════════════════
+# STEP 6.9: MCP ヘルスチェック（codex足軽のMCP初期化状態を検証）
+# ═══════════════════════════════════════════════════════════════════════════════
+log_info ""
+log_info "STEP 6.9: MCP ヘルスチェック..."
+log_info "  └─ 全エージェント起動完了まで10秒待機..."
+sleep 10
+if bash "$SCRIPT_DIR/scripts/mcp_health_check.sh" 2>&1 | tee -a "$SCRIPT_DIR/logs/mcp_health.log"; then
+    log_success "  └─ MCP ヘルスチェック: 全正常"
+else
+    log_error "  └─ ⚠️ MCP初期化失敗を検知。logs/mcp_health.log を確認せよ"
+    log_error "     該当エージェントを 'bash scripts/switch_cli.sh <agent>' で再起動することを推奨"
+fi
+
 # ═══════════════════════════════════════════════════════════════════════════════
 # STEP 7: 環境確認・完了メッセージ
 # ═══════════════════════════════════════════════════════════════════════════════
```

---

### Incident Patch 5: `16660348` (2026-06-06)
**Commit Message**: fix: prevent duplicate inbox_watcher startup via per-agent flock

Root cause: start_watcher_if_missing had a TOCTOU race between the
pgrep check and nohup launch. Under supervisor restart, two instances
could both see "no watcher running" and both start one.

Fix: wrap the check+start block in a per-agent flock (non-blocking).
If another instance is already starting the watcher for that agent,
the second call returns 0 immediately. The OS releases the lock
automatically when the subshell exits.

Also fix pgrep -f → pgrep -Ef for ERE alternation in ( |$) pattern.

Closes #159

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `scripts/watcher_supervisor.sh` (modified, +13/-8)
```diff
@@ -36,22 +36,27 @@ start_watcher_if_missing() {
     local pane="$2"
     local log_file="$3"
     local cli
+    local lockfile="/tmp/shogun_watcher_start_${agent}.lock"
 
     ensure_inbox_file "$agent"
     if ! pane_exists "$pane"; then
         return 0
     fi
 
-    if pgrep -f "scripts/inbox_watcher.sh ${agent} ${pane}( |$)" >/dev/null 2>&1; then
-        return 0
-    fi
+    (
+        flock -n 9 || return 0
+        if pgrep -Ef "scripts/inbox_watcher.sh ${agent} ${pane}( |$)" >/dev/null 2>&1; then
+            return 0
+        fi
 
-    if pgrep -f "scripts/inbox_watcher.sh ${agent} " >/dev/null 2>&1; then
-        echo "[$(date)] [WARN] stale watcher detected for ${agent}; starting watcher for expected pane ${pane}" >&2
-    fi
+        if pgrep -f "scripts/inbox_watcher.sh ${agent} " >/dev/null 2>&1; then
+            echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] stale watcher detected for ${agent}; starting watcher for expected pane ${pane}" >&2
+        fi
 
-    cli=$(tmux show-options -p -t "$pane" -v @agent_cli 2>/dev/null || echo "codex")
-    nohup bash scripts/inbox_watcher.sh "$agent" "$pane" "$cli" >> "$log_file" 2>&1 &
+        cli=$(tmux show-options -p -t "$pane" -v @agent_cli 2>/dev/null || echo "codex")
+        nohup bash scripts/inbox_watcher.sh "$agent" "$pane" "$cli" >> "$log_file" 2>&1 &
+        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [START] inbox_watcher started for ${agent} pane=${pane} PID=$!" >&2
+    ) 9>"$lockfile"
 }
 
 watcher_specs() {
```

**File**: `tests/unit/test_watcher_supervisor.bats` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+#!/usr/bin/env bats
+# test_watcher_supervisor.bats — start_watcher_if_missing unit tests
+#
+# Tests the flock-protected start_watcher_if_missing logic via mocking.
+#
+# Test cases:
+#   T-WS-001: pane does not exist → returns 0, no watcher started
+#   T-WS-002: watcher already running for correct pane → no duplicate started
+#   T-WS-003: lockfile path follows pattern /tmp/shogun_watcher_start_{agent}.lock
+#   T-WS-004: no existing watcher → watcher is started
+
+PROJECT_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
+SUPERVISOR_SCRIPT="$PROJECT_ROOT/scripts/watcher_supervisor.sh"
+
+setup() {
+    TEST_TMP="$(mktemp -d)"
+    mkdir -p "$TEST_TMP/scripts"
+    mkdir -p "$TEST_TMP/queue/inbox"
+    mkdir -p "$TEST_TMP/logs"
+
+    # Mock inbox_watcher.sh — records launch args
+    cat > "$TEST_TMP/scripts/inbox_watcher.sh" << 'MOCK'
+#!/bin/bash
+echo "$@" >> "$(dirname "$0")/../watcher_launched.log"
+sleep 60
+MOCK
+    chmod +x "$TEST_TMP/scripts/inbox_watcher.sh"
+
+    # Default mock: pane does NOT exist
+    MOCK_PANE_EXISTS=0
+
+    # Default mock: no existing watcher pgrep hit
+    MOCK_PGREP_CORRECT=1
+    MOCK_PGREP_STALE=1
+}
+
+teardown() {
+    rm -rf "$TEST_TMP"
+}
+
+# Source the function under test with mocked dependencies injected via env overrides.
+# We source the function definitions only, then call start_watcher_if_missing directly.
+source_supervisor_functions() {
+    # Override pane_exists and pgrep with shell functions in the current subshell.
+    pane_exists() {
+        return $MOCK_PANE_EXISTS
+    }
+
+    pgrep() {
+        # Distinguish correct-pane vs stale-pane pgrep call by argument pattern
+        local args="$*"
+        if echo "$args" | grep -q "( |\$)"; then
+            # correct-pane pattern (has trailing space or end anchor)
+            return $MOCK_PGREP_CORRECT
+        else
+            return $MOCK_PGREP_STALE
+        fi
+    }
+
+    ensure_inbox_file() {
+        local agent="$1"
+        touch "$TEST_TMP/queue/inbox/${agent}.yaml"
+    }
+
+    # Load only the start_watcher_if_missing function definition from the script.
+    # We extract and eval it to avoid running the infinite loop at the bottom.
+    eval "$(
+        awk '/^start_watcher_if_missing\(\)/{p=1} p{print} /^\}$/{if(p){p=0}}' \
+            "$SUPERVISOR_SCRIPT"
+    )"
+}
+
+# ---------------------------------------------------------------------------
+# T-WS-001: pane does not exist → function returns 0, no watcher started
+# ---------------------------------------------------------------------------
+@test "T-WS-001: pane does not exist returns 0 and does not start watcher" {
+    (
+        export MOCK_PANE_EXISTS=1   # non-zero = pane missing
+
+        pane_exists() { return 1; }
+        ensure_inbox_file() { :; }
+
+        watcher_started=0
+        nohup() { watcher_started=1; }
+
+        eval "$(
+            awk '/^start_watcher_if_missing\(\)/{p=1} p{print} /^\}$/{if(p){p=0}}' \
+                "$SUPERVISOR_SCRIPT"
+        )"
+
+        start_watcher_if_missing "ashigaru1" "multiagent:agents.1" "/tmp/test_ws_001.log"
+        result=$?
+
+        [ "$result" -eq 0 ]
+        [ "$watcher_started" -eq 0 ]
+    )
+}
+
+# ---------------------------------------------------------------------------
+# T-WS-002: watcher already running for correct pane → no duplicate started
+# ---------------------------------------------------------------------------
+@test "T-WS-002: watcher already running for correct pane does not start duplicate" {
+    local launched_log="$TEST_TMP/watcher_launched.log"
+
+    # Run a subprocess that:
+    #   - pane exists
+    #   - correct-pane pgrep returns 0 (watcher running)
+    #   - records if inbox_watcher.sh gets executed
+    (
+        pane_exists() { return 0; }
+        ensure_inbox_file() { touch "$TEST_TMP/queue/inbox/${1}.yaml"; }
+
+        pgrep() {
+            # Simulate: correct-pane watcher IS running
+            retu
```

---

### Incident Patch 6: `56519d65` (2026-06-06)
**Commit Message**: fix: remove hardcoded absolute paths from instructions

Replace machine-specific paths (/home/tono/, /mnt/c/tools/multi-agent-shogun/)
with relative paths and project-root-relative examples. Regenerate all
CLI-specific instruction files from updated sources.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `.opencode/agents/karo.md` (modified, +2/-2)
```diff
@@ -116,7 +116,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -128,7 +128,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
```

**File**: `instructions/generated/codex-karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi
```

**File**: `instructions/generated/copilot-karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi
```

**File**: `instructions/generated/karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi
```

**File**: `instructions/generated/kimi-karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi
```

---

### Incident Patch 7: `0838f317` (2026-06-06)
**Commit Message**: fix: use Path.home() for seo-affiliate default dir

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `scripts/seo_qc.py` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
 from datetime import datetime
 from pathlib import Path
 
-DEFAULT_BASE_DIR = "/home/yohei/seo-affiliate"
+DEFAULT_BASE_DIR = str(Path.home() / "seo-affiliate")
 ALL_SITES = ["yane", "kagi", "kyutoki", "ohaka", "gaichuu", "kekkon", "ihin", "fuyouhin", "zeirishi"]
 
 # Forbidden words (check_009)
```

---

### Incident Patch 8: `daad5bf2` (2026-06-06)
**Commit Message**: fix: use relative path for stop hook (closes #160) (#161)

**File**: `.claude/settings.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
         "hooks": [
           {
             "type": "command",
-            "command": "bash /home/tono/multi-agent-shogun/scripts/stop_hook_inbox.sh",
+            "command": "bash scripts/stop_hook_inbox.sh",
             "timeout": 60
           }
         ]
```

---

### Incident Patch 9: `84c8e82b` (2026-05-22)
**Commit Message**: fix: keep OpenCode runtime variants out of tracked output

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@
 
 # Multi-CLI: OpenCode agent file
 !.opencode/agents/*.md
+.opencode/agents/*-runtime.md
 
 # Multi-CLI: OpenCode custom tools
 !.opencode/tools/
```

**File**: `.opencode/agents/ashigaru1.md` (modified, +1/-3)
```diff
@@ -4,8 +4,6 @@ mode: primary
 # Auto-generated by build_instructions.sh — do not edit manually.
 # Source: instructions/roles/ashigaru_role.md + instructions/common/* + instructions/cli_specific/opencode_tools.md
 # grep intentionally inherits '*: allow'; OpenCode grep permission rules match the search regex, not file paths.
-model: openrouter/minimax/minimax-m2.5
-variant: xhigh
 permission:
   '*': allow
   edit: &id002
@@ -730,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru2.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru3.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru4.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

---

### Incident Patch 10: `18a3e3e3` (2026-05-22)
**Commit Message**: fix: sync OpenCode variants via agent config

**File**: `.opencode/agents/ashigaru1.md` (modified, +3/-0)
```diff
@@ -4,6 +4,8 @@ mode: primary
 # Auto-generated by build_instructions.sh — do not edit manually.
 # Source: instructions/roles/ashigaru_role.md + instructions/common/* + instructions/cli_specific/opencode_tools.md
 # grep intentionally inherits '*: allow'; OpenCode grep permission rules match the search regex, not file paths.
+model: openrouter/minimax/minimax-m2.5
+variant: xhigh
 permission:
   '*': allow
   edit: &id002
@@ -728,6 +730,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru2.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru3.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru4.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru5.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

#### Recent Merged Pull Requests:
- **PR #168** (closed): feat(guard): Hook #7 — 上流 repo への gh pr create を機械ブロック (@halsk)
- **PR #167** (closed): feat(scripts): macOS Keychain 秘密キャッシュ helper (cmd_514) (@halsk)
- **PR #166** (closed): feat(gunshi2): Fable 5 第二軍師を swarm に常設追加 (創造/知識業務専任) (@halsk)
- **PR #162** (closed): Harden agent startup & setup (inbox, hooks, MCP, permissions) (@kazumori102)
- **PR #161** (2026-06-06): fix: use relative path for stop hook in .claude/settings.json (closes #160) (@mskz-ptplus-jp)
- **PR #157** (closed): docs: TVFプロトコル4層設計反映 (cmd_510 v2 / cmd_517) (@ysaitogrander)
- **PR #155** (2026-06-06): feat: add Cursor Agent CLI (cursor-agent) support (@sousuke0422)
- **PR #154** (2026-06-06): Add Antigravity CLI support (@TsukinowaRin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
