# Forensic Learning Record (Deep Inspection): Kuberwastaken/claurst

> **Canonical Artifact**: `07_PROJECT_LEARNING/kuberwastaken-claurst-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kuberwastaken/claurst](https://github.com/Kuberwastaken/claurst))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:33:18.749Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuberwastaken/claurst`
- **Description**: Agentic Coding for Builders who Ship
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10314 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `editors/vscode/media/main.js`
```
// Webview-side script. Runs in a restricted context with no Node access;
// all agent communication goes through the extension host via postMessage.
(function () {
  const vscode = acquireVsCodeApi();
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('input-box');
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');

  let currentAgentBubble = null;
  const toolCallEls = new Map();

  function appendRow(text, cls) {
    const row = document.createElement('div');
    row.className = 'row ' + cls;
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + cls;
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function statusIcon(status) {
    if (status === 'completed') return '✓';
    if (status === 'failed') return '✗';
    if (status === 'in_progress' || status === 'pending') return '◌';
    return '•';
  }

  // The initial tool_call event carries a title; the tool_call_update sent
  // on completion never does (the agent only sends status + content there).
  // Remember the title on the element itself so completion doesn't blank it.
  function upsertToolCall(id, title, status) {
    let el = id ? toolCallEls.get(id) : null;
    if (!el) {
      el = document.createElement('div');
      el.className = 'tool-call';
      messagesEl.appendChild(el);
      if (id) {
        toolCallEls.set(id, el);
      }
    }
    if (title) {
      el.dataset.title = title;
    }
    el.className = 'tool-call ' + (status || '');
    el.textContent = `${statusIcon(status)} ${el.dataset.title || '(tool call)'}`;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    stopBtn.classList.toggle('hidden', !busy);
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
  }
  inputEl.addEventListener('input', autoResize);

  function send() {
    const text = inputEl.value.trim();
    if (!text) {
      return;
    }
    appendRow(text, 'user');
    inputEl.value = '';
    autoResize();
    currentAgentBubble = null;
    setBusy(true);
    vscode.postMessage({ type: 'prompt', text });
  }

  sendBtn.addEventListener('click', send);
  stopBtn.addEventListener('click', () => vscode.postMessage({ type: 'stop' }));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  setBusy(false);

  window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
      case 'textChunk': {
        const cls = msg.isThought ? 'thought' : 'agent';
        if (!currentAgentBubble || currentAgentBubble.dataset.cls !== cls) {
          currentAgentBubble = appendRow('', cls);
          currentAgentBubble.dataset.cls = cls;
        }
        currentAgentBubble.textContent += msg.text;
        messagesEl.scrollTop = messagesEl.scrollHeight;
        break;
      }
      case 'toolCall':
      case 'toolCallUpdate': {
        currentAgentBubble = null;
        upsertToolCall(msg.toolCallId, msg.title, msg.status);
        break;
      }
      case 'status': {
        currentAgentBubble = null;
        appendRow(msg.text, 'system');
        break;
      }
      case 'turnEnded': {
        currentAgentBubble = null;
        setBusy(false);
        break;
      }
      default:
        break;
    }
  });
})();

```

### Core Architecture Module: `editors/vscode/src/acpClient.ts`
```
import * as cp from 'child_process';
import * as readline from 'readline';
import { extractText, parseLine } from './acpProtocol';

/** Speaks ACP to a `claurst acp` child process over stdio. Wire parsing
 * itself lives in acpProtocol.ts; this class owns the process, the
 * pending-request map, and dispatch to caller-supplied event callbacks. */

export type PermissionOption = {
  optionId: string;
  name: string;
  kind: string;
};

export type ToolCallUpdate = {
  toolCallId?: string;
  title?: string;
  status?: string;
  kind?: string;
};

export interface AcpClientEvents {
  onTextChunk?: (text: string, isThought: boolean) => void;
  onToolCall?: (update: ToolCallUpdate) => void;
  onToolCallUpdate?: (update: ToolCallUpdate) => void;
  /** Return the chosen option id, or `undefined` to cancel the request
   * (e.g. the user dismissed the picker without choosing). */
  onRequestPermission?: (toolCall: ToolCallUpdate, options: PermissionOption[]) => Promise<string | undefined>;
  onStderr?: (line: string) => void;
  onExit?: (code: number | null) => void;
}

export class AcpClient {
  private child: cp.ChildProcessWithoutNullStreams;
  private rl: readline.Interface;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private sessionId: string | undefined;

  constructor(executablePath: string, cwd: string, private events: AcpClientEvents) {
    this.child = cp.spawn(executablePath, ['acp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    this.rl = readline.createInterface({ input: this.child.stdout });
    this.rl.on('line', (line) => this.handleLine(line));
    this.child.stderr.on('data', (data: Buffer) => {
      const text = data.toString('utf8');
      for (const line of text.split('\n')) {
        if (line.trim().length > 0) {
          this.events.onStderr?.(line);
        }
      }
    });
    this.child.on('exit', (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error('claurst acp process exited'));
      }
      this.pending.clear();
      this.events.onExit?.(code);
    });
  }

  private handleLine(line: string): void {
    const parsed = parseLine(line);
    if (!parsed) {
      if (line.trim().length > 0) {
        this.events.onStderr?.(`[claurst-vscode] malformed line from agent: ${line.trim()}`);
      }
      return;
    }

    switch (parsed.kind) {
      case 'response': {
        const pending = this.pending.get(parsed.id);
        if (!pending) {
          return;
        }
        this.pending.delete(parsed.id);
        if (parsed.error) {
          pending.reject(Object.assign(new Error(parsed.error.message ?? 'ACP error'), { data: parsed.error }));
        } else {
          pending.resolve(parsed.result);
        }
        return;
      }
      case 'request':
        // Agent → client request. Only session/request_permission is expected in v1.
        this.handleIncomingRequest(parsed.id, parsed.method, parsed.params).catch((e) => {
          this.events.onStderr?.(`[claurst-vscode] failed to handle ${parsed.method}: ${e}`);
        });
        return;
      case 'notification':
        this.handleNotification(parsed.method, parsed.params);
        return;
    }
  }

  private async handleIncomingRequest(id: number, method: string, params: any): Promise<void> {
    if (method === 'session/request_permission') {
      const toolCall: ToolCallUpdate = {
        toolCallId: params?.toolCall?.toolCallId,
        title: params?.toolCall?.title,
        status: params?.toolCall?.status,
        kind: params?.toolCall?.kind,
      };
      const options: PermissionOption[] = (params?.options ?? []).map((o: any) => ({
        optionId: o.optionId,
        name: o.name,
        kind: o.kind,
      }));
      const chosen = await this.events.onRequestPermission?.(toolCall, options);
      // No selection (dismissed picker, or no handler wired up) must NOT
      // grant an option — respond Cancelled, matching the ACP spec's
      // Cancelled outcome rather than guessing an option to grant.
      const result = chosen
        ? { outcome: { outcome: 'selected', optionId: chosen } }
        : { outcome: { outcome: 'cancelled' } };
      this.writeMessage({ jsonrpc: '2.0', id, result });
      return;
    }

    // Unknown incoming request — respond with method-not-found so the agent
    // doesn't hang waiting for a reply.
    this.writeMessage({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `client does not implement '${method}'` },
    });
  }

  private handleNotification(method: string, params: any): void {
    if (method === 'session/update') {
      const update = params?.update;
      if (!update) {
        return;
      }
      switch (update.sessionUpdate) {
        case 'agent_message_chunk':
          this.events.onTextChunk?.(extractText(update.content), false);
          break;
        case 'agent_thought_chunk':
          this.events.onTextChunk?.(extractText(update.content), true);
          break;
        case 'tool_call':
          this.events.onToolCall?.({
            toolCallId: update.toolCallId,
            title: update.title,
            status: update.status,
            kind: update.kind,
          });
          break;
        case 'tool_call_update':
          this.events.onToolCallUpdate?.({
            toolCallId: update.toolCallId,
            title: update.title,
            status: update.status,
            kind: update.kind,
          });
          break;
        default:
          break;
      }
    }
  }

  private writeMessage(msg: unknown): void {
    this.child.stdin.write(JSON.stringify(msg) + '\n');
  }

  private request<T = any>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.writeMessage({ jsonrpc: '2.0', id, method, params });
    });
  }

  private notify(method: string, params: unknown): void {
    this.writeMessage({ jsonrpc: '2.0', method, params });
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: 'claurst-vscode', version: '0.1.0' },
    });
  }

  async newSession(cwd: string): Promise<string> {
    const result = await this.request<{ sessionId: string }>('session/new', {
      cwd,
      mcpServers: [],
    });
    this.sessionId = result.sessionId;
    return result.sessionId;
  }

  async prompt(text: string): Promise<void> {
    if (!this.sessionId) {
      throw new Error('no active session; call newSession() first');
    }
    await this.request('session/prompt', {
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    });
  }

  cancel(): void {
    if (this.sessionId) {
      this.notify('session/cancel', { sessionId: this.sessionId });
    }
  }

  dispose(): void {
    this.rl.close();
    this.child.kill();
  }
}

```

### Core Architecture Module: `editors/vscode/src/acpProtocol.ts`
```
/**
 * Pure message parsing for the newline-delimited JSON-RPC 2.0 wire format
 * used by the Agent Client Protocol, matching
 * src-rust/crates/acp/src/connection.rs. No child_process / IO here — kept
 * separate so the routing logic is unit-testable without spawning anything.
 */

export type ParsedMessage =
  | { kind: 'response'; id: number; result?: unknown; error?: { code: number; message: string; data?: unknown } }
  | { kind: 'request'; id: number; method: string; params: unknown }
  | { kind: 'notification'; method: string; params: unknown };

/** Parses one line of the wire protocol. Returns `null` for a blank line or
 * a line that isn't a well-formed JSON-RPC message. */
export function parseLine(line: string): ParsedMessage | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let msg: any;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof msg !== 'object' || msg === null) {
    return null;
  }

  const hasId = msg.id !== undefined && msg.id !== null;
  const hasResult = 'result' in msg;
  const hasError = 'error' in msg;
  const hasMethod = typeof msg.method === 'string';

  if (hasId && (hasResult || hasError) && !hasMethod) {
    return { kind: 'response', id: msg.id, result: msg.result, error: msg.error };
  }
  if (hasId && hasMethod) {
    return { kind: 'request', id: msg.id, method: msg.method, params: msg.params };
  }
  if (hasMethod) {
    return { kind: 'notification', method: msg.method, params: msg.params };
  }
  return null;
}

/** Extracts plain text from an ACP `ContentBlock` (only the `text` variant
 * is meaningful for the chat transcript; other variants render as empty). */
export function extractText(content: any): string {
  if (!content) {
    return '';
  }
  if (content.type === 'text') {
    return content.text ?? '';
  }
  return '';
}

```

### Core Architecture Module: `editors/vscode/src/chatPanel.ts`
```
import * as os from 'os';
import * as vscode from 'vscode';
import { AcpClient, PermissionOption, ToolCallUpdate } from './acpClient';

/** Owns one webview panel and its backing AcpClient/session. */
export class ChatPanel {
  public static current: ChatPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private client: AcpClient | undefined;
  private readonly outputChannel: vscode.OutputChannel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel): ChatPanel {
    if (ChatPanel.current) {
      ChatPanel.current.panel.reveal();
      return ChatPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      'claurstChat',
      'Claurst',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')] },
    );
    ChatPanel.current = new ChatPanel(panel, extensionUri, outputChannel);
    return ChatPanel.current;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, outputChannel: vscode.OutputChannel) {
    this.panel = panel;
    this.outputChannel = outputChannel;
    this.panel.webview.html = this.renderHtml(extensionUri);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleWebviewMessage(msg),
      null,
      this.disposables,
    );
    this.startSession().catch((e) => this.reportError(e));
  }

  private renderHtml(extensionUri: vscode.Uri): string {
    const webview = this.panel.webview;
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.css'));
    const nonce = String(Math.random()).slice(2);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Claurst</title>
</head>
<body>
  <div id="messages"></div>
  <div id="input-row">
    <textarea id="input-box" rows="1" placeholder="Ask claurst..."></textarea>
    <button id="send-btn" title="Send (Enter)">Send</button>
    <button id="stop-btn" title="Cancel the current turn">Stop</button>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private async startSession(): Promise<void> {
    // Prefer the first workspace folder, but don't block chat on one being
    // open — fall back to the user's home directory so the panel is always
    // usable, matching how a plain terminal session would behave.
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir();
    const executablePath = vscode.workspace.getConfiguration('claurst').get<string>('executablePath', 'claurst');

    this.client = new AcpClient(executablePath, cwd, {
      onTextChunk: (text, isThought) => this.postToWebview({ type: 'textChunk', text, isThought }),
      onToolCall: (update) => this.postToWebview({ type: 'toolCall', ...toolCallPayload(update) }),
      onToolCallUpdate: (update) => this.postToWebview({ type: 'toolCallUpdate', ...toolCallPayload(update) }),
      onRequestPermission: (toolCall, options) => this.promptForPermission(toolCall, options),
      onStderr: (line) => this.outputChannel.appendLine(line),
      onExit: (code) => {
        this.postToWebview({ type: 'status', text: `claurst process exited (code ${code ?? 'unknown'}).` });
      },
    });

    try {
      await this.client.initialize();
      await this.client.newSession(cwd);
      this.postToWebview({ type: 'status', text: `Session started in ${cwd}` });
    } catch (e) {
      this.reportError(e);
    }
  }

  /**
   * Returns the chosen option id, or `undefined` if the user dismissed the
   * quick pick without choosing. `undefined` is sent back to the agent as a
   * `Cancelled` outcome (not an implicit grant) — see acpClient's
   * handleIncomingRequest.
   */
  private async promptForPermission(toolCall: ToolCallUpdate, options: PermissionOption[]): Promise<string | undefined> {
    const picked = await vscode.window.showQuickPick(
      options.map((o) => ({ label: o.name, description: o.kind, optionId: o.optionId })),
      { placeHolder: toolCall.title ?? 'Claurst is requesting permission', ignoreFocusOut: true },
    );
    return picked?.optionId;
  }

  private handleWebviewMessage(msg: any): void {
    switch (msg.type) {
      case 'prompt':
        if (typeof msg.text === 'string') {
          this.runPrompt(msg.text);
        }
        break;
      case 'stop':
        this.cancelCurrentTurn();
        break;
      default:
        break;
    }
  }

  /** Runs a prompt to completion, signalling turnEnded either way so the
   * webview can re-enable Send / hide Stop. */
  private async runPrompt(text: string): Promise<void> {
    try {
      await this.client?.prompt(text);
    } catch (e) {
      this.reportError(e);
    } finally {
      this.postToWebview({ type: 'turnEnded' });
    }
  }

  cancelCurrentTurn(): void {
    this.client?.cancel();
  }

  private postToWebview(msg: unknown): void {
    this.panel.webview.postMessage(msg);
  }

  private reportError(e: unknown): void {
    const message = e instanceof Error ? e.message : String(e);
    this.outputChannel.appendLine(`[claurst-vscode] ${message}`);
    this.postToWebview({ type: 'status', text: `Error: ${message}` });
  }

  dispose(): void {
    ChatPanel.current = undefined;
    this.client?.dispose();
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function toolCallPayload(update: ToolCallUpdate) {
  return { toolCallId: update.toolCallId, title: update.title, status: update.status, kind: update.kind };
}

```

### Core Architecture Module: `editors/vscode/src/extension.ts`
```
import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Claurst');
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand('claurst.openChat', () => {
      ChatPanel.createOrShow(context.extensionUri, outputChannel);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claurst.newSession', () => {
      ChatPanel.current?.dispose();
      ChatPanel.createOrShow(context.extensionUri, outputChannel);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claurst.stopSession', () => {
      ChatPanel.current?.cancelCurrentTurn();
    }),
  );
}

export function deactivate(): void {
  ChatPanel.current?.dispose();
}

```

### Core Architecture Module: `npm/install.js`
```
#!/usr/bin/env node
'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const pkg = require('./package.json');
const VERSION = pkg.version;
const REPO = 'kuberwastaken/claurst';
const BASE_URL = `https://github.com/${REPO}/releases/download/v${VERSION}`;
const NATIVE_DIR = path.join(__dirname, 'native');

function getPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'win32' && arch === 'x64') {
    return { artifact: 'claurst-windows-x86_64', ext: '.exe', archive: '.zip' };
  }
  if (platform === 'linux' && arch === 'x64') {
    return { artifact: 'claurst-linux-x86_64', ext: '', archive: '.tar.gz' };
  }
  if (platform === 'linux' && arch === 'arm64') {
    return { artifact: 'claurst-linux-aarch64', ext: '', archive: '.tar.gz' };
  }
  if (platform === 'darwin' && arch === 'x64') {
    return { artifact: 'claurst-macos-x86_64', ext: '', archive: '.tar.gz' };
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return { artifact: 'claurst-macos-aarch64', ext: '', archive: '.tar.gz' };
  }
  throw new Error(
    `Unsupported platform: ${platform}/${arch}.\n` +
    `Install manually from: https://github.com/${REPO}/releases/tag/v${VERSION}`
  );
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https : http;
    get.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch (_) {}
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', (err) => {
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(err);
      });
    }).on('error', (err) => {
      try { fs.unlinkSync(dest); } catch (_) {}
      reject(err);
    });
  });
}

async function main() {
  const { artifact, ext, archive } = getPlatform();
  const archiveName = `${artifact}${archive}`;
  const url = `${BASE_URL}/${archiveName}`;
  const tmpPath = path.join(os.tmpdir(), `claurst-install-${process.pid}${archive}`);
  const binaryDest = path.join(NATIVE_DIR, `claurst${ext}`);

  if (fs.existsSync(binaryDest)) {
    console.log('claurst: native binary already present, skipping download.');
    return;
  }

  fs.mkdirSync(NATIVE_DIR, { recursive: true });

  console.log(`claurst: downloading v${VERSION} for ${process.platform}/${process.arch}`);
  console.log(`         ${url}`);
  await download(url, tmpPath);

  console.log('claurst: extracting...');
  if (archive === '.zip') {
    execFileSync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -Force -Path "${tmpPath}" -DestinationPath "${NATIVE_DIR}"`
    ]);
  } else {
    execFileSync('tar', ['-xzf', tmpPath, '-C', NATIVE_DIR]);
  }

  try { fs.unlinkSync(tmpPath); } catch (_) {}

  if (!fs.existsSync(binaryDest)) {
    throw new Error(`Extraction succeeded but binary not found at ${binaryDest}`);
  }

  if (ext === '') {
    fs.chmodSync(binaryDest, 0o755);
  }

  console.log(`claurst: ready — run \`claurst\` to start.`);
}

main().catch((err) => {
  console.error(`\nclaurst install failed: ${err.message}`);
  console.error(`Manual install: https://github.com/${REPO}/releases/tag/v${VERSION}\n`);
  process.exit(1);
});

```

### Core Architecture Module: `scripts/append-patch-note.py`
```
#!/usr/bin/env python3
"""Prepend a patch bullet to a GitHub release's body, idempotent across runs.

Required env vars:
  REPO          owner/name (e.g. kuberwastaken/claurst)
  TAG           release tag to amend (e.g. v0.1.1)
  PATCH_BULLET  the markdown line to insert, e.g.
                  - fix(tui): scroll regression ([`abc1234`](https://github.com/.../commit/abc1234567))

Behaviour:
  - If the release body already starts with `## 🩹 Patches`, the new bullet is
    appended to that section's bullet list (so successive patches stack at the
    top in order).
  - Otherwise a new `## 🩹 Patches` section is prepended, leaving the rest of
    the existing body (categories, contributors, full-changelog footer)
    completely untouched.

Reads the current body via `gh release view --json body` and writes the new
body via `gh release edit --notes-file`.  No other release metadata is touched.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

HEADING = "## 🩹 Patches"


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def fetch_body(repo: str, tag: str) -> str:
    out = subprocess.run(
        [
            "gh", "release", "view", tag,
            "--repo", repo,
            "--json", "body",
        ],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out).get("body") or ""


def splice(body: str, bullet: str) -> str:
    # Normalise line endings; gh returns \n already but be defensive.
    body = body.replace("\r\n", "\n").rstrip("\n")
    bullet = bullet.rstrip("\n")

    lines = body.split("\n") if body else []

    # Locate a leading "## 🩹 Patches" heading, tolerating leading blank lines.
    head_idx = 0
    while head_idx < len(lines) and lines[head_idx].strip() == "":
        head_idx += 1

    if head_idx < len(lines) and lines[head_idx].strip() == HEADING:
        # Append to existing patch list — walk past the heading and any
        # immediate blank line, then past the existing `- …` bullets,
        # then insert the new bullet right after the last one so order
        # preserves chronology (oldest patch on top, newest below it).
        j = head_idx + 1
        while j < len(lines) and lines[j].strip() == "":
            j += 1
        while j < len(lines) and lines[j].startswith("- "):
            j += 1
        lines.insert(j, bullet)
        return "\n".join(lines) + "\n"

    # No existing patch section — prepend one without disturbing anything else.
    new_section = [HEADING, "", bullet]
    if body:
        new_section.append("")  # blank line between our section and the rest
        new_section.append(body)
    return "\n".join(new_section) + "\n"


def main() -> None:
    repo = os.environ.get("REPO") or die("REPO env var is required")
    tag = os.environ.get("TAG") or die("TAG env var is required")
    bullet = os.environ.get("PATCH_BULLET") or die("PATCH_BULLET env var is required")

    if not bullet.lstrip().startswith("- "):
        die(f"PATCH_BULLET must start with '- ' (got: {bullet!r})")

    body = fetch_body(repo, tag)
    new_body = splice(body, bullet)

    out_path = Path("new-release-body.md")
    out_path.write_text(new_body, encoding="utf-8")

    subprocess.run(
        [
            "gh", "release", "edit", tag,
            "--repo", repo,
            "--notes-file", str(out_path),
        ],
        check=True,
    )
    print(f"Appended patch note to {tag}.")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/bump-version.py`
```
#!/usr/bin/env python3
"""Stamp a new Claurst version into every canonical source.

Usage: scripts/bump-version.py vMAJOR.MINOR.PATCH

Touches:
  - src-rust/Cargo.toml                 workspace.package.version
  - src-rust/Cargo.lock                 12 claurst* workspace package entries
  - npm/package.json                    version field
  - README.md                           shields.io badge (text + alt) + Beta callout
  - docs/index.md                       **Version:** line
  - docs/installation.md                "claurst X.Y.Z" sample output
  - src-rust/crates/acp/registry-template/agent.json
                                        version field + 5 release download URLs

Fails loudly if any expected pattern is missing — that means the file shape
changed and the script needs updating, not silently producing a half-stamped
release.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def die(msg: str) -> None:
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def replace(path: Path, pattern: str, repl: str, *, count: int = 0, flags: int = re.MULTILINE) -> None:
    text = path.read_text(encoding="utf-8")
    new, n = re.subn(pattern, repl, text, count=count, flags=flags)
    if n == 0:
        die(f"no matches for {pattern!r} in {path.relative_to(ROOT)}")
    if new != text:
        path.write_text(new, encoding="utf-8")
    print(f"  {path.relative_to(ROOT)}: {n} replacement(s)")


def bump_cargo_lock(version: str) -> None:
    """Rewrite every workspace [[package]] block (those without a `source = ` line)."""
    path = ROOT / "src-rust" / "Cargo.lock"
    text = path.read_text(encoding="utf-8")

    blocks = re.split(r"(?=^\[\[package\]\]$)", text, flags=re.MULTILINE)
    touched = 0
    for i, block in enumerate(blocks):
        if not block.startswith("[[package]]"):
            continue
        if re.search(r"^source = ", block, flags=re.MULTILINE):
            continue  # registry / git dep — leave alone
        name_match = re.search(r'^name = "([^"]+)"', block, flags=re.MULTILINE)
        if not name_match or not name_match.group(1).startswith("claurst"):
            continue  # any future non-claurst path dep — also leave alone
        new_block, n = re.subn(
            r'^version = "[^"]+"$',
            f'version = "{version}"',
            block,
            count=1,
            flags=re.MULTILINE,
        )
        if n != 1:
            die(f"Cargo.lock: workspace block for {name_match.group(1)} had no version line")
        blocks[i] = new_block
        touched += 1

    if touched == 0:
        die("Cargo.lock: found zero workspace package blocks — file shape changed?")
    path.write_text("".join(blocks), encoding="utf-8")
    print(f"  src-rust/Cargo.lock: {touched} workspace package(s)")


def main() -> None:
    if len(sys.argv) != 2:
        die("usage: bump-version.py vMAJOR.MINOR.PATCH")

    tag = sys.argv[1]
    m = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", tag)
    if not m:
        die(f"invalid tag {tag!r} — expected vMAJOR.MINOR.PATCH")
    version = f"{m.group(1)}.{m.group(2)}.{m.group(3)}"

    print(f"Stamping version {version} ({tag}):")

    # 1. Cargo.toml (workspace.package.version — first `version = "..."` line)
    replace(
        ROOT / "src-rust" / "Cargo.toml",
        r'^version = "\d+\.\d+\.\d+"$',
        f'version = "{version}"',
        count=1,
    )

    # 2. Cargo.lock — every claurst* workspace package
    bump_cargo_lock(version)

    # 3. npm/package.json
    pkg_path = ROOT / "npm" / "package.json"
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    pkg["version"] = version
    pkg_path.write_text(json.dumps(pkg, indent=2) + "\n", encoding="utf-8")
    print(f"  npm/package.json")

    # 4. README.md badge + Beta callout
    readme = ROOT / "README.md"
    replace(readme, r"Version-\d+\.\d+\.\d+-2E8B57", f"Version-{version}-2E8B57", count=1)
    replace(readme, r'alt="Version \d+\.\d+\.\d+"', f'alt="Version {version}"', count=1)
    replace(readme, r"Beta \(v\d+\.\d+\.\d+\)", f"Beta (v{version})", count=1)

    # 5. docs/index.md
    replace(
        ROOT / "docs" / "index.md",
        r"\*\*Version:\*\* \d+\.\d+\.\d+",
        f"**Version:** {version}",
        count=1,
    )

    # 6. docs/installation.md — sample output line ("claurst X.Y.Z")
    replace(
        ROOT / "docs" / "installation.md",
        r"^claurst \d+\.\d+\.\d+$",
        f"claurst {version}",
        count=1,
    )

    # 7. ACP registry template — version field + 5 release download URLs
    agent = ROOT / "src-rust" / "crates" / "acp" / "registry-template" / "agent.json"
    text = agent.read_text(encoding="utf-8")
    text, n_v = re.subn(r'"version": "\d+\.\d+\.\d+"', f'"version": "{version}"', text, count=1)
    text, n_u = re.subn(r"/releases/download/v\d+\.\d+\.\d+/", f"/releases/download/v{version}/", text)
    if n_v != 1:
        die("agent.json: version field not found")
    if n_u == 0:
        die("agent.json: no /releases/download/vX.Y.Z/ URLs found")
    agent.write_text(text, encoding="utf-8")
    print(f"  src-rust/crates/acp/registry-template/agent.json: 1 version + {n_u} URL(s)")

    print(f"\nStamped {version}.")


if __name__ == "__main__":
    main()

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

### Incident Patch 1: `7c041f88` (2026-08-22)
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
-      t
```

---

### Incident Patch 2: `6022e20a` (2026-08-22)
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
+        this.handleIncomingRequest(parsed.id,
```

---

### Incident Patch 3: `dda2b6f4` (2026-08-22)
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

### Incident Patch 4: `601c7be9` (2026-08-22)
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

### Incident Patch 5: `c445559e` (2026-08-22)
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
-        let endpoint = se
```

---

### Incident Patch 6: `3b2b3bcc` (2026-08-22)
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

### Incident Patch 7: `31286b3d` (2026-08-22)
**Commit Message**: fix: make nix dependency Unix-only for Windows compilation (#68)

The nix crate is Unix-only and was listed as an unconditional dependency
in the cli Cargo.toml, preventing compilation on Windows. The actual
usage in main.rs is already gated behind #[cfg(unix)], so this just
moves the dep to [target.'cfg(unix)'.dependencies] to match.

Co-authored-by: nullislander <nullislander@users.noreply.github.com>
Co-authored-by: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

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

### Incident Patch 8: `97a73161` (2026-08-22)
**Commit Message**: fix(npm): make CLI entrypoint executable (#188)



---

### Incident Patch 9: `74f1f81d` (2026-07-31)
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

### Incident Patch 10: `595b0ebe` (2026-07-31)
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

Co-authored-by: Kuber Mehta <kuberhob@gmail.com>

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
+            .with_context(|| format!("failed to stage new binary at {}", staged.path.displa
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
