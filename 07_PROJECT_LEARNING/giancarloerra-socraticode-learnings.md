# Forensic Learning Record (Deep Inspection): giancarloerra/SocratiCode

> **Canonical Artifact**: `07_PROJECT_LEARNING/giancarloerra-socraticode-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/giancarloerra/SocratiCode](https://github.com/giancarloerra/SocratiCode))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:21:55.683Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `giancarloerra/SocratiCode`
- **Description**: Enterprise-grade (40m+ LOC) codebase intelligence, zero-setup, local & private Plugin/Skill/Extension or MCP: hybrid semantic search, polyglot dependency graphs, symbol-level impact analysis & call-flow, interactive HTML viewer, cross-project & branch-aware search, DB/API/infra knowledge. 61% less tokens, 84% fewer calls, 37x faster. Cloud in beta.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3328 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
    vscode.window.showWarningMessage("SocratiCode: open a workspace t
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #129** (2026-09-01): **Preserve existing indexes when index-shaping settings change**
  *Symptoms*: ### Problem  Settings and code changes that alter embedded text, vector generation, chunk output, or stored payload identity are not recorded with the index. Incremental indexing decides whether to skip a file from a hash of its raw source content only. A setting can therefore change the data that should be stored while every unchanged file is skipped.  `EMBEDDING_DOCUMENT_PREFIX` from #126 is one concrete case. `prepareDocumentText` includes the configured prefix in the text sent to both dense embedding and BM25, while `hashContent` hashes only the raw file contents. Project metadata stores file hashes but no encoding or index-format profile. Context artifacts make a separate staleness decision from `contentHash` alone.  The failure mode is a mixed collection: unchanged files retain the old representation, while edited or newly added files use the new representation. Search then uses the current query configuration against data produced by more than one configuration.  Context artifacts also embed their configured path and store their path and description in payloads. Changing an artifact path or description without changing its content currently leaves the old vectors or payloads in place because only `contentHash` is compared.  ### Backward-compatibility invariant  An existing index must remain usable after an upgrade without a mandatory re-index.  - A new index-shaping feature must either work safely with the existing index or remain inactive for that index until its next

- **Issue #89** (2026-07-28): **[Bug]: codebase_graph_build fails silently with "Bad Request" on repos with large files (700KB–920KB Java files) - graph never completes, codebase_impact non-functional**
  *Symptoms*: ### Describe the bug  codebase_impact always returns 0  ### Steps to reproduce  Steps to Reproduce:   Its a Java-Maven project 1.Have a Java repo containing files ≥ 700 KB (File Lines more than 23K) 2.Call codebase_graph_build on the project 3.Build progresses normally through analyzing imports phase 4.At ~92–94% progress, build fails silently   Environment: •SocratiCode: npx socraticode via ~/.npm/npx/39052607b6e520af/ •Qdrant: v1.17.0 (external, localhost:16333) •Ollama embedding: nomic-embed-text •OS: macOS (OrbStack) •Repo: Java, 3,905 files, 87K edges  Symbol graph:   Files: 99         ← only 99 of 3,607 Java files   Symbols: 2816   Call edges: 58356   Unresolved: 83.0%  codebase_impact → Total impacted files: 0  Impact: codebase_impact tool returns 0 results for all symbols - symbol graph stuck at 99 files / 83% unresolved  ### Expected behavior   Symbol graph should cover all Java source files. codebase_impact should return accurate callers/dependents.  ### Actual behavior  codebase_impact tool returns 0 results for all symbols - symbol graph stuck at 99 files / 83% unresolved  Observed: Last build failed: Bad Request  No additional error detail is surfaced in the MCP response.  ### Embedding provider  Ollama (native / external)  ### Qdrant mode  External (self-hosted / cloud)  ### MCP host  Other (specify below)  ### Operating system  macOS 15.7.7 | MCP host: IntelliJ Github Copilot plugin  ### Node.js version  v25.8.0  ### Relevant log output  ```shell  ```  ### Addi
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report, and especially for the file-size range and the "~92-94% then fails" detail, they pinned it fast. I reproduced this against a real Qdrant v1.17.0 and root-caused it; there are actually three things stacked here.  **Root cause: the symbol-graph persist batches points by count, not by size.** When SocratiCode persists the symbol graph, it upserts per-file payload points to Qdrant in fixed batches of 50, with no byte budget. A large source file expands into a large payload point (a ~925 KB Java file becomes a single ~6 MB Qdrant point). Put a few of those in one 50-file batch and the request body crosses Qdrant's default `service.max_request_size_mb = 32` (33,554,432 bytes), and Qdrant rejects the whole request with HTTP 400 `JSON payload (N bytes) is larger than allowed`. I binary-searched the boundary and it sits exactly on 32 MiB. Your Node version (25) is not involved.  **Why you saw `impact = 0` instead of an error.** Two follow-on bugs make it silent: 
  > Hi @giancarloerra  thanks so much for the quick fix - it's working great now!  While testing further, I noticed a related issue that may be worth looking into. In my project, a small number of Java files are exceptionally large (up to 925 KB and ~24K lines). When these files are included during indexing, I still encounter the same "Bad Request" payload error. **Excluding these files resolves the issue completely.**  After investigating, it appears these very large files generate an unusually high number of symbols, causing the payload for an individual file/point to exceed Qdrant's maximum request size. This seems to be a different limitation from the batching issue addressed in this PR.  For now, my workaround is to add these files to .socraticodeignore, which avoids the problem entirely.  Just sharing this observation in case it's useful for a future enhancement.  **Environment:**  SocratiCode: v1.9.2 Qdrant: v1.17.0 (external, HTTP REST mode) Repository: Java (~3,660 files)  The fil
  > Thanks for the follow-up.  I dug into this one and I think the cause is different from what it looks like, in a way that matters for the fix.  I built a project with your exact file profile (925 / 811 / 791 / 770 / 718 / 716 / 707 KB Java files) and ran a real graph build against Qdrant 1.17.0. It **succeeded**: 72,823 symbols, no error. Measuring the individual points, the largest single-file payload came out at **0.97 MB against the 32 MB limit**, so roughly 33x headroom. A single large file's point is not what is overflowing.  What does overflow is the **name index shards**. Those hold every symbol in the repo bucketed by the first letter of its name, so they grow with the whole repo rather than with one file, and Java is close to a worst case because of `getX`/`setX`. In a 403-file test my `g` and `s` shards were 1.83 MB each while every other bucket sat at about 0.02 MB. Scaled to your ~3,660 files that puts the largest shard near 16 MB, and your real code will have longer package

- **Issue #82** (2026-07-21): **[Bug]: Go graph + impact still return 0 edges when go.mod is nested (monorepo) — module-path  resolution only finds root-level go.mod.**
  *Symptoms*: ### Describe the bug  On SocratiCode 1.8.18 (latest), in a Go project whose go.mod is nested below the indexed root (a monorepo layout), the Go dependency graph and symbol-level Impact Analysis produce no edges and no callers for Go files, even though the imports and call sites clearly exist. Non-Go files in the same index (TypeScript/Vue) resolve correctly, so  the graph builder works in general — it specifically fails to resolve Go when go.mod is not at the indexed project root.   After indexing such a repo:  - codebase_graph_stats lists the Go files in the language breakdown, but every .go file appears as an orphan with 0 connections;  the total edge count reflects only the non-Go files.  - codebase_graph_query <any .go file> → No dependency information found for this file.  - codebase_impact <Go symbol> → Total impacted files: 0 — No callers found., even for a symbol that is plainly called from other files in the module.   This is the same class of bug as #45 ("Go codebase_graph_query returns 0 edges — module path resolution not implemented"), which  was fixed for projects with go.mod at the root (commits c156da1 + 8c26ed8). That fix resolves Go imports by parsing the go.mod module path, but it does not appear to locate go.mod when it sits in a subdirectory of the indexed path — so no module path is learned, no Go edges are produced, and cross-package symbol resolution silently fails. Note #45 states that "symbol-level tools use a different code path and work"; in the nes
  **Post-Mortem & Fix Analysis**:
  > Thanks for the excellent report: the repro is minimal and self-contained, and the contrast steps (indexing `backend/` alone works; indexing the monorepo root fails) pin it precisely.   **Root cause.** The Go module resolver reads `go.mod` from exactly one location, the indexed project root. When `go.mod` sits in a subdirectory (`backend/`), that read fails, the module info comes back `null`, and every Go import then resolves to `null`, so no Go file-graph edges are produced. It's the same resolver #45 added; it just never learned to look below the root.  **Why impact/callers also return 0.** You're right that the symbol-level path doesn't save the nested case. It doesn't parse `go.mod` itself, but it resolves a cross-package call by walking the caller's file-import dependencies and matching the callee name in those files. Those dependency edges are exactly the ones that fail to build without the module map, so with a nested `go.mod` there are no edges to walk: the call is left unresolv
  > I wanted to explore in more depth, but my opencode was a bit too enthusaistic and created the PR. If it's not good enough just ignore it, or tell me and I will make a more thorough turn with it. Sorry, in middle of a bit of harness environment refactoring and it was rushing to open the PR :)
  > Thanks for the heads-up, and no worries about opencode jumping the gun. I did a deep-review and findings are below:  **The blocker: it doesn't fix #82, and it regresses the #45 root-level case.** The new `buildGoModuleInfo` discovers modules by scanning the graphable file set for `go.mod` entries, but `go.mod` never enters that set: `getGraphableFiles` only admits files with an ast-grep grammar or an extra extension, and `.mod` is neither (`getAstGrepLang(".mod")` is null, `EXTRA_EXTENSIONS` empty by default). So the scan matches nothing in a real build. Running the actual `getGraphableFiles` → `buildCodeGraph` on disk:  - Root-level `go.mod` (the #45 case): `main` produces 1 Go edge, this branch produces 0. - Nested `backend/go.mod` (the #82 case): still 0.  #45 worked because the old code read `<root>/go.mod` straight from disk, independent of the file set. Swapping that disk read for a file-set scan is what broke both cases.  **Why CI stayed green:** the unit tests build their file 

- **Issue #68** (2026-06-03): **[Bug]: codebase_graph_build doesn't correctly map typescript aliases**
  *Symptoms*: ### Describe the bug  given a tsconfig.json with type aliases and imports of type  `import { something } from '@aliased-package/file';` socraticode doesn't honor the type aliases  ### Steps to reproduce  given a tsconfig.json with type aliases and imports of type  `import { something } from '@aliased-package/file';` socraticode doesn't honor the type aliases  ### Expected behavior  it should map all imports, even the aliased ones.  ### Actual behavior  only non-aliased imports are resolved  ### Embedding provider  Ollama (Docker — default)  ### Qdrant mode  Managed (Docker — default)  ### MCP host  Claude Desktop  ### Operating system  macOS 26.5.1  ### Node.js version  v24.13.0  ### Relevant log output  ```shell  ```  ### Additional context  _No response_  ### Checklist  - [x] I have searched existing issues and this hasn't been reported before - [x] I am using the latest version of SocratiCode
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. Path alias resolution from tsconfig is supported (wildcard and exact patterns, `baseUrl`, multiple targets, JSONC comments, and `extends` chains), so let's see why yours is not resolving.  **First thing to check: a trailing comma in your tsconfig.json.** SocratiCode strips `//` and `/* */` comments before parsing, but it does not strip trailing commas, and the underlying `JSON.parse` rejects them. TypeScript and VS Code both accept trailing commas (they use a JSONC parser), so your editor never complains, but SocratiCode currently ends up with zero aliases in that case, and right now it does so without logging anything. If there is a trailing comma anywhere in your tsconfig.json (a very common situation), that alone produces exactly what you describe: only non-aliased imports resolve, no errors. Removing it and rebuilding the graph is the quickest thing to try.  If that is not it, could you share:  - Your `compilerOptions.baseUrl` and `compilerOptions.paths` bloc
  > hey, thanks for the quick reply! It turns out it was an user error after all, I was indexing the parent folder, instead of the one that contained tsconfig.json

- **Issue #31** (2026-04-21): **[Bug]: using external ollama and qdrant runs docker containers locally**
  *Symptoms*: ### Describe the bug  When using external ollama and qdrant, docker images are pulled anyway and containers are launched. It doesn't seem to make sense.  ### Steps to reproduce  opencode.json: ```json   "mcp": {     "socraticode": {       "type": "local",       "command": ["npx", "-y", "socraticode"],       "env": {         "OLLAMA_MODE": "external",         "OLLAMA_URL": "http://REDACTED",         "EMBEDDING_MODEL": "nomic-embed-text-v2-moe",         "EMBEDDING_DIMENSIONS": "768",         "QDRANT_MODE": "external",         "QDRANT_URL": "http://REDACTED",         "QDRANT_API_KEY": ""       }     }   } ```  ```shell $ docker ps CONTAINER ID   IMAGE                                COMMAND                  CREATED          STATUS                       PORTS                                                                                          NAMES be9e82e69729   ollama/ollama:latest                 "/bin/ollama serve"      2 minutes ago    Up 2 minutes                 0.0.0.0:11435->11434/tcp, [::]:11435->11434/tcp                                                socraticode-ollama 587074fc1553   qdrant/qdrant:v1.17.0                "./entrypoint.sh"        59 minutes ago   Up 59 minutes                0.0.0.0:16333->6333/tcp, [::]:16333->6333/tcp, 0.0.0.0:16334->6334/tcp, [::]:16334->6334/tcp   socraticode-qdrant ```  ### Expected behavior  ollama and qdrant images do not pull docker and containers do not start.  ### Actual behavior  ollama and qdrant, docker images are pulled
  **Post-Mortem & Fix Analysis**:
  > Hi, there's no code path that creates containers in external mode:  [ensureQdrantReady](docker.ts:154): early-returns to [ensureExternalQdrantReady] when [QDRANT_MODE=external]: it does only HTTP healthcheck, no docker calls  [OllamaEmbeddingProvider.ensureReady] (provider-ollama.ts:163): [ensureOllamaContainerReady] only called when [ollamaMode === "docker"]  [autoResumeIndexedProjects] (startup.ts:41): skips Docker checks in external mode  The explanation is that Socraticode ran on that system once before without mode external in the configuration file.   Could you try deleting those Docker images (they are configured to auto restart so must be deleted from Docker), close any MCP host and Socraticode and making sure no Node process was left behind, and then try again launching Socraticode with that configuration in external mode: it should not download any Docker image.
  > Marking this as closed, as there's no way in the code for this to happen, and testing locally didn't happen as well.   The only technical explanation was from a previous run without those configurations (maybe accidental, due to another process launching Socraticode as soon as a previous version of the MCP configuration was saved without the external mode configured? I see this happening).  Might be worth a mention in the FAQs?  Happy to help understanding on your local machine what happened, you can join the Discord channel as well for this 👍 https://discord.gg/5DrMXfNG
  > You're right. This is my configuration error. Opencode uses the `environment` according to the scheme <https://opencode.ai/config.json>, not `env` as specified in my configuration. I apologize for distracting you.

- **Issue #28** (2026-04-15): **[Bug]: Consuming millions of tokens? (using Claude Code plugin)**
  *Symptoms*: ### Describe the bug  I'm not sure yet, but after starting using SocratiCode on one monorepo, the usage tokens increased from thousands to millions.  Date | Models | Input | Output | Cache Create | Cache Read | Total | Cost | Requests -- | -- | -- | -- | -- | -- | -- | -- | -- 2026 04-14 | - claude-haiku-4-5-20251001- claude-sonnet-4-6 | 606K | 10.8M | 65.0M | 2490.0M | 2566.5M | $1007.77 | 228  ### Steps to reproduce  1. added the plugin through the claude code marketplace 2. asked to claude code to use the mcp to review a plan I was working on (small one)  ### Expected behavior  Use less tokens  ### Actual behavior  Used millions of tokens  ### Embedding provider  Ollama (Docker — default)  ### Qdrant mode  Managed (Docker — default)  ### MCP host  Other (specify below)  ### Operating system  macOS 26.3.1  ### Node.js version  v24.14.0  ### Relevant log output  ```shell  ```  ### Additional context  _No response_  ### Checklist  - [x] I have searched existing issues and this hasn't been reported before - [x] I am using the latest version of SocratiCode
  **Post-Mortem & Fix Analysis**:
  > <img width="197" height="270" alt="Image" src="https://github.com/user-attachments/assets/1fcc18f4-08e8-4414-b182-d72549cf2263" />  the reads and writes went to the roof
  > I did some digging into this, and looks like the problem is that I asked to claude code to  build a plan using socraticode and in mid-session asked to update the plan using the figma mcp on one specific frame, and turns out that claude code spun out 14 sub-agents in explore mode with a copy of 50k of tokens as context.  So the problem wasn't exactly the use of SocratiCode, but how it was used to create a plan along with Figma mcp.
  > Hi thanks for this, I'm closing this as it seems was indeed Claude Code.  Personally speaking, I don't like using Claude Code exactly because of what happened to you: it takes control out of the hands of a developer trying to be 'clever', and often loads Skills not necessarily needed, it often launches subagents without a need of it, and can go quite rough. I always prefer using VSCode and Copilot (properly configured) with Opus. I find it a much better, higher quality, incredibly lower consumption, and it does exactly what is told without taking decisions (the bane of AI in my opinion, despite sadly the hype around tends to favour 'swarms of agents taking decisions' like a positive thing, which I think it never is for any production product).  If you find that Claude Code tends to spin loads of subagents and you like it, then these don't usually need much context, as they should be pretty focused, so you can reduce the amount of results returned by SocratiCode and/or the threshold to 

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

### Incident Patch 1: `3e3b4b3d` (2026-09-28)
**Commit Message**: Merge pull request #193 from giancarloerra/ge/issue-192-dependency-security

chore(deps): update patched dependencies

**File**: `package-lock.json` (modified, +71/-67)
```diff
@@ -52,11 +52,11 @@
         "@release-it/conventional-changelog": "^11.0.0",
         "@types/node": "^22.13.4",
         "@types/proper-lockfile": "^4.1.4",
-        "@vitest/coverage-v8": "^4.0.18",
+        "@vitest/coverage-v8": "^4.1.11",
         "release-it": "^20.0.1",
         "tsx": "^4.19.4",
         "typescript": "^5.7.3",
-        "vitest": "^4.0.18"
+        "vitest": "^4.1.11"
       },
       "engines": {
         "node": ">=18.17.0"
@@ -2694,14 +2694,14 @@
       "license": "MIT"
     },
     "node_modules/@vitest/coverage-v8": {
-      "version": "4.1.10",
-      "resolved": "https://registry.npmjs.org/@vitest/coverage-v8/-/coverage-v8-4.1.10.tgz",
-      "integrity": "sha512-IM49HmthevbgAO4anp1hwtoT9wYe59w0LR00gr+eagHE+ZJ5lK4sLPeO0ubgoJcwLk6dehU3R24N+FbEEKDc8g==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/coverage-v8/-/coverage-v8-4.1.11.tgz",
+      "integrity": "sha512-8MVGEFnJIcdGjcbfKmeq8z0pZHH0JlVtoVZH9Q/qwUp6wyFnEJUBMrw9DCaj+ra3vShGmhavjalMIhPNxZAUcw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@bcoe/v8-coverage": "^1.0.2",
-        "@vitest/utils": "4.1.10",
+        "@vitest/utils": "4.1.11",
         "ast-v8-to-istanbul": "^1.0.0",
         "istanbul-lib-coverage": "^3.2.2",
         "istanbul-lib-report": "^3.0.1",
@@ -2715,8 +2715,8 @@
         "url": "https://opencollective.com/vitest"
       },
       "peerDependencies": {
-        "@vitest/browser": "4.1.10",
-        "vitest": "4.1.10"
+        "@vitest/browser": "4.1.11",
+        "vitest": "4.1.11"
       },
       "peerDependenciesMeta": {
         "@vitest/browser": {
@@ -2725,16 +2725,16 @@
       }
     },
     "node_modules/@vitest/expect": {
-      "version": "4.1.10",
-      "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.10.tgz",
-      "integrity": "sha512-YsCn+qAk1GWjQOWFEsEcL2gNQ0zmVmQu3T03qP6UyjhtmdtwtbuI+DASn/7iQB3HGTXkdBwGddzxPlmiql5vlA==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/expect/-/expect-4.1.11.tgz",
+      "integrity": "sha512-VX2x5vNJXET47KAFzwERI+KRMtTTCSWTfSMKsW7JsUsXV4psq++e3DvZpuTDOpHcxytiDs6p2nhVb2tVDiiUYw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@standard-schema/spec": "^1.1.0",
         "@types/chai": "^5.2.2",
-        "@vitest/spy": "4.1.10",
-        "@vitest/utils": "4.1.10",
+        "@vitest/spy": "4.1.11",
+        "@vitest/utils": "4.1.11",
         "chai": "^6.2.2",
         "tinyrainbow": "^3.1.0"
       },
@@ -2743,13 +2743,13 @@
       }
     },
     "node_modules/@vitest/mocker": {
-      "version": "4.1.10",
-      "resolved": "https://registry.npmjs.org/@vitest/mocker/-/mocker-4.1.10.tgz",
-      "integrity": "sha512-v0xaezt+DKEmKfaxg133ldzADrwLGd7Ze1MfQQTYfvs8OqZIwbxyxaYURivwV7sWy5fqn3rH5uOrSp07bp44Ow==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/mocker/-/mocker-4.1.11.tgz",
+      "integrity": "sha512-2XJVD55d1o5AZous5CCGKS74g/riOj9odEt2bQpCVZeblHyHdnMeFl4jl0XjU21stf4mbjUkew2eXQZt65g5CQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@vitest/spy": "4.1.10",
+        "@vitest/spy": "4.1.11",
         "estree-walker": "^3.0.3",
         "magic-string": "^0.30.21"
       },
@@ -2770,9 +2770,9 @@
       }
     },
     "node_modules/@vitest/pretty-format": {
-      "version": "4.1.10",
-      "resolved": "https://registry.npmjs.org/@vitest/pretty-format/-/pretty-format-4.1.10.tgz",
-      "integrity": "sha512-W1HsjSH4MXQ9YfmmhLAoIYf1HRfekQCGngeIgcei6MP5QQGWUe0gkopdZQaVCFO+JDJMrAJGwa5pRpNpvy4P8Q==",
+      "version": "4.1.11",
+      "resolved": "https://registry.npmjs.org/@vitest/pretty-format/-/pretty-format-4.1.11.tgz",
+      "integrity": "sha512-yiZzPbGTS9Sr/JpFl8zHrcIkAofNbFV6k21vIgQN/cY/oxZeXhJv5sc/MBJ5jFKWmWs+oJHw0UXLZjmf931+Vw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -2783,28 +2783,28 @@
       }
```

**File**: `package.json` (modified, +3/-3)
```diff
@@ -107,11 +107,11 @@
     "@release-it/conventional-changelog": "^11.0.0",
     "@types/node": "^22.13.4",
     "@types/proper-lockfile": "^4.1.4",
-    "@vitest/coverage-v8": "^4.0.18",
+    "@vitest/coverage-v8": "^4.1.11",
     "release-it": "^20.0.1",
     "tsx": "^4.19.4",
     "typescript": "^5.7.3",
-    "vitest": "^4.0.18"
+    "vitest": "^4.1.11"
   },
   "engines": {
     "node": ">=18.17.0"
@@ -122,7 +122,7 @@
     },
     "postcss": "8.5.23",
     "release-it": {
-      "undici": "7.29.0"
+      "undici": "7.29.1"
     }
   }
 }
```

---

### Incident Patch 2: `fe2dacf5` (2026-09-28)
**Commit Message**: fix(index): wait for Git refresh deletions to complete

**File**: `src/services/indexer.ts` (modified, +4/-4)
```diff
@@ -1254,7 +1254,7 @@ async function indexProjectLocked(
     progress.phase = "cleaning stale chunks";
     for (const file of chunkedFiles) {
       if (hashes.has(file.relativePath)) {
-        await deleteFileChunks(collection, file.relativePath);
+        await deleteFileChunks(collection, file.relativePath, Boolean(target));
       }
     }
 
@@ -1264,7 +1264,7 @@ async function indexProjectLocked(
     );
     for (const [filePath] of hashes) {
       if (!currentFileSet.has(filePath)) {
-        await deleteFileChunks(collection, filePath);
+        await deleteFileChunks(collection, filePath, Boolean(target));
         hashes.delete(filePath);
       }
     }
@@ -1773,7 +1773,7 @@ export async function updateProjectIndex(
     progress.phase = "cleaning stale chunks";
     for (const file of changedFiles) {
       if (!file.isNew) {
-        await deleteFileChunks(collection, file.relativePath);
+        await deleteFileChunks(collection, file.relativePath, Boolean(target));
       }
     }
 
@@ -1906,7 +1906,7 @@ export async function updateProjectIndex(
   const removedRelPaths: string[] = [];
   for (const [filePath] of hashes) {
     if (!currentFileSet.has(filePath)) {
-      await deleteFileChunks(collection, filePath);
+      await deleteFileChunks(collection, filePath, Boolean(target));
       hashes.delete(filePath);
       removed++;
       removedRelPaths.push(filePath);
```

**File**: `src/services/qdrant.ts` (modified, +3/-2)
```diff
@@ -854,12 +854,13 @@ export async function upsertPreEmbeddedChunks(
   }
 }
 
-/** Delete all chunks for a specific file (matched by relativePath) */
-export async function deleteFileChunks(collectionName: string, relativePath: string): Promise<void> {
+/** Delete a file's chunks, optionally waiting for application before reporting freshness. */
+export async function deleteFileChunks(collectionName: string, relativePath: string, waitForCompletion = false): Promise<void> {
   const qdrant = getClient();
   logger.info("Deleting file chunks", { collection: collectionName, relativePath });
   await withRetry(
     () => qdrant.delete(collectionName, {
+      ...(waitForCompletion ? { wait: true } : {}),
       filter: {
         must: [{ key: "relativePath", match: { value: relativePath } }],
       },
```

**File**: `tests/integration/git-refresh.test.ts` (modified, +8/-1)
```diff
@@ -88,6 +88,13 @@ describe.skipIf(!isDockerAvailable())("Git refresh with real Git, embeddings, Qd
     expect(symbols).toContain("uncommittedHelper");
     expect(isWatching(fixture.root)).toBe(false);
     fs.rmSync(path.join(fixture.root, "dirty.ts"));
+    git(fixture.root, "commit", "--allow-empty", "-m", "Trigger removed working-tree file refresh");
+    await checkGitRefresh(fixture.root);
+    await settled("refs/heads/main");
+    expect((await listIndexedFilePaths(collectionName(identity()))).has("dirty.ts")).toBe(false);
+    const removed = await handleQueryTool("codebase_search", { projectPath: fixture.root, query: "uncommittedHelper", fileFilter: "dirty.ts", minScore: 0 });
+    expect(removed).toContain("synchronized");
+    expect(removed).toContain("No results found");
   });
 
   it("keeps branch-specific collections and cached graphs separate, including same-SHA switches and detached HEAD", async () => {
@@ -174,7 +181,7 @@ describe.skipIf(!isDockerAvailable())("Git refresh with real Git, embeddings, Qd
 
     // Persist an interrupted checkpoint: one stale hash has lost its chunks,
     // and another on-disk file has not reached a completed batch yet.
-    await deleteFileChunks(collection, "main.ts");
+    await deleteFileChunks(collection, "main.ts", true);
     const source = "export function recoveredOnRestart() { return 'git_restart_recovery'; }\n";
     fs.writeFileSync(path.join(fixture.root, "unfinished.ts"), source);
     await saveProjectMetadata(collection, fixture.root, storedHashes.size + 1, storedHashes.size, storedHashes, "in-progress", profile);
```

**File**: `tests/unit/index-profile-indexer.test.ts` (modified, +20/-0)
```diff
@@ -211,6 +211,26 @@ afterEach(async () => {
 });
 
 describe("code-index effective profile compatibility", () => {
+  it.each([
+    ["indexProject", true], ["indexProject", false],
+    ["updateProjectIndex", true], ["updateProjectIndex", false],
+  ] as const)("%s requests completed replacements and removals only for Git targets (%s)", async (method, gitTarget) => {
+    const indexer = await loadIndexer();
+    const { legacyIndexProfile } = await import("../../src/services/index-profile.js");
+    const { projectIdFromPath } = await import("../../src/config.js");
+    const { deleteFileChunks } = await import("../../src/services/qdrant.js");
+    const project = await createProject("notes.txt", "new content");
+    collectionInfo = { pointsCount: 2, status: "green" };
+    storedProfile = legacyIndexProfile("code");
+    storedHashes = new Map([["notes.txt", indexer.hashContent("old content")], ["removed.txt", "old-hash"]]);
+    const target = { projectId: projectIdFromPath(project), allowCreate: false, assertCurrent: vi.fn(async () => {}) };
+
+    await indexer[method](project, undefined, undefined, gitTarget ? target : undefined);
+
+    expect(deleteFileChunks).toHaveBeenCalledWith(`codebase_${target.projectId}`, "notes.txt", gitTarget);
+    expect(deleteFileChunks).toHaveBeenCalledWith(`codebase_${target.projectId}`, "removed.txt", gitTarget);
+  });
+
   it("Git refresh preserves legacy profiles, reloads hashes, and keeps locks and writes tied to the captured identity", async () => {
     const indexer = await loadIndexer();
     const project = await createProject("notes.txt", "original source");
```

**File**: `tests/unit/qdrant-delete-completion.test.ts` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+// SPDX-License-Identifier: AGPL-3.0-only
+// Copyright (C) 2026 Giancarlo Erra - Altaire Limited
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+const { deletePoints } = vi.hoisted(() => ({ deletePoints: vi.fn() }));
+
+vi.mock("@qdrant/js-client-rest", () => ({
+  QdrantClient: class { delete = deletePoints; },
+}));
+vi.mock("../../src/services/logger.js", () => ({
+  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
+}));
+
+import { deleteFileChunks } from "../../src/services/qdrant.js";
+
+describe("file deletion completion", () => {
+  beforeEach(() => {
+    deletePoints.mockReset().mockResolvedValue({ status: "completed" });
+  });
+
+  it("preserves the existing request when completion is not requested", async () => {
+    await deleteFileChunks("codebase_fixture", "removed.ts");
+    expect(deletePoints).toHaveBeenCalledWith("codebase_fixture", {
+      filter: { must: [{ key: "relativePath", match: { value: "removed.ts" } }] },
+    });
+  });
+
+  it("requires applied deletion when a Git refresh needs a synchronized result", async () => {
+    await deleteFileChunks("codebase_fixture", "removed.ts", true);
+    expect(deletePoints).toHaveBeenCalledWith("codebase_fixture", {
+      filter: { must: [{ key: "relativePath", match: { value: "removed.ts" } }] },
+      wait: true,
+    });
+  });
+
+  it("propagates a failed completion request instead of reporting deletion success", async () => {
+    deletePoints.mockRejectedValue(new Error("Qdrant deletion could not complete"));
+    await expect(deleteFileChunks("codebase_fixture", "removed.ts", true)).rejects.toThrow("Qdrant deletion could not complete");
+  });
+});
```

---

### Incident Patch 3: `aeaba300` (2026-09-27)
**Commit Message**: fix(index): preserve Git refresh startup state

**File**: `src/services/git-refresh.ts` (modified, +7/-4)
```diff
@@ -138,7 +138,7 @@ export async function checkGitRefresh(projectPath: string, catchUp = false): Pro
         if (!await getCollectionInfo(collectionName(entry.projectId as string))) return;
         if (entry.stopped) return;
         entry.registered = true;
-        entry.pending = catchUp || process.env.SOCRATICODE_AUTO_RESUME?.trim().toLowerCase() !== "off";
+        entry.pending = entry.pending || catchUp || process.env.SOCRATICODE_AUTO_RESUME?.trim().toLowerCase() !== "off";
       } else if (catchUp) {
         entry.pending = true;
       }
@@ -153,10 +153,13 @@ export async function checkGitRefresh(projectPath: string, catchUp = false): Pro
   try { await entry.checking; } finally { entry.checking = undefined; }
 }
 
-/** Startup already selected an indexed project and awaits its normal catch-up. */
-export async function resumeGitRefresh(projectPath: string): Promise<void> {
+/** Await startup catch-up and return its captured project identity for cleanup. */
+export async function resumeGitRefresh(projectPath: string): Promise<string | undefined> {
   await checkGitRefresh(projectPath, true);
-  await projects.get(path.resolve(projectPath))?.running;
+  const entry = projects.get(path.resolve(projectPath));
+  const projectId = entry?.projectId;
+  await entry?.running;
+  return projectId;
 }
 
 /** Capture an explicit operation so its successful result can seed monitoring. */
```

**File**: `src/services/startup.ts` (modified, +8/-3)
```diff
@@ -237,7 +237,8 @@ async function resumeProject(
   }
 
   if (getWatcherMode() === "git") {
-    await resumeGitRefresh(resolvedPath);
+    const resumedProjectId = await resumeGitRefresh(resolvedPath);
+    if (resumedProjectId) await cleanStaleSymbolGraphGenerations(resolvedPath, resumedProjectId);
     return;
   }
 
@@ -327,8 +328,12 @@ async function resumeProject(
     });
   }
 
-  // Retire any abandoned or superseded symbol graph generations left from previous sessions,
-  // coordinated per project with any active or upcoming graph rebuild
+  await cleanStaleSymbolGraphGenerations(resolvedPath, projectId);
+}
+
+/** Reuse the startup cleanup for both file-watcher and Git catch-up paths. */
+async function cleanStaleSymbolGraphGenerations(resolvedPath: string, projectId: string): Promise<void> {
+  // Retire abandoned or superseded generations, coordinated with graph rebuilds.
   if (!isGraphBuildInProgress(resolvedPath)) {
     try {
       await coordinateProject(projectId, async () => {
```

**File**: `tests/integration/git-refresh.test.ts` (modified, +23/-0)
```diff
@@ -9,6 +9,7 @@ import { checkGitRefresh, gitRefreshStatus, stopAllGitRefreshes } from "../../sr
 import { hashContent, isIndexingInProgress, removeProjectIndex } from "../../src/services/indexer.js";
 import { getCollectionInfo, loadProjectHashes } from "../../src/services/qdrant.js";
 import { autoResumeIndexedProjects } from "../../src/services/startup.js";
+import { listStoredGenerations, loadFilePayload, loadSymbolGraphMeta, saveFilePayload } from "../../src/services/symbol-graph-store.js";
 import { isWatching } from "../../src/services/watcher.js";
 import { handleGraphTool } from "../../src/tools/graph-tools.js";
 import { handleIndexTool } from "../../src/tools/index-tools.js";
@@ -140,4 +141,26 @@ describe.skipIf(!isDockerAvailable())("Git refresh with real Git, embeddings, Qd
     expect((await hashes())?.has("offline.ts")).toBe(true);
     expect(isWatching(fixture.root)).toBe(false);
   });
+
+  it("cleans abandoned symbol generations on an unchanged Git-mode restart without rebuilding the active graph", async () => {
+    stopAllGitRefreshes();
+    const projectId = identity();
+    const meta = await loadSymbolGraphMeta(projectId);
+    const payload = await loadFilePayload(projectId, "main.ts");
+    expect(meta?.generation).toBeTruthy();
+    if (!payload) throw new Error("Indexed main.ts symbol payload is missing");
+    await saveFilePayload(projectId, payload, "abandoned-fixture-generation");
+    expect(await listStoredGenerations(projectId)).toContain("abandoned-fixture-generation");
+
+    vi.stubEnv("SOCRATICODE_AUTO_RESUME", "off");
+    await autoResumeIndexedProjects(fixture.root);
+    expect(await listStoredGenerations(projectId)).toContain("abandoned-fixture-generation");
+
+    vi.stubEnv("SOCRATICODE_AUTO_RESUME", "");
+    await autoResumeIndexedProjects(fixture.root);
+    await settled("detached HEAD");
+    expect((await loadSymbolGraphMeta(projectId))?.generation).toBe(meta?.generation);
+    expect(await listStoredGenerations(projectId)).not.toContain("abandoned-fixture-generation");
+    expect(await loadFilePayload(projectId, "main.ts")).toEqual(payload);
+  });
 });
```

**File**: `tests/unit/git-refresh.test.ts` (modified, +29/-0)
```diff
@@ -68,6 +68,35 @@ describe("Git refresh lifecycle with real checkout transitions", () => {
     expect(mocks.update).toHaveBeenCalledTimes(1);
   });
 
+  it("preserves a transition to an existing index when initial registration found no collection", async () => {
+    vi.stubEnv("SOCRATICODE_AUTO_RESUME", "off");
+    vi.stubEnv("SOCRATICODE_BRANCH_AWARE", "true");
+    mocks.info.mockResolvedValueOnce(null);
+    await checkGitRefresh(fixture.root);
+    expect(mocks.update).not.toHaveBeenCalled();
+    git(fixture.root, "checkout", "-b", "already-indexed");
+    await checkGitRefresh(fixture.root);
+    await vi.waitFor(() => expect(gitRefreshStatus(fixture.root)).toContain("synchronized"));
+    expect(mocks.update).toHaveBeenCalledTimes(1);
+    expect(mocks.update.mock.lastCall?.[3]).toMatchObject({
+      projectId: gitProjectId(fixture.root, await readGitState(fixture.root)), allowCreate: false,
+    });
+  });
+
+  it("returns the startup identity captured before an in-flight checkout change", async () => {
+    vi.stubEnv("SOCRATICODE_BRANCH_AWARE", "true");
+    const originalIdentity = gitProjectId(fixture.root, await readGitState(fixture.root));
+    let release: () => void = () => {};
+    mocks.update.mockImplementationOnce(async () => { await new Promise<void>((resolve) => { release = resolve; }); return success; });
+    const resumed = resumeGitRefresh(fixture.root);
+    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
+    git(fixture.root, "checkout", "-b", "during-startup");
+    await checkGitRefresh(fixture.root);
+    release();
+    expect(await resumed).toBe(originalIdentity);
+    expect(gitRefreshStatus(fixture.root)).toContain("FAILED");
+  });
+
   it("allows a registered branch-aware checkout to acquire a new branch index", async () => {
     vi.stubEnv("SOCRATICODE_BRANCH_AWARE", "true");
     await synchronize();
```

**File**: `tests/unit/startup.test.ts` (modified, +28/-0)
```diff
@@ -18,6 +18,19 @@ vi.mock("../../src/services/git-refresh.js", () => ({
   stopAllGitRefreshes: vi.fn(),
 }));
 
+const graphCleanup = vi.hoisted(() => ({
+  active: vi.fn(() => false),
+  coordinate: vi.fn(async (_id: string, work: () => Promise<void>) => work()),
+  load: vi.fn(),
+  clean: vi.fn(),
+}));
+vi.mock("../../src/services/code-graph.js", () => ({ isGraphBuildInProgress: graphCleanup.active }));
+vi.mock("../../src/services/symbol-graph-store.js", () => ({
+  coordinateProject: graphCleanup.coordinate,
+  loadSymbolGraphMeta: graphCleanup.load,
+  cleanStaleGenerations: graphCleanup.clean,
+}));
+
 vi.mock("../../src/services/qdrant.js", () => ({
   listCodebaseCollections: vi.fn(),
   getProjectMetadata: vi.fn(),
@@ -97,6 +110,7 @@ const TEST_PROJECT = "/tmp/test-project";
 
 beforeEach(() => {
   vi.clearAllMocks();
+  graphCleanup.load.mockReset().mockResolvedValue(null);
   // Default: Docker and Qdrant are running
   mockIsDockerAvailable.mockResolvedValue(true);
   mockIsQdrantRunning.mockResolvedValue(true);
@@ -110,6 +124,20 @@ beforeEach(() => {
 // ── autoResumeIndexedProjects ────────────────────────────────────────────
 
 describe("autoResumeIndexedProjects", () => {
+  it("cleans stale generations using the identity captured by Git startup catch-up", async () => {
+    vi.stubEnv("SOCRATICODE_WATCHER", "git");
+    mockListCollections.mockResolvedValue([collectionName(projectIdFromPath(TEST_PROJECT))]);
+    vi.mocked(resumeGitRefresh).mockResolvedValueOnce("captured-startup-identity");
+    graphCleanup.load.mockResolvedValueOnce({ generation: "active-generation" });
+    try {
+      await autoResumeIndexedProjects(TEST_PROJECT);
+      expect(graphCleanup.coordinate).toHaveBeenCalledWith("captured-startup-identity", expect.any(Function));
+      expect(graphCleanup.load).toHaveBeenCalledWith("captured-startup-identity");
+      expect(graphCleanup.clean).toHaveBeenCalledWith("captured-startup-identity", "active-generation");
+      expect(graphCleanup.coordinate.mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(resumeGitRefresh).mock.invocationCallOrder[0]);
+    } finally { vi.unstubAllEnvs(); }
+  });
+
   it("resumes Git monitoring only for existing indexes, and off still prevents startup work", async () => {
     vi.stubEnv("SOCRATICODE_WATCHER", "git");
     mockListCollections.mockResolvedValue([collectionName(projectIdFromPath(TEST_PROJECT))]);
```

---

### Incident Patch 4: `f51c05ec` (2026-09-24)
**Commit Message**: Merge pull request #187 from gregoryfoster/fix/185-php-scoped-call-qualifiers

fix(graph): resolve PHP static calls and class references by the class they name

**File**: `src/services/graph-php-case.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: AGPL-3.0-only
+// Copyright (C) 2026 Giancarlo Erra - Altaire Limited
+
+/**
+ * PHP's own identifier case folding, which is ASCII-only.
+ *
+ * `String.prototype.toLowerCase` is Unicode-aware and PHP is not: `class É {}`
+ * followed by `new é()` fails with `Class "é" not found`, while `Widget` and
+ * `WIDGET` are the same class. The difference is not academic here, because a
+ * non-ASCII character can fold INTO ASCII — `toLowerCase("\u212a")` (KELVIN SIGN) is `"k"` —
+ * so a Unicode fold would let an ordinary ASCII reference match an alias
+ * declared with a character PHP considers unrelated, drawing an edge the
+ * runtime never would.
+ *
+ * In a module of its own because the extractor and the resolver both need it,
+ * and the resolver should not load the whole extractor, and its native parser
+ * binding, for one line.
+ */
+export const phpFoldCase = (name: string): string => name.replace(/[A-Z]+/g, (m) => m.toLowerCase());
```

**File**: `src/services/graph-symbol-resolution.ts` (modified, +134/-0)
```diff
@@ -28,6 +28,7 @@
 
 import { GODOT_BUILTIN_CLASSES, GODOT_BUILTIN_FUNCTIONS } from "../constants.js";
 import type { CodeGraph, SymbolEdge, SymbolNode } from "../types.js";
+import { phpFoldCase } from "./graph-php-case.js";
 import type { RustUseBinding } from "./graph-symbols.js";
 
 /** Symbol-resolution metadata isolated to one Godot project root. */
@@ -210,6 +211,72 @@ function resolveDepFile(callerFile: string, sourceModule: string, deps: string[]
   return null;
 }
 
+/**
+ * The key a qualified PHP edge and the symbol it names meet on.
+ *
+ * Built from an owner in either of the two forms {@link SymbolNode.phpOwner}
+ * documents, and the name declared under it. A namespace prefix owns classes,
+ * so the key is the class's whole name — `\app\models\invoice` — folded
+ * throughout, since PHP matches class and namespace names
+ * ASCII-case-insensitively and `new \App\models\INVOICE()` names the class
+ * declared as `App\Models\Invoice`. A class owns methods, so the key is the
+ * folded class name, `::`, and the method name exactly as written, which is
+ * how every other call in this resolver is matched. The `::` keeps the two
+ * forms apart: a namespace qualifier can never reach a method, nor a class
+ * qualifier a class.
+ *
+ * @param owner A `phpOwner` or a PHP edge's `calleeQualifier`.
+ * @param name The symbol's name, or the edge's `calleeName`.
+ */
+function phpOwnedKey(owner: string, name: string): string {
+  const folded = phpFoldCase(owner);
+  return folded.endsWith("\\") ? `${folded}${phpFoldCase(name)}` : `${folded}::${name}`;
+}
+
+/**
+ * The static method a call on `cls` runs, found where PHP looks for it.
+ *
+ * The class's own methods first. Failing those, the traits it uses — each
+ * trait's own methods, then the traits that trait uses — since a trait's method
+ * overrides an inherited one; then the class it extends, searched the same way.
+ * Only inheritance the index can verify is followed: a class or trait's
+ * ancestors are searched only when exactly one declaration of it is found
+ * under its exact qualified name, nearest first. So an ancestor outside the
+ * project ends the search rather than widening it; a class declared twice at
+ * the same reach — the same name in two packages of one repository — is not
+ * guessed between, since the two can inherit from different classes; and a
+ * method no ancestor declares is not found at all. An `abstract`
+ * declaration has no owner, so the search passes it by for the implementation
+ * PHP runs. Two traits that both declare the method are both returned, since
+ * which one PHP runs depends on an `insteadof` the index does not read.
+ *
+ * @param cls The class the call names, in the form `SymbolNode.phpOwner` uses for one.
+ * @param method The method name, matched exactly.
+ * @param found The ids declared under a {@link phpOwnedKey}, nearest first.
+ * @param classLikeById The PHP classes and traits by id.
+ */
+function phpInheritedFrom(
+  cls: string,
+  method: string,
+  found: (key: string) => readonly string[],
+  classLikeById: ReadonlyMap<string, SymbolNode>,
+  seen: Set<string> = new Set(),
+): string[] {
+  const folded = phpFoldCase(cls);
+  if (seen.has(folded)) return [];
+  seen.add(folded);
+  const own = found(phpOwnedKey(cls, method));
+  if (own.length > 0) return [...own];
+  const cut = cls.lastIndexOf("\\") + 1;
+  const declarations = found(phpOwnedKey(cls.slice(0, cut), cls.slice(cut)));
+  const declared = declarations.length === 1 ? classLikeById.get(declarations[0]) : undefined;
+  if (!declared) return [];
+  const viaTraits = (declared.phpTraits ?? [])
+    .flatMap((t) => phpInheritedFrom(t, method, found, classLikeById, seen));
+  if (viaTraits.length > 0) return viaTraits;
+  return declared.phpExtends ? phpInheritedFrom(declared.phpExtends, method, found, classLikeById, seen) : [];
+}
+
 /**
  * Resolve all call sites for every file in `symbolsByFile`. Mutates the
  * passed-in `outgoingCallsByFi
```

**File**: `src/services/graph-symbols.ts` (modified, +378/-176)
```diff
@@ -11,6 +11,7 @@ import { Lang, parse } from "@ast-grep/napi";
 import { getLanguageFromExtension } from "../constants.js";
 import type { EdgeKind, SymbolEdge, SymbolKind, SymbolNode } from "../types.js";
 import { analyzeElixirTemplate, isElixirTemplateExtension } from "./elixir-templates.js";
+import { phpFoldCase } from "./graph-php-case.js";
 import { logger } from "./logger.js";
 import { gdscriptParserAvailable } from "./parser-availability.js";
 
@@ -1648,7 +1649,7 @@ const PHP_IDENTIFIER_PART = `${PHP_IDENTIFIER_START}0-9`;
  * both sides read the name whole and it resolves.
  *
  * Both PHP name guards in this file are built from this one source, so they
- * cannot drift apart: {@link phpTypeRefName} tests a whole name against
+ * cannot drift apart: {@link phpClassRef} tests a whole name against
  * {@link PHP_IDENTIFIER}, and {@link extractCalleeNamePhp} takes the name a
  * receiver ends with through {@link PHP_IDENTIFIER_TAIL}. `graph-resolution.ts`
  * states the same rule again for the file-import graph, which reads PHP
@@ -2670,6 +2671,13 @@ interface PhpAliasEntry {
   readonly offset: number;
   /** Imported short name. */
   readonly imported: string;
+  /**
+   * The whole imported name, unrooted: `Illuminate\Http\Request`. A grouped
+   * `use A\B\{C, D}` carries its `A\B` prefix on the declaration rather than
+   * the clause, and it is folded in here, so every entry spells its target in
+   * full however the `use` was written.
+   */
+  readonly path: string;
 }
 
 /**
@@ -2690,23 +2698,21 @@ interface PhpAliasEntry {
 type PhpAliasTable = Map<string, PhpAliasEntry[]>;
 
 /**
- * (local spelling, reference offset) → the imported short name in force there,
- * or undefined where nothing imports that spelling.
+ * What a PHP file's namespace declarations and `use` imports say a name means
+ * at a given position — the two things PHP's name resolution reads.
  */
-type PhpAliasLookup = (local: string, offset: number) => string | undefined;
-
-/**
- * PHP's own identifier case folding, which is ASCII-only.
- *
- * `String.prototype.toLowerCase` is Unicode-aware and PHP is not: `class É {}`
- * followed by `new é()` fails with `Class "é" not found`, while `Widget` and
- * `WIDGET` are the same class. The difference is not academic here, because a
- * non-ASCII character can fold INTO ASCII — `toLowerCase("\u212a")` (KELVIN SIGN) is `"k"` —
- * so a Unicode fold would let an ordinary ASCII reference match an alias
- * declared with a character PHP considers unrelated, drawing an edge the
- * runtime never would.
- */
-const phpFoldCase = (name: string): string => name.replace(/[A-Z]+/g, (m) => m.toLowerCase());
+interface PhpNames {
+  /**
+   * (local spelling, reference offset) → the import in force there, or
+   * undefined where nothing imports that spelling.
+   */
+  importAt(local: string, offset: number): PhpAliasEntry | undefined;
+  /**
+   * The namespace in force at an offset, unrooted and without a trailing `\`
+   * (`App\Http`), and `""` outside every namespace — the global one.
+   */
+  namespaceAt(offset: number): string;
+}
 
 /** Record one `use` clause's import under its local spelling, case-folded. */
 function phpAliasAdd(table: PhpAliasTable, local: string, entry: PhpAliasEntry): void {
@@ -2728,7 +2734,7 @@ function phpAliasAt(
   table: PhpAliasTable,
   local: string,
   offset: number,
-): string | undefined {
+): PhpAliasEntry | undefined {
   const entries = table.get(phpFoldCase(local));
   if (!entries) return undefined;
   let best: PhpAliasEntry | undefined;
@@ -2737,59 +2743,92 @@ function phpAliasAt(
       best = entry;
     }
   }
-  return best?.imported;
+  return best;
+}
+
+/**
+ * A PHP class reference, resolved the way the runtime resolves it.
+ *
+ * `calleeName` is the short name the class is declared under, which is what
+ * PHP symbols are indexed by; `localAlias` is the spelling written, when a
+ * `use` made the two differ; `fqcn` is the whole name, unrooted
```

**File**: `src/types.ts` (modified, +40/-0)
```diff
@@ -140,6 +140,38 @@ export interface SymbolNode {
   typeName?: string;
   /** True only for a GDScript `class_name` declaration, never an inner class. */
   isGdscriptClassName?: boolean;
+  /**
+   * PHP only: the fully qualified name of what declares this symbol, which a
+   * qualified PHP edge's `calleeQualifier` is matched against.
+   *
+   * A method's owner is its class, interface, trait or enum, written as that
+   * class's name: `\App\Models\Invoice`. A class, interface or trait is owned
+   * by its namespace, written as a namespace prefix with the trailing `\` PHP
+   * itself uses for one: `\App\Models\`, and `\` for the global namespace. The
+   * two forms cannot collide, so a qualifier naming a class answers only its
+   * methods and one naming a namespace only its classes.
+   *
+   * Absent for every other language, for a method of an anonymous class —
+   * which no qualified name can reach — for an `abstract` method, which no
+   * call runs, and for every graph persisted before it existed. The symbol's
+   * `id` and `qualifiedName` are unchanged by it.
+   */
+  phpOwner?: string;
+  /**
+   * PHP classes only: the class this one `extends`, as a fully qualified class
+   * name in the form {@link phpOwner} uses for one (`\App\Models\Model`).
+   * Resolution follows it when a static call names this class and the class
+   * does not declare the method itself. Absent when the class extends nothing,
+   * or names its parent in a way the extractor cannot read statically.
+   */
+  phpExtends?: string;
+  /**
+   * PHP classes and traits only: the traits this one `use`s in its body, as
+   * fully qualified class names, in the order they are written. Followed
+   * before {@link phpExtends}, since a trait's method overrides an inherited
+   * one. Absent when there are none.
+   */
+  phpTraits?: string[];
 }
 
 /** Kind of relationship an edge represents */
@@ -187,6 +219,14 @@ export interface SymbolEdge {
    * 191 symbols on tokio, so a qualified call matched by name would either
    * pick one arbitrarily or list them all. With the qualifier, resolution can
    * narrow to the scope the call actually names, or say it could not.
+   *
+   * PHP writes it already resolved under the file's namespace and `use`
+   * imports, in the two forms {@link SymbolNode.phpOwner} uses: the class a
+   * static call names (`\App\Models\Invoice` for `Invoice::capture()`), or the
+   * namespace a class reference names (`\App\Models\` for `extends Invoice`,
+   * a type hint or `new Invoice()`). Absent on every PHP call it cannot
+   * qualify statically — `$obj->m()`, `$class::m()`, `Cls::$m()`, `self::`,
+   * `static::`, `parent::` and bare function calls.
    */
   calleeQualifier?: string;
   callSite: { file: string; line: number };
```

**File**: `tests/unit/code-graph-php-scoped-qualifiers.test.ts` (added, +582/-0)
```diff
@@ -0,0 +1,582 @@
+// SPDX-License-Identifier: AGPL-3.0-only
+// Copyright (C) 2026 Giancarlo Erra - Altaire Limited
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import path from "node:path";
+import { afterAll, beforeAll, describe, expect, it } from "vitest";
+import { buildCodeGraph } from "../../src/services/code-graph.js";
+import { resolveCallSites } from "../../src/services/graph-symbol-resolution.js";
+import type { SymbolEdge } from "../../src/types.js";
+
+/**
+ * PHP qualified calls and class references through the real `buildCodeGraph`
+ * + `resolveCallSites` pass.
+ *
+ * The extractor tests prove the qualifier is written; the resolver tests prove
+ * it is matched. Only a real build proves both meet on the symbols a real
+ * extraction produces, with the dependencies the file graph actually draws.
+ * The two reproductions from the issue are here as filed, and a controller
+ * that declares a `capture()` of its own calls four other `capture()`s — one
+ * of them on a class the project does not have. A small model hierarchy covers
+ * static methods a class inherits rather than declares.
+ */
+describe("PHP qualified edges in a real graph", () => {
+  let root: string;
+  let graph: Awaited<ReturnType<typeof buildCodeGraph>>;
+
+  const write = (rel: string, body: string): void => {
+    const abs = path.join(root, rel);
+    mkdirSync(path.dirname(abs), { recursive: true });
+    writeFileSync(abs, body);
+  };
+
+  const CONTROLLER = "src/Http/Controller.php";
+  const ACCOUNTS = "src/Http/Accounts.php";
+  const POSTS = "src/Http/Posts.php";
+
+  /** The single edge `caller` emits under one name and kind, failing loudly if there is not exactly one. */
+  const edgeFrom = (file: string, caller: string, name: string, kind: SymbolEdge["kind"] = "call"): SymbolEdge => {
+    const found = (graph.outgoingCallsByFile.get(file) ?? [])
+      .filter((e) => e.callerId.includes(`::${caller}#`) && e.calleeName === name && e.kind === kind);
+    expect(found, `expected one ${kind} edge to ${name} from ${caller} in ${file}`).toHaveLength(1);
+    return found[0];
+  };
+
+  /** The id of the one symbol `file` declares under `name`, owned by `owner`. */
+  const idOf = (file: string, name: string, owner: string): string => {
+    const found = (graph.symbolsByFile.get(file) ?? []).filter((s) => s.name === name && s.phpOwner === owner);
+    expect(found, `expected one ${name} owned by ${owner} in ${file}`).toHaveLength(1);
+    return found[0].id;
+  };
+
+  /** Every edge in the graph that resolves into `file`. */
+  const into = (file: string): SymbolEdge[] =>
+    [...graph.outgoingCallsByFile.values()]
+      .flat()
+      .filter((e) => (e.calleeCandidates ?? []).some((id) => id.startsWith(`${file}::`)));
+
+  beforeAll(async () => {
+    root = mkdtempSync(path.join(tmpdir(), "socraticode-php-qualifiers-"));
+    write("composer.json", JSON.stringify({ autoload: { "psr-4": { "App\\": "src/" } } }));
+
+    // Two classes with a same-named static method, both reachable from the
+    // controller, and a third named `Request` that is not Illuminate's.
+    for (const cls of ["Invoice", "Order", "Request"]) {
+      write(`src/Models/${cls}.php`, `<?php
+
+namespace App\\Models;
+
+class ${cls}
+{
+    public static function capture(): void
+    {
+    }
+}
+`);
+    }
+
+    write(CONTROLLER, `<?php
+
+namespace App\\Http;
+
+use Illuminate\\Http\\Request;
+use App\\Models\\Invoice;
+use App\\Models\\Invoice as Bill;
+use App\\Models\\Order;
+use App\\Models\\Request as RequestModel;
+
+class Controller
+{
+    public function capture(): void
+    {
+    }
+
+    public function external(): void
+    {
+        Request::capture();
+    }
+
+    public function bill(): void
+    {
+        Invoice::capture();
+    }
+
+    public function viaAlias(): void
+    {
+        Bill::capture();
+    }
+
+    public function viaFqcn(): void
+    {
+        \\App\\
```

---

### Incident Patch 5: `0b97f46a` (2026-09-24)
**Commit Message**: fix(graph): leave a PHP static call on a variable method unqualified

`Invoice::$m()` runs whatever method `$m` holds, but the callee scan reads
it as a call to `m`, and with the class as its qualifier that guess
resolved with confidence to a method that happens to be called `m`. A
static call is now qualified only when its method is written as a name.
The name the scan reads is unchanged.

**File**: `src/services/graph-symbols.ts` (modified, +6/-2)
```diff
@@ -3180,9 +3180,13 @@ function extractFromPhp(
   // carries the class it names as its qualifier. Everything else is left
   // unqualified and resolves as it always has — `$class::m()`, and `self::`,
   // `static::` and `parent::`, which are answered by the class the call sits
-  // in and are outside this change.
+  // in and are outside this change. So is a method written as a variable:
+  // `Invoice::$m()` runs whatever method `$m` holds, and qualified, the name
+  // the callee scan reads from it would resolve with confidence to a method
+  // that happens to be called `m`.
   // biome-ignore lint/suspicious/noExplicitAny: ast-grep node type leaks through
-  const staticCallQualifier = (node: any): string | undefined => classNameOf(node.field("scope"));
+  const staticCallQualifier = (node: any): string | undefined =>
+    node.field("name")?.kind() === "name" ? classNameOf(node.field("scope")) : undefined;
 
   // What a class or trait inherits static methods from, read from its own
   // declaration: the class a class `extends`, and the traits a class or trait
```

**File**: `src/types.ts` (modified, +2/-2)
```diff
@@ -225,8 +225,8 @@ export interface SymbolEdge {
    * static call names (`\App\Models\Invoice` for `Invoice::capture()`), or the
    * namespace a class reference names (`\App\Models\` for `extends Invoice`,
    * a type hint or `new Invoice()`). Absent on every PHP call it cannot
-   * qualify statically — `$obj->m()`, `$class::m()`, `self::`, `static::`,
-   * `parent::` and bare function calls.
+   * qualify statically — `$obj->m()`, `$class::m()`, `Cls::$m()`, `self::`,
+   * `static::`, `parent::` and bare function calls.
    */
   calleeQualifier?: string;
   callSite: { file: string; line: number };
```

**File**: `tests/unit/graph-symbols-php-qualifiers.test.ts` (modified, +3/-0)
```diff
@@ -120,6 +120,9 @@ namespace B { class Two { function f() { Tool::run(); } } }
       ["`static::`", "class C { function f() { static::m(); } }"],
       ["`parent::`", "class C extends B { function f() { parent::m(); } }"],
       ["a class held in a variable", "function f($cls) { $cls::m(); }"],
+      // The callee scan reads `$m` as `m`, as it did before; only the
+      // qualifier, which would make that guess confident, is withheld.
+      ["a method held in a variable", "function f($m) { Invoice::$m(); }"],
       ["an instance call", "function f($o) { $o->m(); }"],
       ["a bare function call", "function f() { m(); }"],
       ["a qualified function call", "function f() { \\App\\m(); }"],
```

---

### Incident Patch 6: `77490323` (2026-09-24)
**Commit Message**: fix(graph): follow verified PHP inheritance for static calls

`Child::create()` runs a `create` declared on the class `Child` extends, or
on a trait it uses, and `main` resolved such a call correctly when the
caller also reached the parent by name. The qualified branch left it
unresolved.

Each PHP class and trait symbol now records the class it extends and the
traits it uses, resolved under the file's namespace and imports
(`SymbolNode.phpExtends`, `phpTraits`). When the named class does not
declare the method, resolution looks where PHP does: its traits, then its
parent, and on up the chain. It follows a class or trait only when exactly
one declaration of it is found under its exact qualified name, so a parent
outside the project ends the search, a class declared twice at the same
reach is not guessed between, and a method no ancestor declares stays
unresolved.

An `abstract` method is given no owner, since no call runs it: a trait's
abstract declaration does not shadow the implementation its class
inherits, and PHP runs the inherited one.

**File**: `src/services/graph-symbol-resolution.ts` (modified, +55/-5)
```diff
@@ -233,6 +233,50 @@ function phpOwnedKey(owner: string, name: string): string {
   return folded.endsWith("\\") ? `${folded}${phpFoldCase(name)}` : `${folded}::${name}`;
 }
 
+/**
+ * The static method a call on `cls` runs, found where PHP looks for it.
+ *
+ * The class's own methods first. Failing those, the traits it uses — each
+ * trait's own methods, then the traits that trait uses — since a trait's method
+ * overrides an inherited one; then the class it extends, searched the same way.
+ * Only inheritance the index can verify is followed: a class or trait's
+ * ancestors are searched only when exactly one declaration of it is found
+ * under its exact qualified name, nearest first. So an ancestor outside the
+ * project ends the search rather than widening it; a class declared twice at
+ * the same reach — the same name in two packages of one repository — is not
+ * guessed between, since the two can inherit from different classes; and a
+ * method no ancestor declares is not found at all. An `abstract`
+ * declaration has no owner, so the search passes it by for the implementation
+ * PHP runs. Two traits that both declare the method are both returned, since
+ * which one PHP runs depends on an `insteadof` the index does not read.
+ *
+ * @param cls The class the call names, in the form `SymbolNode.phpOwner` uses for one.
+ * @param method The method name, matched exactly.
+ * @param found The ids declared under a {@link phpOwnedKey}, nearest first.
+ * @param classLikeById The PHP classes and traits by id.
+ */
+function phpInheritedFrom(
+  cls: string,
+  method: string,
+  found: (key: string) => readonly string[],
+  classLikeById: ReadonlyMap<string, SymbolNode>,
+  seen: Set<string> = new Set(),
+): string[] {
+  const folded = phpFoldCase(cls);
+  if (seen.has(folded)) return [];
+  seen.add(folded);
+  const own = found(phpOwnedKey(cls, method));
+  if (own.length > 0) return [...own];
+  const cut = cls.lastIndexOf("\\") + 1;
+  const declarations = found(phpOwnedKey(cls.slice(0, cut), cls.slice(cut)));
+  const declared = declarations.length === 1 ? classLikeById.get(declarations[0]) : undefined;
+  if (!declared) return [];
+  const viaTraits = (declared.phpTraits ?? [])
+    .flatMap((t) => phpInheritedFrom(t, method, found, classLikeById, seen));
+  if (viaTraits.length > 0) return viaTraits;
+  return declared.phpExtends ? phpInheritedFrom(declared.phpExtends, method, found, classLikeById, seen) : [];
+}
+
 /**
  * Resolve all call sites for every file in `symbolsByFile`. Mutates the
  * passed-in `outgoingCallsByFile` edges in place.
@@ -306,8 +350,10 @@ export function resolveCallSites(
   // have an owner; a qualified PHP edge is answered from here and nowhere
   // else. The key is a whole qualified name, so it nearly always has one
   // declaration, and narrowing that to the caller's file or dependencies is a
-  // filter over it rather than an index of its own.
+  // filter over it rather than an index of its own. The classes and traits
+  // among them are kept by id too, for what they inherit from.
   const phpOwnedAnywhere = new Map<string, string[]>();
+  const phpClassLikeById = new Map<string, SymbolNode>();
   for (const [file, syms] of symbolsByFile.entries()) {
     const idx = new Map<string, SymbolNode[]>();
     for (const s of syms) {
@@ -318,6 +364,7 @@ export function resolveCallSites(
         const anywhere = phpOwnedAnywhere.get(key);
         if (anywhere) anywhere.push(s.id);
         else phpOwnedAnywhere.set(key, [s.id]);
+        if (s.kind === "class" || s.kind === "trait") phpClassLikeById.set(s.id, s);
       }
       if (s.name === "<module>") continue;
       const existing = idx.get(s.name);
@@ -1464,11 +1511,14 @@ export function resolveCallSites(
       // what finds a sibling class in the caller's own namespace, which PHP
       // needs no `use` for and the file graph therefore draws no edge to.
       //
-      // When nothing is found the edge is left `unresolv
```

**File**: `src/services/graph-symbols.ts` (modified, +128/-76)
```diff
@@ -3099,62 +3099,6 @@ function extractFromPhp(
     return undefined;
   };
 
-  for (const k of ["class_declaration", "interface_declaration", "trait_declaration"]) {
-    for (const cls of safeFindAll(root, k)) {
-      const nameNode = safeFind(cls, "name");
-      if (!nameNode) continue;
-      const name = nameNode.text();
-      const r = cls.range();
-      const startLine = r.start.line + 1;
-      const endLine = r.end.line + 1;
-      const sym: SymbolNode = {
-        id: makeId(file, name, startLine),
-        name, qualifiedName: name,
-        kind: k.includes("interface") ? "interface" : k.includes("trait") ? "trait" : "class",
-        file, line: startLine, endLine, language,
-        phpOwner: namespacePrefixAt(r.start.index),
-      };
-      symbols.push(sym);
-      scopes.push({ name, startLine, endLine, symbolId: sym.id });
-    }
-  }
-  // Each declaration's `return_type`, stashed by node kind as the symbols are
-  // read. These two kinds are walked here anyway, so asking `safeFindAll` for
-  // them again below re-walked the whole tree twice per file for nodes already
-  // in hand. Stashed rather than emitted: `pushTypeRef` attributes a reference
-  // to its innermost caller and so needs `scopes` complete, and the emission
-  // order — parameters and properties first, then methods, then functions —
-  // decides which of two same-key edges survives the dedupe, so it is kept
-  // exactly as it was. Collected above the name guard, because a declaration
-  // the guard skips still contributed its return type before.
-  // biome-ignore lint/suspicious/noExplicitAny: ast-grep node type leaks through
-  const returnTypes = new Map<string, any[]>();
-  for (const k of ["function_definition", "method_declaration"]) {
-    // biome-ignore lint/suspicious/noExplicitAny: ast-grep node type leaks through
-    const forKind: any[] = [];
-    returnTypes.set(k, forKind);
-    for (const m of safeFindAll(root, k)) {
-      const returnType = m.field("return_type");
-      if (returnType) forKind.push(returnType);
-      const nameNode = safeFind(m, "name");
-      if (!nameNode) continue;
-      const name = nameNode.text();
-      const r = m.range();
-      const startLine = r.start.line + 1;
-      const endLine = r.end.line + 1;
-      const owner = k === "method_declaration" ? ownerClassOf(m) : undefined;
-      const sym: SymbolNode = {
-        id: makeId(file, name, startLine),
-        name, qualifiedName: name,
-        kind: k === "function_definition" ? "function" : "method",
-        file, line: startLine, endLine, language,
-        ...(owner ? { phpOwner: owner } : {}),
-      };
-      symbols.push(sym);
-      scopes.push({ name, startLine, endLine, symbolId: sym.id });
-    }
-  }
-
   /**
    * Whether the parse handed back part of a type reference rather than all of it.
    *
@@ -3207,27 +3151,137 @@ function extractFromPhp(
     return false;
   };
 
-  // A static call's class, when it is written as a name: `Invoice::capture()`,
-  // `Models\Invoice::capture()`, `\App\Models\Invoice::capture()` or
-  // `namespace\Invoice::capture()`. Resolved under the file's namespace and
-  // imports into the class it names, which the edge carries as its qualifier.
-  //
-  // Everything else is left unqualified and resolves as it always has: a
-  // variable (`$class::m()`) or an expression names no class statically, and
-  // `self`, `static` and `parent` — a `relative_scope`, not a name — are
-  // answered by the class the call sits in, which is outside this change. So
-  // is a class name the parse cut short ({@link isSplitName}): qualified by
-  // the part that survived, it would name a class the source never writes.
+  // The class a node spells, read at its own offset, or null for a name the
+  // parse cut short ({@link isSplitName}) — qualified by the part that
+  // survived, it would name a class the source never writes — or one that
+  // names no class ({@link phpClassRef}).
   // bi
```

**File**: `src/types.ts` (modified, +18/-2)
```diff
@@ -152,10 +152,26 @@ export interface SymbolNode {
    * methods and one naming a namespace only its classes.
    *
    * Absent for every other language, for a method of an anonymous class —
-   * which no qualified name can reach — and for every graph persisted before
-   * it existed. The symbol's `id` and `qualifiedName` are unchanged by it.
+   * which no qualified name can reach — for an `abstract` method, which no
+   * call runs, and for every graph persisted before it existed. The symbol's
+   * `id` and `qualifiedName` are unchanged by it.
    */
   phpOwner?: string;
+  /**
+   * PHP classes only: the class this one `extends`, as a fully qualified class
+   * name in the form {@link phpOwner} uses for one (`\App\Models\Model`).
+   * Resolution follows it when a static call names this class and the class
+   * does not declare the method itself. Absent when the class extends nothing,
+   * or names its parent in a way the extractor cannot read statically.
+   */
+  phpExtends?: string;
+  /**
+   * PHP classes and traits only: the traits this one `use`s in its body, as
+   * fully qualified class names, in the order they are written. Followed
+   * before {@link phpExtends}, since a trait's method overrides an inherited
+   * one. Absent when there are none.
+   */
+  phpTraits?: string[];
 }
 
 /** Kind of relationship an edge represents */
```

**File**: `tests/unit/code-graph-php-scoped-qualifiers.test.ts` (modified, +215/-1)
```diff
@@ -17,7 +17,8 @@ import type { SymbolEdge } from "../../src/types.js";
  * extraction produces, with the dependencies the file graph actually draws.
  * The two reproductions from the issue are here as filed, and a controller
  * that declares a `capture()` of its own calls four other `capture()`s — one
- * of them on a class the project does not have.
+ * of them on a class the project does not have. A small model hierarchy covers
+ * static methods a class inherits rather than declares.
  */
 describe("PHP qualified edges in a real graph", () => {
   let root: string;
@@ -30,6 +31,8 @@ describe("PHP qualified edges in a real graph", () => {
   };
 
   const CONTROLLER = "src/Http/Controller.php";
+  const ACCOUNTS = "src/Http/Accounts.php";
+  const POSTS = "src/Http/Posts.php";
 
   /** The single edge `caller` emits under one name and kind, failing loudly if there is not exactly one. */
   const edgeFrom = (file: string, caller: string, name: string, kind: SymbolEdge["kind"] = "call"): SymbolEdge => {
@@ -165,6 +168,164 @@ class Schema
         );
     }
 }
+`);
+
+    // A model hierarchy. `User` declares nothing and inherits `create()` from
+    // `Model` and `boot()` from `Entity` above it; `Post` overrides `create()`
+    // and takes `slug()` from a trait. `Guarded` uses a trait that only
+    // requires the `create()` it inherits. `Legacy` extends a `Model` from
+    // outside the project, and `Report` is unrelated but declares a `find()`.
+    write("src/Inherit/Entity.php", `<?php
+
+namespace App\\Inherit;
+
+class Entity
+{
+    public static function boot(): void
+    {
+    }
+}
+`);
+    write("src/Inherit/Model.php", `<?php
+
+namespace App\\Inherit;
+
+class Model extends Entity
+{
+    public static function create(): void
+    {
+    }
+}
+`);
+    write("src/Inherit/User.php", `<?php
+
+namespace App\\Inherit;
+
+class User extends Model
+{
+}
+`);
+    write("src/Inherit/HasSlug.php", `<?php
+
+namespace App\\Inherit;
+
+trait HasSlug
+{
+    public static function slug(): string
+    {
+        return '';
+    }
+}
+`);
+    write("src/Inherit/Post.php", `<?php
+
+namespace App\\Inherit;
+
+class Post extends Model
+{
+    use HasSlug;
+
+    public static function create(): void
+    {
+    }
+}
+`);
+    write("src/Inherit/RequiresCreate.php", `<?php
+
+namespace App\\Inherit;
+
+trait RequiresCreate
+{
+    abstract public static function create(): void;
+}
+`);
+    write("src/Inherit/Guarded.php", `<?php
+
+namespace App\\Inherit;
+
+class Guarded extends Model
+{
+    use RequiresCreate;
+}
+`);
+    write("src/Inherit/Legacy.php", `<?php
+
+namespace App\\Inherit;
+
+class Legacy extends \\Illuminate\\Database\\Eloquent\\Model
+{
+}
+`);
+    write("src/Inherit/Report.php", `<?php
+
+namespace App\\Inherit;
+
+class Report
+{
+    public static function find(): void
+    {
+    }
+}
+`);
+    // The caller imports the parent as well as the child, so `main`'s name
+    // match reached `Model::create()` through the dependency scan: the one
+    // inherited call it answered correctly, and the case to keep.
+    write(ACCOUNTS, `<?php
+
+namespace App\\Http;
+
+use App\\Inherit\\Guarded;
+use App\\Inherit\\Legacy;
+use App\\Inherit\\Model;
+use App\\Inherit\\Report;
+use App\\Inherit\\User;
+
+class Accounts
+{
+    public function make(): void
+    {
+        User::create();
+    }
+
+    public function guarded(): void
+    {
+        Guarded::create();
+    }
+
+    public function boot(): void
+    {
+        User::boot();
+    }
+
+    public function lookup(): void
+    {
+        User::find();
+    }
+
+    public function legacy(): void
+    {
+        Legacy::create();
+    }
+}
+`);
+    write(POSTS, `<?php
+
+namespace App\\Http;
+
+use App\\Inherit\\Post;
+
+class Posts
+{
+    public function make(): void
+    {
+        Post::create();
+    }
+
+    public function slug(): string
+    {
+        return Post::slug();
+    }
+}
 `);
 
     graph = await buildCodeGraph(root);
@@ -251
```

**File**: `tests/unit/graph-symbol-resolution-php-qualified.test.ts` (modified, +151/-0)
```diff
@@ -196,3 +196,154 @@ describe("PHP qualified edges at the resolver", () => {
     expect(edge.confidence).toBe("local");
   });
 });
+
+/**
+ * A static method the named class inherits rather than declares, at the
+ * resolver. The class's own methods first, then its traits', then its
+ * parent's, and only through declarations the index holds.
+ */
+describe("PHP inherited static methods at the resolver", () => {
+  const CALLER = "src/Http/Caller.php";
+  const ENTITY = "src/Models/Entity.php";
+  const MODEL = "src/Models/Model.php";
+  const USER = "src/Models/User.php";
+  const POST = "src/Models/Post.php";
+  const TRAITS = "src/Models/Traits.php";
+  const LOOP = "src/Models/Loop.php";
+  const OTHER = "src/Other/Other.php";
+  const TWIN_A = "packages/a/Twin.php";
+  const TWIN_B = "packages/b/Twin.php";
+
+  const sym = (file: string, name: string, line: number, kind: SymbolNode["kind"], phpOwner: string, extra: Partial<SymbolNode> = {}): SymbolNode => ({
+    id: `${file}::${name}#${line}`,
+    name,
+    qualifiedName: name,
+    kind,
+    file,
+    line,
+    endLine: line + 3,
+    language: "php",
+    phpOwner,
+    ...extra,
+  });
+
+  const node = (relativePath: string, dependencies: string[]) => ({
+    relativePath,
+    imports: [],
+    exports: [],
+    dependencies,
+    dependents: [],
+  });
+
+  const graph: CodeGraph = {
+    nodes: [CALLER, ENTITY, MODEL, USER, POST, TRAITS, LOOP, OTHER, TWIN_A, TWIN_B].map((f) => node(f, f === CALLER ? [USER, POST, OTHER] : [])),
+    edges: [],
+  };
+
+  const NS = "\\App\\Models\\";
+  const symbols = (): Map<string, SymbolNode[]> => new Map([
+    [CALLER, [sym(CALLER, "Caller", 3, "class", "\\App\\Http\\"), sym(CALLER, "run", 5, "method", "\\App\\Http\\Caller")]],
+    [ENTITY, [sym(ENTITY, "Entity", 3, "class", NS), sym(ENTITY, "boot", 5, "method", `${NS}Entity`)]],
+    [MODEL, [
+      sym(MODEL, "Model", 3, "class", NS, { phpExtends: `${NS}Entity` }),
+      sym(MODEL, "create", 5, "method", `${NS}Model`),
+      sym(MODEL, "tag", 9, "method", `${NS}Model`),
+    ]],
+    [USER, [sym(USER, "User", 3, "class", NS, { phpExtends: `${NS}Model` })]],
+    [POST, [
+      sym(POST, "Post", 3, "class", NS, { phpExtends: `${NS}Model`, phpTraits: [`${NS}HasTag`, `${NS}HasSlug`] }),
+      sym(POST, "create", 5, "method", `${NS}Post`),
+    ]],
+    [TRAITS, [
+      sym(TRAITS, "HasTag", 3, "trait", NS, { phpTraits: [`${NS}Nested`] }),
+      sym(TRAITS, "tag", 5, "method", `${NS}HasTag`),
+      sym(TRAITS, "HasSlug", 10, "trait", NS),
+      sym(TRAITS, "tag", 12, "method", `${NS}HasSlug`),
+      sym(TRAITS, "Nested", 17, "trait", NS),
+      sym(TRAITS, "deep", 19, "method", `${NS}Nested`),
+    ]],
+    [LOOP, [
+      sym(LOOP, "Ping", 3, "class", NS, { phpExtends: `${NS}Pong` }),
+      sym(LOOP, "Pong", 8, "class", NS, { phpExtends: `${NS}Ping` }),
+    ]],
+    [OTHER, [
+      sym(OTHER, "Other", 3, "class", "\\App\\Other\\", { phpExtends: "\\Vendor\\Model" }),
+      sym(OTHER, "Unrelated", 8, "class", "\\App\\Other\\"),
+      sym(OTHER, "find", 10, "method", "\\App\\Other\\Unrelated"),
+    ]],
+    // One class name in two packages of the same repository, neither in the
+    // caller's reach. Only one inherits a `create`.
+    [TWIN_A, [sym(TWIN_A, "Twin", 3, "class", NS, { phpExtends: `${NS}Model` })]],
+    [TWIN_B, [sym(TWIN_B, "Twin", 3, "class", NS)]],
+  ]);
+
+  const resolve = (calleeName: string, calleeQualifier: string): SymbolEdge => {
+    const edge: SymbolEdge = {
+      callerId: `${CALLER}::run#5`,
+      calleeName,
+      calleeCandidates: [],
+      confidence: "unresolved",
+      kind: "call",
+      calleeQualifier,
+      callSite: { file: CALLER, line: 6 },
+    };
+    resolveCallSites(graph, symbols(), new Map([[CALLER, [edge]]]));
+    return edge;
+  };
+
+  it("resolves a method the class inherits to the parent that declares it", () => {
+    const edge = resolve("create", `${NS}User`);
+    expect(edge.calleeCandid
```

---

### Incident Patch 7: `258fe802` (2026-09-24)
**Commit Message**: fix(graph): find a qualified PHP class by its exact name outside the caller's dependencies

A class in the caller's own namespace needs no `use`, so the file graph
draws no edge to it, and the issue's `Schema::all()` reproduction left
`UserSchema::all()` and `OrderSchema::all()` unresolved. A qualified PHP
edge now searches the rest of the project after the caller's own file and
its dependencies. The key is the whole qualified name, so the wider search
reaches only the class the source names, never a same-named method or
class elsewhere.

The owned symbols are indexed once, project-wide; the caller's file and
dependencies are a filter over a key's declarations, which a whole
qualified name nearly always holds one of.

The real-build test asserts the two expected edges in the original fixture,
and the imported variant it no longer needs is dropped.

**File**: `src/services/graph-symbol-resolution.ts` (modified, +38/-27)
```diff
@@ -301,25 +301,23 @@ export function resolveCallSites(
   // other: `const Config` cannot qualify `Config::run()`, so the file that
   // declares it is not an answer.
   const kindOfSymbolId = new Map<string, SymbolNode["kind"]>();
-  // file → {@link phpOwnedKey} → the ids of the PHP symbols declared under
-  // that owner and name. Holds PHP symbols only, and only those that have an
-  // owner; a qualified PHP edge is answered from here and nowhere else.
-  const phpOwnedByFile = new Map<string, Map<string, string[]>>();
+  // {@link phpOwnedKey} → the ids of the PHP symbols declared under that
+  // owner and name, project-wide. Holds PHP symbols only, and only those that
+  // have an owner; a qualified PHP edge is answered from here and nowhere
+  // else. The key is a whole qualified name, so it nearly always has one
+  // declaration, and narrowing that to the caller's file or dependencies is a
+  // filter over it rather than an index of its own.
+  const phpOwnedAnywhere = new Map<string, string[]>();
   for (const [file, syms] of symbolsByFile.entries()) {
     const idx = new Map<string, SymbolNode[]>();
     for (const s of syms) {
       fileOfSymbolId.set(s.id, file);
       kindOfSymbolId.set(s.id, s.kind);
       if (s.phpOwner !== undefined) {
-        let owned = phpOwnedByFile.get(file);
-        if (!owned) {
-          owned = new Map();
-          phpOwnedByFile.set(file, owned);
-        }
         const key = phpOwnedKey(s.phpOwner, s.name);
-        const ids = owned.get(key);
-        if (ids) ids.push(s.id);
-        else owned.set(key, [s.id]);
+        const anywhere = phpOwnedAnywhere.get(key);
+        if (anywhere) anywhere.push(s.id);
+        else phpOwnedAnywhere.set(key, [s.id]);
       }
       if (s.name === "<module>") continue;
       const existing = idx.get(s.name);
@@ -1289,6 +1287,21 @@ export function resolveCallSites(
       cachedCallerSceneEntries ??= sceneEntriesForCaller(callerFile, callerGodotRoot);
       return cachedCallerSceneEntries;
     };
+    // The ids declared under a {@link phpOwnedKey}, nearest first: those in the
+    // caller's own file, else those in its dependencies, else every one in the
+    // project. A key the project does not declare at all — the common case for
+    // a vendor class (`DB::table()`) — is answered by the first lookup.
+    let callerDeps: Set<string> | undefined;
+    const phpFound = (key: string): readonly string[] => {
+      const anywhere = phpOwnedAnywhere.get(key);
+      if (!anywhere) return [];
+      const local = anywhere.filter((id) => fileOfSymbolId.get(id) === callerFile);
+      if (local.length > 0) return local;
+      callerDeps ??= new Set(deps);
+      const depFiles = callerDeps;
+      const inDeps = anywhere.filter((id) => depFiles.has(fileOfSymbolId.get(id) ?? ""));
+      return inDeps.length > 0 ? inDeps : anywhere;
+    };
 
     for (const edge of edges) {
       const callLine = edge.callSite.line;
@@ -1444,24 +1457,22 @@ export function resolveCallSites(
       // the caller declares an `all` too, but its owner is `Schema` — and stops
       // `Request::capture()` from reaching a same-named `Invoice::capture()`.
       //
-      // The owner is required before the same-file branch and before the
-      // dependency scan, which are searched in that order as they are for
-      // every other edge. When neither holds a match the edge is left
-      // `unresolved` with no candidates: falling back to the method name alone
-      // is exactly how the wrong-class edges were drawn.
+      // The caller's own file is searched first, then its dependencies, as for
+      // every other edge, and then the rest of the project. That last step is
+      // not the name guessing this branch exists to stop: the key is the whole
+      // qualified name, so it can only reach the class the source names. It is
+      // what finds a sibling class in the caller's own namespace, which PHP
+      // needs no `use` for an
```

**File**: `src/services/graph-symbols.ts` (modified, +6/-11)
```diff
@@ -3258,18 +3258,13 @@ function extractFromPhp(
   // is deliberate. Resolution's module-targeted branch matches `sourceModule`
   // as a *path*; a PHP FQCN is not one, so handing it a backslashed name
   // strands the edge as `unresolved`. Each edge carries its namespace as
-  // `calleeQualifier` instead, and resolution's PHP branch matches it against
-  // the owners declared in the caller's own file and then its resolved
-  // file-import dependencies — for PHP exactly what the `use`/require, PSR-4
-  // and FQCN machinery produced. The search is therefore confined to this
-  // file's own import closure by construction, rather than guessing a short
-  // name repository-wide.
+  // `calleeQualifier` instead, and resolution's PHP branch matches the whole
+  // qualified class against the owners declared in the caller's own file, its
+  // resolved file-import dependencies, and then the rest of the project. That
+  // last step is what reaches an inline FQCN, or a sibling in the caller's own
+  // namespace, that no `use` or require puts in the file graph; it cannot
+  // guess, because it matches the qualified name rather than a short one.
   //
-  // Known limitation, not a bug to fix here: an inline FQCN with no matching
-  // `use` or require produces no file-import dependency, so the scan cannot
-  // reach it and the edge stays `unresolved`. That is the honest outcome —
-  // the only alternative is the repository-wide short-name guessing this is
-  // built to avoid.
   // Aliases are resolved per namespace, not per file: see
   // {@link buildPhpNames} for why a file-wide table fabricates an edge in a
   // file that opens more than one namespace. The same `names()` the symbols
```

**File**: `tests/unit/code-graph-php-scoped-qualifiers.test.ts` (modified, +7/-46)
```diff
@@ -155,40 +155,6 @@ class ${cls}
 
 namespace App\\Schema;
 
-class Schema
-{
-    public static function all(): array
-    {
-        return array_merge(
-            UserSchema::all(),
-            OrderSchema::all(),
-        );
-    }
-}
-`);
-
-    // The same schemas, imported, so the dependency scan reaches them.
-    for (const cls of ["UserSchema", "OrderSchema"]) {
-      write(`src/Imported/${cls}.php`, `<?php
-
-namespace App\\Imported;
-
-class ${cls}
-{
-    public static function all(): array
-    {
-        return [];
-    }
-}
-`);
-    }
-    write("src/Imported/Schema.php", `<?php
-
-namespace App\\Imported;
-
-use App\\Imported\\OrderSchema;
-use App\\Imported\\UserSchema;
-
 class Schema
 {
     public static function all(): array
@@ -272,20 +238,15 @@ class Schema
       expect(edge[0].confidence).not.toBe("local");
     });
 
-    it("leaves both unresolved, since nothing puts the sibling schemas in reach", () => {
-      // Same namespace and no `use`, so the file graph draws no edge to them.
-      // `unresolved` is the honest answer; the self-edge was a wrong one.
+    it.each(["UserSchema", "OrderSchema"])("resolves `%s::all()` to its own class's `all()`", (cls) => {
+      // Same namespace and no `use`, so PHP needs no import and the file graph
+      // draws no edge to the siblings. The qualified class is found by its
+      // exact name all the same.
       expect(graph.edges.filter((e) => e.source === SCHEMA)).toEqual([]);
-      for (const e of graph.outgoingCallsByFile.get(SCHEMA) ?? []) {
-        if (e.calleeName === "all") expect(e.confidence).toBe("unresolved");
-      }
-    });
-
-    it.each(["UserSchema", "OrderSchema"])("resolves `%s::all()` to its own class once it is imported", (cls) => {
-      const edge = (graph.outgoingCallsByFile.get("src/Imported/Schema.php") ?? [])
-        .filter((e) => e.calleeName === "all" && e.calleeQualifier === `\\App\\Imported\\${cls}`);
+      const edge = (graph.outgoingCallsByFile.get(SCHEMA) ?? [])
+        .filter((e) => e.calleeName === "all" && e.calleeQualifier === `\\App\\Schema\\${cls}`);
       expect(edge).toHaveLength(1);
-      expect(edge[0].calleeCandidates).toEqual([idOf(`src/Imported/${cls}.php`, "all", `\\App\\Imported\\${cls}`)]);
+      expect(edge[0].calleeCandidates).toEqual([idOf(`src/Schema/${cls}.php`, "all", `\\App\\Schema\\${cls}`)]);
       expect(edge[0].confidence).toBe("unique");
     });
   });
```

**File**: `tests/unit/graph-symbol-resolution-php-qualified.test.ts` (modified, +14/-7)
```diff
@@ -10,8 +10,9 @@ import type { CodeGraph, SymbolEdge, SymbolNode } from "../../src/types.js";
  * A qualified PHP edge carries the class a static call names, or the namespace
  * a class reference names, and every PHP class and method carries what
  * declares it. Resolution requires the two to match — in the caller's own file
- * first, then across its dependencies — and leaves the edge `unresolved` when
- * they do not, rather than falling back to the name.
+ * first, then across its dependencies, then anywhere in the project — and
+ * leaves the edge `unresolved` when they do not, rather than falling back to
+ * the name.
  */
 describe("PHP qualified edges at the resolver", () => {
   const CALLER = "src/Schema/Schema.php";
@@ -173,12 +174,18 @@ describe("PHP qualified edges at the resolver", () => {
     expect(edge.confidence).toBe("unresolved");
   });
 
-  it("searches only the caller's own file and dependencies, as every edge does", () => {
-    // `Report::build()` names a real class, but not one the caller reaches.
-    // The qualifier narrows the search; it does not widen it.
+  it("finds a class outside the caller's dependencies by its exact qualified name", () => {
+    // `Report` is not among the caller's dependencies — a sibling in its own
+    // namespace needs no `use`, so the file graph may draw no edge to it — but
+    // the whole qualified name can only reach the class the source names.
     const edge = resolve("build", "\\App\\Elsewhere\\Report");
-    expect(edge.calleeCandidates).toEqual([]);
-    expect(edge.confidence).toBe("unresolved");
+    expect(edge.calleeCandidates).toEqual([`${UNREACHED}::build#7`]);
+    expect(edge.confidence).toBe("unique");
+  });
+
+  it("still leaves a method name alone unmatched outside the dependencies", () => {
+    // Unqualified, `build()` is answered by name, and only within reach.
+    expect(resolve("build").confidence).toBe("unresolved");
   });
 
   it("resolves an unqualified PHP call exactly as before", () => {
```

---

### Incident Patch 8: `9135992f` (2026-09-23)
**Commit Message**: test(graph): give the `parent` type-hint fixture a parent class

The "emits nothing for `self`, `parent` and `static`" fixture used `parent`
in a class with none, which PHP rejects at compile time ("Cannot use
"parent" when current class scope has no parent"). `C` now extends `B`, and
the test asserts that the `extends` is the only reference the class makes.

**File**: `tests/unit/graph-symbols-php-references.test.ts` (modified, +5/-2)
```diff
@@ -312,13 +312,16 @@ class C extends Базовый implements 可比较 {
   });
 
   it("emits nothing for `self`, `parent` and `static`", () => {
+    // `parent` is only valid PHP in a class that has one, so `C` extends `B`
+    // — and that `extends` is the one reference the class makes.
     const php = `<?php
-class C {
+class B {}
+class C extends B {
     public function a(self $s, parent $p): static {}
     public function b() { return new static(); }
     public function c() { return new self(); }
 }`;
-    expect(refsIn(php)).toEqual([]);
+    expect(refsIn(php).map((r) => r.calleeName)).toEqual(["B"]);
   });
 
   it("emits nothing for primitive and built-in type names", () => {
```

---

### Incident Patch 9: `2522c49f` (2026-09-23)
**Commit Message**: fix(graph): resolve PHP static calls and class references by the class they name

A PHP static call was emitted as its method name alone, and a class reference
as its short name, so resolution could only match by name. Searching the same
file first, `UserSchema::all()` inside `Schema::all()` became a `local`
self-edge to the caller's own `all()`; searching across dependencies,
`Request::capture()` reached a same-named `Invoice::capture()` with `unique`
confidence.

The extractor now resolves the class a static call or class reference names
under PHP's rules - fully qualified, namespace-relative, qualified through an
imported first segment, or unqualified through a `use` or the current
namespace - and carries it on the edge as `calleeQualifier`: the class for
`Cls::m()`, and its namespace for `extends`, `implements`, a trait `use`, a
type hint or `new`. Each PHP class and method carries what declares it as the
new optional `SymbolNode.phpOwner`, in the same two forms: a class by its
namespace prefix (`\App\Models\`), a method by its class
(`\App\Models\Invoice`). Symbol ids and qualified names are unchanged. A
namespace-relative `extends` or `new` (`namespace\Base`) is now read as w

**File**: `src/services/graph-php-case.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+// SPDX-License-Identifier: AGPL-3.0-only
+// Copyright (C) 2026 Giancarlo Erra - Altaire Limited
+
+/**
+ * PHP's own identifier case folding, which is ASCII-only.
+ *
+ * `String.prototype.toLowerCase` is Unicode-aware and PHP is not: `class É {}`
+ * followed by `new é()` fails with `Class "é" not found`, while `Widget` and
+ * `WIDGET` are the same class. The difference is not academic here, because a
+ * non-ASCII character can fold INTO ASCII — `toLowerCase("\u212a")` (KELVIN SIGN) is `"k"` —
+ * so a Unicode fold would let an ordinary ASCII reference match an alias
+ * declared with a character PHP considers unrelated, drawing an edge the
+ * runtime never would.
+ *
+ * In a module of its own because the extractor and the resolver both need it,
+ * and the resolver should not load the whole extractor, and its native parser
+ * binding, for one line.
+ */
+export const phpFoldCase = (name: string): string => name.replace(/[A-Z]+/g, (m) => m.toLowerCase());
```

**File**: `src/services/graph-symbol-resolution.ts` (modified, +73/-0)
```diff
@@ -28,6 +28,7 @@
 
 import { GODOT_BUILTIN_CLASSES, GODOT_BUILTIN_FUNCTIONS } from "../constants.js";
 import type { CodeGraph, SymbolEdge, SymbolNode } from "../types.js";
+import { phpFoldCase } from "./graph-php-case.js";
 import type { RustUseBinding } from "./graph-symbols.js";
 
 /** Symbol-resolution metadata isolated to one Godot project root. */
@@ -210,6 +211,28 @@ function resolveDepFile(callerFile: string, sourceModule: string, deps: string[]
   return null;
 }
 
+/**
+ * The key a qualified PHP edge and the symbol it names meet on.
+ *
+ * Built from an owner in either of the two forms {@link SymbolNode.phpOwner}
+ * documents, and the name declared under it. A namespace prefix owns classes,
+ * so the key is the class's whole name — `\app\models\invoice` — folded
+ * throughout, since PHP matches class and namespace names
+ * ASCII-case-insensitively and `new \App\models\INVOICE()` names the class
+ * declared as `App\Models\Invoice`. A class owns methods, so the key is the
+ * folded class name, `::`, and the method name exactly as written, which is
+ * how every other call in this resolver is matched. The `::` keeps the two
+ * forms apart: a namespace qualifier can never reach a method, nor a class
+ * qualifier a class.
+ *
+ * @param owner A `phpOwner` or a PHP edge's `calleeQualifier`.
+ * @param name The symbol's name, or the edge's `calleeName`.
+ */
+function phpOwnedKey(owner: string, name: string): string {
+  const folded = phpFoldCase(owner);
+  return folded.endsWith("\\") ? `${folded}${phpFoldCase(name)}` : `${folded}::${name}`;
+}
+
 /**
  * Resolve all call sites for every file in `symbolsByFile`. Mutates the
  * passed-in `outgoingCallsByFile` edges in place.
@@ -278,11 +301,26 @@ export function resolveCallSites(
   // other: `const Config` cannot qualify `Config::run()`, so the file that
   // declares it is not an answer.
   const kindOfSymbolId = new Map<string, SymbolNode["kind"]>();
+  // file → {@link phpOwnedKey} → the ids of the PHP symbols declared under
+  // that owner and name. Holds PHP symbols only, and only those that have an
+  // owner; a qualified PHP edge is answered from here and nowhere else.
+  const phpOwnedByFile = new Map<string, Map<string, string[]>>();
   for (const [file, syms] of symbolsByFile.entries()) {
     const idx = new Map<string, SymbolNode[]>();
     for (const s of syms) {
       fileOfSymbolId.set(s.id, file);
       kindOfSymbolId.set(s.id, s.kind);
+      if (s.phpOwner !== undefined) {
+        let owned = phpOwnedByFile.get(file);
+        if (!owned) {
+          owned = new Map();
+          phpOwnedByFile.set(file, owned);
+        }
+        const key = phpOwnedKey(s.phpOwner, s.name);
+        const ids = owned.get(key);
+        if (ids) ids.push(s.id);
+        else owned.set(key, [s.id]);
+      }
       if (s.name === "<module>") continue;
       const existing = idx.get(s.name);
       if (existing) existing.push(s);
@@ -1394,6 +1432,41 @@ export function resolveCallSites(
         continue;
       }
 
+      // A qualified PHP edge is answered by what its qualifier names, or not at
+      // all — the PHP counterpart of the Rust branch above, and gated on the
+      // caller's language for the same reason.
+      //
+      // The extractor has already resolved the qualifier under the file's
+      // namespace and `use` imports: the class a static call names, or the
+      // namespace a class reference names. A candidate must be declared under
+      // exactly that owner (`SymbolNode.phpOwner`), which is what stops
+      // `UserSchema::all()` inside `Schema::all()` from becoming a self-edge —
+      // the caller declares an `all` too, but its owner is `Schema` — and stops
+      // `Request::capture()` from reaching a same-named `Invoice::capture()`.
+      //
+      // The owner is required before the same-file branch and before the
+      // dependency scan, which are searched in that order as they are for
+      // every other e
```

**File**: `src/services/graph-symbols.ts` (modified, +302/-155)
```diff
@@ -11,6 +11,7 @@ import { Lang, parse } from "@ast-grep/napi";
 import { getLanguageFromExtension } from "../constants.js";
 import type { EdgeKind, SymbolEdge, SymbolKind, SymbolNode } from "../types.js";
 import { analyzeElixirTemplate, isElixirTemplateExtension } from "./elixir-templates.js";
+import { phpFoldCase } from "./graph-php-case.js";
 import { logger } from "./logger.js";
 import { gdscriptParserAvailable } from "./parser-availability.js";
 
@@ -1648,7 +1649,7 @@ const PHP_IDENTIFIER_PART = `${PHP_IDENTIFIER_START}0-9`;
  * both sides read the name whole and it resolves.
  *
  * Both PHP name guards in this file are built from this one source, so they
- * cannot drift apart: {@link phpTypeRefName} tests a whole name against
+ * cannot drift apart: {@link phpClassRef} tests a whole name against
  * {@link PHP_IDENTIFIER}, and {@link extractCalleeNamePhp} takes the name a
  * receiver ends with through {@link PHP_IDENTIFIER_TAIL}. `graph-resolution.ts`
  * states the same rule again for the file-import graph, which reads PHP
@@ -2670,6 +2671,13 @@ interface PhpAliasEntry {
   readonly offset: number;
   /** Imported short name. */
   readonly imported: string;
+  /**
+   * The whole imported name, unrooted: `Illuminate\Http\Request`. A grouped
+   * `use A\B\{C, D}` carries its `A\B` prefix on the declaration rather than
+   * the clause, and it is folded in here, so every entry spells its target in
+   * full however the `use` was written.
+   */
+  readonly path: string;
 }
 
 /**
@@ -2690,23 +2698,21 @@ interface PhpAliasEntry {
 type PhpAliasTable = Map<string, PhpAliasEntry[]>;
 
 /**
- * (local spelling, reference offset) → the imported short name in force there,
- * or undefined where nothing imports that spelling.
- */
-type PhpAliasLookup = (local: string, offset: number) => string | undefined;
-
-/**
- * PHP's own identifier case folding, which is ASCII-only.
- *
- * `String.prototype.toLowerCase` is Unicode-aware and PHP is not: `class É {}`
- * followed by `new é()` fails with `Class "é" not found`, while `Widget` and
- * `WIDGET` are the same class. The difference is not academic here, because a
- * non-ASCII character can fold INTO ASCII — `toLowerCase("\u212a")` (KELVIN SIGN) is `"k"` —
- * so a Unicode fold would let an ordinary ASCII reference match an alias
- * declared with a character PHP considers unrelated, drawing an edge the
- * runtime never would.
+ * What a PHP file's namespace declarations and `use` imports say a name means
+ * at a given position — the two things PHP's name resolution reads.
  */
-const phpFoldCase = (name: string): string => name.replace(/[A-Z]+/g, (m) => m.toLowerCase());
+interface PhpNames {
+  /**
+   * (local spelling, reference offset) → the import in force there, or
+   * undefined where nothing imports that spelling.
+   */
+  importAt(local: string, offset: number): PhpAliasEntry | undefined;
+  /**
+   * The namespace in force at an offset, unrooted and without a trailing `\`
+   * (`App\Http`), and `""` outside every namespace — the global one.
+   */
+  namespaceAt(offset: number): string;
+}
 
 /** Record one `use` clause's import under its local spelling, case-folded. */
 function phpAliasAdd(table: PhpAliasTable, local: string, entry: PhpAliasEntry): void {
@@ -2728,7 +2734,7 @@ function phpAliasAt(
   table: PhpAliasTable,
   local: string,
   offset: number,
-): string | undefined {
+): PhpAliasEntry | undefined {
   const entries = table.get(phpFoldCase(local));
   if (!entries) return undefined;
   let best: PhpAliasEntry | undefined;
@@ -2737,59 +2743,92 @@ function phpAliasAt(
       best = entry;
     }
   }
-  return best?.imported;
+  return best;
+}
+
+/**
+ * A PHP class reference, resolved the way the runtime resolves it.
+ *
+ * `calleeName` is the short name the class is declared under, which is what
+ * PHP symbols are indexed by; `localAlias` is the spelling written, when a
+ * `use` made the two differ; `fqcn` is the whole name, unrooted
```

**File**: `src/types.ts` (modified, +24/-0)
```diff
@@ -140,6 +140,22 @@ export interface SymbolNode {
   typeName?: string;
   /** True only for a GDScript `class_name` declaration, never an inner class. */
   isGdscriptClassName?: boolean;
+  /**
+   * PHP only: the fully qualified name of what declares this symbol, which a
+   * qualified PHP edge's `calleeQualifier` is matched against.
+   *
+   * A method's owner is its class, interface, trait or enum, written as that
+   * class's name: `\App\Models\Invoice`. A class, interface or trait is owned
+   * by its namespace, written as a namespace prefix with the trailing `\` PHP
+   * itself uses for one: `\App\Models\`, and `\` for the global namespace. The
+   * two forms cannot collide, so a qualifier naming a class answers only its
+   * methods and one naming a namespace only its classes.
+   *
+   * Absent for every other language, for a method of an anonymous class —
+   * which no qualified name can reach — and for every graph persisted before
+   * it existed. The symbol's `id` and `qualifiedName` are unchanged by it.
+   */
+  phpOwner?: string;
 }
 
 /** Kind of relationship an edge represents */
@@ -187,6 +203,14 @@ export interface SymbolEdge {
    * 191 symbols on tokio, so a qualified call matched by name would either
    * pick one arbitrarily or list them all. With the qualifier, resolution can
    * narrow to the scope the call actually names, or say it could not.
+   *
+   * PHP writes it already resolved under the file's namespace and `use`
+   * imports, in the two forms {@link SymbolNode.phpOwner} uses: the class a
+   * static call names (`\App\Models\Invoice` for `Invoice::capture()`), or the
+   * namespace a class reference names (`\App\Models\` for `extends Invoice`,
+   * a type hint or `new Invoice()`). Absent on every PHP call it cannot
+   * qualify statically — `$obj->m()`, `$class::m()`, `self::`, `static::`,
+   * `parent::` and bare function calls.
    */
   calleeQualifier?: string;
   callSite: { file: string; line: number };
```

**File**: `tests/unit/code-graph-php-symbol-edges.test.ts` (modified, +12/-11)
```diff
@@ -223,18 +223,19 @@ class Ambiguous
     expect(e.confidence).toBe("unique");
   });
 
-  it("reports both classes when two dependencies declare the same short name", async () => {
-    // PHP symbols are indexed under their declared short name, and both files
-    // declare `Base`, so the two spellings in this signature are one edge with
-    // two honest candidates. Answering `unique` here would name a class this
-    // file does not use half the time — worse than saying it does not know.
+  it("resolves two classes that share a short name each to the one it names", async () => {
+    // Both files declare `Base`, and this signature names both — one bare
+    // through `use App\Base\Base`, one through `use App\Dup\Base as DupBase`.
+    // By short name alone they were one edge with two candidates, and the
+    // best it could say was `multiple-candidates`. Qualified by namespace
+    // they are two edges to two classes, and each answers `unique`.
     const found = edgesOf("src/Ambiguous/Ambiguous.php", "Base", "type_reference");
-    expect(found).toHaveLength(1);
-    expect(found[0].calleeCandidates.slice().sort()).toEqual([
-      "src/Base/Base.php::Base#5",
-      "src/Dup/Base.php::Base#5",
-    ]);
-    expect(found[0].confidence).toBe("multiple-candidates");
+    expect(found).toHaveLength(2);
+    const byQualifier = new Map(found.map((e) => [e.calleeQualifier, e]));
+    expect(byQualifier.get("\\App\\Base\\")?.calleeCandidates).toEqual(["src/Base/Base.php::Base#5"]);
+    expect(byQualifier.get("\\App\\Dup\\")?.calleeCandidates).toEqual(["src/Dup/Base.php::Base#5"]);
+    expect(byQualifier.get("\\App\\Dup\\")?.localAlias).toBe("DupBase");
+    for (const e of found) expect(e.confidence).toBe("unique");
   });
 
   it("does not let the duplicate short name turn a single-candidate edge ambiguous", async () => {
```

---

### Incident Patch 10: `b7dcc01d` (2026-09-23)
**Commit Message**: Merge pull request #186 from gregoryfoster/fix/184-php-non-ascii-identifiers

fix(graph): read PHP names by the language's identifier rule, non-ASCII included

**File**: `src/services/graph-symbols.ts` (modified, +132/-10)
```diff
@@ -1607,6 +1607,82 @@ function extractCalleeNameJs(text: string): string | null {
   return extractCalleeInfoJs(text)?.calleeName ?? null;
 }
 
+/** The characters PHP admits first in an identifier, as a character-class body. */
+const PHP_IDENTIFIER_START = "A-Za-z_\\u0080-\\uffff";
+
+/** The characters PHP admits after the first: the same set plus the digits. */
+const PHP_IDENTIFIER_PART = `${PHP_IDENTIFIER_START}0-9`;
+
+/**
+ * PHP's identifier rule, as it reaches this code once the source is decoded.
+ *
+ * The language states the rule over bytes —
+ * `[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*` — and every byte of a UTF-8
+ * multibyte sequence is at least 0x80, so after decoding it reduces to "ASCII
+ * letters, digits and `_`, plus any non-ASCII character". `Café`, `Документ`
+ * and `文書` are all legal PHP names, and the grammar parses each as a `name`;
+ * a character class transliterated straight from the spec's `\x80-\xff` would
+ * still reject the last two. The same argument holds one level down, over
+ * UTF-16: every code unit of a non-ASCII character is at least 0x80, so
+ * `\u0080-\uffff`, matched code unit by code unit, admits every non-ASCII
+ * character — one outside the BMP by its two surrogate halves.
+ *
+ * That is why these patterns carry no `u` flag, and it is load-bearing: with
+ * it the range would end at U+FFFF, and `$o->𠮷Id()` would be cut down to its
+ * ASCII tail `Id`. The grammar's own `name` token does stop at the BMP, and it
+ * cuts there on both sides of a call — a limit of the parse, which the rule
+ * here cannot see past. A type name holding such a character usually arrives
+ * already cut short at it; `extractFromPhp` recognises the cut from the source
+ * around the node and emits nothing, rather than an edge to the shorter name.
+ * The exception is a `\`-rooted spelling, where the `qualified_name` wrapper
+ * spans the fragment and the node's text is the whole written name, so
+ * `extends \𠮷Doc` is read as `𠮷Doc` and simply answers nothing.
+ * A declaration's name carries no such guard, so `class 𠮷Doc {}` is still
+ * filed under `Doc` and `function 𠮷Id()` under `Id`. A callee name is read
+ * from the call node's own text, which the cut does not reach, so above the BMP
+ * the two no longer meet: `$o->𠮷Id()` is named `𠮷Id` and answers no
+ * declaration. The ASCII-only pattern truncated that call to `Id` and so agreed
+ * with the truncated declaration by coincidence — the same truncation that
+ * answered `$o->crée()` with an unrelated `e` — so the whole name is preferred
+ * to it. Inside the BMP, where every accented, Cyrillic and CJK name lives,
+ * both sides read the name whole and it resolves.
+ *
+ * Both PHP name guards in this file are built from this one source, so they
+ * cannot drift apart: {@link phpTypeRefName} tests a whole name against
+ * {@link PHP_IDENTIFIER}, and {@link extractCalleeNamePhp} takes the name a
+ * receiver ends with through {@link PHP_IDENTIFIER_TAIL}. `graph-resolution.ts`
+ * states the same rule again for the file-import graph, which reads PHP
+ * namespace and class declarations out of source text rather than a parse.
+ */
+const PHP_IDENTIFIER_SOURCE = `[${PHP_IDENTIFIER_START}][${PHP_IDENTIFIER_PART}]*`;
+
+/** A string that is exactly one PHP identifier. */
+const PHP_IDENTIFIER = new RegExp(`^${PHP_IDENTIFIER_SOURCE}$`);
+
+/** One character PHP admits inside an identifier, surrogate halves included. */
+const PHP_IDENTIFIER_CHAR = new RegExp(`^[${PHP_IDENTIFIER_PART}]$`);
+
+/**
+ * One character that carries a PHP type reference on past a node's right edge:
+ * an identifier character, which would make one longer name of the two runs, or
+ * the `\` that adds another segment to a qualified one.
+ */
+const PHP_TYPE_REF_CHAR = new RegExp(`^[${PHP_IDENTIFIER_PART}\\\\]$`);
+
+/**
+ * The PHP identifier a string ends with, as group 1.
+ *
+ * The lookbehind pins every attempt to the start of a run of identifier
+ * characte
```

**File**: `tests/unit/code-graph-php-non-ascii-identifiers.test.ts` (added, +234/-0)
```diff
@@ -0,0 +1,234 @@
+// SPDX-License-Identifier: AGPL-3.0-only
+// Copyright (C) 2026 Giancarlo Erra - Altaire Limited
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import path from "node:path";
+import { afterAll, beforeAll, describe, expect, it } from "vitest";
+import { buildCodeGraph } from "../../src/services/code-graph.js";
+import { resolveCallSites } from "../../src/services/graph-symbol-resolution.js";
+import type { SymbolEdge } from "../../src/types.js";
+
+/**
+ * Non-ASCII PHP identifiers through the real `buildCodeGraph` +
+ * `resolveCallSites` pass.
+ *
+ * The extractor tests prove the names are read whole; only a real build proves
+ * what a truncated name would have done. Three of the non-ASCII methods below
+ * end in an ASCII tail, and `decoys.php` declares a function under exactly each
+ * tail and is required by the caller, so it sits inside the dependency closure
+ * the untargeted scan searches. A call cut down to its tail therefore did not go
+ * missing — it resolved, with `unique` confidence, to a function the caller
+ * never names. The assertions hold both halves: every call reaches the method
+ * it names, and nothing reaches a decoy.
+ */
+describe("PHP non-ASCII identifiers in a real graph", () => {
+  let root: string;
+  let graph: Awaited<ReturnType<typeof buildCodeGraph>>;
+
+  const write = (rel: string, body: string): void => {
+    const abs = path.join(root, rel);
+    mkdirSync(path.dirname(abs), { recursive: true });
+    writeFileSync(abs, body);
+  };
+
+  const CALLER = "src/Report/Document.php";
+  const DECOYS = "src/Helpers/decoys.php";
+  const SPLITTER = "src/Report/Split.php";
+  const SPLIT_DECOY = "src/Model/野.php";
+
+  /** The single resolved edge under one name and kind, failing loudly if there is not exactly one. */
+  const edge = (file: string, name: string, kind: SymbolEdge["kind"]): SymbolEdge => {
+    const found = (graph.outgoingCallsByFile.get(file) ?? [])
+      .filter((e) => e.calleeName === name && e.kind === kind);
+    expect(found, `expected one ${kind} edge to ${name} in ${file}`).toHaveLength(1);
+    return found[0];
+  };
+
+  /** The id of the one symbol a file declares under a name. */
+  const idOf = (file: string, name: string): string => {
+    const found = (graph.symbolsByFile.get(file) ?? []).filter((s) => s.name === name);
+    expect(found, `expected one symbol ${name} in ${file}`).toHaveLength(1);
+    return found[0].id;
+  };
+
+  beforeAll(async () => {
+    root = mkdtempSync(path.join(tmpdir(), "socraticode-php-non-ascii-"));
+
+    write("composer.json", JSON.stringify({ autoload: { "psr-4": { "App\\": "src/" } } }));
+
+    // The ASCII tails an ASCII-only callee scan cut the method names below
+    // down to. Nothing in the project calls any of them.
+    write(DECOYS, `<?php
+
+namespace App\\Helpers;
+
+function e(): void {}
+
+function Json(): void {}
+
+function Id(): void {}
+`);
+
+    write("src/Model/Formatter.php", `<?php
+
+namespace App\\Model;
+
+class Formatter
+{
+    public function crée(): void {}
+
+    public function данные(): void {}
+
+    public function данныеJson(): void {}
+
+    public function 文書(): void {}
+
+    public function 文書Id(): void {}
+}
+`);
+
+    // Class names outside Latin-1. Neither has a composed character, so the
+    // path is the same whichever Unicode normalization the filesystem applies.
+    write("src/Model/Документ.php", `<?php
+
+namespace App\\Model;
+
+class Документ {}
+`);
+
+    write("src/Model/報告.php", `<?php
+
+namespace App\\Model;
+
+class 報告 {}
+`);
+
+    // Reachable, and named exactly what the parse leaves behind when it splits
+    // `野𠮷`: if a partial name were emitted, this is the class it would
+    // resolve to, and the edge would claim a parent the source never names.
+    write(SPLIT_DECOY, `<?php
+
+namespace App\\Model;
+
+class 野 {}
+`);
+
+    write(SPLITTER, `<?php
+
+namespace App\\Repor
```

**File**: `tests/unit/graph-symbols-php-calls.test.ts` (modified, +46/-0)
```diff
@@ -87,4 +87,50 @@ class LogoutController {
     expect(names).toHaveLength(2);
     expect(new Set(names)).toEqual(new Set(["bar", "qux"]));
   });
+
+  /**
+   * PHP admits any non-ASCII character in an identifier, and the callee scan
+   * is anchored at the end of the receiver. An ASCII-only pattern there did not
+   * only drop a non-ASCII name: where the name ended in ASCII it matched that
+   * tail alone, so `$o->crée()` was recorded as a call to `e`.
+   */
+  describe("non-ASCII identifiers", () => {
+    it.each([
+      ["an ASCII method, as before", "$o->render();", "render"],
+      ["an accented method", "$o->crée();", "crée"],
+      ["an accented method with a longer ASCII tail", "$o->données();", "données"],
+      ["a Cyrillic method", "$o->данные();", "данные"],
+      ["a CJK method", "$o->文書();", "文書"],
+      ["a Cyrillic method that ends in ASCII", "$o->данныеJson();", "данныеJson"],
+      ["a CJK method that ends in ASCII", "$o->文書Id();", "文書Id"],
+      // Outside the BMP, so only a pattern without the `u` flag keeps it whole.
+      ["a CJK method outside the BMP that ends in ASCII", "$o->𠮷Id();", "𠮷Id"],
+      ["an accented function", "crée();", "crée"],
+      ["an ASCII static method on an accented class", "Café::make();", "make"],
+      ["a Cyrillic static method on a Cyrillic class", "Документ::создать();", "создать"],
+    ])("names %s exactly", (_label, statement, expected) => {
+      expect(callsIn(`<?php\n${statement}\n`)).toEqual([expected]);
+    });
+
+    /**
+     * The parse's own BMP limit, pinned so a grammar change is not silent.
+     * `name` stops at U+FFFF, so a declaration written past it is filed under
+     * the remainder — `𠮷Id` becomes `Id` — while the callee scan reads the
+     * call node's own text and keeps the character. Above the BMP the two
+     * therefore never meet, and the call resolves to nothing. Truncating the
+     * call to agree would be the `crée` → `e` bug again from the other side:
+     * `Id` is a name the source does not write, and an unrelated `Id` in the
+     * caller's dependency closure would answer it.
+     */
+    it("keeps a callee past the BMP whole, which the cut declaration cannot answer", () => {
+      const { symbols, rawCalls } = extractSymbolsAndCalls(
+        "<?php\nclass C {\n    public function \u{20BB7}Id(): void {}\n    public function run(): void { $this->\u{20BB7}Id(); }\n}\n",
+        "php",
+        ".php",
+        "t.php",
+      );
+      expect(symbols.filter((s) => s.kind === "method").map((s) => s.name)).toEqual(["Id", "run"]);
+      expect(rawCalls.map((c) => c.calleeName)).toEqual(["\u{20BB7}Id"]);
+    });
+  });
 });
```

**File**: `tests/unit/graph-symbols-php-references.test.ts` (modified, +108/-0)
```diff
@@ -293,6 +293,24 @@ class P {
       .toEqual([{ calleeName: "Qualified", kind: "call" }]);
   });
 
+  it("names a class whose identifier is not ASCII", () => {
+    // PHP admits any non-ASCII character in a name, and the grammar parses
+    // `Café`, `Документ` and `文書` alike as a `name`. An ASCII-only guard
+    // dropped each of these edges without a word.
+    expect(namesOf("<?php\nclass A extends Café {}\nclass B extends Документ {}\nclass C extends 文書 {}\n"))
+      .toEqual(["Café", "Документ", "文書"]);
+  });
+
+  it("names a non-ASCII class in every structural position, and by its terminal segment", () => {
+    const php = `<?php
+class C extends Базовый implements 可比较 {
+    private ?Журнал $log = null;
+    public function go(Документ $d): \\App\\Модель\\文書 { return new Отчет(); }
+}`;
+    expect(namesOf(php)).toEqual(["Базовый", "可比较", "Документ", "Журнал", "文書"]);
+    expect(namesOf(php, "call")).toEqual(["Отчет"]);
+  });
+
   it("emits nothing for `self`, `parent` and `static`", () => {
     const php = `<?php
 class C {
@@ -351,6 +369,96 @@ class C {
     expect(refsIn(php)).toEqual([{ calleeName: "kelvin", kind: "type_reference" }]);
   });
 
+  it("emits nothing for a name the parse split at a character past the BMP", () => {
+    // The grammar's `name` token stops at the BMP, so each of these arrives as
+    // part of the written name with an `ERROR` fragment beside it: `野` before
+    // the fragment, `Doc` after it. Emitting either would name a class the
+    // source never writes, and a reachable class of that name would answer it.
+    const php = `<?php
+class A extends 野𠮷 {}
+class B extends 𠮷Doc {}
+class C implements 可比较𠮷 {}
+function f() { return new 野𠮷(); }
+function g(𠮷Doc $d): 野𠮷 {}
+`;
+    expect(refsIn(php)).toEqual([]);
+  });
+
+  it("suppresses a split name whose surviving part is ASCII, as the grammar cuts there too", () => {
+    // `main` recorded `B` here. It is the same partial name, and the same
+    // wrong parent if a class `B` is reachable.
+    expect(refsIn("<?php\nclass A extends B𝑓 {}\n")).toEqual([]);
+  });
+
+  it("emits nothing for a qualified name the parse split, not the namespace it opens with", () => {
+    // A qualified name loses more than the segment that was cut. The parse
+    // gives up at the cut and hands back only the part before it, so
+    // `App\野𠮷` arrives as the bare `App` — which is not a shortened class
+    // name but a namespace head, and one a great many projects also declare a
+    // class under. Every node kind `extractFromPhp` collects a qualified name
+    // from is spelled out below — they all reach the guard through the same
+    // `pushTypeRef`, but an enumeration is what proves none was missed.
+    const php = `<?php
+class A extends App\\野𠮷 {}
+class B implements App\\野𠮷 {}
+class C { use App\\野𠮷; }
+class D { private App\\野𠮷 $r; }
+class E { public function __construct(private App\\野𠮷 $r) {} }
+function f(App\\野𠮷 $x): A\\B\\C\\野𠮷 {}
+function g() { return new \\App\\野𠮷(); }
+function h(App\\野𠮷 ...$v) {}
+$k = fn (): App\\野𠮷 => 1;
+class F extends App\\𠮷Doc {}
+`;
+    expect(refsIn(php)).toEqual([]);
+  });
+
+  it("still records the whole name when nothing is split off it", () => {
+    // The guard keys on an identifier character or a `\` touching the node,
+    // which a name the parse read whole never has: the `name` token takes the
+    // longest run it can, and a whole qualified name is one node with its
+    // separators inside it. Positive control for the tests above.
+    expect(namesOf("<?php\nclass A extends 野 {}\nclass B extends Doc {}\nclass C extends Café {}\n"))
+      .toEqual(["野", "Doc", "Café"]);
+    expect(namesOf("<?php\nclass A extends App\\Model\\Doc {}\nclass B extends \\App\\野 {}\n"))
+      .toEqual(["Doc", "野"]);
+  });
+
+  it("keeps a rooted name written tight against the `new` before it", () => {
+    // `new\App\Made()` is valid — PHP ends the keyword at the `\`, which
```

#### Recent Merged Pull Requests:
- **PR #194** (closed): fix(qdrant): pair undici transport on every affected Node, not just 26+ (@derekslinz)
- **PR #193** (2026-09-28): chore(deps): update patched dependencies (@giancarloerra)
- **PR #191** (2026-09-28): feat: opt-in Git-triggered incremental indexing (@giancarloerra)
- **PR #190** (2026-09-24): docs: add quick setup and scenario guides (@giancarloerra)
- **PR #187** (2026-09-24): fix(graph): resolve PHP static calls and class references by the class they name (@gregoryfoster)
- **PR #186** (2026-09-23): fix(graph): read PHP names by the language's identifier rule, non-ASCII included (@gregoryfoster)
- **PR #183** (2026-09-22): fix(graph): capture PHP structural symbol edges so codebase_impact stops reporting zero dependents (@gregoryfoster)
- **PR #182** (2026-09-20): feat: allow the Claude Code plugin engine specification to be pinned (@gregoryfoster)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
