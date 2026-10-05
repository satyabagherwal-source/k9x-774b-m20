# Forensic Learning Record (Deep Inspection): CaviraOSS/LongMemory

> **Canonical Artifact**: `07_PROJECT_LEARNING/caviraoss-longmemory-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/CaviraOSS/LongMemory](https://github.com/CaviraOSS/LongMemory))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:16:03.688Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `CaviraOSS/LongMemory`
- **Description**: Local persistent memory store for LLM applications including claude desktop, github copilot, codex, antigravity, etc.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 4513 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.prettierrc.js`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : .prettierrc.js
 *  usage : supports LongMemory .prettierrc
 */


export default {
    endOfLine: 'lf',
    printWidth: 120,
    singleQuote: true,
    tabWidth: 4,
    trailingComma: 'all',
};

```

### Core Architecture Module: `apps/vscode-extension/src/agent_changes.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : apps/vscode-extension/src/agent_changes.ts
 *  usage : supports the LongMemory VS Code extension agent changes
 */


import { createHash } from 'node:crypto';

export type agent_kind = 'copilot' | 'codex' | 'claude' | 'cursor' | 'windsurf' | 'other';
export type attribution_confidence = 'explicit' | 'heuristic';

export type pending_file_change = {
    path: string;
    language: string;
    before: string;
    after: string;
    changed_at: number;
};

export type pending_agent_change = {
    id: string;
    agent: agent_kind;
    confidence: attribution_confidence;
    started_at: number;
    updated_at: number;
    files: pending_file_change[];
};

export type rendered_agent_change = {
    text: string;
    metadata: {
        change_id: string;
        agent: agent_kind;
        attribution_confidence: attribution_confidence;
        files: string[];
        change_count: number;
        started_at: number;
        updated_at: number;
        truncated: boolean;
    };
};

const secret_path = /(^|[\\/])(?:\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials(?:\.json)?|secrets?(?:\.[^\\/]*)?|.*\.(?:pem|key|p12|pfx))$/i;
const binary_extension = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|exe|dll|so|dylib|wasm|woff2?|ttf|otf|mp[34]|mov|avi|sqlite|db)$/i;
const generated_path = /(^|[\\/])(?:\.git|\.longmemory|node_modules|dist|out|build|coverage)([\\/]|$)/i;
const credential_line = /(?:api[_-]?key|(?:access[_-]?|auth[_-]?)?token|client[_-]?secret|password|private[_-]?key|authorization)\s*[:=]|\bbearer\s+[a-z0-9._~+/=-]+|-----begin [a-z ]*private key-----/i;

export const should_capture_path = (path: string): boolean => !generated_path.test(path) && !secret_path.test(path) && !binary_extension.test(path);

export const redact_patch_line = (line: string): string => credential_line.test(line) ? '[redacted credential-like line]' : line;

type operation = { kind: 'equal' | 'add' | 'remove'; line: string; old_line: number; new_line: number };
type line_pair = { old_index: number; new_index: number };

const unique_lines = (lines: string[]): Map<string, number> => {
    const found = new Map<string, number>();
    const repeated = new Set<string>();
    lines.forEach((line, index) => {
        if (found.has(line)) repeated.add(line);
        else found.set(line, index);
    });
    for (const line of repeated) found.delete(line);
    return found;
};

const patience_anchors = (left: string[], right: string[]): line_pair[] => {
    const old_lines = unique_lines(left);
    const new_lines = unique_lines(right);
    const pairs = [...old_lines].flatMap(([line, old_index]) => {
        const new_index = new_lines.get(line);
        return new_index === undefined ? [] : [{ old_index, new_index }];
    }).sort((a, b) => a.old_index - b.old_index);
    const tails: number[] = [];
    const previous = new Int32Array(pairs.length).fill(-1);
    for (let index = 0; index < pairs.length; index++) {
        let low = 0;
        let high = tails.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            const tail = pairs[tails[middle] as number] as line_pair;
            if (tail.new_index < (pairs[index] as line_pair).new_index) low = middle + 1;
            else high = middle;
        }
        if (low) previous[index] = tails[low - 1] as number;
        tails[low] = index;
    }
    const anchors: line_pair[] = [];
    let index = tails.at(-1) ?? -1;
    while (index >= 0) {
        anchors.push(pairs[index] as line_pair);
        index = previous[index] ?? -1;
    }
    return anchors.reverse();
};

const diff_lines = (before: string, after: string): operation[] => {
    const left = before.split(/\r?\n/);
    const right = after.split(/\r?\n/);
    const operations: operation[] = [];
    let old_index = 0;
    let new_index = 0;
    let old_line = 1;
    let new_line = 1;
    const append = (kind: operation['kind'], line: string) => {
        operations.push({ kind, line, old_line, new_line });
        if (kind !== 'add') old_line++;
        if (kind !== 'remove') new_line++;
    };
    for (const anchor of patience_anchors(left, right)) {
        while (old_index < anchor.old_index) append('remove', left[old_index++] ?? '');
        while (new_index < anchor.new_index) append('add', right[new_index++] ?? '');
        append('equal', left[old_index] ?? '');
        old_index++;
        new_index++;
    }
    while (old_index < left.length) append('remove', left[old_index++] ?? '');
    while (new_index < right.length) append('add', right[new_index++] ?? '');
    return operations;
};

const render_hunks = (operations: operation[], context = 2): string[] => {
    const changed = operations.flatMap((operation, index) => operation.kind === 'equal' ? [] : [index]);
    const ranges: Array<[number, number]> = [];
    for (const index of changed) {
        const start = Math.max(0, index - context);
        const end = Math.min(operations.length - 1, index + context);
        const prior = ranges.at(-1);
        if (prior && start <= prior[1] + 1) prior[1] = Math.max(prior[1], end);
        else ranges.push([start, end]);
    }
    return ranges.map(([start, end]) => {
        const values = operations.slice(start, end + 1);
        const first = values[0] as operation;
        const old_count = values.filter((value) => value.kind !== 'add').length;
        const new_count = values.filter((value) => value.kind !== 'remove').length;
        return [
            `@@ -${first.old_line},${old_count} +${first.new_line},${new_count} @@`,
            ...values.map((value) => `${value.kind === 'add' ? '+' : value.kind === 'remove' ? '-' : ' '}${redact_patch_line(value.line)}`),
        ].join('\n');
    });
};

export const render_file_patch = (change: pending_file_change): string => {
    if (!should_capture_path(change.path) || change.before === change.after) return '';
    return [`--- a/${change.path}`, `+++ b/${change.path}`, ...render_hunks(diff_lines(change.before, change.after))].join('\n');
};

export const merge_file_change = (values: pending_file_change[], next: pending_file_change): pending_file_change[] => {
    const existing = values.find((value) => value.path === next.path);
    if (!existing) return [...values, next];
    return values.map((value) => value.path === next.path ? { ...next, before: value.before } : value);
};

export const change_id = (agent: agent_kind, at: number): string => createHash('sha256').update(`${agent}:${at}`).digest('hex').slice(0, 16);

const truncate_utf8 = (value: string, max_bytes: number): string => {
    const bytes = Buffer.from(value);
    if (bytes.length <= max_bytes) return value;
    let end = Math.max(0, max_bytes);
    while (end) {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, end)); }
        catch { end--; }
    }
    return '';
};

export const render_agent_change = (change: pending_agent_change, max_bytes: number): rendered_agent_change | null => {
    const rendered_files = change.files.flatMap((file) => {
        const patch = render_file_patch(file);
        return patch ? [{ path: file.path, patch }] : [];
    });
    if (!rendered_files.length) return null;
    const header = `AI agent change set\nAgent: ${change.agent}\nAttribution: ${change.confidence}\nFiles: ${rendered_files.length}\n\n`;
    const body = rendered_files.map((value) => value.patch).join('\n\n');
    let text = `${header}${body}`;
    let truncated =
```

### Core Architecture Module: `apps/vscode-extension/src/agent_tracker.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : apps/vscode-extension/src/agent_tracker.ts
 *  usage : supports the LongMemory VS Code extension agent tracker
 */


import * as vscode from 'vscode';
import {
    change_id,
    merge_file_change,
    render_agent_change,
    should_capture_path,
    type agent_kind,
    type pending_agent_change,
    type pending_file_change,
} from './agent_changes.js';
import { longmemory_cli } from './cli.js';

export type agent_tracker_status = { active: agent_kind | null; pending: number };

type queued_change = pending_agent_change & { resource: vscode.Uri };

type active_session = queued_change & {
    explicit: true;
    baselines: Map<string, string>;
    dirty: Map<string, vscode.Uri>;
    created: Set<string>;
    deleted: Set<string>;
    watcher: vscode.FileSystemWatcher;
};

const known_extensions: Array<{ ids: string[]; agent: agent_kind }> = [
    { ids: ['github.copilot', 'github.copilot-chat'], agent: 'copilot' },
    { ids: ['openai.chatgpt', 'openai.codex'], agent: 'codex' },
    { ids: ['anthropic.claude-code', 'anthropic.claude'], agent: 'claude' },
    { ids: ['codeium.windsurf', 'codeium.codeium'], agent: 'windsurf' },
];

const installed_agents = (): agent_kind[] => [...new Set(known_extensions
    .filter((candidate) => candidate.ids.some((id) => vscode.extensions.getExtension(id)))
    .map((candidate) => candidate.agent))];

const relative_path = (resource: vscode.Uri): string => vscode.workspace.asRelativePath(resource, false).replaceAll('\\', '/');
const snapshot_exclude = '{**/.git/**,**/.longmemory/**,**/node_modules/**,**/dist/**,**/out/**,**/build/**,**/coverage/**}';

export class agent_change_tracker implements vscode.Disposable {
    private readonly baselines = new Map<string, string>();
    private readonly heuristic = new Map<string, queued_change>();
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private readonly queue: queued_change[] = [];
    private readonly subscriptions: vscode.Disposable[] = [];
    private active: active_session | null = null;

    constructor(
        private readonly cli: longmemory_cli,
        private readonly output: vscode.OutputChannel,
        private readonly on_status: (status: agent_tracker_status) => void,
        private readonly after_record: () => Promise<void>,
    ) {
        for (const document of vscode.workspace.textDocuments) this.remember_baseline(document);
        this.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((document) => this.remember_baseline(document)),
            vscode.workspace.onDidCloseTextDocument((document) => this.baselines.delete(document.uri.toString())),
            vscode.workspace.onDidChangeTextDocument((event) => this.changed(event)),
            vscode.workspace.onDidSaveTextDocument((document) => this.saved(document)),
        );
    }

    status(): agent_tracker_status { return { active: this.active?.agent ?? null, pending: this.queue.length + this.heuristic.size }; }

    async start(preset_agent?: agent_kind, preset_label?: string): Promise<void> {
        if (this.active) {
            const replace = await vscode.window.showWarningMessage(`A ${this.active.agent} session is already active. Stop it first?`, { modal: true }, 'Stop Session');
            if (!replace) return;
            await this.stop();
        }
        const detected = installed_agents();
        const items = [
            { label: 'GitHub Copilot', agent: 'copilot' as const },
            { label: 'OpenAI Codex', agent: 'codex' as const },
            { label: 'Claude', agent: 'claude' as const },
            { label: 'Cursor', agent: 'cursor' as const },
            { label: 'Windsurf / Codeium', agent: 'windsurf' as const },
            { label: 'Other AI agent', agent: 'other' as const },
        ].map((item) => ({ ...item, description: detected.includes(item.agent) ? 'installed' : undefined }));
        const selected = preset_agent
            ? items.find((item) => item.agent === preset_agent) ?? { label: preset_label ?? preset_agent, agent: preset_agent }
            : await vscode.window.showQuickPick(items, { title: 'Start AI change session', placeHolder: 'Which agent will edit this workspace?' });
        if (!selected) return;
        const resource = this.cli.current_resource();
        if (!resource) { vscode.window.showWarningMessage('Open a workspace before starting an AI change session.'); return; }
        const at = Date.now();
        const baselines = await this.snapshot_workspace(resource);
        const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(resource, '**/*'));
        const session: active_session = {
            id: change_id(selected.agent, at), agent: selected.agent, confidence: 'explicit', started_at: at, updated_at: at,
            files: [], resource, explicit: true, baselines, dirty: new Map(), created: new Set(), deleted: new Set(), watcher,
        };
        this.active = session;
        watcher.onDidCreate((uri) => this.track_disk_change(session, uri, 'create'));
        watcher.onDidChange((uri) => this.track_disk_change(session, uri, 'change'));
        watcher.onDidDelete((uri) => this.track_disk_change(session, uri, 'delete'));
        this.on_status(this.status());
        vscode.window.showInformationMessage(`Recording ${selected.label} changes. Use “Stop AI Change Session” when the agent is done.`);
    }

    async stop(): Promise<void> {
        const session = this.active;
        if (!session) { vscode.window.showInformationMessage('No explicit AI change session is active.'); return; }
        session.watcher.dispose();
        await this.materialize_session(session);
        this.active = null;
        this.on_status(this.status());
        if (!session.files.length) { vscode.window.showInformationMessage(`No file changes were captured for ${session.agent}.`); return; }
        if (this.setting<boolean>('autoRecordExplicit', session.resource, true)) {
            try { await this.record(session); }
            catch (error) {
                this.queue.push(session);
                this.on_status(this.status());
                throw error;
            }
        }
        else { this.queue.push(session); this.on_status(this.status()); await this.review(); }
    }

    async review(): Promise<void> {
        this.finalize_heuristics();
        if (!this.queue.length) { vscode.window.showInformationMessage('No AI change candidates are waiting for review.'); return; }
        const selected = await vscode.window.showQuickPick(this.queue.map((change) => ({
            label: `${change.agent} · ${change.files.length} file${change.files.length === 1 ? '' : 's'}`,
            description: change.confidence,
            detail: change.files.map((file) => file.path).join(', '),
            change,
        })), { title: 'Review AI change candidates', placeHolder: 'Select a change set to inspect' });
        if (!selected) return;
        const rendered = render_agent_change(selected.change, this.max_patch_bytes(selected.change.resource));
        if (!rendered) { this.remove(selected.change.id); return; }
        const document = await vscode.workspace.openTextDocument({ language: 'diff', content: rendered.text });
        await vscode.window.showTextDocument(document, { preview: true });
        const action = await vscode.window.showInformationMessage(
            `${selected.change.agent} attribution is ${selected.change.confidence}. Record this rev
```

### Core Architecture Module: `apps/vscode-extension/src/cli.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : apps/vscode-extension/src/cli.ts
 *  usage : supports the LongMemory VS Code extension cli
 */


import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import * as vscode from 'vscode';

export class cli_error extends Error {
    constructor(message: string, readonly detail: string, readonly code: number | null) {
        super(message);
    }
}

type run_options = { input?: string; timeout_ms?: number; resource?: vscode.Uri };

const workspace_folder = (resource?: vscode.Uri): vscode.WorkspaceFolder => {
    const target = resource ?? vscode.window.activeTextEditor?.document.uri;
    const folder = target ? vscode.workspace.getWorkspaceFolder(target) : vscode.workspace.workspaceFolders?.[0];
    if (!folder) throw new cli_error('Open a workspace before using LongMemory.', 'No workspace folder is open.', null);
    return folder;
};

const config = (resource?: vscode.Uri) => vscode.workspace.getConfiguration('longmemory', workspace_folder(resource).uri);

export class longmemory_cli implements vscode.Disposable {
    private readonly active = new Set<ChildProcess>();

    constructor(private readonly output: vscode.OutputChannel) { }

    current_resource(): vscode.Uri | undefined {
        try { return workspace_folder().uri; }
        catch { return undefined; }
    }

    is_initialized(resource?: vscode.Uri): boolean {
        const root = workspace_folder(resource).uri.fsPath;
        const database = config(resource).get<string>('database', '.longmemory/project.db').trim();
        return database === ':memory:' || existsSync(isAbsolute(database) ? database : resolve(root, database));
    }

    async run<T>(command: string[], options: run_options = {}): Promise<T> {
        if (!vscode.workspace.isTrusted) throw new cli_error('Trust this workspace before running LongMemory.', 'Workspace Trust is required because LongMemory executes a local CLI.', null);
        const root = workspace_folder(options.resource).uri.fsPath;
        const configured = config(options.resource).get<string>('cliPath', 'longmemory').trim() || 'longmemory';
        const cli_path = isAbsolute(configured) ? configured : configured.includes('/') || configured.includes('\\') ? resolve(root, configured) : configured;
        const executable = cli_path.endsWith('.js') ? process.execPath : cli_path;
        const prefix = cli_path.endsWith('.js') ? [cli_path] : [];
        const needs_shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(executable);
        const database = config(options.resource).get<string>('database', '.longmemory/project.db').trim();
        const project = config(options.resource).get<string>('project', 'current').trim() || 'current';
        const user = config(options.resource).get<string>('user', 'default').trim() || 'default';
        const args = [...prefix, ...command, '--json', '--no-color', '--cwd', root, '--project', project, '--user', user, ...(database ? ['--db', database] : [])];
        const group = ['project', 'maintenance', 'memory'].includes(command[0] ?? '') ? command.slice(0, 2) : command.slice(0, 1);
        this.output.appendLine(`> LongMemory ${group.join(' ')}${command.length > group.length ? ' [arguments redacted]' : ''}`);

        return new Promise<T>((resolve_value, reject) => {
            const child = spawn(executable, args, {
                cwd: root,
                env: { ...process.env, NO_COLOR: '1' },
                windowsHide: true,
                shell: needs_shell,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            this.active.add(child);
            let stdout = '';
            let stderr = '';
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                void this.stop(child).then(() => {
                    reject(new cli_error('LongMemory command timed out.', stderr || stdout, null));
                });
            }, options.timeout_ms ?? 60_000);
            child.stdout.setEncoding('utf8');
            child.stderr.setEncoding('utf8');
            child.stdout.on('data', (chunk: string) => { stdout += chunk; });
            child.stderr.on('data', (chunk: string) => { stderr += chunk; });
            child.once('error', (error) => {
                clearTimeout(timer);
                this.active.delete(child);
                if (settled) return;
                settled = true;
                reject(new cli_error(`Unable to start LongMemory CLI: ${error.message}`, error.stack ?? error.message, null));
            });
            child.once('close', (code) => {
                clearTimeout(timer);
                this.active.delete(child);
                if (settled) return;
                settled = true;
                if (stderr.trim()) this.output.appendLine(stderr.trim());
                if (code !== 0) {
                    let message = stderr.trim() || `LongMemory exited with code ${code}`;
                    try { message = (JSON.parse(stderr) as { error?: { message?: string } }).error?.message ?? message; } catch { }
                    reject(new cli_error(message, stderr || stdout, code));
                    return;
                }
                try {
                    resolve_value(JSON.parse(stdout) as T);
                } catch (error) {
                    reject(new cli_error('LongMemory returned invalid JSON.', `${error instanceof Error ? error.message : String(error)}\n${stdout}`, code));
                }
            });
            if (options.input !== undefined) child.stdin.end(options.input);
            else child.stdin.end();
        });
    }

    dispose(): void {
        for (const child of this.active) void this.stop(child);
        this.active.clear();
    }

    private async stop(child: ChildProcess): Promise<void> {
        if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
        if (process.platform === 'win32') {
            await new Promise<void>((resolve_stop) => {
                const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
                killer.once('close', () => resolve_stop());
                killer.once('error', () => resolve_stop());
            });
            return;
        }
        child.kill('SIGTERM');
        await new Promise<void>((resolve_stop) => {
            const timer = setTimeout(resolve_stop, 2_000);
            child.once('close', () => { clearTimeout(timer); resolve_stop(); });
        });
    }
}

```

### Core Architecture Module: `apps/vscode-extension/src/extension.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : apps/vscode-extension/src/extension.ts
 *  usage : supports the LongMemory VS Code extension extension
 */


import * as vscode from 'vscode';
import { cli_error, longmemory_cli } from './cli.js';
import { context_markdown, recall_markdown } from './markdown.js';
import { memory_item, memory_tree } from './memory_tree.js';
import { agent_change_tracker, type agent_tracker_status } from './agent_tracker.js';
import { memory_status_bar } from './status_bar.js';
import type { harness_detection_result, project_context_result, recall_result, session_discovery_result, session_port_result, status_result, harness_id } from './types.js';

const show_document = async (title: string, content: string) => {
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content });
    await vscode.window.showTextDocument(document, { preview: true });
    return title;
};

const message = (error: unknown): string => error instanceof Error ? error.message : String(error);

type ai_agent = 'copilot' | 'codex' | 'claude' | 'cursor' | 'windsurf';
const ai_extensions: Array<{ ids: string[]; agent: ai_agent; label: string }> = [
    { ids: ['github.copilot-chat', 'github.copilot'], agent: 'copilot', label: 'GitHub Copilot' },
    { ids: ['openai.chatgpt', 'openai.codex'], agent: 'codex', label: 'OpenAI Codex' },
    { ids: ['anthropic.claude-code', 'anthropic.claude'], agent: 'claude', label: 'Claude Code' },
    { ids: ['saoudrizwan.claude-dev', 'cline.cline'], agent: 'claude', label: 'Cline' },
    { ids: ['codeium.windsurf', 'codeium.codeium'], agent: 'windsurf', label: 'Windsurf / Codeium' },
];
const installed_ai_agents = (): Array<{ agent: ai_agent; label: string }> => [...new Map(ai_extensions
    .filter((candidate) => candidate.ids.some((id) => vscode.extensions.getExtension(id)))
    .map((candidate) => [candidate.label, { agent: candidate.agent, label: candidate.label }])).values()];

const harness_labels: Record<harness_id, string> = {
    'claude-code': 'Claude Code', codex: 'Codex', opencode: 'OpenCode', 'gemini-cli': 'Gemini CLI',
    'copilot-chat': 'VS Code Copilot Chat', cline: 'Cline', 'deepseek-harness': 'DeepSeek Harness',
};

export function activate(context: vscode.ExtensionContext): void {
    const output = vscode.window.createOutputChannel('LongMemory', { log: true });
    const cli = new longmemory_cli(output);
    const status = new memory_status_bar();

    let memory_status: status_result | null = null;
    let tracker_status: agent_tracker_status = { active: null, pending: 0 };
    let status_error: string | undefined;
    const render_status = () => {
        status.update(memory_status, tracker_status, status_error);
    };

    const update_status = (value: status_result | null, error?: string) => {
        memory_status = value;
        status_error = error;
        render_status();
    };
    const provider = new memory_tree(cli, update_status);
    const view = vscode.window.createTreeView('longmemory.memories', { treeDataProvider: provider, showCollapseAll: false });

    const run = async <T>(title: string, operation: () => Promise<T>): Promise<T | undefined> => {
        try {
            return await vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title, cancellable: false }, operation);
        } catch (error) {
            output.appendLine(error instanceof cli_error ? error.detail : message(error));
            const action = await vscode.window.showErrorMessage(message(error), 'Open Output');
            if (action) output.show(true);
            return undefined;
        }
    };
    const refresh = async () => {
        await provider.refresh();
        view.message = provider.empty_message;
    };
    const refresh_after_write = async () => {
        const resource = cli.current_resource();
        if (vscode.workspace.getConfiguration('longmemory', resource).get<boolean>('autoRefresh', true)) await refresh();
    };
    const tracker = new agent_change_tracker(cli, output, (value) => { tracker_status = value; render_status(); }, refresh_after_write);

    const offer_ai_agent_attach = async (resource: vscode.Uri | undefined) => {
        const detected = installed_ai_agents();
        if (!detected.length) return;
        const selected = await vscode.window.showInformationMessage(
            `AI coding agent${detected.length === 1 ? '' : 's'} detected: ${detected.map((item) => item.label).join(', ')}. Attach LongMemory so agent edits are recorded as project memory?`,
            'Record Agent Changes', 'Not Now',
        );
        if (selected !== 'Record Agent Changes') return;
        if (detected.length === 1) {
            const only = detected[0];
            if (only) await tracker.start(only.agent, only.label);
            return;
        }
        const picked = await vscode.window.showQuickPick(detected.map((item) => ({ label: item.label, agent: item.agent })), { title: 'Record changes from which AI agent?' });
        if (picked) await tracker.start(picked.agent, picked.label);
        void resource;
    };

    context.subscriptions.push(
        output,
        cli,
        status,
        view,
        tracker,
        vscode.commands.registerCommand('longmemory.refresh', () => run('Refreshing LongMemory', refresh)),
        vscode.commands.registerCommand('longmemory.initialize', async () => {
            const resource = cli.current_resource();
            const result = await run('Initializing LongMemory', () => cli.run<{ ok: boolean; db_path: string }>(['init'], { resource }));
            if (!result) return;
            vscode.window.showInformationMessage(`LongMemory initialized: ${result.db_path}`);
            await refresh();
            await offer_ai_agent_attach(resource);
        }),
        vscode.commands.registerCommand('longmemory.rememberSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            const text = editor?.document.getText(editor.selection);
            if (!editor || !text) { vscode.window.showWarningMessage('Select text to remember.'); return; }
            const source = vscode.workspace.asRelativePath(editor.document.uri, false);
            const result = await run('Remembering selection', () => cli.run<{ memory_id: string }>(['ingest', '--stdin', '--source', `vscode:${source}`, '--type', 'code_context'], { input: text, resource: editor.document.uri }));
            if (result) { vscode.window.showInformationMessage(`Remembered selection from ${source}`); await refresh_after_write(); }
        }),
        vscode.commands.registerCommand('longmemory.quickNote', async () => {
            const text = await vscode.window.showInputBox({ title: 'Remember a quick note', prompt: 'What should LongMemory remember?', ignoreFocusOut: true });
            if (!text?.trim()) return;
            const result = await run('Remembering note', () => cli.run<{ memory_id: string }>(['ingest', '--stdin', '--source', 'vscode-note', '--type', 'manual_note'], { input: text.trim(), resource: cli.current_resource() }));
            if (result) { vscode.window.showInformationMessage('Note remembered.'); await refresh_after_write(); }
        }),
        vscode.commands.registerCommand('longmemory.recall', async () => {
            const selected = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection).trim();
            const query = selected || await vscode.window.showInputBox({ 
```

### Core Architecture Module: `apps/vscode-extension/src/markdown.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : apps/vscode-extension/src/markdown.ts
 *  usage : supports the LongMemory VS Code extension markdown
 */


import type { project_context_result, recall_result } from './types.js';

export const recall_markdown = (result: recall_result): string => [
    `# LongMemory Recall`,
    '',
    `**Query:** ${result.query}`,
    `**Mode:** ${result.mode}`,
    '',
    ...(result.hits.length ? result.hits.flatMap((hit, index) => [
        `## ${index + 1}. ${hit.status.toUpperCase()} · ${Number(hit.score).toFixed(3)}`,
        '',
        hit.text,
        '',
        `- Memory: \`${hit.id}\``,
        `- Grounded: ${hit.grounded ? 'yes' : 'no'}`,
        `- Source: ${hit.citation ?? 'none'}`,
        '',
    ]) : ['No memories passed the selected recall gates.', '']),
].join('\n');

export const context_markdown = (result: project_context_result): string => [
    '# LongMemory Project Context',
    '',
    `**Task:** ${result.task}`,
    `**Project:** ${result.project_id}`,
    '',
    result.current_goal ? `## Current Goal\n\n${result.current_goal}\n` : '',
    result.project_summary ? `## Project Summary\n\n${result.project_summary}\n` : '',
    result.hard_constraints.length ? `## Hard Constraints\n\n${result.hard_constraints.map((value) => `- ${value}`).join('\n')}\n` : '',
    result.relevant_architecture.length ? `## Relevant Architecture\n\n${result.relevant_architecture.map((value) => `- ${value}`).join('\n')}\n` : '',
    result.relevant_files.length ? `## Relevant Files\n\n${result.relevant_files.map((value) => `- \`${value.path}\`${value.stale ? ' (stale)' : ''}`).join('\n')}\n` : '',
    result.active_decisions.length ? `## Active Decisions\n\n${result.active_decisions.map((value) => `- ${value.decision}${value.rationale ? `: ${value.rationale}` : ''}`).join('\n')}\n` : '',
    result.open_tasks.length ? `## Open Tasks\n\n${result.open_tasks.map((value) => `- [${value.status}] ${value.task}`).join('\n')}\n` : '',
    result.known_failures.length ? `## Known Failures\n\n${result.known_failures.map((value) => `- ${value}`).join('\n')}\n` : '',
    result.asset_loadout?.selected.length ? `## Equipped Memory Assets\n\n${result.asset_loadout.selected.map((value) => `- **${value.asset.name}** · ${value.asset.type} · ${value.binding?.injection_mode ?? 'reference'} · priority ${value.annotations.priority.toFixed(2)}`).join('\n')}\n` : '',
    result.matched_skills?.length ? `## Matched Skills\n\n${result.matched_skills.map((value) => `### ${value.skill.name} v${value.skill.version}\n\n${value.skill.description}\n\n${value.skill.instructions.map((step, index) => `${index + 1}. ${step}`).join('\n')}${value.skill.validation.length ? `\n\nValidation:\n${value.skill.validation.map((rule) => `- ${rule}`).join('\n')}` : ''}`).join('\n\n')}\n` : '',
    result.suggested_next_steps.length ? `## Suggested Next Steps\n\n${result.suggested_next_steps.map((value, index) => `${index + 1}. ${value}`).join('\n')}\n` : '',
].filter(Boolean).join('\n');

```

### Core Architecture Module: `apps/vscode-extension/src/memory_tree.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : apps/vscode-extension/src/memory_tree.ts
 *  usage : supports the LongMemory VS Code extension memory tree
 */


import * as vscode from 'vscode';
import { longmemory_cli } from './cli.js';
import type { memory_summary, status_result } from './types.js';

export class memory_item extends vscode.TreeItem {
    constructor(readonly memory: memory_summary, readonly resource?: vscode.Uri) {
        super(memory.text, vscode.TreeItemCollapsibleState.None);
        this.id = memory.id;
        this.description = `${memory.status} · ${memory.activation.toFixed(2)}`;
        this.contextValue = 'longmemory.memory';
        this.iconPath = new vscode.ThemeIcon(memory.status === 'active' ? 'circle-filled' : memory.status === 'contradicted' ? 'warning' : 'history');
        this.command = { command: 'longmemory.explain', title: 'Explain Memory', arguments: [this] };
        const tooltip = new vscode.MarkdownString(undefined, true);
        tooltip.appendMarkdown(`**${memory.status.toUpperCase()}**  \n`);
        tooltip.appendText(memory.text);
        tooltip.appendMarkdown(`\n\n- Confidence: ${memory.confidence.toFixed(3)}\n- Salience: ${memory.salience.toFixed(3)}\n- Activation: ${memory.activation.toFixed(3)}\n- Grounded: ${memory.grounded ? 'yes' : 'no'}\n- Observed: ${new Date(memory.observed_at).toLocaleString()}\n- ID: \`${memory.id}\``);
        this.tooltip = tooltip;
    }
}

export class memory_tree implements vscode.TreeDataProvider<memory_item> {
    private readonly changed = new vscode.EventEmitter<memory_item | undefined | null | void>();
    readonly onDidChangeTreeData = this.changed.event;
    private values: memory_summary[] = [];
    private resource: vscode.Uri | undefined;
    private refresh_version = 0;
    private message = 'LongMemory has not loaded this workspace yet.';
    status: status_result | null = null;

    constructor(private readonly cli: longmemory_cli, private readonly on_status: (status: status_result | null, error?: string) => void) { }

    getTreeItem(element: memory_item): vscode.TreeItem { return element; }

    getChildren(): memory_item[] {
        return this.values.map((memory) => new memory_item(memory, this.resource));
    }

    async refresh(): Promise<void> {
        const version = ++this.refresh_version;
        try {
            this.resource = this.cli.current_resource();
            if (!this.resource) throw new Error('Open a workspace before using LongMemory.');
            if (!this.cli.is_initialized(this.resource)) {
                this.status = null;
                this.values = [];
                this.message = 'LongMemory is not initialized. Run Initialize Workspace Memory.';
                this.on_status(null, this.message);
                this.changed.fire();
                return;
            }
            const limit = vscode.workspace.getConfiguration('longmemory', this.resource).get<number>('listLimit', 50);
            const status = await this.cli.run<status_result>(['status', '--memories', String(limit)], { resource: this.resource });
            if (version !== this.refresh_version) return;
            this.status = status;
            this.values = status.recent_memories;
            this.message = status.recent_memories.length ? '' : 'No project memories yet. Remember a selection or quick note.';
            this.on_status(status);
        } catch (error) {
            if (version !== this.refresh_version) return;
            this.status = null;
            this.values = [];
            this.message = error instanceof Error ? error.message : String(error);
            this.on_status(null, this.message);
        }
        this.changed.fire();
    }

    get empty_message(): string { return this.message; }
}

```

### Core Architecture Module: `apps/vscode-extension/src/status_bar.ts`
```
/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : apps/vscode-extension/src/status_bar.ts
 *  usage : supports the LongMemory VS Code extension status bar
 */


import * as vscode from 'vscode';
import type { status_result } from './types.js';
import { build_status_bar_model } from './status_bar_model.js';

type tracker_state = { active: string | null; pending: number };

export class memory_status_bar implements vscode.Disposable {
    private readonly memory = vscode.window.createStatusBarItem('longmemory.manager', vscode.StatusBarAlignment.Right, 120);
    private readonly activity = vscode.window.createStatusBarItem('longmemory.activity', vscode.StatusBarAlignment.Right, 119);

    constructor() {
        this.memory.name = 'LongMemory Manager';
        this.memory.command = 'longmemory.showActions';
        this.memory.text = '$(database) Memory';
        this.memory.tooltip = 'LongMemory is loading. Click to manage workspace memory.';
        this.memory.accessibilityInformation = { label: 'LongMemory manager' };
        this.memory.show();
        this.activity.name = 'LongMemory AI Changes';
        this.activity.command = 'longmemory.showActions';
        this.activity.accessibilityInformation = { label: 'LongMemory AI change activity' };
    }

    update(value: status_result | null, tracker: tracker_state, error?: string): void {
        const model = build_status_bar_model(value, tracker, error);
        this.memory.text = model.memory_text;
        this.memory.tooltip = model.memory_tooltip;
        this.memory.backgroundColor = model.memory_severity === 'error' ? new vscode.ThemeColor('statusBarItem.errorBackground')
            : model.memory_severity === 'warning' ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
        this.memory.accessibilityInformation = { label: value ? `LongMemory manager, ${value.memory.active} active memories` : model.memory_severity === 'error' ? 'LongMemory unavailable' : 'LongMemory manager' };

        if (model.activity) {
            this.activity.text = model.activity.text;
            this.activity.tooltip = model.activity.tooltip;
            this.activity.command = model.activity.review ? 'longmemory.reviewAgentChanges' : 'longmemory.showActions';
            this.activity.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.activity.show();
        } else {
            this.activity.hide();
            this.activity.command = 'longmemory.showActions';
            this.activity.backgroundColor = undefined;
        }
    }

    dispose(): void {
        this.memory.dispose();
        this.activity.dispose();
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #147** (2026-04-04): **[BUG] Chinese text is incorrectly deduplicated in openmemory_store due to ASCII-only tokenization**
  *Symptoms*: ### What happened?  Chinese text is incorrectly deduplicated in openmemory_store due to ASCII-only tokenization  ### Steps to Reproduce  ## Bug description  `openmemory_store` incorrectly deduplicates different Chinese memories into the same record.  For example, these two different inputs may resolve to the same memory id:  - `我喜欢健身` - `我喜欢普洱茶`  This causes unrelated Chinese memories to be treated as duplicates.  ## Environment  - OpenMemory: latest (observed on 2026-03-03) - MCP tool: `openmemory_store` - Language: Chinese (zh-CN)  ## Steps to reproduce  1. Store memory A:    - content: `我喜欢健身` 2. Store memory B:    - content: `我喜欢普洱茶` 3. Check returned IDs / list memories.  ## Actual behavior  Different Chinese texts are often deduplicated to the same memory id (or old memory is reused), so no independent record is created.  ## Expected behavior  Semantically different Chinese memories should not be collapsed into one by default.  ## Suspected root cause  The tokenizer used by simhash appears ASCII-only:  - JS: `packages/openmemory-js/src/utils/text.ts`   - `tok_pat = /[a-z0-9]+/gi` - Similar logic exists in Python implementation as well.  For Chinese text, token set can become empty, producing near-constant simhash and causing false deduplication.  ## Suggested fix  1. Guardrail: if token set is empty, skip simhash dedup for that input. 2. Improve tokenizer to support Unicode letters/numbers (`\p{L}\p{N}` with `u` flag). 3. Add CJK-specific n-gram tokenization (e.g., bi-g

- **Issue #142** (2026-04-10): **[BUG] render deploy doesn't work**
  *Symptoms*: ### What happened?  tried to deploy to render and the build failed  ### Steps to Reproduce  - click the deploy to render link in the readme - continue in the render dashboard, deploy - deploy/build error  ### Component  Other  ### Environment  render  ### Relevant log output  ```shell 2026-02-24T08:23:49.602591478Z ==> It looks like we don't have access to your repo, but we'll try to clone it anyway. 2026-02-24T08:23:49.602611859Z ==> Cloning from https://github.com/CaviraOSS/OpenMemory 2026-02-24T08:23:51.109539755Z ==> Checking out commit afc7db127ecca7c214a23729d625f0a6966a07e3 in branch main 2026-02-24T08:23:52.635669903Z ==> Using Node.js version 22.22.0 (default) 2026-02-24T08:23:52.662486934Z ==> Docs on specifying a Node.js version: https://render.com/docs/node-version 2026-02-24T08:23:57.027758092Z ==> Running build command 'npm install && npm run build'... 2026-02-24T08:24:06.733856607Z  2026-02-24T08:24:06.733887438Z added 441 packages, and audited 442 packages in 9s 2026-02-24T08:24:06.733894618Z  2026-02-24T08:24:06.733909059Z 57 packages are looking for funding 2026-02-24T08:24:06.733913759Z   run `npm fund` for details 2026-02-24T08:24:06.794674807Z  2026-02-24T08:24:06.794696647Z 30 vulnerabilities (3 moderate, 26 high, 1 critical) 2026-02-24T08:24:06.794702318Z  2026-02-24T08:24:06.794708118Z To address issues that do not require attention, run: 2026-02-24T08:24:06.794713838Z   npm audit fix 2026-02-24T08:24:06.794719168Z  2026-02-24T08:24:06.794724688Z To ad
  **Post-Mortem & Fix Analysis**:
  > also the railway link in the readme is invalid
  > Hey Mirsella, We have moved to an independent JS/PY package, so the deployment links are obsolete. They will be removed in the upcoming update.

- **Issue #140** (2026-02-22): **[BUG] Docker Compose fails && No Backend Folder**
  *Symptoms*: ### What happened?  oot@tmi-radio:/opt/openmemory# ls app.json  ARCHITECTURE.md  CODE_OF_CONDUCT.md  dashboard           docs      GOVERNANCE.md  Makefile      models.yml  railway.json  render.yaml  tools        Why.md apps      CHANGELOG.md     CONTRIBUTING.md     docker-compose.yml  examples  LICENSE        MIGRATION.md  packages    README.md     SECURITY.md  vercel.json root@tmi-radio:/opt/openmemory# docker compose --profile ui up --build -d [+] Building 1.3s (16/33)  => [internal] load local bake definitions                                                                                                                                          0.0s  => => reading from stdin 983B                                                                                                                                                      0.0s  => [openmemory internal] load build definition from Dockerfile                                                                                                                     0.0s  => => transferring dockerfile: 1.53kB                                                                                                                                              0.0s  => [dashboard internal] load build definition from Dockerfile                                                                                                                      0.0s  => => transferring dockerfile: 915B                                                               

- **Issue #136** (2026-02-16): **[BUG] Official Docs Deployment Down**
  *Symptoms*: ### What happened?  The official docs is down how are we supposed to integrate it   ### Steps to Reproduce  1. Open officail Docs  ### Component  Frontend (React/UI)  ### Environment  _No response_  ### Relevant log output  ```shell  ```  ### Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > A new and better documentation site is in the works!
  > Docs back up

- **Issue #135** (2026-02-24): **[BUG] sqlite datafile is not stored on docker volume**
  *Symptoms*: ### What happened?  When spinning up the latest release docker container with .env settings ``` # -------------------------------------------- # Metadata Store # -------------------------------------------- # sqlite (default) | postgres OM_METADATA_BACKEND=sqlite OM_DB_PATH=./data/openmemory.sqlite ```  the data file is not stored on the docker volume. When you restart your container all your stored memories are lost.  The root cause is the ./data part -> must be /data to match the provided path in docker compose      ### Steps to Reproduce  1. start up container 2. store memory 3. restart container 4. fetch memory => emoty  ### Component  Frontend (React/UI)  ### Environment  - Ubuntu   ### Relevant log output  ```shell  ```  ### Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting the bug, we are working on it!

- **Issue #134** (2026-04-10): **[BUG] docker compose up not working**
  *Symptoms*: ### What happened?  Running  `sudo docker compose up --build -d`  failed with error  => ERROR [dashboard production 4/8] RUN npm install --omit=dev    ### Steps to Reproduce  Run  ` git clone https://github.com/CaviraOSS/OpenMemory.git cd OpenMemory/ sudo docker compose up --build -d `  ### Component  Frontend (React/UI)  ### Environment  Linux (ubuntu 24.04) Docker version 29.2.0, build 0b9d198   ### Relevant log output  ```shell [+] Building 1.5s (17/33)  => [internal] load local bake definitions                                                                                                                                                                                              0.0s  => => reading from stdin 1.06kB                                                                                                                                                                                                        0.0s  => [openmemory internal] load build definition from Dockerfile                                                                                                                                                                         0.0s  => => transferring dockerfile: 2.19kB                                                                                                                                                                                                  0.0s  => [dashboard internal] load build definition from Dockerfile                             
  **Post-Mortem & Fix Analysis**:
  > Downloaded the latest release files -> docker compose does startup the container
  > Hye, please us the latest release
  > The package.json is missing. Just ran into this issue today for the Dashboard. 

- **Issue #129** (2026-01-25): **[BUG] openmemory-py wheel built from git contains syntax errors (truncated strings) — import fails**
  *Symptoms*: ### What happened?  When building openmemory-py from the current git repository, the wheel (openmemory_py-1.3.1-py2.py3-none-any.whl) is produced successfully, but the resulting wheel contains syntactically invalid Python.  Multiple modules inside the wheel have truncated string literals or mismatched braces. As a result:  python -m compileall fails on the extracted wheel  import openmemory fails at runtime  Expected behavior: The wheel produced from git should contain syntactically valid Python, and import openmemory should succeed.  ### Steps to Reproduce  Clone the OpenMemory repository from git.  Build the Python wheel using:  python -m build --wheel --no-isolation   Extract the generated wheel:  python -m zipfile -e openmemory_py-1.3.1-py2.py3-none-any.whl /tmp/omwheel   Compile the extracted package:  python -m compileall -q /tmp/omwheel/openmemory   Observe syntax errors in multiple files.  ### Component  Backend (API/Server)  ### Environment  Component  Python SDK (openmemory-py)  Wheel build / packaging pipeline  Environment  OS: Arch Linux / CachyOS  Python: 3.14.2  Build method: python -m build --wheel --no-isolation  Installation context: AUR-style python-openmemory-git packaging  ### Relevant log output  ```shell Relevant log output *** Error compiling '/tmp/omwheel/openmemory/ai/mcp.py'... SyntaxError: closing parenthesis '}' does not match opening parenthesis '(' on line 56  *** Error compiling '/tmp/omwheel/openmemory/connectors/google_slides.py'... SyntaxErro
  **Post-Mortem & Fix Analysis**:
  > Doing a bit of bisecting, this error was introduced by:  ae737a3e4aad103ec4550ca6266ce424f8e17590
  > While it is better, there still seems to be an issue: ``` * Building wheel... Successfully built openmemory_py-1.3.1-py2.py3-none-any.whl ==> Entering fakeroot environment... ==> Starting package()... *** Error compiling '/home/evert/Aur/python-openmemory-git/pkg/python-openmemory-git/usr/lib/python3.14/site-packages/openmemory/connectors/google_slides.py'...   File "/usr/lib/python3.14/site-packages/openmemory/connectors/google_slides.py", line 77     "id": f"{presentation_id},           ^ SyntaxError: unterminated f-string literal (detected at line 77) ```
  > Perfectly fixed and working for me now. 

- **Issue #125** (2026-02-15): **[BUG] examples/python/integrations/langchain_agent.py does not work**
  *Symptoms*: ### What happened?  The example at `examples/python/integrations/langchain_agent.py` does not work.    Forgive me if I am missing something obvious, but there seem to be a number of problems with this code.  - The `OpenMemoryChatMessageHistory` constructor requires a `Memory` object.  (I am now creating and passing it an `openmemory.client.Memory` object) - The `OpenMemoryChatMessageHistory` constructor requires a `user_id` parameter. (I am now passing a new user_id variable)  Getting past those issues gets me to the `await chain_with_history.ainvoke` call which fails with `TypeError: object list can't be used in 'await' expression`.  If I remove the await, and call `invoke` instead of `ainvoke`, there are no errors, but the second call to `chain_with_history.invoke` returns a response from the LLM saying it has no idea who I am (so the memory clearly did not work).  What am I missing?  If I am not missing anything, then something is broken.  ### Steps to Reproduce  Run `examples/python/integrations/langchain_agent.py`.  ### Component  Other  ### Environment  WIndows 11 Python 3.12 langchain 1.2.3 langgraph 1.0.6 openmemory-py 1.3.1  ### Relevant log output  ```shell Starting chat session: user_langchain_01  User: Hi, I'm Bob and I like Python. Traceback (most recent call last):   File "C:\Users\user\AppData\Local\Programs\Python\Python312\Lib\runpy.py", line 198, in _run_module_as_main     return _run_code(code, main_globals, None,            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/CaviraOSS/OpenMemory/commit/30daf7804d54ca57d15e3d5b4880165af1e99386

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

### Incident Patch 1: `188a1dec` (2026-09-12)
**Commit Message**: feat(sdk): add longmemory-sdk Python HTTP client and openmemory-py bridge

- zero-dependency sync/async Python client for the self-hosted API
- openmemory-py 2.0 forwards imports to longmemory-sdk
- PyPI publish jobs via trusted publishing in publish-sdks workflow
- changelog, migration, and readme updates for package rename

**File**: `.github/workflows/publish-sdks.yml` (modified, +54/-0)
```diff
@@ -58,6 +58,60 @@ jobs:
               env:
                   NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
+    npm-legacy-bridge:
+        needs: [validate, npm]
+        runs-on: ubuntu-latest
+        steps:
+            - uses: actions/checkout@v4
+            - uses: actions/setup-node@v4
+              with:
+                  node-version: 22
+                  registry-url: https://registry.npmjs.org
+            - run: npm publish ./packages/openmemory-js --access public --provenance
+              env:
+                  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+            - run: npm deprecate "openmemory-js@<2.0.0" "Package renamed to longmemory. Install longmemory instead."
+              env:
+                  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+
+    pypi-longmemory-sdk:
+        needs: validate
+        runs-on: ubuntu-latest
+        environment:
+            name: pypi-longmemory-sdk
+            url: https://pypi.org/p/longmemory-sdk
+        permissions:
+            id-token: write
+        steps:
+            - uses: actions/checkout@v4
+            - uses: actions/setup-python@v5
+              with:
+                  python-version: '3.13'
+            - run: python -m pip install build
+            - run: python -m build packages/longmemory-py
+            - uses: pypa/gh-action-pypi-publish@release/v1
+              with:
+                  packages-dir: packages/longmemory-py/dist
+
+    pypi-legacy-bridge:
+        needs: [validate, pypi-longmemory-sdk]
+        runs-on: ubuntu-latest
+        environment:
+            name: pypi-openmemory-py
+            url: https://pypi.org/p/openmemory-py
+        permissions:
+            id-token: write
+        steps:
+            - uses: actions/checkout@v4
+            - uses: actions/setup-python@v5
+              with:
+                  python-version: '3.13'
+            - run: python -m pip install build
+            - run: python -m build packages/openmemory-py
+            - uses: pypa/gh-action-pypi-publish@release/v1
+              with:
+                  packages-dir: packages/openmemory-py/dist
+
     n8n:
         needs: validate
         runs-on: ubuntu-latest
```

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ node_modules/
 dist/
 __pycache__/
 *.py[cod]
+*.egg-info/
+*.egg-info
 .env
 *.log
 tmp
```

**File**: `CHANGELOG.md` (modified, +493/-12)
```diff
@@ -7,22 +7,503 @@
                      /____/                                 /____/
 
  cavira oss (c) 2026  -  nullure (c) 2026
- ==========================================================
+ ----------------------------------------------------------
  file  : CHANGELOG.md
- usage : supports LongMemory changelog
+ usage : records the complete OpenMemory-to-LongMemory project history
 -->
 
 # Changelog
 
-All notable changes are documented here. LongMemory follows Semantic Versioning.
+All notable changes to LongMemory are documented here. The current project
+follows Semantic Versioning. The archived pre-rewrite releases are retained at
+the end of this file for historical context.
 
-## 1.0.0 - 2026-08-31
+## [Unreleased]
 
-- Renamed the product, npm package, CLI, environment namespace, integrations, and editor extension to LongMemory.
-- Shipped the immutable Hydrograph engine with temporal, strict, historical, associative, grounded, and multilingual recall.
-- Added SQLite persistence, deterministic decay and reinforcement, consolidation, compression, reconsolidation, and governed project assets.
-- Added authenticated HTTP and MCP servers, a production dashboard, CLI session porter, AI Wiki generation, and a VS Code extension.
-- Added native n8n, Claude Code, Codex, Gemini CLI, Agent Plugins, Cline, Continue, LibreChat, CrewAI, AutoGen, LangGraph, OpenAI Agents, and PydanticAI integrations.
-- Added official benchmark tooling for LongMemEval, LoCoMo, BEAM, comparative providers, scorecards, and release gates.
-- Added Docker, Compose, Heroku, Railway, Render, DigitalOcean, and Vercel deployment manifests.
-- Licensed the project under Apache License 2.0.
+### Python SDK and package registry migration
+
+- Added `packages/longmemory-py`, a zero-runtime-dependency Python HTTP client
+  for the self-hosted LongMemory service.
+- Added synchronous `LongMemory` and asynchronous `AsyncLongMemory` clients.
+- Added typed convenience methods for health, ingest, recall, explain, worlds,
+  entities, timeline, statistics, runtime information, and arbitrary API calls.
+- Added structured `LongMemoryError` and `LongMemoryConnectionError` failures
+  that preserve API status, error code, and response metadata.
+- Kept the Hydrograph engine in TypeScript. The Python package is intentionally
+  a transport client and does not duplicate persistence, retrieval, temporal,
+  lifecycle, or governance logic.
+- Selected the PyPI distribution name `longmemory-sdk` because the unrelated
+  `longmemory` project name is already registered by another organization. The
+  Python import remains `from longmemory import LongMemory`.
+- Added a deprecated `openmemory-py` compatibility distribution that depends on
+  `longmemory-sdk` and forwards the former Python import namespace.
+- Added a deprecated `openmemory-js` npm bridge that depends on and re-exports
+  `longmemory`, while forwarding the former `opm` command to the new CLI.
+- Added migration documentation for npm and PyPI users moving from the former
+  package names.
+- Expanded package publication automation for npm, PyPI, n8n, VS Code, and
+  compatibility bridge releases.
+
+### Registry status
+
+- Reserved `longmemory` as the primary npm package name.
+- Preserved the existing `openmemory-js` npm channel as a migration bridge for
+  users of the former JavaScript package.
+- Preserved the existing `openmemory-py` PyPI channel as a migration bridge for
+  users of the former Python package.
+- Did not claim the unrelated `longmemory` PyPI project. New Python installs use
+  `longmemory-sdk`.
+
+## [1.0.0] - 2026-08-31
+
+LongMemory 1.0 is a ground-up architecture rewrite rather than an incremental
+rename of the archived OpenMemory implementation. It consolidates the product
+around one immutable TypeScript Hydrograph engine shared by every supported
+surface.
+
+### Product rename and release identity
+
+- Renamed the product from OpenMemory to LongMemory.
+- Renamed the npm packa
```

**File**: `MIGRATION.md` (modified, +13/-1)
```diff
@@ -24,7 +24,19 @@ The package, CLI, environment prefix, extension namespace, routes, and integrati
 - dashboard proxy: `/api/longmemory`
 - repository: `https://github.com/CaviraOSS/LongMemory`
 
-Compatibility aliases for the previous product name are intentionally not shipped.
+Application identifiers do not retain runtime aliases; registry migration is handled by temporary compatibility packages.
+
+Package registry migration uses temporary compatibility bridges:
+
+```bash
+npm uninstall openmemory-js
+npm install longmemory
+
+pip uninstall openmemory-py
+pip install longmemory-sdk
+```
+
+The npm bridge re-exports `longmemory` and forwards the legacy CLI names. The PyPI bridge depends on `longmemory-sdk` and forwards the legacy Python import namespace. The unrelated `longmemory` distribution on PyPI is not part of CaviraOSS.
 
 ## Import legacy memory data
 
```

**File**: `README.md` (modified, +32/-1)
```diff
@@ -17,11 +17,12 @@
 > **Durable, temporal, governed memory for AI agents. Not just RAG. Not just a vector database. Local-first and self-hosted.**
 
 [![npm](https://img.shields.io/npm/v/longmemory.svg)](https://www.npmjs.com/package/longmemory)
+[![PyPI](https://img.shields.io/pypi/v/longmemory-sdk.svg)](https://pypi.org/project/longmemory-sdk/)
 [![VS Code](https://img.shields.io/badge/VS%20Code-LongMemory-007ACC?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=CaviraOSS.longmemory-vscode)
 [![Container](https://img.shields.io/badge/GHCR-longmemory-2496ED?logo=docker)](https://github.com/CaviraOSS/LongMemory/pkgs/container/longmemory)
 [![License](https://img.shields.io/github/license/CaviraOSS/LongMemory)](LICENSE)
 
-![LongMemory dashboard](.github/longmemory.png)
+![LongMemory dashboard](.github/longmemory.gif)
 
 LongMemory is a cognitive memory engine for LLM applications and autonomous agents.
 
@@ -86,6 +87,27 @@ longmemory init
 longmemory recall "current project priorities" --mode associative
 ```
 
+### Call a self-hosted server from Python
+
+```bash
+pip install longmemory-sdk
+```
+
+```python
+from longmemory import LongMemory
+
+memory = LongMemory(
+    "http://127.0.0.1:7331",
+    api_key="change-me",
+    user_id="alice",
+)
+
+memory.ingest("I prefer TypeScript")
+result = memory.recall("What language do I prefer?", mode="strict")
+```
+
+The Python package is a zero-dependency HTTP client. The Hydrograph engine remains in the self-hosted TypeScript service. See [docs/python-sdk.md](docs/python-sdk.md).
+
 ---
 
 ## 2. Run as a Service
@@ -375,6 +397,15 @@ longmemory port --from codex --to longmemory --all
 
 See [MIGRATION.md](MIGRATION.md) and [docs/migration.md](docs/migration.md).
 
+Legacy package migration:
+
+```bash
+npm uninstall openmemory-js && npm install longmemory
+pip uninstall openmemory-py && pip install longmemory-sdk
+```
+
+`openmemory-js@2` and `openmemory-py@2` are forwarding bridges for existing installations. New applications should use `longmemory` and `longmemory-sdk` directly. PyPI's unrelated `longmemory` name is owned by another project, so the official distribution is `longmemory-sdk` while the import remains `longmemory`.
+
 ---
 
 ## 14. Release and Operations
```

---

### Incident Patch 2: `6ae0c95d` (2026-08-31)
**Commit Message**: Merge remote main history into LongMemory 1.0 release



---

### Incident Patch 3: `f3853fdb` (2026-08-24)
**Commit Message**: Merge pull request #208 from mameikagou/fix/non-empty-long-summary

fix(memory): preserve long single-sentence summaries

**File**: `packages/openmemory-js/src/memory/hsg.ts` (modified, +7/-1)
```diff
@@ -455,7 +455,13 @@ export function extract_essence(
 
     selected.sort((a, b) => a.idx - b.idx);
 
-    return selected.map((s) => s.text).join(" ");
+    const essence = selected.map((s) => s.text).join(" ");
+
+    // A single sentence can be longer than max_len, especially for text that
+    // does not put whitespace after punctuation. In that case no sentence is
+    // selected, but summary mode must never replace the source with an empty
+    // string.
+    return essence || raw.slice(0, max_len);
 }
 export function compute_token_overlap(
     q_toks: Set<string>,
```

**File**: `packages/openmemory-js/tests/extract_essence.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { describe, expect, it } from "vitest";
+import { extract_essence } from "../src/memory/hsg";
+
+describe("extract_essence", () => {
+    it("falls back to a prefix when a single sentence exceeds the limit", () => {
+        const raw =
+            "This sentence has no terminator and is intentionally longer than the configured summary length";
+
+        expect(extract_essence(raw, "semantic", 40)).toBe(raw.slice(0, 40));
+    });
+
+    it("does not return an empty summary for Chinese text without spaces", () => {
+        const raw =
+            "这是一条没有空格的长中文记忆，它包含多个短句。但是分句后仍可能被当成一个整体，因此摘要不能变成空字符串。";
+
+        expect(extract_essence(raw, "semantic", 30)).toBe(raw.slice(0, 30));
+    });
+});
```

---

### Incident Patch 4: `dc1d4a09` (2026-08-24)
**Commit Message**: Merge pull request #209 from mameikagou/fix/honor-embedding-fallback-chain

fix(embeddings): honor an empty fallback chain

**File**: `packages/openmemory-js/src/core/cfg.ts` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ export const env = {
         | "auto",
     compression_min_length: num(process.env.OM_COMPRESSION_MIN_LENGTH, 100),
     emb_kind: str(process.env.OM_EMBEDDINGS, "synthetic"),
-    embedding_fallback: str(process.env.OM_EMBEDDING_FALLBACK, "synthetic")
+    embedding_fallback: (process.env.OM_EMBEDDING_FALLBACK ?? "synthetic")
         .split(",")
         .map((s) => s.trim())
         .filter(Boolean),
```

**File**: `packages/openmemory-js/src/memory/embed.ts` (modified, +10/-15)
```diff
@@ -155,6 +155,7 @@ async function embed_with_provider(
 
 async function get_sem_emb(t: string, s: string): Promise<number[]> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -167,6 +168,7 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -176,20 +178,21 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}.`,
                 );
-                return gen_syn_emb(t, s);
+                throw e;
             }
         }
     }
 
-    return gen_syn_emb(t, s);
+    throw lastError;
 }
 
 async function emb_batch_with_fallback(
     txts: Record<string, string>,
 ): Promise<Record<string, number[]>> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -218,6 +221,7 @@ async function emb_batch_with_fallback(
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -227,23 +231,14 @@ async function emb_batch_with_fallback(
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}.`,
                 );
-
-                const result: Record<string, number[]> = {};
-                for (const [s, t] of Object.entries(txts)) {
-                    result[s] = gen_syn_emb(t, s);
-                }
-                return result;
+                throw e;
             }
         }
     }
 
-    const result: Record<string, number[]> = {};
-    for (const [s, t] of Object.entries(txts)) {
-        result[s] = gen_syn_emb(t, s);
-    }
-    return result;
+    throw lastError;
 }
 
 async function emb_openai(t: string, s: string): Promise<number[]> {
```

**File**: `packages/openmemory-js/tests/embedding_fallback.test.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+async function loadEmbed(fallback: string) {
+    vi.resetModules();
+    vi.stubEnv("OM_TIER", "deep");
+    vi.stubEnv("OM_EMBEDDINGS", "openai");
+    vi.stubEnv("OM_EMBEDDING_FALLBACK", fallback);
+    vi.stubEnv("OPENAI_API_KEY", "");
+    vi.stubEnv("OM_OPENAI_API_KEY", "");
+    return await import("../src/memory/embed");
+}
+
+describe("embedding fallback chain", () => {
+    afterEach(() => {
+        vi.unstubAllEnvs();
+        vi.resetModules();
+    });
+
+    it("throws after the configured providers fail", async () => {
+        const { embedForSector } = await loadEmbed("");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).rejects.toThrow("OpenAI key missing");
+    });
+
+    it("still uses synthetic vectors when explicitly configured", async () => {
+        const { embedForSector } = await loadEmbed("synthetic");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).resolves.toHaveLength(1536);
+    });
+});
```

---

### Incident Patch 5: `03aeba3c` (2026-08-24)
**Commit Message**: fix(embeddings): honor an empty fallback chain

**File**: `packages/openmemory-js/src/core/cfg.ts` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ export const env = {
         | "auto",
     compression_min_length: num(process.env.OM_COMPRESSION_MIN_LENGTH, 100),
     emb_kind: str(process.env.OM_EMBEDDINGS, "synthetic"),
-    embedding_fallback: str(process.env.OM_EMBEDDING_FALLBACK, "synthetic")
+    embedding_fallback: (process.env.OM_EMBEDDING_FALLBACK ?? "synthetic")
         .split(",")
         .map((s) => s.trim())
         .filter(Boolean),
```

**File**: `packages/openmemory-js/src/memory/embed.ts` (modified, +10/-15)
```diff
@@ -155,6 +155,7 @@ async function embed_with_provider(
 
 async function get_sem_emb(t: string, s: string): Promise<number[]> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -167,6 +168,7 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -176,20 +178,21 @@ async function get_sem_emb(t: string, s: string): Promise<number[]> {
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed. Last error (${provider}): ${errMsg}.`,
                 );
-                return gen_syn_emb(t, s);
+                throw e;
             }
         }
     }
 
-    return gen_syn_emb(t, s);
+    throw lastError;
 }
 
 async function emb_batch_with_fallback(
     txts: Record<string, string>,
 ): Promise<Record<string, number[]>> {
     const providers = [...new Set([env.emb_kind, ...env.embedding_fallback])];
+    let lastError: unknown = new Error("No embedding provider configured");
 
     for (let i = 0; i < providers.length; i++) {
         const provider = providers[i];
@@ -218,6 +221,7 @@ async function emb_batch_with_fallback(
             }
             return result;
         } catch (e) {
+            lastError = e;
             const errMsg = e instanceof Error ? e.message : String(e);
             const nextProvider = providers[i + 1];
 
@@ -227,23 +231,14 @@ async function emb_batch_with_fallback(
                 );
             } else {
                 console.error(
-                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}. Using synthetic.`,
+                    `[EMBED] All providers failed for batch. Last error (${provider}): ${errMsg}.`,
                 );
-
-                const result: Record<string, number[]> = {};
-                for (const [s, t] of Object.entries(txts)) {
-                    result[s] = gen_syn_emb(t, s);
-                }
-                return result;
+                throw e;
             }
         }
     }
 
-    const result: Record<string, number[]> = {};
-    for (const [s, t] of Object.entries(txts)) {
-        result[s] = gen_syn_emb(t, s);
-    }
-    return result;
+    throw lastError;
 }
 
 async function emb_openai(t: string, s: string): Promise<number[]> {
```

**File**: `packages/openmemory-js/tests/embedding_fallback.test.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+async function loadEmbed(fallback: string) {
+    vi.resetModules();
+    vi.stubEnv("OM_TIER", "deep");
+    vi.stubEnv("OM_EMBEDDINGS", "openai");
+    vi.stubEnv("OM_EMBEDDING_FALLBACK", fallback);
+    vi.stubEnv("OPENAI_API_KEY", "");
+    vi.stubEnv("OM_OPENAI_API_KEY", "");
+    return await import("../src/memory/embed");
+}
+
+describe("embedding fallback chain", () => {
+    afterEach(() => {
+        vi.unstubAllEnvs();
+        vi.resetModules();
+    });
+
+    it("throws after the configured providers fail", async () => {
+        const { embedForSector } = await loadEmbed("");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).rejects.toThrow("OpenAI key missing");
+    });
+
+    it("still uses synthetic vectors when explicitly configured", async () => {
+        const { embedForSector } = await loadEmbed("synthetic");
+
+        await expect(
+            embedForSector("remember this", "semantic"),
+        ).resolves.toHaveLength(1536);
+    });
+});
```

---

### Incident Patch 6: `9fb37e41` (2026-08-24)
**Commit Message**: fix(memory): preserve long single-sentence summaries

**File**: `packages/openmemory-js/src/memory/hsg.ts` (modified, +7/-1)
```diff
@@ -455,7 +455,13 @@ export function extract_essence(
 
     selected.sort((a, b) => a.idx - b.idx);
 
-    return selected.map((s) => s.text).join(" ");
+    const essence = selected.map((s) => s.text).join(" ");
+
+    // A single sentence can be longer than max_len, especially for text that
+    // does not put whitespace after punctuation. In that case no sentence is
+    // selected, but summary mode must never replace the source with an empty
+    // string.
+    return essence || raw.slice(0, max_len);
 }
 export function compute_token_overlap(
     q_toks: Set<string>,
```

**File**: `packages/openmemory-js/tests/extract_essence.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { describe, expect, it } from "vitest";
+import { extract_essence } from "../src/memory/hsg";
+
+describe("extract_essence", () => {
+    it("falls back to a prefix when a single sentence exceeds the limit", () => {
+        const raw =
+            "This sentence has no terminator and is intentionally longer than the configured summary length";
+
+        expect(extract_essence(raw, "semantic", 40)).toBe(raw.slice(0, 40));
+    });
+
+    it("does not return an empty summary for Chinese text without spaces", () => {
+        const raw =
+            "这是一条没有空格的长中文记忆，它包含多个短句。但是分句后仍可能被当成一个整体，因此摘要不能变成空字符串。";
+
+        expect(extract_essence(raw, "semantic", 30)).toBe(raw.slice(0, 30));
+    });
+});
```

---

### Incident Patch 7: `117a1d89` (2026-08-19)
**Commit Message**: fix(dashboard): keep rewrite API credentials server-side

**File**: `dashboard/Dockerfile` (modified, +0/-11)
```diff
@@ -3,12 +3,6 @@ FROM node:20-alpine AS builder
 
 WORKDIR /app
 
-# Build-time public vars for Next.js client bundle
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install dependencies
 COPY package*.json ./
 RUN npm install
@@ -24,11 +18,6 @@ FROM node:20-alpine AS production
 
 WORKDIR /app
 
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install only production dependencies
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/package-lock.json ./package-lock.json
```

**File**: `dashboard/lib/project-context.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function ProjectProvider({ children }: { children: React.ReactNode }) {
     const fetchProjects = async () => {
         setIsLoading(true)
         try {
-            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
+            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/openmemory'
             const res = await fetch(`${API_BASE_URL}/dashboard/projects`)
             if (res.ok) {
                 const data = await res.json()
```

**File**: `dashboard/tests/auth-config.test.js` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+const test = require('node:test')
+const assert = require('node:assert/strict')
+const fs = require('node:fs')
+const path = require('node:path')
+
+const root = path.resolve(__dirname, '..', '..')
+const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8')
+
+test('dashboard falls back to the server proxy without baking public API config', () => {
+  const context = read('dashboard/lib/project-context.tsx')
+  const proxy = read('dashboard/app/api/openmemory/[...path]/route.ts')
+  const dockerfile = read('dashboard/Dockerfile')
+
+  assert.match(context, /process\.env\.NEXT_PUBLIC_API_URL \|\| '\/api\/openmemory'/)
+  assert.match(proxy, /process\.env\.OPENMEMORY_API_URL \|\| 'http:\/\/127\.0\.0\.1:7331'/)
+  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_URL/)
+  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_API_KEY/)
+})
```

---

### Incident Patch 8: `172aad43` (2026-08-19)
**Commit Message**: fix(dashboard): remove immutable memory controls

**File**: `dashboard/CHAT_SETUP.md` (modified, +6/-10)
```diff
@@ -6,9 +6,8 @@ The chat interface is now connected to the OpenMemory backend and can query memo
 
 ✅ **Memory Querying**: Searches your memory database for relevant content
 ✅ **Salience-based Results**: Shows top memories ranked by relevance
-✅ **Memory Reinforcement**: Click the + button to boost memory importance
+✅ **Read-only Memory References**: Shows the memories used to generate each response
 ✅ **Real-time Updates**: Live connection to backend API
-✅ **Action Buttons**: Quick actions after assistant responses
 
 ## Setup Instructions
 
@@ -99,19 +98,17 @@ curl -X POST http://localhost:8080/memory/ingest \
 4. **Results**: Top 5 memories returned with salience scores
 5. **Response**: Chat generates answer based on retrieved memories
 
-### Memory Reinforcement
+### Memory References
 
-Clicking the **+** button on a memory card:
-
-- Sends POST to `/memory/reinforce`
-- Increases memory salience by 0.1
-- Makes it more likely to appear in future queries
+Memory cards shown beside a chat response are read-only references. Their salience is
+updated by the backend from observed evidence, so the dashboard does not expose
+manual reinforcement controls.
 
 ## Current Features
 
 ✅ Real-time memory querying
 ✅ Salience-based ranking
-✅ Memory reinforcement (boost)
+✅ Read-only memory references
 ✅ Sector classification display
 ✅ Error handling with backend status
 
@@ -149,7 +146,6 @@ Clicking the **+** button on a memory card:
 ```typescript
 POST /memory/query      // Search memories
 POST /memory/add        // Add new memory
-POST /memory/reinforce  // Boost memory salience
 GET  /memory/all        // List all memories
 GET  /memory/:id        // Get specific memory
 ```
```

**File**: `dashboard/app/chat/page.tsx` (modified, +0/-26)
```diff
@@ -118,22 +118,6 @@ export default function ChatPage() {
         }
     }
 
-    const addMemoryToBag = async (memory: MemoryReference) => {
-        try {
-            await fetch(`${API_BASE_URL}/memory/reinforce`, {
-                method: "POST",
-                headers: getHeaders(),
-                body: JSON.stringify({
-                    id: memory.id,
-                    boost: 0.1
-                })
-            })
-            console.log("Memory reinforced:", memory.id)
-        } catch (error) {
-            console.error("Error reinforcing memory:", error)
-        }
-    }
-
     return (
         <div className="flex flex-col min-h-screen w-full" suppressHydrationWarning>
             <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 mt-6 mb-16" suppressHydrationWarning>
@@ -253,16 +237,6 @@ export default function ChatPage() {
                                                         {memory.content}
                                                     </p>
                                                 </div>
-                                                <button
-                                                    onClick={() => addMemoryToBag(memory)}
-                                                    className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-xl bg-stone-900/70 border border-zinc-800 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
-                                                    aria-label="Add to bag"
-                                                    title="Add to bag"
-                                                >
-                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
-                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12H5" />
-                                                    </svg>
-                                                </button>
                                             </div>
                                         </div>
                                     </div>
```

**File**: `dashboard/app/decay/page.tsx` (modified, +4/-26)
```diff
@@ -101,20 +101,6 @@ export default function decay() {
         }
     }
 
-    async function boostmemory(id: string) {
-        try {
-            const res = await fetch(`${API_BASE_URL}/memory/${id}`, {
-                method: 'PATCH',
-                headers: getHeaders(),
-                body: JSON.stringify({ salience: 0.8 })
-            })
-            if (!res.ok) throw new Error('failed to boost memory')
-            fetchdata()
-        } catch (e: any) {
-            alert(`Error: ${e.message}`)
-        }
-    }
-
     useEffect(() => {
         if (!chartref.current || stats.length === 0) return
 
@@ -333,6 +319,9 @@ export default function decay() {
                             </svg>
                             Memories At Risk
                         </legend>
+                        <p className="mb-4 text-sm text-stone-500">
+                            Salience is updated from observed evidence; this view is for monitoring only.
+                        </p>
                         <div className="space-y-3" suppressHydrationWarning>
                             {riskmems.length === 0 ? (
                                 <div className="text-center py-8 text-stone-500" suppressHydrationWarning>
@@ -341,7 +330,7 @@ export default function decay() {
                             ) : (
                                 riskmems.map(mem => (
                                     <div key={mem.id} className="rounded-xl border border-rose-500/15 bg-rose-500/10 p-4 hover:bg-rose-500/15 transition-colors" suppressHydrationWarning>
-                                        <div className="flex items-center justify-between gap-4" suppressHydrationWarning>
+                                        <div className="flex items-center gap-4" suppressHydrationWarning>
                                             <div className="flex-1" suppressHydrationWarning>
                                                 <div className="flex items-center gap-2 mb-2" suppressHydrationWarning>
                                                     <span className="text-xs px-2 py-1 rounded-lg bg-stone-900 text-stone-300 uppercase tracking-wide">
@@ -351,15 +340,6 @@ export default function decay() {
                                                 </div>
                                                 <p className="text-sm text-stone-300">{mem.content}</p>
                                             </div>
-                                            <button
-                                                onClick={() => boostmemory(mem.id)}
-                                                className="rounded-xl p-2 pl-4 bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 text-white font-medium"
-                                            >
-                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-5">
-                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
-                                                </svg>
-                                                Boost
-                                            </button>
                                         </div>
                                     </div>
                                 ))
@@ -371,5 +351,3 @@ export default function decay() {
         </div>
     )
 }
-
-
```

**File**: `dashboard/tests/mutation-controls.test.js` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+const assert = require("node:assert/strict")
+const fs = require("node:fs")
+const path = require("node:path")
+const test = require("node:test")
+
+const readDashboardFile = (relativePath) =>
+    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8")
+
+test("dashboard pages do not offer immutable memory mutations", () => {
+    const decayPage = readDashboardFile("app/decay/page.tsx")
+    const chatPage = readDashboardFile("app/chat/page.tsx")
+
+    assert.doesNotMatch(decayPage, /memory\/\$\{id\}/)
+    assert.doesNotMatch(decayPage, /method:\s*["']PATCH["']/)
+    assert.doesNotMatch(decayPage, /boostmemory|>\s*Boost\s*</)
+    assert.doesNotMatch(chatPage, /memory\/reinforce|addMemoryToBag|Add to bag/)
+})
+
+test("chat setup documents memory references as read-only", () => {
+    const setup = readDashboardFile("CHAT_SETUP.md")
+
+    assert.match(setup, /Read-only Memory References/)
+    assert.doesNotMatch(setup, /memory\/reinforce|Memory Reinforcement|boost memory importance/i)
+})
```

---

### Incident Patch 9: `ac9c2a58` (2026-08-18)
**Commit Message**: Merge pull request #202 from mikemikimike/fix/dashboard-server-side-api-key

fix(dashboard): keep API keys server-side

**File**: `dashboard/CHAT_SETUP.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps backend API keys server-side. For local development only, you can set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` to make the browser call the backend directly, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps backend API keys server-side. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ### 3. Start the Dashboard
 
```

**File**: `dashboard/Dockerfile` (modified, +0/-11)
```diff
@@ -3,12 +3,6 @@ FROM node:20-alpine AS builder
 
 WORKDIR /app
 
-# Build-time public vars for Next.js client bundle
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install dependencies
 COPY package*.json ./
 RUN npm install
@@ -24,11 +18,6 @@ FROM node:20-alpine AS production
 
 WORKDIR /app
 
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install only production dependencies
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/package-lock.json ./package-lock.json
```

**File**: `dashboard/README.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps authenticated backend API keys on the server. For local development only, you can still use browser-direct configuration with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps authenticated backend API keys on the server. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ## Run the dashboard locally
 
```

**File**: `dashboard/app/api/openmemory/[...path]/route.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import { NextRequest } from 'next/server'
 export const runtime = 'nodejs'
 export const dynamic = 'force-dynamic'
 
-const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:9432').replace(/\/+$/, '')
+const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')
 const API_KEY = process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || ''
 
 async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
```

**File**: `dashboard/lib/project-context.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function ProjectProvider({ children }: { children: React.ReactNode }) {
     const fetchProjects = async () => {
         setIsLoading(true)
         try {
-            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
+            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/openmemory'
             const res = await fetch(`${API_BASE_URL}/dashboard/projects`)
             if (res.ok) {
                 const data = await res.json()
```

---

### Incident Patch 10: `2a8c9708` (2026-08-18)
**Commit Message**: fix(dashboard): keep API keys server-side

**File**: `dashboard/CHAT_SETUP.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps backend API keys server-side. For local development only, you can set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` to make the browser call the backend directly, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps backend API keys server-side. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ### 3. Start the Dashboard
 
```

**File**: `dashboard/Dockerfile` (modified, +0/-11)
```diff
@@ -3,12 +3,6 @@ FROM node:20-alpine AS builder
 
 WORKDIR /app
 
-# Build-time public vars for Next.js client bundle
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install dependencies
 COPY package*.json ./
 RUN npm install
@@ -24,11 +18,6 @@ FROM node:20-alpine AS production
 
 WORKDIR /app
 
-ARG NEXT_PUBLIC_API_URL=http://localhost:8080
-ARG NEXT_PUBLIC_API_KEY=
-ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
-ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
-
 # Install only production dependencies
 COPY --from=builder /app/package.json ./package.json
 COPY --from=builder /app/package-lock.json ./package-lock.json
```

**File**: `dashboard/README.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ OPENMEMORY_API_URL=http://localhost:8080
 # OPENMEMORY_API_KEY=your-secret-api-key
 ```
 
-This keeps authenticated backend API keys on the server. For local development only, you can still use browser-direct configuration with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`, but `NEXT_PUBLIC_*` values are public in the browser bundle.
+This keeps authenticated backend API keys on the server. Set `NEXT_PUBLIC_API_URL` only when the dashboard must call a different URL directly; API keys should remain in the server-only `OPENMEMORY_API_KEY` or `OM_API_KEY` environment variables.
 
 ## Run the dashboard locally
 
```

**File**: `dashboard/app/api/openmemory/[...path]/route.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import { NextRequest } from 'next/server'
 export const runtime = 'nodejs'
 export const dynamic = 'force-dynamic'
 
-const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:9432').replace(/\/+$/, '')
+const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '')
 const API_KEY = process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || ''
 
 async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
```

**File**: `dashboard/lib/project-context.tsx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export function ProjectProvider({ children }: { children: React.ReactNode }) {
     const fetchProjects = async () => {
         setIsLoading(true)
         try {
-            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
+            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/openmemory'
             const res = await fetch(`${API_BASE_URL}/dashboard/projects`)
             if (res.ok) {
                 const data = await res.json()
```

#### Recent Merged Pull Requests:
- **PR #211** (2026-08-24): feat(embeddings): accept DashScope API keys (@mameikagou)
- **PR #210** (2026-08-25): feat(embeddings): add OpenRouter provider (@mameikagou)
- **PR #209** (2026-08-24): fix(embeddings): honor an empty fallback chain (@mameikagou)
- **PR #208** (2026-08-24): fix(memory): preserve long single-sentence summaries (@mameikagou)
- **PR #207** (2026-08-24): feat: Add support for vector search with Qdrant (@anush008)
- **PR #205** (2026-08-20): feat: add OrcaRouter as a named embedding provider (@JinhaoSong322)
- **PR #204** (2026-08-23): fix(dashboard): remove immutable memory controls (@mameikagou)
- **PR #203** (2026-08-24): fix(dashboard): keep rewrite API credentials server-side (@mameikagou)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
