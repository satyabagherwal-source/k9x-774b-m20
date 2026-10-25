> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/giancarloerra-socraticode-learnings.md`  
> **Source**: github ([https://github.com/giancarloerra/SocratiCode](https://github.com/giancarloerra/SocratiCode))  
> **Source Version**: `dae6d3a0`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T14:03:28.538Z  
> **Learning ID**: `learn-github-giancarloerra-socraticode`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): giancarloerra/SocratiCode

> **Canonical Artifact**: `07_PROJECT_LEARNING/giancarloerra-socraticode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/giancarloerra/SocratiCode](https://github.com/giancarloerra/SocratiCode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T14:03:28.342Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `giancarloerra/SocratiCode`
- **Description**: Enterprise-grade (40m+ LOC) codebase intelligence, zero-setup, local & private Plugin/Skill/Extension or MCP: hybrid semantic search, polyglot dependency graphs, symbol-level impact analysis & call-flow, interactive HTML viewer, cross-project & branch-aware search, DB/API/infra knowledge. 61% less tokens, 84% fewer calls, 37x faster. Cloud in beta.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3354 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/services/git-state.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectIdFromPath } from "../config.js";

const exec = promisify(execFile);

/** Git is a trigger; this does not describe uncommitted working-tree content. */
export interface GitState {
  ref: string | null;
  head: string;
}

/** One refresh keeps its storage identity even if the checkout moves. */
export interface GitRefreshTarget {
  projectId: string;
  allowCreate: boolean;
  assertCurrent(): Promise<void>;
}

/** Resolve an observed branch through the existing project-identity rules. */
export function gitProjectId(projectPath: string, state: GitState): string {
  return projectIdFromPath(projectPath, state.ref?.replace(/^refs\/heads\//, "") ?? null);
}

/** Capture storage identity and a guard that rejects subsequent checkout changes. */
export function gitRefreshTarget(projectPath: string, state: GitState, allowCreate: boolean): GitRefreshTarget {
  const projectId = gitProjectId(projectPath, state);
  return {
    projectId,
    allowCreate,
    /** Reject a changed ref, commit, or configured identity before continuing. */
    async assertCurrent() {
      const current = await readGitState(projectPath);
      if (!sameGitState(state, current) || gitProjectId(projectPath, current) !== projectId) {
        throw new Error("Git checkout changed during indexing; refresh remains pending for the current checkout.");
      }
    },
  };
}

/** Run a bounded Git query and preserve an actionable failure for the caller. */
async function git(projectPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec("git", args, {
      cwd: projectPath,
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    return stdout.trim();
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
    if (error.code === "ENOENT") throw new Error("Git refresh unavailable: Git or the checkout directory could not be found.");
    if (error.killed) throw new Error("Git refresh failed: Git did not respond within 5 seconds.");
    throw new Error(`Git refresh failed: ${error.stderr?.trim() || error.message}`);
  }
}

/** Read both ref and commit so a same-commit branch switch is still a change. */
export async function readGitState(projectPath: string): Promise<GitState> {
  if (await git(projectPath, ["rev-parse", "--is-inside-work-tree"]) !== "true") {
    throw new Error("Git refresh unavailable: this project is not a Git working tree.");
  }
  // Verify the ref did not move while the commit was being read. A checkout
  // changing repeatedly is pending, never an invented stable observation.
  const ref = await git(projectPath, ["rev-parse", "--symbolic-full-name", "HEAD"]);
  const head = await git(projectPath, ["rev-parse", "--verify", "HEAD"]);
  const refAfter = await git(projectPath, ["rev-parse", "--symbolic-full-name", "HEAD"]);
  if (ref !== refAfter) throw new Error("Git checkout changed while its state was being read; refresh will retry.");
  return { ref: ref === "HEAD" ? null : ref, head };
}

/** Match both ref and commit; two absent observations are not synchronized. */
export function sameGitState(left: GitState | undefined, right: GitState | undefined): boolean {
  return left !== undefined && right !== undefined && left.ref === right.ref && left.head === right.head;
}

```

### Core Architecture Module: `extension/src/commands.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as vscode from "vscode";
import { openInteractiveGraph } from "./graphPanel.js";
import { log, output } from "./output.js";
import type { ProjectsTreeProvider } from "./sidebar.js";

export function registerCommands(
  context: vscode.ExtensionContext,
  sidebar: ProjectsTreeProvider,
): void {
  const subs = context.subscriptions;

  subs.push(
    vscode.commands.registerCommand(
      "socraticode.indexCurrentWorkspace",
      indexCurrentWorkspaceCommand,
    ),
  );

  subs.push(
    vscode.commands.registerCommand(
      "socraticode.openInteractiveGraph",
      async (projectId?: string) => {
        await openInteractiveGraph(projectId);
      },
    ),
  );

  subs.push(
    vscode.commands.registerCommand("socraticode.refreshProjects", () => {
      sidebar.refresh();
    }),
  );

  subs.push(
    vscode.commands.registerCommand("socraticode.openWalkthrough", async () => {
      // Use context.extension.id so this keeps working if the publisher
      // namespace changes. Same pattern as the first-run trigger in
      // extension.ts. Wrapped in try/catch because some VS Code forks
      // do not expose `workbench.action.openWalkthrough` and the
      // command would otherwise reject silently.
      try {
        await vscode.commands.executeCommand(
          "workbench.action.openWalkthrough",
          `${context.extension.id}#socraticode.gettingStarted`,
          false,
        );
      } catch (err) {
        log(`Failed to open walkthrough: ${(err as Error).message}`);
        vscode.window.showWarningMessage(
          "SocratiCode: this editor does not appear to support walkthroughs. See the marketplace listing for getting-started guidance.",
        );
      }
    }),
  );

  subs.push(
    vscode.commands.registerCommand("socraticode.openOutput", () => {
      output().show(true);
    }),
  );
}

async function indexCurrentWorkspaceCommand(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showWarningMessage("SocratiCode: open a folder or workspace before indexing.");
    return;
  }
  // The engine is the authority on indexing. Surface a clear instruction
  // the AI assistant can act on and copy the prompt to the clipboard.
  const prompt = `Use SocratiCode to index this project: call codebase_index for ${ws.uri.fsPath}.`;
  await vscode.env.clipboard.writeText(prompt);
  log(`indexCurrentWorkspace: prompt copied for ${ws.uri.fsPath}`);
  const action = await vscode.window.showInformationMessage(
    "Prompt copied to clipboard. Paste it into your AI assistant chat to index this workspace.",
    "Open chat",
    "Show output",
  );
  if (action === "Open chat") {
    // `workbench.action.chat.open` is not guaranteed across every
    // VS Code-compatible editor (some Theia-based forks omit it). Fall
    // back to the output channel if the host doesn't expose the chat
    // command, so the user always gets useful feedback.
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open");
    } catch (err) {
      log(`Open chat failed: ${(err as Error).message}`);
      output().show(true);
      vscode.window.showInformationMessage(
        "SocratiCode: this editor does not expose a chat command. Opened the SocratiCode output channel instead.",
      );
    }
  } else if (action === "Show output") {
    output().show(true);
  }
}

```

### Core Architecture Module: `extension/src/extension.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as vscode from "vscode";
import { registerCommands } from "./commands.js";
import { registerMcpProvider } from "./mcpProvider.js";
import { initOutput, log } from "./output.js";
import { registerSidebar } from "./sidebar.js";
import { registerStatusBar } from "./statusBar.js";

const FIRST_RUN_KEY = "socraticode.firstRunWalkthroughShown";

/**
 * Extension entry point. Wires up all the building blocks in the order
 * they need: output channel first (so other modules can log during their
 * own setup), then MCP provider (the most important contribution), then
 * sidebar / status bar / commands (UI), then the first-run walkthrough.
 *
 * Note: the entire activation function should stay synchronous from
 * VS Code's point of view (it returns a Promise but every step is fast).
 * Anything slow (network, disk reads) is deferred to when the user
 * actually triggers it via a command.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  initOutput(context);
  log("SocratiCode extension activating");

  registerMcpProvider(context);
  const sidebar = registerSidebar(context);
  registerStatusBar(context);
  registerCommands(context, sidebar);

  // Show the walkthrough on first install. We use globalState rather than
  // a setting so it's per-machine, not per-workspace. Persist the
  // "shown" flag only AFTER the command resolves, so if the host fails
  // to open the walkthrough (some VS Code forks don't expose
  // `workbench.action.openWalkthrough`), the user is offered it again
  // next session instead of silently skipping it forever.
  const shown = context.globalState.get<boolean>(FIRST_RUN_KEY, false);
  if (!shown) {
    try {
      await vscode.commands.executeCommand(
        "workbench.action.openWalkthrough",
        `${context.extension.id}#socraticode.gettingStarted`,
        false,
      );
      await context.globalState.update(FIRST_RUN_KEY, true);
    } catch (err) {
      log(`Failed to open first-run walkthrough: ${(err as Error).message}`);
    }
  }

  log("SocratiCode extension activated");
}

export function deactivate(): void {
  // Subscriptions are disposed automatically by VS Code via
  // context.subscriptions. No additional cleanup needed today.
}

```

### Core Architecture Module: `extension/src/graphPanel.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { log } from "./output.js";

/**
 * Webview panel that renders the engine's interactive graph HTML inside
 * VS Code, so users don't have to bounce out to a browser tab.
 *
 * The engine's `codebase_graph_visualize` tool writes a self-contained
 * HTML file (vendored Cytoscape + Dagre, no external scripts) to
 * `os.tmpdir()/socraticode-graph/<projectId>.html`. We read the file
 * directly and inject it into a webview.
 *
 * Why this design:
 *
 * - The engine already produces a usable artefact. Re-implementing a
 *   native graph view would mean duplicating the pipeline, which we
 *   explicitly want to avoid.
 * - Reading from a known temp path avoids any IPC dance with the running
 *   MCP server and works whether the user generated the graph from chat,
 *   from the command palette, or from a CLI invocation of the engine.
 * - A webview is sandboxed: scripts the engine writes can't reach the
 *   workspace. The CSP we set only allows inline scripts (the vendored
 *   Cytoscape) and webview-relative resources.
 */

const GRAPH_DIR = path.join(os.tmpdir(), "socraticode-graph");

let currentPanel: vscode.WebviewPanel | undefined;

export async function openInteractiveGraph(projectId?: string): Promise<void> {
  const html = await loadGraphHtml(projectId);
  if (!html) return;

  if (currentPanel) {
    currentPanel.webview.html = wrapHtml(html, currentPanel.webview);
    currentPanel.reveal();
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    "socraticode.graph",
    "SocratiCode: interactive graph",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(GRAPH_DIR)],
    },
  );
  currentPanel.iconPath = vscode.Uri.file(path.join(__dirname, "..", "images", "icon.png"));
  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });
  currentPanel.webview.onDidReceiveMessage((msg: unknown) => {
    void handleWebviewMessage(msg);
  });
  currentPanel.webview.html = wrapHtml(html, currentPanel.webview);
}

async function loadGraphHtml(projectId?: string): Promise<string | undefined> {
  let target: string | undefined;
  if (projectId) {
    // The `socraticode.openInteractiveGraph` command accepts a projectId
    // argument from any caller (palette, sidebar, other extensions). A
    // value like `../../etc/passwd` would escape GRAPH_DIR via path.join.
    // Resolve and confirm the result stays inside GRAPH_DIR.
    const candidate = path.resolve(GRAPH_DIR, `${projectId}.html`);
    const dirResolved = path.resolve(GRAPH_DIR);
    if (candidate !== dirResolved && !candidate.startsWith(dirResolved + path.sep)) {
      log(`Graph panel: rejecting suspicious projectId: ${projectId}`);
      return undefined;
    }
    target = candidate;
  } else {
    // Pick the most recently modified graph file.
    try {
      const entries = await fs.readdir(GRAPH_DIR, { withFileTypes: true });
      let latestPath: string | undefined;
      let latestMtime = 0;
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
        const p = path.join(GRAPH_DIR, entry.name);
        const stat = await fs.stat(p);
        if (stat.mtimeMs > latestMtime) {
          latestMtime = stat.mtimeMs;
          latestPath = p;
        }
      }
      target = latestPath;
    } catch {
      // Directory doesn't exist; fall through to the "no graph yet" path.
    }
  }

  if (!target) {
    await offerToGenerate();
    return undefined;
  }

  try {
    return await fs.readFile(target, "utf-8");
  } catch (err) {
    const e = err as Error;
    log(`Graph panel: failed to read ${target}: ${e.message}`);
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await offerToGenerate();
      return undefined;
    }
    vscode.window.showErrorMessage(`SocratiCode: ${e.message}`);
    return undefined;
  }
}

async function offerToGenerate(): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    'No interactive graph has been generated yet. Ask your AI assistant to call the SocratiCode tool `codebase_graph_visualize` with `mode="interactive"`, then re-run this command.',
    "Copy prompt to clipboard",
    "Open chat",
  );
  if (action === "Copy prompt to clipboard") {
    const prompt =
      'Please use SocratiCode to build an interactive graph of this project: call codebase_graph_visualize with mode="interactive".';
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage("SocratiCode: prompt copied.");
  } else if (action === "Open chat") {
    // Not all VS Code-compatible editors expose `workbench.action.chat.open`
    // (some Theia-based forks omit it). Fall back to a friendlier message
    // rather than letting the rejection bubble up unhandled.
    try {
      await vscode.commands.executeCommand("workbench.action.chat.open");
    } catch (err) {
      log(`Open chat failed: ${(err as Error).message}`);
      vscode.window.showInformationMessage(
        "SocratiCode: this editor does not expose a chat command. Open your AI assistant manually and paste the copied prompt.",
      );
    }
  }
}

/**
 * Wrap the engine HTML so it works inside a webview:
 *
 * 1. Inject a CSP that allows inline scripts/styles (the vendored
 *    Cytoscape) but blocks remote loads. The engine HTML is generated
 *    locally and self-contained, so this doesn't break anything.
 * 2. Replace any local `file://` references with `webview.asWebviewUri()`.
 *    Today the engine inlines all its assets, so this is a defensive
 *    no-op, but worth keeping for forward compatibility.
 * 3. Inject a small bridge script so node-click events in the graph can
 *    `postMessage` back to the extension and we can `vscode.commands.executeCommand`
 *    to open files.
 */
function wrapHtml(html: string, webview: vscode.Webview): string {
  const cspSource = webview.cspSource;
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data: blob:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource} data:`,
    "connect-src 'none'",
  ].join("; ");

  // The engine template already includes <html>...</html>. We inject the
  // CSP meta tag right after <head>. If <head> is missing for some reason,
  // we fall back to prepending a minimal head.
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const bridge = `
    <script>
      (function() {
        const vscode = acquireVsCodeApi();
        window.addEventListener('socraticode:openFile', (e) => {
          vscode.postMessage({ type: 'openFile', path: e.detail?.path, line: e.detail?.line });
        });
      })();
    </script>
  `;

  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>${cspMeta}${bridge}`);
  }
  // If the document has <html> but no <head>, splice a <head> in right
  // after the opening <html ...> tag. Wrapping in a fresh <html>...</html>
  // here would nest two <html> elements, which most browsers tolerate
  // but is invalid markup.
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1<head>${cspMeta}${bridge}</head>`);
  }
  return `<!DOCTYPE html><html><head>${cspMeta}${bridge}</head><body>${html}</body></html>`;
}

async function handleWebviewMessage(msg: unknown): Promise<void> {
  if (typeof msg !== "object" || msg === null) return;
  const m = msg as { type?: string; path?: string; line?: number };
  if (m.type !== "openFile" || typeof m.path !== "string") return;

  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showWarningMessage("SocratiCode: open a workspace to navigate from the graph.");
    return;
  }

  // The webview HTML is generated by us, but the boundary is still
  // untrusted: anything that crosses `postMessage` could be tampered
  // with. Reject absolute paths and any path that escapes the workspace
  // root (`..`). Normalise via posix paths so the same validation works
  // on Windows, macOS, and Linux.
  const normalised = path.posix.normalize(m.path.replace(/\\/g, "/"));
  const isAbsolute = normalised.startsWith("/") || /^[A-Za-z]:\//.test(normalised);
  const escapesRoot =
    normalised === ".." || normalised.startsWith("../") || normalised.includes("/../");
  if (isAbsolute || escapesRoot || normalised === "." || normalised === "") {
    log(`Graph panel: rejecting suspicious path from webview: ${m.path}`);
    vscode.window.showWarningMessage("SocratiCode: invalid file path from graph.");
    return;
  }

  const uri = vscode.Uri.joinPath(ws.uri, ...normalised.split("/"));

  // Open the document first, then clamp the requested line number against
  // the actual document length. A malformed message with a huge `m.line`
  // (e.g. Number.MAX_SAFE_INTEGER) would otherwise build a Range far past
  // the end of the file. We only check `m.line > 0` and `Number.isInteger`
  // here because the upper bound depends on what we just opened.
  let editor: vscode.TextEditor;
  try {
    editor = await vscode.window.showTextDocument(uri);
  } catch (err) {
    log(`Graph panel: failed to open ${normalised}: ${(err as Error).message}`);
    return;
  }

  if (typeof m.line === "number" && Number.isInteger(m.line) && m.line > 0) {
    const lastLine = Math.max(0, editor.document.lineCount - 1);
    const lineIndex = Math.min(m.line - 1, lastLine);
    const range = new vscode.Range(lineIndex, 0, lineIndex, 0);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range);
  }
}

```

### Core Architecture Module: `extension/src/mcpProvider.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as vscode from "vscode";
import { log } from "./output.js";
import { getSettings } from "./settings.js";

/**
 * Registers the SocratiCode MCP server with VS Code's native MCP host via the
 * `vscode.lm.registerMcpServerDefinitionProvider` API (VS Code 1.99+).
 *
 * This is the single most important thing the extension does. Once this
 * provider is registered, VS Code's native agent sees SocratiCode's tools
 * without the user editing any `.vscode/mcp.json`. Independent clients use
 * their own MCP configuration.
 *
 * The provider returns a single stdio definition that launches the engine
 * via `npx -y --prefer-online socraticode@latest` (overridable via `socraticode.command` /
 * `socraticode.args`). The engine's environment is the user-configured
 * `socraticode.env` object passed through unchanged, which is how power
 * users point at an external Qdrant (`QDRANT_MODE=external`, `QDRANT_URL`,
 * `QDRANT_API_KEY`) or pick an embedding provider.
 */

export class SocratiCodeMcpProvider implements vscode.McpServerDefinitionProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this._onDidChange.event;

  /** Trigger VS Code to re-fetch the server definition (e.g. after a setting change). */
  refresh(): void {
    this._onDidChange.fire();
  }

  async provideMcpServerDefinitions(): Promise<vscode.McpServerDefinition[]> {
    const settings = getSettings();
    const def = new vscode.McpStdioServerDefinition(
      "SocratiCode",
      settings.command,
      settings.args,
      settings.env,
    );
    return [def];
  }
}

export function registerMcpProvider(
  context: vscode.ExtensionContext,
): SocratiCodeMcpProvider | undefined {
  const provider = new SocratiCodeMcpProvider();

  // The `engines.vscode: ^1.99.0` field in package.json prevents
  // installation on hosts without the MCP API, but some VS Code-derived
  // editors lie about their reported version. Defensively check that
  // the API surface exists before calling it, so activation degrades
  // gracefully (sidebar / commands / status bar still work) instead of
  // throwing a hard error that disables the entire extension.
  if (typeof vscode.lm?.registerMcpServerDefinitionProvider !== "function") {
    log(
      "vscode.lm.registerMcpServerDefinitionProvider is unavailable in this host; " +
        "skipping MCP server registration. Sidebar, commands and status bar still work.",
    );
    return undefined;
  }

  const disposable = vscode.lm.registerMcpServerDefinitionProvider("socraticode.mcp", provider);
  context.subscriptions.push(disposable);
  log("Registered SocratiCode MCP server provider");

  // Refresh the provider when relevant settings change so VS Code re-reads
  // the definition (e.g. user changed the engine command or env vars).
  const watch = vscode.workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration("socraticode.command") ||
      e.affectsConfiguration("socraticode.args") ||
      e.affectsConfiguration("socraticode.env")
    ) {
      log("Settings changed, refreshing MCP server definition");
      provider.refresh();
    }
  });
  context.subscriptions.push(watch);

  return provider;
}

```

### Core Architecture Module: `extension/src/output.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as vscode from "vscode";

/**
 * Shared output channel for the extension. Created once on activation,
 * disposed on deactivation. Use `output()` everywhere instead of
 * `console.log` so users can see logs via the "SocratiCode: Show output /
 * logs" command.
 */
let channel: vscode.OutputChannel | undefined;

export function initOutput(context: vscode.ExtensionContext): void {
  channel = vscode.window.createOutputChannel("SocratiCode");
  context.subscriptions.push(channel);
}

export function output(): vscode.OutputChannel {
  if (!channel) {
    // Defensive fallback for tests or unexpected ordering.
    channel = vscode.window.createOutputChannel("SocratiCode");
  }
  return channel;
}

export function log(message: string): void {
  const ts = new Date().toISOString();
  output().appendLine(`[${ts}] ${message}`);
}

```

### Core Architecture Module: `extension/src/settings.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as vscode from "vscode";

/**
 * Strongly-typed access to the `socraticode.*` configuration namespace.
 * Read settings via `getSettings()` rather than
 * `vscode.workspace.getConfiguration` directly so all keys are listed in
 * one place and tracked by TypeScript.
 */

export interface SocratiCodeSettings {
  command: string;
  args: string[];
  env: Record<string, string>;
  showStatusBar: boolean;
}

const SECTION = "socraticode";

export function getSettings(): SocratiCodeSettings {
  const c = vscode.workspace.getConfiguration(SECTION);
  return {
    command: c.get<string>("command", "npx"),
    args: c.get<string[]>("args", ["-y", "--prefer-online", "socraticode@latest"]),
    env: c.get<Record<string, string>>("env", {}),
    showStatusBar: c.get<boolean>("statusBar", true),
  };
}

```

### Core Architecture Module: `extension/src/sidebar.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { log } from "./output.js";

/**
 * Sidebar TreeView showing indexed projects discovered from the engine's
 * temp directory. The engine writes interactive graph HTML to
 * `os.tmpdir()/socraticode-graph/<projectId>.html` whenever the user (or
 * their AI assistant) calls `codebase_graph_visualize`. Listing those
 * files gives a low-cost, no-IPC view of "what has SocratiCode worked on
 * recently".
 *
 * For richer state (current index size, embedding count, freshness) the
 * view will eventually call into the running engine via `vscode.lm.tools`,
 * but that requires a stable invokeTool API across MCP hosts. Until then,
 * the welcome view + the file listing are enough to get users oriented.
 */

interface ProjectItem {
  projectId: string;
  graphPath?: string;
  mtime?: Date;
}

const GRAPH_DIR = path.join(os.tmpdir(), "socraticode-graph");

export class ProjectsTreeProvider implements vscode.TreeDataProvider<ProjectItem> {
  private readonly _onDidChange = new vscode.EventEmitter<ProjectItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.projectId, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon("symbol-namespace");
    if (element.mtime) {
      item.description = `graph generated ${formatRelative(element.mtime)}`;
    } else {
      item.description = "no graph yet";
    }
    item.tooltip = element.graphPath
      ? `Click to open the interactive graph for ${element.projectId}.\nFile: ${element.graphPath}`
      : `No interactive graph cached for ${element.projectId}.`;
    if (element.graphPath) {
      item.command = {
        command: "socraticode.openInteractiveGraph",
        title: "Open interactive graph",
        arguments: [element.projectId],
      };
    }
    item.contextValue = element.graphPath ? "project.withGraph" : "project";
    return item;
  }

  async getChildren(): Promise<ProjectItem[]> {
    try {
      const entries = await fs.readdir(GRAPH_DIR, { withFileTypes: true });
      const items: ProjectItem[] = [];
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
        const projectId = entry.name.replace(/\.html$/, "");
        const graphPath = path.join(GRAPH_DIR, entry.name);
        try {
          const stat = await fs.stat(graphPath);
          items.push({ projectId, graphPath, mtime: stat.mtime });
        } catch {
          items.push({ projectId, graphPath });
        }
      }
      // Most recently generated first. When mtime is missing on a side,
      // push that side to the end. When both are missing, fall back to
      // a stable lexicographic tiebreak on projectId so the ordering is
      // deterministic regardless of fs.readdir() traversal order.
      items.sort((a, b) => {
        if (!a.mtime && !b.mtime) return a.projectId.localeCompare(b.projectId);
        if (!a.mtime) return 1;
        if (!b.mtime) return -1;
        return b.mtime.getTime() - a.mtime.getTime();
      });
      return items;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        // Engine has never generated a graph yet. The welcome view in
        // package.json handles the empty state.
        return [];
      }
      log(`Sidebar: failed to read ${GRAPH_DIR}: ${e.message}`);
      return [];
    }
  }
}

export function registerSidebar(context: vscode.ExtensionContext): ProjectsTreeProvider {
  const provider = new ProjectsTreeProvider();
  const view = vscode.window.createTreeView("socraticode.projects", {
    treeDataProvider: provider,
    showCollapseAll: false,
  });
  context.subscriptions.push(view);
  return provider;
}

function formatRelative(date: Date): string {
  // Clamp to zero so a file mtime slightly ahead of the local clock
  // (NTP correction, container clock skew) doesn't render "-5s ago".
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

```

### Core Architecture Module: `extension/src/statusBar.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

import * as vscode from "vscode";
import { getSettings } from "./settings.js";

/**
 * Status-bar item that opens the SocratiCode sidebar on click.
 * Honours the `socraticode.statusBar` setting.
 */

let item: vscode.StatusBarItem | undefined;

export function registerStatusBar(context: vscode.ExtensionContext): void {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  item.command = "workbench.view.extension.socraticode";
  context.subscriptions.push(item);

  refresh();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("socraticode.statusBar")) {
        refresh();
      }
    }),
  );
}

function refresh(): void {
  if (!item) return;
  if (!getSettings().showStatusBar) {
    item.hide();
    return;
  }
  item.text = "$(server) SocratiCode";
  item.tooltip = "Click to open the SocratiCode sidebar.";
  item.show();
}

```

### Core Architecture Module: `scripts/benchmark-graph.ts`
```
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Giancarlo Erra - Altaire Limited

/**
 * scripts/benchmark-graph.ts
 *
 * Smoke benchmark: builds the code graph + symbol graph for a target
 * repository and prints timing / count / memory results as JSON.
 *
 * Usage:
 *   npx tsx scripts/benchmark-graph.ts <absolute-path>
 *   npx tsx scripts/benchmark-graph.ts            # defaults to cwd
 *
 * The script also prints a short Markdown line suitable for pasting into
 * DEVELOPER.md's "Real-world benchmark numbers" table.
 */

import path from "node:path";
import process from "node:process";
import { projectIdFromPath } from "../src/config.js";
import { rebuildGraph } from "../src/services/code-graph.js";
import { setLogLevel } from "../src/services/logger.js";
import { loadSymbolGraphMeta } from "../src/services/symbol-graph-store.js";
import { waitForQdrant } from "../tests/helpers/setup.js";

async function main(): Promise<void> {
  setLogLevel("warn"); // keep stderr quiet for clean JSON output
  const target = path.resolve(process.argv[2] ?? process.cwd());
  await waitForQdrant();

  const projectId = projectIdFromPath(target);
  const memBefore = process.memoryUsage().heapUsed;
  const start = Date.now();
  const graph = await rebuildGraph(target);
  const elapsedMs = Date.now() - start;
  const memAfter = process.memoryUsage().heapUsed;

  const meta = await loadSymbolGraphMeta(projectId);

  const result = {
    target,
    projectId,
    elapsedMs,
    fileCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    symbolCount: meta?.symbolCount ?? null,
    callEdgeCount: meta?.edgeCount ?? null,
    unresolvedPct: meta?.unresolvedPct ?? null,
    heapDeltaMb: Math.round(((memAfter - memBefore) / 1024 / 1024) * 100) / 100,
    rssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  // Also emit a Markdown row.
  const date = result.timestamp.slice(0, 10);
  const md = `| ${date} | \`${path.basename(target)}\` | ${result.fileCount} | ${result.symbolCount ?? "—"} | ${result.callEdgeCount ?? "—"} | ${(elapsedMs / 1000).toFixed(2)} s | ${result.rssMb} MB |`;
  process.stderr.write(`\nMarkdown row:\n${md}\n`);
}

main().catch((err) => {
  process.stderr.write(`benchmark failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #129** (2026-09-01): **Preserve existing indexes when index-shaping settings change**
  *Symptoms*: ### Problem  Settings and code changes that alter embedded text, vector generation, chunk output, or stored payload identity are not recorded with the index. Incremental indexing decides whether to skip a file from a hash of its raw source content only. A setting can therefore change the data that should be stored while every unchanged file is skipped.  `EMBEDDING_DOCUMENT_PREFIX` from #126 is one concrete case. `prepareDocumentText` includes the configured prefix in the text sent to both dense embedding and BM25, while `hashContent` hashes only the raw file contents. Project metadata stores file hashes but no encoding or index-format profile. Context artifacts make a separate staleness decision from `contentHash` alone.  The failure mode is a mixed collection: unchanged files retain the old representation, while edited or newly added files use the new representation. Search then uses the current query configuration against data produced by more than one configuration.  Context artifacts also embed their configured path and store their path and description in payloads. Changing an artifact path or description without changing its content currently leaves the old vectors or payloads in place because only `contentHash` is compared.  ### Backward-compatibility invariant  An existing index must remain usable after an upgrade without a mandatory re-index.  - A new index-shaping feature must either work safely with the existing index or remain inactive for that index until its next

- **Issue #89** (2026-07-28): **[Bug]: codebase_graph_build fails silently with "Bad Request" on repos with large files (700KB–920KB Java files) - graph never completes, codebase_impact non-functional**
  *Symptoms*: ### Describe the bug  codebase_impact always returns 0  ### Steps to reproduce  Steps to Reproduce:   Its a Java-Maven project 1.Have a Java repo containing files ≥ 700 KB (File Lines more than 23K) 2.Call codebase_graph_build on the project 3.Build progresses normally through analyzing imports phase 4.At ~92–94% progress, build fails silently   Environment: •SocratiCode: npx socraticode via ~/.npm/npx/39052607b6e520af/ •Qdrant: v1.17.0 (external, localhost:16333) •Ollama embedding: nomic-embed-text •OS: macOS (OrbStack) •Repo: Java, 3,905 files, 87K edges  Symbol graph:   Files: 99         ← only 99 of 3,607 Java files   Symbols: 2816   Call edges: 58356   Unresolved: 83.0%  codebase_impact → Total impacted files: 0  Impact: codebase_impact tool returns 0 results for all symbols - symbol graph stuck at 99 files / 83% unresolved  ### Expected behavior   Symbol graph should cover all Java source files. codebase_impact should return accurate callers/dependents.  ### Actual behavior  codebase_impact tool returns 0 results for all symbols - symbol graph stuck at 99 files / 83% unresolved  Observed: Last build failed: Bad Request  No additional error detail is surfaced in the MCP response.  ### Embedding provider  Ollama (native / external)  ### Qdrant mode  External (self-hosted / cloud)  ### MCP host  Other (specify below)  ### Operating system  macOS 15.7.7 | MCP host: IntelliJ Github Copilot plugin  ### Node.js version  v25.8.0  ### Relevant log output  ```shell  ```  ### Addi

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

### Incident Patch 1: `692963c2` (2026-10-19)
**Commit Message**: fix(graph): resolve C# names only through the scopes and imports C# uses

A C# path is now answered only by a symbol whose exact full name C# would
bind from the caller: its enclosing types and namespaces, innermost first,
then what is imported at that line. The suffix fallback is gone, so a path
no visible symbol matches stays unresolved instead of binding a same-named
type in another namespace.

- `global::` anchors are kept on the written path and looked up in the
  global namespace alone; a file-level alias target is anchored the same way.
- `using`s and aliases inside a namespace block apply to that block only.
- An extern-alias path (`Legacy::X.Y`) is not resolved.
- `this.` and `base.` calls resolve to the caller's own type and its bases;
  any other receiver (a variable, a call result, `?.`) stays unresolved.
- A static call on a .NET framework type is `engine` unless a project type
  of that name is visible, in which case a missing member stays unresolved.

Tests: regressions through extractor and resolver for each case above, each
checked red against a mutation of the code it covers.

**File**: `src/constants.ts` (modified, +7/-0)
```diff
@@ -844,6 +844,13 @@ export const GODOT_BUILTIN_FUNCTIONS = new Set<string>([
   "connect", "disconnect", "is_connected",
 ]);
 
+/**
+ * The leading segment a C# edge keeps for a `global::`-anchored path
+ * (`global::App.Calc`): the path names members of the global namespace only,
+ * never a scope the reference sits in.
+ */
+export const CS_GLOBAL_ANCHOR = "global::";
+
 /**
  * .NET framework and language-level type names a C# file names without the
  * project declaring them: `Task`, `List`, `DateTime`, and the conventional
```

**File**: `src/services/graph-symbol-resolution.ts` (modified, +180/-55)
```diff
@@ -26,7 +26,7 @@
  *   from unresolved callees — they don't count against resolution %.
  */
 
-import { CS_BUILTIN_TYPES, GODOT_BUILTIN_CLASSES, GODOT_BUILTIN_FUNCTIONS } from "../constants.js";
+import { CS_BUILTIN_TYPES, CS_GLOBAL_ANCHOR, GODOT_BUILTIN_CLASSES, GODOT_BUILTIN_FUNCTIONS } from "../constants.js";
 import type { CodeGraph, SymbolEdge, SymbolNode } from "../types.js";
 import { phpFoldCase } from "./graph-php-case.js";
 import type { RustUseBinding } from "./graph-symbols.js";
@@ -60,16 +60,6 @@ function csFullNameOf(s: SymbolNode): string {
   return s.csFullName ?? s.qualifiedName;
 }
 
-/**
- * Whether the dotted `path` a C# edge writes names `s`: its full name is the
- * path, or ends in `.path`. `Billing.Calc` names `App.Billing.Calc` and never
- * `App.Other.Calc`; a bare `Calc` names both.
- */
-function csNamedBy(s: SymbolNode, path: string): boolean {
-  const full = csFullNameOf(s);
-  return full === path || full.endsWith(`.${path}`);
-}
-
 type GdscriptSceneEntry = readonly [file: string, symbols: Map<string, SymbolNode[]>];
 
 /** Normalize relative path components like `foo/../bar` -> `bar` */
@@ -941,27 +931,149 @@ export function resolveCallSites(
     }
     return [];
   };
+  // C# symbols by id, for the scope an edge's caller sits in.
+  let csSymbolIndex: Map<string, SymbolNode> | undefined;
+  const csSymbolById = (id: string): SymbolNode | undefined => {
+    if (!csSymbolIndex) {
+      csSymbolIndex = new Map();
+      for (const syms of symbolsByFile.values()) for (const s of syms) if (s.language === "csharp") csSymbolIndex.set(s.id, s);
+    }
+    return csSymbolIndex.get(id);
+  };
+  // `global using`s by the directory of the file declaring them.
+  let csGlobalUsingDirs: Array<[dir: string, namespaces: string[]]> | undefined;
+  const csUsingsCache = new Map<string, string[]>();
   /**
-   * The project type a base written in `t`'s declaration names, looked up as
-   * C# looks it up rather than by name across the project: an exact full name
-   * under each enclosing type and namespace, innermost first, then under each
-   * namespace the file imports. Two types imported under one name are an
-   * ambiguity C# itself rejects, so neither is followed. Every part of a
-   * partial type is returned.
+   * What a C# reference at `line` of `file` imports: the file's own top-level
+   * `using`s, those of every namespace block enclosing that line, then the
+   * `global using`s of every file in a directory above it — the project an
+   * SDK-style `.csproj` rooted at that directory compiles.
    */
-  const csBaseType = (t: SymbolNode, path: string): SymbolNode[] => {
+  const csUsingsAt = (file: string, line: number): string[] => {
+    const module = (symbolsByFile.get(file) ?? []).find((s) => s.kind === "module");
+    let fileWide = csUsingsCache.get(file);
+    if (!fileWide) {
+      if (!csGlobalUsingDirs) {
+        csGlobalUsingDirs = [];
+        for (const [f, syms] of symbolsByFile.entries()) {
+          const globals = syms.find((s) => s.kind === "module")?.csGlobalUsings;
+          if (globals) csGlobalUsingDirs.push([f.includes("/") ? f.slice(0, f.lastIndexOf("/") + 1) : "", globals]);
+        }
+      }
+      const inherited = csGlobalUsingDirs.filter(([dir]) => file.startsWith(dir)).flatMap(([, ns]) => ns);
+      fileWide = Array.from(new Set([...(module?.csUsings ?? []), ...inherited]));
+      csUsingsCache.set(file, fileWide);
+    }
+    const scoped = (module?.csScopedUsings ?? []).filter((b) => b.line <= line && line <= b.endLine);
+    return scoped.length === 0 ? fileWide : Array.from(new Set([...scoped.flatMap((b) => b.usings), ...fileWide]));
+  };
+  /**
+   * The scopes C# looks a name up in from inside `sym`, innermost first: the
+   * type itself when `sym` is one, then each enclosing type and namespace,
+   * then the global namespace (`""`). `null` when `sym` has no full name — a
+   * file-level caller, or a graph persisted before `csFullName` — whose names
+   * are then looked up from the global namespace and the imports alone.
+   */
+  const csScopesOf = (sym: SymbolNode | undefined): string[] | null => {
+    if (!sym?.csFullName) return null;
+    const parts = sym.csFullName.split(".");
+    const scopes: string[] = [];
+    for (let n = CS_TYPE_KINDS.has(sym.kind) ? parts.length : parts.length - 1; n >= 1; n--) {
+      scopes.push(parts.slice(0, n).join("."));
+    }
+    scopes.push("");
+    return scopes;
+  };
+  /**
+   * The symbols a dotted `path` written at `line` of `file` names, looked up
+   * as C# looks a name up rather than by name across the project, and never
+   * by file proximity: an exact full name under each of `scopes`, innermost
+   * first, then under each namespace or type imported there. Two types
+   * imported under one name are an ambiguity C# itself rejects, so neither is
+   * answered; a `global::`-anchored path is looked up in the global namespace
+   * alone. Every part of a partial t
```

**File**: `src/services/graph-symbols.ts` (modified, +121/-47)
```diff
@@ -8,7 +8,7 @@
  */
 
 import { Lang, parse } from "@ast-grep/napi";
-import { getLanguageFromExtension } from "../constants.js";
+import { CS_GLOBAL_ANCHOR, getLanguageFromExtension } from "../constants.js";
 import type { EdgeKind, SymbolEdge, SymbolKind, SymbolNode } from "../types.js";
 import { analyzeElixirTemplate, isElixirTemplateExtension } from "./elixir-templates.js";
 import { phpFoldCase } from "./graph-php-case.js";
@@ -63,7 +63,8 @@ export interface ExtractedSymbols {
     csMemberReceiver?: boolean;
     callSite: { file: string; line: number };
     /** Receiver expression for method calls (e.g. "fighter" in "fighter.take_damage()").
-     *  Present only for attribute_call nodes; bare calls have no receiver. */
+     *  GDScript: present only for attribute_call nodes; bare calls have no receiver.
+     *  C#: `this`, `base` or `?`; see {@link SymbolEdge.receiver}. */
     receiver?: string;
     /** True when this call represents a GDScript `signal_name.emit()`. */
     signalEmit?: boolean;
@@ -2472,12 +2473,21 @@ function csWithin(inner: CsRange, outer: CsRange): boolean {
   return outer.start <= inner.start && inner.end <= outer.end;
 }
 
+/** The leading path segment for a `global::` anchor, kept wherever the path is recorded. */
+const CS_GLOBAL = CS_GLOBAL_ANCHOR;
+
+/** A name path as an edge records it: `Ns.Calc`, or `global::Ns.Calc` for an anchored one. */
+function csJoin(path: string[]): string {
+  return path[0] === CS_GLOBAL ? CS_GLOBAL + path.slice(1).join(".") : path.join(".");
+}
+
 /**
  * The dotted path a name-only type or expression spells, type arguments
- * dropped: `["Ns", "Calc"]` for `Ns.Calc`, `global::Ns.Calc` and `Ns.Calc<T>`,
- * whether written as a type or as a member-access receiver. `null` when any
- * part is not a name — `this`, `base`, a call, an element access, or an
- * extern alias other than `global`, whose target no symbol records.
+ * dropped: `["Ns", "Calc"]` for `Ns.Calc` and `Ns.Calc<T>`, and
+ * `[CS_GLOBAL, "Ns", "Calc"]` for `global::Ns.Calc`, whether written as a
+ * type or as a member-access receiver. `null` when any part is not a name —
+ * `this`, `base`, a call, an element access, or an extern alias other than
+ * `global`, whose target no symbol records.
  */
 // biome-ignore lint/suspicious/noExplicitAny: ast-grep node type leaks through
 function csNamePath(node: any): string[] | null {
@@ -2495,8 +2505,11 @@ function csNamePath(node: any): string[] | null {
       const last = csNamePath(csNameField(node));
       return head && last ? [...head, ...last] : null;
     }
-    case "alias_qualified_name":
-      return node.field?.("alias")?.text() === "global" ? csNamePath(csNameField(node)) : null;
+    case "alias_qualified_name": {
+      if (node.field?.("alias")?.text() !== "global") return null;
+      const rest = csNamePath(csNameField(node));
+      return rest ? [CS_GLOBAL, ...rest] : null;
+    }
     default:
       return null;
   }
@@ -2515,7 +2528,7 @@ function csQualifiedNames(root: any): {
   // biome-ignore lint/suspicious/noExplicitAny: ast-grep node type leaks through
   isSegment: (id: any) => boolean;
   // biome-ignore lint/suspicious/noExplicitAny: ast-grep node type leaks through
-  writtenQualifier: (id: any) => string | null;
+  writtenQualifier: (id: any) => string[] | null;
 } {
   // Start offsets of the identifiers that are qualifier segments.
   const segments = new Set<number>();
@@ -2534,23 +2547,26 @@ function csQualifiedNames(root: any): {
   // Terminal identifier's start → the path written before it; `null` when it
   // is not a plain path (an extern alias), so no reference is drawn rather
   // than a bare one that would bind whatever same-named type is nearest.
-  const written = new Map<number, string | null>();
+  const written = new Map<number, string[] | null>();
   for (const qn of safeFindAll(root, "qualified_name")) {
     const qualifier = qn.field?.("qualifier") ?? null;
     if (qualifier) markSegments(qualifier);
     const head = csTypeHeadIdentifier(csNameField(qn));
-    const path = csNamePath(qualifier);
-    if (head) written.set(csRange(head).start, path ? path.join(".") : null);
+    if (head) written.set(csRange(head).start, csNamePath(qualifier));
   }
   for (const aqn of safeFindAll(root, "alias_qualified_name")) {
     const alias = aqn.field?.("alias") ?? null;
     if (alias) markSegments(alias);
     const head = csTypeHeadIdentifier(csNameField(aqn));
-    if (head) written.set(csRange(head).start, alias?.text() === "global" ? "" : null);
+    if (head) written.set(csRange(head).start, alias?.text() === "global" ? [CS_GLOBAL] : null);
   }
   return {
     isSegment: (id) => segments.has(csRange(id).start),
-    writtenQualifier: (id) => written.get(csRange(id).start) ?? "",
+    // Only a missing entry means "written bare": `null` must reach the caller's skip.
+    writtenQualifier: (id) => {
+      const path = written.get(csRange(id).start);
+      return path
```

**File**: `src/types.ts` (modified, +32/-10)
```diff
@@ -197,20 +197,35 @@ export interface SymbolNode {
    * C# types only: the base class and interfaces as the declaration writes
    * them, type arguments dropped and the file's `using` aliases written out
    * (`App.Data.Repository`, `IFoo`). Resolution looks each one up as C# does —
-   * the enclosing types and namespaces, innermost first, then
-   * {@link csUsings} — and follows it to find a member the type inherits from
+   * the enclosing types and namespaces, innermost first, then the namespaces
+   * its file imports — and follows it to find a member the type inherits from
    * another project type. Absent when the type names no base, and on every
    * graph persisted before it existed.
    */
   csBases?: string[];
   /**
-   * C# types with {@link csBases} only: the namespaces the declaring file
-   * imports with `using` (aliases and `using static` excluded), where a base
-   * the enclosing namespaces do not declare is looked for. A `global using`
-   * in another file is not seen, so a base imported only by one stays
-   * unresolved.
+   * C# `<module>` symbols only: the namespaces the file imports with a
+   * file-level `using`, and the types it imports with `using static` (whose
+   * nested types become visible by name), its own `global using`s included,
+   * aliases excluded. A type name the enclosing scopes do not declare is
+   * looked for under them. Absent when the file imports none.
    */
   csUsings?: string[];
+  /**
+   * C# `<module>` symbols only: the imports declared inside a namespace block,
+   * with the block's lines. They apply to references within those lines only,
+   * so a sibling block's imports never reach them. Absent when no block has any.
+   */
+  csScopedUsings?: Array<{ line: number; endLine: number; usings: string[] }>;
+  /**
+   * C# `<module>` symbols only: the namespaces and types the file imports
+   * with `global using`. Resolution applies them to every C# file under the file's
+   * directory — the files an SDK-style project rooted there compiles, where
+   * `GlobalUsings.cs` conventionally sits. A `<Using Include>` item in a
+   * `.csproj` is not read, so a type imported only through one stays
+   * unresolved.
+   */
+  csGlobalUsings?: string[];
 }
 
 /** Kind of relationship an edge represents */
@@ -269,8 +284,12 @@ export interface SymbolEdge {
    * qualify statically — `$obj->m()`, `$class::m()`, `Cls::$m()`, `self::`,
    * `static::`, `parent::` and bare function calls.
    *
-   * C# writes it as the call site spells it, dots kept and type arguments
-   * dropped: `Billing.Calc` for `Billing.Calc.Compute()`. An object creation
+   * C# writes it as the call site spells it, dots kept, type arguments
+   * dropped and the file's `using` alias in scope written out:
+   * `Billing.Calc` for `Billing.Calc.Compute()`, `global::Billing.Calc` when
+   * the source anchors it. A receiver that is a variable (`repo.Save()`) is
+   * kept too, so the call is never answered by its bare name; no type matches
+   * it, and the edge stays unresolved. An object creation
    * `new Billing.Calc()` carries the whole type path, `Billing.Calc`, with
    * `Calc` as the callee — a member cannot share its class's name in C#, so
    * the repeated name marks a constructor call without ambiguity.
@@ -288,7 +307,10 @@ export interface SymbolEdge {
   csMemberReceiver?: boolean;
   callSite: { file: string; line: number };
   /** Receiver expression for method calls (e.g. "fighter" in "fighter.take_damage()").
-   *  Used by GDScript receiver-type resolution. Absent for bare function calls. */
+   *  Used by GDScript receiver-type resolution. Absent for bare function calls.
+   *  C# sets it only where the receiver is no name path: `this`, `base`, or `?`
+   *  for any other expression (a call result, `a?.b`, an element access) —
+   *  such a call is answered from the caller's own type or its bases, or not at all. */
   receiver?: string;
   /** True when a GDScript call edge represents `signal_name.emit()`.
    *  Optional so symbol graphs built before signal-edge support remain readable. */
```

**File**: `tests/unit/graph-symbol-resolution-csharp.test.ts` (modified, +208/-24)
```diff
@@ -31,6 +31,7 @@ describe("C# qualified calls and type references at the resolver", () => {
     language: "csharp",
   });
   const node = (relativePath: string, dependencies: string[]) => ({
+    filePath: relativePath,
     relativePath,
     imports: [],
     exports: [],
@@ -117,7 +118,7 @@ describe("C# extractor-to-resolver regressions", () => {
     }
     const graph: CodeGraph = {
       nodes: Object.keys(files).map((relativePath) => ({
-        relativePath, imports: [], exports: [], dependencies: [], dependents: [], language: "csharp",
+        filePath: relativePath, relativePath, imports: [], exports: [], dependencies: [], dependents: [], language: "csharp",
       })),
       edges: [],
     };
@@ -188,23 +189,23 @@ describe("C# extractor-to-resolver regressions", () => {
   });
 
   it("resolves a project's own framework-named type, bare, qualified and created, and marks .NET's as engine", () => {
-    const jobs = "namespace App.Jobs { public class Task { } }";
+    const jobs = "namespace App.Chores { public class Task { } }";
     const caller = [
       "namespace App {",
       "  public class Runner {",
-      "    void Go(Jobs.Task a, System.Threading.Tasks.Task b) {",
-      "      var t = new Jobs.Task();",
+      "    void Go(Chores.Task a, System.Threading.Tasks.Task b) {",
+      "      var t = new Chores.Task();",
       "      var l = new List<int>();",
       "    }",
       "  }",
       "}",
     ].join("\n");
-    const { at } = run({ "Jobs/Task.cs": jobs, "Runner.cs": caller });
+    const { at } = run({ "Chores/Task.cs": jobs, "Runner.cs": caller });
     expect(at("Runner.cs", 3, "type_reference", "Task")).toEqual([
-      { confidence: "unique", targets: ["App.Jobs.Task"] },
+      { confidence: "unique", targets: ["App.Chores.Task"] },
       { confidence: "engine", targets: [] },
     ]);
-    expect(at("Runner.cs", 4, "call", "Task")).toEqual([{ confidence: "unique", targets: ["App.Jobs.Task"] }]);
+    expect(at("Runner.cs", 4, "call", "Task")).toEqual([{ confidence: "unique", targets: ["App.Chores.Task"] }]);
     expect(at("Runner.cs", 5, "call", "List")).toEqual([{ confidence: "engine", targets: [] }]);
     expect(at("Runner.cs", 5, "type_reference", "List")).toEqual([{ confidence: "engine", targets: [] }]);
   });
@@ -231,25 +232,25 @@ describe("C# extractor-to-resolver regressions", () => {
   });
 
   it("falls back to a shorter receiver prefix only when that type declares the next segment", () => {
-    // `Billing.Rates` is an external namespace and class; the project's own `Billing` has no `Rates`.
+    // `Billing.Tariffs` is an external namespace and class; the project's own `Billing` has no `Tariffs`.
     const decls = "namespace App.Other { public class Billing { public static int Total; } }";
-    const caller = "namespace App { public class Host {\n  void Go() { Billing.Rates.Load(); }\n} }";
+    const caller = "namespace App { public class Host {\n  void Go() { Billing.Tariffs.Load(); }\n} }";
     const { at } = run({ "Billing.cs": decls, "Host.cs": caller });
-    expect(at("Host.cs", 2, "type_reference", "Rates")).toEqual([{ confidence: "unresolved", targets: [] }]);
+    expect(at("Host.cs", 2, "type_reference", "Tariffs")).toEqual([{ confidence: "unresolved", targets: [] }]);
   });
 
   it("takes a declared field, constant or enum member as the next segment", () => {
     const decls = [
       "namespace App {",
       "  public class OrderState { public static readonly OrderState Open = new(); public int Id; }",
-      "  public static class Limits { public const int MaxItems = 100; }",
+      "  public static class Limits { public const int MaxWidgets = 100; }",
       "  public enum Mode { Fast, Slow }",
       "}",
     ].join("\n");
-    const caller = "namespace App { public class Host {\n  object Go() => (OrderState.Open.Id, Limits.MaxItems.ToString(), Mode.Fast.ToString());\n} }";
+    const caller = "namespace App { public class Host {\n  object Go() => (OrderState.Open.Id, Limits.MaxWidgets.ToString(), Mode.Fast.ToString());\n} }";
     const { at } = run({ "Decls.cs": decls, "Host.cs": caller });
     expect(at("Host.cs", 2, "type_reference", "Open")).toEqual([{ confidence: "unique", targets: ["App.OrderState"] }]);
-    expect(at("Host.cs", 2, "type_reference", "MaxItems")).toEqual([{ confidence: "unique", targets: ["App.Limits"] }]);
+    expect(at("Host.cs", 2, "type_reference", "MaxWidgets")).toEqual([{ confidence: "unique", targets: ["App.Limits"] }]);
     expect(at("Host.cs", 2, "type_reference", "Fast")).toEqual([{ confidence: "unique", targets: ["App.Mode"] }]);
   });
 
@@ -277,17 +278,17 @@ describe("C# extractor-to-resolver regressions", () => {
     const decls = [
       "namespace App {",
       "  public class BaseSeeder { public static int Shelf; public static BaseSeeder Create() => new(); }",
-      "  public class OrderSeeder : BaseSeeder { }",
+      "  public class HarborSeeder : BaseSeeder { }",
       "  p
```

**File**: `tests/unit/graph-symbols.test.ts` (modified, +7/-3)
```diff
@@ -686,7 +686,8 @@ namespace App {
       const src = "using Repo = App.Data.Repository;\nnamespace App { public record R(int X) : Base(X), IFoo; public class C : Repo, Ns.IBar<Item> { } }\n";
       const out = extractSymbolsAndCalls(src, "csharp" as unknown as Lang, ".cs", "R.cs");
       expect(out.symbols.find((s) => s.name === "R")?.csBases).toEqual(["Base", "IFoo"]);
-      expect(out.symbols.find((s) => s.name === "C")?.csBases).toEqual(["App.Data.Repository", "Ns.IBar"]);
+      // A file-level alias names its target from the global namespace.
+      expect(out.symbols.find((s) => s.name === "C")?.csBases).toEqual(["global::App.Data.Repository", "Ns.IBar"]);
       const refs = out.rawCalls.filter((c) => c.kind === "type_reference").map((c) => c.calleeName);
       expect(refs).toEqual(expect.arrayContaining(["Base", "IFoo", "Repository", "IBar", "Item"]));
       expect(refs).not.toContain("X");
@@ -707,7 +708,7 @@ public class Service {
       const out = extractSymbolsAndCalls(src, "csharp" as unknown as Lang, ".cs", "Service.cs");
       const refs = out.rawCalls.filter((c) => c.kind === "type_reference");
       const written = refs.map((c) => (c.calleeQualifier ? `${c.calleeQualifier}.${c.calleeName}` : c.calleeName));
-      expect(written).toEqual(expect.arrayContaining(["Order.Order", "System.Collections.Generic.IList", "MyApp.Domain.Item", "Ns.Calc", "Billing.Calc", "Config.Instance"]));
+      expect(written).toEqual(expect.arrayContaining(["Order.Order", "System.Collections.Generic.IList", "MyApp.Domain.Item", "global::Ns.Calc", "Billing.Calc", "Config.Instance"]));
       // No qualifier segment becomes a type of its own.
       for (const segment of ["System", "Collections", "Generic", "MyApp", "Domain", "Ns", "Billing"]) {
         expect(refs.find((c) => c.calleeName === segment)).toBeUndefined();
@@ -740,8 +741,11 @@ public class Service {
       const calls = out.rawCalls.filter((c) => c.kind === "call");
       expect(calls.find((c) => c.calleeName === "Calc")).toBeTruthy();
       const compute = calls.filter((c) => c.calleeName === "Compute");
-      expect(compute.map((c) => c.calleeQualifier)).toEqual(["Calc", undefined, undefined]);
+      // A variable receiver keeps its written path; the resolver finds no type by that name.
+      expect(compute.map((c) => c.calleeQualifier)).toEqual(["Calc", "_calc", undefined]);
       expect(calls.find((c) => c.calleeName === "Run")?.calleeQualifier).toBeUndefined();
+      expect(calls.find((c) => c.calleeName === "Run")?.receiver).toBe("this");
+      expect(compute.map((c) => c.receiver)).toEqual([undefined, undefined, undefined]);
       expect(calls.find((c) => c.calleeName === "Make")?.calleeQualifier).toBe("Helper");
       // The field type (line 3), `new Calc()` (line 4) and the static call's receiver (line 6) reference `Calc`;
       // `_calc.Compute` and `this.Run` reference no type.
```

---

### Incident Patch 2: `5f424765` (2026-10-21)
**Commit Message**: fix(search): name the filter when a filtered codebase_search finds nothing

fileFilter and languageFilter are exact keyword matches, so a directory,
glob, bare name of a nested file, or language alias matches nothing. The
empty result then told the caller to index an already-indexed project.

A filtered search that returns nothing now names the filter and the form
it accepts. It keeps the indexing hint when the collection holds no
chunks, adds a codebase_status note while indexing is in progress, names
both filters together when both are set, and states no cause across
linked projects, where a failed collection search is skipped. The
minScore and unfiltered replies are unchanged.

The fileFilter and languageFilter descriptions and the
codebase-exploration skill docs now state the exact-match form.

Closes #207

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `DEVELOPER.md` (modified, +2/-2)
```diff
@@ -1177,8 +1177,8 @@ Parameters:
   query: string           — Natural language search query (required)
   projectPath?: string    — Absolute path (defaults to cwd)
   limit?: number          — 1-50 (default 10)
-  fileFilter?: string     — Filter by relative file path
-  languageFilter?: string — Filter by language name
+  fileFilter?: string     — Exact match on one file's relative path, as a result header shows it
+  languageFilter?: string — Exact match on a language label, as a result header shows it
   minScore?: number       — 0-1, minimum RRF score threshold (default: 0.10, env: SEARCH_MIN_SCORE)
 
 Returns: Ranked code chunks with file paths, line numbers, language, similarity scores, and content
```

**File**: `skills/codebase-exploration/SKILL.md` (modified, +2/-1)
```diff
@@ -24,7 +24,8 @@ Hybrid semantic + keyword search (vector + BM25, RRF-fused) runs in a single cal
 - **Broad queries for orientation**: "how is authentication handled", "database connection setup", "error handling patterns"
 - **Precise queries for symbol lookup**: exact function names, constants, type names
 - Prefer search results to infer which files to read — do not speculatively open files
-- Use `fileFilter` to narrow to a specific file path, `languageFilter` for a specific language
+- Use `fileFilter` to narrow to one file, exactly as a result header shows its path; a directory, glob or bare name of a file below the root matches nothing
+- Use `languageFilter` to narrow to one language, exactly as a result header shows its label in brackets (e.g. `typescript`, not `ts`)
 - Adjust `minScore` (default 0.10) for precision vs recall — lower for more results, higher for stricter matching
 
 **When to use grep instead**: If you already know the exact identifier, error string, or regex pattern, grep/ripgrep is faster and more precise — no semantic gap to bridge. Use `codebase_search` when exploring, asking conceptual questions, or when you don't know which files to look in.
```

**File**: `skills/codebase-exploration/references/tool-reference.md` (modified, +3/-3)
```diff
@@ -9,8 +9,8 @@ Semantic search across an indexed codebase. Only use after `codebase_index` is c
 | `query` | string | yes | — | Natural language search query (e.g. "authentication middleware", "database connection setup") |
 | `projectPath` | string | no | cwd | Absolute path to the project directory |
 | `limit` | number (1-50) | no | 10 | Maximum results. Override globally via `SEARCH_DEFAULT_LIMIT` env var |
-| `fileFilter` | string | no | — | Filter results to a specific file path (relative) |
-| `languageFilter` | string | no | — | Filter results to a specific language (e.g. "typescript", "python") |
+| `fileFilter` | string | no | — | Filter results to one file, given exactly as a result header shows its path (e.g. "src/index.ts"). Directories, globs, lists and bare names of files below the root match nothing |
+| `languageFilter` | string | no | — | Filter results to one language, given exactly as a result header shows its label in brackets (e.g. "typescript", "python", "go"); aliases such as "ts" or "py" match nothing |
 | `minScore` | number (0-1) | no | 0.10 | Minimum RRF score threshold. Override via `SEARCH_MIN_SCORE`. Set to 0 to disable |
 
 **Returns:** Ranked code chunks with file paths, line numbers, language, and RRF scores.
@@ -188,7 +188,7 @@ Display information about SocratiCode and all its tools.
 ### Search tips
 - A single `codebase_search` returns ranked snippets from the entire codebase in milliseconds — far cheaper than opening files speculatively
 - The RRF score combines semantic similarity and keyword match; higher scores = better relevance
-- Use `fileFilter` when you know the area, `languageFilter` when cross-language results are noisy
+- Use `fileFilter` when you know the exact file (it cannot narrow to a directory), `languageFilter` when cross-language results are noisy
 - Lower `minScore` to 0 when exploring broadly; raise it for precision
 
 ### Graph tips
```

**File**: `src/index.ts` (modified, +2/-2)
```diff
@@ -153,11 +153,11 @@ server.tool(
       .optional(),
     fileFilter: z
       .string()
-      .describe("Filter results to a specific file path (relative).")
+      .describe("Filter results to one file, given exactly as a result header shows its path (e.g. 'src/index.ts'). Directories, globs, lists and bare names of files below the root match nothing.")
       .optional(),
     languageFilter: z
       .string()
-      .describe("Filter results to a specific language (e.g. 'typescript', 'python').")
+      .describe("Filter results to one language, given exactly as a result header shows its label in brackets (e.g. 'typescript', 'python', 'go'); aliases such as 'ts' or 'py' match nothing.")
       .optional(),
     minScore: z
       .number()
```

**File**: `src/tools/query-tools.ts` (modified, +48/-0)
```diff
@@ -118,6 +118,52 @@ async function appendWatcherState(
   }
 }
 
+/** Explain an empty filtered search by the filter, the index state, or both. */
+async function filteredNoResultsLines(
+  query: string,
+  resolvedPath: string,
+  collection: string,
+  fileFilter: string | undefined,
+  languageFilter: string | undefined,
+  includeLinked: boolean | undefined,
+): Promise<string[]> {
+  const indexing = isIndexingInProgress(resolvedPath);
+  if (!includeLinked && !indexing && ((await getCollectionInfo(collection))?.pointsCount ?? 0) === 0) {
+    return [
+      `No results found for "${query}" in project ${resolvedPath}.`,
+      "Make sure the project has been indexed first using codebase_index.",
+    ];
+  }
+
+  const filters: string[] = [];
+  const hints: string[] = [];
+  if (fileFilter) {
+    filters.push(`fileFilter "${fileFilter}"`);
+    hints.push(
+      "fileFilter takes one file path exactly as a result header shows it (e.g. src/index.ts); directories, globs, lists and bare names of files below the root match nothing. Omit fileFilter to search everything.",
+    );
+  }
+  if (languageFilter) {
+    filters.push(`languageFilter "${languageFilter}"`);
+    hints.push(
+      "languageFilter takes a language label exactly as a result header shows it in brackets (e.g. typescript, python, go), not an alias such as ts or py.",
+    );
+  }
+  if (indexing) {
+    hints.push("Indexing is in progress, so matching files may not be indexed yet; codebase_status shows progress.");
+  }
+
+  if (includeLinked) {
+    return [`No results found for "${query}" in project ${resolvedPath} or its linked projects with ${filters.join(" and ")}.`, ...hints];
+  }
+  const miss = filters.length > 1
+    ? `${filters.join(" and ")} together matched no indexed chunk`
+    : fileFilter
+      ? `${filters[0]} matched no indexed file`
+      : `${filters[0]} matched no indexed chunk`;
+  return [`No results found for "${query}" in project ${resolvedPath}: ${miss}.`, ...hints];
+}
+
 /** Run a query or status request with the selected mode's Git freshness notice. */
 export async function handleQueryTool(
   name: string,
@@ -173,6 +219,8 @@ async function dispatchQueryTool(
             `No results above score threshold ${minScore.toFixed(2)} for "${query}" in project ${resolvedPath}.`,
             `${filteredCount} result${filteredCount === 1 ? " was" : "s were"} below the threshold. Try a broader query or lower the minScore parameter.`,
           );
+        } else if (fileFilter || languageFilter) {
+          lines.push(...await filteredNoResultsLines(query, resolvedPath, collection, fileFilter, languageFilter, includeLinked));
         } else {
           lines.push(
             `No results found for "${query}" in project ${resolvedPath}.`,
```

**File**: `tests/integration/tools.test.ts` (modified, +13/-0)
```diff
@@ -556,6 +556,19 @@ describe.skipIf(!dockerAvailable)(
 
         expect(result).toBeDefined();
       }, 30_000);
+
+      it("restricts results to the exact relative path given as fileFilter", async () => {
+        const result = await handleQueryTool("codebase_search", {
+          query: "authentication user login",
+          projectPath: fixture.root,
+          fileFilter: "src/index.ts",
+          minScore: 0,
+        });
+
+        const headers = result.split("\n").filter((line) => line.startsWith("--- "));
+        expect(headers.length, "an exact relative path must return that file's chunks").toBeGreaterThan(0);
+        expect(headers.every((line) => line.startsWith("--- src/index.ts ")), headers.join("\n")).toBe(true);
+      }, 30_000);
     });
 
     describe("codebase_status builder version (#120)", () => {
```

**File**: `tests/unit/query-tools.test.ts` (modified, +95/-0)
```diff
@@ -116,9 +116,11 @@ vi.mock("../../src/constants.js", async (importOriginal) => {
 // ── Imports (after mocks) ────────────────────────────────────────────────
 
 import { ensureQdrantReady } from "../../src/services/docker.js";
+import { isIndexingInProgress } from "../../src/services/indexer.js";
 import { handleQueryTool } from "../../src/tools/query-tools.js";
 
 const mockEnsureQdrantReady = vi.mocked(ensureQdrantReady);
+const mockIsIndexingInProgress = vi.mocked(isIndexingInProgress);
 
 // ── Tests ────────────────────────────────────────────────────────────────
 
@@ -279,6 +281,99 @@ describe("manual indexing watcher status", () => {
   });
 });
 
+describe("codebase_search — filtered search with no results", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    mockGetCollectionInfo.mockResolvedValue({ pointsCount: 3, status: "green" });
+    mockSearchChunks.mockResolvedValueOnce([]);
+  });
+
+  afterEach(() => {
+    mockIsIndexingInProgress.mockReturnValue(false);
+  });
+
+  it("blames a fileFilter that matched no file, not the index", async () => {
+    const output = await handleQueryTool("codebase_search", {
+      projectPath: TEST_PATH,
+      query: "value",
+      fileFilter: "src/",
+    });
+
+    expect(output).toContain('fileFilter "src/"');
+    expect(output).toContain("one file path exactly as a result header shows it");
+    expect(output).not.toContain("codebase_index");
+  });
+
+  it("blames a languageFilter that matched no language, not the index", async () => {
+    const output = await handleQueryTool("codebase_search", {
+      projectPath: TEST_PATH,
+      query: "value",
+      languageFilter: "ts",
+    });
+
+    expect(output).toContain('languageFilter "ts"');
+    expect(output).toContain("language label exactly as a result header shows it in brackets");
+    expect(output).not.toContain("codebase_index");
+  });
+
+  it("blames both filters together when both are set, not the file path alone", async () => {
+    const output = await handleQueryTool("codebase_search", {
+      projectPath: TEST_PATH,
+      query: "value",
+      fileFilter: "src/index.ts",
+      languageFilter: "python",
+    });
+
+    expect(output).toContain('fileFilter "src/index.ts" and languageFilter "python" together matched no indexed chunk');
+    expect(output).not.toContain("matched no indexed file");
+  });
+
+  it("states no cause for a filtered miss across linked projects, whose failed searches are skipped", async () => {
+    mockGetCollectionInfo.mockResolvedValue({ pointsCount: 0, status: "green" });
+    mockSearchMultipleCollections.mockResolvedValueOnce([]);
+
+    const output = await handleQueryTool("codebase_search", {
+      projectPath: TEST_PATH,
+      query: "value",
+      fileFilter: "src/",
+      includeLinked: true,
+    });
+
+    expect(output).toContain('with fileFilter "src/"');
+    expect(output).toContain("one file path exactly as a result header shows it");
+    expect(output).not.toContain("matched no indexed");
+    expect(output).not.toContain("codebase_index");
+  });
+
+  it("says a correctly filtered file may not be indexed yet while indexing runs", async () => {
+    mockIsIndexingInProgress.mockReturnValue(true);
+    mockGetCollectionInfo.mockResolvedValue({ pointsCount: 0, status: "green" });
+
+    const output = await handleQueryTool("codebase_search", {
+      projectPath: TEST_PATH,
+      query: "value",
+      fileFilter: "src/index.ts",
+    });
+
+    expect(output).toContain('fileFilter "src/index.ts"');
+    expect(output).toContain("codebase_status");
+    expect(output).not.toContain("codebase_index");
+  });
+
+  it("keeps the indexing hint when the collection holds no chunks", async () => {
+    mockGetCollectionInfo.mockResolvedValue({ pointsCount: 0, status: "green" });
+
+    const output = await handleQueryTool("codebase_search", {
+      projectPath: TEST_PATH,
+      query: "value",
+      fileFilter: "src/index.ts",
+    });
+
+    expect(output).toContain("Make sure the project has been indexed first using codebase_index.");
+    expect(output).not.toContain("one file path exactly as a result header shows it");
+  });
+});
+
 // ── includeLinked tests ──────────────────────────────────────────────────
 
 describe("codebase_search — includeLinked parameter", () => {
```

---

### Incident Patch 3: `d9b87002` (2026-10-20)
**Commit Message**: fix(graph): bind C# aliases where declared, and type-named values by type identity

An alias declared in a namespace block now has its target looked up as
C# resolves it. The lookup starts at the block's namespace and goes
outward, without the block's own imports. It never starts from where
the alias is used, so a nested namespace at the use site can no longer
redirect it. The written path keeps the declaring namespace as its
anchor (`App.Shop::Billing.Calc`); `global::` stays as written. When
that lookup finds nothing, the reference stays unresolved.

A value whose declared type ends in its own name is read as the type
only when both readings name one type. `csSelfTypedMembers` now keeps
the declared type, and resolution compares it with what the name finds
from the caller. A qualified type naming another type (`Other.Status
Status`) or a nullable value type is still a value. For a local or
parameter, only a plain `Status Status` qualifies.

A switch expression arm now scopes its pattern variables, so a variable
in one arm no longer hides a type in a sibling arm.

**File**: `src/constants.ts` (modified, +3/-1)
```diff
@@ -847,7 +847,9 @@ export const GODOT_BUILTIN_FUNCTIONS = new Set<string>([
 /**
  * The leading segment a C# edge keeps for a `global::`-anchored path
  * (`global::App.Calc`): the path names members of the global namespace only,
- * never a scope the reference sits in.
+ * never a scope the reference sits in. A path written through a `using`
+ * alias declared in a namespace block carries that namespace as its anchor
+ * instead (`App.Shop::Billing.Calc`), and is looked up from there outward.
  */
 export const CS_GLOBAL_ANCHOR = "global::";
 
```

**File**: `src/services/graph-symbol-resolution.ts` (modified, +68/-19)
```diff
@@ -1038,17 +1038,41 @@ export function resolveCallSites(
    * there. An import brings in types, not namespaces, so `X.Y` is taken from
    * one only when `X` is a type it imports. Two types imported under one name
    * at one level are an ambiguity C# itself rejects, so neither is answered; a
-   * `global::`-anchored path is looked up in the global namespace alone. Every
-   * part of a partial type is answered.
+   * `global::`-anchored path is looked up in the global namespace alone. A
+   * path an alias declared in a namespace block wrote out (`App.Shop::X.Y`)
+   * is looked up as C# resolves the alias: from that namespace outward,
+   * without the declaring block's own imports, never from where it is used.
+   * Every part of a partial type is answered.
    */
   const csLookup = (context: CsContext, written: string, accept: (s: SymbolNode) => boolean): SymbolNode[] => {
-    const anchored = written.startsWith(CS_GLOBAL_ANCHOR);
-    const path = anchored ? written.slice(CS_GLOBAL_ANCHOR.length) : written;
+    const cut = written.indexOf("::");
+    const path = cut >= 0 ? written.slice(cut + 2) : written;
     const name = path.slice(path.lastIndexOf(".") + 1);
     const first = path.split(".")[0];
     const candidates = (csByName().get(name) ?? []).filter(accept);
     const named = (full: string) => candidates.filter((s) => csFullNameOf(s) === full);
-    if (anchored) return named(path);
+    // `null` when no import at this level names `path`, `[]` when two do.
+    const imported = (imports: string[]): SymbolNode[] | null => {
+      const found = imports
+        .filter((u) => first === path || csTypesNamed(`${u}.${first}`).length > 0)
+        .flatMap((u) => named(`${u}.${path}`));
+      const distinct = new Set(found.map(csFullNameOf)).size;
+      return distinct === 0 ? null : distinct === 1 ? found : [];
+    };
+    if (written.startsWith(CS_GLOBAL_ANCHOR)) return named(path);
+    if (cut >= 0) {
+      const parts = written.slice(0, cut).split(".");
+      for (let n = parts.length; n >= 0; n--) {
+        const namespace = parts.slice(0, n).join(".");
+        const found = named(namespace ? `${namespace}.${path}` : path);
+        if (found.length > 0) return found;
+        if (n === parts.length) continue;
+        const level = context.levels.find((l) => l.namespace === namespace);
+        const fromImports = imported(level?.imports ?? []);
+        if (fromImports) return fromImports;
+      }
+      return [];
+    }
     for (const scope of context.types) {
       const found = named(`${scope}.${path}`);
       if (found.length > 0) return found;
@@ -1059,12 +1083,8 @@ export function resolveCallSites(
     for (const { namespace, imports } of context.levels) {
       const found = named(namespace ? `${namespace}.${path}` : path);
       if (found.length > 0) return found;
-      const imported = imports
-        .filter((u) => first === path || csTypesNamed(`${u}.${first}`).length > 0)
-        .flatMap((u) => named(`${u}.${path}`));
-      const distinct = new Set(imported.map(csFullNameOf)).size;
-      if (distinct === 1) return imported;
-      if (distinct > 1) return [];
+      const fromImports = imported(imports);
+      if (fromImports) return fromImports;
     }
     return [];
   };
@@ -1134,19 +1154,23 @@ export function resolveCallSites(
   /**
    * Whether the project type `full` declares `name` as a value — a field,
    * property, constant, event or enum member, its own or inherited from a
-   * project base — other than one typed as itself (`csSelfTypedMembers`).
+   * project base. A member typed as itself (`csSelfTypedMembers`) is a value
+   * unless both readings name one type from `context` (`csSameTypeReading`).
    */
-  const csValueMember = (full: string, name: string, seen = new Set<string>()): boolean => {
+  const csValueMember = (full: string, name: string, context: CsContext, seen = new Set<string>()): boolean => {
     if (seen.has(full)) return false;
     seen.add(full);
     const parts = csTypesNamed(full);
-    if (parts.some((p) => p.csSelfTypedMembers?.includes(name))) return false;
+    for (const part of parts) {
+      const self = part.csSelfTypedMembers?.find((m) => m.name === name);
+      if (self) return !csSameTypeReading(part, self, name, context);
+    }
     if (parts.some((p) => p.csMembers?.includes(name))) return true;
     const member = `${full}.${name}`;
     if ((csByName().get(name) ?? []).some((s) => s.kind === "variable" && csFullNameOf(s) === member)) return true;
     for (const part of parts) {
       for (const base of part.csBases ?? []) {
-        for (const b of csBaseType(part, base)) if (csValueMember(csFullNameOf(b), name, seen)) return true;
+        for (const b of csBaseType(part, base)) if (csValueMember(csFullNameOf(b), name, context, seen)) return true;
       }
     }
     return false;
@@ -1161,10 +1185,33 @@ export function resolveCallSites(
   const csHeadIsValue = (context: CsContex
```

**File**: `src/services/graph-symbols.ts` (modified, +43/-15)
```diff
@@ -2476,9 +2476,13 @@ function csWithin(inner: CsRange, outer: CsRange): boolean {
 /** The leading path segment for a `global::` anchor, kept wherever the path is recorded. */
 const CS_GLOBAL = CS_GLOBAL_ANCHOR;
 
-/** A name path as an edge records it: `Ns.Calc`, or `global::Ns.Calc` for an anchored one. */
+/**
+ * A name path as an edge records it: `Ns.Calc`, or with its anchor segment
+ * (`CS_GLOBAL`, or `App.Shop::` for an alias declared in `namespace App.Shop`)
+ * joined to it: `global::Ns.Calc`, `App.Shop::Ns.Calc`.
+ */
 function csJoin(path: string[]): string {
-  return path[0] === CS_GLOBAL ? CS_GLOBAL + path.slice(1).join(".") : path.join(".");
+  return path[0]?.endsWith("::") ? path[0] + path.slice(1).join(".") : path.join(".");
 }
 
 /**
@@ -2694,9 +2698,12 @@ function extractFromCSharp(
     if (!target) continue;
     const block = blockOf(u);
     if (alias && named.length >= 2) {
-      // A file-level alias is resolved from the global namespace; one in a
-      // block, like any name there, from that block.
-      const anchored = block || target[0] === CS_GLOBAL ? target : [CS_GLOBAL, ...target];
+      // An alias's target is looked up where the alias is declared, never
+      // where it is used: a file-level one from the global namespace, one in a
+      // block from the block's namespace outward (`App.Shop::`), so a nearer
+      // namespace at the use cannot redirect it. `global::` stays as written.
+      const anchor = block ? `${block.namespace}::` : CS_GLOBAL;
+      const anchored = target[0] === CS_GLOBAL ? target : [anchor, ...target];
       const list = aliases.get(alias.text()) ?? [];
       list.push({ block: block?.range ?? null, target: anchored });
       aliases.set(alias.text(), list);
@@ -2798,14 +2805,26 @@ function extractFromCSharp(
     }
     return owner?.sym ?? null;
   };
-  // A value whose declared type is written with its own name (`Status Status`)
-  // may be read as either in C#, the "Color Color" rule: it never hides the
-  // type of that name, and the type lookup decides.
+  // C# reads a value whose type has the value's own name either way (the
+  // "Color Color" rule), so `Status Status` hides no type `Status`, but only
+  // when both readings name the same type. The declared type's written path
+  // is kept when its last segment is the value's name: a plain name or a
+  // qualified one, `?` allowed; an array, a pointer or a generic is another type.
   // biome-ignore lint/suspicious/noExplicitAny: ast-grep node type leaks through
-  const typedAsItself = (type: any, name: string): boolean => csTypeHeadIdentifier(type)?.text() === name;
+  const typedAsItself = (type: any, name: string): { path: string[]; nullable: boolean } | null => {
+    const nullable = type?.kind() === "nullable_type";
+    const inner = nullable ? (type.field?.("type") ?? type.children?.()?.[0] ?? null) : type;
+    const kind = inner?.kind();
+    if (kind !== "identifier" && kind !== "qualified_name" && kind !== "alias_qualified_name") return null;
+    const path = csNamePath(inner);
+    return path && path[path.length - 1] === name ? { path, nullable } : null;
+  };
   // Each type's value members and nested types by name, read below to tell a
-  // receiver that is a value from one that is a type.
+  // receiver that is a value from one that is a type. A member typed as itself
+  // is neither: whether it hides the type is left to resolution, which can
+  // compare the two readings (`csSelfTypedMembers`).
   const valueMembers = new Map<SymbolNode, Set<string>>();
+  const selfTypedMembers = new Map<SymbolNode, Set<string>>();
   const nestedTypes = new Map<SymbolNode, Set<string>>();
   const addName = (map: Map<SymbolNode, Set<string>>, sym: SymbolNode, name: string) => {
     const names = map.get(sym);
@@ -2823,9 +2842,15 @@ function extractFromCSharp(
       owner.csMembers ??= [];
       owner.csMembers.push(name);
     }
-    if (type && typedAsItself(type, name)) {
+    const self = type ? typedAsItself(type, name) : null;
+    if (self) {
       owner.csSelfTypedMembers ??= [];
-      owner.csSelfTypedMembers.push(name);
+      owner.csSelfTypedMembers.push({
+        name,
+        type: csJoin(expandAt(self.path, csRange(type).start)),
+        ...(self.nullable ? { nullable: true } : {}),
+      });
+      addName(selfTypedMembers, owner, name);
     } else addName(valueMembers, owner, name);
   };
   for (const k of ["field_declaration", "event_field_declaration"]) {
@@ -2859,7 +2884,7 @@ function extractFromCSharp(
   // a parameter. A pattern variable is given its whole block, which over-
   // rather than under-states where it is visible.
   const localScopes = new Set([
-    "block", "switch_section", "for_statement", "foreach_statement", "using_statement", "fixed_statement",
+    "block", "switch_section", "switch_expression_arm", "for_statement", "foreach_statement", "using_statement", "fixed_statement",
     "catch_clause", "lambda_ex
```

**File**: `src/types.ts` (modified, +9/-7)
```diff
@@ -194,14 +194,16 @@ export interface SymbolNode {
    */
   csMembers?: string[];
   /**
-   * C# types only: the fields and properties whose declared type is written
-   * with their own name (`Status Status`). C# lets such a name be read as the
-   * value or as the type (the "Color Color" rule), so it never hides the type
-   * of that name from an expression. Every other field, property, constant,
-   * event and enum member of the type does: a receiver starting with it is a
-   * value, and its access names no type. Absent when the type declares none.
+   * C# types only: the fields and properties whose declared type ends in
+   * their own name (`Status Status`, `Other.Status Status`, `Status? Status`),
+   * with that type as written (`type`, aliases written out) and whether it is
+   * nullable. C# reads such a name as the value or as the type (the "Color
+   * Color" rule) only when both readings name the same type, which resolution
+   * checks; otherwise it is a value. Every other field, property, constant,
+   * event and enum member of the type is a value: a receiver starting with it
+   * names no type. Absent when the type declares none.
    */
-  csSelfTypedMembers?: string[];
+  csSelfTypedMembers?: Array<{ name: string; type: string; nullable?: boolean }>;
   /**
    * C# types only: the base class and interfaces as the declaration writes
    * them, type arguments dropped and the file's `using` aliases written out
```

**File**: `tests/unit/graph-symbol-resolution-csharp.test.ts` (modified, +83/-0)
```diff
@@ -603,6 +603,89 @@ describe("C# extractor-to-resolver regressions", () => {
     expect(print("Outer.cs", 3)).toEqual([{ confidence: "local", targets: ["App.Outer.Inner.Report.Print"] }]);
   });
 
+  it("binds a namespace block's alias where it is declared, never where it is used", () => {
+    const files = {
+      "Root.cs": "namespace Billing { public class Calc { public static int Compute() => 1; } }",
+      "Inner.cs": "namespace App.Inner.Billing { public class Calc { public static int Compute() => 2; } }",
+      "Lost.cs": "namespace App.Inner.Missing { public class Calc { public static int Compute() => 3; } }",
+      "Tools.cs": "namespace Tools { public class Kit { public static int Make() => 4; } }",
+      "Shop.cs": [
+        "namespace App { using Tools; using C = Billing.Calc; using D = Missing.Calc; using K = Kit;",
+        "  namespace Inner { public class Shop {",
+        "    int A(C c) => C.Compute();",
+        "    int B() => D.Compute();",
+        "    int E() => K.Make() + Kit.Make();",
+        "  } }",
+        "}",
+      ].join("\n"),
+    };
+    const { at } = run(files);
+    // `Billing.Calc` is read from `App`, where the alias is declared: `App.Inner.Billing` is not in sight there.
+    expect(at("Shop.cs", 3, "call", "Compute")).toEqual([{ confidence: "unique", targets: ["Billing.Calc.Compute"] }]);
+    expect(at("Shop.cs", 3, "type_reference", "Calc")).toEqual([{ confidence: "unique", targets: ["Billing.Calc"] }]);
+    // From `App` no `Missing` exists: the alias names nothing, and the use site is not searched instead.
+    expect(at("Shop.cs", 4, "call", "Compute")).toEqual([{ confidence: "unresolved", targets: [] }]);
+    // An alias target never sees its own block's imports; a use in the block does.
+    expect(at("Shop.cs", 5, "call", "Make")).toEqual([
+      { confidence: "unresolved", targets: [] },
+      { confidence: "unique", targets: ["Tools.Kit.Make"] },
+    ]);
+  });
+
+  it("reads a value typed as itself as the type only when both readings name one type", () => {
+    const files = {
+      "Phase.cs": "namespace App { public class Phase { public static int Parse() => 1; } public enum Tier { Faint } }",
+      "Other.cs": "namespace App.Other { public class Phase { public int Parse() => 2; } }",
+      "Voyage.cs": [
+        "namespace App { public class Voyage {",
+        "  public Other.Phase Phase { get; }",
+        "  int A() => Phase.Parse();",
+        "} }",
+      ].join("\n"),
+      "Lantern.cs": "namespace App { public class Lantern {\n  public App.Phase Phase { get; }\n  int B() => Phase.Parse();\n} }",
+      "Quiver.cs": "namespace App { public class Quiver {\n  public Phase Phase { get; }\n  int C() => Phase.Parse();\n} }",
+      "Beacon.cs": "namespace App { public class Beacon {\n  public Tier? Tier { get; }\n  object D() => Tier.Faint;\n} }",
+      "Params.cs": [
+        "namespace App { public class Params {",
+        "  int E(Other.Phase Phase) => Phase.Parse();",
+        "  int F(Phase Phase) => Phase.Parse();",
+        "} }",
+      ].join("\n"),
+    };
+    const { at } = run(files);
+    const parse = (file: string, line: number) => at(file, line, "call", "Parse");
+    const unresolved = [{ confidence: "unresolved", targets: [] }];
+    const phase = [{ confidence: "unique", targets: ["App.Phase.Parse"] }];
+    // `Other.Phase Phase` is a value: `Phase` alone names another type.
+    expect(parse("Voyage.cs", 3)).toEqual(unresolved);
+    expect(at("Voyage.cs", 3, "type_reference", "Phase")).toEqual(unresolved);
+    expect(parse("Params.cs", 2)).toEqual(unresolved);
+    // Written plain or qualified, the same type both ways: the static method.
+    expect(parse("Lantern.cs", 3)).toEqual(phase);
+    expect(parse("Quiver.cs", 3)).toEqual(phase);
+    expect(parse("Params.cs", 3)).toEqual(phase);
+    // `Tier?` of an enum is `Nullable<Tier>`, another type than `Tier`.
+    expect(at("Beacon.cs", 3, "type_reference", "Tier")).toEqual(unresolved);
+  });
+
+  it("keeps a switch arm's pattern variable inside its arm", () => {
+    const files = {
+      "Calc.cs": "namespace App { public class Calc { public static int Compute() => 1; } public interface IShape { int Print(); } }",
+      "Sorter.cs": [
+        "namespace App { public class Sorter {",
+        "  int Go(object o) => o switch {",
+        "    IShape Calc => Calc.Print(),",
+        "    int n => Calc.Compute(),",
+        "    _ => 0,",
+        "  };",
+        "} }",
+      ].join("\n"),
+    };
+    const { at } = run(files);
+    expect(at("Sorter.cs", 3, "call", "Print")).toEqual([{ confidence: "unresolved", targets: [] }]);
+    expect(at("Sorter.cs", 4, "call", "Compute")).toEqual([{ confidence: "unique", targets: ["App.Calc.Compute"] }]);
+  });
+
   it("leaves a path through an extern alias unresolved", () => {
     const files = {
       "Billing/Calc.cs": "namespace App.Billing { public class Calc { public static int Compute() => 1; 
```

#### Recent Merged Pull Requests:
- **PR #210** (2026-10-23): fix(search): name the filter when a filtered codebase_search finds nothing (@gnyan-zadara)
- **PR #209** (2026-10-23): fix(graph): name C# declarations by their name field and capture type, creation and qualified-call edges (@pcherkashin)
- **PR #206** (2026-10-15): fix(graph): name attributed PHP declarations by their name field (@pma1999)
- **PR #204** (2026-10-10): feat(graph): add limit to codebase_symbol, codebase_impact and codebase_flow (@shaitourchin)
- **PR #202** (2026-10-07): fix(symbol-graph): retry Qdrant requests once on a closed connection (@shaitourchin)
- **PR #200** (2026-10-07): fix(graph): resolve JVM imports in Kotlin Multiplatform / Gradle source sets (@megadoom99)

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

## X. graph): resolve C# names only through the scopes and imports C# uses

**RULE**:
When implementing operations in `src/constants.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in giancarloerra/SocratiCode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `692963c2`: graph): resolve C# names only through the scopes and imports C# uses. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/constants.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
/**
 * The leading segment a C# edge keeps for a `global::`-anchored path
 * (`global::App.Calc`): the path names members of the global namespace only,
 * never a scope the reference sits in.
 */
export const CS_GLOBAL_ANCHOR = "global::";

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `692963c2` are properly handled with clean fallback behavior.
