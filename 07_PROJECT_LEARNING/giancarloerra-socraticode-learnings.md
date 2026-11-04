> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/giancarloerra-socraticode-learnings.md`  
> **Source**: github ([https://github.com/giancarloerra/SocratiCode](https://github.com/giancarloerra/SocratiCode))  
> **Source Version**: `d56502a3`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T23:48:30.601Z  
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
> **Harvest Timestamp**: 2026-11-04T23:48:30.597Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `giancarloerra/SocratiCode`
- **Description**: Enterprise-grade (40m+ LOC) codebase intelligence, zero-setup, local & private Plugin/Skill/Extension or MCP: hybrid semantic search, polyglot dependency graphs, symbol-level impact analysis & call-flow, interactive HTML viewer, cross-project & branch-aware search, DB/API/infra knowledge. 61% less tokens, 84% fewer calls, 37x faster. Cloud in beta.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3365 stars

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

### Incident Patch 1: `106bb398` (2026-11-03)
**Commit Message**: fix: preserve Ollama policy errors and late-exit cleanup

**File**: `src/services/provider-ollama.ts` (modified, +4/-2)
```diff
@@ -145,7 +145,8 @@ export async function isOllamaAvailable(): Promise<boolean> {
     const client = getClient();
     await client.list();
     return true;
-  } catch {
+  } catch (error) {
+    if (error instanceof OllamaTransportError) throw error;
     return false;
   }
 }
@@ -159,7 +160,8 @@ export async function isModelAvailable(): Promise<boolean> {
     return models.models.some(
       (m) => m.name === config.embeddingModel || m.name.startsWith(`${config.embeddingModel}:`),
     );
-  } catch {
+  } catch (error) {
+    if (error instanceof OllamaTransportError) throw error;
     return false;
   }
 }
```

**File**: `tests/unit/mcp-logging-protocol.test.ts` (modified, +33/-2)
```diff
@@ -40,7 +40,7 @@ beforeEach(async () => {
 });
 
 /** Close the server before deleting its files; fail explicitly if shutdown needs forced termination. */
-async function stopServer(timeoutMs = 15_000): Promise<void> {
+async function stopServer(timeoutMs = 15_000, beforeForcedTermination?: () => Promise<void>): Promise<void> {
   const proc = child;
   let shutdownTimedOut = false;
   if (proc && proc.exitCode === null && proc.signalCode === null) {
@@ -56,8 +56,13 @@ async function stopServer(timeoutMs = 15_000): Promise<void> {
         new Promise<true>((resolve) => { timeout = setTimeout(() => resolve(true), timeoutMs); }),
       ]);
       if (shutdownTimedOut && proc.pid !== undefined) {
+        if (beforeForcedTermination) await beforeForcedTermination();
         if (process.platform === "win32") {
-          await execFileAsync("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { timeout: 10_000 });
+          try {
+            await execFileAsync("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { timeout: 10_000 });
+          } catch (error) {
+            if (proc.exitCode === null && proc.signalCode === null) throw error;
+          }
         } else {
           try {
             process.kill(-proc.pid, "SIGKILL");
@@ -182,6 +187,32 @@ async function waitFor(check: () => boolean, timeoutMs: number, failed: () => Er
 const occurrences = (text: string, needle: string): number => text.split(needle).length - 1;
 
 describe("MCP logging over stdio", () => {
+  it.each(["exit", "close"] as const)("cleans up and retains the timeout error when %s precedes forced termination", async (event) => {
+    const descendant = "require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1000)'], { stdio: ['ignore', 'inherit', 'inherit'] }).unref(); ";
+    const script = `${event === "exit" ? descendant : ""}process.stdin.resume(); process.stdout.write('ready'); setInterval(() => {}, 1000);`;
+    const proc = spawn(process.execPath, ["-e", script], {
+      stdio: ["pipe", "pipe", "pipe"],
+      detached: process.platform !== "win32",
+    });
+    child = proc;
+    const exited = new Promise<void>((resolve) => proc.once("exit", () => resolve()));
+    const closed = new Promise<void>((resolve) => proc.once("close", () => resolve()));
+    childClosed = closed;
+    proc.stderr.resume();
+    await new Promise<void>((resolve) => proc.stdout.once("data", () => resolve()));
+
+    let terminationStarted = false;
+    await expect(stopServer(100, async () => {
+      terminationStarted = true;
+      proc.kill();
+      await (event === "exit" ? exited : closed);
+    })).rejects.toThrow("process tree was terminated");
+    expect(terminationStarted).toBe(true);
+    expect(child).toBeUndefined();
+    expect(childClosed).toBeUndefined();
+    await expect(fsp.stat(workDir)).rejects.toMatchObject({ code: "ENOENT" });
+  });
+
   it("fails and removes the whole process tree when EOF shutdown stalls", async () => {
     const descendant = "process.stdin.resume(); process.stdout.write('ready'); setInterval(() => {}, 1000);";
     const wrapper = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: ['pipe', 'inherit', 'inherit'] }); process.stdin.resume(); setInterval(() => {}, 1000);`;
```

**File**: `tests/unit/provider-ollama-connection-pool.test.ts` (modified, +28/-2)
```diff
@@ -4,7 +4,7 @@ import { createServer, type Server } from "node:http";
 import type { Socket } from "node:net";
 import { afterEach, beforeEach, describe, expect, it } from "vitest";
 import { resetEmbeddingConfig } from "../../src/services/embedding-config.js";
-import { OllamaEmbeddingProvider, resetOllamaClient, resetOllamaReadinessCache } from "../../src/services/provider-ollama.js";
+import { isModelAvailable, isOllamaAvailable, OllamaEmbeddingProvider, resetOllamaClient, resetOllamaReadinessCache } from "../../src/services/provider-ollama.js";
 
 /**
  * Issue 114: the Ollama client rode Node's default fetch pool, which has no
@@ -37,7 +37,7 @@ describe("ollama connection pool", () => {
       authorizations.push(req.headers.authorization);
       req.resume();
       req.on("end", () => {
-        if (req.url === "/api/embed" && redirectLocation) {
+        if ((req.url === "/api/embed" || req.url === "/api/tags") && redirectLocation) {
           res.writeHead(redirectStatus, { location: redirectLocation });
           res.end();
           return;
@@ -156,6 +156,32 @@ describe("ollama connection pool", () => {
     expect(authorizations).toEqual([requiredAuthorization, requiredAuthorization]);
   });
 
+  const availabilityChecks: [string, () => Promise<unknown>][] = [
+    ["reachability", isOllamaAvailable],
+    ["model availability", isModelAvailable],
+    ["readiness", () => new OllamaEmbeddingProvider().ensureReady()],
+    ["health", () => new OllamaEmbeddingProvider().healthCheck()],
+  ];
+
+  it.each(availabilityChecks.flatMap(([name, check]) =>
+    [307, 308].map((status) => [name, status, check] as const),
+  ))("preserves the HTTPS policy error from %s after a %i model-list redirect", async (_name, status, check) => {
+    process.env.OLLAMA_API_KEY = "fixture-redirect-key";
+    redirectStatus = status;
+    redirectLocation = "http://192.0.2.10:11434/api/tags";
+
+    await expect(check()).rejects.toThrow(/OLLAMA_API_KEY.*HTTPS/);
+    expect(authorizations).toEqual(["Bearer fixture-redirect-key"]);
+  });
+
+  it.each([
+    ["reachability", isOllamaAvailable],
+    ["model availability", isModelAvailable],
+  ] as const)("keeps ordinary server failures unavailable for %s", async (_name, check) => {
+    failNext = 1;
+    await expect(check()).resolves.toBe(false);
+  });
+
   it("uses a changed key without requiring a client reset", async () => {
     requiredAuthorization = "Bearer fixture-key-one";
     process.env.OLLAMA_API_KEY = "fixture-key-one";
```

---

### Incident Patch 2: `a5bc960f` (2026-11-04)
**Commit Message**: fix: preserve Ollama authentication and simplify MCP test teardown

**File**: `CONTRIBUTING.md` (modified, +2/-2)
```diff
@@ -16,8 +16,8 @@ By submitting a pull request, you agree to the [Contributor License Agreement (C
 - Docker (for integration and E2E tests)
 - Git
 
-Release tools require Node.js 22.22.2 or newer in the 22.x line, 24.15 or newer
-in the 24.x line, or 26 and newer.
+Release tools and strict root development installs (`npm ci --engine-strict`) require Node.js
+22.22.2+ in 22.x, 24.15+ in 24.x, or 26+.
 
 ### Setup
 
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -598,6 +598,8 @@ On VS Code's 2.45M‑line codebase, SocratiCode answers architectural questions
 | [Docker](https://www.docker.com/products/docker-desktop/) | Runs Qdrant (vector DB) and by default Ollama (embeddings) | [docker.com](https://www.docker.com/products/docker-desktop/) |
 | Node.js 18.17+ with `npx` on `PATH` | Runs the MCP server | [nodejs.org](https://nodejs.org/) |
 
+On Alpine Linux ARM64, run `apk add --no-cache gcompat` so the bundled Swift parser can load.
+
 Docker must be **running** when you use the server in the default `managed` mode. 
 
 The Qdrant container is managed automatically. If you set `QDRANT_MODE=external` and point `QDRANT_URL` at a remote or cloud Qdrant instance, Docker is only needed for Ollama (embeddings) in that case.
```

**File**: `src/services/docker.ts` (modified, +2/-1)
```diff
@@ -16,6 +16,7 @@ import {
   QDRANT_PORT,
   QDRANT_URL,
 } from "../constants.js";
+import { ollamaDisplayOrigin } from "./embedding-config.js";
 import { logger } from "./logger.js";
 
 const execFileAsync = promisify(execFile);
@@ -388,7 +389,7 @@ export async function ensureOllamaContainerReady(onProgress?: InfraProgressCallb
  * `api-key` header for Qdrant Cloud, whose /healthz endpoint requires auth).
  */
 async function waitForService(url: string, serviceName: string, retries = 30, delayMs = 1000, init?: RequestInit): Promise<void> {
-  logger.info(`Waiting for ${serviceName} to be ready`, { url });
+  logger.info(`Waiting for ${serviceName} to be ready`, { url: serviceName === "Ollama" ? ollamaDisplayOrigin(url) : url });
   for (let i = 0; i < retries; i++) {
     try {
       const resp = await fetch(url, init);
```

**File**: `src/services/embedding-config.ts` (modified, +18/-1)
```diff
@@ -136,6 +136,23 @@ export function defaultOllamaUrl(mode: OllamaMode, apiKey: string | undefined):
   return "http://localhost:11434";
 }
 
+/** Parse the endpoint forms supported by the Ollama SDK, including a bare host or :port. */
+export function parseOllamaUrl(host: string): URL | undefined {
+  try {
+    if (host.startsWith(":")) return new URL(`http://127.0.0.1${host}`);
+    if (host.includes("://")) return new URL(host);
+    const url = new URL(`http://${host}`);
+    if (!url.port) url.port = "11434";
+    return url;
+  } catch {
+    return undefined;
+  }
+}
+
+export function ollamaDisplayOrigin(host: string): string {
+  return parseOllamaUrl(host)?.origin ?? "(invalid Ollama endpoint)";
+}
+
 /**
  * Well-known model context lengths (in tokens).
  * Used for client-side pre-truncation to work around Ollama
@@ -413,7 +430,7 @@ export function loadEmbeddingConfig(): EmbeddingConfig {
     embeddingProvider: _config.embeddingProvider,
     ...(embeddingProvider === "ollama" ? {
       ollamaMode: _config.ollamaMode,
-      ollamaUrl: _config.ollamaUrl,
+      ollamaUrl: ollamaDisplayOrigin(_config.ollamaUrl),
       ollamaMaxConnections: _config.ollamaMaxConnections,
     } : {}),
     ...(embeddingProvider === "lmstudio" ? {
```

**File**: `src/services/provider-ollama.ts` (modified, +22/-11)
```diff
@@ -12,7 +12,7 @@ import { Ollama } from "ollama";
 import { Agent, fetch as undiciFetch } from "undici";
 import type { InfraProgressCallback } from "./docker.js";
 import { ensureOllamaContainerReady, isDockerAvailable, isOllamaImagePresent, isOllamaRunning, isQdrantRunning } from "./docker.js";
-import { defaultOllamaUrl, getEmbeddingConfig, setResolvedOllamaMode } from "./embedding-config.js";
+import { defaultOllamaUrl, getEmbeddingConfig, ollamaDisplayOrigin, parseOllamaUrl, setResolvedOllamaMode } from "./embedding-config.js";
 import type { EmbeddingHealthStatus, EmbeddingProvider, EmbeddingReadinessResult } from "./embedding-types.js";
 import { logger } from "./logger.js";
 
@@ -30,15 +30,15 @@ loopbackAddresses.addAddress("::1", "ipv6");
 
 class OllamaTransportError extends Error {}
 
+function isAuthChallenge(status: number): boolean {
+  return status === 401 || status === 403;
+}
+
 /** Keep keyed Ollama requests on HTTPS, except for explicitly supported loopback HTTP. */
 function assertOllamaTransport(host: string, apiKey: string | undefined): void {
   if (!apiKey) return;
-  let url: URL;
-  try {
-    // Match the SDK's supported scheme-less and port-only host syntax.
-    const normalized = host.startsWith(":") ? `http://127.0.0.1${host}` : host.includes("://") ? host : `http://${host}`;
-    url = new URL(normalized);
-  } catch {
+  const url = parseOllamaUrl(host);
+  if (!url) {
     throw new TypeError("Invalid OLLAMA_URL. Configure a valid HTTPS URL or an HTTP loopback endpoint.");
   }
   if (url.protocol === "https:") return;
@@ -104,11 +104,21 @@ function getClient(): Ollama {
       // is what the ollama client consumes and matches.
       fetch: (async (input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) => {
         try {
-          return await undiciFetch(input, { ...init, dispatcher: transportDispatcher });
+          const response = await undiciFetch(input, { ...init, dispatcher: transportDispatcher });
+          if (config.ollamaApiKey && isAuthChallenge(response.status)) {
+            await response.body?.cancel();
+            const reason = response.status === 401 ? "Unauthorized" : "Forbidden";
+            throw new OllamaTransportError(`Ollama authentication failed (HTTP ${response.status} ${reason}). Check OLLAMA_API_KEY and server permissions.`);
+          }
+          return response;
         } catch (error) {
           // Preserve the actionable policy failure rather than Fetch's generic
           // "fetch failed" message. Other transport failures keep their cause.
           if (error instanceof TypeError && error.cause instanceof OllamaTransportError) throw error.cause;
+          // Fetch includes the full URL when rejecting embedded credentials.
+          if (error instanceof TypeError && parseOllamaUrl(config.ollamaUrl)?.username) {
+            throw new TypeError("Ollama cannot use credentials embedded in the URL. Use OLLAMA_API_KEY instead.");
+          }
           throw error;
         }
       }) as unknown as typeof fetch,
@@ -238,7 +248,8 @@ async function detectNativeOllama(): Promise<boolean> {
     const timeoutId = setTimeout(() => controller.abort(), 2_000);
     const resp = await fetch("http://localhost:11434/api/tags", { signal: controller.signal });
     clearTimeout(timeoutId);
-    if (resp.ok) {
+    // A protected native listener is present. Authenticate there through the guarded client.
+    if (resp.ok || (getEmbeddingConfig().ollamaApiKey && isAuthChallenge(resp.status))) {
       _autoDetectedMode = "external";
       _autoDetectedUrl = "http://localhost:11434";
       logger.info("Auto-mode: native Ollama detected at http://localhost:11434 — using external mode (GPU-accelerated if available)");
@@ -306,7 +317,7 @@ export class OllamaEmbeddingProvider implements EmbeddingProvider {
     if (!(await isOllamaAvailable())) {
       if (config.ollamaMode === "external") {
         throw new Error(
-          `Ollama is not reachable at ${config.ollamaUrl}. ` +
+          `Ollama is not reachable at ${ollamaDisplayOrigin(config.ollamaUrl)}. ` +
           `Make sure Ollama is running (e.g. "ollama serve") or check OLLAMA_URL in your MCP config.`,
         );
       } else {
@@ -413,7 +424,7 @@ export class OllamaEmbeddingProvider implements EmbeddingProvider {
 
     // External mode
     const available = await isOllamaAvailable();
-    lines.push(`${icon(available)} Ollama (external): ${available ? `Reachable at ${config.ollamaUrl}` : `Not reachable at ${config.ollamaUrl}`}`);
+    lines.push(`${icon(available)} Ollama (external): ${available ? "Reachable" : "Not reachable"} at ${ollamaDisplayOrigin(config.ollamaUrl)}`);
 
     const modelReady = available ? await isModelAvailable() : false;
     lines.push(`${icon(modelReady)} Embedding model (${config.embeddingModel}): ${modelReady ? "Available" : "Not available — will be pulled on first index"}`);
```

**File**: `tests/unit/docker.test.ts` (modified, +23/-0)
```diff
@@ -242,6 +242,29 @@ describe("startQdrant", () => {
   });
 });
 
+it("keeps the configured Ollama readiness path out of Docker logs", async () => {
+  const host = "http://127.0.0.1:11435/private-proxy-path";
+  vi.resetModules();
+  vi.doMock("../../src/constants.js", async (original) => ({
+    ...await original<typeof import("../../src/constants.js")>(), OLLAMA_HOST: host,
+  }));
+  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
+  try {
+    const { startOllama } = await import("../../src/services/docker.js");
+    const { logger } = await import("../../src/services/logger.js");
+    resolveOk(); // stopped
+    resolveOk("socraticode-ollama"); // existing container
+    resolveOk(); // docker start
+    await startOllama();
+    expect(fetch).toHaveBeenCalledWith(`${host}/api/tags`, undefined);
+    expect(logger.info).toHaveBeenCalledWith("Waiting for Ollama to be ready", { url: "http://127.0.0.1:11435" });
+  } finally {
+    fetch.mockRestore();
+    vi.doUnmock("../../src/constants.js");
+    vi.resetModules();
+  }
+});
+
 // ── ensureQdrantReady (managed mode) — readiness cache ───────────────────
 
 describe("ensureQdrantReady managed mode cache", () => {
```

**File**: `tests/unit/mcp-logging-protocol.test.ts` (modified, +49/-199)
```diff
@@ -11,12 +11,12 @@
  * JSON-RPC to it, the way an MCP host does.
  */
 
-import { type ChildProcessWithoutNullStreams, type ExecFileException, execFile, spawn } from "node:child_process";
+import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
+import { randomUUID } from "node:crypto";
 import fsp from "node:fs/promises";
+import Module from "node:module";
 import os from "node:os";
 import path from "node:path";
-import { createInterface } from "node:readline";
-import { promisify } from "node:util";
 import { afterEach, beforeEach, describe, expect, it } from "vitest";
 
 interface RpcMessage {
@@ -30,123 +30,49 @@ interface RpcMessage {
 
 /** Nothing listens here, so external Qdrant readiness fails without touching a real server. */
 const UNREACHABLE = "http://127.0.0.1:9";
-const execFileAsync = promisify(execFile);
 
-let child: ChildProcessWithoutNullStreams | undefined;
-let childClosed: Promise<void> | undefined;
+let child: { proc: ChildProcessWithoutNullStreams; closed: Promise<void> } | undefined;
 let workDir = "";
 
 beforeEach(async () => {
   workDir = await fsp.mkdtemp(path.join(os.tmpdir(), "socraticode-logging-protocol-"));
 });
 
-interface WindowsProcess {
-  ProcessId: number;
-  ParentProcessId: number;
-  CreationDate: string;
+function ownChild(proc: ChildProcessWithoutNullStreams): ChildProcessWithoutNullStreams {
+  child = { proc, closed: new Promise<void>((resolve) => proc.once("close", () => resolve())) };
+  return proc;
 }
 
-/** Allow bounded PowerShell/CIM startup and retain identities so reused PIDs are not cleanup targets. */
-async function windowsProcesses(): Promise<WindowsProcess[]> {
-  const started = Date.now();
-  const { stdout } = await execFileAsync("powershell.exe", [
-    "-NoProfile", "-NonInteractive", "-Command",
-    "$ErrorActionPreference = 'Stop'; Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,CreationDate | Select-Object ProcessId,ParentProcessId,CreationDate | ConvertTo-Json -Compress",
-  ], { timeout: 30_000 }).catch((cause) => {
-    const failure = cause as ExecFileException & { stdout?: string; stderr?: string };
-    const details = { code: failure.code, signal: failure.signal, killed: failure.killed, stdoutBytes: Buffer.byteLength(failure.stdout ?? ""), stderr: failure.stderr };
-    throw new Error(`Windows process lookup failed after ${Date.now() - started}ms: ${JSON.stringify(details)}`, { cause });
-  });
-  return JSON.parse(stdout);
+function closesWithin(closed: Promise<void>, ms: number): Promise<boolean> {
+  let timeout: ReturnType<typeof setTimeout> | undefined;
+  return Promise.race([
+    closed.then(() => true),
+    new Promise<false>((resolve) => { timeout = setTimeout(() => resolve(false), ms); }),
+  ]).finally(() => clearTimeout(timeout));
 }
 
-/** Close the server before deleting its files; fail explicitly if shutdown needs forced termination. */
-async function stopServer(
-  timeoutMs = 15_000,
-  beforeForcedTermination?: () => Promise<void>,
-  lookup = process.platform === "win32" ? windowsProcesses : undefined,
-): Promise<void> {
-  const proc = child;
-  const windowsPids = lookup && proc?.pid !== undefined ? [proc.pid] : [];
-  let windowsSnapshot: WindowsProcess[] | undefined;
-  let lookupError: Error | undefined;
-  if (lookup && windowsPids.length) {
-    try {
-      windowsSnapshot = await lookup();
-      // Retain descendants before EOF can make their wrapper exit.
-      for (const parent of windowsPids) {
-        for (const entry of windowsSnapshot) {
-          if (entry.ParentProcessId === parent && !windowsPids.includes(entry.ProcessId)) windowsPids.push(entry.ProcessId);
-        }
-      }
-    } catch (cause) {
-      lookupError = cause instanceof Error ? cause : new Error("Windows process lookup failed", { cause });
-    }
-  }
-  let shutdownTimedOut = false;
-  if (proc && proc.exitCode === null && proc.signalCode === null) {
-    // EOF reaches the server through the tsx wrapper; wait for its streams
-    // to close before removing a directory the server can still log into.
-    proc.stdin.end();
-  }
-  if (proc && childClosed) {
-    let timeout: ReturnType<typeof setTimeout> | undefined;
-    try {
-      shutdownTimedOut = await Promise.race([
-        childClosed.then(() => false),
-        new Promise<true>((resolve) => { timeout = setTimeout(() => resolve(true), timeoutMs); }),
-      ]);
-      if (shutdownTimedOut && proc.pid !== undefined) {
-        if (beforeForcedTermination) await beforeForcedTermination();
-        if (lookup) {
-          if (!windowsSnapshot) {
-            throw new Error(`MCP logging server did not close within ${timeoutMs} milliseconds after stdin EOF; Windows process identities could not be verified for forced termination; temporary files were retained.`, { cause: lookupError });
-          }
-          const currentProcesses = await lookup();
-          for (const pid of windowsPids.reverse()) {
-         
```

**File**: `tests/unit/provider-ollama-connection-pool.test.ts` (modified, +17/-5)
```diff
@@ -21,6 +21,7 @@ describe("ollama connection pool", () => {
   let openSockets: Set<Socket>;
   let failNext = 0;
   let requiredAuthorization: string | undefined;
+  let rejectedStatus: number;
   let authorizations: (string | undefined)[];
   let redirectLocation: string | undefined;
   let redirectStatus: number;
@@ -29,6 +30,7 @@ describe("ollama connection pool", () => {
     opened = 0;
     failNext = 0;
     requiredAuthorization = undefined;
+    rejectedStatus = 401;
     authorizations = [];
     redirectLocation = undefined;
     redirectStatus = 307;
@@ -43,8 +45,8 @@ describe("ollama connection pool", () => {
           return;
         }
         if (requiredAuthorization && req.headers.authorization !== requiredAuthorization) {
-          res.writeHead(401, { "content-type": "application/json" });
-          res.end(JSON.stringify({ error: "Unauthorized" }));
+          res.writeHead(rejectedStatus, { "content-type": "application/json" });
+          res.end(JSON.stringify({ error: "private upstream response" }));
           return;
         }
         if (failNext > 0) {
@@ -206,7 +208,8 @@ describe("ollama connection pool", () => {
     expect(authorizations).toEqual(["Bearer fixture-key-one", undefined]);
   });
 
-  it("rejects an invalid key without including it in the error", async () => {
+  it.each([401, 403])("reports HTTP %i without reflecting the key or the upstream response", async (status) => {
+    rejectedStatus = status;
     requiredAuthorization = "Bearer fixture-key-one";
     const invalidKey = "fixture-invalid-key";
     process.env.OLLAMA_API_KEY = invalidKey;
@@ -217,10 +220,19 @@ describe("ollama connection pool", () => {
       failure = error;
     }
     expect(failure).toBeInstanceOf(Error);
-    expect(String(failure)).toContain("Unauthorized");
+    expect(String(failure)).toContain(`HTTP ${status}`);
+    expect(String(failure)).not.toContain("private upstream response");
     expect(String(failure)).not.toContain(invalidKey);
   });
 
+  it("keeps URL credentials out of the SDK request error", async () => {
+    process.env.OLLAMA_URL = `http://private-user:private-password@127.0.0.1:${port}/private-path`;
+    await expect(new OllamaEmbeddingProvider().embed(["test"])).rejects.toThrow(
+      /^Ollama cannot use credentials embedded in the URL\. Use OLLAMA_API_KEY instead\.$/,
+    );
+    expect(authorizations).toEqual([]);
+  });
+
   it("rechecks readiness after the configured key changes", async () => {
     requiredAuthorization = "Bearer fixture-key-one";
     process.env.OLLAMA_API_KEY = "fixture-key-one";
@@ -229,7 +241,7 @@ describe("ollama connection pool", () => {
 
     process.env.OLLAMA_API_KEY = "fixture-invalid-key";
     resetEmbeddingConfig();
-    await expect(provider.ensureReady()).rejects.toThrow("Ollama is not reachable");
+    await expect(provider.ensureReady()).rejects.toThrow(/HTTP 401.*OLLAMA_API_KEY/);
     expect(authorizations.at(-1)).toBe("Bearer fixture-invalid-key");
   });
 
```

---

### Incident Patch 3: `3d9c5b2d` (2026-11-04)
**Commit Message**: test: keep Windows descendant fixture alive

**File**: `tests/unit/mcp-logging-protocol.test.ts` (modified, +8/-3)
```diff
@@ -15,6 +15,7 @@ import { type ChildProcessWithoutNullStreams, execFile, spawn } from "node:child
 import fsp from "node:fs/promises";
 import os from "node:os";
 import path from "node:path";
+import { createInterface } from "node:readline";
 import { promisify } from "node:util";
 import { afterEach, beforeEach, describe, expect, it } from "vitest";
 
@@ -227,8 +228,10 @@ const occurrences = (text: string, needle: string): number => text.split(needle)
 
 describe("MCP logging over stdio", () => {
   it.each(["exit", "close", "exit before EOF"] as const)("cleans up and retains the timeout error when %s precedes forced termination", async (event) => {
-    const descendant = "const descendant = require('node:child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'inherit', 'inherit'] }); descendant.unref(); process.stdout.write(String(descendant.pid)); ";
-    const script = `${event !== "close" ? descendant : "process.stdout.write('ready');"}process.stdin.resume(); setInterval(() => {}, 1000);`;
+    // Windows otherwise ends the child with its parent's job instead of retaining the pipes.
+    const descendantScript = "setInterval(() => {}, 1000); process.stdout.write(String(process.pid) + '\\n');";
+    const descendant = `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendantScript)}], { detached: process.platform === 'win32', stdio: ['ignore', 'inherit', 'inherit'] }).unref(); `;
+    const script = `${event !== "close" ? descendant : "process.stdout.write('ready\\n');"}process.stdin.resume(); setInterval(() => {}, 1000);`;
     const proc = spawn(process.execPath, ["-e", script], {
       stdio: ["pipe", "pipe", "pipe"],
       detached: process.platform !== "win32",
@@ -238,7 +241,9 @@ describe("MCP logging over stdio", () => {
     const closed = new Promise<void>((resolve) => proc.once("close", () => resolve()));
     childClosed = closed;
     proc.stderr.resume();
-    const descendantPid = await new Promise<number>((resolve) => proc.stdout.once("data", (chunk) => resolve(Number(String(chunk)))));
+    const descendantPid = await new Promise<number>((resolve) => {
+      createInterface({ input: proc.stdout }).once("line", (line) => resolve(Number(line)));
+    });
 
     let terminationStarted = false;
     if (event === "exit before EOF") {
```

#### Recent Merged Pull Requests:
- **PR #215** (2026-11-04): Fix Ollama credential handling and MCP test teardown (@giancarloerra)
- **PR #214** (2026-11-04): chore: update packages and fix Ollama proxy authentication (@giancarloerra)
- **PR #212** (2026-11-02): fix: resolve TS/JS monorepo imports per importer and workspace exports (@giancarloerra)
- **PR #210** (2026-10-23): fix(search): name the filter when a filtered codebase_search finds nothing (@gnyan-zadara)
- **PR #209** (2026-10-23): fix(graph): name C# declarations by their name field and capture type, creation and qualified-call edges (@pcherkashin)
- **PR #206** (2026-10-15): fix(graph): name attributed PHP declarations by their name field (@pma1999)

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

## X. preserve Ollama policy errors and late-exit cleanup

**RULE**:
When implementing operations in `src/services/provider-ollama.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in giancarloerra/SocratiCode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `106bb398`: preserve Ollama policy errors and late-exit cleanup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/services/provider-ollama.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  } catch (error) {
    if (error instanceof OllamaTransportError) throw error;
  } catch (error) {
    if (error instanceof OllamaTransportError) throw error;
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  } catch {
  } catch {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `106bb398` are properly handled with clean fallback behavior.
