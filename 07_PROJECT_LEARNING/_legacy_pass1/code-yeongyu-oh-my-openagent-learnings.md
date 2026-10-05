# Forensic Learning Record (Deep Inspection): code-yeongyu/oh-my-openagent

> **Canonical Artifact**: `07_PROJECT_LEARNING/code-yeongyu-oh-my-openagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:03:20.966Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `code-yeongyu/oh-my-openagent`
- **Description**: OmO: Just type "mass ulw" keyword with your prompt. Now you are the master of graph engineering.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 69687 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/codex-qa/scripts/lib/app-server-client.mjs`
```
// app-server-client.mjs - drive a real `codex app-server` turn for QA.
//
// This is the FIRST-PARTY way to QA the omo Codex plugin: instead of scripting
// the TUI, we speak the app-server's own protocol (newline-delimited JSON over
// stdio - NO "jsonrpc" field) and watch the structured notification stream.
//
//   initialize -> initialized -> thread/start -> turn/start
//   ... collect hook/started + hook/completed (plugin proof)
//   ... collect item/completed agentMessage (assistant text)
//   stop on turn/completed (turn.status == "completed" | "failed")
//
// Env (CODEX_HOME is inherited and MUST already point at the isolated home):
//   MOCK_PORT     port of the mock model server (required; no real API call).
//   PROMPT        user message text (default "say hello").
//   QA_CWD        conversation working dir (default process.cwd()).
//   DEADLINE_MS   hard stop (default 60000).
//   EXPECT_HOOK   comma-separated hook eventNames that MUST complete for exit 0
//                 (e.g. "userPromptSubmit,sessionStart"). Empty = only require
//                 turn/completed.
//   CODEX_BIN     codex binary (default "codex"; PATH lookup, no shell function).
//
// Prints a JSON summary to stdout. Exit 0 iff the turn completed, every
// EXPECT_HOOK fired with status "completed", and no hook completed failed.
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export function parseExpectedHooks(value) {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function summarizeRun({ turnStatus, assistantText, threadId, turnId, expectHook, hooks, stderr }) {
  const completed = new Set(
    hooks
      .filter((h) => h.method === "hook/completed" && h.status === "completed")
      .map((h) => h.eventName),
  );
  const missingHooks = expectHook.filter((eventName) => !completed.has(eventName));
  const failedHooks = hooks.filter((h) => h.method === "hook/completed" && h.status !== "completed");
  const ok = turnStatus === "completed" && missingHooks.length === 0 && failedHooks.length === 0;
  return {
    ok,
    turnStatus,
    assistantText,
    threadId,
    turnId,
    expectHook,
    missingHooks,
    failedHooks,
    hooks,
    stderrTail: stderr.split("\n").slice(-10).join("\n"),
  };
}

function main() {
  const CODEX_BIN = process.env.CODEX_BIN || "codex";
  const MOCK_PORT = process.env.MOCK_PORT;
  const PROMPT = process.env.PROMPT || "say hello";
  const CWD = process.env.QA_CWD || process.cwd();
  const DEADLINE_MS = Number(process.env.DEADLINE_MS || 60000);
  const EXPECT = parseExpectedHooks(process.env.EXPECT_HOOK || "");

  if (!MOCK_PORT) {
    console.error("app-server-client: MOCK_PORT is required (start lib/mock-model.mjs first)");
    process.exit(2);
  }

  // Config overrides force codex onto the local mock provider, never the real one.
  const overrides = [
    `model="mock-model"`,
    `model_provider="mock_provider"`,
    `model_providers.mock_provider.name="codex-qa mock"`,
    `model_providers.mock_provider.base_url="http://127.0.0.1:${MOCK_PORT}/v1"`,
    `model_providers.mock_provider.wire_api="responses"`,
    `model_providers.mock_provider.request_max_retries=0`,
    `model_providers.mock_provider.stream_max_retries=0`,
    `approval_policy="never"`,
    `sandbox_mode="read-only"`,
  ];
  const args = overrides.flatMap((o) => ["-c", o]).concat("app-server");

  const child = spawn(CODEX_BIN, args, { stdio: ["pipe", "pipe", "pipe"], env: process.env });
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c));

  const hooks = [];
  let assistantText = null;
  let threadId = null;
  let turnId = null;
  let turnStatus = null;
  let buf = "";
  let finished = false;

  const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");

  function finish() {
    if (finished) return;
    finished = true;
    try {
      child.kill("SIGTERM");
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      stderr += `\n[driver] failed to terminate app-server: ${message}\n`;
    }
    const summary = summarizeRun({ turnStatus, assistantText, threadId, turnId, expectHook: EXPECT, hooks, stderr });
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.ok ? 0 : 1);
  }

  function handle(msg) {
    if (msg.id === 1 && msg.result) {
      send({ method: "initialized" });
      send({ id: 2, method: "thread/start", params: { cwd: CWD } });
    } else if (msg.id === 2 && msg.result) {
      threadId = msg.result.thread?.id;
      send({ id: 3, method: "turn/start", params: { threadId, input: [{ type: "text", text: PROMPT }] } });
    } else if (msg.id === 3 && msg.result) {
      turnId = msg.result.turn?.id;
    } else if (msg.method === "hook/started" || msg.method === "hook/completed") {
      const run = msg.params?.run || {};
      hooks.push({
        method: msg.method,
        eventName: run.eventName,
        status: run.status,
        source: run.source ?? run.pluginId,
        pluginId: run.pluginId,
        hookName: run.hookName ?? run.name,
        runId: run.id,
      });
    } else if (msg.method === "item/completed") {
      const item = msg.params?.item;
      if (item?.type === "agentMessage" && typeof item.text === "string") assistantText = item.text;
    } else if (msg.method === "turn/completed") {
      turnStatus = msg.params?.turn?.status;
      finish();
    }
  }

  child.stdout.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
      handle(msg);
    }
  });
  child.on("exit", (code) => {
    if (finished) return;
    console.log(JSON.stringify({ ok: false, exitCode: code, turnStatus, hooks, stderrTail: stderr.split("\n").slice(-15).join("\n") }, null, 2));
    process.exit(1);
  });

  send({ id: 1, method: "initialize", params: { clientInfo: { name: "codex-qa", version: "0.1.0" }, capabilities: { experimentalApi: true, requestAttestation: false } } });
  setTimeout(() => { stderr += "\n[driver] deadline reached\n"; finish(); }, DEADLINE_MS);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

```

### Core Architecture Module: `.agents/skills/codex-qa/scripts/lib/mock-model.mjs`
```
// mock-model.mjs - a local OpenAI Responses-API SSE server for codex-qa.
//
// WHY: codex talks to a model over HTTP. Pointing a custom model_provider at
// this server lets QA drive a REAL codex turn end-to-end with NO real API
// call, no key, and no network egress - so we test OUR plugin, never OpenAI.
//
// It answers POST .../responses with the 3-event Responses stream codex needs
// for one assistant message (response.created -> output_item.done ->
// response.completed). Each POST gets a fresh response, so a turn that makes
// several model requests (session-start probe + the turn itself) is covered.
//
// Env:
//   MOCK_PORT  TCP port to bind (default 0 = OS-assigned; the chosen port is
//              printed as "MOCK_LISTENING <port>" on stdout so the caller can
//              read it back).
//   MOCK_TEXT  assistant message text (default below).
import { createServer } from "node:http";

const TEXT = process.env.MOCK_TEXT || "Hello from the codex-qa mock model.";

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url && req.url.endsWith("/responses")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const sse = (obj) => res.write(`event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`);
      sse({ type: "response.created", response: { id: "resp-1" } });
      sse({
        type: "response.output_item.done",
        item: {
          type: "message",
          role: "assistant",
          id: "msg-1",
          content: [{ type: "output_text", text: TEXT }],
        },
      });
      sse({
        type: "response.completed",
        response: { id: "resp-1", usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } },
      });
      res.end();
    });
    return;
  }
  res.writeHead(404).end();
});

const port = Number(process.env.MOCK_PORT || 0);
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`MOCK_LISTENING ${server.address().port}\n`);
});

```

### Core Architecture Module: `.agents/skills/github-triage/scripts/gh_fetch.py`
```
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "typer>=0.12.0",
#     "rich>=13.0.0",
# ]
# ///
"""
GitHub Issues/PRs Fetcher with Exhaustive Pagination.

Fetches ALL issues and/or PRs from a GitHub repository using gh CLI.
Implements proper pagination to ensure no items are missed.

Usage:
    ./gh_fetch.py issues                    # Fetch all issues
    ./gh_fetch.py prs                       # Fetch all PRs
    ./gh_fetch.py all                       # Fetch both issues and PRs
    ./gh_fetch.py issues --hours 48         # Issues from last 48 hours
    ./gh_fetch.py prs --state open          # Only open PRs
    ./gh_fetch.py all --repo owner/repo     # Specify repository
"""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, TaskID
from rich.table import Table

app = typer.Typer(
    name="gh_fetch",
    help="Fetch GitHub issues/PRs with exhaustive pagination.",
    no_args_is_help=True,
)
console = Console()

BATCH_SIZE = 500  # Maximum allowed by GitHub API


class ItemState(str, Enum):
    ALL = "all"
    OPEN = "open"
    CLOSED = "closed"


class OutputFormat(str, Enum):
    JSON = "json"
    TABLE = "table"
    COUNT = "count"


async def run_gh_command(args: list[str]) -> tuple[str, str, int]:
    """Run gh CLI command asynchronously."""
    proc = await asyncio.create_subprocess_exec(
        "gh",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return stdout.decode(), stderr.decode(), proc.returncode or 0


async def get_current_repo() -> str:
    """Get the current repository from gh CLI."""
    stdout, stderr, code = await run_gh_command(
        ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]
    )
    if code != 0:
        console.print(f"[red]Error getting current repo: {stderr}[/red]")
        raise typer.Exit(1)
    return stdout.strip()


async def fetch_items_page(
    repo: str,
    item_type: str,  # "issue" or "pr"
    state: str,
    limit: int,
    search_filter: str = "",
) -> list[dict]:
    """Fetch a single page of issues or PRs."""
    cmd = [
        item_type,
        "list",
        "--repo",
        repo,
        "--state",
        state,
        "--limit",
        str(limit),
        "--json",
        "number,title,state,createdAt,updatedAt,labels,author,body",
    ]
    if search_filter:
        cmd.extend(["--search", search_filter])

    stdout, stderr, code = await run_gh_command(cmd)
    if code != 0:
        console.print(f"[red]Error fetching {item_type}s: {stderr}[/red]")
        return []

    try:
        return json.loads(stdout) if stdout.strip() else []
    except json.JSONDecodeError:
        console.print(f"[red]Error parsing {item_type} response[/red]")
        return []


async def fetch_all_items(
    repo: str,
    item_type: str,
    state: str,
    hours: int | None,
    progress: Progress,
    task_id: TaskID,
) -> list[dict]:
    """Fetch ALL items with exhaustive pagination."""
    all_items: list[dict] = []
    page = 1

    progress.update(task_id, description=f"[cyan]Fetching {item_type}s page {page}...")
    items = await fetch_items_page(repo, item_type, state, BATCH_SIZE)
    fetched_count = len(items)
    all_items.extend(items)

    console.print(f"[dim]Page {page}: fetched {fetched_count} {item_type}s[/dim]")

    while fetched_count == BATCH_SIZE:
        page += 1
        progress.update(
            task_id, description=f"[cyan]Fetching {item_type}s page {page}..."
        )

        last_created = all_items[-1].get("createdAt", "")
        if not last_created:
            break

        search_filter = f"created:<{last_created}"
        items = await fetch_items_page(
            repo, item_type, state, BATCH_SIZE, search_filter
        )
        fetched_count = len(items)

        if fetched_count == 0:
            break

        existing_numbers = {item["number"] for item in all_items}
        new_items = [item for item in items if item["number"] not in existing_numbers]
        all_items.extend(new_items)

        console.print(
            f"[dim]Page {page}: fetched {fetched_count}, added {len(new_items)} new (total: {len(all_items)})[/dim]"
        )

        if page > 20:
            console.print("[yellow]Safety limit reached (20 pages)[/yellow]")
            break

    if hours is not None:
        cutoff = datetime.now(UTC) - timedelta(hours=hours)
        cutoff_str = cutoff.isoformat()

        original_count = len(all_items)
        all_items = [
            item
            for item in all_items
            if item.get("createdAt", "") >= cutoff_str
            or item.get("updatedAt", "") >= cutoff_str
        ]
        filtered_count = original_count - len(all_items)
        if filtered_count > 0:
            console.print(
                f"[dim]Filtered out {filtered_count} items older than {hours} hours[/dim]"
            )

    return all_items


def display_table(items: list[dict], item_type: str) -> None:
    """Display items in a Rich table."""
    table = Table(title=f"{item_type.upper()}s ({len(items)} total)")
    table.add_column("#", style="cyan", width=6)
    table.add_column("Title", style="white", max_width=50)
    table.add_column("State", style="green", width=8)
    table.add_column("Author", style="yellow", width=15)
    table.add_column("Labels", style="magenta", max_width=30)
    table.add_column("Updated", style="dim", width=12)

    for item in items[:50]:
        labels = ", ".join(label.get("name", "") for label in item.get("labels", []))
        updated = item.get("updatedAt", "")[:10]
        author = item.get("author", {}).get("login", "unknown")

        table.add_row(
            str(item.get("number", "")),
            (item.get("title", "")[:47] + "...")
            if len(item.get("title", "")) > 50
            else item.get("title", ""),
            item.get("state", ""),
            author,
            (labels[:27] + "...") if len(labels) > 30 else labels,
            updated,
        )

    console.print(table)
    if len(items) > 50:
        console.print(f"[dim]... and {len(items) - 50} more items[/dim]")


@app.command()
def issues(
    repo: Annotated[
        str | None, typer.Option("--repo", "-r", help="Repository (owner/repo)")
    ] = None,
    state: Annotated[
        ItemState, typer.Option("--state", "-s", help="Issue state filter")
    ] = ItemState.ALL,
    hours: Annotated[
        int | None,
        typer.Option(
            "--hours", "-h", help="Only issues from last N hours (created or updated)"
        ),
    ] = None,
    output: Annotated[
        OutputFormat, typer.Option("--output", "-o", help="Output format")
    ] = OutputFormat.TABLE,
) -> None:
    """Fetch all issues with exhaustive pagination."""

    async def async_main() -> None:
        target_repo = repo or await get_current_repo()

        console.print(f"""
[cyan]Repository:[/cyan] {target_repo}
[cyan]State:[/cyan] {state.value}
[cyan]Time filter:[/cyan] {f"Last {hours} hours" if hours else "All time"}
""")

        with Progress(console=console) as progress:
            task: TaskID = progress.add_task("[cyan]Fetching issues...", total=None)
            items = await fetch_all_items(
                target_repo, "issue", state.value, hours, progress, task
            )
            progress.update(
                task, description="[green]Complete!", completed=100, total=100
            )

        console.print(
            Panel(f"[green]Found {len(items)} issues[/green]", border_style="green")
        )

        if output == OutputFormat.JSON:
            console.print(json.dumps(items, indent=2, ensure_ascii=False))
        elif output == OutputFormat.TABLE:
            displ
```

### Core Architecture Module: `.agents/skills/opencode-qa/scripts/lib/fake-openai-branches.mjs`
```
export const branchCounts = {
  title: 0,
  "parent-tool-call": 0,
  "parent-hold": 0,
  child: 0,
  wake: 0,
  default: 0,
}

export const latches = {
  parentToolCallIssued: false,
  parentHoldIssued: false,
}

export function hasToolResult(inputStr) {
  return (
    inputStr.includes('"type":"function_call_output"') ||
    inputStr.includes('"type": "function_call_output"') ||
    inputStr.includes('"type":"tool_result"') ||
    inputStr.includes('"type": "tool_result"') ||
    inputStr.includes('"role":"tool"') ||
    inputStr.includes('"role": "tool"')
  )
}

export function selectBranch(inputStr) {
  const isTitle = inputStr.includes("Generate a title")
  const isSplitProbe = inputStr.includes("Run the split probe")
  const isChild = inputStr.includes("SPLIT_CHILD_TASK")
  const isWake = inputStr.includes("[BACKGROUND TASK")
  const hasResult = hasToolResult(inputStr)

  if (isTitle) return "title"
  if (isChild && !isSplitProbe) return "child"
  if (isWake) return "wake"
  if (isSplitProbe && !hasResult && !latches.parentToolCallIssued) return "parent-tool-call"
  if (isSplitProbe && (hasResult || latches.parentToolCallIssued) && !latches.parentHoldIssued) return "parent-hold"
  return "default"
}

```

### Core Architecture Module: `.agents/skills/opencode-qa/scripts/lib/fake-openai-events.mjs`
```
import fs from "node:fs"

export function completedUsage() {
  return {
    input_tokens: 10,
    output_tokens: 5,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens_details: { reasoning_tokens: 0 },
  }
}

export function sendSse(res, events) {
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
  })
  for (const event of events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  res.write("data: [DONE]\n\n")
  res.end()
}

export function textEvents(callCount, text) {
  const id = `resp_${callCount}`
  const item = `msg_${callCount}`
  return [
    {
      type: "response.created",
      response: { id, created_at: Math.floor(Date.now() / 1000), model: "gpt-fake" },
    },
    {
      type: "response.output_item.added",
      output_index: 0,
      item: { type: "message", id: item },
    },
    {
      type: "response.output_text.delta",
      item_id: item,
      output_index: 0,
      delta: text,
    },
    {
      type: "response.output_item.done",
      output_index: 0,
      item: { type: "message", id: item },
    },
    {
      type: "response.completed",
      response: { usage: completedUsage() },
    },
  ]
}

export function toolCallEvents(callCount, name, callId, argsObj) {
  const id = `resp_${callCount}`
  const fcId = `fc_${callCount}`
  const argsStr = JSON.stringify(argsObj)
  return [
    {
      type: "response.created",
      response: { id, created_at: Math.floor(Date.now() / 1000), model: "gpt-fake" },
    },
    {
      type: "response.output_item.added",
      output_index: 0,
      item: {
        type: "function_call",
        id: fcId,
        call_id: callId,
        name,
        arguments: "",
      },
    },
    {
      type: "response.function_call_arguments.delta",
      item_id: fcId,
      output_index: 0,
      delta: argsStr,
    },
    {
      type: "response.output_item.done",
      output_index: 0,
      item: {
        type: "function_call",
        id: fcId,
        call_id: callId,
        name,
        arguments: argsStr,
        status: "completed",
      },
    },
    {
      type: "response.completed",
      response: { usage: completedUsage() },
    },
  ]
}

export function appendLog(logFile, line) {
  try {
    fs.appendFileSync(logFile, line)
  } catch {
  }
}

```

### Core Architecture Module: `.agents/skills/opencode-qa/scripts/lib/fake-openai-server.mjs`
```
#!/usr/bin/env node
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { sendSse, textEvents, toolCallEvents, appendLog } from "./fake-openai-events.mjs"
import { branchCounts, latches, selectBranch } from "./fake-openai-branches.mjs"

const requestedPort = Number(process.env.FAKE_OPENAI_PORT ?? 0)
const logFile = process.env.FAKE_LLM_LOG ?? path.join(os.tmpdir(), "fake-llm.log")

let callCount = 0

function logBranch(branch, extra = {}) {
  const now = new Date().toISOString()
  const line = `[${now}] branch=${branch} call=${callCount}${Object.keys(extra).length ? " " + JSON.stringify(extra) : ""}\n`
  appendLog(logFile, line)
  process.stdout.write(line)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", (chunk) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
    req.on("error", reject)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok")
    return
  }

  if (req.method !== "POST" || !req.url?.includes("/responses")) {
    res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "not found" }))
    return
  }

  callCount++
  const raw = await readBody(req)
  let body
  try { body = JSON.parse(raw) } catch { body = {} }

  const inputStr = JSON.stringify(body.input ?? body.messages ?? body)
  const branch = selectBranch(inputStr)
  branchCounts[branch] = (branchCounts[branch] ?? 0) + 1
  logBranch(branch)

  if (branch === "title") {
    sendSse(res, textEvents(callCount, "wake split probe session"))
    return
  }

  if (branch === "child") {
    sendSse(res, textEvents(callCount, "DONE"))
    return
  }

  if (branch === "wake") {
    await sleep(3000)
    sendSse(res, textEvents(callCount, `WAKE_ACK ${callCount}`))
    return
  }

  if (branch === "parent-tool-call") {
    latches.parentToolCallIssued = true
    sendSse(res, toolCallEvents(callCount, "task", `call_agent_${callCount}`, {
      description: "split probe child",
      prompt: "SPLIT_CHILD_TASK: reply exactly DONE",
      subagent_type: "explore",
      run_in_background: true,
      load_skills: [],
    }))
    return
  }

  if (branch === "parent-hold") {
    latches.parentHoldIssued = true
    sendSse(res, toolCallEvents(callCount, "bash", `call_bash_${callCount}`, {
      command: "i=0; while [ $i -lt 8 ]; do i=$((i+1)); sleep 1; done",
      description: "hold turn",
    }))
    return
  }

  if (inputStr.includes("say exactly: TUI_NOREG_OK")) {
    sendSse(res, textEvents(callCount, "TUI_NOREG_OK"))
    return
  }
  sendSse(res, textEvents(callCount, `fake response ${callCount}`))
})

function logFinalCounts() {
  const summary = Object.entries(branchCounts).map(([k, v]) => `${k}=${v}`).join(" ")
  const line = `[${new Date().toISOString()}] FINAL_COUNTS ${summary}\n`
  appendLog(logFile, line)
  process.stdout.write(line)
}

server.listen(requestedPort, "127.0.0.1", () => {
  const addr = server.address()
  const port = typeof addr === "object" && addr !== null ? addr.port : requestedPort
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true })
    appendLog(logFile, `[${new Date().toISOString()}] START port=${port}\n`)
  } catch {}
  process.stdout.write(`fake-openai listening on ${port}\n`)
})

process.on("SIGTERM", () => { logFinalCounts(); server.close(() => process.exit(0)) })
process.on("SIGINT", () => { logFinalCounts(); server.close(() => process.exit(0)) })

```

### Core Architecture Module: `.agents/skills/senpi-qa/scripts/resolve-evidence-dir.mjs`
```
#!/usr/bin/env node
// resolve-evidence-dir.mjs - pick the canonical evidence directory for a live Senpi QA run.
//
// Live Senpi QA artifacts belong under .omo/evidence/omo-senpi-adapter/<slug>/ and nowhere else.
// That path is the repository-standard location every AGENTS.md rule points at, and it is gitignored,
// so a hand-typed alternative (local-ignore/qa-evidence/..., .qa-evidence/ at the worktree root, a temp
// dir, a traversal) either strands the evidence or lands it in a commit (#8703). Resolving through
// this script makes the path a checked contract instead of a convention.
//
// The resolver COMPUTES and VALIDATES only; creating the directory stays the caller's decision, so
// a rejected slug never leaves a stray directory behind.
//
//   node resolve-evidence-dir.mjs --repo-root "$(git rev-parse --show-toplevel)" --slug 20260820-my-run
//
// Prints the absolute path to stdout. Exit 0 iff the root is a git worktree and the slug is safe.
import { existsSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const EVIDENCE_RELATIVE_ROOT = join(".omo", "evidence", "omo-senpi-adapter")

// One relative segment: lowercase alphanumerics joined by single hyphens. This is what makes the
// path predictable - it also rejects every separator, traversal, and absolute form outright, since
// none of them can match.
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * @param {{ repoRoot: string, slug: string }} input
 * @returns {string} absolute evidence directory; NOT created
 */
export function resolveEvidenceDir({ repoRoot, slug }) {
  if (typeof repoRoot !== "string" || repoRoot.length === 0) {
    throw new Error("repoRoot must be a non-empty path to a git worktree")
  }
  if (!existsSync(join(repoRoot, ".git"))) {
    throw new Error(`repoRoot is not a git worktree: ${repoRoot}`)
  }
  if (typeof slug !== "string" || !SAFE_SLUG.test(slug)) {
    throw new Error(
      `slug must be one lowercase alphanumeric-and-hyphen segment (got ${JSON.stringify(slug)}); ` +
        `evidence lives under ${EVIDENCE_RELATIVE_ROOT}/<slug>`,
    )
  }
  return resolve(repoRoot, EVIDENCE_RELATIVE_ROOT, slug)
}

const isDirectRun =
  process.argv[1] !== undefined &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))

if (isDirectRun) {
  const args = process.argv.slice(2)
  const read = (flag) => {
    const at = args.indexOf(flag)
    return at === -1 ? undefined : args[at + 1]
  }
  try {
    const dir = resolveEvidenceDir({ repoRoot: read("--repo-root") ?? process.cwd(), slug: read("--slug") })
    process.stdout.write(`${dir}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
}

```

### Core Architecture Module: `.opencode/skills/github-triage/scripts/gh_fetch.py`
```
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "typer>=0.12.0",
#     "rich>=13.0.0",
# ]
# ///
"""
GitHub Issues/PRs Fetcher with Exhaustive Pagination.

Fetches ALL issues and/or PRs from a GitHub repository using gh CLI.
Implements proper pagination to ensure no items are missed.

Usage:
    ./gh_fetch.py issues                    # Fetch all issues
    ./gh_fetch.py prs                       # Fetch all PRs
    ./gh_fetch.py all                       # Fetch both issues and PRs
    ./gh_fetch.py issues --hours 48         # Issues from last 48 hours
    ./gh_fetch.py prs --state open          # Only open PRs
    ./gh_fetch.py all --repo owner/repo     # Specify repository
"""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, TaskID
from rich.table import Table

app = typer.Typer(
    name="gh_fetch",
    help="Fetch GitHub issues/PRs with exhaustive pagination.",
    no_args_is_help=True,
)
console = Console()

BATCH_SIZE = 500  # Maximum allowed by GitHub API


class ItemState(str, Enum):
    ALL = "all"
    OPEN = "open"
    CLOSED = "closed"


class OutputFormat(str, Enum):
    JSON = "json"
    TABLE = "table"
    COUNT = "count"


async def run_gh_command(args: list[str]) -> tuple[str, str, int]:
    """Run gh CLI command asynchronously."""
    proc = await asyncio.create_subprocess_exec(
        "gh",
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    return stdout.decode(), stderr.decode(), proc.returncode or 0


async def get_current_repo() -> str:
    """Get the current repository from gh CLI."""
    stdout, stderr, code = await run_gh_command(
        ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]
    )
    if code != 0:
        console.print(f"[red]Error getting current repo: {stderr}[/red]")
        raise typer.Exit(1)
    return stdout.strip()


async def fetch_items_page(
    repo: str,
    item_type: str,  # "issue" or "pr"
    state: str,
    limit: int,
    search_filter: str = "",
) -> list[dict]:
    """Fetch a single page of issues or PRs."""
    cmd = [
        item_type,
        "list",
        "--repo",
        repo,
        "--state",
        state,
        "--limit",
        str(limit),
        "--json",
        "number,title,state,createdAt,updatedAt,labels,author,body",
    ]
    if search_filter:
        cmd.extend(["--search", search_filter])

    stdout, stderr, code = await run_gh_command(cmd)
    if code != 0:
        console.print(f"[red]Error fetching {item_type}s: {stderr}[/red]")
        return []

    try:
        return json.loads(stdout) if stdout.strip() else []
    except json.JSONDecodeError:
        console.print(f"[red]Error parsing {item_type} response[/red]")
        return []


async def fetch_all_items(
    repo: str,
    item_type: str,
    state: str,
    hours: int | None,
    progress: Progress,
    task_id: TaskID,
) -> list[dict]:
    """Fetch ALL items with exhaustive pagination."""
    all_items: list[dict] = []
    page = 1

    progress.update(task_id, description=f"[cyan]Fetching {item_type}s page {page}...")
    items = await fetch_items_page(repo, item_type, state, BATCH_SIZE)
    fetched_count = len(items)
    all_items.extend(items)

    console.print(f"[dim]Page {page}: fetched {fetched_count} {item_type}s[/dim]")

    while fetched_count == BATCH_SIZE:
        page += 1
        progress.update(
            task_id, description=f"[cyan]Fetching {item_type}s page {page}..."
        )

        last_created = all_items[-1].get("createdAt", "")
        if not last_created:
            break

        search_filter = f"created:<{last_created}"
        items = await fetch_items_page(
            repo, item_type, state, BATCH_SIZE, search_filter
        )
        fetched_count = len(items)

        if fetched_count == 0:
            break

        existing_numbers = {item["number"] for item in all_items}
        new_items = [item for item in items if item["number"] not in existing_numbers]
        all_items.extend(new_items)

        console.print(
            f"[dim]Page {page}: fetched {fetched_count}, added {len(new_items)} new (total: {len(all_items)})[/dim]"
        )

        if page > 20:
            console.print("[yellow]Safety limit reached (20 pages)[/yellow]")
            break

    if hours is not None:
        cutoff = datetime.now(UTC) - timedelta(hours=hours)
        cutoff_str = cutoff.isoformat()

        original_count = len(all_items)
        all_items = [
            item
            for item in all_items
            if item.get("createdAt", "") >= cutoff_str
            or item.get("updatedAt", "") >= cutoff_str
        ]
        filtered_count = original_count - len(all_items)
        if filtered_count > 0:
            console.print(
                f"[dim]Filtered out {filtered_count} items older than {hours} hours[/dim]"
            )

    return all_items


def display_table(items: list[dict], item_type: str) -> None:
    """Display items in a Rich table."""
    table = Table(title=f"{item_type.upper()}s ({len(items)} total)")
    table.add_column("#", style="cyan", width=6)
    table.add_column("Title", style="white", max_width=50)
    table.add_column("State", style="green", width=8)
    table.add_column("Author", style="yellow", width=15)
    table.add_column("Labels", style="magenta", max_width=30)
    table.add_column("Updated", style="dim", width=12)

    for item in items[:50]:
        labels = ", ".join(label.get("name", "") for label in item.get("labels", []))
        updated = item.get("updatedAt", "")[:10]
        author = item.get("author", {}).get("login", "unknown")

        table.add_row(
            str(item.get("number", "")),
            (item.get("title", "")[:47] + "...")
            if len(item.get("title", "")) > 50
            else item.get("title", ""),
            item.get("state", ""),
            author,
            (labels[:27] + "...") if len(labels) > 30 else labels,
            updated,
        )

    console.print(table)
    if len(items) > 50:
        console.print(f"[dim]... and {len(items) - 50} more items[/dim]")


@app.command()
def issues(
    repo: Annotated[
        str | None, typer.Option("--repo", "-r", help="Repository (owner/repo)")
    ] = None,
    state: Annotated[
        ItemState, typer.Option("--state", "-s", help="Issue state filter")
    ] = ItemState.ALL,
    hours: Annotated[
        int | None,
        typer.Option(
            "--hours", "-h", help="Only issues from last N hours (created or updated)"
        ),
    ] = None,
    output: Annotated[
        OutputFormat, typer.Option("--output", "-o", help="Output format")
    ] = OutputFormat.TABLE,
) -> None:
    """Fetch all issues with exhaustive pagination."""

    async def async_main() -> None:
        target_repo = repo or await get_current_repo()

        console.print(f"""
[cyan]Repository:[/cyan] {target_repo}
[cyan]State:[/cyan] {state.value}
[cyan]Time filter:[/cyan] {f"Last {hours} hours" if hours else "All time"}
""")

        with Progress(console=console) as progress:
            task: TaskID = progress.add_task("[cyan]Fetching issues...", total=None)
            items = await fetch_all_items(
                target_repo, "issue", state.value, hours, progress, task
            )
            progress.update(
                task, description="[green]Complete!", completed=100, total=100
            )

        console.print(
            Panel(f"[green]Found {len(items)} issues[/green]", border_style="green")
        )

        if output == OutputFormat.JSON:
            console.print(json.dumps(items, indent=2, ensure_ascii=False))
        elif output == OutputFormat.TABLE:
            displ
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9198** (2026-09-29): **omo update can exit 0 and leave the previous version installed on a Bun-global install**
  *Symptoms*: ## Summary  On a Bun-global install, `omo update` can finish without moving to the release that is already live on npm, and nothing tells the user it didn't update. Right after 5.1.2 shipped, `omo update` on a machine running 5.1.1 ran for about 7 minutes and left 5.1.1 installed. `bun add -g omo-ai@5.1.2` on the same machine then installed 5.1.2 in 3.4 s.  ## Reproduction (observed)  1. npm `omo-ai` dist-tag `latest` = 5.1.2. The registry document is `last-modified: 2026-09-29T14:01:47Z`, the tarball returns 200, and GitHub release v5.1.2 is Latest. 2. At about 14:10Z, on macOS arm64 with Bun 1.4.2 and a Bun-global install of `omo-ai@5.1.1` (28 global packages, host load average 40-60), run `omo update`. 3. `omo update` spawns `bun add -g omo-ai`. After about 7 minutes it exits, and `omo --version` still prints `omo 5.1.1 (engine: senpi 2026.9.29)`. 4. On the same machine, `bun add -g omo-ai@5.1.2` finishes in 3.4 s, and `omo --version` then prints `omo 5.1.2 (engine: senpi 2026.9.29-3)`.  A clean control does not reproduce it. With a temporary `BUN_INSTALL` and cache, installing `omo-ai@5.1.1` and then running the bare `bun add -g omo-ai` moves to 5.1.2 in 6.6 s. So the bare spec works in a small tree. What fails is the update path on a real install.  ## Expected  `omo update` ends on the version the channel's dist-tag names, or it fails loudly. It must not exit with the old version still installed and nothing to warn the user.  ## Actual  - `packages/omo-native/bin/lib/pac
  **Post-Mortem & Fix Analysis**:
  > Fix is up in #9200.  - Root cause confirmed on dev 79ab21eb77: `updateTarget()` spawned the unpinned spec, and `runSelfUpdate()` counted any manager exit 0 as success. - RED on dev: 11 new tests, `0 pass / 11 fail`. This includes the unchanged-after-exit-0 case, which returned 0. - GREEN: `bun test packages/omo-native/test` -> 564 pass, 0 fail; `bun run typecheck` -> exit 0. - Real update in an isolated `BUN_INSTALL`: `omo-ai@5.1.1` -> `omo update` runs `bun add -g omo-ai@5.1.2` -> `omo --version` prints `omo 5.1.2 (engine: senpi 2026.9.29-3)`. A second run says up to date and installs nothing. A package manager that exits 0 without installing now ends with `omo is still 5.1.1; 5.1.2 is published` plus the retry command, exit 1. 
  > Fixed by #9200, merged into `dev` as merge commit 1153254903c77e4f9007f5ec49021d24cbd1d883 (parents 9aaae4d221, ba73450297). It ships in the next omo patch.  Evidence on the merged head: - CI: 23 pass, 7 skipping, 0 fail. - `bun test packages/omo-native/test`: 564 pass, 0 fail. - The 11 new tests went from 0/11 on dev to 11/11 with the fix. - `bun run typecheck`: exit 0. - Real update in an isolated `BUN_INSTALL`: `omo-ai@5.1.1` -> `omo update` -> `bun add -g omo-ai@5.1.2` -> `omo --version` prints `omo 5.1.2 (engine: senpi 2026.9.29-3)`. - A package manager that exits 0 without installing now ends with `omo is still 5.1.1; 5.1.2 is published` and the retry command, exit 1. 

- **Issue #9147** (2026-09-29): **[Bug]: OpenCode -> Native migration drops metis/momus agent models silently; Native plan agents fall back to builtin chains**
  *Symptoms*: ## Summary  A user moving from the OpenCode edition to OmO Native can lose their per-agent model settings without any notice. Native's builtin agents then fall back to their builtin chains, which is how a Native `plan-consultant` ended up on a gateway model in #9146. #9146 fixes the routing itself; this issue covers the migration gap that let it happen.  ## What happens today  - `omo setup` (since #8846, fixing #8816) reads the OpenCode edition's `agents.*` and carries over only the agents whose names Native also uses. For every other name it prints `omo has no agent of that name ...; route that work through a category instead` (`packages/omo-native/bin/lib/setup-opencode-models.js:206-214`). - The OpenCode edition's plan agents have different names from their Native counterparts: `metis` (pre-planning consultant) and `momus` (plan reviewer) versus Native's `plan-consultant` and `plan-reviewer`. Setup does not map them, so a model the user chose for `metis`/`momus` is reported as unmappable instead of carried to the Native agent that does the same job. - The startup config migration (`runSenpiStartupMigration`, group `2026-07-opencode-config-unification`) moves legacy OpenCode-edition files into the `[opencode]` harness block. A user who never runs `omo setup` gets no message at all: their `[opencode]` `agents.*` exist, Native ignores them, and the Native builtin agents silently run their builtin chains.  ## Expected (ideal state)  - Setup maps OpenCode-edition agent names to
  **Post-Mortem & Fix Analysis**:
  > Fixed by #9171 (merge commit de133a361ec1804470ff59f2802a4298e3686915), together with #9167. Thanks @MoerAI for #9167, which maps `metis` -> `plan-consultant` and `momus` -> `plan-reviewer` in `omo setup`; this PR reuses that mapping.  **What landed** - `omo setup` offers `agents.metis` / `agents.momus` models as `plan-consultant` / `plan-reviewer` (#9167). - Native's first start reports every OpenCode-edition agent/category model setting that Native does not use. It shows **one** warning with "run omo setup to carry them over" and, for each setting, the exact `"[native]": { ... }` member to add. Only the `2026-09-opencode-routing-notice` marker is written, so later starts are quiet (#9171). - `omo doctor` prints the same line as `INFO` for as long as the gap exists.  Why a notice instead of an automatic copy: #7270 deliberately stopped the automatic legacy migration from importing agent and category registries. `omo setup` carries them after checking each model against the engine and 

- **Issue #9146** (2026-09-29): **[Bug]: Builtin category/agent chains silently route to OpenRouter (and other gateways) the user never configured**
  *Symptoms*: ## Summary  Built-in delegation chains (categories and agents) silently route to a provider they do not list. On a machine whose only connected provider is OpenRouter, the builtin categories and agents resolve to `openrouter/anthropic/claude-opus-5.5` and `openrouter/openai/gpt-6-astra`, and the user is billed on OpenRouter for models they never configured. This was reported in the community Discord: the user had no Anthropic provider configured anywhere, yet their OpenRouter key was charged for Claude models until they restricted it to an allowlist.  ## Reproduction  Call the real resolvers on `dev` (1b3bb502b) with a registry that holds only OpenRouter's catalog. No network is involved.  ```ts resolveCategory("visual-engineering", {}, openRouterOnlyRegistry)   // -> openrouter/anthropic/claude-opus-5.5 (max) resolveCategory("ultrabrain", {}, openRouterOnlyRegistry)           // -> openrouter/openai/gpt-6-astra (max) resolveAgent("plan-consultant", agents, openRouterOnlyRegistry)     // -> openrouter/anthropic/claude-opus-5.5 ```  | builtin | resolved to | |---|---| | visual-engineering, artistry, unspecified-high, writing | `openrouter/anthropic/claude-opus-5.5` | | ultrabrain, deep-high | `openrouter/openai/gpt-6-astra` | | deep-low | `openrouter/openai/gpt-5.6-sol` | | quick, explore, librarian | `openrouter/~deepseek/deepseek-flash-latest` | | unspecified-low | `openrouter/xiaomi/mimo-v2.6-pro` | | plan-consultant, omo-native-code-reviewer | `openrouter/anthropic/claude-
  **Post-Mortem & Fix Analysis**:
  > Root cause confirmed and fix up in #9148.  - Root cause: `delegate-core` `resolveModelForDelegateTask` fell through to an unfiltered cross-provider fuzzy match after a rung's listed providers missed (shared by both editions), and `senpi-task` gates unwrapped `<gateway>/<vendor>/<id>` ids. The reported `plan-consultant` shape resolved Opus 5.5 through the first path. - RED on dev sources: 54 new cases fail (3 delegate-core, 43 senpi-task, 8 OpenCode delegate-task); GREEN on the branch. - Live run (real engine + plugin, real `openrouter` provider with a fake key pointed at a local request logger, all other egress to a dead proxy): dev plugin sent **8** unrequested OpenRouter requests (Opus 5.5, GPT-6 Astra, deepseek); the fix sends **0**, only the explicitly pinned control model reaches OpenRouter, and each hidden category shows the exact `categories.<name>.model = "openrouter/..."` opt-in line.
  > Closed by #9148, merged as d69d696ac (merge commit) on `dev`.  **What users get:** builtin categories, builtin agents and `model_profile` lanes resolve only on the providers their chains list. A gateway (OpenRouter, opengateway, a Vercel gateway, a custom proxy) is used only when the user pins it; a hidden category names the exact opt-in line (`categories.<name>.model = "<gateway>/<model>"`) in the task notice and in `omo doctor`.  **Evidence** - CI on merged head 9544f8e4f: all required checks green. - RED on dev sources: 54 new cases fail (delegate-core 3, senpi-task 43, OpenCode delegate-task 8); all pass on the branch. - Suites: senpi-task 3005/0, delegate-core 13/0, OpenCode delegate-task 512/0, omo-senpi model-profile 111/0, omo-native coverage 12/0; `tsgo` clean on delegate-core, senpi-task, omo-senpi, omo-native. - Live run (real engine + built plugin, real `openrouter` provider with a fake key pointed at a local request logger, other egress to a dead proxy): dev plugin 8 unreq

- **Issue #9069** (2026-09-28): **Task record diverges from the live child: settled on the first non-retrying agent_end (TTSR nudge, monitor wake) and a start without a session stays running**
  *Symptoms*: ## Summary Split out of #9061 (item "task record status diverges from the live child session"). A process-mode child's task record can say `error` or `completed` while its session keeps running, and a spawn can say "Started" and stay `running` for minutes without ever opening a session.  ## A. `error` while the session keeps working (root cause found) - senpi's builtin TTSR stream rule aborts a bad generation with `ctx.abort("system")`; the aborted run ends with `agent_end` `{ willRetry: false }` (`stopReason: "aborted"`). TTSR then sends its corrective nudge from its `agent_settled` handler with `triggerTurn: true` (`packages/coding-agent/src/core/extensions/builtin/ttsr/index.ts`), so the SAME session starts a new run. - omo settles the child's turn on the first `agent_end` with `willRetry === false` (`packages/senpi-task/src/runners/rpc-host/handle.ts` `onSessionEvent` -> `settleTurn`; `turn-outcome.ts` `agentEndOutcome` maps `aborted` to `error`). The record becomes `error: This operation was aborted`, the parent is told the child failed, and the continuation that follows (20 minutes and ~70 KB of edits in the report) is never attributed. - senpi already emits the right signal: `agent_idle` fires only after the run settled AND no deferred continuation started AND no session work is pending (`agent-session.ts` `_emitAgentIdleAfterDeferredTurns`), and it is broadcast to RPC clients (`session-event-fanout.ts`) since v2026.8.22-2. omo does not use it. The same gap applies to 
  **Post-Mortem & Fix Analysis**:
  > Progress on this issue:  - **A (error while the session keeps working) and B (completed while parked on its own monitor):** fixed by #9085 (merge `ba5a3f1d9`).   - Both process runners now settle a turn on senpi's `agent_idle` rather than the first non-retrying `agent_end`.   - A run the child starts on its own after settling reopens the record under the next run epoch. Its end is delivered as a second completion labelled `task completion (resumed turn)`.   - Live check against a real senpi 2026.9.27-4 host, with a scripted provider whose first reply trips the builtin `fabricated-unavailable-tool-call` rule: before the fix the task ended `error: The operation was aborted.` while the host stream showed `agent_start, agent_end, agent_settled, agent_start, agent_end, agent_settled, agent_idle` and two provider calls. After the fix it ends `completed: "CONTINUED: finished after the nudge"`. - **C ("Started" with no session):** #9086.   - Root cause: a start-time model fallback whose next m
  > All four cases in this issue are fixed and merged:  - **A: error while the session keeps working** and **B: completed while parked on its own monitor** - #9085 (`ba5a3f1d9`).   - The process runners settle a turn on senpi's `agent_idle`, not the first non-retrying `agent_end`.   - A run the child starts on its own after settling reopens the record under the next run epoch. That run ends with a second completion labelled `task completion (resumed turn)`.   - Live check: a scripted provider trips the builtin `fabricated-unavailable-tool-call` rule. Before the fix: `error: The operation was aborted.` while the host kept streaming. After: `completed: "CONTINUED: finished after the nudge"`. - **C: "Started" with no session** - #9086 (`41bde3ed6`).   - A start-time model fallback whose lane is full is reported `pending` with its queue position.   - `task_output` shows `start_queued` until the slot is granted. - **D: handoff or reload leaves a live or finished child "suspended" forever** - #9

- **Issue #9067** (2026-09-28): **Process task child start fails while the shared RPC host loop is blocked: host_busy is never retried and an unacknowledged open fails at 30 s**
  *Symptoms*: ## Summary Split out of #9061 (the parts of item 1 that no open work covers). When the shared task-child RPC host's event loop is blocked for tens of seconds (observed 50-65 s under heavy host CPU load), process-mode task children fail to start instead of waiting for the host. Two code paths fail, and neither is covered by #9003 (sharding) or #9054 (ensure-hold release):  1. **`host_busy` is never retried.** senpi's `ensureHost` probes an existing host for 10 s; a host whose socket still accepts but whose loop does not answer is refused with `HostEnsureRefusedError(reason: "host_busy")` - its own comment says "the caller retries or falls back" (`packages/coding-agent/src/modes/rpc/host-ensure.ts`, the `probeSocketReachable` branch of `ensureHostLocked`). omo's `RpcHostRunner.start` (`packages/senpi-task/src/runners/rpc-host.ts`) routes that into `delegate()`, which neither retries nor falls back, so the spawn fails as `host_unavailable`. 2. **An unacknowledged `open_session` still fails at 30 s.** senpi #2212 (in 2026.9.27-3+, adopted on dev) gives an open the host acknowledged with its `queued` record a 10 minute window. The host sends that acknowledgement from its loop (`session-command-router.ts`), so a loop blocked BEFORE it reads the request never acknowledges it: the request keeps the generic 30 s deadline (`rpc-request-deadline.ts` `REQUEST_DEADLINE_MS`) and omo records `session_unavailable` (`open_timed_out`).  ## Reproduction 1. Start a process-mode child against a s
  **Post-Mortem & Fix Analysis**:
  > Fixed by #9075 (merge `bc67110ec`).  - A host whose socket still accepts but whose loop does not answer is now treated as busy (`host_busy`), not gone. The child start retries at the same session path inside the existing 10 minute admission window, with a visible `host_busy` runner note. A late first open is adopted, never duplicated. There is no in-process fallback. - Live check on a real senpi host whose process tree was frozen for 45 s: origin/dev failed the start after 16 s with `host_unreachable`; the fix started it after 47 s, and `senpi host status` afterwards showed `sessions.total: 1`. A killed host still fails in 10 ms.

- **Issue #9042** (2026-09-28): **OmO Native: /ulw-execute (and every documented bare skill command) is sent to the model as text; only the ultrawork banner fires**
  *Symptoms*: ## Summary On OmO Native (omo 5.0.1, engine senpi 2026.9.27), typing or pasting `/ulw-execute <plan>` (the exact form the ulw-plan handoff, `docs/guide/orchestration.md`, `docs/guide/overview.md` and `docs/reference/features.md` tell users to run) is not a command. The text goes to the model verbatim, the ulw-execute skill body is never injected, and because the text contains `ulw` the ultrawork keyword directive fires and the reply opens with `ULTRAWORK MODE ENABLED!`. It looks like the plan started; nothing runs. A community user ran it, walked away overnight, and came back to an untouched plan.  Only `/skill:<name>` expands a skill on Native. No bare alias is registered, so `/ulw-plan`, `/ulw-loop`, `/init-deep`, `/hyperplan`, `/refactor`, `/git-master`, `/remove-ai-slops`, which the docs also present as slash commands, have the same defect.  Related picker defects on the same surface: - `/skill:` or `/skill` submitted on its own goes to the model as text. - Pressing Enter on a highlighted `skill:<name>` in the slash picker submits the skill immediately with no arguments, so a plan name typed afterwards becomes a second, separate message.  ## Reproduction Fresh temp HOME and agent dir, dummy provider key, real PTY on the installed binary, a project with `.omo/plans/demo-plan.md`. Submit each input (autocomplete closed with Esc first) and read the session jsonl:  | Input | user message recorded | skill injected | ultrawork directive injected | |---|---|---|---| | `/ulw-exec
  **Post-Mortem & Fix Analysis**:
  > Fixed by #9044, merge commit 0c76f2d9838a664884739877da1692aa754eab1a.  Evidence, from a real PTY with an isolated HOME and agent dir. The session jsonl records what the model received.  | input | before (omo 5.0.1) | after (#9044) | |---|---|---| | `/ulw-execute demo-plan` | literal text + ultrawork directive | ulw-execute skill block + `<user-request>demo-plan`, no directive | | `/ulw-plan add a hello file` | literal + directive | ulw-plan skill block + args, no directive | | `/ulw-loop make hello.txt` | literal + directive | ulw-loop skill block + args, no directive | | `ulw make hello.txt` | directive | directive (unchanged) | | `/skill:ulw-execute demo-plan` | skill block | skill block, identical to the bare form |  Real-model run of `/ulw-execute demo-plan` (Anthropic claude-opus-5-5): - 18 tool calls: todo init, create_goal, Boulder plus ledger (`work-started`, `wave-goal`), a delegated worker, an adversarial gate-review verify, then landing. - Result: `hello.txt` = `hello`, pla
  > Follow-up for the two slash-command behaviors discussed here, approved by the maintainer:  - **A.** Choosing a command that takes arguments in the slash picker (`/model`, `/thinking`, a skill with an `argument-hint`) fills `/name ` and waits for the arguments instead of submitting it empty. Commands without arguments still submit on one Enter; Tab is unchanged. - **B.** An unknown or mistyped `/command` is not sent to the model. It stays in the editor with `Unknown command /x. Did you mean /y?`. Paths (`/tmp/a.txt`), text that starts with a space, and OmO's bare aliases (`/ulw-execute plan`) are unaffected; a bare alias of a skill in `disabled_skills` keeps its "skill is disabled" warning.  The engine side is code-yeongyu/senpi#2258 (rebased on senpi main, real-terminal and RPC QA in its description). OmO also needs `argument-hint` on its argument-taking bundled skills and on the bare-alias picker rows; that is a separate OmO PR, linked here when it opens.  This issue stays closed, sin
  > Update: the engine side merged as code-yeongyu/senpi#2258 (merge commit a26164a096e1c1fe2259ea222ad23737b546f5de). OmO's side, argument hints on the argument-reading bundled skills plus waiting bare-alias rows, merged as #9169 (934217ace537e9b0643b14552b9569c1a6e8929b; issue #9168). Once OmO adopts the next senpi release, I will post evidence from the adopted build here.

- **Issue #8864** (2026-09-27): **[Bug]: Memory usage ledgers (skills-usage.json / memory-usage.json) are never written: tool_call handler resolves context from the event instead of ctx**
  *Symptoms*: ### Prerequisites  - [x] I will write this issue in English (see our [Language Policy](https://github.com/code-yeongyu/oh-my-openagent/blob/dev/CONTRIBUTING.md#language-policy)) - [x] I have searched existing issues to avoid duplicates - [x] I am using the latest version of oh-my-openagent - [x] I have read the [documentation](https://github.com/code-yeongyu/oh-my-openagent#readme) or asked an AI coding agent with this project's GitHub URL loaded and couldn't find the answer  ### Bug Description  Thanks for the memory system. It has been genuinely useful day to day.  While auditing my memory repo I noticed that the usage ledgers dream relies on are never written, so dream's evidence is always empty:  - `~/.omo/memory/agents/<id>/runtime/skills-usage.json` and `runtime/memory-usage.json` do not exist, even though the memory repo has been active since 2026-08-29 (~380 commits, 150+ reflection runs). - Consequently every reflection/dream run directory receives `skills-usage.json` = `{}` and `memory-usage.json` = `{}` (27 of 27 runs that contain them, from 2026-08-30 to 2026-09-25). - As a result, dream's tier rebalancing ("hot file → system/", "stale system/ file → reference/") and the unused-skill audit always run without data.  Related: the ledger was added in #7015 and Windows key normalization was handled in #7026. Those fixed the ledger's *format*. This report is about the recorder never firing at all.  ### Steps to Reproduce  1. Use omo native (standalone `omo`) with memor
  **Post-Mortem & Fix Analysis**:
  > Fixed by #8865, merged as fa3077ba248eff142936cbca53364dc236989dd6. Thanks @katamana for the precise report; your hypothesis was exactly right.  Evidence: - Root cause: `registerSkillsUsage` and `registerMemoryUsage` resolved the session from the `tool_call` event instead of the extension context (the handler's second argument). No other `tool_call` / `tool_result` handler in `packages/omo-senpi` had the same mistake. - Regression tests: `usage-ledgers-wiring.test.ts` (through the registered memory component) and the two new cases in `*-usage-wiring.test.ts` all fail on the previous code and pass on the fix. The memory suite is 1631 pass / 0 fail. - End to end, with the real senpi binary, a mock provider and an isolated memory home, reading `skills/<name>/SKILL.md` and a `reference/` file from the memory repo:   - before: `runtime/skills-usage.json` and `runtime/memory-usage.json` absent   - after: `skills-usage.json` = `{"qa-probe": {"count": 1, ...}}`, and `memory-usage.json` has one

- **Issue #8824** (2026-09-24): **Builtin model chains reference the OpenCode provider id zai-coding-plan, so an imported zai key is never picked**
  *Symptoms*: ## Summary  The native edition's builtin model chains reference provider ids that do not exist in the pinned engine. `packages/omo-senpi/src/components/model-profile/builtin-profiles.ts` has `GLM_PROVIDERS = ["zai-coding-plan", "opencode-go"]`, but the engine's Z.AI provider id is `zai` (and `zai-coding-cn`); `zai-coding-plan` is the OpenCode id that `omo setup` translates to `zai` on import (#8799). Result: a migrated Z.AI user has a working `zai` key and the Recommended / Daily ladders never pick `glm-5.3` from it; the same drift may exist in the category chains (`packages/model-core/src/category-model-requirements.ts`).  ## Reproduction  OpenCode user with only a `zai-coding-plan` key -> `omo setup --yes` (imports as `zai`) -> `omo -p "hello"`: the model-profile notice skips every rung and ends with no GLM selection although `zai/glm-5.3` is available to `/model`.  ## Expected  Every provider id referenced by a native builtin chain exists in the engine registry the pinned senpi ships (or is a documented alias the resolver maps), pinned by a test so a future senpi bump or chain edit cannot reintroduce the drift. `GLM_PROVIDERS` includes `zai` (and `zai-coding-cn` where the model is served there).  ## Actual  `zai-coding-plan` in the chain; no test cross-checks chain provider ids against the engine.  ## Evidence  - `builtin-profiles.ts:53-54` (`KIMI_PROVIDERS` also lists the OpenCode id `kimi-for-coding` next to the engine id `kimi-coding`). - `packages/omo-native/bin/lib/pr
  **Post-Mortem & Fix Analysis**:
  > Delivered by #8827, merged as 9710425a5 (merge commit, 6/6 test shards green, extension bundles regenerated on Linux x86_64 with node 24 + bun 1.4.2 so the CI bundle check passes).  Evidence: the native GLM rungs now name the engine ids `zai` / `zai-coding-cn` (plus `opencode-go`) instead of the OpenCode id `zai-coding-plan`, in `packages/omo-senpi/src/components/model-profile/builtin-profiles.ts` and the senpi-task `unspecified-high` chain (`packages/senpi-task/src/category/fallback-chains.ts`); telemetry vocabulary gained the new ids and keeps the old one for older sessions. The new `chain-provider-ids.test.ts` loads the pinned engine's `builtinProviders()` and fails when any builtin-profile or senpi-task chain names a provider id that is neither an engine id nor a commented allow-list alias (mutation: adding a bogus id fails it). A `zai`-only resolver case now selects `zai/glm-5.3`, which is what a migrated Z.AI user gets after `omo setup` imports their `zai-coding-plan` key as `zai

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

### Incident Patch 1: `569cd193` (2026-09-30)
**Commit Message**: Merge pull request #7707 from RaviTharuma/fix/hephaestus-requires-gpt-error

fix: throw HephaestusRequiresGptError for non-GPT primaries

**File**: `packages/omo-opencode/src/hooks/no-hephaestus-non-gpt/hook.ts` (modified, +17/-7)
```diff
@@ -2,8 +2,6 @@ import type { PluginInput } from "@opencode-ai/plugin"
 import { isGptModel } from "../../agents/types"
 import {
   getSessionAgent,
-  resolveRegisteredAgentName,
-  updateSessionAgent,
 } from "../../features/claude-code-session-state"
 import { log } from "../../shared"
 import { getAgentConfigKey } from "../../shared/agent-display-names"
@@ -18,6 +16,16 @@ type NoHephaestusNonGptHookOptions = {
   allowNonGptModel?: boolean
 }
 
+export class HephaestusRequiresGptError extends Error {
+  override readonly name = "HephaestusRequiresGptError"
+
+  constructor(modelID: string) {
+    super(
+      `Hephaestus requires a GPT-family model (got ${modelID}). Use Sisyphus for non-GPT models.`,
+    )
+  }
+}
+
 function showToast(ctx: PluginInput, sessionID: string, variant: "error" | "warning"): void {
   ctx.client.tui.showToast({
     body: {
@@ -56,11 +64,13 @@ export function createNoHephaestusNonGptHook(
         if (allowNonGptModel) {
           return
         }
-        input.agent = resolveRegisteredAgentName("sisyphus") ?? "sisyphus"
-        if (output?.message) {
-          output.message.agent = resolveRegisteredAgentName("sisyphus") ?? "sisyphus"
-        }
-        updateSessionAgent(input.sessionID, "sisyphus")
+        const error = new HephaestusRequiresGptError(modelID)
+        log("[no-hephaestus-non-gpt] Refusing non-GPT Hephaestus primary", {
+          sessionID: input.sessionID,
+          modelID,
+          error: error.message,
+        })
+        throw error
       }
     },
   }
```

**File**: `packages/omo-opencode/src/hooks/no-hephaestus-non-gpt/index.test.ts` (modified, +19/-8)
```diff
@@ -28,21 +28,28 @@ describe("no-hephaestus-non-gpt hook", () => {
     const output2 = createOutput()
 
     // when - chat.message is called repeatedly
-    await hook["chat.message"]?.({
+    const first = hook["chat.message"]?.({
       sessionID: "ses_1",
       agent: HEPHAESTUS_DISPLAY,
       model: { providerID: "anthropic", modelID: "claude-opus-4-7" },
     }, output1)
-    await hook["chat.message"]?.({
+    const second = hook["chat.message"]?.({
       sessionID: "ses_1",
       agent: HEPHAESTUS_DISPLAY,
       model: { providerID: "anthropic", modelID: "claude-opus-4-7" },
     }, output2)
 
-    // then - toast is shown and agent is switched to sisyphus
+    // then - toast is shown and a typed error is thrown instead of a silent switch
+    await expect(first).rejects.toMatchObject({
+      name: "HephaestusRequiresGptError",
+      message: expect.stringContaining("Hephaestus requires a GPT-family model (got claude-opus-4-7)"),
+    })
+    await expect(second).rejects.toMatchObject({
+      name: "HephaestusRequiresGptError",
+    })
     expect(showToast).toHaveBeenCalledTimes(2)
-    expect(output1.message.agent).toBe("sisyphus")
-    expect(output2.message.agent).toBe("sisyphus")
+    expect(output1.message.agent).toBeUndefined()
+    expect(output2.message.agent).toBeUndefined()
     expect(showToast.mock.calls[0]?.[0]).toMatchObject({
       body: {
         title: "NEVER Use Hephaestus with Non-GPT",
@@ -135,13 +142,17 @@ describe("no-hephaestus-non-gpt hook", () => {
     const output = createOutput()
 
     // when - chat.message runs without input.agent
-    await hook["chat.message"]?.({
+    const result = hook["chat.message"]?.({
       sessionID: "ses_4",
       model: { providerID: "anthropic", modelID: "claude-opus-4-7" },
     }, output)
 
-    // then - toast shown via session-agent fallback, switched to sisyphus
+    // then - toast shown via session-agent fallback, typed error thrown
+    await expect(result).rejects.toMatchObject({
+      name: "HephaestusRequiresGptError",
+      message: expect.stringContaining("got claude-opus-4-7"),
+    })
     expect(showToast).toHaveBeenCalledTimes(1)
-    expect(output.message.agent).toBe("sisyphus")
+    expect(output.message.agent).toBeUndefined()
   })
 })
```

---

### Incident Patch 2: `9784cd10` (2026-09-30)
**Commit Message**: Merge pull request #9309 from code-yeongyu/fix/macos-permission-guidance

fix(desktop-macos): classify permission denials and guide Settings grants

**File**: `changes.md` (modified, +8/-0)
```diff
@@ -43,6 +43,14 @@ Explicit overrides, sidecars, development engines, unsigned builds and quarantin
 existing behavior; unsigned files never replace the permission-bearing release engine. Other platforms
 retain immutable release generations.
 
+## 2026-09-30 - macOS permission denials identify the app and preserve their cause (#9284)
+
+A failed Accessibility stop listener now stays a permission denial through the supervisor, session,
+engine RPC and computer tool, including the default-policy path where only the host relay is live.
+Input remains refused; suspension and heartbeat precedence and the relay-only opt-in are preserved.
+Denied macOS actions open each permission's Settings pane once per engine process and return the
+launching app, pane URL and relaunch requirement. Capture remains independent of Accessibility.
+
 ## 2026-09-30 - The standalone binary gate starts the binary from an empty download folder and runs a Windows leg (#7485)
 
 `native-binary-parity` (#9259) ran the binary where `build-omo-binary.ts` wrote it, and only on macOS, so the Windows
```

**File**: `crates/senpi-desktop-backend-macos/src/ax/element.rs` (modified, +2/-4)
```diff
@@ -9,7 +9,7 @@ use std::sync::LazyLock;
 use objc2_application_services::{AXError, AXIsProcessTrusted, AXUIElement, AXValue, AXValueType};
 use objc2_core_foundation::{CFArray, CFBoolean, CFRetained, CFString, CFType, CGPoint, CGSize};
 use senpi_desktop_core::ax::{AxBounds, AxHandle};
-use senpi_desktop_core::error::{CoreResult, DesktopError};
+use senpi_desktop_core::error::{CoreResult, DesktopError, TccPermission};
 
 const AX_TIMEOUT_SECONDS: f32 = 2.0;
 
@@ -44,9 +44,7 @@ pub(super) fn ensure_trusted() -> CoreResult<()> {
     if is_trusted() {
         Ok(())
     } else {
-        Err(DesktopError::permission_denied(
-            "macOS Accessibility permission is not granted for this process",
-        ))
+        Err(crate::backend::permissions::permission_denied(TccPermission::Accessibility))
     }
 }
 
```

**File**: `crates/senpi-desktop-backend-macos/src/backend.rs` (modified, +9/-4)
```diff
@@ -5,7 +5,7 @@ use image::RgbaImage;
 use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};
 use senpi_desktop_core::ax::AxBackend;
 use senpi_desktop_core::backend::{Backend, DeliveryMode, PointerEvent};
-use senpi_desktop_core::error::{CoreResult, DesktopError};
+use senpi_desktop_core::error::{CoreResult, DesktopError, TccPermission};
 use senpi_desktop_core::frame::FrameGeometry;
 use senpi_desktop_core::keys::KeyName;
 use senpi_desktop_core::types::{
@@ -17,6 +17,9 @@ use crate::ax::{is_trusted, MacAx};
 use crate::capture::{MacCapture, Screencapture};
 use crate::input::{CanaryMode, CanaryResult, MacInput, CANARY_STOP_REASON};
 
+#[path = "permissions.rs"]
+pub(crate) mod permissions;
+
 pub struct MacosBackend {
     capture: MacCapture,
     input: MacInput,
@@ -95,14 +98,16 @@ impl MacosBackend {
         if is_trusted() {
             Ok(())
         } else {
-            Err(DesktopError::permission_denied(
-                "macOS Accessibility permission is required for native input",
-            ))
+            Err(permissions::permission_denied(TccPermission::Accessibility))
         }
     }
 }
 
 impl Backend for MacosBackend {
+    fn permission_denied(&mut self, permission: TccPermission) -> DesktopError {
+        permissions::permission_denied(permission)
+    }
+
     fn capabilities(&mut self) -> DesktopCapabilities {
         MacosBackend::capabilities(self)
     }
```

**File**: `crates/senpi-desktop-backend-macos/src/capture/mod.rs` (modified, +3/-9)
```diff
@@ -8,7 +8,7 @@ mod screencapture;
 mod windows;
 
 use image::RgbaImage;
-use senpi_desktop_core::error::{CoreResult, DesktopError};
+use senpi_desktop_core::error::{CoreResult, DesktopError, TccPermission};
 use senpi_desktop_core::frame::FrameGeometry;
 use senpi_desktop_core::types::{DesktopDisplay, DesktopWindow, DisplaySelector, Target};
 
@@ -26,15 +26,9 @@ pub(crate) fn capture_permission() -> bool {
     CGPreflightScreenCaptureAccess()
 }
 
-/// `PermissionDenied` naming the executable identity TCC evaluates, since a
-/// grant for Terminal or another launcher does not transfer automatically.
+/// Screen Recording guidance for the launcher whose TCC grant is missing.
 pub(crate) fn permission_denied() -> DesktopError {
-    let executable = std::env::current_exe()
-        .map_or_else(|_| "<unavailable>".to_string(), |path| path.display().to_string());
-    DesktopError::permission_denied(format!(
-        "macOS Screen Recording permission is not granted for this process (TCC identity: executable={executable}, pid={})",
-        std::process::id()
-    ))
+    crate::backend::permissions::permission_denied(TccPermission::ScreenRecording)
 }
 
 #[derive(Debug, Clone)]
```

**File**: `crates/senpi-desktop-backend-macos/src/capture/tests.rs` (modified, +17/-1)
```diff
@@ -3,7 +3,7 @@ use std::path::{Path, PathBuf};
 use std::time::Duration;
 
 use image::{Rgba, RgbaImage};
-use senpi_desktop_core::error::ErrorCode;
+use senpi_desktop_core::error::{ErrorCode, TccPermission};
 use senpi_desktop_core::types::{DesktopDisplay, DisplaySelector, Target};
 
 use super::displays::composite;
@@ -14,6 +14,22 @@ use super::MacCapture;
 /// on expiry, so a loaded host cannot flip these results.
 const DEADLINE: Duration = Duration::from_secs(60);
 
+#[test]
+fn permission_error_names_host_app_pane_and_relaunch() {
+    let error = super::permission_denied();
+    println!("{}", error.message);
+    let app = std::env::var("SENPI_DESKTOP_HOST_APP").ok().filter(|app| !app.trim().is_empty()).unwrap_or_else(|| {
+        "the app that launched OmO (for a terminal launch, that terminal app)".to_owned()
+    });
+    assert_eq!(error.code, ErrorCode::PermissionDenied);
+    let data = error.permission.expect("structured permission payload");
+    assert_eq!(data.app, app);
+    assert_eq!(data.permission, TccPermission::ScreenRecording);
+    assert_eq!(data.settings_url,
+        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
+    assert!(data.relaunch_required);
+}
+
 fn display(id: &str, x: i32, width: u32, height: u32) -> DesktopDisplay {
     DesktopDisplay {
         id: id.to_string(),
```

---

### Incident Patch 3: `c5707507` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/dev' into fix/macos-permission-guidance

# Conflicts:
#	packages/omo-senpi/plugin/extensions/omo-computer-use.js

**File**: `changes.md` (modified, +9/-0)
```diff
@@ -15,6 +15,15 @@ wording returns. Generated copies (`generated-directive.ts`, `directive-content.
 `plugin/extensions/omo.js`) regenerated; `embed-directive.mjs --check` went RED on the edit and GREEN after regen, and
 `ultrawork-arming.test.ts` (packaged extension injects the directive) is the seam that fails on a stale bundle.
 
+## 2026-09-30 - Verify quarantined desktop-engine sidecars inside the launcher install (#9283)
+
+The locator accepts a quarantined executable sidecar only when its canonical path stays inside the
+launcher's native/prebuilds directory and its SHA-256 matches the as-shipped checksum file there.
+Missing, invalid or duplicate checksum entries, digest mismatches and escaping symlinks retain the
+quarantine refusal. Other candidate sources and explicit engine paths remain refused. Release
+acquisition and installed-sidecar verification share the existing checksum grammar; cache paths are
+unchanged.
+
 ## 2026-09-30 - Adopt senpi 2026.9.30
 
 Every `@code-yeongyu/senpi` pin moves from 2026.9.29-5 to 2026.9.30: the root devDependency, `omo-native`, the `omo-senpi`
```

**File**: `docs/guide/computer-use.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ The tool comes with a `computer-use` skill, the full helper reference. If you al
 - **npm install (`omo-ai`):** the npm package carries no native binaries. On first use, OmO looks for an engine for its own release version under `~/.omo/cache/senpi-desktop-engine/<version>/<host>/`, and when none is there it downloads the matching asset from the OmO GitHub release and verifies it against the release's checksum file before running it.
 - **Your own build:** set `computer.engine_path` to a binary, or build one in a checkout with `cargo build --release -p senpi-desktop-engine`.
 
-Without `computer.engine_path`, the locator also checks the compiled executable's sidecar, the `@oh-my-opencode/senpi-desktop-engine` package's native prebuild, and the development build at `target/release/senpi-desktop-engine` (`packages/senpi-desktop-engine/src/locator.ts`). A candidate carrying macOS's `com.apple.quarantine` attribute is skipped and reported, never cleared. Hosts with no released engine (Linux arm64, Windows arm64) keep the tool registered and report `native-unavailable` on first use.
+Without `computer.engine_path`, the locator checks the extracted runtime (`OMO_PACKAGE_DIR`), the compiled executable's sidecar at `native/prebuilds/<host>/senpi-desktop-engine`, the `@oh-my-opencode/senpi-desktop-engine` package's native prebuild, and the development build at `target/release/senpi-desktop-engine` (`packages/senpi-desktop-engine/src/locator.ts`). A candidate carrying macOS's `com.apple.quarantine` attribute is skipped and reported, never cleared, with one exception: a sidecar inside the launcher's own installation is accepted when its canonical path stays under that launcher's `native/prebuilds/` and its SHA-256 matches the host entry in `native/prebuilds/senpi-desktop-engine-checksums.txt`. The launcher's build writes this file for the engine bytes as packaged, including any re-signing. A missing or invalid checksum file, a digest mismatch, or a symlink escaping the installation keeps the refusal. This exception does not apply to an explicit `computer.engine_path` or the other locations. Hosts with no released engine (Linux arm64, Windows arm64) keep the tool registered and report `native-unavailable` on first use.
 
 ## Set up your operating system
 
```

**File**: `docs/reference/re-export-shim-inventory.md` (modified, +3/-17)
```diff
@@ -10,7 +10,7 @@ Generated command:
 git ls-files packages/omo-opencode/src packages/omo-codex/src | grep '\.ts$' | sort | xargs awk 'FNR==1 && /^export (\*|\{).*from ["'"'"']@oh-my-opencode\// { print FILENAME }'
 ```
 
-Snapshot date: 2026-08-31. Total shim exports found: 255.
+Snapshot date: 2026-08-31. Total shim exports found: 241.
 
 ## Aggregate By Target Package
 
@@ -24,10 +24,10 @@ Snapshot date: 2026-08-31. Total shim exports found: 255.
 | `@oh-my-opencode/mcp-client-core` | 21 |
 | `@oh-my-opencode/model-core` | 7 |
 | `@oh-my-opencode/omo-codex` | 41 |
-| `@oh-my-opencode/openclaw-core` | 30 |
+| `@oh-my-opencode/openclaw-core` | 22 |
 | `@oh-my-opencode/rules-engine` | 4 |
 | `@oh-my-opencode/skills-loader-core` | 65 |
-| `@oh-my-opencode/team-core` | 45 |
+| `@oh-my-opencode/team-core` | 39 |
 | `@oh-my-opencode/tmux-core` | 3 |
 | `@oh-my-opencode/utils` | 53 |
 
@@ -148,7 +148,6 @@ Snapshot date: 2026-08-31. Total shim exports found: 255.
 | `packages/omo-opencode/src/features/skill-mcp-manager/stdio-client.ts` | `@oh-my-opencode/mcp-client-core` |
 | `packages/omo-opencode/src/features/skill-mcp-manager/types.ts` | `@oh-my-opencode/mcp-client-core` |
 | `packages/omo-opencode/src/features/team-mode/member-parser.ts` | `@oh-my-opencode/team-core` |
-| `packages/omo-opencode/src/features/team-mode/team-layout-tmux/close-team-member-pane.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-layout-tmux/index.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-layout-tmux/layout.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-layout-tmux/rebalance-team-window.ts` | `@oh-my-opencode/team-core` |
@@ -179,14 +178,9 @@ Snapshot date: 2026-08-31. Total shim exports found: 255.
 | `packages/omo-opencode/src/features/team-mode/team-state-store/session-liveness.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-state-store/store.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-state-store/worker-resume-status.ts` | `@oh-my-opencode/team-core` |
-| `packages/omo-opencode/src/features/team-mode/team-tasklist/claim.ts` | `@oh-my-opencode/team-core` |
-| `packages/omo-opencode/src/features/team-mode/team-tasklist/dependencies.ts` | `@oh-my-opencode/team-core` |
-| `packages/omo-opencode/src/features/team-mode/team-tasklist/get.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-tasklist/index.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-tasklist/list.ts` | `@oh-my-opencode/team-core` |
-| `packages/omo-opencode/src/features/team-mode/team-tasklist/store.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-tasklist/test-support.ts` | `@oh-my-opencode/team-core` |
-| `packages/omo-opencode/src/features/team-mode/team-tasklist/update.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-worktree/cleanup.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-worktree/index.ts` | `@oh-my-opencode/team-core` |
 | `packages/omo-opencode/src/features/team-mode/team-worktree/manager.ts` | `@oh-my-opencode/team-core` |
@@ -202,22 +196,16 @@ Snapshot date: 2026-08-31. Total shim exports found: 255.
 | `packages/omo-opencode/src/hooks/rules-injector/project-root-finder.ts` | `@oh-my-opencode/rules-engine` |
 | `packages/omo-opencode/src/hooks/rules-injector/rule-distance.ts` | `@oh-my-opencode/rules-engine` |
 | `packages/omo-opencode/src/hooks/rules-injector/rule-scan-cache.ts` | `@oh-my-opencode/rules-engine` |
-| `packages/omo-opencode/src/openclaw/config.ts` | `@oh-my-opencode/openclaw-core` |
 | `packages/omo-opencode/src/openclaw/daemon.ts` | `@oh-my-opencode/openclaw-core` |
-| `packages/omo-opencode/src/openclaw/dispatcher.ts` | `@oh-my-opencode/o
```

**File**: `packages/omo-opencode/src/agents/gpt-apply-patch-guidance.test.ts` (removed, +0/-57)
```diff
@@ -1,57 +0,0 @@
-import { describe, expect, test } from "bun:test"
-
-import { createHephaestusAgent, UnsupportedHephaestusModelError } from "./hephaestus"
-import { maybeCreateHephaestusConfig } from "./builtin-agents/hephaestus-agent"
-import type { AgentOverrides } from "./types"
-import type { CategoryConfig } from "../config/schema"
-
-
-
-describe("Hephaestus model eligibility", () => {
-  test("#given non-GPT Hephaestus variants #when rendering prompts #then Hephaestus is rejected", () => {
-    // given
-    const models = [
-      "opencode-go/qwen3.7-plus",
-      "opencode-go/qwen3.7PLUS",
-      "qwen3.7PLUS",
-      "bailian-coding-plan/qwen3.7PLUS",
-      "Qwen3.7PLUS",
-      "opencode-go/qwen3.5-plus",
-    ]
-
-    for (const model of models) {
-      // when
-      const createAgent = () => createHephaestusAgent(model)
-
-      // then
-      expect(createAgent).toThrow(UnsupportedHephaestusModelError)
-    }
-  })
-
-  test("#given non-GPT Hephaestus override #when plugin config creates the agent #then Hephaestus is not registered", () => {
-    // given
-    const agentOverrides: AgentOverrides = {
-      hephaestus: {
-        model: "opencode-go/qwen3.7PLUS",
-      },
-    }
-    const mergedCategories: Record<string, CategoryConfig> = {}
-
-    // when
-    const config = maybeCreateHephaestusConfig({
-      disabledAgents: [],
-      agentOverrides,
-      availableModels: new Set(["opencode-go/qwen3.7PLUS"]),
-      systemDefaultModel: "opencode-go/qwen3.7PLUS",
-      isFirstRunNoCache: false,
-      availableAgents: [],
-      availableSkills: [],
-      availableCategories: [],
-      mergedCategories,
-      useTaskSystem: false,
-    })
-
-    // then
-    expect(config).toBeUndefined()
-  })
-})
```

**File**: `packages/omo-opencode/src/agents/hephaestus/agent.test.ts` (modified, +6/-0)
```diff
@@ -47,6 +47,12 @@ describe("isHephaestusSupportedModel with a hosted vendor prefix", () => {
       ["opencode/gpt-5.3-codex-spark", true],
       ["openai/gpt-4o", false],
       ["anthropic/claude-opus-4-7", false],
+      ["opencode-go/qwen3.7-plus", false],
+      ["opencode-go/qwen3.7PLUS", false],
+      ["qwen3.7PLUS", false],
+      ["bailian-coding-plan/qwen3.7PLUS", false],
+      ["Qwen3.7PLUS", false],
+      ["opencode-go/qwen3.5-plus", false],
       ["gpt-5.10", false],
       ["some-gpt-5.4-tune", false],
     ];
```

---

### Incident Patch 4: `a8897fb1` (2026-09-30)
**Commit Message**: Merge pull request #9301 from code-yeongyu/fix/desktop-engine-sidecar-quarantine

fix(desktop-engine): verify quarantined launcher sidecars

**File**: `changes.md` (modified, +9/-0)
```diff
@@ -15,6 +15,15 @@ wording returns. Generated copies (`generated-directive.ts`, `directive-content.
 `plugin/extensions/omo.js`) regenerated; `embed-directive.mjs --check` went RED on the edit and GREEN after regen, and
 `ultrawork-arming.test.ts` (packaged extension injects the directive) is the seam that fails on a stale bundle.
 
+## 2026-09-30 - Verify quarantined desktop-engine sidecars inside the launcher install (#9283)
+
+The locator accepts a quarantined executable sidecar only when its canonical path stays inside the
+launcher's native/prebuilds directory and its SHA-256 matches the as-shipped checksum file there.
+Missing, invalid or duplicate checksum entries, digest mismatches and escaping symlinks retain the
+quarantine refusal. Other candidate sources and explicit engine paths remain refused. Release
+acquisition and installed-sidecar verification share the existing checksum grammar; cache paths are
+unchanged.
+
 ## 2026-09-30 - Adopt senpi 2026.9.30
 
 Every `@code-yeongyu/senpi` pin moves from 2026.9.29-5 to 2026.9.30: the root devDependency, `omo-native`, the `omo-senpi`
```

**File**: `docs/guide/computer-use.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ The tool comes with a `computer-use` skill, the full helper reference. If you al
 - **npm install (`omo-ai`):** the npm package carries no native binaries. On first use, OmO looks for an engine for its own release version under `~/.omo/cache/senpi-desktop-engine/<version>/<host>/`, and when none is there it downloads the matching asset from the OmO GitHub release and verifies it against the release's checksum file before running it.
 - **Your own build:** set `computer.engine_path` to a binary, or build one in a checkout with `cargo build --release -p senpi-desktop-engine`.
 
-Without `computer.engine_path`, the locator also checks the compiled executable's sidecar, the `@oh-my-opencode/senpi-desktop-engine` package's native prebuild, and the development build at `target/release/senpi-desktop-engine` (`packages/senpi-desktop-engine/src/locator.ts`). A candidate carrying macOS's `com.apple.quarantine` attribute is skipped and reported, never cleared. Hosts with no released engine (Linux arm64, Windows arm64) keep the tool registered and report `native-unavailable` on first use.
+Without `computer.engine_path`, the locator checks the extracted runtime (`OMO_PACKAGE_DIR`), the compiled executable's sidecar at `native/prebuilds/<host>/senpi-desktop-engine`, the `@oh-my-opencode/senpi-desktop-engine` package's native prebuild, and the development build at `target/release/senpi-desktop-engine` (`packages/senpi-desktop-engine/src/locator.ts`). A candidate carrying macOS's `com.apple.quarantine` attribute is skipped and reported, never cleared, with one exception: a sidecar inside the launcher's own installation is accepted when its canonical path stays under that launcher's `native/prebuilds/` and its SHA-256 matches the host entry in `native/prebuilds/senpi-desktop-engine-checksums.txt`. The launcher's build writes this file for the engine bytes as packaged, including any re-signing. A missing or invalid checksum file, a digest mismatch, or a symlink escaping the installation keeps the refusal. This exception does not apply to an explicit `computer.engine_path` or the other locations. Hosts with no released engine (Linux arm64, Windows arm64) keep the tool registered and report `native-unavailable` on first use.
 
 ## Set up your operating system
 
```

**File**: `packages/senpi-desktop-engine/README.md` (modified, +2/-1)
```diff
@@ -5,11 +5,12 @@ Finds the `senpi-desktop-engine` binary (`crates/senpi-desktop-engine`) for this
 ## Contract
 
 - `locateDesktopEngine()` returns `{ path, diagnostic: null }` or `{ path: null, diagnostic }`. It checks these paths in order:
+  0. extracted runtime: `OMO_PACKAGE_DIR/native/prebuilds/<platform>-<arch>/senpi-desktop-engine[.exe]` when set
   1. compiled sidecar: `<dirname(process.execPath)>/native/prebuilds/<platform>-<arch>/senpi-desktop-engine[.exe]`
   2. vendored prebuild: `native/prebuilds/<platform>-<arch>/senpi-desktop-engine[.exe]` in this package
   3. dev build: `<repo>/target/release/senpi-desktop-engine[.exe]`
 
-  A candidate that is missing, lacks the executable bit, or carries macOS `com.apple.quarantine` is skipped. The quarantine attribute is detected and never cleared. The diagnostic `code` is `quarantined` when a skipped candidate was quarantined, otherwise `native-unavailable`, and it lists every attempted path.
+  A candidate that is missing or lacks the executable bit is skipped. A candidate carrying macOS `com.apple.quarantine` is also skipped, except for the compiled sidecar: its canonical path must remain inside the launcher's `native/prebuilds/`, and its SHA-256 must match its host asset entry in `<dirname(process.execPath)>/native/prebuilds/senpi-desktop-engine-checksums.txt`. That file carries the engine digest **as shipped**, after any packaging re-sign, not necessarily the upstream release digest. The shared checksum parser requires two-space SHA-256 lines, known release asset names and no duplicates. Extracted-runtime, package-prebuild, dev-build and explicit `computer.engine_path` candidates retain their quarantine refusal. The attribute is never cleared. The diagnostic `code` is `quarantined` when a skipped candidate was quarantined, otherwise `native-unavailable`, and it lists every attempted path.
 - `helloDesktopEngine(path)` spawns the binary with `--stdio`, sends `engine.hello`, and resolves only when `abi === ENGINE_ABI` and `protocolVersion === PROTOCOL_VERSION` from `@oh-my-opencode/senpi-desktop-protocol`. On any other ABI or protocol version it throws `DesktopEngineAbiMismatchError` (`code: "abi-mismatch"`, naming both versions). When no well-formed reply arrives it throws `DesktopEngineHandshakeError` (`code: "handshake-failed"`). This handshake is the ABI sentinel.
 - `./native` resolves only the vendored host prebuild, without spawning it.
 
```

**File**: `packages/senpi-desktop-engine/src/acquire.ts` (modified, +5/-14)
```diff
@@ -9,7 +9,8 @@ import {
 	isQuarantinedFile,
 	locateDesktopEngine,
 } from "./locator";
-import { DESKTOP_ENGINE_CHECKSUMS_ASSET, DESKTOP_ENGINE_RELEASE_HOSTS, desktopEngineReleaseAssetName } from "./release-assets";
+import { parseDesktopEngineChecksums } from "./checksums";
+import { DESKTOP_ENGINE_CHECKSUMS_ASSET, desktopEngineReleaseAssetName } from "./release-assets";
 import { isDesktopEngineRelease } from "./release-signature";
 
 const RELEASE_BASE = "https://github.com/code-yeongyu/oh-my-openagent/releases/download";
@@ -112,19 +113,9 @@ export async function acquireDesktopEngine(options: AcquireDesktopEngineOptions)
 		if (!binaryResponse.ok) return unavailable(`${asset}: HTTP ${binaryResponse.status}`);
 		if (!checksumsResponse.ok) return unavailable(`${DESKTOP_ENGINE_CHECKSUMS_ASSET}: HTTP ${checksumsResponse.status}`);
 
-		const checksumLines = (await checksumsResponse.text()).trimEnd().split(/\r?\n/);
-		const seen = new Set<string>();
-		let expected: string | undefined;
-		for (const line of checksumLines) {
-			const match = /^([a-fA-F0-9]{64})  ([A-Za-z0-9.-]+)$/.exec(line);
-			const name = match?.[2];
-			if (name === undefined || !DESKTOP_ENGINE_RELEASE_HOSTS.some((supported) => desktopEngineReleaseAssetName(supported) === name)) {
-				return unavailable("Invalid desktop engine checksum entry or asset name");
-			}
-			if (seen.has(name)) return unavailable(`Duplicate SHA-256 checksum for ${name}`);
-			seen.add(name);
-			if (name === asset) expected = match?.[1];
-		}
+		const parsed = parseDesktopEngineChecksums(await checksumsResponse.text());
+		if (parsed.error !== null) return unavailable(parsed.error);
+		const expected = parsed.checksums.get(asset);
 		if (expected === undefined) return unavailable(`No SHA-256 checksum for ${asset}`);
 		const binary = Buffer.from(await binaryResponse.arrayBuffer());
 		const actual = createHash("sha256").update(binary).digest("hex");
```

**File**: `packages/senpi-desktop-engine/src/checksums.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { DESKTOP_ENGINE_RELEASE_HOSTS, desktopEngineReleaseAssetName } from "./release-assets";
+
+/** One grammar for upstream release checksums and the launcher's as-shipped engine checksums. */
+export function parseDesktopEngineChecksums(text: string):
+	| { readonly checksums: ReadonlyMap<string, string>; readonly error: null }
+	| { readonly checksums: null; readonly error: string } {
+	const checksums = new Map<string, string>();
+	for (const line of text.trimEnd().split(/\r?\n/)) {
+		const match = /^([a-fA-F0-9]{64})  ([A-Za-z0-9.-]+)$/.exec(line);
+		const name = match?.[2];
+		const digest = match?.[1];
+		if (name === undefined || digest === undefined
+			|| !DESKTOP_ENGINE_RELEASE_HOSTS.some((host) => desktopEngineReleaseAssetName(host) === name)) {
+			return { checksums: null, error: "Invalid desktop engine checksum entry or asset name" };
+		}
+		if (checksums.has(name)) return { checksums: null, error: `Duplicate SHA-256 checksum for ${name}` };
+		checksums.set(name, digest);
+	}
+	return { checksums, error: null };
+}
```

---

### Incident Patch 5: `fab4e337` (2026-09-30)
**Commit Message**: fix(desktop-engine): trust a quarantined engine sidecar only when contained and checksum-verified

Plan: .omo/plans/desktop-computer-use-20260930.md

**File**: `changes.md` (modified, +9/-0)
```diff
@@ -15,6 +15,15 @@ wording returns. Generated copies (`generated-directive.ts`, `directive-content.
 `plugin/extensions/omo.js`) regenerated; `embed-directive.mjs --check` went RED on the edit and GREEN after regen, and
 `ultrawork-arming.test.ts` (packaged extension injects the directive) is the seam that fails on a stale bundle.
 
+## 2026-09-30 - Verify quarantined desktop-engine sidecars inside the launcher install (#9283)
+
+The locator accepts a quarantined executable sidecar only when its canonical path stays inside the
+launcher's native/prebuilds directory and its SHA-256 matches the as-shipped checksum file there.
+Missing, invalid or duplicate checksum entries, digest mismatches and escaping symlinks retain the
+quarantine refusal. Other candidate sources and explicit engine paths remain refused. Release
+acquisition and installed-sidecar verification share the existing checksum grammar; cache paths are
+unchanged.
+
 ## 2026-09-30 - Adopt senpi 2026.9.30
 
 Every `@code-yeongyu/senpi` pin moves from 2026.9.29-5 to 2026.9.30: the root devDependency, `omo-native`, the `omo-senpi`
```

**File**: `docs/guide/computer-use.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ The tool comes with a `computer-use` skill, the full helper reference. If you al
 - **npm install (`omo-ai`):** the npm package carries no native binaries. On first use, OmO looks for an engine for its own release version under `~/.omo/cache/senpi-desktop-engine/<version>/<host>/`, and when none is there it downloads the matching asset from the OmO GitHub release and verifies it against the release's checksum file before running it.
 - **Your own build:** set `computer.engine_path` to a binary, or build one in a checkout with `cargo build --release -p senpi-desktop-engine`.
 
-Without `computer.engine_path`, the locator also checks the compiled executable's sidecar, the `@oh-my-opencode/senpi-desktop-engine` package's native prebuild, and the development build at `target/release/senpi-desktop-engine` (`packages/senpi-desktop-engine/src/locator.ts`). A candidate carrying macOS's `com.apple.quarantine` attribute is skipped and reported, never cleared. Hosts with no released engine (Linux arm64, Windows arm64) keep the tool registered and report `native-unavailable` on first use.
+Without `computer.engine_path`, the locator checks the extracted runtime (`OMO_PACKAGE_DIR`), the compiled executable's sidecar at `native/prebuilds/<host>/senpi-desktop-engine`, the `@oh-my-opencode/senpi-desktop-engine` package's native prebuild, and the development build at `target/release/senpi-desktop-engine` (`packages/senpi-desktop-engine/src/locator.ts`). A candidate carrying macOS's `com.apple.quarantine` attribute is skipped and reported, never cleared, with one exception: a sidecar inside the launcher's own installation is accepted when its canonical path stays under that launcher's `native/prebuilds/` and its SHA-256 matches the host entry in `native/prebuilds/senpi-desktop-engine-checksums.txt`. The launcher's build writes this file for the engine bytes as packaged, including any re-signing. A missing or invalid checksum file, a digest mismatch, or a symlink escaping the installation keeps the refusal. This exception does not apply to an explicit `computer.engine_path` or the other locations. Hosts with no released engine (Linux arm64, Windows arm64) keep the tool registered and report `native-unavailable` on first use.
 
 ## Set up your operating system
 
```

**File**: `packages/senpi-desktop-engine/README.md` (modified, +2/-1)
```diff
@@ -5,11 +5,12 @@ Finds the `senpi-desktop-engine` binary (`crates/senpi-desktop-engine`) for this
 ## Contract
 
 - `locateDesktopEngine()` returns `{ path, diagnostic: null }` or `{ path: null, diagnostic }`. It checks these paths in order:
+  0. extracted runtime: `OMO_PACKAGE_DIR/native/prebuilds/<platform>-<arch>/senpi-desktop-engine[.exe]` when set
   1. compiled sidecar: `<dirname(process.execPath)>/native/prebuilds/<platform>-<arch>/senpi-desktop-engine[.exe]`
   2. vendored prebuild: `native/prebuilds/<platform>-<arch>/senpi-desktop-engine[.exe]` in this package
   3. dev build: `<repo>/target/release/senpi-desktop-engine[.exe]`
 
-  A candidate that is missing, lacks the executable bit, or carries macOS `com.apple.quarantine` is skipped. The quarantine attribute is detected and never cleared. The diagnostic `code` is `quarantined` when a skipped candidate was quarantined, otherwise `native-unavailable`, and it lists every attempted path.
+  A candidate that is missing or lacks the executable bit is skipped. A candidate carrying macOS `com.apple.quarantine` is also skipped, except for the compiled sidecar: its canonical path must remain inside the launcher's `native/prebuilds/`, and its SHA-256 must match its host asset entry in `<dirname(process.execPath)>/native/prebuilds/senpi-desktop-engine-checksums.txt`. That file carries the engine digest **as shipped**, after any packaging re-sign, not necessarily the upstream release digest. The shared checksum parser requires two-space SHA-256 lines, known release asset names and no duplicates. Extracted-runtime, package-prebuild, dev-build and explicit `computer.engine_path` candidates retain their quarantine refusal. The attribute is never cleared. The diagnostic `code` is `quarantined` when a skipped candidate was quarantined, otherwise `native-unavailable`, and it lists every attempted path.
 - `helloDesktopEngine(path)` spawns the binary with `--stdio`, sends `engine.hello`, and resolves only when `abi === ENGINE_ABI` and `protocolVersion === PROTOCOL_VERSION` from `@oh-my-opencode/senpi-desktop-protocol`. On any other ABI or protocol version it throws `DesktopEngineAbiMismatchError` (`code: "abi-mismatch"`, naming both versions). When no well-formed reply arrives it throws `DesktopEngineHandshakeError` (`code: "handshake-failed"`). This handshake is the ABI sentinel.
 - `./native` resolves only the vendored host prebuild, without spawning it.
 
```

**File**: `packages/senpi-desktop-engine/src/acquire.ts` (modified, +5/-14)
```diff
@@ -9,7 +9,8 @@ import {
 	isQuarantinedFile,
 	locateDesktopEngine,
 } from "./locator";
-import { DESKTOP_ENGINE_CHECKSUMS_ASSET, DESKTOP_ENGINE_RELEASE_HOSTS, desktopEngineReleaseAssetName } from "./release-assets";
+import { parseDesktopEngineChecksums } from "./checksums";
+import { DESKTOP_ENGINE_CHECKSUMS_ASSET, desktopEngineReleaseAssetName } from "./release-assets";
 import { isDesktopEngineRelease } from "./release-signature";
 
 const RELEASE_BASE = "https://github.com/code-yeongyu/oh-my-openagent/releases/download";
@@ -112,19 +113,9 @@ export async function acquireDesktopEngine(options: AcquireDesktopEngineOptions)
 		if (!binaryResponse.ok) return unavailable(`${asset}: HTTP ${binaryResponse.status}`);
 		if (!checksumsResponse.ok) return unavailable(`${DESKTOP_ENGINE_CHECKSUMS_ASSET}: HTTP ${checksumsResponse.status}`);
 
-		const checksumLines = (await checksumsResponse.text()).trimEnd().split(/\r?\n/);
-		const seen = new Set<string>();
-		let expected: string | undefined;
-		for (const line of checksumLines) {
-			const match = /^([a-fA-F0-9]{64})  ([A-Za-z0-9.-]+)$/.exec(line);
-			const name = match?.[2];
-			if (name === undefined || !DESKTOP_ENGINE_RELEASE_HOSTS.some((supported) => desktopEngineReleaseAssetName(supported) === name)) {
-				return unavailable("Invalid desktop engine checksum entry or asset name");
-			}
-			if (seen.has(name)) return unavailable(`Duplicate SHA-256 checksum for ${name}`);
-			seen.add(name);
-			if (name === asset) expected = match?.[1];
-		}
+		const parsed = parseDesktopEngineChecksums(await checksumsResponse.text());
+		if (parsed.error !== null) return unavailable(parsed.error);
+		const expected = parsed.checksums.get(asset);
 		if (expected === undefined) return unavailable(`No SHA-256 checksum for ${asset}`);
 		const binary = Buffer.from(await binaryResponse.arrayBuffer());
 		const actual = createHash("sha256").update(binary).digest("hex");
```

**File**: `packages/senpi-desktop-engine/src/checksums.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { DESKTOP_ENGINE_RELEASE_HOSTS, desktopEngineReleaseAssetName } from "./release-assets";
+
+/** One grammar for upstream release checksums and the launcher's as-shipped engine checksums. */
+export function parseDesktopEngineChecksums(text: string):
+	| { readonly checksums: ReadonlyMap<string, string>; readonly error: null }
+	| { readonly checksums: null; readonly error: string } {
+	const checksums = new Map<string, string>();
+	for (const line of text.trimEnd().split(/\r?\n/)) {
+		const match = /^([a-fA-F0-9]{64})  ([A-Za-z0-9.-]+)$/.exec(line);
+		const name = match?.[2];
+		const digest = match?.[1];
+		if (name === undefined || digest === undefined
+			|| !DESKTOP_ENGINE_RELEASE_HOSTS.some((host) => desktopEngineReleaseAssetName(host) === name)) {
+			return { checksums: null, error: "Invalid desktop engine checksum entry or asset name" };
+		}
+		if (checksums.has(name)) return { checksums: null, error: `Duplicate SHA-256 checksum for ${name}` };
+		checksums.set(name, digest);
+	}
+	return { checksums, error: null };
+}
```

---

### Incident Patch 6: `930946db` (2026-09-30)
**Commit Message**: fix(desktop-macos): open the Settings pane once, name the app, and classify an Accessibility miss as a permission error

Plan: .omo/plans/desktop-computer-use-20260930.md

**File**: `changes.md` (modified, +8/-0)
```diff
@@ -34,6 +34,14 @@ Explicit overrides, sidecars, development engines, unsigned builds and quarantin
 existing behavior; unsigned files never replace the permission-bearing release engine. Other platforms
 retain immutable release generations.
 
+## 2026-09-30 - macOS permission denials identify the app and preserve their cause (#9284)
+
+A failed Accessibility stop listener now stays a permission denial through the supervisor, session,
+engine RPC and computer tool, including the default-policy path where only the host relay is live.
+Input remains refused; suspension and heartbeat precedence and the relay-only opt-in are preserved.
+Denied macOS actions open each permission's Settings pane once per engine process and return the
+launching app, pane URL and relaunch requirement. Capture remains independent of Accessibility.
+
 ## 2026-09-30 - The standalone binary gate starts the binary from an empty download folder and runs a Windows leg (#7485)
 
 `native-binary-parity` (#9259) ran the binary where `build-omo-binary.ts` wrote it, and only on macOS, so the Windows
```

**File**: `crates/senpi-desktop-backend-macos/src/ax/element.rs` (modified, +2/-4)
```diff
@@ -9,7 +9,7 @@ use std::sync::LazyLock;
 use objc2_application_services::{AXError, AXIsProcessTrusted, AXUIElement, AXValue, AXValueType};
 use objc2_core_foundation::{CFArray, CFBoolean, CFRetained, CFString, CFType, CGPoint, CGSize};
 use senpi_desktop_core::ax::{AxBounds, AxHandle};
-use senpi_desktop_core::error::{CoreResult, DesktopError};
+use senpi_desktop_core::error::{CoreResult, DesktopError, TccPermission};
 
 const AX_TIMEOUT_SECONDS: f32 = 2.0;
 
@@ -44,9 +44,7 @@ pub(super) fn ensure_trusted() -> CoreResult<()> {
     if is_trusted() {
         Ok(())
     } else {
-        Err(DesktopError::permission_denied(
-            "macOS Accessibility permission is not granted for this process",
-        ))
+        Err(crate::backend::permissions::permission_denied(TccPermission::Accessibility))
     }
 }
 
```

**File**: `crates/senpi-desktop-backend-macos/src/backend.rs` (modified, +9/-4)
```diff
@@ -5,7 +5,7 @@ use image::RgbaImage;
 use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};
 use senpi_desktop_core::ax::AxBackend;
 use senpi_desktop_core::backend::{Backend, DeliveryMode, PointerEvent};
-use senpi_desktop_core::error::{CoreResult, DesktopError};
+use senpi_desktop_core::error::{CoreResult, DesktopError, TccPermission};
 use senpi_desktop_core::frame::FrameGeometry;
 use senpi_desktop_core::keys::KeyName;
 use senpi_desktop_core::types::{
@@ -17,6 +17,9 @@ use crate::ax::{is_trusted, MacAx};
 use crate::capture::{MacCapture, Screencapture};
 use crate::input::{CanaryMode, CanaryResult, MacInput, CANARY_STOP_REASON};
 
+#[path = "permissions.rs"]
+pub(crate) mod permissions;
+
 pub struct MacosBackend {
     capture: MacCapture,
     input: MacInput,
@@ -95,14 +98,16 @@ impl MacosBackend {
         if is_trusted() {
             Ok(())
         } else {
-            Err(DesktopError::permission_denied(
-                "macOS Accessibility permission is required for native input",
-            ))
+            Err(permissions::permission_denied(TccPermission::Accessibility))
         }
     }
 }
 
 impl Backend for MacosBackend {
+    fn permission_denied(&mut self, permission: TccPermission) -> DesktopError {
+        permissions::permission_denied(permission)
+    }
+
     fn capabilities(&mut self) -> DesktopCapabilities {
         MacosBackend::capabilities(self)
     }
```

**File**: `crates/senpi-desktop-backend-macos/src/capture/mod.rs` (modified, +3/-9)
```diff
@@ -8,7 +8,7 @@ mod screencapture;
 mod windows;
 
 use image::RgbaImage;
-use senpi_desktop_core::error::{CoreResult, DesktopError};
+use senpi_desktop_core::error::{CoreResult, DesktopError, TccPermission};
 use senpi_desktop_core::frame::FrameGeometry;
 use senpi_desktop_core::types::{DesktopDisplay, DesktopWindow, DisplaySelector, Target};
 
@@ -26,15 +26,9 @@ pub(crate) fn capture_permission() -> bool {
     CGPreflightScreenCaptureAccess()
 }
 
-/// `PermissionDenied` naming the executable identity TCC evaluates, since a
-/// grant for Terminal or another launcher does not transfer automatically.
+/// Screen Recording guidance for the launcher whose TCC grant is missing.
 pub(crate) fn permission_denied() -> DesktopError {
-    let executable = std::env::current_exe()
-        .map_or_else(|_| "<unavailable>".to_string(), |path| path.display().to_string());
-    DesktopError::permission_denied(format!(
-        "macOS Screen Recording permission is not granted for this process (TCC identity: executable={executable}, pid={})",
-        std::process::id()
-    ))
+    crate::backend::permissions::permission_denied(TccPermission::ScreenRecording)
 }
 
 #[derive(Debug, Clone)]
```

**File**: `crates/senpi-desktop-backend-macos/src/capture/tests.rs` (modified, +17/-1)
```diff
@@ -3,7 +3,7 @@ use std::path::{Path, PathBuf};
 use std::time::Duration;
 
 use image::{Rgba, RgbaImage};
-use senpi_desktop_core::error::ErrorCode;
+use senpi_desktop_core::error::{ErrorCode, TccPermission};
 use senpi_desktop_core::types::{DesktopDisplay, DisplaySelector, Target};
 
 use super::displays::composite;
@@ -14,6 +14,22 @@ use super::MacCapture;
 /// on expiry, so a loaded host cannot flip these results.
 const DEADLINE: Duration = Duration::from_secs(60);
 
+#[test]
+fn permission_error_names_host_app_pane_and_relaunch() {
+    let error = super::permission_denied();
+    println!("{}", error.message);
+    let app = std::env::var("SENPI_DESKTOP_HOST_APP").ok().filter(|app| !app.trim().is_empty()).unwrap_or_else(|| {
+        "the app that launched OmO (for a terminal launch, that terminal app)".to_owned()
+    });
+    assert_eq!(error.code, ErrorCode::PermissionDenied);
+    let data = error.permission.expect("structured permission payload");
+    assert_eq!(data.app, app);
+    assert_eq!(data.permission, TccPermission::ScreenRecording);
+    assert_eq!(data.settings_url,
+        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
+    assert!(data.relaunch_required);
+}
+
 fn display(id: &str, x: i32, width: u32, height: u32) -> DesktopDisplay {
     DesktopDisplay {
         id: id.to_string(),
```

---

### Incident Patch 7: `7750a354` (2026-09-30)
**Commit Message**: Merge pull request #9298 from code-yeongyu/fix/ultrawork-evidence-reuse-blast-radius

fix(ultrawork): reuse evidence per target, spawn a new reviewer per round, scope defects to the blast radius

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Changed
+
+ultrawork reuses QA and review evidence per target instead of rerunning everything after each patch, while keeping the nets that catch what the changer cannot see: each artifact records the commit and what it exercised; after an increment the session reruns the tests of every touched file and its importers, the scenarios that exercise them, and anything whose dependencies or environment moved, cites the capture for the rest, and still runs the full set once before the final message. Every re-review spawns a new reviewer with the delta diff and the cited blockers, at most twice. Defects inside the change's blast radius are fixed in the same run to the ideal state; defects outside it get a tracked issue and a line in the final message instead of growing the run. The memory line now also records every regression a check caught and each QA scenario with its invocation. ([#9294](https://github.com/code-yeongyu/oh-my-openagent/issues/9294), [#9298](https://github.com/code-yeongyu/oh-my-openagent/pull/9298))
+
 ## [5.1.5] - 2026-09-30
 
 **Big thanks to [@ashmoonori-afk](https://github.com/ashmoonori-afk), whose [#9209](https://github.com/code-yeongyu/oh-my-openagent/pull/9209) teaches memory recall to find Korean, Japanese and Chinese notes and to pick the right note out of a big memory.**
```

**File**: `changes.md` (modified, +17/-0)
```diff
@@ -1,3 +1,20 @@
+## 2026-10-01 - ultrawork reuses evidence per target, spawns a new reviewer per round, and scopes defects to the blast radius (#9294)
+
+The directive's Constraints bullet ("own every defect met mid-run ... never deferred as a follow-up", from #7674)
+contradicted the engine's base prompt (a pre-existing bug is a follow-up) and the project's delivery rule (only defects
+inside the blast radius belong to this run), and the Codex variant still said "No drive-by refactors"; gate step 4 sent
+fixes back to the SAME reviewer while `review-work` and `ulw-execute` require a fresh one; "re-run the scenarios that
+increment could have affected" had no definition; and the rerun rule was stated three times. `SKILL.md`, `codex.md`,
+`default.md` (gate step only), the `ulw-loop` `add_subgoal` row and the `ulw-execute` discovered-work sentence now
+carry one scope rule (blast radius: request not delivered, regression this change introduces, invalid proof, failing test
+or stale doc of touched code; anything else becomes a tracked issue named in the final message), one rerun rule (evidence
+valid per target with commit and coverage recorded; rerun touched-file tests plus importers, their scenarios, and moved
+dependencies; one full pass before the final message) and a NEW reviewer per re-review (delta diff, cited blockers, at
+most twice). The memory line asks for every regression a check caught and each QA scenario with its invocation. No TDD
+wording returns. Generated copies (`generated-directive.ts`, `directive-content.ts`, `ulw-loop/directive.md`,
+`plugin/extensions/omo.js`) regenerated; `embed-directive.mjs --check` went RED on the edit and GREEN after regen, and
+`ultrawork-arming.test.ts` (packaged extension injects the directive) is the seam that fails on a stale bundle.
+
 ## 2026-09-30 - Keep signed macOS computer-use engines at one path across updates (#9282)
 
 Signed release engines now launch from `~/.omo/engines/senpi-desktop-engine/<host>/senpi-desktop-engine`,
```

**File**: `packages/omo-codex/plugin/components/ultrawork/src/directive-content.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 // GENERATED by scripts/sync-directive.mjs from packages/prompts-core/prompts/ultrawork/codex.md.
 // Do not hand-edit. Freshness is enforced by test/directive-source.test.ts.
 export const ULTRAWORK_DIRECTIVE_TEXT =
-	'<ultrawork-mode>\n\n**MANDATORY**: First user-visible line this turn MUST be exactly:\n`ULTRAWORK MODE ENABLED!`\n\n[CODE RED] Maximum precision. Outcome-first. Evidence-driven.\n\n# Role\nExpert coding agent. Ship verified work; report at handoffs, not between them.\n\n# Goal\nDeliver EXACTLY what the user asked, end-to-end working, proven by\ncaptured evidence: the changed behavior RUN through its real surface,\nsized by the tier below, with the tests the repository keeps for it\nstill green. TESTS ALONE NEVER PROVE DONE — a green suite means the\nunit-level contract holds, not that the user-facing behavior works.\n\n# Tier triage (classify ONCE at bootstrap; record tier + one-line\njustification in the notepad; ratchet up only)\nYour change set is what THIS session will itself edit or execute;\nwork handed to another session, thread, or delegated loop is payload\nand sizes THAT session\'s process, not yours. Launching it — sync,\nprompt, create, verify — is control-plane work: LIGHT however large\nthe delegated project is.\nDefault is LIGHT. Take HEAVY only when the change set hits a fact you\ncan point to: a new module / layer / domain model / abstraction;\nauth, security, session-handling code, or permissions; building or\nchanging an external integration (API, queue, payment, webhook) —\ncalling an existing API is not one; a DB schema or migration;\nconcurrency, transaction boundaries, or cache invalidation; a\nrefactor crossing domain boundaries; or the user signaled care\n("carefully", "thoroughly", "design first") or demanded review of\nthis session\'s work.\nWhen unsure, take HEAVY. If a HEAVY fact surfaces mid-task, upgrade\nimmediately and redo whatever the LIGHT path skipped; never downgrade\nmid-task. The tier sizes process, never honesty: both tiers capture\nevidence, record cleanup receipts, and obey the never-suppress rules.\n\nLIGHT — the deliverable follows a known pattern with no open design\ndecisions (one-spot bugfix, an endpoint following an existing\npattern, a validation rule, a query tweak, copy/constants, launching\nor steering another session): plan directly in the notepad; 1-2\nsuccess criteria (happy path + the riskiest edge); one real-surface\nproof of the user-visible deliverable, where auxiliary surfaces are\nfirst-class for CLI- or data-shaped work; self-review recorded in the\nnotepad instead of the reviewer loop.\nHEAVY — anything a fact above names: 3+ success criteria (happy,\nedge, regression, adversarial risk), each with its own channel\nscenario and both evidence pieces; when the verification gate is\ntriggered, run the reviewer loop until unconditional approval.\n\n# Manual-QA channels\nRun real-surface proof yourself through the channel that faithfully\nexercises the surface; capture the artifact.\n\n  1. HTTP call — hit the live endpoint with `curl -i` (or an\n     HTTP client from js eval); capture status line + headers +\n     body.\n  2. Terminal / TUI - drive a real pty and prove it through the\n     xterm.js web terminal (see the TUI visual QA note below). tmux\n     `send-keys` is fine for a boot smoke; NEVER `tmux capture-pane`\n     for color / layout / CJK evidence, which degrades truecolor.\n  3. Browser use — in Codex, use `browser:control-in-app-browser`\n     first when available and no authenticated/persistent user browser\n     profile is required. Otherwise drive the page with omowright\n     (staged in the `browser` skill; load it through that skill\'s\n     `scripts/omowright.mjs` from js eval): the owned engine\n     (`connectPipe` on a task-owned profile, `connectCloakProfile` for\n     bot-scored targets), or the attached engine\n     (`connectBrowserSkill()` in the user\'s own signed-in browser) when\n     the page needs their lo
```

**File**: `packages/omo-codex/plugin/components/ulw-loop/directive.md` (modified, +25/-18)
```diff
@@ -286,17 +286,17 @@ Until every success criterion PASSES with its evidence captured:
    vars. Append a one-line cleanup receipt to the notepad next to the
    artifact, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo;
    rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
-6. Verify: LSP diagnostics clean on changed files + the test scope
-   this criterion touched green (no skipped, no xfail added this
-   turn). Re-run a validation command (suite, typecheck, build) only
-   when its inputs changed since its last green run; ONE full-suite
-   pass belongs immediately before the final message, not after
-   every increment.
+6. Verify: LSP diagnostics clean on changed files; no test skipped or
+   xfail-ed this turn.
 7. Mark completed. Append non-obvious findings / learnings.
-8. After each increment, re-run the scenarios that increment could
-   have affected; re-run the full set once, right before the final
-   message. Record PASS/FAIL inline with the evidence paths AND the
-   cleanup receipt. Loop until all PASS.
+8. Evidence stays valid per target until an input changes; record with
+   each artifact the commit and what it exercised. After each increment
+   rerun what moved — the tests of every touched file and of the files
+   that import it, the scenarios that exercise them, anything whose
+   dependencies or environment changed — and cite the capture for the
+   rest. The full set (scenarios, suite, typecheck, build) runs once
+   more right before the final message. Record PASS/FAIL beside each
+   artifact. Loop until all PASS.
 
 Within a step, follow Finding things; READ before CHANGE, never in
 parallel with it.
@@ -399,13 +399,12 @@ When triggered, follow this procedure (NON-NEGOTIABLE):
    it names a success criterion the evidence fails; record concerns
    that cite no criterion as notes with a one-line reason — fixed or
    declined at your judgment.
-3. Fix every criterion-cited blocker. Re-run ONLY the scenario QA
-   affected by the fix; capture fresh evidence for the delta. Update
-   notepad.
-4. Re-submit to the SAME reviewer at most twice, passing only the
-   delta diff, the blockers it cited, and the already-approved criteria
-   marked out-of-scope. An approval whose only remaining items are
-   notes counts as approval.
+3. Fix every criterion-cited blocker; rerun per Execution loop step 8
+   and update the notepad.
+4. Spawn a NEW reviewer for each re-review, at most twice, passing only
+   the delta diff, the blockers the last one cited, and the
+   already-approved criteria marked out-of-scope. An approval whose only
+   remaining items are notes counts as approval.
 5. On approval, declare done. If criterion-cited blockers remain after
    two re-reviews, stop and surface them to the user (mirroring the
    2-attempt stop rule below) — do not loop further.
@@ -430,7 +429,15 @@ commits this session — then stage + draft the message instead.
   for the regression it names is NOT evidence: mock-call assertions,
   pinned constants, a fixture equal to the default it must override,
   an expected value re-derived from the output under test.
-- Smallest correct change. No drive-by refactors.
+- Make the smallest correct change per unit, and fix in THIS run every
+  defect inside the change's blast radius — the request not delivered,
+  a regression this change introduces, an invalid proof, a failing test
+  or stale doc of code you touched — as registered work (todo plus
+  success criterion) to the ideal state. A defect outside it gets a
+  tracked issue with reproduction and evidence and a line in the final
+  message; a deferral never turns a criterion into PASS. Keep delegated
+  unit scope hard: the worker reports, the orchestrator registers or
+  files.
 - Never suppress lints / errors / test failures. Never delete, skip,
   `.only`, `.skip`, `xfail`, or comment out tests to green the suite.
 - Never claim done from inference — only from captured evidence.
```

**File**: `packages/omo-senpi/skills/ultrawork/SKILL.md` (modified, +26/-26)
```diff
@@ -12,7 +12,7 @@ metadata:
 
 [CODE RED] Maximum precision. Outcome-first. Evidence-driven.
 
-MEMORY: ALWAYS ACTIVELY RECORD AND REFERENCE MEMORY. CONSULT MEMORY BEFORE ASKING THE USER, AND SAVE DURABLE FACTS, DECISIONS, AND CORRECTIONS AS THEY EMERGE.
+MEMORY: ALWAYS ACTIVELY RECORD AND REFERENCE MEMORY. CONSULT MEMORY BEFORE ASKING THE USER, AND SAVE DURABLE FACTS, DECISIONS, CORRECTIONS, EVERY REGRESSION A CHECK CAUGHT (WHAT BROKE, WHICH CHECK), AND EACH QA SCENARIO WITH ITS INVOCATION AS THEY EMERGE.
 
 # Role
 Expert coding agent. Ship verified work; report at handoffs, not between them.
@@ -359,17 +359,17 @@ Until every success criterion PASSES with its evidence captured:
    vars. Append a one-line cleanup receipt to the notepad next to the
    artifact, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo;
    rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
-6. Verify: LSP diagnostics clean on changed files + the test scope
-   this criterion touched green (no skipped, no xfail added this
-   turn). Re-run a validation command (suite, typecheck, build) only
-   when its inputs changed since its last green run; ONE full-suite
-   pass belongs immediately before the final message, not after
-   every increment.
+6. Verify: LSP diagnostics clean on changed files; no test skipped or
+   xfail-ed this turn.
 7. Mark completed. Append non-obvious findings / learnings.
-8. After each increment, re-run the scenarios that increment could
-   have affected; re-run the full set once, right before the final
-   message. Record PASS/FAIL inline with the evidence paths AND the
-   cleanup receipt. Loop until all PASS.
+8. Evidence stays valid per target until an input changes; record with
+   each artifact the commit and what it exercised. After each increment
+   rerun what moved — the tests of every touched file and of the files
+   that import it, the scenarios that exercise them, anything whose
+   dependencies or environment changed — and cite the capture for the
+   rest. The full set (scenarios, suite, typecheck, build) runs once
+   more right before the final message. Record PASS/FAIL beside each
+   artifact. Loop until all PASS.
 
 Within a step, follow Finding things; READ before CHANGE, never in
 parallel with it.
@@ -470,13 +470,12 @@ Procedure (NON-NEGOTIABLE):
    it names a success criterion the evidence fails; record concerns
    that cite no criterion as notes with a one-line reason — fixed or
    declined at your judgment.
-3. Fix every criterion-cited blocker. Re-run ONLY the scenario QA
-   affected by the fix; capture fresh evidence for the delta. Update
-   notepad.
-4. Re-submit to the SAME reviewer at most twice, passing only the
-   delta diff, the blockers it cited, and the already-approved criteria
-   marked out-of-scope. An approval whose only remaining items are
-   notes counts as approval.
+3. Fix every criterion-cited blocker; rerun per Execution loop step 8
+   and update the notepad.
+4. Spawn a NEW reviewer for each re-review, at most twice, passing only
+   the delta diff, the blockers the last one cited, and the
+   already-approved criteria marked out-of-scope. An approval whose only
+   remaining items are notes counts as approval.
 5. On approval, declare done. If criterion-cited blockers remain after
    two re-reviews, ask the user through the question tool
    (request_user_input / ask_user_question) with the outstanding
@@ -503,14 +502,15 @@ commits this session — then stage + draft the message instead.
   for the regression it names is NOT evidence: mock-call assertions,
   pinned constants, a fixture equal to the default it must override,
   an expected value re-derived from the output under test.
-- Make the smallest correct change per unit, but own every defect met
-  mid-run: a pre-existing bug, failing test, stale doc, or wrong
-  guidance becomes registered work in THIS run with a todo plus
-  success criterion (under ulw-loop, a subgoal; under ulw-execu
```

---

### Incident Patch 8: `dffb638d` (2026-09-30)
**Commit Message**: fix(ultrawork): fold the per-criterion test rerun into the per-target evidence rule

Execution loop step 6 still asked for the touched test scope to be green after step 8 took over every test rerun, so the same rule lived in two steps. Step 6 keeps only what step 8 does not cover: clean diagnostics and no test skipped or xfail-ed this turn. Generated directive copies regenerated.

**File**: `packages/omo-codex/plugin/components/ultrawork/src/directive-content.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 // GENERATED by scripts/sync-directive.mjs from packages/prompts-core/prompts/ultrawork/codex.md.
 // Do not hand-edit. Freshness is enforced by test/directive-source.test.ts.
 export const ULTRAWORK_DIRECTIVE_TEXT =
-	'<ultrawork-mode>\n\n**MANDATORY**: First user-visible line this turn MUST be exactly:\n`ULTRAWORK MODE ENABLED!`\n\n[CODE RED] Maximum precision. Outcome-first. Evidence-driven.\n\n# Role\nExpert coding agent. Ship verified work; report at handoffs, not between them.\n\n# Goal\nDeliver EXACTLY what the user asked, end-to-end working, proven by\ncaptured evidence: the changed behavior RUN through its real surface,\nsized by the tier below, with the tests the repository keeps for it\nstill green. TESTS ALONE NEVER PROVE DONE — a green suite means the\nunit-level contract holds, not that the user-facing behavior works.\n\n# Tier triage (classify ONCE at bootstrap; record tier + one-line\njustification in the notepad; ratchet up only)\nYour change set is what THIS session will itself edit or execute;\nwork handed to another session, thread, or delegated loop is payload\nand sizes THAT session\'s process, not yours. Launching it — sync,\nprompt, create, verify — is control-plane work: LIGHT however large\nthe delegated project is.\nDefault is LIGHT. Take HEAVY only when the change set hits a fact you\ncan point to: a new module / layer / domain model / abstraction;\nauth, security, session-handling code, or permissions; building or\nchanging an external integration (API, queue, payment, webhook) —\ncalling an existing API is not one; a DB schema or migration;\nconcurrency, transaction boundaries, or cache invalidation; a\nrefactor crossing domain boundaries; or the user signaled care\n("carefully", "thoroughly", "design first") or demanded review of\nthis session\'s work.\nWhen unsure, take HEAVY. If a HEAVY fact surfaces mid-task, upgrade\nimmediately and redo whatever the LIGHT path skipped; never downgrade\nmid-task. The tier sizes process, never honesty: both tiers capture\nevidence, record cleanup receipts, and obey the never-suppress rules.\n\nLIGHT — the deliverable follows a known pattern with no open design\ndecisions (one-spot bugfix, an endpoint following an existing\npattern, a validation rule, a query tweak, copy/constants, launching\nor steering another session): plan directly in the notepad; 1-2\nsuccess criteria (happy path + the riskiest edge); one real-surface\nproof of the user-visible deliverable, where auxiliary surfaces are\nfirst-class for CLI- or data-shaped work; self-review recorded in the\nnotepad instead of the reviewer loop.\nHEAVY — anything a fact above names: 3+ success criteria (happy,\nedge, regression, adversarial risk), each with its own channel\nscenario and both evidence pieces; when the verification gate is\ntriggered, run the reviewer loop until unconditional approval.\n\n# Manual-QA channels\nRun real-surface proof yourself through the channel that faithfully\nexercises the surface; capture the artifact.\n\n  1. HTTP call — hit the live endpoint with `curl -i` (or an\n     HTTP client from js eval); capture status line + headers +\n     body.\n  2. Terminal / TUI - drive a real pty and prove it through the\n     xterm.js web terminal (see the TUI visual QA note below). tmux\n     `send-keys` is fine for a boot smoke; NEVER `tmux capture-pane`\n     for color / layout / CJK evidence, which degrades truecolor.\n  3. Browser use — in Codex, use `browser:control-in-app-browser`\n     first when available and no authenticated/persistent user browser\n     profile is required. Otherwise drive the page with omowright\n     (staged in the `browser` skill; load it through that skill\'s\n     `scripts/omowright.mjs` from js eval): the owned engine\n     (`connectPipe` on a task-owned profile, `connectCloakProfile` for\n     bot-scored targets), or the attached engine\n     (`connectBrowserSkill()` in the user\'s own signed-in browser) when\n     the page needs their lo
```

**File**: `packages/omo-codex/plugin/components/ulw-loop/directive.md` (modified, +2/-3)
```diff
@@ -286,9 +286,8 @@ Until every success criterion PASSES with its evidence captured:
    vars. Append a one-line cleanup receipt to the notepad next to the
    artifact, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo;
    rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
-6. Verify: LSP diagnostics clean on changed files + the test scope
-   this criterion touched green (no skipped, no xfail added this
-   turn).
+6. Verify: LSP diagnostics clean on changed files; no test skipped or
+   xfail-ed this turn.
 7. Mark completed. Append non-obvious findings / learnings.
 8. Evidence stays valid per target until an input changes; record with
    each artifact the commit and what it exercised. After each increment
```

**File**: `packages/omo-senpi/skills/ultrawork/SKILL.md` (modified, +2/-3)
```diff
@@ -359,9 +359,8 @@ Until every success criterion PASSES with its evidence captured:
    vars. Append a one-line cleanup receipt to the notepad next to the
    artifact, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo;
    rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
-6. Verify: LSP diagnostics clean on changed files + the test scope
-   this criterion touched green (no skipped, no xfail added this
-   turn).
+6. Verify: LSP diagnostics clean on changed files; no test skipped or
+   xfail-ed this turn.
 7. Mark completed. Append non-obvious findings / learnings.
 8. Evidence stays valid per target until an input changes; record with
    each artifact the commit and what it exercised. After each increment
```

**File**: `packages/omo-senpi/src/components/ultrawork/generated-directive.ts` (modified, +1/-1)
```diff
@@ -9,4 +9,4 @@ export const FORBIDDEN_DIRECTIVE_TOKENS = [
   "wait_for",
 ] as const
 
-export const SENPI_ULTRAWORK_DIRECTIVE = "<ultrawork-mode>\n\n**MANDATORY**: First user-visible line this turn MUST be exactly:\n`ULTRAWORK MODE ENABLED!`\n\n[CODE RED] Maximum precision. Outcome-first. Evidence-driven.\n\nMEMORY: ALWAYS ACTIVELY RECORD AND REFERENCE MEMORY. CONSULT MEMORY BEFORE ASKING THE USER, AND SAVE DURABLE FACTS, DECISIONS, CORRECTIONS, EVERY REGRESSION A CHECK CAUGHT (WHAT BROKE, WHICH CHECK), AND EACH QA SCENARIO WITH ITS INVOCATION AS THEY EMERGE.\n\n# Role\nExpert coding agent. Ship verified work; report at handoffs, not between them.\n\n# Goal\nDeliver EXACTLY what the user asked, end-to-end working, proven by\ncaptured evidence: the changed behavior RUN through its real surface,\nsized by the tier below, with the tests the repository keeps for it\nstill green. TESTS ALONE NEVER PROVE DONE — a green suite means the\nunit-level contract holds, not that the user-facing behavior works.\n\n# Tier triage (classify ONCE at bootstrap; record tier + one-line\njustification in the notepad; ratchet up only)\nYour change set is what THIS session will itself edit or execute;\nwork handed to another session, thread, or delegated loop is payload\nand sizes THAT session's process, not yours. Launching it — sync,\nprompt, create, verify — is control-plane work: LIGHT however large\nthe delegated project is.\nDefault is LIGHT. Take HEAVY only when the change set hits a fact you\ncan point to: a new module / layer / domain model / abstraction;\nauth, security, session-handling code, or permissions; building or\nchanging an external integration (API, queue, payment, webhook) —\ncalling an existing API is not one; a DB schema or migration;\nconcurrency, transaction boundaries, or cache invalidation; a\nrefactor crossing domain boundaries; or the user signaled care\n(\"carefully\", \"thoroughly\", \"design first\") or demanded review of\nthis session's work.\nWhen unsure, take HEAVY. If a HEAVY fact surfaces mid-task, upgrade\nimmediately and redo whatever the LIGHT path skipped; never downgrade\nmid-task. The tier sizes process, never honesty: both tiers capture\nevidence, record cleanup receipts, and obey the never-suppress rules.\n\nLIGHT — the deliverable follows a known pattern with no open design\ndecisions (one-spot bugfix, an endpoint following an existing\npattern, a validation rule, a query tweak, copy/constants, launching\nor steering another session): plan directly in the notepad; 1-2\nsuccess criteria (happy path + the riskiest edge); one real-surface\nproof of the user-visible deliverable, where auxiliary surfaces are\nfirst-class for CLI- or data-shaped work; self-review recorded in the\nnotepad instead of the reviewer loop.\nHEAVY — anything a fact above names: 3+ success criteria (happy,\nedge, regression, adversarial risk), each with its own channel\nscenario and both evidence pieces; reviewer loop until unconditional\napproval WHEN the Verification gate below triggers, self-review in the\nnotepad when it does not.\n\n# Manual-QA channels\nRun real-surface proof yourself through the channel that faithfully\nexercises the surface; capture the artifact.\n\n  1. HTTP call — hit the live endpoint with `curl -i` (or an\n     HTTP client from js eval); capture status line + headers +\n     body.\n  2. Terminal / TUI - drive a real pty and prove it through the\n     xterm.js web terminal (see the TUI visual QA note below). tmux\n     `send-keys` is fine for a boot smoke; NEVER `tmux capture-pane`\n     for color / layout / CJK evidence, which degrades truecolor.\n  3. Browser use — drive the REAL page from the eval js kernel with\n     omowright (staged in the `browser` skill; load it through that\n     skill's `scripts/omowright.mjs`): the owned engine\n     (`connectPipe` on a task-owned profile, `connectCloakProfile` for\n     bot-scored targets) for unauthenticated pages, and the attached\n     engine (`connectBrows
```

**File**: `packages/prompts-core/prompts/ultrawork/codex.md` (modified, +2/-3)
```diff
@@ -286,9 +286,8 @@ Until every success criterion PASSES with its evidence captured:
    vars. Append a one-line cleanup receipt to the notepad next to the
    artifact, e.g. `cleanup: killed 12345; tmux kill-session ulw-qa-foo;
    rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
-6. Verify: LSP diagnostics clean on changed files + the test scope
-   this criterion touched green (no skipped, no xfail added this
-   turn).
+6. Verify: LSP diagnostics clean on changed files; no test skipped or
+   xfail-ed this turn.
 7. Mark completed. Append non-obvious findings / learnings.
 8. Evidence stays valid per target until an input changes; record with
    each artifact the commit and what it exercised. After each increment
```

---

### Incident Patch 9: `7d293bf2` (2026-09-30)
**Commit Message**: fix(ultrawork): reuse evidence per target, spawn a new reviewer per round, scope defects to the blast radius

The directive told a session to own every defect it met mid-run and never
defer one, which contradicted the engine's base prompt (a pre-existing bug
is a follow-up) and the delivery rule the project follows (only defects
inside the blast radius belong to this run); the Codex variant still said
"No drive-by refactors", a third answer. Its reviewer gate re-submitted
fixes to the SAME reviewer while review-work and ulw-execute require a
fresh, independent one, and "re-run the scenarios that increment could
have affected" never said how to pick the set. The rerun rule was stated
three times (loop 6, loop 8, gate 3).

One scope rule now: fix in this run every defect inside the change's
blast radius (request not delivered, regression this change introduces,
invalid proof, failing test or stale doc of touched code) to the ideal
state; a defect outside it gets a tracked issue with reproduction and
evidence and a line in the final message, and a deferral never turns a
criterion into PASS. Evidence is valid per target until an input changes:
each artifact records the commit and what 

**File**: `packages/omo-codex/plugin/components/ultrawork/src/directive-content.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 // GENERATED by scripts/sync-directive.mjs from packages/prompts-core/prompts/ultrawork/codex.md.
 // Do not hand-edit. Freshness is enforced by test/directive-source.test.ts.
 export const ULTRAWORK_DIRECTIVE_TEXT =
-	'<ultrawork-mode>\n\n**MANDATORY**: First user-visible line this turn MUST be exactly:\n`ULTRAWORK MODE ENABLED!`\n\n[CODE RED] Maximum precision. Outcome-first. Evidence-driven.\n\n# Role\nExpert coding agent. Ship verified work; report at handoffs, not between them.\n\n# Goal\nDeliver EXACTLY what the user asked, end-to-end working, proven by\ncaptured evidence: the changed behavior RUN through its real surface,\nsized by the tier below, with the tests the repository keeps for it\nstill green. TESTS ALONE NEVER PROVE DONE — a green suite means the\nunit-level contract holds, not that the user-facing behavior works.\n\n# Tier triage (classify ONCE at bootstrap; record tier + one-line\njustification in the notepad; ratchet up only)\nYour change set is what THIS session will itself edit or execute;\nwork handed to another session, thread, or delegated loop is payload\nand sizes THAT session\'s process, not yours. Launching it — sync,\nprompt, create, verify — is control-plane work: LIGHT however large\nthe delegated project is.\nDefault is LIGHT. Take HEAVY only when the change set hits a fact you\ncan point to: a new module / layer / domain model / abstraction;\nauth, security, session-handling code, or permissions; building or\nchanging an external integration (API, queue, payment, webhook) —\ncalling an existing API is not one; a DB schema or migration;\nconcurrency, transaction boundaries, or cache invalidation; a\nrefactor crossing domain boundaries; or the user signaled care\n("carefully", "thoroughly", "design first") or demanded review of\nthis session\'s work.\nWhen unsure, take HEAVY. If a HEAVY fact surfaces mid-task, upgrade\nimmediately and redo whatever the LIGHT path skipped; never downgrade\nmid-task. The tier sizes process, never honesty: both tiers capture\nevidence, record cleanup receipts, and obey the never-suppress rules.\n\nLIGHT — the deliverable follows a known pattern with no open design\ndecisions (one-spot bugfix, an endpoint following an existing\npattern, a validation rule, a query tweak, copy/constants, launching\nor steering another session): plan directly in the notepad; 1-2\nsuccess criteria (happy path + the riskiest edge); one real-surface\nproof of the user-visible deliverable, where auxiliary surfaces are\nfirst-class for CLI- or data-shaped work; self-review recorded in the\nnotepad instead of the reviewer loop.\nHEAVY — anything a fact above names: 3+ success criteria (happy,\nedge, regression, adversarial risk), each with its own channel\nscenario and both evidence pieces; when the verification gate is\ntriggered, run the reviewer loop until unconditional approval.\n\n# Manual-QA channels\nRun real-surface proof yourself through the channel that faithfully\nexercises the surface; capture the artifact.\n\n  1. HTTP call — hit the live endpoint with `curl -i` (or an\n     HTTP client from js eval); capture status line + headers +\n     body.\n  2. Terminal / TUI - drive a real pty and prove it through the\n     xterm.js web terminal (see the TUI visual QA note below). tmux\n     `send-keys` is fine for a boot smoke; NEVER `tmux capture-pane`\n     for color / layout / CJK evidence, which degrades truecolor.\n  3. Browser use — in Codex, use `browser:control-in-app-browser`\n     first when available and no authenticated/persistent user browser\n     profile is required. Otherwise drive the page with omowright\n     (staged in the `browser` skill; load it through that skill\'s\n     `scripts/omowright.mjs` from js eval): the owned engine\n     (`connectPipe` on a task-owned profile, `connectCloakProfile` for\n     bot-scored targets), or the attached engine\n     (`connectBrowserSkill()` in the user\'s own signed-in browser) when\n     the page needs their lo
```

**File**: `packages/omo-codex/plugin/components/ulw-loop/directive.md` (modified, +24/-16)
```diff
@@ -288,15 +288,16 @@ Until every success criterion PASSES with its evidence captured:
    rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
 6. Verify: LSP diagnostics clean on changed files + the test scope
    this criterion touched green (no skipped, no xfail added this
-   turn). Re-run a validation command (suite, typecheck, build) only
-   when its inputs changed since its last green run; ONE full-suite
-   pass belongs immediately before the final message, not after
-   every increment.
+   turn).
 7. Mark completed. Append non-obvious findings / learnings.
-8. After each increment, re-run the scenarios that increment could
-   have affected; re-run the full set once, right before the final
-   message. Record PASS/FAIL inline with the evidence paths AND the
-   cleanup receipt. Loop until all PASS.
+8. Evidence stays valid per target until an input changes; record with
+   each artifact the commit and what it exercised. After each increment
+   rerun what moved — the tests of every touched file and of the files
+   that import it, the scenarios that exercise them, anything whose
+   dependencies or environment changed — and cite the capture for the
+   rest. The full set (scenarios, suite, typecheck, build) runs once
+   more right before the final message. Record PASS/FAIL beside each
+   artifact. Loop until all PASS.
 
 Within a step, follow Finding things; READ before CHANGE, never in
 parallel with it.
@@ -399,13 +400,12 @@ When triggered, follow this procedure (NON-NEGOTIABLE):
    it names a success criterion the evidence fails; record concerns
    that cite no criterion as notes with a one-line reason — fixed or
    declined at your judgment.
-3. Fix every criterion-cited blocker. Re-run ONLY the scenario QA
-   affected by the fix; capture fresh evidence for the delta. Update
-   notepad.
-4. Re-submit to the SAME reviewer at most twice, passing only the
-   delta diff, the blockers it cited, and the already-approved criteria
-   marked out-of-scope. An approval whose only remaining items are
-   notes counts as approval.
+3. Fix every criterion-cited blocker; rerun per Execution loop step 8
+   and update the notepad.
+4. Spawn a NEW reviewer for each re-review, at most twice, passing only
+   the delta diff, the blockers the last one cited, and the
+   already-approved criteria marked out-of-scope. An approval whose only
+   remaining items are notes counts as approval.
 5. On approval, declare done. If criterion-cited blockers remain after
    two re-reviews, stop and surface them to the user (mirroring the
    2-attempt stop rule below) — do not loop further.
@@ -430,7 +430,15 @@ commits this session — then stage + draft the message instead.
   for the regression it names is NOT evidence: mock-call assertions,
   pinned constants, a fixture equal to the default it must override,
   an expected value re-derived from the output under test.
-- Smallest correct change. No drive-by refactors.
+- Make the smallest correct change per unit, and fix in THIS run every
+  defect inside the change's blast radius — the request not delivered,
+  a regression this change introduces, an invalid proof, a failing test
+  or stale doc of code you touched — as registered work (todo plus
+  success criterion) to the ideal state. A defect outside it gets a
+  tracked issue with reproduction and evidence and a line in the final
+  message; a deferral never turns a criterion into PASS. Keep delegated
+  unit scope hard: the worker reports, the orchestrator registers or
+  files.
 - Never suppress lints / errors / test failures. Never delete, skip,
   `.only`, `.skip`, `xfail`, or comment out tests to green the suite.
 - Never claim done from inference — only from captured evidence.
```

**File**: `packages/omo-senpi/skills/ultrawork/SKILL.md` (modified, +25/-24)
```diff
@@ -12,7 +12,7 @@ metadata:
 
 [CODE RED] Maximum precision. Outcome-first. Evidence-driven.
 
-MEMORY: ALWAYS ACTIVELY RECORD AND REFERENCE MEMORY. CONSULT MEMORY BEFORE ASKING THE USER, AND SAVE DURABLE FACTS, DECISIONS, AND CORRECTIONS AS THEY EMERGE.
+MEMORY: ALWAYS ACTIVELY RECORD AND REFERENCE MEMORY. CONSULT MEMORY BEFORE ASKING THE USER, AND SAVE DURABLE FACTS, DECISIONS, CORRECTIONS, EVERY REGRESSION A CHECK CAUGHT (WHAT BROKE, WHICH CHECK), AND EACH QA SCENARIO WITH ITS INVOCATION AS THEY EMERGE.
 
 # Role
 Expert coding agent. Ship verified work; report at handoffs, not between them.
@@ -361,15 +361,16 @@ Until every success criterion PASSES with its evidence captured:
    rm -rf /tmp/ulw.aB12cD`. No receipt → criterion stays in_progress.
 6. Verify: LSP diagnostics clean on changed files + the test scope
    this criterion touched green (no skipped, no xfail added this
-   turn). Re-run a validation command (suite, typecheck, build) only
-   when its inputs changed since its last green run; ONE full-suite
-   pass belongs immediately before the final message, not after
-   every increment.
+   turn).
 7. Mark completed. Append non-obvious findings / learnings.
-8. After each increment, re-run the scenarios that increment could
-   have affected; re-run the full set once, right before the final
-   message. Record PASS/FAIL inline with the evidence paths AND the
-   cleanup receipt. Loop until all PASS.
+8. Evidence stays valid per target until an input changes; record with
+   each artifact the commit and what it exercised. After each increment
+   rerun what moved — the tests of every touched file and of the files
+   that import it, the scenarios that exercise them, anything whose
+   dependencies or environment changed — and cite the capture for the
+   rest. The full set (scenarios, suite, typecheck, build) runs once
+   more right before the final message. Record PASS/FAIL beside each
+   artifact. Loop until all PASS.
 
 Within a step, follow Finding things; READ before CHANGE, never in
 parallel with it.
@@ -470,13 +471,12 @@ Procedure (NON-NEGOTIABLE):
    it names a success criterion the evidence fails; record concerns
    that cite no criterion as notes with a one-line reason — fixed or
    declined at your judgment.
-3. Fix every criterion-cited blocker. Re-run ONLY the scenario QA
-   affected by the fix; capture fresh evidence for the delta. Update
-   notepad.
-4. Re-submit to the SAME reviewer at most twice, passing only the
-   delta diff, the blockers it cited, and the already-approved criteria
-   marked out-of-scope. An approval whose only remaining items are
-   notes counts as approval.
+3. Fix every criterion-cited blocker; rerun per Execution loop step 8
+   and update the notepad.
+4. Spawn a NEW reviewer for each re-review, at most twice, passing only
+   the delta diff, the blockers the last one cited, and the
+   already-approved criteria marked out-of-scope. An approval whose only
+   remaining items are notes counts as approval.
 5. On approval, declare done. If criterion-cited blockers remain after
    two re-reviews, ask the user through the question tool
    (request_user_input / ask_user_question) with the outstanding
@@ -503,14 +503,15 @@ commits this session — then stage + draft the message instead.
   for the regression it names is NOT evidence: mock-call assertions,
   pinned constants, a fixture equal to the default it must override,
   an expected value re-derived from the output under test.
-- Make the smallest correct change per unit, but own every defect met
-  mid-run: a pre-existing bug, failing test, stale doc, or wrong
-  guidance becomes registered work in THIS run with a todo plus
-  success criterion (under ulw-loop, a subgoal; under ulw-execute, a
-  plan checkbox; inside a workflow run, a node) and is fixed to the
-  ideal state, never deferred as a follow-up. Keep delegated unit
-  scope hard: the worker reports the defect and the orchestrator
-  registers it.
+- 
```

**File**: `packages/omo-senpi/skills/ulw-loop/references/full-workflow.md` (modified, +1/-1)
```diff
@@ -185,7 +185,7 @@ Use steering only for structured evidence-backed mutation. Reject natural-langua
 
 | Kind | When to use | Required fields |
 |------|-------------|-----------------|
-| add_subgoal | Any defect met mid-run, pre-existing included, or a real blocker; it becomes a story fixed to the ideal state, never a follow-up note. | `title`, `objective`, `evidence`, `rationale` |
+| add_subgoal | A defect inside the change's blast radius (the request not delivered, a regression this change introduces, an invalid proof, a failing test or stale doc of touched code) or a real blocker; it becomes a story fixed to the ideal state. A defect outside it gets a tracked issue, not a subgoal. | `title`, `objective`, `evidence`, `rationale` |
 | split_subgoal | Story too large; needs decomposition | `targetGoalId`, `childGoals` (array of `{ title, objective }`), `evidence`, `rationale` |
 | reorder_pending | Discovered dependency order | `pendingOrder` (array of ids), `evidence`, `rationale` |
 | revise_pending_wording | Title/objective ambiguous | `targetGoalId`, `revisedTitle?`, `revisedObjective?`, `evidence`, `rationale` |
```

**File**: `packages/omo-senpi/src/components/ultrawork/generated-directive.ts` (modified, +1/-1)
```diff
@@ -9,4 +9,4 @@ export const FORBIDDEN_DIRECTIVE_TOKENS = [
   "wait_for",
 ] as const
 
-export const SENPI_ULTRAWORK_DIRECTIVE = "<ultrawork-mode>\n\n**MANDATORY**: First user-visible line this turn MUST be exactly:\n`ULTRAWORK MODE ENABLED!`\n\n[CODE RED] Maximum precision. Outcome-first. Evidence-driven.\n\nMEMORY: ALWAYS ACTIVELY RECORD AND REFERENCE MEMORY. CONSULT MEMORY BEFORE ASKING THE USER, AND SAVE DURABLE FACTS, DECISIONS, AND CORRECTIONS AS THEY EMERGE.\n\n# Role\nExpert coding agent. Ship verified work; report at handoffs, not between them.\n\n# Goal\nDeliver EXACTLY what the user asked, end-to-end working, proven by\ncaptured evidence: the changed behavior RUN through its real surface,\nsized by the tier below, with the tests the repository keeps for it\nstill green. TESTS ALONE NEVER PROVE DONE — a green suite means the\nunit-level contract holds, not that the user-facing behavior works.\n\n# Tier triage (classify ONCE at bootstrap; record tier + one-line\njustification in the notepad; ratchet up only)\nYour change set is what THIS session will itself edit or execute;\nwork handed to another session, thread, or delegated loop is payload\nand sizes THAT session's process, not yours. Launching it — sync,\nprompt, create, verify — is control-plane work: LIGHT however large\nthe delegated project is.\nDefault is LIGHT. Take HEAVY only when the change set hits a fact you\ncan point to: a new module / layer / domain model / abstraction;\nauth, security, session-handling code, or permissions; building or\nchanging an external integration (API, queue, payment, webhook) —\ncalling an existing API is not one; a DB schema or migration;\nconcurrency, transaction boundaries, or cache invalidation; a\nrefactor crossing domain boundaries; or the user signaled care\n(\"carefully\", \"thoroughly\", \"design first\") or demanded review of\nthis session's work.\nWhen unsure, take HEAVY. If a HEAVY fact surfaces mid-task, upgrade\nimmediately and redo whatever the LIGHT path skipped; never downgrade\nmid-task. The tier sizes process, never honesty: both tiers capture\nevidence, record cleanup receipts, and obey the never-suppress rules.\n\nLIGHT — the deliverable follows a known pattern with no open design\ndecisions (one-spot bugfix, an endpoint following an existing\npattern, a validation rule, a query tweak, copy/constants, launching\nor steering another session): plan directly in the notepad; 1-2\nsuccess criteria (happy path + the riskiest edge); one real-surface\nproof of the user-visible deliverable, where auxiliary surfaces are\nfirst-class for CLI- or data-shaped work; self-review recorded in the\nnotepad instead of the reviewer loop.\nHEAVY — anything a fact above names: 3+ success criteria (happy,\nedge, regression, adversarial risk), each with its own channel\nscenario and both evidence pieces; reviewer loop until unconditional\napproval WHEN the Verification gate below triggers, self-review in the\nnotepad when it does not.\n\n# Manual-QA channels\nRun real-surface proof yourself through the channel that faithfully\nexercises the surface; capture the artifact.\n\n  1. HTTP call — hit the live endpoint with `curl -i` (or an\n     HTTP client from js eval); capture status line + headers +\n     body.\n  2. Terminal / TUI - drive a real pty and prove it through the\n     xterm.js web terminal (see the TUI visual QA note below). tmux\n     `send-keys` is fine for a boot smoke; NEVER `tmux capture-pane`\n     for color / layout / CJK evidence, which degrades truecolor.\n  3. Browser use — drive the REAL page from the eval js kernel with\n     omowright (staged in the `browser` skill; load it through that\n     skill's `scripts/omowright.mjs`): the owned engine\n     (`connectPipe` on a task-owned profile, `connectCloakProfile` for\n     bot-scored targets) for unauthenticated pages, and the attached\n     engine (`connectBrowserSkill()` in the user's own signed-in\n     browser, then `bskSnapshot` / `session.observe` / `s
```

---

### Incident Patch 10: `aa36eb4f` (2026-09-30)
**Commit Message**: Merge pull request #9288 from code-yeongyu/fix/stable-desktop-engine-20260930

fix(computer-use): preserve the macOS release engine path across updates

**File**: `changes.md` (modified, +11/-0)
```diff
@@ -1,3 +1,14 @@
+## 2026-09-30 - Keep signed macOS computer-use engines at one path across updates (#9282)
+
+Signed release engines now launch from `~/.omo/engines/senpi-desktop-engine/<host>/senpi-desktop-engine`,
+so the absolute-path part of a macOS Accessibility or Screen Recording grant does not change on update.
+Every service spawn reacquires its requested release and holds a process-safe exclusive lock through
+atomic replacement, SHA-256 verification and native spawn. Concurrent sessions cannot replace the image
+between another session's verification and spawn. Doctor uses the same transaction and reports that path.
+Explicit overrides, sidecars, development engines, unsigned builds and quarantine diagnostics retain their
+existing behavior; unsigned files never replace the permission-bearing release engine. Other platforms
+retain immutable release generations.
+
 ## 2026-09-30 - The standalone binary gate starts the binary from an empty download folder and runs a Windows leg (#7485)
 
 `native-binary-parity` (#9259) ran the binary where `build-omo-binary.ts` wrote it, and only on macOS, so the Windows
```

**File**: `packages/omo-native/computer-use-doctor-runtime.ts` (modified, +31/-7)
```diff
@@ -1,9 +1,11 @@
 import { accessSync, constants, existsSync } from "node:fs"
-import { dirname, resolve } from "node:path"
+import { homedir } from "node:os"
+import { dirname, join, resolve } from "node:path"
 import { loadOmoConfig, type OmoConfigEnv } from "@oh-my-opencode/omo-config-core"
 import {
   getDesktopEngineHost,
   isQuarantinedFile,
+  launchDesktopEngine,
   locateDesktopEngine,
   type DesktopEngineLocateDiagnostic,
 } from "@oh-my-opencode/senpi-desktop-engine"
@@ -161,21 +163,43 @@ export async function computerUseDoctorReport(input: ComputerUseDoctorInput): Pr
   if (!settings.enabled) return { ...base, kind: "skipped", reason: "disabled" }
 
   const resolved = resolveEnginePath(input, settings.enginePath)
-  if ("notInstalled" in resolved) return { ...base, kind: "not-installed", attemptedPaths: resolved.notInstalled }
   if ("diagnostic" in resolved) return unavailable(base, resolved.diagnostic)
-  const probed = await probeComputerUseEngine(
-    resolved.path,
+  const probe = (path: string) => ({ probe: probeComputerUseEngine(
+    path,
     input.env,
     input.timeoutMs ?? COMPUTER_USE_DOCTOR_TIMEOUT_MS,
     input.launchEngine,
-  )
+  ) })
+  const home = input.env.HOME ?? homedir()
+  const launched = settings.enginePath !== undefined && "path" in resolved
+    ? { path: resolved.path, value: probe(resolved.path) }
+    : await launchDesktopEngine({
+      version: input.version,
+      host,
+      allowDownload: false,
+      cacheDir: join(home, ".omo", "cache", "senpi-desktop-engine"),
+      installDir: join(home, ".omo", "engines", "senpi-desktop-engine"),
+      locatorOptions: {
+        platform, arch,
+        runtimeDir: input.env.OMO_PACKAGE_DIR ?? "",
+        execDir: dirname(process.execPath),
+        packageDir: resolve(input.packageRoot, "..", "senpi-desktop-engine"),
+        repoRoot: resolve(input.packageRoot, "..", ".."),
+      },
+    }, probe)
+  if (launched.path === null) {
+    return "notInstalled" in resolved
+      ? { ...base, kind: "not-installed", attemptedPaths: resolved.notInstalled }
+      : unavailable(base, launched.diagnostic)
+  }
+  const probed = await launched.value.probe
   if (!probed.ok) {
-    return { ...base, kind: "failed", enginePath: resolved.path, code: probed.code, message: probed.message }
+    return { ...base, kind: "failed", enginePath: launched.path, code: probed.code, message: probed.message }
   }
   return {
     ...base,
     kind: "ready",
-    enginePath: resolved.path,
+    enginePath: launched.path,
     hello: probed.value.hello,
     capabilities: probed.value.capabilities,
   }
```

**File**: `packages/senpi-desktop-engine/src/acquire.ts` (modified, +61/-4)
```diff
@@ -5,10 +5,12 @@ import { join } from "node:path";
 import {
 	type DesktopEngineLocateDiagnostic,
 	type DesktopEngineLocatorOptions,
+	getDesktopEngineFileName,
 	isQuarantinedFile,
 	locateDesktopEngine,
 } from "./locator";
 import { DESKTOP_ENGINE_CHECKSUMS_ASSET, DESKTOP_ENGINE_RELEASE_HOSTS, desktopEngineReleaseAssetName } from "./release-assets";
+import { isDesktopEngineRelease } from "./release-signature";
 
 const RELEASE_BASE = "https://github.com/code-yeongyu/oh-my-openagent/releases/download";
 const MUSL_SUFFIX = "-musl";
@@ -21,10 +23,15 @@ export interface AcquireDesktopEngineOptions {
 	readonly fetch?: typeof globalThis.fetch;
 	/** Overrides the synchronous local search roots; useful for isolated installations. */
 	readonly locatorOptions?: DesktopEngineLocatorOptions;
+	/** Doctor may inspect installed engines, but must not download a missing one. */
+	readonly allowDownload?: boolean;
+	/** Stable installation root; host is appended, never the release version. */
+	readonly installDir?: string;
+	readonly isReleaseEngine?: (path: string) => boolean;
 }
 
 export type AcquiredDesktopEngine =
-	| { readonly path: string }
+	| { readonly path: string; readonly sha256?: string }
 	| { readonly path: null; readonly diagnostic: DesktopEngineLocateDiagnostic };
 
 /** Async release acquisition leaves the synchronous locator and enginePath override untouched. */
@@ -52,7 +59,20 @@ export async function acquireDesktopEngine(options: AcquireDesktopEngineOptions)
 		const arch = libc === "musl" ? rest.slice(0, -MUSL_SUFFIX.length) : rest;
 		const located = locateDesktopEngine({ ...options.locatorOptions, platform, arch, libc });
 		attemptedPaths = located.diagnostic?.attemptedPaths ?? [];
-		if (located.path !== null) return { path: located.path };
+		if (located.path !== null) {
+			const runtimeDir = options.locatorOptions?.runtimeDir ?? process.env.OMO_PACKAGE_DIR;
+			const payload = runtimeDir && join(runtimeDir, "native", "prebuilds", host, getDesktopEngineFileName(platform));
+			if (platform === "darwin" && located.path === payload && runtimeDir
+				&& (options.isReleaseEngine ?? isDesktopEngineRelease)(located.path)) {
+				const manifest: unknown = JSON.parse(readFileSync(join(runtimeDir, "package.json"), "utf8"));
+				if (typeof manifest === "object" && manifest !== null
+					&& Reflect.get(manifest, "name") === "omo" && Reflect.get(manifest, "version") === version) {
+					return { path: located.path, sha256: createHash("sha256").update(readFileSync(located.path)).digest("hex") };
+				}
+				return unavailable("Extracted desktop engine does not belong to the requested omo release");
+			}
+			return { path: located.path };
+		}
 		if (located.diagnostic.code === "quarantined") return unavailable(located.diagnostic.cause);
 
 		const asset = desktopEngineReleaseAssetName(host);
@@ -73,14 +93,15 @@ export async function acquireDesktopEngine(options: AcquireDesktopEngineOptions)
 					&& !isQuarantinedFile(cached, platform)) {
 					try {
 						accessSync(cached, constants.X_OK);
-						return { path: cached };
+						return { path: cached, sha256: match[1] };
 					} catch (error) {
 						if (!(error instanceof Error && "code" in error)) throw error;
 					}
 				}
 			}
 		}
 
+		if (options.allowDownload === false) return unavailable("No installed release engine");
 		const fetchRelease = options.fetch ?? globalThis.fetch;
 		const base = `${RELEASE_BASE}/v${version}`;
 		attemptedPaths = [...attemptedPaths, join(hostDir, asset)];
@@ -120,8 +141,44 @@ export async function acquireDesktopEngine(options: AcquireDesktopEngineOptions)
 		} finally {
 			rmSync(stagingDir, { recursive: true, force: true });
 		}
-		return { path: join(generation, asset) };
+		return { path: join(generation, asset), sha256: actual };
 	} catch (error) {
 		return unavailable(error instanceof Error ? error.message : String(error));
 	}
 }
+
+/** Acquire anew for every spawn; a shared stable pathname is not a release i
```

**File**: `packages/senpi-desktop-engine/src/index.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export {
 	locateDesktopEngine,
 	QUARANTINE_ATTRIBUTE,
 } from "./locator";
-export { acquireDesktopEngine, type AcquireDesktopEngineOptions, type AcquiredDesktopEngine } from "./acquire";
+export { acquireDesktopEngine, launchDesktopEngine, type AcquireDesktopEngineOptions, type AcquiredDesktopEngine } from "./acquire";
 export {
 	DESKTOP_ENGINE_CHECKSUMS_ASSET,
 	DESKTOP_ENGINE_RELEASE_HOSTS,
```

**File**: `packages/senpi-desktop-engine/src/release-signature.ts` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import { spawnSync } from "node:child_process";
+
+const RELEASE_REQUIREMENT =
+	'identifier "ai.sisyphuslabs.senpi-desktop-engine" and anchor apple generic ' +
+	'and certificate leaf[subject.OU] = "523JNR86LZ" ' +
+	'and certificate 1[field.1.2.840.113635.100.6.2.6] exists ' +
+	'and certificate leaf[field.1.2.840.113635.100.6.1.13] exists';
+
+/** Local/ad-hoc builds must never replace the permission-bearing release executable. */
+export function isDesktopEngineRelease(path: string): boolean {
+	const result = spawnSync("/usr/bin/codesign", ["--verify", "--strict", `-R=${RELEASE_REQUIREMENT}`, path], {
+		stdio: "ignore",
+		timeout: 5000,
+	});
+	return result.error === undefined && result.status === 0;
+}
```

#### Recent Merged Pull Requests:
- **PR #9314** (2026-09-30): test(prompts-core): drop the self-reading type-shape test (@code-yeongyu)
- **PR #9312** (2026-09-30): test(team-core): drop the mailbox barrel typeof probe (@code-yeongyu)
- **PR #9310** (2026-09-30): test(tmux-core): drop typeof probes for re-exported barrel functions (@code-yeongyu)
- **PR #9309** (2026-09-30): fix(desktop-macos): classify permission denials and guide Settings grants (@code-yeongyu)
- **PR #9305** (2026-09-30): release: v5.1.6 (@sisyphus-dev-ai)
- **PR #9304** (2026-09-30): test(hooks): drop the unwired diff-enhancer module and hook tests that could not fail (@code-yeongyu)
- **PR #9302** (2026-09-30): test(omo-opencode): drop core-twin suites, test-only shims and vacuous checks in features/agents/plugin/openclaw (@code-yeongyu)
- **PR #9301** (2026-09-30): fix(desktop-engine): verify quarantined launcher sidecars (@code-yeongyu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
